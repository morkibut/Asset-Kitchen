"""TU8 — le décor autour des bords : les gravats qui débordent d'un bord, posés par
paires, en tuiles sans terrain, sur une seconde couche de la carte livrée.

Quatre preuves, de la plus textuelle à la plus réelle :

1. **La pose Python égale celle du moteur.** `tests/fixtures/tu8_reference_decor.json`
   est la sortie de `essais/tu8_reference_decor.mjs` : `emplacementsDecor`
   (interface/src/tuiles/moteur/tile-scene.js, la copie de TU1) appelé directement — sur
   des occupations quelconques, sur l'occupation d'une île fabriquée (sol B47, chemin
   E16, 15-pièces W16) et sur l'occupation d'un mur (`occupationMur`, les cases de pente
   de T44 exclues, exactement comme `dessinerScene` les compose). Le portage Python
   (`atelier/domaine/pose_decor.py`, `atelier/domaine/pose_mur.decor`) doit rendre la
   même liste, pose pour pose, sur 164 scènes.
2. **Le décor se pose toujours en paires** : la moitié extérieure et sa moitié
   intérieure, sauf quand celle-ci porte déjà la pièce d'une autre jonction.
3. **Il sort en tuiles sans terrain, sur une seconde couche de la carte livrée**, et
   « aucun » redonne le paquet identique au bit près à avant TU8 (TU4/TU7).
4. **Un vrai Godot 4.7** charge la carte livrée et retrouve, sur la couche « Décor »,
   exactement les cases que l'atelier a calculées : 0 désaccord.

Ce qui n'est pas revérifié ici : le tirage lui-même (hachage, seuils de densité,
appariement) et la case d'atlas d'une orientation/variante — TU4 et la preuve 1 les
couvrent déjà ; TU8 ajoute la POSE sur la carte et la SORTIE en couche, rien de plus.
"""
import json
import random
import re
import struct
from pathlib import Path

import pytest

from atelier.domaine import masques_tuiles as M
from atelier.domaine import pose_decor, pose_mur
from atelier.services import export_tuiles
from tests.test_au1 import GODOT
from tests.test_au12 import fixe  # noqa: F401
from tests.test_tu4_livraison import HERBE, SABLE, _erreurs, _godot, carte_de_l_ile, fabriquer
from tests.test_tu7_mur import BRIQUE, PIERRE, carte_du_mur, mur

REFERENCE = json.loads((Path(__file__).parent / "fixtures" / "tu8_reference_decor.json").read_text(encoding="utf-8"))
_JEU_SORTE = {"B47": "sol", "E16": "chemin", "W16": "coins-15"}


def _livrer(a, p, e):
    vue = a.tuiles.prevoir_livraison(p, e["identifiant"])
    return a.livraison.livrer(p, vue["jeton"])["scene"]


# ── 1. La pose Python égale celle du moteur ──────────────────────────────────

def test_la_reference_vient_du_moteur_recopie():
    assert REFERENCE["provenance"]["moteur"] == "interface/src/tuiles/moteur"
    assert len(REFERENCE["generique"]) > 0 and len(REFERENCE["sol_chemin"]) > 0 and len(REFERENCE["mur"]) > 0
    # De vraies pièces dans chaque famille, pas seulement des scènes vides.
    assert sum(len(s["pieces"]) for s in REFERENCE["generique"]) > 500
    assert sum(len(s["pieces"]) for s in REFERENCE["sol_chemin"]) > 500
    assert sum(len(s["pieces"]) for s in REFERENCE["mur"]) > 500


@pytest.mark.parametrize("s", REFERENCE["generique"],
                         ids=lambda s: f'{s["colonnes"]}x{s["lignes"]}-{s["densite"]}-{s["graine"]}')
def test_python_pose_ce_que_emplacementsdecor_pose(s):
    occupees = {tuple(c) for c in s["occupe"]}
    pieces = pose_decor.emplacements(lambda x, y: (x, y) in occupees, s["colonnes"], s["lignes"], s["densite"], s["graine"])
    assert [[p["x"], p["y"], p["orientation"], p["variante"], p["moitie"]] for p in pieces] == s["pieces"]


@pytest.mark.parametrize("s", REFERENCE["sol_chemin"],
                         ids=lambda s: f'{s["jeu"]}-{s["graineIle"]}-{s["densite"]}-{s["graineDecor"]}')
def test_python_pose_le_decor_d_une_ile_fabriquee(s):
    occupees = {tuple(c) for c in s["occupe"]}
    forme = M.disposition(_JEU_SORTE[s["jeu"]], 0, 0, 0, s["densite"])
    pieces = pose_decor.emplacements(lambda x, y: (x, y) in occupees, s["colonnes"], s["lignes"], s["densite"], s["graineDecor"])
    obtenu = [[p["x"], p["y"], p["orientation"], p["variante"], *M.case_decor(forme, p["orientation"], p["variante"])] for p in pieces]
    assert obtenu == s["pieces"]


@pytest.mark.parametrize("s", REFERENCE["mur"],
                         ids=lambda s: f'{s["nom"]}-h{s["hauteur"]}-{s["densite"]}-{s["graine"]}')
def test_python_pose_le_decor_d_un_mur(s):
    emprise = [tuple(c) for c in s["emprise"]]
    forme = M.disposition("mur", decor=s["densite"])
    pieces = pose_mur.decor(emprise, s["hauteur"], s["colonnes"], s["lignes"], s["densite"], s["graine"])
    obtenu = [[p["x"], p["y"], p["orientation"], p["variante"], *M.case_decor(forme, p["orientation"], p["variante"])] for p in pieces]
    assert obtenu == s["pieces"]


# ── 2. Le décor se pose toujours en paires ───────────────────────────────────

def test_le_decor_se_pose_toujours_en_paires():
    """Chaque moitié extérieure a sa moitié intérieure, juste en face — sauf si cette
    case porte déjà la pièce d'une autre jonction (une couche de tuiles ne porte qu'une
    tuile par case, la seule exception documentée par tile-scene.js)."""
    tirage = random.Random(20260919)
    total_exterieures = total_dediees = total_partagees = 0
    for _ in range(60):
        colonnes, lignes = tirage.randint(6, 16), tirage.randint(6, 16)
        occupees = {(tirage.randrange(colonnes), tirage.randrange(lignes)) for _ in range(colonnes * lignes // 3)}
        pieces = pose_decor.emplacements(lambda x, y: (x, y) in occupees, colonnes, lignes, "dense", tirage.randint(0, 999999))
        par_case = {(p["x"], p["y"]): p for p in pieces}
        exterieures = [p for p in pieces if p["moitie"] == "exterieure"]
        total_exterieures += len(exterieures)
        for p in exterieures:
            dx, dy = pose_decor.VECTEUR[p["orientation"]]
            cible = (p["x"] + dx, p["y"] + dy)
            assert cible in par_case, (p, cible)  # jamais une extérieure sans rien en face
            voisine = par_case[cible]
            if voisine["moitie"] == "interieure" and voisine["orientation"] == pose_decor.OPPOSE[p["orientation"]]:
                assert voisine["variante"] == (p["variante"] + 1) % 3
                total_dediees += 1
            else:
                total_partagees += 1  # réservée par une autre jonction : toujours UNE pièce, jamais zéro
    assert total_exterieures > 300 and total_dediees > 300 and total_partagees >= 0


# ── 3. Une seconde couche, sans terrain ; « aucun » inchangé ─────────────────

async def test_le_decor_sort_sur_une_seconde_couche_sans_terrain(fixe):
    a, p, _ = fixe
    carte = carte_de_l_ile("B47", deux_terrains=False)
    e = fabriquer(a, p, "Ruines", "sol", 16, {"decor": "dense"}, carte=carte)
    objet = a.tuiles.lire(p, e["identifiant"])
    manifeste, fichiers = a.tuiles.paquet(p, e["identifiant"])
    # Le .tres : les pièces de décor n'ont pas de terrain (T27, déjà écrit en TU4).
    cases_decor_atlas = {(pc["x"], pc["y"]) for pc in objet["pieces"] if pc["role"] == "decor"}
    assert cases_decor_atlas
    tres = fichiers["tuiles.tres"].decode("utf-8")
    for x, y in cases_decor_atlas:
        assert f"{x}:{y}/0 = 0" in tres and f"{x}:{y}/0/terrain_set" not in tres
    # La carte : un Node2D « Carte » avec « Terrain » et « Décor », chacun sa propre pose.
    tscn = fichiers["carte.tscn"].decode("utf-8")
    noeuds = re.findall(r'\[node name="([^"]+)" type="(\w+)"', tscn)
    assert noeuds[0] == ("Carte", "Node2D")
    assert ("Terrain", "TileMapLayer") in noeuds and ("Décor", "TileMapLayer") in noeuds
    attendu = export_tuiles._decor_sol(objet)
    assert attendu  # la carte a bien du décor à poser, sans quoi le test ne prouve rien
    blocs = re.findall(r'\[node name="(Terrain|Décor)"[^\]]*\][^\[]*tile_map_data = PackedByteArray\(([^)]*)\)', tscn)
    donnees_decor = bytes(int(n) for n in dict(blocs)["Décor"].split(", "))
    cases = {(x, y): (tx, ty) for x, y, _, tx, ty, _ in
             (struct.unpack_from("<hhhhhh", donnees_decor, 2 + 12 * i) for i in range((len(donnees_decor) - 2) // 12))}
    assert cases == attendu


async def test_aucun_decor_redonne_le_paquet_d_avant_tu8(fixe):
    a, p, _ = fixe
    carte = carte_de_l_ile("B47", deux_terrains=False)
    e_sans = fabriquer(a, p, "SolNu", "sol", 16, {}, carte=carte)
    e_aucun = fabriquer(a, p, "SolAucun", "sol", 16, {"decor": "aucun"}, carte=carte)
    _, f1 = a.tuiles.paquet(p, e_sans["identifiant"])
    _, f2 = a.tuiles.paquet(p, e_aucun["identifiant"])
    assert f1["carte.tscn"] == f2["carte.tscn"] and f1["tuiles.tres"] == f2["tuiles.tres"]
    tscn = f1["carte.tscn"].decode("utf-8")
    assert re.findall(r'\[node name="([^"]+)" type="(\w+)"', tscn) == [("Carte", "TileMapLayer")]
    # Un mur sans décor n'a pas de couche « Décor » (déjà couvert par TU7, revérifié ici).
    s = next(x for x in REFERENCE["mur"] if x["nom"] == "escalier" and x["hauteur"] == 3)
    e_mur = mur(a, p, "MurNu", {**s, "colonnes": s["colonnes"], "lignes": s["lignes"]}, decor="aucun")
    couches = export_tuiles.couches_du_mur(a.tuiles.lire(p, e_mur["identifiant"]))
    assert all(c["nom"] != "Décor" for c in couches)


async def test_le_decor_d_un_mur_sort_sur_sa_propre_couche(fixe):
    a, p, _ = fixe
    s = next(x for x in REFERENCE["mur"] if x["nom"] == "escalier" and x["hauteur"] == 3 and x["densite"] == "dense")
    e = mur(a, p, "Rempart", s, decor="dense")
    objet = a.tuiles.lire(p, e["identifiant"])
    attendu = export_tuiles._decor_mur(objet)
    assert attendu  # la scène choisie a bien du décor
    couches = export_tuiles.couches_du_mur(objet)
    decor_layer = next(c for c in couches if c["nom"] == "Décor")
    assert decor_layer["z"] == 1 and decor_layer["tri"] is False and decor_layer["visible"] is True
    assert decor_layer["cases"] == attendu
    lisez = a.tuiles.paquet(p, e["identifiant"])[1]["LISEZMOI.txt"].decode("utf-8")
    assert "ne les pose pas encore" not in lisez and "couche « Décor »" in lisez


# ── 4. Un vrai Godot 4.7 ──────────────────────────────────────────────────────

CHARGE_DECOR = '''extends SceneTree
# [nom, scène livrée, [[x, y, col, row], ...] attendu sur « Décor »]
const JEUX = JEUX_ICI

func _initialize():
    for j in JEUX:
        var carte: Node2D = load(j[1]).instantiate()
        var decor := carte.get_node("Décor") as TileMapLayer
        var attendu := {}
        for c in j[2]:
            attendu[Vector2i(c[0], c[1])] = Vector2i(c[2], c[3])
        var vus := {}
        for c in decor.get_used_cells():
            vus[c] = decor.get_cell_atlas_coords(c)
        var desaccords := 0
        for c in attendu:
            if not vus.has(c) or vus[c] != attendu[c]:
                desaccords += 1
        for c in vus:
            if not attendu.has(c):
                desaccords += 1
        print("TU8_DECOR %s attendues=%d vues=%d desaccords=%d" % [j[0], attendu.size(), vus.size(), desaccords])
        carte.free()
    print("TU8_FIN")
    quit()
'''


def _lancer(godot, script):
    (godot / "preuve_tu8.gd").write_text(script, encoding="utf-8")
    importe = _godot(godot, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    preuve = _godot(godot, "--script", "preuve_tu8.gd")
    sortie = preuve.stdout + preuve.stderr
    assert "TU8_FIN" in preuve.stdout, sortie
    assert not _erreurs(sortie), sortie
    return preuve.stdout


@pytest.mark.skipif(not GODOT, reason="Godot absent : pose native du décor non vérifiée.")
async def test_godot_charge_le_decor_et_retrouve_la_pose(fixe):
    a, p, godot = fixe
    jeux = []

    # Un sol, avec décor dense.
    carte_sol = carte_de_l_ile("B47", deux_terrains=False)
    e_sol = fabriquer(a, p, "sol-decor", "sol", 16, {"decor": "dense"}, carte=carte_sol)
    attendu_sol = export_tuiles._decor_sol(a.tuiles.lire(p, e_sol["identifiant"]))
    jeux.append(["sol-decor", _livrer(a, p, e_sol), [[x, y, cr[0], cr[1]] for (x, y), cr in attendu_sol.items()]])

    # Un chemin, avec décor léger.
    carte_chemin = carte_de_l_ile("E16", deux_terrains=False)
    e_chemin = fabriquer(a, p, "chemin-decor", "chemin", 16, {"decor": "leger"}, carte=carte_chemin)
    attendu_chemin = export_tuiles._decor_sol(a.tuiles.lire(p, e_chemin["identifiant"]))
    jeux.append(["chemin-decor", _livrer(a, p, e_chemin), [[x, y, cr[0], cr[1]] for (x, y), cr in attendu_chemin.items()]])

    # Un mur, avec décor dense.
    s = next(x for x in REFERENCE["mur"] if x["nom"] == "escalier" and x["hauteur"] == 3 and x["densite"] == "dense")
    e_mur = mur(a, p, "mur-decor", s, decor="dense")
    attendu_mur = export_tuiles._decor_mur(a.tuiles.lire(p, e_mur["identifiant"]))
    jeux.append(["mur-decor", _livrer(a, p, e_mur), [[x, y, cr[0], cr[1]] for (x, y), cr in attendu_mur.items()]])

    assert all(attendu for attendu in (attendu_sol, attendu_chemin, attendu_mur))  # chaque scène a du décor
    sortie = _lancer(godot, CHARGE_DECOR.replace("JEUX_ICI", json.dumps(jeux)))
    lu = {m[0]: dict(kv.split("=") for kv in m[1].split()) for m in re.findall(r"TU8_DECOR (\S+) (.*)", sortie)}
    for nom, attendu in (("sol-decor", attendu_sol), ("chemin-decor", attendu_chemin), ("mur-decor", attendu_mur)):
        assert lu[nom] == {"attendues": str(len(attendu)), "vues": str(len(attendu)), "desaccords": "0"}, (nom, sortie)
