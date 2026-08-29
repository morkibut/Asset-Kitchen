# -*- coding: utf-8 -*-
"""L'équipement — où une pièce se pose, ce qu'elle est, et ce qu'on mesure d'elle.

C3. Trois objets, et aucun n'est une image : l'**emplacement** est un endroit du
corps que le projet nomme une fois — la tête, le dos, les jambes —, la **pièce**
est ce qui s'y pose, décrite une fois et posable sur n'importe quel personnage
(US-136, US-137), et les **mesures** disent ce qui a bougé quand elle est
arrivée.

**Ils appartiennent au projet, comme le plan de poses** — et pour la même raison
qu'il n'est pas dans `Univers` : cet objet-là est « ce que le projet impose à ce
qui rentre, et ce qu'il envoie avec », et un vestiaire n'impose rien à une image
importée.

**La portée est déclarée, jamais devinée** (US-139). Une pièce tient dans la
silhouette ou elle l'agrandit, et c'est l'auteur qui le dit : de cette phrase
dépend si l'atelier peut fabriquer un calque ou seulement un corps habillé.
`essais/essai_silhouette.py`, six modèles et deux jets, a mesuré la raison —
jambières 0,3 % de corps repeint, casque 0,8 %, cape **23,5 %** avec un dézoom à
0,62. Aucune détection automatique n'est prévue : `docs/ARCHITECTURE.md` §7 la
range dans « ce que la V2 n'est pas ».

**Un mot pour deux choses, et il faut le savoir.** `atelier/domaine/generation.py`
porte déjà un `Emplacement` : celui-là est la place d'une variation dans un
appel. Celui-ci est une place sur un corps. Ils ne se rencontrent nulle part —
ce module n'est **pas** re-exporté par `atelier/domaine/__init__.py`, et le
service qui touche aux deux ne nomme jamais le type de l'autre.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

__all__ = [
    "AGRANDIT",
    "CONTENUE",
    "ECHELLE_TOLEREE",
    "Emplacement",
    "MesuresCalque",
    "PORTEES",
    "Piece",
    "emplacements_depuis_json",
    "pieces_depuis_json",
]


# ── La portée d'une pièce ────────────────────────────────────────────────────
#
# Deux valeurs, et la liste est close. Elle décide de ce que l'atelier peut
# fabriquer, pas de ce qu'il envoie : les deux partent par le même appel, sur la
# même grille, avec la même consigne. Ce qui change est la place laissée au
# sujet dans sa case, et ce qu'on fait de ce qui revient.
CONTENUE = "contenue"
AGRANDIT = "agrandit"
PORTEES = (CONTENUE, AGRANDIT)


# ── Ce qui décide qu'un calque n'en est plus un ──────────────────────────────
#
# Au-delà de cet écart, le sujet n'est pas revenu à la taille où il est parti.
# **Ce n'est pas un refus, c'est un aiguillage** (US-148) : le compte d'images
# reste le seul refus automatique du produit, l'appel payé est acquis, et ce qui
# revient est gardé — comme des corps habillés au lieu de calques.
#
# Le nombre vient des trois mesures du 28 août 2026 et de rien d'autre :
# jambières 1,00, casque 0,96, cape 0,62. À 0,08 la fourchette accepte
# confortablement les deux qui marchent et rejette celle qui ne marche pas, sans
# qu'aucune valeur intermédiaire n'ait jamais été observée entre les deux.
#
# **Il vit ici depuis C4, et non plus dans `atelier/image/calque.py`** : c'est un
# verdict du produit — calque ou corps habillé —, pas un réglage d'algorithme, et
# le classement d'US-152 le lit pour ramener une dérive d'échelle sur la même
# échelle que les trois autres mesures. Une seule définition, deux lecteurs.
ECHELLE_TOLEREE = 0.08


@dataclass(frozen=True, slots=True)
class Emplacement:
    """Un endroit du corps, et son rang dans l'ordre où l'auteur les pense.

    **Ordonné, jamais trié** (US-136) : la tête vient avant les jambes parce que
    c'est ainsi qu'on habille quelqu'un, pas parce que « j » suit « t ». Le rang
    est celui de la colonne dans la matrice, et c'est tout ce qu'il fait.

    L'identifiant se dérive du nom comme celui d'une pose, et pour la même
    raison : renommer « tête » en « couvre-chef » ne doit rien orpheliner.
    """

    identifiant: str
    nom: str
    rang: int = 0

    def en_json(self) -> dict[str, Any]:
        return {"identifiant": self.identifiant, "nom": self.nom, "rang": self.rang}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Emplacement":
        identifiant = str(d.get("identifiant") or "")
        return Emplacement(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            rang=int(d.get("rang", 0) or 0),
        )


@dataclass(slots=True)
class Piece:
    """Ce qui se pose sur un emplacement — décrite **une fois** (US-137).

    Sa description part dans le prompt de la planche d'équipement, exactement
    comme celle d'un personnage part avec chaque génération de pose : on ne
    réécrit pas « un casque de fer à cornes » à chaque pose qu'on habille.

    **Elle ne porte aucune image, et il n'existe pas d'image d'elle seule.** Une
    pièce n'apparaît que sur un corps (`docs/ARCHITECTURE.md` §7, « ce que la V2
    n'est pas ») : il n'y a donc ni prompt de pièce, ni écran qui en génère une
    sur fond vide. Ce qu'elle désigne, ce sont des cartes du tableau — comme un
    personnage, et par le même mécanisme.
    """

    identifiant: str
    nom: str
    description: str = ""

    # L'emplacement qu'elle occupe. Vide tant que l'auteur n'a rien dit : une
    # pièce sans emplacement est une pièce qu'on vient de nommer, pas une
    # erreur, et la matrice a une colonne pour ça.
    emplacement: str = ""

    # **Contenue, par défaut** (US-139). Le défaut est celui qui marche : c'est
    # la portée des cinq pièces sur six que l'essai du 28 août a mesurées
    # propres, et la seule qui fabrique un calque à coup sûr.
    portee: str = CONTENUE

    # Les cartes du tableau désignées comme concept art (US-124), exactement
    # comme sur un personnage : elles restent où elles sont, et la carte ne sait
    # pas qui la désigne.
    concept_arts: tuple[str, ...] = ()

    @property
    def agrandit(self) -> bool:
        return self.portee == AGRANDIT

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "description": self.description,
            "emplacement": self.emplacement,
            "portee": self.portee,
            "concept_arts": list(self.concept_arts),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Piece":
        identifiant = str(d.get("identifiant") or "")
        portee = str(d.get("portee") or CONTENUE)
        return Piece(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            description=str(d.get("description") or ""),
            emplacement=str(d.get("emplacement") or ""),
            # Une portée inconnue retombe sur le défaut : la liste est close, et
            # un fichier abîmé ne la rouvre pas. Même règle que les teintes.
            portee=portee if portee in PORTEES else CONTENUE,
            concept_arts=tuple(
                c for c in (d.get("concept_arts") or ()) if isinstance(c, str) and c
            ),
        )


@dataclass(slots=True)
class MesuresCalque:
    """Ce qu'on a lu sur une case au moment où le calque est apparu (US-147).

    **Cinq nombres, et aucun ne refuse.** Le compte d'images reste le seul refus
    automatique du produit (`docs/PLAN.md`, C2, reconduit en C3) : celles-ci
    s'affichent, se comparent d'une case à l'autre, et laissent l'auteur juger.
    Une pièce qui repeint 4 % du corps est peut-être exactement ce qu'il
    voulait ; le produit n'en sait rien.

    **Une copie prise à la naissance**, comme `cout_usd`, `modele` et `lot` : la
    case de la matrice les porte, et aller chercher la génération pour cinq
    nombres serait un aller-retour par case affichée.

    Leur définition vient de `essais/essai_silhouette.py`, étalonné le 28 août
    2026 — c'est ce banc qui a décidé de la méthode, et recopier ses mesures
    ailleurs en aurait fait deux qui divergent.

    - `silhouette` — ce qui reste du corps de départ, au meilleur recalage. À
      99 %, le modèle a gardé la forme.
    - `repeint` — la part du corps commun dont la couleur a changé. **C'est la
      colonne qui décide** : une silhouette à 100 % avec 23 % de repeint veut
      dire que le modèle a gardé la forme et redessiné l'intérieur.
    - `ajout` — ce qui est apparu, en part du corps. L'empreinte de la pièce.
    - `echelle` — la taille du sujet au retour, rapportée à celle qui est
      partie. 1,00 : il n'a pas bougé. 0,62 : le modèle a dézoomé pour faire
      tenir la pièce, et il n'y a plus de différence à calculer.
    - `compacite` — la part de la différence qui tient dans sa plus grosse
      tache. Proche de 1 : un objet. Proche de 0 : une poussière semée sur tout
      le corps, c'est-à-dire un repeint déguisé.
    """

    silhouette: float = 0.0
    repeint: float = 0.0
    ajout: float = 0.0
    echelle: float = 1.0
    compacite: float = 1.0

    # ── Ce qui décide de l'ordre où l'on regarde (C4, US-152) ────────────────

    def defaveurs(self) -> tuple[tuple[str, float], ...]:
        """Les quatre mesures ramenées sur une même échelle — 0 va bien, 1 va mal.

        **Quatre, et pas cinq.** `ajout` n'entre pas, et son absence est la
        décision : les quatre autres ont un bon côté connu — la silhouette se
        garde, le repeint s'évite, l'échelle vaut 1, une pièce est un objet et
        non une poussière — quand `ajout` n'en a aucun. Une pièce contenue en
        ajoute peu et va bien ; une pièce qui agrandit en ajoute beaucoup et va
        bien aussi. La ranger dans un classement aurait demandé de choisir un
        sens qu'elle n'a pas, et le classement aurait dit ce choix-là plutôt que
        l'état du calque.

        **Aucune ne refuse, ici non plus** (US-147). Elles ordonnent ce qu'on
        regarde ; elles ne retirent rien, ne colorent rien et n'empêchent rien.
        L'écart d'échelle est rapporté à la tolérance du produit — au-delà, il
        n'y a plus de calque du tout, donc plus rien à graduer.
        """
        return (
            ("silhouette retrouvée", _borne(1.0 - self.silhouette)),
            ("corps repeint", _borne(self.repeint)),
            ("objet ou poussière", _borne(1.0 - self.compacite)),
            ("échelle au retour", _borne(abs(self.echelle - 1.0) / ECHELLE_TOLEREE)),
        )

    def pire(self) -> tuple[str, float]:
        """La mesure la plus défavorable, **nommée** (US-152).

        Le nom compte autant que le nombre : « 0,42 » tout seul demanderait
        d'aller chercher à quoi, et le tri servirait alors à ranger sans dire
        pourquoi. C'est la règle du chiffre et de son jumeau, appliquée au
        classement (`docs/design-motifs.md`).
        """
        return max(self.defaveurs(), key=lambda mesure: mesure[1])

    def en_json(self) -> dict[str, Any]:
        nom, gravite = self.pire()
        return {
            "silhouette": self.silhouette,
            "repeint": self.repeint,
            "ajout": self.ajout,
            "echelle": self.echelle,
            "compacite": self.compacite,
            # déduits — présents pour l'interface, jamais relus. Le classement
            # se calcule **une fois, ici** : un écran qui referait le calcul
            # ferait un jour un second barème, et deux listes triées
            # différemment sur les mêmes cinq nombres.
            "pire": nom,
            "gravite": round(gravite, 4),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "MesuresCalque | None":
        if not d:
            return None
        return MesuresCalque(
            silhouette=float(d.get("silhouette", 0.0)),
            repeint=float(d.get("repeint", 0.0)),
            ajout=float(d.get("ajout", 0.0)),
            echelle=float(d.get("echelle", 1.0)),
            compacite=float(d.get("compacite", 1.0)),
        )


# ── Ce qu'on relit du fichier d'un projet ────────────────────────────────────


def emplacements_depuis_json(brut: Any) -> tuple[Emplacement, ...]:
    """Les emplacements d'un projet, remis dans leur ordre.

    **Vide par défaut, et c'est délibéré.** Le plan de poses, lui, arrive garni :
    un projet neuf en reçoit six parce qu'un critère l'exige, et parce qu'une
    liste vide de poses décourage. Un vestiaire n'a pas cette dette — personne ne
    sait d'avance ce qu'un jeu équipe —, et « nommer, c'est créer » suffit à le
    remplir sans qu'aucune ligne inventée ait à être effacée d'abord.

    Un doublon d'identifiant serait une colonne que la matrice ne saurait pas
    distinguer : le premier gagne. Même règle que `plan_depuis_json`.
    """
    return tuple(
        _sans_doublon(
            Emplacement.depuis_json(e)
            for e in _lisible(brut)
            if isinstance(e, dict) and e.get("identifiant")
        )
    )


def pieces_depuis_json(brut: Any) -> tuple[Piece, ...]:
    return tuple(
        _sans_doublon(
            Piece.depuis_json(p)
            for p in _lisible(brut)
            if isinstance(p, dict) and p.get("identifiant")
        )
    )


def _borne(valeur: float) -> float:
    """Ramené dans [0, 1] — au-delà, il n'y a plus rien à graduer."""
    return max(0.0, min(1.0, valeur))


def _lisible(brut: Any) -> Iterable[Any]:
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return ()
    return brut


def _sans_doublon(objets: Iterable[Any]) -> list[Any]:
    vus: set[str] = set()
    retenus: list[Any] = []
    for objet in objets:
        if objet.identifiant in vus:
            continue
        vus.add(objet.identifiant)
        retenus.append(objet)
    return retenus


# Le rang d'un emplacement qu'on vient de créer, quand l'auteur n'en dit rien :
# **en queue**, jamais trié — même règle que l'ajout d'une pose au plan.
def rang_suivant(emplacements: Iterable[Emplacement]) -> int:
    return max((e.rang for e in emplacements), default=-1) + 1
