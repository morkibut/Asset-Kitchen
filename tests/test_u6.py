# -*- coding: utf-8 -*-
"""Les critères de U6 qui se mesurent — la palette qui ne fait plus attendre.

**La cause n'était pas la fusion des couleurs, c'était l'empreinte.** Avant de
rendre une palette, l'atelier vérifie si elle est encore d'accord avec ses
sources ; pour cela il fabrique une empreinte, et cette empreinte était faite
des couleurs elles-mêmes — donc il relisait et requantifiait tout le paquet
d'images, y compris quand on n'avait bougé qu'un curseur qui ne touche pas aux
sources. *Le calcul qu'on refaisait était celui dont on voulait justement savoir
s'il fallait le refaire.* Mesuré sur la machine de l'auteur le 31 août 2026 :
2,1 secondes par relâchement de curseur, sur un paquet de trois images.

**Ce fichier compte les lectures, il ne chronomètre pas.** Une assertion sur une
durée mesurerait la machine qui la lance ; ce qui rend le temps est structurel —
*combien de fois le paquet est-il ouvert ?* —, et c'est ça qu'on fixe. Le
chronomètre, lui, vit dans `essais/essai_palette_vive.py`, qui garde son relevé
et qui mesure les deux temps sur de vraies images.

Ce qui se voit — la jauge au-dessus du panneau, l'aperçu qui ne se redemande
pas — vit dans `interface/src/App.test.tsx`. Aucun essai d'ici n'appelle le
fournisseur.
"""

from __future__ import annotations

import pytest

from tests.test_e11 import (
    _aplats,
    _ambiance,
    _coller,
    _cote,
    _officialiser,
    _palette,
    _regler_palette,
)


# ── Compter les ouvertures du paquet ─────────────────────────────────────────


@pytest.fixture
def lectures(monkeypatch):
    """Combien de fois un paquet d'images a été lu et quantifié.

    **On compte `palette_de`, et c'est le bon endroit** : c'est la fonction qui
    ouvre les fichiers et fait tourner la coupe médiane, donc celle qui coûte.
    Compter les appels de service au-dessus n'aurait rien dit — ils sont
    nombreux et gratuits ; c'est celui-là qui pèse deux secondes.
    """
    import atelier.services.ambiances as module

    vraie = module.palette_de
    compte = {"n": 0}

    def comptee(octets, combien):
        compte["n"] += 1
        return vraie(octets, combien)

    monkeypatch.setattr(module, "palette_de", comptee)
    return compte


def _paquet(client, groupe: str, combien: int = 3) -> list[str]:
    """Un paquet de `combien` cartes, dans un îlot nommé — la source coûteuse.

    Des images d'aplats et non le sujet du corpus : on veut des couleurs
    reconnaissables, et surtout des couleurs **différentes** d'une carte à
    l'autre, sans quoi ajouter une carte ne changerait rien et le critère
    « ajouter une carte recalcule » serait vrai par accident.
    """
    teintes = [
        ("#0a5c3a", "#7fd4a8", "#04321f"),
        ("#5c0a3a", "#d47fa8", "#32041f"),
        ("#3a5c0a", "#a8d47f", "#1f3204"),
        ("#0a3a5c", "#7fa8d4", "#041f32"),
    ]
    cartes = []
    for rang in range(combien):
        carte = _coller(client, f"{groupe}-{rang}.png", _aplats(teintes[rang % 4]))
        reponse = client.put(f"/api/board/{carte}", json={"groupe": groupe})
        assert reponse.status_code == 200, reponse.text
        cartes.append(carte)
    return cartes


def _palette_dimages(client, nom: str, groupe: str) -> dict:
    return _palette(client, nom, sources=[{"genre": "images", "reference": groupe}])


# ── « Bouger un curseur sans toucher aux sources ne relit rien » ──────────────


def test_bouger_lattraction_ne_relit_aucune_image(client, lectures):
    """**Le critère central de l'étape**, dit en lectures plutôt qu'en
    secondes : le curseur ne touche pas aux sources, donc le paquet n'a aucune
    raison d'être rouvert."""
    _officialiser(client, 1)
    _paquet(client, "marais")
    palette = _palette_dimages(client, "marais", "marais")

    # On repart de zéro après la création, qui a bien dû lire le paquet une fois.
    lectures["n"] = 0
    _regler_palette(client, palette["identifiant"], attraction=0.4)
    _regler_palette(client, palette["identifiant"], attraction=0.8)
    _regler_palette(client, palette["identifiant"], du_jeu=4)

    assert lectures["n"] == 0


def test_relire_le_cote_ne_relit_aucune_image(client, lectures):
    """Lire recalcule — c'est ce qui fait qu'une image promue change la palette
    du marais sans qu'on ait à toucher le marais. Mais *recalculer* n'a jamais
    voulu dire *rouvrir les fichiers*."""
    _officialiser(client, 1)
    _paquet(client, "marais")
    _palette_dimages(client, "marais", "marais")

    lectures["n"] = 0
    for _ in range(5):
        _cote(client)

    assert lectures["n"] == 0


def test_renommer_ne_recalcule_aucune_couleur(client, lectures):
    """Le nom n'entre pas dans l'empreinte, et il n'y entrait pas non plus
    avant : ce que l'essai garde, c'est que la reprise de l'empreinte ne l'y a
    pas fait entrer par mégarde."""
    _officialiser(client, 1)
    _paquet(client, "marais")
    palette = _palette_dimages(client, "marais", "marais")
    avant = _cote(client)["palettes"]
    empreinte = next(
        p for p in avant if p["identifiant"] == palette["identifiant"]
    )["empreinte"]

    lectures["n"] = 0
    _ambiance(client, "les bas-fonds", palette=palette["identifiant"])
    apres = _regler_palette(client, palette["identifiant"], nom="le marais")

    assert lectures["n"] == 0
    assert apres["nom"] == "le marais"
    assert apres["empreinte"] == empreinte


# ── « Ajouter, retirer ou remplacer une carte recalcule bien » ────────────────


def test_ajouter_une_carte_au_paquet_recalcule_la_palette(client, lectures):
    """**La propriété que l'empreinte protégeait, et elle ne se perd pas.**
    C'était toute la difficulté : une empreinte qui n'ouvre plus les fichiers
    doit quand même savoir qu'un fichier de plus est arrivé. Elle le sait parce
    qu'une carte porte déjà l'empreinte de ses octets."""
    _officialiser(client, 1)
    _paquet(client, "marais", combien=2)
    palette = _palette_dimages(client, "marais", "marais")
    avant = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )

    lectures["n"] = 0
    carte = _coller(client, "marais-neuve.png", _aplats(("#0a3a5c", "#7fa8d4", "#041f32")))
    client.put(f"/api/board/{carte}", json={"groupe": "marais"})

    apres = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )
    assert apres["empreinte"] != avant["empreinte"]
    assert apres["rendue"] != avant["rendue"]
    # Et le paquet a bien été rouvert — une fois, pas trois.
    assert lectures["n"] == 1


def test_sortir_une_carte_du_paquet_recalcule_aussi(client):
    """L'autre moitié du même critère. Ramener une carte en réserve est un
    changement de groupe, donc une autre signature de paquet."""
    _officialiser(client, 1)
    cartes = _paquet(client, "marais", combien=3)
    palette = _palette_dimages(client, "marais", "marais")
    avant = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )

    client.put(f"/api/board/{cartes[0]}", json={"groupe": ""})

    apres = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )
    assert apres["empreinte"] != avant["empreinte"]


def test_le_paquet_relu_a_lidentique_rend_les_memes_couleurs(client, lectures):
    """Le cache est une **lecture gardée**, pas une seconde vérité : reposer
    exactement les mêmes cartes doit rendre exactement la même chose, sans
    rouvrir un fichier."""
    _officialiser(client, 1)
    cartes = _paquet(client, "marais", combien=2)
    palette = _palette_dimages(client, "marais", "marais")
    avant = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )

    # Sortir une carte puis la remettre : la signature revient à ce qu'elle
    # était, donc la lecture gardée sert de nouveau.
    client.put(f"/api/board/{cartes[0]}", json={"groupe": ""})
    _cote(client)
    lectures["n"] = 0
    client.put(f"/api/board/{cartes[0]}", json={"groupe": "marais"})

    apres = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )
    assert apres["rendue"] == avant["rendue"]
    assert apres["empreinte"] == avant["empreinte"]
    assert lectures["n"] == 0


# ── Une palette tirée d'une autre suit la même règle ──────────────────────────


def test_une_palette_tiree_dune_autre_ne_relit_rien_non_plus(client, lectures):
    """La signature d'une palette citée porte ses réglages, pas ses couleurs :
    la chaîne entière se juge sans ouvrir un fichier."""
    _officialiser(client, 1)
    _paquet(client, "marais")
    base = _palette_dimages(client, "marais", "marais")
    tiree = _palette(
        client, "tirée", sources=[{"genre": "palette", "reference": base["identifiant"]}]
    )

    lectures["n"] = 0
    _cote(client)
    _regler_palette(client, tiree["identifiant"], attraction=0.6)
    assert lectures["n"] == 0

    # Mais régler la **base** se propage jusqu'en bas, comme avant.
    avant = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == tiree["identifiant"]
    )
    _regler_palette(client, base["identifiant"], couleurs=8)
    apres = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == tiree["identifiant"]
    )
    assert apres["empreinte"] != avant["empreinte"]
