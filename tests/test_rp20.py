# -*- coding: utf-8 -*-
"""RP20 — *Enregistrer sous* : un rendu devient une autre pose ou direction.

Les huit critères de `docs/PLAN-remise-a-plat.md` § RP20. **Aucun ne coûte un
centime, et aucun ne demande de décodeur vidéo** : le clip de ces essais est
écrit à la main, image par image, comme celui d'`AU19`.

**Le critère le plus dur à tenir est celui qui ne se voit pas** : *l'original
garde sa recette et son rendu, vérifié à l'octet*. Le geste passe par le chemin
de rendu qui ne pose aucun cache durable ; l'essai le mesure en relevant
l'empreinte de **tous** les fichiers de la génération avant le geste et en les
comparant après. Un essai qui ne comparerait que la recette passerait aussi bien
avec un rendu réécrit sous les doigts de l'auteur.
"""

from __future__ import annotations

import hashlib
import io
import time
import uuid
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.animation import Clip
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.domaine.recette import Recette, Retournement

COTE = 24


# ── De quoi travailler ───────────────────────────────────────────────────────


def _dissymetrique(teinte: tuple[int, int, int] = (190, 40, 40)) -> bytes:
    """Un sujet qu'un miroir change forcément.

    Un carré centré serait son propre miroir : l'essai passerait sans que rien
    ne soit retourné. Celui-ci porte un bras d'un seul côté.
    """
    rgba = np.zeros((COTE, COTE, 4), dtype=np.uint8)
    rgba[6:18, 8:14, :3] = teinte
    rgba[6:18, 8:14, 3] = 255
    rgba[8:11, 14:20, :3] = (40, 120, 190)  # le bras, à droite seulement
    rgba[8:11, 14:20, 3] = 255
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _poser(client, octets: bytes | None = None, nom: str = "marche.png") -> str:
    """L'image entre en bibliothèque **sans passer par le fournisseur**."""
    reponse = client.post(
        "/api/assets/upload",
        content=octets if octets is not None else _dissymetrique(),
        params={"nom": nom, "traiter": "false"},
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def _jeu_a_quatre_directions(client) -> None:
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200


def _sujet(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom, "description": ""})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _ranger(client, asset: str, sujet: str, pose: str, direction: str) -> None:
    reponse = client.put(
        f"/api/assets/{asset}/character",
        json={"personnage": sujet, "pose": pose, "direction": direction},
    )
    assert reponse.status_code == 200, reponse.text


MIROIR = {"retournement": {"sens": "gauche-droite"}}


def _poser_le_miroir(client, asset: str) -> dict:
    reponse = client.put(f"/api/assets/{asset}/recipe", json=MIROIR)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _image_prete(
    client, direction: str = "est", nom: str = "Le pèlerin"
) -> tuple[str, str]:
    """Une image rangée dans une case, avec un miroir appliqué."""
    _jeu_a_quatre_directions(client)
    sujet = _sujet(client, nom)
    asset = _poser(client)
    _ranger(client, asset, sujet, "marche", direction)
    _poser_le_miroir(client, asset)
    return asset, sujet


def _empreintes(racine: Path, generation: str) -> dict[str, str]:
    """Ce que le dossier de la génération porte, **fichier par fichier**."""
    dossier = racine / "generations" / generation
    return {
        chemin.name: hashlib.sha256(chemin.read_bytes()).hexdigest()
        for chemin in sorted(dossier.glob("*"))
        if chemin.is_file()
    }


def _pixels(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as ouverte:
        return np.array(ouverte.convert("RGBA"))


# ── Une image ────────────────────────────────────────────────────────────────


def test_le_rendu_devient_une_image_neuve_a_recette_vide(client):
    """Le premier critère : le brut du neuf **est** le rendu de l'original."""
    asset, _ = _image_prete(client)
    rendu = client.get(f"/api/assets/{asset}/image")
    assert rendu.status_code == 200

    reponse = client.post(f"/api/assets/{asset}/save-as", json={})
    assert reponse.status_code == 201, reponse.text
    neuf = reponse.json()["asset"]

    assert neuf["identifiant"] != asset
    assert neuf["recette"] == Recette().en_json()
    assert neuf["traite"] is False
    brut = client.get(f"/api/assets/{neuf['identifiant']}/image?brut=true")
    assert brut.status_code == 200
    assert np.array_equal(_pixels(brut.content), _pixels(rendu.content))


def test_l_original_garde_sa_recette_et_son_rendu_a_l_octet(client, atelier):
    """*Vérifié à l'octet* — et sur **tous** les fichiers de la génération.

    Comparer la seule recette laisserait passer un rendu réécrit ; comparer le
    seul rendu laisserait passer un fichier d'asset touché. On compare le
    dossier.
    """
    asset, _ = _image_prete(client)
    # Le rendu est demandé une fois d'abord : sans ça, on mesurerait la
    # différence entre « pas encore calculé » et « calculé », pas le geste.
    assert client.get(f"/api/assets/{asset}/image").status_code == 200
    generation = client.get(f"/api/assets/{asset}").json()["generation"]
    avant = _empreintes(atelier.fichiers.racine, generation)

    reponse = client.post(f"/api/assets/{asset}/save-as", json={})
    assert reponse.status_code == 201, reponse.text
    neuf = reponse.json()["asset"]["identifiant"]

    apres = _empreintes(atelier.fichiers.racine, generation)
    # Les fichiers du neuf s'ajoutent ; aucun de ceux d'avant ne change.
    rang = reponse.json()["asset"]["rang"]
    ajoutes = {nom for nom in apres if nom.startswith(f"{rang}-")}
    assert ajoutes, "le neuf doit poser ses propres fichiers"
    assert {n: e for n, e in apres.items() if n not in ajoutes} == avant

    relu = client.get(f"/api/assets/{asset}").json()
    assert relu["recette"]["retournement"] == {"sens": "gauche-droite"}
    assert relu["traite"] is True
    assert client.get(f"/api/assets/{neuf}").json()["traite"] is False


def test_la_direction_au_miroir_est_proposee_et_appliquee(client):
    """*Avec un miroir dans la recette, la direction proposée est celle au miroir.*"""
    asset, _ = _image_prete(client, direction="est")
    propose = client.post(f"/api/assets/{asset}/save-as/preview", json={}).json()
    assert propose["miroir"] is True
    assert propose["direction_depart"] == "est"
    assert propose["direction"] == "ouest"
    assert propose["raison"] is None
    assert {d["identifiant"] for d in propose["directions"]} >= {"est", "ouest"}
    assert [p["identifiant"] for p in propose["poses"]][:1] == ["repos"]

    neuf = client.post(f"/api/assets/{asset}/save-as", json={}).json()["asset"]
    assert neuf["direction"] == "ouest"
    assert neuf["pose"] == "marche"
    assert neuf["personnage"] == propose["sujet"]


def test_sans_miroir_la_case_proposee_est_celle_de_l_original(client):
    """*Sinon la même case, à corriger* — le produit ne devine pas une opposée."""
    _jeu_a_quatre_directions(client)
    sujet = _sujet(client)
    asset = _poser(client)
    _ranger(client, asset, sujet, "marche", "est")
    assert client.put(
        f"/api/assets/{asset}/recipe", json={"contours": {"epaisseur": 1}}
    ).status_code == 200

    propose = client.post(f"/api/assets/{asset}/save-as/preview", json={}).json()
    assert propose["miroir"] is False
    assert propose["direction"] == "est"


def test_la_case_designee_l_emporte_sur_la_proposition(client):
    """L'écran a le dernier mot : ce que l'auteur désigne est ce qui est écrit."""
    asset, sujet = _image_prete(client)
    neuf = client.post(
        f"/api/assets/{asset}/save-as",
        json={"pose": "repos", "direction": "nord", "nom": "le pèlerin au nord"},
    ).json()["asset"]
    assert (neuf["pose"], neuf["direction"]) == ("repos", "nord")
    assert neuf["label"] == "le pèlerin au nord"


def test_une_case_qui_n_existe_pas_est_refusee_en_le_disant(client):
    """La case se valide **avant** d'écrire, comme la destination d'une bande."""
    asset, _ = _image_prete(client)
    reponse = client.post(
        f"/api/assets/{asset}/save-as", json={"direction": "en-diagonale"}
    )
    assert reponse.status_code == 409, reponse.text
    assert "direction" in reponse.json()["raison"]


def test_la_filiation_va_dans_les_deux_sens(client):
    """*Le nouvel asset dit son origine ; la fiche de l'original le liste.*"""
    asset, _ = _image_prete(client)
    recette_employee = client.get(f"/api/assets/{asset}").json()["recette"]

    neuf = client.post(f"/api/assets/{asset}/save-as", json={}).json()["asset"]
    origine = neuf["origine"]
    assert origine["source"] == asset
    assert origine["nature"] == "image"
    assert origine["miroir"] is True
    assert origine["direction"] == "est"
    assert origine["recette"] == recette_employee
    assert neuf["parent"] == asset

    filiation = client.get(f"/api/assets/{asset}/lineage").json()
    assert neuf["identifiant"] in [e["identifiant"] for e in filiation["enfants"]]
    propose = client.post(f"/api/assets/{asset}/save-as/preview", json={}).json()
    assert [d["identifiant"] for d in propose["derives"]] == [neuf["identifiant"]]


def test_la_nouvelle_case_n_est_pas_retenue_pour_le_jeu(client):
    """*Ce n'est pas retenir* : la retenir est un second geste."""
    asset, _ = _image_prete(client)
    neuf = client.post(f"/api/assets/{asset}/save-as", json={}).json()["asset"]
    assert neuf["favori"] is False
    assert neuf["consomme"] == 0
    assert neuf["cout_usd"] == 0


def test_sans_retouche_le_geste_est_ferme_avec_sa_raison(client):
    """*Grisé avec sa raison sinon* — et la raison se lit avant le clic."""
    _jeu_a_quatre_directions(client)
    sujet = _sujet(client)
    asset = _poser(client)
    _ranger(client, asset, sujet, "marche", "est")

    propose = client.post(f"/api/assets/{asset}/save-as/preview", json={}).json()
    assert propose["raison"]
    assert "retouche" in propose["raison"]

    refus = client.post(f"/api/assets/{asset}/save-as", json={})
    assert refus.status_code == 409, refus.text
    assert refus.json()["raison"] == propose["raison"]


def test_la_recette_de_l_ecran_prime_celle_du_disque(client):
    """*Sa recette courante telle que l'écran la tient, pas forcément enregistrée.*"""
    _jeu_a_quatre_directions(client)
    sujet = _sujet(client)
    asset = _poser(client)
    _ranger(client, asset, sujet, "marche", "est")

    propose = client.post(
        f"/api/assets/{asset}/save-as/preview", json={"recette": MIROIR}
    ).json()
    assert propose["raison"] is None
    assert propose["direction"] == "ouest"

    neuf = client.post(
        f"/api/assets/{asset}/save-as", json={"recette": MIROIR}
    ).json()["asset"]
    assert neuf["direction"] == "ouest"
    # Le disque n'a pas bougé : la recette de l'original est toujours vide.
    assert client.get(f"/api/assets/{asset}").json()["traite"] is False


# ── Une animation ────────────────────────────────────────────────────────────


@pytest.fixture
def bande(client, atelier):
    """Une animation de quatre frames, rangée *marche vers l'est*.

    **Le clip est écrit à la main** : ni décodeur vidéo, ni appel. C'est la
    même privation que le montage lui-même, et c'est ce qui rend ces essais
    exécutables sur une machine sans `ffmpeg`.
    """
    _jeu_a_quatre_directions(client)
    sujet = _sujet(client)
    identifiant = uuid.uuid4().hex[:12]
    dossier = atelier.fichiers.dossier_images_clip(identifiant, 0)
    teintes = [(190, 40, 40), (40, 190, 40), (40, 40, 190), (190, 190, 40)]
    for numero, teinte in enumerate(teintes):
        atelier.fichiers._poser(
            dossier / f"{numero:04d}.png", _dissymetrique(teinte)
        )
    generation = Generation(
        identifiant=identifiant,
        modele="essai:clip-ecrit-a-la-main",
        demande={"mouvement": "marche"},
        parametres_resolus={},
        emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, unite="images")],
        cree_le=time.time(),
        projet=atelier.bibliotheque.courant,
        personnage=sujet,
        pose="marche",
        direction="est",
        clip=Clip(nature="planche", images=len(teintes), cadence=12.0),
    )
    atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
    atelier.base.enregistrer(generation)

    gardee = atelier.montage.garder(
        identifiant,
        "marche vers l'est",
        [0, 1, 2, 3],
        cadence=12.0,
        recette=Recette(retournement=Retournement()),
        personnage=sujet,
        pose="marche",
        direction="est",
    )
    return gardee


def test_une_animation_enregistree_sous_garde_ses_frames_et_sa_cadence(client, bande):
    """*Même nombre de frames, même cadence, chaque frame est le rendu.*"""
    avant = client.get(f"/api/strips/{bande.identifiant}").json()["bande"]
    reponse = client.post(f"/api/strips/{bande.identifiant}/save-as", json={})
    assert reponse.status_code == 201, reponse.text
    neuve = reponse.json()["bande"]

    assert neuve["identifiant"] != bande.identifiant
    assert len(neuve["prises"]) == len(avant["prises"]) == 4
    assert neuve["cadence"] == avant["cadence"] == 12.0
    assert neuve["sens"] == avant["sens"]
    assert neuve["recette"] == Recette().en_json()
    assert neuve["direction"] == "ouest"
    assert neuve["pose"] == "marche"
    assert neuve["favori"] is False
    # Le clip neuf porte une image par frame, et il n'a rien coûté.
    clip = client.get(f"/api/generations/{neuve['clip']}").json()
    assert clip["clip"]["images"] == 4
    assert clip["clip"]["prix_annonce"] == 0
    assert clip["consomme"] == 0


def test_chaque_frame_de_la_nouvelle_bande_est_le_rendu_de_la_frame_d_origine(
    client, atelier, bande
):
    """Le contrat de pixels — **retourné**, et image par image.

    Comparé au rendu que l'atelier calcule lui-même pour la bande d'origine :
    deux chaînes de rendu écrites à deux endroits finiraient par ne plus rendre
    les mêmes pixels, et c'est l'auteur qui découvrirait l'écart.
    """
    attendu = atelier.montage.rendu_des_frames(bande.identifiant)["images"]
    neuve = client.post(
        f"/api/strips/{bande.identifiant}/save-as", json={}
    ).json()["bande"]

    for rang, octets in enumerate(attendu):
        image = client.get(f"/api/clips/{neuve['clip']}/frames/{rang}")
        assert image.status_code == 200, image.text
        assert np.array_equal(_pixels(image.content), _pixels(octets))


def test_l_animation_d_origine_ne_bouge_pas(client, bande):
    """Ni sa recette, ni sa case, ni ses images."""
    avant = client.get(f"/api/strips/{bande.identifiant}").json()["bande"]
    client.post(f"/api/strips/{bande.identifiant}/save-as", json={})
    apres = client.get(f"/api/strips/{bande.identifiant}").json()["bande"]
    assert apres == avant


def test_la_filiation_d_une_animation_va_dans_les_deux_sens(client, bande):
    neuve = client.post(
        f"/api/strips/{bande.identifiant}/save-as", json={}
    ).json()["bande"]
    assert neuve["origine"]["source"] == bande.identifiant
    assert neuve["origine"]["nature"] == "animation"
    assert neuve["origine"]["miroir"] is True
    assert neuve["origine"]["recette"] == bande.recette.en_json()

    propose = client.post(
        f"/api/strips/{bande.identifiant}/save-as/preview", json={}
    ).json()
    assert [d["identifiant"] for d in propose["derives"]] == [neuve["identifiant"]]
    assert propose["direction"] == "ouest"


def test_une_animation_sans_recette_est_refusee_avec_sa_raison(client, bande, atelier):
    nue = atelier.montage.garder(
        bande.clip, "marche nue", [0, 1], recette=Recette(),
    )
    propose = client.post(
        f"/api/strips/{nue.identifiant}/save-as/preview", json={}
    ).json()
    assert propose["raison"]
    refus = client.post(f"/api/strips/{nue.identifiant}/save-as", json={})
    assert refus.status_code == 409


# ── Réseau coupé, et l'outil de l'agent ─────────────────────────────────────


def test_enregistrer_sous_ne_demande_jamais_le_fournisseur(client, double, bande):
    """*Aucun appel au fournisseur ; le geste marche réseau coupé.*

    **Compté sur le double**, comme en C1 et en B21 : c'est la seule mesure qui
    ne puisse pas mentir. Un service qui n'importe pas de fournisseur ne peut
    pas l'appeler, et cet essai le confirme au niveau où l'auteur le vit.
    """
    double.catalogue_lisible = False
    asset, _ = _image_prete(client, nom="Le marchand")
    appels = double.appels

    client.post(f"/api/assets/{asset}/save-as/preview", json={})
    assert client.post(f"/api/assets/{asset}/save-as", json={}).status_code == 201
    client.post(f"/api/strips/{bande.identifiant}/save-as/preview", json={})
    assert (
        client.post(f"/api/strips/{bande.identifiant}/save-as", json={}).status_code
        == 201
    )

    assert double.appels == appels


async def test_l_agent_dispose_du_meme_geste_avec_les_memes_regles(
    client, atelier, bande
):
    """*Le même geste par l'outil MCP correspondant, avec les mêmes règles.*

    L'outil appelle le **même service** — c'est la règle `T7`, *le MCP n'a
    aucune logique propre*. Ce qui est mesuré ici est donc qu'il range au même
    endroit, qu'il propose la même direction, et qu'il refuse pour la même
    raison.
    """
    from atelier.mcp.serveur import creer_serveur

    serveur = creer_serveur(atelier)

    async def appeler(nom, **arguments):
        resultat = await serveur.call_tool(nom, arguments)
        assert not resultat.is_error, resultat
        return resultat.structured_content

    asset, _ = _image_prete(client, nom="Le marchand")
    vu = await appeler("preview_save_render_as", kind="image", identifier=asset)
    assert vu["direction"] == "ouest"
    assert vu["miroir"] is True

    fait = await appeler("save_render_as", kind="image", identifier=asset)
    assert fait["asset"]["direction"] == "ouest"
    assert fait["asset"]["recette"] == Recette().en_json()
    assert fait["asset"]["origine"]["source"] == asset

    anime = await appeler(
        "save_render_as", kind="animation", identifier=bande.identifiant
    )
    assert anime["bande"]["direction"] == "ouest"
    assert anime["bande"]["cadence"] == 12.0

    # Le même refus, avec la même phrase : l'agent n'a pas de porte dérobée.
    from mcp.server.mcpserver.exceptions import ToolError

    nue = _poser(client, _dissymetrique((10, 10, 10)), nom="sans-retouche.png")
    with pytest.raises(ToolError, match="aucune retouche"):
        await serveur.call_tool("save_render_as", {"kind": "image", "identifier": nue})
