# -*- coding: utf-8 -*-
"""Ce qu'une table a besoin de savoir de l'image, et que seul le serveur peut dire.

**Trois mesures, et aucune n'est un réglage.** Elles décrivent ce que l'image
*contient* — les taches que le nettoyage des bords va effacer, les poches de fond
que le sujet enferme, les crans d'occupation où la remise sur grille change
vraiment quelque chose. Les trois répondent à la même question posée trois fois :
*qu'est-ce que ce curseur va faire, avant que je le bouge ?*

**Pourquoi elles vivent ici et pas à l'écran.** Elles se lisent dans les pixels,
et les pixels sont sur le disque. Les recalculer dans le navigateur demanderait
d'y descendre l'image entière, puis d'y réécrire le remplissage par plages qui
existe déjà dans `traitement.composantes` — et deux implémentations du même
remplissage finiraient par se répondre différemment sur la même image.

**Aucune ne modifie quoi que ce soit.** Une table qui propose d'effacer une tache
la montre d'abord ; c'est l'auteur qui efface, et ce qu'il efface passe par la
recette comme tout le reste.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from atelier.domaine.recette import Grille
from atelier.image.traitement import composantes


@dataclass(frozen=True, slots=True)
class Tache:
    """Une tache opaque, avec de quoi la désigner et la juger.

    `boite` est en pixels de l'image **détourée**, coin haut-gauche inclus et
    coin bas-droit inclus — la convention de rectangle du produit, celle du
    découpage. `couleur` est la moyenne de ses pixels : c'est ce qui permet à la
    pipette de retirer *toutes les taches de sa couleur* sans que l'écran ait à
    redescendre les pixels.
    """

    aire: int
    boite: tuple[int, int, int, int]
    couleur: str

    def en_json(self) -> dict[str, Any]:
        return {"aire": self.aire, "boite": list(self.boite), "couleur": self.couleur}


def _boite(masque: np.ndarray) -> tuple[int, int, int, int]:
    lignes = np.flatnonzero(masque.any(axis=1))
    colonnes = np.flatnonzero(masque.any(axis=0))
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


def _couleur(rgba: np.ndarray, masque: np.ndarray) -> str:
    pixels = rgba[masque][:, :3]
    if pixels.size == 0:
        return "#000000"
    r, v, b = (int(round(float(c))) for c in pixels.mean(axis=0))
    return f"#{r:02x}{v:02x}{b:02x}"


def taches(rgba: np.ndarray, *, plafond: int = 200) -> list[Tache]:
    """Les taches opaques de l'image, **de la plus petite à la plus grande**.

    C'est l'ordre qui compte : le nettoyage des bords efface *en dessous d'un
    seuil*, donc ce qu'on veut lire d'abord est ce qui partira en premier. Le
    sujet lui-même est une tache comme les autres — la plus grande —, et il est
    dans la liste parce que le taire ferait croire qu'il n'y en a que douze là où
    il y en a treize.

    Le plafond n'est pas un choix d'apparence : une image bruitée peut porter des
    milliers de taches d'un pixel, et la liste sert à *regarder*. Ce qui est
    coupé est dit par l'appelant, jamais tu en silence.
    """
    alpha = rgba[:, :, 3]
    if not alpha.any():
        return []
    trouvees = [
        Tache(aire=aire, boite=_boite(masque), couleur=_couleur(rgba, masque))
        for masque, aire in composantes(alpha > 0)
    ]
    trouvees.sort(key=lambda t: t.aire)
    return trouvees[:plafond]


def poches(rgba: np.ndarray) -> list[Tache]:
    """Les poches de fond **enfermées par le sujet**.

    Un détourage par tolérance de bord efface le fond qu'il atteint depuis les
    bords de l'image. Ce qu'il n'atteint pas reste : la lumière entre un bras et
    un torse, le trou d'une anse, l'intérieur d'un anneau. Ces poches-là sont
    parfois du fond qu'on veut retirer, parfois de la matière qu'on veut garder
    — un cabochon de lanterne, un vitrail. **Le produit ne tranche pas** : il les
    cercle, il les compte, et il ne les efface jamais de lui-même.

    Comment on les trouve : les zones **transparentes** qui ne touchent aucun
    bord de l'image. Une zone transparente qui touche un bord est le fond
    ordinaire, déjà parti ; celle qui n'en touche aucun est enfermée.
    """
    alpha = rgba[:, :, 3]
    vide = alpha == 0
    if not vide.any():
        return []
    hauteur, largeur = vide.shape
    dedans: list[Tache] = []
    for masque, aire in composantes(vide):
        touche_un_bord = (
            masque[0].any()
            or masque[hauteur - 1].any()
            or masque[:, 0].any()
            or masque[:, largeur - 1].any()
        )
        if touche_un_bord:
            continue
        dedans.append(
            # La couleur d'une poche est celle qu'elle **avait** — transparente,
            # elle n'en a plus. On rend donc celle du fond qui l'entoure, prise
            # sur la boîte : c'est ce qui permet de la reconnaître à l'œil.
            Tache(aire=aire, boite=_boite(masque), couleur=_couleur(rgba, masque))
        )
    dedans.sort(key=lambda t: t.aire, reverse=True)
    return dedans


def crans_occupation(rgba: np.ndarray, grille: Grille) -> list[int]:
    """Les valeurs d'occupation où l'image **change vraiment**.

    Le curseur va de 10 à 100 et s'arrête à chaque pour cent : quatre-vingt-onze
    positions pour une image qui, sur une cible de 64 pixels, n'en a qu'une
    trentaine de tailles possibles. Deux crans voisins rendent alors la même
    image, et la main croit régler quelque chose.

    Ce qui décide est la taille en pixels que le sujet occupera dans la case :
    `round(cible × occupation / 100)`. Deux occupations qui donnent la même
    taille donnent la même image ; on ne garde donc que la première de chaque.

    **Aucun rendu n'est calculé ici.** C'est de l'arithmétique sur la cible, pas
    une mesure sur les pixels — l'image ne sert qu'à savoir s'il y a un sujet.
    """
    if not rgba[:, :, 3].any():
        return []
    cible = max(1, grille.cible)
    vus: set[int] = set()
    retenus: list[int] = []
    for occupation in range(10, 101):
        cote = round(cible * occupation / 100)
        if cote in vus:
            continue
        vus.add(cote)
        retenus.append(occupation)
    return retenus
