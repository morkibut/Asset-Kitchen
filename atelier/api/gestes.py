# -*- coding: utf-8 -*-
"""Ce que la barre propose — **la liste des outils, et rien qui la double** (B6).

`docs/archive/pistes-2026-09-04/carnet/Barre.dc.html` porte la promesse en trois mots :
*« La liste se remplit toute seule. »* Une action ajoutée au serveur paraît dans
la barre sans qu'on dessine un bouton, parce que la liste servie ici **est** la
liste des outils MCP — la même que celle de l'agent qui code le jeu, lue au même
endroit, dans le même ordre.

Ce module ne connaît donc aucun geste par cœur. Il fait trois choses :

1. Il demande au serveur MCP ce qu'il sait faire (`list_tools`).
2. Il lit sur chaque outil la fiche que `atelier/mcp/serveur.py` y a posée
   (`meta["barre"]`), et **il en fabrique une pour ceux qui n'en ont pas** —
   prudente : à confirmer, donc injouable depuis la barre.
3. Il retire ce qui n'a pas de sens maintenant. *Ce qui ne peut pas se faire ne
   s'affiche pas du tout* — ni grisé, ni proposé, ni accompagné d'une raison :
   un jeu sans personnage n'a pas à porter cinq lignes mortes.

**La barre ne paie et ne lance jamais rien, et c'est tenu ici plutôt que là-bas.**
Une action *à confirmer* sort d'ici sans route : l'interface n'a littéralement
rien à appeler, elle ne peut qu'ouvrir l'écran d'envoi. La règle ne repose pas
sur la vigilance de celui qui écrira le prochain écran.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from atelier.services import Atelier

routeur = APIRouter(tags=["gestes"])


# ── Les six verbes, et il n'y en a pas un septième ───────────────────────────
#
# `Barre.dc.html` range les résultats par verbe, et le carnet ne connaît que
# ceux-là : *aller, créer, générer, travailler, sortir, régler*. L'ordre est
# celui de la fréquence — on cherche où aller cent fois pour un réglage —, et il
# est écrit une seule fois : la route trie avec, l'écran groupe avec.
#
# **Un verbe inconnu ne passe pas.** Une fiche qui en invente un est ramenée sur
# `travailler`, et un essai de `tests/test_b6.py` le tient : la barre montre six
# groupes, pas sept, quel que soit ce qu'un outil déclare.
VERBES: tuple[str, ...] = (
    "aller",
    "creer",
    "generer",
    "travailler",
    "sortir",
    "regler",
)

#: Ce qu'un geste peut réclamer pour avoir un sens. Liste fermée, elle aussi :
#: un besoin qu'on ne sait pas évaluer serait un filtre au hasard.
BESOINS: tuple[str, ...] = (
    "images",
    "personnages",
    "pieces",
    "generations",
    "fournisseur",
)


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def _fiche(outil: Any) -> dict[str, Any]:
    """La fiche de barre d'un outil, ou **le défaut prudent**.

    Un outil neuf, écrit par quelqu'un qui n'a pas lu ce fichier, paraît dans la
    barre — c'est toute la promesse de la tranche — mais avec son titre anglais
    et *à confirmer* : la barre l'ouvrira sur l'écran d'envoi au lieu de le
    lancer. Ce qui coûte un oubli de fiche est une étiquette laide, jamais un
    centime ni un geste imprévu.
    """

    meta = getattr(outil, "meta", None) or {}
    brute = meta.get("barre") if isinstance(meta, dict) else None
    if not isinstance(brute, dict):
        return {
            "verbe": "travailler",
            "titre": outil.title or outil.name,
            "phrase": (outil.description or "").strip(),
            "paiement": "a-confirmer",
            "ou": "",
            "route": "",
            "besoins": [],
        }
    return {
        "verbe": str(brute.get("verbe") or "travailler"),
        "titre": str(brute.get("titre") or outil.title or outil.name),
        "phrase": str(brute.get("phrase") or ""),
        "paiement": str(brute.get("paiement") or "gratuit"),
        "ou": str(brute.get("ou") or ""),
        "route": str(brute.get("route") or ""),
        "besoins": [str(b) for b in (brute.get("besoins") or [])],
    }


def _comptes(atelier: Atelier, projet: str | None) -> dict[str, int]:
    """De quoi le jeu ouvert dispose — **compté, jamais deviné**.

    Les mêmes chiffres servent deux fois : à retirer ce qui n'a pas de sens, et
    à finir les titres qui portent un nombre (*« recalculer le rendu des 45
    images de ce jeu »*). Compter deux fois les aurait fait diverger le jour où
    l'un des deux comptes aurait changé de source.
    """

    if projet is None:
        return dict.fromkeys(BESOINS, 0)
    fournisseurs = sum(1 for t in atelier.fournisseurs.tiroirs() if t.pret)
    return {
        "images": atelier.bibliotheque.compter_projet(projet),
        "personnages": len(atelier.production.personnages(projet)),
        "pieces": len(atelier.equipement.pieces(projet)),
        "generations": len(atelier.generations.chantier(limite=1, projet=projet)),
        "fournisseur": fournisseurs,
    }


def _servir(fiche: dict[str, Any], outil: Any, comptes: dict[str, int]) -> dict[str, Any]:
    """Une action, telle que la barre la reçoit.

    Deux règles sont appliquées **ici et pas à l'écran**, parce qu'un écran se
    réécrit et qu'une règle réécrite est une règle perdue :

    - un verbe hors des six revient sur `travailler` ;
    - **une action à confirmer part sans route**, et son `ou` est l'écran
      d'envoi quoi que la fiche ait dit. C'est la promesse « rien n'est lancé
      depuis la barre », tenue par ce qui n'est pas dans la réponse.
    """

    verbe = fiche["verbe"] if fiche["verbe"] in VERBES else "travailler"
    a_confirmer = fiche["paiement"] == "a-confirmer"
    return {
        "outil": outil.name,
        "verbe": verbe,
        # `{images}` est le seul trou que les titres creusent, et il se bouche
        # avec un compte du serveur — l'écran n'additionne rien.
        "titre": fiche["titre"].replace("{images}", str(comptes.get("images", 0))),
        "phrase": fiche["phrase"],
        "paiement": "a-confirmer" if a_confirmer else "gratuit",
        "ou": "envoi" if a_confirmer else (fiche["ou"] or "ici"),
        "route": "" if a_confirmer else fiche["route"],
        "besoins": fiche["besoins"],
    }


@routeur.get("/actions")
async def actions(requete: Request, projet: str | None = None) -> dict[str, Any]:
    """Ce que la barre peut proposer **maintenant**, dans l'ordre des verbes.

    `projet` vaut le jeu ouvert quand il n'est pas dit — comme partout. Sans
    aucun jeu, tous les besoins valent zéro et il ne reste que les gestes qui
    n'en réclament aucun : changer de jeu, importer, régler. C'est exactement ce
    qu'une machine neuve doit montrer.
    """

    atelier = _atelier(requete)
    ouvert = projet or atelier.bibliotheque.courant
    comptes = _comptes(atelier, ouvert)
    outils = await requete.app.state.mcp.list_tools()

    servies = []
    for outil in outils:
        fiche = _fiche(outil)
        if any(comptes.get(besoin, 0) <= 0 for besoin in fiche["besoins"]):
            continue
        servies.append(_servir(fiche, outil, comptes))
    servies.sort(key=lambda a: (VERBES.index(a["verbe"]), a["titre"]))

    return {"verbes": list(VERBES), "actions": servies}
