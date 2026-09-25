# -*- coding: utf-8 -*-
"""La relecture croisée de la transparence native (TN2 à TN5), 25 septembre 2026.

Les défauts trouvés **aux coutures** entre les tranches, un essai par défaut,
chacun vérifié en défaisant son correctif (8octies). Le double est celui de TN2
(`DoubleCapable`, un modèle distant qui déclare la capacité) : la règle ne
distingue jamais le transport. Aucun appel payé, aucun ComfyUI réel.
"""

from __future__ import annotations

import pytest

from atelier.domaine.transparence import (
    FOND_TRANSPARENT,
    QUEUE,
    TETE,
    encadrer,
    sans_fond_colore,
)
from atelier.domaine.vue import phrase_de_calage
from tests.test_au15 import decor  # noqa: F401 — le stockage réel commun
from tests.test_tn2_texte import (
    CAPABLE,
    ORDINAIRE,
    DoubleCapable,
    _envoi,
    _sans_nom_de_fond,
)


@pytest.fixture
def double() -> DoubleCapable:
    return DoubleCapable()


# ── 1 · Un texte repris d'un appel sur fond coloré, vers un fond vide ────────
#
# « Reprendre les réglages » d'une image Qwen faite avant TN2 — ou refaite sur
# fond coloré (TN4) — rend un texte qui nomme sa couleur. Reparti vers un appel
# qui demande un fond vide, il était encadré de la consigne **en gardant** « on
# a flat solid #00B140 studio green background » : deux fonds dans le même texte.


def test_un_texte_repris_sur_fond_colore_perd_sa_couleur_quand_il_part_vers_un_fond_vide(
    client,
):
    colore = client.post(
        "/api/outgoing", json={"modele": ORDINAIRE, "prompt": "un nain"}
    ).json()
    assert "flat solid" in colore["texte"]  # le texte parti nommait bien un fond

    repris = _envoi(client, prompt=colore["texte"], repris=True)

    assert repris["fond"]["transparence"] is True
    assert repris["texte"].startswith(TETE) and repris["texte"].endswith(QUEUE)
    assert _sans_nom_de_fond(repris["texte"]) == []
    assert "flat" not in repris["texte"]
    assert "un nain" in repris["texte"]
    # Et le chemin de la soumission compose le même texte (une seule règle).
    assert repris["texte"] == encadrer(sans_fond_colore(colore["texte"]))


def test_l_aller_retour_fond_vide_fond_colore_fond_vide_ne_garde_aucune_couleur(client):
    """Refaire sur fond coloré (TN4), puis reprendre les réglages de ce second
    appel pour le relancer en fond vide : le texte revient propre."""
    transparent = _envoi(client)
    colore = _envoi(client, prompt=transparent["texte"], repris=True, fond_colore=True)
    assert colore["fond"]["transparence"] is False
    assert TETE not in colore["texte"] and "flat solid" in colore["texte"]

    retour = _envoi(client, prompt=colore["texte"], repris=True)

    assert retour["texte"].startswith(TETE) and retour["texte"].endswith(QUEUE)
    assert _sans_nom_de_fond(retour["texte"]) == []
    assert retour["texte"].count(TETE) == 1 and retour["texte"].count(QUEUE) == 1


def test_le_calage_de_grille_reste_quand_la_pose_sur_un_fond_tombe():
    pixel = f"CONTEXT\n\nTechnical constraints: {phrase_de_calage(64, '#FF00FF')}\n\nREQUEST\n\nun nain"
    assert sans_fond_colore(pixel) == (
        f"CONTEXT\n\nTechnical constraints: {phrase_de_calage(64, FOND_TRANSPARENT)}"
        "\n\nREQUEST\n\nun nain"
    )
    # Seule sur sa ligne : l'intitulé et le titre vides tombent avec elle.
    seule = f"CONTEXT\n\nTechnical constraints: {phrase_de_calage(0, '#00B140')}\n\nREQUEST\n\nun nain"
    assert sans_fond_colore(seule) == "REQUEST\n\nun nain"
    # Un style local, à virgules.
    local = f"yotostyle, un nain, {phrase_de_calage(0, '#FF00FF')}, idle stance"
    assert sans_fond_colore(local) == "yotostyle, un nain, idle stance"
    # Sans la phrase, au caractère près.
    assert sans_fond_colore("un nain sur fond vert, a flat design") == "un nain sur fond vert, a flat design"


def test_un_texte_non_repris_n_est_jamais_touche(client):
    """La bible de l'auteur peut dire les mêmes mots : elle ne cède jamais."""
    from atelier.domaine.projet import CHAMPS_BIBLE

    ecrit = "single isolated sprite on a flat background"
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": ecrit if nom == "technique" else "", "actif": True}
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text

    assert ecrit in _envoi(client)["texte"]


async def test_un_style_local_montre_ce_que_son_texte_dit(tmp_path, double):
    """Les morceaux et les jetons d'un style local suivent le texte : repris
    encadré puis envoyé sans fond vide, la consigne quitte les morceaux, la
    phrase du fond y entre, et les jetons se recomptent ; repris encadré puis
    envoyé en fond vide, la consigne n'y paraît qu'une fois."""
    from atelier.domaine import texte_local
    from atelier.services import Atelier
    from tests.test_a9 import AnimateurDouble
    from tests.test_au7_au8 import ComfyDouble, ajouter, raccorder
    from tests.test_qwen21 import _profil_capable

    comfy = ComfyDouble()
    atelier = Atelier(
        racine=tmp_path / "donnees",
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurDouble(),
    )
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    try:
        p = await ajouter(atelier, comfy, _profil_capable(transparence=True))
        projet = atelier.bibliotheque.courant
        parti = atelier.generations.apercu("un nain", projet=projet, modele=p["modele"])["texte"]
        assert parti.startswith(TETE)

        colore = atelier.generations.apercu(
            parti, repris=True, projet=projet, modele=p["modele"], fond_colore=True
        )
        assert TETE not in colore["texte"]
        morceaux = " ".join(s["texte"] for s in colore["local"]["segments"])
        assert TETE not in morceaux and QUEUE not in morceaux
        assert "flat solid" in morceaux and "flat solid" in colore["texte"]
        assert colore["local"]["jetons"] == texte_local.compter_jetons(colore["texte"])
        # Le déclencheur du style n'est posé qu'une fois.
        declencheur = parti.removeprefix(TETE).strip().split(",")[0]
        assert colore["texte"].count(f"{declencheur},") == 1

        # Reprendre tel quel un texte parti en fond vide redonne ce texte-là :
        # la consigne en tête, le déclencheur derrière elle, une seule fois.
        vide = atelier.generations.apercu(parti, repris=True, projet=projet, modele=p["modele"])
        assert vide["texte"] == parti
        morceaux = " ".join(s["texte"] for s in vide["local"]["segments"])
        assert morceaux.count(TETE) == 1 and morceaux.count(QUEUE) == 1
    finally:
        await atelier.file_locale.fermer()


# ── 2 · Une planche composée hors du pliage ne demande pas de fond vide ──────
#
# La planche d'équipement plie ses cases elle-même et n'envoie à `preparer`
# qu'une image à éditer : rien n'y voyait une planche, et un modèle capable
# recevait la consigne de transparence — le cas même que TN2 écarte (la robe
# blanche du mage, trouée sur une planche).


async def test_une_planche_d_equipement_ne_demande_pas_le_fond_vide(decor, atelier, double):
    _, chemin, _, corps, _ = decor
    travail = await atelier.travaux_equipement.preparer(
        *chemin,
        {
            "cle": "casque",
            "modele": CAPABLE,
            "reservation_par_appel_usd": 0.12,
            "cibles": [{"nature": "image", "resultat": corps}],
        },
    )

    generation = atelier.base.lire(travail["appels"][0]["generation"])
    assert not generation.demande.get("transparence")
    assert TETE not in generation.demande["prompt"]
    assert QUEUE not in generation.demande["prompt"]
    assert double.appels == 0
