# -*- coding: utf-8 -*-
"""CM7 — partout où il y a un champ de prompt (`docs/PLAN-assistant.md` § CM7).

Ce que CM3 avait posé sur les deux champs du tiroir des matières se généralise
ici par le composant partagé, côté écran (`ChampPrompt.tsx`, décision 10). Ce
fichier tient la moitié serveur : les quatre entrées que CM7 ajoute à `CHAMPS`
existent, disent chacune un écran et ce qu'elles attendent, et la route les
accepte comme elle acceptait déjà `matiere` et `motif`. La qualité de la
consigne elle-même ne se mesure pas ici (voir `tests/test_cm3_ameliorer.py`).
"""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import AMELIORER, CHAMPS
from atelier.fournisseur.openrouter_texte import OpenRouterTexte
from atelier.services import Atelier

from conftest import AnimateurMuet, FournisseurDouble

CLE_FICTIVE = "essai-1234567890"

# Les quatre entrées que CM7 ajoute — le moins de sortes possible : un seul
# champ pour toute image, un seul pour tout négatif, un seul pour tout clip,
# un seul pour tout son. Une cinquième apparue ici sans raison mesurée serait
# le signe d'un découpage écran par écran, que la décision 10 interdit.
NOUVEAUX = ("prompt_image", "prompt_negatif", "prompt_video", "prompt_son")


class Fil:
    def __init__(self) -> None:
        self.requetes: list[httpx.Request] = []

    def __call__(self, requete: httpx.Request) -> httpx.Response:
        self.requetes.append(requete)
        corps = "data: " + json.dumps(
            {"id": "gen-cm7", "choices": [{"index": 0, "delta": {"content": "stone wall"}}]}
        ) + "\n\ndata: " + json.dumps(
            {"id": "gen-cm7", "choices": [{"index": 0, "delta": {"content": ""}}], "usage": {"cost": 0.00001}}
        ) + "\n\ndata: [DONE]\n\n"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=corps)


def _atelier(tmp_path, fil: Fil) -> Atelier:
    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
        fabrique_texte=lambda: OpenRouterTexte(CLE_FICTIVE, transport=httpx.MockTransport(fil)),
    )


def test_les_quatre_entrees_de_cm7_existent_avec_ecran_libelle_et_attend():
    for cle in NOUVEAUX:
        assert cle in CHAMPS, cle
        entree = CHAMPS[cle]
        assert set(entree) == {"ecran", "libelle", "attend"}
        for mot in entree.values():
            assert mot.strip(), f"{cle} : un morceau vide ne dit rien au modèle"


def test_aucune_sorte_de_plus_que_celles_du_plan():
    """« Le moins de sortes possible » : matiere, motif (CM3), puis les
    quatre de CM7 — pas une de plus."""
    assert set(CHAMPS) == {"matiere", "motif", *NOUVEAUX}


def test_chaque_nouveau_champ_est_accepte_par_la_route(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        for champ in NOUVEAUX:
            reponse = client.post(
                f"/api/assist/{AMELIORER}/preview",
                json={"texte": "un mur de pierre grise", "champ": champ},
            )
            assert reponse.status_code == 200, champ
            vu = reponse.json()
            contexte = next(m["texte"] for m in vu["morceaux"] if m["titre"] == "Le contexte")
            assert f"Champ : « {CHAMPS[champ]['libelle']} »" in contexte, champ
    assert fil.requetes == []  # « Voir ce qui part » ne coûte rien, ici non plus


def test_le_prompt_negatif_n_attend_pas_une_description_positive():
    """Décision notée dans `coup_de_main.py` : un seul champ négatif pour
    l'image et le clip, distinct du champ positif — jamais mélangés, comme
    `matiere`/`motif` en CM3."""
    assert "ne doit pas montrer" in CHAMPS["prompt_negatif"]["attend"]
    assert "positive" in CHAMPS["prompt_negatif"]["attend"].lower()


def test_le_prompt_son_exclut_les_paroles():
    """Décision : les paroles chantées ne passent pas par `ameliorer,
    « améliorer » traduirait un texte qui doit rester dans sa langue pour
    pouvoir être chanté. `prompt_son` le dit dans ce qu'il attend."""
    assert "paroles" in CHAMPS["prompt_son"]["attend"].lower()
