"""Un atlas orthogonal, ses terrains et une carte d’essai explicitement peinte."""
from __future__ import annotations
import copy
import re
from typing import Any
from atelier.domaine.erreurs import ErreurAtelier

class TuilesRefusees(ErreurAtelier):
    code = "tuiles_refusees"

# Géométrie carrée : mêmes huit positions dans l’éditeur et dans Godot.
RACCORDS = ("nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest")

def entier(v, nom, minimum, maximum):
    if isinstance(v, bool) or not isinstance(v, int) or not minimum <= v <= maximum:
        raise TuilesRefusees(f"{nom} doit être un entier entre {minimum} et {maximum}.")
    return v

def grille(brut, largeur, hauteur):
    if not isinstance(brut, dict) or set(brut) - {"taille", "marge", "espacement"}:
        raise TuilesRefusees("La grille contient une taille, une marge et un espacement en pixels.")
    t = entier(brut.get("taille", 16), "La taille de tuile", 2, 512)
    m = entier(brut.get("marge", 0), "La marge", 0, 1024)
    e = entier(brut.get("espacement", 0), "L’espacement", 0, 256)
    colonnes, lignes = (largeur - 2*m + e) // (t+e), (hauteur - 2*m + e) // (t+e)
    if colonnes < 1 or lignes < 1 or colonnes * lignes > 4096:
        raise TuilesRefusees("La grille doit contenir entre 1 et 4 096 tuiles entières dans l’image.")
    return {"taille": t, "marge": m, "espacement": e, "colonnes": colonnes, "lignes": lignes}

def choix(brut: dict[str, Any], g: dict[str, int]) -> dict[str, Any]:
    if not isinstance(brut, dict) or set(brut) - {"nom", "terrains", "cellules", "carte"}:
        raise TuilesRefusees("Les réglages de tuiles contiennent nom, terrains, cellules et carte.")
    nom = brut.get("nom", "")
    if not isinstance(nom, str) or not nom.strip() or len(nom) > 160:
        raise TuilesRefusees("Donnez un nom de 1 à 160 caractères à l’ensemble.")
    terrains = brut.get("terrains", [])
    if not isinstance(terrains, list) or len(terrains) > 32:
        raise TuilesRefusees("Un ensemble peut déclarer jusqu’à 32 terrains nommés.")
    ids = set()
    for t in terrains:
        if not isinstance(t, dict) or set(t) != {"identifiant", "nom", "couleur"} or not isinstance(t["identifiant"], str) or not re.fullmatch(r"[a-z0-9_-]{1,80}", t["identifiant"]) or t["identifiant"] in ids:
            raise TuilesRefusees("Chaque terrain doit avoir un identifiant unique, un nom et une couleur.")
        if not isinstance(t["nom"], str) or not t["nom"].strip() or len(t["nom"]) > 80 or not isinstance(t["couleur"], str) or not re.fullmatch(r"#[a-fA-F0-9]{6}", t["couleur"]):
            raise TuilesRefusees("Le nom ou la couleur du terrain est invalide.")
        ids.add(t["identifiant"])
    cellules = brut.get("cellules", [])
    if not isinstance(cellules, list) or not cellules or len(cellules) > 4096:
        raise TuilesRefusees("Déclarez les cellules à conserver dans l’atlas.")
    connues, normalisees = set(), []
    for c in cellules:
        if not isinstance(c, dict) or set(c) - {"x", "y", "nom", "retenue", "terrain", "raccords", "correction"}:
            raise TuilesRefusees("Une cellule contient ses coordonnées, son nom, son jugement et ses raccords.")
        x, y = entier(c.get("x"), "La colonne", 0, g["colonnes"]-1), entier(c.get("y"), "La ligne", 0, g["lignes"]-1)
        if (x, y) in connues: raise TuilesRefusees("Une cellule ne se déclare qu’une fois.")
        connues.add((x, y))
        nom_c = c.get("nom", f"Tuile {x+1} · {y+1}")
        if not isinstance(nom_c, str) or len(nom_c) > 120 or not isinstance(c.get("retenue", False), bool):
            raise TuilesRefusees("Le nom ou le jugement de la tuile est invalide.")
        terrain = c.get("terrain")
        raccords = c.get("raccords", {})
        if not isinstance(raccords, dict) or set(raccords) - set(RACCORDS) or any(v is not None and (not isinstance(v, str) or v not in ids) for v in [terrain, *raccords.values()]):
            raise TuilesRefusees("Choisissez des terrains déclarés pour le centre et les huit raccords.")
        correction = c.get("correction")
        if correction is not None and (not isinstance(correction, str) or not correction):
            raise TuilesRefusees("Une correction désigne une image de la bibliothèque.")
        normalisees.append({"x": x, "y": y, "nom": nom_c, "retenue": c.get("retenue", False), "terrain": terrain,
                            "raccords": {n: raccords.get(n) for n in RACCORDS}, "correction": correction})
    carte = brut.get("carte", {"largeur": 8, "hauteur": 6, "cases": []})
    if not isinstance(carte, dict) or set(carte) != {"largeur", "hauteur", "cases"} or not isinstance(carte["cases"], list):
        raise TuilesRefusees("La carte contient ses dimensions et les cases peintes.")
    w, h = entier(carte["largeur"], "La largeur de carte", 1, 64), entier(carte["hauteur"], "La hauteur de carte", 1, 64)
    if len(carte["cases"]) > w*h or w*h*g["taille"]**2 > 4096**2:
        raise TuilesRefusees("La carte d’essai doit rester sous 4 096 cases et 16 millions de pixels.")
    occupees = set()
    for c in carte["cases"]:
        if not isinstance(c, dict) or set(c) != {"x", "y", "tuile_x", "tuile_y"}:
            raise TuilesRefusees("Chaque case indique sa position et la tuile choisie.")
        xy = entier(c["x"], "La colonne de carte", 0, w-1), entier(c["y"], "La ligne de carte", 0, h-1)
        entier(c["tuile_x"], "La colonne de tuile", 0, g["colonnes"]-1)
        entier(c["tuile_y"], "La ligne de tuile", 0, g["lignes"]-1)
        if xy in occupees or (c["tuile_x"], c["tuile_y"]) not in connues:
            raise TuilesRefusees("Une case est peinte une seule fois avec une tuile déclarée.")
        occupees.add(xy)
    return copy.deepcopy({"nom": nom.strip(), "terrains": terrains, "cellules": normalisees,
                          "carte": {"largeur": w, "hauteur": h, "cases": carte["cases"]}})
