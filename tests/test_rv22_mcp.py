# -*- coding: utf-8 -*-
"""RV22 — l'agent (MCP) écarte et supprime une image, par les mêmes services
que le bandeau « Pas encore rangé ».

Trois outils, sur le modèle d'`edit_asset` (`tests/test_t7.py`) : `detach_asset`
rejoue `atelier.production.designer(asset, personnage=None, pose=None)` — le
même service que `PUT /assets/{id}/character` à `personnage: null` ; `delete_asset`
et `restore_asset` rejouent `atelier.bibliotheque.supprimer` /
`annuler_suppression` — les mêmes services que `POST /assets/delete` et
`POST /assets/restore`. Aucun chemin parallèle : un essai qui tomberait ici
sans que le service change signalerait une divergence entre l'agent et l'écran.

**Aucun essai ne coûte un centime** — le fournisseur est doublé, comme partout.
"""

from __future__ import annotations

import time

import pytest

from atelier.mcp.serveur import creer_serveur
from mcp.server.mcpserver.exceptions import MCPServerError

from tests.conftest import image_sujet, planche_sujets

MODELE = "essai:rend-du-png"


@pytest.fixture
def mcp(client, atelier):
    """Le serveur MCP, sur l'atelier déjà ouvert par le démarrage de `client`
    (même règle que `test_t7.py`) : construire les deux sur le même atelier
    évite d'ouvrir deux fois, et laisse `client` bâtir un scénario (planche,
    dépliages) que le MCP vérifie ensuite."""
    return creer_serveur(atelier)


async def appeler(serveur, nom: str, **arguments):
    """Un outil, appelé comme un client le ferait. Rend le contenu structuré."""
    try:
        resultat = await serveur.call_tool(nom, arguments)
    except MCPServerError as refus:
        raise AssertionError(f"{nom} a refusé : {refus}") from None
    if resultat.is_error:
        texte = " ".join(
            bloc.text for bloc in resultat.content if hasattr(bloc, "text")
        )
        raise AssertionError(f"{nom} a refusé : {texte}")
    return resultat.structured_content


async def refuser(serveur, nom: str, **arguments) -> str:
    """L'inverse : on attend un refus, et on rend sa phrase pour la lire —
    c'est elle que l'agent répétera à l'auteur."""
    try:
        resultat = await serveur.call_tool(nom, arguments)
    except MCPServerError as refus:
        return str(refus)
    assert resultat.is_error, f"{nom} devait refuser et ne l'a pas fait"
    return " ".join(bloc.text for bloc in resultat.content if hasattr(bloc, "text"))


# ── De quoi jouer une planche à dépendants (comme test_p1b_depliages.py) ────


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"le lot « {identifiant} » n'est jamais arrivé à terme")


def _planche_a_dependants(client, double) -> str:
    """Une planche de quatre poses, puis deux images dépliées à la main — le
    même montage que `test_supprimer_la_planche_sans_confirmer_est_refuse_avec_le_compte`
    dans `test_p1b_depliages.py`, pour obtenir des dépendants."""
    double.rendre = lambda: planche_sujets(4)
    personnage = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    ).json()["personnage"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un nain forgeron",
            "personnage": personnage["identifiant"],
            "poses": poses[:4],
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    assert _attendre(client, identifiant)["statut"] == "reussie"
    planche = f"{identifiant}-0"

    propose = client.get(f"/api/assets/{planche}/unfoldings/proposal").json()
    refait = client.post(
        f"/api/assets/{planche}/unfoldings", json={"boites": propose["boites"][:2]}
    )
    assert refait.status_code == 201, refait.text
    return planche


# ── Écarter, puis relire (US-122, le même service que la fiche) ─────────────


async def test_ecarter_puis_relire(atelier, mcp, double):
    """L'image quitte le sujet et retourne à la Galerie, sans être supprimée."""
    projet = atelier.bibliotheque.courant
    personnage = atelier.production.creer_personnage(projet, "Champy")
    importe = atelier.generations.importer(image_sujet(), "champy.png")["asset"]
    asset_id = importe["identifiant"]
    atelier.production.designer(
        asset_id, projet=projet, personnage=personnage.identifiant, pose=None
    )
    assert atelier.assets.lire(asset_id).personnage == personnage.identifiant

    reponse = await appeler(mcp, "detach_asset", asset_id=asset_id)

    assert reponse["character"] is None
    # Toujours en bibliothèque — pas supprimée, seulement détachée.
    relu = atelier.assets.lire(asset_id)
    assert relu is not None
    assert relu.personnage is None
    # Et relisible par un second outil, comme depuis la fiche.
    fiche = await appeler(mcp, "get_asset", asset_id=asset_id)
    assert fiche["id"] == asset_id


async def test_ecarter_une_matiere_est_refuse(atelier, mcp, double):
    """Une matière n'a pas de sujet — le même refus que la fiche."""
    importe = atelier.generations.importer(image_sujet(), "tuile.png")["asset"]
    asset_id = importe["identifiant"]
    atelier.bibliotheque.declarer_matiere(asset_id, True, projet=None)

    raison = await refuser(mcp, "detach_asset", asset_id=asset_id)

    assert "matière" in raison


# ── Supprimer, puis restaurer (US-27, le même service que la Galerie) ───────


async def test_supprimer_puis_restaurer(atelier, mcp, double):
    importe = atelier.generations.importer(image_sujet(), "epee.png")["asset"]
    asset_id = importe["identifiant"]

    supprime = await appeler(mcp, "delete_asset", asset_ids=[asset_id])

    assert supprime["deleted"] == [asset_id]
    assert supprime["undo_seconds"] > 0
    # Sortie de la bibliothèque tout de suite (US-27) — un outil qui la relit
    # ne la trouve plus.
    assert atelier.assets.lire(asset_id) is None
    raison = await refuser(mcp, "get_asset", asset_id=asset_id)
    assert "aucun asset" in raison

    restaure = await appeler(mcp, "restore_asset", asset_ids=[asset_id])

    assert [a["id"] for a in restaure["assets"]] == [asset_id]
    assert atelier.assets.lire(asset_id) is not None


async def test_restaurer_au_dela_du_delai_est_refuse(atelier, mcp, double):
    """« Annulable un instant » (AGENTS.md, RV22) — refusé, en le disant, une
    fois le délai passé. Même service que la Galerie : l'agent ne peut pas
    faire plus que l'écran."""
    importe = atelier.generations.importer(image_sujet(), "arc.png")["asset"]
    asset_id = importe["identifiant"]
    await appeler(mcp, "delete_asset", asset_ids=[asset_id])
    # On fait vieillir la suppression au lieu d'attendre le vrai délai —
    # même geste que `_purger` dans `test_p1b_depliages.py`.
    asset = atelier.base.lire_asset(asset_id)
    asset.supprime_le = time.time() - 3600
    atelier.base.enregistrer_asset(asset)

    raison = await refuser(mcp, "restore_asset", asset_ids=[asset_id])

    assert "expiré" in raison


# ── Un identifiant inconnu se refuse, lisiblement ────────────────────────────


async def test_ecarter_un_identifiant_inconnu_est_refuse(atelier, mcp, double):
    raison = await refuser(mcp, "detach_asset", asset_id="rien-du-tout")
    assert "aucun asset" in raison


async def test_supprimer_un_identifiant_inconnu_est_refuse(atelier, mcp, double):
    raison = await refuser(mcp, "delete_asset", asset_ids=["rien-du-tout"])
    assert "aucun asset" in raison


# ── Une planche partagée demande confirmation, comme la Galerie ─────────────


async def test_supprimer_une_planche_partagee_remonte_planche_a_confirmer(
    client, atelier, mcp, double
):
    planche = _planche_a_dependants(client, double)

    raison = await refuser(mcp, "delete_asset", asset_ids=[planche])

    # La phrase du refus, celle que `PlancheAConfirmer` écrit (P1b) — le
    # même texte que la route HTTP renvoie dans son 409.
    assert "dépendent de cette planche" in raison
    assert "Confirmez pour la supprimer" in raison
    # Rien n'est parti — comme le 409 de la route.
    assert atelier.base.lire_asset(planche).supprime_le is None

    confirme = await appeler(
        mcp, "delete_asset", asset_ids=[planche], confirm=True
    )

    assert confirme["deleted"] == [planche]
    assert atelier.base.lire_asset(planche).supprime_le is not None
