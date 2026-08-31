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

from atelier.domaine.plan import Pose, plan_depuis_json


@dataclass(slots=True)
class Personnage:
    identifiant: str
    projet: str
    nom: str
    description: str = ""

    # ── Le type d'objet, et ce que cette chose ajoute pour elle seule (E9) ───
    #
    # **Le type donne la liste de base.** Un personnage a ses six attitudes, un
    # meuble ses trois états, une tuile aucune ; avant E9 le jeu n'en déclarait
    # qu'une et un coffre héritait de *marche*. Vide, la chose retombe sur le
    # plan du projet — c'est ce qui reprend les personnages d'avant sans qu'un
    # seul fichier ait été réécrit.
    type: str = ""

    # **Ce que cette chose-là ajoute, et personne d'autre.** Un boss garde les
    # six poses de son type et en ajoute une à lui seul, sans que les autres
    # personnages voient paraître une case vide qui ne les concerne pas.
    ajoutees: tuple[Pose, ...] = ()

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

        **Ce que la chose ajoute vient après**, jamais mêlé : le type donne la
        liste, la chose la complète, et l'ordre le dit sans qu'on ait à lire une
        étiquette.
        """
        rendues = tuple(p for p in plan if p.identifiant not in self.ecartees)
        deja = {p.identifiant for p in rendues}
        ajoutees = tuple(
            p
            for p in self.ajoutees
            if p.identifiant not in self.ecartees and p.identifiant not in deja
        )
        return rendues + ajoutees

    def origine(self, pose: str) -> str:
        """D'où vient cette pose — **du type, ou ajoutée ici** (E9).

        Sans cette réponse, on ne saurait plus qui a décidé quoi, ni ce qui
        bougerait en changeant le type de la chose. C'est une lecture, pas un
        drapeau rangé : la liste des ajouts la porte déjà.
        """
        return "ici" if any(p.identifiant == pose for p in self.ajoutees) else "type"

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "projet": self.projet,
            "nom": self.nom,
            "description": self.description,
            "type": self.type,
            "ajoutees": [p.en_json() for p in self.ajoutees],
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
            type=str(d.get("type") or ""),
            ajoutees=plan_depuis_json(d.get("ajoutees") or []),
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
