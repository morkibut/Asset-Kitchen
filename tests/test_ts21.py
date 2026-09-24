# -*- coding: utf-8 -*-
"""TS21 · Seule une vraie planche devient la planche d'un sujet — la moitié
serveur (`docs/PLAN-de-la-toile-au-sujet.md`, corrigé le 24 septembre 2026
après relecture).

**La panne** : les morceaux d'une planche refaite découpée ont `parent` mais
pas `planche`, et gardent la génération de leur feuille. Leur fiche proposait
« C'est la référence », et `choisir_la_planche` l'acceptait : un clic rangeait
un sprite comme planche du sujet et retirait la vraie. Le serveur refuse
désormais, pour l'écran comme pour l'agent — `refus_de_la_planche`.

**Ce qui passe toujours** : la première planche (TS3), une planche refaite
(RS2), et une planche pliée par directions. Rien ne coûte un centime.
"""

from __future__ import annotations

from tests.conftest import planche_sujets
from tests.test_rs8 import ORDRE, _generer as _refaire, _ordonner, _sujet_avec_planche
from tests.test_ts3 import (
    _attendre,
    _generer,
    _premiere_planche_arrivee,
    _sujet_de_la_toile,
    _vue,
)


def _choisir(client, ident: str, asset: str):
    return client.put(f"/api/characters/{ident}/references/sheet", json={"asset": asset})


def _planche_du_sujet(atelier, ident: str) -> list[str]:
    relu = atelier.production.personnage(atelier.bibliotheque.courant, ident)
    return [r for r in relu.references if relu.usage_de(r) == "planche"]


def test_le_morceau_d_une_planche_refaite_se_refuse_et_la_vraie_reste(
    client, atelier, tmp_path, double
):
    """Le cas de la relecture : RS2 + découpe à l'arrivée (RS7). Le morceau est
    refusé, la planche rangée ne bouge pas ; la feuille refaite, elle, passe."""
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]
    assert _ordonner(client, ident, planche, ORDRE).status_code == 200
    double.rendre = lambda: planche_sujets(4)
    generation = _refaire(client, ident)
    morceaux = generation["emplacements"][0]["decoupe"]["morceaux"]
    assert len(morceaux) == 4
    # Le morceau a un parent et pas de `planche` — c'est ce qui le cachait.
    morceau = atelier.assets.lire(morceaux[0])
    assert morceau.parent and morceau.planche is None

    refus = _choisir(client, ident, morceaux[0])

    assert refus.status_code == 409, refus.text
    assert "pas une planche" in refus.text or "pas la planche" in refus.text
    assert _planche_du_sujet(atelier, ident) == [planche]

    feuille = f"{generation['identifiant']}-0"
    assert _choisir(client, ident, feuille).status_code == 200
    assert _planche_du_sujet(atelier, ident) == [feuille]


def test_la_vue_depliee_d_une_premiere_planche_se_refuse_et_la_feuille_passe(
    client, atelier, double
):
    _vue(client)
    ident, feuille = _premiere_planche_arrivee(client, double, 31)
    generation = feuille.rsplit("-", 1)[0]
    vue = next(
        a for a in atelier.base.assets_du_personnage(ident)
        if a.generation == generation and a.rang >= 100
    )

    refus = _choisir(client, ident, vue.identifiant)
    assert refus.status_code == 409, refus.text
    assert "vue sortie d'une planche" in refus.text
    assert _planche_du_sujet(atelier, ident) == []

    assert _choisir(client, ident, feuille).status_code == 200
    assert _planche_du_sujet(atelier, ident) == [feuille]


def test_une_planche_pliee_par_directions_passe_une_planche_de_poses_non(
    client, atelier, double
):
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    ident = _sujet_de_la_toile(client, 32)["personnage"]["identifiant"]

    directions = _generer(
        client, personnage=ident, pose="repos", directions=["sud", "nord", "est", "ouest"]
    )
    assert directions.status_code == 202, directions.text
    assert _attendre(client, directions.json()["identifiant"])["statut"] == "reussie"
    par_directions = f"{directions.json()['identifiant']}-0"

    double.rendre = lambda: planche_sujets(2)
    poses = _generer(client, personnage=ident, poses=["repos", "marche"])
    assert poses.status_code == 202, poses.text
    assert _attendre(client, poses.json()["identifiant"])["statut"] == "reussie"
    de_poses = f"{poses.json()['identifiant']}-0"
    assert atelier.assets.lire(de_poses) is not None

    refus = _choisir(client, ident, de_poses)
    assert refus.status_code == 409, refus.text
    assert "planche de poses" in refus.text

    assert _choisir(client, ident, par_directions).status_code == 200
    assert _planche_du_sujet(atelier, ident) == [par_directions]
