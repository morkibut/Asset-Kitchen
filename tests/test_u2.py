# -*- coding: utf-8 -*-
"""Les critères de U2 qui se mesurent sur des pixels — le recadrage.

La moitié de l'étape qui se voit à l'écran — le zoom libre, la molette, les deux
rectangles superposés — vit dans `interface/src/App.test.tsx`. Celle qui se
**mesure** vit ici : la boîte du sujet lue sur l'alpha, le rectangle réellement
gardé une fois la marge ajoutée et rognée, la part du fichier d'origine qui est
jetée, les bords que le sujet touche, et ce qu'une boîte tracée coupe.

**C'est la répartition ordinaire du dépôt**, et elle a une raison précise ici :
la table de recadrage montrait un curseur de marge et rien d'autre, si bien que
rien ne disait ce que le cadrage gardait. Ce que l'écran affiche désormais, il
ne le calcule pas — il le lit. Un second calcul écrit à l'écran aurait divergé
du traitement au premier arrondi, et c'est justement l'écart entre *ce qu'on
dessine* et *ce que le rendu garde* que l'étape existe pour montrer.

**Aucun test de ce fichier n'appelle le fournisseur** : le double rend une image
construite à la main, comme partout ailleurs.
"""

from __future__ import annotations

import numpy as np
from PIL import Image
import io

from tests.conftest import image_sujet


# ── Une image faite pour la mesure ───────────────────────────────────────────


def _image_avec_sujet(
    largeur: int = 40,
    hauteur: int = 40,
    boite: tuple[int, int, int, int] = (10, 6, 29, 33),
) -> bytes:
    """Un rectangle opaque sur un fond plat, à des coordonnées connues.

    Le fond est **uniforme et différent du sujet** : c'est ce que le détourage
    par remplissage depuis le bord sait retirer, donc ce qui donne une boîte du
    sujet égale à `boite` au pixel près. Une image bruitée rendrait la mesure
    juste mais l'assertion illisible.
    """
    tableau = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    tableau[:, :, :3] = (14, 18, 22)
    tableau[:, :, 3] = 255
    x0, y0, x1, y1 = boite
    tableau[y0 : y1 + 1, x0 : x1 + 1, :3] = (220, 150, 90)
    sortie = io.BytesIO()
    Image.fromarray(tableau, "RGBA").save(sortie, format="PNG")
    return sortie.getvalue()


def _asset(client, double, octets: bytes | None = None) -> dict:
    double.rendre = lambda: octets if octets is not None else image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai/rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _poser(client, identifiant: str, **places) -> dict:
    recette = {
        "passes": [
            {
                "moteur": "bord",
                "tolerance": 28,
                "seuil_alpha": 128,
                "durcissement": 0,
                "point": None,
                "portee": "tache",
            }
        ],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "contours": None,
        "main": None,
        "nom": None,
    }
    recette.update(places)
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=recette)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _recadrage(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}/spots")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["recadrage"]


# ── « La boîte du sujet est mesurée sur l'alpha, et se recalcule » ───────────


def test_la_boite_du_sujet_est_celle_de_l_alpha(client, double):
    """**Un constat, pas un réglage.** C'est ce que la provenance écrite à
    l'écran promet — *mesurée sur l'alpha* — et c'est ce qui permet de la
    présenter comme le défaut : elle est juste dans l'immense majorité des cas,
    et elle se défait en traçant."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(client, asset["identifiant"])

    vu = _recadrage(client, asset["identifiant"])
    assert vu["origine"] == [40, 40]
    assert vu["sujet"] == [10, 6, 29, 33]
    assert vu["tracee"] is None
    # Sans marge ni boîte tracée, ce qui est gardé **est** la boîte du sujet.
    assert vu["obtenue"] == [10, 6, 29, 33]


def test_la_boite_du_sujet_se_recalcule_quand_le_detourage_change(client, double):
    """C'est toute la différence avec une boîte tracée, et c'est ce qu'on veut :
    reprendre le détourage déplace le cadrage."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(client, asset["identifiant"])
    avant = _recadrage(client, asset["identifiant"])["sujet"]

    # Sans passe, rien n'est transparent : la boîte du sujet est l'image
    # entière — recadrer dessus ne retirerait rien.
    _poser(client, asset["identifiant"], passes=[])
    apres = _recadrage(client, asset["identifiant"])["sujet"]

    assert avant == [10, 6, 29, 33]
    assert apres == [0, 0, 39, 39]


# ── « Le rectangle obtenu est celui que le rendu garde » ─────────────────────


def test_la_marge_s_ajoute_a_la_boite_et_le_dit(client, double):
    """**Le comportement voulu, que rien ne montrait.** On dessine un rectangle,
    le rendu en garde un autre, et aucun des deux n'est faux — c'est le second
    qui décide, et c'est celui-là que l'écran dessine désormais en pointillé."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(
        client,
        asset["identifiant"],
        recadrage={"marge": 4, "boite": [12, 12, 20, 20]},
    )

    vu = _recadrage(client, asset["identifiant"])
    assert vu["tracee"] == [12, 12, 20, 20]
    assert vu["obtenue"] == [8, 8, 24, 24]


def test_la_marge_est_rognee_sur_les_bords_de_l_image(client, double):
    """Le coût nommé de la marge, et il se voit ici : un sujet collé au bord
    haut avec une marge de douze rend douze pixels en bas et zéro en haut. Le
    sujet n'est plus au centre de son image, et c'est la mesure du bord touché
    qui le signale."""
    asset = _asset(client, double, _image_avec_sujet(boite=(10, 0, 29, 20)))
    _poser(client, asset["identifiant"], recadrage={"marge": 12, "boite": None})

    vu = _recadrage(client, asset["identifiant"])
    assert vu["sujet"] == [10, 0, 29, 20]
    # En haut, il n'y a pas de pixel à garder : la marge y vaut zéro.
    assert vu["obtenue"] == [0, 0, 39, 32]
    assert vu["bords"] == ["haut"]


# ── « La part jetée est la mesure utile de cette table » ─────────────────────


def test_la_part_jetee_est_celle_du_fichier_d_origine(client, double):
    """Elle explique pourquoi un sprite paraît flou après la grille : un sujet
    qui n'occupait qu'un quart du fichier a peu de pixels à donner. Ce n'est pas
    un verdict sur le modèle — une pose de saut occupe légitimement moins qu'une
    pose de repos."""
    asset = _asset(client, double, _image_avec_sujet(boite=(10, 10, 29, 29)))
    _poser(client, asset["identifiant"])

    vu = _recadrage(client, asset["identifiant"])
    # 20 × 20 gardés sur 40 × 40 : les trois quarts du fichier sont jetés.
    assert vu["obtenue"] == [10, 10, 29, 29]
    assert round(vu["jete"], 2) == 0.75


# ── « Une boîte n'agit que quand elle coupe le sujet » ───────────────────────


def test_une_boite_plus_large_que_le_sujet_ne_coupe_rien(client, double):
    """**La phrase importante de la table.** La remise sur grille recherche
    elle-même la boîte du sujet et rogne dessus : le surplus transparent d'une
    boîte trop large disparaît de toute façon. Le dire évite de croire qu'on a
    réglé quelque chose."""
    asset = _asset(client, double, _image_avec_sujet(boite=(10, 10, 29, 29)))
    _poser(client, asset["identifiant"], recadrage={"marge": 0, "boite": [4, 4, 35, 35]})

    assert _recadrage(client, asset["identifiant"])["coupe"] == {}


def test_une_boite_qui_coupe_le_dit_cote_par_cote(client, double):
    """C'est la ligne sœur qui paraît sous le rectangle dès qu'on le relâche, et
    elle porte le nombre de pixels perdus de chaque côté — sans quoi on
    découvrirait le bras coupé quatre poses plus tard."""
    asset = _asset(client, double, _image_avec_sujet(boite=(10, 10, 29, 29)))
    _poser(
        client,
        asset["identifiant"],
        recadrage={"marge": 0, "boite": [14, 10, 29, 25]},
    )

    coupe = _recadrage(client, asset["identifiant"])["coupe"]
    assert coupe == {"gauche": 4, "bas": 4}


def test_une_image_sans_alpha_n_a_pas_de_boite_de_sujet(client, double):
    """Le seul cas où la table est indisponible : tout est opaque, le plus petit
    rectangle qui contient tout ce qui n'est pas transparent est l'image
    entière, et recadrer dessus ne retirerait rien. La mesure ne refuse pas —
    elle rend l'image entière, et c'est l'écran qui grise."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(client, asset["identifiant"], passes=[])

    vu = _recadrage(client, asset["identifiant"])
    assert vu["sujet"] == [0, 0, 39, 39]
    assert vu["jete"] == 0.0
    # Le sujet « touche » alors les quatre bords, ce qui est vrai et sans
    # intérêt : l'écran ne montre cette phrase que sur une image détourée.
    assert set(vu["bords"]) == {"haut", "bas", "gauche", "droite"}
