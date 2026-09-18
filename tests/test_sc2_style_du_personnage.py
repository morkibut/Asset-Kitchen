# -*- coding: utf-8 -*-
"""Les critères d'acceptation de SC2 — le style d'un personnage, et celui d'une pièce.

**Ce que la tranche ajoute.** SC1 a fait du style une donnée du jeu ; SC2 dit
*qui* se bat dans quel style. Deux façons d'en avoir un : le choisir sur le
personnage, ou l'hériter d'une pièce qu'il porte **en calque sur ses poses**
et qui en déclare un. La résolution est *choisi → pièce portée → aucun*, et
**rien n'est deviné d'après un nom**.

**Les choix vivent dans `projets/<id>/styles-choisis.json`**, pas sur le
personnage ni sur la pièce — décision de la tranche, pour ne pas faire passer
un choix de style par l'écrivain de la production.

Le calque se pose comme dans `test_b9` : une image importée, rangée dans une
case, puis devenue calque d'une pièce en écrivant son champ `piece`. **Aucun
essai ne coûte un centime** : rien n'est généré.
"""

from __future__ import annotations

import itertools
from dataclasses import replace

from tests.conftest import image_sujet

_DISTINCTES = itertools.count(3)


# ── Le montage ───────────────────────────────────────────────────────────────


def _projet(atelier) -> str:
    return atelier.bibliotheque.courant


def _creer(client, projet: str, nom: str = "Champy") -> str:
    reponse = client.post(
        "/api/characters", json={"nom": nom, "description": nom, "projet": projet}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _piece(client, projet: str, nom: str, emplacement: str = "mains") -> str:
    reponse = client.post(
        "/api/characters/pieces",
        json={"nom": nom, "emplacement": emplacement, "projet": projet},
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["piece"]["identifiant"]


def _porter_en_calque(client, atelier, tmp_path, personnage: str, piece: str) -> None:
    """Une image rangée dans la première case du personnage, devenue calque de la pièce."""
    pose = client.get("/api/characters").json()["plan"][0]["identifiant"]
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{personnage}-{piece}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": personnage, "pose": pose},
    )
    assert reponse.status_code == 200, reponse.text
    lu = atelier.base.lire_asset(asset["identifiant"])
    atelier.assets.sauver(replace(lu, piece=piece))


def _style_de(client, projet: str, personnage: str) -> dict:
    reponse = client.get(f"/api/styles/for-character/{personnage}?projet={projet}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _declarer(client, projet: str, piece: str, style: str | None):
    return client.put(
        f"/api/characters/pieces/{piece}/combat-style?projet={projet}",
        json={"style": style},
    )


def _choisir(client, projet: str, personnage: str, style: str | None):
    return client.put(
        f"/api/characters/{personnage}/combat-style?projet={projet}",
        json={"style": style},
    )


# ── Les trois critères du plan ───────────────────────────────────────────────


def test_la_piece_portee_en_calque_donne_son_style_sans_qu_on_le_choisisse(
    client, atelier, tmp_path
):
    """*Un personnage qui porte le bâton en calque, et dont le bâton déclare
    « bâton à deux mains », a ce style sans qu'on le choisisse.*"""
    projet = _projet(atelier)
    champy = _creer(client, projet)
    baton = _piece(client, projet, "Bâton de chêne")
    _porter_en_calque(client, atelier, tmp_path, champy, baton)
    assert _declarer(client, projet, baton, "baton").status_code == 200

    recu = _style_de(client, projet, champy)
    assert recu["origine"] == "piece"
    # **La pièce nommée** (SC4) — la fiche du personnage dit « celui du Bâton
    # de chêne », pas « celui du baton-1 » : l'identifiant seul ne le permet
    # pas, même remède que `_style_du_personnage` pour la route du clip.
    assert recu["piece"] == {"identifiant": baton, "nom": "Bâton de chêne"}
    assert recu["style"]["identifiant"] == "baton"


def test_le_style_choisi_passe_devant_celui_de_la_piece(client, atelier, tmp_path):
    """*Un style choisi sur le personnage passe devant celui de la pièce* — et
    le retirer laisse reparaître celui de la pièce."""
    projet = _projet(atelier)
    champy = _creer(client, projet)
    baton = _piece(client, projet, "Bâton de chêne")
    _porter_en_calque(client, atelier, tmp_path, champy, baton)
    _declarer(client, projet, baton, "baton")

    choisi = _choisir(client, projet, champy, "karate")
    assert choisi.status_code == 200, choisi.text
    assert choisi.json()["origine"] == "choisi"
    assert choisi.json()["style"]["identifiant"] == "karate"
    assert _style_de(client, projet, champy)["style"]["identifiant"] == "karate"

    retire = _choisir(client, projet, champy, None).json()
    assert retire["origine"] == "piece"
    assert retire["style"]["identifiant"] == "baton"


def test_sans_choix_ni_piece_declaree_aucun_style_rien_n_est_devine(
    client, atelier, tmp_path
):
    """*Un personnage sans style ni pièce qui en déclare un n'a aucun style.*

    La pièce s'appelle « bâton » et elle est portée en calque — mais elle ne
    déclare rien, et un nom ne vaut pas une déclaration."""
    projet = _projet(atelier)
    champy = _creer(client, projet)
    baton = _piece(client, projet, "bâton")
    _porter_en_calque(client, atelier, tmp_path, champy, baton)

    recu = _style_de(client, projet, champy)
    assert recu == {"personnage": champy, "style": None, "origine": "aucun", "piece": None}


def test_une_piece_qui_n_est_pas_portee_ne_donne_rien(client, atelier):
    """Déclarer un style sur une pièce ne le donne qu'à qui la porte en calque."""
    projet = _projet(atelier)
    champy = _creer(client, projet)
    baton = _piece(client, projet, "Bâton de chêne")
    _declarer(client, projet, baton, "baton")
    assert _style_de(client, projet, champy)["origine"] == "aucun"


# ── Les refus ────────────────────────────────────────────────────────────────


def test_un_style_inconnu_est_refuse(client, atelier):
    projet = _projet(atelier)
    champy = _creer(client, projet)
    baton = _piece(client, projet, "Bâton de chêne")

    sur_le_personnage = _choisir(client, projet, champy, "nunchaku")
    assert sur_le_personnage.status_code == 409
    assert "nunchaku" in sur_le_personnage.json()["raison"]

    sur_la_piece = _declarer(client, projet, baton, "nunchaku")
    assert sur_la_piece.status_code == 409
    assert _style_de(client, projet, champy)["origine"] == "aucun"


def test_un_style_masque_est_refuse(client, atelier):
    projet = _projet(atelier)
    champy = _creer(client, projet)
    client.delete(f"/api/styles/lance?projet={projet}")
    reponse = _choisir(client, projet, champy, "lance")
    assert reponse.status_code == 409
    assert "masqué" in reponse.json()["raison"]


def test_une_piece_ou_un_personnage_inconnus_sont_refuses(client, atelier):
    projet = _projet(atelier)
    assert _declarer(client, projet, "piece-fantome", "baton").status_code == 409
    assert _choisir(client, projet, "personne", "baton").status_code == 404
    assert client.get(
        f"/api/styles/for-character/personne?projet={projet}"
    ).status_code == 404


def test_un_identifiant_vide_est_refuse(atelier):
    projet = _projet(atelier)
    for geste in (
        atelier.styles.choisir_pour_le_personnage,
        atelier.styles.choisir_pour_la_piece,
    ):
        try:
            geste(projet, "  ", "baton")
        except Exception as erreur:  # noqa: BLE001 — on lit le code, pas la classe
            assert getattr(erreur, "code", "") == "style_refuse"
        else:
            raise AssertionError("un identifiant vide aurait dû être refusé")


# ── L'ordre, et le cloisonnement des jeux ────────────────────────────────────


def test_deux_pieces_qui_declarent_un_style_l_ordre_de_la_garde_robe_decide(
    client, atelier, tmp_path
):
    """Deux pièces portées déclarent chacune un style : **la première dans
    l'ordre de la garde-robe** gagne — emplacements par rang. L'ordre de pose
    des calques n'y est pour rien."""
    projet = _projet(atelier)
    champy = _creer(client, projet)
    arc = _piece(client, projet, "Arc court", emplacement="dos")
    lance = _piece(client, projet, "Lance", emplacement="mains")
    _porter_en_calque(client, atelier, tmp_path, champy, lance)
    _porter_en_calque(client, atelier, tmp_path, champy, arc)
    _declarer(client, projet, lance, "lance")
    _declarer(client, projet, arc, "arc")

    # « dos » a été nommé en premier : il a le premier rang.
    assert _style_de(client, projet, champy)["piece"]["identifiant"] == arc

    rangs = {e.identifiant: e.rang for e in atelier.equipement.emplacements(projet)}
    mains = next(p.emplacement for p in atelier.equipement.pieces(projet) if p.identifiant == lance)
    atelier.equipement.regler_emplacement(projet, mains, rang=min(rangs.values()) - 1)
    assert _style_de(client, projet, champy)["piece"]["identifiant"] == lance


def test_un_jeu_n_influence_pas_un_autre(client, atelier, tmp_path):
    """Un choix appartient au jeu où il est fait : le même identifiant de
    personnage dans un autre jeu n'en hérite pas."""
    premier = _projet(atelier)
    champy = _creer(client, premier)
    assert _choisir(client, premier, champy, "baton").status_code == 200

    second = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()
    second = second["projet"]["identifiant"]
    homonyme = _creer(client, second)
    assert homonyme == champy, "même nom, même identifiant — c'est tout le piège"

    assert _style_de(client, second, homonyme)["origine"] == "aucun"
    assert atelier.styles.choix_en_json(second) == {"personnages": {}, "pieces": {}}
    assert _style_de(client, premier, champy)["style"]["identifiant"] == "baton"


def test_le_choix_s_ecrit_dans_le_fichier_du_jeu_et_pas_sur_le_personnage(
    client, atelier
):
    projet = _projet(atelier)
    champy = _creer(client, projet)
    _choisir(client, projet, champy, "baton")
    chemin = atelier.fichiers.styles_choisis_du_jeu(projet)
    assert chemin.is_file()
    assert atelier.fichiers.lire_styles_choisis(projet)["personnages"] == {champy: "baton"}


def test_un_jeu_inconnu_ne_s_ecrit_pas(client):
    reponse = client.put(
        "/api/characters/pieces/baton/combat-style?projet=..", json={"style": "baton"}
    )
    assert reponse.status_code in (400, 404, 409)


def test_rien_ici_n_appelle_le_fournisseur(client, atelier, tmp_path):
    projet = _projet(atelier)
    champy = _creer(client, projet)
    _choisir(client, projet, champy, "baton")
    _style_de(client, projet, champy)
    assert atelier.generations.total_couts() == 0
