"""Les pièces d'un atlas fabriqué, et leurs raccords — table recopiée de sc-clone.

Portage de `public/tile-masks.js` et des dispositions de `public/vendor/tileset-engine.js`
(sc-clone, commit f27f054). **Un indice faux ici casse l'autotiling en silence** : Godot
charge le jeu, l'affiche, et l'erreur ne se voit qu'en peignant. D'où la preuve :
`essais/tu2_masques_scclone.mjs` sort la table de sc-clone en JSON
(`tests/fixtures/tu2_masques_reference_scclone.json`), et `tests/test_tu2_recette.py`
compare celle-ci à la fixture case par case.

Module pur : ni disque, ni image, ni service.
"""
from __future__ import annotations

from typing import Any

# ── Les bits (tile-masks.js § 1) ─────────────────────────────────────────────
COINS = {"TL": 1, "TR": 2, "BL": 4, "BR": 8}  # W16 / 15 pièces
VOISINS = {"N": 1, "NE": 2, "E": 4, "SE": 8, "S": 16, "SW": 32, "W": 64, "NW": 128}  # B47
COTES = {"N": 1, "E": 2, "S": 4, "W": 8}  # E16

# TileSet.TerrainMode de Godot 4.
MODE_COINS_ET_COTES, MODE_COINS, MODE_COTES = 0, 1, 2

# Les bits de voisinage Godot de chaque jeu, dans l'ordre de TileSet.CellNeighbor —
# l'ordre dans lequel Godot les sérialise.
_BITS_GODOT = {
    "W16": (("bottom_right_corner", COINS["BR"]), ("bottom_left_corner", COINS["BL"]),
            ("top_left_corner", COINS["TL"]), ("top_right_corner", COINS["TR"])),
    "B47": (("right_side", VOISINS["E"]), ("bottom_right_corner", VOISINS["SE"]),
            ("bottom_side", VOISINS["S"]), ("bottom_left_corner", VOISINS["SW"]),
            ("left_side", VOISINS["W"]), ("top_left_corner", VOISINS["NW"]),
            ("top_side", VOISINS["N"]), ("top_right_corner", VOISINS["NE"])),
    "E16": (("right_side", COTES["E"]), ("bottom_side", COTES["S"]),
            ("left_side", COTES["W"]), ("top_side", COTES["N"])),
}
_MODES = {"W16": MODE_COINS, "B47": MODE_COINS_ET_COTES, "E16": MODE_COTES}

# Le nom du raccord de l'atelier pour chaque bit Godot : l'inverse exact de
# `atelier/services/export_tuiles.py` VOISINS, pour que la livraison n'ait rien à
# retraduire.
RACCORD_DU_BIT = {"right_side": "est", "bottom_right_corner": "sud-est", "bottom_side": "sud",
                  "bottom_left_corner": "sud-ouest", "left_side": "ouest", "top_left_corner": "nord-ouest",
                  "top_side": "nord", "top_right_corner": "nord-est"}

# ── Les dispositions (tile-masks.js § 3, 4) ──────────────────────────────────
# La grille W16 est héritée du moteur : ordre non trié, il ne se change pas.
W16_GRILLE = ((4, 10, 13, 12), (9, 14, 15, 7), (2, 3, 11, 5), (0, 8, 6, 1))


def _canonique(masque: int) -> bool:
    """Un bit diagonal n'a de sens que si ses deux cardinaux sont posés."""
    for diagonal, cardinaux in ((2, 1 | 4), (8, 16 | 4), (32, 16 | 64), (128, 1 | 64)):
        if masque & diagonal and masque & cardinaux != cardinaux:
            return False
    return True


MASQUES_BLOB = tuple(m for m in range(256) if _canonique(m))
assert len(MASQUES_BLOB) == 47


def _sequentielle(masques, colonnes):
    return {(i % colonnes, i // colonnes): m for i, m in enumerate(masques)}


_GRILLES = {
    "W16": (4, 4, {(x, y): m for y, ligne in enumerate(W16_GRILLE) for x, m in enumerate(ligne)}),
    "B47": (8, 6, _sequentielle(MASQUES_BLOB, 8)),
    "E16": (4, 4, _sequentielle(range(16), 4)),
}
_PLEIN = {"W16": 15, "B47": 255, "E16": 15}

# La 48e case du blob : aucun masque ne l'occupe ; avec un second terrain, elle est la
# case « tout dessous » (BLOB_LOWER_CELL).
CASE_DESSOUS_BLOB = (7, 5)

# ── Les sortes ───────────────────────────────────────────────────────────────
# sorte de l'atelier → (type du moteur sc-clone, jeu de masques ou None)
SORTES = {
    "sol": ("blob-47", "B47"),
    "chemin": ("edge-16", "E16"),
    "mur": ("wall", None),
    "coins-15": ("topdown-15", "W16"),
    "pieces-17": ("topdown-17", None),
}
_DISPOSITIONS = {"blob-47": (8, 6), "edge-16": (4, 4), "wall": (8, 11), "topdown-15": (4, 4), "topdown-17": (5, 5)}

# Les 17 pièces : les cases vides de la grille 5 × 5 (topdown17Layout).
PIECES_17_VIDES = frozenset({(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (4, 2), (4, 3), (4, 4)})

# ── Le mur (wallAtlasDescriptor) ─────────────────────────────────────────────
MUR_BANDES = ("face", "base", "shadow")
MUR_ETATS = ("isolated", "left-end", "middle", "right-end", "flank-left", "flank-right", "corner-left", "corner-right")
MUR_ETATS_NON_POSABLES = frozenset({"flank-left", "flank-right"})
MUR_BIAIS_SENS = ("droite", "gauche")
MUR_BIAIS_PIECES = (("raccord", "face"), ("face", "face"), ("base-haute", "base"),
                    ("base-basse", "base"), ("ombre-haute", "shadow"), ("ombre-basse", "shadow"))
_MUR_PENTE_COL = {"droite": 6, "gauche": 7}
_MUR_RACCORD_BASE_COL = {"droite": 7, "gauche": 6}

# ── Les extras de l'atlas ────────────────────────────────────────────────────
DECOR_ORIENTATIONS = ("n", "e", "s", "w")
DECOR_VARIANTES = 3


def jeu_de(sorte: str) -> str | None:
    return SORTES[sorte][1]


def mode_godot(jeu: str) -> int:
    return _MODES[jeu]


def masque_a(jeu: str, x: int, y: int) -> int | None:
    """Le masque de la case, ou None si la case est volontairement vide."""
    return _GRILLES[jeu][2].get((x, y))


def position_du_masque(jeu: str, masque: int) -> tuple[int, int]:
    return next(xy for xy, m in _GRILLES[jeu][2].items() if m == masque)


def dimensions_du_jeu(jeu: str) -> tuple[int, int]:
    return _GRILLES[jeu][:2]


def bits_godot(jeu: str, masque: int, terrain: int = 0) -> dict[str, int]:
    """Les bits de voisinage Godot d'un masque : l'indice du terrain, ou -1."""
    return {nom: terrain if masque & bit else -1 for nom, bit in _BITS_GODOT[jeu]}


def raccords(jeu: str, masque: int, surface: str, dessous: str | None = None) -> dict[str, str | None]:
    """Les huit raccords de l'atelier pour un masque.

    Bit posé → le terrain de la surface ; bit absent → le terrain du dessous s'il y en a
    un, sinon rien (`None`, le « pas de terrain » du modèle AU13, écrit -1 à la livraison).
    Un voisin que le jeu n'utilise pas (les coins d'un chemin, les côtés d'un 15 pièces)
    reste toujours à `None`.
    """
    sortie = dict.fromkeys(RACCORD_DU_BIT.values())
    for nom, valeur in bits_godot(jeu, masque).items():
        sortie[RACCORD_DU_BIT[nom]] = surface if valeur == 0 else dessous
    return sortie


def _plein(type_moteur: str) -> tuple[int, int, int] | None:
    """(x, y, masque) de la pièce pleine, ou None (mur, 17 pièces)."""
    jeu = {"blob-47": "B47", "edge-16": "E16", "topdown-15": "W16"}.get(type_moteur)
    if not jeu:
        return None
    return (*position_du_masque(jeu, _PLEIN[jeu]), _PLEIN[jeu])


def position_pleine(sorte: str) -> tuple[int, int] | None:
    """(x, y) de la pièce pleine de la sorte — celle que variantes et animation reprennent."""
    plein = _plein(SORTES[sorte][0])
    return plein[:2] if plein else None


def _borne(n: int, maximum: int, minimum: int = 1) -> int:
    return 0 if n < minimum else min(maximum, n)


def disposition(sorte: str, variantes: int = 0, animation: int = 0, animation_atlas: int = 0,
                decor: str = "aucun") -> dict[str, Any]:
    """La forme de l'atlas en cases, et où tombent ses extras (atlasShape du moteur)."""
    type_moteur = SORTES[sorte][0]
    colonnes, lignes = _DISPOSITIONS[type_moteur]
    plein = _plein(type_moteur)
    v = min(3, max(0, variantes))
    ligne_variantes = 1 if v and plein else 0
    copies = _borne(animation_atlas, 8, 2) if plein else 0
    images, pas = [], 0
    if copies:
        sans_decor = (lignes + ligne_variantes) * copies
    else:
        n = _borne(animation, 8) if plein else 0
        pas = lignes + ligne_variantes - plein[1] if plein else 0
        images = [(plein[0], plein[1] + k * pas) for k in range(1, n)]
        sans_decor = max(lignes + ligne_variantes, (images[-1][1] + 1) if images else 0)
    decor_cases = []
    if decor != "aucun":
        decor_cases = [{"x": var, "y": sans_decor + i, "orientation": o, "variante": var}
                       for i, o in enumerate(DECOR_ORIENTATIONS) for var in range(DECOR_VARIANTES)]
    return {
        "colonnes": colonnes,
        "lignes": sans_decor + (len(DECOR_ORIENTATIONS) if decor != "aucun" else 0),
        "lignes_base": lignes,
        "variantes": [{"x": i, "y": lignes, "masque": plein[2]} for i in range(v)] if ligne_variantes else [],
        "images": images,
        "copies": {"nombre": copies, "lignes": lignes + ligne_variantes} if copies else None,
        "decor": decor_cases,
    }


def cases_du_mur(decor: str = "aucun") -> list[dict[str, Any]]:
    """Les cases de l'atlas mur, dans l'ordre de wallAtlasDescriptor."""
    cases = []
    for y in range(6):
        for x in range(8):
            m = masque_a("B47", x, y)
            cases.append({"x": x, "y": y, "bande": "top", "etat": m, "sens": None, "piece": None, "posable": m is not None})
    for i, bande in enumerate(MUR_BANDES):
        for x, etat in enumerate(MUR_ETATS):
            cases.append({"x": x, "y": 6 + i, "bande": bande, "etat": etat, "sens": None, "piece": None,
                          "posable": etat not in MUR_ETATS_NON_POSABLES})
    for i, sens in enumerate(MUR_BIAIS_SENS):
        y = 9 + i
        for x, (piece, bande) in enumerate(MUR_BIAIS_PIECES):
            cases.append({"x": x, "y": y, "bande": bande, "etat": None, "sens": sens, "piece": piece, "posable": True})
        cases.append({"x": _MUR_PENTE_COL[sens], "y": y, "bande": "pente", "etat": None, "sens": sens, "piece": "pente", "posable": True})
        cases.append({"x": _MUR_RACCORD_BASE_COL[sens], "y": y, "bande": "base", "etat": None, "sens": sens, "piece": "raccord-base", "posable": True})
    if decor != "aucun":
        for c in disposition("mur", decor=decor)["decor"]:
            cases.append({"x": c["x"], "y": c["y"], "bande": "decor", "etat": None, "sens": None, "piece": None, "posable": True})
    return cases


def pieces(sorte: str, *, variantes: int = 0, animation: int = 0, animation_atlas: int = 0,
           decor: str = "aucun", second_terrain: bool = False) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """La disposition, et les pièces à poser — chacune avec son rôle et son masque.

    Ne sont **pas** des pièces : les cases vides, les images d'animation (Godot les lit
    sous la pièce qu'elles animent, elles ne se déclarent pas) et les deux flancs du mur,
    que sc-clone peint encore mais n'exporte plus (T27).
    """
    forme = disposition(sorte, variantes, animation, animation_atlas, decor)
    jeu = jeu_de(sorte)
    sortie: list[dict[str, Any]] = []
    if sorte == "mur":
        for c in cases_du_mur(decor):
            if not c["posable"]:
                continue
            if c["bande"] == "top":
                sortie.append({"x": c["x"], "y": c["y"], "role": "dessus", "masque": c["etat"]})
            elif c["bande"] == "decor":
                continue  # ajouté plus bas, avec son orientation
            else:
                sortie.append({"x": c["x"], "y": c["y"], "role": "biais" if c["sens"] else "bande", "bande": c["bande"],
                               **({"sens": c["sens"], "piece": c["piece"]} if c["sens"] else {"etat": c["etat"]})})
    elif sorte == "pieces-17":
        colonnes, lignes = _DISPOSITIONS["topdown-17"]
        sortie = [{"x": x, "y": y, "role": "piece"} for y in range(lignes) for x in range(colonnes) if (x, y) not in PIECES_17_VIDES]
    else:
        # Les copies de phase d'un atlas animé sont des images d'animation : aucune
        # pièce de plus que la première copie.
        colonnes, lignes = dimensions_du_jeu(jeu)
        for y in range(lignes):
            for x in range(colonnes):
                m = masque_a(jeu, x, y)
                if m is not None:
                    sortie.append({"x": x, "y": y, "role": "masque", "masque": m})
                elif jeu == "B47" and second_terrain and (x, y) == CASE_DESSOUS_BLOB:
                    sortie.append({"x": x, "y": y, "role": "dessous", "masque": None})
        sortie += [{"x": v["x"], "y": v["y"], "role": "variante", "masque": v["masque"]} for v in forme["variantes"]]
    sortie += [{"x": d["x"], "y": d["y"], "role": "decor", "orientation": d["orientation"], "variante": d["variante"]}
               for d in forme["decor"]]
    return forme, sorted(sortie, key=lambda p: (p["y"], p["x"]))


def cellule(piece: dict[str, Any], jeu: str | None, surface: str | None, dessous: str | None) -> dict[str, Any]:
    """Une pièce devenue cellule du modèle AU13 : retenue, raccords déduits du masque."""
    vide = dict.fromkeys(RACCORD_DU_BIT.values())
    terrain, lien = None, vide
    role = piece["role"]
    if role in ("masque", "variante") and jeu and surface:
        terrain, lien = surface, raccords(jeu, piece["masque"], surface, dessous)
    elif role == "dessus" and surface:
        terrain, lien = surface, raccords("B47", piece["masque"], surface)
    elif role == "dessous" and dessous:
        # Mêmes bits que le masque 0 (rien n'y raccorde), tous au terrain du dessous.
        terrain, lien = dessous, raccords("B47", 0, dessous, dessous)
    ordre = ("nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest")
    return {"x": piece["x"], "y": piece["y"], "nom": f"Pièce {piece['x']+1} · {piece['y']+1}", "retenue": True,
            "terrain": terrain, "raccords": {n: lien[n] for n in ordre}, "correction": None}
