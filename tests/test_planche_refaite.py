# -*- coding: utf-8 -*-
"""La planche refaite ne se pixellise pas d'un seul tenant (RS2, suite).

**La panne, signalée par l'auteur le 18 septembre 2026.** Une image fixe qui
« refait une planche » rend UNE image où vivent quatre Champy en 2 × 2 sur
1024 px. Elle naissait comme une image seule, avec la recette complète du
projet : la grille du jeu (96 px) s'appliquait à la feuille entière, et l'on
recevait quatre Champy minuscules et sur-pixellisés.

**Ce qui se mesure ici, sans un centime** — le double du fournisseur rend ses
images : la feuille naît avec son seul détourage, par la génération, la relance
et le rattrapage ; une image ordinaire garde sa grille ; les morceaux d'une
feuille refaite reçoivent la recette d'un morceau de planche, grille comprise ;
ceux d'une image ordinaire héritent comme avant ; et « Tout réaligner » ne
repose pas la grille sur la feuille.
"""

from __future__ import annotations

import itertools
import time

from atelier.domaine.projet import IMAGE_SEULE, PLANCHE
from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"

_DISTINCTES = itertools.count(3)


# ── Les montages (ceux de `test_rs2.py`, recopiés : l'auteur y travaille) ────


def _creer(client, nom: str = "Champy") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _jeu(client) -> None:
    reponse = client.put(
        "/api/universe", json={"vue": "vue-dessus-34", "fond": "#FF70B5"}
    )
    assert reponse.status_code == 200, reponse.text


def _image(client, tmp_path) -> str:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"planche-{rang}-{next(_DISTINCTES)}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    return reponse.json()["asset"]["identifiant"]


def _ranger(client, chose: str, asset: str, usage: str) -> None:
    reponse = client.put(
        f"/api/characters/{chose}/references", json={"asset": asset, "usage": usage}
    )
    assert reponse.status_code == 200, reponse.text


def _generer(client, **corps):
    return client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "the character holds a staff", **corps},
    )


def _attendre(client, identifiant: str, tours: int = 60) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


def _feuille_refaite(client, tmp_path) -> str:
    """Une planche refaite, arrivée : l'identifiant de sa génération."""
    chose = _creer(client)
    _jeu(client)
    _ranger(client, chose["identifiant"], _image(client, tmp_path), "planche")
    reponse = _generer(
        client, personnage=chose["identifiant"], garder_mise_en_page=True
    )
    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert generation["demande"]["garder_mise_en_page"] is True
    assert _attendre(client, generation["identifiant"])["statut"] == "reussie"
    return generation["identifiant"]


def _image_ordinaire(client) -> str:
    _jeu(client)
    reponse = _generer(client)
    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert "garder_mise_en_page" not in generation["demande"]
    assert _attendre(client, generation["identifiant"])["statut"] == "reussie"
    return generation["identifiant"]


def _moities(asset) -> list[list[int]]:
    """Deux rectangles, gauche et droite : la découpe ne se devine pas ici."""
    milieu = asset.largeur // 2
    return [
        [0, 0, milieu - 1, asset.hauteur - 1],
        [milieu, 0, asset.largeur - 1, asset.hauteur - 1],
    ]


def _decouper(client, atelier, identifiant: str) -> list:
    planche = atelier.assets.lire(identifiant)
    reponse = client.post(
        f"/api/assets/{identifiant}/slices", json={"boites": _moities(planche)}
    )
    assert reponse.status_code == 200, reponse.text
    decoupes = reponse.json()["decoupes"]
    assert len(decoupes) == 2
    return [atelier.assets.lire(d["identifiant"]) for d in decoupes]


# ── La feuille ───────────────────────────────────────────────────────────────


def test_la_feuille_refaite_nait_sans_grille_ni_recadrage_ni_couleurs(
    client, atelier, tmp_path
):
    generation = _feuille_refaite(client, tmp_path)
    feuille = atelier.assets.lire(f"{generation}-0")

    recette = feuille.recette
    assert recette.grille is None
    assert recette.recadrage is None
    assert recette.quantification is None
    # **Le détourage reste**, et c'est celui d'une image seule.
    lue = atelier.generations._base.lire(generation)
    assert recette.passes
    assert recette.passes == atelier.assets.recette_du_projet(lue, IMAGE_SEULE).passes
    # Le projet, lui, imposait bien une grille : c'est la feuille qui l'écarte.
    assert atelier.assets.recette_du_projet(lue).grille is not None

    # **La fiche dit la même chose que la naissance** : sinon elle montrerait
    # un écart à « ce que le projet impose » que l'auteur n'a jamais créé.
    impose = atelier.assets.impose(feuille.identifiant)
    assert impose["impose"]["grille"] is None
    assert impose["nature"] == IMAGE_SEULE


def test_une_image_ordinaire_garde_sa_grille(client, atelier):
    generation = _image_ordinaire(client)
    asset = atelier.assets.lire(f"{generation}-0")

    lue = atelier.generations._base.lire(generation)
    assert asset.recette.grille is not None
    assert asset.recette == atelier.assets.recette_du_projet(lue)
    assert atelier.assets.impose(asset.identifiant)["impose"]["grille"] is not None


def test_le_rattrapage_fait_renaitre_la_feuille_sans_grille(
    client, atelier, tmp_path
):
    """L'index effacé qu'on reconstruit : la feuille repasse par `naitre`."""
    generation = _feuille_refaite(client, tmp_path)
    identifiant = f"{generation}-0"
    atelier.assets._base.oublier_asset(identifiant)
    assert atelier.assets._base.lire_asset(identifiant) is None

    lue = atelier.generations._base.lire(generation)
    assert atelier.assets.rattraper([lue]) == 1
    assert atelier.assets.lire(identifiant).recette.grille is None


def test_une_relance_sans_asset_fait_naitre_la_feuille_sans_grille(
    client, atelier, tmp_path
):
    """Une relance repasse par `naitre` : sans ancien asset, la règle joue."""
    generation = _feuille_refaite(client, tmp_path)
    identifiant = f"{generation}-0"
    atelier.assets._base.oublier_asset(identifiant)

    lue = atelier.generations._base.lire(generation)
    asset = atelier.assets.naitre(lue, lue.emplacements[0])
    assert asset is not None and asset.recette.grille is None


def test_tout_realigner_ne_repose_pas_la_grille_sur_la_feuille(
    client, atelier, tmp_path
):
    generation = _feuille_refaite(client, tmp_path)
    feuille = atelier.assets.lire(f"{generation}-0")
    atelier.univers.realigner(feuille.projet)
    assert atelier.assets.lire(feuille.identifiant).recette.grille is None
    # Même demandé nommément : comme un calque, elle n'est pas une image que
    # le projet met sur sa grille.
    atelier.univers.realigner(feuille.projet, identifiants=[feuille.identifiant])
    assert atelier.assets.lire(feuille.identifiant).recette.grille is None


# ── Ses morceaux ─────────────────────────────────────────────────────────────


def test_les_morceaux_dune_feuille_refaite_recoivent_la_recette_de_planche(
    client, atelier, tmp_path
):
    generation = _feuille_refaite(client, tmp_path)
    morceaux = _decouper(client, atelier, f"{generation}-0")

    lue = atelier.generations._base.lire(generation)
    attendue = atelier.assets.recette_du_projet(lue, PLANCHE)
    assert attendue.grille is not None
    for morceau in morceaux:
        assert morceau.recette == attendue
        assert morceau.epingle is False
        # La fiche d'un morceau parle d'un morceau de planche.
        impose = atelier.assets.impose(morceau.identifiant)
        assert impose["nature"] == PLANCHE
        assert impose["impose"]["grille"] is not None


def test_les_morceaux_dune_image_ordinaire_heritent_comme_avant(client, atelier):
    generation = _image_ordinaire(client)
    identifiant = f"{generation}-0"
    planche = atelier.assets.lire(identifiant)
    morceaux = _decouper(client, atelier, identifiant)

    for morceau in morceaux:
        assert morceau.recette == planche.recette
        assert morceau.epingle == planche.epingle


def test_un_morceau_redecoupe_herite_de_son_morceau(client, atelier, tmp_path):
    """Seule la feuille est une planche refaite : un morceau qu'on redécoupe
    vit dans la même génération, mais il hérite comme n'importe quelle image."""
    generation = _feuille_refaite(client, tmp_path)
    morceau = _decouper(client, atelier, f"{generation}-0")[0]
    morceau.recette = atelier.assets.recette_du_projet(
        atelier.generations._base.lire(generation), IMAGE_SEULE
    )
    atelier.assets.sauver(morceau, annoncer=False)

    for sous_morceau in _decouper(client, atelier, morceau.identifiant):
        assert sous_morceau.recette == morceau.recette
