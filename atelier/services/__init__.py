# -*- coding: utf-8 -*-
"""Les gestes du produit.

C'est ici que vit ce que l'atelier sait faire. `api/` et `mcp/` sont deux
façades sur ce dossier, et aucune des deux ne réimplémente quoi que ce soit :
c'est ce qui garantit que ce qu'un agent peut faire est exactement ce que
l'écran peut faire (`docs/ARCHITECTURE.md` §4, règle 2).

`Atelier` est le point de composition — le seul endroit du dépôt qui sache que
le fournisseur est OpenRouter, que l'index est du SQLite et que les fichiers
sont sur le disque.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from atelier.depot import Base, Fichiers
from atelier.fournisseur import OpenRouter, PortFournisseur
from atelier.reglages import lire_cle
from atelier.services.catalogue import EtatCatalogue, ServiceCatalogue
from atelier.services.generation import ServiceGenerations

__all__ = ["Atelier", "EtatCatalogue", "ServiceCatalogue", "ServiceGenerations"]


def _openrouter() -> PortFournisseur:
    """**La clé est relue à chaque appel**, jamais au démarrage.

    On doit pouvoir la déposer sans redémarrer le serveur — et, en T7, changer
    les garde-fous de l'agent en cours de session pour la même raison.
    """
    return OpenRouter(lire_cle())


class Atelier:
    def __init__(
        self,
        racine: Path | None = None,
        fabrique_fournisseur: Callable[[], PortFournisseur] = _openrouter,
    ) -> None:
        self.fichiers = Fichiers(racine)
        self.fichiers.preparer()
        self.base = Base(self.fichiers.base)
        self.fabrique_fournisseur = fabrique_fournisseur
        self.catalogue = ServiceCatalogue(fabrique_fournisseur(), self.fichiers)
        self.generations = ServiceGenerations(
            self.base, self.fichiers, self.catalogue, fabrique_fournisseur
        )

    async def ouvrir(self) -> None:
        """Ce qui se passe au démarrage, dans l'ordre, et sans jamais lever.

        Le catalogue est relu, et ce que l'arrêt précédent a coupé est marqué —
        pas relancé. L'atelier s'ouvre même sans réseau et même sans clé :
        l'échec attend le moment où on génère (US-95).
        """
        await self.catalogue.rafraichir()
        self.generations.reprendre()
