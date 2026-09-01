# -*- coding: utf-8 -*-
"""Couper une planche en ses cases, **sans toucher à un seul pixel**.

**Pourquoi ce module existe.** Les rapports montraient jusqu'ici des animations
montées sur les silhouettes détourées, et le détourage abîme ce qu'on vient
juger : il grignote un pied, laisse des miettes blanches, coupe une barre de sol,
et rouvre à la main les cases dont le quadrillage a été redessiné. On finit par
juger le détourage au lieu de juger la marche.

Ici, on ne détoure pas. On se sert du détourage **uniquement pour trouver où
sont les cases**, puis **on découpe l'image d'origine** sur ces lignes-là. Ce qui
sort est exactement ce que le modèle a dessiné, fond compris.

**Comment les lignes de coupe sont trouvées**, et pourquoi pas autrement :

- pas par la grille demandée — les modèles ne la respectent pas : on a demandé
  trois colonnes sur trois lignes et reçu quatre sur deux ;
- pas par le gabarit envoyé — plusieurs modèles le recopient, le déplacent, ou
  remplissent une case qu'il ne dessinait pas ;
- **par les sujets eux-mêmes** : on les groupe en rangées et en colonnes, et on
  coupe à mi-chemin entre deux groupes voisins. C'est la seule méthode qui suive
  ce que le modèle a vraiment fait.

Toutes les cases sortent **à la même taille**, posées sur le même quadrillage :
sans ça, une case plus large de trois pixels ferait sautiller le personnage, et
on prendrait un défaut de découpe pour un défaut d'animation.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from atelier.domaine.recette import Passe, Recette  # noqa: E402
from atelier.image.decoupe import en_ordre_de_lecture, zones_opaques  # noqa: E402
from atelier.image.traitement import detourer  # noqa: E402

DETOURAGE = Recette(passes=(Passe(moteur="bord"),))
Boite = tuple[int, int, int, int]


def _groupes(valeurs: list[tuple[float, float]], ecart: float) -> list[tuple[float, float]]:
    """Regrouper des intervalles qui se suivent — les rangées, puis les colonnes.

    `valeurs` sont des couples (début, fin) sur un seul axe. Deux intervalles
    entrent dans le même groupe s'ils se chevauchent, ou si le vide entre eux est
    plus petit que `ecart`. Ce qui sort est l'étendue de chaque groupe.
    """
    groupes: list[list[float]] = []
    for debut, fin in sorted(valeurs):
        if groupes and debut <= groupes[-1][1] + ecart:
            groupes[-1][1] = max(groupes[-1][1], fin)
        else:
            groupes.append([debut, fin])
    return [(a, b) for a, b in groupes]


def _coupes(groupes: list[tuple[float, float]], bord: int) -> list[int]:
    """Les lignes de coupe : à mi-chemin entre deux groupes, et les deux bords.

    On coupe **entre** les sujets, jamais sur eux — un pied qui dépasse un peu
    reste avec son personnage.
    """
    lignes = [0]
    for (_, fin), (debut, _) in zip(groupes, groupes[1:]):
        lignes.append(int(round((fin + debut) / 2)))
    lignes.append(bord)
    return lignes


def _fond(image: Image.Image) -> tuple[int, int, int]:
    """La couleur du fond, prise aux quatre coins — pour combler sans inventer."""
    w, h = image.size
    coins = [image.getpixel(p)[:3] for p in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2))]
    return tuple(int(np.median([c[i] for c in coins])) for i in range(3))  # type: ignore[return-value]


def cases(octets: bytes) -> list[Image.Image]:
    """La planche coupée en ses cases, **pixels d'origine**, toutes à la même taille.

    Rend les cases dans l'ordre de lecture. Une liste vide si la planche ne porte
    pas assez de sujets pour qu'on devine sa grille.
    """
    image = Image.open(io.BytesIO(octets)).convert("RGB")
    largeur, hauteur = image.size

    rgba = detourer(DETOURAGE, octets)
    boites: list[Boite] = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    if len(boites) < 2:
        return []

    # **Une case pleine ne dit rien de la grille.** Quand le modèle a redessiné le
    # quadrillage, chaque « sujet » est la case entière : le regroupement marche
    # quand même, puisqu'on cherche justement les cases.
    larges = [b[2] - b[0] for b in boites]
    hauts = [b[3] - b[1] for b in boites]
    # **La tolérance ne sert qu'à absorber le bruit**, pas à rapprocher deux
    # colonnes voisines. Trop généreuse, elle fond toute la planche en une seule
    # case : les gouttières d'une grille font souvent moins d'un dixième de la
    # largeur d'un sujet, et un quart les avalerait.
    rangees = _groupes([(b[1], b[3]) for b in boites], ecart=float(np.median(hauts)) * 0.02)
    colonnes = _groupes([(b[0], b[2]) for b in boites], ecart=float(np.median(larges)) * 0.02)

    xs, ys = _coupes(colonnes, largeur), _coupes(rangees, hauteur)

    fond = _fond(image)

    # Chaque case découpée à son rectangle exact, et **la position de son sujet
    # dedans** : c'est elle qui servira à recaler, pas les bords du cadre.
    morceaux: list[Image.Image] = []
    dedans: list[tuple[int, int, int, int]] = []
    places: list[tuple[int, int]] = []
    for x0, y0, x1, y1 in boites:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        col = max(0, min(len(xs) - 2, sum(1 for x in xs[1:-1] if x <= cx)))
        rang = max(0, min(len(ys) - 2, sum(1 for y in ys[1:-1] if y <= cy)))
        gx, gy = xs[col], ys[rang]
        morceaux.append(image.crop((gx, gy, xs[col + 1], ys[rang + 1])))
        dedans.append((x0 - gx, y0 - gy, x1 - gx, y1 - gy))
        places.append((col, rang))

    # **Les rangées se recalent entre elles sur le sol de leurs sujets**, et les
    # colonnes sur leur milieu. C'est nécessaire parce que la première rangée
    # d'une planche porte la marge du haut et la dernière celle du bas : caler
    # sur les bords du cadre décalerait les personnages d'une rangée à l'autre,
    # et on prendrait ce décalage pour un saut.
    #
    # **Le décalage est le même pour toute une rangée.** Recaler chaque case sur
    # son propre sujet écraserait le balancement du corps — c'est très
    # exactement l'erreur que fait le recadrage du produit aujourd'hui, et elle
    # détruit l'animation avant qu'on ait pu la regarder.
    def _cale(axe: int, repere) -> dict[int, int]:
        """De combien décaler chaque colonne (axe 0) ou chaque rangée (axe 1).

        `repere` dit ce qui doit s'aligner : le milieu du sujet pour les
        colonnes, le bas du sujet pour les rangées. On prend la **médiane** du
        groupe, pas la moyenne : une case ratée ne doit pas déplacer les autres.
        """
        par_groupe: dict[int, list[float]] = {}
        for place, boite in zip(places, dedans):
            par_groupe.setdefault(place[axe], []).append(repere(boite))
        cible = max(float(np.median(v)) for v in par_groupe.values())
        return {g: int(round(cible - float(np.median(v)))) for g, v in par_groupe.items()}

    decal_x = _cale(0, lambda b: (b[0] + b[2]) / 2)
    decal_y = _cale(1, lambda b: b[3])

    largeur_t = max(decal_x[c] + m.width for (c, _), m in zip(places, morceaux))
    hauteur_t = max(decal_y[r] + m.height for (_, r), m in zip(places, morceaux))

    toiles: list[Image.Image] = []
    occupees: list[tuple[int, int, int, int]] = []
    for m, (col, rang), (bx0, by0, bx1, by1) in zip(morceaux, places, dedans):
        dx, dy = decal_x[col], decal_y[rang]
        toile = Image.new("RGB", (largeur_t, hauteur_t), fond)
        toile.paste(m, (dx, dy))
        toiles.append(toile)
        occupees.append((bx0 + dx, by0 + dy, bx1 + dx, by1 + dy))

    # **Une seule fenêtre pour toute la planche, et surtout pas une par case.**
    # Une grille de quatre colonnes sur deux lignes donne des cases deux fois
    # plus hautes que larges, aux trois quarts vides : on y perd le personnage.
    # On resserre donc sur ce que les sujets occupent **tous ensemble** — le
    # mouvement reste entier, puisque la fenêtre ne bouge pas d'une image à
    # l'autre.
    ax0 = min(o[0] for o in occupees)
    ay0 = min(o[1] for o in occupees)
    ax1 = max(o[2] for o in occupees)
    ay1 = max(o[3] for o in occupees)
    air = max(8, int(round(max(ax1 - ax0, ay1 - ay0) * 0.10)))
    fenetre = (
        max(0, ax0 - air), max(0, ay0 - air),
        min(largeur_t, ax1 + air), min(hauteur_t, ay1 + air),
    )
    return [t.crop(fenetre) for t in toiles]


if __name__ == "__main__":  # aperçu à l'œil, sans rien payer
    for nom in ("resultats_animation/bytedance-seed_seedream-4.5/jet2",
                "resultats_recette/C-guide-baton/jet1"):
        vues = cases((RACINE / f"{nom}.png").read_bytes())
        print(f"{nom} — {len(vues)} cases de {vues[0].size if vues else '—'}")
