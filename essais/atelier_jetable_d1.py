# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier D1 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8497 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que D1 a fait

`EcranReglages.tsx` et `Secrets.tsx` sont partis. Les quatre choses qu'ils
portaient — les fournisseurs (l'état de la clé), les garde-fous de l'agent, le
dossier du jeu, la bibliothèque de mouvements — vivent maintenant dans
`PanneauAtelier`, un composant de `ReglesDuJeu.tsx`, recoloré en papier.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_d1.py

## Ce qu'il monte

Un projet ouvert, et deux fournisseurs doubles : l'un demande une clé qu'il
n'a pas encore, l'autre ne demande rien — de quoi voir « 1 sur 2 » dans la
barre, cliquable, et les deux états dans le bloc des fournisseurs.

Rien n'a été payé : les deux fournisseurs sont des doubles.

## Ce qu'on vient voir à l'écran

1. La barre du haut : « 1 sur 2 », cliquable — mène au panneau.
2. Le bouton « Réglages » du pied du carnet mène au même panneau.
3. Dans le panneau, papier — plus la moindre trace de l'ancien châssis
   sombre : les quatre blocs, « Les fournisseurs », « L'agent », « Les
   dossiers », « Les mouvements ».
4. Échap, ou le bouton « Fermer — Échap », referme le panneau.
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
from atelier.domaine.secret import Secret, ce_qui_manque  # noqa: E402
from atelier.fournisseur.port import ImageProduite  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8497

PLACE = Secret(
    nom="ESSAI_D1_KEY",
    libelle="la clé",
    aucun="aucune clé",
    ou="exemple.invalide/mes-cles",
)


class LeComptoir:
    """Demande une clé, et ne l'a pas encore — le cas « en attente »."""

    nom = "Le Comptoir"

    def secrets(self) -> tuple[Secret, ...]:
        return (PLACE,)

    def indisponible(self) -> str | None:
        return ce_qui_manque(self.nom, self.secrets(), {PLACE.nom: None})

    def compte(self) -> None:
        return None

    async def catalogue(self) -> list[Modele]:
        return [
            Modele(
                identifiant="Le Comptoir:portraits",
                nom="Portraits",
                fournisseur=self.nom,
                chez_lui="portraits",
                proportions=("1:1",),
                variations_max=1,
            )
        ]

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        raise AssertionError("cet atelier jetable ne génère rien")


class LaFontaine:
    """Ne demande rien — le cas « prêt » à côté du précédent."""

    nom = "La Fontaine"

    def indisponible(self) -> str | None:
        return None

    def compte(self) -> Compte:
        from atelier.domaine.consommation import ICI, JETON

        return Compte(unite=JETON, plafond=None, source=ICI, renouvellement="minuit")

    async def catalogue(self) -> list[Modele]:
        return [
            Modele(
                identifiant="La Fontaine:brouillon",
                nom="Brouillon",
                fournisseur=self.nom,
                chez_lui="brouillon",
                proportions=("1:1",),
                variations_max=1,
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
            client.post("/api/projects", json={"nom": "Vérification D1"}),
            "la création du projet",
        )["projet"]
        tiroirs = _exiger(client.get("/api/settings/keys"), "les tiroirs")["tiroirs"]
        agent = _exiger(client.get("/api/settings/agent"), "l'agent")
        return {"projet": projet, "tiroirs": tiroirs, "agent": agent}


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-d1-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(
        racine=dossier,
        fabriques_fournisseurs=[LeComptoir, LaFontaine],
    )

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Projet     : {monte['projet']['nom']}")
    print("  Les tiroirs :")
    for tiroir in monte["tiroirs"]:
        print(
            f"    · {tiroir['fournisseur']:14s} "
            f"{'prêt' if tiroir['pret'] else tiroir['manque']}"
        )
    print(f"  Plafond de l'agent : {monte['agent']['garde_fous']['plafond']} images")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → la barre du haut : « 1 sur 2 », cliquable")
    print("  → le pied du carnet › Réglages : le même panneau, en papier")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
