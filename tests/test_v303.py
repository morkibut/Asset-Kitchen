# -*- coding: utf-8 -*-
"""V3.03.1 — chaque frame porte sa recette : le socle serveur.

Les critères de `docs/PLAN.md` § V3.03.1, côté serveur. **Aucun n'appelle un
vrai fournisseur** : le clip est un double qui facture zéro, et tout le reste
est du processeur — les images passent la vraie chaîne, détourage compris.

**Ce que la tranche change au serveur, et qui se mesure ici.** Une prise porte
désormais une **recette individuelle facultative** — le défaut est la recette de
la bande, et une bande d'avant se relit telle quelle. La planche rend chaque
frame avec *sa* recette — seule la fenêtre commune et la palette restent de la
bande —, et l'ouverture de l'animation dit, pour chaque frame, les places qui
s'écartent et que la fenêtre a été mesurée avec la recette de la bande.

La moitié d'écran de la tranche — les tables sur la frame, et le montage réduit
au brut — vit dans `interface/src/App.test.tsx`.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from test_a9 import MELE, atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip, clip_connu, un_personnage, un_sprite  # noqa: F401


def _garder(client, clip, **reglages):
    """Une bande gardée par la vraie porte, avec des réglages qui ne sont pas ceux du jeu."""
    corps = {"clip": clip, "nom": "marche", "images": [12, 14, 16, 18]}
    corps.update(reglages)
    reponse = client.post("/api/strips", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _corriger(client, identifiant, prises):
    reponse = client.put(f"/api/strips/{identifiant}", json={"prises": prises})
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _recette_qui_change_les_couleurs(bande):
    """La recette de la bande, ses couleurs réduites de moitié — une différence
    qui ne sort pas la frame de la fenêtre commune, et qui n'a pas besoin d'une
    vraie image pour se voir : c'est la quantification, la place la plus simple
    à faire varier d'un test."""
    recette = dict(bande["recette"] or {})
    quantification = dict(recette.get("quantification") or {})
    quantification["couleurs"] = 12
    recette["quantification"] = quantification
    return recette


def _planche(client, identifiant):
    octets = client.get(f"/api/strips/{identifiant}/sheet").content
    with Image.open(io.BytesIO(octets)) as ouverte:
        entiere = np.asarray(ouverte.convert("RGBA"))
    return entiere


def _cases(planche, largeur):
    hauteur, l, _ = planche.shape
    return [planche[:, x : x + largeur] for x in range(0, l, largeur)]


# ── La recette d'une frame se pose, se relit, et se rend ────────────────────


def test_une_frame_porte_sa_recette_et_se_relit_apres_fermeture(
    atelier_video, client_video, clip, tmp_path, double, animateur
):
    """*Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini*
    (8septies) : la garde se fait avec des réglages qui ne sont pas ceux du
    défaut, et l'atelier se **rouvre** par-dessus lui-même — la frame a encore
    sa recette à elle, et l'ouverture de l'animation dit qu'elle s'écarte.
    """
    from atelier.services import Atelier

    bande = _garder(client_video, clip)
    recette = _recette_qui_change_les_couleurs(bande)
    prises = list(bande["prises"])
    prises[1].update({"recette": recette})

    relue = _corriger(client_video, bande["identifiant"], prises)

    # La correction a bien été rendue avec la recette individuelle.
    assert relue["prises"][1]["recette"]["quantification"]["couleurs"] == 12
    assert relue["prises"][0].get("recette") is None

    # ⚠️ Et la bande relue du disque la porte encore — pas celle du défaut.
    relu = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    bande_relue = relu.montage.bande(bande["identifiant"])
    assert bande_relue is not None
    assert bande_relue.prises[1].recette is not None
    assert bande_relue.prises[1].recette.quantification is not None
    assert bande_relue.prises[1].recette.quantification.couleurs == 12
    assert bande_relue.prises[0].recette is None

    # Et l'ouverture de l'animation (A7) dit ce qui s'écarte, en toutes lettres.
    ouverte = relu.montage.ouvrir_la_bande(bande["identifiant"])
    ecarts = ouverte["ecarts"]
    assert ecarts[1]["places"] == ("quantification",)
    assert ecarts[1]["fenetre_davant"] is True
    assert ecarts[0] == {"places": (), "fenetre_davant": False}


def test_une_bande_d_avant_la_tranche_se_relit_sans_recette_individuelle(
    client_video, clip
):
    """*Une bande gardée avant la tranche se rouvre telle quelle, la recette de
    la bande vaut pour chaque frame — rien ne migre.* Les prises écrites comme
    de simples numéros se relisent sans recette, et rien ne s'annonce comme
    écarté : il n'y a pas d'écart, et une phrase qui dirait le contraire
    mentirait sur ce que l'auteur a fait.
    """
    bande = _garder(client_video, clip)

    ouverte = client_video.get(f"/api/strips/{bande['identifiant']}").json()
    for prise in ouverte["bande"]["prises"]:
        assert prise.get("recette") is None
    for ecart in ouverte["ecarts"]:
        assert ecart == {"places": [], "fenetre_davant": False}


def test_une_recette_individuelle_egale_a_la_bande_ne_s_annonce_pas(
    client_video, clip
):
    """Une frame qui porte *la même* recette que la bande ne s'écarte nulle
    part : rien n'a changé, et le ruban n'invente pas une phrase. La recette
    individuelle reste pourtant posée — c'est le réglage de l'auteur, et le
    domaine ne le renie pas pour autant qu'il ne change rien.
    """
    bande = _garder(client_video, clip)
    prises = list(bande["prises"])
    prises[2].update({"recette": dict(bande["recette"] or {})})

    relue = _corriger(client_video, bande["identifiant"], prises)
    assert relue["prises"][2].get("recette") is not None

    ouverte = client_video.get(f"/api/strips/{bande['identifiant']}").json()
    assert ouverte["ecarts"][2] == {"places": [], "fenetre_davant": False}


# ── Seule la frame changée change de pixels ─────────────────────────────────


def test_retoucher_une_frame_deja_ecartee_ne_refait_pas_les_autres(
    client_video, clip
):
    """*Une frame qui change de recette change ses pixels, pas ceux de sa
    voisine* — et la palette de la bande n'y rebouge pas : une frame qui porte
    déjà sa recette à elle **en est sortie**, donc la retoucher ne déplace plus
    la palette que les autres partagent. Les trois cases de la bande sont
    *exactement* les mêmes avant et après ; la frame changée seule diffère.
    """
    bande = _garder(client_video, clip)
    # La frame 1 reçoit d'abord sa recette à elle — c'est le geste qui la sort
    # de la bande, et la palette se décide alors *sans elle*.
    premiere = list(bande["prises"])
    premiere[1].update({"recette": _recette_qui_change_les_couleurs(bande)})
    _corriger(client_video, bande["identifiant"], premiere)
    avant = _cases(_planche(client_video, bande["identifiant"]), bande["case_largeur"])

    # Puis on la retouche : sa propre recette change encore (16 couleurs au
    # lieu de 12, et une tolérance de détourage plus lâche). La frame est déjà
    # individuelle : la palette des trois autres n'est pas recalculée.
    seconde = list(premiere)
    recette_deux = dict(seconde[1]["recette"])
    quantification = dict(recette_deux["quantification"])
    quantification["couleurs"] = 16
    recette_deux["quantification"] = quantification
    seconde[1]["recette"] = recette_deux
    relue = _corriger(client_video, bande["identifiant"], seconde)

    apres = _cases(_planche(client_video, relue["identifiant"]), relue["case_largeur"])
    for rang in range(4):
        if rang == 1:
            assert not np.array_equal(avant[rang], apres[rang])
        else:
            assert np.array_equal(avant[rang], apres[rang])


def test_la_premiere_frame_ecartee_change_et_la_bande_reste_elle_meme(
    client_video, clip
):
    """Le geste qui *sort* une frame de la bande : les autres rejouent leur
    chaîne, avec leur recette à elles — seules leurs couleurs bougent, si la
    palette de la bande s'est déplacée en perdant un membre. Ce qui ne bouge
    jamais, c'est leur *décision* : la recette de la bande est inchangée, et
    l'écart le dit. La frame changée, elle, sort différente.
    """
    bande = _garder(client_video, clip)
    avant = _cases(_planche(client_video, bande["identifiant"]), bande["case_largeur"])

    prises = list(bande["prises"])
    prises[1].update({"recette": _recette_qui_change_les_couleurs(bande)})
    relue = _corriger(client_video, bande["identifiant"], prises)

    apres = _cases(_planche(client_video, relue["identifiant"]), relue["case_largeur"])
    assert not np.array_equal(avant[1], apres[1])
    assert relue["recette"] == bande["recette"]


# ── La fenêtre commune reste de la bande ────────────────────────────────────


def test_la_fenetre_commune_reste_celle_de_la_bande(client_video, clip):
    """Une frame qui s'écarte est recadrée dans **la** fenêtre de la bande —
    celle-ci ne se re-mesure pas frame par frame : elle est une décision de la
    bande, elle reste mesurée avec la recette de la bande, et l'écart est dit
    (le champ `fenetre_davant` de l'écart) plutôt que réparé en silence.
    """
    bande = _garder(client_video, clip)
    # La fenêtre gardée par la bande, telle qu'elle était mesurée.
    cadre = bande["cadre"]

    prises = list(bande["prises"])
    prises[0].update({"recette": _recette_qui_change_les_couleurs(bande)})
    relue = _corriger(client_video, bande["identifiant"], prises)

    assert relue["cadre"] == cadre
    ouverte = client_video.get(f"/api/strips/{bande['identifiant']}").json()
    assert ouverte["ecarts"][0]["fenetre_davant"] is True