# -*- coding: utf-8 -*-
"""Les critères d'acceptation de SC3 — le texte qui part.

**Ce que la tranche ajoute.** SC1 a fait du style une donnée du jeu, SC2 a dit
*qui* se bat dans quel style. SC3 compose enfin le texte qui part vraiment :
la phrase de la direction, puis le texte du style du personnage pour ce
mouvement s'il en dit un, sinon le texte du mouvement — exactement comme
`texte_du_clip` composait déjà la direction et le mouvement en `A6`.

Les trois critères du plan, dans l'ordre où il les énonce :

1. une attaque vers le nord d'un personnage dont le style résolu est
   « bâton » part avec la phrase du nord puis le texte d'attaque du bâton ;
2. un mouvement que le style ne dit pas (« saut ») part avec le texte du
   mouvement ;
3. l'écran d'un clip montre exactement ce texte avant l'envoi — vérifié ici
   par la route qu'il interroge — et un texte relu part tel quel.

**Aucun essai ne coûte un centime** : le fournisseur vidéo est doublé
(`test_a9.animateur`), et la route `for-pose` n'appelle jamais personne.
"""

from __future__ import annotations

from atelier.domaine.direction import PHRASES_ANIMEES
from atelier.domaine.style import LIVRES as STYLES_LIVRES

_BATON = next(s for s in STYLES_LIVRES if s.identifiant == "baton")


def _projet(atelier) -> str:
    return atelier.bibliotheque.courant


def _avec_le_nord(client, atelier) -> str:
    """Le jeu d'essai n'a pas de vue déclarée : on lui donne le nord."""
    projet = _projet(atelier)
    connues = client.get("/api/characters/directions").json()["directions"]
    if not any(d["identifiant"] == "nord" for d in connues):
        assert client.post("/api/characters/directions", json={"nom": "nord"}).status_code == 201
    return projet


def _creer_personnage(client, projet: str, nom: str = "Champy") -> str:
    reponse = client.post(
        "/api/characters", json={"nom": nom, "description": nom, "projet": projet}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _choisir_style(client, projet: str, personnage: str, style: str) -> None:
    reponse = client.put(
        f"/api/characters/{personnage}/combat-style?projet={projet}",
        json={"style": style},
    )
    assert reponse.status_code == 200, reponse.text


# ── Critère 1 — l'attaque au bâton, vers le nord ─────────────────────────────


def test_une_attaque_au_baton_vers_le_nord_part_avec_la_phrase_du_nord_et_le_texte_du_baton(
    client, atelier
):
    """*Une attaque vers le nord de Champy part avec la phrase du nord puis le
    texte d'attaque du bâton à deux mains.*"""
    projet = _avec_le_nord(client, atelier)
    champy = _creer_personnage(client, projet)
    _choisir_style(client, projet, champy, "baton")

    recu = client.get(
        f"/api/movements/for-pose/attaque?projet={projet}&direction=nord&personnage={champy}"
    ).json()

    texte_du_baton = _BATON.texte("attaque")
    assert recu["geste"] == texte_du_baton
    assert recu["texte"] == f'{PHRASES_ANIMEES["nord"]} {texte_du_baton}'
    assert recu["style"]["identifiant"] == "baton"
    assert recu["origine_du_style"] == "choisi"


def test_le_baton_porte_en_calque_donne_son_texte_et_se_nomme(client, atelier, tmp_path):
    """Le même texte quand le style vient du bâton porté plutôt que d'un choix
    — et la route nomme la pièce, pour que l'écran dise « hérité de … »."""
    from tests.test_sc2_style_du_personnage import _declarer, _piece, _porter_en_calque

    projet = _avec_le_nord(client, atelier)
    champy = _creer_personnage(client, projet)
    baton = _piece(client, projet, "Bâton de chêne")
    _porter_en_calque(client, atelier, tmp_path, champy, baton)
    assert _declarer(client, projet, baton, "baton").status_code == 200

    recu = client.get(
        f"/api/movements/for-pose/attaque?projet={projet}&direction=nord&personnage={champy}"
    ).json()

    assert recu["texte"] == f'{PHRASES_ANIMEES["nord"]} {_BATON.texte("attaque")}'
    assert recu["origine_du_style"] == "piece"
    assert recu["piece_du_style"] == {"identifiant": baton, "nom": "Bâton de chêne"}


# ── Critère 2 — un mouvement que le style ne dit pas ─────────────────────────


def test_un_mouvement_que_le_style_ne_dit_pas_part_avec_le_texte_du_mouvement(
    client, atelier
):
    """*Un mouvement que le style ne dit pas (ex. « saut ») part avec le texte
    du mouvement.* Le bâton dit « attaque » et « repos » — pas « saut »."""
    projet = _projet(atelier)
    champy = _creer_personnage(client, projet)
    _choisir_style(client, projet, champy, "baton")
    assert _BATON.texte("saut") == ""

    recu = client.get(
        f"/api/movements/for-pose/saut?projet={projet}&personnage={champy}"
    ).json()
    texte_du_mouvement = client.get(f"/api/movements?projet={projet}").json()
    saut = next(m for m in texte_du_mouvement["mouvements"] if m["identifiant"] == "saut")

    assert recu["geste"] == saut["texte"]
    # Le style est bien résolu — l'écran peut dire « bâton » à côté — mais il
    # ne change rien au texte de ce mouvement-ci, qu'il ne dit pas.
    assert recu["style"]["identifiant"] == "baton"


def test_sans_personnage_connu_rien_ne_change(client, atelier):
    """*Ne rien changer quand aucun personnage n'est connu.* Le géant, avant
    SC3 : la case d'un mouvement sans personnage donne le texte du mouvement,
    sans qu'aucun style ne soit deviné."""
    projet = _avec_le_nord(client, atelier)
    recu = client.get(
        f"/api/movements/for-pose/attaque?projet={projet}&direction=nord"
    ).json()
    attaque = next(
        m
        for m in client.get(f"/api/movements?projet={projet}").json()["mouvements"]
        if m["identifiant"] == "attaque"
    )
    assert recu["geste"] == attaque["texte"]
    assert recu["style"] is None
    assert recu["origine_du_style"] == "aucun"


# ── Critère 3 — ce qui part vraiment, par une fabrication suivie ─────────────
#
# **RV5/RV6** : `POST /clips` composait ce texte dans la couche API et prenait
# un `prompt` explicite en priorité (retirée le 21 septembre 2026). Le nouveau
# circuit compose une fois pour toutes dans `ServiceTravaux.preparer`, par le
# même compositeur (`services/texte_clip.composer`) — E14, la relecture montre
# `demande.prompt_video`, et c'est ce champ-là qu'on vérifie ici. Un texte ne
# se corrige plus en l'écrasant : `correction_geste` porte la correction, et
# la phrase de direction reste en tête (voir aussi `tests/test_rv5_serie.py`).

from test_a9 import MELE, animateur, atelier_video, client_video  # noqa: E402,F401
from test_a10 import un_personnage, un_sprite  # noqa: E402,F401


async def test_un_clip_commande_au_baton_vers_le_nord_part_avec_la_phrase_et_le_texte_du_baton(
    client_video, atelier_video, animateur
):
    """La fabrication suivie compose exactement ce texte avant l'envoi —
    vérifié ici sur ce que le serveur conserve pour l'appel, sa seule source
    de vérité (`SC3`, E14)."""
    projet = _avec_le_nord(client_video, atelier_video)
    sprite = un_sprite(client_video)
    champy = un_personnage(client_video, "Champy")
    # **Le clip doit porter le personnage** — sans quoi il n'y a personne dont
    # résoudre le style, et c'est tout l'intérêt du critère.
    assert client_video.put(
        f"/api/assets/{sprite}/character", json={"personnage": champy}
    ).status_code == 200
    _choisir_style(client_video, projet, champy, "baton")

    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "sc3-baton", "personnage": champy, "pose": "attaque", "direction": "nord",
        "modele_video": MELE.identifiant, "mouvement": "attaque", "reference_asset": sprite,
    })
    assert travail["demande"]["prompt_video"] == f'{PHRASES_ANIMEES["nord"]} {_BATON.texte("attaque")}'


async def test_une_correction_du_geste_part_telle_quelle_meme_avec_un_style_pose(
    client_video, atelier_video, animateur
):
    """*Une correction du geste part telle quelle* — le style ne s'invite pas
    dans une correction que l'auteur vient de faire pour cet appel, et la
    phrase de direction reste en tête."""
    projet = _avec_le_nord(client_video, atelier_video)
    sprite = un_sprite(client_video)
    champy = un_personnage(client_video, "Champy")
    client_video.put(f"/api/assets/{sprite}/character", json={"personnage": champy})
    _choisir_style(client_video, projet, champy, "baton")

    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "sc3-correction", "personnage": champy, "pose": "attaque", "direction": "nord",
        "modele_video": MELE.identifiant, "mouvement": "attaque", "reference_asset": sprite,
        "correction_geste": "my own words",
    })
    assert travail["demande"]["prompt_video"] == f'{PHRASES_ANIMEES["nord"]} my own words'
