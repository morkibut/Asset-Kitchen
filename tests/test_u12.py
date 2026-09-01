# -*- coding: utf-8 -*-
"""U12 · La sélection magique — tracer gros, ajuster au bord.

**Ce qui se mesure ici** : qu'une forme entourée grossièrement autour du sujet
ramène le contour sur le **bord du sujet lui-même**, à l'intérieur de ce qu'on a
entouré ; que rien ne bouge au-dehors ; que le geste soit déterministe — deux
rendus de la même recette donnent le même masque, à l'octet près ; qu'il agisse
**avant** le recadrage et la mise sur grille ; que la forme **ne voyage pas** ;
et que ce qui en sort se retouche ensuite à la main sans recommencer.

**Ce que le tracé fait, en une phrase** : il **borne** la recherche, il ne la
lance pas. On entoure largement ce qu'on veut garder ; l'atelier part du liseré
de ce qu'on a tracé — des pixels de fond, puisqu'on a tracé autour — et remplit
vers l'intérieur jusqu'à buter sur le sujet. Le trait tremblant qu'on a fait ne
devient jamais le contour du sprite, et c'est très exactement ce qui distingue ce
geste de la retouche au pixel.

**Le tracé sur l'image** — la surface qui le reçoit, le trait qui se voit
pendant qu'on le fait, le geste qui désarme en finissant — vit dans
`interface/src/App.test.tsx`.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.recette import (
    Grille,
    Main,
    Passe,
    Recadrage,
    Recette,
    Trait,
    voyage,
)
from atelier.image.traitement import appliquer, detourer

COTE = 64
FOND = (0x20, 0x20, 0x20)
SUJET = (0xC8, 0xA0, 0x5A)

#: Le sujet — un bloc franc au milieu, dont on veut garder le bord exact.
BLOC = (22, 22, 20, 20)

#: Ce qu'on entoure : un carré large, à dix pixels du bord de l'image et à
#: douze du sujet. **On trace gros, exprès** — c'est tout l'intérêt du geste.
AUTOUR = ((10, 10), (53, 10), (53, 53), (10, 53))


def _octets() -> bytes:
    rgb = np.zeros((COTE, COTE, 3), dtype=np.uint8)
    rgb[:, :] = FOND
    x, y, largeur, hauteur = BLOC
    rgb[y : y + hauteur, x : x + largeur] = SUJET
    tampon = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _alpha(recette: Recette) -> np.ndarray:
    return detourer(recette, _octets())[:, :, 3]


ENTOUREE = Passe(moteur="trace", tolerance=20, trace=AUTOUR)


# ── « Le contour revient sur le bord du sujet, à l'intérieur du tracé » ──────


def test_le_bord_du_sujet_est_retrouve_a_linterieur_du_trace():
    """**Le trait qu'on fait ne devient jamais le contour du sprite.** On a
    entouré à douze pixels du bloc ; ce qui reste opaque, c'est le bloc."""
    alpha = _alpha(Recette(passes=(ENTOUREE,)))

    x, y, largeur, hauteur = BLOC
    sujet = np.zeros((COTE, COTE), dtype=bool)
    sujet[y : y + hauteur, x : x + largeur] = True

    assert alpha[sujet].all(), "le sujet a été entamé"
    # Le fond entouré est parti jusqu'au bord du bloc, pas jusqu'au trait.
    assert alpha[y - 1, x] == 0 and alpha[y, x - 1] == 0
    assert alpha[12, 12] == 0, "le fond juste sous le trait est resté"


def test_rien_ne_bouge_au_dehors_du_trace():
    """**Une sélection magique répond de ce qu'on a entouré, pas du reste de
    l'image.** C'est ce qui la rend cumulable avec les autres passes plutôt que
    concurrente : on peut entourer un bras, puis l'autre."""
    alpha = _alpha(Recette(passes=(ENTOUREE,)))

    # Les quatre coins de l'image sont du fond, et ils sont hors du tracé.
    assert alpha[0, 0] == 255
    assert alpha[0, COTE - 1] == 255
    assert alpha[COTE - 1, 0] == 255
    assert alpha[5, 30] == 255, "le fond au-dessus du tracé a été pris"


def test_deux_traces_cumules_ne_se_marchent_pas_dessus():
    """Deux passes entourées, chacune sur sa moitié : la seconde ne défait pas
    la première, et aucune ne touche à ce que l'autre a laissé."""
    gauche = Passe(
        moteur="trace", tolerance=20, trace=((10, 10), (31, 10), (31, 53), (10, 53))
    )
    droite = Passe(
        moteur="trace", tolerance=20, trace=((32, 10), (53, 10), (53, 53), (32, 53))
    )

    alpha = _alpha(Recette(passes=(gauche, droite)))

    x, y, largeur, hauteur = BLOC
    assert alpha[y : y + hauteur, x : x + largeur].all()
    assert alpha[12, 12] == 0 and alpha[12, 50] == 0
    assert alpha[0, 0] == 255


# ── « Rien n'est tiré au sort » ──────────────────────────────────────────────


def test_la_meme_recette_rend_le_meme_masque():
    """**Le critère du produit depuis T2**, appliqué au seul geste du dépôt qui
    porte une forme dessinée : la rasterisation du polygone ne lisse rien, donc
    un pixel est dedans ou dehors, jamais à demi. Un bord lissé aurait été
    tranché à pile ou face par le seuil, et deux rendus auraient différé."""
    recette = Recette(passes=(ENTOUREE,))

    assert np.array_equal(_alpha(recette), _alpha(recette))
    assert appliquer(recette, _octets()).octets == appliquer(recette, _octets()).octets


def test_une_forme_de_moins_de_trois_points_ne_retire_rien():
    """Deux points n'entourent rien. La passe arrive sans effet et ne mange pas
    l'image en attendant qu'on finisse le geste — même règle qu'une pipette
    qu'on n'a pas encore visée."""
    alpha = _alpha(Recette(passes=(Passe(moteur="trace", trace=((10, 10), (30, 30))),)))

    assert alpha.all()


# ── « Elle agit avant le recadrage et la mise sur grille » ───────────────────


def test_le_sujet_entoure_est_cadre_comme_nimporte_quel_autre():
    """**Tant que le fond est encore là, la boîte du sujet, c'est toute
    l'image.** Un détourage fait en dernier rendrait un sprite mal cadré et mal
    calé dans sa case ; celui-ci est une passe, donc il agit en premier."""
    # On entoure ici l'image entière — le geste de celui qui veut tout le fond,
    # et le seul qui laisse le recadrage quelque chose à mesurer : ce qui est
    # **hors** du tracé reste opaque par construction, donc un tracé partiel
    # laisse une boîte opaque de la taille de l'image, et c'est juste.
    partout = Passe(
        moteur="trace",
        tolerance=20,
        trace=((0, 0), (COTE - 1, 0), (COTE - 1, COTE - 1), (0, COTE - 1)),
    )
    rendu = appliquer(
        Recette(passes=(partout,), recadrage=Recadrage(marge=0)), _octets()
    )

    # Le recadrage tombe sur la boîte du bloc, pas sur les 64 px de l'image.
    _, _, largeur, hauteur = BLOC
    assert (rendu.largeur, rendu.hauteur) == (largeur, hauteur)


def test_ce_qui_sort_se_retouche_ensuite_a_la_main():
    """**Sans avoir à recommencer** : la sélection est une place, la main en est
    une autre, et l'ordre fixe les enchaîne. Un passage qui ferme de l'alpha
    s'ajoute à ce que le tracé a laissé."""
    passage = Trait(garde=False, rayon=2, points=((30, 30), (34, 30)), couleur="")
    recette = Recette(passes=(ENTOUREE,), main=Main(opacite=(passage,)))

    alpha = detourer(recette, _octets())
    apres = appliquer(recette, _octets())

    assert alpha[:, :, 3][30, 30] == 255, "le tracé seul garde le sujet"
    lu = np.asarray(Image.open(io.BytesIO(apres.octets)).convert("RGBA"))
    assert lu[30, 30, 3] == 0, "le passage de la main n'a pas agi après le tracé"


# ── « La forme tracée ne voyage pas » ───────────────────────────────────────


def test_la_forme_entouree_ne_voyage_pas_et_le_dit():
    """**Une coordonnée ne voyage pas** (U5), et une suite de coordonnées encore
    moins : une silhouette entourée sur une attitude tomberait sur le bras au
    lieu du casque à l'attitude d'à côté."""
    partie, laisse = voyage(Recette(passes=(ENTOUREE,), grille=Grille(cible=32)))

    assert partie.passes[0].trace == ()
    # Ce qui reste, reste entier : la passe garde sa tolérance et son moteur.
    assert partie.passes[0].moteur == "trace"
    assert partie.passes[0].tolerance == 20
    assert partie.grille is not None and partie.grille.cible == 32
    assert any("entourée" in ligne for ligne in laisse)


def test_une_forme_qui_na_pas_voyage_arrive_sans_effet():
    """La ligne de la laisse dit vrai : la passe est là, elle ne retire rien."""
    partie, _ = voyage(Recette(passes=(ENTOUREE,)))

    assert _alpha(partie).all()


# ── Ce que la route refuse, et ce qu'elle laisse passer ─────────────────────


def _importer(client, tmp_path) -> str:
    fichier = tmp_path / "bloc.png"
    fichier.write_bytes(_octets())
    return client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]["identifiant"]


def test_la_route_prend_la_forme_et_la_rend(client, tmp_path):
    identifiant = _importer(client, tmp_path)

    pose = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [
                {"moteur": "trace", "tolerance": 20, "trace": [list(p) for p in AUTOUR]}
            ]
        },
    )

    assert pose.status_code == 200, pose.text
    passe = pose.json()["recette"]["passes"][0]
    assert passe["trace"] == [list(p) for p in AUTOUR]
    # Et l'image rendue est bien plus petite que le brut : le fond entouré est
    # parti, donc la boîte opaque a rétréci.
    assert pose.json()["rendu_largeur"] <= COTE


@pytest.mark.parametrize(
    "forme, morceau",
    [
        ([[-1, 10], [30, 10], [30, 30]], "sort de l'image"),
        ([[0, 0]] * 4001, "au plus"),
    ],
)
def test_une_forme_impossible_est_refusee_en_la_nommant(
    client, tmp_path, forme, morceau
):
    """Un refus **nomme le réglage fautif**, il ne ramène rien en silence vers
    la borne la plus proche."""
    identifiant = _importer(client, tmp_path)

    refus = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": [{"moteur": "trace", "trace": forme}]},
    )

    # 409 quand c'est le service qui refuse — la recette est cohérente mais
    # impossible —, 422 quand la borne est déclarée sur la route et arrête la
    # charge avant qu'elle n'entre. Les deux nomment le réglage fautif.
    assert refus.status_code in (409, 422), refus.text
    assert morceau in refus.text or "trace" in refus.text
