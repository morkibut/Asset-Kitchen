"""La recette d'un jeu de tuiles fabriqué (TU2) : une liste fermée, vérifiée ici.

Un jeu de tuiles **fabriqué** garde sa recette — sorte, taille, graine, matières par
emplacement, réglages du moteur — et l'atlas qu'elle a rendu, figé en asset. Un jeu sans
recette reste un jeu « à partir d'une image » (AU13), inchangé.

Les noms et les bornes des réglages sont ceux du panneau de sc-clone
(`public/tools.js`, `tileSettings` et `mountTiles`, commit f27f054), en français. Chaque
réglage dit à quelles sortes il s'applique : un réglage posé sur une sorte qui ne le
connaît pas est refusé plutôt qu'ignoré, sinon il resterait écrit sans rien changer.
"""
from __future__ import annotations

import re
from typing import Any, Callable

from atelier.domaine.masques_tuiles import SORTES
from atelier.domaine.tuiles import TuilesRefusees

TAILLES = (16, 32, 64)
GRAINE_MAX = 2**31 - 1

# Les 13 matières dessinées par le code (sc-clone, public/tile-materials.js) : identifiant
# → nom affiché. Vérifié contre la fixture par tests/test_tu2_recette.py.
MATIERES_INTEGREES = {
    "herbe": "Herbe", "prairie": "Herbe haute", "pierre": "Dalles de pierre", "brique": "Briques",
    "roche": "Roche brute", "terre": "Terre battue", "sable": "Sable", "eau": "Eau", "bois": "Planches",
    "neige": "Neige", "feuillage": "Feuillage", "lave": "Lave", "carrelage": "Carrelage de donjon",
}

# Les emplacements (public/tile-emplacements.js). `suit` : la surface qu'une bordure
# suit tant que son lien tient.
EMPLACEMENTS = {"surface": None, "bordure": "surface", "face": None, "bas": None, "bordureBas": "bas"}
NOMS_EMPLACEMENTS = {"surface": "la surface", "bordure": "la bordure", "face": "la face du mur",
                     "bas": "le sol dessous", "bordureBas": "la bordure du dessous"}

_A_MASQUES = frozenset({"sol", "chemin", "coins-15"})
_TOUTES = frozenset(SORTES)
_DECOR = _A_MASQUES | {"mur"}
_IMAGES = (0, 2, 3, 4, 6, 8)
_NIVEAUX = ("aucune", "discrete", "marquee")

# nom → (genre, admis, défaut, sortes, libellé). Genres : « entier » (admis = bornes),
# « parmi » (admis = valeurs), « couleur » (#rrggbb), « booleen ».
REGLAGES: dict[str, tuple[str, Any, Any, frozenset, str]] = {
    "bordures": ("parmi", ("organiques", "nettes"), "organiques", _TOUTES, "Les bordures"),
    "arrondi": ("entier", (0, 8), 2, _TOUTES, "L’arrondi"),
    "irregularite": ("entier", (0, 10), 3, _TOUTES, "L’irrégularité"),
    "nuances": ("parmi", (2, 4, 8), 4, _TOUTES, "Les nuances"),
    "relief": ("entier", (0, 10), 4, _TOUTES, "Le relief"),
    "reduction": ("parmi", ("moyenne", "compensee", "contraste"), "contraste", _TOUTES, "La réduction"),
    "couleurSurface": ("couleur", None, "#92af70", _TOUTES, "La couleur de repli de la surface"),
    "couleurContour": ("couleur", None, "#43563d", _TOUTES, "La couleur de repli du contour"),
    "fondBlanc": ("booleen", None, False, _TOUTES, "Le fond blanc"),
    "variantes": ("entier", (0, 3), 0, _A_MASQUES, "Les variantes de la pièce pleine"),
    "animation": ("parmi", _IMAGES, 0, _A_MASQUES, "Les images d’animation"),
    "animationAtlas": ("parmi", _IMAGES, 0, _A_MASQUES, "L’animation de tout l’atlas"),
    "secondTerrain": ("booleen", None, False, _A_MASQUES, "Le second terrain"),
    "couleurDessous": ("couleur", None, "#d6b476", _A_MASQUES, "La couleur de repli du sol dessous"),
    "couleurContourDessous": ("couleur", None, "#96764a", _A_MASQUES, "La couleur de repli du contour du dessous"),
    "decor": ("parmi", ("aucun", "leger", "dense"), "aucun", _DECOR, "Le décor"),
    "hauteurMur": ("entier", (1, 8), 2, frozenset({"mur"}), "La hauteur du mur"),
    "ombreMur": ("parmi", _NIVEAUX, "discrete", frozenset({"mur"}), "L’ombre portée du mur"),
    "penombre": ("parmi", _NIVEAUX, "discrete", frozenset({"mur"}), "La pénombre d’angle du mur"),
}

_SORTES_EN_CLAIR = {"sol": "un sol", "chemin": "un chemin", "mur": "un mur", "coins-15": "un jeu 15 pièces",
                    "pieces-17": "un jeu 17 pièces"}


def _entier(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _reglage(nom: str, v: Any) -> Any:
    genre, admis, _, _, libelle = REGLAGES[nom]
    if genre == "booleen" and not isinstance(v, bool):
        raise TuilesRefusees(f"{libelle} se coche ou se décoche (vrai ou faux).")
    if genre == "couleur":
        if not isinstance(v, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            raise TuilesRefusees(f"{libelle} s’écrit #rrggbb.")
        return v.lower()
    if genre == "entier" and (not _entier(v) or not admis[0] <= v <= admis[1]):
        raise TuilesRefusees(f"{libelle} est un entier de {admis[0]} à {admis[1]}.")
    if genre == "parmi" and (isinstance(v, bool) or v not in admis):
        raise TuilesRefusees(f"{libelle} vaut {', '.join(f'« {a} »' for a in admis)}.")
    return v


def reglages(brut: Any, sorte: str) -> dict[str, Any]:
    """Les réglages complétés de leurs défauts — seulement ceux que la sorte connaît."""
    if brut is None:
        brut = {}
    if not isinstance(brut, dict):
        raise TuilesRefusees("Les réglages d’un jeu de tuiles se donnent par leur nom.")
    for nom in brut:
        if nom not in REGLAGES:
            raise TuilesRefusees(f"« {nom} » n’est pas un réglage de jeu de tuiles. Réglages connus : {', '.join(REGLAGES)}.")
        if sorte not in REGLAGES[nom][3]:
            raise TuilesRefusees(f"{REGLAGES[nom][4]} ne s’applique pas à {_SORTES_EN_CLAIR[sorte]}.")
    sortie = {nom: _reglage(nom, brut[nom]) if nom in brut else defaut
              for nom, (_, _, defaut, sortes, _) in REGLAGES.items() if sorte in sortes}
    if sortie.get("animation") and sortie.get("animationAtlas"):
        raise TuilesRefusees("Choisissez l’animation de la pièce pleine ou celle de tout l’atlas, pas les deux.")
    return sortie


def emplacements_actifs(sorte: str, second_terrain: bool) -> tuple[str, ...]:
    actifs = ["surface", "bordure"]
    if sorte == "mur":
        actifs.append("face")
    if second_terrain:
        actifs += ["bas", "bordureBas"]
    return tuple(actifs)


def _source(nom: str, v: Any, asset_valide: Callable[[str], bool]) -> dict[str, Any]:
    ou = NOMS_EMPLACEMENTS[nom]
    if not isinstance(v, dict) or v.get("source") not in ("integree", "asset", "vide"):
        raise TuilesRefusees(f"Pour {ou}, choisissez une matière intégrée, une image du jeu, ou rien.")
    cles = {"source", "lie"} | ({"nom"} if v["source"] == "integree" else {"asset"} if v["source"] == "asset" else set())
    if set(v) - cles or ("lie" in v and not EMPLACEMENTS[nom]):
        raise TuilesRefusees(f"L’emplacement {ou} contient une source{' et son lien' if EMPLACEMENTS[nom] else ''}, rien d’autre.")
    if "lie" in v and not isinstance(v["lie"], bool):
        raise TuilesRefusees(f"Le lien de {ou} est vrai ou faux.")
    if v["source"] == "integree":
        if v.get("nom") not in MATIERES_INTEGREES:
            raise TuilesRefusees(f"« {v.get('nom')} » n’est pas une matière intégrée. Matières connues : {', '.join(MATIERES_INTEGREES)}.")
        return {"source": "integree", "nom": v["nom"]}
    if v["source"] == "asset":
        if not isinstance(v.get("asset"), str) or not asset_valide(v["asset"]):
            raise TuilesRefusees(f"L’image choisie pour {ou} est introuvable dans ce jeu.")
        return {"source": "asset", "asset": v["asset"]}
    return {"source": "vide"}


def recette(brut: Any, asset_valide: Callable[[str], bool]) -> dict[str, Any]:
    """La recette vérifiée et complétée, ou TuilesRefusees avec un message en clair."""
    if not isinstance(brut, dict) or set(brut) - {"sorte", "taille", "graine", "emplacements", "reglages"}:
        raise TuilesRefusees("Une recette contient la sorte, la taille, la graine, les emplacements et les réglages.")
    sorte = brut.get("sorte")
    if sorte not in SORTES:
        raise TuilesRefusees(f"« {sorte} » n’est pas une sorte de jeu de tuiles. Sortes connues : {', '.join(SORTES)}.")
    taille = brut.get("taille")
    if not _entier(taille) or taille not in TAILLES:
        raise TuilesRefusees("Une pièce mesure 16, 32 ou 64 pixels.")
    graine = brut.get("graine")
    if not _entier(graine) or not 0 <= graine <= GRAINE_MAX:
        raise TuilesRefusees(f"La graine est un entier de 0 à {GRAINE_MAX}.")
    r = reglages(brut.get("reglages"), sorte)
    actifs = emplacements_actifs(sorte, r.get("secondTerrain", False))
    donnes = brut.get("emplacements", {})
    if not isinstance(donnes, dict):
        raise TuilesRefusees("Les emplacements se donnent par leur nom.")
    for nom in donnes:
        if nom not in EMPLACEMENTS:
            raise TuilesRefusees(f"« {nom} » n’est pas un emplacement. Emplacements connus : {', '.join(EMPLACEMENTS)}.")
        if nom not in actifs:
            raise TuilesRefusees(f"L’emplacement {NOMS_EMPLACEMENTS[nom]} ne sert pas à {_SORTES_EN_CLAIR[sorte]}"
                                 f"{' sans second terrain' if nom in ('bas', 'bordureBas') else ''}.")
    emplacements: dict[str, Any] = {}
    for nom in actifs:
        brut_e = donnes.get(nom)
        suit = EMPLACEMENTS[nom]
        if brut_e is not None and not isinstance(brut_e, dict):
            _source(nom, brut_e, asset_valide)  # refuse, avec le message de l'emplacement
        lie = (brut_e or {}).get("lie", True)
        if suit and lie:
            # L'invariant de sc-clone : une bordure suit sa surface tant que le lien tient.
            parent = emplacements[suit]
            if parent["source"] == "asset":
                raise TuilesRefusees(f"Une image posée sur {NOMS_EMPLACEMENTS[suit]} délie sa bordure : "
                                     f"donnez « lie » à faux et choisissez {NOMS_EMPLACEMENTS[nom]}.")
            if brut_e is not None and set(brut_e) - {"lie"} and _source(nom, brut_e, asset_valide) != parent:
                raise TuilesRefusees(f"{NOMS_EMPLACEMENTS[nom].capitalize()} suit {NOMS_EMPLACEMENTS[suit]} tant que son lien tient : "
                                     "déliez-la pour lui donner une autre matière.")
            emplacements[nom] = {**parent, "lie": True}
            continue
        e = _source(nom, brut_e if brut_e is not None else {"source": "vide"}, asset_valide)
        emplacements[nom] = {**e, "lie": False} if suit else e
    return {"sorte": sorte, "taille": taille, "graine": graine, "emplacements": emplacements, "reglages": r}
