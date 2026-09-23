"""Fabriquer sur la toile : l'image revenue se pose là où son emplacement attendait.

La barre de fabrication de la toile pose un fantôme à un endroit du plan, puis
pose l'image revenue **à cet endroit-là** — la route de pose accepte donc une
place. Sans place, rien ne change : la copie se range au bout de la rangée.
"""
from atelier.domaine.recette import Recette
from tests.conftest import image_sujet


def _importer(atelier, client, tmp_path, nom="fabriquee.png"):
    chemin = tmp_path / nom
    chemin.write_bytes(image_sujet())
    r = client.post("/api/assets/import", json={"chemin": str(chemin)})
    assert r.status_code == 201, r.text
    asset = atelier.assets.lire(r.json()["asset"]["identifiant"])
    asset.recette = Recette()
    atelier.assets.sauver(asset)
    return asset


def test_la_copie_se_pose_a_la_place_demandee_et_se_relit(atelier, client, tmp_path):
    asset = _importer(atelier, client, tmp_path)
    projet = atelier.bibliotheque.courant
    url = f"/api/projects/{projet}/board/assets/{asset.identifiant}"

    posee = client.post(url, json={"position": [412.5, -80]})
    assert posee.status_code == 200, posee.text
    carte = posee.json()["carte"]
    assert carte["position"] == [412.5, -80]

    # Refermé puis rouvert : la place est sur le disque, pas dans la réponse.
    tableau = client.get("/api/board", params={"projet": projet}).json()
    relue = next(c for c in tableau["cartes"] if c["identifiant"] == carte["identifiant"])
    assert relue["position"] == [412.5, -80]


def test_un_doublon_deja_pose_garde_sa_place(atelier, client, tmp_path):
    asset = _importer(atelier, client, tmp_path)
    projet = atelier.bibliotheque.courant
    url = f"/api/projects/{projet}/board/assets/{asset.identifiant}"

    premiere = client.post(url, json={"position": [10, 20]}).json()["carte"]
    seconde = client.post(url, json={"position": [900, 900]}).json()
    assert seconde["deja_presente"] is True
    assert seconde["carte"]["position"] == premiere["position"] == [10, 20]


def test_une_place_mal_formee_est_refusee(atelier, client, tmp_path):
    asset = _importer(atelier, client, tmp_path)
    projet = atelier.bibliotheque.courant
    url = f"/api/projects/{projet}/board/assets/{asset.identifiant}"

    refus = client.post(url, json={"position": [1, 2, 3]})
    assert 400 <= refus.status_code < 500, refus.text
