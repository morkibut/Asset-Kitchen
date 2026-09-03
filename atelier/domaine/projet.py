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


# ── Quand l'auteur redit ce que l'atelier allait dire ────────────────────────
#
# **Trois cases seulement**, celles où l'atelier écrit une phrase de lui-même :
# le rendu dit la grille, la technique dit le calage, la vue dit la caméra. Les
# quatre autres — le monde, l'époque, le trait, l'éclairage — n'ont pas de
# phrase d'atelier, et rien à arbitrer.
#
# **Des mots, pas une intention.** On ne devine pas si l'auteur voulait préciser
# ou remplacer ; on regarde s'il parle déjà du même sujet. Une case `vue` qui
# contient `top-down`, `camera`, `isometric` ou `side view` parle bien de la
# caméra, et la phrase de l'atelier en ferait une seconde. Une case `vue` qui
# dirait seulement *un peu resserré sur le sujet* n'en parle pas, et les deux
# s'empilent comme avant.
#
# **La liste est courte exprès.** Chaque mot ajouté est un cas où l'atelier se
# tait ; en ajouter un de trop ferait disparaître une phrase que personne
# n'aurait remplacée. On préfère l'empilement — visible, et corrigeable d'un
# clic à l'écran de confirmation — au silence.
_REDITES: dict[str, tuple[str, ...]] = {
    "vue": (
        "top-down",
        "top down",
        "overhead",
        "side view",
        "front view",
        "front-facing",
        "isometric",
        "oblique",
        "camera",
        "3/4",
        "three-quarter",
        "orthographic",
    ),
    "rendu": ("pixel art on a", "px grid", "x grid", "grid,"),
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
    Echelle("élément d'interface", INTERFACE, 100),
)

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
    # **Un réglage, pas un calcul**, et c'est l'arbitrage de l'auteur du
    # 2 septembre 2026. `atelier.domaine.fond.proposer` calcule la distance de
    # quelques couleurs franches à la palette du jeu et nomme la première qui
    # passe le seuil ; l'écran la propose, l'auteur tranche, et *s'il n'y a pas
    # de candidat sûr l'atelier le dit* au lieu de choisir en silence.
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

        **Le fond y entre en D3, et pour la raison exacte de la vue** : c'est un
        choix que personne ne fait par défaut — il n'y en a pas —, donc « posé »
        et « pas encore touché » s'y distinguent sans ambiguïté. Sans cette
        ligne, un jeu dont on vient de choisir le fond se dirait vierge, et la
        phrase de calage — celle qui *porte* ce fond — ne partirait pas : on
        aurait réglé la couleur et rien ne serait parti avec.
        """
        return not (
            self.palette or self.vue or self.fond or any(c.porte for c in self.bible)
        )

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
            cible = self.cible_px if self.style == PIXEL_ART else 0
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
        """
        champ = self.champ(nom)
        if not champ.actif:
            return ""
        atelier = "" if self.vide else self.phrase_du_produit(nom)
        ecrit = champ.texte.strip()
        if atelier and ecrit and _redit(nom, ecrit):
            return ecrit
        morceaux = [atelier, ecrit]
        return ", ".join(m for m in morceaux if m)

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
            bareme=bareme or BAREME_PAR_DEFAUT,
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


@dataclass(slots=True)
class Collection:
    """Un regroupement à plat. Ne contraint rien, ne coûte rien."""

    identifiant: str
    nom: str
    projet: str | None = None
    cree_le: float = field(default_factory=time.time)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "projet": self.projet,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Collection":
        return Collection(
            identifiant=d["identifiant"],
            nom=d.get("nom", d["identifiant"]),
            projet=d.get("projet"),
            cree_le=d.get("cree_le", 0.0),
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
