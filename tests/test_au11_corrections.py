"""Corriger un squelette puis le relire, sans génération ni moteur lourd."""
import json
import httpx
import pytest
from tests.test_au9 import glb


@pytest.fixture
def moteur_corrections(atelier):
    etat = {"corrections": {"main": {"vrille": 17}}, "modifie_le": 1}
    appels = []
    def repondre(r):
        appels.append((r.method, r.url.path, dict(r.url.params)))
        if r.url.path == "/api/reglages":
            return httpx.Response(200, json={"moteurs_3d": [], "angles": [], "styles": [], "bornes": []})
        if r.url.path == "/api/animations":
            return httpx.Response(200, json={"animations": ["Marche lente.fbx"]})
        if r.url.path.endswith("/rig.glb"):
            return httpx.Response(200, content=glb())
        if r.url.path.endswith("/corrections"):
            if r.method == "PUT":
                etat.update(corrections=json.loads(r.content)["corrections"], modifie_le=2)
            return httpx.Response(200, json={"os": [{"cle": "main", "libelle": "Main", "axes": [{"nom": "vrille"}, {"nom": "flexion"}]}], "bornes": {"minimum": -180, "maximum": 180}, **etat})
        raise AssertionError("Aucun autre geste, et surtout aucun calcul : " + str(r.url))
    atelier.sources_3d.configurer("http://127.0.0.1:8498")
    atelier.sources_3d.transport = httpx.MockTransport(repondre)
    return etat, appels


def test_reglages_non_defaut_enregistres_relus_et_apercu_bien_cible(client, moteur_corrections):
    _, appels = moteur_corrections
    base = "/api/3d/characters/source-1"
    assert client.get(base + "/corrections").json()["corrections"]["main"]["vrille"] == 17
    demande = {"corrections": {"main": {"vrille": -43.5, "flexion": 27}}, "animation": "Marche lente.fbx"}
    r = client.put(base + "/corrections", json=demande)
    assert r.status_code == 200, r.text
    assert client.get(base + "/corrections").json()["corrections"] == demande["corrections"]
    apercu = client.get(base + "/rig", params={"animation": "Marche lente.fbx", "revision": 5})
    assert apercu.status_code == 200 and apercu.content == glb()
    assert apercu.headers["cache-control"] == "no-store"
    assert appels[-1] == ("GET", "/api/personnages/source-1/rig.glb", {"animation": "Marche lente.fbx"})
    assert all(methode == "GET" or chemin.endswith("/corrections") for methode, chemin, _ in appels)


@pytest.mark.parametrize("corps", [
    {"corrections": {"main": {"x": 12}}}, {"corrections": {"inconnu": {"vrille": 10}}},
    {"corrections": {"main": {"vrille": 181}}}, {"corrections": {"main": {"vrille": True}}},
    {"corrections": {} , "animation": "../../secret"}, {"autre": "ignoré"},
])
def test_une_entree_qui_ne_peut_pas_etre_appliquee_ne_part_jamais(client, moteur_corrections, corps):
    etat, appels = moteur_corrections
    r = client.put("/api/3d/characters/source-1/corrections", json=corps)
    assert r.status_code == 409, r.text
    assert etat["modifie_le"] == 1
    assert not any(methode == "PUT" for methode, _, _ in appels)
