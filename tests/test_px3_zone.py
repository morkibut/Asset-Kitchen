"""PX3 : peindre une zone dans l'atelier (`docs/PLAN-idees-pixellab.md` § PX3).

Le calque ne porte **que** les pixels changés dans la zone, comparés au strict —
une pièce qui *se substitue* (un ton voisin posé sur le corps) y entre entière,
là où la différence de C3 la perd (`docs/releve-usage.md` § 29 août 2026). Hors
de la zone, rien ; aucun pixel du sujet ne devient transparent. Un calque gardé
avec des réglages qui ne sont pas ceux du défaut se referme et se rouvre avec
sa zone, son texte, sa graine et sa force (`AGENTS.md`, point 8septies). L'agent
a le même geste. ComfyUI est doublé : son moteur **repeint à partir de ce qu'il
a reçu** — l'image déposée et la zone déposée —, jamais d'après l'intention.
"""
import base64
import io
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine.recette import Difference, Recette, Trait
from atelier.image.calque import differencier
from atelier.image.zone import (
    fond_de_la_toile,
    masque_de_zone,
    masque_en_png,
    palette_du_corps,
    recoller,
    traits_depuis_masque,
    traits_depuis_rectangles,
)
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_px2_masque import ComfyZoneDouble, octets_deposes

ZONE = "sdxl-retouche-zone"
PEAU = (200, 150, 120)
VOISIN = (206, 154, 124)  # un tee-shirt « couleur chair » : le ton voisin qui se substitue
BLEU = (20, 40, 200)
ROUGE = (230, 10, 10)


def _png(image):
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def sprite():
    """16 × 16 : un corps couleur peau, le fond transparent."""
    tableau = np.zeros((16, 16, 4), dtype=np.uint8)
    tableau[4:16, 5:11] = (*PEAU, 255)
    return tableau


# La tête : les rangs 2 à 7, un peu plus large que le corps.
TETE = (Trait(garde=True, rayon=2, points=((5, 4), (10, 4))), Trait(garde=True, rayon=1, points=((4, 7), (11, 7))))


# ── Le recollage, pur ───────────────────────────────────────────────────────


def moteur_qui_repeint(toile_rgb: np.ndarray, zone: np.ndarray, fond) -> np.ndarray:
    """Ce qu'un moteur rend : dans la zone, le corps prend un ton voisin (il se
    substitue) et le haut du vide devient bleu (il s'ajoute) ; ailleurs dans la
    zone, il repeint le fond ; **hors de la zone il barbouille en rouge**."""
    sortie = toile_rgb.copy()
    sortie[~zone] = ROUGE
    corps = np.all(toile_rgb != fond, axis=2)
    sortie[zone & corps] = VOISIN
    haut = np.zeros_like(zone)
    haut[:4] = True
    sortie[zone & ~corps & haut] = BLEU
    sortie[zone & ~corps & ~haut] = fond
    return np.asarray(Image.fromarray(sortie).resize((256, 256), Image.NEAREST))


def test_le_recollage_ne_touche_que_la_zone_et_ne_perce_aucun_trou():
    corps = sprite()
    zone = masque_de_zone((16, 16), TETE)
    fond = np.array((128, 128, 128), dtype=np.uint8)
    toile = np.where(corps[..., 3:] > 0, corps[..., :3], fond)
    revenu = moteur_qui_repeint(toile, zone, fond)
    r = recoller(corps, revenu, zone, "#808080", 4)
    assert r.hors_zone == 0 and r.trous == 0
    # **Le calque est exactement ce qui a changé** — et rien d'autre.
    attendu = zone & (np.all(toile != fond, axis=2) | (np.arange(16)[:, None] < 4))
    change = r.calque[..., 3] > 0
    assert np.array_equal(change, attendu)
    assert np.array_equal(r.calque[change], r.image[change])
    # Hors de la zone : l'image est l'image d'en dessous, au pixel près.
    assert np.array_equal(r.image[~zone], corps[~zone])
    # Le fond repeint en fond reste transparent.
    assert (r.image[zone & ~attendu][..., 3] == 0).all()


def test_une_piece_qui_se_substitue_entre_entiere_la_ou_la_difference_la_perd():
    """Le piège de la tranche : la tolérance au voisin de 3×3 de `differencier`
    absorbe un ton voisin posé sur le corps. Le recollage le garde."""
    corps = sprite()
    zone = masque_de_zone((16, 16), TETE)
    fond = np.array((128, 128, 128), dtype=np.uint8)
    toile = np.where(corps[..., 3:] > 0, corps[..., :3], fond)
    r = recoller(corps, moteur_qui_repeint(toile, zone, fond), zone, "#808080", 4)
    substitues = zone & (corps[..., 3] > 0)
    assert substitues.sum() > 0
    assert (r.calque[substitues][..., 3] == 255).all()
    assert (r.calque[substitues][..., :3] == VOISIN).all()
    par_difference = differencier(corps, r.image, Difference(base="x"))
    assert (par_difference[substitues][..., 3] == 0).all()


def test_les_couleurs_se_rangent_sur_celles_de_l_image_plus_quelques_neuves():
    corps = sprite()
    zone = masque_de_zone((16, 16), TETE)
    bruit = np.random.default_rng(3).integers(0, 255, (16, 16, 3)).astype(np.uint8)
    r = recoller(corps, bruit, zone, "", 2)
    couleurs = {tuple(c) for c in r.calque[r.calque[..., 3] > 0][..., :3].tolist()}
    assert len(couleurs - {PEAU}) <= 2
    # Déterministe : la même entrée rend le même calque.
    assert np.array_equal(r.calque, recoller(corps, bruit, zone, "", 2).calque)


def test_le_fond_d_une_zone_fuit_l_image_et_la_couleur_demandee():
    from atelier.domaine.fond import ECART_MINIMAL, choisir, choisir_pour_une_zone, ecart
    peau = ["#C8967A", "#6E4A3A", "#808080"]
    # Sur l'image seule, le texte ne compte pas (RV3) ; pour une zone, il compte.
    assert choisir(peau, "blue spiky hair").couleur == choisir(peau).couleur
    fond = choisir_pour_une_zone(peau, "blue spiky hair").couleur
    assert ecart(fond, "#0000FF") >= ECART_MINIMAL and fond not in ("#00FFFF", "#9000FF")
    assert choisir_pour_une_zone(peau, "magenta hair").couleur != "#FF00FF"
    # Sans couleur nommée, la même chose qu'un appel ordinaire.
    assert choisir_pour_une_zone(peau, "a hat").couleur == choisir(peau).couleur


def test_la_palette_se_lit_par_compte_puis_par_valeur():
    corps = sprite()
    corps[0, 0] = (1, 2, 3, 255)
    assert [tuple(c) for c in palette_du_corps(corps).tolist()] == [PEAU, (1, 2, 3)]


def test_la_zone_se_dit_en_passages_quelle_que_soit_sa_source():
    masque = np.zeros((8, 8), dtype=bool)
    masque[1:3, 2:6] = True
    masque[5, 0] = True
    assert np.array_equal(masque_de_zone((8, 8), traits_depuis_masque(masque)), masque)
    assert np.array_equal(masque_de_zone((8, 8), traits_depuis_rectangles([[2, 1, 5, 2], [0, 5, 0, 5]], (8, 8))), masque)
    # La gomme retire ce que le pinceau avait posé : le dernier passage l'emporte.
    gomme = (Trait(garde=True, rayon=1, points=((3, 3),)), Trait(garde=False, rayon=0, points=((3, 3),)))
    peint = masque_de_zone((8, 8), gomme)
    assert peint.sum() == 8 and not peint[3, 3]
    png = Image.open(io.BytesIO(masque_en_png(masque)))
    assert png.mode == "L" and png.size == (8, 8)


def test_le_fond_se_lit_sur_l_image_partie():
    corps = sprite()
    toile = Image.new("RGB", (16, 16), (255, 0, 255))
    toile.paste(Image.fromarray(corps, "RGBA"), (0, 0), Image.fromarray(corps, "RGBA"))
    assert fond_de_la_toile(_png(toile), corps) == "#ff00ff"
    opaque = corps.copy()
    opaque[..., 3] = 255
    assert fond_de_la_toile(_png(toile), opaque) == ""


def test_la_zone_peinte_s_ecrit_dans_la_difference_seulement_quand_elle_est_remplie():
    """**Un calque comme ceux de l'équipement** : la même place `difference`,
    dont seule la source change. Vide, rien de neuf ne s'écrit (règle B1)."""
    ordinaire = Difference(base="b")
    assert "zone_peinte" not in ordinaire.en_json() and "texte" not in ordinaire.en_json()
    assert not ordinaire.repeinte
    difference = Difference(base="b", zone_peinte=TETE, texte="blue hair", fond="#808080", couleurs=3)
    recette = Recette(difference=difference)
    relue = Recette.depuis_json(json.loads(json.dumps(recette.en_json())))
    assert relue == recette and relue.difference.repeinte and not relue.vide
    assert relue.empreinte() != Recette(difference=ordinaire).empreinte()


# ── Le chemin de l'atelier ──────────────────────────────────────────────────


class ComfyQuiRepeint(ComfyZoneDouble):
    """Le moteur doublé **repeint d'après ce qu'il a reçu** : la dernière image
    déposée et la dernière zone déposée."""

    def repondre(self, req):
        if req.url.path == "/view":
            toile = masque = None
            for nom, corps in self.depots:
                octets = octets_deposes(corps)
                if nom.startswith("atelier-masque-"):
                    masque = octets
                else:
                    toile = octets
            rgb = np.asarray(Image.open(io.BytesIO(toile)).convert("RGB")).copy()
            zone = np.asarray(Image.open(io.BytesIO(masque)).convert("L")) >= 128
            fond = rgb[0, 0].copy()
            import httpx
            return httpx.Response(200, content=_png(Image.fromarray(moteur_qui_repeint(rgb, zone, fond))))
        return super().repondre(req)


@pytest.fixture
async def atelier_zone(tmp_path, double):
    comfy = ComfyQuiRepeint()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy, tmp_path
    await atelier.file_locale.fermer()


async def _installer(atelier):
    modele = (await atelier.styles_locaux.installer(ZONE))["modele"]
    await atelier.catalogue.rafraichir()
    return modele


def _importer(atelier):
    projet = atelier.bibliotheque.courant
    return atelier.generations.importer(_png(Image.fromarray(sprite(), "RGBA")), "Héros", projet=projet)["asset"]["identifiant"]


async def test_sans_modele_capable_l_outil_dit_pourquoi_et_quoi_installer(atelier_zone):
    atelier, comfy, _ = atelier_zone
    image = _importer(atelier)
    etat = await atelier.zone.etat(image)
    assert etat["modele"] is None
    assert "installez l'outil" in etat["raison"] and etat["outil"]["identifiant"] == ZONE
    assert etat["outil"]["pret"] is True
    from atelier.domaine.erreurs import DemandeRefusee
    with pytest.raises(DemandeRefusee, match="ne sait repeindre une zone"):
        await atelier.zone.lancer(image, "blue hair", TETE)
    assert not comfy.envois
    # Installé mais ses nœuds disparus : grisé avec la raison du catalogue.
    await _installer(atelier)
    del comfy.informations["SetLatentNoiseMask"]
    await atelier.catalogue.rafraichir()
    etat = await atelier.zone.etat(image)
    assert etat["modele"] is not None and "SetLatentNoiseMask" in etat["raison"]


async def test_peindre_ecrire_lancer_rend_un_calque_borne_a_la_zone(atelier_zone):
    atelier, comfy, _ = atelier_zone
    modele = await _installer(atelier)
    image = _importer(atelier)
    etat = await atelier.zone.etat(image)
    assert etat["modele"]["identifiant"] == modele and etat["raison"] is None
    # Un temps annoncé avant de partir : pas encore mesuré, la vitesse relevée.
    assert etat["temps"]["secondes"] is None and "secondes" in etat["temps"]["vitesse"]
    assert etat["force"]["defaut"] == 0.9

    generation = await atelier.zone.lancer(image, "blue spiky hair", TETE)
    await atelier.generations.attendre_tout()
    fin = atelier.zone.resultat(generation.identifiant)
    assert fin["statut"] == "reussie", fin["raison"]
    calque = fin["calque"]
    assert calque["image"] == image and calque["texte"] == "blue spiky hair"
    # La force par défaut est partie, et elle se relit.
    assert calque["force"] == 0.9
    # **Le fond fuit le bleu demandé autant que la peau** : jamais le cyan,
    # dont l'interdiction chassait le bleu du sujet (vrai moteur, 26 sept.).
    assert calque["fond"] not in ("", "#00FFFF")
    assert calque["mesures"]["pixels_hors_zone"] == 0
    assert calque["mesures"]["pixels_du_sujet_perdus"] == 0
    assert calque["mesures"]["pixels_changes"] > 0

    # Le rendu du calque : rien hors de la zone, le corps substitué entier.
    rendu = np.asarray(Image.open(io.BytesIO(atelier.assets.octets(atelier.assets.lire(calque["identifiant"]))[0])).convert("RGBA"))
    zone = masque_de_zone((16, 16), TETE)
    assert rendu.shape[:2] == (16, 16)
    assert (rendu[~zone][..., 3] == 0).all()
    assert (rendu[zone & (sprite()[..., 3] > 0)][..., :3] == VOISIN).all()

    # **Ce qui est parti** : le texte de l'auteur en tête, derrière le seul
    # déclencheur — ni la bible du jeu, ni les consignes de pose.
    assert fin["parti"]["texte"] == "pixel art, blue spiky hair"
    graphe = comfy.envois[-1]["prompt"]
    textes = [n["inputs"].get("text") for n in graphe.values() if n.get("class_type") == "CLIPTextEncode"]
    assert "pixel art, blue spiky hair" in textes
    apercu = atelier.zone.ce_qui_part(image, "blue spiky hair")
    assert apercu["texte"] == fin["parti"]["texte"]

    # Le calque est un enfant de l'image, rangé comme un calque.
    asset = atelier.assets.lire(calque["identifiant"])
    assert asset.parent == image
    assert [c["identifiant"] for c in (await atelier.zone.etat(image))["calques"]] == [asset.identifiant]


async def test_un_calque_garde_se_rouvre_avec_sa_zone_son_texte_sa_graine_et_sa_force(atelier_zone):
    """**Referme et rouvre** — gardé avec des réglages qui ne sont pas ceux du
    défaut, sinon la relecture passerait par accident (point 8septies)."""
    atelier, comfy, tmp_path = atelier_zone
    await _installer(atelier)
    image = _importer(atelier)
    generation = await atelier.zone.lancer(image, "a red bandana", TETE, graine=1234, force=0.7, couleurs=2)
    await atelier.generations.attendre_tout()
    avant = atelier.zone.resultat(generation.identifiant)["calque"]
    rendu_avant = atelier.assets.octets(atelier.assets.lire(avant["identifiant"]))[0]
    await atelier.file_locale.fermer()

    rouvert = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: None, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(rouvert, ComfyQuiRepeint())
    await rouvert.ouvrir()
    try:
        apres = rouvert.zone.fiche(avant["identifiant"])
        assert apres["texte"] == "a red bandana"
        assert apres["zone"] == [t.en_json() for t in TETE]
        assert apres["graine"] == 1234 and apres["force"] == 0.7 and apres["couleurs"] == 2
        assert apres["modele"] == avant["modele"]
        assert apres["mesures"] == avant["mesures"]
        # Le rendu effacé se recalcule à l'identique, sans rien redemander.
        asset = rouvert.assets.lire(avant["identifiant"])
        assert rouvert.assets._calculer(asset).octets == rendu_avant
    finally:
        await rouvert.file_locale.fermer()


async def test_la_main_se_pose_sur_un_calque_repeint_et_tient_a_la_reouverture(atelier_zone):
    """**La main de C4 sur un calque repeint, sans rien de neuf** : on ôte au
    masque, on tranche un pixel, on en ramène un, on referme, on rouvre — le
    résultat de la zone et les gestes de la main sont là tous les deux."""
    atelier, comfy, tmp_path = atelier_zone
    await _installer(atelier)
    image = _importer(atelier)
    generation = await atelier.zone.lancer(image, "blue spiky hair", TETE, graine=77, force=0.8, couleurs=3)
    await atelier.generations.attendre_tout()
    calque = atelier.zone.resultat(generation.identifiant)["calque"]["identifiant"]

    def rendu_de(a):
        asset = a.assets.lire(calque)
        return np.asarray(Image.open(io.BytesIO(a.assets._calculer(asset).octets)).convert("RGBA"))

    avant = rendu_de(atelier)
    assert avant[5, 6, 3] == 255 and avant[6, 7, 3] == 255 and avant[0, 0, 3] == 0
    # Ôter (7, 6) au masque, trancher (6, 5), ramener (0, 0) — hors de la zone,
    # donc un pixel que le recollage n'avait pas gardé.
    atelier.equipement.affiner(calque, "affinage", [{"garde": False, "rayon": 0, "points": [[7, 6]]}])
    atelier.equipement.affiner(calque, "retouche", [
        {"garde": False, "rayon": 0, "points": [[6, 5]]},
        {"garde": True, "rayon": 0, "points": [[0, 0]]},
    ])
    # Et la main de la table « Main » (la huitième place), celle que l'écran
    # ouvre sur n'importe quelle image : elle passe après la différence.
    from dataclasses import replace
    from atelier.domaine.recette import Main
    asset = atelier.assets.lire(calque)
    atelier.assets.poser_recette(calque, replace(asset.recette, main=Main(opacite=(Trait(garde=False, rayon=0, points=((9, 5),)),))))
    retouche = rendu_de(atelier)
    assert retouche[6, 7, 3] == 0 and retouche[5, 6, 3] == 0 and retouche[0, 0, 3] == 255
    assert retouche[5, 9, 3] == 0 and atelier.assets.lire(calque).recette.difference.repeinte
    await atelier.file_locale.fermer()

    rouvert = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: None, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(rouvert, ComfyQuiRepeint())
    await rouvert.ouvrir()
    try:
        fiche = rouvert.zone.fiche(calque)
        assert fiche["texte"] == "blue spiky hair" and fiche["zone"] == [t.en_json() for t in TETE]
        assert fiche["graine"] == 77 and fiche["force"] == 0.8 and fiche["couleurs"] == 3
        assert len(fiche["affinage"]) == 1 and len(fiche["retouche"]) == 2
        apres = rendu_de(rouvert)
        assert (apres == retouche).all()
        # Le reste de la zone n'a pas bougé : le corps substitué est toujours là.
        assert tuple(apres[5, 8, :3]) == VOISIN and apres[5, 8, 3] == 255
    finally:
        await rouvert.file_locale.fermer()


async def test_jeter_retire_le_calque_et_garde_la_generation(atelier_zone):
    atelier, comfy, _ = atelier_zone
    await _installer(atelier)
    image = _importer(atelier)
    generation = await atelier.zone.lancer(image, "a hat", TETE)
    await atelier.generations.attendre_tout()
    calque = atelier.zone.resultat(generation.identifiant)["calque"]["identifiant"]
    atelier.bibliotheque.supprimer([calque])
    assert (await atelier.zone.etat(image))["calques"] == []
    assert atelier.generations.lire(generation.identifiant) is not None


async def test_les_refus_partent_avant_la_file(atelier_zone):
    atelier, comfy, _ = atelier_zone
    await _installer(atelier)
    image = _importer(atelier)
    from atelier.domaine.erreurs import DemandeRefusee
    with pytest.raises(DemandeRefusee, match="écrivez"):
        await atelier.zone.lancer(image, "  ", TETE)
    with pytest.raises(DemandeRefusee, match="peignez"):
        await atelier.zone.lancer(image, "hat", ())
    gomme = (Trait(garde=True, rayon=0, points=((3, 3),)), Trait(garde=False, rayon=0, points=((3, 3),)))
    with pytest.raises(DemandeRefusee, match="peignez"):
        await atelier.zone.lancer(image, "hat", gomme)
    assert not comfy.envois


def test_la_route_lance_et_suit_jusqu_au_calque(tmp_path, double):
    """Par les routes, exactement comme l'écran : l'état, ce qui partira, le
    refus avant la file, le lancement, puis le suivi jusqu'au calque."""
    import time

    comfy = ComfyQuiRepeint()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    with TestClient(creer_application(atelier)) as client:
        assert client.post("/api/workflow-profiles/styles/sdxl-retouche-zone/install").status_code == 200
        image = _importer(atelier)
        etat = client.get(f"/api/assets/{image}/zone").json()
        assert etat["raison"] is None and etat["modele"] is not None
        apercu = client.post(f"/api/assets/{image}/zone/preview", json={"texte": "blue hair"}).json()
        assert apercu["texte"] == "pixel art, blue hair"
        refus = client.post(f"/api/assets/{image}/zone", json={"texte": "", "zone": [t.en_json() for t in TETE]})
        assert refus.status_code == 409 and "écrivez" in json.dumps(refus.json(), ensure_ascii=False)
        lance = client.post(f"/api/assets/{image}/zone", json={"texte": "blue hair", "zone": [t.en_json() for t in TETE], "graine": 7})
        assert lance.status_code == 201
        fin = lance.json()
        limite = time.monotonic() + 30
        while fin["statut"] not in ("reussie", "echouee") and time.monotonic() < limite:
            time.sleep(0.1)
            fin = client.get(f"/api/zone/{fin['generation']}").json()
        assert fin["statut"] == "reussie", fin["raison"]
        assert fin["graine"] == 7
        rouvert = client.get(f"/api/assets/{image}/zone").json()["calques"]
        assert [c["texte"] for c in rouvert] == ["blue hair"]
        assert [c["identifiant"] for c in client.get(f"/api/assets/{image}/zone").json()["calques"]] == [fin["calque"]["identifiant"]]


async def test_l_agent_a_le_meme_geste(atelier_zone):
    atelier, comfy, _ = atelier_zone
    modele = await _installer(atelier)
    image = _importer(atelier)
    from atelier.mcp.serveur import creer_serveur
    serveur = creer_serveur(atelier)
    outils = {o.name: o for o in await serveur.list_tools()}
    assert "repaint_zone" in outils
    projet = atelier.bibliotheque.courant
    # **Le cadre de l'agent décide** : sans calcul local permis, refusé avec sa
    # phrase, et rien ne part.
    atelier.travaux.regler_cadre(projet, {"autoriser_local": False})
    with pytest.raises(Exception, match="n'autorise pas cette fabrication locale"):
        await serveur.call_tool("repaint_zone", {"asset_id": image, "prompt": "blue hair", "rectangles": [[4, 2, 11, 3]]})
    assert not comfy.envois and atelier.travaux.lister(projet) == []
    atelier.travaux.regler_cadre(projet, {"autoriser_local": True})
    masque = np.zeros((16, 16), dtype=bool)
    masque[4:8, 5:11] = True
    rendu = await serveur.call_tool("repaint_zone", {
        "asset_id": image, "prompt": "blue hair",
        "rectangles": [[4, 2, 11, 3]],
        "mask_png_base64": base64.b64encode(masque_en_png(masque)).decode(),
        "seed": 42, "wait_seconds": 30,
    })
    assert not rendu.is_error, rendu
    charge = rendu.structured_content
    assert charge["status"] == "reussie", charge["reason"]
    assert charge["seed"] == 42
    assert charge["measures"]["pixels_hors_zone"] == 0
    fiche = atelier.zone.fiche(charge["layer_id"])
    attendu = masque.copy()
    attendu[2:4, 4:12] = True
    assert np.array_equal(masque_de_zone((16, 16), [Trait.depuis_json(t) for t in fiche["zone"]]), attendu)
    assert atelier.assets.lire(charge["layer_id"]).provenance == "agent"
    (travail,) = atelier.travaux.lister(projet)
    assert travail["nature"] == "zone" and travail["etat"] == "termine" and travail["assets"] == [charge["layer_id"]]
    # La liste des modèles de l'agent dit la capacité.
    modeles = await serveur.call_tool("list_models", {})
    modeles = modeles.structured_content
    assert next(m for m in modeles["models"] if m["id"] == modele)["repaints_zone"] is True
