# -*- coding: utf-8 -*-
"""TS11 · La première planche d'un sujet dont le concept art est une carte
(`docs/PLAN-de-la-toile-au-sujet.md`) — la moitié serveur.

`TS3` avait été essayé sur un sujet né par `TS2`, et **jamais avec ce que
l'écran envoie vraiment** : l'écran de la première planche montre le concept
art parmi les images jointes, donc il revient dans `references`. Le
dédoublonnage gardant la première occurrence, la copie de l'écran — sans usage
— passait devant celle du service, et la carte partait comme une simple
référence : plus de « THE CHARACTER DESIGN TO REPRODUCE » dans le texte.

Ici le sujet est fait **à la main**, et sa carte désignée concept art sans être
copiée en asset : c'est le cas d'Elias, vu par l'auteur le 23 septembre 2026.

**Rien ne coûte un centime** : le double du fournisseur rend ses images.
"""

from __future__ import annotations

from atelier.services.univers import CarteInconnue
from tests.conftest import image_sujet, planche_sujets
from tests.test_ts3 import DESIGN, _attendre, _envoi, _generer, _vue


def _sujet_a_carte_non_copiee(client, rang: int = 5) -> dict:
    """Un sujet créé seul, puis une carte de la toile désignée concept art —
    **sans** passer par `TS2` : aucune copie en asset, aucun portrait."""
    cree = client.post(
        "/api/characters", json={"nom": f"Elias {rang}", "description": "a young mage"}
    )
    assert cree.status_code == 201, cree.text
    ident = cree.json()["personnage"]["identifiant"]
    octets = image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12)
    carte = client.post(f"/api/board/paste?nom=elias-{rang}.png", content=octets)
    assert carte.status_code == 201, carte.text
    carte = carte.json()["carte"]["identifiant"]
    regle = client.put(f"/api/characters/{ident}", json={"concept_arts": [carte]})
    assert regle.status_code == 200, regle.text
    assert client.get(f"/api/assets/{carte}").status_code == 404
    return {"personnage": ident, "carte": carte}


def _comme_l_ecran(sujet: dict) -> list[dict]:
    """Ce que l'écran joint après « Faire la planche des directions » : le
    design rendu par `first-sheet`, **avec son origine**."""
    return [{"asset": sujet["carte"], "role": "reference", "origine": "carte"}]


def test_la_premiere_planche_nomme_la_carte_comme_carte(client):
    _vue(client)
    sujet = _sujet_a_carte_non_copiee(client)

    lue = client.get(f"/api/characters/{sujet['personnage']}/first-sheet")

    assert lue.status_code == 200, lue.text
    assert lue.json()["design"] == [
        {"asset": sujet["carte"], "role": "reference", "origine": "carte", "usage": "design"}
    ]


def test_la_carte_jointe_par_l_ecran_part_une_fois_comme_personnage_a_reproduire(client):
    _vue(client)
    sujet = _sujet_a_carte_non_copiee(client, 6)

    ecran = _envoi(
        client,
        prompt="a young mage",
        personnage=sujet["personnage"],
        premiere_planche=True,
        references=_comme_l_ecran(sujet),
    )

    assert ecran.status_code == 200, ecran.text
    corps = ecran.json()
    lignes = corps["images"]["lignes"]
    # **Une seule ligne**, et c'est celle du service : la copie de l'écran ne
    # la fait pas passer pour « carte de la toile ».
    assert [(l["asset"], l["origine"]) for l in lignes] == [(sujet["carte"], "carte")]
    assert lignes[0]["provenance"] == "concept art · personnage à reproduire"
    assert f"Image 1 — {DESIGN}" in corps["texte"]


def test_ce_qui_part_au_modele_est_la_carte_nommee_design(client, double):
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_a_carte_non_copiee(client, 7)

    appel = _generer(
        client,
        prompt="a young mage",
        personnage=sujet["personnage"],
        premiere_planche=True,
        references=_comme_l_ecran(sujet),
    )

    assert appel.status_code == 202, appel.text
    generation = appel.json()
    assert generation["references"] == [
        {"asset": sujet["carte"], "role": "reference", "origine": "carte", "usage": "design"}
    ]
    assert f"Image 1 — {DESIGN}" in generation["demande"]["prompt"]
    assert _attendre(client, generation["identifiant"])["statut"] == "reussie"
    # La carte + le gabarit de la grille, une fois chacun.
    assert len(double.demandes[-1].references) == 2


def test_une_carte_a_reproduire_introuvable_arrete_l_appel(client, double, monkeypatch):
    """Un artwork disparu est sauté ; **le personnage à reproduire, jamais** —
    l'appel partirait dessiner un inconnu, payé."""
    _vue(client)
    sujet = _sujet_a_carte_non_copiee(client, 8)
    univers = client.app.state.atelier.univers

    def disparue(projet, identifiant):
        raise CarteInconnue(identifiant)

    monkeypatch.setattr(univers, "octets_reference", disparue)
    appel = _generer(
        client,
        prompt="a young mage",
        personnage=sujet["personnage"],
        premiere_planche=True,
        references=_comme_l_ecran(sujet),
    )

    if appel.status_code == 202:
        lue = _attendre(client, appel.json()["identifiant"])
        assert lue["statut"] == "echouee", lue
    else:
        assert appel.status_code == 409, appel.text
    assert double.appels == 0
