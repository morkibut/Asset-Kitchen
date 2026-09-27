# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder la vidéo du catalogue des moteurs (MO3) au
navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8421, avec tout doublé : rien n'est payé,
aucun calcul GPU n'a lieu, rien n'est écrit dans `donnees/`.

Les trois sources du catalogue vidéo y sont, chacune doublée à sa façon :

- **la maison** — la vraie fiche de Wan (`modele_de_la_maison`), derrière un
  animateur doublé qui dit qu'il manque un fichier : la carte « À installer » ;
- **en ligne** — deux modèles d'essai sous le nom « OpenRouter », l'un qui sait
  finir sur une image, l'autre non ;
- **deux workflows vidéo importés** — le vrai `AnimateurWorkflow` devant un
  ComfyUI doublé : « Première et dernière image » relie une image de fin,
  « Image vers vidéo » non. Choisir « Finir sur l'image de départ (boucle) »
  dans « 4. Le clip » doit griser le second et pas le premier.

**Un vrai personnage, copié** (Mara, *The Way Out reborn*, repos), pour ouvrir
« Animer » sans fabriquer de sprite de toutes pièces.

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_mo3.py --interface <dossier>

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

import httpx  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import atelier.api.app as application  # noqa: E402
from atelier.domaine.animation import ModeleVideo, Tarification  # noqa: E402
from atelier.fournisseur.maison import EtatDuMoteur, FichierDeModele, modele_de_la_maison  # noqa: E402
from atelier.fournisseur.workflow import AnimateurWorkflow  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import ComfyDouble, profil  # noqa: E402
from tests.test_mo3_catalogue_video import profil_qui_finit  # noqa: E402

PORT = 8421
MARA = Path("generations") / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"


def trouver_mara() -> Path:
    """Dans `donnees/` du dépôt — ou du dépôt principal, depuis un worktree."""
    for dossier in (RACINE, *RACINE.parents):
        chemin = dossier / "donnees" / MARA
        if chemin.exists():
            return chemin
    raise SystemExit("Mara introuvable : lancer depuis le dépôt de l'auteur.")


def en_ligne() -> AnimateurDouble:
    porte = AnimateurDouble()
    porte.nom, porte.source = "OpenRouter", "en_ligne"
    base = dict(fournisseur="OpenRouter", resolutions=("480p", "720p"), proportions=("1:1", "16:9"))
    porte.modeles = [
        ModeleVideo(identifiant="OpenRouter:bytedance/seedance-2.0-mini", nom="Seedance 2.0 Mini", chez_lui="bytedance/seedance-2.0-mini",
                    durees=(5, 10), accepte_une_image_de_fin=True, tarification=Tarification("seconde", 0.03, "video_seconds_480p"), **base),
        ModeleVideo(identifiant="OpenRouter:essai/sans-fin", nom="Clip sans fin", chez_lui="essai/sans-fin",
                    durees=(5,), tarification=Tarification("seconde", 0.05, "video_seconds_480p"), **base),
    ]
    return porte


def maison() -> AnimateurDouble:
    porte = AnimateurDouble()
    porte.nom, porte.source = "Maison", "maison"
    porte.modeles = [modele_de_la_maison()]
    manquant = FichierDeModele(nom="wan2.2_i2v_low_noise_14B_fp8.safetensors", famille="diffusion_models",
                               adresse="https://exemple.invalid/wan", taille_annoncee=14 * 1024**3)
    etat = EtatDuMoteur(allume=True, manquants=(manquant,))
    porte.etat_du_moteur = lambda: etat
    # `GET /clips/engine` (MO8, trouvé au navigateur) : `FabricationSuivie.tsx`
    # et `FabricationVideoLibre.tsx` l'appellent sans condition au montage pour
    # la carte « Attente mesurée » — `_moteur()` retrouve ce double par son nom
    # (« Maison ») et attend la même interface que `MoteurDeLaMaison`, pas
    # seulement `etat_du_moteur` (lu ailleurs, par le catalogue). Sans elle :
    # 500 attrapé côté écran (`.catch(() => setMoteur(null))`), donc invisible
    # à l'usage, mais une trace en clair à chaque ouverture de ces deux écrans.
    async def visiter() -> EtatDuMoteur:
        return etat
    porte.visiter = visiter
    return porte


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-mo3-"))
    print(f"Dossier jetable : {dossier}")

    comfy = ComfyDouble()
    atelier = Atelier(racine=dossier / "donnees", fabrique_fournisseur=lambda: FournisseurDouble(),
                      fabrique_animateur=lambda: AnimateurDouble())
    transport = httpx.MockTransport(comfy.repondre)
    payant, carte = en_ligne(), maison()
    atelier.animation._fabriques = (lambda: payant, lambda: carte,
        lambda: AnimateurWorkflow(atelier.profils_workflow, atelier.fichiers, "http://comfy.test", transport))
    atelier.profils_workflow.fabrique_moteur = lambda: AnimateurWorkflow(atelier.profils_workflow, atelier.fichiers, "http://comfy.test", transport)
    libre = profil("video")
    libre["identifiant"], libre["nom"] = "image-vers-video", "Image vers vidéo"
    for p in (libre, profil_qui_finit()):
        comfy.declarer(p)
        atelier.profils_workflow.importer(p)
    # `end_image` est facultatif chez ComfyUI, comme sur `WanFirstLastFrameToVideo`.
    requis = comfy.informations["Sampler"]["input"]
    requis.setdefault("optional", {})["end_image"] = requis["required"].pop("end_image", ["IMAGE"])
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
