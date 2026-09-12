"""Composer plusieurs pièces sans qu'un masque de corps efface une autre pièce."""
from __future__ import annotations

import numpy as np
from PIL import Image

from atelier.domaine.calques_cibles import PlacementCalque
from atelier.image.calques_cibles import couches, png


def preparer_couches(base: np.ndarray, calques: list[dict]) -> list[dict]:
    resultat = []
    for calque in calques:
        dessous, corps, dessus = couches(base, calque["pixels"], PlacementCalque.depuis_json(calque["placement"]), calque["masques"])
        # Blanc conserve le corps, transparent le cache ; le masque reste
        # indépendant de l'alpha d'origine, y compris sur son bord transparent.
        temoin = np.full(base.shape, 255, dtype=np.uint8)
        _, masque, _ = couches(temoin, calque["pixels"], PlacementCalque.depuis_json(calque["placement"]), calque["masques"])
        resultat.append({"piece": calque["piece"], "priorite": calque["priorite"],
                         "ordre": calque["placement"].get("ordre", 0),
                         "dessous": dessous, "dessus": dessus, "masque_corps": masque})
    return sorted(resultat, key=lambda c: (c["priorite"], c["ordre"], c["piece"]))


def composer_couches(base: np.ndarray, couches: list[dict], actifs: set[str]) -> bytes:
    corps = base.copy()
    presentes = [c for c in couches if c["piece"] in actifs]
    for calque in presentes:
        corps[:, :, 3] = np.minimum(corps[:, :, 3], calque["masque_corps"][:, :, 3])
    resultat = Image.new("RGBA", (base.shape[1], base.shape[0]))
    for calque in presentes:
        resultat = Image.alpha_composite(resultat, Image.fromarray(calque["dessous"]))
    resultat = Image.alpha_composite(resultat, Image.fromarray(corps))
    for calque in presentes:
        resultat = Image.alpha_composite(resultat, Image.fromarray(calque["dessus"]))
    return png(resultat)
