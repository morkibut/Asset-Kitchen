# -*- coding: utf-8 -*-
"""TS20 · Refaire la planche des directions — la moitié serveur
(`docs/PLAN-de-la-toile-au-sujet.md`).

Un sujet qui a déjà « C'est la référence » sur une planche peut en refaire
une nouvelle depuis son concept art. La demande qui part porte le concept
art comme personnage à reproduire, **jamais l'ancienne planche** — sinon le
modèle recopierait le dessin qu'on veut quitter. « C'est la référence » sur
la nouvelle planche remplace l'ancienne, qui reste en bibliothèque.
"""

from __future__ import annotations

from tests.conftest import planche_sujets

from tests.test_t7 import appeler, mcp  # noqa: F401
from tests.test_ts3 import (  # noqa: F401
    DESIGN,
    MODELE,
    _attendre,
    _envoi,
    _generer,
    _premiere_planche_arrivee,
    _sujet_de_la_toile,
    _vue,
)


def test_refaire_ne_reinjecte_pas_lancienne_planche(client, double, atelier):
    """Un sujet dont la planche est déjà choisie en redemande une : la
    demande qui part ne porte que le concept art (et les libres) — pas
    l'ancienne planche, dont l'usage `planche` sortirait sinon en référence
    `planche` (RS1)."""
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_de_la_toile(client, 90)
    ident = sujet["personnage"]["identifiant"]
    carte = sujet["carte"]
    premier_appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    assert premier_appel.status_code == 202, premier_appel.text
    premier_identifiant = premier_appel.json()["identifiant"]
    assert _attendre(client, premier_identifiant)["statut"] == "reussie"
    premiere = f"{premier_identifiant}-0"

    choisie = client.put(
        f"/api/characters/{ident}/references/sheet", json={"asset": premiere}
    )
    assert choisie.status_code == 200, choisie.text

    # La demande de la nouvelle planche, comme la première (armée par
    # `api.premierePlanche` côté écran, `TS3`).
    lue = client.get(f"/api/characters/{ident}/first-sheet")
    assert lue.status_code == 200, lue.text
    assert lue.json()["design"] == [
        {"asset": carte, "role": "reference", "origine": "carte", "usage": "design"}
    ]

    ecran = _envoi(client, personnage=ident, premiere_planche=True)
    assert ecran.status_code == 200, ecran.text
    corps = ecran.json()
    lignes = corps["images"]["lignes"]
    # **Seul le concept art part** : l'ancienne planche n'est nulle part.
    assert [l["asset"] for l in lignes] == [carte]
    assert lignes[0]["provenance"] == "concept art · personnage à reproduire"
    assert premiere not in [l["asset"] for l in lignes]
    assert f"Image 1 — {DESIGN}" in corps["texte"]

    appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    assert appel.status_code == 202, appel.text
    generation = appel.json()
    # **La demande qui part au fournisseur** ne porte que le concept art et
    # le gabarit de la grille — l'ancienne planche n'y est pas, sinon le
    # modèle recopierait le dessin qu'on veut quitter.
    assert generation["references"] == [
        {"asset": carte, "role": "reference", "origine": "carte", "usage": "design"}
    ]
    assert _attendre(client, generation["identifiant"])["statut"] == "reussie"
    # Le concept art + le gabarit de la grille, une fois chacun — comme la
    # première planche (`test_ce_qui_part_est_ce_que_relire_avant_lenvoi_montre`).
    # L'ancienne planche n'ajoute aucune image de plus.
    assert len(double.demandes[-1].references) == 2


def test_cest_la_reference_sur_la_nouvelle_remplace_lancienne(client, double, atelier):
    """« C'est la référence » sur la planche refaite dépromeut l'ancienne,
    qui reste en bibliothèque — déjà la règle de `choisir_la_planche`
    (`TS3`), vérifiée ici depuis le chemin « refaire »."""
    _vue(client)
    ident, premiere = _premiere_planche_arrivee(client, double, 91)
    client.put(f"/api/characters/{ident}/references/sheet", json={"asset": premiere})

    double.rendre = lambda: planche_sujets(4)
    appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    assert appel.status_code == 202, appel.text
    identifiant = appel.json()["identifiant"]
    assert _attendre(client, identifiant)["statut"] == "reussie"
    seconde = f"{identifiant}-0"

    remplacee = client.put(
        f"/api/characters/{ident}/references/sheet", json={"asset": seconde}
    )
    assert remplacee.status_code == 200, remplacee.text

    projet = atelier.bibliotheque.courant
    relu = atelier.production.personnage(projet, ident)
    assert premiere not in relu.references
    assert relu.usage_de(seconde) == "planche"
    # **Reste en bibliothèque, dépromue** (RS1, comme `TS3`).
    assert atelier.assets.lire(premiere) is not None
