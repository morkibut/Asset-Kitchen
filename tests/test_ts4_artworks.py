# -*- coding: utf-8 -*-
"""TS4 · La toile part vraiment brute — corrigé le 24 septembre 2026 après
relecture (`docs/PLAN-de-la-toile-au-sujet.md`, blocs TS4 et TS7).

**Le défaut** : un artwork marqué « tous » partait en image avec un appel de
la toile, case « avec le style du jeu » décochée (`repris` + `brut`). Le style
du jeu, retiré du texte, entrait donc par les images ; et « Encore » le
reprenait ensuite comme une carte prise à la main, en image à modifier.

**La règle** (`sans_le_style_du_jeu`) : `brut` et `repris` ensemble, ni
ambiance ni artworks — à la soumission, à l'aperçu et dans « Ce qui part »,
par la même fonction. Case cochée, ou hors de la toile, rien ne change :
`repris` seul ne touche toujours que le texte (R2).

**Rien ne coûte un centime** : le fournisseur est doublé.
"""

from __future__ import annotations

from tests.test_e14 import _ambiance, _carte, _creer, _envoi, _lancer, _regler
from tests.conftest import image_sujet


def _artwork_tous(client, tmp_path) -> str:
    carte = _carte(client, tmp_path, "artwork.png")
    reponse = client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert reponse.status_code == 200, reponse.text
    return carte["identifiant"]


def _parties(generation: dict) -> set[str]:
    return {r["asset"] for r in generation["references"]}


def _annoncees(envoi: dict) -> set[str]:
    return {l["asset"] for l in envoi["images"]["lignes"]}


# ── La toile, case décochée : rien du style ne part ──────────────────────────


def test_la_toile_sans_le_style_n_envoie_pas_l_artwork_tous(client, tmp_path):
    artwork = _artwork_tous(client, tmp_path)

    lancee = _lancer(client, prompt="une lanterne", repris=True, brut=True, echelle="")

    assert lancee["statut"] == "reussie"
    assert artwork not in _parties(lancee)


def test_ce_qui_part_le_dit_avant_de_cliquer(client, tmp_path):
    """**« Ce qui part » dit exactement ce qui part** : la relecture de la
    toile ne l'annonce pas non plus."""
    artwork = _artwork_tous(client, tmp_path)

    envoi = _envoi(client, prompt="une lanterne", repris=True, brut=True)

    assert artwork not in _annoncees(envoi)
    assert envoi["images"]["partent"] == 0


def test_encore_ne_trouve_pas_l_artwork_dans_la_phrase_de_la_carte(client, tmp_path, atelier):
    """La sonde du relecteur, telle quelle : la phrase d'une carte fabriquée
    par la toile ne porte que ce que l'auteur a posé."""
    _artwork_tous(client, tmp_path)
    lancee = _lancer(client, prompt="une lanterne", repris=True, brut=True, echelle="")
    projet = atelier.bibliotheque.courant
    rang = lancee["emplacements"][0]["rang"]
    posee = client.post(
        f"/api/projects/{projet}/board/assets/{lancee['identifiant']}-{rang}"
    ).json()["carte"]

    tableau = client.get("/api/board", params={"projet": projet}).json()
    carte = next(c for c in tableau["cartes"] if c["identifiant"] == posee["identifiant"])

    assert carte["phrase"]["references"] == []


def test_la_toile_sans_le_style_n_envoie_pas_les_images_de_l_ambiance(
    client, double, tmp_path
):
    """L'ambiance suit la même règle — elle n'arrive qu'avec un sujet, qu'un
    appel de la toile n'a pas aujourd'hui, mais la règle ne dépend pas de ça."""
    carte = _carte(client, tmp_path, "marais.png")
    ambiance = _ambiance(client, "Forge", references=[carte["identifiant"]])
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    envoi = _envoi(
        client, prompt="un nain", personnage=chose["identifiant"], repris=True, brut=True
    )
    lancee = _lancer(
        client, prompt="un nain", personnage=chose["identifiant"], repris=True, brut=True
    )

    assert carte["identifiant"] not in _annoncees(envoi)
    assert carte["identifiant"] not in _parties(lancee)


# ── Les autres chemins ne bougent pas ────────────────────────────────────────


def test_case_cochee_le_style_du_jeu_part_toujours(client, tmp_path):
    """« Avec le style du jeu » cochée (`repris` faux) : l'artwork part, et
    la relecture l'annonce — comme avant."""
    artwork = _artwork_tous(client, tmp_path)

    envoi = _envoi(client, prompt="une lanterne", repris=False, brut=True)
    lancee = _lancer(client, prompt="une lanterne", repris=False, brut=True, echelle="")

    assert artwork in _annoncees(envoi)
    assert artwork in _parties(lancee)


def test_repris_seul_ne_touche_que_le_texte(client, tmp_path):
    """Hors de la toile (sans `brut`), un texte repris à la main garde ses
    artworks : `repris` ne décide que du texte (R2, US-159)."""
    artwork = _artwork_tous(client, tmp_path)

    envoi = _envoi(client, prompt="une lanterne", repris=True)
    lancee = _lancer(client, prompt="une lanterne", repris=True)

    assert artwork in _annoncees(envoi)
    assert artwork in _parties(lancee)


def test_une_fabrication_pour_un_sujet_garde_artwork_et_ambiance(
    client, double, tmp_path
):
    artwork = _artwork_tous(client, tmp_path)
    carte = _carte(client, tmp_path, "marais.png")
    ambiance = _ambiance(client, "Forge", references=[carte["identifiant"]])
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    envoi = _envoi(client, prompt="un nain", personnage=chose["identifiant"])
    lancee = _lancer(
        client, prompt="un nain", personnage=chose["identifiant"], pose="repos"
    )

    assert {artwork, carte["identifiant"]} <= _annoncees(envoi)
    assert {artwork, carte["identifiant"]} <= _parties(lancee)
