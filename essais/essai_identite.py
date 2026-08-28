# -*- coding: utf-8 -*-
"""Essai d'identité — comparer les modèles sur ce que le produit leur demandera vraiment.

Quatre appels enchaînés, sur chaque configuration :

    A · un personnage de base
    B · le MÊME personnage retourné            ← identité (décide la V3)
    C · le MÊME personnage mis en marche,
        à partir de B, pas de A                ← chaînage de poses (décide la V4)
    D · un AUTRE personnage, MÊME style,
        avec A en guide de style               ← l'univers qui contraint

**Deux jets par configuration.** Un modèle génératif n'est pas déterministe : un seul
échantillon confond la qualité d'un modèle avec la chance d'un tirage. Les deux jets
partent du même prompt et de la même graine implicite — l'écart entre eux *est* la
mesure de régularité, et elle compte autant que la qualité moyenne.

Deux corrections tirées du premier essai (26 août 2026) :

  · `aspect_ratio` est imposé — sans lui, Gemini part en 16:9 et Seedream en 1:1,
    et les résultats ne sont plus comparables ;
  · le prompt exige « one single sprite » — sans quoi Gemini rend spontanément
    une planche de trois poses.

Le script **lit le catalogue** et n'envoie à chaque modèle que les paramètres qu'il
déclare supporter. C'est la règle du plan en miniature : le catalogue décide,
jamais une liste écrite en dur.

Aucune dépendance : bibliothèque standard seulement.

    Clé   :  une ligne OPENROUTER_API_KEY=sk-or-... dans gag2/.env
             (ou la variable d'environnement du même nom)
    Lancer:  py essais/essai_identite.py

Sortie : `essais/resultats/jet<N>/<configuration>/`, plus un `mesures.json` par
configuration. Une configuration déjà complète est sautée : relancer ne repaie jamais.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RACINE = Path(__file__).resolve().parent
SORTIE = RACINE / "resultats"
CATALOGUE = RACINE / "catalogue.json"
DELAI = 300
JETS = (1, 2)
PARALLELE = 5

# ─────────────────────────────────────────────────────────────────────────────
# Ce qu'on compare — prix relevés au catalogue le 26 août 2026
# ─────────────────────────────────────────────────────────────────────────────

CONFIGURATIONS = [
    # (etiquette,               modele,                                options)
    ("flux2-klein-4b",          "black-forest-labs/flux.2-klein-4b",   {}),
    ("riverflow-2.5-fast",      "sourceful/riverflow-v2.5-fast",       {}),
    ("qwen-image-3",            "qwen/qwen-image-3",                   {}),
    ("gemini-3.1-flash-LITE",   "google/gemini-3.1-flash-lite-image",  {}),
    ("gemini-3.1-flash",        "google/gemini-3.1-flash-image",       {}),
    ("gemini-3-pro",            "google/gemini-3-pro-image",           {}),
    ("seedream-4.5",            "bytedance-seed/seedream-4.5",         {}),
    ("seedream-5.0-lite",       "bytedance-seed/seedream-5-0-lite",    {}),
    ("gpt-image-1-mini_low",    "openai/gpt-image-1-mini",             {"quality": "low"}),
    ("gpt-image-2_low",         "openai/gpt-image-2",                  {"quality": "low"}),
    ("gpt-image-2_medium",      "openai/gpt-image-2",                  {"quality": "medium"}),
    ("gpt-image-2_high",        "openai/gpt-image-2",                  {"quality": "high"}),
]

COMMUN = {"aspect_ratio": "1:1"}

# ─────────────────────────────────────────────────────────────────────────────
# Les prompts
# ─────────────────────────────────────────────────────────────────────────────

STYLE = (
    "16-bit pixel art, thick dark outline, limited earthy palette, "
    "flat shading, crisp pixels"
)
CADRE = (
    "One single sprite, one pose only, centered, "
    "on a plain flat light gray background."
)

PROMPT_A = (
    f"A pixel art sprite of a forest goblin scout holding a short bow. "
    f"Side view, facing right, full body, standing in an idle pose. "
    f"{STYLE}. {CADRE}"
)

PROMPT_B = (
    "Turn this exact character around to show the back view. "
    "It must be the same character: same colors, same outfit, same bow, "
    "same proportions, same silhouette, same pixel art style, same size. "
    "Only the viewing angle changes — nothing else. "
    f"{CADRE}"
)

PROMPT_C = (
    "Put this exact character into a mid-walk pose: one leg forward, one leg back, "
    "arms swinging naturally, slight torso lean. "
    "It must be the same character: same colors, same outfit, same bow, "
    "same proportions, same pixel art style, same size, same viewing angle. "
    f"Only the pose changes. {CADRE}"
)

PROMPT_D = (
    "A pixel art sprite of a dwarf blacksmith holding a heavy hammer. "
    "Side view, facing right, full body, standing in an idle pose. "
    "This is a DIFFERENT character, but it must match the art style of the "
    "reference image exactly: same outline weight, same palette, same shading, "
    f"same proportions, same level of detail, same sprite scale. {CADRE}"
)

ETAPES = [
    ("A_base",   PROMPT_A, None,     "personnage de base"),
    ("B_dos",    PROMPT_B, "A_base", "IDENTITE"),
    ("C_marche", PROMPT_C, "B_dos",  "CHAINAGE"),
    ("D_autre",  PROMPT_D, "A_base", "STYLE"),
]


# ─────────────────────────────────────────────────────────────────────────────
# La clé
# ─────────────────────────────────────────────────────────────────────────────

def lire_cle() -> str:
    """L'environnement d'abord, puis `.env` a la racine du depot.

    **Le fichier est lu en essayant plusieurs encodages.** PowerShell ecrit en
    UTF-16 avec `>` et `Out-File` : un `.env` cree au terminal Windows n'est pas
    de l'UTF-8, et le lire comme tel leve sur le tout premier octet.
    """
    cle = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if cle:
        return cle

    fichier = RACINE.parent / ".env"
    if not fichier.exists():
        return ""

    octets = fichier.read_bytes()
    for encodage in ("utf-8-sig", "utf-16", "utf-8", "latin-1"):
        try:
            texte = octets.decode(encodage)
        except (UnicodeDecodeError, UnicodeError):
            continue
        if "OPENROUTER_API_KEY" not in texte:
            continue
        for ligne in texte.splitlines():
            if ligne.strip().startswith("OPENROUTER_API_KEY"):
                _, _, valeur = ligne.partition("=")
                return valeur.strip().strip('"').strip("'")
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Le catalogue décide des paramètres
# ─────────────────────────────────────────────────────────────────────────────

def charger_catalogue() -> dict[str, dict]:
    if not CATALOGUE.exists():
        with urllib.request.urlopen(
            "https://openrouter.ai/api/v1/images/models", timeout=60
        ) as reponse:
            CATALOGUE.write_bytes(reponse.read())
    return {m["id"]: m for m in json.loads(CATALOGUE.read_text(encoding="utf-8"))["data"]}


def options_retenues(modele: dict, voulues: dict) -> tuple[dict, list[str]]:
    """Ne garde que ce que le modèle déclare accepter, et dit ce qui a été écarté."""
    supportes = modele.get("supported_parameters") or {}
    gardees, ecartees = {}, []
    for nom, valeur in voulues.items():
        declare = supportes.get(nom)
        if declare is None:
            ecartees.append(nom)
            continue
        valeurs = declare.get("values") if isinstance(declare, dict) else None
        if valeurs and valeur not in valeurs:
            ecartees.append(f"{nom}={valeur}")
            continue
        gardees[nom] = valeur
    return gardees, ecartees


def refs_max(modele: dict) -> int:
    declare = (modele.get("supported_parameters") or {}).get("input_references")
    return int(declare.get("max", 0)) if isinstance(declare, dict) else 0


# ─────────────────────────────────────────────────────────────────────────────
# L'appel
# ─────────────────────────────────────────────────────────────────────────────

def corps_requete(
    modele: str, prompt: str, reference: bytes | None, options: dict
) -> dict:
    """Le corps POST, seul — construit une fois, envoyé et montré par le même code.

    Sorti de `generer()` pour que `essais/verifier.py` puisse **montrer avant de
    payer ce qui partira**. Une seconde fonction qui redirait la même chose
    finirait par mentir le jour où l'une des deux change : le prompt affiché ne
    serait plus le prompt envoyé, et la vérification vaudrait pour rien.
    """
    corps: dict = {"model": modele, "prompt": prompt, **options}
    if reference is not None:
        url = "data:image/png;base64," + base64.b64encode(reference).decode("ascii")
        corps["input_references"] = [{"type": "image_url", "image_url": {"url": url}}]
    return corps


def generer(
    cle: str, modele: str, prompt: str, reference: bytes | None, options: dict
) -> tuple[bytes, float]:
    corps = corps_requete(modele, prompt, reference, options)

    requete = urllib.request.Request(
        "https://openrouter.ai/api/v1/images",
        data=json.dumps(corps).encode("utf-8"),
        headers={"Authorization": f"Bearer {cle}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(requete, timeout=DELAI) as reponse:
            resultat = json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"HTTP {erreur.code} — {detail}") from None

    images = resultat.get("data") or []
    if not images or not images[0].get("b64_json"):
        raise RuntimeError(f"aucune image : {json.dumps(resultat)[:400]}")

    cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
    return base64.b64decode(images[0]["b64_json"]), cout


def dimensions_png(octets: bytes) -> str:
    if octets[:8] != b"\x89PNG\r\n\x1a\n":
        return "?"
    return f"{int.from_bytes(octets[16:20], 'big')}x{int.from_bytes(octets[20:24], 'big')}"


# ─────────────────────────────────────────────────────────────────────────────
# Une configuration, un jet
# ─────────────────────────────────────────────────────────────────────────────

VERROU = threading.Lock()


def executer(cle: str, catalogue: dict, jet: int, etiquette: str, identifiant: str,
             propres: dict) -> dict | None:
    """Les quatre étapes d'une configuration. Les journaux sortent d'un bloc."""
    fiche = catalogue.get(identifiant)
    if fiche is None:
        with VERROU:
            print(f"jet{jet} · {etiquette:24} absent du catalogue — saute")
        return None

    dossier = SORTIE / f"jet{jet}" / etiquette
    if dossier.exists() and len(list(dossier.glob("*.png"))) == len(ETAPES):
        with VERROU:
            print(f"jet{jet} · {etiquette:24} deja complet — saute (aucun frais)")
        mesures = dossier / "mesures.json"
        if mesures.exists():
            return json.loads(mesures.read_text(encoding="utf-8"))
        return None
    dossier.mkdir(parents=True, exist_ok=True)

    options, ecartees = options_retenues(fiche, {**COMMUN, **propres})
    journal = [
        f"jet{jet} · {etiquette}   [{identifiant}]  refs max {refs_max(fiche)}"
        + (f"   (ecarte : {', '.join(ecartees)})" if ecartees else "")
    ]

    produites: dict[str, bytes] = {}
    cout_total = duree_totale = 0.0
    reussies = 0

    for nom, prompt, source, libelle in ETAPES:
        reference = produites.get(source) if source else None
        if source and reference is None:
            journal.append(f"        {nom:10} saute — {source} a echoue")
            continue

        depart = time.monotonic()
        try:
            octets, cout = generer(cle, identifiant, prompt, reference, options)
        except Exception as erreur:  # noqa: BLE001 — un essai ne s'arrete jamais
            journal.append(f"        {nom:10} ECHEC — {erreur}")
            continue

        duree = time.monotonic() - depart
        produites[nom] = octets
        (dossier / f"{nom}.png").write_bytes(octets)
        cout_total += cout
        duree_totale += duree
        reussies += 1
        journal.append(
            f"        {nom:10} {libelle:9} {dimensions_png(octets):>11}"
            f"  {duree:5.1f}s  ${cout:.4f}"
        )

    mesure = {
        "jet": jet,
        "etiquette": etiquette,
        "modele": identifiant,
        "options": options,
        "options_ecartees": ecartees,
        "refs_max": refs_max(fiche),
        "cout_usd": round(cout_total, 6),
        "duree_s": round(duree_totale, 1),
        "etapes_reussies": reussies,
    }
    (dossier / "mesures.json").write_text(
        json.dumps(mesure, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    journal.append(f"        ── {cout_total:.4f} $ · {duree_totale:.0f} s · {reussies}/4")
    with VERROU:
        print("\n".join(journal), flush=True)
    return mesure


# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    # La console Windows encode en cp1252 des que la sortie est redirigee, et un
    # simple « ── » suffit alors a lever un UnicodeEncodeError depuis un thread —
    # ce qui tue tout le lot en cours. Constate le 26 aout : le jet 2 s'est arrete
    # a 4 configurations sur 12, apres avoir paye les appels.
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    cle = lire_cle()
    if not cle:
        print("Cle OpenRouter introuvable.")
        print('  soit :  $env:OPENROUTER_API_KEY = "sk-or-..."')
        print(f"  soit :  une ligne OPENROUTER_API_KEY=sk-or-... dans {RACINE.parent / '.env'}")
        return 1

    catalogue = charger_catalogue()
    taches = [
        (jet, etiquette, identifiant, propres)
        for jet in JETS
        for etiquette, identifiant, propres in CONFIGURATIONS
    ]
    print(f"{len(taches)} configurations × 4 appels, {PARALLELE} en parallele\n")

    debut = time.monotonic()
    with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
        mesures = list(
            pool.map(lambda t: executer(cle, catalogue, *t), taches)
        )
    mesures = [m for m in mesures if m]

    print(f"\n{'=' * 78}\nRECAPITULATIF\n{'=' * 78}")
    print(f"{'configuration':24} {'jet':>3} {'$ total':>9} {'$ / image':>10} {'s / image':>10}  etat")
    print("-" * 78)
    for m in sorted(mesures, key=lambda m: (m["etiquette"], m["jet"])):
        n = max(1, m["etapes_reussies"])
        print(
            f"{m['etiquette']:24} {m['jet']:>3} {m['cout_usd']:9.4f}"
            f" {m['cout_usd'] / n:10.4f} {m['duree_s'] / n:10.1f}"
            f"  {m['etapes_reussies']}/4"
        )
    print("-" * 78)
    print(f"{'TOTAL':24} {'':>3} {sum(m['cout_usd'] for m in mesures):9.4f}")
    print(f"\nDuree du lot : {(time.monotonic() - debut) / 60:.1f} min")
    print(f"Images       : {SORTIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
