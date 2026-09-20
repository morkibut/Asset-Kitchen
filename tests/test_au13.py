"""Vraies tuiles, révisions relues, retouche et contrat Godot chargé réellement."""
import copy
import io
import json
import subprocess
import zipfile

import httpx
import pytest
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine.tuiles import RACCORDS, TuilesRefusees, choix, grille
from atelier.services import Atelier
from atelier.services.tuiles import png
from tests.test_au1 import GODOT
from tests.test_au12 import fixe


def atlas():
    image = Image.new("RGBA", (21, 12))
    image.paste((255, 0, 0, 255), (2, 2, 10, 10))
    image.paste((0, 255, 0, 255), (11, 2, 19, 10))
    image.putpixel((2, 2), (0, 0, 0, 0))
    return png(image)


def ensemble(a, p):
    image = a.generations.importer(atlas(), "Atlas herbe", projet=p)["asset"]
    return a.tuiles.creer(p, {"nom": "Sous-bois", "image": image["identifiant"], "grille": {"taille": 8, "marge": 2, "espacement": 1}})


def regles(e):
    return copy.deepcopy({k: e[k] for k in ("nom", "terrains", "cellules", "carte")})


def pret(a, p, e):
    r = regles(e)
    r["terrains"] = [{"identifiant": "herbe", "nom": "Herbe", "couleur": "#458024"}]
    for c in r["cellules"]:
        c.update(retenue=True, terrain="herbe", raccords={n: "herbe" for n in RACCORDS})
    r["carte"] = {"largeur": 3, "hauteur": 2, "cases": [{"x": 0, "y": 0, "tuile_x": 1, "tuile_y": 0}, {"x": 1, "y": 0, "tuile_x": 0, "tuile_y": 0}]}
    return a.tuiles.regler(p, e["identifiant"], e["revision"], r)


async def test_atlas_importe_selectionne_reouvert_sans_generation(fixe, double):
    a, p, _ = fixe
    e = ensemble(a, p)
    assert e["retenues"] == 0 and not e["diagnostic"]["pret"]
    assert e["personnage"] is None
    with pytest.raises(TuilesRefusees, match="Retenez"):
        a.tuiles.archive(p, e["identifiant"])
    e = pret(a, p, e)
    autre = Atelier(racine=a.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre.bibliotheque.ouvrir()
    relu = autre.tuiles.lire(p, e["identifiant"])
    assert relu["grille"] == {"taille": 8, "marge": 2, "espacement": 1, "colonnes": 2, "lignes": 1}
    assert relu["carte"] == e["carte"] and relu["diagnostic"]["pret"]
    with Image.open(io.BytesIO(autre.tuiles.apercu(p, e["identifiant"], carte=True))) as image:
        assert image.size == (24, 16)
        assert image.getpixel((0, 0)) == (0, 255, 0, 255)
        assert image.getpixel((8, 0))[3] == 0
    assert double.appels == 0


async def test_correction_source_figee_revision_et_restauration(fixe):
    a, p, _ = fixe
    e = pret(a, p, ensemble(a, p))
    octets = a.tuiles.apercu(p, e["identifiant"])
    extrait = a.tuiles.extraire(p, e["identifiant"], 0, 0, e["revision"])
    assert extrait["asset"]["largeur"] == 8
    correction = a.generations.importer(png(Image.new("RGBA", (8, 8), (0, 0, 255, 255))), "Retouche", projet=p)["asset"]
    r = regles(e); r["cellules"][0]["correction"] = correction["identifiant"]
    modifie = a.tuiles.regler(p, e["identifiant"], e["revision"], r)
    assert a.tuiles.apercu(p, e["identifiant"], revision=e["revision"]) == octets
    with Image.open(io.BytesIO(a.tuiles.apercu(p, e["identifiant"]))) as image:
        assert image.getpixel((2, 2)) == (0, 0, 255, 255)
        assert image.getpixel((11, 2)) == (0, 255, 0, 255)
    with pytest.raises(TuilesRefusees, match="autre fenêtre"):
        a.tuiles.regler(p, e["identifiant"], e["revision"], r)
    restauree = a.tuiles.restaurer(p, e["identifiant"], modifie["revision"], e["revision"])
    assert restauree["revision"] == 4 and a.tuiles.apercu(p, e["identifiant"]) == octets
    trop_grande = a.generations.importer(png(Image.new("RGBA", (9, 8), "red")), "Mal cadrée", projet=p)["asset"]
    r["cellules"][0]["correction"] = trop_grande["identifiant"]
    with pytest.raises(TuilesRefusees, match="8 × 8"):
        a.tuiles.regler(p, e["identifiant"], 4, r)


async def test_raccords_explicitement_incompatibles_et_archive_native(fixe):
    a, p, _ = fixe
    e = pret(a, p, ensemble(a, p))
    r = regles(e); r["cellules"][0]["raccords"]["ouest"] = None
    e = a.tuiles.regler(p, e["identifiant"], e["revision"], r)
    assert len(e["diagnostic"]["raccords"]) == 1 and not e["diagnostic"]["pret"]
    e = pret(a, p, e)
    with zipfile.ZipFile(io.BytesIO(a.tuiles.archive(p, e["identifiant"]))) as z:
        assert set(z.namelist()) == {"atlas.png", "tuiles.tres", "carte.tscn", "composition.json"}
        assert z.read("atlas.png") == a.tuiles.apercu(p, e["identifiant"])
        description = json.loads(z.read("composition.json"))
        assert description["source"]["provenance"] and description["carte"] == e["carte"]
        assert b"terrains_peering_bit/top_right_corner = 0" in z.read("tuiles.tres")


def test_dimensions_et_types_refuses():
    with pytest.raises(TuilesRefusees): grille({"taille": True}, 16, 16)
    with pytest.raises(TuilesRefusees): grille({"taille": 2}, 4096, 4096)
    g = grille({}, 16, 16)
    with pytest.raises(TuilesRefusees): choix({"nom": "X", "cellules": [{"x": 0, "y": 0, "terrain": []}]}, g)
    with pytest.raises(TuilesRefusees): choix({"nom": "X", "cellules": [{"x": -1, "y": 0}]}, g)


async def test_http_mcp_et_livraison_sans_personnage(fixe):
    a, p, godot = fixe
    e = pret(a, p, ensemble(a, p))
    app = creer_application(a)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
        base = f"/api/projects/{p}/tilesets/{e['identifiant']}"
        assert (await client.get(base)).json()["revision"] == 2
        assert (await client.get(base+"/preview.png?carte=true")).headers["content-type"] == "image/png"
        vue = await client.post(base+"/delivery/preview", json={"revision": 2})
        assert vue.status_code == 200, vue.text
        assert len(list(godot.iterdir())) == 1
        bilan = await client.post(f"/api/projects/{p}/deliveries", json={"jeton": vue.json()["jeton"]})
        assert bilan.status_code == 200 and bilan.json()["personnage"] is None
        assert (await client.get(base+"/export.zip")).status_code == 200
    noms = {t.name for t in await app.state.mcp.list_tools()}
    assert {"create_tile_set", "update_tile_set", "extract_tile_for_editing", "preview_tile_delivery"} <= noms


@pytest.mark.lent  # lance le moteur Godot — voir tests/test_au1.py, GODOT
@pytest.mark.skipif(not GODOT, reason="Godot absent : contrat natif non vérifié.")
async def test_godot_charge_atlas_raccords_carte_et_alpha(fixe):
    a, p, godot = fixe
    e = pret(a, p, ensemble(a, p))
    vue = a.tuiles.prevoir_livraison(p, e["identifiant"])
    livraison = a.livraison.livrer(p, vue["jeton"])
    script = '''extends SceneTree
func _initialize():
    var carte = load(SCENE).instantiate()
    assert(carte is TileMapLayer)
    assert(carte.get_used_cells().size() == 2)
    assert(carte.get_cell_atlas_coords(Vector2i(0, 0)) == Vector2i(1, 0))
    assert(carte.get_cell_atlas_coords(Vector2i(1, 0)) == Vector2i(0, 0))
    var t = carte.tile_set
    assert(t.tile_size == Vector2i(8, 8))
    assert(t.get_terrain_name(0, 0) == "Herbe")
    var atlas = t.get_source(0)
    assert(atlas is TileSetAtlasSource)
    assert(atlas.margins == Vector2i(2, 2) and atlas.separation == Vector2i(1, 1))
    assert(atlas.get_tiles_count() == 2)
    var tuile = atlas.get_tile_data(Vector2i(0, 0), 0)
    assert(tuile.terrain == 0)
    assert(tuile.get_terrain_peering_bit(TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER) == 0)
    assert(atlas.texture.get_image().get_pixel(2, 2).a == 0)
    carte.free()
    print("AU13_GODOT_OK")
    quit()
'''.replace("SCENE", json.dumps(livraison["scene"]))
    (godot/"preuve.gd").write_text(script, encoding="utf-8")
    importe = subprocess.run([GODOT, "--headless", "--path", str(godot), "--editor", "--import"], capture_output=True, text=True, timeout=60)
    assert importe.returncode == 0, importe.stdout+importe.stderr
    preuve = subprocess.run([GODOT, "--headless", "--path", str(godot), "--script", "preuve.gd"], capture_output=True, text=True, timeout=30)
    assert "AU13_GODOT_OK" in preuve.stdout, preuve.stdout+preuve.stderr
