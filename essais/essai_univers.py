# -*- coding: utf-8 -*-
"""Essai d'univers — le scénario V1 lui-même, sur les trois finalistes.

Le banc précédent (`essai_identite.py`) n'a testé que des personnages, avec **une
seule** image de référence, et jamais deux assets censés aller ensemble. Or la V1
d'Asset Kitchen, c'est un univers défini par **plusieurs artworks officiels**, et
un flot de props, d'objets et de personnages qui doivent former une famille.

Ce banc-ci mesure ça. **Un guide de style commun** — les deux mêmes planches pour
les trois modèles, prises dans le banc précédent — et dix sujets par jet :

    P1..P5   cinq props qui n'ont rien d'un personnage
    C1..C3   trois personnages neufs, dont une créature non humanoïde
    C1b      C1 retourné de dos          ← identité, avec 3 références
    C1c      C1b mis en marche           ← chaînage, avec 3 références

Ce qu'on cherche à savoir, et que rien n'a mesuré jusqu'ici :

  · deux références de style valent-elles mieux qu'une ?
  · les cinq props forment-ils une famille entre eux ?
  · vont-ils avec les personnages du guide ?
  · le piège de riverflow refait-il surface — un modèle redessine-t-il le goblin
    quand on lui demande un tonneau ?
  · l'identité tient-elle quand le guide de style occupe déjà deux places
    dans le budget de références ?

Aucune dépendance : bibliothèque standard. L'infrastructure est reprise de
`essai_identite.py` — même lecture de clé, même catalogue, mêmes garde-fous.

    Lancer :  py essais/essai_univers.py

Sortie : `essais/resultats_univers/jet<N>/<configuration>/`, plus un `mesures.json`
par configuration. Ce qui est déjà complet est sauté : relancer ne repaie jamais.
"""

from __future__ import annotations

import base64
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from essai_identite import (
    charger_catalogue,
    dimensions_png,
    lire_cle,
    options_retenues,
    refs_max,
)

RACINE = Path(__file__).resolve().parent
GUIDE = RACINE / "guide"
SORTIE = RACINE / "resultats_univers"
DELAI = 300
JETS = (1, 2)
PARALLELE = 5

# ─────────────────────────────────────────────────────────────────────────────
# Les trois finalistes
# ─────────────────────────────────────────────────────────────────────────────

CONFIGURATIONS = [
    ("seedream-5.0-lite", "bytedance-seed/seedream-5-0-lite", {}),
    ("seedream-4.5",      "bytedance-seed/seedream-4.5",      {}),
    ("gpt-image-2_low",   "openai/gpt-image-2",               {"quality": "low"}),
]

COMMUN = {"aspect_ratio": "1:1"}

# ─────────────────────────────────────────────────────────────────────────────
# L'univers — la bible, telle qu'Asset Kitchen la composera
# ─────────────────────────────────────────────────────────────────────────────

BIBLE = (
    "Dark fantasy forest realm. 16-bit pixel art, thick dark outline, "
    "limited earthy palette of mossy greens, warm browns and muted golds, "
    "flat shading, crisp aligned pixels, no gradients."
)

STYLE_REF = (
    "Match the art style of the reference images exactly: same outline weight, "
    "same pixel size, same palette, same level of detail, same sprite scale."
)

CADRE = (
    "One single sprite, one object only, centered, "
    "on a plain flat light gray background. No ground shadow, no scenery, no text."
)


def sujet(description: str) -> str:
    return f"{description} {BIBLE} {STYLE_REF} {CADRE}"


def personnage(description: str) -> str:
    return (
        f"{description} Full body, side view facing right, standing in an idle pose. "
        f"{BIBLE} {STYLE_REF} {CADRE}"
    )


# (nom, famille, prompt, sources de références en plus du guide)
SUJETS: list[tuple[str, str, str, tuple[str, ...]]] = [
    ("P1_tonneau",  "prop",  sujet("A wooden barrel bound with iron hoops, standing upright."), ()),
    ("P2_epee",     "prop",  sujet("A short sword with a leather-wrapped grip, blade pointing up."), ()),
    ("P3_potion",   "prop",  sujet("A small glass flask filled with red potion, cork stopper."), ()),
    ("P4_coffre",   "prop",  sujet("A wooden treasure chest bound with iron, lid closed."), ()),
    ("P5_cadre",    "prop",  sujet("A rectangular ornate UI panel frame, empty in the middle, carved wood and metal corners."), ()),

    ("C1_pretresse", "perso", personnage("An elf priestess holding a wooden staff, long robe."), ()),
    ("C2_rat",       "perso", personnage("A giant sewer rat, four legs, mangy fur, long tail."), ()),
    ("C3_squelette", "perso", personnage("A skeleton guard holding a round wooden shield and a rusty spear."), ()),

    ("C1b_dos",     "chaine",
     "Turn this exact character around to show the back view. It must be the same "
     "character: same colors, same robe, same staff, same proportions, same silhouette, "
     "same pixel art style, same size. Only the viewing angle changes — nothing else. "
     f"{CADRE}",
     ("C1_pretresse",)),

    ("C1c_marche",  "chaine",
     "Put this exact character into a mid-walk pose: one leg forward, one leg back, "
     "robe swaying, staff held forward. It must be the same character: same colors, "
     "same robe, same staff, same proportions, same pixel art style, same size, "
     f"same viewing angle. Only the pose changes. {CADRE}",
     ("C1b_dos",)),
]


# ─────────────────────────────────────────────────────────────────────────────
# L'appel — plusieurs références, contrairement au banc précédent
# ─────────────────────────────────────────────────────────────────────────────

def generer(cle: str, modele: str, prompt: str, references: list[bytes],
            options: dict) -> tuple[bytes, float]:
    corps: dict = {"model": modele, "prompt": prompt, **options}

    if references:
        corps["input_references"] = [
            {
                "type": "image_url",
                "image_url": {
                    "url": "data:image/png;base64," + base64.b64encode(r).decode("ascii")
                },
            }
            for r in references
        ]

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


VERROU = threading.Lock()


def executer(cle: str, catalogue: dict, guide: list[bytes], jet: int,
             etiquette: str, identifiant: str, propres: dict) -> dict | None:
    fiche = catalogue.get(identifiant)
    if fiche is None:
        with VERROU:
            print(f"jet{jet} · {etiquette:20} absent du catalogue — saute")
        return None

    dossier = SORTIE / f"jet{jet}" / etiquette
    if dossier.exists() and len(list(dossier.glob("*.png"))) == len(SUJETS):
        with VERROU:
            print(f"jet{jet} · {etiquette:20} deja complet — saute (aucun frais)")
        m = dossier / "mesures.json"
        return json.loads(m.read_text(encoding="utf-8")) if m.exists() else None
    dossier.mkdir(parents=True, exist_ok=True)

    options, ecartees = options_retenues(fiche, {**COMMUN, **propres})
    plafond = refs_max(fiche)
    journal = [
        f"jet{jet} · {etiquette}   [{identifiant}]  refs max {plafond}"
        + (f"   (ecarte : {', '.join(ecartees)})" if ecartees else "")
    ]

    produites: dict[str, bytes] = {}
    cout_total = duree_totale = 0.0
    reussies = 0

    for nom, famille, prompt, sources in SUJETS:
        references = list(guide)
        manquante = False
        for s in sources:
            if s not in produites:
                journal.append(f"        {nom:14} saute — {s} a echoue")
                manquante = True
                break
            references.append(produites[s])
        if manquante:
            continue

        if len(references) > plafond:
            journal.append(
                f"        {nom:14} saute — {len(references)} references "
                f"pour un plafond de {plafond}"
            )
            continue

        depart = time.monotonic()
        try:
            octets, cout = generer(cle, identifiant, prompt, references, options)
        except Exception as erreur:  # noqa: BLE001 — un essai ne s'arrete jamais
            journal.append(f"        {nom:14} ECHEC — {erreur}")
            continue

        duree = time.monotonic() - depart
        produites[nom] = octets
        (dossier / f"{nom}.png").write_bytes(octets)
        cout_total += cout
        duree_totale += duree
        reussies += 1
        journal.append(
            f"        {nom:14} {famille:7} {len(references)}ref"
            f"  {dimensions_png(octets):>11}  {duree:5.1f}s  ${cout:.4f}"
        )

    mesure = {
        "jet": jet,
        "etiquette": etiquette,
        "modele": identifiant,
        "options": options,
        "refs_max": plafond,
        "cout_usd": round(cout_total, 6),
        "duree_s": round(duree_totale, 1),
        "etapes_reussies": reussies,
        "etapes_totales": len(SUJETS),
    }
    (dossier / "mesures.json").write_text(
        json.dumps(mesure, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    journal.append(
        f"        == {cout_total:.4f} $ · {duree_totale:.0f} s · {reussies}/{len(SUJETS)}"
    )
    with VERROU:
        print("\n".join(journal), flush=True)
    return mesure


def main() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    cle = lire_cle()
    if not cle:
        print("Cle OpenRouter introuvable — voir essai_identite.py")
        return 1

    planches = sorted(GUIDE.glob("*.png"))
    if not planches:
        print(f"Guide de style vide : {GUIDE}")
        return 1
    guide = [p.read_bytes() for p in planches]
    print(f"Guide de style : {', '.join(p.name for p in planches)}")

    catalogue = charger_catalogue()
    taches = [
        (jet, e, i, o) for jet in JETS for e, i, o in CONFIGURATIONS
    ]
    print(f"{len(taches)} configurations × {len(SUJETS)} appels, {PARALLELE} en parallele\n")

    debut = time.monotonic()
    with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
        mesures = [
            m for m in pool.map(lambda t: executer(cle, catalogue, guide, *t), taches) if m
        ]

    print(f"\n{'=' * 74}\nRECAPITULATIF\n{'=' * 74}")
    print(f"{'configuration':20} {'jet':>3} {'$ total':>9} {'$/img':>8} {'s/img':>8}  etat")
    print("-" * 74)
    for m in sorted(mesures, key=lambda m: (m["etiquette"], m["jet"])):
        n = max(1, m["etapes_reussies"])
        print(
            f"{m['etiquette']:20} {m['jet']:>3} {m['cout_usd']:9.4f}"
            f" {m['cout_usd'] / n:8.4f} {m['duree_s'] / n:8.1f}"
            f"  {m['etapes_reussies']}/{m['etapes_totales']}"
        )
    print("-" * 74)
    print(f"{'TOTAL':20} {'':>3} {sum(m['cout_usd'] for m in mesures):9.4f}")
    print(f"\nDuree du lot : {(time.monotonic() - debut) / 60:.1f} min")
    print(f"Images       : {SORTIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
