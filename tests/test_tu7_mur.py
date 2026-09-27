"""TU7 — livrer un mur à Godot : son dessus, ses bandes, leurs collisions et leur tri.

Quatre preuves, de la plus textuelle à la plus réelle :

1. **La pose est celle de la scène du moteur.** `tests/fixtures/tu7_reference_mur.json` est
   la sortie de `essais/tu7_reference_mur.mjs` : chaque tuile que `dessinerScene`
   (interface/src/tuiles/moteur/tile-scene.js) peint pour un mur, dans l'ordre où il la
   peint, sur des cartes choisies et des cartes au hasard. Le portage Python
   (`atelier/domaine/pose_mur.py`) doit rendre la même liste, pose pour pose.
2. **Le .tres est celui de sc-clone** : `godotWallTileset` (public/exports.js), sans écart.
3. **Godot trie comme le peintre.** La carte range chaque étage du mur sur sa couche, avec
   un `y_sort_origin` qui ramène tout le mur sur la ligne de sa base. Sur toutes les cartes
   de la référence et sur des cartes au hasard, l'ordre de dessin qui en découle — z_index,
   puis y de tri, puis ordre dans l'arbre — est celui du peintre, case par case.
4. **Un vrai Godot 4.7** charge un mur de hauteur 1 et un de hauteur 3, relit les couches,
   et les compare à la scène du moteur : 0 désaccord. Il vérifie aussi les collisions (par
   une requête physique) et le tri d'un personnage placé devant puis derrière le mur.

Ce qui n'est pas vérifié ici : les pixels. Godot tourne sans écran dans les essais ; l'ordre
de dessin est celui que Godot calcule d'après ses propres valeurs (positions, origines de
tri, z_index, ordre des nœuds), selon la règle documentée de CanvasItem.y_sort_enabled.
Les critères déjà tenus par les essais recopiés en TU1 (fente fermée, escalier ramené,
biais périodique) sont cités dans docs/PLAN-tuiles.md § TU7, pas réécrits.
"""
import json
import random
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from atelier.domaine import masques_tuiles as M
from atelier.domaine import pose_mur
from atelier.services import export_tuiles
from tests.test_au1 import GODOT
from tests.test_au12 import fixe  # noqa: F401
from tests.test_tu4_livraison import BRUIT_DE_SORTIE, _godot, _livrer, fabriquer

REFERENCE = json.loads((Path(__file__).parent / "fixtures" / "tu7_reference_mur.json").read_text(encoding="utf-8"))
PIERRE = {"source": "integree", "nom": "pierre"}
BRIQUE = {"source": "integree", "nom": "brique"}


def scene(nom, hauteur):
    return next(s for s in REFERENCE["scenes"] if s["nom"] == nom and s["hauteur"] == hauteur)


def carte_du_mur(s):
    """La carte que l'écran garde pour un mur : l'emprise, chaque case avec son dessus brut
    (atelier.ts, versCarteServeur)."""
    emprise = frozenset(tuple(c) for c in s["emprise"])
    cases = []
    for x, y in sorted(emprise, key=lambda c: (c[1], c[0])):
        tx, ty = M.position_du_masque("B47", pose_mur.masque_blob(emprise, x, y))
        cases.append({"x": x, "y": y, "tuile_x": tx, "tuile_y": ty})
    return {"largeur": s["colonnes"], "hauteur": s["lignes"], "cases": cases}


def mur(a, p, nom, s, taille=16, decor="aucun"):
    return fabriquer(a, p, nom, "mur", taille, {"hauteurMur": s["hauteur"], "decor": decor},
                     {"surface": PIERRE, "face": BRIQUE}, carte=carte_du_mur(s))


def objet_seul(emprise, hauteur, taille=16):
    return {"recette": {"sorte": "mur", "taille": taille, "reglages": {"decor": "aucun", "hauteurMur": hauteur}},
            "carte": {"cases": [{"x": x, "y": y} for x, y in emprise]}}


# ── 1. La pose est celle de la scène ─────────────────────────────────────────

def test_la_reference_vient_du_commit_de_sc_clone_recopie():
    assert REFERENCE["provenance"]["commit"] == "f27f054"
    d = REFERENCE["descripteur"]
    assert (d["faceRow"], d["baseRow"], d["shadowRow"]) == (pose_mur.LIGNE_FACE, pose_mur.LIGNE_BASE, pose_mur.LIGNE_OMBRE)
    assert d["etats"] == list(M.MUR_ETATS)
    for sens, pieces in d["biais"].items():
        for piece, case in pieces.items():
            assert pose_mur.case_biais(sens, piece) == (case["col"], case["row"]), (sens, piece)
    # Les cartes qui comptent sont là, et les deux hauteurs du critère.
    noms = {(s["nom"], s["hauteur"]) for s in REFERENCE["scenes"]}
    assert {("escalier", 1), ("escalier", 3), ("double-pente", 3), ("trou-en-v", 8)} <= noms


@pytest.mark.parametrize("s", REFERENCE["scenes"], ids=lambda s: f'{s["nom"]}-h{s["hauteur"]}')
def test_python_pose_ce_que_la_scene_peint(s):
    poses = pose_mur.poses([tuple(c) for c in s["emprise"]], s["hauteur"])
    assert [[p["x"], p["y"], p["col"], p["row"]] for p in poses] == s["poses"]


def test_la_reference_couvre_les_pieces_du_mur():
    """Toutes les pièces posables de la scène sont posées au moins une fois — base, faces,
    dessus, ombre, les douze pièces en biais, les deux pentes et les deux raccords-bases —
    sinon la comparaison ne prouverait rien sur celles qui manquent."""
    posees = {(c, r) for s in REFERENCE["scenes"] for _, _, c, r in s["poses"]}
    bandes = {(x, y) for c in M.cases_du_mur() if c["posable"] and c["bande"] != "top" for x, y in [(c["x"], c["y"])]}
    assert bandes <= posees, sorted(bandes - posees)
    # Des dessus variés, et tous fermés au sud (T22) : aucun n'est un masque sans le bit S.
    dessus = {M.masque_a("B47", c, r) for c, r in posees if r < 6}
    assert len(dessus) >= 12 and all(m & M.VOISINS["S"] for m in dessus)


@pytest.mark.skipif(not shutil.which("node"), reason="Node absent : la référence n'est pas régénérée.")
def test_la_reference_est_a_jour_du_moteur():
    """La fixture est bien ce que le moteur recopié peint aujourd'hui (et sc-clone écrit)."""
    racine = Path(__file__).parent.parent
    if not (racine.parent / "sc-clone" / "public" / "exports.js").is_file():
        pytest.skip("sc-clone absent à côté du dépôt.")
    sortie = subprocess.run(["node", str(racine / "essais" / "tu7_reference_mur.mjs")], capture_output=True, text=True,
                            encoding="utf-8", timeout=120, cwd=racine)
    assert sortie.returncode == 0, sortie.stderr
    assert json.loads(sortie.stdout) == REFERENCE


# ── 2. Le .tres est celui de sc-clone ────────────────────────────────────────

@pytest.mark.parametrize("nom,taille,decor", [("mur-16", 16, "aucun"), ("mur-32-decor-leger", 32, "leger"), ("mur-64", 64, "aucun")])
async def test_le_tres_est_celui_que_sc_clone_ecrit(fixe, nom, taille, decor):
    a, p, _ = fixe
    e = mur(a, p, nom, scene("escalier", 3), taille, decor)
    _, fichiers = a.tuiles.paquet(p, e["identifiant"])
    assert fichiers["tuiles.tres"].decode("utf-8") == REFERENCE["tres"][nom]


def test_le_dessus_est_ecrit_comme_le_terrain_d_un_sol():
    """Le dessus d'un mur est le blob 47 d'un sol à un seul terrain, mot pour mot."""
    commun = {"grille": {"marge": 0, "espacement": 0}, "terrains": [{"identifiant": "surface", "nom": "Pierre", "couleur": "#92af70"}]}
    _, pieces = M.pieces("sol")
    sol = export_tuiles._tres_fabrique({**commun, "recette": {"sorte": "sol", "taille": 16, "reglages": {}}, "pieces": pieces})
    murs = export_tuiles._tres_fabrique({**commun, "recette": {"sorte": "mur", "taille": 16, "reglages": {"hauteurMur": 2}}})
    terrain = lambda texte: [l for l in texte.split("\n") if re.match(r"\d+:[0-5]/0", l)]
    assert terrain(murs) == terrain(sol) and len(terrain(sol)) == 47 * 11


# ── 3. Godot trie comme le peintre ───────────────────────────────────────────

def ordre_godot(objet):
    """L'ordre de dessin de chaque case, tel que Godot le déduit de la carte livrée :
    z_index d'abord, puis le y de tri (centre de la case + y_sort_origin de la tuile + celui
    de la couche), puis l'ordre des nœuds. Rend {(x, y): [(col, row), …]}."""
    t = objet["recette"]["taille"]
    par_case = {(c["x"], c["y"]): c for c in M.cases_du_mur()}
    vues = {}
    for i, c in enumerate(export_tuiles.couches_du_mur(objet)):
        if not c["visible"]:
            continue
        for (x, y), (col, row) in c["cases"].items():
            origine = export_tuiles._origine_tri(par_case[(col, row)], t) or 0
            cle = (c["z"], y * t + t // 2 + origine + c["origine"] if c["tri"] else 0, i)
            vues.setdefault((x, y), []).append((cle, (col, row)))
    return {xy: [v for _, v in sorted(liste)] for xy, liste in vues.items()}


def ordre_peintre(emprise, hauteur):
    ordre = {}
    for p in pose_mur.poses(emprise, hauteur):
        ordre.setdefault((p["x"], p["y"]), []).append((p["col"], p["row"]))
    return ordre


def test_le_tri_de_godot_suit_le_peintre_sur_la_reference():
    for s in REFERENCE["scenes"]:
        emprise = [tuple(c) for c in s["emprise"]]
        for taille in (16, 32, 64):
            assert ordre_godot(objet_seul(emprise, s["hauteur"], taille)) == ordre_peintre(emprise, s["hauteur"]), (s["nom"], s["hauteur"], taille)


def test_le_tri_de_godot_suit_le_peintre_sur_des_cartes_au_hasard():
    tirage = random.Random(31415)
    superposees = 0
    for _ in range(300):
        densite = tirage.choice((0.2, 0.4, 0.6))
        emprise = [(x, y) for y in range(10) for x in range(12) if tirage.random() < densite]
        hauteur = tirage.randint(1, 8)
        attendu = ordre_peintre(emprise, hauteur)
        assert ordre_godot(objet_seul(emprise, hauteur)) == attendu, (emprise, hauteur)
        superposees += sum(len(v) > 1 for v in attendu.values())
    assert superposees > 1000  # des cases où l'ordre compte vraiment


def test_une_case_d_emprise_cachee_bloque_quand_meme():
    """Un mur vertical : seule la case du pied porte sa base (placerMur) ; les autres sont
    couvertes par la pile de devant. La couche invisible « Emprise » les bloque."""
    couches = export_tuiles.couches_du_mur(objet_seul([(2, 3), (2, 4), (2, 5)], 3))
    emprise = next(c for c in couches if c["nom"] == "Emprise")
    base = next(c for c in couches if c["nom"] == "Base")
    assert not emprise["visible"] and set(emprise["cases"]) == {(2, 3), (2, 4)} and set(base["cases"]) == {(2, 5)}
    assert set(emprise["cases"].values()) == {(0, pose_mur.LIGNE_BASE)}
    # Un mur sans case cachée n'a pas de couche Emprise.
    assert all(c["nom"] != "Emprise" for c in export_tuiles.couches_du_mur(objet_seul([(1, 3), (2, 3)], 2)))


# ── Le paquet ────────────────────────────────────────────────────────────────

async def test_le_mur_se_livre_avec_sa_carte_et_ses_regles(fixe):
    a, p, _ = fixe
    s = scene("escalier", 3)
    e = mur(a, p, "Rempart", s, decor="leger")
    manifeste, fichiers = a.tuiles.paquet(p, e["identifiant"])
    assert set(fichiers) == {"atlas.png", "tuiles.tres", "carte.tscn", "composition.json", "LISEZMOI.txt"}
    assert manifeste["carte"] == carte_du_mur(s) and manifeste["recette"]["reglages"]["hauteurMur"] == 3
    tscn = fichiers["carte.tscn"].decode("utf-8")
    noeuds = re.findall(r'\[node name="([^"]+)" type="(\w+)"', tscn)
    assert noeuds[0] == ("Carte", "Node2D") and {"Ombre", "Base", "Face_1", "Face_2", "Dessus"} <= {n for n, _ in noeuds}
    assert 'y_sort_origin = 40' in tscn and 'y_sort_origin = 56' in tscn and "z_index = -1" in tscn
    lisez = fichiers["LISEZMOI.txt"].decode("utf-8")
    for regle in ("Le bord sud du dessus est toujours fermé", "Les courses", "un par un", "Seule la base bloque",
                  "le dessus va en (x, y - 3)", "l'ombre en (x, y + 1)"):
        assert regle in lisez, regle
    # Sans décor, la section du décor n'y est pas.
    e2 = mur(a, p, "Muret", scene("escalier", 1))
    lisez2 = a.tuiles.paquet(p, e2["identifiant"])[1]["LISEZMOI.txt"].decode("utf-8")
    assert "un par un" not in lisez2 and "par paires" not in lisez2 and "pas de face" in lisez2 and "Face_1" not in lisez2
    a.tuiles.archive(p, e2["identifiant"])  # plus de refus


# ── 4. Un vrai Godot 4.7 ─────────────────────────────────────────────────────

PREUVE = '''extends SceneTree
# [nom, scène livrée, taille, hauteur, [x, y] du mur du personnage]
const JEUX = JEUX_ICI
var etape := 0
var cartes := []

func _cle(a, b) -> bool:
    for k in 3:
        if a[k] != b[k]:
            return a[k] < b[k]
    return false

func _initialize():
    for j in JEUX:
        var carte: Node2D = load(j[1]).instantiate()
        # Chaque carte loin des autres : leurs collisions ne doivent pas se mêler.
        carte.position = Vector2(cartes.size() * 8192, 0)
        root.add_child(carte)
        cartes.append(carte)
        var t: TileSet = null
        var entrees := []
        var dessus_terrain := 0
        var bandes_simples := 0
        var autres := 0
        var couches: Array[String] = []
        for i in carte.get_child_count():
            var l := carte.get_child(i) as TileMapLayer
            t = l.tile_set
            couches.append("%s:%d:%d:%d:%d" % [l.name, int(l.visible), l.z_index, int(l.y_sort_enabled), l.y_sort_origin])
            for c in l.get_used_cells():
                var td := l.get_cell_tile_data(c)
                var a := l.get_cell_atlas_coords(c)
                if a.y < 6:
                    if td.terrain_set == 0 and td.terrain == 0:
                        dessus_terrain += 1
                    else:
                        autres += 1
                elif td.terrain_set == -1:
                    bandes_simples += 1
                else:
                    autres += 1
                if not l.visible:
                    continue
                var y := l.map_to_local(c).y + td.y_sort_origin + l.y_sort_origin if l.y_sort_enabled else l.position.y
                entrees.append([l.z_index, y, i, c, a])
        entrees.sort_custom(_cle)
        var par_case := {}
        for e in entrees:
            if not par_case.has(e[3]):
                par_case[e[3]] = []
            par_case[e[3]].append("%d,%d" % [e[4].x, e[4].y])
        for c in par_case:
            print("TU7_CASE %s %d %d %s" % [j[0], c.x, c.y, ";".join(par_case[c])])
        print("TU7_COUCHES %s %s" % [j[0], " ".join(couches)])
        print("TU7_TUILES %s y_sort=%d mode=%d dessus_terrain=%d bandes_simples=%d autres=%d" % [j[0], int(carte.y_sort_enabled), t.get_terrain_set_mode(0), dessus_terrain, bandes_simples, autres])
        # Le dessus peint par l'outil Terrains de Godot, sur les seules cases du dessus.
        var sonde := TileMapLayer.new()
        sonde.tile_set = t
        var dessus := carte.get_node("Dessus") as TileMapLayer
        var cases_dessus: Array[Vector2i] = []
        for c in dessus.get_used_cells():
            if dessus.get_cell_atlas_coords(c).y < 6:
                cases_dessus.append(c)
        sonde.set_cells_terrain_connect(cases_dessus, 0, 0, false)
        var ecarts := 0
        for c in cases_dessus:
            if sonde.get_cell_atlas_coords(c) != dessus.get_cell_atlas_coords(c):
                ecarts += 1
        print("TU7_TERRAIN %s dessus=%d differents=%d" % [j[0], cases_dessus.size(), ecarts])
        for c in cases_dessus:
            print("TU7_OUTIL %s %d %d %d,%d" % [j[0], c.x, c.y, sonde.get_cell_atlas_coords(c).x, sonde.get_cell_atlas_coords(c).y])
        sonde.free()
        # Le personnage : un Node2D dans « Carte », ses pieds à deux hauteurs.
        var T: int = j[2]
        var x: int = j[4][0]
        var y: int = j[4][1]
        var heros := Node2D.new()
        carte.add_child(heros)
        for pieds in [["derriere", y * T - 2], ["devant", (y + 1) * T + 2]]:
            heros.position = Vector2(x * T + T / 2, pieds[1])
            var avant := 0
            var apres := 0
            # Les tuiles du mur dont le personnage croise la colonne : du dessus à la base.
            for e in entrees:
                if e[0] != 0 or e[3].x != x or e[3].y < y - j[3] or e[3].y > y:
                    continue
                if _cle(e, [heros.z_index, heros.position.y, carte.get_child_count() - 1]):
                    avant += 1
                else:
                    apres += 1
            print("TU7_HEROS %s %s avant=%d apres=%d" % [j[0], pieds[0], avant, apres])

func _process(_delta):
    etape += 1
    if etape < 4:
        return false
    # Les collisions, demandées au moteur physique : le centre de chaque case.
    var espace := root.get_world_2d().direct_space_state
    for n in JEUX.size():
        var j = JEUX[n]
        var T: int = j[2]
        for c in j[5]:
            var q := PhysicsPointQueryParameters2D.new()
            q.position = Vector2(c[0] * T + T / 2, c[1] * T + T / 2) + cartes[n].position
            print("TU7_BLOQUE %s %d %d %d" % [j[0], c[0], c[1], espace.intersect_point(q).size()])
    print("TU7_FIN")
    quit()
    return true
'''


def _lancer(godot, script):
    (godot / "preuve_tu7.gd").write_text(script, encoding="utf-8")
    importe = _godot(godot, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    preuve = _godot(godot, "--script", "preuve_tu7.gd")
    sortie = preuve.stdout + preuve.stderr
    assert "TU7_FIN" in preuve.stdout, sortie
    erreurs = [l for l in sortie.splitlines() if ("ERROR" in l or "SCRIPT ERROR" in l) and not any(b in l for b in BRUIT_DE_SORTIE)]
    assert not erreurs, sortie
    return preuve.stdout


@pytest.mark.lent  # lance le moteur Godot — voir tests/test_au1.py, GODOT
@pytest.mark.skipif(not GODOT, reason="Godot absent : pose native du mur non vérifiée.")
async def test_godot_charge_le_mur_et_pose_la_scene(fixe):
    a, p, godot = fixe
    # [nom, scène de référence, case d'emprise où l'on place le personnage]
    cas = [("escalier-h1", scene("escalier", 1), (10, 8)), ("escalier-h3", scene("escalier", 3), (10, 8)),
           ("piece-h3", scene("piece", 3), (6, 4)), ("double-pente-h3", scene("double-pente", 3), (1, 1))]
    jeux, attendus = [], {}
    for nom, s, heros in cas:
        e = mur(a, p, nom, s)
        emprise = frozenset(tuple(c) for c in s["emprise"])
        # Les cases à interroger : toute l'emprise (bloquée), et chaque case d'ombre qui
        # n'est ni un mur ni une base coupée en biais (libre).
        libres = sorted({(x, y + 1) for x, y in emprise if (x, y + 1) not in emprise}
                        - {(pp["x"], pp["y"]) for pp in pose_mur.poses(emprise, s["hauteur"]) if pp["row"] in (9, 10) and pp["col"] == 3})
        interroger = sorted(emprise) + libres
        jeux.append([nom, _livrer(a, p, e), 16, s["hauteur"], list(heros), [list(c) for c in interroger]])
        attendus[nom] = (s, emprise, set(libres))
    sortie = _lancer(godot, PREUVE.replace("JEUX_ICI", json.dumps(jeux)))
    print("\n".join(l for l in sortie.splitlines() if l.startswith(("TU7_TUILES", "TU7_TERRAIN", "TU7_HEROS", "TU7_COUCHES"))))
    for nom, (s, emprise, libres) in attendus.items():
        # 1. Les cases posées par Godot, dans l'ordre où il les dessine, sont celles que la
        #    scène du moteur peint, dans l'ordre où elle les peint.
        godot_ordre = {(int(x), int(y)): liste.split(";") for x, y, liste in re.findall(rf"TU7_CASE {nom} (-?\d+) (-?\d+) (\S+)", sortie)}
        peintre = {}
        for x, y, col, row in s["poses"]:
            peintre.setdefault((x, y), []).append(f"{col},{row}")
        desaccords = [xy for xy in set(godot_ordre) | set(peintre) if godot_ordre.get(xy) != peintre.get(xy)]
        assert desaccords == [], (nom, sorted(desaccords)[:6])
        assert sum(len(v) for v in godot_ordre.values()) == len(s["poses"])
        # 2. Le dessus en terrain, les bandes en tuiles simples ; la carte trie en profondeur.
        tuiles = dict(kv.split("=") for kv in re.search(rf"TU7_TUILES {nom} (.*)", sortie).group(1).split())
        dessus = sum(1 for _, _, _, row in s["poses"] if row < 6)
        assert tuiles["y_sort"] == "1" and tuiles["mode"] == "0" and tuiles["autres"] == "0", tuiles
        assert int(tuiles["dessus_terrain"]) == dessus and int(tuiles["bandes_simples"]) >= len(s["poses"]) - dessus
        # 3. L'outil Terrains de Godot ne devine pas le bit sud forcé : c'est pour ça que la
        #    carte pose le dessus par set_cell. Il retrouve en revanche le masque brut du dessus.
        terrain = dict(kv.split("=") for kv in re.search(rf"TU7_TERRAIN {nom} (.*)", sortie).group(1).split())
        assert int(terrain["differents"]) > 0, terrain
        outil = {(int(x), int(y)): (int(c), int(r)) for x, y, c, r in re.findall(rf"TU7_OUTIL {nom} (-?\d+) (-?\d+) (\d+),(\d+)", sortie)}
        h = s["hauteur"]
        assert outil == {(x, y - h): M.position_du_masque("B47", pose_mur.masque_blob(emprise, x, y)) for x, y in emprise}, nom
        # 4. Les collisions : l'emprise bloque partout, l'ombre devant le pied jamais.
        bloque = {(int(x), int(y)): int(n) for x, y, n in re.findall(rf"TU7_BLOQUE {nom} (-?\d+) (-?\d+) (\d+)", sortie)}
        assert {xy for xy, n in bloque.items() if n} == set(emprise), (nom, sorted(set(emprise) ^ {xy for xy, n in bloque.items() if n})[:6])
        assert all(bloque[xy] == 0 for xy in libres)
        # 5. Le personnage : derrière le mur, tout le mur passe devant lui ; devant sa base, lui
        #    passe devant tout le mur.
        heros = dict(re.findall(rf"TU7_HEROS {nom} (\w+) (avant=\d+ apres=\d+)", sortie))
        derriere = dict(kv.split("=") for kv in heros["derriere"].split())
        devant = dict(kv.split("=") for kv in heros["devant"].split())
        assert derriere["avant"] == "0" and int(derriere["apres"]) >= 2, (nom, heros)
        assert devant["apres"] == "0" and int(devant["avant"]) >= 2, (nom, heros)
