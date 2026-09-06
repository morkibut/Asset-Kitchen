# -*- coding: utf-8 -*-
"""Les critères d'acceptation de B6 — la barre.

**Planches** : `docs/pistes-2026-09-04/carnet/Barre.dc.html`,
`Navigation.dc.html`, `Parcours.dc.html`.

Cinq critères, et les cinq portent sur `GET /api/actions` — parce que c'est là
que la tranche a mis ses règles. La barre est un écran qui obéit ; ce qui la
tient est la forme de ce qu'on lui sert :

- une action à confirmer **part sans route**, donc l'interface n'a rien à
  appeler et ne peut qu'ouvrir l'écran d'envoi ;
- ce qui ne peut pas se faire **n'est pas dans la réponse**, ni grisé ni
  accompagné d'une raison ;
- la liste **est** celle de l'agent : un outil ajouté au serveur MCP paraît,
  sans qu'une seconde table soit tenue à jour ;
- les six verbes sont fermés, et un verbe inventé retombe dedans.

Aucun essai ne coûte un centime : rien ici n'appelle un fournisseur.
"""

from __future__ import annotations

import time

from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.api.gestes import VERBES
from conftest import image_sujet

MODELE = "essai:rend-du-png"


def _actions(client, **params) -> list[dict]:
    return client.get("/api/actions", params=params).json()["actions"]


def _par_outil(client, **params) -> dict[str, dict]:
    return {a["outil"]: a for a in _actions(client, **params)}


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")


def _une_image(client, double) -> str:
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "une épée"}
    ).json()
    _attendre(client, reponse["identifiant"])
    return reponse["identifiant"]


# ── Critère 1 · La barre ne paie et ne lance jamais rien ─────────────────────


def test_une_action_payante_part_sans_route_et_vers_lenvoi(client):
    """Ce qui coûte n'a **rien à appeler** : la règle est dans la réponse."""

    payantes = [a for a in _actions(client) if a["paiement"] == "a-confirmer"]

    assert payantes, "aucune action payante servie — la liste est-elle vide ?"
    for action in payantes:
        assert action["route"] == "", action["outil"]
        assert action["ou"] == "envoi", action["outil"]


def test_seuls_les_gestes_gratuits_portent_une_route(client):
    """Et une route servie est toujours celle d'un geste qui se fait sur place."""

    for action in _actions(client):
        if action["route"]:
            assert action["paiement"] == "gratuit", action["outil"]
            assert action["ou"] == "ici", action["outil"]
            assert action["route"].startswith(("GET /api/", "POST /api/")), action


def test_les_trois_gestes_dentretien_sont_gratuits_et_jouables(client, double):
    """Les gestes qu'aucun bouton ne déclenchait, et leurs routes vivantes."""

    _une_image(client, double)
    gestes = _par_outil(client)

    for outil, chemin in (
        ("rebuild_library", "/api/library/rebuild"),
        ("realign_project", "/api/universe/realign"),
        ("refresh_models", "/api/models/refresh"),
    ):
        assert gestes[outil]["paiement"] == "gratuit"
        assert gestes[outil]["route"].endswith(chemin)

    # Et elles répondent — une route servie qui rendrait 404 serait une action
    # morte proposée à l'auteur.
    assert client.post("/api/library/rebuild").status_code == 200
    assert client.post("/api/universe/realign", json={}).status_code == 200
    assert client.post("/api/models/refresh").status_code == 200


# ── Critère 2 · Ce qui ne peut pas se faire ne s'affiche pas ─────────────────


def test_sans_personnage_les_gestes_de_personnage_nexistent_pas(client):
    """Ni grisés, ni proposés : **absents**."""

    gestes = _par_outil(client)

    assert "list_characters" not in gestes
    assert "equip_character" not in gestes
    assert "export_character" not in gestes
    assert "generate_pose" not in gestes


def test_un_personnage_créé_fait_paraître_ses_gestes(client):
    """Et la liste s'ouvre d'elle-même quand le jeu s'en donne les moyens."""

    avant = _par_outil(client)
    client.post("/api/characters", json={"nom": "Le pèlerin", "description": "un pèlerin"})
    apres = _par_outil(client)

    assert "list_characters" not in avant
    assert "list_characters" in apres
    assert "generate_pose" in apres


def test_sans_image_les_gestes_dimage_nexistent_pas(client, double):
    """Le jeu neuf ne propose ni retouche, ni découpe, ni sortie."""

    gestes = _par_outil(client)
    assert "edit_asset" not in gestes
    assert "slice_asset" not in gestes
    assert "export_assets" not in gestes
    assert "realign_project" not in gestes

    _une_image(client, double)

    gestes = _par_outil(client)
    assert "edit_asset" in gestes
    assert "realign_project" in gestes


def test_aucune_action_ne_porte_de_raison_de_refus(client):
    """Une raison sous une ligne grisée est un refus déguisé — il n'y en a pas."""

    for action in _actions(client):
        assert "raison" not in action
        assert "grise" not in action


# ── Critère 3 · La liste est celle du serveur ────────────────────────────────


def test_un_outil_ajouté_au_serveur_paraît_dans_la_barre(atelier):
    """**La promesse de la tranche**, tenue à la lettre.

    On monte une application entière, on ajoute un outil à son serveur MCP —
    comme le ferait quelqu'un qui écrit une fonction de plus — et on demande la
    barre. Aucune table à tenir à jour ailleurs : il est là.
    """

    application = creer_application(atelier)

    @application.state.mcp.tool(
        name="count_the_moons",
        title="Count the moons",
        description="A brand new server function, written this morning.",
    )
    async def _compter_les_lunes() -> dict:  # pragma: no cover - jamais appelé
        return {"moons": 2}

    with TestClient(application) as client:
        gestes = _par_outil(client)

    assert "count_the_moons" in gestes


def test_un_outil_sans_fiche_est_injouable_depuis_la_barre(atelier):
    """Le défaut prudent : sans fiche, à confirmer — donc rien à appeler.

    C'est la règle « elle ne paie jamais » tenue **par construction** et non par
    vigilance : l'oubli d'une fiche coûte une étiquette anglaise, jamais un
    centime ni un geste imprévu.
    """

    application = creer_application(atelier)

    @application.state.mcp.tool(
        name="charge_the_moons",
        title="Charge the moons",
        description="Costs money, and nobody wrote its fiche.",
    )
    async def _facturer_les_lunes() -> dict:  # pragma: no cover - jamais appelé
        return {}

    with TestClient(application) as client:
        geste = _par_outil(client)["charge_the_moons"]

    assert geste["paiement"] == "a-confirmer"
    assert geste["route"] == ""
    assert geste["ou"] == "envoi"
    assert geste["titre"] == "Charge the moons"


def test_tout_outil_livré_porte_sa_fiche(atelier):
    """Le jour où l'on en ajoute un, cet essai réclame sa fiche française.

    Il ne refuse pas l'outil — la barre le montrerait quand même. Il refuse
    qu'on **livre** un outil sans l'avoir nommé en français, ce qui est un autre
    manquement : la liste noire de `Vocabulaire.dc.html` vaut aussi ici.
    """

    application = creer_application(atelier)
    with TestClient(application):
        pass
    outils = application.state.mcp
    import asyncio

    for outil in asyncio.run(outils.list_tools()):
        assert (outil.meta or {}).get("barre"), outil.name


# ── Critère 4 · Les six verbes sont fixes ────────────────────────────────────


def test_les_six_verbes_et_pas_un_septième(client, double):
    """Six groupes dans la barre, quoi qu'un outil déclare."""

    assert VERBES == ("aller", "creer", "generer", "travailler", "sortir", "regler")

    _une_image(client, double)
    client.post("/api/characters", json={"nom": "Le pèlerin", "description": "un pèlerin"})
    reponse = client.get("/api/actions").json()

    assert reponse["verbes"] == list(VERBES)
    assert {a["verbe"] for a in reponse["actions"]} <= set(VERBES)


def test_un_verbe_inventé_retombe_sur_travailler(atelier):
    """La liste est fermée côté serveur, pas seulement côté écran."""

    application = creer_application(atelier)

    @application.state.mcp.tool(
        name="invent_a_verb",
        title="Invent a verb",
        description="Its fiche claims a seventh verb.",
        meta={"barre": {"verbe": "danser", "titre": "Danser", "phrase": ""}},
    )
    async def _inventer() -> dict:  # pragma: no cover - jamais appelé
        return {}

    with TestClient(application) as client:
        assert _par_outil(client)["invent_a_verb"]["verbe"] == "travailler"


def test_les_actions_sont_rendues_dans_lordre_des_verbes(client, double):
    """L'écran groupe sans trier : l'ordre est décidé une fois, ici."""

    _une_image(client, double)
    rangs = [VERBES.index(a["verbe"]) for a in _actions(client)]

    assert rangs == sorted(rangs)


# ── Critère 5 · Un résultat porte son contexte ───────────────────────────────


def test_un_titre_à_nombre_est_compté_par_le_serveur(client, double):
    """« Recalculer le rendu des 45 images » — le 45 est compté, pas deviné."""

    _une_image(client, double)
    titre = _par_outil(client)["realign_project"]["titre"]

    images = client.get("/api/library").json()
    compte = next(
        p["assets"] for p in images["projets"] if p["identifiant"] == images["courant"]
    )
    assert f"{compte} images" in titre


def test_chaque_action_dit_où_elle_mène(client, double):
    """Un résultat sans destination serait un cul-de-sac."""

    _une_image(client, double)
    for action in _actions(client):
        assert action["ou"], action["outil"]
        assert action["phrase"] or action["paiement"] == "a-confirmer", action["outil"]


def test_la_liste_est_scopée_au_jeu_visé(client, double):
    """Un jeu vide ne montre pas les gestes d'un jeu plein."""

    _une_image(client, double)
    client.post("/api/projects", json={"nom": "Forêt"})  # ouvre « foret »

    assert "edit_asset" not in _par_outil(client, projet="foret")
    assert "edit_asset" in _par_outil(client, projet="bac-a-sable")
