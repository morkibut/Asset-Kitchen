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

from atelier.domaine.pliage import Pliage


class Statut(str, Enum):
    EN_ATTENTE = "en_attente"
    EN_COURS = "en_cours"
    REUSSIE = "reussie"
    ECHOUEE = "echouee"
    INTERROMPUE = "interrompue"

    @property
    def terminee(self) -> bool:
        return self in (Statut.REUSSIE, Statut.ECHOUEE, Statut.INTERROMPUE)


# ── Les rôles d'une réinjection ──────────────────────────────────────────────
#
# « Un asset se réinjecte dans le générateur dans ses quatre rôles : référence,
# source d'édition, guide de style, jeu de réglages » (US-12). Trois d'entre eux
# envoient une image, et sont ici ; le quatrième — **jeu de réglages** — n'envoie
# rien : il repeuple le générateur avec les paramètres d'une génération passée,
# et ne laisse donc aucune trace dans celle qui part.
#
# **Deux de ces trois rôles partent par le même tuyau**, parce que le contrat du
# fournisseur n'a qu'un seul champ d'images d'entrée. Ce qui les distingue est
# donc écrit ici, et nulle part chez l'adaptateur :
#
# - `edition` **engendre** — c'est l'image qu'on retouche, et c'est elle qui
#   donne sa filiation à ce qui sort (US-38). Une seule par appel : on n'édite
#   pas deux images à la fois.
# - `reference` et `style` **inspirent**, et ne créent aucune descendance.
#   Ils sont indiscernables sur le fil, et leur différence est enregistrée
#   quand même : c'est elle que T4 relira quand l'univers enverra ses artworks
#   officiels tout seul, et elle qu'un journal doit pouvoir montrer.
REFERENCE = "reference"
EDITION = "edition"
STYLE = "style"
ROLES = (REFERENCE, EDITION, STYLE)

# **D'où viennent les octets** — la deuxième famille d'images du produit est
# arrivée en T4. Un asset vient de la bibliothèque et se relit par son
# emplacement ; une carte vient du tableau d'inspiration de son projet et se
# relit dans son dossier. Les deux partent par le même tuyau et comptent
# pareil dans le plafond du modèle ; seule la relecture diffère.
ASSET = "asset"
CARTE = "carte"
ORIGINES = (ASSET, CARTE)

# ── Qui a demandé l'appel ───────────────────────────────────────────────────
#
# Deux valeurs, et la liste est close : le produit compte exactement deux
# commanditaires, l'auteur devant son écran et l'agent qui code le jeu. Une
# troisième — « import », « reprise » — dirait *comment* l'image est arrivée,
# ce que la filiation dit déjà mieux.
AUTEUR = "auteur"
AGENT = "agent"
PROVENANCES = (AUTEUR, AGENT)


@dataclass(frozen=True, slots=True)
class Reinjection:
    """Une image renvoyée au fournisseur, à quel titre et d'où elle vient.

    **Un identifiant, jamais des octets.** Un `generation.json` doit rester
    lisible à l'œil, et une seconde copie de l'image serait une copie que plus
    rien ne met à jour. Les octets se relisent au moment de l'appel — et de la
    relance, qui suit exactement le même chemin.

    C'est aussi ce qui rend une génération **relisable des mois après** : le
    `generation.json` dit quels artworks officiels sont partis ce jour-là, même
    si l'univers a changé depuis. Enregistrer « quatre références » sans dire
    lesquelles rendrait la moitié du journal illisible.
    """

    asset: str
    role: str = REFERENCE
    origine: str = ASSET

    def en_json(self) -> dict[str, Any]:
        return {"asset": self.asset, "role": self.role, "origine": self.origine}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Reinjection":
        return Reinjection(
            asset=d["asset"],
            role=d.get("role", REFERENCE),
            # Une génération écrite avant T4 ne porte que des assets, et c'est
            # vrai sans rien aller vérifier : les cartes n'existaient pas.
            origine=d.get("origine", ASSET),
        )


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
    projet: str | None = None  # le projet courant au moment de la soumission

    # Ce qu'on a réinjecté, et à quel titre — voir `Reinjection` ci-dessus.
    references: tuple[Reinjection, ...] = ()

    # ── Qui a demandé cet appel ──────────────────────────────────────────────
    #
    # « Distinguer d'un coup d'œil ce que l'agent a produit de ce que j'ai
    # produit moi-même, afin de savoir à qui parler quand quelque chose me
    # surprend » (US-39). Deux valeurs et pas une de plus : `auteur` — le
    # défaut, donc tout ce qui existait avant T7 — et `agent`.
    #
    # **C'est un fait sur l'appel, pas sur l'image.** Il se pose ici, à la
    # soumission, et l'asset en hérite à sa naissance : une image ne change pas
    # de commanditaire quand on la retouche, et une découpe appartient à qui a
    # demandé la planche.
    provenance: str = AUTEUR

    # ── Pour qui, et pour quelle case ────────────────────────────────────────
    #
    # Arrivés en C1 (US-120). L'appel part d'une case vide de la matrice, et
    # l'image qui en revient sait où elle tombe — elle en hérite à sa naissance,
    # comme elle hérite du projet et de la provenance. Une génération ordinaire
    # ne vise aucune case, et c'est le cas courant.
    #
    # **Ils sont ici et pas dans `demande`** parce qu'ils ne partent pas chez le
    # fournisseur : ce sont des faits sur l'appel, du même genre que le projet
    # qui recevra ce qui en sort. `demande` porte ce qui s'écrit dans le prompt.
    personnage: str | None = None
    pose: str | None = None

    # ── Le pliage — N images demandées en un seul appel ───────────────────────
    #
    # Arrivé en C2 (US-128). **Ici et pas dans `demande`**, pour la raison de
    # `personnage` et `pose` : c'est un fait sur l'appel, pas du texte qui part
    # chez le fournisseur. Les consignes de grille, elles, sont repliées dans le
    # prompt à la soumission, comme la bible de T4 — `generation.json` porte
    # donc le prompt tel qu'il est parti.
    #
    # `pose` reste renseignée quand le lot n'a qu'une case ; un lot en a
    # plusieurs, et ce sont les cases du pliage qui disent où va chacune. Les
    # deux ne se contredisent jamais parce qu'un lot ne remplit pas `pose` :
    # l'asset lit la case, pas la génération.
    pliage: Pliage | None = None

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
    def parent(self) -> str | None:
        """De quoi descend ce que cette génération produit (US-38).

        Déduit, jamais enregistré deux fois : c'est la réinjection marquée
        `edition`. Une référence inspire, une source d'édition engendre — et
        cette phrase-là est toute la règle de filiation de la tranche. T5 y
        ajoutera celle de la découpe.

        **Un artwork n'engendre jamais**, et l'origine le dit plutôt que le rôle
        seul : une carte du tableau n'est pas dans la bibliothèque, donc une
        filiation qui la nommerait pointerait vers un asset qui n'existe pas.
        Les artworks partent en `style`, jamais en `edition` — mais le filet est
        ici, où la filiation se décide.
        """
        for reinjection in self.references:
            if reinjection.role == EDITION and reinjection.origine == ASSET:
                return reinjection.asset
        return None

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
            "personnage": self.personnage,
            "pose": self.pose,
            "pliage": self.pliage.en_json() if self.pliage else None,
            "demande": self.demande,
            "parametres_resolus": self.parametres_resolus,
            "ecartees": self.ecartees,
            "emplacements": [e.en_json() for e in self.emplacements],
            "cree_le": self.cree_le,
            "projet": self.projet,
            "references": [r.en_json() for r in self.references],
            "provenance": self.provenance,
            # déduits — présents pour l'interface, jamais relus
            "statut": self.statut.value,
            "cout_usd": self.cout_usd,
            "reussies": self.reussies,
            "parent": self.parent,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Generation":
        return Generation(
            identifiant=d["identifiant"],
            modele=d["modele"],
            personnage=d.get("personnage"),
            pose=d.get("pose"),
            pliage=Pliage.depuis_json(d.get("pliage")),
            demande=d.get("demande", {}),
            parametres_resolus=d.get("parametres_resolus", {}),
            ecartees=list(d.get("ecartees", [])),
            emplacements=[Emplacement.depuis_json(e) for e in d.get("emplacements", [])],
            cree_le=d.get("cree_le", 0.0),
            projet=d.get("projet"),
            references=tuple(
                Reinjection.depuis_json(r) for r in d.get("references", ())
            ),
            # Tout ce qui a été écrit avant T7 est de l'auteur, et le défaut le
            # dit sans qu'aucun rattrapage n'ait à passer sur le disque.
            provenance=d.get("provenance", AUTEUR),
        )
