"""Un signal stéréo réel reste distinct du silence, jusqu'au moteur Godot."""
import io
import json
import subprocess
import wave

import numpy as np
import pytest

from atelier.audio.traitement import encoder, _ffmpeg
from atelier.domaine.son import SonRefuse
from atelier.services import Atelier
from tests.test_au1 import GODOT


def signal(taux=16000):
    gauche = .25 * np.sin(2 * np.pi * 440 * np.arange(taux) / taux)
    return encoder(np.column_stack((gauche, -gauche)), taux)


@pytest.fixture
def audio(atelier, client):
    return atelier, atelier.bibliotheque.courant


def test_son_reouvre_recette_non_defaut_stereo_et_cache_reconstruit(audio, double):
    atelier, projet = audio
    son = atelier.sons.importer_octets(projet, signal(), nom="Épée.wav", cle="appel:42")
    assert son["pret"] and son["mesures"]["canaux"] == 2
    identifiant = son["identifiant"]
    recette = {"debut": .13, "fin": .83, "taux": 22050, "normaliser": True, "cible_db": -3,
        "fondu_entree_ms": 17, "fondu_sortie_ms": 21, "boucle": True, "boucle_debut": .05, "boucle_fin": .6}
    garde = atelier.sons.regler(projet, identifiant, 1, recette, nom="Épée divine")
    atelier.sons.juger(projet, identifiant, 2, "retenue")
    rendu = atelier.sons.rendu(projet, identifiant, 2).read_bytes()
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre.bibliotheque.ouvrir()
    lu = autre.sons.lire(projet, identifiant)
    assert lu["revision"] == 2 and lu["recette"]["fondu_entree_ms"] == 17
    assert lu["nom"] == "Épée divine" and lu["jugement"] == "retenue"
    assert lu["mesures"]["taux"] == 22050 and lu["mesures"]["boucle"]["debut"] == 1102
    chemin = autre.sons.rendu(projet, identifiant, 2)
    chemin.unlink()
    assert autre.sons.rendu(projet, identifiant, 2).read_bytes() == rendu
    assert autre.sons.importer_octets(projet, signal(), nom="Doublon.wav", cle="appel:42")["revision"] == 2
    with pytest.raises(SonRefuse, match="déjà acquis"):
        autre.sons.importer_octets(projet, b"autre", cle="appel:42")
    with pytest.raises(SonRefuse, match="autre fenêtre"):
        autre.sons.regler(projet, identifiant, 1, {})
    with wave.open(io.BytesIO(rendu)) as wav:
        valeurs = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").reshape(-1, 2)
    assert np.max(np.abs(valeurs.sum(axis=1))) <= 1 and np.max(np.abs(valeurs)) > 1000
    assert double.appels == 0


def test_silence_fichier_invalide_et_saturation_ne_sont_pas_prets(audio):
    atelier, projet = audio
    silencieux = atelier.sons.importer_octets(projet, encoder(np.zeros((8000, 2)), 8000), nom="Silence.wav")
    invalide = atelier.sons.importer_octets(projet, b"source payee illisible", nom="Retour.mp3", cle="job-invalide")
    assert not silencieux["pret"] and not invalide["pret"]
    assert atelier.sons.source(projet, invalide["identifiant"]).read_bytes() == b"source payee illisible"
    for son in (silencieux, invalide):
        with pytest.raises(SonRefuse):
            atelier.sons.paquet(projet, son["identifiant"])
    propre = atelier.sons.importer_octets(projet, signal())
    sature = atelier.sons.regler(projet, propre["identifiant"], 1, {"gain_db": 24})
    assert not sature["pret"] and sature["mesures"]["ecretes"] > 0
    assert atelier.sons.lire(projet, propre["identifiant"], 1)["pret"]


async def test_mcp_import_retouche_relecture_et_api_partagent_les_versions(audio, client, tmp_path):
    from atelier.mcp.serveur import creer_serveur
    from mcp.server.mcpserver.exceptions import ToolError
    atelier, projet = audio
    serveur = creer_serveur(atelier)
    chemin = tmp_path / "son-import.mp3"
    chemin.write_bytes(signal())  # L'en-tête réel est décodé, pas l'extension.
    importe = await serveur.call_tool("import_sound", {"project": projet, "file_path": str(chemin), "key": "import-son"})
    assert not importe.is_error, importe
    son = importe.structured_content
    base = f"/api/projects/{projet}/sounds/{son['identifiant']}"
    assert client.get(base).json()["source"] == son["source"]
    assert client.get(son["apercu"]).content[:4] == b"RIFF"
    modifie = await serveur.call_tool("edit_sound", {"project": projet, "sound": son["identifiant"], "revision": 1,
        "recipe": {"debut": .17, "fin": .87, "fondu_entree_ms": 33, "boucle": True, "boucle_debut": .1, "boucle_fin": .6}})
    assert not modifie.is_error, modifie
    jugement = await serveur.call_tool("judge_sound", {"project": projet, "sound": son["identifiant"], "revision": 2, "judgment": "retenue"})
    assert not jugement.is_error, jugement
    relu = await serveur.call_tool("get_sound", {"project": projet, "sound": son["identifiant"]})
    assert relu.structured_content["recette"]["fondu_entree_ms"] == 33
    assert client.get(base).json()["jugement"] == "retenue"
    ancien = await serveur.call_tool("get_sound", {"project": projet, "sound": son["identifiant"], "revision": 1})
    assert ancien.structured_content["recette"]["debut"] == 0
    restaure = await serveur.call_tool("restore_sound", {"project": projet, "sound": son["identifiant"], "current_revision": 2, "from_revision": 1})
    assert not restaure.is_error and restaure.structured_content["revision"] == 3
    assert client.get(base).json()["recette"]["debut"] == 0
    with pytest.raises(ToolError, match="autre fenêtre"):
        await serveur.call_tool("edit_sound", {"project": projet, "sound": son["identifiant"], "revision": 2, "recipe": {}})
    autre = await serveur.call_tool("import_sound", {"project": projet, "file_path": str(chemin), "key": "import-son"})
    assert autre.structured_content["identifiant"] == son["identifiant"] and autre.structured_content["revision"] == 3
    assert len(atelier.sons.lister(projet)) == 1
    assert not (await serveur.call_tool("list_sounds", {"project": projet})).is_error
    jeu = tmp_path / "godot-son-mcp"
    jeu.mkdir(); (jeu / "project.godot").write_text('config_version=5\n[application]\nconfig/name="Son MCP"\n', encoding="utf-8")
    atelier.livraison.associer(projet, str(jeu))
    livraison = await serveur.call_tool("preview_sound_delivery", {"project": projet, "sound": son["identifiant"], "revision": 3})
    assert not livraison.is_error and livraison.structured_content["jeton"]
    assert livraison.structured_content["personnage"] is None
    assert not list(jeu.rglob("son.wav"))  # Une prévision n'écrit rien dans Godot.
    chemin.write_bytes(b"pas le meme signal")
    with pytest.raises(ToolError, match="déjà acquis"):
        await serveur.call_tool("import_sound", {"project": projet, "file_path": str(chemin), "key": "import-son"})


@pytest.mark.parametrize("format,codec", [("ogg", "libvorbis"), ("mp3", "libmp3lame")])
def test_import_comprime_preserve_deux_canaux(audio, format, codec):
    atelier, projet = audio
    octets = _ffmpeg(["-f", "wav", "-i", "pipe:0", "-acodec", codec, "-f", format, "pipe:1"], signal())
    son = atelier.sons.importer_octets(projet, octets, nom="Source." + format)
    assert son["pret"] and son["mesures"]["canaux"] == 2
    assert atelier.sons.source(projet, son["identifiant"]).read_bytes() == octets


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_audio_stream_player_reel_sans_import_deforme(audio, tmp_path):
    atelier, projet = audio
    son = atelier.sons.importer_octets(projet, signal(), nom="Épée.wav")
    son = atelier.sons.regler(projet, son["identifiant"], 1, {"debut": .1, "fin": .8, "taux": 22050,
        "boucle": True, "boucle_debut": .05, "boucle_fin": .6, "gain_db": -3})
    jeu = tmp_path / "jeu-godot"
    jeu.mkdir()
    (jeu / "project.godot").write_text('config_version=5\n[application]\nconfig/name="AU14"\n', encoding="utf-8")
    atelier.livraison.associer(projet, str(jeu))
    preparation = atelier.sons.prevoir_livraison(projet, son["identifiant"], 2)
    assert preparation["personnage"] is None and preparation["nature"] == "son"
    livraison = atelier.livraison.livrer(projet, preparation["jeton"])
    script = '''extends SceneTree
func _initialize():
    var scene = load(%s).instantiate()
    root.add_child(scene)
    await process_frame
    var stream = scene.stream
    assert(scene is AudioStreamPlayer)
    assert(stream is AudioStreamWAV)
    assert(stream.stereo and stream.mix_rate == 22050)
    assert(stream.loop_mode == 1 and stream.loop_begin == 1102 and stream.loop_end == 13230)
    assert(abs(stream.get_length() - 0.7) < 0.001)
    scene.play()
    assert(scene.playing)
    print("AU14_AUDIO_OK")
    scene.queue_free()
    quit()
''' % json.dumps(livraison["scene"])
    (jeu / "preuve.gd").write_text(script, encoding="utf-8")
    execution = subprocess.run([GODOT, "--headless", "--path", str(jeu), "--script", "preuve.gd", "--quit-after", "5"], capture_output=True, text=True, timeout=30)
    assert execution.returncode == 0 and "AU14_AUDIO_OK" in execution.stdout, execution.stdout + execution.stderr
    assert "SCRIPT ERROR" not in execution.stderr and "Parse Error" not in execution.stderr
