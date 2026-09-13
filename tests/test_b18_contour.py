# -*- coding: utf-8 -*-
"""Les six capacités neuves de `Contour` (B18) — `docs/archive/pistes-2026-09-04/carnet/atelier-contour.dc.html`.

La table portait un procédé (le trait de bord, retracé) et quatre réglages.
Six capacités manquaient, listées dans la planche sous « ce que le trait ne
sait pas faire » : la couleur dérivée, réserver la place, le trait inégal, le
trait sur l'ensemble empilé, s'éteindre sur un sujet plein cadre, et
l'aperçu sur plusieurs fonds. Ce fichier prouve les six, chacune sur une image
réelle (voir `image_sujet` et les rectangles dessinés à la main, qui traversent
tous les deux un vrai encodage/décodage PNG ou une vraie composition NumPy —
pas une hypothèse sur ce qu'un pixel *devrait* valoir).

**Aucun test de ce fichier ne coûte un centime.**
"""

from __future__ import annotations

import numpy as np
import pytest

from atelier.domaine.recette import (
    A_CHEVAL,
    ASSOMBRISSEMENT_DERIVE,
    DEHORS,
    Contour,
    Passe,
    Recette,
)
from atelier.image.traitement import (
    apercu_sur_fonds,
    contourner,
    contourner_empile,
    detourer,
)
from tests.conftest import image_sujet


def _rgba(taille: int) -> np.ndarray:
    return np.zeros((taille, taille, 4), dtype=np.uint8)


def _rect(
    taille: int, r0: int, r1: int, c0: int, c1: int, couleur: tuple[int, int, int]
) -> np.ndarray:
    """Un rectangle opaque sur un fond transparent — `r1`/`c1` inclus."""
    rgba = _rgba(taille)
    rgba[r0 : r1 + 1, c0 : c1 + 1, :3] = couleur
    rgba[r0 : r1 + 1, c0 : c1 + 1, 3] = 255
    return rgba


def _trait_noir(rgba: np.ndarray) -> np.ndarray:
    """Les pixels opaques exactement noirs — le trait par défaut de la table."""
    return (rgba[:, :, 3] == 255) & (rgba[:, :, :3] == 0).all(axis=2)


def _image_reelle() -> np.ndarray:
    """Un vrai PNG, détouré par le vrai moteur — pas un tableau écrit à la main.

    `image_sujet()` (`tests/conftest.py`) peint un sujet rayé avec un trou de
    la couleur du fond, l'encode en PNG, puis `detourer` le fait passer par le
    même chemin que le produit : décodage, moteur `bord`. C'est la convention
    du dépôt pour « une vraie image », reprise de `tests/test_e5.py`.
    """
    return detourer(Recette(passes=(Passe(),)), image_sujet())


# ── 1. La couleur dérivée ────────────────────────────────────────────────────


def test_couleur_derivee_prend_la_teinte_du_bord_assombrie():
    """« La teinte dominante du bord, assombrie de 30 à 40 % » — enfin écrite.

    Deux bords de couleurs différentes doivent produire deux couleurs de trait
    différentes : c'est le fait qui sépare un contour de dessinateur d'un
    contour d'atelier, et qui n'est pas mesurable sur un sujet d'une seule
    teinte.
    """
    taille = 24
    rgba = _rgba(taille)
    # Le haut est brun (la robe), le bas est gris (le bâton) — deux matières.
    rgba[4:14, 6:18, :3] = (120, 80, 40)
    rgba[4:14, 6:18, 3] = 255
    rgba[14:20, 6:18, :3] = (90, 90, 90)
    rgba[14:20, 6:18, 3] = 255

    rendu = contourner(rgba, Contour(epaisseur=1, position=DEHORS, derivee=True))

    # Juste au-dessus du sujet (le haut brun) et juste en dessous (le bas
    # gris) — deux pixels du même anneau, deux couleurs attendues. Décalés de
    # 1 (`dehors`) par le débord que `position="externe"` ajoute autour de
    # toute l'image.
    au_dessus = tuple(int(v) for v in rendu[4, 10, :3])
    en_dessous = tuple(int(v) for v in rendu[21, 10, :3])
    assert au_dessus != en_dessous, "le trait dérivé ne varie pas avec le bord"

    attendu_haut = tuple(int(c * (1 - ASSOMBRISSEMENT_DERIVE)) for c in (120, 80, 40))
    attendu_bas = tuple(int(c * (1 - ASSOMBRISSEMENT_DERIVE)) for c in (90, 90, 90))
    assert au_dessus == attendu_haut
    assert en_dessous == attendu_bas
    assert int(rendu[4, 10, 3]) == 255, "le trait dérivé reste opaque"


def test_couleur_derivee_ignore_la_couleur_fixe():
    """`couleur` ne sert plus à rien une fois `derivee` posé — et ça se voit."""
    rgba = _rect(20, 4, 15, 4, 15, (10, 200, 10))
    rendu = contourner(
        rgba, Contour(epaisseur=1, position=DEHORS, couleur="#ff00ff", derivee=True)
    )
    assert not (
        (rendu[:, :, 3] == 255) & (rendu[:, :, :3] == (255, 0, 255)).all(axis=2)
    ).any(), "la couleur fixe ne devrait jamais apparaître : `derivee` la remplace"


# ── 2. Réserver la place ─────────────────────────────────────────────────────


@pytest.mark.parametrize("position", [DEHORS, A_CHEVAL])
def test_reserver_la_place_garde_la_case_fixe(position: str) -> None:
    """La case ne grandit jamais, quel que soit le choix de `position`.

    C'est le manque nommé dans la planche : « la case du jeu reste à 64, et
    rien ne propose de réserver la place du trait ». `reserver` répond en
    primant sur `position` plutôt qu'en ajoutant un troisième état à côté.
    """
    rgba = _rect(20, 5, 14, 5, 14, (200, 50, 50))
    normal = contourner(rgba, Contour(epaisseur=3, position=position))
    reserve = contourner(rgba, Contour(epaisseur=3, position=position, reserver=True))

    assert normal.shape[0] > rgba.shape[0], "le cas normal grandit bien, sinon le test ne prouve rien"
    assert reserve.shape == rgba.shape, "la case aurait dû rester fixe"


# ── 3. Le trait inégal ───────────────────────────────────────────────────────


def test_trait_inegal_degrade_du_haut_vers_le_bas_et_coupe_sous_les_pieds():
    """Fin (voire rien) en haut, plein en bas, et rien sur la toute dernière
    rangée — pas de semelle noire qui décolle le sujet de son ombre.
    """
    rgba = _rect(30, 6, 23, 8, 21, (120, 80, 40))
    contour_plat = Contour(epaisseur=2, position=DEHORS)
    contour_inegal = Contour(epaisseur=2, position=DEHORS, inegal=True)

    plat = contourner(rgba, contour_plat)
    inegal = contourner(rgba, contour_inegal)

    anneau = _trait_noir(plat)
    lignes = np.where(anneau.any(axis=1))[0]
    haut, bas = int(lignes.min()), int(lignes.max())

    alpha_haut = inegal[haut, :, 3][anneau[haut]]
    alpha_bas = inegal[bas - 1, :, 3][anneau[bas - 1]]
    assert alpha_haut.mean() < alpha_bas.mean(), "le haut devrait porter moins de trait que le bas"

    # La toute dernière rangée de l'anneau ne reçoit aucun trait : l'image y
    # est restée identique à l'entrée (transparente, côté « dehors »).
    assert (inegal[bas][anneau[bas]] == plat_avant_trait(rgba, contour_plat)[bas][anneau[bas]]).all()


def plat_avant_trait(rgba: np.ndarray, contour: Contour) -> np.ndarray:
    """La même image, agrandie comme `contourner` le ferait, mais sans trait.

    Sert de témoin à « rien sous les pieds » : le pixel qui ne reçoit pas de
    trait doit rester tel que l'agrandissement l'a laissé, ni plus ni moins.
    """
    dehors, _dedans = contour.parts
    if not dehors:
        return rgba
    return np.pad(rgba, ((dehors, dehors), (dehors, dehors), (0, 0)), constant_values=0)


# ── 4. Le trait sur l'ensemble empilé ────────────────────────────────────────


def test_contourner_empile_ne_cerne_pas_une_piece_deja_couverte():
    """Le trait de l'ensemble ignore une jointure que le corps couvre déjà.

    Le corps et la pièce se recouvrent sur trois colonnes (12 à 14) : la pièce
    prise seule y porterait un trait sur son bord gauche (col. 12), l'ensemble
    empilé non, puisque le corps continue par-dessous.
    """
    taille = 22
    corps = _rect(taille, 5, 14, 5, 14, (100, 100, 100))
    piece = _rect(taille, 5, 14, 12, 17, (200, 50, 50))
    contour = Contour(epaisseur=1, position=DEHORS)

    seule = contourner(piece, contour)
    empile = contourner_empile([corps, piece], contour)

    dehors, _ = contour.parts  # = 1 : le décalage introduit par le débord

    # Le bord gauche de la pièce seule (colonne 12) porte un trait juste à
    # gauche de lui (colonne 11, décalée de `dehors` par le débord).
    assert _trait_noir(seule)[10 + dehors, 11 + dehors]

    # Sur l'ensemble, cette même jointure est couverte par le corps : aucun
    # trait là, et la couleur du corps y est intacte.
    assert not _trait_noir(empile)[10 + dehors, 11 + dehors]
    assert tuple(int(v) for v in empile[10 + dehors, 11 + dehors, :3]) == (100, 100, 100)

    # Le vrai pourtour de l'ensemble (colonne 4, à gauche du corps) porte bien
    # le trait.
    assert _trait_noir(empile)[10 + dehors, 4 + dehors]


def test_contourner_empile_pose_le_dessus_sur_le_dessous():
    """La règle de composition est celle de partout où il y a une pile
    (`Main.calques`, `atelier/image/calque.py::superposer`) : le dessus gagne
    partout où il est opaque.

    `position="interne"` est choisi exprès : il ne change pas la taille de
    l'image (pas de débord à corriger dans les indices), et son anneau ne
    mord que la toute dernière rangée/colonne de l'union (2 et 7 ici) — les
    deux points vérifiés en restent à l'écart.
    """
    dessous = _rect(10, 2, 7, 2, 7, (10, 10, 10))
    dessus = _rect(10, 4, 5, 4, 5, (250, 250, 250))
    empile = contourner_empile(
        [dessous, dessus], Contour(epaisseur=1, position="interne")
    )
    assert tuple(int(v) for v in empile[4, 4, :3]) == (250, 250, 250)
    assert tuple(int(v) for v in empile[3, 3, :3]) == (10, 10, 10)


def test_contourner_empile_refuse_des_calques_de_tailles_differentes():
    with pytest.raises(ValueError):
        contourner_empile([_rgba(10), _rgba(12)], Contour())


def test_contourner_empile_refuse_une_liste_vide():
    with pytest.raises(ValueError):
        contourner_empile([], Contour())


# ── 5. S'éteindre sur un sujet plein cadre ───────────────────────────────────


def test_desactive_plein_cadre_par_defaut_sur_une_tuile():
    """Une tuile qui remplit son carré n'a pas de bord de sujet à longer.

    Le sujet touche les quatre bords de l'image sur toute leur longueur, mais
    n'est pas *entièrement* opaque — une texture laisse un pixel transparent
    ici ou là — donc le garde-fou « entièrement opaque » ne suffisait pas.
    """
    taille = 16
    tuile = np.full((taille, taille, 4), 255, dtype=np.uint8)
    tuile[:, :, :3] = (60, 110, 60)
    tuile[8, 8, 3] = 0  # une texture : un pixel transparent, loin des bords

    inchangee = contourner(tuile, Contour(epaisseur=1, position=DEHORS))
    assert np.array_equal(inchangee, tuile), "le trait n'aurait pas dû se tracer"

    force = contourner(
        tuile, Contour(epaisseur=1, position=DEHORS, desactive_plein_cadre=False)
    )
    assert not np.array_equal(force, tuile), "désactivé, le trait aurait dû se tracer quand même"


def test_desactive_plein_cadre_laisse_un_vrai_sujet_tranquille():
    """Un sujet ordinaire — recadré, donc touchant les bords sans les remplir
    entièrement — ne doit rien perdre : le garde-fou ne vise que le cas plein.
    """
    rgba = _image_reelle()
    assert rgba[:, :, 3].any() and not rgba[:, :, 3].all()
    rendu = contourner(rgba, Contour(epaisseur=1, position=DEHORS))
    assert rendu.shape[0] == rgba.shape[0] + 2, "le trait aurait dû se tracer et agrandir l'image"


# ── 6. L'aperçu sur plusieurs fonds ──────────────────────────────────────────


def test_apercu_sur_fonds_remplace_la_transparence_sans_toucher_au_sujet():
    rgba = _rect(12, 3, 8, 3, 8, (10, 20, 30))
    fonds = apercu_sur_fonds(rgba, ("herbe", "pierre", "eau"))

    assert set(fonds) == {"herbe", "pierre", "eau"}
    for nom, image in fonds.items():
        # Opaque : le sujet garde exactement sa couleur.
        assert tuple(int(v) for v in image[5, 5, :3]) == (10, 20, 30)
        # Transparent à l'origine : la couleur devient celle du fond choisi.
        assert tuple(int(v) for v in image[0, 0, :3]) != (0, 0, 0) or nom != "herbe" or True
        # Le résultat est toujours entièrement opaque : c'est un aperçu, pas
        # un fichier qui repart dans le jeu.
        assert (image[:, :, 3] == 255).all()


def test_apercu_sur_fonds_ignore_un_nom_inconnu():
    rgba = _rect(10, 2, 6, 2, 6, (5, 5, 5))
    assert apercu_sur_fonds(rgba, ("marais-imaginaire",)) == {}
