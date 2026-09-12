"""Aucun moteur sonore fantôme ; un moteur déclaré garde sa protection GPU."""
import asyncio

from atelier.services import Atelier
from tests.conftest import FournisseurDouble, AnimateurMuet

def profil_audio():
    return {"identifiant": "bruitage", "nom": "Bruitages", "nature": "audio", "graphe": {
        "1": {"class_type": "TexteSon", "inputs": {"prompt": "vent", "seconds": 2}},
        "2": {"class_type": "SaveAudio", "inputs": {"audio": ["1", 0]}}},
        "liaisons": {"prompt": [{"noeud": "1", "champ": "prompt"}], "secondes": [{"noeud": "1", "champ": "seconds"}]},
        "parametres": {}, "formats": [], "durees": [2], "sortie": {"noeud": "2", "champ": "audio"}}

def test_aucune_observation_sonore_sans_profil_ni_travail(atelier):
    assert atelier.profils_workflow.lister() == []
    assert atelier.file_locale.lister()["etapes"] == []
    assert not atelier.file_locale._moteurs

async def test_moteur_sonore_configure_inconnu_bloque_toujours_gpu(atelier):
    observe = asyncio.Event()
    calculs = []
    class SonInconnu:
        nom, adresse = "ComfyUI", "http://son.test"
        async def observer_ressource(self):
            observe.set()
            return {"etat": "inconnu", "travaux": [], "raison": "Occupation du son inconnue"}
    atelier.profils_workflow.fabrique_moteur = SonInconnu
    atelier.profils_workflow.importer(profil_audio())  # import après démarrage
    async def libre(): return {"etat": "disponible", "travaux": [], "raison": "3D libre"}
    async def calcul(e): calculs.append(e); return {}
    file = atelier.file_locale
    file.inscrire_moteur("3d", "3D", libre)
    file.inscrire_executeur("modele3d", calcul)
    e = file.preparer("test-3d", nature="modele3d", moteur="3d", modele="3D:test", projet=None, acteur="auteur", parametres={})
    await file.lancer(e["identifiant"])
    try:
        await asyncio.wait_for(observe.wait(), 2)
        assert not calculs
        observations = await file.observer(rafraichir=False)
        assert any(o["etat"] == "inconnu" and o["nom"] == "ComfyUI" for o in observations)
    finally: await file.fermer()

async def test_profil_audio_reouvert_et_adresse_changee_ne_perdent_pas_la_garde(atelier, tmp_path):
    atelier.profils_workflow.importer(profil_audio())
    autre = Atelier(racine=tmp_path, fabrique_fournisseur=FournisseurDouble, fabrique_animateur=AnimateurMuet)
    assert len(autre.file_locale._moteurs) == 1
    class AutreAdresse:
        nom, adresse = "ComfyUI", "http://autre.test"
        async def observer_ressource(self): raise AssertionError("Ne pas sonder une adresse différente à la place de celle gardée")
    autre.profils_workflow.fabrique_moteur = AutreAdresse
    observations = await autre.file_locale.observer()
    assert observations[0]["etat"] == "inconnu" and "Rétablissez" in observations[0]["raison"]
