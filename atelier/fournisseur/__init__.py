# -*- coding: utf-8 -*-
"""Le port fournisseur, son adaptateur, et l'autre sortant du dépôt.

**C'est la seule frontière formelle du dépôt** (`docs/ARCHITECTURE.md`
§ Squelette). Il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des
trois ne changera. Le fournisseur, lui, changera : le vocabulaire d'OpenRouter
ne franchit donc pas ce dossier.

`toile` est le second sortant, arrivé avec T4 : une adresse collée dans le
tableau d'inspiration part chercher son image. Il est ici pour la même raison
que le premier — un message d'`httpx` ne doit jamais atteindre l'écran.
"""

from atelier.fournisseur.port import ImageProduite, PortFournisseur
from atelier.fournisseur.openrouter import OpenRouter
from atelier.fournisseur.toile import AdresseRefusee, ImageDistante, recuperer, verifier

__all__ = [
    "AdresseRefusee",
    "ImageDistante",
    "ImageProduite",
    "OpenRouter",
    "PortFournisseur",
    "recuperer",
    "verifier",
]
