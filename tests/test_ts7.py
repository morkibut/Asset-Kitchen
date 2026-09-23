# -*- coding: utf-8 -*-
"""TS7 · Les gestes de Mixboard (`docs/PLAN-de-la-toile-au-sujet.md`).

**Ce que ce fichier couvre, et rien de plus** : « Encore » relance la même
demande sans rien retaper, et ça inclut les références — la phrase, le
modèle et la taille le savaient déjà depuis TS5 ; les références ne
l'étaient pas. Ce fichier vérifie donc un seul contrat serveur :
`ServiceUnivers.phrase_de_carte` remonte désormais `references`, dans la
forme exacte que `POST /api/generations` a reçue, pour qu'« Encore » puisse
les rejouer telles quelles.

Le reste de `TS7` — Combiner, Encore, le lien visible — est un geste
d'écran, et se vérifie dans `ToileFabrique.test.tsx` et `Toile.test.tsx`.

**Rien ne coûte un centime** : le fournisseur est doublé, et rend une vraie
image PNG de taille fixe sans appel réseau.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest

MODELE = "essai:rend-du-png"
GUIDE = Path(__file__).resolve().parents[1] / "essais" / "guide"


def _planche() -> tuple[str, bytes]:
    planches = sorted(GUIDE.glob("*.png"))
    if not planches:
        pytest.skip("les planches de `essais/guide/` ne sont pas sur ce disque")
    return planches[0].name, planches[0].read_bytes()


def _carte(client) -> str:
    """Une carte image posée sur la toile — de quoi la prendre en référence,
    comme le fait `PRENDRE_REFERENCE` / « Développer ce sujet » à l'écran."""
    nom, octets = _planche()
    rendue = client.post("/api/board/paste", params={"nom": nom}, content=octets)
    assert rendue.status_code == 201, rendue.text
    return rendue.json()["carte"]["identifiant"]


def _attendre(client, identifiant: str, tours: int = 200) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        statuts = {e["statut"] for e in lue["emplacements"]}
        if statuts <= {"reussie", "echouee", "interrompue"}:
            return lue
        time.sleep(0.01)
    return client.get(f"/api/generations/{identifiant}").json()


def _poser_sur_la_toile(client, projet: str, generation: dict) -> dict:
    rang = generation["emplacements"][0]["rang"]
    identifiant = f"{generation['identifiant']}-{rang}"
    posee = client.post(f"/api/projects/{projet}/board/assets/{identifiant}")
    assert posee.status_code == 200, posee.text
    return posee.json()["carte"]


def _carte_du_tableau(client, projet: str, identifiant: str) -> dict:
    tableau = client.get("/api/board", params={"projet": projet}).json()
    return next(c for c in tableau["cartes"] if c["identifiant"] == identifiant)


def test_la_phrase_porte_les_references_telles_que_l_appel_les_a_recues(client, atelier):
    """**Le critère d'« Encore » (TS7)** : la carte fabriquée à partir d'une
    référence de la toile relit cette référence, dans la forme exacte —
    `asset`, `role`, `origine` — que `POST /api/generations` a reçue. C'est
    cette liste-là qu'« Encore » rejoue sans rien retaper."""
    projet = atelier.bibliotheque.courant
    reference = _carte(client)

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "une variante plus sombre",
            "references": [{"asset": reference, "role": "edition", "origine": "carte"}],
        },
    )
    assert reponse.status_code == 202, reponse.text
    generation = _attendre(client, reponse.json()["identifiant"])
    assert generation["emplacements"][0]["statut"] == "reussie", generation

    posee = _poser_sur_la_toile(client, projet, generation)
    carte = _carte_du_tableau(client, projet, posee["identifiant"])

    assert carte["phrase"]["references"] == [
        {"asset": reference, "role": "edition", "origine": "carte"}
    ]


def test_une_carte_sans_reference_relit_une_liste_vide(client, atelier):
    """Le cas courant — aucune référence — ne doit rien inventer : `Encore`
    sur une carte fabriquée en texte seul relance avec `references: []`,
    jamais `null` ni un champ absent qui obligerait l'écran à deviner."""
    projet = atelier.bibliotheque.courant

    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "une lanterne posée au sol"},
    )
    assert reponse.status_code == 202, reponse.text
    generation = _attendre(client, reponse.json()["identifiant"])

    posee = _poser_sur_la_toile(client, projet, generation)
    carte = _carte_du_tableau(client, projet, posee["identifiant"])

    assert carte["phrase"]["references"] == []
