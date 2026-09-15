# -*- coding: utf-8 -*-
"""RP19 · L'image de référence d'une fiche se choisit — la moitié serveur.

La fiche d'un sujet montre une image en grand, en haut. Elle était choisie par
le produit, et l'auteur n'avait pas la main dessus. Ce que la tranche pose est
**un champ sur le sujet** — l'identifiant d'une de ses images fixes —, une route
pour le poser et le retirer, et un repli qui tient tout seul.

**Ce qui se vérifie ici**, et pourquoi chacun :

- la pose et le retrait, parce que le choix doit survivre à la fermeture : il
  s'écrit dans le fichier du sujet, et *les fichiers font foi* (`T3`) ;
- le refus d'une image étrangère, avec sa raison — le produit ne garde jamais
  ce qu'il ne saura pas montrer ;
- le repli après suppression, qui est le cœur du critère : une référence qui ne
  désigne plus rien ne casse rien, la fiche reprend le choix du produit ;
- la survie à la réindexation, parce que l'index est jetable et qu'un champ
  qu'il perdrait disparaîtrait au premier effacement de `atelier.sqlite3` ;
- ce que l'agent lit — et ce qu'il ne peut pas écrire.

**Rien ne coûte un centime, et rien ne sort de la machine** : on importe des
images du disque, on les range dans des cases, et le fournisseur n'est jamais
appelé.
"""

from __future__ import annotations

import itertools

from tests.conftest import image_sujet

# **Les deux crochets du serveur MCP, empruntés aux essais de T7** — le
# `noqa` dit à qui relit que l'import « inutilisé » est le mécanisme : une
# fixture doit être visible dans le module de l'essai (`docs/PIEGES.md`).
from tests.test_t7 import appeler, mcp  # noqa: F401

_DISTINCTES = itertools.count()


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _creer(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _importer(client, tmp_path, nom: str = "image") -> str:
    """Une image du disque qui entre en bibliothèque. Chacune est distincte —
    le double rendrait sinon la même empreinte, donc un doublon proposé."""
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{nom}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    return reponse.json()["asset"]["identifiant"]


def _ranger(client, asset: str, personnage: str, pose: str = "repos") -> str:
    reponse = client.put(
        f"/api/assets/{asset}/character", json={"personnage": personnage, "pose": pose}
    )
    assert reponse.status_code == 200, reponse.text
    return asset


def _image_du_sujet(client, tmp_path, personnage: str, pose: str = "repos") -> str:
    return _ranger(client, _importer(client, tmp_path, personnage), personnage, pose)


def _poser(client, personnage: str, asset: str | None):
    return client.put(
        f"/api/characters/{personnage}/reference-image", json={"asset": asset}
    )


def _lire(client, personnage: str) -> dict:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    for un in reponse.json()["personnages"]:
        if un["identifiant"] == personnage:
            return un
    raise AssertionError(f"« {personnage} » n'est pas dans la liste")


# ── 1. Le champ, posé et retiré ──────────────────────────────────────────────


def test_un_sujet_neuf_n_a_aucune_image_de_reference(client):
    """**Absente par défaut.** Une chose neuve n'a rien choisi, et la fiche
    retombe sur le choix du produit — ce qu'elle montrait avant la tranche."""
    pelerin = _creer(client)
    assert _lire(client, pelerin)["image_de_reference"] == ""


def test_le_choix_s_ecrit_sur_le_sujet_et_se_retire(client, tmp_path):
    pelerin = _creer(client)
    image = _image_du_sujet(client, tmp_path, pelerin)

    pose = _poser(client, pelerin, image)
    assert pose.status_code == 200, pose.text
    assert pose.json()["personnage"]["image_de_reference"] == image
    assert pose.json()["image_de_reference"] == image
    assert _lire(client, pelerin)["image_de_reference"] == image

    retrait = _poser(client, pelerin, None)
    assert retrait.status_code == 200, retrait.text
    assert retrait.json()["personnage"]["image_de_reference"] == ""
    assert _lire(client, pelerin)["image_de_reference"] == ""


def test_le_choix_est_ecrit_dans_le_fichier_du_sujet(client, atelier, tmp_path):
    """**Les fichiers font foi** (`T3`), et c'est ce qui fait que le choix
    survit à la fermeture du jeu. L'index n'est pas interrogé ici : on relit le
    JSON du dossier du sujet, octet pour octet."""
    pelerin = _creer(client)
    image = _image_du_sujet(client, tmp_path, pelerin)
    assert _poser(client, pelerin, image).status_code == 200

    projet = atelier.bibliotheque.courant
    sur_le_disque = {
        contenu["identifiant"]: contenu
        for contenu in atelier.fichiers.parcourir_personnages(projet)
    }
    assert sur_le_disque[pelerin]["image_de_reference"] == image


def test_choisir_ne_promeut_ni_ne_retient_ni_n_appelle_personne(
    client, atelier, tmp_path, double
):
    """**Un portrait, et rien d'autre.** Ni l'artwork officiel d'un jeu — qui
    sert la palette et part avec les demandes —, ni l'image retenue d'une case
    — qui part dans le jeu. Et le réseau n'est jamais touché."""
    pelerin = _creer(client)
    image = _image_du_sujet(client, tmp_path, pelerin)
    appels = double.appels

    assert _poser(client, pelerin, image).status_code == 200

    sujet = _lire(client, pelerin)
    assert sujet["references"] == []  # aucune référence permanente promue
    assert atelier.assets.lire(image).favori is False  # aucune case retenue
    assert double.appels == appels  # aucun appel au fournisseur


# ── 2. Ce que le produit refuse, et il le dit ────────────────────────────────


def test_une_image_d_un_autre_sujet_est_refusee_avec_sa_raison(client, tmp_path):
    pelerin = _creer(client)
    goliath = _creer(client, "Le goliath")
    sienne = _image_du_sujet(client, tmp_path, goliath)

    refus = _poser(client, pelerin, sienne)
    assert refus.status_code == 409, refus.text
    assert "image fixe" in refus.json()["raison"]
    assert _lire(client, pelerin)["image_de_reference"] == ""


def test_une_image_qui_n_est_a_personne_est_refusee(client, tmp_path):
    """Importée et jamais rangée : elle n'est l'image fixe d'aucun sujet."""
    pelerin = _creer(client)
    orpheline = _importer(client, tmp_path)

    refus = _poser(client, pelerin, orpheline)
    assert refus.status_code == 409, refus.text


def test_un_calque_est_refuse_parce_que_ce_n_est_pas_une_image_du_sujet(
    client, atelier, tmp_path
):
    """**Un calque est une différence posée sur une image**, pas une image du
    sujet. Le geste de la case le refuse déjà pour la même raison."""
    pelerin = _creer(client)
    calque = _image_du_sujet(client, tmp_path, pelerin)
    objet = atelier.assets.lire(calque)
    objet.piece = "casque"
    atelier.assets.sauver(objet)

    refus = _poser(client, pelerin, calque)
    assert refus.status_code == 409, refus.text
    assert "calque" in refus.json()["raison"]


def test_une_image_inconnue_est_refusee_sans_rien_ecrire(client):
    pelerin = _creer(client)
    refus = _poser(client, pelerin, "personne-ne-porte-ce-nom")
    assert refus.status_code >= 400, refus.text
    assert _lire(client, pelerin)["image_de_reference"] == ""


# ── 3. Le repli — le cœur du critère ─────────────────────────────────────────


def test_supprimer_l_image_de_reference_ramene_au_choix_du_produit(
    client, atelier, tmp_path
):
    """**Sans message d'erreur, et sans rien demander.**

    On pose la seconde image du sujet en référence, on l'écarte, et la fiche
    doit reprendre ce qu'elle montrait avant : le corps retenu de la première
    case faite. Le champ, lui, garde son identifiant — ce n'est pas un trou à
    réparer, c'est un choix qui ne désigne plus rien.
    """
    pelerin = _creer(client)
    premiere = _image_du_sujet(client, tmp_path, pelerin)
    seconde = _image_du_sujet(client, tmp_path, pelerin)
    assert _poser(client, pelerin, seconde).status_code == 200

    projet = atelier.bibliotheque.courant
    sujet = atelier.production.personnage(projet, pelerin)
    assert atelier.production.image_de_reference(projet, sujet) == seconde

    efface = client.post("/api/assets/delete", json={"identifiants": [seconde]})
    assert efface.status_code == 200, efface.text

    sujet = atelier.production.personnage(projet, pelerin)
    assert atelier.production.image_de_reference(projet, sujet) == premiere
    # Le sujet se relit sans erreur, et la fiche continue de se dessiner.
    assert _lire(client, pelerin)["image_de_reference"] == seconde


def test_sans_aucune_image_le_repli_ne_designe_rien_et_ne_leve_rien(client, atelier):
    pelerin = _creer(client)
    projet = atelier.bibliotheque.courant
    sujet = atelier.production.personnage(projet, pelerin)
    assert atelier.production.image_de_reference(projet, sujet) == ""


# ── 4. L'index est jetable, le choix ne l'est pas ────────────────────────────


def test_le_choix_survit_a_la_reindexation(client, tmp_path):
    """**La base est un index reconstructible** (`T3`). On l'efface et on le
    refait depuis `donnees/` : le champ doit repasser par le fichier."""
    pelerin = _creer(client)
    image = _image_du_sujet(client, tmp_path, pelerin)
    assert _poser(client, pelerin, image).status_code == 200

    refaite = client.post("/api/library/rebuild")
    assert refaite.status_code == 200, refaite.text

    assert _lire(client, pelerin)["image_de_reference"] == image
    # Et l'index lui-même le porte : la recherche de sujets lit la table, pas
    # le disque, et un champ perdu par `enregistrer_personnage` se verrait ici.
    cherche = client.get("/api/characters/search", params={"q": "pèlerin"})
    assert cherche.status_code == 200, cherche.text
    trouves = {p["identifiant"]: p for p in cherche.json()["personnages"]}
    assert trouves[pelerin]["image_de_reference"] == image


# ── 5. L'agent lit, et ne choisit pas ────────────────────────────────────────


async def test_l_agent_lit_l_image_de_reference_d_un_sujet(client, mcp, tmp_path):
    """Le casting que l'agent lit porte le portrait de chaque sujet, **résolu**
    — le choix de l'auteur, sinon le repli du produit."""
    pelerin = _creer(client)
    premiere = _image_du_sujet(client, tmp_path, pelerin)
    seconde = _image_du_sujet(client, tmp_path, pelerin, pose="marche")
    assert _poser(client, pelerin, seconde).status_code == 200

    sujets = {c["id"]: c for c in (await appeler(mcp, "list_characters"))["characters"]}
    assert sujets[pelerin]["reference_image"] == seconde

    assert _poser(client, pelerin, None).status_code == 200
    sujets = {c["id"]: c for c in (await appeler(mcp, "list_characters"))["characters"]}
    assert sujets[pelerin]["reference_image"] == premiere


async def test_aucun_outil_de_l_agent_ne_choisit_l_image_de_reference(mcp):
    """**C'est écrit dans le critère** : l'agent lit le portrait, il ne le
    choisit pas. Un sujet ressemble à ce que l'auteur dit qu'il est, et une
    ressemblance n'est pas une décision d'agent."""
    noms = {outil.name for outil in await mcp.list_tools()}
    assert "list_characters" in noms
    assert not [n for n in noms if "reference" in n or "portrait" in n]
