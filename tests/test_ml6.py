"""ML6 : la texture raccordable. Deux styles portent `raccordable: True` —
`sdxl-tileable` (recopié tel quel de sc-clone, `lib/catalog.mjs`) et
`klein9b-tiles-raccordable` (ajouté par construction : sc-clone n'a pas
d'équivalent sur Klein, mais le raccord (`lib/seamless.mjs`) est générique aux
quatre familles d'après son propre commentaire). Un seul choix pour porter
l'option : un style séparé, pas un paramètre du profil — un graphe ComfyUI ne
peut pas brancher ou débrancher des nœuds selon une valeur.

`sdxl-tileable` est comparé structurellement à la sortie de sc-clone
(`tests/fixtures/ml6_graphe_reference_scclone.json`, une sortie figée de
`makeWorkflow` appelé en Node avec `tileable: true`, même méthode que ML2/ML3).
sc-clone y numérote le nœud du raccord `14` (un numéro libre chez lui, pour son
seul SDXL) ; le nôtre porte toujours `90`, le défaut de `applySeamless` — la
comparaison remonte donc ce seul numéro avant de comparer le reste à l'identique.
"""
import copy
import json
from pathlib import Path

import pytest

from atelier.domaine.workflow import WorkflowRefuse, composer, graphes, normaliser
from atelier.fournisseur.catalogue_styles import inventaire, resoudre, style
from atelier.fournisseur.styles_locaux import (
    _DECODE_RACCORD, _ENTREES_MODELE_RACCORD, _ID_RACCORD, construire_profil,
)
from tests.test_ml2 import OBJECT_INFO, atelier_styles  # noqa: F401

DONNEES = Path(__file__).parent / "fixtures"
GRAPHE_REFERENCE_SDXL_TILEABLE = json.loads((DONNEES / "ml6_graphe_reference_scclone.json").read_text(encoding="utf-8"))["sdxl-tileable"]

STYLES_RACCORDABLES = ("sdxl-tileable", "klein9b-tiles-raccordable")
NOEUDS_RACCORD = ("SeamlessTile", "CircularVAEDecode")


def _profil_installe(identifiant, informations=None):
    inv = inventaire(informations if informations is not None else OBJECT_INFO)
    e = style(identifiant)
    resolu = resoudre(e, inv)
    assert resolu["pret"], resolu["manque"]
    return normaliser(construire_profil(e, resolu["fichiers"]))


# ── Les deux nœuds, toujours ensemble ───────────────────────────────────────

@pytest.mark.parametrize("identifiant", STYLES_RACCORDABLES)
def test_chaque_graphe_porte_les_deux_noeuds_ou_aucun(identifiant):
    profil = _profil_installe(identifiant)
    for graphe, _liaisons in graphes(profil):
        presents = {v["class_type"] for v in graphe.values()} & set(NOEUDS_RACCORD)
        assert presents == set(NOEUDS_RACCORD), (identifiant, presents)


@pytest.mark.parametrize("identifiant", ("sdxl-pixelart", "klein9b-tiles", "zimage-pixel"))
def test_un_style_ordinaire_ne_porte_aucun_des_deux(identifiant):
    profil = _profil_installe(identifiant)
    for graphe, _liaisons in graphes(profil):
        presents = {v["class_type"] for v in graphe.values()} & set(NOEUDS_RACCORD)
        assert presents == set()


# ── Le modèle passe par le nœud 90 à chaque entrée qui le recevait ─────────

@pytest.mark.parametrize("identifiant", STYLES_RACCORDABLES)
def test_le_modele_passe_par_le_noeud_90_a_chaque_entree(identifiant):
    profil = _profil_installe(identifiant)
    e = style(identifiant)
    entrees_modele = _ENTREES_MODELE_RACCORD[e["famille"]]
    for graphe, _liaisons in graphes(profil):
        assert graphe[_ID_RACCORD]["class_type"] == "SeamlessTile"
        for noeud, champ in entrees_modele:
            assert graphe[noeud]["inputs"][champ] == [_ID_RACCORD, 0]
        # Rien d'autre ne pointe vers le nœud patché que ces entrées-là et le
        # nœud du raccord lui-même (pas de branche parallèle oubliée).
        pointent = [k for k, v in graphe.items() if k != _ID_RACCORD
            for champ_, valeur in v["inputs"].items() if valeur == [_ID_RACCORD, 0]]
        assert set(pointent) == {n for n, _c in entrees_modele}


# ── Le décodage est CircularVAEDecode, le reste inchangé ───────────────────

@pytest.mark.parametrize("identifiant", STYLES_RACCORDABLES)
def test_le_decodage_est_circularvaedecode(identifiant):
    profil = _profil_installe(identifiant)
    e = style(identifiant)
    decode = _DECODE_RACCORD[e["famille"]]
    for graphe, _liaisons in graphes(profil):
        noeud = graphe[decode]
        assert noeud["class_type"] == "CircularVAEDecode"
        assert noeud["inputs"]["tiling"] == "enable"
        assert "samples" in noeud["inputs"] and "vae" in noeud["inputs"]


def test_le_decodage_garde_les_memes_sources_que_la_version_ordinaire():
    # sdxl-tileable et sdxl-pixelart partagent la même forme de graphe (même
    # famille, même numérotation) : seul le décodage change de classe, pas ses
    # entrées.
    ordinaire = _profil_installe("sdxl-pixelart")
    raccordable = _profil_installe("sdxl-tileable")
    decode = _DECODE_RACCORD["sdxl"]
    assert ordinaire["graphe"][decode]["inputs"]["samples"] == raccordable["graphe"][decode]["inputs"]["samples"]
    assert ordinaire["graphe"][decode]["inputs"]["vae"] == raccordable["graphe"][decode]["inputs"]["vae"]


# ── Comparaison structurelle avec sc-clone (sdxl-tileable) ─────────────────

def _sans_le_numero_sc_clone(graphe):
    """Remonte le nœud `14` (l'identifiant que sc-clone choisit pour son seul
    SDXL) vers `90` (notre identifiant unique, celui par défaut de `applySeamless`),
    clés et références incluses — le reste se compare ensuite à l'identique."""
    renomme = lambda cle: _ID_RACCORD if cle == "14" else cle
    sortie = {}
    for cle, noeud in graphe.items():
        inputs = {champ: ([renomme(valeur[0]), valeur[1]] if isinstance(valeur, list) and len(valeur) == 2
            and isinstance(valeur[0], str) else valeur) for champ, valeur in noeud["inputs"].items()}
        sortie[renomme(cle)] = {"class_type": noeud["class_type"], "inputs": inputs}
    return sortie


def test_sdxl_tileable_correspond_structurellement_a_sc_clone():
    profil = _profil_installe("sdxl-tileable")
    graphe = composer(profil, prompt="Un pèlerin", prompt_negatif="mauvaise qualité",
        resolution="512", proportions="1:1", graine=42)
    reference = _sans_le_numero_sc_clone(GRAPHE_REFERENCE_SDXL_TILEABLE)
    assert set(graphe) == set(reference)
    for cle in graphe:
        notre_noeud, leur_noeud = graphe[cle], reference[cle]
        assert notre_noeud["class_type"] == leur_noeud["class_type"], cle
        assert set(notre_noeud["inputs"]) == set(leur_noeud["inputs"]), cle
        for champ, valeur in notre_noeud["inputs"].items():
            attendue = leur_noeud["inputs"][champ]
            if champ == "filename_prefix":
                continue
            assert valeur == attendue, (cle, champ)


# ── Indisponible si l'un des deux nœuds manque ──────────────────────────────

@pytest.mark.parametrize("absent", ("SeamlessTile", "CircularVAEDecode"))
def test_style_indisponible_si_un_seul_noeud_manque(absent):
    ampute = {k: v for k, v in OBJECT_INFO.items() if k != absent}
    inv = inventaire(ampute)
    resolu = resoudre(style("sdxl-tileable"), inv)
    assert not resolu["pret"]
    assert any(absent in m for m in resolu["manque"])
    # La consigne d'installation de sc-clone est jointe, pas seulement le nom du nœud.
    assert any("ComfyUI-seamless-tiling" in m and "custom_nodes" in m for m in resolu["manque"])


def test_style_indisponible_si_les_deux_noeuds_manquent():
    ampute = {k: v for k, v in OBJECT_INFO.items() if k not in NOEUDS_RACCORD}
    inv = inventaire(ampute)
    resolu = resoudre(style("klein9b-tiles-raccordable"), inv)
    assert not resolu["pret"]
    assert sum(1 for m in resolu["manque"] if "SeamlessTile" in m or "CircularVAEDecode" in m) == 2


def test_le_style_ordinaire_reste_disponible_sans_les_deux_noeuds():
    # klein9b-tiles (sans le raccord) ne déclare pas ces nœuds : leur absence
    # ne le concerne pas, seul son cousin raccordable en dépend.
    ampute = {k: v for k, v in OBJECT_INFO.items() if k not in NOEUDS_RACCORD}
    inv = inventaire(ampute)
    resolu = resoudre(style("klein9b-tiles"), inv)
    assert resolu["pret"]


async def test_installer_le_style_raccordable_sans_les_noeuds_est_refuse(atelier_styles):
    atelier, comfy = atelier_styles
    comfy.informations = {k: v for k, v in comfy.informations.items() if k not in NOEUDS_RACCORD}
    with pytest.raises(WorkflowRefuse, match="ComfyUI-seamless-tiling"):
        await atelier.styles_locaux.installer("sdxl-tileable")
    assert not [p for p in atelier.profils_workflow.lister() if p["identifiant"] == "sdxl-tileable"]


async def test_lister_les_styles_signale_le_raccordable_installable(atelier_styles):
    atelier, comfy = atelier_styles
    styles = await atelier.styles_locaux.lister()
    ligne = next(s for s in styles if s["identifiant"] == "sdxl-tileable")
    assert ligne["pret"] and ligne["genre"] == "tile"
