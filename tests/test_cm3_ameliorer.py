# -*- coding: utf-8 -*-
"""CM3 — améliorer un texte de génération (`docs/PLAN-assistant.md` § CM3).

Ce que ce fichier tient côté serveur — l'écran a le sien
(`interface/src/composants/CoupDeMain.test.tsx`) :

- **ce qui part** est la consigne du métier, la fiche du produit, le contexte du
  champ, les noms du jeu **que le texte contient**, et le texte — rien d'autre :
  ni image, ni chemin de fichier, ni l'autre champ, ni les noms que le texte ne
  dit pas ;
- **« Voir ce qui part » est ce qui part**, au caractère près, et le regarder
  n'envoie rien ;
- **le partage de TU12** : chaque champ part seul, et le contexte ne nomme que
  lui ;
- les refus (champ absent ou inconnu, jeu inconnu, texte trop long) ne font
  rien partir.

**La qualité de la consigne ne se mesure pas ici** : aucun essai n'appelle le
vrai modèle, le fil est doublé comme en CM1. Le protocole pour l'éprouver avec
de vrais appels est écrit sous CM3 dans le plan.
"""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import (
    AMELIORER,
    CADRE,
    CONSIGNE_AMELIORER,
    NOMS_MAX,
    SIGNES_MAX,
    noms_presents,
)
from atelier.fournisseur.openrouter_texte import OpenRouterTexte
from atelier.services import Atelier
from atelier.services import contexte_coup_de_main as contexte

from conftest import AnimateurMuet, FournisseurDouble

CLE_FICTIVE = "essai-1234567890"


def _morceau(texte: str, *, cout: float | None = None) -> str:
    brut: dict = {"id": "gen-cm3", "choices": [{"index": 0, "delta": {"content": texte}}]}
    if cout is not None:
        brut["usage"] = {"cost": cout}
    return "data: " + json.dumps(brut) + "\n\n"


class Fil:
    """Le transport doublé : il garde ce qui est parti, et rend une réponse courte."""

    def __init__(self) -> None:
        self.requetes: list[httpx.Request] = []

    def __call__(self, requete: httpx.Request) -> httpx.Response:
        self.requetes.append(requete)
        corps = "".join(
            [_morceau("Brumeval "), _morceau("stone"), _morceau("", cout=0.00002), "data: [DONE]\n\n"]
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


def _jeu(atelier: Atelier) -> str:
    """Un jeu, trois sujets, une collection — et un autre jeu à côté."""
    projet = atelier.bibliotheque.creer_projet("Brumeval").identifiant
    atelier.production.creer_personnage(projet, "Orm le Forgeron")
    atelier.production.creer_personnage(projet, "Gobelin des tourbières")
    atelier.production.creer_personnage(projet, "Pierre")
    atelier.bibliotheque.creer_collection("Les Salants", projet=projet)
    autre = atelier.bibliotheque.creer_projet("Un autre jeu").identifiant
    atelier.production.creer_personnage(autre, "Vélinde")
    return projet


TEXTE = "de la pierre grise de brumeval, comme chez orm le forgeron, et les salants"


# ── Ce qui part ──────────────────────────────────────────────────────────────


def test_ce_qui_part_est_la_consigne_la_fiche_le_champ_les_noms_du_texte_et_le_texte(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    projet = _jeu(atelier)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(
            f"/api/assist/{AMELIORER}",
            json={"texte": TEXTE, "projet": projet, "champ": "matiere"},
        )
    lignes = [json.loads(l) for l in reponse.text.splitlines()]
    assert [l["genre"] for l in lignes] == ["texte", "texte", "fin"]

    corps = fil.corps()
    # Rien d'autre que ce que CM1 envoie déjà : un modèle, deux messages.
    assert set(corps) == {"model", "messages", "stream", "max_tokens", "usage"}
    systeme, message = corps["messages"]
    assert systeme["role"] == "system" and message["role"] == "user"

    # La consigne du dépôt, puis la fiche du produit, telle qu'elle est écrite.
    assert systeme["content"] == CONSIGNE_AMELIORER + "\n\n" + contexte.fiche_du_produit().strip()

    # Le contexte : l'écran et **ce** champ-là.
    assert "tiroir des matières" in message["content"]
    assert "Champ : « C'est fait de quoi ? »" in message["content"]
    # Les noms du jeu que le texte contient — écrits comme le jeu les écrit —, dans
    # l'ordre du texte ; « Pierre » en est, et c'est la consigne qui dit quoi en faire.
    assert (
        "« Pierre », « Brumeval », « Orm le Forgeron », « Les Salants »" in message["content"]
    )
    # Ni un sujet que le texte ne dit pas, ni le sujet d'un autre jeu.
    assert "Gobelin" not in json.dumps(corps, ensure_ascii=False)
    assert "Vélinde" not in json.dumps(corps, ensure_ascii=False)
    # Le texte, encadré, à la fin, tel qu'il a été écrit.
    assert message["content"].endswith(f"{CADRE}\n{TEXTE}\n{CADRE}")


def test_rien_de_la_machine_ne_part_ni_image_ni_chemin(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    projet = _jeu(atelier)
    with TestClient(creer_application(atelier)) as client:
        client.post(
            f"/api/assist/{AMELIORER}",
            json={"texte": TEXTE, "projet": projet, "champ": "motif"},
        )
    parti = fil.requetes[0].content.decode("utf-8")
    for jamais in (str(tmp_path), str(tmp_path).replace("\\", "\\\\"), "donnees", ".png", "data:image", "base64"):
        assert jamais not in parti, jamais
    # Du texte seulement : aucun message à morceaux (image_url…), deux chaînes.
    assert all(isinstance(m["content"], str) for m in fil.corps()["messages"])


def test_voir_ce_qui_part_est_ce_qui_part_et_n_envoie_rien(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    projet = _jeu(atelier)
    corps = {"texte": TEXTE, "projet": projet, "champ": "motif"}
    with TestClient(creer_application(atelier)) as client:
        vu = client.post(f"/api/assist/{AMELIORER}/preview", json=corps).json()
        assert fil.requetes == []  # regarder ne coûte rien
        client.post(f"/api/assist/{AMELIORER}", json=corps)

    systeme, message = fil.corps()["messages"]
    assert vu["systeme"] == systeme["content"]
    assert vu["message"] == message["content"]
    # Les quatre morceaux montrés **font** les deux messages, au caractère près.
    m = {x["titre"]: x["texte"] for x in vu["morceaux"]}
    assert list(m) == ["La consigne", "La fiche du produit", "Le contexte", "Ton texte"]
    assert m["La consigne"] + "\n\n" + m["La fiche du produit"] == systeme["content"]
    assert m["Le contexte"] + "\n\n" + m["Ton texte"] == message["content"]
    assert "aucun chemin de fichier" in vu["jamais"]


def test_chaque_champ_part_seul_et_le_contexte_ne_nomme_que_lui(tmp_path):
    """Le partage de TU12 : la matière d'un côté, le motif de l'autre."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        client.post(f"/api/assist/{AMELIORER}", json={"texte": "dalles 2 par 2", "champ": "motif"})
        client.post(f"/api/assist/{AMELIORER}", json={"texte": "vieux granit", "champ": "matiere"})

    motif = fil.corps(0)["messages"][1]["content"]
    matiere = fil.corps(1)["messages"][1]["content"]
    assert "Champ : « Le motif »" in motif and "Champ : « C'est fait de quoi ? »" not in motif
    assert "Champ : « C'est fait de quoi ? »" in matiere and "Champ : « Le motif »" not in matiere
    # Et l'autre champ n'est pas envoyé : le texte de l'un n'est jamais dans l'autre.
    assert "vieux granit" not in motif and "dalles" not in matiere


def test_la_fiche_est_relue_a_chaque_appel(tmp_path, monkeypatch):
    fiche = tmp_path / "fiche.md"
    fiche.write_text("Première version de la fiche.", encoding="utf-8")
    monkeypatch.setattr(contexte, "FICHE", fiche)
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    corps = {"texte": "granit", "champ": "matiere"}
    with TestClient(creer_application(atelier)) as client:
        avant = client.post(f"/api/assist/{AMELIORER}/preview", json=corps).json()
        fiche.write_text("Seconde version, corrigée à la main.", encoding="utf-8")
        apres = client.post(f"/api/assist/{AMELIORER}/preview", json=corps).json()
    assert avant["systeme"].endswith("Première version de la fiche.")
    assert apres["systeme"].endswith("Seconde version, corrigée à la main.")


def test_le_cadre_du_message_est_celui_que_la_consigne_nomme():
    """La consigne dit « entre les deux lignes ——— » : si l'un change sans
    l'autre, la protection contre un texte qui donne des ordres tombe en silence."""
    assert f"« {CADRE} »" in CONSIGNE_AMELIORER


# ── Les refus ne font rien partir ────────────────────────────────────────────


def test_les_refus_ne_font_rien_partir(tmp_path):
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        sans_champ = client.post(f"/api/assist/{AMELIORER}", json={"texte": "granit"})
        champ_inconnu = client.post(
            f"/api/assist/{AMELIORER}", json={"texte": "granit", "champ": "consigne"}
        )
        jeu_inconnu = client.post(
            f"/api/assist/{AMELIORER}",
            json={"texte": "granit", "champ": "matiere", "projet": "nulle-part"},
        )
        trop_long = client.post(
            f"/api/assist/{AMELIORER}",
            json={"texte": "a" * (SIGNES_MAX + 1), "champ": "matiere"},
        )
        vide = client.post(f"/api/assist/{AMELIORER}", json={"texte": "   ", "champ": "matiere"})

    assert sans_champ.status_code == 422 and sans_champ.json()["code"] == "champ_absent"
    assert champ_inconnu.status_code == 422 and champ_inconnu.json()["code"] == "champ_inconnu"
    assert jeu_inconnu.status_code == 404
    assert trop_long.status_code == 422 and trop_long.json()["code"] == "texte_trop_long"
    assert vide.status_code == 422
    assert fil.requetes == []


# ── Les noms du jeu qu'un texte contient ─────────────────────────────────────


def test_un_nom_se_trouve_sans_casse_ni_accents_et_en_entier():
    noms = ["Brumeval", "Élise", "Orm", "la Forge d’Orm", "Brumeval"]
    texte = "la forge d'orm, à brumeval, pour elise"
    assert noms_presents(texte, noms) == ["la Forge d’Orm", "Orm", "Brumeval", "Élise"]


def test_un_nom_ne_se_trouve_pas_au_milieu_d_un_mot():
    assert noms_presents("un pavé normand", ["Orm", "Pavé n"]) == []
    assert noms_presents("", ["Orm"]) == []


def test_les_noms_emportes_sont_plafonnes():
    noms = [f"Nom{i}" for i in range(NOMS_MAX + 5)]
    assert len(noms_presents(" ".join(noms), noms)) == NOMS_MAX
