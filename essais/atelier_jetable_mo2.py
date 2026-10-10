# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder la page « Moteurs » (MO2) au navigateur,
sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8421, avec le fournisseur et ComfyUI
doublés : rien n'est payé, aucun calcul GPU n'a lieu, rien n'est écrit dans
`donnees/`, et l'atelier de l'auteur ne bouge pas d'un pixel.

ComfyUI est doublé avec le même relevé réel que ML2
(`tests/fixtures/object_info_local.json`) : les vingt-trois styles s'y
trouvent tous « prêts ». `zimage-pixel` est installé d'avance — de quoi voir
une carte « Installé » sur cette machine — et la famille `sdxl` reste
volontairement non installée : c'est elle qui, dans l'écran Retouche, montre
le lien « l'installer dans Moteurs › » (MO2) vers la carte mise en évidence.

**Un vrai personnage, copié** (Mara, *The Way Out reborn*, repos), pour ouvrir
Retouche sans fabriquer de sprite de toutes pièces.

**L'interface est compilée à part** pour ne pas toucher à `interface/dist` :

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_mo2.py --interface <dossier>

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""
from __future__ import annotations

import argparse
import asyncio
import json
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
from atelier.services import Atelier  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import raccorder  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402

PORT = 8421
MARA = RACINE / "donnees" / "generations" / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"
OBJECT_INFO = json.loads((RACINE / "tests" / "fixtures" / "object_info_local.json").read_text(encoding="utf-8"))
# PX2 ajoute les deux nœuds du masque (`ImageToMask`, `SetLatentNoiseMask`) —
# absents du relevé du 18 septembre, donc « sdxl-retouche-zone » resterait
# grisé « fichiers manquants » sans eux, et le lien de redirection (MO2) ne
# se verrait jamais : c'est justement ce lien-là qu'on vient regarder ici.
OBJECT_INFO["ImageToMask"] = {"input": {"required": {"image": ["IMAGE"], "channel": [["red", "green", "blue", "alpha"]]}}}
OBJECT_INFO["SetLatentNoiseMask"] = {"input": {"required": {"samples": ["LATENT"], "mask": ["MASK"]}}}
INSTALLE_D_AVANCE = "zimage-pixel"


class ComfyStylesDouble:
    """Sert le relevé réel de la machine ; jamais /prompt (aucune génération
    n'a lieu depuis cet atelier jetable — on ne fait que regarder l'état)."""

    def repondre(self, req):
        if req.url.path == "/object_info":
            return httpx.Response(200, json=OBJECT_INFO)
        raise AssertionError(f"cet atelier jetable ne sert que /object_info, pas {req.url.path}")


def peupler(atelier, dossier: Path) -> str:
    """Mara, copiée, rangée dans « repos » — de quoi ouvrir sa fiche puis Retouche."""
    copie = dossier / "copies" / "mara.png"
    copie.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(MARA, copie)
    with TestClient(application.creer_application(atelier)) as client:
        projet = atelier.bibliotheque.courant
        image = atelier.generations.importer(copie.read_bytes(), "Mara, repos", projet=projet)["asset"]["identifiant"]
        mara = client.post("/api/characters", json={"nom": "Mara", "description": "une exploratrice des ruines"}).json()["personnage"]["identifiant"]
        pose = atelier.production.plan(projet)[0].identifiant
        client.put(f"/api/assets/{image}/character", json={"personnage": mara, "pose": pose})
        print(f"  image de Mara : {image} — pose « {pose} »")
        return image


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-mo2-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    comfy = ComfyStylesDouble()
    atelier = Atelier(
        racine=dossier / "donnees",
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)
    asyncio.run(atelier.styles_locaux.installer(INSTALLE_D_AVANCE))
    asyncio.run(atelier.catalogue.rafraichir())
    peupler(atelier, dossier)

    print(f"Atelier jetable sur http://127.0.0.1:{lus.port} — Ctrl-C pour arrêter")
    print(f"« {INSTALLE_D_AVANCE} » (Z-Image Turbo) est installé d'avance ; SDXL et les autres ne le sont pas.")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(application.creer_application(atelier), host="127.0.0.1", port=lus.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
