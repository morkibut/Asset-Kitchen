"""Relevé le 10 octobre 2026 : deux clips de la mort du nain arrivés « réussie »
(`0-brut.mp4` et `0-images/` en place), et leurs travaux restés « à reprendre »
— *le suivi a été interrompu*.

La veille de la file locale a dépassé l'échéance du calcul pendant que l'atelier
**encaissait** le rendu (téléchargement, extraction des images, contrôle
d'arrivée dans un fil à part) : elle a annulé la tâche de l'étape. Le fil a
fini d'écrire le clip réussi, mais l'annulation de l'étape remontait jusqu'au
travail qui l'attendait (`attendre_fin` → `asyncio.shield`), et le travail
mourait sans rien écrire : resté `en_cours` sur le disque, relu « à reprendre ».
"""

import asyncio
from dataclasses import replace

import pytest

from atelier.domaine.animation import Tarification
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import MELE, AnimateurDouble, clip_mp4

LOCAL = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))


async def _disponible():
    return {"etat": "disponible", "travaux": [], "temperature": "inconnue"}


@pytest.fixture
async def atelier_local(tmp_path, double):
    animateur = AnimateurDouble()
    animateur.modeles = [LOCAL]
    animateur.observer_ressource = _disponible
    animateur.octets = clip_mp4()
    animateur.facture = 0
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    await atelier.ouvrir()
    yield atelier, animateur
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.file_locale.fermer()


def _annuler_l_etape_pendant_l_encaissement(atelier):
    """Rejoue la veille : l'échéance tombe pendant le contrôle d'arrivée, qui
    tourne dans un fil. La tâche de l'étape est annulée ; le fil, lui, finit."""
    boucle = asyncio.get_running_loop()
    controler = atelier.animation._controler_a_l_arrivee

    def controler_puis_etre_coupe(generation):
        etape = atelier.animation.etape_locale(generation.identifiant)
        tache = atelier.file_locale._taches[etape["identifiant"]]
        boucle.call_soon_threadsafe(tache.cancel)
        import time
        time.sleep(0.2)
        return controler(generation)

    atelier.animation._controler_a_l_arrivee = controler_puis_etre_coupe


async def _preparer(atelier, cle="mort-du-nain"):
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(image_sujet(), "Nain", projet=projet)["asset"]["identifiant"]
    t = await atelier.travaux.preparer(projet, {"cle": cle, "reference_asset": reference,
        "modele_video": LOCAL.identifiant, "prompt_video": "The dwarf collapses"}, source_libre=True)
    return projet, t


async def test_un_clip_reussi_pendant_que_la_veille_coupe_l_etape_termine_le_travail(atelier_local):
    atelier, animateur = atelier_local
    _annuler_l_etape_pendant_l_encaissement(atelier)
    projet, t = await _preparer(atelier)
    await atelier.travaux.demarrer(projet, t["identifiant"])
    await atelier.travaux.attendre_tout()
    await atelier.file_locale.attendre_tout()

    clip = atelier.animation.lire(t["identifiant"] + "-video")
    assert clip.statut.value == "reussie" and clip.clip.images == 6
    fini = atelier.travaux.lire(projet, t["identifiant"])
    assert fini["etat"] == "termine", fini
    assert len(animateur.soumissions) == 1


async def test_reprendre_un_travail_dont_le_clip_est_reussi_conclut_sans_rien_renvoyer(atelier_local):
    atelier, animateur = atelier_local
    projet, t = await _preparer(atelier, "reprise")
    await atelier.travaux.demarrer(projet, t["identifiant"])
    await atelier.travaux.attendre_tout()
    await atelier.file_locale.attendre_tout()
    # L'état exact du relevé : étape locale arrêtée (« échoue », reprise
    # automatique usée), clip réussi avec ses fichiers, travail resté en cours.
    clip = atelier.animation.lire(t["identifiant"] + "-video")
    assert clip.statut.value == "reussie"
    etape = atelier.animation.etape_locale(clip.identifiant)
    atelier.file_locale.modifier(etape["identifiant"], etat="echoue",
        raison="Échéance dépassée : la reprise automatique a déjà été tentée sans succès.")
    brut = atelier.travaux._brut(projet, t["identifiant"])
    brut.update(etat="en_cours", etape="file_locale", raison=None)
    atelier.travaux._garder(brut)
    assert atelier.travaux.lire(projet, t["identifiant"])["etat"] == "a_reprendre"
    soumissions, regards, recuperations = (len(animateur.soumissions), len(animateur.etats_demandes),
                                           len(animateur.recuperations))

    await atelier.travaux.demarrer(projet, t["identifiant"], reprise=True)
    await atelier.travaux.attendre_tout()
    await atelier.file_locale.attendre_tout()

    fini = atelier.travaux.lire(projet, t["identifiant"])
    assert fini["etat"] == "termine", fini
    # Rien renvoyé, rien redemandé au moteur : le clip était déjà là.
    assert len(animateur.soumissions) == soumissions
    assert len(animateur.etats_demandes) == regards and len(animateur.recuperations) == recuperations
    assert atelier.animation.lire(clip.identifiant).statut.value == "reussie"
