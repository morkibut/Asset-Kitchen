# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer RP2 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8505 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que RP2 a fait

Deux écrans existaient et ne s'ouvraient plus. Le mot *Réglages* de la colonne
ouvrait **l'installation de la machine** — les clés, ComfyUI, le dossier de
travail. Il ouvre maintenant les quatre onglets de la maquette :

    Univers · Moteurs & workflows · Agent MCP · Consommations

Les deux écrans injoignables y sont rangés : les quatre règles du jeu — nom,
allure, vue, monde, celles qui partent dans chaque demande d'image — sous
*Univers*, et le cadre de délégation — plafond d'appels, plafond en argent,
droit de payer, droit d'appeler la machine, modèles autorisés — sous
*Agent MCP*. Tant qu'il était injoignable, **rien ne bornait la dépense d'un
agent automatique depuis l'écran.**

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_rp2.py

## Ce qu'il monte

Un projet ouvert, avec son univers déjà rempli — de quoi lire les quatre
règles dans le premier onglet plutôt que quatre lignes vides —, et deux
fournisseurs doubles : l'un demande une clé qu'il n'a pas, l'autre ne demande
rien. Rien n'a été payé : les deux fournisseurs sont des doubles, et aucun
d'eux ne sait générer.

## Ce qu'on vient voir à l'écran

1. La colonne › *Réglages* : quatre onglets, et le premier montre les quatre
   règles du jeu — pas l'installation de la machine.
2. Onglet *Moteurs & workflows* : les fournisseurs, la porte de la machine,
   les méthodes locales. Ouvrir l'installation, la fermer, revenir ici.
3. Onglet *Agent MCP* : le cadre de délégation, puis les garde-fous de séance,
   le dossier du jeu et les mouvements.
4. Onglet *Consommations* : l'écran des dépenses, tel qu'il était.
5. Échap, ou « Fermer les réglages — Échap », referme l'écran.
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

PORT = 8505

PLACE = Secret(
    nom="ESSAI_RP2_KEY",
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
    """Ne demande rien — le cas « prêt » à côté du précédent, et le seul
    gratuit : c'est parmi ceux-là que le modèle d'exploration se choisit."""

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
            client.post("/api/projects", json={"nom": "Vérification RP2"}),
            "la création du projet",
        )["projet"]
        # L'univers rempli : sans lui, les quatre règles se liraient vides, et
        # on ne verrait pas ce que l'onglet *Univers* rouvre vraiment.
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "bible": [
                        {"nom": "monde", "texte": "des marais de sel, au crépuscule", "actif": True},
                        {"nom": "epoque", "texte": "un Moyen Âge lent", "actif": True},
                        {"nom": "trait", "texte": "contour sombre, une seule épaisseur", "actif": True},
                        {"nom": "eclairage", "texte": "une lumière rasante venue de l'ouest", "actif": True},
                    ]
                },
            ),
            "la bible du jeu",
        )
        cadre = _exiger(
            client.get(f"/api/projects/{projet['identifiant']}/delegation"),
            "le cadre de délégation",
        )
        tiroirs = _exiger(client.get("/api/settings/keys"), "les tiroirs")["tiroirs"]
        agent = _exiger(client.get("/api/settings/agent"), "l'agent")
        return {"projet": projet, "cadre": cadre, "tiroirs": tiroirs, "agent": agent}


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rp2-"))
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
    cadre = monte["cadre"]
    print(
        "  Cadre de l'agent : "
        f"{cadre['plafond_appels']} appels · {cadre['plafond_usd']} $ · "
        f"payant {'permis' if cadre['autoriser_payant'] else 'interdit'}"
    )
    print(f"  Plafond de séance : {monte['agent']['garde_fous']['plafond']} images")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → la colonne › Réglages : quatre onglets, Univers en premier")
    print("  → l'onglet Agent MCP : le cadre qui borne la dépense de l'agent")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
