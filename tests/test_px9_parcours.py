"""PX9 : repeindre, de A à Z — un résultat qui a un nom (`docs/PLAN-idees-pixellab.md` § PX9).

Ce qu'on vérifie :

- **La pièce n'a plus de trous** : elle porte tout ce que le moteur a peint dans
  la zone, y compris un pixel revenu à la couleur qu'il avait déjà ; le fond,
  lui, reste dehors.
- **Trois décisions qui font ce qu'elles disent** : une nouvelle version de la
  pose (l'image d'origine reste), un équipement du sujet (la pièce, son
  emplacement, son emploi, son calque retenu sur la pose), jeter. Tant qu'on
  n'a pas décidé, le résultat est « à décider » — sur son image, dans la liste
  de ce qui attend, jamais dans une pose.
- **Corriger plus tard** : la main ramène un pixel de l'image du moteur, et
  l'équipement suit la correction.
- **Referme et rouvre** (`AGENTS.md`, point 8septies), avec des réglages qui ne
  sont pas ceux du défaut : un nom et un emplacement choisis à la main.

ComfyUI est doublé par celui de PX3, qui repeint d'après ce qu'il a reçu.
"""
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.recette import Difference, Main, Trait
from atelier.image.traitement import retoucher
from atelier.image.zone import calque_de_zone, emplacement_propose, masque_de_zone, recoller
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_px3_zone import PEAU, TETE, VOISIN, ComfyQuiRepeint, _png, sprite

ZONE = "sdxl-retouche-zone"


# ── La pièce, pure ──────────────────────────────────────────────────────────


def test_la_piece_porte_tout_ce_que_le_moteur_a_peint_meme_la_couleur_d_avant():
    """Le défaut de Mara : un pixel du sac revenu à la couleur de la cape n'était
    pas « changé », donc pas dans le calque — un trou dans la pièce seule."""
    corps = sprite()
    zone = masque_de_zone((16, 16), TETE)
    fond = np.array((128, 128, 128), dtype=np.uint8)
    toile = np.where(corps[..., 3:] > 0, corps[..., :3], fond)
    revenu = toile.copy()
    # Le moteur repeint la zone : du bleu en haut, **la peau telle quelle** sur
    # le corps (le pixel « inchangé »), du fond ailleurs.
    haut = np.zeros_like(zone)
    haut[:4] = True
    revenu[zone & haut] = (20, 40, 200)
    revenu[zone & ~haut & (corps[..., 3] > 0)] = PEAU
    r = recoller(corps, revenu, zone, "#808080", 4)
    peint = zone & (haut | (corps[..., 3] > 0))
    assert np.array_equal(r.calque[..., 3] > 0, peint)
    # Les pixels de peau inchangés sont dans la pièce, à leur couleur.
    inchanges = zone & ~haut & (corps[..., 3] > 0)
    assert inchanges.any() and (r.calque[inchanges][..., :3] == PEAU).all()
    assert r.mesures()["pixels_de_la_piece"] == int(peint.sum()) > r.mesures()["pixels_changes"]
    # Le fond reste dehors : la zone hors du corps et hors du haut est vide.
    assert (r.calque[zone & ~peint][..., 3] == 0).all()


def test_sous_un_pixel_vide_de_la_zone_c_est_la_couleur_du_moteur_que_la_main_ramene():
    corps = sprite()
    zone = masque_de_zone((16, 16), TETE)
    fond = np.array((128, 128, 128), dtype=np.uint8)
    toile = np.where(corps[..., 3:] > 0, corps[..., :3], fond)
    revenu = toile.copy()
    revenu[zone & (corps[..., 3] > 0)] = VOISIN
    # Un trait presque du fond — le moteur y a peint, le seuil l'a pris pour du fond.
    revenu[2, 6] = (140, 128, 128)
    difference = Difference(base="b", zone_peinte=TETE, fond="#808080", couleurs=4)
    calque, _ = calque_de_zone(corps, np.asarray(Image.fromarray(revenu).resize((64, 64), Image.NEAREST)), difference)
    assert calque[2, 6, 3] == 0
    ramene = retoucher(calque, Main(opacite=(Trait(garde=True, rayon=0, points=((6, 2),)),)))
    assert ramene[2, 6, 3] == 255
    # Une couleur du moteur rangée sur la palette — jamais le vide de l'image d'en dessous.
    assert tuple(ramene[2, 6, :3]) != (0, 0, 0)


def test_l_emplacement_se_propose_d_apres_la_zone():
    corps = np.zeros((40, 20, 4), dtype=np.uint8)
    corps[4:40, 6:14] = (*PEAU, 255)
    def zone(y0, y1, x0, x1):
        z = np.zeros((40, 20), dtype=bool)
        z[y0:y1, x0:x1] = True
        return z
    assert emplacement_propose(corps, zone(3, 8, 6, 14)) == "la tête"
    assert emplacement_propose(corps, zone(30, 38, 6, 14)) == "les jambes"
    assert emplacement_propose(corps, zone(14, 22, 7, 13)) == "le torse"
    assert emplacement_propose(corps, zone(14, 22, 0, 7)) == "le dos"


# ── Le parcours dans l'atelier ──────────────────────────────────────────────


@pytest.fixture
async def atelier_px9(tmp_path, double):
    comfy = ComfyQuiRepeint()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, tmp_path
    await atelier.file_locale.fermer()


def _mara(atelier):
    """Un sujet qui porte de l'équipement, et une image rangée dans une pose."""
    projet = atelier.bibliotheque.courant
    with TestClient(creer_application(atelier)) as client:
        image = atelier.generations.importer(_png(Image.fromarray(sprite(), "RGBA")), "Mara", projet=projet)["asset"]["identifiant"]
        mara = client.post("/api/characters", json={"nom": "Mara", "description": "une exploratrice"}).json()["personnage"]["identifiant"]
        pose = atelier.production.plan(projet)[0].identifiant
        assert client.put(f"/api/assets/{image}/character", json={"personnage": mara, "pose": pose}).status_code == 200
    return projet, image, mara, pose


async def _repeindre(atelier, image, texte="a big backpack"):
    await atelier.styles_locaux.installer(ZONE)
    await atelier.catalogue.rafraichir()
    generation = await atelier.zone.lancer(image, texte, TETE, graine=5)
    await atelier.generations.attendre_tout()
    fin = atelier.zone.resultat(generation.identifiant)
    assert fin["statut"] == "reussie", fin["raison"]
    return fin["calque"]


def _pixels(atelier, identifiant):
    asset = atelier.assets.lire(identifiant)
    return np.asarray(Image.open(io.BytesIO(atelier.assets.octets(asset)[0])).convert("RGBA"))


async def test_un_resultat_non_decide_est_a_decider_sur_son_image_et_hors_des_poses(atelier_px9):
    atelier, _ = atelier_px9
    projet, image, mara, pose = _mara(atelier)
    calque = await _repeindre(atelier, image)
    assert calque["statut"] == "a_decider" and calque["equipement"] is None
    assert calque["emplacement_propose"] == "la tête"
    etat = await atelier.zone.etat(image)
    assert [c["identifiant"] for c in etat["calques"]] == [calque["identifiant"]]
    assert etat["sujet"]["nom"] == "Mara" and etat["pose"]["identifiant"] == pose and etat["raison_equipement"] is None
    # Dans la liste de ce qui attend, marqué « à décider » avec son image.
    attente = atelier.production.en_attente(projet, mara)
    (ligne,) = [a for a in attente["images"] if a["identifiant"] == calque["identifiant"]]
    assert ligne["a_decider"] == {"image": image, "texte": "a big backpack"}
    # Jamais dans une pose.
    assert atelier.assets.lire(calque["identifiant"]).pose is None


async def test_en_faire_une_version_range_l_image_entiere_dans_la_pose_et_garde_l_originale(atelier_px9):
    atelier, _ = atelier_px9
    projet, image, mara, pose = _mara(atelier)
    avant = _pixels(atelier, image).copy()
    calque = await _repeindre(atelier, image)
    piece = _pixels(atelier, calque["identifiant"])
    rendu = atelier.zone.decider(calque["identifiant"], "version")
    neuf = atelier.assets.lire(rendu["asset"]["identifiant"])
    assert (neuf.personnage, neuf.pose, neuf.direction, neuf.parent) == (mara, pose, None, image)
    assert not neuf.recette.difference and neuf.cout_usd == 0
    # L'image entière : l'originale, la pièce posée dessus.
    attendu = avant.copy()
    attendu[piece[..., 3] > 0] = piece[piece[..., 3] > 0]
    assert np.array_equal(_pixels(atelier, neuf.identifiant), attendu)
    # L'originale n'a pas bougé d'un pixel ; le résultat a quitté la bibliothèque.
    assert np.array_equal(_pixels(atelier, image), avant)
    assert atelier.assets.lire(calque["identifiant"]) is None
    assert (await atelier.zone.etat(image))["calques"] == []
    assert all(a["identifiant"] != calque["identifiant"] for a in atelier.production.en_attente(projet, mara)["images"])


async def test_en_faire_un_equipement_le_range_partout_ou_les_calques_d_equipement_le_sont(atelier_px9):
    atelier, tmp_path = atelier_px9
    projet, image, mara, pose = _mara(atelier)
    calque = await _repeindre(atelier, image)
    # **Pas les réglages du défaut** : un nom et un emplacement choisis à la main.
    rendu = atelier.zone.decider(calque["identifiant"], "equipement", nom="Sac à dos", emplacement="le dos")
    piece = rendu["equipement"]["identifiant"]
    emploi = rendu["equipement"]["emploi"]
    objet = atelier.base.lire_projet(projet)
    (p,) = [x for x in objet.pieces if x.identifiant == piece]
    noms = {e.identifiant: e.nom for e in atelier.equipement.emplacements(projet)}
    assert p.nom == "Sac à dos" and noms[p.emplacement] == "le dos"
    assert emploi == f"porte-{mara}"
    # La matrice du sujet : son calque sur cette pose.
    asset = atelier.assets.lire(calque["identifiant"])
    assert (asset.piece, asset.personnage, asset.pose) == (piece, mara, pose)
    assert all(a["identifiant"] != asset.identifiant for a in atelier.production.en_attente(projet, mara)["images"])
    # L'emploi : la variante est un calque retenu, utilisable (fiche de
    # l'équipement, couverture, tenue et export lisent ça).
    variante = atelier.calques_cibles.lire(projet, piece, emploi, rendu["variante"])
    assert variante["role"] == "calque" and variante["utilisable"] and variante["cible"]["resultat"] == image
    assert "devant" in variante["placement"]
    # La fiche du résultat dit ce qu'il est devenu.
    fiche = atelier.zone.fiche(asset.identifiant)
    assert fiche["statut"] == "equipement" and fiche["equipement"]["nom"] == "Sac à dos"
    assert fiche["equipement"]["emplacement"] == "le dos"
    # Il se retrouve sur son image, marqué équipement.
    assert [c["statut"] for c in (await atelier.zone.etat(image))["calques"]] == ["equipement"]

    # **Corriger plus tard** : la main ramène un pixel de l'image du moteur —
    # un pixel de la zone que le moteur a laissé au fond — et l'équipement suit.
    pixels = _pixels(atelier, asset.identifiant)
    zone = masque_de_zone((16, 16), TETE)
    vides = np.argwhere(zone & (pixels[..., 3] == 0))
    assert len(vides), "le double doit laisser du fond dans la zone"
    y, x = (int(v) for v in vides[0])
    from dataclasses import replace
    atelier.assets.poser_recette(asset.identifiant, replace(asset.recette, main=Main(opacite=(Trait(garde=True, rayon=0, points=((x, y),)),))))
    corrige = _pixels(atelier, asset.identifiant)
    assert corrige[y, x, 3] == 255
    relue = atelier.calques_cibles.lire(projet, piece, emploi, rendu["variante"])
    assert relue["utilisable"] and relue["revision"] == variante["revision"]
    calque_png = np.asarray(Image.open(atelier.calques_cibles._chemin(projet, piece, emploi, rendu["variante"]) / "calque.png").convert("RGBA"))
    assert np.array_equal(calque_png, corrige)

    # **Referme et rouvre** (8septies).
    await atelier.file_locale.fermer()
    rouvert = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: None, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(rouvert, ComfyQuiRepeint())
    await rouvert.ouvrir()
    try:
        fiche = rouvert.zone.fiche(asset.identifiant)
        assert fiche["statut"] == "equipement" and fiche["equipement"]["nom"] == "Sac à dos"
        assert fiche["equipement"]["emplacement"] == "le dos"
        assert fiche["texte"] == "a big backpack" and fiche["graine"] == 5
        v = rouvert.calques_cibles.lire(projet, piece, emploi, rendu["variante"])
        assert v["utilisable"]
        assert np.array_equal(_pixels(rouvert, asset.identifiant), corrige)
    finally:
        await rouvert.file_locale.fermer()


async def test_un_second_resultat_rejoint_l_equipement_du_meme_nom(atelier_px9):
    atelier, _ = atelier_px9
    projet, image, mara, pose = _mara(atelier)
    premier = await _repeindre(atelier, image)
    atelier.zone.decider(premier["identifiant"], "equipement", nom="Sac à dos", emplacement="le dos")
    second = await _repeindre(atelier, image, "a small backpack")
    rendu = atelier.zone.decider(second["identifiant"], "equipement", nom="sac à dos")
    assert [p.nom for p in atelier.base.lire_projet(projet).pieces] == ["Sac à dos"]
    assert rendu["equipement"]["nom"] == "Sac à dos"


async def test_jeter_retire_le_resultat_et_les_refus_ont_leur_raison(atelier_px9):
    atelier, _ = atelier_px9
    projet = atelier.bibliotheque.courant
    # Une image rangée nulle part : pas d'équipement possible, avec sa raison.
    seule = atelier.generations.importer(_png(Image.fromarray(sprite(), "RGBA")), "Seule", projet=projet)["asset"]["identifiant"]
    calque = await _repeindre(atelier, seule)
    etat = await atelier.zone.etat(seule)
    assert etat["sujet"] is None and "aucun sujet" in etat["raison_equipement"]
    with pytest.raises(DemandeRefusee, match="aucun sujet"):
        atelier.zone.decider(calque["identifiant"], "equipement", nom="Sac")
    with pytest.raises(DemandeRefusee, match="décision inconnue"):
        atelier.zone.decider(calque["identifiant"], "garder")
    # Une version reste possible — une image neuve, rangée comme l'originale.
    atelier.zone.decider(calque["identifiant"], "jeter")
    assert atelier.assets.lire(calque["identifiant"]) is None
    with pytest.raises(DemandeRefusee, match="jeté"):
        atelier.zone.decider(calque["identifiant"], "version")


def test_la_route_decide(tmp_path, double):
    import time
    comfy = ComfyQuiRepeint()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    with TestClient(creer_application(atelier)) as client:
        assert client.post("/api/workflow-profiles/styles/sdxl-retouche-zone/install").status_code == 200
        projet, image, mara, pose = _mara(atelier)
        lance = client.post(f"/api/assets/{image}/zone", json={"texte": "a hat", "zone": [t.en_json() for t in TETE]}).json()
        limite = time.monotonic() + 30
        while lance["statut"] not in ("reussie", "echouee") and time.monotonic() < limite:
            time.sleep(0.1)
            lance = client.get(f"/api/zone/{lance['generation']}").json()
        resultat = lance["calque"]["identifiant"]
        refus = client.post(f"/api/zone/results/{resultat}/decision", json={"decision": "equipement", "nom": ""})
        assert refus.status_code == 409
        ok = client.post(f"/api/zone/results/{resultat}/decision", json={"decision": "equipement", "nom": "Chapeau"}).json()
        assert ok["decision"] == "equipement" and ok["calque"]["equipement"]["emplacement"] == "la tête"


async def test_l_agent_a_les_trois_decisions(atelier_px9):
    atelier, _ = atelier_px9
    projet, image, mara, pose = _mara(atelier)
    from atelier.mcp.serveur import creer_serveur
    serveur = creer_serveur(atelier)
    assert "decide_repainted_zone" in {o.name for o in await serveur.list_tools()}
    premier = await _repeindre(atelier, image)
    rendu = (await serveur.call_tool("decide_repainted_zone", {"layer_id": premier["identifiant"], "decision": "equipment", "name": "Sac à dos", "slot": "le dos"})).structured_content
    assert rendu["piece_name"] == "Sac à dos" and rendu["use_id"] == f"porte-{mara}"
    second = await _repeindre(atelier, image, "a scarf")
    rendu = (await serveur.call_tool("decide_repainted_zone", {"layer_id": second["identifiant"], "decision": "version"})).structured_content
    assert atelier.assets.lire(rendu["image_id"]).pose == pose
    troisieme = await _repeindre(atelier, image, "a hat")
    rendu = (await serveur.call_tool("decide_repainted_zone", {"layer_id": troisieme["identifiant"], "decision": "discard"})).structured_content
    assert rendu["removed"] == [troisieme["identifiant"]]
    with pytest.raises(Exception, match="zone repeinte"):
        await serveur.call_tool("decide_repainted_zone", {"layer_id": image, "decision": "version"})
