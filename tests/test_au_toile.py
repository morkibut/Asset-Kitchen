"""Poser une fabrication en inspiration conserve une copie et sa provenance."""
from atelier.domaine.recette import Recette
from tests.conftest import image_sujet


def test_resultat_sur_toile_copie_reouvrable_sans_modifier_asset(atelier, client, tmp_path):
    chemin = tmp_path / "inspiration.png"
    chemin.write_bytes(image_sujet())
    r = client.post("/api/assets/import", json={"chemin": str(chemin)})
    assert r.status_code == 201, r.text
    asset = atelier.assets.lire(r.json()["asset"]["identifiant"])
    asset.recette = Recette()
    atelier.assets.sauver(asset)
    projet = atelier.bibliotheque.courant
    url = f"/api/projects/{projet}/board/assets/{asset.identifiant}"
    avant = asset.en_json()
    posee = client.post(url)
    assert posee.status_code == 200, posee.text
    carte = posee.json()["carte"]
    assert carte["position"] == [0, 0]
    assert carte["source"] == f"asset:{asset.identifiant}"
    assert atelier.univers.octets(projet, carte["identifiant"])[0] == chemin.read_bytes()
    assert atelier.assets.lire(asset.identifiant).en_json() == avant
    assert client.post(url).json() == {"carte": carte, "deja_presente": True}
    tableau = client.get("/api/board", params={"projet": projet}).json()
    assert any(c["identifiant"] == carte["identifiant"] and c["position"] == [0, 0] for c in tableau["cartes"])
