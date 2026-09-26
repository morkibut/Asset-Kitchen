"""PX4 : « la marge avant d'animer » — le sujet occupe une part réglable de la
toile envoyée au modèle vidéo, gardée avec le clip et relue à la réouverture.

Avant cette tranche, `atelier/image/clip.py::composer_entree` figeait cette
part à 0,80. Elle devient un réglage `part_sujet` de la demande de fabrication
(`atelier/domaine/travail.py`), transporté jusqu'à
`ServiceAnimation.preparer_entree` puis `composer_entree`.
"""

import io
from dataclasses import replace

import pytest
from PIL import Image

from atelier.domaine.animation import taille_demandee
from atelier.domaine.travail import TravailRefuse, demande_normalisee
from atelier.image.clip import composer_entree
from atelier.services import Atelier
from atelier.services.animation import ServiceAnimation
from atelier.services.travaux import ServiceTravaux
from tests.conftest import image_sujet
from tests.test_a9 import MELE, AnimateurDouble, clip_mp4


def _sprite(cote: int = 30) -> bytes:
    image = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (cote - 4, cote - 4), (200, 60, 60, 255)), (2, 2))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _largeur_du_sujet(octets: bytes) -> int:
    with Image.open(io.BytesIO(octets)) as toile:
        rvb = toile.convert("RGB")
        fond = rvb.getpixel((0, 0))
        colonnes = [x for x in range(rvb.width) if any(rvb.getpixel((x, y)) != fond for y in range(rvb.height))]
        return max(colonnes) - min(colonnes) + 1


def test_composer_entree_change_avec_la_part_du_sujet():
    """Une marge plus large réduit le facteur d'agrandissement entier — le
    sujet occupe moins de place — et une marge plus étroite l'augmente."""
    sprite = _sprite()
    canevas = (480, 480)
    large = composer_entree(sprite, canevas, part=0.95)
    etroit = composer_entree(sprite, canevas, part=0.50)
    assert _largeur_du_sujet(large) > _largeur_du_sujet(etroit)


def test_composer_entree_par_defaut_reste_0_80():
    """Sans réglage, `composer_entree` se comporte exactement comme avant
    cette tranche : `part=0.80` reste le défaut de la fonction."""
    sprite = _sprite()
    canevas = (480, 480)
    assert composer_entree(sprite, canevas) == composer_entree(sprite, canevas, part=0.80)


def test_preparer_entree_sans_reglage_rend_l_image_d_hier():
    """`ServiceAnimation.preparer_entree` sans `part_sujet` compose l'image
    exactement comme avant : même octets que `composer_entree(..., part=0.80)`."""
    sprite = _sprite()
    resolution, proportions = "480p", "1:1"
    defaut = ServiceAnimation.preparer_entree(sprite, resolution, proportions)
    attendu = composer_entree(sprite, taille_demandee(resolution, proportions), part=0.80)
    assert defaut == attendu


def test_preparer_entree_avec_une_marge_change_l_image_envoyee():
    sprite = _sprite()
    resolution, proportions = "480p", "1:1"
    defaut = ServiceAnimation.preparer_entree(sprite, resolution, proportions)
    large = ServiceAnimation.preparer_entree(sprite, resolution, proportions, 0.95)
    assert large != defaut
    assert _largeur_du_sujet(large) > _largeur_du_sujet(defaut)


def test_demande_normalisee_part_sujet_par_defaut_et_bornes():
    brute = {"cle": "c", "personnage": "p", "pose": "marche", "direction": "sud",
              "modele_video": "m", "prompt_video": "il marche"}
    assert demande_normalisee(brute)["part_sujet"] == 0.80
    assert demande_normalisee({**brute, "part_sujet": 0.55})["part_sujet"] == 0.55
    with pytest.raises(TravailRefuse, match="part_sujet"):
        demande_normalisee({**brute, "part_sujet": 0.30})
    with pytest.raises(TravailRefuse, match="part_sujet"):
        demande_normalisee({**brute, "part_sujet": 1.0})
    with pytest.raises(TravailRefuse, match="part_sujet"):
        demande_normalisee({**brute, "part_sujet": "0.8"})


@pytest.fixture
async def production(tmp_path, double):
    animateur = AnimateurDouble()

    async def observer():
        return {"etat": "disponible", "travaux": []}

    animateur.observer_ressource = observer
    animateur.octets = clip_mp4()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    atelier.travaux = ServiceTravaux(atelier)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    objet = atelier.base.lire_projet(projet)
    objet.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(objet)
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin", "Un petit pèlerin en manteau", objectif={
        "sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}],
        "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64},
    })
    asset = atelier.generations.importer(_sprite(60), "référence", projet=projet)["asset"]
    demande = {"cle": "marche-1", "personnage": personnage.identifiant, "pose": "marche", "direction": "ouest",
               "reference_asset": asset["identifiant"],
               "modele_video": MELE.identifiant, "prompt_video": "Walk in place, keep entire silhouette visible.",
               "cadence": 11, "nombre_images": 4}
    yield atelier, projet, demande, asset, animateur
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()


async def test_un_clip_garde_avec_une_marge_non_par_defaut_se_rouvre_avec_elle(production, double):
    """AGENTS 8septies : garder puis relire, avec un réglage différent du
    défaut — jamais reprendre les réglages du produit à la relecture."""
    atelier, projet, demande, asset, animateur = production
    travail = await atelier.travaux.preparer(projet, {**demande, "part_sujet": 0.55})
    assert travail["demande"]["part_sujet"] == 0.55

    # La toile envoyée reflète bien la marge demandée, pas le défaut du produit.
    chemin = atelier.travaux._dossier(projet, travail["identifiant"]) / "entree-video.png"
    sprite = atelier.assets.reference(asset["identifiant"])
    canevas = taille_demandee(travail["demande"]["resolution"], travail["demande"]["proportions"])
    assert chemin.read_bytes() == composer_entree(sprite, canevas, part=0.55)

    # Fermer, puis rouvrir un atelier neuf sur le même dossier — la relecture
    # ne doit rien devoir à l'état encore chaud du premier processus.
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    autre.travaux = ServiceTravaux(autre)
    await autre.ouvrir()
    relu = autre.travaux.lire(projet, travail["identifiant"])
    assert relu["demande"]["part_sujet"] == 0.55


async def test_un_clip_garde_sans_reglage_se_rouvre_sur_le_defaut(production):
    atelier, projet, demande, asset, animateur = production
    travail = await atelier.travaux.preparer(projet, demande)
    assert travail["demande"]["part_sujet"] == 0.80


async def _fin(atelier, projet, travail, acteur="auteur"):
    await atelier.travaux.demarrer(projet, travail["identifiant"], acteur)
    await atelier.travaux.attendre_tout()
    return atelier.travaux.lire(projet, travail["identifiant"])


async def test_une_generation_de_clip_garde_sa_marge_et_se_rouvre_avec_elle(production, double):
    """AGENTS 8septies, corrigé après une première lecture trop étroite du
    critère : ce qui doit garder la marge, c'est le clip **permanent**
    (`Generation.demande`), pas seulement le travail éphémère qui l'a préparé
    — sinon « Relancer » depuis un clip terminé retombe en silence sur 80 %."""
    atelier, projet, demande, asset, animateur = production
    travail = await atelier.travaux.preparer(projet, {**demande, "part_sujet": 0.60})
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini

    clip = atelier.base.lire(fini["clip"])
    assert clip.demande["part_sujet"] == 0.60

    # Fermer, puis rouvrir un atelier neuf sur le même dossier.
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    autre.travaux = ServiceTravaux(autre)
    await autre.ouvrir()
    relu = autre.base.lire(fini["clip"])
    assert relu.demande["part_sujet"] == 0.60


async def test_une_generation_de_clip_sans_reglage_se_lit_a_80_pourcent(production):
    atelier, projet, demande, asset, animateur = production
    travail = await atelier.travaux.preparer(projet, demande)
    fini = await _fin(atelier, projet, travail)
    clip = atelier.base.lire(fini["clip"])
    assert clip.demande["part_sujet"] == 0.80

    # Une génération d'avant PX4 n'a pas la clé du tout — c'est la vérité, et
    # la lecture retombe sur le défaut du produit d'alors, pas sur une erreur.
    ancienne = replace(clip, demande={k: v for k, v in clip.demande.items() if k != "part_sujet"})
    assert "part_sujet" not in ancienne.demande
    assert ancienne.demande.get("part_sujet", 0.80) == 0.80
