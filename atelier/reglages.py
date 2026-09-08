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

import json
import os
from pathlib import Path
from typing import Any

from atelier.domaine.secret import EtatSecret

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "donnees"
FICHIER_ENV = RACINE / ".env"

# **Les réglages de la machine, et jamais un secret** (B15). Un second fichier à
# la racine, à côté de `.env` et jamais versionné comme lui — mais il ne porte
# rien qui se cache : le dossier de travail, l'adresse de ComfyUI, et *le tour
# a-t-il été fait*. Trois choses, et pas une de plus.
#
# ⚠️ **Il vit hors du dossier qu'il désigne**, forcément : un pointeur rangé dans
# ce qu'il pointe ne se retrouve plus quand on change d'adresse.
FICHIER_INSTALLATION = RACINE / "installation.json"

# Les deux places d'environnement de l'installation. **Elles passent devant le
# fichier**, comme pour un secret et pour la même raison : ce que la machine
# impose l'emporte sur ce que le produit a noté.
DOSSIER_ENV = "ATELIER_DONNEES"
COMFY_ENV = "ATELIER_COMFY"

# ⚠️ **Le port par défaut de ComfyUI n'est pas écrit ici.** C'est l'adaptateur
# qui sait où une application tierce écoute (`atelier.fournisseur.maison`), et
# `adresse_comfy()` le reçoit en paramètre plutôt que de l'importer : deux
# endroits qui déclareraient le même port finiraient par en déclarer deux.

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


# ── L'installation de la machine (B15) ───────────────────────────────────────
#
# **Ce bloc ne touche à aucun secret.** Il porte ce qui décrit la machine et
# non le compte : où l'atelier range ses fichiers, où ComfyUI écoute, et si le
# tour du propriétaire a déjà été fait. Rien de ce qui passe par ici n'a besoin
# d'être caché, et rien de ce qui est caché ne passe par ici.


def _texte_du_fichier(chemin: Path) -> str | None:
    """Le contenu d'un fichier de configuration, quel que soit son encodage.

    Même précaution que pour `.env`, et pour la même raison : ces fichiers sont
    écrits par le produit en UTF-8, mais rien n'empêche de les corriger à la
    main au terminal — et PowerShell écrit en UTF-16 avec `>` et `Out-File`
    (`docs/PIEGES.md`). Un fichier illisible n'est pas une panne : c'est un
    réglage qu'on n'a pas, et le produit reprend ses valeurs par défaut.
    """
    if not chemin.is_file():
        return None
    octets = chemin.read_bytes()
    for encodage in ENCODAGES:
        try:
            return octets.decode(encodage)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return None


def lire_installation() -> dict[str, Any]:
    """Les réglages de la machine, ou un dictionnaire vide. **Ne lève jamais.**

    Un fichier absent, illisible ou abîmé rend `{}` : l'atelier doit s'ouvrir
    sur ses valeurs par défaut plutôt que refuser de démarrer parce qu'un
    réglage facultatif est mal formé. C'est la règle de `Fichiers._lire_json`,
    appliquée un cran plus tôt — avant même qu'un dossier de travail existe.
    """
    texte = _texte_du_fichier(FICHIER_INSTALLATION)
    if not texte:
        return {}
    try:
        contenu = json.loads(texte)
    except (json.JSONDecodeError, ValueError):
        return {}
    return contenu if isinstance(contenu, dict) else {}


def poser_installation(**champs: Any) -> dict[str, Any]:
    """Écrit un ou plusieurs réglages, **sans toucher aux autres**.

    Même règle que `deposer_secret` : on relit, on remplace la sienne, on
    recopie le reste. Un écran qui pose un champ à la fois ne doit pas effacer
    ce qu'un autre vient d'écrire.

    **Et le fichier s'écrit entièrement ou pas du tout** : on écrit à côté, puis
    on renomme (`docs/PIEGES.md` — *un fichier qui fait foi s'écrit entièrement
    ou pas du tout*). Un `installation.json` tronqué désignerait un dossier de
    travail qui n'existe pas, et l'atelier ne s'ouvrirait plus.
    """
    reglages = lire_installation()
    reglages.update(champs)
    octets = json.dumps(reglages, indent=1, ensure_ascii=False).encode("utf-8")
    FICHIER_INSTALLATION.parent.mkdir(parents=True, exist_ok=True)
    provisoire = FICHIER_INSTALLATION.with_name(FICHIER_INSTALLATION.name + ".ecriture")
    provisoire.write_bytes(octets)
    os.replace(provisoire, FICHIER_INSTALLATION)
    return reglages


def _reglage(nom_env: str, cle: str) -> tuple[str, str]:
    """La valeur d'un réglage de machine et **d'où elle vient**.

    L'environnement d'abord, le fichier ensuite — l'ordre des secrets, pour la
    raison des secrets : ce que la machine impose l'emporte sur ce que le
    produit a noté, et l'écran doit pouvoir dire lequel des deux parle.
    """
    depuis_environnement = os.environ.get(nom_env, "").strip()
    if depuis_environnement:
        return depuis_environnement, "environnement"
    valeur = str(lire_installation().get(cle) or "").strip()
    if valeur:
        return valeur, "fichier"
    return "", "defaut"


def dossier_de_travail() -> Path:
    """Où l'atelier range tout — **le seul endroit du produit qui le décide**.

    `Fichiers.__init__` est son unique lecteur, et c'est ce qui rend le dossier
    déplaçable sans toucher un seul appel ailleurs.

    ⚠️ **Le changement prend effet au prochain démarrage, et c'est délibéré.**
    L'atelier construit son graphe d'objets une fois — la base SQLite est
    ouverte sur un chemin, les services le tiennent — et rien n'est déplacé sur
    le disque : ce qui est déjà rangé reste où il est. Poser une adresse est
    donc un geste sans risque et réversible, là où déménager des gigaoctets
    sous une base ouverte n'en serait pas un.
    """
    valeur, origine = _reglage(DOSSIER_ENV, "dossier")
    return Path(valeur).expanduser() if origine != "defaut" else DONNEES


def origine_du_dossier() -> str:
    """`environnement` | `fichier` | `defaut` — ce que l'écran affiche à côté."""
    return _reglage(DOSSIER_ENV, "dossier")[1]


def adresse_comfy(defaut: str) -> str:
    """Où ComfyUI écoute. **Le défaut vient de l'adaptateur**, jamais d'ici.

    ⚠️ Avant `B15`, `ATELIER_COMFY` était cité par un commentaire de
    `atelier/fournisseur/maison.py` et **lu par personne** : l'adresse était en
    dur, et rien au monde ne la changeait. Le commentaire disait vrai depuis
    cette fonction-ci.
    """
    valeur, origine = _reglage(COMFY_ENV, "comfy")
    return valeur.rstrip("/") if origine != "defaut" else defaut


def origine_de_l_adresse() -> str:
    """`environnement` | `fichier` | `defaut`, comme pour le dossier."""
    return _reglage(COMFY_ENV, "comfy")[1]


def tour_deja_fait() -> bool:
    """Le tour du propriétaire a-t-il déjà été passé sur cette machine ?

    **Ce n'est que la moitié de la réponse.** L'autre moitié — *l'atelier
    a-t-il déjà des jeux ?* — se lit sur le disque, et c'est le service de
    l'installation qui les réunit : un fichier absent sur un atelier qui
    travaille depuis un mois ne doit pas faire surgir un guide de bienvenue.
    """
    return bool(lire_installation().get("tour_fait"))
