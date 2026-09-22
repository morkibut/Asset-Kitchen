"""Qwen-Image 2.1, moteur local principal (22/09/2026) : deux réglages d'un même
modèle, « Très rapide » et « Meilleure qualité », choisis pour une carte de 8 Go.

ComfyUI est doublé avec le relevé réel de la machine (`object_info_local.json`,
18/09/2026), auquel on ajoute ce que ComfyUI 0.37 et les poids de
Comfy-Org/Qwen-Image-2.1 y feraient paraître."""
import copy

import pytest

from atelier.domaine.workflow import composer, normaliser
from atelier.fournisseur.catalogue_styles import inventaire, qualite, resoudre, style
from atelier.fournisseur.styles_locaux import QWEN21_RESOLUTION_REFERENCE, construire_profil
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import OBJECT_INFO, ComfyStylesDouble

UNET_INT8 = "qwen_image_2.1_int8_convrot.safetensors"
CLIP_INT8 = "qwen3vl_8b_int8_convrot.safetensors"
VAE = "qwen_image_2.1_vae_bf16.safetensors"


def releve_avec_qwen21(*, noeud=True, unets=(UNET_INT8, "qwen_image_2.1_bf16.safetensors"),
        clips=(CLIP_INT8, "qwen3vl_8b_bf16.safetensors")):
    info = copy.deepcopy(OBJECT_INFO)
    info["UNETLoader"]["input"]["required"]["unet_name"][0].extend(unets)
    info["CLIPLoader"]["input"]["required"]["clip_name"][0].extend(clips)
    info["VAELoader"]["input"]["required"]["vae_name"][0].append(VAE)
    if noeud:
        # La forme que publie ComfyUI pour un nœud à entrées « qui poussent » :
        # le groupe `images` rangé parmi les obligatoires malgré `min: 0`.
        info["TextEncodeQwenImage21"] = {"input": {
            "required": {"clip": ["CLIP", {}], "prompt": ["STRING", {}], "negative_prompt": ["STRING", {}],
                "resolution": ["INT", {}],
                "images": ["COMFY_AUTOGROW_V3", {"template": {"input": {"required": {"image": ["IMAGE", {}]}},
                    "names": [f"image_{i}" for i in range(1, 17)], "min": 0}}]},
            "optional": {"vae": ["VAE", {}]}}}
    return info


@pytest.mark.parametrize("identifiant", ("qwen21-rapide", "qwen21-qualite"))
def test_sur_8_go_on_prend_les_poids_int8_jamais_bf16(identifiant):
    resolu = resoudre(style(identifiant), inventaire(releve_avec_qwen21()))
    assert resolu["pret"], resolu["manque"]
    assert resolu["fichiers"] == {"unet": UNET_INT8, "clip": CLIP_INT8, "vae": VAE}


def test_int8_passe_devant_un_gguf_q8_et_int4_derriere():
    assert qualite(UNET_INT8) > qualite("qwen-image-2.1-Q8_0.gguf") > qualite("qwen_image_2.1_int4_convrot.safetensors")
    resolu = resoudre(style("qwen21-rapide"), inventaire(releve_avec_qwen21(
        unets=("qwen-image-2.1-Q4_K_M.gguf", "qwen_image_2.1_int4_convrot.safetensors", "qwen-image-2.1-Q8_0.gguf"))))
    assert resolu["fichiers"]["unet"] == "qwen-image-2.1-Q8_0.gguf"


def test_comfyui_trop_ancien_est_nomme_avec_la_consigne():
    resolu = resoudre(style("qwen21-rapide"), inventaire(releve_avec_qwen21(noeud=False)))
    assert not resolu["pret"]
    assert resolu["manque"] == ["le nœud TextEncodeQwenImage21 (mettre à jour ComfyUI en version 0.37 ou plus récente)"]


def test_sans_les_poids_on_dit_ce_qui_manque_et_pas_de_lora():
    resolu = resoudre(style("qwen21-qualite"), inventaire(OBJECT_INFO))
    assert "le LoRA de style" not in resolu["manque"]
    assert {"le modèle de base", "l’encodeur de texte", "le décodeur d’image"} <= set(resolu["manque"])


def _profil(identifiant, releve=None):
    resolu = resoudre(style(identifiant), inventaire(releve or releve_avec_qwen21()))
    return normaliser(construire_profil(style(identifiant), resolu["fichiers"]))


def test_le_mode_rapide_tire_12_etapes_en_512():
    profil = _profil("qwen21-rapide")
    assert [f["resolution"] for f in profil["formats"]] == ["512", "1024"]
    graphe = composer(profil, prompt="Un pèlerin", prompt_negatif="flou", resolution="512", proportions="1:1", graine=42)
    k = graphe["6"]["inputs"]
    assert (k["steps"], k["cfg"], k["sampler_name"], k["scheduler"], k["seed"]) == (12, 1, "euler", "simple", 42)
    assert graphe["5"]["inputs"] == {"width": 512, "height": 512, "batch_size": 1}
    encode = graphe["4"]["inputs"]
    assert encode["prompt"] == "Un pèlerin" and encode["negative_prompt"] == ""  # cfg 1 : le négatif ne part pas
    assert graphe["2"]["inputs"]["type"] == "qwen_image"
    assert k["positive"] == ["4", 0] and k["negative"] == ["4", 1]
    assert "vae" not in encode
    assert "prompt_negatif" not in profil["liaisons"]


def test_le_mode_qualite_tire_30_etapes_et_monte_a_1536():
    profil = _profil("qwen21-qualite")
    assert [f["resolution"] for f in profil["formats"]] == ["512", "1024", "1536"]
    graphe = composer(profil, prompt="Un pèlerin", resolution="1536", proportions="1:1", graine=1)
    assert graphe["6"]["inputs"]["steps"] == 30
    assert (graphe["5"]["inputs"]["width"], graphe["5"]["inputs"]["height"]) == (1536, 1536)
    assert profil["style"]["vitesse"] == style("qwen21-qualite")["vitesse"]  # la vitesse du réglage, pas de la famille


def test_un_gguf_se_charge_par_le_chargeur_gguf():
    profil = _profil("qwen21-rapide", releve_avec_qwen21(unets=("qwen-image-2.1-Q4_K_M.gguf",)))
    assert profil["graphe"]["1"] == {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "qwen-image-2.1-Q4_K_M.gguf"}}


def test_trois_references_entrent_dans_le_noeud_d_encodage_avec_le_vae():
    profil = _profil("qwen21-rapide")
    assert (profil["references_min"], profil["references_max"]) == (0, 3)
    assert profil["style"]["reference"] == "sujet"
    graphe = composer(profil, prompt="Le même, de dos", resolution="1024", proportions="1:1", graine=3,
        references=["reference-0", "reference-1", "reference-2"])
    encode = graphe["4"]["inputs"]
    assert encode["vae"] == ["3", 0] and encode["resolution"] == QWEN21_RESOLUTION_REFERENCE
    for i in range(3):
        charge = encode[f"images.image_{i + 1}"][0]
        assert graphe[charge]["class_type"] == "LoadImage" and graphe[charge]["inputs"]["image"] == f"reference-{i}"


def test_les_entrees_qui_poussent_se_lisent_comme_comfyui_les_declare():
    from atelier.fournisseur.workflow import _groupe_facultatif, _membre_de_groupe
    champs = releve_avec_qwen21()["TextEncodeQwenImage21"]["input"]["required"]
    assert _membre_de_groupe("images.image_3", champs)
    assert not _membre_de_groupe("images.image_99", champs) and not _membre_de_groupe("prompt.x", champs)
    assert _groupe_facultatif(champs["images"], "images", {"prompt": ""})  # min 0 : absent, c'est permis
    au_moins_un = ["COMFY_AUTOGROW_V3", {"template": {"prefix": "image", "min": 1}}]
    assert not _groupe_facultatif(au_moins_un, "images", {})
    assert _groupe_facultatif(au_moins_un, "images", {"images.image0": ["1", 0]})
    assert _membre_de_groupe("images.image0", {"images": au_moins_un})


@pytest.fixture
async def atelier_qwen(tmp_path, double):
    comfy = ComfyStylesDouble(releve_avec_qwen21())
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy
    await atelier.file_locale.fermer()


async def test_installe_il_devient_le_modele_par_defaut(atelier_qwen):
    atelier, comfy = atelier_qwen
    avant = atelier.catalogue.defaut().modele
    assert not (avant or "").startswith("ComfyUI:qwen21")
    installes = await atelier.styles_locaux.installer_prets()
    assert {"qwen21-rapide", "qwen21-qualite"} <= {p["identifiant"] for p in installes}
    await atelier.catalogue.rafraichir()
    assert atelier.catalogue.defaut().modele.startswith("ComfyUI:qwen21-rapide@")


async def test_grise_il_rend_la_main_au_defaut_d_avant(atelier_qwen):
    atelier, comfy = atelier_qwen
    await atelier.styles_locaux.installer_prets()
    # ComfyUI redescend sous la 0.37 : le nœud disparaît, le profil installé est grisé.
    comfy.informations = {k: v for k, v in comfy.informations.items() if k != "TextEncodeQwenImage21"}
    await atelier.catalogue.rafraichir()
    assert not (atelier.catalogue.defaut().modele or "").startswith("ComfyUI:qwen21")
