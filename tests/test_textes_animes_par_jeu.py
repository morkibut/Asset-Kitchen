# -*- coding: utf-8 -*-
"""Les textes d'une animation : propres à chaque jeu, et la direction en tête.

Demandé par l'auteur le 18 septembre 2026. Il écrivait à la main *The character
is shown from behind, running north* pour que la course vers le nord garde le
dos du personnage, et un style d'attaque n'a pas sa place dans tous les jeux.
Aucun essai ne coûte un centime.
"""

from __future__ import annotations

from atelier.domaine.direction import (
    PHRASES_ANIMEES,
    Direction,
    phrase_animee,
    texte_du_clip,
)


def _projet(atelier) -> str:
    return atelier.bibliotheque.courant


def _avec_le_nord(client, atelier) -> str:
    """Le jeu d'essai n'a pas de vue déclarée : on lui donne le nord."""
    projet = _projet(atelier)
    connues = client.get("/api/characters/directions").json()["directions"]
    if not any(d["identifiant"] == "nord" for d in connues):
        assert client.post("/api/characters/directions", json={"nom": "nord"}).status_code == 201
    return projet


# ── La direction en tête ────────────────────────────────────────────────────


def test_le_nord_se_dit_de_dos_et_vers_le_haut_de_l_image():
    phrase = phrase_animee(Direction("nord", "nord"))
    assert "from behind" in phrase and "top of the image" in phrase


def test_la_phrase_ecrite_par_l_auteur_passe_devant_la_livree():
    assert phrase_animee(Direction("nord", "nord", animation="Back view.")) == "Back view."


def test_une_direction_inventee_ne_fait_rien_inventer():
    assert phrase_animee(Direction("vers-la-mer", "vers la mer")) == ""
    assert "vers-la-mer" not in PHRASES_ANIMEES


def test_la_direction_passe_avant_le_mouvement_en_deux_phrases():
    assert texte_du_clip("Seen from behind.", "running cycle") == (
        "Seen from behind. running cycle"
    )
    assert texte_du_clip("", "running cycle") == "running cycle"


def test_l_ecran_voit_le_texte_qui_partira_pour_une_direction(client, atelier):
    projet = _avec_le_nord(client, atelier)
    recu = client.get(
        f"/api/movements/for-pose/course?projet={projet}&direction=nord"
    ).json()
    assert recu["direction"] == PHRASES_ANIMEES["nord"]
    assert recu["texte"].startswith(PHRASES_ANIMEES["nord"])
    assert "running cycle" in recu["geste"] and recu["geste"] in recu["texte"]


def test_sans_direction_le_texte_reste_celui_du_mouvement(client):
    recu = client.get("/api/movements/for-pose/course").json()
    assert recu["direction"] == "" and recu["texte"] == recu["geste"]


def test_la_phrase_d_une_direction_se_corrige_une_fois_pour_le_jeu(client, atelier):
    projet = _avec_le_nord(client, atelier)
    reponse = client.put(
        "/api/characters/directions/nord",
        json={"projet": projet, "animation": "  Back to the camera.  "},
    )
    assert reponse.status_code == 200, reponse.text
    nord = next(d for d in reponse.json()["directions"] if d["identifiant"] == "nord")
    assert nord["animation"] == "Back to the camera."
    assert reponse.json()["phrases_livrees"]["nord"] == PHRASES_ANIMEES["nord"]

    recu = client.get(
        f"/api/movements/for-pose/course?projet={projet}&direction=nord"
    ).json()
    assert recu["texte"].startswith("Back to the camera. ")


# ── Les mouvements propres à un jeu ─────────────────────────────────────────


def test_un_jeu_lit_la_bibliotheque_de_l_atelier_tant_qu_il_n_a_rien_change(client, atelier):
    projet = _projet(atelier)
    recu = client.get(f"/api/movements?projet={projet}").json()
    assert recu["propres_au_jeu"] is False
    assert any(m["identifiant"] == "attaque" for m in recu["mouvements"])


def test_retoucher_un_mouvement_d_un_jeu_ne_touche_pas_les_autres(client, atelier):
    premier = _projet(atelier)
    texte = "attack, a straight punch with the right fist, back to guard"
    reponse = client.put(
        f"/api/movements/attaque?projet={premier}", json={"texte": texte}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["propres_au_jeu"] is True

    second = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()
    second = second["projet"]["identifiant"]

    def attaque(projet: str | None) -> str:
        url = "/api/movements" + (f"?projet={projet}" if projet else "")
        return next(
            m["texte"]
            for m in client.get(url).json()["mouvements"]
            if m["identifiant"] == "attaque"
        )

    assert attaque(premier) == texte
    assert attaque(second) != texte, "l'autre jeu garde la bibliothèque de départ"
    assert attaque(None) != texte, "la bibliothèque de l'atelier n'a pas bougé"


def test_un_jeu_inconnu_ne_s_ecrit_pas(client):
    reponse = client.put("/api/movements/attaque?projet=..", json={"texte": "x"})
    assert reponse.status_code in (400, 409)
    assert "jeu" in reponse.json()["raison"]


# ── Ce qui part vraiment ────────────────────────────────────────────────────

from test_a9 import MELE, atelier_video, client_video, animateur  # noqa: E402,F401
from test_a10 import un_sprite  # noqa: E402


def test_un_clip_commande_vers_le_nord_part_avec_la_phrase_du_nord(
    client_video, atelier_video, animateur
):
    projet = _avec_le_nord(client_video, atelier_video)
    sprite = un_sprite(client_video)

    lot = client_video.post(
        "/api/clips",
        json={
            "modele": MELE.identifiant,
            "mouvement": "course",
            "asset": sprite,
            "direction": "nord",
            "projet": projet,
        },
    )

    assert lot.status_code == 202, lot.text
    texte = lot.json()["clips"][0]["demande"]["prompt"]
    assert texte.startswith(PHRASES_ANIMEES["nord"]) and "running cycle" in texte


def test_un_texte_relu_part_tel_quel_sans_phrase_ajoutee(
    client_video, atelier_video, animateur
):
    projet = _avec_le_nord(client_video, atelier_video)
    sprite = un_sprite(client_video)

    lot = client_video.post(
        "/api/clips",
        json={
            "modele": MELE.identifiant,
            "mouvement": "course",
            "prompt": "my own words",
            "asset": sprite,
            "direction": "nord",
            "projet": projet,
        },
    )

    assert lot.json()["clips"][0]["demande"]["prompt"] == "my own words"
