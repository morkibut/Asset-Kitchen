# -*- coding: utf-8 -*-
"""RT1 : l'aperçu de « Son allure », calculé sur la machine, et gardé.

`docs/PLAN-retours-du-20-septembre.md` § RT1. Cinq critères d'acceptation,
cinq familles d'essais : le même moteur que la vraie fabrication, le cache qui
évite un second calcul, la méthode « traits épaissis » qui ne tire `torch` que
sur demande, un refus nommé pour une combinaison impossible, et rien qui parte
chez un fournisseur.
"""

from __future__ import annotations

import sys

import pytest

from atelier.domaine.recette import Grille, Quantification, Recette
from atelier.image import traitement
from atelier.services.apercu_allure import ApercuRefuse, ServiceApercuAllure

from tests.test_t2 import CARTES_GRAPHIQUES


# ── Le même moteur que la vraie fabrication ──────────────────────────────────


def test_l_apercu_est_rendu_par_le_meme_moteur_que_la_fabrication(atelier):
    octets = atelier.apercu_allure.apercu(64, "vote", 32)

    # Le calcul de référence : la même recette, le même moteur, appelés
    # directement — sans passer par le service. Si `apercu_allure` empruntait
    # un chemin parallèle, ne serait-ce qu'un réglage par défaut différent, les
    # deux PNG ne seraient plus égaux au caractère près.
    source = atelier.apercu_allure._octets_source()  # noqa: SLF001 — l'essai vérifie l'implémentation, pas la façade
    recette = Recette(grille=Grille(cible=64, methode="vote"), quantification=Quantification(couleurs=32))
    attendu = traitement.appliquer(recette, source).octets

    assert octets == attendu


def test_chaque_methode_de_reduction_rend_ce_que_le_moteur_rend(atelier):
    for methode in ("vote", "lanczos", "proche", "sur_modele", "dominante", "mediane", "lumiere_juste"):
        octets = atelier.apercu_allure.apercu(32, methode, 16)
        source = atelier.apercu_allure._octets_source()  # noqa: SLF001
        recette = Recette(grille=Grille(cible=32, methode=methode), quantification=Quantification(couleurs=16))
        assert octets == traitement.appliquer(recette, source).octets, methode


# ── Le cache : la même combinaison revient du disque, sans recalcul ─────────


def test_la_meme_combinaison_redemandee_revient_du_disque_sans_recalcul(atelier, monkeypatch):
    appels = {"n": 0}
    reel = traitement.appliquer

    def compte(*args, **kwargs):
        appels["n"] += 1
        return reel(*args, **kwargs)

    monkeypatch.setattr(traitement, "appliquer", compte)

    premier = atelier.apercu_allure.apercu(64, "vote", 32)
    assert appels["n"] == 1

    second = atelier.apercu_allure.apercu(64, "vote", 32)
    assert appels["n"] == 1  # aucun second calcul
    assert second == premier


def test_deux_combinaisons_differentes_sont_deux_fichiers_distincts(atelier):
    a = atelier.apercu_allure.apercu(64, "vote", 32)
    b = atelier.apercu_allure.apercu(64, "vote", 16)
    c = atelier.apercu_allure.apercu(32, "vote", 16)
    assert a != b != c

    dossier = atelier.apercu_allure._dossier_courant()  # noqa: SLF001
    noms = sorted(p.name for p in (atelier.fichiers.apercus / dossier).iterdir())
    assert noms == ["32-vote-16.png", "64-vote-16.png", "64-vote-32.png"]


def test_un_atelier_qui_redemarre_relit_le_cache_sans_recalculer(tmp_path, monkeypatch):
    """Le disque, pas la mémoire du processus : un second `Atelier()` sur le
    même dossier doit retrouver le rendu du premier."""
    from atelier.services import Atelier

    un = Atelier(racine=tmp_path)
    un.apercu_allure.apercu(64, "vote", 32)

    deux = Atelier(racine=tmp_path)
    appels = {"n": 0}
    reel = traitement.appliquer

    def compte(*args, **kwargs):
        appels["n"] += 1
        return reel(*args, **kwargs)

    monkeypatch.setattr(traitement, "appliquer", compte)
    deux.apercu_allure.apercu(64, "vote", 32)
    assert appels["n"] == 0


# ── `pixeloe` ne charge jamais `torch` sans qu'on le demande ────────────────


def test_ouvrir_l_atelier_n_importe_aucune_carte_graphique(atelier):
    assert not [nom for nom in CARTES_GRAPHIQUES if nom in sys.modules]


def test_un_apercu_sans_pixeloe_n_importe_toujours_rien(atelier):
    atelier.apercu_allure.apercu(64, "vote", 32)
    atelier.apercu_allure.apercu(64, "lanczos", 32)
    atelier.apercu_allure.apercu(64, "proche", 32)
    assert not [nom for nom in CARTES_GRAPHIQUES if nom in sys.modules]


def test_demander_pixeloe_ne_fait_pas_tomber_les_autres_methodes(atelier):
    """Sur une machine sans `pixeloe` installé (celle du banc), la demande est
    un refus nommé — jamais une erreur nue — et elle n'empêche pas les autres
    méthodes de répondre normalement juste après."""
    if traitement.methode_disponible("pixeloe"):
        pytest.skip("pixeloe est installé sur cette machine — rien à distinguer ici")
    with pytest.raises(ApercuRefuse) as info:
        atelier.apercu_allure.apercu(64, "pixeloe", 32)
    assert "pas install" in info.value.raison

    # Et la méthode qui suit répond comme si de rien n'était.
    assert atelier.apercu_allure.apercu(64, "vote", 32)


# ── Une combinaison impossible : un refus qui la nomme ───────────────────────


def test_couleurs_au_dessus_du_plafond_de_la_taille_est_un_refus_nomme(atelier):
    with pytest.raises(ApercuRefuse) as info:
        atelier.apercu_allure.apercu(8, "vote", 256)
    assert "8" in info.value.raison
    assert "256" in info.value.raison


def test_methode_inconnue_est_un_refus_nomme(atelier):
    with pytest.raises(ApercuRefuse) as info:
        atelier.apercu_allure.apercu(64, "au-hasard", 32)
    assert "au-hasard" in info.value.raison


def test_taille_hors_de_l_echelle_de_l_ecran_est_un_refus_nomme(atelier):
    with pytest.raises(ApercuRefuse):
        atelier.apercu_allure.apercu(100, "vote", 32)


@pytest.mark.parametrize("taille,palier", [(8, 8), (16, 16), (32, 32), (256, 256)])
def test_le_palier_le_plus_haut_d_une_taille_est_accepte(atelier, taille, palier):
    assert atelier.apercu_allure.apercu(taille, "vote", palier)


# ── Rien ne part chez un fournisseur ─────────────────────────────────────────


def test_aucun_appel_ne_part_chez_un_fournisseur(atelier, double):
    avant = double.appels
    atelier.apercu_allure.apercu(64, "vote", 32)
    atelier.apercu_allure.apercu(64, "vote", 32)  # revient du cache
    with pytest.raises(ApercuRefuse):
        atelier.apercu_allure.apercu(8, "vote", 256)
    assert double.appels == avant


# ── La route ──────────────────────────────────────────────────────────────────


def test_la_route_rend_un_png(client):
    reponse = client.get(
        "/api/universe/allure/preview.png",
        params={"taille": 64, "methode": "vote", "couleurs": 32},
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.headers["content-type"] == "image/png"
    assert reponse.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_la_route_refuse_une_combinaison_impossible_sans_image_muette(client):
    reponse = client.get(
        "/api/universe/allure/preview.png",
        params={"taille": 8, "methode": "vote", "couleurs": 256},
    )
    assert reponse.status_code == 400
    corps = reponse.json()
    assert corps["code"] == "apercu_refuse"
    assert "8" in corps["raison"] and "256" in corps["raison"]


def test_la_route_refuse_une_methode_inconnue(client):
    reponse = client.get(
        "/api/universe/allure/preview.png",
        params={"taille": 64, "methode": "au-hasard", "couleurs": 32},
    )
    assert reponse.status_code == 400
    assert reponse.json()["code"] == "apercu_refuse"


def test_la_route_ne_scope_a_aucun_projet(client):
    """Décision d'architecture du plan : l'aperçu se fait toujours sur le
    rôdeur, jamais sur une image de jeu — la route ne demande donc aucun
    identifiant de projet."""
    reponse = client.get(
        "/api/universe/allure/preview.png",
        params={"taille": 64, "methode": "vote", "couleurs": 32},
    )
    assert reponse.status_code == 200
