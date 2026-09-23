# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier RV18 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8430 : rien n'est écrit dans `donnees/`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_rv18.py

## Ce qu'il monte

Un seul projet ouvert, sans fournisseur — l'étape « Sa vue » de Réglages ›
Univers ne dépend d'aucune clé ni d'aucun catalogue. Rien n'est payé, rien
n'est écrit hors du dossier jetable.

## Ce qu'on vient voir à l'écran

1. Le jeu › Réglages › Univers › étape « Sa vue ».
2. Les huit cartes : chacune montre le rôdeur dans un petit décor, plus une
   vignette grise sur fond gris.
3. Au survol d'une carte, la scène joue — la vue « De dessus, stricte »
   pivote sur place, les vues à deux directions font l'aller-retour, les
   vues à quatre marchent en boucle sur leur sol.
4. Les exemples de chaque carte, corrigés par RV18 (Hotline Miami et GTA 1-2
   sur la vue stricte, Final Fantasy Tactics et Into the Breach sur
   l'isométrique, etc.).
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine import Demande, Modele  # noqa: E402
from atelier.fournisseur.port import ImageProduite  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8430


class AucunFournisseur:
    """Un double vide — juste assez pour que `Atelier` n'aille pas chercher
    les vrais fournisseurs (`fabriques_fournisseurs or [...]` retombe sur
    `FOURNISSEURS` quand la liste est vide, ce qui appellerait un vrai
    catalogue réseau). L'étape « Sa vue » ne lit aucun catalogue : elle n'a
    besoin de rien d'autre qu'un projet ouvert."""

    nom = "Aucun fournisseur"

    def indisponible(self) -> str | None:
        return "essai jetable : aucun fournisseur réel"

    def compte(self) -> None:
        return None

    async def catalogue(self) -> list[Modele]:
        return []

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        raise AssertionError("cet atelier jetable ne génère rien")


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Vérification RV18"}),
            "la création du projet",
        )["projet"]
        return {"projet": projet}


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rv18-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier, fabriques_fournisseurs=[AucunFournisseur])

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Projet : {monte['projet']['nom']}")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Réglages › Univers › « Sa vue »")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
