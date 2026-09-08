# -*- coding: utf-8 -*-
"""La recette — ce qu'on a fait à une image, et rien de plus.

**Le traitement est non destructif** (`docs/ARCHITECTURE.md` §4, règle 5) : on
garde l'image brute et la recette. Le fichier traité est un rendu, écrit sur
disque comme cache et effaçable sans rien perdre. Recalculer coûte des
millisecondes ; regénérer coûte de l'argent et ne rend jamais la même image.

**Les étapes s'appliquent dans un ordre fixe** (règle 4 du même paragraphe). Une
recette n'est donc pas une liste que l'auteur ordonne : c'est une suite de
places nommées, chacune remplie ou vide. Ce n'est pas une simplification, c'est
la seule forme correcte — aucune n'a de sens avant celle qui la précède :

1. **détourage** — zéro, une ou plusieurs passes. Rien ne peut se recadrer avant,
   parce qu'il n'y a pas d'alpha sur lequel trouver le sujet.
2. **différence** — ce qui est apparu entre l'image qui est partie et celle qui
   est revenue. Arrivée en C3, et **juste après le détourage** : elle compare des
   silhouettes, donc elle a besoin des deux alphas et ne peut pas le précéder ;
   et elle décide de ce qui reste, donc tout ce qui recadre, réduit ou nettoie
   doit la suivre. Vide pour tout ce qui n'est pas un calque, c'est-à-dire pour
   l'immense majorité des images. Elle porte depuis C4 les **deux couches de la
   main** — le masque et la retouche au pixel —, séparées et rejouables comme
   les passes de détourage ci-dessus, et pour la même raison : ce qu'une main a
   posé ne doit pas tomber parce qu'on a repris l'autre bout.
3. **recadrage** — sur la boîte opaque, avec sa marge.
4. **grille** — l'échelle du sujet et la taille du bloc de pixel, en une seule
   opération : c'est le même rééchantillonnage qui règle les deux.
5. **quantification** — après la réduction, jamais avant : quantifier 1024 px
   pour les jeter ensuite coûte cent fois plus pour le même résultat.
6. **bords** — les miettes, sur l'image telle qu'elle sortira. Avant le
   contour, parce qu'un trait tracé autour de trois taches de six pixels ferait
   trois pâtés que personne n'a dessinés.
7. **contours** — le trait de bord, retracé. Après la grille, qui le mangeait ;
   après la quantification, pour que sa couleur soit celle qu'on a choisie.
   Arrivé en E5.
8. **retournement** — le miroir gauche-droite. Arrivé en B1, et **son rang a
   été arbitré** : `Retouche.dc.html` le plaçait avant le recadrage,
   `atelier-retourner.dc.html` à la fin de la chaîne, et `docs/PLAN-carnet.md`
   a tranché pour la fin — la planche dédiée est la plus récente et la plus
   détaillée. **L'arbitrage ne coûte rien à l'image** : un miroir pur ne
   déplace aucun pixel dans sa colonne, et le recadrage se fait sur la boîte
   opaque, qui se retourne avec le sujet — les deux rangs rendent le même
   fichier. Ce qu'il achète, en revanche, c'est que le retournement soit **la
   dernière chose que la machine fasse avant que la main ne passe** : on le lit
   sur l'image finie, telle qu'elle partira dans le jeu.
9. **la main** — la dernière, et rien ne se rejoue après elle : ce qu'une main
   a posé ne doit pas tomber parce que la machine repasse. Arrivée en E5.

Le compte est de **huit places** — la différence, elle, n'en est plus une aux
yeux du produit : elle nomme deux images en entrée et en produit une troisième,
ce qu'aucune place ne fait, et elle devient une fabrique en E6. Elle reste ici
tant que cette étape-là n'est pas tenue.

**Une recette nommée est une recette, et rien d'autre** (`docs/ARCHITECTURE.md`
§4 : « un preset *est* une recette nommée »). Le nom ne fait pas partie de
l'empreinte : deux recettes identiques rendent le même fichier, qu'elles portent
un nom ou pas.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, replace
from typing import Any

# ── Les moteurs de détourage ─────────────────────────────────────────────────
#
# Trois, et deux d'entre eux sont des recours. Le remplissage depuis le bord ne
# demande aucun modèle, aucun téléchargement et aucun réseau : mesuré le 27 août
# 2026 sur douze images de six modèles, PNG et JPEG, il rend douze silhouettes
# propres — squelette blanc sur fond gris clair et fioles translucides compris.
# C'est le moteur du geste courant, et le défaut.
#
# La pipette est le recours pour ce que le bord **ne peut pas atteindre par
# construction** (A-22) : une poche de fond entièrement enfermée par le sujet —
# la lumière entre un bras et un torse — n'est reliée à aucune bordure, donc
# aucune valeur de tolérance ne l'efface. On désigne alors le fond du doigt
# plutôt que de partir des bordures.
#
# Le modèle, lui, existe pour les images qui n'ont pas été fabriquées ici et
# n'ont donc pas de fond plat.

# La **sélection magique** est le quatrième, et elle prend le problème par
# l'autre bout (U12) : on entoure grossièrement ce qu'on veut garder, et
# l'atelier va chercher le bord du sujet *à l'intérieur* de ce qu'on a entouré.
# Le tracé ne décide de rien — il **borne la recherche** au lieu de la lancer, et
# rien ne bouge au-dehors. Elle est une quatrième façon de désigner ce qu'on
# retire et non un outil de la main : un seul endroit décide de ce qui est
# effacé, et ce qui efface doit agir avant le recadrage et la mise sur grille,
# qui ont tous les deux besoin de savoir où est le sujet.
#
# *Tranché par l'auteur au cadrage du 1ᵉʳ septembre 2026 (`US-361`), contre la
# séance qui la voyait comme un troisième outil de la table de la main.*

BORD = "bord"
COULEUR = "couleur"
MODELE = "modele"
TRACE = "trace"
MOTEURS = (BORD, COULEUR, MODELE, TRACE)


# ── Le durcissement appartient au moteur, et c'est la mesure qui le dit (D1) ──
#
# **Comptée le 3 septembre 2026 sur les 116 assets vivants du dépôt**, 123
# passes de détourage écrites par l'auteur lui-même :
#
# | moteur    | passes | durcissement nul | valeur la plus fréquente |
# |-----------|--------|------------------|--------------------------|
# | `bord`    |   72   |      78 %        | **0** (56 sur 72)        |
# | `couleur` |   11   |       0 %        | **1** (6 sur 11)         |
# | `modele`  |   40   |       2 %        | **2** (32 sur 40)        |
#
# Le plan lisait ce chiffre autrement : « le réglage livré est faux plus d'une
# fois sur deux », et il en concluait qu'une planche et une image seule ne
# veulent pas le même défaut. **Croisé avec le moteur, cet écart disparaît** —
# à moteur égal la nature ne décide presque plus rien (`modele` : 100 % contre
# 93 %), pendant que le moteur, lui, décide tout. Ce qui coûtait à l'auteur
# n'était pas le défaut d'une image seule : c'était que **changer de moteur
# laisse le durcissement du moteur d'avant**, et il l'a retapé 39 fois sur 40.
#
# La raison est déjà écrite ailleurs, elle n'avait simplement jamais été jointe
# à ce comptage : `bord` **ne produit aucun pixel à demi transparent, il est
# binaire par construction**, donc il n'y a pas de frange à ronger ; `modele` en
# produit sur 95 % du sujet (`docs/bilan-v3.md` § 1, mesure 3). Le durcissement
# ne corrige pas un goût, il corrige une frange — et la frange appartient au
# moteur qui la fabrique.
#
# **`trace` ne borne que la recherche**, il ne détoure pas lui-même : il n'a pas
# de frange propre, donc pas de durcissement livré.
DURCISSEMENT_LIVRE = {BORD: 0, COULEUR: 1, MODELE: 2, TRACE: 0}


# Comment le produit **nomme** chaque moteur quand il en parle en français.
#
# **La même liste vit dans `interface/src/composants/Places.tsx`**, et les deux
# sont tenues ensemble par un essai — comme les crans de cible avant elles.
# Deux listes pour un fait finissent toujours par diverger ; un essai qui les
# compare est ce qui rend la divergence impossible à livrer.
NOM_DU_MOTEUR = {
    BORD: "bord",
    COULEUR: "pipette",
    MODELE: "modèle",
    TRACE: "sélection",
}


def durcissement_livre(moteur: str) -> int:
    """Ce que ce moteur-là demande de ronger, sans que personne l'ait posé.

    **Un moteur inconnu ne ronge rien.** Le domaine ne lève pas sur un nom qu'il
    ne connaît pas — une recette écrite avant qu'un moteur existe doit continuer
    de s'ouvrir —, et zéro est la valeur qui ne touche à rien.
    """
    return DURCISSEMENT_LIVRE.get(moteur, 0)

# ── Les places, nommées une fois (U4) ────────────────────────────────────────
#
# **Les huit places du traitement, dans l'ordre où elles s'appliquent**, plus la
# différence qui vit en seconde position sans être une table de l'écran. Elles
# n'avaient jamais eu besoin d'un nom en tant que liste : chacune était un champ,
# et l'ordre était celui du fichier. La veille en demande un — *quelles places
# dorment* est une liste de noms —, et une liste écrite ici est une liste que le
# domaine peut vérifier, plutôt qu'une chaîne libre qu'un agent inventerait.
DETOURAGE = "detourage"
DIFFERENCE = "difference"
RECADRAGE = "recadrage"
GRILLE = "grille"
QUANTIFICATION = "quantification"
BORDS = "bords"
CONTOURS = "contours"
# **Le retournement, en queue et avant la main** (B1). Le rang est arbitré, et
# la raison est en tête de fichier : les deux planches ne le plaçaient pas au
# même endroit, le plan a tranché pour la fin de la chaîne.
RETOURNEMENT = "retournement"
LA_MAIN = "main"
PLACES = (
    DETOURAGE,
    DIFFERENCE,
    RECADRAGE,
    GRILLE,
    QUANTIFICATION,
    BORDS,
    CONTOURS,
    RETOURNEMENT,
    LA_MAIN,
)


def places_inconnues(noms: Any) -> list[str]:
    """Les noms qui ne désignent aucune place, dans l'ordre où ils arrivent.

    **Écrite ici parce qu'elle est posée à deux portes** : la route HTTP et
    l'outil de l'agent. Le domaine, lui, ne lève pas — il relit des fichiers, et
    une recette écrite avant qu'une place soit renommée doit continuer de
    s'ouvrir. Ce sont les portes d'entrée qui refusent, avec la raison et la
    liste de ce qui existe.
    """
    return [n for n in (noms or ()) if n not in PLACES]

# Ce que la pipette retire : la seule zone d'un seul tenant sous le point, ou
# toutes les zones de cette couleur dans l'image.
#
# **`tache` est le défaut, et ce n'est pas de la prudence** : c'est le geste
# pour lequel la pipette a été admise. Retirer une poche fermée sans toucher au
# reste est ce que le bord ne sait pas faire ; `partout` est plus expéditif et
# atteint aussi ce qui touche le sujet.
TACHE = "tache"
PARTOUT = "partout"
PORTEES = (TACHE, PARTOUT)

# Au-delà de ce seuil, un pixel appartient au sujet ; en dessous, au fond.
# **Se durcit avant la réduction, jamais après** — piège payé au prix fort dans
# `MySpriteAi/src/lib/pixelPipeline.ts` : un contour à demi transparent est
# tranché à pile ou face par un rééchantillonnage au plus proche voisin, et deux
# passes de suite rendent alors deux silhouettes différentes.
#
# **Le liseré clair naît ici, et c'est ici qu'il se règle** — corrigé le 31 août
# 2026 : ce commentaire accusait la quantification de forcer l'alpha à 255, et
# c'est faux dans ce dépôt. Mesuré sur six images, `quantifier` met l'alpha de
# côté et le remet tel quel ; il n'y touche pas. Le vrai mécanisme est le
# durcissement ci-dessous : un pixel de contour à peine visible, dont la couleur
# est déjà celle du fond, passe le seuil et ressort **opaque, de la couleur du
# fond**. Baisser ce seuil ou ronger d'un pixel de plus l'efface ; toucher à la
# quantification ne fera jamais rien.
SEUIL_ALPHA = 128


# En deçà de cet écart par canal, un pixel n'a pas changé. Étalonné le 28 août
# 2026 par `essais/essai_silhouette.py` : à 64 px de sujet, un contour qui
# tremble d'un cran donne des écarts sous 32, et un corps réellement repeint les
# dépasse largement. C'est le même nombre que le banc, et pas un second.
SEUIL_COULEUR = 32


# Le rayon d'un passage de la main, en pixels de l'image rendue. **Zéro est le
# pixel** : un rayon nul ne couvre qu'un pixel de large, et c'est très
# exactement la seconde moitié de « à main levée, puis au pixel » (C4). Les deux
# échelles du geste sont donc les deux bouts d'un seul réglage, et non deux
# outils qui auraient chacun leur chemin de rendu.
RAYON_MAX = 64


@dataclass(frozen=True, slots=True)
class Trait:
    """Un passage de la main — ce qu'un geste a gardé, ou ôté (C4).

    **Un vecteur, jamais une image.** Ce qu'on enregistre est le chemin
    parcouru et son rayon, pas le masque qu'il produit : un masque en octets
    serait une seconde copie de ce que la recette sait déjà refaire, il pèserait
    la taille de l'image à chaque geste, et il perdrait le seul intérêt d'une
    recette — se rejouer sur une image dont les dimensions ont changé.

    `garde` dit ce que le passage fait au calque : vrai, il ramène ; faux, il
    ôte. **Le dernier passage l'emporte sur un pixel donné**, comme un pinceau
    sur une toile ; c'est pour ça que l'ordre de la liste compte et qu'on ne la
    trie jamais.

    **`couleur` est arrivée en E5, et elle est portée par le passage, pas par
    le calque.** Un calque de dessin n'est donc pas monochrome : un même calque
    en contient autant qu'on y a posé de teintes, ce qui évite d'en fabriquer un
    par couleur. Vide — le défaut — le passage ne pose aucune couleur : c'est le
    cas des deux couches de la main d'un calque d'équipement (C4), qui décident
    d'un masque, et celui de l'**opacité** de la huitième place, qui décide de
    ce qui est là.

    Un trait sans point ne fait rien : `depuis_json` le laisse tomber au lieu de
    lever, comme un lien sans extrémité (`domaine/lien.py`). Les points hors du
    cadre ne lèvent pas non plus — ils se bornent, comme le rectangle de C3.
    """

    garde: bool = True
    rayon: int = 0
    points: tuple[tuple[int, int], ...] = ()
    couleur: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "garde": self.garde,
            "rayon": self.rayon,
            "points": [list(p) for p in self.points],
            "couleur": self.couleur,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Trait | None":
        points = tuple(
            (int(p[0]), int(p[1]))
            for p in (d.get("points") or ())
            if isinstance(p, (list, tuple)) and len(p) >= 2
        )
        if not points:
            return None
        return Trait(
            garde=bool(d.get("garde", True)),
            rayon=int(d.get("rayon", 0)),
            points=points,
            couleur=str(d.get("couleur") or ""),
        )


def traits_depuis_json(brut: Any) -> tuple[Trait, ...]:
    """Une couche de la main, relue **dans son ordre**.

    L'ordre est le sens du geste : deux passages qui se croisent ne disent la
    même chose que dans l'ordre où la main les a faits.
    """
    if not isinstance(brut, (list, tuple)):
        return ()
    relus = (Trait.depuis_json(t) for t in brut if isinstance(t, dict))
    return tuple(t for t in relus if t is not None)


@dataclass(frozen=True, slots=True)
class Difference:
    """La seconde place — celle qui fait d'une image un **calque** (C3).

    « Le corps d'origine n'est jamais modifié : le calque est rangé à côté de
    l'image payée » (`docs/archive/plan-versions-tenues.md`, C3). Il l'est **par construction** : cette
    place ne décrit qu'un calcul, et le brut de l'asset reste la case telle
    qu'elle est revenue du fournisseur. Rien ne s'écrit jamais dans le corps.

    `base` est l'asset du corps qui était dans cette case quand la planche est
    partie. **Un identifiant, jamais des octets** — même règle qu'une
    réinjection : une seconde copie de l'image serait une copie que plus rien ne
    met à jour, et l'avant se relit au moment du calcul comme il se relirait à
    une relance.

    `zone` est le **masque rectangle** (US-144, US-145) : hors d'elle, la
    différence est effacée. C'est ce qui empêche un visage repeint au passage de
    partir avec la pièce, et c'est pour ça qu'il est en C3 et pas en C4 — sans
    lui, C3 ne serait pas utilisable à sa livraison. Vide, la différence est
    cherchée sur toute la case, et c'est le défaut : **le produit ne devine
    aucune zone**. Le rectangle est exprimé en pixels de l'image **rendue**,
    inclusif aux deux bouts, comme tout rectangle du produit depuis T5.

    Le déplacer ou le retailler ne redemande **aucune image** au fournisseur : le
    calque se recalcule, et le journal du projet ne bouge pas d'un centime. C'est
    exactement ce que la recette de T2 fait déjà pour un recadrage.

    **C4 lui a ajouté les deux couches de la main**, et elles sont deux champs
    distincts pour que la promesse tienne *par construction* : `affinage` est ce
    que la main dit du masque, `retouche` ce qu'elle dit du calque, et poser
    l'une n'écrit jamais dans l'autre. « Modifier le masque ne détruit pas la
    retouche, et inversement » (`docs/archive/plan-versions-tenues.md`, C4) n'est donc pas une
    précaution à tenir : c'est la forme de l'objet.

    **Le masque est le rectangle *et* son affinage** — une seule couche, deux
    façons de la dire. Le rectangle cadre d'un geste ce qu'un rectangle sait
    dire ; l'affinage rattrape le reste, à main levée puis au pixel (US-149).
    Ils ne s'excluent pas : l'affinage part du rectangle quand il y en a un, et
    de toute la case sinon.
    """

    base: str = ""
    zone: tuple[int, int, int, int] | None = None
    seuil: int = SEUIL_COULEUR

    # **Couche 1 — ce que la main dit du masque** (US-149). Elle *restreint* où
    # la différence a le droit de garder ce qu'elle a trouvé ; elle ne fabrique
    # jamais de calque là où rien n'a changé.
    affinage: tuple[Trait, ...] = ()

    # **Couche 2 — ce que la main dit du calque lui-même** (US-150). Elle
    # *tranche*, après coup, sur ce que la différence a rendu : elle ôte ce
    # qu'elle a gardé de trop, et ramène ce qu'elle a manqué. C'est elle qui
    # rattrape une pièce qui *se substitue* au lieu de s'ajouter, le défaut du
    # 29 août 2026 que la comparaison de couleur ne voit pas
    # (`docs/releve-usage.md`).
    retouche: tuple[Trait, ...] = ()

    @property
    def main_posee(self) -> bool:
        """La main est-elle passée sur ce calque ?

        **Dérivé, jamais rangé** : c'est ce qui distingue un calque qu'on n'a pas
        encore regardé d'un calque dont on s'est occupé, et le produit n'a donc
        aucun drapeau « déjà vu » à tenir d'accord avec le disque — même règle
        que `Recette.calque`, qui dit déjà ce qu'une image est.
        """
        return bool(self.affinage or self.retouche)

    def sans_main(self) -> "Difference":
        """La différence telle qu'elle est sortie de la planche — **l'avant**.

        C'est la moitié gauche de la comparaison d'US-151, et elle ne s'écrit
        nulle part : rendre l'avant est un calcul, pas un état. Un second
        fichier gardé « avant retouche » serait une image que plus rien ne met à
        jour le jour où le recalage se rejoue.
        """
        return replace(self, affinage=(), retouche=())

    def en_json(self) -> dict[str, Any]:
        return {
            "base": self.base,
            "zone": list(self.zone) if self.zone else None,
            "seuil": self.seuil,
            "affinage": [t.en_json() for t in self.affinage],
            "retouche": [t.en_json() for t in self.retouche],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Difference":
        zone = d.get("zone")
        return Difference(
            base=str(d.get("base") or ""),
            zone=(tuple(int(v) for v in zone) if zone else None),
            seuil=int(d.get("seuil", SEUIL_COULEUR)),
            affinage=traits_depuis_json(d.get("affinage")),
            retouche=traits_depuis_json(d.get("retouche")),
        )


@dataclass(frozen=True, slots=True)
class Passe:
    """Une passe de détourage. Plusieurs s'enchaînent (US-70).

    Chacune porte **son** seuil et **son** durcissement : une première passe
    large dégrossit le fond, une seconde plus serrée nettoie ce qui reste.

    ── Ce que la pipette ajoute, et ce qu'elle n'ajoute pas ──────────────────

    `point` est le pixel désigné dans l'image, **un point et non une tache**.
    C'est le seul arbitrage de ce réglage, et il se joue sur ce qui survit à un
    recalcul : une tache est une zone d'un seul tenant *retrouvée à chaque
    rendu*, donc son rang et sa boîte bougent dès qu'une passe précédente change
    d'un cran — la recette désignerait alors une autre zone sans le dire. Un
    point, lui, ne bouge pas : les passes ne font que fermer de l'alpha, elles
    ne déplacent aucun pixel, et le recadrage comme la remise sur grille
    viennent après. Il est donc exprimé dans les pixels de l'image **brute**,
    comme le rectangle de recadrage.

    `portee` dit ce qu'on retire depuis ce point : la zone d'un seul tenant, ou
    toutes les zones de la même couleur.

    **La couleur visée n'est pas ici, et c'est délibéré.** L'écran l'affiche —
    une pastille et son code — mais elle se *lit* sous le point, elle ne s'y
    range pas : une couleur écrite à côté du point qui la porte est une copie
    que plus rien ne met à jour, la même faute qu'un fichier « avant retouche »
    gardé sur le disque. Elle arrive avec les mesures de la table.

    ── Masquer une passe, et pourquoi ce n'est pas la retirer (U10) ──────────

    Plusieurs passes s'enchaînent et l'on ne voit que leur somme : impossible de
    savoir laquelle a mangé quoi. `masquee` la retire du calcul **le temps qu'on
    regarde**, sans toucher à un seul de ses réglages. C'est le geste de la
    veille d'une table (U4), un cran plus bas, et la même règle : *ce qu'on
    éteint garde ses réglages, et endormie veut dire sans effet, pas presque
    sans effet*.

    Elle reste dans la recette, donc elle entre dans l'empreinte : masquer une
    passe **change le rendu**, et un rendu qui change doit changer de nom.
    """

    moteur: str = BORD
    tolerance: int = 28  # ± sur chaque composante, pour « bord » et « couleur »
    seuil_alpha: int = SEUIL_ALPHA
    durcissement: int = 0  # pixels rongés au bord après le seuil, 0 à 4
    point: tuple[int, int] | None = None  # pipette : le pixel visé, dans le brut
    portee: str = TACHE  # pipette : cette zone-là, ou toutes celles de sa couleur
    masquee: bool = False  # retirée du calcul, sans rien perdre de ses réglages
    #: La forme tracée à main levée, en pixels de l'image **brute** (U12).
    #:
    #: **La seule passe qui porte une forme dessinée** — les autres portent un
    #: seuil, une tolérance, un durcissement, et au plus un point. C'est le seul
    #: travail neuf de l'étape ; le reste emploie ce qui existe.
    #:
    #: Elle est **fermée d'office** : le dernier point rejoint le premier, et
    #: c'est le geste — on entoure. La laisser ouverte demanderait de dire ce
    #: qu'est le dedans d'une ligne qui ne se referme pas, et il n'y a pas de
    #: réponse à ça.
    trace: tuple[tuple[int, int], ...] = ()
    #: Quel modèle de silhouette, quand le moteur est `modele` (U13).
    #:
    #: **Vide veut dire *le défaut du produit*** — le plus rapide. C'est ce qui
    #: fait qu'une recette écrite avant ce champ rend exactement ce qu'elle
    #: rendait, et le catalogue vit dans `atelier/image/traitement.py` : le
    #: domaine porte le choix, il ne tient pas la liste. Un nom inconnu ne casse
    #: pas la recette — la passe arrive sans effet, et la route le dit.
    modele: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "moteur": self.moteur,
            "tolerance": self.tolerance,
            "seuil_alpha": self.seuil_alpha,
            "durcissement": self.durcissement,
            "point": list(self.point) if self.point else None,
            "portee": self.portee,
            "masquee": self.masquee,
            "trace": [list(p) for p in self.trace],
            "modele": self.modele,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Passe":
        point = d.get("point")
        return Passe(
            moteur=d.get("moteur", BORD),
            tolerance=int(d.get("tolerance", 28)),
            seuil_alpha=int(d.get("seuil_alpha", SEUIL_ALPHA)),
            durcissement=int(d.get("durcissement", 0)),
            point=(tuple(int(v) for v in point) if point else None),
            portee=str(d.get("portee") or TACHE),
            # **Une recette écrite avant U10 n'a pas ce champ**, et son absence
            # veut dire *visible* : les fichiers du disque continuent de rendre
            # exactement ce qu'ils rendaient.
            masquee=bool(d.get("masquee", False)),
            trace=tuple(
                (int(p[0]), int(p[1])) for p in (d.get("trace") or ()) if len(p) >= 2
            ),
            modele=str(d.get("modele") or ""),
        )


def passe_livree(moteur: str = BORD) -> Passe:
    """La passe que le produit pose pour ce moteur-là, et rien de plus (D1).

    **Le seul endroit qui fabrique une passe sans que personne l'ait réglée.**
    Tout ce qui pose un défaut passe par ici — la recette d'un univers, celle
    d'un projet neuf — pour que le durcissement mesuré du moteur arrive avec
    lui au lieu d'être retapé à la main.
    """
    return Passe(moteur=moteur, durcissement=durcissement_livre(moteur))


def moteurs_suivis(
    avant: tuple[Passe, ...], apres: tuple[Passe, ...]
) -> tuple[Passe, ...]:
    """Les passes d'après, **avec le durcissement qui suit les moteurs changés** (D1).

    Mesuré : sans ça, passer du bord au modèle laissait zéro là où l'auteur a
    ensuite tapé 2 lui-même **39 fois sur 40**.

    **Écrite ici parce que l'écran ne dit pas ce qu'il a changé** : il renvoie la
    recette entière, et c'est en la comparant à celle qu'on avait que le
    changement de moteur se lit. Rang par rang, parce qu'une passe n'a pas
    d'autre identité que sa place dans la suite — la même décision que la
    pipette, dont le point vit dans les pixels du brut et pas dans un numéro.

    **Seul le durcissement est touché, et la passe qui sort est celle d'après.**
    Reconstruire depuis celle d'avant perdrait tout ce que le même envoi
    apportait — le point qu'on vient de poser en passant à la pipette, par
    exemple. Le produit n'ajoute qu'un chiffre ; il ne réécrit pas le geste.

    Une passe ajoutée en bout n'a pas d'avant : elle arrive telle quelle, et
    l'écran l'a déjà fabriquée par `passe_livree`.
    """
    return tuple(
        replace(passe, durcissement=durcissement_livre(passe.moteur))
        if rang < len(avant) and _durcissement_non_choisi(avant[rang], passe)
        else passe
        for rang, passe in enumerate(apres)
    )


def _durcissement_non_choisi(avant: Passe, apres: Passe) -> bool:
    """Le moteur a bougé, et **personne n'a jamais choisi ce durcissement-là**.

    Trois conditions, et les trois comptent :

    1. le moteur change — sinon il n'y a rien à faire suivre ;
    2. le durcissement ne bouge pas dans le même envoi — s'il bouge, l'auteur
       vient de le choisir, et **un choix ne se réécrit pas** ;
    3. il valait la valeur livrée du moteur qu'on quitte — sinon c'est un choix
       plus ancien, et il ne se réécrit pas davantage.

    Sans la troisième, un durcissement réglé à la main il y a trois jours serait
    balayé par un simple changement de moteur : exactement la panne que la règle
    existe pour éviter, à l'envers.
    """
    return (
        apres.moteur != avant.moteur
        and apres.durcissement == avant.durcissement
        and avant.durcissement == durcissement_livre(avant.moteur)
    )


# ── Les six réglages neufs de B18 ────────────────────────────────────────────
#
# **Aucun ne s'écrit tant qu'il vaut son neutre** (B1, descendue d'un cran par
# B17) : une clé neuve dans une place existante ne doit pas changer l'empreinte
# des recettes déjà écrites, sans quoi tout leur cache se recalculerait pour un
# réglage qu'aucune ne pose.
#
# **Les trois formats verrouillés que la planche nomme**, et pas un de plus —
# ajouter un format est sans risque pour une recette déjà écrite, qui ne le
# demande pas.
FORMAT_LIBRE = ""
CARRE = "carre"
DEUX_POUR_UN = "2:1"
TROIS_POUR_QUATRE = "3:4"
FORMATS_DE_RECADRAGE: dict[str, tuple[int, int]] = {
    CARRE: (1, 1),
    DEUX_POUR_UN: (2, 1),
    TROIS_POUR_QUATRE: (3, 4),
}


def format_connu(format_: Any) -> str:
    """Le nom rendu tel quel s'il existe, sinon *libre* — même règle que
    `methode_connue` : le domaine ne lève pas sur un mot qu'il ne connaît pas."""
    return format_ if format_ in FORMATS_DE_RECADRAGE else FORMAT_LIBRE


# **Trois paliers, et zéro qui veut dire aucun calage** — la planche ne cite
# que 8, 16 et 32 pour l'herbe du marais.
MULTIPLES_DE_CALAGE = (0, 8, 16, 32)


def multiple_connu(n: Any) -> int:
    """Le multiple demandé, ou zéro s'il ne figure pas dans la liste fermée."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return 0
    return n if n in MULTIPLES_DE_CALAGE else 0


@dataclass(frozen=True, slots=True)
class Recadrage:
    """Sur la boîte opaque, avec une marge. Une boîte explicite l'emporte.

    La boîte explicite n'est pas un réglage d'écran en T2 : c'est par elle que le
    slicer posera ses découpes en T5, et l'écrire ici coûte trois lignes contre
    une reprise de la recette le jour venu.

    **Les six champs de B18** ne changent rien à ce qui précède : ils
    s'appliquent *après* la boîte (tracée ou mesurée) et la marge, dans l'ordre
    où `_recadrer` les lit — ligne de pied, puis format, puis multiple, puis la
    taille imposée, qui est la seule à changer les dimensions du fichier rendu
    plutôt que le rectangle coupé dedans.

    `taille` — **un cadre de taille imposée** : le sujet vient se loger dans
    exactement ces `largeur, hauteur`-là, agrandi ou réduit pour tenir. `None`
    est le défaut : personne ne demande une taille de sortie fixe.

    `format` — **le format verrouillé** : le rectangle grandit depuis son
    centre jusqu'à tenir ce rapport, plutôt que de partir en losange. Vide veut
    dire *libre*, le comportement d'avant B18.

    `multiple` — **le calage sur un multiple** : les quatre bords du rectangle
    sautent au multiple de ce nombre juste au-dessus. Zéro veut dire *aucun
    calage*.

    `masse` — **centré sur la masse** plutôt que sur le rectangle, quand une
    taille imposée laisse un espace vide sur un seul axe (une hallebarde qui
    dépasse d'un seul côté déplace le rectangle sans déplacer le corps). Faux
    par défaut : le rectangle reste ce qui décide.

    `ligne_pied` — **la ligne de pied**, en pixels de l'image d'origine : le
    rectangle se déplace verticalement, sans changer de hauteur, pour que ce
    rang-là tombe en bas de ce qui est gardé. `None` veut dire *non posée*.

    `bord_uni` — **le rognage d'un bord de couleur unie** : la boîte se
    cherche par distance de couleur à la bordure plutôt que par transparence,
    ce qui rend la table utilisable sur une image qui n'a jamais été détourée.
    Faux par défaut : seule la transparence compte, comme avant B18.
    """

    marge: int = 0  # en pixels de l'image d'origine
    boite: tuple[int, int, int, int] | None = None
    taille: tuple[int, int] | None = None
    format: str = FORMAT_LIBRE
    multiple: int = 0
    masse: bool = False
    ligne_pied: int | None = None
    bord_uni: bool = False

    def en_json(self) -> dict[str, Any]:
        return {
            "marge": self.marge,
            "boite": list(self.boite) if self.boite else None,
            # ── Les clés neuves ne s'écrivent que remplies (B18, d'après B17) ──
            **({"taille": list(self.taille)} if self.taille else {}),
            **({"format": self.format} if self.format else {}),
            **({"multiple": self.multiple} if self.multiple else {}),
            **({"masse": self.masse} if self.masse else {}),
            **({"ligne_pied": self.ligne_pied} if self.ligne_pied is not None else {}),
            **({"bord_uni": self.bord_uni} if self.bord_uni else {}),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Recadrage":
        boite = d.get("boite")
        taille = d.get("taille")
        ligne_pied = d.get("ligne_pied")
        return Recadrage(
            marge=int(d.get("marge", 0)),
            boite=(tuple(int(v) for v in boite) if boite else None),
            taille=(tuple(int(v) for v in taille) if taille else None),
            format=format_connu(d.get("format") or FORMAT_LIBRE),
            multiple=multiple_connu(d.get("multiple", 0)),
            masse=bool(d.get("masse", False)),
            ligne_pied=(int(ligne_pied) if ligne_pied is not None else None),
            bord_uni=bool(d.get("bord_uni", False)),
        )


# Où le sujet se pose dans sa case quand il ne la remplit pas dans les deux sens.
# Le bas par défaut : un personnage se tient debout sur le bord bas de sa case,
# et deux frames posées au centre flotteraient l'une par rapport à l'autre.
#
# **Neuf points depuis `A7`, et les deux anciens n'ont pas changé de sens.** Le
# produit n'en connaissait que deux, et ils suffisaient tant que l'ancrage
# n'était qu'un réglage de recette. Une animation en demande plus : un
# personnage tient au sol par ses pieds, mais une bannière tient par son
# **haut**, une porte par son **côté**. Les deux anciens noms sont gardés tels
# quels — `bas` et `centre` —, donc aucune recette déjà écrite ne change de
# rendu.
BAS = "bas"
CENTRE = "centre"
HAUT = "haut"
GAUCHE = "gauche"
DROITE = "droite"
HAUT_GAUCHE = "haut-gauche"
HAUT_DROITE = "haut-droite"
BAS_GAUCHE = "bas-gauche"
BAS_DROITE = "bas-droite"
ANCRAGES = (
    HAUT_GAUCHE, HAUT, HAUT_DROITE,
    GAUCHE, CENTRE, DROITE,
    BAS_GAUCHE, BAS, BAS_DROITE,
)

# Ce que chaque point veut dire, en deux parts de zéro à un : la verticale
# d'abord, l'horizontale ensuite. **Une table plutôt que des conditions**, parce
# que neuf points écrits en `if` se contredisent au premier endroit oublié — et
# il y a deux endroits qui posent une image, `sur_grille` et `poser_dans`.
PARTS_DE_L_ANCRAGE: dict[str, tuple[float, float]] = {
    HAUT_GAUCHE: (0.0, 0.0), HAUT: (0.0, 0.5), HAUT_DROITE: (0.0, 1.0),
    GAUCHE: (0.5, 0.0), CENTRE: (0.5, 0.5), DROITE: (0.5, 1.0),
    BAS_GAUCHE: (1.0, 0.0), BAS: (1.0, 0.5), BAS_DROITE: (1.0, 1.0),
}


def parts_de(ancrage: str) -> tuple[float, float]:
    """Les deux parts d'un ancrage — **le bas centré si le nom est inconnu**.

    Un nom inconnu vient d'une recette écrite à la main, ou d'un réglage arrivé
    d'une version plus récente. Répondre le défaut du produit plutôt que lever
    est ce qui empêche une image de refuser de se rendre pour un mot mal tapé.
    """
    return PARTS_DE_L_ANCRAGE.get(ancrage, PARTS_DE_L_ANCRAGE[BAS])

# Les deux tramages, et il n'y en a pas d'autre. **Deux valeurs déclarées, deux
# valeurs implémentées** : `bayer` a été écrit ici puis retiré le jour même, faute
# d'être rendu par la bibliothèque de traitement. Un réglage qui figure dans une
# recette enregistrée et que personne n'applique est un mensonge qui se réveille
# des mois plus tard, au rappel d'une recette nommée.
AUCUN = "aucun"
FLOYD = "floyd"
TRAMAGES = (AUCUN, FLOYD)


# ── Les méthodes de réduction, arrivées en D2 ────────────────────────────────
#
# **Quatre façons de passer de mille pixels à N carrés, et ce n'est pas un
# classement.** Mesurées le 3 septembre 2026 sur deux illustrations fournies par
# l'auteur (`essais/essai_pixelisation_complet.py`), toutes quatre ramenées au
# même nombre de couleurs pour que la comparaison porte sur la seule réduction :
#
# | méthode    | ce qu'elle rend                                          |
# |------------|----------------------------------------------------------|
# | `vote`     | contour net **et** intérieur lisible — un sprite calme    |
# | `pixeloe`  | garde les traits d'un pixel, contour plus agité           |
# | `lanczos`  | la silhouette la plus lisse, l'intérieur mou              |
# | `proche`   | brut : un pixel sur N gardé, les autres jetés             |
#
# **Le choix est un parti pris de style, pas une qualité** — décision de
# l'auteur le 3 septembre : *« clairement les 4 ont des rendus différents avec
# leurs avantages et inconvénients et peuvent influencer le style souhaité par
# le créateur »*. D'où quatre valeurs vivantes, et non une bonne et trois
# reliques.
AU_PLUS_PROCHE = "proche"
LANCZOS = "lanczos"
VOTE = "vote"
PIXELOE = "pixeloe"

# ── Les quatre méthodes de B18 — « Pixéliser », le reste des moteurs ─────────
#
# **`sur_modele` n'invente aucun pas** : elle rejoue `retrouver_grille` — déjà
# posée en D2/D4 pour la seule mesure — et échantillonne un pixel par case
# **réellement peinte**, phase comprise, avant de ramener ce résultat à la
# cible demandée. C'est le manque que la planche place devant tous les
# autres : *« le pas et l'endroit où il commence sont mesurés depuis le
# 3 septembre et affichés à l'écran, et rien ne s'en sert »*
# (`docs/pistes-2026-09-04/carnet/atelier-reduire.dc.html`).
#
# **`dominante` et `mediane` n'inventent aucune couleur non plus**, chacune à
# sa manière : la première reprend l'esprit du vote en deux temps mais peint
# la case avec la couleur exacte la plus fréquente — jamais une moyenne —, la
# seconde prend la médiane de chaque canal, qui **efface le grain sans faire
# baver le bord**, contrairement à une moyenne.
#
# **`lumiere_juste` répare l'assombrissement de la réduction douce.** Une
# moyenne calculée sur des octets sRGB assombrit les zones contrastées — un
# damier noir et blanc moyenné en sRGB rend un gris plus sombre que le gris
# perçu. Convertir en lumière linéaire avant de moyenner, puis revenir en
# sRGB après, est la correction standard (`docs/DESIGN.md` ne la nomme pas,
# c'est la loi de gamma de l'écran).
SUR_LE_MODELE = "sur_modele"
DOMINANTE = "dominante"
MEDIANE = "mediane"
LUMIERE_JUSTE = "lumiere_juste"

METHODES_DE_REDUCTION = (
    VOTE,
    PIXELOE,
    LANCZOS,
    AU_PLUS_PROCHE,
    SUR_LE_MODELE,
    DOMINANTE,
    MEDIANE,
    LUMIERE_JUSTE,
)

NOM_DE_LA_METHODE = {
    VOTE: "vote en deux temps",
    PIXELOE: "traits épaissis",
    LANCZOS: "réduction douce",
    AU_PLUS_PROCHE: "au plus proche",
    SUR_LE_MODELE: "sur les carrés du modèle",
    DOMINANTE: "couleur dominante de case",
    MEDIANE: "médiane de case",
    LUMIERE_JUSTE: "réduction douce en lumière juste",
}

# **Ce que le produit choisit pour un projet neuf** — tranché par l'auteur le
# 3 septembre : *« par défaut tu mets Vote en deux temps »*.
#
# **Ce n'est pas le défaut du champ**, et la distinction est celle de D1 : le
# champ de `Grille` retombe sur `proche`, qui est ce que l'atelier faisait avant
# cette tranche, de sorte qu'une recette enregistrée avant D2 — dont le JSON ne
# porte aucune méthode — se rouvre en rendant exactement la même image. Le
# défaut du produit, lui, n'entre que dans les recettes fabriquées à neuf.
METHODE_LIVREE = VOTE


def methode_connue(methode: Any) -> str:
    """Le nom rendu tel quel s'il existe, sinon celui qui ne surprend personne.

    **Le domaine ne lève pas sur un nom qu'il ne connaît pas** — même règle que
    `durcissement_livre` pour les moteurs. Un fichier écrit par une version plus
    récente, ou abîmé, doit continuer de s'ouvrir. On retombe sur `proche`,
    c'est-à-dire sur ce que l'atelier faisait avant que la question se pose :
    d'une valeur illisible on ne peut rien déduire, et la moins inventive est la
    seule honnête.
    """
    return methode if methode in METHODES_DE_REDUCTION else AU_PLUS_PROCHE


# ── Les paliers de couleurs, arrivés en D2 ───────────────────────────────────
#
# **Six paliers, et le plafond est le côté du sprite.** Tranché par l'auteur le
# 3 septembre : *« on propose un nombre de 8 / 16 / 32 / 64 / 128 / 256
# couleurs, avec le max bloqué au nombre de pixel (on peut pas avoir du 128
# couleurs sur du 32px) »*.
#
# **Le plafond est mesuré, pas décrété.** Relevé le même jour sur les deux
# illustrations : le sujet occupe environ 27 % de la toile à toutes les tailles,
# et au-delà du côté du sprite l'image **ne contient plus assez de teintes
# distinctes** pour remplir la palette demandée — 32 carrés rendent 30 couleurs
# quand on en demande 32, et 229 quand on en demande 256. Demander plus que le
# côté, c'est donc payer un réglage qui n'agit plus.
PALIERS_DE_COULEURS = (8, 16, 32, 64, 128, 256)


def paliers_de_couleurs(cible: int) -> tuple[int, ...]:
    """Les paliers qui ont un sens pour un sprite de `cible` carrés de côté.

    **Jamais vide.** Une cible plus petite que le premier palier — ou nulle,
    quand le projet n'impose aucune taille — rend quand même le palier le plus
    bas : un écran qui ne propose rien laisserait l'auteur devant une liste
    morte, sans savoir si c'est un bug ou une règle.
    """
    tenus = tuple(p for p in PALIERS_DE_COULEURS if p <= cible)
    return tenus or (PALIERS_DE_COULEURS[0],)


# ── La hauteur d'un sujet, et le plafond qui fermait une famille entière ─────
#
# **Jusqu'ici rien ne pouvait être plus grand qu'un personnage.** L'occupation
# dit la part de la case que le sujet remplit, et elle était bornée à 100 % en
# douze endroits — trois corps de route, deux refus de service, un calcul d'image, trois du calibrage, la liste des positions du curseur, et les deux curseurs d'écran. Un moulin, un arbre, une tour, une porte
# de ville : le produit n'avait aucune façon de les demander. Le modèle était
# juste vers le bas — c'est bien ainsi qu'un objet tenu en main se dessine — et
# faux vers le haut, où il ne montait pas.
#
# **Le carré ne change jamais de taille, et c'est la règle des vrais jeux 2D**
# (`docs/bilan-v3.md` § 3). Ce qui change entre un personnage et un bâtiment est
# le *nombre* de carrés qu'il couvre, jamais leur dimension : deux tailles de
# pixel dans une même scène — des « mixels » — se voient immédiatement, parce
# que l'œil compare les bords. La taille de tuile est une propriété du jeu, pas
# de l'objet, et les trois réglages que réclame un moteur le confirment.
#
# **Donc l'occupation reste, et c'est son plafond qui tombe.** Elle disait déjà
# la bonne chose — une hauteur relative au personnage —, et 300 % se lit « trois
# personnages ». Rien ne se convertit, aucun fichier ne se réécrit, et tout ce
# qui est en dessous de 100 % rend **exactement** l'image d'avant.

# Le côté maximal d'une case, en carrés. **Le plus grand nombre que le produit
# connaisse déjà** — la plus haute finesse de dessin —, plutôt qu'une borne
# inventée pour l'occasion.
CANEVAS_MAX = 2048

# Combien de personnages de haut un sujet peut faire, au plus. **C'est la borne
# du métier, et l'autre est celle de la machine** — les deux sont nécessaires,
# et aucune ne remplace l'autre.
#
# Sans celle-ci, une case de 16 carrés autorisait 12 800 % : cent vingt-huit
# personnages. Physiquement possible, jamais utile, et le curseur de l'écran y
# gagnait **deux mille positions** — de quoi rendre inutilisable le réglage
# qu'on venait d'ouvrir.
#
# **Huit, parce que c'est le nombre juste au-dessus de ce qu'un jeu demande.**
# Un bâtiment de trois étages fait quatre à cinq personnages, un grand arbre
# cinq à six, une porte de ville six à huit. Au-delà on ne fabrique plus un
# sujet mais un fond, et un fond est un décor — il passe par l'homothétie et
# ignore la case.
PERSONNAGES_MAX = 8


def occupation_max(cible: int) -> int:
    """Jusqu'où l'occupation peut monter sur une case de `cible` carrés.

    **Le plafond n'est plus 100 %, et il vient de deux bornes.** Celle du métier
    — huit personnages, `PERSONNAGES_MAX` — et celle de la machine — un canevas
    de `CANEVAS_MAX` carrés. La plus basse des deux gagne : sur une case de 64
    carrés c'est le métier qui borne, à 800 % ; sur une case de 512, c'est le
    canevas, à 400 %.

    **Jamais en dessous de 100 %**, faute de quoi une case déjà plus grande que
    le canevas maximal rendrait un plafond sous le plancher, et l'écran
    n'offrirait plus rien.
    """
    par_le_canevas = round(CANEVAS_MAX / max(1, cible) * 100)
    return max(100, min(100 * PERSONNAGES_MAX, par_le_canevas))


# La borne la plus large qu'une occupation puisse prendre, quelle que soit la
# case. **Elle sert aux corps de route et à rien d'autre** : un corps ne connaît
# pas toujours la cible du projet — celui du barème ne la porte pas —, donc il
# ne peut pas juger le vrai plafond. Il écarte ce qui n'a aucun sens, et le
# service, qui connaît la case, refuse précisément avec le chiffre exact. C'est
# la même répartition que pour la cible : la charge donne la forme, le service
# donne la règle.
OCCUPATION_MAX_ABSOLU = 100 * PERSONNAGES_MAX


def cote_du_sujet(cible: int, occupation: int) -> int:
    """Le côté que le sujet occupera, en carrés. L'arithmétique d'avant, isolée.

    Elle était écrite trois fois — dans le traitement, dans le calibrage, dans
    les positions du curseur — et les trois copies devaient s'accorder au carré
    près, sans quoi le curseur s'arrête là où l'image ne change pas.
    """
    return max(1, round(max(1, cible) * max(1, occupation) / 100))


def cote_du_canevas(cible: int, occupation: int) -> int:
    """Le côté de la boîte qui revient, en carrés.

    **En dessous du personnage, c'est la case du projet ; au-dessus, c'est la
    hauteur demandée.** Les deux formules se rejoignent exactement à 100 %, donc
    il n'y a pas de marche : un sujet passé de 99 à 101 % grandit d'un carré, pas
    d'une forme.

    **Et c'est pour cela que la boîte reste carrée.** Un fichier taillé au ras du
    sujet serait plus léger, mais les images d'une même animation cesseraient de
    se superposer au pixel — le défaut même que la tranche d'animation doit
    réparer (`docs/bilan-v3.md` § 3). Un carré dont le côté suit la hauteur se
    pose tel quel dans un moteur, et son côté reste un multiple entier de la case
    du projet, donc il tombe aussi sur une grille de tuiles.
    """
    return max(max(1, cible), cote_du_sujet(cible, occupation))


@dataclass(frozen=True, slots=True)
class Grille:
    """La remise sur grille — l'étape qui rend le produit possible.

    « Dix modèles sur douze font dériver la taille du pixel d'une étape à
    l'autre » (`docs/ARCHITECTURE.md` §4 bis). Sans cette étape, les frames d'un
    même personnage ne partagent plus le même pixel, et un petit objet ressort
    plus grossier que le personnage qui le porte (US-62).

    `cible` est **demandée, jamais déduite de l'image reçue** (US-61). Elle se
    choisit à la main dans cette tranche ; en T4 elle devient une propriété du
    projet, imposée à tout ce qui rentre.

    `occupation` est la part de la case que le sujet remplit. C'est elle, et non
    la taille de l'image d'origine, qui met un tonneau et un personnage à la même
    échelle de pixel.

    **Elle peut désormais passer 100 %**, et c'est ce qui ouvre les bâtiments,
    les arbres et les tours : 300 % se lit *trois personnages de haut*, et la
    boîte grandit d'autant au lieu de rogner le sujet. Voir `cote_du_canevas`.
    """

    cible: int = 64  # côté de la case, en pixels logiques
    occupation: int = 100  # % de la case rempli par le sujet — au-delà de 100, le sujet dépasse la case
    ancrage: str = BAS

    # ── Le décalage horizontal, arrivé en E17 ────────────────────────────────
    #
    # **La case centre le sujet sur sa boîte, et ça ne se réglait pas.** Mesuré
    # le 30 août 2026 : un bras qui sort de 160 pixels déplace le corps de six
    # pixels dans une case de soixante-quatre, *même quand la taille, elle, n'a
    # pas bougé*. Superposer les poses rend cette dérive parfaitement visible ;
    # sans ce champ, l'outil la montrerait sans pouvoir y toucher — et **montrer
    # un défaut auquel on ne peut pas toucher est pire que de ne pas le
    # montrer**.
    #
    # **En pixels de la case, et c'est une coordonnée, pas un réglage.** Il se
    # comporte comme la boîte tracée du recadrage : il ne part donc pas dans une
    # recette nommée — même règle, rien de neuf à comprendre. Zéro par défaut,
    # de sorte qu'une recette sans calibrage rend exactement l'image d'avant.
    #
    # **C'est le seul ajout de la V2.1 à la recette d'une image**, et il est
    # écrit par le calibrage seul.
    decalage: int = 0

    # ── La méthode de réduction, arrivée en D2 ───────────────────────────────
    #
    # **Comment on passe de mille pixels à `cible` carrés.** Jusqu'ici la
    # question n'existait pas : l'atelier réduisait au plus proche voisin, sans
    # que rien ne le dise ni ne permette d'en changer. C'était donc un choix de
    # style pris dans le code, et le plus brutal des quatre.
    #
    # **`proche` par défaut, et c'est voulu.** Une recette écrite avant D2 n'a
    # pas cette clé ; elle retombe ici, donc elle rend au pixel près l'image
    # qu'elle rendait. Les recettes fabriquées à neuf reçoivent, elles, le choix
    # du projet — `Univers.methode_pixels`, livré sur « vote en deux temps ».
    methode: str = AU_PLUS_PROCHE

    @property
    def cote_sujet(self) -> int:
        """Le côté du sujet dans la boîte, en carrés."""
        return cote_du_sujet(self.cible, self.occupation)

    @property
    def cote_canevas(self) -> int:
        """Le côté de la boîte qui revient, en carrés. Voir `cote_du_canevas`."""
        return cote_du_canevas(self.cible, self.occupation)

    @property
    def en_personnages(self) -> float:
        """La hauteur dite **en personnages** — un moulin à 300 % en fait trois.

        L'auteur a demandé les deux lectures à la fois, le 3 septembre 2026 :
        *« les deux, avec un rappel visuel, une sorte d'échantillon »*. Le
        stockage, lui, n'en garde qu'une — la relative —, et c'est ce qui fait
        qu'un changement de taille de projet emmène tous les types avec lui au
        lieu de les laisser sur place.
        """
        return max(1, self.occupation) / 100

    def en_json(self) -> dict[str, Any]:
        return {
            "cible": self.cible,
            "occupation": self.occupation,
            "ancrage": self.ancrage,
            "decalage": self.decalage,
            "methode": self.methode,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Grille":
        return Grille(
            cible=int(d.get("cible", 64)),
            occupation=int(d.get("occupation", 100)),
            ancrage=d.get("ancrage", BAS),
            decalage=int(d.get("decalage", 0) or 0),
            methode=methode_connue(d.get("methode", AU_PLUS_PROCHE)),
        )


# ── L'échange de couleurs (B17) ──────────────────────────────────────────────
#
# **Une paire nomme deux couleurs, elle n'en calcule aucune.** C'est la règle que
# la planche des couleurs pose déjà pour la fusion de deux palettes — *chacune
# est authentiquement une couleur de l'une des deux sources, jamais une moyenne
# inventée*. Ici elle a une seconde conséquence, et c'est le critère de la
# tranche : trois pèlerins qui ne diffèrent que par la cape sortent **au pixel
# près la même silhouette**, ce qu'une génération ne rend jamais.

TOLERANCE_ECHANGE_MAX = 255


@dataclass(frozen=True, slots=True)
class Echange:
    """*Cette couleur-ci devient celle-là.*

    **La tolérance est sur la paire, pas sur la table** (B17), et la planche le
    demande en toutes lettres : *« elle se règle à chaque clic — un halo flou
    demande plus, un aplat net demande moins »*. Une cape qui porte quatre bruns
    se dit donc en quatre paires exactes, ou en une seule paire large ; le
    produit n'oblige ni à l'un ni à l'autre.

    **Zéro veut dire exactement cette couleur-là**, et c'est le défaut : après la
    quantification les couleurs sont finies et connues, et viser à côté n'a plus
    de sens.
    """

    depuis: str = ""
    vers: str = ""
    tolerance: int = 0

    def en_json(self) -> dict[str, Any]:
        return {"depuis": self.depuis, "vers": self.vers, "tolerance": self.tolerance}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Echange":
        return Echange(
            depuis=str(d.get("depuis", "")),
            vers=str(d.get("vers", "")),
            tolerance=int(d.get("tolerance", 0)),
        )


# Les bornes des quatre curseurs. La luminosité, le contraste et la saturation
# se disent en pour-cent d'écart au neutre ; la teinte se dit en degrés sur la
# roue, et un demi-tour dans chaque sens en fait le tour entier.
CURSEUR_MIN, CURSEUR_MAX = -100, 100
TEINTE_MIN, TEINTE_MAX = -180, 180


@dataclass(frozen=True, slots=True)
class Quantification:
    """Ramener l'image sur un nombre fini de couleurs.

    **Livrée branchée et grisée** en T2 : elle a besoin d'une palette, et la
    palette se déduit des artworks officiels du projet, qui arrivent en T4
    (`docs/archive/plan-versions-tenues.md`, US-65). `palette` vide veut dire « déduite de l'image
    elle-même » — ce que le service refuse à l'écran, et ce dont l'essai de
    comparaison se sert, lui, pour mesurer ce que le post-traitement rapporte.

    **Elle porte les six réglages de la table *Couleurs*, et pas seulement la
    réduction** (B17). Les quatre curseurs et la table d'échange sont rangés ici
    parce que la planche `atelier-couleurs.dc.html` les range dans cette
    table-là — et parce qu'une place de plus aurait fait mentir les dix-sept
    phrases du dépôt qui citent un rang (`docs/PIEGES.md:1140`).

    **Les deux moments de la table.** Les curseurs passent *avant* la réduction,
    l'échange *après*, et l'écart est la moitié de leur raison d'être : un
    curseur posé après repeindrait 24 couleurs choisies avec soin, un échange
    posé avant serait défait par la réduction qui le renverrait au plus proche.
    `queue` les applique dans cet ordre-là et un essai le tient.
    """

    couleurs: int = 32
    palette: tuple[str, ...] = ()  # hex, vide = déduite de l'image
    tramage: str = AUCUN  # "aucun" | "floyd"

    # ── Les six réglages neufs de B17 ────────────────────────────────────────
    #
    # **Aucun ne s'écrit tant qu'il vaut son neutre**, et c'est la règle de `B1`
    # descendue d'un cran : elle valait pour *une place neuve*, elle vaut ici
    # pour *une clé neuve dans une place existante*. Sans elle, les seize
    # recettes du corpus figé qui portent une quantification auraient toutes
    # changé d'empreinte, donc de nom de rendu, et tout leur cache se serait
    # recalculé pour six réglages qu'aucune ne pose.
    luminosite: int = 0
    contraste: int = 0
    saturation: int = 0
    teinte: int = 0
    echanges: tuple[Echange, ...] = ()

    @property
    def curseurs_neutres(self) -> bool:
        """Les quatre curseurs sont-ils tous au repos ?

        **Neutre veut dire sans effet, pas presque sans effet** — la promesse de
        la veille (U4), au cran du réglage. Une image dont les quatre curseurs
        sont à zéro sort à l'octet près comme si la tranche n'existait pas, et
        c'est cette lecture-là qui l'assure, une seule fois, pour le traitement
        comme pour l'écran.
        """
        return not (self.luminosite or self.contraste or self.saturation or self.teinte)

    @property
    def echanges_vifs(self) -> tuple[Echange, ...]:
        """Les paires qui nomment **leurs deux couleurs**, et elles seules.

        C'est la seule lecture de « quels échanges agissent », et elle sert aux
        deux bouts : le moteur applique celles-là, et l'empreinte n'écrit
        que celles-là. Une paire à moitié nommée est un état de passage — le
        temps d'aller chercher la seconde couleur — et un état de passage qui
        changerait l'empreinte ferait recalculer tout le rendu d'une image pour
        un réglage qui ne fait rien.
        """
        return tuple(e for e in self.echanges if e.depuis and e.vers)

    def en_json(self) -> dict[str, Any]:
        vifs = self.echanges_vifs
        return {
            "couleurs": self.couleurs,
            "palette": list(self.palette),
            "tramage": self.tramage,
            # ── Les clés neuves ne s'écrivent que remplies (B17, d'après B1) ──
            **({"luminosite": self.luminosite} if self.luminosite else {}),
            **({"contraste": self.contraste} if self.contraste else {}),
            **({"saturation": self.saturation} if self.saturation else {}),
            **({"teinte": self.teinte} if self.teinte else {}),
            **({"echanges": [e.en_json() for e in vifs]} if vifs else {}),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Quantification":
        return Quantification(
            couleurs=int(d.get("couleurs", 32)),
            palette=tuple(d.get("palette", ())),
            tramage=d.get("tramage", AUCUN),
            # **Absente veut dire neutre** (B17), le pendant exact de « absente
            # veut dire vide » que `B1` a posé pour le retournement : une recette
            # écrite avant la tranche se relit sans rien perdre et se réécrit à
            # l'identique, caractère pour caractère.
            luminosite=int(d.get("luminosite", 0)),
            contraste=int(d.get("contraste", 0)),
            saturation=int(d.get("saturation", 0)),
            teinte=int(d.get("teinte", 0)),
            echanges=tuple(
                Echange.depuis_json(e)
                for e in (d.get("echanges") or ())
                if isinstance(e, dict)
            ),
        )


# Trois passes de décrochage suffisent à ronger un sujet de 64 carrés jusqu'à
# lui retirer ses angles ; la planche `atelier-nettoyer.dc.html` borne le réglage
# là et dit pourquoi — *« à 3, sur un visage de 8 px, le nez disparaît »*.
LISSAGE_MAX = 3

# Un pixel a huit voisins, donc huit compagnons possibles. Au-delà, le réglage
# emporterait tout pixel entouré, aplats compris — ce n'est plus un nettoyage.
GRAIN_MAX = 8


@dataclass(frozen=True, slots=True)
class Bords:
    """Ce qui traîne autour du sujet une fois le sujet à sa taille définitive.

    *A cessé d'être « le dernier mot » le 31 août 2026* : deux places se posent
    après elle depuis E5, et elle garde son rang — les miettes partent **avant**
    qu'un contour ne les entoure, sinon trois taches de six pixels rendraient
    trois pâtés que personne n'a dessinés.

    **Elle nettoie deux choses depuis B17, et pas la même** : `aire_min` compte
    des taches dans la **silhouette**, `grain_min` compte des **couleurs**. La
    planche `atelier-nettoyer.dc.html` l'appelle le réglage *ce qu'on nettoie*,
    et note que le produit ne savait faire que la première — *« un pixel vert vif
    au milieu de la robe brune : rien ne le voit »*.
    """

    aire_min: int = 0  # taches plus petites que ça : effacées

    # ── Les deux réglages neufs de B17 ───────────────────────────────────────
    #
    # **Ils ne s'écrivent que posés**, comme les six de la quantification et pour
    # la même raison : sept recettes du corpus figé portent une place `bords`, et
    # aucune ne les pose.

    # **Le jumeau de `aire_min`, pour la couleur au lieu de la silhouette.**
    # `aire_min` compte des taches dans l'alpha : un pixel vert vif au milieu
    # d'une robe brune est opaque et collé au sujet, il n'est aucune tache, et
    # aucune valeur de ce curseur-là ne l'a jamais attrapé. Celui-ci compte des
    # **grains de couleur** : combien des huit voisins d'un pixel portent sa
    # teinte. Zéro éteint le moteur ; à 1, un pixel dont aucun voisin ne porte sa
    # couleur s'en va — à 2, celui qui n'en a qu'un. Deux pixels verts côte à
    # côte se portent l'un l'autre et survivent : *un détail a un compagnon, une
    # poussière n'en a pas.*
    grain_min: int = 0

    # **Les dents en diagonale, décrochées une passe à la fois.** Un pixel qui ne
    # tient au sujet que par un coin s'en va ; un pixel qui tient par un côté ne
    # bouge jamais. Zéro à trois passes, et la planche prévient de la troisième :
    # *« à 3, le sujet s'arrondit et perd ses angles vifs »*.
    lissage: int = 0

    def en_json(self) -> dict[str, Any]:
        return {
            "aire_min": self.aire_min,
            **({"grain_min": self.grain_min} if self.grain_min else {}),
            **({"lissage": self.lissage} if self.lissage else {}),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Bords":
        return Bords(
            aire_min=int(d.get("aire_min", 0)),
            grain_min=int(d.get("grain_min", 0)),
            lissage=int(d.get("lissage", 0)),
        )


# ── Le contour ───────────────────────────────────────────────────────────────
#
# **La panne qu'il répare, et c'est elle qui décide de son rang.** La mise sur
# grille mange les contours fins : réduire au plus proche voisin garde une ligne
# d'un pixel là où elle tombe sur un centre de bloc et la perd ailleurs. Ce qui
# reste n'est pas un contour absent — ce qui serait franc — mais un contour
# *troué*, qui se voit et ne se rattrape pas.
#
# Retracé **après** la grille, le trait est régulier par construction : plus
# aucun rééchantillonnage derrière pour le casser. Et **après la
# quantification**, pour que sa couleur soit exactement celle qu'on a choisie —
# un noir pur tracé avant ressortirait au plus proche de la palette,
# c'est-à-dire peut-être pas noir.

DEHORS = "externe"
DEDANS = "interne"
# Même valeur que l'ancrage `CENTRE` ci-dessus, et ce n'est pas la même chose :
# l'un dit où le sujet se pose dans sa case, l'autre où le trait se pose sur le
# bord. Deux champs, deux domaines ; le mot est celui de l'écran dans les deux.
A_CHEVAL = "centre"
POSITIONS = (DEHORS, DEDANS, A_CHEVAL)

# Un trou de la silhouette — une boucle de ceinture, l'espace entre un bras et
# un torse — est un bord du sujet exactement comme le pourtour. `cercles` les
# traite comme tels, ce que fait un style « contour noir 2 px » ; `laisses` ne
# trace que le pourtour extérieur, pour les styles qui veulent une découpe nette
# sans lignes à l'intérieur.
CERCLES = "cercles"
LAISSES = "laisses"
TROUS = (CERCLES, LAISSES)

# Au-delà, ce n'est plus un contour, c'est un cadre — et il vaut mieux le
# dessiner à la main. Ce n'est pas une limite technique.
EPAISSEUR_MAX = 8


@dataclass(frozen=True, slots=True)
class Contour:
    """La sixième place — le trait de bord, retracé (E5, US-205).

    `epaisseur` est **en pixels de l'image rendue**, seule unité qui ne mente
    pas : une fois la grille posée, l'image rendue *est* la case, et un pixel
    d'image y est un bloc du sprite. Sans grille, ce sont les pixels de l'image
    telle qu'elle est.

    `position` est le seul réglage du produit qui change les dimensions du rendu
    sans qu'on le lui ait demandé — d'où US-206, qui exige que l'écran l'écrive
    au moment du choix. `externe` est le défaut parce qu'**agrandir est
    réversible et manger le sujet ne l'est pas** ; c'est aussi pourquoi, à
    cheval, le pixel impair va vers l'extérieur.
    """

    epaisseur: int = 1
    couleur: str = "#000000"
    position: str = DEHORS
    trous: str = CERCLES

    @property
    def parts(self) -> tuple[int, int]:
        """Ce qui déborde, et ce qui mange — en pixels, dans cet ordre.

        À cheval, la moitié qui ne tombe pas juste va **dehors** : c'est la
        conséquence directe du défaut, et elle se lit sur l'agrandissement que
        l'écran annonce plutôt que de se deviner.
        """
        epaisseur = max(1, min(EPAISSEUR_MAX, self.epaisseur))
        if self.position == DEDANS:
            return 0, epaisseur
        if self.position == A_CHEVAL:
            dehors = (epaisseur + 1) // 2
            return dehors, epaisseur - dehors
        return epaisseur, 0

    def en_json(self) -> dict[str, Any]:
        return {
            "epaisseur": self.epaisseur,
            "couleur": self.couleur,
            "position": self.position,
            "trous": self.trous,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Contour":
        return Contour(
            epaisseur=int(d.get("epaisseur", 1)),
            couleur=str(d.get("couleur") or "#000000"),
            position=str(d.get("position") or DEHORS),
            trous=str(d.get("trous") or CERCLES),
        )


# ── Le retournement ──────────────────────────────────────────────────────────
#
# **La panne qu'il répare se compte en dollars.** Un personnage vu de dessus se
# dessine dans quatre directions ; celui qui marche vers l'ouest est le miroir
# exact de celui qui marche vers l'est, au pixel près. Jusqu'à B1 le produit
# n'avait aucune façon de le dire, donc les deux se payaient — et le second
# revenait rarement identique au premier, parce qu'une génération ne rend jamais
# deux fois la même image. Le miroir, lui, ne réinvente aucun pixel : c'est le
# même tableau, colonnes dans l'autre ordre.
#
# **Un seul sens en B1**, et les neuf autres moteurs — haut-bas, quarts de tour,
# demi-tour, diagonale, repli, zones protégées, rotation libre, RotSprite —
# viennent en B18. La liste est déclarée ici plutôt qu'à l'écran pour la raison
# de `MOTEURS` et de `TRAMAGES` : ce qui figure dans une recette enregistrée est
# ce que le traitement sait appliquer, et pas un cran de plus.

GAUCHE_DROITE = "gauche-droite"
SENS = (GAUCHE_DROITE,)


@dataclass(frozen=True, slots=True)
class Retournement:
    """La septième place — le miroir, et pour l'instant un seul (B1).

    **Un sens, et rien d'autre.** Ce qui pourrait s'y ajouter — les zones
    protégées (« miroir, sauf ici »), le raccord, l'axe du repli, le
    retournement d'un lot — est hors de cette tranche, et l'écrire d'avance
    ferait figurer dans les recettes du disque des réglages que personne
    n'applique : très exactement la faute de `bayer`, écrit puis retiré le jour
    même faute d'être rendu.

    **Un sens inconnu ne retourne rien, et ne lève pas** — même règle que
    `durcissement_livre` et `methode_connue` : le domaine relit des fichiers, il
    ne juge pas. Une recette écrite par une version qui connaît les neuf autres
    sens doit continuer de s'ouvrir ici, en rendant l'image telle quelle.
    """

    sens: str = GAUCHE_DROITE

    def en_json(self) -> dict[str, Any]:
        return {"sens": self.sens}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Retournement":
        return Retournement(sens=str(d.get("sens") or GAUCHE_DROITE))


# ── La main ──────────────────────────────────────────────────────────────────
#
# **La huitième et dernière place, et c'est ce qui la définit** : elle porte sur
# l'image telle qu'elle partira dans le jeu. Rien ne se rejoue après elle, sans
# quoi la machine effacerait ce qu'une main vient de poser.
#
# Là où les sept autres places appliquent une règle à toute l'image, celle-ci ne
# fait que ce que l'auteur désigne. La panne qu'elle répare n'a pas d'autre
# remède : **les trois pixels qu'aucun réglage n'atteint** — un coin de fond
# collé au sujet, une dent dans un contour, une miette accrochée à la
# silhouette.


@dataclass(frozen=True, slots=True)
class CalqueDessin:
    """Un calque de dessin — de la matière posée par-dessus (US-208).

    Nommable, masquable, supprimable, déplaçable dans l'ordre. `visible` faux
    n'efface rien : le calque garde ses passages et cesse simplement d'être
    appliqué, ce qui est très exactement la différence entre masquer et
    supprimer.

    **Il n'y a pas de liste de passages à l'écran, et c'est voulu** : un geste à
    main levée en produit des dizaines, et trente rangées ne se relisent pas.
    Le calque est l'unité de lecture ; le passage n'existe que comme un compte
    et un Ctrl+Z.
    """

    nom: str = ""
    visible: bool = True
    passages: tuple[Trait, ...] = ()

    def en_json(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "visible": self.visible,
            "passages": [p.en_json() for p in self.passages],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "CalqueDessin":
        return CalqueDessin(
            nom=str(d.get("nom") or ""),
            visible=bool(d.get("visible", True)),
            passages=traits_depuis_json(d.get("passages")),
        )


@dataclass(frozen=True, slots=True)
class Main:
    """La pile de la huitième place : un sol, et ce qu'on empile dessus.

    **L'opacité est le sol, et elle est d'une autre nature.** Elle ne pose
    aucune couleur : elle décide de ce qui est là, sur l'image que les six
    tables précédentes ont produite — `garde` vrai remet, `garde` faux ôte. Elle
    est un champ à part plutôt qu'un calque marqué, et c'est ce qui rend « elle
    ne se supprime pas et ne se déplace pas » vrai **par construction** au lieu
    d'être une règle à tenir.

    `calques` est rangé **du dessous vers le dessus, dans l'ordre où on
    l'applique** — l'ordre du fichier est l'ordre d'exécution, comme pour les
    huit places elles-mêmes. L'écran, lui, montre la pile du dessus au dessous,
    comme partout où il y a des calques ; c'est un renversement d'affichage, et
    il est écrit là où il se fait.
    """

    opacite: tuple[Trait, ...] = ()
    calques: tuple[CalqueDessin, ...] = ()

    @property
    def vide(self) -> bool:
        """La main a-t-elle posé quelque chose ?

        Un calque nommé mais sans passage ne change pas l'image : le carré de la
        barre reste creux, parce que *le carré se remplit quand la place change
        l'image, pas quand elle figure dans la recette*. Le calque, lui, est
        gardé — on l'a créé exprès.
        """
        return not self.opacite and not any(c.passages for c in self.calques)

    @property
    def passages(self) -> int:
        """Le total de la table, tous calques confondus.

        Il ne dit pas ce qu'ils font — un passage peut en effacer un autre —, et
        c'est pour ça qu'il s'écrit à côté du nombre de calques et jamais à sa
        place.
        """
        return len(self.opacite) + sum(len(c.passages) for c in self.calques)

    def en_json(self) -> dict[str, Any]:
        return {
            "opacite": [t.en_json() for t in self.opacite],
            "calques": [c.en_json() for c in self.calques],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Main":
        calques = d.get("calques")
        return Main(
            opacite=traits_depuis_json(d.get("opacite")),
            calques=tuple(
                CalqueDessin.depuis_json(c)
                for c in (calques if isinstance(calques, (list, tuple)) else ())
                if isinstance(c, dict)
            ),
        )


@dataclass(frozen=True, slots=True)
class Recette:
    """Huit places nommées, dans un ordre qui ne se négocie pas.

    *Six jusqu'au 31 août 2026 ; le contour et la main sont arrivées avec E5, et
    par le même raisonnement que les cinq premières* — chacune n'a de sens
    qu'après celle qui la précède, et la dernière n'en a qu'à la toute fin. *Le
    retournement est arrivé avec B1*, en avant-dernier, et il est la seule place
    dont la clé ne s'écrit pas quand elle est vide — voir `en_json`.
    """

    passes: tuple[Passe, ...] = ()

    # **En seconde place, et arrivée après les cinq autres.** Une place de plus
    # change l'empreinte de toutes les recettes déjà écrites : chaque rendu se
    # recalcule une fois, ce qui est très exactement ce qu'un cache est censé
    # supporter (« effacer le rendu ne perd rien »). La déclarer en queue pour
    # épargner ce recalcul aurait rangé l'ordre d'exécution ailleurs que dans
    # l'ordre du fichier, et c'est cet accord-là qui rend la règle lisible.
    difference: Difference | None = None

    recadrage: Recadrage | None = None
    grille: Grille | None = None
    quantification: Quantification | None = None
    bords: Bords | None = None

    # **Les trois dernières places, dans l'ordre où elles s'appliquent.** Le
    # contour se trace sur la silhouette définitive et dans les couleurs
    # définitives ; le retournement passe après lui, sur l'image finie ; la main
    # passe après tout — c'est même son usage le plus fréquent, reprendre la
    # dent que le trait vient de laisser.
    contours: "Contour | None" = None
    retournement: "Retournement | None" = None
    main: "Main | None" = None

    # **Les places endormies** (U4, `US-334` à `US-339`, 1<sup>er</sup> septembre
    # 2026). Une place en veille garde tous ses réglages et cesse d'agir sur
    # l'image : c'est l'exact contraire de la vider, et **éteinte et vide sont
    # deux états**. Sans quoi on ne pouvait essayer une image sans une place
    # qu'en retapant ses réglages ensuite.
    #
    # **Un champ de la recette, pas un état d'écran**, et le prix est nommé :
    # elle entre dans l'empreinte — donc elle refait le rendu —, elle voyage
    # avec le reste, et l'agent la lit et la pose comme n'importe quel autre
    # réglage. Ce qu'elle promet en échange : *une image traitée avec une place
    # en veille sort identique au pixel près à la même sans cette place du
    # tout.* Endormie veut dire sans effet, pas presque sans effet.
    #
    # **Un ensemble de noms de places, et jamais un drapeau par place.** Sept
    # booléens auraient demandé sept champs de sérialisation, sept valeurs par
    # défaut et sept lignes de traitement ; une liste de noms en demande une, et
    # elle est vide dans l'immense majorité des recettes — donc elle ne pèse
    # rien dans l'empreinte de celles qui ne s'en servent pas.
    veille: tuple[str, ...] = ()

    nom: str | None = None  # une recette nommée est une recette (US-66)

    # ── Ce qu'elle est ───────────────────────────────────────────────────────

    @property
    def vide(self) -> bool:
        """Rien à faire : le rendu **est** le brut, et il n'y a pas de cache.

        ⚠️ **Une place compte quand elle change l'image, pas quand elle figure
        dans la recette** (invariant E3). Le carré de la barre tient cette règle
        depuis toujours ; cette propriété-ci ne la tenait pas, et le nettoyage
        l'a montré (`B16`).

        `bords={aire_min: 0}` est le cas exact : `nettoyer` sort sans rien faire
        (`traitement.py:1107`), et pourtant la recette se disait non vide — donc
        un rendu calculé, mis en cache, et l'asset **épinglé** pour une image
        identique au brut. Un seuil de zéro n'efface aucune tache ; il ne pose
        rien non plus.

        **Ce n'est pas la veille**, et les deux gestes restent distincts :
        endormir garde la valeur et la rend au réveil, tandis qu'ici c'est la
        valeur elle-même qui ne fait rien.
        """
        return not (
            self.passes
            or self.difference
            or self.recadrage
            or self.grille
            or self.quantification
            or (self.bords is not None and self.bords.aire_min > 0)
            or self.contours
            or self.retournement
            or self.main
        )

    @property
    def miroir(self) -> bool:
        """Cette recette retourne-t-elle l'image ?

        **C'est la recette qui dit ce qu'une image est**, et rien d'autre : il
        n'existe nulle part un drapeau « ceci est un miroir » à tenir d'accord
        avec le disque — c'est le raisonnement de `calque` juste en dessous,
        repris mot pour mot parce que c'est le même. Un champ sur l'`Asset`
        aurait été une seconde vérité, et elle se serait démentie au premier
        retournement retiré à la table.

        **Endormie, la place ne compte pas** : une image dont le retournement
        dort sort telle qu'elle est entrée, et une étiquette qui dirait
        « miroir » devant une image non retournée serait un effet resté en
        travers.

        L'étiquette *miroir · gratuit · instantané* se lit sur ce fait **et** sur
        `consomme == 0`. Une image générée sur laquelle l'auteur pose ensuite un
        miroir garde son étiquette *générée · prix · temps* : elle a coûté, et
        l'étiquette dit ce qui a été payé.
        """
        return self.retournement is not None and not self.dort(RETOURNEMENT)

    @property
    def calque(self) -> bool:
        """Cette recette fabrique-t-elle un calque ?

        **C'est la recette qui dit ce qu'une image est**, et rien d'autre : il
        n'existe nulle part un drapeau « ceci est un calque » à tenir d'accord
        avec le disque. Une case revenue d'une planche d'équipement sans
        différence est un **corps habillé** — la même image, gardée, mais qui ne
        s'empile pas (US-148).
        """
        return self.difference is not None

    def empreinte(self) -> str:
        """Ce qui nomme un rendu. Le nom de la recette n'y entre pas.

        C'est cette empreinte qui tient deux critères d'un coup : « supprimer le
        fichier de rendu ne perd rien » — il se recalcule — et « une recette
        nommée, réappliquée ailleurs, donne exactement le même résultat » — deux
        recettes égales ont la même empreinte, donc le même calcul.
        """
        canonique = json.dumps(
            self.sans_nom().en_json(), sort_keys=True, ensure_ascii=False
        )
        return hashlib.sha256(canonique.encode("utf-8")).hexdigest()[:16]

    def empreinte_passes(self) -> str:
        """Ce qui nomme le **détourage seul**, et lui seul.

        Le détourage coûte cent fois plus que tout ce qui le suit — mesuré le
        27 août 2026 : 130 ms contre 28 ms sur une image de 1024 px. Or c'est la
        première étape, et les quatre autres sont celles qu'on fait glisser. La
        garder à part permet de ne la refaire que quand elle change, et c'est ce
        qui tient « chaque réglage répond sans attente perceptible ».
        """
        canonique = json.dumps([p.en_json() for p in self.passes], sort_keys=True)
        return hashlib.sha256(canonique.encode("utf-8")).hexdigest()[:16]

    def sans_nom(self) -> "Recette":
        return replace(self, nom=None)

    # ── Sérialisation ────────────────────────────────────────────────────────

    def en_json(self) -> dict[str, Any]:
        return {
            "passes": [p.en_json() for p in self.passes],
            "difference": self.difference.en_json() if self.difference else None,
            "recadrage": self.recadrage.en_json() if self.recadrage else None,
            "grille": self.grille.en_json() if self.grille else None,
            "quantification": (
                self.quantification.en_json() if self.quantification else None
            ),
            "bords": self.bords.en_json() if self.bords else None,
            "contours": self.contours.en_json() if self.contours else None,
            # ── La clé neuve ne s'écrit que si la place est remplie (B1) ──────
            #
            # **Les huit clés qui l'entourent s'écrivent toujours, `null`
            # compris, et elles ne bougent pas d'un caractère.** Une neuvième
            # écrite à `null` partout changerait le JSON canonique de *toutes*
            # les recettes déjà sur le disque, donc leur empreinte, donc le nom
            # de leur rendu : les 61 recettes distinctes relevées dans le dépôt
            # le 6 septembre 2026 auraient toutes été recalculées, pour un champ
            # qu'aucune ne porte.
            #
            # Écrite seulement quand elle est remplie, elle laisse le canonique
            # d'une recette sans retournement **strictement identique** à celui
            # d'avant la tranche. `tests/test_b1.py` le tient sur le corpus figé
            # (`tests/recettes-avant-b1.json`).
            #
            # **La règle vaut pour cette clé-là, et pas pour les huit autres** :
            # retirer leurs `null` serait très exactement le recalcul qu'on
            # évite ici, en plus grand.
            **(
                {"retournement": self.retournement.en_json()}
                if self.retournement is not None
                else {}
            ),
            "main": self.main.en_json() if self.main else None,
            # **Triée, toujours** (U4). L'empreinte est le JSON canonique de la
            # recette : deux recettes qui endorment les mêmes places dans un
            # ordre différent doivent rendre la même empreinte, sinon un collage
            # ferait recalculer un rendu déjà en cache.
            "veille": sorted(self.veille),
            "nom": self.nom,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Recette":
        if not d:
            return Recette()
        return Recette(
            passes=tuple(Passe.depuis_json(p) for p in d.get("passes", ())),
            difference=(
                Difference.depuis_json(d["difference"]) if d.get("difference") else None
            ),
            recadrage=(
                Recadrage.depuis_json(d["recadrage"]) if d.get("recadrage") else None
            ),
            grille=Grille.depuis_json(d["grille"]) if d.get("grille") else None,
            quantification=(
                Quantification.depuis_json(d["quantification"])
                if d.get("quantification")
                else None
            ),
            bords=Bords.depuis_json(d["bords"]) if d.get("bords") else None,
            contours=Contour.depuis_json(d["contours"]) if d.get("contours") else None,
            # **Absente veut dire vide** (B1), et c'est ce qui fait qu'une
            # recette écrite avant la tranche se relit sans rien perdre : elle
            # n'a pas la clé, elle n'a pas la place, et elle se réécrit à
            # l'identique.
            retournement=(
                Retournement.depuis_json(d["retournement"])
                if d.get("retournement")
                else None
            ),
            main=Main.depuis_json(d["main"]) if d.get("main") else None,
            # **Ce qui n'est pas une place connue tombe** (U4). Une recette
            # écrite par un agent, ou relue d'un disque plus vieux que ce champ,
            # ne doit pas pouvoir endormir une place qui n'existe pas : le nom
            # se perdrait en silence et ferait croire à un réglage posé. Le
            # domaine ne lève pas ici — il relit un fichier —, c'est la route
            # qui refuse un nom inconnu, avec sa raison.
            veille=tuple(
                sorted({p for p in d.get("veille") or () if p in PLACES})
            ),
            nom=d.get("nom"),
        )

    # ── La veille ────────────────────────────────────────────────────────────

    def dort(self, place: str) -> bool:
        """Cette place-là est-elle endormie ?

        **Une seule lecture pour tout le dépôt** — le traitement, l'écran de la
        barre, les mesures et l'agent posent tous la même question, et une
        seconde façon de la poser finirait par répondre autrement.
        """
        return place in self.veille

    def endormie(self, place: str, dort: bool) -> "Recette":
        """La même recette, cette place-là endormie ou réveillée.

        **Elle ne vide rien** : c'est toute la différence avec *Sans cette
        table ›*, qui existe au pied de chaque colonne. Une place en veille
        reste écrite avec toutes ses valeurs, et on la retrouve telle quelle en
        la rallumant.
        """
        if place not in PLACES:
            return self
        restantes = {p for p in self.veille if p != place}
        if dort:
            restantes.add(place)
        return replace(self, veille=tuple(sorted(restantes)))

    # ── Les passes qui agissent (U10) ────────────────────────────────────────

    def passes_vives(self) -> tuple["Passe", ...]:
        """Les passes qui **font** quelque chose — ni masquées, ni endormies.

        **Une seule lecture pour tout le dépôt**, exactement comme `dort` : le
        traitement, la remise sur grille, la mesure des poches, la découpe et la
        superposition posent tous la même question, et c'est la question qui a
        fui deux fois en U4 quand chacun la posait à sa façon. Ce qui compte
        n'est jamais *une passe est écrite*, c'est *une passe agit* — et
        `self.passes` répond à la première, celle-ci à la seconde.
        """
        if self.dort(DETOURAGE):
            return ()
        return tuple(p for p in self.passes if not p.masquee)

    # ── La marge que la case avale (B16) ─────────────────────────────────────

    def marge_sans_effet(self) -> bool:
        """La marge du recadrage est-elle avalée par la mise en case ?

        **Mesuré le 30 août 2026 : marge 0 et marge 40 rendent le même fichier
        à l'octet près.** La raison n'est pas que la grille ignore la marge —
        `_recadrer` l'applique dans tous les cas — mais que `sur_grille` refait
        *sa propre* recherche de la boîte du sujet et rogne dessus, jetant les
        pixels transparents que la marge venait de garder.

        **Une seule lecture, ici, parce que l'écran s'était trompé dessus.**
        `Places.tsx` lisait `recette.grille != null`, et cette condition est
        fausse dans trois cas — c'est ce que `B16` a trouvé en relisant
        `traitement.queue` ligne à ligne. La case ne s'applique que si la grille
        est **posée** (`grille is not None`), **éveillée** (`not dort(GRILLE)`,
        `traitement.py:2151`) et que le détourage **agit** (`case =
        bool(passes_vives())`, `traitement.py:2167`) — sans détourage vif,
        `sur_grille` fait une homothétie de l'image entière et la marge change
        bel et bien le rendu.

        Ce qu'elle ne dit pas, et volontairement : *quoi faire à la place*. Le
        geste — « c'est la hauteur qui donne l'air autour du sujet » — porte des
        noms d'écran que le domaine n'a pas à connaître.
        """
        return (
            self.grille is not None
            and not self.dort(GRILLE)
            and bool(self.passes_vives())
        )


# ── Ce qui voyage d'une image à l'autre (U5) ─────────────────────────────────


def voyage(recette: Recette) -> tuple[Recette, tuple[str, ...]]:
    """La même recette, débarrassée de ce qui ne veut rien dire ailleurs.

    **Un réglage voyage, une coordonnée ne voyage pas.** Une tolérance de 28 dit
    la même chose sur n'importe quelle image ; un rectangle tracé à (12, 40) ne
    dit quelque chose que sur *celle-là*. Six attitudes d'un même personnage
    n'ont pas la même silhouette, et un passage de main recopié tomberait à côté
    — sur le bras au lieu du casque. La règle a été tranchée le 1<sup>er</sup>
    septembre 2026 (`docs/prd-decisions.md`, `US-342`), et elle est écrite ici,
    **une fois**, parce qu'elle a trois portes : le collage d'une image à
    l'autre, l'enregistrement d'une recette nommée, et le rappel d'une recette
    nommée écrite avant que la règle existe.

    Rend la recette voyageable **et la liste de ce qui a été laissé**, en clair.
    « Une place privée de ce qui la désignait arrive sans effet et le dit » : le
    dire suppose de le savoir, et le savoir suppose de le rendre — un appelant
    qui recalculerait la liste de son côté serait la seconde implémentation
    qu'on refuse partout ailleurs.

    **Ce qui reste, reste entier.** Le recadrage garde sa marge, la passe garde
    sa tolérance, la grille garde sa case : on ne retire que la coordonnée, pas
    la place qui la portait. Une place qui n'a plus que sa coordonnée arrive
    donc sans effet, ce qui est exactement ce qu'on veut lire.
    """
    laisse: list[str] = []

    # **La différence.** Elle nomme *une autre image précise* — le corps sous le
    # calque. La reposer ailleurs fabriquerait un calque de l'image d'à côté.
    if recette.difference is not None:
        laisse.append("la différence du calque — elle nomme une autre image")

    # **Les points de pipette.** Une passe « couleur » sans point ne ferme rien :
    # elle arrive sans effet, et c'est ce que la ligne dit.
    vises = sum(1 for p in recette.passes if p.point is not None)
    if vises:
        laisse.append(
            f"{vises} point{'s' if vises > 1 else ''} de pipette — "
            "la couleur se vise sur cette image-là"
        )

    # **Les formes tracées** (U12). Même règle, un cran plus loin : un point ne
    # voyage pas, une suite de points encore moins. Une silhouette entourée sur
    # une attitude tomberait sur le bras au lieu du casque à l'attitude d'à
    # côté — c'est la raison qui a déjà retiré les passages de la main.
    entourees = sum(1 for p in recette.passes if p.trace)
    if entourees:
        laisse.append(
            f"{entourees} forme{'s' if entourees > 1 else ''} entourée"
            f"{'s' if entourees > 1 else ''} à la main — "
            "elles suivent la silhouette de cette image-là"
        )
    passes = tuple(replace(p, point=None, trace=()) for p in recette.passes)

    # **Le cadre tracé.** La marge, elle, voyage : c'est un nombre de pixels
    # autour du sujet, et le sujet se remesure sur chaque image.
    recadrage = recette.recadrage
    if recadrage is not None and recadrage.boite is not None:
        laisse.append("le cadre tracé à la main — c'est un rectangle de cette image")
        recadrage = replace(recadrage, boite=None)

    # **Le décalage du calibrage.** Il rattrape la dérive de *cette*
    # silhouette-là dans sa case (E17) ; ailleurs il décale sans raison.
    grille = recette.grille
    if grille is not None and grille.decalage != 0:
        laisse.append("le décalage du calibrage — il rattrape cette silhouette-là")
        grille = replace(grille, decalage=0)

    # **La main.** Le prix nommé de la règle, et il se paie une fois : une
    # recette nommée emportait les passages jusqu'à ce jour. Un calque *nommé*
    # ne se garde pas non plus : sans ses passages il ne serait qu'un titre, et
    # un titre qui arrive avec une recette est une pile qu'on n'a pas demandée.
    main = recette.main
    if main is not None and not main.vide:
        laisse.append(
            f"{main.passages} passage{'s' if main.passages > 1 else ''} de la main "
            "— ils sont posés sur cette silhouette-là"
        )
    if main is not None:
        main = None

    # **Le retournement voyage entier, et il n'y a donc rien à retirer** (B1).
    # Un sens est un réglage : *gauche-droite* dit la même chose sur n'importe
    # quelle image, comme une tolérance de 28. La ligne est écrite quand même,
    # parce que la question se repose à chaque place neuve et qu'une absence de
    # code ne dit pas si elle a été tranchée ou oubliée.

    return (
        replace(
            recette,
            passes=passes,
            difference=None,
            recadrage=recadrage,
            grille=grille,
            main=main,
        ),
        tuple(laisse),
    )
