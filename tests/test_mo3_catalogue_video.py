"""MO3 · La vidéo — un seul catalogue pour Wan, OpenRouter et les workflows importés.

`docs/PLAN-catalogue-des-moteurs.md` § MO3. Le relevé disait : « la vidéo a trois
sources assemblées à part ; un workflow vidéo importé ne peut jamais finir sur
une image choisie, même si son graphe le permet ». Ces essais tiennent :

- un workflow vidéo qui relie une image de fin le dit (`accepte_une_image_de_fin`),
  et celle-ci part vraiment — la boucle sans redéposer le départ, comme la maison ;
- sans image de fin, ce qui ne servait qu'à la charger quitte le graphe, et le
  clip finit libre : la capacité n'oblige à rien ;
- un profil sans cette liaison garde exactement le graphe d'avant ;
- la liste rend les trois sources dans la même forme — `source`, `capacites`
  (l'image de départ y est obligatoire, jamais une capacité qui cède), `cout`,
  `etat` —, et rien de tout ça ne dépend de la demande.

Aucun centime : ComfyUI et l'animateur payant sont doublés.
"""
from __future__ import annotations

from dataclasses import replace

import pytest

from atelier.domaine.animation import DemandeClip, ModeleVideo, Tarification
from atelier.domaine.workflow import IMAGE_DE_FIN, WorkflowRefuse, composer, normaliser
from atelier.fournisseur.maison import modele_de_la_maison
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import ComfyDouble, ajouter, atelier_workflow, profil  # noqa: F401 — la fixture s'importe
from tests.test_px5_image_de_fin import _sprite


def profil_qui_finit():
    """Le profil vidéo d'AU7, plus ce qu'un graphe « première et dernière image »
    ajoute : un `LoadImage` pour la fin, un redimensionnement qui ne sert qu'à
    elle, et l'entrée `end_image` du nœud qui la reçoit parmi d'autres."""
    p = profil("video")
    p["identifiant"], p["nom"] = "essai-video-fin", "Workflow vidéo qui finit"
    p["graphe"]["9"] = {"class_type": "LoadImage", "inputs": {"image": "fin.png"}}
    p["graphe"]["10"] = {"class_type": "ImageScale", "inputs": {"image": ["9", 0], "width": 64, "height": 64}}
    p["graphe"]["3"]["inputs"]["end_image"] = ["10", 0]
    p["liaisons"][IMAGE_DE_FIN] = [{"noeud": "9", "champ": "image"}]
    return p


# ── Le profil : ce qu'il accepte de déclarer ─────────────────────────────────


def test_un_workflow_video_relie_une_image_de_fin():
    normalise = normaliser(profil_qui_finit())
    assert normalise["liaisons"][IMAGE_DE_FIN] == [{"noeud": "9", "champ": "image"}]


def test_un_profil_sans_image_de_fin_garde_sa_forme():
    """Rien de neuf dans la forme normalisée d'un profil d'avant : sa version
    (l'empreinte de cette forme) ne bouge donc pas."""
    avant = normaliser(profil("video"))
    assert IMAGE_DE_FIN not in avant["liaisons"]
    assert set(avant) == {"identifiant", "nom", "nature", "graphe", "liaisons", "parametres", "formats", "durees",
                          "cadence", "pas_images", "sortie", "references_min", "references_max", "description"}


def test_seul_un_workflow_video_relie_une_image_de_fin():
    p = profil(references=1)
    p["graphe"]["9"] = {"class_type": "LoadImage", "inputs": {"image": "fin.png"}}
    p["liaisons"][IMAGE_DE_FIN] = [{"noeud": "9", "champ": "image"}]
    with pytest.raises(WorkflowRefuse, match="Seul un workflow vidéo"):
        normaliser(p)


def test_l_image_de_fin_se_charge_par_son_propre_noeud():
    p = profil("video")
    p["graphe"]["6"]["inputs"]["fin"] = "fin.png"
    p["liaisons"][IMAGE_DE_FIN] = [{"noeud": "6", "champ": "fin"}]  # le nœud du départ
    with pytest.raises(WorkflowRefuse, match="son propre nœud"):
        normaliser(p)


def test_un_graphe_qui_ne_tient_pas_sans_sa_fin_est_refuse():
    """Si la sortie ne dépendait que de l'image de fin, le clip libre n'aurait
    plus de sortie : refusé à l'import, jamais découvert à l'envoi."""
    p = profil("video")
    p["graphe"]["9"] = {"class_type": "LoadImage", "inputs": {"image": "fin.png"}}
    p["graphe"]["5"]["inputs"]["images"] = ["9", 0]
    p["liaisons"][IMAGE_DE_FIN] = [{"noeud": "9", "champ": "image"}]
    with pytest.raises(WorkflowRefuse, match="nœud de sortie"):
        normaliser(p)


# ── Le graphe qui part ───────────────────────────────────────────────────────


def _composer(p, **fin):
    return composer(p, prompt="Walk", references=["depart.png"], resolution="480p", proportions="1:1", secondes=5, **fin)


def test_avec_une_fin_le_graphe_la_charge():
    graphe = _composer(normaliser(profil_qui_finit()), image_de_fin="fin-deposee.png")
    assert graphe["9"]["inputs"]["image"] == "fin-deposee.png"
    assert graphe["3"]["inputs"]["end_image"] == ["10", 0]
    assert graphe["6"]["inputs"]["image"] == "depart.png"


def test_sans_fin_ce_qui_ne_servait_qu_a_elle_quitte_le_graphe():
    p = normaliser(profil_qui_finit())
    graphe = _composer(p)
    assert "9" not in graphe and "10" not in graphe
    assert "end_image" not in graphe["3"]["inputs"]
    # Le reste est intact, entrées reliées comprises.
    assert graphe["3"]["inputs"]["positive"] == ["1", 0] and graphe["3"]["inputs"]["reference0"] == ["6", 0]
    # Le graphe du profil, lui, n'a pas bougé.
    assert "9" in p["graphe"] and p["graphe"]["3"]["inputs"]["end_image"] == ["10", 0]


def test_un_profil_sans_liaison_de_fin_refuse_une_fin_et_garde_son_graphe():
    p = normaliser(profil("video"))
    with pytest.raises(WorkflowRefuse, match="ne sait pas finir sur une image choisie"):
        _composer(p, image_de_fin="fin.png")
    graphe = _composer(p)
    assert set(graphe) == set(p["graphe"])
    assert {c: set(n["inputs"]) for c, n in graphe.items()} == {c: set(n["inputs"]) for c, n in p["graphe"].items()}


# ── Le catalogue et l'envoi, de bout en bout (ComfyUI doublé) ────────────────


async def test_le_catalogue_dit_qui_sait_finir_et_la_fin_s_y_offre(atelier_workflow):
    atelier, comfy = atelier_workflow
    libre = await ajouter(atelier, comfy, profil("video"))
    finit = await ajouter(atelier, comfy, profil_qui_finit())
    # Comme `WanFirstLastFrameToVideo` chez ComfyUI : `end_image` est une entrée
    # facultative du nœud, que le profil sans fin n'a pas à fournir.
    requis = comfy.informations["Sampler"]["input"]
    requis.setdefault("optional", {})["end_image"] = requis["required"].pop("end_image")
    await atelier.animation.rafraichir()
    assert atelier.animation.modele(finit["modele"]).accepte_une_image_de_fin is True
    assert atelier.animation.modele(libre["modele"]).accepte_une_image_de_fin is False
    avec_fin = DemandeClip(texte="", image=b"\0", secondes=5, image_de_fin=b"\0")
    lignes = {l["identifiant"]: l for l in atelier.animation.catalogue(avec_fin)}
    assert lignes[finit["modele"]]["grise"] is None
    assert lignes[libre["modele"]]["grise"] == "ne sait pas finir sur une image choisie"
    assert lignes[finit["modele"]]["source"] == lignes[libre["modele"]]["source"] == "workflow"
    assert lignes[finit["modele"]]["capacites"] == {"image_de_depart": "obligatoire", "image_de_fin": True, "durees": [5]}
    assert lignes[finit["modele"]]["cout"]["unite"] == "temps"
    assert lignes[finit["modele"]]["etat"] == {"code": "pret", "raison": None}


def _demande(atelier, projet):
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin", "Marcheur", objectif={
        "sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}], "largeur": 64, "hauteur": 64,
        "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64}})
    reference = atelier.generations.importer(image_sujet(), "Référence", projet=projet)["asset"]["identifiant"]
    return {"personnage": personnage.identifiant, "pose": "marche", "direction": "ouest",
            "reference_asset": reference, "prompt_video": "Walk in place", "nombre_images": 4, "cadence": 11}


async def _fabriquer(atelier, projet, demande):
    travail = await atelier.travaux.preparer(projet, demande)
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    return fini


async def test_une_boucle_part_par_le_workflow_sans_redeposer_le_depart(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil_qui_finit())
    projet = atelier.bibliotheque.courant
    fini = await _fabriquer(atelier, projet, {**_demande(atelier, projet), "cle": "boucle",
                                              "modele_video": p["modele"], "image_de_fin": "depart"})
    assert len(comfy.envois) == 1
    graphe = comfy.envois[0]["prompt"]
    assert graphe["9"]["inputs"]["image"] == graphe["6"]["inputs"]["image"]
    assert graphe["3"]["inputs"]["end_image"] == ["10", 0]
    assert len(comfy.fichiers) == 1  # le départ, déposé une fois
    clip = atelier.base.lire(fini["clip"])
    assert clip.demande["image_de_fin"] == "depart"
    assert clip.parametres_resolus["image_de_fin"] == "jointe"


async def test_une_autre_image_de_fin_part_deposee_a_part(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil_qui_finit())
    projet = atelier.bibliotheque.courant
    demande = _demande(atelier, projet)
    fin = atelier.generations.importer(_sprite(60, (10, 200, 10, 255)), "Fin", projet=projet)["asset"]["identifiant"]
    await _fabriquer(atelier, projet, {**demande, "cle": "fin-choisie", "modele_video": p["modele"], "image_de_fin": fin})
    assert len(comfy.envois) == 1
    assert "9" in comfy.envois[0]["prompt"]
    assert len(comfy.fichiers) == 2  # le départ, puis la fin


async def test_sans_fin_le_meme_workflow_finit_libre(atelier_workflow):
    atelier, comfy = atelier_workflow
    p = await ajouter(atelier, comfy, profil_qui_finit())
    # Comme `WanFirstLastFrameToVideo` chez ComfyUI : `end_image` est
    # facultative. Depuis MO6, le diagnostic le lit (`fin_libre`) — tenue pour
    # obligatoire, le clip sans fin se griserait (`test_mo6_workflows_importes`).
    requis = comfy.informations["Sampler"]["input"]
    requis.setdefault("optional", {})["end_image"] = requis["required"].pop("end_image")
    await atelier.animation.rafraichir()
    projet = atelier.bibliotheque.courant
    fini = await _fabriquer(atelier, projet, {**_demande(atelier, projet), "cle": "libre", "modele_video": p["modele"]})
    graphe = comfy.envois[0]["prompt"]
    assert "9" not in graphe and "10" not in graphe and "end_image" not in graphe["3"]["inputs"]
    assert len(comfy.fichiers) == 1
    assert "image_de_fin" not in atelier.base.lire(fini["clip"]).demande


# ── La forme commune, par la route ───────────────────────────────────────────


PAYANT = ModeleVideo(identifiant="OpenRouter:essai/clip", nom="Clip d'essai", fournisseur="OpenRouter",
                     chez_lui="essai/clip", durees=(5,), resolutions=("480p",), proportions=("1:1",),
                     accepte_une_image_de_fin=True,
                     tarification=Tarification("seconde", 0.05, "video_seconds_480p"))


def test_la_route_rend_les_trois_sources_dans_la_meme_forme(tmp_path, double):
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application

    animateur = AnimateurDouble()
    animateur.modeles = [PAYANT, replace(modele_de_la_maison(), identifiant="Maison:essai", fournisseur="Maison")]
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    with TestClient(creer_application(atelier)) as client:
        rendu = client.get("/api/clips/models?secondes=1").json()
    lignes = {m["identifiant"]: m for m in rendu["modeles"]}
    # L'ordre : ce qui tourne ici d'abord (V3.01.2), inchangé.
    assert rendu["modeles"][0]["identifiant"] == "Maison:essai"
    maison, payant = lignes["Maison:essai"], lignes[PAYANT.identifiant]
    for ligne in (maison, payant):
        assert {"source", "capacites", "cout", "etat", "prix", "grise", "attente"} <= set(ligne)
        assert ligne["capacites"]["image_de_depart"] == "obligatoire"
    # L'animateur doublé ne dit pas sa source : elle se déduit du tarif.
    assert maison["source"] == "maison" and payant["source"] == "en_ligne"
    assert maison["cout"]["unite"] == "temps" and payant["cout"] == {"unite": "usd", "libelle": "video_seconds_480p"}
    assert payant["capacites"] == {"image_de_depart": "obligatoire", "image_de_fin": True, "durees": [5]}
    # L'état ne dépend pas de la demande : une durée refusée grise, sans rendre
    # le moteur « indisponible ».
    assert payant["grise"] and payant["etat"]["code"] == "pret"


def test_un_moteur_en_ligne_sans_sa_cle_le_dit_sans_griser_la_maison(tmp_path, double):
    from atelier.services.animation import _etat_du_moteur

    class SansCle:
        nom, source = "OpenRouter", "en_ligne"

        def indisponible(self):
            return "aucune clé OpenRouter"

    assert _etat_du_moteur(PAYANT, SansCle(), "en_ligne") == {"code": "cle_manquante", "raison": "aucune clé OpenRouter"}
    assert _etat_du_moteur(replace(PAYANT, tarification=None), object(), "en_ligne")["code"] == "indisponible"
