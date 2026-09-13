# -*- coding: utf-8 -*-
"""Les critères de B18 pour l'atelier **Nettoyer** — le reste des moteurs.

**Le compte de la planche se contredisait trois fois** (`docs/archive/pistes-2026-09-04/
carnet/atelier-nettoyer.dc.html`) : douze en préambule (celui des *réglages*,
pas des moteurs — la section « Les réglages » de la planche en compte
effectivement douze), onze dans le réglage « méthode » (le total, existants
compris — deux posés, neuf « à ajouter »), neuf dans le détail des cartes
« Les moteurs » (`— 2 sont là, 9 restent à ajouter`). **C'est ce dernier compte
qui a été tranché** : c'est le seul qui corresponde à des cartes réellement
décrites une par une, plutôt qu'à une phrase de synthèse.

**Et deux des neuf étaient déjà posées en relisant le code d'avant d'écrire une
ligne.** « Médiane des couleurs » est `Bords.grain_min` et « Décrocher les
pixels de coin » est `Bords.lissage` — les deux réglages neufs de `B17`, sous
d'autres noms dans la planche. **Sept moteurs neufs restent donc à écrire ici**,
et ce fichier les couvre un par un : `garder_le_sujet_seul`,
`boucher_les_trous`, `reboucher_les_poches_de_fond`, `ronger_puis_regonfler`,
`regonfler_puis_ronger`, `voter_les_voisins`, et la désignation à la main
(`Designation` / `appliquer_designations`).

**Aucun test de ce fichier ne coûte un centime**, et aucun ne touche au réseau :
les sept moteurs sont du calcul local sur des tableaux `numpy`.
"""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import pytest

from atelier.domaine.recette import (
    GARDER_MAX,
    LISSAGE_MAX,
    MORPHOLOGIE_MAX,
    Bords,
    Designation,
    Recette,
)
from atelier.image.traitement import (
    appliquer_designations,
    boucher_les_trous,
    garder_le_sujet_seul,
    nettoyer,
    reboucher_les_poches_de_fond,
    regonfler_puis_ronger,
    ronger_puis_regonfler,
    voter_les_voisins,
)

MAGENTA = (255, 0, 255)
BRUN = (107, 90, 68)

INSTANTANE_MS = 240  # au-delà, l'écran doit montrer une jauge (B16)


def chronometre(fonction, *args, tours: int = 5) -> float:
    """Le meilleur des `tours`, en millisecondes — même règle que `test_b17.py`."""
    durees = []
    for _ in range(tours):
        depart = time.perf_counter()
        fonction(*args)
        durees.append((time.perf_counter() - depart) * 1000)
    return min(durees)


def carre(cote: int, couleur=BRUN) -> np.ndarray:
    """Une image de fond magenta, transparente partout."""
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    image[:, :, :3] = MAGENTA
    return image


def sujet_avec_ilots(cote: int = 24) -> np.ndarray:
    """Un gros bloc — le sujet — et deux petits îlots détachés."""
    image = carre(cote)
    image[6:18, 6:18, :3] = BRUN
    image[6:18, 6:18, 3] = 255  # 12x12 = 144 px
    image[0:2, 0:2, 3] = 255  # îlot de 4 px
    image[cote - 2 : cote, cote - 2 : cote, 3] = 255  # îlot de 4 px
    return image


# ── « Garder le sujet seul » ─────────────────────────────────────────────────


def test_garder_le_sujet_seul_efface_les_amas_hors_du_rang_demande():
    image = sujet_avec_ilots()
    apres = garder_le_sujet_seul(image, 1)
    assert (apres[:, :, 3] > 0).sum() == 144
    assert apres[0, 0, 3] == 0
    assert apres[23, 23, 3] == 0
    assert apres[10, 10, 3] == 255, "le corps du sujet ne bouge pas"


def test_garder_le_sujet_seul_garde_toujours_le_plus_grand_quel_que_soit_n():
    """`n=1` doit toujours garder le sujet, jamais deviner lequel des amas
    l'est — la garantie que la planche demande : *« demander 1 revient
    toujours à garder le sujet »*."""
    image = sujet_avec_ilots()
    apres = garder_le_sujet_seul(image, 1)
    assert apres[10, 10, 3] == 255


def test_garder_le_sujet_seul_avec_n_egal_au_compte_des_amas_ne_change_rien():
    image = sujet_avec_ilots()
    assert np.array_equal(image, garder_le_sujet_seul(image, 3))
    assert np.array_equal(image, garder_le_sujet_seul(image, 8))


def test_a_zero_garder_le_sujet_seul_est_eteint():
    image = sujet_avec_ilots()
    assert np.array_equal(image, garder_le_sujet_seul(image, 0))


def test_garder_le_sujet_seul_ne_touche_pas_la_couleur():
    image = sujet_avec_ilots()
    apres = garder_le_sujet_seul(image, 1)
    assert np.array_equal(image[:, :, :3], apres[:, :, :3])


# ── « Boucher les trous » ────────────────────────────────────────────────────


def sujet_avec_un_trou(cote: int = 24) -> np.ndarray:
    image = carre(cote)
    image[3 : cote - 3, 3 : cote - 3, :3] = BRUN
    image[3 : cote - 3, 3 : cote - 3, 3] = 255
    image[10:13, 10:13, 3] = 0  # un trou de 9 px, entouré de brun
    return image


def test_boucher_les_trous_comble_un_trou_sous_le_seuil():
    image = sujet_avec_un_trou()
    apres = boucher_les_trous(image, 9)
    assert apres[11, 11, 3] == 255
    assert tuple(apres[11, 11, :3]) == BRUN, "la couleur vient d'un voisin, pas d'une moyenne"


def test_boucher_les_trous_laisse_un_trou_au_dessus_du_seuil():
    image = sujet_avec_un_trou()
    apres = boucher_les_trous(image, 8)
    assert apres[11, 11, 3] == 0


def test_boucher_les_trous_ne_touche_pas_le_fond_ordinaire():
    """Un trou qui touche un bord de l'image est le fond, jamais un trou."""
    image = sujet_avec_un_trou()
    apres = boucher_les_trous(image, 64)
    dehors = np.ones(image.shape[:2], dtype=bool)
    dehors[3:21, 3:21] = False
    assert np.array_equal(apres[dehors], image[dehors])


def test_a_zero_boucher_les_trous_est_eteint():
    image = sujet_avec_un_trou()
    assert np.array_equal(image, boucher_les_trous(image, 0))


def test_boucher_les_trous_ne_touche_rien_sans_trou():
    image = carre(16)
    image[4:12, 4:12, :3] = BRUN
    image[4:12, 4:12, 3] = 255
    assert np.array_equal(image, boucher_les_trous(image, 64))


# ── « Reboucher les poches de fond » ─────────────────────────────────────────


def sujet_avec_une_poche(cote: int = 24) -> np.ndarray:
    """Un anneau opaque brun, avec du magenta **encore opaque** en son centre —
    ce que le remplissage depuis les bordures n'a pas rejoint."""
    image = carre(cote)
    image[3 : cote - 3, 3 : cote - 3, :3] = BRUN
    image[3 : cote - 3, 3 : cote - 3, 3] = 255
    image[10:13, 10:13, :3] = MAGENTA
    image[10:13, 10:13, 3] = 255  # la poche : magenta, mais opaque et enfermée
    return image


def test_reboucher_les_poches_de_fond_efface_une_poche_sous_le_seuil():
    image = sujet_avec_une_poche()
    apres = reboucher_les_poches_de_fond(image, 9)
    assert apres[11, 11, 3] == 0


def test_reboucher_les_poches_de_fond_laisse_une_poche_au_dessus_du_seuil():
    image = sujet_avec_une_poche()
    apres = reboucher_les_poches_de_fond(image, 8)
    assert apres[11, 11, 3] == 255


def test_a_zero_reboucher_les_poches_de_fond_est_eteint():
    image = sujet_avec_une_poche()
    assert np.array_equal(image, reboucher_les_poches_de_fond(image, 0))


def test_boucher_et_reboucher_sont_bien_les_deux_lectures_inverses():
    """Un trou (transparent) n'est jamais pris pour une poche (opaque), et
    inversement — la confusion que `atelier/image/taches.py` documente comme
    ayant déjà coûté cher une fois (poches lues comme des trous, 31 août 2026)."""
    trou = sujet_avec_un_trou()
    poche = sujet_avec_une_poche()
    assert np.array_equal(trou, reboucher_les_poches_de_fond(trou, 64)), (
        "un trou transparent n'est pas une poche de fond"
    )
    assert np.array_equal(poche, boucher_les_trous(poche, 64)), (
        "une poche opaque n'est pas un trou"
    )


# ── « Ronger puis regonfler » (ouverture) ────────────────────────────────────


def bloc_avec_antenne(cote: int = 24) -> np.ndarray:
    image = carre(cote)
    image[6:18, 6:18, :3] = BRUN
    image[6:18, 6:18, 3] = 255
    image[2, 8, 3] = 255  # une antenne d'un pixel de large
    image[3, 8, 3] = 255
    image[4, 8, 3] = 255
    image[5, 8, 3] = 255
    return image


def test_ronger_puis_regonfler_retire_une_fine_excroissance():
    image = bloc_avec_antenne()
    apres = ronger_puis_regonfler(image, 1, epargner_fins=False)
    assert apres[2, 8, 3] == 0


def test_ronger_puis_regonfler_garde_le_corps_a_sa_taille():
    image = bloc_avec_antenne()
    apres = ronger_puis_regonfler(image, 1, epargner_fins=False)
    assert np.array_equal(apres[6:18, 6:18, 3], image[6:18, 6:18, 3])


def test_epargner_les_traits_fins_protege_l_antenne():
    """**Le même geste que `ronger_conditionnel` au détourage** : un pixel sans
    aucun voisin franchement intérieur est un trait fin de part en part, et
    l'ouverture l'aurait sinon effacé en entier."""
    image = bloc_avec_antenne()
    apres = ronger_puis_regonfler(image, 1, epargner_fins=True)
    assert apres[2, 8, 3] == 255
    assert apres[3, 8, 3] == 255


def test_a_zero_ronger_puis_regonfler_est_eteint():
    image = bloc_avec_antenne()
    assert np.array_equal(image, ronger_puis_regonfler(image, 0))


# ── « Regonfler puis ronger » (fermeture) ────────────────────────────────────


def bloc_avec_entaille(cote: int = 24) -> np.ndarray:
    image = carre(cote)
    image[6:18, 6:18, :3] = BRUN
    image[6:18, 6:18, 3] = 255
    image[10, 6:8, 3] = 0  # une entaille de 2 px sur le bord gauche
    return image


def test_regonfler_puis_ronger_comble_une_entaille_fine():
    image = bloc_avec_entaille()
    apres = regonfler_puis_ronger(image, 1)
    assert apres[10, 6, 3] == 255
    assert apres[10, 7, 3] == 255


def test_regonfler_puis_ronger_ne_grossit_pas_le_corps():
    """**Ne peut qu'ajouter dans les creux**, jamais à l'extérieur d'un bord
    déjà plein — la fermeture contient le masque de départ, elle ne le dépasse
    pas ailleurs qu'aux entailles."""
    image = carre(24)
    image[6:18, 6:18, :3] = BRUN
    image[6:18, 6:18, 3] = 255
    apres = regonfler_puis_ronger(image, 1)
    assert np.array_equal(apres[:, :, 3], image[:, :, 3])


def test_regonfler_puis_ronger_comble_avec_une_couleur_du_voisinage():
    image = bloc_avec_entaille()
    apres = regonfler_puis_ronger(image, 1)
    assert tuple(apres[10, 6, :3]) == BRUN


def test_a_zero_regonfler_puis_ronger_est_eteint():
    image = bloc_avec_entaille()
    assert np.array_equal(image, regonfler_puis_ronger(image, 0))


# ── « Vote des voisins » ─────────────────────────────────────────────────────


def carre_avec_un_coin_manquant(cote: int = 16) -> np.ndarray:
    """Un pixel manquant à l'intérieur du bloc, à un cran du coin : ses huit
    voisins sont tous dans le bloc, donc tous opaques — une majorité franche."""
    image = carre(cote)
    image[4:12, 4:12, :3] = BRUN
    image[4:12, 4:12, 3] = 255
    image[5, 5, 3] = 0
    return image


def test_voter_les_voisins_comble_un_pixel_a_majorite_opaque():
    image = carre_avec_un_coin_manquant()
    apres = voter_les_voisins(image, 1)
    assert apres[5, 5, 3] == 255
    assert tuple(apres[5, 5, :3]) == BRUN


def test_voter_les_voisins_retire_une_dent_a_minorite_opaque():
    """L'inverse du test précédent : un pixel qui dépasse du bord n'a que trois
    voisins opaques sur huit — une minorité franche —, et s'en va."""
    image = carre(16)
    image[4:12, 4:12, :3] = BRUN
    image[4:12, 4:12, 3] = 255
    image[3, 8, 3] = 255  # une dent qui dépasse d'un cran au-dessus du bord
    apres = voter_les_voisins(image, 1)
    assert apres[3, 8, 3] == 0


def test_a_zero_voter_les_voisins_est_eteint():
    image = carre_avec_un_coin_manquant()
    assert np.array_equal(image, voter_les_voisins(image, 0))


def test_voter_les_voisins_est_borne_a_lissage_max():
    """Au-delà de `LISSAGE_MAX` passes, rien de plus ne doit se passer — même
    borne et même raison que l'escalier : *« à 3, sur un visage de 8 px, le nez
    disparaît »*."""
    image = carre_avec_un_coin_manquant()
    a_la_borne = voter_les_voisins(image, LISSAGE_MAX)
    au_dela = voter_les_voisins(image, LISSAGE_MAX + 5)
    assert np.array_equal(a_la_borne, au_dela)


# ── La désignation à la main ─────────────────────────────────────────────────


def test_appliquer_designations_efface_l_amas_sous_le_point():
    image = sujet_avec_ilots()
    resultat = image.copy()
    designations = (Designation(point=(0, 0), garde=False),)
    apres = appliquer_designations(image, resultat, designations)
    assert apres[0, 0, 3] == 0
    assert apres[10, 10, 3] == 255, "le corps du sujet ne bouge pas"


def test_appliquer_designations_protege_l_amas_deja_efface():
    """`garde=True` se lit sur l'**original** : ça annule ce que les réglages
    au-dessus ont fait, quel que soit le moteur qui l'a effacé."""
    image = sujet_avec_ilots()
    deja_nettoye = garder_le_sujet_seul(image, 1)
    assert deja_nettoye[0, 0, 3] == 0
    designations = (Designation(point=(0, 0), garde=True),)
    apres = appliquer_designations(image, deja_nettoye, designations)
    assert apres[0, 0, 3] == 255


def test_appliquer_designations_se_borne_hors_du_cadre():
    image = sujet_avec_ilots()
    designations = (Designation(point=(999, 999), garde=False),)
    assert np.array_equal(image, appliquer_designations(image, image, designations))


def test_sans_designation_appliquer_designations_ne_change_rien():
    image = sujet_avec_ilots()
    assert np.array_equal(image, appliquer_designations(image, image, ()))


def test_designation_sur_le_vide_ne_fait_rien():
    image = sujet_avec_ilots()
    designations = (Designation(point=(12, 0), garde=False),)  # un pixel transparent
    assert np.array_equal(image, appliquer_designations(image, image, designations))


# ── `nettoyer` bout en bout ───────────────────────────────────────────────────


def test_nettoyer_pose_sans_reglage_ne_change_rien():
    """**Une place posée sans être réglée ne change rien** — la promesse tenue
    par `B17` et étendue ici aux sept moteurs neufs."""
    image = sujet_avec_ilots()
    assert np.array_equal(image, nettoyer(image, Bords()))


def test_nettoyer_enchaine_les_neuf_moteurs():
    image = sujet_avec_ilots()
    tout = nettoyer(
        image,
        Bords(
            aire_min=2,
            grain_min=1,
            lissage=1,
            garder=1,
            boucher_jusqua=4,
            reboucher_jusqua=4,
            ronger_regonfler=1,
            regonfler_ronger=1,
            vote_voisins=1,
        ),
    )
    assert tout[10, 10, 3] == 255, "le corps du sujet survit à la chaîne entière"
    assert tout[0, 0, 3] == 0, "les îlots détachés partent — aire_min ou garder"


def test_nettoyer_applique_la_designation_en_dernier():
    """La désignation doit voir le résultat de tout le reste pour effacer *ce
    qu'on a sous les yeux* — un point qu'aucun autre moteur n'aurait touché
    part quand même si on le désigne."""
    image = sujet_avec_ilots()
    bords = Bords(designations=(Designation(point=(10, 10), garde=False),))
    apres = nettoyer(image, bords)
    assert apres[10, 10, 3] == 0


# ── Les bornes du domaine et le voyage de la recette ─────────────────────────


def test_les_sept_reglages_neufs_se_relisent_tels_qu_ils_s_ecrivent():
    objet = Bords(
        aire_min=3,
        grain_min=2,
        lissage=1,
        garder=2,
        boucher_jusqua=5,
        reboucher_jusqua=6,
        ronger_regonfler=1,
        regonfler_ronger=1,
        vote_voisins=1,
        epargner_traits_fins=False,
        designations=(Designation(point=(4, 5), garde=True),),
    )
    assert Bords.depuis_json(objet.en_json()) == objet


def test_une_recette_qui_ne_pose_aucun_champ_neuf_garde_son_empreinte():
    """**La règle de `B1` et de `B17`, descendue d'un cran de plus** : sept clés
    neuves dans une place déjà existante ne doivent rien changer aux recettes
    qui ne les posent pas."""
    avant_b18 = Recette(bords=Bords(aire_min=3, grain_min=1, lissage=1))
    relue = Recette.depuis_json(avant_b18.en_json())
    assert relue.empreinte() == avant_b18.empreinte()
    assert set(relue.en_json()["bords"]) == {"aire_min", "grain_min", "lissage"}


@pytest.mark.parametrize(
    "champ, valeur",
    [
        ("garder", 1),
        ("boucher_jusqua", 4),
        ("reboucher_jusqua", 4),
        ("ronger_regonfler", 1),
        ("regonfler_ronger", 1),
        ("vote_voisins", 1),
        ("epargner_traits_fins", False),
        ("designations", (Designation(point=(1, 1), garde=False),)),
    ],
)
def test_chaque_champ_neuf_pose_change_bien_l_empreinte(champ, valeur):
    nue = Recette(bords=Bords())
    posee = Recette(bords=Bords(**{champ: valeur}))
    assert posee.empreinte() != nue.empreinte()


def test_les_bornes_du_domaine_et_celles_de_l_ecran_disent_la_meme_chose():
    source = (
        Path(__file__).resolve().parents[1] / "interface" / "src" / "api.ts"
    ).read_text(encoding="utf-8")
    assert f"export const GARDER_MAX = {GARDER_MAX}" in source
    assert f"export const MORPHOLOGIE_MAX = {MORPHOLOGIE_MAX}" in source


# ── Ce que la route refuse, et pourquoi ─────────────────────────────────────


def _un_asset(client) -> str:
    from conftest import image_sujet

    reponse = client.post(
        "/api/assets/upload?nom=pelerin.png&traiter=false",
        content=image_sujet(),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


@pytest.mark.parametrize(
    "bords, morceau",
    [
        ({"garder": 99}, "garder"),
        ({"ronger_regonfler": 99}, "ronger"),
        ({"regonfler_ronger": 99}, "regonfler"),
        ({"vote_voisins": 99}, "vote"),
    ],
)
def test_la_route_refuse_un_reglage_de_nettoyage_hors_bornes(client, bords, morceau):
    identifiant = _un_asset(client)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "bords": {"aire_min": 0, **bords}},
    )
    assert reponse.status_code in (400, 409, 422), reponse.text


def test_les_sept_reglages_neufs_voyagent_par_la_route_et_reviennent(client):
    """**Le piège de `decalage`, en E17**, tenu ici pour les sept moteurs de
    `B18`. Un champ absent du modèle Pydantic est jeté en silence — ce test le
    mesure sur les sept d'un coup."""
    identifiant = _un_asset(client)
    envoi = {
        "passes": [],
        "bords": {
            "aire_min": 2,
            "grain_min": 1,
            "lissage": 1,
            "garder": 2,
            "boucher_jusqua": 4,
            "reboucher_jusqua": 4,
            "ronger_regonfler": 1,
            "regonfler_ronger": 1,
            "vote_voisins": 1,
            "epargner_traits_fins": False,
            "designations": [{"point": [3, 4], "garde": True}],
        },
    }
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=envoi)
    assert reponse.status_code == 200, reponse.text
    rendu = reponse.json()["recette"]["bords"]
    assert rendu["garder"] == 2
    assert rendu["boucher_jusqua"] == 4
    assert rendu["reboucher_jusqua"] == 4
    assert rendu["ronger_regonfler"] == 1
    assert rendu["regonfler_ronger"] == 1
    assert rendu["vote_voisins"] == 1
    assert rendu["epargner_traits_fins"] is False
    assert rendu["designations"] == [{"point": [3, 4], "garde": True}]


# ── Critère 5 : « chaque moteur neuf est mesuré » ────────────────────────────


@pytest.mark.parametrize(
    "nom, fabrique, appel",
    [
        ("garder le sujet seul", lambda: (sujet_avec_ilots(64),), lambda img: garder_le_sujet_seul(img, 1)),
        ("boucher les trous", lambda: (sujet_avec_un_trou(64),), lambda img: boucher_les_trous(img, 16)),
        (
            "reboucher les poches de fond",
            lambda: (sujet_avec_une_poche(64),),
            lambda img: reboucher_les_poches_de_fond(img, 16),
        ),
        (
            "ronger puis regonfler",
            lambda: (bloc_avec_antenne(64),),
            lambda img: ronger_puis_regonfler(img, MORPHOLOGIE_MAX),
        ),
        (
            "regonfler puis ronger",
            lambda: (bloc_avec_entaille(64),),
            lambda img: regonfler_puis_ronger(img, MORPHOLOGIE_MAX),
        ),
        (
            "vote des voisins",
            lambda: (carre_avec_un_coin_manquant(64),),
            lambda img: voter_les_voisins(img, LISSAGE_MAX),
        ),
    ],
)
def test_chaque_moteur_neuf_est_mesure(nom, fabrique, appel, capsys):
    args = fabrique()
    duree = chronometre(appel, *args)
    with capsys.disabled():
        print(f"\n  {nom} : {duree:.2f} ms — sur une case de 64")
    assert duree < INSTANTANE_MS, (
        f"{nom} met {duree:.1f} ms sur une case de 64 : ce n'est plus gratuit à l'œil"
    )


def test_la_chaine_entiere_avec_les_neuf_moteurs_reste_instantanee():
    image = sujet_avec_ilots(64)
    bords = Bords(
        aire_min=2,
        grain_min=1,
        lissage=1,
        garder=1,
        boucher_jusqua=8,
        reboucher_jusqua=8,
        ronger_regonfler=1,
        regonfler_ronger=1,
        vote_voisins=1,
    )
    duree = chronometre(lambda: nettoyer(image, bords), tours=3)
    assert duree < INSTANTANE_MS * 2, f"la chaîne entière met {duree:.0f} ms"


# ── Ce que la tranche ne doit pas casser ailleurs ───────────────────────────


def sujet_dissymetrique() -> np.ndarray:
    """Un sujet dissymétrique portant de quoi exercer les neuf moteurs à la
    fois — même esprit que `sujet_a_defauts` de `test_b17.py`."""
    image = carre(32)
    image[6:26, 6:20, :3] = BRUN
    image[6:26, 6:20, 3] = 255
    image[2, 2, 3] = 255  # îlot détaché
    image[10, 8, 3] = 0  # trou
    image[14, 8, :3] = MAGENTA
    image[14, 8, 3] = 255  # poche de fond
    image[2, 12, 3] = 255  # antenne fine
    image[3, 12, 3] = 255
    image[26, 6:8, 3] = 0  # entaille
    return image


@pytest.mark.parametrize(
    "nom, moteur",
    [
        ("garder le sujet seul", lambda a: garder_le_sujet_seul(a, 1)),
        ("boucher les trous", lambda a: boucher_les_trous(a, 8)),
        ("reboucher les poches de fond", lambda a: reboucher_les_poches_de_fond(a, 8)),
        ("ronger puis regonfler", lambda a: ronger_puis_regonfler(a, 1, epargner_fins=True)),
        ("regonfler puis ronger", lambda a: regonfler_puis_ronger(a, 1)),
        ("vote des voisins", lambda a: voter_les_voisins(a, 1)),
        (
            "nettoyer",
            lambda a: nettoyer(
                a,
                Bords(
                    aire_min=2,
                    garder=1,
                    boucher_jusqua=8,
                    reboucher_jusqua=8,
                    ronger_regonfler=1,
                    regonfler_ronger=1,
                    vote_voisins=1,
                ),
            ),
        ),
    ],
)
def test_chaque_moteur_neuf_commute_avec_le_miroir(nom, moteur):
    """**L'invariant posé par `B1`, tenu par `B17`, et que `B18` doit tenir à
    son tour** : un moteur qui dépendrait de la position de ses voisins plutôt
    que de leur ensemble romprait *retourner puis traiter* == *traiter puis
    retourner*."""
    sujet = sujet_dissymetrique()
    assert np.array_equal(moteur(sujet)[:, ::-1, :], moteur(sujet[:, ::-1, :])), (
        f"{nom} ne commute pas avec le miroir"
    )


@pytest.mark.parametrize(
    "nom, image",
    [
        ("un pixel opaque", np.array([[[10, 20, 30, 255]]], dtype=np.uint8)),
        ("un pixel vide", np.zeros((1, 1, 4), dtype=np.uint8)),
        (
            "tout transparent",
            np.dstack([np.full((8, 8, 3), 255, np.uint8), np.zeros((8, 8), np.uint8)]),
        ),
        (
            "tout opaque",
            np.dstack([np.full((8, 8, 3), 128, np.uint8), np.full((8, 8), 255, np.uint8)]),
        ),
        ("aucun pixel de large", np.zeros((4, 0, 4), dtype=np.uint8)),
    ],
)
def test_aucun_moteur_neuf_ne_leve_sur_une_image_degeneree(nom, image):
    """**Un rendu ne tombe pas, jamais** — la même règle que `B17`, tenue ici
    pour les sept moteurs neufs et la désignation à la main."""
    for moteur in (
        lambda a: garder_le_sujet_seul(a, 1),
        lambda a: boucher_les_trous(a, 4),
        lambda a: reboucher_les_poches_de_fond(a, 4),
        lambda a: ronger_puis_regonfler(a, 1),
        lambda a: regonfler_puis_ronger(a, 1),
        lambda a: voter_les_voisins(a, 1),
        lambda a: appliquer_designations(a, a, (Designation(point=(0, 0), garde=False),)),
        lambda a: nettoyer(
            a,
            Bords(
                aire_min=1,
                garder=1,
                boucher_jusqua=4,
                reboucher_jusqua=4,
                ronger_regonfler=1,
                regonfler_ronger=1,
                vote_voisins=1,
            ),
        ),
    ):
        sortie = moteur(image)
        assert sortie.shape == image.shape
        assert sortie.dtype == np.uint8
