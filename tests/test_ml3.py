"""ML3 : les références. ComfyUI est doublé (relevé réel de /object_info, comme
ML2). Deux vérités différentes selon la famille :

- **FLUX.2 Klein** (« garder ce sujet ») n'a pas d'équivalent dans sc-clone —
  `lib/flux2.mjs` § reference fait de l'img2img (`SplitSigmasDenoise`), pas de
  l'édition par `ReferenceLatent`. La source de vérité est le gabarit d'édition
  officiel de ComfyUI, relevé le 18/09/2026 (voir `docs/PLAN-moteurs-locaux.md`
  § « L'image de référence » et son câblage exact). Les essais vérifient donc la
  **structure** de la chaîne `ReferenceLatent` plutôt qu'une comparaison à sc-clone.
- **Z-Image, FLUX.1-dev, SDXL** (« partir de cette image ») reprennent l'img2img
  de sc-clone tel quel : les graphes produits sont comparés structurellement à
  `tests/fixtures/ml3_graphes_reference_scclone.json`, une sortie figée de
  `makeZImageWorkflow`/`makeFlux1Workflow`/`makeWorkflow` appelés en Node avec
  les mêmes entrées (script dans le journal de la tranche, même méthode que ML2)."""
import json
from pathlib import Path

import pytest

from atelier.domaine.workflow import WorkflowRefuse, composer, normaliser
from atelier.fournisseur.catalogue_styles import STYLES, inventaire, resoudre, style
from atelier.fournisseur.styles_locaux import construire_profil
from tests.conftest import image_sujet
from tests.test_ml2 import OBJECT_INFO, ComfyStylesDouble, atelier_styles, moteur_pour  # noqa: F401

DONNEES = Path(__file__).parent / "fixtures"
GRAPHES_REFERENCE_DEPART = json.loads((DONNEES / "ml3_graphes_reference_scclone.json").read_text(encoding="utf-8"))

STYLES_DEPART = ("zimage-pixel", "flux1-modern", "sdxl-pixelart")


def _profil_installe(identifiant):
    inv = inventaire(OBJECT_INFO)
    e = style(identifiant)
    resolu = resoudre(e, inv)
    assert resolu["pret"]
    return normaliser(construire_profil(e, resolu["fichiers"]))


# ── Klein : garder ce sujet ─────────────────────────────────────────────────

def _tracer_chaine(graphe, depart, racine):
    """Remonte une chaîne de `ReferenceLatent` jusqu'à son origine (le nœud de
    texte, positif ou négatif) ; rend la liste des latents qu'elle porte."""
    latents, actuel = [], depart
    while graphe[actuel]["class_type"] == "ReferenceLatent":
        latents.append(graphe[actuel]["inputs"]["latent"][0])
        actuel = graphe[actuel]["inputs"]["conditioning"][0]
    assert actuel == racine, (actuel, racine)
    return latents


def _verifier_klein(graphe, *, distille, nombre):
    charges = sorted(k for k, v in graphe.items() if v["class_type"] == "LoadImage")
    echelles = [k for k, v in graphe.items() if v["class_type"] == "ImageScaleToTotalPixels"]
    encodes = [k for k, v in graphe.items() if v["class_type"] == "VAEEncode"]
    refs = [k for k, v in graphe.items() if v["class_type"] == "ReferenceLatent"]
    assert len(charges) == len(echelles) == len(encodes) == nombre
    assert len(refs) == 2 * nombre
    for i, charge in enumerate(charges):
        assert graphe[charge]["inputs"]["image"] == f"ref-{i}.png"
        echelle = next(k for k in echelles if graphe[k]["inputs"]["image"] == [charge, 0])
        assert graphe[echelle]["inputs"] == {"image": [charge, 0], "upscale_method": "nearest-exact",
            "megapixels": 1, "resolution_steps": 1}
        encode = next(k for k in encodes if graphe[k]["inputs"]["pixels"] == [echelle, 0])
        assert graphe[encode]["inputs"]["vae"] == ["3", 0]
    positif = graphe["8"]["inputs"]["positive"][0]
    negatif = graphe["8"]["inputs"]["negative"][0]
    latents_positifs = _tracer_chaine(graphe, positif, "5")
    latents_negatifs = _tracer_chaine(graphe, negatif, "7" if distille else "6")
    assert set(latents_positifs) == set(latents_negatifs) == set(encodes)
    # Le latent de départ ne change pas : ce n'est pas de l'img2img.
    assert graphe["13"]["inputs"]["latent_image"] == ["12", 0]
    assert graphe["12"]["class_type"] == "EmptyFlux2LatentImage"


@pytest.mark.parametrize("identifiant,distille", [("flux2-pixel", True), ("klein-pxart4", False)])
@pytest.mark.parametrize("nombre", [1, 2, 3])
def test_klein_garde_le_sujet_a_1_2_3_references(identifiant, distille, nombre):
    profil = _profil_installe(identifiant)
    refs = [f"ref-{i}.png" for i in range(nombre)]
    graphe = composer(profil, prompt="Un pèlerin", prompt_negatif="mauvaise qualité",
        resolution="512", proportions="1:1", graine=42, references=refs)
    _verifier_klein(graphe, distille=distille, nombre=nombre)


def test_klein_exemple_2_references_les_ids_exacts_du_gabarit():
    # Verrou explicite sur la numérotation relevée dans le gabarit officiel : la
    # tranche l'a écrite en toutes lettres, un essai la fige.
    profil = _profil_installe("flux2-pixel")
    graphe = composer(profil, prompt="Un pèlerin", resolution="512", proportions="1:1",
        graine=42, references=["a.png", "b.png"])
    assert graphe["16"] == {"class_type": "LoadImage", "inputs": {"image": "a.png"}}
    assert graphe["17"]["class_type"] == "ImageScaleToTotalPixels" and graphe["17"]["inputs"]["image"] == ["16", 0]
    assert graphe["18"] == {"class_type": "VAEEncode", "inputs": {"pixels": ["17", 0], "vae": ["3", 0]}}
    assert graphe["19"] == {"class_type": "LoadImage", "inputs": {"image": "b.png"}}
    assert graphe["21"] == {"class_type": "VAEEncode", "inputs": {"pixels": ["20", 0], "vae": ["3", 0]}}
    assert graphe["22"] == {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["5", 0], "latent": ["18", 0]}}
    assert graphe["23"] == {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["22", 0], "latent": ["21", 0]}}
    assert graphe["24"] == {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["7", 0], "latent": ["18", 0]}}
    assert graphe["25"] == {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["24", 0], "latent": ["21", 0]}}
    assert graphe["8"]["inputs"]["positive"] == ["23", 0] and graphe["8"]["inputs"]["negative"] == ["25", 0]


def test_klein_sans_reference_est_inchange_par_rapport_a_ml2():
    # Le graphe à 0 référence reste celui de ML2 — seule sa version change, en gagnant `variantes`.
    profil = _profil_installe("flux2-pixel")
    graphe = composer(profil, prompt="Un pèlerin", resolution="512", proportions="1:1", graine=42)
    assert graphe["8"]["inputs"]["positive"] == ["5", 0] and graphe["8"]["inputs"]["negative"] == ["7", 0]
    assert not any(v["class_type"] == "ReferenceLatent" for v in graphe.values())


def test_klein_trop_de_references_est_refuse():
    profil = _profil_installe("flux2-pixel")
    with pytest.raises(WorkflowRefuse, match="de 0 à 3 image"):
        composer(profil, prompt="x", resolution="512", proportions="1:1",
            references=["a.png", "b.png", "c.png", "d.png"])


# ── Z-Image, FLUX.1-dev, SDXL : partir de cette image ───────────────────────

@pytest.mark.parametrize("identifiant", STYLES_DEPART)
def test_le_graphe_a_une_reference_correspond_a_celui_de_sc_clone(identifiant):
    profil = _profil_installe(identifiant)
    graphe = composer(profil, prompt="Un pèlerin", prompt_negatif="mauvaise qualité",
        resolution="512", proportions="1:1", graine=42, references=["ref-0.png"])
    reference = GRAPHES_REFERENCE_DEPART[identifiant]
    assert set(graphe) == set(reference)
    for cle in graphe:
        notre_noeud, leur_noeud = graphe[cle], reference[cle]
        assert notre_noeud["class_type"] == leur_noeud["class_type"], cle
        assert set(notre_noeud["inputs"]) == set(leur_noeud["inputs"]), cle
        for champ, valeur in notre_noeud["inputs"].items():
            attendue = leur_noeud["inputs"][champ]
            if champ == "filename_prefix":
                continue
            if champ == "text" and valeur == "" and attendue != "":
                # Même écart volontaire que ML2 : le négatif ignoré (cfg 1) n'est
                # pas relié dans notre profil.
                continue
            assert valeur == attendue, (identifiant, cle, champ)


@pytest.mark.parametrize("identifiant", STYLES_DEPART)
def test_la_force_par_defaut_est_0_55_comme_sc_clone(identifiant):
    profil = _profil_installe(identifiant)
    assert profil["parametres"]["force"]["defaut"] == 0.55
    graphe = composer(profil, prompt="x", resolution="512", proportions="1:1", references=["ref-0.png"])
    sampler = next(v for v in graphe.values() if v["class_type"] in ("KSampler",) and "denoise" in v["inputs"]
        and v["inputs"]["denoise"] not in (0, 1))
    assert sampler["inputs"]["denoise"] == 0.55


@pytest.mark.parametrize("identifiant", STYLES_DEPART)
def test_la_force_est_reglable_et_bornee(identifiant):
    profil = _profil_installe(identifiant)
    graphe = composer(profil, prompt="x", resolution="512", proportions="1:1",
        references=["ref-0.png"], options={"force": 0.2})
    sampler = next(v for v in graphe.values() if v["class_type"] == "KSampler")
    assert sampler["inputs"]["denoise"] == 0.2
    with pytest.raises(WorkflowRefuse):
        composer(profil, prompt="x", resolution="512", proportions="1:1",
            references=["ref-0.png"], options={"force": 1.5})
    with pytest.raises(WorkflowRefuse):
        composer(profil, prompt="x", resolution="512", proportions="1:1",
            references=["ref-0.png"], options={"force": -0.1})


@pytest.mark.parametrize("identifiant", STYLES_DEPART)
def test_deux_references_sur_un_style_partir_de_cette_image_est_refuse(identifiant):
    profil = _profil_installe(identifiant)
    with pytest.raises(WorkflowRefuse, match="de 0 à 1 image"):
        composer(profil, prompt="x", resolution="512", proportions="1:1",
            references=["ref-0.png", "ref-1.png"])


async def test_deux_references_sur_un_style_depart_est_refuse_avant_la_file(atelier_styles):
    atelier, comfy = atelier_styles
    p = await atelier.styles_locaux.installer("zimage-pixel")
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    refs = [atelier.generations.importer(image_sujet(bloc=4 + i), f"Référence {i}", projet=projet)["asset"]["identifiant"] for i in range(2)]
    with pytest.raises(Exception, match="1 image"):
        await atelier.travaux_workflow.preparer(projet, {"cle": "trop-de-references", "modele": p["modele"],
            "prompt": "Un pèlerin", "repris": True, "resolution": "512",
            "references": refs})
    assert len(atelier.file_locale.lister()["etapes"]) == 0


# ── Le genre de référence, exposé ───────────────────────────────────────────

def test_le_genre_de_reference_est_porte_par_chaque_style():
    inv = inventaire(OBJECT_INFO)
    for e in STYLES:
        resolu = resoudre(e, inv)
        assert resolu["pret"]
        profil = normaliser(construire_profil(e, resolu["fichiers"]))
        attendu = "sujet" if e["famille"] == "klein" else "depart"
        assert profil["style"]["reference"] == attendu


async def test_lister_les_styles_dit_le_genre_de_reference(atelier_styles):
    atelier, comfy = atelier_styles
    styles = await atelier.styles_locaux.lister()
    klein = next(s for s in styles if s["identifiant"] == "flux2-pixel")
    depart = next(s for s in styles if s["identifiant"] == "zimage-pixel")
    assert klein["reference"] == "sujet" and depart["reference"] == "depart"


async def test_route_lister_les_styles_dit_le_genre_de_reference(atelier_styles):
    from fastapi.testclient import TestClient
    from atelier.api.app import creer_application

    atelier, comfy = atelier_styles
    client = TestClient(creer_application(atelier))
    styles = client.get("/api/workflow-profiles/styles").json()["styles"]
    klein = next(s for s in styles if s["identifiant"] == "flux2-pixel")
    depart = next(s for s in styles if s["identifiant"] == "zimage-pixel")
    assert klein["reference"] == "sujet" and depart["reference"] == "depart"


async def test_le_catalogue_relaie_le_genre_de_reference(atelier_styles):
    atelier, comfy = atelier_styles
    installe = await atelier.styles_locaux.installer("flux2-pixel")
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(installe["modele"])
    assert modele.reference == "sujet"


async def test_relire_avant_l_envoi_dit_ce_que_le_style_fait_d_une_image(tmp_path, double):
    from tests.test_a9 import AnimateurDouble
    from tests.test_au7_au8 import raccorder
    from tests.test_ml2 import ComfyStylesDouble
    from atelier.services import Atelier
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, ComfyStylesDouble())
    await atelier.ouvrir()
    try:
        klein = (await atelier.styles_locaux.installer("flux2-pixel"))["modele"]
        sdxl = (await atelier.styles_locaux.installer("sdxl-pixelart"))["modele"]
        await atelier.catalogue.rafraichir()
        projet = atelier.bibliotheque.courant
        lu = lambda m: atelier.envoi.envoi(projet=projet, sujet="a chest", modele=m)["modele"]
        assert (lu(klein)["reference"], lu(klein)["reference_nom"]) == ("sujet", "garder ce sujet")
        assert (lu(sdxl)["reference"], lu(sdxl)["reference_nom"]) == ("depart", "partir de cette image")
    finally:
        await atelier.file_locale.fermer()
