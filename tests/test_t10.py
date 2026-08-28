# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T10 — l'îlot se déplace, et ce qui va partir se voit.

Un test par critère de `docs/PLAN.md` § Phase T10, nommé d'après lui. **Quatre des
neuf ne se vérifient pas ici** : que la bande du titre soit la poignée, que le seuil
sépare le clic du glissement, que l'îlot menacé se peigne en `--echec`, et qu'un
seul Ctrl+Z défasse le déplacement. Les trois premiers sont du geste et de la
couleur — ils vivent dans `interface/src/composants/` et se mesurent au navigateur ;
le quatrième est une pile qui n'existe que dans l'onglet. La **règle** qui déclenche
l'avertissement, elle, est pure : elle se vérifie dans `Toile.test.tsx`.

**Ce que le serveur tient d'un déplacement d'îlot, et rien de plus** : que les
places de tous ses membres s'écrivent ensemble ou pas du tout. Où l'îlot se pose,
quel écart la main a parcouru, à quel moment le geste s'écrit — l'écran. La
frontière est celle de T8, et cette tranche ne la déplace pas.

**Aucun test de ce fichier ne coûte un centime**, et le dernier le prouve plutôt
que de l'affirmer, en comptant les appels du double.
"""

from __future__ import annotations

import pytest
from conftest import image


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _coller(client, nom: str = "planche.png") -> dict:
    """Une carte image de plus. `forcer`, parce que le double rend deux fois les
    mêmes octets — donc la même empreinte, donc un doublon *proposé*."""
    reponse = client.post(
        "/api/board/paste", params={"nom": nom, "forcer": True}, content=image("PNG")
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _regler(client, carte: str, **reglage) -> dict:
    reponse = client.put(f"/api/board/{carte}", json=reglage)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _classer(client, nom_fichier: str, groupe: str, place: list[float]) -> dict:
    """Une carte posée dans un îlot — donc un îlot qui existe."""
    carte = _coller(client, nom_fichier)
    return _regler(client, carte["identifiant"], groupe=groupe, position=place)


def _toile(client) -> dict:
    return client.get("/api/board").json()


def _places(client) -> dict[str, list[float] | None]:
    return {c["identifiant"]: c["position"] for c in _toile(client)["cartes"]}


def _deplacer(client, groupe: str, places: dict[str, list[float]]):
    return client.put(
        "/api/board/groups/move", json={"groupe": groupe, "places": places}
    )


def _ilot_de_trois(client) -> list[dict]:
    return [
        _classer(client, "une.png", "marais", [0, 0]),
        _classer(client, "deux.png", "marais", [200, 0]),
        _classer(client, "trois.png", "marais", [0, 200]),
    ]


# ── « Un îlot se déplace, et ses cartes vont avec » ──────────────────────────


def test_un_ilot_se_deplace_en_un_seul_appel(client):
    """Trois cartes, un appel, trois places écrites — et aucun groupe touché."""
    cartes = _ilot_de_trois(client)
    ecart = (40, -25)
    voulues = {
        c["identifiant"]: [c["position"][0] + ecart[0], c["position"][1] + ecart[1]]
        for c in cartes
    }

    reponse = _deplacer(client, "marais", voulues)
    assert reponse.status_code == 200, reponse.text
    assert len(reponse.json()["cartes"]) == 3

    relues = {c["identifiant"]: c for c in _toile(client)["cartes"]}
    for identifiant, place in voulues.items():
        assert relues[identifiant]["position"] == place
        assert relues[identifiant]["groupe"] == "marais", (
            "déplacer un rangement ne reclasse pas ce qu'il contient"
        )


def test_deplacer_un_ilot_garde_ses_liens_et_sa_teinte(client):
    """Aucun groupe ne change, donc rien n'est élagué."""
    cartes = _ilot_de_trois(client)
    seule = _classer(client, "seule.png", "falaise", [800, 800])
    lien = client.post(
        "/api/board/links",
        json={
            "de": {"genre": "ilot", "valeur": "marais"},
            "vers": {"genre": "carte", "valeur": seule["identifiant"]},
        },
    )
    assert lien.status_code == 201, lien.text
    client.put("/api/board/groups/tint", json={"groupe": "marais", "teinte": "bruyere"})

    reponse = _deplacer(
        client,
        "marais",
        {c["identifiant"]: [c["position"][0] + 500, c["position"][1]] for c in cartes},
    )
    assert reponse.status_code == 200, reponse.text

    toile = _toile(client)
    assert len(toile["liens"]) == 1, "un îlot déplacé garde ses traits"
    assert toile["teintes"] == {"marais": "bruyere"}


# ── « Un îlot se déplace entier, ou pas du tout » ────────────────────────────


def test_un_membre_oublie_refuse_le_geste_et_n_ecrit_rien(client):
    """Sept cartes qui bougent et cinq qui restent, c'est un îlot déchiré : le
    refus arrive **avant** la première écriture, jamais après la septième."""
    cartes = _ilot_de_trois(client)
    avant = _places(client)

    reponse = _deplacer(
        client,
        "marais",
        {
            c["identifiant"]: [c["position"][0] + 40, c["position"][1]]
            for c in cartes[:2]
        },
    )
    assert reponse.status_code == 409, reponse.text
    assert "entier" in reponse.json()["raison"]
    assert _places(client) == avant, "un refus ne laisse pas la moitié du geste"


def test_une_carte_etrangere_a_l_ilot_est_refusee_en_la_nommant(client):
    """Sans ça, la route serait un second `PUT /board/{carte}` capable d'écrire
    des places en lot sous un nom de groupe qui ne les regarde pas."""
    cartes = _ilot_de_trois(client)
    ailleurs = _classer(client, "ailleurs.png", "falaise", [900, 900])
    avant = _places(client)

    voulues = {c["identifiant"]: [c["position"][0] + 40, 0] for c in cartes}
    voulues[ailleurs["identifiant"]] = [0, 0]
    reponse = _deplacer(client, "marais", voulues)

    assert reponse.status_code == 409, reponse.text
    assert ailleurs["identifiant"] in reponse.json()["raison"]
    assert _places(client) == avant


def test_un_ilot_qui_n_existe_pas_ne_se_deplace_pas(client):
    """Un îlot *est* le groupe : un groupe sans carte n'est écrit nulle part."""
    carte = _classer(client, "une.png", "marais", [0, 0])
    reponse = _deplacer(client, "steppe", {carte["identifiant"]: [10, 10]})
    assert reponse.status_code == 409, reponse.text
    assert "steppe" in reponse.json()["raison"]


@pytest.mark.parametrize("mauvaise", ["[]", "[1]", "[1, 2, 3]", "[Infinity, 0]"])
def test_une_place_refusee_ne_deplace_aucune_carte(client, mauvaise):
    """La vérification passe sur **toutes** les places avant d'en écrire une :
    un refus au milieu de la boucle laisserait le déchirement qu'on empêche. Et
    la liste vide en fait partie — elle sort une carte du plan, ce qui n'est pas
    un déplacement d'îlot mais un retour en réserve, geste d'une carte seule.

    **Écrit en JSON brut**, pour la raison de `test_t8` : l'encodeur de la
    bibliothèque d'essai refuse `Infinity` avant de l'envoyer, donc passer par
    `json=` vérifierait le client au lieu du serveur.
    """
    cartes = _ilot_de_trois(client)
    avant = _places(client)

    voulues = ", ".join(
        f'"{c["identifiant"]}": [{c["position"][0] + 40}, 0]' for c in cartes[:-1]
    )
    reponse = client.put(
        "/api/board/groups/move",
        content=(
            '{"groupe": "marais", "places": {' + voulues + ", "
            f'"{cartes[-1]["identifiant"]}": {mauvaise}' + "}}"
        ),
        headers={"content-type": "application/json"},
    )

    assert reponse.status_code in (409, 422), reponse.text
    assert _places(client) == avant


# ── « Réseau coupé : tout de cette tranche fonctionne » ──────────────────────


def test_reseau_coupe_deplacer_un_ilot_fonctionne(client, double):
    """Prouvé plutôt qu'affirmé, en comptant les appels du double. Déplacer un
    rangement est du geste pur : rien n'en sort, rien n'y coûte."""
    cartes = _ilot_de_trois(client)
    double.catalogue_lisible = False
    appels = double.appels

    reponse = _deplacer(
        client,
        "marais",
        {c["identifiant"]: [c["position"][0], c["position"][1] + 120] for c in cartes},
    )
    assert reponse.status_code == 200, reponse.text
    assert double.appels == appels, "déplacer n'a demandé le fournisseur pour rien"
