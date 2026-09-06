# -*- coding: utf-8 -*-
"""Les critères de B3 — les huit états, et les trois pertes silencieuses.

**Ce fichier ne redessine aucun écran** (`docs/PLAN-carnet.md` § B3, « aucun
écran nouveau ») : il tient les deux réparations qui vivent côté serveur —
le décalage horizontal que `PUT /assets/{id}/recipe` jetait, et le total que
la grille ne disait pas au-delà de son plafond. Les autres états — le prix
avant l'image, le refus qui reste, la clé grisée, les trois (en fait quatre)
messages de panne, le jeu neuf à zéro — étaient déjà tenus par le code
existant (`interface/src/App.tsx`) au moment d'écrire cette tranche ; ce
fichier ne les répète pas, et la grille qui dit ce qu'elle cache est tenue
par `interface/src/App.test.tsx` § B3.

**Aucun test de ce fichier ne coûte un centime.**
"""

from __future__ import annotations

from test_e17 import _calibrage, _un_personnage_dephase


# ── Le décalage horizontal survit à un autre réglage ────────────────────────


def test_le_decalage_survit_a_la_modification_dun_autre_reglage(client, tmp_path):
    """**Le point dur de la tranche.** `CorpsGrille` ne déclarait pas
    `decalage` : Pydantic ignore un champ non déclaré, si bien que poser
    n'importe quel autre réglage de la grille — l'occupation, la cible —
    envoyait un objet `grille` sans lui, et le serveur le reconstruisait à
    zéro. Le calibrage ne l'a pourtant jamais retiré ; c'est la route de la
    tranche qui le perdait, en silence, à chaque réglage voisin."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put(f"/api/characters/{chose}/calibration/repos", json={"decalage": 4})
    asset = next(
        p["asset"] for p in _calibrage(client, chose)["poses"] if p["pose"] == "repos"
    )
    recette = client.get(f"/api/assets/{asset}").json()["recette"]
    assert recette["grille"]["decalage"] == 4

    # On touche un réglage voisin — l'occupation — depuis l'écran de retouche,
    # exactement le geste que les tables de la V2.1 posent à chaque curseur
    # relâché. Le décalage n'a rien à voir avec ce geste-là.
    recette["grille"]["occupation"] = 80
    reponse = client.put(f"/api/assets/{asset}/recipe", json=recette)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["grille"]["decalage"] == 4
    assert reponse.json()["recette"]["grille"]["occupation"] == 80

    # Et relu depuis le disque, pas seulement depuis la réponse de l'appel qui
    # vient de l'écrire — la vraie preuve qu'il a été sauvé, pas seulement
    # renvoyé en écho.
    relu = client.get(f"/api/assets/{asset}").json()["recette"]
    assert relu["grille"]["decalage"] == 4


def test_le_decalage_se_pose_directement_par_le_geste_de_la_tranche(client):
    """**Le geste nu, sans calibrage** : `PUT /assets/{id}/recipe` est la route
    que chaque table de retouche appelle à chaque réglage relâché
    (`interface/src/composants/Places.tsx`, `useRecette.poser`). Le champ doit
    y voyager pour lui-même, pas seulement parce que le calibrage l'a écrit
    avant."""
    import io

    from PIL import Image

    tampon = io.BytesIO()
    Image.new("RGBA", (16, 16), (5, 6, 7, 255)).save(tampon, format="PNG")
    entree = client.post(
        "/api/assets/upload", content=tampon.getvalue(), params={"nom": "seul.png"}
    )
    assert entree.status_code == 201, entree.text
    asset = entree.json()["asset"]["identifiant"]

    reponse = client.put(
        f"/api/assets/{asset}/recipe",
        json={
            "grille": {
                "cible": 64,
                "occupation": 100,
                "ancrage": "bas",
                "decalage": -6,
                "methode": "proche",
            }
        },
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["grille"]["decalage"] == -6

    relu = client.get(f"/api/assets/{asset}").json()["recette"]
    assert relu["grille"]["decalage"] == -6


# ── La grille dit ce qu'elle ne montre pas ──────────────────────────────────


def _fichier(rang: int) -> bytes:
    """Une image **distincte par rang** : la bibliothèque refuse un doublon à
    l'empreinte de ses octets, et douze images du même pixel seraient onze
    doublons et un seul asset — pas les douze qu'un compte veut mesurer."""
    import io

    from PIL import Image

    tampon = io.BytesIO()
    Image.new("RGBA", (8, 8), (10 + rang, 20, 30, 255)).save(tampon, format="PNG")
    return tampon.getvalue()


def test_le_total_depasse_la_limite_et_le_dit(client):
    """**La grille s'arrêtait à 200 images sans le dire** — l'auteur croyait
    avoir tout vu. `total` compte au-delà de la limite demandée, avec le même
    filtre : c'est ce qui permet à l'écran d'écrire « 5 montrées sur 12 »."""
    for i in range(12):
        reponse = client.post(
            "/api/assets/upload",
            content=_fichier(i),
            params={"nom": f"sujet-{i}.png"},
        )
        assert reponse.status_code == 201, reponse.text

    reponse = client.get("/api/assets", params={"limite": 5})
    assert reponse.status_code == 200, reponse.text
    corps = reponse.json()
    assert len(corps["assets"]) == 5
    assert corps["total"] == 12

    # Et le même filtre, sans plafond artificiel, rend tout — « Charger la
    # suite » n'est rien de plus qu'une limite plus large sur le même appel.
    tout = client.get("/api/assets", params={"limite": 1000}).json()
    assert len(tout["assets"]) == 12
    assert tout["total"] == 12


def test_le_total_suit_le_filtre_et_non_toute_la_bibliotheque(client):
    """Un total qui compterait toute la bibliothèque au lieu du filtre
    montrerait « 1 sur 7 » à quelqu'un qui vient de chercher un mot précis —
    le mensonge inverse de celui que la tranche répare."""
    for i in range(3):
        client.post(
            "/api/assets/upload",
            content=_fichier(i),
            params={"nom": f"trouvable-{i}.png"},
        )
    for i in range(4):
        client.post(
            "/api/assets/upload",
            content=_fichier(100 + i),
            params={"nom": f"autre-{i}.png"},
        )

    corps = client.get(
        "/api/assets", params={"recherche": "trouvable", "limite": 1}
    ).json()
    assert len(corps["assets"]) == 1
    assert corps["total"] == 3
