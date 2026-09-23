# -*- coding: utf-8 -*-
"""TS4 · L'image arrive brute, en 512 ou 1024 (`docs/PLAN-de-la-toile-au-sujet.md`).

La toile qui fabrique essaie ; elle ne livre pas. Une génération marquée
`brut` ne reçoit **aucune** recette à sa naissance — ni détourage, ni
réduction, ni grille, ni palette —, à la différence d'une génération
ordinaire, que le projet habille de sa recette par défaut (grille à 64,
mesuré ailleurs — `tests/test_r3.py`).

**Rien ne coûte un centime** : le double du fournisseur rend une vraie image
PNG de taille fixe (48×32), sans appel réseau.
"""

from __future__ import annotations

import time

MODELE = "essai:rend-du-png"


def _generer(client, **corps):
    return client.post("/api/generations", json={"modele": MODELE, "prompt": "un héron", **corps})


def _attendre(client, identifiant: str, tours: int = 80) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        statuts = {e["statut"] for e in lue["emplacements"]}
        if statuts <= {"reussie", "echouee", "interrompue"}:
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


def _asset_ne(client, atelier, **corps):
    appel = _generer(client, **corps)
    assert appel.status_code == 202, appel.text
    generation = _attendre(client, appel.json()["identifiant"])
    rang = generation["emplacements"][0]["rang"]
    identifiant = f"{generation['identifiant']}-{rang}"
    return atelier.assets.lire(identifiant)


def test_brut_ne_recoit_aucune_recette_a_la_naissance(client, atelier):
    """Ni détourage, ni réduction, ni grille, ni palette."""
    asset = _asset_ne(client, atelier, brut=True)
    assert asset.recette.vide
    # Le rendu, lu sans argument, est donc exactement le brut : pas de
    # réduction à la grille du jeu (64), la taille rendue par le double (48×32).
    octets, _ = atelier.assets.octets(asset)
    octets_brut, _ = atelier.assets.octets(asset, brut=True)
    assert octets == octets_brut
    assert (asset.largeur, asset.hauteur) == (48, 32)


def test_une_generation_ordinaire_recoit_toujours_la_recette_du_projet(client, atelier):
    """Le contraste : sans `brut`, le défaut d'avant TS4 ne bouge pas."""
    asset = _asset_ne(client, atelier)
    assert not asset.recette.vide
    assert asset.recette.grille is not None
    assert asset.recette.grille.cible == 64


def test_brut_ne_s_ecrit_dans_le_disque_que_s_il_est_vrai(client):
    """Un `generation.json` d'avant TS4 reste celui d'avant — même règle que
    `premiere_planche` (TS3)."""
    ordinaire = _generer(client).json()
    assert "brut" not in ordinaire["demande"]

    marquee = _generer(client, brut=True, identifiant="brut-1").json()
    assert marquee["demande"]["brut"] is True


def test_la_resolution_demandee_voyage_jusqu_a_la_generation(client):
    """**Le catalogue décide**, mais ce que l'auteur a choisi doit au moins
    partir dans la demande pour que le modèle puisse le lire."""
    generation = _generer(client, resolution="512", identifiant="taille-1").json()
    assert generation["demande"]["resolution"] == "512"


def test_le_texte_repris_part_seul_meme_marque_brut(client):
    """`brut` ne touche que le traitement à la naissance — le texte suit sa
    propre règle, `repris` (US-159/US-160), inchangée par TS4."""
    generation = _generer(client, brut=True, repris=True, identifiant="texte-1").json()
    assert generation["demande"]["prompt"] == "un héron"
