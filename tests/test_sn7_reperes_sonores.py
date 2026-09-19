"""SN7 : le son calé sur l'animation — un repère sonore sur une image d'une
bande désigne un emplacement du sujet ; la livraison en fait une piste audio
dans l'`AnimationPlayer` de la scène du personnage.

Les sons sont importés (aucun moteur, rien de payé) ; les bandes, les sons du
sujet et la livraison Godot sont réels, et le dernier essai charge la scène
livrée dans un vrai Godot 4.7 quand il est installé."""
import json
import re
import subprocess

import numpy as np
import pytest

from atelier.audio.traitement import encoder
from atelier.domaine.reperes_sonores import RepereRefuse, repere_valide, temps_de_l_image
from atelier.services.livraison import ServiceLivraison
from tests.test_au1 import GODOT, _bande

DESCRIPTION = "small hooded traveller, soft leather boots"


def _stereo(duree=.3, taux=22050, frequence=440):
    t = np.arange(round(duree * taux)) / taux
    g = .25 * np.sin(2 * np.pi * frequence * t)
    return np.column_stack((g, .5 * g))


def _projet(atelier):
    return atelier.bibliotheque.courant or atelier.bibliotheque.creer_projet("SN7").identifiant


def _godot(tmp_path, nom="jeu-godot"):
    jeu = tmp_path / nom
    jeu.mkdir()
    (jeu / "project.godot").write_text('config_version=5\n[application]\nconfig/name="SN7"\n'
                                       'config/features=PackedStringArray("4.7", "GL Compatibility")\n'
                                       '[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    return jeu


def _pas_en_jeu(atelier, projet, heros, n=3):
    """Un jeu de `n` variantes de pas, posé sur l'emplacement « pas » du héros."""
    sons = []
    for i in range(n):
        s = atelier.sons.importer_octets(projet, encoder(_stereo(frequence=300 + 60 * i), 22050), nom=f"Pas {i + 1}.wav")
        atelier.sons.classer(projet, s["identifiant"], s["revision"], "bruitage")
        sons.append(s["identifiant"])
    jeu = atelier.variantes_son.creer(projet, {"nom": "sfx_heros_pas", "sons": sons, "famille": "bruitage"})
    atelier.sons_du_sujet.poser(projet, heros, "pas", {"jeu": jeu["identifiant"]})
    return jeu


def _mort_en_son(atelier, projet, heros):
    """L'emplacement « mort » : un son seul en WAV, pas un jeu — ce que le
    défaut 13 demande de vérifier aussi dans un vrai Godot."""
    s = atelier.sons.importer_octets(projet, encoder(_stereo(duree=.2, frequence=180), 22050), nom="Chute.wav")
    atelier.sons.classer(projet, s["identifiant"], s["revision"], "bruitage")
    atelier.sons_du_sujet.poser(projet, heros, "mort", {"son": s["identifiant"]})
    return s["identifiant"]


def _changer_la_cadence(atelier, bande, cadence):
    """Ce que fait `PUT /strips/{id}` avec `{cadence}` (`montage.corriger`) :
    la même bande, le même identifiant, une autre cadence. Sans rebâtir la
    planche, que la bande d'essai n'a pas de clip pour refaire."""
    lue = atelier.base.lire_bande(bande.identifiant)
    lue.cadence = cadence
    atelier.montage._sauver(lue)


@pytest.fixture
def heros(atelier):
    projet = _projet(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    # La marche vers le sud : quatre images en aller-retour (0 1 2 3 2 1), huit par seconde.
    marche = _bande(atelier, projet, heros, identifiant="marche-sud", pose="marche", direction="sud", cadence=8)
    return projet, heros, marche


# ── Les règles pures ─────────────────────────────────────────────────────


def test_un_repere_se_compte_en_images_et_son_temps_se_calcule_a_la_livraison():
    assert repere_valide({"bande": "b", "image": 3, "cle": "pas"}) == ("b", 3, "pas")
    for brut, raison in (({"bande": "b", "image": 0, "cle": "pas"}, "commence à 1"),
                         ({"bande": "b", "image": True, "cle": "pas"}, "commence à 1"),
                         ({"bande": "", "image": 1, "cle": "pas"}, "animation"),
                         ({"bande": "b", "image": 1, "cle": "Pas !"}, "n'existe pas"),
                         ({"bande": "b", "image": 1, "cle": "pas", "temps": .2}, "rien d'autre")):
        with pytest.raises(RepereRefuse, match=raison):
            repere_valide(brut)
    # En boucle, l'image 3 passe une fois par tour ; en aller-retour, deux fois.
    assert temps_de_l_image(3, [0, 1, 2, 3], 125) == [.25]
    assert temps_de_l_image(3, [0, 1, 2, 3, 2, 1], 125) == [.25, .5]
    assert temps_de_l_image(4, [0, 1, 2, 3, 2, 1], 125) == [.375]  # un bout ne se rejoue pas
    assert temps_de_l_image(5, [0, 1, 2, 3], 125) == []


# ── Poser, retirer, relire ───────────────────────────────────────────────


def test_poser_et_retirer_un_repere_sur_une_image(atelier, heros):
    projet, sujet, marche = heros
    jeu = _pas_en_jeu(atelier, projet, sujet)
    vue = atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "pas"})
    [r] = vue["reperes"]
    assert (r["bande"], r["image"], r["cle"], r["nom"], r["compte"], r["signal"]) == (marche.identifiant, 3, "pas", "Pas", 4, None)
    assert (r["pose"], r["direction"]) == ("marche", "sud")
    # La salle d'essai reçoit les sons qu'elle joue : ceux du jeu de l'emplacement.
    assert vue["sons"] == {"pas": jeu["a_livrer"]}
    # Poser deux fois ne double rien ; une autre image, un autre emplacement s'ajoutent.
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "pas"})
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 1, "cle": "pas"})
    vue = atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "attaque"})
    assert [(r["image"], r["cle"]) for r in vue["reperes"]] == [(1, "pas"), (3, "attaque"), (3, "pas")]
    assert next(r for r in vue["reperes"] if r["cle"] == "attaque")["signal"] == "Cet emplacement est vide."
    vue = atelier.reperes_sonores.retirer(projet, sujet, {"bande": marche.identifiant, "image": 1, "cle": "pas"})
    assert [(r["image"], r["cle"]) for r in vue["reperes"]] == [(3, "attaque"), (3, "pas")]
    # Retirer ce qui n'est pas posé ne refuse rien et ne change rien.
    revision = vue["revision"]
    assert atelier.reperes_sonores.retirer(projet, sujet, {"bande": marche.identifiant, "image": 2, "cle": "pas"})["revision"] == revision
    # Les sons du sujet (SN6) sont lus comme avant : le repère ne s'y ajoute pas.
    assert "reperes" not in atelier.sons_du_sujet.lire(projet, sujet)["emplacements"][0]


def test_les_refus_d_un_repere(atelier, heros):
    projet, sujet, marche = heros
    autre = atelier.production.creer_personnage(projet, "Le marchand").identifiant
    course = _bande(atelier, projet, autre, identifiant="course-marchand", pose="course", direction="sud")
    with pytest.raises(RepereRefuse, match="4 images"):
        atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 5, "cle": "pas"})
    with pytest.raises(RepereRefuse, match="pas une animation de ce sujet"):
        atelier.reperes_sonores.poser(projet, sujet, {"bande": course.identifiant, "image": 1, "cle": "pas"})
    with pytest.raises(RepereRefuse, match="n'existe pas"):
        atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 1, "cle": "vol"})
    # Un emplacement nommé à la main qu'on retire emporte ses repères.
    atelier.sons_du_sujet.ajouter(projet, sujet, {"nom": "Cliquetis", "famille": "bruitage"})
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 2, "cle": "cliquetis"})
    atelier.sons_du_sujet.retirer_emplacement(projet, sujet, "cliquetis")
    assert atelier.reperes_sonores.lire(projet, sujet)["reperes"] == []


def test_changer_la_cadence_garde_le_repere_sur_la_meme_image(atelier, heros):
    projet, sujet, marche = heros
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "pas"})
    _changer_la_cadence(atelier, marche, 12)
    [r] = atelier.reperes_sonores.lire(projet, sujet, marche.identifiant)["reperes"]
    assert (r["image"], r["cadence"]) == (3, 12)


def test_routes_et_outils_de_l_agent(atelier, client, heros):
    projet, sujet, marche = heros
    base = f"/api/projects/{projet}/subjects/{sujet}/sound-cues"
    pose = client.put(f"{base}/{marche.identifiant}/3/pas")
    assert pose.status_code == 200 and pose.json()["reperes"][0]["image"] == 3
    assert client.get(base, params={"strip": marche.identifiant}).json()["reperes"][0]["cle"] == "pas"
    refus = client.put(f"{base}/{marche.identifiant}/9/pas")
    assert refus.status_code == 409 and refus.json()["code"] == "repere_sonore_refuse"
    assert client.delete(f"{base}/{marche.identifiant}/3/pas").json()["reperes"] == []


async def test_les_outils_de_l_agent(atelier, heros):
    from atelier.mcp.serveur import creer_serveur
    projet, sujet, marche = heros
    serveur = creer_serveur(atelier)
    assert {"list_sound_cues", "set_sound_cue", "remove_sound_cue"} <= {t.name for t in await serveur.list_tools()}
    r = await serveur.call_tool("set_sound_cue", {"project": projet, "subject": sujet, "strip": marche.identifiant,
                                                  "image": 3, "slot": "pas"})
    assert not r.is_error and r.structured_content["reperes"][0]["image"] == 3
    r = await serveur.call_tool("list_sound_cues", {"project": projet, "subject": sujet})
    assert not r.is_error and len(r.structured_content["reperes"]) == 1
    with pytest.raises(Exception, match="commence à 1"):
        await serveur.call_tool("set_sound_cue", {"project": projet, "subject": sujet, "strip": marche.identifiant,
                                                  "image": 0, "slot": "pas"})
    r = await serveur.call_tool("remove_sound_cue", {"project": projet, "subject": sujet, "strip": marche.identifiant,
                                                     "image": 3, "slot": "pas"})
    assert not r.is_error and r.structured_content["reperes"] == []


# ── La livraison : une piste audio par animation qui a des repères ────────


def _scene_de_revision(apercu, godot=None):
    fichier = next(f for f in apercu["fichiers"] if f["chemin"].endswith("/personnage.tscn") and "/revisions/" in f["chemin"])
    return fichier["chemin"], (godot / fichier["chemin"]).read_text(encoding="utf-8") if godot else None


def test_sans_repere_le_paquet_est_celui_d_avant(atelier, heros, tmp_path):
    projet, sujet, marche = heros
    atelier.livraison.associer(projet, str(_godot(tmp_path)))
    _pas_en_jeu(atelier, projet, sujet)
    sans_hook = ServiceLivraison(atelier.base, atelier.fichiers, atelier.export, atelier.production, atelier.diffusion)
    sans_hook.sons_du_sujet = atelier.sons_du_sujet.paquet_pour_livraison
    temoin = sans_hook.prevoir(projet, sujet, [marche.identifiant])
    avant = atelier.livraison.prevoir(projet, sujet, [marche.identifiant])
    assert avant["revision"] == temoin["revision"] and "reperes_sonores" not in avant
    assert [(f["chemin"], f["empreinte"]) for f in avant["fichiers"] if not f["chemin"].endswith("livraison.json")] == \
        [(f["chemin"], f["empreinte"]) for f in temoin["fichiers"] if not f["chemin"].endswith("livraison.json")]
    # Un repère sur une autre bande, non livrée ici, ne change rien non plus.
    course = _bande(atelier, projet, sujet, identifiant="course-sud", pose="course", direction="sud")
    atelier.reperes_sonores.poser(projet, sujet, {"bande": course.identifiant, "image": 2, "cle": "pas"})
    assert atelier.livraison.prevoir(projet, sujet, [marche.identifiant])["revision"] == avant["revision"]


def test_la_livraison_ajoute_la_piste_audio_au_temps_de_l_image(atelier, heros, tmp_path):
    projet, sujet, marche = heros
    godot = _godot(tmp_path)
    atelier.livraison.associer(projet, str(godot))
    _pas_en_jeu(atelier, projet, sujet)
    sans = atelier.livraison.prevoir(projet, sujet, [marche.identifiant])
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "pas"})
    # Un repère sur un emplacement vide est dit, jamais posé en silence.
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 1, "cle": "attaque"})
    apercu = atelier.livraison.prevoir(projet, sujet, [marche.identifiant])
    assert apercu["revision"] != sans["revision"]
    # Aller-retour à huit images par seconde : l'image 3 passe à 0,25 s et à 0,5 s.
    assert apercu["reperes_sonores"] == [{"animation": "marche/sud", "image": 3, "emplacement": "pas",
                                          "noeud": "sfx_heros_pas/Calage", "lecteur_du_jeu": "sfx_heros_pas", "temps": [.25, .5]}]
    assert [(r["emplacement"], r["image"]) for r in apercu["reperes_non_livres"]] == [("attaque", 1)]
    livre = atelier.livraison.livrer(projet, apercu["jeton"])
    assert livre["etat"] == "terminee"
    _, texte = _scene_de_revision(livre, godot)
    assert '[node name="AnimationPlayer" type="AnimationPlayer" parent="."]' in texte
    assert 'autoplay = &"marche/sud"' in texte and '&"marche": SubResource("AnimationLibrary_1")' in texte
    # Un seul lecteur démarre seul : l'AnimatedSprite2D ne pose plus son propre
    # autoplay quand l'AnimationPlayer autoplaye déjà cette même animation — les
    # deux se disputaient `frame`/`animation` dès la première image (défaut
    # plausible du 19 septembre 2026, voir docs/PIEGES.md).
    assert 'animation = &"marche/sud"\ncentered' in texte
    assert 'autoplay = "marche/sud"' not in texte
    assert 'resource_name = "sud"' in texte and "length = 0.75" in texte and "loop_mode = 1" in texte
    assert 'tracks/2/type = "audio"' in texte and 'tracks/2/path = NodePath("sfx_heros_pas/Calage")' in texte
    assert '"times": PackedFloat32Array(0.25, 0.5)' in texte
    # La piste vise un lecteur à elle, sous celui de l'emplacement : même son, même bus.
    assert '[node name="Calage" type="AudioStreamPlayer2D" parent="sfx_heros_pas"]\nstream = ExtResource("son_1")\nbus = &"SFX"' in texte
    assert texte.count('type="AudioStreamPlayer2D"') == 2
    assert '"values": [0, 1, 2, 3, 4, 5]' in texte
    # Autant d'étapes de chargement que de ressources : 1 SpriteFrames, 1 son, 2 internes, la scène.
    assert "load_steps=5" in texte and len(re.findall(r"^\[(ext|sub)_resource", texte, re.M)) == 4
    manifeste = json.loads(next(godot.rglob("livraison.json")).read_text(encoding="utf-8"))
    assert manifeste["reperes_sonores"][0]["temps"] == [.25, .5]
    # Changer la cadence garde le repère sur l'image 3 ; son temps suit la cadence livrée.
    _changer_la_cadence(atelier, marche, 4)
    encore = atelier.livraison.prevoir(projet, sujet, [marche.identifiant])
    assert encore["reperes_sonores"][0]["image"] == 3 and encore["reperes_sonores"][0]["temps"] == [.5, 1.0]


# ── Dans le vrai Godot 4.7 ───────────────────────────────────────────────


def _lancer(jeu, *arguments, delai=90):
    return subprocess.run([GODOT, "--headless", "--path", str(jeu), *arguments], capture_output=True, text=True,
                          timeout=delai, encoding="utf-8", errors="replace")


@pytest.mark.skipif(not GODOT, reason="Moteur Godot non installé")
def test_godot_charge_la_piste_audio_et_la_joue_a_chaque_boucle(atelier, heros, tmp_path):
    projet, sujet, marche = heros
    jeu = _godot(tmp_path, "jeu-reperes")
    atelier.livraison.associer(projet, str(jeu))
    _pas_en_jeu(atelier, projet, sujet)
    # Deux emplacements calés sur la même animation : un jeu de variantes
    # (« pas ») et un son seul en WAV (« mort ») — défaut 13, l'essai Godot ne
    # couvrait qu'un jeu de variantes.
    _mort_en_son(atelier, projet, sujet)
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 3, "cle": "pas"})
    atelier.reperes_sonores.poser(projet, sujet, {"bande": marche.identifiant, "image": 1, "cle": "mort"})
    livre = atelier.livraison.livrer(projet, atelier.livraison.prevoir(projet, sujet, [marche.identifiant])["jeton"])
    assert livre["etat"] == "terminee"
    importe = _lancer(jeu, "--editor", "--import")
    assert importe.returncode == 0, importe.stdout + importe.stderr
    script = '''extends SceneTree
class Compteur extends AudioStream:
    var dedans: AudioStream
    var fois := 0
    func _instantiate_playback() -> AudioStreamPlayback:
        fois += 1
        return dedans.instantiate_playback()
    func _get_length() -> float:
        return dedans.get_length()
func _piste_pour_chemin(a: Animation, chemin: NodePath) -> int:
    for i in a.get_track_count():
        if a.track_get_type(i) == Animation.TYPE_AUDIO and a.track_get_path(i) == chemin:
            return i
    return -1
func _initialize():
    var scene = load(SCENE).instantiate()
    root.add_child(scene)
    await process_frame
    var lecteur: AnimationPlayer = scene.get_node("AnimationPlayer")
    var joueur: AudioStreamPlayer2D = scene.get_node("sfx_heros_pas")
    assert(joueur.stream is AudioStreamRandomizer)
    # Le second emplacement, un son seul, est livré en AudioStreamWAV (pas un
    # AudioStreamRandomizer) et porte lui aussi son propre lecteur de calage.
    var joueur_mort: AudioStreamPlayer2D = scene.get_node("sfx_heros_mort")
    assert(joueur_mort.stream is AudioStreamWAV)
    assert(lecteur.has_animation(&"marche/sud"))
    var a: Animation = lecteur.get_animation(&"marche/sud")
    assert(a.loop_mode == Animation.LOOP_LINEAR and abs(a.length - 0.75) < 0.0001)
    var pistes_audio := []
    for i in a.get_track_count():
        if a.track_get_type(i) == Animation.TYPE_AUDIO:
            pistes_audio.append(i)
    assert(pistes_audio.size() == 2)
    var piste = _piste_pour_chemin(a, NodePath("sfx_heros_pas/Calage"))
    var piste_mort = _piste_pour_chemin(a, NodePath("sfx_heros_mort/Calage"))
    assert(piste >= 0 and piste_mort >= 0)
    assert(a.track_get_key_count(piste) == 2)
    assert(abs(a.track_get_key_time(piste, 0) - 0.25) < 0.0001 and abs(a.track_get_key_time(piste, 1) - 0.5) < 0.0001)
    assert(a.audio_track_get_key_stream(piste, 0) == joueur.stream)
    # Le repère « mort » à l'image 1 : temps 0, une seule fois par tour (l'image 1 ne repasse pas dans l'aller-retour).
    assert(a.track_get_key_count(piste_mort) == 1 and abs(a.track_get_key_time(piste_mort, 0) - 0.0) < 0.0001)
    assert(a.audio_track_get_key_stream(piste_mort, 0) == joueur_mort.stream)
    var calage: AudioStreamPlayer2D = scene.get_node("sfx_heros_pas/Calage")
    var calage_mort: AudioStreamPlayer2D = scene.get_node("sfx_heros_mort/Calage")
    assert(lecteur.get_node(lecteur.root_node).get_node(a.track_get_path(piste)) == calage)
    assert(lecteur.get_node(lecteur.root_node).get_node(a.track_get_path(piste_mort)) == calage_mort)
    assert(calage != joueur and calage.stream == joueur.stream)
    # Pas la même comparaison pour « mort » : sa clé est au temps 0, donc son
    # AnimationPlayer (déjà en lecture depuis l'`await process_frame` ci-dessus)
    # a pu la jouer immédiatement et son lecteur de calage a déjà pris son
    # AudioStreamPolyphonic (voir docs/PIEGES.md) — seule la distinction des
    # deux lecteurs est stable à cet instant ; l'égalité des flux se vérifie
    # sur la clé elle-même (ligne du dessus), pas sur l'état déjà joué.
    assert(calage_mort != joueur_mort)
    # L'animation se joue toute seule et mène le sprite : image 3 (frame 2) à 0,25 s.
    assert(lecteur.current_animation == "marche/sud")
    lecteur.seek(0.0, true)
    lecteur.pause()
    lecteur.seek(0.26, true)
    assert(scene.frame == 2)
    # À chaque boucle : un compteur enveloppe le jeu de variantes et compte les
    # départs. Deux tours (1,5 s) : l'image 3 passe quatre fois (0,25 0,5 1,0 1,25).
    var compteur := Compteur.new()
    compteur.dedans = joueur.stream
    for i in a.track_get_key_count(piste):
        a.audio_track_set_key_stream(piste, i, compteur)
    lecteur.stop()
    lecteur.play(&"marche/sud")
    for pas in 150:
        lecteur.advance(0.01)
    print("SN7_DEPARTS=", compteur.fois)
    assert(compteur.fois == 4)
    # Le lecteur de calage a été pris par l'AnimationPlayer ; celui de SN6 est
    # resté au jeu : son jeu de variantes, et un play() direct qui joue.
    assert(calage.stream is AudioStreamPolyphonic)
    lecteur.stop()
    await process_frame
    assert(joueur.stream is AudioStreamRandomizer)
    joueur.play()
    await process_frame
    assert(joueur.playing)
    print("SN7_GODOT_OK")
    quit()
'''.replace("SCENE", json.dumps(livre["scene"]))
    (jeu / "preuve.gd").write_text(script, encoding="utf-8")
    preuve = _lancer(jeu, "--script", "preuve.gd", delai=30)
    assert preuve.returncode == 0 and "SN7_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    # Godot 4.7 signale parfois à la fermeture des objets audio encore en
    # mémoire (« ObjectDB instances were leaked », « resources still in use »).
    # Mesuré le 19 septembre 2026 : ça apparaît ou non d'un lancement à l'autre,
    # au même endroit du script, dès que la scène est dans l'arbre. C'est du
    # bruit de sortie, pas une erreur de la scène livrée : on l'écarte, et rien
    # d'autre.
    bruit_de_sortie = ("instances were leaked at exit", "resources still in use at exit")
    erreurs = "\n".join(ligne for ligne in preuve.stderr.splitlines()
                        if not any(b in ligne for b in bruit_de_sortie))
    assert "SCRIPT ERROR" not in erreurs and "ERROR" not in erreurs, preuve.stderr
