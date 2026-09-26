"""PX5 : « finir sur une image » — l'image de fin d'un clip.

`image_de_fin` dans la demande de fabrication : absente, le clip finit libre ;
`"depart"`, il revient à l'image de départ (la boucle) ; sinon, l'identifiant
d'une image du jeu, composée sur la même toile que le départ. Un modèle qui ne
sait pas la prendre est grisé avec sa raison. OpenRouter la reçoit dans
`frame_images` (`last_frame`), le moteur de la maison par le nœud natif
`WanFirstLastFrameToVideo`. Pour une boucle, l'image en double est retirée de
la bande.

Aucun appel payé, aucun calcul sur la carte : les fournisseurs sont doublés.
"""

from __future__ import annotations

import io
import re
from dataclasses import replace

import httpx
import pytest
from PIL import Image

from atelier.domaine.animation import DemandeClip, taille_demandee
from atelier.domaine.travail import TravailRefuse, demande_normalisee, images_de_la_bande
from atelier.fournisseur.maison import MoteurDeLaMaison, modele_de_la_maison
from atelier.fournisseur.montage_maison import montage_du_clip
from atelier.fournisseur.openrouter_video import OpenRouterVideo
from atelier.image import clip as decodeur
from atelier.image.clip import composer_entree
from atelier.services import Atelier
from atelier.services.travaux import ServiceTravaux
from tests.conftest import image_sujet
from tests.test_a9 import MELE, AnimateurDouble, clip_mp4
from tests.test_a11 import ComfyDouble

# Un modèle doublé qui sait finir sur une image, à côté de `MELE` qui ne le sait pas.
FINIT = replace(MELE, identifiant="essai:finit", chez_lui="finit", accepte_une_image_de_fin=True)


def _sprite(cote: int = 30, couleur=(200, 60, 60, 255)) -> bytes:
    image = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (cote - 4, cote - 4), couleur), (2, 2))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


# ── Le catalogue ─────────────────────────────────────────────────────────────


def test_le_catalogue_openrouter_lit_last_frame():
    fiche = {"id": "x/y", "name": "Y", "supported_durations": [5], "supported_resolutions": ["480p"],
             "supported_aspect_ratios": ["1:1"], "pricing_skus": {}}
    avec = OpenRouterVideo._lire_fiche({**fiche, "supported_frame_images": ["first_frame", "last_frame"]})
    sans = OpenRouterVideo._lire_fiche({**fiche, "supported_frame_images": ["first_frame"]})
    assert avec.accepte_une_image_de_fin is True
    assert sans.accepte_une_image_de_fin is False


def test_le_moteur_de_la_maison_sait_finir_sur_une_image():
    assert modele_de_la_maison().accepte_une_image_de_fin is True


def test_un_modele_qui_ne_sait_pas_finir_est_grise_avec_sa_raison():
    demande = DemandeClip(texte="t", image=b"\0", secondes=5, image_de_fin=b"\0")
    assert MELE.refus(demande) == "ne sait pas finir sur une image choisie"
    assert FINIT.refus(demande) is None
    # Sans image de fin, rien ne change pour lui.
    assert MELE.refus(replace(demande, image_de_fin=None)) is None


def test_la_liste_des_modeles_video_grise_quand_on_demande_une_fin(tmp_path, double):
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application

    animateur = AnimateurDouble()
    animateur.modeles = [MELE, FINIT]
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    with TestClient(creer_application(atelier)) as client:
        libre = {m["identifiant"]: m for m in client.get("/api/clips/models?secondes=5").json()["modeles"]}
        fin = {m["identifiant"]: m for m in client.get("/api/clips/models?secondes=5&image_de_fin=true").json()["modeles"]}
    assert libre[MELE.identifiant]["grise"] is None
    assert fin[MELE.identifiant]["grise"] == "ne sait pas finir sur une image choisie"
    assert fin[FINIT.identifiant]["grise"] is None
    assert fin[FINIT.identifiant]["accepte_une_image_de_fin"] is True
    assert fin[MELE.identifiant]["accepte_une_image_de_fin"] is False


# ── Ce qui part ──────────────────────────────────────────────────────────────


def test_l_appel_openrouter_porte_l_image_de_fin():
    demande = DemandeClip(texte="t", image=_sprite(), secondes=5, image_de_fin=_sprite(couleur=(10, 200, 10, 255)))
    corps = OpenRouterVideo.corps_appel(FINIT, demande)
    roles = [f["frame_type"] for f in corps["frame_images"]]
    assert roles == ["first_frame", "last_frame"]
    assert corps["frame_images"][0]["image_url"]["url"] != corps["frame_images"][1]["image_url"]["url"]


def test_l_appel_openrouter_sans_fin_est_celui_d_hier():
    corps = OpenRouterVideo.corps_appel(MELE, DemandeClip(texte="t", image=_sprite(), secondes=5))
    assert [f["frame_type"] for f in corps["frame_images"]] == ["first_frame"]


def test_le_graphe_maison_sans_fin_est_inchange():
    montage = montage_du_clip(image="a.png", texte="m", images=17)
    assert montage["14"]["class_type"] == "WanImageToVideo"
    assert "end_image" not in montage["14"]["inputs"]
    assert "20" not in montage
    assert montage == montage_du_clip(image="a.png", texte="m", images=17, image_de_fin=None)


def test_le_graphe_maison_avec_fin_passe_par_le_noeud_natif():
    sans = montage_du_clip(image="a.png", texte="m", images=17)
    avec = montage_du_clip(image="a.png", texte="m", images=17, image_de_fin="b.png")
    assert avec["14"]["class_type"] == "WanFirstLastFrameToVideo"
    assert avec["14"]["inputs"]["start_image"] == ["11", 0]
    assert avec["14"]["inputs"]["end_image"] == ["20", 0]
    assert avec["20"] == {"class_type": "LoadImage", "inputs": {"image": "b.png", "upload": "image"}}
    # Le reste du montage est le même, entrée pour entrée.
    for numero in sans:
        if numero != "14":
            assert avec[numero] == sans[numero]
    assert {k: v for k, v in avec["14"]["inputs"].items() if k != "end_image"} == sans["14"]["inputs"]


def _comfy_qui_nomme(comfy: ComfyDouble):
    """Le double rend toujours « atelier-entree.png » ; celui-ci rend le nom
    sous lequel l'image a été déposée, comme le vrai ComfyUI."""
    def repondre(requete: httpx.Request) -> httpx.Response:
        reponse = comfy.repondre(requete)
        if requete.url.path == "/upload/image":
            nom = re.search(rb'filename="([^"]+)"', requete.content).group(1).decode()
            return httpx.Response(200, json={"name": nom})
        return reponse
    return repondre


async def test_le_moteur_maison_depose_la_fin_sous_son_propre_nom():
    comfy = ComfyDouble()
    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(_comfy_qui_nomme(comfy)))
    depart, fin = _sprite(), _sprite(couleur=(10, 200, 10, 255))
    await moteur.soumettre(modele_de_la_maison(), DemandeClip(texte="t", image=depart, secondes=1, image_de_fin=fin))
    envoye = comfy.montages[0]
    assert envoye["11"]["inputs"]["image"] == "atelier-entree.png"
    assert envoye["20"]["inputs"]["image"] == "atelier-fin.png"
    assert envoye["14"]["class_type"] == "WanFirstLastFrameToVideo"
    assert len(comfy.images_deposees) == 2


async def test_le_moteur_maison_boucle_sans_redeposer_le_depart():
    comfy = ComfyDouble()
    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(_comfy_qui_nomme(comfy)))
    depart = _sprite()
    await moteur.soumettre(modele_de_la_maison(), DemandeClip(texte="t", image=depart, secondes=1, image_de_fin=depart))
    envoye = comfy.montages[0]
    assert envoye["20"]["inputs"]["image"] == envoye["11"]["inputs"]["image"] == "atelier-entree.png"
    assert len(comfy.images_deposees) == 1


# ── La boucle sans image en double ───────────────────────────────────────────


def test_une_boucle_n_a_pas_l_image_en_double_a_sa_fin():
    # Sans boucle fermée : la première et la dernière image du clip en sont.
    assert images_de_la_bande(25, 8) == [0, 3, 7, 10, 14, 17, 21, 24]
    # Boucle fermée : l'image 24 *est* l'image 0 — elle n'est pas gardée, la
    # bande garde son compte, à pas égal sur un tour complet.
    boucle = images_de_la_bande(25, 8, boucle_fermee=True)
    assert boucle == [0, 3, 6, 9, 12, 15, 18, 21]
    assert 24 not in boucle and len(boucle) == 8
    # Un clip trop court pour le compte demandé garde tout sauf le doublon.
    assert images_de_la_bande(6, 8, boucle_fermee=True) == [0, 1, 2, 3, 4]
    assert images_de_la_bande(1, 8, boucle_fermee=True) == [0]


def test_demande_normalisee_image_de_fin():
    brute = {"cle": "c", "personnage": "p", "pose": "marche", "direction": "sud",
             "modele_video": "m", "prompt_video": "il marche"}
    assert demande_normalisee(brute)["image_de_fin"] is None
    assert demande_normalisee({**brute, "image_de_fin": "depart"})["image_de_fin"] == "depart"
    with pytest.raises(TravailRefuse, match="image_de_fin"):
        demande_normalisee({**brute, "image_de_fin": 3})
    with pytest.raises(TravailRefuse, match="image_de_fin"):
        demande_normalisee({**brute, "image_de_fin": "  "})


# ── Le chemin complet : fabrication, clip gardé, réouverture ─────────────────


@pytest.fixture
async def production(tmp_path, double):
    animateur = AnimateurDouble()
    animateur.modeles = [MELE, FINIT]

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
    autre = atelier.generations.importer(_sprite(60, (10, 200, 10, 255)), "fin", projet=projet)["asset"]
    demande = {"cle": "marche-1", "personnage": personnage.identifiant, "pose": "marche", "direction": "ouest",
               "reference_asset": asset["identifiant"],
               "modele_video": FINIT.identifiant, "prompt_video": "Walk in place, keep entire silhouette visible.",
               "cadence": 11, "nombre_images": 4}
    yield atelier, projet, demande, asset, autre, animateur
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()


async def _fin(atelier, projet, travail, acteur="auteur"):
    await atelier.travaux.demarrer(projet, travail["identifiant"], acteur)
    await atelier.travaux.attendre_tout()
    return atelier.travaux.lire(projet, travail["identifiant"])


async def test_la_preparation_refuse_un_modele_qui_ne_sait_pas_finir(production):
    atelier, projet, demande, asset, autre, animateur = production
    with pytest.raises(TravailRefuse, match="ne sait pas finir sur une image choisie"):
        await atelier.travaux.preparer(projet, {**demande, "modele_video": MELE.identifiant, "image_de_fin": "depart"})


async def test_une_boucle_envoie_l_image_de_depart_comme_fin(production):
    atelier, projet, demande, asset, autre, animateur = production
    travail = await atelier.travaux.preparer(projet, {**demande, "image_de_fin": "depart"})
    assert travail["fin_video"] == {"depart": True}
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini
    _, envoyee = animateur.soumissions[-1]
    assert envoyee.image_de_fin == envoyee.image
    clip = atelier.base.lire(fini["clip"])
    assert clip.demande["image_de_fin"] == "depart"
    assert clip.parametres_resolus["image_de_fin"] == "jointe"


@pytest.mark.skipif(decodeur.indisponible() is not None, reason="le décodeur vidéo n'est pas installé")
async def test_la_bande_d_une_boucle_laisse_tomber_l_image_en_double(production):
    atelier, projet, demande, asset, autre, animateur = production
    boucle = await _fin(atelier, projet, await atelier.travaux.preparer(projet, {**demande, "image_de_fin": "depart"}))
    libre = await _fin(atelier, projet, await atelier.travaux.preparer(projet, {**demande, "cle": "marche-2"}))
    total = atelier.base.lire(boucle["clip"]).clip.images
    images_boucle = atelier.montage.bande(boucle["bandes"][0]).images
    images_libre = atelier.montage.bande(libre["bandes"][0]).images
    assert list(images_libre)[-1] == total - 1
    assert total - 1 not in list(images_boucle)
    assert len(images_boucle) == len(images_libre) == 4


async def test_une_autre_image_est_composee_sur_la_meme_toile(production):
    atelier, projet, demande, asset, autre, animateur = production
    travail = await atelier.travaux.preparer(projet, {**demande, "image_de_fin": autre["identifiant"], "part_sujet": 0.60})
    canevas = taille_demandee(travail["demande"]["resolution"], travail["demande"]["proportions"])
    attendue = composer_entree(atelier.assets.reference(autre["identifiant"]), canevas, part=0.60)
    assert atelier.travaux.image_de_fin(projet, travail["identifiant"]) == attendue
    assert travail["fin_video"]["url"].endswith("/video-end")
    fini = await _fin(atelier, projet, travail)
    assert fini["etat"] == "termine", fini
    _, envoyee = animateur.soumissions[-1]
    assert envoyee.image_de_fin == attendue
    with Image.open(io.BytesIO(envoyee.image)) as a, Image.open(io.BytesIO(envoyee.image_de_fin)) as b:
        assert a.size == b.size


async def test_une_image_de_fin_d_un_autre_jeu_est_refusee(production):
    atelier, projet, demande, asset, autre, animateur = production
    with pytest.raises(TravailRefuse, match="image de fin"):
        await atelier.travaux.preparer(projet, {**demande, "image_de_fin": "n-existe-pas"})


async def test_un_clip_garde_avec_une_fin_se_rouvre_avec_elle(production, double):
    """AGENTS 8septies : garder avec un réglage qui n'est pas le défaut, fermer,
    rouvrir un atelier neuf — et relire le réglage sur le clip permanent."""
    atelier, projet, demande, asset, autre, animateur = production
    fini = await _fin(atelier, projet, await atelier.travaux.preparer(projet, {**demande, "image_de_fin": autre["identifiant"]}))
    neuf = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    neuf.travaux = ServiceTravaux(neuf)
    await neuf.ouvrir()
    assert neuf.base.lire(fini["clip"]).demande["image_de_fin"] == autre["identifiant"]
    assert neuf.travaux.lire(projet, fini["identifiant"])["demande"]["image_de_fin"] == autre["identifiant"]


async def test_un_clip_sans_fin_n_ecrit_pas_la_cle(production):
    atelier, projet, demande, asset, autre, animateur = production
    fini = await _fin(atelier, projet, await atelier.travaux.preparer(projet, demande))
    clip = atelier.base.lire(fini["clip"])
    assert "image_de_fin" not in clip.demande
    assert "image_de_fin" not in clip.parametres_resolus
    _, envoyee = animateur.soumissions[-1]
    assert envoyee.image_de_fin is None


async def test_l_agent_peut_demander_une_boucle(production):
    """L'agent passe par le même `preparer` que l'écran : la clé est acceptée."""
    atelier, projet, demande, asset, autre, animateur = production
    travail = await atelier.travaux.preparer(projet, {**demande, "image_de_fin": "depart"}, "agent")
    assert travail["demande"]["image_de_fin"] == "depart"


# ── Le moteur de la maison, par la file locale ───────────────────────────────


async def test_la_file_locale_porte_l_image_de_fin_jusqu_au_moteur_maison(tmp_path, double):
    """Le chemin du moteur de la maison passe par la file locale, qui garde les
    octets d'entrée figés : l'image de fin doit y voyager aussi, sinon le clip
    local partirait sans elle en silence."""
    if decodeur.indisponible() is not None:
        pytest.skip("le décodeur vidéo n'est pas installé")
    comfy = ComfyDouble()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: MoteurDeLaMaison(transport=httpx.MockTransport(_comfy_qui_nomme(comfy))))
    atelier.travaux = ServiceTravaux(atelier)
    await atelier.ouvrir()
    try:
        projet = atelier.bibliotheque.courant
        objet = atelier.base.lire_projet(projet)
        objet.univers.vue = "vue-dessus-34"
        atelier.bibliotheque.sauver_projet(objet)
        personnage = atelier.production.creer_personnage(projet, "Le pèlerin", "Un petit pèlerin", objectif={
            "sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}],
            "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64},
        })
        depart = atelier.generations.importer(_sprite(60), "départ", projet=projet)["asset"]
        fin = atelier.generations.importer(_sprite(60, (10, 200, 10, 255)), "fin", projet=projet)["asset"]
        travail = await atelier.travaux.preparer(projet, {
            "cle": "maison-fin", "personnage": personnage.identifiant, "pose": "marche", "direction": "ouest",
            "reference_asset": depart["identifiant"], "modele_video": modele_de_la_maison().identifiant,
            "prompt_video": "Walk in place.", "secondes": 1, "nombre_images": 4, "image_de_fin": fin["identifiant"]})
        await atelier.travaux.demarrer(projet, travail["identifiant"], "auteur")
        await atelier.travaux.attendre_tout()
        await atelier.animation.attendre_tout()
        assert comfy.montages, atelier.travaux.lire(projet, travail["identifiant"])
        envoye = comfy.montages[0]
        assert envoye["14"]["class_type"] == "WanFirstLastFrameToVideo"
        assert envoye["20"]["inputs"]["image"] == "atelier-fin.png"
        assert comfy.images_deposees[-1].count(atelier.travaux.image_de_fin(projet, travail["identifiant"])) == 1
    finally:
        for tache in atelier.travaux._taches.values():
            if not tache.done():
                tache.cancel()
        await atelier.travaux.attendre_tout()
        await atelier.animation.attendre_tout()
