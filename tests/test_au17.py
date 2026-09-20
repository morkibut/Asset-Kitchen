"""Tenues : pixels combinables, choix figés, reprise disque et véritable moteur."""
import itertools
import json
import subprocess
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.recette import Main, Recette, Trait
from atelier.domaine.tenue import TenueRefusee
from atelier.image.calques_cibles import png, rgba
from atelier.image.tenue import preparer_couches, composer_couches
from atelier.services import Atelier
from atelier.services.tenues import ServiceTenues
from tests.conftest import AnimateurMuet
from tests.test_au15 import decor, importer  # noqa: F401
from tests.test_au1 import GODOT
from tests.test_b20 import _clip_ecrit, _poser_une_bande


@pytest.fixture
def tenue(decor, atelier, client, tmp_path):
    calques, chemin, personnage, corps, _ = decor
    liens, variantes = [], []
    for i, nom in enumerate(("Casque", "Sac", "Épée")):
        piece = client.post("/api/characters/pieces", json={"nom": nom, "porteur": personnage}).json()["piece"]["identifiant"]
        emploi = atelier.equipement.emplois(chemin[0], piece)[0].identifiant
        pixels = np.zeros((48, 48, 4), np.uint8)
        pixels[4+i*3:6+i*3, 3:6] = ((i+1)*60, 20, 30, 255)
        source = importer(atelier, client, tmp_path, pixels, "calque-" + str(i))
        v = calques.creer(chemin[0], piece, emploi, {"nature": "image", "resultat": corps}, source, "calque")
        v = calques.regler(chemin[0], piece, emploi, v["identifiant"], 1,
            placement={"ordre": 7-i}, masques={"corps": [{"garde": False, "rayon": 0, "points": [[17+i, 20]]}]})
        calques.valider(chemin[0], piece, emploi, v["identifiant"], v["revision"])
        liens.append({"piece": piece, "emploi": emploi, "priorite": i*3, "actif": True})
        variantes.append(v)
    service = ServiceTenues(atelier)
    demande = {"nom": "Voyage de nuit", "resultats": [{"nature": "image", "identifiant": corps}], "emplois": liens, "pivot": {"x": 11.5, "y": 41}}
    objet = service.creer(chemin[0], personnage, demande)
    return service, objet, variantes


def test_huit_combinaisons_figees_reouvrables_et_sans_fournisseur(tenue, atelier, double, tmp_path):
    service, t, variantes = tenue
    cle = t["sorties"][0]["cle"]
    rendu, compte = {}, {}
    for bits in itertools.product((False, True), repeat=3):
        actifs = [e["piece"] for e, actif in zip(t["emplois"], bits) if actif]
        octets = service.apercu(t["projet"], t["personnage"], t["identifiant"], cle, actifs=actifs)
        rendu[bits] = octets
        image = rgba(octets)
        for i, actif in enumerate(bits):
            assert bool(image[4+i*3, 3, 3]) is actif
            assert bool(image[20, 17+i, 3]) is not actif
        compte[bits] = int(image[:, :, 3].sum())
    assert len(set(rendu.values())) == 8
    e, v = t["emplois"][0], variantes[0]
    # La variante évolue, pas sa photographie dans une tenue conservée.
    atelier.calques_cibles.regler(t["projet"], e["piece"], e["emploi"], v["identifiant"], v["revision"], placement={"dx": 9})
    autre = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurMuet())
    with TestClient(creer_application(autre)):
        relu = ServiceTenues(autre)
        apres = relu.lire(t["projet"], t["personnage"], t["identifiant"])
        assert apres["pivot"] == {"x": 11.5, "y": 41}
        assert apres["couverture"]["toutes_couches_pretes"]
        assert [e["priorite"] for e in apres["emplois"]] == [0, 3, 6]
        assert apres["sorties"][0]["frames"][0]["calques"][0]["placement"]["dx"] == 0
        assert relu.apercu(t["projet"], t["personnage"], t["identifiant"], cle) == rendu[(True, True, True)]
    assert double.appels == 0


def test_le_masque_du_corps_ne_mange_pas_une_autre_piece():
    base = np.full((5, 5, 4), (0, 0, 200, 255), np.uint8)
    rouge, vert = np.zeros_like(base), np.zeros_like(base)
    rouge[2, 2] = (255, 0, 0, 255)
    vert[3, 3] = (0, 255, 0, 255)
    couches = preparer_couches(base, [
        {"piece": "rouge", "pixels": rouge, "priorite": 0, "placement": {}, "masques": {}},
        {"piece": "vert", "pixels": vert, "priorite": 1, "placement": {}, "masques": {"corps": [{"garde": False, "rayon": 0, "points": [[2, 2]]}]}}])
    assert tuple(rgba(composer_couches(base, couches, {"rouge", "vert"}))[2, 2]) == (255, 0, 0, 255)
    assert tuple(rgba(composer_couches(base, couches, {"rouge"}))[2, 2]) == (255, 0, 0, 255)
    assert rgba(composer_couches(base, couches, {"vert"}))[2, 2, 3] == 0


def test_manquant_base_changee_et_revision_ne_substituent_rien(tenue, atelier):
    service, t, _ = tenue
    sans = service.creer(t["projet"], t["personnage"], {**t["demande"], "nom": "Corps seul", "emplois": []})
    assert sans["couverture"]["prete"]
    image = atelier.assets.lire(t["sorties"][0]["resultat"])
    image.recette = Recette(main=Main(opacite=(Trait(garde=False, rayon=1, points=((20, 20),)),)))
    atelier.assets.sauver(image)
    ancien_apercu = service.apercu(t["projet"], t["personnage"], t["identifiant"], t["sorties"][0]["cle"])
    relu = service.lire(t["projet"], t["personnage"], t["identifiant"])
    assert not relu["couverture"]["prete"]
    with pytest.raises(TenueRefusee, match="restent à revoir"):
        service.paquet(t["projet"], t["personnage"], t["identifiant"])
    change = service.regler(t["projet"], t["personnage"], t["identifiant"], 1,
        {**t["demande"], "nom": "Sans casque", "emplois": [{**e, "actif": i != 0} for i, e in enumerate(t["emplois"])]})
    assert change["revision"] == 2
    assert service.apercu(t["projet"], t["personnage"], t["identifiant"], t["sorties"][0]["cle"], revision=1) == ancien_apercu
    with pytest.raises(TenueRefusee, match="autre fenêtre"):
        service.regler(t["projet"], t["personnage"], t["identifiant"], 1, t["demande"])
    restauree = service.restaurer(t["projet"], t["personnage"], t["identifiant"], 2, 1)
    assert restauree["revision"] == 3 and restauree["restauree_de"] == 1
    assert restauree["revisions"] == [1, 2, 3]
    assert service.apercu(t["projet"], t["personnage"], t["identifiant"], t["sorties"][0]["cle"]) == ancien_apercu


def test_api_tenue_et_reference_frame_relisent_les_memes_objets(tenue, client):
    _, t, _ = tenue
    url = f"/api/projects/{t['projet']}/characters/{t['personnage']}/outfits"
    r = client.get(url + "/" + t["identifiant"])
    assert r.status_code == 200, r.text
    assert r.json()["pivot"] == t["pivot"]
    assert client.get(url).json()[0]["identifiant"] == t["identifiant"]
    image = client.get(url + "/" + t["identifiant"] + "/preview.png", params={"sortie": t["sorties"][0]["cle"], "actifs": "[]", "priorites": json.dumps({e["piece"]: -i for i, e in enumerate(t["emplois"])})})
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"
    assert client.get(url + "/" + t["identifiant"] + "/export.zip").content.startswith(b"PK")


def test_livraison_tenue_cible_distincte_et_aseprite_exact(tenue, atelier, tmp_path):
    service, t, _ = tenue
    racine = tmp_path / "godot"
    racine.mkdir()
    (racine / "project.godot").write_text('config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n')
    atelier.livraison.associer(t["projet"], str(racine))
    p = service.prevoir_livraison(t["projet"], t["personnage"], t["identifiant"])
    assemble = service.prevoir_livraison(t["projet"], t["personnage"], t["identifiant"], "assemble")
    assert p["cible_livraison"] != assemble["cible_livraison"]
    livraison = atelier.livraison.livrer(t["projet"], p["jeton"])
    atelier.livraison.livrer(t["projet"], assemble["jeton"])
    assert atelier.livraison.livrer(t["projet"], p["jeton"])["jeton"] == p["jeton"]
    m, fichiers = service.paquet(t["projet"], t["personnage"], t["identifiant"])
    a = m["animations"][0]
    atlas = rgba(fichiers[a["atlas"]["assemble"]])
    assert png(atlas) == service.apercu(t["projet"], t["personnage"], t["identifiant"], t["sorties"][0]["cle"])
    for nom, contenu in fichiers.items():
        if nom.endswith(".json") and nom != "composition.json":
            descriptif = json.loads(contenu)
            assert set(descriptif) == {"frames", "meta"}
            assert set(descriptif["frames"][0]) == {"filename", "frame", "rotated", "trimmed", "spriteSourceSize", "sourceSize", "duration"}
            assert "tenue" not in descriptif["meta"]
    ancienne = atelier.livraison.reprendre(t["projet"], livraison["jeton"])
    assert ancienne["cible_livraison"] == p["cible_livraison"]
    assert atelier.livraison.livrer(t["projet"], ancienne["jeton"])["etat"] == "terminee"


@pytest.mark.lent  # lance le moteur Godot — voir tests/test_au1.py, GODOT
@pytest.mark.skipif(not GODOT, reason="Godot absent : contrôle moteur non effectué.")
def test_godot_synchronise_les_couches_et_retire_une_piece(tenue, atelier, tmp_path):
    service, t, _ = tenue
    _clip_ecrit(atelier)
    bande = _poser_une_bande(atelier, personnage=t["personnage"], pose="marche", direction="sud")
    bande.cadence, bande.sens = 6.5, "aller-retour"
    atelier.base.enregistrer_bande(bande)
    for emploi, variante in zip(t["emplois"], tenue[2]):
        cibles = [c["cible"] for c in atelier.calques_cibles.cibles(t["projet"], emploi["piece"], emploi["emploi"])["cibles"] if c["cible"]["resultat"] == bande.identifiant]
        copies = atelier.calques_cibles.reutiliser(t["projet"], emploi["piece"], emploi["emploi"], variante["identifiant"], cibles, copier_masques=True)
        for copie in copies:
            atelier.calques_cibles.valider(t["projet"], emploi["piece"], emploi["emploi"], copie["identifiant"], copie["revision"])
    t = service.creer(t["projet"], t["personnage"], {**t["demande"], "resultats": [{"nature": "animation", "identifiant": bande.identifiant, "boucle": False}]})
    racine = tmp_path / "godot"
    racine.mkdir()
    (racine / "project.godot").write_text('config_version=5\n[application]\nconfig/name="AU17"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n')
    atelier.livraison.associer(t["projet"], str(racine))
    p = service.prevoir_livraison(t["projet"], t["personnage"], t["identifiant"])
    p = atelier.livraison.livrer(t["projet"], p["jeton"])
    script = '''extends SceneTree
func _initialize() -> void:
    call_deferred("_tester")
func _tester() -> void:
    var scene = load(SCENE).instantiate()
    root.add_child(scene)
    await process_frame
    assert(scene.get_node("Piece0_dessus").visible)
    assert(scene.get_node("Corps").material.get_shader_parameter("actif_0"))
    scene.equiper(PIECE, false)
    assert(not scene.get_node("Piece0_dessus").visible)
    assert(not scene.get_node("Corps").material.get_shader_parameter("actif_0"))
    assert(scene.get_node("Piece1_dessus").visible)
    assert(scene.get_node("Corps").offset == Vector2(11.5, 41) * -1)
    assert(scene.get_node("Piece1_dessus").frame == scene.get_node("Corps").frame)
    var corps = scene.get_node("Corps")
    corps.set_frame_and_progress(2, 0.4)
    assert(scene.get_node("Piece1_dessus").frame == 2)
    assert(scene.get_node("Piece1_dessus").frame_progress == corps.frame_progress)
    assert(not corps.sprite_frames.get_animation_loop(corps.animation))
    assert(abs(corps.sprite_frames.get_animation_speed(corps.animation) - (1000.0 / 154.0)) < 0.001)
    assert(corps.sprite_frames.get_frame_count(corps.animation) == COMPTE)
    print("AU17_GODOT_OK")
    quit()
'''.replace("SCENE", json.dumps(p["scene"])).replace("PIECE", json.dumps(t["emplois"][0]["piece"])).replace("COMPTE", str(len(t["sorties"][0]["ordre"])))
    (racine / "preuve.gd").write_text(script, encoding="utf-8")
    importe = subprocess.run([GODOT, "--headless", "--path", str(racine), "--editor", "--import"], capture_output=True, text=True, timeout=60)
    assert importe.returncode == 0, importe.stdout + importe.stderr
    assert "Parse Error" not in importe.stderr, importe.stderr
    preuve = subprocess.run([GODOT, "--headless", "--path", str(racine), "--script", "preuve.gd"], capture_output=True, text=True, timeout=30)
    assert "AU17_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
