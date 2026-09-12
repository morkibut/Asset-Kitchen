"""Workflows locaux : HTTP doublé, références et résultats réellement conservés."""
import asyncio
import copy
import json

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.demande import Demande
from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.workflow import MoteurWorkflow, AnimateurWorkflow
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble, clip_mp4


def profil(nature="image", references=0):
    graphe = {"1": {"class_type": "Texte", "inputs": {"text": "à remplacer"}},
        "2": {"class_type": "Taille", "inputs": {"width": 64, "height": 64}},
        "3": {"class_type": "Sampler", "inputs": {"seed": 42, "steps": 4, "positive": ["1", 0], "latent": ["2", 0], "model": ["4", 0]}},
        "4": {"class_type": "Checkpoint", "inputs": {"ckpt_name": "modele-local.safetensors"}},
        "5": {"class_type": "SaveImage" if nature == "image" else "SaveVideo", "inputs": {"images": ["3", 0]}}}
    liaisons = {"prompt": [{"noeud": "1", "champ": "text"}], "largeur": [{"noeud": "2", "champ": "width"}],
        "hauteur": [{"noeud": "2", "champ": "height"}], "option:seed": [{"noeud": "3", "champ": "seed"}]}
    if nature == "video":
        references = 1
        graphe["5"]["inputs"].update(seconds=5, fps=8)
        liaisons["secondes"] = [{"noeud": "5", "champ": "seconds"}]
        liaisons["cadence"] = [{"noeud": "5", "champ": "fps"}]
    for i in range(references):
        cle = str(6 + i)
        graphe[cle] = {"class_type": "LoadImage", "inputs": {"image": "reference.png"}}
        graphe["3"]["inputs"]["reference" + str(i)] = [cle, 0]
        liaisons["reference:" + str(i)] = [{"noeud": cle, "champ": "image"}]
    return {"identifiant": "essai-" + nature, "nom": "Workflow " + nature, "nature": nature,
        "graphe": graphe, "liaisons": liaisons,
        "parametres": {"seed": {"genre": "intervalle", "minimum": 0, "maximum": 999999, "defaut": 42}},
        "formats": [{"resolution": "480p" if nature == "video" else "64", "proportions": "1:1", "largeur": 64, "hauteur": 64}],
        "durees": [5], "cadence": 8, "sortie": {"noeud": "5", "champ": "gifs" if nature == "video" else "images"}}


class ComfyDouble:
    def __init__(self):
        self.requetes, self.envois, self.fichiers = [], [], []
        self.termine = True
        self.perdre_acceptation = False
        self.informations = {}
        self.jobs = {}
        self.image = image_sujet()
        self.video = clip_mp4()
        self.sortie_image = "image.png"
        self.modeles_absents = False

    def declarer(self, p):
        for noeud in p["graphe"].values():
            self.informations[noeud["class_type"]] = {"input": {"required": {c: ["ANY"] for c in noeud["inputs"]}},
                "output_node": noeud["class_type"].startswith("Save")}
        self.informations["Checkpoint"]["input"]["required"]["ckpt_name"] = [["modele-local.safetensors"]]

    def repondre(self, req):
        self.requetes.append((req.method, req.url.path))
        if req.url.path == "/object_info":
            infos = copy.deepcopy(self.informations)
            if self.modeles_absents:
                infos["Checkpoint"]["input"]["required"]["ckpt_name"] = [[]]
            return httpx.Response(200, json=infos)
        if req.url.path == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if req.url.path == "/upload/image":
            self.fichiers.append(req.content)
            return httpx.Response(200, json={"name": "reference-enregistree.png"})
        if req.url.path == "/prompt":
            charge = json.loads(req.content)
            self.envois.append(charge)
            numero = "calcul-" + str(len(self.envois))
            self.jobs[numero] = charge
            if self.perdre_acceptation:
                raise httpx.ReadTimeout("réponse perdue", request=req)
            return httpx.Response(200, json={"prompt_id": numero})
        if req.url.path.startswith("/history/"):
            numero = req.url.path.split("/")[-1]
            if not self.termine or numero not in self.jobs:
                return httpx.Response(200, json={})
            video = self.jobs[numero]["prompt"]["5"]["class_type"] == "SaveVideo"
            return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {"5": {
                "gifs" if video else "images": [{"filename": "clip.mp4" if video else self.sortie_image, "type": "output", "subfolder": ""}]}}}})
        if req.url.path == "/view":
            return httpx.Response(200, content=self.video if req.url.params["filename"].endswith(".mp4") else self.image)
        raise AssertionError((req.method, str(req.url)))


def raccorder(atelier, comfy):
    transport = httpx.MockTransport(comfy.repondre)
    fabrique = lambda: MoteurWorkflow("http://comfy.test", transport)
    atelier.profils_workflow.fabrique_moteur = fabrique
    atelier.fournisseur_workflow_image.fabrique_moteur = fabrique
    atelier.fournisseur_workflow_image.intervalle = 0.01
    atelier.fournisseurs._fabriques.append(lambda: atelier.fournisseur_workflow_image)
    atelier.animation._fabriques = (*atelier.animation._fabriques,
        lambda: AnimateurWorkflow(atelier.profils_workflow, atelier.fichiers, "http://comfy.test", transport))


@pytest.fixture
async def atelier_workflow(tmp_path, double):
    comfy = ComfyDouble()
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    jeu = atelier.base.lire_projet(atelier.bibliotheque.courant)
    jeu.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(jeu)
    yield atelier, comfy
    await atelier.file_locale.fermer()
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()


async def ajouter(atelier, comfy, p):
    comfy.declarer(p)
    garde = atelier.profils_workflow.importer(p)
    await atelier.catalogue.rafraichir()
    await atelier.animation.rafraichir()
    return garde


async def test_import_reouverture_et_diagnostic_sans_envoi_ni_installation(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = profil(references=1)
    garde = await ajouter(atelier, comfy, p)
    assert not comfy.envois
    assert atelier.profils_workflow.importer(p)["version"] == garde["version"]
    p["parametres"]["seed"]["defaut"] = 123
    autre = atelier.profils_workflow.importer(p)
    assert garde["version"] != autre["version"]
    assert atelier.profils_workflow.lire(garde["identifiant"], garde["version"])["parametres"]["seed"]["defaut"] == 42
    diagnostic = await atelier.profils_workflow.diagnostiquer(garde["identifiant"], garde["version"])
    assert diagnostic["disponible"]
    comfy.modeles_absents = True
    diagnostic = await atelier.profils_workflow.diagnostiquer(garde["identifiant"], garde["version"])
    assert not diagnostic["disponible"] and "modele-local.safetensors" in diagnostic["problemes"][0]
    await atelier.catalogue.rafraichir()
    modele = atelier.catalogue.modele(garde["modele"])
    assert modele.locale and modele.references_min == modele.references_max == 1
    assert atelier.catalogue.grise(modele)
    assert all(methode == "GET" for methode, chemin in comfy.requetes)


async def test_image_locale_durable_reference_exacte_et_relecture_sans_recalcul(atelier_workflow):
    atelier, comfy = atelier_workflow
    garde = await ajouter(atelier, comfy, profil(references=1))
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(image_sujet(), "Référence", projet=projet)["asset"]["identifiant"]
    demande = {"cle": "image-1", "modele": garde["modele"], "prompt": "Un pèlerin sur fond uni", "repris": True,
        "references": [reference], "resolution": "64", "options": {"seed": 357}}
    travail = await atelier.travaux_workflow.preparer(projet, demande)
    assert not comfy.envois and travail["envoi_image"]["prompt"] == demande["prompt"]
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    assert len(comfy.envois) == 1 and len(comfy.fichiers) == 1
    assert comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == 357
    assert comfy.envois[0]["extra_data"]["asset_kitchen"]["version"] == garde["version"]
    asset = atelier.assets.lire(fini["reference_asset"])
    assert asset and asset.modele == garde["modele"]
    assert atelier.assets.reference(asset.identifiant)
    assert await atelier.travaux_workflow.preparer(projet, demande)
    await atelier.travaux.demarrer(projet, fini["identifiant"], reprise=True)
    assert len(comfy.envois) == 1


async def test_agent_local_applique_le_cadre_et_refuse_api_node(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil())
    projet = atelier.bibliotheque.courant
    demande = {"cle": "agent-1", "modele": p["modele"], "prompt": "A pilgrim", "repris": True, "resolution": "64"}
    atelier.travaux.regler_cadre(projet, {"autoriser_local": False, "plafond_appels": 1, "modeles_image": [p["modele"]]})
    travail = await atelier.travaux_workflow.preparer(projet, demande, "agent")
    with pytest.raises(Exception, match="locale"):
        await atelier.travaux.demarrer(projet, travail["identifiant"], "agent")
    atelier.travaux.regler_cadre(projet, {"autoriser_local": True, "plafond_appels": 1, "modeles_image": [p["modele"]]})
    await atelier.travaux.demarrer(projet, travail["identifiant"], "agent")
    await atelier.travaux.attendre_tout()
    assert atelier.travaux.lire(projet, travail["identifiant"])["etat"] == "termine"
    assert len(comfy.envois) == 1
    comfy.informations["Sampler"]["api_node"] = True
    diagnostic = await atelier.profils_workflow.diagnostiquer(p["identifiant"], p["version"])
    assert not diagnostic["disponible"] and any("API distante" in r for r in diagnostic["problemes"])


async def test_reponse_perdue_ne_refait_jamais_le_workflow(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil())
    comfy.perdre_acceptation = True
    projet = atelier.bibliotheque.courant
    travail = await atelier.travaux_workflow.preparer(projet, {"cle": "inconnue", "modele": p["modele"], "prompt": "A pilgrim", "repris": True, "resolution": "64"})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    assert atelier.travaux.lire(projet, travail["identifiant"])["etat"] == "externe_inconnu"
    with pytest.raises(Exception, match="inconnue"):
        await atelier.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    assert len(comfy.envois) == 1


async def test_video_profile_va_jusqua_la_bande_reouvrable(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil("video"))
    projet = atelier.bibliotheque.courant
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin", "Marcheur", objectif={
        "sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}], "largeur": 64, "hauteur": 64,
        "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64}})
    reference = atelier.generations.importer(image_sujet(), "Référence", projet=projet)["asset"]["identifiant"]
    travail = await atelier.travaux.preparer(projet, {"cle": "animation-locale", "personnage": personnage.identifiant,
        "pose": "marche", "direction": "ouest", "modele_video": p["modele"], "reference_asset": reference,
        "prompt_video": "Walk in place", "options_video": {"seed": 246}, "nombre_images": 4, "cadence": 11})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    bande = atelier.montage.bande(fini["bandes"][0])
    assert bande.cadence == 11 and bande.compte == 4 and bande.pose == "marche"
    assert len(comfy.envois) == 1
    assert comfy.envois[0]["prompt"]["5"]["inputs"]["seconds"] == 5
    assert comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == 246


async def test_reference_locale_perdue_bloque_video_libre_sans_second_appel(atelier_workflow):
    atelier, comfy = atelier_workflow
    image = await ajouter(atelier, comfy, profil(references=1))
    video = await ajouter(atelier, comfy, profil("video"))
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(image_sujet(), "Référence", projet=projet)["asset"]["identifiant"]
    travail = await atelier.travaux.preparer(projet, {"cle": "reference-locale-perdue", "modele_image": image["modele"],
        "prompt_image": "A pilgrim", "repris_image": True, "resolution_image": "64", "references_image": [reference], "modele_video": video["modele"],
        "prompt_video": "Walk in place"}, source_libre=True)
    comfy.perdre_acceptation = True
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    lu = atelier.travaux.lire(projet, travail["identifiant"])
    assert lu["etat"] == "externe_inconnu", lu
    assert lu["clip"] is None and len(comfy.envois) == 1
    with pytest.raises(Exception, match="inconnue"):
        await atelier.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    assert len(comfy.envois) == 1


async def test_profil_api_et_mcp_par_la_meme_application(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = profil()
    comfy.declarer(p)
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
            r = await client.post("/api/workflow-profiles", json=p)
            assert r.status_code == 200, r.text
            garde = r.json()
            r = await client.get(f"/api/workflow-profiles/{garde['identifiant']}/versions/{garde['version']}")
            assert r.status_code == 200 and r.json()["version"] == garde["version"]
            r = await client.post(f"/api/workflow-profiles/{garde['identifiant']}/versions/{garde['version']}/diagnose")
            assert r.json()["disponible"]
            noms = [o.name for o in await app.state.mcp.list_tools()]
            assert {"list_workflow_profiles", "diagnose_workflow_profile", "prepare_workflow_image"} <= set(noms)
            assert not comfy.envois


async def test_fermer_et_rouvrir_reprend_image_meme_version_sans_recalcul(atelier_workflow, double):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil(references=1))
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(image_sujet(), "Référence", projet=projet)["asset"]["identifiant"]
    comfy.termine = False
    travail = await atelier.travaux_workflow.preparer(projet, {"cle": "reprise-reelle", "modele": p["modele"],
        "prompt": "Un pèlerin", "repris": True, "references": [reference], "resolution": "64", "options": {"seed": 825}})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    for _ in range(500):
        etape = atelier.generations.etape_locale(travail["generation_image"])
        if etape and etape["travail_externe"]:
            break
        await asyncio.sleep(0.01)
    assert etape and etape["travail_externe"] and len(comfy.envois) == 1
    await atelier.file_locale.fermer()
    await atelier.travaux.attendre_tout()
    nouvelle_version = profil(references=1)
    nouvelle_version["parametres"]["seed"]["defaut"] = 999
    atelier.profils_workflow.importer(nouvelle_version)
    rouvert = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(rouvert, comfy)
    await rouvert.ouvrir()
    comfy.termine = True
    await rouvert.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    await rouvert.travaux.attendre_tout()
    fini = rouvert.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    assert fini["demande"]["modele"] == p["modele"]
    assert len(comfy.envois) == 1 and comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == 825
    assert rouvert.assets.reference(fini["reference_asset"])
    await rouvert.file_locale.fermer()


async def test_sortie_image_illisible_reste_sur_disque_sans_nouveau_calcul(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil())
    projet = atelier.bibliotheque.courant
    comfy.image = b"reponse-fournisseur-qui-n-est-pas-une-image"
    travail = await atelier.travaux_workflow.preparer(projet, {"cle": "sortie-inattendue", "modele": p["modele"], "prompt": "Un pèlerin", "repris": True, "resolution": "64"})
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "a_verifier"
    etape = atelier.generations.etape_locale(travail["generation_image"])
    assert (atelier.file_locale._dossier(etape["identifiant"]) / "resultat").read_bytes() == comfy.image
    await atelier.travaux.demarrer(projet, travail["identifiant"], reprise=True)
    await atelier.travaux.attendre_tout()
    assert len(comfy.envois) == 1
