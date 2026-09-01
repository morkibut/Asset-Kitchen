# -*- coding: utf-8 -*-
"""Le port fournisseur, son adaptateur, et l'autre sortant du dépôt.

**C'est la seule frontière formelle du dépôt** (`docs/ARCHITECTURE.md`
§ Squelette). Il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des
trois ne changera. Le fournisseur, lui, changera : le vocabulaire d'OpenRouter
ne franchit donc pas ce dossier.

`toile` est le second sortant, arrivé avec T4 : une adresse collée dans le
tableau d'inspiration part chercher son image. Il est ici pour la même raison
que le premier — un message d'`httpx` ne doit jamais atteindre l'écran.

**Ils sont deux depuis F1**, et la frontière n'a pas bougé d'un pouce : le port
n'a pas changé de forme, et chaque adaptateur enferme son vocabulaire comme le
premier enfermait le sien. Ce qui a changé est que le produit ne dit plus « le
fournisseur » mais « celui de ce modèle-là » — c'est
`atelier.services.fournisseurs` qui tient la liste, et lui seul.
"""

from atelier.fournisseur.port import ImageProduite, PortFournisseur
from atelier.fournisseur.openrouter import OpenRouter
from atelier.fournisseur.pollinations import Pollinations
from atelier.fournisseur.toile import AdresseRefusee, ImageDistante, recuperer, verifier

__all__ = [
    "AdresseRefusee",
    "ImageDistante",
    "ImageProduite",
    "OpenRouter",
    "Pollinations",
    "PortFournisseur",
    "recuperer",
    "verifier",
]
