# -*- coding: utf-8 -*-
"""Ce qu'une table a besoin de savoir de l'image, et que seul le serveur peut dire.

**Cinq mesures, et aucune n'est un réglage.** Elles décrivent ce que l'image
*contient* — les taches que le nettoyage des bords va effacer, les poches de fond
que le sujet enferme et qu'aucune tolérance n'atteint, les trous de la silhouette
que le contour longera ou pas, les crans d'occupation où la remise sur grille
change vraiment quelque chose. Les quatre répondent à la même question posée
quatre fois : *qu'est-ce que ce curseur va faire, avant que je le bouge ?*

**La cinquième pose une autre question, celle de RV25** : *qu'est-ce que le
détourage n'a pas pu atteindre, une fois tout fait ?* `zones_de_fond_enferme`
compte, sur le **rendu final**, les poches à la couleur que le détourage
visait pour le fond — pas sur l'image avant les bords, comme les quatre
premières, parce qu'un fond enfermé par le modèle (les vitres d'un bus
détouré par un modèle de silhouette) reste opaque quel que soit le moteur, et
c'est ce que l'auteur voit à l'écran qu'il faut décrire.

**Les deux du milieu sont exactement inverses, et les confondre coûte cher.**
Une poche de fond enfermée est **opaque** — c'est ce que le remplissage depuis
le bord n'a pas pu atteindre ; un trou de silhouette est **transparent** — c'est
ce qu'il a atteint, ou ce qui est arrivé transparent. Une seule fonction a longtemps
servi les deux lectures sous le nom de la première, et elle rendait la seconde :
mesuré le 31 août 2026 sur les soixante images du dépôt, le panneau du détourage
annonçait **zéro poche** là où il y en avait quarante-trois en médiane.

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

from atelier.domaine.recette import Grille, cote_du_sujet, occupation_max
from atelier.image.traitement import composantes


@dataclass(frozen=True, slots=True)
class Tache:
    """Une tache opaque, avec de quoi la désigner et la juger.

    `boite` est en pixels de l'image **détourée**, coin haut-gauche inclus et
    coin bas-droit inclus — la convention de rectangle du produit, celle du
    découpage. `couleur` est la moyenne de ses pixels : c'est ce qui permet à la
    pipette de retirer *toutes les taches de sa couleur* sans que l'écran ait à
    redescendre les pixels.

    `point` est **un pixel qui appartient vraiment à la zone**, et il existe
    pour une raison qu'on ne devine pas : le centre de la boîte n'est pas dans
    la zone dès qu'elle est creuse ou courbe — un croissant de fond entre un
    bras et un torse a son centre géométrique *dans le bras*. Une proposition
    qui viserait le centre de la boîte retirerait donc le sujet. Celui-ci est le
    premier pixel de la zone dans l'ordre de balayage : quelconque, mais dedans.
    """

    aire: int
    boite: tuple[int, int, int, int]
    couleur: str
    point: tuple[int, int] = (0, 0)

    def en_json(self) -> dict[str, Any]:
        return {
            "aire": self.aire,
            "boite": list(self.boite),
            "couleur": self.couleur,
            "point": list(self.point),
        }


def _boite(masque: np.ndarray) -> tuple[int, int, int, int]:
    lignes = np.flatnonzero(masque.any(axis=1))
    colonnes = np.flatnonzero(masque.any(axis=0))
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


def _point(masque: np.ndarray) -> tuple[int, int]:
    """Un pixel de la zone, en `(x, y)`. Le premier du balayage — dedans, sûr."""
    lignes, colonnes = np.nonzero(masque)
    if lignes.size == 0:
        return (0, 0)
    return int(colonnes[0]), int(lignes[0])


def _couleur(rgba: np.ndarray, masque: np.ndarray) -> str:
    pixels = rgba[masque][:, :3]
    if pixels.size == 0:
        return "#000000"
    r, v, b = (int(round(float(c))) for c in pixels.mean(axis=0))
    return f"#{r:02x}{v:02x}{b:02x}"


def _decrire(rgba: np.ndarray, masque: np.ndarray, aire: int) -> Tache:
    """Décrire une zone — **trois balayages de l'image entière**, et c'est le
    prix qu'on ne paie qu'aux zones qu'on va vraiment rendre."""
    return Tache(
        aire=aire,
        boite=_boite(masque),
        couleur=_couleur(rgba, masque),
        point=_point(masque),
    )


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

    **On trie d'abord, on décrit ensuite** — corrigé le 31 août 2026, à la
    mesure. Décrire une zone coûte trois balayages de l'image entière, et le
    plafond n'était appliqué qu'*après* les avoir tous payés : sur l'image la
    plus bruitée du dépôt — seize mille zones sur mille pixels de côté — la
    mesure mettait **56 secondes** à décrire seize mille zones dont deux cents
    seulement étaient rendues. L'aire, elle, sort gratuitement du remplissage.
    Trier dessus puis ne décrire que ce qui sort ramène la même liste en 138 ms.
    """
    alpha = rgba[:, :, 3]
    if not alpha.any():
        return []
    zones = composantes(alpha > 0)
    zones.sort(key=lambda z: z[1])
    return [_decrire(rgba, masque, aire) for masque, aire in zones[:plafond]]


def poches_de_fond(
    rgba: np.ndarray, tolerance: int = 28, *, plafond: int = 40
) -> tuple[list[Tache], int]:
    """Ce que le moteur du bord **aurait effacé s'il avait pu l'atteindre**.

    La lumière entre un bras et un torse, le trou d'une anse, l'intérieur d'un
    anneau : du fond, à la couleur du fond, mais que le remplissage depuis les
    bordures ne rejoint par aucun chemin. Aucune valeur de tolérance ne les
    retire — c'est le fait mesuré qui a fait admettre la pipette (A-22), et
    c'est cette mesure-ci qui les montre.

    **Écrite en fermant E3, le 31 août 2026, parce que `trous` ne le faisait
    pas.** Le panneau du détourage affichait les *trous de la silhouette* sous
    le nom de « poches de fond enfermées », et les deux sont exactement
    inverses : ce que le bord n'atteint pas **reste opaque**, alors que `trous`
    cherche du transparent. La conséquence se mesure — sur les soixante images
    brutes du dépôt, détourées au réglage courant, l'ancienne mesure en trouvait
    **zéro**, et elle n'en trouvait une sur un anneau d'essai qu'*après* que la
    pipette eut retiré la poche. Elle annonçait la chose au moment où elle avait
    cessé d'exister.

    Comment on les trouve, et c'est le calcul du moteur du bord lu d'une ligne :
    les pixels **proches de la couleur de bordure** que le remplissage n'a pas
    rejoints, et qui sont **encore opaques**. Le premier terme dit « c'est du
    fond », le deuxième « il est enfermé », le troisième « il est encore là ».

    **Le produit ne tranche pas** : il les cercle, il les compte, et il n'en
    efface aucune de lui-même. Une poche est parfois de la matière qu'on veut
    garder — un cabochon de lanterne, un vitrail —, et rien dans les pixels ne
    permet de le savoir.

    **Rend la liste coupée *et* le compte entier**, ce qui n'est pas une
    coquetterie de signature : le compte sort gratuitement du remplissage, et le
    redemander par un second appel coûterait les quatre secondes du remplissage
    lui-même sur l'image la plus bruitée du dépôt. Ce qui est coupé se dit —
    même règle que les taches — mais ici il fallait aussi que le dire soit
    gratuit.

    Les mesures qui ont fixé le plafond, prises le 31 août 2026 sur les soixante
    images du dépôt détourées au réglage courant : **quarante-trois poches par
    image en médiane**, jusqu'à seize mille, et les trois quarts font un à trois
    pixels — du bruit de compression à la couleur du fond. Aucun plancher d'aire
    ne sépare proprement le bruit du reste, c'est une longue traîne. On rend donc
    les plus grandes, qui sont celles dont on se demande vraiment si c'est du
    fond ou de la matière.
    """
    from atelier.image.traitement import _couleur_du_bord, _graines_du_bord, _remplir

    rgb = rgba[:, :, :3]
    cible = _couleur_du_bord(rgb)
    proche = np.abs(rgb.astype(np.int16) - cible).max(axis=2) <= tolerance
    if not proche.any():
        return [], 0
    joignable = _remplir(proche, _graines_du_bord(proche))
    enferme = proche & ~joignable & (rgba[:, :, 3] > 0)
    if not enferme.any():
        return [], 0
    # De la plus grande à la plus petite : une poche ne s'efface pas sous un
    # seuil, elle se regarde. Et l'on trie sur l'aire, qui est gratuite, avant
    # de décrire — voir `taches`, où la même faute coûtait 56 secondes.
    zones = composantes(enferme)
    zones.sort(key=lambda z: z[1], reverse=True)
    return [_decrire(rgba, m, a) for m, a in zones[:plafond]], len(zones)


#: La tolérance de `zones_de_fond_enferme`, volontairement plus serrée que
#: celle d'une passe de détourage (28 par défaut) et **fixe, indépendante du
#: réglage de l'auteur** : cette mesure sépare une couleur *presque
#: identique* à celle que le détourage visait pour le fond de tout le reste —
#: un vert de feuillage qui ressemble au fond n'est pas *ce* vert-là, et doit
#: rester du sujet. Élargir la tolérance est le geste d'une passe qui retire ;
#: ce n'est pas celui d'une mesure qui doit rester fiable quel que soit le
#: réglage posé à côté.
#:
#: **Relevée de 16 à 24 le 24 septembre 2026, sur l'image réelle de
#: l'auteur** : la quantification du rendu décale la couleur du fond de
#: dix-huit sur une vitre de bus (`#38b83c` visé, `#3ca649` rendu, ~2000
#: pixels), et la mesure travaille sur le rendu (voir la classe) — à 16, elle
#: ne voyait que 132 pixels en 3 zones ; à 20 et au-delà, elle se stabilise à
#: 2200 pixels en 22 zones, un plateau net. 24 reste sous les 28 d'une passe
#: de détourage tout en couvrant ce plateau.
TOLERANCE_FOND_VISE = 24

#: En dessous de cette aire — un carré de trois pixels de côté —, une poche
#: est du bruit de compression ou de quantification, jamais un morceau de
#: fond qu'on proposerait de retirer d'un clic.
AIRE_MIN_FOND_VISE = 9


def zones_de_fond_enferme(
    rendu: np.ndarray,
    cible: tuple[int, int, int],
    tolerance: int = TOLERANCE_FOND_VISE,
) -> int:
    """Combien de poches, à la couleur *visée* par le détourage, restent
    opaques dans le rendu final (RV25).

    **Ce qu'elle sépare, en une phrase** (AGENTS.md, 8sexies) : un pixel dont
    la couleur est presque exactement celle que le détourage visait pour le
    fond, et qu'aucun chemin de cette même couleur ne relie au bord du rendu,
    d'un pixel qui ne fait que lui ressembler — un vert de feuillage n'est pas
    *ce* vert-là, et reste du sujet, jamais une poche.

    Le jumeau de `poches_de_fond`, sur trois points qui comptent :

    - **le rendu final** — bords, contour et quantification compris —, parce
      que c'est ce que l'auteur voit, et c'est de ça que la phrase à l'écran
      parle, pas d'une image intermédiaire que personne ne regarde ;
    - **la couleur que le détourage a réellement visée**, `cible`, jamais
      celle du rendu : un rendu recadré à ras du sujet peut n'avoir plus un
      seul pixel de bordure pour la deviner — c'est à l'appelant de la
      trouver, comme `_mesures_du_fond` le fait déjà pour `bord` ;
    - **une tolérance serrée et fixe** — voir `TOLERANCE_FOND_VISE`.

    Rend un **compte**, pas une liste : rien à l'écran ne montre les poches
    une par une ici, seulement leur nombre et un bouton, donc décrire chaque
    zone — trois balayages de l'image entière, voir `taches` — coûterait sans
    rien servir.
    """
    from atelier.image.traitement import _graines_du_bord, _remplir

    rgb = rendu[:, :, :3]
    reference = np.asarray(cible, dtype=np.int16)
    proche = np.abs(rgb.astype(np.int16) - reference).max(axis=2) <= tolerance
    if not proche.any():
        return 0
    joignable = _remplir(proche, _graines_du_bord(proche))
    enferme = proche & ~joignable & (rendu[:, :, 3] > 0)
    if not enferme.any():
        return 0
    return sum(1 for _, aire in composantes(enferme) if aire >= AIRE_MIN_FOND_VISE)


def trous(rgba: np.ndarray) -> list[Tache]:
    """Les **trous de la silhouette** — le transparent que le sujet entoure.

    C'est ce que le contour longe, ou ne longe pas, selon le réglage « les
    trous » de la sixième place : un anneau détouré a un trou au milieu, et
    tracer son pourtour extérieur seul ou ses deux bords ne donne pas la même
    image.

    **Renommée en fermant E3**, le 31 août 2026 : elle s'appelait `poches` et
    deux panneaux la lisaient sous deux noms, dont un faux. Le contour, lui, la
    lisait juste — un trou de silhouette est bien transparent. Le détourage
    demande une autre question, et l'a maintenant : voir `poches_de_fond`.

    Comment on les trouve : les zones **transparentes** qui ne touchent aucun
    bord de l'image. Une zone transparente qui touche un bord est le fond
    ordinaire, déjà parti ; celle qui n'en touche aucun est entourée.
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
        # La couleur d'un trou est celle qu'il **avait** — transparent, il n'en
        # a plus. Les pixels gardent leur teinte d'origine sous une opacité
        # nulle, donc la moyenne rend bien le fond qu'on a retiré : c'est ce qui
        # permet de le reconnaître à l'œil.
        dedans.append(_decrire(rgba, masque, aire))
    dedans.sort(key=lambda t: t.aire, reverse=True)
    return dedans


def crans_occupation(rgba: np.ndarray, grille: Grille) -> list[int]:
    """Les valeurs d'occupation où l'image **change vraiment**.

    Le curseur part de 10 % et s'arrête à chaque pour cent : sur une cible de 64
    pixels il avait quatre-vingt-onze positions pour une trentaine de tailles
    possibles. Deux crans voisins rendent alors la même image, et la main croit
    régler quelque chose.

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
    # **Le curseur monte maintenant au-delà de la case** (tranche des tailles,
    # 3 septembre 2026). Il s'arrêtait à 100 %, et c'était l'un des douze endroits
    # qui fermaient au produit les bâtiments, les arbres et les tours. Le plafond
    # vient du domaine, où il se justifie une fois pour toutes.
    for occupation in range(10, occupation_max(cible) + 1):
        cote = cote_du_sujet(cible, occupation)
        if cote in vus:
            continue
        vus.add(cote)
        retenus.append(occupation)
    return retenus
