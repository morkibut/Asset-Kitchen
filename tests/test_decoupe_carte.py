# -*- coding: utf-8 -*-
"""Découper une carte du tableau, et voir ce que la palette y lit.

Ce que la maquette `docs/archive/maquettes-v2.1/06bis-decouper-une-carte.html` décide, et
que le serveur doit tenir. Deux choses sont mesurées ici, et une troisième ne
l'est pas.

**Un morceau de carte est une carte, jamais un asset.** C'est le seul point qui
peut se perdre en silence : les deux familles d'images du produit ne se touchent
pas — la grille montre ce qu'on a fabriqué, le tableau ce dont on s'inspire — et
découper emprunte l'*outil* de la grille sans faire traverser l'image. Un morceau
qui arriverait dans la bibliothèque ne casserait aucun essai existant ; il
casserait la règle.

**Rien n'est modifié sur place.** Une carte ne change jamais sous son
identifiant, et c'est ce qui autorise le cache éternel de son image. Découper
laisse donc l'originale intacte — sauf le recadrage qui vient prendre sa place,
seul endroit du produit où découper efface quelque chose, et qui se demande
explicitement.

**Ce qui n'est pas ici** : que la découpe automatique tombe sur les bons sujets
d'un vrai artwork. Ça se mesure sur de vraies images, pas sur un double, et ça
vit dans `essais/essai_palette_du_tableau.py` — quatre zones, une par
personnage, sur la planche de nains de ce dépôt.
"""

from __future__ import annotations

import io

import pytest
from conftest import image_sujet, planche_sujets
from PIL import Image


def _coller(client, nom: str, octets: bytes) -> dict:
    reponse = client.post("/api/board/paste", params={"nom": nom}, content=octets)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _promouvoir(client, carte: str, famille: str = "tous") -> dict:
    reponse = client.put(
        f"/api/board/{carte}/official", json={"officiel": True, "famille": famille}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── « L'écran Découpe s'ouvre sur une carte, et propose sans rien écrire » ────


def test_proposer_ne_cree_rien_et_trouve_les_sujets(client):
    carte = _coller(client, "planche.png", planche_sujets(3))["identifiant"]
    avant = len(client.get("/api/board").json()["cartes"])

    propose = client.get(f"/api/board/{carte}/slices").json()
    assert propose["carte"] == carte
    assert propose["mode"] == "auto"
    assert len(propose["boites"]) == 3
    assert propose["raison"] is None

    # **Une boîte est en coins, bornes comprises**, la convention du produit
    # entier — et pas en largeur-hauteur. Une confusion ici décalerait chaque
    # rectangle de sa propre taille.
    for x0, y0, x1, y1 in propose["boites"]:
        assert 0 <= x0 < x1 < propose["largeur"]
        assert 0 <= y0 < y1 < propose["hauteur"]

    # Rien n'a été créé, rien n'a été écrit : c'est ce qui autorise à redemander
    # la proposition à chaque cran de réglage.
    assert len(client.get("/api/board").json()["cartes"]) == avant


def test_un_lisere_d_un_pixel_n_est_pas_un_sujet(client):
    """Une rangée de pixels sur toute la largeur est une ligne, pas une forme.

    **Mesuré sur une vraie image avant d'être écrit ici.** La planche de quatre
    nains de ce dépôt porte une première rangée sombre là où son fond est gris
    clair : le détourage la garde — à juste titre, ce n'est pas le fond — et la
    détection proposait un cinquième rectangle de 1 024 × 1 par-dessus les
    quatre nains. L'aire ne l'attrape pas, 1 024 pèse largement plus que
    `COTE_MIN²`.

    Le liseré est reproduit ici sur la planche du double, à l'identique : une
    rangée d'une autre couleur que le fond, sur toute la largeur, tout en haut.
    """
    octets = planche_sujets(3)
    with Image.open(io.BytesIO(octets)) as ouverte:
        image = ouverte.convert("RGB")
    for x in range(image.width):
        image.putpixel((x, 0), (12, 12, 14))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")

    carte = _coller(client, "planche.png", tampon.getvalue())["identifiant"]
    propose = client.get(f"/api/board/{carte}/slices").json()

    # Les trois sujets, et eux seuls : le liseré n'est plus proposé.
    assert len(propose["boites"]) == 3
    assert all(y1 - y0 + 1 >= 2 for _, y0, _, y1 in propose["boites"])

    # **Et le plancher ne juge pas de la finesse.** Une lance de quatre pixels
    # de large reste un sujet — c'est ce que `COTE_MIN` dit en toutes lettres,
    # et ce que ce plancher-ci ne doit pas défaire.
    from atelier.image.decoupe import zones_opaques

    import numpy as np

    lance = np.zeros((240, 240), dtype=np.uint8)
    lance[20:220, 100:104] = 255
    assert zones_opaques(lance) == [(100, 20, 103, 219)]


def test_la_grille_fixe_est_un_second_mode_pas_un_repli(client):
    """Une planche régulière n'a pas de zones connexes séparées, et c'est
    l'auteur qui sait laquelle des deux il a sous les yeux."""
    carte = _coller(client, "planche.png", planche_sujets(3))["identifiant"]

    grille = client.get(
        f"/api/board/{carte}/slices",
        params={"mode": "grille", "colonnes": 3, "lignes": 2},
    ).json()
    assert len(grille["boites"]) == 6

    refus = client.get(f"/api/board/{carte}/slices", params={"mode": "chinois"})
    assert refus.status_code == 409
    assert "chinois" in refus.json()["raison"]


def test_une_carte_texte_ne_se_decoupe_pas(client):
    note = client.post("/api/board/text", json={"texte": "le jeu est sombre"}).json()
    refus = client.get(f"/api/board/{note['identifiant']}/slices")
    assert refus.status_code == 409
    assert "texte" in refus.json()["raison"]


# ── « Chaque rectangle devient une carte du même tableau » ────────────────────


def test_les_morceaux_sont_des_cartes_et_pas_des_assets(client):
    """**La frontière des deux familles ne bouge pas.** Ce qui traverse est
    l'outil, jamais l'image."""
    carte = _coller(client, "planche.png", planche_sujets(3))["identifiant"]
    assets_avant = client.get("/api/assets").json()

    boites = client.get(f"/api/board/{carte}/slices").json()["boites"]
    coupe = client.post(f"/api/board/{carte}/slices", json={"boites": boites})
    assert coupe.status_code == 201, coupe.text
    morceaux = coupe.json()["morceaux"]
    assert len(morceaux) == 3

    # Trois cartes de plus au tableau, et **pas un asset de plus** dans la
    # bibliothèque : c'est tout l'objet de cet essai.
    tableau = client.get("/api/board").json()["cartes"]
    assert len(tableau) == 4
    assert client.get("/api/assets").json() == assets_avant


def test_les_morceaux_arrivent_dans_la_reserve_et_non_promus(client):
    """Ni classés, ni posés, ni promus — la réserve *est* l'endroit de ce qui
    n'est pas rangé, et promouvoir reste un geste."""
    mere = _coller(client, "planche.png", planche_sujets(3))
    _promouvoir(client, mere["identifiant"], "personnages")
    client.put(
        f"/api/board/{mere['identifiant']}",
        json={"groupe": "références", "note": "trois figurines"},
    )

    boites = client.get(f"/api/board/{mere['identifiant']}/slices").json()["boites"]
    morceaux = client.post(
        f"/api/board/{mere['identifiant']}/slices", json={"boites": boites}
    ).json()["morceaux"]

    for morceau in morceaux:
        assert morceau["officiel"] is False
        assert morceau["groupe"] == ""
        assert morceau["position"] is None
        assert morceau["note"] == ""
        # **La source suit, et rien d'autre** : une image dont on perd la
        # provenance ne se crédite plus ni ne se retrouve.
        assert morceau["source"] == mere["source"]


def test_l_originale_reste_intacte(client):
    """Une carte ne change jamais sous son identifiant. Si la coupe est
    mauvaise, on recommence sur la même image."""
    mere = _coller(client, "planche.png", planche_sujets(3))
    boites = client.get(f"/api/board/{mere['identifiant']}/slices").json()["boites"]
    client.post(f"/api/board/{mere['identifiant']}/slices", json={"boites": boites})

    apres = next(
        c
        for c in client.get("/api/board").json()["cartes"]
        if c["identifiant"] == mere["identifiant"]
    )
    assert apres["empreinte"] == mere["empreinte"]
    assert (apres["largeur"], apres["hauteur"]) == (mere["largeur"], mere["hauteur"])


def test_un_rectangle_hors_de_l_image_est_refuse_en_le_nommant(client):
    """Rien n'est ramené en silence dans les bornes : un rectangle corrigé à
    l'insu de l'auteur découperait autre chose que ce qu'il a vu."""
    carte = _coller(client, "planche.png", planche_sujets(2))["identifiant"]

    refus = client.post(
        f"/api/board/{carte}/slices",
        json={"boites": [[0, 0, 40, 40], [0, 0, 9000, 9000]]},
    )
    assert refus.status_code == 409
    assert "rectangle 2" in refus.json()["raison"]

    vide = client.post(f"/api/board/{carte}/slices", json={"boites": []})
    assert vide.status_code == 409
    assert "rien à découper" in vide.json()["raison"]


# ── « Recadrer, c'est découper en un seul rectangle » ─────────────────────────


def test_le_morceau_qui_prend_la_place_herite_de_tout(client):
    mere = _coller(client, "planche.png", planche_sujets(2))
    _promouvoir(client, mere["identifiant"], "decors")
    client.put(
        f"/api/board/{mere['identifiant']}",
        json={"groupe": "ambiances", "note": "la crypte", "taille": 4},
    )

    recadre = client.post(
        f"/api/board/{mere['identifiant']}/slices",
        json={"boites": [[20, 20, 300, 300]], "remplacer": True},
    )
    assert recadre.status_code == 201, recadre.text
    recu = recadre.json()
    neuf = recu["morceaux"][0]

    assert neuf["officiel"] is True
    assert neuf["famille"] == "decors"
    assert neuf["groupe"] == "ambiances"
    assert neuf["note"] == "la crypte"
    assert neuf["taille"] == 4
    # L'originale s'en va, et la réponse le dit plutôt que de le laisser deviner.
    assert recu["retiree"]["identifiant"] == mere["identifiant"]
    restantes = [c["identifiant"] for c in client.get("/api/board").json()["cartes"]]
    assert restantes == [neuf["identifiant"]]


def test_remplacer_refuse_a_plusieurs_rectangles(client):
    """Un morceau parmi plusieurs ne peut pas prétendre être l'originale."""
    carte = _coller(client, "planche.png", planche_sujets(2))["identifiant"]
    refus = client.post(
        f"/api/board/{carte}/slices",
        json={"boites": [[0, 0, 60, 60], [80, 80, 140, 140]], "remplacer": True},
    )
    assert refus.status_code == 409
    assert "un seul rectangle" in refus.json()["raison"]
    # Et rien n'a été coupé : un refus ne laisse pas la moitié du geste derrière.
    assert len(client.get("/api/board").json()["cartes"]) == 1


def test_recadrer_un_artwork_officiel_refait_la_palette(client):
    """La palette se calcule sur les artworks officiels ; le recadrage en
    remplace un, donc elle bouge — et la réponse la porte."""
    carte = _coller(client, "planche.png", planche_sujets(3))["identifiant"]
    avant = _promouvoir(client, carte, "tous")["univers"]["palette"]
    assert avant

    apres = client.post(
        f"/api/board/{carte}/slices",
        json={"boites": [[10, 10, 200, 200]], "remplacer": True},
    ).json()["univers"]["palette"]
    assert apres
    assert apres != avant


# ── « Le détourage de la palette ne gagne pas un réglage, il gagne une fenêtre » ──


def test_la_lecture_de_palette_dit_la_part_comptee(client):
    """Le fond d'un artwork n'entre pas dans la palette — il est écarté avant
    que la moindre couleur soit comptée, et cette route est ce qui le montre."""
    carte = _coller(client, "sujet.png", image_sujet())["identifiant"]

    lu = client.get(f"/api/board/{carte}/palette").json()
    assert lu["carte"] == carte
    # Un sujet sur un fond plat : une part franche est comptée, et une part
    # franche est écartée. Les deux bornes disent que le détourage agit sans
    # tout manger.
    assert 0 < lu["part"] < 100
    assert lu["entiere"] is False
    assert (lu["largeur"], lu["hauteur"]) > (0, 0)


def test_l_apercu_montre_ce_que_la_palette_ecarte(client):
    """Un PNG, aux dimensions de la carte, où ce qui est écarté est magenta.

    **Ce n'est pas l'image de la carte** : c'est un instrument, il ne s'enregistre
    pas, et il ne remplace jamais l'image sous son propre nom.
    """
    import io

    import numpy as np
    from PIL import Image

    from atelier.image.palette import MAGENTA

    carte = _coller(client, "sujet.png", image_sujet())["identifiant"]

    reponse = client.get(f"/api/board/{carte}/palette/image")
    assert reponse.status_code == 200
    assert reponse.headers["content-type"] == "image/png"

    with Image.open(io.BytesIO(reponse.content)) as ouverte:
        pixels = np.asarray(ouverte.convert("RGB"))
    marques = (pixels == np.array(MAGENTA[:3])).all(axis=2)
    assert marques.any(), "rien n'est marqué comme écarté"
    assert not marques.all(), "tout est marqué comme écarté"

    # L'image de la carte, elle, n'a pas bougé : deux routes, deux images.
    propre = client.get(f"/api/board/{carte}/image")
    assert propre.status_code == 200
    assert propre.content != reponse.content


def test_une_carte_texte_n_ecrit_aucune_palette(client):
    note = client.post("/api/board/text", json={"texte": "sombre"}).json()
    for chemin in ("palette", "palette/image"):
        refus = client.get(f"/api/board/{note['identifiant']}/{chemin}")
        assert refus.status_code == 409
        assert "palette" in refus.json()["raison"]


# ── Le partage avec la découpe d'une planche ─────────────────────────────────


def test_les_deux_decoupes_verifient_les_rectangles_pareil(client):
    """**Une seule vérification, servie deux fois.** Ce qu'un rectangle doit
    valoir pour être découpable ne dépend pas de ce qu'on en tire ; deux copies
    finiraient par accepter deux choses différentes, et l'écart ne se verrait
    qu'une fois l'image coupée."""
    from atelier.services import decoupe

    carte = _coller(client, "planche.png", planche_sujets(2))["identifiant"]

    trop = [[0, 0, 4, 4] for _ in range(decoupe.DECOUPES_MAX + 1)]
    refus = client.post(f"/api/board/{carte}/slices", json={"boites": trop})
    assert refus.status_code == 409
    assert str(decoupe.DECOUPES_MAX) in refus.json()["raison"]

    minuscule = client.post(f"/api/board/{carte}/slices", json={"boites": [[5, 5, 5, 5]]})
    assert minuscule.status_code == 409
    assert "trop petit" in minuscule.json()["raison"]


@pytest.mark.parametrize("mode", ["auto", "grille"])
def test_proposer_ne_demande_jamais_le_fournisseur(client, double, mode):
    """Découper une image déjà là ne coûte rien et marche réseau coupé."""
    carte = _coller(client, "planche.png", planche_sujets(2))["identifiant"]
    avant = len(double.demandes)

    client.get(f"/api/board/{carte}/slices", params={"mode": mode})
    boites = client.get(f"/api/board/{carte}/slices").json()["boites"]
    client.post(f"/api/board/{carte}/slices", json={"boites": boites})
    client.get(f"/api/board/{carte}/palette")
    client.get(f"/api/board/{carte}/palette/image")

    assert len(double.demandes) == avant
