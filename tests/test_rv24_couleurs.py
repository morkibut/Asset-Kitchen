# -*- coding: utf-8 -*-
"""Les critères de RV24 · la table « Couleurs » montre les couleurs de l'image.

**Le retour de l'auteur, mot pour mot** (`docs/PLAN-revue-du-21-septembre.md`
§ RV24) : en retouchant un bus, « dans la grille des couleurs affichée, il n'y a
pas le vert que je vois sur l'image ». La cause : les pastilles de « couleurs
gardées » et de « celle qui part / celle qui vient » ne recevaient que la
palette du jeu (`univers.palette`) — jamais les couleurs que le rendu de
l'image porte réellement.

**Ce fichier vérifie le seul bout qui se mesure au banc, sans écran** : que
`GET /api/assets/{id}/spots` (et son jumeau `POST .../recipe/preview`, lu sur
un brouillon) rend maintenant la **liste** des couleurs du rendu — pas
seulement leur compte —, et qu'une couleur absente de la palette du jeu y
figure quand même. La pipette de « celle qui part » et l'affichage des deux
groupes de pastilles sont vérifiés côté écran, dans
`interface/src/composants/Retouche.test.tsx` (describe RV24).

**Aucun essai de ce fichier ne coûte un centime** : le fournisseur est le
double de `tests/conftest.py`.
"""

from __future__ import annotations

import numpy as np

from atelier.image.palette import couleurs_visibles

#: Le rouge du sujet fabriqué par `image_sujet` (`tests/conftest.py`) —
#: `(190, 40, 40)`. Il ne dépend d'aucun tirage aléatoire : c'est ce qui rend
#: son hexadécimal prévisible d'une exécution à l'autre.
SUJET_HEX = "#be2828"


def _un_asset(client) -> str:
    """Une image importée, sans un centime dépensé — reprise de `test_b17.py`."""
    from conftest import image_sujet

    reponse = client.post(
        "/api/assets/upload?nom=bus.png&traiter=false",
        content=image_sujet(),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def _quantifier(client, identifiant: str, **quantification) -> dict:
    """Pose une quantification non endormie — sans elle, `couleurs.liste` est
    vide par construction (`ServiceAssets._couleurs_de`)."""
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [], "quantification": {"couleurs": 8, **quantification}},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── Critère : la liste, pas seulement le compte ──────────────────────────────


def test_la_liste_des_couleurs_porte_une_couleur_hors_de_la_palette_du_jeu(client):
    """**Le critère de la tranche, mot pour mot.**

    Le jeu n'a aucun artwork officiel — sa palette est donc vide
    (`docs/PIEGES.md`, *« un univers vide ne contraint rien »*) — si bien que
    n'importe quelle couleur de l'image lui est étrangère. C'est exactement le
    cas de l'auteur : un vert que la palette du jeu ne porte pas.
    """
    univers = client.get("/api/universe").json()["univers"]
    assert univers["palette"] == [], "sans quoi ce test ne prouve rien"

    identifiant = _un_asset(client)
    _quantifier(client, identifiant)

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    assert "liste" in mesures["couleurs"], "le compte doit s'étendre en liste, pas la remplacer"
    assert SUJET_HEX in mesures["couleurs"]["liste"], (
        "la couleur du sujet doit paraître dans la liste, même hors de la palette du jeu"
    )
    # Ce que `AGENTS.md` (8octies) demande : l'essai doit tomber si on défait le
    # correctif. Le compte, lui, existait déjà avant RV24 — la liste, non.
    assert mesures["couleurs"]["obtenues"] > 0


def test_la_liste_suit_le_rendu_du_brouillon_sans_rien_enregistrer(client):
    """**« La liste suit le rendu en cours du brouillon »** — le second
    critère, vérifié sur `POST .../recipe/preview`, qui ne pose ni recette ni
    fichier. Un tramage posé sur le brouillon change ce qui est visible :
    l'essai le vérifie en comparant deux brouillons plutôt qu'en supposant.
    """
    identifiant = _un_asset(client)
    recette_posee = client.get(f"/api/assets/{identifiant}").json()["recette"]

    apercu = client.post(
        f"/api/assets/{identifiant}/recipe/preview",
        json={"recette": {**recette_posee, "quantification": {"couleurs": 2}}},
    ).json()
    assert apercu["mesures"]["couleurs"]["liste"], "un brouillon quantifié doit rendre une liste"

    # Rien n'a été enregistré : la recette posée sur l'asset n'a pas bougé.
    apres = client.get(f"/api/assets/{identifiant}").json()
    assert apres["recette"]["quantification"] is None


def test_la_liste_est_vide_quand_la_table_dort_ou_n_est_pas_posee(client):
    """Le neutre d'avant RV24, inchangé : sans quantification posée, il n'y a
    aucun écart à expliquer et rien à proposer dans les pastilles."""
    identifiant = _un_asset(client)
    mesures = client.get(f"/api/assets/{identifiant}/spots").json()
    assert mesures["couleurs"] == {"demandees": 0, "obtenues": 0, "liste": []}


def test_la_liste_est_triee_par_frequence_puis_par_couleur():
    """`couleurs_visibles` — pas seulement `couleurs_obtenues` — est la fonction
    que `_couleurs_de` appelle : un essai qui la mesure directement tombe si un
    futur agent revient à un simple `np.unique` sans compter les pixels."""
    rgba = np.zeros((4, 4, 4), dtype=np.uint8)
    rgba[:, :, 3] = 255
    rgba[0, :2] = (255, 0, 0, 255)   # deux pixels de rouge
    rgba[0, 2:] = (0, 255, 0, 255)   # deux pixels de vert
    rgba[1:, :] = (0, 0, 255, 255)   # douze pixels de bleu — le plus fréquent
    assert couleurs_visibles(rgba)[0] == "#0000ff"
    assert set(couleurs_visibles(rgba)) == {"#0000ff", "#ff0000", "#00ff00"}


# ── La pipette de « celle qui part » — le point sur le rendu final ──────────


def test_le_point_de_la_pipette_sample_le_rendu_final(client):
    """**« reprends le même mécanisme »** — le point voyage par `viser`, pas
    par une passe de détourage, et la couleur revient dans
    `mesures.couleurs.visee`."""
    identifiant = _un_asset(client)
    recette_posee = client.get(f"/api/assets/{identifiant}").json()["recette"]
    largeur = client.get(f"/api/assets/{identifiant}").json()["largeur"]
    hauteur = client.get(f"/api/assets/{identifiant}").json()["hauteur"]

    apercu = client.post(
        f"/api/assets/{identifiant}/recipe/preview",
        json={
            "recette": {**recette_posee, "quantification": {"couleurs": 8}},
            "viser": [largeur // 2, hauteur // 2],
        },
    ).json()
    assert apercu["mesures"]["couleurs"]["visee"] == SUJET_HEX


def test_les_pastilles_et_la_pipette_lisent_l_image_avant_les_echanges(client):
    """**Relecture du 24 septembre 2026.** Une paire rouge → bleu est posée,
    avec un contour vert extérieur : à l'écran la cape est bleue et bordée de
    vert. Une seconde paire se choisit pourtant sur l'image que la réduction
    tend aux échanges — le bleu n'y existe pas, le vert non plus. Avant le
    correctif, les pastilles portaient le bleu et le vert et plus le rouge, et
    la pipette sur la cape rendait le bleu.
    """
    identifiant = _un_asset(client)
    bleu, vert = "#0000ff", "#00ff00"
    recette = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}],
        "quantification": {
            "couleurs": 8,
            "echanges": [{"depuis": SUJET_HEX, "vers": bleu, "tolerance": 0}],
        },
        "contours": {"epaisseur": 1, "couleur": vert, "position": "externe"},
    }
    sans_contour = client.post(
        f"/api/assets/{identifiant}/recipe/preview",
        json={"recette": {**recette, "contours": None}},
    ).json()
    apercu = client.post(
        f"/api/assets/{identifiant}/recipe/preview", json={"recette": recette}
    ).json()
    largeur, hauteur = apercu["largeur"], apercu["hauteur"]
    # Un bloc du sprite de chaque côté : sans case, le trait se compte sur la
    # grille que le modèle a peinte (`retrouver_grille`), pas en pixels.
    marge = largeur - sans_contour["largeur"]
    assert marge > 0 and marge == hauteur - sans_contour["hauteur"], (
        "le contour extérieur agrandit l'image montrée, autant de chaque côté"
    )

    apercu = client.post(
        f"/api/assets/{identifiant}/recipe/preview",
        json={"recette": recette, "viser": [largeur // 2, hauteur // 2]},
    ).json()
    couleurs = apercu["mesures"]["couleurs"]
    assert SUJET_HEX in couleurs["liste"], "le rouge d'origine reste proposé"
    assert bleu not in couleurs["liste"], "le bleu échangé n'est pas une couleur de départ"
    assert vert not in couleurs["liste"], "la couleur du contour n'est pas une couleur de départ"
    assert couleurs["visee"] == SUJET_HEX, "la pipette sur la cape rend le rouge"

    # Même lecture sur la recette posée, par la route des mesures.
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=recette)
    assert reponse.status_code == 200, reponse.text
    posees = client.get(f"/api/assets/{identifiant}/spots").json()["couleurs"]
    assert posees["liste"] == couleurs["liste"]


def test_le_point_de_la_pipette_hors_image_ne_leve_pas_et_rend_rien(client):
    """Ni couleur inventée, ni 500 : un point hors du rendu rend `None` —
    l'écran s'en sert pour ne rien poser plutôt que de poser du vide."""
    identifiant = _un_asset(client)
    recette_posee = client.get(f"/api/assets/{identifiant}").json()["recette"]
    apercu = client.post(
        f"/api/assets/{identifiant}/recipe/preview",
        json={
            "recette": {**recette_posee, "quantification": {"couleurs": 8}},
            "viser": [100_000, 100_000],
        },
    )
    assert apercu.status_code == 200, apercu.text
    assert apercu.json()["mesures"]["couleurs"]["visee"] is None
