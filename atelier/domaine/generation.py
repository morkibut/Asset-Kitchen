# -*- coding: utf-8 -*-
"""Une génération, ses emplacements, et ce qu'ils coûtent réellement.

Trois invariants sont portés ici, et ils sont instaurés dès T1
(`docs/PLAN.md` § Les invariants) :

1. **L'identifiant est unique** — deux soumissions du même identifiant ne
   facturent qu'une fois. C'est l'identifiant qui l'empêche, pas un verrou.
2. **Le coût enregistré est celui que l'appel facture**, jamais le tarif affiché
   au catalogue. Mesuré : `riverflow-v2.5-fast` annonce $0,019 et facture $0,042.
3. **Les dimensions mesurées font foi**, jamais celles demandées.

Une génération de N variations tient N **emplacements** indépendants. Un
emplacement réussit ou échoue seul : les images qui arrivent arrivent, même
quand leurs voisines échouent, et relancer l'une ne rejoue pas les autres.
Les N appels partent ensemble, jamais l'un après l'autre.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Statut(str, Enum):
    EN_ATTENTE = "en_attente"
    EN_COURS = "en_cours"
    REUSSIE = "reussie"
    ECHOUEE = "echouee"
    INTERROMPUE = "interrompue"

    @property
    def terminee(self) -> bool:
        return self in (Statut.REUSSIE, Statut.ECHOUEE, Statut.INTERROMPUE)


@dataclass(slots=True)
class Resultat:
    """Une image reçue, telle qu'elle est arrivée. Le brut, jamais un rendu."""

    fichier: str  # chemin relatif à `donnees/`
    largeur: int  # mesuré sur l'image reçue
    hauteur: int  # mesuré sur l'image reçue
    type_media: str  # ce que le fournisseur a réellement rendu
    octets: int

    def en_json(self) -> dict[str, Any]:
        return {
            "fichier": self.fichier,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "type_media": self.type_media,
            "octets": self.octets,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Resultat":
        return Resultat(
            fichier=d["fichier"],
            largeur=d["largeur"],
            hauteur=d["hauteur"],
            type_media=d["type_media"],
            octets=d["octets"],
        )


@dataclass(slots=True)
class Emplacement:
    """Une variation. La tuile paraît ici, et ne bouge plus.

    « La grille ne se recompose jamais entre le départ et l'arrivée » —
    `docs/DESIGN.md` § L'emplacement. L'échec atterrit à l'endroit précis où le
    succès serait arrivé : c'est pour ça que l'emplacement existe avant l'image.
    """

    rang: int
    statut: Statut = Statut.EN_ATTENTE
    cout_usd: float = 0.0  # ce que l'appel a facturé, y compris quand il échoue
    duree_s: float = 0.0
    resultat: Resultat | None = None
    raison: str | None = None

    # ── Ce qu'il faut pour une jauge **déterminée** ───────────────────────────
    #
    # `docs/DESIGN.md` § Motion veut la jauge déterminée — « ça travaille, et
    # voilà où ça en est ». Aucun fournisseur d'image ne rend d'avancement
    # intermédiaire : il n'y a rien à relayer, il faut une **attente estimée**.
    #
    # Deux faits suffisent, et ce sont des faits : l'instant du départ, et la
    # durée que ce modèle a réellement mise les fois précédentes. Aucun taux
    # d'avancement n'est enregistré ici — un pourcentage inventé n'est pas une
    # mesure, et ce dépôt n'écrit pas de nombre qui ne mesure rien. C'est
    # l'interface qui trace, à partir de ces deux-là.
    demarre_le: float | None = None
    duree_attendue_s: float = 0.0

    def en_json(self) -> dict[str, Any]:
        return {
            "rang": self.rang,
            "statut": self.statut.value,
            "cout_usd": self.cout_usd,
            "duree_s": self.duree_s,
            "resultat": self.resultat.en_json() if self.resultat else None,
            "raison": self.raison,
            "demarre_le": self.demarre_le,
            "duree_attendue_s": self.duree_attendue_s,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Emplacement":
        brut = d.get("resultat")
        return Emplacement(
            rang=d["rang"],
            statut=Statut(d["statut"]),
            cout_usd=d.get("cout_usd", 0.0),
            duree_s=d.get("duree_s", 0.0),
            resultat=Resultat.depuis_json(brut) if brut else None,
            raison=d.get("raison"),
            demarre_le=d.get("demarre_le"),
            duree_attendue_s=d.get("duree_attendue_s", 0.0),
        )


@dataclass(slots=True)
class Generation:
    identifiant: str
    modele: str
    demande: dict[str, Any]  # ce que l'auteur a demandé
    parametres_resolus: dict[str, Any]  # ce qui est réellement parti
    ecartees: list[str] = field(default_factory=list)  # ce que le modèle ne déclare pas
    emplacements: list[Emplacement] = field(default_factory=list)
    cree_le: float = field(default_factory=time.time)
    projet: str | None = None  # le rangement arrive en T3 ; la colonne l'attend

    # ── Ce qui se déduit, et n'est donc jamais enregistré deux fois ───────────

    @property
    def statut(self) -> Statut:
        statuts = [e.statut for e in self.emplacements]
        if not statuts:
            return Statut.EN_ATTENTE
        if any(s == Statut.EN_COURS for s in statuts):
            return Statut.EN_COURS
        if any(s == Statut.EN_ATTENTE for s in statuts):
            return Statut.EN_ATTENTE
        if any(s == Statut.REUSSIE for s in statuts):
            return Statut.REUSSIE  # un lot où une image est arrivée n'est pas perdu
        if any(s == Statut.INTERROMPUE for s in statuts):
            return Statut.INTERROMPUE
        return Statut.ECHOUEE

    @property
    def cout_usd(self) -> float:
        return round(sum(e.cout_usd for e in self.emplacements), 6)

    @property
    def reussies(self) -> int:
        return sum(1 for e in self.emplacements if e.statut == Statut.REUSSIE)

    def emplacement(self, rang: int) -> Emplacement | None:
        for e in self.emplacements:
            if e.rang == rang:
                return e
        return None

    # ── Sérialisation ────────────────────────────────────────────────────────

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "modele": self.modele,
            "demande": self.demande,
            "parametres_resolus": self.parametres_resolus,
            "ecartees": self.ecartees,
            "emplacements": [e.en_json() for e in self.emplacements],
            "cree_le": self.cree_le,
            "projet": self.projet,
            # déduits — présents pour l'interface, jamais relus
            "statut": self.statut.value,
            "cout_usd": self.cout_usd,
            "reussies": self.reussies,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Generation":
        return Generation(
            identifiant=d["identifiant"],
            modele=d["modele"],
            demande=d.get("demande", {}),
            parametres_resolus=d.get("parametres_resolus", {}),
            ecartees=list(d.get("ecartees", [])),
            emplacements=[Emplacement.depuis_json(e) for e in d.get("emplacements", [])],
            cree_le=d.get("cree_le", 0.0),
            projet=d.get("projet"),
        )
