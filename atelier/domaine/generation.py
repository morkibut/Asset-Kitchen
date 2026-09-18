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

from atelier.domaine.animation import Clip
from atelier.domaine.consommation import USD, argent
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
# ⚠️ **Le quatrième se désigne par une image, jamais par un nom** (`RP18`,
# 16 septembre 2026). *Reprendre les réglages*, sur la fiche d'une image de la
# bibliothèque, relit la génération qui l'a fabriquée et repose ses paramètres.
# Les jeux de réglages nommés, qui promettaient la même chose sous un nom, sont
# partis : ils n'ont jamais eu d'écran.
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

# **Deux images partent qui ne sont pas des réinjections** — le gabarit de la
# grille et la bande de couleurs du jeu. Elles ne viennent pas de la
# bibliothèque : le produit les **redessine** à chaque appel, et elles ne
# s'enregistrent donc pas comme références. Elles occupent quand même une place
# dans le plafond du modèle, et elles coûtent chez ceux qui facturent au token.
#
# **Elles n'avaient pas de nom jusqu'à R7**, et c'est précisément ce qui les
# rendait dangereuses : le modèle recevait une grille vide sans qu'une ligne
# dise que c'en était une, et *ce qu'on montre à un modèle, il le copie en
# entier*. Nommer une image demande de pouvoir la nommer ; ces deux constantes
# sont ce qui manquait. Elles ne rejoignent pas `ROLES`, qui est la liste close
# de ce qu'une `Reinjection` peut porter.
#
# **Le gabarit a deux formes, et elles ne se nomment pas pareil** (C2 contre
# C3) : une grille *vide* où le modèle fera naître N sujets, ou la planche
# *pleine* qu'on lui redonne pour qu'il y ajoute une pièce. La confondre
# reviendrait à dire « dessine un sujet par case » devant une planche déjà
# dessinée, ce qui est le défaut le plus cher de C3.
GABARIT = "gabarit"
PLANCHE_JOINTE = "planche"
PALETTE = "palette"
ROLES_JOINTS = (STYLE, REFERENCE, EDITION, GABARIT, PLANCHE_JOINTE, PALETTE)

# **Deux façons de nommer une référence promue, selon ce qu'elle montre** (RS1).
# Ce ne sont pas des rôles de `Reinjection` — sur le fil, une planche du sujet
# et une vue dans une direction restent des `reference`, qui inspirent sans
# engendrer — mais des rôles **à nommer** : `_roles_qui_partent` les écrit à
# partir de l'usage, et le texte les décrit autrement qu'une référence libre.
# Une planche décrite comme « le même personnage » a rendu un seul Champy
# isométrique le 18 septembre 2026 ; c'est ce que ces deux mots réparent.
#
# La vue d'une direction porte son identifiant après les deux-points —
# `reference-direction:sud` —, parce que le texte la nomme.
REFERENCE_PLANCHE = "reference-planche"
REFERENCE_DIRECTION = "reference-direction"

# **La planche à reproduire** (RS2) — troisième rôle à nommer, et le seul qui
# ne décrive pas seulement l'identité : quand l'appel garde la mise en page,
# une image jointe (la planche du sujet, sinon la première jointe à la main)
# donne aussi le nombre de vues, leur ordre et leur cadrage. Sur le fil elle
# garde son rôle — `reference`, ou `edition` si l'auteur l'a jointe ainsi.
REFERENCE_MISE_EN_PAGE = "reference-mise-en-page"

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
    # **L'usage d'une référence promue, quand elle en a un** (RS1) — `planche`
    # ou `direction:<id>`. Vide pour tout le reste, y compris une promue
    # `libre` : c'est ce qui laisse identique, octet pour octet, tout ce qui
    # partait avant la tranche. Il dit au texte comment nommer l'image, et au
    # journal pourquoi elle est partie.
    usage: str = ""

    def en_json(self) -> dict[str, Any]:
        brut = {"asset": self.asset, "role": self.role, "origine": self.origine}
        # Écrit seulement quand il existe : un `generation.json` d'aujourd'hui
        # reste celui d'hier tant que rien n'est rangé.
        if self.usage:
            brut["usage"] = self.usage
        return brut

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Reinjection":
        return Reinjection(
            asset=d["asset"],
            role=d.get("role", REFERENCE),
            # Une génération écrite avant T4 ne porte que des assets, et c'est
            # vrai sans rien aller vérifier : les cartes n'existaient pas.
            origine=d.get("origine", ASSET),
            usage=str(d.get("usage") or ""),
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
    `docs/design-motifs.md` § L'emplacement. L'échec atterrit à l'endroit précis où le
    succès serait arrivé : c'est pour ça que l'emplacement existe avant l'image.
    """

    rang: int
    statut: Statut = Statut.EN_ATTENTE

    # ── Ce que cet appel-là a consommé, et en quoi ───────────────────────────
    #
    # **Deux champs et un seul fait** (F2). Jusqu'à la V2.2 il n'y avait qu'un
    # `cout_usd` : il n'y avait qu'un fournisseur, et il facturait en dollars.
    # Depuis qu'un fournisseur consomme des jetons, une quantité seule ne veut
    # plus rien dire — un `1.0` qui ne dit pas s'il est un dollar ou un jeton
    # est très exactement le défaut que cette tranche ferme.
    #
    # **Y compris quand l'appel échoue** : un refus qui a atteint le modèle a
    # consommé, et c'est ce chiffre-là qu'on cherchera à expliquer (US-24).
    consomme: float = 0.0
    unite: str = USD

    duree_s: float = 0.0
    resultat: Resultat | None = None
    raison: str | None = None
    # Une exception avant réception ne prouve pas que le fournisseur a refusé.
    # Absent des anciens fichiers, et jamais déduit du texte d'une erreur.
    acceptation_inconnue: bool = False

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

    @property
    def cout_usd(self) -> float:
        """La part de cette consommation qui est de l'argent. **Déduite** (F2).

        *Un total en argent ne compte que de l'argent* — invariant de la V2.2 —
        est tenu ici par construction : un emplacement qui a consommé un jeton
        vaut zéro dollar partout où une somme de dollars se calcule, sans qu'un
        seul de ces endroits ait eu à apprendre qu'il existe d'autres unités.
        """
        return argent(self.consomme, self.unite)

    def en_json(self) -> dict[str, Any]:
        return {
            "rang": self.rang,
            "statut": self.statut.value,
            "consomme": self.consomme,
            "unite": self.unite,
            # Déduit, écrit quand même : la base l'interroge, et un écran
            # d'avant la V2.2 le lit tel quel. Jamais relu — voir `depuis_json`.
            "cout_usd": self.cout_usd,
            "duree_s": self.duree_s,
            "resultat": self.resultat.en_json() if self.resultat else None,
            "raison": self.raison,
            "demarre_le": self.demarre_le,
            "duree_attendue_s": self.duree_attendue_s,
            **({"acceptation_inconnue": True} if self.acceptation_inconnue else {}),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Emplacement":
        brut = d.get("resultat")
        return Emplacement(
            rang=d["rang"],
            statut=Statut(d["statut"]),
            # **Une dépense d'avant la V2.2 se relit sans rien perdre**, et
            # c'est un critère de F2 : elle n'a pas d'unité, elle est en
            # dollars, et sa quantité est le montant qu'elle portait. Aucune
            # ligne du disque n'a été réécrite pour ça.
            consomme=d.get("consomme", d.get("cout_usd", 0.0)),
            unite=d.get("unite", USD),
            duree_s=d.get("duree_s", 0.0),
            resultat=Resultat.depuis_json(brut) if brut else None,
            raison=d.get("raison"),
            demarre_le=d.get("demarre_le"),
            duree_attendue_s=d.get("duree_attendue_s", 0.0),
            acceptation_inconnue=bool(d.get("acceptation_inconnue", False)),
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

    # **Et sous quel angle** (E10). Même règle, même instant : l'image qui en
    # reviendra tombe dans la case *et* dans la direction sans que personne ait
    # à l'y ranger, et une relance de cet appel-là visera toujours la même. Vide
    # pour un jeu qui n'a pas déclaré de directions — le mot ne paraît alors
    # nulle part dans le produit.
    direction: str | None = None

    # ── Et de quelle pièce, quand l'appel habille ────────────────────────────
    #
    # Arrivée en C3 (US-140). **C'est elle, et elle seule, qui dit qu'un appel
    # est une planche d'équipement** : sans elle, une planche pliée crée des
    # corps ; avec elle, elle en habille. Le service de génération n'a donc pas
    # à deviner ce qui doit revenir — il lit un champ.
    #
    # Ici et pas dans `demande`, pour la raison de `personnage` et `pose` : c'est
    # un fait sur l'appel. La **description** de la pièce, elle, part bien chez
    # le fournisseur — c'est le sujet du prompt, écrit par l'auteur.
    piece: str | None = None

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

    # ── Le clip — quand l'appel demande une vidéo, pas une image ─────────────
    #
    # Arrivé en A9 (V3). **C'est lui, et lui seul, qui dit qu'un appel est un
    # appel vidéo**, exactement comme `piece` dit qu'une planche habille et
    # `pliage` qu'elle porte plusieurs cases. Rien ne se devine du nom du modèle
    # ni du type du fichier reçu : on lit un champ.
    #
    # **Ici et pas dans `demande`**, pour la raison de `personnage` et `pose` :
    # c'est un fait sur l'appel. Le numéro du travail, surtout, n'est pas une
    # préférence de l'auteur — c'est ce qui permet d'aller rechercher un clip
    # déjà payé au lieu d'en repayer un, quand l'atelier a fermé pendant les
    # deux minutes d'attente.
    clip: Clip | None = None

    # ── Ce qui a été pris de l'ambiance, et par cet appel-là ──────────────────
    #
    # Arrivés en E14 (`docs/ARCHITECTURE.md` §5). Une ambiance est un lot de
    # style désigné sur une chose du jeu ; **ce qu'on lui prend se décide au
    # moment de fabriquer**, pas une fois pour toutes — tout, les couleurs
    # seules, tout sauf les images. La chose porte le réglage durable ; ces deux
    # champs-ci portent ce que *cet appel* a réellement pris.
    #
    # **Sans eux, « ce qui est montré est ce qui part » cesserait d'être vrai en
    # relisant une vieille image.** Le réglage durable aura changé, l'ambiance
    # aura été retouchée, et rien ne dirait plus si le monde qu'on lit dans le
    # prompt venait du jeu ou du lot de style — ni si la bande de couleurs est
    # partie. Le prompt enregistré porte le texte ; il ne porte pas d'où chaque
    # morceau venait.
    #
    # **Ils ne sont pas dérivables du réglage durable**, et c'est ce qui leur vaut
    # d'exister : l'écran de confirmation éteint ligne par ligne, donc un appel
    # peut avoir pris le monde sans l'éclairage, ce qu'aucun des trois modes ne
    # décrit.
    ambiance: str | None = None
    # Parmi « couleurs », « references », « textes ». Vide quand aucune ambiance
    # n'était désignée — et vide aussi quand tout a été éteint, ce qui est la
    # même chose du point de vue de l'image produite.
    pris: tuple[str, ...] = ()

    # ── Ce que le plafond du modèle a laissé au sol ──────────────────────────
    #
    # Arrivé en F6 (US-333). **Ce que le produit ajoute de lui-même cède devant
    # le plafond du modèle ; ce que l'auteur a joint ne cède jamais.** Un modèle
    # gratuit n'accepte aucune image d'entrée : sans cette règle, un jeu qui a
    # un seul artwork officiel rendrait le brouillon gratuit inutilisable, et le
    # garde-fou de l'agent serait éteint le jour même.
    #
    # **Ce champ est le prix de cette règle.** À multiplier les brouillons, on
    # se retrouve avec des images qui ne ressemblent pas aux autres *sans savoir
    # pourquoi* ; la fiche le dit, une fois pour toutes. Sans lui, l'absence
    # d'une référence et le fait qu'elle ait été écartée se liraient pareil.
    #
    # Le nom vient de l'écran de confirmation, qui appelle déjà `hors_plafond`
    # les lignes qu'un modèle ne peut pas prendre. Un seul mot pour une seule
    # chose, des deux côtés du port.
    #
    # À ne pas confondre avec `ecartees` ci-dessus, qui parle de **réglages** que
    # le modèle ne déclare pas — un autre plafond, un autre objet.
    hors_plafond: tuple[Reinjection, ...] = ()

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
    def unite(self) -> str:
        """L'unité de cet appel-là. **Une génération, un modèle, un fournisseur.**

        Donc une seule unité, et il n'y a jamais à en mélanger deux : la
        question « et si un lot avait consommé des dollars et des jetons ? » ne
        se pose pas, parce qu'un lot part chez un seul modèle. Le premier
        emplacement qui porte quelque chose dit laquelle ; à défaut, l'argent,
        qui est ce qu'était tout le produit avant la V2.2.
        """
        for emplacement in self.emplacements:
            if emplacement.consomme:
                return emplacement.unite
        return self.emplacements[0].unite if self.emplacements else USD

    @property
    def consomme(self) -> float:
        """Ce que l'appel entier a consommé, dans l'unité ci-dessus (F2)."""
        return round(sum(e.consomme for e in self.emplacements), 6)

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
            "direction": self.direction,
            "piece": self.piece,
            "ambiance": self.ambiance,
            "pris": list(self.pris),
            "pliage": self.pliage.en_json() if self.pliage else None,
            "clip": self.clip.en_json() if self.clip else None,
            "demande": self.demande,
            "parametres_resolus": self.parametres_resolus,
            "ecartees": self.ecartees,
            "emplacements": [e.en_json() for e in self.emplacements],
            "cree_le": self.cree_le,
            "projet": self.projet,
            "references": [r.en_json() for r in self.references],
            "hors_plafond": [r.en_json() for r in self.hors_plafond],
            "provenance": self.provenance,
            # déduits — présents pour l'interface, jamais relus
            "statut": self.statut.value,
            "cout_usd": self.cout_usd,
            "consomme": self.consomme,
            "unite": self.unite,
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
            direction=d.get("direction"),
            piece=d.get("piece"),
            # Vides pour tout ce qui a été écrit avant E14, et c'est la vérité :
            # aucune ambiance n'agissait sur un appel avant elle.
            ambiance=d.get("ambiance"),
            pris=tuple(str(p) for p in (d.get("pris") or ())),
            # Vide pour tout ce qui a été écrit avant F6, et c'est la vérité :
            # rien n'était alors écarté par le plafond d'un modèle — l'appel
            # était refusé tout entier.
            hors_plafond=tuple(
                Reinjection.depuis_json(r) for r in (d.get("hors_plafond") or ())
            ),
            pliage=Pliage.depuis_json(d.get("pliage")),
            # `None` pour tout ce qui a été écrit avant A9, et c'est la
            # vérité : aucun appel du produit ne demandait de vidéo.
            clip=Clip.depuis_json(d.get("clip")),
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
