# -*- coding: utf-8 -*-
"""Le traitement d'image — CPU, pur, jamais le GPU.

`mesures` regarde ce qui est arrivé et le rend en PNG ; `traitement` applique une
recette ; `palette` lit une palette dans des artworks ; `decoupe` dit où couper
une planche multi-sprites. Aucun des quatre ne lit ni n'écrit un fichier : ils
reçoivent des octets et en rendent. Le disque, c'est le dépôt ; le réseau, c'est
le fournisseur.
"""

from atelier.image.decoupe import (
    COTE_MIN,
    MARGE,
    Boite,
    decouper,
    en_ordre_de_lecture,
    grille_fixe,
    zones_opaques,
)
from atelier.image.mesures import Mesure, extension, mesurer, rendre_en_png
from atelier.image.palette import COULEURS, COULEURS_MAX, COULEURS_MIN, palette_de
from atelier.image.pliage import gabarit, mesurer_lot
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
    "COTE_MIN",
    "COULEURS",
    "COULEURS_MAX",
    "COULEURS_MIN",
    "Boite",
    "MARGE",
    "Mesure",
    "MoteurAbsent",
    "Rendu",
    "appliquer",
    "decouper",
    "detourer",
    "en_ordre_de_lecture",
    "extension",
    "finir",
    "gabarit",
    "grille_fixe",
    "mesurer",
    "mesurer_grille",
    "mesurer_lot",
    "moteur_disponible",
    "palette_de",
    "raison_moteur",
    "rendre_en_png",
    "zones_opaques",
]
