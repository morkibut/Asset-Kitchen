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
    besoin d'un point. Les trois arrivent ensemble, par la route déjà en
    place — aucune route neuve."""
    identifiant = _generer(client, double, _bus(poche=True))

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    fond_enferme = mesures["fond_enferme"]

    assert fond_enferme["zones"] == 1
    assert fond_enferme["couleur"].startswith("#")
    assert fond_enferme["point"] is not None
    x, y = fond_enferme["point"]
    assert isinstance(x, int) and isinstance(y, int)


def test_la_meme_image_sans_poche_ne_compte_aucune_zone(client, double):
    identifiant = _generer(client, double, _bus(poche=False))

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    fond_enferme = mesures["fond_enferme"]

    assert fond_enferme["zones"] == 0
    assert fond_enferme["point"] is None


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


def test_le_point_et_la_couleur_rendus_permettent_de_retirer_la_poche(client, double):
    """**Le geste complet du bouton « les retirer aussi »**, rejoué côté
    serveur : ajouter une passe « couleur », avec le point et la portée
    « partout » qu'un clic poserait, retire bien la poche que la mesure
    annonçait — et la mesure retombe à zéro."""
    identifiant = _generer(client, double, _bus(poche=True))

    avant = client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]
    assert avant["zones"] == 1
    point = avant["point"]

    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [
                {
                    "moteur": "couleur",
                    "tolerance": 28,
                    "seuil_alpha": 128,
                    "durcissement": 0,
                    "point": point,
                    "portee": "partout",
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

    apres = client.get(f"/api/assets/{identifiant}/spots").json()["fond_enferme"]
    assert apres["zones"] == 0
