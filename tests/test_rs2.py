# -*- coding: utf-8 -*-
"""Les critères de RS2 — refaire une planche (`docs/PLAN-references-du-sujet.md`).

**La panne que ça répare, le 18 septembre 2026** (génération 26f07741). La
planche des quatre directions de Champy était jointe, l'auteur demandait « le
personnage tient un bâton », et le texte partait avec « single isolated
sprite », « FRAMING — one single sprite and nothing else » et une caméra qui
« overrides everything above ». Le modèle a obéi au texte : un seul Champy.

**Ce qui se mesure ici, sans un centime** — le double du fournisseur rend ses
images, et l'écran de confirmation se compose sans appel : que la case retire
les trois phrases et pose la consigne de planche ; que la planche du sujet parte
nommée comme planche à reproduire, sinon la première image jointe à la main ;
que l'appel soit refusé sans l'une ni l'autre, **sans que le fournisseur soit
appelé** ; qu'une génération d'avant ne change pas d'un octet ; et qu'une
relance garde le drapeau.
"""

from __future__ import annotations

import itertools
import time

from atelier.domaine.demande import Demande
from atelier.domaine.vue import calage_de_planche, phrase_de_calage

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"

_DISTINCTES = itertools.count(3)

UN_SEUL = "one single sprite"
QUI_PRIME = "overrides everything above"
ISOLE = "single isolated sprite"


# ── Les montages ─────────────────────────────────────────────────────────────


def _creer(client, nom: str = "Champy") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _jeu(client) -> None:
    """Une vue de dessus et un fond : le cadre, la caméra et le calage partent."""
    reponse = client.put(
        "/api/universe", json={"vue": "vue-dessus-34", "fond": "#FF70B5"}
    )
    assert reponse.status_code == 200, reponse.text


def _image(client, tmp_path) -> str:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"planche-{rang}-{next(_DISTINCTES)}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    return reponse.json()["asset"]["identifiant"]


def _ranger(client, chose: str, asset: str, usage: str) -> None:
    reponse = client.put(
        f"/api/characters/{chose}/references", json={"asset": asset, "usage": usage}
    )
    assert reponse.status_code == 200, reponse.text


def _envoi(client, **corps):
    """L'écran *Relire avant l'envoi* — il compose, il ne paie pas."""
    return client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "the character holds a staff", **corps},
    )


def _generer(client, **corps):
    return client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "the character holds a staff", **corps},
    )


def _attendre(client, identifiant: str, tours: int = 60) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


# ── Les phrases, à un seul endroit ───────────────────────────────────────────


def test_le_calage_de_planche_reconnait_la_phrase_du_produit():
    """La réécriture vise la phrase telle que `phrase_de_calage` l'écrit —
    avec ou sans fond, avec ou sans grille. Si la phrase change un jour, cet
    essai tombe avant qu'un « single isolated sprite » reparte avec une planche."""
    for cible, fond in ((64, ""), (96, "#FF70B5"), (0, "#00FF00")):
        phrase = phrase_de_calage(cible, fond)
        assert ISOLE in phrase
        refaite = calage_de_planche(phrase)
        assert ISOLE not in refaite
        assert "isolated sprites on a flat" in refaite
    # Un texte d'auteur qui ne la contient pas ressort mot pour mot.
    assert calage_de_planche("Isolated sprite on grey") == "Isolated sprite on grey"


def test_le_drapeau_ne_sécrit_que_sil_est_vrai():
    """**Une génération d'avant ne change pas d'un octet** : la clé n'existe pas
    tant que la case n'est pas cochée."""
    assert "garder_mise_en_page" not in Demande(prompt="x").resume()
    assert Demande(prompt="x", garder_mise_en_page=True).resume()[
        "garder_mise_en_page"
    ] is True


# ── Le texte, cochée et non cochée ───────────────────────────────────────────


def test_sans_la_case_le_texte_reste_celui_dun_sprite(client, tmp_path):
    chose = _creer(client)
    _jeu(client)
    _ranger(client, chose["identifiant"], _image(client, tmp_path), "planche")

    envoi = _envoi(client, personnage=chose["identifiant"])

    assert envoi.status_code == 200, envoi.text
    texte = envoi.json()["texte"]
    assert UN_SEUL in texte
    assert QUI_PRIME in texte
    assert ISOLE in texte
    assert "LAYOUT" not in texte
    # Sans contexte de planche, la planche du sujet reste sur la fiche (RS1).
    assert envoi.json()["images"]["lignes"] == []


def test_cochee_la_planche_du_sujet_part_nommee_a_reproduire(client, tmp_path):
    chose = _creer(client)
    _jeu(client)
    planche = _image(client, tmp_path)
    _ranger(client, chose["identifiant"], planche, "planche")

    envoi = _envoi(client, personnage=chose["identifiant"], garder_mise_en_page=True)

    assert envoi.status_code == 200, envoi.text
    lu = envoi.json()
    texte = lu["texte"]
    assert UN_SEUL not in texte
    assert QUI_PRIME not in texte
    assert ISOLE not in texte
    # Le fond et la grille restent : seule la phrase du sprite seul change.
    assert "isolated sprites on a flat solid" in texte
    assert "Image 1 — THE CHARACTER SHEET TO REPRODUCE" in texte
    assert "LAYOUT — reproduce the layout of Image 1" in texte
    # La caméra ferme toujours le texte, sans primer sur la planche.
    assert texte.rstrip().splitlines()[-1].startswith(
        "CAMERA — for every view of the sheet"
    )
    # L'image part, avec sa provenance rangée.
    assert [(l["asset"], l["provenance"]) for l in lu["images"]["lignes"]] == [
        (planche, "image promue · planche")
    ]
    # La consigne se lit dans *Relire avant l'envoi*, et ne s'éteint pas.
    ligne = next(l for l in lu["lignes"] if l["clef"] == "cadrage.mise-en-page")
    assert ligne["allumee"] is True
    assert ligne["eteignable"] is False
    assert not any(l["clef"] == "cadrage.cadre" for l in lu["lignes"])


def test_sans_planche_rangee_la_premiere_image_jointe_sert(client, tmp_path):
    """**Le cas réel de 26f07741** : aucune chose visée, la planche jointe à la
    main. Une référence libre du sujet part aussi, mais ce n'est pas elle."""
    chose = _creer(client)
    _jeu(client)
    libre = _image(client, tmp_path)
    _ranger(client, chose["identifiant"], libre, "libre")
    jointe = _image(client, tmp_path)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        references=[{"asset": jointe}],
        garder_mise_en_page=True,
    )

    assert envoi.status_code == 200, envoi.text
    lu = envoi.json()
    assert [l["asset"] for l in lu["images"]["lignes"]] == [jointe, libre]
    texte = lu["texte"]
    assert "Image 1 — THE CHARACTER SHEET TO REPRODUCE" in texte
    assert "Image 2 — THE SAME CHARACTER, already drawn" in texte
    assert "LAYOUT — reproduce the layout of Image 1" in texte


def test_la_planche_du_sujet_passe_avant_limage_jointe(client, tmp_path):
    chose = _creer(client)
    _jeu(client)
    planche = _image(client, tmp_path)
    _ranger(client, chose["identifiant"], planche, "planche")
    jointe = _image(client, tmp_path)

    lu = _envoi(
        client,
        personnage=chose["identifiant"],
        references=[{"asset": jointe}],
        garder_mise_en_page=True,
    ).json()

    # La jointe part en premier (l'ordre d'envoi ne bouge pas), mais c'est la
    # planche rangée qu'on reproduit.
    assert [l["asset"] for l in lu["images"]["lignes"]] == [jointe, planche]
    assert "Image 1 — THE SAME CHARACTER, already drawn" in lu["texte"]
    assert "Image 2 — THE CHARACTER SHEET TO REPRODUCE" in lu["texte"]
    assert "LAYOUT — reproduce the layout of Image 2" in lu["texte"]


# ── Les refus, avant de payer ───────────────────────────────────────────────


def test_sans_planche_ni_image_jointe_lappel_est_refuse_sans_payer(
    client, tmp_path, double
):
    chose = _creer(client)
    _jeu(client)
    # Une libre ne sert pas de modèle : rien ne dit que c'est une planche.
    _ranger(client, chose["identifiant"], _image(client, tmp_path), "libre")

    ecran = _envoi(client, personnage=chose["identifiant"], garder_mise_en_page=True)
    assert ecran.status_code == 409, ecran.text
    assert "garder la mise en page demande une planche" in ecran.text

    appel = _generer(client, personnage=chose["identifiant"], garder_mise_en_page=True)
    assert appel.status_code == 409, appel.text
    assert "rangez une référence en planche" in appel.text
    assert double.appels == 0
    # Rien d'enregistré non plus : seul l'import de l'image existe.
    assert [
        g["modele"] for g in client.get("/api/generations").json()["generations"]
    ] == ["import"]


def test_une_planche_decochee_ne_sert_pas(client, tmp_path, double):
    """Décocher la planche pour cet appel la retire aussi comme modèle."""
    chose = _creer(client)
    _jeu(client)
    planche = _image(client, tmp_path)
    _ranger(client, chose["identifiant"], planche, "planche")

    appel = _generer(
        client,
        personnage=chose["identifiant"],
        references_ecartees=[planche],
        garder_mise_en_page=True,
    )

    assert appel.status_code == 409, appel.text
    assert double.appels == 0


def test_une_case_visee_ou_un_lot_se_refusent(client, tmp_path, double):
    chose = _creer(client)
    _jeu(client)
    jointe = _image(client, tmp_path)

    for contexte in (
        {"pose": "marche"},
        {"pose": "marche", "direction": "sud"},
        {"pose": "marche", "directions": ["sud", "nord", "est", "ouest"]},
    ):
        appel = _generer(
            client,
            personnage=chose["identifiant"],
            references=[{"asset": jointe}],
            garder_mise_en_page=True,
            **contexte,
        )
        assert appel.status_code == 409, (contexte, appel.text)
        assert "garder la mise en page" in appel.text
    assert double.appels == 0


# ── L'appel, et sa relance ───────────────────────────────────────────────────


def test_lappel_part_avec_la_planche_et_garde_le_drapeau(client, tmp_path, double):
    chose = _creer(client)
    _jeu(client)
    planche = _image(client, tmp_path)
    _ranger(client, chose["identifiant"], planche, "planche")

    reponse = _generer(
        client, personnage=chose["identifiant"], garder_mise_en_page=True
    )

    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert generation["demande"]["garder_mise_en_page"] is True
    assert generation["references"] == [
        {"asset": planche, "role": "reference", "origine": "asset", "usage": "planche"}
    ]
    prompt = generation["demande"]["prompt"]
    assert UN_SEUL not in prompt and QUI_PRIME not in prompt and ISOLE not in prompt
    assert "Image 1 — THE CHARACTER SHEET TO REPRODUCE" in prompt
    _attendre(client, generation["identifiant"])
    assert double.appels == 1
    assert double.demandes[-1].garder_mise_en_page is True
    assert len(double.demandes[-1].references) == 1

    # **La relance relit le drapeau**, et renvoie le même texte.
    atelier = client.app.state.atelier
    relue = atelier.generations.demande_preparee(
        atelier.generations._base.lire(generation["identifiant"])
    )
    assert relue.garder_mise_en_page is True
    assert relue.prompt == prompt


def test_sans_la_case_la_generation_ne_porte_pas_la_cle(client, tmp_path, double):
    _jeu(client)
    reponse = _generer(client)

    assert reponse.status_code == 202, reponse.text
    generation = reponse.json()
    assert "garder_mise_en_page" not in generation["demande"]
    assert UN_SEUL in generation["demande"]["prompt"]
    _attendre(client, generation["identifiant"])
