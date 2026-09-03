# -*- coding: utf-8 -*-
"""La superposition — deux images, et une troisième qui en sort.

**Ce n'est pas une place de la recette, et c'est le critère qui l'a rangée
ici** : une recette décrit comment *une* image se rend ; celle-ci a besoin d'une
seconde image pour rendre quoi que ce soit. La place `Difference` portait le
champ `base` — l'identifiant d'un autre asset —, et c'est ce qui la rendait
grisée sur presque toute la bibliothèque : il n'y a pas de différence à régler
tant qu'on n'a pas dit *par rapport à quoi*
(`docs/ARCHITECTURE.md` §4, règle 4 ; `docs/v21-arbitrages.md` A-18).

Elle rejoint donc le découpage, à droite du trait de la barre des tables. À
gauche, les sept places qui règlent l'image courante ; à droite, les deux gestes
qui en fabriquent d'autres.

**Ce qu'elle écrit est un asset entier**, et c'est le seul geste du produit dont
le résultat a **deux ascendants** : ses pixels et son parent viennent du dessus,
sa référence est le dessous. La référence a servi à décider ce qu'on garde ;
elle n'a donné aucun pixel, donc elle n'est pas le parent.

**Elle est gardée pour que la superposition se rejoue.** Changer le seuil, le
rectangle ou le calage ne redemande aucune image au fournisseur : les deux
images sont sur le disque, et la mesure juste coûte des millisecondes. C'est la
promesse de R5, étendue à n'importe quelles deux images.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from atelier.domaine.recette import SEUIL_COULEUR, Trait, traits_depuis_json

# Ce qui sort d'une superposition, et il y en a deux. **Elles se cochent au lieu
# de s'exclure** : on veut souvent le calque pour le réutiliser *et* l'aplat
# pour l'avoir tout de suite. L'asset produit, lui, en est toujours **une** —
# c'est ce qu'il est, pas un réglage.
CALQUE = "calque"
APLAT = "aplat"
SORTIES = (CALQUE, APLAT)

# **Le seul réglage de l'outil qui abîme l'image.** Rééchantillonner du pixel art
# à un facteur qui n'est pas simple détruit la grille ; l'écran le marque, il ne
# le refuse pas. Les bornes viennent de ce qu'un recalage peut légitimement
# trouver — le modèle qui dézoome le plus, mesuré le 28 août 2026, descend à
# 0,62, et son rattrapage est à 1,61.
ECHELLE_MIN, ECHELLE_MAX = 0.25, 4.0


@dataclass(frozen=True, slots=True)
class Superposition:
    """Comment deux images ont été posées l'une sur l'autre.

    `dessus` **se déplace**, `dessous` est le sol : on ne le manipule jamais.
    Intervertir les deux change le résultat, puisque le calque est fait de ce
    que le *dessus* ajoute — poser un corps nu sur un corps casqué donnerait le
    crâne nu au lieu du casque.

    `echelle`, `dx` et `dy` posent le dessus dans le cadre du dessous. Ils
    arrivent d'une **proposition** que l'auteur reprend : le recalage remplit
    les trois champs et s'arrête là ; il ne verrouille rien, ne refuse rien, et
    n'empêche aucun ajustement. Avant, il n'y avait aucun recours — le calque
    était perdu et il fallait relancer une génération.

    `rectangle` sert deux fois, et c'est ce qui en fait une seule notion : il
    isole la pièce pour qu'on voie le corps dessous pendant qu'on cale, et **ce
    qu'il masque à l'écran, il le masque aussi à la sortie**. Exprimé en pixels
    de l'image rendue du dessous, inclusif aux deux bouts — la convention de
    rectangle du produit depuis T5.

    `dessus_arrivee` dit de lire le dessus **tel qu'il est arrivé du modèle**, et
    non tel qu'il est rangé. Les deux diffèrent sur un seul genre d'image, et
    c'est justement celui qu'on vient réparer ici : le brut d'un calque est la
    case *déjà mise à l'échelle et calée sur son corps* — refaire le calage à la
    main en partant de là reviendrait à repartir du résultat qu'on veut défaire.
    Sur toute autre image, les deux sont le même fichier et le drapeau ne change
    rien (G16).

    `main` porte les passages posés **sur le dessus, avant la comparaison**, et
    la règle qui les range ici tient en une phrase : *si le réglage est vrai de
    l'image toute seule, il va dans la recette de l'image ; s'il n'est vrai que
    de cette superposition, il va dans la superposition*. Effacer trois pixels
    pour qu'ils ne partent pas dans ce calque-ci n'est vrai que de ce calque-ci,
    et **l'image du dessus n'est jamais modifiée**.
    """

    dessus: str = ""
    dessous: str = ""
    echelle: float = 1.0
    dx: int = 0
    dy: int = 0
    rectangle: tuple[int, int, int, int] | None = None
    seuil: int = SEUIL_COULEUR
    main: tuple[Trait, ...] = ()
    sortie: str = CALQUE
    dessus_arrivee: bool = False

    @property
    def calee(self) -> bool:
        """Le calage a-t-il bougé ? Dérivé, jamais rangé — c'est ce qui permet
        au pied de l'outil de dire *recalé + ajusté* sans tenir de drapeau."""
        return self.echelle != 1.0 or self.dx != 0 or self.dy != 0

    def en_json(self) -> dict[str, Any]:
        return {
            "dessus": self.dessus,
            "dessous": self.dessous,
            "echelle": self.echelle,
            "dx": self.dx,
            "dy": self.dy,
            "rectangle": list(self.rectangle) if self.rectangle else None,
            "seuil": self.seuil,
            "main": [t.en_json() for t in self.main],
            "sortie": self.sortie,
            "dessus_arrivee": self.dessus_arrivee,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Superposition":
        rectangle = d.get("rectangle")
        return Superposition(
            dessus=str(d.get("dessus") or ""),
            dessous=str(d.get("dessous") or ""),
            echelle=float(d.get("echelle", 1.0)),
            dx=int(d.get("dx", 0)),
            dy=int(d.get("dy", 0)),
            rectangle=(tuple(int(v) for v in rectangle) if rectangle else None),
            seuil=int(d.get("seuil", SEUIL_COULEUR)),
            main=traits_depuis_json(d.get("main")),
            sortie=str(d.get("sortie") or CALQUE),
            dessus_arrivee=bool(d.get("dessus_arrivee", False)),
        )


@dataclass(frozen=True, slots=True)
class ReglagesGardes:
    """Les réglages d'une superposition, attachés à **l'image de référence**.

    « Un jeu de réglages qui marche pour un casque marchera à 90 % pour le
    suivant : même corps, même cadrage, même calage à quelques pixels près. »
    Ils reviennent préremplis la prochaine fois qu'on superpose quelque chose
    sur cette image-là, avec leur provenance écrite — et se défont d'un clic,
    comme tout ce que le produit devine.

    **Ce qui n'est pas gardé : les passages de la main.** Ils sont dessinés sur
    une image précise et n'ont aucun sens sur une autre pièce ; les rejouer
    ailleurs poserait des trous là où personne n'en a voulu.
    """

    depuis: str = ""  # le label de la pièce d'où ils viennent
    le: float = 0.0  # quand ils ont été gardés
    echelle: float = 1.0
    dx: int = 0
    dy: int = 0
    rectangle: tuple[int, int, int, int] | None = None
    seuil: int = SEUIL_COULEUR

    def en_json(self) -> dict[str, Any]:
        return {
            "depuis": self.depuis,
            "le": self.le,
            "echelle": self.echelle,
            "dx": self.dx,
            "dy": self.dy,
            "rectangle": list(self.rectangle) if self.rectangle else None,
            "seuil": self.seuil,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "ReglagesGardes":
        rectangle = d.get("rectangle")
        return ReglagesGardes(
            depuis=str(d.get("depuis") or ""),
            le=float(d.get("le", 0.0)),
            echelle=float(d.get("echelle", 1.0)),
            dx=int(d.get("dx", 0)),
            dy=int(d.get("dy", 0)),
            rectangle=(tuple(int(v) for v in rectangle) if rectangle else None),
            seuil=int(d.get("seuil", SEUIL_COULEUR)),
        )

    def sur(self, dessus: str, dessous: str) -> Superposition:
        """Une superposition préremplie de ce qui est gardé — sans la main."""
        return Superposition(
            dessus=dessus,
            dessous=dessous,
            echelle=self.echelle,
            dx=self.dx,
            dy=self.dy,
            rectangle=self.rectangle,
            seuil=self.seuil,
        )
