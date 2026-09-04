# -*- coding: utf-8 -*-
"""Le banc d'`A5` — **le contour qui bout, mesuré avant et après**.

Écrit le 4 septembre 2026 avec la tranche. Il existe parce que le cinquième
critère d'`A5` le demande en toutes lettres : *comparé avant/après sur une bande
du banc, avec le chiffre écrit*. Un réglage qui prétend calmer une animation sans
banc pour le rejouer est invérifiable au premier doute.

## Pourquoi une bande fabriquée ici, et pas un vrai clip

Sur un vrai clip on ne saurait pas dire si le bord change parce que le sujet
bouge ou parce que la réduction grésille — et c'est très exactement la
confusion que la mesure ne sait pas lever toute seule. Le sujet de ce banc est
donc **rigide** : il ne se déforme jamais, il **glisse d'un tiers de bloc par
image**. Tout ce qui change dans sa silhouette au-delà de ce glissement est du
grésillement, et rien d'autre.

Il porte un **dégradé** — sans quoi la palette n'aurait aucun choix à faire et
le second chiffre ne dirait rien — et un **grain léger**, différent à chaque
image, comme en laisse toute vidéo compressée. C'est ce grain qui fait diverger
la coupe médiane d'une image à l'autre.

## Ce qu'il compare

| | Ce que ça fait |
|---|---|
| **avant** | la chaîne d'avant `A5` : silhouette tirée au sort image par image, palette recalculée à chaque image |
| **après** | la chaîne d'aujourd'hui : silhouette au vote de majorité, palette décidée une fois pour la bande |

⚠️ **Le chiffre à lire est le premier — le bord qui revient sur ses pas.** Le
second, le bord qui change, mélange le grésil au mouvement, et le mouvement pèse
si lourd qu'il enterre le reste : sur ce même banc il ne bouge que de 6 % là où
le premier baisse de près de moitié. Il est imprimé quand même, parce qu'un banc
qui cacherait la mesure qui ne dit rien ne serait plus honnête.

⚠️ L'*avant* est joué **par le produit lui-même**, par un drapeau que ce banc est
seul à poser. Un banc qui recopierait l'ancienne chaîne mesurerait sa propre
copie, et il finirait par affirmer un gain qui n'existe plus.

**Il ne coûte rien** : aucune clé, aucun appel, aucune carte graphique. Les
images sont fabriquées sur place, et tout le reste est du processeur.

    Lancer :  py essais/essai_stabilite_bande.py
              py essais/essai_stabilite_bande.py --images 12 --cible 48

Sortie : ce journal, et `essais/mesures_stabilite_bande.json`.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

import numpy as np

RACINE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from atelier.domaine.recette import (  # noqa: E402
    AU_PLUS_PROCHE,
    Grille,
    Passe,
    Quantification,
    Recette,
)
from atelier.image.bande import (  # noqa: E402
    assembler,
    fenetre_commune,
    preparer,
)
from atelier.image.bande import en_png  # noqa: E402

SORTIE = RACINE / "essais" / "mesures_stabilite_bande.json"

# La toile du « clip » fabriqué, et le pas du glissement. **Un tiers de bloc**,
# et c'est le chiffre qui décide de tout : un pas entier ne grésillerait pas —
# chaque bloc basculerait d'un coup —, et un pas nul ne bougerait rien du tout.
TOILE = 480
GLISSEMENT = 1 / 3

# La largeur du bord adouci, en pixels, et la force du grain en niveaux. Voir la
# note de `images_du_banc` : sans bord adouci, ce banc ne mesure rien.
ADOUCI = 2.5
GRAIN = 3.0

# L'écho du bord — le « ringing » de toute vidéo compressée. Sa largeur en pixels
# et sa force en niveaux. C'est lui, et lui seul, qui fait un bord découpé
# irrégulier ; voir la troisième note de `images_du_banc`.
ECHO = 3.0
ECHO_FORCE = 22.0


def images_du_banc(combien: int, cible: int, graine: int = 1789) -> list[bytes]:
    """Un sujet **rigide** qui glisse, sur fond uni, avec un dégradé et du grain.

    Rigide, parce que c'est la seule façon de savoir ce qu'on mesure : tout ce
    qui change dans la silhouette au-delà du glissement est du grésillement.

    ## Deux choses que ce banc a fallu apprendre à ses dépens

    ⚠️ **Sa forme est ronde, et il porte un trait fin en diagonale.** Le premier
    essai employait un rectangle, et il n'a rien mesuré du tout. C'est mécanique,
    et il fallait le voir : sur une arête verticale, prendre le pixel du centre
    d'un bloc et prendre la majorité du bloc répondent la même chose, puisque
    l'arête coupe le bloc en deux parts franches. **Un bord qui bout est un bord
    oblique** — là, le pixel du centre est un tirage et la majorité est une
    mesure.

    ⚠️ **Son bord est adouci, et c'est la condition sans laquelle rien ne bout.**
    Le deuxième essai dessinait un sujet à bord net, et il n'a rien mesuré non
    plus — deux pour cent d'écart, du bruit. La raison est dans le détourage : il
    tranche à une tolérance, franchement. Sur un bord net, il retrouve exactement
    les mêmes pixels à chaque image, et il ne reste plus rien à calmer. Or **une
    image filmée ou produite par un modèle n'a jamais de bord net** : elle a une
    frange de deux ou trois pixels où la couleur passe du sujet au fond.

    ⚠️ **Et son bord porte un écho, sans quoi rien ne bout non plus.** Le
    troisième essai avait la frange mais pas l'écho, et il n'a rien mesuré : deux
    chaînes à égalité. La raison est de la géométrie pure, et elle est jolie —
    *une droite qui passe par le centre d'un carré le coupe toujours en deux
    moitiés égales*. Donc, partout où le bord est droit à l'échelle d'un bloc,
    « le pixel du centre » et « la majorité du bloc » **répondent exactement la
    même chose**. Les deux chaînes ne peuvent différer que là où le bord n'est
    pas droit : les pointes, les traits fins, et surtout les **irrégularités au
    pixel près**. Un sujet tracé par une équation n'en a aucune ; un découpage
    réel en est plein, parce que la compression laisse le long de chaque bord un
    écho de quelques dizaines de niveaux, redessiné à chaque image. C'est cet
    écho qui fait entrer et sortir des pixels du découpage — et c'est contre lui,
    et contre lui seul, que le vote de majorité gagne quelque chose : il lui faut
    la moitié du bloc pour le faire basculer, là où le pixel du centre suffit.

    Le dégradé donne à la coupe médiane de quoi choisir ; le grain — quelques
    niveaux, différents à chaque image — est ce que laisse toute vidéo
    compressée, et c'est lui qui fait diverger une palette recalculée par image.
    """
    bloc = TOILE / max(1, cible)
    tirage = np.random.default_rng(graine)
    lignes = np.arange(TOILE)[:, None].astype(np.float64)
    colonnes = np.arange(TOILE)[None, :].astype(np.float64)
    vers_le_bas, vers_la_droite = np.broadcast_arrays(lignes / TOILE, colonnes / TOILE)
    # Le dégradé, **et rien qui approche le fond** : à moins de trente niveaux du
    # fond, le détourage par le bord mangerait le sujet et le banc mesurerait le
    # détourage.
    peinture = np.dstack(
        [
            30 + 150 * vers_le_bas,
            60 + 120 * vers_la_droite,
            190 - 130 * vers_le_bas,
        ]
    )

    faites: list[bytes] = []
    for rang in range(combien):
        centre_x = TOILE / 2 + rang * GLISSEMENT * bloc
        # Le corps : une ellipse. Son bord change d'inclinaison à chaque hauteur,
        # donc il offre au banc tous les cas entre l'arête franche et l'oblique.
        # On garde la *distance au bord* et pas seulement le dedans/dehors : elle
        # sert à peindre la frange.
        rayon = np.sqrt(
            ((colonnes - centre_x) / 70.0) ** 2 + ((lignes - TOILE / 2) / 150.0) ** 2
        )
        corps = (1.0 - rayon) * 70.0
        # Le trait fin : une hampe de lance, quatre pixels de large en diagonale.
        # C'est la forme qui disparaît une image sur deux quand un bloc se décide
        # sur un seul de ses pixels.
        travers = np.abs(
            (colonnes - centre_x - 40) - 0.6 * (lignes - TOILE / 2)
        ) / np.sqrt(1 + 0.6**2)
        hampe = np.minimum(2.0 - travers, 170.0 - np.abs(lignes - TOILE / 2))
        dedans = np.maximum(corps, hampe)
        # La frange : du sujet au fond en deux pixels et demi, comme en laisse
        # tout rendu. C'est elle qui donne au détourage de quoi hésiter.
        couverture = np.clip(0.5 + dedans / ADOUCI, 0.0, 1.0)[:, :, None]

        toile = 245.0 * (1.0 - couverture) + peinture * couverture
        # Le grain d'un fichier vidéo : quelques niveaux, jamais assez pour se
        # voir, largement assez pour déplacer une coupe et changer une palette.
        toile += tirage.normal(0.0, GRAIN, toile.shape)
        # L'écho du bord, redessiné à chaque image. C'est lui qui rend le
        # découpage irrégulier au pixel près, et c'est ce que le vote de majorité
        # a pour métier d'absorber.
        pres_du_bord = (np.abs(dedans) <= ECHO)[:, :, None]
        toile += pres_du_bord * tirage.normal(0.0, ECHO_FORCE, toile.shape)
        image = np.clip(toile, 0, 255).astype(np.uint8)
        faites.append(en_png(np.dstack([image, np.full(image.shape[:2], 255, np.uint8)])))
    return faites


def recette_du_banc(cible: int, couleurs: int) -> Recette:
    """La recette d'un jeu ordinaire : détourage par le bord, case, couleurs réduites.

    **Aucune palette imposée**, et c'est la condition du banc : un jeu qui déclare
    sa palette n'a jamais eu le défaut — elle est imposée à tout ce qui entre, la
    bande comprise.
    """
    return Recette(
        passes=(Passe(moteur="bord", tolerance=28),),
        grille=Grille(cible=cible, occupation=90, methode=AU_PLUS_PROCHE),
        quantification=Quantification(couleurs=couleurs),
    )


def main() -> None:
    lecture = argparse.ArgumentParser(description=__doc__)
    lecture.add_argument("--images", type=int, default=9)
    lecture.add_argument("--cible", type=int, default=64)
    lecture.add_argument("--couleurs", type=int, default=16)
    choix = lecture.parse_args()

    print("Le banc d'A5 — le contour qui bout, mesuré avant et après")
    print(f"  {choix.images} images, case de {choix.cible} px, "
          f"{choix.couleurs} couleurs demandées")
    print(f"  le sujet est rigide et glisse d'un tiers de bloc par image")
    print()

    octets = images_du_banc(choix.images, choix.cible)
    recette = recette_du_banc(choix.cible, choix.couleurs)
    depart = time.time()
    preparees = [preparer(o, recette) for o in octets]
    fenetre = fenetre_commune(preparees, recette)
    print(f"  détourage et fenêtre commune : {time.time() - depart:.1f} s")
    print(f"  fenêtre : {fenetre.largeur} × {fenetre.hauteur} px sur "
          f"{fenetre.images} images")
    print()

    releve: dict[str, object] = {
        "quand": time.strftime("%Y-%m-%d %H:%M"),
        "images": choix.images,
        "cible": choix.cible,
        "couleurs_demandees": choix.couleurs,
    }

    mesures = {}
    for nom, stabiliser in (("avant", False), ("apres", True)):
        debut = time.time()
        planche = assembler(preparees, recette, fenetre, stabiliser=stabiliser)
        duree = time.time() - debut
        stabilite = planche.stabilite
        assert stabilite is not None
        mesures[nom] = {**stabilite.en_json(), "secondes": round(duree, 2)}

    print("  Le bord qui revient sur ses pas — le grésil lui-même")
    for nom, titre in (("avant", "avant A5"), ("apres", "après A5")):
        mesure = mesures[nom]
        print(f"    {titre:<10} {mesure['allers_retours']:>6} allers-retours sur "
              f"{mesure['contour']:>6} bascules — "
              f"{100 * mesure['part_des_allers_retours']:.1f} %")
    gain = _gain(
        mesures["avant"]["part_des_allers_retours"],
        mesures["apres"]["part_des_allers_retours"],
    )
    print(f"    → {gain}")
    print()

    print("  Le bord qui change d'une image à l'autre — grésil ET mouvement")
    for nom, titre in (("avant", "avant A5"), ("apres", "après A5")):
        mesure = mesures[nom]
        print(f"    {titre:<10} {mesure['contour']:>6} pixels sur "
              f"{mesure['contour_mesure']:>6} de bord — "
              f"{100 * mesure['part_du_contour']:.1f} %")
    gain = _gain(mesures["avant"]["part_du_contour"], mesures["apres"]["part_du_contour"])
    print(f"    → {gain}   (il bouge peu : le mouvement l'écrase)")
    print()

    print("  Les couleurs qui n'existent que dans une image")
    for nom, titre in (("avant", "avant A5"), ("apres", "après A5")):
        mesure = mesures[nom]
        print(f"    {titre:<10} {mesure['couleurs_d_une_image']:>4} sur "
              f"{mesure['couleurs']:>4} couleurs — "
              f"{100 * mesure['part_des_couleurs']:.0f} %")
    gain = _gain(
        mesures["avant"]["part_des_couleurs"], mesures["apres"]["part_des_couleurs"]
    )
    print(f"    → {gain}")
    print()

    print("  Ce que la stabilisation coûte")
    print(f"    avant A5   {mesures['avant']['secondes']:.2f} s")
    print(f"    après A5   {mesures['apres']['secondes']:.2f} s")
    print("    la géométrie est jouée deux fois — une pour choisir la palette, "
          "une pour rendre")
    print()

    releve["mesures"] = mesures
    SORTIE.write_text(
        json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"relevé écrit dans {SORTIE.relative_to(RACINE)}")


def _gain(avant: float, apres: float) -> str:
    """La phrase du gain, **et elle dit aussi quand il n'y en a pas**.

    Un banc qui n'écrirait le résultat que lorsqu'il est bon ne mesure rien : il
    illustre. Celui-ci dit *ce qu'il a vu*, y compris une hausse.
    """
    if avant <= 0:
        return "rien à comparer : il n'y avait déjà rien qui bougeait"
    part = (avant - apres) / avant
    if part > 0.01:
        return f"{100 * part:.0f} % de moins qu'avant"
    if part < -0.01:
        return f"⚠️ {100 * -part:.0f} % de PLUS qu'avant — la tranche n'a pas servi ici"
    return "aucun écart mesurable"


if __name__ == "__main__":
    main()
