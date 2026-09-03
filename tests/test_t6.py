# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T6 — l'export.

Un test par critère de `docs/archive/plan-versions-tenues.md` § Phase T6, nommé d'après lui.

**Aucun test de ce fichier n'appelle le fournisseur, et l'un le prouve** en
comptant les appels du double avant et après un export. C'est le cinquième
critère — « l'export fonctionne réseau coupé » —, et il se démontre plutôt qu'il
ne se déclare : `services/export.py` n'importe aucun fournisseur, mais seul un
compte d'appels le vérifie de bout en bout, à travers la route.

L'archive est **ouverte** par ces tests, pas seulement mesurée : `zipfile` la
relit, `json` relit le descriptif, et Pillow rouvre les PNG. Une archive dont on
ne vérifierait que la taille pourrait être n'importe quoi — et l'export est
précisément le geste dont personne ne voit le résultat avant de l'ouvrir
ailleurs, dans un moteur de jeu, une semaine plus tard.
"""

from __future__ import annotations

import io
import json
import time
import zipfile

from conftest import image_sujet
from PIL import Image
from test_t5 import planche as dessiner_planche

from atelier.services.export import DESCRIPTIF


# ── Ce que les tests partagent ───────────────────────────────────────────────


def _generer(client, prompt: str = "un tonneau", variations: int = 1) -> dict:
    """Un lot lancé par la route, **et attendu jusqu'à son terme**.

    Le POST rend la main tout de suite — « la génération vit côté serveur »
    (T1). Exporter un lot qui n'est pas encore arrivé exporterait le vide.
    """
    reponse = client.post(
        "/api/generations",
        json={
            "modele": "essai:rend-du-png",
            "prompt": prompt,
            "prompt_negatif": "flou",
            "variations": variations,
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée")


def _exporter(client, identifiants: list[str]):
    return client.post("/api/exports", json={"identifiants": identifiants})


def _ouvrir(reponse) -> tuple[zipfile.ZipFile, dict]:
    """L'archive et son descriptif, relus depuis les octets servis."""
    assert reponse.status_code == 200, reponse.text
    archive = zipfile.ZipFile(io.BytesIO(reponse.content))
    return archive, json.loads(archive.read(DESCRIPTIF).decode("utf-8"))


def _decouper(client, double, boites: int = 2) -> tuple[str, list[dict]]:
    """Une planche entrée par le chemin normal, puis découpée.

    Elle sert aux tests de filiation et de prompt : une découpe est le seul
    asset du produit qui ait un parent **et** un prompt qu'elle n'a pas demandé
    elle-même. C'est le cas où le descriptif travaille vraiment.
    """
    double.rendre = lambda: dessiner_planche(colonnes=boites, lignes=1)
    generation = _generer(client, prompt="une planche de deux")
    planche = f"{generation['identifiant']}-0"

    propose = client.get(f"/api/assets/{planche}/slices")
    assert propose.status_code == 200, propose.text
    trouvees = propose.json()["boites"]
    assert len(trouvees) == boites, trouvees

    decoupe = client.post(f"/api/assets/{planche}/slices", json={"boites": trouvees})
    assert decoupe.status_code == 200, decoupe.text
    return planche, decoupe.json()["decoupes"]


# ── Une sélection multiple s'exporte en une archive ──────────────────────────


def test_une_selection_multiple_sort_en_une_archive_avec_son_descriptif(client):
    """Le premier critère : les images **et** un descriptif, dans un seul fichier."""
    generation = _generer(client, variations=3)
    identifiants = [f"{generation['identifiant']}-{rang}" for rang in range(3)]

    reponse = _exporter(client, identifiants)
    archive, descriptif = _ouvrir(reponse)

    # Trois images plus le descriptif, et rien d'autre : une archive qui
    # emporterait le brut à côté du rendu doublerait sa taille pour un besoin
    # que personne n'a exprimé — le brut ne quitte pas l'atelier.
    noms = sorted(archive.namelist())
    assert len(noms) == 4
    assert DESCRIPTIF in noms
    images = [n for n in noms if n != DESCRIPTIF]
    assert all(n.endswith(".png") for n in images)

    # Ce sont de vraies images, pas des octets qui portent la bonne extension.
    for nom in images:
        with Image.open(io.BytesIO(archive.read(nom))) as image:
            assert image.format == "PNG"

    assert descriptif["compte"] == 3
    assert {f["identifiant"] for f in descriptif["assets"]} == set(identifiants)
    # Le descriptif nomme le fichier de chacun : c'est lui qui fait foi sur le
    # lien entre un nom lisible et un identifiant, jamais le nom lui-même.
    assert {f["fichier"] for f in descriptif["assets"]} == set(images)

    # L'archive se nomme, et son nom part au navigateur.
    disposition = reponse.headers["content-disposition"]
    assert disposition.startswith('attachment; filename="atelier-')
    assert disposition.endswith('.zip"')
    assert reponse.headers["content-type"] == "application/zip"


def test_deux_images_de_meme_label_ne_se_recouvrent_pas_dans_l_archive(client):
    """Un lot de quatre variations porte quatre fois le même label.

    Sans numérotation, les quatre s'écriraient sous le même nom : `zipfile`
    accepte les doublons sans broncher, et l'archive ne rendrait qu'une image
    sur quatre à qui la décompresse. Le nom vient du label parce que c'est le
    mot que l'auteur reconnaît ; il est numéroté parce qu'un label n'est pas
    unique et n'a jamais eu à l'être.
    """
    generation = _generer(client, variations=4)
    identifiants = [f"{generation['identifiant']}-{rang}" for rang in range(4)]

    archive, descriptif = _ouvrir(_exporter(client, identifiants))

    images = sorted(n for n in archive.namelist() if n != DESCRIPTIF)
    assert images == [
        "un-tonneau-2.png",
        "un-tonneau-3.png",
        "un-tonneau-4.png",
        "un-tonneau.png",
    ]
    for fiche in descriptif["assets"]:
        assert fiche["fichier"] in images


def test_la_meme_image_selectionnee_deux_fois_ne_sort_qu_une_fois(client):
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"

    archive, descriptif = _ouvrir(_exporter(client, [identifiant, identifiant]))

    assert descriptif["compte"] == 1
    assert len(archive.namelist()) == 2  # l'image et le descriptif


# ── Le descriptif porte de quoi reconnaître et rejouer ───────────────────────


def test_le_descriptif_porte_label_prompt_reglages_dimensions_et_filiation(
    client, double
):
    """Le deuxième critère, mot par mot.

    Le sujet du test est une **découpe** : c'est le cas où les cinq champs sont
    tous non triviaux à la fois — un label composé, une filiation vers sa
    planche, des dimensions qui sont les siennes, et un prompt qu'elle n'a pas
    demandé mais qui explique d'où elle vient.
    """
    planche, decoupes = _decouper(client, double)
    morceau = decoupes[0]["identifiant"]

    archive, descriptif = _ouvrir(_exporter(client, [morceau]))
    fiche = descriptif["assets"][0]

    # 1 · le label — celui que la découpe a reçu, pas l'identifiant.
    assert fiche["label"] == decoupes[0]["label"]
    assert fiche["label"]

    # 2 · le prompt, et le prompt négatif : ceux de l'appel qui a produit la
    #     planche. Une découpe qui ne dirait pas d'où elle vient serait, dans un
    #     dossier de jeu, une image sans histoire.
    assert fiche["generation"]["prompt"] == "REQUEST\n\nune planche de deux"
    assert fiche["generation"]["prompt_negatif"] == "flou"
    assert fiche["generation"]["modele"] == "essai:rend-du-png"

    # 3 · les réglages résolus — ce qui est réellement parti, pas ce qui a été
    #     demandé. C'est l'invariant de T1, reconduit jusque dans l'archive.
    assert fiche["generation"]["reglages_resolus"]

    # 4 · les dimensions, **mesurées sur le fichier qui part** et non recopiées
    #     de l'enregistrement.
    with Image.open(io.BytesIO(archive.read(fiche["fichier"]))) as image:
        assert (image.width, image.height) == (
            fiche["dimensions"]["largeur"],
            fiche["dimensions"]["hauteur"],
        )
    assert fiche["brut"]["largeur"] > 0 and fiche["brut"]["hauteur"] > 0

    # 5 · la filiation — en identifiants, dans les deux sens.
    assert fiche["filiation"]["parent"] == planche
    assert fiche["filiation"]["parent_supprime"] is False
    assert fiche["filiation"]["enfants"] == []

    # Et ce que la tranche n'exige pas mais qui rend « rejouer » vrai : la
    # recette, avec son empreinte. Une recette réappliquée rend exactement la
    # même image ; un appel, jamais.
    assert "recette" in fiche and fiche["empreinte"]


def test_le_descriptif_dit_le_projet_et_la_collection_par_leur_nom(client):
    """Un identifiant de projet est un repère de dossier ; un nom se lit.

    Le descriptif porte les deux : l'identifiant pour retrouver la chose dans
    l'atelier, le nom pour la reconnaître six mois plus tard.
    """
    # Une collection **du projet** : une collection sans projet traverse les
    # univers et détache donc ce qu'on y range (`ARCHITECTURE.md` §5). Ce qu'on
    # veut voir ici, c'est un asset qui a les deux.
    collection = client.post(
        "/api/collections", json={"nom": "Tonneaux du port", "projet": "bac-a-sable"}
    ).json()["collection"]
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"
    range_ = client.put(
        "/api/assets/arrangement",
        json={"identifiants": [identifiant], "collection": collection["identifiant"]},
    )
    assert range_.status_code == 200, range_.text

    _, descriptif = _ouvrir(_exporter(client, [identifiant]))
    fiche = descriptif["assets"][0]

    assert fiche["projet"]["nom"] == "Bac à sable"
    assert fiche["collection"] == {
        "identifiant": collection["identifiant"],
        "nom": "Tonneaux du port",
    }


def test_un_parent_supprime_reste_dans_la_filiation_du_descriptif(client, double):
    """« Une filiation incomplète reste une filiation » — jusque dans l'archive.

    La règle vit dans la bibliothèque et n'est pas rejouée par l'export : c'est
    ce qui garantit que les deux ne divergeront pas.
    """
    planche, decoupes = _decouper(client, double)
    morceau = decoupes[0]["identifiant"]

    client.post("/api/assets/delete", json={"identifiants": [planche]})

    _, descriptif = _ouvrir(_exporter(client, [morceau]))
    filiation = descriptif["assets"][0]["filiation"]

    assert filiation["parent"] == planche
    assert filiation["parent_supprime"] is True


def test_le_rendu_part_dans_l_archive_pas_le_brut(client, double):
    """« Ce qui part, c'est ce qu'on voit. »

    Un asset détouré et remis sur une grille de 32 px sort en 32 px, pas dans
    les dimensions de l'image reçue. Exporter le brut rendrait le fond gris
    qu'on vient d'enlever.
    """
    double.rendre = image_sujet
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"
    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [{"moteur": "bord"}],
            "recadrage": {"marge": 0},
            "grille": {"cible": 32, "occupation": 100},
        },
    )
    assert pose.status_code == 200, pose.text
    asset = pose.json()
    assert asset["rendu_largeur"] == 32
    assert asset["largeur"] != asset["rendu_largeur"]

    archive, descriptif = _ouvrir(_exporter(client, [identifiant]))
    fiche = descriptif["assets"][0]

    with Image.open(io.BytesIO(archive.read(fiche["fichier"]))) as image:
        assert (image.width, image.height) == (
            asset["rendu_largeur"],
            asset["rendu_hauteur"],
        )
        # Détouré : le PNG porte un canal alpha, et il est réellement percé.
        assert image.mode == "RGBA"
        assert image.getchannel("A").getextrema() == (0, 255)

    assert fiche["dimensions"]["largeur"] == asset["rendu_largeur"]
    assert fiche["brut"]["largeur"] == asset["largeur"]


def test_une_image_de_modele_jpeg_sort_en_png(client):
    """Tous les modèles ne rendent pas du PNG — deux ne rendent que du JPEG.

    La conversion est du ressort du produit, à l'export comme au téléchargement
    d'une image seule, et c'est le même appel qui la fait.
    """
    lance = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-jpeg", "prompt": "un tonneau"},
    )
    assert lance.status_code == 202, lance.text
    identifiant = f"{lance.json()['identifiant']}-0"
    for _ in range(400):
        if client.get(f"/api/assets/{identifiant}").status_code == 200:
            break
        time.sleep(0.01)

    archive, descriptif = _ouvrir(_exporter(client, [identifiant]))
    fiche = descriptif["assets"][0]

    assert fiche["fichier"].endswith(".png")
    with Image.open(io.BytesIO(archive.read(fiche["fichier"]))) as image:
        assert image.format == "PNG"
    # Le brut, lui, reste ce qu'il était : le PNG est un rendu, pas un
    # remplacement.
    assert fiche["brut"]["type_media"] == "image/jpeg"


# ── Sélection vide : grisé avec sa raison ────────────────────────────────────


def test_selection_vide_l_export_est_refuse_avec_sa_raison(client):
    """Le troisième critère, côté serveur — le filet, pas le chemin normal.

    L'écran grise d'abord (`interface/src/App.test.tsx`). Ce refus-ci existe
    pour le MCP de T7, qui n'a pas d'écran devant lui : il doit recevoir une
    phrase du produit, en français, et non un rapport de validation en anglais.
    """
    reponse = _exporter(client, [])

    assert reponse.status_code == 409
    charge = reponse.json()
    assert charge["code"] == "export_refuse"
    assert charge["raison"] == "aucune image sélectionnée"


def test_un_asset_qui_n_est_plus_la_est_refuse_en_le_nommant(client):
    """Pas d'archive à trous : on dit lequel manque.

    Une archive à laquelle il manquerait une image sans le dire serait
    découverte une semaine plus tard, dans un moteur de jeu, sans moyen de
    savoir laquelle.
    """
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"
    client.post("/api/assets/delete", json={"identifiants": [identifiant]})

    reponse = _exporter(client, [identifiant])

    assert reponse.status_code == 409
    assert identifiant in reponse.json()["raison"]


# ── Une image seule se télécharge toujours ───────────────────────────────────


def test_une_image_seule_se_telecharge_sans_passer_par_l_archive(client):
    """Le quatrième critère. L'archive s'ajoute au téléchargement, elle ne le
    remplace pas : exporter une image pour en obtenir une, il faudrait ensuite
    la décompresser."""
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"

    reponse = client.get(f"/api/assets/{identifiant}/download")

    assert reponse.status_code == 200
    assert reponse.headers["content-type"] == "image/png"
    assert reponse.headers["content-disposition"].endswith(f'{identifiant}.png"')
    with Image.open(io.BytesIO(reponse.content)) as image:
        assert image.format == "PNG"


# ── Réseau coupé ─────────────────────────────────────────────────────────────


def test_l_export_fonctionne_reseau_coupe(client, double):
    """Le cinquième critère, **prouvé** en comptant les appels du double.

    On génère — c'est le seul appel du test —, puis on coupe le réseau et on
    exporte. Le compte du double ne bouge pas d'un cran.
    """
    generation = _generer(client, variations=2)
    identifiants = [f"{generation['identifiant']}-{rang}" for rang in range(2)]

    double.catalogue_lisible = False
    double.echec = AssertionError("l'export ne doit jamais appeler le fournisseur")
    avant = double.appels

    archive, descriptif = _ouvrir(_exporter(client, identifiants))

    assert double.appels == avant
    assert descriptif["compte"] == 2
    assert len([n for n in archive.namelist() if n != DESCRIPTIF]) == 2
