# -*- coding: utf-8 -*-
"""La carte — ce qu'on colle dans le tableau d'inspiration.

**La deuxième famille d'images du produit** (`docs/ARCHITECTURE.md` §5). Une
carte ne s'exporte jamais, ne compte pas dans la bibliothèque, n'a ni recette ni
rendu : elle rassemble. La grille d'assets et le tableau d'inspiration ne se
confondent donc pas — l'une montre ce qu'on a fabriqué, l'autre ce dont on
s'inspire, et rien ne passe de l'une à l'autre sans un geste explicite.

**Elle appartient à un projet**, parce que le projet *est* l'univers. Un tableau
partagé entre univers ferait déteindre la fantasy d'un jeu sur l'interface d'un
autre — exactement ce que la famille est là pour empêcher, à l'échelle du
dessus. Supprimer un projet emporte donc son tableau ; ses assets, eux, sont
seulement détachés (US-30) : une inspiration n'a de sens que dans son univers,
une image produite en a un partout.

**Le genre se devine au collage, il ne se demande pas** (US-41, US-42, US-44).
Des octets d'image font une carte image ; une adresse fait une carte image *en
attente*, qui paraît tout de suite et se remplit ensuite ; le reste fait une
carte texte. C'est le collage qui devine et qui le dit — jamais un menu à
traverser avant de coller.

**Une carte en attente qui n'aboutit pas garde son adresse et sa raison**
(US-43). Elle ne disparaît pas et ne se retente pas toute seule : « rien n'est
jamais relancé automatiquement » vaut ici comme ailleurs. Le geste de réessayer
appartient à l'auteur.

**L'empreinte est celle des octets, et elle sert à une seule chose** : dire
« tu as déjà celle-ci », avec un lien vers l'existante (US-46). Elle ne bloque
rien — l'auteur décide, et importer quand même reste possible.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any

# ── Ce qu'une carte porte ────────────────────────────────────────────────────

IMAGE = "image"
TEXTE = "texte"
GENRES = (IMAGE, TEXTE)

# Une carte image venue d'une adresse traverse trois états, et un seul est un
# échec. Une carte collée depuis des octets naît directement `prete`.
ATTENTE = "attente"
PRETE = "prete"
ECHOUEE = "echouee"
STATUTS = (ATTENTE, PRETE, ECHOUEE)

# **Les familles sont pressenties, pas figées** (`docs/PRD.md` § Notes) : « une
# famille manquante se découvrira à l'usage ». Elles sont ici parce que le
# banc 2 a montré qu'un artwork figuratif contamine les sujets suivants — le
# squelette héritait de la tunique et des bottes lacées du goblin. `tous` est la
# planche non figurative — matières, palette, échantillons de trait — qui
# accompagne toute génération sans transmettre de personnage (US-50).
PERSONNAGES = "personnages"
OBJETS = "objets"
DECORS = "decors"
INTERFACE = "interface"
TOUS = "tous"
FAMILLES = (PERSONNAGES, OBJETS, DECORS, INTERFACE, TOUS)

# Les trois vignettes du tableau (US-47). Ce sont les mêmes crans que le zoom de
# la grille d'assets : un seul vocabulaire de taille dans tout le produit.
TAILLES = (1, 2, 4)


@dataclass(slots=True)
class Carte:
    """Une image ou un texte, posé dans le tableau d'un projet."""

    identifiant: str
    projet: str
    genre: str = IMAGE

    # ── Ce qu'elle contient ──────────────────────────────────────────────────
    #
    # L'un ou l'autre, jamais les deux : `fichier` pour une image, `texte` pour
    # un texte. Une carte image en attente n'a pas encore de fichier, et c'est
    # exactement ce que dit son statut.
    fichier: str | None = None  # chemin relatif à `donnees/`
    texte: str = ""

    # ── Ce que la récupération a donné ───────────────────────────────────────
    statut: str = PRETE
    raison: str | None = None  # pourquoi elle n'est pas arrivée (US-43)

    # ── Sa provenance ────────────────────────────────────────────────────────
    #
    # « garder leur provenance » (US-47) : l'adresse d'où elle vient, et quand
    # elle est entrée. Une image trouvée dont on a perdu la source est une image
    # qu'on ne peut plus créditer ni retrouver.
    source: str = ""
    cree_le: float = field(default_factory=time.time)

    # ── Comment on la range et la lit ────────────────────────────────────────
    groupe: str = ""  # nom libre ; vide = hors groupe
    note: str = ""
    taille: int = 1  # 1× · 2× · 4×

    # ── Ce qui en fait un artwork officiel ───────────────────────────────────
    #
    # « Promouvoir reste un geste unique » (US-51) : on pose ces deux champs une
    # fois, et l'application choisit seule à chaque génération. Il n'y a rien à
    # sélectionner au moment de générer, et c'est le cœur de la tranche.
    officiel: bool = False
    famille: str = TOUS

    # ── Ce qu'on a mesuré sur les octets ─────────────────────────────────────
    #
    # Mesurées, jamais déduites — même règle que pour l'asset. L'empreinte, elle,
    # ne se mesure pas sur l'image mais sur ses octets : deux fichiers identiques
    # au bit près sont le même doublon, quoi qu'ils représentent.
    empreinte: str = ""
    largeur: int = 0
    hauteur: int = 0
    type_media: str = ""
    octets: int = 0

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    @property
    def montrable(self) -> bool:
        """Y a-t-il quelque chose à afficher à la place de l'attente ?"""
        return self.genre == TEXTE or (self.statut == PRETE and self.fichier is not None)

    @property
    def artwork(self) -> bool:
        """Un artwork officiel est une **image** promue. Un texte ne peut pas en
        être un : ce qui part en référence, ce sont des octets d'image, et la
        bible dit déjà ce qu'un texte aurait à dire."""
        return self.officiel and self.genre == IMAGE and self.statut == PRETE

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "projet": self.projet,
            "genre": self.genre,
            "texte": self.texte,
            "statut": self.statut,
            "raison": self.raison,
            "source": self.source,
            "cree_le": self.cree_le,
            "groupe": self.groupe,
            "note": self.note,
            "taille": self.taille,
            "officiel": self.officiel,
            "famille": self.famille,
            "empreinte": self.empreinte,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "type_media": self.type_media,
            "octets": self.octets,
            # déduits — présents pour l'interface, jamais relus
            "montrable": self.montrable,
            "artwork": self.artwork,
        }

    def en_disque(self) -> dict[str, Any]:
        """Ce qui s'écrit dans `cartes.json`. Porte en plus le chemin du fichier,
        que l'interface n'a aucune raison de connaître : elle demande une image à
        une route, pas un chemin."""
        return {**self.en_json(), "fichier": self.fichier}

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Carte":
        return Carte(
            identifiant=d["identifiant"],
            projet=d["projet"],
            genre=d.get("genre", IMAGE),
            fichier=d.get("fichier"),
            texte=d.get("texte", ""),
            statut=d.get("statut", PRETE),
            raison=d.get("raison"),
            source=d.get("source", ""),
            cree_le=d.get("cree_le", 0.0),
            groupe=d.get("groupe", ""),
            note=d.get("note", ""),
            taille=int(d.get("taille", 1)),
            officiel=bool(d.get("officiel", False)),
            famille=d.get("famille", TOUS),
            empreinte=d.get("empreinte", ""),
            largeur=int(d.get("largeur", 0)),
            hauteur=int(d.get("hauteur", 0)),
            type_media=d.get("type_media", ""),
            octets=int(d.get("octets", 0)),
        )


def empreinte_de(octets: bytes) -> str:
    """Ce qui nomme un doublon. Les octets, rien d'autre.

    Pas de comparaison perceptuelle : deux images visuellement proches sont deux
    images, et c'est à l'auteur d'en décider. Le produit signale ce dont il est
    **certain** — le même fichier, deux fois — et ne devine jamais le reste.
    """
    return hashlib.sha256(octets).hexdigest()[:16]
