# -*- coding: utf-8 -*-
"""Les objets et les règles du produit. Aucune dépendance sortante.

Rien ici ne connaît FastAPI, SQLite, httpx, ni le vocabulaire d'un fournisseur.
"""

from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.consommation import (
    ICI,
    JETON,
    LU,
    USD,
    Compte,
    Reserve,
    accorde,
    argent,
    est_argent,
)
from atelier.domaine.demande import Demande
from atelier.domaine.envoi import (
    Couches,
    Tri,
    clef,
    joindre,
    parties,
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
from atelier.domaine.projet import (
    NOM_BAC_A_SABLE,
    Collection,
    Membre,
    Projet,
    repere,
)
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
    "Compte",
    "Couches",
    "Demande",
    "Emplacement",
    "ErreurAtelier",
    "Generation",
    "Geometrie",
    "Grille",
    "Membre",
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
    "Reserve",
    "Resultat",
    "SansCle",
    "Statut",
    "Tri",
    "ICI",
    "JETON",
    "LU",
    "USD",
    "accorde",
    "argent",
    "clef",
    "est_argent",
    "geometrie",
    "identifiant_de",
    "joindre",
    "parties",
    "resoudre",
    "repere",
]
