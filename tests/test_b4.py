# -*- coding: utf-8 -*-
"""Les critères de B4 tenus côté serveur — l'ouverture.

Deux réparations vivent ici : le tri des jeux par dernier travaillé, et le
chantier scopé au jeu ouvert. Le troisième bug de bascule que la planche
répare — l'univers qui ne suivait pas un changement de jeu — est un défaut
du **client** : `ouvrirProjet` ne rendait que la bibliothèque, jamais
l'univers. Il est tenu par `interface/src/App.test.tsx` § B4.

Les autres critères de la tranche — supprimer un jeu, relire un jeu dont le
dossier a disparu — retrouvent des routes déjà éprouvées ailleurs
(`test_t3.py`, `test_c1.py`) : B4 leur donne un bouton dans l'écran neuf,
pas un comportement neuf côté serveur.
"""

from __future__ import annotations

import asyncio

from atelier.api.app import creer_application
from atelier.domaine.generation import Emplacement, Generation, Statut
from test_t1_jalon3_4 import _lire_le_flux

# ── Le tri par dernier travaillé ─────────────────────────────────────────────


def test_ouvrir_un_jeu_le_fait_remonter_en_tete(client):
    """Créer « Forêt » l'ouvre (US-2) : elle passe devant « Bac à sable ».
    Rouvrir le premier jeu doit le faire remonter à son tour — sans quoi la
    liste ne dit jamais que le *dernier créé*, jamais le dernier travaillé."""
    client.post("/api/projects", json={"nom": "Forêt"})
    arbre = client.get("/api/library").json()
    assert [p["identifiant"] for p in arbre["projets"]] == ["foret", "bac-a-sable"]

    reponse = client.put("/api/projects/current", json={"projet": "bac-a-sable"})
    assert reponse.status_code == 200, reponse.text

    arbre = client.get("/api/library").json()
    assert [p["identifiant"] for p in arbre["projets"]] == ["bac-a-sable", "foret"]


def test_chaque_jeu_porte_sa_date_de_dernier_travail(client):
    """La date que le carnet trie doit être **servie**, pas seulement lue en
    coulisse — sans quoi rien ne dit à l'écran pourquoi cet ordre-là."""
    projet = client.get("/api/library").json()["projets"][0]
    assert "dernier_travail_le" in projet
    assert projet["dernier_travail_le"] > 0


def test_ouvrir_sans_projet_ne_date_personne(client):
    """« Sans projet » n'est pas un jeu qu'on pourrait dater — ouvrir cette
    vue-là ne doit toucher la date d'aucun jeu réel."""
    avant = client.get("/api/library").json()["projets"][0]["dernier_travail_le"]

    reponse = client.put("/api/projects/current", json={"projet": None})
    assert reponse.status_code == 200, reponse.text

    apres = client.get("/api/library").json()["projets"][0]["dernier_travail_le"]
    assert apres == avant


# ── Le chantier scopé au jeu ouvert ──────────────────────────────────────────


def _en_attente(identifiant: str, projet: str | None) -> Generation:
    """Un lot qui tourne encore — sans passer par un vrai fournisseur, ce que
    ce test n'a besoin ni de payer ni d'attendre."""
    return Generation(
        identifiant=identifiant,
        modele="essai:rend-du-png",
        demande={},
        parametres_resolus={},
        emplacements=[Emplacement(rang=0, statut=Statut.EN_ATTENTE)],
        projet=projet,
    )


def test_le_chantier_ne_montre_que_le_jeu_ouvert(client, atelier):
    """Un lot qui tourne dans un autre projet — un autre onglet, ou l'agent —
    ne doit pas rester affiché une fois qu'on a changé de jeu. Avant B4,
    `chantier()` ne filtrait rien : le lot du jeu précédent continuait de
    s'afficher jusqu'à sa **prochaine** génération, jamais au changement de
    jeu lui-même."""
    client.post("/api/projects", json={"nom": "Forêt"})  # ouvre « foret »

    atelier.base.enregistrer(_en_attente("dans-le-bac", "bac-a-sable"))
    atelier.base.enregistrer(_en_attente("dans-la-foret", "foret"))

    du_bac = atelier.generations.chantier(200, projet="bac-a-sable", sans_projet=False)
    assert [g.identifiant for g in du_bac] == ["dans-le-bac"]

    de_la_foret = atelier.generations.chantier(200, projet="foret", sans_projet=False)
    assert [g.identifiant for g in de_la_foret] == ["dans-la-foret"]

    # Sans filtre — l'ancien comportement, celui qu'un appelant qui ne pose
    # ni `projet` ni `sans_projet` continue de recevoir.
    tout = atelier.generations.chantier(200)
    assert {g.identifiant for g in tout} >= {"dans-le-bac", "dans-la-foret"}


def test_le_premier_message_du_flux_ne_porte_que_le_chantier_du_jeu_ouvert(
    client, atelier
):
    """`GET /api/events` — le message qui dessine un onglet qui s'ouvre — ne
    doit montrer que le chantier du jeu qu'on regarde."""
    client.post("/api/projects", json={"nom": "Forêt"})  # ouvre « foret »
    atelier.base.enregistrer(_en_attente("dans-le-bac", "bac-a-sable"))
    atelier.base.enregistrer(_en_attente("dans-la-foret", "foret"))

    async def scenario():
        return await _lire_le_flux(creer_application(atelier), 1)

    _, messages = asyncio.run(scenario())
    genre, charge = messages[0]

    assert genre == "etat"
    identifiants = {g["identifiant"] for g in charge["generations"]}
    assert identifiants == {"dans-la-foret"}
