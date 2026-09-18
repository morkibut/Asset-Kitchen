# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier au navigateur les textes d'animation par jeu.

**L'auteur travaille sur le port 8420 pendant la séance.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8424, avec les doubles des essais : rien
n'est payé, rien n'est écrit dans `donnees/`.

Le jeu reçoit une vue isométrique (quatre directions), pour que le bloc « Les
directions en animation » ait de quoi montrer ses phrases proposées.

    py essais/atelier_jetable_textes_animes.py

Ctrl-C pour l'arrêter.
"""

from __future__ import annotations

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

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8424


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-textes-animes-"))
    print(f"Dossier jetable : {dossier}")

    def monter() -> Atelier:
        return Atelier(
            racine=dossier,
            fabrique_fournisseur=lambda: FournisseurDouble(),
            fabrique_animateur=lambda: AnimateurMuet(),
        )

    with TestClient(creer_application(monter())) as client:
        client.put("/api/universe", json={"vue": "vue-isometrique"})
        directions = client.get("/api/characters/directions").json()["directions"]
        print(f"  directions du jeu : {', '.join(d['nom'] for d in directions)}")

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    uvicorn.run(
        creer_application(monter()), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
