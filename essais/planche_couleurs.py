# -*- coding: utf-8 -*-
"""Deux planches tirées du banc complet, pour juger d'un seul coup d'oeil.

La page du banc complet porte 192 vignettes : parfaite pour fouiller, illisible
pour trancher. Ce script en extrait les deux comparaisons qui décident :

1. **Une méthode, tous les paliers de couleurs** — « combien de couleurs ? » ;
2. **Toutes les méthodes, un seul palier** — « la méthode change-t-elle de
   classement une fois que tout est quantifié pareil ? »

Il ne recalcule rien : il assemble les PNG déjà écrits par le banc.

    py essais/planche_couleurs.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

VIGNETTES = RACINE / "essais" / "resultats" / "pixelisation"
SORTIE = RACINE / "essais" / "resultats"

COTE = 260
MARGE = 8
BANDEAU = 30


def _assembler(chemins: list[tuple[str, Path]], titre: str, vers: Path) -> Path:
    large = len(chemins) * COTE + (len(chemins) + 1) * MARGE
    haut = COTE + 2 * MARGE + BANDEAU + 22
    feuille = Image.new("RGB", (large, haut), (245, 244, 241))
    crayon = ImageDraw.Draw(feuille)
    crayon.text((MARGE, 6), titre, fill=(30, 28, 25))

    for rang, (etiquette, chemin) in enumerate(chemins):
        vignette = Image.open(chemin).convert("RGB").resize(
            (COTE, COTE), Image.Resampling.NEAREST
        )
        x = MARGE + rang * (COTE + MARGE)
        feuille.paste(vignette, (x, MARGE + 22))
        crayon.text((x + 2, MARGE + 22 + COTE + 7), etiquette, fill=(40, 38, 34))

    feuille.save(vers)
    return vers


def planche_couleurs(court: str, cible: int, methode: str, nom: str) -> Path:
    paliers = ["toutes", "64", "32", "24", "16", "8"]
    chemins = [
        (
            f"{p} couleurs" + ("   <- l'atelier aujourd'hui" if p == "toutes" else ""),
            VIGNETTES / f"{court}-{cible}-{methode}-{p}.png",
        )
        for p in paliers
    ]
    return _assembler(
        chemins,
        f"{nom} — {cible} carrés — les six paliers de couleurs",
        SORTIE / f"planche-couleurs-{court}-{cible}.png",
    )


def planche_methodes(court: str, cible: int, palier: str) -> Path:
    methodes = [
        ("Aujourd'hui (l'atelier)", "aujourdhui"),
        ("Lanczos", "lanczos"),
        ("Vote en deux temps", "vote"),
        ("PixelOE", "pixeloe"),
    ]
    chemins = [
        (etiquette, VIGNETTES / f"{court}-{cible}-{cle}-{palier}.png")
        for etiquette, cle in methodes
    ]
    return _assembler(
        chemins,
        f"Les quatre méthodes — {cible} carrés — toutes ramenées à {palier} couleurs",
        SORTIE / f"planche-methodes-{court}-{cible}-{palier}.png",
    )


if __name__ == "__main__":
    print(planche_couleurs("pelerin", 64, "vote", "Le pèlerin, vote en deux temps"))
    print(planche_couleurs("garde-du-moulin", 64, "vote", "Le garde, vote en deux temps"))
    print(planche_methodes("pelerin", 64, "24"))
    print(planche_couleurs("pelerin", 32, "vote", "Le pèlerin, vote en deux temps"))
