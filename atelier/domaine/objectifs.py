"""L'intention de sortie d'un sujet, distincte de ses sources et de son jugement.

Une absence d'objectif conserve le plan historique. Une liste vide explicite
demande zéro résultat : elle ne se transforme jamais en un plan par défaut.
Les poses et directions portent leurs identifiants existants, donc les renommer
ne détache ni les demandes ni les résultats.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any, Literal
from uuid import NAMESPACE_URL, uuid5


def identifiant_sortie(nature: str, pose: str, direction: str) -> str:
    cle = json.dumps([nature, pose, direction], ensure_ascii=False)
    return str(uuid5(NAMESPACE_URL, "asset-kitchen:objectif:" + cle))


@dataclass(frozen=True, slots=True)
class SortieDemandee:
    nature: Literal["image", "animation"]
    pose: str
    direction: str = ""
    quantite: int = 1

    @property
    def identifiant(self) -> str:
        return identifiant_sortie(self.nature, self.pose, self.direction)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nature": self.nature,
            "pose": self.pose,
            "direction": self.direction,
            "quantite": self.quantite,
        }


@dataclass(frozen=True, slots=True)
class ObjectifProduction:
    sorties: tuple[SortieDemandee, ...] = ()
    largeur: int = 64
    hauteur: int = 64
    cadence: float = 8.0
    boucle: bool = True
    # Repère en pixels dans le résultat attendu, origine en haut à gauche.
    repere_x: float = 32.0
    repere_y: float = 64.0

    def en_json(self) -> dict[str, Any]:
        return {
            "sorties": [sortie.en_json() for sortie in self.sorties],
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "cadence": self.cadence,
            "boucle": self.boucle,
            "repere": {"x": self.repere_x, "y": self.repere_y},
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> ObjectifProduction:
        """Validation commune au disque, à l'API et au MCP, sans arrondir une demande."""
        if not isinstance(d, dict) or not isinstance(d.get("sorties"), list):
            raise ValueError("l'objectif doit déclarer sa liste de sorties")
        largeur = _entier(d.get("largeur", 64), 1, 8192, "largeur")
        hauteur = _entier(d.get("hauteur", 64), 1, 8192, "hauteur")
        cadence = _nombre(d.get("cadence", 8), 0.1, 240, "cadence")
        boucle = d.get("boucle", True)
        if not isinstance(boucle, bool):
            raise ValueError("la boucle doit être activée ou désactivée")
        repere = d.get("repere", {"x": largeur / 2, "y": hauteur})
        if not isinstance(repere, dict):
            raise ValueError("le repère doit porter ses coordonnées x et y")
        x = _nombre(repere.get("x", largeur / 2), -8192, 8192, "repère x")
        y = _nombre(repere.get("y", hauteur), -8192, 8192, "repère y")
        sorties: list[SortieDemandee] = []
        deja: set[str] = set()
        for brut in d["sorties"]:
            if not isinstance(brut, dict) or brut.get("nature") not in ("image", "animation"):
                raise ValueError("une sortie demande une image ou une animation")
            pose = brut.get("pose")
            direction = brut.get("direction", "")
            if not isinstance(pose, str) or not pose.strip():
                raise ValueError("une sortie doit désigner un mouvement ou une pose")
            if not isinstance(direction, str):
                raise ValueError("la direction doit porter son identifiant")
            quantite = _entier(brut.get("quantite", 1), 1, 64, "quantité")
            if brut["nature"] == "animation" and quantite != 1:
                raise ValueError("une animation suffit par mouvement et direction ; ses frames sont dedans")
            sortie = SortieDemandee(brut["nature"], pose, direction, quantite)
            if sortie.identifiant in deja:
                raise ValueError("une sortie est demandée deux fois pour la même pose et direction")
            deja.add(sortie.identifiant)
            sorties.append(sortie)
        return ObjectifProduction(tuple(sorties), largeur, hauteur, cadence, boucle, x, y)


def _entier(valeur: Any, bas: int, haut: int, nom: str) -> int:
    if isinstance(valeur, bool) or not isinstance(valeur, int) or not bas <= valeur <= haut:
        raise ValueError(f"{nom} doit être un entier entre {bas} et {haut}")
    return valeur


def _nombre(valeur: Any, bas: float, haut: float, nom: str) -> float:
    if isinstance(valeur, bool) or not isinstance(valeur, (int, float)):
        raise ValueError(f"{nom} doit être un nombre")
    if not math.isfinite(valeur) or not bas <= valeur <= haut:
        raise ValueError(f"{nom} doit être compris entre {bas} et {haut}")
    return float(valeur)
