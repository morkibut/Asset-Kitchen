# -*- coding: utf-8 -*-
"""U10 · Chaque passe de détourage dit ce qu'elle enlève.

**Ce qui se mesure ici** : qu'une passe masquée soit retirée du calcul et n'y
laisse rien, qu'elle garde tous ses réglages et que la remontrer rende
exactement l'image d'avant, que masquer ne soit pas retirer, et — le cœur de
l'étape — que la pipette d'une **seconde** passe ne reparte plus à travers ce
que la première a effacé.

**Le défaut, en une phrase.** Effacer un pixel ne change pas sa couleur, ça ne
change que sa transparence. Une seconde passe lisait donc un fond que la
première avait déjà retiré et qui, pour elle, était encore là : la tache
repartait par ce couloir invisible et ressortait ailleurs dans l'image, sur une
zone qui ne touchait même pas le point désigné. Il est reproduit et mesuré dans
`essais/essai_pipette_seconde.py` — 120 pixels pris en trop —, et le cas des
deux passes enchaînées est tenu ici.

**Ce que l'écran en montre** — l'interrupteur, le grisé, le mot qui distingue
masquer de retirer — vit dans `interface/src/App.test.tsx`.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from atelier.domaine.recette import Passe, Recette
from atelier.image.traitement import appliquer, detourer

# ── L'image de l'essai — celle du banc, aux mêmes couleurs ───────────────────

COTE = 64
FOND = (0x20, 0x20, 0x20)
POCHE = (0x2A, 0x2A, 0x2A)
SUJET = (0xC8, 0xA0, 0x5A)

BLOCS = ((6, 20, 22, 24), (36, 20, 22, 24))
POCHES = ((12, 26, 10, 12), (42, 26, 10, 12))
#: Deux pixels de fond qui relient chaque poche au dehors, à travers son bloc.
#: La passe de bord les retire — ils deviennent invisibles et restent un chemin.
COULOIRS = ((15, 20, 2, 6), (45, 20, 2, 6))

POINT = (16, 32)  # un pixel de la poche de gauche, celle qu'on vise


def _peindre(rgb: np.ndarray, boites, couleur) -> None:
    for x, y, largeur, hauteur in boites:
        rgb[y : y + hauteur, x : x + largeur] = couleur


def _octets() -> bytes:
    rgb = np.zeros((COTE, COTE, 3), dtype=np.uint8)
    rgb[:, :] = FOND
    _peindre(rgb, BLOCS, SUJET)
    _peindre(rgb, POCHES, POCHE)
    _peindre(rgb, COULOIRS, FOND)
    tampon = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _octets_deja_troues() -> bytes:
    """Une image **qui porte déjà de la transparence**, pour la remise sur grille.

    La case de la grille loge la *boîte opaque* du sujet ; sur une image opaque
    de bord à bord, cette boîte est l'image entière et la case ne change donc
    rien — un essai posé sur elle passerait quoi qu'on lise. Il faut une image
    déjà trouée pour que la question ait une réponse visible.
    """
    rgba = np.zeros((COTE, COTE, 4), dtype=np.uint8)
    rgba[18:38, 10:30, :3] = SUJET
    rgba[18:38, 10:30, 3] = 255
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _zone(index: int) -> np.ndarray:
    x, y, largeur, hauteur = POCHES[index]
    masque = np.zeros((COTE, COTE), dtype=bool)
    masque[y : y + hauteur, x : x + largeur] = True
    return masque


def _alpha(recette: Recette) -> np.ndarray:
    return detourer(recette, _octets())[:, :, 3]


BORD = Passe(moteur="bord", tolerance=8)
PIPETTE = Passe(moteur="couleur", tolerance=20, point=POINT)


# ── « La pipette ne prend plus une zone qui ne touche pas le point » ─────────


def test_la_pipette_dune_seconde_passe_ne_traverse_pas_ce_qui_est_efface():
    """**Le cas par lequel le défaut est passé**, tenu en entier.

    La poche visée part en entier — le geste ne perd rien —, et la poche
    voisine, qui a la même couleur mais qui ne touche pas le point, reste.
    """
    alpha = _alpha(Recette(passes=(BORD, PIPETTE)))

    visee, voisine = _zone(0), _zone(1)
    assert not alpha[visee].any(), "la poche visée n'est pas partie en entier"
    assert alpha[voisine].all(), "la poche voisine a été prise, elle ne touche rien"


def test_la_premiere_passe_seule_laisse_les_deux_poches():
    """Le témoin : sans la pipette, les deux poches survivent à la passe de
    bord. Sans lui, l'essai d'au-dessus pourrait passer sur une image où il n'y
    a jamais rien eu à prendre."""
    alpha = _alpha(Recette(passes=(BORD,)))

    assert alpha[_zone(0)].all() and alpha[_zone(1)].all()
    # Et le fond extérieur, lui, est bien parti — sinon il n'y aurait pas de
    # couloir, donc pas de défaut à corriger.
    assert alpha[0, 0] == 0


# ── « Une passe masquée est retirée du calcul » ──────────────────────────────


def test_une_passe_masquee_ne_fait_rien():
    """Retirée du calcul, et pas *presque* retirée. C'est la règle de la veille
    d'une table (U4), un cran plus bas."""
    seule = _alpha(Recette(passes=(BORD,)))
    avec_masquee = _alpha(
        Recette(passes=(BORD, Passe(moteur="couleur", tolerance=120, point=POINT,
                                    masquee=True)))
    )

    assert np.array_equal(seule, avec_masquee)


def test_masquer_la_seule_passe_rend_limage_dorigine():
    """Une recette dont toutes les passes sont masquées ne détoure rien — pas
    même un pixel de bord."""
    brut = _alpha(Recette())
    masquee = _alpha(Recette(passes=(Passe(moteur="bord", tolerance=8, masquee=True),)))

    assert np.array_equal(brut, masquee)
    assert masquee.all(), "l'image d'origine est opaque de bord à bord"


def test_la_case_de_la_grille_suit_ce_qui_agit():
    """**La fuite que U4 avait déjà attrapée un étage plus haut.** La remise sur
    grille demande à savoir si l'image est détourée ; lire « des passes sont
    écrites » plutôt que « des passes agissent » aurait gardé la case pendant
    qu'on masque la dernière, et l'image aurait changé de taille pour une raison
    que rien n'affiche."""
    from atelier.domaine.recette import Grille

    grille = Grille(cible=32, occupation=100)
    octets = _octets_deja_troues()
    vive = appliquer(Recette(passes=(BORD,), grille=grille), octets)
    masquee = appliquer(
        Recette(passes=(Passe(moteur="bord", tolerance=8, masquee=True),), grille=grille),
        octets,
    )
    sans = appliquer(Recette(grille=grille), octets)

    # Détourée, l'image est logée dans la case de la grille ; sans détourage,
    # elle est ramenée telle quelle. Une passe masquée doit rendre le second cas
    # — **au pixel près**, et non seulement à la taille près.
    assert masquee.octets == sans.octets
    assert vive.octets != sans.octets


# ── « Masquer n'est pas retirer, et la rallumer rend l'état d'avant » ────────


def test_masquer_garde_tous_les_reglages_et_se_defait_a_lidentique(client, tmp_path):
    """**Le critère qui distingue masquer de retirer**, mesuré sur l'empreinte :
    deux recettes égales ont la même empreinte, donc le même rendu."""
    fichier = tmp_path / "poches.png"
    fichier.write_bytes(_octets())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    passes = [
        {"moteur": "bord", "tolerance": 8},
        {"moteur": "couleur", "tolerance": 20, "point": list(POINT), "portee": "tache"},
    ]
    avant = client.put(
        f"/api/assets/{asset['identifiant']}/recipe", json={"passes": passes}
    ).json()

    masquee = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={"passes": [passes[0], {**passes[1], "masquee": True}]},
    ).json()
    # **Elle est toujours là, avec tous ses réglages** — c'est ce qui la
    # distingue d'une passe retirée.
    assert len(masquee["recette"]["passes"]) == 2
    assert masquee["recette"]["passes"][1]["point"] == list(POINT)
    assert masquee["recette"]["passes"][1]["tolerance"] == 20
    assert masquee["recette"]["passes"][1]["masquee"] is True
    # Et le rendu a changé de nom, puisqu'il a changé.
    assert masquee["empreinte"] != avant["empreinte"]

    remontree = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={"passes": [passes[0], {**passes[1], "masquee": False}]},
    ).json()

    assert remontree["empreinte"] == avant["empreinte"]
    assert remontree["recette"]["passes"] == avant["recette"]["passes"]


def test_une_recette_ecrite_avant_u10_reste_visible():
    """Le champ n'existait pas hier. Son absence veut dire *visible* : les
    fichiers du disque continuent de rendre exactement ce qu'ils rendaient."""
    passe = Passe.depuis_json({"moteur": "bord", "tolerance": 8})

    assert passe.masquee is False
    assert len(Recette(passes=(passe,)).passes_vives()) == 1
