# -*- coding: utf-8 -*-
"""Le personnage — un nom, une description, et les cases qu'il réclame.

« Créer un personnage dans mon projet et le décrire une fois, afin de fabriquer
toutes ses images sans réécrire son signalement à chaque prompt » (US-115). Sa
description part avec chaque génération de pose ; elle ne se retape jamais.

**Ce n'est pas une image de plus, et il n'en porte aucune.** Un corps est un
asset ordinaire, rangé dans la même bibliothèque que le reste, et c'est *lui*
qui dit de quel personnage et de quelle pose il est (`atelier/domaine/asset.py`).
La matrice se calcule donc à partir des assets, et il n'existe nulle part une
liste de cases pleines qu'il faudrait tenir d'accord avec ce que le disque
contient. C'est la règle « un état dérivable ne se garde pas en double », et
c'est aussi ce qui rend vraie sans effort la promesse « supprimer un personnage
laisse ses images en place ».

**Il porte ce qu'il écarte, pas ce qu'il tient.** À l'écran on coche des poses
tenues ; sur le disque on range celles qu'on ne tient pas. Le sens est le même,
la panne évitée ne l'est pas : ajouter une pose au plan doit ajouter une case
vide à *chaque* personnage (`docs/PLAN.md` C1), et avec une liste de poses
tenues il aurait fallu réécrire tous les personnages du projet à chaque ajout —
un balayage capable de réussir à moitié, pour un geste qui ne devrait rien
écrire du tout. Avec l'écart, la case neuve paraît partout sans qu'un seul
fichier soit touché.

**Ce qu'il désigne reste où c'est.** Les concept arts sont des cartes du tableau
d'inspiration, désignées par leur identifiant (US-124) : elles ne sont ni
copiées, ni rangées ailleurs. La carte, elle, ne sait pas qui la désigne — deux
personnages peuvent désigner la même, et un champ sur la carte ne saurait pas
dire lequel.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Iterable

from atelier.domaine.plan import Pose


@dataclass(slots=True)
class Personnage:
    identifiant: str
    projet: str
    nom: str
    description: str = ""

    # Les poses du plan que ce personnage **ne tient pas** — voir l'en-tête.
    # Une entrée qui ne désigne plus rien ne gêne pas : elle ne peut écarter
    # qu'une pose qui existe, et une pose retirée du plan ne revient pas par
    # elle.
    ecartees: tuple[str, ...] = ()

    # Les cartes du tableau désignées comme concept art (US-124).
    concept_arts: tuple[str, ...] = ()

    # Ce qui ne doit plus partir avec **ce personnage-là** (US-126). La portée du
    # milieu : plus large qu'une génération, plus étroite que le projet. Elle
    # n'est ni une dépromotion ni un retrait du tableau — l'artwork reste
    # officiel, et l'univers ne bouge pas.
    references_ecartees: tuple[str, ...] = ()

    cree_le: float = field(default_factory=time.time)

    # ── Ce qui se déduit ─────────────────────────────────────────────────────

    def tenues(self, plan: Iterable[Pose]) -> tuple[Pose, ...]:
        """Les poses de ce personnage, dans l'ordre du plan.

        L'ordre vient du plan et de nulle part ailleurs : deux personnages du
        même projet se lisent alors ligne à ligne, ce qui est très exactement ce
        qu'un plan commun sert à faire.
        """
        return tuple(p for p in plan if p.identifiant not in self.ecartees)

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "projet": self.projet,
            "nom": self.nom,
            "description": self.description,
            "ecartees": list(self.ecartees),
            "concept_arts": list(self.concept_arts),
            "references_ecartees": list(self.references_ecartees),
            "cree_le": self.cree_le,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Personnage":
        return Personnage(
            identifiant=d["identifiant"],
            projet=d.get("projet", ""),
            nom=d.get("nom", d["identifiant"]),
            description=d.get("description", ""),
            ecartees=tuple(_textes(d.get("ecartees"))),
            concept_arts=tuple(_textes(d.get("concept_arts"))),
            references_ecartees=tuple(_textes(d.get("references_ecartees"))),
            cree_le=d.get("cree_le", 0.0),
        )


def _textes(brut: Any) -> list[str]:
    """Une liste d'identifiants relue du disque, débarrassée de ce qui n'en est
    pas. Un fichier abîmé fait perdre une coche, jamais l'ouverture du projet."""
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return []
    return [t for t in brut if isinstance(t, str) and t]
