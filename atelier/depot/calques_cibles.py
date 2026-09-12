"""Les variantes ciblées, sur disque et indépendantes de l'index jetable."""
from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any


class DepotCalquesCibles:
    def __init__(self, projets: Path):
        self.projets = projets.resolve()

    def dossier(self, projet: str, piece: str, emploi: str) -> Path:
        chemin = (self.projets / projet / "calques-cibles" / piece / emploi).resolve()
        if not chemin.is_relative_to(self.projets):
            raise ValueError("le rangement du calque doit rester dans les données du projet")
        return chemin

    def chemin(self, projet: str, piece: str, emploi: str, identifiant: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}", identifiant):
            raise ValueError("identifiant de variante inconnu")
        return self.dossier(projet, piece, emploi) / identifiant

    @staticmethod
    def lire(chemin: Path) -> dict[str, Any]:
        return json.loads(chemin.read_text(encoding="utf-8"))

    @staticmethod
    def ecrire(chemin: Path, contenu: dict[str, Any]) -> None:
        chemin.parent.mkdir(parents=True, exist_ok=True)
        temporaire = chemin.with_suffix("." + uuid.uuid4().hex + ".tmp")
        try:
            with temporaire.open("w", encoding="utf-8") as fichier:
                json.dump(contenu, fichier, ensure_ascii=False, indent=2, allow_nan=False)
                fichier.flush()
                os.fsync(fichier.fileno())
            os.replace(temporaire, chemin)
        finally:
            temporaire.unlink(missing_ok=True)

    def variantes(self, projet: str, piece: str, emploi: str) -> list[dict[str, Any]]:
        dossier = self.dossier(projet, piece, emploi)
        return sorted((self.lire(p) for p in dossier.glob("*/variante.json")),
                      key=lambda v: (v["cree_le"], v["identifiant"]))
