# -*- coding: utf-8 -*-
"""Les critères d'acceptation de TS1 — le Codex montre le portrait.

`docs/PLAN-de-la-toile-au-sujet.md`, tranche TS1 : la vignette d'un sujet, sur
la carte de sa famille, est son portrait choisi (`Personnage.image_de_reference`,
posé depuis la fiche — RP19) quand il y en a un et qu'il désigne toujours une
image vivante de ce sujet. Sans choix, ou si l'asset choisi n'existe plus, est
écarté ou n'est plus de ce sujet, la règle d'hier s'applique : la plus fraîche
gagne (B9.4).

Aucun essai ne coûte un centime : les images sont importées, jamais générées.
"""

from __future__ import annotations

import itertools
from dataclasses import replace

from tests.conftest import image_sujet

_DISTINCTES = itertools.count(3)


def _creer(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom, "description": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _plan(client) -> list[str]:
    return [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]


def _poser(client, tmp_path, personnage: str, pose: str) -> str:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{personnage}-{pose}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": personnage, "pose": pose},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["identifiant"]


def _choisir_le_portrait(client, personnage: str, asset: str | None) -> None:
    reponse = client.put(
        f"/api/characters/{personnage}/reference-image", json={"asset": asset}
    )
    assert reponse.status_code == 200, reponse.text


def _vignette(client, famille: str = "personnages") -> dict | None:
    page = client.get(f"/api/characters/families/{famille}").json()
    return page["personnages"][0]["vignette"]


def test_sans_portrait_choisi_la_vignette_reste_la_plus_fraiche(
    client, atelier, tmp_path
):
    """La règle d'aujourd'hui, intacte tant qu'aucun portrait n'a été choisi."""
    pelerin = _creer(client)
    plan = _plan(client)
    _poser(client, tmp_path, pelerin, plan[0])
    derniere = _poser(client, tmp_path, pelerin, plan[1])

    assert _vignette(client)["identifiant"] == derniere


def test_un_portrait_choisi_plus_ancien_gagne(client, atelier, tmp_path):
    """**Le cœur de TS1** : le portrait choisi prime sur la fraîcheur, même
    quand une image plus récente existe."""
    pelerin = _creer(client)
    plan = _plan(client)
    ancienne = _poser(client, tmp_path, pelerin, plan[0])
    _poser(client, tmp_path, pelerin, plan[1])

    _choisir_le_portrait(client, pelerin, ancienne)

    assert _vignette(client)["identifiant"] == ancienne


def test_un_portrait_pointant_un_asset_supprime_retombe_sur_la_plus_fraiche(
    client, atelier, tmp_path
):
    """Le repli de RP19, tenu aussi par la carte du Codex : une image choisie
    puis écartée de la bibliothèque ne désigne plus rien, et la vignette ne
    doit pas se taire ni casser — elle reprend la règle d'hier."""
    pelerin = _creer(client)
    plan = _plan(client)
    choisie = _poser(client, tmp_path, pelerin, plan[0])
    derniere = _poser(client, tmp_path, pelerin, plan[1])
    _choisir_le_portrait(client, pelerin, choisie)
    assert _vignette(client)["identifiant"] == choisie

    reponse = client.post("/api/assets/delete", json={"identifiants": [choisie]})
    assert reponse.status_code == 200, reponse.text

    assert _vignette(client)["identifiant"] == derniere


def test_retirer_le_portrait_ramene_aussi_la_plus_fraiche(client, atelier, tmp_path):
    """Retirer et choisir sont le même geste (RP19) : une chaîne vide efface
    le choix et la carte retombe sur le repli."""
    pelerin = _creer(client)
    plan = _plan(client)
    choisie = _poser(client, tmp_path, pelerin, plan[0])
    derniere = _poser(client, tmp_path, pelerin, plan[1])
    _choisir_le_portrait(client, pelerin, choisie)
    assert _vignette(client)["identifiant"] == choisie

    _choisir_le_portrait(client, pelerin, None)

    assert _vignette(client)["identifiant"] == derniere


def test_un_portrait_devenu_un_calque_ne_compte_plus(client, atelier, tmp_path):
    """Un corps, jamais une pièce (B9.4) — vaut aussi pour un portrait choisi :
    s'il devient un calque après coup, il ne désigne plus une image fixe de ce
    sujet et la carte retombe sur la plus fraîche."""
    pelerin = _creer(client)
    plan = _plan(client)
    choisie = _poser(client, tmp_path, pelerin, plan[0])
    derniere = _poser(client, tmp_path, pelerin, plan[1])
    _choisir_le_portrait(client, pelerin, choisie)
    assert _vignette(client)["identifiant"] == choisie

    asset = atelier.base.lire_asset(choisie)
    atelier.base.enregistrer_asset(replace(asset, piece="casque"))

    assert _vignette(client)["identifiant"] == derniere


def test_le_portrait_choisi_n_ajoute_pas_d_aller_retour_par_sujet(
    client, atelier, tmp_path, monkeypatch
):
    """**Ce que la tranche ne doit pas coûter.** Mesuré en allers-retours,
    jamais en secondes (`AGENTS.md`, § 8sexies) : deux sujets avec portrait
    choisi ou douze doivent ouvrir le même nombre de connexions, sinon un
    aller-retour par sujet s'est glissé dans la vignette."""
    plan = _plan(client)

    compteur = itertools.count()

    def _grille_avec_portraits(nombre: int) -> None:
        for _ in range(nombre):
            sujet = _creer(client, f"Sujet {next(compteur)}")
            image = _poser(client, tmp_path, sujet, plan[0])
            _choisir_le_portrait(client, sujet, image)

    ouvertures: list[str] = []
    vraie = atelier.base._connexion

    def notee():
        ouvertures.append("x")
        return vraie()

    _grille_avec_portraits(2)
    monkeypatch.setattr(atelier.base, "_connexion", notee)
    page = client.get("/api/characters/families/personnages", params={"limite": 20}).json()
    assert len(page["personnages"]) == 2
    a_deux = len(ouvertures)

    monkeypatch.setattr(atelier.base, "_connexion", vraie)
    _grille_avec_portraits(10)
    ouvertures.clear()
    monkeypatch.setattr(atelier.base, "_connexion", notee)
    page = client.get("/api/characters/families/personnages", params={"limite": 20}).json()
    assert len(page["personnages"]) == 12
    a_douze = len(ouvertures)

    assert a_deux == a_douze, (
        f"{a_deux} ouvertures pour deux sujets avec portrait, {a_douze} pour "
        "douze : un aller-retour par sujet s'est glissé dans la vignette"
    )
