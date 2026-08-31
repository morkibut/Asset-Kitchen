# -*- coding: utf-8 -*-
"""Les palettes nommées et les ambiances — deux objets, et ce qui les distingue.

**Une palette est une liste de couleurs qui porte un nom**, tirée d'un paquet
d'images. Elle ne dit rien du style en mots : elle ne porte que des couleurs.

**Une ambiance est un lot de style tout prêt**, réutilisable sur plusieurs choses
du jeu. Elle porte trois choses, et trois seulement : une palette, des images de
référence, et trois cases de texte — le monde, l'éclairage, le trait. Elle ne
produit rien et ne contient rien ; elle sert à régler ce qu'on produit ailleurs.

**Le projet est l'ambiance générale du jeu** — même objet en plus grand : une
palette, des images officielles, des cases de texte. Il n'y a donc pas deux
notions à apprendre, et c'est la simplification qui tient toute la tranche.

**Une palette reste une recette, et c'est le point délicat.** La règle du dépôt
dit que la palette du projet ne se saisit jamais : elle se calcule des images
officielles et se range comme un résultat temporaire, nommé par l'empreinte de ce
dont il est la lecture. Pouvoir retirer une couleur, en ajouter une, doser entre
deux palettes et finir à la main **casserait** cette règle si la palette devenait
une liste qu'on modifie — elle cesserait de suivre ses sources, et promouvoir une
nouvelle image ne changerait plus rien. Le produit a déjà le motif qui s'en sort,
et il l'applique partout : **on garde la source et la recette, le résultat est un
calcul jetable**. C'est le brut / recette / rendu d'une image, appliqué à une
palette ; recalculer coûte des millisecondes, et rien n'est perdu.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any, Iterable

# ── Ce qu'une source peut être ───────────────────────────────────────────────
#
# Trois genres, et pas un de plus. Les images d'un paquet du tableau, pour une
# palette de base ; les images officielles du jeu, qui sont la source de la
# palette du projet depuis T4 ; une autre palette, ce qui permet d'assembler une
# ambiance à partir de ce qui existe déjà. « La palette est dérivable de ses
# sources » ne bouge pas — ce qui change est ce qu'une source peut être.

IMAGES = "images"
OFFICIELS = "officiels"
PALETTE = "palette"
GENRES_DE_SOURCE = (IMAGES, OFFICIELS, PALETTE)

# ── Les trois retouches ──────────────────────────────────────────────────────
#
# Des gestes **rangés un par un**, jamais fondus dans le résultat, pour trois
# raisons : chacun s'annule seul, chacun se voit, et le tout se rejoue si une
# source change.

RETIRER = "retirer"
AJOUTER = "ajouter"
REMPLACER = "remplacer"
GESTES = (RETIRER, AJOUTER, REMPLACER)

# **D'où une couleur du résultat vient**, et c'est la seule façon de comprendre
# ce qu'on regarde : une palette d'ambiance est un mélange, et sans ces marques
# on ne saurait pas si un gris vient du jeu — donc si le changer ici serait une
# exception ou une redite.
DU_JEU = "jeu"
DE_L_AMBIANCE = "ambiance"
DE_LA_MAIN = "main"

# Combien de couleurs une palette rend, et les bornes du produit. Les mêmes que
# la palette du projet : un second jeu de bornes ici aurait fait deux réponses à
# la même question.
COULEURS_MIN = 4
COULEURS_MAX = 64


@dataclass(slots=True)
class Source:
    """Ce dans quoi les couleurs se lisent.

    `reference` désigne la chose selon le genre : un nom de paquet du tableau
    pour `images`, l'identifiant d'une autre palette pour `palette`, rien pour
    `officiels` — les images officielles du jeu sont déjà désignées par leur
    propre marque, et les recopier ici ferait deux vérités sur la même liste.
    """

    genre: str = IMAGES
    reference: str = ""

    def en_json(self) -> dict[str, Any]:
        return {"genre": self.genre, "reference": self.reference}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Source":
        genre = str(d.get("genre") or IMAGES)
        return Source(
            genre=genre if genre in GENRES_DE_SOURCE else IMAGES,
            reference=str(d.get("reference") or ""),
        )


@dataclass(slots=True)
class Retouche:
    """Un geste de la main sur la palette rendue, gardé tel quel.

    `couleur` est celle qu'on vise ; `remplacement` n'a de sens que pour
    `remplacer`. Une retouche qui viserait une couleur que les sources ne
    rendent plus **n'est pas une erreur** : elle ne trouve rien et ne fait rien,
    et elle reste là — c'est ce qui permet à une source de revenir sans qu'on
    ait à retaper le geste.
    """

    geste: str = RETIRER
    couleur: str = ""
    remplacement: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "geste": self.geste,
            "couleur": self.couleur,
            "remplacement": self.remplacement,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Retouche":
        geste = str(d.get("geste") or RETIRER)
        return Retouche(
            geste=geste if geste in GESTES else RETIRER,
            couleur=str(d.get("couleur") or "").lower(),
            remplacement=str(d.get("remplacement") or "").lower(),
        )


@dataclass(slots=True)
class Palette:
    """Une palette nommée : ses sources, sa fusion, ses retouches, son rendu.

    **Le rendu est un cache nommé par sa provenance**, comme celui du projet
    depuis T4 : `empreinte` dit de quoi ces couleurs-là sont la lecture, et
    changer une source, un curseur ou une retouche ne correspond plus, donc
    recalcule. C'est le même mécanisme qu'avant, avec plus de choses dedans.

    **Les deux curseurs répondent à deux questions distinctes.** `du_jeu` dit
    combien de couleurs viennent de la première source — sur 24 couleurs : 8 du
    jeu, 16 de l'ambiance —, et chaque couleur du résultat est authentiquement
    l'une de celles d'une source, donc chaque pastille sait d'où elle vient.
    `attraction` dit de combien les autres se rapprochent : chaque couleur est
    tirée vers la plus proche de celles du jeu, de 0 à 100 %. C'est ce qui
    harmonise — le marais reste un marais, mais il respire l'air du jeu.

    Mesuré avant d'écrire une ligne (`essais/essai_couleurs_et_taches.py`, le
    31 août 2026) : croisés, les deux curseurs rendent 21 résultats distincts sur
    25 combinaisons — ils ne font pas le même travail. Et le banc a trouvé le
    seul endroit où l'attraction meurt : à `du_jeu == couleurs`, il ne reste
    aucune couleur d'ambiance à tirer, et les cinq valeurs rendent le même
    fichier. C'est là, et seulement là, qu'elle se grise avec sa raison.
    """

    identifiant: str
    nom: str
    sources: tuple[Source, ...] = ()
    couleurs: int = 24
    # Combien des `couleurs` viennent de la **première** source. Le reste vient
    # des suivantes, réduit puis attiré.
    du_jeu: int = 0
    attraction: float = 0.0
    retouches: tuple[Retouche, ...] = ()

    # Le résultat, et de quoi il est la lecture. Jetable : le service le
    # recalcule dès que l'empreinte ne correspond plus.
    rendue: tuple[str, ...] = ()
    empreinte: str = ""
    cree_le: float = field(default_factory=time.time)

    @property
    def attraction_inerte(self) -> bool:
        """**L'attraction ne fait rien** : il ne reste aucune couleur à tirer.

        Une seule cause, mesurée : la proportion est à « tout du jeu ». Le
        produit grise alors le curseur **avec sa raison**, plutôt que de laisser
        déplacer un réglage qui rendrait le même fichier.
        """
        return self.du_jeu >= self.couleurs

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "sources": [s.en_json() for s in self.sources],
            "couleurs": self.couleurs,
            "du_jeu": self.du_jeu,
            "attraction": self.attraction,
            "retouches": [r.en_json() for r in self.retouches],
            "rendue": list(self.rendue),
            "empreinte": self.empreinte,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Palette":
        couleurs = max(COULEURS_MIN, min(COULEURS_MAX, int(d.get("couleurs", 24) or 24)))
        return Palette(
            identifiant=str(d.get("identifiant") or ""),
            nom=str(d.get("nom") or ""),
            sources=tuple(
                Source.depuis_json(s)
                for s in (d.get("sources") or [])
                if isinstance(s, dict)
            ),
            couleurs=couleurs,
            du_jeu=max(0, min(couleurs, int(d.get("du_jeu", 0) or 0))),
            attraction=max(0.0, min(1.0, float(d.get("attraction", 0.0) or 0.0))),
            retouches=tuple(
                Retouche.depuis_json(r)
                for r in (d.get("retouches") or [])
                if isinstance(r, dict)
            ),
            rendue=tuple(str(c).lower() for c in (d.get("rendue") or [])),
            empreinte=str(d.get("empreinte") or ""),
            cree_le=float(d.get("cree_le", 0) or time.time()),
        )


@dataclass(slots=True)
class Ambiance:
    """Un lot de style tout prêt : une palette, des références, trois textes.

    **Et rien d'autre.** Ce qui lui est fermé l'est pour une raison écrite :
    *vue* et *technique* décrivent la mécanique du jeu — l'angle de caméra, le
    calage sur la grille, le nombre de directions —, et une ambiance qui les
    remplacerait fabriquerait des images qui ne rentrent pas dans le jeu, erreur
    qui ne se verrait qu'après avoir payé. *Époque* et *rendu* restent au jeu
    parce qu'un coin plus sombre reste du même siècle et du même pixel art.

    **Elle ne contient aucune image.** La supprimer ne détruit donc rien : les
    choses qui s'en servaient retombent sur le jeu. Il n'y a pas de trou,
    seulement un réglage qu'on ne pose plus.
    """

    identifiant: str
    nom: str
    palette: str = ""
    # Des cartes du tableau d'inspiration, désignées — jamais copiées. Elles
    # partent **en image** avec les générations qui utilisent l'ambiance, et
    # prennent les places de référence que le projet aurait remplies.
    references: tuple[str, ...] = ()
    monde: str = ""
    eclairage: str = ""
    trait: str = ""
    cree_le: float = field(default_factory=time.time)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "palette": self.palette,
            "references": list(self.references),
            "monde": self.monde,
            "eclairage": self.eclairage,
            "trait": self.trait,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Ambiance":
        return Ambiance(
            identifiant=str(d.get("identifiant") or ""),
            nom=str(d.get("nom") or ""),
            palette=str(d.get("palette") or ""),
            references=tuple(str(r) for r in (d.get("references") or []) if r),
            monde=str(d.get("monde") or ""),
            eclairage=str(d.get("eclairage") or ""),
            trait=str(d.get("trait") or ""),
            cree_le=float(d.get("cree_le", 0) or time.time()),
        )


# ── Ce qu'une chose du jeu prend à son ambiance ──────────────────────────────
#
# **Une ambiance ne s'impose pas** : on la désigne, puis on choisit ce qu'on lui
# prend. Trois réponses, mesurées sur trois cas réels de la maquette — un rôdeur
# des vases prend tout ; une ombre rampante, de forme complètement différente des
# références, ne prend que les couleurs ; Balthazar en version noire prend les
# couleurs et le texte, mais garde sa propre image de référence.

TOUT = "tout"
COULEURS_SEULES = "couleurs"
SANS_LES_IMAGES = "sans-images"
CE_QU_ON_PREND = (TOUT, COULEURS_SEULES, SANS_LES_IMAGES)

NOM_DE_CE_QU_ON_PREND: dict[str, str] = {
    TOUT: "tout",
    COULEURS_SEULES: "les couleurs seulement",
    SANS_LES_IMAGES: "tout sauf les images",
}


def empreinte_de_palette(
    sources: Iterable[str], couleurs: int, du_jeu: int, attraction: float,
    retouches: Iterable[Retouche],
) -> str:
    """De quoi cette palette-là est la lecture — **les trois parties ensemble**.

    Les sources, les deux curseurs, et la liste des retouches. Changer n'importe
    lequel invalide la palette rendue, qui se recalcule. C'est ce qui préserve ce
    qui était le vrai enjeu : **promouvoir une nouvelle image officielle se
    propage encore jusqu'en bas**, même à travers une ambiance retouchée à la
    main.

    Les sources entrent dans leur ordre, contrairement à celles du projet : ici
    la première décide de ce que `du_jeu` prélève, et deux ordres différents sont
    deux palettes différentes.
    """
    gestes = "|".join(f"{r.geste}:{r.couleur}>{r.remplacement}" for r in retouches)
    matiere = (
        "|".join(sources)
        + f"#{couleurs}/{du_jeu}/{round(attraction, 4)}"
        + f"@{gestes}"
    )
    return hashlib.sha256(matiere.encode("utf-8")).hexdigest()[:16]
