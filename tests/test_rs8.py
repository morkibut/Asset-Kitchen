# -*- coding: utf-8 -*-
"""Les critères de RS8 — chaque vue dans sa direction (`docs/PLAN-references-du-sujet.md`).

**Le geste que ça retire, relevé le 18 septembre 2026** : après la découpe de
chaque planche refaite de Champy, l'auteur rangeait chaque image à la main dans
sa direction. La planche du sujet dit maintenant l'ordre de ses vues (« sud,
est, nord, ouest »), et la découpe à l'arrivée donne la n-ième direction à la
n-ième image — la position décide, aucun modèle ne regarde l'image.

**Ce qui se mesure ici, sans un centime** : l'ordre s'écrit, se relit sans
migration, se refuse (image qui n'est pas la planche, direction non tenue,
doublon) ; la découpe range dans l'ordre **parti avec l'appel** ; sans ordre, ou
avec un compte faux, aucune direction et une raison ; et la direction d'un
morceau se corrige sur sa fiche, sans pose.
"""

from __future__ import annotations

import itertools
import time

from atelier.domaine.personnage import Personnage
from tests.conftest import planche_sujets

MODELE = "essai:rend-du-png"
ORDRE = ["sud", "est", "nord", "ouest"]

_DISTINCTES = itertools.count(1)


# ── Les montages ─────────────────────────────────────────────────────────────


def _creer(client, nom: str = "Champy") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _jeu(client) -> None:
    """Une vue de dessus : quatre directions, `sud nord est ouest`."""
    reponse = client.put("/api/universe", json={"vue": "vue-dessus-34", "fond": "#FF70B5"})
    assert reponse.status_code == 200, reponse.text


def _importer(client, tmp_path, octets: bytes) -> str:
    fichier = tmp_path / f"planche-{next(_DISTINCTES)}.png"
    fichier.write_bytes(octets)
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    corps = reponse.json()
    return (corps["asset"] or corps["doublon"])["identifiant"]


def _ranger(client, chose: str, asset: str, usage: str = "planche") -> None:
    reponse = client.put(
        f"/api/characters/{chose}/references", json={"asset": asset, "usage": usage}
    )
    assert reponse.status_code == 200, reponse.text


def _ordonner(client, chose: str, asset: str, ordre):
    return client.put(
        f"/api/characters/{chose}/references/view-order",
        json={"asset": asset, "ordre": ordre},
    )


def _ligne(client, chose: str, asset: str) -> dict:
    lignes = client.get(f"/api/characters/{chose}/references").json()["lignes"]
    return next(l for l in lignes if l["reference"] == asset)


def _sujet_avec_planche(client, tmp_path, vues: int = 4, nom: str = "Champy"):
    chose = _creer(client, nom)
    _jeu(client)
    planche = _importer(client, tmp_path, planche_sujets(vues))
    _ranger(client, chose["identifiant"], planche)
    return chose, planche


def _generer(client, chose: str) -> dict:
    """Soumet une planche refaite coupée à l'arrivée, puis attend sa marque."""
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "the character holds a staff",
            "personnage": chose,
            "garder_mise_en_page": True,
            "decouper_a_l_arrivee": True,
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    lue: dict = {}
    for _ in range(200):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("echouee", "interrompue"):
            break
        marque = lue["emplacements"][0].get("decoupe")
        if lue["statut"] == "reussie" and marque and not marque.get("en_cours"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return lue


# ── L'ordre, sur la fiche du sujet ───────────────────────────────────────────


def test_un_fichier_davant_la_tranche_na_aucun_ordre():
    ancien = Personnage.depuis_json(
        {"identifiant": "champy", "references": ["p"], "usages_des_references": {"p": "planche"}}
    )
    assert ancien.ordres_des_vues == {} and ancien.ordre_des_vues("p") == ()

    abime = Personnage.depuis_json(
        {
            "identifiant": "champy",
            "references": ["p", "q"],
            "usages_des_references": {"p": "planche", "q": "planche"},
            "ordres_des_vues": {"p": ["sud", 3, "", "est"], "q": "sud"},
        }
    )
    assert abime.ordres_des_vues == {"p": ("sud", "est")}
    assert Personnage.depuis_json(abime.en_json()).ordres_des_vues == {"p": ("sud", "est")}


def test_lordre_secrit_se_relit_et_sefface(client, atelier, tmp_path):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]
    assert _ligne(client, ident, planche)["ordre_des_vues"] == []

    reponse = _ordonner(client, ident, planche, ORDRE)
    assert reponse.status_code == 200, reponse.text
    assert _ligne(client, ident, planche)["ordre_des_vues"] == ORDRE
    # **Dans le fichier du sujet**, rangé avec l'image.
    projet = atelier.bibliotheque.courant
    assert atelier.production.personnage(projet, ident).ordres_des_vues == {
        planche: tuple(ORDRE)
    }

    assert _ordonner(client, ident, planche, None).status_code == 200
    assert _ligne(client, ident, planche)["ordre_des_vues"] == []


def test_lordre_se_refuse_avec_sa_raison(client, tmp_path):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]

    inconnue = _ordonner(client, ident, planche, ["sud", "dessus"])
    assert inconnue.status_code == 409 and "ne tient pas la direction « dessus »" in inconnue.text

    double = _ordonner(client, ident, planche, ["sud", "sud"])
    assert double.status_code == 409 and "nommée deux fois" in double.text

    libre = _importer(client, tmp_path, planche_sujets(2))
    _ranger(client, ident, libre, "libre")
    pas_planche = _ordonner(client, ident, libre, ["sud"])
    assert pas_planche.status_code == 409 and "n'est pas la planche" in pas_planche.text

    assert _ligne(client, ident, planche)["ordre_des_vues"] == []


def test_lordre_part_avec_la_planche(client, atelier, tmp_path):
    """Rangée ailleurs, puis de nouveau en planche : l'ordre n'est pas revenu."""
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]
    assert _ordonner(client, ident, planche, ORDRE).status_code == 200

    _ranger(client, ident, planche, "libre")
    _ranger(client, ident, planche, "planche")
    assert _ligne(client, ident, planche)["ordre_des_vues"] == []
    projet = atelier.bibliotheque.courant
    assert atelier.production.personnage(projet, ident).ordres_des_vues == {}


# ── À la découpe ─────────────────────────────────────────────────────────────


def test_la_nieme_image_prend_la_nieme_direction(client, atelier, tmp_path, double):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    assert _ordonner(client, chose["identifiant"], planche, ORDRE).status_code == 200
    double.rendre = lambda: planche_sujets(4)

    generation = _generer(client, chose["identifiant"])
    marque = generation["emplacements"][0]["decoupe"]

    assert generation["demande"]["ordre_des_vues"] == ORDRE
    assert marque["directions"] == ORDRE and "sans_direction" not in marque
    morceaux = [atelier.assets.lire(i) for i in marque["morceaux"]]
    assert [m.direction for m in morceaux] == ORDRE
    for morceau in morceaux:
        assert morceau.personnage == chose["identifiant"] and morceau.pose is None
    assert double.appels == 1


def test_sans_ordre_aucune_direction_et_la_marque_dit_pourquoi(
    client, atelier, tmp_path, double
):
    chose, _ = _sujet_avec_planche(client, tmp_path)
    double.rendre = lambda: planche_sujets(4)

    generation = _generer(client, chose["identifiant"])
    marque = generation["emplacements"][0]["decoupe"]

    assert "ordre_des_vues" not in generation["demande"]
    assert len(marque["morceaux"]) == 4
    assert marque["directions"] is None
    assert "aucun ordre des vues" in marque["sans_direction"]
    assert all(atelier.assets.lire(i).direction is None for i in marque["morceaux"])


def test_un_ordre_du_mauvais_compte_ne_range_rien(client, atelier, tmp_path, double):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    assert _ordonner(client, chose["identifiant"], planche, ["sud", "est", "nord"]).status_code == 200
    double.rendre = lambda: planche_sujets(4)

    generation = _generer(client, chose["identifiant"])
    marque = generation["emplacements"][0]["decoupe"]

    assert len(marque["morceaux"]) == 4  # la découpe, elle, a eu lieu
    assert marque["directions"] is None
    assert "3 directions pour 4 images" in marque["sans_direction"]
    assert all(atelier.assets.lire(i).direction is None for i in marque["morceaux"])


def test_lordre_lu_est_celui_parti_avec_lappel(client, atelier, tmp_path, double):
    """L'atelier s'arrête avant la découpe ; l'auteur change l'ordre ; le
    démarrage coupe la feuille **dans l'ordre que la planche avait au départ**."""
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]
    assert _ordonner(client, ident, planche, ORDRE).status_code == 200
    double.rendre = lambda: planche_sujets(4)

    decoupe = atelier.generations._decoupe
    atelier.generations._decoupe = None
    try:
        reponse = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "the character holds a staff",
                "personnage": ident,
                "garder_mise_en_page": True,
                "decouper_a_l_arrivee": True,
            },
        )
        identifiant = reponse.json()["identifiant"]
        for _ in range(100):
            if client.get(f"/api/generations/{identifiant}").json()["statut"] == "reussie":
                break
            time.sleep(0.05)
    finally:
        atelier.generations._decoupe = decoupe

    assert _ordonner(client, ident, planche, ["nord", "ouest", "sud", "est"]).status_code == 200
    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 1

    marque = atelier.generations._base.lire(identifiant).emplacements[0].decoupe
    assert marque["directions"] == ORDRE
    assert [atelier.assets.lire(i).direction for i in marque["morceaux"]] == ORDRE


def test_la_decoupe_a_la_main_ne_range_toujours_rien(client, atelier, tmp_path, double):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    assert _ordonner(client, chose["identifiant"], planche, ORDRE).status_code == 200
    feuille = atelier.assets.lire(planche)
    milieu = feuille.largeur // 2
    reponse = client.post(
        f"/api/assets/{planche}/slices",
        json={
            "boites": [
                [0, 0, milieu - 1, feuille.hauteur - 1],
                [milieu, 0, feuille.largeur - 1, feuille.hauteur - 1],
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text
    assert all(d["direction"] is None for d in reponse.json()["decoupes"])


# ── La correction, sur la fiche de l'image ───────────────────────────────────


def test_la_direction_dun_morceau_se_corrige_sans_pose(client, atelier, tmp_path, double):
    chose, planche = _sujet_avec_planche(client, tmp_path)
    ident = chose["identifiant"]
    assert _ordonner(client, ident, planche, ORDRE).status_code == 200
    double.rendre = lambda: planche_sujets(4)
    premier = _generer(client, ident)["emplacements"][0]["decoupe"]["morceaux"][0]

    corrige = client.put(
        f"/api/assets/{premier}/character",
        json={"personnage": ident, "pose": None, "direction": "nord"},
    )
    assert corrige.status_code == 200, corrige.text
    assert corrige.json()["direction"] == "nord" and corrige.json()["pose"] is None
    assert atelier.assets.lire(premier).direction == "nord"

    # **Une direction que le sujet ne tient pas se refuse**, et rien ne bouge.
    refus = client.put(
        f"/api/assets/{premier}/character",
        json={"personnage": ident, "pose": None, "direction": "dessus"},
    )
    assert refus.status_code == 409 and "ne tient pas la direction" in refus.text
    assert atelier.assets.lire(premier).direction == "nord"

    # Non dite, elle s'efface — comme avant la tranche.
    efface = client.put(
        f"/api/assets/{premier}/character", json={"personnage": ident, "pose": None}
    )
    assert efface.status_code == 200 and efface.json()["direction"] is None
