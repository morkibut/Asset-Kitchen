# -*- coding: utf-8 -*-
"""La bande — **plusieurs images traitées ensemble, sur une fenêtre commune**.

Arrivée en A2 (V3). C'est le **premier des trois** modules du traitement qui
regardent **plusieurs images à la fois**, et c'est ce qui le rend nécessaire :
tout le reste de `atelier/image/` travaille sur une image et n'a aucune raison
de savoir qu'il en existe d'autres. Les deux autres sont venus après, et ils
regardent autre chose — `rythme.py` ce que le clip *fait dans le temps* (A10),
`stabilite.py` ce qui *bouge alors que le sujet n'a pas bougé* (A5).

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

from atelier.domaine.recette import (
    BAS,
    QUANTIFICATION,
    RECADRAGE,
    Recette,
    cote_du_sujet,
    parts_de,
)
from atelier.image.stabilite import Stabilite, mesurer as mesurer_la_stabilite
from atelier.image.traitement import (
    Rendu,
    avant_la_grille,
    boite_opaque,
    composantes,
    detourer,
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

    def avec(self, autre: "Fenetre | None") -> "Fenetre":
        """La plus petite fenêtre qui contient les deux.

        Elle sert à une seule chose, et `A7` l'a rendue nécessaire : une bande
        qui prend ses images dans deux clips n'a de fenêtre **dans ni l'un ni
        l'autre**. Prendre celle du clip principal recadrerait les images
        empruntées sur un rectangle mesuré sans elles — et ce qui dépasse ne se
        verrait pas ici, mais dans le jeu.

        Le compte d'images s'additionne ; les taches écartées aussi, parce que
        les deux mesures ont chacune fait son ménage.
        """
        if autre is None:
            return self
        return Fenetre(
            gauche=min(self.gauche, autre.gauche),
            sommet=min(self.sommet, autre.sommet),
            droite=max(self.droite, autre.droite),
            bas=max(self.bas, autre.bas),
            images=self.images + autre.images,
            taches_ecartees=self.taches_ecartees + autre.taches_ecartees,
        )

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
    preparees: Iterable[np.ndarray],
    recette: Recette,
    fenetre: Fenetre | None,
    *,
    recettes: Sequence[Recette] | None = None,
    individuelles: Sequence[bool] | None = None,
) -> list[Rendu]:
    """Les images de la bande, passées par la chaîne du jeu **sur la même fenêtre**.

    Ce qui sort est exactement ce que l'aperçu montre et ce que l'export écrira :
    une seule chaîne, un seul rendu. Deux façons de monter une bande finiraient
    par ne plus donner les mêmes pixels, et c'est l'auteur qui découvrirait
    l'écart à l'export.

    ⚠️ **Elle et `assembler` partagent maintenant le même corps** (`A5`), et
    c'était devenu nécessaire : la stabilité d'une bande se décide *pour la
    bande*, et deux endroits qui la décideraient auraient fini par la décider
    autrement. Elles ne se distinguent plus que par ce qu'elles rendent — des
    fichiers d'un côté, une planche de l'autre.

    `recettes` porte la finition de **chaque** image quand des frames ont la
    leur (V3.03.1) ; `None` veut dire la même recette pour toutes, et c'est ce
    que le montage passe toujours. `individuelles` dit, au même rang, lesquelles
    ont la leur — c'est ce qui décide de la palette de la bande.
    """
    return [
        Rendu(octets=en_png(image), largeur=image.shape[1], hauteur=image.shape[0])
        for image in _rendre(
            list(preparees), recette, fenetre, recettes=recettes, individuelles=individuelles
        )
    ]


def _rendre(
    preparees: Sequence[np.ndarray],
    recette: Recette,
    fenetre: Fenetre | None,
    *,
    stabiliser: bool = True,
    poussees: Sequence[tuple[int, int]] | None = None,
    recettes: Sequence[Recette] | None = None,
    individuelles: Sequence[bool] | None = None,
) -> list[np.ndarray]:
    """La chaîne du jeu sur toutes les images d'une bande — **et une seule écriture**.

    Trois décisions y vivent, et les trois sont *de la bande* et non *de l'image* :
    d'où l'on découpe, avec quelle recette on finit, et **quelle palette**.

    `poussees` porte la correction d'`A7`, une par image, **appliquée en tout
    dernier** : après la réduction, donc en pixels du sprite. C'est aussi après
    la palette, et il le faut — décaler une image ne change aucune de ses
    couleurs, donc la palette de la bande reste celle qu'on a calculée.

    `recettes` porte la recette de **chaque** image quand des frames ont la
    leur (V3.03.1) ; `None` veut dire la même pour toutes. ⚠️ **Deux décisions
    restent de la bande quoi qu'il arrive** : la fenêtre commune — mesurée une
    fois, pour toutes —, et la palette, qui se calcule sur **les frames de la
    bande** — celles qui n'ont pas de recette à elles. Une frame individuelle
    porte la sienne : si sa réduction n'a pas de palette, elle se calcule sur
    elle seule, comme une image seule. C'est ce qui fait que corriger une frame
    ne refait pas les autres : la palette de la bande ne bouge pas quand une
    frame change, elle ne bouge que quand la bande change.

    `stabiliser` à `False` rejoue la chaîne **d'avant `A5`** : silhouette tirée
    au sort image par image, palette recalculée à chaque image. ⚠️ Elle n'a
    qu'un appelant, et c'est le banc — mesurer ce que la tranche a gagné demande
    un *avant*, et un banc qui recopierait l'ancienne chaîne mesurerait sa propre
    copie plutôt que le produit.
    """
    if recettes is None:
        recettes = [recette] * len(preparees)
    if individuelles is None:
        individuelles = [False] * len(preparees)
    pose = fenetre is not None and a_recadre(recette)
    cadre = (
        (0, 0, fenetre.largeur - 1, fenetre.hauteur - 1)
        if pose and fenetre is not None
        else (fenetre.en_tuple() if fenetre else None)
    )
    entrees = [
        poser_dans(image, fenetre, recette_la)
        if pose and fenetre is not None
        else image
        for image, recette_la in zip(preparees, recettes)
    ]
    # **Chaque image a consommé *son* recadrage à la préparation** : la queue
    # ne rejoue la place de recadrage d'aucune, la sienne comprise — c'est la
    # règle de `_sans_recadrer`, passée au pluriel.
    suites = [_sans_recadrer(lune) if a_recadre(lune) else lune for lune in recettes]
    if stabiliser:
        suites = _avec_la_palette_de_la_bande(
            entrees, suites, individuelles, recette, cadre
        )
    rendues = [
        queue(image, suite, cadre, silhouette_stable=None if stabiliser else False)
        for image, suite in zip(entrees, suites)
    ]
    if not poussees:
        return rendues
    # Une poussée manquante vaut zéro : la liste des corrections peut être plus
    # courte que la bande sans que rien ne casse — c'est le cas d'une bande à
    # laquelle on vient d'ajouter une image.
    return [
        pousser(image, *(poussees[rang] if rang < len(poussees) else (0, 0)))
        for rang, image in enumerate(rendues)
    ]


def pousser(image: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """L'image rendue, **décalée dans sa propre case** de `dx` et `dy` (A7).

    C'est le geste de la correction au pixel, et il se pose **après la
    réduction** — donc un appui déplace le sujet d'**un pixel du sprite**, ce
    qui est ce que l'auteur voit et ce qu'il vise. L'écrire avant la grille
    l'aurait exprimé en pixels de la vidéo : le même réglage aurait déplacé de
    trois blocs sur un clip et d'un seul sur un autre, sans que rien ne le dise.

    ⚠️ **Il borne au lieu de rogner**, et c'est la règle déjà écrite pour le
    décalage de `sur_grille` : *aux bords, les boutons cessent d'avoir un effet
    — ce qui se voit, et c'est mieux qu'une image rognée.* Le sujet peut donc
    aller jusqu'à toucher le bord de sa case, jamais au-delà. Une correction qui
    mangerait un bras serait invisible sur l'image qu'on corrige et se
    découvrirait dans le jeu.

    Une image dont le détourage n'a rien laissé n'a pas de sujet à pousser : on
    la rend telle quelle plutôt que de deviner.
    """
    if not dx and not dy:
        return image
    boite = boite_opaque(image[:, :, 3] > 0)
    if boite is None:
        return image
    gauche, sommet, droite, bas = boite
    hauteur, largeur = image.shape[:2]
    dx = max(-gauche, min(largeur - 1 - droite, int(dx)))
    dy = max(-sommet, min(hauteur - 1 - bas, int(dy)))
    if not dx and not dy:
        return image

    pousse = np.zeros_like(image)
    depart_y, depart_x = max(0, dy), max(0, dx)
    prise_y, prise_x = max(0, -dy), max(0, -dx)
    haut = hauteur - abs(dy)
    large = largeur - abs(dx)
    pousse[depart_y : depart_y + haut, depart_x : depart_x + large] = image[
        prise_y : prise_y + haut, prise_x : prise_x + large
    ]
    return pousse


def _avec_la_palette_de_la_bande(
    entrees: Sequence[np.ndarray],
    suites: Sequence[Recette],
    individuelles: Sequence[bool],
    bande_recette: Recette,
    cadre: tuple[int, int, int, int] | None,
) -> list[Recette]:
    """La même recette, **sa palette décidée une fois pour toute la bande** (A5).

    ⚠️ **Sans ça, la palette se recalcule à chaque image.** La coupe médiane est
    déterministe — deux fois la même image donnent deux fois la même palette —,
    mais deux images *différentes* d'un même mouvement n'ont pas le même
    histogramme de couleurs, donc pas la même palette : un aplat de peau passe
    d'un brun à son voisin d'une image à l'autre, et le personnage scintille sans
    avoir bougé. Ça ne se voit pas sur une image, et ça ne se voit que sur une
    animation qui tourne.

    **Rien ne se passe dans trois cas, et le premier est le plus fréquent :**

    1. le jeu déclare déjà sa palette — elle est alors imposée à tout ce qui
       entre, la bande comprise, et le défaut n'existe pas ;
    2. la recette ne réduit pas les couleurs, ou sa place dort ;
    3. il n'y a qu'une image, qui ne peut scintiller contre personne.

    **Depuis V3.03.1, la palette se calcule sur les frames *de la bande* — celles
    qui n'ont pas de recette individuelle (`individuelles`).** C'est la
    contrepartie exacte de *corriger une frame sans refaire les autres* : la
    palette est une décision de la bande, et elle ne bouge que quand la bande
    change. La première frame qui reçoit sa recette à elle quitte donc
    la palette — la bande change de membres, et sa palette change une fois,
    comme elle changerait si l'on ajoutait une image. Ensuite, retoucher *cette*
    frame ne rebouge plus la palette : elle n'y est plus.

    **La palette se prend sur les images réduites, pas sur les originales**, et
    c'est le seul ordre juste : la réduction fond des couleurs voisines, et une
    palette choisie avant elle dépenserait ses places sur des nuances qui
    n'existeront plus. C'est aussi ce qui coûte — la géométrie est jouée deux
    fois — et c'est le prix assumé : une réduction est un redimensionnement,
    quand le détourage qui la précède est déjà payé et gardé.

    **Et seulement sur les pixels qu'on voit.** Sous un pixel transparent il
    reste une couleur (`AGENTS.md`, point 5) ; lui donner une place de la palette
    dépenserait une couleur du jeu pour quelque chose que personne ne regarde.
    """
    quantification = bande_recette.quantification
    if (
        quantification is None
        or quantification.palette
        or bande_recette.dort(QUANTIFICATION)
        or len(entrees) < 2
    ):
        return list(suites)

    # Les frames de la bande — celles qui n'ont pas de recette individuelle.
    # Les autres décident de leur palette elles-mêmes, comme une image seule.
    du_pool = [rang for rang, la_sienne in enumerate(individuelles) if not la_sienne]
    if len(du_pool) < 2:
        return list(suites)

    # La géométrie seule : ce que la quantification verra, et rien de ce qui
    # vient après elle. Écrit en retirant des places plutôt qu'en rejouant la
    # chaîne à la main — `queue` reste le seul endroit qui connaisse l'ordre.
    geometrie = replace(
        bande_recette, quantification=None, bords=None, contours=None, main=None
    )
    reduites = [queue(entrees[rang], geometrie, cadre) for rang in du_pool]
    palette = _palette_mediane(reduites, quantification.couleurs)
    if not palette:
        return list(suites)
    rendues = list(suites)
    for rang in du_pool:
        lune = rendues[rang]
        rendues[rang] = replace(
            lune, quantification=replace(lune.quantification, palette=palette)
        )
    return rendues


def _palette_mediane(
    images: Sequence[np.ndarray], couleurs: int
) -> tuple[str, ...]:
    """La coupe médiane, jouée **une fois sur toutes les images ensemble**.

    Le même algorithme que celui d'une image seule (`quantifier`), sur un autre
    corpus : les pixels visibles de toutes les images, mis bout à bout. Rien
    n'est inventé — c'est très exactement *la palette que la bande aurait eue si
    elle avait été une seule image*.
    """
    from PIL import Image

    visibles = [image[:, :, :3][image[:, :, 3] > 0] for image in images]
    pixels = np.concatenate([v for v in visibles if v.size]) if visibles else None
    if pixels is None or pixels.size == 0:
        return ()

    bande = Image.fromarray(
        np.ascontiguousarray(pixels.reshape(1, -1, 3)), mode="RGB"
    )
    indexee = bande.quantize(
        colors=max(2, min(256, couleurs)), method=Image.Quantize.MEDIANCUT
    )
    choisies = np.unique(
        np.asarray(indexee.convert("RGB")).reshape(-1, 3), axis=0
    )
    return tuple(f"#{r:02x}{g:02x}{b:02x}" for r, g, b in choisies)


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
    # **Les neuf ancrages, lus dans la table du domaine** (A7) — la même que
    # `sur_grille`, et c'est voulu : deux lectures de « bas » finiraient par ne
    # plus poser au même pixel, et l'écart se verrait sous la forme d'une bande
    # qui saute d'un pixel à l'export.
    part_verticale, part_horizontale = parts_de(
        recette.grille.ancrage if recette.grille is not None else BAS
    )
    x = max(0, round((fenetre.largeur - largeur) * part_horizontale))
    y = max(0, round((fenetre.hauteur - hauteur) * part_verticale))
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
    # **Ce qui bouge entre les images** (A5). Mesuré ici parce que c'est ici
    # qu'on tient les images rendues, toutes ensemble et à la même taille —
    # les redemander ailleurs ferait rejouer la chaîne pour rien.
    stabilite: Stabilite | None = None

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
            "stabilite": self.stabilite.en_json() if self.stabilite else None,
        }


def assembler(
    preparees: Sequence[np.ndarray],
    recette: Recette,
    fenetre: Fenetre | None,
    *,
    stabiliser: bool = True,
    poussees: Sequence[tuple[int, int]] | None = None,
    recettes: Sequence[Recette] | None = None,
    individuelles: Sequence[bool] | None = None,
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

    **Elle partage son corps avec `monter` depuis `A5`** : ce qui se décide pour
    la bande — la fenêtre, la recette de finition, la palette — se décide à un
    seul endroit, et les deux fonctions ne se distinguent plus que par ce
    qu'elles rendent.

    `recettes` porte la finition de **chaque** image quand des frames ont la
    leur (V3.03.1) ; `None` veut dire la même pour toutes — et le montage, qui
    ne connaît pas encore les recettes individuelles, ne passe jamais rien.

    `stabiliser` à `False` rejoue la chaîne d'avant `A5` — **le banc, et lui
    seul** : il lui faut un *avant* à mesurer.
    """
    rendus = _rendre(
        preparees,
        recette,
        fenetre,
        stabiliser=stabiliser,
        poussees=poussees,
        recettes=recettes,
        individuelles=individuelles,
    )
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
        # **Sur les images, pas sur la planche** (A5) : la mesure compare deux
        # images voisines, et la planche les a déjà mises bout à bout — la
        # frontière entre deux cases y passerait pour un bord de sujet.
        stabilite=mesurer_la_stabilite(rendus),
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


def en_image_animee(
    planche: bytes,
    case_largeur: int,
    case_hauteur: int,
    ordre: Sequence[int],
    duree_ms: int,
) -> bytes:
    """La bande en une image qui tourne toute seule, **découpée dans sa planche** (A4).

    ⚠️ **Elle est faite de la planche, pas des mêmes images que la planche**, et
    c'est ce qui rend vrai le sixième critère de la tranche — *ce qui sort est
    exactement ce que l'aperçu montrait* — sans avoir à y veiller. Les deux
    fichiers de l'archive ne peuvent pas diverger : le second est **découpé
    dans** le premier. Refaire les images une seconde fois pour l'animation
    aurait rouvert la porte que `assembler` avait fermée.

    **Le format est un PNG animé**, et le choix se tient en deux phrases. C'est
    le seul format d'image animée qui garde les couleurs et la transparence
    telles quelles : un GIF ne connaît que deux cent cinquante-six couleurs et
    une transparence tout-ou-rien, et il changerait donc les pixels qu'on vient
    de promettre identiques. Et un lecteur qui ne saurait pas l'animer affiche
    la première image au lieu d'échouer — un PNG animé **est** un PNG.

    `ordre` est la suite des cases jouées, celle d'`aseprite.ordre_des_images` :
    en aller-retour, elle redescend sans rejouer les bouts, exactement comme
    l'écran. `duree_ms` est le temps d'une image, celui-là même qui part dans le
    descriptif — un seul nombre pour les deux, arrondi une seule fois.

    *Deux cases voisines identiques sont fondues en une seule, de durée double :
    c'est l'encodeur qui le fait, la durée totale ne bouge pas, et la bande joue
    la même chose.*
    """
    from PIL import Image

    if not ordre or case_largeur <= 0 or case_hauteur <= 0:
        return b""

    with Image.open(io.BytesIO(planche)) as ouverte:
        entiere = ouverte.convert("RGBA")
        cases = [
            entiere.crop(
                (
                    rang * case_largeur,
                    0,
                    (rang + 1) * case_largeur,
                    case_hauteur,
                )
            )
            for rang in ordre
        ]

    tampon = io.BytesIO()
    cases[0].save(
        tampon,
        format="PNG",
        save_all=True,
        append_images=cases[1:],
        duration=duree_ms,
        # Sans fin. Une bande tourne ; combien de tours elle fait appartient au
        # jeu qui la joue, et l'écrire ici inventerait une décision.
        loop=0,
        # **Effacer avant de poser, et poser sans mélanger.** Une image de sprite
        # est trouée : sans ces deux réglages, chaque case laisserait voir la
        # précédente au travers de ses trous, et le personnage traînerait
        # derrière lui toutes ses poses passées.
        disposal=1,
        blend=0,
    )
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
