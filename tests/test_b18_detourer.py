# -*- coding: utf-8 -*-
"""B18 · Détourer — les cinq moteurs neufs, prouvés sur de vraies images.

Cinq réglages manquaient à l'atelier Détourer (`docs/PLAN-carnet.md` § B18,
`docs/pistes-2026-09-04/carnet/atelier-detourer.dc.html`) :

1. **la couleur déclarée du jeu** — `detourer_bord(..., cible=...)` ;
2. **la teinte plutôt que la valeur** — `detourer_bord`/`detourer_couleur(...,
   teinte=True)` ;
3. **la palette en garde-fou** — le moteur `palette`, `detourer_palette` ;
4. **le pinceau remonté en amont** — `Passe.traits`, appliqué dans `_detourer`
   avant que le masque ne rejoigne l'alpha déjà posé ;
5. **la même passe sur les frames voisines** — `detourer_meme_passe`.

Chaque essai construit une vraie image (un tableau RGB, ou de vrais octets
PNG) et prouve un **résultat sur les pixels**, pas seulement l'absence de
levée — la règle du dépôt (`docs/PIEGES.md`).
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from atelier.domaine.recette import BORD, COULEUR, PALETTE, Passe, Recette, Trait
from atelier.image.traitement import (
    _detourer,
    boite_opaque,
    detourer,
    detourer_bord,
    detourer_couleur,
    detourer_meme_passe,
    detourer_palette,
    raison_moteur,
)


def _png(rgb: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgb, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


# ── 1. La couleur déclarée du jeu ─────────────────────────────────────────────
#
# Le sujet occupe toute la moitié gauche de l'image, colonnes comprises dans
# les deux bordures horizontales : sur les quatre-vingts pixels de bordure, il
# y en a davantage du sujet (44) que du fond (36), et la médiane devinée
# bascule sur la couleur du sujet — exactement le défaut que la planche décrit
# pour « un moulin qui occupe plus de la moitié d'un bord ».


def _image_debordante() -> np.ndarray:
    fond, sujet = (240, 240, 240), (20, 30, 40)
    image = np.full((20, 20, 3), fond, dtype=np.uint8)
    image[:, :12] = sujet
    return image


def test_sans_cible_le_sujet_qui_deborde_inverse_le_detourage():
    """**Le défaut d'avant B18, mesuré.** La médiane devinée sur les bordures
    est tirée vers le sujet, et le remplissage part alors du sujet — il mange
    le sujet et laisse le fond intact, l'exact inverse de ce qu'on veut."""
    image = _image_debordante()
    devine = detourer_bord(image, tolerance=28)
    assert devine[10, 2] == 0, "le sujet est mangé par erreur"
    assert devine[10, 18] == 255, "le fond, lui, reste — inversion complète"


def test_la_couleur_declaree_du_jeu_repare_le_sujet_qui_deborde():
    """**Le réglage neuf.** Viser la couleur écrite au lieu de la deviner ferme
    le cas — le sujet reste, le fond part, quel que soit ce qu'il déborde."""
    image = _image_debordante()
    avec_cible = detourer_bord(image, tolerance=28, cible=(240, 240, 240))
    assert avec_cible[10, 2] == 255, "le sujet reste"
    assert avec_cible[10, 18] == 0, "le fond part"


def test_la_couleur_declaree_traverse_une_vraie_passe():
    """**Bout en bout, sur de vrais octets PNG.** `Passe.couleur_du_jeu` est lu
    par `_detourer`, pas seulement par la fonction nue."""
    image = _image_debordante()
    rgba = np.dstack([image, np.full((20, 20), 255, dtype=np.uint8)])
    passe = Passe(moteur=BORD, tolerance=28, couleur_du_jeu="#F0F0F0")
    sortie = _detourer(rgba, passe)
    assert sortie[10, 2, 3] == 255
    assert sortie[10, 18, 3] == 0


# ── 2. La teinte plutôt que la valeur ─────────────────────────────────────────
#
# Une bande de fond magenta assombrie (même teinte, valeur divisée par le même
# facteur) reste collée au bord, et à tolérance 28 le remplissage par valeur ne
# l'atteint pas — il faudrait monter à 115. La teinte, elle, l'atteint dès
# qu'elle est nulle : les deux magentas ont exactement la même teinte, quelle
# que soit leur luminosité.


def _image_fond_assombri() -> np.ndarray:
    clair, sombre, sujet = (255, 0, 255), (140, 0, 140), (20, 150, 20)
    image = np.full((20, 20, 3), clair, dtype=np.uint8)
    image[:4, :] = sombre  # une bande de fond assombrie, collée au bord du haut
    image[8:16, 6:14] = sujet  # le sujet, une teinte et une valeur très différentes
    return image


def test_par_valeur_le_fond_assombri_reste_a_tort():
    """**Le défaut que la planche décrit** : « à 60 on attrape aussi le rose de
    la joue », et en dessous de l'écart réel — 115 ici — on n'attrape même pas
    l'autre magenta."""
    image = _image_fond_assombri()
    alpha = detourer_bord(image, tolerance=28)
    assert alpha[1, 10] == 255, "le fond assombri reste, à tort — l'écart de valeur est de 115"


def test_par_teinte_le_fond_assombri_part_sans_toucher_au_sujet():
    """**Le réglage neuf.** Même teinte, quelle que soit la valeur : une
    tolérance minime suffit à réunir les deux magentas, et le sujet — d'une
    teinte très différente — ne bouge pas."""
    image = _image_fond_assombri()
    alpha = detourer_bord(image, tolerance=5, teinte=True)
    assert alpha[1, 10] == 0, "le fond assombri part enfin"
    assert alpha[0, 0] == 0, "le fond clair part toujours"
    assert alpha[11, 9] == 255, "le sujet, d'une tout autre teinte, ne bouge pas"


def test_la_pipette_par_teinte_suit_la_meme_regle():
    """**La pipette compare aussi par teinte quand on le lui demande** — le
    même mécanisme, amorcé depuis un point au lieu des bordures."""
    image = _image_fond_assombri()
    alpha = detourer_couleur(image, (10, 0), 5, teinte=True)
    assert alpha[1, 10] == 0
    assert alpha[11, 9] == 255


# ── 3. La palette en garde-fou ────────────────────────────────────────────────
#
# Le fond est « sale » — deux teintes de magenta différentes, ni l'une ni
# l'autre à distance constante d'une cible unique — et le sujet, vert, colle à
# un bord. Aucun autre moteur ne peut promettre qu'il ne le mangera jamais ;
# celui-ci le peut, par construction : le vert est dans la palette.


def _image_fond_sale() -> np.ndarray:
    magenta_a, magenta_b, sujet = (255, 0, 255), (200, 10, 210), (0, 255, 0)
    image = np.full((20, 20, 3), magenta_a, dtype=np.uint8)
    image[10:, :] = magenta_b  # le fond est sale : deux teintes, pas une
    image[0:3, 0:3] = sujet  # le sujet colle même au coin de l'image
    image[14:18, 14:18] = sujet
    return image


def test_le_fond_sale_part_meme_sans_couleur_unique():
    """**Aucune cible unique ne dit ces deux magentas-là** — c'est justement le
    cas que `bord` et `couleur` ne peuvent pas couvrir sans compromis."""
    image = _image_fond_sale()
    alpha = detourer_palette(image, ("#00FF00",), tolerance=10)
    assert alpha[5, 15] == 0, "le premier magenta part"
    assert alpha[15, 5] == 0, "le second magenta part aussi"


def test_le_sujet_ne_peut_pas_partir_meme_colle_au_bord():
    """**La garantie de construction.** Le sujet est vert, il est dans la
    palette, et il colle pourtant au coin de l'image — l'endroit précis d'où
    un autre moteur amorcerait son remplissage."""
    image = _image_fond_sale()
    alpha = detourer_palette(image, ("#00FF00",), tolerance=10)
    assert alpha[1, 1] == 255, "le sujet au coin ne part jamais"
    assert alpha[15, 15] == 255, "ni l'autre, plus loin du bord"


def test_une_passe_sans_palette_ne_retire_rien():
    """**Sans information sur ce qu'il ne faut pas manger, la passe ne mange
    rien** — même règle qu'une pipette non visée (E3)."""
    image = _image_fond_sale()
    alpha = detourer_palette(image, (), tolerance=10)
    assert bool((alpha == 255).all())


def test_la_palette_est_un_moteur_disponible_sans_rien_installer():
    """**Rien à télécharger** : le même remplissage par plages que `bord`, un
    critère différent."""
    assert raison_moteur(PALETTE) is None


def test_le_moteur_palette_traverse_une_vraie_passe():
    """Bout en bout, avec `Passe.palette` posé comme n'importe quel réglage."""
    image = _image_fond_sale()
    rgba = np.dstack([image, np.full((20, 20), 255, dtype=np.uint8)])
    passe = Passe(moteur=PALETTE, tolerance=10, palette=("#00FF00",))
    sortie = _detourer(rgba, passe)
    assert sortie[1, 1, 3] == 255
    assert sortie[5, 15, 3] == 0


# ── 4. Le pinceau remonté en amont ────────────────────────────────────────────
#
# Une esquille isolée — de la couleur du sujet, mais détachée de lui, et non
# reliée à un bord — que le remplissage depuis le bord ne peut pas atteindre.
# Elle grossit la boîte du sujet, donc la case que le recadrage calculera.
# Postée dans la même passe, le pinceau l'ôte avant que quiconque ne mesure
# cette boîte.


def _image_avec_esquille() -> np.ndarray:
    fond, sujet = (240, 240, 240), (20, 30, 40)
    image = np.full((30, 30, 3), fond, dtype=np.uint8)
    image[10:20, 10:20] = sujet  # le sujet
    image[1, 1] = sujet  # une esquille isolée, loin du sujet et du bord
    return image


def test_sans_pinceau_l_esquille_grossit_la_boite_du_sujet():
    image = _image_avec_esquille()
    rgba = np.dstack([image, np.full((30, 30), 255, dtype=np.uint8)])
    sortie = _detourer(rgba, Passe(moteur=BORD, tolerance=28))
    boite = boite_opaque(sortie[:, :, 3])
    assert boite is not None
    assert boite[0] == 1 and boite[1] == 1, "l'esquille reste, et élargit la boîte"


def test_le_pinceau_remonte_efface_l_esquille_dans_la_meme_passe():
    """**Le réglage neuf.** Un seul passage du pinceau, posé sur `Passe.traits`
    au lieu de `Main` — donc *avant* que la boîte du sujet ne soit mesurée."""
    image = _image_avec_esquille()
    rgba = np.dstack([image, np.full((30, 30), 255, dtype=np.uint8)])
    passe = Passe(
        moteur=BORD,
        tolerance=28,
        traits=(Trait(garde=False, rayon=0, points=((1, 1),)),),
    )
    sortie = _detourer(rgba, passe)
    boite = boite_opaque(sortie[:, :, 3])
    assert boite is not None
    assert boite[0] == 10 and boite[1] == 10, "l'esquille est partie, la boîte est celle du sujet seul"
    assert sortie[10, 10, 3] == 255, "le sujet, lui, n'a pas bougé"


def test_le_pinceau_peut_aussi_ramener_un_pixel():
    """`garde=True` ramène, comme sur `Main` — le même vocabulaire, un cran
    plus tôt dans la chaîne."""
    image = _image_avec_esquille()
    rgba = np.dstack([image, np.full((30, 30), 255, dtype=np.uint8)])
    # Une pipette qui efface le sujet entier, puis un pinceau qui en ramène un coin.
    passe = Passe(
        moteur=COULEUR,
        tolerance=5,
        point=(15, 15),
        portee="partout",
        traits=(Trait(garde=True, rayon=0, points=((15, 15),)),),
    )
    sortie = _detourer(rgba, passe)
    assert sortie[15, 15, 3] == 255, "ramené par le pinceau"


# ── 5. La même passe sur les frames voisines ──────────────────────────────────
#
# Deux frames d'une même marche, chacune avec la même flaque de fond enfermée
# au même endroit — le cas que la planche nomme en toutes lettres. Le même
# point, rejoué tel quel, la retire sur les deux à la fois.


def _frame_avec_flaque(matiere: tuple[int, int, int]) -> bytes:
    fond = (240, 240, 240)
    image = np.full((16, 16, 3), matiere, dtype=np.uint8)
    image[0:2, :] = fond
    image[:, 0:2] = fond
    image[:, -2:] = fond
    image[-2:, :] = fond
    image[6:10, 6:10] = fond  # la flaque enfermée, au même endroit sur les deux frames
    return _png(image)


def test_le_meme_geste_rejoue_verbatim_retire_la_flaque_des_deux_frames():
    frames = [_frame_avec_flaque((20, 30, 40)), _frame_avec_flaque((25, 35, 45))]
    passe = Passe(moteur=COULEUR, tolerance=10, point=(7, 7), portee="tache")

    rendus = detourer_meme_passe(passe, frames)

    assert len(rendus) == 2
    for rendu in rendus:
        assert rendu[7, 7, 3] == 0, "la flaque enfermée est partie sur cette frame aussi"
        assert rendu[0, 0, 3] == 255, "le fond du dehors, hors de portée de 'cette tache', reste"


def test_le_meme_geste_ne_modifie_ni_n_ecrit_rien():
    """**Une fonction pure** : elle rend des rendus, elle n'écrit sur le
    disque ni ne modifie les octets qu'on lui a donnés."""
    frame = _frame_avec_flaque((20, 30, 40))
    avant = bytes(frame)
    passe = Passe(moteur=BORD, tolerance=28)

    detourer_meme_passe(passe, [frame])

    assert frame == avant


# ── Bout en bout : une vraie recette, un vrai PNG ─────────────────────────────


def test_les_cinq_reglages_coexistent_dans_une_recette_reelle():
    """**Une recette qui pose les cinq à la fois**, relue et rejouée — la
    preuve qu'ils voyagent ensemble sans se marcher dessus."""
    image = _image_fond_sale()
    octets = _png(image)
    recette = Recette(
        passes=(
            Passe(moteur=PALETTE, tolerance=10, palette=("#00FF00",)),
            Passe(
                moteur=BORD,
                tolerance=5,
                teinte=True,
                couleur_du_jeu="#FF00FF",
                traits=(Trait(garde=False, rayon=0, points=((0, 0),)),),
            ),
        )
    )
    relue = Recette.depuis_json(recette.en_json())
    assert relue == recette

    rgba = detourer(relue, octets)
    assert rgba[1, 1, 3] == 255, "le sujet, protégé par la palette dès la première passe"
