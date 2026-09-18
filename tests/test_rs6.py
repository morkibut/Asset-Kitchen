# -*- coding: utf-8 -*-
"""Les critères de RS6 — la recette du sujet (`docs/PLAN-references-du-sujet.md`).

**Le geste que ça retire, relevé le 18 septembre 2026** : l'auteur ouvrait
chaque image de Champy, une par une, pour lui appliquer « champy 01 ». Le sujet
porte maintenant ce nom, et toute image qui naît pour lui reçoit la recette à
la place de celle du jeu.

**Ce qui se mesure ici, sans un centime** — le double du fournisseur rend ses
images : le champ s'écrit et se relit sans migration ; la route le pose,
l'efface et refuse un nom inconnu ; une génération du sujet naît avec sa
recette, les autres avec celle du jeu ; une image déjà née ne change pas, même
relancée ; la feuille d'une planche refaite garde son seul détourage, ses
morceaux reçoivent la recette du sujet ; et la fiche d'une image dit la même
chose que sa naissance.
"""

from __future__ import annotations

import itertools
import json
import time

from atelier.domaine.personnage import Personnage
from atelier.domaine.projet import IMAGE_SEULE
from atelier.domaine.recette import Grille, Recette
from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"
NOM = "champy 01"

_DISTINCTES = itertools.count(3)


# ── Les montages (ceux de `test_planche_refaite.py`, recopiés) ───────────────


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


def _generer(client, **corps) -> str:
    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "the character holds a staff", **corps},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(60):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return identifiant


def _nommer(atelier, nom: str = NOM) -> Recette:
    """Une recette nommée **qui ne ressemble pas à celle du jeu** : une grille
    de 32 à 80 %, sans détourage ni couleurs — la confondre est impossible."""
    atelier.assets.nommer(
        nom, Recette(grille=Grille(cible=32, occupation=80)), atelier.bibliotheque.courant
    )
    return atelier.assets.recettes()[nom]


def _poser(client, chose: str, recette: str | None):
    return client.put(f"/api/characters/{chose}/recipe", json={"recette": recette})


def _moities(asset) -> list[list[int]]:
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
    return [atelier.assets.lire(d["identifiant"]) for d in reponse.json()["decoupes"]]


# ── Le champ, dans le fichier du sujet ───────────────────────────────────────


def test_un_fichier_d_avant_na_pas_de_recette():
    """**Aucune migration** : la clé absente veut dire « la recette du jeu »."""
    lu = Personnage.depuis_json({"identifiant": "champy", "projet": "p", "nom": "Champy"})
    assert lu.recette == ""
    assert Personnage.depuis_json({**lu.en_json(), "recette": f"  {NOM} "}).recette == NOM


def test_la_route_pose_relit_et_efface_la_recette(client, atelier):
    chose = _creer(client)
    _nommer(atelier)

    posee = _poser(client, chose["identifiant"], NOM)
    assert posee.status_code == 200, posee.text
    assert posee.json()["personnage"]["recette"] == NOM

    # **Écrite dans son fichier**, qui fait foi.
    fichier = (
        atelier.assets._fichiers.projets
        / chose["projet"]
        / "personnages"
        / f"{chose['identifiant']}.json"
    )
    assert json.loads(fichier.read_text(encoding="utf-8"))["recette"] == NOM
    relu = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert relu.recette == NOM

    effacee = _poser(client, chose["identifiant"], None)
    assert effacee.status_code == 200, effacee.text
    assert effacee.json()["personnage"]["recette"] == ""
    assert _poser(client, chose["identifiant"], "").json()["personnage"]["recette"] == ""


def test_une_recette_inconnue_est_refusee_et_rien_ne_sécrit(client, atelier):
    chose = _creer(client)
    _nommer(atelier)
    assert _poser(client, chose["identifiant"], NOM).status_code == 200

    refus = _poser(client, chose["identifiant"], "champy 99")

    assert refus.status_code == 409, refus.text
    assert "champy 99" in refus.text and NOM in refus.text
    relu = atelier.production.personnage(chose["projet"], chose["identifiant"])
    assert relu.recette == NOM


# ── La naissance ─────────────────────────────────────────────────────────────


def test_une_image_du_sujet_nait_avec_sa_recette(client, atelier):
    chose = _creer(client)
    _jeu(client)
    nommee = _nommer(atelier)
    assert _poser(client, chose["identifiant"], NOM).status_code == 200

    generation = _generer(client, personnage=chose["identifiant"])
    asset = atelier.assets.lire(f"{generation}-0")

    assert asset.recette.nom == NOM
    assert asset.recette.grille == nommee.grille
    lue = atelier.generations._base.lire(generation)
    assert asset.recette != atelier.assets.recette_du_projet(lue)

    # **La fiche dit la même chose que la naissance** : aucun faux écart.
    impose = atelier.assets.impose(asset.identifiant)
    assert impose["nature"] == IMAGE_SEULE
    assert impose["impose"] == asset.recette.en_json()


def test_les_autres_images_gardent_la_recette_du_jeu(client, atelier):
    champy = _creer(client)
    autre = _creer(client, "Pommier")
    _jeu(client)
    _nommer(atelier)
    assert _poser(client, champy["identifiant"], NOM).status_code == 200

    for corps in ({}, {"personnage": autre["identifiant"]}):
        generation = _generer(client, **corps)
        asset = atelier.assets.lire(f"{generation}-0")
        lue = atelier.generations._base.lire(generation)
        assert asset.recette == atelier.assets.recette_du_projet(lue), corps
        assert atelier.assets.impose(asset.identifiant)["impose"] == asset.recette.en_json()


def test_une_image_deja_nee_ne_change_pas(client, atelier):
    chose = _creer(client)
    _jeu(client)
    _nommer(atelier)
    generation = _generer(client, personnage=chose["identifiant"])
    identifiant = f"{generation}-0"
    avant = atelier.assets.lire(identifiant).recette

    assert _poser(client, chose["identifiant"], NOM).status_code == 200
    assert atelier.assets.lire(identifiant).recette == avant

    # **Une relance garde la recette posée** (`ancien.recette`), même quand le
    # sujet en a choisi une depuis.
    lue = atelier.generations._base.lire(generation)
    relancee = atelier.assets.naitre(lue, lue.emplacements[0])
    assert relancee is not None and relancee.recette == avant

    # Sans ancien asset, la même relance naît avec la recette du sujet.
    atelier.assets._base.oublier_asset(identifiant)
    renee = atelier.assets.naitre(lue, lue.emplacements[0])
    assert renee is not None and renee.recette.nom == NOM


def test_une_recette_effacee_depuis_retombe_sur_celle_du_jeu(client, atelier):
    chose = _creer(client)
    _jeu(client)
    _nommer(atelier)
    assert _poser(client, chose["identifiant"], NOM).status_code == 200
    atelier.assets.oublier_recette(NOM)

    generation = _generer(client, personnage=chose["identifiant"])
    asset = atelier.assets.lire(f"{generation}-0")
    lue = atelier.generations._base.lire(generation)
    assert asset.recette == atelier.assets.recette_du_projet(lue)


# ── La planche refaite, et ses morceaux ──────────────────────────────────────


def test_la_feuille_refaite_garde_son_detourage_ses_morceaux_la_recette(
    client, atelier, tmp_path
):
    chose = _creer(client)
    _jeu(client)
    nommee = _nommer(atelier)
    assert _poser(client, chose["identifiant"], NOM).status_code == 200
    _ranger(client, chose["identifiant"], _image(client, tmp_path), "planche")

    generation = _generer(
        client, personnage=chose["identifiant"], garder_mise_en_page=True
    )
    feuille = atelier.assets.lire(f"{generation}-0")

    # **Jamais de grille sur la feuille**, même si la recette du sujet en a une.
    assert feuille.recette.grille is None
    assert feuille.recette.nom is None
    assert atelier.assets.impose(feuille.identifiant)["impose"]["grille"] is None

    for morceau in _decouper(client, atelier, feuille.identifiant):
        assert morceau.recette.nom == NOM
        assert morceau.recette.grille == nommee.grille
        assert morceau.epingle is False
        assert atelier.assets.impose(morceau.identifiant)["impose"] == (
            morceau.recette.en_json()
        )


def test_les_morceaux_dune_image_du_sujet_heritent_de_sa_recette(client, atelier):
    """Une planche ordinaire transmet la sienne — qui est déjà celle du sujet."""
    chose = _creer(client)
    _jeu(client)
    _nommer(atelier)
    assert _poser(client, chose["identifiant"], NOM).status_code == 200
    generation = _generer(client, personnage=chose["identifiant"])

    for morceau in _decouper(client, atelier, f"{generation}-0"):
        assert morceau.recette.nom == NOM
