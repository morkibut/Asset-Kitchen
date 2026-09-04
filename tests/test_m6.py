# -*- coding: utf-8 -*-
"""Les critères d'acceptation de M6 — deux images pour une case, et laquelle part.

**La remarque qui l'a ouverte**, le 4 septembre 2026 : *« je ne peux pas retirer
un calque. ici par exemple j'en ai 2 pour la même pose. comment je fait pour
choisir le calque que je sélectionne comme bon […] Ou si je veux supprimer
l'autre ? […] Et en vrai c'est pareil pour les pose de base. »*

**La règle décidait déjà, et personne ne pouvait la voir.** `corps_retenu` — *le
favori d'abord, sinon la plus récente* — existe depuis `C2` et sert la planche
d'équipement, l'export et le calibrage. Ce qui manquait tenait entièrement à
l'écran : la matrice ne disait pas laquelle des deux images gagnait, et n'offrait
pas la marque qui en décide.

**Ces essais tiennent la moitié serveur**, celle sans laquelle l'écran ne peut
pas être juste : la matrice désigne le calque retenu pièce par pièce, avec la
même fonction que l'export, et le favori s'annonce comme tout ce qui change une
image. **Aucun n'appelle le fournisseur** : tout se déduit d'images déjà payées
par le double.
"""

from __future__ import annotations

from conftest import image_sujet
from test_c3 import (
    MODELE,
    _attendre,
    _cases,
    _corps,
    _habiller,
    _personnage,
    _piece,
)


def _case(client, personnage: str, pose: str) -> dict:
    for case in _cases(client, personnage):
        if case["pose"] == pose:
            return case
    raise AssertionError(f"pose {pose} absente de la matrice")  # pragma: no cover


def _monter(client, double, *, poses: int = 2) -> dict:
    """Un nain, ses corps, et **deux casques posés dessus** — donc deux calques
    par pose, ce qui est très exactement le cas que l'auteur a sous les yeux."""
    personnage, plan = _personnage(client, poses)
    corps = _corps(client, double, personnage, plan)
    piece = _piece(client)
    premier = _habiller(client, double, personnage, piece, plan)
    second = _habiller(client, double, personnage, piece, plan)
    assert premier["statut"] == "reussie" and second["statut"] == "reussie"
    return {
        "personnage": personnage,
        "plan": plan,
        "piece": piece,
        "corps": corps,
        "premier": premier,
        "second": second,
    }


# ── « La matrice dit lequel des deux calques part dans le jeu » ──────────────


def test_la_matrice_designe_le_calque_retenu_piece_par_piece(client, double):
    """**Le manque était là**, et il tenait en un champ absent.

    La matrice portait `corps` — le corps que la pose enverrait en planche —
    depuis `C2`, et rien pour les calques : l'écran montrait deux vignettes
    côte à côte sans pouvoir dire laquelle sortirait dans le jeu.
    """
    monte = _monter(client, double)
    case = _case(client, monte["personnage"], monte["plan"][0])

    calques = case["calques"][monte["piece"]]
    assert len(calques) == 2, "deux appels, deux calques dans la même case"
    assert case["retenus"][monte["piece"]] in {c["identifiant"] for c in calques}


def test_le_retenu_par_defaut_est_le_plus_recent(client, double):
    """*Le favori d'abord, sinon la plus récente.* Sans favori, c'est la
    seconde branche qui décide — la même que pour le corps, et la même que
    celle que l'export applique."""
    monte = _monter(client, double)
    case = _case(client, monte["personnage"], monte["plan"][0])

    calques = case["calques"][monte["piece"]]
    plus_recent = max(calques, key=lambda c: (c["cree_le"], c["rang"]))
    assert case["retenus"][monte["piece"]] == plus_recent["identifiant"]


def test_marquer_favori_change_ce_que_la_matrice_designe(client, double):
    """**La marque décide, et elle décide contre la fraîcheur.**

    C'est tout le geste que l'auteur demandait : garder celle-ci plutôt que la
    dernière faite. Sans cet essai, rien ne prouverait que la matrice lit le
    favori — elle aurait pu ne lire que la date et paraître juste tant que
    personne ne marque rien.
    """
    monte = _monter(client, double)
    pose = monte["plan"][0]
    calques = _case(client, monte["personnage"], pose)["calques"][monte["piece"]]
    plus_ancien = min(calques, key=lambda c: (c["cree_le"], c["rang"]))

    client.put(
        "/api/assets/favorite",
        json={"identifiants": [plus_ancien["identifiant"]], "favori": True},
    ).raise_for_status()

    apres = _case(client, monte["personnage"], pose)
    assert apres["retenus"][monte["piece"]] == plus_ancien["identifiant"]


def test_le_retenu_est_celui_que_l_export_sort(client, double, tmp_path):
    """**Une seule règle, lue des deux côtés.** L'écran ne sert à rien s'il
    montre autre chose que ce qui part : c'est la raison pour laquelle la
    désignation est calculée par le serveur et non composée dans la page."""
    monte = _monter(client, double)
    pose = monte["plan"][0]
    calques = _case(client, monte["personnage"], pose)["calques"][monte["piece"]]
    plus_ancien = min(calques, key=lambda c: (c["cree_le"], c["rang"]))

    client.put(
        "/api/assets/favorite",
        json={"identifiants": [plus_ancien["identifiant"]], "favori": True},
    ).raise_for_status()

    dossier = tmp_path / "jeu"
    sortie = client.post(
        f"/api/characters/{monte['personnage']}/export",
        json={"dossier": str(dossier)},
    )
    assert sortie.status_code == 200, sortie.text

    # **Un seul fichier par pièce et par pose** — jamais les deux essais —, et
    # c'est celui que la matrice désignait.
    portant_une_piece = [f for f in sortie.json()["fichiers"] if f.get("piece")]
    assert len(portant_une_piece) == len(monte["plan"])
    assert plus_ancien["identifiant"] in {f["identifiant"] for f in portant_une_piece}


def test_une_case_a_un_seul_calque_le_designe_quand_meme(client, double):
    """**Ce qui se voit n'est pas « il y a un choix »**, c'est *« voici lequel
    part »*. Une case à un calque le désigne donc aussi — c'est l'écran qui
    décide de ne montrer la marque que s'il y a concurrence, et l'écran ne peut
    le décider que si le serveur répond dans les deux cas."""
    personnage, plan = _personnage(client, 1)
    _corps(client, double, personnage, plan)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, plan)

    case = _case(client, personnage, plan[0])
    assert len(case["calques"][piece]) == 1
    assert case["retenus"][piece] == case["calques"][piece][0]["identifiant"]


def test_une_case_sans_calque_ne_designe_rien(client, double):
    """Vide, et non `null` : la matrice ne porte que ce qui existe, et l'écran
    n'a rien à interpréter."""
    personnage, plan = _personnage(client, 1)
    _corps(client, double, personnage, plan)

    assert _case(client, personnage, plan[0])["retenus"] == {}


# ── « Supprimer un calque en désigne un autre, sans rien défaire ailleurs » ──


def test_supprimer_le_retenu_designe_l_autre(client, double):
    """**Rien n'est enregistré, donc rien n'est à remettre d'accord.** Une case
    est pleine parce qu'une image la porte ; jeter le retenu laisse l'autre, et
    la règle redésigne toute seule."""
    monte = _monter(client, double)
    pose = monte["plan"][0]
    case = _case(client, monte["personnage"], pose)
    retenu = case["retenus"][monte["piece"]]
    autre = next(
        c["identifiant"]
        for c in case["calques"][monte["piece"]]
        if c["identifiant"] != retenu
    )

    client.post("/api/assets/delete", json={"identifiants": [retenu]}).raise_for_status()

    apres = _case(client, monte["personnage"], pose)
    assert [c["identifiant"] for c in apres["calques"][monte["piece"]]] == [autre]
    assert apres["retenus"][monte["piece"]] == autre


def test_supprimer_un_calque_ne_touche_pas_les_autres_poses(client, double):
    """**Jamais de cascade**, et c'est la règle du dépôt depuis `T2`. La pose
    voisine garde ses deux calques et son retenu."""
    monte = _monter(client, double, poses=2)
    premiere, seconde = monte["plan"][0], monte["plan"][1]
    case = _case(client, monte["personnage"], premiere)
    avant = _case(client, monte["personnage"], seconde)["retenus"][monte["piece"]]

    client.post(
        "/api/assets/delete",
        json={"identifiants": [case["retenus"][monte["piece"]]]},
    ).raise_for_status()

    apres = _case(client, monte["personnage"], seconde)
    assert len(apres["calques"][monte["piece"]]) == 2
    assert apres["retenus"][monte["piece"]] == avant


# ── « Le favori s'annonce, comme tout ce qui change une image » ──────────────


def test_marquer_favori_s_annonce(client, atelier, double):
    """**Le seul geste de la bibliothèque qui ne prévenait personne.**

    La galerie s'en tirait parce qu'elle se recharge elle-même après l'appel ;
    la fiche du personnage n'a pas ce second chemin — elle écrit et elle reçoit.
    Sans annonce, elle gardait à l'écran un choix que le serveur avait déjà
    changé. Et c'est **cet écran-là** dont le favori décide de ce qui part.
    """
    personnage, plan = _personnage(client, 1)
    corps = _corps(client, double, personnage, plan)
    image = corps[plan[0]]

    with atelier.diffusion.abonnement() as file:
        atelier.bibliotheque.marquer_favori([image], True)
        annonce = file.get_nowait()

    assert annonce is not None


def test_le_corps_retenu_suit_le_favori_lui_aussi(client, double):
    """La remarque disait *« c'est pareil pour les poses de base »*. Le serveur,
    lui, le faisait déjà : cet essai le tient pour que la moitié écran ait de
    quoi s'appuyer, et pour que la règle ne se perde pas au premier remaniement
    de la matrice."""
    personnage, plan = _personnage(client, 1)
    premier = _corps(client, double, personnage, plan)[plan[0]]

    # Une seconde image sur la même pose : sans favori, c'est elle qui gagne.
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    seconde = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "le nain, encore",
            "personnage": personnage,
            "pose": plan[0],
        },
    )
    assert seconde.status_code == 202, seconde.text
    _attendre(client, seconde.json()["identifiant"])
    double.rendre = None

    case = _case(client, personnage, plan[0])
    assert len(case["images"]) == 2
    nee = next(a["identifiant"] for a in case["images"] if a["identifiant"] != premier)
    assert case["corps"] == nee

    client.put(
        "/api/assets/favorite", json={"identifiants": [premier], "favori": True}
    ).raise_for_status()
    assert _case(client, personnage, plan[0])["corps"] == premier
