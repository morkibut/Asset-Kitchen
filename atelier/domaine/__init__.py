# -*- coding: utf-8 -*-
"""Les objets et les règles du produit. Aucune dépendance sortante.

Rien ici ne connaît FastAPI, SQLite, httpx, ni le vocabulaire d'un fournisseur.
"""

from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import ErreurAtelier, ModeleInconnu, SansCle
from atelier.domaine.generation import (
    ROLES,
    Emplacement,
    Generation,
    Reinjection,
    Resultat,
    Statut,
)
from atelier.domaine.projet import NOM_BAC_A_SABLE, Collection, Projet, repere
from atelier.domaine.recette import (
    Bords,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)

__all__ = [
    "NOM_BAC_A_SABLE",
    "Asset",
    "Bords",
    "Collection",
    "Demande",
    "Emplacement",
    "ErreurAtelier",
    "Generation",
    "Grille",
    "Modele",
    "ModeleInconnu",
    "Option",
    "Passe",
    "Projet",
    "Quantification",
    "ROLES",
    "Recadrage",
    "Recette",
    "Reinjection",
    "Resultat",
    "SansCle",
    "Statut",
    "identifiant_de",
    "repere",
]
