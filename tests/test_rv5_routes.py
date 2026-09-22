"""RV5, étape 4 : les deux routes de série et les options MCP de la série.

Les routes HTTP `preview-series` et `series/{cle}/start`, à côté des routes
existantes des travaux — même style, mêmes erreurs (`TravailRefuse` → 409).
Les options MCP : `request_character_animation` accepte `mouvement`,
`correction_geste`, `directions` et `nombre`, et passe par `preparer_serie`
puis `demarrer_serie` — sans rien changer pour un appel d'avant RV5.
`prepare_free_video` prépare, elle aussi, une série d'un seul clip.
"""

import json

import httpx
import pytest

from atelier.api.app import creer_application
from tests.test_a9 import MELE
from tests.test_au3 import production  # noqa: F401
from tests.test_rv5_serie import _commune, _deux_directions, _reference, _sujet


async def _mcp_brut(app, appeler_nom, arguments):
    """Ouvre une séance MCP et appelle un outil une fois — le résultat brut,
    erreur comprise (`result.isError`), pour un test isolé."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as c:
        entetes = {"Accept": "application/json, text/event-stream"}
        ouverture = await c.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "essai-rv5", "version": "1"}}})
        assert ouverture.status_code == 200, ouverture.text
        entetes["mcp-session-id"] = ouverture.headers["mcp-session-id"]
        entetes["mcp-protocol-version"] = "2025-06-18"
        await c.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
        reponse = await c.post("/mcp", headers=entetes, json={"jsonrpc": "2.0", "id": 2,
            "method": "tools/call", "params": {"name": appeler_nom, "arguments": arguments}})
        assert reponse.status_code == 200, reponse.text
        if reponse.headers.get("content-type", "").startswith("text/event-stream"):
            return next(json.loads(l[5:]) for l in reponse.text.splitlines() if l.startswith("data:") and '"result"' in l)
        return reponse.json()


async def _mcp(app, appeler_nom, arguments):
    """`_mcp_brut`, sans erreur attendue."""
    retour = await _mcp_brut(app, appeler_nom, arguments)
    assert not retour.get("error") and not retour["result"].get("isError"), retour
    return retour["result"]["structuredContent"]


# ── Les routes ────────────────────────────────────────────────────────────


async def test_preview_series_puis_start_lance_les_clips(production):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="route-1")
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            racine = f"/api/projects/{projet}/production-jobs"
            reponse = await client.post(racine + "/preview-series", json={
                **commune, "cases": [{"pose": "attaque", "direction": ouest}, {"pose": "attaque", "direction": est}], "nombre": 1})
            assert reponse.status_code == 200, reponse.text
            serie = reponse.json()
            assert serie["serie"]["total"] == 2 and len(serie["travaux"]) == 2
            # La référence est déjà fournie (`_reference`) : chaque case ne paie qu'un appel vidéo.
            assert serie["annonce_serie"]["appels"] == 2
            # Relue à l'identique : la même clé, aucune dépense en plus.
            relue = await client.post(racine + "/preview-series", json={
                **commune, "cases": [{"pose": "attaque", "direction": ouest}, {"pose": "attaque", "direction": est}], "nombre": 1})
            assert [t["identifiant"] for t in relue.json()["travaux"]] == [t["identifiant"] for t in serie["travaux"]]

            demarree = await client.post(racine + f"/series/{serie['serie']['cle']}/start")
            assert demarree.status_code == 200, demarree.text
            lancee = demarree.json()
            assert lancee["serie"]["total"] == 2
            for t in lancee["travaux"]:
                fini = (await client.get(f"{racine}/{t['identifiant']}?attente=5")).json()
                assert fini["etat"] == "termine", fini
    assert len(animateur.soumissions) == 2


async def test_preview_series_refuse_une_serie_deja_prise_par_une_autre(production):
    atelier, projet, demande, _ = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="route-conflit")
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            racine = f"/api/projects/{projet}/production-jobs"
            reponse = await client.post(racine + "/preview-series", json={
                **commune, "cases": [{"pose": "attaque", "direction": ouest}], "nombre": 1})
            assert reponse.status_code == 200, reponse.text
            conflit = await client.post(racine + "/preview-series", json={
                **commune, "cases": [{"pose": "attaque", "direction": est}], "nombre": 1})
            assert conflit.status_code == 409, conflit.text


async def test_series_start_refuse_une_cle_inconnue(production):
    atelier, projet, _demande, _animateur = production
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            racine = f"/api/projects/{projet}/production-jobs"
            reponse = await client.post(racine + "/series/jamais-preparee/start")
            assert reponse.status_code == 409, reponse.text


# ── Les options MCP ──────────────────────────────────────────────────────


async def test_mcp_request_character_animation_sans_options_est_inchange(production):
    """Compatibilité : sans `directions` ni `nombre`, la forme du retour ne
    change pas — un travail nu, pas une série."""
    atelier, projet, demande, animateur = production
    app = creer_application(atelier)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 2, "plafond_usd": 1})
    async with app.router.lifespan_context(app):
        fini = await _mcp(app, "request_character_animation", {"project": projet, "request": demande, "wait_seconds": 5})
    assert fini["etat"] == "termine" and fini["acteur"] == "agent" and "serie" not in fini


async def test_mcp_request_character_animation_directions_passe_par_la_serie(production):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="mcp-directions")
    prix_un = 1.0  # borne large ; le cadre sera relevé après une première lecture du prix
    app = creer_application(atelier)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 100})
    async with app.router.lifespan_context(app):
        requete = {**commune, "directions": [ouest, est], "pose": "attaque"}
        serie = await _mcp(app, "request_character_animation", {"project": projet, "request": requete, "wait_seconds": 5})
    assert serie["serie"]["total"] == 2 and len(serie["travaux"]) == 2
    assert all(t["etat"] == "termine" for t in serie["travaux"])
    assert len(animateur.soumissions) == 2


async def test_mcp_request_character_animation_nombre_seul_passe_par_la_serie(production):
    atelier, projet, demande, animateur = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    commune = {**_commune(demande, gardienne, _reference(atelier, projet), cle="mcp-nombre"), "pose": "attaque", "direction": ouest}
    app = creer_application(atelier)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 100})
    async with app.router.lifespan_context(app):
        serie = await _mcp(app, "request_character_animation", {"project": projet, "request": {**commune, "nombre": 2}, "wait_seconds": 5})
    assert serie["serie"]["total"] == 2 and len(serie["travaux"]) == 2
    assert len(animateur.soumissions) == 2


async def test_mcp_request_character_animation_serie_part_tout_ou_rien_pour_l_agent(production):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="mcp-refus")
    app = creer_application(atelier)
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 0})
    async with app.router.lifespan_context(app):
        requete = {**commune, "directions": [ouest, est], "pose": "attaque"}
        retour = await _mcp_brut(app, "request_character_animation", {"project": projet, "request": requete, "wait_seconds": 1})
        assert retour["result"].get("isError"), retour
    # Les deux travaux sont préparés (`preparer_serie` a écrit), mais aucun n'est parti :
    # `demarrer_serie` a tout refusé avant de réserver quoi que ce soit.
    travaux = atelier.travaux.lister(projet)
    assert len(travaux) == 2 and all(t["etat"] == "prepare" for t in travaux) and not animateur.soumissions


async def test_mcp_prepare_free_video_rend_un_travail_nu_par_la_serie(production):
    atelier, projet, demande, animateur = production
    ref = atelier.generations.importer(_image_libre(), "référence libre", projet=projet)["asset"]["identifiant"]
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        travail = await _mcp(app, "prepare_free_video", {"project": projet, "request": {
            "cle": "libre-mcp", "reference_asset": ref, "modele_video": MELE.identifiant,
            "prompt_video": "Une forêt se balance dans le vent"}})
    assert travail["nature"] == "video-libre" and "identifiant" in travail and "serie" not in travail


def _image_libre():
    from tests.conftest import image_sujet
    return image_sujet()
