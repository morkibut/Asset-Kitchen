# -*- coding: utf-8 -*-
"""Les critères de U11 qui se mesurent sur des pixels — le pinceau carré.

La main posait un **disque** à chaque point du tracé, avec des bouts et des
joints arrondis. C'était le bon choix de C4, où elle affinait un masque de
différence sur une image de mille pixels de côté ; elle est depuis devenue la
septième place de la recette, donc un outil qu'on emploie sur le sprite fini.
Sur soixante-quatre pixels de côté, un disque de rayon deux ne produit pas un
bord net : il produit un escalier que personne n'a dessiné.

**Le carré est la forme de l'unité qu'on manipule**, et c'est la seule qui rende
ce que la main croit poser. Le prix est nommé et il se paie une fois : un calque
déjà peint se redessine légèrement différemment — c'est écrit là où la promesse
de déterminisme est écrite, et l'un des essais ci-dessous mesure l'écart au lieu
de le supposer.

L'autre moitié de l'étape — le trait qui tombe là où le pinceau se trouve —
vit dans `interface/src/App.test.tsx` : c'est une affaire de mise en page, pas
de pixels.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.recette import Trait
from atelier.image import traitement as calc


# ── « Le pinceau couvre un carré de côté impair, centré sur le pixel visé » ──


def test_le_pinceau_couvre_un_carre_centre_sur_le_pixel():
    """Le carré fait `2 × rayon + 1` de côté — impair, donc il a un centre, et
    ce centre est le pixel visé. Un côté pair n'aurait pas de pixel central, et
    la main devrait choisir de quel côté pencher."""
    for rayon, cote in ((0, 1), (1, 3), (2, 5), (6, 13)):
        masque = calc.pinceau((41, 41), Trait(garde=True, rayon=rayon, points=((20, 20),)))
        assert masque.sum() == cote * cote, f"rayon {rayon}"
        lignes = np.flatnonzero(masque.any(axis=1))
        colonnes = np.flatnonzero(masque.any(axis=0))
        assert (int(colonnes[0]), int(colonnes[-1])) == (20 - rayon, 20 + rayon)
        assert (int(lignes[0]), int(lignes[-1])) == (20 - rayon, 20 + rayon)
        # Et c'est plein : un carré, pas un cadre.
        assert masque[20 - rayon : 20 + rayon + 1, 20 - rayon : 20 + rayon + 1].all()


def test_le_pinceau_n_est_plus_un_disque_et_l_ecart_est_mesure():
    """**Le coût, mesuré plutôt que supposé.** Un disque de rayon deux couvre
    treize pixels, un carré vingt-cinq : les douze coins que le disque laissait
    sont exactement ce qui change sur un calque déjà peint. C'est le prix, il se
    paie une fois, et il se dit."""
    carre = calc.pinceau((21, 21), Trait(garde=True, rayon=2, points=((10, 10),)))
    # Le disque d'avant, refait ici pour la comparaison — il n'existe plus dans
    # le produit, et c'est bien la raison d'écrire l'écart une fois.
    y, x = np.ogrid[:21, :21]
    disque = (x - 10) ** 2 + (y - 10) ** 2 <= 2**2
    assert carre.sum() == 25
    assert disque.sum() == 13
    assert (carre & ~disque).sum() == 12


def test_le_trait_entre_deux_points_a_des_bouts_carres():
    """Un trait horizontal de rayon deux couvre une bande de cinq pixels de haut
    **et de cinq de plus en longueur** — deux fois le rayon —, parce que le
    carré du bout déborde comme celui du milieu. Un bout arrondi rognerait les
    quatre coins, ce qu'aucune main ne demande sur un sprite."""
    masque = calc.pinceau((21, 21), Trait(garde=True, rayon=2, points=((5, 10), (15, 10))))
    colonnes = np.flatnonzero(masque.any(axis=0))
    lignes = np.flatnonzero(masque.any(axis=1))
    assert (int(colonnes[0]), int(colonnes[-1])) == (3, 17)
    assert (int(lignes[0]), int(lignes[-1])) == (8, 12)
    # Les quatre coins de la bande sont pleins : ils seraient vides avec un bout
    # arrondi.
    assert masque[8, 3] and masque[12, 3] and masque[8, 17] and masque[12, 17]


def test_le_joint_entre_deux_segments_est_carre():
    """Un coude ne creuse pas. Le joint arrondi laissait un liseré au sommet de
    l'angle ; le carré le remplit, parce que c'est un carré posé sur le pixel du
    coude comme sur tous les autres."""
    masque = calc.pinceau(
        (21, 21), Trait(garde=True, rayon=1, points=((5, 5), (15, 5), (15, 15)))
    )
    # Le pixel du coude et ses huit voisins.
    assert masque[4:7, 14:17].all()


# ── « Un clic au bord de l'image marque un pixel du bord » ───────────────────


def test_le_pinceau_se_borne_au_cadre_sans_lever():
    """Rien n'est levé pour un point au bord : le carré est rogné, comme le
    rectangle de C3. Un sprite se peint jusqu'au bord, et c'est le cas courant
    après un recadrage — le sujet touche alors les quatre côtés."""
    masque = calc.pinceau((10, 10), Trait(garde=True, rayon=2, points=((0, 0),)))
    assert masque[0:3, 0:3].all()
    assert masque.sum() == 9
    coin = calc.pinceau((10, 10), Trait(garde=True, rayon=1, points=((9, 9),)))
    assert coin[8:10, 8:10].all()
    assert coin.sum() == 4


# ── « Deux rendus de la même recette donnent le même masque » ────────────────


def test_le_pinceau_carre_reste_pur_et_deterministe():
    """Le critère de T2 ne bouge pas : la forme change, la promesse non. Une
    recette nommée, réappliquée ailleurs, donne exactement le même résultat."""
    trait = Trait(garde=True, rayon=2, points=((3, 3), (12, 9), (12, 3)))
    premier = calc.pinceau((16, 16), trait)
    assert (premier == calc.pinceau((16, 16), trait)).all()

    # **Les points sont reliés, jamais semés** : un geste rapide n'envoie que
    # deux points, et le trait doit quand même être continu.
    saut = calc.pinceau((16, 16), Trait(rayon=0, points=((0, 8), (15, 8))))
    assert saut[8].all()
