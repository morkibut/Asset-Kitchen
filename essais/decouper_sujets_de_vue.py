# -*- coding: utf-8 -*-
"""Découpe le rôdeur des huit vignettes de vue, pour la scène de RV18.

**Ce que les huit `vue-*.png` de `interface/public/vignettes/` portent déjà** :
un rôdeur sur fond transparent, chacun sur sa propre toile, de taille et de
marge différentes — la plus petite fait 438x495, la plus grande 1154x1763, et
`vue-dessus-stricte` est restée à sa toile brute de 1024x1024. Rien à détourer
au sens propre : le fond gris que `docs/archive/vignettes-vues.md` décrit a
déjà été retiré une fois, à la génération.

**Ce que « Sa vue » (RV18) a besoin en plus** : un sujet à la marge serrée et
comparable d'une vue à l'autre, pour le poser sur un petit décor construit par
l'écran (`interface/src/composants/SceneDeVue.tsx`) sans qu'une grande marge
transparente d'un côté ne le décale du sol dessiné en dessous.

**Le détourage CPU du dépôt, pas un nouveau calcul.** `boite_opaque`
(`atelier/image/traitement.py`) est la même fonction qu'utilise le contrôle
d'arrivée d'un détourage — elle lit la boîte du sujet sur son alpha. Aucun
modèle, aucun fournisseur : de la lecture de pixels et un recadrage.

Se relance à la main quand une vignette de vue change :

    <py> essais/decouper_sujets_de_vue.py

Écrit les huit `interface/public/vignettes/<identifiant>-sujet.png`, commités
comme les vignettes elles-mêmes — ce ne sont pas des fichiers de `donnees/`.
"""

from __future__ import annotations

import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

import numpy as np
from PIL import Image

from atelier.domaine.vue import VUES
from atelier.image.traitement import boite_opaque

VIGNETTES = RACINE / "interface" / "public" / "vignettes"

# La marge laissée autour du sujet, en fraction du plus grand côté de sa
# boîte — assez pour qu'un contour ne touche jamais le bord de son propre
# fichier, sans quoi la scène ne pourrait plus l'ombrer ni le faire pivoter
# sans qu'un coin ne soit coupé net.
MARGE = 0.06


def sujet_seul(chemin: Path) -> Image.Image:
    """Le rôdeur de cette vignette, recadré à sa boîte plus une marge."""
    im = Image.open(chemin).convert("RGBA")
    a = np.array(im)
    boite = boite_opaque(a[..., 3] > 16)
    if boite is None:
        raise ValueError(f"{chemin.name} : rien d'opaque, la vignette est-elle bonne ?")
    x0, y0, x1, y1 = boite
    cote = max(x1 - x0, y1 - y0)
    marge = round(cote * MARGE)
    gauche = max(0, x0 - marge)
    haut = max(0, y0 - marge)
    droite = min(im.width, x1 + 1 + marge)
    bas = min(im.height, y1 + 1 + marge)
    return im.crop((gauche, haut, droite, bas))


def main() -> None:
    for v in VUES:
        source = VIGNETTES / f"{v.identifiant}.png"
        if not source.exists():
            print(f"— {v.identifiant} : pas de vignette source, ignorée")
            continue
        decoupe = sujet_seul(source)
        cible = VIGNETTES / f"{v.identifiant}-sujet.png"
        decoupe.save(cible)
        print(f"{v.identifiant}-sujet.png : {decoupe.width}x{decoupe.height}")


if __name__ == "__main__":
    main()
