# -*- coding: utf-8 -*-
"""TU13 : une image de référence pour une matière de jeu de tuiles.

`docs/PLAN-tuiles.md`, § TU13. Le montage d'essai est celui de TU5, réemployé
tel quel (`tests/test_tu5_matieres.py`) : ComfyUI doublé, fournisseur payant
qui lève s'il est atteint. Ce qui s'y ajoute tient en une phrase — **joindre
une image ne doit rien casser de ce que TU5 garantissait**, et en particulier
pas le raccord sans couture.
"""

from __future__ import annotations

import pytest

from atelier.domaine.tuiles import TuilesRefusees

from tests.test_tu5_matieres import atelier_matieres  # noqa: F401 — fixture réemployée


async def _une_matiere(atelier, projet: str) -> str:
    """Un tirage sans référence, dont l'asset servira de référence ensuite.

    Passer par le vrai chemin plutôt que par un asset fabriqué à la main :
    l'image jointe d'un auteur sera le plus souvent une matière déjà tirée.
    """
    [generation] = await atelier.matieres.generer(
        projet, pierre="pierre grise", motif="quatre dalles, deux par deux", cadrage="surface", tirages=1,
    )
    await atelier.generations.attendre_tout()
    asset = f"{generation.identifiant}-0"
    assert atelier.assets.lire(asset) is not None
    return asset


def _noeuds(graphe, classe):
    return [n for n in graphe.values() if n["class_type"] == classe]


async def test_une_reference_part_en_512_et_garde_le_raccord(atelier_matieres):
    """Le critère central de la tranche : avec une image jointe, le graphe est
    celui de la variante à une référence **et** les deux nœuds du raccord y
    sont toujours. Sans eux, la matière ne se découperait plus en pièces."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    reference = await _une_matiere(atelier, projet)
    comfy.envois.clear()

    [generation] = await atelier.matieres.generer(
        projet, pierre="pierre grise", motif="quatre dalles, deux par deux", cadrage="surface",
        tirages=1, reference=reference,
    )
    await atelier.generations.attendre_tout()

    assert len(comfy.envois) == 1
    graphe = comfy.envois[0]["prompt"]
    # La variante à une référence : l'image est chargée, encodée, et posée en
    # `ReferenceLatent` sur le positif ET le négatif (gabarit officiel FLUX.2).
    assert len(_noeuds(graphe, "LoadImage")) == 1
    assert len(_noeuds(graphe, "ReferenceLatent")) == 2
    # Le raccord, intact.
    assert _noeuds(graphe, "SeamlessTile") and _noeuds(graphe, "CircularVAEDecode")
    # 512 px avec une référence, là où TU5 part en 256.
    latent = next(n for n in graphe.values() if n["class_type"] == "EmptyFlux2LatentImage")
    assert latent["inputs"]["width"] == 512 and latent["inputs"]["height"] == 512

    relue = atelier.generations.lire(generation.identifiant)
    assert relue.emplacements[0].statut.name == "REUSSIE", relue.emplacements[0].raison
    assert relue.demande["resolution"] == "512"
    # La provenance dit quelle image a servi.
    assert relue.demande["filiation"]["matiere"]["reference"] == reference


async def test_le_texte_envoye_ne_change_pas_avec_une_reference(atelier_matieres):
    """Une image jointe n'ajoute pas un mot au texte : c'est ce qui permet à
    « Voir le texte envoyé » de rester vrai. Elle change la taille annoncée,
    et l'aperçu le dit."""
    atelier, comfy = atelier_matieres
    sans = atelier.matieres.apercu("pierre grise", "quatre dalles", "surface")
    avec = atelier.matieres.apercu("pierre grise", "quatre dalles", "surface", reference=True)
    assert avec["texte"] == sans["texte"]
    assert (sans["taille"], avec["taille"]) == (256, 512)
    assert sans["reference"] is False and avec["reference"] is True
    assert comfy.envois == []


async def test_sans_reference_rien_ne_bouge(atelier_matieres):
    """La garde de non-régression de TU5 : le chemin sans image reste celui
    d'avant, au nœud près."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    await atelier.matieres.generer(projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=1)
    await atelier.generations.attendre_tout()
    graphe = comfy.envois[0]["prompt"]
    assert _noeuds(graphe, "LoadImage") == [] and _noeuds(graphe, "ReferenceLatent") == []
    latent = next(n for n in graphe.values() if n["class_type"] == "EmptyFlux2LatentImage")
    assert latent["inputs"]["width"] == 256


async def test_la_reprise_rejoue_l_image_jointe(atelier_matieres):
    """L'image n'est pas recopiée dans l'enregistrement : elle est relue depuis
    l'asset, à l'appel **comme à la reprise**. Une génération interrompue ne
    redemande donc jamais l'image à l'auteur."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    reference = await _une_matiere(atelier, projet)
    [generation] = await atelier.matieres.generer(
        projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=1, reference=reference,
    )
    await atelier.generations.attendre_tout()

    relue = atelier.generations.lire(generation.identifiant)
    # Des identifiants dans l'enregistrement, jamais des octets.
    assert [r.asset for r in relue.references] == [reference]
    # Et des octets au moment de repartir, relus depuis l'asset.
    demande = atelier.generations.demande_preparee(relue)
    assert len(demande.references) == 1 and isinstance(demande.references[0], bytes)
    assert demande.references[0]


async def test_un_style_qui_ne_sait_pas_porter_une_reference_refuse_en_clair(atelier_matieres, monkeypatch):
    """Jamais une supposition : c'est le profil réellement construit qui dit
    s'il a la variante à une référence. Sans elle, on refuse **avant** tout
    envoi, en disant quoi faire."""
    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    reference = await _une_matiere(atelier, projet)
    comfy.envois.clear()
    monkeypatch.setattr(atelier.matieres, "_accepte_une_reference", lambda modele, ligne=None: False)
    with pytest.raises(TuilesRefusees, match="ne sait pas porter"):
        await atelier.matieres.generer(
            projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=1, reference=reference,
        )
    assert comfy.envois == []


async def test_la_disponibilite_dit_si_une_reference_est_possible(atelier_matieres):
    atelier, _ = atelier_matieres
    dispo = await atelier.matieres.disponibilite()
    assert dispo["disponible"]
    assert dispo["reference_possible"] is True


async def test_l_agent_joint_la_meme_image_que_l_ecran(atelier_matieres):
    """Parité écran / agent (TU10) : le même tirage, par le travail durable
    borné par le cadre de l'agent."""
    from atelier.domaine.generation import AGENT

    atelier, comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    reference = await _une_matiere(atelier, projet)
    comfy.envois.clear()

    # Le cadre que l'auteur donne à l'agent : calcul local permis, aucun modèle exclu.
    atelier.travaux.regler_cadre(projet, {"plafond_appels": 10, "modeles_image": []})
    travail = await atelier.matieres.preparer_pour_agent(
        projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=1, reference=reference,
    )
    assert travail["demande"]["reference"] == reference
    await atelier.travaux.demarrer(projet, travail["identifiant"], AGENT)
    await atelier.travaux.attendre_tout()
    await atelier.generations.attendre_tout()

    relu = atelier.travaux.lire(projet, travail["identifiant"])
    assert relu.get("raison", "") == "" and relu["etat"] in ("termine", "a_verifier"), relu
    assert len(comfy.envois) == 1
    graphe = comfy.envois[0]["prompt"]
    assert len(_noeuds(graphe, "LoadImage")) == 1
    assert _noeuds(graphe, "SeamlessTile") and _noeuds(graphe, "CircularVAEDecode")
    latent = next(n for n in graphe.values() if n["class_type"] == "EmptyFlux2LatentImage")
    assert latent["inputs"]["width"] == 512


async def test_la_route_generer_accepte_l_identifiant_d_une_image(atelier_matieres):
    """La route passe l'identifiant, jamais des octets — `extra=forbid` refuse
    tout le reste."""
    from atelier.api.matieres import Generer

    corps = Generer(pierre="p", motif="m", cadrage="surface", tirages=2, reference_asset="img-1")
    assert corps.reference_asset == "img-1"
    with pytest.raises(Exception):
        Generer(pierre="p", motif="m", cadrage="surface", reference=True)
