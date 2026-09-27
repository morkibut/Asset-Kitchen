# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder le pied du carnet — « En cours · Arrivé »
(`SuiviDuCarnet.tsx`) — au navigateur, sans toucher à celui de l'auteur.

Dossier temporaire, port 8421, fournisseur doublé : rien n'est payé. **Chaque
génération met vingt secondes à revenir**, le temps de quitter l'écran et de
la voir tourner dans le pied du carnet, puis arriver.

Un vrai personnage, copié (Mara), pour que ce qui arrive ait une vignette.

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_suivi.py --interface <dossier>
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
from atelier.services import Atelier  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402

PORT = 8421
MARA = RACINE / "donnees" / "generations" / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"
LENTEUR_S = 20


class FournisseurLent(FournisseurDouble):
    async def generer(self, modele, demande):
        await asyncio.sleep(LENTEUR_S)
        return await super().generer(modele, demande)


def peupler(atelier, dossier: Path) -> None:
    copie = dossier / "copies" / "mara.png"
    copie.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(MARA, copie)
    with TestClient(application.creer_application(atelier)) as client:
        projet = atelier.bibliotheque.courant
        image = atelier.generations.importer(copie.read_bytes(), "Mara, repos", projet=projet)["asset"]["identifiant"]
        mara = client.post("/api/characters", json={"nom": "Mara", "description": "une exploratrice des ruines"}).json()["personnage"]["identifiant"]
        pose = atelier.production.plan(projet)[0].identifiant
        client.put(f"/api/assets/{image}/character", json={"personnage": mara, "pose": pose})


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-suivi-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurLent()
    double.rendre = lambda: MARA.read_bytes()
    atelier = Atelier(racine=dossier / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    asyncio.run(atelier.catalogue.rafraichir())
    peupler(atelier, dossier)

    print(f"Atelier jetable sur http://127.0.0.1:{lus.port} — chaque génération revient en {LENTEUR_S} s")
    uvicorn.run(application.creer_application(atelier), host="127.0.0.1", port=lus.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
