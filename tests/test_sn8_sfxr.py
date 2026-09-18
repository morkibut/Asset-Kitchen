# -*- coding: utf-8 -*-
"""SN8 — les sons d'interface et rétro (sfxr), sans ComfyUI.

Un départ type rend un son en un instant, déterministe, sans jamais saturer ;
une mutation en tire des variantes qui gardent la forme d'onde ; la route et
l'outil MCP entrent dans la même bibliothèque que le reste des sons, avec une
clé idempotente qui empêche tout doublon.
"""
from __future__ import annotations

import io
import time
import wave

import numpy as np
import pytest

from atelier.audio.sfxr import DEPARTS, muter, rendre_sfxr, tirer_depart, depuis_json
from atelier.audio.traitement import encoder, mesurer
from atelier.domaine.son import SonRefuse


@pytest.fixture
def audio(atelier, client):
    return atelier, atelier.bibliotheque.courant


# ── Le moteur seul, sans service ni route ────────────────────────────────


@pytest.mark.parametrize("nom", sorted(DEPARTS))
def test_chaque_depart_type_rend_un_son_correct_et_rapide(nom):
    debut = time.perf_counter()
    params = tirer_depart(nom, 20260918)
    signal, taux = rendre_sfxr(params, 20260918)
    duree_calcul = time.perf_counter() - debut
    mesures = mesurer(signal, taux)
    assert not mesures["silencieux"], f"{nom} est silencieux"
    assert mesures["ecretes"] == 0, f"{nom} sature"
    assert 0 < mesures["duree"] < 2.0, f"{nom} dure {mesures['duree']}s"
    assert duree_calcul < 1.0, f"{nom} a pris {duree_calcul:.2f}s à calculer"


def test_memes_parametres_et_graine_rendent_les_memes_octets():
    p1 = tirer_depart("laser_shoot", 5)
    p2 = tirer_depart("laser_shoot", 5)
    assert p1 == p2
    s1, t1 = rendre_sfxr(p1, 5)
    s2, t2 = rendre_sfxr(p2, 5)
    assert t1 == t2
    assert encoder(s1, t1) == encoder(s2, t2)
    # Une autre graine change le tirage du départ type lui-même.
    p3 = tirer_depart("laser_shoot", 6)
    assert p3 != p1


def test_mutation_change_les_octets_et_garde_la_forme_d_onde():
    base = tirer_depart("jump", 11)
    base_signal, taux = rendre_sfxr(base, 11)
    base_octets = encoder(base_signal, taux)
    for graine in range(1, 6):
        variante = muter(base, graine)
        assert variante.wave_type == base.wave_type
        signal, _ = rendre_sfxr(variante, graine)
        assert encoder(signal, taux) != base_octets
        assert not mesurer(signal, taux)["silencieux"]


def test_parametres_hors_domaine_sont_refuses():
    with pytest.raises(SonRefuse, match="p_base_freq"):
        depuis_json({"p_base_freq": 5})
    with pytest.raises(SonRefuse, match="forme d'onde"):
        depuis_json({"wave_type": 9})
    with pytest.raises(SonRefuse, match="inconnu"):
        depuis_json({"p_inexistant": 0.1})


# ── Le service, en passant par la vraie bibliothèque des sons ───────────


def test_service_fabriquer_est_idempotent_sans_doublon(audio):
    atelier, projet = audio
    premier = atelier.sfxr.fabriquer(projet, depart="pickup_coin", graine=1, nom="Pièce")
    assert premier["pret"] and premier["provenance"]["nature"] == "sfxr"
    assert premier["provenance"]["moteur"] == "sfxr (portage jsfxr)"
    assert premier["provenance"]["depart"] == "pickup_coin"
    second = atelier.sfxr.fabriquer(projet, depart="pickup_coin", graine=1, nom="Pièce")
    assert second["identifiant"] == premier["identifiant"] and second["revision"] == premier["revision"]
    assert len(atelier.sons.lister(projet)) == 1
    # Une graine différente est un autre son.
    autre = atelier.sfxr.fabriquer(projet, depart="pickup_coin", graine=2, nom="Pièce")
    assert autre["identifiant"] != premier["identifiant"]
    assert len(atelier.sons.lister(projet)) == 2


def test_service_fabriquer_avec_parametres_complets(audio):
    atelier, projet = audio
    parametres = tirer_depart("blip_select", 3).en_json()
    son = atelier.sfxr.fabriquer(projet, parametres=parametres, graine=3, nom="Bip")
    assert son["pret"]
    assert son["provenance"]["depart"] is None
    assert son["provenance"]["parametres"] == parametres


def test_service_refuse_ni_les_deux_ni_aucun(audio):
    atelier, projet = audio
    with pytest.raises(SonRefuse, match="pas les deux, pas aucun"):
        atelier.sfxr.fabriquer(projet, graine=1)
    with pytest.raises(SonRefuse, match="pas les deux, pas aucun"):
        atelier.sfxr.fabriquer(projet, depart="jump", parametres={"wave_type": 0}, graine=1)
    with pytest.raises(SonRefuse, match="n'est pas un départ"):
        atelier.sfxr.fabriquer(projet, depart="inconnu", graine=1)


def test_service_variantes_produit_un_jeu_deterministe_sans_doublon(audio):
    atelier, projet = audio
    variantes = atelier.sfxr.variantes(projet, depart="explosion", graine=42, nombre=3, nom="Boum")
    assert len(variantes) == 3
    identifiants = {v["identifiant"] for v in variantes}
    assert len(identifiants) == 3
    for v in variantes:
        assert v["provenance"]["nature"] == "sfxr" and v["provenance"]["mutation_de"]["graine"] == 42
    rejoue = atelier.sfxr.variantes(projet, depart="explosion", graine=42, nombre=3, nom="Boum")
    assert {v["identifiant"] for v in rejoue} == identifiants
    assert len(atelier.sons.lister(projet)) == 3


def test_un_son_sfxr_se_refait_a_l_identique_depuis_sa_provenance(audio):
    atelier, projet = audio
    son = atelier.sfxr.fabriquer(projet, depart="hit_hurt", graine=77, nom="Coup")
    provenance = son["provenance"]
    params_refaits = depuis_json(provenance["parametres"])
    signal, taux = rendre_sfxr(params_refaits, provenance["graine"])
    refait = encoder(signal, taux)
    # La source conservée est le WAV exact qu'a produit `rendre_sfxr` la
    # première fois (`importer_octets` la garde immuable) : refaire le calcul
    # depuis la provenance doit rendre exactement les mêmes octets.
    source = atelier.sons.source(projet, son["identifiant"]).read_bytes()
    assert refait == source


def test_signal_mono_16_bits_44100hz(audio):
    atelier, projet = audio
    son = atelier.sfxr.fabriquer(projet, depart="blip_select", graine=9, nom="Bip")
    with wave.open(io.BytesIO(atelier.sons.rendu(projet, son["identifiant"]).read_bytes())) as f:
        assert f.getnchannels() == 1
        assert f.getsampwidth() == 2
        assert f.getframerate() == 44100


# ── La route HTTP ─────────────────────────────────────────────────────────


def test_route_fabrication_variantes_et_idempotence(audio):
    atelier, projet = audio
    from fastapi.testclient import TestClient
    from atelier.api.app import creer_application
    c = TestClient(creer_application(atelier))
    with c:
        reponse = c.get(f"/api/projects/{projet}/sounds/sfxr/starts")
        assert reponse.status_code == 200 and set(reponse.json()) == set(DEPARTS)

        creation = c.post(f"/api/projects/{projet}/sounds/sfxr",
            json={"depart": "power_up", "graine": 4, "nom": "Amélioration"})
        assert creation.status_code == 201, creation.text
        son = creation.json()
        assert son["pret"] and son["provenance"]["depart"] == "power_up"

        rejoue = c.post(f"/api/projects/{projet}/sounds/sfxr",
            json={"depart": "power_up", "graine": 4, "nom": "Amélioration"})
        assert rejoue.json()["identifiant"] == son["identifiant"]
        assert len(c.get(f"/api/projects/{projet}/sounds").json()) == 1

        variantes = c.post(f"/api/projects/{projet}/sounds/sfxr/variants",
            json={"depart": "power_up", "graine": 4, "nombre": 2, "nom": "Amélioration"})
        assert variantes.status_code == 201, variantes.text
        assert len(variantes.json()) == 2

        refus = c.post(f"/api/projects/{projet}/sounds/sfxr", json={"graine": 1})
        assert refus.status_code == 400 and "pas les deux, pas aucun" in refus.json()["raison"]


# ── L'outil MCP ─────────────────────────────────────────────────────────


async def test_outil_mcp_fabrique_et_tire_des_variantes(audio):
    atelier, projet = audio
    from atelier.mcp.serveur import creer_serveur

    serveur = creer_serveur(atelier)
    fabrique = await serveur.call_tool("make_retro_sound",
        {"project": projet, "start": "erreur", "seed": 13, "name": "Erreur"})
    assert not fabrique.is_error, fabrique
    son = fabrique.structured_content
    assert son["provenance"]["depart"] == "erreur" and son["apercu"].endswith("/preview.wav?revision=1")

    rejoue = await serveur.call_tool("make_retro_sound",
        {"project": projet, "start": "erreur", "seed": 13, "name": "Erreur"})
    assert rejoue.structured_content["identifiant"] == son["identifiant"]
    assert len(atelier.sons.lister(projet)) == 1

    variantes = await serveur.call_tool("make_retro_sound_variants",
        {"project": projet, "start": "erreur", "seed": 13, "count": 3, "name": "Erreur"})
    assert not variantes.is_error, variantes
    # FastMCP enveloppe une liste rendue sous {"result": [...]}.
    assert len(variantes.structured_content["result"]) == 3
    assert len(atelier.sons.lister(projet)) == 4

    from mcp.server.mcpserver.exceptions import ToolError
    with pytest.raises(ToolError, match="graine"):
        await serveur.call_tool("make_retro_sound", {"project": projet, "start": "jump", "seed": -1})
