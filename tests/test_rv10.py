# -*- coding: utf-8 -*-
"""RV10 — un seul compte d'avancement, lu par `comptes`, `bilan_du_jeu` et
`objectif_de`.

Note de décision : `rv10-decision.md`, 21 septembre 2026. Avant la tranche,
cinq lectures du même sujet donnaient cinq chiffres différents (§1 de la
note) : l'accueil comptait des images sous le mot « poses », le Codex ne
regardait que les poses complètes, la fiche ne comptait que les versions
retenues, l'objectif comptait toute version produite, et l'onglet Animations
refaisait son propre total. `avancement()` (`atelier/services/objectifs.py`)
est désormais le seul calcul, lu par les trois chemins serveur.

**Une case (pose × direction) est prête dès qu'une version vivante et
livrable la porte** — pas écartée, sans pièce, et pour une animation pas un
brouillon et avec au moins une image dedans. La retenir n'est pas nécessaire
(E2). Elle est *à départager* dès qu'elle a au moins deux versions vivantes et
aucune retenue.

Aucun essai ne coûte un centime : rien n'est généré, les bandes sont écrites
directement dans le dépôt (le geste de `tests/test_a12.py`).
"""

from __future__ import annotations

from atelier.domaine.objectifs import ObjectifProduction, SortieDemandee
from atelier.services.objectifs import avancement

from tests.test_a12 import _poser_une_bande
from tests.test_b9 import _creer as _creer_sujet
from tests.test_b9 import _plan, _poser


# ── `avancement()`, en direct — les règles une par une (§6 de la note) ──────


def _sortie(nature: str, pose: str, direction: str) -> SortieDemandee:
    return SortieDemandee(nature, pose, direction, 1)


def _version(*, favori=False, supprime_le=None, piece=None, images=(1,), brouillon=False):
    return {
        "favori": favori, "supprime_le": supprime_le, "piece": piece,
        "images": list(images), "brouillon": brouillon,
    }


def test_deux_versions_ne_comptent_qu_une_fois():
    objectif = ObjectifProduction((_sortie("image", "marche", "sud"),))
    contenus = {("image", "marche", "sud"): [_version(), _version()]}
    resultat = avancement(objectif, contenus)
    assert resultat["images"] == {
        "pretes": 1, "demandees": 1, "a_fabriquer": 0, "a_departager": 1,
    }


def test_une_version_non_jugee_compte():
    """Non retenue, mais vivante : c'est assez pour être prête (E2)."""
    objectif = ObjectifProduction((_sortie("image", "marche", "sud"),))
    contenus = {("image", "marche", "sud"): [_version(favori=False)]}
    resultat = avancement(objectif, contenus)
    assert resultat["images"]["pretes"] == 1
    assert resultat["images"]["a_departager"] == 0


def test_une_version_ecartee_ne_compte_pas():
    objectif = ObjectifProduction((_sortie("image", "marche", "sud"),))
    contenus = {("image", "marche", "sud"): [_version(supprime_le=123456.0)]}
    resultat = avancement(objectif, contenus)
    assert resultat["images"] == {
        "pretes": 0, "demandees": 1, "a_fabriquer": 1, "a_departager": 0,
    }


def test_une_bande_vide_ne_compte_pas():
    """Une bande sans une seule image dedans n'anime rien."""
    objectif = ObjectifProduction((_sortie("animation", "marche", "sud"),))
    contenus = {("animation", "marche", "sud"): [_version(images=())]}
    resultat = avancement(objectif, contenus)
    assert resultat["animations"]["pretes"] == 0
    assert resultat["animations"]["a_fabriquer"] == 1


def test_une_bande_brouillon_ne_compte_pas():
    objectif = ObjectifProduction((_sortie("animation", "marche", "sud"),))
    contenus = {("animation", "marche", "sud"): [_version(brouillon=True)]}
    resultat = avancement(objectif, contenus)
    assert resultat["animations"]["pretes"] == 0


def test_une_version_avec_piece_ne_compte_pas():
    """Un calque d'équipement n'est pas un corps — il ne remplit pas la case."""
    objectif = ObjectifProduction((_sortie("image", "marche", "sud"),))
    contenus = {("image", "marche", "sud"): [_version(piece="casque")]}
    resultat = avancement(objectif, contenus)
    assert resultat["images"]["pretes"] == 0


def test_une_sortie_hors_plan_sort_du_total_demande():
    """E12 : `valider_objectif` garde une sortie dont la pose a disparu du
    plan ; `avancement` ne la compte plus dans `demandees`, seulement dans
    `hors_plan`."""
    objectif = ObjectifProduction((
        _sortie("image", "marche", "sud"),
        _sortie("image", "pose-disparue", "sud"),
    ))
    contenus: dict = {}
    resultat = avancement(objectif, contenus, poses={"marche"}, directions={"sud"})
    assert resultat["images"]["demandees"] == 1
    assert resultat["hors_plan"] == 1


def test_les_deux_calques_ne_se_melent_jamais():
    """A12 : deux dénominateurs, jamais un total commun."""
    objectif = ObjectifProduction((
        _sortie("image", "marche", "sud"),
        _sortie("animation", "marche", "sud"),
    ))
    contenus = {("image", "marche", "sud"): [_version(favori=True)]}
    resultat = avancement(objectif, contenus)
    assert resultat["images"]["pretes"] == 1
    assert resultat["animations"]["pretes"] == 0
    assert resultat["complet"] is False  # l'animation manque encore


def test_un_objectif_vide_est_complet_et_hors_plan_nul():
    resultat = avancement(ObjectifProduction(()), {})
    assert resultat["complet"] is True
    assert resultat["hors_plan"] == 0


# ── Le cas Champy, reconstitué en fixture (§8 de la note) ───────────────────
#
# Les données réelles ne sont pas lisibles depuis cet essai ; cette fixture
# reproduit la forme que la note décrit : 4 poses × 6 directions, l'attaque
# animée dans 4 directions avec 2 versions non retenues chacune (à
# départager), le repos couvert seulement en images, et des bandes écartées
# ou vides qui ne doivent pas compter.

_DIRECTIONS = ("nord", "sud", "est", "ouest", "nord-est", "nord-ouest")


def _champy_objectif() -> ObjectifProduction:
    sorties = []
    for pose in ("repos", "marche", "degats", "attaque"):
        for direction in _DIRECTIONS:
            sorties.append(_sortie("image", pose, direction))
            sorties.append(_sortie("animation", pose, direction))
    return ObjectifProduction(tuple(sorties))


def _champy_contenus() -> dict:
    contenus: dict = {}

    # Le repos : couvert en images sur quatre de ses six directions, et
    # animé sur les six (seuls les dégâts manquent encore, plus bas).
    for direction in _DIRECTIONS[:4]:
        contenus[("image", "repos", direction)] = [_version(favori=True)]
    for direction in _DIRECTIONS:
        contenus[("animation", "repos", direction)] = [_version(favori=True)]

    # La marche : animée et prête sur toutes ses directions.
    for direction in _DIRECTIONS:
        contenus[("animation", "marche", direction)] = [_version(favori=True)]

    # L'attaque : deux versions non retenues sur quatre directions (à
    # départager, mais déjà prêtes) ; une version retenue sur les deux
    # dernières.
    for direction in _DIRECTIONS[:4]:
        contenus[("animation", "attaque", direction)] = [_version(), _version()]
    for direction in _DIRECTIONS[4:]:
        contenus[("animation", "attaque", direction)] = [_version(favori=True)]

    # Les dégâts : deux directions animées, quatre à fabriquer — dont une
    # avec une version écartée et une bande vide, qui ne doivent pas compter.
    for direction in _DIRECTIONS[:2]:
        contenus[("animation", "degats", direction)] = [_version(favori=True)]
    contenus[("animation", "degats", _DIRECTIONS[2])] = [
        _version(supprime_le=999.0),
        _version(images=()),
    ]

    return contenus


def test_champy_un_seul_chiffre_partout():
    """Le critère d'acceptation clé de RV10 : `20/24 animations · 4/24 images`."""
    resultat = avancement(_champy_objectif(), _champy_contenus())

    assert resultat["animations"]["demandees"] == 24
    assert resultat["animations"]["pretes"] == 20
    assert resultat["animations"]["a_fabriquer"] == 4
    assert resultat["animations"]["a_departager"] == 4

    assert resultat["images"]["demandees"] == 24
    assert resultat["images"]["pretes"] == 4
    assert resultat["images"]["a_fabriquer"] == 20
    assert resultat["images"]["a_departager"] == 0

    assert resultat["complet"] is False
    assert resultat["hors_plan"] == 0


# ── Le branchement serveur : les trois lecteurs disent le même avancement ───


def test_comptes_bilan_et_objectif_disent_le_meme_avancement_implicite(
    client, atelier, tmp_path
):
    """Un sujet sans objectif écrit : les trois chemins serveur — `comptes`
    (la grille), `bilan_du_jeu` (l'accueil) et `objectif_de` (la fiche et
    l'objectif) — lisent maintenant le même calcul."""
    pelerin = _creer_sujet(client, "Le pèlerin")
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": plan[:2]})
    _poser(client, tmp_path, pelerin, plan[0])
    _poser_une_bande(atelier, pelerin, plan[0])

    projet = atelier.bibliotheque.courant
    sujet = atelier.production.personnage(projet, pelerin)

    via_comptes = atelier.production.comptes(projet, [sujet])[pelerin]
    via_objectif = atelier.production.objectif_de(projet, pelerin)["avancement"]
    bilan = atelier.production.bilan_du_jeu(projet, atelier.generations)
    famille = next(f for f in bilan["familles"] if f["cle"] == "personnages")

    for nature in ("images", "animations"):
        assert via_comptes[nature] == via_objectif[nature], nature
        assert famille[nature] == via_comptes[nature], nature
    assert via_comptes["complet"] == via_objectif["complet"]


def test_comptes_bilan_et_objectif_disent_le_meme_avancement_explicite(
    client, atelier, tmp_path
):
    """Même vérification, pour un sujet à l'objectif explicite — le chemin qui
    passait par `couverture` sans jamais rejoindre le chemin implicite."""
    plan = _plan(client)
    demande = {
        "sorties": [
            {"nature": "image", "pose": plan[0], "direction": ""},
            {"nature": "animation", "pose": plan[0], "direction": ""},
        ],
        "largeur": 64, "hauteur": 64,
    }
    reponse = client.post(
        "/api/characters", json={"nom": "La cavalière", "objectif": demande},
    )
    assert reponse.status_code == 201, reponse.text
    personnage = reponse.json()["personnage"]["identifiant"]
    _poser(client, tmp_path, personnage, plan[0])

    projet = atelier.bibliotheque.courant
    sujet = atelier.production.personnage(projet, personnage)

    via_comptes = atelier.production.comptes(projet, [sujet])[personnage]
    via_objectif = atelier.production.objectif_de(projet, personnage)["avancement"]
    bilan = atelier.production.bilan_du_jeu(projet, atelier.generations)
    famille = next(f for f in bilan["familles"] if f["cle"] == "personnages")

    assert via_comptes["images"] == {
        "pretes": 1, "demandees": 1, "a_fabriquer": 0, "a_departager": 0,
    }
    assert via_comptes["animations"] == {
        "pretes": 0, "demandees": 1, "a_fabriquer": 1, "a_departager": 0,
    }
    for nature in ("images", "animations"):
        assert via_comptes[nature] == via_objectif[nature], nature
        assert famille[nature] == via_comptes[nature], nature
    assert via_comptes["complet"] == via_objectif["complet"] is False
