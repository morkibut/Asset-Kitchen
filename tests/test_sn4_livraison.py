"""SN4 · Livrer des fichiers que Godot lit tels quels.

La famille d'un son décide du paquet : WAV 16 bits ou OGG Vorbis, un `.import`
à côté, une scène `son.tscn` sur le bus de sa famille, un nom stable et des
crédits. Un son sans famille garde le paquet d'AU14 (test_au14_sons.py le
tient, y compris dans le vrai Godot). Les réglages neufs (mono, niveau perçu,
hauteur) sont inertes par défaut.
"""
import hashlib
import io
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
import pytest

from atelier.audio.traitement import decoder, encoder, mesurer, traiter
from atelier.domaine.son import FAMILLES, RecetteSon, SonRefuse, recette_proposee
from atelier.services.sons import (fichier_import, nom_stable, params_ogg, params_wav, ressource_variantes,
    uid_godot)
from tests.test_au1 import GODOT


def _stereo(duree, taux, frequence=440, amplitude=.25):
    t = np.arange(round(duree * taux)) / taux
    gauche = amplitude * np.sin(2 * np.pi * frequence * t)
    return np.column_stack((gauche, .5 * gauche))


def _frequence(signal, taux):
    spectre = np.abs(np.fft.rfft(signal[:, 0]))
    return np.argmax(spectre) * taux / len(signal)


# ── Réglages neufs, inertes par défaut ───────────────────────────────────


def test_recette_ancienne_rend_les_memes_octets_avec_les_champs_sn4():
    taux = 16000
    signal = _stereo(3, taux)
    ancienne = {"debut": .2, "fin": 2.5, "normaliser": True, "cible_db": -3, "fondu_entree_ms": 10,
        "boucle": True, "boucle_debut": .3, "boucle_fin": 2.0, "boucle_zero": True, "boucle_fondu_ms": 20}
    recette = RecetteSon.depuis_json(ancienne)
    assert recette.mono is False and recette.cible_lufs is None and recette.hauteur_demi_tons == 0
    rendu, taux1, mesure = traiter(signal, taux, recette)
    explicite = RecetteSon.depuis_json({**ancienne, "mono": False, "cible_lufs": None,
        "hauteur_demi_tons": 0, "hauteur_garde_duree": True})
    rendu2, taux2, _ = traiter(signal, taux, explicite)
    assert encoder(rendu, taux1) == encoder(rendu2, taux2)
    assert rendu.shape[1] == 2 and "niveau" not in mesure


def test_mono_mele_les_deux_canaux():
    taux = 16000
    signal = _stereo(1, taux)
    rendu, _, mesure = traiter(signal, taux, RecetteSon(mono=True, fondu_entree_ms=0, fondu_sortie_ms=0))
    assert rendu.shape[1] == 1 and mesure["canaux"] == 1
    assert np.allclose(rendu[:, 0], signal.mean(axis=1))


def test_cible_lufs_est_un_gain_plafonne_a_moins_un_dbtp():
    taux = 44100
    rendu, _, mesure = traiter(_stereo(3, taux, 1000, .05), taux, RecetteSon(cible_lufs=-17))
    assert mesure["niveau"]["applique"] and not mesure["niveau"]["plafonne"]
    assert abs(mesure["lufs"] - (-17)) <= .3
    # Des claquements brefs : la crête vraie arrive à −1 dBTP bien avant
    # que le niveau perçu ne touche −6 LUFS ; le gain s'arrête là.
    clics = np.zeros((3 * taux, 2))
    clics[::taux // 4] = .2
    _, _, plafonne = traiter(clics, taux, RecetteSon(cible_lufs=-6, fondu_entree_ms=0, fondu_sortie_ms=0))
    assert plafonne["niveau"]["plafonne"] and plafonne["crete_vraie_db"] <= -.9
    assert plafonne["lufs"] < -6
    # Trop court pour un niveau perçu : rien n'est touché, et c'est dit.
    court, _, bref = traiter(_stereo(.2, taux), taux, RecetteSon(cible_lufs=-17))
    assert not bref["niveau"]["applique"] and bref["niveau"]["gain_db"] == 0 and not bref["silencieux"]


@pytest.mark.parametrize("garder", [False, True])
def test_hauteur_une_octave_plus_haut(garder):
    taux = 22050
    signal = _stereo(2, taux, 220)
    rendu, _, _ = traiter(signal, taux, RecetteSon(hauteur_demi_tons=12, hauteur_garde_duree=garder,
        fondu_entree_ms=0, fondu_sortie_ms=0))
    if garder:
        assert len(rendu) == len(signal)
    else:
        assert abs(len(rendu) - len(signal) / 2) <= 2
    assert abs(_frequence(rendu, taux) - 440) < 3


def test_recette_refuse_les_reglages_sn4_hors_bornes():
    for brut in ({"mono": 1}, {"cible_lufs": 0}, {"cible_lufs": -60}, {"hauteur_demi_tons": 30},
                 {"hauteur_garde_duree": "oui"}):
        with pytest.raises(SonRefuse):
            RecetteSon.depuis_json(brut)


def test_reglages_proposes_par_famille():
    assert recette_proposee({}, "bruitage")["mono"] is True
    assert recette_proposee({}, "bruitage")["cible_db"] == -3 and recette_proposee({}, "bruitage")["cible_lufs"] is None
    assert recette_proposee({"debut": .1}, "ambiance")["cible_lufs"] == -26
    assert recette_proposee({"debut": .1}, "ambiance")["debut"] == .1
    assert recette_proposee({}, "voix")["mono"] and recette_proposee({}, "musique")["cible_lufs"] == -17
    assert recette_proposee({"debut": .1}, None) == {"debut": .1}


# ── La famille d'un son ──────────────────────────────────────────────────


@pytest.fixture
def audio(atelier, client):
    return atelier, atelier.bibliotheque.courant


def _genere(atelier, projet, famille, *, duree=2.0, taux=44100, envoi=None, nom="Pas sur la pierre", modele="ComfyUI:sa3-small-sfx@v1"):
    provenance = {"travail": "t-" + nom, "modele": modele, "workflow": "v1", "sortie": "x.flac", "famille": famille,
        "envoi": {"prompt": "footstep on stone", "graine": 1234, **(envoi or {})}}
    return atelier.sons.importer_octets(projet, encoder(_stereo(duree, taux), taux), nom=nom,
        provenance=provenance, cle="travail:" + nom)


def test_famille_lue_a_l_import_posee_ensuite_et_gardee_par_version(audio, client):
    atelier, projet = audio
    genere = _genere(atelier, projet, "bruitage")
    assert genere["famille"] == "bruitage" and genere["recette_proposee"]["mono"] is True
    assert genere["recette"]["mono"] is False  # proposée, pas imposée
    inconnue = atelier.sons.importer_octets(projet, encoder(_stereo(1, 16000), 16000), nom="x.wav",
        provenance={"famille": "cornemuse"}, cle="inconnue")
    assert inconnue["famille"] is None
    importe = atelier.sons.importer_octets(projet, encoder(_stereo(1, 16000), 16000), nom="Porte.wav")
    assert importe["famille"] is None and importe["recette_proposee"] is None
    with pytest.raises(SonRefuse, match="famille"):
        atelier.sons.classer(projet, importe["identifiant"], 1, "cornemuse")
    with pytest.raises(SonRefuse, match="autre fenêtre"):
        atelier.sons.classer(projet, importe["identifiant"], 7, "bruitage")
    classe = atelier.sons.classer(projet, importe["identifiant"], 1, "ambiance")
    assert classe["revision"] == 2 and classe["famille"] == "ambiance" and classe["recette"]["cible_lufs"] is None
    regle = atelier.sons.classer(projet, importe["identifiant"], 2, "voix", appliquer_reglages=True)
    assert regle["recette"]["mono"] is True and regle["recette"]["cible_lufs"] == -17
    assert regle["mesures"]["canaux"] == 1
    # Une retouche garde la famille ; une ancienne version garde la sienne.
    retouche = atelier.sons.regler(projet, importe["identifiant"], 3, {"debut": .1})
    assert retouche["famille"] == "voix"
    assert atelier.sons.lire(projet, importe["identifiant"], 1)["famille"] is None
    assert [v["famille"] for v in retouche["versions"]] == ["voix", "voix", "ambiance", None]
    base = f"/api/projects/{projet}/sounds/{importe['identifiant']}"
    reponse = client.put(base + "/family", json={"revision": 4, "famille": "interface"})
    assert reponse.status_code == 200, reponse.text
    assert client.get(base).json()["famille"] == "interface"
    assert client.put(base + "/family", json={"revision": 5, "famille": "cornemuse"}).status_code >= 400


def test_un_son_sfxr_est_un_son_d_interface(audio):
    atelier, projet = audio
    son = atelier.sfxr.fabriquer(projet, depart="clic", graine=3)
    assert son["famille"] == "interface"


async def test_mcp_pose_la_famille(audio):
    from atelier.mcp.serveur import creer_serveur
    atelier, projet = audio
    son = atelier.sons.importer_octets(projet, encoder(_stereo(1, 16000), 16000), nom="Clic.wav")
    serveur = creer_serveur(atelier)
    resultat = await serveur.call_tool("set_sound_family", {"project": projet, "sound": son["identifiant"],
        "revision": 1, "family": "interface", "apply_defaults": True})
    assert not resultat.is_error, resultat
    assert resultat.structured_content["famille"] == "interface" and resultat.structured_content["recette"]["mono"]


# ── Le paquet v2 ─────────────────────────────────────────────────────────


def test_nom_stable_snake_case_ascii_et_prefixe():
    assert nom_stable("bruitage", "Épée qui frappe.wav") == "sfx_epee_qui_frappe"
    assert nom_stable("ambiance", "Pluie — forêt (nuit)") == "amb_pluie_foret_nuit"
    assert nom_stable("voix", "sfx_Cri") == "vo_cri"
    assert nom_stable("interface", "!!!") == "ui_son"
    assert nom_stable("chanson", "Taverne") == nom_stable("jingle", "Taverne") == "mus_taverne"
    assert all(nom_stable(f, "x").startswith(("sfx_", "ui_", "amb_", "mus_", "vo_")) for f in FAMILLES)


def _lire_import(octets):
    params = octets.decode().split("[params]\n\n", 1)[1]
    return dict(ligne.split("=", 1) for ligne in params.splitlines() if ligne)


def test_paquet_bruitage_wav_boucle_import_scene_et_credits(audio):
    atelier, projet = audio
    son = _genere(atelier, projet, "bruitage", taux=22050)
    son = atelier.sons.regler(projet, son["identifiant"], 1, {"boucle": True, "boucle_debut": .1, "boucle_fin": 1.5})
    manifeste, contenus = atelier.sons.paquet(projet, son["identifiant"])
    assert set(contenus) == {"sfx_pas_sur_la_pierre.wav", "sfx_pas_sur_la_pierre.wav.import", "son.tscn",
        "credits.json", "composition.json"}
    wav = contenus["sfx_pas_sur_la_pierre.wav"]
    with wave.open(io.BytesIO(wav)) as fichier:
        assert fichier.getsampwidth() == 2 and fichier.getframerate() == 22050
    params = _lire_import(contenus["sfx_pas_sur_la_pierre.wav.import"])
    assert params["edit/loop_mode"] == "2" and params["edit/loop_begin"] == "2205" and params["edit/loop_end"] == "33075"
    assert params["edit/normalize"] == "false" and params["compress/mode"] == "0"
    assert b'importer="wav"' in contenus["sfx_pas_sur_la_pierre.wav.import"]
    assert b'bus = &"SFX"' in contenus["son.tscn"] and b'path="sfx_pas_sur_la_pierre.wav"' in contenus["son.tscn"]
    credits = json.loads(contenus["credits.json"])["sons"][0]
    assert credits["moteur"] == "sa3-small-sfx" and credits["licence"]["nom"] == "Stability AI Community License"
    assert credits["graine"] == 1234 and credits["texte"] == "footstep on stone" and credits["date"][:2] == "20"
    assert manifeste["format_paquet"] == 2 and manifeste["provenance"]["famille"] == "bruitage"
    assert manifeste["recette"] == son["recette"] and manifeste["mesures"] == son["mesures"]


def test_paquet_musique_ogg_coupe_a_la_fin_de_boucle_avec_tempo(audio, tmp_path):
    atelier, projet = audio
    son = _genere(atelier, projet, "musique", duree=5, envoi={"prompt": "calm exploration", "tempo": 90, "mesure": "3"},
        nom="Exploration", modele="ComfyUI:ace-step-15-turbo@v2")
    son = atelier.sons.regler(projet, son["identifiant"], 1, {"boucle": True, "boucle_debut": .5, "boucle_fin": 4.5})
    manifeste, contenus = atelier.sons.paquet(projet, son["identifiant"])
    ogg = contenus["mus_exploration.ogg"]
    assert ogg[:4] == b"OggS"
    assert atelier.sons.paquet(projet, son["identifiant"])[1]["mus_exploration.ogg"] == ogg  # déterministe
    chemin = tmp_path / "x.ogg"
    chemin.write_bytes(ogg)
    signal, taux = decoder(chemin)
    assert taux == 44100 and signal.shape[1] == 2 and abs(len(signal) - 4.5 * 44100) <= 64
    params = _lire_import(contenus["mus_exploration.ogg.import"])
    # 4,5 s à 90 BPM = 6,75 temps : beat_count arrondi à 7.
    assert params == {"loop": "true", "loop_offset": "0.5", "bpm": "90.0", "beat_count": "7", "bar_beats": "3"}
    assert b'bus = &"Music"' in contenus["son.tscn"]
    credits = json.loads(contenus["credits.json"])["sons"][0]
    assert credits["licence"]["nom"] == "MIT" and credits["texte"] == "calm exploration"


def test_credits_des_licences_par_moteur(audio):
    atelier, projet = audio
    chanson = _genere(atelier, projet, "chanson", nom="Taverne", modele="ComfyUI:yue2-int8@v1",
        envoi={"paroles": "[verse] ho"})
    credits = json.loads(atelier.sons.paquet(projet, chanson["identifiant"])[1]["credits.json"])["sons"][0]
    assert "16 septembre 2026" in credits["licence"]["nom"] and credits["licence"]["date_du_texte"] == "2026-09-16"
    assert credits["paroles"] == "[verse] ho"
    clic = atelier.sfxr.fabriquer(projet, depart="clic", graine=5)
    credits = json.loads(atelier.sons.paquet(projet, clic["identifiant"])[1]["credits.json"])["sons"][0]
    assert credits["moteur"] == "sfxr" and credits["licence"]["nom"] == "Domaine public" and credits["graine"] == 5
    importe = atelier.sons.importer_octets(projet, encoder(_stereo(1, 16000), 16000), nom="Porte.wav")
    importe = atelier.sons.classer(projet, importe["identifiant"], 1, "bruitage")
    credits = json.loads(atelier.sons.paquet(projet, importe["identifiant"])[1]["credits.json"])["sons"][0]
    assert credits["moteur"] is None and credits["licence"]["nom"] == "inconnue"


def test_params_ogg_sans_tempo_et_forme_courte_du_import():
    boucle = {"active": False, "debut": 0, "fin": 100}
    assert dict(params_ogg(boucle, 44100, 3.0, {})) == {"loop": "false", "loop_offset": "0.0", "bpm": "0.0",
        "beat_count": "0", "bar_beats": "4"}
    court = fichier_import("a.wav", "wav", params_wav(boucle), None).decode()
    assert "uid=" not in court and 'importer="wav"' in court and "edit/loop_mode=1" in court
    complet = fichier_import("a.wav", "wav", params_wav(boucle), "res://audio").decode()
    assert f'uid="{uid_godot("res://audio/a.wav")}"' in complet
    assert hashlib.md5(b"res://audio/a.wav").hexdigest() in complet


def _jeu(tmp_path, nom="jeu-godot"):
    jeu = tmp_path / nom
    jeu.mkdir()
    (jeu / "project.godot").write_text('config_version=5\n[application]\nconfig/name="SN4"\n', encoding="utf-8")
    return jeu


def test_livraison_v2_scene_stable_son_tscn_et_plus_de_personnage_tscn(audio, tmp_path):
    atelier, projet = audio
    jeu = _jeu(tmp_path)
    atelier.livraison.associer(projet, str(jeu))
    son = _genere(atelier, projet, "bruitage")
    preparation = atelier.sons.prevoir_livraison(projet, son["identifiant"])
    assert preparation["scene"].endswith("/son.tscn") and "/revisions/" not in preparation["scene"]
    roles = {Path(f["chemin"]).name: f["role"] for f in preparation["fichiers"]}
    assert roles["sfx_pas_sur_la_pierre.wav"] == "son" and roles["sfx_pas_sur_la_pierre.wav.import"] == "import Godot"
    assert preparation["ressource"].endswith("/sfx_pas_sur_la_pierre.wav")
    livraison = atelier.livraison.livrer(projet, preparation["jeton"])
    assert not list(jeu.rglob("personnage.tscn"))
    ecrit = next(jeu.rglob("sfx_pas_sur_la_pierre.wav.import")).read_text(encoding="utf-8")
    dossier = livraison["ressource"].rsplit("/", 1)[0]
    assert f'source_file="{dossier}/sfx_pas_sur_la_pierre.wav"' in ecrit
    manifeste = json.loads(next(jeu.rglob("livraison.json")).read_text(encoding="utf-8"))
    assert manifeste["famille"] == "bruitage" and manifeste["format_audio"] == "wav" and manifeste["bus"] == "SFX" and manifeste["credits"][0]["graine"] == 1234
    # Préparer à nouveau la même version : rien ne change, rien n'est en conflit.
    encore = atelier.sons.prevoir_livraison(projet, son["identifiant"])
    assert encore["revision"] == livraison["revision"] and not encore["conflits"]
    assert all(f["etat"] == "inchange" for f in encore["fichiers"])


def test_un_paquet_deja_livre_en_pcm_reste_restaurable(audio, tmp_path):
    atelier, projet = audio
    jeu = _jeu(tmp_path)
    atelier.livraison.associer(projet, str(jeu))
    son = atelier.sons.importer_octets(projet, encoder(_stereo(1, 16000), 16000), nom="Porte.wav")
    ancien = atelier.livraison.livrer(projet, atelier.sons.prevoir_livraison(projet, son["identifiant"])["jeton"])
    assert ancien["ressource"].endswith("/son.tres") and ancien["scene"].endswith("/son.tscn")
    assert not list(jeu.rglob("personnage.tscn"))
    atelier.sons.classer(projet, son["identifiant"], 1, "bruitage")
    neuf = atelier.livraison.livrer(projet, atelier.sons.prevoir_livraison(projet, son["identifiant"])["jeton"])
    assert neuf["scene"] == ancien["scene"] and neuf["ressource"].endswith("/sfx_porte.wav")
    scene = jeu / ancien["scene"].removeprefix("res://")
    assert neuf["revision"] in scene.read_text(encoding="utf-8")
    reprise = atelier.livraison.reprendre(projet, ancien["jeton"])
    assert reprise["pret"], reprise["conflits"]
    atelier.livraison.livrer(projet, reprise["jeton"])
    assert ancien["revision"] in scene.read_text(encoding="utf-8")
    assert b"PackedByteArray" in (jeu / ancien["ressource"].removeprefix("res://")).read_bytes()


def test_ressource_variantes_sans_repetition():
    texte = ressource_variantes([f"res://audio/sfx_pas_{i:02d}.wav" for i in range(1, 9)]).decode()
    assert "playback_mode = 0" in texte and "streams_count = 8" in texte and "random_pitch = 1.03" in texte
    assert 'stream_7/stream = ExtResource("8")' in texte and "stream_7/weight = 1.0" in texte
    with pytest.raises(SonRefuse):
        ressource_variantes([])


# ── Dans le vrai Godot 4.7 ───────────────────────────────────────────────


def _godot(jeu, *arguments, delai=90):
    return subprocess.run([GODOT, "--headless", "--path", str(jeu), *arguments], capture_output=True, text=True,
        timeout=delai, encoding="utf-8", errors="replace")


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_importe_sans_reecrire_et_joue_boucle_et_tempo(audio, tmp_path):
    atelier, projet = audio
    jeu = _jeu(tmp_path)
    atelier.livraison.associer(projet, str(jeu))
    pas = _genere(atelier, projet, "bruitage", taux=22050)
    pas = atelier.sons.regler(projet, pas["identifiant"], 1, {"boucle": True, "boucle_debut": .1, "boucle_fin": 1.5})
    musique = _genere(atelier, projet, "musique", duree=5, envoi={"tempo": 90, "mesure": "3"}, nom="Exploration",
        modele="ComfyUI:ace-step-15-turbo@v2")
    musique = atelier.sons.regler(projet, musique["identifiant"], 1, {"boucle": True, "boucle_debut": .5, "boucle_fin": 4.5})
    livres = {}
    for son in (pas, musique):
        livres[son["identifiant"]] = atelier.livraison.livrer(projet, atelier.sons.prevoir_livraison(projet, son["identifiant"])["jeton"])
    importe = _godot(jeu, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    # Les `.import` écrits par l'atelier sont ceux que Godot garde, octet pour octet.
    for livraison in livres.values():
        for fichier in livraison["fichiers"]:
            if fichier["chemin"].endswith(".import"):
                disque = (jeu / fichier["chemin"]).read_bytes()
                assert hashlib.sha256(disque).hexdigest() == fichier["empreinte"], disque.decode()
    scene_pas, scene_musique = livres[pas["identifiant"]]["scene"], livres[musique["identifiant"]]["scene"]
    revision_pas = next(f["chemin"] for f in livres[pas["identifiant"]]["fichiers"] if f["chemin"].endswith("/revisions/" + livres[pas["identifiant"]]["revision"] + "/son.tscn"))
    script = '''extends SceneTree
func _bus(chemin):
    var etat = load(chemin).get_state()
    for i in etat.get_node_property_count(0):
        if etat.get_node_property_name(0, i) == "bus":
            return etat.get_node_property_value(0, i)
    return null
func _initialize():
    var pas = load(PAS).instantiate()
    var musique = load(MUSIQUE).instantiate()
    root.add_child(pas)
    root.add_child(musique)
    await process_frame
    assert(pas is AudioStreamPlayer and pas.stream is AudioStreamWAV)
    assert(pas.stream.loop_mode == AudioStreamWAV.LOOP_FORWARD)
    assert(pas.stream.loop_begin == 2205 and pas.stream.loop_end == 33075)
    assert(pas.stream.mix_rate == 22050 and pas.stream.stereo and pas.stream.format == AudioStreamWAV.FORMAT_16_BITS)
    assert(_bus(REV_PAS) == &"SFX")
    var m = musique.stream
    assert(m is AudioStreamOggVorbis)
    assert(m.loop and abs(m.loop_offset - 0.5) < 0.000001)
    assert(m.bpm == 90.0 and m.beat_count == 7 and m.bar_beats == 3)
    assert(abs(m.get_length() - 4.5) < 0.01)
    pas.play()
    musique.play()
    await create_timer(0.2).timeout
    assert(pas.playing and musique.playing)
    print("SN4_GODOT_OK")
    quit()
'''.replace("REV_PAS", json.dumps("res://" + revision_pas)).replace("PAS", json.dumps(scene_pas)).replace("MUSIQUE", json.dumps(scene_musique))
    (jeu / "preuve.gd").write_text(script, encoding="utf-8")
    preuve = _godot(jeu, "--script", "preuve.gd", delai=30)
    assert preuve.returncode == 0 and "SN4_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr
    # Après l'import de Godot, préparer à nouveau n'ouvre aucun conflit.
    encore = atelier.sons.prevoir_livraison(projet, pas["identifiant"])
    assert not encore["conflits"] and encore["pret"]


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_charge_un_jeu_de_huit_variantes(tmp_path):
    jeu = _jeu(tmp_path, "jeu-variantes")
    dossier = jeu / "audio"
    dossier.mkdir()
    chemins = []
    for i in range(1, 9):
        nom = f"sfx_pas_{i:02d}.wav"
        (dossier / nom).write_bytes(encoder(_stereo(.3, 22050, 200 + 40 * i), 22050))
        boucle = {"active": False, "debut": 0, "fin": 0}
        (dossier / (nom + ".import")).write_bytes(fichier_import(nom, "wav", params_wav(boucle), "res://audio"))
        chemins.append("res://audio/" + nom)
    (dossier / "sfx_pas.tres").write_bytes(ressource_variantes(chemins))
    ecrits = {p.name: p.read_bytes() for p in dossier.glob("*.import")}
    importe = _godot(jeu, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    assert {p.name: p.read_bytes() for p in dossier.glob("*.import")} == ecrits  # huit uid gardés tels quels
    script = '''extends SceneTree
func _initialize():
    var r = load("res://audio/sfx_pas.tres")
    assert(r is AudioStreamRandomizer)
    assert(r.playback_mode == AudioStreamRandomizer.PLAYBACK_RANDOM_NO_REPEATS)
    assert(r.streams_count == 8 and abs(r.random_pitch - 1.03) < 0.0001)
    for i in 8:
        assert(r.get_stream(i) is AudioStreamWAV and r.get_stream_probability_weight(i) == 1.0)
    var joueur = AudioStreamPlayer.new()
    joueur.stream = r
    root.add_child(joueur)
    await process_frame
    joueur.play()
    await process_frame
    assert(joueur.playing)
    for u in UIDS:
        assert(ResourceUID.id_to_text(ResourceUID.text_to_id(u)) == u)
    print("SN4_VARIANTES_OK")
    quit()
'''.replace("UIDS", json.dumps([uid_godot(f"res://audio/{i}.wav") for i in range(300)]))
    (jeu / "preuve.gd").write_text(script, encoding="utf-8")
    preuve = _godot(jeu, "--script", "preuve.gd", delai=30)
    assert preuve.returncode == 0 and "SN4_VARIANTES_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr
