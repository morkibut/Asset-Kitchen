# -*- coding: utf-8 -*-
"""Les critères de B18 pour l'atelier *Recadrer* — les six moteurs neufs.

**Décisions tranchées en écrivant cette tranche**, notées ici plutôt que
demandées :

1. *Taille imposée* fait tenir le sujet **dans** `largeur × hauteur` en
   gardant ses proportions (comme `object-fit: contain`), jamais étiré — la
   planche dit « agrandi ou réduit pour tenir », pas « déformé ».
2. *Format verrouillé* ne rétrécit jamais le rectangle déjà décidé par le
   sujet, la boîte tracée ou la marge : il grandit l'axe le plus court pour
   tenir le rapport, borné par l'image.
3. *Calage sur un multiple* n'avance que les bords bas et droit — le coin
   haut-gauche, qui porte déjà la marge et le format, ne bouge pas.
4. *Centré sur la masse* n'a d'effet que sur la taille imposée, quand elle
   laisse un espace vide sur un seul axe : c'est le seul endroit du recadrage
   où un espace se répartit plutôt que de se couper.
5. *Ligne de pied* déplace le rectangle sans changer sa hauteur.
6. *Rognage d'un bord uni* cherche le sujet par couleur et sert de recours
   quand l'image n'a pas d'alpha utile (`boite_hors_bord_uni`), sans jamais
   remplacer `boite_opaque` quand l'alpha existe.

**Aucun essai de ce fichier ne coûte un centime** : les six moteurs sont du
calcul local sur des tableaux `numpy`, comme les quatre de B17.
"""

from __future__ import annotations

import time

import numpy as np
import pytest

from atelier.domaine.recette import (
    CARRE,
    DEUX_POUR_UN,
    FORMAT_LIBRE,
    FORMATS_DE_RECADRAGE,
    MULTIPLES_DE_CALAGE,
    Recadrage,
    Recette,
    format_connu,
    multiple_connu,
)
from atelier.image.traitement import (
    _ajuster_au_format,
    _caler_sur_ligne_de_pied,
    _caler_sur_multiple,
    _recadrer,
    avant_la_grille,
    boite_hors_bord_uni,
    boite_opaque,
    centre_de_masse,
)

BRUN = (107, 90, 68)
BLANC = (255, 255, 255)
MAGENTA = (255, 0, 255)


def chronometre(fonction, *args, tours: int = 5, **kwargs) -> float:
    """Le meilleur des `tours`, en millisecondes — même règle que `test_b17.py`."""
    durees = []
    for _ in range(tours):
        depart = time.perf_counter()
        fonction(*args, **kwargs)
        durees.append((time.perf_counter() - depart) * 1000)
    return min(durees)


def sujet_rectangulaire(cote: int = 64, largeur_sujet: int = 20, hauteur_sujet: int = 50) -> np.ndarray:
    """Une image détourée : un rectangle opaque brun, centré, sur du vide."""
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    x0 = (cote - largeur_sujet) // 2
    y0 = (cote - hauteur_sujet) // 2
    image[y0 : y0 + hauteur_sujet, x0 : x0 + largeur_sujet, :3] = BRUN
    image[y0 : y0 + hauteur_sujet, x0 : x0 + largeur_sujet, 3] = 255
    return image


def garde_avec_hallebarde(cote: int = 80) -> np.ndarray:
    """**Le garde de la planche** : un corps carré au centre, et une
    hallebarde fine qui dépasse loin sur la droite — assez fine pour peser peu
    dans le centre de masse, assez longue pour déplacer la boîte."""
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    corps = slice(cote // 2 - 10, cote // 2 + 10)
    image[corps, cote // 2 - 10 : cote // 2 + 10, :3] = BRUN
    image[corps, cote // 2 - 10 : cote // 2 + 10, 3] = 255
    # La hallebarde : deux pixels de haut, du bord du corps jusqu'au bord de
    # l'image — un poids négligeable à côté du carré du corps (400 px² contre
    # 2×30 = 60 px²).
    image[cote // 2 - 1 : cote // 2 + 1, cote // 2 + 10 : cote, :3] = BRUN
    image[cote // 2 - 1 : cote // 2 + 1, cote // 2 + 10 : cote, 3] = 255
    return image


def image_a_bord_uni(cote: int = 40, bord: int = 6) -> np.ndarray:
    """**Une image jamais détourée** : opaque partout, un bord blanc uni, un
    sujet brun au centre. `boite_hors_bord_uni` est ce qui rend cette image
    recadrable sans passer par le détourage d'abord."""
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    image[:, :, :3] = BLANC
    image[:, :, 3] = 255
    image[bord:-bord, bord:-bord, :3] = BRUN
    return image


# ── 1. Un cadre de taille imposée ────────────────────────────────────────────


def test_taille_imposee_rend_exactement_les_dimensions_demandees():
    rgba = sujet_rectangulaire(cote=64, largeur_sujet=20, hauteur_sujet=50)
    recadrage = Recadrage(taille=(96, 64))
    rendu = _recadrer(rgba, recadrage)
    assert rendu.shape == (64, 96, 4)


def test_taille_imposee_garde_les_proportions_sans_etirer():
    """Le sujet, 20×50, entre dans une case de 100×100 : il doit ressortir à
    40×100 — le côté long touche le bord, le court laisse du vide — et non
    étiré à 100×100."""
    rgba = sujet_rectangulaire(cote=64, largeur_sujet=20, hauteur_sujet=50)
    recadrage = Recadrage(boite=(22, 7, 41, 56), taille=(100, 100))  # boîte = 20×50 pile
    rendu = _recadrer(rgba, recadrage)
    colonnes_opaques = np.flatnonzero(rendu[:, :, 3].any(axis=0))
    lignes_opaques = np.flatnonzero(rendu[:, :, 3].any(axis=1))
    largeur_rendue = colonnes_opaques[-1] - colonnes_opaques[0] + 1
    hauteur_rendue = lignes_opaques[-1] - lignes_opaques[0] + 1
    # Le sujet touche les bords haut et bas (échelle 100/50 = 2) et laisse du
    # vide à gauche et à droite (20×2 = 40 sur 100).
    assert hauteur_rendue >= 96
    assert 30 <= largeur_rendue <= 50


# ── 2. Le format verrouillé ──────────────────────────────────────────────────


def test_format_verrouille_grandit_lauteur_pour_un_carre():
    boite = (10, 10, 29, 39)  # 20 × 30
    ajustee = _ajuster_au_format(boite, CARRE, largeur=100, hauteur=100)
    x0, y0, x1, y1 = ajustee
    assert x1 - x0 + 1 == y1 - y0 + 1 == 30
    # Centré sur le centre d'origine — (19.5, 24.5) — donc la fenêtre ne
    # décale pas le rectangle d'origine hors de sa moitié.
    assert x0 <= 10 and x1 >= 29


def test_format_libre_ou_inconnu_ne_change_rien():
    boite = (10, 10, 29, 39)
    assert _ajuster_au_format(boite, FORMAT_LIBRE, 100, 100) == boite
    assert _ajuster_au_format(boite, "6:9-panoramique", 100, 100) == boite
    assert format_connu("6:9-panoramique") == FORMAT_LIBRE
    assert format_connu(DEUX_POUR_UN) == DEUX_POUR_UN


def test_format_verrouille_est_borne_par_limage():
    # Un rectangle déjà collé au bord ne peut pas grandir davantage : le
    # rapport cède plutôt que de sortir du cadre.
    ajustee = _ajuster_au_format((0, 0, 9, 9), CARRE, largeur=10, hauteur=10)
    assert ajustee == (0, 0, 9, 9)


# ── 3. Calage sur un multiple ────────────────────────────────────────────────


def test_calage_sur_multiple_avance_le_bord_bas_et_droit():
    boite = (0, 0, 17, 17)  # 18 × 18
    calee = _caler_sur_multiple(boite, 16, largeur=64, hauteur=64)
    x0, y0, x1, y1 = calee
    assert (x0, y0) == (0, 0)
    assert (x1 - x0 + 1) % 16 == 0
    assert (y1 - y0 + 1) % 16 == 0
    assert x1 - x0 + 1 >= 18


def test_aucun_calage_a_zero_ou_un():
    boite = (3, 5, 20, 22)
    assert _caler_sur_multiple(boite, 0, 64, 64) == boite
    assert _caler_sur_multiple(boite, 1, 64, 64) == boite


def test_multiple_connu_retombe_sur_zero():
    assert multiple_connu(16) == 16
    assert multiple_connu(7) == 0
    assert multiple_connu(None) == 0
    assert set(MULTIPLES_DE_CALAGE) == {0, 8, 16, 32}


# ── 4. Centré sur la masse ───────────────────────────────────────────────────


def test_centre_de_masse_reste_pres_du_corps_malgre_la_hallebarde():
    rgba = garde_avec_hallebarde(cote=80)
    boite = boite_opaque(rgba[:, :, 3])
    assert boite is not None
    x0, y0, x1, y1 = boite
    centre_boite = (x0 + x1) / 2
    cx, _cy = centre_de_masse(rgba[:, :, 3])
    # Le centre du corps est à 40 (cote/2) ; le centre de la boîte est tiré
    # vers la hallebarde, bien plus à droite. La masse doit rester nettement
    # plus proche du corps que la boîte ne l'est.
    assert abs(cx - 40) < abs(centre_boite - 40)


def test_centre_de_masse_dune_image_vide_retombe_au_milieu():
    vide = np.zeros((30, 50), dtype=np.uint8)
    assert centre_de_masse(vide) == (25.0, 15.0)


def test_masse_centre_le_corps_quand_la_taille_imposee_laisse_un_ecart():
    """Sur une case bien plus large que haute, un rectangle centré sur le
    rectangle géométrique et un rectangle centré sur la masse ne posent pas le
    corps au même endroit.

    **Le rectangle géométrique centre déjà toute la boîte par construction**
    — c'est ce que `loger_dans` fait sans `masse` —, donc mesurer l'étendue
    opaque entière ne distinguerait rien. Ce qui doit bouger, c'est le
    **centre de gravité** du sujet dans la case rendue : avec `masse=True`, il
    doit tomber près du milieu de la case ; sans elle, il reste décalé du côté
    de la hallebarde, exactement comme dans l'image d'origine.
    """
    rgba = garde_avec_hallebarde(cote=80)
    boite = boite_opaque(rgba[:, :, 3])
    recadre = rgba[boite[1] : boite[3] + 1, boite[0] : boite[2] + 1]

    sans_masse = _recadrer(recadre, Recadrage(taille=(200, 40)))
    avec_masse = _recadrer(recadre, Recadrage(taille=(200, 40), masse=True))

    milieu = 100
    cx_sans, _ = centre_de_masse(sans_masse[:, :, 3])
    cx_avec, _ = centre_de_masse(avec_masse[:, :, 3])
    assert abs(cx_avec - milieu) < abs(cx_sans - milieu)


# ── 5. Ligne de pied ─────────────────────────────────────────────────────────


def test_ligne_de_pied_deplace_sans_changer_la_hauteur():
    boite = (5, 5, 24, 44)  # hauteur 40
    calee = _caler_sur_ligne_de_pied(boite, ligne_pied=60, hauteur=100)
    x0, y0, x1, y1 = calee
    assert y1 == 60
    assert y1 - y0 + 1 == 40
    assert (x0, x1) == (5, 24)


def test_ligne_de_pied_bornee_par_le_haut_de_limage():
    boite = (0, 5, 10, 44)  # hauteur 40
    calee = _caler_sur_ligne_de_pied(boite, ligne_pied=10, hauteur=100)
    assert calee[1] == 0  # ne peut pas remonter avant le bord haut
    assert calee[3] == 10


def test_ligne_de_pied_bout_en_bout_sur_une_vraie_image():
    rgba = sujet_rectangulaire(cote=64, largeur_sujet=20, hauteur_sujet=30)
    recadrage = Recadrage(ligne_pied=50)
    rendu = _recadrer(rgba, recadrage)
    # Le rectangle mesure 30 px de haut (sujet) et se cale sur la ligne 50 :
    # il va donc de 21 à 50.
    assert rendu.shape[0] == 30


# ── 6. Rognage d'un bord de couleur unie ─────────────────────────────────────


def test_boite_hors_bord_uni_trouve_le_sujet_sans_alpha():
    rgba = image_a_bord_uni(cote=40, bord=6)
    assert bool(rgba[:, :, 3].all())  # aucune transparence : le cas visé
    boite = boite_hors_bord_uni(rgba[:, :, :3])
    assert boite == (6, 6, 33, 33)


def test_bord_uni_dune_seule_couleur_ne_trouve_rien():
    plate = np.zeros((20, 20, 3), dtype=np.uint8)
    plate[:, :] = BLANC
    assert boite_hors_bord_uni(plate) is None


def test_recadrer_bord_uni_agit_sur_une_image_jamais_detouree():
    rgba = image_a_bord_uni(cote=40, bord=6)
    recadrage = Recadrage(bord_uni=True)
    rendu = _recadrer(rgba, recadrage)
    assert rendu.shape == (28, 28, 4)
    assert tuple(rendu[0, 0, :3]) == BRUN


def test_sans_bord_uni_une_image_opaque_ne_se_recadre_pas():
    """Le comportement d'avant B18 est intact : sans `bord_uni`, une image
    sans transparence n'a rien à recadrer et ressort telle quelle."""
    rgba = image_a_bord_uni(cote=40, bord=6)
    rendu = _recadrer(rgba, Recadrage())
    assert rendu.shape == rgba.shape


# ── Bout en bout, par la recette entière ─────────────────────────────────────


def test_avant_la_grille_applique_les_six_reglages_ensemble():
    """Une recette qui pose les six réglages à la fois, sur une vraie image —
    le critère « chaque moteur porte sa mesure » et « fonctionne sur une
    image réelle » réunis."""
    rgba = sujet_rectangulaire(cote=64, largeur_sujet=20, hauteur_sujet=30)
    recette = Recette(
        recadrage=Recadrage(
            marge=2,
            multiple=8,
            format=CARRE,
            taille=(48, 48),
            masse=True,
        )
    )
    rendu = avant_la_grille(rgba, recette)
    assert rendu.shape == (48, 48, 4)
    assert rendu[:, :, 3].any()


# ── Le neutre ne s'écrit pas (B1, descendue par B17 puis B18) ────────────────


def test_les_six_reglages_neutres_ne_changent_pas_lempreinte():
    """Le critère qui ne se voit pas : une `Recadrage()` neuve doit sérialiser
    à l'identique d'avant B18, sans quoi toutes les recettes du disque qui
    portent un recadrage changeraient d'empreinte."""
    neutre = Recadrage(marge=3, boite=(1, 2, 3, 4))
    assert neutre.en_json() == {"marge": 3, "boite": [1, 2, 3, 4]}


def test_les_six_reglages_ronde_trip_par_json():
    pose = Recadrage(
        marge=1,
        taille=(32, 40),
        format=CARRE,
        multiple=16,
        masse=True,
        ligne_pied=12,
        bord_uni=True,
    )
    relu = Recadrage.depuis_json(pose.en_json())
    assert relu == pose


def test_une_recette_ecrite_avant_b18_se_relit_sans_perte():
    ancienne = {"marge": 5, "boite": None}
    relue = Recadrage.depuis_json(ancienne)
    assert relue == Recadrage(marge=5)


# ── Combien de temps, sur une vraie image ────────────────────────────────────


def test_chaque_moteur_reste_tres_en_dessous_de_240_ms():
    """**Chaque moteur neuf porte sa mesure de temps** — le critère de B18.
    Sur un sprite de 512 px, très au-dessus de ce qu'un personnage demande."""
    grand = sujet_rectangulaire(cote=512, largeur_sujet=180, hauteur_sujet=420)

    mesures = {
        "taille imposée": chronometre(_recadrer, grand, Recadrage(taille=(64, 64))),
        "format verrouillé": chronometre(_recadrer, grand, Recadrage(format=CARRE)),
        "calage sur multiple": chronometre(_recadrer, grand, Recadrage(multiple=16)),
        "centré sur la masse": chronometre(centre_de_masse, grand[:, :, 3]),
        "ligne de pied": chronometre(_recadrer, grand, Recadrage(ligne_pied=400)),
        "bord uni": chronometre(boite_hors_bord_uni, grand[:, :, :3]),
    }
    for nom, ms in mesures.items():
        assert ms < 240, f"{nom} met {ms:.1f} ms — au-delà du seuil que l'écran annonce"
