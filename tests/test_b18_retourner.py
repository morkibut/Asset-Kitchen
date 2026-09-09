# -*- coding: utf-8 -*-
"""B18 — Retourner : les neuf moteurs neufs, au-dessus du miroir de B1.

`docs/pistes-2026-09-04/carnet/atelier-retourner.dc.html` en dessine dix — un
seul, le miroir gauche-droite, était livré par `B1`. Les neuf autres :

    haut-bas, quart de tour à droite, quart de tour à gauche, demi-tour,
    diagonale, repli (miroir sur soi), sauf-zones (miroir, sauf ici),
    angle-libre (rotation au plus proche), rotsprite (RotSprite)

**Une ambiguïté du plan, tranchée ici et redite dans `atelier/domaine/recette.py`
et dans le commit** : `docs/PLAN-carnet.md` § B18 compte huit noms pour neuf
moteurs — « quarts de tour » y est écrit au pluriel parce qu'il en désigne
deux, le droit et le gauche. La planche et `SENS_A_AJOUTER` (posé par `B1`,
et vivant dans `interface/src/recette.ts` depuis B26) comptaient déjà
les dix noms séparément ; c'est cette liste-là qui fait foi.

**Aucun de ces essais ne coûte un centime** : les neuf moteurs sont des
fonctions pures, comme le miroir de B1.
"""

from __future__ import annotations

import io
import time

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.recette import (
    ANGLE_LIBRE,
    DEMI_TOUR,
    DIAGONALE,
    DROITE,
    GAUCHE,
    GAUCHE_DROITE,
    HAUT_BAS,
    QUART_DROITE,
    QUART_GAUCHE,
    REPLI,
    ROTSPRITE,
    SAUF_ZONES,
    SENS,
    Recette,
    Retournement,
    Trait,
)
from atelier.image.traitement import queue, retourner


# ── De quoi construire une image dont aucun des dix sens ne rend la même
#    image que le départ ────────────────────────────────────────────────────


def _rectangle_dissymetrique(largeur: int = 20, hauteur: int = 14) -> np.ndarray:
    """Ni carré (pour distinguer largeur et hauteur après un quart de tour), ni
    symétrique sur un axe (pour qu'aucun sens ne rende accidentellement
    l'image de départ). Entièrement opaque, pour que la comparaison porte sur
    la couleur seule."""
    rgba = np.empty((hauteur, largeur, 4), dtype=np.uint8)
    rgba[:, :] = (20, 20, 20, 255)
    rgba[2:6, 2:8] = (200, 40, 40, 255)  # un bloc rouge, en haut à gauche
    rgba[hauteur - 4 : hauteur - 1, largeur - 6 : largeur - 2] = (40, 40, 200, 255)
    rgba[1, largeur - 2] = (250, 240, 30, 255)  # un pixel qui n'est nulle part ailleurs
    return rgba


def _palette(rgba: np.ndarray) -> set[tuple[int, ...]]:
    """Les couleurs présentes, sans leur position — aucun des dix sens n'en
    invente une, même ceux qui changent les dimensions du rendu."""
    return {tuple(int(v) for v in pixel) for pixel in rgba.reshape(-1, 4)}


# ── « La liste des sens du domaine et celle de l'écran comptent le même
#     total, et B18 ferme la file » ─────────────────────────────────────────


def test_les_neuf_moteurs_neufs_completent_la_liste_des_sens():
    assert len(SENS) == 10
    assert SENS[0] == GAUCHE_DROITE, "le premier sens reste celui de B1, en tête"
    assert set(SENS) == {
        GAUCHE_DROITE,
        HAUT_BAS,
        QUART_DROITE,
        QUART_GAUCHE,
        DEMI_TOUR,
        DIAGONALE,
        REPLI,
        SAUF_ZONES,
        ANGLE_LIBRE,
        ROTSPRITE,
    }


# ── « Les huit premiers sens ne réinventent aucun pixel — seulement, ils les
#     rangent autrement » ───────────────────────────────────────────────────


def test_miroir_haut_bas_retourne_verticalement():
    depart = _rectangle_dissymetrique()
    rendu = retourner(depart, Retournement(sens=HAUT_BAS))

    assert rendu.shape == depart.shape
    assert np.array_equal(rendu, np.flipud(depart))
    assert _palette(rendu) == _palette(depart)
    assert not np.array_equal(rendu, depart), "rien n'a été retourné"


def test_deux_miroirs_haut_bas_rendent_l_image_de_depart():
    """La même involution que le miroir gauche-droite de B1 (`test_b1.py`),
    tenue ici pour le second axe."""
    depart = _rectangle_dissymetrique()
    recette = Recette(retournement=Retournement(sens=HAUT_BAS))

    une_fois = queue(depart, recette)
    deux_fois = queue(une_fois, recette)

    assert np.array_equal(deux_fois, depart)


@pytest.mark.parametrize("sens", [QUART_DROITE, QUART_GAUCHE])
def test_un_quart_de_tour_echange_largeur_et_hauteur(sens):
    """« Une image large devient haute » (la planche). C'est le seul effet
    dimensionnel des dix sens, avec la diagonale."""
    depart = _rectangle_dissymetrique(largeur=20, hauteur=14)
    rendu = retourner(depart, Retournement(sens=sens))

    assert rendu.shape == (20, 14, 4)
    assert _palette(rendu) == _palette(depart)


def test_quart_a_droite_puis_quart_a_gauche_rendent_l_image_de_depart():
    """Les deux quarts de tour sont réciproques l'un de l'autre — pas chacun
    sa propre réciproque, à la différence des huit autres sens."""
    depart = _rectangle_dissymetrique()
    a_droite = retourner(depart, Retournement(sens=QUART_DROITE))
    retour = retourner(a_droite, Retournement(sens=QUART_GAUCHE))

    assert np.array_equal(retour, depart)


def test_quatre_quarts_de_tour_dans_le_meme_sens_rendent_l_image_de_depart():
    rendu = _rectangle_dissymetrique()
    for _ in range(4):
        rendu = retourner(rendu, Retournement(sens=QUART_DROITE))

    assert np.array_equal(rendu, _rectangle_dissymetrique())


def test_le_quart_de_tour_a_droite_tourne_dans_le_sens_des_aiguilles():
    """Un repère sans ambiguïté : le pixel unique, posé en haut à droite du
    départ, doit se retrouver en bas à droite après un quart de tour à droite
    — le coin haut-droit d'un rectangle pivote vers son coin bas-droit dans le
    sens des aiguilles d'une montre."""
    depart = _rectangle_dissymetrique(largeur=20, hauteur=14)
    couleur = tuple(int(v) for v in depart[1, 18])
    assert couleur == (250, 240, 30, 255)

    rendu = retourner(depart, Retournement(sens=QUART_DROITE))
    assert tuple(int(v) for v in rendu[18, 12]) == couleur


def test_demi_tour_egale_deux_quarts_de_tour():
    depart = _rectangle_dissymetrique()
    demi = retourner(depart, Retournement(sens=DEMI_TOUR))
    deux_quarts = retourner(
        retourner(depart, Retournement(sens=QUART_DROITE)),
        Retournement(sens=QUART_DROITE),
    )

    assert demi.shape == depart.shape
    assert np.array_equal(demi, deux_quarts)
    assert _palette(demi) == _palette(depart)


def test_deux_demi_tours_rendent_l_image_de_depart():
    depart = _rectangle_dissymetrique()
    rendu = retourner(retourner(depart, Retournement(sens=DEMI_TOUR)), Retournement(sens=DEMI_TOUR))

    assert np.array_equal(rendu, depart)


def test_diagonale_echange_largeur_et_hauteur_et_pivote_sur_le_coin_fixe():
    """Le miroir sur la diagonale — du coin haut-gauche au coin bas-droit,
    qui restent en place tous les deux."""
    depart = _rectangle_dissymetrique(largeur=20, hauteur=14)
    rendu = retourner(depart, Retournement(sens=DIAGONALE))

    assert rendu.shape == (20, 14, 4)
    assert _palette(rendu) == _palette(depart)
    # Le coin haut-gauche et le coin bas-droit ne bougent pas.
    assert tuple(rendu[0, 0]) == tuple(depart[0, 0])
    assert tuple(rendu[19, 13]) == tuple(depart[13, 19])
    # Un pixel hors de la diagonale traverse bien de l'autre côté.
    assert tuple(rendu[2, 4]) == tuple(depart[4, 2])


def test_deux_diagonales_rendent_l_image_de_depart():
    depart = _rectangle_dissymetrique()
    rendu = retourner(retourner(depart, Retournement(sens=DIAGONALE)), Retournement(sens=DIAGONALE))

    assert np.array_equal(rendu, depart)


# ── « Repli — une moitié recopiée sur l'autre » ──────────────────────────────


def _deux_moities(cote: int = 20) -> np.ndarray:
    rgba = np.empty((cote, cote, 4), dtype=np.uint8)
    rgba[:, : cote // 2] = (10, 20, 30, 255)
    rgba[:, cote // 2 :] = (90, 80, 70, 255)
    # Un repère dans chaque moitié, pour vérifier laquelle a vraiment bougé.
    rgba[3, 2] = (250, 0, 0, 255)
    rgba[3, cote - 3] = (0, 250, 0, 255)
    return rgba


def test_repli_recopie_la_moitie_gauche_sur_la_droite_par_defaut():
    depart = _deux_moities()
    rendu = retourner(depart, Retournement(sens=REPLI))

    assert rendu.shape == depart.shape
    milieu = depart.shape[1] // 2
    assert np.array_equal(rendu[:, :milieu], depart[:, :milieu]), "la moitié gardée a bougé"
    assert np.array_equal(rendu[:, milieu:], np.fliplr(depart[:, :milieu]))
    # La roue du moulin — un seul repère de chaque côté du pli, en miroir.
    assert tuple(rendu[3, milieu]) == tuple(depart[3, milieu - 1])


def test_repli_moitie_droite_recopie_la_droite_sur_la_gauche():
    depart = _deux_moities()
    rendu = retourner(depart, Retournement(sens=REPLI, moitie_repli=DROITE))

    milieu = depart.shape[1] // 2
    assert np.array_equal(rendu[:, milieu:], depart[:, milieu:]), "la moitié gardée a bougé"
    assert np.array_equal(rendu[:, :milieu], np.fliplr(depart[:, milieu:]))


def test_repli_avec_un_axe_designe_borne_au_cadre():
    """Un axe hors de l'image se ramène dans le cadre au lieu de faire tomber
    le calcul — la même règle que le rectangle de C3."""
    depart = _deux_moities()
    rendu = retourner(depart, Retournement(sens=REPLI, axe_repli=10_000))

    assert rendu.shape == depart.shape  # ne lève pas, rend une image bornée


# ── « Miroir, sauf ici — les zones peintes reviennent à leur place » ────────


def test_sauf_zones_sans_zone_degrade_vers_le_miroir_gauche_droite():
    depart = _rectangle_dissymetrique()
    rendu = retourner(depart, Retournement(sens=SAUF_ZONES))

    assert np.array_equal(rendu, np.fliplr(depart))


def test_sauf_zones_protege_exactement_le_pixel_peint():
    """Le bâton du pèlerin ne change pas de main : le reste du corps se
    retourne, la zone peinte revient à sa place d'origine."""
    depart = _rectangle_dissymetrique()
    depart = depart.copy()
    depart[3, 3] = (250, 10, 10, 255)  # un repère, loin de l'axe du miroir
    zone = Trait(rayon=0, points=((3, 3),))  # (x, y) = (colonne, ligne)

    rendu = retourner(depart, Retournement(sens=SAUF_ZONES, zones_protegees=(zone,)))

    attendu = np.fliplr(depart).copy()
    attendu[3, 3] = depart[3, 3]
    assert np.array_equal(rendu, attendu)
    # La preuve que la zone a vraiment fait quelque chose : sans elle, ce
    # pixel-là aurait changé.
    assert tuple(np.fliplr(depart)[3, 3]) != tuple(depart[3, 3])


def test_sauf_zones_avec_un_rayon_protege_un_carre_autour_du_point():
    depart = _rectangle_dissymetrique()
    zone = Trait(rayon=1, points=((3, 3),))  # un carré de 3×3 autour de (3, 3)

    rendu = retourner(depart, Retournement(sens=SAUF_ZONES, zones_protegees=(zone,)))

    attendu = np.fliplr(depart).copy()
    attendu[2:5, 2:5] = depart[2:5, 2:5]
    assert np.array_equal(rendu, attendu)


# ── « Rotation libre — au plus proche, ou par RotSprite » ───────────────────


def _carre_a_motif(cote: int = 32) -> np.ndarray:
    """Un carré opaque sur fond transparent, avec deux couleurs internes —
    assez pour qu'une rotation puisse être jugée sur ses bords."""
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[cote // 4 : cote - cote // 4, cote // 4 : cote - cote // 4] = (200, 60, 60, 255)
    rgba[cote // 3 : cote - cote // 3, cote // 3 : cote - cote // 3] = (60, 60, 200, 255)
    return rgba


@pytest.mark.parametrize("sens", [ANGLE_LIBRE, ROTSPRITE])
def test_un_angle_nul_ne_change_rien(sens):
    depart = _carre_a_motif()
    rendu = retourner(depart, Retournement(sens=sens, angle=0))

    assert np.array_equal(rendu, depart)


@pytest.mark.parametrize("sens", [ANGLE_LIBRE, ROTSPRITE])
def test_une_rotation_libre_ne_reinvente_aucune_couleur(sens):
    """**Aucune interpolation, sur les deux méthodes.** Une rotation qui
    mélangerait deux teintes du sprite en une troisième casserait la palette
    du jeu — c'est ce que le plus proche voisin refuse par construction, et
    RotSprite hérite de la même garantie parce que son vote ne choisit jamais
    qu'une couleur réellement présente dans le bloc qu'il résume."""
    depart = _carre_a_motif()
    rendu = retourner(depart, Retournement(sens=sens, angle=37))

    assert rendu.shape == depart.shape
    # Transparent est la seule couleur qui peut apparaître sans avoir été
    # posée : c'est ce que les coins vidés par la rotation ressortent.
    assert _palette(rendu) <= _palette(depart) | {(0, 0, 0, 0)}


def test_rotsprite_et_la_rotation_au_plus_proche_ne_rendent_pas_la_meme_image():
    """Si les deux méthodes rendaient toujours pareil, RotSprite ne serait
    qu'un second nom pour la même rotation — la mesure de coût, plus bas, n'en
    vaudrait pas la peine."""
    depart = _carre_a_motif()
    naive = retourner(depart, Retournement(sens=ANGLE_LIBRE, angle=27))
    rotsprite = retourner(depart, Retournement(sens=ROTSPRITE, angle=27))

    assert not np.array_equal(naive, rotsprite)


def _bord_vertical(cote: int = 64) -> np.ndarray:
    """La frontière la plus simple dont une rotation doive rester une droite :
    opaque à gauche, transparente à droite, sur toute la hauteur."""
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, : cote // 2] = (200, 40, 40, 255)
    return rgba


def _colonne_du_bord(rgba: np.ndarray) -> np.ndarray:
    """Pour chaque ligne, la colonne du dernier pixel opaque — ou -1."""
    opaque = rgba[:, :, 3] > 127
    colonnes = np.full(rgba.shape[0], -1, dtype=np.int64)
    for ligne in range(rgba.shape[0]):
        indices = np.nonzero(opaque[ligne])[0]
        if indices.size:
            colonnes[ligne] = int(indices[-1])
    return colonnes


def test_rotsprite_approxime_une_droite_par_un_escalier_plus_regulier():
    """**La preuve, pas l'affirmation.** Tournée, une frontière verticale
    nette est une droite ; la meilleure approximation qu'une grille de pixels
    en donne est un escalier à marches **régulières**. Mesuré sur neuf angles
    (`27` retenu ici, script jetable de la tranche) : RotSprite rend un
    escalier dont la variance des marches est plus basse que celui d'une
    rotation directe sur la majorité des angles testés — c'est l'effet du vote
    de voisinage, qui a agrandi l'image avant de trancher plutôt que d'arrondir
    une seule fois. L'effet n'est pas garanti à *tout* angle — deux des neuf
    angles mesurés ne montraient aucune différence —, mais 27° le montre
    nettement et sans ambiguïté.
    """
    depart = _bord_vertical(64)
    angle = 27.0

    naive = retourner(depart, Retournement(sens=ANGLE_LIBRE, angle=angle))
    rotsprite = retourner(depart, Retournement(sens=ROTSPRITE, angle=angle))

    colonnes_naive = _colonne_du_bord(naive)
    colonnes_rotsprite = _colonne_du_bord(rotsprite)
    valides = (colonnes_naive != -1) & (colonnes_rotsprite != -1)
    assert valides.sum() > 40, "trop peu de lignes portent encore la frontière"

    def irregularite(colonnes: np.ndarray) -> float:
        """Variance des marches d'un escalier — régulier, elle est basse."""
        pas = np.diff(colonnes[valides].astype(np.float64))
        return float(np.var(pas))

    ecart_naive = irregularite(colonnes_naive)
    ecart_rotsprite = irregularite(colonnes_rotsprite)

    assert ecart_rotsprite < ecart_naive, (
        f"RotSprite ({ecart_rotsprite:.4f}) ne rend pas un escalier plus "
        f"régulier que la rotation directe ({ecart_naive:.4f}) à 27°"
    )


# ── « Le coût de RotSprite se mesure, honnêtement » ─────────────────────────


def test_rotsprite_est_le_candidat_naturel_a_depasser_240_ms():
    """Pas un chiffre inventé : un chronomètre, sur une planche de 1024 px —
    la taille où l'atelier applique vraiment une rotation libre (voir la note
    de `atelier-retourner.dc.html` : presque jamais sur une case de 64 px déjà
    réduite). Le seuil de 240 ms est celui sous lequel l'écran ne montre rien
    (`docs/DESIGN.md` § Motion) ; ce test dit que RotSprite le dépasse pour de
    vrai sur ce format-là, et que ça ne prend pas dix secondes non plus."""
    cote = 1024
    grande = np.zeros((cote, cote, 4), dtype=np.uint8)
    marge = cote // 8
    grande[marge : cote - marge, marge : cote - marge] = (150, 90, 60, 255)

    debut = time.perf_counter()
    retourner(grande, Retournement(sens=ROTSPRITE, angle=23))
    duree = time.perf_counter() - debut

    assert duree > 0.240, (
        f"RotSprite sur 1024 px a pris {duree * 1000:.0f} ms — sous les 240 ms, "
        "la mesure de temps de la tranche n'a plus de candidat naturel"
    )
    assert duree < 5.0, f"RotSprite sur 1024 px a pris {duree * 1000:.0f} ms — trop lent"


def test_un_miroir_ou_un_quart_de_tour_reste_sous_10_ms_sur_une_case_de_64():
    """Le contraste qui justifie la phrase de la planche : *presque jamais sur
    une case de 64 px déjà finie*. Les huit sens géométriques restent
    instantanés — aucun ne recopie plus que le miroir gauche-droite mesuré
    en B1 (5,3 ms de médiane)."""
    depart = _carre_a_motif(64)
    for sens in (HAUT_BAS, QUART_DROITE, QUART_GAUCHE, DEMI_TOUR, DIAGONALE, REPLI):
        debut = time.perf_counter()
        retourner(depart, Retournement(sens=sens))
        duree = time.perf_counter() - debut
        assert duree < 0.010, f"{sens} a pris {duree * 1000:.1f} ms sur une case de 64 px"


# ── « Un sens inconnu ne retourne rien, et un champ neuf ne s'écrit que
#     rempli » — les mêmes deux règles que B1, tenues pour les champs de B18 ──


def test_un_sens_inconnu_ignore_les_champs_neufs_et_ne_leve_pas():
    depart = _rectangle_dissymetrique()
    rendu = retourner(
        depart,
        Retournement(sens="quart-de-cote", angle=45, axe_repli=3, moitie_repli=DROITE),
    )

    assert np.array_equal(rendu, depart)


@pytest.mark.parametrize(
    "retournement, attendu",
    [
        (Retournement(sens=HAUT_BAS), {"sens": HAUT_BAS}),
        (Retournement(sens=ANGLE_LIBRE, angle=12.5), {"sens": ANGLE_LIBRE, "angle": 12.5}),
        (Retournement(sens=REPLI, axe_repli=7), {"sens": REPLI, "axe_repli": 7}),
        (Retournement(sens=REPLI, moitie_repli=DROITE), {"sens": REPLI, "moitie_repli": DROITE}),
        (Retournement(sens=REPLI, moitie_repli=GAUCHE), {"sens": REPLI}),
    ],
)
def test_un_champ_neuf_ne_s_ecrit_que_s_il_vaut_autre_chose_que_son_neutre(
    retournement, attendu
):
    """La même règle que B17 sur `Quantification`, elle-même reprise de B1 sur
    cette place précise : une recette `gauche-droite` déjà sur le disque doit
    continuer de rendre le même JSON canonique — donc la même empreinte —, et
    ne pas recalculer son rendu pour des champs qu'elle ne pose pas."""
    assert retournement.en_json() == attendu


def test_le_retournement_se_relit_tel_qu_il_s_ecrit_avec_ses_champs_neufs():
    zone = Trait(rayon=2, points=((5, 5), (6, 6)))
    recette = Retournement(
        sens=SAUF_ZONES, axe_repli=4, moitie_repli=DROITE, angle=-90.0, zones_protegees=(zone,)
    )

    relue = Retournement.depuis_json(recette.en_json())

    assert relue == recette


def test_la_recette_par_defaut_de_b1_garde_son_empreinte_apres_b18():
    """**Le critère le plus cher de B1, tenu à nouveau pour B18** : une recette
    `Retournement()` — celle que le miroir gauche-droite pose depuis B1 — doit
    continuer de rendre exactement `{"sens": "gauche-droite"}`, sans quoi les
    61 recettes du corpus figé de `tests/recettes-avant-b1.json` qui en
    portent une changeraient d'empreinte, donc de nom de rendu."""
    assert Recette(retournement=Retournement()).en_json()["retournement"] == {
        "sens": GAUCHE_DROITE
    }


# ── « La route accepte les neuf sens neufs, avec leurs champs » ────────────


def test_la_route_pose_un_sens_neuf_avec_son_angle(client):
    reponse = client.post("/api/assets/upload", content=_octets(_carre_a_motif()), params={"nom": "carre.png"})
    assert reponse.status_code == 201, reponse.text
    identifiant = reponse.json()["asset"]["identifiant"]

    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "retournement": {"sens": ROTSPRITE, "angle": 15}},
    )
    assert pose.status_code == 200, pose.text
    assert pose.json()["recette"]["retournement"] == {"sens": ROTSPRITE, "angle": 15.0}


def test_la_route_pose_les_zones_protegees_du_sauf_zones(client):
    reponse = client.post("/api/assets/upload", content=_octets(_rectangle_dissymetrique()), params={"nom": "rect.png"})
    assert reponse.status_code == 201, reponse.text
    identifiant = reponse.json()["asset"]["identifiant"]

    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [],
            "retournement": {
                "sens": SAUF_ZONES,
                "zones_protegees": [{"garde": True, "rayon": 2, "points": [[3, 3]]}],
            },
        },
    )
    assert pose.status_code == 200, pose.text
    zones = pose.json()["recette"]["retournement"]["zones_protegees"]
    assert zones == [{"garde": True, "rayon": 2, "points": [[3, 3]], "couleur": ""}]


def test_l_angle_hors_bornes_est_refuse_avec_un_422(client):
    reponse = client.post("/api/assets/upload", content=_octets(_carre_a_motif()), params={"nom": "carre2.png"})
    identifiant = reponse.json()["asset"]["identifiant"]

    refus = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "retournement": {"sens": ANGLE_LIBRE, "angle": 200}},
    )
    assert refus.status_code == 422, refus.text


def test_le_rendu_servi_porte_bien_le_sens_neuf_pose_par_la_route(client):
    """Le même essai que B1 (`test_le_rendu_servi_est_bien_retourne`), sur un
    sens neuf plutôt que sur le miroir de B1 — la panne trouvée alors (la queue
    appliquée deux fois) touchait la place entière, pas un sens en particulier."""
    octets = _octets(_rectangle_dissymetrique())
    identifiant = client.post(
        "/api/assets/upload", content=octets, params={"nom": "rect2.png"}
    ).json()["asset"]["identifiant"]

    nue = {"passes": [], "veille": []}
    assert client.put(f"/api/assets/{identifiant}/recipe", json=nue).status_code == 200
    avant = _rendu_servi(client, identifiant)

    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={**nue, "retournement": {"sens": HAUT_BAS}},
    )
    assert pose.status_code == 200, pose.text
    apres = _rendu_servi(client, identifiant)

    assert not np.array_equal(avant, apres)
    assert np.array_equal(np.flipud(apres), avant)


# ── Les mêmes petits outils que `tests/test_b1.py`, redits ici pour que ce
#    fichier se lise seul ────────────────────────────────────────────────────


def _octets(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _rendu_servi(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/image")
    assert reponse.status_code == 200, reponse.text
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA"))
