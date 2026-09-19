# -*- coding: utf-8 -*-
"""Banc payé de P2 (V3.5) : une planche de huit objets différents, huit tirages.

**L'atelier de l'auteur (port 8420) n'est pas touché.** Ce banc monte un atelier
à part, dans un dossier temporaire, avec l'univers de « la forêt magique » copié
tel quel (bible, palette, taille de pixel, tableau) mais sans ses sujets. Il y
crée huit objets, puis :

    py essais/banc_planche_objets.py preparer     rien n'est payé : texte et prix
    py essais/banc_planche_objets.py payer 8      huit tirages, un appel chacun

Le modèle est le défaut du jeu pour la famille *objets* : le jeu n'en règle
aucun, c'est donc celui du produit, `OpenRouter:openai/gpt-image-2`, qualité
basse (`atelier/services/catalogue.py`, `DEFAUT`).

Les planches, leurs morceaux et ce que l'atelier a signalé partent dans
`essais/resultats/planche-objets/` ; le relevé se fait à l'œil, case par case.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

JEU = "la-foret-magique"
DOSSIER = Path(os.environ.get("TEMP", "/tmp")) / "atelier-planche-objets"
SORTIE = RACINE / "essais" / "resultats" / "planche-objets"
MODELE = "OpenRouter:openai/gpt-image-2"
OPTIONS = {"quality": "low"}
DEMANDE = "A set of separate game items."  # la phrase d'ensemble de l'écran (P2b)

# Dans l'ordre de lecture : la case n porte l'objet n. Des objets posés, des
# objets tenus et un meuble, pour que les cases n'aient pas toutes la même pose.
OBJETS = [
    ("Potion de soin", "a red healing potion in a round glass flask with a cork", "objet tenu"),
    ("Clé de fer", "an old iron key with a ring-shaped bow", "objet tenu"),
    ("Bourse", "a small leather coin pouch tied with a string", "objet posé"),
    ("Champignon lumineux", "a glowing blue forest mushroom", "objet posé"),
    ("Parchemin", "a rolled parchment scroll with a red wax seal", "objet tenu"),
    ("Dague elfique", "an elven dagger with a leaf-shaped blade", "objet tenu"),
    ("Lanterne", "a small brass lantern with a candle inside", "objet posé"),
    ("Coffre", "a small wooden chest with iron bands", "meuble"),
]


def monter() -> None:
    """Un dossier neuf, avec l'univers du jeu et rien d'autre."""
    if DOSSIER.exists():
        shutil.rmtree(DOSSIER)
    source = RACINE / "donnees"
    (DOSSIER / "projets" / JEU).mkdir(parents=True)
    shutil.copy2(source / "projets" / JEU / "projet.json", DOSSIER / "projets" / JEU)
    if (source / "projets" / JEU / "tableau").exists():
        shutil.copytree(source / "projets" / JEU / "tableau", DOSSIER / "projets" / JEU / "tableau")
    shutil.copy2(source / "catalogue.json", DOSSIER)
    (DOSSIER / "atelier.json").write_text(json.dumps({"courant": JEU}), encoding="utf-8")


def creer_objets(client: TestClient) -> list[str]:
    identifiants = []
    for nom, description, type_ in OBJETS:
        cree = client.post(
            "/api/characters",
            json={"nom": nom, "description": description, "famille": "objets", "projet": JEU},
        )
        assert cree.status_code == 201, cree.text
        ident = cree.json()["personnage"]["identifiant"]
        typee = client.put(f"/api/characters/{ident}", json={"type": type_, "projet": JEU})
        assert typee.status_code == 200, typee.text
        identifiants.append(ident)
    (DOSSIER / "sujets.json").write_text(json.dumps(identifiants), encoding="utf-8")
    return identifiants


def preparer() -> None:
    monter()
    with TestClient(creer_application(Atelier(racine=DOSSIER))) as client:
        sujets = creer_objets(client)
        envoi = client.post(
            "/api/outgoing",
            json={"prompt": DEMANDE, "modele": MODELE, "projet": JEU, "sujets": sujets},
        )
        assert envoi.status_code == 200, envoi.text
        lu = envoi.json()
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / "envoi.json").write_text(json.dumps(lu, ensure_ascii=False, indent=2), encoding="utf-8")
    print("── Le texte qui part ──")
    for ligne in lu.get("lignes", []):
        print(ligne if isinstance(ligne, str) else json.dumps(ligne, ensure_ascii=False))
    print("── Le prix ──")
    print(json.dumps(lu.get("prix"), ensure_ascii=False, indent=2))
    print("── Le reste de l'annonce (clés) ──", sorted(lu))


def _attendre(client: TestClient, identifiant: str) -> dict:
    for _ in range(1800):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.5)
    raise RuntimeError(f"le tirage {identifiant} n'est jamais revenu")


def payer(tirages: int) -> None:
    atelier = Atelier(racine=DOSSIER)
    sujets = json.loads((DOSSIER / "sujets.json").read_text(encoding="utf-8"))
    SORTIE.mkdir(parents=True, exist_ok=True)
    releve = []
    with TestClient(creer_application(atelier)) as client:
        for n in range(1, tirages + 1):
            reponse = client.post(
                "/api/generations",
                json={
                    "modele": MODELE,
                    "prompt": DEMANDE,
                    "options": OPTIONS,
                    "variations": 1,
                    "identifiant": str(uuid.uuid4()),
                    "sujets": sujets,
                },
            )
            assert reponse.status_code == 202, reponse.text
            vue = _attendre(client, reponse.json()["identifiant"])
            gen = vue["identifiant"]
            ligne = {"tirage": n, "generation": gen, "statut": vue["statut"],
                     "cout": vue.get("cout"), "erreur": vue.get("erreur")}
            print(f"tirage {n} : {vue['statut']} · coût {vue.get('cout')}", flush=True)
            if vue["statut"] == "reussie":
                planche = f"{gen}-0"
                image = client.get(f"/api/assets/{planche}/image")
                (SORTIE / f"t{n}-planche.png").write_bytes(image.content)
                depliages = client.get(f"/api/assets/{planche}/unfoldings").json()
                ligne["depliages"] = depliages
                rangs = sorted(r for r in atelier.base.rangs_de_generation(gen) if r >= 100)
                morceaux = []
                for r in rangs:
                    asset = atelier.base.lire_asset(f"{gen}-{r}")
                    morceau = client.get(f"/api/assets/{gen}-{r}/image")
                    (SORTIE / f"t{n}-r{r}.png").write_bytes(morceau.content)
                    morceaux.append({"rang": r, "sujet": asset.personnage, "pose": asset.pose})
                ligne["morceaux"] = morceaux
            releve.append(ligne)
            (SORTIE / "releve.json").write_text(
                json.dumps({"sujets": sujets, "objets": OBJETS, "tirages": releve},
                           ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "preparer"
    if mode == "preparer":
        preparer()
    elif mode == "payer":
        payer(int(sys.argv[2]) if len(sys.argv) > 2 else 8)
    else:
        sys.exit("preparer | payer N")
