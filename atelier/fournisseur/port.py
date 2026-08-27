# -*- coding: utf-8 -*-
"""Ce que le domaine attend d'un fournisseur d'images. Rien de plus."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from atelier.domaine import Demande, Modele


@dataclass(frozen=True, slots=True)
class ImageProduite:
    """Une image, et ce qu'elle a **réellement** coûté.

    `cout_usd` vient de la réponse de l'appel, jamais du tarif du catalogue :
    `riverflow-v2.5-fast` annonce $0,019 l'image et en facture $0,042, les
    références d'entrée étant facturées en plus.
    """

    octets: bytes
    cout_usd: float
    type_media: str | None = None  # ce que le fournisseur *dit* avoir rendu


class PortFournisseur(Protocol):
    """Deux gestes : dire ce qu'on sait faire, et le faire."""

    nom: str

    async def catalogue(self) -> list[Modele]:
        """Les modèles et leurs capacités, tels que le fournisseur les déclare."""
        ...

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        """Un appel, une image. Lève une erreur du domaine, jamais une erreur HTTP."""
        ...
