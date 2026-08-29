# -*- coding: utf-8 -*-
"""La recette — ce qu'on a fait à une image, et rien de plus.

**Le traitement est non destructif** (`docs/ARCHITECTURE.md` §4, règle 5) : on
garde l'image brute et la recette. Le fichier traité est un rendu, écrit sur
disque comme cache et effaçable sans rien perdre. Recalculer coûte des
millisecondes ; regénérer coûte de l'argent et ne rend jamais la même image.

**Les étapes s'appliquent dans un ordre fixe** (règle 4 du même paragraphe). Une
recette n'est donc pas une liste que l'auteur ordonne : c'est une suite de
places nommées, chacune remplie ou vide. Ce n'est pas une simplification, c'est
la seule forme correcte — cinq des six étapes n'ont aucun sens avant celle qui
les précède :

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
6. **bords** — le dernier mot, sur l'image telle qu'elle sortira.

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

    Un trait sans point ne fait rien : `depuis_json` le laisse tomber au lieu de
    lever, comme un lien sans extrémité (`domaine/lien.py`). Les points hors du
    cadre ne lèvent pas non plus — ils se bornent, comme le rectangle de C3.
    """

    garde: bool = True
    rayon: int = 0
    points: tuple[tuple[int, int], ...] = ()

    def en_json(self) -> dict[str, Any]:
        return {
            "garde": self.garde,
            "rayon": self.rayon,
            "points": [list(p) for p in self.points],
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
    """Six places nommées, dans un ordre qui ne se négocie pas."""

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
            nom=d.get("nom"),
        )
