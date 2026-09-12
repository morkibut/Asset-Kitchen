"""AU1/AU5 : vrais fichiers et MCP ; zéro fournisseur, Godot si installé.

La preuve sépare une révision publiée de la version courante en bibliothèque.
On referme et rouvre le service entre préparation et dépôt, puis on abîme un
fichier du jeu. Les frames de couleurs distinctes révèlent un ordre incorrect.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from atelier.domaine.bande import ALLER_RETOUR, Bande, Prise
from atelier.mcp.serveur import creer_serveur
from atelier.services import Atelier
from atelier.services.livraison import LivraisonRefusee, ServiceLivraison


def _bande(atelier, projet, personnage, identifiant="marche-1", pose="marche", direction="ouest", cadence=16):
    bande = Bande(identifiant=identifiant, clip="clip-source", nom=identifiant,
                  projet=projet, personnage=personnage, pose=pose, direction=direction,
                  prises=tuple(Prise(i) for i in range(4)), cadence=cadence,
                  sens=ALLER_RETOUR, case_largeur=12, case_hauteur=16)
    image = Image.new("RGBA", (48, 16))
    dessin = ImageDraw.Draw(image)
    for i, couleur in enumerate(["red", "green", "blue", "yellow"]):
        dessin.rectangle((i * 12 + 2, 2, i * 12 + 9, 14), fill=couleur)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(bande.clip, identifiant, tampon.getvalue())
    atelier.fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
    atelier.base.enregistrer_bande(bande)
    return bande


@pytest.fixture
def decor(atelier, tmp_path):
    projet = atelier.bibliotheque.creer_projet("Le jeu AU1").identifiant
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin").identifiant
    godot = tmp_path / "Jeu Godot"
    godot.mkdir()
    (godot / "project.godot").write_text('config_version=5\n[application]\nconfig/name="Essai AU1"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    bande = _bande(atelier, projet, personnage)
    return projet, personnage, godot, bande


def _service(atelier):
    return ServiceLivraison(atelier.base, atelier.fichiers, atelier.export, atelier.production, atelier.diffusion)


def _associer(atelier, decor):
    projet, personnage, godot, bande = decor
    atelier.livraison.associer(projet, str(godot))
    return atelier.livraison.prevoir(projet, personnage, [bande.identifiant], pivot_x=4, pivot_y=13)


def test_preparer_reouvrir_livrer_le_snapshot_exact(atelier, decor, double):
    projet, personnage, godot, bande = decor
    avant = double.appels
    apercu = _associer(atelier, decor)
    assert list(godot.iterdir()) == [godot / "project.godot"]
    assert apercu["pivot"] == {"x": 4, "y": 13}
    assert apercu["animations"][0]["ordre"] == [0, 1, 2, 3, 2, 1]
    assert apercu["animations"][0]["duree_image_ms"] == 62
    # La bibliothèque évolue pendant que la préparation attend : le jeton
    # doit livrer la version relue, jamais les derniers réglages par accident.
    bande.cadence = 9
    bande.favori = True
    atelier.base.enregistrer_bande(bande)
    autre_atelier = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre_atelier.bibliotheque.ouvrir()
    rouvert = autre_atelier.livraison
    garde = rouvert.historique(projet)["livraisons"][0]
    assert garde["jeton"] == apercu["jeton"]
    bilan = rouvert.livrer(projet, garde["jeton"])
    assert bilan["etat"] == "terminee"
    assert bilan["animations"][0]["cadence"] == 16
    assert bilan["pivot"] == {"x": 4, "y": 13}
    sprite_frames = (godot / bilan["sprite_frames"].removeprefix("res://")).read_text(encoding="utf-8")
    assert '"speed": 16.1290322581' in sprite_frames
    for fichier in bilan["fichiers"]:
        assert (godot / fichier["chemin"]).is_file()
    assert double.appels == avant
    assert _service(atelier).livrer(projet, garde["jeton"])["revision"] == bilan["revision"]


def test_reviser_une_case_conserve_autres_versions_et_scene_stable(atelier, decor):
    projet, personnage, godot, marche = decor
    repos = _bande(atelier, projet, personnage, "repos-1", "repos", "sud", 7)
    atelier.livraison.associer(projet, str(godot))
    preparation = atelier.livraison.prevoir(projet, personnage, [marche.identifiant, repos.identifiant])
    premiere = atelier.livraison.livrer(projet, preparation["jeton"])
    ancien_repos = next(a for a in premiere["animations"] if a["pose"] == "repos")
    repos.cadence = 30
    repos.favori = True
    atelier.base.enregistrer_bande(repos)
    marche2 = _bande(atelier, projet, personnage, "marche-2", "marche", "ouest", 11)
    seconde = atelier.livraison.prevoir(projet, personnage, [marche2.identifiant])
    assert next(a for a in seconde["animations"] if a["pose"] == "repos") == ancien_repos
    assert seconde["scene"] == premiere["scene"]
    assert seconde["revision"] != premiere["revision"]
    livree = atelier.livraison.livrer(projet, seconde["jeton"])
    assert len(livree["animations"]) == 2
    assert (godot / premiere["sprite_frames"].removeprefix("res://")).is_file()


@pytest.mark.parametrize("connu", [False, True])
def test_fichier_inconnu_ou_modifie_jamais_ecrase(atelier, decor, connu):
    projet, personnage, godot, bande = decor
    preparation = _associer(atelier, decor)
    if connu:
        atelier.livraison.livrer(projet, preparation["jeton"])
    stable = godot / preparation["scene"].removeprefix("res://")
    stable.parent.mkdir(parents=True, exist_ok=True)
    stable.write_bytes(b"Le travail de l'auteur")
    preparation = atelier.livraison.prevoir(projet, personnage, [bande.identifiant])
    assert not preparation["pret"]
    assert preparation["conflits"]
    with pytest.raises(LivraisonRefusee, match="Conflit"):
        atelier.livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == b"Le travail de l'auteur"


def test_reprise_apres_interruption_garde_ancienne_scene(atelier, decor, monkeypatch):
    from atelier.services import livraison as module

    projet, personnage, godot, bande = decor
    premiere = atelier.livraison.livrer(projet, _associer(atelier, decor)["jeton"])
    stable = godot / premiere["scene"].removeprefix("res://")
    ancienne_scene = stable.read_bytes()
    bande2 = _bande(atelier, projet, personnage, "marche-2", cadence=11)
    preparation = atelier.livraison.prevoir(projet, personnage, [bande2.identifiant])
    poser = module._poser
    compte = 0

    def interrompre(chemin, octets):
        nonlocal compte
        if chemin.is_relative_to(godot):
            compte += 1
            if compte == 3:
                raise OSError("disque momentanément indisponible")
        return poser(chemin, octets)

    monkeypatch.setattr(module, "_poser", interrompre)
    with pytest.raises(LivraisonRefusee, match="interrompue"):
        atelier.livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == ancienne_scene
    assert _service(atelier).historique(projet)["livraisons"][0]["etat"] == "interrompue"
    monkeypatch.setattr(module, "_poser", poser)
    reprise = _service(atelier).livrer(projet, preparation["jeton"])
    assert reprise["etat"] == "terminee"
    assert stable.read_bytes() != ancienne_scene


def test_aperçu_perime_ne_remplace_pas_revision_plus_recente(atelier, decor):
    projet, personnage, _, bande = decor
    premier = _associer(atelier, decor)
    second = atelier.livraison.prevoir(projet, personnage, [bande.identifiant], pivot_x=3)
    atelier.livraison.livrer(projet, second["jeton"])
    with pytest.raises(LivraisonRefusee, match="autre révision"):
        atelier.livraison.livrer(projet, premier["jeton"])


def test_reprendre_ancienne_revision_restaure_pixels_et_reglages(atelier, decor):
    projet, personnage, godot, bande = decor
    premiere = atelier.livraison.livrer(projet, _associer(atelier, decor)["jeton"])
    stable = godot / premiere["scene"].removeprefix("res://")
    ancien_contenu = stable.read_bytes()
    bande2 = _bande(atelier, projet, personnage, "marche-2", cadence=11)
    second = atelier.livraison.prevoir(projet, personnage, [bande2.identifiant], pivot_x=1, pivot_y=9)
    atelier.livraison.livrer(projet, second["jeton"])
    assert stable.read_bytes() != ancien_contenu
    # Répéter le vieil appel n'annule pas la nouvelle livraison.
    atelier.livraison.livrer(projet, premiere["jeton"])
    assert stable.read_bytes() != ancien_contenu
    # La reprise explicite crée une nouvelle préparation de l'ancienne version.
    reprise = _service(atelier).reprendre(projet, premiere["jeton"])
    assert reprise["jeton"] != premiere["jeton"]
    assert reprise["revision"] == premiere["revision"]
    assert reprise["pivot"] == {"x": 4, "y": 13}
    assert reprise["animations"][0]["cadence"] == 16
    atelier.livraison.livrer(projet, reprise["jeton"])
    assert stable.read_bytes() == ancien_contenu


@pytest.mark.parametrize("relatif", ["../ailleurs", "C:/ailleurs", "/absolu", "assets/../ailleurs", "assets//test", "assets/.. /ailleurs"])
def test_dossier_borne(atelier, decor, relatif):
    projet, _, godot, _ = decor
    with pytest.raises(LivraisonRefusee, match="chemin relatif"):
        atelier.livraison.associer(projet, str(godot), relatif)


def test_lien_symbolique_refuse(atelier, decor, tmp_path):
    projet, _, godot, _ = decor
    ailleurs = tmp_path / "ailleurs"
    ailleurs.mkdir()
    try:
        (godot / "assets").symlink_to(ailleurs, target_is_directory=True)
    except OSError:
        pytest.skip("La création de liens symboliques n'est pas autorisée ici.")
    with pytest.raises(LivraisonRefusee, match="lien"):
        atelier.livraison.associer(projet, str(godot))
    assert not list(ailleurs.iterdir())


def test_reprise_apres_publication_cible_avant_reponse(atelier, decor, monkeypatch):
    from atelier.services import livraison as module

    projet, _, _, _ = decor
    preparation = _associer(atelier, decor)
    poser = module._poser
    coupe = False

    def couper_reponse(chemin, octets):
        nonlocal coupe
        if chemin.parent.name == "preparations" and json.loads(octets).get("etat") == "terminee" and not coupe:
            coupe = True
            raise OSError("réponse interrompue")
        return poser(chemin, octets)

    monkeypatch.setattr(module, "_poser", couper_reponse)
    with pytest.raises(LivraisonRefusee, match="interrompue"):
        atelier.livraison.livrer(projet, preparation["jeton"])
    monkeypatch.setattr(module, "_poser", poser)
    reprise = _service(atelier).livrer(projet, preparation["jeton"])
    assert reprise["etat"] == "terminee"
    assert reprise["revision"] == preparation["revision"]


def test_reprise_ne_revendique_pas_un_fichier_interrompu_modifie(atelier, decor, monkeypatch):
    from atelier.services import livraison as module

    projet, _, godot, _ = decor
    preparation = _associer(atelier, decor)
    poser = module._poser
    compte = 0

    def interrompre(chemin, octets):
        nonlocal compte
        if chemin.is_relative_to(godot):
            compte += 1
            if compte == 2:
                raise OSError("interruption")
        return poser(chemin, octets)

    monkeypatch.setattr(module, "_poser", interrompre)
    with pytest.raises(LivraisonRefusee):
        atelier.livraison.livrer(projet, preparation["jeton"])
    premier = godot / preparation["fichiers"][0]["chemin"]
    premier.write_bytes("modification externe après l'interruption".encode("utf-8"))
    monkeypatch.setattr(module, "_poser", poser)
    with pytest.raises(LivraisonRefusee, match="Conflit"):
        _service(atelier).livrer(projet, preparation["jeton"])
    assert premier.read_bytes() == "modification externe après l'interruption".encode("utf-8")


def test_deux_publications_simultanees_sont_serialisees(atelier, decor):
    from atelier.services.livraison import _verrou

    projet, _, _, _ = decor
    preparation = _associer(atelier, decor)
    with _verrou(atelier.livraison._dossier(projet) / ".verrou"):
        with pytest.raises(LivraisonRefusee, match="autre livraison"):
            _service(atelier).livrer(projet, preparation["jeton"])
    assert _service(atelier).livrer(projet, preparation["jeton"])["etat"] == "terminee"


def test_formats_aseprite_stricts_et_boucle_choisie(atelier, decor):
    projet, personnage, godot, bande = decor
    atelier.livraison.associer(projet, str(godot))
    preparation = atelier.livraison.prevoir(projet, personnage, [bande.identifiant], boucles={bande.identifiant: False})
    bilan = atelier.livraison.livrer(projet, preparation["jeton"])
    descriptif = next(f for f in bilan["fichiers"] if f["role"] == "Aseprite")
    contenu = json.loads((godot / descriptif["chemin"]).read_text(encoding="utf-8"))
    assert set(contenu) == {"frames", "meta"}
    assert set(contenu["meta"]) == {"app", "version", "image", "format", "size", "scale", "frameTags"}
    assert set(contenu["frames"][0]) == {"filename", "frame", "rotated", "trimmed", "spriteSourceSize", "sourceSize", "duration"}
    assert '"loop": false' in (godot / bilan["sprite_frames"].removeprefix("res://")).read_text(encoding="utf-8")


async def test_mcp_retrouve_prepare_et_livre_memes_services(atelier, decor, double):
    projet, personnage, godot, bande = decor
    serveur = creer_serveur(atelier)

    async def appeler(nom, **arguments):
        resultat = await serveur.call_tool(nom, arguments)
        assert not resultat.is_error, resultat
        return resultat.structured_content

    avant = double.appels
    await appeler("link_godot_project", project=projet, directory=str(godot))
    liste = await appeler("list_animation_deliveries", project=projet, character=personnage)
    assert [b["identifiant"] for b in liste["animations"]] == [bande.identifiant]
    apercu = await appeler("preview_animation_delivery", project=projet, character=personnage,
                           strips=[bande.identifiant], pivot_x=5, pivot_y=12)
    livre = await appeler("publish_animation_delivery", project=projet, token=apercu["jeton"])
    assert livre["etat"] == "terminee"
    assert livre["pivot"] == {"x": 5, "y": 12}
    assert atelier.livraison.historique(projet)["livraisons"][0]["jeton"] == livre["jeton"]
    assert double.appels == avant


def test_routes_interface_memes_selection_et_livraison(atelier, client, decor):
    projet, personnage, godot, bande = decor
    racine = f"/api/projects/{projet}"
    assert client.get(f"{racine}/godot-link").json() is None
    association = client.put(f"{racine}/godot-link", json={"dossier": str(godot)})
    assert association.status_code == 200, association.text
    assert len(client.get(f"{racine}/delivery-animations", params={"personnage": personnage}).json()) == 1
    apercu = client.post(f"{racine}/deliveries/preview", json={"personnage": personnage, "bandes": [bande.identifiant], "pivot_x": 2, "pivot_y": 14})
    assert apercu.status_code == 200, apercu.text
    livraison = client.post(f"{racine}/deliveries", json={"jeton": apercu.json()["jeton"]})
    assert livraison.status_code == 200, livraison.text
    assert client.get(f"{racine}/deliveries").json()["livraisons"][0]["pivot"] == {"x": 2, "y": 14}


def test_transport_mcp_http_livre_sans_intervention_du_navigateur(atelier, client, decor, double):
    projet, personnage, godot, bande = decor
    entetes = {"Accept": "application/json, text/event-stream", "Host": "127.0.0.1:8420"}
    ouverture = client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "essai-au1", "version": "1"},
    }})
    assert ouverture.status_code == 200, ouverture.text
    entetes["mcp-session-id"] = ouverture.headers["mcp-session-id"]
    entetes["mcp-protocol-version"] = "2025-06-18"
    client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    compteur = 1

    def appeler(nom, **arguments):
        nonlocal compteur
        compteur += 1
        reponse = client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": compteur,
            "method": "tools/call", "params": {"name": nom, "arguments": arguments}})
        assert reponse.status_code == 200, reponse.text
        if reponse.headers.get("content-type", "").startswith("text/event-stream"):
            retour = next(json.loads(ligne[5:]) for ligne in reponse.text.splitlines()
                          if ligne.startswith("data:") and '"result"' in ligne)
        else:
            retour = reponse.json()
        assert not retour.get("error"), retour
        assert not retour["result"].get("isError"), retour
        return retour["result"]["structuredContent"]

    avant = double.appels
    appeler("link_godot_project", project=projet, directory=str(godot))
    candidates = appeler("list_animation_deliveries", project=projet, character=personnage)
    apercu = appeler("preview_animation_delivery", project=projet, character=personnage,
                     strips=[candidates["animations"][0]["identifiant"]], pivot_x=3, pivot_y=10)
    bilan = appeler("publish_animation_delivery", project=projet, token=apercu["jeton"])
    assert bilan["etat"] == "terminee"
    assert (godot / bilan["scene"].removeprefix("res://")).is_file()
    assert double.appels == avant


GODOT = next((str(p) for p in [Path(os.environ.get("GODOT_EXECUTABLE", "absent")),
             Path("C:/STOCKAGE/PROJET/GODOT/Godot_v4.7.2-stable_win64_console.exe")]
             if p.is_file()), shutil.which("godot") or shutil.which("godot4"))


@pytest.mark.skipif(not GODOT, reason="Godot absent : contrôle moteur non effectué.")
def test_godot_charge_la_scene_et_joue_ordre_cadence_pivot(atelier, decor):
    projet, personnage, godot, _ = decor
    bilan = atelier.livraison.livrer(projet, _associer(atelier, decor)["jeton"])
    nom = bilan["animations"][0]["nom"]
    # Une scène réellement instanciée joue librement. À chaque changement, on
    # lit la texture source, pas un compteur réimplémenté en Python.
    script = '''extends SceneTree
var sujet: AnimatedSprite2D
var vues: Array[int] = []
func _initialize():
    var scene = load(SCENE)
    assert(scene is PackedScene)
    sujet = scene.instantiate()
    root.add_child(sujet)
    assert(sujet is AnimatedSprite2D)
    assert(sujet.offset == Vector2(-4, -13))
    assert(not sujet.centered)
    var sf = sujet.sprite_frames
    assert(sf.get_frame_count(NOM) == 6)
    assert(abs(sf.get_animation_speed(NOM) - 1000.0 / 62.0) < 0.00001)
    assert(sf.get_animation_loop(NOM))
    var attendu = [0, 12, 24, 36, 24, 12]
    for i in range(6):
        assert(sf.get_frame_texture(NOM, i).region.position.x == attendu[i])
    sujet.frame_changed.connect(_frame)
    sujet.play(NOM)
    create_timer(0.55).timeout.connect(_fin)
func _frame():
    vues.append(sujet.frame)
func _fin():
    assert(vues.size() >= 7)
    assert(vues.slice(0, 6) == [1, 2, 3, 4, 5, 0])
    print("AU1_GODOT_OK")
    quit()
'''.replace("SCENE", json.dumps(bilan["scene"])).replace("NOM", json.dumps(nom))
    (godot / "preuve.gd").write_text(script, encoding="utf-8")
    importe = subprocess.run([GODOT, "--headless", "--path", str(godot), "--editor", "--import"],
                              capture_output=True, text=True, timeout=50, encoding="utf-8", errors="replace")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    preuve = subprocess.run([GODOT, "--headless", "--path", str(godot), "--script", "preuve.gd"],
                             capture_output=True, text=True, timeout=15, encoding="utf-8", errors="replace")
    assert preuve.returncode == 0, preuve.stdout + preuve.stderr
    assert "AU1_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr
    # Une nouvelle version garde l'adresse utilisée par la scène du jeu, mais
    # Godot doit relire la nouvelle cadence et le nouveau pivot à cette adresse.
    bande2 = _bande(atelier, projet, personnage, "marche-2", cadence=11)
    deux = atelier.livraison.prevoir(projet, personnage, [bande2.identifiant], pivot_x=3, pivot_y=14)
    atelier.livraison.livrer(projet, deux["jeton"])
    assert deux["scene"] == bilan["scene"]
    script2 = script.replace("Vector2(-4, -13)", "Vector2(-3, -14)").replace("1000.0 / 62.0", "1000.0 / 91.0")
    script2 = script2.replace("create_timer(0.55)", "create_timer(0.8)")
    (godot / "preuve.gd").write_text(script2, encoding="utf-8")
    importe2 = subprocess.run([GODOT, "--headless", "--path", str(godot), "--editor", "--import"],
                               capture_output=True, text=True, timeout=50, encoding="utf-8", errors="replace")
    assert importe2.returncode == 0, importe2.stdout + importe2.stderr
    preuve2 = subprocess.run([GODOT, "--headless", "--path", str(godot), "--script", "preuve.gd"],
                              capture_output=True, text=True, timeout=15, encoding="utf-8", errors="replace")
    assert preuve2.returncode == 0, preuve2.stdout + preuve2.stderr
    assert "AU1_GODOT_OK" in preuve2.stdout, preuve2.stdout + preuve2.stderr
    assert "SCRIPT ERROR" not in preuve2.stderr
