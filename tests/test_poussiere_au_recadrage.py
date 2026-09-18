# -*- coding: utf-8 -*-
"""Une poussière isolée ne décide pas du recadrage (18 septembre 2026).

La course nord de Champy sortait deux fois trop petite : la première image du
clip gardait deux pixels bleus dans les coins, le recadrage prenait l'image
entière, et la fenêtre commune du clip avec lui. Aucun essai ne coûte un centime.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.recette import Recadrage
from atelier.image.traitement import _recadrer, boite_du_sujet


def _image(largeur: int = 100, hauteur: int = 120) -> np.ndarray:
    rgba = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    rgba[40:90, 30:60] = (120, 80, 40, 255)  # le sujet, 30 × 50
    return rgba


def test_un_pixel_dans_un_coin_ne_compte_pas():
    rgba = _image()
    rgba[0, 99] = (0, 0, 220, 255)
    rgba[119, 99] = (44, 44, 255, 255)
    assert boite_du_sujet(rgba[:, :, 3]) == (30, 40, 59, 89)
    assert _recadrer(rgba, Recadrage()).shape[:2] == (50, 30)


def test_une_tache_qui_compte_reste_dans_la_boite():
    rgba = _image()
    rgba[0:3, 95:98] = (0, 0, 220, 255)  # neuf pixels : plus qu'une poussière
    assert boite_du_sujet(rgba[:, :, 3]) == (30, 0, 97, 89)


def test_un_sujet_fait_de_poussieres_les_garde():
    rgba = np.zeros((20, 20, 4), dtype=np.uint8)
    rgba[2, 3, 3] = 255
    rgba[15, 17, 3] = 255
    assert boite_du_sujet(rgba[:, :, 3]) == (3, 2, 17, 15)
