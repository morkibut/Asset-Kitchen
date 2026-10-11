"""Le fond de l'image de départ d'une vidéo (relevé du 10 octobre 2026).

La mort du nain est partie vers Wan sur du vert pur `#00FF00` — le candidat
« le plus éloigné » des couleurs du sprite — alors que son texte demandait
*« plain neutral grey background »* : les images 0 à 4 du clip fondent du vert
au gris. La toile prend désormais le fond demandé, gris neutre sinon, et le
détourage des images du clip la retrouve sans couleur fixée.
"""

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.fond import GRIS_NEUTRE_VIDEO, fond_de_depart_video, fond_nomme_par_le_texte, rvb
from atelier.domaine.recette import Passe, Recette
from atelier.domaine.travail import TravailRefuse, demande_normalisee
from atelier.image.traitement import detourer
from atelier.services.animation import ServiceAnimation
from atelier.services import Atelier
from tests.conftest import image_sujet

TEXTE_DU_NAIN = ("Pixel art dwarf miner, front view. He sinks slowly to his knees. "
                 "Static camera, plain neutral grey background, no camera motion, no zoom.")


def _nain() -> bytes:
    """Un sprite transparent aux couleurs qui faisaient élire le vert pur."""
    image = Image.new("RGBA", (32, 48), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (20, 40), (20, 20, 20, 255)), (6, 4))      # contour
    image.paste(Image.new("RGBA", (16, 36), (170, 90, 60, 255)), (8, 6))     # peau, cuir
    image.paste(Image.new("RGBA", (8, 10), (200, 40, 40, 255)), (12, 12))    # barbe rousse
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _pixels(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGB"))


def test_l_image_de_depart_d_un_sprite_transparent_n_a_aucun_vert_pur_et_part_sur_le_gris():
    entree = ServiceAnimation.preparer_entree(_nain(), "480p", "1:1")
    pixels = _pixels(entree)
    assert not np.all(pixels == (0, 255, 0), axis=2).any(), "aucun pixel vert pur"
    gris = rvb(GRIS_NEUTRE_VIDEO.couleur)
    assert tuple(pixels[0, 0]) == tuple(pixels[-1, -1]) == gris
    # Le bord entier est ce gris.
    bord = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    assert np.all(bord == gris)


def test_le_gris_est_neutre_et_documente():
    r, v, b = rvb(GRIS_NEUTRE_VIDEO.couleur)
    assert r == v == b and 64 <= r <= 192


def test_le_fond_demande_est_tenu():
    assert fond_de_depart_video("", TEXTE_DU_NAIN) == GRIS_NEUTRE_VIDEO.couleur
    assert fond_de_depart_video("", "a dwarf in a green cape") == GRIS_NEUTRE_VIDEO.couleur
    assert fond_de_depart_video("", "on a plain blue background") == "#0000FF"
    assert fond_de_depart_video("", "sur fond blanc") == "#FFFFFF"
    assert fond_de_depart_video("", "no green background") == GRIS_NEUTRE_VIDEO.couleur
    assert fond_de_depart_video("#ff00ff", TEXTE_DU_NAIN) == "#FF00FF"
    assert fond_nomme_par_le_texte(TEXTE_DU_NAIN) == GRIS_NEUTRE_VIDEO.couleur
    entree = ServiceAnimation.preparer_entree(_nain(), "480p", "1:1", fond="#0000FF")
    assert tuple(_pixels(entree)[0, 0]) == (0, 0, 255)


def test_la_demande_valide_fond_video():
    brute = {"cle": "k", "reference_asset": "r", "modele_video": "m", "prompt_video": "p"}
    assert demande_normalisee(brute, source_libre=True)["fond_video"] == ""
    assert demande_normalisee({**brute, "fond_video": "336699"}, source_libre=True)["fond_video"] == "#336699"
    with pytest.raises(TravailRefuse, match="fond_video"):
        demande_normalisee({**brute, "fond_video": "vert"}, source_libre=True)


def test_le_detourage_des_images_du_clip_retrouve_le_gris_sans_couleur_fixee():
    """Les images d'un clip se détourent par la passe « bord », qui lit la
    médiane des bordures : sur la toile grise, le fond part et le sujet reste —
    y compris sur un gris que le modèle aurait rendu un peu à côté."""
    entree = ServiceAnimation.preparer_entree(_nain(), "480p", "1:1")
    pixels = _pixels(entree).astype(np.int16)
    # Le modèle ne rend jamais l'hexadécimal exact : un gris décalé et bruité.
    bruit = np.random.default_rng(7).integers(-6, 7, size=pixels.shape)
    fond = np.all(_pixels(entree) == rvb(GRIS_NEUTRE_VIDEO.couleur), axis=2)
    rendu = np.where(fond[..., None], np.clip(pixels + 8 + bruit, 0, 255), pixels).astype(np.uint8)
    tampon = io.BytesIO()
    Image.fromarray(rendu, "RGB").save(tampon, format="PNG")
    rgba = detourer(Recette(passes=(Passe(moteur="bord"),)), tampon.getvalue())
    alpha = rgba[:, :, 3]
    assert (alpha[fond] == 0).mean() > 0.99, "le fond gris est retiré"
    assert (alpha[~fond] == 255).mean() > 0.99, "le sujet reste entier"


async def test_la_route_video_libre_ecrit_une_entree_grise(tmp_path, double):
    from tests.test_a9 import MELE, AnimateurDouble

    animateur = AnimateurDouble()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(_nain(), "Nain", projet=projet)["asset"]["identifiant"]
    t = await atelier.travaux.preparer(projet, {"cle": "mort", "reference_asset": reference,
        "modele_video": MELE.identifiant, "prompt_video": TEXTE_DU_NAIN}, source_libre=True)
    entree = (atelier.travaux._dossier(projet, t["identifiant"]) / "entree-video.png").read_bytes()
    pixels = _pixels(entree)
    assert not np.all(pixels == (0, 255, 0), axis=2).any()
    assert tuple(pixels[0, 0]) == rvb(GRIS_NEUTRE_VIDEO.couleur)
    assert t["entree_video"]["fond"] == GRIS_NEUTRE_VIDEO.couleur
