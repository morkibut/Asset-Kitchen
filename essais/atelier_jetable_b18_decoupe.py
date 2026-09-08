# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer le troisième mode de Découper — **les
gouttières** (`B18`).

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8495 : rien n'est écrit dans
`donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_decoupe.py

## Ce qu'il monte, et pourquoi

Une planche de quatre poses, posée sur un fond uni, avec de vraies bandes de
fond entre les cases — le cas que « zones opaques » et « grille fixe » ne
savent pas lire, et que « les gouttières » lit directement sur la brute, sans
détourage. **Rien n'a été payé** : l'image arrive par le double de
fournisseur des essais, jamais par un appel réel.

## Ce qu'on vient voir à l'écran

1. Ouvrir la planche depuis la galerie, puis *Découper ›*.
2. Dans le panneau de droite, choisir **« les gouttières »** — le troisième
   segment. Les quatre rectangles doivent apparaître d'un coup, posés
   exactement sur les quatre carrés colorés, jamais sur les bandes de fond
   entre eux.
3. Comparer avec **« grille fixe »** (2 colonnes, 2 lignes) : au pixel près,
   les mêmes quatre rectangles ici — la feuille est parfaitement régulière —
   mais « les gouttières » les a trouvés sans qu'on lui dise combien de
   colonnes il y avait.
4. Cliquer *Découper en 4 asset·s ›* : quatre images neuves paraissent dans
   la grille.
"""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

import uvicorn
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8495

FOND = (240, 236, 228)
GOUTTIERE = 8
CASE = 96
COULEURS = [(200, 60, 60), (60, 150, 90), (60, 100, 200), (210, 170, 40)]


def _feuille() -> bytes:
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


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-decoupe-"))
    print(f"Dossier jetable de l'atelier : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )

    with TestClient(creer_application(atelier)) as client:
        double.rendre = _feuille
        generation = client.post(
            "/api/generations",
            json={"modele": "essai:rend-du-png", "prompt": "une feuille à quatre cases"},
        ).json()
        asset = client.get(f"/api/assets/{generation['identifiant']}-0").json()

        propose = client.get(
            f"/api/assets/{asset['identifiant']}/slices", params={"mode": "gouttieres"}
        ).json()
        print()
        print(f"  L'asset de démonstration : {asset['identifiant']}")
        print(f"  Proposition « gouttières » à froid : {len(propose['boites'])} rectangles")
        for numero, boite in enumerate(propose["boites"], start=1):
            print(f"    {numero}. {boite}")
        print(f"  Temps mesuré côté serveur : {propose['duree_ms']} ms")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → La galerie, la planche à quatre couleurs, Découper ›")
    print("    · segment « les gouttières » : quatre rectangles, un par carré")
    print("    · comparer avec « grille fixe » (2 × 2) : les mêmes quatre")
    print("  Ctrl-C pour arrêter.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
