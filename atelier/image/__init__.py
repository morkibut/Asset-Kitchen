# -*- coding: utf-8 -*-
"""Le traitement d'image — CPU, pur, jamais le GPU.

`mesures` regarde ce qui est arrivé et le rend en PNG ; `traitement` applique une
recette. Aucun des deux ne lit ni n'écrit un fichier : ils reçoivent des octets et
en rendent. Le disque, c'est le dépôt ; le réseau, c'est le fournisseur.
"""

from atelier.image.mesures import Mesure, extension, mesurer, rendre_en_png
from atelier.image.traitement import (
    MoteurAbsent,
    Rendu,
    appliquer,
    detourer,
    finir,
    mesurer_grille,
    moteur_disponible,
    raison_moteur,
)

__all__ = [
    "Mesure",
    "MoteurAbsent",
    "Rendu",
    "appliquer",
    "detourer",
    "extension",
    "finir",
    "mesurer",
    "mesurer_grille",
    "moteur_disponible",
    "raison_moteur",
    "rendre_en_png",
]
