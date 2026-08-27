# -*- coding: utf-8 -*-
"""Le traitement d'image — CPU, pur, jamais le GPU.

En T1 il ne fait que deux choses : **mesurer** ce qui est arrivé et **rendre en
PNG** ce qui se télécharge. Le recadrage, la pixellisation sur grille, la
quantification et le détourage arrivent en T2 (`docs/PLAN.md`).
"""

from atelier.image.mesures import Mesure, extension, mesurer, rendre_en_png

__all__ = ["Mesure", "extension", "mesurer", "rendre_en_png"]
