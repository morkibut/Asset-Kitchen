# -*- coding: utf-8 -*-
"""Le même sujet, quantifié **sans que le fond mange la palette**.

## Pourquoi cette planche existe

L'auteur a demandé de ne pas détourer, pour ne juger que la pixelisation. C'était
juste — mais ça fausse le seul autre axe du banc, le nombre de couleurs.

Mesuré sur le pèlerin réduit à 64 carrés : **le fond rose occupe 73 % des pixels
et rafle la majorité de la palette**. À 8 couleurs demandées, 5 partent au fond
et il en reste **3** pour le personnage — d'où la bouillie noire qu'on voit. À 24
demandées, 15 partent au fond et il en reste 9.

**Le produit, lui, ne fait pas cette erreur** : dans `Recette`, le détourage passe
avant la quantification. Le banc « sans détourage » montre donc un pire cas que
l'atelier ne produira jamais. Cette planche rétablit la vérité : elle compte la
palette **sur le sujet seul**, ce que fait le produit.

    py essais/planche_palette_utile.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from essais.essai_pixelisation_complet import (  # noqa: E402
    SOURCES,
    par_vote_en_deux_temps,
)

SORTIE = RACINE / "essais" / "resultats"
COTE = 260
MARGE = 8
PALIERS = (8, 16, 24, 32, 64)

# Le rose du fond, relevé sur un coin des deux images. La distance est large :
# le fond est parfaitement uni, il n'y a aucun risque de mordre sur le sujet.
FOND = np.array([233, 133, 166])
DISTANCE = 90


def _masque_du_sujet(rgb: np.ndarray) -> np.ndarray:
    return np.abs(rgb.astype(int) - FOND).sum(axis=2) >= DISTANCE


def quantifier_le_sujet(rgb: np.ndarray, couleurs: int) -> tuple[np.ndarray, int]:
    """Quantifie en ne comptant **que** les pixels du sujet.

    On extrait les pixels du sujet, on les met bout à bout dans une image d'une
    seule ligne, on quantifie **celle-là** — le fond n'y est pas, il ne peut donc
    revendiquer aucune entrée de palette —, puis on repose les couleurs obtenues
    à leur place. Le fond est ensuite reposé tel quel, en une seule teinte.
    """
    masque = _masque_du_sujet(rgb)
    sujet = rgb[masque]

    ligne = Image.fromarray(sujet.reshape(1, -1, 3))
    reduite = ligne.quantize(
        colors=couleurs,
        method=Image.Quantize.MEDIANCUT,
        kmeans=couleurs,
        dither=Image.Dither.NONE,
    )
    peints = np.asarray(reduite.convert("RGB")).reshape(-1, 3)

    sortie = np.empty_like(rgb)
    sortie[:] = FOND.astype(np.uint8)
    sortie[masque] = peints
    return sortie, len(np.unique(peints, axis=0))


def _agrandi(petit: np.ndarray) -> Image.Image:
    image = Image.fromarray(petit)
    facteur = max(1, COTE // max(image.width, image.height))
    return image.resize(
        (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
    ).resize((COTE, COTE), Image.Resampling.NEAREST)


def planche(fichier: str, nom: str, cible: int = 64) -> Path:
    rgb = np.asarray(Image.open(SOURCES / fichier).convert("RGB"))
    base = par_vote_en_deux_temps(rgb, cible)

    cases = []
    for couleurs in PALIERS:
        peint, reelles = quantifier_le_sujet(base, couleurs)
        cases.append((f"{couleurs} couleurs sur le sujet ({reelles} réelles)", _agrandi(peint)))

    large = len(cases) * COTE + (len(cases) + 1) * MARGE
    haut = COTE + 2 * MARGE + 52
    feuille = Image.new("RGB", (large, haut), (245, 244, 241))
    crayon = ImageDraw.Draw(feuille)
    crayon.text(
        (MARGE, 6),
        f"{nom} — {cible} carres — palette comptee sur le sujet seul, "
        "comme le fait le produit (detourage avant quantification)",
        fill=(30, 28, 25),
    )

    for rang, (etiquette, vignette) in enumerate(cases):
        x = MARGE + rang * (COTE + MARGE)
        feuille.paste(vignette, (x, MARGE + 22))
        crayon.text((x + 2, MARGE + 22 + COTE + 7), etiquette, fill=(40, 38, 34))

    vers = SORTIE / f"planche-palette-utile-{Path(fichier).stem.replace(' ', '-')}-{cible}.png"
    feuille.save(vers)
    return vers


if __name__ == "__main__":
    print(planche("pelerin.png", "Le pelerin", 64))
    print(planche("pelerin.png", "Le pelerin", 32))
    print(planche("garde du moulin.png", "Le garde du moulin", 64))
