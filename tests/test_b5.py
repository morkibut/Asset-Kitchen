# -*- coding: utf-8 -*-
"""Les critères d'acceptation de B5 — le tableau de bord du jeu.

**Planche** : `docs/archive/pistes-2026-09-04/carnet/Accueil.dc.html`.

Un test par morceau du bilan que `GET /api/dashboard` sert :
- la complétude par famille (E12 — seules les poses fabricables maintenant
  comptent au dénominateur) ;
- la liste des manques, triée par coût décroissant, avec le total du lot ;
- ce que ça vaut quand rien ne manque.

Aucun test ne coûte un centime : le double de `conftest.py` rend de vraies
images, à un coût réel, et c'est ce coût mesuré que `bilan_du_jeu` retrouve —
jamais un tarif écrit dans ce fichier.
"""

from __future__ import annotations

import time

from conftest import image_sujet

MODELE = "essai:rend-du-png"


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")


def _personnage(client, nom: str, poses: int) -> tuple[str, list[str]]:
    """Un personnage qui tient `poses` poses du plan par défaut du projet."""
    plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][:poses]
    personnage = client.post(
        "/api/characters", json={"nom": nom, "description": nom}
    ).json()["personnage"]["identifiant"]
    if plan:
        client.put(f"/api/characters/{personnage}", json={"poses": plan})
    return personnage, plan


def _generer_une_pose(client, double, personnage: str, pose: str) -> None:
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": f"{personnage}, {pose}",
            "personnage": personnage,
            "pose": pose,
        },
    ).json()
    _attendre(client, reponse["identifiant"])


# ── La complétude par famille ────────────────────────────────────────────────


def test_la_complétude_ne_compte_que_les_poses_tenues(client, double):
    """Deux poses demandées, une seule faite : la famille dit *une image sur
    deux*, jamais sur le total théorique du jeu (E12).

    **RV10** : `complet` n'est plus un ratio, il regarde les deux calques —
    *rien ne manque, animations comprises*. La fraction se lit maintenant sur
    `images`/`animations`, chacun avec `pretes` et `demandees`.
    """
    personnage, plan = _personnage(client, "Le pèlerin", poses=2)
    assert len(plan) == 2, "le projet de test doit déclarer au moins deux poses"
    _generer_une_pose(client, double, personnage, plan[0])

    bilan = client.get("/api/dashboard").json()
    famille = next(f for f in bilan["familles"] if f["cle"] == "personnages")
    assert famille["compte"] == 1
    assert famille["images"] == {"pretes": 1, "demandees": 2, "a_fabriquer": 1, "a_departager": 0}
    assert famille["complet"] is False
    assert famille["manque_texte"] == "0/2 animations · 1/2 images prêtes."


def test_une_pose_écartée_sort_du_dénominateur(client, double):
    """Écarter une pose sur ce personnage-là la retire de ce qu'il doit
    fabriquer : la barre ne doit plus jamais réclamer une case qu'aucun bouton
    ne peut remplir (E12)."""
    personnage, plan = _personnage(client, "Le pèlerin", poses=2)
    _generer_une_pose(client, double, personnage, plan[0])

    avant = client.get("/api/dashboard").json()
    famille_avant = next(f for f in avant["familles"] if f["cle"] == "personnages")
    assert famille_avant["images"]["demandees"] == 2

    client.put(f"/api/characters/{personnage}", json={"poses": [plan[0]]})

    apres = client.get("/api/dashboard").json()
    famille_apres = next(f for f in apres["familles"] if f["cle"] == "personnages")
    assert famille_apres["images"] == {"pretes": 1, "demandees": 1, "a_fabriquer": 0, "a_departager": 0}
    # L'image seule ne suffit plus à dire « complet » (RV10) : l'animation
    # de cette pose-là manque encore.
    assert famille_apres["complet"] is False


# ── Ce qui manque le plus ────────────────────────────────────────────────────


def test_les_manques_sont_triés_par_coût_et_totalisés(client, double):
    """Une pose manquante devient une ligne, avec son coût — la médiane mesurée
    sur ce modèle, jamais un tarif écrit ici — et le lot additionne tout le
    monde, pas seulement les lignes montrées."""
    client.put("/api/universe", json={"modeles": {"personnages": MODELE}})
    personnage, plan = _personnage(client, "Le pèlerin", poses=2)
    # Une image payée pour ce modèle, pour que sa médiane existe.
    _generer_une_pose(client, double, personnage, plan[0])

    bilan = client.get("/api/dashboard").json()
    manque = next(m for m in bilan["manques"] if m["sujet"] == personnage)
    assert manque["quantite"] == 1
    assert manque["famille"] == "personnages"
    assert manque["cout_usd"] > 0
    assert "pèlerin" in manque["phrase"]

    assert bilan["lot"]["images"] >= 1
    assert bilan["lot"]["cout_usd"] >= manque["cout_usd"]


def test_les_manques_sont_groupes_par_sujet_nature_et_cibles(client):
    """Le bilan ne répète plus une phrase aveugle par case. Même sans objectif
    explicite, les directions et les deux calques restent lisibles, et une
    absence de mesure ne se transforme jamais en gratuité."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    personnage, plan = _personnage(client, "Le pèlerin", poses=2)

    bilan = client.get("/api/dashboard").json()
    lignes = [m for m in bilan["manques"] if m["sujet"] == personnage]

    assert {m["nature"] for m in lignes} == {"image", "animation"}
    assert len(lignes) == 2
    images = next(m for m in lignes if m["nature"] == "image")
    assert images["quantite"] == len(plan) * 4
    assert len(images["cibles"]) == len(plan) * 4
    assert "vers sud" in images["phrase"]
    assert images["cout_usd"] == 0.0
    assert images["cout_connu"] is False
    assert bilan["lot"]["cout_connu"] is False


def test_rien_ne_manque_annonce_un_lot_vide(client):
    """Aucun personnage, donc aucune famille peuplée et aucun manque : le lot
    est à zéro plutôt que d'inventer une ligne."""
    bilan = client.get("/api/dashboard").json()
    assert bilan["manques"] == []
    assert bilan["lot"] == {"images": 0, "feuilles": 0, "cout_usd": 0.0}


def test_le_bilan_est_scopé_au_projet_visé(client, double):
    """Un jeu neuf n'hérite d'aucun manque d'un autre — même garde que B4 pour
    le chantier."""
    client.post("/api/projects", json={"nom": "Forêt"})  # ouvre « foret »
    bilan_vide = client.get("/api/dashboard", params={"projet": "foret"}).json()
    assert bilan_vide["manques"] == []

    client.put("/api/projects/current", json={"projet": "bac-a-sable"})
    personnage, plan = _personnage(client, "Le pèlerin", poses=1)

    bilan_foret = client.get("/api/dashboard", params={"projet": "foret"}).json()
    assert bilan_foret["manques"] == []

    bilan_bac = client.get("/api/dashboard", params={"projet": "bac-a-sable"}).json()
    assert any(m["sujet"] == personnage for m in bilan_bac["manques"])
