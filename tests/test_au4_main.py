"""Le pinceau vise la case affichée, même après une poussée bornée.

On distingue les pixels peints des pixels déplacés et on vérifie la relecture
sur disque ; une simple comparaison du JSON envoyé ne verrait pas le défaut.
"""
import io

import numpy as np
from PIL import Image

from atelier.domaine.bande import Prise
from atelier.domaine.recette import Main, Recette
from atelier.image.bande import assembler
from atelier.services import Atelier
from test_a9 import atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip, clip_connu, un_personnage, un_sprite  # noqa: F401
from test_v303 import _garder, _corriger, _planche


def touche(x, y):
    return Main.depuis_json({"calques": [{"nom": "Correction", "passages": [
        {"points": [[x, y]], "rayon": 0, "couleur": "#ff0000", "garde": True}
    ]}]})


def test_peindre_sur_la_case_ne_change_pas_la_poussee_bornee():
    base = np.zeros((16, 16, 4), dtype=np.uint8)
    base[5:10, 4:8] = (0, 0, 255, 255)
    planche = assembler([base], Recette(), None, poussees=[(99, 0)],
                       mains_apres_placement=[touche(1, 2)])
    pixels = np.asarray(Image.open(io.BytesIO(planche.octets)))
    assert tuple(pixels[2, 1]) == (255, 0, 0, 255)
    assert tuple(pixels[6, 15]) == (0, 0, 255, 255)
    assert np.count_nonzero(pixels[:, :, 2]) == 20


def test_main_historique_reste_avant_la_poussee_et_json_inchange():
    ancienne = {"numero": 2, "clip": "", "dx": 2, "dy": 0,
                "recette": Recette(main=touche(1, 2)).en_json()}
    prise = Prise.depuis_json(ancienne)
    assert prise.en_json() == ancienne
    base = np.zeros((16, 16, 4), dtype=np.uint8)
    resultat = assembler([base], prise.recette, None, poussees=[(2, 0)])
    pixels = np.asarray(Image.open(io.BytesIO(resultat.octets)))
    assert tuple(pixels[2, 3]) == (255, 0, 0, 255)
    assert pixels[2, 1, 3] == 0


def test_main_finale_rouvre_se_recalcule_et_suit_son_occurrence(
    atelier_video, client_video, clip, tmp_path, double, animateur,
):
    bande = _garder(client_video, clip)
    avant = _planche(client_video, bande["identifiant"])
    prises = list(bande["prises"])
    prises[1]["main_apres_placement"] = touche(1, 2).en_json()
    prises[1]["dx"] = 3
    _corriger(client_video, bande["identifiant"], prises)
    apres = _planche(client_video, bande["identifiant"])
    largeur = apres.shape[1] // len(prises)
    assert tuple(apres[2, largeur + 1]) == (255, 0, 0, 255)
    assert np.array_equal(avant[:, :largeur], apres[:, :largeur])
    assert np.array_equal(avant[:, 2 * largeur:], apres[:, 2 * largeur:])
    rouvert = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    rouvert.bibliotheque.ouvrir()
    relue = rouvert.montage.bande(bande["identifiant"])
    assert relue.prises[1].main_apres_placement == touche(1, 2)
    (rouvert.fichiers.racine / relue.planche).unlink(missing_ok=True)
    # Le chemin public refait le cache, avec les mêmes pixels après fermeture.
    recalcule = rouvert.montage.planche(relue.identifiant)
    assert np.array_equal(np.asarray(Image.open(io.BytesIO(recalcule))), apres)
    _corriger(client_video, bande["identifiant"], [prises[1], prises[0], *prises[2:]])
    deplace = _planche(client_video, bande["identifiant"])
    assert tuple(deplace[2, 1]) == (255, 0, 0, 255)
