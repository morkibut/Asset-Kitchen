# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer **B25 — une seule porte** : les six chemins
qui menaient à l'ancien écran des tables, et la septième porte qui n'existait
pas — une image de la galerie qui n'est le sujet de personne.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8497 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    ../../../.venv/Scripts/python.exe essais/atelier_jetable_b25.py

## Ce qu'il monte

Un projet, un personnage **« Le sujet »** avec **deux images** dans sa première
case et **un calque** posé sur la même pose — un calque porteur d'une vraie
`difference`, sans quoi le bouton *superposition ›* ne paraît pas. Et, à côté,
**une image que personne n'a adoptée** : elle vit dans la galerie et dans aucune
case. **Rien n'a été payé** : les images arrivent par le double de fournisseur
des essais, jamais par un appel réel.

## Ce qu'on vient voir à l'écran

1. **Galerie › une image sans sujet** → *Ouvrir les tables* : la retouche
   s'ouvre, et la colonne des sœurs montre les voisines de la grille.
2. **Galerie › une image de sujet** → même porte, même écran.
3. **Codex › Personnages › « Le sujet » › une image de *Ses images*** : la
   retouche s'ouvre sur **cette** image-là.
4. La bandeau **« La retouche › »** : elle s'ouvre sur l'image qu'on regarde,
   pas sur la référence de la case.
5. **Un calque › *superposition ›*** : la retouche s'ouvre du premier coup sur
   la fabrique **Superposer**.
6. **Le retour**, depuis chacun de ces chemins : on revient d'où l'on venait, et
   le fil d'Ariane le dit.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from dataclasses import replace
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.recette import Difference  # noqa: E402
from atelier.services import Atelier  # noqa: E402

from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8497

COTE = 320
FOND = (238, 234, 226)


def _sujet(couleur: tuple[int, int, int], chapeau: bool = False) -> bytes:
    """Une silhouette simple sur un fond clair — assez pour juger une image."""
    image = Image.new("RGB", (COTE, COTE), FOND)
    dessin = ImageDraw.Draw(image)
    dessin.ellipse([120, 60, 200, 140], fill=couleur)
    dessin.rectangle([130, 140, 190, 270], fill=couleur)
    if chapeau:
        dessin.rectangle([110, 44, 210, 62], fill=(40, 40, 48))
    return _octets(image)


def _octets(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _generer(client, double, projet: str, rendu, prompt: str) -> str:
    """Demande une image au double, et **attend qu'elle soit rangée**.

    La route rend `202 Accepted` : l'asset n'existe pas encore au retour, et le
    lire tout de suite rend `None`. Les essais qui posent l'image dans une case
    ne s'en aperçoivent pas — leur `PUT …/character` arrive après —, ceux qui
    écrivent directement dans l'objet, si.
    """
    double.rendre = rendu
    generation = _exiger(
        client.post(
            "/api/generations",
            json={
                "modele": "essai:rend-du-png",
                "prompt": prompt,
                "projet": projet,
            },
        ),
        f"la génération « {prompt} »",
    )
    asset_id = f"{generation['identifiant']}-0"
    for _ in range(200):
        if client.get(f"/api/assets/{asset_id}").status_code == 200:
            return asset_id
        time.sleep(0.05)
    raise SystemExit(f"L'image « {prompt} » n'est jamais arrivée ({asset_id}).")


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Essai B25"}),
            "le projet « Essai B25 »",
        )["projet"]["identifiant"]

        personnage = _exiger(
            client.post("/api/characters", json={"nom": "Le sujet"}),
            "la création de « Le sujet »",
        )["personnage"]["identifiant"]

        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]

        # Deux images dans la même case : c'est ce qui rend visible « la retouche
        # s'ouvre sur l'image qu'on regarde », puisqu'il y a une autre image à
        # ouvrir par erreur.
        corps = []
        for rang, couleur in enumerate([(196, 72, 60), (64, 132, 96)]):
            asset_id = _generer(
                client,
                double,
                projet,
                lambda c=couleur: _sujet(c),
                f"le sujet, prise {rang + 1}",
            )
            _exiger(
                client.put(
                    f"/api/assets/{asset_id}/character",
                    json={
                        "personnage": personnage,
                        "pose": poses[0],
                        "projet": projet,
                    },
                ),
                f"poser la prise {rang + 1} dans sa case",
            )
            objet = atelier.assets.lire(asset_id)
            objet.label = f"le sujet, prise {rang + 1}"
            objet.favori = rang == 0
            atelier.assets.sauver(objet)
            corps.append(asset_id)

        # ⚠️ **Une pièce déclarée, sinon pas de colonne** — le piège de `B20`.
        # Le panneau d'un calque ne s'ouvre que depuis la colonne de sa pièce
        # dans la matrice, et une pièce que le vestiaire ignore n'a pas de
        # colonne. Écrire `asset.piece` ne suffit donc pas.
        piece = _exiger(
            client.post(
                "/api/characters/pieces",
                json={
                    "nom": "Chapeau",
                    "emplacement": "tête",
                    "porteur": personnage,
                    "projet": projet,
                },
            ),
            "la pièce « Chapeau »",
        )["piece"]["identifiant"]

        # Le calque : une image de la même pose, avec la pièce écrite et une
        # `difference` posée sur le premier corps. Sans elle, le panneau du
        # calque ne montre pas « superposition › » — la porte qu'on vient
        # cliquer.
        calque = _generer(
            client,
            double,
            projet,
            lambda: _sujet((196, 72, 60), chapeau=True),
            "le sujet, coiffé",
        )
        objet = atelier.assets.lire(calque)
        objet.personnage = personnage
        objet.pose = poses[0]
        objet.piece = piece
        objet.label = "Chapeau · repos"
        # Une recette est gelée : la seconde place se pose en remplaçant la
        # recette entière, jamais en écrivant dedans.
        objet.recette = replace(
            objet.recette,
            difference=Difference(base=corps[0], zone=(96, 30, 224, 160)),
        )
        atelier.assets.sauver(objet)

        # L'orpheline : dans la galerie, dans aucune case. C'est la septième
        # porte — celle qui n'existait pas avant `B25`.
        orpheline = _generer(
            client,
            double,
            projet,
            lambda: _sujet((72, 96, 190)),
            "une image que personne n'a adoptée",
        )
        objet = atelier.assets.lire(orpheline)
        objet.label = "l'orpheline"
        atelier.assets.sauver(objet)

        return {
            "projet": projet,
            "personnage": personnage,
            "corps": corps,
            "calque": calque,
            "orpheline": orpheline,
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b25-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )

    monte = peupler(atelier, double)

    print()
    print("  Appels payés       : 0  (rien n'a été généré ni commandé)")
    print(f"  Personnage         : {monte['personnage']} (« Le sujet »)")
    print(f"  Images de la case  : {', '.join(monte['corps'])}")
    print(f"  Calque             : {monte['calque']} (Chapeau · repos)")
    print(f"  Sans sujet         : {monte['orpheline']} (« l'orpheline »)")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Galerie › « l'orpheline » › Ouvrir les tables : la retouche")
    print("    s'ouvre, sœurs = les voisines de la grille")
    print("  → Galerie › une image du sujet : même porte, même écran")
    print("  → Codex › Personnages › « Le sujet » › une image de Ses images")
    print("  → Le bandeau « La retouche › » : sur l'image qu'on regarde")
    print("  → Un calque › « superposition › » : sur la fabrique Superposer")
    print("  → Le retour, depuis chacun : on revient d'où l'on venait")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
