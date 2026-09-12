"""Les surfaces visent les pixels rendus, puis retrouvent leur provenance."""
import io
import numpy as np
from PIL import Image
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import Superposition
from test_a9 import atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip, clip_connu, un_personnage, un_sprite  # noqa: F401
from test_au4_main import touche
from test_v303 import _garder
from test_m1 import _importer, _corps, _grand_dessus


def test_prelever_la_frame_traitee_garde_pixels_et_bande_intacte(atelier_video, client_video, clip, double):
    bande = _garder(client_video, clip)
    identifiant = bande["identifiant"]
    avant = atelier_video.montage.bande(identifiant).en_json()
    prises = [dict(p) for p in bande["prises"]]
    prises[1]["main_apres_placement"] = touche(1, 2).en_json()
    prises[1]["dx"] = 3
    appels = double.appels
    reponse = client_video.post(f"/api/strips/{identifiant}/frames/1/pick", json={"prises": prises, "recette": bande["recette"]})
    assert reponse.status_code == 201, reponse.text
    asset = reponse.json()["asset"]
    pixels = np.asarray(Image.open(io.BytesIO(client_video.get(f"/api/assets/{asset['identifiant']}/image?brut=1").content)))
    assert tuple(pixels[2, 1]) == (255, 0, 0, 255)
    assert asset["recette"] == Recette().en_json()
    filiation = atelier_video.base.lire(asset["generation"]).demande["filiation"]
    assert filiation["bande"] == identifiant
    assert filiation["occurrence"] == prises[1]["identifiant"]
    assert atelier_video.montage.bande(identifiant).en_json() == avant
    assert double.appels == appels
    refuse = client_video.post(f"/api/strips/{identifiant}/frames/999/pick", json={})
    assert refuse.status_code == 400


def test_rouvrir_extraction_retrouve_sources_et_masque_exact(client, atelier, double):
    bas = _importer(client, _corps(64), "corps.png")
    haut = _importer(client, _grand_dessus(128, 64), "dessus.png")
    pose = Superposition.depuis_json({"dessus": haut, "dessous": bas, "dx": 3, "dy": -2, "echelle": .75, "seuil": 54,
        "rectangle": [2, 3, 52, 59], "main": [{"garde": True, "rayon": 1, "points": [[7, 8]], "couleur": ""}]})
    appels = double.appels
    reponse = client.post("/api/overlay", json={"pose": pose.en_json(), "sorties": ["calque"]})
    assert reponse.status_code == 200, reponse.text
    image = reponse.json()["superpositions"][0]
    relue = atelier.superposition.ouvrir(image["identifiant"])
    assert relue["dessus"]["identifiant"] == haut
    assert relue["dessous"]["identifiant"] == bas
    assert relue["pose"] == pose.en_json()
    original = client.post("/api/overlay/preview", json=pose.en_json()).json()
    reprise = client.post("/api/overlay/preview", json=relue["pose"]).json()
    assert original["calque"] == reprise["calque"]
    assert double.appels == appels
