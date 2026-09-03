# -*- coding: utf-8 -*-
"""Les deux vignettes du choix de style — pixel art et dessin, même sujet.

## Pourquoi elles existent

L'étape 2 des réglages demande *comment ton jeu est-il dessiné ?*, et l'auteur a
tranché la forme : *« on propose le choix du style de jeu ici et on met une image
cliquable pour chaque style qui permet de faire le choix »*. Un mot ne montre
rien ; deux images côte à côte montrent tout.

## La règle que ce script respecte

`docs/vignettes-vues.md` la pose pour les dix-sept vignettes déjà là : **même
sujet, même palette, même cadrage — seule la question posée change d'une image à
l'autre**. Sans quoi on ne compare plus le style, on compare deux dessins.

D'où le choix de partir de **la même image** pour les deux, et de ne lui
appliquer que ce que le produit ferait dans chacun des deux modes :

- **pixel art** : détourage, recadrage, réduction à 64 carrés par le vote en deux
  temps, palette de 24 couleurs, puis agrandissement au plus proche pour
  l'affichage — exactement la chaîne d'un projet en pixel art ;
- **dessin** : détourage, recadrage, réduction douce à 256 — la chaîne d'un
  projet en dessin, où les couleurs ne sont pas touchées.

**Il ne coûte rien** : tout se calcule sur le processeur, aucun appel ne sort.

    py essais/vignettes_de_style.py

Sortie : `interface/public/vignettes/style-pixel.png` et `style-dessin.png`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from atelier.domaine.recette import (  # noqa: E402
    BAS,
    BORD,
    VOTE,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)
from atelier.image.traitement import appliquer  # noqa: E402

SOURCE = RACINE / "essais" / "sources" / "pelerin.png"
VIGNETTES = RACINE / "interface" / "public" / "vignettes"
COTE = 256  # la taille des autres vignettes de l'assistant


def _recette(cible: int, methode: str, couleurs: int | None) -> Recette:
    """La recette d'un des deux modes, telle que le produit la fabriquerait.

    Le détourage par le bord suffit et ne demande rien : le fond est un rose uni
    que rien dans le sujet ne porte — c'est le cas facile pour lequel ce moteur
    a été choisi comme défaut du produit.
    """
    return Recette(
        # **Un pixel rongé, et il se voit quand on l'oublie** : le fond rose
        # laisse une frange d'un pixel autour de la cape, que la réduction
        # étale ensuite en points roses sur le contour du sprite.
        passes=(Passe(moteur=BORD, tolerance=40, durcissement=1),),
        recadrage=Recadrage(),
        grille=Grille(cible=cible, occupation=100, ancrage=BAS, methode=methode),
        quantification=(
            Quantification(couleurs=couleurs) if couleurs is not None else None
        ),
    )


def _au_format(octets: bytes, mode: str) -> Image.Image:
    """L'image ramenée à la toile carrée des autres vignettes.

    **Agrandie au plus proche en pixel art, jamais lissée** : c'est ainsi qu'un
    moteur de jeu l'affichera, et lisser montrerait une image qui n'existe pas.
    En dessin, la réduction douce a déjà fait le travail et il n'y a rien à
    agrandir.
    """
    import io

    image = Image.open(io.BytesIO(octets)).convert("RGBA")
    if mode == "pixel":
        facteur = max(1, COTE // max(image.width, image.height))
        image = image.resize(
            (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
        )
    toile = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
    toile.paste(image, ((COTE - image.width) // 2, COTE - image.height))
    return toile


def principal() -> int:
    if not SOURCE.exists():
        print(f"  manque : {SOURCE}")
        return 1
    octets = SOURCE.read_bytes()

    epreuves = (
        ("style-pixel", _recette(64, VOTE, 24), "pixel"),
        ("style-dessin", _recette(COTE, "lanczos", None), "dessin"),
    )
    for nom, recette, mode in epreuves:
        rendu = appliquer(recette, octets)
        image = _au_format(rendu.octets, mode)
        chemin = VIGNETTES / f"{nom}.png"
        image.save(chemin)
        couleurs = len(np.unique(np.asarray(image).reshape(-1, 4), axis=0))
        print(f"  {chemin.name} — {image.width}×{image.height}, {couleurs} couleurs")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
