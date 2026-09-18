"""ML1 : la graine tirée et gardée, un graphe par nombre de références, la
transparence posée sur blanc avant ComfyUI. ComfyUI est doublé."""
import asyncio
import io
import zipfile

import httpx
import pytest
from PIL import Image

from atelier.domaine.workflow import WorkflowRefuse, composer, normaliser, version_de
from atelier.fournisseur.workflow import MoteurWorkflow
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import ComfyDouble, ajouter, atelier_workflow, profil, raccorder  # noqa: F401


def avec_graine(p):
    """Le profil d'essai, sa graine reliée au sampler au lieu d'une option."""
    p["parametres"] = {}
    p["liaisons"].pop("option:seed")
    p["liaisons"]["graine"] = [{"noeud": "3", "champ": "seed"}]
    return p


def a_variantes(*nombres):
    base = profil()
    base["variantes"] = {str(n): {k: profil(references=n)[k] for k in ("graphe", "liaisons")} for n in nombres}
    return base


def png_transparent():
    image = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    image.putpixel((4, 4), (190, 40, 40, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def png_depose(corps):
    debut = corps.index(b"\x89PNG")
    return Image.open(io.BytesIO(corps[debut:corps.index(b"IEND", debut) + 8]))


async def fabriquer(atelier, cle, p, references=()):
    projet = atelier.bibliotheque.courant
    travail = await atelier.travaux_workflow.preparer(projet, {"cle": cle, "modele": p["modele"],
        "prompt": "Un pèlerin", "repris": True, "resolution": "64", "references": list(references)})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    return atelier.generations.lire(fini["generation_image"])


PROFIL_D_AVANT = {"identifiant": "essai-image", "nom": "Workflow image", "nature": "image", "graphe": {
    "1": {"class_type": "Texte", "inputs": {"text": "à remplacer"}},
    "2": {"class_type": "Taille", "inputs": {"width": 64, "height": 64}},
    "3": {"class_type": "Sampler", "inputs": {"seed": 42, "steps": 4, "positive": ["1", 0], "latent": ["2", 0], "model": ["4", 0], "reference0": ["6", 0]}},
    "4": {"class_type": "Checkpoint", "inputs": {"ckpt_name": "modele-local.safetensors"}},
    "5": {"class_type": "SaveImage", "inputs": {"images": ["3", 0]}},
    "6": {"class_type": "LoadImage", "inputs": {"image": "reference.png"}}},
    "liaisons": {"prompt": [{"noeud": "1", "champ": "text"}], "largeur": [{"noeud": "2", "champ": "width"}],
        "hauteur": [{"noeud": "2", "champ": "height"}], "option:seed": [{"noeud": "3", "champ": "seed"}],
        "reference:0": [{"noeud": "6", "champ": "image"}]},
    "parametres": {"seed": {"genre": "intervalle", "minimum": 0, "maximum": 999999, "defaut": 42}},
    "formats": [{"resolution": "64", "proportions": "1:1", "largeur": 64, "hauteur": 64}],
    "durees": [5], "cadence": 8, "sortie": {"noeud": "5", "champ": "images"}}


def test_un_profil_d_avant_garde_sa_version():
    # Empreinte calculée par le code d'avant ML1 : un profil à un seul graphe
    # se relit sans migration, sans clé nouvelle dans sa forme normalisée.
    assert version_de(normaliser(PROFIL_D_AVANT)) == "519eeab6f0aafb2588ccbe430b0c4ec7d6201fd14c5cd24ffe10136e29f4f1e4"
    assert "variantes" not in normaliser(PROFIL_D_AVANT)
    assert "variantes" not in normaliser({**profil(), "variantes": {}})


async def test_deux_appels_identiques_deux_graines_enregistrees(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, avec_graine(profil()))
    premiere = await fabriquer(atelier, "graine-1", p)
    seconde = await fabriquer(atelier, "graine-2", p)
    envoyees = [e["prompt"]["3"]["inputs"]["seed"] for e in comfy.envois]
    assert len(envoyees) == 2 and envoyees[0] != envoyees[1]
    assert all(isinstance(g, int) and 0 <= g < 2**53 for g in envoyees)
    # Relue comme la fiche de l'image la relit : GET /api/generations/{id}.
    assert [premiere.en_json()["emplacements"][0]["graine"], seconde.en_json()["emplacements"][0]["graine"]] == envoyees


async def test_sans_liaison_graine_rien_ne_change(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil())
    generation = await fabriquer(atelier, "sans-graine", p)
    assert comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == 42
    assert "graine" not in generation.en_json()["emplacements"][0]


async def test_une_etape_reprise_garde_sa_graine(atelier_workflow, double):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, avec_graine(profil()))
    projet = atelier.bibliotheque.courant
    comfy.termine = False
    travail = await atelier.travaux_workflow.preparer(projet, {"cle": "graine-reprise", "modele": p["modele"],
        "prompt": "Un pèlerin", "repris": True, "resolution": "64"})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    for _ in range(500):
        etape = atelier.generations.etape_locale(travail["generation_image"])
        if etape and etape["travail_externe"]:
            break
        await asyncio.sleep(0.01)
    await atelier.file_locale.fermer()
    await atelier.travaux.attendre_tout()
    rouvert = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(rouvert, comfy)
    await rouvert.ouvrir()
    comfy.termine = True
    await rouvert.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    await rouvert.travaux.attendre_tout()
    assert rouvert.travaux.lire(projet, travail["identifiant"])["etat"] == "termine"
    generation = rouvert.generations.lire(travail["generation_image"])
    assert len(comfy.envois) == 1
    assert generation.emplacement(0).graine == comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == etape["parametres"]["valeurs"]["graine"]
    await rouvert.file_locale.fermer()


def test_un_graphe_par_nombre_de_references():
    p = normaliser(a_variantes(1, 2))
    assert (p["references_min"], p["references_max"]) == (0, 2)
    for n in range(3):
        graphe = composer(p, prompt="Un pèlerin", resolution="64", references=[f"ref-{i}.png" for i in range(n)])
        assert sorted(v["inputs"]["image"] for v in graphe.values() if v["class_type"] == "LoadImage") == [f"ref-{i}.png" for i in range(n)]
    with pytest.raises(WorkflowRefuse, match="de 0 à 2 image"):
        composer(p, prompt="Un pèlerin", resolution="64", references=["a", "b", "c"])
    with pytest.raises(WorkflowRefuse, match="exactement 1"):
        composer(normaliser(profil(references=1)), prompt="Un pèlerin", resolution="64", references=[])
    with pytest.raises(WorkflowRefuse, match="sans trou"):
        normaliser(a_variantes(2))
    with pytest.raises(WorkflowRefuse, match="relie 1"):
        normaliser({**profil(), "variantes": {"2": {k: profil(references=1)[k] for k in ("graphe", "liaisons")}}})
    sans_option = a_variantes(1)
    sans_option["variantes"]["1"]["liaisons"].pop("option:seed")
    with pytest.raises(WorkflowRefuse, match="mêmes champs"):
        normaliser(sans_option)
    with pytest.raises(WorkflowRefuse, match="image"):
        normaliser({**profil("video"), "variantes": {"2": {}}})
    assert version_de(normaliser(p)) == version_de(p)


async def test_variantes_au_catalogue_au_diagnostic_et_jusqu_a_comfyui(atelier_workflow):
    atelier, comfy = atelier_workflow
    brut = a_variantes(1, 2)
    p = await ajouter(atelier, comfy, brut)
    # Le Sampler d'essai prend ses références en champs facultatifs.
    comfy.informations["Sampler"]["input"]["optional"] = {"reference0": ["IMAGE"], "reference1": ["IMAGE"]}
    comfy.informations["LoadImage"] = {"input": {"required": {"image": [["reference.png"]]}}}
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(p["modele"])
    assert (modele.references_min, modele.references_max) == (0, 2) and not atelier.catalogue.grise(modele)
    projet = atelier.bibliotheque.courant
    refs = [atelier.generations.importer(image_sujet(bloc=4 + i), f"Référence {i}", projet=projet)["asset"]["identifiant"] for i in range(3)]
    for n in range(3):
        await fabriquer(atelier, f"variante-{n}", p, refs[:n])
    assert [sum(1 for v in e["prompt"].values() if v["class_type"] == "LoadImage") for e in comfy.envois] == [0, 1, 2]
    assert len(comfy.fichiers) == 3
    # Trop d'images jointes par l'auteur : refus avant la file, rien ne part.
    with pytest.raises(Exception, match="2 images de référence"):
        await atelier.travaux_workflow.preparer(projet, {"cle": "trop", "modele": p["modele"],
            "prompt": "Un pèlerin", "repris": True, "resolution": "64", "references": refs})
    assert len(atelier.file_locale.lister()["etapes"]) == 3 and len(comfy.envois) == 3
    # Un nœud propre à une variante compte dans le diagnostic du profil.
    del comfy.informations["LoadImage"]
    diagnostic = await atelier.profils_workflow.diagnostiquer(p["identifiant"], p["version"])
    assert not diagnostic["disponible"] and any("LoadImage" in r for r in diagnostic["problemes"])


async def test_reference_transparente_posee_sur_blanc_avant_comfyui(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil(references=1))
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(png_transparent(), "Référence transparente", projet=projet)["asset"]["identifiant"]
    generation = await fabriquer(atelier, "transparente", p, [reference])
    envoyee = png_depose(comfy.fichiers[0])
    assert envoyee.mode == "RGB"
    assert envoyee.getpixel((0, 0)) == (255, 255, 255) and envoyee.getpixel((4, 4)) == (190, 40, 40)
    # L'atelier garde ses octets : l'entrée de l'étape a toujours sa transparence.
    etape = atelier.generations.etape_locale(generation.identifiant)
    with zipfile.ZipFile(io.BytesIO(atelier.file_locale.entree(etape["identifiant"]))) as z:
        gardee = Image.open(io.BytesIO(z.read("0")))
        assert gardee.mode == "RGBA" and gardee.getpixel((0, 0))[3] == 0


async def test_image_opaque_part_telle_quelle():
    recus = []

    def repondre(req):
        recus.append(req.content)
        return httpx.Response(200, json={"name": "r.png"})

    moteur = MoteurWorkflow("http://comfy.test", httpx.MockTransport(repondre))
    opaque = image_sujet()
    await moteur.deposer_reference(opaque)
    assert opaque in recus[0]
