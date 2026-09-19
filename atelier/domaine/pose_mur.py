"""La pose d'un mur sur sa carte (TU7) : ce que la scène du moteur peint, case par case.

Portage de `interface/src/tuiles/moteur/tile-scene.js` (la copie de TU1, commit f27f054 de
sc-clone) : `coursesHorizontales`, `etatsDeBande`, `jonctionsDiagonales`,
`penteVoisinsDessus`, `masqueDessusMur`, `placerMur`, `placerMurBiais`, `caseMurPente`,
`placerOmbreBiais`, et l'ordre de `dessinerScene` pour un mur sans décor. Mêmes boucles,
dans le même ordre : là où deux jonctions se disputent une case, c'est la dernière vue qui
gagne, ici comme là-bas.

**Pourquoi un portage, et pas Node.** La livraison d'un jeu de tuiles ne dépend pas de
Node (décision 3 du plan : le serveur ne lance le moteur qu'en TU10, et doit alors dire
quand Node manque). La preuve que le portage ne dérive pas : `essais/tu7_reference_mur.mjs`
enregistre chaque tuile que `dessinerScene` peint, dans l'ordre où il la peint, sur des
cartes choisies et des cartes au hasard (`tests/fixtures/tu7_reference_mur.json`) ;
`tests/test_tu7_mur.py` exige la même liste, pose pour pose.

La carte d'un mur est son **emprise** : les cases que le joueur ne traverse pas. La
convention de placement est celle de `placerMur` :

    y − h      le dessus (blob 47, bit sud forcé)
    y − h + 1  ┐
    …          │ la face, répétée
    y − 1      ┘
    y          la base — collision et tri en profondeur
    y + 1      l'ombre portée

Module pur : ni disque, ni image, ni service.
"""
from __future__ import annotations

from typing import Callable, Iterable

from atelier.domaine import masques_tuiles as M

B = M.VOISINS
LIGNE_FACE, LIGNE_BASE, LIGNE_OMBRE = 6, 7, 8
LIGNE_BIAIS = {"droite": 9, "gauche": 10}
_COL_BIAIS = {piece: col for col, (piece, _) in enumerate(M.MUR_BIAIS_PIECES)}
_COL_PENTE = {"droite": 6, "gauche": 7}
_COL_RACCORD_BASE = {"droite": 7, "gauche": 6}


def case_biais(sens: str, piece: str) -> tuple[int, int]:
    """La case d'atlas d'une pièce en biais (descripteurScene, bloc `biais`)."""
    if piece == "pente":
        return _COL_PENTE[sens], LIGNE_BIAIS[sens]
    if piece == "raccord-base":
        return _COL_RACCORD_BASE[sens], LIGNE_BIAIS[sens]
    return _COL_BIAIS[piece], LIGNE_BIAIS[sens]


def _remplisseur(emprise: frozenset) -> Callable[[int, int], bool]:
    return lambda x, y: (x, y) in emprise


def courses_horizontales(emprise: frozenset) -> list[tuple[int, int, int]]:
    """Les courses maximales `(y, x0, x1)`, rangée par rangée, de gauche à droite."""
    courses = []
    for y in sorted({y for _, y in emprise}):
        xs = sorted(x for x, yy in emprise if yy == y)
        debut = precedent = xs[0]
        for x in xs[1:]:
            if x != precedent + 1:
                courses.append((y, debut, precedent))
                debut = x
            precedent = x
        courses.append((y, debut, precedent))
    return courses


def _par_rangee(courses):
    rangees: dict[int, list[tuple[int, int, int]]] = {}
    for c in courses:
        rangees.setdefault(c[0], []).append(c)
    return rangees


def etats_de_bande(emprise: frozenset) -> Callable[[int, int], str]:
    """L'état de bande de chaque case d'emprise — `etatsDeBande`, T24 et T41."""
    courses = courses_horizontales(emprise)
    ouest, est = set(), set()
    for y, x0, x1 in courses:
        for x in range(x0, x1 + 1):
            if x > x0:
                ouest.add((x, y))
            if x < x1:
                est.add((x, y))
    rangees = _par_rangee(courses)
    for y, hautes in rangees.items():
        for _, hx0, hx1 in hautes:
            for _, bx0, bx1 in rangees.get(y + 1, []):
                if bx0 == hx1 + 1:
                    est.add((hx1, y)); ouest.add((bx0, y + 1))
                if hx0 == bx1 + 1:
                    ouest.add((hx0, y)); est.add((bx1, y + 1))
    rempli = _remplisseur(emprise)

    def etat(x: int, y: int) -> str:
        so, se = rempli(x - 1, y + 1), rempli(x + 1, y + 1)
        if so and se:
            return "middle"
        if so:
            return "corner-left"
        if se:
            return "corner-right"
        w, e = (x, y) in ouest, (x, y) in est
        return "middle" if w and e else "right-end" if w else "left-end" if e else "isolated"
    return etat


def jonctions_diagonales(emprise: frozenset) -> list[dict]:
    """Les jonctions en diagonale — `jonctionsDiagonales`, T43 et le trou en V."""
    rempli = _remplisseur(emprise)
    jonctions = []
    rangees = _par_rangee(courses_horizontales(emprise))
    for y, hautes in rangees.items():
        for _, hx0, hx1 in hautes:
            for _, bx0, bx1 in rangees.get(y + 1, []):
                if bx0 == hx1 + 1 and not rempli(hx1, y - 1):
                    jonctions.append({"x_haut": hx1, "y_haut": y, "x_bas": bx0, "y_bas": y + 1, "sens": "droite"})
                if hx0 == bx1 + 1 and not rempli(hx0, y - 1):
                    jonctions.append({"x_haut": hx0, "y_haut": y, "x_bas": bx1, "y_bas": y + 1, "sens": "gauche"})
    return jonctions


def pente_voisins_dessus(jonctions: Iterable[dict]) -> dict:
    """Les bits forcés sur les dessus que touche une pente — `penteVoisinsDessus`, T44."""
    nord, lateral, arriere = set(), {}, {}
    for j in jonctions:
        bas = (j["x_bas"], j["y_bas"])
        nord.add(bas)
        lateral[(j["x_haut"], j["y_haut"])] = "E" if j["sens"] == "droite" else "W"
        arriere[bas] = arriere.get(bas, "") + ("W" if j["sens"] == "droite" else "E")
    return {"nord": nord, "lateral": lateral, "arriere": arriere}


def masque_blob(emprise: frozenset, x: int, y: int) -> int:
    """Le masque blob 47 brut de la case — `blobMaskAt` (tile-check.js)."""
    r = _remplisseur(emprise)
    n, e, s, w = r(x, y - 1), r(x + 1, y), r(x, y + 1), r(x - 1, y)
    return ((B["N"] if n else 0) | (B["E"] if e else 0) | (B["S"] if s else 0) | (B["W"] if w else 0)
            | (B["NE"] if n and e and r(x + 1, y - 1) else 0) | (B["SE"] if s and e and r(x + 1, y + 1) else 0)
            | (B["SW"] if s and w and r(x - 1, y + 1) else 0) | (B["NW"] if n and w and r(x - 1, y - 1) else 0))


def masque_dessus_mur(emprise: frozenset, x: int, y: int, info: dict) -> int:
    """Le masque du dessus : le masque brut, bit sud forcé (T22), bits de pente (T44)."""
    m = masque_blob(emprise, x, y) | B["S"]
    nord = (x, y) in info["nord"]
    lateral = info["lateral"].get((x, y))
    arriere = info["arriere"].get((x, y), "")
    if nord:
        m |= B["N"]
    if lateral == "E" or "E" in arriere:
        m |= B["E"]
    if lateral == "W" or "W" in arriere:
        m |= B["W"]
    if m & B["E"]:
        m |= B["SE"]
    if m & B["W"]:
        m |= B["SW"]
    if nord and (lateral == "E" or "E" in arriere):
        m |= B["NE"]
    if nord and (lateral == "W" or "W" in arriere):
        m |= B["NW"]
    return m


def _dessus(emprise, x, y, hauteur, info, ancre):
    col, row = M.position_du_masque("B47", masque_dessus_mur(emprise, x, y, info))
    return _pose(x, y - hauteur, col, row, ancre)


def _pose(x, y, col, row, ancre):
    """Une tuile posée ; `ancre` : la rangée d'emprise du mur auquel elle appartient
    (None pour une ombre, qui est une tache sur le sol et ne se trie pas)."""
    return {"x": x, "y": y, "col": col, "row": row, "ancre": ancre}


def placer_mur(emprise, x, y, hauteur, etat, info) -> list[dict]:
    """`placerMur` : base, faces, dessus — une case couverte au sud ne garde que son dessus."""
    col = M.MUR_ETATS.index(etat)
    r = _remplisseur(emprise)
    couverte = r(x, y + 1) and (not r(x - 1, y) or r(x - 1, y + 1)) and (not r(x + 1, y) or r(x + 1, y + 1))
    poses = []
    if not couverte:
        poses.append(_pose(x, y, col, LIGNE_BASE, y))
        poses += [_pose(x, y - k, col, LIGNE_FACE, y) for k in range(1, hauteur)]
    return poses + [_dessus(emprise, x, y, hauteur, info, y)]


def placer_mur_biais(emprise, x, y, hauteur, sens, info) -> list[dict]:
    """`placerMurBiais` : la bande en biais de la case haute d'une jonction (T43, T45)."""
    poses = [_pose(x, y + 1, *case_biais(sens, "base-basse"), y)]
    if hauteur == 1:
        poses.append(_pose(x, y, *case_biais(sens, "raccord-base"), y))
    else:
        poses.append(_pose(x, y, *case_biais(sens, "base-haute"), y))
        poses += [_pose(x, y - k, *case_biais(sens, "face"), y) for k in range(1, hauteur - 1)]
        poses.append(_pose(x, y - hauteur + 1, *case_biais(sens, "raccord"), y))
    return poses + [_dessus(emprise, x, y, hauteur, info, y)]


def poses(emprise: Iterable[tuple[int, int]], hauteur: int) -> list[dict]:
    """Toutes les tuiles du mur, dans l'ordre exact où `dessinerScene` les peint :
    les ombres d'abord, puis les murs rangée par rangée, puis les pentes (T44)."""
    if not 1 <= hauteur <= 8:
        raise ValueError("La hauteur d’un mur va de 1 à 8 cases.")
    emprise = frozenset(emprise)
    if not emprise:
        return []
    cases = sorted(emprise, key=lambda c: (c[1], c[0]))
    rempli = _remplisseur(emprise)
    etat = etats_de_bande(emprise)
    jonctions = jonctions_diagonales(emprise)
    sens_biais = {}
    for j in jonctions:
        sens_biais[(j["x_haut"], j["y_haut"])] = j["sens"]
    info = pente_voisins_dessus(jonctions)
    sortie = []
    for x, y in cases:
        if rempli(x, y + 1):
            continue
        sens = sens_biais.get((x, y))
        if sens:
            sortie += [_pose(x, y + 1, *case_biais(sens, "ombre-haute"), None),
                       _pose(x, y + 2, *case_biais(sens, "ombre-basse"), None)]
        else:
            sortie.append(_pose(x, y + 1, M.MUR_ETATS.index(etat(x, y)), LIGNE_OMBRE, None))
    for x, y in cases:
        sens = sens_biais.get((x, y))
        sortie += placer_mur_biais(emprise, x, y, hauteur, sens, info) if sens else placer_mur(emprise, x, y, hauteur, etat(x, y), info)
    for j in jonctions:
        dx = j["x_haut"] + 1 if j["sens"] == "droite" else j["x_haut"] - 1
        sortie.append(_pose(dx, j["y_haut"] - hauteur, *case_biais(j["sens"], "pente"), j["y_haut"]))
    return sortie
