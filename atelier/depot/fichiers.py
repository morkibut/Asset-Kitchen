# -*- coding: utf-8 -*-
"""L'arborescence de `donnees/`, et rien d'autre.

    donnees/
    ├─ atelier.sqlite3            l'index — jetable, reconstructible
    ├─ catalogue.json             la dernière photo du catalogue, datée
    ├─ recettes.json              les recettes nommées (US-66)
    └─ generations/<identifiant>/
       ├─ generation.json         l'enregistrement complet, lisible sans la base
       ├─ <rang>-brut.<ext>       l'image telle qu'elle est arrivée
       ├─ <rang>-asset.json       l'asset : sa recette, son label, ses mesures
       └─ <rang>-rendu.png        le rendu — **un cache, effaçable**

Trois fichiers par image produite, et un seul est irremplaçable. Le brut ne
change jamais ; l'asset porte la recette, donc la vérité ; le rendu se recalcule
en millisecondes depuis les deux autres. Effacer `<rang>-rendu.png` à la main est
un geste sans conséquence — c'est même un critère d'acceptation de T2.

L'asset vit **dans le dossier de la génération** plutôt que dans un dossier à
lui : tout ce qui concerne une image tient au même endroit, et la bibliothèque
de T3 se reconstruira en parcourant un seul arbre.

`donnees/` n'est pas versionné (`.gitignore`).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from atelier.reglages import DONNEES


class Fichiers:
    def __init__(self, racine: Path | None = None) -> None:
        self.racine = racine or DONNEES
        self.generations = self.racine / "generations"
        self.catalogue = self.racine / "catalogue.json"
        self.recettes = self.racine / "recettes.json"
        self.base = self.racine / "atelier.sqlite3"

    def preparer(self) -> None:
        self.generations.mkdir(parents=True, exist_ok=True)

    # ── Générations ──────────────────────────────────────────────────────────

    def dossier_generation(self, identifiant: str) -> Path:
        dossier = self.generations / identifiant
        dossier.mkdir(parents=True, exist_ok=True)
        return dossier

    def ecrire_brut(self, identifiant: str, rang: int, octets: bytes, ext: str) -> str:
        """Écrit l'image telle qu'elle est arrivée, et rend son chemin relatif.

        **Au fil de l'eau, jamais à la fin** : un lot payant qui écrit ses
        résultats à la fin perd tout ce qui précède le plantage. Constaté le
        26 août 2026 sur le banc de modèles (`AGENTS.md` § Pièges connus).
        """
        chemin = self.dossier_generation(identifiant) / f"{rang}-brut{ext}"
        chemin.write_bytes(octets)
        return chemin.relative_to(self.racine).as_posix()

    def lire(self, chemin_relatif: str) -> bytes:
        return (self.racine / chemin_relatif).read_bytes()

    def existe(self, chemin_relatif: str) -> bool:
        return (self.racine / chemin_relatif).is_file()

    def ecrire_enregistrement(self, identifiant: str, contenu: dict[str, Any]) -> None:
        chemin = self.dossier_generation(identifiant) / "generation.json"
        chemin.write_text(
            json.dumps(contenu, indent=1, ensure_ascii=False), encoding="utf-8"
        )

    # ── Assets, recettes et rendus ───────────────────────────────────────────

    def ecrire_asset(self, generation: str, rang: int, contenu: dict[str, Any]) -> None:
        """L'asset s'écrit à côté de son image. C'est lui qui fait foi.

        « Les fichiers font foi, la base est un index reconstructible »
        (`docs/ARCHITECTURE.md` §4). L'invariant n'entre en vigueur qu'en T3,
        mais une recette perdue avec la base coûterait tout le travail de
        retouche — donc il se paie ici.
        """
        chemin = self.dossier_generation(generation) / f"{rang}-asset.json"
        chemin.write_text(
            json.dumps(contenu, indent=1, ensure_ascii=False), encoding="utf-8"
        )

    def ecrire_rendu(self, generation: str, rang: int, octets: bytes) -> str:
        """Le cache. Un seul fichier par emplacement, réécrit sur place.

        Un nom par empreinte laisserait derrière lui un rendu par réglage
        essayé — des dizaines de fichiers pour une image, et rien qui les
        ramasse. L'empreinte vit dans l'enregistrement de l'asset : un fichier
        présent dont l'empreinte ne correspond plus est traité exactement comme
        un fichier absent.
        """
        chemin = self.dossier_generation(generation) / f"{rang}-rendu.png"
        chemin.write_bytes(octets)
        return chemin.relative_to(self.racine).as_posix()

    def supprimer(self, chemin_relatif: str) -> None:
        """Efface un fichier de cache. Ne lève pas s'il n'est plus là."""
        (self.racine / chemin_relatif).unlink(missing_ok=True)

    def ecrire_recettes(self, contenu: dict[str, Any]) -> None:
        self.racine.mkdir(parents=True, exist_ok=True)
        self.recettes.write_text(
            json.dumps(contenu, indent=1, ensure_ascii=False), encoding="utf-8"
        )

    def lire_recettes(self) -> dict[str, Any]:
        if not self.recettes.exists():
            return {}
        try:
            return json.loads(self.recettes.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return {}

    # ── Catalogue ────────────────────────────────────────────────────────────

    def ecrire_catalogue(self, contenu: dict[str, Any]) -> None:
        self.racine.mkdir(parents=True, exist_ok=True)
        self.catalogue.write_text(
            json.dumps(contenu, indent=1, ensure_ascii=False), encoding="utf-8"
        )

    def lire_catalogue(self) -> dict[str, Any] | None:
        if not self.catalogue.exists():
            return None
        try:
            return json.loads(self.catalogue.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return None
