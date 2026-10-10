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
from atelier.services.file_locale import (ESTIMATION_PAR_DEFAUT_S, MARGE_ECHEANCE, PROLONGATION_MIN_S,
    FileLocaleRefusee, ServiceFileLocale, SuiviLocalInterrompu, TravailExternePerdu)
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4
from tests.test_au3 import production
from tests.test_au14_generation import sonore, preparer as preparer_son, lancer as lancer_son
from tests.test_au7_au8 import raccorder


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
    """**RV5/RV6** : `POST /clips` a été retirée (21 septembre 2026). Le geste
    équivalent passe par le nouveau circuit — `ServiceTravaux.preparer` puis
    `demarrer` —, ce que les autres essais de ce fichier font déjà (voir
    `test_cadre_agent_relu_apres_attente_du_gpu` juste au-dessus)."""
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
        travail = await atelier.travaux.preparer(
            projet, {**demande, "modele_video": local.identifiant, "reference_asset": reference}
        )
        await atelier.travaux.demarrer(projet, travail["identifiant"])
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
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


async def test_une_etape_en_attente_orpheline_ne_bloque_plus_la_file(file):
    """Trouvé le 10 octobre 2026 : après un redémarrage de l'atelier, des étapes
    préparées mais jamais relancées bloquaient toute la file sans fin."""
    async def executer(etape):
        return {"fichier": etape["cle"]}
    file.inscrire_executeur("video", executer)
    orpheline = preparer(file, "orpheline")
    suivante = preparer(file, "suivante")
    await file.lancer(suivante["identifiant"])
    await asyncio.wait_for(file.attendre_fin(suivante["identifiant"]), timeout=5)
    assert file.lire(suivante["identifiant"])["etat"] == "termine"
    assert file.lire(orpheline["identifiant"])["etat"] == "en_attente"


# ── La veille de la file (10 octobre 2026) ───────────────────────────────────
#
# Trouvé en produisant les sons de Cœur de Pierre : des étapes passées « à
# reprendre » après une seule lecture d'état ratée, alors que ComfyUI avait fini
# leur calcul ; personne ne les a reprises, et toute la file a attendu derrière
# elles, sans un mot. Chaque essai ci-dessous avance une horloge doublée au lieu
# d'attendre, et appelle le passage de veille (`verifier`) à la main — sauf
# celui qui vérifie que la coroutine de veille, elle, tourne vraiment.


class Horloge:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


def moteur_qui_a(travaux, etat=None):
    """Un moteur doublé dont la file est `travaux` (une liste qu'on remplit
    après l'envoi) : occupé dès qu'elle porte un travail, libre sinon."""
    async def observer():
        return {"etat": etat or ("occupe" if travaux else "disponible"), "travaux": list(travaux), "temperature": "inconnue"}
    return observer


async def attendre_que(condition, secondes=5):
    limite = time.monotonic() + secondes
    while not condition() and time.monotonic() < limite:
        await asyncio.sleep(0.01)
    assert condition()


async def test_orpheline_apres_redemarrage_est_reprise_par_la_veille_sans_nouvel_envoi(file):
    """Promesse 1 : un atelier arrêté pendant un calcul laisse une étape « en
    cours » que plus personne ne suit. L'atelier suivant la reprend de lui-même
    (son numéro de travail est relu, rien n'est soumis) ; une étape qui n'avait
    rien soumis reste de côté et ne bloque rien (essai juste au-dessus)."""
    envois, relus = [], []
    async def premier(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "travail-17")
        envois.append(e["identifiant"])
        await asyncio.Event().wait()
    file.inscrire_executeur("video", premier)
    etape = preparer(file, "coupee-par-l-arret")
    await file.lancer(etape["identifiant"])
    await attendre_que(lambda: envois)
    await file.fermer()  # l'atelier s'arrête
    assert file.lire(etape["identifiant"])["etat"] == "a_reprendre"

    suivant = ServiceFileLocale(file.fichiers, Diffusion())
    suivant.inscrire_moteur("moteur-test", "Moteur doublé", disponible)
    async def relire(e):
        assert e["travail_externe"] == "travail-17" and e["soumission_engagee"]
        relus.append(e["travail_externe"])
        return {"fichier": "relu.png"}
    suivant.inscrire_executeur("video", relire)
    suivant.intervalle_veille = 0.01
    suivant.demarrer_veille()
    try:
        await attendre_que(lambda: suivant.lire(etape["identifiant"])["etat"] == "termine")
    finally:
        await suivant.fermer()
    fini = suivant.lire(etape["identifiant"])
    assert relus == ["travail-17"] and len(envois) == 1
    assert fini["reprises_auto"] == 1


async def test_echeance_depassee_mais_le_moteur_calcule_encore_elle_est_prolongee(file):
    """Promesse 2, premier cas : l'échéance (l'estimation × 1,2) passe, le moteur
    a toujours le travail dans sa file — on prolonge de 20 % de l'estimation
    (au moins une minute), le calcul continue, et on redemandera."""
    horloge = Horloge()
    file.horloge = horloge
    chez_comfy = []
    file.inscrire_moteur("moteur-test", "Moteur doublé", moteur_qui_a(chez_comfy))
    parti, finir = asyncio.Event(), asyncio.Event()
    async def executer(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "travail-long")
        chez_comfy.append("travail-long")
        parti.set()
        await finir.wait()
        return {"fichier": "long.png"}
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "long")
    await file.lancer(etape["identifiant"])
    await asyncio.wait_for(parti.wait(), 2)
    lu = file.lire(etape["identifiant"])
    # Aucune mesure encore : l'estimation de repli, dix minutes.
    assert lu["estimation_s"] == ESTIMATION_PAR_DEFAUT_S
    assert lu["echeance"] == pytest.approx(horloge.t + ESTIMATION_PAR_DEFAUT_S * (1 + MARGE_ECHEANCE))
    horloge.t = lu["echeance"] - 1
    await file.verifier()
    assert file.lire(etape["identifiant"]).get("prolongations") == 0
    horloge.t = lu["echeance"] + 1
    await file.verifier()
    prolongee = file.lire(etape["identifiant"])
    assert prolongee["etat"] == "en_cours" and prolongee["prolongations"] == 1
    assert prolongee["echeance"] == pytest.approx(horloge.t + max(ESTIMATION_PAR_DEFAUT_S * MARGE_ECHEANCE, PROLONGATION_MIN_S))
    assert "traite encore" in prolongee["raison"]
    assert not file._taches[etape["identifiant"]].done()  # le suivi n'a pas été coupé
    finir.set()
    await file.attendre_tout()
    assert file.lire(etape["identifiant"])["etat"] == "termine"


async def test_echeance_suit_la_mediane_mesuree_du_meme_calcul(file):
    """L'estimation est celle que l'écran annonce : la médiane des calculs
    terminés du même moteur, du même modèle, à la même température."""
    async def rien(e):
        return {}
    file.inscrire_executeur("video", rien)
    for i, duree in enumerate((10.0, 20.0, 30.0)):
        e = preparer(file, f"mesure-{i}")
        file.modifier(e["identifiant"], etat="termine", duree_s=duree)
    assert file.estimation({"moteur": "moteur-test", "modele": "essai:modele", "temperature": "inconnue"}) == 20.0
    assert file.estimation({"moteur": "moteur-test", "modele": "autre", "temperature": "inconnue"}) == ESTIMATION_PAR_DEFAUT_S


async def test_echeance_depassee_travail_perdu_une_reprise_automatique_puis_echec_visible(file):
    """Promesse 2, second cas : à l'échéance, le moteur n'a plus le travail (ou
    ne répond pas). Le suivi est coupé et repris **une fois**, en relisant le
    même numéro ; si cette reprise échoue aussi, l'étape échoue avec une phrase
    lisible — et la file passe à la suivante."""
    horloge = Horloge()
    file.horloge = horloge
    file.inscrire_moteur("moteur-test", "Moteur doublé", moteur_qui_a([], "disponible"))
    appels = []
    async def executer(e):
        appels.append(e["travail_externe"])
        if len(appels) == 1:
            file.engager(e["identifiant"])
            file.connaitre_externe(e["identifiant"], "travail-oublie")
            await asyncio.Event().wait()  # un suivi qui ne voit jamais la fin
        raise SuiviLocalInterrompu("le moteur de la maison n'est pas allumé — Détail : ")
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "perdue")
    await file.lancer(etape["identifiant"])
    await attendre_que(lambda: file.lire(etape["identifiant"])["travail_externe"])
    horloge.t = file.lire(etape["identifiant"])["echeance"] + 1
    await file.verifier()  # coupe, puis reprend une fois
    await file.attendre_fin(etape["identifiant"])
    reprise = file.lire(etape["identifiant"])
    assert appels == [None, "travail-oublie"], appels  # la reprise relit, elle ne resoumet pas
    assert reprise["reprises_auto"] == 1 and reprise["etat"] == "a_reprendre"
    await file.verifier()
    echouee = file.lire(etape["identifiant"])
    assert echouee["etat"] == "echoue"
    assert "reprise automatique a déjà été tentée" in echouee["raison"]
    await file.verifier()
    assert len(appels) == 2  # jamais de troisième tentative


async def test_travail_oublie_par_comfyui_pendant_une_reprise_automatique_est_resoumis_une_fois(file):
    """Le seul envoi automatique de la file : pendant une reprise automatique,
    ComfyUI dit ne plus connaître le travail (redémarré). Un calcul local
    oublié ne coûtait rien — il est soumis de nouveau, une seule fois."""
    envois = []
    async def executer(e):
        if not e["travail_externe"]:
            file.engager(e["identifiant"])
            envois.append(e["identifiant"])
            file.connaitre_externe(e["identifiant"], f"travail-{len(envois)}")
            if len(envois) == 1:
                raise SuiviLocalInterrompu("lecture d'état manquée")
            return {"fichier": "resoumis.png"}
        raise TravailExternePerdu("ComfyUI ne connaît plus le travail travail-1.")
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "oubliee")
    await file.lancer(etape["identifiant"])
    await file.attendre_fin(etape["identifiant"])
    assert file.lire(etape["identifiant"])["etat"] == "a_reprendre"
    await file.verifier()  # reprise automatique : le moteur l'a oublié
    await file.attendre_fin(etape["identifiant"])
    assert file.lire(etape["identifiant"])["perdu"] is True
    await file.verifier()  # resoumission, une seule
    await file.attendre_fin(etape["identifiant"])
    fini = file.lire(etape["identifiant"])
    assert fini["etat"] == "termine" and fini["resoumis_auto"] and len(envois) == 2


async def test_a_reprendre_sans_suivi_est_repris_une_fois_sans_clic(file):
    """Promesse 3, le défaut du 10 octobre : une lecture d'état ratée laisse
    l'étape « à reprendre » alors que ComfyUI a fini. La veille la reprend
    d'elle-même, une fois — le compte est écrit sur l'étape."""
    appels = []
    async def executer(e):
        appels.append(e["travail_externe"])
        if e["cle"] == "a-reprendre" and not e["travail_externe"]:
            file.engager(e["identifiant"])
            file.connaitre_externe(e["identifiant"], "travail-fini-chez-comfy")
            raise SuiviLocalInterrompu("le moteur de la maison n'est pas allumé — Détail : ")
        return {"fichier": "rattrape.png"}
    file.inscrire_executeur("video", executer)
    bloquante, derriere = preparer(file, "a-reprendre"), preparer(file, "derriere")
    await file.lancer(bloquante["identifiant"])
    await file.attendre_fin(bloquante["identifiant"])
    assert file.lire(bloquante["identifiant"])["etat"] == "a_reprendre"
    await file.lancer(derriere["identifiant"])
    await asyncio.sleep(0.05)
    assert file.lire(derriere["identifiant"])["etat"] == "en_attente"  # la file attend bien derrière elle
    await file.verifier()
    await file.attendre_tout()
    reprise = file.lire(bloquante["identifiant"])
    assert reprise["etat"] == "termine" and reprise["reprises_auto"] == 1
    assert appels == [None, "travail-fini-chez-comfy", None]
    assert file.lire(derriere["identifiant"])["etat"] == "termine"


async def test_le_travail_sonore_reprend_seul_le_son_que_la_file_a_rattrape(sonore):
    """Promesse 3, second volet : le travail de production qui attendait l'étape
    était resté « à vérifier » jusqu'à un `POST …/resume` à la main. Quand la
    veille rattrape l'étape, le travail relit le son de lui-même — sans second
    envoi à ComfyUI."""
    atelier, comfy, p = sonore
    # ComfyUI calcule encore : le travail est dans sa file tant qu'il n'a pas fini.
    repondre = comfy.repondre
    def avec_sa_file(requete):
        if requete.url.path == "/queue" and not comfy.termine:
            return httpx.Response(200, json={"queue_running": [[0, n] for n in comfy.jobs], "queue_pending": []})
        return repondre(requete)
    comfy.repondre = avec_sa_file
    raccorder(atelier, comfy)
    comfy.termine = False
    atelier.travaux_audio.delai = .03
    t = await preparer_son(atelier, p)
    interrompu = await lancer_son(atelier, t)
    assert interrompu["etat"] == "a_verifier", interrompu
    assert atelier.file_locale.lire(interrompu["etape_locale"])["etat"] == "a_reprendre"
    comfy.termine = True  # ComfyUI avait fini ; personne ne l'a vu
    await atelier.file_locale.verifier()
    await atelier.file_locale.attendre_tout()
    await atelier.file_locale.attendre_suites()
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(t["projet"], t["identifiant"])
    assert fini["etat"] == "termine" and fini["son"], fini
    assert len(comfy.envois) == 1


async def test_file_arretee_trop_longtemps_porte_une_alerte_qui_nomme_l_etape(file):
    """Promesse 4 : une file qui n'avance plus le dit — dans `GET /api/local-queue`
    et par la diffusion —, en nommant l'étape qui la tient. Le seuil suit les
    échéances : l'échéance, plus une prolongation."""
    from types import SimpleNamespace
    from atelier.api.file_locale import lire as route_file
    horloge = Horloge()
    file.horloge = horloge
    chez_comfy = []
    file.inscrire_moteur("moteur-test", "Moteur doublé", moteur_qui_a(chez_comfy))
    finir = asyncio.Event()
    async def executer(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "travail-coince")
        chez_comfy.append("travail-coince")
        await finir.wait()
        return {}
    file.inscrire_executeur("video", executer)
    etape = preparer(file, "coince")
    requete = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(atelier=SimpleNamespace(file_locale=file))))
    with file.diffusion.abonnement() as annonces:
        await file.lancer(etape["identifiant"])
        await attendre_que(lambda: file.lire(etape["identifiant"])["travail_externe"])
        await file.verifier()
        assert route_file(requete)["alerte"] is None
        seuil = ESTIMATION_PAR_DEFAUT_S * (1 + MARGE_ECHEANCE) + max(ESTIMATION_PAR_DEFAUT_S * MARGE_ECHEANCE, PROLONGATION_MIN_S)
        horloge.t += seuil - 5
        await file.verifier()
        assert file.alerte() is None
        horloge.t += 10
        await file.verifier()
        alerte = route_file(requete)["alerte"]
        assert alerte and alerte["etape"] == etape["identifiant"]
        assert "n'a pas avancé depuis" in alerte["phrase"] and etape["identifiant"][:8] in alerte["phrase"]
        annonces_vues = []
        while not annonces.empty():
            evenement = annonces.get_nowait()
            annonces_vues.append((evenement.genre, evenement.charge))
        assert ("file_locale_alerte", {"alerte": alerte}) in annonces_vues
        finir.set()
        await file.attendre_tout()
        await file.verifier()
        assert file.alerte() is None


async def test_beaucoup_d_etapes_en_attente_ne_bloquent_pas_la_boucle_et_la_file_passe_vite(file):
    """Mesuré sur l'atelier réel le 10 octobre 2026 : six étapes en attente,
    chacune relisant tout le registre (≈ 215 fichiers, deux fois) quatre fois
    par seconde, saturaient la boucle — 2,5 s pour une route triviale, jusqu'à
    280 s pour voir la fin d'un calcul de 3 s. Désormais elles partagent une
    lecture, ne relisent pas un fichier inchangé et se réveillent au changement."""
    async def rien(e):
        return {}
    file.inscrire_executeur("video", rien)
    for i in range(200):
        e = preparer(file, f"ancienne-{i}")
        file.modifier(e["identifiant"], etat="termine", duree_s=3.0)
    async def bloque(e):
        file.engager(e["identifiant"])
        file.connaitre_externe(e["identifiant"], "retenue")
        raise SuiviLocalInterrompu("retenue pour l'essai")
    file.inscrire_executeur("video", bloque)
    retenue = preparer(file, "retenue")
    await file.lancer(retenue["identifiant"])
    await file.attendre_fin(retenue["identifiant"])
    file.inscrire_executeur("video", rien)
    attente = [preparer(file, f"attente-{i}")["identifiant"] for i in range(6)]
    for identifiant in attente:
        await file.lancer(identifiant)
    await asyncio.sleep(0.3)
    lectures, retards = file.lectures_disque, []
    debut = time.monotonic()
    while time.monotonic() - debut < 1.5:
        avant = time.perf_counter()
        await asyncio.sleep(0.01)
        retards.append(time.perf_counter() - avant - 0.01)
    # Rien n'a changé pendant 1,5 s : rien ne se relit sur le disque.
    assert file.lectures_disque - lectures < 20, file.lectures_disque - lectures
    assert max(retards) < 0.25, max(retards)
    file.modifier(retenue["identifiant"], etat="termine")  # la retenue est levée
    debut = time.monotonic()
    await asyncio.wait_for(asyncio.gather(*(file.attendre_fin(i) for i in attente)), 10)
    assert time.monotonic() - debut < 2.0, time.monotonic() - debut
    assert all(file.lire(i)["etat"] == "termine" for i in attente)


async def test_quatre_prises_de_deux_secondes_sortent_en_moins_de_trente_secondes(sonore):
    """Mesuré le 10 octobre 2026 sur la série « camp-feu » : chaque prise SA3
    calcule en 1 à 5 s chez ComfyUI, et la série entière a pris une heure —
    perdue dans l'atelier, entre la fin réelle et « terminé », puis avant le
    départ de l'étape suivante. Ici, un ComfyUI doublé qui met 2 s par prise,
    l'intervalle de sondage réel (1 s), deux cents étapes déjà finies dans le
    registre, et quatre sons lancés ensemble : ils doivent sortir en moins de
    trente secondes, pas en une heure."""
    atelier, comfy, p = sonore
    atelier.travaux_audio.intervalle = 1  # le pas réel, pas celui des essais
    rendus_le = {}
    lectures_outils = []
    repondre = comfy.repondre

    def comfy_qui_met_deux_secondes(requete):
        chemin = requete.url.path
        if chemin == "/object_info":
            lectures_outils.append(chemin)
        maintenant = time.monotonic()
        for numero in comfy.jobs:
            rendus_le.setdefault(numero, maintenant + 2.0)
        en_cours = [n for n, fin in rendus_le.items() if fin > maintenant]
        if chemin == "/queue":
            return httpx.Response(200, json={"queue_running": [[0, n] for n in en_cours], "queue_pending": []})
        if chemin.startswith("/history/") and chemin.split("/")[-1] in en_cours:
            return httpx.Response(200, json={})
        return repondre(requete)

    comfy.repondre = comfy_qui_met_deux_secondes
    raccorder(atelier, comfy)
    moteur = next(iter(atelier.file_locale._moteurs))
    for i in range(200):
        e = atelier.file_locale.preparer(f"ancienne-{i}", nature="audio", moteur=moteur, modele="essai:ancien",
            projet=None, acteur="auteur", parametres={"ancienne": i})
        atelier.file_locale.modifier(e["identifiant"], etat="termine", duree_s=3.0)
    prises = [await preparer_son(atelier, p, f"prise-{i}") for i in range(4)]
    lectures_outils.clear()  # la préparation lit sa copie fraîche ; la série, non
    debut = time.monotonic()
    for t in prises:
        await atelier.travaux.demarrer(t["projet"], t["identifiant"], t["acteur"])
    await asyncio.wait_for(atelier.travaux.attendre_tout(), 60)
    duree = time.monotonic() - debut
    finis = [atelier.travaux.lire(t["projet"], t["identifiant"]) for t in prises]
    assert all(f["etat"] == "termine" for f in finis), [f["etat"] for f in finis]
    assert len(comfy.envois) == 4
    assert duree < 30, duree
    # Mesuré le 10 octobre : `/object_info` pèse 2 Mo et 3 s à lire, et il était
    # lu deux fois par prise — 6 s de trou entre deux sons. La série reprend la
    # copie lue à la préparation : au plus une lecture, si elle a vieilli.
    assert len(lectures_outils) <= 1, len(lectures_outils)
