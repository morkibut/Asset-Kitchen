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
from atelier.domaine.teinte import AUCUNE, teinte_valide
from atelier.domaine.direction import Direction, directions_depuis_json
from atelier.domaine.vue import AUCUNE_VUE, vue as vue_connue
from atelier.domaine.recette import (
    BAS,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
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
# **Sans lui, tout ce qui sort du produit fait la même hauteur** (`docs/PLAN.md`,
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

    # **Combien de couleurs on demande à la palette.** Elle, on ne la saisit
    # jamais : elle se déduit par calcul des artworks officiels (US-54). Ce
    # chiffre-ci est le seul réglage qu'on ait sur elle.
    couleurs: int = 24

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

    # **Le modèle est un défaut par type d'asset, pas un réglage global**
    # (`docs/PLAN.md`, T4). Une famille sans modèle retombe sur le défaut du
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

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    @property
    def vide(self) -> bool:
        """Rien de posé : ni bible qui parle, ni palette. Le produit prend le
        relais, et c'est un état normal, pas une configuration manquante."""
        return not (self.palette or any(c.porte for c in self.bible))

    def champ(self, nom: str) -> Champ:
        for c in self.bible:
            if c.nom == nom:
                return c
        return Champ(nom)

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

    def recette_de(self, echelle: Echelle | None) -> Recette:
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

        **La quantification n'entre que s'il y a une palette.** Sans artwork
        officiel il n'y a pas de palette, et ce n'est pas une pièce manquante :
        c'est l'état réel d'un univers vide, qui ne contraint rien (US-57).
        """
        silhouette = echelle.silhouette if echelle else True
        return Recette(
            passes=(Passe(),) if silhouette else (),
            recadrage=Recadrage() if silhouette else None,
            grille=(
                Grille(
                    cible=self.cible_px,
                    occupation=echelle.occupation if echelle else 100,
                    ancrage=BAS,
                )
                if self.cible_px != AUCUNE_CIBLE
                else None
            ),
            quantification=(
                Quantification(couleurs=self.couleurs, palette=self.palette)
                if self.palette
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
            "cible_px": self.cible_px,
            "vue": self.vue,
            "directions": (
                None
                if self.directions is None
                else [d.en_json() for d in self.directions]
            ),
            "couleurs": self.couleurs,
            "palette": list(self.palette),
            "palette_empreinte": self.palette_empreinte,
            "modeles": dict(self.modeles),
            "modele_planche": self.modele_planche,
            "modele_edition": self.modele_edition,
            # déduit — présent pour l'interface, jamais relu
            "vide": self.vide,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Univers":
        if not d:
            return Univers(bible=bible_complete(()))
        bareme = tuple(Echelle.depuis_json(e) for e in d.get("bareme", ()))
        return Univers(
            bible=bible_complete(Champ.depuis_json(c) for c in d.get("bible", ())),
            bareme=bareme or BAREME_PAR_DEFAUT,
            cible_px=int(d.get("cible_px", CIBLE_PAR_DEFAUT)),
            vue=str(d.get("vue") or AUCUNE_VUE),
            directions=directions_depuis_json(d.get("directions")),
            couleurs=int(d.get("couleurs", 24)),
            palette=tuple(d.get("palette", ())),
            palette_empreinte=d.get("palette_empreinte", ""),
            modeles={
                f: m for f, m in (d.get("modeles") or {}).items() if f in FAMILLES and m
            },
            modele_planche=d.get("modele_planche", "") or "",
            modele_edition=d.get("modele_edition", "") or "",
        )


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

    `docs/PLAN.md` § Quand chaque entité du modèle d'objets apparaît : le projet portait en T3
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
