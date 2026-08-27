# -*- coding: utf-8 -*-
"""Les chemins du dépôt et la clé du fournisseur.

**La clé est le seul préalable dur du produit** (`docs/PLAN.md`, T1). Elle se
dépose une fois et n'est plus jamais redemandée : l'environnement d'abord, puis
`.env` à la racine du dépôt.

Le fichier `.env` est lu **en essayant plusieurs encodages**. PowerShell écrit en
UTF-16 avec `>` et `Out-File` : un `.env` créé au terminal Windows n'est pas de
l'UTF-8, et le lire comme tel lève sur le tout premier octet. Piège vérifié —
voir `AGENTS.md` § Pièges connus.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "donnees"
FICHIER_ENV = RACINE / ".env"

NOM_CLE = "OPENROUTER_API_KEY"
ENCODAGES = ("utf-8-sig", "utf-16", "utf-8", "latin-1")


@dataclass(frozen=True, slots=True)
class EtatCle:
    """Ce que l'interface a besoin de savoir sans jamais voir la clé."""

    presente: bool
    origine: str  # "environnement" | "fichier" | "absente"
    apercu: str  # les six derniers caractères, jamais la clé entière

    @property
    def raison(self) -> str | None:
        """La raison du grisé, en clair, quand générer est impossible."""
        return None if self.presente else "aucune clé OpenRouter"

    def en_json(self) -> dict[str, object]:
        """Ce qui part vers l'interface — jamais la clé, seulement son aperçu."""
        return {
            "presente": self.presente,
            "origine": self.origine,
            "apercu": self.apercu,
            "raison": self.raison,
        }


def _decoder(octets: bytes) -> str | None:
    for encodage in ENCODAGES:
        try:
            texte = octets.decode(encodage)
        except (UnicodeDecodeError, UnicodeError):
            continue
        if NOM_CLE in texte:
            return texte
    return None


def _lire_fichier() -> str:
    if not FICHIER_ENV.exists():
        return ""
    texte = _decoder(FICHIER_ENV.read_bytes())
    if texte is None:
        return ""
    for ligne in texte.splitlines():
        if ligne.strip().startswith(NOM_CLE):
            _, _, valeur = ligne.partition("=")
            return valeur.strip().strip('"').strip("'")
    return ""


def lire_cle() -> str:
    """La clé, ou une chaîne vide. Ne lève jamais : l'absence n'est pas une panne."""
    depuis_environnement = os.environ.get(NOM_CLE, "").strip()
    if depuis_environnement:
        return depuis_environnement
    return _lire_fichier()


def etat_cle() -> EtatCle:
    if os.environ.get(NOM_CLE, "").strip():
        cle = os.environ[NOM_CLE].strip()
        return EtatCle(True, "environnement", cle[-6:])
    cle = _lire_fichier()
    if cle:
        return EtatCle(True, "fichier", cle[-6:])
    return EtatCle(False, "absente", "")


def deposer_cle(cle: str) -> EtatCle:
    """Écrit la clé dans `.env`, en UTF-8, sans toucher aux autres lignes.

    Le fichier n'est jamais versionné (`.gitignore`) ; `.env.example` documente
    les noms. Aucune clé en dur nulle part — règle durable d'`AGENTS.md`.
    """
    cle = cle.strip()
    if not cle:
        raise ValueError("clé vide")

    lignes: list[str] = []
    if FICHIER_ENV.exists():
        texte = _decoder(FICHIER_ENV.read_bytes())
        if texte is None:
            texte = FICHIER_ENV.read_bytes().decode("utf-8", errors="replace")
        lignes = [l for l in texte.splitlines() if not l.strip().startswith(NOM_CLE)]

    lignes.append(f"{NOM_CLE}={cle}")
    FICHIER_ENV.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    os.environ.pop(NOM_CLE, None)
    return etat_cle()
