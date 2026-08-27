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
from atelier.services.assets import AssetInconnu, RecetteRefusee, ServiceAssets
from atelier.services.bibliotheque import (
    ANNULATION_S,
    AnnulationExpiree,
    CollectionInconnue,
    ProjetInconnu,
    RangementRefuse,
    ServiceBibliotheque,
)
from atelier.services.catalogue import EtatCatalogue, ServiceCatalogue
from atelier.services.decoupe import DecoupeRefusee, ServiceDecoupe
from atelier.services.evenements import Diffusion, Evenement
from atelier.services.generation import ServiceGenerations
from atelier.services.univers import (
    CarteInconnue,
    CarteRefusee,
    ServiceUnivers,
    UniversRefuse,
)

__all__ = [
    "ANNULATION_S",
    "AnnulationExpiree",
    "AssetInconnu",
    "Atelier",
    "CarteInconnue",
    "CarteRefusee",
    "CollectionInconnue",
    "DecoupeRefusee",
    "Diffusion",
    "EtatCatalogue",
    "Evenement",
    "ProjetInconnu",
    "RangementRefuse",
    "RecetteRefusee",
    "ServiceAssets",
    "ServiceBibliotheque",
    "ServiceCatalogue",
    "ServiceDecoupe",
    "ServiceGenerations",
    "ServiceUnivers",
    "UniversRefuse",
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
        # l'avancement d'une génération, le retour du catalogue et le rangement
        # de la bibliothèque sur le même flux : c'est ce qui permet à
        # l'interface de n'ouvrir qu'une liaison.
        self.diffusion = Diffusion()
        self.catalogue = ServiceCatalogue(
            fabrique_fournisseur(), self.fichiers, self.diffusion
        )
        # Les assets avant les générations : c'est une génération qui les fait
        # naître, pas l'inverse. Le post-traitement ne connaît ni le fournisseur
        # ni le catalogue — il n'y a rien à lui passer d'autre que le disque.
        self.assets = ServiceAssets(self.base, self.fichiers, self.diffusion)
        # La bibliothèque range ce que les assets écrivent : elle passe par eux
        # pour poser un résultat, et reste ainsi le second lecteur d'un seul
        # écrivain.
        self.bibliotheque = ServiceBibliotheque(
            self.base, self.fichiers, self.assets, self.diffusion
        )
        # **L'univers après la bibliothèque, avant les générations**, et cet
        # ordre-là est le seul possible : il écrit le projet *par* la
        # bibliothèque, qui en est le seul écrivain, et c'est lui que la
        # génération consulte pour savoir ce qui part en référence. Aucun cycle
        # — la palette dont `ServiceAssets` a besoin se lit dans le projet, pas
        # auprès d'un service.
        self.univers = ServiceUnivers(
            self.base, self.fichiers, self.bibliotheque, self.assets, self.diffusion
        )
        # **Après la bibliothèque et les assets, avant rien du tout.** Le
        # slicer ne fabrique que ce que ces deux-là savent déjà écrire et
        # ranger : il ne connaît ni le catalogue, ni l'univers, ni le
        # fournisseur. C'est ce qui fait qu'une planche se découpe réseau coupé.
        self.decoupe = ServiceDecoupe(
            self.base, self.fichiers, self.assets, self.bibliotheque, self.diffusion
        )
        self.generations = ServiceGenerations(
            self.base,
            self.fichiers,
            self.catalogue,
            fabrique_fournisseur,
            self.diffusion,
            self.assets,
            self.bibliotheque,
            self.univers,
        )

    async def ouvrir(self) -> None:
        """Ce qui se passe au démarrage, dans l'ordre, et sans jamais lever.

        Le catalogue est relu ; la bibliothèque se reconstruit si son index a
        disparu et s'assure qu'un projet existe ; ce que l'arrêt précédent a
        coupé est marqué — pas relancé —, et les images qui n'ont pas encore
        d'asset en reçoivent un. L'atelier s'ouvre même sans réseau et même sans
        clé : l'échec attend le moment où on génère (US-95).

        **La bibliothèque avant le rattrapage** : reconstruire repose ce que les
        fichiers disent, rattraper ne comble que ce qui manque encore. Dans
        l'ordre inverse, un index effacé serait d'abord rempli d'assets tout
        neufs, sans rangement, sans favori et sans filiation — puis écrasé.
        """
        # **Le local d'abord.** Rien ici ne demande le réseau, et rien ici ne
        # doit attendre qu'il réponde : c'est ce qui donne son sens à « réseau
        # coupé, la bibliothèque fonctionne normalement » (US-92).
        self.bibliotheque.ouvrir()
        self.generations.reprendre()
        # Les images produites avant que les assets existent — celles de T1 —
        # en reçoivent un ici. Sans ça elles resteraient dans la grille sans
        # pouvoir être retouchées, et l'atelier aurait deux sortes d'images.
        self.assets.rattraper(self.generations.recentes(1000))
        await self.catalogue.rafraichir()

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
            # Ce que le post-traitement sait faire **sur cette machine**, et ce
            # qu'il ne peut pas : un moteur de détourage absent, une palette qui
            # n'existe pas encore. L'écran grise avec la phrase qu'il reçoit, il
            # ne rejoue jamais la règle de son côté. La palette dépend du projet
            # ouvert — c'est ici qu'on les tient tous les deux.
            "traitement": self.assets.traitement(self.bibliotheque.courant),
            # L'univers du projet ouvert : bible, barème, palette, défauts. Servi
            # à l'ouverture pour que l'écran dessine « ce qui part » sans un
            # second appel, et republié à chaque fois qu'il change.
            "univers": self.univers.univers(self.bibliotheque.courant).en_json(),
            # L'arbre : projets, collections, comptes et totaux. Comptés ici,
            # jamais à l'écran — une somme faite sur les deux cents assets qu'un
            # navigateur a en mémoire dirait un chiffre faux dès que la
            # bibliothèque dépasse ce que la grille sert.
            "bibliotheque": self.bibliotheque.arbre(),
            "annulation_s": ANNULATION_S,
        }
