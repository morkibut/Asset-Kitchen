# -*- coding: utf-8 -*-
"""Le script d'AU13 qui paiera un vrai modèle — vérifié entièrement à blanc.

**Rien ici ne coûte un centime.** Le fournisseur est doublé et son prix forcé à zéro
(`essai_au13_generation_reelle.py` le fait déjà pour son propre mode `--a-blanc` ; ces essais
reprennent le même geste directement sur ses fonctions). Ce qui se vérifie :

1. **L'estimation est une fonction pure** — elle ne monte rien, ne parle à personne, et rend
   toujours la même fourchette pour un même nombre de tirages.
2. **Le lot marche de bout en bout sur un fournisseur doublé** : chaque tirage soumet une vraie
   génération par les routes HTTP du produit, range son asset, découpe un ensemble de tuiles —
   et **le total dépensé mesuré est exactement zéro**, jamais une approximation.
3. **Le mode `--a-blanc` du script**, lancé pour de vrai en sous-processus, rend 0 et n'écrit
   aucune mesure dans `essais/mesures_au13_tuiles.json` — ce fichier est réservé aux tirages
   réels, et un essai à blanc qui s'y mélangerait ferait mentir la mesure suivante.
4. **Sans `--payer` ni `--a-blanc`, rien ne se construit** : le script se contente d'annoncer le
   prix et de sortir en réussite, sans toucher au réseau ni à un dossier de travail.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DEPOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DEPOT / "essais"))
sys.path.insert(0, str(DEPOT / "tests"))

import essai_au13_generation_reelle as essai  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import CATALOGUE, FournisseurDouble  # noqa: E402


def test_estimation_pure_et_croissante():
    huit = essai.estimer_prix(8)
    seize = essai.estimer_prix(16)
    assert huit["tirages"] == 8
    # Bas et haut sont exactement le tarif unitaire multiplié par le nombre de
    # tirages — une estimation qui arrondirait en douce serait invérifiable.
    assert huit["bas_usd"] == pytest.approx(essai.PRIX_BAS_PAR_TIRAGE * 8)
    assert huit["haut_usd"] == pytest.approx(essai.PRIX_HAUT_PAR_TIRAGE * 8)
    assert huit["bas_usd"] < huit["haut_usd"]
    # Le double du nombre de tirages double le prix, dans les deux bornes.
    assert seize["bas_usd"] == pytest.approx(huit["bas_usd"] * 2)
    assert seize["haut_usd"] == pytest.approx(huit["haut_usd"] * 2)


def test_lot_a_blanc_ne_coute_rien(tmp_path):
    double = FournisseurDouble()
    double.couter = lambda demande: 0.0
    atelier = Atelier(racine=tmp_path / "atelier", fabrique_fournisseur=lambda: double)
    modele = CATALOGUE[0].identifiant

    with TestClient(creer_application(atelier)) as client:
        client.post("/api/projects", json={"nom": essai.PROJET})
        mesures = essai.executer_tirages(client, essai.PROJET, 3, modele=modele)

    assert len(mesures) == 3
    assert all(m["statut"] == "reussie" for m in mesures)
    assert all(m["cout_usd"] == 0.0 for m in mesures)
    assert sum(m["cout_usd"] for m in mesures) == 0.0
    # Chaque tirage a bien produit un ensemble de tuiles exploitable, pas
    # seulement une génération réussie — c'est le contrat d'AU13 lui-même.
    identifiants = {m["tileset"] for m in mesures}
    assert all(identifiants)
    assert len(identifiants) == 3, "trois tirages doivent faire trois ensembles distincts"
    assert double.appels == 3


def test_script_a_blanc_en_sous_processus(tmp_path, monkeypatch):
    dossier = tmp_path / "resultats"
    mesures = tmp_path / "mesures.json"
    monkeypatch.setattr(essai, "DOSSIER", dossier)
    monkeypatch.setattr(essai, "MESURES", mesures)

    # Appel direct de la fonction (pas un sous-processus) pour patcher DOSSIER et
    # MESURES sans dépendre d'une variable d'environnement : un sous-processus
    # relancerait le module tel qu'il est écrit sur le disque et ignorerait les
    # patchs de ce test.
    monkeypatch.setattr(sys, "argv", ["essai_au13_generation_reelle.py", "--a-blanc", "--tirages", "1"])
    rendu = essai.principal()

    assert rendu == 0
    assert not mesures.exists(), "un lot à blanc ne doit jamais écrire de mesure réelle"


def test_sans_drapeau_annonce_et_ne_construit_rien(tmp_path, monkeypatch, capsys):
    dossier = tmp_path / "resultats-inutilise"
    monkeypatch.setattr(essai, "DOSSIER", dossier)
    monkeypatch.setattr(sys, "argv", ["essai_au13_generation_reelle.py"])

    rendu = essai.principal()

    assert rendu == 0
    assert not dossier.exists(), "sans --payer ni --a-blanc, aucun dossier de travail ne se crée"
    sortie = capsys.readouterr().out
    assert "ESTIMATION" in sortie
    assert "--payer" in sortie


def test_lancement_reel_en_sous_processus_a_blanc():
    """Le script tel qu'il existe sur le disque, lancé pour de vrai — pas seulement importé."""
    import shutil

    try:
        lance = subprocess.run(
            [sys.executable, str(DEPOT / "essais" / "essai_au13_generation_reelle.py"),
             "--a-blanc", "--tirages", "1"],
            cwd=DEPOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=120,
        )
        assert lance.returncode == 0, lance.stdout + lance.stderr
        assert "Dépensé (doit être nul) : $0.0000" in lance.stdout
    finally:
        # Le dossier de travail d'un vrai lancement n'est jamais versionné
        # (`.gitignore` : `essais/resultats/`) — l'essai le nettoie pour ne pas
        # laisser d'octets d'un tirage à blanc traîner sur le disque du dépôt.
        shutil.rmtree(DEPOT / "essais" / "resultats" / "au13-generation-reelle", ignore_errors=True)
