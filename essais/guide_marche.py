# -*- coding: utf-8 -*-
"""Dessiner un cycle de marche juste — la référence visuelle que les mots ratent.

**Pourquoi ce fichier existe.** Le banc du 1ᵉʳ septembre 2026 a montré qu'aucun
modèle ne produit un cycle fiable, et qu'aucune formulation n'y change rien : on
lui a demandé mot pour mot *le corps monte aux étapes 4 et 8, le bras balance*,
et il n'a rien fait. **Les mots ne savent pas dire une chorégraphie.**

Une image, si. Ce module en dessine une, gratuitement, avec la géométrie d'un
vrai cycle de marche — c'est le **mannequin articulé de `docs/archive/essais-v3/etude-mannequin.md`
réduit à deux dimensions et à zéro euro**, et l'essayer maintenant dit s'il vaut
la peine de construire l'autre.

**La géométrie, et elle n'est pas décorative :**

1. **Le pied suit un vrai trajet.** Pendant l'appui il recule au sol à vitesse
   constante ; pendant le vol il repart en avant en se levant. C'est ce qui fait
   qu'un personnage avance au lieu de pédaler sur place.
2. **Le bassin monte et descend deux fois par cycle** — bas juste après le
   contact, haut au passage. C'est très exactement le balancement qui manquait à
   toutes les planches du banc.
3. **Le genou est calculé, pas dessiné à vue** : deux segments de longueur fixe,
   la position du genou se déduit de la hanche et du pied.
4. **Les bras balancent à l'opposé des jambes**, comme chez tout le monde.

Deux formes, parce que l'étude du mannequin demandait justement de les comparer :
le **bonhomme-bâton** (les articulations se lisent) et la **silhouette pleine**
(la masse se lit). Elles se fabriquent à partir du même squelette.
"""

from __future__ import annotations

import io
import math

from PIL import Image, ImageDraw

# Le fond et le trait du gabarit du produit, pour que le guide ait l'air d'être
# de la même famille que la planche vide qu'on envoie à côté.
FOND = (235, 235, 235)
TRAIT = (198, 198, 198)
OS = (40, 40, 46)
CHAIR = (120, 124, 132)
SOL = (170, 170, 176)


def _genou(
    hanche: tuple[float, float],
    pied: tuple[float, float],
    cuisse: float,
    tibia: float,
    sens: int,
) -> tuple[float, float]:
    """Où se plie la jambe — deux segments, une seule solution par côté.

    `sens` choisit de quel côté le genou sort : vers l'avant pour une jambe, ce
    qui est la seule chose qui distingue un genou d'un coude.
    """
    dx, dy = pied[0] - hanche[0], pied[1] - hanche[1]
    d = max(1e-6, math.hypot(dx, dy))
    # La jambe ne s'étire pas au-delà de sa longueur : on rapproche le pied.
    d = min(d, cuisse + tibia - 1e-3)
    a = (cuisse * cuisse - tibia * tibia + d * d) / (2 * d)
    h = math.sqrt(max(0.0, cuisse * cuisse - a * a))
    ux, uy = dx / max(1e-6, math.hypot(dx, dy)), dy / max(1e-6, math.hypot(dx, dy))
    bx, by = hanche[0] + ux * a, hanche[1] + uy * a
    return bx - uy * h * sens, by + ux * h * sens


# Les proportions d'un marcheur, en fractions de sa hauteur. `ADULTE` est le
# squelette d'origine ; `MICHEL` est relu sur le sprite promu le 2 septembre
# 2026 (E5, tour 2) : jambes courtes, grande capuche — le modèle avait allongé
# les jambes du personnage pour suivre la silhouette d'adulte.
ADULTE = {"jambe": 0.46, "foulee": 0.34, "lever": 0.09, "tronc": 0.30, "cou": 0.115, "rayon_tete": 0.062, "bras": 0.155, "avant_bras": 0.145}
MICHEL = {"jambe": 0.27, "foulee": 0.22, "lever": 0.06, "tronc": 0.36, "cou": 0.06, "rayon_tete": 0.16, "bras": 0.13, "avant_bras": 0.11}


def squelette(phase: float, h: float, proportions: dict | None = None) -> dict:
    """Les articulations d'un marcheur vu de côté, à un instant du cycle.

    `phase` va de 0 à 1 sur un cycle complet. `h` est la hauteur totale visée.
    Toutes les longueurs sont des fractions de `h` — le squelette se redessine
    donc à n'importe quelle taille sans qu'un chiffre change. `proportions`
    remplace les fractions d'`ADULTE` par celles d'un autre corps.
    """
    f = {**ADULTE, **(proportions or {})}
    p = phase * 2 * math.pi
    jambe = f["jambe"] * h
    cuisse, tibia = jambe * 0.52, jambe * 0.48
    foulee, lever = f["foulee"] * h, f["lever"] * h
    sol = h

    # **Le bassin monte et descend deux fois par cycle.** Bas au contact, haut au
    # passage : c'est le balancement, et c'est lui qu'on vient montrer.
    bob = 0.022 * h
    hanche_y = sol - jambe * 0.965 + bob * math.cos(2 * p)
    hanche_x = 0.0

    def pied(decalage: float) -> tuple[float, float]:
        q = (p + decalage) % (2 * math.pi)
        x = foulee / 2 * math.cos(q)
        # Appui : le pied reste au sol. Vol : il se lève et repart devant.
        y = sol if q <= math.pi else sol - lever * math.sin(q - math.pi)
        return x, y

    pied_g, pied_d = pied(0.0), pied(math.pi)
    hanche = (hanche_x, hanche_y)
    genou_g = _genou(hanche, pied_g, cuisse, tibia, +1)
    genou_d = _genou(hanche, pied_d, cuisse, tibia, +1)

    epaule = (hanche_x + 0.012 * h, hanche_y - f["tronc"] * h)
    tete = (epaule[0] + 0.01 * h, epaule[1] - f["cou"] * h - f["rayon_tete"] * h * 0.5)
    bras, avant = f["bras"] * h, f["avant_bras"] * h

    def main(decalage: float) -> tuple[tuple[float, float], tuple[float, float]]:
        # **Le bras balance à l'opposé de la jambe du même côté.**
        q = (p + decalage) % (2 * math.pi)
        angle = math.radians(26) * math.sin(q)
        coude = (epaule[0] + bras * math.sin(angle), epaule[1] + bras * math.cos(angle))
        pli = angle - math.radians(18) * (1 + math.sin(q))
        return coude, (coude[0] + avant * math.sin(pli), coude[1] + avant * math.cos(pli))

    coude_g, main_g = main(math.pi)
    coude_d, main_d = main(0.0)
    return {
        "sol": sol,
        "tete": tete,
        "rayon_tete": f["rayon_tete"] * h,
        "epaule": epaule,
        "hanche": hanche,
        "gauche": {"genou": genou_g, "pied": pied_g, "coude": coude_g, "main": main_g},
        "droite": {"genou": genou_d, "pied": pied_d, "coude": coude_d, "main": main_d},
    }


def _dessiner(d: ImageDraw.ImageDraw, s: dict, ox: float, oy: float, h: float, pleine: bool) -> None:
    # **Le squelette est calculé tourné vers la gauche, et dessiné en miroir.**
    # Le sujet du banc regarde à droite ; un guide qui marcherait dans l'autre
    # sens demanderait au modèle de retourner la pose en plus de la suivre —
    # deux choses au lieu d'une, et on ne saurait plus laquelle a échoué.
    def pt(p):
        return (ox - p[0], oy + p[1])

    def rond(centre, r):
        """Un disque autour d'un point. **Les bornes se remettent dans l'ordre**
        après le miroir : retourner l'image échange gauche et droite, et une
        boîte dont le bord droit passe à gauche n'est plus une boîte."""
        x, y = pt(centre)
        return [(x - r, y - r), (x + r, y + r)]

    epais = max(2, int(h * (0.055 if pleine else 0.028)))
    arriere, avant = (CHAIR, OS) if pleine else (CHAIR, OS)

    # La jambe et le bras du fond d'abord — l'ordre fait la profondeur.
    for cote, couleur in (("gauche", arriere), ("droite", avant)):
        m = s[cote]
        d.line([pt(s["hanche"]), pt(m["genou"]), pt(m["pied"])], fill=couleur, width=epais, joint="curve")
        d.line([pt(s["epaule"]), pt(m["coude"]), pt(m["main"])], fill=couleur, width=max(2, epais - 1), joint="curve")
        if cote == "droite":
            d.ellipse(rond(m["main"], epais), fill=couleur)

    if pleine:
        # Le tronc en masse : c'est la silhouette qu'on veut faire lire.
        larg = h * 0.085
        d.polygon(
            [pt((s["epaule"][0] - larg, s["epaule"][1])), pt((s["epaule"][0] + larg, s["epaule"][1])),
             pt((s["hanche"][0] + larg * 0.85, s["hanche"][1])), pt((s["hanche"][0] - larg * 0.85, s["hanche"][1]))],
            fill=OS,
        )
    else:
        d.line([pt(s["epaule"]), pt(s["hanche"])], fill=OS, width=epais + 1)

    d.ellipse(rond(s["tete"], s["rayon_tete"]), fill=OS)


def planche_guide(cases: int, colonnes: int, lignes: int, cote: int = 1024, pleine: bool = False) -> bytes:
    """Le cycle complet, une case par étape, dans la grille qu'on enverra.

    **La même grille que le gabarit**, exprès : le guide ne dit pas seulement
    *quelles poses*, il dit aussi *où les poser*. Les deux images se répondent au
    lieu de se contredire.
    """
    marge, gouttiere = 40, 24
    large = (cote - 2 * marge - gouttiere * (colonnes - 1)) // colonnes
    haut = (cote - 2 * marge - gouttiere * (lignes - 1)) // lignes
    image = Image.new("RGB", (cote, cote), FOND)
    d = ImageDraw.Draw(image)
    corps = min(large, haut) * 0.80
    for i in range(cases):
        c, l = i % colonnes, i // colonnes
        x0 = marge + c * (large + gouttiere)
        y0 = marge + l * (haut + gouttiere)
        d.rectangle([x0, y0, x0 + large, y0 + haut], outline=TRAIT, width=3)
        s = squelette(i / cases, corps)
        base_y = y0 + (haut + corps) / 2
        d.line([x0 + 8, base_y, x0 + large - 8, base_y], fill=SOL, width=2)
        _dessiner(d, s, x0 + large / 2, base_y - corps, corps, pleine)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def image_guide(phase: float, cote: int = 512, pleine: bool = True, proportions: dict | None = None) -> bytes:
    """**Une seule pose**, centrée sur le fond du produit, pieds sur une ligne de sol (E5).

    Ajoutée le 2 septembre 2026 pour l'essai de la pose imposée par image : là
    où `planche_guide` dessine le cycle entier dans la grille qu'on enverra,
    celle-ci n'en rend qu'un instant, pour un appel qui ne demande qu'une
    image. Le sol est à 10 % du bas ; le corps fait 80 % du côté. Le même
    squelette, le même dessin, le même sens de marche — vers la droite.
    """
    image = Image.new("RGB", (cote, cote), FOND)
    d = ImageDraw.Draw(image)
    corps = cote * 0.80
    sol_y = cote * 0.90
    d.line([cote * 0.08, sol_y, cote * 0.92, sol_y], fill=SOL, width=max(2, cote // 256))
    _dessiner(d, squelette(phase, corps, proportions), cote / 2, sol_y - corps, corps, pleine)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


if __name__ == "__main__":  # aperçu à l'œil, sans rien payer
    from pathlib import Path

    for nom, pleine in (("baton", False), ("silhouette", True)):
        for n, (c, l) in ((8, (3, 3)), (6, (3, 2)), (4, (2, 2))):
            chemin = Path(__file__).parent / f"guide_{nom}_{n}.png"
            chemin.write_bytes(planche_guide(n, c, l, pleine=pleine))
            print(chemin)
