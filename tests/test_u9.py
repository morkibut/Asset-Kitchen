# -*- coding: utf-8 -*-
"""U9 · Ce que l'écran de confirmation doit recevoir pour montrer les images.

**Ce qui se mesure ici** : que chaque image jointe arrive avec l'objet qui la
montre — la carte entière ou l'asset entier —, que ce soit **le même objet** que
celui des autres écrans et non une adresse fabriquée pour l'occasion, et qu'une
image disparue entre le moment où la ligne a été composée et celui où on la
regarde laisse la ligne debout sans vignette, jamais une erreur.

**Pourquoi l'objet et pas l'adresse.** L'écran sait déjà nommer l'adresse d'un
asset et celle d'une carte, à un seul endroit chacune. Lui envoyer une adresse
toute faite aurait posé ici un second vocabulaire d'adresses, et la première
empreinte ajoutée l'aurait fait diverger du premier — deux écrans montrant deux
images différentes de la même chose, sans que rien ne le dise.

**Le repli des longs textes et le geste qui ouvre une vignette en grand vivent
dans `interface/src/App.test.tsx`** : ce sont des faits d'écran, et l'écran est
le seul endroit où ils se vérifient.
"""

from __future__ import annotations

from tests.conftest import image_sujet
from tests.test_e14 import MODELE, _carte, _creer, _envoi, _regler


def _promouvoir(client, tmp_path, chose: str, nom: str = "corps.png") -> dict:
    """Une image de la bibliothèque, promue en référence permanente (E12).

    C'est le seul chemin par lequel une ligne d'images jointes porte une origine
    `asset` plutôt qu'une carte du tableau — et donc le seul par lequel on voit
    l'autre moitié de la règle.
    """
    fichier = tmp_path / nom
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    promue = client.put(
        f"/api/characters/{chose}/references", json={"asset": asset["identifiant"]}
    )
    assert promue.status_code == 200, promue.text
    return asset


def _jointe(envoi: dict, identifiant: str) -> dict:
    return next(l for l in envoi["images"]["lignes"] if l["asset"] == identifiant)


# ── « Chaque image jointe porte de quoi la montrer » ─────────────────────────


def test_une_carte_jointe_arrive_avec_la_carte_entiere(client, tmp_path):
    """L'écran qui décide de ce qui part ne montrait aucune image : les
    références y étaient des lignes de texte avec un prix. Chacune porte
    désormais de quoi faire sa vignette."""
    chose = _creer(client)
    carte = _carte(client, tmp_path, "concept.png")
    _regler(client, chose["identifiant"], concept_arts=[carte["identifiant"]])

    ligne = _jointe(
        _envoi(client, personnage=chose["identifiant"]), carte["identifiant"]
    )

    assert ligne["montre"] is not None
    assert ligne["montre"]["sorte"] == "carte"
    assert ligne["montre"]["carte"]["identifiant"] == carte["identifiant"]
    # **L'empreinte voyage avec l'objet** : c'est elle qui fait qu'une carte
    # retouchée cesse de montrer l'image d'avant.
    assert ligne["montre"]["carte"]["empreinte"] == carte["empreinte"]


def test_une_image_promue_arrive_avec_lasset_entier(client, tmp_path):
    """L'autre moitié de la règle : une ligne d'origine `asset` porte l'objet de
    la bibliothèque, pas une carte du tableau."""
    chose = _creer(client)
    asset = _promouvoir(client, tmp_path, chose["identifiant"])

    ligne = _jointe(
        _envoi(client, personnage=chose["identifiant"]), asset["identifiant"]
    )

    assert ligne["montre"]["sorte"] == "asset"
    assert ligne["montre"]["asset"]["identifiant"] == asset["identifiant"]


def test_lobjet_montre_est_celui_des_autres_ecrans(client, tmp_path):
    """**Le même objet, mot pour mot.** Si l'écran de confirmation recevait une
    forme à lui, il finirait par montrer une autre image que la fiche — et rien
    ne dirait laquelle a raison."""
    chose = _creer(client)
    asset = _promouvoir(client, tmp_path, chose["identifiant"])
    carte = _carte(client, tmp_path, "concept.png")
    _regler(client, chose["identifiant"], concept_arts=[carte["identifiant"]])

    envoi = _envoi(client, personnage=chose["identifiant"])

    lu = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert _jointe(envoi, asset["identifiant"])["montre"]["asset"] == lu
    tableau = client.get("/api/board").json()["cartes"]
    au_tableau = next(c for c in tableau if c["identifiant"] == carte["identifiant"])
    assert _jointe(envoi, carte["identifiant"])["montre"]["carte"] == au_tableau


# ── « Une image disparue laisse la ligne debout » ────────────────────────────


def test_une_carte_oubliee_laisse_la_ligne_sans_vignette(client, tmp_path):
    """Une référence peut nommer une carte retirée du tableau entre le moment où
    la ligne a été composée et celui où on la regarde. La ligne reste — elle dit
    ce qui partirait —, elle n'a simplement pas de vignette. Une erreur, ici,
    aurait éteint l'écran entier avant un paiement."""
    chose = _creer(client)
    carte = _carte(client, tmp_path, "concept.png")
    _regler(client, chose["identifiant"], concept_arts=[carte["identifiant"]])
    oubliee = client.delete(f"/api/board/{carte['identifiant']}")
    assert oubliee.status_code == 200, oubliee.text

    envoi = _envoi(client, personnage=chose["identifiant"])

    ligne = _jointe(envoi, carte["identifiant"])
    assert ligne["montre"] is None
    # Et le reste de l'écran est intact : le prix, la case, la provenance.
    assert "prix" in ligne and "cochee" in ligne


def test_lecran_repond_encore_quand_toutes_les_images_ont_disparu(client, tmp_path):
    """Le cas limite du précédent, parce que c'est celui qui casserait le
    paiement : rien à montrer ne veut pas dire rien à décider."""
    chose = _creer(client)
    une = _carte(client, tmp_path, "une.png")
    deux = _carte(client, tmp_path, "deux.png")
    _regler(
        client,
        chose["identifiant"],
        concept_arts=[une["identifiant"], deux["identifiant"]],
    )
    for carte in (une, deux):
        client.delete(f"/api/board/{carte['identifiant']}")

    reponse = client.post(
        "/api/outgoing",
        json={
            "modele": MODELE,
            "prompt": "un nain",
            "personnage": chose["identifiant"],
        },
    )

    assert reponse.status_code == 200, reponse.text
    assert all(l["montre"] is None for l in reponse.json()["images"]["lignes"])
