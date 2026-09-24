# -*- coding: utf-8 -*-
"""Le coup de main : ce qu'est un appel de texte, et ce qu'il laisse derrière lui.

Arrivé en CM1 (`docs/PLAN-assistant.md`). **Le premier appel de texte du
produit** : jusqu'ici, tout ce qui partait chez un fournisseur revenait en
image, en clip ou en son. Ce module ne sait rien d'OpenRouter ni du réseau — il
dit ce qu'on garde d'un appel, et sous quelle forme le service le rend à qui
l'écoute.

**Un appel de texte n'est pas une génération**, et c'est la décision qui donne
sa forme à tout le reste. Une génération porte des emplacements, une grille, une
filiation, une bibliothèque — dix lecteurs du dépôt parcourent les générations
en supposant qu'une image peut en sortir, et le rattrapage de l'ouverture a déjà
empêché l'atelier de démarrer une fois pour un clip qui n'en était pas une
(`atelier/services/assets.py`, `rattraper`). Un appel de texte ne produit rien
qu'on garde : il **coûte**, et c'est tout ce qu'il faut en retenir.

**Mais il se compte comme une génération**, avec les mêmes mots : `consomme`,
`unite`, et `cout_usd` **déduit** par `argent()` — d'où *un total en argent ne
compte que de l'argent*, tenu par construction ici comme ailleurs (point 2
d'`AGENTS.md`). Le modèle se nomme « fournisseur:nom » (point 1).

**Ce qui n'est pas gardé : les textes eux-mêmes.** Le journal sert à expliquer
une facture — quand, quel métier, quel modèle, combien —, pas à relire ce que
l'auteur a demandé. Seules leurs longueurs restent, parce qu'elles expliquent un
prix.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.consommation import USD, argent

# ── L'issue d'un appel — liste close ─────────────────────────────────────────
#
# Quatre, et elles se distinguent par **qui a mis fin à l'appel** :
#
# - `repondu` : le fournisseur a fini sa réponse ;
# - `echoue` : le fournisseur a dit non, ou n'a pas été joint ;
# - `abandonne` : le délai court est passé, **et le serveur a raccroché** —
#   jamais un appel qui continue à courir et à se facturer sans écran ;
# - `interrompu` : celui qui écoutait est parti (Échap, onglet fermé), et le
#   serveur a raccroché de même.
REPONDU = "repondu"
ECHOUE = "echoue"
ABANDONNE = "abandonne"
INTERROMPU = "interrompu"
ISSUES = (REPONDU, ECHOUE, ABANDONNE, INTERROMPU)

# ── Les métiers, et leur consigne — liste close, écrite dans le dépôt ────────
#
# Décision 1 du plan : **trois métiers, jamais quatre**, chacun avec sa consigne
# fixe. La route n'accepte qu'un nom de cette table : l'écran ne peut donc pas
# envoyer une consigne de son cru, et l'atelier n'ouvre aucune discussion libre
# avec un modèle payé.
#
# ⚠️ **Vide en CM1, et c'est délibéré.** CM1 pose le tuyau ; la première
# consigne s'écrit en CM3 (« améliorer »), la deuxième en CM4 (« question »), la
# troisième en CM5 (« blocage »). Tant qu'elle est vide, la route répond 404 à
# tout métier : elle attend son premier écran (règle 8nonies d'`AGENTS.md`).
CONSIGNES: dict[str, str] = {}


@dataclass(slots=True)
class AppelTexte:
    """Un appel parti chez le modèle de texte, et ce qu'il a coûté.

    Écrit **dès que l'appel s'est terminé**, quelle qu'en soit l'issue : un
    appel qui a été coupé a pu consommer, et c'est justement celui qu'on
    cherchera à expliquer. Un appel qui n'est **pas parti** — pas de clé — n'est
    pas écrit du tout : il n'a rien coûté, il n'y a rien à expliquer.
    """

    identifiant: str
    modele: str  # « OpenRouter:deepseek/deepseek-v4-flash » — point 1
    metier: str
    cree_le: float = field(default_factory=time.time)
    issue: str = INTERROMPU
    consomme: float = 0.0
    unite: str = USD
    duree_s: float = 0.0
    raison: str | None = None
    # **Le coût n'a pas été rendu.** OpenRouter le dit dans le dernier message
    # du flux ; un appel coupé avant ce message a pu consommer sans qu'on le
    # sache. Vrai alors, pour que la ligne ne se lise pas « gratuit » : zéro
    # connu et zéro inconnu ne sont pas la même chose.
    cout_inconnu: bool = False
    # Le numéro de l'appel chez le fournisseur (`gen-…`). C'est lui qui permettra
    # d'aller relire le coût d'un appel coupé, si l'on en a un jour besoin.
    chez_lui: str | None = None
    signes_envoyes: int = 0
    signes_recus: int = 0

    @property
    def cout_usd(self) -> float:
        """La part en argent. **Déduite**, jamais enregistrée à part (F2)."""
        return argent(self.consomme, self.unite)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "modele": self.modele,
            "metier": self.metier,
            "cree_le": self.cree_le,
            "issue": self.issue,
            "consomme": self.consomme,
            "unite": self.unite,
            # Déduit, écrit quand même — même règle que `Emplacement` : la base
            # l'interroge, et il n'est jamais relu (voir `depuis_json`).
            "cout_usd": self.cout_usd,
            "duree_s": self.duree_s,
            "raison": self.raison,
            "cout_inconnu": self.cout_inconnu,
            "chez_lui": self.chez_lui,
            "signes_envoyes": self.signes_envoyes,
            "signes_recus": self.signes_recus,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "AppelTexte":
        return AppelTexte(
            identifiant=str(d["identifiant"]),
            modele=str(d["modele"]),
            metier=str(d.get("metier") or ""),
            cree_le=float(d.get("cree_le") or 0.0),
            issue=str(d.get("issue") or INTERROMPU),
            consomme=float(d.get("consomme") or 0.0),
            unite=str(d.get("unite") or USD),
            duree_s=float(d.get("duree_s") or 0.0),
            raison=d.get("raison"),
            cout_inconnu=bool(d.get("cout_inconnu", False)),
            chez_lui=d.get("chez_lui"),
            signes_envoyes=int(d.get("signes_envoyes") or 0),
            signes_recus=int(d.get("signes_recus") or 0),
        )


# ── Ce que le service rend à qui l'écoute ────────────────────────────────────
#
# Trois genres, et un flux en contient toujours **exactement un** des deux
# derniers, en dernier :
#
# - `texte` : un morceau de la réponse, tel qu'il arrive — plusieurs par appel ;
# - `fin` : l'appel est terminé, et voici son issue et ce qu'il a coûté ;
# - `indisponible` : rien n'est parti, et voici pourquoi. **Ce n'est pas une
#   erreur** (décision 6) : l'écran s'en sert pour ne pas montrer la marque.
TEXTE = "texte"
FIN = "fin"
INDISPONIBLE = "indisponible"


@dataclass(frozen=True, slots=True)
class Morceau:
    genre: str
    texte: str = ""
    raison: str | None = None
    appel: AppelTexte | None = None

    def en_json(self) -> dict[str, Any]:
        if self.genre == TEXTE:
            return {"genre": TEXTE, "texte": self.texte}
        if self.genre == INDISPONIBLE:
            return {"genre": INDISPONIBLE, "raison": self.raison}
        appel = self.appel
        return {
            "genre": FIN,
            "issue": appel.issue if appel else ECHOUE,
            "raison": appel.raison if appel else self.raison,
            "consomme": appel.consomme if appel else 0.0,
            "unite": appel.unite if appel else USD,
            "cout_usd": appel.cout_usd if appel else 0.0,
            "cout_inconnu": appel.cout_inconnu if appel else False,
        }
