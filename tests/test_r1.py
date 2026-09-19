# -*- coding: utf-8 -*-
"""Les critères d'acceptation de R1 — le réglage d'univers se voit à l'instant.

**Une correction, pas une fonctionnalité.** Le réglage était bien écrit sur le
disque ; il ne remontait simplement pas. Deux causes indépendantes pour un seul
symptôme, et c'est ce qui l'a rendu insaisissable — l'une vit ici, l'autre dans
`interface/src/App.test.tsx` :

- le service ne l'annonçait au flux que lorsque l'empreinte de palette bougeait,
  donc « couleurs » se voyait et rien d'autre ;
- l'écran jetait par ailleurs la réponse du PUT au lieu de la poser.

Deux des six critères ne se vérifient pas ici parce qu'ils portent sur ce que
l'écran affiche **après** le réglage — le trou exact par lequel le défaut est
passé. Ceux-là vivent dans `interface/src/App.test.tsx`.

**Aucun test de ce fichier ne coûte un centime**, et l'un le prouve plutôt que
de l'affirmer, en comptant les appels du double avant et après chacun des cinq
réglages.
"""

from __future__ import annotations

import pytest

from atelier.services.univers import UniversRefuse

# ── Les cinq réglages de l'univers, et ce qu'on lit d'eux ────────────────────
#
# Un jeu unique, parcouru par tous les tests du fichier : ce qui compte dans R1
# est **qu'aucun réglage ne soit oublié**, et une liste écrite une fois est le
# seul moyen d'en être sûr. « couleurs » y est parce qu'il est le seul qui se
# voyait — c'est le témoin, pas une exception à traiter à part.

REGLAGES: list[tuple[str, dict, callable]] = [
    (
        "cible_px",
        {"cible_px": 32},
        lambda u: u["cible_px"] == 32,
    ),
    (
        "bible",
        {
            "bible": [
                {"nom": "monde", "texte": "marais de fer", "actif": True},
                {"nom": "epoque", "texte": "", "actif": True},
                {"nom": "trait", "texte": "", "actif": True},
                {"nom": "eclairage", "texte": "", "actif": True},
                {"nom": "technique", "texte": "", "actif": True},
            ]
        },
        lambda u: u["bible"][0]["texte"] == "marais de fer",
    ),
    (
        "bareme",
        {
            "bareme": [
                {
                    "nom": "personnage",
                    "famille": "personnages",
                    "occupation": 80,
                    "silhouette": False,
                }
            ]
        },
        # **La nature écrite est rendue telle quelle** — c'est le critère de R1, et il
        # se lit sur elle, pas sur la longueur de la liste : depuis le 19 septembre 2026,
        # un barème relu reçoit les natures du barème par défaut qui lui manquent
        # (`bareme_complete`, `atelier/domaine/projet.py`). Compter les lignes ferait
        # échouer ce test pour une raison qui n'est pas la sienne.
        lambda u: next(
            (e["occupation"], e["silhouette"])
            for e in u["bareme"]
            if e["nom"] == "personnage"
        )
        == (80, False),
    ),
    (
        "modeles",
        {"modeles": {"personnages": "essai:rend-du-png"}},
        lambda u: u["modeles"].get("personnages") == "essai:rend-du-png",
    ),
    (
        "couleurs",
        {"couleurs": 12},
        lambda u: u["couleurs"] == 12,
    ),
]

IDS = [nom for nom, _, _ in REGLAGES]


def _stabiliser(atelier) -> str:
    """Accorder la palette une fois, et rendre le projet courant.

    **Sans ça, ce fichier passerait sans la correction de R1.** Un projet neuf
    porte une empreinte de palette vide alors que l'empreinte *calculée* d'un
    univers sans artwork ne l'est pas : le tout premier accord recalcule donc
    quoi qu'on règle, et annonce. Le défaut n'apparaît qu'au deuxième réglage —
    exactement ce que la séance d'usage a vécu, et exactement ce qu'un test
    écrit sur un atelier neuf ne verrait pas.
    """
    projet = atelier.bibliotheque.courant
    atelier.univers.palette(projet)
    return projet


def _projet_sur_disque(atelier) -> dict:
    """L'univers tel que `projet.json` le porte — relu du disque, pas de l'index.

    « Les fichiers font foi » : c'est le seul juge acceptable de « ce que le
    fichier du projet porte », et un index qui dirait la même chose ne
    prouverait que lui-même.
    """
    courant = atelier.bibliotheque.courant
    fiches = {p["identifiant"]: p for p in atelier.fichiers.lire_projets()}
    return fiches[courant]["univers"]


# ── « Changer la taille de pixel, la bible, le barème ou un modèle par défaut
#     met l'écran à jour, et la valeur affichée est celle qui vient d'être
#     écrite » ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("nom, corps, tient", REGLAGES, ids=IDS)
def test_la_reponse_du_reglage_porte_deja_la_valeur_ecrite(client, nom, corps, tient):
    """La route rend l'univers **entier**, pas un accusé de réception.

    C'est ce qui permet à l'écran de poser sans relire : la moitié serveur du
    critère est là, et rien d'autre n'est nécessaire pour que l'écran soit à
    jour au retour de l'appel.
    """
    reponse = client.put("/api/universe", json=corps)
    assert reponse.status_code == 200, reponse.text
    assert tient(reponse.json()["univers"])


# ── « Le même changement fait dans un onglet apparaît dans un second onglet
#     ouvert sur le même projet, comme tout ce qui passe par le flux » ──────────


@pytest.mark.parametrize("nom, corps, tient", REGLAGES, ids=IDS)
def test_chaque_reglage_s_annonce_au_flux(client, atelier, nom, corps, tient):
    """**Le défaut de R1, tenu par un test.**

    Avant : `regler_univers` finissait par `_accorder`, qui n'annonce que
    lorsque l'empreinte de palette a changé. Quatre réglages sur cinq ne
    passaient donc jamais par le flux, et un second onglet ne les voyait pas.
    Le cinquième — « couleurs » — passait, et c'est ce qui rendait le défaut
    insaisissable : le symptôme dépendait du réglage qu'on essayait.
    """
    projet = _stabiliser(atelier)
    with atelier.diffusion.abonnement() as file:
        atelier.univers.regler_univers(projet, **corps)
        annonce = file.get_nowait()

    assert annonce.genre == "univers"
    assert annonce.charge["projet"] == projet
    assert tient(annonce.charge["univers"])


def test_un_reglage_ne_s_annonce_qu_une_fois(client, atelier):
    """Un geste, un message — **y compris quand la palette bouge en même temps**.

    « couleurs » périme la palette : le réglage l'annonce, et l'accord qui suit
    ne doit pas l'annoncer une seconde fois. Deux messages pour un geste feraient
    redemander l'état et le catalogue deux fois à chaque onglet ouvert.
    """
    projet = _stabiliser(atelier)
    with atelier.diffusion.abonnement() as file:
        atelier.univers.regler_univers(projet, couleurs=12, cible_px=32)
        annonces = []
        while not file.empty():
            annonces.append(file.get_nowait())

    assert [a.genre for a in annonces] == ["univers"]


# ── « Rouvrir l'écran Univers après un réglage montre la même valeur que le
#     fichier du projet » ──────────────────────────────────────────────────────


@pytest.mark.parametrize("nom, corps, tient", REGLAGES, ids=IDS)
def test_ce_qui_est_rendu_est_ce_que_le_fichier_porte(client, atelier, nom, corps, tient):
    """La réponse, la relecture et le disque disent tous les trois la même chose.

    « Je veux que ce que l'écran affiche soit toujours ce que le fichier porte,
    afin de ne jamais reposer deux fois le même réglage en croyant que le
    premier n'a pas pris » (US-166).
    """
    pose = client.put("/api/universe", json=corps).json()["univers"]
    relu = client.get("/api/universe").json()["univers"]
    disque = _projet_sur_disque(atelier)

    assert tient(pose) and tient(relu) and tient(disque)
    assert relu == pose


# ── « Un réglage refusé laisse l'écran sur la valeur d'avant, avec sa raison —
#     jamais sur la valeur tentée » ────────────────────────────────────────────


@pytest.mark.parametrize(
    "faute, morceau",
    [({"cible_px": 4}, "taille de pixel"), ({"couleurs": 2}, "couleurs")],
)
def test_un_reglage_refuse_n_ecrit_rien_et_dit_pourquoi(client, atelier, faute, morceau):
    """Refusé, **rien** n'est écrit : ni la valeur tentée, ni ce qui l'accompagne.

    Le corps porte deux réglages, dont un seul est fautif, et le bon ne doit pas
    passer en douce : un refus partiel laisserait l'écran et le fichier en
    désaccord — exactement le symptôme que R1 corrige, pris par l'autre bout.
    """
    avant = client.get("/api/universe").json()["univers"]

    reponse = client.put("/api/universe", json={**faute, "bareme": []})
    assert reponse.status_code == 409, reponse.text
    assert morceau in reponse.json()["raison"]

    assert client.get("/api/universe").json()["univers"] == avant
    assert _projet_sur_disque(atelier) == avant


def test_un_reglage_refuse_ne_s_annonce_pas(client, atelier):
    """Rien n'a changé, donc rien n'est annoncé — un flux qui parle pour rien
    ferait redemander l'état et le catalogue à chaque onglet, sans raison."""
    projet = _stabiliser(atelier)
    with atelier.diffusion.abonnement() as file:
        with pytest.raises(UniversRefuse):
            atelier.univers.regler_univers(projet, cible_px=4)
        assert file.empty()


# ── « Aucun appel payant, aucun aller-retour supplémentaire au réglage : ce qui
#     manquait est une annonce et une pose, pas une relecture » ────────────────


def test_regler_l_univers_ne_demande_jamais_le_fournisseur(client, double):
    """Prouvé en comptant les appels du double, avant et après **les cinq**.

    Poser ce qui contraint une image ne coûte rien : c'est la règle de T4, et R1
    n'a aucune raison de la rouvrir. Le réglage gagne une annonce, pas un appel.
    """
    avant = double.appels
    for _, corps, _ in REGLAGES:
        assert client.put("/api/universe", json=corps).status_code == 200
    assert double.appels == avant
