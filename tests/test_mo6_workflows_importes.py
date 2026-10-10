"""MO6 · Les workflows importés par l'auteur, des moteurs comme les autres.

`docs/PLAN-catalogue-des-moteurs.md` § MO6 : « un workflow importé devient un
moteur comme les autres : ses capacités se déduisent de ce qu'il sait recevoir
(une zone, une image de fin, une durée), et il apparaît dans tous les outils qui
peuvent s'en servir. Il apparaît sur la page « Moteurs », avec son diagnostic. »

Ces essais tiennent :

- la lecture d'un graphe seul trouve la zone, l'image de fin, le nombre
  d'images — et ne prend jamais l'image de départ pour une zone ;
- la capacité se lit toujours sur la liaison : un profil qu'on ne touche pas
  garde sa forme ; relier ce que le graphe sait écrit une **nouvelle version**,
  qui entre aussitôt dans « Repeindre » ou « Fin de l'animation », et
  l'ancienne se relit (8septies) ;
- le diagnostic dit, élément par élément, ce qui manque pour tourner ;
- un clip dont ComfyUI tient l'image de fin pour obligatoire se grise sans
  elle, au lieu d'être refusé à l'envoi (la limite laissée par MO3).

Aucun centime : ComfyUI est doublé.
"""
from __future__ import annotations

import copy

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.animation import DemandeClip
from atelier.domaine.lecture_graphe import a_relier, capacites_du_profil, lire_le_graphe, relier_ce_que_le_graphe_sait
from atelier.domaine.workflow import IMAGE_DE_FIN, MASQUE, WorkflowRefuse, normaliser
from tests.test_au7_au8 import ajouter, atelier_workflow, profil  # noqa: F401 — la fixture s'importe
from tests.test_mo3_catalogue_video import profil_qui_finit


def graphe_de_zone(transparence=False):
    """Un graphe de retouche comme ComfyUI l'exporte : l'image d'en dessous
    encodée telle quelle, la zone chargée à part, ramenée en masque et posée
    sur le latent — la recette du banc PX1."""
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sdxl.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "une coiffure bleue", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "flou", "clip": ["1", 1]}},
        "4": {"class_type": "LoadImage", "inputs": {"image": "dessous.png"}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {"class_type": "LoadImage", "inputs": {"image": "zone.png"}},
        "7": {"class_type": "ImageToMask", "inputs": {"image": ["6", 0], "channel": "red"}},
        "8": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["5", 0], "mask": ["7", 0]}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                   "latent_image": ["8", 0], "seed": 1, "denoise": 0.9}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": "zone"}},
    }
    if transparence:
        del graphe["6"], graphe["7"]
        graphe["8"]["inputs"]["mask"] = ["4", 1]
    return graphe


def profil_de_zone_non_relie():
    """Le graphe de zone, importé comme on importe un graphe seul : le texte et
    la sortie reliés, **ni la zone ni l'image d'en dessous**."""
    return {"identifiant": "retouche-maison", "nom": "Retouche maison", "nature": "image", "graphe": graphe_de_zone(),
            "liaisons": {"prompt": [{"noeud": "2", "champ": "text"}]}, "parametres": {},
            "formats": [{"resolution": "1024", "proportions": "1:1", "largeur": 1024, "hauteur": 1024}],
            "durees": [], "cadence": 0, "sortie": {"noeud": "11", "champ": "images"}}


def graphe_wan():
    """Un « première et dernière image » de Wan, au format API."""
    return {
        "1": {"class_type": "CLIPTextEncode", "inputs": {"text": "marche"}},
        "6": {"class_type": "LoadImage", "inputs": {"image": "depart.png"}},
        "9": {"class_type": "LoadImage", "inputs": {"image": "fin.png"}},
        "3": {"class_type": "WanFirstLastFrameToVideo", "inputs": {"start_image": ["6", 0], "end_image": ["9", 0],
                                                                   "positive": ["1", 0], "length": 81}},
        "4": {"class_type": "CreateVideo", "inputs": {"images": ["3", 0], "fps": 16}},
        "5": {"class_type": "SaveVideo", "inputs": {"video": ["4", 0]}},
    }


# ── La lecture du graphe seul ────────────────────────────────────────────────


def test_la_lecture_trouve_la_zone_l_image_d_en_dessous_et_les_textes():
    lecture = lire_le_graphe(graphe_de_zone())
    assert lecture[MASQUE] == {"noeud": "6", "champ": "image"}
    assert lecture["references"] == [{"noeud": "4", "champ": "image"}]
    assert lecture["prompt"] == {"noeud": "2", "champ": "text"}
    assert lecture["prompt_negatif"] == {"noeud": "3", "champ": "text"}
    assert lecture["sortie"] == "11"
    assert lecture[IMAGE_DE_FIN] is None and lecture["remarques"] == []


def test_une_zone_prise_dans_la_transparence_du_depart_n_est_pas_une_zone():
    """L'image de départ sert au masque *et* à l'encodeur : la lire comme une
    zone ferait déposer la zone peinte à la place de l'image — jamais."""
    lecture = lire_le_graphe(graphe_de_zone(transparence=True))
    assert lecture[MASQUE] is None
    assert lecture["references"] == [{"noeud": "4", "champ": "image"}]
    assert "transparence" in lecture["remarques"][0]


def test_la_lecture_d_un_clip_trouve_la_fin_le_depart_et_la_duree():
    object_info = {"WanFirstLastFrameToVideo": {"input": {"required": {"length": ["INT", {"default": 81, "min": 1, "step": 4}]}}}}
    lecture = lire_le_graphe(graphe_wan(), object_info)
    assert lecture[IMAGE_DE_FIN] == {"noeud": "9", "champ": "image"}
    assert lecture["references"] == [{"noeud": "6", "champ": "image"}]
    assert lecture["images"] == {"noeud": "3", "champ": "length", "valeur": 81}
    assert lecture["cadence"] == 16 and lecture["duree"] == 5 and lecture["pas_images"] == 4
    # Sans ComfyUI, tout reste, sauf le pas qu'il est seul à connaître.
    assert lire_le_graphe(graphe_wan())["pas_images"] is None


def test_un_document_qui_n_est_pas_un_graphe_api_est_refuse():
    with pytest.raises(WorkflowRefuse, match="format API"):
        lire_le_graphe({"nodes": [], "links": []})


# ── Ce qu'un profil sait, et ce qu'il pourrait savoir ────────────────────────


def test_la_capacite_se_lit_sur_la_liaison_jamais_sur_la_lecture():
    p = normaliser(profil_de_zone_non_relie())
    assert capacites_du_profil(p) == ["creer_image"]
    manque = a_relier(p)
    assert [m["capacite"] for m in manque] == ["repeindre_zone"] and manque[0]["reliable"]
    # Relier écrit un profil neuf ; celui d'origine n'a pas bougé.
    relie = normaliser(relier_ce_que_le_graphe_sait(p))
    assert relie["liaisons"][MASQUE] == [{"noeud": "6", "champ": "image"}]
    assert relie["liaisons"]["reference:0"] == [{"noeud": "4", "champ": "image"}]
    assert relie["references_min"] == 1 and capacites_du_profil(relie) == ["repeindre_zone"]
    assert MASQUE not in p["liaisons"]
    assert a_relier(relie) == []
    with pytest.raises(WorkflowRefuse, match="déjà tout"):
        relier_ce_que_le_graphe_sait(relie)


def test_un_clip_qui_ne_relie_pas_sa_fin_le_propose_et_sa_duree_se_signale():
    brut = profil_qui_finit()
    del brut["liaisons"][IMAGE_DE_FIN]
    p = normaliser(brut)
    assert capacites_du_profil(p) == ["animer"]
    assert [m["capacite"] for m in a_relier(p)] == ["finir_sur_image"]
    relie = normaliser(relier_ce_que_le_graphe_sait(p))
    assert capacites_du_profil(relie) == ["animer", "finir_sur_image"]
    # Une durée écrite dans le graphe, jamais reliée : dite, pas reliée seule —
    # il faut à l'auteur choisir les durées à proposer.
    wan = normaliser({"nom": "Wan maison", "nature": "video", "graphe": graphe_wan(),
                      "liaisons": {"prompt": [{"noeud": "1", "champ": "text"}], "reference:0": [{"noeud": "6", "champ": "image"}],
                                   IMAGE_DE_FIN: [{"noeud": "9", "champ": "image"}]},
                      "parametres": {}, "formats": [{"resolution": "480p", "proportions": "1:1", "largeur": 480, "hauteur": 480}],
                      "durees": [5], "cadence": 16, "sortie": {"noeud": "5", "champ": "videos"}})
    duree = a_relier(wan)
    assert [m["capacite"] for m in duree] == ["durees"] and not duree[0]["reliable"]
    assert "81 images" in duree[0]["texte"]


# ── De bout en bout, ComfyUI doublé ──────────────────────────────────────────


def _declarer(comfy, graphe, requis_facultatifs=()):
    for noeud in graphe.values():
        comfy.informations[noeud["class_type"]] = {"input": {"required": {c: ["ANY"] for c in noeud["inputs"]}},
                                                   "output_node": noeud["class_type"].startswith("Save")}
    for classe, champ in requis_facultatifs:
        entree = comfy.informations[classe]["input"]
        entree.setdefault("optional", {})[champ] = entree["required"].pop(champ)


async def test_relier_la_zone_fait_entrer_le_workflow_dans_repeindre_et_l_ancienne_version_se_relit(atelier_workflow):
    atelier, comfy = atelier_workflow
    _declarer(comfy, graphe_de_zone())
    ancien = atelier.profils_workflow.importer(profil_de_zone_non_relie())
    await atelier.catalogue.rafraichir()
    assert not atelier.catalogue.modele(ancien["modele"]).masque
    assert all(c["identifiant"] != ancien["modele"] for c in atelier.zone._choix())

    neuf = atelier.profils_workflow.relier(ancien["identifiant"], ancien["version"])
    await atelier.catalogue.rafraichir()
    assert neuf["version"] != ancien["version"]
    assert atelier.catalogue.modele(neuf["modele"]).masque
    choix = next(c for c in atelier.zone._choix() if c["identifiant"] == neuf["modele"])
    assert choix["nom"] == "Retouche maison" and choix["raison"] is None
    # Refermé, rouvert : l'ancienne version se relit telle qu'elle était.
    relu = atelier.profils_workflow.lire(ancien["identifiant"], ancien["version"])
    assert MASQUE not in relu["liaisons"] and relu["references_min"] == 0
    assert not comfy.envois


async def test_la_page_moteurs_liste_les_workflows_de_l_auteur_avec_leur_diagnostic(atelier_workflow):
    atelier, comfy = atelier_workflow
    _declarer(comfy, graphe_de_zone())
    atelier.profils_workflow.importer(profil_de_zone_non_relie())
    video = await ajouter(atelier, comfy, profil("video"))
    # Un style de sc-clone et un moteur sonore ont déjà leur section : jamais ici.
    style = profil()
    style["identifiant"], style["nom"] = "sdxl-pixelart", "Pixel art SDXL"
    style["style"] = {"famille": "sdxl", "declencheur": "pixel", "genre": "sprite", "vitesse": "vite", "source": "sc-clone", "reference": "depart"}
    atelier.profils_workflow.importer(style)
    son = copy.deepcopy(profil("video"))
    son["identifiant"] = "sa3-small-sfx"
    atelier.profils_workflow.importer(son)
    # Un fichier absent et un nœud absent : chacun sa ligne, en clair.
    comfy.informations["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"] = [["autre.safetensors"]]
    del comfy.informations["ImageToMask"]

    moteurs = {m["identifiant"]: m for m in await atelier.profils_workflow.importes()}
    assert set(moteurs) == {"retouche-maison", video["identifiant"]}
    zone = moteurs["retouche-maison"]
    assert zone["capacites"] == ["creer_image"] and zone["versions"] == 1
    assert [m["capacite"] for m in zone["a_relier"]] == ["repeindre_zone"]
    assert not zone["diagnostic"]["disponible"]
    genres = {e["genre"]: e for e in zone["diagnostic"]["a_completer"]}
    assert genres["noeud"]["classe"] == "ImageToMask" and genres["noeud"]["noeuds"] == ["7"]
    assert genres["fichier"]["fichier"] == "sdxl.safetensors" and "dossier de modèles" in genres["fichier"]["texte"]
    # Les phrases d'avant restent : le grisé du catalogue les lit toujours.
    assert "Nœud absent : ImageToMask (7)." in zone["diagnostic"]["problemes"]
    assert moteurs[video["identifiant"]]["capacites"] == ["animer"]
    assert moteurs[video["identifiant"]]["diagnostic"]["disponible"]
    assert all(methode == "GET" for methode, _ in comfy.requetes)


async def test_deux_noeuds_a_qui_il_manque_la_meme_chose_font_une_seule_ligne(atelier_workflow):
    """Vu au navigateur : les deux `CLIPTextEncode` d'un graphe (positif,
    négatif) disaient deux fois la même phrase. Une ligne, qui les nomme."""
    atelier, comfy = atelier_workflow
    _declarer(comfy, graphe_de_zone())
    del comfy.informations["CLIPTextEncode"]["input"]["required"]["clip"]
    garde = atelier.profils_workflow.importer(profil_de_zone_non_relie())
    diagnostic = await atelier.profils_workflow.diagnostiquer(garde["identifiant"], garde["version"])
    champs = [e for e in diagnostic["a_completer"] if e["genre"] == "champ"]
    assert len(champs) == 1 and champs[0]["noeuds"] == ["2", "3"] and champs[0]["champ"] == "clip"
    assert len([p for p in diagnostic["problemes"] if "clip" in p]) == 2  # les phrases d'avant, inchangées


async def test_comfyui_eteint_se_dit_en_une_ligne(atelier_workflow):
    atelier, comfy = atelier_workflow
    from atelier.fournisseur.workflow import MoteurWorkflow

    atelier.profils_workflow.importer(profil_de_zone_non_relie())

    def eteint(req):
        raise httpx.ConnectError("refusé", request=req)
    atelier.profils_workflow.fabrique_moteur = lambda: MoteurWorkflow("http://comfy.test", httpx.MockTransport(eteint))
    moteur = (await atelier.profils_workflow.importes())[0]
    assert [e["genre"] for e in moteur["diagnostic"]["a_completer"]] == ["comfyui"]


async def test_une_fin_obligatoire_chez_comfyui_grise_le_clip_libre(atelier_workflow):
    """MO3 retirait `end_image` sans savoir si ComfyUI la tient pour
    facultative. MO6 le lit : obligatoire, un clip sans fin se grise avec sa
    raison au lieu d'être refusé par ComfyUI à l'envoi."""
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil_qui_finit())  # tout est « required » dans le double
    diagnostic = await atelier.profils_workflow.diagnostiquer(p["identifiant"], p["version"])
    assert diagnostic["fin_libre"] is False and "end_image" in diagnostic["remarques"][0]
    assert diagnostic["disponible"]  # avec une fin, il tourne
    modele = atelier.animation.modele(p["modele"])
    assert modele.exige_une_image_de_fin
    sans_fin = {l["identifiant"]: l for l in atelier.animation.catalogue(DemandeClip(texte="", image=b"\0", secondes=5))}
    assert "ne sait finir que sur une image choisie" in sans_fin[p["modele"]]["grise"]
    assert sans_fin[p["modele"]]["capacites"]["image_de_fin"] == "obligatoire"
    avec_fin = {l["identifiant"]: l for l in atelier.animation.catalogue(DemandeClip(texte="", image=b"\0", secondes=5, image_de_fin=b"\0"))}
    assert avec_fin[p["modele"]]["grise"] is None
    # Facultative chez ComfyUI : le clip finit libre, comme MO3 le voulait.
    entree = comfy.informations["Sampler"]["input"]
    entree.setdefault("optional", {})["end_image"] = entree["required"].pop("end_image")
    await atelier.animation.rafraichir()
    assert not atelier.animation.modele(p["modele"]).exige_une_image_de_fin
    assert (await atelier.profils_workflow.diagnostiquer(p["identifiant"], p["version"]))["fin_libre"] is True


async def test_les_trois_routes_par_l_application(atelier_workflow):
    atelier, comfy = atelier_workflow
    _declarer(comfy, graphe_de_zone())
    comfy.informations["WanFirstLastFrameToVideo"] = {"input": {"required": {"length": ["INT", {"step": 4}]}}}
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
            r = await client.post("/api/workflow-profiles/read-graph", json={"graphe": graphe_wan()})
            assert r.status_code == 200, r.text
            assert r.json()["image_de_fin"] == {"noeud": "9", "champ": "image"} and r.json()["pas_images"] == 4
            r = await client.post("/api/workflow-profiles", json=profil_de_zone_non_relie())
            garde = r.json()
            r = await client.get("/api/workflow-profiles/imported")
            assert [m["identifiant"] for m in r.json()["moteurs"]] == ["retouche-maison"]
            r = await client.post(f"/api/workflow-profiles/{garde['identifiant']}/versions/{garde['version']}/bind-deduced")
            assert r.status_code == 200, r.text
            neuf = r.json()
            assert MASQUE in neuf["liaisons"]
            # Le catalogue s'est relu : le moteur est dans « Repeindre » aussitôt.
            assert atelier.catalogue.modele(neuf["modele"]).masque
            r = await client.get("/api/workflow-profiles/imported")
            moteur = r.json()["moteurs"][0]
            assert moteur["capacites"] == ["repeindre_zone"] and moteur["versions"] == 2 and moteur["a_relier"] == []
            r = await client.post(f"/api/workflow-profiles/{neuf['identifiant']}/versions/{neuf['version']}/bind-deduced")
            assert r.status_code >= 400
    assert not comfy.envois
