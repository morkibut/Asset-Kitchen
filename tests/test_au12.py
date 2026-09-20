"""AU12 : autres familles, mêmes gestes et fichiers Godot réellement ouverts."""
import json
import subprocess
from pathlib import Path

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.demande import Demande
from atelier.services import Atelier
from atelier.services.livraison import LivraisonRefusee
from tests.conftest import image_sujet
from tests.test_au1 import GODOT
from tests.test_au3 import production, _fin  # fixture de fournisseurs doublés


@pytest.fixture
async def fixe(atelier, double, tmp_path):
    await atelier.ouvrir()
    double.rendre = image_sujet
    projet = atelier.bibliotheque.courant
    jeu = atelier.base.lire_projet(projet)
    jeu.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(jeu)
    godot = tmp_path / "Godot-AU12"
    godot.mkdir()
    (godot / "project.godot").write_text('config_version=5\n[application]\nconfig/name="AU12"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    atelier.livraison.associer(projet, str(godot))
    yield atelier, projet, godot
    await atelier.file_locale.fermer()


async def produire(atelier, projet, nom, famille):
    sujet = atelier.production.creer_personnage(projet, nom, f"Le {nom} de cet univers", famille=famille)
    sujet = atelier.production.regler_personnage(projet, sujet.identifiant, ajouter="Version")
    atelier.production.definir_objectif(projet, sujet.identifiant, {"sorties": [{"nature": "image", "pose": "version", "direction": "ouest"}]})
    generation, _, _ = atelier.generations.preparer("essai:rend-du-png", Demande(prompt=sujet.description, echelle=sujet.type),
        projet=projet, personnage=sujet.identifiant, pose="version", direction="ouest")
    snapshot = atelier.generations.demande_preparee(generation)
    await atelier.generations.executer_preparee(generation.identifiant, snapshot)
    image = atelier.base.assets_du_personnage(sujet.identifiant, projet=projet)[0]
    return sujet, image, snapshot


@pytest.mark.parametrize("nom,famille,usage", [("Portrait", "interface", "interface"), ("Arbre", "decors", "monde"), ("Bouton HUD", "interface", "interface")])
async def test_familles_fixes_produisent_relisent_et_livrent_sans_animation(fixe, double, nom, famille, usage):
    atelier, projet, godot = fixe
    sujet, image, snapshot = await produire(atelier, projet, nom, famille)
    assert double.demandes[-1].prompt == snapshot.prompt and sujet.description in snapshot.prompt
    assert atelier.production.objectif_de(projet, sujet.identifiant)["couverture"]["animations"]["demande"] == 0
    versions = atelier.livraison_images.images(projet, sujet.identifiant)
    assert versions["famille"] == famille and versions["images"][0]["identifiant"] == image.identifiant
    avant = double.appels
    vue = atelier.livraison_images.prevoir(projet, sujet.identifiant, image.identifiant, usage=usage, pivot_x=9, pivot_y=13)
    attendu = atelier.export.octets_du_rendu(image)
    assert vue["nature"] == "image" and vue["sprite_frames"] is None and vue["animations"] == []
    assert len(list(godot.iterdir())) == 1
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre.bibliotheque.ouvrir()
    garde = autre.livraison.historique(projet)["livraisons"][0]
    assert garde["pivot"] == {"x": 9, "y": 13} and garde["source"]["recette"] == image.recette.en_json()
    bilan = autre.livraison.livrer(projet, garde["jeton"])
    image_livree = next(f for f in bilan["fichiers"] if f["chemin"].endswith("/image.png"))
    assert (godot / image_livree["chemin"]).read_bytes() == attendu
    assert bilan["ressource"].endswith("/texture.tres") and double.appels == avant
    assert autre.livraison.livrer(projet, garde["jeton"])["revision"] == bilan["revision"]


async def test_image_revisee_restaure_pixels_et_protege_fichiers_inconnus(fixe):
    atelier, projet, godot = fixe
    sujet, image, _ = await produire(atelier, projet, "Arbre", "decors")
    debut = atelier.livraison_images.prevoir(projet, sujet.identifiant, image.identifiant)
    premiere = atelier.livraison.livrer(projet, debut["jeton"])
    source = next(f for f in premiere["fichiers"] if f["chemin"].endswith("/image.png"))
    originaux = (godot / source["chemin"]).read_bytes()
    seconde_image = atelier.generations.importer(image_sujet(toile=24, bloc=1, logique_l=10, logique_h=12), "Autre arbre", projet=projet)["asset"]["identifiant"]
    atelier.production.designer(seconde_image, projet=projet, personnage=sujet.identifiant, pose="version", direction="ouest")
    seconde = atelier.livraison_images.prevoir(projet, sujet.identifiant, seconde_image, pivot_x=3, pivot_y=4)
    assert seconde["revision"] != premiere["revision"] and seconde["scene"] == premiere["scene"]
    atelier.livraison.livrer(projet, seconde["jeton"])
    restauree = atelier.livraison.reprendre(projet, premiere["jeton"])
    atelier.livraison.livrer(projet, restauree["jeton"])
    assert (godot / source["chemin"]).read_bytes() == originaux
    stable = godot / premiere["scene"].removeprefix("res://")
    stable.write_bytes(b"fichier modifie par auteur")
    conflit = atelier.livraison_images.prevoir(projet, sujet.identifiant, seconde_image)
    assert not conflit["pret"]
    with pytest.raises(LivraisonRefusee, match="Conflit"):
        atelier.livraison.livrer(projet, conflit["jeton"])
    assert stable.read_bytes() == b"fichier modifie par auteur"


async def test_coffre_anime_utilise_demande_commune_sans_rig(production, double):
    atelier, projet, demande, animateur = production
    coffre = atelier.production.creer_personnage(projet, "Coffre", "Un coffre qui s’ouvre", famille="objets")
    coffre = atelier.production.regler_personnage(projet, coffre.identifiant, ajouter="Ouverture")
    atelier.production.definir_objectif(projet, coffre.identifiant, {"sorties": [{"nature": "animation", "pose": "ouverture", "direction": "ouest"}], "largeur": 64, "hauteur": 64})
    travail = await atelier.travaux.preparer(projet, {**demande, "cle": "coffre-ouvert", "personnage": coffre.identifiant, "pose": "ouverture", "prompt_video": "Open the chest lid"})
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini
    assert atelier.montage.bande(fini["bandes"][0]).personnage == coffre.identifiant
    assert atelier.production.famille_de(projet, coffre) == "objets"
    assert double.appels == len(animateur.soumissions) == 1
    assert not list(atelier.fichiers.racine.glob("**/*.glb"))


async def test_api_mcp_images_utilisent_meme_preparation(fixe):
    atelier, projet, _ = fixe
    sujet, image, _ = await produire(atelier, projet, "Portrait", "interface")
    app = creer_application(atelier)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
        liste = await client.get(f"/api/projects/{projet}/characters/{sujet.identifiant}/delivery-images")
        assert liste.status_code == 200 and liste.json()["images"][0]["identifiant"] == image.identifiant
        vue = await client.post(f"/api/projects/{projet}/image-deliveries/preview", json={"personnage": sujet.identifiant, "image": image.identifiant, "usage": "interface"})
        assert vue.status_code == 200, vue.text
        publie = await client.post(f"/api/projects/{projet}/deliveries", json={"jeton": vue.json()["jeton"]})
        assert publie.status_code == 200 and publie.json()["nature"] == "image"
    noms = {t.name for t in await app.state.mcp.list_tools()}
    assert {"list_image_delivery_versions", "preview_image_delivery"} <= noms


@pytest.mark.lent  # lance le moteur Godot — voir tests/test_au1.py, GODOT
@pytest.mark.skipif(not GODOT, reason="Godot absent : contrôle moteur non effectué.")
async def test_godot_charge_sprite_decor_et_texture_interface(fixe):
    atelier, projet, godot = fixe
    scenes = []
    for nom, famille, usage in [("Arbre", "decors", "monde"), ("Portrait", "interface", "interface"), ("Bouton HUD", "interface", "interface")]:
        sujet, image, _ = await produire(atelier, projet, nom, famille)
        vue = atelier.livraison_images.prevoir(projet, sujet.identifiant, image.identifiant, usage=usage, pivot_x=7, pivot_y=11)
        scenes.append(atelier.livraison.livrer(projet, vue["jeton"]))
    script = 'extends SceneTree\nfunc _initialize():\n'
    for i, scene in enumerate(scenes):
        script += f'    var image{i} = load({json.dumps(scene["scene"])}).instantiate()\n'
        script += f'    assert(image{i} is {"Sprite2D" if scene["usage"] == "monde" else "TextureRect"})\n'
        script += f'    assert(image{i}.texture.get_width() == {scene["dimensions"]["largeur"]})\n'
        script += f'    assert(image{i}.texture.get_height() == {scene["dimensions"]["hauteur"]})\n'
        script += f'    assert(image{i}.{"offset" if scene["usage"] == "monde" else "position"} == Vector2(-7, -11))\n'
        script += f'    image{i}.free()\n'
    script += '    print("AU12_GODOT_OK")\n    quit()\n'
    (godot / "preuve.gd").write_text(script, encoding="utf-8")
    importe = subprocess.run([GODOT, "--headless", "--path", str(godot), "--editor", "--import"], capture_output=True, text=True, timeout=60)
    assert importe.returncode == 0, importe.stdout + importe.stderr
    preuve = subprocess.run([GODOT, "--headless", "--path", str(godot), "--script", "preuve.gd"], capture_output=True, text=True, timeout=30)
    assert "AU12_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
