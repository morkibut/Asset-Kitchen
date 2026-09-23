# -*- coding: utf-8 -*-
"""RV19 : l'image de départ se voit avant de choisir.

**Une seule règle, deux appelants.** `GET /characters/{id}/starting-image`
n'ajoute rien à `production.image_de_depart` (`tests/test_a9.py` le mesure
déjà en détail, service par service) : elle l'appelle, case par case, et met
en forme. Ce fichier vérifie donc la route elle-même — ce qu'elle prend en
paramètres, ce qu'elle rend, et qu'elle ne facture ni n'appelle personne —
pas la règle de choix, déjà couverte.

Une route du même nom (`GET /clips/start-image`) avait été retirée le
21 septembre 2026 faute d'appelant (8nonies) ; celle-ci en a un,
`FabricationSuivie.tsx`.
"""

from tests.test_a9 import animateur, atelier_video, client_video, un_personnage, un_sprite  # noqa: F401


def test_une_case_sans_image_le_dit_avec_sa_raison(client_video):
    personnage = un_personnage(client_video, "Perceval")
    reponse = client_video.get(
        f"/api/characters/{personnage}/starting-image",
        params={"pose": "repos", "direction": "sud"},
    )
    assert reponse.status_code == 200, reponse.text
    corps = reponse.json()
    assert corps["cases"] == [
        {
            "direction": "sud",
            "asset": None,
            "origine": "aucune",
            "raison": corps["cases"][0]["raison"],
        }
    ]
    assert "n'a encore aucune image" in corps["cases"][0]["raison"]


def test_la_case_visee_propose_son_image_par_direction(client_video):
    """**La même règle que la relecture** : une image posée sur la case
    « marche » vers le sud est celle que la route propose pour le sud, et
    « aucune » pour le nord, dans le même appel — le même montage que
    `test_a9.test_une_case_vide_part_du_repos_dans_la_meme_direction`, mais
    interrogé par la route plutôt que par le service directement."""
    assert client_video.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    objectif = {"sorties": [
        {"nature": "animation", "pose": p, "direction": d}
        for p in ("repos", "marche") for d in ("sud", "nord")
    ]}
    cree = client_video.post(
        "/api/characters", json={"nom": "Michel", "description": "un voyageur", "objectif": objectif}
    )
    assert cree.status_code == 201, cree.text
    personnage = cree.json()["personnage"]["identifiant"]
    sprite = un_sprite(client_video)
    assert client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "marche", "direction": "sud"},
    ).status_code == 200

    reponse = client_video.get(
        f"/api/characters/{personnage}/starting-image",
        params={"pose": "marche", "direction": ["sud", "nord"]},
    )
    assert reponse.status_code == 200, reponse.text
    cases = {c["direction"]: c for c in reponse.json()["cases"]}
    assert cases["sud"]["asset"]["identifiant"] == sprite
    assert cases["sud"]["origine"] == "case"
    assert cases["nord"]["asset"] is None


def test_sans_direction_demandee_la_case_vaut_sans_direction(client_video):
    personnage = un_personnage(client_video, "Perceval")
    reponse = client_video.get(
        f"/api/characters/{personnage}/starting-image", params={"pose": "repos"}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["cases"] == [
        {
            "direction": "",
            "asset": None,
            "origine": "aucune",
            "raison": reponse.json()["cases"][0]["raison"],
        }
    ]


def test_ne_facture_rien_et_n_appelle_personne(client_video, double):
    """Elle lit la bibliothèque : aucun appel au fournisseur, quel que soit
    ce qu'elle trouve."""
    personnage = un_personnage(client_video, "Perceval")
    avant = double.appels
    client_video.get(
        f"/api/characters/{personnage}/starting-image",
        params={"pose": "repos", "direction": "sud"},
    )
    assert double.appels == avant
