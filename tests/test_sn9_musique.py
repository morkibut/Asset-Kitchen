"""SN9 · La musique : ACE-Step (tempo, tonalité, mesure, nombre de mesures),
la boucle coupée sur une frontière de mesure, le jingle calé sur l'univers, et
YuE2 avec le texte daté de sa licence dans `credits.json`.

Réutilise les fixtures et les petits outils de test_sn4_livraison.py (mêmes
`atelier`/`client`, même double ComfyUI implicite — ici on écrit directement
un son avec sa provenance, comme `_genere` et `test_beat_count_utilise_les_
mesures_demandees_sans_la_marge` le font déjà pour SN4) : aucun calcul réel,
rien de payé.
"""
from __future__ import annotations

import hashlib
import json
import subprocess

import pytest

from atelier.audio.texte import duree_en_mesures
from atelier.services.sons import limite_mesure, recette_proposee_son
from tests.test_au1 import GODOT
from tests.test_sn4_livraison import _genere, _jeu, _stereo, audio  # noqa: F401


def _stereo_enc(duree, taux=44100):
    from atelier.audio.traitement import encoder
    return encoder(_stereo(duree, taux), taux)


# ── La boucle se coupe sur une frontière de mesure ───────────────────────


def test_limite_mesure_24_mesures_90_bpm():
    # 24 mesures à 90 BPM en 4/4 : 24 × 4 × 60 / 90 = 64 s pile.
    son = {"famille": "musique", "mesures": {"duree": 70},
           "provenance": {"envoi": {"tempo": 90, "mesure": 4},
                           "composition": {"mesures": {"demandees": 24, "marge": 1, "total": 25}}}}
    assert limite_mesure(son) == pytest.approx(64.0)
    assert limite_mesure(son) == duree_en_mesures(24, 90, 4, marge=0)


def test_limite_mesure_absente_sans_tempo_ou_sans_mesures_demandees():
    assert limite_mesure({"famille": "musique", "provenance": {}}) is None
    assert limite_mesure({"famille": "ambiance", "provenance": {
        "envoi": {"tempo": 90}, "composition": {"mesures": {"demandees": 24}}}}) is None  # pas une famille musicale
    son_sans_mesures = {"famille": "jingle", "provenance": {"envoi": {"tempo": 90}, "composition": {}}}
    assert limite_mesure(son_sans_mesures) is None


def test_recette_proposee_propose_la_boucle_a_la_frontiere_de_mesure(audio):
    atelier, projet = audio
    provenance = {"travail": "t-boucle", "modele": "ComfyUI:ace-step-15-turbo@v2", "workflow": "v1", "sortie": "x.flac",
        "famille": "musique", "envoi": {"prompt": "ambient exploration", "graine": 1, "tempo": 90, "mesure": 4},
        "composition": {"mesures": {"demandees": 24, "marge": 1, "total": 25, "source": "gabarit"},
                        "parametres": {"tempo": {"valeur": 90, "source": "univers"}}}}
    # 25 mesures à 90 BPM (24 demandées + 1 de marge) : 66,67 s — le tirage réel.
    son = atelier.sons.importer_octets(projet, _stereo_enc(duree_en_mesures(24, 90, 4, marge=1)), nom="Exploration",
        provenance=provenance, cle="travail:t-boucle")
    assert son["recette_proposee"]["boucle"] is True
    assert son["recette_proposee"]["boucle_debut"] == 0
    assert son["recette_proposee"]["boucle_fin"] == pytest.approx(64.0, abs=0.02)
    # Un bruitage ou une ambiance ne propose jamais cette boucle : SN9 ne
    # touche que la musique et le jingle.
    assert recette_proposee_son({**son, "famille": "ambiance"}, "ambiance")["boucle"] is False


def test_classer_musique_avec_appliquer_reglages_pose_la_boucle(audio):
    atelier, projet = audio
    provenance = {"travail": "t-2", "modele": "ComfyUI:ace-step-15-turbo@v2", "workflow": "v1", "sortie": "x.flac",
        "famille": None, "envoi": {"prompt": "battle theme", "graine": 2, "tempo": 150, "mesure": 4},
        "composition": {"mesures": {"demandees": 24, "marge": 1, "total": 25, "source": "demande"}}}
    # 25 mesures à 150 BPM : 40 s.
    importe = atelier.sons.importer_octets(projet, _stereo_enc(duree_en_mesures(24, 150, 4, marge=1)), nom="Combat",
        provenance={**provenance, "famille": None}, cle="travail:t-2")
    assert importe["famille"] is None  # la provenance ne suffit pas : il faut le geste de classement
    classe = atelier.sons.classer(projet, importe["identifiant"], importe["revision"], "musique", appliquer_reglages=True)
    assert classe["famille"] == "musique" and classe["recette"]["boucle"] is True
    # 24 mesures × 4 temps à 150 BPM : 24 × 4 × 60 / 150 = 38,4 s.
    assert classe["recette"]["boucle_fin"] == pytest.approx(38.4, abs=0.02) and classe["recette"]["boucle_debut"] == 0


# ── Le jingle se cale sur la tonalité et le tempo de l'univers, et le montre ──


def test_jingle_tonalite_et_tempo_de_univers_dans_credits(audio):
    atelier, projet = audio
    atelier.univers.regler_univers(projet, son={"tonalite": "C major", "tempo": 120})
    compo = atelier.travaux_audio.ce_qui_partira(projet, {"famille": "jingle", "prompt": "victory fanfare, brass"})
    # Le calage vient de l'univers, pas de la demande : la relecture le dit déjà (SN2).
    assert compo["parametres"]["tempo"] == {"valeur": 120, "source": "univers"}
    assert compo["parametres"]["tonalite"] == {"valeur": "C major", "source": "univers"}
    # Une fois le son fabriqué, sa provenance porte les mêmes sources — c'est
    # ce que credits.json montre à l'auteur (SN9 : « la provenance le montre »).
    provenance = {"travail": "t-jingle", "modele": "ComfyUI:ace-step-15-turbo@v2", "workflow": "v1", "sortie": "x.flac",
        "famille": "jingle", "envoi": {"prompt": compo["texte"], "graine": 7, "tempo": 120, "tonalite": "C major", "mesure": 4},
        "composition": {k: compo.get(k) for k in ("gabarit", "moteur", "texte", "mesures", "parametres")}}
    son = atelier.sons.importer_octets(projet, _stereo_enc(2), nom="Victoire", provenance=provenance, cle="travail:t-jingle")
    assert son["famille"] == "jingle"  # lue directement dans la provenance (AU14/SN2)
    _, contenus = atelier.sons.paquet(projet, son["identifiant"])
    credits = json.loads(contenus["credits.json"])["sons"][0]
    assert credits["tempo"] == {"valeur": 120, "source": "univers"}
    assert credits["tonalite"] == {"valeur": "C major", "source": "univers"}


# ── YuE2 : le texte daté de sa licence dans credits.json ─────────────────


def test_chanson_yue2_sort_avec_le_texte_date_de_sa_licence(audio):
    atelier, projet = audio
    chanson = _genere(atelier, projet, "chanson", nom="Chanson de taverne", modele="ComfyUI:yue2-int8@v1",
        envoi={"paroles": "[Verse]\nHo, ho, le tavernier"})
    _, contenus = atelier.sons.paquet(projet, chanson["identifiant"])
    credits = json.loads(contenus["credits.json"])["sons"][0]
    assert credits["moteur"] == "yue2-int8"
    assert credits["licence"]["date_du_texte"] == "2026-09-16"
    assert "non commercial" in credits["licence"]["resume"].lower() and "en son nom propre" in credits["licence"]["resume"]
    assert credits["paroles"] == "[Verse]\nHo, ho, le tavernier"


def test_chanson_jouee_depuis_sa_partition_porte_la_meme_licence_yue2(audio):
    """Défaut confirmé le 19 septembre 2026 : `yue2-partition-jouee` (le
    second étage de YuE2, qui joue depuis la partition écrite) manquait dans
    `_LICENCE_DU_MOTEUR` : une chanson ainsi jouée sortait avec une licence
    « à préciser » alors que c'est le même moteur, la même licence."""
    atelier, projet = audio
    chanson = _genere(atelier, projet, "chanson", nom="Chanson jouée", modele="ComfyUI:yue2-partition-jouee@v1",
        envoi={"paroles": "[Verse]\nHo, ho, le tavernier"})
    _, contenus = atelier.sons.paquet(projet, chanson["identifiant"])
    credits = json.loads(contenus["credits.json"])["sons"][0]
    assert credits["moteur"] == "yue2-partition-jouee"
    assert credits["licence"]["nom"] != "à préciser" and credits["licence"]["date_du_texte"] == "2026-09-16"


# ── Dans le vrai Godot 4.7 ────────────────────────────────────────────────


def _godot_run(jeu, *arguments, delai=90):
    return subprocess.run([GODOT, "--headless", "--path", str(jeu), *arguments], capture_output=True, text=True,
        timeout=delai, encoding="utf-8", errors="replace")


@pytest.mark.lent  # lance le moteur Godot — voir tests/test_au1.py, GODOT
@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_boucle_exploration_24_mesures_90_bpm_sans_saut_de_temps(audio, tmp_path):
    """Le critère d'acceptation de SN9 : une boucle d'exploration de 24
    mesures à 90 BPM tourne sans saut de temps dans Godot. La boucle est
    posée par le geste du produit (« classer, appliquer les réglages »,
    donc `recette_proposee_son`), pas choisie à la main comme dans le test
    générique de SN4."""
    atelier, projet = audio
    jeu = _jeu(tmp_path, "jeu-sn9")
    atelier.livraison.associer(projet, str(jeu))
    total = duree_en_mesures(24, 90, 4, marge=1)  # 25 mesures : 66,67 s, la durée réelle du tirage
    provenance = {"travail": "t-exploration", "modele": "ComfyUI:ace-step-15-turbo@v2", "workflow": "v1", "sortie": "x.flac",
        "famille": None, "envoi": {"prompt": "ambient exploration, soft pads, loopable", "graine": 9, "tempo": 90, "mesure": 4},
        "composition": {"mesures": {"demandees": 24, "marge": 1, "total": 25, "source": "demande"}}}
    importe = atelier.sons.importer_octets(projet, _stereo_enc(total), nom="Exploration",
        provenance=provenance, cle="travail:t-exploration")
    musique = atelier.sons.classer(projet, importe["identifiant"], importe["revision"], "musique", appliquer_reglages=True)
    # Posée par le produit, pas choisie à la main : 24 mesures × 4 temps ÷ 90 BPM × 60 = 64 s pile.
    assert musique["recette"]["boucle"] and musique["recette"]["boucle_fin"] == pytest.approx(64.0, abs=0.02)
    livraison = atelier.livraison.livrer(projet, atelier.sons.prevoir_livraison(projet, musique["identifiant"])["jeton"])
    importe_godot = _godot_run(jeu, "--editor", "--import")
    assert importe_godot.returncode == 0, importe_godot.stdout + importe_godot.stderr
    for fichier in livraison["fichiers"]:
        if fichier["chemin"].endswith(".import"):
            disque = (jeu / fichier["chemin"]).read_bytes()
            assert hashlib.sha256(disque).hexdigest() == fichier["empreinte"], disque.decode()
    scene = livraison["scene"]
    script = '''extends SceneTree
func _initialize():
    var musique = load(MUSIQUE).instantiate()
    root.add_child(musique)
    await process_frame
    var m = musique.stream
    assert(m is AudioStreamOggVorbis)
    assert(m.loop)
    assert(m.bpm == 90.0)
    assert(m.beat_count == 96)  # 24 mesures x 4 temps
    assert(m.bar_beats == 4)
    assert(abs(m.get_length() - 64.0) < 0.05)
    musique.play()
    # On se cale juste avant la fin de la boucle (64 s) puis on franchit le
    # point de boucle : Godot doit rejouer depuis loop_offset (0 ici) sans
    # lever et sans que la lecture s'arrête — pas de saut de temps. Attendre
    # les 64 s en temps réel serait trop lent pour un essai : on y saute.
    musique.seek(63.7)
    await process_frame
    assert(musique.playing)
    var position_avant = musique.get_playback_position()
    await create_timer(0.6).timeout
    assert(musique.playing)
    var position_apres = musique.get_playback_position()
    # Franchi la frontière de boucle : la position est repartie de
    # loop_offset (0), donc elle a diminué malgré le temps qui avance — sans
    # ça, `position_avant` ne servirait à rien (défaut confirmé : l'essai
    # d'origine ne franchissait jamais la boucle et ne s'en servait pas).
    assert(position_apres < position_avant)
    print("SN9_GODOT_OK position_avant=", position_avant, "position_apres=", position_apres)
    quit()
'''.replace("MUSIQUE", json.dumps(scene))
    (jeu / "preuve_sn9.gd").write_text(script, encoding="utf-8")
    preuve = _godot_run(jeu, "--script", "preuve_sn9.gd", delai=30)
    assert preuve.returncode == 0 and "SN9_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr
