"""AU15, repris le 18 septembre 2026 : l'image équipée se lit comme sa pose.

Le défaut relevé sur le disque de l'auteur : la pose « repos · est » de Champy
sortait de sa recette à 221 × 451, l'image équipée arrivait telle que le modèle
l'avait rendue — 1024 × 1024, fond compris —, et le calage partait de 0,22.
Ces essais montent le même écart en petit : une pose détourée, recadrée,
pixelisée et ramenée à sa palette, et une image équipée quatre fois plus grande,
sur son fond, avec un bâton en plus.

Chaque essai **referme et rouvre** ce qu'il garde (`AGENTS.md`, 8septies), et
aucun ne coûte un centime.
"""
from __future__ import annotations

import io
import time

import numpy as np
import pytest
from PIL import Image, ImageDraw

from atelier.domaine.recette import Recette
from atelier.image.calques_cibles import aux_couleurs_de, png, ramener_sur, rgba
from atelier.services.production import ProductionRefusee
from tests.test_au15 import service

MODELE = "essai:rend-du-png"
FOND = (216, 217, 216)
TETE, TORSE, JAMBES, BATON = (200, 40, 40), (40, 150, 60), (90, 60, 30), (240, 200, 40)
PALETTE = ("#c82828", "#28963c", "#5a3c1e", "#f0c828")

# La recette de la pose : détourage par le bord, recadrage à marge nulle,
# pixelisation sur une case de 32, et la palette du jeu.
RECETTE_DE_LA_POSE = {
    "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
    "recadrage": {"marge": 0},
    "grille": {"cible": 32, "occupation": 100, "ancrage": "bas"},
    "quantification": {"couleurs": 4, "palette": list(PALETTE)},
}


def personnage_peint(bloc: int, toile: int, *, gauche: int, haut: int, baton: bool) -> bytes:
    """Un corps en trois aplats sur un fond plat — le bâton passe devant le torse.

    Des aplats larges plutôt que des rayures : la pose passe par une grille, et
    une rayure d'un bloc s'y replie en bouillie. Le bâton reste **dans la
    silhouette** : le recadrage de la pose est à marge nulle, et un objet qui
    dépasse du cadre se mesure à part (`dehors`).
    """
    image = Image.new("RGB", (toile, toile), FOND)
    dessin = ImageDraw.Draw(image)

    def bloc_(x0, y0, x1, y1, couleur):
        dessin.rectangle([gauche + x0 * bloc, haut + y0 * bloc, gauche + x1 * bloc - 1, haut + y1 * bloc - 1], fill=couleur)

    bloc_(3, 0, 9, 6, TETE)
    bloc_(1, 6, 11, 16, TORSE)
    bloc_(2, 16, 10, 24, JAMBES)
    if baton:
        bloc_(5, 7, 7, 15, BATON)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def importer(client, tmp_path, octets: bytes, nom: str) -> str:
    chemin = tmp_path / f"{nom}.png"
    chemin.write_bytes(octets)
    reponse = client.post("/api/assets/import", json={"chemin": str(chemin), "forcer": True})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError("la génération n'est jamais arrivée à terme")


@pytest.fixture
def decor(atelier, client, tmp_path):
    """Le pèlerin, sa pose « repos · est » réglée, et un bâton qu'il porte."""
    svc = service(atelier)
    atelier.calques_cibles = svc
    projet = atelier.bibliotheque.courant
    p = client.post("/api/characters", json={"nom": "Le pèlerin"}).json()["personnage"]["identifiant"]
    assert client.post("/api/characters/directions", json={"nom": "Est"}).status_code == 201
    piece = client.post("/api/characters/pieces", json={"nom": "Bâton", "porteur": p}).json()["piece"]["identifiant"]
    emploi = atelier.equipement.emplois(projet, piece)[0].identifiant
    pose = importer(client, tmp_path, personnage_peint(2, 64, gauche=8, haut=6, baton=False), "repos-est")
    reponse = client.put(f"/api/assets/{pose}/character", json={"personnage": p, "pose": "repos", "direction": "est"})
    assert reponse.status_code == 200, reponse.text
    atelier.assets.poser_recette(pose, Recette.depuis_json(RECETTE_DE_LA_POSE))
    return svc, (projet, piece, emploi), p, pose


def image_equipee(client, tmp_path) -> str:
    """Quatre fois plus grande, décalée, sur son fond — ce que rend un modèle."""
    return importer(client, tmp_path, personnage_peint(8, 256, gauche=40, haut=20, baton=True), "equipee")


def test_l_image_equipee_se_lit_avec_la_recette_de_sa_pose_et_a_sa_taille(decor, atelier, client, tmp_path, double):
    svc, chemin, _, pose = decor
    base = rgba(atelier.assets.octets(atelier.assets.lire(pose))[0])
    source = image_equipee(client, tmp_path)
    v = svc.creer(*chemin, {"nature": "image", "resultat": pose}, source, "source-equipee")

    lue = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert lue.shape == base.shape, "l'image équipée doit arriver dans le cadre de sa pose"
    preparation = v["preparation"]
    assert preparation["recette"] == "pose" and preparation["depuis"] == {"pose": "repos", "direction": "est"}
    assert "détourage" in preparation["appliquee"]
    assert "cadre et échelle de la pose" in preparation["appliquee"]
    assert any(a.startswith("couleurs de la pose") for a in preparation["appliquee"])
    # La pose passe par une case de 32 : son corps de 24 blocs y fait 32 pixels,
    # celui de l'image équipée en fait 192.
    assert preparation["facteur"] == pytest.approx(32 / 192, abs=0.01)
    # Les couleurs de la pose, et elles seules : le fond du modèle est parti.
    opaques = {tuple(int(c) for c in px[:3]) for px in lue.reshape(-1, 4) if px[3]}
    attendues = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in PALETTE}
    assert opaques <= attendues

    # À recette identique, le calage part d'un point juste.
    calage = svc.aligner(*chemin, v["identifiant"])
    assert calage["echelle"] == 1.0 and abs(calage["dx"]) <= 1 and abs(calage["dy"]) <= 1
    assert calage["couverture"] > 0.95

    # Et la différence isole le bâton, pas le corps.
    extraite = svc.extraire(*chemin, v["identifiant"])
    calque = rgba(svc.apercu(*chemin, extraite["identifiant"], "calque"))
    visibles = calque[:, :, 3] > 0
    jaunes = visibles & (np.abs(calque[:, :, :3].astype(int) - BATON).max(axis=2) < 40)
    assert jaunes.sum() >= 6
    assert (visibles & ~jaunes).sum() <= jaunes.sum(), "le corps ne doit pas partir avec le bâton"
    assert double.appels == 0


def test_la_recette_se_retire_se_remet_et_la_relecture_survit_a_la_reouverture(decor, atelier, client, tmp_path):
    svc, chemin, _, pose = decor
    source = image_equipee(client, tmp_path)
    v = svc.creer(*chemin, {"nature": "image", "resultat": pose}, source, "source-equipee")
    preparee = svc.apercu(*chemin, v["identifiant"], "source")

    # Retirée : l'image telle qu'elle est rangée, à sa taille à elle.
    sienne = svc.reprendre_source(*chemin, v["identifiant"], 1, recette="sienne", echelle=False)
    assert sienne["revision"] == 2 and sienne["preparation"]["recette"] == "sienne"
    telle = rgba(svc.apercu(*chemin, v["identifiant"], "source"))
    assert telle.shape[:2] == (256, 256)
    assert len(sienne["historique"]) == 1

    # Une révision périmée ne relit rien.
    with pytest.raises(ProductionRefusee, match="autre écran"):
        svc.reprendre_source(*chemin, v["identifiant"], 1)

    # Remise : exactement la même lecture qu'à l'association.
    remise = svc.reprendre_source(*chemin, v["identifiant"], 2)
    assert svc.apercu(*chemin, v["identifiant"], "source") == preparee
    assert remise["extraction"] is None

    # Refermer, rouvrir : la préparation et le fichier lu tiennent.
    relu = service(atelier).lire(*chemin, v["identifiant"])
    assert relu["preparation"] == remise["preparation"]
    assert relu["source_fichier"] == remise["source_fichier"] != "source.png"
    assert service(atelier).apercu(*chemin, v["identifiant"], "source") == preparee


def test_la_route_relit_la_source_et_refuse_une_reference(decor, client, tmp_path):
    svc, chemin, _, pose = decor
    source = image_equipee(client, tmp_path)
    prefixe = f"/api/projects/{chemin[0]}/equipment/{chemin[1]}/uses/{chemin[2]}"
    creee = client.post(prefixe + "/layers", json={"cible": {"nature": "image", "resultat": pose}, "source": source, "role": "source-equipee"})
    assert creee.status_code == 201, creee.text
    identifiant = creee.json()["identifiant"]
    relue = client.post(prefixe + f"/layers/{identifiant}/source", json={"revision": 1, "recette": "sienne", "echelle": True})
    assert relue.status_code == 200, relue.text
    assert relue.json()["preparation"]["echelle"] is True
    reference = client.post(prefixe + "/layers", json={"cible": {"nature": "image", "resultat": pose}, "source": source, "role": "reference"})
    assert "preparation" not in reference.json()
    refus = client.post(prefixe + f"/layers/{reference.json()['identifiant']}/source", json={"revision": 1})
    assert refus.status_code >= 400


# ── La bonne pose, trouvée seule ────────────────────────────────────────────


def test_une_generation_faite_d_apres_la_pose_s_y_associe_d_office(decor, atelier, client, double):
    svc, chemin, p, pose = decor
    double.rendre = lambda: personnage_peint(8, 256, gauche=40, haut=20, baton=True)
    lancee = client.post("/api/generations", json={
        "modele": MODELE, "prompt": "le même, avec un bâton",
        "references": [{"asset": pose, "role": "edition"}]})
    assert lancee.status_code == 202, lancee.text
    generation = attendre(client, lancee.json()["identifiant"])
    equipee = f"{generation['identifiant']}-0"

    trouvees = svc.poses_de_reference(*chemin, equipee)
    assert [t["cible"] for t in trouvees] == [{"nature": "image", "resultat": pose, "prise": ""}]
    assert trouvees[0]["pose"] == "repos" and trouvees[0]["direction"] == "est"
    assert "modifier" in trouvees[0]["raison"]

    # L'inverse : sur la pose, l'image fabriquée d'après elle est proposée.
    proposees = svc.fabriquees_d_apres(*chemin, pose)
    assert [i["image"]["identifiant"] for i in proposees] == [equipee]
    assert proposees[0]["deja"] is False

    # Sans cible, la pose de référence décide — par la route, comme l'écran.
    prefixe = f"/api/projects/{chemin[0]}/equipment/{chemin[1]}/uses/{chemin[2]}"
    assert client.get(prefixe + "/targets/references", params={"source": equipee}).json()["poses"][0]["cible"]["resultat"] == pose
    creee = client.post(prefixe + "/layers", json={"source": equipee, "role": "source-equipee"})
    assert creee.status_code == 201, creee.text
    assert creee.json()["cible"]["resultat"] == pose
    assert creee.json()["base"]["direction"] == "est"
    assert client.get(prefixe + "/targets/made-from", params={"resultat": pose}).json()["images"][0]["deja"] is True


def test_la_planche_d_equipement_nomme_ses_poses_et_la_case_visee_est_seule_lue(atelier, client, double):
    """Le cas de Champy : une planche d'équipement (C3) ne réinjecte pas la pose,
    elle la **redessine** dans sa case — et la case garde le nom du corps."""
    from tests.test_c3 import _corps, _habiller, _personnage, _piece

    personnage, poses = _personnage(client, 2)
    corps = _corps(client, double, personnage, poses)
    piece = _piece(client)
    projet = atelier.bibliotheque.courant
    emploi = atelier.equipement.ajouter_emploi(projet, piece, porteur=personnage).identifiant
    svc = service(atelier)
    chemin = (projet, piece, emploi)
    generation = _habiller(client, double, personnage, piece, poses)
    planche = f"{generation['identifiant']}-0"

    trouvees = svc.poses_de_reference(*chemin, planche)
    assert [t["cible"]["resultat"] for t in trouvees] == [corps[p] for p in poses]
    assert trouvees[0]["raison"] == "sa planche partait de cette pose"
    assert [i["image"]["identifiant"] for i in svc.fabriquees_d_apres(*chemin, corps[poses[1]])] == [planche]

    # Sur la seconde pose, seule la seconde case de la planche est lue.
    v = svc.creer(*chemin, {"nature": "image", "resultat": corps[poses[1]]}, planche, "source-equipee")
    base = rgba(svc.apercu(*chemin, v["identifiant"], "base"))
    assert rgba(svc.apercu(*chemin, v["identifiant"], "source")).shape == base.shape
    calage = svc.aligner(*chemin, v["identifiant"])
    assert calage["echelle"] == pytest.approx(1.0, abs=0.02)
    assert abs(calage["dx"]) <= 1 and abs(calage["dy"]) <= 1


def test_sans_reference_connue_l_association_reste_manuelle(decor, client, tmp_path):
    svc, chemin, _, pose = decor
    source = image_equipee(client, tmp_path)
    assert svc.poses_de_reference(*chemin, source) == []
    with pytest.raises(ProductionRefusee, match="à la main"):
        svc.creer(*chemin, None, source, "source-equipee")
    assert svc.fabriquees_d_apres(*chemin, pose) == []


def test_une_reference_qui_n_est_pas_une_pose_du_porteur_ne_propose_rien(decor, atelier, client, tmp_path, double):
    svc, chemin, _, _ = decor
    etrangere = importer(client, tmp_path, personnage_peint(2, 64, gauche=8, haut=6, baton=False), "etrangere")
    lancee = client.post("/api/generations", json={
        "modele": MODELE, "prompt": "autre chose", "references": [{"asset": etrangere, "role": "edition"}]})
    generation = attendre(client, lancee.json()["identifiant"])
    assert svc.poses_de_reference(*chemin, f"{generation['identifiant']}-0") == []


# ── La mise à l'échelle, seule ──────────────────────────────────────────────


def test_deux_images_au_meme_cadre_se_retrouvent_sans_reechantillonnage():
    """L'hypothèse nulle est dans la recherche : rien n'a bougé, rien ne bouge."""
    corps = np.zeros((40, 30, 4), dtype=np.uint8)
    corps[5:35, 10:20] = (50, 60, 70, 255)
    equipe = corps.copy()
    equipe[12:14, 19:28] = (210, 120, 20, 255)
    ramene = ramener_sur(corps, equipe)
    assert ramene.echelle == 1.0 and (ramene.x, ramene.y) == (0, 0)
    assert np.array_equal(ramene.image, equipe)
    assert ramene.dehors == 0.0


def test_les_couleurs_de_la_pose_ramenent_le_corps_et_laissent_la_piece():
    """Un bâton de bois ne devient pas rouge parce que le chapeau l'est."""
    base = np.zeros((4, 4, 4), dtype=np.uint8)
    base[:2] = (196, 68, 41, 255)
    base[2:] = (122, 78, 47, 255)
    equipee = base.copy()
    equipee[0, 0] = (200, 70, 45, 255)   # le chapeau, un peu dérivé : ramené
    equipee[3, 3] = (60, 160, 230, 255)  # une gemme bleue : gardée
    equipee[1, 1, 3] = 0                 # un trou : laissé transparent
    ramenee = aux_couleurs_de(equipee, base)
    assert tuple(ramenee[0, 0]) == (196, 68, 41, 255)
    assert tuple(ramenee[3, 3]) == (60, 160, 230, 255)
    assert ramenee[1, 1, 3] == 0


def test_ce_qui_depasse_du_cadre_de_la_pose_se_compte():
    corps = np.zeros((40, 20, 4), dtype=np.uint8)
    corps[:, 5:15] = (50, 60, 70, 255)
    grand = np.zeros((160, 160, 4), dtype=np.uint8)
    grand[:, 40:80] = (50, 60, 70, 255)
    grand[60:70, 80:150] = (210, 120, 20, 255)  # le bâton tendu, loin hors de la silhouette
    ramene = ramener_sur(corps, grand)
    assert ramene.echelle == pytest.approx(0.25, abs=0.02)
    assert ramene.image.shape == corps.shape
    # Le bâton pèse un dixième de l'image, et les trois quarts de sa longueur
    # tombent hors du cadre.
    assert 0.03 < ramene.dehors < 0.15
    assert Image.open(io.BytesIO(png(ramene.image))).size == (20, 40)
