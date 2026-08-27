# -*- coding: utf-8 -*-
"""D'où vient la palette d'un univers — CPU, pure, aucune entrée-sortie.

« La palette se déduit par calcul des artworks officiels » (`docs/PLAN.md`, T4).
Ce module est ce calcul, et rien d'autre : il reçoit des octets d'images, il rend
des couleurs en hexadécimal. Il ne lit aucun fichier, n'appelle aucun modèle, et
ne touche jamais le réseau — c'est ce qui fait que « retirer un artwork officiel
recalcule la palette » marche réseau coupé.

**La coupe médiane, comme pour la quantification, et pour la même raison.**
« Chaque étape est déterministe, et c'est un critère » (`AGENTS.md`) : une
initialisation tirée au sort donnerait deux palettes différentes pour les mêmes
artworks, donc deux rendus différents pour la même recette. La coupe médiane de
Pillow ne tire rien au sort. Vérifié : deux appels rendent la même palette, et
l'ordre des artworks ne la change pas.

**Le fond ne fait pas partie de la palette, et ça s'est mesuré.** Premier essai,
sur les deux planches de `essais/guide/` : la coupe médiane appliquée aux images
telles quelles a rendu **vingt gris sur vingt-quatre** — `#e0e0e0`, `#e1e1e1`,
`#dedede`… Le fond plat occupe 75 % des pixels, son anti-crénelage l'éclate en
autant de seaux, et la palette ne disait plus rien du sujet. C'est le même piège
qu'un détourage au seuil global : *ce qui est majoritaire n'est pas ce qui
compte*.

**On détoure donc d'abord, avec le moteur du geste courant.** Le remplissage
depuis le bord — celui qui ne charge aucun modèle et marche hors ligne — retire
le fond relié au bord, et la palette se calcule sur ce qui reste. Mesuré sur les
mêmes deux planches : 24 % des pixels survivent, et la palette passe de 7 à 15
couleurs franchement distinctes, toutes prises dans le sujet. Corollaire hérité,
et assumé : **une région fermée reste opaque**, donc l'intérieur d'un cadre
d'interface entre dans la palette. C'est la même règle qui sauve le squelette.

**Chaque artwork pèse le même poids.** Une planche de 2048 px et une vignette de
256 px ramenées à la même vue : sans ça, la plus grande écrirait la palette à
elle seule, et promouvoir une seconde carte ne changerait rien de visible — or
« retirer un artwork officiel recalcule la palette, et le changement se voit »
est un critère.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from atelier.image.traitement import detourer_bord, durcir
from atelier.domaine.recette import SEUIL_ALPHA

# Le côté auquel chaque artwork est ramené avant d'entrer dans le calcul.
# 192 px : assez pour que les aplats d'un sprite pèsent leur vraie part, assez
# petit pour que dix artworks se calculent en moins d'une seconde. Ramener au
# **même** côté est ce qui donne à chaque artwork le même poids.
VUE = 192

# La tolérance du détourage préalable. Celle de `Passe` par défaut : c'est le
# même geste, et un second réglage ici serait un second endroit où la même
# question se répond.
TOLERANCE = 28

# Combien de couleurs une palette d'univers porte par défaut. Mesuré le
# 27 août 2026 sur les deux planches du guide : 24 demandées rendent 15 couleurs
# franchement distinctes, 32 en rendent 18, 48 n'en rendent que 22 — la coupe
# médiane sature. En dessous de 16 le vocabulaire s'appauvrit visiblement. 24
# est le point où l'on paie encore chaque couleur qu'on demande.
COULEURS = 24
COULEURS_MIN = 4
COULEURS_MAX = 64


def _vue(rgba: np.ndarray, cote: int = VUE) -> np.ndarray:
    """L'artwork ramené à une vue de `cote` au plus grand côté.

    `BOX` et non `NEAREST` : ici on ne fabrique pas un sprite, on échantillonne
    une matière. Moyenner sur la surface rend la part réelle de chaque teinte ;
    prendre le plus proche voisin en perdrait une sur deux.
    """
    image = Image.fromarray(rgba, mode="RGBA")
    facteur = cote / max(image.width, image.height)
    if facteur >= 1:
        return rgba
    taille = (max(1, round(image.width * facteur)), max(1, round(image.height * facteur)))
    return np.asarray(image.resize(taille, Image.Resampling.BOX))


def _sujet(octets: bytes) -> np.ndarray:
    """Les pixels opaques d'un artwork, une fois son fond retiré.

    Le détourage n'est pas conservé : c'est une lecture, pas une retouche.
    L'artwork sur le disque n'est jamais modifié — le tableau d'inspiration ne
    traite rien, il rassemble.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()

    neuf = detourer_bord(rgba[:, :, :3], TOLERANCE)
    alpha = durcir(np.minimum(rgba[:, :, 3], neuf), SEUIL_ALPHA)
    rgba[:, :, 3] = alpha

    vue = _vue(rgba).reshape(-1, 4)
    opaques = vue[vue[:, 3] >= SEUIL_ALPHA][:, :3]
    # Un artwork que le détourage a entièrement mangé — une matière plein cadre,
    # une texture sans bord franc — compte quand même : il vaut mieux sa palette
    # entière que rien du tout.
    return opaques if opaques.size else vue[:, :3]


def palette_de(artworks: list[bytes], couleurs: int = COULEURS) -> tuple[str, ...]:
    """La palette de ces artworks-là. Déterministe, et sans un octet de réseau.

    Rend des couleurs en hexadécimal minuscule — la forme que `Quantification`
    attend, et celle qu'un humain relit dans `projet.json`.

    Aucun artwork ne rend une palette vide, et c'est **l'état réel** : « un
    univers vide ne contraint rien » (US-57). C'est ce vide-là que
    `raison_quantification()` transforme en grisé.
    """
    if not artworks:
        return ()

    morceaux = [pixels for pixels in map(_sujet, artworks) if pixels.size]
    if not morceaux:
        return ()

    # Une bande d'une seule ligne : la coupe médiane ne regarde que des
    # couleurs, jamais la géométrie. Empiler en hauteur ne changerait rien au
    # résultat et coûterait un remplissage.
    bande = np.concatenate(morceaux).reshape(1, -1, 3)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=max(COULEURS_MIN, min(COULEURS_MAX, couleurs)),
        method=Image.Quantize.MEDIANCUT,
    )

    # `getpalette()` rend toujours 256 entrées ; seules celles qu'un pixel
    # utilise vraiment sont des couleurs. Publier les autres remplirait la
    # palette de noirs que personne n'a demandés.
    plate = indexee.getpalette() or []
    utilisees = sorted(set(indexee.tobytes()))
    return tuple(
        "#%02x%02x%02x" % tuple(plate[rang * 3 : rang * 3 + 3]) for rang in utilisees
    )
