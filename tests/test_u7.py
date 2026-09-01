# -*- coding: utf-8 -*-
"""Les critères de U7 qui se mesurent — ce qu'un paquet du tableau a produit.

Les deux boutons d'un îlot — *faire une palette de ce paquet*, *faire une
ambiance de ce paquet* — **partaient sans le moindre retour**. Le serveur
répondait correctement et fabriquait bien la palette ; l'écran ne bougeait pas
d'un pixel, ne disait rien, ne menait nulle part, et l'objet fabriqué vivait
dans un autre côté de l'onglet. De l'endroit où l'on clique, cela ne se
distinguait pas d'un bouton mort.

**Ce que le serveur devait apprendre à dire est une seule chose** : *ce paquet-là
a-t-il déjà produit quelque chose, et quoi ?* Elle tient trois critères d'un
coup — l'îlot porte sa marque, un second clic ne fabrique pas de doublon, et il
mène à l'existant —, parce que les trois posent la même question.

**Lu, jamais rangé.** Un paquet n'a pas d'identité à lui : c'est un nom de
groupe écrit sur des cartes, et il disparaît avec sa dernière carte. C'est la
palette qui dit de quel paquet elle est la lecture, et l'atelier retourne la
liste. Ce que l'écran en fait vit dans `interface/src/App.test.tsx`.

Aucun essai d'ici n'appelle le fournisseur.
"""

from __future__ import annotations

from tests.test_e11 import _ambiance, _aplats, _coller, _palette


def _paquet(client, groupe: str, combien: int = 2) -> list[str]:
    """Un paquet nommé, avec ses cartes — la matière des deux gestes."""
    teintes = [
        ("#0a5c3a", "#7fd4a8", "#04321f"),
        ("#5c0a3a", "#d47fa8", "#32041f"),
        ("#3a5c0a", "#a8d47f", "#1f3204"),
    ]
    cartes = []
    for rang in range(combien):
        carte = _coller(client, f"{groupe}-{rang}.png", _aplats(teintes[rang % 3]))
        reponse = client.put(f"/api/board/{carte}", json={"groupe": groupe})
        assert reponse.status_code == 200, reponse.text
        cartes.append(carte)
    return cartes


def _tableau(client) -> dict:
    reponse = client.get("/api/board")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── « Un îlot dont le paquet a une palette ou une ambiance le montre » ───────


def test_un_paquet_sans_rien_na_pas_dentree(client):
    """**L'absence est une absence**, pas deux champs vides. Un paquet qui n'a
    rien produit n'a pas de ligne du tout : c'est ce qui permet à l'écran de
    poser la question en un test, sans avoir à distinguer *rien* de *vide*."""
    _paquet(client, "le marais")
    assert _tableau(client)["fabriques"] == {}


def test_le_tableau_dit_la_palette_dun_paquet(client):
    """Elle part avec les cartes, par la même route et pour la même raison que
    les liens : un îlot qui montrerait sa marque un aller-retour après les
    cartes aurait un instant où il paraît n'avoir rien fabriqué."""
    _paquet(client, "le marais")
    palette = _palette(
        client, "le marais", sources=[{"genre": "images", "reference": "le marais"}]
    )

    fabriques = _tableau(client)["fabriques"]
    assert fabriques == {"le marais": {"palette": palette["identifiant"]}}


def test_le_tableau_dit_lambiance_qui_porte_la_palette_du_paquet(client):
    """« Faire une ambiance fait de même, et l'ambiance porte bien la palette du
    paquet. » Le lien est fait par la palette, pas par le nom : deux objets qui
    s'appelleraient pareil sans se porter l'un l'autre ne diraient rien."""
    _paquet(client, "le marais")
    palette = _palette(
        client, "le marais", sources=[{"genre": "images", "reference": "le marais"}]
    )
    ambiance = _ambiance(client, "le marais", palette=palette["identifiant"])

    fabriques = _tableau(client)["fabriques"]
    assert fabriques["le marais"] == {
        "palette": palette["identifiant"],
        "ambiance": ambiance["identifiant"],
    }


def test_une_ambiance_qui_porte_une_autre_palette_nest_pas_celle_du_paquet(client):
    """Le filet de la même règle : l'ambiance du marais ne s'accroche pas au
    paquet du marais si sa palette vient d'ailleurs."""
    _paquet(client, "le marais")
    _palette(client, "le marais", sources=[{"genre": "images", "reference": "le marais"}])
    autre = _palette(client, "ailleurs")
    _ambiance(client, "une ambiance à part", palette=autre["identifiant"])

    assert "ambiance" not in _tableau(client)["fabriques"]["le marais"]


def test_deux_paquets_ne_se_confondent_pas(client):
    """Chaque paquet porte ce qu'il a produit, et rien de ce qu'un autre a
    produit."""
    _paquet(client, "le marais")
    _paquet(client, "la forge")
    marais = _palette(
        client, "le marais", sources=[{"genre": "images", "reference": "le marais"}]
    )
    forge = _palette(
        client, "la forge", sources=[{"genre": "images", "reference": "la forge"}]
    )

    fabriques = _tableau(client)["fabriques"]
    assert fabriques["le marais"]["palette"] == marais["identifiant"]
    assert fabriques["la forge"]["palette"] == forge["identifiant"]


def test_une_palette_de_deux_paquets_marque_les_deux(client):
    """Une palette peut lire plusieurs paquets — c'est ce qu'une source
    multiple veut dire —, et les deux îlots portent alors sa marque. Ce n'est
    pas un cas tordu : c'est le geste *ces deux coins-là se ressemblent*."""
    _paquet(client, "le marais")
    _paquet(client, "la tourbière")
    palette = _palette(
        client,
        "les eaux mortes",
        sources=[
            {"genre": "images", "reference": "le marais"},
            {"genre": "images", "reference": "la tourbière"},
        ],
    )

    fabriques = _tableau(client)["fabriques"]
    assert fabriques["le marais"]["palette"] == palette["identifiant"]
    assert fabriques["la tourbière"]["palette"] == palette["identifiant"]


def test_la_premiere_palette_dun_paquet_est_celle_qui_marque(client):
    """Deux palettes d'un même paquet sont possibles — on peut en faire une
    seconde à la main, avec d'autres réglages. L'îlot montre celle qui est née
    la première : c'est celle que le geste a faite."""
    _paquet(client, "le marais")
    premiere = _palette(
        client, "le marais", sources=[{"genre": "images", "reference": "le marais"}]
    )
    _palette(
        client,
        "le marais, plus sombre",
        sources=[{"genre": "images", "reference": "le marais"}],
    )

    assert _tableau(client)["fabriques"]["le marais"]["palette"] == premiere["identifiant"]


def test_supprimer_la_palette_retire_la_marque(client):
    """**La marque est une lecture, pas un champ posé sur le paquet**, et c'est
    ce qui la rend juste sans qu'on ait à la nettoyer : la palette part, la
    marque part avec elle. Un champ rangé sur l'îlot aurait pointé vers un objet
    qui n'existe plus."""
    _paquet(client, "le marais")
    palette = _palette(
        client, "le marais", sources=[{"genre": "images", "reference": "le marais"}]
    )
    assert "le marais" in _tableau(client)["fabriques"]

    reponse = client.delete(f"/api/palettes/{palette['identifiant']}")
    assert reponse.status_code == 200, reponse.text

    assert _tableau(client)["fabriques"] == {}


def test_refaire_la_meme_palette_est_refuse_en_le_disant(client):
    """C'est ce que l'écran évite désormais — il mène à l'existant plutôt que
    de reposer le geste —, et le filet reste : deux palettes du même nom sont
    refusées, avec la raison."""
    _paquet(client, "le marais")
    _palette(client, "le marais", sources=[{"genre": "images", "reference": "le marais"}])

    reponse = client.post(
        "/api/palettes",
        json={"nom": "le marais", "sources": [{"genre": "images", "reference": "le marais"}]},
    )
    assert reponse.status_code == 409
    assert "le marais" in reponse.json()["raison"]
