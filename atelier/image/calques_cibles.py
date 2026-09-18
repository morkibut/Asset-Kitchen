"""Composition CPU des masques de calque, du corps et des morceaux dessous.

Les masques locaux suivent la même transformation que leurs pixels. Une épée
peut donc passer derrière la main et devant le torse, même en vue 3/4.
"""
from __future__ import annotations

import io
import math
from dataclasses import dataclass

import numpy as np
from PIL import Image

from atelier.domaine.calques_cibles import PlacementCalque
from atelier.domaine.recette import traits_depuis_json
from atelier.image.traitement import _reduire as reduire_pixels
from atelier.image.traitement import peindre


def png(image: np.ndarray | Image.Image) -> bytes:
    tampon = io.BytesIO()
    (image if isinstance(image, Image.Image) else Image.fromarray(image)).save(tampon, format="PNG")
    return tampon.getvalue()


def rgba(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.array(image.convert("RGBA"))


def couches(base: np.ndarray, calque: np.ndarray, placement: PlacementCalque, masques: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Rend dessous, corps masqué, dessus dans un cadre et un repère communs."""
    propre = calque.copy()
    garde = peindre(np.ones(calque.shape[:2], dtype=bool), traits_depuis_json(masques.get("calque")))
    propre[~garde] = 0
    derriere = peindre(np.full(calque.shape[:2], not placement.devant, dtype=bool), traits_depuis_json(masques.get("derriere")))
    sous, dessus = propre.copy(), propre.copy()
    sous[~derriere] = 0
    dessus[derriere] = 0
    corps = base.copy()
    garde_corps = peindre(np.ones(base.shape[:2], dtype=bool), traits_depuis_json(masques.get("corps")))
    corps[~garde_corps] = 0

    def transformer(image: np.ndarray) -> np.ndarray:
        h, w = base.shape[:2]
        ch, cw = image.shape[:2]
        angle = math.radians(placement.rotation)
        c, s = math.cos(angle) / placement.echelle, math.sin(angle) / placement.echelle
        cx, cy = w / 2 + placement.dx, h / 2 + placement.dy
        # Transformation inverse : aucun tampon agrandi de 8192 × échelle.
        transforme = Image.fromarray(image).transform((w, h), Image.Transform.AFFINE,
            (c, s, cw / 2 - c * cx - s * cy, -s, c, ch / 2 + s * cx - c * cy),
            Image.Resampling.NEAREST)
        resultat = np.array(transforme)
        resultat[:, :, 3] = np.rint(resultat[:, :, 3] * placement.opacite).astype(np.uint8)
        return resultat

    return transformer(sous), corps, transformer(dessus)


def composer(base: np.ndarray, calque: np.ndarray, placement: PlacementCalque, masques: dict) -> bytes:
    sous, corps, dessus = couches(base, calque, placement, masques)
    resultat = Image.alpha_composite(Image.fromarray(sous), Image.fromarray(corps))
    return png(Image.alpha_composite(resultat, Image.fromarray(dessus)))


# ── Ramener l'image équipée sur le corps de sa pose ─────────────────────────
#
# **Le défaut que ceci répare, relevé sur le disque de l'auteur le 18 septembre
# 2026** : la pose « repos · est » de Champy sortait à 221 × 451 de sa recette
# (détourage, recadrage, couleurs), et l'image équipée arrivait telle que le
# modèle l'avait rendue — 1024 × 1024, fond compris. Comparer les deux revenait
# à comparer un corps à une affiche : le calage partait de 0,22 et la
# différence gardait le rectangle entier.
#
# Appliquer la recette de la pose ne suffit pas : un recadrage à marge nulle
# rend une image **à la résolution de ce qu'on lui donne**, donc 934 × 567 pour
# la planche et 451 × 221 pour la pose. Ce qui manque est l'échelle du corps,
# et elle se mesure ici : on cherche le facteur et la place qui font le mieux
# retomber la silhouette équipée sur la silhouette de la pose, et l'image
# ressort **dans le cadre de la pose**. L'extraction repart alors d'une échelle
# de 1 et d'un décalage nul, ce qui est la seule chose que l'auteur attend.

SEUIL_OPAQUE = 128
# La recherche grossière se fait sur un cadre réduit, comme le recalage de C3 ;
# l'affinage sur un cadre moyen ; la place finale, au pixel près.
COTE_GROSSIER = 128
COTE_MOYEN = 384


@dataclass(frozen=True, slots=True)
class Ramene:
    """L'image équipée dans le cadre de la pose, et ce qu'il a fallu pour l'y mettre."""

    image: np.ndarray
    echelle: float
    x: int  # coin haut-gauche de l'image mise à l'échelle, dans le cadre de la pose
    y: int
    accord: float  # recouvrement rapporté à l'union des deux silhouettes, 0 à 1
    # La part de l'image équipée qui tombe hors du cadre de la pose, 0 à 1. Le
    # calque vit dans ce cadre (AU15) : ce qui dépasse sera coupé, et un bâton
    # levé au-dessus de la tête se perd sans un mot si on ne le compte pas.
    dehors: float = 0.0
    # **Ce qui dépasse, en pixels, et de quel côté** — `(gauche, haut, droite,
    # bas)`, mesuré sur la partie opaque. C'est ce que l'écrin du personnage doit
    # gagner pour que rien ne soit coupé (18 septembre 2026).
    debord: tuple[int, int, int, int] = (0, 0, 0, 0)
    # L'image entière, sur le cadre de la pose **agrandi du débord** : son coin
    # haut-gauche est à `(-gauche, -haut)` dans le cadre de la pose. Sans débord,
    # c'est `image` elle-même.
    etendue: np.ndarray | None = None


def _masque(rgba_: np.ndarray, facteur: float = 1.0) -> np.ndarray:
    alpha = rgba_[:, :, 3]
    if facteur != 1.0:
        h, w = alpha.shape
        taille = (max(1, round(w * facteur)), max(1, round(h * facteur)))
        alpha = np.asarray(Image.fromarray(alpha).resize(taille, Image.Resampling.BOX))
    return alpha >= SEUIL_OPAQUE


def _meilleure_place(corps: np.ndarray, revenu: np.ndarray) -> tuple[float, int, int]:
    """Le recouvrement sur l'union, et la place du coin du revenu qui le maximise.

    **Toutes les places d'un coup**, par corrélation en Fourier sur des tableaux
    assez grands pour qu'aucune place ne se replie sur une autre. Le revenu peut
    déborder du cadre : ce qui sort compte dans l'union, donc une place qui jette
    le corps dehors perd d'elle-même.
    """
    hb, wb = corps.shape
    hs, ws = revenu.shape
    aire_b, aire_s = float(corps.sum()), float(revenu.sum())
    if not aire_b or not aire_s:
        return 0.0, 0, 0
    forme = (hb + hs, wb + ws)
    recouvrement = np.fft.irfft2(
        np.fft.rfft2(corps.astype(np.float32), forme)
        * np.conj(np.fft.rfft2(revenu.astype(np.float32), forme)),
        forme,
    )
    accord = recouvrement / np.maximum(aire_b + aire_s - recouvrement, 1.0)
    plat = int(np.argmax(accord))
    y, x = divmod(plat, forme[1])
    # Les grands indices sont des places négatives : le coin du revenu au-dessus
    # ou à gauche du cadre.
    y = y - forme[0] if y >= hb else y
    x = x - forme[1] if x >= wb else x
    return float(accord.flat[plat]), int(y), int(x)


def _redimensionner(rgba_: np.ndarray, echelle: float, methode: str | None = None) -> np.ndarray:
    if echelle == 1.0:
        return rgba_
    h, w = rgba_.shape[:2]
    taille = (max(1, round(w * echelle)), max(1, round(h * echelle)))
    image = Image.fromarray(rgba_, "RGBA")
    if echelle < 1 and methode:
        # **La réduction de la grille de la pose**, quand elle en a une : la
        # pose a été ramenée à ses carrés par cette méthode-là, et une moyenne
        # ici fabriquerait des teintes de bord que la pose n'a nulle part.
        return np.asarray(reduire_pixels(image, taille, methode))
    # Sans grille, réduire moyenne la surface — le plus proche voisin perdrait
    # un pixel de contour sur deux, et le contour est ce que la différence lit ;
    # agrandir garde les blocs d'un sprite.
    return np.asarray(image.resize(taille, Image.Resampling.BOX if echelle < 1 else Image.Resampling.NEAREST))


def aux_couleurs_de(pixels: np.ndarray, base: np.ndarray, tolerance: int = 40) -> np.ndarray | None:
    """Les couleurs proches de celles de la pose y sont ramenées ; les autres restent.

    **La palette est celle que la pose porte réellement** — ses couleurs
    opaques, après sa propre recette —, et non la liste écrite dans sa recette :
    c'est la même chose quand la palette est fixée, et la seule lecture possible
    quand elle est « déduite de l'image ».

    **Une couleur que la pose n'a pas n'est pas corrigée** : c'est celle de la
    pièce qu'on vient chercher. Ramener le bois d'un bâton au plus proche rouge
    du chapeau — ce que fait une quantification ordinaire — rendait un bâton
    rouge, vu sur l'atelier jetable avant d'être écrit ici.

    `None` quand la pose porte trop de couleurs pour en faire une palette : une
    image HD n'en a pas, et la ramener à 256 teintes serait un effet de plus.
    """
    opaques = base[:, :, 3] >= SEUIL_OPAQUE
    palette = np.unique(base[opaques][:, :3], axis=0).astype(np.int16)
    if not len(palette) or len(palette) > 256:
        return None
    sortie = pixels.copy()
    visibles = sortie[:, :, 3] > 0
    # Couleur par couleur, pas pixel par pixel : un sprite en porte quelques
    # centaines, et la table des écarts reste petite quelle que soit sa taille.
    distinctes, inverse = np.unique(sortie[visibles][:, :3], axis=0, return_inverse=True)
    distinctes = distinctes.astype(np.int16)
    ecarts = np.abs(distinctes[:, None, :] - palette[None, :, :]).max(axis=2)
    plus_proche = ecarts.argmin(axis=1)
    proches = ecarts[np.arange(len(distinctes)), plus_proche] <= tolerance
    distinctes[proches] = palette[plus_proche[proches]]
    rangees = sortie[visibles]
    rangees[:, :3] = distinctes[inverse.reshape(-1)].astype(np.uint8)
    sortie[visibles] = rangees
    return sortie


def couleur_du_fond(rgb: np.ndarray) -> np.ndarray:
    """La médiane des quatre bordures — la même lecture que le détourage par le bord."""
    bordure = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]], axis=0)
    return np.median(bordure.astype(np.int16), axis=0)


def sans_poches_de_fond(pixels: np.ndarray, base: np.ndarray, fond: np.ndarray, tolerance: int = 28) -> tuple[np.ndarray, int]:
    """Le fond enfermé entre la pièce et le corps, retiré — **hors du corps seulement**.

    Le détourage par le bord ne retire que le fond relié au bord : c'est ce qui
    garde le blanc d'un œil. Mais un bâton tenu contre le corps enferme une
    poche de fond entre eux, que rien ne relie au bord, et la différence la
    prend pour de la pièce — vu sur l'atelier jetable, une bande rose collée au
    bâton. Là où la pose n'a pas de corps, un pixel de la couleur du fond ne
    peut être que du fond : il part. Là où elle en a un, il reste — c'est peut-être
    un œil.
    """
    hors_du_corps = base[:, :, 3] < SEUIL_OPAQUE
    proche = np.abs(pixels[:, :, :3].astype(np.int16) - fond).max(axis=2) <= tolerance
    retirer = hors_du_corps & proche & (pixels[:, :, 3] > 0)
    sortie = pixels.copy()
    sortie[retirer] = 0
    return sortie, int(retirer.sum())


def ramener_sur(base: np.ndarray, source: np.ndarray, *, methode: str | None = None) -> Ramene | None:
    """L'image équipée, mise à l'échelle et posée pour que son corps tombe sur la pose.

    `None` quand l'une des deux n'a aucun pixel opaque : il n'y a pas de corps
    à retrouver, et l'appelant garde l'image telle quelle en le disant.

    **La plage d'échelles part des deux boîtes, et contient son hypothèse
    nulle** (`docs/PIEGES.md`, la plage qui enjambe 1,00). L'objet ajouté ne peut
    qu'agrandir la boîte de l'image équipée : le rapport des boîtes est donc une
    borne *basse* du vrai facteur, et on cherche au-dessus. Le facteur 1 y entre
    toujours quand il est plausible — deux images au même cadre doivent se
    retrouver exactement, sans rééchantillonnage d'un centième.
    """
    corps, revenu = _masque(base), _masque(source)
    boite_b, boite_s = _boite(corps), _boite(revenu)
    if boite_b is None or boite_s is None:
        return None
    hb, wb = boite_b[3] - boite_b[1], boite_b[2] - boite_b[0]
    hs, ws = boite_s[3] - boite_s[1], boite_s[2] - boite_s[0]
    bas = max(hb / hs, wb / ws)

    def candidates(centre_bas: float, centre_haut: float, nombre: int) -> list[float]:
        valeurs = set(np.geomspace(centre_bas, centre_haut, nombre).tolist()) | {bas}
        if centre_bas <= 1.0 <= centre_haut:
            valeurs.add(1.0)
        return sorted(valeurs)

    def chercher(echelles: list[float], cote: int) -> tuple[float, float]:
        facteur = min(1.0, cote / max(corps.shape))
        petit_corps = _masque(base, facteur)
        meilleur = (-1.0, 1.0)
        for echelle in echelles:
            petit = _masque(source, echelle * facteur)
            accord, _, _ = _meilleure_place(petit_corps, petit)
            # À accord égal, l'échelle qui bouge le moins.
            if accord > meilleur[0] + 1e-6 or (
                abs(accord - meilleur[0]) <= 1e-6 and abs(echelle - 1) < abs(meilleur[1] - 1)
            ):
                meilleur = (accord, echelle)
        return meilleur

    _, grossiere = chercher(candidates(bas * 0.9, bas * 2.5, 48), COTE_GROSSIER)
    _, fine = chercher(candidates(grossiere * 0.95, grossiere * 1.05, 21), COTE_MOYEN)
    image = _redimensionner(source, fine, methode)
    opaque_image = _masque(image)
    accord, y, x = _meilleure_place(corps, opaque_image)
    hb, wb = base.shape[:2]
    # Le débord se mesure sur ce qui est opaque : un liseré à demi transparent
    # laissé par la réduction ne demande pas qu'on agrandisse un cadre.
    boite = _boite(opaque_image)
    if boite is None:
        debord = (0, 0, 0, 0)
    else:
        debord = (max(0, -(x + boite[0])), max(0, -(y + boite[1])),
                  max(0, x + boite[2] - wb), max(0, y + boite[3] - hb))
    g, h, d, b = debord
    cadre = Image.new("RGBA", (wb + g + d, hb + h + b), (0, 0, 0, 0))
    cadre.paste(Image.fromarray(image, "RGBA"), (x + g, y + h))
    etendue = np.array(cadre)
    total = int(opaque_image.sum())
    dedans = int((etendue[h:h + hb, g:g + wb, 3] >= SEUIL_OPAQUE).sum())
    dehors = max(0.0, 1.0 - dedans / total) if total else 0.0
    # **Un sprite a une silhouette tranchée, et on la lui rend** : la réduction a
    # moyenné le bord, et un demi-alpha passerait pour « ajouté » à un seuil et
    # pas à l'autre. Une pose au bord doux (une image HD) garde le sien.
    if np.isin(base[:, :, 3], (0, 255)).all():
        opaque = etendue[:, :, 3] >= SEUIL_OPAQUE
        etendue[:, :, 3] = np.where(opaque, 255, 0).astype(np.uint8)
        etendue[~opaque, :3] = 0
    pixels = np.ascontiguousarray(etendue[h:h + hb, g:g + wb])
    return Ramene(image=pixels, echelle=float(fine), x=x, y=y, accord=float(accord), dehors=dehors,
                  debord=debord, etendue=etendue)


# ── L'écrin : le cadre commun d'un personnage qui porte ses pièces ──────────
#
# **Le défaut que ceci répare, relevé sur le disque de l'auteur le 18
# septembre 2026** : la pose « repos · est » de Champy est recadrée à marge
# nulle, donc son cadre est exactement son corps (221 × 451). Un bâton tenu à
# côté du corps en sort forcément, et le calque, qui vit dans ce cadre, le
# coupait.
#
# **Le cadre grandit, rien n'est coupé.** L'écrin se mesure *depuis le repère*
# (le pied) : combien de pixels à gauche, à droite, au-dessus et au-dessous du
# point où le personnage touche le sol. Chaque image du personnage — toutes ses
# poses, toutes ses directions, chaque frame de ses animations — est rembourrée
# de transparent pour que son repère tombe au même point d'un cadre de même
# taille. Le corps ne bouge donc jamais par rapport au sol, et un seul pivot
# vaut pour toute la tenue dans Godot.
#
# **Symétrique en largeur, autour du repère.** Un personnage vu d'est se
# retourne en ouest dans le jeu (`flip_h`) : Godot retourne la texture dans son
# rectangle, et seul un repère au milieu de la largeur garde les pieds au même
# endroit. Le prix : la place que le bâton demande à droite est aussi prise à
# gauche, en transparent.
#
# **Des nombres pairs.** Le rembourrage ne rééchantillonne rien, donc il ne
# touche jamais à la grille de pixels d'une pose (une pose sur grille a un pixel
# par case) ; le pair garde le milieu du cadre sur une frontière de pixel.

PAS_DE_L_ECRIN = 2


@dataclass(frozen=True, slots=True)
class Ecrin:
    """Le cadre commun, en pixels comptés depuis le repère."""

    cote: int  # de chaque côté du repère, en largeur
    haut: int  # au-dessus du repère
    bas: int = 0  # au-dessous — zéro tant que rien ne passe sous les pieds

    @property
    def largeur(self) -> int:
        return 2 * self.cote

    @property
    def hauteur(self) -> int:
        return self.haut + self.bas

    def en_json(self) -> dict[str, int]:
        return {"cote": self.cote, "haut": self.haut, "bas": self.bas,
                "largeur": self.largeur, "hauteur": self.hauteur}

    @staticmethod
    def depuis_json(d: dict) -> Ecrin:
        return Ecrin(int(d["cote"]), int(d["haut"]), int(d.get("bas", 0)))


def etendue(largeur: int, hauteur: int, repere_x: float, repere_y: float,
            debord: tuple[int, int, int, int] = (0, 0, 0, 0)) -> tuple[float, float, float, float]:
    """Ce qu'une image occupe autour de son repère : `(gauche, haut, droite, bas)`.

    Le débord s'ajoute du côté où il sort. Un repère posé hors de l'image ne
    rend jamais une étendue négative.
    """
    g, h, d, b = debord
    return (max(0.0, repere_x + g), max(0.0, repere_y + h),
            max(0.0, largeur - repere_x + d), max(0.0, hauteur - repere_y + b))


def _au_pas(valeur: float, pas: int) -> int:
    return int(math.ceil(valeur / pas - 1e-9)) * pas


def ecrin_pour(etendues: list[tuple[float, float, float, float]], pas: int = PAS_DE_L_ECRIN,
               depuis: Ecrin | None = None) -> Ecrin:
    """Le plus petit écrin qui contient toutes les étendues — et l'ancien.

    **Il ne rétrécit jamais** : un cadre qui rapetisse couperait ce qu'on y a
    déjà posé, et changerait sous les pieds d'une tenue déjà livrée.
    """
    cote = max([max(e[0], e[2]) for e in etendues] + [depuis.cote if depuis else 0])
    haut = max([e[1] for e in etendues] + [depuis.haut if depuis else 0])
    bas = max([e[3] for e in etendues] + [depuis.bas if depuis else 0])
    return Ecrin(_au_pas(cote, pas), _au_pas(haut, pas), _au_pas(bas, pas))


def rembourrage(largeur: int, hauteur: int, repere_x: float, repere_y: float,
                ecrin: Ecrin) -> tuple[int, int, int, int]:
    """Ce qu'il faut ajouter autour d'une image pour que son repère tombe sur celui de l'écrin.

    `(gauche, haut, droite, bas)`. Un nombre négatif dit que l'image est plus
    grande que l'écrin de ce côté — l'écrin est alors à agrandir, jamais
    l'image à couper. Un repère au demi-pixel (une largeur impaire) tombe au
    demi-pixel près : on arrondit vers la gauche et vers le haut.
    """
    gauche = math.floor(ecrin.cote - repere_x)
    haut = math.floor(ecrin.haut - repere_y)
    return gauche, haut, ecrin.largeur - largeur - gauche, ecrin.hauteur - hauteur - haut


def rembourrer(pixels: np.ndarray, gauche: int, haut: int, droite: int, bas: int) -> np.ndarray:
    """Du transparent autour — une translation pure, aucun pixel touché."""
    if not (gauche or haut or droite or bas):
        return pixels
    return np.pad(pixels, ((haut, bas), (gauche, droite), (0, 0)), constant_values=0)


def poser_dans(pixels: np.ndarray, largeur: int, hauteur: int, x: int, y: int) -> np.ndarray:
    """L'image posée à `(x, y)` dans un cadre transparent de `largeur × hauteur`."""
    cadre = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    h, w = pixels.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(largeur, x + w), min(hauteur, y + h)
    if x1 > x0 and y1 > y0:
        cadre[y0:y1, x0:x1] = pixels[y0 - y:y1 - y, x0 - x:x1 - x]
    return cadre


def _boite(masque: np.ndarray) -> tuple[int, int, int, int] | None:
    """Boîte exclusive `(x0, y0, x1, y1)` — elle ne sert qu'à mesurer des côtés."""
    lignes = np.flatnonzero(masque.any(axis=1))
    colonnes = np.flatnonzero(masque.any(axis=0))
    if lignes.size == 0 or colonnes.size == 0:
        return None
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]) + 1, int(lignes[-1]) + 1
