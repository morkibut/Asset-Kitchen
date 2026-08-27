# -*- coding: utf-8 -*-
"""La recette — ce qu'on a fait à une image, et rien de plus.

**Le traitement est non destructif** (`docs/ARCHITECTURE.md` §4, règle 5) : on
garde l'image brute et la recette. Le fichier traité est un rendu, écrit sur
disque comme cache et effaçable sans rien perdre. Recalculer coûte des
millisecondes ; regénérer coûte de l'argent et ne rend jamais la même image.

**Les étapes s'appliquent dans un ordre fixe** (règle 4 du même paragraphe). Une
recette n'est donc pas une liste que l'auteur ordonne : c'est une suite de
places nommées, chacune remplie ou vide. Ce n'est pas une simplification, c'est
la seule forme correcte — trois des cinq étapes n'ont aucun sens avant celle qui
les précède :

1. **détourage** — zéro, une ou plusieurs passes. Rien ne peut se recadrer avant,
   parce qu'il n'y a pas d'alpha sur lequel trouver le sujet.
2. **recadrage** — sur la boîte opaque, avec sa marge.
3. **grille** — l'échelle du sujet et la taille du bloc de pixel, en une seule
   opération : c'est le même rééchantillonnage qui règle les deux.
4. **quantification** — après la réduction, jamais avant : quantifier 1024 px
   pour les jeter ensuite coûte cent fois plus pour le même résultat.
5. **bords** — le dernier mot, sur l'image telle qu'elle sortira.

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
# Deux, et le second est facultatif. Le remplissage depuis le bord ne demande
# aucun modèle, aucun téléchargement et aucun réseau : mesuré le 27 août 2026
# sur douze images de six modèles, PNG et JPEG, il rend douze silhouettes
# propres — squelette blanc sur fond gris clair et fioles translucides compris.
# C'est le moteur du geste courant. Le modèle, lui, existe pour les images qui
# n'ont pas été fabriquées ici et n'ont donc pas de fond plat.

BORD = "bord"
MODELE = "modele"
MOTEURS = (BORD, MODELE)

# Au-delà de ce seuil, un pixel appartient au sujet ; en dessous, au fond.
# **Se durcit avant la réduction, jamais après** — piège payé au prix fort dans
# `MySpriteAi/src/lib/pixelPipeline.ts` : un contour à demi transparent est
# tranché à pile ou face par un rééchantillonnage au plus proche voisin, et deux
# passes de suite rendent alors deux silhouettes différentes. Pire, la
# quantification force l'alpha à 255 sans toucher à la couleur : un pixel de
# contour à peine visible ressort **opaque, de la couleur du fond**. C'est le
# liseré clair autour du sprite.
SEUIL_ALPHA = 128


@dataclass(frozen=True, slots=True)
class Passe:
    """Une passe de détourage. Plusieurs s'enchaînent (US-70).

    Chacune porte **son** seuil et **son** durcissement : une première passe
    large dégrossit le fond, une seconde plus serrée nettoie ce qui reste.
    """

    moteur: str = BORD
    tolerance: int = 28  # ± sur chaque composante, pour le moteur « bord »
    seuil_alpha: int = SEUIL_ALPHA
    durcissement: int = 0  # pixels rongés au bord après le seuil, 0 à 4

    def en_json(self) -> dict[str, Any]:
        return {
            "moteur": self.moteur,
            "tolerance": self.tolerance,
            "seuil_alpha": self.seuil_alpha,
            "durcissement": self.durcissement,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Passe":
        return Passe(
            moteur=d.get("moteur", BORD),
            tolerance=int(d.get("tolerance", 28)),
            seuil_alpha=int(d.get("seuil_alpha", SEUIL_ALPHA)),
            durcissement=int(d.get("durcissement", 0)),
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

    def en_json(self) -> dict[str, Any]:
        return {
            "cible": self.cible,
            "occupation": self.occupation,
            "ancrage": self.ancrage,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Grille":
        return Grille(
            cible=int(d.get("cible", 64)),
            occupation=int(d.get("occupation", 100)),
            ancrage=d.get("ancrage", BAS),
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
    """Le dernier mot : ce qui traîne autour du sujet une fois tout appliqué."""

    aire_min: int = 0  # taches plus petites que ça : effacées

    def en_json(self) -> dict[str, Any]:
        return {"aire_min": self.aire_min}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Bords":
        return Bords(aire_min=int(d.get("aire_min", 0)))


@dataclass(frozen=True, slots=True)
class Recette:
    """Cinq places nommées, dans un ordre qui ne se négocie pas."""

    passes: tuple[Passe, ...] = ()
    recadrage: Recadrage | None = None
    grille: Grille | None = None
    quantification: Quantification | None = None
    bords: Bords | None = None
    nom: str | None = None  # une recette nommée est une recette (US-66)

    # ── Ce qu'elle est ───────────────────────────────────────────────────────

    @property
    def vide(self) -> bool:
        """Rien à faire : le rendu **est** le brut, et il n'y a pas de cache."""
        return not (
            self.passes
            or self.recadrage
            or self.grille
            or self.quantification
            or self.bords
        )

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
            "recadrage": self.recadrage.en_json() if self.recadrage else None,
            "grille": self.grille.en_json() if self.grille else None,
            "quantification": (
                self.quantification.en_json() if self.quantification else None
            ),
            "bords": self.bords.en_json() if self.bords else None,
            "nom": self.nom,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Recette":
        if not d:
            return Recette()
        return Recette(
            passes=tuple(Passe.depuis_json(p) for p in d.get("passes", ())),
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
            nom=d.get("nom"),
        )
