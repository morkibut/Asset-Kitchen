# -*- coding: utf-8 -*-
"""AU13 — payer un vrai modèle pour un atlas de tuiles, et voir si les bords se raccordent.

**Tout le reste d'AU13 est déjà prouvé sans dépenser** (`tests/test_au13.py`) : importer un
atlas, garder la sélection et les corrections, exporter dans Godot avec bords, coins,
transparence et dimensions vérifiés. Ce qui manque est la seule chose que ces essais ne peuvent
pas simuler avec un carré de couleur : est-ce qu'un vrai modèle dessine un ensemble de tuiles
dont les bords se raccordent vraiment ?

Le chiffrage complet, ses sources et ce qu'on saura après, sont dans
`docs/releves/2026-09-13-au13-generation-reelle-chiffrage.md`. En bref : un tirage coûte entre
$0,006 et $0,05 chez `openai/gpt-image-2` (mesuré sur des appels déjà payés, jamais un tarif
annoncé — `atelier/services/prix.py`), et huit tirages sont proposés pour trancher honnêtement,
donc entre $0,05 et $0,40 au total.

    py essais/essai_au13_generation_reelle.py --a-blanc
        Rien ne part. Fournisseur doublé, résultat vérifiable, sert à prouver que le
        script marche avant qu'un centime ne soit en jeu.

    py essais/essai_au13_generation_reelle.py
        Montre le prix estimé et s'arrête. Aucun appel, quels que soient les autres
        réglages : il faut `--payer` en plus pour que quoi que ce soit parte.

    py essais/essai_au13_generation_reelle.py --payer
        Le lot réel, huit tirages par défaut. Affiche le prix, puis demande de retaper
        le montant exact avant le premier appel — il n'y a pas de seconde confirmation
        après celle-là.

    py essais/essai_au13_generation_reelle.py --payer --tirages 3
        Un lot plus court, si l'auteur veut d'abord voir trois résultats.

**Un identifiant de génération ne facture qu'une fois** (`docs/PLAN.md`, invariant T1) : relancer
ce script après un arrêt ne repaie jamais les tirages déjà réussis, sur le même dossier.

Sortie : `essais/resultats/au13-generation-reelle/` (le dossier de travail, non versionné — les
octets payés n'ont rien à faire dans Git) et `essais/mesures_au13_tuiles.json`, qui revient dans
Git parce que c'est une mesure, pas une image.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))
sys.path.insert(0, str(RACINE.parent / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

DOSSIER = RACINE / "resultats" / "au13-generation-reelle"
MESURES = RACINE / "mesures_au13_tuiles.json"

PROJET = "essai-au13"

# **Le modèle par défaut du produit, et rien d'autre** (`atelier/services/catalogue.py`,
# constante `DEFAUT`) : mesurer un autre modèle donnerait un prix qui ne dit rien de celui
# qu'on cherche à chiffrer.
MODELE = "openai/gpt-image-2"
PROPORTIONS = "1:1"

# **Une estimation, jamais un tarif** — voir la note datée du 13 septembre 2026. Bas et haut
# viennent de deux mesures réelles déjà payées pour ce modèle, sans référence jointe :
# `atelier/services/prix.py` ($0,0063) et `essais/mesures_prix_planche.json` ($0,0534, un
# appel identique aux autres et pourtant quatre fois plus cher — la variance mesurée est le
# haut de cette fourchette, pas une extrapolation).
PRIX_BAS_PAR_TIRAGE = 0.006
PRIX_HAUT_PAR_TIRAGE = 0.05

TIRAGES_PAR_DEFAUT = 8

# **Quatre colonnes, quatre lignes** : seize tuiles, assez pour porter un centre et ses huit
# raccords sur plusieurs terrains sans dépasser ce qu'un œil humain peut juger tuile par tuile
# dans le temps d'une séance.
COLONNES, LIGNES = 4, 4

PROMPT = (
    "A top-down 2D pixel art terrain tileset sprite sheet, exactly "
    f"{COLONNES} columns and {LIGNES} rows of {COLONNES * LIGNES} individual square terrain "
    "tiles, arranged edge to edge with no gaps and no borders between cells. The tiles form a "
    "grass-to-dirt-path autotile set: each tile must align seamlessly with its neighbours so "
    "the edges tile without visible seams. 16-bit pixel art, flat shading, muted natural "
    "colours, no outlines around the whole sheet, no grid lines drawn on top, no text, no "
    "watermark, no character, no decoration outside the tiles themselves."
)
PROMPT_NEGATIF = (
    "photorealism, 3d render, blurry edges, watermark, text, labels, visible grid lines, "
    "character, creature, mismatched tile edges"
)


def estimer_prix(tirages: int) -> dict:
    """Ce que `tirages` appels devraient consommer — une fourchette, jamais un chiffre unique.

    Pure, sans effet de bord : c'est ce qui permet de l'appeler avant toute décision de payer,
    et de la vérifier dans un essai sans monter d'atelier.
    """
    return {
        "tirages": tirages,
        "bas_usd": round(PRIX_BAS_PAR_TIRAGE * tirages, 4),
        "haut_usd": round(PRIX_HAUT_PAR_TIRAGE * tirages, 4),
        "modele": MODELE,
    }


def _annoncer(estimation: dict) -> str:
    bas, haut = estimation["bas_usd"], estimation["haut_usd"]
    print("═" * 78)
    print("  AU13 — GÉNÉRATION RÉELLE D'UN ATLAS DE TUILES")
    print("═" * 78)
    print(f"modèle    : {estimation['modele']}  ·  {PROPORTIONS}  ·  {COLONNES}×{LIGNES} tuiles")
    print(f"tirages   : {estimation['tirages']}")
    print(f"ESTIMATION (pas un tarif — mesurée sur des appels déjà payés) :")
    print(f"  entre ${bas:.4f} et ${haut:.4f} au total")
    print("  ce que l'appel a réellement consommé fait foi, jamais ce chiffre-ci.")
    print()
    return f"{bas:.4f}-{haut:.4f}"


def _attendre(client: TestClient, identifiant: str, secondes: float = 240.0) -> dict:
    depart = time.monotonic()
    while time.monotonic() - depart < secondes:
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(1.5)
    return client.get(f"/api/generations/{identifiant}").json()


def _asset_de(client: TestClient, projet: str, identifiant_generation: str) -> dict | None:
    """L'asset que la génération a rangé en bibliothèque — jamais un chemin de fichier.

    Une génération réussie range son résultat tout seul (`atelier/api/routes.py` : « un asset
    se range » dans le flux d'événements) ; ce n'est pas le même objet que la génération, et il
    faut le retrouver dans la grille du projet pour connaître son identifiant.
    """
    trouve = client.get("/api/assets", params={"projet": projet, "limite": 200}).json()
    for asset in trouve["assets"]:
        if asset.get("generation") == identifiant_generation:
            return asset
    return None


def executer_tirages(client: TestClient, projet: str, tirages: int, *, modele: str = MODELE) -> list[dict]:
    """Le lot lui-même : soumettre, attendre, ranger un ensemble de tuiles par tirage réussi.

    Marche à l'identique que l'atelier soit doublé ou réel — c'est ce qui permet de vérifier ce
    chemin à blanc avant qu'un centime ne parte, et `tests/test_essai_au13_generation_reelle.py`
    l'appelle exactement ainsi.
    """
    mesures: list[dict] = []
    for tirage in range(1, tirages + 1):
        identifiant = uuid.uuid4().hex
        corps = {
            "modele": modele,
            "prompt": PROMPT,
            "prompt_negatif": PROMPT_NEGATIF,
            "proportions": PROPORTIONS,
            "variations": 1,
            "identifiant": identifiant,
            "options": {},
            "projet": projet,
        }
        depart = time.monotonic()
        soumise = client.post("/api/generations", json=corps)
        if soumise.status_code >= 400:
            mesures.append({"tirage": tirage, "generation": identifiant, "statut": "refusee",
                            "erreur": soumise.json(), "cout_usd": 0.0})
            print(f"tirage {tirage} : refusé avant l'appel — {soumise.json()}")
            continue
        generation = _attendre(client, identifiant)
        duree = time.monotonic() - depart
        cout = float(generation.get("cout_usd") or 0.0)
        mesure = {
            "tirage": tirage,
            "generation": identifiant,
            "modele": modele,
            "statut": generation["statut"],
            "cout_usd": round(cout, 6),
            "secondes": round(duree, 1),
            "tileset": None,
            "asset": None,
        }
        if generation["statut"] == "reussie":
            asset = _asset_de(client, projet, identifiant)
            if asset is None:
                mesure["erreur"] = "asset introuvable en bibliothèque après une génération réussie"
            else:
                mesure["asset"] = asset["identifiant"]
                taille = max(2, asset["largeur"] // COLONNES)
                cree = client.post(
                    f"/api/projects/{projet}/tilesets",
                    json={"nom": f"Essai AU13 · tirage {tirage}", "image": asset["identifiant"],
                          "grille": {"taille": taille, "marge": 0, "espacement": 0}},
                )
                if cree.status_code >= 400:
                    mesure["erreur"] = cree.json()
                else:
                    mesure["tileset"] = cree.json()["identifiant"]
        mesures.append(mesure)
        print(
            f"tirage {tirage:>2} : {generation['statut']:<11} ${cout:.4f}"
            f"   en {duree:.0f} s"
            + (f"   → ensemble {mesure['tileset']}" if mesure.get("tileset") else "")
        )
    return mesures


def _relire() -> list[dict]:
    if MESURES.exists():
        return json.loads(MESURES.read_text(encoding="utf-8"))
    return []


def _ecrire(mesures: list[dict]) -> None:
    connues = _relire() + mesures
    MESURES.write_text(
        json.dumps(connues, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="AU13 — le prix d'un vrai atlas de tuiles")
    arguments.add_argument("--tirages", type=int, default=TIRAGES_PAR_DEFAUT)
    arguments.add_argument("--payer", action="store_true",
                           help="fait les appels réels — sans ce drapeau, rien ne part jamais")
    arguments.add_argument("--a-blanc", action="store_true",
                           help="fournisseur doublé, aucun réseau, aucune dépense — pour "
                                "vérifier le script lui-même")
    options = arguments.parse_args()

    if options.a_blanc and options.payer:
        print("« --a-blanc » et « --payer » sont contradictoires — choisir l'un des deux.")
        return 1

    estimation = estimer_prix(options.tirages)

    if options.a_blanc:
        from conftest import CATALOGUE, FournisseurDouble  # noqa: E402

        double = FournisseurDouble()
        # **Zéro, explicitement** — le double facture $0,0245 par défaut pour que
        # les essais d'écran voient un chiffre réaliste, mais un « à blanc » qui
        # cherche à prouver qu'aucune dépense n'a lieu doit pouvoir l'affirmer
        # sans ambiguïté plutôt que tolérer un total non nul (`tests/conftest.py`).
        double.couter = lambda demande: 0.0
        atelier = Atelier(
            racine=DOSSIER / "a-blanc",
            fabrique_fournisseur=lambda: double,
        )
        with TestClient(creer_application(atelier)) as client:
            client.post("/api/projects", json={"nom": PROJET})
            modele_double = CATALOGUE[0].identifiant
            print(f"À BLANC — fournisseur doublé, modèle « {modele_double} », rien ne se paie.\n")
            mesures = executer_tirages(client, PROJET, options.tirages, modele=modele_double)
            total = sum(m["cout_usd"] for m in mesures)
            print(f"\nDépensé (doit être nul) : ${total:.4f}")
            return 0 if total == 0.0 else 1

    _annoncer(estimation)

    if not options.payer:
        print("Aucun appel. Ajouter `--payer` pour lancer le lot réel après confirmation.")
        return 0

    DOSSIER.mkdir(parents=True, exist_ok=True)
    atelier = Atelier(racine=DOSSIER / "donnees")
    with TestClient(creer_application(atelier)) as client:
        vu = client.get("/api/models", params={"proportions": PROPORTIONS}).json()
        fiche = next((m for m in vu["modeles"] if m["identifiant"] == MODELE), None)
        if fiche is None:
            print(f"« {MODELE} » n'est pas au catalogue — aucune clé, ou fournisseur injoignable.")
            return 1
        if fiche["refus"]:
            print(f"« {fiche['nom']} » est grisé : {fiche['refus']}")
            return 1

        attendu = f"{estimation['bas_usd']:.4f}-{estimation['haut_usd']:.4f}"
        print(f"Pour confirmer, retaper exactement : {attendu}")
        tape = input("> ").strip()
        if tape != attendu:
            print("Ce n'est pas le montant affiché — rien n'est parti.")
            return 1

        client.post("/api/projects", json={"nom": PROJET})
        print(f"\nConfirmé. {options.tirages} tirages réels chez {MODELE}.\n")
        mesures = executer_tirages(client, PROJET, options.tirages)
        _ecrire(mesures)

        total = sum(m["cout_usd"] for m in mesures)
        reussis = sum(1 for m in mesures if m.get("tileset"))
        print(f"\nDépensé ici    : ${total:.4f}")
        print(f"Ensembles créés : {reussis} sur {options.tirages}")
        print(f"Mesures écrites : {MESURES}")
        print("\nLa suite — juger les raccords, corriger, exporter — se fait à la main ou avec")
        print(f"l'agent, sur le dossier : {DOSSIER / 'donnees'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
