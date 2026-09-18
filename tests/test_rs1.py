# -*- coding: utf-8 -*-
"""Les critères de RS1 — l'usage d'une référence promue, et le choix selon le
contexte (`docs/PLAN-references-du-sujet.md`).

**La panne que ça répare, le 18 septembre 2026.** Champy fabriqué au bâton : la
planche de ses quatre directions était jointe, décrite au modèle comme « le même
personnage », et le modèle a rendu **un seul** Champy en vue isométrique. Une
référence promue partait avec *tous* les appels, et rien ne distinguait une
planche de quatre vues d'une vue de face.

**Ce qui se mesure ici, sans un centime** — le double du fournisseur rend ses
images, et les écrans se composent sans appel : qu'une référence déjà promue
reste libre et parte comme avant, qu'une case dans une direction n'emporte que
sa vue (sinon la planche), qu'une planche par directions emporte la planche,
qu'une direction que le sujet ne tient pas se refuse, que le texte dise une
planche comme une planche, et que l'écran de confirmation nomme l'usage sans
cesser de laisser décocher.
"""

from __future__ import annotations

import itertools
import time

from atelier.domaine.personnage import Personnage, references_du_contexte

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"

_DISTINCTES = itertools.count(3)


# ── Les montages ─────────────────────────────────────────────────────────────


def _creer(client, nom: str = "Champy") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _vue(client) -> None:
    """Une vue de dessus : quatre directions, `sud nord est ouest`."""
    reponse = client.put("/api/universe", json={"vue": "vue-dessus-34"})
    assert reponse.status_code == 200, reponse.text


def _image(client, tmp_path) -> str:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"reference-{rang}-{next(_DISTINCTES)}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    return reponse.json()["asset"]["identifiant"]


def _promouvoir(client, chose: str, asset: str, usage: str | None = None):
    corps: dict = {"asset": asset}
    if usage is not None:
        corps["usage"] = usage
    return client.put(f"/api/characters/{chose}/references", json=corps)


def _rangees(client, tmp_path, chose: str, **usages: str) -> dict[str, str]:
    """Promouvoir une image par usage, **dans l'ordre donné** — l'ordre de
    promotion est l'ordre d'envoi."""
    assets = {}
    for nom, usage in usages.items():
        asset = _image(client, tmp_path)
        reponse = _promouvoir(client, chose, asset, usage)
        assert reponse.status_code == 200, reponse.text
        assets[nom] = asset
    return assets


def _envoi(client, chose: str, **corps) -> dict:
    """L'écran *Relire avant l'envoi* — il compose, il ne paie pas."""
    reponse = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "a small mushroom", "personnage": chose, **corps},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _lignes(envoi: dict) -> list[dict]:
    return envoi["images"]["lignes"]


def _texte(client, chose: str, **contexte) -> str:
    """Le texte exact qui partirait, images nommées comprises."""
    atelier = client.app.state.atelier
    return atelier.generations.apercu(
        "a small mushroom", personnage=chose, modele=MODELE, **contexte
    )["texte"]


def _attendre(client, identifiant: str, tours: int = 60) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


# ── La forme : un usage, relu sans migration ─────────────────────────────────


def test_un_fichier_davant_la_tranche_se_relit_tout_libre():
    """**Aucune migration** : la clé est absente, tout est libre, et un usage
    illisible retombe sur libre plutôt que sur une planche inventée."""
    ancien = Personnage.depuis_json(
        {"identifiant": "champy", "references": ["a", "b"]}
    )
    assert ancien.usages_des_references == {}
    assert ancien.usage_de("a") == "libre"

    abime = Personnage.depuis_json(
        {
            "identifiant": "champy",
            "references": ["a", "b", "c"],
            "usages_des_references": {"a": "planche", "b": "n'importe", "c": 3},
        }
    )
    assert abime.usages_des_references == {"a": "planche"}

    relu = Personnage.depuis_json(abime.en_json())
    assert relu.usages_des_references == {"a": "planche"}


def test_la_regle_du_contexte_tient_en_une_fonction():
    """Libres toujours ; planche pour une planche ; la direction de la case,
    sinon la planche ; rien de typé sans contexte."""
    references = ("libre", "plan", "sud", "nord")
    usages = {"plan": "planche", "sud": "direction:sud", "nord": "direction:nord"}

    def partent(**contexte):
        return [a for a, _ in references_du_contexte(references, usages, **contexte)]

    assert partent(planche=False, direction=None) == ["libre"]
    assert partent(planche=True, direction=None) == ["libre", "plan"]
    assert partent(planche=False, direction="sud") == ["libre", "sud"]
    assert partent(planche=False, direction="est") == ["libre", "plan"]


# ── La route : régler l'usage, refuser ce que le sujet ne tient pas ──────────


def test_une_reference_deja_promue_est_libre_et_la_fiche_le_dit(client, tmp_path):
    chose = _creer(client)
    asset = _image(client, tmp_path)
    assert _promouvoir(client, chose["identifiant"], asset).status_code == 200

    lignes = client.get(f"/api/characters/{chose['identifiant']}/references").json()[
        "lignes"
    ]

    assert [(l["reference"], l["usage"]) for l in lignes] == [(asset, "libre")]


def test_lusage_se_regle_se_garde_et_se_defait(client, tmp_path):
    """Ranger est un clic ; repromouvoir sans usage ne défait pas le rangement ;
    dépromouvoir l'efface."""
    chose = _creer(client)
    _vue(client)
    asset = _image(client, tmp_path)

    reponse = _promouvoir(client, chose["identifiant"], asset, "direction:sud")
    assert reponse.status_code == 200, reponse.text
    ligne = reponse.json()["references"]["lignes"][0]
    assert ligne["usage"] == "direction:sud"
    assert ligne["usage_nom"] == "direction sud"

    # Repromue sans usage : elle garde sa place.
    _promouvoir(client, chose["identifiant"], asset)
    atelier = client.app.state.atelier
    projet = atelier.bibliotheque.courant
    assert atelier.production.personnage(
        projet, chose["identifiant"]
    ).usages_des_references == {asset: "direction:sud"}

    # Rendue libre : la clé disparaît du fichier.
    _promouvoir(client, chose["identifiant"], asset, "libre")
    assert atelier.production.personnage(
        projet, chose["identifiant"]
    ).usages_des_references == {}

    # Dépromue : l'usage part avec elle.
    _promouvoir(client, chose["identifiant"], asset, "planche")
    client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset, "promue": False},
    )
    vise = atelier.production.personnage(projet, chose["identifiant"])
    assert vise.references == ()
    assert vise.usages_des_references == {}


def test_une_direction_que_le_sujet_ne_tient_pas_est_refusee(client, tmp_path):
    """**Une vue rangée dans une direction qui n'existe pas ne partirait
    jamais**, et personne ne verrait pourquoi : le refus arrive avant d'écrire."""
    chose = _creer(client)
    _vue(client)
    asset = _image(client, tmp_path)

    inconnue = _promouvoir(client, chose["identifiant"], asset, "direction:dessus")
    assert inconnue.status_code == 409, inconnue.text
    assert "dessus" in inconnue.text

    mot = _promouvoir(client, chose["identifiant"], asset, "de face")
    assert mot.status_code == 409, mot.text

    # Rien n'a été écrit : l'image n'est même pas promue.
    assert (
        client.get(f"/api/characters/{chose['identifiant']}/references").json()["lignes"]
        == []
    )


def test_une_direction_rangee_pour_toutes_les_poses_nest_plus_tenue(client, tmp_path):
    """Le jeu a un nord, mais ce sujet-là ne le tient pour aucune pose : une vue
    du nord ne partirait jamais pour lui."""
    chose = _creer(client)
    _vue(client)
    atelier = client.app.state.atelier
    projet = atelier.bibliotheque.courant
    vise = atelier.production.personnage(projet, chose["identifiant"])
    for pose in vise.tenues(atelier.production.plan_de(projet, vise)):
        reponse = client.put(
            f"/api/characters/poses/{pose.identifiant}/directions/nord",
            json={"rangee": True, "portee": "chose", "personnage": chose["identifiant"]},
        )
        assert reponse.status_code == 200, reponse.text

    refus = _promouvoir(client, chose["identifiant"], _image(client, tmp_path), "direction:nord")

    assert refus.status_code == 409, refus.text


# ── Le choix selon le contexte, vu par l'écran de confirmation ───────────────


def test_sans_rien_ranger_rien_ne_change(client, tmp_path):
    """**Le critère qui garde tout le reste** : une référence promue sans usage
    part partout, avec son ancienne provenance et son ancienne phrase."""
    chose = _creer(client)
    _vue(client)
    asset = _image(client, tmp_path)
    _promouvoir(client, chose["identifiant"], asset)

    for contexte in (
        {},
        {"pose": "marche", "direction": "sud"},
        {"pose": "marche", "directions": ["sud", "nord", "est", "ouest"]},
    ):
        lignes = _lignes(_envoi(client, chose["identifiant"], **contexte))
        assert [(l["asset"], l["provenance"]) for l in lignes] == [
            (asset, "image promue")
        ], contexte

    texte = _texte(client, chose["identifiant"], pose="marche", direction="sud")
    assert "Image 1 — THE SAME CHARACTER, already drawn" in texte
    assert "CHARACTER SHEET" not in texte


def test_une_case_dans_une_direction_nemporte_que_sa_vue(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client,
        tmp_path,
        chose["identifiant"],
        libre="libre",
        sud="direction:sud",
        nord="direction:nord",
        planche="planche",
    )

    lignes = _lignes(
        _envoi(client, chose["identifiant"], pose="marche", direction="sud")
    )

    assert [(l["asset"], l["provenance"]) for l in lignes] == [
        (rangees["libre"], "image promue"),
        (rangees["sud"], "image promue · direction sud"),
    ]


def test_une_direction_sans_vue_se_replie_sur_la_planche(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client,
        tmp_path,
        chose["identifiant"],
        libre="libre",
        nord="direction:nord",
        planche="planche",
    )

    lignes = _lignes(
        _envoi(client, chose["identifiant"], pose="marche", direction="est")
    )

    assert [(l["asset"], l["provenance"]) for l in lignes] == [
        (rangees["libre"], "image promue"),
        (rangees["planche"], "image promue · planche"),
    ]


def test_une_planche_par_directions_emporte_la_planche(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client,
        tmp_path,
        chose["identifiant"],
        libre="libre",
        sud="direction:sud",
        planche="planche",
    )

    lignes = _lignes(
        _envoi(
            client,
            chose["identifiant"],
            pose="marche",
            directions=["sud", "nord", "est", "ouest"],
        )
    )

    assert [l["asset"] for l in lignes] == [rangees["libre"], rangees["planche"]]


def test_sans_case_ni_direction_rien_de_type_ne_part(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client, tmp_path, chose["identifiant"], libre="libre", planche="planche"
    )

    lignes = _lignes(_envoi(client, chose["identifiant"]))

    assert [l["asset"] for l in lignes] == [rangees["libre"]]


def test_decocher_une_reference_rangee_marche_toujours(client, tmp_path):
    """Le décochage de cet appel s'applique après le choix du contexte, comme
    à toute autre image jointe."""
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(client, tmp_path, chose["identifiant"], planche="planche")

    lignes = _lignes(
        _envoi(
            client,
            chose["identifiant"],
            pose="marche",
            direction="est",
            references_ecartees=[rangees["planche"]],
        )
    )

    assert lignes[0]["asset"] == rangees["planche"]
    assert lignes[0]["ecartee_par"] == "décoché pour cet appel"
    assert lignes[0]["cochee"] is False


# ── Le texte : une planche se dit planche, une vue se dit vue ────────────────


def test_le_texte_dit_une_planche_comme_une_planche(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    _rangees(client, tmp_path, chose["identifiant"], planche="planche")

    texte = _texte(client, chose["identifiant"], pose="marche", direction="est")

    assert "Image 1 — CHARACTER SHEET of the same character" in texte
    assert "every view is the same character" in texte


def test_le_texte_dit_une_vue_sous_son_angle(client, tmp_path):
    chose = _creer(client)
    _vue(client)
    _rangees(client, tmp_path, chose["identifiant"], sud="direction:sud")

    texte = _texte(client, chose["identifiant"], pose="marche", direction="sud")

    assert "Image 1 — THE SAME CHARACTER, seen from this angle (facing south" in texte


def test_lappel_envoie_la_planche_et_la_nomme(client, tmp_path, double):
    """**Ce qui part vraiment**, par la soumission et le double : la planche du
    sujet, son usage enregistré sur la génération, et la phrase dans le texte.
    Le gabarit de la grille la suit — deux images, le plafond du double."""
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client,
        tmp_path,
        chose["identifiant"],
        sud="direction:sud",
        planche="planche",
    )

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a small mushroom",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "directions": ["sud", "nord", "est", "ouest"],
        },
    )

    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert generation["references"] == [
        {
            "asset": rangees["planche"],
            "role": "reference",
            "origine": "asset",
            "usage": "planche",
        }
    ]
    assert "Image 1 — CHARACTER SHEET" in generation["demande"]["prompt"]
    assert "Image 2 — EMPTY LAYOUT GRID" in generation["demande"]["prompt"]
    _attendre(client, generation["identifiant"])


def test_lappel_dune_case_envoie_sa_vue_seule(client, tmp_path, double):
    chose = _creer(client)
    _vue(client)
    rangees = _rangees(
        client,
        tmp_path,
        chose["identifiant"],
        sud="direction:sud",
        nord="direction:nord",
        planche="planche",
    )

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a small mushroom",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "direction": "nord",
        },
    )

    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert [r["asset"] for r in generation["references"]] == [rangees["nord"]]
    assert "seen from this angle (facing north" in generation["demande"]["prompt"]
    _attendre(client, generation["identifiant"])
