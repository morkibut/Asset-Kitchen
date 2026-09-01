# -*- coding: utf-8 -*-
"""Les chemins du dépôt et **les secrets des fournisseurs**.

La clé d'OpenRouter a longtemps été *le seul préalable dur du produit* (T1).
Elle a cessé de l'être en F1, quand un fournisseur qui ne demande rien est
entré ; et elle a cessé d'être **la** clé en F3, quand le tiroir est passé au
pluriel. Ce module ne connaît plus qu'une chose : **une place nommée, et ce
qu'il y a dedans**. Quelles places existent, c'est aux adaptateurs de le dire.

Une valeur se dépose une fois et n'est plus jamais redemandée : l'environnement
d'abord, puis `.env` à la racine du dépôt. Déposer l'une **ne touche à aucune
autre** — c'est le premier critère de F3, et c'est la ligne du fichier qui le
tient : on réécrit la sienne, on recopie les autres telles quelles.

Le fichier `.env` est lu **en essayant plusieurs encodages**. PowerShell écrit en
UTF-16 avec `>` et `Out-File` : un `.env` créé au terminal Windows n'est pas de
l'UTF-8, et le lire comme tel lève sur le tout premier octet. Piège vérifié —
voir `docs/PIEGES.md`.
"""

from __future__ import annotations

import os
from pathlib import Path

from atelier.domaine.secret import EtatSecret

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "donnees"
FICHIER_ENV = RACINE / ".env"

ENCODAGES = ("utf-8-sig", "utf-16", "utf-8", "latin-1")


# ── Lire ─────────────────────────────────────────────────────────────────────


def _decoder(octets: bytes) -> str | None:
    """Le texte du `.env`, quel que soit l'encodage sous lequel il a été écrit.

    **Aucune sentinelle** depuis F3 : la version d'avant ne rendait le texte que
    s'il contenait `OPENROUTER_API_KEY`, ce qui était juste tant qu'il n'y avait
    qu'un secret au monde. Un fichier qui ne porterait qu'un jeton Cloudflare
    aurait alors été illisible, et le produit aurait dit *aucun jeton* sur un
    fichier qui en portait un. On décode donc au premier encodage qui accepte
    les octets, et l'ordre des tentatives fait le reste.
    """
    for encodage in ENCODAGES:
        try:
            return octets.decode(encodage)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return None


def _lignes() -> list[str]:
    if not FICHIER_ENV.exists():
        return []
    texte = _decoder(FICHIER_ENV.read_bytes())
    return texte.splitlines() if texte is not None else []


def _depuis_fichier(nom: str) -> str:
    for ligne in _lignes():
        propre = ligne.strip()
        if propre.startswith(f"{nom}=") or propre.startswith(f"{nom} ="):
            _, _, valeur = propre.partition("=")
            return valeur.strip().strip('"').strip("'")
    return ""


def lire_secret(nom: str) -> str:
    """La valeur d'une place, ou une chaîne vide.

    **Ne lève jamais** : l'absence n'est pas une panne, c'est un état du produit
    que l'écran sait dire. Et elle se relit **à chaque appel** — règle de T1,
    étendue au pluriel plutôt que réécrite : une valeur déposée sert au premier
    appel suivant, sans redémarrer.
    """
    depuis_environnement = os.environ.get(nom, "").strip()
    if depuis_environnement:
        return depuis_environnement
    return _depuis_fichier(nom)


def lire_secrets(noms) -> dict[str, str]:
    """Plusieurs places d'un coup — ce dont un adaptateur à deux secrets a besoin."""
    return {nom: lire_secret(nom) for nom in noms}


def etat_secret(nom: str, libelle: str = "", ou: str = "") -> EtatSecret:
    """Ce que l'écran affiche d'une place : **jamais la valeur, son aperçu**."""
    depuis_environnement = os.environ.get(nom, "").strip()
    if depuis_environnement:
        return EtatSecret(
            nom, libelle, ou, True, "environnement", depuis_environnement[-6:]
        )
    valeur = _depuis_fichier(nom)
    if valeur:
        return EtatSecret(nom, libelle, ou, True, "fichier", valeur[-6:])
    return EtatSecret(nom, libelle, ou, False, "absente", "")


# ── Écrire ───────────────────────────────────────────────────────────────────


def deposer_secret(nom: str, valeur: str) -> EtatSecret:
    """Écrit une valeur dans `.env`, **sans toucher aux autres lignes**.

    Le fichier n'est jamais versionné (`.gitignore`) ; `.env.example` documente
    les noms. Aucun secret en dur nulle part — règle durable d'`AGENTS.md`.

    `os.environ.pop` à la fin : une valeur posée dans l'environnement de ce
    processus masquerait celle qu'on vient d'écrire, et l'écran afficherait
    l'ancienne juste après qu'on a déposé la nouvelle.
    """
    valeur = valeur.strip()
    if not valeur:
        raise ValueError("valeur vide")

    lignes = [l for l in _lignes() if not l.strip().startswith(f"{nom}=")]
    lignes.append(f"{nom}={valeur}")
    FICHIER_ENV.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    os.environ.pop(nom, None)
    return etat_secret(nom)


def retirer_secret(nom: str) -> EtatSecret:
    """Enlève une place du `.env`, et **rien d'autre** (F3).

    *Retirer une clé grise ses modèles et ne supprime ni une image, ni une ligne
    de dépense* : ce module ne touche qu'à un fichier de configuration, et il
    n'existe aucun chemin d'ici vers `donnees/`. La règle est donc tenue par ce
    qui n'est pas écrit plutôt que par une précaution.

    Rendre l'état après coup, plutôt que rien : c'est ce que l'écran affiche, et
    une place vidée pendant qu'une valeur traîne dans l'environnement reste
    **présente** — ce qui est la vérité, et ce que le produit doit dire.
    """
    lignes = [l for l in _lignes() if not l.strip().startswith(f"{nom}=")]
    if lignes or FICHIER_ENV.exists():
        FICHIER_ENV.write_text(
            ("\n".join(lignes) + "\n") if lignes else "", encoding="utf-8"
        )
    return etat_secret(nom)
