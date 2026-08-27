# -*- coding: utf-8 -*-
"""Le port fournisseur et son unique adaptateur.

**C'est la seule frontière formelle du dépôt** (`docs/ARCHITECTURE.md`
§ Squelette). Il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des
trois ne changera. Le fournisseur, lui, changera : le vocabulaire d'OpenRouter
ne franchit donc pas ce dossier.
"""

from atelier.fournisseur.port import ImageProduite, PortFournisseur
from atelier.fournisseur.openrouter import OpenRouter

__all__ = ["ImageProduite", "OpenRouter", "PortFournisseur"]
