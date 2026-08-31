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


# ── La fusion de deux palettes, arrivée en E11 ───────────────────────────────
#
# **Ces trois fonctions viennent du banc d'essai**, où elles ont été mesurées
# avant d'entrer dans le produit — `essais/essai_couleurs_et_taches.py`, le
# 31 août 2026. Le banc a répondu à la question qui bloquait la tranche : les
# deux curseurs ne font-ils pas le même travail ? Croisés sur six images et cinq
# valeurs chacun, ils rendent **21 résultats distincts sur 25 combinaisons**. Et
# il a trouvé le seul endroit où l'attraction meurt : à proportion « tout du
# jeu », il ne reste aucune couleur d'ambiance à tirer.
#
# La mesure d'abord, le code ensuite : c'est la deuxième fois que ce produit
# évite d'écrire un réglage qui ne ferait rien — le nombre de couleurs de la
# quantification, lui, avait été écrit avant d'être mesuré, et il ne changeait
# rien dès qu'une palette était posée.


def _rgb(hexa: str) -> tuple[int, int, int]:
    entier = int(hexa.lstrip("#"), 16)
    return (entier >> 16 & 255, entier >> 8 & 255, entier & 255)


def _hexa(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(float(c))) for c in rgb)


def reduire(palette: tuple[str, ...], combien: int) -> tuple[str, ...]:
    """Les `combien` couleurs de cette palette-là, **prises dans la palette**.

    **Par la coupe médiane, comme le reste du produit** : `palette_de` réduit
    déjà les couleurs d'un artwork de cette façon, et prendre les N premières à
    la place donnerait un résultat qui dépend de l'ordre d'écriture du fichier.

    **Puis chaque seau revient à la couleur réelle la plus proche.** La coupe
    médiane rend des moyennes — le milieu d'un seau —, et une moyenne n'est
    l'une des couleurs d'aucune source : la pastille dirait « venue du jeu » en
    montrant une teinte que le jeu ne porte pas. Le raccrochage tient la promesse
    de la maquette au pied de la lettre : *chaque couleur du résultat est
    authentiquement l'une de celles d'une source*. C'est le seul écart avec le
    banc d'essai, et il ajoute une garantie plutôt qu'il n'en retire.
    """
    if combien <= 0:
        return ()
    if combien >= len(palette):
        return tuple(palette)
    reelles = np.array([_rgb(c) for c in palette], dtype=np.int16)
    bande = np.array([[_rgb(c) for c in palette]], dtype=np.uint8)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=combien, method=Image.Quantize.MEDIANCUT
    )
    plate = indexee.getpalette() or []
    vues: set[str] = set()
    gardees: list[str] = []
    for rang in sorted(set(indexee.tobytes())):
        milieu = np.array(plate[rang * 3 : rang * 3 + 3], dtype=np.int16)
        proche = palette[int(np.argmin(((reelles - milieu) ** 2).sum(axis=1)))]
        if proche not in vues:
            vues.add(proche)
            gardees.append(proche)
    return tuple(gardees)


def attirer(
    ambiance: tuple[str, ...], jeu: tuple[str, ...], part: float
) -> tuple[str, ...]:
    """Chaque couleur de l'ambiance tirée vers la plus proche de celles du jeu.

    `part` va de 0 — rien ne bouge — à 1 — la couleur *devient* celle du jeu.
    C'est ce qui harmonise : le marais reste un marais, mais il respire l'air du
    jeu. La distance est euclidienne dans RGB, comme partout ailleurs ici.
    """
    if not jeu or part <= 0:
        return tuple(ambiance)
    cibles = np.array([_rgb(c) for c in jeu], dtype=np.int16)
    tirees = []
    for couleur in ambiance:
        source = np.array(_rgb(couleur), dtype=np.int16)
        proche = cibles[int(np.argmin(((cibles - source) ** 2).sum(axis=1)))]
        tirees.append(_hexa(source + (proche - source) * part))
    return tuple(tirees)


def fusionner(
    jeu: tuple[str, ...],
    ambiance: tuple[str, ...],
    total: int,
    du_jeu: int,
    attraction: float,
) -> tuple[tuple[str, str], ...]:
    """La palette d'une ambiance : `du_jeu` couleurs du jeu, le reste attiré.

    Rend **chaque couleur avec sa provenance** — `jeu` ou `ambiance` —, parce
    que c'est la seule façon de comprendre ce qu'on regarde : sans ces marques,
    on ne saurait pas si un gris vient du jeu, donc si le changer serait une
    exception ou une redite.

    Le dédoublonnage est la seule liberté prise sur la maquette, et elle est
    forcée : à forte attraction, deux couleurs de l'ambiance tombent sur la même
    couleur du jeu, et une palette qui répète une entrée n'est pas une palette.
    C'est aussi ce qui rend le compte **plus court que demandé** aux fortes
    valeurs — le produit l'affiche plutôt que de le taire.
    """
    proches = attirer(reduire(ambiance, total - du_jeu), jeu, attraction)
    vues: set[str] = set()
    sortie: list[tuple[str, str]] = []
    for couleur, venue in (
        *((c, "jeu") for c in reduire(jeu, du_jeu)),
        *((c, "ambiance") for c in proches),
    ):
        if couleur not in vues:
            vues.add(couleur)
            sortie.append((couleur, venue))
    return tuple(sortie)
