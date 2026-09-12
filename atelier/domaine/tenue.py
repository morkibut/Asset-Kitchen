"""Une tenue choisit des emplois et des résultats précis, jamais un favori mouvant."""
from __future__ import annotations

import math

from atelier.domaine.erreurs import ErreurAtelier


class TenueRefusee(ErreurAtelier):
    code = "tenue_refusee"


def normaliser(demande: dict) -> dict:
    nom = str(demande.get("nom", "")).strip()
    if not nom or len(nom) > 160:
        raise TenueRefusee("Donnez un nom à cette tenue, de 160 caractères au maximum.")
    resultats = demande.get("resultats", [])
    if not isinstance(resultats, list) or not resultats:
        raise TenueRefusee("Choisissez au moins une pose ou animation du personnage.")
    sorties, vus = [], set()
    for valeur in resultats:
        if not isinstance(valeur, dict) or valeur.get("nature") not in ("image", "animation") or not isinstance(valeur.get("identifiant"), str):
            raise TenueRefusee("Chaque résultat doit nommer son image ou son animation.")
        cle = (valeur["nature"], valeur["identifiant"])
        if cle in vus:
            raise TenueRefusee("Ce résultat est choisi deux fois.")
        vus.add(cle)
        sorties.append({"nature": cle[0], "identifiant": cle[1], "boucle": bool(valeur.get("boucle", True))})
    emplois = demande.get("emplois", [])
    if not isinstance(emplois, list):
        raise TenueRefusee("Choisissez les emplois à combiner.")
    pieces, liens = set(), []
    for valeur in emplois:
        if not isinstance(valeur, dict) or not all(isinstance(valeur.get(k), str) and valeur[k] for k in ("piece", "emploi")):
            raise TenueRefusee("Chaque pièce doit nommer son emploi pour ce personnage.")
        if valeur["piece"] in pieces:
            raise TenueRefusee("Une même pièce ne peut occuper deux emplois dans cette tenue.")
        pieces.add(valeur["piece"])
        priorite = valeur.get("priorite", len(liens))
        if isinstance(priorite, bool) or not isinstance(priorite, int) or abs(priorite) > 1000:
            raise TenueRefusee("La priorité doit être un entier compris entre −1000 et 1000.")
        liens.append({"piece": valeur["piece"], "emploi": valeur["emploi"], "actif": bool(valeur.get("actif", True)), "priorite": priorite})
    choix = demande.get("choix", {})
    if not isinstance(choix, dict) or any(not isinstance(v, dict) or any(not isinstance(k, str) or not isinstance(i, str) for k, i in v.items()) for v in choix.values()):
        raise TenueRefusee("Les choix de variantes doivent nommer la cible et la pièce.")
    pivot = demande.get("pivot")
    if pivot is not None and (not isinstance(pivot, dict) or set(pivot) != {"x", "y"} or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 8192 for v in pivot.values())):
        raise TenueRefusee("Le pivot demande deux coordonnées finies en pixels, entre −8192 et 8192.")
    return {"nom": nom, "resultats": sorties, "emplois": liens, "choix": choix, "pivot": pivot}
