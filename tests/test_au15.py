"""AU15 : cibles exactes, gestes CPU, occurrences et relecture non destructrice."""
import io
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.api.calques_cibles import routeur
from atelier.domaine.bande import Prise
from atelier.domaine.calques_cibles import PlacementCalque
from atelier.domaine.recette import Recette
from atelier.image.calques_cibles import composer, couches, png, rgba
from atelier.services import Atelier
from atelier.services.calques_cibles import ServiceCalquesCibles
from atelier.services.production import ProductionRefusee
from atelier.mcp.serveur import creer_serveur
from tests.conftest import AnimateurMuet
from tests.test_b20 import _clip_ecrit, _poser_une_bande
from tests.test_t7 import appeler


def service(atelier):
    return ServiceCalquesCibles(atelier.base, atelier.fichiers, atelier.production,
        atelier.equipement, atelier.assets, atelier.montage, atelier.bibliotheque, atelier.diffusion)


def importer(atelier, client, tmp_path, pixels, nom):
    chemin = tmp_path / (nom + ".png")
    chemin.write_bytes(png(pixels))
    reponse = client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True})
    assert reponse.status_code == 201, reponse.text
    identifiant = reponse.json()["asset"]["identifiant"]
    objet = atelier.assets.lire(identifiant)
    objet.recette = Recette()
    atelier.assets.sauver(objet)
    return identifiant


@pytest.fixture
def decor(atelier, client, tmp_path):
    svc = service(atelier)
    p = client.post("/api/characters", json={"nom": "Le pèlerin"}).json()["personnage"]["identifiant"]
    piece = client.post("/api/characters/pieces", json={"nom": "Épée divine", "porteur": p}).json()["piece"]["identifiant"]
    emploi = atelier.equipement.emplois(atelier.bibliotheque.courant, piece)[0].identifiant
    pixels = np.zeros((48, 48, 4), dtype=np.uint8)
    pixels[10:38, 16:30] = (50, 60, 70, 255)
    corps = importer(atelier, client, tmp_path, pixels, "corps")
    assert client.put(f"/api/assets/{corps}/character", json={"personnage": p, "pose": "repos"}).status_code == 200
    equipe = pixels.copy()
    equipe[18:20, 29:43] = (210, 120, 20, 255)
    source = importer(atelier, client, tmp_path, equipe, "source-equipee")
    return svc, (atelier.bibliotheque.courant, piece, emploi), p, corps, source


def creer_source(decor):
    svc, chemin, _, corps, source = decor
    return svc.creer(*chemin, {"nature": "image", "resultat": corps}, source, "source-equipee")


def test_extraction_reelle_ne_confond_pas_source_et_calque(decor, atelier, double):
    svc, chemin, _, corps, _ = decor
    avant = atelier.assets.octets(atelier.assets.lire(corps))[0]
    source = creer_source(decor)
    assert source["etat"] == "a-extraire" and not source["utilisable"]
    with pytest.raises(ProductionRefusee):
        svc.valider(*chemin, source["identifiant"], 1)
    variante = svc.extraire(*chemin, source["identifiant"], reglage={"seuil": 8})
    assert variante["etat"] == "a-verifier"
    assert atelier.assets.lire(variante["calque_asset"]) is not None
    calque = rgba(svc.apercu(*chemin, variante["identifiant"], "calque"))
    assert calque[18, 40, 3] == 255
    assert calque[25, 22, 3] == 0
    retenue = svc.valider(*chemin, variante["identifiant"], 1)
    assert retenue["utilisable"]
    assert svc.lire(*chemin, source["identifiant"])["etat"] == "a-extraire"
    assert atelier.assets.octets(atelier.assets.lire(corps))[0] == avant
    assert double.appels == 0


def test_correction_masques_et_placement_survit_reouverture(decor, atelier, double, tmp_path):
    svc, chemin, _, _, _ = decor
    source = creer_source(decor)
    v = svc.extraire(*chemin, source["identifiant"])
    masques = {"calque": [{"garde": False, "rayon": 0, "points": [[40, 18]]}],
               "corps": [{"garde": False, "rayon": 1, "points": [[24, 10]]}],
               "derriere": [{"garde": True, "rayon": 1, "points": [[30, 19]]}]}
    v = svc.regler(*chemin, v["identifiant"], 1, placement={"dx": 3, "dy": -2, "echelle": 1.25, "rotation": 17, "opacite": .7, "ordre": 4}, masques=masques)
    rendu = svc.apercu(*chemin, v["identifiant"])
    autre = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurMuet())
    with TestClient(creer_application(autre)) as ouvert:
        assert ouvert.post("/api/library/rebuild").status_code == 200
        relu = service(autre)
        apres = relu.lire(*chemin, v["identifiant"])
        assert apres["placement"] == v["placement"]
        assert apres["masques"] == v["masques"]
        assert relu.apercu(*chemin, v["identifiant"]) == rendu
        assert len(apres["historique"]) == 1


def test_une_partie_passe_dessous_et_le_masque_du_corps_est_independant():
    corps = np.zeros((8, 8, 4), dtype=np.uint8)
    corps[2:6, 2:6] = (0, 0, 255, 255)
    calque = np.zeros_like(corps)
    calque[3, 1:7] = (255, 0, 0, 255)
    masques = {"derriere": [{"garde": True, "rayon": 0, "points": [[3, 3]]}],
               "corps": [{"garde": False, "rayon": 0, "points": [[4, 4]]}]}
    composee = rgba(composer(corps, calque, PlacementCalque(), masques))
    assert tuple(composee[3, 3]) == (0, 0, 255, 255)
    assert tuple(composee[3, 4]) == (255, 0, 0, 255)
    assert composee[4, 4, 3] == 0
    assert corps[4, 4, 3] == 255


def test_retenir_une_variante_conserve_les_autres_et_refuse_revision_perimee(decor):
    svc, chemin, _, _, _ = decor
    source = creer_source(decor)
    a = svc.extraire(*chemin, source["identifiant"])
    b = svc.extraire(*chemin, source["identifiant"])
    svc.valider(*chemin, a["identifiant"], 1)
    svc.valider(*chemin, b["identifiant"], 1)
    assert not svc.lire(*chemin, a["identifiant"])["retenue"]
    assert svc.lire(*chemin, b["identifiant"])["retenue"]
    svc.regler(*chemin, b["identifiant"], 1, placement={"dx": 3})
    with pytest.raises(ProductionRefusee, match="autre écran"):
        svc.regler(*chemin, b["identifiant"], 1, placement={"dx": 99})
    assert svc.lire(*chemin, b["identifiant"])["placement"]["dx"] == 3


def test_cible_autre_personnage_refusee_et_piece_commune_renommable(decor, atelier, client):
    svc, chemin, _, corps, source = decor
    v = creer_source(decor)
    autre = client.post("/api/characters", json={"nom": "Le nain"}).json()["personnage"]["identifiant"]
    emploi = atelier.equipement.ajouter_emploi(chemin[0], chemin[1], porteur=autre)
    with pytest.raises(ProductionRefusee):
        svc.creer(chemin[0], chemin[1], emploi.identifiant, {"nature": "image", "resultat": corps}, source, "source-equipee")
    atelier.equipement.regler_piece(chemin[0], chemin[1], nom="Lame divine")
    assert svc.cibles(*chemin)["piece"]["nom"] == "Lame divine"
    assert svc.lire(*chemin, v["identifiant"])["source"] == source


def test_reordonner_frame_garde_son_calque_et_la_retouche_signale_a_revoir(decor, atelier):
    svc, chemin, p, _, source = decor
    _clip_ecrit(atelier)
    bande = _poser_une_bande(atelier, personnage=p, pose="repos")
    cibles = [c for c in svc.cibles(*chemin)["cibles"] if c["cible"]["nature"] == "frame"]
    cible = cibles[1]["cible"]
    variante = svc.creer(*chemin, cible, source, "source-equipee")
    bande = atelier.montage.bande(bande.identifiant)
    ancienne = bande.prises[1]
    ordre = [ancienne, bande.prises[0], *bande.prises[2:]]
    atelier.montage.corriger(bande.identifiant, prises=ordre)
    assert svc.lire(*chemin, variante["identifiant"])["etat"] == "a-extraire"
    ordre[0] = replace(ancienne, dx=3)
    atelier.montage.corriger(bande.identifiant, prises=ordre)
    assert svc.lire(*chemin, variante["identifiant"])["etat"] == "a-revoir"
    relue = svc.adopter(*chemin, variante["identifiant"], 1, cible)
    assert relue["etat"] == "a-extraire"
    assert len(relue["historique"]) == 1
    atelier.montage.corriger(bande.identifiant, prises=ordre[1:])
    relue = svc.lire(*chemin, variante["identifiant"])
    assert relue["etat"] == "a-revoir"
    assert "plus dans le ruban" in relue["raison"]


def test_les_prises_historiques_ne_gagnent_pas_de_champ_a_la_relecture():
    ancienne = {"numero": 4, "clip": "", "dx": 3, "dy": -2}
    assert Prise.depuis_json(ancienne).en_json() == ancienne
    copie = Prise.depuis_json({**ancienne, "identifiant": "occurrence-1"})
    assert copie.en_json()["identifiant"] == "occurrence-1"


def test_dupliquer_une_image_ne_reutilise_pas_son_identite_de_frame(decor, atelier):
    svc, chemin, p, _, source = decor
    _clip_ecrit(atelier)
    bande = _poser_une_bande(atelier, personnage=p, pose="repos")
    cible = next(c["cible"] for c in svc.cibles(*chemin)["cibles"] if c["cible"]["nature"] == "frame")
    variante = svc.creer(*chemin, cible, source, "source-equipee")
    bande = atelier.montage.bande(bande.identifiant)
    original = bande.prises[0]
    with pytest.raises(Exception, match="identifiant"):
        atelier.montage.corriger(bande.identifiant, prises=[original, *bande.prises])
    atelier.montage.corriger(bande.identifiant, prises=[replace(original, identifiant=""), *bande.prises])
    relue = atelier.montage.bande(bande.identifiant)
    assert relue.prises[0].identifiant != original.identifiant
    assert relue.prises[1].identifiant == original.identifiant
    assert svc.lire(*chemin, variante["identifiant"])["etat"] == "a-extraire"


@pytest.mark.asyncio
async def test_mcp_partage_cibles_extraction_et_validation_avec_l_interface(decor, atelier, double):
    svc, chemin, _, corps, source = decor
    serveur = creer_serveur(atelier)
    arguments = dict(project=chemin[0], piece=chemin[1], employment=chemin[2])
    creee = await appeler(serveur, "create_equipment_layer", **arguments,
                         target={"nature": "image", "resultat": corps}, source=source, role="source-equipee")
    assert creee == svc.lire(*chemin, creee["identifiant"])
    extraite = await appeler(serveur, "extract_equipment_layer", **arguments, layer=creee["identifiant"])
    retenue = await appeler(serveur, "validate_equipment_layer", **arguments, layer=extraite["identifiant"], revision=1)
    assert retenue["utilisable"]
    cibles = await appeler(serveur, "list_equipment_targets", **arguments)
    assert cibles == svc.cibles(*chemin)
    assert double.appels == 0


def test_api_emploie_le_meme_service_et_rend_apercu_png(decor, atelier):
    svc, chemin, _, corps, source = decor
    atelier.calques_cibles = svc
    application = creer_application(atelier)
    if not any(getattr(r, "path", "").endswith("/layers/{identifiant}/preview.png") for r in application.routes):
        application.include_router(routeur, prefix="/api")
    with TestClient(application) as client:
        prefixe = f"/api/projects/{chemin[0]}/equipment/{chemin[1]}/uses/{chemin[2]}"
        reponse = client.post(prefixe + "/layers", json={"cible": {"nature": "image", "resultat": corps}, "source": source, "role": "source-equipee"})
        assert reponse.status_code == 201, reponse.text
        identifiant = reponse.json()["identifiant"]
        assert client.get(prefixe + f"/layers/{identifiant}").json() == svc.lire(*chemin, identifiant)
        apercu = client.get(prefixe + f"/layers/{identifiant}/preview.png")
        assert apercu.status_code == 200 and apercu.headers["content-type"] == "image/png"
        assert Image.open(io.BytesIO(apercu.content)).size == (48, 48)


def test_apercu_de_l_extraction_et_resultat_garde_sont_les_memes_sans_ecriture_avant(decor):
    svc, chemin, _, _, _ = decor
    v = creer_source(decor)
    reglage = {"seuil": 17, "dx": 2, "dy": -1, "echelle": .9}
    avant = svc._brut(*chemin, v["identifiant"])
    prevision = svc.apercu(*chemin, v["identifiant"], "calque", extraction=reglage)
    assert svc._brut(*chemin, v["identifiant"]) == avant
    assert len(svc.cibles(*chemin)["variantes"]) == 1
    extraite = svc.extraire(*chemin, v["identifiant"], reglage=reglage)
    assert svc.apercu(*chemin, extraite["identifiant"], "calque") == prevision
    assert extraite["extraction"]["dx"] == 2
    assert svc.cibles(*chemin)["calques_retenus"] == 0


# ── L'ordre des images, en vue 3/4 ──────────────────────────────────────────
#
# Le contrat porte déjà la finesse : `placement.devant` donne l'ordre par
# défaut, et le masque `derriere` peint les morceaux qui passent sous le corps.
# Ces deux réglages appartiennent à une variante, donc à une cible, donc à une
# frame. Aucune direction n'entre nulle part dans la composition.


def test_une_piece_passe_moitie_dessous_moitie_dessus_sur_une_seule_frame():
    corps = np.zeros((8, 8, 4), dtype=np.uint8)
    corps[2:6, 2:6] = (0, 0, 255, 255)
    calque = np.zeros_like(corps)
    calque[3, 1:7] = (255, 0, 0, 255)
    # Une seule moitié peinte : la gauche passe sous le corps, la droite reste
    # au-dessus — c'est le sac qui dépasse de la silhouette sans percer le torse.
    moitie_gauche = {"derriere": [{"garde": True, "rayon": 1, "points": [[2, 3]]}]}
    sous, _, dessus = couches(corps, calque, PlacementCalque(devant=True), moitie_gauche)
    assert sous[3, 2, 3] == 255 and dessus[3, 2, 3] == 0
    assert dessus[3, 5, 3] == 255 and sous[3, 5, 3] == 0
    # L'ordre par défaut inversé range tout dessous, sans toucher au masque.
    sous, _, dessus = couches(corps, calque, PlacementCalque(devant=False), moitie_gauche)
    assert sous[3, 5, 3] == 255 and dessus[3, 5, 3] == 0
    assert not dessus[:, :, 3].any()


def test_deux_frames_de_la_meme_bande_gardent_chacune_son_ordre(decor, atelier):
    svc, chemin, p, _, source = decor
    _clip_ecrit(atelier)
    _poser_une_bande(atelier, personnage=p, pose="repos")
    frames = [c["cible"] for c in svc.cibles(*chemin)["cibles"] if c["cible"]["nature"] == "frame"]
    assert len(frames) > 1
    premiere = svc.creer(*chemin, frames[0], source, "source-equipee")
    seconde = svc.creer(*chemin, frames[1], source, "source-equipee")
    premiere = svc.regler(*chemin, premiere["identifiant"], 1, placement={"devant": True},
                          masques={"derriere": [{"garde": True, "rayon": 2, "points": [[30, 19]]}]})
    seconde = svc.regler(*chemin, seconde["identifiant"], 1, placement={"devant": False}, masques={"derriere": []})
    relue, autre = svc.lire(*chemin, premiere["identifiant"]), svc.lire(*chemin, seconde["identifiant"])
    assert relue["placement"]["devant"] is True and relue["masques"]["derriere"]
    assert autre["placement"]["devant"] is False and autre["masques"]["derriere"] == []
    assert relue["cible"]["prise"] != autre["cible"]["prise"]


def test_le_meme_calque_sur_deux_directions_se_compose_a_l_identique(decor, atelier, client, tmp_path):
    """L'ordre est celui des images, pas celui du regard : deux bases aux pixels
    identiques et aux directions opposées rendent exactement la même image."""
    svc, chemin, p, corps, source = decor
    pixels = rgba(atelier.assets.octets(atelier.assets.lire(corps))[0])
    est = importer(atelier, client, tmp_path, pixels, "corps-est")
    ouest = importer(atelier, client, tmp_path, pixels, "corps-ouest")
    for nom in ("Est", "Ouest"):
        assert client.post("/api/characters/directions", json={"nom": nom}).status_code == 201
    for identifiant, direction in ((est, "est"), (ouest, "ouest")):
        reponse = client.put(f"/api/assets/{identifiant}/character",
                             json={"personnage": p, "pose": "repos", "direction": direction})
        assert reponse.status_code == 200, reponse.text
    depart = svc.creer(*chemin, {"nature": "image", "resultat": est}, source, "source-equipee")
    a = svc.extraire(*chemin, depart["identifiant"], reglage={"seuil": 8})
    a = svc.regler(*chemin, a["identifiant"], 1, placement={"devant": True},
                   masques={"derriere": [{"garde": True, "rayon": 2, "points": [[40, 18]]}]})
    [b] = svc.reutiliser(*chemin, a["identifiant"], [{"nature": "image", "resultat": ouest}],
                         copier_placement=True, copier_masques=True)
    assert svc.lire(*chemin, a["identifiant"])["base"]["direction"] == "est"
    assert svc.lire(*chemin, b["identifiant"])["base"]["direction"] == "ouest"
    assert svc.apercu(*chemin, a["identifiant"]) == svc.apercu(*chemin, b["identifiant"])
