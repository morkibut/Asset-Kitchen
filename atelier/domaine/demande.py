# -*- coding: utf-8 -*-
"""Ce que l'auteur demande — avant qu'un modèle ne soit consulté."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass(frozen=True, slots=True)
class Demande:
    """Un sujet, ce qu'on n'en veut pas, et le cadrage.

    `references` est vide en T1 jalon 1 : la réinjection d'un asset arrive en T3,
    les artworks officiels en T4. Le champ existe déjà parce que c'est lui qui
    décide du grisé d'un modèle, et que ce calcul ne doit pas être réécrit.
    """

    prompt: str
    prompt_negatif: str = ""
    proportions: str = "1:1"
    resolution: str | None = None
    variations: int = 1
    references: tuple[bytes, ...] = ()
    options: Mapping[str, Any] = field(default_factory=dict)

    # **Ce que l'auteur fabrique**, nommé dans le barème de son projet — arrivé
    # en T4. Un seul mot, et il décide de trois choses d'un coup : quels
    # artworks partent en référence (par la famille de l'échelle), quel modèle
    # est le défaut, et quelle part de la case le sujet occupera. C'est ce qui
    # garde « promouvoir est un geste unique » : il n'y a rien à sélectionner au
    # moment de générer, seulement à dire ce qu'on fabrique.
    #
    # Vide veut dire « je ne le dis pas », et c'est permis : un univers vide ne
    # contraint rien (US-57), et seuls les artworks marqués « tous » partent.
    echelle: str = ""

    def __post_init__(self) -> None:
        if not self.prompt.strip():
            raise ValueError("prompt vide")
        if self.variations < 1:
            raise ValueError("au moins une variation")

    def resume(self) -> dict[str, Any]:
        """Les paramètres, sans les octets des références — pour l'enregistrement."""
        return {
            "prompt": self.prompt,
            "prompt_negatif": self.prompt_negatif,
            "proportions": self.proportions,
            "resolution": self.resolution,
            "variations": self.variations,
            "references": len(self.references),
            "options": dict(self.options),
            "echelle": self.echelle,
        }
