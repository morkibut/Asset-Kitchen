# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier M1 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8426, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **le cas exact que la tranche répare** : un personnage dont les corps
font 128 pixels de côté, une pièce posée dessus par une planche que le modèle
rend en 1 024 — donc une case arrivée **huit fois plus grande que le cadre du
corps**. C'est la situation des deux casques de *balthazar-2*, et la seule où
l'ancien découpage jetait tout le sujet.

De quoi cliquer sur ce que la tranche livre, sur la table *superposition* du
vêtement :

- la bascule **telle qu'arrivée** doit faire paraître, sous *le calage du
  dessus*, la phrase qui dit que le dessus a été **ramené au cadre**, avec sa
  taille de départ et sa réduction ;
- le grand cadre du milieu doit montrer **la case entière**, réduite, et non son
  coin haut-gauche ;
- **le calque seul**, à droite, doit contenir la pièce — il sortait rempli de
  fond uni ;
- repasser sur **telle que rangée** doit faire disparaître la phrase : le
  vêtement rangé tient dans le cadre, et rien n'est touché.

    py essais/atelier_jetable_m1.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Ce que la console dit avant qu'on ouvre le navigateur.** Les chiffres que
l'écran n'a plus qu'à montrer : la taille de la case arrivée, celle du corps, ce
que le coin gardait, et les pixels de sujet que le calque contient de chaque
côté de la réparation. Un essai d'écran ne remonterait pas ces mesures-là —
c'est la leçon du banc de `D2`.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.domaine.pliage import geometrie  # noqa: E402
from atelier.domaine.superposition import Superposition  # noqa: E402
from atelier.image import calque as calc  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, planche_sujets  # noqa: E402

PORT = 8426
MODELE = "essai:rend-du-png"
# **La planche revient bien plus grande que ce qui est parti**, et c'est le
# fait qui a ouvert la tranche : un modèle rend 1 024 quel que soit le corps
# qu'on lui a envoyé.
COTE_RENDU = 1024


def habiller(demande, cases: int) -> bytes:
    """La planche reçue, agrandie à 1 024, avec un sac posé sur chaque sujet.

    **L'agrandissement est le sujet de l'essai.** Le double rendait jusqu'ici la
    planche à la taille où elle était partie ; ici il fait ce que fait un vrai
    modèle, et c'est ce qui rend la case arrivée huit fois plus grande que le
    corps.
    """
    envoyee = demande.references[-1]
    with Image.open(io.BytesIO(envoyee)) as ouverte:
        planche = ouverte.convert("RGB").resize(
            (COTE_RENDU, COTE_RENDU), Image.Resampling.NEAREST
        )
    dessin = ImageDraw.Draw(planche)
    forme = geometrie(cases)
    for boite in calc.cases_de(planche.width, planche.height, forme):
        x0, y0, x1, y1 = boite
        large, haut = x1 - x0 + 1, y1 - y0 + 1
        dessin.rectangle(
            [x0 + large // 3, y0 + haut // 4, x0 + 2 * large // 3, y0 + haut // 2],
            fill=(40, 130, 60),
        )
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
        time.sleep(0.01)
    raise AssertionError("la génération n'a pas fini")


def _sujet(rgba: np.ndarray) -> int:
    return int((rgba[:, :, 3] >= calc.OPACITE).sum())


def _coin(dessus: np.ndarray, dessous: np.ndarray) -> np.ndarray:
    """Le contrat d'avant `M1` — le coin haut-gauche, et le reste jeté."""
    hauteur, largeur = dessous.shape[:2]
    cadre = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    cadre.paste(Image.fromarray(dessus, "RGBA"), (0, 0))
    return np.asarray(cadre)


def peupler(atelier: Atelier, double: FournisseurDouble) -> str:
    with TestClient(creer_application(atelier)) as client:
        plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        poses = plan[:2]
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le pèlerin", "description": "un pèlerin encapuchonné"},
        ).json()["personnage"]["identifiant"]
        client.put(f"/api/characters/{personnage}", json={"poses": poses})

        double.rendre = lambda: planche_sujets(len(poses))
        corps = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "un pèlerin encapuchonné",
                "personnage": personnage,
                "poses": poses,
            },
        )
        _attendre(client, corps.json()["identifiant"])
        double.rendre = None

        piece = client.post(
            "/api/characters/pieces",
            json={
                "nom": "sac de voyage",
                "description": "un gros sac de voyage avec corde et matelas roulé",
                "emplacement": "dos",
                "portee": "contenue",
            },
        ).json()["piece"]["identifiant"]

        double.repondre = lambda demande: habiller(demande, len(poses))
        habits = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "a big travel backpack with rope and bedroll",
                "personnage": personnage,
                "piece": piece,
                "poses": poses,
            },
        )
        _attendre(client, habits.json()["identifiant"])
        double.repondre = None

        assets = client.get("/api/assets", params={"limite": 200}).json()["assets"]
        vetement = next(
            a
            for a in assets
            if a["generation"] == habits.json()["identifiant"] and a["rang"] >= 100
        )

        # ── Ce que l'écran n'aura plus qu'à montrer ──────────────────────────
        ouvert = client.get(
            f"/api/assets/{vetement['identifiant']}/overlay"
        ).json()
        assert ouvert["arrivee_possible"], "la case arrivée doit être retrouvable"
        pose = {**ouvert["pose"], "dessus_arrivee": True}
        vu = client.post("/api/overlay/preview", json=pose).json()
        cadrage = vu["cadrage"]

        haut = calc.avec_alpha(
            client.get(
                f"/api/assets/{vetement['identifiant']}/incoming"
            ).content
        )
        bas = atelier.superposition._paire(  # noqa: SLF001 — lecture, pas écriture
            pose["dessus"], pose["dessous"], arrivee=False
        )[1]
        avant = calc.superposer(bas, _coin(haut, bas), Superposition())[0]
        apres = calc.superposer(bas, haut, Superposition())[0]

        print()
        print(f"  la case arrivée fait      {cadrage['source_largeur']}×"
              f"{cadrage['source_hauteur']}")
        print(f"  le cadre du corps fait    {bas.shape[1]}×{bas.shape[0]}")
        print(f"  le coin gardait           "
              f"{bas.shape[0] * bas.shape[1] / (haut.shape[0] * haut.shape[1]) * 100:.1f} %"
              f" de l'image")
        print(f"  elle y entre réduite à    {cadrage['facteur'] * 100:.0f} %, "
              f"posée en ({cadrage['gauche']}, {cadrage['sommet']})")
        print()
        print(f"  sujet de la case arrivée              {_sujet(haut)}")
        print(f"  pixels de sujet dans le calque · coin  {_sujet(avant)}")
        print(f"  pixels de sujet dans le calque · cadre {_sujet(apres)}")
        print()
        print("  Et sur le dessus tel qu'il est rangé, rien ne doit être dit :")
        range_ = client.post(
            "/api/overlay/preview", json={**ouvert["pose"], "dessus_arrivee": False}
        ).json()
        print(f"    ramené : {range_['cadrage']['ramene']} — "
              f"facteur {range_['cadrage']['facteur']}")

        return vetement["identifiant"]


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-m1-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    vetement = peupler(atelier, double)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print(f"Le vêtement à ouvrir : {vetement}")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
