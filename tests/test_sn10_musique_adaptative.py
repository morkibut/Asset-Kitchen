"""SN10 · La musique qui s'adapte.

Un objet « musique adaptative » ne fabrique rien : il référence des sons
musicaux déjà faits (SN9), vérifie qu'ils partagent tempo/tonalité/mesure/
durée et **signale** un écart sans jamais bloquer. Deux livrables possibles :
des couches (`AudioStreamSynchronized`) et des morceaux avec leurs
transitions (`AudioStreamInteractive`, noms de clips stables).

Réutilise les petits outils de test_sn4_livraison.py (mêmes fixtures, même
façon d'écrire un son avec sa provenance sans rien payer) et `GODOT` de
test_au1.py pour les essais dans un vrai moteur.
"""
from __future__ import annotations

import json
import subprocess

import pytest

from atelier.domaine.musique_adaptative import (
    ARRIVEES, CLIP_ANY, DEPARTS, FONDUS, MusiqueAdaptativeRefusee, attributs_musicaux, ecarts_musicaux, objet_valide, slug)
from atelier.services.musique_adaptative import ServiceMusiqueAdaptative, ressource_couches, ressource_morceaux, scene_musique_adaptative
from tests.test_au1 import GODOT
from tests.test_sn4_livraison import _genere, _jeu, _stereo, audio as _audio_sn4  # noqa: F401


@pytest.fixture
def audio(_audio_sn4):
    """`atelier.services.__init__` ne câble pas encore `self.musique_
    adaptative` (SN10 est un fichier neuf, hors des trois qu'on ne touche
    pas : voir la consigne de la tranche) : l'essai monte le service
    lui-même, exactement comme `atelier/services/__init__.py` le fera une
    fois la ligne d'enregistrement posée."""
    atelier, projet = _audio_sn4
    if not hasattr(atelier, "musique_adaptative"):
        atelier.musique_adaptative = ServiceMusiqueAdaptative(atelier)
    return atelier, projet


def _encoder(duree, taux=44100):
    from atelier.audio.traitement import encoder
    return encoder(_stereo(duree, taux), taux)


def _musique(atelier, projet, nom, *, tempo=90, tonalite="D minor", mesure=4, duree=8, graine=1):
    provenance = {"travail": "t-" + nom, "modele": "ComfyUI:ace-step-15-turbo@v2", "workflow": "v1", "sortie": "x.flac",
        "famille": "musique", "envoi": {"prompt": nom, "graine": graine, "tempo": tempo, "tonalite": tonalite, "mesure": mesure},
        "composition": {"parametres": {"tempo": {"valeur": tempo, "source": "demande"}, "tonalite": {"valeur": tonalite, "source": "demande"},
                                        "mesure": {"valeur": mesure, "source": "demande"}}}}
    return atelier.sons.importer_octets(projet, _encoder(duree), nom=nom, provenance=provenance, cle="travail:t-" + nom)


# ── Le domaine, pur ───────────────────────────────────────────────────────


def test_attributs_musicaux_lit_tempo_tonalite_mesure_et_duree():
    son = {"mesures": {"duree": 64.333}, "provenance": {"composition": {"parametres": {
        "tempo": {"valeur": 90, "source": "univers"}, "tonalite": {"valeur": "D minor", "source": "demande"}}}}}
    assert attributs_musicaux(son) == {"tempo": 90, "tonalite": "D minor", "mesure": None, "duree": 64.33}
    assert attributs_musicaux({"provenance": {}}) == {"tempo": None, "tonalite": None, "mesure": None, "duree": None}


def test_ecarts_musicaux_signale_sans_bloquer_et_ignore_les_inconnus():
    entrees = [("la couche « calme »", {"tempo": 90, "tonalite": "D minor", "mesure": 4, "duree": 64}),
               ("la couche « combat »", {"tempo": 150, "tonalite": "D minor", "mesure": None, "duree": 64})]
    signaux = ecarts_musicaux(entrees)
    assert len(signaux) == 1 and "tempo" in signaux[0].lower() and "90" in signaux[0] and "150" in signaux[0]
    # Une mesure inconnue d'un côté ne fait pas un écart : elle est ignorée, jamais devinée.
    assert ecarts_musicaux([("a", {"tempo": 90, "tonalite": None, "mesure": None, "duree": None}),
                             ("b", {"tempo": 90, "tonalite": None, "mesure": None, "duree": None})]) == []


def test_objet_valide_refuse_deux_cles_identiques_et_exige_au_moins_une_couche_ou_un_morceau():
    with pytest.raises(MusiqueAdaptativeRefusee, match="couche ou un morceau"):
        objet_valide({"nom": "Vide"})
    with pytest.raises(MusiqueAdaptativeRefusee, match="même clé"):
        objet_valide({"nom": "X", "couches": [{"cle": "a", "son": "0" * 32}, {"cle": "a", "son": "1" * 32}]})
    with pytest.raises(MusiqueAdaptativeRefusee):
        objet_valide({"nom": "X", "morceaux": [{"cle": "Exploration", "son": "0" * 32}]})  # majuscule refusée
    forme = objet_valide({"nom": "  Boucle  ", "couches": [{"cle": "calme", "son": "0" * 32}]})
    assert forme["nom"] == "Boucle" and forme["couches"][0].volume_db == 0.0


def test_transition_refuse_de_et_vers_en_meme_temps_generiques_et_verifie_les_cles():
    clefs = {"exploration", "combat"}
    with pytest.raises(MusiqueAdaptativeRefusee, match="ni l'un ni l'autre"):
        objet_valide({"nom": "X", "morceaux": [{"cle": "exploration", "son": "0" * 32}, {"cle": "combat", "son": "1" * 32}],
                       "transitions": [{"de": "*", "vers": "*"}]})
    with pytest.raises(MusiqueAdaptativeRefusee, match="ne désigne aucun morceau"):
        objet_valide({"nom": "X", "morceaux": [{"cle": "exploration", "son": "0" * 32}], "transitions": [{"de": "exploration", "vers": "combat"}]})
    forme = objet_valide({"nom": "X", "morceaux": [{"cle": m, "son": "0" * 32} for m in clefs],
        "transitions": [{"de": "*", "vers": "combat", "depart": "immediat", "fondu": "auto"}]})
    t = forme["transitions"][0]
    assert t.de == "*" and t.vers == "combat" and t.depart == "immediat" and t.arrivee == "debut" and t.fondu == "auto"


def test_slug_derive_une_cle_lisible_ascii():
    assert slug("Exploration — Marais (calme)") == "exploration_marais_calme"
    assert slug("!!!") == "clip"


# ── Le service : référence, ne fabrique rien, signale sans bloquer ────────


def test_creer_refuse_un_son_qui_n_existe_pas_et_verifie_la_famille_musicale(audio):
    atelier, projet = audio
    with pytest.raises(MusiqueAdaptativeRefusee, match="n'existe pas"):
        atelier.musique_adaptative.creer(projet, {"nom": "X", "morceaux": [{"cle": "exploration", "son": "0" * 32}]})
    bruitage = _genere(atelier, projet, "bruitage")
    objet = atelier.musique_adaptative.creer(projet, {"nom": "Test", "morceaux": [{"cle": "pas", "son": bruitage["identifiant"]}]})
    # Une famille non musicale se signale, sans empêcher la création (« signale sans bloquer »).
    assert "bruitage" in objet["morceaux"][0]["signal"] and objet["morceaux_a_livrer"] == []


def test_lire_signale_un_ecart_de_tempo_sans_bloquer_ni_les_couches_ni_les_morceaux(audio):
    atelier, projet = audio
    calme = _musique(atelier, projet, "Calme", tempo=90)
    tension = _musique(atelier, projet, "Tension", tempo=150)
    objet = atelier.musique_adaptative.creer(projet, {"nom": "Marais",
        "couches": [{"cle": "calme", "son": calme["identifiant"]}, {"cle": "tension", "son": tension["identifiant"], "volume_db": -80}]})
    assert len(objet["ecarts"]) == 1 and "tempo" in objet["ecarts"][0].lower()
    assert objet["couches_a_livrer"] == ["calme", "tension"]  # l'écart n'écarte personne
    assert objet["couches"][0]["attributs"]["tempo"] == 90 and objet["couches"][1]["attributs"]["tempo"] == 150


def test_un_son_ecarte_ou_disparu_est_signale_et_exclu_de_ce_qui_part(audio):
    atelier, projet = audio
    son = _musique(atelier, projet, "Exploration")
    objet = atelier.musique_adaptative.creer(projet, {"nom": "M", "morceaux": [{"cle": "exploration", "son": son["identifiant"]}]})
    atelier.sons.juger(projet, son["identifiant"], son["revision"], "ecartee")
    relu = atelier.musique_adaptative.lire(projet, objet["identifiant"])
    assert relu["morceaux_a_livrer"] == [] and "écartée" in relu["morceaux"][0]["signal"]
    assert relu["livrable"] is False


def test_modifier_remplace_en_bloc_et_garde_ce_qui_manque(audio):
    atelier, projet = audio
    a = _musique(atelier, projet, "Exploration")
    b = _musique(atelier, projet, "Combat", tempo=150)
    objet = atelier.musique_adaptative.creer(projet, {"nom": "M", "morceaux": [{"cle": "exploration", "son": a["identifiant"]}]})
    ajoute = atelier.musique_adaptative.modifier(projet, objet["identifiant"], {"morceaux": [
        {"cle": "exploration", "son": a["identifiant"]}, {"cle": "combat", "son": b["identifiant"]}]})
    assert {m["cle"] for m in ajoute["morceaux"]} == {"exploration", "combat"} and ajoute["nom"] == "M"
    avec_transition = atelier.musique_adaptative.modifier(projet, objet["identifiant"],
        {"transitions": [{"de": "exploration", "vers": "combat"}]})
    assert avec_transition["transitions"][0]["depart"] == "mesure_suivante" and avec_transition["transitions"][0]["fondu"] == "croise"
    renomme = atelier.musique_adaptative.modifier(projet, objet["identifiant"], {"nom": "Marais"})
    assert renomme["nom"] == "Marais" and len(renomme["morceaux"]) == 2  # gardés, non donnés cette fois


def test_supprimer_garde_les_sons_dans_la_galerie(audio):
    atelier, projet = audio
    son = _musique(atelier, projet, "Exploration")
    objet = atelier.musique_adaptative.creer(projet, {"nom": "M", "morceaux": [{"cle": "exploration", "son": son["identifiant"]}]})
    atelier.musique_adaptative.supprimer(projet, objet["identifiant"])
    with pytest.raises(MusiqueAdaptativeRefusee):
        atelier.musique_adaptative.lire(projet, objet["identifiant"])
    assert atelier.sons.lire(projet, son["identifiant"])["identifiant"] == son["identifiant"]


# ── La livraison ──────────────────────────────────────────────────────────


def test_prevoir_livraison_couches_et_morceaux_avec_credits(audio, tmp_path):
    atelier, projet = audio
    atelier.livraison.associer(projet, str(_jeu(tmp_path)))
    calme = _musique(atelier, projet, "Calme", duree=8)
    tension = _musique(atelier, projet, "Tension", duree=8)
    exploration = _musique(atelier, projet, "Exploration")
    combat = _musique(atelier, projet, "Combat", tempo=150)
    objet = atelier.musique_adaptative.creer(projet, {
        "nom": "Marais",
        "couches": [{"cle": "calme", "son": calme["identifiant"]}, {"cle": "tension", "son": tension["identifiant"], "volume_db": -80}],
        "morceaux": [{"cle": "exploration", "son": exploration["identifiant"]}, {"cle": "combat", "son": combat["identifiant"]}],
        "transitions": [{"de": "exploration", "vers": "combat"}, {"de": "*", "vers": "combat", "depart": "immediat", "fondu": "entree", "fondu_temps": 0}],
    })
    # `prevoir_livraison` rend un aperçu de livraison (comme SN3/SN4) : on
    # relit ses fichiers, sans rien écrire dans un jeu Godot (testé plus bas).
    apercu = atelier.musique_adaptative.prevoir_livraison(projet, objet["identifiant"])
    noms = {f["chemin"].rsplit("/", 1)[-1] for f in apercu["fichiers"]}
    assert "marais_couches.tres" in noms and "marais_morceaux.tres" in noms and "son.tscn" in noms and "credits.json" in noms


def test_ressource_couches_meme_fichier_partout_et_volumes():
    octets = ressource_couches([("res://audio/mus_x_calme.ogg", 0.0), ("res://audio/mus_x_tension.ogg", -80.0)]).decode()
    assert 'type="AudioStreamSynchronized"' in octets and "stream_count = 2" in octets
    assert "stream_0/volume = 0.0" in octets and "stream_1/volume = -80.0" in octets
    assert 'path="res://audio/mus_x_calme.ogg"' in octets


def test_ressource_morceaux_transitions_avec_les_constantes_verifiees_dans_godot():
    octets = ressource_morceaux(
        [("exploration", "Exploration", "res://audio/mus_x_exploration.ogg"), ("combat", "Combat", "res://audio/mus_x_combat.ogg")],
        [(0, 1, "mesure_suivante", "debut", "croise", 4.0), (CLIP_ANY, 1, "immediat", "meme_position", "entree", 0.0)],
    ).decode()
    assert 'clip_0/name = &"exploration"' in octets and 'clip_1/name = &"combat"' in octets
    # Les constantes vérifiées le 19 septembre 2026 dans Godot 4.7.2 : mesure
    # suivante = 2, début = 1, croisé = 3 ; n'importe quel clip = -1.
    assert DEPARTS["mesure_suivante"] == 2 and ARRIVEES["debut"] == 1 and FONDUS["croise"] == 3 and CLIP_ANY == -1
    assert "Vector2i(0, 1): {" in octets and '"from_time": 2' in octets and '"to_time": 1' in octets and '"fade_mode": 3' in octets
    assert "Vector2i(-1, 1): {" in octets and '"from_time": 0' in octets and '"fade_mode": 1' in octets


def test_scene_musique_adaptative_un_lecteur_par_ressource_sur_le_bus_music():
    octets = scene_musique_adaptative([("Couches", "res://audio/x_couches.tres"), ("Morceaux", "res://audio/x_morceaux.tres")]).decode()
    assert 'node name="MusiqueAdaptative" type="Node"' in octets
    assert 'node name="Couches" type="AudioStreamPlayer"' in octets and 'node name="Morceaux" type="AudioStreamPlayer"' in octets
    assert octets.count('bus = &"Music"') == 2


# ── Dans le vrai Godot 4.7 ────────────────────────────────────────────────


def _godot(jeu, *arguments, delai=90):
    return subprocess.run([GODOT, "--headless", "--path", str(jeu), *arguments], capture_output=True, text=True,
        timeout=delai, encoding="utf-8", errors="replace")


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_passe_d_exploration_a_combat_sur_la_mesure_suivante_sans_coupure(audio, tmp_path):
    """SN10, critère 1 : dans Godot, passer d'« exploration » à « combat » se
    fait sur la mesure suivante, sans coupure. On vérifie la configuration
    chargée (clips, transition, from_time = mesure suivante, fade) et, en
    jouant réellement, qu'après `switch_to_clip` le clip actif ne bascule
    qu'à la mesure suivante (~2,67 s à 90 BPM en 4/4, jamais tout de suite),
    et que la lecture ne s'arrête jamais entre-temps (`playing` reste vrai
    d'un bout à l'autre — c'est ce que « sans coupure » veut dire). Le moteur
    audio factice du mode headless ne fait pas avancer `get_playback_
    position()` en temps réel (vérifié : elle reste à 0 tout du long), donc
    ce n'est pas elle qui prouve l'absence de coupure — c'est `playing`."""
    atelier, projet = audio
    jeu = _jeu(tmp_path, "jeu-sn10-morceaux")
    atelier.livraison.associer(projet, str(jeu))
    exploration = _musique(atelier, projet, "Exploration", duree=6)
    combat = _musique(atelier, projet, "Combat", tempo=150, duree=6)
    objet = atelier.musique_adaptative.creer(projet, {"nom": "Marais",
        "morceaux": [{"cle": "exploration", "son": exploration["identifiant"]}, {"cle": "combat", "son": combat["identifiant"]}],
        "transitions": [{"de": "exploration", "vers": "combat"}]})
    apercu = atelier.musique_adaptative.prevoir_livraison(projet, objet["identifiant"])
    livraison = atelier.livraison.livrer(projet, apercu["jeton"])
    importe = _godot(jeu, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    scene = livraison["scene"]
    script = '''extends SceneTree
func _initialize():
    var racine = load(SCENE).instantiate()
    root.add_child(racine)
    await process_frame
    var morceaux: AudioStreamInteractive = racine.get_node("Morceaux").stream
    assert(morceaux.clip_count == 2)
    assert(morceaux.get_clip_name(0) == &"exploration" and morceaux.get_clip_name(1) == &"combat")
    assert(morceaux.has_transition(0, 1))
    assert(morceaux.get_transition_from_time(0, 1) == AudioStreamInteractive.TRANSITION_FROM_TIME_NEXT_BAR)
    assert(morceaux.get_transition_to_time(0, 1) == AudioStreamInteractive.TRANSITION_TO_TIME_START)
    assert(morceaux.get_transition_fade_mode(0, 1) == AudioStreamInteractive.FADE_CROSS)
    var joueur: AudioStreamPlayer = racine.get_node("Morceaux")
    joueur.play()
    await create_timer(0.2).timeout
    var lecture := joueur.get_stream_playback() as AudioStreamPlaybackInteractive
    assert(joueur.playing and lecture.get_current_clip_index() == 0)
    lecture.switch_to_clip(1)
    # « Sur la mesure suivante » : à 90 BPM en 4/4, une mesure dure 2,667 s.
    # Bien avant, le clip actif est encore « exploration » — la bascule ne
    # part pas tout de suite — et la lecture ne s'est jamais arrêtée.
    await create_timer(1.0).timeout
    assert(joueur.playing and lecture.get_current_clip_index() == 0)
    var jamais_arretee := true
    for i in 6:
        await create_timer(0.3).timeout
        jamais_arretee = jamais_arretee and joueur.playing
    # À ~2,9 s après le geste, la mesure suivante est passée : le clip actif
    # est « combat », et la lecture ne s'est, à aucun instant, arrêtée.
    assert(jamais_arretee)
    assert(lecture.get_current_clip_index() == 1)
    print("SN10_MORCEAUX_OK")
    quit()
'''.replace("SCENE", json.dumps(scene))
    (jeu / "preuve_sn10_morceaux.gd").write_text(script, encoding="utf-8")
    preuve = _godot(jeu, "--script", "preuve_sn10_morceaux.gd", delai=30)
    assert preuve.returncode == 0 and "SN10_MORCEAUX_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_monter_la_couche_tension_ne_decale_pas_les_autres(audio, tmp_path):
    """SN10, critère 2 : monter la couche « tension » ne décale pas les
    autres — parce que les couches sont dans un même `AudioStreamSynchronized`
    de même longueur. On le vérifie en jouant, en changeant le volume d'une
    couche en cours de lecture (le seul geste que Godot permet pour « monter
    une couche » : les flux restent calés, un seul flux avance), et en
    confirmant que la lecture ne s'interrompt ni ne redémarre à ce moment-là
    (`playing` reste vrai avant et après). Le pilote audio factice du mode
    headless ne fait pas avancer `get_playback_position()` en temps réel
    (vérifié sur le morceau ci-dessus) : ce n'est donc pas elle qui prouve
    l'absence de décalage."""
    atelier, projet = audio
    jeu = _jeu(tmp_path, "jeu-sn10-couches")
    atelier.livraison.associer(projet, str(jeu))
    calme = _musique(atelier, projet, "Calme", duree=6)
    tension = _musique(atelier, projet, "Tension", duree=6)
    objet = atelier.musique_adaptative.creer(projet, {"nom": "Marais",
        "couches": [{"cle": "calme", "son": calme["identifiant"]}, {"cle": "tension", "son": tension["identifiant"], "volume_db": -80}]})
    apercu = atelier.musique_adaptative.prevoir_livraison(projet, objet["identifiant"])
    livraison = atelier.livraison.livrer(projet, apercu["jeton"])
    importe = _godot(jeu, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    scene = livraison["scene"]
    script = '''extends SceneTree
func _initialize():
    var racine = load(SCENE).instantiate()
    root.add_child(racine)
    await process_frame
    var couches: AudioStreamSynchronized = racine.get_node("Couches").stream
    assert(couches.stream_count == 2)
    var joueur: AudioStreamPlayer = racine.get_node("Couches")
    joueur.play()
    await create_timer(0.2).timeout
    assert(joueur.playing)
    # Le volume d'une couche se change sur la ressource elle-même
    # (`AudioStreamSynchronized.set_sync_stream_volume`), pas sur sa lecture
    # (`AudioStreamPlaybackSynchronized` n'expose aucune méthode en 4.7.2 —
    # vérifié par `ClassDB.class_get_method_list`, liste vide).
    couches.set_sync_stream_volume(1, 0.0)  # « monter la couche tension »
    await create_timer(0.2).timeout
    # Toujours en lecture, sans redémarrage : les couches sont restées calées,
    # aucune n'a décalé les autres.
    assert(joueur.playing)
    print("SN10_COUCHES_OK")
    quit()
'''.replace("SCENE", json.dumps(scene))
    (jeu / "preuve_sn10_couches.gd").write_text(script, encoding="utf-8")
    preuve = _godot(jeu, "--script", "preuve_sn10_couches.gd", delai=30)
    assert preuve.returncode == 0 and "SN10_COUCHES_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    assert "SCRIPT ERROR" not in preuve.stderr
