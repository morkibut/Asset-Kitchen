"""SN0 : essais du banc `essais/banc_son.py`, sans ComfyUI.

Le mode `--verifier` sur la fixture `tests/object_info_son.json` dit ce qui
manque (ici : tous les poids, elle décrit une machine qui n'a rien encore
téléchargé) ; chaque graphe du programme passe la vérification une fois les
poids « installés » dans une copie de la fixture ; la page d'écoute se
génère depuis un mesures.json factice, sans réseau.
"""
import copy
import importlib.util
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

_SPEC = importlib.util.spec_from_file_location("banc_son", RACINE / "essais" / "banc_son.py")
banc = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(banc)

OBJECT_INFO = json.loads((RACINE / "tests" / "object_info_son.json").read_text(encoding="utf-8"))


def installe(info, profil):
    """Même geste que tests/test_sn1_profils_son.py : une machine qui a les
    poids d'un profil rejoint les choix de ses chargeurs."""
    info = copy.deepcopy(info)
    for noeud in profil["graphe"].values():
        for champ, valeur in noeud["inputs"].items():
            if champ in banc.CHAMPS_FICHIER:
                info[noeud["class_type"]]["input"]["required"][champ][0].append(valeur)
    return info


# ── Le programme ────────────────────────────────────────────────────────


def test_le_programme_couvre_les_douze_bruitages_les_trois_ambiances_et_la_musique():
    programme = banc.construire_programme(encodeur_1_7b_present=False)
    par_moteur = {}
    for item in programme:
        par_moteur.setdefault(item["moteur"], []).append(item["cle"])
    assert len(par_moteur["sa3-small-sfx"]) == 13  # douze du relevé + la troisième ambiance
    assert sum(1 for c in par_moteur["sa3-small-sfx"] if "ambiance" in c) == 3
    assert par_moteur["ace-step-15-turbo"] == ["exploration", "combat"]
    assert par_moteur["yue2-int8"] == ["exploration-instrumental", "combat-instrumental", "taverne"]
    assert "ace-step-15-turbo-1.7b" not in par_moteur


def test_la_variante_1_7b_n_entre_dans_le_programme_que_si_le_fichier_est_present():
    sans = banc.construire_programme(encodeur_1_7b_present=False)
    avec = banc.construire_programme(encodeur_1_7b_present=True)
    assert len(avec) == len(sans) + 1
    variante = [i for i in avec if i["moteur"] == "ace-step-15-turbo-1.7b"]
    assert len(variante) == 1
    profil = banc.profil_de("ace-step-15-turbo-1.7b")
    assert profil["graphe"]["3"]["inputs"]["clip_name2"] == banc.FICHIER_ACE_1_7B
    assert profil["graphe"]["3"]["inputs"]["clip_name1"] == "qwen_0.6b_ace15.safetensors"  # le premier emplacement ne change pas
    assert profil["graphe"]["5"]["inputs"]["generate_audio_codes"] is True


def test_toutes_les_paroles_de_la_taverne_sont_en_anglais_et_courtes():
    taverne = [i for i in banc.construire_programme(False) if i["cle"] == "taverne"][0]
    assert taverne["moteur"] == "yue2-int8"
    paroles = taverne["champs"]["paroles"]
    assert "[Verse]" in paroles and "[Chorus]" in paroles
    assert len(paroles) < 600  # « courtes », comme le demande docs/PLAN-son.md


# ── Le diagnostic : nœuds et valeurs ────────────────────────────────────


def test_verifier_sur_une_machine_sans_les_poids_ne_signale_que_des_poids_absents():
    programme = banc.construire_programme(encodeur_1_7b_present=False)
    for item in programme:
        profil = banc.profil_de(item["moteur"])
        graphe = banc.composer_graphe(profil, graine=0, **item["champs"])
        problemes = banc.diagnostiquer_graphe(graphe, OBJECT_INFO)
        assert problemes, item["cle"]
        assert all("poids absent" in p for p in problemes), (item["cle"], problemes)


def test_chaque_graphe_du_programme_passe_une_fois_les_poids_installes():
    programme = banc.construire_programme(encodeur_1_7b_present=True)
    info = OBJECT_INFO
    for item in programme:
        profil = banc.profil_de(item["moteur"])
        info = installe(info, profil)
    for item in programme:
        profil = banc.profil_de(item["moteur"])
        graphe = banc.composer_graphe(profil, graine=7, **item["champs"])
        assert banc.diagnostiquer_graphe(graphe, info) == [], item["cle"]


def test_diagnostiquer_signale_un_noeud_absent():
    graphe = {"1": {"class_type": "NoeudInexistant", "inputs": {}}}
    problemes = banc.diagnostiquer_graphe(graphe, OBJECT_INFO)
    assert len(problemes) == 1 and "absent de cette installation" in problemes[0]


def test_diagnostiquer_signale_une_valeur_hors_choix():
    profil = banc.CONSTRUCTEURS["ace-step-15-turbo"]()
    graphe = banc.composer_graphe(profil, graine=0, prompt="x", secondes=30, tonalite="Do mineur")
    problemes = banc.diagnostiquer_graphe(graphe, OBJECT_INFO)
    assert any("keyscale" in p and "Do mineur" in p for p in problemes)


def test_composer_graphe_pose_la_graine_partout_ou_elle_est_liee():
    profil = banc.CONSTRUCTEURS["ace-step-15-turbo"]()
    graphe = banc.composer_graphe(profil, graine=123, prompt="x", secondes=64, tempo=90, tonalite="D minor", mesure=4)
    assert graphe["5"]["inputs"]["seed"] == graphe["8"]["inputs"]["seed"] == 123
    assert graphe["5"]["inputs"]["timesignature"] == "4"  # castée en texte, comme le nœud le déclare


def test_poids_du_profil_connait_le_dossier_et_la_source_de_chaque_fichier():
    profil = banc.CONSTRUCTEURS["sa3-small-sfx"]()
    lignes = banc.poids_du_profil(profil, OBJECT_INFO)
    fichiers = {l["fichier"] for l in lignes}
    assert fichiers == {"stable_audio_3_small_sfx.safetensors", "t5gemma_b_b_ul2.safetensors"}
    assert all(not l["present"] for l in lignes)
    assert all(l["dossier"] != "?" and l["source"].startswith("https://") for l in lignes)


def test_poids_du_profil_1_7b_a_sa_propre_fiche_hors_graphes_py():
    profil = banc.profil_de("ace-step-15-turbo-1.7b")
    lignes = {l["fichier"]: l for l in banc.poids_du_profil(profil, OBJECT_INFO)}
    assert banc.FICHIER_ACE_1_7B in lignes
    assert lignes[banc.FICHIER_ACE_1_7B]["dossier"] == "text_encoders"


# ── La page d'écoute ─────────────────────────────────────────────────────


def _mesure_factice(fichier="a.flac", garde_pic=None):
    return {"moteur": "sa3-small-sfx", "cle": "ui-clic", "categorie": "bruitage",
        "description": "TrackType: SFX. clic", "graine": 3, "fichier": fichier,
        "temps_s": 4.2, "pic_memoire_mo": garde_pic or 1234,
        "mesures": {"duree": 0.9, "crete_db": -2.1, "lufs": -14.3, "silencieux": False, "ecretes": 0}}


def test_ecrire_page_produit_une_page_autonome_avec_les_mesures_incluses(tmp_path):
    mesures = {"sa3-small-sfx/ui-clic/3": _mesure_factice(), "sa3-small-sfx/ui-clic/4": _mesure_factice("b.flac")}
    chemin = banc.ecrire_page(tmp_path, mesures)
    assert chemin.exists() and chemin.name == "page.html"
    contenu = chemin.read_text("utf-8")
    assert "a.flac" in contenu and "b.flac" in contenu
    # Les mesures sont incluses telles quelles dans la page (pas de fetch externe) :
    assert json.dumps(mesures["sa3-small-sfx/ui-clic/3"]["mesures"]["lufs"]) in contenu
    assert "localStorage" in contenu and "banc_son_gardes" in contenu


def test_ecrire_page_accepte_des_mesures_vides(tmp_path):
    chemin = banc.ecrire_page(tmp_path, {})
    assert chemin.exists()
    assert "MESURES = {}" in chemin.read_text("utf-8")
