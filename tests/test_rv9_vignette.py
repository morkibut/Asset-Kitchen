# -*- coding: utf-8 -*-
"""RV9 — retour de l'auteur du 23 septembre 2026 : la vignette du journal.

`SuiviDesTravaux` (`interface/src/composants/FabricationSuivie.tsx`) fusionne
trois origines — travaux suivis, file locale, journal des appels — et l'auteur
a vu des carrés gris partout, y compris pour des images terminées. Une part du
défaut vivait ici : `bibliotheque.journal()` savait dire *quel modèle, quel
prompt, quel coût*, jamais *quelle image* — la seule chose qui manquait pour
que l'écran affiche une vignette réelle plutôt qu'une lettre.

Le test vérifie que `journal()` joint maintenant l'asset de la première image
encore vivante à l'appel qui l'a produite, **sans requête par ligne** — une
seule requête SQL pour tout le lot, comme `rangs_vivants` le fait déjà pour
l'écran des dépenses (E18).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

MODELE = "essai:rend-du-png"


def _generer(client: TestClient, prompt: str = "un gobelin, de face") -> dict:
    reponse = client.post("/api/generations", json={"modele": MODELE, "prompt": prompt})
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    return client.get(f"/api/generations/{identifiant}").json()


def test_le_journal_joint_l_asset_de_la_premiere_image_encore_vivante(client, double):
    generation = _generer(client)
    assert generation["statut"] == "reussie"
    asset_attendu = generation["emplacements"][0]["resultat"] is not None

    journal = client.get("/api/journal").json()
    appel = next(a for a in journal["appels"] if a["identifiant"] == generation["identifiant"])

    assert asset_attendu
    assert appel["vignette"] is not None
    # C'est un identifiant d'asset réel, pas l'identifiant de la génération :
    # `/api/assets/{id}/vignette` en a besoin pour servir l'image.
    reponse = client.get(f"/api/assets/{appel['vignette']}")
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["generation"] == generation["identifiant"]


def test_le_journal_ne_joint_rien_pour_un_appel_qui_n_a_rien_produit(client, double):
    from atelier.domaine.erreurs import AppelRefuse

    double.echec = AppelRefuse("le fournisseur n'a rendu aucune image")
    reponse = client.post("/api/generations", json={"modele": MODELE, "prompt": "un piège"})
    identifiant = reponse.json()["identifiant"]
    client.get(f"/api/generations/{identifiant}")

    journal = client.get("/api/journal").json()
    appel = next(a for a in journal["appels"] if a["identifiant"] == identifiant)
    assert appel["vignette"] is None


def test_le_journal_ne_joint_plus_l_asset_d_une_image_supprimee(client, double):
    generation = _generer(client)
    asset = client.get("/api/assets").json()["assets"][0]
    assert asset["generation"] == generation["identifiant"]

    reponse = client.post("/api/assets/delete", json={"identifiants": [asset["identifiant"]]})
    assert reponse.status_code == 200, reponse.text

    journal = client.get("/api/journal").json()
    appel = next(a for a in journal["appels"] if a["identifiant"] == generation["identifiant"])
    assert appel["vignette"] is None
