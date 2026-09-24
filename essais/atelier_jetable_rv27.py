# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier RV27 au navigateur, sans toucher à celui de l'auteur.

**RV27 — « Relire avant l'envoi » : la colonne des images tient son texte.**
Cet atelier-ci vit sur un dossier temporaire, sur le port 8432 — l'auteur
travaille sur 8420 et 8421, qui ne bougent pas, et 8426/8430 servent déjà
d'autres vérifications en cours.

Il monte un sujet (« Vagabonde ») avec une image de référence déjà promue, et
un fournisseur doublé : rien n'est payé, rien n'écrit dans `donnees/`.

## Ce qu'on vient voir à l'écran

1. Ouvrir la fiche de Vagabonde → onglet *Images*.
2. En bas, la barre « Fabriquer » : écrire un prompt, cliquer
   « Relire avant l'envoi ».
3. Sur l'écran de confirmation, la colonne de droite « Images envoyées » :
   la vignette, le rôle et la phrase de l'image jointe se lisent sans
   déborder, à 1920 px comme à 1280 px de large — et sans barre de
   défilement horizontale sur toute la page.

⚠️ Cet atelier sert l'interface par le serveur de développement Vite (le
worktree n'a pas d'`interface/dist`, et il ne doit pas en avoir) : lance
`npm --prefix interface run dev` à côté, avec `VITE_API_PORT=8432`.

    .venv/Scripts/python.exe essais/atelier_jetable_rv27.py

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
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8432


def peupler(atelier) -> str:
    """Par les vraies routes HTTP : c'est par elles que l'écran lira."""
    with TestClient(creer_application(atelier)) as client:
        client.put("/api/universe", json={"vue": "vue-dessus-34"})
        sujet = client.post("/api/characters", json={"nom": "Vagabonde"})
        assert sujet.status_code == 201, sujet.text
        sujet = sujet.json()["personnage"]["identifiant"]

        recu = client.post(
            "/api/assets/upload",
            content=image_sujet(),
            params={"nom": "vagabonde-face.png", "traiter": "false"},
        )
        assert recu.status_code == 201, recu.text
        asset = recu.json()["asset"]["identifiant"]
        client.put(f"/api/assets/{asset}/character", json={"personnage": sujet, "pose": None})
        rangee = client.put(
            f"/api/characters/{sujet}/references",
            json={"asset": asset, "usage": "planche"},
        )
        assert rangee.status_code == 200, rangee.text
        print("  image de référence promue, rangée « planche »")
        return sujet


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rv27-"))
    print(f"Dossier jetable : {dossier}")
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    sujet = peupler(atelier)
    print(f"  Vagabonde : {sujet}")
    print()
    print(f"Atelier jetable (API) sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("Ouvre l'interface par le serveur de dev Vite (voir l'en-tête du fichier).")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
