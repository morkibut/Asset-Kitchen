"""Un rendu 3D reste modifiable et exportable après fermeture du moteur."""
import asyncio
import io
import json
import struct

import httpx
import pytest
from PIL import Image

from atelier.fournisseur.asset3d import Source3DRefusee, verifier_glb
from atelier.services import Atelier
from tests.conftest import AnimateurMuet


def png(rang):
    image = Image.new("RGBA", (24, 32))
    image.putpixel((3 + rang, 8), (40, 90, 210, 180))
    fichier = io.BytesIO(); image.save(fichier, "PNG")
    return fichier.getvalue()


def glb(document=None):
    contenu = json.dumps(document or {"asset": {"version": "2.0"}}).encode()
    contenu += b" " * (-len(contenu) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, len(contenu) + 20, len(contenu), 0x4E4F534A) + contenu


@pytest.fixture
def scene(atelier, client):
    personnage = client.post("/api/characters", json={"nom": "Le marcheur"}).json()["personnage"]["identifiant"]
    chemins = []
    def repondre(r):
        chemins.append((r.method, r.url.path))
        if r.url.path.endswith("/rendus"):
            return httpx.Response(200, json={"rendus": [{"identifiant": "rendu-1", "actif": False, "etat": "termine", "images": [f"/api/essais/rendu-1/images/{i}.png" for i in range(3)], "reglages": {"animation": "walk.fbx", "angle": "trois-quarts", "style": "pixel", "moteur_3d": "trellis2"}}]})
        if r.url.path.endswith(".png"): return httpx.Response(200, content=png(int(r.url.path.rsplit("/", 1)[1][:-4])))
        if r.url.path.endswith("modele.glb"): return httpx.Response(200, content=glb())
        if r.url.path.endswith("rig.glb"): return httpx.Response(404)
        raise AssertionError(r.url)
    atelier.sources_3d.transport = httpx.MockTransport(repondre)
    atelier.sources_3d.configurer("http://127.0.0.1:8000")
    return atelier.bibliotheque.courant, personnage, chemins


def test_import_puis_reouverture_moteur_eteint_conserve_alpha_reperes_et_classement(atelier, client, scene, tmp_path, double):
    projet, personnage, chemins = scene
    corps = {"personnage_externe": "hero-1", "rendu": "rendu-1", "personnage": personnage, "pose": "marche", "nom": "Marche 3D", "cadence": 13}
    rep = client.post(f"/api/projects/{projet}/3d/import", json=corps)
    assert rep.status_code == 200, rep.text
    source = rep.json()
    assert all(m == "GET" for m, _ in chemins)
    bande = atelier.montage.bande(source["bandes"][0])
    assert (bande.personnage, bande.pose, bande.cadence, bande.case_largeur, bande.case_hauteur) == (personnage, "marche", 13, 24, 32)
    planche = Image.open(io.BytesIO(atelier.montage.planche(bande.identifiant)))
    for i in range(3): assert planche.getpixel((i * 24 + 3 + i, 8)) == (40, 90, 210, 180)
    nouveau = client.post(f"/api/projects/{projet}/3d/import", json=corps).json()
    assert nouveau["identifiant"] == source["identifiant"] and nouveau["bandes"] == source["bandes"]
    rouvert = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double, fabrique_animateur=AnimateurMuet)
    asyncio.run(rouvert.ouvrir())
    lu = rouvert.sources_3d.lister(projet, personnage)[0]
    assert lu["provenance"]["reglages"]["angle"] == "trois-quarts"
    assert rouvert.sources_3d.fichier(projet, lu["identifiant"], "modele.glb").read_bytes().startswith(b"glTF")
    assert rouvert.montage.planche(bande.identifiant) == atelier.montage.planche(bande.identifiant)
    assert client.get(f"/api/projects/{projet}/3d/sources/{source['identifiant']}/files/frame-0000.png").content == png(0)


def test_un_lien_etranger_du_moteur_ne_se_telecharge_pas(atelier, client, scene):
    projet, personnage, _ = scene
    def repondre(r):
        if r.url.path.endswith("/rendus"):
            return httpx.Response(200, json={"rendus": [{"identifiant": "rendu-1", "actif": False, "images": ["http://ailleurs/secrets"]}]})
        raise AssertionError("aucune autre adresse ne doit être consultée")
    atelier.sources_3d.transport = httpx.MockTransport(repondre)
    r = client.post(f"/api/projects/{projet}/3d/import", json={"personnage_externe": "hero", "rendu": "rendu-1", "personnage": personnage, "pose": "repos"})
    assert r.status_code == 409
    assert not atelier.sources_3d.lister(projet)


def test_adresse_exige_un_moteur_local_et_import_valide_avant_lire(atelier, client, scene):
    projet, _, chemins = scene
    assert client.put("/api/3d/connection", json={"adresse": "https://ailleurs.example"}).status_code == 409
    assert client.post(f"/api/projects/{projet}/3d/import", json={"personnage_externe": "hero", "rendu": "rendu-1", "pose": "marche"}).status_code == 400
    assert chemins == []


def test_glb_tronque_ou_textures_externes_ne_promet_pas_une_copie_autonome():
    verifier_glb(glb())
    with pytest.raises(Source3DRefusee, match="complet"):
        verifier_glb(glb()[:-1])
    with pytest.raises(Source3DRefusee, match="externe"):
        verifier_glb(glb({"asset": {"version": "2.0"}, "images": [{"uri": "https://ailleurs/texture.png"}]}))
