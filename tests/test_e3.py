# -*- coding: utf-8 -*-
"""Les critères de E3 qui se mesurent sur des pixels — le châssis des tables.

Onze des quatorze critères de la tranche portent sur ce que l'écran montre et
vivent dans `interface/src/App.test.tsx`. Les trois qui restent sont des
**mesures sur l'image**, et c'est le serveur qui les prend : les taches que le
nettoyage des bords va effacer, les poches de fond que le sujet enferme, et les
crans d'occupation où la remise sur grille change vraiment quelque chose.

**Aucun test de ce fichier ne lit un fichier ni n'appelle le fournisseur** : ils
travaillent sur des tableaux construits à la main, parce que ce qu'ils vérifient
est une propriété des fonctions, pas d'une image particulière.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.recette import Grille
from atelier.image.taches import crans_occupation, poches, taches


def _vide(cote: int = 16) -> np.ndarray:
    return np.zeros((cote, cote, 4), dtype=np.uint8)


def _poser(rgba: np.ndarray, x0: int, y0: int, x1: int, y1: int, couleur=(200, 100, 50)):
    rgba[y0 : y1 + 1, x0 : x1 + 1, :3] = couleur
    rgba[y0 : y1 + 1, x0 : x1 + 1, 3] = 255


# ── « L'aire minimale liste les taches qu'elle va effacer, triées » ───────────


def test_les_taches_se_listent_de_la_plus_petite_a_la_plus_grande():
    """L'ordre est la moitié de la réponse.

    Le nettoyage des bords efface **en dessous d'un seuil** : ce qu'on veut lire
    d'abord est donc ce qui partira en premier. Une liste triée par position
    obligerait à chercher des yeux la plus petite, qui est précisément celle qui
    décide du seuil.
    """
    image = _vide()
    _poser(image, 1, 1, 1, 1)  # 1 pixel
    _poser(image, 4, 4, 5, 5)  # 4 pixels
    _poser(image, 8, 8, 12, 12)  # 25 pixels

    trouvees = taches(image)
    assert [t.aire for t in trouvees] == [1, 4, 25]


def test_le_sujet_lui_meme_figure_dans_la_liste():
    """Le taire ferait croire qu'il y a douze taches là où il y en a treize.

    Le sujet est une tache comme les autres — la plus grande —, et c'est
    justement ce qui permet de lire le seuil comme un rang : « en dessous de
    quatre pixels, j'efface les trois premières et je garde les deux autres ».
    """
    image = _vide()
    _poser(image, 0, 0, 9, 9)  # le sujet
    _poser(image, 14, 14, 14, 14)  # une poussière

    assert [t.aire for t in taches(image)] == [1, 100]


def test_une_tache_porte_sa_boite_et_sa_couleur():
    """De quoi la désigner à l'œil, et de quoi retirer toutes celles de sa
    couleur d'un geste — sans que l'écran ait à redescendre les pixels."""
    image = _vide()
    _poser(image, 3, 5, 6, 8, couleur=(20, 40, 60))

    (tache,) = taches(image)
    assert tache.boite == (3, 5, 6, 8)
    assert tache.couleur == "#14283c"


def test_la_liste_se_coupe_et_le_dit():
    """Une image bruitée peut porter des milliers de taches d'un pixel.

    La liste sert à **regarder** : la couper est nécessaire, la couper en
    silence ne l'est pas. Le plafond se demande, et le compte de ce qui manque
    se lit ailleurs — ici on vérifie seulement que le plafond tient.
    """
    image = _vide(32)
    for i in range(0, 32, 2):
        for j in range(0, 32, 2):
            _poser(image, i, j, i, j)

    assert len(taches(image, plafond=10)) == 10


# ── « Le détourage propose les poches de fond enfermées, cerclées et comptées,
#     et n'en efface aucune de lui-même » ──────────────────────────────────────


def test_une_poche_enfermee_par_le_sujet_est_trouvee():
    """La lumière entre un bras et un torse, le trou d'une anse, l'intérieur
    d'un anneau. Le détourage par tolérance de bord ne les atteint pas : elles
    restent, et le produit ne décide pas à la place de l'auteur."""
    image = _vide()
    _poser(image, 2, 2, 13, 13)  # un anneau plein…
    image[6:10, 6:10, 3] = 0  # …percé en son milieu

    (poche,) = poches(image)
    assert poche.aire == 16
    assert poche.boite == (6, 6, 9, 9)


def test_le_fond_qui_touche_un_bord_n_est_pas_une_poche():
    """C'est la définition même : une zone transparente qui touche un bord est
    le fond ordinaire, déjà parti. Celle qui n'en touche aucun est enfermée."""
    image = _vide()
    _poser(image, 4, 4, 11, 11)  # un sujet au milieu, du fond tout autour

    assert poches(image) == []


def test_deux_poches_se_lisent_de_la_plus_grande_a_la_plus_petite():
    """L'ordre inverse de celui des taches, et pour la raison inverse : une
    poche ne s'efface pas sous un seuil, elle se regarde. La plus grande est
    celle dont on se demande d'abord si c'est du fond ou de la matière."""
    image = _vide(20)
    _poser(image, 1, 1, 18, 18)
    image[3:5, 3:5, 3] = 0  # 4 pixels
    image[10:15, 10:15, 3] = 0  # 25 pixels

    assert [p.aire for p in poches(image)] == [25, 4]


def test_aucune_poche_n_est_effacee():
    """Le critère en toutes lettres : **cerclées et comptées, jamais effacées
    seules**. La fonction décrit, elle ne touche pas au tableau qu'on lui donne."""
    image = _vide()
    _poser(image, 2, 2, 13, 13)
    image[6:10, 6:10, 3] = 0
    avant = image.copy()

    poches(image)
    assert np.array_equal(image, avant)


# ── « Le curseur d'occupation ne s'arrête que là où l'image change » ──────────


def test_les_crans_d_occupation_ne_gardent_que_ce_qui_change():
    """Quatre-vingt-onze positions pour une trentaine de tailles possibles.

    Sur une cible de 64 pixels, deux occupations voisines donnent souvent la
    même taille de sujet — donc la même image. Le curseur s'arrêtait quand même
    à chacune, et la main croyait régler quelque chose.
    """
    image = _vide()
    _poser(image, 4, 4, 11, 11)

    crans = crans_occupation(image, Grille(cible=16))
    # Sur une cible de 16, il n'y a que seize tailles entières possibles — et
    # l'occupation commence à 10 %, donc moins encore.
    assert len(crans) < 91
    assert crans[0] == 10
    # Chaque cran donne une taille que le précédent ne donnait pas.
    tailles = [round(16 * c / 100) for c in crans]
    assert len(tailles) == len(set(tailles))


def test_une_cible_plus_fine_laisse_plus_de_crans():
    """C'est la propriété qui rend la mesure utile : elle suit l'image, elle
    n'est pas un nombre choisi une fois."""
    image = _vide()
    _poser(image, 4, 4, 11, 11)

    assert len(crans_occupation(image, Grille(cible=128))) > len(
        crans_occupation(image, Grille(cible=16))
    )


def test_une_image_sans_sujet_n_a_aucun_cran():
    """Zéro n'est pas une valeur d'occupation, c'est l'absence de sujet — et le
    produit ne rend pas une liste de crans pour une image vide."""
    assert crans_occupation(_vide(), Grille(cible=64)) == []
