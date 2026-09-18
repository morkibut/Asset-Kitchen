"""SN1 : les profils sonores que l'atelier écrit, la durée libre, et les
réglages de musique (paroles, tempo, tonalité, mesure). ComfyUI est doublé ;
son /object_info est un extrait réel (ComfyUI 0.36, 18 septembre 2026),
réduit aux nœuds utilisés : tests/object_info_son.json."""
import copy
import json
from pathlib import Path

import httpx
import pytest

from atelier.audio.graphes import CONSTRUCTEURS, FICHIERS, fichiers_requis
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.workflow import TONALITES, WorkflowRefuse, composer, normaliser, version_de
from atelier.fournisseur.workflow import MoteurWorkflow
from atelier.services import Atelier
from atelier.services.travaux import _hash, _json
from tests.test_au10_occupation import profil_audio
from tests.test_au14_generation import ComfySon, fermer, lancer, profil_son
from tests.test_au7_au8 import raccorder

OBJECT_INFO = json.loads((Path(__file__).parent / "object_info_son.json").read_text(encoding="utf-8"))
CHAMPS_FICHIER = ("ckpt_name", "clip_name", "clip_name1", "clip_name2", "unet_name", "vae_name")


def _choix(declaration):
    """Les choix d'un COMBO, dans ses deux écritures d'object_info."""
    if isinstance(declaration[0], list):
        return declaration[0]
    if declaration[0] == "COMBO":
        return declaration[1].get("options")
    return None


def installe(info, profil):
    """L'object_info d'une machine qui a les poids : chaque fichier du profil
    rejoint les choix de son chargeur."""
    info = copy.deepcopy(info)
    for noeud in profil["graphe"].values():
        for champ, valeur in noeud["inputs"].items():
            if champ in CHAMPS_FICHIER:
                info[noeud["class_type"]]["input"]["required"][champ][0].append(valeur)
    return info


async def diagnostiquer(profil, info):
    moteur = MoteurWorkflow("http://comfy.test", httpx.MockTransport(lambda r: httpx.Response(200, json=info)))
    return await moteur.diagnostiquer_profil(profil)


# ── Les constructeurs ───────────────────────────────────────────────────


@pytest.mark.parametrize("identifiant", list(CONSTRUCTEURS))
def test_chaque_constructeur_rend_un_profil_que_normaliser_accepte(identifiant):
    brut = CONSTRUCTEURS[identifiant]()
    profil = normaliser(copy.deepcopy(brut))
    assert profil["identifiant"] == identifiant and profil["nature"] == "audio"
    assert profil["duree_libre"] == brut["duree_libre"] and "graine" in profil["liaisons"]
    # Deux constructions donnent la même version : l'atelier peut réinstaller.
    assert version_de(normaliser(CONSTRUCTEURS[identifiant]())) == version_de(profil)


@pytest.mark.parametrize("identifiant", list(CONSTRUCTEURS))
def test_chaque_noeud_existe_dans_l_object_info_releve(identifiant):
    graphe = CONSTRUCTEURS[identifiant]()["graphe"]
    for cle, noeud in graphe.items():
        definition = OBJECT_INFO.get(noeud["class_type"])
        assert definition, f"{noeud['class_type']} absent de ComfyUI 0.36"
        entree = definition["input"]
        declares = {**entree.get("required", {}), **entree.get("optional", {})}
        assert set(entree.get("required", {})) <= set(noeud["inputs"]), (cle, noeud["class_type"])
        for champ, valeur in noeud["inputs"].items():
            assert champ in declares, (cle, champ)
            if isinstance(valeur, list):
                # Un lien : le nœud source existe, et sa sortie a le type attendu.
                source = OBJECT_INFO[graphe[valeur[0]]["class_type"]]
                sortie = source["output"][valeur[1]]
                attendu = declares[champ][0]
                assert attendu in ("*", sortie), (cle, champ, sortie, attendu)
                continue
            choix = _choix(declares[champ])
            if choix is not None and champ not in CHAMPS_FICHIER:
                assert str(valeur) in choix or valeur in choix, (cle, champ, valeur)
    sortie = CONSTRUCTEURS[identifiant]()["sortie"]
    assert OBJECT_INFO[graphe[sortie["noeud"]]["class_type"]]["output_node"]


@pytest.mark.parametrize("identifiant", list(CONSTRUCTEURS))
async def test_le_diagnostic_ne_manque_que_des_poids_nommes_et_sources(identifiant):
    profil = {**normaliser(CONSTRUCTEURS[identifiant]()), "version": "essai"}
    # Ce soir, sur la machine : aucun poids sonore n'est téléchargé.
    diagnostic = await diagnostiquer(profil, OBJECT_INFO)
    assert not diagnostic["disponible"]
    assert all("est absent des choix installés" in p for p in diagnostic["problemes"]), diagnostic["problemes"]
    requis = fichiers_requis(profil)
    assert {r["fichier"] for r in requis} == {p.split(" : ")[1].split(" est absent")[0] for p in diagnostic["problemes"]}
    assert all(r["dossier"] and r["source"].startswith("https://huggingface.co/") for r in requis)
    # Les poids posés, le même profil est prêt : rien d'autre ne manque.
    assert (await diagnostiquer(profil, installe(OBJECT_INFO, profil)))["disponible"]


def test_medium_ne_reecrit_pas_le_texte():
    profil = normaliser(CONSTRUCTEURS["sa3-medium"]())
    classes = {n["class_type"] for n in profil["graphe"].values()}
    assert not classes & {"TextGenerate", "ComfySwitchNode", "StringReplace", "JsonExtractString", "PrimitiveStringMultiline"}
    assert "qwen3.5_2b_bf16.safetensors" not in json.dumps(profil)
    graphe = composer(profil, prompt="TrackType: SFX. Wooden door creaks open", secondes=4.5, graine=7)
    positif = graphe[graphe["6"]["inputs"]["positive"][0]]
    assert positif["class_type"] == "CLIPTextEncode" and positif["inputs"]["text"] == "TrackType: SFX. Wooden door creaks open"


def test_small_sfx_est_le_graphe_de_medium_a_8_pas_et_guidage_1():
    small, medium = CONSTRUCTEURS["sa3-small-sfx"](), CONSTRUCTEURS["sa3-medium"]()
    assert small["graphe"]["1"]["inputs"]["ckpt_name"] == "stable_audio_3_small_sfx.safetensors"
    assert {k: v["class_type"] for k, v in small["graphe"].items()} == {k: v["class_type"] for k, v in medium["graphe"].items()}
    echantillonneur = small["graphe"]["6"]["inputs"]
    assert (echantillonneur["steps"], echantillonneur["cfg"]) == (8, 1)
    assert "prompt_negatif" not in small["liaisons"]


def test_ace_step_n_a_qu_un_encodeur_et_ne_demande_pas_de_codes_audio():
    profil = CONSTRUCTEURS["ace-step-15-turbo"]()
    assert {r["fichier"] for r in fichiers_requis(profil)} == {
        "acestep_v1.5_turbo.safetensors", "qwen_0.6b_ace15.safetensors", "ace_1.5_vae.safetensors"}
    assert "qwen_1.7b" not in json.dumps(profil)
    assert profil["graphe"]["5"]["inputs"]["generate_audio_codes"] is False


def test_yue2_ecrit_sa_partition_avant_la_musique():
    graphe = CONSTRUCTEURS["yue2-int8"]()["graphe"]
    abc = graphe["4"]["inputs"]["abc"]
    assert graphe[abc[0]]["class_type"] == "PreviewAny" and graphe[graphe[abc[0]]["inputs"]["source"][0]]["class_type"] == "YuE2GenerateABC"
    assert {r["fichier"] for r in fichiers_requis(CONSTRUCTEURS["yue2-int8"]())} == {"yue2_3b_int8_convrot.safetensors"}


def test_chaque_fichier_nomme_a_sa_fiche():
    for construire in CONSTRUCTEURS.values():
        assert {r["fichier"] for r in fichiers_requis(construire())} <= set(FICHIERS)


# ── Les profils d'avant ─────────────────────────────────────────────────


def test_un_profil_sonore_d_avant_garde_sa_version():
    # Empreintes calculées par le code d'avant SN1, sur les profils des
    # essais AU14 et AU10 : relus sans migration, sans clé nouvelle.
    assert version_de(normaliser(profil_son())) == "719187c80f6e4f63868dee3591806c0de92883771465b329a01d1e401cb45290"
    assert version_de(normaliser(profil_audio())) == "23dabd8b3b880250bf02659779947bc7d3fd690518c58350af6e08961ffc1408"
    assert "duree_libre" not in normaliser(profil_son())


def test_un_profil_d_avant_refuse_toujours_une_duree_hors_liste():
    with pytest.raises(WorkflowRefuse, match="n’est pas déclarée"):
        composer(normaliser(profil_son()), prompt="vent", secondes=1.7)


# ── La durée libre ──────────────────────────────────────────────────────


def test_la_duree_libre_accepte_seize_mesures_a_90_bpm():
    profil = normaliser(CONSTRUCTEURS["ace-step-15-turbo"]())
    secondes = round(16 * 4 * 60 / 90, 2)
    assert secondes == 42.67
    graphe = composer(profil, prompt="exploration, lute, fiddle", secondes=secondes, tempo=90, mesure=4)
    assert graphe["7"]["inputs"]["seconds"] == 42.67 and graphe["5"]["inputs"]["duration"] == 42.67
    # Une durée de la liste reste acceptée.
    assert composer(profil, prompt="x", secondes=60)["7"]["inputs"]["seconds"] == 60


@pytest.mark.parametrize("secondes", [1.99, 600.5, float("nan"), True, "42"])
def test_la_duree_libre_refuse_hors_intervalle(secondes):
    profil = normaliser(CONSTRUCTEURS["ace-step-15-turbo"]())
    # 2 s, non 10 : un jingle par défaut (2 mesures + 1 de marge, 90 BPM) dure
    # 8 s, sous l'ancien minimum (correction du 18 septembre 2026).
    with pytest.raises(WorkflowRefuse, match="de 2 s à 600 s"):
        composer(profil, prompt="x", secondes=secondes)


@pytest.mark.parametrize("modifier, raison", [
    (lambda p: p.update(duree_libre={"min": 5}), "min"),
    (lambda p: p.update(duree_libre={"min": 30, "max": 10}), "min"),
    (lambda p: p.update(duree_libre={"min": 1, "max": 900}), "600"),
    (lambda p: p.update(duree_libre=[1, 60]), "min"),
    (lambda p: p.update(duree_libre={"min": 20, "max": 120}), "tenir"),
    (lambda p: p["liaisons"].pop("secondes") and p.update(durees=[5]), "liaison des secondes"),
])
def test_une_duree_libre_mal_declaree_est_refusee(modifier, raison):
    brut = CONSTRUCTEURS["sa3-small-sfx"]()
    modifier(brut)
    with pytest.raises(WorkflowRefuse, match=raison):
        normaliser(brut)


def test_seul_un_profil_sonore_declare_duree_libre_et_musique():
    from tests.test_au7_au8 import profil
    with pytest.raises(WorkflowRefuse, match="sonore"):
        normaliser({**profil(), "duree_libre": {"min": 1, "max": 5}})
    image = profil()
    image["liaisons"]["tempo"] = [{"noeud": "3", "champ": "steps"}]
    with pytest.raises(WorkflowRefuse, match="profil sonore"):
        normaliser(image)


# ── Paroles, tempo, tonalité, mesure ────────────────────────────────────


def test_les_reglages_de_musique_atteignent_leur_noeud():
    profil = normaliser(CONSTRUCTEURS["ace-step-15-turbo"]())
    graphe = composer(profil, prompt="battle, drums", secondes=60, paroles="[Build]\n[Drop]", tempo=140,
        tonalite="F# minor", mesure=3, graine=11, options={"langue": "fr"})
    encodeur = graphe["5"]["inputs"]
    assert (encodeur["tags"], encodeur["lyrics"], encodeur["bpm"], encodeur["keyscale"], encodeur["timesignature"]) == (
        "battle, drums", "[Build]\n[Drop]", 140, "F# minor", "3")
    assert encodeur["language"] == "fr" and encodeur["seed"] == graphe["8"]["inputs"]["seed"] == 11
    yue = composer(normaliser(CONSTRUCTEURS["yue2-int8"]()), prompt="English, tavern folk, male vocal", secondes=90, paroles="[Verse]\nAle!")
    assert yue["2"]["inputs"]["lyrics"] == yue["4"]["inputs"]["lyrics"] == "[Verse]\nAle!"
    assert yue["2"]["inputs"]["style"] == yue["4"]["inputs"]["style"] == "English, tavern folk, male vocal"
    assert yue["4"]["inputs"]["max_duration"] == 90


def test_une_valeur_omise_laisse_celle_du_graphe():
    graphe = composer(normaliser(CONSTRUCTEURS["ace-step-15-turbo"]()), prompt="x", secondes=30)
    assert (graphe["5"]["inputs"]["bpm"], graphe["5"]["inputs"]["timesignature"]) == (90, "4")


@pytest.mark.parametrize("reglage, raison", [
    ({"tempo": 301}, "tempo"), ({"tempo": 90.5}, "tempo"), ({"tempo": True}, "tempo"),
    ({"tonalite": "H minor"}, "tonalité"), ({"tonalite": "d minor"}, "tonalité"),
    ({"mesure": 5}, "2, 3, 4 ou 6"), ({"mesure": "4"}, "2, 3, 4 ou 6"),
    ({"paroles": 12}, "paroles"), ({"paroles": "a" * 10_001}, "paroles"),
])
def test_une_valeur_de_musique_invalide_est_refusee_en_clair(reglage, raison):
    with pytest.raises(WorkflowRefuse, match=raison):
        composer(normaliser(CONSTRUCTEURS["ace-step-15-turbo"]()), prompt="x", secondes=30, **reglage)


def test_un_reglage_de_musique_non_relie_est_refuse():
    profil = normaliser(CONSTRUCTEURS["sa3-small-sfx"]())
    with pytest.raises(WorkflowRefuse, match="ne reçoit pas de tempo"):
        composer(profil, prompt="x", secondes=1, tempo=90)
    with pytest.raises(WorkflowRefuse, match="ne reçoit pas de tonalité"):
        composer(normaliser(CONSTRUCTEURS["yue2-int8"]()), prompt="x", secondes=60, tonalite="D minor")


def test_les_tonalites_sont_celles_d_ace_step():
    declarees = OBJECT_INFO["TextEncodeAceStepAudio1.5"]["input"]["required"]["keyscale"][1]["options"]
    assert sorted(TONALITES) == sorted(declarees)
    assert OBJECT_INFO["TextEncodeAceStepAudio1.5"]["input"]["required"]["timesignature"][1]["options"] == ["2", "3", "4", "6"]


# ── travaux_audio.preparer ──────────────────────────────────────────────


class ComfyMusique(ComfySon):
    """Le double d'AU14, avec l'object_info relevé et le nœud de sortie du profil."""

    def __init__(self, profil):
        super().__init__()
        self.informations = installe(OBJECT_INFO, profil)
        self.noeud_sortie = profil["sortie"]["noeud"]

    def repondre(self, requete):
        if requete.url.path.startswith("/history/") and self.termine:
            numero = requete.url.path.split("/")[-1]
            if numero in self.jobs:
                return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                    self.noeud_sortie: {"audio": [{"filename": "musique.flac", "subfolder": "asset-kitchen", "type": "output"}]}}}})
        return super().repondre(requete)


@pytest.fixture
async def musique(tmp_path, double):
    brut = CONSTRUCTEURS["ace-step-15-turbo"]()
    comfy = ComfyMusique(brut)
    atelier = Atelier(racine=tmp_path / "musique", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    garde = atelier.profils_workflow.importer(brut)
    atelier.travaux_audio.intervalle = .01
    yield atelier, comfy, garde
    await fermer(atelier)


async def test_preparer_fige_les_reglages_de_musique_et_les_envoie(musique):
    atelier, comfy, p = musique
    projet = atelier.bibliotheque.courant
    t = await atelier.travaux_audio.preparer(projet, {"cle": "exploration", "modele": p["modele"],
        "prompt": "exploration, acoustic folk ensemble", "secondes": 42.67, "paroles": "[Intro]\n[Instrumental]\n[Outro]",
        "tempo": 90, "tonalite": "D minor", "mesure": 4})
    envoi = t["snapshot_audio"]
    assert (envoi["secondes"], envoi["tempo"], envoi["tonalite"], envoi["mesure"]) == (42.67, 90, "D minor", 4)
    assert isinstance(envoi["graine"], int) and envoi["options"] == {"langue": "en"}
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini
    parti = comfy.envois[0]["prompt"]
    assert parti["5"]["inputs"]["lyrics"] == "[Intro]\n[Instrumental]\n[Outro]" and parti["5"]["inputs"]["timesignature"] == "4"
    assert parti["7"]["inputs"]["seconds"] == 42.67 and parti["5"]["inputs"]["keyscale"] == "D minor"
    assert parti["8"]["inputs"]["seed"] == parti["5"]["inputs"]["seed"] == envoi["graine"]
    # La provenance du son garde ce qui est parti, graine comprise.
    son = atelier.sons.lire(projet, fini["son"])
    assert son["provenance"]["envoi"]["graine"] == envoi["graine"] and son["provenance"]["envoi"]["tempo"] == 90


async def test_preparer_sans_reglages_fige_ceux_du_graphe(musique):
    atelier, comfy, p = musique
    t = await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {"cle": "defauts", "modele": p["modele"],
        "prompt": "menu, calm", "secondes": 30})
    envoi = t["snapshot_audio"]
    assert (envoi["paroles"], envoi["tempo"], envoi["tonalite"], envoi["mesure"]) == ("[Instrumental]", 90, "D minor", 4)
    assert "tempo" not in t["demande"]


@pytest.mark.parametrize("reglage, raison", [
    ({"tempo": 400}, "tempo"), ({"tonalite": "Do mineur"}, "tonalité"), ({"mesure": 7}, "mesure"),
    ({"secondes": 1}, "de 2 s à 600 s"), ({"secondes": 601}, "de 2 s à 600 s"),
])
async def test_preparer_refuse_en_clair_avant_tout_appel(musique, reglage, raison):
    atelier, comfy, p = musique
    with pytest.raises(WorkflowRefuse, match=raison):
        await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {"cle": "refus", "modele": p["modele"],
            "prompt": "x", "secondes": 30, **reglage})
    assert not comfy.envois and not atelier.travaux.lister(atelier.bibliotheque.courant)


async def test_preparer_refuse_un_reglage_inconnu_ou_non_relie(musique, sonore_bruitage):
    atelier, _, p = musique
    with pytest.raises(TravailRefuse, match="inconnu"):
        await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {"cle": "x", "modele": p["modele"],
            "prompt": "x", "secondes": 30, "tirages": 8})
    bruitage = atelier.profils_workflow.importer(sonore_bruitage)
    with pytest.raises(WorkflowRefuse, match="ne reçoit pas de paroles"):
        await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {"cle": "y", "modele": bruitage["modele"],
            "prompt": "x", "secondes": 1, "paroles": "la la"})


@pytest.fixture
def sonore_bruitage():
    return CONSTRUCTEURS["sa3-small-sfx"]()


async def test_une_demande_d_avant_garde_son_empreinte(musique):
    atelier, _, p = musique
    brut = {"cle": "avant", "modele": p["modele"], "prompt": "x", "secondes": 30, "nom": "", "options": {}}
    t = await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, dict(brut))
    d = {"cle": "avant", "modele": p["modele"], "prompt": "x", "prompt_negatif": "", "secondes": 30,
         "options": {}, "nom": "", "livrer_provisoire": False}
    assert t["empreinte"] == _hash(_json({"demande": d, "acteur": "auteur"}))
