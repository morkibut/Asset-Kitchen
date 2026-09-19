"""SN1 : installer les méthodes sonores en un geste, sans ComfyUI —
`/object_info` est doublé (le relevé réel de tests/object_info_son.json, plus
chaque fichier des cinq moteurs posé dans les bons chargeurs)."""
import copy

import httpx
import pytest

from atelier.audio.graphes import CONSTRUCTEURS, FAMILLES as MOTEURS_PAR_FAMILLE, SECOURS
from atelier.domaine.son import FAMILLES_SON
from atelier.domaine.workflow import normaliser
from atelier.services import Atelier
from atelier.services.installation_son import installer_depuis
from tests.test_au7_au8 import raccorder
from tests.test_au14_generation import ComfySon, fermer, lancer
from tests.test_sn1_profils_son import OBJECT_INFO, installe


class ComfySortieChoisie(ComfySon):
    """Le double d'AU14, dont le nœud de sortie n'est pas figé à « 5 » : les
    profils sonores de SN1 sortent chacun par leur propre nœud."""

    def repondre(self, requete):
        if requete.url.path.startswith("/history/") and self.termine:
            numero = requete.url.path.split("/")[-1]
            if numero in self.jobs:
                graphe = self.jobs[numero]["prompt"]
                noeud = next(i for i, n in graphe.items() if n["class_type"] == "SaveAudio")
                return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                    noeud: {"audio": [{"filename": "son.wav", "subfolder": "asset-kitchen", "type": "output"}]}}}})
        return ComfySon.repondre(self, requete)


def object_info_complet():
    """`/object_info` d'une machine qui a posé les cinq moteurs."""
    info = OBJECT_INFO
    for construire in CONSTRUCTEURS.values():
        info = installe(info, normaliser(construire()))
    return info


@pytest.fixture
async def son(tmp_path, double):
    comfy = ComfySortieChoisie()
    comfy.informations = object_info_complet()
    atelier = Atelier(racine=tmp_path / "installation-son", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    atelier.travaux_audio.intervalle = .01
    yield atelier, comfy
    await fermer(atelier)


# ── Tout est présent ────────────────────────────────────────────────────


async def test_installer_pose_les_cinq_profils_quand_tout_est_present(son):
    atelier, comfy = son
    resultats = await atelier.installation_son.installer()
    assert set(resultats) == set(CONSTRUCTEURS)
    assert all(r["installe"] and r["profil"]["nature"] == "audio" for r in resultats.values())
    assert {p["identifiant"] for p in atelier.profils_workflow.lister()} == set(CONSTRUCTEURS)


async def test_installer_deux_fois_sans_rien_changer_ne_cree_pas_de_version(son):
    atelier, comfy = son
    premiere = await atelier.installation_son.installer()
    seconde = await atelier.installation_son.installer()
    for identifiant in CONSTRUCTEURS:
        assert seconde[identifiant]["profil"]["version"] == premiere[identifiant]["profil"]["version"]
        # Aucune écriture : la même date de création revient à la relecture.
        assert seconde[identifiant]["profil"]["cree_le"] == premiere[identifiant]["profil"]["cree_le"]
    assert len(atelier.profils_workflow.lister()) == len(CONSTRUCTEURS)


async def test_installer_peut_se_limiter_a_des_moteurs_choisis(son):
    atelier, comfy = son
    resultats = await atelier.installation_son.installer(identifiants=["sa3-small-sfx"])
    assert set(resultats) == {"sa3-small-sfx"}
    assert {p["identifiant"] for p in atelier.profils_workflow.lister()} == {"sa3-small-sfx"}


# ── Un fichier manque ────────────────────────────────────────────────────


async def test_un_fichier_retire_laisse_le_moteur_non_installe_avec_sa_raison(son):
    atelier, comfy = son
    info = copy.deepcopy(comfy.informations)
    choix = info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
    choix.remove("yue2_3b_int8_convrot.safetensors")
    resultat = installer_depuis(atelier.profils_workflow, info, identifiants=["yue2-int8"])
    assert resultat["yue2-int8"]["installe"] is False
    assert resultat["yue2-int8"]["manque"] == [{"nom": "le modèle YuE2 (chansons)",
        "fichier": "yue2_3b_int8_convrot.safetensors", "dossier": "checkpoints",
        "source": "https://huggingface.co/Comfy-Org/YuE2/resolve/main/checkpoints/yue2_3b_int8_convrot.safetensors"}]
    # Rien n'est posé pour un moteur incomplet.
    assert not atelier.profils_workflow.lister()


async def test_un_moteur_manquant_ne_bloque_pas_les_autres(son):
    atelier, comfy = son
    info = copy.deepcopy(comfy.informations)
    info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0].remove("yue2_3b_int8_convrot.safetensors")
    resultats = installer_depuis(atelier.profils_workflow, info)
    # « yue2-partition-jouee » (SN9) partage le même fichier de poids que
    # « yue2-int8 » : son absence le rend indisponible aussi.
    sans_le_fichier = {"yue2-int8", "yue2-partition-jouee"}
    assert all(resultats[i]["installe"] is False for i in sans_le_fichier)
    assert all(resultats[i]["installe"] for i in CONSTRUCTEURS if i not in sans_le_fichier)


# ── Un bruitage depuis une phrase, sur le profil installé ───────────────


async def test_bruitage_se_prepare_depuis_le_profil_installe_sans_import_manuel(son):
    atelier, comfy = son
    installes = await atelier.installation_son.installer(identifiants=["sa3-small-sfx"])
    modele = installes["sa3-small-sfx"]["profil"]["modele"]
    t = await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {"cle": "porte",
        "modele": modele, "prompt": "TrackType: SFX. Wooden door creaks open", "secondes": 3})
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini
    parti = comfy.envois[0]["prompt"]
    positif = parti[parti["6"]["inputs"]["positive"][0]]
    assert positif["inputs"]["text"] == "TrackType: SFX. Wooden door creaks open"
    assert parti["5"]["inputs"]["seconds"] == 3


# ── Les moteurs par défaut, par famille ──────────────────────────────────


async def test_moteurs_par_famille_lit_ce_qui_est_installe(son):
    atelier, comfy = son
    projet = atelier.bibliotheque.courant
    familles = atelier.installation_son.moteurs_par_famille(projet)
    assert familles["bruitage"]["moteur"] is None and "raison" in familles["bruitage"]
    # « secours » n'est plus une famille du jeu ; l'interface a sfxr sans
    # installation, la voix n'a encore aucun moteur, dit comme tel.
    assert set(familles) == {"bruitage", "interface", "ambiance", "musique", "jingle", "chanson", "voix"}
    assert familles["interface"]["moteur"] == "sfxr"
    assert familles["voix"]["moteur"] is None and "raison" in familles["voix"]
    await atelier.installation_son.installer(identifiants=["sa3-small-sfx", "ace-step-15-turbo"])
    familles = atelier.installation_son.moteurs_par_famille(projet)
    assert familles["bruitage"]["moteur"] == "sa3-small-sfx" and familles["ambiance"]["moteur"] == "sa3-small-sfx"
    assert familles["musique"]["moteur"] == "ace-step-15-turbo" and familles["jingle"]["moteur"] == "ace-step-15-turbo"
    assert familles["chanson"]["moteur"] is None
    # Ce que l'écran propose : les moteurs qui savent faire ce genre de son.
    assert familles["bruitage"]["possibles"] == ["sa3-small-sfx", "sa-open-1", "sa3-medium"]
    assert "yue2-int8" not in familles["ambiance"]["possibles"]
    assert familles["interface"]["possibles"] == [] and familles["voix"]["possibles"] == []


async def test_moteurs_par_famille_suit_le_choix_de_l_univers(son):
    """Correction du 18 septembre 2026 : la route et l'outil MCP appellent
    désormais le même choix que SN2 (`ServiceTravauxAudio._moteur_de_famille`
    — l'univers d'abord), pas une liste à part."""
    atelier, comfy = son
    projet = atelier.bibliotheque.courant
    await atelier.installation_son.installer(identifiants=["sa3-small-sfx", "ace-step-15-turbo"])
    atelier.univers.regler_univers(projet, son={"moteurs": {"bruitage": "ace-step-15-turbo"}})
    familles = atelier.installation_son.moteurs_par_famille(projet)
    assert familles["bruitage"]["moteur"] == "ace-step-15-turbo"


def test_une_seule_liste_des_sept_familles():
    """Correction du 18 septembre 2026 : les sept clés de `FAMILLES_SON`
    définies en un seul endroit ; « secours » n'en fait plus partie, c'est une
    liste de moteurs de repli à part. L'interface a sfxr pour seul moteur ; la
    voix n'en a encore aucun."""
    assert set(MOTEURS_PAR_FAMILLE) == set(FAMILLES_SON) == {
        "bruitage", "interface", "ambiance", "musique", "jingle", "chanson", "voix"}
    assert MOTEURS_PAR_FAMILLE["interface"] == ("sfxr",) and MOTEURS_PAR_FAMILLE["voix"] == ()
    assert "secours" not in MOTEURS_PAR_FAMILLE
    assert SECOURS == ("sa3-medium", "sa-open-1")


# ── Le diagnostic nomme ce qui manque ────────────────────────────────────


async def test_diagnostic_sonore_nomme_le_fichier_le_dossier_et_la_source(son):
    atelier, comfy = son
    info = copy.deepcopy(comfy.informations)
    info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0].remove("stable_audio_3_small_sfx.safetensors")
    comfy.informations = info
    profil = normaliser(CONSTRUCTEURS["sa3-small-sfx"]())
    diagnostic = await atelier.profils_workflow.fabrique_moteur().diagnostiquer_profil(profil)
    manque = atelier.installation_son.diagnostic_sonore(profil, diagnostic)
    assert manque == [{"nom": "le modèle Stable Audio 3 Small-SFX (bruitages et ambiances)",
        "fichier": "stable_audio_3_small_sfx.safetensors", "dossier": "checkpoints",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-3"}]


async def test_diagnostic_sonore_retrouve_le_fichier_sous_un_autre_dossier_et_une_autre_casse(son):
    """Correction du 18 septembre 2026 : la fiche se retrouve par le même
    motif que l'installation (nom de base, insensible à la casse, quel que
    soit le dossier) — pas une égalité exacte contre le texte du problème."""
    atelier, comfy = son
    profil = normaliser(CONSTRUCTEURS["sa3-small-sfx"]())
    diagnostic = {"disponible": False, "problemes": [
        "CheckpointLoaderSimple / ckpt_name : D:\\modeles\\checkpoints\\STABLE_AUDIO_3_SMALL_SFX.safetensors "
        "est absent des choix installés."]}
    manque = atelier.installation_son.diagnostic_sonore(profil, diagnostic)
    assert manque == [{"nom": "le modèle Stable Audio 3 Small-SFX (bruitages et ambiances)",
        "fichier": "stable_audio_3_small_sfx.safetensors", "dossier": "checkpoints",
        "source": "https://huggingface.co/Comfy-Org/stable-audio-3"}]


# ── Un workflow collé par l'auteur marche comme avant ────────────────────


async def test_un_workflow_colle_marche_comme_avant(son):
    from tests.test_au14_generation import preparer, profil_son
    atelier, comfy = son
    p = profil_son()
    comfy.declarer(p)
    garde = atelier.profils_workflow.importer(p)
    t = await preparer(atelier, garde)
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini
