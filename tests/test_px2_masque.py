"""PX2 : le masque voyage jusqu'au moteur local (`docs/PLAN-idees-pixellab.md` § PX2).

Un profil déclare la liaison `masque` ; un profil qui ne la déclare pas refuse un
masque par un message, jamais en silence. Le masque arrive à ComfyUI tel qu'il est
parti — l'essai relit l'image déposée —, et l'image à retoucher, elle, continue de
passer sur blanc. La retouche de zone s'installe, se liste, et se grise avec sa
raison. ComfyUI est doublé : le relevé réel de ML2, plus les deux nœuds du masque.
"""
import copy
import io
import json
import re

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine import Reinjection
from atelier.domaine.catalogue import Modele, modele_depuis_json, modele_en_json
from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.generation import ASSET, REFERENCE
from atelier.domaine.workflow import WorkflowRefuse, composer, normaliser
from atelier.fournisseur.catalogue_styles import OUTILS, STYLES, inventaire, resoudre, style
from atelier.fournisseur.styles_locaux import construire_profil
from atelier.fournisseur.workflow import MoteurWorkflow, sur_fond_blanc
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import profil as profil_simple
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import OBJECT_INFO

ZONE = "sdxl-retouche-zone"
NOEUDS_MASQUE = ("ImageToMask", "SetLatentNoiseMask")


def _png(image):
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def masque_png(taille=(8, 8), boite=(2, 0, 6, 3)):
    """Blanc = repeindre, noir = garder — en niveaux de gris, un seul canal."""
    image = Image.new("L", taille, 0)
    for x in range(boite[0], boite[2]):
        for y in range(boite[1], boite[3]):
            image.putpixel((x, y), 255)
    return _png(image)


def sprite_transparent(taille=(8, 8)):
    image = Image.new("RGBA", taille, (0, 0, 0, 0))
    for x in range(2, 6):
        for y in range(2, 8):
            image.putpixel((x, y), (190, 40, 40, 255))
    return _png(image)


def object_info_zone(avec_masque=True):
    infos = copy.deepcopy(OBJECT_INFO)
    if avec_masque:
        infos["ImageToMask"] = {"input": {"required": {"image": ["IMAGE"], "channel": [["red", "green", "blue", "alpha"]]}}}
        infos["SetLatentNoiseMask"] = {"input": {"required": {"samples": ["LATENT"], "mask": ["MASK"]}}}
    return infos


def profil_zone(infos=None):
    resolu = resoudre(style(ZONE), inventaire(infos or object_info_zone()))
    assert resolu["pret"], resolu["manque"]
    return normaliser(construire_profil(style(ZONE), resolu["fichiers"]))


class ComfyZoneDouble:
    """Le relevé réel, les deux nœuds du masque, et une file qui rend une image.
    Chaque dépôt garde son nom et ses octets bruts, pour les relire."""

    def __init__(self, avec_masque=True):
        self.informations = object_info_zone(avec_masque)
        self.depots, self.envois = [], []

    def repondre(self, req):
        chemin = req.url.path
        if chemin == "/object_info":
            return httpx.Response(200, json=self.informations)
        if chemin == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if chemin == "/upload/image":
            nom = re.search(rb'filename="([^"]+)"', req.content).group(1).decode()
            self.depots.append((nom, req.content))
            return httpx.Response(200, json={"name": nom})
        if chemin == "/prompt":
            charge = json.loads(req.content)
            self.envois.append(charge)
            return httpx.Response(200, json={"prompt_id": f"calcul-{len(self.envois)}"})
        if chemin.startswith("/history/"):
            numero = chemin.split("/")[-1]
            return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {"7": {
                "images": [{"filename": "zone.png", "type": "output", "subfolder": ""}]}}}})
        if chemin == "/view":
            return httpx.Response(200, content=_png(Image.new("RGB", (512, 512), (10, 200, 10))))
        raise AssertionError((req.method, str(req.url)))


def octets_deposes(corps):
    debut = corps.index(b"\x89PNG")
    return corps[debut:corps.index(b"IEND", debut) + 8]


# ── Le schéma ────────────────────────────────────────────────────────────────

def test_le_style_de_zone_relie_un_masque_et_une_seule_image():
    p = profil_zone()
    assert p["liaisons"]["masque"] == [{"noeud": "11", "champ": "image"}]
    assert p["references_min"] == p["references_max"] == 1
    assert p["parametres"]["force"] == {"genre": "intervalle", "minimum": 0.5, "maximum": 1, "defaut": 0.9}
    assert p["style"]["famille"] == "sdxl"


def test_le_graphe_garde_l_image_sous_la_zone_jamais_vaeencodeforinpaint():
    graphe = profil_zone()["graphe"]
    classes = {n["class_type"] for n in graphe.values()}
    assert {"SetLatentNoiseMask", "ImageToMask", "VAEEncode"} <= classes
    assert "VAEEncodeForInpaint" not in classes and "EmptyLatentImage" not in classes
    assert graphe["5"]["inputs"]["latent_image"] == ["15", 0]
    assert graphe["15"]["inputs"] == {"samples": ["9", 0], "mask": ["14", 0]}
    assert graphe["14"]["inputs"]["channel"] == "red"
    # Même moteur que le style de référence du banc PX1.
    assert graphe["13"]["inputs"]["lora_name"] == resoudre(style("sdxl-pixelart"), inventaire(OBJECT_INFO))["fichiers"]["lora"]


def test_le_schema_refuse_un_masque_sans_image_ou_hors_d_une_image():
    sans_reference = profil_simple(references=0)
    sans_reference["liaisons"]["masque"] = [{"noeud": "3", "champ": "steps"}]
    with pytest.raises(WorkflowRefuse, match="au moins une référence relie un masque"):
        normaliser(sans_reference)
    video = profil_simple(nature="video")
    video["graphe"]["9"] = {"class_type": "LoadImage", "inputs": {"image": "m.png"}}
    video["liaisons"]["masque"] = [{"noeud": "9", "champ": "image"}]
    with pytest.raises(WorkflowRefuse, match="masque"):
        normaliser(video)
    cible_absente = profil_simple(references=1)
    cible_absente["liaisons"]["masque"] = [{"noeud": "99", "champ": "image"}]
    with pytest.raises(WorkflowRefuse, match="manque dans le graphe"):
        normaliser(cible_absente)


def test_un_profil_d_image_ordinaire_garde_sa_forme():
    p = profil_simple(references=1)
    assert "masque" not in normaliser(p)["liaisons"]


# ── composer ─────────────────────────────────────────────────────────────────

def test_composer_injecte_le_nom_du_masque_et_la_force():
    graphe = composer(profil_zone(), prompt="a blue hairstyle", references=["image.png"], masque="atelier-masque-x.png",
        resolution="1024", graine=7, options={"force": 0.75})
    assert graphe["11"]["inputs"]["image"] == "atelier-masque-x.png"
    assert graphe["8"]["inputs"]["image"] == "image.png"
    assert graphe["5"]["inputs"]["denoise"] == 0.75 and graphe["5"]["inputs"]["seed"] == 7
    assert graphe["10"]["inputs"]["width"] == graphe["12"]["inputs"]["width"] == 1024
    # La force a ses bornes : sous 0,5 la zone ne change presque plus.
    with pytest.raises(WorkflowRefuse, match="force"):
        composer(profil_zone(), prompt="x", references=["i.png"], masque="m.png", resolution="512", options={"force": 0.3})


def test_un_profil_sans_liaison_refuse_un_masque_par_un_message():
    ordinaire = normaliser(profil_simple(references=1))
    with pytest.raises(WorkflowRefuse, match="ne sait pas repeindre une zone"):
        composer(ordinaire, prompt="x", references=["i.png"], masque="m.png")
    # Et le style de zone ne part jamais sans sa zone.
    with pytest.raises(WorkflowRefuse, match="il lui faut la zone peinte"):
        composer(profil_zone(), prompt="x", references=["i.png"], resolution="512")


# ── Le dépôt chez ComfyUI ─────────────────────────────────────────────────────

async def test_le_masque_arrive_tel_qu_il_est_parti_et_l_image_passe_encore_sur_blanc():
    comfy = ComfyZoneDouble()
    moteur = MoteurWorkflow("http://comfy.test", httpx.MockTransport(comfy.repondre))
    masque, image = masque_png(), sprite_transparent()
    await moteur.soumettre_graphe(profil_zone() | {"version": "v"}, {"prompt": "a hat", "resolution": "512"}, [image], masque=masque)
    (nom_image, corps_image), (nom_masque, corps_masque) = comfy.depots
    assert octets_deposes(corps_masque) == masque
    assert nom_masque.startswith("atelier-masque-") and not nom_image.startswith("atelier-masque-")
    # L'image, elle, est aplatie comme avant PX2.
    assert octets_deposes(corps_image) == sur_fond_blanc(image) != image
    graphe = comfy.envois[0]["prompt"]
    assert graphe["11"]["inputs"]["image"] == nom_masque and graphe["8"]["inputs"]["image"] == nom_image


async def test_sans_masque_rien_ne_change_au_depot():
    comfy = ComfyZoneDouble()
    moteur = MoteurWorkflow("http://comfy.test", httpx.MockTransport(comfy.repondre))
    p = normaliser(profil_simple(references=1)) | {"version": "v"}
    comfy.informations.update({n["class_type"]: {"input": {"required": {c: ["ANY"] for c in n["inputs"]}},
        "output_node": n["class_type"].startswith("Save")} for n in p["graphe"].values()})
    await moteur.soumettre_graphe(p, {"prompt": "x", "resolution": "64"}, [sprite_transparent()])
    assert len(comfy.depots) == 1 and comfy.depots[0][0].startswith("atelier-") and "masque" not in comfy.depots[0][0]


# ── Le catalogue et le grisé ─────────────────────────────────────────────────

class _Demande:
    def __init__(self, masque=None, references=(b"i",)):
        self.references, self.masque = references, masque
        self.proportions, self.resolution, self.options = "1:1", None, {}


def test_le_grise_dit_sa_raison_dans_les_deux_sens():
    distant = Modele("OpenRouter:x/y", "Y", fournisseur="OpenRouter", references_max=4)
    zone = Modele("ComfyUI:z@v", "Zone", fournisseur="ComfyUI", references_min=1, references_max=1, locale=True, masque=True)
    assert distant.refus(_Demande(masque=b"m")) == "ne sait pas repeindre une zone"
    assert distant.refus(_Demande()) is None
    assert zone.refus(_Demande()) == "repeint une zone : il lui faut la zone peinte"
    assert zone.refus(_Demande(masque=b"m")) is None
    # Une demande d'essai sans champ `masque` reste lisible (contrat minimal).
    class Nue:
        references, proportions, resolution, options = (), "1:1", None, {}
    assert distant.refus(Nue()) is None


def test_la_capacite_se_relit_et_vaut_faux_par_defaut():
    zone = Modele("ComfyUI:z@v", "Zone", fournisseur="ComfyUI", locale=True, masque=True)
    assert modele_en_json(zone)["masque"] is True
    assert modele_depuis_json(modele_en_json(zone)).masque is True
    d = modele_en_json(Modele("OpenRouter:x/y", "Y"))
    assert d["masque"] is False
    del d["masque"]
    assert modele_depuis_json(d).masque is False


def test_la_retouche_n_est_pas_dans_la_galerie_des_styles():
    assert ZONE not in {s["identifiant"] for s in STYLES}
    assert [o["identifiant"] for o in OUTILS] == [ZONE]


def test_la_retouche_manque_ses_noeuds_et_le_dit():
    resolu = resoudre(style(ZONE), inventaire(object_info_zone(avec_masque=False)))
    assert not resolu["pret"]
    assert resolu["manque"] == ["le nœud ImageToMask", "le nœud SetLatentNoiseMask"]
    sans_lora = object_info_zone()
    sans_lora["LoraLoader"] = copy.deepcopy(sans_lora["LoraLoader"])
    choix = sans_lora["LoraLoader"]["input"]["required"]["lora_name"]
    choix[0] = [n for n in choix[0] if "pixel-art-xl" not in n]
    assert resoudre(style(ZONE), inventaire(sans_lora))["manque"] == ["le LoRA de style"]


# ── Le chemin de l'atelier, de la demande au dépôt ─────────────────────────────

@pytest.fixture
async def atelier_zone(tmp_path, double):
    comfy = ComfyZoneDouble()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy
    await atelier.file_locale.fermer()


async def test_la_retouche_s_installe_se_liste_et_entre_au_catalogue(atelier_zone):
    atelier, comfy = atelier_zone
    ligne = (await atelier.styles_locaux.lister_outils())[0]
    assert ligne["identifiant"] == ZONE and ligne["pret"] and ligne["modele"] is None
    installe = await atelier.styles_locaux.installer(ZONE)
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(installe["modele"])
    assert modele.masque and modele.references_min == 1 and not modele.indisponible
    # Les autres styles locaux, eux, ne savent pas.
    autre = (await atelier.styles_locaux.installer("sdxl-pixelart"))["modele"]
    await atelier.catalogue.rafraichir()
    assert not atelier.catalogue.modele(autre).masque
    client = TestClient(creer_application(atelier))
    rendu = client.get("/api/workflow-profiles/styles").json()
    assert ZONE not in {s["identifiant"] for s in rendu["styles"]}
    assert rendu["outils"][0]["identifiant"] == ZONE and rendu["outils"][0]["modele"] == installe["modele"]
    fiche = next(m for m in client.get("/api/models").json()["modeles"] if m["identifiant"] == installe["modele"])
    assert fiche["masque"] is True


async def test_la_retouche_se_grise_quand_ses_noeuds_disparaissent(atelier_zone):
    atelier, comfy = atelier_zone
    installe = await atelier.styles_locaux.installer(ZONE)
    del comfy.informations["SetLatentNoiseMask"]
    assert not (await atelier.styles_locaux.lister_outils())[0]["pret"]
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(installe["modele"])
    assert "SetLatentNoiseMask" in modele.indisponible
    with pytest.raises(WorkflowRefuse, match="SetLatentNoiseMask"):
        await atelier.styles_locaux.installer(ZONE)


async def test_la_zone_part_par_la_file_et_arrive_telle_quelle(atelier_zone):
    atelier, comfy = atelier_zone
    modele = (await atelier.styles_locaux.installer(ZONE))["modele"]
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    asset = atelier.generations.importer(sprite_transparent(), "Sprite", projet=projet)["asset"]["identifiant"]
    taille = Image.open(io.BytesIO(atelier.assets.reference(asset))).size
    masque = masque_png(taille, (0, 0, taille[0], max(1, taille[1] // 3)))
    generation = await atelier.generations.soumettre(modele, Demande(prompt="a blue hairstyle", masque=masque,
        resolution="512", options={"force": 0.8}), projet=projet,
        references=[Reinjection(asset=asset, role=REFERENCE, origine=ASSET)])
    await atelier.generations.attendre_tout()
    fini = atelier.generations.lire(generation.identifiant)
    assert fini.emplacements[0].statut.value == "reussie", fini.emplacements[0].raison
    # Enregistré sans ses octets, posé à côté, relu pour la relance.
    assert fini.demande["masque"] is True
    assert atelier.generations.demande_preparee(fini).masque == masque
    depots = {nom: octets_deposes(corps) for nom, corps in comfy.depots}
    (nom_masque,) = [n for n in depots if n.startswith("atelier-masque-")]
    assert depots[nom_masque] == masque
    graphe = comfy.envois[0]["prompt"]
    assert graphe["11"]["inputs"]["image"] == nom_masque and graphe["5"]["inputs"]["denoise"] == 0.8


async def test_une_demande_sans_zone_reste_identique_octet_pour_octet(atelier_zone):
    """L'archive de la file et les paramètres de l'étape ne gagnent rien sans zone."""
    atelier, comfy = atelier_zone
    modele = (await atelier.styles_locaux.installer("sdxl-pixelart"))["modele"]
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    generation = await atelier.generations.soumettre(modele, Demande(prompt="a chest", resolution="512"), projet=projet)
    await atelier.generations.attendre_tout()
    fini = atelier.generations.lire(generation.identifiant)
    assert "masque" not in fini.demande
    etape = atelier.fournisseur_workflow_image.etape(generation.identifiant, 0)
    assert "masque" not in etape["parametres"]
    assert not any(n.startswith("atelier-masque-") for n, _ in comfy.depots)


async def test_un_masque_vers_un_modele_qui_ne_sait_pas_est_refuse_avant_tout(atelier_zone):
    atelier, comfy = atelier_zone
    modele = (await atelier.styles_locaux.installer("sdxl-pixelart"))["modele"]
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    asset = atelier.generations.importer(sprite_transparent(), "Sprite", projet=projet)["asset"]["identifiant"]
    with pytest.raises(DemandeRefusee, match="ne sait pas repeindre une zone"):
        atelier.generations.preparer(modele, Demande(prompt="x", masque=masque_png()), projet=projet,
            references=[Reinjection(asset=asset, role=REFERENCE, origine=ASSET)])
    assert not comfy.envois


async def test_un_masque_mal_forme_est_refuse_avant_la_file(atelier_zone):
    atelier, comfy = atelier_zone
    modele = (await atelier.styles_locaux.installer(ZONE))["modele"]
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    asset = atelier.generations.importer(sprite_transparent(), "Sprite", projet=projet)["asset"]["identifiant"]
    refs = [Reinjection(asset=asset, role=REFERENCE, origine=ASSET)]
    en_couleur = _png(Image.new("RGB", (8, 8), (255, 255, 255)))
    with pytest.raises(WorkflowRefuse, match="niveaux de gris"):
        atelier.generations.preparer(modele, Demande(prompt="x", masque=en_couleur, resolution="512"), projet=projet, references=refs)
    with pytest.raises(WorkflowRefuse, match="Le masque mesure 3 × 3"):
        atelier.generations.preparer(modele, Demande(prompt="x", masque=masque_png((3, 3), (0, 0, 1, 1)), resolution="512"),
            projet=projet, references=refs)
    assert not comfy.envois
