# -*- coding: utf-8 -*-
"""RG7 — l'agent voit les matières (`docs/PLAN-rangement.md`,
`docs/RG5-la-bibliotheque-des-matieres.md` § 6).

Le trou que cette tranche répare : depuis RG5 une matière est une image de la
bibliothèque, mais l'agent n'avait aucun moyen de la retrouver — il devait
garder l'identifiant rendu par `generate_tile_material`, ou fouiller
`list_assets` sans savoir lesquelles étaient des matières. `list_materials`
la lui rend, et l'identifiant se pose tel quel dans une recette.

Chaque essai nomme la panne qu'il empêche :

- un agent qui ne saurait pas enchaîner génération, lecture, composition sans
  créer un sujet ni passer par l'écran (l'essai de bout en bout) ;
- une matière déclarée à la main qui se ferait inventer un cadrage ;
- une marque « matière » posée par `edit_asset` qui ne se retirerait pas, ou
  qui n'apparaîtrait pas dans la réponse ;
- `edit_asset` qui accepterait la marque mêlée à une retouche et laisserait
  l'image à moitié changée en cas de refus ;
- « dis ce qu'il faut faire » qui refuserait encore quand seule la marque est
  donnée ;
- les descriptions des outils qui ne diraient plus comment les enchaîner.

Aucun essai ne coûte un centime : la génération passe par le double ComfyUI de
TU5, jamais par un fournisseur payant, comme dans `tests/test_tu10_agent.py`
dont on reprend le banc tel quel.
"""
from __future__ import annotations

import pytest
from mcp.server.mcpserver.exceptions import ToolError
from PIL import Image

from atelier.services.tuiles import png
from tests.test_tu10_agent import agent, sans_node  # noqa: F401 (banc de TU10, réutilisé tel quel)


def _importer(atelier, projet, nom, couleur):
    """Une image ordinaire de la bibliothèque : ni matière, ni sujet."""
    octets = png(Image.new("RGBA", (16, 16), couleur))
    return atelier.generations.importer(octets, nom, projet=projet, forcer=True)["asset"]["identifiant"]


async def _generer_une_matiere(atelier, projet, appeler, **demande):
    """Le geste de l'agent : demander, puis attendre l'image — dans son cadre."""
    atelier.travaux.regler_cadre(projet, {"plafond_appels": 10})
    parti = await appeler("generate_tile_material", project=projet, wait_seconds=30, **demande)
    [g] = parti["generations"]
    if not g["images"]:
        await atelier.travaux.attendre_tout()
        g = await appeler("check_generation", generation_id=g["generation_id"], wait_seconds=30)
    return g["images"][0]["id"]


# ── La lecture ───────────────────────────────────────────────────────────────


async def test_un_projet_neuf_n_a_aucune_matiere(agent):
    _, projet, _, _, appeler = agent
    assert await appeler("list_materials") == {"materials": [], "total": 0}
    assert await appeler("list_materials", project=projet) == {"materials": [], "total": 0}


async def test_une_image_ordinaire_n_est_pas_une_matiere_tant_qu_on_ne_l_a_pas_dit(agent):
    atelier, projet, _, _, appeler = agent
    _importer(atelier, projet, "Un mur de pierre", (90, 90, 90, 255))
    assert (await appeler("list_materials"))["total"] == 0


async def test_une_matiere_generee_se_liste_avec_son_cadrage_et_son_chemin(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = await _generer_une_matiere(atelier, projet, appeler, material="pierre grise",
                                             pattern="quatre dalles", framing="face")
    liste = await appeler("list_materials")
    assert liste["total"] == 1
    [m] = liste["materials"]
    assert set(m) == {"id", "name", "framing", "width", "height", "path", "created", "collections"}
    assert m["id"] == identifiant
    assert m["framing"] == "face"
    assert m["name"] == atelier.assets.lire(identifiant).label
    assert m["width"] > 0 and m["height"] > 0 and m["created"] > 0
    assert m["collections"] == []
    # Le même chemin que `list_assets` rend pour la même image : le rendu, pas le brut.
    depuis_la_galerie = {a["id"]: a for a in (await appeler("list_assets"))["assets"]}[identifiant]
    assert m["path"] == depuis_la_galerie["path"]
    assert (m["width"], m["height"]) == (depuis_la_galerie["width"], depuis_la_galerie["height"])


async def test_une_image_declaree_matiere_a_la_main_a_un_cadrage_vide(agent):
    """Rien d'inventé : sans la génération d'origine, le cadrage n'existe pas."""
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Un mur de pierre", (90, 90, 90, 255))
    dit = await appeler("edit_asset", asset_id=identifiant, material=True)
    assert dit["material"] is True
    [m] = (await appeler("list_materials"))["materials"]
    assert m["id"] == identifiant and m["framing"] == "" and m["name"] == "Un mur de pierre"


async def test_retirer_la_marque_sort_l_image_de_la_liste(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Un mur de pierre", (90, 90, 90, 255))
    await appeler("edit_asset", asset_id=identifiant, material=True)
    assert (await appeler("list_materials"))["total"] == 1
    retire = await appeler("edit_asset", asset_id=identifiant, material=False)
    assert retire["material"] is False and retire["id"] == identifiant
    assert await appeler("list_materials") == {"materials": [], "total": 0}
    # L'image, elle, est toujours là : seule la marque est partie.
    assert atelier.assets.lire(identifiant) is not None


async def test_la_recherche_porte_sur_le_nom_sans_regarder_la_casse(agent):
    atelier, projet, _, _, appeler = agent
    dalles = _importer(atelier, projet, "Dalles Grises", (90, 90, 90, 255))
    herbe = _importer(atelier, projet, "herbe rase", (40, 140, 40, 255))
    for identifiant in (dalles, herbe):
        await appeler("edit_asset", asset_id=identifiant, material=True)

    assert (await appeler("list_materials"))["total"] == 2
    trouvees = await appeler("list_materials", search="DALLES")
    assert [m["id"] for m in trouvees["materials"]] == [dalles] and trouvees["total"] == 1
    trouvees = await appeler("list_materials", search="  Rase ")
    assert [m["id"] for m in trouvees["materials"]] == [herbe]
    assert await appeler("list_materials", search="introuvable") == {"materials": [], "total": 0}


async def test_le_total_compte_avant_la_coupe_et_la_limite_est_bornee(agent):
    atelier, projet, _, _, appeler = agent
    for rang in range(3):
        identifiant = _importer(atelier, projet, f"Matière {rang}", (10 * rang, 50, 50, 255))
        await appeler("edit_asset", asset_id=identifiant, material=True)

    coupee = await appeler("list_materials", limit=2)
    assert len(coupee["materials"]) == 2 and coupee["total"] == 3
    # Comme `list_assets` : jamais moins d'une, jamais plus de deux cents.
    assert len((await appeler("list_materials", limit=0))["materials"]) == 1
    assert len((await appeler("list_materials", limit=10_000))["materials"]) == 3


async def test_un_projet_inconnu_est_refuse_avec_la_liste(agent):
    _, projet, _, _, appeler = agent
    with pytest.raises(ToolError, match="aucun projet « fantome »") as refus:
        await appeler("list_materials", project="fantome")
    assert projet in str(refus.value)


async def test_les_collections_de_la_matiere_sont_dites_a_l_agent(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Dalles", (90, 90, 90, 255))
    await appeler("edit_asset", asset_id=identifiant, material=True)
    from atelier.domaine.projet import MATIERE
    collection = atelier.bibliotheque.creer_collection("Pierres")
    atelier.bibliotheque.ranger_sujet(collection.identifiant, projet, identifiant, genre=MATIERE)
    [m] = (await appeler("list_materials"))["materials"]
    assert m["collections"] == [{"id": collection.identifiant, "name": "Pierres"}]


# ── `edit_asset` : la marque, seule ──────────────────────────────────────────


async def test_edit_asset_ne_refuse_plus_quand_seule_la_marque_est_donnee(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Dalles", (90, 90, 90, 255))
    with pytest.raises(ToolError, match="dis ce qu'il faut faire.*material"):
        await appeler("edit_asset", asset_id=identifiant)
    dit = await appeler("edit_asset", asset_id=identifiant, material=True)
    assert dit["material"] is True and dit["not_applied"] == []


async def test_edit_asset_refuse_la_marque_mêlée_à_une_retouche_et_ne_change_rien(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Dalles", (90, 90, 90, 255))
    for melange in ({"revert": True}, {"recipe": "quelconque"}, {"steps": {}}):
        with pytest.raises(ToolError, match="« material » se pose seul"):
            await appeler("edit_asset", asset_id=identifiant, material=True, **melange)
    assert atelier.assets.lire(identifiant).matiere is False
    assert (await appeler("list_materials"))["total"] == 0


async def test_edit_asset_dit_un_asset_inconnu_pour_la_marque(agent):
    with pytest.raises(ToolError, match="aucun asset « rien »"):
        await agent[4]("edit_asset", asset_id="rien", material=True)


# ── Ce que les descriptions disent à l'agent ─────────────────────────────────


async def test_les_descriptions_disent_comment_enchainer(agent):
    atelier, *_ = agent
    from atelier.mcp.serveur import creer_serveur
    outils = {o.name: o for o in await creer_serveur(atelier).list_tools()}

    liste = outils["list_materials"].description
    assert "{source: 'asset', asset: id}" in liste and "no subject" in liste
    assert outils["list_materials"].meta["barre"]["paiement"] == "gratuit"

    generer = outils["generate_tile_material"].description
    assert "already in the game's material library" in generer and "list_materials" in generer
    # L'ancienne phrase reste vraie, et la nouvelle ne la contredit pas.
    assert "library image of kind 'matière'" in generer

    assert "material" in outils["edit_asset"].input_schema["properties"]
    assert "list_materials" in outils["edit_asset"].description


# ── De bout en bout : générer, retrouver, composer — sans écran, sans sujet ──


@sans_node
async def test_un_agent_genere_une_matiere_la_retrouve_et_compose_sans_jamais_creer_de_sujet(agent):
    atelier, projet, _, comfy, appeler = agent
    assert atelier.production.personnages(projet) == []

    # 1. Générer : ComfyUI doublé, aucun fournisseur payant, dans le cadre de l'agent.
    atelier.travaux.regler_cadre(projet, {"plafond_appels": 10})
    parti = await appeler("generate_tile_material", project=projet, material="terre battue brune",
                          pattern="grain fin, sans motif répété", framing="surface", wait_seconds=30)
    [g] = parti["generations"]
    assert parti["cost_usd"] == 0.0

    # 2. Vérifier que la génération est finie (l'outil de l'agent, pas le service).
    if not g["images"]:
        await atelier.travaux.attendre_tout()
    fini = await appeler("check_generation", generation_id=g["generation_id"], wait_seconds=30)
    assert fini["done"] is True and len(fini["images"]) == 1
    assert len(comfy.envois) == 1

    # 3. Retrouver la matière par la bibliothèque — sans avoir gardé aucun identifiant.
    liste = await appeler("list_materials", project=projet)
    assert liste["total"] == 1
    [matiere] = liste["materials"]
    assert matiere["id"] == fini["images"][0]["id"] and matiere["framing"] == "surface"

    # 4. Composer : l'identifiant rendu par list_materials se pose tel quel dans la recette.
    recette = {"sorte": "sol", "taille": 16, "graine": 5,
               "emplacements": {"surface": {"source": "asset", "asset": matiere["id"]},
                                "bordure": {"source": "integree", "nom": "terre", "lie": False}}}
    cree = await appeler("create_tile_set", project=projet, name="Terre battue", recipe=recette)
    assert cree["origine"] == "agent" and cree["verification"]["propre"]
    assert cree["recette"]["emplacements"]["surface"] == {"source": "asset", "asset": matiere["id"]}
    assert cree["diagnostic"]["pret"]
    relu = await appeler("read_tile_set", project=projet, tileset=cree["identifiant"])
    assert relu["recette"]["emplacements"]["surface"]["asset"] == matiere["id"]

    # Aucun sujet, à aucun moment : la matière est un ingrédient du jeu, pas le contenu d'un sujet.
    assert atelier.production.personnages(projet) == []
    assert atelier.assets.lire(matiere["id"]).personnage is None
