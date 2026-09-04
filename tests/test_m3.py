# -*- coding: utf-8 -*-
"""Les critères de M3, côté serveur — le projet lu une seule fois par demande.

**Ce que la tranche répare ici.** Composer ce qui part relisait le projet du jeu
jusqu'à quarante-deux fois pour répondre à une seule question : chaque petit
service le redemande pour son compte, et aucun ne sait ce que le voisin vient de
lire. La liste des personnages était relue dix-huit fois, l'ambiance quatre.

**Ce n'est pas la connexion par opération qui est en cause, et elle ne bouge
pas.** Refermer à chaque fois est ce qui permet d'effacer le fichier de l'index
sous Windows, et c'est un critère du produit depuis `T3`. Ce qui n'a jamais été
décidé, c'est de refaire quarante-deux fois le même aller-retour.

**Ces essais comptent des lectures, jamais un temps.** Un temps dépend de la
machine et de ce qui tourne à côté ; il aurait fallu le seuiller, et un seuil se
règle jusqu'à ce qu'il passe. Un compte, lui, ne se négocie pas : il vaut un, ou
il ne le vaut pas. C'est pour cela que `Base` sépare `lire_projet` — qui répond —
de `_lire_projet_du_disque` — qui va chercher : le second est ce qu'on compte.

**Et la moitié qui compte est le témoin.** Un mémo qui répondrait autre chose que
le disque serait pire que la lenteur qu'il répare. Chaque cas mesuré est donc
joué **deux fois** : mémo débranché, mémo branché, et les deux réponses sont
comparées caractère par caractère.

**Aucun appel, aucun centime** — rien de ce fichier ne parle au fournisseur
autrement que par le double, et les deux tiers n'en ont pas besoin du tout.

*Ce que l'écran en fait — la frappe qui ne repart plus à chaque lettre, le
curseur qui reste où on l'a mis — se mesure dans `interface/src/App.test.tsx`.*
"""

from __future__ import annotations

import dataclasses

import pytest

import atelier.depot.base as socle
from atelier.depot import Base, projet_lu_une_fois

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"


# ── Le compteur, et le témoin ────────────────────────────────────────────────


class _MemoDebranche:
    """Le mémo neutralisé : `lire_projet` relit le disque à chaque appel.

    C'est **l'atelier d'avant la tranche**, obtenu sans garder deux versions du
    code : `lire_projet` et `projet_lu_une_fois` lisent tous deux la même
    variable de module, et il suffit de la remplacer par un objet qui ne retient
    rien. Sans ce témoin, un compte tombé à un ne prouverait pas grand-chose — il
    pourrait aussi bien venir d'un écran qui demande moins.
    """

    def get(self) -> None:
        return None

    def set(self, valeur: object) -> None:
        return None

    def reset(self, jeton: object) -> None:
        return None


@pytest.fixture
def lectures(monkeypatch) -> list[int]:
    """Combien de fois le projet est **allé chercher sur le disque**."""
    compte = [0]
    vraie = Base._lire_projet_du_disque

    def compter(self, identifiant):
        compte[0] += 1
        return vraie(self, identifiant)

    monkeypatch.setattr(Base, "_lire_projet_du_disque", compter)
    return compte


@pytest.fixture
def sans_memo(monkeypatch) -> None:
    """L'atelier d'avant la tranche, le temps d'un essai."""
    monkeypatch.setattr(socle, "_projets_lus", _MemoDebranche())


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _bible(client) -> None:
    """De quoi que la composition ait vraiment à lire le projet."""
    reponse = client.put(
        "/api/universe",
        json={"bible": [{"nom": "monde", "texte": "marais de fer", "actif": True}]},
    )
    assert reponse.status_code == 200, reponse.text


def _attendre(client, identifiant: str) -> dict:
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")  # pragma: no cover


def _personnage(client, poses: int = 2) -> tuple[str, list[str]]:
    tableau = client.get("/api/characters").json()
    plan = [p["identifiant"] for p in tableau["plan"]][:poses]
    personnage = client.post(
        "/api/characters", json={"nom": "Nain", "description": "un nain"}
    ).json()["personnage"]["identifiant"]
    client.put(f"/api/characters/{personnage}", json={"poses": plan})
    return personnage, plan


def _corps(client, double, personnage: str, poses: list[str]) -> None:
    """Une image de corps par pose — c'est ce qui donne à l'équipement de quoi
    se poser, et donc à la composition de quoi relire le projet."""
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    for pose in poses:
        reponse = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": f"le nain, {pose}",
                "personnage": personnage,
                "pose": pose,
            },
        ).json()
        _attendre(client, reponse["identifiant"])
    double.rendre = None


def _piece(client) -> str:
    return client.post(
        "/api/characters/pieces",
        json={
            "nom": "casque",
            "description": "un casque de fer à cornes",
            "emplacement": "tête",
            "portee": "contenue",
        },
    ).json()["piece"]["identifiant"]


def _apercu(client, **corps) -> dict:
    reponse = client.post(
        "/api/prompt/preview", json={"prompt": "un casque", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un casque", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _equipement(client, double) -> dict:
    """Le cas le plus lourd : une planche d'équipement sur deux poses."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    return {"personnage": personnage, "poses": poses, "piece": _piece(client)}


# ── « Le projet se lit une seule fois par demande » ──────────────────────────


def test_l_apercu_du_texte_ne_lit_le_projet_qu_une_fois(client, lectures):
    _bible(client)
    lectures[0] = 0

    _apercu(client)

    assert lectures[0] == 1


def test_la_confirmation_d_une_image_ordinaire_ne_lit_le_projet_qu_une_fois(
    client, lectures
):
    _bible(client)
    lectures[0] = 0

    _envoi(client)

    assert lectures[0] == 1


def test_la_confirmation_d_un_equipement_ne_lit_le_projet_qu_une_fois(
    client, double, lectures
):
    """Le cas qui a fait la tranche : quarante-deux lectures mesurées le
    4 septembre 2026 sur les vraies données."""
    _bible(client)
    montage = _equipement(client, double)
    lectures[0] = 0

    _envoi(client, **montage)

    assert lectures[0] == 1


# ── « Et c'était bien plus d'une avant » ─────────────────────────────────────


def test_avant_la_tranche_l_equipement_relisait_le_projet_bien_plus_d_une_fois(
    client, double, lectures, sans_memo
):
    """Le témoin. **Sans lui, un compte tombé à un ne prouve rien** — il pourrait
    venir d'un écran qui demande moins, et non d'une lecture qui ne se refait
    plus.

    **Le montage d'ici retrouve exactement les chiffres des vraies données** —
    5, 15 et 42 —, ce qui dit que le compte ne dépendait pas du contenu du jeu
    mais de la façon dont la composition est écrite. Ils ne sont pas inscrits en
    dur pour autant : un essai qui les figerait se casserait au premier service
    qui lit le projet une fois de plus, et ce n'est pas ce qu'on cherche à
    protéger. Ce qui est vérifié, c'est **l'écart** — il y en avait plus de dix,
    il y en a une."""
    _bible(client)
    montage = _equipement(client, double)
    lectures[0] = 0

    _envoi(client, **montage)

    assert lectures[0] > 10


def test_avant_la_tranche_l_apercu_et_l_image_ordinaire_relisaient_aussi(
    client, lectures, sans_memo
):
    """Les deux cas légers relisaient eux aussi, et c'est pour cela que la
    réparation est posée sur la composition entière et non sur le seul écran où
    la lenteur se voyait."""
    _bible(client)

    lectures[0] = 0
    _apercu(client)
    apercu = lectures[0]

    lectures[0] = 0
    _envoi(client)
    ordinaire = lectures[0]

    assert apercu > 1
    assert ordinaire > apercu


# ── « Ce que l'écran affiche ne change pas d'un caractère » ──────────────────


def _sans_memo_puis_avec(client, monkeypatch, appel) -> tuple[dict, dict]:
    """La même demande, mémo débranché puis branché."""
    monkeypatch.setattr(socle, "_projets_lus", _MemoDebranche())
    avant = appel()
    monkeypatch.undo()
    return avant, appel()


def test_l_apercu_rend_exactement_le_meme_texte_qu_avant(client, monkeypatch):
    _bible(client)
    avant, apres = _sans_memo_puis_avec(
        client, monkeypatch, lambda: _apercu(client)
    )
    assert avant == apres


def test_la_confirmation_ordinaire_rend_exactement_la_meme_chose_qu_avant(
    client, monkeypatch
):
    _bible(client)
    avant, apres = _sans_memo_puis_avec(client, monkeypatch, lambda: _envoi(client))
    assert avant == apres


def test_la_confirmation_d_un_equipement_rend_exactement_la_meme_chose_qu_avant(
    client, double, monkeypatch
):
    """Le cas le plus lourd est aussi celui qui a le plus à perdre : le texte, le
    prix, les images jointes, les cases du pliage et le refus éventuel sortent
    tous de la même composition."""
    _bible(client)
    montage = _equipement(client, double)
    avant, apres = _sans_memo_puis_avec(
        client, monkeypatch, lambda: _envoi(client, **montage)
    )
    assert avant == apres


# ── « La portée ne survit pas à ce qu'elle ne sait pas » ─────────────────────


def test_hors_portee_le_projet_se_relit_comme_avant(client, lectures):
    """La portée est **explicite et courte**, et rien ne la pose d'office. Deux
    demandes sont deux lectures — un mémo qui survivrait à la question posée
    serait un cache dont on ne saurait plus dire de quand il date."""
    _bible(client)
    lectures[0] = 0

    _apercu(client)
    _apercu(client)

    assert lectures[0] == 2


def test_enregistrer_le_projet_pendant_la_portee_vide_le_memo(client, atelier):
    """Écrire pendant une lecture est rare, mais on ne veut pas avoir à s'en
    souvenir : la portée sert à ne pas relire deux fois la **même** chose, jamais
    à survivre à un changement."""
    base = atelier.base
    identifiant = client.get("/api/library").json()["courant"]
    assert identifiant is not None

    with projet_lu_une_fois():
        avant = base.lire_projet(identifiant)
        assert avant is not None
        base.enregistrer_projet(dataclasses.replace(avant, nom="Le marais de fer"))
        apres = base.lire_projet(identifiant)

    assert apres is not None
    assert apres.nom == "Le marais de fer"


def test_les_portees_s_emboitent_sans_se_gener(client, lectures):
    """La confirmation appelle l'aperçu : les deux portées se recouvrent, et la
    plus extérieure tient le mémo."""
    _bible(client)
    lectures[0] = 0

    with projet_lu_une_fois():
        _envoi(client)
        _apercu(client)

    assert lectures[0] == 1


# ── « Aucun appel, aucun centime » ───────────────────────────────────────────


def test_la_composition_ne_parle_jamais_au_fournisseur(client, double):
    _bible(client)
    appels = double.appels

    _apercu(client)
    _envoi(client)

    assert double.appels == appels
