# -*- coding: utf-8 -*-
"""Le rangement — deux niveaux, et pas un de plus.

`Projet › Collection › Asset`, et rien d'autre (`docs/ARCHITECTURE.md` §5). Un
troisième niveau se paierait tout de suite en gestes : il faudrait le choisir à
chaque rangement, l'afficher dans l'arbre, le filtrer, et décider ce qu'il
advient de son contenu quand on le supprime.

**Le projet contraint, la collection range.** C'est la différence centrale avec
SpriteCook, où le projet n'est qu'un dossier : ici le projet portera en T4 la
bible, les artworks officiels, la palette et la taille de pixel imposée à tout
ce qui rentre. La collection, elle, ne contraint rien — elle regroupe.

**Une collection peut n'appartenir à aucun projet.** C'est écrit tel quel dans
le modèle d'objets (« nom, projet optionnel ») et ça sert : « à refaire », « pour
la démo » traversent les univers. Une collection qui appartient à un projet, en
revanche, décide du projet de ce qu'on y range — sinon un asset se retrouverait
dans la collection d'un univers et dans un autre univers.

**L'identifiant est un repère de dossier, pas un tirage au sort.** `donnees/`
s'ouvre à la main : y lire `projets/bac-a-sable/` plutôt que
`projets/9f3c1a…/` est ce qui rend vrai « les fichiers font foi ». Il se dérive
du nom à la création et **ne change plus jamais** — un dossier qui se renomme
sous les fichiers qu'il contient est un déménagement, pas un renommage.
"""

from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any

# Le projet qui existe déjà au premier lancement (US-2). Ranger reste un geste,
# jamais un préalable : on ne nomme pas un univers avant de savoir ce qu'on
# fabrique. Créer un vrai projet attend qu'on en ressente le besoin (US-5).
NOM_BAC_A_SABLE = "Bac à sable"


@dataclass(slots=True)
class Projet:
    """Un univers. En T3 il range et il totalise ; en T4 il contraindra.

    `docs/PLAN.md` § Quand chaque entité apparaît : le projet porte ici « nom,
    rangement, total des coûts, journal », et se complète en T4 de la bible, des
    artworks, de la palette et des réglages par défaut. Aucun de ces champs
    n'est déclaré à vide aujourd'hui : un champ vide à l'écran montre le cadrage
    au lieu de servir le geste, et sur le disque il ferait croire à une donnée
    perdue plutôt qu'à une donnée qui n'existe pas encore.
    """

    identifiant: str
    nom: str
    cree_le: float = field(default_factory=time.time)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Projet":
        return Projet(
            identifiant=d["identifiant"],
            nom=d.get("nom", d["identifiant"]),
            cree_le=d.get("cree_le", 0.0),
        )


@dataclass(slots=True)
class Collection:
    """Un regroupement à plat. Ne contraint rien, ne coûte rien."""

    identifiant: str
    nom: str
    projet: str | None = None
    cree_le: float = field(default_factory=time.time)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "projet": self.projet,
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Collection":
        return Collection(
            identifiant=d["identifiant"],
            nom=d.get("nom", d["identifiant"]),
            projet=d.get("projet"),
            cree_le=d.get("cree_le", 0.0),
        )


_INTERDITS = re.compile(r"[^a-z0-9]+")


def repere(nom: str, pris: object = ()) -> str:
    """Le nom, réduit à ce qu'un dossier accepte partout, et rendu unique.

    Les accents sont dépliés plutôt que remplacés — « Forêt » donne `foret` et
    non `for-t`. Windows, macOS et Linux ne s'accordent ni sur la casse ni sur
    la normalisation Unicode d'un nom de dossier : ne garder que `[a-z0-9-]`
    évite d'avoir un jour à en débattre.

    Un nom qui ne laisse rien — « ✳︎ », « 日本 » — retombe sur `projet`, puis sur
    `projet-2` : un dossier sans nom vaut mieux qu'un refus de créer.
    """
    deplie = unicodedata.normalize("NFKD", nom)
    sans_accent = "".join(c for c in deplie if not unicodedata.combining(c))
    base = _INTERDITS.sub("-", sans_accent.lower()).strip("-") or "projet"

    if base not in pris:
        return base
    rang = 2
    while f"{base}-{rang}" in pris:
        rang += 1
    return f"{base}-{rang}"
