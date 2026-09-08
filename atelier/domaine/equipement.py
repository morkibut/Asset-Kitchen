# -*- coding: utf-8 -*-
"""L'équipement — où une pièce se pose, ce qu'elle est, et ce qu'on mesure d'elle.

C3. Trois objets, et aucun n'est une image : l'**emplacement** est un endroit du
corps que le projet nomme une fois — la tête, le dos, les jambes —, la **pièce**
est ce qui s'y pose, décrite une fois et posable sur n'importe quel personnage
(US-136, US-137), et les **mesures** disent ce qui a bougé quand elle est
arrivée.

**Ils appartiennent au projet, comme le plan de poses** — et pour la même raison
qu'il n'est pas dans `Univers` : cet objet-là est « ce que le projet impose à ce
qui rentre, et ce qu'il envoie avec », et un vestiaire n'impose rien à une image
importée.

**La portée est déclarée, jamais devinée** (US-139). Une pièce tient dans la
silhouette ou elle l'agrandit, et c'est l'auteur qui le dit : de cette phrase
dépend si l'atelier peut fabriquer un calque ou seulement un corps habillé.
`essais/essai_silhouette.py`, six modèles et deux jets, a mesuré la raison —
jambières 0,3 % de corps repeint, casque 0,8 %, cape **23,5 %** avec un dézoom à
0,62. Aucune détection automatique n'est prévue : `docs/archi-versions.md` §7 la
range dans « ce que la V2 n'est pas ».

**Un mot pour deux choses, et il faut le savoir.** `atelier/domaine/generation.py`
porte déjà un `Emplacement` : celui-là est la place d'une variation dans un
appel. Celui-ci est une place sur un corps. Ils ne se rencontrent nulle part —
ce module n'est **pas** re-exporté par `atelier/domaine/__init__.py`, et le
service qui touche aux deux ne nomme jamais le type de l'autre.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

__all__ = [
    "AGRANDIT",
    "A_PART",
    "CONTENUE",
    "ECHELLE_TOLEREE",
    "EMPLACEMENTS_PROPOSES",
    "Emplacement",
    "Emploi",
    "GENRES",
    "MISE_EN_SCENE",
    "MesuresCalque",
    "PORTE",
    "PORTEES",
    "Piece",
    "emplacements_depuis_json",
    "emplois_depuis_json",
    "pieces_depuis_json",
]


# ── La portée d'une pièce ────────────────────────────────────────────────────
#
# Deux valeurs, et la liste est close. Elle décide de ce que l'atelier peut
# fabriquer, pas de ce qu'il envoie : les deux partent par le même appel, sur la
# même grille, avec la même consigne. Ce qui change est la place laissée au
# sujet dans sa case, et ce qu'on fait de ce qui revient.
CONTENUE = "contenue"
AGRANDIT = "agrandit"
PORTEES = (CONTENUE, AGRANDIT)


# ── Ce qui décide qu'un calque n'en est plus un ──────────────────────────────
#
# Au-delà de cet écart, le sujet n'est pas revenu à la taille où il est parti.
# **Ce n'est pas un refus, c'est un aiguillage** (US-148) : le compte d'images
# reste le seul refus automatique du produit, l'appel payé est acquis, et ce qui
# revient est gardé — comme des corps habillés au lieu de calques.
#
# Le nombre vient des trois mesures du 28 août 2026 et de rien d'autre :
# jambières 1,00, casque 0,96, cape 0,62. À 0,08 la fourchette accepte
# confortablement les deux qui marchent et rejette celle qui ne marche pas, sans
# qu'aucune valeur intermédiaire n'ait jamais été observée entre les deux.
#
# **Il vit ici depuis C4, et non plus dans `atelier/image/calque.py`** : c'est un
# verdict du produit — calque ou corps habillé —, pas un réglage d'algorithme, et
# le classement d'US-152 le lit pour ramener une dérive d'échelle sur la même
# échelle que les trois autres mesures. Une seule définition, deux lecteurs.
ECHELLE_TOLEREE = 0.08


@dataclass(frozen=True, slots=True)
class Emplacement:
    """Un endroit du corps, et son rang dans l'ordre où l'auteur les pense.

    **Ordonné, jamais trié** (US-136) : la tête vient avant les jambes parce que
    c'est ainsi qu'on habille quelqu'un, pas parce que « j » suit « t ». Le rang
    est celui de la colonne dans la matrice, et c'est tout ce qu'il fait.

    L'identifiant se dérive du nom comme celui d'une pose, et pour la même
    raison : renommer « tête » en « couvre-chef » ne doit rien orpheliner.
    """

    identifiant: str
    nom: str
    rang: int = 0

    def en_json(self) -> dict[str, Any]:
        return {"identifiant": self.identifiant, "nom": self.nom, "rang": self.rang}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Emplacement":
        identifiant = str(d.get("identifiant") or "")
        return Emplacement(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            rang=int(d.get("rang", 0) or 0),
        )


# ── Les trois genres d'emploi, et la liste est close (B19) ───────────────────
#
# Un **emploi** est une façon dont une pièce sert. La planche `Emplois.dc.html`
# en montre six pour une seule épée : portée par trois personnages, posée au
# sol, plantée dans un rocher, et son icône d'inventaire. Trois genres suffisent
# à les tenir toutes, et le bouton de la planche les nomme lui-même — *porté par
# quelqu'un · une image à part · une mise en scène*.
#
# **Un seul des trois fabrique quelque chose**, et c'est `PORTE`. Les deux
# autres se déclarent, se lisent et se comptent ; ils ne partent pas chez le
# fournisseur, parce qu'une pièce n'a pas d'image à elle et que le produit
# interdit d'en générer une sur fond vide (`docs/archi-versions.md` §7). Les
# poser dans la liste close coûte trois constantes ; les fabriquer serait une
# seconde chaîne de production, et ce n'est pas ce que cette tranche livre.
PORTE = "porte"
A_PART = "a-part"
MISE_EN_SCENE = "mise-en-scene"
GENRES = (PORTE, A_PART, MISE_EN_SCENE)


@dataclass(frozen=True, slots=True)
class Emploi:
    """Une façon dont une pièce sert — **c'est le lien qui manquait** (B19).

    Avant cette tranche, une pièce n'appartenait à personne : elle était décrite
    une fois pour le jeu et se posait sur n'importe quel corps. Rien ne
    permettait de dire le contraire, et c'est ce qui rendait l'écran Équipement
    illisible — il n'avait personne à qui rattacher ce qu'il montrait.

    **Le porteur est un personnage, pas une pièce du corps.** L'emplacement, lui,
    reste au jeu (`Projet.emplacements`) et ne bouge pas d'un mot : un emploi le
    *cite*, il ne le possède pas. Un emploi qui n'en cite aucun retombe sur celui
    de la pièce — c'est le cas courant, et l'écrire deux fois aurait fait deux
    vérités sur la même question.

    **Un personnage ne porte une pièce qu'une fois**, et le service le tient. La
    raison n'est pas esthétique : les calques déjà sur le disque sont rangés par
    *(pièce, personnage, pose)* et par rien d'autre (`atelier/depot/base.py:86`).
    Deux emplois portés par le même personnage se partageraient les mêmes images
    sans qu'aucune règle puisse dire laquelle va où.

    `devant` dit si la pièce passe devant le corps ou derrière lui, et il est
    **déclaré, pas déduit** — la planche le montre par emploi (« les mains ·
    devant le corps », « le dos · derrière le corps »), et le déduire du rang de
    l'emplacement aurait demandé qu'un emplacement s'appelle « le corps ». Aucun
    des deux jeux réels de ce dépôt n'en a un.
    """

    identifiant: str
    genre: str = PORTE

    # Le personnage qui porte. **Vide sauf pour `PORTE`** — une pièce posée au
    # sol ne porte personne, et lui donner un porteur vide n'est pas un manque.
    porteur: str = ""

    # Le libellé de l'auteur. Vide, l'écran le compose du genre et du porteur —
    # *Portée par Le goliath* n'a pas à être tapé pour exister.
    nom: str = ""

    # **Vide veut dire « celui de la pièce »**, jamais « aucun ». Un emploi qui
    # range l'épée dans le dos quand la pièce la range aux mains le dit ici, et
    # lui seul.
    emplacement: str = ""

    devant: bool = True

    # Ce que l'auteur ajoute pour cet emploi-là seulement — *plantée dans un
    # rocher*. Elle ne remplace pas la description de la pièce, elle s'y ajoute.
    description: str = ""

    @property
    def porte(self) -> bool:
        return self.genre == PORTE

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "genre": self.genre,
            "porteur": self.porteur,
            "nom": self.nom,
            "emplacement": self.emplacement,
            "devant": self.devant,
            "description": self.description,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Emploi":
        identifiant = str(d.get("identifiant") or "")
        genre = str(d.get("genre") or PORTE)
        return Emploi(
            identifiant=identifiant,
            # Un genre inconnu retombe sur le défaut : la liste est close, et un
            # fichier abîmé ne la rouvre pas. Même règle que la portée.
            genre=genre if genre in GENRES else PORTE,
            porteur=str(d.get("porteur") or ""),
            nom=str(d.get("nom") or ""),
            emplacement=str(d.get("emplacement") or ""),
            devant=bool(d.get("devant", True)),
            description=str(d.get("description") or ""),
        )


def emploi_porte(porteur: str) -> Emploi:
    """L'emploi qu'un personnage a sur une pièce — **son identifiant est dérivé**.

    Un personnage ne porte une pièce qu'une fois : l'identifiant se calcule donc
    plutôt que de se tirer au sort, et c'est ce qui fait que l'emploi *lu sur les
    calques* et l'emploi *déclaré* portent le même nom. Sans quoi déclarer une
    pièce d'avant B19 aurait renommé ses emplois sous les yeux de l'écran qui
    venait de les afficher.
    """
    return Emploi(identifiant=f"{PORTE}-{porteur}", genre=PORTE, porteur=porteur)


def emplois_resolus(
    piece: Piece, porteurs_deduits: Iterable[str]
) -> tuple[Emploi, ...]:
    """Les emplois d'une pièce — **déclarés, ou lus sur ses calques**.

    **La règle est écrite ici, une seule fois**, parce que deux services la
    posent : celui de l'équipement, qui la sert aux écrans, et celui de la
    production, qui s'en sert pour ne plus montrer à un personnage l'équipement
    du jeu entier. Deux copies auraient fini par répondre deux choses de la même
    pièce, et c'est très exactement le genre d'écart que ce dépôt paie cher.

    Une pièce qui n'a jamais rien déclaré n'est pas une pièce que personne ne
    porte : c'est une pièce dont on ne sait rien, et le disque, lui, sait — un
    calque porte sa pièce et son personnage depuis C3. Une pièce déclarée, même
    vide, ne consulte plus rien : sinon le porteur qu'on vient de retirer
    reparaîtrait à la relecture suivante, ses images étant toujours là.
    """
    if piece.emplois is not None:
        return piece.emplois
    return tuple(emploi_porte(p) for p in porteurs_deduits)


def emplois_depuis_json(brut: Any) -> tuple[Emploi, ...]:
    """Les emplois d'une pièce, dans l'ordre où ils ont été écrits.

    Même dédoublonnage que partout ailleurs — le premier gagne —, et une entrée
    sans identifiant est sautée plutôt que de faire tomber la lecture d'un jeu
    entier pour une ligne abîmée.
    """
    return tuple(
        _sans_doublon(
            Emploi.depuis_json(e)
            for e in _lisible(brut)
            if isinstance(e, dict) and e.get("identifiant")
        )
    )


@dataclass(slots=True)
class Piece:
    """Ce qui se pose sur un emplacement — décrite **une fois** (US-137).

    Sa description part dans le prompt de la planche d'équipement, exactement
    comme celle d'un personnage part avec chaque génération de pose : on ne
    réécrit pas « un casque de fer à cornes » à chaque pose qu'on habille.

    **Elle ne porte aucune image, et il n'existe pas d'image d'elle seule.** Une
    pièce n'apparaît que sur un corps (`docs/archi-versions.md` §7, « ce que la V2
    n'est pas ») : il n'y a donc ni prompt de pièce, ni écran qui en génère une
    sur fond vide. Ce qu'elle désigne, ce sont des cartes du tableau — comme un
    personnage, et par le même mécanisme.
    """

    identifiant: str
    nom: str
    description: str = ""

    # L'emplacement qu'elle occupe. Vide tant que l'auteur n'a rien dit : une
    # pièce sans emplacement est une pièce qu'on vient de nommer, pas une
    # erreur, et la matrice a une colonne pour ça.
    emplacement: str = ""

    # **Contenue, par défaut** (US-139). Le défaut est celui qui marche : c'est
    # la portée des cinq pièces sur six que l'essai du 28 août a mesurées
    # propres, et la seule qui fabrique un calque à coup sûr.
    portee: str = CONTENUE

    # Les cartes du tableau désignées comme concept art (US-124), exactement
    # comme sur un personnage : elles restent où elles sont, et la carte ne sait
    # pas qui la désigne.
    concept_arts: tuple[str, ...] = ()

    # ── Ses emplois, et l'absence n'est pas le vide (B19) ────────────────────
    #
    # **`None` et `()` ne disent pas la même chose, et c'est la décision de la
    # tranche.** Le dépôt l'a déjà tranchée une fois, pour le plan de poses
    # (`atelier/domaine/plan.py`, `plan_depuis_json`), et la réponse est reprise
    # ici mot pour mot :
    #
    # - `None` — *jamais déclaré*. C'est l'état de toutes les pièces écrites
    #   avant cette tranche : leur fichier n'a pas la clé. On ne sait pas qui les
    #   porte, et **on ne l'invente pas** ; c'est le service qui va le lire sur
    #   les calques déjà là, sans rien écrire derrière l'auteur.
    # - `()` — *déclaré, et vide*. L'auteur a retiré le dernier porteur, ou la
    #   pièce est née après la tranche sans en recevoir. Elle ne porte personne,
    #   et aucune déduction ne doit la repeupler : ce serait faire ressusciter à
    #   chaque relecture très exactement ce qu'il vient de retirer.
    #
    # C'est cette différence-là, et elle seule, qui répond à « une pièce sans
    # porteur » contre « une pièce que personne ne porte ». `en_json` **omet la
    # clé** quand elle vaut `None` : un jeu d'avant B19 relu puis réécrit rend
    # les mêmes octets, sans une clé de plus.
    emplois: tuple["Emploi", ...] | None = None

    @property
    def agrandit(self) -> bool:
        return self.portee == AGRANDIT

    @property
    def declaree(self) -> bool:
        """L'auteur a-t-il déjà dit quelque chose des emplois de cette pièce ?"""
        return self.emplois is not None

    @property
    def porteurs(self) -> tuple[str, ...]:
        """Les personnages **déclarés** porteurs, dans l'ordre des emplois.

        Vide quand rien n'est déclaré — ce qui est le cas de toutes les pièces
        d'avant la tranche, et c'est le critère : *les pièces déjà écrites sur le
        disque se relisent sans perte et sans porteur*. Ce que le disque porte
        malgré tout se lit ailleurs, sur les calques, et par le service.
        """
        return tuple(
            e.porteur for e in (self.emplois or ()) if e.porte and e.porteur
        )

    def en_json(self) -> dict[str, Any]:
        rendu = {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "description": self.description,
            "emplacement": self.emplacement,
            "portee": self.portee,
            "concept_arts": list(self.concept_arts),
        }
        # **La clé n'apparaît que si elle a été déclarée** — voir le champ.
        if self.emplois is not None:
            rendu["emplois"] = [e.en_json() for e in self.emplois]
        return rendu

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Piece":
        identifiant = str(d.get("identifiant") or "")
        portee = str(d.get("portee") or CONTENUE)
        emplois = d.get("emplois")
        return Piece(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            description=str(d.get("description") or ""),
            emplacement=str(d.get("emplacement") or ""),
            # Une portée inconnue retombe sur le défaut : la liste est close, et
            # un fichier abîmé ne la rouvre pas. Même règle que les teintes.
            portee=portee if portee in PORTEES else CONTENUE,
            concept_arts=tuple(
                c for c in (d.get("concept_arts") or ()) if isinstance(c, str) and c
            ),
            # `is None` et non `or` : une liste vide est une déclaration, pas une
            # absence, et le motif `lu or DEFAUT` effacerait la différence.
            emplois=None if emplois is None else emplois_depuis_json(emplois),
        )


@dataclass(slots=True)
class MesuresCalque:
    """Ce qu'on a lu sur une case au moment où le calque est apparu (US-147).

    **Cinq nombres, et aucun ne refuse.** Le compte d'images reste le seul refus
    automatique du produit (`docs/archive/plan-versions-tenues.md`, C2, reconduit en C3) : celles-ci
    s'affichent, se comparent d'une case à l'autre, et laissent l'auteur juger.
    Une pièce qui repeint 4 % du corps est peut-être exactement ce qu'il
    voulait ; le produit n'en sait rien.

    **Une copie prise à la naissance**, comme `cout_usd`, `modele` et `lot` : la
    case de la matrice les porte, et aller chercher la génération pour cinq
    nombres serait un aller-retour par case affichée.

    Leur définition vient de `essais/essai_silhouette.py`, étalonné le 28 août
    2026 — c'est ce banc qui a décidé de la méthode, et recopier ses mesures
    ailleurs en aurait fait deux qui divergent.

    - `silhouette` — ce qui reste du corps de départ, au meilleur recalage. À
      99 %, le modèle a gardé la forme.
    - `repeint` — la part du corps commun dont la couleur a changé. **C'est la
      colonne qui décide** : une silhouette à 100 % avec 23 % de repeint veut
      dire que le modèle a gardé la forme et redessiné l'intérieur.
    - `ajout` — ce qui est apparu, en part du corps. L'empreinte de la pièce.
    - `echelle` — la taille du sujet au retour, rapportée à celle qui est
      partie. 1,00 : il n'a pas bougé. 0,62 : le modèle a dézoomé pour faire
      tenir la pièce, et il n'y a plus de différence à calculer.
    - `compacite` — la part de la différence qui tient dans sa plus grosse
      tache. Proche de 1 : un objet. Proche de 0 : une poussière semée sur tout
      le corps, c'est-à-dire un repeint déguisé.
    """

    silhouette: float = 0.0
    repeint: float = 0.0
    ajout: float = 0.0
    echelle: float = 1.0
    compacite: float = 1.0

    # ── Ce qui décide de l'ordre où l'on regarde (C4, US-152) ────────────────

    def defaveurs(self) -> tuple[tuple[str, float], ...]:
        """Les quatre mesures ramenées sur une même échelle — 0 va bien, 1 va mal.

        **Quatre, et pas cinq.** `ajout` n'entre pas, et son absence est la
        décision : les quatre autres ont un bon côté connu — la silhouette se
        garde, le repeint s'évite, l'échelle vaut 1, une pièce est un objet et
        non une poussière — quand `ajout` n'en a aucun. Une pièce contenue en
        ajoute peu et va bien ; une pièce qui agrandit en ajoute beaucoup et va
        bien aussi. La ranger dans un classement aurait demandé de choisir un
        sens qu'elle n'a pas, et le classement aurait dit ce choix-là plutôt que
        l'état du calque.

        **Aucune ne refuse, ici non plus** (US-147). Elles ordonnent ce qu'on
        regarde ; elles ne retirent rien, ne colorent rien et n'empêchent rien.
        L'écart d'échelle est rapporté à la tolérance du produit — au-delà, il
        n'y a plus de calque du tout, donc plus rien à graduer.
        """
        return (
            ("silhouette retrouvée", _borne(1.0 - self.silhouette)),
            ("corps repeint", _borne(self.repeint)),
            ("objet ou poussière", _borne(1.0 - self.compacite)),
            ("échelle au retour", _borne(abs(self.echelle - 1.0) / ECHELLE_TOLEREE)),
        )

    def pire(self) -> tuple[str, float]:
        """La mesure la plus défavorable, **nommée** (US-152).

        Le nom compte autant que le nombre : « 0,42 » tout seul demanderait
        d'aller chercher à quoi, et le tri servirait alors à ranger sans dire
        pourquoi. C'est la règle du chiffre et de son jumeau, appliquée au
        classement (`docs/design-motifs.md`).
        """
        return max(self.defaveurs(), key=lambda mesure: mesure[1])

    def en_json(self) -> dict[str, Any]:
        nom, gravite = self.pire()
        return {
            "silhouette": self.silhouette,
            "repeint": self.repeint,
            "ajout": self.ajout,
            "echelle": self.echelle,
            "compacite": self.compacite,
            # déduits — présents pour l'interface, jamais relus. Le classement
            # se calcule **une fois, ici** : un écran qui referait le calcul
            # ferait un jour un second barème, et deux listes triées
            # différemment sur les mêmes cinq nombres.
            "pire": nom,
            "gravite": round(gravite, 4),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "MesuresCalque | None":
        if not d:
            return None
        return MesuresCalque(
            silhouette=float(d.get("silhouette", 0.0)),
            repeint=float(d.get("repeint", 0.0)),
            ajout=float(d.get("ajout", 0.0)),
            echelle=float(d.get("echelle", 1.0)),
            compacite=float(d.get("compacite", 1.0)),
        )


# ── Ce qu'on relit du fichier d'un projet ────────────────────────────────────


def emplacements_depuis_json(brut: Any) -> tuple[Emplacement, ...]:
    """Les emplacements d'un projet, remis dans leur ordre.

    **Vide par défaut, et c'est délibéré.** Le plan de poses, lui, arrive garni :
    un projet neuf en reçoit six parce qu'un critère l'exige, et parce qu'une
    liste vide de poses décourage. Un vestiaire n'a pas cette dette — personne ne
    sait d'avance ce qu'un jeu équipe —, et « nommer, c'est créer » suffit à le
    remplir sans qu'aucune ligne inventée ait à être effacée d'abord.

    Un doublon d'identifiant serait une colonne que la matrice ne saurait pas
    distinguer : le premier gagne. Même règle que `plan_depuis_json`.
    """
    return tuple(
        _sans_doublon(
            Emplacement.depuis_json(e)
            for e in _lisible(brut)
            if isinstance(e, dict) and e.get("identifiant")
        )
    )


def pieces_depuis_json(brut: Any) -> tuple[Piece, ...]:
    return tuple(
        _sans_doublon(
            Piece.depuis_json(p)
            for p in _lisible(brut)
            if isinstance(p, dict) and p.get("identifiant")
        )
    )


def _borne(valeur: float) -> float:
    """Ramené dans [0, 1] — au-delà, il n'y a plus rien à graduer."""
    return max(0.0, min(1.0, valeur))


def _lisible(brut: Any) -> Iterable[Any]:
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return ()
    return brut


def _sans_doublon(objets: Iterable[Any]) -> list[Any]:
    vus: set[str] = set()
    retenus: list[Any] = []
    for objet in objets:
        if objet.identifiant in vus:
            continue
        vus.add(objet.identifiant)
        retenus.append(objet)
    return retenus


# Le rang d'un emplacement qu'on vient de créer, quand l'auteur n'en dit rien :
# **en queue**, jamais trié — même règle que l'ajout d'une pose au plan.
def rang_suivant(emplacements: Iterable[Emplacement]) -> int:
    return max((e.rang for e in emplacements), default=-1) + 1


# ── Les six que l'atelier propose, et il les propose sans les poser ──────────
#
# **Le vestiaire naît vide, et il continue** — la décision d'`emplacements_depuis_json`
# ne bouge pas d'un mot : personne ne sait d'avance ce qu'un jeu équipe, et une
# ligne inventée qu'il faut effacer d'abord coûte plus qu'une liste vide.
#
# **Ce qui change le 1ᵉʳ septembre 2026 est ailleurs, et c'est mesuré** : l'étape
# 8 de l'assistant montrait une liste vide sous la demi-phrase « L'ordre compte »,
# et cette moitié de phrase énonçait une règle sur un ordre que rien ne
# permettait de changer. Une liste vide ne décourage pas seulement — elle rend la
# règle indémontrable.
#
# La réponse n'est donc pas de garnir le fichier, c'est de **proposer en un
# geste** : l'étape offre de poser ces six-là, l'auteur clique ou n'y touche pas,
# et rien n'a jamais été écrit derrière son dos. C'est le même équilibre que
# « nommer, c'est créer », avec six noms tapés d'avance.
#
# **L'ordre est celui de l'empilement, du fond vers l'avant**, et c'est lui qui
# fait la démonstration : le dos passe derrière le corps, le casque devant tout.
# Un ordre alphabétique n'apprendrait rien.
EMPLACEMENTS_PROPOSES: tuple[str, ...] = (
    "le dos",
    "le corps",
    "les jambes",
    "le torse",
    "les mains",
    "la tête",
)
