# -*- coding: utf-8 -*-
"""TN5 — l'agent fait pareil (`docs/PLAN-transparence-native.md`).

Bout en bout, par le vrai serveur MCP (`serveur.call_tool`, comme un client) :
un personnage fabriqué par l'agent (`generate_asset`) sur un modèle Qwen doublé
qui déclare `transparence=True` reçoit une image d'un vrai fond vide (reprise
de `tests/fixtures/banc_tn3/`) et **naît détourée par le modèle** — exactement
la règle de TN2/TN3, lue par le même service
(`ServiceGenerations.transparence_de_l_appel`, `demandee_par`). Un décor,
lui, ne la demande pas — le cas témoin.

Aucun appel payé, aucun ComfyUI réel : `DoubleCapable` reprend le double de
`conftest`, comme `tests/test_tn2_texte.py` et `tests/test_tn3_detourage_endormi.py`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from atelier.domaine.catalogue import Modele
from atelier.domaine.recette import DETOURAGE
from atelier.mcp.serveur import creer_serveur
from mcp.server.mcpserver.exceptions import MCPServerError

from tests.conftest import CATALOGUE, FOURNISSEUR, FournisseurDouble
from tests.test_tn3_detourage_endormi import _hors_du_sujet, _tableau

BANC = Path(__file__).parent / "fixtures" / "banc_tn3"

CAPABLE = "essai:rend-du-vide"
ORDINAIRE = "essai:rend-du-png"


def _octets(nom: str) -> bytes:
    return (BANC / f"{nom}.png").read_bytes()


class DoubleCapable(FournisseurDouble):
    """Le double de `conftest`, avec un modèle de plus qui rend un fond vide —
    le même que `test_tn2_texte.py` et `test_tn3_detourage_endormi.py`, pour
    que les trois tranches jouent le même modèle."""

    async def catalogue(self) -> list[Modele]:
        base = await super().catalogue()
        return base + [
            Modele(
                identifiant=CAPABLE,
                nom="Essai fond vide",
                fournisseur=FOURNISSEUR,
                chez_lui="rend-du-vide",
                references_max=CATALOGUE[0].references_max,
                proportions=CATALOGUE[0].proportions,
                variations_max=4,
                transparence=True,
            )
        ]


@pytest.fixture
def double() -> DoubleCapable:
    return DoubleCapable()


@pytest.fixture
async def mcp(atelier):
    """Le serveur, sur un atelier **ouvert** (comme `tests/test_t7.py`) : le
    garde-fou du modèle consulte le catalogue, et un catalogue vide ferait
    tomber tous les appels sur un refus qui n'a rien à voir avec ce qu'on
    vérifie.

    **Le modèle imposé par défaut est levé** (F6) : sans ça, `generate_asset`
    ignore le `model` demandé et impose `MODELE_EXPLORATION`
    (`Pollinations:sana`), qui ne déclare pas la transparence — ce serait
    tester le garde-fou du modèle, pas la règle de TN5.
    """
    await atelier.ouvrir()
    atelier.agent.regler(modele_actif=False)
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


# ── list_models montre la capacité ───────────────────────────────────────────


async def test_list_models_montre_la_capacite_de_transparence(atelier, mcp):
    modeles = await appeler(mcp, "list_models")
    par_id = {m["id"]: m for m in modeles["models"]}

    assert par_id[CAPABLE]["transparent_background"] is True
    assert par_id[ORDINAIRE]["transparent_background"] is False


# ── Un personnage par l'agent : même règle, même texte, même recette ────────


async def test_un_personnage_fabrique_par_l_agent_arrive_detoure_par_le_modele(
    atelier, mcp, double
):
    """« Un personnage fabriqué par l'agent arrive détouré par le modèle,
    comme depuis l'écran. » — même capacité, même texte, même recette."""
    double.rendre = lambda: _octets("voleur-pixel")

    reponse = await appeler(mcp, "generate_asset", subject="a pixel thief", model=CAPABLE)
    await atelier.generations.attendre_tout()

    assert reponse["done"] is True
    image = reponse["images"][0]

    # **Même texte** : la consigne officielle est partie, comme à l'écran
    # (TN2) — c'est ce qui a fait rendre le fond vide au double.
    generation = atelier.generations.recentes(1)[0]
    assert generation.demande["transparence"] is True

    # **Même recette** : née détourée par le modèle (TN3), le détourage en
    # sommeil, comme depuis l'écran de confirmation.
    asset = atelier.assets.lire(image["id"])
    assert asset.recette.fond_du_modele is True
    assert asset.recette.dort(DETOURAGE)
    impose = atelier.assets.impose(asset.identifiant)
    assert impose["detouree_par_le_modele"] is True

    # Et l'image livrée à l'agent est bien un sprite en case, sans les débris
    # du voile que le détourage aurait dû manger s'il n'était pas endormi.
    octets, _ = atelier.assets.octets(asset)
    rendu = _tableau(octets)
    assert _hors_du_sujet(rendu)[1] <= 8


async def test_un_personnage_sans_type_dit_est_traite_comme_un_personnage(
    atelier, mcp, double
):
    """`kind` vide : « un sujet sans type est un personnage » (TN2), comme
    l'appel HTTP sans `echelle`."""
    double.rendre = lambda: _octets("voleur-pixel")

    reponse = await appeler(mcp, "generate_asset", subject="a masked rogue", model=CAPABLE)
    await atelier.generations.attendre_tout()

    generation = atelier.generations.recentes(1)[0]
    assert generation.demande["transparence"] is True
    asset = atelier.assets.lire(reponse["images"][0]["id"])
    assert asset.recette.dort(DETOURAGE)


# ── Le cas témoin : un décor ne demande pas la transparence ─────────────────


async def test_un_decor_par_l_agent_ne_demande_pas_la_transparence(atelier, mcp, double):
    """Le cas témoin : un décor part comme avant, sur le même modèle capable."""
    double.rendre = lambda: _octets("voleur-pixel")

    reponse = await appeler(
        mcp, "generate_asset", subject="a stone well", kind="décor", model=CAPABLE
    )
    await atelier.generations.attendre_tout()

    generation = atelier.generations.recentes(1)[0]
    assert "transparence" not in generation.demande

    asset = atelier.assets.lire(reponse["images"][0]["id"])
    assert asset.recette.fond_du_modele is False
    assert not asset.recette.dort(DETOURAGE)
