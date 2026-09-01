# -*- coding: utf-8 -*-
"""Les critères de U5 qui se mesurent — ce qui voyage, et ce qui reste.

**Une phrase tient toute l'étape** : *un réglage voyage, une coordonnée ne
voyage pas.* Une tolérance de 28 dit la même chose sur n'importe quelle image ;
un rectangle tracé à (12, 40) ne dit quelque chose que sur celle-là. Six
attitudes d'un même personnage n'ont pas la même silhouette, et un passage de
main recopié tomberait sur le bras au lieu du casque.

La règle a **trois portes** — coller d'une image à l'autre, enregistrer une
recette nommée, rappeler une recette nommée écrite avant que la règle existe —
et une seule écriture, dans le domaine. Ce fichier vérifie les trois, plus le
critère qui ne bouge pas depuis T2 : *deux images traitées par la même recette
nommée sortent identiques au pixel près.*

Ce qui se voit — les gestes de la barre, le nom déjà pris qui propose de
remplacer, l'annonce du collage — vit dans `interface/src/App.test.tsx`. Aucun
essai d'ici n'appelle le fournisseur.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from atelier.domaine.recette import (
    Grille,
    Main,
    Passe,
    Recadrage,
    Recette,
    Trait,
    voyage,
)
from tests.conftest import image_sujet


# ── De quoi poser une recette et regarder ce qui en est revenu ───────────────


def _asset(client, double) -> str:
    double.rendre = lambda: image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    return f"{generation['identifiant']}-0"


PASSE_COULEUR = {
    "moteur": "couleur",
    "tolerance": 30,
    "seuil_alpha": 128,
    "durcissement": 0,
    "point": [2, 2],
    "portee": "tache",
}


def _recette(**places) -> dict:
    corps = {
        "passes": [],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "contours": None,
        "main": None,
        "veille": [],
        "nom": None,
    }
    corps.update(places)
    return corps


def _poser(client, identifiant: str, **places) -> dict:
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=_recette(**places))
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _pixels(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/image")
    assert reponse.status_code == 200, reponse.text
    return np.asarray(Image.open(io.BytesIO(reponse.content)).convert("RGBA"))


# **Une recette qui porte les cinq coordonnées à la fois**, plus des réglages
# ordinaires à côté d'elles. Écrite en objets du domaine et non en JSON : c'est
# ce que `voyage` reçoit, et l'écrire deux fois aurait fait diverger l'essai du
# domaine au premier champ ajouté.
def _tout_ce_qui_ne_voyage_pas() -> Recette:
    return Recette(
        passes=(
            Passe(moteur="bord", tolerance=28),
            Passe(moteur="couleur", tolerance=30, point=(2, 2)),
        ),
        recadrage=Recadrage(marge=6, boite=(4, 4, 20, 20)),
        grille=Grille(cible=32, occupation=90, decalage=3),
        main=Main(opacite=(Trait(points=((1, 1), (2, 2)), rayon=1, garde=False),)),
    )


# ── « Rien de ce qui désigne un endroit de cette image-là ne voyage » ────────


def test_le_voyage_retire_les_cinq_coordonnees_et_les_nomme():
    """**La règle, écrite une fois et vérifiée une fois.** Les trois portes de
    l'étape appellent cette fonction-là : la vérifier ici, c'est la vérifier
    pour le collage, pour l'enregistrement et pour le rappel."""
    partie, laisse = voyage(_tout_ce_qui_ne_voyage_pas())

    # Ce qui est retiré.
    assert [p.point for p in partie.passes] == [None, None]
    assert partie.recadrage is not None and partie.recadrage.boite is None
    assert partie.grille is not None and partie.grille.decalage == 0
    assert partie.main is None
    assert partie.difference is None

    # Ce qui reste, reste entier : on retire la coordonnée, pas la place.
    assert [p.tolerance for p in partie.passes] == [28, 30]
    assert partie.recadrage.marge == 6
    assert (partie.grille.cible, partie.grille.occupation) == (32, 90)

    # Et chacun des quatre est nommé en clair, pas compté.
    ensemble = " · ".join(laisse)
    assert "cadre tracé" in ensemble
    assert "pipette" in ensemble
    assert "décalage" in ensemble
    assert "passage" in ensemble


def test_une_recette_sans_coordonnee_voyage_entiere_et_sans_un_mot():
    """Le cas courant, et il ne doit rien annoncer : une phrase qui paraîtrait à
    chaque collage cesserait d'être lue le troisième jour."""
    ordinaire = Recette(
        passes=(Passe(moteur="bord", tolerance=28),),
        recadrage=Recadrage(marge=6),
        grille=Grille(cible=32),
        veille=("grille",),
    )
    partie, laisse = voyage(ordinaire)

    assert laisse == ()
    assert partie == ordinaire


def test_un_calque_nomme_mais_vide_ne_voyage_pas_non_plus():
    """Sans ses passages, un calque n'est qu'un titre — et un titre qui arrive
    avec une recette est une pile qu'on n'a pas demandée. Rien n'est annoncé :
    il n'y avait rien à perdre."""
    partie, laisse = voyage(Recette(main=Main()))
    assert partie.main is None
    assert laisse == ()


# ── « Copier puis coller donnent la même recette, veille comprise » ──────────


def test_coller_pose_les_reglages_et_garde_la_veille(client, double):
    """La veille fait partie de ce qui voyage — c'est le blocage de U4 sur U5 :
    un collage qui rallumerait les places éteintes changerait l'image d'une
    façon que personne n'a demandée."""
    source = _asset(client, double)
    cible = _asset(client, double)
    _poser(
        client,
        source,
        passes=[{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        grille={"cible": 32, "occupation": 100, "ancrage": "bas"},
        veille=["grille"],
    )
    copiee = client.get(f"/api/assets/{source}").json()["recette"]

    reponse = client.post(f"/api/assets/{cible}/paste", json=copiee)
    assert reponse.status_code == 200, reponse.text
    posee = reponse.json()["asset"]["recette"]

    assert posee["passes"][0]["tolerance"] == 28
    assert posee["grille"]["cible"] == 32
    assert posee["veille"] == ["grille"]
    assert reponse.json()["laisse"] == []


def test_un_collage_dit_ce_qu_il_n_a_pas_pu_poser(client, double):
    """« Une place privée de ce qui la désignait arrive sans effet et le dit. »
    Le cadre tracé tombe, la marge reste : la place arrive donc, et c'est elle
    qui n'a plus d'effet — pas la recette."""
    source = _asset(client, double)
    cible = _asset(client, double)
    _poser(
        client,
        source,
        passes=[{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        recadrage={"marge": 0, "boite": [4, 4, 20, 20]},
    )
    copiee = client.get(f"/api/assets/{source}").json()["recette"]

    reponse = client.post(f"/api/assets/{cible}/paste", json=copiee)
    laisse = reponse.json()["laisse"]
    posee = reponse.json()["asset"]["recette"]

    assert len(laisse) == 1 and "cadre tracé" in laisse[0]
    assert posee["recadrage"]["boite"] is None
    assert posee["recadrage"]["marge"] == 0


def test_coller_ne_touche_pas_a_la_difference_de_l_image_d_arrivee(client, double):
    """Elle nomme le corps sous *ce* calque-ci : un collage qui l'emporterait
    rendrait le calque à sa case, et un collage qui la vue partir la perdrait."""
    source = _asset(client, double)
    cible = _asset(client, double)
    _poser(client, source, passes=[{"moteur": "bord", "tolerance": 28}])
    copiee = client.get(f"/api/assets/{source}").json()["recette"]

    avant = client.get(f"/api/assets/{cible}").json()["recette"]["difference"]
    reponse = client.post(f"/api/assets/{cible}/paste", json=copiee)
    assert reponse.json()["asset"]["recette"]["difference"] == avant


# ── « On enregistre, on rappelle, et deux images sortent identiques » ────────


def test_enregistrer_une_recette_dit_ce_qu_elle_n_emporte_pas(client, double):
    """Au moment où l'on nomme, pas au moment où l'on s'étonne."""
    identifiant = _asset(client, double)
    _poser(
        client,
        identifiant,
        passes=[PASSE_COULEUR],
        recadrage={"marge": 4, "boite": [4, 4, 20, 20]},
    )
    courante = client.get(f"/api/assets/{identifiant}").json()["recette"]

    reponse = client.put("/api/recipes/mon détourage", json=courante)
    assert reponse.status_code == 200, reponse.text
    laisse = reponse.json()["laisse"]
    assert any("pipette" in phrase for phrase in laisse)
    assert any("cadre tracé" in phrase for phrase in laisse)

    # Et le disque garde la recette amputée, pas la recette entière.
    gardee = reponse.json()["recettes"]["mon détourage"]
    assert gardee["passes"][0]["point"] is None
    assert gardee["recadrage"]["boite"] is None
    assert gardee["recadrage"]["marge"] == 4


def test_deux_images_par_la_meme_recette_nommee_sortent_identiques(client, double):
    """Le critère du produit, et il ne bouge pas depuis T2. Vrai par
    construction : l'empreinte ne dépend que des réglages, le nom n'y entre
    pas, et chaque étape est déterministe."""
    premiere = _asset(client, double)
    seconde = _asset(client, double)
    _poser(
        client,
        premiere,
        passes=[{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        grille={"cible": 32, "occupation": 100, "ancrage": "bas"},
    )
    courante = client.get(f"/api/assets/{premiere}").json()["recette"]
    client.put("/api/recipes/sprite 32", json=courante)

    for cible in (premiere, seconde):
        reponse = client.post(f"/api/assets/{cible}/apply/sprite 32")
        assert reponse.status_code == 200, reponse.text

    assert np.array_equal(_pixels(client, premiere), _pixels(client, seconde))


def test_une_recette_ecrite_avant_la_regle_se_rappelle_sans_lever(client, double):
    """**Le cas qui demande que le voyage soit refait au rappel.** Le disque
    porte des recettes écrites avant que la règle existe : celles-là emportent
    encore des passages de main et des cadres tracés. Le critère demande
    qu'elles se rappellent sans lever, et que ce qu'elles perdent soit annoncé
    plutôt que posé.

    On l'écrit **directement sur le disque**, en passant par-dessus la route :
    c'est la seule façon de fabriquer l'état que le rappel doit savoir lire,
    puisque la route, elle, ne l'écrit plus.
    """
    identifiant = _asset(client, double)
    fichiers = client.app.state.atelier.assets._fichiers
    ancienne = fichiers.lire_recettes()
    ancienne["d'avant"] = _tout_ce_qui_ne_voyage_pas().en_json()
    fichiers.ecrire_recettes(ancienne)

    reponse = client.post(f"/api/assets/{identifiant}/apply/d'avant")
    assert reponse.status_code == 200, reponse.text
    laisse = reponse.json()["laisse"]
    posee = reponse.json()["asset"]["recette"]

    assert any("passage" in phrase for phrase in laisse)
    assert any("cadre tracé" in phrase for phrase in laisse)
    assert posee["main"] is None
    assert posee["recadrage"]["boite"] is None
    assert posee["passes"][1]["point"] is None
    # Les réglages, eux, sont bien arrivés.
    assert posee["recadrage"]["marge"] == 6
    assert posee["grille"]["cible"] == 32


def test_une_recette_nommee_survit_a_la_fermeture_de_l_atelier(client, double):
    """Elle est écrite sur le disque, pas tenue en mémoire — et elle appartient
    à l'atelier, pas à un jeu."""
    identifiant = _asset(client, double)
    _poser(client, identifiant, grille={"cible": 32, "occupation": 100, "ancrage": "bas"})
    courante = client.get(f"/api/assets/{identifiant}").json()["recette"]
    client.put("/api/recipes/à travers les jeux", json=courante)

    fichiers = client.app.state.atelier.assets._fichiers
    assert "à travers les jeux" in fichiers.lire_recettes()

    # Et elle s'oublie, sans toucher aux autres.
    reponse = client.delete("/api/recipes/à travers les jeux")
    assert reponse.status_code == 200, reponse.text
    assert "à travers les jeux" not in reponse.json()["recettes"]
