# -*- coding: utf-8 -*-
"""TS18 · Une carte s'ouvre dans l'atelier de retouche — la moitié serveur.

`POST /api/board/{carte}/asset` rend l'asset d'une carte, pour que l'atelier
de retouche l'ouvre : celui qu'elle porte déjà si elle vient de la
bibliothèque ou d'une fabrication de la toile (`source == "asset:<id>"`), une
copie neuve en bibliothèque sinon — la même copie que TS2, sans sujet.
**Jamais de doublon** : rappelée sur la même carte, la route rend toujours le
même asset.

Le lien de la version retouchée à sa carte d'origine (« Poser sur la toile »)
n'ajoute aucune route : il recompose `POST /projects/{p}/board/assets/{asset}`
(T4) et `POST /board/links` (T9), déjà couverts ailleurs — c'est un geste
d'écran, vérifié côté écran.

**Rien ne coûte un centime** : le double du fournisseur rend une vraie image
PNG de taille fixe, sans appel réseau ; la copie d'une carte collée passe par
`ServiceGenerations.importer`, qui n'appelle jamais le fournisseur.
"""

from __future__ import annotations

import time

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"


def _generer(client, prompt: str = "un héron", **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
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


def _coller(client, octets: bytes, nom: str = "") -> dict:
    reponse = client.post(f"/api/board/paste?nom={nom}", content=octets)
    assert reponse.status_code == 201, reponse.text
    carte = reponse.json()["carte"]
    assert carte is not None, reponse.text
    return carte


def _octets(rang: int = 3) -> bytes:
    return image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12)


def _asset_de_la_carte(client, carte: str) -> dict:
    reponse = client.post(f"/api/board/{carte}/asset")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── 1. Une carte fabriquée, ou posée depuis la bibliothèque ─────────────────


def test_une_carte_fabriquee_rend_son_asset_existant(client, atelier):
    projet = atelier.bibliotheque.courant
    generation = _generer(client, prompt="un héron", resolution="512")
    rang = generation["emplacements"][0]["rang"]
    identifiant_asset = f"{generation['identifiant']}-{rang}"

    posee = client.post(f"/api/projects/{projet}/board/assets/{identifiant_asset}")
    assert posee.status_code == 200, posee.text
    carte = posee.json()["carte"]
    assert carte["source"] == f"asset:{identifiant_asset}"

    corps = _asset_de_la_carte(client, carte["identifiant"])
    assert corps["asset"]["identifiant"] == identifiant_asset

    # Rappelée une seconde fois, même réponse — aucune écriture, donc aucun
    # compte d'assets qui bouge.
    avant = atelier.bibliotheque.compter_projet(projet)
    corps2 = _asset_de_la_carte(client, carte["identifiant"])
    assert corps2["asset"]["identifiant"] == identifiant_asset
    assert atelier.bibliotheque.compter_projet(projet) == avant


# ── 2. Une carte collée ou importée ──────────────────────────────────────────


def test_une_carte_collee_recoit_une_copie_neuve_sans_sujet(client, atelier):
    carte = _coller(client, _octets(9))
    projet = carte["projet"]

    avant = atelier.bibliotheque.compter_projet(projet)
    corps = _asset_de_la_carte(client, carte["identifiant"])
    asset = corps["asset"]
    apres = atelier.bibliotheque.compter_projet(projet)
    assert apres == avant + 1, "une copie neuve doit entrer en bibliothèque"

    objet = atelier.assets.lire(asset["identifiant"])
    assert objet is not None
    assert objet.projet == carte["projet"]
    # Sans sujet : ni désignée, ni portrait de qui que ce soit (le point qui
    # distingue ce geste de TS2 — « sans la rattacher à un sujet »).
    assert objet.personnage is None
    assert atelier.assets.octets(objet, brut=True)[0] == _octets(9)


def test_un_second_appel_sur_la_meme_carte_ne_double_pas(client, atelier):
    carte = _coller(client, _octets(10))
    projet = carte["projet"]

    premier = _asset_de_la_carte(client, carte["identifiant"])["asset"]
    avant = atelier.bibliotheque.compter_projet(projet)
    second = _asset_de_la_carte(client, carte["identifiant"])["asset"]
    apres = atelier.bibliotheque.compter_projet(projet)

    assert second["identifiant"] == premier["identifiant"]
    assert apres == avant, "jamais de doublon — rappelée, la route rend toujours le même asset"


def test_la_copie_garde_la_trace_de_sa_carte(client, atelier):
    import json

    carte = _coller(client, _octets(11))
    corps = _asset_de_la_carte(client, carte["identifiant"])
    generation = corps["asset"]["identifiant"].rsplit("-", 1)[0]
    chemin = atelier.fichiers.generations / generation / "generation.json"
    lu = json.loads(chemin.read_text(encoding="utf-8"))
    assert lu["demande"]["origine"] == {"carte": carte["identifiant"], "projet": corps["projet"]}
    # Importée, jamais payée.
    assert lu["modele"] == "import"


# ── 3. Ce qui refuse ──────────────────────────────────────────────────────────


def test_une_carte_texte_n_a_pas_d_asset(client):
    reponse = client.post("/api/board/text", json={"texte": "une note"})
    assert reponse.status_code == 201, reponse.text
    carte = reponse.json()

    refus = client.post(f"/api/board/{carte['identifiant']}/asset")
    assert refus.status_code == 409, refus.text


def test_une_carte_inconnue_est_un_404(client):
    refus = client.post("/api/board/inconnue/asset")
    assert refus.status_code == 404, refus.text
