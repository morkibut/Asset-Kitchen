"""AU6 : vrais fichiers et vrai arrêt de processus, aucun modèle lancé."""

import asyncio
import json
import os
import subprocess
import sys
import time
from dataclasses import replace
from pathlib import Path

import pytest
import httpx

from atelier.api.app import creer_application
from atelier.depot import Fichiers
from atelier.domaine.animation import DemandeClip, Tarification
from atelier.services import Atelier
from atelier.services.evenements import Diffusion
from atelier.services.file_locale import ServiceFileLocale, FileLocaleRefusee
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4
from tests.test_au3 import production


async def disponible():
    return {"etat": "disponible", "travaux": [], "temperature": "inconnue"}


@pytest.fixture
async def file(tmp_path):
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()
    service = ServiceFileLocale(fichiers, Diffusion())
    service.inscrire_moteur("moteur-test", "Moteur doublé", disponible)
    yield service
    await service.fermer()


def preparer(file, cle, nature="video", **options):
    return file.preparer(cle, nature=nature, moteur="moteur-test", modele="essai:modele",
        projet="jeu", acteur="auteur", parametres={"nom": cle, **options}, entree=b"entree-conservee")


async def test_image_video_et_3d_partagent_la_meme_place_et_les_erreurs_sont_isolees(file):
    actifs, maximum = 0, 0
    gestes = []

    async def executer(etape):
        nonlocal actifs, maximum
        gestes.append(etape["nature"])
        if etape["nature"] == "image":
            raise ValueError("préparation d'image refusée avant envoi")
        actifs += 1
        maximum = max(maximum, actifs)
        file.engager(etape["identifiant"])
        file.connaitre_externe(etape["identifiant"], etape["cle"])
        await asyncio.sleep(0.04)
        actifs -= 1
        return {"fichier": etape["cle"] + ".png"}

    for nature in ("image", "video", "modele3d"):
        file.inscrire_executeur(nature, executer)
    etapes = [preparer(file, nature, nature) for nature in ("image", "video", "modele3d")]
    await asyncio.gather(*(file.lancer(e["identifiant"]) for e in etapes))
    await file.attendre_tout()
    assert gestes == ["image", "video", "modele3d"] and maximum == 1
    assert [file.lire(e["identifiant"])["etat"] for e in etapes] == ["echoue", "termine", "termine"]
    await file.lancer(etapes[-1]["identifiant"], reprise=True)
    assert gestes == ["image", "video", "modele3d"]


async def test_diagnostic_inconnu_ne_lance_rien_et_annuler_ne_touche_pas_le_moteur(file):
    async def inconnu():
        return {"etat": "inconnu", "travaux": [], "raison": "Impossible de lire les travaux de l'autre application."}
    file.inscrire_moteur("moteur-test", "Moteur doublé", inconnu)
    appels = []
    async def executer(e):
        appels.append(e)
        return {}
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "attendue")
    await file.lancer(etape["identifiant"])
    await asyncio.sleep(0.08)
    assert not appels
    assert "autre application" in file.lire(etape["identifiant"])["raison"]
    assert file.annuler(etape["identifiant"])["etat"] == "annule"
    await file.attendre_tout()
    assert not appels


async def test_annulation_en_cours_est_refusee_sans_interruption_globale(file):
    parti, finir = asyncio.Event(), asyncio.Event()
    async def executer(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "calcul-unique")
        parti.set()
        await finir.wait()
        return {}
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "actif")
    await file.lancer(etape["identifiant"])
    await asyncio.wait_for(parti.wait(), 2)
    with pytest.raises(FileLocaleRefusee, match="annulation ciblée"):
        file.annuler(etape["identifiant"])
    assert file.lire(etape["identifiant"])["etat"] == "en_cours"
    finir.set()
    await file.attendre_tout()


async def test_annuler_pendant_le_diagnostic_empeche_la_soumission(file):
    observe, repondre = asyncio.Event(), asyncio.Event()
    async def observer():
        observe.set()
        await repondre.wait()
        return await disponible()
    appels = []
    async def executer(e):
        appels.append(e)
        return {}
    file.inscrire_moteur("moteur-test", "Double", observer)
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "annulation-pendant-observation")
    await file.lancer(etape["identifiant"])
    await asyncio.wait_for(observe.wait(), 2)
    file.annuler(etape["identifiant"])
    repondre.set()
    await file.attendre_tout()
    assert file.lire(etape["identifiant"])["etat"] == "annule"
    assert not appels


async def test_acceptation_inconnue_garde_la_place_et_ne_resoumet_pas(file):
    appels = []
    async def executer(e):
        appels.append(e["identifiant"])
        file.engager(e["identifiant"])
        raise TimeoutError("réponse perdue après envoi")
    file.inscrire_executeur("video", executer)
    a, b = preparer(file, "a"), preparer(file, "b")
    await file.lancer(a["identifiant"])
    await file.attendre_fin(a["identifiant"])
    assert file.lire(a["identifiant"])["etat"] == "externe_inconnu"
    await file.lancer(b["identifiant"])
    await asyncio.sleep(0.08)
    assert appels == [a["identifiant"]]
    with pytest.raises(FileLocaleRefusee):
        await file.lancer(a["identifiant"], reprise=True)


async def test_identite_et_entree_immuables_et_mesures_froid_chaud_distinctes(file):
    temperature = "froid"
    async def observer():
        return {"etat": "disponible", "travaux": [], "temperature": temperature}
    file.inscrire_moteur("moteur-test", "Moteur doublé", observer)
    async def executer(e):
        assert file.entree(e["identifiant"]) == b"entree-conservee"
        await asyncio.sleep(0.01)
        return {}
    file.inscrire_executeur("image", executer)
    a = preparer(file, "froid", "image")
    assert preparer(file, "froid", "image")["identifiant"] == a["identifiant"]
    with pytest.raises(FileLocaleRefusee, match="autre calcul"):
        preparer(file, "froid", "image", autre=True)
    await file.lancer(a["identifiant"])
    await file.attendre_tout()
    temperature = "chaud"
    await file.observer()
    b = preparer(file, "chaud", "image")
    await file.lancer(b["identifiant"])
    await file.attendre_tout()
    assert {m["temperature"] for m in file.mesures()} == {"froid", "chaud"}
    assert all(m["mesures"] == 1 for m in file.mesures())


async def test_arret_reel_processus_libere_verrou_mais_ne_refait_pas_appel(tmp_path):
    script = '''import asyncio, pathlib, sys
from atelier.depot import Fichiers
from atelier.services.evenements import Diffusion
from atelier.services.file_locale import ServiceFileLocale
async def main():
    racine = pathlib.Path(sys.argv[1])
    fichiers = Fichiers(racine)
    fichiers.preparer()
    file = ServiceFileLocale(fichiers, Diffusion())
    async def observer(): return {"etat":"disponible", "travaux":[]}
    file.inscrire_moteur("moteur-test", "Double", observer)
    async def executer(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "externe-deja-accepte")
        (racine / "appel.txt").write_text("un seul appel", encoding="utf-8")
        (racine / "parti.txt").write_text(e["identifiant"], encoding="utf-8")
        await asyncio.Event().wait()
    file.inscrire_executeur("video", executer)
    e = file.preparer("calcul", nature="video", moteur="moteur-test", modele="essai:modele", projet="jeu", acteur="auteur", parametres={"graine":42}, entree=b"image originale")
    await file.lancer(e["identifiant"])
    await file.attendre_tout()
asyncio.run(main())
'''
    racine = tmp_path / "atelier-du-processus"
    enfant = subprocess.Popen([sys.executable, "-c", script, str(racine)], cwd=Path(__file__).resolve().parents[1],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    try:
        limite = time.monotonic() + 12
        while not (racine / "parti.txt").exists() and time.monotonic() < limite:
            await asyncio.sleep(0.05)
        assert (racine / "parti.txt").exists(), enfant.poll()
    finally:
        enfant.terminate()
        enfant.communicate(timeout=5)
    identifiant = (racine / "parti.txt").read_text(encoding="utf-8")
    file = ServiceFileLocale(Fichiers(racine), Diffusion())
    file.inscrire_moteur("moteur-test", "Double", disponible)
    repris = []
    async def recuperer(e):
        assert e["travail_externe"] == "externe-deja-accepte"
        assert e["parametres"] == {"graine": 42}
        assert file.entree(e["identifiant"]) == b"image originale"
        repris.append(e["travail_externe"])
        return {"fichier": "resultat-recupere.png"}
    file.inscrire_executeur("video", recuperer)
    assert file.lire(identifiant)["etat"] == "a_reprendre"
    assert not repris
    await file.lancer(identifiant, reprise=True)
    await file.attendre_tout()
    assert file.lire(identifiant)["etat"] == "termine"
    assert file.lire(identifiant)["duree_s"] is None  # l'arrêt n'est pas du temps GPU mesuré
    assert repris == ["externe-deja-accepte"]
    assert (racine / "appel.txt").read_text(encoding="utf-8") == "un seul appel"


async def test_deux_instances_de_file_ne_chevauchent_pas_le_meme_gpu(file):
    autre = ServiceFileLocale(file.fichiers, Diffusion())
    autre.inscrire_moteur("moteur-test", "Double", disponible)
    actifs, maximum = 0, 0
    async def executer(e):
        nonlocal actifs, maximum
        actifs += 1
        maximum = max(maximum, actifs)
        assert file.lire(e["identifiant"])["etat"] == "en_cours"
        assert autre.lire(e["identifiant"])["etat"] == "en_cours"
        await asyncio.sleep(0.05)
        actifs -= 1
        return {}
    file.inscrire_executeur("video", executer)
    autre.inscrire_executeur("video", executer)
    a, b = preparer(file, "a"), preparer(autre, "b")
    await asyncio.gather(file.lancer(a["identifiant"]), autre.lancer(b["identifiant"]))
    await asyncio.gather(file.attendre_tout(), autre.attendre_tout())
    assert maximum == 1


async def test_vrai_service_video_lot_fichiers_et_reprise_deja_terminee(tmp_path, double):
    animateur = AnimateurDouble()
    animateur.modeles = [replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))]
    animateur.observer_ressource = disponible
    animateur.octets = clip_mp4()
    animateur.facture = 0
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    await atelier.ouvrir()
    demande = DemandeClip(texte="Marche sur place", image=image_sujet(), secondes=5, options={"graine": 42})
    clips = [await atelier.animation.commander("essai:local", demande, identifiant="local-" + str(i), projet=atelier.bibliotheque.courant) for i in range(2)]
    await atelier.animation.attendre_tout()
    assert len(animateur.soumissions) == 2
    assert all(atelier.animation.lire(c.identifiant).clip.images == 6 for c in clips)
    assert all(e["etat"] == "termine" for e in atelier.file_locale.lister()["etapes"])
    await atelier.animation.recuperer(clips[0].identifiant)
    assert len(animateur.soumissions) == 2
    relu = await atelier.animation.commander("essai:local", demande, identifiant=clips[0].identifiant, projet=atelier.bibliotheque.courant)
    assert relu.clip.images == 6 and relu.clip.travail
    assert len(animateur.soumissions) == 2


async def test_diagnostic_comfy_lit_uniquement_la_file_complete():
    import httpx
    from atelier.fournisseur.maison import MoteurDeLaMaison
    appels = []
    def repondre(requete):
        appels.append((requete.method, requete.url.path))
        return httpx.Response(200, json={"queue_running": [[1, "travail-etranger", {}, {}, []]], "queue_pending": []})
    maison = MoteurDeLaMaison(transport=httpx.MockTransport(repondre))
    etat = await maison.observer_ressource()
    assert etat["etat"] == "occupe" and etat["travaux"] == ["travail-etranger"]
    assert etat["temperature"] == "inconnue"
    assert appels == [("GET", "/queue")]


async def test_reconfigurer_un_moteur_sans_travail_ne_garde_pas_une_adresse_perimee(production):
    atelier, _, _, animateur = production
    animateur.adresse = "http://ancienne:8188"
    ancien = atelier.animation._inscrire_moteur_local(animateur)
    animateur.adresse = "http://nouvelle:8188"
    nouveau = atelier.animation._inscrire_moteur_local(animateur)
    diagnostics = await atelier.file_locale.observer()
    assert ancien not in [d["identifiant"] for d in diagnostics]
    assert nouveau in [d["identifiant"] for d in diagnostics]


async def test_cadre_agent_relu_apres_attente_du_gpu(production):
    atelier, projet, demande, animateur = production
    local = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))
    animateur.modeles = [local]
    await atelier.animation.rafraichir()
    reference = atelier.generations.importer(image_sujet(), "référence", projet=projet)["asset"]["identifiant"]
    atelier.travaux.regler_cadre(projet, {"autoriser_local": True, "plafond_appels": 2})
    occupe, finir = asyncio.Event(), asyncio.Event()
    async def occupant(e):
        occupe.set()
        await finir.wait()
        return {}
    atelier.file_locale.inscrire_moteur("moteur-test", "Double", disponible)
    atelier.file_locale.inscrire_executeur("image", occupant)
    premiere = preparer(atelier.file_locale, "calcul-precedent", "image")
    await atelier.file_locale.lancer(premiere["identifiant"])
    await asyncio.wait_for(occupe.wait(), 2)
    travail = await atelier.travaux.preparer(projet, {**demande, "modele_video": local.identifiant, "reference_asset": reference}, "agent")
    await atelier.travaux.demarrer(projet, travail["identifiant"], "agent")
    limite = time.monotonic() + 5
    while len(atelier.file_locale.lister()["etapes"]) < 2 and time.monotonic() < limite:
        await asyncio.sleep(0.01)
    try:
        assert len(atelier.file_locale.lister()["etapes"]) == 2
        atelier.travaux.regler_cadre(projet, {"autoriser_local": False, "plafond_appels": 2})
    finally:
        finir.set()
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "a_verifier", fini
    assert "locale" in fini["raison"]
    assert not animateur.soumissions


async def test_api_et_mcp_lisent_la_meme_file_et_annulent_uniquement_avant_envoi(production):
    atelier, projet, demande, animateur = production
    local = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))
    animateur.modeles = [local]
    async def occupe():
        return {"etat": "occupe", "travaux": ["etranger"], "raison": "Autre application en cours."}
    animateur.observer_ressource = occupe
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        await atelier.animation.rafraichir()
        reference = atelier.generations.importer(image_sujet(), "référence", projet=projet)["asset"]["identifiant"]
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            r = await client.post("/api/clips", json={"modele": local.identifiant, "asset": reference, "prompt": "Walk in place", "secondes": 5, "resolution": "480p", "proportions": "1:1"})
            assert r.status_code == 202, r.text
            file = (await client.get("/api/local-queue")).json()
            assert len(file["etapes"]) == 1 and not animateur.soumissions
            moteurs = (await client.get("/api/local-queue/engines")).json()["moteurs"]
            assert moteurs[0]["etat"] == "occupe" and moteurs[0]["annulation_ciblee"] is False
            stage = file["etapes"][0]["identifiant"]
            entetes = {"Accept": "application/json, text/event-stream"}
            ouverture = await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
                "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "essai-au6", "version": "1"}}})
            assert ouverture.status_code == 200, ouverture.text
            entetes["mcp-session-id"] = ouverture.headers["mcp-session-id"]
            entetes["mcp-protocol-version"] = "2025-06-18"
            await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
            reponse = await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_local_queue", "arguments": {}}})
            donnees = next(json.loads(l[5:]) for l in reponse.text.splitlines() if l.startswith("data:") and '"result"' in l) if reponse.headers.get("content-type", "").startswith("text/event-stream") else reponse.json()
            assert donnees["result"]["structuredContent"]["etapes"][0]["identifiant"] == stage
            with pytest.raises(FileLocaleRefusee, match="manuelle"):
                atelier.file_locale.annuler(stage, acteur="agent")
            annulation = await client.post(f"/api/local-queue/{stage}/cancel")
            assert annulation.status_code == 200 and annulation.json()["etat"] == "annule"
            assert not animateur.soumissions


async def test_annuler_video_locale_libere_la_reservation_agent_sans_oublier_reference_payee(production, double):
    atelier, projet, demande, animateur = production
    local = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))
    animateur.modeles = [local]
    async def occupe():
        return {"etat": "occupe", "travaux": ["etranger"], "raison": "Carte occupée ailleurs."}
    animateur.observer_ressource = occupe
    await atelier.animation.rafraichir()
    atelier.travaux.regler_cadre(projet, {"autoriser_local": True, "autoriser_payant": True,
        "plafond_appels": 2, "plafond_usd": 1})
    travail = await atelier.travaux.preparer(projet, {**demande, "modele_video": local.identifiant}, "agent")
    await atelier.travaux.demarrer(projet, travail["identifiant"], "agent")
    limite = time.monotonic() + 5
    while not atelier.file_locale.lister()["etapes"] and time.monotonic() < limite:
        await asyncio.sleep(0.01)
    etapes = atelier.file_locale.lister()["etapes"]
    assert len(etapes) == 1
    atelier.file_locale.annuler(etapes[0]["identifiant"], acteur="agent")
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "annule"
    assert atelier.travaux._brut(projet, travail["identifiant"])["reserve"] is None
    assert fini["appels_engages"] == 1 and sum(c["cout_usd"] for c in fini["consommations"]) > 0
    assert double.appels == 1 and not animateur.soumissions
    await atelier.travaux.demarrer(projet, travail["identifiant"], "agent", reprise=True)
    assert atelier.travaux.lire(projet, travail["identifiant"])["etat"] == "annule"
