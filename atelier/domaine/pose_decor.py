"""Le décor autour des bords (TU8) : les gravats qui débordent d'un bord, posés par
paires — une moitié extérieure, sur la case vide qui touche la matière, une moitié
intérieure, sur la case de matière d'en face.

Portage de `emplacementsDecor` et `hachage01`
(`interface/src/tuiles/moteur/tile-scene.js`, la copie de TU1, commit f27f054 de
sc-clone). Même hachage, au bit près (`essais/tu8_reference_decor.mjs` fige la sortie du
moteur pour `tests/test_tu8_decor.py`) ; même boucle, dans le même ordre — là où deux
jonctions se disputeraient une case, c'est la première vue qui la garde, ici comme là-bas
(voir `reservees`).

Module pur : ni disque, ni image, ni service. Il ignore tout de ce qu'est l'occupation —
`occupe(x, y)` la lui donne — pour servir aussi bien un sol ou un chemin (occupation :
une case peinte) qu'un mur (occupation : `atelier.domaine.pose_mur.occupation_mur`,
pentes comprises).
"""
from __future__ import annotations

from typing import Callable, Iterable

# Les deux crans qui posent quelque chose : des SEUILS de tirage, pas des comptes.
SEUILS = {"aucun": 0, "leger": 0.42, "dense": 0.88}

# Décalages de graine, distincts les uns des autres : présence, orientation et variante
# sont trois tirages indépendants (DECOR_GRAINE_* de tile-scene.js).
GRAINE_PRESENCE, GRAINE_ORIENTATION, GRAINE_VARIANTE = 7717, 7723, 7741

ORIENTATIONS = ("n", "e", "s", "w")
VARIANTES = 3
OPPOSE = {"n": "s", "e": "w", "s": "n", "w": "e"}
VECTEUR = {"n": (0, -1), "e": (1, 0), "s": (0, 1), "w": (-1, 0)}


def hachage01(x: int, y: int, graine: int) -> float:
    """`hachage01` : un hachage entier ordinaire de (x, y, graine), dans [0, 1).

    Même arithmétique que `Math.imul` en JavaScript (une multiplication 32 bits, le
    débordement inclus) : `& 0xFFFFFFFF` tronque chaque produit à 32 bits, ce qui rend
    le même motif de bits que `Math.imul`, signé ou pas — seul le motif compte ici, tout
    le reste n'est que des `^` et des `>>>`, insensibles au signe.
    """
    def imul(a: int, b: int) -> int:
        return (a * b) & 0xFFFFFFFF

    h = (imul(x, 374761393) ^ imul(y, 668265263) ^ imul(graine, 2246822519)) & 0xFFFFFFFF
    h = imul(h ^ (h >> 15), 2246822519) & 0xFFFFFFFF
    h = imul(h ^ (h >> 13), 3266489917) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFFFFFF) / 4294967296


def emplacements(occupe: Callable[[int, int], bool], colonnes: int, lignes: int, densite: str,
                  graine: int = 0, variantes: int = VARIANTES,
                  orientations: Iterable[str] = ORIENTATIONS) -> list[dict]:
    """`emplacementsDecor` : les pièces de décor d'une carte, une par case au plus.

    Chaque pièce est une MOITIÉ d'une jonction, jamais un bout de bord isolé (T24, la
    fente de fond de 4 px) : la moitié extérieure se pose sur la case vide qui touche la
    matière, la moitié intérieure sur la case de matière d'en face, appuyée sur le bord
    opposé — les deux dans la même instruction, sauf si la case intérieure porte déjà la
    pièce d'une autre jonction (une couche de tuiles ne porte qu'une tuile par case).
    """
    seuil = SEUILS.get(densite, 0)
    if not seuil:
        return []
    orientations = tuple(orientations)
    pieces: list[dict] = []
    reservees: set[tuple[int, int]] = set()
    for y in range(lignes):
        for x in range(colonnes):
            if occupe(x, y):
                continue
            cotes = [o for o in orientations if occupe(x + VECTEUR[o][0], y + VECTEUR[o][1])]
            if not cotes:
                continue
            if hachage01(x, y, graine + GRAINE_PRESENCE) >= seuil:
                continue
            orientation = cotes[min(len(cotes) - 1, int(hachage01(x, y, graine + GRAINE_ORIENTATION) * len(cotes)))]
            variante = min(variantes - 1, int(hachage01(x, y, graine + GRAINE_VARIANTE) * variantes))
            pieces.append({"x": x, "y": y, "orientation": orientation, "variante": variante, "moitie": "exterieure"})
            dx, dy = VECTEUR[orientation]
            ix, iy = x + dx, y + dy
            if (ix, iy) in reservees:
                continue
            reservees.add((ix, iy))
            pieces.append({"x": ix, "y": iy, "orientation": OPPOSE[orientation],
                           "variante": (variante + 1) % variantes, "moitie": "interieure"})
    return pieces
