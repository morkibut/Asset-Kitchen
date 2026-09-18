"""AU15, 18 septembre 2026 : l'équipement n'est jamais coupé — l'écrin du personnage.

Le cas relevé sur le disque de l'auteur : la pose « repos · est » de Champy est
recadrée à marge nulle (221 × 451, le corps exactement), et le bâton qu'il tient
à côté de lui sortait du cadre — le calque, qui vit dans ce cadre, le coupait.

Ces essais montent le même écart en petit : une pose détourée et recadrée à marge
nulle, et une image équipée quatre fois plus grande dont le bâton est tenu **à
droite du corps**, entièrement hors de sa boîte. Chaque essai qui garde quelque
chose le **referme et le rouvre** (`AGENTS.md`, 8septies) ; aucun ne coûte un
centime.
"""
from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from atelier.domaine.calques_cibles import CibleCalque
from atelier.domaine.recette import Recette
from atelier.image.calques_cibles import (
    Ecrin, ecrin_pour, png, ramener_sur, rembourrage, rgba,
)
from tests.test_au15 import service

FOND = (216, 217, 216)
TETE, TORSE, JAMBES, BATON, GEMME = (200, 40, 40), (40, 150, 60), (90, 60, 30), (240, 200, 40), (60, 160, 230)

# Détourage par le bord, recadrage à marge nulle : le cadre de la pose est la
# boîte de son corps — la recette de Champy, sans la grille qu'il a en veille.
RECETTE_DE_LA_POSE = {
    "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
    "recadrage": {"marge": 0},
}


def peint(bloc: int, toile: int, *, gauche: int, haut: int, baton: bool) -> bytes:
    """Un corps en trois aplats ; le bâton, s'il y est, est tenu **à droite du corps**.

    Le corps va des blocs 1 à 11 en largeur ; le bâton occupe les blocs 12 et 13,
    hors de la silhouette : dans une pose recadrée à marge nulle, il n'a aucune
    place.
    """
    image = Image.new("RGB", (toile, toile), FOND)
    dessin = ImageDraw.Draw(image)

    def bloc_(x0, y0, x1, y1, couleur):
        dessin.rectangle([gauche + x0 * bloc, haut + y0 * bloc, gauche + x1 * bloc - 1, haut + y1 * bloc - 1], fill=couleur)

    bloc_(3, 0, 9, 6, TETE)
    bloc_(1, 6, 11, 16, TORSE)
    bloc_(2, 16, 10, 24, JAMBES)
    if baton:
        bloc_(12, 4, 14, 22, BATON)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def importer(client, tmp_path, octets: bytes, nom: str) -> str:
    chemin = tmp_path / f"{nom}.png"
    chemin.write_bytes(octets)
    reponse = client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def jaunes(pixels: np.ndarray) -> np.ndarray:
    return (pixels[:, :, 3] >= 128) & (np.abs(pixels[:, :, :3].astype(int) - BATON).max(axis=2) < 40)


@pytest.fixture
def decor(atelier, client, tmp_path):
    """Le pèlerin, ses poses « repos · est » et « repos · sud » réglées, un bâton qu'il porte."""
    svc = service(atelier)
    atelier.calques_cibles = svc
    projet = atelier.bibliotheque.courant
    p = client.post("/api/characters", json={"nom": "Le pèlerin"}).json()["personnage"]["identifiant"]
    for nom in ("Est", "Sud"):
        assert client.post("/api/characters/directions", json={"nom": nom}).status_code == 201
    piece = client.post("/api/characters/pieces", json={"nom": "Bâton", "porteur": p}).json()["piece"]["identifiant"]
    emploi = atelier.equipement.emplois(projet, piece)[0].identifiant
    poses = {}
    for direction in ("est", "sud"):
        pose = importer(client, tmp_path, peint(2, 64, gauche=8, haut=6, baton=False), f"repos-{direction}")
        reponse = client.put(f"/api/assets/{pose}/character", json={"personnage": p, "pose": "repos", "direction": direction})
        assert reponse.status_code == 200, reponse.text
        atelier.assets.poser_recette(pose, Recette.depuis_json(RECETTE_DE_LA_POSE))
        poses[direction] = pose
    return svc, (projet, piece, emploi), p, poses


def image_equipee(client, tmp_path, *, baton=True) -> str:
    """Quatre fois plus grande, décalée, sur son fond — ce que rend un modèle."""
    return importer(client, tmp_path, peint(8, 256, gauche=40, haut=20, baton=baton), "equipee")


def calque_transparent(atelier, client, tmp_path, largeur: int, hauteur: int) -> str:
    """Une gemme au milieu d'un calque transparent, au cadre de la pose."""
    pixels = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    pixels[20:24, 8:12] = (*GEMME, 255)
    chemin = tmp_path / "gemme.png"
    chemin.write_bytes(png(pixels))
    identifiant = client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True}).json()["asset"]["identifiant"]
    objet = atelier.assets.lire(identifiant)
    objet.recette = Recette()
    atelier.assets.sauver(objet)
    return identifiant


# ── La mesure, seule ────────────────────────────────────────────────────────


def test_ce_qui_depasse_a_droite_se_mesure_et_se_garde_entier():
    corps = np.zeros((40, 20, 4), dtype=np.uint8)
    corps[:, 5:15] = (50, 60, 70, 255)
    grand = np.zeros((160, 160, 4), dtype=np.uint8)
    grand[:, 40:80] = (50, 60, 70, 255)
    grand[60:70, 80:150] = (*BATON, 255)  # tenu à l'horizontale, loin à droite
    ramene = ramener_sur(corps, grand)
    gauche, haut, droite, bas = ramene.debord
    assert (gauche, haut, bas) == (0, 0, 0)
    # Le corps finit à 15 dans un cadre de 20 ; le bâton fait 70 / 4 ≈ 18 pixels.
    assert droite == pytest.approx(15 + 70 / 4 - 20, abs=1)
    assert ramene.etendue.shape[:2] == (40, 20 + droite)
    # Rien n'est coupé dans l'image étendue : le bout du bâton touche son bord
    # droit, et le cadre de la pose en est la partie gauche, à l'identique.
    assert ramene.etendue[:, -1, 3].any() and jaunes(ramene.etendue)[:, 20:].sum() >= 20
    assert np.array_equal(ramene.etendue[:, :20], ramene.image)


def test_l_ecrin_est_symetrique_autour_du_repere_arrondi_au_pair_et_ne_retrecit_pas():
    # Un corps de 21 de large (repère au demi-pixel), un autre qui demande 13 à droite.
    ecrin = ecrin_pour([(10.5, 47.0, 10.5, 0.0), (10.0, 47.2, 13.1, 0.4)])
    assert ecrin == Ecrin(cote=14, haut=48, bas=2)
    assert ecrin.largeur % 2 == 0 and ecrin.hauteur % 2 == 0
    # Le repère de l'image impaire tombe au demi-pixel près, rien n'est négatif.
    g, h, d, b = rembourrage(21, 47, 10.5, 47, ecrin)
    assert (g, h, d, b) == (3, 1, 4, 2)
    assert g + 21 + d == ecrin.largeur and h + 47 + b == ecrin.hauteur
    # Il ne rétrécit jamais.
    assert ecrin_pour([(1.0, 1.0, 1.0, 0.0)], depuis=ecrin) == ecrin


def test_le_texte_envoye_demande_la_piece_entiere_avec_de_l_air_autour():
    """L'autre moitié du problème : un modèle qui coupe l'arme au bord de la case."""
    from atelier.domaine.pliage import CasePliee
    from atelier.services.pliage import consignes, plier

    une = consignes(plier([CasePliee(texte="repos")], geometrie_connue=True))
    deux = consignes(plier([CasePliee(texte="repos"), CasePliee(texte="marche")], geometrie_connue=True))
    assert une.endswith("Draw the whole item, with empty background all around it: no part of it may touch or cross the edge of the image.")
    assert deux.endswith("Draw the whole item, with empty background all around it: no part of it may touch or cross the edge of its cell.")
    # Le personnage garde sa place et sa taille : la phrase ne défait pas la redondance.
    assert "same subject size" in une and "nothing is zoomed in or out" in deux


# ── Le parcours, par le service ─────────────────────────────────────────────


def test_rien_ne_deborde_rien_ne_change(decor, atelier, client, tmp_path):
    svc, chemin, p, poses = decor
    avant = rgba(atelier.assets.octets(atelier.assets.lire(poses["est"]))[0])
    source = image_equipee(client, tmp_path, baton=False)
    v = svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, source, "source-equipee")
    assert "ecrin" not in v["base"] and "agrandi" not in v["preparation"]
    assert v["base"]["cadre"] == {"largeur": avant.shape[1], "hauteur": avant.shape[0]}
    assert svc.ecrin(chemin[0], p) is None
    assert svc.apercu(*chemin, v["identifiant"], "base") == png(avant)


def test_le_baton_qui_deborde_agrandit_le_cadre_et_arrive_entier(decor, atelier, client, tmp_path, double):
    svc, chemin, p, poses = decor
    pose = rgba(atelier.assets.octets(atelier.assets.lire(poses["est"]))[0])
    assert pose.shape[:2] == (48, 20), "la pose recadrée à marge nulle est son corps exactement"
    source = image_equipee(client, tmp_path)
    v = svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, source, "source-equipee")

    # Le cadre a grandi de chaque côté du repère, du débord du bâton : 6 à droite
    # (blocs 12 et 13 après un corps qui finit au bloc 11), et autant à gauche.
    agrandi = v["preparation"]["agrandi"]
    assert agrandi["avant"] == {"largeur": 20, "hauteur": 48}
    assert agrandi["apres"] == {"largeur": 32, "hauteur": 48}
    assert agrandi["cotes"] == {"gauche": 6, "haut": 0, "droite": 6, "bas": 0}
    assert agrandi["autres_directions"] == ["sud"] and agrandi["piece"] == "Bâton"
    assert v["preparation"]["dehors"] == 0.0
    assert v["base"]["cadre"] == {"largeur": 32, "hauteur": 48}
    assert v["base"]["repere"] == {"x": 16, "y": 48}
    assert v["base"]["rembourrage"] == {"gauche": 6, "haut": 0, "droite": 6, "bas": 0}

    # Le corps n'a pas bougé par rapport au repère : la pose est au milieu, au sol.
    base = rgba(svc.apercu(*chemin, v["identifiant"], "base"))
    assert np.array_equal(base[:, 6:26], pose)
    assert not base[:, :6, 3].any() and not base[:, 26:, 3].any()

    # Le bâton est entier : deux blocs de large, dix-huit de haut, à l'échelle de la pose.
    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert lue.shape == base.shape
    assert jaunes(lue).sum() == 4 * 36
    assert jaunes(lue)[:, 26:].sum() == 4 * 36, "le bâton est tout entier dans ce qui a été ajouté"
    # Et le corps de l'image équipée retombe sur celui de la pose.
    corps_lu = (lue[:, :, 3] >= 128) & ~jaunes(lue)
    assert (corps_lu == (base[:, :, 3] >= 128)).mean() > 0.98

    # La différence isole le bâton, entier, hors du cadre d'avant.
    extraite = svc.extraire(*chemin, v["identifiant"])
    calque = rgba(svc.apercu(*chemin, extraite["identifiant"], "calque"))
    assert calque.shape == base.shape
    assert jaunes(calque).sum() == 4 * 36
    assert double.appels == 0

    # Refermer, rouvrir : l'écrin et la base agrandie tiennent.
    relu = service(atelier)
    assert set(relu.ecrin(chemin[0], p)) == {"images"} and relu.ecrin(chemin[0], p)["images"]["largeur"] == 32
    assert relu.lire(*chemin, v["identifiant"])["etat"] == "a-extraire"
    assert relu.lire(*chemin, extraite["identifiant"])["raison"] == ""


def test_les_autres_directions_suivent_et_un_calque_deja_pose_glisse_sans_perte(decor, atelier, client, tmp_path):
    svc, chemin, p, poses = decor
    # Un calque déjà retouché et retenu sur repos · sud, avant tout débord.
    gemme = calque_transparent(atelier, client, tmp_path, 20, 48)
    sud = svc.creer(*chemin, {"nature": "image", "resultat": poses["sud"]}, gemme, "calque")
    trait = {"garde": False, "rayon": 1, "points": [[10, 30], [12, 30]], "couleur": ""}
    sud = svc.regler(*chemin, sud["identifiant"], 1, placement={"dx": 2, "dy": -1}, masques={"corps": [trait]})
    sud = svc.valider(*chemin, sud["identifiant"], sud["revision"])
    assert sud["utilisable"]
    composition_avant = rgba(svc.apercu(*chemin, sud["identifiant"], "composition"))
    calque_avant = rgba(svc.apercu(*chemin, sud["identifiant"], "calque"))

    # Le bâton déborde sur repos · est.
    est = svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, image_equipee(client, tmp_path), "source-equipee")
    assert [s["variante"] for s in est["preparation"]["agrandi"]["suivies"]] == [sud["identifiant"]]

    # Refermé, rouvert : la variante de sud a suivi, toujours retenue.
    relu = service(atelier)
    apres = relu.lire(*chemin, sud["identifiant"])
    assert apres["revision"] == sud["revision"] + 1 and apres["utilisable"] and apres["validee"]
    assert apres["base"]["cadre"] == est["base"]["cadre"] == {"largeur": 32, "hauteur": 48}
    assert apres["base"]["repere"] == est["base"]["repere"]
    assert apres["cadre_suivi"]["cause"] == {"piece": "Bâton", "pose": "repos", "direction": "est"}
    assert apres["masques"]["corps"][0]["points"] == [[16, 30], [18, 30]]
    assert apres["placement"]["dx"] == 2 and apres["placement"]["dy"] == -1

    # Translation pure : le même personnage, les mêmes pixels, six colonnes plus loin.
    composition = rgba(relu.apercu(*chemin, sud["identifiant"], "composition"))
    assert np.array_equal(composition[:, 6:26], composition_avant)
    assert not composition[:, :6, 3].any() and not composition[:, 26:, 3].any()
    calque = rgba(relu.apercu(*chemin, sud["identifiant"], "calque"))
    assert np.array_equal(calque[:, 6:26], calque_avant)

    # Et une direction sans calque tombe dans le même cadre dès qu'on la lit.
    _, base_sud = relu._base_personnage(chemin[0], p, CibleCalque("image", poses["sud"]))
    assert base_sud["cadre"] == est["base"]["cadre"] and base_sud["repere"] == est["base"]["repere"]


def test_une_lecture_d_avant_qui_coupait_se_relit_et_agrandit(decor, atelier, client, tmp_path):
    """L'avertissement « ça sort du cadre » devient un geste : relire avec la recette de la pose."""
    svc, chemin, p, poses = decor
    source = image_equipee(client, tmp_path)
    visee = CibleCalque("image", poses["est"])
    base_png, base = svc._base_personnage(chemin[0], p, visee, identifier=True)
    # Une variante d'avant le 18 septembre : l'image équipée coupée au cadre de la pose.
    coupee = rgba(png(np.zeros((48, 20, 4), dtype=np.uint8)))
    v = svc.accueillir_source_preparee(*chemin, visee.en_json(), source, base_png, base, source_png=png(coupee))
    assert svc.ecrin(chemin[0], p) is None

    relue = svc.reprendre_source(*chemin, v["identifiant"], 1, recette="pose", echelle=True)
    assert relue["preparation"]["agrandi"]["apres"] == {"largeur": 32, "hauteur": 48}
    assert relue["etat"] == "a-extraire", "la base agrandie est la base à jour"
    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert lue.shape == (48, 32, 4) and jaunes(lue).sum() == 4 * 36

    # Relue une seconde fois : l'écrin tient déjà tout, rien ne bouge plus.
    encore = svc.reprendre_source(*chemin, relue["identifiant"], relue["revision"], recette="pose", echelle=True)
    assert "agrandi" not in encore["preparation"] and "debord" not in encore["preparation"]
    assert svc.ecrin(chemin[0], p)["images"]["largeur"] == 32
    assert jaunes(rgba(svc.apercu(*chemin, v["identifiant"], "source"))).sum() == 4 * 36


def test_les_frames_d_animation_ont_leur_ecrin_a_elles(decor, atelier, client, tmp_path):
    """Deux échelles de pixel : sur le disque de l'auteur, 221 × 451 pour les poses
    de Champy et 96 × 96 pour ses frames. Le débord d'une pose ne touche pas aux frames."""
    from tests.test_b20 import _clip_ecrit, _poser_une_bande

    svc, chemin, p, poses = decor
    _clip_ecrit(atelier)
    _poser_une_bande(atelier, personnage=p, pose="repos")
    frame = next(c["cible"] for c in svc.cibles(*chemin)["cibles"] if c["cible"]["nature"] == "frame")
    _, avant = svc._base_personnage(chemin[0], p, CibleCalque.depuis_json(frame))
    svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, image_equipee(client, tmp_path), "source-equipee")
    _, apres = svc._base_personnage(chemin[0], p, CibleCalque.depuis_json(frame))
    assert apres == avant and "ecrin" not in apres
    assert set(svc.ecrin(chemin[0], p)) == {"images"}


def test_la_tenue_livree_a_un_seul_pivot_pour_toutes_les_directions(decor, atelier, client, tmp_path):
    """Ce qui part dans Godot : les deux directions au même cadre, un seul repère."""
    svc, chemin, p, poses = decor
    svc.creer(*chemin, {"nature": "image", "resultat": poses["est"]}, image_equipee(client, tmp_path), "source-equipee")
    projet = chemin[0]
    bases = [svc._base_personnage(projet, p, CibleCalque("image", poses[d]))[1] for d in ("est", "sud")]
    assert {(b["cadre"]["largeur"], b["cadre"]["hauteur"]) for b in bases} == {(32, 48)}
    assert {(b["repere"]["x"], b["repere"]["y"]) for b in bases} == {(16, 48)}
