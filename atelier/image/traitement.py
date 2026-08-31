# -*- coding: utf-8 -*-
"""Le post-traitement — CPU, pur, dans un ordre fixe.

**Ne touche jamais le GPU et n'appelle jamais le fournisseur** : invariant
instauré ici (`docs/PLAN.md`, T2). Aucune fonction de ce module ne fait d'entrée
ni de sortie ; elle reçoit des tableaux, elle en rend. C'est ce qui les rend
mesurables au banc et rejouables à l'identique.

Deux décisions ont été prises à la mesure, pas au jugé, le 27 août 2026 :

**Le détourage par défaut ne demande aucun modèle.** Le remplissage depuis le
bord — un pixel n'est du fond que s'il est *relié au bord* par une chaîne de
pixels proches de la couleur du bord — a rendu douze silhouettes propres sur
douze images de six modèles, PNG et JPEG, squelette blanc sur fond gris clair et
fioles translucides compris. Un seuil global aurait mangé le squelette ; la
chaîne jusqu'au bord ne le touche pas. Le second moteur (`rembg`) existe pour les
images qui n'ont pas été fabriquées ici et n'ont donc pas de fond plat — il est
facultatif, et grisé avec sa raison quand il n'est pas installé.

**L'alpha se durcit avant la réduction, jamais après.** Décision reprise de
`MySpriteAi/src/lib/pixelPipeline.ts`, où elle a été payée cher : un contour à
demi transparent est tranché à pile ou face par un rééchantillonnage au plus
proche voisin, et deux passes de suite rendent alors deux silhouettes
différentes.

**Le liseré clair naît du durcissement, pas de la quantification** — précisé le
31 août 2026, parce que la phrase d'avant laissait croire l'inverse et qu'un
commentaire de `atelier/domaine/recette.py` l'affirmait carrément. Ici,
`quantifier` met l'alpha de côté et le remet tel quel. Ce qui produit le liseré
est `durcir` : un pixel de contour à peine visible, dont la couleur est déjà
celle du fond, passe le seuil et ressort opaque de cette couleur-là. Le seuil de
la passe et son durcissement sont donc les deux seuls réglages qui l'atteignent.
`MySpriteAi` cumulait les deux moitiés — il forçait *aussi* l'alpha à 255 en
quantifiant ; c'est cette moitié-là qui n'a pas été reprise.
"""

from __future__ import annotations

import importlib.util
import io
from dataclasses import dataclass, replace
from typing import Sequence

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.recette import (
    BAS,
    BORD,
    COULEUR,
    FLOYD,
    LAISSES,
    MODELE,
    PARTOUT,
    Bords,
    CalqueDessin,
    Contour,
    Grille,
    Main,
    Passe,
    Quantification,
    Recadrage,
    Recette,
    Trait,
)

__all__ = [
    "MoteurAbsent",
    "Rendu",
    "appliquer",
    "boite_opaque",
    "composantes",
    "contourner",
    "detourer",
    "detourer_bord",
    "detourer_couleur",
    "durcir",
    "etendre",
    "finir",
    "mesurer_grille",
    "moteur_disponible",
    "peindre",
    "pinceau",
    "pose_du_calque",
    "queue",
    "raison_moteur",
    "restreindre",
    "retoucher",
    "ronger",
    "sans_les_deux_dernieres",
]


class MoteurAbsent(Exception):
    """Le moteur demandé n'est pas installé sur cette machine.

    Ne devrait jamais atteindre l'auteur par surprise : le service grise le
    moteur avec sa raison avant qu'on puisse le choisir. C'est le filet.
    """


@dataclass(frozen=True, slots=True)
class Rendu:
    """Le résultat d'une recette : des octets PNG, et ce qu'on a mesuré dessus."""

    octets: bytes
    largeur: int
    hauteur: int


# ── Le second moteur, et son absence ─────────────────────────────────────────
#
# Importé **paresseusement, une seule fois**. `rembg` charge un modèle ONNX de
# 176 Mo au premier appel et le télécharge s'il n'est pas déjà en cache :
# l'importer au démarrage ferait payer ça à l'ouverture de l'atelier, et
# échouerait hors ligne — or « le démarrage n'affiche aucune erreur » est un
# critère de T1 qu'aucune tranche ne renégocie.

# **Le modèle est nommé, jamais laissé au défaut de la bibliothèque.** Mesuré le
# 27 août 2026, à la première exécution réelle de ce chemin
# (`essais/essai_detourage_modele.py`) : le défaut de `rembg` 2.0.81 est
# `bria-rmbg`, un modèle d'un gigaoctet qui met **15,8 s** par image de 1024 px
# sur processeur. `u2net` met **0,47 s** — trente-quatre fois moins — pour une
# silhouette équivalente à deux points de pourcentage près. Le défaut d'une
# bibliothèque est une cible mouvante : celui-ci a changé sous une note du dépôt
# qui annonçait « ~180 Mo », et c'est la taille de `u2net`. On le nomme.
MODELE_ONNX = "u2net"

_session_modele: object | None = None


def moteur_disponible(moteur: str) -> bool:
    return raison_moteur(moteur) is None


def raison_moteur(moteur: str) -> str | None:
    """La raison du grisé, en clair — ou `None` si le moteur est là.

    « Ce qui est indisponible est grisé avec sa raison, jamais proposé puis
    refusé » (`docs/PLAN.md` § Les invariants, étendu par T2). Le moteur absent
    est précisément l'une des nouvelles raisons que cette tranche apporte.

    **On cherche le paquet, on ne l'importe pas.** `import rembg` tire
    `onnxruntime` dans le processus au premier `GET /api/status` — donc à
    l'ouverture de l'atelier, pour la seule question « faut-il griser ce
    bouton ? ». Or « le post-traitement ne touche jamais le GPU » se **prouve**
    en regardant `sys.modules` (`tests/test_t2.py`) : une machine où le second
    moteur est installé aurait fait tomber ce test sans qu'aucun détourage par
    modèle ait eu lieu. `find_spec` répond à la même question sans rien charger,
    et l'inférence n'entre dans le processus qu'au moment où on la demande.
    """
    # La pipette n'a rien à télécharger : c'est le même remplissage par plages
    # que le bord, amorcé ailleurs. Elle est donc toujours là, comme lui.
    if moteur in (BORD, COULEUR):
        return None
    if moteur != MODELE:
        return f"moteur inconnu — « {moteur} »"
    try:
        if importlib.util.find_spec("rembg") is None:
            return "le moteur par modèle n'est pas installé"
    except (ImportError, ValueError):  # noqa: BLE001 — l'absence n'est pas une panne
        return "le moteur par modèle n'est pas installé"
    return None


def _detourer_modele(rgb: np.ndarray) -> np.ndarray:
    global _session_modele
    if raison_moteur(MODELE) is not None:
        raise MoteurAbsent("le moteur par modèle n'est pas installé")
    import rembg  # type: ignore[import-not-found]

    if _session_modele is None:
        _session_modele = rembg.new_session(MODELE_ONNX)
    image = Image.fromarray(rgb, mode="RGB")
    sortie = rembg.remove(image, session=_session_modele)
    return np.asarray(sortie.convert("RGBA"))[:, :, 3]


# ── Le détourage par le bord ─────────────────────────────────────────────────


def _couleur_du_bord(rgb: np.ndarray) -> np.ndarray:
    """La médiane des pixels de bordure. La médiane, pas la moyenne : un sujet
    qui touche un bord déplacerait la moyenne, il ne déplace pas la médiane."""
    bordure = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]], axis=0
    )
    return np.median(bordure.astype(np.int16), axis=0)


def _remplir(proche: np.ndarray, graines: list[tuple[int, int]]) -> np.ndarray:
    """Remplissage par plages, amorcé où on le lui dit.

    Par plages et non pixel à pixel : une file de pixels sur une image de
    1024 × 1024 se compte en centaines de milliers d'entrées et met près d'une
    seconde en Python, ce qui interdirait « chaque réglage répond sans attente
    perceptible ». Une plage est une ligne de fond entière, trouvée d'un coup par
    numpy — il y en a quelques milliers, pas un million.

    **Les graines sont devenues un argument en E3**, quand la pipette est
    arrivée : elle part d'un point désigné là où le moteur du bord part des
    quatre bordures, et c'est *toute* leur différence. Deux remplissages par
    plages dans le même fichier auraient fini par se répondre différemment sur
    la même image — la crainte est écrite noir sur blanc dans `composantes`, qui
    a été rendue publique pour la même raison.
    """
    hauteur, largeur = proche.shape
    fond = np.zeros_like(proche)
    pile: list[tuple[int, int]] = list(graines)

    def semer(y: int, debut: int, fin: int) -> None:
        """Une graine par sous-plage libre, jamais une par pixel."""
        if not (0 <= y < hauteur):
            return
        libre = proche[y, debut : fin + 1] & ~fond[y, debut : fin + 1]
        if not libre.any():
            return
        borde = np.concatenate(([False], libre, [False])).astype(np.int8)
        for depart in np.flatnonzero(np.diff(borde) == 1):
            pile.append((y, debut + int(depart)))

    while pile:
        y, x = pile.pop()
        if fond[y, x] or not proche[y, x]:
            continue
        ligne = proche[y] & ~fond[y]
        fermes = np.flatnonzero(~ligne)
        avant = fermes[fermes < x]
        apres = fermes[fermes > x]
        debut = int(avant[-1]) + 1 if avant.size else 0
        fin = int(apres[0]) - 1 if apres.size else largeur - 1
        fond[y, debut : fin + 1] = True
        semer(y - 1, debut, fin)
        semer(y + 1, debut, fin)

    return fond


def _graines_du_bord(proche: np.ndarray) -> list[tuple[int, int]]:
    """Les quatre bordures, en plages — les amorces du moteur courant."""
    hauteur, largeur = proche.shape
    graines: list[tuple[int, int]] = []
    for y in (0, hauteur - 1):
        libre = proche[y]
        borde = np.concatenate(([False], libre, [False])).astype(np.int8)
        graines.extend((y, int(d)) for d in np.flatnonzero(np.diff(borde) == 1))
    for y in range(hauteur):
        if proche[y, 0]:
            graines.append((y, 0))
        if proche[y, largeur - 1]:
            graines.append((y, largeur - 1))
    return graines


def detourer_bord(rgb: np.ndarray, tolerance: int) -> np.ndarray:
    """L'alpha d'une image dont le fond est plat — le cas de tout ce qui sort d'ici.

    Un pixel n'est du fond que s'il est **relié au bord** par une chaîne de
    pixels proches de la couleur de bordure. C'est toute la différence avec un
    seuil global : un blanc à l'intérieur du sujet — l'os d'un squelette, le
    reflet d'une fiole — n'est relié à rien, et reste.
    """
    cible = _couleur_du_bord(rgb)
    ecart = np.abs(rgb.astype(np.int16) - cible).max(axis=2)
    proche = ecart <= tolerance
    fond = _remplir(proche, _graines_du_bord(proche))
    return np.where(fond, np.uint8(0), np.uint8(255))


def detourer_couleur(
    rgb: np.ndarray,
    point: tuple[int, int],
    tolerance: int,
    *,
    partout: bool = False,
) -> np.ndarray:
    """L'alpha d'une image dont on a **désigné le fond du doigt** (E3).

    Le recours pour ce que le remplissage depuis le bord ne peut pas atteindre :
    une poche de fond entièrement enfermée par le sujet n'est reliée à aucune
    bordure, donc aucune valeur de tolérance ne l'efface. Ici l'amorce n'est
    plus la bordure, c'est le point.

    Deux portées, et elles ne se ressemblent pas :

    - **la zone d'un seul tenant** sous le point — le geste pour lequel la
      pipette a été admise. Elle règle une poche sans toucher au reste, et c'est
      pour ça que c'est le défaut ;
    - **toutes les zones de cette couleur**, celles qui touchent le sujet
      comprises. Plus expéditif, plus risqué, et il n'y a rien à faire pour le
      rendre sûr : c'est le choix de l'auteur, écrit dans la recette.

    `point` est en pixels de cette image, `(x, y)`. **Hors cadre, rien ne se
    passe** — une passe qu'on n'a pas encore visée ne mange pas l'image en
    attendant qu'on la vise.
    """
    hauteur, largeur = rgb.shape[:2]
    x, y = point
    if not (0 <= x < largeur and 0 <= y < hauteur):
        return np.full((hauteur, largeur), np.uint8(255))
    cible = rgb[y, x].astype(np.int16)
    proche = np.abs(rgb.astype(np.int16) - cible).max(axis=2) <= tolerance
    fond = proche if partout else _remplir(proche, [(y, x)])
    return np.where(fond, np.uint8(0), np.uint8(255))


# ── Le bord du sujet ─────────────────────────────────────────────────────────


def durcir(alpha: np.ndarray, seuil: int) -> np.ndarray:
    """Franchement opaque, ou franchement absent. Rien entre les deux."""
    return np.where(alpha >= seuil, np.uint8(255), np.uint8(0))


def ronger(alpha: np.ndarray, pixels: int) -> np.ndarray:
    """Érosion en croix, `pixels` fois — le durcissement du bord (US-70).

    Ce qui reste d'un halo après le seuil, c'est un ou deux pixels de contour à
    la couleur du fond. Les ronger coûte un liseré de sprite ; ne pas les ronger
    coûte un halo. Le réglage existe pour que l'auteur tranche, image par image.
    """
    if pixels <= 0:
        return alpha
    plein = alpha > 0
    for _ in range(pixels):
        garde = plein.copy()
        garde[1:, :] &= plein[:-1, :]
        garde[:-1, :] &= plein[1:, :]
        garde[:, 1:] &= plein[:, :-1]
        garde[:, :-1] &= plein[:, 1:]
        plein = garde
    return np.where(plein, alpha, np.uint8(0))


def boite_opaque(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    """La boîte du sujet, ou `None` s'il ne reste rien.

    `None` est le cas « le détourage a mangé le sujet » (US-71) : il ne se
    répare pas ici, il **se voit** — l'appelant le remonte tel quel plutôt que
    de rendre une image vide sans rien dire.
    """
    lignes = np.flatnonzero(alpha.any(axis=1))
    colonnes = np.flatnonzero(alpha.any(axis=0))
    if lignes.size == 0 or colonnes.size == 0:
        return None
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]), int(lignes[-1])


# ── Les composantes connexes ─────────────────────────────────────────────────


def composantes(masque: np.ndarray) -> list[tuple[np.ndarray, int]]:
    """Les taches opaques, chacune avec son aire. Même remplissage par plages.

    Publique depuis T5 : le slicer cherche exactement la même chose que le
    nettoyage des bords — des taches connexes dans un alpha —, et la seule
    différence est ce qu'on en fait. Deux implémentations du remplissage par
    plages finiraient par se répondre différemment sur la même image.
    """
    hauteur, largeur = masque.shape
    vu = np.zeros_like(masque)
    taches: list[tuple[np.ndarray, int]] = []

    for y0 in range(hauteur):
        libres = np.flatnonzero(masque[y0] & ~vu[y0])
        for x0 in libres:
            if vu[y0, x0]:
                continue
            tache = np.zeros_like(masque)
            pile = [(y0, int(x0))]
            aire = 0
            while pile:
                y, x = pile.pop()
                if vu[y, x] or not masque[y, x]:
                    continue
                ligne = masque[y] & ~vu[y]
                fermes = np.flatnonzero(~ligne)
                avant = fermes[fermes < x]
                apres = fermes[fermes > x]
                debut = int(avant[-1]) + 1 if avant.size else 0
                fin = int(apres[0]) - 1 if apres.size else largeur - 1
                vu[y, debut : fin + 1] = True
                tache[y, debut : fin + 1] = True
                aire += fin - debut + 1
                for voisin in (y - 1, y + 1):
                    if not (0 <= voisin < hauteur):
                        continue
                    libre = masque[voisin, debut : fin + 1] & ~vu[voisin, debut : fin + 1]
                    if not libre.any():
                        continue
                    borde = np.concatenate(([False], libre, [False])).astype(np.int8)
                    for depart in np.flatnonzero(np.diff(borde) == 1):
                        pile.append((voisin, debut + int(depart)))
            taches.append((tache, aire))
    return taches


def nettoyer(rgba: np.ndarray, bords: Bords) -> np.ndarray:
    """Le dernier mot : les taches trop petites pour être le sujet s'en vont.

    Une réduction au plus proche voisin laisse derrière elle des pixels isolés —
    un éclat de fond qui a survécu au seuil, un bout de contour détaché. À
    64 pixels de côté, un pixel isolé se voit ; à 1024, il ne se voyait pas.
    """
    if bords.aire_min <= 0:
        return rgba
    alpha = rgba[:, :, 3]
    if not alpha.any():
        return rgba
    sortie = rgba.copy()
    canal = sortie[:, :, 3]  # une vue, pas une copie : écrire dedans écrit dans `sortie`
    for tache, aire in composantes(alpha > 0):
        if aire < bords.aire_min:
            canal[tache] = 0
    return sortie


# ── Le pinceau, et ce qu'il couvre ───────────────────────────────────────────
#
# **Écrit ici depuis E5, et importé par le calque** — il y vivait depuis C4,
# quand la main ne servait qu'à affiner un masque de différence. Elle est
# devenue la septième place de la recette, donc une étape du traitement
# ordinaire ; et `calque.py` importe déjà ce module, si bien que l'inverse
# n'était pas possible. Deux rasterisations séparées auraient fini par ne plus
# se rejoindre au rayon 1.


def pinceau(forme: tuple[int, int], trait: Trait) -> np.ndarray:
    """Les pixels qu'un passage de la main couvre — **une fonction pure**.

    **Un carré de côté `2 × rayon + 1`, promené le long du chemin** — bouts et
    joints carrés. Rayon nul : un pixel de large, et c'est le geste « au pixel »
    d'US-149 et d'US-207 — la même fonction, la même liste de points, un seul
    nombre de différence.

    **Carré depuis U11, et il était rond** (1<sup>er</sup> septembre 2026). Le
    disque était le bon choix de C4, où la main affinait un masque de différence
    sur une image de mille pixels ; elle est depuis devenue la septième place de
    la recette, donc un outil qu'on emploie sur le sprite fini. Sur soixante-
    quatre pixels de côté, un disque de rayon deux ne fait pas un bord net : il
    fait un escalier que personne n'a dessiné. **Le carré est la forme de
    l'unité qu'on manipule**, et c'est la seule qui rende ce que la main croit
    poser. Le prix est nommé et il se paie une fois : un calque déjà peint se
    redessine légèrement différemment — voir `docs/tranches/U.md`, U11, et la
    promesse de déterminisme du §4 de `docs/ARCHITECTURE.md`.

    **Les points sont reliés, jamais semés.** Un pointeur envoie ce qu'il peut,
    pas ce que la main a parcouru : sans le segment entre deux points, un geste
    rapide laisserait des trous que personne n'a dessinés. Le chemin est donc
    tracé d'un pixel de large par `ImageDraw`, dont la rasterisation est fixe —
    deux rendus de la même recette donnent le même masque, et c'est un critère
    depuis T2 —, puis **épaissi par la dilatation carrée du produit**. Un
    rectangle posé à chaque pixel du chemin donnerait exactement le même masque,
    en mille fois plus d'appels de dessin.

    Rien n'est levé pour un point hors du cadre : il se borne, comme le
    rectangle de C3.
    """
    hauteur, largeur = forme
    toile = Image.new("1", (largeur, hauteur), 0)
    dessin = ImageDraw.Draw(toile)
    points = [(int(x), int(y)) for x, y in trait.points]
    if len(points) > 1:
        dessin.line(points, fill=1, width=1)
    # **Un point, et pas une ligne d'un seul sommet** : `line` ne trace rien
    # quand elle n'a qu'un point, et le geste au pixel — un seul point — ne
    # marquait alors aucun pixel. Payé en écrivant les essais de C4, et gardé.
    dessin.point(points, fill=1)
    return etendre(np.asarray(toile, dtype=bool), max(0, trait.rayon))


def peindre(masque: np.ndarray, traits: Sequence[Trait]) -> np.ndarray:
    """Les passages de la main, posés dans leur ordre, sur un masque booléen.

    **Le dernier passage l'emporte**, comme un pinceau sur une toile : un trait
    qui ôte par-dessus un trait qui garde laisse le pixel ôté. Additionner les
    surfaces aurait rendu le geste de retrait impossible à faire après coup,
    donc irrattrapable — et toute la main est là pour rattraper.

    Rend le masque reçu tel quel quand il n'y a rien à poser : aucune copie
    inutile sur l'immense majorité des images, qui ne portent aucun trait.
    """
    if not traits:
        return masque
    peint = masque.copy()
    for trait in traits:
        peint[pinceau(peint.shape, trait)] = trait.garde
    return peint


# ── La morphologie, et son bord de cadre ─────────────────────────────────────
#
# **Carrée, jamais en croix.** Une croix répétée donne un losange, et un contour
# en losange sur un sprite se voit aux quatre coins. Le voisinage de huit rend
# un trait d'épaisseur constante dans toutes les directions, ce que « épaisseur »
# promet.
#
# **Hors du cadre, c'est du fond, et c'est le même choix des deux côtés.** Un
# sujet recadré sur sa boîte opaque — le cas normal après le recadrage — touche
# les quatre bords : sans cette convention, un contour interne s'interromprait
# précisément là où le sprite est le plus visible.


def etendre(masque: np.ndarray, pixels: int) -> np.ndarray:
    """Dilatation carrée de `pixels`, par décalages bornés."""
    if pixels <= 0:
        return masque
    hauteur, largeur = masque.shape
    grossi = masque
    for _ in range(pixels):
        borde = np.pad(grossi, 1, constant_values=False)
        suivant = np.zeros_like(grossi)
        for dy in range(3):
            for dx in range(3):
                suivant |= borde[dy : dy + hauteur, dx : dx + largeur]
        grossi = suivant
    return grossi


def restreindre(masque: np.ndarray, pixels: int) -> np.ndarray:
    """Érosion carrée de `pixels`. Le bord du cadre ronge, comme du fond."""
    if pixels <= 0:
        return masque
    hauteur, largeur = masque.shape
    reduit = masque
    for _ in range(pixels):
        borde = np.pad(reduit, 1, constant_values=False)
        suivant = np.ones_like(reduit)
        for dy in range(3):
            for dx in range(3):
                suivant &= borde[dy : dy + hauteur, dx : dx + largeur]
        reduit = suivant
    return reduit


def _rvb(hexa: str) -> tuple[int, int, int]:
    """Un `#rrggbb` en trois octets. Une valeur illisible rend du noir.

    Ne lève pas : la couleur vient d'un champ libre — *une couleur hors palette
    se marque, elle ne se refuse pas* —, et un rendu qui tomberait sur une
    frappe en cours serait pire que le noir.
    """
    propre = hexa.lstrip("#")
    if len(propre) != 6:
        return 0, 0, 0
    try:
        return tuple(int(propre[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return 0, 0, 0


# ── Le contour ───────────────────────────────────────────────────────────────


def contourner(rgba: np.ndarray, contour: Contour) -> np.ndarray:
    """La sixième place — le trait de bord, retracé (E5, US-205).

    **Deux cas ne tracent rien, et ce sont les deux formes du même fait** : une
    image sans aucun pixel opaque n'a pas de sujet, une image entièrement opaque
    n'a pas de bord de sujet — seulement les quatre bords du cadre, et un
    rectangle noir autour de l'image n'est jamais ce qu'on voulait. L'écran
    grise la table dans le second cas ; ici on se contente de rendre l'image
    telle quelle, parce qu'un module pur ne refuse pas.

    **`laisses` ne change pas le trait, il change la silhouette qu'on longe** :
    on bouche d'abord les trous — les zones de fond que le sujet enferme — et
    l'on trace le bord de ce qui reste. C'est le même remplissage depuis le bord
    que le détourage, et c'est voulu : *une zone transparente qui ne touche
    aucun bord est enfermée* est une définition, pas deux.
    """
    sujet = rgba[:, :, 3] > 0
    if not sujet.any() or sujet.all():
        return rgba

    if contour.trous == LAISSES:
        sujet = ~_remplir(~sujet, _graines_du_bord(~sujet))

    dehors, dedans = contour.parts
    if dehors:
        rgba = np.pad(
            rgba, ((dehors, dehors), (dehors, dehors), (0, 0)), constant_values=0
        )
        sujet = np.pad(sujet, dehors, constant_values=False)

    anneau = etendre(sujet, dehors) & ~restreindre(sujet, dedans)
    sortie = rgba.copy()
    rouge, vert, bleu = _rvb(contour.couleur)
    sortie[anneau] = (rouge, vert, bleu, 255)
    return sortie


# ── La main ──────────────────────────────────────────────────────────────────


def retoucher(rgba: np.ndarray, main: Main) -> np.ndarray:
    """La septième et dernière place — ce que l'auteur désigne (E5, US-207).

    **L'opacité d'abord, les dessins ensuite, du dessous vers le dessus.** Elle
    décide de ce qui est là, sur l'image que les six tables précédentes ont
    produite ; les calques posent de la matière par-dessus. L'ordre est celui de
    la pile, et il n'est écrit qu'ici.

    **`remettre` ne fabrique aucune couleur** : il rend l'opacité à un pixel
    dont la couleur est toujours dans le tableau — ni le détourage ni la
    quantification ne touchent au canal des couleurs quand ils retirent
    l'alpha. C'est ce qui fait de « remettre ce que l'image avait avant qu'on le
    retire » une phrase exacte, et non une approximation.

    **Effacer sur un calque de dessin ne retire que ce que ce calque-là a
    posé** : le pixel retombe sur ce qu'il y avait dessous, jamais sur du vide.
    C'est pour ça qu'un calque se calcule à part, puis se pose — et non trait
    par trait à même l'image.
    """
    sortie = rgba.copy()
    forme = sortie.shape[:2]

    if main.opacite:
        present = sortie[:, :, 3] > 0
        voulu = peindre(present, main.opacite)
        canal = sortie[:, :, 3]  # une vue : écrire dedans écrit dans `sortie`
        canal[voulu & ~present] = 255
        canal[~voulu & present] = 0

    for calque in main.calques:
        if not calque.visible or not calque.passages:
            continue
        pose, teinte = pose_du_calque(forme, calque)
        sortie[pose, :3] = teinte[pose]
        sortie[pose, 3] = 255

    return sortie


def pose_du_calque(
    forme: tuple[int, int], calque: CalqueDessin
) -> tuple[np.ndarray, np.ndarray]:
    """Ce qu'un calque de dessin pose, et de quelle couleur — sans image.

    **Écrit une fois, appelé deux** : par le rendu, qui pose ; et par la mesure
    du panneau, qui compte les pixels posés. Un second parcours écrit ailleurs
    aurait fini par compter autre chose que ce que le rendu dessine, et le
    nombre affiché aurait été faux sans que rien ne tombe.

    La composition est indépendante de l'image : c'est ce qui fait qu'un passage
    **survit à un changement de taille de grille** (US-209) — il ne connaît que
    ses points et son rayon, et se rejoue sur la forme qu'on lui donne.
    """
    pose = np.zeros(forme, dtype=bool)
    teinte = np.zeros((*forme, 3), dtype=np.uint8)
    for passage in calque.passages:
        couvert = pinceau(forme, passage)
        if passage.garde:
            pose[couvert] = True
            teinte[couvert] = _rvb(passage.couleur)
        else:
            # **Effacer ne retire que ce que ce calque-là a posé** : le pixel
            # retombe sur ce qu'il y avait dessous, jamais sur du vide.
            pose[couvert] = False
    return pose, teinte


def sans_les_deux_dernieres(recette: Recette) -> Recette:
    """La recette jusqu'aux bords — l'image **que le contour va tracer**.

    Deux appelants, et c'est ce qui justifie de l'écrire une fois : les mesures
    d'une table, qui doivent décrire l'image *avant* les deux dernières places
    pour que le seuil des bords et le compte des taches contournées portent sur
    la même chose ; et l'appui *Avant ›*, qui montre l'image sans ce que la main
    y a posé.
    """
    return replace(recette, contours=None, main=None)


# ── La remise sur grille ─────────────────────────────────────────────────────


def _recadrer(rgba: np.ndarray, recadrage: Recadrage) -> np.ndarray:
    hauteur, largeur = rgba.shape[:2]
    if recadrage.boite is not None:
        x0, y0, x1, y1 = recadrage.boite
    else:
        boite = boite_opaque(rgba[:, :, 3])
        if boite is None:
            return rgba  # plus rien à recadrer : on ne fabrique pas une image vide
        x0, y0, x1, y1 = boite
    marge = max(0, recadrage.marge)
    x0 = max(0, x0 - marge)
    y0 = max(0, y0 - marge)
    x1 = min(largeur - 1, x1 + marge)
    y1 = min(hauteur - 1, y1 + marge)
    return rgba[y0 : y1 + 1, x0 : x1 + 1]


def sur_grille(rgba: np.ndarray, grille: Grille, *, case: bool) -> np.ndarray:
    """Le sujet, ramené à la taille de bloc demandée.

    **La cible est demandée, jamais déduite de l'image reçue** (US-61). C'est
    elle qui met un tonneau rendu sur une grille de 16 px et un personnage rendu
    sur une grille de 8 px à la même finesse : les deux ressortent avec le même
    bloc, quelle que soit la grille sur laquelle le modèle les a peints.

    Deux formes de sortie, et `case` tranche :

    - **une case carrée** de `cible` côté, où le sujet est centré
      horizontalement et posé selon `ancrage`. C'est la case qui fait que deux
      frames d'un même personnage se superposent au lieu de flotter.
    - **une homothétie** : le côté long ramené à `cible`, les proportions
      gardées. Enfermer un décor 16:9 dans une case carrée ajouterait des bandes
      que personne n'a demandées.

    `case` ne se déduit **pas** de la transparence présente dans le tableau : une
    fois recadré sur sa boîte opaque, un sprite n'a plus un seul pixel
    transparent, et la déduction rendrait une case pour les uns et pas pour les
    autres selon qu'ils ont été recadrés. Elle se déduit de la *recette* — avoir
    demandé un détourage, c'est avoir dit que ce qu'on traite a une silhouette.
    """
    cible = max(1, grille.cible)
    hauteur, largeur = rgba.shape[:2]
    image = Image.fromarray(rgba, mode="RGBA")

    if not case:
        facteur = cible / max(largeur, hauteur)
        taille = (max(1, round(largeur * facteur)), max(1, round(hauteur * facteur)))
        return np.asarray(image.resize(taille, Image.Resampling.NEAREST))

    boite = boite_opaque(rgba[:, :, 3])
    if boite is None:
        return rgba  # le détourage a tout mangé : ça se voit, ça ne se répare pas ici
    x0, y0, x1, y1 = boite
    sujet = image.crop((x0, y0, x1 + 1, y1 + 1))

    dedans = max(1, round(cible * max(1, min(100, grille.occupation)) / 100))
    facteur = dedans / max(sujet.width, sujet.height)
    taille = (
        max(1, min(cible, round(sujet.width * facteur))),
        max(1, min(cible, round(sujet.height * facteur))),
    )
    reduit = sujet.resize(taille, Image.Resampling.NEAREST)

    toile = Image.new("RGBA", (cible, cible), (0, 0, 0, 0))
    # **Centré sur sa boîte, puis décalé — et jamais hors de la case** (E17). Le
    # centrage horizontal se fait sur la boîte du sujet ; un bras tendu déplace
    # donc le corps sans que la taille ait bougé, et le décalage est ce qui
    # rattrape cette dérive. Il est borné à ce qui reste de place : sortir de la
    # case couperait le sprite en silence, et une case existe justement pour que
    # rien n'en sorte. Aux bords, les boutons cessent d'avoir un effet — ce qui
    # se voit, et c'est mieux qu'une image rognée.
    x = (cible - reduit.width) // 2
    if grille.decalage:
        x = max(0, min(cible - reduit.width, x + grille.decalage))
    y = cible - reduit.height if grille.ancrage == BAS else (cible - reduit.height) // 2
    toile.paste(reduit, (x, y))
    return np.asarray(toile)


# ── La quantification ────────────────────────────────────────────────────────


def _palette_imposee(couleurs: tuple[str, ...]) -> Image.Image:
    """La table Pillow d'une palette imposée — **remplie, jamais bourrée de noir**.

    Une table de palette compte toujours 256 entrées, et Pillow ramène chaque
    pixel à la **plus proche des 256**, pas à la plus proche de celles qu'on a
    écrites. Compléter avec des zéros posait donc 254 noirs purs dans la table,
    et tout ce qui était sombre s'y accrochait : mesuré sur six gris et une
    palette de deux couleurs claires, les deux plus sombres ressortaient en
    `#000000` — une couleur que la palette du projet ne déclare pas.

    C'est la même famille de piège que le liseré clair du § SEUIL_ALPHA : une
    valeur de remplissage qui n'est pas neutre finit par se voir sur l'image.
    On répète donc les couleurs déclarées jusqu'à remplir la table : chaque
    entrée est alors une couleur du projet, et la plus proche des 256 est
    forcément l'une d'elles.
    """
    triplets = [
        tuple(int(hexa.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
        for hexa in couleurs
    ] or [(0, 0, 0)]

    plate: list[int] = []
    while len(plate) < 768:
        plate.extend(triplets[(len(plate) // 3) % len(triplets)])

    reference = Image.new("P", (1, 1))
    reference.putpalette(plate[:768])
    return reference


def quantifier(rgba: np.ndarray, quantification: Quantification) -> np.ndarray:
    """Des aplats, à la place de trente mille couleurs.

    **Déterministe, et c'est un critère** : « une recette nommée, réappliquée
    ailleurs, donne exactement le même résultat ». Une initialisation aléatoire
    de k-moyennes rendrait deux images différentes pour la même recette — d'où
    la coupe médiane de Pillow, qui ne tire rien au sort, plutôt que le k-means++
    de `MySpriteAi/src/lib/pixelPipeline.ts`.

    L'alpha est mis de côté et remis **tel quel** : la quantification ne touche
    jamais la transparence. C'est l'autre moitié du piège du liseré — forcer
    l'alpha à 255 en même temps qu'on ramène les couleurs ressort les contours à
    demi transparents en pixels opaques de la couleur du fond.
    """
    alpha = rgba[:, :, 3].copy()
    rgb = Image.fromarray(rgba[:, :, :3], mode="RGB")
    tramage = (
        Image.Dither.FLOYDSTEINBERG
        if quantification.tramage == FLOYD
        else Image.Dither.NONE
    )

    if quantification.palette:
        indexee = rgb.quantize(
            palette=_palette_imposee(quantification.palette), dither=tramage
        )
    else:
        couleurs = max(2, min(256, quantification.couleurs))
        indexee = rgb.quantize(
            colors=couleurs, method=Image.Quantize.MEDIANCUT, dither=tramage
        )

    sortie = np.dstack([np.asarray(indexee.convert("RGB")), alpha])
    return sortie


# ── L'ordre fixe ─────────────────────────────────────────────────────────────


def _tableau(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _en_png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()


def _detourer(rgba: np.ndarray, passe: Passe) -> np.ndarray:
    """Une passe. L'alpha déjà posé n'est jamais rendu : il ne peut que se serrer.

    Une seconde passe travaille donc sur ce que la première a laissé, et non sur
    l'image d'origine — c'est ce qui fait que les passes s'enchaînent au lieu de
    se remplacer.
    """
    if passe.moteur == MODELE:
        neuf = _detourer_modele(rgba[:, :, :3])
    elif passe.moteur == COULEUR:
        # **Une pipette sans point ne fait rien**, et surtout pas « tout » : on
        # ajoute la passe avant de viser, et la moitié de seconde entre les deux
        # ne doit pas manger l'image sous les yeux de celui qui va cliquer.
        if passe.point is None:
            return rgba
        neuf = detourer_couleur(
            rgba[:, :, :3],
            passe.point,
            passe.tolerance,
            partout=passe.portee == PARTOUT,
        )
    else:
        neuf = detourer_bord(rgba[:, :, :3], passe.tolerance)

    alpha = np.minimum(rgba[:, :, 3], neuf)
    alpha = durcir(alpha, passe.seuil_alpha)
    alpha = ronger(alpha, passe.durcissement)
    sortie = rgba.copy()
    sortie[:, :, 3] = alpha
    return sortie


def detourer(recette: Recette, octets: bytes) -> np.ndarray:
    """L'étape 1, seule — parce que c'est la seule qui coûte cher.

    Mesuré le 27 août 2026 sur une image de 1024 px : 130 ms pour le détourage,
    28 ms pour les quatre étapes qui le suivent. Or ce sont ces quatre-là qu'on
    fait glisser. L'appelant garde donc ce tableau sous la main tant que les
    passes ne changent pas, et ne repaie que la queue.
    """
    rgba = _tableau(octets)
    for passe in recette.passes:
        rgba = _detourer(rgba, passe)
    return rgba


def finir(rgba: np.ndarray, recette: Recette) -> Rendu:
    """Les places 2 à 7, puis le PNG et ses dimensions."""
    fini = queue(rgba, recette)
    hauteur, largeur = fini.shape[:2]
    return Rendu(octets=_en_png(fini), largeur=largeur, hauteur=hauteur)


def queue(rgba: np.ndarray, recette: Recette) -> np.ndarray:
    """Les places 2 à 7, sur une image déjà détourée. Dans l'ordre, toujours.

    **Séparée de `finir` le 31 août 2026, et pour une raison qui n'est pas
    esthétique** : les mesures d'une table décrivent l'image *à un rang donné de
    la recette* — ce que le seuil des bords va couper se lit avant les bords, ce
    que la main a touché se lit avant la main. Elles ont donc besoin du tableau,
    pas du PNG, et le rouvrir depuis les octets aurait payé un encodage pour
    rien à chaque relecture de curseur.
    """
    if recette.recadrage is not None:
        rgba = _recadrer(rgba, recette.recadrage)

    if recette.grille is not None:
        # La case suit le détourage : avoir demandé une silhouette, c'est avoir
        # dit que ce qu'on traite est un sprite et qu'il vit dans une case.
        rgba = sur_grille(rgba, recette.grille, case=bool(recette.passes))

    if recette.quantification is not None:
        rgba = quantifier(rgba, recette.quantification)

    if recette.bords is not None:
        rgba = nettoyer(rgba, recette.bords)

    # Les deux places de E5. Le contour après les miettes et après les
    # couleurs ; la main après tout, y compris après lui.
    if recette.contours is not None:
        rgba = contourner(rgba, recette.contours)

    if recette.main is not None:
        rgba = retoucher(rgba, recette.main)

    return rgba


def appliquer(recette: Recette, octets: bytes) -> Rendu:
    """La recette, du début à la fin, dans l'ordre qui ne se négocie pas.

    Ne lève pas quand le détourage a tout mangé : elle rend l'image vide telle
    quelle. « Un détourage qui a mangé le sujet se voit immédiatement et se
    reprend avec d'autres réglages » (`docs/PLAN.md`, T2) — se voir suppose
    d'être rendu, pas d'être refusé.
    """
    return finir(detourer(recette, octets), recette)


# ── Le diagnostic ────────────────────────────────────────────────────────────


# En dessous, le profil ne se répète pas assez pour qu'on parle de grille. Seuil
# posé à la mesure : sur le corpus du 27 août 2026, les images franchement
# pixelisées montent à 0,45–0,92 et rien d'ambigu ne dépasse 0,35.
NETTETE_MINIMALE = 0.35


def mesurer_grille(octets: bytes, maximum: int = 64) -> tuple[int, float]:
    """Sur quelle grille le modèle a-t-il peint ? Le pas, et sa netteté.

    Mesure **descriptive, jamais prescriptive** : la cible du produit est
    demandée, jamais déduite de l'image reçue (US-61). Elle sert au banc, qui a
    besoin de chiffrer la dérive de grille d'un modèle à l'autre.

    Méthode : le contraste entre colonnes voisines se concentre sur les
    frontières de blocs ; on cherche donc la période de ce profil par
    autocorrélation, et on retient la **plus petite** période qui approche le
    maximum — sinon on rapporte une harmonique au lieu de la fondamentale.

    **Ce qu'elle sait faire, et ce qu'elle ne sait pas.** Confrontée le 27 août
    2026 aux jugements portés à l'œil sur le banc du 26, elle tombe juste sur les
    sujets fins (squelette, cadre : 8 px mesurés contre 6–8 jugés) et **prend une
    harmonique sur les plus grossiers** (potion : 17 px mesurés contre 30–37
    jugés). Elle situe donc un ordre de grandeur ; elle ne remplace pas l'œil, et
    aucun chiffre de dérive publié ne doit venir d'elle seule.

    Une première version cherchait, pour chaque pas candidat, la phase qui
    ramasse le plus de contraste. Elle est retirée : à grand pas, la phase
    retenue porte peu d'échantillons, son maximum est mécaniquement flatté, et
    la mesure répondait 40 à 64 px sur tout le corpus — c'est-à-dire le haut de
    sa propre plage de recherche, ce qui aurait dû l'alerter.
    """
    with Image.open(io.BytesIO(octets)) as image:
        gris = np.asarray(image.convert("L"), dtype=np.float64)

    profils = (
        np.abs(np.diff(gris, axis=1)).sum(axis=0),
        np.abs(np.diff(gris, axis=0)).sum(axis=1),
    )

    meilleur_pas, meilleure_nettete = 0, 0.0
    for profil in profils:
        pas, nettete = _periode(profil, min(maximum, profil.size // 4))
        if nettete > meilleure_nettete:
            meilleur_pas, meilleure_nettete = pas, nettete
    return meilleur_pas, round(meilleure_nettete, 3)


def _periode(profil: np.ndarray, maximum: int) -> tuple[int, float]:
    centre = profil - profil.mean()
    variance = float((centre * centre).mean())
    if variance == 0 or maximum < 2:
        return 0, 0.0

    correlations = {
        pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
        for pas in range(2, maximum + 1)
    }
    crete = max(correlations.values())
    if crete < NETTETE_MINIMALE:
        return 0, crete  # pas de grille franche — une réponse, pas un échec

    for pas in sorted(correlations):
        voisines = (correlations.get(pas - 1, -1.0), correlations.get(pas + 1, -1.0))
        if correlations[pas] >= 0.9 * crete and correlations[pas] >= max(voisines):
            return pas, correlations[pas]
    return max(correlations, key=correlations.__getitem__), crete
