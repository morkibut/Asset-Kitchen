# -*- coding: utf-8 -*-
"""Le gabarit d'une planche, et ce qu'on mesure sur ce qui revient.

CPU, pur, aucune entrée-sortie — comme `decoupe.py`, dont ce module est le
compagnon : celui-là dit **où** couper, celui-ci dit **quoi demander** et **ce
que vaut** ce qu'on a reçu. La géométrie, elle, vit dans
`atelier/domaine/pliage.py`, parce que la génération l'enregistre.

**Rien ici ne refuse.** Le compte d'images est le seul refus automatique du
produit, et il est arithmétique : il se prend dans le service, sur la longueur
d'une liste de boîtes. Les mesures de ce module informent, case par case, et
n'empêchent jamais de garder (`docs/archive/plan-versions-tenues.md`, C2).
"""

from __future__ import annotations

import io
import itertools

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.direction import paires_opposees
from atelier.domaine.pliage import Geometrie, MesuresLot
from atelier.image.decoupe import Boite
from atelier.image.traitement import retrouver_grille

__all__ = [
    "COTE",
    "SEUIL_MIROIR",
    "cote_de_case",
    "ecart_au_miroir",
    "gabarit",
    "mesurer_lot",
    "vues_en_miroir",
]


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


def cote_de_case(forme: Geometrie) -> int:
    """Ce qu'un sujet fait de côté, dans une planche de cette forme.

    **Le même calcul que le gabarit, et c'est tout l'intérêt** : l'écran de la
    planche annonce « un sujet revient à 512 px » avant de payer, et le gabarit
    dessine les cases où le modèle les posera. Deux formules auraient fini par
    annoncer une taille et en demander une autre — la même contradiction que le
    calibrage répare ailleurs, et il n'y a pas de raison de la rejouer ici.

    Le plus petit des deux côtés : c'est lui qui borne le sujet.
    """
    large = (COTE - 2 * MARGE - GOUTTIERE * (forme.colonnes - 1)) // forme.colonnes
    haut = (COTE - 2 * MARGE - GOUTTIERE * (forme.lignes - 1)) // forme.lignes
    return max(1, min(large, haut))


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

    Trois nombres par case, et pas un de plus :

    - **la ressemblance** — le plus fort recouvrement de silhouette entre cette
      case et une autre du lot, et laquelle. C'est le piège mesuré le 28 août :
      deux planches sur vingt-quatre avaient le compte juste et répétaient une
      pose. Le contrat était tenu, la planche sans valeur ;
    - **la grille** — le pas de pixel sur lequel le modèle a peint cette
      case-là, et la dérive du lot, qui est le rapport du plus grand au plus
      petit. Elle **ne refuse rien** : une case peinte sans grille rend zéro, et
      l'écran l'affiche « — » plutôt que d'inventer un chiffre
      (`retrouver_grille`, D2). La dérive ne compte que les cases qui ont
      vraiment un pas ;
    - **le remplissage** — la part de la boîte qui reste opaque (R6, US-368).
      C'est le seul des trois qui attrape quelque chose qu'on ne voit pas : un
      modèle qui redessine les traits du quadrillage rend des carrés pleins que
      le compte accepte, et qui entraient en bibliothèque sans un mot. Il porte
      un seuil, `SEUIL_PLEINE`, et il le porte parce qu'il est mesuré — 0,34 à
      0,77 sur une planche saine, 0,99 à 1,00 sur une planche quadrillée, rien
      entre les deux sur les 135 planches des bancs.

    La boîte part avec, telle qu'elle a été trouvée. **C'est ce qui permet de
    montrer les sujets avant d'en garder aucun** : l'écran découpe la planche
    dans son coin, sans redemander au serveur ce qu'il vient de mesurer.
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

    # **Le détecteur de D2, et plus `mesurer_grille`** (3 septembre 2026). Trois
    # choses changent d'un coup, et aucune n'était un choix de style :
    #
    # - la case part **en tableau** au lieu d'un PNG réencodé pour être aussitôt
    #   redécodé — la mesure d'une planche de vingt-quatre cases payait
    #   vingt-quatre allers-retours pour rien ;
    # - la mesure **voit l'alpha**, qui est le contraste le plus franc d'une case
    #   détourée, au lieu de l'aplatir en gris ;
    # - et surtout, **elle sait se taire**. La revue externe du 2 septembre
    #   nommait le défaut : « `derive` hérite des faux positifs de
    #   `mesurer_grille` » — une case peinte sans grille répondait 2, et la
    #   dérive d'un lot se calculait sur ce 2. Une case sans grille rend
    #   maintenant zéro, l'écran l'affiche « — » comme il le faisait déjà, et la
    #   dérive ne compte plus que des pas qui existent.
    pas = [retrouver_grille(c) for c in crops]
    mesures = [g.pas for g in pas if g.trouvee]
    derive = round(max(mesures) / min(mesures), 2) if mesures else 1.0

    return [
        MesuresLot(
            case=index,
            cases=len(crops),
            grille_px=pas[index].pas,
            ressemblance=round(fortes[index], 4),
            jumeau=jumeaux[index],
            derive=derive,
            remplissage=_remplissage(crops[index]),
            boite=boites[index],
        )
        for index in range(len(crops))
    ]


# ── Deux vues opposées qui ne sont qu'un miroir (TS19) ───────────────────────
#
# **Ce que la mesure sépare, en une phrase** (AGENTS.md, 8sexies) : une vue qui
# n'est que l'autre retournée — chaque couleur retombe à sa place une fois
# l'image retournée — d'une vue qui montre vraiment l'autre côté du corps, où
# ce qui est porté d'un seul côté disparaît ou change de place et laisse des
# couleurs qui ne se superposent plus.
#
# Le côté du carré de comparaison. Petit exprès : un modèle qui retourne son
# image la **redessine** quand même, à un ou deux pixels près — vu sur les
# planches d'Elias —, et c'est la place des masses de couleur qui compte, pas
# le trait.
COTE_MIROIR = 32

# **Au-dessous, les deux vues sont un miroir.** Choisi sur les exemples
# fabriqués de `tests/test_ts19.py` — un miroir redessiné (décalé de trois
# pixels, bruité) mesure 0,005 ; l'autre côté du même voyageur, de silhouette
# *identique* et qui ne diffère que par la sacoche cachée et la gourde vue,
# 0,059 —, puis relu sans rien payer sur les planches d'Elias du disque de
# l'auteur (24 septembre 2026) : les deux faites par `gpt-image-2.5`, en miroir
# à l'œil, mesurent 0,016 et 0,020. **Ce qu'il ne voit pas** : la planche faite
# en local, un miroir *redessiné* où le fusil a raccourci et la gourde disparu,
# mesure 0,34 — elle n'est pas « presque identique », et elle passe. Un
# signal, jamais un refus : il ne retient rien, il fait regarder.
SEUIL_MIROIR = 0.035


def ecart_au_miroir(une: np.ndarray, autre: np.ndarray) -> float:
    """Ce qui distingue `une` de `autre` retournée, entre 0 et 1.

    Chaque vue est recadrée sur son sujet (l'alpha du détourage), mise à la
    même taille, puis l'une est retournée de gauche à droite. Sur la réunion
    des deux silhouettes, un pixel opaque d'un côté et vide de l'autre compte
    pour 1 ; un pixel opaque des deux côtés compte l'écart de ses couleurs.
    **Zéro : un miroir parfait.** Pur, déterministe, sans tirage.
    """
    a = _vue_carree(une)
    b = _vue_carree(autre)
    if a is None or b is None:
        return 1.0
    b = b[:, ::-1]
    pa = a[:, :, 3] >= OPACITE
    pb = b[:, :, 3] >= OPACITE
    union = pa | pb
    if not union.any():  # pragma: no cover — deux vues trouvées ont un sujet
        return 1.0
    couleur = np.abs(a[:, :, :3] - b[:, :, :3]).mean(axis=2) / 255.0
    ecart = np.where(pa & pb, couleur, 1.0)
    return round(float(ecart[union].mean()), 4)


def vues_en_miroir(
    rgba: np.ndarray,
    boites: list[Boite],
    directions: list[str | None],
) -> tuple[tuple[int, int], ...]:
    """Les paires de cases opposées qui ne sont que le miroir l'une de l'autre.

    `boites` et `directions` sont alignées dans l'ordre des cases. Seules les
    paires que `paires_opposees` reconnaît sont comparées — est et ouest,
    gauche et droite, et leurs diagonales : le sud et le nord d'un même
    personnage ne se ressemblent pas en miroir, et deux vues sans direction ne
    disent pas ce qu'elles devraient montrer.
    """
    rendues: list[tuple[int, int]] = []
    for i, j in paires_opposees(directions[: len(boites)]):
        if ecart_au_miroir(_dans(rgba, boites[i]), _dans(rgba, boites[j])) < SEUIL_MIROIR:
            rendues.append((i, j))
    return tuple(rendues)


def _dans(rgba: np.ndarray, boite: Boite) -> np.ndarray:
    x0, y0, x1, y1 = boite
    return rgba[y0 : y1 + 1, x0 : x1 + 1]


def _vue_carree(vue: np.ndarray) -> np.ndarray | None:
    """Le sujet seul, recadré sur son alpha et réduit au carré de comparaison.

    Les couleurs sont **prémultipliées** avant la réduction, canal par canal :
    un pixel transparent garde la couleur du fond d'où il a été détouré, et la
    moyenne d'une réduction la ferait baver sur le contour du sujet.
    """
    opaque = vue[:, :, 3] >= OPACITE
    if not opaque.any():
        return None
    lignes = np.flatnonzero(opaque.any(axis=1))
    colonnes = np.flatnonzero(opaque.any(axis=0))
    coupe = vue[lignes[0] : lignes[-1] + 1, colonnes[0] : colonnes[-1] + 1].astype(
        np.float32
    )
    alpha = coupe[:, :, 3] / 255.0
    canaux = [coupe[:, :, c] * alpha for c in range(3)] + [coupe[:, :, 3]]
    reduits = [
        np.asarray(
            Image.fromarray(np.ascontiguousarray(canal), "F").resize(
                (COTE_MIROIR, COTE_MIROIR), Image.Resampling.BOX
            ),
            dtype=np.float64,
        )
        for canal in canaux
    ]
    a = reduits[3] / 255.0
    with np.errstate(divide="ignore", invalid="ignore"):
        rgb = [np.where(a > 0, r / a, 0.0) for r in reduits[:3]]
    return np.stack(rgb + [reduits[3]], axis=2)


# ── Le dedans ────────────────────────────────────────────────────────────────


def _silhouette(crop: np.ndarray) -> np.ndarray:
    masque = Image.fromarray(
        (crop[:, :, 3] >= OPACITE).astype(np.uint8) * 255, "L"
    )
    etiree = masque.resize((COTE_SILHOUETTE, COTE_SILHOUETTE), Image.Resampling.BILINEAR)
    return np.asarray(etiree) >= OPACITE


def _remplissage(crop: np.ndarray) -> float:
    """La part de la boîte qui reste opaque, entre 0 et 1 (R6, US-368).

    **Dans la boîte, et surtout pas dans la vignette découpée.** La vignette est
    taillée dans les octets d'origine — fond compris, marge comprise —, donc
    elle est opaque partout : mesurée le 3 septembre 2026 à 1,00 sur les sept
    planches d'essai, quadrillées comme saines. Elle ne sépare rien. C'est bien
    la boîte du sujet, prise sur l'alpha du détourage, qui dit si ce qu'on tient
    est une silhouette ou un rectangle.

    Le même seuil d'opacité que la silhouette, et pour la même raison : un
    contour à demi transparent est tranché une fois pour toutes, et deux lectures
    de la même image rendent le même chiffre.
    """
    if crop.size == 0:  # pragma: no cover — une boîte trouvée n'est jamais vide
        return 0.0
    return round(float((crop[:, :, 3] >= OPACITE).mean()), 4)


def _recouvrement(un: np.ndarray, autre: np.ndarray) -> float:
    """L'intersection sur l'union. Deux silhouettes vides se ressemblent
    entièrement — c'est vrai, et ça ne se produit pas : une case sans pixel
    opaque n'aurait pas été trouvée par la détection."""
    union = int((un | autre).sum())
    return int((un & autre).sum()) / union if union else 1.0


# `_png` vivait ici pour donner des octets à `mesurer_grille`, qui n'en prenait
# pas d'autres. Le détecteur de D2 reçoit un tableau ; l'encodage n'a plus de
# raison d'être et il est retiré plutôt que gardé « au cas où » — un aller-retour
# PNG par case, sur une planche de vingt-quatre, ne se retrouve pas tout seul.
