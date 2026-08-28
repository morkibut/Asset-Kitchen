# -*- coding: utf-8 -*-
"""Le gabarit d'une planche, et ce qu'on mesure sur ce qui revient.

CPU, pur, aucune entrée-sortie — comme `decoupe.py`, dont ce module est le
compagnon : celui-là dit **où** couper, celui-ci dit **quoi demander** et **ce
que vaut** ce qu'on a reçu. La géométrie, elle, vit dans
`atelier/domaine/pliage.py`, parce que la génération l'enregistre.

**Rien ici ne refuse.** Le compte d'images est le seul refus automatique du
produit, et il est arithmétique : il se prend dans le service, sur la longueur
d'une liste de boîtes. Les mesures de ce module informent, case par case, et
n'empêchent jamais de garder (`docs/PLAN.md`, C2).
"""

from __future__ import annotations

import io
import itertools

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.pliage import Geometrie, MesuresLot
from atelier.image.decoupe import Boite
from atelier.image.traitement import mesurer_grille

__all__ = ["COTE", "gabarit", "mesurer_lot"]


# Le côté du gabarit, en pixels. 1024 — le format sur lequel l'essai du 28 août
# a mesuré le compte exact 11 fois sur 12, et la résolution à laquelle le
# produit génère : **on ne génère jamais petit** (`docs/PIEGES.md`), donc le
# gabarit n'a aucune raison de l'être non plus.
COTE = 1024

# **Le trait est à peine plus foncé que le fond, et c'est délibéré.** Le gabarit
# doit dire « voici les emplacements » sans dire « voici un dessin à
# reproduire » : `docs/ARCHITECTURE.md` §4 bis a relevé des modèles qui
# *recopient* leur référence au lieu de s'en inspirer, et un cadre noir épais
# reviendrait tel quel dans la sortie. Le fond est celui que les modèles rendent
# réellement — gris clair, relevé sur dix-sept images le 27 août.
FOND = (235, 235, 235)
TRAIT = (198, 198, 198)

MARGE = 40
GOUTTIERE = 24
EPAISSEUR = 3

# Le côté du carré dans lequel deux silhouettes se comparent. L'étirement est ce
# qui rend la comparaison possible : deux poses n'ont pas la même boîte, et les
# comparer dans leurs boîtes respectives mesurerait surtout la différence de
# cadrage.
COTE_SILHOUETTE = 64

# Au-dessus, un pixel appartient au sujet. Le même seuil que le durcissement
# d'alpha du post-traitement — un contour à demi transparent est tranché une
# fois pour toutes, et deux lectures de la même image rendent la même
# silhouette (`docs/PIEGES.md`).
OPACITE = 128


def gabarit(forme: Geometrie) -> bytes:
    """Des cases vides, dessinées d'un trait clair sur le fond du produit.

    **Exactement `forme.cases` cases**, pas `colonnes × lignes` : la dernière
    rangée est incomplète quand le compte ne tombe pas juste, et une case vide
    de plus serait une case que le modèle remplirait — le compte tomberait faux
    pour une raison que personne n'aurait demandée, et le lot entier serait
    refusé.

    L'image part **en référence**, et elle occupe donc une place dans le plafond
    du modèle ; chez ceux qui facturent au token, elle coûte (`docs/PIEGES.md` —
    $0,0064 sans référence, $0,0124 avec une). C'est écrit à l'écran, dans la
    liste de ce qui part, comme n'importe quelle autre référence.
    """
    image = Image.new("RGB", (COTE, COTE), FOND)
    dessin = ImageDraw.Draw(image)
    large = (COTE - 2 * MARGE - GOUTTIERE * (forme.colonnes - 1)) // forme.colonnes
    haut = (COTE - 2 * MARGE - GOUTTIERE * (forme.lignes - 1)) // forme.lignes
    for index in range(forme.cases):
        colonne, ligne = index % forme.colonnes, index // forme.colonnes
        x0 = MARGE + colonne * (large + GOUTTIERE)
        y0 = MARGE + ligne * (haut + GOUTTIERE)
        dessin.rectangle([x0, y0, x0 + large, y0 + haut], outline=TRAIT, width=EPAISSEUR)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def mesurer_lot(rgba: np.ndarray, boites: list[Boite]) -> list[MesuresLot]:
    """Ce que chaque case a à dire d'elle-même — ressemblance et grille.

    Reçoit la planche **détourée**, comme `zones_opaques` reçoit son alpha : la
    silhouette d'un sujet n'existe qu'une fois le fond retiré, et détourer deux
    fois la même image pour deux mesures serait deux fois le même calcul.

    Deux nombres par case, et pas un de plus :

    - **la ressemblance** — le plus fort recouvrement de silhouette entre cette
      case et une autre du lot, et laquelle. C'est le piège mesuré le 28 août :
      deux planches sur vingt-quatre avaient le compte juste et répétaient une
      pose. Le contrat était tenu, la planche sans valeur ;
    - **la grille** — le pas de pixel sur lequel le modèle a peint cette
      case-là, et la dérive du lot, qui est le rapport du plus grand au plus
      petit. La mesure situe un ordre de grandeur et **ne remplace pas l'œil**
      (`mesurer_grille`) ; c'est une raison de plus pour qu'elle ne refuse rien.
    """
    if not boites:
        return []

    crops = [rgba[y0 : y1 + 1, x0 : x1 + 1] for x0, y0, x1, y1 in boites]
    silhouettes = [_silhouette(c) for c in crops]

    # La plus forte ressemblance de chaque case, et avec qui. Symétrique par
    # construction : on remplit les deux bouts de chaque paire, donc deux cases
    # jumelles se désignent l'une l'autre — sans quoi la seconde dirait « je ne
    # ressemble à personne » alors que la première vient de la nommer.
    fortes = [0.0] * len(crops)
    jumeaux = [-1] * len(crops)
    for i, j in itertools.combinations(range(len(crops)), 2):
        valeur = _recouvrement(silhouettes[i], silhouettes[j])
        if valeur > fortes[i]:
            fortes[i], jumeaux[i] = valeur, j
        if valeur > fortes[j]:
            fortes[j], jumeaux[j] = valeur, i

    pas = [mesurer_grille(_png(c)) for c in crops]
    mesures = [p for p, nettete in pas if nettete > 0 and p > 0]
    derive = round(max(mesures) / min(mesures), 2) if mesures else 1.0

    return [
        MesuresLot(
            case=index,
            cases=len(crops),
            grille_px=pas[index][0],
            ressemblance=round(fortes[index], 4),
            jumeau=jumeaux[index],
            derive=derive,
        )
        for index in range(len(crops))
    ]


# ── Le dedans ────────────────────────────────────────────────────────────────


def _silhouette(crop: np.ndarray) -> np.ndarray:
    masque = Image.fromarray(
        (crop[:, :, 3] >= OPACITE).astype(np.uint8) * 255, "L"
    )
    etiree = masque.resize((COTE_SILHOUETTE, COTE_SILHOUETTE), Image.Resampling.BILINEAR)
    return np.asarray(etiree) >= OPACITE


def _recouvrement(un: np.ndarray, autre: np.ndarray) -> float:
    """L'intersection sur l'union. Deux silhouettes vides se ressemblent
    entièrement — c'est vrai, et ça ne se produit pas : une case sans pixel
    opaque n'aurait pas été trouvée par la détection."""
    union = int((un | autre).sum())
    return int((un & autre).sum()) / union if union else 1.0


def _png(crop: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(crop, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()
