# -*- coding: utf-8 -*-
"""Les critères d'acceptation de M1 — le découpage du coin, réparé.

**Ce que la tranche répare.** Le serveur ne redimensionnait pas l'image du
dessus pour la faire entrer dans le cadre du dessous : il la collait dans le
coin haut-gauche et jetait ce qui dépassait. Contrat écrit, sain, et sans
conséquence tant que les deux images ont des tailles voisines — ce qui était
vrai avant `G16`. Depuis, le dessus peut être la case telle qu'elle est arrivée
du modèle, huit fois plus grande que le corps, et **le sujet est alors
entièrement dehors**.

**Pourquoi aucun essai ne l'avait vu**, et c'est la moitié de ce fichier : tous
ceux de la superposition emploient deux images de **même taille**. Celui-ci est
le premier à en employer deux de tailles différentes, le dessus le plus grand.

**L'autre moitié est ce qui ne doit pas bouger.** Deux images de même taille, ou
un dessus plus petit, rendent exactement l'image d'avant la tranche, au pixel
près : c'est le cas de six des huit pièces du dépôt et de tous les essais
existants.

**Aucun essai de ce fichier ne coûte un centime** — les images sont construites
à la main ou produites par le double, et la superposition ne connaît pas le
fournisseur.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from test_e6 import _deux_images, _detourer, _pose, _recette

from atelier.domaine.superposition import Superposition
from atelier.image.calque import aligner, cadrer, proposer, superposer


# ── Les images d'essai ───────────────────────────────────────────────────────


def _fond(cote: int) -> np.ndarray:
    """Un cadre vide — ni sujet, ni opacité."""
    return np.zeros((cote, cote, 4), dtype=np.uint8)


def _corps(cote: int = 64) -> np.ndarray:
    """Un corps détouré : un bloc opaque au milieu, du vide autour."""
    rgba = _fond(cote)
    rgba[20:52, 20:44, :3] = (180, 60, 50)
    rgba[20:52, 20:44, 3] = 255
    return rgba


def _grand_dessus(cote: int = 512, cadre: int = 64) -> np.ndarray:
    """Le même corps, plus un casque — **peint à la taille d'une case arrivée**.

    C'est le cas réel : la case revient du modèle en 1024 px de côté quand le
    corps en fait 253. Le facteur est ici de huit, comme sur le second casque de
    *balthazar-2*.

    **Le sujet est peint hors du coin** que l'ancien découpage gardait : c'est ce
    qui rend l'essai décisif. Sur les vraies images, le dessin commençait à
    271 px du bord gauche quand le coin gardé s'arrêtait à 253.
    """
    facteur = cote // cadre
    grand = np.zeros((cote, cote, 4), dtype=np.uint8)
    petit = _corps(cadre)
    for y in range(cadre):
        for x in range(cadre):
            grand[
                y * facteur : (y + 1) * facteur, x * facteur : (x + 1) * facteur
            ] = petit[y, x]
    # Le casque : au-dessus de la tête, donc bien au-delà du coin gardé.
    haut = 16 * facteur
    grand[haut - 5 * facteur : haut, 19 * facteur : 45 * facteur, :3] = (40, 40, 55)
    grand[haut - 5 * facteur : haut, 19 * facteur : 45 * facteur, 3] = 255
    return grand


def _sujet(rgba: np.ndarray) -> int:
    return int((rgba[:, :, 3] >= 128).sum())


# ── « Un dessus plus grand y entre entier, réduit pour tenir » ───────────────


def test_un_dessus_plus_grand_entre_entier_au_lieu_d_etre_coupe_a_son_coin():
    """**Le défaut, et sa réparation, dans un seul essai.**

    L'ancien découpage gardait 1,6 % de l'image — le coin haut-gauche à la
    taille du cadre — et jetait le reste. Le sujet peint hors de ce coin
    disparaissait entièrement.
    """
    dessous = _corps(64)
    dessus = _grand_dessus(512, 64)

    aligne = aligner(dessus, dessous, Superposition())

    # Ce que l'ancien contrat aurait gardé : le coin, et rien d'autre.
    coin = dessus[:64, :64]
    assert _sujet(coin) == 0, "le coin est du vide — c'est tout le problème"
    # Ce que la réparation garde : le sujet, ramené dans le cadre.
    assert _sujet(aligne) > 0
    assert aligne.shape[:2] == (64, 64), "le cadre du dessous fait toujours loi"


def test_le_calque_contient_la_piece_la_ou_il_ne_contenait_rien():
    """**La mesure de la tranche, rejouée sur une paire construite.**

    Sur les deux casques de *balthazar-2*, le calque sortait *zéro pixel de
    sujet sur 214 718*. Ici, il en contient, et ce sont ceux du casque.
    """
    dessous = _corps(64)
    dessus = _grand_dessus(512, 64)

    calque, _ = superposer(dessous, dessus, Superposition())

    assert _sujet(calque) > 0
    # Le casque est là, avec sa couleur à lui — et non du fond uni.
    couleurs = {tuple(p) for p in calque[calque[:, :, 3] >= 128][:, :3]}
    assert (40, 40, 55) in couleurs


def test_le_recalage_travaille_sur_l_image_entiere():
    """« Le bouton *recaler* rend sa proposition sur l'image entière, et sa
    couverture cesse d'être calculée sur du fond uni. »

    Sur le coin vide, la recherche comparait un cadre transparent à un corps :
    elle rendait des chiffres d'apparence honnête sur rien du tout.
    """
    dessous = _corps(64)
    echelle, dy, dx, couverture = proposer(dessous, _grand_dessus(512, 64))

    assert couverture > 0.5, "le corps se retrouve sous la pièce"
    assert 0.25 <= echelle <= 4.0
    assert isinstance(dx, int) and isinstance(dy, int)


# ── « Deux images de même taille rendent exactement l'image d'avant » ────────


def _aligner_d_avant(dessus: np.ndarray, dessous: np.ndarray) -> np.ndarray:
    """L'alignement tel qu'il était écrit avant la tranche — le coin, sans rien
    réduire. Recopié ici **exprès** : c'est le témoin, et un témoin qui
    appellerait le code d'aujourd'hui ne prouverait rien."""
    hauteur, largeur = dessous.shape[:2]
    if dessus.shape[:2] != (hauteur, largeur):
        cadre = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
        cadre.paste(Image.fromarray(dessus, "RGBA"), (0, 0))
        dessus = np.asarray(cadre)
    return dessus


def test_deux_images_de_meme_taille_rendent_l_image_d_avant_au_pixel_pres():
    """**La moitié de la tranche est ce qui ne bouge pas.**

    C'est le cas de six des huit pièces du dépôt, de la seule superposition qui
    y ait été fabriquée, et de tous les essais existants.
    """
    dessous = _corps(64)
    dessus = _corps(64)
    dessus[15:20, 19:45, :3] = (40, 40, 55)
    dessus[15:20, 19:45, 3] = 255

    assert np.array_equal(
        aligner(dessus, dessous, Superposition()), _aligner_d_avant(dessus, dessous)
    )


def test_un_dessus_plus_petit_rend_aussi_l_image_d_avant_au_pixel_pres():
    """Le coin reste le coin tant que le dessus tient dans le cadre — la règle
    d'origine, intacte, et elle n'a rien à rattraper derrière elle."""
    dessous = _corps(64)
    petit = _corps(32)

    assert np.array_equal(
        aligner(petit, dessous, Superposition()), _aligner_d_avant(petit, dessous)
    )


def test_le_cadrage_dit_ce_qu_il_a_fait_et_ce_qu_il_n_a_pas_fait():
    """Trois régimes, trois réponses — et une seule des trois est neuve."""
    tel_quel = cadrer((64, 64), (64, 64))
    assert not tel_quel.ramene and tel_quel.facteur == 1.0
    assert (tel_quel.gauche, tel_quel.sommet) == (0, 0)

    plus_petit = cadrer((32, 32), (64, 64))
    assert not plus_petit.ramene
    assert (plus_petit.gauche, plus_petit.sommet) == (0, 0), "le coin, comme avant"

    plus_grand = cadrer((512, 512), (64, 64))
    assert plus_grand.ramene and plus_grand.facteur == 0.125
    assert (plus_grand.largeur, plus_grand.hauteur) == (64, 64)
    assert (plus_grand.source_largeur, plus_grand.source_hauteur) == (512, 512)


def test_le_dessus_reduit_est_centre_et_garde_ses_proportions():
    """Un cadre qui n'est pas carré ne déforme pas ce qu'on y fait entrer : le
    dessus garde ses proportions et se centre, comme la composition centre un
    corps dans sa case."""
    boite = cadrer((1024, 1024), (321, 253))

    assert (boite.largeur, boite.hauteur) == (253, 253), "réduit sur le petit côté"
    assert boite.gauche == 0
    assert boite.sommet == (321 - 253) // 2


# ── Ce que l'écran reçoit, et ce que la tranche ne dépense pas ──────────────


def _octets(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _importer(client, rgba: np.ndarray, nom: str) -> str:
    """Une image posée dans la bibliothèque **sans passer par le fournisseur**.

    Recette vidée dans la foulée : ces images-là arrivent déjà détourées, et le
    détourage du projet les rendrait autrement que ce que l'essai a peint.
    """
    reponse = client.post(
        "/api/assets/upload", content=_octets(rgba), params={"nom": nom}
    )
    assert reponse.status_code == 201, reponse.text
    identifiant = reponse.json()["asset"]["identifiant"]
    _recette(client, identifiant, [])
    return identifiant


def test_l_apercu_dit_a_l_ecran_que_le_dessus_a_ete_ramene(client, double):
    """« L'écran dit quand le dessus a été ramené au cadre, au lieu de le faire
    en silence. » Le serveur le dit ; l'écran a de quoi l'écrire **et** de quoi
    dessiner la même image que celle sur laquelle il a calculé."""
    bas = _importer(client, _corps(64), "corps.png")
    haut = _importer(client, _grand_dessus(512, 64), "case-arrivee.png")

    vu = client.post("/api/overlay/preview", json=_pose(haut, bas)).json()
    cadrage = vu["cadrage"]

    assert cadrage["ramene"] is True
    assert cadrage["facteur"] == 0.125
    assert (cadrage["source_largeur"], cadrage["source_hauteur"]) == (512, 512)
    assert (cadrage["largeur"], cadrage["hauteur"]) == (64, 64)
    assert (cadrage["gauche"], cadrage["sommet"]) == (0, 0)


def test_l_apercu_ne_dit_rien_quand_il_n_y_a_rien_a_dire(client, double):
    """Le cas courant — deux images de même taille — ne porte aucune phrase :
    une marque qui paraîtrait partout cesserait d'être une réponse."""
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)

    vu = client.post("/api/overlay/preview", json=_pose(haut, bas)).json()

    assert vu["cadrage"]["ramene"] is False
    assert vu["cadrage"]["facteur"] == 1.0


def test_toute_la_tranche_marche_reseau_coupe(client, double):
    """« Aucun appel au fournisseur, aucun centime : la tranche entière se
    vérifie réseau coupé. » Tout se recalcule d'images déjà là."""
    bas = _importer(client, _corps(64), "corps.png")
    haut = _importer(client, _grand_dessus(512, 64), "case-arrivee.png")
    double.catalogue_lisible = False
    avant = double.appels

    apercu = client.post("/api/overlay/preview", json=_pose(haut, bas))
    recale = client.get(f"/api/assets/{haut}/overlay/fit", params={"dessous": bas})
    fabrique = client.post(
        "/api/overlay",
        json={"pose": _pose(haut, bas), "sorties": ["calque"], "garder": False},
    )

    assert apercu.status_code == 200, apercu.text
    assert recale.status_code == 200, recale.text
    assert fabrique.status_code == 200, fabrique.text
    assert double.appels == avant, "pas un appel n'est parti"
    assert all(
        image["consomme"] == 0 for image in fabrique.json()["superpositions"]
    ), "et pas un centime"
