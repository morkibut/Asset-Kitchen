"""AU11 : entre les directions d'un même mouvement, le cadre reste commun.

asset3d ne rend pas d'image ici et ne renvoie l'échelle de caméra ni le pivot
par son contrat HTTP (voir docs/releves/2026-09-12-implementation-atelier-unifie.md
§ « Sources locales et 3D »). Ce qui se prouve sans GPU : les dimensions du
canevas mesurées à l'import ne peuvent pas diverger d'une direction à l'autre
d'un même modèle et d'un même mouvement — l'atelier refuse l'import plutôt que
de composer silencieusement une planche à l'échelle inégale.
"""
import io
import struct
import json

import httpx
import pytest
from PIL import Image

from atelier.fournisseur.asset3d import Source3DRefusee


def png(taille):
    image = Image.new("RGBA", taille)
    fichier = io.BytesIO(); image.save(fichier, "PNG")
    return fichier.getvalue()


def glb():
    contenu = json.dumps({"asset": {"version": "2.0"}}).encode()
    contenu += b" " * (-len(contenu) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, len(contenu) + 20, len(contenu), 0x4E4F534A) + contenu


def _objectif():
    """Un mouvement « marche » dans les trois directions comparées, et un
    mouvement « course » séparé pour vérifier que le contrôle ne déborde pas
    sur un autre mouvement."""
    return {
        "sorties": [
            {"nature": "animation", "pose": "marche", "direction": "est"},
            {"nature": "animation", "pose": "marche", "direction": "sud"},
            {"nature": "animation", "pose": "marche", "direction": "nord"},
            {"nature": "animation", "pose": "course", "direction": "sud"},
        ],
        "largeur": 96, "hauteur": 128, "cadence": 11.0,
        "boucle": False, "repere": {"x": 41.5, "y": 117.0},
    }


@pytest.fixture
def moteur_directions(atelier, client):
    """Trois rendus du même personnage et du même mouvement, tailles réglables."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    personnage = client.post("/api/characters", json={"nom": "Le rôdeur", "objectif": _objectif()}).json()["personnage"]["identifiant"]
    tailles = {"rendu-est": (24, 32), "rendu-sud": (24, 32), "rendu-nord": (24, 32)}

    def repondre(r):
        chemin = r.url.path
        if chemin.endswith("/rendus"):
            return httpx.Response(200, json={"rendus": [
                {"identifiant": id, "actif": False, "etat": "termine",
                 "images": [f"/api/essais/{id}/images/0.png"],
                 "reglages": {"animation": "marche.fbx", "angle": id.split("-")[1], "moteur_3d": "trellis2"}}
                for id in tailles]})
        if chemin.endswith(".png"):
            id = chemin.split("/")[3]
            return httpx.Response(200, content=png(tailles[id]))
        if chemin.endswith("modele.glb"): return httpx.Response(200, content=glb())
        if chemin.endswith("rig.glb"): return httpx.Response(404)
        raise AssertionError(chemin)

    atelier.sources_3d.transport = httpx.MockTransport(repondre)
    atelier.sources_3d.configurer("http://127.0.0.1:8000")
    return atelier.bibliotheque.courant, personnage, tailles


def test_trois_directions_coherentes_du_meme_mouvement_s_importent(atelier, client, moteur_directions):
    projet, personnage, _ = moteur_directions
    for direction, rendu in (("est", "rendu-est"), ("sud", "rendu-sud"), ("nord", "rendu-nord")):
        r = client.post(f"/api/projects/{projet}/3d/import", json={
            "personnage_externe": "hero-directions", "rendu": rendu,
            "personnage": personnage, "pose": "marche", "direction": direction})
        assert r.status_code == 200, r.text
        assert (r.json()["largeur"], r.json()["hauteur"]) == (24, 32)
    sources = atelier.sources_3d.lister(projet, personnage)
    assert {s["direction"] for s in sources} == {"est", "sud", "nord"}
    assert all((s["largeur"], s["hauteur"]) == (24, 32) for s in sources)


def test_une_direction_a_un_autre_cadre_est_refusee_et_rien_n_est_ecrit(atelier, client, moteur_directions):
    projet, personnage, tailles = moteur_directions
    r = client.post(f"/api/projects/{projet}/3d/import", json={
        "personnage_externe": "hero-directions", "rendu": "rendu-est",
        "personnage": personnage, "pose": "marche", "direction": "est"})
    assert r.status_code == 200, r.text
    tailles["rendu-nord"] = (20, 32)  # un cadre différent pour la même animation
    avant = atelier.sources_3d.lister(projet, personnage)
    r = client.post(f"/api/projects/{projet}/3d/import", json={
        "personnage_externe": "hero-directions", "rendu": "rendu-nord",
        "personnage": personnage, "pose": "marche", "direction": "nord"})
    assert r.status_code == 409, r.text
    assert "cadre commun" in r.json()["raison"]
    assert atelier.sources_3d.lister(projet, personnage) == avant


def test_deux_mouvements_differents_peuvent_avoir_des_cadres_differents(atelier, client, moteur_directions):
    """Le contrôle ne porte que sur les directions d'un même mouvement."""
    projet, personnage, tailles = moteur_directions
    r = client.post(f"/api/projects/{projet}/3d/import", json={
        "personnage_externe": "hero-directions", "rendu": "rendu-est",
        "personnage": personnage, "pose": "marche", "direction": "est"})
    assert r.status_code == 200, r.text
    tailles["rendu-sud"] = (40, 40)
    with pytest.MonkeyPatch.context() as mp:
        # Même identifiant de rendu mais un autre mouvement : aucune comparaison.
        def repondre(r):
            if r.url.path.endswith("/rendus"):
                return httpx.Response(200, json={"rendus": [{
                    "identifiant": "rendu-sud", "actif": False, "etat": "termine",
                    "images": ["/api/essais/rendu-sud/images/0.png"],
                    "reglages": {"animation": "course.fbx", "angle": "sud", "moteur_3d": "trellis2"}}]})
            if r.url.path.endswith(".png"): return httpx.Response(200, content=png(tailles["rendu-sud"]))
            if r.url.path.endswith("modele.glb"): return httpx.Response(200, content=glb())
            if r.url.path.endswith("rig.glb"): return httpx.Response(404)
            raise AssertionError(r.url.path)
        atelier.sources_3d.transport = httpx.MockTransport(repondre)
        r = client.post(f"/api/projects/{projet}/3d/import", json={
            "personnage_externe": "hero-directions", "rendu": "rendu-sud",
            "personnage": personnage, "pose": "course", "direction": "sud"})
        assert r.status_code == 200, r.text
