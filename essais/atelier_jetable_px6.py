# -*- coding: utf-8 -*-
"""Un atelier jetable pour la relecture croisée du chantier PixelLab (PX6),
sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8427, avec le fournisseur et ComfyUI
doublés comme dans les essais : rien n'est payé, aucun calcul GPU réel n'a
lieu, rien n'est écrit dans `donnees/`, et l'atelier de l'auteur ne bouge pas
d'un pixel.

Il monte de quoi regarder deux écrans :

- **La fabrique « Repeindre »**, sur la fiche d'une image — le pinceau, la
  liste des modèles (`sdxl-retouche-zone` installé et prêt, les quatre autres
  outils de PX7 grisés avec leur raison, ComfyUI n'ayant que celui-ci de
  résolu chez ce double), le temps annoncé sur le bouton.
- **La fenêtre de préparation d'une animation**, « 4. Le clip » — « Place
  autour du sujet » (PX4) et « Fin de l'animation » (PX5).

    py essais/atelier_jetable_px6.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import raccorder  # noqa: E402
from tests.test_px2_masque import ComfyZoneDouble  # noqa: E402
from tests.conftest import FournisseurDouble, image_sujet  # noqa: E402

PORT = 8427
ZONE_PRETE = "sdxl-retouche-zone"


def peupler(atelier) -> tuple[str, str]:
    """Un jeu, un sujet avec une pose, une image importée — de quoi ouvrir
    la retouche et la fabrique « Repeindre », et une fabrication d'animation."""
    with TestClient(creer_application(atelier)) as client:
        projet = atelier.bibliotheque.courant
        png = image_sujet(bloc=4, toile=256)
        asset = atelier.generations.importer(png, "Héros", projet=projet)["asset"]["identifiant"]
        print(f"  image importée : {asset}")
        personnage = client.post("/api/characters", json={"nom": "Héros", "description": "un aventurier"}).json()["personnage"]["identifiant"]
        client.put(f"/api/assets/{asset}/character", json={"personnage": personnage, "pose": "marche"})
        print(f"  personnage : {personnage} — pose « marche » posée sur l'image importée")
        return asset, personnage


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-px6-"))
    print(f"Dossier jetable : {dossier}")

    dist = RACINE / "interface" / "dist"
    if not dist.exists():
        print("⚠️  interface/dist absent — lance `npm --prefix interface run build` d'abord.")

    double = FournisseurDouble()
    comfy = ComfyZoneDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)

    asset, personnage = peupler(atelier)

    # **Un seul outil de zone « prêt »** chez ce double (`sdxl-retouche-zone`) :
    # les quatre autres de PX7 doivent apparaître grisés dans « Repeindre »,
    # avec leur raison — c'est ce que la relecture veut voir.
    import asyncio
    asyncio.run(atelier.styles_locaux.installer(ZONE_PRETE))
    asyncio.run(atelier.catalogue.rafraichir())

    print(f"\nImage à ouvrir : /api/assets/{asset}")
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
