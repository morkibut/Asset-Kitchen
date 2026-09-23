# -*- coding: utf-8 -*-
"""TS5 · Le texte d'une image reste sur sa carte (`docs/PLAN-de-la-toile-au-sujet.md`).

**La phrase vit sur la génération, jamais sur la carte** — `Carte` ne porte
aucun lien vers l'appel qui l'a produite, seulement une `source` libre
(`asset:<identifiant>` quand elle vient de la toile). `/board` la remonte dans
la même lecture que le reste du tableau, en la lisant sur l'asset puis sur sa
génération : pas de route à elle, donc pas de requête par carte.

**Le point dur** : le texte rendu est `demande.sujet`, jamais `demande.prompt`
— celui-ci peut porter la bible repliée en tête et les consignes de planche en
queue dès que `repris` est faux, et ce n'est pas ce que l'auteur a tapé.
`ServiceGenerations.soumettre` garde le sujet à part *avant* de le composer,
pour nommer l'asset ; ce test vérifie que la même valeur ressort intacte sur
la carte, bible ou pas, `repris` ou pas.

**Rien ne coûte un centime** : le double du fournisseur rend une vraie image
PNG de taille fixe, sans appel réseau.
"""

from __future__ import annotations

import time

from atelier.domaine.projet import CHAMPS_BIBLE

MODELE = "essai:rend-du-png"


def _bible(client, **textes: str) -> None:
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": textes.get(nom, ""), "actif": True}
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text


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


def _poser_sur_la_toile(client, projet: str, generation: dict) -> dict:
    """L'asset du premier emplacement, posé sur le tableau — le geste de
    `ToileFabrique.poser`, rejoué côté serveur."""
    rang = generation["emplacements"][0]["rang"]
    identifiant = f"{generation['identifiant']}-{rang}"
    posee = client.post(f"/api/projects/{projet}/board/assets/{identifiant}")
    assert posee.status_code == 200, posee.text
    return posee.json()["carte"]


def _carte_du_tableau(client, projet: str, identifiant: str) -> dict:
    tableau = client.get("/api/board", params={"projet": projet}).json()
    return next(c for c in tableau["cartes"] if c["identifiant"] == identifiant)


def test_la_phrase_est_celle_que_l_auteur_a_tapee_meme_avec_une_bible(client, atelier):
    """**Le critère de la tranche** : le texte composé — bible repliée en tête,
    consignes de planche en queue — n'est jamais ce que la carte montre."""
    projet = atelier.bibliotheque.courant
    _bible(client, monde="marais de fer", rendu="pixel art 16 bits")

    generation = _generer(client, prompt="un héron", resolution="512")
    # Le texte réellement parti au modèle porte la bible — le contraste qui
    # prouve que `demande.prompt` et `demande.sujet` ont bien divergé ici.
    assert "marais de fer" in generation["demande"]["prompt"]
    assert generation["demande"]["prompt"] != "un héron"

    posee = _poser_sur_la_toile(client, projet, generation)
    carte = _carte_du_tableau(client, projet, posee["identifiant"])

    assert carte["phrase"] == {
        "texte": "un héron",
        "modele": MODELE,
        "resolution": "512",
        "repris": False,
    }


def test_un_texte_repris_donne_la_meme_phrase(client, atelier):
    """`repris` ne change rien à la phrase relue : elle est le texte de
    l'auteur dans les deux cas, seul le prompt réellement parti diffère."""
    projet = atelier.bibliotheque.courant
    _bible(client, monde="marais de fer")

    generation = _generer(client, prompt="un héron", repris=True)
    assert generation["demande"]["prompt"] == "un héron"

    posee = _poser_sur_la_toile(client, projet, generation)
    carte = _carte_du_tableau(client, projet, posee["identifiant"])

    assert carte["phrase"]["texte"] == "un héron"
    assert carte["phrase"]["repris"] is True


def test_une_carte_collee_a_la_main_n_a_pas_de_phrase(client, atelier):
    """Rien à remonter : une carte collée directement — pas d'`asset:` en
    source — ne porte aucune génération."""
    projet = atelier.bibliotheque.courant
    from tests.conftest import image_sujet

    collee = client.post(
        "/api/board/paste",
        params={"nom": "trouvaille.png", "projet": projet},
        content=image_sujet(),
    )
    assert collee.status_code == 201, collee.text
    carte = collee.json()["carte"]

    relue = _carte_du_tableau(client, projet, carte["identifiant"])
    assert relue["phrase"] is None


def test_une_note_n_a_pas_de_phrase(client, atelier):
    projet = atelier.bibliotheque.courant
    note = client.post("/api/board/text", json={"texte": "une intention", "projet": projet})
    assert note.status_code == 201, note.text

    relue = _carte_du_tableau(client, projet, note.json()["identifiant"])
    assert relue["phrase"] is None


def test_une_image_fabriquee_ailleurs_montre_aussi_son_texte(client, atelier):
    """**Le troisième critère de la tranche** : la phrase ne dépend d'aucun
    drapeau de la toile (`brut`, `echelle` vide) — une image générée par le
    chemin ordinaire du produit, posée après coup sur le tableau, la montre
    tout autant qu'une image sortie de la barre de fabrication."""
    projet = atelier.bibliotheque.courant

    generation = _generer(client, prompt="une louve", echelle="personnage")
    posee = _poser_sur_la_toile(client, projet, generation)
    carte = _carte_du_tableau(client, projet, posee["identifiant"])

    assert carte["phrase"]["texte"] == "une louve"
