# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la correction de **B24 — ce qui restait
dans les murs** (le cadre du zoom, le témoin « par-dessus », le
`ResizeObserver` et la découpe depuis la retouche, dans `Retouche.tsx` et
`App.tsx`).

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8496 : rien n'est écrit dans
`donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b24.py

## Ce qu'il monte

Un projet, un personnage **« Le sujet »**, et une seule image posée dans sa
première case — une planche carrée de 1 036 px de côté (quatre quartiers
colorés séparés par de vraies gouttières), assez grande pour déborder un
cadre de retouche à 250 %, et assez régulière pour que « les gouttières »
trouve quatre rectangles à découper. **Rien n'a été payé** : l'image arrive
par le double de fournisseur des essais, jamais par un appel réel.

## Ce qu'on vient voir à l'écran

1. Codex › Personnages › « Le sujet » › **« La retouche › »**.
2. Zoomer au-delà de l'ajusté (250 %) : les quatre coins de l'image doivent
   rester atteignables au défilement — plus de moitié gauche ni de haut
   perdus.
3. Activer le témoin **« par-dessus »** : le calque doit coïncider avec
   l'image, au repos et zoomé.
4. Ouvrir **Découpage**, revenir à **Détourage** : le cadre doit continuer de
   suivre un redimensionnement de la fenêtre après ce retour.
5. Rouvrir **Découpage**, choisir **« les gouttières »**, découper : la
   retouche doit rester ouverte sur l'image d'origine — jamais un écran qui se
   referme sans un mot.
"""

from __future__ import annotations

import io
import sys
import tempfile
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
from atelier.services import Atelier  # noqa: E402

from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8496

FOND = (240, 236, 228)
GOUTTIERE = 12
CASE = 500
COULEURS = [(200, 60, 60), (60, 150, 90), (60, 100, 200), (210, 170, 40)]


def _feuille() -> bytes:
    """Une planche à quatre cases, 1 036 px de côté — plus grande que le seuil
    de 1 024 px demandé pour reproduire le débordement du zoom."""
    largeur = 2 * CASE + 3 * GOUTTIERE
    hauteur = 2 * CASE + 3 * GOUTTIERE
    image = Image.new("RGB", (largeur, hauteur), FOND)
    dessin = ImageDraw.Draw(image)
    for indice, couleur in enumerate(COULEURS):
        ligne, colonne = divmod(indice, 2)
        x0 = GOUTTIERE + colonne * (CASE + GOUTTIERE)
        y0 = GOUTTIERE + ligne * (CASE + GOUTTIERE)
        dessin.rectangle([x0, y0, x0 + CASE - 1, y0 + CASE - 1], fill=couleur)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Essai B24"}),
            "le projet « Essai B24 »",
        )["projet"]["identifiant"]

        personnage = _exiger(
            client.post("/api/characters", json={"nom": "Le sujet"}),
            "la création de « Le sujet »",
        )["personnage"]["identifiant"]

        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]

        double.rendre = _feuille
        generation = _exiger(
            client.post(
                "/api/generations",
                json={
                    "modele": "essai:rend-du-png",
                    "prompt": "une planche à quatre quartiers",
                    "projet": projet,
                },
            ),
            "la génération de la planche",
        )
        asset_id = f"{generation['identifiant']}-0"

        _exiger(
            client.put(
                f"/api/assets/{asset_id}/character",
                json={"personnage": personnage, "pose": poses[0], "projet": projet},
            ),
            "poser la planche dans sa case",
        )

        asset = client.get(f"/api/assets/{asset_id}").json()

        return {
            "projet": projet,
            "personnage": personnage,
            "asset": asset_id,
            "largeur": asset.get("largeur"),
            "hauteur": asset.get("hauteur"),
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b24-"))
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
    print(f"  Image posée        : {monte['asset']} — {monte['largeur']}×{monte['hauteur']} px")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › « Le sujet » › « La retouche › »")
    print("  → Zoomer à 250 % : les quatre coins doivent rester atteignables")
    print("  → Témoin « par-dessus » : le calque doit coïncider avec l'image")
    print("  → Découpage puis retour à Détourage : le cadre doit suivre un")
    print("    redimensionnement de la fenêtre après ce retour")
    print("  → Découper (mode « les gouttières ») : la retouche doit rester")
    print("    ouverte sur l'image d'origine, jamais se refermer sans un mot")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
