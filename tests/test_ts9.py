# -*- coding: utf-8 -*-
"""TS9 · Les deux défauts vus au premier usage de TS4 et TS5
(`docs/PLAN-de-la-toile-au-sujet.md`).

**Le second défaut** : la phrase d'une carte et « Reprendre ce texte »
(TS5) n'apparaissaient sur une carte fabriquée depuis la barre qu'après un
rechargement de la page. La cause : `ToileFabrique.poser` (côté écran) ne lit
jamais la réponse du `POST /projects/{p}/board/assets/{asset}` qui pose
l'image — la carte arrive à l'écran par l'évènement `carte` du flux
(`interface/src/flux.ts`), publié par `ServiceUnivers._sauver`. Ce point-là
publiait `carte.en_json()` seul, sans la phrase que `/board` sait pourtant
calculer (`ServiceUnivers.phrase_de_carte`) — donc la carte posée en direct
arrivait sans sa phrase, et il fallait recharger `/board` en entier pour la
voir apparaître.

**Le correctif choisi** — le plus petit des deux proposés par le plan : la
phrase part avec l'évènement `carte` que `_sauver` publie déjà à chaque
écriture, dans la même forme que ce que `/board` rend pour chaque carte.
Aucun aller-retour de plus, aucune route de plus — un seul calcul (déjà
écrit pour TS5), une lecture de plus.

**Rien ne coûte un centime** : le double du fournisseur rend une vraie image
PNG de taille fixe, sans appel réseau.
"""

from __future__ import annotations

import time

MODELE = "essai:rend-du-png"


def _generer(client, prompt: str = "un héron", **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _attendre(client, identifiant: str, tours: int = 200) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        statuts = {e["statut"] for e in lue["emplacements"]}
        if statuts <= {"reussie", "echouee", "interrompue"}:
            return lue
        time.sleep(0.01)
    return client.get(f"/api/generations/{identifiant}").json()


def test_l_evenement_carte_porte_deja_la_phrase_sans_recharger_le_board(client, atelier):
    """**Le défaut vu au navigateur** : rejoue exactement le chemin de
    `ToileFabrique.poser` — poser l'asset d'un emplacement revenu — et
    intercepte ce que `_sauver` annonce en direct, sans jamais repasser par
    `/board`. Avant le correctif, la charge de l'évènement n'a pas de clé
    `phrase` du tout (`carte.en_json()` ne la porte pas) : c'est exactement
    ce qui laissait la carte fraîchement posée sans sa phrase à l'écran."""
    projet = atelier.bibliotheque.courant

    captes: list[tuple[str, dict]] = []
    original = atelier.univers._diffusion.publier

    def espion(genre: str, charge: dict) -> None:
        captes.append((genre, charge))
        original(genre, charge)

    atelier.univers._diffusion.publier = espion

    generation = _generer(client, prompt="un héron", resolution="512")
    rang = generation["emplacements"][0]["rang"]
    identifiant_asset = f"{generation['identifiant']}-{rang}"

    posee = client.post(f"/api/projects/{projet}/board/assets/{identifiant_asset}")
    assert posee.status_code == 200, posee.text
    carte = posee.json()["carte"]

    evenements = [
        charge
        for genre, charge in captes
        if genre == "carte" and charge.get("identifiant") == carte["identifiant"]
    ]
    assert evenements, "aucun évènement « carte » annoncé pour la carte posée"
    # Le dernier évènement est celui qui compte : c'est lui que l'écran voit
    # en dernier, et c'est lui qui doit porter la phrase.
    assert evenements[-1]["phrase"] == {
        "texte": "un héron",
        "modele": MODELE,
        "resolution": "512",
        "repris": False,
    }


def test_une_note_annoncee_en_direct_n_a_toujours_pas_de_phrase(client, atelier):
    """Le correctif ne doit rien inventer pour ce qui n'en a pas : une note
    annoncée en direct porte `phrase: null`, exactement comme sur `/board`."""
    projet = atelier.bibliotheque.courant

    captes: list[tuple[str, dict]] = []
    original = atelier.univers._diffusion.publier

    def espion(genre: str, charge: dict) -> None:
        captes.append((genre, charge))
        original(genre, charge)

    atelier.univers._diffusion.publier = espion

    note = client.post("/api/board/text", json={"texte": "une intention", "projet": projet})
    assert note.status_code == 201, note.text
    identifiant = note.json()["identifiant"]

    evenements = [
        charge for genre, charge in captes if genre == "carte" and charge.get("identifiant") == identifiant
    ]
    assert evenements
    assert evenements[-1]["phrase"] is None
