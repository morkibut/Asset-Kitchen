# -*- coding: utf-8 -*-
"""Repeindre une zone : ce qui part au moteur, et le calque qu'on tire de ce qui revient (PX3).

CPU, pur, aucune entrée-sortie — le compagnon de `calque.py`. La recette est celle
que le banc PX1 a mesurée sur 48 tirages (`essais/banc_px1_zone.py`,
`docs/releve-usage.md` § 25 septembre 2026, point 1) : **0 pixel changé hors de
la zone, 0 pixel du sujet devenu transparent**. Elle vit ici, dans le produit,
et plus seulement dans un banc.

**Ce que le recollage sépare, en une phrase sans chiffre** : *un pixel de la zone
ne change que si le moteur y a peint autre chose que le fond ; un pixel que le
moteur a peint en fond n'est jamais touché* — transparent il reste transparent,
sujet il reste sujet. Il ne peut donc pas y avoir de trou.

**Et ce que le calque est** — *la pièce* : **tout ce que le moteur a peint dans
la zone**, qu'il ait changé ou non la couleur d'en dessous (PX9). Jamais par
`calque.differencier`, dont la tolérance au voisin de 3×3 absorbe une pièce qui
se substitue à ce qu'il y avait — un tee-shirt sur un torse nu, le défaut du
29 août 2026 que cette tranche existe pour fermer. Et plus seulement « ce qui a
changé » (PX3) : sur le sac à dos de Mara (26 septembre 2026), 78 pixels du sac
avaient gardé la couleur de la cape d'en dessous, et la pièce seule sortait
percée de 42 trous enclos. Posée sur son image on ne les voyait pas ; seule,
on ne voyait qu'eux.

**Déterministe par obligation** : la palette se lit par compte puis par valeur,
les couleurs neuves par la coupe médiane de Pillow (qui ne tire rien au sort), et
chaque pixel va à la couleur la plus proche, la première à égalité.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np
from PIL import Image

from atelier.domaine.recette import Difference, Trait
from atelier.image.calque import masque_de
from atelier.image.traitement import peindre

#: Un pixel que le moteur a rendu à moins de cette distance du fond (somme des
#: écarts des trois canaux) est du fond : le moteur n'y a rien peint. La valeur
#: du banc PX1, **revérifiée par PX9** sur la génération de Mara du 26 septembre
#: 2026 (relue, jamais modifiée) : des 605 pixels de la zone laissés vides, 580
#: sont à moins de 15 du fond et les 25 autres sont un liseré teinté du fond
#: autour du sac — les prendre (seuil 15) bordait la pièce de cyan. Aucun seuil
#: de 15 à 60 ne laisse un trou enclos dans la pièce ; 45 reste.
SEUIL_DU_FOND = 45

#: Au plus tant de couleurs de l'image d'en dessous servent de palette. Un sprite
#: en porte rarement plus ; au-delà, les plus rares tombent.
COULEURS_DU_CORPS_MAX = 64


@dataclass(frozen=True, slots=True)
class Recollage:
    """Ce qui revient d'un recollage : l'image recollée, le calque, et ce qu'on a
    compté. **Les nombres sont mesurés, jamais supposés** — la règle interdit un
    trou et un pixel hors zone ; on les compte quand même pour le vérifier."""

    image: np.ndarray
    calque: np.ndarray
    hors_zone: int
    trous: int
    changes: int
    zone: int
    couleurs_neuves: int
    palette: np.ndarray
    #: Ce que le moteur a peint dans la zone (PX9) — la pièce, en booléens.
    peint: np.ndarray | None = None

    def mesures(self) -> dict[str, int]:
        return {
            "pixels_hors_zone": self.hors_zone,
            "pixels_du_sujet_perdus": self.trous,
            "pixels_changes": self.changes,
            "pixels_de_la_zone": self.zone,
            "pixels_de_la_piece": int(self.peint.sum()) if self.peint is not None else self.changes,
            "couleurs_neuves": self.couleurs_neuves,
        }


# ── La zone ─────────────────────────────────────────────────────────────────


def masque_de_zone(forme: tuple[int, int], traits: Sequence[Trait]) -> np.ndarray:
    """La zone peinte, en booléens : les passages dans leur ordre, le dernier
    l'emporte — un passage de gomme retire ce qu'un passage de pinceau avait
    posé. Le même pinceau carré que la main (`traitement.pinceau`)."""
    return peindre(np.zeros(forme, dtype=bool), traits)


def masque_en_png(zone: np.ndarray) -> bytes:
    """La zone telle qu'elle part au moteur : un PNG en niveaux de gris, blanc
    pour repeindre, noir pour garder (PX2, `fournisseur.workflow.verifier_masque`)."""
    image = Image.fromarray(np.where(zone, 255, 0).astype(np.uint8), mode="L")
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def traits_depuis_masque(masque: np.ndarray) -> tuple[Trait, ...]:
    """Un masque en passages de pinceau d'un pixel, une suite horizontale à la
    fois. C'est ce qui laisse un agent donner une zone en image sans que la
    recette porte jamais d'image : elle garde des passages, comme à l'écran."""
    traits: list[Trait] = []
    for y in range(masque.shape[0]):
        ligne = masque[y]
        x = 0
        largeur = ligne.shape[0]
        while x < largeur:
            if not ligne[x]:
                x += 1
                continue
            debut = x
            while x < largeur and ligne[x]:
                x += 1
            fin = x - 1
            points = ((debut, y),) if fin == debut else ((debut, y), (fin, y))
            traits.append(Trait(garde=True, rayon=0, points=points))
    return tuple(traits)


def traits_depuis_rectangles(
    rectangles: Iterable[Sequence[int]], forme: tuple[int, int]
) -> tuple[Trait, ...]:
    """Des rectangles `[x0, y0, x1, y1]`, inclusifs aux deux bouts comme tout
    rectangle du produit, bornés au cadre au lieu de lever."""
    hauteur, largeur = forme
    masque = np.zeros(forme, dtype=bool)
    for r in rectangles:
        x0, y0, x1, y1 = (int(v) for v in r)
        x0, x1 = sorted((max(0, min(largeur - 1, x0)), max(0, min(largeur - 1, x1))))
        y0, y1 = sorted((max(0, min(hauteur - 1, y0)), max(0, min(hauteur - 1, y1))))
        masque[y0 : y1 + 1, x0 : x1 + 1] = True
    return traits_depuis_masque(masque)


# ── Le fond sous l'image partie ─────────────────────────────────────────────


def fond_de_la_toile(toile: bytes, corps: np.ndarray) -> str:
    """La couleur sur laquelle l'image est partie au moteur, lue **sur l'image
    partie** — là où l'image d'en dessous était transparente. Vide quand elle
    n'a aucun pixel transparent, ou quand la toile n'a pas sa taille : il n'y a
    alors pas de fond à reconnaître."""
    with Image.open(io.BytesIO(toile)) as image:
        rgb = np.asarray(image.convert("RGB"))
    vide = corps[..., 3] == 0
    if rgb.shape[:2] != corps.shape[:2] or not vide.any():
        return ""
    couleurs, comptes = np.unique(rgb[vide].reshape(-1, 3), axis=0, return_counts=True)
    r, v, b = (int(c) for c in couleurs[int(np.argmax(comptes))])
    return f"#{r:02x}{v:02x}{b:02x}"


def _rvb(hexa: str) -> np.ndarray | None:
    hexa = hexa.strip().lstrip("#")
    if len(hexa) != 6:
        return None
    try:
        return np.array([int(hexa[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.int32)
    except ValueError:
        return None


# ── Les couleurs ────────────────────────────────────────────────────────────


def palette_du_corps(corps: np.ndarray, maximum: int = COULEURS_DU_CORPS_MAX) -> np.ndarray:
    """Les couleurs opaques de l'image d'en dessous, **les plus portées d'abord**,
    à égalité dans l'ordre des valeurs — jamais dans l'ordre d'un ensemble."""
    opaques = corps[corps[..., 3] > 0][:, :3]
    if opaques.size == 0:
        return np.zeros((0, 3), dtype=np.int32)
    couleurs, comptes = np.unique(opaques.reshape(-1, 3), axis=0, return_counts=True)
    ordre = np.lexsort((couleurs[:, 2], couleurs[:, 1], couleurs[:, 0], -comptes))
    return couleurs[ordre][:maximum].astype(np.int32)


def couleurs_neuves(pixels: np.ndarray, nombre: int) -> np.ndarray:
    """Au plus `nombre` couleurs tirées de ce que le moteur a peint, par la coupe
    médiane de Pillow — celle que le dépôt emploie partout (`AGENTS.md`, règles
    durables), qui ne tire rien au sort."""
    if nombre <= 0 or pixels.size == 0:
        return np.zeros((0, 3), dtype=np.int32)
    bande = Image.fromarray(pixels.reshape(1, -1, 3).astype(np.uint8), mode="RGB")
    reduite = bande.quantize(colors=nombre, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    employes = sorted(set(np.asarray(reduite).reshape(-1).tolist()))
    plate = reduite.getpalette() or []
    return np.array([plate[i * 3 : i * 3 + 3] for i in employes], dtype=np.int32).reshape(-1, 3)


def au_plus_proche(pixels: np.ndarray, palette: np.ndarray) -> np.ndarray:
    """Chaque pixel à la couleur la plus proche de la palette — la première à
    égalité, donc toujours la même."""
    if palette.shape[0] == 0:
        return pixels.astype(np.uint8)
    # Par paquets : une grande zone sur une image de mille pixels de côté ferait
    # sinon un tableau d'écarts de plusieurs gigaoctets.
    sortie = np.empty((pixels.shape[0], 3), dtype=np.uint8)
    for debut in range(0, pixels.shape[0], 16384):
        paquet = pixels[debut : debut + 16384].astype(np.int64)
        ecarts = ((paquet[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2)
        sortie[debut : debut + 16384] = palette[np.argmin(ecarts, axis=1)]
    return sortie


# ── Le recollage ────────────────────────────────────────────────────────────


def ramener(revenu: np.ndarray, forme: tuple[int, int]) -> np.ndarray:
    """L'image du moteur ramenée à la grille de l'image d'en dessous — par la
    moyenne des pixels de chaque case (`BOX`), comme le banc PX1."""
    image = Image.fromarray(revenu[..., :3].astype(np.uint8), mode="RGB")
    if image.size != (forme[1], forme[0]):
        image = image.resize((forme[1], forme[0]), Image.BOX)
    return np.asarray(image).astype(np.int32)


def recoller(
    corps: np.ndarray,
    revenu: np.ndarray,
    zone: np.ndarray,
    fond: str = "",
    couleurs: int = 4,
) -> Recollage:
    """Le cœur de PX3. `corps` est l'image d'en dessous en RGBA, `revenu` ce que
    le moteur a rendu (n'importe quelle taille), `zone` la zone peinte sur
    `corps`, `fond` la couleur sur laquelle l'image est partie.

    1. Le retour est ramené à la grille du corps.
    2. Un pixel de la zone ne bouge que si le moteur y a peint autre chose que le
       fond ; les autres gardent exactement ce qu'ils étaient.
    3. Ce qui bouge prend la couleur la plus proche parmi celles du corps, plus
       au plus `couleurs` neuves tirées de ce que le moteur a peint.
    4. **Le calque est tout ce que le moteur a peint** (PX9), rangé sur la
       palette — y compris un pixel revenu à la couleur qu'il avait déjà.
    """
    forme = corps.shape[:2]
    ramene = ramener(revenu, forme)
    rvb_fond = _rvb(fond)
    if rvb_fond is None:
        peint = zone.copy()
    else:
        peint = zone & (np.abs(ramene - rvb_fond[None, None, :]).sum(axis=2) >= SEUIL_DU_FOND)

    a_peindre = ramene[peint]
    palette_corps = palette_du_corps(corps)
    neuves = couleurs_neuves(a_peindre, couleurs)
    palette = np.concatenate([palette_corps, neuves]) if neuves.size else palette_corps
    rangees = au_plus_proche(a_peindre, palette) if a_peindre.size else a_peindre.astype(np.uint8)

    image = corps.copy()
    image[peint, :3] = rangees
    image[peint, 3] = 255

    change = np.any(image != corps, axis=2)
    calque = np.zeros_like(corps)
    calque[peint] = image[peint]

    connues = {tuple(c) for c in palette_corps.tolist()}
    employees = {tuple(c) for c in rangees.reshape(-1, 3).tolist()} if rangees.size else set()
    return Recollage(
        image=image,
        calque=calque,
        hors_zone=int(np.sum(change & ~zone)),
        trous=int(np.sum((corps[..., 3] > 0) & (image[..., 3] == 0))),
        changes=int(change.sum()),
        zone=int(zone.sum()),
        couleurs_neuves=len(employees - connues),
        palette=palette,
        peint=peint,
    )


# ── Le calque, et la main par-dessus ────────────────────────────────────────


def calque_de_zone(
    corps: np.ndarray, revenu: np.ndarray, difference: Difference
) -> tuple[np.ndarray, Recollage]:
    """Le calque d'une zone repeinte, **avec la main de C4 par-dessus** — la
    même que sur un calque d'équipement (`calque.differencier`), dans le même
    ordre : le masque (rectangle et `affinage`) *restreint* ce que le recollage
    a changé, puis la `retouche` *tranche* — elle ôte, ou elle ramène un pixel
    que le recollage n'avait pas pris (un trait que le moteur a peint près du
    fond), à la couleur que le moteur y a mise, rangée sur la même palette.

    **Sous un pixel transparent de la zone, c'est la couleur du moteur qui
    reste dans le tableau** (PX9), rangée sur la même palette : la main de la
    huitième place (`retoucher`, *remettre*) — celle que la retouche ouvre sur
    n'importe quelle image — **ramène donc un pixel de l'image du moteur**, et
    jamais la couleur de l'image d'en dessous. Hors de la zone, rien.
    """
    forme = corps.shape[:2]
    zone = masque_de_zone(forme, difference.zone_peinte)
    r = recoller(corps, revenu, zone, difference.fond, difference.couleurs)
    garde = r.peint.copy() if r.peint is not None else np.any(r.image != corps, axis=2)
    borne = masque_de(forme, difference)
    if borne is not None:
        garde &= borne
    finale = peindre(garde, difference.retouche)
    calque = r.image.copy()
    sous = (zone | finale) & ~garde
    if sous.any():
        calque[sous, :3] = au_plus_proche(ramener(revenu, forme)[sous], r.palette)
    calque[~zone & ~finale] = 0
    calque[..., 3] = np.where(finale, 255, 0).astype(calque.dtype)
    return calque, r


def emplacement_propose(corps: np.ndarray, zone: np.ndarray) -> str:
    """Où la pièce s'accroche, **proposé d'après la zone** (PX9) — une
    proposition que l'auteur corrige, jamais une déduction. Lu sur la
    silhouette de l'image d'en dessous : le haut du corps est la tête, le bas
    les jambes ; au milieu, une zone décentrée sur le côté du corps pend
    derrière (le dos — le sac de Mara, vue de profil), une zone centrée
    habille (le torse). Les mots sont ceux que l'atelier propose déjà
    (`EMPLACEMENTS_PROPOSES`)."""
    if not zone.any():
        return "le corps"
    opaque = corps[..., 3] > 0
    lignes = np.flatnonzero(opaque.any(axis=1))
    haut, bas = (int(lignes[0]), int(lignes[-1])) if lignes.size else (0, corps.shape[0] - 1)
    ys = np.flatnonzero(zone.any(axis=1))
    centre = (ys[0] + ys[-1]) / 2
    rang = (centre - haut) / max(1, bas - haut)
    if rang < 0.2:
        return "la tête"
    if rang > 0.62:
        return "les jambes"
    rangs = slice(int(ys[0]), int(ys[-1]) + 1)
    colonnes_corps = np.flatnonzero(opaque[rangs].any(axis=0))
    colonnes_zone = np.flatnonzero(zone.any(axis=0))
    if colonnes_corps.size == 0:
        return "le dos"
    gauche, droite = int(colonnes_corps[0]), int(colonnes_corps[-1])
    ecart = abs((colonnes_zone[0] + colonnes_zone[-1]) / 2 - (gauche + droite) / 2)
    return "le dos" if ecart > 0.2 * max(1, droite - gauche) else "le torse"


def image_entiere(corps: np.ndarray, calque: np.ndarray) -> np.ndarray:
    """L'image d'en dessous avec la pièce posée dessus (PX9) — ce que devient le
    résultat quand on en fait **une nouvelle version de la pose**. Un pixel que
    la pièce ne porte pas garde exactement celui d'en dessous."""
    sortie = corps.copy()
    pose = calque[..., 3] > 0
    sortie[pose] = calque[pose]
    return sortie
