# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier C1 à C9 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8496 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    py essais/atelier_jetable_verif_c9.py

## Ce qu'il monte

- un projet avec ses règles du jeu réglées (nom, style, taille de pixel,
  nombre de couleurs) ;
- trois sujets, un par famille — un personnage, un objet, un décor — chacun
  avec deux images générées (donc deux dépenses, puisqu'une génération coûte) ;
- une pièce d'équipement, portée par le personnage ;
- un clip, et une bande montée dessus, rangée dans une attitude du personnage.

Rien n'a été payé : le fournisseur et l'animateur sont des doubles.
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.services import Atelier  # noqa: E402

from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402
from test_a10 import clip_connu  # noqa: E402

PORT = 8496
MODELE = "essai:rend-du-png"


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _sujet(client, nom: str, **corps) -> dict:
    return _exiger(
        client.post("/api/characters", json={"nom": nom, **corps}),
        f"la création de « {nom} »",
    )["personnage"]


def _calque(atelier, client, dossier: Path, *, personnage: str, piece: str, pose: str) -> str:
    """Un calque posé à la main — même geste que `atelier_jetable_b19.py`.

    C'est le moyen le plus direct de faire porter une pièce : passer par une
    vraie planche d'équipement demanderait de fabriquer une image à plusieurs
    cases, ce qu'une vérification d'écran n'a pas besoin de payer.
    """
    fichier = dossier / f"{personnage}-{piece}-{pose}.png"
    fichier.write_bytes(image_sujet(toile=64, bloc=4))
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(fichier), "forcer": True}),
        f"l'import du calque « {piece} »",
    )["asset"]
    objet = atelier.assets.lire(importe["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    objet.label = f"{piece} · {pose}"
    atelier.assets.sauver(objet)
    return objet.identifiant


def _images(
    client, double, sujet_id: str | None, nom: str, *, poses: tuple[str, ...] = ("", "")
) -> None:
    """Deux images générées — donc deux dépenses (une génération coûte).

    `sujet_id=None` fabrique des images libres, non rangées dans une case —
    **c'est le cas d'un décor**, dont le plan est vide et qui ne tient donc
    aucune pose du tout (`atelier/domaine/plan.py`, table `PLANS_PAR_TYPE`).
    Un personnage ou un objet, eux, visent une case précise : `poses` en donne
    le nom, une par image.
    """
    for rang, pose in enumerate(poses):
        double.rendre = lambda r=rang: image_sujet(bloc=4, toile=24, logique_l=8 + r)
        corps = {
            "modele": MODELE,
            "prompt": f"{nom}, vue {rang + 1}",
            "echelle": "personnage",
        }
        if sujet_id is not None:
            corps["personnage"] = sujet_id
            corps["pose"] = pose
        lancee = client.post("/api/generations", json=corps)
        assert lancee.status_code == 202, lancee.text
        _attendre(client, lancee.json()["identifiant"])
    double.rendre = None


def peupler(
    atelier: Atelier, double: FournisseurDouble, animateur: AnimateurDouble, dossier: Path
) -> dict:
    gabarits = dossier / "gabarits"
    gabarits.mkdir(parents=True, exist_ok=True)
    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/projects", json={"nom": "Vérification C9"}),
            "la création du projet",
        )
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 32,
                    "couleurs": 24,
                    "vue": "vue-dessus-34",
                },
            ),
            "le réglage des règles du jeu",
        )

        # ── Un sujet par famille, chacun avec deux images ─────────────────────
        # L'objet reçoit un type explicite — « objet tenu » — parce que sinon
        # le produit devine un type d'après le nom, et ce n'est pas ce qu'on
        # veut vérifier ici. Le décor, lui, n'a **aucune** pose (son plan est
        # vide) : ses images restent donc libres, non rangées dans une case.
        personnage = _sujet(client, "Le nain forgeron")
        objet = _sujet(client, "Une épée courte", famille="objets", type="objet tenu")
        decor = _sujet(client, "Les cavernes du nord", famille="decors")

        _images(
            client, double, personnage["identifiant"], "le nain forgeron",
            poses=("repos", "marche"),
        )
        _images(
            client, double, objet["identifiant"], "une épée courte",
            poses=("tenu", "tenu"),
        )
        _images(client, double, None, "les cavernes du nord")

        # ── Une pièce d'équipement, portée par le personnage (C3) ─────────────
        piece = _exiger(
            client.post(
                "/api/characters/pieces",
                json={
                    "nom": "Marteau de forge",
                    "description": "a heavy two-handed war hammer",
                    "emplacement": "les mains",
                },
            ),
            "la création de la pièce d'équipement",
        )["piece"]
        _calque(
            atelier, client, gabarits,
            personnage=personnage["identifiant"],
            piece=piece["identifiant"],
            pose="repos",
        )
        # **Une pièce née par la route neuve déclare toujours ses emplois**
        # (voir `atelier_jetable_b19.py`) : sans ce geste, elle resterait
        # « déclarée et vide » malgré son calque, et sa fiche dirait qu'elle ne
        # porte rien. On la déclare donc portée, en plus du calque qui l'habille.
        _exiger(
            client.post(
                f"/api/characters/pieces/{piece['identifiant']}/uses",
                json={"genre": "porte", "porteur": personnage["identifiant"]},
            ),
            "l'attribution de la pièce à son porteur",
        )

        # ── Un clip, et une bande montée dessus ───────────────────────────────
        sprite_id = client.get("/api/assets").json()["assets"][0]["identifiant"]
        animateur.octets = clip_connu()
        animateur.facture = 0.0
        lot = client.post(
            "/api/clips",
            json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite_id},
        ).json()["clips"]
        clip = lot[0]["identifiant"]
        for _ in range(600):
            arrives = client.get("/api/clips").json()["clips"]
            if arrives and all(c["statut"] in ("reussie", "echouee") for c in arrives):
                break
            client.get("/api/status")

        bande = client.post(
            "/api/strips",
            json={
                "clip": clip,
                "nom": "marche",
                "images": [12, 14, 16, 18, 20],
                "cadence": 8,
                "sens": "boucle",
            },
        ).json()
        client.put(
            f"/api/strips/{bande['identifiant']}/case",
            json={"personnage": personnage["identifiant"], "pose": "marche"},
        )

        return {
            "personnage": personnage["identifiant"],
            "objet": objet["identifiant"],
            "decor": decor["identifiant"],
            "piece": piece["identifiant"],
            "clip": clip,
            "bande": bande["identifiant"],
        }


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper — la bande sera absente.")

    dossier = Path(tempfile.mkdtemp(prefix="atelier-verif-c9-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )

    depart = time.perf_counter()
    monte = peupler(atelier, double, animateur, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print(f"  Personnage : {monte['personnage']}")
    print(f"  Objet      : {monte['objet']}")
    print(f"  Décor      : {monte['decor']}")
    print(f"  Pièce      : {monte['piece']}")
    print(f"  Clip       : {monte['clip']}")
    print(f"  Bande      : {monte['bande']}")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
