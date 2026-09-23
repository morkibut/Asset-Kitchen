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

from atelier.services.generation import PROVENANCE_DESIGN_CARTE
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


# ── Le catalogue connaît la première planche (corrigé le 24 septembre 2026) ──


SANS_IMAGE = "essai:rend-du-jpeg"  # `references_max=0` dans le catalogue d'essai
AVEC_IMAGES = "essai:rend-du-png"  # deux images d'entrée


def _catalogue(client, personnage: str, references: int, cases: int = 0, **autres):
    parametres = {"references": references, "personnage": personnage, "cases": cases, **autres}
    lue = client.get("/api/models", params=parametres)
    assert lue.status_code == 200, lue.text
    corps = lue.json()
    return {m["identifiant"]: m["refus"] for m in corps["modeles"]}, corps["references"]


def test_le_catalogue_grise_d_avance_un_modele_sans_image_pour_la_premiere_planche(
    client, double
):
    """**Grisé avec sa raison, jamais proposé puis refusé** (AGENTS.md, *le
    catalogue décide*). Un jeu vu de face : une seule direction, donc pas de
    gabarit — seul le concept art peut griser le modèle, et l'écran l'a
    peut-être retiré des images jointes : le serveur le réinjecte quand même."""
    client.put("/api/universe", json={"vue": "vue-face-fixe"})
    sujet = _sujet_a_carte_non_copiee(client, 9)
    ident = sujet["personnage"]
    assert client.get(f"/api/characters/{ident}/first-sheet").json()["directions"] == []

    # Sans le drapeau : rien ne grise — c'était le défaut.
    refus, _ = _catalogue(client, ident, 0)
    assert refus[SANS_IMAGE] is None

    refus, compte = _catalogue(client, ident, 0, premiere_planche="true")
    assert refus[SANS_IMAGE] == "n'accepte aucune image de référence"
    assert refus[AVEC_IMAGES] is None
    assert compte["incompressibles"] == 1 and compte["total"] == 1

    # **Ce que l'écran joint est ce concept art-là** : compté une fois, comme
    # `_sans_le_design` le fait à l'envoi — pas deux.
    refus, compte = _catalogue(client, ident, 1, premiere_planche="true")
    assert refus[SANS_IMAGE] == "n'accepte aucune image de référence"
    assert compte["incompressibles"] == 1 and compte["total"] == 1
    assert [(l["asset"], l["provenance"]) for l in compte["lignes"]] == [
        (sujet["carte"], PROVENANCE_DESIGN_CARTE)
    ]

    # **Le 409 reste le filet** : ce qui partirait quand même se refuse avant
    # de payer.
    appel = _generer(
        client,
        modele=SANS_IMAGE,
        prompt="a young mage",
        personnage=ident,
        premiere_planche=True,
        references=_comme_l_ecran(sujet),
    )
    assert appel.status_code == 409, appel.text
    assert "n'accepte aucune image" in appel.text
    assert double.appels == 0


def test_hors_premiere_planche_le_catalogue_compte_comme_avant(client):
    """Le drapeau ne change rien à qui ne le pose pas — et un sujet sans rien à
    reproduire ne fait pas lever la liste."""
    client.put("/api/universe", json={"vue": "vue-face-fixe"})
    sujet = _sujet_a_carte_non_copiee(client, 10)
    avant = _catalogue(client, sujet["personnage"], 1)
    assert avant[0][SANS_IMAGE] == "n'accepte aucune image de référence"
    assert avant[1]["incompressibles"] == 1

    vide = client.post("/api/characters", json={"nom": "Personne", "description": "x"})
    ident = vide.json()["personnage"]["identifiant"]
    refus, compte = _catalogue(client, ident, 0, premiere_planche="true")
    assert refus[SANS_IMAGE] is None and compte["incompressibles"] == 0
