"""AU2 : l'intention explicite, ses résultats et sa relecture durable, sans dépense."""

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.calque_anime import Habillage
from atelier.services import Atelier
from tests.conftest import AnimateurMuet
from tests.test_a12 import _poser_une_bande, _poser_une_image


def objectif(direction="ouest"):
    return {
        "sorties": [{"nature": "animation", "pose": "marche", "direction": direction}],
        "largeur": 96, "hauteur": 128, "cadence": 11.0,
        "boucle": False, "repere": {"x": 41.5, "y": 117.0},
    }


def creer(client, *, demande=None):
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    corps = {"nom": "Le pèlerin"}
    if demande is not None:
        corps["objectif"] = demande
    reponse = client.post("/api/characters", json=corps)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def lire(client, personnage):
    reponse = client.get(f"/api/characters/{personnage}/objective")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_une_marche_seule_ne_demande_aucune_image_ni_autre_direction(client, atelier, double):
    p = creer(client, demande=objectif())
    lu = lire(client, p)
    assert lu["origine"] == "explicite"
    assert lu["couverture"]["images"]["demande"] == 0
    assert lu["couverture"]["animations"]["demande"] == 1
    assert lu["couverture"]["animations"]["manquant"] == 1
    assert sum(c["etat"] == "non-demande" for c in lu["couverture"]["cases"]) == 47
    comptes = atelier.production.comptes(lu["projet"], [atelier.production.personnage(lu["projet"], p)])
    assert comptes[p]["images"]["attendu"] == 0
    assert not comptes[p]["complet"]
    assert double.appels == 0


def test_reference_fixe_et_mauvaise_direction_ne_comblent_pas_animation(client, atelier, tmp_path):
    p = creer(client, demande=objectif())
    image = _poser_une_image(client, tmp_path, p, "marche", "ouest")
    # La même image est une référence et une pose fixe ; elle reste distincte.
    personnage = atelier.production.personnage(atelier.bibliotheque.courant, p)
    personnage.references = (image,)
    atelier.production._sauver(personnage)
    _poser_une_bande(atelier, p, "marche", "sud")
    _poser_une_bande(atelier, p, "marche", "sud")
    couverture = lire(client, p)["couverture"]
    assert couverture["images"]["demande"] == 0
    assert couverture["animations"]["produit"] == 0
    assert couverture["animations"]["manquant"] == 1


def test_produire_retenir_ecarter_restent_trois_gestes_distincts(client, atelier):
    p = creer(client, demande=objectif())
    bande = _poser_une_bande(atelier, p, "marche", "ouest")
    lu = lire(client, p)
    assert lu["couverture"]["animations"]["produit"] == 1
    assert lu["couverture"]["animations"]["retenu"] == 0
    bande.favori = True
    atelier.base.enregistrer_bande(bande)
    assert lire(client, p)["couverture"]["animations"]["retenu"] == 1
    bande.supprime_le = 100.0
    atelier.base.enregistrer_bande(bande)
    lu = lire(client, p)
    assert lu["couverture"]["animations"]["manquant"] == 1
    case = next(c for c in lu["couverture"]["cases"] if c["demande"])
    assert case["versions"]["ecartees"][0]["identifiant"] == bande.identifiant


def test_image_et_animation_equipees_ne_comptent_pas_comme_corps(client, atelier, tmp_path):
    demande = objectif()
    demande["sorties"].append({"nature": "image", "pose": "marche", "direction": "ouest"})
    p = creer(client, demande=demande)
    identifiant = _poser_une_image(client, tmp_path, p, "marche", "ouest")
    image = atelier.assets.lire(identifiant)
    image.piece = "casque"
    atelier.base.enregistrer_asset(image)
    bande = _poser_une_bande(atelier, p, "marche", "ouest")
    bande.habillage = Habillage(piece="casque")
    atelier.base.enregistrer_bande(bande)
    lu = lire(client, p)["couverture"]
    assert lu["images"]["manquant"] == lu["animations"]["manquant"] == 1


def test_objectif_survit_a_fermeture_reouverture_et_reconstruction(client, atelier, tmp_path, double):
    p = creer(client, demande=objectif())
    avant = lire(client, p)
    # Un nouveau graphe de services relit les vrais fichiers avec des réglages
    # non défaut ; rien n'est réinjecté depuis la réponse de création.
    autre = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double,
                    fabrique_animateur=lambda: AnimateurMuet())
    with TestClient(creer_application(autre)) as ouvert:
        assert ouvert.post("/api/library/rebuild").status_code == 200
        apres = lire(ouvert, p)
    assert apres == avant
    assert apres["objectif"]["repere"] == {"x": 41.5, "y": 117.0}
    assert apres["objectif"]["cadence"] == 11
    assert not apres["objectif"]["boucle"]


def test_plan_ancien_reste_ancien_apres_lecture_et_objectif_explicite(client, atelier):
    p = creer(client)
    assert client.put(f"/api/characters/{p}", json={"poses": ["repos", "marche"]}).status_code == 200
    avant = atelier.production.personnage(atelier.bibliotheque.courant, p).en_json()
    lu = lire(client, p)
    assert lu["origine"] == "plan-existant"
    assert lu["couverture"]["images"]["demande"] == 8
    assert lu["couverture"]["animations"]["demande"] == 8
    assert atelier.production.personnage(atelier.bibliotheque.courant, p).en_json() == avant
    assert client.put(f"/api/characters/{p}/objective", json={"objectif": objectif()}).status_code == 200
    apres = atelier.production.personnage(atelier.bibliotheque.courant, p).en_json()
    assert {k: v for k, v in apres.items() if k != "objectif"} == {k: v for k, v in avant.items() if k != "objectif"}


def test_liste_vide_est_zero_demande_et_non_retour_au_plan(client):
    p = creer(client, demande={"sorties": []})
    assert lire(client, p)["couverture"]["animations"]["demande"] == 0
    assert lire(client, p)["couverture"]["images"]["demande"] == 0


@pytest.mark.parametrize("changement", [
    {"cadence": 0}, {"boucle": "non"}, {"largeur": 64.5},
    {"sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest", "quantite": 5}]},
    {"sorties": [{"nature": "animation", "pose": "absente", "direction": "ouest"}]},
    {"sorties": [{"nature": "animation", "pose": "marche", "direction": "absente"}]},
])
def test_demande_invalide_ne_modifie_rien(client, changement):
    p = creer(client, demande=objectif())
    avant = lire(client, p)
    reponse = client.put(f"/api/characters/{p}/objective", json={"objectif": {**objectif(), **changement}})
    assert reponse.status_code == 409
    assert lire(client, p) == avant


def test_renommer_pose_ne_change_pas_identite_sortie(client):
    p = creer(client, demande=objectif())
    avant = lire(client, p)
    assert client.put("/api/characters/poses/marche", json={"nom": "Déplacement"}).status_code == 200
    apres = lire(client, p)
    assert apres["objectif"] == avant["objectif"]
    case = next(c for c in apres["couverture"]["cases"] if c["demande"])
    assert case["nom_pose"] == "Déplacement"


def test_bilan_reclame_animation_sans_lui_inventer_prix_image(client, atelier):
    p = creer(client, demande=objectif())
    bilan = atelier.production.bilan_du_jeu(atelier.bibliotheque.courant, atelier.generations)
    assert bilan["lot"]["images"] == 0
    assert bilan["lot"]["animations"] == 1
    assert not bilan["lot"]["cout_connu"]
    assert bilan["familles"][0]["complet"] == 0
    assert bilan["manques"][0]["nature"] == "animation"
    _poser_une_bande(atelier, p, "marche", "ouest")
    bilan = atelier.production.bilan_du_jeu(atelier.bibliotheque.courant, atelier.generations)
    assert bilan["familles"][0]["complet"] == 1
    assert bilan["manques"] == []


async def test_mcp_cree_definit_et_relit_le_meme_objectif_que_interface(client, atelier):
    from atelier.mcp.serveur import creer_serveur
    # Le client ouvre le vrai stockage ; les outils MCP doivent lire ce même jeu.
    serveur = creer_serveur(atelier)
    cree = await serveur.call_tool("create_character", {"name": "Héros par agent"})
    assert not cree.is_error
    identifiant = cree.structured_content["personnage"]
    nouveau = objectif()
    assert client.post("/api/characters/directions", json={"nom": "Ouest"}).status_code == 201
    defini = await serveur.call_tool("set_character_objective", {
        "character": identifiant, "objective": nouveau,
    })
    assert not defini.is_error
    relu = await serveur.call_tool("get_character_objective", {"character": identifiant})
    assert not relu.is_error
    assert relu.structured_content == lire(client, identifiant)
    assert relu.structured_content["objectif"]["sorties"][0]["nature"] == "animation"
