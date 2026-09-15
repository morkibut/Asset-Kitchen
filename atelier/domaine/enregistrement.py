# -*- coding: utf-8 -*-
"""D'où vient ce qui a été **enregistré sous** une autre case (RP20).

L'auteur ouvre *marche vers l'est*, pose un miroir gauche-droite, et garde le
résultat comme *marche vers l'ouest*. Ce qui naît alors n'est ni une copie ni un
miroir au sens de `B1` : c'est une image neuve **dont le brut est le rendu**, et
dont la recette est vide. Le lien avec l'original ne peut donc plus se lire dans
la recette — elle ne porte plus rien —, et il s'écrit ici.

**Deux choses, et pas une de plus** : de quoi ça vient, et avec quelle recette
ça a été rendu. La recette est gardée entière plutôt que résumée à son
empreinte, parce que la question qu'on se pose six mois plus tard est *qu'est-ce
qui a été fait à cette image* — une empreinte ne répond pas, et l'original a pu
changer de recette depuis.

**Le retour, lui, ne s'écrit pas.** Une image dérivée porte aussi son `parent`,
donc `Base.enfants` la retrouve sans qu'aucune liste soit tenue sur l'original ;
une bande dérivée se retrouve en lisant les bandes du dépôt. C'est la règle du
produit depuis `C1` — *une case est pleine parce qu'une image la porte* — et
elle vaut ici : **la filiation se lit, elle ne se tient pas en double**.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from atelier.domaine.recette import Recette

# Ce qu'on a enregistré sous. Deux valeurs, et ce sont les deux calques du
# produit — les images fixes et les animations (`AGENTS.md`, point 8quater).
IMAGE = "image"
ANIMATION = "animation"


@dataclass(frozen=True, slots=True)
class Origine:
    """L'original et la recette employée, gardés sur ce qui en est sorti.

    `direction` est la case **de départ**, pas celle d'arrivée : celle
    d'arrivée est déjà sur l'asset ou la bande. La garder ici est ce qui permet
    de relire *venue de l'est, retournée* sans avoir à rouvrir l'original — qui
    peut avoir été supprimé.
    """

    source: str = ""
    nature: str = IMAGE
    recette: Recette = field(default_factory=Recette)
    direction: str = ""
    miroir: bool = False
    le: float = field(default_factory=time.time)

    def en_json(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "nature": self.nature,
            "recette": self.recette.en_json(),
            "direction": self.direction,
            "miroir": self.miroir,
            "le": self.le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Origine | None":
        """Absent veut dire *rien ne l'a engendrée ainsi*, et c'est le cas de
        toutes les images et de toutes les bandes d'avant `RP20` : elles se
        relisent sans qu'un fichier ait été réécrit."""
        if not d:
            return None
        nature = str(d.get("nature") or IMAGE)
        return Origine(
            source=str(d.get("source") or ""),
            nature=nature if nature in (IMAGE, ANIMATION) else IMAGE,
            recette=Recette.depuis_json(d.get("recette") or {}),
            direction=str(d.get("direction") or ""),
            miroir=bool(d.get("miroir", False)),
            le=float(d.get("le") or 0.0),
        )
