# -*- coding: utf-8 -*-
"""Le rangement — deux niveaux, et pas un de plus.

`Projet › Collection › Asset`, et rien d'autre (`docs/ARCHITECTURE.md` §5). Un
troisième niveau se paierait tout de suite en gestes : il faudrait le choisir à
chaque rangement, l'afficher dans l'arbre, le filtrer, et décider ce qu'il
advient de son contenu quand on le supprime.

**Le projet contraint, la collection range.** C'est la différence centrale avec
SpriteCook, où le projet n'est qu'un dossier : depuis T4 le projet porte la
bible, les artworks officiels, la palette, la taille de pixel imposée à tout ce
qui rentre et le barème d'échelles. La collection, elle, ne contraint rien —
elle regroupe.

**Une collection peut n'appartenir à aucun projet.** C'est écrit tel quel dans
le modèle d'objets (« nom, projet optionnel ») et ça sert : « à refaire », « pour
la démo » traversent les univers. Une collection qui appartient à un projet, en
revanche, décide du projet de ce qu'on y range — sinon un asset se retrouverait
dans la collection d'un univers et dans un autre univers.

**L'identifiant est un repère de dossier, pas un tirage au sort.** `donnees/`
s'ouvre à la main : y lire `projets/bac-a-sable/` plutôt que
`projets/9f3c1a…/` est ce qui rend vrai « les fichiers font foi ». Il se dérive
du nom à la création et **ne change plus jamais** — un dossier qui se renomme
sous les fichiers qu'il contient est un déménagement, pas un renommage.
"""

from __future__ import annotations

import hashlib
import re
import time
import unicodedata
from dataclasses import dataclass, field, replace
from typing import Any, Iterable

from atelier.domaine.carte import DECORS, FAMILLES, INTERFACE, OBJETS, PERSONNAGES, TOUS
from atelier.domaine.equipement import (
    Emplacement,
    Piece,
    emplacements_depuis_json,
    pieces_depuis_json,
)
from atelier.domaine.ambiance import Ambiance, Palette
from atelier.domaine.plan import (
    PLAN_PAR_DEFAUT,
    Pose,
    plan_depuis_json,
    plan_du_type,
    suit_le_plan_du_jeu,
)
from atelier.domaine.fond import AUCUN_FOND, fond_valide
from atelier.domaine.teinte import AUCUNE, teinte_valide
from atelier.domaine.direction import Direction, directions_depuis_json
from atelier.domaine.vue import (
    AUCUNE_VUE,
    FINESSE_PAR_DEFAUT,
    FINESSES,
    TAILLES,
    phrase_de_calage,
    phrase_de_grille,
    sans_phrase_du_produit,
    vue as vue_connue,
)
from atelier.domaine.recette import (
    BAS,
    BORD,
    Grille,
    LANCZOS,
    METHODE_LIVREE,
    METHODES_DE_REDUCTION,
    VOTE,
    MOTEURS,
    Passe,
    Quantification,
    Recadrage,
    Recette,
    TACHE,
    methode_connue,
    paliers_de_couleurs,
    passe_livree,
)

# Le projet qui existe déjà au premier lancement (US-2). Ranger reste un geste,
# jamais un préalable : on ne nomme pas un univers avant de savoir ce qu'on
# fabrique. Créer un vrai projet attend qu'on en ressente le besoin (US-5).
NOM_BAC_A_SABLE = "Bac à sable"


# ── La bible ─────────────────────────────────────────────────────────────────
#
# **Sept champs nommés, et pas un texte libre** (`docs/archi-versions.md` §6.1).
# Le texte libre est ce qu'on retape ; les champs nommés sont ce qu'on dose.
# C'est la différence qui rend US-56 possible : chacun s'active indépendamment,
# donc on peut relâcher le trait sans relâcher le monde.
#
# La liste est close et ordonnée ici — elle décide de l'ordre à l'écran comme de
# l'ordre dans le prompt. Un champ de plus se paierait à chaque génération, en
# lecture et en décision ; le PRD écarte déjà « les consignes par type d'asset ».
#
# **Deux champs sont entrés en R2, et la liste reste close** (US-161, US-162).
# `rendu` et `vue` ne sont pas deux libertés de plus : ce sont exactement les
# deux décisions d'apparence que la séance du 28 août 2026 a vues retapées à
# chaque prompt sans avoir où se poser — la technique de rendu et le cadrage.
# Les laisser dans le sujet, c'était laisser le post-traitement décider seul de
# l'apparence du jeu.
#
# **L'ordre va de la fiction au cadre** : ce que le monde est, avec quoi c'est
# dessiné, d'où on le regarde, ce que l'image doit être. `rendu` précède `trait`
# et `eclairage` parce qu'il nomme le médium dont les deux autres sont le
# détail ; `vue` les suit parce qu'elle ne parle plus du dessin mais de la
# caméra ; `technique` ferme, comme avant.

CHAMPS_BIBLE = ("monde", "epoque", "rendu", "trait", "eclairage", "vue", "technique")

# Ce qui précède chaque champ quand la bible part avec l'appel. En anglais : le
# prompt part en anglais chez tous les modèles du catalogue, et c'est une
# traduction de fournisseur — elle ne remonte pas dans le produit.
INTITULES = {
    "monde": "World",
    "epoque": "Era",
    "rendu": "Rendering technique",
    "trait": "Line and shading",
    "eclairage": "Lighting",
    "vue": "View and framing",
    "technique": "Technical constraints",
}


# ── Les deux cases que l'atelier écrit seul ──────────────────────────────────
#
# **Un réglage ne se pose jamais à deux endroits** — la règle de `B14`, et elle
# vaut d'abord ici. `rendu` dit la grille de pixels, `vue` dit la caméra : les
# deux sont **entièrement déterminées** par `style`/`cible_px` et par `vue`, qui
# se choisissent aux étapes 2 et 3 du parcours des règles du jeu. Laisser
# l'auteur écrire dans ces deux cases-là, c'était lui donner un second endroit
# où dire la même chose — et les deux partaient, empilées, dans le même envoi.
#
# **La panne était mesurée, et elle a survécu à sa première réparation.** Le
# 1ᵉʳ septembre 2026, trois prompts réellement payés portaient la caméra deux
# fois (voir `texte_de_la_case`). La réparation d'alors — `_REDITES`, ci-dessous
# — lisait les mots de l'auteur pour deviner s'il parlait déjà de caméra. Elle
# marchait quand elle voyait le mot, et pas autrement : *« vu du ciel, bien
# au-dessus »* ne contient aucun des douze mots anglais de la liste, et la
# phrase de l'atelier s'empilait dessus.
#
# **Ce que ça retire de la liste** : `vue` (douze mots) et `rendu` (quatre)
# n'ont plus rien à arbitrer, puisqu'il n'y a plus deux textes à départager.
# Restent les quatre de `technique` — la seule des trois cases qui garde du
# texte d'auteur, parce que le calage n'est pas le seul sujet dont elle parle.
CHAMPS_DE_L_ATELIER = ("rendu", "vue")

# **Ce que l'auteur avait tapé là ne disparaît pas du fichier.** Il reste dans
# la case, il est relu, il est servi à l'écran — il ne *part* plus, et l'écran
# le montre barré avec l'étape qui écrit à sa place. Effacer aurait été le seul
# geste destructeur d'une tranche qui n'en demandait aucun.


# ── Quand l'auteur redit ce que l'atelier allait dire ────────────────────────
#
# **Une seule case désormais**, `technique` : l'atelier y écrit le calage et le
# fond, et l'auteur y écrit tout ce qu'un modèle ne doit jamais faire. Les deux
# sujets cohabitent dans la même case, donc les deux textes s'empilent — et il
# faut bien lire les mots pour savoir si l'auteur redit le calage.
#
# `rendu` et `vue` en sont sorties avec `B14` : elles n'ont plus de texte
# d'auteur qui parte, donc plus rien à départager. Voir `CHAMPS_DE_L_ATELIER`.
#
# **Des mots, pas une intention.** On ne devine pas si l'auteur voulait préciser
# ou remplacer ; on regarde s'il parle déjà du même sujet. Une case `technique`
# qui contient `isolated sprite` ou `flat background` redit bien le calage, et
# la phrase de l'atelier en ferait une seconde.
#
# **La liste est courte exprès.** Chaque mot ajouté est un cas où l'atelier se
# tait ; en ajouter un de trop ferait disparaître une phrase que personne
# n'aurait remplacée. On préfère l'empilement — visible, et corrigeable d'un
# clic à l'écran de confirmation — au silence.
_REDITES: dict[str, tuple[str, ...]] = {
    "technique": ("tile snap", "isolated sprite", "sprite isolé", "flat background"),
}


def _redit(nom: str, ecrit: str) -> bool:
    """Ce que l'auteur a tapé parle-t-il déjà du sujet de la phrase d'atelier ?"""
    minuscules = ecrit.lower()
    return any(mot in minuscules for mot in _REDITES.get(nom, ()))


@dataclass(frozen=True, slots=True)
class Champ:
    """Un champ de la bible : son texte, et s'il part.

    **Un seul objet pour les deux**, jamais un texte d'un côté et une liste
    d'actifs de l'autre : ce sont deux vérités sur la même chose, et le fichier
    voisin dit ce qu'elles finissent par faire.
    """

    nom: str
    texte: str = ""
    actif: bool = True

    @property
    def porte(self) -> bool:
        """Ce champ dit-il quelque chose qui parte vraiment ?"""
        return self.actif and bool(self.texte.strip())

    def en_json(self) -> dict[str, Any]:
        return {"nom": self.nom, "texte": self.texte, "actif": self.actif}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Champ":
        return Champ(
            nom=d.get("nom", ""),
            texte=d.get("texte", ""),
            actif=bool(d.get("actif", True)),
        )


# ── Le barème d'échelles ─────────────────────────────────────────────────────
#
# **Sans lui, tout ce qui sort du produit fait la même hauteur** (`docs/archive/plan-versions-tenues.md`,
# T4). La séance du 27 août l'a montré sur cinq sujets réels : un coffre aussi
# haut qu'un personnage. Ce n'est pas une coïncidence, c'est ce que donne
# mécaniquement une occupation à 100 % — la case est remplie, donc tout la
# remplit.
#
# **Une échelle porte aussi sa famille, et c'est ce qui garde un seul contrôle.**
# Dire « c'est un objet tenu en main », c'est du même coup dire quelle part de
# case il occupe *et* quels artworks partent en référence. Deux taxonomies —
# l'une pour l'échelle, l'autre pour la famille — se paieraient deux fois à
# chaque génération, et le PRD écarte explicitement « la sélection manuelle des
# artworks, génération par génération ».


@dataclass(frozen=True, slots=True)
class Echelle:
    """Une nature de sujet : la part de case qu'elle occupe, et sa famille.

    **`silhouette` dit si le sujet se découpe.** Un personnage, un tonneau, une
    icône ont un contour et vivent dans une case carrée ; un décor n'en a pas —
    il occupe tout le cadre, et l'enfermer dans une case lui ajouterait des
    bandes transparentes que personne n'a demandées. C'est la même distinction
    que `sur_grille` fait déjà avec son paramètre `case`, remontée au seul
    endroit où l'auteur peut la trancher : la nature du sujet.
    """

    nom: str
    famille: str = TOUS
    occupation: int = 100  # % du côté de la case rempli par le sujet
    silhouette: bool = True

    # ── Ce que ce type réclame, arrivé en E9 ─────────────────────────────────
    #
    # **La liste des poses appartient au type d'objet, plus au projet.** Avant,
    # le jeu déclarait une seule liste et tout la recevait : un coffre héritait
    # de *marche* et de *course*, qu'il fallait ranger une par une, sur chaque
    # coffre. Désormais un personnage a ses six attitudes, un meuble ses trois
    # états, et une tuile n'a pas de poses du tout.
    #
    # **`None` n'est pas la liste vide**, et c'est ce qui reprend les projets
    # d'avant sans rien perdre : *jamais rempli* retombe sur le plan du projet,
    # que tous les types partageaient ; *vidé par l'auteur* reste vide. Le motif
    # `lu or DEFAUT` ferait ressusciter à chaque relecture ce qu'on vient de
    # retirer — c'est déjà la décision de `plan_depuis_json`.
    poses: tuple[Pose, ...] | None = None

    def en_json(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "famille": self.famille,
            "occupation": self.occupation,
            "silhouette": self.silhouette,
            "poses": None if self.poses is None else [p.en_json() for p in self.poses],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Echelle":
        poses = d.get("poses")
        return Echelle(
            nom=d.get("nom", ""),
            famille=d.get("famille", TOUS),
            occupation=int(d.get("occupation", 100)),
            silhouette=bool(d.get("silhouette", True)),
            poses=None if poses is None else plan_depuis_json(poses),
        )


# Le barème d'un projet neuf. **Des valeurs de départ, pas une table de vérité** :
# elles se règlent projet par projet, et un jeu où les personnages sont des
# insectes n'a rien à faire de celles-ci. Elles viennent de la mesure du
# 27 août 2026 sur sept sujets réels — à 100 % pour tout le monde, le coffre
# sortait aussi haut que la prêtresse.
BAREME_PAR_DEFAUT = (
    Echelle("personnage", PERSONNAGES, 100),
    Echelle("créature", PERSONNAGES, 90),
    Echelle("meuble", OBJETS, 66),
    Echelle("objet posé", OBJETS, 50),
    Echelle("objet tenu", OBJETS, 40),
    Echelle("décor", DECORS, 100, silhouette=False),
    # **Un type manquait, et le projet en fabriquait déjà.** Sa description dit
    # `grid-aligned tile assets` et un outil découpe une planche en tuiles ;
    # mais « tuile » n'était dans aucune liste, donc une tuile arrivait en
    # « décor » et occupait toute sa case sans que ce soit un choix. Ajoutée en
    # E8, avec la même silhouette absente qu'un décor : une tuile remplit son
    # cadre, elle n'a pas de contour à détourer.
    Echelle("tuile", DECORS, 100, silhouette=False),
    # **Une matière** (TU2, `docs/PLAN-tuiles.md` décision 7) : une texture qui se répète
    # sans couture — de l'herbe, de la pierre —, dans laquelle un jeu de tuiles découpe
    # ses pièces. Elle remplit son cadre comme une tuile : rien à détourer.
    Echelle("matière", DECORS, 100, silhouette=False),
    Echelle("élément d'interface", INTERFACE, 100),
)


def bareme_complete(lu: tuple[Echelle, ...]) -> tuple[Echelle, ...]:
    """Le barème relu, **plus les natures du barème par défaut qui y manquent**.

    **Le barème est recopié dans le fichier du projet à sa création**, et rien ne le
    complétait ensuite : une nature ajoutée au produit n'atteignait donc que les projets
    créés après elle. Mesuré le 19 septembre 2026 sur `la-foret-magique` — « matière »
    absente, donc `echelle("matière")` introuvable, donc `recette_de` retombait sur
    `silhouette=True` : **chaque matière générée arrivait détourée et recadrée comme un
    personnage**. Le même trou avait laissé « tuile » hors de `coeur-de-pierre` et de
    `bac-a-sable`.

    Ce n'était pas un réglage mal posé : c'était une nature que l'auteur ne pouvait ni
    choisir ni voir manquer — sans elle, l'écran des tuiles n'offre aucun type « matière »
    à créer, et « Mes matières » reste vide par construction.

    **Ce qu'elle ne fait pas : trancher à la place de l'auteur.** Ce qui est écrit au
    fichier passe devant et n'est jamais retouché — ni l'occupation, ni la silhouette, ni
    les poses d'une nature déjà là. Seuls les noms absents s'ajoutent, à la fin, dans
    l'ordre du barème par défaut.

    **La contrepartie, assumée le 19 septembre 2026** : une nature du barème par défaut que
    l'auteur a supprimée exprès réapparaît à la relecture. C'est le prix d'un complètement
    par les noms, et il a été préféré à une migration jouée une fois — qui aurait laissé le
    même piège posé pour la nature suivante. Comme les autres migrations, celle-ci n'a lieu
    qu'en mémoire : le disque ne change qu'au prochain enregistrement.
    """
    if not lu:
        return BAREME_PAR_DEFAUT
    connus = {e.nom for e in lu}
    return lu + tuple(e for e in BAREME_PAR_DEFAUT if e.nom not in connus)


# La taille de pixel d'un projet neuf. **Imposée à tout ce qui rentre, jamais
# déduite de l'image reçue** (US-60, US-61) : c'est elle qui met un tonneau
# rendu sur une grille de 16 px et un personnage rendu sur 8 px à la même
# finesse. 64 est la valeur d'un sprite de personnage chez MySpriteAi.
CIBLE_PAR_DEFAUT = 64

# **« Aucune » est une valeur, pas un trou** (US-163, R2). Zéro veut dire « ce
# que le modèle a rendu me revient tel quel » : la remise sur grille est la
# seule étape que le projet imposait sans échappatoire, et un jeu qui n'est pas
# en pixel art n'a rien à y gagner. Ce n'est pas un réglage désactivé — c'est un
# univers qui déclare ne pas contraindre l'échelle, comme un univers sans
# artwork ne contraint pas la palette.
#
# **Zéro plutôt que `None`** : la cible est un entier partout — dans le fichier,
# dans le corps de la route, dans le segment d'écran —, et un second type pour
# une seule valeur aurait fait écrire deux fois la même condition.
AUCUNE_CIBLE = 0


# ── Le style graphique du jeu, arrivé en D2 ──────────────────────────────────
#
# **La première question de toutes, et elle n'existait pas.** Rien dans les
# réglages ne demandait *ce jeu est-il en pixel art ?* — la réponse se déduisait
# d'un détail : la neuvième valeur d'une liste de tailles, « aucune », dont le
# libellé disait en toutes lettres *ce jeu n'est pas en pixel art*. Le style
# était donc une conséquence d'un réglage de taille, quand c'est l'inverse : le
# style décide de ce que la taille **veut dire**.
#
# **Deux styles, et ils ne posent pas la même question :**
#
# | | pixel art | dessin |
# |---|---|---|
# | la question | combien de **carrés** ? | quelle **finesse** ? |
# | ce que ça veut dire | la quantité de dessin qui existe | la quantité de détail gardée |
# | la transformation | destructrice — c'est le sujet de D2 | une réduction propre suffit |
# | les couleurs | réduites à une palette finie | gardées : un dessin a ses nuances |
# | ce qui part au modèle | « 2D pixel art on a NxN grid » | rien de tout ça |
#
# **En pixel art, la taille *est* le dessin** : un personnage de 32 et un de 128
# ne sont pas la même image en deux tailles, ce sont deux dessins. En dessin,
# elle n'est qu'une finesse — réduire de 1024 à 512 marche tout seul, sans
# bouillie, parce qu'il n'y a rien à écraser.
PIXEL_ART = "pixel"
DESSIN = "dessin"
STYLES = (PIXEL_ART, DESSIN)

NOM_DU_STYLE = {PIXEL_ART: "en pixel art", DESSIN: "en dessin"}


def style_connu(style: Any) -> str:
    """Le style rendu tel quel s'il existe, sinon le pixel art.

    Le domaine ne lève pas sur un nom qu'il ne connaît pas — même règle que
    `methode_connue` et `durcissement_livre`. Le pixel art ferme la marche parce
    qu'il est le défaut historique du produit : *« le pixel art est le défaut,
    plus une limite »* (`docs/ARCHITECTURE.md`).
    """
    return style if style in STYLES else PIXEL_ART


def cibles_du_style(style: str) -> tuple[int, ...]:
    """Les tailles qu'un style propose, **« aucune » comprise**.

    Deux listes qui ne se recoupent qu'en partie : 8 carrés n'a aucun sens pour
    un dessin, 2048 n'en a aucun pour du pixel art. `AUCUNE_CIBLE` est dans les
    deux — c'est *ne pas contraindre l'échelle*, un état légitime des deux côtés
    (US-163), et l'auteur l'a demandé explicitement pour le dessin.
    """
    liste = FINESSES if style == DESSIN else TAILLES
    return (AUCUNE_CIBLE,) + tuple(cible for cible, _ in liste)


# **La façon de réduire qu'un style appelle**, et elle reste un choix.
#
# L'auteur veut les quatre méthodes disponibles partout — *« je veux qu'on puisse
# choisir entre les 4 et changer en cours de route »* — et elles le restent : ce
# n'est qu'un **défaut**. Mais le bon défaut n'est pas le même des deux côtés :
# le vote en deux temps décide la forme case par case, ce qui donne exactement le
# sprite qu'on veut en pixel art et **posterise** un dessin ; la réduction douce
# fait l'inverse.
METHODE_DU_STYLE = {PIXEL_ART: VOTE, DESSIN: LANCZOS}


def methode_du_changement(vers: str, methode: str) -> str:
    """La façon de réduire à garder quand on **change de style**.

    **On ne réécrit que ce que personne n'a choisi**, et c'est la règle de D1
    mot pour mot (`moteurs_suivis`) : une méthode restée sur le défaut de
    l'ancien style est un réglage qu'on n'a pas posé, elle suit ; une méthode
    déplacée à la main est un choix, et un choix ne se réécrit pas.
    """
    depuis = METHODE_DU_STYLE[PIXEL_ART if vers == DESSIN else DESSIN]
    return METHODE_DU_STYLE[vers] if methode == depuis else methode


def cible_du_changement(style: str, cible: int) -> int:
    """La taille à garder quand on **change de style**, et il faut souvent bouger.

    *« Si je décide de changer de style sur mon jeu cœur de pierre pour le faire
    en dessin et plus en pixel art »* — l'auteur, 3 septembre 2026. Un jeu réglé
    sur 64 carrés qui passe en dessin garderait une finesse de 64 : une vignette
    de la taille d'une icône, là où l'auteur croit avoir juste changé de style.

    **On ne garde donc que ce que le nouveau style sait porter**, et le reste
    retombe sur son défaut — 64 carrés en pixel art, 512 de finesse en dessin.
    Ce n'est pas une borne silencieuse : le réglage part avec l'univers que la
    route renvoie, donc l'écran montre immédiatement la valeur qui s'applique.
    """
    if cible in cibles_du_style(style):
        return cible
    return FINESSE_PAR_DEFAUT if style == DESSIN else CIBLE_PAR_DEFAUT


def style_deduit(donnees: dict[str, Any]) -> str:
    """Le style d'un univers écrit **avant** que la question existe.

    **Il se déduit sans rien inventer**, et c'est ce qui reprend les projets
    d'avant sans leur changer une image : jusqu'ici, dire « aucune taille de
    pixel » *était* dire « ce jeu n'est pas en pixel art » — le libellé de la
    neuvième valeur le disait mot pour mot à l'écran. Une taille posée veut donc
    dire pixel art, et son absence veut dire dessin.

    C'est la seule lecture honnête : toute autre valeur par défaut ferait mentir
    un fichier sur ce que son auteur avait choisi.
    """
    if "style" in donnees:
        return style_connu(donnees.get("style"))
    return DESSIN if int(donnees.get("cible_px", CIBLE_PAR_DEFAUT)) == AUCUNE_CIBLE else PIXEL_ART


# ── La nature de l'image, arrivée en D1 ──────────────────────────────────────
#
# **Deux, et deux seulement** : ce qui arrive tout seul, et ce qui arrive dans
# une planche qu'on découpe. Ce n'est pas un troisième axe de rangement à côté
# de la famille — c'est *comment l'image est venue*, quand la famille dit *ce
# qu'elle montre*. Une même créature détourée depuis une planche de huit
# attitudes et détourée seule sont la même famille et deux natures.
#
# **Aucune troisième valeur n'attend son tour.** Une image importée « telle
# quelle » n'est pas une nature : elle n'a pas de recette du tout (US-170), et
# un état sans recette ne se range pas parmi des recettes par défaut.
IMAGE_SEULE = "image"
PLANCHE = "planche"
NATURES = (IMAGE_SEULE, PLANCHE)

NOM_DE_LA_NATURE = {
    IMAGE_SEULE: "une image seule",
    PLANCHE: "un morceau de planche",
}

# D'où vient le défaut qui s'applique. **Trois provenances, et le produit ferme
# la marche** : il n'y a jamais de trou, seulement un réglage qu'on n'a pas
# posé — la même phrase que le modèle par famille (US-58).
DE_LA_FAMILLE = "famille"
DE_LA_NATURE = "nature"
DU_PRODUIT = "produit"


# ── L'univers sonore, arrivé en SN2 ──────────────────────────────────────────
#
# **Le même geste que la bible, pour l'oreille** (docs/archi-son.md §4.2) : on
# décrit le son, l'univers ajoute le style. Quatre cases de texte, qui sont des
# `Champ` comme ceux de la bible — un texte et s'il part —, pour qu'on puisse
# relâcher l'orchestre sans l'effacer. Puis deux réglages de musique (tonalité
# et tempo de référence : les jingles se calent dessus) et le moteur choisi par
# famille, qui passe devant les défauts de `atelier.audio.graphes.FAMILLES`.
#
# **Vide ne contraint rien**, comme tout l'univers : un univers écrit avant SN2
# n'a pas la clé `son`, se relit vide, et la description part seule avec la
# prise de son de sa famille. Aucune migration.
#
# Les familles de sons (docs/archi-son.md §3) : la seule liste vit dans
# `atelier.domaine.son.FAMILLES_SON`, réexportée ici pour qui l'importait
# déjà d'ici. Ce sont les clés du moteur par famille, et celles que la
# composition du texte connaît (`atelier.audio.texte`). « interface » est la
# famille « interface et rétro ».
from atelier.domaine.son import FAMILLES_SON  # noqa: E402

# L'ordre est celui où les cases partent quand plusieurs partent ensemble.
CHAMPS_SON = ("epoque", "rendu", "orchestre", "humeur")


@dataclass(frozen=True, slots=True)
class UniversSonore:
    champs: tuple[Champ, ...] = ()
    tonalite: str = ""
    tempo: int | None = None
    moteurs: dict[str, str] = field(default_factory=dict)

    @property
    def vide(self) -> bool:
        return not (self.tonalite or self.tempo or self.moteurs or any(c.porte for c in self.champs))

    def champ(self, nom: str) -> Champ:
        for c in self.champs:
            if c.nom == nom:
                return c
        return Champ(nom)

    def texte(self, nom: str) -> str:
        """Ce que cette case fait partir : son texte si elle porte, sinon rien."""
        c = self.champ(nom)
        return c.texte.strip() if c.porte else ""

    def en_json(self) -> dict[str, Any]:
        return {
            "champs": [self.champ(n).en_json() for n in CHAMPS_SON],
            "tonalite": self.tonalite,
            "tempo": self.tempo,
            "moteurs": dict(self.moteurs),
        }

    @staticmethod
    def depuis_json(d: Any) -> "UniversSonore":
        """Relire sans jamais lever : une valeur illisible revient vide, comme
        le fond (D3) — faire tomber un projet pour une tonalité serait hors de
        proportion. Absent, c'est l'univers vide."""
        from atelier.domaine.workflow import TEMPO_MAX, TEMPO_MIN, TONALITES

        if not isinstance(d, dict):
            return UniversSonore(champs=tuple(Champ(n) for n in CHAMPS_SON))
        lus = {}
        for c in d.get("champs") or ():
            if isinstance(c, dict) and c.get("nom") in CHAMPS_SON:
                lus[c["nom"]] = Champ.depuis_json(c)
        tempo = d.get("tempo")
        moteurs = d.get("moteurs") or {}
        return UniversSonore(
            champs=tuple(lus.get(n, Champ(n)) for n in CHAMPS_SON),
            tonalite=d.get("tonalite") if d.get("tonalite") in TONALITES else "",
            tempo=tempo if isinstance(tempo, int) and not isinstance(tempo, bool) and TEMPO_MIN <= tempo <= TEMPO_MAX else None,
            moteurs={f: m for f, m in moteurs.items() if f in FAMILLES_SON and isinstance(m, str) and m.strip()}
            if isinstance(moteurs, dict) else {},
        )

    def regle(self, brut: dict[str, Any]) -> "UniversSonore":
        """Poser ce que `brut` dit, et seulement ça (la règle du `PUT` de
        l'univers : ce qu'un message ne dit pas, il ne l'efface pas). Une case
        se vide avec un texte vide, le tempo avec `null`, un moteur avec une
        chaîne vide. Lève `ValueError` avec une phrase affichable."""
        from atelier.domaine.workflow import TEMPO_MAX, TEMPO_MIN, TONALITES

        if not isinstance(brut, dict):
            raise ValueError("le bloc sonore est un objet")
        inconnues = set(brut) - {"champs", "tonalite", "tempo", "moteurs"}
        if inconnues:
            raise ValueError("réglage sonore inconnu « " + " » « ".join(sorted(inconnues)) + " »")
        champs = {c.nom: c for c in (self.champs or tuple(Champ(n) for n in CHAMPS_SON))}
        for c in brut.get("champs") or ():
            if not isinstance(c, dict) or c.get("nom") not in CHAMPS_SON:
                raise ValueError("les cases sonores sont « " + " » « ".join(CHAMPS_SON) + " »")
            if not isinstance(c.get("texte", ""), str):
                raise ValueError(f"« {c['nom']} » : le texte est une phrase")
            avant = champs.get(c["nom"], Champ(c["nom"]))
            champs[c["nom"]] = Champ(c["nom"], c.get("texte", avant.texte), bool(c.get("actif", avant.actif)))
        tonalite, tempo, moteurs = self.tonalite, self.tempo, dict(self.moteurs)
        if "tonalite" in brut:
            t = brut["tonalite"] or ""
            if t and t not in TONALITES:
                raise ValueError(f"la tonalité « {t} » n'est pas connue ; écrivez-la comme « D minor » ou « F# major »")
            tonalite = t
        if "tempo" in brut:
            t = brut["tempo"]
            if t is not None and (isinstance(t, bool) or not isinstance(t, int) or not TEMPO_MIN <= t <= TEMPO_MAX):
                raise ValueError(f"le tempo de référence est un entier de {TEMPO_MIN} à {TEMPO_MAX} BPM")
            tempo = t
        if "moteurs" in brut:
            if not isinstance(brut["moteurs"], dict):
                raise ValueError("le moteur par famille est un objet famille → moteur")
            for f, m in brut["moteurs"].items():
                if f not in FAMILLES_SON:
                    raise ValueError(f"famille de sons inconnue « {f} »")
                if not isinstance(m, str) or len(m) > 200:
                    raise ValueError(f"« {f} » : le moteur se nomme par son identifiant")
                if m.strip():
                    moteurs[f] = m.strip()
                else:
                    moteurs.pop(f, None)
        return UniversSonore(
            champs=tuple(champs.get(n, Champ(n)) for n in CHAMPS_SON),
            tonalite=tonalite, tempo=tempo, moteurs=moteurs,
        )


# ── L'univers ────────────────────────────────────────────────────────────────


@dataclass(slots=True)
class Univers:
    """Ce que le projet impose à ce qui rentre, et ce qu'il envoie avec.

    **Un univers vide ne contraint rien** (US-57). Aucun champ n'est obligatoire,
    aucun n'est un préalable : générer sans bible, sans artwork et sans palette
    reste possible, et les défauts du produit prennent le relais. C'est pour ça
    que tout est facultatif ici, et que rien ne lève.
    """

    bible: tuple[Champ, ...] = ()
    bareme: tuple[Echelle, ...] = BAREME_PAR_DEFAUT

    # **Le style graphique du jeu** (D2), et il vient avant la taille parce
    # qu'il décide de ce que la taille veut dire. Voir le bloc `PIXEL_ART` /
    # `DESSIN` plus haut : la même case porte un nombre de carrés ou une
    # finesse, et ce ne sont pas les mêmes valeurs ni la même question.
    style: str = PIXEL_ART

    cible_px: int = CIBLE_PAR_DEFAUT

    # ── La vue du jeu, arrivée en E8 ─────────────────────────────────────────
    #
    # **Elle n'existait que sous forme de phrase**, dans la case `vue` de la
    # bible — un texte anglais qui part au modèle et que rien ne relit. Or le
    # choix de la vue remplit **deux endroits d'un coup** : cette phrase, et le
    # nombre d'images qu'une pose demande. Sans le champ, l'atelier ne peut ni
    # rouvrir l'étape sur ce qui a été choisi, ni réécrire les deux quand on en
    # change : il faudrait deviner la vue en relisant l'anglais.
    #
    # Vide est une valeur : un jeu qui ne dit pas d'où il regarde ne contraint
    # rien, comme un univers sans artwork ne contraint pas la palette.
    vue: str = AUCUNE_VUE

    # ── Les directions du jeu, arrivées en E10 ───────────────────────────────
    #
    # **La vue les propose, le codex les règle.** Un jeu vu de dessus se dessine
    # dans quatre directions ; le produit ne le savait pas, et ne pouvait donc
    # pas dire qu'il manquait le nord. La liste vient de la vue — un seul geste
    # remplit les deux moitiés — mais **c'est une proposition, pas une
    # contrainte** : on renomme, on retire, on ajoute depuis le codex.
    #
    # **`None` n'est pas la liste vide**, et c'est la même décision qu'aux poses
    # d'un type (E9). *Jamais écrite* suit la vue, et c'est ce que le codex
    # affiche « lues » ; *vidée par l'auteur* reste vide, et le jeu n'a alors
    # aucune direction — ce qui est un état normal, celui d'un jeu de face.
    directions: tuple[Direction, ...] | None = None

    # **Combien de couleurs le pixel art du projet emploie.** Ce chiffre sert
    # deux fois, et c'est voulu : il dit combien de teintes lire dans les
    # artworks officiels pour en tirer la palette (US-54), et combien en garder
    # quand il n'y a pas d'artwork du tout.
    #
    # **Passé de 24 à 32 en D2**, pour tomber sur l'un des six paliers tranchés
    # par l'auteur le 3 septembre (`PALIERS_DE_COULEURS`). La mesure du même
    # jour dit que ça ne coûte rien : sur les deux planches du guide, 24 teintes
    # demandées en rendent 18 franchement distinctes et 32 en rendent 18 aussi
    # — la coupe médiane sature avant. Les projets déjà écrits gardent leur 24,
    # qui est dans leur fichier ; seuls les projets neufs partent de 32.
    couleurs: int = 32

    # ── La méthode de réduction, arrivée en D2 ───────────────────────────────
    #
    # **Le style de pixelisation du projet.** Quatre méthodes, mesurées et
    # montrées côte à côte à l'auteur le 3 septembre ; il en a fait un choix
    # d'auteur, pas un classement — *« les 4 ont des rendus différents [...] et
    # peuvent influencer le style souhaité par le créateur »* — et a tranché le
    # défaut sur le vote en deux temps.
    #
    # **Il ne s'impose qu'aux recettes fabriquées à neuf.** Les recettes déjà
    # posées portent leur propre méthode dans leur JSON ; celles d'avant D2 n'en
    # portent aucune et retombent sur « au plus proche », ce que l'atelier
    # faisait alors. Changer ce réglage ne rejoue donc aucune image déjà rendue,
    # exactement comme la taille de case ou le détourage par défaut.
    methode_pixels: str = METHODE_LIVREE

    # ── La palette, et d'où elle vient ───────────────────────────────────────
    #
    # **Un cache nommé par sa provenance**, exactement comme le rendu d'un asset
    # est nommé par l'empreinte de sa recette. La palette *est* dérivable des
    # artworks — la garder telle quelle serait une seconde vérité, et « deux
    # vérités sur la même chose finissent par diverger ». L'empreinte dit de
    # quels artworks cette palette-ci est la lecture : une promotion, un retrait
    # ou un changement de `couleurs` ne correspond plus, donc se recalcule.
    palette: tuple[str, ...] = ()
    palette_empreinte: str = ""

    # ── Le fond du jeu, arrivé en D3 ─────────────────────────────────────────
    #
    # **La couleur sur laquelle le sujet est posé, et elle part dans le texte.**
    # Le produit demandait *un fond plat* sans dire lequel : le modèle rendait un
    # gris clair, c'est-à-dire une couleur que le sujet porte aussi, d'où le
    # découpage à reprendre sur presque chaque image.
    #
    # **Vide est une valeur, et c'est celle d'avant la tranche** : la phrase
    # partie est alors exactement celle qui partait, et rien n'entre dans le
    # champ d'interdiction. C'est ce qui fait qu'un univers écrit avant D3 — et
    # un univers sans palette, qui n'a rien pour proposer — ne change pas d'un
    # mot.
    #
    # ⚠️ **Ce champ est relu, et plus jamais employé** — RT3, 20 septembre 2026.
    #
    # Il a été un réglage du jeu du 2 septembre au 20 septembre 2026 : l'écran
    # proposait une couleur franche, l'auteur tranchait, et la phrase de calage
    # la portait. L'auteur a changé d'avis — le fond se **calcule** maintenant à
    # chaque appel sur l'image de référence envoyée, et
    # `ServiceProduction.couches` impose cette couleur-là à la place de celle-ci.
    # Le raisonnement entier est en tête de `atelier/domaine/fond.py`.
    #
    # **Il reste dans le modèle pour une seule raison, et elle suffit** : les
    # jeux écrits entre ces deux dates le portent sur le disque, et le retirer
    # rendrait leur `projet.json` illisible. On paie un champ mort plutôt qu'un
    # projet qu'on ne sait plus ouvrir. L'écran qui l'expose part en RT4.
    fond: str = AUCUN_FOND

    # **Le modèle est un défaut par type d'asset, pas un réglage global**
    # (`docs/archive/plan-versions-tenues.md`, T4). Une famille sans modèle retombe sur le défaut du
    # catalogue — il n'y a pas de trou, seulement un réglage qu'on n'a pas posé.
    modeles: dict[str, str] = field(default_factory=dict)

    # ── Les deux modèles d'appel, arrivés en C2 ──────────────────────────────
    #
    # **Ils ne sont pas dans `modeles`, et c'est la décision.** Ce dictionnaire
    # est indexé par **famille de sujet** — ce qu'on fabrique —, et ces deux-ci
    # répondent à une autre question : *quelle sorte d'appel on fait*. Les
    # ranger ensemble aurait demandé deux clés réservées dans un espace de noms
    # que l'auteur croit être le sien, et la validation « famille inconnue »
    # aurait dû les excepter.
    #
    # Deux, et pas un : l'essai du 28 août a mesuré qu'un modèle rend les traits
    # du gabarit dans l'image quand un autre les ignore comme demandé — produire
    # une planche et éditer un corps ne se jouent donc pas chez le même. Vides,
    # le défaut du catalogue et la famille du sujet reprennent la main, comme
    # partout ailleurs : il n'y a pas de trou, seulement un réglage qu'on n'a
    # pas posé.
    #
    # `modele_edition` est écrit ici et lu en C3 : il n'a pas de sens tant qu'on
    # n'édite pas un corps, et le poser en même temps que son jumeau évite de
    # rouvrir l'univers pour un champ.
    modele_planche: str = ""
    modele_edition: str = ""

    # ── Le détourage par défaut, arrivé en D1 ────────────────────────────────
    #
    # **Trois champs, et le même rangement que les modèles juste au-dessus** —
    # ce n'est pas une coïncidence, c'est la consigne : « le produit range déjà
    # par famille le modèle par défaut d'un univers ; la recette suit le même
    # rangement, et n'invente aucun vocabulaire ».
    #
    # Les deux premiers disent *comment l'image est venue*, le dictionnaire dit
    # *ce qu'elle montre*, et ils ne se mêlent pas — exactement la décision de
    # C2 pour `modele_planche` : mettre les deux natures dans `detourages`
    # aurait demandé deux clés réservées dans un espace de noms que l'auteur
    # croit être le sien, et « famille inconnue » aurait dû les excepter.
    #
    # **`None` n'est pas une passe vide**, et l'écart compte : *jamais réglé*
    # retombe sur le défaut du produit — c'est ce qui fait qu'un univers écrit
    # avant D1 rend exactement ce qu'il rendait — quand *réglé* impose ce qui
    # est écrit. Une famille absente du dictionnaire hérite de sa nature ; une
    # famille présente décide, et l'écran dit d'où vient ce qui s'applique.
    #
    # **Une `Passe` et pas un type neuf.** Le domaine en a déjà une, avec sa
    # sérialisation, ses bornes et sa route ; un second objet qui décrirait un
    # détourage serait une seconde vérité, et « deux vérités sur la même chose
    # finissent par diverger ». Ce qu'une passe porte de *propre à une image* —
    # le point de la pipette, le tracé à main levée, le masquage — n'a pas de
    # sens dans un défaut : `passe_par_defaut` le retire à l'entrée, si bien
    # que la chose est irreprésentable plutôt que défendue par une règle.
    detourage_image: Passe | None = None
    detourage_planche: Passe | None = None
    detourages: dict[str, Passe] = field(default_factory=dict)

    # **Le bloc sonore** (SN2). Il n'entre pas dans `vide` : ce compte-là dit
    # ce qui contraint une *image*, et un orchestre ne change rien à un sprite.
    son: UniversSonore = field(default_factory=lambda: UniversSonore.depuis_json(None))

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    @property
    def vide(self) -> bool:
        """Rien de posé : ni bible qui parle, ni palette, ni vue. Le produit
        prend le relais, et c'est un état normal, pas une configuration
        manquante.

        **La vue est entrée dans le compte le 1ᵉʳ septembre 2026**, et elle y
        entre parce qu'elle en sortait par accident. Choisir une vue écrivait sa
        phrase dans la case `vue` de la bible, donc un champ portait, donc
        l'univers n'était plus vide : le compte était juste, par un détour.
        Depuis que la phrase se calcule au lieu d'être rangée, ce détour a
        disparu — et sans cette ligne, un jeu dont on vient de choisir la vue se
        redéclarerait vierge. La taille, elle, n'y entre pas : son défaut est
        64, donc « posée » et « pas encore touchée » n'y sont pas
        distinguables, et un univers ne se dira jamais réglé pour une valeur
        que personne n'a choisie.

        ~~**Le fond y entre en D3, et pour la raison exacte de la vue.**~~
        **Il en ressort le 20 septembre 2026 (RT3)**, et pour une raison qui est
        l'exacte réciproque : le fond n'est plus un choix de l'auteur mais un
        calcul de l'atelier, fait à chaque appel. Compter un calcul comme une
        déclaration aurait fait sortir un jeu neuf de son silence — un premier
        essai serait parti avec la grille et la caméra que personne n'a
        choisies, ce que US-57 interdit. **Ce qui remplace la ligne retirée est
        `dit_quelque_chose`** : le fond part quand même, seul, sans réveiller le
        reste.
        """
        return not (
            self.palette or self.vue or any(c.porte for c in self.bible)
        )

    def dit_quelque_chose(self, nom: str) -> bool:
        """Cette case-là a-t-elle une phrase de l'atelier à dire ? (RT3)

        **Une seule case échappe au silence d'un univers vide, et c'est
        `technique`** — parce que le fond y est entré le 20 septembre 2026 et
        qu'il n'est pas un réglage.

        US-57 interdit de faire parler un jeu que personne n'a décrit : la
        grille, le calage et la caméra viennent de choix qu'on n'a pas faits, et
        les envoyer quand même ferait obéir le modèle à une configuration
        imaginaire. **Le fond n'est rien de tout cela.** Personne ne le choisit
        plus ; l'atelier le calcule pour se protéger d'une panne mécanique — le
        découpage qui mange une couleur du sujet —, et cette panne frappe un jeu
        neuf exactement comme un jeu réglé. Le taire sur un premier essai
        rendrait à ce premier essai le gris que la tranche existe pour chasser.

        **Et il part seul** : sur un univers vide, `phrase_du_produit` compose la
        phrase de calage avec une cible nulle, donc *single isolated sprite on a
        flat solid #00B140 studio green background* et rien d'autre — pas de
        `tile snap`, pas de grille, pas de caméra. Ce que personne n'a choisi
        reste muet.
        """
        if not self.vide:
            return True
        return nom == "technique" and bool(self.fond)

    def champ(self, nom: str) -> Champ:
        for c in self.bible:
            if c.nom == nom:
                return c
        return Champ(nom)

    # ── Ce que l'atelier dit lui-même, et qui n'est rangé nulle part ─────────
    #
    # **Trois cases de la bible portent une phrase que l'auteur n'a pas tapée** :
    # `rendu` dit la grille, `technique` dit le calage, `vue` dit le cadrage. Ces
    # trois-là étaient *écrites dans la case* jusqu'au 1ᵉʳ septembre 2026, et
    # elles se recalculent maintenant à chaque envoi.
    #
    # **Ce changement retire de l'état, il n'en ajoute pas.** Les trois phrases
    # sont entièrement déterminées par `cible_px` et `vue`, qui sont déjà là :
    # les ranger une seconde fois dans un texte, c'était tenir deux vérités sur
    # la même chose. La panne que ça répare est nommée dans `phrase_de_grille` —
    # une seule étiquette cliquée gelait la phrase pour toujours.

    def phrase_du_produit(self, nom: str) -> str:
        """Ce que l'atelier écrit de lui-même dans cette case. Vide ailleurs.

        **Vide est une réponse, pas un trou** : sans taille de pixel, l'atelier
        ne dit rien de la grille, et écrire `no pixel grid` serait une
        affirmation que personne n'a faite (US-57).
        """
        # **Les deux phrases de grille sont celles du pixel art, et de lui
        # seul** (D2). Un jeu en dessin qui garde une finesse de 1024 aurait
        # envoyé *2D pixel art on a 1024x1024 grid* — le contraire mot pour mot
        # de ce que l'auteur a choisi, et sur la case qui décide de l'allure.
        # Le défaut n'était pas atteignable avant que le style existe : « aucune
        # taille » était la seule façon de dire « pas de pixel art », et elle
        # vidait les deux phrases par le même geste.
        if nom == "rendu":
            return phrase_de_grille(self.cible_px) if self.style == PIXEL_ART else ""
        if nom == "technique":
            # **Le calage est du pixel art, le fond est de tous les styles**
            # (D3). Un jeu en dessin n'a pas de carrés à caler — sa cible vaut
            # zéro ici — mais il a un fond comme les autres, et la phrase part
            # alors réduite à sa première moitié.
            #
            # **`self.fond` est ici la couleur de l'appel, pas celle du disque**
            # (RT3) : `ServiceProduction.couches` compose cette phrase sur une
            # copie de l'univers dont le fond est celui que l'atelier vient de
            # calculer. Le champ relu du `projet.json` n'atteint donc jamais un
            # texte qui part.
            #
            # **Et sur un univers vide, la cible tombe à zéro** : le fond part,
            # le calage reste muet — voir `dit_quelque_chose`. C'est ce qui
            # permet au fond d'atteindre un jeu neuf sans faire parler un jeu
            # que personne n'a décrit.
            cible = (
                self.cible_px if self.style == PIXEL_ART and not self.vide else 0
            )
            return phrase_de_calage(cible, self.fond)
        if nom == "vue":
            connue = vue_connue(self.vue) if self.vue else None
            return connue.phrase if connue else ""
        return ""

    @property
    def phrases(self) -> dict[str, str]:
        """Les trois phrases, pour l'écran qui les montre en épinglé.

        Seules celles qui disent quelque chose : une case sans phrase n'a pas
        de ligne d'atelier, et en rendre une vide ferait dessiner un cadre
        autour de rien.
        """
        dites = ((nom, self.phrase_du_produit(nom)) for nom in CHAMPS_BIBLE)
        return {nom: phrase for nom, phrase in dites if phrase}

    def texte_de_la_case(self, nom: str) -> str:
        """Ce qui part vraiment pour cette case — l'atelier d'abord, l'auteur ensuite.

        **L'ordre n'est pas indifférent.** La phrase de l'atelier pose le médium
        et le cadre ; ce que l'auteur ajoute les précise. Un modèle d'image lit
        de gauche à droite et pondère de même : mettre `16-bit pixel art` avant
        `2D pixel art on a 32x32 grid` ferait discuter les deux au lieu de les
        empiler.

        **Une case éteinte ne dit rien du tout**, phrase de l'atelier comprise.
        L'auteur a décidé que cette case ne partait pas ; elle ne part pas.
        C'est ce que le réglage faisait déjà quand la phrase était rangée
        dedans, et il n'y a aucune raison que l'interrupteur change de sens.

        **Et un univers vide ne dit rien non plus** (US-57). La taille par
        défaut est 64 : sur un univers où personne n'a rien posé, « choisie » et
        « pas encore touchée » ne se distinguent pas, et calculer la phrase
        ferait parler un jeu que personne n'a décrit — un agent, un import, un
        premier essai. **Ça ne coûte rien de réel** : la grille est un
        rééchantillonnage, pas une consigne. L'image tombe sur 64 px que le
        prompt le dise ou non ; la phrase est un renfort, jamais le mécanisme.
        Dès qu'une case, une palette ou une vue est posée, l'univers dit
        quelque chose, et l'atelier dit la sienne avec.

        ── **L'atelier se tait quand l'auteur parle de la même chose** ──────────

        Ajouté le 1ᵉʳ septembre 2026, sur trois contradictions relevées dans des
        prompts réellement payés :

            View and framing: strict top-down view seen from directly above,
                              Camera: strict 90-degree top-down view, …
            Technical constraints: single isolated sprite on a flat background,
                              strict 128x128 px tile snap, Isolated sprite on
                              neutral grey…, strict 64x64 px tile snap, …

        La caméra dite deux fois ; le calage dit deux fois, une fois en anglais
        et une fois en français ; et, sur le projet du nain, **deux tailles de
        pixel différentes dans la même phrase**.

        La règle d'empilement était juste pour ce qu'elle décrit — un auteur qui
        *précise* le médium — et fausse dès qu'il le **redit**. On ne peut pas
        deviner l'intention ; on peut lire les mots. Quand la case de l'auteur
        parle déjà du même sujet que la phrase de l'atelier — une caméra pour la
        vue, un calage ou une grille pour la technique et le rendu —, c'est
        **l'auteur qui gagne, seul**. C'est le même arbitrage qu'entre une chose
        du jeu et son ambiance, et il n'y avait aucune raison qu'il s'arrête à la
        porte de l'atelier.

        **Le perdant ne disparaît pas** : `resoudre` le montre barré à l'écran de
        confirmation, avec ce qui l'a remplacé, comme pour toutes les autres
        couches.

        ── **Deux cases ne se départagent plus : l'atelier y écrit seul** (B14) ──

        `rendu` et `vue` sont passées dans `CHAMPS_DE_L_ATELIER`. Elles ne
        rendent que la phrase de l'atelier, et le texte de l'auteur ne s'y joint
        plus — ni devant, ni derrière, ni à la place quand un mot-clé le
        désigne. La raison est celle de la tranche entière : *un réglage ne se
        pose jamais à deux endroits*. La grille se choisit à l'étape de l'allure,
        la caméra à l'étape de la vue, et il n'y a plus de second endroit d'où
        les redire.

        **Sans vue choisie, la case rend le vide, et c'est une réponse.** Le
        modèle décide alors seul de sa caméra — c'est la règle d'US-57, celle qui
        interdit de faire parler un jeu que personne n'a décrit, et elle ne
        change pas ici. Ce qui change, c'est qu'un texte d'auteur resté dans la
        case ne vient plus la remplir à la place du choix qu'on n'a pas fait.

        **Ce que l'auteur avait tapé là reste lisible** : `texte_sans_effet` le
        rend, l'écran le montre barré avec l'étape qui écrit à sa place, et le
        fichier ne perd rien.
        """
        champ = self.champ(nom)
        if not champ.actif:
            return ""
        atelier = self.phrase_du_produit(nom) if self.dit_quelque_chose(nom) else ""
        if nom in CHAMPS_DE_L_ATELIER:
            return atelier
        ecrit = champ.texte.strip()
        if atelier and ecrit and _redit(nom, ecrit):
            return ecrit
        morceaux = [atelier, ecrit]
        return ", ".join(m for m in morceaux if m)

    def textes_sans_effet(self) -> dict[str, str]:
        """Ce que l'auteur a tapé dans une case de l'atelier, et qui ne part plus.

        **Seulement ce qui est réellement là.** Une case de l'atelier vide ne
        rend pas de ligne : l'écran dessinerait un avertissement autour de rien.
        Le cas courant — un jeu neuf, ou un jeu dont l'auteur n'a jamais écrit
        dans ces deux cases-là — rend donc un dictionnaire vide, et l'écran ne
        montre aucune rature.

        C'est la contrepartie de `CHAMPS_DE_L_ATELIER` : le texte cesse de
        partir, il ne cesse pas d'exister. Le rendre ici est la seule façon que
        l'écran ait de le dire au lieu de le faire disparaître en silence.
        """
        restes = ((nom, self.champ(nom).texte.strip()) for nom in CHAMPS_DE_L_ATELIER)
        return {nom: texte for nom, texte in restes if texte}

    def famille_du_type(self, nom: str) -> str:
        """La famille d'une chose du jeu, **lue dans son type** (E15).

        **Une chose est définie à un seul endroit.** Le type d'objet porte déjà
        sa famille depuis T4 — c'est elle qui décide quels artworks officiels
        partent en référence —, et le codex la relit plutôt que d'en garder une
        seconde sur la chose. Deux vérités sur la même question auraient fini par
        se contredire : un meuble rangé dans les décors.

        **Sans type, c'est un personnage**, et c'est la reprise : toutes les
        choses du jeu d'avant E9 n'en portent pas, et elles ne doivent rien
        perdre à la généralisation. Un type que le barème ne connaît plus retombe
        sur la même réponse, parce qu'un renommage d'échelle ne doit pas faire
        disparaître une chose de tout écran.
        """
        echelle = self.echelle(nom) if nom else None
        return echelle.famille if echelle else PERSONNAGES

    def premier_type_de(self, famille: str) -> str:
        """Le type que le produit pose à une chose créée **dans cette famille**.

        Nommer crée, et une chose créée dans la colonne *Décors* doit y rester ;
        or c'est le type qui porte la famille. Le produit choisit donc le premier
        type du barème qui appartient à cette famille — un choix visible et
        changeable d'un menu sur l'établi de la chose, jamais un état caché.

        **Vide pour les personnages**, et c'est délibéré : c'est l'état de toutes
        les choses d'avant E9, celui qui suit le plan du jeu. Une chose créée
        aujourd'hui doit ressembler à celles d'hier.
        """
        if famille == PERSONNAGES:
            return ""
        for echelle in self.bareme:
            if echelle.famille == famille:
                return echelle.nom
        return ""

    def directions_du_jeu(self) -> tuple[Direction, ...]:
        """Les directions de ce jeu — **écrites ici, ou lues dans la vue** (E10).

        Une liste jamais écrite suit la vue : c'est l'état ordinaire, et c'est ce
        que le codex affiche « lues ». Dès que l'auteur renomme, retire ou
        ajoute, la liste est écrite et cesse de suivre — sans quoi changer de vue
        effacerait en silence des noms choisis à la main.

        **Vide est une réponse, pas un manque.** Un jeu vu de face n'a pas de
        directions, et le mot ne paraît alors nulle part dans le produit : ni
        colonne dans la matrice, ni segment dans le fil, rien dans le texte qui
        part. Un jeu qui n'en veut pas ne les voit jamais.
        """
        if self.directions is not None:
            return self.directions
        connue = vue_connue(self.vue)
        return connue.directions if connue else ()

    def directions_ecrites(self) -> bool:
        """La liste a-t-elle été touchée à la main ? Le codex l'écrit — *lues*
        contre *à vous* —, parce que ce n'est pas la même promesse : la première
        suivra un changement de vue, la seconde ne le suivra pas."""
        return self.directions is not None

    def echelle(self, nom: str) -> Echelle | None:
        """L'échelle de ce nom, ou rien. Un nom inconnu ne se corrige pas en
        silence : c'est l'appelant qui décide de retomber sur les défauts."""
        for e in self.bareme:
            if e.nom == nom:
                return e
        return None

    def poses_du_type(self, nom: str, plan: tuple[Pose, ...]) -> tuple[Pose, ...]:
        """Ce que ce type d'objet réclame — **et la reprise des projets d'avant**.

        Quatre réponses, dans cet ordre.

        **Le type a écrit sa liste** : c'est elle, et elle seule.

        **Le produit sait que ce type n'en a aucune** — un décor, une tuile :
        c'est un fait sur ce qu'une tuile *est*, pas un défaut qu'on n'aurait
        pas rempli. Elle ne bouge pas, elle se raccorde ; lui montrer une rangée
        grisée reviendrait à lui promettre qu'elle en aura un jour.

        **Le type existe mais n'a rien écrit** : c'est le **plan du projet**,
        que tous les types partageaient avant E9. C'est ce qui reprend les
        projets d'avant sans rien perdre — aucune image ne se retrouve
        orpheline, et pas un fichier n'a eu à être réécrit.

        **Le type est inconnu du barème** : ce que le produit sait d'un type de
        ce nom, ou rien.

        **Changer la liste d'un type ne touche pas les autres** : écrire sur
        l'échelle, c'est écrire là et nulle part ailleurs.
        """
        # **Un type vide n'est pas un type inconnu.** C'est l'état d'avant E9,
        # où le jeu n'en déclarait qu'un seul plan : ces choses-là retombent sur
        # le plan du projet, et c'est ce qui les reprend sans rien perdre.
        if not nom:
            return plan
        echelle = self.echelle(nom)
        if echelle is not None and echelle.poses is not None:
            return echelle.poses
        # **Deux types suivent le jeu** — le personnage et la créature —, et un
        # type que le produit ne connaît pas le suit aussi : l'ignorance
        # retombe sur ce qui existait plutôt que d'effacer des cases.
        if suit_le_plan_du_jeu(nom):
            return plan
        # Une liste **connue et vide** est une affirmation du produit : un décor
        # et une tuile ne réclament rien, et ce n'est pas un oubli.
        return plan_du_type(nom)

    def modele(self, famille: str) -> str | None:
        return self.modeles.get(famille) or None

    def couleurs_tenues(self) -> int:
        """Le nombre de couleurs, **ramené à ce que la taille peut porter** (D2).

        Tranché par l'auteur le 3 septembre : *« le max bloqué au nombre de
        pixel (on peut pas avoir du 128 couleurs sur du 32px) »*. Le plafond est
        le côté du sprite, et il est mesuré : au-delà, l'image ne contient plus
        assez de teintes distinctes pour remplir la palette demandée.

        **On borne au lieu de refuser.** Une taille peut changer après que le
        nombre de couleurs a été posé — passer un projet de 128 à 32 carrés ne
        doit pas rendre son univers illisible ni lever à la relecture. Le réglage
        garde donc sa valeur dans le fichier, et c'est à l'usage qu'il se plie.
        """
        possibles = paliers_de_couleurs(self.cible_px)
        return min(self.couleurs, possibles[-1])

    def detourage(
        self, nature: str = IMAGE_SEULE, famille: str = ""
    ) -> tuple[Passe, str]:
        """La passe de détourage qui s'appliquera, **et d'où elle vient** (D1).

        Trois niveaux, dans cet ordre : la famille du sujet, puis la nature de
        l'image, puis le produit. Aucun trou — seulement un réglage qu'on n'a
        pas posé, et c'est la phrase exacte du modèle par famille (US-58).

        **La famille l'emporte entièrement, elle ne complète pas.** Un défaut de
        famille qui n'écraserait que les champs qu'il déclare demanderait de
        distinguer « posé à zéro » de « pas posé » sur chacun des quatre
        réglages — quatre `None` de plus, et un écran qui doit les montrer. La
        règle simple est celle que le critère écrit : *sans quoi elle hérite de
        celle de sa nature*. C'est pour qu'elle ne surprenne jamais que la
        provenance sort d'ici avec la passe, et que l'écran l'affiche.

        **Elle ne rend jamais `None`.** Il y a toujours un détourage à décrire,
        même quand personne n'a rien réglé : le savoir est ce qui permet à
        l'écran de dire « voilà ce qui s'appliquera » avant de dépenser.
        """
        de_la_famille = self.detourages.get(famille) if famille else None
        if de_la_famille is not None:
            return de_la_famille, DE_LA_FAMILLE
        de_la_nature = (
            self.detourage_planche if nature == PLANCHE else self.detourage_image
        )
        if de_la_nature is not None:
            return de_la_nature, DE_LA_NATURE
        return passe_livree(BORD), DU_PRODUIT

    def recette_de(self, echelle: Echelle | None, nature: str = IMAGE_SEULE) -> Recette:
        """**Ce que le projet impose à ce qui rentre**, et le seul endroit qui le dise.

        Écrite ici, dans le domaine, parce que deux appelants la posent — la
        naissance d'un asset et le balayage de la palette rétroactive — et que
        deux recettes construites à deux endroits divergeraient au premier
        réglage ajouté. Elle est pure : rien à lire, rien à écrire.

        **La remise sur grille est systématique tant qu'une cible est posée**
        (US-61) : « un asset dont la grille a dérivé est le cas normal, pas
        l'incident ». Elle est donc toujours de la partie, même quand l'échelle
        est inconnue — c'est l'occupation qui retombe alors à 100 %, pas l'étape
        qui disparaît.

        **`AUCUNE_CIBLE` est la seule échappatoire, et elle est déclarée**
        (US-163) : sans cible, il n'y a pas de grille, donc l'image entre aux
        dimensions rendues par le modèle. Le reste ne bouge pas — le détourage
        et le recadrage suivent toujours la nature du sujet, et la
        quantification toujours l'existence d'une palette. **L'occupation, elle,
        n'agit plus** : elle n'existe que dans la grille, qui est ce qui met un
        sujet à l'échelle de sa case. C'est ce que l'écran Univers dit sous le
        barème plutôt que de le laisser deviner.

        **Le détourage suit la nature du sujet, pas un réglage.** Un personnage
        a un contour ; un décor n'en a pas, et l'enfermer dans une case carrée
        lui ajouterait des bandes transparentes. `sur_grille` lit déjà cette
        distinction dans la recette — « avoir demandé un détourage, c'est avoir
        dit que ce qu'on traite a une silhouette » —, il n'y a donc rien à
        transporter de plus : ne pas poser de passe suffit à dire « décor ».

        **Ce que la passe contient, en revanche, se règle** (D1). *S'il y a* une
        passe reste décidé par la silhouette, comme avant ; *ce qu'elle vaut*
        vient de `detourage`, qui lit la famille du sujet, puis la nature de
        l'image, puis le produit. `nature` arrive donc en second paramètre, avec
        une valeur par défaut : les appelants qui produisent une image seule
        n'ont rien eu à changer, et ceux qui déplient une planche le disent.

        **La quantification suit la taille, plus la palette** — corrigé en D2.
        Elle n'entrait auparavant que s'il existait une palette, donc que si des
        artworks officiels avaient été déposés. Mesuré le 3 septembre 2026 : un
        projet sans artwork rendait des sprites de **dix mille couleurs**, sans
        que rien à l'écran ne le dise. Ce n'était pas un réglage mal expliqué,
        c'était une étape entière du traitement qui ne s'exécutait jamais, en
        silence — et le réglage `couleurs` ne servait alors à rien.

        **Ce qui la commande désormais est le style**, et non plus la palette.
        Un nombre fini de couleurs *est* ce qui distingue un sprite d'une image
        réduite ; réduire les couleurs d'un **dessin** le transformerait en
        affiche sérigraphiée, et c'est justement ce qu'un jeu en dessin ne veut
        pas. La palette, elle, reste facultative : présente elle s'impose,
        absente les couleurs se déduisent de l'image.

        *Elle se lisait sur `cible_px` entre-temps, faute de style — ce qui
        donnait la bonne réponse par accident, « aucune taille » étant alors la
        seule façon de déclarer qu'un jeu n'est pas en pixel art. Le style le
        dit maintenant lui-même, et un jeu en dessin peut donc imposer une
        finesse sans se faire quantifier au passage.*
        """
        silhouette = echelle.silhouette if echelle else True
        passe, _ = self.detourage(nature, echelle.famille if echelle else "")
        sur_grille = self.cible_px != AUCUNE_CIBLE
        return Recette(
            passes=(passe,) if silhouette else (),
            recadrage=Recadrage() if silhouette else None,
            grille=(
                Grille(
                    cible=self.cible_px,
                    occupation=echelle.occupation if echelle else 100,
                    ancrage=BAS,
                    methode=methode_connue(self.methode_pixels),
                )
                if sur_grille
                else None
            ),
            quantification=(
                Quantification(
                    couleurs=self.couleurs_tenues(), palette=self.palette
                )
                if sur_grille and self.style == PIXEL_ART
                else None
            ),
            # Le nettoyage des bords n'est pas un défaut : il efface des taches,
            # et effacer sans qu'on l'ait demandé est le seul geste du
            # post-traitement qui puisse enlever quelque chose au sujet. Il reste
            # à la fiche, où on le voit agir.
            bords=None,
        )

    def en_json(self) -> dict[str, Any]:
        return {
            "bible": [c.en_json() for c in self.bible],
            "bareme": [e.en_json() for e in self.bareme],
            "style": self.style,
            "cible_px": self.cible_px,
            "vue": self.vue,
            "directions": (
                None
                if self.directions is None
                else [d.en_json() for d in self.directions]
            ),
            "couleurs": self.couleurs,
            "methode_pixels": self.methode_pixels,
            "palette": list(self.palette),
            "palette_empreinte": self.palette_empreinte,
            # **Le fond du jeu** (D3). La chaîne vide sort telle quelle : c'est
            # *aucun fond posé*, l'état d'avant la tranche, et il n'y a rien à
            # distinguer d'un second état comme pour le détourage — une couleur
            # est toujours quelque chose, et la retirer est la remettre à vide.
            "fond": self.fond,
            "modeles": dict(self.modeles),
            "modele_planche": self.modele_planche,
            "modele_edition": self.modele_edition,
            # **Le détourage par défaut** (D1). `null` sort tel quel et ne se
            # remplace pas par une passe vide : *jamais réglé* et *réglé sur les
            # valeurs du produit* sont deux états, et l'écran les affiche
            # différemment — « aucun choisi, le produit décide » n'est pas la
            # même phrase que la liste des quatre réglages.
            "detourage_image": (
                None if self.detourage_image is None else self.detourage_image.en_json()
            ),
            "detourage_planche": (
                None
                if self.detourage_planche is None
                else self.detourage_planche.en_json()
            ),
            "detourages": {f: p.en_json() for f, p in self.detourages.items()},
            "son": self.son.en_json(),
            # déduits — présents pour l'interface, jamais relus
            "vide": self.vide,
            # **Ce que l'atelier dit de lui-même, case par case.** L'écran des
            # réglages le montre en épinglé au-dessus du texte de l'auteur : on
            # doit pouvoir lire ce qui part sans le taper, et savoir lequel des
            # deux on est en train de corriger. Calculé à chaque lecture, donc
            # toujours d'accord avec la taille et la vue.
            "phrases": self.phrases,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Univers":
        """Relire un univers — **et retirer des cases ce que le produit y avait écrit**.

        La migration du 1ᵉʳ septembre 2026 vit ici, et nulle part ailleurs, pour
        la raison qui a fait vivre celle de R2 dans `bible_complete` : c'est le
        seul passage obligé entre un fichier et un univers. Rien à lancer, rien
        à se rappeler de lancer, et un projet qui n'a jamais été rouvert se
        migrera le jour où il le sera.

        **Elle ne perd rien.** `sans_phrase_du_produit` ne retire que des
        phrases d'une liste close, écrites par le produit lui-même ; ce que
        l'auteur a tapé à côté ressort mot pour mot. Et elle est idempotente :
        relire un fichier déjà migré ne trouve plus rien à retirer.

        **Elle ne réécrit pas le fichier toute seule** — la migration n'a lieu
        qu'en mémoire, et le disque ne change qu'au prochain enregistrement,
        comme pour toutes les autres. Un projet lu et refermé sans qu'on y
        touche garde ses octets.
        """
        if not d:
            return Univers(bible=bible_complete(()))
        bareme = tuple(Echelle.depuis_json(e) for e in d.get("bareme", ()))
        relus = (Champ.depuis_json(c) for c in d.get("bible", ()))
        return Univers(
            bible=bible_complete(
                replace(c, texte=sans_phrase_du_produit(c.texte)) for c in relus
            ),
            # **Complété, pas seulement remplacé quand il est vide** : voir
            # `bareme_complete` — une nature ajoutée au produit doit atteindre les
            # projets écrits avant elle, sinon le sujet qu'elle décrit se traite
            # comme un personnage sans que rien ne le dise.
            bareme=bareme_complete(bareme),
            # **Déduit quand la clé manque**, jamais mis au défaut : un univers
            # écrit avant D2 a bel et bien répondu à la question, par sa taille
            # de pixel. Voir `style_deduit`.
            style=style_deduit(d),
            cible_px=int(d.get("cible_px", CIBLE_PAR_DEFAUT)),
            vue=str(d.get("vue") or AUCUNE_VUE),
            directions=directions_depuis_json(d.get("directions")),
            # **24 à la relecture, 32 pour un projet neuf**, et l'écart est
            # voulu : un univers écrit avant D2 n'a pas cette clé et doit
            # rouvrir sur la valeur qu'il employait, sans quoi sa palette se
            # recalculerait toute seule à la première lecture.
            couleurs=int(d.get("couleurs", 24)),
            # **Absent veut dire « au plus proche »**, comme pour une recette :
            # un univers d'avant D2 n'a jamais choisi de méthode, et lui en
            # inventer une changerait ses prochaines images sans qu'il l'ait
            # demandé. Le vote en deux temps n'est le défaut que d'un projet neuf.
            methode_pixels=methode_connue(d.get("methode_pixels")),
            palette=tuple(d.get("palette", ())),
            palette_empreinte=d.get("palette_empreinte", ""),
            # **Un univers écrit avant D3 n'a pas ce champ**, et son absence veut
            # dire *aucun fond posé* — la phrase qui part est alors celle d'avant
            # la tranche, au caractère près. Une couleur illisible revient vide
            # elle aussi : elle se repose d'un clic, et faire tomber la lecture
            # d'un projet entier pour un champ de couleur serait hors de
            # proportion.
            fond=fond_valide(d.get("fond")),
            modeles={
                f: m for f, m in (d.get("modeles") or {}).items() if f in FAMILLES and m
            },
            modele_planche=d.get("modele_planche", "") or "",
            modele_edition=d.get("modele_edition", "") or "",
            # **Un univers écrit avant D1 n'a pas ces champs**, et leur absence
            # veut dire *jamais réglé* : le produit décide, avec exactement les
            # valeurs d'avant. C'est ce qui tient « une recette écrite avant
            # cette tranche s'ouvre et rend ce qu'elle rendait ».
            detourage_image=passe_par_defaut(d.get("detourage_image")),
            detourage_planche=passe_par_defaut(d.get("detourage_planche")),
            detourages={
                f: passe
                for f, brut in (d.get("detourages") or {}).items()
                if f in FAMILLES and (passe := passe_par_defaut(brut)) is not None
            },
            # **Un univers écrit avant SN2 n'a pas cette clé** : il se relit
            # vide, et un univers vide ne contraint rien.
            son=UniversSonore.depuis_json(d.get("son")),
        )


def passe_par_defaut(brut: Any) -> Passe | None:
    """Une passe relue **débarrassée de ce qui n'appartient qu'à une image** (D1).

    Le point de la pipette vit dans les pixels du brut, le tracé à main levée
    aussi, et le masquage est un geste de lecture qu'on pose le temps de
    regarder. Aucun des trois n'a de sens dans un défaut d'univers : appliqué à
    la première image venue, le point désignerait un pixel qui n'a rien à voir.

    Ils sont retirés **ici**, au seul passage entre un fichier et un univers,
    plutôt que défendus par une validation à l'entrée : ce qui est retiré à la
    relecture ne peut pas revenir par une route qu'on aurait oubliée, ni par un
    fichier écrit à la main.

    **`None` traverse.** Pas de passe est un état, et le distinguer d'une passe
    aux valeurs du produit est ce qui permet à l'écran de dire d'où vient ce qui
    s'applique.
    """
    if not brut:
        return None
    passe = Passe.depuis_json(brut)
    moteur = passe.moteur if passe.moteur in MOTEURS else BORD
    return replace(passe, moteur=moteur, point=None, portee=TACHE, trace=(), masquee=False)


def bible_complete(champs: Iterable[Champ]) -> tuple[Champ, ...]:
    """Les sept champs, dans l'ordre, quoi qu'on ait lu.

    Un fichier écrit avant qu'un champ n'existe, ou relu après qu'un champ a été
    retiré, ne doit ni faire disparaître une rubrique de l'écran ni ressusciter
    une rubrique qui n'existe plus. La liste close décide ; le fichier ne fait
    qu'apporter les textes.

    **C'est elle, et rien d'autre, qui fait la migration de R2** : un
    `projet.json` écrit à cinq champs s'ouvre à sept, les deux nouveaux vides et
    actifs, et rien de ce qu'il portait n'est perdu — un champ vide ne part pas,
    donc un projet d'avant génère exactement comme avant.
    """
    connus = {c.nom: c for c in champs}
    return tuple(connus.get(nom, Champ(nom)) for nom in CHAMPS_BIBLE)


def empreinte_palette(empreintes: Iterable[str], couleurs: int) -> str:
    """De quoi cette palette est la lecture : ces artworks-là, ce compte-là.

    Les empreintes entrent **triées** : l'ordre de promotion n'a aucune raison de
    changer une palette, et le calcul n'en tient d'ailleurs pas compte. Sans le
    tri, réordonner le tableau invaliderait un cache encore juste.
    """
    matiere = "|".join(sorted(empreintes)) + f"#{couleurs}"
    return hashlib.sha256(matiere.encode("utf-8")).hexdigest()[:16]


@dataclass(slots=True)
class Projet:
    """Un univers. Il range, il totalise, et depuis T4 **il contraint**.

    `docs/archive/plan-versions-tenues.md` § Quand chaque entité du modèle d'objets apparaît : le projet portait en T3
    « nom, rangement, total des coûts, journal », et se complète en T4 de la
    bible, des artworks, de la palette et des réglages par défaut. Les artworks,
    eux, ne sont pas ici : ce sont des cartes du tableau, et c'est la carte qui
    porte sa promotion (`atelier/domaine/carte.py`). Les recopier ici ferait deux
    vérités sur la même image.
    """

    identifiant: str
    nom: str
    cree_le: float = field(default_factory=time.time)
    # ── L'ouverture (B4) ─────────────────────────────────────────────────────
    #
    # **Le dernier travail, pas la dernière ouverture — et pourtant c'est bien
    # `choisir()` qui le pose**, faute de mieux : un jeu neuf le vaut déjà par
    # sa création, et l'ouvrir est aujourd'hui le seul geste qu'on puisse
    # dater sans aller chercher dans trois tables. C'est ce que la carte du
    # carnet trie, et ce que le dropdown des cinq derniers jeux lit.
    dernier_travail_le: float = field(default_factory=time.time)
    univers: Univers = field(default_factory=lambda: Univers(bible=bible_complete(())))

    # ── Les teintes d'îlot ───────────────────────────────────────────────────
    #
    # Arrivées en T9 (US-111). Une entrée par nom de groupe, et **pas dans
    # `Univers`** : cet objet-là est défini comme « ce que le projet impose à ce
    # qui rentre, et ce qu'il envoie avec », et une teinte d'îlot ne contraint
    # rien et ne part nulle part. L'y poser aurait été le premier champ à
    # démentir la phrase qui tient tout le reste du fichier.
    #
    # **Ici, et pas sur les cartes du groupe** : un îlot n'a pas d'existence
    # propre, donc six membres feraient six vérités possibles pour un seul
    # cadre (`docs/ARCHITECTURE.md` §5). Une note, elle, *est* un objet et porte
    # la sienne (`atelier/domaine/carte.py`).
    #
    # **Une entrée dont le groupe n'existe plus est effacée par le geste qui l'a
    # vidé**, pas par un balayage — même règle qu'un lien vers un îlot. Un îlot
    # vide n'existe pas, donc sa teinte n'a plus rien à teinter.
    teintes: dict[str, str] = field(default_factory=dict)

    # ── Le plan de poses ─────────────────────────────────────────────────────
    #
    # Arrivé en C1 (US-116). **Sur le projet, et pas dans son `Univers`** : cet
    # objet-là est « ce que le projet impose à ce qui rentre, et ce qu'il envoie
    # avec », et un plan de production n'impose rien à une image importée. Même
    # raison que les teintes d'îlot, un cran plus haut.
    #
    # Un projet neuf en reçoit un, utilisable sans qu'aucune ligne n'ait été
    # écrite — c'est `plan_depuis_json` qui fait la différence entre « jamais
    # écrit » et « vidé par l'auteur ».
    plan: tuple[Pose, ...] = PLAN_PAR_DEFAUT

    # ── Le vestiaire ─────────────────────────────────────────────────────────
    #
    # Arrivé en C3 (US-136, US-137). **À côté du plan, et pour la même raison** :
    # ce sont des listes de production, elles n'imposent rien à une image qui
    # rentre, donc elles ne sont pas dans `Univers`.
    #
    # **Vides à la naissance**, à la différence du plan : personne ne sait
    # d'avance ce qu'un jeu équipe, et « nommer, c'est créer » les remplit sans
    # qu'aucune ligne inventée ait à être effacée d'abord.
    emplacements: tuple[Emplacement, ...] = ()
    pieces: tuple[Piece, ...] = ()

    # Ce qui ne doit plus partir en référence avec **rien de ce projet**
    # (US-126) — la plus large des trois portées. Elle ne dépromeut aucun
    # artwork et ne touche pas à l'univers : c'est un critère d'acceptation de
    # C1, et le ranger ici plutôt que dans `Univers` le rend vrai par
    # construction.
    references_ecartees: tuple[str, ...] = ()

    # ── Les palettes et les ambiances, arrivées en E11 ───────────────────────
    #
    # **La palette du projet en est une comme les autres**, et c'est la
    # simplification qui tient toute la tranche : le projet *est* l'ambiance
    # générale du jeu — une palette, des images officielles, des cases de texte.
    # Il n'y a donc pas deux notions à apprendre. La sienne reste sur
    # `univers.palette`, où trente routes la lisent déjà ; celles-ci sont des
    # objets nommés, en plusieurs exemplaires, qu'on assemble à partir d'elle.
    palettes: tuple[Palette, ...] = ()
    ambiances: tuple[Ambiance, ...] = ()

    def palette_nommee(self, identifiant: str) -> "Palette | None":
        return next((p for p in self.palettes if p.identifiant == identifiant), None)

    def ambiance(self, identifiant: str) -> "Ambiance | None":
        return next((a for a in self.ambiances if a.identifiant == identifiant), None)

    def avec(self, univers: Univers) -> "Projet":
        return replace(self, univers=univers)

    def teinte(self, groupe: str) -> str:
        """La teinte d'un îlot, ou le vide — qui est le châssis, pas un trou."""
        return self.teintes.get(groupe, AUCUNE)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "cree_le": self.cree_le,
            "dernier_travail_le": self.dernier_travail_le,
            "univers": self.univers.en_json(),
            "teintes": dict(self.teintes),
            "plan": [p.en_json() for p in self.plan],
            "emplacements": [e.en_json() for e in self.emplacements],
            "pieces": [p.en_json() for p in self.pieces],
            "references_ecartees": list(self.references_ecartees),
            # ── Les deux listes du côté Ambiances (E11) ──────────────────────
            #
            # **Elles vivent sur le projet, pas sur l'univers**, et c'est
            # délibéré : l'univers est ce que le jeu impose à tout ce qui rentre
            # — la bible, le barème, la taille de pixel —, et le poser réécrit
            # ce que le message porte. Une palette et une ambiance sont des
            # objets qu'on crée, nomme et supprime un par un ; les glisser dans
            # l'univers les aurait exposées au motif payé trois fois : un
            # message partiel traité comme un objet entier (`docs/PIEGES.md`).
            "palettes": [p.en_json() for p in self.palettes],
            "ambiances": [a.en_json() for a in self.ambiances],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Projet":
        return Projet(
            identifiant=d["identifiant"],
            nom=d.get("nom", d["identifiant"]),
            cree_le=d.get("cree_le", 0.0),
            # Un fichier écrit avant B4 n'a pas la colonne : la création est la
            # meilleure date qu'on lui connaisse, pas zéro — sans quoi tous les
            # jeux d'avant B4 tomberaient d'un coup en fin de liste.
            dernier_travail_le=d.get("dernier_travail_le", d.get("cree_le", 0.0)),
            univers=Univers.depuis_json(d.get("univers")),
            # Une teinte inconnue revient vide et l'entrée disparaît : la liste
            # est fermée, et un fichier ne la rouvre pas.
            teintes={
                groupe: teinte_valide(valeur)
                for groupe, valeur in (d.get("teintes") or {}).items()
                if isinstance(groupe, str) and groupe and teinte_valide(valeur)
            },
            plan=plan_depuis_json(d.get("plan")),
            emplacements=emplacements_depuis_json(d.get("emplacements")),
            pieces=pieces_depuis_json(d.get("pieces")),
            references_ecartees=tuple(
                r
                for r in (d.get("references_ecartees") or ())
                if isinstance(r, str) and r
            ),
            palettes=tuple(
                Palette.depuis_json(p)
                for p in (d.get("palettes") or ())
                if isinstance(p, dict) and p.get("identifiant")
            ),
            ambiances=tuple(
                Ambiance.depuis_json(a)
                for a in (d.get("ambiances") or ())
                if isinstance(a, dict) and a.get("identifiant")
            ),
        )


# **Les deux genres d'un membre** (RG5, 20 septembre 2026). Une collection
# rangeait jusqu'ici des sujets seuls ; une matière n'en est pas un
# (`docs/PLAN-rangement.md` § Le mensonge de fond), et pourtant l'auteur doit
# pouvoir la grouper avec ses semblables. Plutôt qu'un second mécanisme de
# groupement — une bibliothèque de plus à tenir d'accord —, `Membre` porte
# désormais lequel des deux il range : le mécanisme ne change pas, ce qu'il
# range s'élargit.
SUJET = "sujet"
MATIERE = "matiere"


@dataclass(frozen=True, slots=True)
class Membre:
    """Un sujet — ou une matière — rangé dans une collection.

    Jamais un identifiant seul, et c'est la seule chose à retenir de cet
    objet. Les identifiants de sujet sont uniques **par jeu** : `balthazar`
    existe dans `coeur-de-pierre-01` comme il pourrait exister ailleurs, et une
    collection peut n'appartenir à aucun jeu (voir la docstring de ce module).
    Un identifiant nu ferait donc entrer le sujet d'un autre jeu dans la
    collection au premier homonyme — silencieusement, et sans qu'aucun écran
    puisse le distinguer d'un rangement voulu.

    **Les mots sont ceux des écrans, `jeu` et `sujet`**, et c'est un choix de
    l'auteur, tranché le 6 septembre 2026 contre la recommandation inverse :
    le code du carnet parlera la langue des maquettes. Ailleurs dans le dépôt
    les mêmes choses s'appellent encore `projet` et `personnage` — un
    `Personnage` porte son `projet`, une image porte son `personnage` —, et la
    traduction se fait aux frontières, en un mot chaque fois.

    ⚠️ **Le champ `Collection.projet` ne suit pas**, et ce n'est pas un oubli :
    c'est le jeu auquel appartient la collection elle-même, il est écrit sous
    ce nom-là dans `collections.json` depuis T3, et le renommer ferait
    disparaître le jeu de toutes les collections déjà sur le disque. Le
    renommage général, s'il vient, est une tranche à lui seul.
    """

    jeu: str
    sujet: str  # l'identifiant du sujet, ou celui de l'image pour une matière
    genre: str = SUJET

    def en_json(self) -> dict[str, Any]:
        # **`genre` ne s'écrit que pour une matière** (RG5), comme `planche` et
        # `depliage` sur `Asset` : un sujet — le cas courant, et tout ce qui
        # existait avant RG5 — garde une fiche au caractère près identique à
        # celle d'hier, ce qui tient le critère « les collections déjà écrites
        # se relisent sans perte » au sens le plus strict, celui de l'octet.
        d: dict[str, Any] = {"jeu": self.jeu, "sujet": self.sujet}
        if self.genre != SUJET:
            d["genre"] = self.genre
        return d


def membres_depuis_json(brut: Any) -> tuple[Membre, ...]:
    """Les membres d'une fiche de collection, dans l'ordre où ils ont été rangés.

    **Une fiche écrite avant B8 n'a pas de membres, et ce n'est pas une
    erreur** : elle rend un tuple vide, la collection se relit, rien n'est
    perdu. C'est ce qui tient le critère « les collections déjà écrites sur le
    disque se relisent sans perte » sans qu'aucune conversion ait lieu.

    **Une fiche écrite avant RG5 n'a pas de genre**, et c'est la même
    tolérance : une entrée sans `genre` est un sujet, comme toutes les
    entrées l'étaient avant que la matière n'existe. Un genre écrit mais
    inconnu retombe sur `sujet`, pour la même raison qu'un membre mal formé
    ne doit pas emporter la collection entière avec lui.

    Ce qui est mal formé — une entrée sans jeu, sans sujet, ou qui n'est pas
    une fiche — est écarté plutôt que de faire échouer la lecture.
    """
    if not isinstance(brut, (list, tuple)):
        return ()
    membres: list[Membre] = []
    deja: set[tuple[str, str, str]] = set()
    for entree in brut:
        if not isinstance(entree, dict):
            continue
        jeu = entree.get("jeu")
        sujet = entree.get("sujet")
        if not isinstance(jeu, str) or not jeu:
            continue
        if not isinstance(sujet, str) or not sujet:
            continue
        genre = entree.get("genre")
        genre = genre if genre in (SUJET, MATIERE) else SUJET
        couple = (jeu, sujet, genre)
        if couple in deja:
            continue
        deja.add(couple)
        membres.append(Membre(jeu=jeu, sujet=sujet, genre=genre))
    return tuple(membres)


@dataclass(slots=True)
class Collection:
    """Un regroupement à plat de **sujets**. Ne contraint rien, ne coûte rien.

    **L'adhésion s'écrit ici, sur la collection, et pas sur le sujet** (B8).
    C'est ce qui rend vrai par construction *retirer une collection ne perd
    aucun sujet* : supprimer, c'est réécrire un fichier, et aucun fichier de
    sujet n'est touché. L'autre sens aurait demandé de balayer tous les sujets
    de tous les jeux — un balayage capable de réussir à moitié, pour un geste
    qui ne devrait rien écrire du tout.

    Un sujet appartient à **plusieurs** collections, et y en ranger un ne le
    retire d'aucune autre. C'est la différence avec ce que portait l'image
    jusqu'à B8.4 — `Asset.collection`, zéro ou une —, et qui en est partie.

    ⚠️ **Une collection d'un jeu accueille le sujet d'un autre, et c'est
    voulu.** Tranché par l'auteur le 6 septembre 2026 : ranger n'est jamais
    refusé, un groupe peut devenir mixte. C'est l'inverse de ce que fait le
    `projet` de la collection pour les **images**, qui décide du leur — mais
    ranger un sujet ne le déplace pas d'univers, il n'y a donc rien à
    trancher et rien à refuser.

    **Ce que ça coûte, et où c'est payé** : un écran qui compte les sujets
    d'une collection doit dire de quel jeu il parle, sinon il additionne deux
    univers. `sujets_du_jeu()` est là pour ça, et c'est par elle que
    l'arbre de `B8.4` et la grille de `B9` liront un groupe.
    """

    identifiant: str
    nom: str
    projet: str | None = None
    cree_le: float = field(default_factory=time.time)
    membres: tuple[Membre, ...] = ()

    def contient(self, jeu: str, sujet: str, genre: str = SUJET) -> bool:
        return Membre(jeu=jeu, sujet=sujet, genre=genre) in self.membres

    def avec(self, jeu: str, sujet: str, genre: str = SUJET) -> "Collection":
        """Le sujet — ou la matière — rangé. **Deux fois ne fait pas deux
        membres** : ranger ce qui est déjà rangé est un geste sans effet, pas
        une erreur — c'est ce qui rend un glisser-déposer répété inoffensif."""
        if self.contient(jeu, sujet, genre):
            return self
        return replace(
            self, membres=self.membres + (Membre(jeu=jeu, sujet=sujet, genre=genre),)
        )

    def sans(self, jeu: str, sujet: str, genre: str = SUJET) -> "Collection":
        """Le sujet retiré du groupe. **Il ne bouge pas lui-même** : ni son
        fichier, ni son jeu, ni ses images."""
        return replace(
            self,
            membres=tuple(
                m
                for m in self.membres
                if m.jeu != jeu or m.sujet != sujet or m.genre != genre
            ),
        )

    def sujets_du_jeu(self, jeu: str) -> tuple[str, ...]:
        """Les sujets de ce jeu-là, dans l'ordre où ils ont été rangés.

        **La méthode par laquelle un groupe se lit**, et pas un raccourci :
        une collection peut mêler deux univers (voir plus haut), si bien que
        lire `membres` sans filtrer, c'est compter deux jeux ensemble.

        **Ne rend que les sujets** (RG5) : une matière rangée dans la même
        collection ne s'y mêle pas, sinon un écran de sujets compterait des
        images. `matieres_du_jeu()`, juste en dessous, rend l'autre moitié."""
        return tuple(m.sujet for m in self.membres if m.jeu == jeu and m.genre == SUJET)

    def matieres_du_jeu(self, jeu: str) -> tuple[str, ...]:
        """Les matières de ce jeu-là, dans l'ordre où elles ont été rangées.

        La jumelle de `sujets_du_jeu()` (RG5) : même filtre par jeu, l'autre
        genre. `sujet` y porte l'identifiant de l'**image**, pas d'un sujet."""
        return tuple(
            m.sujet for m in self.membres if m.jeu == jeu and m.genre == MATIERE
        )

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "projet": self.projet,
            "cree_le": self.cree_le,
            "membres": [m.en_json() for m in self.membres],
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Collection":
        return Collection(
            identifiant=d["identifiant"],
            nom=d.get("nom", d["identifiant"]),
            projet=d.get("projet"),
            cree_le=d.get("cree_le", 0.0),
            membres=membres_depuis_json(d.get("membres")),
        )


_INTERDITS = re.compile(r"[^a-z0-9]+")


def repere(nom: str, pris: object = (), defaut: str = "projet") -> str:
    """Le nom, réduit à ce qu'un dossier accepte partout, et rendu unique.

    Les accents sont dépliés plutôt que remplacés — « Forêt » donne `foret` et
    non `for-t`. Windows, macOS et Linux ne s'accordent ni sur la casse ni sur
    la normalisation Unicode d'un nom de dossier : ne garder que `[a-z0-9-]`
    évite d'avoir un jour à en débattre.

    Un nom qui ne laisse rien — « ✳︎ », « 日本 » — retombe sur `defaut`, puis sur
    `defaut-2` : un dossier sans nom vaut mieux qu'un refus de créer. C1 s'en
    sert pour les poses et les personnages, qui ne sont pas des projets et n'ont
    aucune raison de s'appeler ainsi quand leur nom ne laisse rien.
    """
    deplie = unicodedata.normalize("NFKD", nom)
    sans_accent = "".join(c for c in deplie if not unicodedata.combining(c))
    base = _INTERDITS.sub("-", sans_accent.lower()).strip("-") or defaut

    if base not in pris:
        return base
    rang = 2
    while f"{base}-{rang}" in pris:
        rang += 1
    return f"{base}-{rang}"


def meme_nom(un: str, autre: str) -> bool:
    """Ces deux noms de jeu sont-ils le même, pour un œil humain ? (B14)

    **Les espaces et la casse ne distinguent pas deux jeux.** « le marais » et
    « Le  Marais » donnent deux lignes qu'on ne peut pas différencier dans la
    liste ; les accents, si — « Foret » et « Forêt » se lisent, et l'auteur qui
    écrit les deux sait ce qu'il fait. C'est pour cela que cette comparaison
    n'est **pas** `repere` : le dossier déplie les accents parce qu'un système de
    fichiers l'exige, un lecteur non.
    """
    return " ".join(un.split()).casefold() == " ".join(autre.split()).casefold()


def deja_porte(nom: str, noms: Iterable[str]) -> bool:
    """Un jeu porte-t-il déjà ce nom ? — **la règle vit ici et nulle part ailleurs**.

    Elle sert deux gestes qui n'ont rien d'autre en commun : créer un jeu et en
    renommer un. Les écrire chacun de son côté aurait donné deux définitions de
    « le même nom », et elles auraient divergé au premier accent.

    **Elle avertit, elle ne refuse pas** (B14). Deux jeux du même nom sont
    légitimes — deux essais du même monde, une reprise —, seulement personne ne
    veut y tomber sans l'avoir voulu. Le refus dur est réservé aux cas où le
    produit ne saurait pas quoi faire ensuite ; ici il sait très bien : il crée,
    il donne un dossier distinct, et il le dit.
    """
    return any(meme_nom(nom, autre) for autre in noms)
