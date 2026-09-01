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
8. **la main** — la dernière, et rien ne se rejoue après elle : ce qu'une main
   a posé ne doit pas tomber parce que la machine repasse. Arrivée en E5.

Les deux dernières portent le compte à **sept places** — la différence, elle,
n'en est plus une aux yeux du produit : elle nomme deux images en entrée et en
produit une troisième, ce qu'aucune place ne fait, et elle devient une fabrique
en E6. Elle reste ici tant que cette étape-là n'est pas tenue.

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

# ── Les places, nommées une fois (U4) ────────────────────────────────────────
#
# **Les sept places du traitement, dans l'ordre où elles s'appliquent**, plus la
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
LA_MAIN = "main"
PLACES = (
    DETOURAGE,
    DIFFERENCE,
    RECADRAGE,
    GRILLE,
    QUANTIFICATION,
    BORDS,
    CONTOURS,
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
    d'un masque, et celui de l'**opacité** de la septième place, qui décide de
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
    l'image payée » (`docs/PLAN.md`, C3). Il l'est **par construction** : cette
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
    retouche, et inversement » (`docs/PLAN.md`, C4) n'est donc pas une
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


@dataclass(frozen=True, slots=True)
class Recadrage:
    """Sur la boîte opaque, avec une marge. Une boîte explicite l'emporte.

    La boîte explicite n'est pas un réglage d'écran en T2 : c'est par elle que le
    slicer posera ses découpes en T5, et l'écrire ici coûte trois lignes contre
    une reprise de la recette le jour venu.
    """

    marge: int = 0  # en pixels de l'image d'origine
    boite: tuple[int, int, int, int] | None = None

    def en_json(self) -> dict[str, Any]:
        return {"marge": self.marge, "boite": list(self.boite) if self.boite else None}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Recadrage":
        boite = d.get("boite")
        return Recadrage(
            marge=int(d.get("marge", 0)),
            boite=(tuple(int(v) for v in boite) if boite else None),
        )


# Où le sujet se pose dans sa case quand il ne la remplit pas dans les deux sens.
# Le bas par défaut : un personnage se tient debout sur le bord bas de sa case,
# et deux frames posées au centre flotteraient l'une par rapport à l'autre.
BAS = "bas"
CENTRE = "centre"
ANCRAGES = (BAS, CENTRE)

# Les deux tramages, et il n'y en a pas d'autre. **Deux valeurs déclarées, deux
# valeurs implémentées** : `bayer` a été écrit ici puis retiré le jour même, faute
# d'être rendu par la bibliothèque de traitement. Un réglage qui figure dans une
# recette enregistrée et que personne n'applique est un mensonge qui se réveille
# des mois plus tard, au rappel d'une recette nommée.
AUCUN = "aucun"
FLOYD = "floyd"
TRAMAGES = (AUCUN, FLOYD)


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
    """

    cible: int = 64  # côté de la case, en pixels logiques
    occupation: int = 100  # % de la case rempli par le sujet
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

    def en_json(self) -> dict[str, Any]:
        return {
            "cible": self.cible,
            "occupation": self.occupation,
            "ancrage": self.ancrage,
            "decalage": self.decalage,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Grille":
        return Grille(
            cible=int(d.get("cible", 64)),
            occupation=int(d.get("occupation", 100)),
            ancrage=d.get("ancrage", BAS),
            decalage=int(d.get("decalage", 0) or 0),
        )


@dataclass(frozen=True, slots=True)
class Quantification:
    """Ramener l'image sur un nombre fini de couleurs.

    **Livrée branchée et grisée** en T2 : elle a besoin d'une palette, et la
    palette se déduit des artworks officiels du projet, qui arrivent en T4
    (`docs/PLAN.md`, US-65). `palette` vide veut dire « déduite de l'image
    elle-même » — ce que le service refuse à l'écran, et ce dont l'essai de
    comparaison se sert, lui, pour mesurer ce que le post-traitement rapporte.
    """

    couleurs: int = 32
    palette: tuple[str, ...] = ()  # hex, vide = déduite de l'image
    tramage: str = AUCUN  # "aucun" | "floyd"

    def en_json(self) -> dict[str, Any]:
        return {
            "couleurs": self.couleurs,
            "palette": list(self.palette),
            "tramage": self.tramage,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Quantification":
        return Quantification(
            couleurs=int(d.get("couleurs", 32)),
            palette=tuple(d.get("palette", ())),
            tramage=d.get("tramage", AUCUN),
        )


@dataclass(frozen=True, slots=True)
class Bords:
    """Ce qui traîne autour du sujet une fois le sujet à sa taille définitive.

    *A cessé d'être « le dernier mot » le 31 août 2026* : deux places se posent
    après elle depuis E5, et elle garde son rang — les miettes partent **avant**
    qu'un contour ne les entoure, sinon trois taches de six pixels rendraient
    trois pâtés que personne n'a dessinés.
    """

    aire_min: int = 0  # taches plus petites que ça : effacées

    def en_json(self) -> dict[str, Any]:
        return {"aire_min": self.aire_min}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Bords":
        return Bords(aire_min=int(d.get("aire_min", 0)))


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


# ── La main ──────────────────────────────────────────────────────────────────
#
# **La septième et dernière place, et c'est ce qui la définit** : elle porte sur
# l'image telle qu'elle partira dans le jeu. Rien ne se rejoue après elle, sans
# quoi la machine effacerait ce qu'une main vient de poser.
#
# Là où les six autres places appliquent une règle à toute l'image, celle-ci ne
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
    """La pile de la septième place : un sol, et ce qu'on empile dessus.

    **L'opacité est le sol, et elle est d'une autre nature.** Elle ne pose
    aucune couleur : elle décide de ce qui est là, sur l'image que les six
    tables précédentes ont produite — `garde` vrai remet, `garde` faux ôte. Elle
    est un champ à part plutôt qu'un calque marqué, et c'est ce qui rend « elle
    ne se supprime pas et ne se déplace pas » vrai **par construction** au lieu
    d'être une règle à tenir.

    `calques` est rangé **du dessous vers le dessus, dans l'ordre où on
    l'applique** — l'ordre du fichier est l'ordre d'exécution, comme pour les
    sept places elles-mêmes. L'écran, lui, montre la pile du dessus au dessous,
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
    """Sept places nommées, dans un ordre qui ne se négocie pas.

    *Six jusqu'au 31 août 2026 ; le contour et la main sont arrivées avec E5, et
    par le même raisonnement que les cinq premières* — chacune n'a de sens
    qu'après celle qui la précède, et la dernière n'en a qu'à la toute fin.
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

    # **Les deux dernières places, dans l'ordre où elles s'appliquent.** Le
    # contour se trace sur la silhouette définitive et dans les couleurs
    # définitives ; la main passe après tout, y compris après lui — c'est même
    # son usage le plus fréquent, reprendre la dent que le trait vient de
    # laisser.
    contours: "Contour | None" = None
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
        """Rien à faire : le rendu **est** le brut, et il n'y a pas de cache."""
        return not (
            self.passes
            or self.difference
            or self.recadrage
            or self.grille
            or self.quantification
            or self.bords
            or self.contours
            or self.main
        )

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
