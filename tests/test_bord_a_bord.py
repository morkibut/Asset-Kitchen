# -*- coding: utf-8 -*-
"""Le cadrage bord à bord — une tuile n'est pas un sprite, une icône n'a rien autour.

**Le défaut est payé sur Cœur de Pierre le 10 octobre 2026**
(`docs/releves/2026-10-10-lot1-parois-coeur-de-pierre.md`, défauts 3 et 9) :

· une tuile partait avec le cadrage d'un sprite — « single isolated sprite on a
  flat background », puis « one single sprite and nothing else… the subject is
  centred » —, l'inverse d'une texture bord à bord ;
· la lumière du jeu disait « surrounded by absolute blackness », et sur une
  icône transparente le modèle peignait ce noir : un carré opaque que le
  détourage par le bord ne voyait pas. Aucune des douze icônes du lot n'en
  sortait détourée.

**Ce qui est vérifié ici** : la lumière reste et seul ce qui entoure le sujet
tombe ; une tuile perd le cadrage de sprite ; un personnage ne change pas d'un
caractère ; l'écran montre barré ce qui a été retiré ; et la soumission envoie
le texte montré. Aucun appel payé.
"""

from __future__ import annotations

import time

from atelier.domaine.projet import CHAMPS_BIBLE
from atelier.domaine.vue import (
    CADRE,
    POSE_BORD_A_BORD,
    calage_bord_a_bord,
    eclairage_sans_entourage,
)
from tests.test_tn2_texte import CAPABLE, ORDINAIRE, double  # noqa: F401 — la fixture

LUMIERE = (
    "Dynamic warm radial lighting (lanterns, forge heat, glowing runes) "
    "surrounded by absolute blackness, sharp light falloff"
)
LUMIERE_SEULE = "Dynamic warm radial lighting (lanterns, forge heat, glowing runes), sharp light falloff"


def _bible(client) -> None:
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {
                    "nom": nom,
                    "texte": {"eclairage": LUMIERE, "trait": "1-pixel dark slate outline"}.get(nom, ""),
                    "actif": True,
                }
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text


def _envoi(client, **corps) -> dict:
    reponse = client.post("/api/outgoing", json={"prompt": "a cracked stone wall", **corps})
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _ligne(envoi: dict, nom: str) -> dict:
    return next(ligne for ligne in envoi["lignes"] if ligne["nom"] == nom)


# ── Les deux règles, à un seul endroit ───────────────────────────────────────


def test_la_lumiere_reste_et_seul_ce_qui_entoure_tombe():
    assert eclairage_sans_entourage(LUMIERE) == LUMIERE_SEULE
    assert eclairage_sans_entourage("warm torchlight against the darkness") == "warm torchlight"
    assert eclairage_sans_entourage("Moody light, surrounded by pitch black void.") == "Moody light."


def test_une_lumiere_sans_entourage_ressort_au_caractere_pres():
    for texte in (
        "flat even light, no directional shadow",
        "backlight, rim-lit silhouette, dark front",
        "forge light, hot orange glow from below",
        "",
    ):
        assert eclairage_sans_entourage(texte) == texte


def test_une_tuile_ne_se_pose_plus_sur_un_fond():
    assert calage_bord_a_bord(
        "single isolated sprite on a flat solid #00FFFF cyan background, strict 64x64 px tile snap"
    ) == f"{POSE_BORD_A_BORD}, strict 64x64 px tile snap"
    assert calage_bord_a_bord("single isolated sprite on a flat background") == POSE_BORD_A_BORD
    # L'angle de vue reste ; le centrage d'un sujet, non.
    assert calage_bord_a_bord("3/4 top-down orthographic view, subject centered") == (
        "3/4 top-down orthographic view"
    )
    # Un texte d'auteur qui ne porte pas la phrase du produit ressort tel quel.
    assert calage_bord_a_bord("grid-aligned tile assets") == "grid-aligned tile assets"


# ── Une tuile ────────────────────────────────────────────────────────────────


def test_une_tuile_part_bord_a_bord_et_garde_sa_lumiere(client):
    _bible(client)

    for echelle in ("tuile", "décor", "matière"):
        envoi = _envoi(client, modele=ORDINAIRE, echelle=echelle)
        texte = envoi["texte"]
        assert "isolated sprite" not in texte, echelle
        assert POSE_BORD_A_BORD in texte, echelle
        assert CADRE not in texte, echelle
        assert "blackness" not in texte, echelle
        assert LUMIERE_SEULE in texte, echelle
        # La direction artistique, elle, part toujours.
        assert "1-pixel dark slate outline" in texte, echelle


def test_l_ecran_montre_barre_ce_que_la_tuile_a_retire(client):
    _bible(client)

    lumiere = _ligne(_envoi(client, modele=ORDINAIRE, echelle="tuile"), "eclairage")

    assert lumiere["texte"] == LUMIERE_SEULE
    assert lumiere["remplace"] == LUMIERE
    assert lumiere["raison"]


def test_un_personnage_part_comme_avant(client):
    _bible(client)

    for echelle in ("", "personnage", "objet posé"):
        texte = _envoi(client, modele=ORDINAIRE, echelle=echelle)["texte"]
        assert "single isolated sprite on a flat" in texte, echelle
        assert CADRE in texte, echelle
        assert LUMIERE in texte, echelle


# ── Une icône transparente ───────────────────────────────────────────────────


def test_une_icone_transparente_n_a_plus_de_noir_autour(client):
    _bible(client)

    envoi = _envoi(client, modele=CAPABLE, echelle="élément d'interface")

    assert envoi["fond"]["transparence"] is True
    assert "blackness" not in envoi["texte"]
    assert LUMIERE_SEULE in envoi["texte"]
    # Elle reste un sujet seul au milieu de son cadre : c'est une icône.
    assert CADRE in envoi["texte"]


def test_la_meme_icone_sur_fond_colore_garde_sa_lumiere_entiere(client):
    """Le noir autour n'est retiré que là où il contredit l'appel : sur un
    modèle qui ne rend pas de fond vide, le sujet est posé sur une couleur, et
    la bible part entière."""
    _bible(client)

    texte = _envoi(client, modele=ORDINAIRE, echelle="élément d'interface")["texte"]

    assert LUMIERE in texte


# ── Ce qui est montré est ce qui part ────────────────────────────────────────


def test_la_soumission_d_une_tuile_envoie_le_texte_montre(client, double):  # noqa: F811
    _bible(client)
    montre = _envoi(client, modele=ORDINAIRE, echelle="tuile")["texte"]

    reponse = client.post(
        "/api/generations",
        json={"modele": ORDINAIRE, "prompt": "a cracked stone wall", "echelle": "tuile"},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(80):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)

    assert lue["statut"] == "reussie", lue
    assert lue["demande"]["prompt"] == montre
    assert "blackness" not in double.demandes[-1].prompt


# ── La fiche ouvre une tuile pavée 3 × 3 ─────────────────────────────────────


def _image(client, echelle: str) -> str:
    reponse = client.post(
        "/api/generations",
        json={"modele": ORDINAIRE, "prompt": "a cracked stone wall", "echelle": echelle},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(80):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return f"{identifiant}-0"


def test_la_fiche_sait_qu_une_tuile_remplit_son_cadre(client):
    for echelle, attendu in (("tuile", True), ("matière", True), ("personnage", False), ("", False)):
        imposee = client.get(f"/api/assets/{_image(client, echelle)}/imposed")
        assert imposee.status_code == 200, imposee.text
        assert imposee.json()["bord_a_bord"] is attendu, echelle
