# -*- coding: utf-8 -*-
"""Ce que l'audit de design a trouvé côté serveur, et qui ne doit pas revenir.

`docs/audit-design-post-v21.html`, mené le 31 août 2026 sur l'atelier en
fonctionnement. Douze de ses quatorze défauts vivent dans l'interface et leurs
critères sont dans `interface/src/App.test.tsx`, seul endroit du dépôt où
l'interface est montée et pilotée. **Un seul touchait au serveur** — celui de
la galerie qui télécharge vingt-six mégaoctets pour montrer quarante-neuf
timbres-poste —, et c'est lui que ce fichier tient.

Ce fichier n'est pas une tranche : il ne porte le nom d'aucune, et il n'en
portera jamais. Il garde ce qu'une séance d'usage a trouvé, comme les tranches
gardent ce qu'un plan a demandé.

**Aucun test de ce fichier n'appelle le fournisseur pour ce qu'il vérifie** :
l'image d'essai est produite par le double, et tout le reste se mesure sur les
octets rendus.
"""

from __future__ import annotations

import io
import time

from conftest import image_sujet
from PIL import Image

MODELE = "essai/rend-du-png"


def _generer(client, double, **image) -> dict:
    """Une image produite, et l'asset qu'elle a fait naître."""
    double.rendre = lambda: image_sujet(**image)
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un tonneau"}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            break
        time.sleep(0.01)
    asset = client.get(f"/api/assets/{identifiant}-0")
    assert asset.status_code == 200, asset.text
    return asset.json()


def _sans_recette(client, identifiant: str) -> None:
    """Remettre l'asset sur son brut.

    **Un projet neuf pose déjà une recette** — un détourage et une remise sur
    grille à 64 px —, et c'est le rendu que la grille montre. Pour mesurer ce
    qu'une vignette économise sur une grande image, il faut donc une image dont
    le rendu *est* grand : c'est ce que ce geste rend.
    """
    reponse = client.post(f"/api/assets/{identifiant}/reset")
    assert reponse.status_code == 200, reponse.text


def _dimensions(octets: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(octets)) as ouverte:
        return ouverte.width, ouverte.height


# ── « La galerie télécharge vingt-six mégaoctets pour montrer quarante-neuf
#     timbres-poste » (défaut n° 06) ────────────────────────────────────────────


def test_la_vignette_est_reduite_au_cran_demande(client, double):
    """Une case de grille reçoit une image à sa taille, pas le fichier entier.

    Mesuré au navigateur le 31 août 2026 : 318 Ko en moyenne pour une vignette
    de 145 px, et jusqu'à deux mégaoctets pour la plus lourde.
    """
    asset = _generer(client, double, toile=64, bloc=16)
    _sans_recette(client, asset["identifiant"])

    entiere = client.get(f"/api/assets/{asset['identifiant']}/image")
    reduite = client.get(
        f"/api/assets/{asset['identifiant']}/vignette", params={"cote": 256}
    )
    assert reduite.status_code == 200, reduite.text

    assert _dimensions(entiere.content) == (1024, 1024)
    assert _dimensions(reduite.content) == (256, 256)
    # Ce qui est envoyé pèse réellement moins, et pas d'un cheveu.
    assert len(reduite.content) < len(entiere.content) / 2


def test_la_vignette_n_agrandit_jamais_une_image_plus_petite(client, double):
    """Agrandir ici fabriquerait des octets pour rien.

    C'est la feuille de style qui grandit un sprite, avec les pixels nets
    qu'elle sait tenir (`image-rendering: pixelated`).
    """
    asset = _generer(client, double, toile=24, bloc=4)
    _sans_recette(client, asset["identifiant"])

    # Le brut fait 96 px de côté ; le cran demandé en fait 256.
    reduite = client.get(
        f"/api/assets/{asset['identifiant']}/vignette", params={"cote": 256}
    )
    assert _dimensions(reduite.content) == (96, 96)


def test_la_vignette_ne_fabrique_aucune_couleur(client, double):
    """**Au plus proche voisin, et c'est la seule règle dure d'ici.**

    Une réduction lissée invente des couleurs qui ne sont pas dans le sprite, et
    la vignette ne montrerait plus ce que la grille prétend montrer. C'est le
    même choix que `image-rendering: pixelated` à l'écran ; les deux disent la
    même chose au même endroit du geste.
    """
    asset = _generer(client, double, toile=32, bloc=16)
    _sans_recette(client, asset["identifiant"])

    entiere = client.get(f"/api/assets/{asset['identifiant']}/image").content
    reduite = client.get(
        f"/api/assets/{asset['identifiant']}/vignette", params={"cote": 128}
    ).content

    with Image.open(io.BytesIO(entiere)) as grande:
        depart = {p[1] for p in grande.convert("RGB").getcolors(1 << 20)}
    with Image.open(io.BytesIO(reduite)) as petite:
        arrivee = {p[1] for p in petite.convert("RGB").getcolors(1 << 20)}

    # Aucune couleur neuve : toutes celles de la vignette étaient déjà dans
    # l'image. Un lissage en fabriquerait des dizaines d'intermédiaires.
    assert arrivee <= depart


# ── « Le serveur interdisait de garder les images, et l'adresse porte déjà
#     l'empreinte » (défaut n° 06, second geste) ────────────────────────────────


def test_une_adresse_qui_porte_son_empreinte_se_garde_en_memoire(client, double):
    """L'interdiction était devenue une interdiction pour rien.

    Elle avait une bonne raison — le rendu change à chaque cran de curseur, et
    une image gardée ferait regarder la version d'avant. Sauf que l'adresse
    porte l'empreinte de la recette : elle change dès que l'image change.
    """
    asset = _generer(client, double, toile=32, bloc=4)

    avec = client.get(
        f"/api/assets/{asset['identifiant']}/image",
        params={"v": asset["empreinte"]},
    )
    assert "immutable" in avec.headers["cache-control"]

    vignette = client.get(
        f"/api/assets/{asset['identifiant']}/vignette",
        params={"cote": 256, "v": asset["empreinte"]},
    )
    assert "immutable" in vignette.headers["cache-control"]


def test_sans_empreinte_dans_l_adresse_rien_ne_se_garde(client, double):
    """**Le seul cas où l'ancienne raison tient encore.**

    Une adresse sans empreinte ne changera pas quand son contenu changera ; il
    vaut mieux qu'elle soit lente que fausse.
    """
    asset = _generer(client, double, toile=32, bloc=4)

    nue = client.get(f"/api/assets/{asset['identifiant']}/image")
    assert nue.headers["cache-control"] == "no-store"
