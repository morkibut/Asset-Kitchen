# -*- coding: utf-8 -*-
"""A13 — l'image attrapée au vol : une image du clip entre en bibliothèque.

Les critères de `docs/PLAN.md` § A13 qui vivent côté serveur. Ce que l'écran
montre — le geste sur la loupe, la marque de ce qui est déjà pris, la phrase qui
dit où c'est parti — vit dans `interface/src/App.test.tsx`.

**Le clip d'essai est celui d'`A10`**, réemployé tel quel : on sait exactement ce
qu'il contient, image par image, et c'est la seule façon de vérifier qu'on a
prélevé *celle qu'on visait* et pas une voisine.

**Ce que la tranche instaure, et que ces essais tiennent.**

1. **Rien ici ne dépense, et la filiation dit que le clip, lui, a été payé.**
   L'image prélevée porte un modèle à elle — `clip` — qui n'est pas un
   identifiant de fournisseur, et une filiation qui nomme le clip, l'image et la
   génération qui l'a payée. Elle ne se relance pas ; ce dont elle sort a coûté.
2. **Elle passe par la chaîne du jeu**, contrairement à un fichier déposé à la
   main. Une image tirée d'un clip du jeu est une image *de ce jeu-là*, et sa
   recette se reprend après coup comme celle de n'importe quelle image.
3. **L'image brute est gardée.** Le traitement reste non destructif, invariant
   de `T2` — une image prélevée n'y fait aucune exception.
4. **Aucune case n'est visée au prélèvement.** On prélève « pour voir », et
   l'affecter est un second geste facultatif, par le chemin ordinaire.
"""

from __future__ import annotations

import pytest

from atelier.image import clip as decodeur
from atelier.services.generation import IMPORT, PRELEVEMENT

from test_a9 import (  # noqa: F401 — fixtures réemployées telles quelles
    MELE,
    AnimateurDouble,
    animateur,
    atelier_video,
    client_video,
    un_personnage,
    un_sprite,
)
from test_a10 import clip  # noqa: F401 — le clip connu, image par image


pytestmark = pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur vidéo n'est pas installé — il n'y a aucune image à prélever",
)


def _prelever(client, clip: str, numero: int, forcer: bool = False) -> dict:
    reponse = client.post(
        f"/api/clips/{clip}/frames/{numero}/pick",
        params={"forcer": forcer} if forcer else None,
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _generation(client, asset: str) -> dict:
    """La génération d'un asset — c'est elle qui porte la filiation."""
    return client.get(f"/api/generations/{asset.rsplit('-', 1)[0]}").json()


# ── « Un second geste met l'image de côté, sans toucher aux retenues » ───────


def test_une_image_du_clip_entre_en_bibliotheque(client_video, clip):
    """*Il ne manque qu'une destination.* L'écran a déjà tout : les images sont
    extraites depuis l'arrivée du clip, et prélever est un aller-retour."""
    avant = client_video.get("/api/assets").json()["assets"]

    rendu = _prelever(client_video, clip, 12)

    assert rendu["doublon"] is None
    assert rendu["asset"] is not None
    apres = client_video.get("/api/assets").json()["assets"]
    assert len(apres) == len(avant) + 1


def test_prelever_ne_touche_pas_aux_bandes_du_clip(client_video, clip):
    """**Sans toucher aux images retenues pour la bande.** Les deux gestes vivent
    sur le même écran et sur la même pellicule ; ils ne se marchent pas dessus."""
    bande = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "marche", "images": [10, 12, 14, 16]},
    ).json()

    _prelever(client_video, clip, 12)

    relue = client_video.get(f"/api/strips?clip={clip}").json()["bandes"]
    assert [b["identifiant"] for b in relue] == [bande["identifiant"]]
    assert relue[0]["images"] == [10, 12, 14, 16]


def test_prelever_plusieurs_images_daffilee(client_video, clip):
    """*Prélever plusieurs images d'affilée ne demande pas de recommencer le
    geste depuis le début* : chaque appel se suffit, et rien n'est à rouvrir."""
    pris = [_prelever(client_video, clip, numero)["asset"] for numero in (10, 12, 14)]

    assert len({a["identifiant"] for a in pris}) == 3


def test_une_image_deja_prise_se_signale_sans_refuser(client_video, clip):
    """**La forme d'un import**, et pour la raison exacte : un doublon n'est pas
    un refus. Le produit signale ce dont il est certain — les mêmes octets, deux
    fois — et rappeler en forçant fait entrer quand même."""
    premier = _prelever(client_video, clip, 12)["asset"]

    encore = _prelever(client_video, clip, 12)
    assert encore["asset"] is None
    assert encore["doublon"]["identifiant"] == premier["identifiant"]

    force = _prelever(client_video, clip, 12, forcer=True)
    assert force["asset"] is not None
    assert force["asset"]["identifiant"] != premier["identifiant"]


def test_une_image_qui_nexiste_pas_est_refusee_en_francais(client_video, clip):
    """Le clip d'essai porte vingt-deux images. La millième n'existe pas, et le
    dire vaut mieux qu'un asset vide."""
    reponse = client_video.post(f"/api/clips/{clip}/frames/1000/pick")

    assert reponse.status_code >= 400
    assert "image numéro 1000" in reponse.json()["raison"]


# ── « Elle entre avec sa filiation : de quel clip, quelle image » ────────────


def test_l_image_prelevee_porte_sa_filiation(client_video, clip):
    """⚠️ **C'est le seul endroit qui gardera d'où elle sort.** Elle est écrite
    dans la demande de sa génération, donc dans le `generation.json` du disque :
    elle survit à l'effacement de l'index, comme tout le reste de ce qu'on sait
    d'une entrée."""
    asset = _prelever(client_video, clip, 12)["asset"]

    generation = _generation(client_video, asset["identifiant"])
    filiation = generation["demande"]["filiation"]
    assert filiation["clip"] == clip
    assert filiation["image"] == 12
    assert filiation["generation"] == clip, "la génération qui l'a payée"
    assert filiation["mouvement"] == "marche"


def test_une_image_prelevee_ne_se_lit_pas_comme_un_import(client_video, clip):
    """**Un mot à elle**, et ce n'est pas de la coquetterie : une image importée
    est arrivée d'un disque, une image prélevée vient de quelque chose qui a été
    payé. Écrire *importée* sur la seconde ferait perdre ce que le produit sait
    d'elle."""
    asset = _prelever(client_video, clip, 12)["asset"]

    assert asset["modele"] == PRELEVEMENT
    assert asset["modele"] != IMPORT


def test_prelever_ne_depense_rien(client_video, clip):
    """*Rien ici ne dépense, et la filiation dit que le clip, lui, a été payé.*"""
    avant = client_video.get("/api/status").json()

    asset = _prelever(client_video, clip, 12)["asset"]

    apres = client_video.get("/api/status").json()
    assert apres["couts"]["total_usd"] == avant["couts"]["total_usd"]
    generation = _generation(client_video, asset["identifiant"])
    assert generation["cout_usd"] == 0
    # Et le clip, lui, a coûté — c'est ce que la filiation permet de retrouver.
    paye = client_video.get(f"/api/generations/{clip}").json()
    assert paye["cout_usd"] > 0


# ── « Elle passe par la chaîne du jeu, et l'image brute est gardée » ─────────


def test_l_image_prelevee_passe_par_la_chaine_du_jeu(client_video, clip):
    """Contrairement à un fichier déposé à la main, qui entre « telle quelle ».
    Une image tirée d'un clip du jeu est une image **de ce jeu-là** ; la rendre
    brute obligerait à la retraiter juste après, à la main."""
    asset = _prelever(client_video, clip, 12)["asset"]

    assert asset["traite"] is True
    assert asset["recette"]["grille"] is not None


def test_la_recette_dune_image_prelevee_se_reprend_apres_coup(client_video, clip):
    """**Le traitement reste non destructif**, invariant de `T2` — une image
    prélevée n'y fait aucune exception. On peut donc corriger un détourage six
    mois plus tard sans rien avoir gardé de plus."""
    asset = _prelever(client_video, clip, 12)["asset"]

    reponse = client_video.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={"recette": {**asset["recette"], "grille": None}},
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["grille"] is None

    # ⚠️ **L'image brute est toujours là** : c'est elle qui rend la reprise
    # possible, et la route qui la sert répond.
    brute = client_video.get(f"/api/assets/{asset['identifiant']}/image?brut=true")
    assert brute.status_code == 200
    assert len(brute.content) > 0


def test_l_echelle_du_personnage_du_clip_suit_l_image(client_video, clip):
    """Le clip a été commandé sur un personnage ; sa taille dans ce jeu est
    celle de son espèce. Sans elle, une image prélevée sur un nain reviendrait à
    la taille par défaut du projet — ce que personne n'a demandé."""
    montage = client_video.get(f"/api/montage/{clip}").json()
    asset = _prelever(client_video, clip, 12)["asset"]

    assert (
        asset["recette"]["grille"]["cible"]
        == montage["recette_du_jeu"]["grille"]["cible"]
    ), "la même taille que ce que le montage annonce pour ce clip"


# ── « Aucune case n'est visée au prélèvement » ───────────────────────────────


def test_prelever_ne_vise_aucune_case(client_video, clip):
    """*Jamais demandé au moment du prélèvement.* On prélève « pour voir » ;
    l'affecter à une pose ou à un objet est un second geste facultatif, et c'est
    le chemin ordinaire de n'importe quelle image."""
    asset = _prelever(client_video, clip, 12)["asset"]

    assert asset["personnage"] in (None, "")
    assert asset["pose"] in (None, "")


def test_une_image_prelevee_se_range_ensuite_comme_les_autres(client_video, clip):
    """Le second geste, et il n'a rien de particulier : c'est `designer`, celui
    qui range n'importe quelle image dans une case."""
    asset = _prelever(client_video, clip, 12)["asset"]
    personnage = client_video.get("/api/characters").json()["personnages"][0]

    reponse = client_video.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": personnage["identifiant"], "pose": "repos"},
    )
    assert reponse.status_code == 200, reponse.text

    case = next(
        c
        for c in client_video.get("/api/characters")
        .json()["personnages"][0]["cases"]
        if c["pose"] == "repos"
    )
    assert [i["identifiant"] for i in case["images"]] == [asset["identifiant"]]


# ── « Tout fonctionne réseau coupé » ────────────────────────────────────────


def test_prelever_marche_reseau_coupe(client_video, clip, animateur):
    """Les images sont sur le disque depuis l'arrivée du clip, et faire entrer
    une image n'appelle personne. Le double d'animateur est éteint : rien ne
    doit s'en apercevoir."""
    animateur.panne = "le réseau est coupé"

    asset = _prelever(client_video, clip, 12)["asset"]

    assert asset is not None
