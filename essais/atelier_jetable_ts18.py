# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier TS18 au navigateur, sans toucher à celui de l'auteur.

**TS18 — une carte s'ouvre dans l'atelier de retouche.** Cet atelier-ci vit sur
un dossier temporaire, sur le port 8433 — l'auteur travaille sur 8420 et 8421,
qui ne bougent pas.

Il pose deux cartes sur la toile :

- **« déjà en bibliothèque »** — une image générée (fournisseur doublé, gratuit),
  posée sur la toile par `poser_asset` (T4) : sa `source` porte `asset:<id>`.
  « Retoucher dans l'atelier » doit ouvrir **cet asset-là**, sans en copier un
  second.
- **« collée à la main »** — des octets collés directement (`coller_image`),
  sans asset. « Retoucher dans l'atelier » doit alors faire entrer une copie
  neuve en bibliothèque, une seule fois même en répétant le clic.

## Ce qu'on vient voir à l'écran

1. Aller dans « Univers & toile », onglet Inspiration, vue « toile ».
2. Cliquer « déjà en bibliothèque » : son détail paraît dans la colonne de
   droite, avec le bouton « Retoucher dans l'atelier ».
3. Cliquer ce bouton : l'atelier de retouche s'ouvre sur cette image, avec
   ses outils — comme depuis la Galerie.
4. Dans la retouche, « Poser sur la toile » (visible ici, et seulement ici —
   pas depuis la Galerie) pose une carte neuve sur la toile, reliée par un
   trait à la carte d'origine. Ni la carte ni l'image brute ne bougent.
5. Fermer, cliquer « collée à la main », « Retoucher dans l'atelier » : une
   copie neuve entre en bibliothèque (visible dans la Galerie), l'originale
   collée sur la toile ne change pas. Répéter le clic ne fait pas de seconde
   copie.

⚠️ Cet atelier sert l'interface par le serveur de développement Vite (le
worktree n'a pas d'`interface/dist`, et il ne doit pas en avoir) : lance
`npm --prefix interface run dev` à côté, avec `VITE_API_PORT=8433`.

    .venv/Scripts/python.exe essais/atelier_jetable_ts18.py

Ctrl-C pour l'arrêter.
"""

from __future__ import annotations

import sys
import tempfile
import time
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

PORT = 8433
MODELE = "essai:rend-du-png"


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        statuts = {e["statut"] for e in etat["emplacements"]}
        if statuts <= {"reussie", "echouee", "interrompue"}:
            return etat
        time.sleep(0.01)
    return client.get(f"/api/generations/{generation}").json()


def peupler(atelier) -> None:
    """Par les vraies routes HTTP : c'est par elles que l'écran lira."""
    with TestClient(creer_application(atelier)) as client:
        cree = client.post("/api/projects", json={"nom": "Le Marais"})
        assert cree.status_code == 201, cree.text
        projet = cree.json()["projet"]["identifiant"]
        print("  projet « Le Marais » créé et ouvert")

        # ── Une image déjà en bibliothèque, posée sur la toile ───────────────
        generee = client.post(
            "/api/generations",
            json={"modele": MODELE, "prompt": "une hutte au bord de l'eau", "resolution": "512"},
        )
        assert generee.status_code == 202, generee.text
        arrivee = _attendre(client, generee.json()["identifiant"])
        rang = arrivee["emplacements"][0]["rang"]
        asset = f"{arrivee['identifiant']}-{rang}"

        posee = client.post(f"/api/projects/{projet}/board/assets/{asset}")
        assert posee.status_code == 200, posee.text
        client.put(
            f"/api/board/{posee.json()['carte']['identifiant']}",
            json={"position": [0, 0], "note": "déjà en bibliothèque"},
        )
        print(f"  asset {asset} posé sur la toile — sa carte porte « asset:{asset} »")

        # ── Une image collée à la main, sans asset ───────────────────────────
        collee = client.post(
            "/api/board/paste?nom=collee.png",
            content=image_sujet(bloc=6),
        )
        assert collee.status_code == 201, collee.text
        carte = collee.json()["carte"]
        assert carte, f"lue comme un doublon : {collee.json()}"
        client.put(
            f"/api/board/{carte['identifiant']}",
            json={"position": [260, 0], "note": "collée à la main"},
        )
        print(f"  carte « collée à la main » posée, sans asset ({carte['identifiant']})")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-ts18-"))
    print(f"Dossier jetable : {dossier}")
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)
    print()
    print(f"Atelier jetable (API) sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("Ouvre l'interface par le serveur de dev Vite (voir l'en-tête du fichier).")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
