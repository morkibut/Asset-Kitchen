# -*- coding: utf-8 -*-
"""Les critères d'acceptation de RV25 — le fond enfermé dans le sujet se voit,
et s'enlève (`docs/PLAN-revue-du-21-septembre.md`, § RV25).

Le cas de l'auteur : un bus détouré par un modèle (`u2net`) garde le vert du
fond dans ses vitres, opaque, sans qu'aucun réglage ne le dise. Le moyen de le
retirer existe déjà — une passe « couleur », en visant le fond, avec « où
retirer : partout » — il n'était simplement proposé nulle part.

**La première moitié de ce fichier teste la mesure seule**, sur des tableaux
construits à la main, dans le style de `test_e3.py` : ce qu'elle vérifie est
une propriété de la fonction, pas d'une image particulière, et aucun de ces
essais ne coûte un centime. **La seconde moitié teste le chemin bout en
bout**, par la route des mesures d'une table, pour vérifier ce que
`atelier/services/assets.py` calcule vraiment — la couleur visée et le point
qu'une passe « couleur » viserait.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.recette import Passe
from atelier.image.taches import (
    AIRE_MIN_FOND_VISE,
    TOLERANCE_FOND_VISE,
    zones_de_fond_enferme,
)
from atelier.image.traitement import _detourer

MODELE = "essai:rend-du-png"


# ── La mesure seule, sur des tableaux construits à la main ───────────────────


def _rendu(fond=(216, 217, 216), sujet=(40, 90, 40), poche=None, cote=32) -> np.ndarray:
    """Un rendu **déjà opaque partout** — le cas d'un détourage par modèle qui
    n'a pas touché à l'alpha des vitres : c'est exactement ce que
    `zones_de_fond_enferme` doit pouvoir lire, sans détourage préalable."""
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, :3] = fond
    rgba[:, :, 3] = 255
    rgba[4 : cote - 4, 4 : cote - 4, :3] = sujet
    if poche is not None:
        couleur, (x0, y0, x1, y1) = poche
        rgba[y0 : y1 + 1, x0 : x1 + 1, :3] = couleur
    return rgba


def test_une_poche_a_la_couleur_visee_est_comptee():
    """Le cas du bus, réduit à l'essentiel : une zone opaque, à la couleur du
    fond, qu'aucun chemin de cette couleur ne relie au bord — une zone."""
    fond = (216, 217, 216)
    rendu = _rendu(fond=fond, poche=(fond, (12, 12, 19, 19)))  # 8×8 = 64 px

    assert zones_de_fond_enferme(rendu, fond) == 1


def test_la_meme_image_sans_poche_n_en_compte_aucune():
    """Le jumeau du précédent, sans la poche : zéro, pas « pas mesuré »."""
    fond = (216, 217, 216)
    rendu = _rendu(fond=fond, poche=None)

    assert zones_de_fond_enferme(rendu, fond) == 0


def test_une_couleur_proche_mais_distincte_du_fond_n_est_pas_une_poche():
    """**Ce que la mesure sépare, en une phrase** (AGENTS.md, 8sexies) : une
    couleur *presque identique* au fond visé, jamais une couleur qui lui
    ressemble de loin. Un vert de feuillage n'est pas *ce* vert-là.

    L'écart posé ici dépasse `TOLERANCE_FOND_VISE` sur chaque canal — assez
    proche pour qu'un œil peu attentif hésite, assez loin pour que la mesure,
    elle, ne confonde jamais les deux.
    """
    fond = (216, 217, 216)
    proche_mais_distincte = tuple(c - (TOLERANCE_FOND_VISE + 6) for c in fond)
    rendu = _rendu(fond=fond, poche=(proche_mais_distincte, (12, 12, 19, 19)))

    assert zones_de_fond_enferme(rendu, fond) == 0


def test_une_poche_de_quelques_pixels_est_ecartee_comme_du_bruit():
    """**Écarte aussi les poches de quelques pixels** — le bruit de
    compression ou de quantification, jamais un morceau de fond qu'on
    proposerait de retirer d'un clic."""
    fond = (216, 217, 216)
    rendu = _rendu(fond=fond, poche=(fond, (14, 14, 14, 14)))  # 1 pixel

    assert AIRE_MIN_FOND_VISE > 1
    assert zones_de_fond_enferme(rendu, fond) == 0


def test_deux_poches_se_comptent_toutes_les_deux():
    """Le compte, pas une liste coupée court : il n'y a rien ici à *montrer*,
    seulement un nombre à annoncer avant qu'on ne clique."""
    fond = (216, 217, 216)
    sujet = (40, 90, 40)
    rgba = np.zeros((32, 32, 4), dtype=np.uint8)
    rgba[:, :, :3] = fond
    rgba[:, :, 3] = 255
    rgba[2:30, 2:30, :3] = sujet
    rgba[5:9, 5:9, :3] = fond
    rgba[20:26, 20:26, :3] = fond

    assert zones_de_fond_enferme(rgba, fond) == 2


def test_une_poche_decalee_par_la_quantification_est_quand_meme_comptee():
    """**Le cas réel de l'auteur, reproduit sans son fichier.** La mesure lit
    le *rendu final* (voir la classe) — bords, contour et quantification
    compris —, mais la couleur qu'elle vise est celle que le détourage a
    réellement demandée pour le fond. Entre les deux, la réduction à une
    palette peut décaler la couleur d'un fond que le sujet enferme : sur
    l'image de l'auteur, `#38b83c` visé ressort `#3ca649` dans les vitres
    d'un bus, un écart de 18 sur le canal le plus large — au-delà de l'ancien
    seuil de 16, qui ratait donc la poche. **Tombe avec l'ancien seuil** :
    l'assertion à 16 documente la régression que RV25 a payée.
    """
    fond_vise = (0x38, 0xB8, 0x3C)  # le fond réellement visé par le détourage
    fond_quantifie = (0x3C, 0xA6, 0x49)  # ce que la quantification en fait dans le rendu
    assert max(abs(a - b) for a, b in zip(fond_vise, fond_quantifie)) == 18

    rendu = _rendu(fond=fond_quantifie, poche=(fond_quantifie, (12, 12, 19, 19)))

    assert zones_de_fond_enferme(rendu, fond_vise, tolerance=16) == 0
    assert zones_de_fond_enferme(rendu, fond_vise) == 1


def test_la_mesure_ne_modifie_rien():
    """Comme les cinq autres mesures de ce module : elle décrit, elle ne
    touche jamais au tableau qu'on lui donne."""
    fond = (216, 217, 216)
    rendu = _rendu(fond=fond, poche=(fond, (12, 12, 19, 19)))
    avant = rendu.copy()

    zones_de_fond_enferme(rendu, fond)

    assert np.array_equal(rendu, avant)


def test_une_poche_survit_a_un_detourage_par_modele_qui_ne_l_atteint_pas():
    """**Le cas exact de l'auteur** : un détourage qui a mangé tout le fond
    extérieur — vitres comprises, puisqu'un modèle découpe l'objet entier —
    laisse la poche parfaitement opaque, et la mesure la trouve quand même.

    `_detourer` avec le moteur `couleur` sur un point du fond *extérieur*
    simule ce qu'un modèle de silhouette produit : l'alpha du pourtour tombe
    à zéro, la poche enfermée reste à 255. La mesure travaille sur les
    couleurs, jamais sur l'alpha qu'un détourage a déjà posé — c'est
    précisément pour ça qu'elle voit encore la poche.
    """
    fond = (216, 217, 216)
    rendu = _rendu(fond=fond, poche=(fond, (12, 12, 19, 19)))
    # `portee` par défaut est « cette tache » — la zone d'un seul tenant sous
    # le point, exactement ce qu'un remplissage depuis le bord produit.
    detoure = _detourer(rendu, Passe(moteur="couleur", tolerance=10, point=(0, 0)))
    assert detoure[0, 0, 3] == 0, "le fond extérieur doit être parti"
    assert detoure[15, 15, 3] == 255, "la poche doit être restée opaque"

    assert zones_de_fond_enferme(detoure, fond) == 1


# ── Bout en bout, par la route des mesures d'une table ───────────────────────


FOND = (216, 217, 216)
SUJET = (40, 90, 40)


def _bus(*, poche: bool = True, couleur: tuple[int, int, int] | None = None) -> bytes:
    """Le cas de l'auteur, réduit à une image : un sujet qui enferme — ou pas
    — une poche à la couleur du fond, comme les vitres d'un bus détouré par un
    modèle, vitres comprises."""
    largeur = hauteur = 48
    image = Image.new("RGB", (largeur, hauteur), FOND)
    dessin = ImageDraw.Draw(image)
    dessin.rectangle([6, 6, 41, 41], fill=SUJET)
    if poche:
        dessin.rectangle([16, 16, 27, 27], fill=couleur or FOND)  # 12×12 = 144 px
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _generer(client, double, image: bytes) -> str:
    """Fait naître un asset **brut** — sans le détourage ni la grille par
    défaut que le projet ouvert poserait sinon (B18) : ces essais veulent une
    image dont ils connaissent exactement les pixels, pas celle qu'un projet
    de test y ajouterait par-dessus."""
    double.rendre = lambda: image
    generation = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un bus", "brut": True},
    ).json()
    return f"{generation['identifiant']}-0"


def test_la_route_des_mesures_compte_une_zone_sur_le_bus_de_l_auteur(client, double):
    """La phrase à l'écran a besoin d'un nombre et d'une couleur ; le bouton a
    besoin d'une amorce par poche, prise **dans** la poche. Les trois arrivent
    ensemble, par la route déjà en place — aucune route neuve."""
    identifiant = _generer(client, double, _bus(poche=True))

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    fond_enferme = mesures["fond_enferme"]

    assert fond_enferme["zones"] == 1
    assert fond_enferme["couleur"].startswith("#")
    assert len(fond_enferme["points"]) == 1
    x, y = fond_enferme["points"][0]
    assert isinstance(x, int) and isinstance(y, int)
    assert 16 <= x <= 27 and 16 <= y <= 27, "l'amorce est dans la poche, pas sur le fond du bord"


def test_la_meme_image_sans_poche_ne_compte_aucune_zone(client, double):
    identifiant = _generer(client, double, _bus(poche=False))

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    fond_enferme = mesures["fond_enferme"]

    assert fond_enferme["zones"] == 0
    assert fond_enferme["points"] == []


def test_une_couleur_proche_mais_distincte_ne_compte_aucune_zone(client, double):
    """Le sujet a le droit de porter une couleur qui ressemble au fond — un
    vert de feuillage — sans jamais être retouché sans qu'on l'ait demandé."""
    proche_mais_distincte = tuple(c - (TOLERANCE_FOND_VISE + 6) for c in FOND)
    identifiant = _generer(client, double, _bus(poche=True, couleur=proche_mais_distincte))

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()

    assert mesures["fond_enferme"]["zones"] == 0


def test_la_cible_declaree_du_jeu_est_visee_plutot_que_la_mediane_des_bordures(client, double):
    """**La cible déclarée du jeu, si elle existe** (B18) : quand une passe
    « bord » la porte, c'est elle qui compte, jamais la devinette sur les
    bordures — même si la poche est là, à la couleur qu'on n'a pas visée."""
    identifiant = _generer(client, double, _bus(poche=True))  # poche = FOND
    autre_couleur = "#102030"  # loin de FOND comme de la poche
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [
                {
                    "moteur": "bord",
                    "tolerance": 28,
                    "seuil_alpha": 128,
                    "durcissement": 0,
                    "couleur_du_jeu": autre_couleur,
                }
            ],
            "recadrage": None,
            "grille": None,
            "quantification": None,
            "bords": None,
            "contours": None,
            "main": None,
            "nom": None,
        },
    )
    assert reponse.status_code == 200, reponse.text

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    fond_enferme = mesures["fond_enferme"]

    assert fond_enferme["couleur"].upper() == autre_couleur.upper()
    # La poche est à la couleur du fond, pas à celle du jeu déclarée : visée
    # sur la mauvaise couleur, elle ne la trouve plus.
    assert fond_enferme["zones"] == 0


def _recette(passes: list[dict], **places) -> dict:
    """Une recette complète pour `PUT /recipe` — les places non nommées vides."""
    recette = {
        "passes": passes,
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "contours": None,
        "main": None,
        "nom": None,
    }
    recette.update(places)
    return recette


def _passe_couleur(point, portee: str) -> dict:
    """La passe que pose le bouton — `PASSE_PAR_DEFAUT` de l'écran, moteur
    « couleur »."""
    return {
        "moteur": "couleur",
        "tolerance": 28,
        "seuil_alpha": 128,
        "durcissement": 0,
        "point": point,
        "portee": portee,
    }


def _poser(client, identifiant: str, recette: dict) -> None:
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=recette)
    assert reponse.status_code == 200, reponse.text


def _image(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/image")
    assert reponse.status_code == 200, reponse.text
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA"))


def test_les_amorces_rendues_permettent_de_retirer_la_poche(client, double):
    """**Le geste complet du bouton « les retirer aussi »**, rejoué côté
    serveur : une passe « couleur », « cette tache », par amorce rendue,
    retire la poche que la mesure annonçait — et la mesure retombe à zéro."""
    identifiant = _generer(client, double, _bus(poche=True))

    avant = client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]
    assert avant["zones"] == 1

    _poser(client, identifiant, _recette([_passe_couleur(p, "tache") for p in avant["points"]]))

    apres = client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]
    assert apres["zones"] == 0


# ── Le bouton retire vraiment (corrigé le 24 septembre 2026) ─────────────────
#
# Sur le bus de l'auteur, le bouton ne retirait que 101 pixels verts sur
# 2 200 : la mesure lit le rendu **quantifié**, où le vert des vitres est à 18
# du fond, mais la passe lit la couleur **d'origine** (AGENTS.md, point 5), et
# sous les vitres le brut est un vert bleuté à 49 du fond. Viser le fond depuis
# le bord de l'image, « partout », ne pouvait pas l'atteindre.

VERT_DU_FOND = (0x38, 0xB8, 0x3C)  # le fond du bus de l'auteur
VITRE = (0x44, 0x92, 0x6B)  # la médiane du brut sous ses vitres, à 47 du fond
CARROSSERIE = (200, 160, 40)


def _bus_a_vitre_teintee() -> bytes:
    image = Image.new("RGB", (48, 48), VERT_DU_FOND)
    dessin = ImageDraw.Draw(image)
    dessin.rectangle([10, 10, 37, 37], fill=CARROSSERIE)
    dessin.rectangle([16, 16, 27, 27], fill=VITRE)  # la vitre, 12×12
    # Deux rétroviseurs aux coins : la boîte du sujet garde du fond autour de
    # la carrosserie, comme autour des roues du bus — c'est ce vert-là, sous la
    # transparence, que la quantification fond avec la vitre.
    dessin.rectangle([2, 2, 5, 5], fill=CARROSSERIE)
    dessin.rectangle([42, 42, 45, 45], fill=CARROSSERIE)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


#: Détourée par le bord, **ramenée sur une case de 32** — la géométrie du
#: rendu n'est plus celle du brut — puis réduite à deux couleurs : la coupe
#: médiane fond la vitre avec le vert du fond, resté sous la transparence.
_DETOURE_REDUIT = dict(
    grille={"cible": 32, "occupation": 100},
    quantification={"couleurs": 2, "palette": [], "tramage": "aucun"},
)
_PASSE_BORD = {"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}


def _vitre_opaque(rendu: np.ndarray) -> int:
    """Les pixels opaques à la couleur du fond, dans le rendu."""
    ecart = np.abs(rendu[:, :, :3].astype(int) - np.array(VERT_DU_FOND)).max(axis=2)
    return int(((ecart <= TOLERANCE_FOND_VISE) & (rendu[:, :, 3] > 0)).sum())


def test_une_vitre_plus_loin_du_fond_dans_le_brut_que_dans_le_rendu_part_au_clic(client, double):
    """**Le cas réel, sans le fichier de l'auteur.** Dans le brut, la vitre est
    à 47 du fond — au-delà des 28 d'une passe ; dans le rendu, la quantification
    l'a fondue dans le vert du fond, et la mesure la voit. L'amorce doit donc
    être prise **dans la vitre**, en pixels du brut — la case de 32 a changé la
    géométrie —, et un seul clic doit la vider sans toucher la carrosserie.

    **Tombe avec l'ancien bouton** : la passe « partout » visée sur le fond du
    bord de l'image laisse la vitre entière, et la mesure la compte encore.
    """
    assert max(abs(a - b) for a, b in zip(VITRE, VERT_DU_FOND)) > 28
    identifiant = _generer(client, double, _bus_a_vitre_teintee())
    _poser(client, identifiant, _recette([_PASSE_BORD], **_DETOURE_REDUIT))

    avant = client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]
    assert avant["zones"] == 1
    rendu_avant = _image(client, identifiant)
    assert _vitre_opaque(rendu_avant) > 50
    opaques_avant = int((rendu_avant[:, :, 3] > 0).sum())

    # L'ancien bouton : un pixel du fond sur le bord de l'image, « partout ».
    _poser(client, identifiant, _recette([_PASSE_BORD, _passe_couleur([0, 0], "partout")], **_DETOURE_REDUIT))
    assert client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]["zones"] == 1

    # Le bouton d'aujourd'hui : une passe « cette tache » par amorce rendue.
    (x, y), = avant["points"]
    assert 16 <= x <= 27 and 16 <= y <= 27, "l'amorce est dans la vitre, en pixels du brut"
    _poser(
        client,
        identifiant,
        _recette([_PASSE_BORD] + [_passe_couleur(p, "tache") for p in avant["points"]], **_DETOURE_REDUIT),
    )

    assert client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]["zones"] == 0
    rendu_apres = _image(client, identifiant)
    assert _vitre_opaque(rendu_apres) == 0
    # La carrosserie n'est pas mangée : seule la vitre est partie.
    perdus = opaques_avant - int((rendu_apres[:, :, 3] > 0).sum())
    assert perdus == _vitre_opaque(rendu_avant)


# ── Relecture du 24 septembre 2026 : l'aperçu ne plante plus ─────────────────
#
# `coordonnees_du_rendu` rejoue la géométrie sur une image dont les canaux
# portent des coordonnées. Un recadrage « bord uni » cherche sa boîte dans les
# couleurs, donc dans ces coordonnées : autre boîte, tableaux d'une autre
# taille que le rendu, et `IndexError` dès qu'une poche existait — `/spots` et
# `/recipe/preview` en 500. Un contour extérieur faisait pareil par l'autre
# bout : il agrandit le rendu, pas les coordonnées.


def _poche_sur_fond_uni() -> np.ndarray:
    """Le script de preuve du relecteur : un sujet sur un fond gris uni,
    opaque partout, avec une vitre à la couleur du fond enfermée dedans."""
    image = np.zeros((100, 100, 4), dtype=np.uint8)
    image[:, :, :3] = 200
    image[:, :, 3] = 255
    image[30:70, 20:60, :3] = (10, 120, 30)
    image[40:50, 30:40, :3] = 200  # la vitre, 10×10
    return image


def test_un_recadrage_bord_uni_garde_les_coordonnees_du_rendu():
    """**Tombe avant le correctif** : 100×100 de coordonnées pour un rendu de
    40×40, et le premier pixel venait de (0, 0) au lieu de (20, 30)."""
    from atelier.domaine.recette import Recadrage, Recette
    from atelier.image.traitement import coordonnees_du_rendu, queue

    image = _poche_sur_fond_uni()
    recette = Recette(recadrage=Recadrage(bord_uni=True))
    rendu = queue(image, recette)
    xs, ys = coordonnees_du_rendu(image, recette)

    assert xs.shape == ys.shape == rendu.shape[:2] == (40, 40)
    assert (int(xs[0, 0]), int(ys[0, 0])) == (20, 30)


def test_un_recadrage_bord_uni_ne_fait_plus_tomber_les_amorces():
    from atelier.domaine.recette import Recadrage, Recette
    from atelier.image.taches import poches_de_fond_enferme
    from atelier.image.traitement import amorces_des_poches, queue

    image = _poche_sur_fond_uni()
    recette = Recette(recadrage=Recadrage(bord_uni=True))
    poches = poches_de_fond_enferme(queue(image, recette), (200, 200, 200))
    assert len(poches) == 1

    (x, y), = amorces_des_poches(image, recette, poches)
    assert 30 <= x < 40 and 40 <= y < 50, "l'amorce est dans la vitre, en pixels du brut"


def test_un_contour_exterieur_ne_fait_plus_tomber_les_amorces():
    """Le même défaut par l'autre bout : le rendu a deux pixels de plus de
    chaque côté, les coordonnées non."""
    from atelier.domaine.recette import Contour, Recette
    from atelier.image.taches import poches_de_fond_enferme
    from atelier.image.traitement import amorces_des_poches, queue

    image = np.zeros((100, 100, 4), dtype=np.uint8)
    image[:, :, :3] = 200
    image[30:70, 20:60] = (10, 120, 30, 255)
    image[40:50, 30:40] = (200, 200, 200, 255)
    recette = Recette(contours=Contour(epaisseur=2, couleur="#000000", position="externe"))
    rendu = queue(image, recette)
    assert rendu.shape[:2] == (104, 104)
    poches = poches_de_fond_enferme(rendu, (200, 200, 200))
    assert len(poches) == 1

    (x, y), = amorces_des_poches(image, recette, poches)
    assert 30 <= x < 40 and 40 <= y < 50


def test_les_mesures_repondent_avec_un_recadrage_bord_uni(client, double):
    """Bout en bout : la route des mesures et l'aperçu répondaient 500."""
    identifiant = _generer(client, double, _bus(poche=True))
    recette = _recette([], recadrage={"bord_uni": True})
    _poser(client, identifiant, recette)

    mesures = client.get(f"/api/assets/{identifiant}/spots")
    assert mesures.status_code == 200, mesures.text
    fond_enferme = mesures.json()["fond_enferme"]
    assert fond_enferme["zones"] == 1
    (x, y), = fond_enferme["points"]
    assert 16 <= x <= 27 and 16 <= y <= 27

    apercu = client.post(f"/api/assets/{identifiant}/recipe/preview", json={"recette": recette})
    assert apercu.status_code == 200, apercu.text
    assert apercu.json()["mesures"]["fond_enferme"] == fond_enferme


# ── Relecture du 24 septembre 2026 : l'aperçu reste rapide ───────────────────
#
# L'ancien remplissage allouait un masque de l'image entière **par tache**,
# même d'un pixel : dix-sept secondes par aperçu sur une image de 1024 réduite
# à seize couleurs. `etiqueter` rend les aires d'abord ; ce qui suit vérifie
# que les réponses n'ont pas bougé d'un pixel, et que les petites ne coûtent
# plus un masque.


def _composantes_d_avant(masque: np.ndarray) -> list[tuple[np.ndarray, int]]:
    """Le remplissage par plages tel qu'il était jusqu'au 24 septembre 2026,
    recopié mot pour mot : la référence que le nouveau doit rendre à
    l'identique — mêmes taches, mêmes aires, même ordre."""
    hauteur, largeur = masque.shape
    vu = np.zeros_like(masque)
    taches: list[tuple[np.ndarray, int]] = []
    for y0 in range(hauteur):
        libres = np.flatnonzero(masque[y0] & ~vu[y0])
        for x0 in libres:
            if vu[y0, x0]:
                continue
            tache = np.zeros_like(masque)
            pile = [(y0, int(x0))]
            aire = 0
            while pile:
                y, x = pile.pop()
                if vu[y, x] or not masque[y, x]:
                    continue
                ligne = masque[y] & ~vu[y]
                fermes = np.flatnonzero(~ligne)
                avant = fermes[fermes < x]
                apres = fermes[fermes > x]
                debut = int(avant[-1]) + 1 if avant.size else 0
                fin = int(apres[0]) - 1 if apres.size else largeur - 1
                vu[y, debut : fin + 1] = True
                tache[y, debut : fin + 1] = True
                aire += fin - debut + 1
                for voisin in (y - 1, y + 1):
                    if not (0 <= voisin < hauteur):
                        continue
                    libre = masque[voisin, debut : fin + 1] & ~vu[voisin, debut : fin + 1]
                    if not libre.any():
                        continue
                    borde = np.concatenate(([False], libre, [False])).astype(np.int8)
                    for depart in np.flatnonzero(np.diff(borde) == 1):
                        pile.append((voisin, debut + int(depart)))
            taches.append((tache, aire))
    return taches


def _masque_fabrique(graine: int, cote: int = 96) -> np.ndarray:
    """Du bruit, des serpentins et des anneaux : des taches d'un pixel, des
    taches qui ne se touchent que par un coin (deux taches, pas une), et des
    taches qui se rejoignent par en dessous."""
    rng = np.random.default_rng(graine)
    masque = rng.random((cote, cote)) < 0.45
    masque[10:12, 5:90] = True
    masque[10:80, 88:90] = True
    masque[40:60, 30:50] = True
    masque[44:56, 34:46] = False
    masque[70, 70] = masque[71, 71] = True
    masque[70, 71] = masque[71, 70] = False
    return masque


def test_les_taches_sont_les_memes_qu_avant_au_pixel_pres():
    from atelier.image.traitement import composantes, nombre_de_composantes

    for graine in range(6):
        masque = _masque_fabrique(graine)
        avant = _composantes_d_avant(masque)
        apres = composantes(masque)
        assert nombre_de_composantes(masque) == len(avant) == len(apres)
        for (masque_avant, aire_avant), (masque_apres, aire_apres) in zip(avant, apres):
            assert aire_avant == aire_apres
            assert masque_avant.dtype == masque_apres.dtype
            assert (masque_avant == masque_apres).all()


def test_les_mesures_de_la_table_sont_les_memes_qu_avant():
    """Les quatre lectures qui passent par l'étiquetage, sur une image
    fabriquée : le compte des poches enfermées, les taches, les poches de fond
    et les trous rendent ce que l'ancien remplissage rendait."""
    from atelier.image.taches import (
        AIRE_MIN_FOND_VISE,
        poches_de_fond,
        poches_de_fond_enferme,
        taches,
        trous,
    )

    rng = np.random.default_rng(7)
    rendu = np.zeros((96, 96, 4), dtype=np.uint8)
    rendu[:, :, :3] = FOND
    rendu[8:88, 8:88, :3] = rng.choice([40, 90, 216], size=(80, 80, 3))
    rendu[30:40, 30:40, :3] = FOND
    rendu[:, :, 3] = 255
    rendu[60:70, 60:70, 3] = 0
    rendu[rng.random((96, 96)) < 0.05, 3] = 0

    # Le compte des poches enfermées, contre l'ancien remplissage.
    ecart = np.abs(rendu[:, :, :3].astype(np.int16) - np.array(FOND)).max(axis=2)
    from atelier.image.traitement import _graines_du_bord, _remplir

    proche = ecart <= TOLERANCE_FOND_VISE
    enferme = proche & ~_remplir(proche, _graines_du_bord(proche)) & (rendu[:, :, 3] > 0)
    attendues = [m for m, aire in _composantes_d_avant(enferme) if aire >= AIRE_MIN_FOND_VISE]
    obtenues = poches_de_fond_enferme(rendu, FOND)
    assert len(obtenues) == len(attendues) >= 1
    assert all((a == b).all() for a, b in zip(attendues, obtenues))

    # Les trois autres, contre elles-mêmes rejouées sur l'ancien remplissage.
    import importlib

    module = importlib.import_module("atelier.image.taches")

    nouvelles = (taches(rendu, plafond=50), poches_de_fond(rendu, 28, plafond=10), trous(rendu))
    anciennes = _rejouer_avec_l_ancien_remplissage(module, rendu)
    assert nouvelles == anciennes
    assert nouvelles[0] and nouvelles[2], "l'image doit porter des taches et des trous"


def _rejouer_avec_l_ancien_remplissage(module, rendu):
    """Les versions d'avant de `taches`, `poches_de_fond` et `trous`, écrites
    sur `_composantes_d_avant` et le `_decrire` du module."""
    from atelier.image.traitement import _couleur_du_bord, _graines_du_bord, _remplir

    zones = _composantes_d_avant(rendu[:, :, 3] > 0)
    zones.sort(key=lambda z: z[1])
    les_taches = [module._decrire(rendu, m, a) for m, a in zones[:50]]

    rgb = rendu[:, :, :3]
    proche = np.abs(rgb.astype(np.int16) - _couleur_du_bord(rgb)).max(axis=2) <= 28
    enferme = proche & ~_remplir(proche, _graines_du_bord(proche)) & (rendu[:, :, 3] > 0)
    zones = _composantes_d_avant(enferme)
    zones.sort(key=lambda z: z[1], reverse=True)
    les_poches = ([module._decrire(rendu, m, a) for m, a in zones[:10]], len(zones))

    hauteur, largeur = rendu.shape[:2]
    dedans = []
    for masque, aire in _composantes_d_avant(rendu[:, :, 3] == 0):
        if masque[0].any() or masque[hauteur - 1].any() or masque[:, 0].any() or masque[:, largeur - 1].any():
            continue
        dedans.append(module._decrire(rendu, masque, aire))
    dedans.sort(key=lambda t: t.aire, reverse=True)
    return les_taches, les_poches, dedans


def test_une_poussiere_de_poches_ne_coute_plus_un_masque_chacune(monkeypatch):
    """**Ce qui coûtait dix-sept secondes**, réduit à sa cause : mille poches
    d'un pixel et deux vraies. Seules les deux vraies reçoivent un masque."""
    from atelier.image import traitement
    from atelier.image.taches import poches_de_fond_enferme

    rendu = np.zeros((200, 200, 4), dtype=np.uint8)
    rendu[:, :, :3] = FOND
    rendu[:, :, 3] = 255
    rendu[10:190, 10:190, :3] = SUJET
    grain = np.zeros((180, 180), dtype=bool)
    grain[::4, ::4] = True
    rendu[10:190, 10:190][grain, :3] = FOND  # 2 025 poches d'un pixel
    rendu[40:50, 40:50, :3] = FOND
    rendu[120:130, 120:130, :3] = FOND

    appels = []
    masque_d_origine = traitement.Etiquetage.masque

    def compter(self, k):
        appels.append(k)
        return masque_d_origine(self, k)

    monkeypatch.setattr(traitement.Etiquetage, "masque", compter)
    poches = poches_de_fond_enferme(rendu, FOND)

    assert len(poches) == 2
    assert len(appels) == 2, "un masque par poche gardée, aucun pour la poussière"
