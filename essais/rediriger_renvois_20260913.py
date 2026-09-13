"""Rediriger les renvois que la quatrième descente a cassés — 13 septembre 2026.

`essais/descendre_docs_20260913.sh` a déplacé vingt entrées de `docs/` vers
`docs/archive/`. Deux cent vingt-deux renvois pointaient encore sur l'ancienne
adresse. Ce script les redirige, et rien d'autre : **aucun mot ne change**, seul
le chemin change.

Il travaille en octets, pas en texte : les fins de ligne du dépôt sont mêlées
(`core.autocrlf=true`), et relire un fichier en mode texte les uniformiserait
sans qu'on l'ait demandé. Un chemin ne contient que de l'ASCII, donc chercher
et remplacer en octets est sûr.

Il est idempotent : `docs/archive/maquettes-v3` ne contient pas la chaîne
`docs/maquettes-v3`, donc le repasser ne redouble rien.

    py essais/rediriger_renvois_20260913.py            # écrit
    py essais/rediriger_renvois_20260913.py --a-blanc  # dit seulement
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# L'ancienne adresse, puis la nouvelle. L'ordre compte pour une seule paire :
# `docs/maquettes-v2.1` et `docs/maquettes-v2.4` ne se préfixent pas l'une
# l'autre, donc aucun piège ici — mais on garde les chemins les plus longs en
# premier par principe.
REDIRECTIONS: list[tuple[str, str]] = [
    ("docs/analyse pre-v3", "docs/archive/analyse-pre-v3"),
    ("docs/design-preview-propositions.html", "docs/archive/design-preview-propositions.html"),
    ("docs/design-preview-refonte.html", "docs/archive/design-preview-refonte.html"),
    ("docs/audit-design-post-v21.html", "docs/archive/audit-design-post-v21.html"),
    ("docs/PLAN-carnet-affectation.md", "docs/archive/PLAN-carnet-affectation.md"),
    ("docs/maquette-atelier.html", "docs/archive/maquette-atelier.html"),
    ("docs/questions-du-lot-U.md", "docs/archive/questions-du-lot-U.md"),
    ("docs/releve-fournisseurs.md", "docs/archive/releve-fournisseurs.md"),
    ("docs/vocabulaire-a-fermer.md", "docs/archive/vocabulaire-a-fermer.md"),
    ("docs/v21-arbitrages.md", "docs/archive/v21-arbitrages.md"),
    ("docs/vignettes-vues.md", "docs/archive/vignettes-vues.md"),
    ("docs/v3-animation.md", "docs/archive/v3-animation.md"),
    ("docs/recherche-video-locale", "docs/archive/recherche-video-locale"),
    ("docs/recherche-llm-local", "docs/archive/recherche-llm-local"),
    ("docs/status-atelier-unifie", "docs/archive/status-atelier-unifie"),
    ("docs/pistes-2026-09-04", "docs/archive/pistes-2026-09-04"),
    ("docs/maquettes-v2.1", "docs/archive/maquettes-v2.1"),
    ("docs/maquettes-v2.4", "docs/archive/maquettes-v2.4"),
    ("docs/maquettes-v3", "docs/archive/maquettes-v3"),
    ("docs/diagrams", "docs/archive/diagrams"),
]

# Les deux fichiers de la descente elle-même. Ils nomment les anciennes adresses
# **parce que c'est leur travail** ; les rediriger effacerait la trace de ce qui
# a bougé, et rendrait le script faux au second passage.
EXCLUS = {
    "essais/descendre_docs_20260913.sh",
    "essais/rediriger_renvois_20260913.py",
}

# Les fichiers que le dépôt écrit à la main. Les images, les archives et les
# verrous de dépendances n'ont aucun renvoi à rediriger.
SUFFIXES = {
    ".md", ".py", ".ts", ".tsx", ".js", ".html", ".css", ".json",
    ".toml", ".txt", ".bat", ".sh", ".yml", ".yaml",
}


def fichiers_suivis() -> list[Path]:
    sortie = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=RACINE, capture_output=True, check=True,
    ).stdout
    chemins = []
    for brut in sortie.split(b"\x00"):
        if not brut:
            continue
        relatif = brut.decode("utf-8")
        if relatif in EXCLUS:
            continue
        chemin = RACINE / relatif
        if chemin.suffix.lower() in SUFFIXES and chemin.is_file():
            chemins.append(chemin)
    return chemins


def main() -> int:
    a_blanc = "--a-blanc" in sys.argv
    couples = [(a.encode(), b.encode()) for a, b in REDIRECTIONS]

    touches = 0
    redirections = 0
    for chemin in fichiers_suivis():
        avant = chemin.read_bytes()
        apres = avant
        compte_du_fichier = 0
        for ancien, nouveau in couples:
            combien = apres.count(ancien)
            if combien:
                apres = apres.replace(ancien, nouveau)
                compte_du_fichier += combien
        if compte_du_fichier:
            touches += 1
            redirections += compte_du_fichier
            relatif = chemin.relative_to(RACINE).as_posix()
            print(f"  {compte_du_fichier:4d}  {relatif}")
            if not a_blanc:
                chemin.write_bytes(apres)

    print()
    verbe = "à rediriger" if a_blanc else "redirigés"
    print(f"{redirections} renvoi(s) {verbe} dans {touches} fichier(s).")
    if not a_blanc:
        print("Maintenant : py essais/essai_docs.py — il dit ce qui reste cassé.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
