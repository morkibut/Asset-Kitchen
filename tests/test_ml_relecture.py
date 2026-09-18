"""Relecture du chantier des moteurs locaux (18/09/2026) : défauts 2, 4, 7 et 9
côté serveur (`docs/PLAN-moteurs-locaux.md`, décisions 3 et 5). ComfyUI est
doublé comme dans ML2/ML3, aucune génération réelle n'est lancée sauf mention
contraire."""
import copy

import pytest

from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, inventaire
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import OBJECT_INFO, ComfyStylesDouble, atelier_styles, moteur_pour  # noqa: F401


class _ComfyComptePartage(ComfyStylesDouble):
    """Même double que ML2, un compteur de `/object_info` en plus — posé sur le
    même `atelier` par un second `raccorder`, sans changer les profils déjà
    écrits sur le disque (défaut 9b)."""

    def __init__(self, informations):
        super().__init__(informations)
        self.appels_object_info = 0

    def repondre(self, req):
        if req.url.path == "/object_info":
            self.appels_object_info += 1
        return super().repondre(req)


# ── Défaut 2 : une option de réglage local, lue avant `composer` ────────────


async def test_une_chaine_numerique_est_convertie_avant_composer(atelier_styles):
    atelier, comfy = atelier_styles
    installe = await atelier.styles_locaux.installer("sdxl-pixelart")
    profil = atelier.profils_workflow.de_modele(installe["modele"])
    fournisseur = atelier.fournisseur_workflow_image
    # Le curseur HTML envoie toujours une chaîne (`e.target.value`) : elle est
    # convertie avant `composer`, pas rejetée.
    assert fournisseur._options_locales(profil, {"force": "0.3"}, 1) == {"force": 0.3}


async def test_une_chaine_non_numerique_reste_refusee_clairement(atelier_styles):
    atelier, comfy = atelier_styles
    installe = await atelier.styles_locaux.installer("sdxl-pixelart")
    profil = atelier.profils_workflow.de_modele(installe["modele"])
    fournisseur = atelier.fournisseur_workflow_image
    with pytest.raises(WorkflowRefuse, match="force.*nombre"):
        fournisseur._options_locales(profil, {"force": "beaucoup"}, 1)


async def test_force_sans_reference_jointe_est_ignoree_pas_validee(atelier_styles):
    atelier, comfy = atelier_styles
    installe = await atelier.styles_locaux.installer("sdxl-pixelart")
    profil = atelier.profils_workflow.de_modele(installe["modele"])
    fournisseur = atelier.fournisseur_workflow_image
    # `force` est propre aux références (`reference_seule`) : le graphe à 0
    # référence ne la relie nulle part. Une valeur — même absurde — ne doit
    # plus faire échouer une génération sans image à cause d'un réglage inerte.
    assert fournisseur._options_locales(profil, {"force": "beaucoup"}, 0) == {}
    assert fournisseur._options_locales(profil, {"force": 99}, 0) == {}
    # Avec une référence jointe, le même réglage redevient actif et validé.
    assert fournisseur._options_locales(profil, {"force": "0.3"}, 1) == {"force": 0.3}
    with pytest.raises(WorkflowRefuse):
        fournisseur._options_locales(profil, {"force": "beaucoup"}, 1)


# ── Défaut 4a : le catalogue ne publie qu'une version par style ─────────────


async def test_le_catalogue_ne_publie_quune_version_par_style(atelier_styles):
    atelier, comfy = atelier_styles
    p1 = await atelier.styles_locaux.installer("zimage-pixel")
    autre = copy.deepcopy(comfy.informations)
    lora = autre["LoraLoader"]["input"]["required"]["lora_name"][0]
    lora[:] = [n if "pixel_art_style_z_image_turbo" not in n else "autre-dossier/pixel_art_style_z_image_turbo.safetensors" for n in lora]
    comfy.informations = autre
    p2 = await atelier.styles_locaux.installer("zimage-pixel")
    assert p1["version"] != p2["version"]
    assert len([p for p in atelier.profils_workflow.lister() if p["identifiant"] == "zimage-pixel"]) == 2

    modeles = await atelier.fournisseur_workflow_image.catalogue()
    versions_zimage = [m for m in modeles if m.identifiant.startswith("ComfyUI:zimage-pixel@")]
    # Une seule entrée dans le catalogue, même si deux versions existent sur le
    # disque — la dernière installée (p2), pas forcément la plus récente par
    # hasard de tri.
    assert len(versions_zimage) == 1
    assert versions_zimage[0].identifiant == p2["modele"]
    # L'ancienne reste lisible directement : les générations passées la
    # nomment encore.
    assert atelier.profils_workflow.de_modele(p1["modele"])["version"] == p1["version"]


# ── Défaut 4b : la version en service suit la dernière installation ────────


async def test_reinstaller_a_b_a_remet_a_en_service(atelier_styles):
    atelier, comfy = atelier_styles
    a = await atelier.styles_locaux.installer("zimage-pixel")

    autre = copy.deepcopy(comfy.informations)
    lora = autre["LoraLoader"]["input"]["required"]["lora_name"][0]
    lora[:] = [n if "pixel_art_style_z_image_turbo" not in n else "autre-dossier/pixel_art_style_z_image_turbo.safetensors" for n in lora]
    comfy.informations = autre
    b = await atelier.styles_locaux.installer("zimage-pixel")
    assert b["version"] != a["version"]

    # b est la plus récente par `cree_le` : sans marqueur, elle serait en
    # service.
    lignes = await atelier.styles_locaux.lister()
    assert next(s for s in lignes if s["identifiant"] == "zimage-pixel")["modele"] == b["modele"]

    # Réinstaller A (fichiers redevenus ceux d'origine) ne réécrit rien (même
    # version déjà connue) mais doit remettre A en service.
    comfy.informations = copy.deepcopy(OBJECT_INFO)
    a_de_nouveau = await atelier.styles_locaux.installer("zimage-pixel")
    assert a_de_nouveau["version"] == a["version"]

    lignes = await atelier.styles_locaux.lister()
    assert next(s for s in lignes if s["identifiant"] == "zimage-pixel")["modele"] == a["modele"]

    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(a["modele"])
    assert modele is not None and not atelier.catalogue.grise(modele)
    # b n'est plus proposé dans le catalogue (une seule version par style) —
    # mais reste lisible directement, par `profils_workflow.de_modele`.
    from atelier.domaine.erreurs import ModeleInconnu
    with pytest.raises(ModeleInconnu):
        atelier.catalogue.modele(b["modele"])
    assert atelier.profils_workflow.de_modele(b["modele"])["version"] == b["version"]


async def test_version_en_service_sans_marqueur_replie_sur_la_plus_recente(atelier_styles):
    """Un profil importé à la main (jamais passé par `styles_locaux.installer`)
    n'a pas de marqueur : le repli reste « la plus récente par `cree_le` »,
    comme avant cette règle."""
    atelier, comfy = atelier_styles
    assert atelier.profils_workflow.version_en_service("un-style-jamais-installe") is None


# ── Défaut 7 : `inventaire` lit aussi la forme COMBO ─────────────────────────


def test_inventaire_lit_la_forme_combo_avec_options():
    informations = {
        "LoraLoader": {"input": {"required": {"lora_name": ["COMBO", {"options": ["a.safetensors", "b.safetensors"]}]}}},
        "CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": [["sd_xl_base.safetensors"]]}}},
    }
    inv = inventaire(informations)
    assert inv["loras"] == ["a.safetensors", "b.safetensors"]
    assert inv["checkpoints"] == ["sd_xl_base.safetensors"]


def test_inventaire_combo_sans_options_rend_une_liste_vide():
    informations = {"LoraLoader": {"input": {"required": {"lora_name": ["COMBO", {}]}}}}
    assert inventaire(informations)["loras"] == []


# ── Défaut 9a : klein n'exige plus SplitSigmasDenoise ────────────────────────


def test_klein_n_exige_plus_split_sigmas_denoise():
    assert "SplitSigmasDenoise" not in FAMILLES["klein"]["noeuds"]


# ── Défaut 9b : un seul GET /object_info par rafraîchissement ───────────────


async def test_un_seul_object_info_pour_tout_le_rafraichissement(atelier_styles):
    atelier, comfy = atelier_styles
    await atelier.styles_locaux.installer("zimage-pixel")
    await atelier.styles_locaux.installer("flux2-pixel")
    await atelier.styles_locaux.installer("sdxl-pixelart")

    # Seul `fabrique_moteur` change — pas un second `raccorder`, qui ajouterait
    # une seconde fois le fournisseur local à la liste et fausserait le compte.
    compteur = _ComfyComptePartage(comfy.informations)
    fabrique = lambda: moteur_pour(compteur)
    atelier.fournisseur_workflow_image.fabrique_moteur = fabrique
    await atelier.catalogue.rafraichir()
    assert compteur.appels_object_info == 1


# ── Défaut 9c : list_models MCP donne le temps d'un style local ────────────


async def test_list_models_mcp_donne_le_temps_d_un_style_local(atelier_styles):
    from atelier.mcp.serveur import creer_serveur
    from tests.test_t7 import appeler

    atelier, comfy = atelier_styles
    installe = await atelier.styles_locaux.installer("zimage-pixel")
    await atelier.catalogue.rafraichir()
    mcp = creer_serveur(atelier)
    modeles = {m["id"]: m for m in (await appeler(mcp, "list_models"))["models"]}
    modele = modeles[installe["modele"]]
    assert modele["expected_time"] == atelier.generations.temps_attendu(installe["modele"])
    assert modele["expected_time"]["vitesse"] == FAMILLES["zimage"]["vitesse"]
    # Un modèle distant n'a pas ce champ.
    distant = next(m for m in modeles.values() if "local" not in m)
    assert "expected_time" not in distant
