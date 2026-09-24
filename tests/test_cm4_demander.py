# -*- coding: utf-8 -*-
"""CM4 — demander, là où on est (`docs/PLAN-assistant.md` § CM4).

Ce que ce fichier tient côté serveur — l'écran a le sien
(`interface/src/composants/DemanderIci.test.tsx`) :

- le métier « question » part avec **l'écran** (`ECRANS`), pas un champ de
  `CHAMPS` — le contexte est composé par `contexte_instant`, la même fonction
  que réutilisera CM5 ;
- **une question hors sujet reçoit « je ne sais pas »** : la consigne le
  demande mot pour mot, et l'écran compare à `JE_NE_SAIS_PAS` ;
- « Voir ce qui part » montre exactement ce qui part, comme pour « améliorer » ;
- les refus (écran absent ou inconnu, texte absent ou trop long) ne font rien
  partir.

**La qualité de la consigne ne se mesure pas ici** : le fournisseur est
doublé, comme CM1 et CM3. Aucun appel payé.
"""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import (
    AMELIORER,
    CADRE,
    CONSIGNE_QUESTION,
    ECRANS,
    JE_NE_SAIS_PAS,
    QUESTION,
    SIGNES_MAX,
)
from atelier.fournisseur.openrouter_texte import OpenRouterTexte
from atelier.services import Atelier

from conftest import AnimateurMuet, FournisseurDouble

CLE_FICTIVE = "essai-1234567890"
ECRAN = "jeu-de-tuiles"


def _morceau(texte: str, *, cout: float | None = None) -> str:
    brut: dict = {"id": "gen-cm4", "choices": [{"index": 0, "delta": {"content": texte}}]}
    if cout is not None:
        brut["usage"] = {"cost": cout}
    return "data: " + json.dumps(brut) + "\n\n"


class Fil:
    """Le transport doublé : il garde ce qui est parti, et rend une réponse fixe."""

    def __init__(self, reponse: str = "Touche la marque au bout du champ.") -> None:
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


TEXTE = "à quoi sert le motif, à côté de la matière ?"


# ── Ce qui part ──────────────────────────────────────────────────────────────


def test_ce_qui_part_est_lecran_le_champ_regarde_ce_quil_porte_et_ce_qui_bloque(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(
            f"/api/assist/{QUESTION}",
            json={
                "texte": TEXTE,
                "ecran": ECRAN,
                "champ": "Le motif",
                "valeur": "des dalles",
                "blocage": "il manque : de quoi c'est fait.",
            },
        )
    lignes = [json.loads(l) for l in reponse.text.splitlines()]
    assert [l["genre"] for l in lignes] == ["texte", "fin"]

    corps = fil.corps()
    systeme, message = corps["messages"]

    # La consigne du dépôt, puis la fiche du produit — comme pour « améliorer ».
    assert systeme["content"].startswith(CONSIGNE_QUESTION)

    # Le contexte : l'écran, le champ regardé, ce qu'il porte, ce qui bloque.
    assert f"Écran : {ECRANS[ECRAN]}." in message["content"]
    assert "Champ regardé : « Le motif »." in message["content"]
    assert "Ce qu'il porte : « des dalles »." in message["content"]
    assert "Ce qui bloque : il manque : de quoi c'est fait." in message["content"]

    # La question, encadrée, à la fin, telle qu'elle a été écrite.
    assert message["content"].endswith(f"{CADRE}\n{TEXTE}\n{CADRE}")


def test_le_contexte_sans_champ_ni_valeur_ni_blocage_ne_porte_que_lecran(tmp_path):
    """Une question peut porter sur l'écran seul — rien d'autre à regarder."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        client.post(f"/api/assist/{QUESTION}", json={"texte": TEXTE, "ecran": ECRAN})
    message = fil.corps()["messages"][1]["content"]
    assert message.startswith(f"Écran : {ECRANS[ECRAN]}.")
    assert "Champ regardé" not in message
    assert "Ce qu'il porte" not in message
    assert "Ce qui bloque" not in message


def test_voir_ce_qui_part_est_ce_qui_part_et_n_envoie_rien(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    corps = {"texte": TEXTE, "ecran": ECRAN, "champ": "Le motif"}
    with TestClient(creer_application(atelier)) as client:
        vu = client.post(f"/api/assist/{QUESTION}/preview", json=corps).json()
        assert fil.requetes == []  # regarder ne coûte rien
        client.post(f"/api/assist/{QUESTION}", json=corps)

    systeme, message = fil.corps()["messages"]
    assert vu["systeme"] == systeme["content"]
    assert vu["message"] == message["content"]


def test_la_consigne_demande_je_ne_sais_pas_mot_pour_mot_hors_sujet():
    """La preuve que le métier peut refuser : la phrase exacte est dans la
    consigne, et l'écran la compare telle quelle (essai d'écran)."""
    assert f"« {JE_NE_SAIS_PAS} »" in CONSIGNE_QUESTION
    # La consigne dit explicitement de ne jamais nommer un détail d'implémentation.
    assert "un fichier" in CONSIGNE_QUESTION and "une route" in CONSIGNE_QUESTION


def test_rien_de_la_machine_ne_part_ni_image_ni_chemin(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        client.post(f"/api/assist/{QUESTION}", json={"texte": TEXTE, "ecran": ECRAN})
    parti = fil.requetes[0].content.decode("utf-8")
    for jamais in (str(tmp_path), "donnees", ".png", "data:image", "base64"):
        assert jamais not in parti, jamais
    assert all(isinstance(m["content"], str) for m in fil.corps()["messages"])


# ── Les refus ne font rien partir ────────────────────────────────────────────


def test_les_refus_ne_font_rien_partir(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        sans_ecran = client.post(f"/api/assist/{QUESTION}", json={"texte": TEXTE})
        ecran_inconnu = client.post(
            f"/api/assist/{QUESTION}", json={"texte": TEXTE, "ecran": "nulle-part"}
        )
        trop_long = client.post(
            f"/api/assist/{QUESTION}",
            json={"texte": "a" * (SIGNES_MAX + 1), "ecran": ECRAN},
        )
        vide = client.post(f"/api/assist/{QUESTION}", json={"texte": "   ", "ecran": ECRAN})

    assert sans_ecran.status_code == 422 and sans_ecran.json()["code"] == "ecran_absent"
    assert ecran_inconnu.status_code == 422 and ecran_inconnu.json()["code"] == "ecran_inconnu"
    assert trop_long.status_code == 422 and trop_long.json()["code"] == "texte_trop_long"
    assert vide.status_code == 422
    assert fil.requetes == []


def test_le_metier_ameliorer_ne_change_pas_de_forme(tmp_path):
    """Non-régression : CM4 généralise `composer`, il ne touche pas la forme
    du contexte d'« améliorer » (CM3) — même refus, même clé `champ`."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        sans_champ = client.post(f"/api/assist/{AMELIORER}", json={"texte": "granit"})
    assert sans_champ.status_code == 422 and sans_champ.json()["code"] == "champ_absent"
