# -*- coding: utf-8 -*-
"""Un atelier jetable pour jouer le parcours de PX9 au navigateur — « Repeindre,
de A à Z » —, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8429, avec le fournisseur et ComfyUI
doublés : rien n'est payé, aucun calcul GPU n'a lieu, rien n'est écrit dans
`donnees/`, et l'atelier de l'auteur ne bouge pas d'un pixel.

**Un vrai personnage, copié** : l'image de Mara (*The Way Out reborn*, repos ·
vue de profil) est **copiée** dans le dossier temporaire — le fichier seul —, et
rangée dans la pose « repos » d'un sujet « Mara ». Le ComfyUI doublé rend, dans
la zone peinte, **ce que le vrai moteur a rendu le 26 septembre 2026** pour le
sac à dos (la génération `dc6a9ac8…`, relue et copiée, jamais modifiée) : le fond
du moteur y est remplacé par celui de la toile partie, le reste de l'image est
la toile telle qu'elle est partie. Le parcours se joue donc sur un vrai sac.

**L'interface est compilée à part** (`--interface`, un dossier que
`npx vite build --outDir` a rempli) pour ne pas toucher à `interface/dist`,
que l'atelier de l'auteur sert.

    npx --prefix interface vite build --outDir <dossier>
    py essais/atelier_jetable_px9.py --interface <dossier>

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""
from __future__ import annotations

import argparse
import io
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
import numpy as np  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import atelier.api.app as application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.test_a9 import AnimateurDouble  # noqa: E402
from tests.test_au7_au8 import raccorder  # noqa: E402
from tests.test_px2_masque import ComfyZoneDouble, octets_deposes  # noqa: E402
from tests.conftest import FournisseurDouble  # noqa: E402

PORT = 8429
ZONE_PRETE = "sdxl-retouche-zone"
MARA = RACINE / "donnees" / "generations" / "74fb37381f65400a8740ed5a9db14003" / "101-rendu.png"
SAC = RACINE / "donnees" / "generations" / "dc6a9ac87de449d7b8289ac62850d1df" / "0-brut.png"
FOND_DU_MOTEUR = np.array((0, 255, 255))


class ComfyQuiRendLeVraiSac(ComfyZoneDouble):
    """Dans la zone déposée : l'image que le vrai moteur a rendue, son fond
    remplacé par celui de la toile. Hors de la zone : la toile telle quelle."""

    def __init__(self, sac: bytes):
        super().__init__()
        self.sac = sac

    def repondre(self, req):
        if req.url.path == "/view":
            toile = masque = None
            for nom, corps in self.depots:
                octets = octets_deposes(corps)
                if nom.startswith("atelier-masque-"):
                    masque = octets
                else:
                    toile = octets
            rgb = np.asarray(Image.open(io.BytesIO(toile)).convert("RGB")).astype(np.int32)
            zone = np.asarray(Image.open(io.BytesIO(masque)).convert("L")) >= 128
            fond = rgb[0, 0].copy()
            h, w = rgb.shape[:2]
            sac = np.asarray(Image.open(io.BytesIO(self.sac)).convert("RGB").resize((w, h), Image.NEAREST)).astype(np.int32)
            du_fond = np.abs(sac - FOND_DU_MOTEUR[None, None, :]).sum(axis=2) < 45
            sac[du_fond] = fond
            sortie = rgb.copy()
            grand = np.asarray(Image.fromarray(zone).resize((w, h), Image.NEAREST)) if zone.shape != (h, w) else zone
            sortie[grand] = sac[grand]
            tampon = io.BytesIO()
            Image.fromarray(sortie.astype(np.uint8)).save(tampon, format="PNG")
            return httpx.Response(200, content=tampon.getvalue())
        return super().repondre(req)


def peupler(atelier, dossier: Path) -> tuple[str, str]:
    """Mara, copiée, rangée dans « repos » — de quoi ouvrir sa fiche, puis la
    retouche, puis « Repeindre une zone »."""
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
        return image, mara


def principal() -> int:
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--interface", type=Path, default=None)
    arguments.add_argument("--port", type=int, default=PORT)
    lus = arguments.parse_args()
    if lus.interface is not None:
        application.INTERFACE = lus.interface.resolve()
    dossier = Path(tempfile.mkdtemp(prefix="atelier-px9-"))
    print(f"Dossier jetable : {dossier}")
    sac = dossier / "copies" / "sac-du-moteur.png"
    sac.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SAC, sac)

    double = FournisseurDouble()
    comfy = ComfyQuiRendLeVraiSac(sac.read_bytes())
    atelier = Atelier(
        racine=dossier / "donnees",
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)
    import asyncio
    asyncio.run(atelier.styles_locaux.installer(ZONE_PRETE))
    asyncio.run(atelier.catalogue.rafraichir())
    peupler(atelier, dossier)

    print(f"Atelier jetable sur http://127.0.0.1:{lus.port} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(application.creer_application(atelier), host="127.0.0.1", port=lus.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
