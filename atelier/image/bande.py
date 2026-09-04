# -*- coding: utf-8 -*-
"""La bande — **plusieurs images traitées ensemble, sur une fenêtre commune**.

Arrivée en A2 (V3). C'est le seul endroit du traitement qui regarde **plusieurs
images à la fois**, et c'est ce qui le rend nécessaire : tout le reste de
`atelier/image/` travaille sur une image et n'a aucune raison de savoir qu'il
en existe d'autres.

**Le défaut qu'elle ferme.** Sans elle, chaque image se recadre sur sa propre
boîte : l'échelle et le centrage se calculent sur ce que *cette* image occupe.
Un bras tendu agrandit la boîte, donc réduit tout le personnage. Mesuré sur un
clip le 3 septembre 2026 :

| Le cadre pris sur | Ce que ça donne | Ce que le jeu voit |
|---|---|---|
| la boîte de chaque image | repos 217 × 376, marche 246 × 380 | le personnage sort à **37 px au repos et 41 en marchant** — il grandit de 10 % en se mettant à marcher |
| **le clip entier** | 246 × 381 pour les deux | la même assise partout, et rien ne bouge au changement d'animation |

**Et la fenêtre se prend sur le clip entier, jamais sur la bande seule.** C'est
*l'erreur juste à côté* de la bonne réponse, et le montage des essais la faisait :
une fenêtre par bande cale les images **d'une** bande entre elles ; il faut une
fenêtre par clip pour caler **les bandes** entre elles. Sans quoi le personnage
change de taille en passant du repos à la marche — exactement le défaut qu'on
croyait réparer.

**Le corollaire d'ordre, et il n'est pas décoratif.** L'ancrage vertical pose le
**bas de la boîte** sur le bas de la case : toute poussière, toute ombre isolée
sous les pieds soulève donc le personnage d'autant. Le nettoyage des taches doit
précéder le calcul de la boîte — et c'est plus vrai encore sur un clip, dont les
images sont lissées et compressées et dont le fond n'est uni qu'à une tolérance
près. Dans la recette d'une image seule, le nettoyage vient *après* la grille, ce
qui est juste là-bas : il enlève ce que la réduction a laissé traîner. Ici il
faut le passer **avant**, sur l'image d'origine, et c'est `_seuil_des_taches` qui
convertit le chiffre de la recette dans cette résolution-là.

**Rien ici n'appelle le fournisseur, rien ici ne touche la carte graphique** :
les deux invariants du traitement tiennent, et le module ne connaît que `numpy`,
Pillow et la recette.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence

import numpy as np

from atelier.domaine.recette import Recette, cote_du_sujet
from atelier.image.traitement import (
    Rendu,
    avant_la_grille,
    boite_opaque,
    composantes,
    detourer,
    finir,
)


@dataclass(frozen=True, slots=True)
class Fenetre:
    """La boîte que toutes les images d'un clip partagent, bornes comprises.

    Elle est dans les coordonnées de l'image **telle que `sur_grille` la voit** —
    donc après le détourage et après le recadrage de la recette. Le dire ici
    plutôt que de le laisser deviner : une fenêtre prise avant le recadrage
    tomberait à côté sans que rien ne lève.
    """

    gauche: int
    sommet: int
    droite: int
    bas: int

    # Sur combien d'images elle a été prise. **Écrit plutôt que déduit** :
    # l'écran de montage doit pouvoir dire *prise sur le clip entier* ou *prise
    # sur la bande*, et les deux ne se distinguent que par ce chiffre.
    images: int = 0
    # Combien de taches le nettoyage a écartées avant de mesurer. Zéro veut dire
    # « rien à écarter » ou « la recette ne nettoie pas » — l'écran ne s'en sert
    # pas, le banc si : c'est le chiffre qui dit si le corollaire d'ordre a servi.
    taches_ecartees: int = 0

    @property
    def largeur(self) -> int:
        return self.droite - self.gauche + 1

    @property
    def hauteur(self) -> int:
        return self.bas - self.sommet + 1

    def en_tuple(self) -> tuple[int, int, int, int]:
        return self.gauche, self.sommet, self.droite, self.bas

    def en_json(self) -> dict[str, Any]:
        return {
            "gauche": self.gauche,
            "sommet": self.sommet,
            "droite": self.droite,
            "bas": self.bas,
            "largeur": self.largeur,
            "hauteur": self.hauteur,
            "images": self.images,
            "taches_ecartees": self.taches_ecartees,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Fenetre | None":
        if not d:
            return None
        try:
            return Fenetre(
                gauche=int(d["gauche"]),
                sommet=int(d["sommet"]),
                droite=int(d["droite"]),
                bas=int(d["bas"]),
                images=int(d.get("images", 0)),
                taches_ecartees=int(d.get("taches_ecartees", 0)),
            )
        except (KeyError, TypeError, ValueError):  # pragma: no cover — fichier abîmé
            return None


def preparer(octets: bytes, recette: Recette) -> np.ndarray:
    """Une image du clip, **telle que la grille la verra** : détourée et recadrée.

    C'est le préfixe exact de la chaîne, repris de `queue` et non réécrit : deux
    façons de le calculer donneraient deux systèmes de coordonnées, et la
    fenêtre tomberait à côté.
    """
    return avant_la_grille(detourer(recette, octets), recette)


def fenetre_commune(preparees: Sequence[np.ndarray], recette: Recette) -> Fenetre | None:
    """Ce que ces images occupent **ensemble**, une fois les taches écartées.

    Rend `None` quand aucune image ne porte rien — le détourage a tout mangé.
    C'est le cas d'US-71 : il ne se répare pas ici, **il se voit**.

    **La liste doit être celle du clip entier**, pas celle de la bande qu'on
    garde. C'est le renversement du 3 septembre 2026, et il ne se rattrape pas
    plus tard : une fenêtre par bande cale les images d'une bande entre elles ;
    il faut une fenêtre par clip pour caler les bandes entre elles.
    """
    brutes = [b for b in (boite_opaque(img[:, :, 3]) for img in preparees) if b]
    if not brutes:
        return None

    seuil = _seuil_des_taches(_union(brutes), recette)
    if seuil <= 0:
        return Fenetre(*_union(brutes), images=len(preparees))

    boites: list[tuple[int, int, int, int]] = []
    ecartees = 0
    for image in preparees:
        boite, sautees = _boite_nettoyee(image[:, :, 3], seuil)
        ecartees += sautees
        if boite:
            boites.append(boite)
    # **Tout écarter n'est pas une réponse.** Si le seuil a mangé chaque tache de
    # chaque image, on retombe sur la mesure brute plutôt que de rendre `None` :
    # un sujet existe, et le dire absent serait pire que de garder la poussière.
    if not boites:
        return Fenetre(*_union(brutes), images=len(preparees))
    return Fenetre(*_union(boites), images=len(preparees), taches_ecartees=ecartees)


def monter(
    preparees: Iterable[np.ndarray], recette: Recette, fenetre: Fenetre | None
) -> list[Rendu]:
    """Les images de la bande, passées par la chaîne du jeu **sur la même fenêtre**.

    Ce qui sort est exactement ce que l'aperçu montre et ce que l'export écrira :
    une seule chaîne, un seul rendu. Deux façons de monter une bande finiraient
    par ne plus donner les mêmes pixels, et c'est l'auteur qui découvrirait
    l'écart à l'export.
    """
    cadre = fenetre.en_tuple() if fenetre else None
    return [finir(image, recette, cadre) for image in preparees]


# ── Les taches, et pourquoi le seuil se convertit ────────────────────────────


def _union(boites: Sequence[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return (
        min(b[0] for b in boites),
        min(b[1] for b in boites),
        max(b[2] for b in boites),
        max(b[3] for b in boites),
    )


def _seuil_des_taches(brute: tuple[int, int, int, int], recette: Recette) -> float:
    """L'aire minimale d'une tache, **traduite dans la résolution du clip**.

    `Bords.aire_min` compte des pixels de la case du projet — 64 carrés de côté,
    d'ordinaire —, parce que le nettoyage s'y fait *après* la réduction. Appliqué
    tel quel à une image de 480 px, il n'écarterait rien : une ombre de deux
    carrés y pèse quelques centaines de pixels. On le convertit donc par le carré
    du facteur de réduction — une surface se convertit au carré d'une longueur.

    **Le facteur se prend sur la boîte brute**, celle d'avant nettoyage. C'est
    une itération, pas un point fixe, et c'est assumé : une poussière lointaine
    gonfle la boîte, donc le facteur, donc le seuil — la mesure est légèrement
    plus sévère là où il y a plus à écarter, ce qui va dans le bon sens et
    reste borné. Deux passes rendraient le chiffre dépendant d'un ordre
    d'itération pour un gain que rien ne mesure.

    Zéro quand la recette ne nettoie pas : **elle a dit de ne rien écarter**, et
    ce n'est pas à la bande d'en décider à sa place.
    """
    if recette.bords is None or recette.bords.aire_min <= 0:
        return 0.0
    if recette.grille is None:
        return 0.0
    x0, y0, x1, y1 = brute
    cote = max(x1 - x0 + 1, y1 - y0 + 1)
    if cote <= 0:  # pragma: no cover — une boîte a toujours un côté
        return 0.0
    dedans = cote_du_sujet(recette.grille.cible, recette.grille.occupation)
    facteur = dedans / cote
    if facteur <= 0:  # pragma: no cover — `cote_du_sujet` a un plancher à 1
        return 0.0
    return recette.bords.aire_min / (facteur * facteur)


def _boite_nettoyee(
    alpha: np.ndarray, seuil: float
) -> tuple[tuple[int, int, int, int] | None, int]:
    """La boîte des taches assez grandes pour être le sujet, et combien on a écarté.

    **On ne réécrit pas l'image** : le nettoyage des taches d'une recette a son
    rang et son effet propres, et le doubler ici changerait les pixels d'une
    bande sans qu'aucune recette le dise. Ce qu'on écarte n'est écarté **que de
    la mesure** — c'est-à-dire du seul endroit où une ombre isolée sous les pieds
    faisait du mal.
    """
    gardees: list[tuple[int, int, int, int]] = []
    ecartees = 0
    for tache, aire in composantes(alpha > 0):
        if aire < seuil:
            ecartees += 1
            continue
        boite = boite_opaque(tache)
        if boite:
            gardees.append(boite)
    return (_union(gardees) if gardees else None), ecartees
