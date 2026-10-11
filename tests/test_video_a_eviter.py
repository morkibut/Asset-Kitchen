"""Le champ « à éviter » de la vidéo (relevé du 10 octobre 2026).

La mort du nain est partie avec le seul texte d'interdiction fixe du moteur
(`montage_maison.NEGATIF`, étape 13) : l'auteur n'avait aucun moyen de dire ce
que le clip devait éviter, alors que l'image et le son en ont un.
`prompt_negatif_video` s'ajoute **après** le texte fixe, jamais à sa place.
"""

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.travail import TravailRefuse, demande_normalisee, pour_l_empreinte
from atelier.fournisseur.maison import MoteurDeLaMaison, modele_de_la_maison
from atelier.fournisseur.montage_maison import NEGATIF, montage_du_clip, negatif_du_clip
from atelier.image import clip as decodeur
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a11 import ComfyDouble
from tests.test_px5_image_de_fin import _comfy_qui_nomme


def test_sans_a_eviter_l_etape_13_porte_le_texte_fixe_seul():
    assert montage_du_clip(image="a.png", texte="m", images=17)["13"]["inputs"]["text"] == NEGATIF
    assert montage_du_clip(image="a.png", texte="m", images=17, a_eviter="   ")["13"]["inputs"]["text"] == NEGATIF


def test_l_a_eviter_s_ajoute_apres_le_texte_fixe():
    texte = montage_du_clip(image="a.png", texte="m", images=17,
                            a_eviter="green background, second character")["13"]["inputs"]["text"]
    assert texte.startswith(NEGATIF)
    assert texte == NEGATIF + ", green background, second character"
    assert negatif_du_clip("a\n  b") == NEGATIF + ", a b"


def _brute(**en_plus):
    return {"cle": "k", "reference_asset": "r", "modele_video": "m", "prompt_video": "p", **en_plus}


def test_la_demande_valide_le_champ_comme_les_autres_textes():
    assert demande_normalisee(_brute(), source_libre=True)["prompt_negatif_video"] == ""
    assert demande_normalisee(_brute(prompt_negatif_video="  pas de vert  "), source_libre=True)["prompt_negatif_video"] == "pas de vert"
    with pytest.raises(TravailRefuse, match="du texte"):
        demande_normalisee(_brute(prompt_negatif_video=3), source_libre=True)
    with pytest.raises(TravailRefuse, match="500"):
        demande_normalisee(_brute(prompt_negatif_video="x" * 501), source_libre=True)
    with pytest.raises(TravailRefuse, match="contrôle"):
        demande_normalisee(_brute(prompt_negatif_video="a\nb"), source_libre=True)
    # Laissé vide, il ne change pas l'empreinte d'une demande d'avant.
    assert "prompt_negatif_video" not in pour_l_empreinte(demande_normalisee(_brute(), source_libre=True))


@pytest.fixture
async def atelier_maison(tmp_path, double):
    if decodeur.indisponible() is not None:
        pytest.skip("le décodeur vidéo n'est pas installé")
    comfy = ComfyDouble()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: MoteurDeLaMaison(transport=httpx.MockTransport(_comfy_qui_nomme(comfy))))
    await atelier.ouvrir()
    yield atelier, comfy
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()
    await atelier.file_locale.fermer()


@pytest.mark.parametrize("a_eviter", ["green background, second character", ""])
async def test_la_route_video_libre_porte_l_a_eviter_jusqu_a_l_etape_13(atelier_maison, a_eviter):
    atelier, comfy = atelier_maison
    projet = atelier.bibliotheque.courant
    reference = atelier.generations.importer(image_sujet(), "Nain", projet=projet)["asset"]["identifiant"]
    corps = {"cle": "mort", "reference_asset": reference, "modele_video": modele_de_la_maison().identifiant,
             "prompt_video": "The dwarf collapses", "secondes": 1}
    if a_eviter:
        corps["prompt_negatif_video"] = a_eviter
    app = creer_application(atelier)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
        r = await client.post(f"/api/projects/{projet}/free-video-jobs/prepare", json=corps)
        assert r.status_code == 200, r.text
        travail = r.json()
    assert travail["demande"]["prompt_negatif_video"] == a_eviter
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()
    assert comfy.montages, atelier.travaux.lire(projet, travail["identifiant"])
    texte = comfy.montages[0]["13"]["inputs"]["text"]
    if a_eviter:
        assert texte.startswith(NEGATIF) and texte.endswith(a_eviter)
        assert atelier.animation.lire(travail["identifiant"] + "-video").demande["prompt_negatif"] == a_eviter
    else:
        assert texte == NEGATIF
        assert "prompt_negatif" not in atelier.animation.lire(travail["identifiant"] + "-video").demande
