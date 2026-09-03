# -*- coding: utf-8 -*-
"""La planche d'équipement, et le calque qu'on en tire par différence.

CPU, pur, aucune entrée-sortie — comme `decoupe.py` et `pliage.py`, dont ce
module est le troisième compagnon : celui-là dit **où** couper, celui-ci dit
**quoi envoyer** quand la grille part pleine, et **ce qui a changé** quand elle
revient.

**Rien n'est ajouté à l'image envoyée pour aider le recalage** (`docs/archive/plan-versions-tenues.md`,
C3) : ni ancre, ni mire, ni silhouette de repère, et surtout pas le gabarit de
cases vides de C2 — celui-là dessine des traits, et un trait est une chose que le
modèle recopie. La planche d'équipement est faite des corps eux-mêmes, posés sur
le fond plat du produit, et c'est tout. Ce qui la rend découpable au retour n'est
pas un repère dessiné : c'est que **l'atelier connaît la grille qu'il a posée**.

**Rien ici ne refuse non plus.** Les cinq mesures informent (US-147) ; c'est le
service qui décide quoi faire d'une échelle qui a dérivé, et le compte d'images
reste le seul refus automatique du produit.

**Le corps d'origine n'est jamais modifié.** Ce module le lit, ne l'écrit
jamais, et ne rend que des tableaux neufs.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Sequence

import numpy as np
from PIL import Image

from atelier.domaine.equipement import ECHELLE_TOLEREE, MesuresCalque
from atelier.domaine.pliage import Geometrie
from atelier.domaine.recette import BORD, Difference, Passe, Recette, Trait
from atelier.domaine.superposition import Superposition
from atelier.image.decoupe import Boite, grille_fixe
from atelier.image.pliage import COTE, FOND
from atelier.image.traitement import composantes, detourer, peindre, pinceau

__all__ = [
    # Re-exporté **exprès** : le seuil vit dans le domaine depuis C4 — c'est un
    # verdict du produit, pas un réglage d'algorithme —, et il se lit ici, à
    # côté du recalage qui produit le nombre qu'il juge.
    "ECHELLE_TOLEREE",
    "OCCUPATION_AGRANDIT",
    "OCCUPATION_CONTENUE",
    "Place",
    "Retour",
    "aligner",
    "avec_alpha",
    "cases_de",
    "composer",
    "differencier",
    "masque_de",
    "mesurer_calque",
    "peindre",
    "pinceau",
    "place_de",
    "proposer",
    "recadrer_sur",
    "superposer",
]


# ── Ce que le sujet occupe dans sa case ──────────────────────────────────────
#
# **La marge est exactement le dézoom que le modèle s'accordait tout seul.**
# `essais/essai_silhouette.py`, 28 août 2026 : sur les six modèles sans
# exception, une cape — une pièce qui agrandit la silhouette — revenait avec le
# personnage réduit à **0,62**, parce que le modèle faisait de la place pour ce
# qu'on lui demandait d'ajouter. L'hypothèse du produit est qu'il n'a plus besoin
# de la prendre si on la lui donne : une pièce déclarée « qui agrandit » part
# donc avec son sujet à 0,62 de la case.
#
# Une pièce contenue n'a besoin de rien — 0,92 laisse seulement de quoi ne pas
# coller aux bords, parce qu'un sujet qui touche le bord de sa case invite le
# modèle à le recadrer.
OCCUPATION_CONTENUE = 0.92
OCCUPATION_AGRANDIT = 0.62

# Le cadre où l'on cherche le recalage. **Réduit exprès** : la recherche essaie
# une soixantaine d'échelles, et chacune coûte une corrélation de Fourier. À
# 128 px elle est instantanée ; à la taille d'un corps sans grille — 1024 px —
# elle coûterait une seconde par case. Le décalage trouvé est ensuite remis à
# l'échelle du cadre réel, et la précision perdue vaut moins d'un pixel de rendu.
CADRE_RECALAGE = 128

# Les échelles essayées pour ramener ce qui revient sur ce qui est parti. La
# plage couvre les deux sens : un modèle qui a dézoomé à 0,62 se rattrape à 1,61,
# et un modèle qui aurait au contraire zoomé se rattrape en dessous de 1.
#
# **Le pas est choisi pour que 1,00 tombe dessus, et c'est tout ce qui compte.**
# Une plage qui l'enjambe — 0,99 puis 1,01 — force une image que personne n'a
# redimensionnée à se rééchantillonner d'un centième : le contour se décale d'un
# pixel sur tout le tour, et **la silhouette entière ressort comme un ajout**.
# Mesuré ici même : 9 % du corps « ajouté » sur un retour rigoureusement
# identique à ce qui était parti.
ECHELLES = np.linspace(0.55, 1.85, 131)

# Au-dessus, un pixel appartient au sujet. Le même seuil que partout ailleurs
# dans le produit (`docs/PIEGES.md`) : un contour à demi transparent est tranché
# une fois pour toutes, et deux lectures rendent la même silhouette.
OPACITE = 128


@dataclass(frozen=True, slots=True)
class Retour:
    """Une case revenue, ramenée dans le cadre du corps — et ce que le retour a
    appris en chemin.

    **Une seule recherche de recalage, trois réponses.** L'échelle et la
    silhouette retrouvée sortent du même calcul que l'alignement : les mesurer à
    part demanderait une seconde recherche, qui pourrait tomber ailleurs, et le
    calque affiché ne serait alors plus celui qu'on a mesuré.
    """

    image: np.ndarray
    echelle: float
    silhouette: float


@dataclass(frozen=True, slots=True)
class Place:
    """Où un corps est posé dans sa case — et donc où le retrouver au retour.

    **Elle ne s'enregistre nulle part.** Elle se recalcule des dimensions du
    corps, de celles de la case et de l'occupation, qui sont toutes trois déjà
    connues : la composition et le redécoupage la demandent chacun de leur côté
    et tombent sur la même, exactement comme le gabarit de C2 se redessine du
    geste au lieu de se ranger.
    """

    x: int
    y: int
    largeur: int
    hauteur: int


def place_de(
    largeur: int, hauteur: int, case: Boite, occupation: float
) -> Place:
    """Le rectangle qu'un corps occupe dans sa case.

    **Le cadre entier du corps est posé, jamais sa seule silhouette.** Poser la
    boîte du sujet aurait demandé de retenir ses décalages pour savoir où le
    reprendre au retour ; poser le cadre rend le chemin inverse trivial — une
    découpe et un redimensionnement — et n'a coûté que de la transparence autour,
    que le fond plat recouvre de toute façon.

    Centré dans les deux sens. L'ancrage bas du post-traitement n'a pas cours
    ici : toutes les cases reçoivent des cadres de même taille, donc leurs lignes
    de sol s'accordent déjà, et centrer laisse autant de place en haut qu'en bas
    à une pièce qui déborde.
    """
    x0, y0, x1, y1 = case
    large, haut = x1 - x0 + 1, y1 - y0 + 1
    cote = max(1, round(min(large, haut) * occupation))
    facteur = cote / max(1, max(largeur, hauteur))
    l2 = max(1, round(largeur * facteur))
    h2 = max(1, round(hauteur * facteur))
    return Place(x0 + (large - l2) // 2, y0 + (haut - h2) // 2, l2, h2)


def cases_de(largeur: int, hauteur: int, forme: Geometrie) -> list[Boite]:
    """Les cases d'une planche d'équipement, dans l'ordre de lecture.

    Un seul appel à `grille_fixe`, partagé par la composition et par le
    redécoupage : **c'est la même grille des deux côtés**, et c'est toute la
    différence entre une base connue et une base devinée (US-142).
    """
    return grille_fixe(largeur, hauteur, forme.colonnes, forme.lignes)[: forme.cases]


def composer(
    corps: Sequence[bytes], forme: Geometrie, occupation: float
) -> bytes:
    """La planche qui part — les corps posés sur la grille, et rien d'autre.

    Fond plat, gris clair : celui que les modèles rendent réellement, relevé sur
    dix-sept images le 27 août 2026, et déjà celui du gabarit de C2. **Aucun
    trait de case**, aucune numérotation, aucun repère — un modèle recopie ce
    qu'on lui dessine, et un repère recopié deviendrait du sujet au découpage.

    Les cases en trop de la dernière rangée restent du fond nu : elles ne sont
    pas dessinées, donc il n'y a rien à remplir, donc le compte ne peut pas
    tomber faux pour une raison que personne n'a demandée.
    """
    planche = Image.new("RGB", (COTE, COTE), FOND)
    for octets, case in zip(corps, cases_de(COTE, COTE, forme)):
        with Image.open(io.BytesIO(octets)) as brut:
            image = brut.convert("RGBA")
        place = place_de(image.width, image.height, case, occupation)
        # Plus proche voisin : on agrandit du pixel art. Une interpolation lisse
        # inventerait des couleurs de contour que le modèle prendrait pour du
        # dessin, et qui ressortiraient dans la différence.
        petit = image.resize((place.largeur, place.hauteur), Image.Resampling.NEAREST)
        planche.paste(petit, (place.x, place.y), petit)
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def recadrer_sur(
    case: np.ndarray, place_envoyee: Place, case_envoyee: Boite, corps: np.ndarray
) -> Retour:
    """La case revenue, ramenée dans le cadre exact du corps.

    **C'est le chemin inverse de la composition, et c'est pour ça qu'il est
    sûr** : on sait où le corps a été posé, donc on sait où le reprendre. Le
    rectangle est repris en proportion et non en pixels, parce que le modèle rend
    ce qu'il veut comme taille de planche — 1024 demandés, 1024 ou 1536 rendus —
    et que la grille, elle, est la même en proportion.

    Puis le recalage : le sujet revenu est remis à l'échelle et au décalage qui
    couvrent le mieux le corps de départ. **Sans lui, deux pixels de décalage
    suffiraient à faire de tout le contour une différence**, et le calque
    ressemblerait à une silhouette évidée plutôt qu'à une pièce.
    """
    x0, y0, x1, y1 = case_envoyee
    large, haut = x1 - x0 + 1, y1 - y0 + 1
    hauteur_case, largeur_case = case.shape[:2]

    gauche = round((place_envoyee.x - x0) / large * largeur_case)
    sommet = round((place_envoyee.y - y0) / haut * hauteur_case)
    droite = round((place_envoyee.x - x0 + place_envoyee.largeur) / large * largeur_case)
    bas = round((place_envoyee.y - y0 + place_envoyee.hauteur) / haut * hauteur_case)

    gauche, sommet = max(0, gauche), max(0, sommet)
    droite = min(largeur_case, max(gauche + 1, droite))
    bas = min(hauteur_case, max(sommet + 1, bas))

    hauteur_corps, largeur_corps = corps.shape[:2]
    ramene = np.asarray(
        Image.fromarray(case[sommet:bas, gauche:droite], "RGBA").resize(
            (largeur_corps, hauteur_corps),
            # Moyenne de surface : on réduit une image de modèle vers la grille
            # du projet, exactement comme le post-traitement le ferait. Le plus
            # proche voisin y perdrait un pixel sur deux du contour.
            Image.Resampling.BOX,
        )
    )
    echelle, dy, dx, retrouvee = _recalage(corps, ramene)
    return Retour(
        image=_poser(ramene, echelle, dy, dx),
        # **L'échelle à laquelle le sujet est revenu**, rapportée à celle qui est
        # partie. 1,00 : il n'a pas bougé. 0,62 : le modèle l'a réduit pour faire
        # tenir ce qu'on lui demandait d'ajouter, et il n'y a plus de différence
        # à calculer — remettre à l'échelle rééchantillonnerait le pixel art d'un
        # facteur 1,61 et détruirait la grille avant même la comparaison.
        #
        # **Mesurée par le recalage et non par les boîtes.** Une pièce a le droit
        # d'agrandir la boîte du sujet — un casque à cornes ajoute de la hauteur
        # —, donc comparer deux boîtes mesurerait la pièce autant que la dérive.
        # Le recalage, lui, cherche l'échelle à laquelle le **corps** se
        # retrouve, et une pièce ajoutée ne l'y déplace pas.
        echelle=round(1.0 / echelle, 4) if echelle else 1.0,
        silhouette=round(retrouvee, 4),
    )


def differencier(
    corps: np.ndarray, revenu: np.ndarray, difference: Difference
) -> np.ndarray:
    """Ce qui est apparu entre le corps et ce qui est revenu — **le calque**.

    Deux choses en font partie, et il faut les deux : ce qui s'est **ajouté** là
    où il n'y avait rien, et ce qui a **changé de couleur** là où il y avait
    déjà du corps. Un casque posé sur un crâne fait les deux — il dépasse, et il
    recouvre.

    Les pixels rendus sont ceux de l'image **revenue**, jamais ceux du corps :
    c'est la pièce qu'on empile, pas un souvenir du corps.

    `zone` borne le résultat au rectangle que l'auteur a posé (US-144). Vide, la
    différence est cherchée sur toute la case, et **c'est le défaut** : le
    produit ne devine aucune zone.

    **Puis les deux couches de la main, dans cet ordre-ci et pas dans l'autre**
    (C4). Le masque *restreint* ce que la mesure a le droit de garder ; la
    retouche *tranche* sur ce qui en est sorti. Appliquer le masque après aurait
    effacé ce que la main venait de ramener, et « modifier le masque ne détruit
    pas la retouche » serait vrai dans le fichier et faux à l'écran — la pire
    des deux façons d'être faux.

    C'est aussi ce qui donne son pouvoir à la seconde couche : elle **ramène**
    des pixels que la mesure n'a pas trouvés, là où le masque ne peut jamais
    qu'en retirer. Sans elle, une pièce qui se substitue à ce qu'il y avait —
    un casque sur une chevelure, le défaut du 29 août 2026 — resterait
    irrécupérable, puisque aucun réglage de masque ne fabrique une différence
    que la couleur n'a pas vue (`docs/releve-usage.md`).
    """
    forme = corps.shape[:2]
    ajout, touche = _parts(corps, revenu, difference.seuil)
    garde = ajout | touche

    borne = masque_de(forme, difference)
    if borne is not None:
        garde &= borne
    garde = peindre(garde, difference.retouche)

    calque = revenu.copy()
    calque[~garde] = 0
    return calque


def masque_de(
    forme: tuple[int, int], difference: Difference
) -> np.ndarray | None:
    """La **première couche** : le rectangle, affiné à la main (C4, US-149).

    `None` quand rien ne borne — ni rectangle, ni passage de la main. C'est le
    défaut de C3, et il ne bouge pas : *le produit ne devine aucune zone*.

    Sans rectangle mais avec un affinage, la main part de **toute la case** :
    « affiner » suppose quelque chose à affiner, et ce quelque chose est ce que
    la différence regarde par défaut. Exiger un rectangle d'abord aurait fait du
    geste de C3 un préalable au geste de C4, alors que les deux disent la même
    couche par deux bouts.
    """
    if difference.zone is None and not difference.affinage:
        return None
    base = (
        _rectangle(forme, difference.zone)
        if difference.zone is not None
        else np.ones(forme, dtype=bool)
    )
    return peindre(base, difference.affinage)


# **`peindre` et `pinceau` ont quitté ce module le 31 août 2026, avec E5.** La
# main est devenue la septième place de la recette : elle ne sert plus
# seulement à affiner le masque d'un calque, elle passe sur n'importe quelle
# image. La rasterisation appartient donc au traitement ordinaire, et ce
# module l'importe — c'est le sens de la dépendance, puisqu'il importait déjà
# `composantes` et `detourer` de là. Les deux noms restent exportés ici : le
# calque est l'endroit où on les cherche quand on lit une différence.


def mesurer_calque(corps: np.ndarray, retour: Retour, seuil: int) -> MesuresCalque:
    """Les cinq nombres de US-147, et pas un de plus.

    Ils viennent de `essais/essai_silhouette.py`, étalonné le 28 août 2026 sur
    six modèles et deux jets. Les recopier ici plutôt que d'appeler le banc est
    délibéré : le banc travaille sur des fichiers et des dossiers, et un module
    pur ne doit pas en dépendre — mais **les définitions sont les mêmes**, et
    c'est ce qui rend les mesures du produit comparables à celles du banc.

    **Aucun ne refuse.** C'est écrit dans `MesuresCalque` et c'est vrai ici : ce
    module rend des nombres, il ne rend aucun verdict.
    """
    aligne = retour.image
    ajout, touche = _parts(corps, aligne, seuil)
    opaque_corps = corps[:, :, 3] >= OPACITE
    aire = int(opaque_corps.sum())
    if aire == 0:  # pragma: no cover — un corps vide n'entre pas en case
        return MesuresCalque()

    commun = _eroder(opaque_corps & (aligne[:, :, 3] >= OPACITE))
    difference = ajout | touche
    aire_difference = int(difference.sum())
    if aire_difference:
        taches = composantes(difference)
        compacite = max(a for _, a in taches) / aire_difference if taches else 1.0
    else:
        compacite = 1.0

    # **Le repeint se lit hors de l'empreinte de la pièce, et c'est ce qui le
    # rend décisif.** Un casque cache le haut du crâne : les pixels qu'il
    # recouvre ont bien changé de couleur, et les compter ferait passer une
    # pièce bien posée pour un dégât. La mesure qui tue la méthode est l'autre —
    # un casque n'a aucune raison de changer les bottes.
    #
    # L'étalonnage du 28 août prenait pour empreinte la zone déclarée de la
    # pièce ; le produit ne la lui demande pas, et n'a pas à la lui demander :
    # **ce qui a été ajouté dit déjà où la pièce est tombée**. Le premier réflexe
    # écarté était de prendre la plus grosse tache de la différence — un modèle
    # qui repeint tout le corps n'en fait alors qu'une, et le pire cas passait
    # pour le meilleur.
    dehors = ~_boite_masque(ajout, corps.shape[:2])
    corps_dehors = int((commun & dehors).sum())

    return MesuresCalque(
        silhouette=retour.silhouette,
        repeint=round(float((touche & dehors).sum()) / max(1, corps_dehors), 4),
        ajout=round(float(ajout.sum()) / aire, 4),
        echelle=retour.echelle,
        compacite=round(float(compacite), 4),
    )


# ── La superposition — deux images choisies, et ce qui en sort ───────────────
#
# **Le même cœur que la différence, appelé par l'autre bout.** La planche
# d'équipement connaît l'alignement de ses cases parce que c'est elle qui les a
# posées ; la superposition, elle, le reçoit de l'auteur — et le lui propose
# d'abord. Ce qui suit est identique : deux images alignées, ce que la seconde
# ajoute et repeint, un rectangle, un seuil, une main. Une seconde comparaison
# écrite ici aurait fini par juger autrement la même paire.


def aligner(dessus: np.ndarray, dessous: np.ndarray, pose: Superposition) -> np.ndarray:
    """Le dessus, remis dans le cadre du dessous — mis à l'échelle et décalé.

    **Le cadre du dessous fait loi.** Deux images de tailles différentes ne se
    comparent pas ; c'est le dessous qui donne la case, parce que c'est lui le
    sol et que le résultat s'y range. Ce qui déborde est perdu, ce qui manque
    est transparent — le même contrat que la case d'une planche.
    """
    hauteur, largeur = dessous.shape[:2]
    if dessus.shape[:2] != (hauteur, largeur):
        cadre = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
        cadre.paste(Image.fromarray(dessus, "RGBA"), (0, 0))
        dessus = np.asarray(cadre)
    return _poser(dessus, float(pose.echelle), int(pose.dy), int(pose.dx))


def proposer(dessous: np.ndarray, dessus: np.ndarray) -> tuple[float, int, int, float]:
    """L'échelle et le décalage qui superposent le mieux les deux images.

    **Un bouton, pas un mode.** Il remplit les trois valeurs et s'arrête là ; on
    est toujours en manuel, et on le relance autant qu'on veut — il repart alors
    de zéro, pas de l'ajustement. Quand il tombe à côté — ce qui arrive quand le
    modèle a dézoomé le personnage pour faire de la place à la pièce —, on
    corrige à la main, et c'est très exactement ce qui n'existait pas avant :
    un recalage raté coûtait une génération.
    """
    if dessus.shape[:2] != dessous.shape[:2]:
        dessus = aligner(dessus, dessous, Superposition())
    return _recalage(dessous, dessus)


def superposer(
    dessous: np.ndarray, dessus: np.ndarray, pose: Superposition
) -> tuple[np.ndarray, np.ndarray]:
    """Le calque et l'aplat, d'un seul calcul.

    **Les deux sorties se cochent au lieu de s'exclure** : on veut souvent le
    calque pour le réutiliser et l'aplat pour l'avoir tout de suite. Les rendre
    ensemble évite de refaire l'alignement deux fois, et surtout garantit qu'ils
    parlent de la même pose — deux appels séparés pourraient être faits de part
    et d'autre d'un réglage.

    Le calque est fait des pixels du **dessus**, jamais d'un souvenir du
    dessous : c'est la pièce qu'on empile. L'aplat est les deux fondues dans
    l'ordre de la pile, et il n'a pas besoin d'alpha pour être valable — fondre
    deux images opaques donne un résultat parfaitement utilisable, en extraire
    un calque n'en donne aucun.
    """
    pose_dessus = aligner(dessus, dessous, pose)
    forme = dessous.shape[:2]

    ajout, touche = _parts(dessous, pose_dessus, pose.seuil)
    garde = ajout | touche
    if pose.rectangle is not None:
        garde &= _rectangle(forme, pose.rectangle)
    # **La main tranche après la mesure**, comme la retouche d'un calque de C4 :
    # elle ôte ce que la comparaison a gardé de trop, et ramène ce qu'elle n'a
    # pas vu — un casque sombre sur des cheveux sombres, qu'aucun seuil ne
    # distingue.
    garde = peindre(garde, pose.main)

    calque = pose_dessus.copy()
    calque[~garde] = 0

    # L'aplat : le dessous, et par-dessus ce que le dessus a d'opaque.
    aplat = dessous.copy()
    couvre = pose_dessus[:, :, 3] >= OPACITE
    aplat[couvre] = pose_dessus[couvre]
    return calque, aplat


def avec_alpha(octets: bytes) -> np.ndarray:
    """Une image, avec la silhouette qu'il faut pour la comparer.

    Un corps de la bibliothèque a déjà son alpha — le détourage du projet le lui
    a posé —, et le lui reposer coûterait 130 ms pour rien. **Une image restée
    opaque n'a pas été détourée**, et c'est le cas d'un corps importé « telle
    quelle » depuis R3 : celui-là se détoure ici, sinon toute son étendue
    passerait pour du sujet et la différence rendrait le rectangle entier.

    Le moteur par remplissage depuis le bord, jamais celui par modèle : ces
    images-là ont le fond plat que l'atelier a demandé, les deux moteurs s'y
    accordent (`essais/essai_detourage_modele.py`), et le second demanderait
    180 Mo de réseau pour le même résultat.
    """
    with Image.open(io.BytesIO(octets)) as image:
        rgba = np.asarray(image.convert("RGBA")).copy()
    if bool((rgba[:, :, 3] >= OPACITE).all()):
        return detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
    return rgba


# ── Le dedans ────────────────────────────────────────────────────────────────


def _parts(
    corps: np.ndarray, revenu: np.ndarray, seuil: int
) -> tuple[np.ndarray, np.ndarray]:
    """Ce qui s'est ajouté, et ce qui a été repeint. Les deux moitiés du calque."""
    opaque_corps = corps[:, :, 3] >= OPACITE
    opaque_revenu = revenu[:, :, 3] >= OPACITE

    # **Le contour ne compte pas dans la couleur.** Un pixel de bordure qui se
    # décale d'un cran n'est pas un repeint, c'est du recalage résiduel :
    # l'étalonnage du 28 août donnait 10 % de repeint sur un corps que personne
    # n'avait touché, soit plus que ce qui distingue une pièce propre d'un dégât.
    commun = _eroder(opaque_corps & opaque_revenu)
    ecart = _ecart_tolerant(corps[:, :, :3], revenu[:, :, :3], opaque_revenu)
    touche = commun & (ecart > seuil)
    # L'ajout, lui, ne s'érode pas : c'est l'empreinte de la pièce, et elle se
    # mesure entière.
    ajout = opaque_revenu & ~opaque_corps
    return ajout, touche


def _boite_masque(
    ajout: np.ndarray, forme: tuple[int, int]
) -> np.ndarray:
    """L'empreinte de la pièce — la boîte de ce qui s'est ajouté.

    Vide quand rien ne s'est ajouté : la boîte est alors vide, tout le corps est
    « dehors », et `repeint` mesure alors le corps entier. C'est exact — une
    différence sans aucun ajout *est* un repeint, et rien d'autre.
    """
    dedans = np.zeros(forme, dtype=bool)
    boite = _boite(ajout)
    if boite is None:
        return dedans
    gauche, haut, droite, bas = boite
    dedans[haut:bas, gauche:droite] = True
    return dedans


def _boite(masque: np.ndarray) -> tuple[int, int, int, int] | None:
    lignes = np.flatnonzero(masque.any(axis=1))
    colonnes = np.flatnonzero(masque.any(axis=0))
    if lignes.size == 0 or colonnes.size == 0:
        return None
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]) + 1, int(lignes[-1]) + 1


def _poser(rgba: np.ndarray, echelle: float, dy: int, dx: int) -> np.ndarray:
    """Le cadre remis à l'échelle autour de son centre, puis décalé."""
    if echelle == 1.0 and dy == 0 and dx == 0:
        return rgba
    hauteur, largeur = rgba.shape[:2]
    l2 = max(1, round(largeur * echelle))
    h2 = max(1, round(hauteur * echelle))
    petit = Image.fromarray(rgba, "RGBA").resize((l2, h2), Image.Resampling.NEAREST)
    cadre = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    cadre.paste(petit, ((largeur - l2) // 2 + dx, (hauteur - h2) // 2 + dy))
    return np.asarray(cadre)


def _recalage(corps: np.ndarray, revenu: np.ndarray) -> tuple[float, int, int, float]:
    """L'échelle et le décalage qui font le mieux retomber le revenu sur le corps.

    **On cherche le recouvrement rapporté à l'union, pas au seul corps.** La
    part du corps couverte est ce qu'on veut *rendre* — « que reste-t-il de la
    silhouette de départ ? » —, mais elle ne peut pas servir à *chercher* :
    elle croît mécaniquement avec l'échelle, puisque agrandir le revenu finit
    toujours par recouvrir tout le corps. S'en servir comme critère, c'est
    demander « quelle est la plus grande échelle ? », et la bonne réponse ne
    gagnait alors que par l'égalité — donc seulement quand le sujet avait de la
    marge dans son cadre. L'union pénalise ce qui déborde, et la question
    redevient celle qu'on pose (`docs/PIEGES.md`).

    Le placement naïf compterait comme silhouette perdue un décalage de deux
    pixels, que le produit corrige gratuitement.

    Le décalage se cherche par corrélation croisée en Fourier : pour une échelle
    donnée, *tous* les décalages entiers sont évalués d'un coup. Un balayage
    devrait choisir un pas, et un pas trop large raterait précisément le recalage
    fin qui distingue 99 % de 96 %.

    La recherche se fait dans un cadre réduit — voir `CADRE_RECALAGE` —, et ce
    qu'elle rend est remis à l'échelle du cadre réel avant d'être appliqué.
    """
    hauteur, largeur = corps.shape[:2]
    facteur = min(1.0, CADRE_RECALAGE / max(1, max(hauteur, largeur)))
    petit_corps = _masque_reduit(corps, facteur)
    petit_revenu = _reduit(revenu, facteur)

    aire = int(petit_corps.sum())
    if aire == 0:  # pragma: no cover — un corps vide n'entre pas en case
        return 1.0, 0, 0, 0.0

    cible = np.fft.rfft2(petit_corps)
    cadre_h, cadre_l = petit_corps.shape
    limite_h, limite_l = cadre_h // 4, cadre_l // 4
    admis = np.outer(
        _proches(cadre_h, limite_h), _proches(cadre_l, limite_l)
    )

    meilleur = (1.0, 0, 0, 0.0, 0.0)
    for echelle in ECHELLES:
        pose = _poser(petit_revenu, float(echelle), 0, 0)[:, :, 3] >= OPACITE
        if not pose.any():
            continue
        # La corrélation est circulaire : les grands indices sont des décalages
        # négatifs, et tout ce qui dépasse la limite est un repliage sans aucun
        # sens géométrique ici.
        recouvrement = np.fft.irfft2(np.conj(np.fft.rfft2(pose)) * cible, pose.shape)
        union = aire + float(pose.sum()) - recouvrement
        accord = np.where(admis, recouvrement / np.maximum(union, 1.0), -1.0)
        plat = int(np.argmax(accord))
        dy, dx = divmod(plat, cadre_l)
        part = float(accord[dy, dx])
        # **Ce qu'on rend n'est pas ce qui a servi à chercher.** L'accord
        # départage les échelles ; la couverture répond à la question de
        # l'auteur, et se lit au placement que l'accord a retenu.
        couverture = float(recouvrement[dy, dx]) / aire
        # **À recouvrement égal, l'échelle qui bouge le moins.** Un corps est
        # entièrement retrouvé sur toute une plage d'échelles — il est petit dans
        # son cadre, et le réduire un peu le couvre encore —, et prendre la
        # première de la plage annoncerait une dérive que personne n'a subie. La
        # question posée est « le modèle a-t-il redimensionné ? » : à égalité, la
        # réponse est non.
        mieux = part > meilleur[3] + 1e-6
        egal = abs(part - meilleur[3]) <= 1e-6
        if mieux or (egal and abs(echelle - 1.0) < abs(meilleur[0] - 1.0)):
            meilleur = (
                float(echelle),
                dy - cadre_h if dy > limite_h else dy,
                dx - cadre_l if dx > limite_l else dx,
                part,
                couverture,
            )

    echelle, dy, dx, _, couverture = meilleur
    remise = 1.0 / facteur if facteur else 1.0
    return echelle, round(dy * remise), round(dx * remise), min(1.0, couverture)


def _proches(cote: int, limite: int) -> np.ndarray:
    indices = np.arange(cote)
    return (indices <= limite) | (indices >= cote - limite)


def _reduit(rgba: np.ndarray, facteur: float) -> np.ndarray:
    if facteur >= 1.0:
        return rgba
    hauteur, largeur = rgba.shape[:2]
    cote = (max(1, round(largeur * facteur)), max(1, round(hauteur * facteur)))
    return np.asarray(
        Image.fromarray(rgba, "RGBA").resize(cote, Image.Resampling.BOX)
    )


def _masque_reduit(rgba: np.ndarray, facteur: float) -> np.ndarray:
    return _reduit(rgba, facteur)[:, :, 3] >= OPACITE


def _ecart_tolerant(
    corps: np.ndarray, revenu: np.ndarray, opaque: np.ndarray
) -> np.ndarray:
    """Le plus petit écart de couleur entre chaque pixel du corps et le
    voisinage 3×3 de ce qui est revenu.

    À la taille où le produit regarde ses images, un contour **intérieur** — la
    boucle d'un ceinturon, un brin de barbe — fait un pixel de large. Un résidu
    de recalage sous le pixel le déplace d'un cran, et une comparaison pixel à
    pixel le compte comme repeint : l'étalonnage donnait 7 % de repeint sur une
    image que personne n'avait repeinte, soit plus que ce qui décide.

    Accepter le voisin immédiat efface ce bruit **sans rien cacher** — un corps
    viré au bleu l'est aussi chez ses voisins, et il reste détecté à 91 %.
    """
    meilleur = np.full(corps.shape[:2], 255, dtype=np.int16)
    corps = corps.astype(np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            voisin = np.roll(np.roll(revenu, dy, axis=0), dx, axis=1).astype(np.int16)
            valide = np.roll(np.roll(opaque, dy, axis=0), dx, axis=1)
            ecart = np.abs(corps - voisin).max(axis=2)
            meilleur = np.minimum(meilleur, np.where(valide, ecart, 255))
    return meilleur


def _eroder(masque: np.ndarray, pixels: int = 1) -> np.ndarray:
    """Le masque moins sa bordure, en connexité 4."""
    for _ in range(pixels):
        ronge = masque.copy()
        ronge[1:] &= masque[:-1]
        ronge[:-1] &= masque[1:]
        ronge[:, 1:] &= masque[:, :-1]
        ronge[:, :-1] &= masque[:, 1:]
        masque = ronge
    return masque


def _rectangle(
    forme: tuple[int, int], zone: tuple[int, int, int, int]
) -> np.ndarray:
    """Le masque rectangle, **inclusif aux deux bouts** — la convention du
    produit depuis T5, et une seule dans tout le dépôt.

    Un rectangle posé hors du cadre ne lève pas : il se borne. Un onglet resté
    ouvert pendant qu'on changeait la cible de pixel du projet enverrait sinon
    une erreur là où il suffit de rogner.
    """
    hauteur, largeur = forme
    x0, y0, x1, y1 = zone
    masque = np.zeros(forme, dtype=bool)
    masque[
        max(0, min(y0, y1)) : min(hauteur, max(y0, y1) + 1),
        max(0, min(x0, x1)) : min(largeur, max(x0, x1) + 1),
    ] = True
    return masque
