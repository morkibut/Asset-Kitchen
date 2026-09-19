"""SN9 · La partition de YuE2 en deux temps : l'écrire, puis la jouer.

Le calcul ComfyUI est doublé (même famille de double qu'AU14 et SN1 :
`tests/test_au7_au8.py::ComfyDouble`, `tests/test_au14_generation.py::ComfySon`) :
aucun envoi réel, rien de payé. Un double répond soit à `PreviewAny` (le
premier étage, un texte), soit à `SaveAudio` (le second, un fichier), selon
ce que le graphe envoyé contient — comme `ComfySortieChoisie` le fait déjà
pour SN1.
"""
from __future__ import annotations

import httpx
import pytest

from atelier.audio.graphes import stable_audio_3_small_sfx, yue2_depuis_partition, yue2_partition
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from tests.test_au7_au8 import raccorder
from tests.test_au14_generation import ComfySon, fermer, lancer

ABC_RENDU = "X:1\nT:Tavern Song\nM:6/8\nK:C\nCDE FGA|"


def _declarer(comfy, profil):
    """Comme `ComfyDouble.declarer`, sans son égalisation propre au graphe
    jouet de `test_au7_au8.profil()` (un nœud « Checkpoint » qui n'existe
    pas ici : les profils sonores chargent par `CheckpointLoaderSimple`)."""
    for noeud in profil["graphe"].values():
        comfy.informations[noeud["class_type"]] = {"input": {"required": {c: ["ANY"] for c in noeud["inputs"]}},
            "output_node": noeud["class_type"].startswith("Save")}


class ComfyPartition(ComfySon):
    """Répond au premier étage de YuE2 (`PreviewAny`, un texte) ou au second
    (`SaveAudio`, un fichier), selon le nœud de sortie que le graphe envoyé
    contient réellement — jamais les deux à la fois, comme le geste en deux
    temps l'exige."""

    def repondre(self, requete):
        if requete.url.path.startswith("/history/") and self.termine:
            numero = requete.url.path.split("/")[-1]
            if numero in self.jobs:
                self.requetes.append((requete.method, requete.url.path))
                graphe = self.jobs[numero]["prompt"]
                apercu = next((i for i, n in graphe.items() if n["class_type"] == "PreviewAny"), None)
                if apercu is not None:
                    return httpx.Response(200, json={numero: {"status": {"completed": True},
                        "outputs": {apercu: {"text": [ABC_RENDU]}}}})
                # Le nœud de sortie du profil, jamais un numéro figé : chaque
                # profil sonore a le sien (SN1).
                sortie = next(i for i, n in graphe.items() if n["class_type"] == "SaveAudio")
                return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                    sortie: {"audio": [{"filename": "chanson.wav", "subfolder": "sons", "type": "output"}]}}}})
        return super().repondre(requete)


@pytest.fixture
async def yue2(tmp_path, double):
    comfy = ComfyPartition()
    atelier = Atelier(racine=tmp_path / "yue2-partition", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    p2 = yue2_depuis_partition(checkpoint="yue2_3b_int8_convrot.safetensors")
    _declarer(comfy, p2)
    p1 = yue2_partition(checkpoint="yue2_3b_int8_convrot.safetensors")
    _declarer(comfy, p1)
    comfy.informations["PreviewAny"]["output_node"] = True  # ne commence pas par « Save »
    installe = atelier.profils_workflow.importer(p2)
    atelier.travaux_audio.intervalle = .01
    yield atelier, comfy, installe
    await fermer(atelier)


# ── Écrire la partition : le seul premier étage ──────────────────────────


async def test_ecrire_envoie_le_seul_premier_etage_et_rend_le_texte(yue2):
    atelier, comfy, _ = yue2
    projet = atelier.bibliotheque.courant
    doc = await atelier.partition_son.ecrire(projet, {"prompt": "tavern drinking song, male voice, lively"})
    assert doc["partition"] == ABC_RENDU
    assert "tavern drinking song" in doc["texte_compose"]
    assert len(comfy.envois) == 1
    graphe = comfy.envois[0]["prompt"]
    assert any(n["class_type"] == "YuE2GenerateABC" for n in graphe.values())
    assert not any(n["class_type"] == "YuE2GenerateMusic" for n in graphe.values())
    assert not any(n["class_type"] == "KSampler" for n in graphe.values())  # aucun son n'est calculé
    # Une partition écrite se relit après coup (un rechargement de l'écran).
    assert atelier.partition_son.lire(projet, doc["identifiant"]) == doc


async def test_ecrire_sans_paroles_part_avec_le_style_seul(yue2):
    # Une chanson n'a pas de paroles de gabarit (à la différence d'un
    # instrumental) : sans paroles données, seul le style compose le texte.
    atelier, comfy, _ = yue2
    projet = atelier.bibliotheque.courant
    doc = await atelier.partition_son.ecrire(projet, {"prompt": "orchestral ballad, soft female vocal"})
    assert doc["paroles"] == ""
    envoi = comfy.envois[0]["prompt"]
    noeud_abc = next(n for n in envoi.values() if n["class_type"] == "YuE2GenerateABC")
    assert noeud_abc["inputs"]["lyrics"] == ""


async def test_ecrire_avec_des_paroles_les_envoie_telles_quelles(yue2):
    atelier, comfy, _ = yue2
    projet = atelier.bibliotheque.courant
    doc = await atelier.partition_son.ecrire(projet, {"prompt": "tavern song", "paroles": "[Verse]\nla la la\n"})
    assert doc["paroles"] == "[Verse]\nla la la\n"
    noeud_abc = next(n for n in comfy.envois[0]["prompt"].values() if n["class_type"] == "YuE2GenerateABC")
    assert noeud_abc["inputs"]["lyrics"] == "[Verse]\nla la la\n"


async def test_ecrire_refuse_sans_yue2_installe(tmp_path, double):
    comfy = ComfyPartition()
    atelier = Atelier(racine=tmp_path / "sans-yue2", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    with pytest.raises(TravailRefuse, match="installé"):
        await atelier.partition_son.ecrire(atelier.bibliotheque.courant, {"prompt": "tavern song"})
    await fermer(atelier)


async def test_ecrire_refuse_un_reglage_inconnu(yue2):
    atelier, _, _ = yue2
    with pytest.raises(TravailRefuse):
        await atelier.partition_son.ecrire(atelier.bibliotheque.courant, {"prompt": "x", "secondes": 30})


# ── Jouer cette partition : le seul second étage, texte inchangé ────────


async def test_jouer_envoie_exactement_le_texte_relu_sans_le_recomposer(yue2):
    atelier, comfy, installe = yue2
    projet = atelier.bibliotheque.courant
    partition_relue = "X:1\nT:Ma chanson corrigée\nM:6/8\nK:C\nC2D2 E2F2|"
    t = await atelier.travaux_audio.preparer(projet, {
        "cle": "jouer-1", "modele": installe["modele"], "famille": "chanson",
        "prompt": "tavern drinking song, male voice, lively",
        "paroles": "[Verse]\nla la la\n[Outro]\n", "partition": partition_relue, "secondes": 60}, "auteur")
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini.get("raison")
    envoye = comfy.envois[0]["prompt"]
    assert not any(n["class_type"] == "YuE2GenerateABC" for n in envoye.values())
    noeud_musique = next(n for n in envoye.values() if n["class_type"] == "YuE2GenerateMusic")
    assert noeud_musique["inputs"]["abc"] == partition_relue
    son = atelier.sons.lire(projet, fini["son"])
    assert son["provenance"]["envoi"]["partition"] == partition_relue
    assert son["provenance"]["famille"] == "chanson"


async def test_jouer_refuse_une_partition_vide(yue2):
    atelier, _, installe = yue2
    with pytest.raises(TravailRefuse, match="partition"):
        await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {
            "cle": "jouer-vide", "modele": installe["modele"], "famille": "chanson",
            "prompt": "tavern song", "partition": "   "}, "auteur")


async def test_partition_refusee_par_un_moteur_qui_ne_la_recoit_pas(yue2):
    atelier, comfy, _ = yue2
    projet = atelier.bibliotheque.courant
    autre = stable_audio_3_small_sfx(checkpoint="stable_audio_3_small_sfx.safetensors", encodeur="t5gemma_b_b_ul2.safetensors")
    _declarer(comfy, autre)
    installe_autre = atelier.profils_workflow.importer(autre)
    with pytest.raises(TravailRefuse, match="ne reçoit pas de partition"):
        await atelier.travaux_audio.preparer(projet, {
            "cle": "mauvais-moteur", "modele": installe_autre["modele"], "famille": "chanson",
            "prompt": "tavern song", "partition": "X:1\nK:C\nC|"}, "auteur")


async def test_jouer_reprend_exactement_le_style_et_les_paroles_de_l_ecriture(yue2):
    # Le second temps repart avec ce qui a servi au premier, conservé avec la
    # partition (`pour_jouer`) — jamais un style recomposé autrement, ni des
    # paroles retapées entre-temps.
    atelier, comfy, _ = yue2
    projet = atelier.bibliotheque.courant
    doc = await atelier.partition_son.ecrire(projet, {"prompt": "tavern song", "paroles": "", "tempo": 92})
    assert doc["tempo"] == 92
    assert doc["pour_jouer"]["texte_relu"] == doc["texte_compose"]
    assert doc["pour_jouer"]["paroles"] == doc["paroles"] == ""
    t = await atelier.travaux_audio.preparer(projet, {**doc["pour_jouer"], "cle": "jouer-pareil",
        "partition": "X:1\nK:C\nC2D2|", "secondes": 60}, "auteur")
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini.get("raison")
    musique = next(n for n in comfy.envois[1]["prompt"].values() if n["class_type"] == "YuE2GenerateMusic")
    ecrit = next(n for n in comfy.envois[0]["prompt"].values() if n["class_type"] == "YuE2GenerateABC")
    assert musique["inputs"]["style"] == ecrit["inputs"]["style"] == doc["texte_compose"]
    assert musique["inputs"]["lyrics"] == ecrit["inputs"]["lyrics"] == ""


# ── L'agent : « Écrire la partition » passe par le cadre de délégation ──


async def _outil_refuse(serveur, projet, motif):
    from mcp.server.mcpserver.exceptions import ToolError
    with pytest.raises(ToolError, match=motif):
        await serveur.call_tool("write_song_score", {"project": projet, "prompt": "tavern song"})


async def test_l_agent_ne_passe_pas_un_cadre_qui_ne_permet_pas_yue2(yue2):
    from atelier.mcp.serveur import creer_serveur
    atelier, comfy, installe = yue2
    projet = atelier.bibliotheque.courant
    serveur = creer_serveur(atelier)
    atelier.travaux.regler_cadre(projet, {"modeles_audio": ["sfxr"]})
    await _outil_refuse(serveur, projet, "autorisée")
    atelier.travaux.regler_cadre(projet, {"autoriser_local": False})
    await _outil_refuse(serveur, projet, "local")
    atelier.travaux.regler_cadre(projet, {"plafond_secondes_audio": 0})
    await _outil_refuse(serveur, projet, "temps de calcul sonore")
    assert not comfy.envois
    # L'auteur, lui, écrit sa partition quel que soit le cadre de l'agent.
    atelier.travaux.regler_cadre(projet, {"modeles_audio": ["sfxr"], "autoriser_local": False, "plafond_secondes_audio": 0})
    assert (await atelier.partition_son.ecrire(projet, {"prompt": "tavern song"}))["partition"] == ABC_RENDU


async def test_le_temps_de_la_partition_s_impute_a_l_agent(yue2, monkeypatch):
    import itertools

    from atelier.mcp.serveur import creer_serveur
    from atelier.services import partition_son
    atelier, comfy, installe = yue2
    # Une horloge qui avance de cinq secondes à chaque lecture : le double
    # répond d'un coup, ComfyUI prendrait des dizaines de secondes.
    tic = itertools.count(0, 5)
    monkeypatch.setattr(partition_son, "_horloge", lambda: float(next(tic)))
    projet = atelier.bibliotheque.courant
    serveur = creer_serveur(atelier)
    # Permis par le nom du moteur qui la jouera, et un plafond minuscule : la
    # première partition passe, son temps compte, la seconde est refusée.
    atelier.travaux.regler_cadre(projet, {"modeles_audio": [installe["modele"]], "plafond_secondes_audio": 1e-9})
    ecrit = await serveur.call_tool("write_song_score", {"project": projet, "prompt": "tavern song", "tempo": 92})
    assert not ecrit.is_error, ecrit
    assert atelier.travaux.temps_sonore_de_l_agent(projet) > 0
    await _outil_refuse(serveur, projet, "temps de calcul sonore")
    assert len(comfy.envois) == 1
    # Ce qu'il faut pour la jouer est rendu tel quel, prêt pour prepare_audio.
    pour_jouer = ecrit.structured_content["pour_jouer"]
    atelier.travaux.regler_cadre(projet, {"modeles_audio": [installe["modele"]]})
    prepare = await serveur.call_tool("prepare_audio", {"project": projet,
        "request": {**pour_jouer, "cle": "jouer-agent", "secondes": 60}})
    assert not prepare.is_error, prepare


async def test_partition_hors_famille_est_refusee(yue2):
    atelier, _, _ = yue2
    with pytest.raises(TravailRefuse, match="famille"):
        await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {
            "cle": "sans-famille", "modele": "ComfyUI:essai-image@x", "prompt": "x", "partition": "X:1\nK:C\nC|"}, "auteur")
