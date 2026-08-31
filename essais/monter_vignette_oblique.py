# -*- coding: utf-8 -*-
"""Monte la vignette de la vue oblique à partir de celle de la vue de face.

**Cette vue-là ne se génère pas, elle se construit.** Son contrat dit que le corps
doit être *identique* à celui de la vue de face — c'est même son contrôle final —
et que toute la différence tient dans une dalle : un parallélogramme dont la
profondeur file vers le haut-gauche à 45°, sans rétrécir. Un modèle d'image n'a
presque aucun exemple de personnage dessiné en projection cavalière et rend une
vue de face avec un sol en fuite ; quatre segments droits, eux, sont exacts du
premier coup et ne coûtent rien.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

VIGNETTES = Path(__file__).resolve().parents[1] / "interface" / "public" / "vignettes"

# Le côté du pixel dessiné, en pixels du fichier. La dalle est tracée à cette
# maille puis agrandie sans lissage : sans ça, ses bords à 45° seraient une
# diagonale lisse au milieu d'un dessin en marches d'escalier.
PAS = 8


def sans_le_sol(chemin: Path) -> tuple[Image.Image, tuple[int, int, int]]:
    """La vue de face débarrassée de sa bande de sol, et la couleur de ce sol.

    La bande vue de face est un trait sous les bottes ; ici elle est remplacée
    par la dalle penchée, donc elle part. Sa couleur, elle, reste : la famille
    doit garder un seul sol.
    """
    im = Image.open(chemin).convert("RGBA")
    a = np.array(im)
    opaque = a[..., 3] > 128
    lignes = np.flatnonzero(opaque.any(axis=1))

    # La bande occupe les dernières lignes et s'étend bien plus large que les
    # bottes : on la repère à ça, pas à sa couleur, qui est celle du cuir.
    largeurs = opaque.sum(axis=1)
    bas = lignes[-1]
    haut = bas
    while haut > lignes[0] and largeurs[haut - 1] > largeurs[: bas - 40].max() * 0.9:
        haut -= 1

    couleur = tuple(int(v) for v in np.median(a[bas - 2, opaque[bas - 2], :3], axis=0))
    a[haut : bas + 1, :, 3] = 0
    return Image.fromarray(a), couleur


def monte(chemin_face: Path, sortie: Path) -> None:
    face, sol = sans_le_sol(chemin_face)
    boite = face.getbbox()
    perso = face.crop(boite)
    largeur, hauteur = perso.size

    # Le côté de la dalle. Un peu moins large que le personnage, cape comprise :
    # une dalle plus large que celui qui la foule se lit comme une estrade.
    cote = int(largeur * 0.88)
    # La profondeur file à 45° — autant vers la gauche que vers le haut, c'est
    # ça qui donne l'angle — mais elle est dessinée à **la moitié** de la
    # largeur. C'est le choix que font Ultima et EarthBound, et il n'est pas
    # cosmétique : à pleine longueur, essayé d'abord, la dalle monte au tiers de
    # la hauteur du personnage et se lit comme une rampe derrière lui. Ce qui
    # doit se voir, c'est que la profondeur penche et ne rétrécit pas ; ni l'un
    # ni l'autre ne dépend de sa longueur.
    profondeur = int(cote * 0.45)

    # **Les bottes se posent au centre de la dalle, pas sur son coin.** Sinon le
    # sol ne s'étend que d'un côté et se lit comme une ombre portée — vérifié en
    # le dessinant d'abord de l'autre façon.
    pieds = (largeur // 2, hauteur)
    coins = [
        (pieds[0] - cote // 2 + profondeur // 2, pieds[1] + profondeur // 2),  # devant gauche
        (pieds[0] + cote // 2 + profondeur // 2, pieds[1] + profondeur // 2),  # devant droit
        (pieds[0] + cote // 2 - profondeur // 2, pieds[1] - profondeur // 2),  # fond droit
        (pieds[0] - cote // 2 - profondeur // 2, pieds[1] - profondeur // 2),  # fond gauche
    ]

    gauche = min(0, min(x for x, _ in coins))
    droite = max(largeur, max(x for x, _ in coins))
    haut = min(0, min(y for _, y in coins))
    bas = max(hauteur, max(y for _, y in coins))
    marge = int(max(droite - gauche, bas - haut) * 0.07)
    ox, oy = -gauche + marge, -haut + marge
    W, H = droite - gauche + 2 * marge, bas - haut + 2 * marge

    # ── La dalle, tracée à la maille du dessin ──────────────────────────────
    petit = Image.new("RGBA", (W // PAS + 2, H // PAS + 2), (0, 0, 0, 0))
    ImageDraw.Draw(petit).polygon(
        [(round((x + ox) / PAS), round((y + oy) / PAS)) for x, y in coins],
        fill=sol + (255,),
    )
    dalle = petit.resize((petit.width * PAS, petit.height * PAS), Image.NEAREST).crop((0, 0, W, H))

    plan = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    plan.alpha_composite(dalle)
    plan.alpha_composite(perso, (ox, oy))
    plan.crop(plan.getbbox()).save(sortie)

    devant = coins[1][0] - coins[0][0]
    fond = coins[2][0] - coins[3][0]
    print(f"personnage {largeur}x{hauteur} — dalle de {cote} de côté, profonde de {profondeur}")
    print(f"arête de devant {devant} px, arête du fond {fond} px : {'égales' if devant == fond else 'INÉGALES'}")
    print(f"écrit : {sortie}  {Image.open(sortie).size}")


if __name__ == "__main__":
    import sys

    # Sans argument, il écrit la vignette à sa place. **Avec un argument, il
    # écrit ailleurs** : c'est ce qu'on veut pour la regarder avant de la poser.
    sortie = Path(sys.argv[1]) if len(sys.argv) > 1 else VIGNETTES / "vue-oblique.png"
    monte(VIGNETTES / "vue-face-fixe.png", sortie)
