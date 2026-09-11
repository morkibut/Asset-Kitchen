# -*- coding: utf-8 -*-
"""Relevé F0 — les trois fournisseurs gratuits, avant de décider lequel entre.

**Un relevé, pas un banc** (`docs/tranches/V2.2.md` § F0). Le banc qui a désigné le modèle
par défaut a payé dix sujets en deux jets chez trois modèles, jugés image par
image. Celui-ci ne peut pas : les trois fournisseurs rendent peu de crédits par
jour, et un banc de qualité les épuiserait avant d'avoir rien conclu — sur la
mauvaise question, en plus. Ce qu'on cherche n'est pas *lequel est le meilleur*
mais **ce que chacun sait faire, et à quel prix dans sa monnaie**.

Cinq questions, fournisseur par fournisseur :

1. **la liste de ses modèles**, telle que son interface la donne ;
2. **lesquels acceptent une image de référence, et par quel chemin** — des octets
   envoyés avec l'appel, une adresse web publique, ou pas du tout. *C'est la
   question qui décide de tout* : un modèle qui ne prend une référence que par
   adresse publique est inutilisable pour un univers qui vit sur le disque de
   l'auteur, et publier une planche d'artwork pour le contourner est exclu ;
3. **ce qu'une image consomme**, et ce que la réserve d'une journée permet ;
4. **où le fournisseur dit ce qu'il reste**, s'il le dit quelque part ;
5. **ce qu'il fait quand il ne peut pas répondre.**

**Sa consommation est un critère du relevé** : au plus une image par modèle
retenu, et seulement pour vérifier qu'un modèle *fait* ce qu'il *déclare*. Un
écart entre les deux est le résultat le plus utile qu'il puisse produire —
c'est exactement ce qu'`output_format: "png"` accepté puis ignoré chez Seedream
avait appris, et ce défaut-là n'est écrit dans aucune documentation.

    Lancer :  py essais/essai_fournisseurs.py

Sortie : ce journal, et `essais/fournisseurs.json` — à côté de `couverture.json`,
qui tient le même rôle pour OpenRouter. La fiche écrite, avec le verdict par
fournisseur, vit dans `docs/releve-fournisseurs.md`.

**Ce qui manque sans clé se dit, et ne se devine pas.** Leonardo demande un
identifiant ; sans lui, l'essai écrit ce qu'il n'a pas pu mesurer plutôt que
de recopier une documentation. Le nom attendu est dans `.env.example`.

**Cloudflare a été retiré du produit le 8 septembre 2026** — l'auteur ne
souhaite plus l'utiliser ni l'intégrer (`docs/tranches/V2.2.md` § F4). Ce
fichier ne l'interroge plus ; les mesures qu'il en avait faites le 31 août
restent dans `docs/releve-fournisseurs.md` et `essais/fournisseurs.json`,
telles quelles.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any

import httpx

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

SORTIE = RACINE / "fournisseurs.json"

# Le sujet est le même partout, et c'est volontaire : ce n'est pas un jugement de
# qualité, c'est un témoin. Un tonneau est ce que la V1 a généré en premier.
SUJET = "a small red wooden barrel, pixel art, side view, plain background"

# Ce que la V1 demande d'un modèle pour porter un univers : deux planches de
# style, plus la source d'édition quand on enchaîne les poses.
# Repris de `essai_couverture.py`, et c'est le seuil qui tranche ici aussi.
REFERENCES_UNIVERS = 3

# ── Pollinations ─────────────────────────────────────────────────────────────

POLLINATIONS = "https://image.pollinations.ai"
# Le palier anonyme annonce un appel toutes les quinze secondes.
ATTENTE_POLLINATIONS_S = 16.0


def mesurer(octets: bytes) -> dict[str, Any]:
    """Les dimensions et le format, lus **sur les octets**, jamais sur l'en-tête.

    Règle du produit depuis T1, et elle sert dès le premier appel de ce
    relevé : Pollinations annonce `image/jpeg` et rend 768 px là où on en a
    demandé 1024.
    """
    try:
        from PIL import Image

        with Image.open(io.BytesIO(octets)) as image:
            return {"largeur": image.width, "hauteur": image.height, "format": image.format}
    except Exception as erreur:  # noqa: BLE001 — un relevé ne casse pas
        return {"erreur": f"illisible comme image — {erreur}"}


def _appel_pollinations(nom: str, sujet: str, parametres: dict[str, Any]) -> dict[str, Any]:
    adresse = f"{POLLINATIONS}/prompt/{urllib.parse.quote(sujet)}"
    depart = time.monotonic()
    try:
        reponse = httpx.get(adresse, params=parametres, timeout=180, follow_redirects=True)
    except httpx.HTTPError as erreur:
        return {"nom": nom, "erreur": f"{type(erreur).__name__} — {erreur}"}

    entetes = {k.lower(): v for k, v in reponse.headers.items()}
    fiche: dict[str, Any] = {
        "nom": nom,
        "demande": parametres,
        "statut": reponse.status_code,
        "duree_s": round(time.monotonic() - depart, 1),
        "type_annonce": entetes.get("content-type"),
        "octets": len(reponse.content),
        "modele_utilise": entetes.get("x-model-used"),
        "consomme": entetes.get("x-usage-total-tokens"),
        "authentification": entetes.get("x-auth-status"),
        "cache": entetes.get("x-cache"),
    }
    if reponse.status_code >= 400:
        fiche["refus"] = reponse.text[:300]
    else:
        fiche["mesure"] = mesurer(reponse.content)
    return fiche


def pollinations() -> dict[str, Any]:
    """Aucune clé. Six appels, espacés de seize secondes."""
    titre("Pollinations — aucune clé, palier anonyme")

    try:
        declares = httpx.get(f"{POLLINATIONS}/models", timeout=30).json()
    except Exception as erreur:  # noqa: BLE001
        declares = {"erreur": str(erreur)}
    print(f"  catalogue déclaré : {json.dumps(declares, ensure_ascii=False)}")

    essais = [
        ("1024 carré demandé", SUJET, {"width": 1024, "height": 1024, "model": "sana", "seed": 11, "nologo": "true"}),
        ("1024x512 demandé", SUJET, {"width": 1024, "height": 512, "model": "sana", "seed": 11, "nologo": "true"}),
        ("modèle inexistant", SUJET, {"width": 512, "height": 512, "model": "nexistepas", "seed": 11}),
        ("modèle réservé « kontext »", SUJET, {"width": 512, "height": 512, "model": "kontext", "seed": 11}),
        ("adresse hors /prompt", None, None),
    ]

    appels = []
    for rang, (nom, sujet, parametres) in enumerate(essais):
        if rang:
            time.sleep(ATTENTE_POLLINATIONS_S)
        if sujet is None:
            # **Le cas qu'aucune documentation n'annonce** : une adresse qui
            # n'est pas une génération. Un fournisseur normal rend 404.
            reponse = httpx.get(f"{POLLINATIONS}/openapi.json", timeout=120, follow_redirects=True)
            fiche = {
                "nom": nom,
                "statut": reponse.status_code,
                "type_annonce": reponse.headers.get("content-type"),
                "octets": len(reponse.content),
                "mesure": mesurer(reponse.content),
            }
        else:
            fiche = _appel_pollinations(nom, sujet, parametres)
        appels.append(fiche)
        afficher(fiche)

    return {
        "fournisseur": "Pollinations",
        "cle_requise": False,
        "cle_presente": True,
        "catalogue_declare": declares,
        "appels": appels,
    }


# ── Leonardo ─────────────────────────────────────────────────────────────────

LEONARDO_CLE = "LEONARDO_API_KEY"


def leonardo() -> dict[str, Any]:
    """Le seul des trois qui répond en deux temps — et le seul dont la gratuité
    est à vérifier avant tout le reste."""
    titre("Leonardo — une clé attendue")

    cle = os.environ.get(LEONARDO_CLE, "").strip()
    if not cle:
        print(f"  non mesuré — il manque {LEONARDO_CLE}")
        print("  (à déposer dans .env, jamais dans une conversation ni dans le code)")
        return {
            "fournisseur": "Leonardo",
            "cle_requise": True,
            "cle_presente": False,
            "manque": [LEONARDO_CLE],
            "a_mesurer": [
                "si une clé d'API se crée sans payer, et avec quel crédit de départ",
                "ce que /me annonce comme jetons restants, et s'ils se renouvellent",
                "la liste de /platformModels et leurs plafonds de références",
                "combien de temps sépare la soumission de l'image",
            ],
        }

    entetes = {"Authorization": f"Bearer {cle}", "Accept": "application/json"}
    fiche: dict[str, Any] = {"fournisseur": "Leonardo", "cle_requise": True, "cle_presente": True}
    for nom, chemin in (("solde", "me"), ("modeles", "platformModels")):
        try:
            reponse = httpx.get(
                f"https://cloud.leonardo.ai/api/rest/v1/{chemin}", headers=entetes, timeout=60
            )
            fiche[nom] = (
                reponse.json() if reponse.status_code < 400 else {"statut": reponse.status_code, "corps": reponse.text[:300]}
            )
            print(f"  {chemin} -> {reponse.status_code}")
        except Exception as erreur:  # noqa: BLE001
            fiche[nom] = {"erreur": str(erreur)}
            print(f"  {chemin} -> erreur {erreur}")
    return fiche


# ── Journal ──────────────────────────────────────────────────────────────────


def titre(texte: str) -> None:
    print(f"\n{texte}\n{'-' * len(texte)}")


def afficher(fiche: dict[str, Any]) -> None:
    if "erreur" in fiche:
        print(f"  {fiche['nom']:28} ERREUR {str(fiche['erreur'])[:60]}")
        return
    mesure = fiche.get("mesure") or {}
    taille = (
        f"{mesure['largeur']}x{mesure['hauteur']} {mesure['format']}"
        if "largeur" in mesure
        else (fiche.get("refus") or mesure.get("erreur", "?"))[:40]
    )
    print(
        f"  {fiche['nom']:28} {fiche['statut']}  {fiche.get('duree_s', 0):5.1f}s  "
        f"{taille:24} modèle={fiche.get('modele_utilise')}  consommé={fiche.get('consomme')}"
    )


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    print("Relevé F0 — deux fournisseurs restants, Cloudflare retiré du produit")
    print("aucun appel payant ; au plus une image par cas éprouvé")

    fiches = [pollinations(), leonardo()]

    SORTIE.write_text(
        json.dumps({"releve_le": time.time(), "fournisseurs": fiches}, indent=1, ensure_ascii=False),
        encoding="utf-8",
    )

    titre("Ce que le relevé a pu mesurer")
    for fiche in fiches:
        etat = "mesuré" if fiche.get("cle_presente") else "non mesuré, clé absente"
        print(f"  {fiche['fournisseur']:26} {etat}")
    print(f"\n  Relevé écrit : {SORTIE}")
    print("  Fiche et verdict : docs/releve-fournisseurs.md")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
