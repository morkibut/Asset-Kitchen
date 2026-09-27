# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder les workflows importés (MO6) au navigateur,
sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8512, avec ComfyUI doublé : rien n'est
payé, aucun calcul GPU n'a lieu, rien n'est écrit dans `donnees/`.

Trois workflows importés, un de chaque cas :

- **« Retouche maison »** — un graphe de retouche importé comme un graphe seul :
  le texte relié, ni la zone ni l'image d'en dessous. Sa carte, dans Réglages ›
  Moteurs & workflows › « Les workflows importés », dit que son graphe reçoit
  une zone ; « Relier ce que son graphe reçoit » en fait une version qui entre
  dans « Repeindre » (à ouvrir sur l'image de Mara) ;
- **« Wan maison »** — un « première et dernière image » dont ComfyUI tient
  `end_image` pour obligatoire : « Finit toujours sur une image », et, dans
  « Faire une vidéo libre », grisé tant qu'aucune fin n'est choisie ;
- **« Agrandir x4 »** — un nœud que ComfyUI n'a pas et un fichier absent :
  « À compléter », chacun sur sa ligne.

Et pour l'import : coller le graphe de `graphe_de_zone()` ou de `graphe_wan()`
(`tests/test_mo6_workflows_importes.py`) dans « Ajouter un workflow » doit
préremplir la zone, l'image de fin et le nombre d'images.

**Un vrai personnage, copié** (Mara, *The Way Out reborn*, repos), pour ouvrir
« Repeindre » sans fabriquer de sprite de toutes pièces.

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_mo6.py --interface <dossier>

Ctrl-C pour l'arrêter.
"""
from __future__ import annotations

import argparse
import asyncio
import shutil
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import atelier.api.app as application  # noqa: E402
from atelier.domaine.workflow import IMAGE_DE_FIN  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import ComfyDouble, raccorder  # noqa: E402
from tests.test_mo6_workflows_importes import graphe_de_zone, graphe_wan, profil_de_zone_non_relie  # noqa: E402

PORT = 8512
MARA = Path("generations") / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"


def trouver_mara() -> Path:
    """Dans `donnees/` du dépôt — ou du dépôt principal, depuis un worktree."""
    for dossier in (RACINE, *RACINE.parents):
        chemin = dossier / "donnees" / MARA
        if chemin.exists():
            return chemin
    raise SystemExit("Mara introuvable : lancer depuis le dépôt de l'auteur.")


def declarer(comfy: ComfyDouble, graphe: dict, facultatifs: tuple[str, ...] = ("clip", "filename_prefix")) -> None:
    """Déclare les nœuds du graphe à ComfyUI doublé, **en ajoutant** aux
    déclarations déjà faites : deux graphes qui partagent une classe ne
    s'écrasent pas. Les champs `facultatifs` le sont chez le vrai ComfyUI."""
    for noeud in graphe.values():
        entree = comfy.informations.setdefault(noeud["class_type"], {"input": {"required": {}, "optional": {}},
                                                                     "output_node": noeud["class_type"].startswith("Save")})["input"]
        for champ in noeud["inputs"]:
            if champ not in entree["required"] and champ not in entree.setdefault("optional", {}):
                entree["optional" if champ in facultatifs else "required"][champ] = ["ANY"]


def wan_maison() -> dict:
    return {"identifiant": "wan-maison", "nom": "Wan maison", "nature": "video", "graphe": graphe_wan(),
            "liaisons": {"prompt": [{"noeud": "1", "champ": "text"}], "reference:0": [{"noeud": "6", "champ": "image"}],
                         IMAGE_DE_FIN: [{"noeud": "9", "champ": "image"}]},
            "parametres": {}, "formats": [{"resolution": "480p", "proportions": "1:1", "largeur": 480, "hauteur": 480}],
            "durees": [5], "cadence": 16, "sortie": {"noeud": "5", "champ": "videos"}}


def agrandir() -> dict:
    graphe = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "4x-UltraSharp.pth"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": ""}},
        "3": {"class_type": "UltimateSDUpscale", "inputs": {"model": ["1", 0], "positive": ["2", 0], "upscale_by": 4}},
        "4": {"class_type": "SaveImage", "inputs": {"images": ["3", 0]}},
    }
    return {"identifiant": "agrandir-x4", "nom": "Agrandir x4", "nature": "image", "graphe": graphe,
            "liaisons": {"prompt": [{"noeud": "2", "champ": "text"}]}, "parametres": {},
            "formats": [{"resolution": "1024", "proportions": "1:1", "largeur": 1024, "hauteur": 1024}],
            "durees": [], "cadence": 0, "sortie": {"noeud": "4", "champ": "images"}}


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-mo6-"))
    print(f"Dossier jetable : {dossier}")

    comfy = ComfyDouble()
    atelier = Atelier(racine=dossier / "donnees", fabrique_fournisseur=lambda: FournisseurDouble(),
                      fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    declarer(comfy, graphe_de_zone())
    declarer(comfy, graphe_wan())  # `end_image` reste obligatoire : « Finit toujours sur une image »
    comfy.informations["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"] = [["sdxl.safetensors"]]
    for p in (profil_de_zone_non_relie(), wan_maison(), agrandir()):
        atelier.profils_workflow.importer(p)
    asyncio.run(atelier.catalogue.rafraichir())
    asyncio.run(atelier.animation.rafraichir())

    copie = dossier / "copies" / "mara.png"
    copie.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(trouver_mara(), copie)
    with TestClient(application.creer_application(atelier)) as client:
        projet = atelier.bibliotheque.courant
        image = atelier.generations.importer(copie.read_bytes(), "Mara, repos", projet=projet)["asset"]["identifiant"]
        mara = client.post("/api/characters", json={"nom": "Mara", "description": "une exploratrice des ruines"}).json()["personnage"]["identifiant"]
        pose = atelier.production.plan(projet)[0].identifiant
        client.put(f"/api/assets/{image}/character", json={"personnage": mara, "pose": pose})
        print(f"  image de Mara : {image} — pose « {pose} »")

    print(f"Atelier jetable sur http://127.0.0.1:{lus.port} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(application.creer_application(atelier), host="127.0.0.1", port=lus.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
