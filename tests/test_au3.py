"""AU3 : la demande durable, avec vrais médias et fournisseurs doublés."""

import asyncio
import json
from dataclasses import replace

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.animation import Tarification
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from atelier.services.travaux import ServiceTravaux
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4
from tests.conftest import image_sujet


@pytest.fixture
async def production(tmp_path, double):
    animateur = AnimateurDouble()
    async def observer():
        return {"etat": "disponible", "travaux": []}
    animateur.observer_ressource = observer
    animateur.octets = clip_mp4()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    atelier.travaux = ServiceTravaux(atelier)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    objet = atelier.base.lire_projet(projet)
    objet.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(objet)
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin", "Un petit pèlerin en manteau", objectif={
        "sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}],
        "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64},
    })
    demande = {"cle": "marche-1", "personnage": personnage.identifiant, "pose": "marche", "direction": "ouest",
               "modele_image": "essai:rend-du-png", "plafond_image_usd": 0.1,
               "modele_video": MELE.identifiant, "prompt_video": "Walk in place, keep entire silhouette visible.",
               "cadence": 11, "nombre_images": 4, "options_video": {"seed": 42}}
    yield atelier, projet, demande, animateur
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()


async def _fin(atelier, projet, travail, acteur="auteur"):
    await atelier.travaux.demarrer(projet, travail["identifiant"], acteur)
    await atelier.travaux.attendre_tout()
    return atelier.travaux.lire(projet, travail["identifiant"])


async def test_personnage_vide_devient_reference_clip_bande_et_livraison(production, double, tmp_path):
    atelier, projet, demande, animateur = production
    godot = tmp_path / "Godot"
    godot.mkdir()
    (godot / "project.godot").write_text('config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n', encoding="utf-8")
    atelier.livraison.associer(projet, str(godot))
    travail = await atelier.travaux.preparer(projet, {**demande, "livrer_provisoire": True})
    assert travail["etat"] == "prepare"
    assert double.appels == len(animateur.soumissions) == 0
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini
    assert double.appels == len(animateur.soumissions) == 1
    assert fini["acteur"] == "auteur"
    assert fini["reference_asset"] and fini["clip"] and len(fini["bandes"]) == 1
    bande = atelier.montage.bande(fini["bandes"][0])
    assert bande.cadence == 11 and bande.compte == 4
    assert bande.pose == "marche" and bande.direction == "ouest"
    assert atelier.livraison.historique(projet)["livraisons"][0]["etat"] == "terminee"
    assert sum(c["cout_usd"] for c in fini["consommations"]) > 0


async def test_cle_repetee_ne_redemande_rien_et_autre_contenu_refuse(production, double):
    atelier, projet, demande, animateur = production
    premier = await atelier.travaux.preparer(projet, demande)
    second = await atelier.travaux.preparer(projet, demande)
    assert second["identifiant"] == premier["identifiant"]
    await _fin(atelier, projet, premier)
    relu = await atelier.travaux.preparer(projet, demande)
    await _fin(atelier, projet, relu)
    assert double.appels == len(animateur.soumissions) == 1
    with pytest.raises(TravailRefuse, match="autre demande"):
        await atelier.travaux.preparer(projet, {**demande, "cadence": 12})


async def test_relecture_apres_nouvel_atelier_puis_execution(production, double):
    atelier, projet, demande, animateur = production
    travail = await atelier.travaux.preparer(projet, demande)
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    autre.travaux = ServiceTravaux(autre)
    # Ouverture réelle marque les générations préparées interrompues ; le
    # travail encore non démarré doit savoir les distinguer des appels partis.
    await autre.ouvrir()
    relu = autre.travaux.lire(projet, travail["identifiant"])
    assert relu["demande"]["cadence"] == 11
    fini = await _fin(autre, projet, relu)
    assert fini["etat"] == "termine", fini


async def test_deux_demandes_agent_ne_depassent_pas_reservation_atomique(production, double):
    atelier, projet, demande, animateur = production
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 2, "plafond_usd": 0.3})
    double.retenir = asyncio.Event()
    a = await atelier.travaux.preparer(projet, demande, "agent")
    b = await atelier.travaux.preparer(projet, {**demande, "cle": "marche-2"}, "agent")
    resultats = await asyncio.gather(atelier.travaux.demarrer(projet, a["identifiant"], "agent"),
        atelier.travaux.demarrer(projet, b["identifiant"], "agent"), return_exceptions=True)
    assert sum(isinstance(r, TravailRefuse) for r in resultats) == 1
    double.retenir.set()
    await atelier.travaux.attendre_tout()
    assert double.appels == len(animateur.soumissions) == 1


async def test_cadre_relu_entre_image_et_video(production, double):
    atelier, projet, demande, animateur = production
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 4, "plafond_usd": 1})
    double.retenir = asyncio.Event()
    travail = await atelier.travaux.preparer(projet, demande, "agent")
    await atelier.travaux.demarrer(projet, travail["identifiant"], "agent")
    while double.appels == 0:
        await asyncio.sleep(0)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": False, "plafond_appels": 4, "plafond_usd": 1})
    double.retenir.set()
    await atelier.travaux.attendre_tout()
    assert not animateur.soumissions
    assert atelier.travaux.lire(projet, travail["identifiant"])["etat"] == "a_verifier"


async def test_acceptation_video_inconnue_ne_resoumet_jamais(production, double):
    atelier, projet, demande, animateur = production
    async def perdue(modele, demande):
        animateur.soumissions.append((modele.identifiant, demande))
        raise TimeoutError("la réponse du fournisseur a été perdue")
    animateur.soumettre = perdue
    travail = await atelier.travaux.preparer(projet, demande)
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "externe_inconnu", fini
    with pytest.raises(TravailRefuse, match="inconnue"):
        await atelier.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    assert len(animateur.soumissions) == 1


async def test_modele_sans_entree_refuse_avant_appel(production, double):
    atelier, projet, demande, animateur = production
    with pytest.raises(TravailRefuse, match="n'anime pas une image"):
        await atelier.travaux.preparer(projet, {**demande, "modele_video": "essai:texte-seulement"})
    assert double.appels == len(animateur.soumissions) == 0


async def test_local_permis_sans_repli_image_gratuit_universel(production):
    atelier, projet, demande, animateur = production
    asset = atelier.generations.importer(image_sujet(), "référence", projet=projet)["asset"]
    local = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))
    animateur.modeles = [local]
    animateur.facture = 0
    await atelier.animation.rafraichir()
    travail = await atelier.travaux.preparer(projet, {**demande, "reference_asset": asset["identifiant"], "modele_video": local.identifiant}, "agent")
    fini = await _fin(atelier, projet, travail, "agent")
    assert fini["etat"] == "termine", fini
    assert len(animateur.soumissions) == 1


async def test_argent_reserve_meme_si_plafond_appels_encore_libre(production, double):
    atelier, projet, demande, animateur = production
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 0.3})
    double.retenir = asyncio.Event()
    a = await atelier.travaux.preparer(projet, demande, "agent")
    b = await atelier.travaux.preparer(projet, {**demande, "cle": "marche-2"}, "agent")
    try:
        await atelier.travaux.demarrer(projet, a["identifiant"], "agent")
        with pytest.raises(TravailRefuse, match="budget"):
            await atelier.travaux.demarrer(projet, b["identifiant"], "agent")
    finally:
        double.retenir.set()
    await atelier.travaux.attendre_tout()
    assert double.appels == len(animateur.soumissions) == 1


async def test_cout_reel_reference_compte_avant_video(production, double):
    atelier, projet, demande, animateur = production
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 0.3})
    double.couter = lambda _: 0.25
    travail = await atelier.travaux.preparer(projet, demande, "agent")
    fini = await _fin(atelier, projet, travail, "agent")
    assert fini["etat"] == "a_verifier" and "budget" in fini["raison"]
    assert double.appels == 1 and not animateur.soumissions
    assert sum(c["cout_usd"] for c in fini["consommations"]) == 0.25


async def test_image_payee_illisible_ne_perd_pas_sa_facture(production, double):
    atelier, projet, demande, animateur = production
    double.rendre = lambda: b"PNG incomplet"
    double.couter = lambda _: 0.18
    travail = await atelier.travaux.preparer(projet, demande)
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "a_verifier"
    assert sum(c["cout_usd"] for c in fini["consommations"]) == 0.18
    assert not animateur.soumissions
    generation = atelier.base.lire(fini["generation_image"])
    assert not generation.emplacements[0].acceptation_inconnue


async def test_acceptation_image_inconnue_est_explicite_immediatement(production, double):
    atelier, projet, demande, animateur = production

    async def perdue(modele, demande):
        double.appels += 1
        raise TimeoutError("réponse perdue après acceptation possible")

    double.generer = perdue
    travail = await atelier.travaux.preparer(projet, demande)
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "externe_inconnu", fini
    with pytest.raises(TravailRefuse, match="inconnue"):
        await atelier.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    assert double.appels == 1 and not animateur.soumissions


async def test_reprise_video_connue_apres_fermeture_sans_second_appel(production, double):
    atelier, projet, demande, animateur = production
    regarde = asyncio.Event()
    bloque = asyncio.Event()
    etat_original = animateur.etat

    async def etat_suspendu(travail):
        regarde.set()
        await bloque.wait()
        return await etat_original(travail)

    animateur.etat = etat_suspendu
    travail = await atelier.travaux.preparer(projet, demande)
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await asyncio.wait_for(regarde.wait(), timeout=5)
    relu = atelier.travaux.lire(projet, travail["identifiant"])
    numero = relu["travail_externe"]
    atelier.travaux._taches[travail["identifiant"]].cancel()
    await atelier.travaux.attendre_tout()
    animateur.etat = etat_original
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    await autre.ouvrir()
    assert autre.travaux.lire(projet, travail["identifiant"])["etat"] == "a_reprendre"
    await autre.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    await autre.travaux.attendre_tout()
    fini = autre.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    assert fini["travail_externe"] == numero
    assert animateur.recuperations == [numero]
    assert double.appels == len(animateur.soumissions) == 1


async def test_envoi_exact_relu_references_et_prompt_figes(production, double, monkeypatch):
    atelier, projet, demande, animateur = production
    reference = atelier.generations.importer(image_sujet(logique_l=6), "repère", projet=projet)["asset"]["identifiant"]
    travail = await atelier.travaux.preparer(projet, {**demande, "prompt_image": "My fully edited request.",
        "repris_image": True, "references_image": [reference], "options_image": {"quality": "high"}})
    octets = atelier.travaux.reference(projet, travail["identifiant"], 0)
    fonction = atelier.assets.reference
    monkeypatch.setattr(atelier.assets, "reference", lambda identifiant: image_sujet(logique_l=12) if identifiant == reference else fonction(identifiant))
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini
    assert double.demandes[0].references == (octets,)
    assert double.demandes[0].prompt == travail["envoi_image"]["prompt"] == "My fully edited request."
    assert double.demandes[0].options == {"quality": "high"}
    assert animateur.soumissions[0][1].options == {"seed": 42}


async def test_api_prepare_affiche_envoi_demarre_et_relit_bande(production, double):
    atelier, projet, demande, animateur = production
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            racine = f"/api/projects/{projet}/production-jobs"
            reponse = await client.post(racine + "/preview", json=demande)
            assert reponse.status_code == 200, reponse.text
            travail = reponse.json()
            assert travail["envoi_image"]["prompt"] and not double.appels
            assert (await client.post(f"{racine}/{travail['identifiant']}/start")).status_code == 200
            fini = (await client.get(f"{racine}/{travail['identifiant']}?attente=5")).json()
            assert fini["etat"] == "termine", fini
            assert len(fini["bandes"]) == 1 and fini["acteur"] == "auteur"
            assert (await client.get(fini["entree_video"]["url"])).headers["content-type"] == "image/png"
            conflit = await client.post(racine + "/preview", json={**demande, "cadence": 9})
            assert conflit.status_code == 409, conflit.text
    assert double.appels == len(animateur.soumissions) == 1


async def test_mcp_http_demande_complete_meme_service_et_repetition_sans_depense(production, double):
    atelier, projet, demande, animateur = production
    app = creer_application(atelier)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 2, "plafond_usd": 1})
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            entetes = {"Accept": "application/json, text/event-stream"}
            ouverture = await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
                "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "essai-au3", "version": "1"}}})
            assert ouverture.status_code == 200, ouverture.text
            entetes["mcp-session-id"] = ouverture.headers["mcp-session-id"]
            entetes["mcp-protocol-version"] = "2025-06-18"
            await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
            compteur = 1

            async def appeler(nom, arguments):
                nonlocal compteur
                compteur += 1
                reponse = await client.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": compteur,
                    "method": "tools/call", "params": {"name": nom, "arguments": arguments}})
                assert reponse.status_code == 200, reponse.text
                if reponse.headers.get("content-type", "").startswith("text/event-stream"):
                    retour = next(json.loads(l[5:]) for l in reponse.text.splitlines() if l.startswith("data:") and '"result"' in l)
                else:
                    retour = reponse.json()
                assert not retour.get("error") and not retour["result"].get("isError"), retour
                return retour["result"]["structuredContent"]

            fini = await appeler("request_character_animation", {"project": projet, "request": demande, "wait_seconds": 5})
            assert fini["etat"] == "termine" and fini["acteur"] == "agent", fini
            relu = await appeler("request_character_animation", {"project": projet, "request": demande, "wait_seconds": 5})
            assert relu["bandes"] == fini["bandes"]
            depuis_api = (await client.get(f"/api/projects/{projet}/production-jobs/{fini['identifiant']}")).json()
            assert depuis_api["bandes"] == fini["bandes"]
    assert double.appels == len(animateur.soumissions) == 1
