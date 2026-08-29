# -*- coding: utf-8 -*-
"""Les critères d'acceptation de R3 — faire entrer une image depuis l'écran.

Un test par critère de `docs/PLAN.md` § R3, nommé d'après lui.

**Le geste que l'agent avait depuis T7 et que l'écran n'avait jamais eu.** La
seule pièce neuve du serveur est une route qui prend les **octets** : celle qui
existait prend un chemin, ce qu'un navigateur ne donne jamais. Les deux appellent
le même service, et c'est ce qui garde vraie la phrase « ce que l'agent peut
faire, l'écran le peut aussi » — dans les deux sens.

Deux critères ne se vérifient pas ici parce qu'ils portent sur ce que l'écran
fait — le bouton et le dépôt sur la grille, le choix offert au moment du geste.
Ceux-là vivent dans `interface/src/App.test.tsx`.

**Aucun test de ce fichier ne coûte un centime**, et l'un le prouve plutôt que de
l'affirmer : importer, refuser, forcer et retoucher ne demandent jamais le
fournisseur.
"""

from __future__ import annotations

import io
import os

import pytest
from conftest import image, image_sujet
from PIL import Image

from atelier.domaine.projet import AUCUNE_CIBLE


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _entrer(client, octets: bytes, nom: str, **params) -> dict:
    """Faire entrer des octets par **la route de l'écran** — celle qui n'a pas
    de chemin de fichier à donner."""
    reponse = client.post(
        "/api/assets/upload",
        content=octets,
        params={"nom": nom, **params},
    )
    assert reponse.status_code in (201, 409), reponse.text
    return reponse.json()


def _asset(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _grosse_image(mega: int = 3) -> bytes:
    """Une image de plusieurs mégaoctets, **incompressible**.

    Un aplat de 4000 px pèse quelques kilo-octets une fois en PNG : il ne
    prouverait rien du critère. Du bruit, lui, ne se compresse pas — c'est le
    seul moyen d'avoir vraiment la taille qu'on annonce, et `os.urandom` le
    fabrique en une fois plutôt qu'octet par octet.
    """
    octets_voulus = mega * 1024 * 1024
    cote = int((octets_voulus / 3) ** 0.5) + 64
    tampon = io.BytesIO()
    Image.frombytes("RGB", (cote, cote), os.urandom(cote * cote * 3)).save(
        tampon, format="PNG", compress_level=0
    )
    return tampon.getvalue()


# ── « Un bouton d'import fait entrer un fichier choisi, et le déposer sur la
#     grille fait la même chose » — la moitié serveur ────────────────────────


def test_la_route_qui_prend_les_octets_fait_entrer_une_image(client):
    """La seule pièce neuve du serveur, et elle rend la forme de la tranche.

    `{"asset": …, "doublon": …}`, dont l'un est toujours nul — la forme de
    `coller_image`, parce que la question posée est la même.
    """
    entree = _entrer(client, image_sujet(), "epee-longue.png")

    assert entree["doublon"] is None
    asset = entree["asset"]
    assert asset["modele"] == "import"
    assert asset["label"] == "epee-longue.png"
    assert asset["cout_usd"] == 0.0
    assert asset["provenance"] == "auteur"


def test_les_deux_routes_et_l_outil_passent_par_le_meme_service(client, tmp_path):
    """« Aucun geste que l'un a et l'autre pas. »

    Les deux routes rendent **la même forme** et acceptent les **mêmes
    options** : l'une prend un chemin — ce qu'un agent a —, l'autre des octets
    — ce qu'un navigateur a —, et c'est la seule différence entre elles.
    """
    fichier = tmp_path / "tonneau.png"
    fichier.write_bytes(image_sujet())

    par_chemin = client.post(
        "/api/assets/import", json={"chemin": str(fichier), "traiter": True}
    )
    assert par_chemin.status_code == 201, par_chemin.text
    assert set(par_chemin.json()) == {"asset", "doublon"}

    # Les mêmes octets, par l'autre porte : le doublon est reconnu, ce qui
    # prouve que les deux ont écrit au même endroit.
    par_octets = _entrer(client, image_sujet(), "tonneau.png")
    assert par_octets["asset"] is None
    assert par_octets["doublon"]["identifiant"] == par_chemin.json()["asset"]["identifiant"]


# ── « Plusieurs fichiers déposés d'un coup entrent tous, chacun avec son propre
#     sort » · « Ce qui n'est pas une image est refusé en le nommant, et les
#     autres fichiers du même dépôt entrent quand même » ──────────────────────


def test_un_depot_melange_fait_entrer_les_images_et_nomme_le_refus(client):
    """Trois fichiers, trois sorts, **et aucun n'empêche les autres**.

    C'est pour ça qu'il y a un appel par fichier et non un lot : un lot aurait
    dû inventer une forme de réponse partielle, et il aurait fait attendre les
    deux images que le fichier illisible soit lu.
    """
    premiere = _entrer(client, image_sujet(), "epee.png")
    refus = client.post(
        "/api/assets/upload", content=b"ceci n'est pas une image", params={"nom": "notes.txt"}
    )
    seconde = _entrer(client, image("PNG", (64, 64)), "bouclier.png")

    assert premiere["asset"] is not None
    assert seconde["asset"] is not None

    assert refus.status_code == 409, refus.text
    # **Le nom est dans la phrase**, pas dans un champ à côté : c'est la phrase
    # qui s'affiche, et « savoir lequel des douze fichiers pose problème » est
    # tout ce que ce refus doit apprendre.
    assert "notes.txt" in refus.json()["raison"]
    # Et le message de Pillow ne franchit pas la ligne : ni tampon mémoire, ni
    # anglais.
    assert "cannot identify" not in refus.json()["raison"]


# ── « Un doublon est signalé avec le lien vers l'existant, et l'import forcé
#     reste possible — comme au tableau d'inspiration » ───────────────────────


def test_un_doublon_est_signale_et_l_import_force_reste_possible(client):
    """**Un doublon n'est pas un refus** : il ne lève pas, il propose.

    Une erreur obligerait l'écran à traduire un échec en proposition ; une
    réponse qui porte l'asset existant lui donne directement de quoi faire le
    lien vers lui.
    """
    premier = _entrer(client, image_sujet(), "epee.png")["asset"]

    signale = _entrer(client, image_sujet(), "epee-copie.png")
    assert signale["asset"] is None
    assert signale["doublon"]["identifiant"] == premier["identifiant"]

    force = _entrer(client, image_sujet(), "epee-copie.png", forcer=True)
    assert force["doublon"] is None
    assert force["asset"]["identifiant"] != premier["identifiant"]


def test_le_doublon_se_compte_par_projet_comme_au_tableau(client):
    """Même portée qu'au tableau d'inspiration, et l'écran dit « comme au
    tableau ».

    Un univers n'a pas à savoir ce qu'un autre a fait entrer : la même référence
    a de bonnes raisons de servir dans deux jeux.
    """
    _entrer(client, image_sujet(), "epee.png")

    cree = client.post("/api/projects", json={"nom": "Tourbe et fer"})
    assert cree.status_code == 201, cree.text
    client.put("/api/library/current", json={"projet": cree.json()["projet"]["identifiant"]})

    ailleurs = _entrer(client, image_sujet(), "epee.png")
    assert ailleurs["doublon"] is None
    assert ailleurs["asset"] is not None


def test_un_doublon_supprime_n_en_est_plus_un(client):
    """Ce qui a quitté la bibliothèque n'a plus de lien à proposer.

    La génération de l'import reste sur le disque — c'est elle qui porte
    l'empreinte —, mais l'asset, lui, est parti : signaler un doublon vers une
    image qu'on ne peut plus ouvrir serait pire que de ne rien dire.
    """
    premier = _entrer(client, image_sujet(), "epee.png")["asset"]
    supprime = client.post(
        "/api/assets/delete", json={"identifiants": [premier["identifiant"]]}
    )
    assert supprime.status_code == 200, supprime.text

    revenu = _entrer(client, image_sujet(), "epee.png")
    assert revenu["doublon"] is None
    assert revenu["asset"] is not None


# ── « L'image importée est un asset ordinaire : filiation, retouche, découpe,
#     export, suppression avec annulation » ──────────────────────────────────


def test_une_image_importee_est_un_asset_ordinaire(client):
    """Quatre gestes, sur une image que personne n'a payée.

    Elle passe par une **génération** — modèle `import`, coût nul —, et c'est ce
    qui la rend ordinaire : tout ce que le produit sait faire d'un asset part de
    là, y compris la reconstruction de l'index depuis les fichiers.
    """
    identifiant = _entrer(client, image_sujet(), "planche.png")["asset"]["identifiant"]

    # Retoucher.
    recette = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}],
        "recadrage": {"marge": 0, "boite": None},
        "grille": {"cible": 32, "occupation": 100, "ancrage": "bas"},
        "quantification": None,
        "bords": None,
        "nom": None,
    }
    pose = client.put(f"/api/assets/{identifiant}/recipe", json=recette)
    assert pose.status_code == 200, pose.text

    # Découper : la proposition, puis la découpe de ce qu'elle propose — les
    # deux gestes séparés de T5, et c'est bien ce que l'écran fait.
    propose = client.get(
        f"/api/assets/{identifiant}/slices",
        params={"mode": "grille", "colonnes": 2, "lignes": 1},
    )
    assert propose.status_code == 200, propose.text
    coupe = client.post(
        f"/api/assets/{identifiant}/slices", json={"boites": propose.json()["boites"]}
    )
    assert coupe.status_code == 200, coupe.text
    morceaux = coupe.json()["decoupes"]
    assert len(morceaux) == 2
    assert all(m["parent"] == identifiant for m in morceaux)

    # Exporter.
    archive = client.post("/api/exports", json={"identifiants": [identifiant]})
    assert archive.status_code == 200, archive.text

    # Supprimer, et annuler.
    supprime = client.post("/api/assets/delete", json={"identifiants": [identifiant]})
    assert supprime.status_code == 200, supprime.text
    assert supprime.json()["annulation_s"] > 0
    rendu = client.post("/api/assets/restore", json={"identifiants": [identifiant]})
    assert rendu.status_code == 200, rendu.text
    assert client.get(f"/api/assets/{identifiant}").status_code == 200


def test_une_image_importee_dit_d_ou_elle_vient(client):
    """« Importée, coût nul, et le nom du fichier d'origine » (US-168).

    Les trois sont sur l'asset, donc dans la fiche sans un appel de plus : le
    modèle vaut `import` — l'écran écrit « importé » —, le coût est zéro parce
    qu'il a été mesuré à zéro, et le label **est** le nom du fichier.
    """
    asset = _entrer(client, image_sujet(), "epee-longue-du-nain.png")["asset"]
    assert (asset["modele"], asset["cout_usd"]) == ("import", 0.0)
    assert asset["label"] == "epee-longue-du-nain.png"


# ── « Le choix "traitement du projet / telle quelle" est offert au moment de
#     l'import, et le défaut est "telle quelle" » ────────────────────────────


def test_le_defaut_est_telle_quelle(client):
    """**Une correction, et elle vaut des deux côtés.**

    L'import héritait de la recette du projet en silence : une référence de 2048
    pixels revenait à 64, ce que personne n'avait demandé. Sans rien dire, une
    image entre donc désormais telle quelle — et le rendu **est** le brut.
    """
    # Une image ordinaire de 200 px : ce que le critère mesure est qu'elle
    # **n'est pas ramenée** aux 64 px du projet.
    asset = _entrer(client, image("PNG", (200, 200)), "reference.png")["asset"]

    assert asset["recette"] == {
        "passes": [],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "nom": None,
    }
    # **Le rendu *est* le brut**, et il n'y a donc pas de cache : les
    # dimensions mesurées sont celles du fichier, et `rendu_*` reste à zéro —
    # « zéro n'est pas une dimension mesurée, c'est l'absence de mesure ».
    assert (asset["largeur"], asset["hauteur"]) == (200, 200)
    assert (asset["rendu_largeur"], asset["rendu_hauteur"]) == (0, 0)


def test_le_traitement_du_projet_s_applique_quand_on_le_demande(client):
    """L'autre moitié du choix : demandé, il fait exactement ce qu'il faisait.

    C'est la même recette que celle d'une image générée — `recette_de` est le
    seul endroit qui dise ce qu'un projet impose, et l'import n'en a pas
    inventé un second.
    """
    asset = _entrer(client, image_sujet(toile=200), "sujet.png", traiter=True)["asset"]

    assert asset["recette"]["grille"] == {"cible": 64, "occupation": 100, "ancrage": "bas"}
    assert len(asset["recette"]["passes"]) == 1
    assert (asset["rendu_largeur"], asset["rendu_hauteur"]) == (64, 64)


def test_une_image_entree_telle_quelle_reste_telle_quelle_au_realignement(client):
    """Conséquence heureuse et non fortuite.

    Une recette vide est déjà ce que le balayage de palette laisse tranquille
    — « un asset ramené au brut reste au brut » (US-64). Une image entrée telle
    quelle le reste donc, sans qu'aucune règle nouvelle ait eu à le dire.
    """
    asset = _entrer(client, image("PNG", (200, 200)), "reference.png")["asset"]

    client.post("/api/universe/realign", json={"identifiants": None})

    relu = _asset(client, asset["identifiant"])
    assert relu["recette"]["grille"] is None


def test_telle_quelle_survit_a_l_effacement_de_l_index(client, atelier):
    """La décision est portée par la **génération**, pas par un réglage d'écran.

    L'index est jetable : ce qui n'est pas dans un `generation.json` n'existe
    pas après la première évolution du schéma. Une image entrée telle quelle
    doit donc le rester après une reconstruction — sinon elle se retrouverait un
    matin ramenée sur la grille du projet, sans que personne l'ait demandé.
    """
    asset = _entrer(client, image("PNG", (200, 200)), "reference.png")["asset"]

    atelier.bibliotheque.reconstruire()

    relu = _asset(client, asset["identifiant"])
    assert relu["recette"]["grille"] is None
    assert (relu["largeur"], relu["hauteur"]) == (200, 200)


def test_sans_cible_le_traitement_demande_ne_reechantillonne_pas(client):
    """La composition des deux reprises, vérifiée plutôt que supposée.

    « Traitement du projet » demandé sur un projet qui n'impose aucune taille de
    pixel (R2) doit détourer et recadrer sans remettre sur grille. Deux tranches
    voisines dont la composition perd quelque chose en silence est très
    exactement ce que ce dépôt cherche à éviter.
    """
    client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})
    asset = _entrer(client, image_sujet(toile=200), "sujet.png", traiter=True)["asset"]

    assert asset["recette"]["grille"] is None
    assert len(asset["recette"]["passes"]) == 1


# ── « Un fichier de plusieurs mégaoctets entre sans que l'écran se fige » ────


def test_un_fichier_de_plusieurs_megaoctets_entre(client):
    """**Mesuré sur des octets réels**, pas sur une intention.

    Les octets sont le corps de la requête, bruts : pas de `multipart`, pas de
    base64. Un encodage en base64 aurait ajouté un tiers au transport et une
    copie en mémoire de chaque côté, pour un trajet qui ne quitte pas la
    machine.
    """
    octets = _grosse_image(3)
    assert len(octets) >= 3 * 1024 * 1024

    entree = _entrer(client, octets, "planche-de-reference.png")

    asset = entree["asset"]
    assert asset is not None
    # **Le corps entier est arrivé**, et c'est le fichier servi qui le dit :
    # une taille annoncée par celui qui a écrit ne prouverait que lui-même.
    servi = client.get(f"/api/assets/{asset['identifiant']}/image", params={"brut": True})
    assert servi.status_code == 200, servi.text
    assert len(servi.content) == len(octets)


# ── « Réseau coupé : l'import fonctionne de bout en bout » ───────────────────


@pytest.mark.parametrize("geste", ["entrer", "refuser", "doublon", "forcer"])
def test_rien_de_l_import_ne_demande_le_fournisseur(client, double, geste):
    """**Prouvé en comptant les appels du double**, pas affirmé."""
    avant = double.appels

    if geste == "entrer":
        _entrer(client, image_sujet(), "epee.png")
    elif geste == "refuser":
        client.post("/api/assets/upload", content=b"pas une image", params={"nom": "x.txt"})
    elif geste == "doublon":
        _entrer(client, image_sujet(), "epee.png")
        _entrer(client, image_sujet(), "epee.png")
    else:
        _entrer(client, image_sujet(), "epee.png")
        _entrer(client, image_sujet(), "epee.png", forcer=True)

    assert double.appels == avant
