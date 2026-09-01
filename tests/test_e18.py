# -*- coding: utf-8 -*-
"""Les critères d'acceptation de E18 — les dépenses.

L'écran remplace le journal des appels ratés, qui ne montrait **qu'un cas sur
trois** — et mesuré, celui qui n'a jamais rien coûté. Ce fichier tient la
trichotomie qui le remplace : ce qu'on a gardé, ce qu'on a payé pour rien, ce
qui a été refusé. Deux des sept critères portent sur la mise en page et vivent
dans `interface/src/App.test.tsx` : les deux totaux étiquetés, et le fait que la
liste ne soit pas une grille d'assets.

**Aucun test de ce fichier ne coûte un centime** : le fournisseur est doublé par
`conftest.py`, et les échecs y sont provoqués, pas attendus.
"""

from __future__ import annotations

import time

import pytest

from atelier.domaine.erreurs import AppelRefuse

MODELE = "essai:rend-du-png"


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


def _generer(client, prompt: str = "un tonneau", **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _depenses(client, **params) -> dict:
    reponse = client.get("/api/spending", params=params)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _ligne(depenses: dict, identifiant: str) -> dict:
    for appel in depenses["appels"]:
        if appel["identifiant"] == identifiant:
            return appel
    raise AssertionError(f"l'appel « {identifiant} » ne figure pas dans les dépenses")


# ── « Tous les appels payés se listent du plus récent au plus ancien, avec leur
#     coût et leur résultat » ─────────────────────────────────────────────────


def test_les_appels_se_listent_du_plus_recent_au_plus_ancien(client):
    premier = _generer(client, "un tonneau")
    second = _generer(client, "une lanterne")

    depenses = _depenses(client)
    identifiants = [a["identifiant"] for a in depenses["appels"]]
    assert identifiants[:2] == [second["identifiant"], premier["identifiant"]]

    ligne = _ligne(depenses, premier["identifiant"])
    assert ligne["cout_usd"] > 0
    assert ligne["modele"] == MODELE
    assert ligne["prompt"] == "un tonneau"


# ── « Les trois issues se distinguent : gardé, payé pour rien, refusé » ───────


def test_un_appel_reussi_est_garde(client):
    lance = _generer(client, "un tonneau", variations=2)

    ligne = _ligne(_depenses(client), lance["identifiant"])
    assert (ligne["garde"], ligne["perdu"], ligne["refuse"]) == (2, 0, 0)


def test_un_appel_refuse_sans_frais_n_est_pas_un_appel_perdu(client, double):
    """La distinction que le journal d'avant ne savait pas faire.

    Un refus du fournisseur ne facture rien : l'argent n'est pas perdu, il n'est
    jamais parti. Le mot « raté » les confondait, et c'est cette confusion qui
    faisait dire au journal qu'il expliquait une facture.
    """
    double.echec = AppelRefuse("le fournisseur n'a rendu aucune image")
    lance = _generer(client, "un tonneau")

    ligne = _ligne(_depenses(client), lance["identifiant"])
    assert ligne["cout_usd"] == 0
    assert (ligne["garde"], ligne["perdu"], ligne["refuse"]) == (0, 0, 1)


def test_un_appel_facture_qui_n_a_rien_rendu_est_de_l_argent_perdu(client, double):
    """L'autre moitié de la distinction, et la plus chère.

    Un fournisseur peut facturer et ne rien rendre — mesuré dans ce dépôt. Cet
    argent-là est parti pour rien, et le confondre avec un refus gratuit fait
    dire au total une chose fausse sur ce qui a été gâché.
    """
    double.echec = AppelRefuse("crédit épuisé", consomme=0.011)
    lance = _generer(client, "un tonneau")

    ligne = _ligne(_depenses(client), lance["identifiant"])
    assert ligne["cout_usd"] > 0
    assert (ligne["garde"], ligne["perdu"], ligne["refuse"]) == (0, 1, 0)


# ── « Supprimer une image change l'état de la ligne de son appel, et ne fait
#     jamais disparaître la ligne » ───────────────────────────────────────────


def test_supprimer_une_image_la_fait_passer_de_gardee_a_perdue(client):
    lance = _generer(client, "un tonneau", variations=2)
    identifiant = lance["identifiant"]

    assert _ligne(_depenses(client), identifiant)["garde"] == 2

    supprime = client.post("/api/assets/delete", json={"identifiants": [f"{identifiant}-0"]})
    assert supprime.status_code == 200, supprime.text

    # **L'argent est parti, la ligne reste.** Ce qui change est ce que l'appel a
    # donné : une image de moins à montrer, et le même prix.
    apres = _ligne(_depenses(client), identifiant)
    assert (apres["garde"], apres["perdu"], apres["refuse"]) == (1, 1, 0)
    assert apres["cout_usd"] == _ligne(_depenses(client), identifiant)["cout_usd"]


def test_supprimer_toutes_les_images_ne_fait_pas_disparaitre_l_appel(client):
    lance = _generer(client, "un tonneau")
    identifiant = lance["identifiant"]

    client.post("/api/assets/delete", json={"identifiants": [f"{identifiant}-0"]})

    ligne = _ligne(_depenses(client), identifiant)
    assert ligne["garde"] == 0
    assert ligne["perdu"] == 1
    assert ligne["cout_usd"] > 0


# ── « Le total de l'atelier entier et la part qui n'appartient à aucun jeu se
#     lisent tous les deux » ──────────────────────────────────────────────────


def test_le_total_de_l_atelier_et_la_part_sans_jeu_se_lisent(client):
    """Les onze pour cent qu'aucun écran ne montrait.

    Le total du jeu ouvert vit dans la barre de tête depuis E1 ; ce qui a été
    dépensé **hors de tout jeu** n'était affiché nulle part, et c'est la seule
    chose qu'on vient chercher ici.
    """
    _generer(client, "dans le bac à sable")

    # On sort le projet courant, et ce qui part ensuite n'appartient à personne.
    assert client.put("/api/projects/current", json={"projet": None}).status_code == 200
    _generer(client, "sans aucun jeu ouvert")

    depenses = _depenses(client)
    assert depenses["total_usd"] > 0
    assert depenses["sans_projet_usd"] > 0
    assert depenses["sans_projet_usd"] < depenses["total_usd"]
    # Le total de l'atelier est bien le tout, et non la somme des jeux : c'est
    # exactement l'écart que l'écran existe pour montrer.
    assert depenses["sans_projet_usd"] == pytest.approx(
        depenses["total_usd"]
        - sum(
            a["cout_usd"] for a in depenses["appels"] if a["projet"] is not None
        ),
        abs=1e-6,
    )


# ── « Les appels consécutifs sur un même sujet se repèrent sans lire les
#     horodatages un par un » ────────────────────────────────────────────────


def test_trois_relances_du_meme_sujet_forment_une_rafale(client):
    for _ in range(3):
        _generer(client, "un tonneau cerclé")

    depenses = _depenses(client)
    assert len(depenses["rafales"]) == 1
    rafale = depenses["rafales"][0]
    assert rafale["appels"] == 3
    assert rafale["prompt"] == "un tonneau cerclé"
    assert rafale["cout_usd"] == pytest.approx(
        sum(a["cout_usd"] for a in depenses["appels"] if a["rafale"]), abs=1e-6
    )
    # Chacun des trois porte la marque, et c'est elle que l'écran lit.
    marques = [a for a in depenses["appels"] if a["rafale"] == rafale["identifiant"]]
    assert len(marques) == 3


def test_un_appel_seul_n_est_pas_une_rafale(client):
    _generer(client, "un tonneau")
    _generer(client, "une lanterne")

    depenses = _depenses(client)
    assert depenses["rafales"] == []
    assert all(a["rafale"] is None for a in depenses["appels"])


def test_deux_sujets_differents_coup_sur_coup_ne_se_cousent_pas(client):
    """Consécutifs **et** de même sujet, les deux à la fois.

    Deux intentions lancées l'une après l'autre sont deux intentions ; les
    coudre ferait de la rafale un simple regroupement par horaire, ce qui
    n'apprendrait rien qu'un tri par date ne dise déjà.
    """
    _generer(client, "un tonneau")
    _generer(client, "une lanterne")
    _generer(client, "un tonneau")

    assert _depenses(client)["rafales"] == []
