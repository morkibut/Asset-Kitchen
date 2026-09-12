"""Le classement explicite ne change ni le clip payé ni ses occurrences.

La relecture distingue la destination de la provenance ; un refus ne doit rien
écrire sur la bande existante. Aucun fournisseur réel n'est appelé.
"""
import pytest

from test_a9 import atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip, clip_connu, un_personnage, un_sprite  # noqa: F401


def test_destiner_une_bande_et_la_reclasser_sans_changer_sa_source(
    atelier_video, client_video, clip,
):
    source = atelier_video.montage.ouvrir(clip)["clip"]
    autre = atelier_video.production.creer_personnage(source["projet"], "Autre héros")
    reponse = client_video.post("/api/strips", json={
        "clip": clip, "nom": "Nom libre", "images": [12, 14],
        "personnage": autre.identifiant, "pose": "marche", "direction": None,
    })
    assert reponse.status_code == 200, reponse.text
    bande = reponse.json()
    assert bande["personnage"] == autre.identifiant
    assert bande["clip"] == clip
    prises = bande["prises"]
    changee = client_video.put(f"/api/strips/{bande['identifiant']}/case", json={
        "personnage": source["personnage"], "pose": "repos", "direction": None,
    })
    assert changee.status_code == 200, changee.text
    relue = client_video.get(f"/api/strips/{bande['identifiant']}").json()["bande"]
    assert (relue["personnage"], relue["pose"], relue["nom"]) == (source["personnage"], "repos", "Nom libre")
    assert relue["prises"] == prises
    assert relue["clip"] == clip
    assert atelier_video.montage.ouvrir(clip)["clip"]["personnage"] == source["personnage"]


@pytest.mark.parametrize("destination", [
    {"personnage": "autre-projet", "pose": "marche"},
    {"pose": "mouvement-inconnu"},
    {"pose": "marche", "direction": "angle-inconnu"},
    {"personnage": None, "pose": "marche"},
])
def test_destination_refusee_laisse_la_bande_intacte(
    atelier_video, client_video, clip, destination,
):
    source = atelier_video.montage.ouvrir(clip)["clip"]
    gardee = client_video.post("/api/strips", json={"clip": clip, "nom": "Essai", "images": [12, 14]}).json()
    corps = {"personnage": source["personnage"], "pose": "repos", **destination}
    refusee = client_video.put(f"/api/strips/{gardee['identifiant']}/case", json=corps)
    assert refusee.status_code in (400, 404), refusee.text
    relue = client_video.get(f"/api/strips/{gardee['identifiant']}").json()["bande"]
    assert relue == gardee


def test_null_explicite_retire_le_classement_sans_perdre_la_bande(client_video, clip):
    bande = client_video.post("/api/strips", json={"clip": clip, "nom": "Essai", "images": [12, 14]}).json()
    retour = client_video.put(f"/api/strips/{bande['identifiant']}/case", json={"personnage": None, "pose": None, "direction": None})
    assert retour.status_code == 200, retour.text
    assert retour.json()["personnage"] is None
    assert retour.json()["brouillon"] is True
    assert retour.json()["prises"] == bande["prises"]
