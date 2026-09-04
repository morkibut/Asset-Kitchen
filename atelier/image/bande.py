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

import io
from dataclasses import dataclass, replace
from typing import Any, Iterable, Sequence

import numpy as np

from atelier.domaine.recette import CENTRE, RECADRAGE, Recette, cote_du_sujet
from atelier.image.traitement import (
    Rendu,
    avant_la_grille,
    boite_opaque,
    composantes,
    detourer,
    finir,
    queue,
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
    if fenetre is None or not a_recadre(recette):
        cadre = fenetre.en_tuple() if fenetre else None
        return [finir(image, recette, cadre) for image in preparees]
    cadre = (0, 0, fenetre.largeur - 1, fenetre.hauteur - 1)
    suite = _sans_recadrer(recette)
    return [
        finir(poser_dans(image, fenetre, recette), suite, cadre)
        for image in preparees
    ]


def a_recadre(recette: Recette) -> bool:
    """`preparer` a-t-il recadré chaque image sur sa propre silhouette ?

    **C'est ce qui décide si la fenêtre est un rectangle ou une taille.** Sans
    recadrage, les images restent dans un système de coordonnées commun : la
    fenêtre y désigne un vrai endroit, et on y découpe. Avec, chaque image a le
    sien : la fenêtre n'est plus qu'un format, et il faut **poser** dedans au
    lieu d'y découper.

    La condition est celle d'`avant_la_grille`, recopiée à l'identique et pas
    approchée : deux formulations de « a-t-on recadré » finiraient par ne plus
    répondre pareil, et l'écart se verrait sous la forme d'un personnage qui
    plane.
    """
    return recette.recadrage is not None and not recette.dort(RECADRAGE)


def _sans_recadrer(recette: Recette) -> Recette:
    """La même recette, **sa place de recadrage déjà consommée**.

    `preparer` a déjà recadré ; la queue de la chaîne le referait, et ce second
    recadrage **annulerait la pose dans la fenêtre** — il rognerait le vide que
    `poser_dans` vient d'ajouter pour mettre le sujet à sa place. C'était le
    défaut de l'accroupi qui plane, et il tenait tout entier dans une étape
    jouée deux fois.

    Rien d'autre ne change : la place est vidée parce qu'elle a servi, pas
    parce qu'on renonce à elle.
    """
    return replace(recette, recadrage=None)


def poser_dans(
    preparee: np.ndarray, fenetre: Fenetre, recette: Recette
) -> np.ndarray:
    """L'image posée **dans** la fenêtre commune, au lieu d'y être découpée.

    > ### ⚠️ Un personnage accroupi flottait, et l'écart d'échelle qu'`A2` avait
    > ### réparé cachait celui-là (corrigé en `A10`, 4 septembre 2026)
    >
    > `sur_grille` reçoit la fenêtre et **découpe l'image dessus**, depuis son
    > coin haut-gauche. Or chaque image du clip est déjà recadrée sur sa propre
    > silhouette : une image plus courte que la fenêtre se voyait donc complétée
    > de vide **en bas**, et l'ancrage posait ce vide-là sur le sol. Mesuré sur
    > deux images d'un même sujet, un debout et un accroupi, dans une case de
    > 32 : l'accroupi occupait les rangées 0 à 18 et **treize rangées vides le
    > séparaient du sol**. Il ne changeait pas de taille — `A2` tenait — il
    > planait.
    >
    > La cause est en amont, et elle n'est pas réparable au découpage : le
    > recadrage de chaque image détruit, avant la fenêtre, la seule chose qui
    > dirait où chaque sujet se tient par rapport aux autres. Ce qui reste
    > possible, et qui est fait ici, est de **poser** chaque image dans la
    > fenêtre selon la règle du produit — le bas sur le bas, le milieu sur le
    > milieu — plutôt que de l'y découper depuis un coin.

    Horizontalement, le sujet est **centré**, et c'est la seule réponse tenable :
    la position relative de deux images est déjà perdue, donc un alignement à
    gauche ferait sautiller la bande au gré des largeurs. `sur_grille` centre
    déjà la boîte dans sa case quand il n'y a pas de fenêtre — c'est la même
    règle, appliquée un cran plus tôt.
    """
    hauteur, largeur = preparee.shape[:2]
    cadre = np.zeros((fenetre.hauteur, fenetre.largeur, 4), dtype=preparee.dtype)
    x = max(0, (fenetre.largeur - largeur) // 2)
    y = (
        max(0, (fenetre.hauteur - hauteur) // 2)
        if recette.grille is not None and recette.grille.ancrage == CENTRE
        else max(0, fenetre.hauteur - hauteur)
    )
    # Une image plus grande que la fenêtre ne peut pas arriver — la fenêtre est
    # l'union des boîtes —, mais un cadre posé à la main le peut : on garde
    # alors ce qui tient, plutôt que de lever sur un rectangle que l'auteur a
    # dessiné lui-même.
    prise = preparee[: fenetre.hauteur - y, : fenetre.largeur - x]
    cadre[y : y + prise.shape[0], x : x + prise.shape[1]] = prise
    return cadre


@dataclass(frozen=True, slots=True)
class Planche:
    """Les images d'une bande **côte à côte, en une seule image**.

    C'est la forme qu'un moteur de jeu lit, et c'est aussi celle que l'écran de
    montage anime : une image qu'on décale plutôt qu'une douzaine qu'on charge.
    **Un seul objet pour les deux usages**, et c'est ce qui rend vrai sans
    discipline le critère d'`A10` *ce qui sort est exactement ce que l'aperçu
    montrait* — il n'y a rien d'autre à faire sortir.
    """

    octets: bytes
    case_largeur: int
    case_hauteur: int
    compte: int

    @property
    def largeur(self) -> int:
        return self.case_largeur * self.compte

    def en_json(self) -> dict[str, Any]:
        return {
            "case_largeur": self.case_largeur,
            "case_hauteur": self.case_hauteur,
            "compte": self.compte,
            "largeur": self.largeur,
            "hauteur": self.case_hauteur,
        }


def assembler(
    preparees: Sequence[np.ndarray], recette: Recette, fenetre: Fenetre | None
) -> Planche:
    """La planche de sprites de cette bande, dans l'ordre donné (A10).

    **Elle passe par la même chaîne que `monter`**, et il ne pouvait pas en
    aller autrement : deux chemins vers les mêmes pixels finiraient par ne plus
    les rendre identiques, et c'est l'auteur qui découvrirait l'écart entre son
    aperçu et son export.

    **Les cases sont toutes de la taille de la plus grande**, et le sujet est
    posé au centre en bas de la sienne. Avec une fenêtre commune et un
    détourage, elles sortent déjà toutes identiques et rien n'est ajouté ; sans
    détourage — un décor, une image entrée telle quelle —, elles peuvent
    différer, et une planche à cases inégales n'est lisible par aucun moteur.
    Le bas plutôt que le milieu, parce que c'est l'ancrage du produit : un
    personnage se pose sur ses pieds.
    """
    pose = fenetre is not None and a_recadre(recette)
    cadre = (
        (0, 0, fenetre.largeur - 1, fenetre.hauteur - 1)
        if pose
        else (fenetre.en_tuple() if fenetre else None)
    )
    suite = _sans_recadrer(recette) if pose else recette
    rendus = [
        queue(poser_dans(image, fenetre, recette) if pose else image, suite, cadre)
        for image in preparees
    ]
    if not rendus:
        return Planche(octets=b"", case_largeur=0, case_hauteur=0, compte=0)

    largeur = max(r.shape[1] for r in rendus)
    hauteur = max(r.shape[0] for r in rendus)
    planche = np.zeros((hauteur, largeur * len(rendus), 4), dtype=np.uint8)
    for rang, image in enumerate(rendus):
        h, l = image.shape[:2]
        x = rang * largeur + (largeur - l) // 2
        y = hauteur - h
        planche[y : y + h, x : x + l] = image

    return Planche(
        octets=en_png(planche),
        case_largeur=largeur,
        case_hauteur=hauteur,
        compte=len(rendus),
    )


def en_png(image: np.ndarray) -> bytes:
    """Une image en octets PNG, **et le seul endroit du module qui encode**.

    Partagé par la planche et par le sujet seul que l'écran de montage montre
    sous le cadre. La raison est celle qui vaut partout ici : deux chemins vers
    les mêmes pixels finissent par ne plus les rendre identiques, et c'est
    l'auteur qui découvre l'écart.
    """
    from PIL import Image

    tampon = io.BytesIO()
    Image.fromarray(image, mode="RGBA").save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()


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
