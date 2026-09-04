# -*- coding: utf-8 -*-
"""La stabilité d'une bande — **ce qui bouge alors que le sujet n'a pas bougé**.

Arrivée en A5 (V3), et c'est la mesure qui manquait au produit. Tout le reste de
`atelier/image/` juge **une** image : est-elle bien détourée, bien réduite, à la
bonne taille. Or les trois défauts qui décident du sort d'une animation — le
contour qui bout, l'échelle qui pompe, le pied qui patine — ne se voient
**qu'entre deux images**. Un défaut fixe est un défaut ; *un défaut animé est un
défaut qu'on regarde*.

## Les trois chiffres, et pourquoi trois

**Le bord qui revient sur ses pas.** C'est celui qui nomme vraiment le
grésillement, et il tient dans une phrase : *un pixel que le sujet traverse
s'allume une fois et reste allumé ; un pixel qui s'allume, s'éteint, se rallume,
c'est du grésil.* On compte donc, pour chaque pixel, ses changements d'état
au-delà du premier. Un sujet qui glisse proprement en fait zéro ; un contour qui
bout en fait beaucoup.

⚠️ **Il a été trouvé après coup, et c'est instructif.** La tranche a d'abord été
jugée sur le chiffre suivant — le bord qui change —, et il ne montrait rien du
tout, parce qu'il mélange le grésil au mouvement et que le mouvement pèse
beaucoup plus lourd. Sur le banc d'`A5`, le même réglage fait −6 % sur celui-là
et **−33 %** sur celui-ci. Une mesure trop large ne dit pas « il n'y a rien » :
elle dit « je ne sais pas regarder ».

**Le bord qui change.** Entre deux images voisines, combien de pixels de la
silhouette changent d'état, rapportés à la longueur du bord. ⚠️ **Il compte le
vrai mouvement aussi**, et c'est assumé : rien ici ne sait distinguer un bord qui
grésille d'un bras qui se lève. Il ne se lit donc pas dans l'absolu — il se lit
**comparé à lui-même**, la même bande avant et après un réglage. Le mouvement
pèse pareil des deux côtés ; ce qui baisse est le grésillement. Il sert aussi de
dénominateur au premier : *sur tout ce qui a bougé, quelle part est revenue en
arrière.*

**Les couleurs d'une seule image.** Combien de couleurs de la bande n'existent
que dans une image sur toutes. Celui-là est le plus propre des trois : une
couleur qui ne dure qu'un huitième de seconde n'est pas une nuance, c'est un
scintillement. Sur une bande dont la palette se recalcule image par image,
presque toutes les couleurs sont dans ce cas ; sur une bande dont la palette est
décidée une fois, il n'en reste que ce que le mouvement apporte vraiment.

**Aucun des trois n'est un seuil.** Le produit n'en tire aucun refus et n'en
grise rien : il les affiche à côté de l'aperçu, et c'est l'auteur qui regarde son
animation tourner en face du chiffre.

⚠️ **Et aucun des trois ne se mesure sur l'ordre de lecture.** Une bande qui se
joue en va-et-vient rejoue ses images à l'envers, donc *tout* y revient sur ses
pas — mais à l'écran, pas dans le fichier. La mesure se fait sur les images
telles qu'elles sont rangées, une seule fois chacune. Mesurer l'ordre de lecture
ferait dire au chiffre que toute bande en va-et-vient grésille, ce qui est faux.

## Ce que ce module n'a pas le droit de faire

Il ne retouche rien, il ne décide rien, et **il ne connaît pas la recette**. On
lui donne les images telles qu'elles sortent de la chaîne du jeu, il rend des
nombres. C'est ce qui permet de mesurer *avant* et *après* avec le même
instrument — et un instrument qui connaîtrait le réglage qu'on juge ne serait
plus un instrument.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

import numpy as np

from atelier.image.traitement import restreindre


@dataclass(frozen=True, slots=True)
class Stabilite:
    """Ce qu'une bande fait bouger entre ses images.

    Les comptes bruts voyagent avec les parts : une part de 4 % ne dit pas la
    même chose sur un contour de trente pixels et sur un contour de trois cents,
    et c'est justement sur les petites cases que le grésillement se voit le plus.
    """

    images: int
    # Le bord qui change, cumulé sur toutes les paires d'images voisines.
    contour: int
    # La longueur de bord sur laquelle il a été compté — le dénominateur.
    contour_mesure: int
    # Les changements d'état **au-delà du premier**, pixel par pixel : le grésil.
    allers_retours: int
    # Les couleurs de toute la bande, et celles qui n'existent que dans une image.
    couleurs: int
    couleurs_d_une_image: int

    @property
    def part_du_contour(self) -> float:
        """La part du bord qui change d'une image à l'autre. **Zéro est un bord calme.**"""
        if self.contour_mesure <= 0:
            return 0.0
        return round(self.contour / self.contour_mesure, 4)

    @property
    def part_des_allers_retours(self) -> float:
        """La part de ce qui a bougé **qui est revenu en arrière**.

        Le dénominateur est `contour` — tout ce qui a changé d'état — et non la
        longueur du bord. C'est voulu : la question n'est pas « quelle part du
        personnage grésille » mais **« sur tout ce qui a bougé, quelle part n'est
        pas du mouvement »**. Une bande immobile n'a rien qui bouge, donc rien
        qui revienne : zéro, et non une division impossible.
        """
        if self.contour <= 0:
            return 0.0
        return round(self.allers_retours / self.contour, 4)

    @property
    def part_des_couleurs(self) -> float:
        """La part des couleurs qui ne durent qu'une image."""
        if self.couleurs <= 0:
            return 0.0
        return round(self.couleurs_d_une_image / self.couleurs, 4)

    def en_json(self) -> dict[str, Any]:
        return {
            "images": self.images,
            "contour": self.contour,
            "contour_mesure": self.contour_mesure,
            "part_du_contour": self.part_du_contour,
            "allers_retours": self.allers_retours,
            "part_des_allers_retours": self.part_des_allers_retours,
            "couleurs": self.couleurs,
            "couleurs_d_une_image": self.couleurs_d_une_image,
            "part_des_couleurs": self.part_des_couleurs,
        }


def mesurer(images: Sequence[np.ndarray]) -> Stabilite:
    """Les trois chiffres, sur les images d'une bande **déjà rendues**.

    Elles doivent avoir la même taille — c'est le cas dès qu'une fenêtre commune
    les a calées (`A2`), et c'est justement la condition sans laquelle *comparer
    deux images* ne veut rien dire. Des tailles différentes rendent une mesure
    vide plutôt qu'une erreur : un module de mesure ne refuse pas, il constate
    qu'il n'y a rien à mesurer.

    Une bande d'une seule image est **calme par définition** — il n'y a aucune
    paire —, et ce n'est pas un aveu d'ignorance : une image seule ne peut pas
    grésiller.
    """
    utiles = [i for i in images if i.ndim == 3 and i.shape[2] == 4]
    if len(utiles) < 2 or len({i.shape for i in utiles}) != 1:
        return Stabilite(
            images=len(utiles),
            contour=0,
            contour_mesure=0,
            allers_retours=0,
            couleurs=int(_couleurs_de(utiles[0])[0].shape[0]) if utiles else 0,
            couleurs_d_une_image=0,
        )

    silhouettes = [image[:, :, 3] > 0 for image in utiles]
    # **Le bord, et non la silhouette entière** : ce qui grésille est la
    # frontière, et rapporter le changement à la surface du sujet donnerait une
    # part minuscule sur un gros personnage et énorme sur un petit — donc deux
    # bandes incomparables.
    bords = [s & ~restreindre(s, 1) for s in silhouettes]

    change = 0
    mesure = 0
    for avant, apres, bord_a, bord_b in zip(
        silhouettes, silhouettes[1:], bords, bords[1:]
    ):
        change += int(np.count_nonzero(avant ^ apres))
        mesure += int(np.count_nonzero(bord_a | bord_b))

    # Les allers-retours : pour chaque pixel, ses bascules **au-delà de la
    # première**. Un pixel que le sujet traverse en bascule une, et une seule ;
    # tout le reste est revenu en arrière. La somme des bascules vaut exactement
    # `change` ci-dessus — les deux chiffres partagent donc le même total, ce qui
    # est ce qui les rend comparables.
    empilees = np.stack(silhouettes)
    bascules = np.count_nonzero(empilees[1:] != empilees[:-1], axis=0)
    revenus = int(np.maximum(bascules - 1, 0).sum())

    presences: dict[bytes, int] = {}
    for image in utiles:
        for couleur in _couleurs_de(image)[0]:
            presences[couleur.tobytes()] = presences.get(couleur.tobytes(), 0) + 1

    return Stabilite(
        images=len(utiles),
        contour=change,
        contour_mesure=mesure,
        allers_retours=revenus,
        couleurs=len(presences),
        couleurs_d_une_image=sum(1 for combien in presences.values() if combien == 1),
    )


def _couleurs_de(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Les couleurs **des pixels opaques**, et rien d'autre.

    ⚠️ Sous un pixel transparent il reste une couleur — *effacer un pixel ne
    change pas sa couleur* (`AGENTS.md`, point 5) —, et elle n'est jamais vue.
    La compter ferait dire à la mesure que la bande scintille dans son fond
    invisible, ce qui n'a aucun sens et masquerait le vrai chiffre.
    """
    opaques = image[:, :, 3] > 0
    if not opaques.any():
        return np.empty((0, 3), dtype=np.uint8), np.empty(0, dtype=np.int64)
    return np.unique(image[:, :, :3][opaques], axis=0, return_counts=True)
