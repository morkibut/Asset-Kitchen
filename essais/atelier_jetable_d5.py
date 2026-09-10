# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier D5 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8499 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que D5 a fait

`ChampPrompt.tsx` et `PanneauReglages.tsx` ne vivaient nulle part en fichier
propre : ils étaient écrits en clair dans `App.tsx`, sous le nom `barreQuiPaie`
— la barre qui paie, une seule dans tout le produit. Les trois sont maintenant
un fichier chacun, `composants/BarreQuiPaie.tsx` porte les deux autres, et
tous trois tournent sur le vocabulaire papier.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_d5.py

## Ce qu'il monte

Un projet ouvert, avec un modèle prêt (aucune clé à fournir) : de quoi voir le
panneau des réglages se remplir pour de vrai — un choix de modèle, des
proportions, un coût attendu.

Rien n'a été payé : le modèle est un double, et générer n'est pas cliqué.

## Ce qu'on vient voir à l'écran

1. L'onglet Créer, au repos : la barre qui paie tout en bas — le champ de
   prompt, la ligne « réglages de l'appel » repliée.
2. Cliquer la ligne « réglages de l'appel » : le panneau papier s'ouvre —
   Modèle, Proportions, Variations, « Ce qui part ».
3. Le bloc « coût attendu », juste au-dessus du champ de prompt : « jamais
   appelé » tant qu'aucun appel n'est parti sur cette machine.
4. Plus la moindre trace de l'ancien châssis sombre dans ces trois blocs.
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
from atelier.domaine import Compte, Demande, Modele  # noqa: E402
from atelier.fournisseur.port import ImageProduite  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8499


class LAtelierDuVerre:
    """Ne demande aucune clé — le cas courant, sans repli à expliquer."""

    nom = "L'Atelier du Verre"

    def indisponible(self) -> str | None:
        return None

    def compte(self) -> Compte:
        from atelier.domaine.consommation import ICI, JETON

        return Compte(unite=JETON, plafond=None, source=ICI, renouvellement=None)

    async def catalogue(self) -> list[Modele]:
        return [
            Modele(
                identifiant="L'Atelier du Verre:croquis",
                nom="Croquis",
                fournisseur=self.nom,
                chez_lui="croquis",
                proportions=("1:1", "3:2", "2:3", "16:9"),
                variations_max=4,
            )
        ]

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
            client.post("/api/projects", json={"nom": "Vérification D5"}),
            "la création du projet",
        )["projet"]
        modeles = _exiger(client.get("/api/models"), "le catalogue")
        return {"projet": projet, "modeles": modeles}


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-d5-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(
        racine=dossier,
        fabriques_fournisseurs=[LAtelierDuVerre],
    )

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Projet  : {monte['projet']['nom']}")
    print(f"  Modèles au catalogue : {len(monte['modeles'])}")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → l'onglet Créer, au repos : la barre qui paie")
    print("  → « réglages de l'appel » : le panneau papier, déplié")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
