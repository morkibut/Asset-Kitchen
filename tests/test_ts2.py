# -*- coding: utf-8 -*-
"""TS2 · Créer un sujet depuis une carte de la toile — la moitié serveur.

Un geste compose cinq gestes qui existent déjà : créer le sujet, faire entrer
l'image de la carte en bibliothèque (une copie importée **pour ce sujet**),
désigner la carte comme concept art, poser la copie en portrait. Rien n'est
promu en référence.

**Rien ne coûte un centime** : la carte est collée depuis des octets, et le
fournisseur n'est jamais appelé.
"""

from __future__ import annotations

import json

from tests.conftest import image_sujet

from tests.test_t7 import appeler, mcp  # noqa: F401


def _coller(client, octets: bytes, nom: str = "") -> dict:
    reponse = client.post(f"/api/board/paste?nom={nom}", content=octets)
    assert reponse.status_code == 201, reponse.text
    carte = reponse.json()["carte"]
    assert carte is not None, reponse.text
    return carte


def _octets(rang: int = 3) -> bytes:
    return image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12)


def _creer(client, carte: str, **corps):
    return client.post(f"/api/board/{carte}/subject", json=corps)


def _sujet(client, identifiant: str) -> dict:
    for un in client.get("/api/characters").json()["personnages"]:
        if un["identifiant"] == identifiant:
            return un
    raise AssertionError(f"« {identifiant} » n'est pas dans la liste")


# ── 1. Le geste entier ───────────────────────────────────────────────────────


def test_une_carte_fait_un_sujet_complet(client, atelier):
    octets = _octets()
    carte = _coller(client, octets)
    reglage = client.put(f"/api/board/{carte['identifiant']}", json={"note": "La sorcière\nune note"})
    assert reglage.status_code == 200, reglage.text
    promue = client.put(
        f"/api/board/{carte['identifiant']}/official", json={"famille": "personnages"}
    )
    assert promue.status_code == 200, promue.text

    reponse = _creer(client, carte["identifiant"], description="une sorcière des marais")
    assert reponse.status_code == 201, reponse.text
    corps = reponse.json()
    assert corps["deja"] is None
    sujet = corps["personnage"]
    asset = corps["asset"]

    assert sujet["nom"] == "La sorcière"
    assert sujet["description"] == "une sorcière des marais"
    assert sujet["concept_arts"] == [carte["identifiant"]]
    assert sujet["image_de_reference"] == asset["identifiant"]
    assert sujet["references"] == []  # rien n'est promu en référence

    # La copie est un asset du sujet, du bon projet, **et reçoit la recette du
    # jeu** (TS4) — l'image brute au sens du disque reste gardée, elle.
    objet = atelier.assets.lire(asset["identifiant"])
    assert objet.personnage == sujet["identifiant"]
    assert objet.projet == corps["projet"]
    assert objet.pose is None
    assert atelier.assets.octets(objet, brut=True)[0] == octets

    # Relu, pas seulement rendu (8septies) : le sujet tient après la réponse.
    relu = _sujet(client, sujet["identifiant"])
    assert relu["concept_arts"] == [carte["identifiant"]]
    assert relu["image_de_reference"] == asset["identifiant"]


def test_la_copie_garde_la_trace_de_sa_carte(client, atelier):
    carte = _coller(client, _octets(4))
    corps = _creer(client, carte["identifiant"], nom="Le passeur").json()
    generation = corps["asset"]["identifiant"].rsplit("-", 1)[0]
    chemin = atelier.fichiers.generations / generation / "generation.json"
    demande = json.loads(chemin.read_text(encoding="utf-8"))["demande"]
    assert demande["origine"] == {"carte": carte["identifiant"], "projet": corps["projet"]}
    # Importée, pas prélevée ni générée : rien n'a été payé.
    assert json.loads(chemin.read_text(encoding="utf-8"))["modele"] == "import"


def test_la_famille_de_la_carte_passe_au_sujet(client, atelier):
    carte = _coller(client, _octets(5))
    client.put(f"/api/board/{carte['identifiant']}/official", json={"famille": "objets"})
    corps = _creer(client, carte["identifiant"], nom="Le tonneau").json()
    sujet = corps["personnage"]
    attendu = atelier.univers.univers(corps["projet"]).premier_type_de("objets")
    assert attendu, "le barème d'essai devrait avoir un type d'objet"
    assert sujet["type"] == attendu


def test_sans_note_le_nom_est_neutre_et_libre(client):
    premiere = _coller(client, _octets(6))
    seconde = _coller(client, _octets(7))
    un = _creer(client, premiere["identifiant"]).json()["personnage"]
    deux = _creer(client, seconde["identifiant"]).json()["personnage"]
    assert un["nom"] == "Sujet de la toile"
    assert deux["nom"] == "Sujet de la toile 2"


# ── 2. Ce qui ne crée rien ───────────────────────────────────────────────────


def test_une_carte_deja_concept_art_ne_fait_pas_de_second_sujet(client):
    carte = _coller(client, _octets(8))
    premier = _creer(client, carte["identifiant"], nom="Le héron").json()["personnage"]
    avant = len(client.get("/api/characters").json()["personnages"])

    encore = _creer(client, carte["identifiant"], nom="Un autre")
    assert encore.status_code == 200, encore.text
    assert encore.json()["personnage"] is None
    assert encore.json()["deja"] == {"identifiant": premier["identifiant"], "nom": "Le héron"}
    assert len(client.get("/api/characters").json()["personnages"]) == avant


def test_une_carte_inconnue_ou_sans_image_est_refusee(client):
    inconnue = _creer(client, "nulle-part")
    assert inconnue.status_code == 404, inconnue.text

    texte = client.post("/api/board/text", json={"texte": "un simple mot"})
    assert texte.status_code == 201, texte.text
    refus = _creer(client, texte.json()["identifiant"])
    assert refus.status_code == 409, refus.text
    assert "image" in refus.text
    assert client.get("/api/characters").json()["personnages"] == []


# ── 3. La règle de la copie ──────────────────────────────────────────────────


def test_une_image_deja_en_bibliotheque_n_est_pas_deplacee(client, atelier, tmp_path):
    """**Tranché en TS2** : toujours une copie neuve. L'asset qui portait déjà
    ces octets garde son histoire — il n'est ni rattaché, ni changé."""
    octets = _octets(9)
    fichier = tmp_path / "deja.png"
    fichier.write_bytes(octets)
    importe = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert importe.status_code in (200, 201), importe.text
    ancien = importe.json()["asset"]["identifiant"]

    carte = _coller(client, octets)
    corps = _creer(client, carte["identifiant"], nom="La loutre").json()
    assert corps["asset"]["identifiant"] != ancien
    assert atelier.assets.lire(ancien).personnage is None
    nouveau = atelier.assets.lire(corps["asset"]["identifiant"])
    assert atelier.assets.octets(nouveau, brut=True)[0] == octets


# ── 4. L'agent fait le même geste (T7) ───────────────────────────────────────


async def test_l_agent_cree_le_meme_sujet(client, mcp, atelier):
    octets = _octets(10)
    carte = _coller(client, octets)
    recu = await appeler(
        mcp, "create_character_from_card", card=carte["identifiant"], name="Le crapaud"
    )
    sujet = recu["personnage"]
    assert sujet["nom"] == "Le crapaud"
    assert sujet["concept_arts"] == [carte["identifiant"]]
    assert sujet["image_de_reference"] == recu["asset"]["identifiant"]
    objet = atelier.assets.lire(recu["asset"]["identifiant"])
    assert objet.personnage == sujet["identifiant"]
    assert atelier.assets.octets(objet, brut=True)[0] == octets

    encore = await appeler(mcp, "create_character_from_card", card=carte["identifiant"])
    assert encore["personnage"] is None
    assert encore["deja"]["identifiant"] == sujet["identifiant"]
