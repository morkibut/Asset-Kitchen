# -*- coding: utf-8 -*-
"""Le banc des modèles de silhouette — les trois du catalogue, l'un contre l'autre.

Écrit le 1<sup>er</sup> septembre 2026 en tenant `U13`, dont un critère dit :
« un banc gratuit mesure les deux moteurs sur les images déjà là — durée, et ce
qu'ils rendent — et garde son relevé ».

**Ce qu'il répond.** Le détourage par modèle n'en connaissait qu'un seul, écrit
dans le code. On en propose désormais plusieurs, et « plus puissant » est une
promesse tant que ce n'est pas un relevé. Ce banc mesure, sur les images déjà sur
le disque : **combien de temps** met chaque modèle, **quelle part** de l'image il
garde, et **à quel point deux modèles disent la même chose** — l'intersection sur
l'union de leurs silhouettes. Deux modèles qui gardent la même part peuvent
garder deux parts *différentes*, et la part seule ne le dirait pas.

**Il ne coûte rien, et il ne télécharge rien de lui-même.** Les images sont déjà
là ; un modèle absent du disque est **sauté et annoncé**, jamais rapatrié en
douce — un banc qui déclencherait un gigaoctet de téléchargement ne serait plus
un banc gratuit. Pour le descendre, on le choisit dans la table de détourage :
c'est l'atelier qui le fait, une fois, en le disant.

**Le poids annoncé du catalogue se vérifie ici**, avec `--poids` : une question
à l'adresse de téléchargement, qui rend la taille sans rapatrier un octet. C'est
d'elle que viennent les chiffres inscrits dans `atelier/image/traitement.py`, et
c'est le seul geste de ce banc qui demande le réseau.

    Lancer :  py essais/essai_moteurs_silhouette.py
              py essais/essai_moteurs_silhouette.py --poids   (vérifie les tailles)

Sortie : ce journal, et `essais/mesures_moteurs_silhouette.json`.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

import numpy as np  # noqa: E402

from atelier.domaine.recette import Passe, Recette  # noqa: E402
from atelier.image.traitement import (  # noqa: E402
    SILHOUETTES,
    detourer,
    modele_descendu,
    raison_moteur,
)

SORTIE = RACINE / "mesures_moteurs_silhouette.json"

#: Les mêmes images que `essai_detourage_modele.py`, et pour la même raison :
#: deux bancs qui comparent des détourages doivent se comparer entre eux.
CHOISIES = (
    ("guide · goblin", "guide/01_goblin.png"),
    ("guide · nain", "guide/02_nain.png"),
    ("gpt-image-2 high · marche", "resultats/jet1/gpt-image-2_high/C_marche.png"),
    ("seedream-4.5 · base", "resultats/jet1/seedream-4.5/A_base.jpg"),
)

#: Les adresses de téléchargement de `rembg` 2.0.81, lues dans son code — c'est
#: `--poids` qui les interroge, et il ne rapatrie rien.
ADRESSES = {
    "u2net": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
    "isnet-general-use": (
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
        "isnet-general-use.onnx"
    ),
    "birefnet-general": (
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
        "BiRefNet-general-epoch_244.onnx"
    ),
}


def corpus() -> list[tuple[str, bytes]]:
    return [
        (nom, (RACINE / chemin).read_bytes())
        for nom, chemin in CHOISIES
        if (RACINE / chemin).is_file()
    ]


def silhouettes_a_mesurer() -> tuple[list[str], list[str]]:
    """Ceux qui sont là, et ceux qu'on saute en le disant."""
    presents = [s.nom for s in SILHOUETTES if modele_descendu(s.nom)]
    absents = [s.nom for s in SILHOUETTES if not modele_descendu(s.nom)]
    return presents, absents


def mesurer(images: list[tuple[str, bytes]], noms: list[str]) -> list[dict]:
    """Une ligne par image et par modèle — durée, part gardée, accord."""
    lignes: list[dict] = []
    for image, octets in images:
        alphas: dict[str, np.ndarray] = {}
        for nom in noms:
            depart = time.perf_counter()
            rgba = detourer(
                Recette(passes=(Passe(moteur="modele", modele=nom),)), octets
            )
            duree = (time.perf_counter() - depart) * 1000
            alpha = rgba[:, :, 3] > 0
            alphas[nom] = alpha
            lignes.append(
                {
                    "image": image,
                    "modele": nom,
                    "ms": round(duree, 1),
                    "part": round(float(alpha.mean()), 4),
                }
            )
        # L'accord de chaque paire, sur la même image.
        for i, un in enumerate(noms):
            for autre in noms[i + 1 :]:
                union = int((alphas[un] | alphas[autre]).sum())
                lignes.append(
                    {
                        "image": image,
                        "accord": (
                            round(float((alphas[un] & alphas[autre]).sum() / union), 4)
                            if union
                            else 1.0
                        ),
                        "entre": [un, autre],
                    }
                )
    return lignes


def poids_annonces() -> list[dict]:
    """Le poids que le catalogue annonce, confronté à l'adresse — **sans
    rapatrier un octet**. C'est le seul geste de ce banc qui demande le réseau,
    et il est derrière `--poids` pour cette raison."""
    import urllib.request

    releve: list[dict] = []
    for sil in SILHOUETTES:
        adresse = ADRESSES.get(sil.nom)
        if not adresse:
            continue
        try:
            demande = urllib.request.Request(adresse, method="HEAD")
            with urllib.request.urlopen(demande, timeout=20) as reponse:
                vu = int(reponse.headers.get("Content-Length") or 0)
        except Exception as souci:  # noqa: BLE001 — hors ligne n'est pas une panne
            releve.append({"modele": sil.nom, "annonce": sil.octets, "erreur": str(souci)})
            continue
        releve.append(
            {"modele": sil.nom, "annonce": sil.octets, "mesure": vu, "juste": vu == sil.octets}
        )
    return releve


def main() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    analyse = argparse.ArgumentParser()
    analyse.add_argument("--poids", action="store_true")
    options = analyse.parse_args()

    print("Banc des modèles de silhouette — aucun frais, aucune image demandée")
    print("=" * 78)

    absent = raison_moteur("modele")
    if absent is not None:
        print(f"  Rien à mesurer : {absent}.")
        return 0

    presents, manquants = silhouettes_a_mesurer()
    for nom in manquants:
        sil = next(s for s in SILHOUETTES if s.nom == nom)
        print(
            f"  sauté · {nom} — pas encore descendu "
            f"({sil.octets / 1_048_576:.0f} Mo). Le banc ne télécharge rien ;"
        )
        print("          on le descend en le choisissant dans la table de détourage.")
    if not presents:
        print("  Aucun modèle sur cette machine.")
        return 0

    images = corpus()
    print(f"  {len(images)} image(s), {len(presents)} modèle(s) : {', '.join(presents)}")
    print()

    lignes = mesurer(images, presents)

    print("Durée et part gardée")
    print("-" * 78)
    for nom in presents:
        durees = [l["ms"] for l in lignes if l.get("modele") == nom]
        parts = [l["part"] for l in lignes if l.get("modele") == nom]
        if not durees:
            continue
        print(
            f"  {nom:<20} {sum(durees) / len(durees):8.0f} ms en moyenne   ·   "
            f"garde {100 * sum(parts) / len(parts):5.1f} % de l'image"
        )
    print()

    accords = [l for l in lignes if "accord" in l]
    if accords:
        print("Ce qu'ils rendent, l'un contre l'autre")
        print("-" * 78)
        for ligne in accords:
            un, autre = ligne["entre"]
            print(
                f"  {ligne['image']:<28} {un} / {autre} : "
                f"{100 * ligne['accord']:.1f} % d'accord"
            )
        print()

    releve: dict[str, object] = {"lignes": lignes, "sautes": manquants}
    if options.poids:
        releve["poids"] = poids_annonces()
        print("Le poids annoncé, confronté à l'adresse")
        print("-" * 78)
        for p in releve["poids"]:  # type: ignore[union-attr]
            if "erreur" in p:
                print(f"  {p['modele']:<20} pas joignable — {p['erreur']}")
            else:
                marque = "✔" if p["juste"] else "✘"
                print(
                    f"  {marque} {p['modele']:<18} annoncé {p['annonce']:>11} · "
                    f"mesuré {p['mesure']:>11}"
                )
        print()

    SORTIE.write_text(json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Relevé écrit : {SORTIE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
