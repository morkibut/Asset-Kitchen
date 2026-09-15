# -*- coding: utf-8 -*-
"""RP18 · Les neuf routes sans écran — ce que les décisions ont changé.

Neuf routes du serveur n'étaient appelées par personne. Chacune a reçu une
décision, et ce fichier vérifie les deux moitiés de ce qui a bougé :

- **ce qui est parti** : les trois adresses des jeux de réglages nommés et
  l'annulation d'un calage à la main ne répondent plus. Un essai qui ne
  vérifie que la présence d'une route neuve laisserait une route retirée
  revenir sans que rien ne tombe ;
- **ce qui est construit** : le casting que l'agent lit se cherche par un
  terme, et il le cherche par l'index du serveur — le même que la grille
  d'une famille interroge —, pas par une seconde règle écrite dans le MCP.

Les deux autres constructions de la tranche vivent à l'écran — le bouton qui
redemande le catalogue vidéo, et l'aperçu des images habillées —, et leurs
essais sont dans `interface/src/composants/`.

**Rien ne coûte un centime** : aucun appel ne sort de la machine.
"""

from __future__ import annotations

# **Les deux crochets du serveur MCP, empruntés aux essais de T7** — le `noqa`
# dit à qui relit que l'import « inutilisé » est le mécanisme : une fixture doit
# être visible dans le module de l'essai (`docs/PIEGES.md`).
from tests.test_t7 import appeler, mcp  # noqa: F401


# ── Ce qui est parti ─────────────────────────────────────────────────────────


def test_les_jeux_de_reglages_nommes_ne_repondent_plus(client):
    """Trois routes retirées. Ce qu'elles promettaient — rejouer les réglages
    d'un appel ailleurs — est fait par *Reprendre les réglages*, depuis la
    fiche d'une image de la galerie.

    **Le code exact n'est pas le même pour les trois, et ce n'est pas une
    incohérence** : une adresse que plus aucune route ne porte retombe sur le
    serveur de fichiers de l'interface, qui répond *introuvable* à une lecture
    et *méthode non servie* à tout le reste."""
    assert client.get("/api/presets").status_code == 404
    assert client.put("/api/presets/mes-nains", json={}).status_code >= 400
    assert client.delete("/api/presets/mes-nains").status_code >= 400


def test_defaire_un_calage_a_la_main_ne_repond_plus(client):
    """L'adresse existe encore en `POST` — poser un calage —, et c'est
    pourquoi la réponse est *cette méthode-là n'est pas servie* et non *cette
    adresse n'existe pas*."""
    reponse = client.delete("/api/strips/une-bande/layer/align")
    assert reponse.status_code == 405, reponse.text


# ── Ce qui est construit : l'agent cherche un sujet par son nom ──────────────


async def test_l_agent_cherche_un_sujet_dans_le_casting(client, mcp):
    """Sur un jeu de cent sujets, lire tout le casting pour en trouver un est
    ce que le terme évite. Le nom **et** la description répondent — c'est ce
    que l'index porte."""
    client.post("/api/characters", json={"nom": "Le pèlerin", "description": "un marcheur"})
    client.post("/api/characters", json={"nom": "La borne", "description": "une pierre levée"})

    tout = await appeler(mcp, "list_characters")
    assert {c["name"] for c in tout["characters"]} >= {"Le pèlerin", "La borne"}

    par_le_nom = await appeler(mcp, "list_characters", search="pèlerin")
    assert [c["name"] for c in par_le_nom["characters"]] == ["Le pèlerin"]

    par_la_description = await appeler(mcp, "list_characters", search="pierre levée")
    assert [c["name"] for c in par_la_description["characters"]] == ["La borne"]


async def test_un_terme_qui_ne_trouve_rien_rend_un_casting_vide(client, mcp):
    """Et non le casting entier : un filtre qui ne filtre plus quand il ne
    trouve rien ferait croire à un sujet qui n'existe pas."""
    client.post("/api/characters", json={"nom": "Le pèlerin"})

    rien = await appeler(mcp, "list_characters", search="zzz-introuvable")
    assert rien["characters"] == []
    # Le plan et le vestiaire, eux, restent : ils sont du jeu, pas du sujet.
    assert "poses" in rien and "slots" in rien


async def test_chercher_ne_cree_aucun_outil_de_plus(mcp):
    """La capacité est un argument, pas un onzième verbe : la barre de gestes
    dérive de la liste des outils, et un outil de plus y ajouterait une ligne
    que la maquette ne dessine pas."""
    outils = {o.name for o in await mcp.list_tools()}
    assert "search_characters" not in outils
    assert "list_characters" in outils
