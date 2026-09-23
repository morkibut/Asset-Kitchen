# -*- coding: utf-8 -*-
"""TS8 · La planche entière est la référence — corrigé le 24 septembre 2026
après relecture (`docs/PLAN-de-la-toile-au-sujet.md`, blocs TS8 et TS3).

**Le défaut** : après une première planche, les quatre vues rangées ont leurs
cases et la feuille entière n'en a aucune. Elle tombait donc dans « Pas encore
rangé » — proposée à « Écarter » et « Supprimer » comme une image perdue —,
pendant que le bandeau « C'est la référence » proposait une **vue**.

**Deux côtés, deux règles** :

- le bandeau propose la planche d'une vue, jamais la vue (`ProchainGeste.tsx`,
  essai d'écran dans `PageDuSujet.test.tsx`) ; ici, on vérifie que chaque vue
  porte bien le chemin vers sa feuille, et que la feuille choisie range ses
  quatre vues ;
- une planche dont les vues sont rangées n'attend plus (`en_attente`), avant
  comme après avoir été choisie — la règle des clips dont on a tiré des bandes.

**Rien ne coûte un centime** : le fournisseur est doublé.
"""

from __future__ import annotations

from tests.conftest import planche_sujets
from tests.test_ts3 import _attendre, _generer, _sujet_de_la_toile, _vue


def _premiere_planche(client, double, atelier) -> tuple[str, str]:
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_de_la_toile(client, 14)
    ident = sujet["personnage"]["identifiant"]
    appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    assert appel.status_code == 202, appel.text
    identifiant = appel.json()["identifiant"]
    assert _attendre(client, identifiant)["statut"] == "reussie"
    return ident, f"{identifiant}-0"


def _en_attente(client, ident: str) -> list[str]:
    lue = client.get(f"/api/characters/{ident}/unplaced")
    assert lue.status_code == 200, lue.text
    return [a["identifiant"] for a in lue.json()["images"]]


def _vues(client, ident: str) -> list[dict]:
    perso = next(
        p for p in client.get("/api/characters").json()["personnages"]
        if p["identifiant"] == ident
    )
    return [i for c in perso["cases"] for i in c["images"]]


def test_la_feuille_d_une_premiere_planche_n_attend_pas_d_etre_rangee(client, double, atelier):
    ident, feuille = _premiere_planche(client, double, atelier)

    assert feuille not in _en_attente(client, ident)


def test_chaque_vue_rangee_mene_a_sa_feuille(client, double, atelier):
    """Ce que le bandeau lit pour proposer la feuille et non la vue."""
    ident, feuille = _premiere_planche(client, double, atelier)

    vues = _vues(client, ident)

    assert len(vues) == 4
    assert {v["planche"] for v in vues} == {feuille}


def test_choisir_la_feuille_range_ses_quatre_vues_et_elle_n_attend_toujours_pas(
    client, double, atelier
):
    ident, feuille = _premiere_planche(client, double, atelier)

    choisie = client.put(
        f"/api/characters/{ident}/references/sheet", json={"asset": feuille}
    )

    assert choisie.status_code == 200, choisie.text
    ligne = next(
        l for l in choisie.json()["references"]["lignes"] if l["reference"] == feuille
    )
    assert ligne["usage"] == "planche"
    assert ligne["ordre_des_vues"] == ["sud", "nord", "est", "ouest"]
    assert feuille not in _en_attente(client, ident)


def test_une_feuille_dont_aucune_vue_n_est_plus_rangee_revient_en_attente(
    client, double, atelier
):
    """La règle suit les vues, elle n'efface rien : sorties de leurs cases,
    la feuille redevient quelque chose à ranger."""
    ident, feuille = _premiere_planche(client, double, atelier)
    for vue in _vues(client, ident):
        sortie = client.put(
            f"/api/assets/{vue['identifiant']}/character",
            json={"personnage": ident, "pose": None, "direction": None},
        )
        assert sortie.status_code == 200, sortie.text

    assert feuille in _en_attente(client, ident)


def test_une_image_seule_du_sujet_attend_toujours(client, double, atelier):
    """Le contraste : la copie-portrait née de la toile (TS2), qui ne vient
    d'aucune planche, reste dans « Pas encore rangé »."""
    _vue(client)
    sujet = _sujet_de_la_toile(client, 14)
    ident = sujet["personnage"]["identifiant"]

    assert len(_en_attente(client, ident)) == 1
