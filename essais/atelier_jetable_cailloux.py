# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder les cailloux au bord et le zoom de la carte des
tuiles au navigateur, sans toucher à celui de l'auteur (port 8420).

Il vit sur un dossier temporaire, sur le port 8426, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`. Un jeu « Essai des
cailloux » y est créé et ouvert ; les jeux de tuiles se fabriquent sur la machine,
donc tout ce qu'on y clique est gratuit.

    py essais/atelier_jetable_cailloux.py
    cd interface && npx vite --config vite.jetable.config.ts   (sert l'écran sur 5174)

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
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

PORT = 8426


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-cailloux-"))
    print(f"Dossier jetable : {dossier}")
    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: AnimateurMuet())
    with TestClient(creer_application(atelier)) as client:
        r = client.post("/api/projects", json={"nom": "Essai des cailloux"})
        assert r.status_code == 201, r.text
    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
