# -*- coding: utf-8 -*-
"""Les objets et les règles du produit. Aucune dépendance sortante.

Rien ici ne connaît FastAPI, SQLite, httpx, ni le vocabulaire d'un fournisseur.
"""

from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.demande import Demande
from atelier.domaine.envoi import (
    Couches,
    Tri,
    clef,
    en_blocs,
    joindre,
    resoudre,
)
from atelier.domaine.erreurs import ErreurAtelier, ModeleInconnu, SansCle
from atelier.domaine.generation import (
    ROLES,
    Emplacement,
    Generation,
    Reinjection,
    Resultat,
    Statut,
)
from atelier.domaine.pliage import CasePliee, Geometrie, MesuresLot, Pliage, geometrie
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
    "CasePliee",
    "Collection",
    "Couches",
    "Demande",
    "Emplacement",
    "ErreurAtelier",
    "Generation",
    "Geometrie",
    "Grille",
    "MesuresLot",
    "Modele",
    "ModeleInconnu",
    "Option",
    "Passe",
    "Pliage",
    "Projet",
    "Quantification",
    "ROLES",
    "Recadrage",
    "Recette",
    "Reinjection",
    "Resultat",
    "SansCle",
    "Statut",
    "Tri",
    "clef",
    "en_blocs",
    "geometrie",
    "identifiant_de",
    "joindre",
    "resoudre",
    "repere",
]
