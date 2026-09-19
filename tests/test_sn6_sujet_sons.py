"""SN6 : les sons d'un sujet — emplacements, série depuis un emplacement, et
livraison du sujet avec ses sons.

ComfyUI est doublé (le double de SN1) ; la file locale, les séries, les jeux
de variantes, la bibliothèque des sons et la livraison Godot sont réels. Rien
n'est payé."""
import threading
import time
from unittest.mock import patch

import numpy as np
import pytest

from atelier.audio.traitement import encoder
from atelier.domaine.sons_du_sujet import SonsDuSujetRefuses, base_stable, proposes, sujet_court, texte_propose
from atelier.services.livraison import ServiceLivraison
from tests.test_au1 import _bande
from tests.test_au14_generation import fermer  # noqa: F401 — la fixture de SN1 s'en sert
from tests.test_sn1_installation import son  # noqa: F401 — la fixture

DESCRIPTION = "small hooded traveller, soft leather boots"


def _stereo(duree=1.0, taux=16000):
    t = np.arange(round(duree * taux)) / taux
    g = .25 * np.sin(2 * np.pi * 440 * t)
    return np.column_stack((g, .5 * g))


def _importe(atelier, projet, nom="Pas importé.wav"):
    return atelier.sons.importer_octets(projet, encoder(_stereo(), 16000), nom=nom)


def _jeu_ouvert(atelier):
    return atelier.bibliotheque.courant or atelier.bibliotheque.creer_projet("SN6").identifiant


def _godot(tmp_path):
    jeu = tmp_path / "jeu-godot"
    jeu.mkdir()
    (jeu / "project.godot").write_text('config_version=5\n[application]\nconfig/name="SN6"\n', encoding="utf-8")
    return jeu


async def _serie_du_pas(atelier, projet, heros, nombre=3):
    proposition = atelier.sons_du_sujet.proposer(projet, heros, "pas")
    demande = {k: proposition[k] for k in ("famille", "prompt", "nom")} | {"nombre": nombre}
    serie = await atelier.sons_du_sujet.preparer_serie(projet, heros, "pas", demande)
    await atelier.series_son.demarrer(projet, serie["identifiant"])
    await atelier.travaux.attendre_tout()
    return atelier.series_son.lire(projet, serie["identifiant"])


# ── Les règles pures ─────────────────────────────────────────────────────


def test_emplacements_proposes_par_famille_de_sujet():
    assert [e["cle"] for e in proposes("personnages")] == ["pas", "attaque", "coup_recu", "mort", "replique"]
    assert [e["cle"] for e in proposes("objets")] == ["ramasser", "utiliser"]
    assert [(e["cle"], e["famille"]) for e in proposes("decors")] == [("ambiance", "ambiance")]
    assert {e["famille"] for e in proposes("interface")} == {"interface"}
    assert proposes("tous") == []
    assert next(e for e in proposes("personnages") if e["cle"] == "replique")["famille"] == "voix"


def test_nom_stable_sans_article_et_texte_propose_tel_quel():
    assert sujet_court("Le pèlerin") == "pelerin" and sujet_court("L'ogre") == "ogre" and sujet_court("Champy") == "champy"
    assert base_stable("Le pèlerin", "coup_recu") == "pelerin_coup_recu"
    texte, morceaux = texte_propose("Petit voyageur encapuchonné", "Le pèlerin", proposes("personnages")[0])
    # Rien n'est traduit : la description part telle qu'elle est écrite.
    assert texte == "footsteps, Petit voyageur encapuchonné"
    assert [m["source"] for m in morceaux] == ["emplacement", "sujet"]
    libre = {"cle": "saut", "nom": "Saut", "famille": "bruitage", "indice": None}
    assert texte_propose("", "Le pèlerin", libre)[0] == "Saut, Le pèlerin"


# ── Critère 1 · Depuis la fiche d'un héros, le « pas » vide lance une série ─


async def test_le_pas_vide_du_heros_lance_une_serie_deja_decrite_et_le_garde_y_apparait(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    vue = atelier.sons_du_sujet.lire(projet, heros)
    assert vue["sujet"]["famille"] == "personnages" and vue["remplis"] == 0 and vue["total"] == 5
    pas = vue["emplacements"][0]
    assert (pas["cle"], pas["famille"], pas["rempli"], pas["nom_stable"]) == ("pas", "bruitage", False, "sfx_heros_pas")
    # La proposition vient du sujet et de l'emplacement ; elle n'écrit rien.
    proposition = atelier.sons_du_sujet.proposer(projet, heros, "pas")
    assert proposition["prompt"] == "footsteps, " + DESCRIPTION and proposition["famille"] == "bruitage"
    assert proposition["nombre"] == 8 and not comfy.envois and not atelier.series_son.lister(projet)
    serie = await _serie_du_pas(atelier, projet, heros)
    assert serie["etat"] == "terminee" and serie["emplacement"]["nom"] == "Pas"
    assert serie["emplacement"]["nom_sujet"] == "Le héros"
    # Le texte parti est celui relu : la description, telle quelle.
    assert DESCRIPTION in serie["texte_fige"]
    lu = atelier.sons_du_sujet.lire(projet, heros)["emplacements"][0]
    assert lu["derniere_serie"] == serie["identifiant"] and not lu["rempli"]
    # Garder range dans le jeu de l'emplacement, sous son nom stable.
    jeu = atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [1, 3]})
    assert jeu["nom"] == "sfx_heros_pas" and jeu["famille"] == "bruitage" and len(jeu["sons"]) == 2
    lu = atelier.sons_du_sujet.lire(projet, heros)["emplacements"][0]
    assert lu["rempli"] and lu["contenu"]["nature"] == "jeu" and lu["contenu"]["identifiant"] == jeu["identifiant"]
    assert lu["contenu"]["sons"] == jeu["sons"]
    assert atelier.series_son.lire(projet, serie["identifiant"])["jeux"] == [jeu["identifiant"]]
    # Une seconde série du même emplacement range dans le même jeu, et se rouvre avec lui.
    seconde = await _serie_du_pas(atelier, projet, heros, nombre=2)
    assert atelier.series_son.lire(projet, seconde["identifiant"])["jeux"] == [jeu["identifiant"]]
    encore = atelier.series_son.garder(projet, seconde["identifiant"], {"rangs": [2]})
    assert encore["identifiant"] == jeu["identifiant"] and len(encore["sons"]) == 3
    lu = atelier.sons_du_sujet.lire(projet, heros)["emplacements"][0]
    assert lu["series"] == [serie["identifiant"], seconde["identifiant"]] and lu["derniere_serie"] == seconde["identifiant"]
    assert len(lu["contenu"]["sons"]) == 3


async def test_une_serie_d_un_emplacement_refuse_une_autre_famille_et_l_interface(son):  # noqa: F811
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    with pytest.raises(SonsDuSujetRefuses, match="bruitage"):
        await atelier.sons_du_sujet.preparer_serie(projet, heros, "pas", {"famille": "ambiance", "prompt": "rain"})
    atelier.sons_du_sujet.ajouter(projet, heros, {"nom": "menu", "famille": "interface"})
    with pytest.raises(SonsDuSujetRefuses, match="sfxr"):
        await atelier.sons_du_sujet.preparer_serie(projet, heros, "menu", {"prompt": "click"})
    with pytest.raises(SonsDuSujetRefuses, match="n'existe pas"):
        atelier.sons_du_sujet.proposer(projet, heros, "vol")


# ── Critère 2 · Un son sans sujet reste un son du jeu ────────────────────


def test_un_son_sans_sujet_reste_un_son_du_jeu_et_vider_ne_retire_rien(atelier):
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    libre = _importe(atelier, projet, "Vent.wav")
    pose = _importe(atelier, projet, "Pas.wav")
    assert atelier.sons_du_sujet.index(projet) == []
    atelier.sons_du_sujet.poser(projet, heros, "pas", {"son": pose["identifiant"]})
    index = atelier.sons_du_sujet.index(projet)
    assert [(i["nom_sujet"], i["cle"], i["contenu"]["sons"]) for i in index] == [("Le héros", "pas", [pose["identifiant"]])]
    galerie = {s["identifiant"] for s in atelier.sons.lister(projet)}
    assert {libre["identifiant"], pose["identifiant"]} <= galerie
    vide = atelier.sons_du_sujet.vider(projet, heros, "pas")
    assert vide["contenu"] is None and not vide["rempli"]
    assert {libre["identifiant"], pose["identifiant"]} <= {s["identifiant"] for s in atelier.sons.lister(projet)}
    assert atelier.sons_du_sujet.index(projet) == []


def test_emplacement_nomme_a_la_main_et_ses_refus(atelier):
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros").identifiant
    vue = atelier.sons_du_sujet.ajouter(projet, heros, {"nom": "saut léger", "famille": "bruitage"})
    saut = vue["emplacements"][-1]
    assert (saut["cle"], saut["nom"], saut["libre"], saut["nom_stable"]) == ("saut_leger", "Saut léger", True, "sfx_heros_saut_leger")
    with pytest.raises(SonsDuSujetRefuses, match="déjà"):
        atelier.sons_du_sujet.ajouter(projet, heros, {"nom": "Pas", "famille": "bruitage"})
    with pytest.raises(SonsDuSujetRefuses, match="famille"):
        atelier.sons_du_sujet.ajouter(projet, heros, {"nom": "Vol", "famille": "cri"})
    with pytest.raises(SonsDuSujetRefuses, match="se vide"):
        atelier.sons_du_sujet.retirer_emplacement(projet, heros, "pas")
    with pytest.raises(SonsDuSujetRefuses, match="conservé"):
        atelier.sons_du_sujet.poser(projet, heros, "pas", {"son": "0" * 32})
    son_ = _importe(atelier, projet)
    atelier.sons_du_sujet.poser(projet, heros, "saut_leger", {"son": son_["identifiant"]})
    apres = atelier.sons_du_sujet.retirer_emplacement(projet, heros, "saut_leger")
    assert all(e["cle"] != "saut_leger" for e in apres["emplacements"])
    assert son_["identifiant"] in {s["identifiant"] for s in atelier.sons.lister(projet)}


def test_poser_et_vider_refusent_une_revision_perimee(atelier):
    """Défaut plausible du 19 septembre 2026 : rien ne vérifiait qu'on posait
    sur la révision lue. `revision` (facultative) refuse un geste écrit après
    coup sur une lecture périmée, plutôt que d'écraser en silence."""
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    lue = atelier.sons_du_sujet.lire(projet, heros)
    un = _importe(atelier, projet, "Pas 1.wav")
    deux = _importe(atelier, projet, "Pas 2.wav")
    # Sans revision (comme avant) : le geste part toujours.
    atelier.sons_du_sujet.poser(projet, heros, "pas", {"son": un["identifiant"]})
    # Avec la révision déjà lue plus haut (désormais périmée, puisque le
    # geste ci-dessus a incrémenté la révision) : refusé, rien n'est écrasé.
    with pytest.raises(SonsDuSujetRefuses, match="changé"):
        atelier.sons_du_sujet.poser(projet, heros, "pas", {"son": deux["identifiant"], "revision": lue["revision"]})
    assert atelier.sons_du_sujet.emplacement(projet, heros, "pas")["contenu"]["identifiant"] == un["identifiant"]
    # Avec la bonne révision : le geste part.
    courante = atelier.sons_du_sujet.lire(projet, heros)["revision"]
    atelier.sons_du_sujet.poser(projet, heros, "pas", {"son": deux["identifiant"], "revision": courante})
    assert atelier.sons_du_sujet.emplacement(projet, heros, "pas")["contenu"]["identifiant"] == deux["identifiant"]
    # Vider suit la même règle.
    perimee = courante  # cette révision-là a déjà été dépassée par la pose ci-dessus
    with pytest.raises(SonsDuSujetRefuses, match="changé"):
        atelier.sons_du_sujet.vider(projet, heros, "pas", revision=perimee)
    courante = atelier.sons_du_sujet.lire(projet, heros)["revision"]
    atelier.sons_du_sujet.vider(projet, heros, "pas", revision=courante)
    assert atelier.sons_du_sujet.emplacement(projet, heros, "pas")["contenu"] is None


async def test_garder_depuis_serie_concurrents_ne_perdent_aucun_son(son):  # noqa: F811
    """Défaut plausible du 19 septembre 2026 : `garder_depuis_serie` lisait
    l'emplacement hors verrou puis créait et posait le jeu ; deux « Garder »
    simultanés sur le même emplacement (l'écran et un agent, par exemple)
    pouvaient chacun créer leur propre jeu, le second remplaçant le premier.
    Corrigé : lecture, décision, création et pose sous un seul verrou — deux
    gestes réellement concurrents s'ajoutent désormais au même jeu."""
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    # Deux séries réelles sur le même emplacement (comme l'écran et un agent
    # qui lanceraient chacun la leur), chacune avec un tirage à garder.
    serie_a = await _serie_du_pas(atelier, projet, heros, nombre=2)
    serie_b = await _serie_du_pas(atelier, projet, heros, nombre=2)
    son_a = serie_a["tirages"][0]["son"]["identifiant"]
    son_b = serie_b["tirages"][0]["son"]["identifiant"]
    original = atelier.variantes_son.creer

    def creer_lentement(*args, **kwargs):
        # Élargit la fenêtre où un geste concurrent pourrait lire l'ancien
        # contenu de l'emplacement — la sortie n'est plus dans la même
        # section critique dans le code corrigé, donc l'autre thread attend
        # ici, bloqué sur le verrou du sujet, plutôt que de courir en même
        # temps.
        time.sleep(0.3)
        return original(*args, **kwargs)

    resultats = {}
    barriere = threading.Barrier(2)

    def lancer(nom, serie, sons):
        barriere.wait(timeout=5)
        resultats[nom] = atelier.sons_du_sujet.garder_depuis_serie(projet, serie, sons, True)

    with patch.object(atelier.variantes_son, "creer", side_effect=creer_lentement):
        fils = [threading.Thread(target=lancer, args=(nom, serie, [s]))
                for nom, serie, s in (("a", serie_a, son_a), ("b", serie_b, son_b))]
        for f in fils:
            f.start()
        for f in fils:
            f.join(timeout=10)
    assert "a" in resultats and "b" in resultats
    emplacement = atelier.sons_du_sujet.emplacement(projet, heros, "pas")
    assert emplacement["contenu"]["nature"] == "jeu"
    jeu = atelier.variantes_son.lire(projet, emplacement["contenu"]["identifiant"])
    # Aucun son perdu : les deux sons gardés « en même temps » sont dans le
    # même jeu — pas dans deux jeux dont un aurait remplacé l'autre.
    assert {son_a, son_b} <= set(jeu["sons"])
    assert len(jeu["sons"]) == 2


def test_routes_des_sons_d_un_sujet(atelier, client):
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    base = f"/api/projects/{projet}/subjects/{heros}/sounds"
    lu = client.get(base)
    assert lu.status_code == 200 and lu.json()["emplacements"][0]["cle"] == "pas"
    assert client.post(f"{base}/pas/series/propose").json()["prompt"].startswith("footsteps, ")
    son_ = _importe(atelier, projet)
    pose = client.put(f"{base}/pas", json={"son": son_["identifiant"]})
    assert pose.status_code == 200 and pose.json()["rempli"]
    assert client.get(f"/api/projects/{projet}/subject-sounds").json()[0]["cle"] == "pas"
    refus = client.put(f"{base}/pas", json={"son": son_["identifiant"], "jeu": "x"})
    assert refus.status_code == 409 and refus.json()["code"] == "sons_du_sujet_refuses"
    # `revision` (facultative) sur les routes d'écriture : refusée si périmée.
    perime = client.put(f"{base}/pas", json={"son": son_["identifiant"], "revision": 0})
    assert perime.status_code == 409 and perime.json()["code"] == "sons_du_sujet_refuses"
    assert client.post(base, json={"nom": "Saut", "famille": "bruitage"}).status_code == 201
    vue = client.get(base).json()
    assert client.delete(f"{base}/pas/content", params={"revision": 0}).status_code == 409
    assert client.delete(f"{base}/pas/content", params={"revision": vue["revision"]}).json()["contenu"] is None
    assert client.delete(f"{base}/saut").status_code == 200


async def test_les_outils_de_l_agent(atelier):
    from atelier.mcp.serveur import creer_serveur
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    serveur = creer_serveur(atelier)
    noms = {t.name for t in await serveur.list_tools()}
    assert {"list_subject_sounds", "edit_subject_sound_slot", "prepare_subject_sound_series"} <= noms
    son_ = _importe(atelier, projet)
    r = await serveur.call_tool("edit_subject_sound_slot", {"project": projet, "subject": heros,
                                                            "request": {"slot": "pas", "set": {"son": son_["identifiant"]}}})
    assert not r.is_error, r
    r = await serveur.call_tool("prepare_subject_sound_series", {"project": projet, "subject": heros, "slot": "pas"})
    assert not r.is_error and r.structured_content["prompt"].startswith("footsteps")
    r = await serveur.call_tool("list_subject_sounds", {"project": projet})
    assert not r.is_error


# ── Critère 3 · Livrer le héros livre ses sons, sous leurs noms stables ───


async def test_livrer_le_heros_livre_ses_sons_sous_leurs_noms_stables(son, tmp_path):  # noqa: F811
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    bande = _bande(atelier, projet, heros)
    godot = _godot(tmp_path)
    atelier.livraison.associer(projet, str(godot))
    # Sans son, le paquet est celui d'avant SN6, révision comprise.
    sans_hook = ServiceLivraison(atelier.base, atelier.fichiers, atelier.export, atelier.production, atelier.diffusion)
    avant = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    temoin = sans_hook.prevoir(projet, heros, [bande.identifiant])
    assert avant["revision"] == temoin["revision"] and "sons" not in avant
    assert [f["chemin"] for f in avant["fichiers"]] == [f["chemin"] for f in temoin["fichiers"]]
    # Le pas (un jeu de deux variantes) et la mort (un son seul).
    serie = await _serie_du_pas(atelier, projet, heros)
    atelier.series_son.garder(projet, serie["identifiant"], {"rangs": [1, 2]})
    mort = _importe(atelier, projet, "Chute.wav")
    atelier.sons.classer(projet, mort["identifiant"], mort["revision"], "bruitage")
    atelier.sons_du_sujet.poser(projet, heros, "mort", {"son": mort["identifiant"]})
    apercu = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    assert apercu["revision"] != avant["revision"]
    noms = {f["chemin"].rsplit("/revisions/", 1)[-1].split("/", 1)[-1] for f in apercu["fichiers"]}
    attendus = {"sons/sfx_heros_pas_01.wav", "sons/sfx_heros_pas_02.wav", "sons/sfx_heros_pas.tres",
                "sons/sfx_heros_pas_01.wav.import", "sons/sfx_heros_pas_02.wav.import",
                "sons/sfx_heros_mort.wav", "sons/sfx_heros_mort.wav.import", "sons/credits.json"}
    assert attendus <= noms, noms - attendus
    assert [(s["emplacement"], s["nom_stable"], s["nature"]) for s in apercu["sons"]] == [
        ("pas", "sfx_heros_pas", "jeu"), ("mort", "sfx_heros_mort", "son")]
    livre = atelier.livraison.livrer(projet, apercu["jeton"])
    assert livre["etat"] == "terminee"
    scene = next(f for f in livre["fichiers"] if f["chemin"].endswith("/personnage.tscn") and "/revisions/" in f["chemin"])
    texte = (godot / scene["chemin"]).read_text(encoding="utf-8")
    assert '[node name="sfx_heros_pas" type="AudioStreamPlayer2D" parent="."]' in texte
    assert 'bus = &"SFX"' in texte and "sons/sfx_heros_pas.tres" in texte and "load_steps=4" in texte
    tres = next(f for f in livre["fichiers"] if f["chemin"].endswith("sons/sfx_heros_pas.tres"))
    assert "AudioStreamRandomizer" in (godot / tres["chemin"]).read_text(encoding="utf-8")
    credits = next(f for f in livre["fichiers"] if f["chemin"].endswith("sons/credits.json"))
    assert "sfx_heros_mort.wav" in (godot / credits["chemin"]).read_text(encoding="utf-8")
    # Un emplacement dont rien n'est livrable est signalé, jamais retiré en silence.
    atelier.sons.juger(projet, mort["identifiant"], atelier.sons.lire(projet, mort["identifiant"])["revision"], "ecartee")
    encore = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    assert [s["emplacement"] for s in encore["sons"]] == ["pas"]
    assert [n["cle"] for n in encore["sons_non_livres"]] == ["mort"]


def test_renommer_le_jeu_de_variantes_ne_change_pas_le_nom_stable_livre(son, tmp_path):  # noqa: F811
    """Défaut confirmé le 19 septembre 2026 : le nom livré d'un emplacement
    suivait le nom du jeu de variantes, alors que l'écran affiche toujours
    `e.nom_stable` — un jeu renommé « Pas sur herbe » cassait le
    `$sfx_heros_pas` du jeu. Il suit désormais toujours le sujet et la clé."""
    atelier, _ = son
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    godot = _godot(tmp_path)
    atelier.livraison.associer(projet, str(godot))
    pas = _importe(atelier, projet, "Pas.wav")
    atelier.sons.classer(projet, pas["identifiant"], pas["revision"], "bruitage")
    jeu = atelier.variantes_son.creer(projet, {"nom": "sfx_heros_pas", "sons": [pas["identifiant"]], "famille": "bruitage"})
    atelier.sons_du_sujet.poser(projet, heros, "pas", {"jeu": jeu["identifiant"]})
    atelier.variantes_son.renommer(projet, jeu["identifiant"], "Pas sur herbe")
    paquet = atelier.sons_du_sujet.paquet_pour_livraison(projet, heros)
    assert paquet["entrees"][0]["nom_stable"] == "sfx_heros_pas"
    assert "sfx_heros_pas.tres" in paquet["fichiers"] and "sfx_pas_sur_herbe.tres" not in paquet["fichiers"]
    # L'écran (e.nom_stable) et le paquet livré restent le même nom, quel que
    # soit le nom du jeu de variantes.
    vue = atelier.sons_du_sujet.emplacement(projet, heros, "pas")
    assert vue["nom_stable"] == "sfx_heros_pas" == paquet["entrees"][0]["nom_stable"]
    # Signalé, pour que l'auteur sache qu'un renommage du SUJET (pas du jeu)
    # changerait bien ces noms stables.
    assert paquet["avertissement_renommage"] and "sfx_heros_pas" in paquet["avertissement_renommage"]


def test_sons_non_livres_et_reperes_non_livres_meme_sans_rien_de_livrable(son, tmp_path):  # noqa: F811
    """Défaut confirmé le 19 septembre 2026 : quand aucun emplacement n'est
    livrable, le paquet valait `None` et les repères n'étaient pas lus — le
    manifeste perdait `sons_non_livres` et `reperes_non_livres`. Un sujet qui
    n'a vraiment ni son ni repère reste, lui, identique octet pour octet."""
    atelier, _ = son
    projet = _jeu_ouvert(atelier)
    heros = atelier.production.creer_personnage(projet, "Le héros", DESCRIPTION).identifiant
    bande = _bande(atelier, projet, heros)
    godot = _godot(tmp_path)
    atelier.livraison.associer(projet, str(godot))
    # Rien du tout : le paquet reste None, la livraison identique à avant SN6.
    assert atelier.sons_du_sujet.paquet_pour_livraison(projet, heros) is None
    sans_hook = ServiceLivraison(atelier.base, atelier.fichiers, atelier.export, atelier.production, atelier.diffusion)
    avant = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    temoin = sans_hook.prevoir(projet, heros, [bande.identifiant])
    assert avant["revision"] == temoin["revision"] and "sons" not in avant and "sons_non_livres" not in avant
    # Un son posé puis écarté : rien à livrer, mais un emplacement à signaler.
    mort = _importe(atelier, projet, "Chute.wav")
    atelier.sons.classer(projet, mort["identifiant"], mort["revision"], "bruitage")
    atelier.sons_du_sujet.poser(projet, heros, "mort", {"son": mort["identifiant"]})
    atelier.sons.juger(projet, mort["identifiant"], atelier.sons.lire(projet, mort["identifiant"])["revision"], "ecartee")
    paquet = atelier.sons_du_sujet.paquet_pour_livraison(projet, heros)
    assert paquet is not None and paquet["entrees"] == [] and [n["cle"] for n in paquet["non_livres"]] == ["mort"]
    apercu = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    assert [n["cle"] for n in apercu["sons_non_livres"]] == ["mort"]
    assert "sons" not in apercu  # aucune entrée livrable : pas de liste vide qui traîne
    # Un repère posé sur ce même emplacement, non livrable, est signalé lui aussi.
    atelier.reperes_sonores.poser(projet, heros, {"bande": bande.identifiant, "image": 1, "cle": "mort"})
    encore = atelier.livraison.prevoir(projet, heros, [bande.identifiant])
    assert [(r["emplacement"], r["raison"]) for r in encore["reperes_non_livres"]] == \
        [("mort", "Cet emplacement ne part pas avec le sujet : il n'a aucun son livrable.")]
    assert "reperes_sonores" not in encore
