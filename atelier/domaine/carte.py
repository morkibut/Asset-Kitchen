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

**Sa place sur la toile est sur elle, jamais dans un fichier de mise en page**
(T8). Un `toile.json` par projet aurait la panne qui a déjà valu son refus à
`cartes.json` : relire, modifier, réécrire — deux gestes dans le même instant se
relisent tous les deux avant d'écrire, et le second efface le premier. Sur une
toile ce n'est plus une hypothèse, c'est le régime normal. La carte porte sa
place, et un déplacement n'écrit qu'un fichier, le sien.

**Une note porte sa teinte, une image n'en porte aucune** (T9, US-111). Ce n'est
pas une restriction technique : colorier chaque carte reconstruirait un second
rangement, invisible dans la grille et concurrent du groupe — très exactement ce
que la tranche précédente a écarté en faisant de l'îlot le groupe lui-même. La
teinte d'un **îlot**, elle, n'est pas ici : un îlot n'a pas d'existence propre,
donc six membres feraient six vérités possibles pour un seul cadre. Elle vit sur
le projet (`atelier/domaine/projet.py`).
"""

from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.teinte import AUCUNE, teinte_valide

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

# **La largeur libre n'est pas un cran, et c'est le seul endroit du produit où
# une mesure est continue** (US-105). Elle est bornée pour la même raison que
# tout le reste : une valeur qu'aucun écran ne peut rendre n'est pas une
# décision de l'auteur, c'est une saisie qui a dérapé. En dessous du plancher la
# carte ne montre plus son image, au-dessus du plafond elle ne tient plus dans
# un plan qu'on relit.
LARGEUR_MIN = 48
LARGEUR_MAX = 2048


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

    # ── Sa place sur la toile ────────────────────────────────────────────────
    #
    # Arrivées en T8, et elles ne se confondent avec rien de ce qui précède.
    #
    # **`position` n'est pas `groupe`.** L'un dit *où*, l'autre dit *avec qui*.
    # Une carte peut avoir l'un sans l'autre : posée sans être classée, c'est le
    # brouillon — trois images côte à côte pour voir si elles vont ensemble avant
    # de décider qu'elles font un îlot (US-104). Et classée sans être posée,
    # c'est toute carte groupée avant T8 : elle se pose dans son îlot à
    # l'ouverture, et n'écrit la sienne qu'au premier geste.
    #
    # **`largeur_libre` n'est pas `taille`.** La taille est le cran 1× / 2× / 4×
    # que lit la grille ; la largeur libre est une place occupée sur un plan.
    # Une valeur unique pour les deux aurait fait qu'agrandir une carte sur la
    # toile change la grille de tout le monde. La hauteur ne se range pas : elle
    # suit le rapport de l'image.
    position: tuple[float, float] | None = None
    largeur_libre: int | None = None

    # ── Sa teinte, si c'est une note ─────────────────────────────────────────
    #
    # Arrivée en T9, et **elle ne concerne qu'une carte texte** (US-111). Une
    # carte image ne porte aucune couleur d'organisation, et c'est un critère
    # d'acceptation : colorier chaque carte reconstruirait un second rangement,
    # invisible dans la grille et concurrent du groupe — ce que T8 a justement
    # écarté en faisant de l'îlot le groupe lui-même.
    #
    # **Une note porte la sienne, un îlot non.** La différence n'est pas un
    # caprice : une note *est* un objet, donc elle a un endroit où l'écrire ; un
    # îlot n'en est pas un — six membres feraient six vérités possibles pour un
    # seul îlot, d'où la teinte d'îlot rangée sur le projet
    # (`atelier/domaine/projet.py`, `Projet.teintes`).
    teinte: str = AUCUNE

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

    @property
    def en_reserve(self) -> bool:
        """Ni classée, ni posée — donc elle attend (US-101).

        **La règle de l'écran Toile tient dans cette ligne**, et elle est ici
        parce qu'il n'y a qu'un endroit où l'écrire : la toile montre ce qui est
        classé, la réserve contient ce qui reste à classer. Une carte groupée est
        dans son îlot ; une carte posée sans groupe est sur le plan nu ; ce qui
        n'a ni l'un ni l'autre n'a nulle part où être, et c'est exactement ce que
        la réserve contient.
        """
        return not self.groupe and self.position is None

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
            # `null` et non `[0, 0]` : zéro n'est pas une place, c'est l'absence
            # de place — la même règle que pour une dimension jamais mesurée.
            "position": list(self.position) if self.position else None,
            "largeur_libre": self.largeur_libre,
            "teinte": self.teinte,
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
            "en_reserve": self.en_reserve,
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
            position=_position(d.get("position")),
            largeur_libre=_largeur(d.get("largeur_libre")),
            teinte=teinte_valide(d.get("teinte")),
            officiel=bool(d.get("officiel", False)),
            famille=d.get("famille", TOUS),
            empreinte=d.get("empreinte", ""),
            largeur=int(d.get("largeur", 0)),
            hauteur=int(d.get("hauteur", 0)),
            type_media=d.get("type_media", ""),
            octets=int(d.get("octets", 0)),
        )


def _position(brut: Any) -> tuple[float, float] | None:
    """Une place relue du disque, ou rien.

    **Relire est le moment où un champ ajouté rencontre les fichiers d'avant.**
    Toutes les cartes écrites de T4 à T7 n'ont pas de `position` : elles en
    reviennent sans, ce qui est exactement leur état — à classer, donc en
    réserve. Une valeur abîmée est traitée comme absente plutôt que de faire
    tomber la lecture du tableau entier : une carte mal placée se replace d'un
    geste, un tableau qui ne s'ouvre plus ne se répare pas.
    """
    if not isinstance(brut, (list, tuple)) or len(brut) != 2:
        return None
    try:
        x, y = float(brut[0]), float(brut[1])
    except (TypeError, ValueError):
        return None
    return (x, y) if math.isfinite(x) and math.isfinite(y) else None


def _largeur(brut: Any) -> int | None:
    """Une largeur libre relue du disque, ou rien — même règle que la place."""
    if brut is None:
        return None
    try:
        largeur = int(brut)
    except (TypeError, ValueError):
        return None
    return largeur if LARGEUR_MIN <= largeur <= LARGEUR_MAX else None


def empreinte_de(octets: bytes) -> str:
    """Ce qui nomme un doublon. Les octets, rien d'autre.

    Pas de comparaison perceptuelle : deux images visuellement proches sont deux
    images, et c'est à l'auteur d'en décider. Le produit signale ce dont il est
    **certain** — le même fichier, deux fois — et ne devine jamais le reste.
    """
    return hashlib.sha256(octets).hexdigest()[:16]
