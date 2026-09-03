# -*- coding: utf-8 -*-
"""Les critères de E5 — le contour et la main, les deux dernières places.

**Ce qui se mesure ici, et ce qui se mesure à l'écran.** Un contour se règle en
regardant l'image, et cette moitié-là vit dans `interface/src/App.test.tsx`. Ce
qui vit ici est ce qu'aucun écran ne peut prouver : que le trait tombe au bon
endroit, qu'il agrandit de ce qu'il annonce, que la main passe en dernier, et
qu'un passage enregistré comme un tracé se rejoue sur une image d'une autre
taille.

**Aucun test de ce fichier ne coûte un centime**, et la plupart ne lisent même
pas de fichier : ils travaillent sur des tableaux construits à la main, parce
que ce qu'ils vérifient est une propriété des fonctions.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.recette import (
    CalqueDessin,
    Contour,
    Grille,
    Main,
    Quantification,
    Recette,
    Trait,
)
from atelier.image.traitement import contourner, finir, queue, retoucher
from tests.conftest import image_sujet


def _carre(cote: int = 12, dedans: int = 4, couleur=(200, 50, 50)) -> np.ndarray:
    """Un carré plein au milieu d'un cadre transparent."""
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    marge = (cote - dedans) // 2
    rgba[marge : marge + dedans, marge : marge + dedans, :3] = couleur
    rgba[marge : marge + dedans, marge : marge + dedans, 3] = 255
    return rgba


def _anneau(rgba: np.ndarray, couleur=(17, 34, 51)) -> np.ndarray:
    """Les pixels qui portent exactement cette couleur, opaques."""
    return (rgba[:, :, 3] == 255) & (rgba[:, :, :3] == np.array(couleur)).all(axis=2)


# ── « Le contour se pose après la grille et après la quantification » ─────────


def test_le_contour_garde_exactement_la_couleur_choisie():
    """C'est ce que « après la quantification » veut dire, et c'est mesurable.

    Un noir pur tracé **avant** ressortirait au plus proche de la palette,
    c'est-à-dire peut-être pas noir — sur une palette de rouges, franchement
    pas. La place du contour dans l'ordre n'est donc pas une préférence de
    lecture : c'est la seule qui rende la promesse « la couleur que tu as
    choisie » vraie.
    """
    recette = Recette(
        quantification=Quantification(couleurs=4, palette=("#c83232", "#7d1f1f")),
        contours=Contour(epaisseur=1, couleur="#000000", position="interne"),
    )
    rendu = queue(_carre(), recette)

    assert _anneau(rendu, (0, 0, 0)).any(), "le trait n'a pas été tracé"


def test_le_contour_se_trace_sur_la_silhouette_definitive():
    """Tracé avant la grille, il serait rééchantillonné comme le reste.

    La panne qu'on répare est celle-là même : une ligne d'un pixel survit là où
    elle tombe sur un centre de bloc et disparaît ailleurs. Après la grille, un
    pixel de trait **est** un pixel du rendu, et l'épaisseur demandée est
    l'épaisseur obtenue.
    """
    grand = _carre(cote=64, dedans=32)
    recette = Recette(
        grille=Grille(cible=16, occupation=100),
        contours=Contour(epaisseur=1, couleur="#112233", position="externe"),
    )
    rendu = queue(grand, recette)

    # 16 de côté après la grille, plus un pixel de trait de chaque bord.
    assert rendu.shape[:2] == (18, 18)
    # Le sujet occupait la moitié de son image : ramené à 16, il fait 8. Le
    # trait fait le tour de **ce** carré-là — un anneau d'un pixel autour d'un
    # bloc de 8 pèserait 10 × 10 moins 8 × 8, **moins ses quatre coins**.
    #
    # ⚠️ **Ce test comptait 36 jusqu'à D4, et il en compte 32 depuis.** Le trait
    # d'une épaisseur se pose désormais en croix et non en carré : le carré
    # posait des pixels dans le prolongement diagonal des coins, ce qu'un pixel
    # artiste ne dessine pas. Au-delà d'une épaisseur le carré reprend — une
    # croix répétée donne un losange —, et les essais de croissance ci-dessous
    # ne bougent pas d'un pixel, puisque la boîte grandit pareil.
    assert int(_anneau(rendu).sum()) == 10 * 10 - 8 * 8 - 4


# ── « Choisir la position extérieure écrit que l'image s'agrandit » ───────────


@pytest.mark.parametrize(
    "position, epaisseur, croissance",
    [
        ("externe", 1, 2),
        ("externe", 3, 6),
        ("interne", 1, 0),
        ("interne", 4, 0),
        ("centre", 2, 2),
        # **Le pixel impair va vers l'extérieur** : agrandir est réversible,
        # manger le sujet ne l'est pas. À trois, la moitié qui ne tombe pas
        # juste déborde, et la croissance vaut donc quatre et non trois.
        ("centre", 3, 4),
    ],
)
def test_la_position_decide_de_l_agrandissement(position, epaisseur, croissance):
    """Le seul réglage du produit qui change les dimensions du rendu.

    C'est pour ça qu'US-206 exige que l'écran l'écrive au moment du choix — et
    c'est pour ça que le chiffre annoncé doit être **celui-ci**, pris sur
    l'image et non sur l'intention.
    """
    image = _carre()
    rendu = contourner(image, Contour(epaisseur=epaisseur, position=position))

    assert rendu.shape[0] - image.shape[0] == croissance
    assert rendu.shape[1] - image.shape[1] == croissance


def test_l_epaisseur_obtenue_est_l_epaisseur_demandee():
    """Un contour en losange se verrait aux quatre coins.

    Le voisinage de huit rend un trait d'épaisseur constante dans toutes les
    directions ; une croix répétée donnerait un losange, c'est-à-dire une
    épaisseur qui dépend de la direction du bord.
    """
    image = _carre(cote=20, dedans=8)
    rendu = contourner(image, Contour(epaisseur=2, position="externe"))

    lignes = np.flatnonzero(_anneau(rendu, (0, 0, 0)).any(axis=1))
    colonnes = np.flatnonzero(_anneau(rendu, (0, 0, 0)).any(axis=0))
    # Le carré fait 8 ; avec deux pixels de trait de chaque côté, 12.
    assert int(lignes[-1] - lignes[0] + 1) == 12
    assert int(colonnes[-1] - colonnes[0] + 1) == 12


# ── Les trous, cerclés ou laissés ────────────────────────────────────────────


def _carre_perce() -> np.ndarray:
    """Un carré avec un trou au milieu — une boucle de ceinture."""
    rgba = _carre(cote=16, dedans=10)
    rgba[7:9, 7:9, 3] = 0
    return rgba


def test_cercles_traite_un_trou_comme_un_bord():
    """Un trou de la silhouette **est** un bord du sujet.

    C'est ce que fait un style « contour noir 2 px », et c'est le défaut pour
    cette raison-là : l'exception est de vouloir une découpe nette sans lignes
    à l'intérieur.
    """
    rendu = contourner(_carre_perce(), Contour(epaisseur=1, position="interne"))
    milieu = _anneau(rendu, (0, 0, 0))[6:10, 6:10]

    assert milieu.any(), "le trou n'a pas reçu de trait"


def test_laisses_ne_trace_que_le_pourtour():
    """La même image, l'autre réglage, et le milieu reste intact."""
    rendu = contourner(
        _carre_perce(), Contour(epaisseur=1, position="interne", trous="laisses")
    )
    milieu = _anneau(rendu, (0, 0, 0))[6:10, 6:10]

    assert not milieu.any(), "le trou a reçu un trait alors qu'on l'a laissé"
    assert _anneau(rendu, (0, 0, 0)).any(), "le pourtour n'a pas été tracé"


def test_une_image_entierement_opaque_ne_recoit_aucun_trait():
    """Elle n'a pas de bord de sujet, seulement les quatre bords du cadre.

    Un rectangle noir autour de l'image n'est jamais ce qu'on voulait. L'écran
    grise la table avec sa raison ; **le module, lui, ne refuse pas** — il rend
    l'image telle quelle, parce qu'un module pur ne juge pas.
    """
    pleine = np.zeros((8, 8, 4), dtype=np.uint8)
    pleine[:, :, :3] = (90, 90, 90)
    pleine[:, :, 3] = 255

    assert (contourner(pleine, Contour(epaisseur=2)) == pleine).all()


# ── « La main ôte et remet des pixels, à main levée puis au pixel » ───────────


def test_l_opacite_ote_et_remet_ce_que_l_image_avait():
    """**Remettre ne fabrique aucune couleur.**

    Ni le détourage ni la quantification ne touchent au canal des couleurs
    quand ils retirent l'alpha : la couleur d'un pixel ôté est toujours dans le
    tableau. C'est ce qui fait de « remettre ce que l'image avait avant qu'on le
    retire » une phrase exacte, et non une approximation.
    """
    image = _carre(cote=10, dedans=4, couleur=(10, 120, 200))
    ote = retoucher(image, Main(opacite=(Trait(garde=False, points=((4, 4),)),)))

    assert ote[4, 4, 3] == 0
    assert tuple(ote[4, 4, :3]) == (10, 120, 200)  # la couleur est restée dessous

    remis = retoucher(
        ote, Main(opacite=(Trait(garde=True, points=((4, 4),)),))
    )
    assert remis[4, 4, 3] == 255
    assert tuple(remis[4, 4, :3]) == (10, 120, 200)


def test_le_rayon_zero_est_le_pixel():
    """Les deux échelles du geste sont les deux bouts d'un seul réglage.

    Un rayon nul ne couvre qu'un pixel de large ; c'est l'autre bout de « à main
    levée, puis au pixel », et non un second outil qui aurait son propre chemin
    de rendu.
    """
    image = _carre(cote=10, dedans=6)
    ote = retoucher(image, Main(opacite=(Trait(garde=False, rayon=0, points=((4, 4),)),)))

    assert int((image[:, :, 3] > 0).sum()) - int((ote[:, :, 3] > 0).sum()) == 1


def test_le_dernier_passage_l_emporte():
    """Comme un pinceau sur une toile.

    Additionner les surfaces aurait rendu le retrait impossible à faire après
    coup, donc irrattrapable — et toute la main est là pour rattraper.
    """
    image = _carre(cote=10, dedans=6)
    main = Main(
        opacite=(
            Trait(garde=False, rayon=1, points=((4, 4),)),
            Trait(garde=True, rayon=0, points=((4, 4),)),
        )
    )
    rendu = retoucher(image, main)

    assert rendu[4, 4, 3] == 255  # le second passage a repris le pixel du premier
    assert rendu[3, 4, 3] == 0  # et pas ses voisins


# ── Les calques de dessin ────────────────────────────────────────────────────


def test_un_calque_pose_de_la_matiere_a_la_couleur_du_passage():
    """**La couleur est portée par le passage, pas par le calque.**

    Un calque n'est donc pas monochrome, et l'ajout d'un remplissage ou d'un
    dégradé ne demandera pas de le redéfinir.
    """
    image = _carre(cote=10, dedans=4)
    calque = CalqueDessin(
        nom="rouille",
        passages=(
            Trait(garde=True, rayon=0, points=((0, 0),), couleur="#6e5a3c"),
            Trait(garde=True, rayon=0, points=((9, 9),), couleur="#ffffff"),
        ),
    )
    rendu = retoucher(image, Main(calques=(calque,)))

    assert tuple(rendu[0, 0]) == (0x6E, 0x5A, 0x3C, 255)
    assert tuple(rendu[9, 9]) == (255, 255, 255, 255)


def test_masquer_un_calque_n_efface_rien():
    """C'est très exactement la différence entre masquer et supprimer."""
    image = _carre(cote=10, dedans=4)
    passages = (Trait(garde=True, rayon=0, points=((0, 0),), couleur="#ffffff"),)

    montre = retoucher(image, Main(calques=(CalqueDessin(passages=passages),)))
    masque = retoucher(
        image, Main(calques=(CalqueDessin(visible=False, passages=passages),))
    )

    assert tuple(montre[0, 0]) == (255, 255, 255, 255)
    assert (masque == image).all()


def test_l_ordre_de_la_pile_decide_de_ce_qu_on_voit():
    """Le dessus l'emporte, et la liste est rangée du dessous vers le dessus.

    L'ordre du fichier est l'ordre d'application, comme pour les sept places
    elles-mêmes ; c'est l'écran qui renverse pour montrer une pile.
    """
    image = _carre(cote=10, dedans=4)
    dessous = CalqueDessin(
        nom="dessous", passages=(Trait(rayon=0, points=((0, 0),), couleur="#111111"),)
    )
    dessus = CalqueDessin(
        nom="dessus", passages=(Trait(rayon=0, points=((0, 0),), couleur="#eeeeee"),)
    )

    assert tuple(retoucher(image, Main(calques=(dessous, dessus)))[0, 0, :3]) == (
        0xEE,
        0xEE,
        0xEE,
    )
    assert tuple(retoucher(image, Main(calques=(dessus, dessous)))[0, 0, :3]) == (
        0x11,
        0x11,
        0x11,
    )


def test_effacer_ne_retire_que_ce_que_ce_calque_la_avait_pose():
    """Le pixel retombe sur ce qu'il y avait dessous, jamais sur du vide.

    C'est pour ça qu'un calque se calcule à part **puis** se pose, et non trait
    par trait à même l'image : autrement, effacer trouerait ce que le calque du
    dessous venait d'écrire.
    """
    image = _carre(cote=10, dedans=6, couleur=(10, 120, 200))
    calque = CalqueDessin(
        passages=(
            Trait(garde=True, rayon=1, points=((5, 5),), couleur="#ffffff"),
            Trait(garde=False, rayon=0, points=((5, 5),)),
        )
    )
    rendu = retoucher(image, Main(calques=(calque,)))

    assert tuple(rendu[5, 5]) == (10, 120, 200, 255)  # le sujet, intact
    assert tuple(rendu[4, 5, :3]) == (255, 255, 255)  # le voisin, peint


# ── « Un passage survit à un changement de taille de grille » ────────────────


def test_un_passage_se_rejoue_sur_une_image_d_une_autre_taille():
    """**Un vecteur, jamais une image** (US-209).

    Ce qui est enregistré est le chemin parcouru, son rayon et sa couleur — pas
    les pixels qu'il produit. Remettre la grille à une autre cible ne fait donc
    pas perdre le dessin : le passage se rejoue, il ne se relit pas.
    """
    main = Main(
        calques=(
            CalqueDessin(passages=(Trait(rayon=0, points=((3, 3),), couleur="#ffffff"),)),
        )
    )
    petite = retoucher(_carre(cote=8, dedans=4), main)
    grande = retoucher(_carre(cote=40, dedans=20), main)

    assert tuple(petite[3, 3]) == (255, 255, 255, 255)
    assert tuple(grande[3, 3]) == (255, 255, 255, 255)


# ── « La main est la dernière place, et rien ne se rejoue après elle » ────────


def test_le_contour_ne_repasse_jamais_sur_ce_que_la_main_a_pose():
    """L'ordre se prouve par ce qui ne se produit pas.

    Si le contour passait après, un pixel ôté à la main au bord du sujet
    fabriquerait un nouveau bord — et le trait viendrait le souligner, c'est-à-
    dire défaire le geste qu'on vient de faire.
    """
    recette = Recette(
        contours=Contour(epaisseur=1, couleur="#000000", position="interne"),
        main=Main(opacite=(Trait(garde=False, rayon=0, points=((6, 6),)),)),
    )
    rendu = queue(_carre(cote=12, dedans=8), recette)

    # Le pixel ôté est bien parti, et il n'a pas été rebordé.
    assert rendu[6, 6, 3] == 0
    voisins = rendu[5:8, 5:8]
    assert int(_anneau(voisins, (0, 0, 0)).sum()) == 0


# ── « Le rendu reste un cache » ───────────────────────────────────────────────


def test_deux_rendus_de_la_meme_recette_donnent_le_meme_fichier():
    """Effacer le rendu et le recalculer redonne exactement la même image.

    C'est le critère de T2, et les deux places de E5 ne l'entament pas : le
    tracé passe par une rasterisation fixe, et la morphologie est de
    l'arithmétique sur des booléens. Rien n'est tiré au sort.
    """
    recette = Recette(
        contours=Contour(epaisseur=2, couleur="#14161b", position="centre"),
        main=Main(
            opacite=(Trait(garde=False, rayon=2, points=((4, 4), (8, 8))),),
            calques=(
                CalqueDessin(
                    passages=(Trait(rayon=1, points=((2, 9),), couleur="#6e5a3c"),)
                ),
            ),
        ),
    )
    image = _carre(cote=14, dedans=8)

    assert finir(image, recette).octets == finir(image, recette).octets


def test_l_empreinte_change_quand_une_des_deux_places_change():
    """Deux recettes qui rendent deux images ne peuvent pas partager un cache."""
    nue = Recette(grille=Grille(cible=32))
    tracee = Recette(grille=Grille(cible=32), contours=Contour(epaisseur=1))
    peinte = Recette(
        grille=Grille(cible=32),
        main=Main(opacite=(Trait(garde=False, points=((1, 1),)),)),
    )

    empreintes = {nue.empreinte(), tracee.empreinte(), peinte.empreinte()}
    assert len(empreintes) == 3


# ── Ce qui traverse le port, et ce qui survit ────────────────────────────────


def _asset(client, double) -> dict:
    double.rendre = lambda: image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _poser(client, identifiant: str, **places) -> dict:
    charge = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128,
                    "durcissement": 0}],
        "recadrage": {"marge": 0, "boite": None},
        "grille": {"cible": 32, "occupation": 100, "ancrage": "bas"},
        "quantification": None,
        "bords": None,
        "contours": None,
        "main": None,
        "nom": None,
    }
    charge.update(places)
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=charge)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_les_deux_places_traversent_le_port_et_reviennent(client, double):
    """Ce qui est posé se relit, mot pour mot — c'est ce qui rend la recette
    rejouable, et c'est ce que l'onglet relit après un rechargement."""
    asset = _asset(client, double)
    pose = _poser(
        client,
        asset["identifiant"],
        contours={
            "epaisseur": 2,
            "couleur": "#14161b",
            "position": "centre",
            "trous": "laisses",
        },
        main={
            "opacite": [{"garde": False, "rayon": 0, "points": [[1, 1]], "couleur": ""}],
            "calques": [
                {
                    "nom": "rouille",
                    "visible": True,
                    "passages": [
                        {"garde": True, "rayon": 3, "points": [[4, 4], [8, 9]],
                         "couleur": "#6e5a3c"}
                    ],
                }
            ],
        },
    )

    assert pose["recette"]["contours"] == {
        "epaisseur": 2,
        "couleur": "#14161b",
        "position": "centre",
        "trous": "laisses",
    }
    assert pose["recette"]["main"]["calques"][0]["nom"] == "rouille"
    assert pose["recette"]["main"]["calques"][0]["passages"][0]["couleur"] == "#6e5a3c"


def test_une_couleur_hors_palette_se_marque_et_ne_se_refuse_pas(client, double):
    """**Le produit constate ; il ne refuse pas** (US-210).

    Le refuser ici en aurait fait la seule place de la recette qui juge une
    couleur — et l'écran, lui, a tout ce qu'il faut pour le dire : la palette du
    projet est à côté du champ.
    """
    asset = _asset(client, double)
    pose = _poser(
        client,
        asset["identifiant"],
        contours={"epaisseur": 1, "couleur": "#ff00ff", "position": "externe",
                  "trous": "cercles"},
    )

    assert pose["recette"]["contours"]["couleur"] == "#ff00ff"


@pytest.mark.parametrize(
    "contours",
    [
        {"epaisseur": 0, "couleur": "#000000", "position": "externe", "trous": "cercles"},
        {"epaisseur": 99, "couleur": "#000000", "position": "externe", "trous": "cercles"},
        {"epaisseur": 1, "couleur": "#000000", "position": "ailleurs", "trous": "cercles"},
        {"epaisseur": 1, "couleur": "#000000", "position": "externe", "trous": "peut-etre"},
    ],
)
def test_une_valeur_hors_domaine_est_refusee_en_la_nommant(client, double, contours):
    """L'écran a déjà grisé : c'est le filet, pour un fichier retouché à la
    main, une recette nommée devenue caduque, ou un agent qui n'a jamais vu cet
    écran."""
    asset = _asset(client, double)
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={
            "passes": [],
            "recadrage": None,
            "grille": None,
            "quantification": None,
            "bords": None,
            "contours": contours,
            "main": None,
            "nom": None,
        },
    )

    # 422 quand la charge est bornée par le port — l'épaisseur —, 409 quand
    # c'est le service qui nomme le refus. Les deux disent la même chose à deux
    # profondeurs, et aucune ne corrige en silence.
    assert reponse.status_code in (409, 422), reponse.text
    assert reponse.text


def test_la_mesure_se_prend_a_l_echelle_ou_le_reglage_agit(client, double):
    """**Corrigé le 31 août 2026, et le défaut datait de E3.**

    Les taches se mesuraient sur l'image *détourée* — donc à la taille du brut —
    alors que le nettoyage des bords s'applique tout à la fin, sur la case. Une
    miette de six pixels dans le rendu en pesait des centaines dans la liste, et
    le curseur d'aire minimale, gradué de 0 à 64, ne pouvait rien y couper : les
    deux nombres ne parlaient pas de la même image.
    """
    asset = _asset(client, double)
    _poser(client, asset["identifiant"])  # détourage + grille de 32

    mesures = client.get(f"/api/assets/{asset['identifiant']}/spots").json()
    aires = [t["aire"] for t in mesures["taches"]]

    assert aires, "aucune tache mesurée"
    # Une case de 32 × 32 ne peut pas contenir une tache de plus de 1 024 px.
    assert max(aires) <= 32 * 32


def test_la_main_dit_ce_qu_elle_touche_et_ce_qu_elle_pose(client, double):
    """Le nombre qui dit si la main a servi de correction ou de détourage
    déguisé — et il ne se lit que contre l'image, puisque remettre un pixel déjà
    présent ne touche rien."""
    asset = _asset(client, double)
    _poser(
        client,
        asset["identifiant"],
        main={
            "opacite": [{"garde": False, "rayon": 0, "points": [[16, 20]],
                         "couleur": ""}],
            "calques": [
                {
                    "nom": "reflets",
                    "visible": True,
                    "passages": [{"garde": True, "rayon": 0, "points": [[0, 0]],
                                  "couleur": "#ffffff"}],
                }
            ],
        },
    )

    mesures = client.get(f"/api/assets/{asset['identifiant']}/spots").json()
    assert mesures["main"]["calques"] == [1]
    # L'opacité ne compte que ce qu'elle a **changé** : le point visé est dans
    # le sujet, donc il était présent et il ne l'est plus.
    assert mesures["main"]["opacite"] in (0, 1)


def test_une_recette_posee_ne_detruit_plus_la_difference(client, double):
    """**La correction du 31 août 2026, et le défaut est plus vieux que les
    tables.**

    La charge qui arrive de l'écran n'a pas de champ pour dire une différence —
    elle se pose par ses propres routes. Elle repartait donc à `None` à chaque
    réglage, et retoucher la grille d'un calque le rendait à sa case,
    c'est-à-dire au corps habillé, sans un mot.
    """
    from tests.test_c3 import _cases, _corps, _habiller, _personnage, _piece

    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _cases(client, personnage)[0]["calques"][piece][0]
    identifiant = calque["identifiant"]
    avant = client.get(f"/api/assets/{identifiant}").json()["recette"]["difference"]
    assert avant is not None

    _poser(client, identifiant, bords={"aire_min": 2})

    apres = client.get(f"/api/assets/{identifiant}").json()["recette"]["difference"]
    assert apres == avant, "poser une place a effacé la différence"


def test_l_avant_retire_aussi_la_main_de_la_recette(client, double):
    """*Avant ›* répond à une seule question — **qu'est-ce que j'ai changé
    moi-même ?** — et un bouton qui ne retirerait que la main d'un calque
    mentirait sur toutes les autres images."""
    asset = _asset(client, double)
    _poser(client, asset["identifiant"])
    sans_main = client.get(
        f"/api/assets/{asset['identifiant']}/image", params={"avant": True}
    ).content

    _poser(
        client,
        asset["identifiant"],
        main={
            "opacite": [
                {"garde": False, "rayon": 6, "points": [[10, 10], [22, 22]],
                 "couleur": ""}
            ],
            "calques": [],
        },
    )
    avec = client.get(f"/api/assets/{asset['identifiant']}/image").content
    avant = client.get(
        f"/api/assets/{asset['identifiant']}/image", params={"avant": True}
    ).content

    def opaques(octets: bytes) -> int:
        with Image.open(io.BytesIO(octets)) as image:
            return int((np.asarray(image.convert("RGBA"))[:, :, 3] > 0).sum())

    assert opaques(avec) < opaques(avant)
    assert opaques(avant) == opaques(sans_main)
