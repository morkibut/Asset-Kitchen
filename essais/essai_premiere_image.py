# -*- coding: utf-8 -*-
"""La première image — l'essai qui traverse l'atelier de bout en bout.

**Celui-ci coûte de l'argent** : un appel réel, une image réelle. C'est le seul
du jalon 1 dans ce cas, et il ne part qu'à la main.

Il passe par l'API HTTP, pas par les services : ce qu'on veut vérifier, c'est le
chemin complet — le catalogue relu au démarrage, le modèle qui n'est pas grisé,
la génération qui vit côté serveur, le coût réel enregistré, les dimensions
mesurées, et le PNG qui se télécharge. Une fois de plus, sans clé, rien ne part.

    py essais/essai_premiere_image.py
    py essais/essai_premiere_image.py --modele bytedance-seed/seedream-5-0-lite
    py essais/essai_premiere_image.py --variations 2      (paie deux fois)

Sortie : `essais/resultats/premiere_image/`, non versionné.
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

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402

SORTIE = RACINE / "resultats" / "premiere_image"

# Le sujet est celui du banc : un prompt qu'on sait rendre, dans un style qu'on
# sait juger. Les deux règles de prompt d'`AGENTS.md` y sont, littéralement.
PROMPT = (
    "A wooden barrel bound with iron hoops, standing upright. "
    "Dark fantasy forest realm. 16-bit pixel art, thick dark outline, "
    "limited earthy palette of mossy greens, warm browns and muted golds, "
    "flat shading, crisp aligned pixels, no gradients. "
    "One single sprite, one pose only, centered, "
    "on a plain flat light gray background. No ground shadow, no scenery, no text."
)
NEGATIF = "photorealism, 3d render, blurry edges, watermark"


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="La première image — appel payant")
    arguments.add_argument("--modele", default="openai/gpt-image-2")
    arguments.add_argument("--variations", type=int, default=1)
    arguments.add_argument("--proportions", default="1:1")
    options = arguments.parse_args()

    SORTIE.mkdir(parents=True, exist_ok=True)
    identifiant = uuid.uuid4().hex

    with TestClient(creer_application()) as client:
        # ── L'atelier s'ouvre : clé, catalogue, et rien d'autre ──────────────
        etat = client.get("/api/status").json()
        catalogue = etat["catalogue"]
        print(
            f"catalogue : {catalogue['modeles']} modèles"
            + (
                f"  (repli — {catalogue['raison']})"
                if catalogue["repli"]
                else "  (frais du fournisseur)"
            )
        )
        if not etat["cle"]["presente"]:
            print("Aucune clé OpenRouter — rien ne part. Voir .env.example")
            return 1
        print(f"clé       : présente, …{etat['cle']['apercu']}")

        # ── Le modèle est-il grisé pour cette demande ? ──────────────────────
        modeles = client.get(
            "/api/models", params={"proportions": options.proportions}
        ).json()["modeles"]
        fiche = next(
            (m for m in modeles if m["identifiant"] == options.modele), None
        )
        if fiche is None:
            print(f"« {options.modele} » n'est pas au catalogue.")
            return 1
        if fiche["refus"]:
            print(f"« {fiche['nom']} » est grisé : {fiche['refus']}")
            return 1
        print(f"modèle    : {fiche['nom']}  ({fiche['references_max']} réfs max)")

        # ── L'appel ─────────────────────────────────────────────────────────
        corps = {
            "modele": options.modele,
            "prompt": PROMPT,
            "prompt_negatif": NEGATIF,
            "proportions": options.proportions,
            "variations": options.variations,
            "identifiant": identifiant,
            "options": {"quality": "low"} if "gpt-image" in options.modele else {},
        }
        depart = time.monotonic()
        soumise = client.post("/api/generations", json=corps)
        if soumise.status_code >= 400:
            print(f"refusé : {soumise.json()}")
            return 1
        print(f"\ngénération {identifiant} — soumise, {options.variations} emplacement(s)")

        # ── La même soumission, une seconde fois : rien ne doit repartir ─────
        client.post("/api/generations", json=corps)

        generation = _attendre(client, identifiant)
        duree = time.monotonic() - depart

        # ── Ce qui est arrivé ───────────────────────────────────────────────
        print(f"statut    : {generation['statut']}  en {duree:.1f} s")
        print(f"coût réel : ${generation['cout_usd']:.4f}   (usage.cost, pas le tarif)")
        resolus = generation["parametres_resolus"]
        print(f"résolus   : {json.dumps(resolus, ensure_ascii=False)}")
        if generation["ecartees"]:
            print(f"écartés   : {', '.join(generation['ecartees'])}")

        for emplacement in generation["emplacements"]:
            rang = emplacement["rang"]
            if emplacement["statut"] != "reussie":
                print(f"  [{rang}] {emplacement['statut']} — {emplacement['raison']}")
                continue
            mesure = emplacement["resultat"]
            telechargee = client.get(
                f"/api/generations/{identifiant}/slots/{rang}/download"
            )
            chemin = SORTIE / f"{identifiant}-{rang}.png"
            chemin.write_bytes(telechargee.content)
            print(
                f"  [{rang}] {mesure['largeur']}×{mesure['hauteur']}"
                f"  {mesure['type_media']}  {mesure['octets'] // 1024} Ko"
                f"  ${emplacement['cout_usd']:.4f}  {emplacement['duree_s']:.1f} s"
            )
            print(f"       téléchargée en PNG → {chemin}")

        print(f"\ntotal de l'atelier : ${client.get('/api/status').json()['couts']['total_usd']:.4f}")

    return 0 if generation["statut"] == "reussie" else 1


def _attendre(client: TestClient, identifiant: str, delai_s: float = 300.0) -> dict:
    """On sonde ici parce qu'un essai n'a pas d'écran. L'interface, elle, écoute
    le flux d'événements — `GET /api/events` — et ne redemande jamais rien."""
    limite = time.monotonic() + delai_s
    dernier = ""
    while time.monotonic() < limite:
        generation = client.get(f"/api/generations/{identifiant}").json()
        etat = f"{generation['statut']} {generation['reussies']}/{len(generation['emplacements'])}"
        if etat != dernier:
            print(f"  … {etat}", flush=True)
            dernier = etat
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        time.sleep(1.0)
    return client.get(f"/api/generations/{identifiant}").json()


if __name__ == "__main__":
    sys.exit(principal())
