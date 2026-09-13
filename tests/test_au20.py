# -*- coding: utf-8 -*-
"""AU20 · Ce qui entre par une fiche reste sur cette fiche.

**Le trou que ces essais bouchent a été mesuré à l'usage le 13 septembre 2026**,
le jour même où `AU18` et `AU19` ont été closes. Trois portes d'entrée, un seul
défaut, et chacune ne remplissait que la moitié du rattachement — pas la même
moitié :

* la vidéo importée portait son personnage et **pas son jeu**, alors que toutes
  les listes scopent sur un jeu : elle entrait, n'apparaissait nulle part, et le
  contrôle de doublon la retrouvait — *« … était déjà là »* sur une vidéo
  introuvable, à chaque nouvelle tentative ;
* l'image importée portait son jeu et **pas son personnage**, parce que la
  désigner sans pose était refusé : elle quittait la fiche où on venait de la
  faire entrer ;
* la feuille découpée en animation ne portait **ni l'un ni l'autre**, et
  disparaissait au moment précis où on venait de la fabriquer.

⚠️ **Le dernier essai est le plus important** : aucune des trois ne devient
invisible. C'est le critère du produit, pas celui d'une tranche — *ranger plus
tard* ne doit jamais vouloir dire *perdre*.

Aucun de ces essais ne coûte un centime, et aucun ne demande de décodeur vidéo.
"""

from __future__ import annotations

import io

from PIL import Image

CASE = 24


def _feuille(colonnes: int = 4) -> bytes:
    """Une feuille de sprites minuscule — son contenu n'est pas le sujet ici."""
    image = Image.new("RGBA", (CASE * colonnes, CASE), (0, 0, 0, 0))
    for rang in range(colonnes):
        for dx in range(4, CASE - 4):
            for dy in range(4, CASE - 4):
                image.putpixel((rang * CASE + dx, dy), (200, 30, 30, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _grille(colonnes: int = 4) -> list[list[int]]:
    return [
        [rang * CASE, 0, rang * CASE + CASE - 1, CASE - 1] for rang in range(colonnes)
    ]


def _sujet(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _poser(client, octets: bytes, nom: str) -> str:
    reponse = client.post(
        "/api/assets/upload", content=octets, params={"nom": nom, "traiter": "false"}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


# ── Une image entre pour un sujet, sans qu'on sache encore où ────────────────


def test_une_image_se_range_sur_un_sujet_sans_pose(client):
    """**Le rattachement sans case est légitime**, et c'est ce qui débloque tout.

    Il était refusé — *« une image se désigne par un personnage **et** une
    pose »* —, donc un import « sans mouvement » ne rattachait rien du tout.
    """
    sujet = _sujet(client)
    asset = _poser(client, _feuille(1), "croquis.png")
    reponse = client.put(
        f"/api/assets/{asset}/character", json={"personnage": sujet, "pose": None}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["personnage"] == sujet
    assert reponse.json()["pose"] is None


def test_une_pose_sans_personnage_reste_un_refus(client):
    """L'autre moitié de l'ancienne règle **ne bouge pas** : elle ne désigne rien."""
    asset = _poser(client, _feuille(1), "croquis.png")
    reponse = client.put(
        f"/api/assets/{asset}/character", json={"personnage": None, "pose": "marche"}
    )
    assert reponse.status_code >= 400
    assert "personnage" in reponse.text


def test_les_deux_vides_retirent_toujours_la_designation(client):
    """Ce que la nouvelle branche ne doit pas avoir cassé en passant."""
    sujet = _sujet(client)
    asset = _poser(client, _feuille(1), "croquis.png")
    client.put(f"/api/assets/{asset}/character", json={"personnage": sujet, "pose": None})
    reponse = client.put(
        f"/api/assets/{asset}/character", json={"personnage": None, "pose": None}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["personnage"] is None


# ── Une vidéo importée appartient au jeu ouvert ──────────────────────────────


def test_un_clip_importe_prend_le_jeu_ouvert_sans_qu_on_le_nomme(client, monkeypatch):
    """**Le défaut est dans la route**, comme pour tout le reste du produit.

    L'écran n'envoie pas de `projet` ; sans ce défaut, le clip naissait hors de
    tout jeu et `GET /clips?projet=…` ne le rendait jamais.
    """
    from atelier.services import animation as module

    class _Mesure:
        images, cadence, largeur, hauteur = 2, 24.0, 16, 16

    def _extraire(source, dossier):
        dossier.mkdir(parents=True, exist_ok=True)
        for rang in range(2):
            Image.new("RGBA", (16, 16), (10, 10, 10, 255)).save(
                dossier / f"{rang:04d}.png"
            )
        return _Mesure()

    monkeypatch.setattr(module.decodeur, "indisponible", lambda: None)
    monkeypatch.setattr(module.decodeur, "extraire", _extraire)

    projet = client.get("/api/library").json()["courant"]
    reponse = client.post(
        "/api/clips/import", content=b"des octets de video", params={"nom": "marche.mp4"}
    )
    assert reponse.status_code == 201, reponse.text
    clip = reponse.json()["clip"]
    assert clip["projet"] == projet

    # **Et il paraît dans la liste du jeu** — c'est le fait que l'auteur a
    # constaté manquant, et non la valeur d'un champ.
    liste = client.get("/api/clips", params={"projet": projet}).json()["clips"]
    assert any(g["identifiant"] == clip["identifiant"] for g in liste)


# ── Une feuille découpée reste au sujet de la feuille ────────────────────────


def test_une_feuille_decoupee_herite_du_sujet_de_la_feuille(client):
    """**Ce qui naît d'une feuille appartient à qui la feuille appartient.**

    Le jeu l'a toujours fait ; le sujet, lui, se perdait — et l'animation
    quittait la fiche au moment où on venait de la fabriquer.
    """
    sujet = _sujet(client)
    asset = _poser(client, _feuille(), "planche.png")
    client.put(f"/api/assets/{asset}/character", json={"personnage": sujet, "pose": None})

    reponse = client.post(
        "/api/clips/sheet", json={"feuille": asset, "boites": _grille(), "nom": "Marche"}
    )
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["clip"]["personnage"] == sujet
    assert all(b["personnage"] == sujet for b in reponse.json()["bandes"])


def test_l_appel_garde_le_dernier_mot_sur_le_rattachement(client):
    """Nommer un autre sujet range ailleurs ; la chaîne vide dit « aucun »."""
    un = _sujet(client, "Le pèlerin")
    autre = _sujet(client, "Le garde")
    asset = _poser(client, _feuille(), "planche.png")
    client.put(f"/api/assets/{asset}/character", json={"personnage": un, "pose": None})

    ailleurs = client.post(
        "/api/clips/sheet",
        json={"feuille": asset, "boites": _grille(), "personnage": autre},
    )
    assert ailleurs.json()["clip"]["personnage"] == autre

    aucun = client.post(
        "/api/clips/sheet",
        json={"feuille": asset, "boites": _grille(), "personnage": ""},
    )
    assert aucun.json()["clip"]["personnage"] is None


# ── Ce qui attend se voit ────────────────────────────────────────────────────


def test_la_fiche_montre_ce_qui_est_a_elle_sans_case(client):
    """**Le critère de la tranche** : rien de ce qui entre ne devient invisible.

    Une image et une animation, rattachées au sujet et rangées nulle part, sont
    l'une et l'autre dans la liste — et elles en sortent dès qu'on les range.
    """
    sujet = _sujet(client)
    image = _poser(client, _feuille(1), "croquis.png")
    client.put(f"/api/assets/{image}/character", json={"personnage": sujet, "pose": None})
    planche = _poser(client, _feuille(), "planche.png")
    client.put(
        f"/api/assets/{planche}/character", json={"personnage": sujet, "pose": None}
    )
    bandes = client.post(
        "/api/clips/sheet", json={"feuille": planche, "boites": _grille()}
    ).json()["bandes"]

    attente = client.get(f"/api/characters/{sujet}/unplaced")
    assert attente.status_code == 200, attente.text
    lu = attente.json()
    assert image in [a["identifiant"] for a in lu["images"]]
    assert bandes[0]["identifiant"] in [b["identifiant"] for b in lu["animations"]]

    # Rangée, l'image quitte la liste : « pas encore rangé » dit ce qu'il dit.
    pose = client.get("/api/characters").json()["plan"][0]["identifiant"]
    client.put(f"/api/assets/{image}/character", json={"personnage": sujet, "pose": pose})
    apres = client.get(f"/api/characters/{sujet}/unplaced").json()
    assert image not in [a["identifiant"] for a in apres["images"]]


def test_un_clip_dont_on_a_tire_des_bandes_n_attend_plus(client):
    """Le clip et sa bande ne se comptent pas deux fois : c'est la bande qui attend.

    Les deux ensemble donneraient deux choses à ranger pour une, et ranger
    l'une laisserait l'autre à l'écran — un écran qui ment.
    """
    sujet = _sujet(client)
    planche = _poser(client, _feuille(), "planche.png")
    client.put(
        f"/api/assets/{planche}/character", json={"personnage": sujet, "pose": None}
    )
    fait = client.post(
        "/api/clips/sheet", json={"feuille": planche, "boites": _grille()}
    ).json()

    lu = client.get(f"/api/characters/{sujet}/unplaced").json()
    assert fait["clip"]["identifiant"] not in [g["identifiant"] for g in lu["clips"]]
    assert len(lu["animations"]) == 1
