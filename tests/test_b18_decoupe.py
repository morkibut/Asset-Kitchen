# -*- coding: utf-8 -*-
"""`B18` · l'atelier Découpe — le troisième mode, « les gouttières ».

Un troisième moteur pour la fabrique « Découper » (`docs/PLAN-carnet.md` § B18,
`docs/pistes-2026-09-04/carnet/atelier-decoupe.dc.html`) : ni « zones opaques »
(qui a besoin d'un alpha déjà détouré) ni « grille fixe » (qui coupe en parts
égales sans rien regarder) ne savent lire une feuille opaque de bord à bord —
le cas le plus courant d'une planche rendue par un modèle. « Les gouttières »
cherche les rangées et les colonnes entièrement d'une seule couleur, et coupe
là.

Les essais purs (`atelier.image.decoupe.gouttieres`) fabriquent leurs propres
images, séparées de leur fond par des bandes volontairement uniformes — le
contraire des planches de `test_t5.py`, dont les sujets frôlent parfois le bord
de leur case et ne garantissent pas une gouttière franche. L'essai de service
reprend le patron de `test_t5.py` (`client`, `double`) pour vérifier le
branchement de bout en bout, y compris la mesure de temps (`duree_ms`, critère
commun à tout `B18`).
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from atelier.image import gouttieres
from atelier.services.decoupe import GOUTTIERES, MODES

from test_t5 import _decouper, _proposer

FOND = (240, 236, 228)
GOUTTIERE = 6
CASE = 40


def _feuille(
    cellules: list[list[tuple[int, int, int] | None]],
) -> bytes:
    """Une grille de cases, séparées par des bandes de fond garanties uniformes.

    `cellules[ligne][colonne]` est la couleur du sujet de cette case, ou
    `None` pour une case laissée vide (donc de la couleur du fond, comme les
    « deux cases restées vides » de la planche de la maquette). Chaque case
    remplit tout son carré — aucune marge interne — pour que la seule bande
    uniforme du fichier soit la gouttière elle-même, jamais une marge de case
    qu'on confondrait avec elle.
    """
    lignes, colonnes = len(cellules), len(cellules[0])
    largeur = colonnes * CASE + (colonnes + 1) * GOUTTIERE
    hauteur = lignes * CASE + (lignes + 1) * GOUTTIERE
    image = Image.new("RGB", (largeur, hauteur), FOND)
    dessin = ImageDraw.Draw(image)
    for ligne, rangee in enumerate(cellules):
        for colonne, couleur in enumerate(rangee):
            if couleur is None:
                continue
            x0 = GOUTTIERE + colonne * (CASE + GOUTTIERE)
            y0 = GOUTTIERE + ligne * (CASE + GOUTTIERE)
            dessin.rectangle([x0, y0, x0 + CASE - 1, y0 + CASE - 1], fill=couleur)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _boite_attendue(ligne: int, colonne: int) -> tuple[int, int, int, int]:
    x0 = GOUTTIERE + colonne * (CASE + GOUTTIERE)
    y0 = GOUTTIERE + ligne * (CASE + GOUTTIERE)
    return (x0, y0, x0 + CASE - 1, y0 + CASE - 1)


# ── Le moteur pur ────────────────────────────────────────────────────────────


def test_gouttieres_est_le_troisieme_mode_accepte():
    assert GOUTTIERES == "gouttieres"
    assert MODES == ("auto", "grille", "gouttieres")


def test_quatre_cases_pleines_rendent_quatre_boites_dans_l_ordre_de_lecture():
    octets = _feuille(
        [
            [(200, 40, 40), (40, 140, 60)],
            [(40, 90, 200), (210, 170, 30)],
        ]
    )
    boites = gouttieres(octets)
    assert boites == [
        _boite_attendue(0, 0),
        _boite_attendue(0, 1),
        _boite_attendue(1, 0),
        _boite_attendue(1, 1),
    ]


def test_une_case_vide_entre_deux_sujets_ne_sort_pas():
    """Une case de la couleur du fond, entourée de sujets, n'a pas de gouttière
    qui l'isole sur toute la largeur ou la hauteur — et ce n'est pas un sujet
    pour autant (même choix que `zones_opaques`, qui rejette ce que rien ne
    remplit)."""
    octets = _feuille(
        [
            [(200, 40, 40), None],
            [(40, 90, 200), (210, 170, 30)],
        ]
    )
    boites = gouttieres(octets)
    assert boites == [
        _boite_attendue(0, 0),
        _boite_attendue(1, 0),
        _boite_attendue(1, 1),
    ]


def test_une_image_entierement_unie_ne_rend_aucune_boite():
    image = Image.new("RGB", (64, 48), FOND)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    assert gouttieres(tampon.getvalue()) == []


def test_une_seule_gouttiere_horizontale_separe_deux_bandes_pleine_largeur():
    """Pas de gouttière verticale du tout : chaque bande fait toute la largeur,
    exactement ce qu'une planche « au-dessus / en-dessous » doit rendre.

    **Une marge de fond entoure les deux bandes**, comme sur une vraie feuille
    (`atelier-decoupe.dc.html` : la planche a du fond sur ses quatre bords) —
    le fond se lit à la médiane de la bordure, donc un contenu qui toucherait
    lui-même le bord de l'image n'est pas le cas que cet essai mesure."""
    largeur, bande = 50, 20
    largeur_totale = largeur + 2 * GOUTTIERE
    hauteur_totale = 2 * bande + 3 * GOUTTIERE
    image = Image.new("RGB", (largeur_totale, hauteur_totale), FOND)
    dessin = ImageDraw.Draw(image)
    y0 = GOUTTIERE
    dessin.rectangle([GOUTTIERE, y0, GOUTTIERE + largeur - 1, y0 + bande - 1], fill=(180, 60, 60))
    y1 = 2 * GOUTTIERE + bande
    dessin.rectangle([GOUTTIERE, y1, GOUTTIERE + largeur - 1, y1 + bande - 1], fill=(60, 120, 180))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    assert gouttieres(tampon.getvalue()) == [
        (GOUTTIERE, y0, GOUTTIERE + largeur - 1, y0 + bande - 1),
        (GOUTTIERE, y1, GOUTTIERE + largeur - 1, y1 + bande - 1),
    ]


def test_gouttieres_lit_l_alpha_aussi_une_planche_transparente_de_bord_a_bord():
    """La détection porte sur les quatre canaux : un fond transparent (RGBA
    uniforme) est une gouttière tout autant qu'un fond opaque uni."""
    image = Image.new("RGBA", (2 * CASE + 3 * GOUTTIERE, CASE + 2 * GOUTTIERE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    x0 = GOUTTIERE
    dessin.rectangle([x0, GOUTTIERE, x0 + CASE - 1, GOUTTIERE + CASE - 1], fill=(200, 40, 40, 255))
    x1 = 2 * GOUTTIERE + CASE
    dessin.rectangle([x1, GOUTTIERE, x1 + CASE - 1, GOUTTIERE + CASE - 1], fill=(40, 140, 60, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    boites = gouttieres(tampon.getvalue())
    assert len(boites) == 2


# ── Le service, de bout en bout ──────────────────────────────────────────────


def _planche_a_gouttieres_generee(client, double) -> dict:
    octets = _feuille(
        [
            [(200, 40, 40), (40, 140, 60)],
            [(40, 90, 200), (210, 170, 30)],
        ]
    )
    double.rendre = lambda: octets
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "une feuille à gouttières"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_le_service_propose_les_quatre_cases_et_mesure_son_temps(client, double):
    asset = _planche_a_gouttieres_generee(client, double)

    propose = _proposer(client, asset["identifiant"], mode="gouttieres")
    assert propose["mode"] == "gouttieres"
    assert len(propose["boites"]) == 4
    assert propose["boites"][0] == list(_boite_attendue(0, 0))
    assert propose["raison"] is None

    # Le critère commun à tout `B18` : chaque moteur neuf porte sa mesure de
    # temps. Elle doit exister et rester raisonnable sur une image d'essai.
    assert isinstance(propose["duree_ms"], (int, float))
    assert 0 <= propose["duree_ms"] < 1000

    # Et ce que le service propose se découpe pour de vrai.
    decoupees = _decouper(client, asset["identifiant"], propose["boites"])["decoupes"]
    assert len(decoupees) == 4


def test_le_service_dit_pourquoi_quand_aucune_gouttiere_ne_se_trouve(client, double):
    image = Image.new("RGB", (64, 64), FOND)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    double.rendre = lambda: tampon.getvalue()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "une feuille sans rien"},
    ).json()
    asset = client.get(f"/api/assets/{generation['identifiant']}-0").json()

    propose = _proposer(client, asset["identifiant"], mode="gouttieres")
    assert propose["boites"] == []
    assert "corrige à la main" in propose["raison"]


def test_un_mode_toujours_inconnu_reste_refuse(client, double):
    asset = _planche_a_gouttieres_generee(client, double)
    refus = client.get(
        f"/api/assets/{asset['identifiant']}/slices", params={"mode": "grid"}
    )
    assert refus.status_code == 409
    assert "grid" in refus.json()["raison"]
