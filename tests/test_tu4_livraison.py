"""TU4 — livrer à Godot un jeu de tuiles fabriqué : sol, chemin, 15 et 17 pièces.

Trois preuves, de la plus textuelle à la plus réelle :

1. **Le texte est celui de sc-clone.** `tests/fixtures/tu4_reference_scclone.json` est la
   sortie de `essais/tu4_reference_scclone.mjs`, qui appelle `public/exports.js` de
   sc-clone lui-même. Le `.tres` Python doit lui être identique, à deux écarts près, nommés
   et voulus (voir les essais).
2. **Les images d'animation ne se recouvrent pas**, sur toutes les combinaisons de réglages :
   sinon Godot refuse l'animation en silence.
3. **Godot pose les mêmes pièces que l'atelier.** Portage de `scripts/preuve-map-godot.mjs`
   (sc-clone) : la carte livrée est l'île du moteur de l'atelier (tous les masques y
   figurent) ; un vrai Godot 4.7 la repeint par `set_cells_terrain_connect` et compare
   case par case.
"""
import json
import re
import struct
import subprocess
from itertools import product
from pathlib import Path

import pytest
from PIL import Image

from atelier.domaine import masques_tuiles as M
from atelier.domaine.recette_tuiles import REGLAGES
from atelier.domaine.tuiles import TuilesRefusees
from atelier.services import export_tuiles
from atelier.services.tuiles import png
from tests.test_au1 import GODOT
from tests.test_au12 import fixe  # noqa: F401

REFERENCE = json.loads((Path(__file__).parent / "fixtures" / "tu4_reference_scclone.json").read_text(encoding="utf-8"))
HERBE = {"source": "integree", "nom": "herbe"}
SABLE = {"source": "integree", "nom": "sable"}

# Godot 4.7 signale parfois à la fermeture des objets encore en mémoire : du bruit de
# sortie, pas une erreur du paquet (même filtre que tests/test_sn7_reperes_sonores.py).
BRUIT_DE_SORTIE = ("instances were leaked at exit", "resources still in use at exit")


def atlas(colonnes, lignes, taille):
    """Un PNG aux dimensions de la recette : la pose ne lit pas les pixels."""
    image = Image.new("RGBA", (colonnes * taille, lignes * taille), (90, 140, 60, 255))
    image.putpixel((0, 0), (0, 0, 0, 0))
    return png(image)


def fabriquer(a, p, nom, sorte, taille=16, reglages=None, emplacements=None, carte=None):
    reglages = reglages or {}
    forme = M.disposition(sorte, reglages.get("variantes", 0), reglages.get("animation", 0),
                          reglages.get("animationAtlas", 0), reglages.get("decor", "aucun"))
    recette = {"sorte": sorte, "taille": taille, "graine": 31415, "reglages": reglages,
               "emplacements": emplacements or {"surface": HERBE}}
    brut = {"nom": nom, "recette": recette, "atlas": atlas(forme["colonnes"], forme["lignes"], taille)}
    if carte:
        brut["carte"] = carte
    return a.tuiles.creer(p, brut)


def carte_de_l_ile(jeu, deux_terrains=False):
    """La carte que le moteur de l'atelier a peinte ; le reste en « tout dessous »."""
    ref = REFERENCE["cartes"][jeu]
    cases = {(x, y): (tx, ty) for x, y, tx, ty in ref["surface"]}
    if deux_terrains:
        dx, dy = REFERENCE["blob_dessous"]
        for y in range(ref["hauteur"]):
            for x in range(ref["largeur"]):
                cases.setdefault((x, y), (dx, dy))
    return {"largeur": ref["largeur"], "hauteur": ref["hauteur"],
            "cases": [{"x": x, "y": y, "tuile_x": tx, "tuile_y": ty} for (x, y), (tx, ty) in sorted(cases.items())]}


def tres(a, p, e):
    return export_tuiles.paquet(a.tuiles.lire(p, e["identifiant"]), b"")[1]["tuiles.tres"].decode("utf-8")


# ── 1. Le texte est celui de exports.js ──────────────────────────────────────

# nom de la référence → (sorte, taille, réglages, emplacements)
RECETTES = {
    "sol-simple": ("sol", 32, {}, None),
    "sol-deux-terrains-anime": ("sol", 16, {"secondTerrain": True, "variantes": 2, "animationAtlas": 3, "decor": "leger"},
                                {"surface": HERBE, "bas": SABLE}),
    "chemin-anime": ("chemin", 16, {"animation": 4}, None),
    "coins-15-variantes": ("coins-15", 16, {"variantes": 1}, None),
}


def test_la_reference_vient_du_commit_de_sc_clone_recopie():
    assert REFERENCE["provenance"]["commit"] == "f27f054"
    # L'île du moteur porte tous les masques du jeu : la preuve Godot les interroge tous.
    assert REFERENCE["cartes"]["B47"]["masques"] == 47 and REFERENCE["cartes"]["E16"]["masques"] == 16


@pytest.mark.parametrize("nom", RECETTES)
async def test_le_tres_est_celui_que_sc_clone_ecrit(fixe, nom):
    a, p, _ = fixe
    sorte, taille, reglages, emplacements = RECETTES[nom]
    e = fabriquer(a, p, nom, sorte, taille, reglages, emplacements)
    assert tres(a, p, e) == REFERENCE["tres"][nom]


async def test_dix_sept_pieces_sans_les_huit_cases_vides(fixe):
    """Écart voulu : sc-clone déclarait aussi les 8 cases vides de la grille 5 × 5."""
    a, p, _ = fixe
    ecrit = tres(a, p, fabriquer(a, p, "Pièces", "pieces-17"))
    vides = {f"{x}:{y}/0 = 0" for x, y in M.PIECES_17_VIDES}
    attendu = [ligne for ligne in REFERENCE["tres"]["pieces-17"].split("\n") if ligne not in vides]
    assert ecrit.split("\n") == attendu
    assert "terrain" not in ecrit


async def test_variantes_et_animation_de_la_piece_pleine_suivent_le_rendu(fixe):
    """Écart voulu : l'outil de sc-clone calcule la séparation sans la ligne des variantes
    (tools.js l. 1121), alors que le rendu les y met. La séparation écrite ici suit le
    rendu ; celle de sc-clone ferait tomber les images sur les variantes, et Godot
    refuserait l'animation (vérifié dans le vrai Godot plus bas)."""
    a, p, _ = fixe
    ecrit = tres(a, p, fabriquer(a, p, "Eau", "sol", reglages={"variantes": 2, "animation": 4})).split("\n")
    sc = REFERENCE["tres"]["sol-variantes-et-animation"].split("\n")
    assert len(ecrit) == len(sc)
    ecarts = [(s, e) for s, e in zip(sc, ecrit) if s != e]
    assert ecarts == [("6:5/animation_separation = Vector2i(0, 0)", "6:5/animation_separation = Vector2i(0, 1)")]


async def test_un_jeu_d_une_image_sort_comme_avant(fixe):
    """AU13 : le .tres d'un jeu sans recette n'a pas bougé d'un caractère."""
    from tests.test_au13 import ensemble, pret
    a, p, _ = fixe
    e = pret(a, p, ensemble(a, p))
    assert tres(a, p, e) == AU13_TRES


async def test_le_mur_est_refuse_en_clair(fixe):
    a, p, _ = fixe
    carte = {"largeur": 2, "hauteur": 1, "cases": [{"x": 0, "y": 0, "tuile_x": 0, "tuile_y": 0}]}
    mur = fabriquer(a, p, "Rempart", "mur", reglages={"hauteurMur": 3},
                    emplacements={"surface": HERBE, "face": {"source": "integree", "nom": "brique"}}, carte=carte)
    with pytest.raises(TuilesRefusees, match="livraison d’un mur arrive bientôt"):
        a.tuiles.prevoir_livraison(p, mur["identifiant"])
    with pytest.raises(TuilesRefusees, match="arrive bientôt"):
        a.tuiles.archive(p, mur["identifiant"])


async def test_la_carte_livree_est_la_carte_peinte(fixe):
    a, p, _ = fixe
    carte = carte_de_l_ile("B47", deux_terrains=True)
    e = fabriquer(a, p, "Plage", "sol", reglages={"secondTerrain": True}, emplacements={"surface": HERBE, "bas": SABLE}, carte=carte)
    manifeste, fichiers = a.tuiles.paquet(p, e["identifiant"])
    assert manifeste["carte"] == carte and manifeste["recette"] == e["recette"]
    octets = bytes(int(n) for n in re.search(r"PackedByteArray\(([^)]*)\)", fichiers["carte.tscn"].decode()).group(1).split(", "))
    cases = [struct.unpack_from("<hhhhhh", octets, 2 + 12 * i) for i in range((len(octets) - 2) // 12)]
    assert {(x, y, tx, ty) for x, y, _, tx, ty, _ in cases} == {(c["x"], c["y"], c["tuile_x"], c["tuile_y"]) for c in carte["cases"]}
    assert len(cases) == 57 * 30  # toute l'île, dessous compris


# ── 2. Les images d'animation ne se recouvrent pas ───────────────────────────

def _combinaisons():
    images = REGLAGES["animation"][1]
    for sorte, v, anim, copies, decor, deux in product(("sol", "chemin", "coins-15"), range(4), images, images,
                                                      REGLAGES["decor"][1], (False, True)):
        if anim and copies:
            continue
        yield sorte, {"variantes": v, "animation": anim, "animationAtlas": copies, "decor": decor, "secondTerrain": deux}


def test_les_images_d_animation_tombent_sur_des_cases_libres():
    vues = 0
    for sorte, reg in _combinaisons():
        forme, pieces = M.pieces(sorte, variantes=reg["variantes"], animation=reg["animation"],
                                 animation_atlas=reg["animationAtlas"], decor=reg["decor"], second_terrain=reg["secondTerrain"])
        objet = {"recette": {"sorte": sorte, "reglages": reg}, "pieces": pieces}
        declarees = {(pc["x"], pc["y"]) for pc in pieces}
        images = export_tuiles.images_animees(objet)
        animees = reg["animation"] or reg["animationAtlas"]
        assert bool(images) == bool(animees), (sorte, reg)
        prises = set()
        for piece, cases in images.items():
            assert cases[0] == piece and piece in declarees
            assert len(cases) == (reg["animation"] or reg["animationAtlas"])
            for x, y in cases[1:]:
                assert (x, y) not in declarees, (sorte, reg, piece, (x, y))
                assert 0 <= x < forme["colonnes"] and 0 <= y < forme["lignes"], (sorte, reg, (x, y))
                assert (x, y) not in prises
                prises.add((x, y))
            vues += len(cases) - 1
        # Ce sont exactement les cases que le rendu a peintes (disposition de sc-clone).
        if reg["animation"]:
            assert sorted(prises) == sorted(forme["images"])
    assert vues > 5000


# ── 3. Un vrai Godot 4.7 ─────────────────────────────────────────────────────

def _godot(dossier, *args, delai=90):
    return subprocess.run([GODOT, "--headless", "--path", str(dossier), *args], capture_output=True, text=True, timeout=delai)


def _erreurs(sortie):
    return [ligne for ligne in sortie.splitlines() if ("ERROR" in ligne or "SCRIPT ERROR" in ligne)
            and not any(b in ligne for b in BRUIT_DE_SORTIE)]


def _livrer(a, p, e):
    vue = a.tuiles.prevoir_livraison(p, e["identifiant"])
    return a.livraison.livrer(p, vue["jeton"])["scene"]


def _lancer(godot, script, marque):
    (godot / "preuve_tu4.gd").write_text(script, encoding="utf-8")
    importe = _godot(godot, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    assert not _erreurs(importe.stdout + importe.stderr), importe.stdout + importe.stderr
    preuve = _godot(godot, "--script", "preuve_tu4.gd")
    assert marque in preuve.stdout, preuve.stdout + preuve.stderr
    assert not _erreurs(preuve.stdout + preuve.stderr), preuve.stdout + preuve.stderr
    print("\n".join(ligne for ligne in preuve.stdout.splitlines() if ligne.startswith("TU4_")))  # lu avec -s
    return preuve.stdout


POSE = '''extends SceneTree
# [nom, scène livrée, terrain de la surface, terrain du dessous ou -1]
const JEUX = JEUX_ICI
const DESSOUS := Vector2i(DESSOUS_ICI)

func _initialize():
    for j in JEUX:
        var carte: TileMapLayer = load(j[1]).instantiate()
        var attendu := {}
        for c in carte.get_used_cells():
            attendu[c] = carte.get_cell_atlas_coords(c)
        var t: TileSet = carte.tile_set
        var essai := TileMapLayer.new()
        essai.tile_set = t
        var toutes: Array[Vector2i] = []
        var surface: Array[Vector2i] = []
        var tout_dessous := 0
        for c in attendu:
            toutes.append(c)
            if j[3] >= 0 and attendu[c] == DESSOUS:
                tout_dessous += 1
            else:
                surface.append(c)
        # Deux sols : tout le dessous d'abord, la surface par-dessus — l'ordre du peintre.
        if j[3] >= 0:
            essai.set_cells_terrain_connect(toutes, 0, j[3], false)
        essai.set_cells_terrain_connect(surface, 0, j[2], false)
        var bons := 0
        var vides := 0
        var ecarts: Array[String] = []
        for c in attendu:
            var pose := essai.get_cell_atlas_coords(c)
            if pose == attendu[c]:
                bons += 1
            elif pose == Vector2i(-1, -1):
                vides += 1
            else:
                ecarts.append("%s: godot %s, atelier %s" % [str(c), str(pose), str(attendu[c])])
        var en_trop := 0
        for c in essai.get_used_cells():
            if not attendu.has(c):
                en_trop += 1
        print("TU4_POSE %s terrains=%d mode=%d cases=%d identiques=%d desaccords=%d vides=%d en_trop=%d tout_dessous=%d" % [j[0], t.get_terrains_count(0), t.get_terrain_set_mode(0), attendu.size(), bons, ecarts.size(), vides, en_trop, tout_dessous])
        for e in ecarts.slice(0, 6):
            print("TU4_ECART %s %s" % [j[0], e])
        essai.free()
        carte.free()
    print("TU4_POSE_FIN")
    quit()
'''


@pytest.mark.skipif(not GODOT, reason="Godot absent : pose native non vérifiée.")
async def test_godot_pose_les_memes_pieces_que_l_atelier(fixe):
    a, p, godot = fixe
    jeux = []
    for nom, sorte, jeu, deux in (("sol", "sol", "B47", False), ("sol-deux-sols", "sol", "B47", True), ("chemin", "chemin", "E16", False)):
        emplacements = {"surface": HERBE, "bas": SABLE} if deux else None
        e = fabriquer(a, p, nom, sorte, 16, {"secondTerrain": True} if deux else {}, emplacements, carte=carte_de_l_ile(jeu, deux))
        indices = {t["identifiant"]: i for i, t in enumerate(e["terrains"])}
        jeux.append([nom, _livrer(a, p, e), indices["surface"], indices.get("dessous", -1)])
    script = POSE.replace("JEUX_ICI", json.dumps(jeux)).replace("DESSOUS_ICI", ", ".join(map(str, REFERENCE["blob_dessous"])))
    sortie = _lancer(godot, script, "TU4_POSE_FIN")
    lu = {m[0]: dict(kv.split("=") for kv in m[1].split()) for m in re.findall(r"TU4_POSE (\S+) (.*)", sortie)}
    ref = REFERENCE["cartes"]
    assert lu["sol"] == {"terrains": "1", "mode": "0", "cases": str(len(ref["B47"]["surface"])), "identiques": str(len(ref["B47"]["surface"])),
                         "desaccords": "0", "vides": "0", "en_trop": "0", "tout_dessous": "0"}, sortie
    toute = str(ref["B47"]["largeur"] * ref["B47"]["hauteur"])
    assert lu["sol-deux-sols"] == {"terrains": "2", "mode": "0", "cases": toute, "identiques": toute, "desaccords": "0", "vides": "0",
                                   "en_trop": "0", "tout_dessous": str(int(toute) - len(ref["B47"]["surface"]))}, sortie
    assert lu["chemin"] == {"terrains": "1", "mode": "2", "cases": str(len(ref["E16"]["surface"])), "identiques": str(len(ref["E16"]["surface"])),
                            "desaccords": "0", "vides": "0", "en_trop": "0", "tout_dessous": "0"}, sortie


CHARGE = '''extends SceneTree
# [nom, scène livrée, tuiles déclarées, mode (-1 : sans terrain), terrains, [[x, y, images]...]]
const JEUX = JEUX_ICI

func _initialize():
    for j in JEUX:
        var carte: TileMapLayer = load(j[1]).instantiate()
        var t: TileSet = carte.tile_set
        var atlas := t.get_source(0) as TileSetAtlasSource
        var mode := t.get_terrain_set_mode(0) if t.get_terrain_sets_count() > 0 else -1
        var terrains := t.get_terrains_count(0) if t.get_terrain_sets_count() > 0 else 0
        var animees_ok := 0
        for anim in j[5]:
            var c := Vector2i(anim[0], anim[1])
            if atlas.get_tile_animation_frames_count(c) == anim[2] and atlas.get_tile_animation_columns(c) == 1:
                animees_ok += 1
            else:
                print("TU4_ANIM_ECART %s %s: %d images au lieu de %d" % [j[0], str(c), atlas.get_tile_animation_frames_count(c), anim[2]])
        print("TU4_CHARGE %s tuiles=%d/%d mode=%d/%d terrains=%d/%d animees=%d/%d" % [j[0], atlas.get_tiles_count(), j[2], mode, j[3], terrains, j[4], animees_ok, j[5].size()])
        carte.free()
    print("TU4_CHARGE_FIN")
    quit()
'''


@pytest.mark.skipif(not GODOT, reason="Godot absent : animation native non vérifiée.")
async def test_godot_charge_les_jeux_animes_et_les_autres_formats(fixe):
    a, p, godot = fixe
    # (0, 1) : une pièce de chaque sorte — (0, 0) est une case vide du 17 pièces.
    petite = {"largeur": 2, "hauteur": 1, "cases": [{"x": 0, "y": 0, "tuile_x": 0, "tuile_y": 1}]}
    cas = [
        ("eau-variantes-et-animation", "sol", {"variantes": 2, "animation": 4}, None),
        ("atlas-anime-deux-sols-decor", "sol", {"secondTerrain": True, "variantes": 2, "animationAtlas": 3, "decor": "leger"}, {"surface": HERBE, "bas": SABLE}),
        ("chemin-anime", "chemin", {"variantes": 1, "animation": 8}, None),
        ("coins-15-anime", "coins-15", {"variantes": 3, "animation": 3}, None),
        ("coins-15-atlas-anime", "coins-15", {"animationAtlas": 8, "decor": "dense"}, None),
        ("pieces-17", "pieces-17", {}, None),
    ]
    jeux = []
    for nom, sorte, reg, emplacements in cas:
        e = fabriquer(a, p, nom, sorte, 16, reg, emplacements, carte=petite)
        objet = a.tuiles.lire(p, e["identifiant"])
        animees = [[x, y, len(cases)] for (x, y), cases in export_tuiles.images_animees(objet).items()]
        mode = M.mode_godot(M.jeu_de(sorte)) if M.jeu_de(sorte) else -1
        jeux.append([nom, _livrer(a, p, e), len(e["cellules"]), mode, len(e["terrains"]), animees])
    sortie = _lancer(godot, CHARGE.replace("JEUX_ICI", json.dumps(jeux)), "TU4_CHARGE_FIN")
    for nom, _, tuiles, mode, terrains, animees in jeux:
        attendu = f"TU4_CHARGE {nom} tuiles={tuiles}/{tuiles} mode={mode}/{mode} terrains={terrains}/{terrains} animees={len(animees)}/{len(animees)}"
        assert attendu in sortie, sortie
    assert "TU4_ANIM_ECART" not in sortie, sortie


# Le .tres d'un jeu AU13 (tests/test_au13.py, `pret`), tel que l'export l'écrivait avant
# TU4 — relevé sur le module du commit 083d2d2.
AU13_TRES = """[gd_resource type="TileSet" load_steps=3 format=3]
[ext_resource type="Texture2D" path="atlas.png" id="1"]
[sub_resource type="TileSetAtlasSource" id="Atlas"]
texture = ExtResource("1")
margins = Vector2i(2, 2)
separation = Vector2i(1, 1)
texture_region_size = Vector2i(8, 8)
use_texture_padding = true
0:0/0 = 0
0:0/0/terrain_set = 0
0:0/0/terrain = 0
0:0/0/terrains_peering_bit/right_side = 0
0:0/0/terrains_peering_bit/bottom_right_corner = 0
0:0/0/terrains_peering_bit/bottom_side = 0
0:0/0/terrains_peering_bit/bottom_left_corner = 0
0:0/0/terrains_peering_bit/left_side = 0
0:0/0/terrains_peering_bit/top_left_corner = 0
0:0/0/terrains_peering_bit/top_side = 0
0:0/0/terrains_peering_bit/top_right_corner = 0
1:0/0 = 0
1:0/0/terrain_set = 0
1:0/0/terrain = 0
1:0/0/terrains_peering_bit/right_side = 0
1:0/0/terrains_peering_bit/bottom_right_corner = 0
1:0/0/terrains_peering_bit/bottom_side = 0
1:0/0/terrains_peering_bit/bottom_left_corner = 0
1:0/0/terrains_peering_bit/left_side = 0
1:0/0/terrains_peering_bit/top_left_corner = 0
1:0/0/terrains_peering_bit/top_side = 0
1:0/0/terrains_peering_bit/top_right_corner = 0
[resource]
tile_size = Vector2i(8, 8)
terrain_set_0/mode = 0
terrain_set_0/terrain_0/name = "Herbe"
terrain_set_0/terrain_0/color = Color(0.27058823529411763, 0.5019607843137255, 0.1411764705882353, 1)
sources/0 = SubResource("Atlas")
"""
