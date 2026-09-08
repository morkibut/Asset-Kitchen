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
    gouttieres,
    grille_fixe,
    zones_opaques,
)
from atelier.image.mesures import (
    Mesure,
    empreinte_de,
    extension,
    mesurer,
    rendre_en_png,
    vignette,
)
from atelier.image.palette import (
    COULEURS,
    COULEURS_MAX,
    COULEURS_MIN,
    alpha_du_sujet,
    apercu_de_la_lecture,
    part_lue,
    bande_de_palette,
    palette_de,
)
from atelier.image.taches import (
    Tache,
    crans_occupation,
    poches_de_fond,
    taches,
    trous,
)
from atelier.image.pliage import gabarit, mesurer_lot
from atelier.image.traitement import (
    GrilleRetrouvee,
    MesuresDuFond,
    MoteurAbsent,
    Rendu,
    appliquer,
    detourer,
    en_rendu,
    finir,
    mesurer_grille,
    mesures_du_fond,
    moteur_disponible,
    raison_moteur,
    retrouver_grille,
)

__all__ = [
    "COTE_MIN",
    "GrilleRetrouvee",
    "Tache",
    "crans_occupation",
    "poches_de_fond",
    "trous",
    "taches",
    "COULEURS",
    "COULEURS_MAX",
    "COULEURS_MIN",
    "alpha_du_sujet",
    "apercu_de_la_lecture",
    "part_lue",
    "Boite",
    "MARGE",
    "Mesure",
    "MesuresDuFond",
    "MoteurAbsent",
    "Rendu",
    "appliquer",
    "bande_de_palette",
    "decouper",
    "empreinte_de",
    "detourer",
    "en_ordre_de_lecture",
    "extension",
    "en_rendu",
    "finir",
    "gabarit",
    "gouttieres",
    "grille_fixe",
    "mesurer",
    "mesurer_grille",
    "mesurer_lot",
    "mesures_du_fond",
    "moteur_disponible",
    "palette_de",
    "raison_moteur",
    "rendre_en_png",
    "retrouver_grille",
    "vignette",
    "zones_opaques",
]
