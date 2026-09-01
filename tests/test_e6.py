# -*- coding: utf-8 -*-
"""Les critères de E6 — la superposition, seconde fabrique.

**Ce qui se mesure ici** : que la fabrique écrit des fichiers et ne pose rien
sur la recette de l'image courante, que le calque est fait des pixels du dessus,
que le dessus sans alpha emporte le fond — le fait que l'alerte nomme —, et
qu'un recalage raté se rejoue sans repayer. Ce que l'écran montre — les trois
vues, les rails, les touches — vit dans `interface/src/App.test.tsx`.

**Aucun test de ce fichier ne coûte un centime.** Les deux images sont
construites à la main ou produites par le double, et la superposition ne connaît
pas le fournisseur : ça se lit dans les imports de
`atelier/services/superposition.py`.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.superposition import ReglagesGardes, Superposition
from atelier.image.calque import aligner, proposer, superposer
from tests.conftest import FOND, image_sujet


# ── Le calcul, sur des tableaux construits à la main ─────────────────────────


def _corps(cote: int = 32) -> np.ndarray:
    """Un corps détouré : un bloc opaque au milieu, du vide autour."""
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[10:26, 10:22, :3] = (180, 60, 50)
    rgba[10:26, 10:22, 3] = 255
    return rgba


def _habille(corps: np.ndarray) -> np.ndarray:
    """Le même, plus un casque qui dépasse au-dessus de la tête."""
    dessus = corps.copy()
    dessus[6:11, 9:23, :3] = (40, 40, 55)
    dessus[6:11, 9:23, 3] = 255
    return dessus


def test_le_calque_est_fait_des_pixels_du_dessus():
    """**Jamais d'un souvenir du dessous** : c'est la pièce qu'on empile.

    Rendre les pixels du corps là où la pièce est tombée donnerait un calque qui
    remet le crâne par-dessus le casque — l'inverse exact de ce qu'on empile.
    """
    corps = _corps()
    calque, _ = superposer(corps, _habille(corps), Superposition())

    # Le casque est là, avec sa couleur à lui.
    assert tuple(calque[8, 15, :3]) == (40, 40, 55)
    assert calque[8, 15, 3] == 255
    # Et rien du corps qui n'a pas changé.
    assert calque[20, 15, 3] == 0


def test_l_aplat_est_les_deux_fondues_dans_l_ordre_de_la_pile():
    """« Le personnage habillé, en une seule image, prêt à partir tel quel. »"""
    corps = _corps()
    _, aplat = superposer(corps, _habille(corps), Superposition())

    assert tuple(aplat[8, 15, :3]) == (40, 40, 55)  # le casque
    assert tuple(aplat[20, 15, :3]) == (180, 60, 50)  # le corps, dessous


def test_intervertir_change_le_resultat():
    """Le calque est fait de ce que le **dessus** ajoute.

    Poser un corps nu sur un corps casqué donnerait le crâne nu au lieu du
    casque — d'où le bouton, et d'où le fait qu'il ne soit pas un détail
    d'affichage.
    """
    corps = _corps()
    habille = _habille(corps)

    endroit, _ = superposer(corps, habille, Superposition())
    envers, _ = superposer(habille, corps, Superposition())

    # À l'endroit, le calque est le casque ; à l'envers, le dessus n'ajoute rien
    # là où le dessous le porte déjà. C'est bien un geste, pas un détail
    # d'affichage.
    assert endroit[8, 15, 3] == 255
    assert envers[8, 15, 3] == 0
    assert int((envers[:, :, 3] > 0).sum()) < int((endroit[:, :, 3] > 0).sum())


def test_un_dessus_sans_alpha_emporte_tout_le_fond():
    """**Le fait que l'alerte nomme, et la panne que la V2.1 corrige.**

    Un pixel entre dans le calque s'il est opaque dans le dessus et transparent
    dans le dessous. Un dessus qui revient du modèle est opaque de bord à bord :
    tout ce qui entoure le corps remplit donc la condition, et part avec la
    pièce.
    """
    corps = _corps()
    opaque = _habille(corps)
    opaque[:, :, :3] = np.where(opaque[:, :, 3:] > 0, opaque[:, :, :3], FOND)
    opaque[:, :, 3] = 255  # ce que le modèle rend : aucun alpha

    calque, _ = superposer(corps, opaque, Superposition())

    # Le coin de l'image, qui n'est ni corps ni pièce, est parti dans le calque.
    assert calque[0, 0, 3] == 255


def test_le_rectangle_masque_a_la_sortie_comme_a_l_ecran():
    """**Il sert deux fois, et c'est ce qui en fait une seule notion.**

    Il isole la pièce pour qu'on voie le corps dessous pendant qu'on cale, et ce
    qu'il masque à l'écran, il le masque aussi à la sortie.
    """
    corps = _corps()
    hors = Superposition(rectangle=(0, 0, 5, 5))
    calque, _ = superposer(corps, _habille(corps), hors)

    assert int((calque[:, :, 3] > 0).sum()) == 0  # le casque est hors du cadre


def test_le_calage_deplace_le_dessus_dans_le_cadre_du_dessous():
    """Le cadre du dessous fait loi : ce qui déborde est perdu, ce qui manque
    est transparent — le contrat d'une case de planche."""
    corps = _corps()
    pose = aligner(_habille(corps), corps, Superposition(dy=4))

    assert pose.shape == corps.shape
    assert pose[12, 15, 3] == 255  # le casque est descendu de quatre


def test_recaler_retrouve_un_decalage_pose_a_la_main():
    """**Un bouton, pas un mode** : il propose trois valeurs et s'arrête là.

    Ce que le test vérifie est qu'il retrouve un décalage franc — pas qu'il soit
    infaillible. Quand il tombe à côté, on corrige à la main, et c'est très
    exactement ce qui n'existait pas avant.
    """
    corps = _corps(cote=64)
    decale = aligner(corps, corps, Superposition(dx=5, dy=-3))

    echelle, dy, dx, _ = proposer(corps, decale)
    assert echelle == pytest.approx(1.0, abs=0.02)
    assert (dx, dy) == (-5, 3)  # ce qu'il faut appliquer pour revenir


# ── Ce que la fabrique écrit ─────────────────────────────────────────────────


def _deux_images(client, double) -> tuple[str, str]:
    """Un corps et le même avec quelque chose en plus, tous deux en bibliothèque."""
    rendus = [image_sujet(logique_l=8, logique_h=16), image_sujet(logique_l=12, logique_h=18)]
    identifiants = []
    for octets in rendus:
        double.rendre = lambda o=octets: o
        generation = client.post(
            "/api/generations",
            json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
        ).json()
        identifiants.append(f"{generation['identifiant']}-0")
    return identifiants[0], identifiants[1]


def _recette(client, identifiant: str, passes: list) -> None:
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": passes,
            "recadrage": None,
            "grille": None,
            "quantification": None,
            "bords": None,
            "contours": None,
            "main": None,
            "nom": None,
        },
    )
    assert reponse.status_code == 200, reponse.text


UNE_PASSE = [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}]


def _detourer(client, identifiant: str) -> None:
    _recette(client, identifiant, UNE_PASSE)


def _sans_detourage(client, identifiant: str) -> None:
    """**Une image qui revient du modèle n'a pas d'alpha**, et c'est le cas que
    l'alerte nomme. Une image née dans l'atelier, elle, arrive déjà détourée par
    la recette du projet — il faut donc le lui retirer pour rejouer le cas."""
    _recette(client, identifiant, [])


def _pose(dessus: str, dessous: str, **reste) -> dict:
    return {"dessus": dessus, "dessous": dessous, **reste}


def test_la_fabrique_ecrit_un_asset_entier(client, double):
    """**Le seul geste du produit dont le résultat a deux ascendants.**

    Ses pixels et son parent viennent du dessus ; le dessous est une référence,
    gardée pour que la superposition se rejoue. Elle a servi à décider ce qu'on
    garde, elle n'a donné aucun pixel — donc elle n'est pas le parent.
    """
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)

    reponse = client.post(
        "/api/overlay", json={"pose": _pose(haut, bas), "sorties": ["calque"]}
    )
    assert reponse.status_code == 200, reponse.text
    (ne,) = reponse.json()["superpositions"]

    assert ne["parent"] == haut
    assert ne["superposition"]["dessous"] == bas
    assert ne["superposition"]["sortie"] == "calque"
    # **Sa recette est vide** : la superposition a travaillé sur deux images
    # rendues, et leur réappliquer leurs recettes détourerait ce qui l'est déjà.
    assert ne["recette"]["passes"] == []
    assert ne["recette"]["grille"] is None
    # **Rien n'a été demandé à personne.**
    assert ne["cout_usd"] == 0.0
    # Et les cinq mesures sont là, prises à la naissance.
    assert ne["calque"] is not None


def test_les_deux_sorties_se_cochent_au_lieu_de_s_exclure(client, double):
    """« On veut souvent le calque pour le réutiliser **et** l'aplat pour
    l'avoir tout de suite. »"""
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)

    reponse = client.post(
        "/api/overlay",
        json={"pose": _pose(haut, bas), "sorties": ["calque", "aplat"]},
    )
    nees = reponse.json()["superpositions"]

    assert [n["superposition"]["sortie"] for n in nees] == ["calque", "aplat"]
    # L'aplat nomme les deux, dans l'ordre de la pile ; le calque prend le nom
    # de la pièce, parce que c'est sous ce nom qu'on le cherchera.
    assert " + " in nees[1]["label"]


def test_rien_de_coche_est_refuse_en_le_nommant(client, double):
    bas, haut = _deux_images(client, double)
    reponse = client.post(
        "/api/overlay", json={"pose": _pose(haut, bas), "sorties": []}
    )

    assert reponse.status_code == 409
    assert "coché" in reponse.json()["raison"]


def test_la_meme_image_des_deux_cotes_est_refusee(client, double):
    bas, _ = _deux_images(client, double)
    reponse = client.post(
        "/api/overlay", json={"pose": _pose(bas, bas), "sorties": ["calque"]}
    )

    assert reponse.status_code == 409
    assert "rien à comparer" in reponse.json()["raison"]


def test_la_fabrique_ne_pose_rien_sur_la_recette_de_l_image_courante(client, double):
    """Le critère de la tranche, pris au pied de la lettre.

    **Le corps d'origine n'est jamais modifié**, et le dessus non plus : la
    superposition les lit, elle ne les écrit jamais.
    """
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)
    avant_bas = client.get(f"/api/assets/{bas}").json()["recette"]
    avant_haut = client.get(f"/api/assets/{haut}").json()["recette"]

    client.post("/api/overlay", json={"pose": _pose(haut, bas), "sorties": ["calque"]})

    assert client.get(f"/api/assets/{bas}").json()["recette"] == avant_bas
    assert client.get(f"/api/assets/{haut}").json()["recette"] == avant_haut


def test_un_recalage_rate_se_rejoue_sans_repayer(client, double):
    """**La promesse de R5, étendue à n'importe quelles deux images.**

    Même identifiant, même rang, même place en bibliothèque, et pas un centime.
    Fabriquer un second asset à chaque correction laisserait derrière lui tous
    les ratés.
    """
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)

    (ne,) = client.post(
        "/api/overlay", json={"pose": _pose(haut, bas), "sorties": ["calque"]}
    ).json()["superpositions"]
    appels = double.appels

    rejoue = client.put(
        f"/api/assets/{ne['identifiant']}/overlay",
        json=_pose(haut, bas, dx=3, dy=-2),
    )
    assert rejoue.status_code == 200, rejoue.text
    assert rejoue.json()["identifiant"] == ne["identifiant"]
    assert rejoue.json()["superposition"]["dx"] == 3
    # Pas un appel de plus, pas un centime.
    assert double.appels == appels
    assert rejoue.json()["cout_usd"] == 0.0


def test_rejouer_une_image_qui_n_en_est_pas_une_est_refuse(client, double):
    bas, haut = _deux_images(client, double)
    reponse = client.put(f"/api/assets/{haut}/overlay", json=_pose(haut, bas))

    assert reponse.status_code == 409
    assert "n'est pas sortie d'une superposition" in reponse.json()["raison"]


# ── L'aperçu, et ce qu'il ne fait pas ────────────────────────────────────────


def test_l_apercu_rend_les_deux_sorties_et_les_mesures_sans_rien_ecrire(client, double):
    """Un seul appel, trois réponses — les mesurer à part demanderait un second
    alignement, qui pourrait tomber ailleurs."""
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)
    avant = len(client.get("/api/assets").json()["assets"])

    reponse = client.post("/api/overlay/preview", json=_pose(haut, bas))
    assert reponse.status_code == 200, reponse.text
    vu = reponse.json()

    assert vu["calque"].startswith("data:image/png;base64,")
    assert vu["aplat"].startswith("data:image/png;base64,")
    assert set(vu["mesures"]) >= {"silhouette", "repeint", "ajout", "echelle", "compacite"}
    # Rien n'est né.
    assert len(client.get("/api/assets").json()["assets"]) == avant


# ── Le détourage emprunté ────────────────────────────────────────────────────


def test_l_outil_dit_que_le_dessus_n_a_pas_d_alpha_et_propose_le_geste(client, double):
    """**Il constate, il ne refuse pas.** Une image qui remplit légitimement son
    cadre existe, et l'atelier n'a pas les moyens de savoir laquelle il a sous
    les yeux."""
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _sans_detourage(client, haut)

    ouvert = client.get(f"/api/assets/{haut}/overlay", params={"dessous": bas}).json()
    assert ouvert["sans_alpha"] is True
    assert ouvert["passes_dessous"] == 1

    repris = client.post(
        f"/api/assets/{haut}/overlay/inherit", params={"dessous": bas}
    )
    assert repris.status_code == 200, repris.text
    assert len(repris.json()["recette"]["passes"]) == 1

    # Et l'alerte tombe, parce que le fait qu'elle nommait n'est plus vrai.
    ouvert = client.get(f"/api/assets/{haut}/overlay", params={"dessous": bas}).json()
    assert ouvert["sans_alpha"] is False


def test_heriter_d_un_dessous_non_detoure_est_refuse(client, double):
    bas, haut = _deux_images(client, double)
    _sans_detourage(client, bas)
    reponse = client.post(
        f"/api/assets/{haut}/overlay/inherit", params={"dessous": bas}
    )

    assert reponse.status_code == 409
    assert "rien à reprendre" in reponse.json()["raison"]


# ── Les réglages gardés ──────────────────────────────────────────────────────


def test_les_reglages_se_gardent_sur_la_reference_et_reviennent(client, double):
    """« Un jeu de réglages qui marche pour un casque marchera à 90 % pour le
    suivant. » Ils reviennent avec leur provenance, et se défont d'un clic."""
    bas, haut = _deux_images(client, double)
    _detourer(client, bas)
    _detourer(client, haut)

    client.post(
        "/api/overlay",
        json={
            "pose": _pose(haut, bas, dx=4, dy=-6, seuil=48),
            "sorties": ["calque"],
            "garder": True,
        },
    )

    ouvert = client.get(f"/api/assets/{haut}/overlay", params={"dessous": bas}).json()
    assert ouvert["pose"]["dx"] == 4
    assert ouvert["pose"]["seuil"] == 48
    assert ouvert["repris"] is not None  # la provenance est là

    # **Les passages de la main ne sont pas gardés** : ils sont dessinés sur une
    # image précise et n'ont aucun sens sur une autre pièce.
    assert ouvert["pose"]["main"] == []

    oublie = client.delete(f"/api/assets/{bas}/overlay/saved")
    assert oublie.status_code == 200
    ouvert = client.get(f"/api/assets/{haut}/overlay", params={"dessous": bas}).json()
    assert ouvert["repris"] is None
    assert ouvert["pose"]["dx"] == 0


def test_les_reglages_gardes_se_relisent_du_disque():
    """Un aller-retour, parce que ce sont eux qui survivent à la séance."""
    gardes = ReglagesGardes(
        depuis="casque de fer", le=1.0, echelle=0.98, dx=2, dy=-3, seuil=40
    )
    relus = ReglagesGardes.depuis_json(gardes.en_json())

    assert relus == gardes
    assert relus.sur("a", "b").seuil == 40
    assert relus.sur("a", "b").main == ()


def _opaques(octets: bytes) -> int:
    with Image.open(io.BytesIO(octets)) as image:
        return int((np.asarray(image.convert("RGBA"))[:, :, 3] > 0).sum())
