# -*- coding: utf-8 -*-
"""Une planche de comparaison, pour juger à l'oeil sans passer par le navigateur.

La page HTML du banc est trop lourde pour être capturée d'un coup (36 grandes
images). Ce script fabrique une seule image PNG par taille, avec les six
méthodes côte à côte et leur nom écrit dessous — regardable d'un seul coup.

    py essais/planche_pixelisation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from essais.essai_pixelisation import METHODES, SOURCES  # noqa: E402

SORTIE = RACINE / "essais" / "resultats"
COTE = 300  # la taille de chaque vignette, une fois agrandie au plus proche
MARGE = 10
BANDEAU = 26


def _agrandi(petit: np.ndarray) -> Image.Image:
    image = Image.fromarray(petit)
    facteur = max(1, COTE // max(image.width, image.height))
    return image.resize(
        (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
    ).resize((COTE, COTE), Image.Resampling.NEAREST)


def planche(fichier: str, cible: int) -> Path:
    rgb = np.asarray(Image.open(SOURCES / fichier).convert("RGB"))
    vignettes = [(nom, _agrandi(methode(rgb, cible))) for nom, _, methode in METHODES]

    large = len(vignettes) * COTE + (len(vignettes) + 1) * MARGE
    haut = COTE + 2 * MARGE + BANDEAU
    feuille = Image.new("RGB", (large, haut), (245, 244, 241))
    crayon = ImageDraw.Draw(feuille)

    for rang, (nom, vignette) in enumerate(vignettes):
        x = MARGE + rang * (COTE + MARGE)
        feuille.paste(vignette, (x, MARGE))
        crayon.text((x + 2, MARGE + COTE + 6), f"{rang + 1}. {nom}", fill=(40, 38, 34))

    chemin = SORTIE / f"planche-{Path(fichier).stem.replace(' ', '-')}-{cible}.png"
    feuille.save(chemin)
    return chemin


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    for fichier in ("pelerin.png", "garde du moulin.png"):
        for cible in (64, 128):
            print(planche(fichier, cible))
