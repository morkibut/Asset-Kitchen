# -*- coding: utf-8 -*-
"""PX7 : repeindre une zone avec chaque moteur local (`docs/PLAN-idees-pixellab.md`
§ PX7).

La technique de PX2 (`VAEEncode` + `SetLatentNoiseMask`, jamais
`VAEEncodeForInpaint`) doit servir avec les cinq familles du catalogue, pas
seulement SDXL. **On ne juge pas la qualité ici** : chaque outil se vérifie sur
sa forme (le graphe, le catalogue, le grisé) et sur son fonctionnement (il
part, il revient, rien ne bouge hors de la zone) — jamais sur ce qu'il dessine.

Deux essais de plus, promis par PX3bis et restés à écrire : un tirage servi
par le cache de ComfyUI n'entre pas dans le temps annoncé, et le fond d'une
zone écarte les teintes voisines d'une couleur nommée dans le texte.
"""
from __future__ import annotations

import pytest

from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.workflow import normaliser
from atelier.fournisseur.catalogue_styles import OUTILS, inventaire, resoudre, style
from atelier.fournisseur.styles_locaux import construire_profil
from atelier.services import Atelier
from atelier.services.evenements import Diffusion
from atelier.services.file_locale import ServiceFileLocale
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_px2_masque import object_info_zone
from tests.test_px3_zone import TETE, ComfyQuiRepeint, _importer
from tests.test_qwen21 import CLIP_INT8, UNET_INT8
from tests.test_qwen21 import VAE as QWEN_VAE

FAMILLES_ATTENDUES = {
    "sdxl-retouche-zone": "sdxl",
    "zimage-retouche-zone": "zimage",
    "klein-retouche-zone": "klein",
    "qwen21-retouche-zone": "qwen21",
    "flux1-retouche-zone": "flux1dev",
}


def object_info_toutes_familles(*, sans_flux1=False):
    """Le relevé réel (`OBJECT_INFO`), plus les deux nœuds du masque (PX2), plus
    ce que Qwen-Image 2.1 ajoute (`releve_avec_qwen21` de `test_qwen21.py`,
    recopié ici pour ne dépendre d'aucun état partagé). Le relevé porte déjà un
    modèle GGUF de FLUX.1-dev (`UnetLoaderGGUF`) : `sans_flux1` le retire, pour
    éprouver le grisé sur une machine qui ne l'a pas."""
    info = object_info_zone()
    info["UNETLoader"]["input"]["required"]["unet_name"][0].extend([UNET_INT8, "qwen_image_2.1_bf16.safetensors"])
    info["CLIPLoader"]["input"]["required"]["clip_name"][0].extend([CLIP_INT8, "qwen3vl_8b_bf16.safetensors"])
    info["VAELoader"]["input"]["required"]["vae_name"][0].append(QWEN_VAE)
    info["TextEncodeQwenImage21"] = {"input": {
        "required": {"clip": ["CLIP", {}], "prompt": ["STRING", {}], "negative_prompt": ["STRING", {}],
            "resolution": ["INT", {}]},
        "optional": {"vae": ["VAE", {}]}}}
    if sans_flux1:
        for noeud in ("UNETLoader", "UnetLoaderGGUF"):
            noms = info[noeud]["input"]["required"]["unet_name"][0]
            info[noeud]["input"]["required"]["unet_name"][0] = [n for n in noms if "flux1" not in n.lower()]
    return info


# ── Le catalogue : cinq outils, un par famille ───────────────────────────────


def test_un_outil_de_zone_par_famille_et_chacun_declare_la_liaison_masque():
    assert {o["identifiant"] for o in OUTILS} == set(FAMILLES_ATTENDUES)
    for identifiant, famille in FAMILLES_ATTENDUES.items():
        entree = style(identifiant)
        assert entree["famille"] == famille
        assert entree["zone"] is True
        resolu = resoudre(entree, inventaire(object_info_toutes_familles()))
        assert resolu["pret"], (identifiant, resolu["manque"])
        profil = normaliser(construire_profil(entree, resolu["fichiers"]))
        assert profil["liaisons"]["masque"]
        assert "reference:0" in profil["liaisons"]
        assert profil["references_min"] == profil["references_max"] == 1
        assert "option:force" in profil["liaisons"]
        assert profil["parametres"]["force"]["minimum"] == 0.5 and profil["parametres"]["force"]["maximum"] == 1
        classes = {n["class_type"] for n in profil["graphe"].values()}
        assert "SetLatentNoiseMask" in classes and "ImageToMask" in classes
        assert "VAEEncodeForInpaint" not in classes
        # Aucun latent vide ne subsiste : c'est l'image qui part dans le latent.
        assert "EmptyLatentImage" not in classes and "EmptySD3LatentImage" not in classes \
            and "EmptyFlux2LatentImage" not in classes


def test_klein_dose_le_bruit_par_split_sigmas_denoise_pas_un_champ_denoise():
    """FLUX.2 Klein n'a pas de `denoise` sur `SamplerCustomAdvanced` : c'est
    `SplitSigmasDenoise` qui en tient lieu, comme le banc PX1 l'avait trouvé."""
    entree = style("klein-retouche-zone")
    resolu = resoudre(entree, inventaire(object_info_toutes_familles()))
    assert resolu["pret"], resolu["manque"]
    profil = normaliser(construire_profil(entree, resolu["fichiers"]))
    classes = {n["class_type"] for n in profil["graphe"].values()}
    assert "SplitSigmasDenoise" in classes
    liaison = profil["liaisons"]["option:force"]
    noeud_force = profil["graphe"][liaison[0]["noeud"]]
    assert noeud_force["class_type"] == "SplitSigmasDenoise" and liaison[0]["champ"] == "denoise"
    sampler = next(n for n in profil["graphe"].values() if n["class_type"] == "SamplerCustomAdvanced")
    assert "denoise" not in sampler["inputs"]


def test_flux1_se_grise_quand_son_modele_de_base_manque():
    """Une machine sans le modèle de base de FLUX.1-dev (son LoRA pixel art
    est là, son GGUF ne l'est pas) : l'outil se grise avec sa raison plutôt que
    d'échouer à l'installation — jamais proposé puis refusé."""
    entree = style("flux1-retouche-zone")
    resolu = resoudre(entree, inventaire(object_info_toutes_familles(sans_flux1=True)))
    assert not resolu["pret"]
    assert "le modèle de base" in resolu["manque"]
    avec_poids = resoudre(entree, inventaire(object_info_toutes_familles(sans_flux1=False)))
    assert avec_poids["pret"], avec_poids["manque"]


def test_qwen21_zone_reprend_le_gabarit_qualite_pas_le_rapide():
    entree = style("qwen21-retouche-zone")
    assert entree["etapes"] == style("qwen21-qualite")["etapes"] == 30


# ── Le service : l'auteur choisit, un modèle absent ou incapable se grise ───


class ComfyQuiRepeintToutesFamilles(ComfyQuiRepeint):
    """Le même double que PX3, sauf sur un point : `ComfyZoneDouble.repondre`
    répond `/history/` avec le nœud de sortie **fixe** ("7", celui de SDXL) —
    juste pour les huit essais de PX2/PX3, qui n'en interrogent qu'un. PX7 en
    installe cinq, chacun avec son propre nœud de sortie (`sortie_noeud` dans
    `styles_locaux.py`) : celui-ci se lit sur le dernier graphe soumis, comme
    ComfyUI le ferait vraiment."""

    def repondre(self, req):
        import httpx

        if req.url.path.startswith("/history/"):
            numero = req.url.path.split("/")[-1]
            graphe = self.envois[-1]["prompt"]
            noeud = next(n for n, v in graphe.items() if v["class_type"] == "SaveImage")
            return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {noeud: {
                "images": [{"filename": "zone.png", "type": "output", "subfolder": ""}]}}}})
        return super().repondre(req)


@pytest.fixture
async def atelier_multi(tmp_path, double):
    comfy = ComfyQuiRepeintToutesFamilles()
    comfy.informations = object_info_toutes_familles(sans_flux1=False)
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy
    await atelier.file_locale.fermer()


async def _installer(atelier, identifiant):
    installe = await atelier.styles_locaux.installer(identifiant)
    await atelier.catalogue.rafraichir()
    return installe["modele"]


async def test_l_ecran_propose_un_outil_par_famille_et_les_modeles_installes(tmp_path, double):
    """Une machine où FLUX.1-dev manque son modèle de base : cinq outils
    proposés, trois installés, un incapable (sa raison), un prêt mais pas
    encore installé — les quatre situations que l'écran doit distinguer."""
    comfy = ComfyQuiRepeintToutesFamilles()
    comfy.informations = object_info_toutes_familles(sans_flux1=True)
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    try:
        image = _importer(atelier)
        modele_sdxl = await _installer(atelier, "sdxl-retouche-zone")
        modele_zimage = await _installer(atelier, "zimage-retouche-zone")
        modele_qwen = await _installer(atelier, "qwen21-retouche-zone")
        # klein-retouche-zone reste non installé : prêt, mais pas encore choisi.
        # flux1-retouche-zone ne peut pas l'être : son modèle de base manque.

        etat = await atelier.zone.etat(image)
        assert {o["identifiant"] for o in etat["outils"]} == set(FAMILLES_ATTENDUES)
        flux1 = next(o for o in etat["outils"] if o["identifiant"] == "flux1-retouche-zone")
        assert flux1["modele"] is None and not flux1["pret"] and "modèle de base" in " ".join(flux1["manque"])
        klein = next(o for o in etat["outils"] if o["identifiant"] == "klein-retouche-zone")
        assert klein["modele"] is None and klein["pret"]

        identifiants = {m["identifiant"] for m in etat["modeles"]}
        assert {modele_sdxl, modele_zimage, modele_qwen} <= identifiants
        assert all(m["raison"] is None for m in etat["modeles"] if m["identifiant"] in
                   {modele_sdxl, modele_zimage, modele_qwen})
        # Chacun porte son propre temps : ce n'est pas la vitesse de SDXL
        # prêtée aux quatre autres.
        vitesses = {m["identifiant"]: m["temps"] for m in etat["modeles"]}
        assert vitesses[modele_sdxl] != vitesses[modele_qwen] or vitesses[modele_sdxl]["vitesse"] != vitesses[modele_qwen]["vitesse"]
    finally:
        await atelier.file_locale.fermer()


async def test_l_auteur_choisit_le_modele_et_l_agent_aussi(atelier_multi):
    atelier, comfy = atelier_multi
    image = _importer(atelier)
    modele_sdxl = await _installer(atelier, "sdxl-retouche-zone")
    modele_zimage = await _installer(atelier, "zimage-retouche-zone")

    # Sans choix : le défaut du catalogue (le premier prêt, ici SDXL).
    generation = await atelier.zone.lancer(image, "a hat", TETE)
    await atelier.generations.attendre_tout()
    fini = atelier.zone.resultat(generation.identifiant)
    assert fini["calque"]["modele"] == modele_sdxl

    # Avec un choix explicite : Z-Image, pas le défaut.
    generation2 = await atelier.zone.lancer(image, "a hat", TETE, modele=modele_zimage)
    await atelier.generations.attendre_tout()
    fini2 = atelier.zone.resultat(generation2.identifiant)
    assert fini2["calque"]["modele"] == modele_zimage

    # Un identifiant qui ne sait pas repeindre une zone (ou n'existe pas) est
    # refusé avant la file, jamais résolu en silence vers un autre.
    avant = len(comfy.envois)
    with pytest.raises(DemandeRefusee, match="ne sait pas repeindre une zone"):
        await atelier.zone.lancer(image, "a hat", TETE, modele="rien-du-tout")
    assert len(comfy.envois) == avant  # rien n'est parti pour un refus


async def test_l_agent_peut_nommer_le_modele(atelier_multi):
    atelier, comfy = atelier_multi
    image = _importer(atelier)
    await _installer(atelier, "sdxl-retouche-zone")
    modele_zimage = await _installer(atelier, "zimage-retouche-zone")

    from atelier.mcp.serveur import creer_serveur
    serveur = creer_serveur(atelier)
    atelier.travaux.regler_cadre(atelier.bibliotheque.courant, {"autoriser_local": True})
    rendu = await serveur.call_tool("repaint_zone", {
        "asset_id": image, "prompt": "blue hair", "rectangles": [[4, 2, 11, 3]],
        "model": modele_zimage, "wait_seconds": 30,
    })
    assert not rendu.is_error, rendu
    charge = rendu.structured_content
    assert charge["status"] == "reussie", charge["reason"]
    fiche = atelier.zone.fiche(charge["layer_id"])
    assert fiche["modele"] == modele_zimage


async def test_ce_qui_part_ne_refuse_jamais_meme_avec_un_modele_inconnu(atelier_multi):
    atelier, comfy = atelier_multi
    image = _importer(atelier)
    await _installer(atelier, "sdxl-retouche-zone")
    assert atelier.zone.ce_qui_part(image, "a hat", "un-modele-qui-n-existe-pas") == {"texte": "", "negatif": "", "fond": ""}


# ── Un tirage réel par outil, par la même route qu'un calque ────────────────


@pytest.mark.parametrize("identifiant", sorted(FAMILLES_ATTENDUES))
async def test_un_tirage_par_outil_revient_sans_rien_toucher_hors_zone(identifiant, atelier_multi):
    """Le critère du plan, doublé : chaque outil part, revient, et ne touche
    rien hors de la zone peinte — jamais un jugement de qualité."""
    atelier, comfy = atelier_multi
    image = _importer(atelier)
    modele = await _installer(atelier, identifiant)
    generation = await atelier.zone.lancer(image, "blue spiky hair", TETE)
    await atelier.generations.attendre_tout()
    fini = atelier.zone.resultat(generation.identifiant)
    assert fini["statut"] == "reussie", fini["raison"]
    assert fini["calque"]["modele"] == modele
    assert fini["calque"]["mesures"]["pixels_hors_zone"] == 0
    assert fini["calque"]["mesures"]["pixels_du_sujet_perdus"] == 0


# ── PX3bis, essai manquant n°1 : le cache n'est pas une mesure de temps ─────


@pytest.fixture
async def file(tmp_path):
    from atelier.depot import Fichiers
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()
    service = ServiceFileLocale(fichiers, Diffusion())

    async def disponible():
        return {"etat": "disponible", "travaux": [], "temperature": "inconnue"}
    service.inscrire_moteur("moteur-test", "Moteur doublé", disponible)
    yield service
    await service.fermer()


async def test_un_tirage_du_cache_ne_compte_pas_dans_le_temps_mesure(file):
    """PX3bis (`docs/PLAN-idees-pixellab.md` § PX3bis) : un tirage que ComfyUI
    a resservi depuis son cache (`execution_cached`, `resultat["cache"]`,
    `FournisseurWorkflowImage._executer`) n'a rien coûté en temps de carte
    graphique — `ServiceFileLocale._executer` écrit alors `duree_s=None`, et un
    tel tirage n'entre jamais dans la médiane du bouton."""

    async def executer_normal(etape):
        return {"reussie": True}

    async def executer_depuis_le_cache(etape):
        return {"reussie": True, "cache": True}

    file.inscrire_executeur("image", executer_normal)
    normal = file.preparer("normal", nature="image", moteur="moteur-test", modele="essai:m",
        projet="jeu", acteur="auteur", parametres={}, entree=b"e")
    await file.lancer(normal["identifiant"])
    await file.attendre_fin(normal["identifiant"])
    assert file.lire(normal["identifiant"])["duree_s"] is not None

    file._executeurs["image"] = executer_depuis_le_cache
    cache = file.preparer("cache", nature="image", moteur="moteur-test", modele="essai:m",
        projet="jeu", acteur="auteur", parametres={}, entree=b"e")
    await file.lancer(cache["identifiant"])
    await file.attendre_fin(cache["identifiant"])
    etape = file.lire(cache["identifiant"])
    assert etape["etat"] == "termine" and etape["resultat"]["cache"] is True
    assert etape["duree_s"] is None

    mesures = file.mesures()
    (groupe,) = [m for m in mesures if m["moteur"] == "moteur-test"]
    assert groupe["mesures"] == 1  # le tirage normal seul ; le tirage du cache ne compte pas


# ── PX3bis, essai manquant n°2 : le fond écarte les teintes voisines ────────


def test_le_fond_d_une_zone_ecarte_le_cyan_pour_une_demande_de_bleu():
    """PX3bis : une coiffure demandée bleue est revenue rouge sur le vrai
    moteur parce que le cyan — maximalement loin en distance de Tchebychev —
    est aussi la teinte la plus voisine du bleu (60°). `choisir_pour_une_zone`
    écarte tout candidat à moins de 65° d'une couleur nommée, **avant** le
    calcul de distance."""
    from atelier.domaine.fond import CANDIDATS, SEUIL_TEINTES_VOISINES, _teintes_voisines, choisir_pour_une_zone

    assert _teintes_voisines("#00FFFF", "#0000FF") is True  # cyan et bleu, 60° d'écart
    assert _teintes_voisines("#00FF00", "#0000FF") is False  # vert et bleu, hors du seuil

    peau = ["#C8967A", "#6E4A3A", "#808080"]
    choix = choisir_pour_une_zone(peau, "a blue spiky hairstyle")
    assert choix.couleur != "#00FFFF"
    assert all(not _teintes_voisines(c.couleur, "#0000FF", SEUIL_TEINTES_VOISINES) or c.couleur != choix.couleur
               for c in CANDIDATS)


def test_le_fond_ne_perd_aucun_candidat_quand_rien_n_est_demande():
    """Sans couleur nommée, `choisir_pour_une_zone` retombe sur le choix
    ordinaire — la réparation ne change rien à ce cas-là."""
    from atelier.domaine.fond import choisir, choisir_pour_une_zone

    peau = ["#C8967A", "#6E4A3A"]
    assert choisir_pour_une_zone(peau, "a hat").couleur == choisir(peau).couleur
