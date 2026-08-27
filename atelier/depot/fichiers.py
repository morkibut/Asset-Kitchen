# -*- coding: utf-8 -*-
"""L'arborescence de `donnees/`, et rien d'autre.

    donnees/
    ├─ atelier.sqlite3            l'index — jetable, reconstructible
    ├─ catalogue.json             la dernière photo du catalogue, datée
    └─ generations/<identifiant>/
       ├─ generation.json         l'enregistrement complet, lisible sans la base
       └─ <rang>-brut.<ext>       l'image telle qu'elle est arrivée

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
