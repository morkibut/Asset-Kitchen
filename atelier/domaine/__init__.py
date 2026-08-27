# -*- coding: utf-8 -*-
"""Les objets et les règles du produit. Aucune dépendance sortante.

Rien ici ne connaît FastAPI, SQLite, httpx, ni le vocabulaire d'un fournisseur.
"""

from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.demande import Demande
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.domaine.erreurs import ErreurAtelier, ModeleInconnu, SansCle

__all__ = [
    "Demande",
    "Emplacement",
    "ErreurAtelier",
    "Generation",
    "Modele",
    "ModeleInconnu",
    "Option",
    "Resultat",
    "SansCle",
    "Statut",
]
