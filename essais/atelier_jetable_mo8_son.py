# -*- coding: utf-8 -*-
"""MO8 : un atelier jetable pour fabriquer un son au navigateur (MO4), sans
toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8515, avec ComfyUI doublé (le même
relevé réel que SN1, `tests/object_info_son.json`) : rien n'est payé, aucun
calcul GPU n'a lieu, rien n'est écrit dans `donnees/`.

Les cinq moteurs sonores sont installés d'avance (`ServiceInstallationSon.
installer()`, comme le fait le bouton « Installer les méthodes sonores
prêtes » sur la page Moteurs) : la page les montre tous « Installé », de quoi
choisir un moteur et fabriquer un bruitage pour de vrai — la file locale
tourne, ComfyUI doublé répond « terminé » à la première question.

**Un vrai personnage, copié** (Mara, *The Way Out reborn*, repos), pour ouvrir
« Fabriquer un son » sur un vrai sujet plutôt qu'un sprite fabriqué pour
l'occasion.

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_mo8_son.py --interface <dossier>

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
from atelier.audio.graphes import CONSTRUCTEURS  # noqa: E402
from atelier.domaine.workflow import normaliser  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import raccorder  # noqa: E402
from tests.test_sn1_installation import ComfySortieChoisie  # noqa: E402
from tests.test_sn1_profils_son import OBJECT_INFO, installe  # noqa: E402

PORT = 8515
MARA = Path("generations") / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"


def trouver_mara() -> Path:
    """Dans `donnees/` du dépôt — ou du dépôt principal, depuis un worktree."""
    for dossier in (RACINE, *RACINE.parents):
        chemin = dossier / "donnees" / MARA
        if chemin.exists():
            return chemin
    raise SystemExit("Mara introuvable : lancer depuis le dépôt de l'auteur.")


def object_info_complet():
    """`/object_info` d'une machine qui a posé les cinq moteurs sonores —
    même geste que `test_sn1_installation.son`."""
    info = OBJECT_INFO
    for construire in CONSTRUCTEURS.values():
        info = installe(info, normaliser(construire()))
    return info


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-mo8-son-"))
    print(f"Dossier jetable : {dossier}")

    comfy = ComfySortieChoisie()
    comfy.informations = object_info_complet()
    atelier = Atelier(racine=dossier / "donnees", fabrique_fournisseur=lambda: FournisseurDouble(),
                      fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    asyncio.run(atelier.installation_son.installer())
    atelier.travaux_audio.intervalle = .01
    asyncio.run(atelier.catalogue.rafraichir())

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
    print("Les cinq moteurs sonores sont installés d'avance.")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(application.creer_application(atelier), host="127.0.0.1", port=lus.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
