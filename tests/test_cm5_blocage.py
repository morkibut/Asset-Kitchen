# -*- coding: utf-8 -*-
"""CM5 — expliquer ce qui bloque (`docs/PLAN-assistant.md` § CM5).

Ce que ce fichier tient côté serveur — l'écran a le sien
(`interface/src/composants/pieces.test.tsx`) :

- le métier « blocage » reprend **exactement** le contexte monté par CM4
  (`contexte_instant`), avec `blocage` rempli — la raison courte, encadrée,
  est aussi ce qui part comme « texte » (§ CM5, « reprend le contexte monté
  par CM4 et l'envoie à une consigne de plus ») ;
- la consigne ne répète ni ne contredit la raison courte, nomme les gestes du
  produit et jamais ses fichiers ni ses routes, et n'invente jamais une
  cause — elle répond exactement « je ne sais pas », comme « question »,
  quand le contexte ne suffit pas ;
- sans raison courte (`blocage`), rien ne part : il n'y a rien à développer ;
- « Voir ce qui part » montre exactement ce qui part.

**La qualité de la consigne ne se mesure pas ici** : le fournisseur est
doublé, comme CM1, CM3 et CM4. Aucun appel payé.
"""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import (
    BLOCAGE,
    CADRE,
    CONSIGNE_BLOCAGE,
    ECRANS,
    JE_NE_SAIS_PAS,
    QUESTION,
    SIGNES_MAX,
)
from atelier.fournisseur.openrouter_texte import OpenRouterTexte
from atelier.services import Atelier

from conftest import AnimateurMuet, FournisseurDouble

CLE_FICTIVE = "essai-1234567890"
ECRAN = "envoi"
RAISON = "plafond du mois atteint ($1,00) — il se relève dans Réglages › Consommations"


def _morceau(texte: str, *, cout: float | None = None) -> str:
    brut: dict = {"id": "gen-cm5", "choices": [{"index": 0, "delta": {"content": texte}}]}
    if cout is not None:
        brut["usage"] = {"cost": cout}
    return "data: " + json.dumps(brut) + "\n\n"


class Fil:
    """Le transport doublé : il garde ce qui est parti, et rend une réponse fixe."""

    def __init__(self, reponse: str = "Le plafond se relève dans Réglages.") -> None:
        self.requetes: list[httpx.Request] = []
        self._reponse = reponse

    def __call__(self, requete: httpx.Request) -> httpx.Response:
        self.requetes.append(requete)
        corps = "".join(
            [_morceau(self._reponse), _morceau("", cout=0.00001), "data: [DONE]\n\n"]
        )
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=corps)

    def corps(self, rang: int = 0) -> dict:
        return json.loads(self.requetes[rang].content)


def _atelier(tmp_path, fil: Fil) -> Atelier:
    double = FournisseurDouble()
    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
        fabrique_texte=lambda: OpenRouterTexte(CLE_FICTIVE, transport=httpx.MockTransport(fil)),
    )


# ── Ce qui part ──────────────────────────────────────────────────────────────


def test_ce_qui_part_reprend_lecran_et_la_raison_courte(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(
            f"/api/assist/{BLOCAGE}",
            json={"texte": RAISON, "ecran": ECRAN, "champ": "Envoyer", "blocage": RAISON},
        )
    lignes = [json.loads(l) for l in reponse.text.splitlines()]
    assert [l["genre"] for l in lignes] == ["texte", "fin"]

    corps = fil.corps()
    systeme, message = corps["messages"]

    # La consigne du dépôt, puis la fiche du produit.
    assert systeme["content"].startswith(CONSIGNE_BLOCAGE)

    # Le contexte : l'écran, le geste regardé, ce qui bloque.
    assert f"Écran : {ECRANS[ECRAN]}." in message["content"]
    assert "Champ regardé : « Envoyer »." in message["content"]
    assert f"Ce qui bloque : {RAISON}" in message["content"]

    # La raison courte, encadrée, à la fin — exactement ce que l'écran montre.
    assert message["content"].endswith(f"{CADRE}\n{RAISON}\n{CADRE}")


def test_voir_ce_qui_part_est_ce_qui_part_et_n_envoie_rien(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    corps = {"texte": RAISON, "ecran": ECRAN, "blocage": RAISON}
    with TestClient(creer_application(atelier)) as client:
        vu = client.post(f"/api/assist/{BLOCAGE}/preview", json=corps).json()
        assert fil.requetes == []  # regarder ne coûte rien
        client.post(f"/api/assist/{BLOCAGE}", json=corps)

    systeme, message = fil.corps()["messages"]
    assert vu["systeme"] == systeme["content"]
    assert vu["message"] == message["content"]


def test_rien_de_la_machine_ne_part_ni_image_ni_chemin(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        client.post(f"/api/assist/{BLOCAGE}", json={"texte": RAISON, "ecran": ECRAN, "blocage": RAISON})
    parti = fil.requetes[0].content.decode("utf-8")
    for jamais in (str(tmp_path), "donnees", ".png", "data:image", "base64"):
        assert jamais not in parti, jamais
    assert all(isinstance(m["content"], str) for m in fil.corps()["messages"])


# ── La consigne : ce qu'elle exige d'elle-même ───────────────────────────────


def test_la_consigne_ne_repete_pas_et_ne_contredit_pas_la_raison():
    assert "tu ne l'affiches pas une seconde fois" in CONSIGNE_BLOCAGE
    assert "tu ne dis rien qui la contredise" in CONSIGNE_BLOCAGE


def test_la_consigne_nomme_les_gestes_jamais_les_fichiers_ni_les_routes():
    assert "un fichier" in CONSIGNE_BLOCAGE and "une route" in CONSIGNE_BLOCAGE
    assert "les gestes et les écrans du produit" in CONSIGNE_BLOCAGE


def test_la_consigne_demande_je_ne_sais_pas_mot_pour_mot_sans_contexte_suffisant():
    assert f"« {JE_NE_SAIS_PAS} »" in CONSIGNE_BLOCAGE
    assert "N'invente jamais une cause" in CONSIGNE_BLOCAGE


# ── Les refus ne font rien partir ────────────────────────────────────────────


def test_sans_raison_courte_rien_ne_part(tmp_path):
    """Le critère du plan : « il n'invente jamais une cause » commence par ne
    jamais partir sans la raison à développer."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(f"/api/assist/{BLOCAGE}", json={"texte": RAISON, "ecran": ECRAN})
    assert reponse.status_code == 422 and reponse.json()["code"] == "blocage_absent"
    assert fil.requetes == []


def test_les_autres_refus_ne_font_rien_partir(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        sans_ecran = client.post(
            f"/api/assist/{BLOCAGE}", json={"texte": RAISON, "blocage": RAISON}
        )
        ecran_inconnu = client.post(
            f"/api/assist/{BLOCAGE}",
            json={"texte": RAISON, "ecran": "nulle-part", "blocage": RAISON},
        )
        trop_long = client.post(
            f"/api/assist/{BLOCAGE}",
            json={"texte": "a" * (SIGNES_MAX + 1), "ecran": ECRAN, "blocage": RAISON},
        )
        sans_texte = client.post(
            f"/api/assist/{BLOCAGE}", json={"ecran": ECRAN, "blocage": RAISON}
        )

    assert sans_ecran.status_code == 422 and sans_ecran.json()["code"] == "ecran_absent"
    assert ecran_inconnu.status_code == 422 and ecran_inconnu.json()["code"] == "ecran_inconnu"
    assert trop_long.status_code == 422 and trop_long.json()["code"] == "texte_trop_long"
    assert sans_texte.status_code == 422 and sans_texte.json()["code"] == "texte_absent"
    assert fil.requetes == []


def test_le_metier_question_ne_change_pas_de_forme(tmp_path):
    """Non-régression : CM5 ajoute un troisième métier à `AVEC_ECRAN`, il ne
    touche pas au contrat de « question » (CM4)."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        sans_blocage = client.post(
            f"/api/assist/{QUESTION}", json={"texte": "où est le plafond ?", "ecran": ECRAN}
        )
    assert sans_blocage.status_code == 200
