# -*- coding: utf-8 -*-
"""Les critères de R8 qui vivent côté serveur — la fiche d'une chose du jeu.

**R8 est une tranche d'écran, et presque tout se mesure à l'écran** :
`interface/src/App.test.tsx` vérifie que les cinq parties se lisent sans clic,
que chacune porte son propos lu dans le recueil, que la fiche montre la chose et
porte son nom, que le compte des cases n'est plus écrit trois fois, et que les
deux règles d'apparence enfreintes ne le sont plus.

**Ce qui se mesure ici est la seule chose que la tranche demande au serveur** :
une image d'exemple ne peut pas porter sa vignette si la ligne qui la nomme ne
dit pas *quelle image*. Elle ne portait qu'un identifiant, une provenance et un
détail — trois chaînes de texte —, et l'on retenait ou l'on retirait une image
sans la regarder.

**Et la réponse est écrite une seule fois.** L'écran de confirmation posait la
même question depuis U9 ; `atelier/services/montre.py` y répond pour les deux, et
`test_les_deux_ecrans_recoivent_la_meme_forme` le vérifie.
"""

from __future__ import annotations

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _carte(client, nom: str) -> dict:
    reponse = client.post(
        "/api/board/paste",
        params={"nom": nom, "forcer": True},
        content=image_sujet(toile=24, bloc=2),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _references(client, personnage: str) -> dict:
    reponse = client.get(f"/api/characters/{personnage}/references")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _epingler(client, personnage: str, carte: str) -> None:
    reponse = client.put(
        f"/api/characters/{personnage}", json={"concept_arts": [carte]}
    )
    assert reponse.status_code == 200, reponse.text


# ── « Chaque image d'exemple porte sa vignette » ─────────────────────────────


def test_une_image_dexemple_porte_de_quoi_la_montrer(client):
    """**On retient ou on retire une image en la regardant.** La ligne portait
    trois chaînes de texte — un identifiant, une provenance, un détail — et l'on
    décidait de mémoire."""
    chose = _creer(client)
    carte = _carte(client, "un dessin de départ.png")
    _epingler(client, chose["identifiant"], carte["identifiant"])

    ligne = _references(client, chose["identifiant"])["lignes"][0]

    assert ligne["reference"] == carte["identifiant"]
    assert ligne["montre"]["sorte"] == "carte"
    # **L'objet entier, et pas une adresse** : l'écran sait déjà nommer l'adresse
    # d'une carte, à un seul endroit. Une adresse toute faite ici aurait posé un
    # second vocabulaire d'adresses, que la première empreinte ferait diverger.
    assert ligne["montre"]["carte"]["identifiant"] == carte["identifiant"]
    assert "empreinte" in ligne["montre"]["carte"]


def test_une_image_disparue_laisse_sa_ligne_sans_vignette(client):
    """`None`, jamais une erreur : une référence peut nommer une carte retirée du
    tableau entre le moment où la ligne a été composée et celui où on la regarde.
    La ligne reste — elle dit ce qui partirait —, elle n'a pas de vignette."""
    chose = _creer(client)
    carte = _carte(client, "elle va disparaître.png")
    _epingler(client, chose["identifiant"], carte["identifiant"])

    supprimee = client.delete(f"/api/board/{carte['identifiant']}")
    assert supprimee.status_code in (200, 204), supprimee.text

    lignes = _references(client, chose["identifiant"])["lignes"]
    assert len(lignes) == 1
    assert lignes[0]["montre"] is None


def test_une_proposition_porte_sa_vignette_comme_une_ligne_retenue(client):
    """**L'atelier propose, il ne décide pas** — et une proposition se juge en la
    regardant, exactement comme une image déjà retenue. Sans vignette, elle se
    refusait ou s'acceptait sur son nom."""
    chose = _creer(client)
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un nain",
            "personnage": chose["identifiant"],
            "pose": poses[0],
        },
    )
    assert reponse.status_code == 202, reponse.text
    _attendre(client, reponse.json()["identifiant"])

    propositions = _references(client, chose["identifiant"])["propositions"]

    assert propositions, "l'atelier n'a rien proposé — il y a pourtant un corps"
    assert propositions[0]["montre"]["sorte"] == "asset"
    assert "empreinte" in propositions[0]["montre"]["asset"]
    # Une proposition n'est pas écartée : elle n'a simplement pas encore été
    # retenue. Le champ est là pour que l'écran n'ait pas à le deviner.
    assert propositions[0]["ecartee"] is False


def test_les_deux_ecrans_recoivent_la_meme_forme(client):
    """**Une seule réponse à « de quoi montrer cette image »** (R8).

    L'écran de confirmation la posait depuis U9, la fiche la pose depuis R8.
    Deux réponses écrites à deux endroits auraient fini par rendre deux formes du
    même objet, et l'écran aurait eu deux façons de montrer la même image.
    """
    chose = _creer(client)
    carte = _carte(client, "artwork.png")
    promue = client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert promue.status_code == 200, promue.text
    _epingler(client, chose["identifiant"], carte["identifiant"])

    sur_la_fiche = _references(client, chose["identifiant"])["lignes"][0]["montre"]
    envoi = client.post(
        "/api/outgoing",
        json={
            "modele": MODELE,
            "prompt": "un nain",
            "personnage": chose["identifiant"],
        },
    )
    assert envoi.status_code == 200, envoi.text
    a_lenvoi = next(
        i["montre"]
        for i in envoi.json()["images"]["lignes"]
        if i["asset"] == carte["identifiant"]
    )

    assert sur_la_fiche == a_lenvoi


def _attendre(client, identifiant: str) -> dict:
    import time

    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")
