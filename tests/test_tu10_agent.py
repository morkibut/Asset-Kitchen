"""TU10 — l'agent fabrique des tuiles, sans écran (`docs/PLAN-tuiles.md` § TU10).

Cinq preuves :

1. **Le rendu serveur est celui du navigateur, au pixel près.** `essais/tu10_reference_navigateur.mjs`
   fait rejouer les gestes de l'écran par un vrai navigateur sans écran (Edge, ou le Chromium
   de Playwright) sur `interface/src/tuiles/atelier.ts` servi par Vite ; le serveur refait le
   chemin inverse — recette complétée par le serveur, matières relues en bibliothèque et
   décodées par Pillow, rendu par `atelier/tuiles_node/rendre.mjs` sous Node — et doit
   retomber sur les mêmes pixels, la même carte et le même contrôle, pour chaque sorte.
2. **Le cadre de l'agent borne les matières comme les images** : même plafond, même refus.
3. **Sans Node**, les gestes qui en ont besoin le disent, et le reste fonctionne.
4. **L'origine** : un jeu demandé par l'agent est marqué `origine: "agent"` ; les anciens se
   relisent « auteur » sans migration.
5. **De bout en bout** : un agent (appels MCP successifs) produit une recette, génère une
   matière (ComfyUI doublé), vérifie, corrige, et livre dans un vrai Godot.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from PIL import Image
from mcp.server.mcpserver.exceptions import ToolError

from atelier.domaine.generation import AGENT
from atelier.domaine.recette_tuiles import recette as verifier_recette
from atelier.mcp.serveur import creer_serveur
from atelier.services import Atelier
from atelier.services.rendu_tuiles import SCRIPT, ServiceRenduTuiles
from atelier.services.tuiles import png
from tests.test_a9 import AnimateurDouble
from tests.test_au1 import GODOT
from tests.test_au7_au8 import raccorder
from tests.test_tu5_matieres import ComfyMatiereDouble, FournisseurPayantInterdit

RACINE = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
EDGE = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
PLAYWRIGHT = RACINE / "interface" / "node_modules" / "playwright-core"
BRUIT_DE_SORTIE = ("instances were leaked at exit", "resources still in use at exit")

sans_node = pytest.mark.skipif(not NODE or ServiceRenduTuiles(None).disponibilite()["disponible"] is False,
                               reason="Node.js 22.18+ absent : rendu serveur non vérifié.")

HERBE = {"sorte": "sol", "taille": 16, "graine": 42, "emplacements": {"surface": {"source": "integree", "nom": "herbe"}}}


def pixels(octets: bytes) -> bytes:
    with Image.open(io.BytesIO(octets)) as lu:
        return lu.convert("RGBA").tobytes()


def sha(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


@pytest.fixture
async def agent(tmp_path):
    comfy = ComfyMatiereDouble()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: FournisseurPayantInterdit(),
                      fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    godot = tmp_path / "Godot-TU10"
    godot.mkdir()
    (godot / "project.godot").write_text('config_version=5\n[application]\nconfig/name="TU10"\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    atelier.livraison.associer(projet, str(godot))
    serveur = creer_serveur(atelier)

    async def appeler(nom, **arguments):
        resultat = await serveur.call_tool(nom, arguments)
        if resultat.structured_content is not None:
            return resultat.structured_content
        # Les outils des tuiles (AU13) ne déclarent pas de type de retour : leur
        # réponse est le texte JSON du contenu, en un bloc (ou un bloc par élément).
        textes = [json.loads(c.text) for c in resultat.content]
        return textes if nom == "list_tile_sets" else textes[0]

    yield atelier, projet, godot, comfy, appeler
    await atelier.file_locale.fermer()


# ── 1. Le serveur rend ce que rend le navigateur ─────────────────────────────


@sans_node
@pytest.mark.skipif(not PLAYWRIGHT.is_dir() or not (EDGE.is_file() or (Path.home() / "AppData/Local/ms-playwright").is_dir()),
                    reason="Aucun navigateur sans écran : l'égalité avec le navigateur n'est pas vérifiée.")
async def test_le_rendu_serveur_est_celui_du_navigateur_au_pixel_pres(agent):
    atelier, projet, _, _, _ = agent
    sortie = subprocess.run(["node", str(RACINE / "essais" / "tu10_reference_navigateur.mjs")], capture_output=True,
                            text=True, encoding="utf-8", timeout=300, cwd=str(RACINE))
    assert sortie.returncode == 0, sortie.stderr[-2000:]
    reference = json.loads(sortie.stdout)
    assert "Chrome" in reference["navigateur"]

    # Les matières du navigateur entrent dans la bibliothèque, octets pour octets.
    ids = {}
    for nom, b64 in reference["matieres"].items():
        octets = base64.b64decode(b64)
        asset = atelier.generations.importer(octets, nom, projet=projet, forcer=True)["asset"]["identifiant"]
        # Ce que l'écran lirait (`api.fichier`) est bien ce que le navigateur a décodé.
        assert pixels(atelier.assets.octets(atelier.assets.lire(asset))[0]) == pixels(octets)
        ids[nom] = asset

    sortes = set()
    for cas in reference["cas"]:
        brute = json.loads(json.dumps(cas["recette"]))
        for e in brute["emplacements"].values():
            if e.get("source") == "asset":
                e["asset"] = ids[e["asset"]]
        jeu = atelier.base.lire_projet(projet)
        jeu.univers.palette = tuple(cas["palette_univers"])
        atelier.bibliotheque.sauver_projet(jeu)
        # Le chemin du serveur : la recette complétée comme à la création (TU2), puis Node.
        r = verifier_recette(brute, atelier.tuiles._asset_valide(projet))
        rendu = atelier.rendu_tuiles.rendre(projet, r)
        nom = cas["nom"]
        assert (rendu["largeur"], rendu["hauteur"]) == (cas["largeur"], cas["hauteur"]), nom
        assert rendu["empreinte"] == cas["pixels"], nom
        assert sha(pixels(rendu["png"])) == cas["pixels"], nom
        assert rendu["carte"] == cas["carte"], nom
        if cas["verification"] is None:
            assert not rendu["verification"]["verifiable"], nom
        else:
            assert [d["brut"] for d in rendu["verification"]["defauts"]] == cas["verification"]["defauts"], nom
        sortes.add(r["sorte"])
    assert sortes == {"sol", "chemin", "mur", "coins-15", "pieces-17"}
    assert len(reference["cas"]) >= 17


@sans_node
async def test_le_rendu_serveur_est_stable_et_le_png_se_relit(agent):
    atelier, projet, *_ = agent
    r = verifier_recette(HERBE, lambda _: False)
    a, b = atelier.rendu_tuiles.rendre(projet, r), atelier.rendu_tuiles.rendre(projet, r)
    assert a["png"] == b["png"] and a["empreinte"] == sha(pixels(a["png"]))
    assert a["verification"]["propre"] and a["verification"]["phrase"] == "Aucun défaut : 47 pièces se raccordent."


# ── 2. Le cadre borne les matières ───────────────────────────────────────────


async def test_le_cadre_de_l_agent_borne_les_matieres_comme_ses_images_locales(agent):
    """Le mécanisme de RP2, pas un second : un travail durable, relu au lancement
    (`ServiceTravaux._autoriser`) puis quand la carte graphique prend son tour."""
    atelier, projet, _, comfy, appeler = agent
    demande = {"material": "pierre grise", "pattern": "quatre dalles", "project": projet}

    # Les garde-fous par défaut imposent le modèle d'exploration : le style des matières
    # n'est pas une méthode permise, exactement comme une image locale.
    with pytest.raises(ToolError, match="n'est pas une méthode autorisée à l'agent"):
        await appeler("generate_tile_material", **demande)
    atelier.travaux.regler_cadre(projet, {"autoriser_local": False})
    with pytest.raises(ToolError, match="n'autorise pas cette fabrication locale"):
        await appeler("generate_tile_material", **demande)
    assert comfy.envois == []

    atelier.travaux.regler_cadre(projet, {"plafond_appels": 2})
    with pytest.raises(ToolError, match="plafond d'appels"):
        await appeler("generate_tile_material", draws=3, **demande)
    assert comfy.envois == []
    parti = await appeler("generate_tile_material", draws=2, wait_seconds=30, **demande)
    assert len(parti["generations"]) == 2 and parti["cost_usd"] == 0.0
    await atelier.travaux.attendre_tout()
    await atelier.generations.attendre_tout()
    assert len(comfy.envois) == 2
    assert all(atelier.generations.lire(g["generation_id"]).provenance == AGENT for g in parti["generations"])
    travail = atelier.travaux.lire(projet, parti["job"])
    assert travail["etat"] == "termine" and len(travail["assets"]) == 2 and travail["acteur"] == AGENT
    with pytest.raises(ToolError, match="plafond d'appels"):
        await appeler("generate_tile_material", **demande)
    assert len(comfy.envois) == 2

    # Sans travail, une matière de l'agent ne passe pas : le crochet du fournisseur la refuse.
    [hors_cadre] = await atelier.matieres.generer(projet, pierre="pierre", motif="dalles", cadrage="surface", provenance=AGENT)
    await atelier.generations.attendre_tout()
    assert len(comfy.envois) == 2
    assert "demande durable" in atelier.generations.lire(hors_cadre.identifiant).emplacements[0].raison


# ── 3. Sans Node ─────────────────────────────────────────────────────────────


@sans_node
async def test_sans_node_les_outils_le_disent_et_le_reste_fonctionne(agent, monkeypatch):
    atelier, projet, _, _, appeler = agent
    fabrique = await appeler("create_tile_set", project=projet, name="Avant", recipe=HERBE)
    monkeypatch.setenv("ATELIER_NODE", "")
    assert not atelier.rendu_tuiles.disponibilite()["disponible"]
    with pytest.raises(ToolError, match="Node.js 22.18 ou plus, introuvable sur cette machine"):
        await appeler("create_tile_set", project=projet, name="Sans Node", recipe=HERBE)
    with pytest.raises(ToolError, match="Node.js"):
        await appeler("update_tile_set", project=projet, tileset=fabrique["identifiant"], revision=1,
                      recipe={**HERBE, "graine": 7})
    relu = await appeler("read_tile_set", project=projet, tileset=fabrique["identifiant"])
    assert relu["verification"]["disponible"] is False and "Node.js" in relu["verification"]["raison"]
    assert relu["recette"]["sorte"] == "sol" and relu["diagnostic"]["pret"]
    # Le reste de l'atelier : lister, livrer, créer à partir d'une image.
    assert [e["identifiant"] for e in await appeler("list_tile_sets", project=projet)] == [fabrique["identifiant"]]
    assert (await appeler("preview_tile_delivery", project=projet, tileset=fabrique["identifiant"], revision=1))["jeton"]
    image = Image.new("RGBA", (32, 16), (40, 120, 40, 255))
    asset = atelier.generations.importer(png(image), "Atlas", projet=projet, forcer=True)["asset"]["identifiant"]
    importe = await appeler("create_tile_set", project=projet, name="Importé", image=asset, grid={"taille": 16})
    assert importe["origine"] == "agent" and "verification" not in importe


# ── 4. L'origine ─────────────────────────────────────────────────────────────


@sans_node
async def test_un_jeu_de_l_agent_est_marque_et_les_anciens_se_relisent(agent):
    atelier, projet, _, _, appeler = agent
    de_l_agent = await appeler("create_tile_set", project=projet, name="De l'agent", recipe=HERBE)
    rendu = atelier.rendu_tuiles.rendre(projet, verifier_recette(HERBE, lambda _: False), False)
    de_l_auteur = atelier.tuiles.creer(projet, {"nom": "De l'auteur", "recette": HERBE, "atlas": rendu["png"]})
    assert de_l_agent["origine"] == "agent" and de_l_auteur["origine"] == "auteur"
    liste = {e["nom"]: e["origine"] for e in atelier.tuiles.lister(projet)}
    assert liste == {"De l'agent": "agent", "De l'auteur": "auteur"}
    # Un ensemble d'avant TU10, sans le champ : relu sans migration.
    fichier = atelier.tuiles._dossier(projet, de_l_auteur["identifiant"]) / "ensemble.json"
    brut = json.loads(fichier.read_text(encoding="utf-8"))
    del brut["origine"]
    fichier.write_text(json.dumps(brut), encoding="utf-8")
    assert atelier.tuiles.lire(projet, de_l_auteur["identifiant"])["origine"] == "auteur"


# ── La vérification avertit, elle ne bloque pas ──────────────────────────────


@sans_node
async def test_read_tile_set_dit_un_defaut_en_clair_sans_bloquer_la_livraison(agent):
    atelier, projet, _, _, appeler = agent
    r = verifier_recette(HERBE, lambda _: False)
    rendu = atelier.rendu_tuiles.rendre(projet, r)
    abime = Image.open(io.BytesIO(rendu["png"])).convert("RGBA")
    abime.paste((0, 0, 0, 0), (16, 0, 32, 16))  # une pièce effacée
    e = atelier.tuiles.creer(projet, {"nom": "Abîmé", "recette": HERBE, "atlas": png(abime), "carte": rendu["carte"]})
    relu = await appeler("read_tile_set", project=projet, tileset=e["identifiant"])
    v = relu["verification"]
    assert not v["propre"] and v["defauts"] and v["phrase"].endswith("sur 47 pièces.")
    assert any(d["en_clair"] == "Une pièce est vide : rien n’y est dessiné." for d in v["defauts"])
    assert (await appeler("preview_tile_delivery", project=projet, tileset=e["identifiant"], revision=1))["jeton"]


@sans_node
async def test_read_tile_set_sur_deux_sols_ne_signale_plus_la_case_tout_dessous(agent):
    """TU9 : le contrôle de sc-clone ne connaît pas le second terrain, et signalait à
    tort la case que le moteur réserve au sol dessous. Corrigé dans `verifier`
    (`interface/src/tuiles/atelier.ts`) — la même fonction que joue ce rendu Node,
    donc l'agent en bénéficie directement, sans rien dupliquer côté serveur."""
    atelier, projet, _, _, appeler = agent
    recette = {**HERBE, "reglages": {"secondTerrain": True}}
    e = await appeler("create_tile_set", project=projet, name="Sur un autre sol", recipe=recette)
    v = e["verification"]
    assert v["propre"] and not v["defauts"] and v["phrase"] == "Aucun défaut : 47 pièces se raccordent."


async def test_create_refuse_un_melange_image_et_recette(agent):
    _, projet, _, _, appeler = agent
    with pytest.raises(ToolError, match="soit une recette"):
        await appeler("create_tile_set", project=projet, name="Rien")
    with pytest.raises(ToolError, match="recette seule"):
        await appeler("create_tile_set", project=projet, name="Les deux", recipe=HERBE, image="x", grid={"taille": 16})


# ── 5. De bout en bout, sans écran ───────────────────────────────────────────


@sans_node
async def test_un_agent_produit_verifie_corrige_et_livre_dans_godot(agent):
    atelier, projet, godot, comfy, appeler = agent

    # Produire : une recette, rendue par le serveur.
    cree = await appeler("create_tile_set", project=projet, name="Prairie de l'agent", recipe=HERBE)
    assert cree["origine"] == "agent" and cree["verification"]["propre"]
    assert cree["diagnostic"]["pret"] and cree["carte"]["cases"]
    ident = cree["identifiant"]

    # Générer une matière sur la machine (ComfyUI doublé, aucun fournisseur payant),
    # dans le cadre que l'auteur a donné à l'agent : calcul local permis, dix appels.
    atelier.travaux.regler_cadre(projet, {"plafond_appels": 10})
    gen = await appeler("generate_tile_material", project=projet, material="terre battue brune",
                        pattern="grain fin, sans motif répété", framing="surface", wait_seconds=30)
    [g] = gen["generations"]
    if not g["images"]:
        await atelier.travaux.attendre_tout()
        g = await appeler("check_generation", generation_id=g["generation_id"], wait_seconds=30)
    matiere = g["images"][0]["id"]
    assert len(comfy.envois) == 1

    # Vérifier.
    relu = await appeler("read_tile_set", project=projet, tileset=ident)
    assert relu["verification"]["propre"]

    # Corriger : la matière générée sur la surface, une bordure à elle.
    recette = relu["recette"]
    recette["emplacements"]["surface"] = {"source": "asset", "asset": matiere}
    recette["emplacements"]["bordure"] = {"source": "integree", "nom": "terre", "lie": False}
    corrige = await appeler("update_tile_set", project=projet, tileset=ident, revision=1, recipe=recette)
    assert corrige["revision"] == 2 and corrige["source"]["asset"] != cree["source"]["asset"]
    assert corrige["recette"]["emplacements"]["surface"] == {"source": "asset", "asset": matiere}
    assert corrige["verification"]["pieces"] == 47
    # L'atlas gardé est exactement ce que le serveur rend de la recette gardée.
    refait = atelier.rendu_tuiles.rendre(projet, corrige["recette"], False)
    assert pixels(atelier.tuiles.apercu(projet, ident)) == pixels(refait["png"])

    # Repeindre la carte d'essai.
    peinte = ["......", ".####.", ".####.", "..##..", "......"]
    repeint = await appeler("update_tile_set", project=projet, tileset=ident, revision=2, map=peinte)
    assert repeint["revision"] == 3 and len(repeint["carte"]["cases"]) == 10

    # Livrer par l'éditeur commun.
    apercu = await appeler("preview_tile_delivery", project=projet, tileset=ident, revision=3)
    livre = await appeler("publish_animation_delivery", project=projet, token=apercu["jeton"])
    assert livre["etat"] == "terminee"

    if not GODOT:
        pytest.skip("Godot absent : la livraison est écrite, son chargement natif n'est pas vérifié.")
    cases = {(c["x"], c["y"]): (c["tuile_x"], c["tuile_y"]) for c in repeint["carte"]["cases"]}
    x0, y0 = next(iter(sorted(cases)))
    atlas = Image.open(io.BytesIO(atelier.tuiles.apercu(projet, ident))).convert("RGBA")
    temoin = atlas.getpixel((8, 8 + 16 * 3))  # le centre d'une pièce de la quatrième ligne
    script = f'''extends SceneTree
func _initialize():
    var carte = load({json.dumps(livre["scene"])}).instantiate()
    assert(carte is TileMapLayer)
    assert(carte.get_used_cells().size() == {len(cases)})
    assert(carte.get_cell_atlas_coords(Vector2i({x0}, {y0})) == Vector2i({cases[(x0, y0)][0]}, {cases[(x0, y0)][1]}))
    var t = carte.tile_set
    assert(t.tile_size == Vector2i(16, 16))
    assert(t.get_terrains_count(0) == 1)
    var source = t.get_source(0)
    assert(source.get_tiles_count() == 47)
    var image = source.texture.get_image()
    assert(image.get_size() == Vector2i({atlas.width}, {atlas.height}))
    var p = image.get_pixel(8, 56)
    assert(p.r8 == {temoin[0]} and p.g8 == {temoin[1]} and p.b8 == {temoin[2]} and p.a8 == {temoin[3]})
    carte.free()
    print("TU10_GODOT_OK")
    quit()
'''
    (godot / "preuve_tu10.gd").write_text(script, encoding="utf-8")
    importe = subprocess.run([GODOT, "--headless", "--path", str(godot), "--editor", "--import"], capture_output=True, text=True, timeout=120)
    assert importe.returncode == 0, importe.stdout + importe.stderr
    preuve = subprocess.run([GODOT, "--headless", "--path", str(godot), "--script", "preuve_tu10.gd"], capture_output=True, text=True, timeout=60)
    assert "TU10_GODOT_OK" in preuve.stdout, preuve.stdout + preuve.stderr
    erreurs = [l for l in preuve.stderr.splitlines() if "ERROR" in l and not any(b in l for b in BRUIT_DE_SORTIE)]
    assert not erreurs, preuve.stderr


def test_le_script_de_rendu_importe_le_code_de_l_ecran():
    """Aucun portage : le script n'a que le bouchon de canevas et le crochet de résolution."""
    texte = SCRIPT.read_text(encoding="utf-8")
    assert "'atelier.ts'" in texte and "'png.ts'" in texte
    for geste in ("jeuDepuisRecette", "atlasDe", "encoderPng", "verifier", "versCarteServeur"):
        assert f"{geste}(" in texte
    assert "renderLogical" not in texte and "reglagesMoteur" not in texte
