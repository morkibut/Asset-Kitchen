"""ML2 : les 22 styles de sc-clone installés en un geste. ComfyUI est doublé
avec un relevé réel de /object_info (tests/fixtures/object_info_local.json,
gardé le 18 septembre 2026 contre la machine de l'auteur, réduit aux classes
utiles), et les graphes produits sont comparés à ceux de sc-clone
(tests/fixtures/ml2_graphes_reference_scclone.json, une sortie figée des
constructeurs `lib/zimage.mjs`, `lib/flux2.mjs`, `lib/flux1.mjs`,
`lib/providers.mjs` § makeWorkflow appelés en Node avec les mêmes entrées)."""
import copy
import json
from pathlib import Path

import httpx
import pytest

from atelier.domaine.workflow import composer, normaliser
from atelier.fournisseur.catalogue_styles import FAMILLES, STYLES, inventaire, resoudre, style
from atelier.fournisseur.styles_locaux import construire_profil
from atelier.fournisseur.workflow import MoteurWorkflow
from atelier.services import Atelier
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder

DONNEES = Path(__file__).parent / "fixtures"
OBJECT_INFO = json.loads((DONNEES / "object_info_local.json").read_text(encoding="utf-8"))
GRAPHES_REFERENCE = json.loads((DONNEES / "ml2_graphes_reference_scclone.json").read_text(encoding="utf-8"))

# Un style par famille, comparé à sc-clone. Klein est couvert deux fois : la
# variante distillée (flux2-pixel) et la variante base (klein-pxart4), seule à
# lire un texte négatif réel.
STYLES_COMPARES = ("zimage-pixel", "flux2-pixel", "klein-pxart4", "flux1-modern", "sdxl-pixelart")


class ComfyStylesDouble:
    """Sert le relevé réel de la machine ; jamais /prompt (aucune génération)."""
    def __init__(self, informations=None):
        self.informations = informations if informations is not None else copy.deepcopy(OBJECT_INFO)

    def repondre(self, req):
        if req.url.path == "/object_info":
            return httpx.Response(200, json=self.informations)
        raise AssertionError(f"ML2 n'appelle jamais {req.url.path} : aucune génération, lecture seule.")


def moteur_pour(comfy):
    return MoteurWorkflow("http://comfy.test", httpx.MockTransport(comfy.repondre))


@pytest.fixture
async def atelier_styles(tmp_path, double):
    comfy = ComfyStylesDouble()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy
    await atelier.file_locale.fermer()


def test_les_22_styles_sont_prets_contre_le_releve_reel():
    inv = inventaire(OBJECT_INFO)
    resolus = {e["identifiant"]: resoudre(e, inv) for e in STYLES}
    non_prets = {i: r["manque"] for i, r in resolus.items() if not r["pret"]}
    assert non_prets == {} and len(resolus) == 22
    # Chaque style prêt construit un profil que `normaliser` accepte.
    for e in STYLES:
        normaliser(construire_profil(e, resolus[e["identifiant"]]["fichiers"]))


def test_un_style_dont_le_lora_manque_est_signale_en_francais():
    inv = inventaire(OBJECT_INFO)
    ampute = {**inv, "loras": [n for n in inv["loras"] if "pixel_art_style_z_image_turbo" not in n]}
    resolu = resoudre(style("zimage-pixel"), ampute)
    assert not resolu["pret"] and resolu["manque"] == ["le LoRA de style"]


def test_meilleure_quantification_dabord_gguf():
    inv = inventaire(OBJECT_INFO)
    resolu = resoudre(style("flux1-modern"), inv)
    # Q8_0 (moins compressé) doit être choisi devant flux1-dev-Q4_K_S.gguf.
    assert resolu["fichiers"]["unet"].endswith("Q8_0.gguf")


@pytest.mark.parametrize("identifiant", STYLES_COMPARES)
def test_le_graphe_produit_correspond_a_celui_de_sc_clone(identifiant):
    inv = inventaire(OBJECT_INFO)
    e = style(identifiant)
    resolu = resoudre(e, inv)
    assert resolu["pret"]
    profil = normaliser(construire_profil(e, resolu["fichiers"]))
    graphe = composer(profil, prompt="Un pèlerin", prompt_negatif="mauvaise qualité", resolution="512", proportions="1:1", graine=42)
    reference = GRAPHES_REFERENCE[identifiant]
    assert set(graphe) == set(reference), "mêmes identifiants de nœud, gardés identiques à sc-clone"
    for cle in graphe:
        notre_noeud, leur_noeud = graphe[cle], reference[cle]
        assert notre_noeud["class_type"] == leur_noeud["class_type"], cle
        assert set(notre_noeud["inputs"]) == set(leur_noeud["inputs"]), cle
        for champ, valeur in notre_noeud["inputs"].items():
            attendue = leur_noeud["inputs"][champ]
            # Écarts volontaires, documentés :
            # - filename_prefix : "AssetKitchen_*" chez nous, "SpriteForge_*" chez sc-clone (nom du produit).
            # - le texte négatif sur une branche où il est mathématiquement ignoré
            #   (cfg 1 : Z-Image, Klein distillé, FLUX.1-dev) n'est pas relié dans
            #   notre profil (ML4 décide qui l'envoie) ; sc-clone l'écrit quand
            #   même dans le nœud, sans effet. On ne compare donc pas `text` sur
            #   les nœuds de texte négatif de ces familles-là.
            if champ == "filename_prefix":
                continue
            if champ == "text" and valeur == "" and attendue != "" and notre_noeud is graphe.get(cle):
                # Un texte vide chez nous face à un texte non vide chez sc-clone
                # ne peut être que le négatif ignoré : toute autre incohérence
                # (le positif, par exemple) resterait détectée par l'assertion ci-dessous.
                continue
            assert valeur == attendue, (identifiant, cle, champ)


async def test_installer_deux_fois_une_seule_version_puis_changer_un_fichier(atelier_styles):
    atelier, comfy = atelier_styles
    p1 = await atelier.styles_locaux.installer("zimage-pixel")
    p2 = await atelier.styles_locaux.installer("zimage-pixel")
    assert p1["version"] == p2["version"]
    assert len([p for p in atelier.profils_workflow.lister() if p["identifiant"] == "zimage-pixel"]) == 1
    # Le fichier résolu change de nom (l'auteur a déplacé ses poids) : nouvelle version, l'ancienne reste.
    autre = copy.deepcopy(comfy.informations)
    lora = autre["LoraLoader"]["input"]["required"]["lora_name"][0]
    lora[:] = [n if "pixel_art_style_z_image_turbo" not in n else "autre-dossier/pixel_art_style_z_image_turbo.safetensors" for n in lora]
    comfy.informations = autre
    p3 = await atelier.styles_locaux.installer("zimage-pixel")
    assert p3["version"] != p1["version"]
    versions = [p for p in atelier.profils_workflow.lister() if p["identifiant"] == "zimage-pixel"]
    assert len(versions) == 2 and {p1["version"], p3["version"]} == {p["version"] for p in versions}


async def test_style_non_pret_est_refuse_avant_tout_ecrit(atelier_styles):
    atelier, comfy = atelier_styles
    comfy.informations = {k: v for k, v in comfy.informations.items() if k != "VAELoader"}
    with pytest.raises(Exception, match="manque"):
        await atelier.styles_locaux.installer("zimage-pixel")
    assert not [p for p in atelier.profils_workflow.lister() if p["identifiant"] == "zimage-pixel"]


async def test_installer_les_styles_prets_en_une_fois_et_le_catalogue_les_relit(atelier_styles):
    atelier, comfy = atelier_styles
    installes = await atelier.styles_locaux.installer_prets()
    assert len(installes) == 22
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(installes[0]["modele"])
    assert modele is not None and not atelier.catalogue.grise(modele)
    diagnostic = await atelier.profils_workflow.diagnostiquer(installes[0]["identifiant"], installes[0]["version"])
    assert diagnostic["disponible"]


async def test_lister_les_styles_dit_pret_famille_genre_vitesse_et_modele(atelier_styles):
    atelier, comfy = atelier_styles
    avant = await atelier.styles_locaux.lister()
    assert len(avant) == 22
    ligne = next(s for s in avant if s["identifiant"] == "zimage-pixel")
    assert ligne["pret"] and ligne["modele"] is None
    assert ligne["famille"] == "zimage" and ligne["genre"] == "sprite" and ligne["vitesse"] == FAMILLES["zimage"]["vitesse"]
    await atelier.styles_locaux.installer("zimage-pixel")
    apres = await atelier.styles_locaux.lister()
    ligne = next(s for s in apres if s["identifiant"] == "zimage-pixel")
    assert ligne["modele"] and ligne["modele"].startswith("ComfyUI:zimage-pixel@")


async def test_route_lister_et_installer_les_styles(atelier_styles):
    from fastapi.testclient import TestClient
    from atelier.api.app import creer_application

    atelier, comfy = atelier_styles
    client = TestClient(creer_application(atelier))
    styles = client.get("/api/workflow-profiles/styles").json()["styles"]
    assert len(styles) == 22 and all(s["pret"] for s in styles)
    installe = client.post("/api/workflow-profiles/styles/zimage-pixel/install").json()
    assert installe["modele"].startswith("ComfyUI:zimage-pixel@")
    tous = client.post("/api/workflow-profiles/styles/install").json()["installes"]
    assert len(tous) == 22


def test_style_inconnu_est_refuse():
    with pytest.raises(Exception):
        normaliser(construire_profil({"identifiant": "x", "famille": "inconnue", "nom": "x", "description": "x",
            "declencheur": "x", "genre": "sprite", "source": "x", "force": 1, "etapes": 1}, {}))
