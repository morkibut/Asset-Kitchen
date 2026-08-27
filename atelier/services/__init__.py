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
from typing import Any, Callable

from atelier.depot import Base, Fichiers
from atelier.fournisseur import OpenRouter, PortFournisseur
from atelier.reglages import etat_cle, lire_cle
from atelier.services.catalogue import EtatCatalogue, ServiceCatalogue
from atelier.services.evenements import Diffusion, Evenement
from atelier.services.generation import ServiceGenerations

__all__ = [
    "Atelier",
    "Diffusion",
    "EtatCatalogue",
    "Evenement",
    "ServiceCatalogue",
    "ServiceGenerations",
]


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
        # **Une seule diffusion pour tout l'atelier.** Un abonné voit passer
        # l'avancement d'une génération et le retour du catalogue sur le même
        # flux : c'est ce qui permet à l'interface de n'ouvrir qu'une liaison.
        self.diffusion = Diffusion()
        self.catalogue = ServiceCatalogue(
            fabrique_fournisseur(), self.fichiers, self.diffusion
        )
        self.generations = ServiceGenerations(
            self.base,
            self.fichiers,
            self.catalogue,
            fabrique_fournisseur,
            self.diffusion,
        )

    async def ouvrir(self) -> None:
        """Ce qui se passe au démarrage, dans l'ordre, et sans jamais lever.

        Le catalogue est relu, et ce que l'arrêt précédent a coupé est marqué —
        pas relancé. L'atelier s'ouvre même sans réseau et même sans clé :
        l'échec attend le moment où on génère (US-95).
        """
        await self.catalogue.rafraichir()
        self.generations.reprendre()

    def etat(self) -> dict[str, Any]:
        """Tout ce qu'il faut pour dessiner l'atelier à l'ouverture.

        Un seul objet, servi à l'identique par `GET /api/status` et par le
        premier message du flux d'événements. Un onglet qui se rouvre n'a donc
        qu'une chose à faire : écouter — l'état complet arrive dans la seconde,
        avec les générations déjà terminées pendant son absence.
        """
        return {
            "cle": etat_cle().en_json(),
            "catalogue": self.catalogue.en_json(),
            "couts": {"total_usd": self.generations.total_couts()},
        }
