# -*- coding: utf-8 -*-
"""RG6 — l'écran des tuiles adopte la bibliothèque (`docs/PLAN-rangement.md`).

Ce que le serveur doit à l'écran, et qu'il ne devait pas encore à RG5 : le
**refus** du geste neuf. « Ranger dans les matières » depuis la fiche d'une
image est un booléen posé sur l'image (`PUT /projects/{p}/materials/{asset}`) ;
tant que la route ne refusait rien, elle laissait faire trois choses fausses.
Chaque essai nomme la panne qu'il empêche :

- une image qui porte un sujet marquée matière — la marque dit « ingrédient,
  sans sujet », l'image dirait le contraire ;
- retirer la marque refusé pour la même raison — c'est la sortie, elle doit
  toujours être ouverte, y compris à une image née avant RG5 qui porterait les
  deux ;
- une image d'un autre jeu marquée par l'adresse d'un jeu qui n'est pas le sien,
  et qui paraîtrait alors dans une bibliothèque qu'on ne croyait pas toucher ;
- une image hors projet marquée sans qu'aucune bibliothèque ne la liste ;
- une image supprimée qui se laisserait marquer.

Aucun essai ne coûte un centime : la génération passe par le double du
fournisseur.
"""
from __future__ import annotations

from test_t3 import _asset, _generer

from atelier.services.bibliotheque import REFUS_MATIERE_D_UN_SUJET

# La phrase de la spécification, au mot près : l'écran l'affiche telle quelle.
PHRASE = (
    "Cette image est rangée dans un sujet : sors-la de son sujet d'abord, ou "
    "génère la matière depuis l'écran des tuiles."
)


def _image(client, prompt: str = "un mur de pierre") -> dict:
    return _asset(client, _generer(client, prompt))


def _sujet(client, nom: str = "Pèlerin") -> str:
    cree = client.post("/api/characters", json={"nom": nom, "type": "personnage"})
    assert cree.status_code == 201, cree.text
    return cree.json()["personnage"]["identifiant"]


def _declarer(client, projet: str, identifiant: str, valeur: bool):
    return client.put(
        f"/api/projects/{projet}/materials/{identifiant}", json={"matiere": valeur}
    )


def _dans_la_bibliotheque(client, projet: str) -> list[str]:
    reponse = client.get(f"/api/projects/{projet}/materials")
    assert reponse.status_code == 200, reponse.text
    return [m["identifiant"] for m in reponse.json()["matieres"]]


# ── Une image qui porte un sujet ne devient pas matière ──────────────────────


def test_la_phrase_du_refus_est_celle_de_la_specification():
    assert REFUS_MATIERE_D_UN_SUJET == PHRASE


def test_une_image_rangee_dans_un_sujet_ne_devient_pas_matiere(client):
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    sujet = _sujet(client)
    rangee = client.put(f"/api/assets/{identifiant}/character", json={"personnage": sujet})
    assert rangee.status_code == 200, rangee.text

    reponse = _declarer(client, projet, identifiant, True)

    assert reponse.status_code == 409, reponse.text
    assert reponse.json()["raison"] == PHRASE
    # Et rien n'a bougé : ni la marque, ni la bibliothèque, ni le sujet.
    apres = client.get(f"/api/assets/{identifiant}").json()
    assert apres["matiere"] is False
    assert apres["personnage"] == sujet
    assert identifiant not in _dans_la_bibliotheque(client, projet)


def test_sortie_de_son_sujet_l_image_devient_matiere(client):
    """Le chemin que la phrase indique — « sors-la de son sujet d'abord » —
    mène bien quelque part : une fois libre, le même geste réussit."""
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    sujet = _sujet(client)
    client.put(f"/api/assets/{identifiant}/character", json={"personnage": sujet})
    assert _declarer(client, projet, identifiant, True).status_code == 409

    libre = client.put(f"/api/assets/{identifiant}/character", json={"personnage": None})
    assert libre.status_code == 200, libre.text

    reponse = _declarer(client, projet, identifiant, True)
    assert reponse.status_code == 200, reponse.text
    assert identifiant in _dans_la_bibliotheque(client, projet)


def test_retirer_la_marque_ne_refuse_jamais_pour_un_sujet(atelier, client):
    """Une image marquée matière **et** rangée dans un sujet — l'état d'une
    image née avant RG5, ou d'une marque posée par un ancien chemin — doit
    pouvoir retirer sa marque : c'est la sortie, jamais un refus."""
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    sujet = _sujet(client)
    client.put(f"/api/assets/{identifiant}/character", json={"personnage": sujet})
    # L'état impossible par les routes d'aujourd'hui, posé à la main.
    asset = atelier.assets.lire(identifiant)
    asset.matiere = True
    atelier.assets.sauver(asset)

    reponse = _declarer(client, projet, identifiant, False)

    assert reponse.status_code == 200, reponse.text
    assert client.get(f"/api/assets/{identifiant}").json()["matiere"] is False
    # Retirer deux fois, ou retirer ce qui n'a jamais été marqué : sans refus non plus.
    assert _declarer(client, projet, identifiant, False).status_code == 200


def test_declarer_deux_fois_ne_refuse_pas(client):
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    assert _declarer(client, projet, identifiant, True).status_code == 200
    assert _declarer(client, projet, identifiant, True).status_code == 200
    assert _dans_la_bibliotheque(client, projet).count(identifiant) == 1


# ── L'image doit être du projet de l'adresse ─────────────────────────────────


def test_une_image_d_un_autre_jeu_n_est_pas_marquee_par_l_adresse_d_un_autre(client):
    image = _image(client)
    jeu_de_l_image, identifiant = image["projet"], image["identifiant"]
    autre = client.post("/api/projects", json={"nom": "Un autre jeu"})
    assert autre.status_code == 201, autre.text
    autre_jeu = autre.json()["projet"]["identifiant"]
    assert autre_jeu != jeu_de_l_image

    reponse = _declarer(client, autre_jeu, identifiant, True)

    assert reponse.status_code == 409, reponse.text
    assert "autre jeu" in reponse.json()["raison"]
    assert client.get(f"/api/assets/{identifiant}").json()["matiere"] is False
    assert _dans_la_bibliotheque(client, autre_jeu) == []
    # Retirer la marque par la mauvaise adresse ne passe pas non plus : l'adresse
    # ment sur ce qu'elle touche, quel que soit le sens du geste.
    assert _declarer(client, autre_jeu, identifiant, False).status_code == 409
    # Et par la bonne adresse, tout marche.
    assert _declarer(client, jeu_de_l_image, identifiant, True).status_code == 200
    assert identifiant in _dans_la_bibliotheque(client, jeu_de_l_image)
    assert _dans_la_bibliotheque(client, autre_jeu) == []


def test_un_projet_inconnu_est_refuse_en_404(client):
    image = _image(client)
    reponse = _declarer(client, "projet-qui-nexiste-pas", image["identifiant"], True)
    assert reponse.status_code == 404, reponse.text
    assert client.get(f"/api/assets/{image['identifiant']}").json()["matiere"] is False


def test_une_image_hors_projet_n_entre_dans_aucune_bibliotheque(client):
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    sortie = client.put("/api/assets/arrangement", json={"identifiants": [identifiant], "projet": None})
    assert sortie.status_code == 200, sortie.text
    assert client.get(f"/api/assets/{identifiant}").json()["projet"] is None

    reponse = _declarer(client, projet, identifiant, True)

    assert reponse.status_code == 409, reponse.text
    assert "aucun jeu" in reponse.json()["raison"]
    assert client.get(f"/api/assets/{identifiant}").json()["matiere"] is False


def test_une_marque_orpheline_se_nettoie(atelier, client):
    """Une image marquée puis sortie du jeu garde sa marque, que rien ne liste
    plus. La retirer reste possible : sinon elle reparaîtrait, intacte, le jour
    où on la rangerait de nouveau."""
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    assert _declarer(client, projet, identifiant, True).status_code == 200
    client.put("/api/assets/arrangement", json={"identifiants": [identifiant], "projet": None})
    assert identifiant not in _dans_la_bibliotheque(client, projet)

    reponse = _declarer(client, projet, identifiant, False)

    assert reponse.status_code == 200, reponse.text
    assert client.get(f"/api/assets/{identifiant}").json()["matiere"] is False


def test_une_image_supprimee_n_est_pas_marquee(client):
    image = _image(client)
    projet, identifiant = image["projet"], image["identifiant"]
    supprimee = client.post("/api/assets/delete", json={"identifiants": [identifiant]})
    assert supprimee.status_code == 200, supprimee.text

    reponse = _declarer(client, projet, identifiant, True)

    assert reponse.status_code == 404, reponse.text


def test_une_image_inconnue_est_refusee_en_404(client):
    image = _image(client)
    reponse = _declarer(client, image["projet"], "rien-de-tel-0", True)
    assert reponse.status_code == 404, reponse.text


# ── Le service lui-même, sans l'adresse ──────────────────────────────────────


def test_le_service_sans_projet_garde_le_refus_du_sujet(atelier, client):
    """Les appelants qui n'ont pas d'adresse — l'agent, à RG7 — passent par le
    service sans `projet` : le refus du sujet ne dépend pas de l'adresse."""
    from atelier.services.bibliotheque import RangementRefuse

    image = _image(client)
    identifiant = image["identifiant"]
    sujet = _sujet(client)
    client.put(f"/api/assets/{identifiant}/character", json={"personnage": sujet})
    try:
        atelier.bibliotheque.declarer_matiere(identifiant, True)
    except RangementRefuse as refus:
        assert str(refus) == PHRASE
    else:
        raise AssertionError("une image rangée dans un sujet ne doit pas devenir matière")
