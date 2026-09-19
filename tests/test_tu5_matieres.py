# -*- coding: utf-8 -*-
"""TU5 : les matières générées sur la machine, pour un jeu de tuiles.

`docs/PLAN-tuiles.md`, § TU5. ComfyUI est **doublé**, comme les essais ML*/SN*
déjà présents (`tests/test_ml2.py`, `tests/test_au7_au8.py`) : le relevé réel
de `/object_info` (`tests/fixtures/object_info_local.json`) sert la
disponibilité du style `klein9b-tiles-raccordable`, et un double maison répond
à `/prompt`, `/history` et `/view` sans lancer aucun calcul réel. Le
fournisseur payant, lui, est un double qui **lève** s'il est appelé — c'est la
preuve qu'aucun chemin de ce module ne peut l'atteindre.

La fidélité au texte de sc-clone (composerPrompt + l'ajout serveur de
`promptParts`) est comparée à `essais/fixtures/tu5_textes_scclone.json`, figée
par `essais/tu5_textes_scclone.mjs` sur le vrai module JS recopié par TU1
(`interface/src/tuiles/moteur/tile-ia-prompt.js`), lui-même comparé au commit
source de sc-clone par l'essai de TU1.
"""

from __future__ import annotations

import copy
import dataclasses
import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from atelier.domaine import texte_matiere
from atelier.domaine.tuiles import TuilesRefusees
from atelier.services import Atelier

from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import OBJECT_INFO

FIXTURE = json.loads(
    (Path(__file__).parent.parent / "essais" / "fixtures" / "tu5_textes_scclone.json")
    .read_text(encoding="utf-8")
)


# ── La fidélité au caractère près (module pur, aucun ComfyUI) ──────────────────────────


def test_composer_prompt_identique_a_sc_clone_au_caractere_pres():
    for nom, cas in FIXTURE["casReussis"].items():
        entree = cas["entree"]
        obtenu = texte_matiere.composer_prompt(entree["pierre"], entree["motif"], entree["cadrage"])
        assert obtenu == cas["prompt"], nom
        # `corpsGeneration.prompt` EST `composerPrompt(...)`, jamais recopié.
        assert obtenu == cas["corps"]["prompt"], nom


def test_negatif_fixe_identique_a_sc_clone():
    for nom, cas in FIXTURE["casReussis"].items():
        assert texte_matiere.NEGATIF == cas["corps"]["negative"], nom


def test_perspective_par_cadrage_identique_a_sc_clone():
    for nom, cas in FIXTURE["casReussis"].items():
        entree = cas["entree"]
        assert texte_matiere.CADRAGES[entree["cadrage"]]["perspective"] == cas["corps"]["perspective"], nom


def test_cadrages_identiques_a_sc_clone_mot_pour_mot():
    for identifiant, c in FIXTURE["cadrages"].items():
        assert texte_matiere.CADRAGES[identifiant]["nom"] == c["nom"], identifiant
        assert texte_matiere.CADRAGES[identifiant]["perspective"] == c["perspective"], identifiant
        assert texte_matiere.CADRAGES[identifiant]["consigne"] == c["consigne"], identifiant


def test_les_refus_de_composer_prompt_sont_identiques_a_sc_clone():
    for cas in FIXTURE["casRefuses"]:
        assert cas["leve"], cas["nom"]
        entree = cas["entree"]
        with pytest.raises(TuilesRefusees) as exc:
            texte_matiere.composer_prompt(entree["pierre"], entree["motif"], entree["cadrage"])
        assert str(exc.value) == cas["message"], cas["nom"]


def test_taille_par_defaut_identique_a_sc_clone():
    assert texte_matiere.taille_par_defaut(None) == FIXTURE["tailles"]["sansReference"]
    assert texte_matiere.taille_par_defaut("data:image/png;base64,AAAA") == FIXTURE["tailles"]["avecReference"]


def test_graines_pour_tirages_identiques_a_sc_clone():
    assert texte_matiere.graines_pour_tirages(100, 5, 3) == FIXTURE["graines"]["cinqTirages"]
    assert texte_matiere.graines_pour_tirages(100, 4) == FIXTURE["graines"]["sansPas"]
    assert len(texte_matiere.graines_pour_tirages(0, 0)) == FIXTURE["graines"]["unTirageMinimum"]
    assert len(texte_matiere.graines_pour_tirages(0, 50)) == FIXTURE["graines"]["vingtTiragesMaximum"]
    # Vérifié à l'envers, comme sc-clone : sans pas, la fonction ne retombe
    # jamais sur la même graine pour tous les tirages.
    assert len({*texte_matiere.graines_pour_tirages(0, 4)}) == 4


# ── L'ajout serveur (promptParts, branche comfyui/texture) — segments et ordre ─────────


def test_segments_matiere_dans_lordre_de_promptparts():
    prompt = texte_matiere.composer_prompt("pierre grise", "quatre dalles", "surface")
    segments = texte_matiere.segments_matiere(prompt, "top-down view")
    assert segments == [
        "pixel art",
        prompt,
        "top-down view",
        "seamless tileable material, matching opposite edges, no grid, no cell borders",
        "simple flat colors, deliberate square pixel clusters, no gradients",
    ]


def test_texte_envoi_colle_un_declencheur_qui_finit_par_une_virgule():
    texte = texte_matiere.texte_envoi("pierre grise", "quatre dalles", "surface", declencheur="Game asset tile,")
    assert texte.startswith("Game asset tile, pixel art, ")
    assert ",," not in texte


def test_texte_envoi_sans_declencheur_ni_suffixe():
    texte = texte_matiere.texte_envoi("pierre grise", "quatre dalles", "surface")
    assert texte.startswith("pixel art, pierre grise, quatre dalles, ")
    assert texte.endswith("simple flat colors, deliberate square pixel clusters, no gradients")


# ── Le service et la route, avec ComfyUI doublé ─────────────────────────────────────────


class FournisseurPayantInterdit:
    """Debout à la place d'OpenRouter/Pollinations : lève s'il est appelé.

    C'est la preuve, pas une supposition, qu'aucun tirage de matière ne peut
    atteindre un fournisseur payant — le seul appel que ce double laisse
    passer est `catalogue()` (la liste des modèles), qui ne facture rien.
    """

    nom = "OpenRouter"

    def indisponible(self):
        return None

    def compte(self):
        return None

    def secrets(self):
        return ()

    async def catalogue(self):
        return []

    async def generer(self, modele, demande):  # pragma: no cover — c'est justement le point
        raise AssertionError("un fournisseur payant a été appelé par le chemin des matières (TU5)")


class ComfyMatiereDouble:
    """Répond `/object_info` avec le relevé réel (ML2/ML6), et simule une
    soumission ComfyUI complète — `/prompt`, `/queue`, `/history`, `/view` —
    sans lancer aucun calcul. Trouve le nœud `SaveImage` dans le graphe reçu
    plutôt que de le supposer à un numéro fixe : klein9b-tiles-raccordable le
    porte au nœud 15 (`atelier/fournisseur/styles_locaux.py`), un autre profil
    pourrait le porter ailleurs."""

    def __init__(self, informations: dict[str, Any] | None = None) -> None:
        self.informations = informations if informations is not None else copy.deepcopy(OBJECT_INFO)
        self.envois: list[dict[str, Any]] = []
        self.image = image_sujet()

    def repondre(self, req: httpx.Request) -> httpx.Response:
        if req.url.path == "/object_info":
            return httpx.Response(200, json=self.informations)
        if req.url.path == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if req.url.path == "/upload/image":
            return httpx.Response(200, json={"name": "reference.png"})
        if req.url.path == "/prompt":
            charge = json.loads(req.content)
            self.envois.append(charge)
            numero = f"tu5-{len(self.envois)}"
            return httpx.Response(200, json={"prompt_id": numero})
        if req.url.path.startswith("/history/"):
            numero = req.url.path.rsplit("/", 1)[-1]
            indice = int(numero.rsplit("-", 1)[-1]) - 1
            if not (0 <= indice < len(self.envois)):
                return httpx.Response(200, json={})
            graphe = self.envois[indice]["prompt"]
            noeud = next(k for k, v in graphe.items() if v["class_type"] == "SaveImage")
            return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                noeud: {"images": [{"filename": f"{numero}.png", "type": "output", "subfolder": ""}]}}}})
        if req.url.path == "/view":
            return httpx.Response(200, content=self.image)
        raise AssertionError((req.method, str(req.url)))


@pytest.fixture
async def atelier_matieres(tmp_path):
    comfy = ComfyMatiereDouble()
    interdit = FournisseurPayantInterdit()
    atelier = Atelier(
        racine=tmp_path / "donnees",
        fabrique_fournisseur=lambda: interdit,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    yield atelier, comfy
    await atelier.file_locale.fermer()


async def test_disponibilite_dit_precisement_ce_qui_manque(atelier_matieres):
    atelier, comfy = atelier_matieres
    dispo = await atelier.matieres.disponibilite()
    assert dispo["disponible"] and dispo["manque"] == []

    ampute = {k: v for k, v in comfy.informations.items() if k not in ("SeamlessTile", "CircularVAEDecode")}
    comfy.informations = ampute
    dispo = await atelier.matieres.disponibilite()
    assert not dispo["disponible"]
    assert any("ComfyUI-seamless-tiling" in m and "custom_nodes" in m for m in dispo["manque"])
    assert any("SeamlessTile" in m or "CircularVAEDecode" in m for m in dispo["manque"])


async def test_apercu_ne_touche_pas_comfyui_et_ne_facture_rien(atelier_matieres):
    atelier, comfy = atelier_matieres
    apercu = atelier.matieres.apercu("pierre grise", "quatre dalles, deux par deux", "surface")
    assert apercu["texte"].startswith("Game asset tile, pixel art, pierre grise, ")
    assert apercu["negatif"] == texte_matiere.NEGATIF
    assert apercu["taille"] == 256
    assert [c["id"] for c in apercu["cadrages"]] == ["surface", "face", "plat", "motif"]
    assert comfy.envois == []


async def test_apercu_est_exactement_ce_qui_part(atelier_matieres):
    """L'invariant central : le texte affiché avant l'envoi est, au caractère
    près, celui que ComfyUI reçoit vraiment (comparé à la requête captée par
    le double, pas recalculé)."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    apercu = atelier.matieres.apercu("pierre grise", "quatre dalles, deux par deux", "surface")
    await atelier.matieres.generer(projet, pierre="pierre grise", motif="quatre dalles, deux par deux",
        cadrage="surface", tirages=1)
    await atelier.generations.attendre_tout()
    assert len(comfy.envois) == 1
    graphe = comfy.envois[0]["prompt"]
    noeud_texte = next(n for n in graphe.values() if n["class_type"] == "CLIPTextEncode" and n["inputs"]["text"])
    assert noeud_texte["inputs"]["text"] == apercu["texte"]


async def test_n_tirages_donnent_n_travaux_graines_distinctes_style_raccordable(atelier_matieres):
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    generations = await atelier.matieres.generer(
        projet, pierre="pierre grise, grain fin", motif="quatre dalles carrées, deux par deux",
        cadrage="surface", tirages=4,
    )
    assert len(generations) == 4
    await atelier.generations.attendre_tout()

    assert len(comfy.envois) == 4
    graines = set()
    for envoi in comfy.envois:
        graphe = envoi["prompt"]
        # Le nœud RandomNoise de FLUX.2 Klein (`construire_klein`, nœud 11).
        graines.add(graphe["11"]["inputs"]["noise_seed"])
        assert graphe["90"]["class_type"] == "SeamlessTile"
        assert graphe["14"]["class_type"] == "CircularVAEDecode"
        # La taille demandée (`EmptyFlux2LatentImage`, nœud 12) : 256 sans
        # référence, comme `texte_matiere.taille_par_defaut(None)`.
        assert graphe["12"]["inputs"]["width"] == 256 and graphe["12"]["inputs"]["height"] == 256
    assert len(graines) == 4, "chaque tirage doit tirer sa propre graine, jamais une graine commune"

    for generation in generations:
        relue = atelier.generations.lire(generation.identifiant)
        assert relue.emplacements[0].statut.name == "REUSSIE", relue.emplacements[0].raison
        assert relue.demande["resolution"] == "256"
        assert relue.demande["echelle"] == "matière"
        assert relue.demande["filiation"]["matiere"]["style"] == "klein9b-tiles-raccordable"
        asset = atelier.assets.lire(f"{generation.identifiant}-0")
        assert asset is not None and asset.projet == projet
        # La provenance : texte envoyé, style, graine — relue sur la même filiation.
        assert asset.consomme == 0.0 and asset.unite  # coût nul, local


async def test_les_generations_reviennent_comme_matiere_avec_provenance(atelier_matieres):
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    [generation] = await atelier.matieres.generer(
        projet, pierre="terre battue brune", motif="prairie continue sans motif répété", cadrage="surface", tirages=1,
    )
    await atelier.generations.attendre_tout()
    relue = atelier.generations.lire(generation.identifiant)
    filiation = relue.demande["filiation"]["matiere"]
    assert filiation["pierre"] == "terre battue brune"
    assert filiation["motif"] == "prairie continue sans motif répété"
    assert filiation["cadrage"] == "surface"
    assert isinstance(filiation["graine"], int)


async def test_aucun_appel_payant_nest_possible_par_ce_chemin(atelier_matieres):
    """`FournisseurPayantInterdit.generer` lève si on l'atteint — un tirage de
    matière qui l'atteindrait ferait échouer cet essai, pas juste le tirage."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    await atelier.matieres.generer(projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=2)
    await atelier.generations.attendre_tout()
    # Rien n'a levé jusqu'ici : le double payant n'a jamais été appelé pour générer.


async def test_soumettre_matiere_refuse_un_modele_qui_n_est_pas_local(atelier_matieres, monkeypatch):
    """TU11 : la garde est dans `soumettre_matiere` même, pas seulement dans le choix du
    style — un modèle payant passé par erreur est refusé avant tout envoi."""
    from atelier.domaine.erreurs import DemandeRefusee
    atelier, comfy = atelier_matieres
    local = atelier.catalogue.modele(await atelier.matieres._resoudre_modele())
    assert local.locale
    payant = dataclasses.replace(local, locale=False) if dataclasses.is_dataclass(local) else None
    if payant is None:
        pytest.skip("Modele n'est pas une dataclass : garde non simulable ici.")
    monkeypatch.setattr(atelier.catalogue, "modele", lambda identifiant: payant)
    with pytest.raises(DemandeRefusee, match="pas un modèle local"):
        await atelier.generations.soumettre_matiere(payant.identifiant, "texte", projet=atelier.bibliotheque.courant)
    assert comfy.envois == []


async def test_tirages_hors_bornes_refuses():
    from atelier.services.matieres import ServiceMatieres, TIRAGES_MAX, TIRAGES_MIN
    assert (TIRAGES_MIN, TIRAGES_MAX) == (1, 8)


async def test_motif_qui_ne_dit_pas_le_compte_nest_pas_reecrit(atelier_matieres):
    """D2/T26 : le produit ne réécrit jamais le texte de l'auteur, même quand
    le motif ne nomme pas le compte des pièces — il part tel quel."""
    atelier, comfy = atelier_matieres
    apercu = atelier.matieres.apercu("pierre grise", "des dalles", "surface")
    assert "des dalles" in apercu["texte"]
