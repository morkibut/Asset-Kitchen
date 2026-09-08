# -*- coding: utf-8 -*-
"""Les critères de B17 — les quatre moteurs qui remplacent une génération.

**Le critère le plus cher est celui qui ne se voit pas**, et c'est le même qu'en
`B1` : six réglages de plus dans la quantification et deux dans les bords
changeraient le JSON canonique de toutes les recettes du disque, donc leur
empreinte, donc le nom de leur rendu — et tout le cache se recalculerait. `B1`
avait posé la règle pour *une place neuve* ; cette tranche-ci la descend d'un
cran, à *une clé neuve dans une place existante*, et ce fichier la tient sur le
corpus figé plutôt que sur une intention.

**Le corpus est celui de `B1`, relu et non refait.** `tests/recettes-avant-b1.json`
porte 61 recettes distinctes relevées le 6 septembre 2026 dans les 170 assets du
dépôt. Seize portent une `quantification` et sept une place `bords` : les deux
places que la tranche étend y sont représentées, ce qui rend un second corpus
inutile.

**Aucun test de ce fichier ne coûte un centime**, et aucun ne touche au réseau :
les quatre moteurs sont du calcul local sur des tableaux `numpy`.
"""

from __future__ import annotations

import json
import time
import tracemalloc
from pathlib import Path

import numpy as np
import pytest

from atelier.domaine.recette import (
    GRAIN_MAX,
    LISSAGE_MAX,
    Bords,
    Contour,
    Echange,
    Grille,
    Passe,
    Quantification,
    Recette,
    Retournement,
)
from atelier.image.traitement import (
    LIT_DE_COULEUR,
    LUMA,
    MAJORITE_DU_VOISINAGE,
    _rotation_de_teinte,
    _sinus_de_la_teinte,
    decrocher_les_coins,
    depoussierer,
    echanger_les_couleurs,
    etaler_sous_la_transparence,
    nettoyer,
    queue,
    regler_les_couleurs,
)

CORPUS = Path(__file__).resolve().parent / "recettes-avant-b1.json"

MAGENTA = (255, 0, 255)
BRUN = (107, 90, 68)
BLEU = (58, 107, 196)
VERT = (0, 255, 0)


# ── De quoi mesurer ──────────────────────────────────────────────────────────


def sujet_detoure(cote: int = 48, marge: int = 12) -> np.ndarray:
    """Une image **telle que le détourage la laisse** : le fond à zéro d'opacité,
    et sa couleur intacte dessous.

    C'est le point de départ de toute la tranche, et il est fabriqué ici plutôt
    que lu d'un fichier : ce qu'on veut mesurer est ce qui reste sous la
    transparence, et un PNG relu aurait pu perdre ces octets-là à l'écriture.
    """
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    image[:, :, :3] = MAGENTA
    image[marge:-marge, marge:-marge, :3] = BRUN
    image[marge:-marge, marge:-marge, 3] = 255
    return image


def porte_du_magenta_sous_le_vide(rgba: np.ndarray) -> bool:
    """Reste-t-il un pixel transparent qui porte encore la couleur du fond ?"""
    vides = rgba[:, :, 3] == 0
    if not vides.any():
        return False
    return bool((rgba[vides][:, :3] == np.array(MAGENTA, dtype=np.uint8)).all(axis=1).any())


def chronometre(fonction, *args, tours: int = 5) -> float:
    """Le meilleur des `tours`, en millisecondes.

    **Le meilleur et non la moyenne** : ce qu'on mesure est le coût du calcul, et
    la moyenne mesure en plus ce que la machine faisait à côté. C'est la règle
    que `tests/test_t2.py` suit déjà pour les durées de traitement.
    """
    durees = []
    for _ in range(tours):
        depart = time.perf_counter()
        fonction(*args)
        durees.append((time.perf_counter() - depart) * 1000)
    return min(durees)


# ── « Les recettes existantes rendent la même empreinte qu'avant » ───────────
#
# Le critère explicite de la tranche, tenu sur le corpus figé de B1.


def test_les_soixante_et_une_recettes_du_depot_gardent_leur_empreinte():
    """**Le critère qui coûte le plus cher, et il ne se voit pas.**

    Huit clés de plus écrites à leur neutre auraient changé les 61 empreintes.
    Écrites seulement quand elles sont posées, elles laissent le canonique d'une
    recette d'avant **strictement identique**.
    """
    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))
    assert len(corpus) == 61, "le corpus figé a changé de taille — il se relit, il ne se refait pas"
    for rang, entree in enumerate(corpus, start=1):
        recette = Recette.depuis_json(entree["recette"])
        assert recette.empreinte() == entree["empreinte"], (
            f"recette {rang} : l'empreinte a bougé — "
            f"{entree['empreinte']} avant, {recette.empreinte()} maintenant"
        )
        assert recette.empreinte_passes() == entree["empreinte_passes"], (
            f"recette {rang} : l'empreinte du détourage a bougé"
        )


def test_le_json_canonique_d_une_recette_d_avant_est_le_meme_caractere_pour_caractere():
    """L'empreinte est un condensé : deux JSON différents pourraient, en théorie,
    rendre le même. Ce test-ci dit *pourquoi* elle tient — aucune des huit clés
    neuves n'apparaît dans une recette qui ne les pose pas.
    """
    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))
    neuves = ("luminosite", "contraste", "saturation", "teinte", "echanges")
    for entree in corpus:
        relue = Recette.depuis_json(entree["recette"]).en_json()
        assert relue == entree["recette"]
        if relue["quantification"] is not None:
            for clef in neuves:
                assert clef not in relue["quantification"], (
                    f"la clé « {clef} » s'écrit alors que personne ne l'a posée"
                )
        if relue["bords"] is not None:
            assert set(relue["bords"]) == {"aire_min"}


@pytest.mark.parametrize(
    "recette, empreinte",
    [
        (Recette(), "3f64f3b07aa09852"),
        (
            Recette(passes=(Passe(),), bords=Bords(aire_min=4), contours=Contour()),
            "f9222deaf029aaa9",
        ),
    ],
)
def test_les_deux_empreintes_mesurees_avant_la_tranche_ne_bougent_pas(recette, empreinte):
    """Les deux valeurs sont celles que `B1` a figées en dur. Elles sont recopiées
    ici plutôt qu'importées : un essai qui lirait la valeur d'un autre essai
    prouverait que le code est d'accord avec lui-même.
    """
    assert recette.empreinte() == empreinte


@pytest.mark.parametrize(
    "recette",
    [
        Recette(quantification=Quantification(luminosite=10)),
        Recette(quantification=Quantification(contraste=-5)),
        Recette(quantification=Quantification(saturation=40)),
        Recette(quantification=Quantification(teinte=90)),
        Recette(quantification=Quantification(echanges=(Echange("#6B5A44", "#3A6BC4"),))),
        Recette(bords=Bords(grain_min=1)),
        Recette(bords=Bords(lissage=2)),
    ],
)
def test_une_cle_neuve_posee_change_bien_l_empreinte(recette):
    """**Le pendant du test d'au-dessus, et il compte autant.** Une clé qui ne
    s'écrit jamais ne changerait jamais rien : ce qui garde l'empreinte des
    recettes d'avant doit quand même refaire le rendu de celles qui posent le
    réglage, sans quoi l'image ne suivrait pas.
    """
    nue = Recette(
        quantification=Quantification() if recette.quantification else None,
        bords=Bords() if recette.bords else None,
    )
    assert recette.empreinte() != nue.empreinte()


@pytest.mark.parametrize(
    "objet",
    [
        Quantification(luminosite=-30, contraste=12, saturation=8, teinte=-170),
        Quantification(echanges=(Echange("#FF00FF", "#000000", 7), Echange("#111111", "#222222"))),
        Bords(aire_min=3, grain_min=2, lissage=3),
    ],
)
def test_les_reglages_neufs_se_relisent_tels_qu_ils_s_ecrivent(objet):
    assert type(objet).depuis_json(objet.en_json()) == objet


# ── Critère 1 : « un fichier exporté ne porte plus de magenta » ──────────────


def test_le_detourage_laissait_bien_du_magenta_sous_la_transparence():
    """**La panne, mesurée avant d'être réparée.** Sans ce test, le suivant
    prouverait seulement que la fonction fait quelque chose.
    """
    assert porte_du_magenta_sous_le_vide(sujet_detoure())


def test_le_lit_de_couleur_retire_tout_le_magenta_sous_les_pixels_vides():
    pose = etaler_sous_la_transparence(sujet_detoure())
    assert not porte_du_magenta_sous_le_vide(pose)


def test_le_lit_de_couleur_pose_la_couleur_du_sujet_juste_autour_de_lui():
    """Ce qui borde le sujet est **sa** couleur, pas une moyenne inventée : c'est
    ce qui fait qu'une réduction de moitié ne fabrique aucun liseré.
    """
    pose = etaler_sous_la_transparence(sujet_detoure())
    for y, x in ((11, 24), (36, 24), (24, 11), (24, 36)):
        assert tuple(pose[y, x, :3]) == BRUN
        assert pose[y, x, 3] == 0, "le lit ne rend rien visible"


def test_le_lit_de_couleur_ne_touche_ni_l_alpha_ni_un_pixel_visible():
    """**Le critère de sûreté du moteur.** Il n'écrit que dans des pixels d'alpha
    exactement nul et ne touche jamais l'alpha : il ne peut donc rien changer à
    ce qu'on voit, seulement à ce qui remonte quand l'image est réduite.
    """
    avant = sujet_detoure()
    apres = etaler_sous_la_transparence(avant)
    assert np.array_equal(avant[:, :, 3], apres[:, :, 3])
    visible = avant[:, :, 3] > 0
    assert np.array_equal(avant[visible], apres[visible])


def test_le_lit_de_couleur_ne_touche_pas_une_image_entierement_opaque():
    pleine = np.full((16, 16, 4), 200, dtype=np.uint8)
    assert np.array_equal(pleine, etaler_sous_la_transparence(pleine))


def test_la_chaine_pose_le_lit_de_couleur_sans_qu_on_le_lui_demande():
    """**Il n'est le réglage de personne** : une recette qui ne le nomme pas —
    donc les 61 du dépôt — en profite quand même. C'est ce qui rend le critère
    vrai pour les images déjà là, et pas seulement pour les prochaines.
    """
    fini = queue(sujet_detoure(), Recette(passes=(Passe(),), bords=Bords(aire_min=1)))
    assert not porte_du_magenta_sous_le_vide(fini)


def test_la_chaine_ne_pose_aucun_lit_sur_une_image_que_rien_n_a_detouree():
    """**Le lit répare ce que le détourage a laissé, et rien d'autre.**

    Le magenta sous la transparence est là parce que *nous* avons mis ces pixels
    à zéro d'opacité sans toucher à leur couleur. Une image que rien n'a
    détourée n'a pas de fond à cacher, et la repeindre serait poser un effet là
    où il n'y a pas de panne.

    La conséquence se dit en une phrase, et c'est elle qui rend la tranche sûre :
    **aucun rendu non détouré ne change**. Les cinq essais du miroir de `B1` la
    mesurent sans avoir eu besoin d'une ligne de plus — ils ont d'ailleurs trouvé
    la première version, qui repeignait tout et cassait l'involution du miroir.
    """
    depart = sujet_detoure()
    for recette in (
        Recette(retournement=Retournement()),
        Recette(bords=Bords(aire_min=1)),
        Recette(passes=(Passe(masquee=True),)),
        Recette(passes=(Passe(),)).endormie("detourage", True),
    ):
        rendu = queue(depart, recette)
        assert porte_du_magenta_sous_le_vide(rendu), (
            "un lit a été posé alors qu'aucun détourage n'agit"
        )


def test_le_lit_commute_avec_le_miroir():
    """**Le défaut que les essais de `B1` ont attrapé, et qui ne se voyait sur
    aucun pixel visible.** La première version prenait *le premier voisin connu
    dans un ordre fixe* ; l'ordre des huit voisins n'est pas symétrique, si bien
    que retourner puis retourner encore ne rendait plus l'image de départ. Le
    choix ne dépend plus que de l'ensemble des couleurs voisines.
    """
    depart = sujet_detoure(40, 9)
    depart[14:20, 14:17, :3] = BLEU  # de quoi rendre le sujet dissymétrique
    pose = etaler_sous_la_transparence(depart)
    assert np.array_equal(
        etaler_sous_la_transparence(depart[:, ::-1, :]), pose[:, ::-1, :]
    )


# ── Critère 2 : « une cape change de couleur, silhouette identique » ─────────


def test_une_cape_change_de_couleur_et_la_silhouette_est_identique_a_l_octet():
    """**Le critère de la tranche, mot pour mot.** Trois pèlerins qui ne
    diffèrent que par leur cape coûtaient trois générations, et les trois
    rendaient trois silhouettes différentes.
    """
    avant = sujet_detoure()
    apres = echanger_les_couleurs(avant, [Echange(depuis="#6B5A44", vers="#3A6BC4")])
    assert tuple(apres[24, 24, :3]) == BLEU
    assert np.array_equal(avant[:, :, 3], apres[:, :, 3]), "la silhouette a bougé"


def test_deux_capes_differentes_rendent_la_meme_silhouette_a_l_octet_pres():
    """Ce que le critère cherche vraiment : **les trois pèlerins sont le même**."""
    base = sujet_detoure()
    bleue = echanger_les_couleurs(base, [Echange("#6B5A44", "#3A6BC4")])
    verte = echanger_les_couleurs(base, [Echange("#6B5A44", "#2E8B3A")])
    assert np.array_equal(bleue[:, :, 3], verte[:, :, 3])
    assert not np.array_equal(bleue[:, :, :3], verte[:, :, :3])


def test_une_paire_ne_repasse_jamais_sur_ce_qu_une_autre_a_pose():
    """Sans cette règle, `brun → bleu` puis `bleu → vert` enverrait le brun au
    vert par un chemin que personne n'a écrit.
    """
    apres = echanger_les_couleurs(
        sujet_detoure(),
        [Echange("#6B5A44", "#3A6BC4"), Echange("#3A6BC4", "#2E8B3A")],
    )
    assert tuple(apres[24, 24, :3]) == BLEU


def test_deux_paires_qui_se_recouvrent_la_premiere_prend_le_pixel():
    """**Le seul cas où l'ordre des lignes décide**, et il vaut d'être épinglé :
    deux paires dont les tolérances attrapent le même pixel. La première de la
    table le prend — c'est la règle qu'on peut lire de haut en bas, et l'aide
    d'écran l'écrit dans ces mots-là.
    """
    image = sujet_detoure()
    haute = echanger_les_couleurs(
        image,
        [Echange("#6B5A44", "#3A6BC4", 8), Echange("#6B5A44", "#2E8B3A", 8)],
    )
    basse = echanger_les_couleurs(
        image,
        [Echange("#6B5A44", "#2E8B3A", 8), Echange("#6B5A44", "#3A6BC4", 8)],
    )
    assert tuple(haute[24, 24, :3]) == BLEU
    assert tuple(basse[24, 24, :3]) != BLEU
    # Et la silhouette ne bouge dans aucun des deux sens.
    assert np.array_equal(haute[:, :, 3], image[:, :, 3])
    assert np.array_equal(basse[:, :, 3], image[:, :, 3])


def test_une_paire_a_moitie_nommee_ne_change_pas_l_empreinte():
    """**La règle de `B1`, poussée jusqu'au bout d'une clé.** Une paire qui ne
    nomme qu'une couleur ne fait rien — le moteur l'ignore —, donc elle ne doit
    pas peser sur le nom du rendu : elle ferait recalculer toute l'image d'un
    sujet pour un réglage sans effet, pendant qu'on va chercher la seconde
    couleur. Elle n'est plus joignable par la route, qui la refuse, mais un
    fichier de recette retouché à la main y menait encore.
    """
    nue = Recette(quantification=Quantification(couleurs=16))
    inachevee = Recette(
        quantification=Quantification(couleurs=16, echanges=(Echange("#6B5A44", ""),))
    )
    achevee = Recette(
        quantification=Quantification(
            couleurs=16, echanges=(Echange("#6B5A44", "#3A6BC4"),)
        )
    )
    assert inachevee.empreinte() == nue.empreinte()
    assert "echanges" not in inachevee.en_json()["quantification"]
    # Et une paire complète, elle, change bien le nom du rendu.
    assert achevee.empreinte() != nue.empreinte()


def test_une_paire_sans_ses_deux_couleurs_ne_fait_rien():
    """Comme une pipette sans point : le temps qu'on aille chercher la seconde
    couleur ne doit pas repeindre l'image sous les yeux de celui qui va cliquer.
    """
    avant = sujet_detoure()
    for boiteuse in (Echange(depuis="#6B5A44"), Echange(vers="#3A6BC4"), Echange()):
        assert np.array_equal(avant, echanger_les_couleurs(avant, [boiteuse]))


def test_la_tolerance_d_un_echange_attrape_les_teintes_voisines():
    """Une cape porte plusieurs bruns ; une seule paire large les prend tous."""
    image = sujet_detoure()
    image[20:28, 20:28, :3] = (110, 93, 71)  # un brun voisin, à 3 crans
    serre = echanger_les_couleurs(image, [Echange("#6B5A44", "#3A6BC4", 0)])
    large = echanger_les_couleurs(image, [Echange("#6B5A44", "#3A6BC4", 8)])
    assert tuple(serre[24, 24, :3]) != BLEU
    assert tuple(large[24, 24, :3]) == BLEU


# ── Critère 3 : « les quatre curseurs se posent avant la quantification » ────


def test_les_quatre_curseurs_au_neutre_rendent_l_image_a_l_octet_pres():
    """**Neutre veut dire sans effet, pas presque sans effet** — la promesse de
    la veille, au cran du réglage. Poser la table sans la régler doit rendre
    exactement l'image d'avant.
    """
    avant = sujet_detoure()
    assert np.array_equal(avant, regler_les_couleurs(avant, Quantification()))


@pytest.mark.parametrize(
    "reglage, attendu",
    [
        ({"luminosite": 30}, "plus clair"),
        ({"luminosite": -30}, "plus sombre"),
        ({"contraste": 50}, "autre"),
        ({"saturation": -100}, "gris"),
        ({"teinte": 180}, "autre"),
    ],
)
def test_chacun_des_quatre_curseurs_change_l_image(reglage, attendu):
    avant = sujet_detoure()
    apres = regler_les_couleurs(avant, Quantification(**reglage))
    cape_avant = avant[24, 24, :3].astype(int)
    cape_apres = apres[24, 24, :3].astype(int)
    assert not np.array_equal(cape_avant, cape_apres)
    if attendu == "plus clair":
        assert cape_apres.sum() > cape_avant.sum()
    elif attendu == "plus sombre":
        assert cape_apres.sum() < cape_avant.sum()
    elif attendu == "gris":
        assert cape_apres[0] == cape_apres[1] == cape_apres[2]


def test_les_curseurs_ne_touchent_jamais_l_alpha():
    avant = sujet_detoure()
    apres = regler_les_couleurs(avant, Quantification(luminosite=40, teinte=90))
    assert np.array_equal(avant[:, :, 3], apres[:, :, 3])


def test_les_curseurs_se_posent_avant_la_quantification_et_l_echange_apres():
    """**Le critère écrit sur l'ordre de la chaîne**, et il se mesure sans lire
    le code : une image éclaircie *puis* réduite à deux couleurs n'a pas les
    mêmes couleurs qu'une image réduite *puis* éclaircie, et une couleur échangée
    après la réduction survit là où elle serait repartie au plus proche.
    """
    depart = sujet_detoure()
    recette = Recette(
        quantification=Quantification(
            couleurs=2,
            palette=("#000000", "#FFFFFF"),
            luminosite=45,
            echanges=(Echange("#FFFFFF", "#3A6BC4"),),
        )
    )
    fini = queue(depart, recette)

    # L'échange a agi après la réduction : le bleu n'est dans aucune des deux
    # couleurs imposées, il ne pourrait pas survivre s'il était posé avant.
    assert tuple(fini[24, 24, :3]) == BLEU

    # Et les curseurs ont agi avant : sans les 45 % de luminosité, la cape brune
    # tombe sur le noir de la palette et non sur le blanc devenu bleu.
    sans_curseur = queue(
        depart,
        Recette(quantification=Quantification(couleurs=2, palette=("#000000", "#FFFFFF"))),
    )
    assert tuple(sans_curseur[24, 24, :3]) == (0, 0, 0)


def test_les_trois_moments_de_la_table_dorment_ensemble():
    """Une place endormie est sans effet — **entièrement** : endormir *Couleurs*
    éteint la réduction, les quatre curseurs et l'échange d'un seul geste, parce
    que c'est une seule table à l'écran comme dans la planche.
    """
    depart = sujet_detoure()
    recette = Recette(
        quantification=Quantification(
            couleurs=2, luminosite=45, echanges=(Echange("#6B5A44", "#3A6BC4"),)
        )
    )
    assert np.array_equal(
        queue(depart, recette.endormie("quantification", True)),
        queue(depart, Recette()),
    )


# ── Critère 4, la part [HARD] : le grain de couleur accroché au sujet ────────


def robe_avec_un_grain() -> np.ndarray:
    """Une robe brune, un grain vert isolé, et un détail vert de deux pixels."""
    image = sujet_detoure()
    image[24, 24, :3] = VERT  # le grain : aucun voisin ne porte sa couleur
    image[20, 20, :3] = VERT  # le détail : deux pixels côte à côte
    image[20, 21, :3] = VERT
    return image


def test_aucun_seuil_de_taille_n_a_jamais_pu_atteindre_le_grain_de_couleur():
    """**La panne, mesurée avant d'être réparée**, et c'est elle que l'affectation
    range en `[HARD]` : le pixel vert est opaque et collé au sujet, donc il n'est
    aucune tache — aucune valeur de `aire_min`, pas même la plus grande, ne le
    voit.
    """
    image = robe_avec_un_grain()
    for seuil in (1, 8, 64, 4096):
        apres = nettoyer(image, Bords(aire_min=seuil))
        assert tuple(apres[24, 24, :3]) == VERT, f"aire_min={seuil} n'aurait pas dû le voir"


def test_le_grain_de_couleur_prend_la_couleur_de_la_majorite_de_ses_voisins():
    apres = depoussierer(robe_avec_un_grain(), 1)
    assert tuple(apres[24, 24, :3]) == BRUN


def test_un_detail_de_deux_pixels_survit_au_depoussierage():
    """**Ce qui sépare une poussière d'un détail** : un détail a un compagnon.
    Chacun des deux pixels verts porte la couleur de l'autre, donc ni l'un ni
    l'autre n'est de la poussière à `grain_min = 1`.
    """
    apres = depoussierer(robe_avec_un_grain(), 1)
    assert tuple(apres[20, 20, :3]) == VERT
    assert tuple(apres[20, 21, :3]) == VERT


def test_a_deux_compagnons_le_detail_de_deux_pixels_part_aussi():
    """Le curseur monte, et il emporte de plus gros grains — comme `aire_min`
    monte et emporte de plus grosses taches. C'est le même geste, sur la couleur.
    """
    apres = depoussierer(robe_avec_un_grain(), 2)
    assert tuple(apres[20, 20, :3]) == BRUN
    assert tuple(apres[20, 21, :3]) == BRUN


def test_le_depoussierage_ne_touche_jamais_le_bord_du_sujet():
    """**La promesse qui le distingue d'un flou.** Un pixel du pourtour n'est pas
    entouré de huit pixels opaques : il n'est jamais candidat, et le moteur ne
    peut donc pas manger la silhouette même par accident.
    """
    image = sujet_detoure()
    image[12, 24, :3] = VERT  # sur le bord haut du sujet, isolé en couleur
    apres = depoussierer(image, 1)
    assert tuple(apres[12, 24, :3]) == VERT


def test_le_depoussierage_ne_touche_jamais_l_alpha():
    avant = robe_avec_un_grain()
    assert np.array_equal(avant[:, :, 3], depoussierer(avant, 3)[:, :, 3])


def test_le_depoussierage_n_invente_aucune_couleur():
    """Il repose une couleur qu'un voisin porte déjà : il ne peut pas faire
    entrer une teinte de plus dans une image qu'on vient de ramener à vingt-quatre.
    """
    avant = robe_avec_un_grain()
    apres = depoussierer(avant, 3)
    connues = {tuple(c) for c in avant[:, :, :3].reshape(-1, 3)}
    assert {tuple(c) for c in apres[:, :, :3].reshape(-1, 3)} <= connues


def test_le_depoussierage_ne_touche_rien_sur_une_image_qui_n_a_pas_ete_reduite():
    """**Le garde-fou du moteur, et il se désarme tout seul.** Sur un dégradé,
    aucun voisinage n'atteint jamais cinq fois la même teinte : le moteur ne
    trouve aucune majorité franche et ne touche rien, au lieu de raser l'image.
    C'est ce qui lui évite d'avoir à être grisé par une règle tenue ailleurs.
    """
    degrade = np.zeros((40, 40, 4), dtype=np.uint8)
    degrade[:, :, 3] = 255
    degrade[:, :, 0] = (np.arange(40, dtype=np.uint16)[None, :] * 6).astype(np.uint8)
    degrade[:, :, 1] = (np.arange(40, dtype=np.uint16)[:, None] * 6).astype(np.uint8)
    assert np.array_equal(degrade, depoussierer(degrade, GRAIN_MAX))


def test_le_depoussierage_ne_depend_pas_de_l_ordre_ou_l_on_balaie_l_image():
    """Le compte se fait sur l'image d'entrée et l'écriture d'un seul coup : deux
    grains voisins se jugent chacun sur ce qui était là. La même recette rend
    donc toujours le même pixel.

    ⚠️ **L'essai d'avant appelait deux fois la même fonction sur le même tableau
    et comparait les deux réponses** — un moteur qui repeindrait pixel après
    pixel, dans l'ordre des lignes, l'aurait passé sans broncher. Il fallait un
    cas où l'ordre change la réponse, et le voici, monté exprès :

    - le **grain vert** en `(20, 20)` a six voisins bruns sur huit : il part, et
      devient brun ;
    - le **grain rouge** juste à côté a quatre voisins bruns, trois bleus, et le
      vert. Aucune couleur n'atteint cinq : **il reste rouge**.

    Un moteur séquentiel repeindrait le vert d'abord, et le rouge verrait alors
    *cinq* bruns — il partirait lui aussi. Les deux pixels de l'assertion sont
    donc exactement la différence entre les deux façons de faire.
    """
    ROUGE, BLEU_VIF = (255, 0, 0), (0, 0, 255)
    image = sujet_detoure()
    image[20, 20, :3] = VERT
    image[20, 21, :3] = ROUGE
    for ligne, colonne in ((19, 21), (19, 22), (20, 22)):
        image[ligne, colonne, :3] = BLEU_VIF

    apres = depoussierer(image, 1)
    assert tuple(apres[20, 20, :3]) == BRUN, "le grain vert devait partir"
    assert tuple(apres[20, 21, :3]) == ROUGE, "le grain rouge n'a aucune majorité"
    # Les trois bleus se portent l'un l'autre : ils ne sont pas des grains.
    for ligne, colonne in ((19, 21), (19, 22), (20, 22)):
        assert tuple(apres[ligne, colonne, :3]) == BLEU_VIF

    # Et la réponse ne dépend ni de l'appel ni de la disposition en mémoire.
    assert np.array_equal(apres, depoussierer(image, 1))
    assert np.array_equal(apres, depoussierer(np.ascontiguousarray(image), 1))


def test_a_zero_le_depoussierage_est_eteint():
    avant = robe_avec_un_grain()
    assert np.array_equal(avant, depoussierer(avant, 0))


# ── Critère 4, la part escalier ─────────────────────────────────────────────


def marche_avec_une_dent() -> np.ndarray:
    image = np.zeros((24, 24, 4), dtype=np.uint8)
    image[:, :, :3] = BRUN
    image[8:16, 8:16, 3] = 255
    image[7, 7, 3] = 255  # une dent qui ne tient que par un coin
    image[7, 9, 3] = 255  # une dent qui tient par un côté
    return image


def test_l_escalier_decroche_le_pixel_qui_ne_tient_que_par_un_coin():
    apres = decrocher_les_coins(marche_avec_une_dent(), 1)
    assert apres[7, 7, 3] == 0


def test_l_escalier_ne_touche_pas_un_pixel_qui_tient_par_un_cote():
    """**Il ne peut rien couper** : un pixel relié par un côté fait partie du
    sujet pour `composantes`, qui compte en quatre voisins depuis `T5`.
    """
    apres = decrocher_les_coins(marche_avec_une_dent(), LISSAGE_MAX)
    assert apres[7, 9, 3] == 255


def test_l_escalier_laisse_l_etincelle_qu_un_seuil_de_taille_aurait_mangee():
    """**Ce qui justifie le moteur, et sans quoi `aire_min` suffisait.**

    Une dent accrochée par un coin et une étincelle qui flotte au large sont, pour
    `composantes`, deux taches d'un pixel : *aucun seuil de taille ne peut prendre
    l'une sans prendre l'autre*. La planche nomme ce raté — *« la pointe de la
    lance du garde, une étincelle, un éclat de magie disparaissent en même temps
    que les miettes »*. Le décrochage, lui, demande **un voisin en diagonale** :
    il ne retire que ce qui touche le sujet, et laisse ce qui flotte.
    """
    image = marche_avec_une_dent()
    image[3, 20, 3] = 255  # une étincelle, à bonne distance du sujet

    decroche = decrocher_les_coins(image, 1)
    assert decroche[7, 7, 3] == 0, "la dent accrochée par un coin devait partir"
    assert decroche[3, 20, 3] == 255, "l'étincelle devait rester"

    # Et le seuil de taille, lui, ne sait pas les distinguer : il prend les deux.
    par_la_taille = nettoyer(image, Bords(aire_min=2))
    assert par_la_taille[7, 7, 3] == 0
    assert par_la_taille[3, 20, 3] == 0


def test_l_escalier_ne_touche_pas_le_corps_du_sujet():
    avant = marche_avec_une_dent()
    apres = decrocher_les_coins(avant, 1)
    assert np.array_equal(avant[8:16, 8:16, 3], apres[8:16, 8:16, 3])


def test_l_escalier_ne_touche_aucune_couleur():
    avant = marche_avec_une_dent()
    apres = decrocher_les_coins(avant, LISSAGE_MAX)
    assert np.array_equal(avant[:, :, :3], apres[:, :, :3])


def test_a_zero_l_escalier_est_eteint():
    avant = marche_avec_une_dent()
    assert np.array_equal(avant, decrocher_les_coins(avant, 0))


def test_nettoyer_enchaine_ses_trois_moteurs_et_reste_l_identite_a_vide():
    """**Une place posée sans être réglée ne change rien.** C'est ce qui permet
    d'ouvrir la table sans que l'image bouge — le défaut que le relevé de la
    planche reproche justement au nettoyage d'aujourd'hui.
    """
    image = robe_avec_un_grain()
    assert np.array_equal(image, nettoyer(image, Bords()))
    tout = nettoyer(image, Bords(aire_min=2, grain_min=1, lissage=1))
    assert tuple(tout[24, 24, :3]) == BRUN


# ── Ce que la tranche ne doit pas casser ailleurs ───────────────────────────


def sujet_a_defauts() -> np.ndarray:
    """Un sujet dissymétrique, avec un grain, une dent de coin et une étincelle."""
    image = np.zeros((24, 24, 4), dtype=np.uint8)
    image[:, :, :3] = MAGENTA
    image[6:18, 6:15, :3] = BRUN
    image[6:18, 6:15, 3] = 255
    image[10, 8, :3] = VERT
    image[5, 5, 3] = 255
    image[20, 3, 3] = 255
    return image


@pytest.mark.parametrize(
    "nom, moteur",
    [
        ("les curseurs", lambda a: regler_les_couleurs(
            a, Quantification(luminosite=20, contraste=10, saturation=30, teinte=70))),
        ("l'échange", lambda a: echanger_les_couleurs(a, [Echange("#FF00FF", "#000000", 5)])),
        ("le grain", lambda a: depoussierer(a, 1)),
        ("l'escalier", lambda a: decrocher_les_coins(a, LISSAGE_MAX)),
        ("le lit de couleur", lambda a: etaler_sous_la_transparence(a)),
        ("nettoyer", lambda a: nettoyer(a, Bords(aire_min=2, grain_min=1, lissage=1))),
    ],
)
def test_chaque_moteur_commute_avec_le_miroir(nom, moteur):
    """**L'invariant que `B1` a posé, et que les cinq moteurs doivent respecter.**

    Un moteur qui dépendrait de la position de ses voisins plutôt que de leur
    ensemble ferait que retourner une image puis la traiter ne donne pas la même
    chose que la traiter puis la retourner — et *retourner deux fois* cesserait
    de rendre l'image de départ. C'est le défaut que la première rédaction du lit
    de couleur portait, et il ne se voyait sur **aucun pixel visible** : ce sont
    les essais de `B1` qui l'ont attrapé.

    L'essai vaut aussi comme filet pour `B18`, qui apporte neuf sens de plus.
    """
    sujet = sujet_a_defauts()
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
def test_aucun_moteur_ne_leve_sur_une_image_degeneree(nom, image):
    """**Un rendu ne tombe pas, jamais.** Le traitement ne lève déjà pas quand le
    détourage a tout mangé — *« un détourage qui a mangé le sujet se voit
    immédiatement et se reprend avec d'autres réglages »*, et se voir suppose
    d'être rendu. Les cinq moteurs neufs suivent la même règle.
    """
    for moteur in (
        lambda a: regler_les_couleurs(a, Quantification(luminosite=20, teinte=70)),
        lambda a: echanger_les_couleurs(a, [Echange("#FF00FF", "#000000", 5)]),
        lambda a: depoussierer(a, 1),
        lambda a: decrocher_les_coins(a, LISSAGE_MAX),
        etaler_sous_la_transparence,
        lambda a: nettoyer(a, Bords(aire_min=2, grain_min=1, lissage=1)),
    ):
        sortie = moteur(image)
        assert sortie.shape == image.shape
        assert sortie.dtype == np.uint8


def test_la_rotation_de_teinte_laisse_le_gris_gris():
    """Elle tourne **autour de l'axe des gris** : un gris n'a pas de teinte à
    tourner, et un moteur qui le colorerait trahirait qu'il décale des canaux au
    lieu de tourner une roue.
    """
    gris = np.dstack([np.full((2, 2, 3), 128, np.uint8), np.full((2, 2), 255, np.uint8)])
    tourne = regler_les_couleurs(gris, Quantification(teinte=90))
    assert tourne[0, 0, 0] == tourne[0, 0, 1] == tourne[0, 0, 2]


def test_la_rotation_de_teinte_envoie_le_rouge_sur_le_vert_puis_sur_le_bleu():
    """**L'essai qui manquait**, et son absence a coûté un vrai défaut : la
    première écriture de la matrice mêlait les constantes du filtre du W3C à la
    luma de Rec. 601, et **86 des 87 essais du fichier restaient au vert** avec
    la matrice identité à la place de la rotation. Rien ne mesurait ce que la
    rotation calcule.

    Une roue des couleurs fait trois tiers de tour : le rouge passe au vert,
    puis au bleu, puis revient. C'est vérifiable sans rien connaître de la
    matrice, et c'est la première chose qu'un œil vérifierait.
    """
    rouge = np.array([1.0, 0.0, 0.0])
    assert int(np.argmax(_rotation_de_teinte(120).astype(np.float64) @ rouge)) == 1
    assert int(np.argmax(_rotation_de_teinte(240).astype(np.float64) @ rouge)) == 2


@pytest.mark.parametrize("angle", [30, 90, 120, 180, -60])
def test_la_rotation_de_teinte_conserve_la_luminosite_percue(angle):
    """**C'est ce qui la distingue d'un décalage de canaux**, et c'est la
    propriété que le défaut d'origine cassait sans qu'aucun pixel gris ne le
    montre : un bleu saturé gagnait 30 % de luminosité en tournant de 90°.

    Deux faits, tous deux à 10⁻⁶ près : la luma de la sortie est celle de
    l'entrée, et l'aller-retour rend l'identité — donc c'est une rotation, pas
    une déformation.
    """
    matrice = _rotation_de_teinte(angle).astype(np.float64)
    luma = np.array(LUMA, dtype=np.float64)
    assert float(np.abs(luma @ matrice - luma).max()) < 1e-6
    retour = _rotation_de_teinte(-angle).astype(np.float64) @ matrice
    assert float(np.abs(retour - np.eye(3)).max()) < 1e-6


def test_les_trois_nombres_de_la_teinte_se_deduisent_de_la_luma():
    """**Ils ne se recopient pas, ils se calculent.** Rendus à la luma du W3C,
    ils redonnent les trois nombres de la spécification — c'est la preuve que la
    formule est la bonne, et l'explication du défaut : ces nombres-là *sont* la
    luma du W3C, et les poser à côté de la nôtre faisait une matrice bâtarde.
    """
    w3c = _sinus_de_la_teinte((0.213, 0.715, 0.072))
    assert [round(x, 3) for x in w3c] == [0.143, 0.141, -0.284]
    assert [round(x, 5) for x in _sinus_de_la_teinte(LUMA)] == [0.28844, 0.185, -0.47344]


@pytest.mark.parametrize(
    "reglage, attendu",
    [
        ({"luminosite": 100}, ((255, 255, 255), (255, 255, 255))),
        ({"luminosite": -100}, ((0, 0, 0), (0, 0, 0))),
        ({"contraste": 100}, ((255, 0, 0), (0, 255, 0))),
        ({"saturation": 100}, ((255, 0, 0), (0, 255, 0))),
    ],
)
def test_les_curseurs_aux_bornes_ne_debordent_pas(reglage, attendu):
    """Un octet ne se replie pas : 255 + 1 doit rester 255, pas devenir 0.

    ⚠️ **L'essai d'avant ne disait rien du tout** : il vérifiait `min ≥ 0` et
    `max ≤ 255` sur un tableau d'octets, ce qui est vrai par construction — un
    repli aurait rendu `(254, 254, 254)` et serait passé sans un mot. Il compare
    maintenant les trois octets, un par un.
    """
    vif = np.dstack(
        [np.array([[[255, 0, 0], [0, 255, 0]]], np.uint8), np.full((1, 2), 255, np.uint8)]
    )
    sortie = regler_les_couleurs(vif, Quantification(**reglage))
    assert sortie.dtype == np.uint8
    assert tuple(sortie[0, 0, :3]) == attendu[0]
    assert tuple(sortie[0, 1, :3]) == attendu[1]
    # Et l'alpha n'a pas bougé : les quatre curseurs ne touchent pas au bord.
    assert tuple(int(a) for a in sortie[0, :, 3]) == (255, 255)


# ── Critère 5 : « chaque moteur neuf est mesuré » ────────────────────────────
#
# **Le temps, et ce que le moteur épargne.** Les deux nombres sont demandés
# ensemble par le plan, et ce n'est pas une coquetterie : un moteur gratuit qui
# coûterait une seconde ne remplacerait pas une génération, il la déplacerait.


# Ce qu'une image coûte chez le fournisseur, en dollars. Le chiffre est celui de
# la planche `Retouche.dc.html`, qui l'a relevé sur les dépenses du dépôt.
PRIX_D_UNE_IMAGE = 0.019

# Au-delà, l'écran doit montrer une jauge (`B16`). Un moteur de cette tranche qui
# dépasserait ce seuil sur une case de 64 carrés cesserait d'être « instantané »,
# et c'est ce que la mesure surveille.
INSTANTANE_MS = 240


@pytest.mark.parametrize(
    "nom, fabrique, appel, epargne",
    [
        (
            "le lit de couleur",
            lambda: (sujet_detoure(64, 16),),
            lambda img: etaler_sous_la_transparence(img),
            "un liseré de magenta sur chaque image rangée dans une planche — "
            "sinon la seule réparation est de regénérer",
        ),
        (
            "l'échange de couleurs",
            lambda: (sujet_detoure(64, 16), [Echange("#6B5A44", "#3A6BC4", 4)]),
            lambda img, ech: echanger_les_couleurs(img, ech),
            f"une génération par variante de couleur, soit ${PRIX_D_UNE_IMAGE} "
            "— et la silhouette reste la même, ce qu'une génération ne rend jamais",
        ),
        (
            "les quatre curseurs",
            lambda: (sujet_detoure(64, 16), Quantification(luminosite=20, teinte=30)),
            lambda img, q: regler_les_couleurs(img, q),
            f"une génération par tirage mal exposé, soit ${PRIX_D_UNE_IMAGE}",
        ),
        (
            "le grain de couleur",
            lambda: (robe_avec_un_grain(), 1),
            lambda img, n: depoussierer(img, n),
            "une génération par image piquée d'un pixel faux — aucun réglage "
            "d'avant la tranche ne pouvait l'atteindre",
        ),
        (
            "l'escalier",
            lambda: (marche_avec_une_dent(), LISSAGE_MAX),
            lambda img, n: decrocher_les_coins(img, n),
            "la reprise à la main d'un bord hérissé, pixel par pixel",
        ),
    ],
)
def test_chaque_moteur_neuf_est_mesure(nom, fabrique, appel, epargne, capsys):
    """**La mesure est le critère, pas un commentaire.** Elle s'imprime avec
    `pytest -s`, et elle échoue si un moteur cesse d'être instantané sur la case
    de 64 carrés qui est la taille de travail du produit.
    """
    args = fabrique()
    duree = chronometre(appel, *args)
    with capsys.disabled():
        print(f"\n  {nom} : {duree:.2f} ms — épargne {epargne}")
    assert duree < INSTANTANE_MS, (
        f"{nom} met {duree:.1f} ms sur une case de 64 : ce n'est plus gratuit à l'œil"
    )


def test_la_chaine_entiere_reste_instantanee_avec_les_quatre_moteurs_poses():
    """Les quatre ensemble, sur la case de 64 carrés du produit — c'est le seul
    chiffre qui dise ce que l'auteur attendra vraiment devant son écran.
    """
    recette = Recette(
        grille=Grille(cible=64),
        quantification=Quantification(
            couleurs=16, luminosite=15, saturation=10, echanges=(Echange("#6B5A44", "#3A6BC4", 6),)
        ),
        bords=Bords(aire_min=2, grain_min=1, lissage=1),
    )
    depart = sujet_detoure(64, 16)
    duree = chronometre(lambda: queue(depart, recette), tours=3)
    assert duree < INSTANTANE_MS * 4, f"la chaîne entière met {duree:.0f} ms"


# Le pic de mémoire toléré par les deux moteurs qui balaient l'image, sur le
# pire cas de 2 048 px. Cent mégaoctets mesurés, trois cents tolérés : c'est un
# garde-fou qui ne dépend pas de la vitesse de la machine, contrairement à une
# durée — et c'est le seul chiffre qui aurait attrapé le défaut d'origine.
PIC_TOLERE_MO = 300


def image_non_reduite(cote: int) -> np.ndarray:
    """Un sujet détouré **dont chaque pixel a sa nuance** — le cas où le grain de
    couleur ne fait rien, et où il coûtait le plus cher.
    """
    image = np.zeros((cote, cote, 4), dtype=np.uint8)
    lignes, colonnes = np.ogrid[:cote, :cote]
    image[:, :, 0] = (lignes * 255 // (cote - 1)).astype(np.uint8)
    image[:, :, 1] = (colonnes * 255 // (cote - 1)).astype(np.uint8)
    image[:, :, 2] = ((lignes + colonnes) * 127 // (cote - 1)).astype(np.uint8)
    dedans = (lignes - cote // 2) ** 2 + (colonnes - cote // 2) ** 2 < (cote // 3) ** 2
    image[:, :, 3] = np.where(dedans, 255, 0).astype(np.uint8)
    return image


@pytest.mark.parametrize(
    "nom, moteur",
    [
        ("le grain de couleur", lambda img: depoussierer(img, GRAIN_MAX)),
        ("le lit de couleur", etaler_sous_la_transparence),
    ],
)
def test_les_deux_moteurs_qui_balaient_l_image_tiennent_sur_un_dessin_de_2048(
    nom, moteur, capsys
):
    """⚠️ **La mesure de 64 px ne disait rien du dessin de 2 048.**

    Les deux moteurs de cette liste parcourent toute l'image, et rien n'oblige
    une image à faire 64 px de côté : un import retouché, ou un projet sans
    taille cible, passe dans la chaîne à la résolution de sa source. La première
    écriture y mettait **sept secondes et 1,78 Go** pour le grain, et 2,2 s pour
    le lit — sur un cas où le grain ne change pas un pixel. Les deux essais de
    64 px passaient pendant ce temps-là.

    Le pic de mémoire est mesuré plutôt qu'une durée parce qu'il ne dépend pas de
    la machine : c'est lui qui dit qu'aucun des deux n'empile plus les huit
    voisins de l'image entière. La durée s'imprime avec `pytest -s`, sans
    garde-fou : elle est une information, pas un critère.
    """
    image = image_non_reduite(2048)
    tracemalloc.start()
    debut = time.perf_counter()
    sortie = moteur(image)
    duree = (time.perf_counter() - debut) * 1000
    _, pic = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    with capsys.disabled():
        print(f"\n  {nom}, sur 2 048 px : {duree:.0f} ms · pic {pic / 1e6:.0f} Mo")
    assert sortie.shape == image.shape
    assert pic / 1e6 < PIC_TOLERE_MO, (
        f"{nom} monte à {pic / 1e6:.0f} Mo sur une image de 2 048 : "
        "il empile de nouveau le voisinage de l'image entière"
    )


def test_le_grain_de_couleur_ne_touche_a_rien_sur_une_image_non_reduite():
    """**Le garde-fou de la majorité franche, sur une vraie image.** Aucun
    voisinage d'un dégradé n'atteint cinq fois la même couleur : le moteur se
    désarme tout seul, au lieu de raser le dégradé. C'est ce qui permet de poser
    le réglage sans savoir si l'image a été réduite ou non.
    """
    image = image_non_reduite(96)
    assert np.array_equal(depoussierer(image, GRAIN_MAX), image)


def test_le_lit_de_couleur_du_domaine_et_celui_de_l_ecran_disent_le_meme_nombre():
    """**Deux listes pour un fait finissent toujours par diverger.** L'écran
    annonce la largeur du lit en toutes lettres ; si le traitement en changeait
    sans qu'elle suive, la phrase mentirait sans qu'une ligne ne lève.
    """
    source = (
        Path(__file__).resolve().parents[1] / "interface" / "src" / "api.ts"
    ).read_text(encoding="utf-8")
    assert f"export const LIT_DE_COULEUR = {LIT_DE_COULEUR}" in source


def test_les_bornes_du_domaine_et_celles_de_l_ecran_disent_la_meme_chose():
    source = (
        Path(__file__).resolve().parents[1] / "interface" / "src" / "api.ts"
    ).read_text(encoding="utf-8")
    assert f"export const GRAIN_MAX = {GRAIN_MAX}" in source
    assert f"export const LISSAGE_MAX = {LISSAGE_MAX}" in source


def test_la_majorite_du_voisinage_est_une_majorite_franche():
    """Cinq sur huit, et pas quatre : c'est ce chiffre qui désarme le moteur sur
    une image non réduite, et une majorité relative ne l'aurait pas fait.
    """
    assert MAJORITE_DU_VOISINAGE > 8 // 2


# ── Ce que la route refuse, et pourquoi ─────────────────────────────────────


@pytest.mark.parametrize(
    "quantification, morceau",
    [
        ({"luminosite": 200}, "luminosite"),
        ({"contraste": -900}, "contraste"),
        ({"saturation": 101}, "saturation"),
        ({"teinte": 400}, "teinte"),
        ({"echanges": [{"depuis": "#FF00FF", "vers": ""}]}, "échange"),
    ],
)
def test_la_route_refuse_un_reglage_de_couleur_hors_bornes(
    client, quantification, morceau
):
    """**Deux portes, deux codes, et les deux comptent.** Une valeur hors borne
    est arrêtée par le modèle Pydantic en 422 ; une paire qui ne nomme rien passe
    la porte et tombe sur le filet du service, qui refuse en 409 avec sa raison.
    Le refus **nomme le réglage en cause** dans les deux cas — c'est la règle du
    produit, et sans elle le message dirait seulement qu'une recette est
    invalide.
    """
    identifiant = _un_asset(client)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "quantification": {"couleurs": 16, **quantification}},
    )
    assert reponse.status_code in (400, 409, 422), reponse.text
    assert morceau in reponse.text, "le refus ne dit pas quel réglage est en cause"


@pytest.mark.parametrize("bords, morceau", [({"grain_min": 99}, "grain"), ({"lissage": 9}, "lissage")])
def test_la_route_refuse_un_nettoyage_hors_bornes(client, bords, morceau):
    identifiant = _un_asset(client)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "bords": {"aire_min": 0, **bords}},
    )
    assert reponse.status_code in (400, 409, 422), reponse.text


def test_les_six_reglages_neufs_voyagent_par_la_route_et_reviennent(client):
    """**Le piège de `decalage`, en E17** : l'écran renvoie la recette entière à
    chaque geste, et un champ absent du modèle Pydantic est jeté en silence. Ce
    test-ci le mesure sur les six réglages d'un coup.
    """
    identifiant = _un_asset(client)
    envoi = {
        "passes": [],
        "quantification": {
            "couleurs": 16,
            "palette": [],
            "tramage": "aucun",
            "luminosite": 12,
            "contraste": -8,
            "saturation": 5,
            "teinte": -30,
            "echanges": [{"depuis": "#6B5A44", "vers": "#3A6BC4", "tolerance": 4}],
        },
        "bords": {"aire_min": 2, "grain_min": 1, "lissage": 2},
    }
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=envoi)
    assert reponse.status_code == 200, reponse.text
    rendu = reponse.json()["recette"]
    assert rendu["quantification"]["luminosite"] == 12
    assert rendu["quantification"]["contraste"] == -8
    assert rendu["quantification"]["saturation"] == 5
    assert rendu["quantification"]["teinte"] == -30
    assert rendu["quantification"]["echanges"] == [
        {"depuis": "#6B5A44", "vers": "#3A6BC4", "tolerance": 4}
    ]
    assert rendu["bords"] == {"aire_min": 2, "grain_min": 1, "lissage": 2}


def _un_asset(client) -> str:
    """Une image importée, sans un centime dépensé."""
    from conftest import image_sujet

    reponse = client.post(
        "/api/assets/upload?nom=pelerin.png&traiter=false",
        content=image_sujet(),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]
