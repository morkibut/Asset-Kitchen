# -*- coding: utf-8 -*-
"""Le pliage — N images demandées en un seul appel, et ce qui en revient.

**Ce n'est pas un dispositif du lot de poses** (`docs/ARCHITECTURE.md` § Le
pliage) : c'est la manière dont l'atelier habille ou transforme N images d'un
seul appel, sur une grille carrée dont il connaît la géométrie case par case. La
V2 en a deux usages — créer N corps (C2) et habiller N corps (C3) —, et ce
module ne connaît ni l'un ni l'autre. Il parle de **cases** et de textes.

Deux choses y rattachent une case à ce que le produit en fera, et ce sont deux
désignations, jamais deux règles : `CasePliee.pose`, la même que `Generation.pose`
porte depuis C1 — un corps appartient à une pose, un calque aussi —, et
`CasePliee.base`, l'image qui était dans la case au départ. La seconde est vide
quand la case est partie vide (C2) et remplie quand l'atelier a composé la
planche lui-même (C3) ; c'est elle qui rend l'avant relisable à la relance,
**sans qu'aucune planche soit enregistrée**.

**Le pliage est une ruse d'appel, jamais un format de livraison.** Rien ici ne
décrit une feuille assemblée qu'on garderait : la planche est le brut de sa
génération, et ce qui entre en bibliothèque, ce sont les images séparées.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

__all__ = [
    "CasePliee",
    "Geometrie",
    "MesuresLot",
    "Pliage",
    "geometrie",
]


@dataclass(frozen=True, slots=True)
class Geometrie:
    """Combien de colonnes et de lignes pour tenir N cases.

    **Déduite du nombre de cases, jamais enregistrée** : deux planches du même
    compte ont la même géométrie, et la garder dans le fichier en ferait une
    seconde vérité que la première relecture pourrait contredire.
    """

    cases: int
    colonnes: int
    lignes: int


def geometrie(cases: int) -> Geometrie:
    """La grille la plus carrée qui tienne `cases` sujets.

    **Carrée, et pas en une rangée.** Un modèle rend une image dans les
    proportions qu'on lui impose — 1:1 par défaut (`docs/PIEGES.md`) — et neuf
    sujets alignés dans un carré tiendraient chacun dans un dixième de la
    largeur : ce qui revient serait illisible avant même d'être découpé.

    Le reste tombe dans la dernière rangée, qui est donc incomplète, et les
    cases en trop **n'existent pas** — le gabarit ne les dessine pas, le prompt
    ne les compte pas. Une case vide dessinée dans une planche de création
    serait une case que le modèle remplirait, et le compte tomberait faux pour
    une raison que personne n'aurait demandée.
    """
    nombre = max(1, int(cases))
    colonnes = math.ceil(math.sqrt(nombre))
    return Geometrie(nombre, colonnes, math.ceil(nombre / colonnes))


@dataclass(slots=True)
class CasePliee:
    """Une case de la planche : ce qui s'écrit dans le prompt pour elle, et où
    ira l'image qui en reviendra.

    Le texte est du **produit**, pas du domaine du pliage : « walking, mid-stride »
    ou « le même corps avec le casque en plus ». Ce module ne le lit jamais, il le
    range dans l'ordre.
    """

    texte: str
    pose: str | None = None

    # L'asset qui était dans cette case quand la planche est partie. **Un
    # identifiant, jamais des octets** — même règle qu'une réinjection : la
    # planche se recompose du geste à partir des images qu'il désigne, à la
    # soumission comme à la relance, donc les deux envoient exactement la même
    # chose et rien de neuf n'est écrit sur le disque.
    base: str | None = None

    def en_json(self) -> dict[str, Any]:
        return {"texte": self.texte, "pose": self.pose, "base": self.base}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "CasePliee":
        return CasePliee(
            texte=d.get("texte", ""),
            pose=d.get("pose") or None,
            base=d.get("base") or None,
        )


@dataclass(slots=True)
class Pliage:
    """Ce qu'un appel plié a demandé, et ce que son dépliage a décidé.

    Porté par la génération, à côté de `personnage` et `pose`, et **pour la même
    raison** : ce sont des faits sur l'appel, pas du texte qui part chez le
    fournisseur. `demande` porte ce qui s'écrit dans le prompt — consignes de
    grille comprises, repliées à la soumission comme la bible de T4.

    `refus` garde la raison d'un compte faux. Il reste écrit après une relance :
    l'emplacement, lui, repart à zéro, mais le journal doit pouvoir dire ce qui
    s'était passé la fois d'avant.

    **`geometrie_connue` distingue les deux usages du pliage.** Faux, l'atelier
    part d'une grille vide et ne sait pas ce qui va revenir : il redécoupe sur
    les zones opaques (C2). Vrai, il a composé la planche lui-même et connaît
    l'avant de chaque case : il redécoupe sur la grille exacte qu'il a posée
    (C3). C'est la seule différence entre les deux, et elle tient en un booléen.
    """

    cases: tuple[CasePliee, ...] = ()
    geometrie_connue: bool = False

    # **La part du côté de la case que le sujet occupe**, quand c'est l'atelier
    # qui a composé la planche. Pure géométrie : ce module ne sait pas *pourquoi*
    # on laisse de la place, seulement qu'on en laisse. Elle est enregistrée
    # parce qu'une relance doit envoyer **exactement** la même planche, et que la
    # raison qui l'a fixée — la portée d'une pièce — peut changer entre les deux.
    #
    # Sans objet quand la grille part vide : une case vide n'a rien à occuper.
    occupation: float = 1.0

    refus: str | None = None

    @property
    def nombre(self) -> int:
        return len(self.cases)

    @property
    def geometrie(self) -> Geometrie:
        return geometrie(self.nombre)

    def en_json(self) -> dict[str, Any]:
        forme = self.geometrie
        return {
            "cases": [c.en_json() for c in self.cases],
            "geometrie_connue": self.geometrie_connue,
            "occupation": self.occupation,
            "refus": self.refus,
            # déduits — présents pour l'interface, jamais relus
            "nombre": self.nombre,
            "colonnes": forme.colonnes,
            "lignes": forme.lignes,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Pliage | None":
        """**Rien plutôt qu'un pliage vide.** Une génération ordinaire n'en porte
        pas, et un pliage sans case n'est pas un lot : c'est un enregistrement
        d'avant la tranche, ou un fichier abîmé. Même règle que `lien.py`, qui
        rend rien plutôt que de lever."""
        if not d:
            return None
        cases = tuple(CasePliee.depuis_json(c) for c in d.get("cases", ()))
        if not cases:
            return None
        return Pliage(
            cases=cases,
            geometrie_connue=bool(d.get("geometrie_connue", False)),
            occupation=float(d.get("occupation", 1.0) or 1.0),
            refus=d.get("refus") or None,
        )


@dataclass(slots=True)
class MesuresLot:
    """Ce qu'on a mesuré sur une case au moment où le lot s'est déplié.

    **Elles informent, elles ne refusent jamais.** Le compte d'images est le seul
    refus automatique du produit (`docs/PLAN.md`, C2) ; celles-ci s'affichent et
    laissent l'auteur décider. Deux planches sur vingt-quatre, à l'essai du
    28 août, avaient un compte juste et répétaient une pose : le contrat était
    tenu, la planche sans valeur, et c'est l'auteur qui le voit.

    **Une copie, prise à la naissance**, exactement comme `cout_usd` et `modele`
    sur l'asset, et pour la raison exacte : la ligne de la matrice les porte, et
    aller chercher la génération pour trois nombres serait un aller-retour par
    case affichée. La génération garde le pliage entier ; celle-ci ne garde que
    ce que la case a besoin de dire d'elle-même.

    `ressemblance` est la plus forte des recouvrements de silhouette entre cette
    case et une autre du lot, et `jumeau` dit laquelle. **Le chiffre et son
    jumeau, jamais un seuil** : un seuil serait un nombre inventé sur un corpus
    de vingt-quatre planches, et le produit n'écrit pas de nombre qui ne mesure
    rien.
    """

    case: int = 0
    cases: int = 0
    grille_px: int = 0
    ressemblance: float = 0.0
    jumeau: int = -1
    derive: float = 1.0

    def en_json(self) -> dict[str, Any]:
        return {
            "case": self.case,
            "cases": self.cases,
            "grille_px": self.grille_px,
            "ressemblance": self.ressemblance,
            "jumeau": self.jumeau,
            "derive": self.derive,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "MesuresLot | None":
        if not d:
            return None
        return MesuresLot(
            case=int(d.get("case", 0)),
            cases=int(d.get("cases", 0)),
            grille_px=int(d.get("grille_px", 0)),
            ressemblance=float(d.get("ressemblance", 0.0)),
            jumeau=int(d.get("jumeau", -1)),
            derive=float(d.get("derive", 1.0)),
        )
