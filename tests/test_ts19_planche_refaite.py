# -*- coding: utf-8 -*-
"""TS19 étendu à la planche refaite (RS2) — corrigé le 24 septembre 2026 après
relecture (`docs/PLAN-de-la-toile-au-sujet.md`).

TS19 ne portait la phrase anti-miroir et le signal qu'aux planches pliées (la
première planche, TS3 et TS20). Une planche **refaite** (« Garder la mise en
page de la référence ») n'avait ni l'une ni l'autre : refaire la planche d'Elias
redemandait exactement le miroir que la première n'avait plus le droit de
dessiner.

- **la phrase** part dès que l'ordre des vues de la planche à reproduire est dit
  et qu'il porte deux directions opposées — « Views 1 and 2 … » ;
- **le signal** se mesure à la découpe à l'arrivée (RS7), sur les morceaux, dans
  l'ordre des vues figé avec l'appel (RS8), et s'écrit sur la marque.

Rien ne coûte un centime.
"""

from __future__ import annotations

import time

from tests.test_rs8 import _importer, _ordonner, _ranger
from tests.test_ts19 import _autre_cote, _miroir, _planche, _profil

MODELE = "essai:rend-du-png"
PHRASE = "Views 1 and 2 show the same subject from opposite sides, not a mirrored copy"


def _sujet(client, tmp_path, *, ordre: list[str] | None) -> str:
    """Elias, dans un jeu vu de côté (droite, gauche), avec sa planche rangée —
    et l'ordre de ses vues quand on le dit."""
    assert client.put("/api/universe", json={"vue": "vue-cote-plateforme"}).status_code == 200
    ident = client.post("/api/characters", json={"nom": "Elias"}).json()["personnage"][
        "identifiant"
    ]
    reference = _importer(
        client,
        tmp_path,
        _planche(_profil(True, sacoche=True, gourde=False), _autre_cote()),
    )
    _ranger(client, ident, reference)
    if ordre is not None:
        assert _ordonner(client, ident, reference, ordre).status_code == 200
    return ident


def _refaire(client, ident: str) -> dict:
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "Elias holds a lantern",
            "personnage": ident,
            "garder_mise_en_page": True,
            "decouper_a_l_arrivee": True,
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    lue: dict = {}
    for _ in range(200):
        lue = client.get(f"/api/generations/{identifiant}").json()
        marque = lue["emplacements"][0].get("decoupe")
        if lue["statut"] == "reussie" and marque and not marque.get("en_cours"):
            break
        if lue["statut"] in ("echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return lue


# ── La phrase qui part ───────────────────────────────────────────────────────


def test_la_planche_refaite_dit_l_autre_cote(client, tmp_path, double):
    ident = _sujet(client, tmp_path, ordre=["droite", "gauche"])

    ecran = client.post(
        "/api/outgoing",
        json={
            "modele": MODELE,
            "prompt": "Elias holds a lantern",
            "personnage": ident,
            "garder_mise_en_page": True,
        },
    )
    assert ecran.status_code == 200, ecran.text
    assert PHRASE in ecran.json()["texte"]

    # **Et c'est bien ce qui part** : le prompt enregistré sur la génération.
    double.rendre = lambda: _planche(_profil(True, sacoche=True, gourde=False), _autre_cote())
    generation = _refaire(client, ident)
    assert PHRASE in generation["demande"]["prompt"]


def test_sans_ordre_dit_la_planche_refaite_n_ajoute_rien(client, tmp_path):
    """Témoin : sans ordre des vues, aucune direction n'est connue — rien ne
    dit quelles vues se font face."""
    ident = _sujet(client, tmp_path, ordre=None)

    ecran = client.post(
        "/api/outgoing",
        json={
            "modele": MODELE,
            "prompt": "Elias holds a lantern",
            "personnage": ident,
            "garder_mise_en_page": True,
        },
    )
    assert ecran.status_code == 200, ecran.text
    assert "from opposite sides" not in ecran.json()["texte"]


# ── Le signal, à la découpe ─────────────────────────────────────────────────


def test_une_planche_refaite_en_miroir_porte_le_signal_a_sa_decoupe(
    client, atelier, tmp_path, double
):
    ident = _sujet(client, tmp_path, ordre=["droite", "gauche"])
    double.rendre = lambda: _planche(_profil(True, sacoche=True, gourde=False), _miroir())

    generation = _refaire(client, ident)

    marque = generation["emplacements"][0]["decoupe"]
    assert marque["directions"] == ["droite", "gauche"]
    assert marque["miroirs"] == [[0, 1]]
    # **Refermé et rouvert** (8septies) : écrit sur le disque.
    relue = atelier.generations._base.lire(generation["identifiant"])
    assert relue.emplacements[0].decoupe["miroirs"] == [[0, 1]]


def test_une_planche_refaite_qui_montre_l_autre_cote_n_en_porte_aucun(
    client, tmp_path, double
):
    ident = _sujet(client, tmp_path, ordre=["droite", "gauche"])
    double.rendre = lambda: _planche(_profil(True, sacoche=True, gourde=False), _autre_cote())

    marque = _refaire(client, ident)["emplacements"][0]["decoupe"]

    assert marque["directions"] == ["droite", "gauche"]
    assert "miroirs" not in marque
