"""Le temps de calcul d'un son, quand aucune mesure n'existe encore.

Le bouton d'un calcul local porte un temps mesuré sur cette machine (règle
8ter). Avant le premier tirage d'un moteur, il n'y a rien à mesurer : ACE-Step
annonçait alors « temps inconnu », et la veille de la file locale attendait dix
minutes par défaut — trop pour un jingle de 10 s, trop peu pour une musique de
dix minutes sur le modèle base.

Ce module donne une **estimation de repli**, et rien d'autre : coût fixe plus
coût par seconde de son, calé sur des temps réels relevés le 10 octobre 2026 sur
la machine de l'auteur (RTX 8 Go), réglages par défaut (compositeur actif, pas
du modèle). Dès qu'une médiane existe pour le même modèle et le même réglage,
c'est elle qui parle.

- XL turbo : droite des moindres carrés sur les trois points relevés.
- turbo et base : un seul point chacun (150 s de son) ; ils gardent la forme
  de la droite du XL, mise à l'échelle pour passer par leur point.
"""
from __future__ import annotations

# (secondes de son, secondes de calcul), relevés du 10 octobre 2026.
RELEVES_XL = ((10.0, 35.0), (60.0, 80.0), (150.0, 215.0))
# Un point à 150 s de son pour les deux autres modèles.
POINT_TURBO = (150.0, 185.0)
POINT_BASE = (150.0, 232.0)


def _droite(points):
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    pente = sum((x - mx) * (y - my) for x, y in points) / sum((x - mx) ** 2 for x, _ in points)
    return my - pente * mx, pente


FIXE_XL, PENTE_XL = _droite(RELEVES_XL)


def _echelle(point):
    secondes, calcul = point
    return calcul / (FIXE_XL + PENTE_XL * secondes)


# Facteur appliqué à la droite du XL, par identifiant de profil.
FACTEURS = {
    "ace-step-15-xl-turbo": 1.0,
    "ace-step-15-turbo": _echelle(POINT_TURBO),
    "ace-step-15-base": _echelle(POINT_BASE),
}


def identifiant_de_modele(modele):
    """`ComfyUI:ace-step-15-turbo@3` → `ace-step-15-turbo`."""
    if not isinstance(modele, str):
        return None
    return modele.removeprefix("ComfyUI:").split("@", 1)[0]


def estimation_de_repli(modele, secondes, reglage=None):
    """Les secondes de calcul attendues pour `secondes` de son, ou `None`
    quand on ne sait rien dire : moteur sans relevé, durée inconnue, ou
    réglage qui change le temps (compositeur coupé, autres pas) — les relevés
    ont été faits aux réglages par défaut, et les appliquer à un autre réglage
    serait deviner."""
    facteur = FACTEURS.get(identifiant_de_modele(modele))
    if facteur is None or reglage is not None:
        return None
    if isinstance(secondes, bool) or not isinstance(secondes, (int, float)) or not secondes > 0:
        return None
    return round(facteur * (FIXE_XL + PENTE_XL * float(secondes)), 1)
