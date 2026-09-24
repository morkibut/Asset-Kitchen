# -*- coding: utf-8 -*-
"""TS17 · Choisir un modèle : les habitués d'abord
(`docs/PLAN-de-la-toile-au-sujet.md`).

**Ce que le serveur doit ajouter, et rien de plus** : en tête du catalogue, les
trois modèles gratuits et les trois modèles payants dont l'auteur s'est servi
le plus, comptés sur ses générations passées — tous projets confondus, décision
de la tranche notée dans `atelier/depot/base.py` (`comptes_par_modele`) et
`atelier/services/generation.py` (`ServiceGenerations.habitues`). Le tri est
déterministe : à compte égal, l'ordre du catalogue. Un modèle grisé reste dans
son top — ce calcul-ci ne connaît que le compte, jamais le grisé.

**Aucun essai n'appelle un vrai fournisseur** : le double payant de
`conftest.py` (`essai:rend-du-png`, `essai:rend-du-jpeg`) et le double gratuit
de `test_f1.py` (`gratuit:rend-du-png`, qui compte en jetons) suffisent à
distinguer les deux tops.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import Modele
from atelier.domaine.erreurs import AppelRefuse
from atelier.services import Atelier

from conftest import FournisseurDouble
from test_f1 import GRATUIT, FournisseurGratuit

# **Un troisième double, local — sans réserve déclarée**, comme le vrai
# ComfyUI (`atelier/fournisseur/workflow_image.py`, `compte(self): return
# None`). C'est le piège exact que `ServiceGenerations.habitues` doit éviter :
# sans `modele.locale` tranché en premier, `unite_de` rendrait `None`, traité
# comme de l'argent faute de mieux (`est_argent(None) is True`), et ce
# modèle tomberait dans le top payant plutôt que le gratuit.
LOCAL = "local"

CATALOGUE_LOCAL = [
    Modele(
        identifiant=f"{LOCAL}:rapide",
        nom="Rapide (local)",
        fournisseur=LOCAL,
        chez_lui="rapide",
        references_max=1,
        proportions=("1:1",),
        variations_max=1,
        locale=True,
    ),
]


class FournisseurLocal(FournisseurDouble):
    nom = LOCAL

    async def catalogue(self) -> list[Modele]:
        return list(CATALOGUE_LOCAL)


@pytest.fixture
def local() -> FournisseurLocal:
    return FournisseurLocal()


@pytest.fixture
def client_trois(tmp_path, double, gratuit, local) -> TestClient:
    trois = Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: gratuit, lambda: local],
    )
    with TestClient(creer_application(trois)) as client:
        yield client


@pytest.fixture
def gratuit() -> FournisseurGratuit:
    return FournisseurGratuit()


@pytest.fixture
def deux(tmp_path, double, gratuit) -> Atelier:
    return Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: gratuit],
    )


@pytest.fixture
def client_deux(deux) -> TestClient:
    with TestClient(creer_application(deux)) as client:
        yield client


def _generer(client, modele: str, prompt: str = "un héron", **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": modele, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _attendre(client, identifiant: str, tours: int = 200) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        statuts = {e["statut"] for e in lue["emplacements"]}
        if statuts <= {"reussie", "echouee", "interrompue"}:
            return lue
        time.sleep(0.01)
    return client.get(f"/api/generations/{identifiant}").json()


def _habitues(client_deux) -> dict:
    return client_deux.get("/api/models").json()["habitues"]


def test_sans_historique_les_deux_tops_sont_vides(client_deux):
    """Un atelier tout neuf n'a encore rien compté : les deux listes sont
    vides, et c'est à l'écran de le lire comme « affiche la liste complète »,
    jamais comme des cases à remplir."""
    habitues = _habitues(client_deux)
    assert habitues == {"gratuits": [], "payants": []}


def test_le_compte_separe_gratuit_et_payant(client_deux):
    """`essai:rend-du-png` (payant, compte en argent par défaut) et
    `gratuit:rend-du-png` (jeton, F2) sont deux modèles du même nom chez deux
    fournisseurs différents — exactement le cas que F1 a qualifié. Chacun doit
    tomber dans son propre top."""
    _generer(client_deux, "essai:rend-du-png")
    _generer(client_deux, "gratuit:rend-du-png")

    habitues = _habitues(client_deux)
    assert habitues["payants"] == ["essai:rend-du-png"]
    assert habitues["gratuits"] == [f"{GRATUIT}:rend-du-png"]


def test_le_top_est_borne_a_trois_et_trie_par_compte(client_deux):
    """Trois appels à `rend-du-png`, un seul à `rend-du-jpeg` : le plus
    utilisé passe en tête, et la liste ne dépasse jamais trois entrées — il n'y
    a ici que deux modèles payants, donc le plafond ne se voit pas encore,
    mais l'ordre, lui, doit être exact."""
    for _ in range(3):
        _generer(client_deux, "essai:rend-du-png")
    _generer(client_deux, "essai:rend-du-jpeg")

    habitues = _habitues(client_deux)
    assert habitues["payants"] == ["essai:rend-du-png", "essai:rend-du-jpeg"]


def test_a_compte_egal_l_ordre_du_catalogue_tranche(client_deux):
    """Un appel de chaque : sans mesure pour départager, c'est l'ordre du
    catalogue qui décide — jamais un tirage au sort. `CATALOGUE` de
    `conftest.py` déclare `rend-du-png` avant `rend-du-jpeg`."""
    _generer(client_deux, "essai:rend-du-jpeg")
    _generer(client_deux, "essai:rend-du-png")

    habitues = _habitues(client_deux)
    assert habitues["payants"] == ["essai:rend-du-png", "essai:rend-du-jpeg"]


def test_un_modele_grise_reste_dans_son_top(client_deux, double):
    """La clé du fournisseur payant vient à manquer *après* que l'auteur s'en
    soit servi : le modèle reste dans le top — il ne disparaît pas parce
    qu'il est devenu injoignable —, et sa fiche du catalogue porte le grisé
    avec sa raison, comme partout ailleurs (`AGENTS.md`, point 3 de la
    section « Ce qu'il faut savoir »)."""
    _generer(client_deux, "essai:rend-du-png")
    double.manque = "clé absente"

    reponse = client_deux.get("/api/models").json()
    assert reponse["habitues"]["payants"] == ["essai:rend-du-png"]
    fiche = next(m for m in reponse["modeles"] if m["identifiant"] == "essai:rend-du-png")
    assert fiche["refus"] == "clé absente"


def test_un_modele_local_compte_comme_gratuit_sans_reserve_declaree(client_trois):
    """`AGENTS.md`, point 1 de la section « Ce qu'il faut savoir » : « un
    modèle local compte comme gratuit ». Le double local d'ici ne déclare
    aucune réserve, exactement comme le vrai ComfyUI — c'est ce cas-là, pas
    Pollinations et ses jetons, qui aurait fait échouer un calcul fondé
    seulement sur l'unité."""
    _generer(client_trois, f"{LOCAL}:rapide")

    habitues = client_trois.get("/api/models").json()["habitues"]
    assert habitues["gratuits"] == [f"{LOCAL}:rapide"]
    assert habitues["payants"] == []


def test_seuls_les_appels_reussis_comptent(client_deux, double):
    """Un appel qui échoue ne fait pas un habitué : le double se fait rater
    exprès, et le modèle ne doit paraître dans aucun des deux tops."""
    double.echec = AppelRefuse("panne simulée")
    reponse = client_deux.post(
        "/api/generations", json={"modele": "essai:rend-du-jpeg", "prompt": "un héron"}
    )
    assert reponse.status_code == 202, reponse.text
    _attendre(client_deux, reponse.json()["identifiant"])

    habitues = _habitues(client_deux)
    assert habitues == {"gratuits": [], "payants": []}
