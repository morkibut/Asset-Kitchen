"""AU15 : une variante d'équipement vise un résultat et une occurrence précis.

Le calque de pose C3 et le suivi TIENT/GLISSE B20 restent des objets distincts.
Ils ne gagnent pas de direction ou de numéro de frame inventés à la relecture.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any

from atelier.domaine.recette import Trait


@dataclass(frozen=True, slots=True)
class CibleCalque:
    nature: str
    resultat: str
    prise: str = ""

    def en_json(self) -> dict[str, str]:
        return asdict(self)

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> CibleCalque:
        if d.get("nature") not in ("image", "frame") or not d.get("resultat"):
            raise ValueError("une cible désigne une image fixe ou une frame de bande")
        if not isinstance(d["resultat"], str) or not isinstance(d.get("prise", ""), str):
            raise ValueError("la cible doit porter des identifiants")
        if d["nature"] == "frame" and not d.get("prise"):
            raise ValueError("la frame doit porter son identifiant d’occurrence")
        if d["nature"] == "image" and d.get("prise"):
            raise ValueError("une image fixe ne porte pas d’occurrence de frame")
        return CibleCalque(d["nature"], d["resultat"], d.get("prise", ""))


@dataclass(frozen=True, slots=True)
class PlacementCalque:
    dx: float = 0
    dy: float = 0
    echelle: float = 1
    rotation: float = 0
    opacite: float = 1
    devant: bool = True
    ordre: int = 0

    def en_json(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> PlacementCalque:
        valeurs = asdict(PlacementCalque())
        limites = {"dx": (-8192, 8192), "dy": (-8192, 8192), "echelle": (.01, 16),
                   "rotation": (-180, 180), "opacite": (0, 1), "ordre": (-1000, 1000)}
        for nom, valeur in d.items():
            if nom == "devant":
                if not isinstance(valeur, bool):
                    raise ValueError("l’ordre devant ou derrière doit être explicite")
            elif nom in limites:
                bas, haut = limites[nom]
                if isinstance(valeur, bool) or not isinstance(valeur, (float, int)) or not math.isfinite(valeur) or not bas <= valeur <= haut:
                    raise ValueError(f"réglage {nom} hors limites : {bas} à {haut}")
                if nom == "ordre" and not isinstance(valeur, int):
                    raise ValueError("l’ordre entre équipements doit être entier")
            else:
                raise ValueError(f"réglage inconnu : {nom}")
            valeurs[nom] = valeur
        return PlacementCalque(**valeurs)


def masques_valides(d: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Trois couches de main indépendantes, avec le Trait CPU existant.

    calque : garder/effacer les pixels locaux ; corps : garder/masquer le corps
    en coordonnées du cadre ; derriere : vrai passe ce morceau sous le corps.
    """
    if not isinstance(d, dict) or set(d) - {"calque", "corps", "derriere"}:
        raise ValueError("masques attendus : calque, corps et derriere")
    rendus = {}
    for nom in ("calque", "corps", "derriere"):
        traits = d.get(nom, [])
        if not isinstance(traits, list) or len(traits) > 10000:
            raise ValueError("un masque doit être une liste de passages de pinceau")
        rendus[nom] = []
        for brut in traits:
            if not isinstance(brut, dict) or not isinstance(brut.get("garde", True), bool):
                raise ValueError("un passage indique s’il garde ou efface")
            rayon = brut.get("rayon", 0)
            points = brut.get("points", [])
            if not isinstance(rayon, int) or not 0 <= rayon <= 128 or not isinstance(points, list):
                raise ValueError("rayon de pinceau ou chemin invalide")
            if any(not isinstance(p, (list, tuple)) or len(p) != 2 or any(isinstance(v, bool) or not isinstance(v, int) or abs(v) > 16384 for v in p) for p in points):
                raise ValueError("un point de pinceau porte deux coordonnées entières")
            trait = Trait.depuis_json(brut)
            if trait:
                rendus[nom].append(trait.en_json())
    return rendus
