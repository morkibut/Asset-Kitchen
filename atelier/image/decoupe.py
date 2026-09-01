# -*- coding: utf-8 -*-
"""Où couper une planche multi-sprites — CPU, pur, aucune entrée-sortie.

Ce module **trouve des rectangles**, il ne fabrique aucun asset : il reçoit un
alpha ou des dimensions, il rend des boîtes. Ce qu'on en fait — écrire huit
images, leur donner un parent, les ranger — appartient au service. La séparation
est la même que pour `palette.py` : un calcul pur se mesure au banc et se rejoue
à l'identique, une écriture sur disque non.

**La détection lit un alpha, donc elle détoure d'abord.** Une planche telle
qu'elle arrive du modèle est opaque de bord à bord : ses zones connexes sont une
seule zone, celle de l'image entière. Le service détoure donc avec le moteur du
geste courant avant d'appeler ici — même règle, et pour la même raison, que
l'extraction de palette : *ce qui est majoritaire n'est pas ce qui compte*.

**Deux modes, et ils ne se ressemblent pas.** Les zones opaques trouvent des
sprites posés n'importe où sur un fond ; la grille fixe découpe une planche
régulière que la détection ne saurait pas séparer — sprites qui se touchent,
cases vides à conserver. Le second n'est pas un repli du premier : il répond à
une planche d'une autre nature, et c'est l'auteur qui sait laquelle il a
(US-73).

**Rien ici ne bloque.** Une détection qui rend une seule boîte, ou aucune, est un
résultat, pas une panne : l'auteur corrige à la main. Ce module ne lève jamais
sur le contenu d'une image.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from atelier.image.traitement import composantes

__all__ = [
    "COTE_MIN",
    "ECART",
    "EPAISSEUR_MIN",
    "MARGE",
    "Boite",
    "decouper",
    "en_ordre_de_lecture",
    "grille_fixe",
    "zones_opaques",
]

# Une boîte est inclusive aux deux bouts — `(x0, y0, x1, y1)`, exactement la
# forme de `Recadrage.boite`, et `_recadrer` la lit avec `[y0:y1+1, x0:x1+1]`.
# Une seule convention de rectangle dans tout le dépôt : deux — l'une inclusive,
# l'autre exclusive — se confondraient un jour sur un pixel de bord.
Boite = tuple[int, int, int, int]

# En dessous de ce côté, une tache n'est pas un sprite. Exprimé en **côté** et
# non en aire parce que c'est ce que l'auteur voit sur l'image : « ignore ce qui
# fait moins de seize pixels ». La comparaison, elle, se fait sur l'aire — une
# lance de 4 × 200 pixels a un petit côté minuscule et reste un sujet.
COTE_MIN = 16

# **Un sujet a deux dimensions.** En dessous, une boîte est une ligne : une
# rangée de pixels sur toute la largeur d'une image, ce que laissent un bord
# rogné, une bande de compression, un liseré de cadre. L'aire ne les attrape pas
# — une ligne de 1024 × 1 pèse 1024, largement au-dessus de `COTE_MIN²` — et
# c'est exactement ce qui s'est passé sur la planche de quatre nains de ce dépôt
# : sa première rangée est sombre là où le fond est gris clair, donc le
# détourage la garde, à juste titre, et la détection proposait un cinquième
# rectangle de 1024 × 1 par-dessus les quatre nains.
#
# **Deux, et pas quatre** : `COTE_MIN` dit en toutes lettres qu'une lance de
# 4 × 200 reste un sujet. Ce plancher-ci ne juge pas de la finesse, il écarte ce
# qui n'a pas d'épaisseur du tout.
EPAISSEUR_MIN = 2

# Deux boîtes séparées par moins que ça sont le même sprite. Un arc détaché du
# corps, un chapeau que l'anti-crénelage a coupé : ce sont des morceaux, pas des
# sujets. Deux pixels — assez pour recoller ce que le seuil alpha a séparé,
# beaucoup trop peu pour réunir deux sprites d'une planche, qui sont espacés de
# dizaines de pixels. Un écart réglable serait un troisième réglage pour une
# question que personne ne se pose.
ECART = 2

# Ce qu'on prend de fond autour d'une découpe. **Ce n'est pas du confort : c'est
# ce qui rend la découpe détourable.** Le détourage par défaut lit la couleur du
# fond sur la bordure de l'image (`_couleur_du_bord`) ; une découpe collée au
# pixel près sur la silhouette n'aurait sur sa bordure que du sujet, et le
# remplissage depuis le bord mangerait le sprite au lieu du fond.
MARGE = 4


# ── Les zones opaques ────────────────────────────────────────────────────────


def zones_opaques(alpha: np.ndarray, *, cote_min: int = COTE_MIN) -> list[Boite]:
    """Les boîtes des taches opaques, dans l'ordre où l'œil les lit.

    Trois règles, dans cet ordre, et chacune répare ce que la précédente laisse :

    1. **une tache connexe est un morceau** — le même remplissage par plages que
       le nettoyage des bords, donc la même réponse sur la même image ;
    2. **deux morceaux qui se touchent sont un sujet** — les boîtes qui se
       chevauchent, ou qui passent à moins de `ECART`, fusionnent. C'est ce qui
       recolle un arc au corps qui le tient ;
    3. **un sujet trop petit n'en est pas un** — en dessous de `cote_min²` d'aire,
       c'est un éclat de fond qui a survécu au seuil ; et en dessous de
       `EPAISSEUR_MIN` d'épaisseur, c'est une ligne et pas une forme, quelle que
       soit sa longueur.

    La fusion vient **avant** le rejet, jamais après : deux morceaux de 12 px
    d'un même sprite valent 24 px une fois réunis, et les rejeter d'abord les
    perdrait tous les deux.
    """
    boites = [_boite_de(tache) for tache, _ in composantes(alpha > 0)]
    boites = _fusionner(boites, ECART)
    seuil = max(0, cote_min) ** 2
    boites = [
        b for b in boites if _aire(b) >= seuil and _epaisseur(b) >= EPAISSEUR_MIN
    ]
    return en_ordre_de_lecture(boites)


def grille_fixe(largeur: int, hauteur: int, colonnes: int, lignes: int) -> list[Boite]:
    """Une planche régulière, découpée en `colonnes × lignes` cases égales.

    **Le reste de la division se répartit**, il ne se jette pas : une planche de
    1000 px en 3 colonnes donne 334, 333 et 333, et la dernière case va bien
    jusqu'au dernier pixel. Une division qui laisse tomber deux pixels laisse
    tomber une colonne de sprite au bord droit, et ça ne se voit qu'après
    découpe.
    """
    if colonnes < 1 or lignes < 1 or largeur < 1 or hauteur < 1:
        return []
    bornes_x = _bornes(largeur, colonnes)
    bornes_y = _bornes(hauteur, lignes)
    return [
        (x0, y0, x1, y1)
        for y0, y1 in bornes_y
        for x0, x1 in bornes_x
    ]


def en_ordre_de_lecture(boites: list[Boite]) -> list[Boite]:
    """De haut en bas, puis de gauche à droite — par bandes.

    **Pas un tri sur `(y0, x0)`**, qui interleaverait deux rangées dès qu'un
    sprite est posé trois pixels plus haut que son voisin : la deuxième rangée
    commencerait avant la fin de la première. On groupe donc en bandes — une
    boîte rejoint la bande courante si son **centre vertical** y tombe —, et on
    trie chaque bande de gauche à droite.

    Le centre plutôt que le bord haut : un sprite deux fois plus grand que ses
    voisins chaînerait toute la planche en une seule bande si l'on comparait les
    bords.
    """
    restantes = sorted(boites, key=lambda b: (b[1], b[0]))
    ordonnees: list[Boite] = []
    bande: list[Boite] = []
    haut = bas = 0
    for boite in restantes:
        centre = (boite[1] + boite[3]) / 2
        if bande and haut <= centre <= bas:
            bande.append(boite)
            haut, bas = min(haut, boite[1]), max(bas, boite[3])
            continue
        ordonnees.extend(sorted(bande, key=lambda b: b[0]))
        bande = [boite]
        haut, bas = boite[1], boite[3]
    ordonnees.extend(sorted(bande, key=lambda b: b[0]))
    return ordonnees


# ── La découpe elle-même ─────────────────────────────────────────────────────


def decouper(octets: bytes, boites: list[Boite], *, marge: int = MARGE) -> list[bytes]:
    """Les morceaux de l'image **brute**, en PNG, chacun avec son fond autour.

    Brute, et pas rendue : ce qui sort d'ici est le brut d'assets à part
    entière, qui se détoureront, se remettront sur grille et se quantifieront
    comme n'importe quelle image arrivée du modèle. Découper un rendu figerait
    dans l'image ce que la recette doit rester libre de défaire — c'est le
    principe non destructif, appliqué à un geste qui fabrique de nouveaux objets.

    **Toutes les boîtes d'un coup, parce que la planche se décode une fois.**
    Décoder un PNG de 1024 px coûte quelques dizaines de millisecondes ; une
    grille de 8 × 8 en paierait soixante-quatre pour la même image, soit deux
    secondes d'attente que rien ne justifie.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        image = ouverte.convert("RGBA")
    morceaux = []
    for boite in boites:
        x0, y0, x1, y1 = _elargir(boite, image.width, image.height, marge)
        tampon = io.BytesIO()
        image.crop((x0, y0, x1 + 1, y1 + 1)).save(tampon, format="PNG", optimize=True)
        morceaux.append(tampon.getvalue())
    return morceaux


# ── Le dedans ────────────────────────────────────────────────────────────────


def _boite_de(tache: np.ndarray) -> Boite:
    lignes = np.flatnonzero(tache.any(axis=1))
    colonnes = np.flatnonzero(tache.any(axis=0))
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


def _aire(boite: Boite) -> int:
    x0, y0, x1, y1 = boite
    return (x1 - x0 + 1) * (y1 - y0 + 1)


def _epaisseur(boite: Boite) -> int:
    """Le petit côté d'une boîte — ce qui distingue une forme d'une ligne."""
    x0, y0, x1, y1 = boite
    return min(x1 - x0 + 1, y1 - y0 + 1)


def _proches(a: Boite, b: Boite, ecart: int) -> bool:
    return (
        a[0] - ecart <= b[2] + ecart
        and b[0] - ecart <= a[2] + ecart
        and a[1] - ecart <= b[3] + ecart
        and b[1] - ecart <= a[3] + ecart
    )


def _fusionner(boites: list[Boite], ecart: int) -> list[Boite]:
    """Réunit ce qui se touche, **transitivement**.

    Trois morceaux en chaîne — le corps, la main, l'arc — ne se touchent pas
    tous deux à deux : sans transitivité, l'arc resterait un sujet à lui seul.
    Assez peu de boîtes pour que le quadratique ne se voie pas ; une planche en
    porte des dizaines, jamais des milliers.
    """
    reunies = list(boites)
    change = True
    while change:
        change = False
        for i in range(len(reunies)):
            for j in range(i + 1, len(reunies)):
                if not _proches(reunies[i], reunies[j], ecart):
                    continue
                a, b = reunies[i], reunies[j]
                reunies[i] = (
                    min(a[0], b[0]),
                    min(a[1], b[1]),
                    max(a[2], b[2]),
                    max(a[3], b[3]),
                )
                reunies.pop(j)
                change = True
                break
            if change:
                break
    return reunies


def _bornes(taille: int, parts: int) -> list[tuple[int, int]]:
    """Les bornes inclusives de `parts` tranches, reste réparti sur les premières."""
    base, reste = divmod(taille, parts)
    bornes: list[tuple[int, int]] = []
    depart = 0
    for part in range(parts):
        longueur = base + (1 if part < reste else 0)
        bornes.append((depart, depart + longueur - 1))
        depart += longueur
    return bornes


def _elargir(boite: Boite, largeur: int, hauteur: int, marge: int) -> Boite:
    x0, y0, x1, y1 = boite
    marge = max(0, marge)
    return (
        max(0, x0 - marge),
        max(0, y0 - marge),
        min(largeur - 1, x1 + marge),
        min(hauteur - 1, y1 + marge),
    )
