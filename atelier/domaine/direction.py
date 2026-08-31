# -*- coding: utf-8 -*-
"""Les directions du jeu — **le second axe d'une case, et le premier qui manquait**.

Dans un jeu vu de dessus, un personnage qui marche se dessine quatre fois : vers
le bas, vers le haut, vers la gauche, vers la droite. Jusqu'à E10 le produit ne
connaissait pas cette idée. Il connaissait une pose appelée « marche » et un
nombre d'images à remplir — **sans savoir ce que chacune de ces images devait
montrer**. Il ne pouvait donc pas dire qu'il manquait le nord.

**Ce que ça coûtait est mesuré sur le vrai projet.** La direction était écrite à
la main dans la case `technique` de la bible — `4-directional orientation` — et
partait avec les vingt-huit générations, dont six planches d'équipement où elle
contredisait la consigne de l'appel. Et sur une génération, l'auteur avait tapé
la direction dans le champ de prompt lui-même : *The dwarf is in walking posture
in south direction*. Sept endroits sans lien entre eux.

**Une direction porte deux textes, et un seul part.** Le nom est en français,
parce qu'on le lit ; la consigne est en anglais, parce qu'elle part. C'est le
même partage que la pose depuis E10 (`atelier/domaine/plan.py`), et il est fait
pour la même raison : ce qui se lit et ce qui part ne sont pas le même texte, et
les confondre faisait partir « sud » au milieu d'une phrase anglaise.

**Écrite une fois sur la direction, jamais recopiée sur les poses.** Six poses
dans quatre directions, c'est vingt-quatre cases ; écrire `facing south` sur
chacune ferait vingt-quatre copies d'un texte qu'une correction devrait ensuite
retrouver une par une. La consigne d'une image se **compose** de l'attitude et
de la direction, au moment de générer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class Direction:
    """Un angle sous lequel le jeu regarde une chose, et ce qu'il en dit.

    **L'identifiant ne bouge pas quand le nom change**, exactement comme pour
    une pose : les images faites portent l'identifiant de leur direction, et
    renommer « sud » en « vers le joueur » ne doit pas leur faire perdre leur
    case.
    """

    identifiant: str
    nom: str

    # **Ce qui part au modèle, en anglais.** Vide est une valeur : une direction
    # sans consigne ne dit rien au modèle, et c'est le cas d'une direction que
    # l'auteur vient d'ajouter et n'a pas encore décrite. Le produit ne traduit
    # pas à sa place — il n'invente pas un texte qui partira dans un appel payé.
    consigne: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "consigne": self.consigne,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Direction":
        identifiant = str(d.get("identifiant") or "")
        return Direction(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            consigne=str(d.get("consigne") or ""),
        )


def directions_depuis_json(brut: Any) -> tuple[Direction, ...] | None:
    """La liste relue du fichier d'un projet — **et l'absence en vaut une**.

    `None` veut dire *jamais écrite*, et la liste se lit alors dans la vue du
    jeu : c'est l'état ordinaire, celui que le codex affiche « lues ». Une liste
    vide veut dire *l'auteur les a toutes retirées*, et elle reste vide. Le
    motif `lu or DEFAUT`, qui sert ailleurs, ferait ici ressusciter à chaque
    relecture très exactement ce que l'auteur venait de retirer — c'est déjà la
    décision de `plan_depuis_json` et celle des poses d'un type.
    """
    if brut is None:
        return None
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return None  # pragma: no cover — fichier abîmé
    lues = [
        Direction.depuis_json(d)
        for d in brut
        if isinstance(d, dict) and d.get("identifiant")
    ]
    # Deux directions de même identifiant seraient deux colonnes que la matrice
    # ne saurait pas distinguer : la première gagne.
    vues: set[str] = set()
    retenues: list[Direction] = []
    for direction in lues:
        if direction.identifiant in vues:
            continue
        vues.add(direction.identifiant)
        retenues.append(direction)
    return tuple(retenues)


def composer(attitude: str, direction: str) -> str:
    """Les deux textes bout à bout — **et c'est tout ce que la composition est**.

    `walking posture, full body` + `facing south, toward the viewer` donne
    `walking posture, full body, facing south, toward the viewer`. Écrit ici
    plutôt qu'à deux endroits parce que le sujet d'une case et la case d'une
    planche le demandent tous les deux, et que deux façons de coller deux textes
    finiraient par en produire deux différents pour la même image.

    Un texte vide ne laisse pas de virgule derrière lui : une direction sans
    consigne — celle qu'on vient d'ajouter — ne doit pas faire partir un prompt
    qui se termine par une virgule.
    """
    return ", ".join(mot for mot in (attitude.strip(), direction.strip()) if mot)
