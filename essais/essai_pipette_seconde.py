# -*- coding: utf-8 -*-
"""Le banc de la pipette sur une seconde passe — le défaut, reproduit et mesuré.

Écrit le 1<sup>er</sup> septembre 2026 en tenant `U10`, dont un critère dit :
« le défaut de la pipette sur une seconde passe est **reproduit et mesuré**
avant qu'une ligne le corrige — quelle image, quel point, quelle zone est prise
en trop ».

── Ce qui se passait, en clair ──────────────────────────────────────────────

La pipette efface **la zone d'un seul tenant** sous le point qu'on désigne :
elle part de ce pixel et s'étend de proche en proche à tout ce qui ressemble à
sa couleur. C'est le geste qui règle une poche de fond enfermée par le sujet —
la lumière entre un bras et un torse, l'intérieur d'un anneau — sans toucher au
reste de l'image.

**Mais effacer un pixel ne change pas sa couleur ; ça ne change que sa
transparence.** Une passe qui vient après une autre lit donc, dans les couleurs,
un fond que la précédente a déjà retiré et qui, pour elle, est encore là. Ce
fond invisible forme un **couloir continu** : la tache repart par ce couloir,
traverse tout ce qu'on croyait effacé, et ressort ailleurs dans l'image — sur
une zone qui n'a rien à voir avec le point désigné.

À l'écran, les deux zones ne se touchent pas : entre elles il n'y a que du
damier. C'est ce qui rend le défaut incompréhensible sans ce banc.

── L'image d'essai, et pourquoi elle est fabriquée ──────────────────────────

Elle est dessinée ici plutôt que prise dans le jeu, pour deux raisons : le
défaut demande un arrangement précis de trois couleurs, et un banc qui ouvrirait
une image du dépôt donnerait un chiffre que la prochaine retouche ferait mentir.
Elle tient en trois couleurs — **deux poches de la même couleur, chacune dans
son bloc, et un fond extérieur d'une couleur voisine** :

    #202020   le fond extérieur, celui qu'une passe de bord retire
    #2a2a2a   les deux poches — dix unités plus clair, donc *voisin*
    #c8a05a   les deux blocs de sujet qui les portent

Et **un couloir de deux pixels** relie chaque poche au dehors, à travers son
bloc. C'est lui, tout le défaut : il est de la couleur du fond, donc la passe de
bord le retire ; il devient invisible, et il reste un chemin. Sans lui, chaque
poche est un îlot que rien ne relie et la pipette se tient tranquille — l'image
doit donc le porter pour dire la vérité.

Une passe de bord à tolérance 8 retire le fond extérieur et les deux couloirs,
et **ne touche pas** aux poches : dix, c'est plus que huit. Une pipette posée
sur la poche de gauche à tolérance 20 les accepte toutes les deux — et c'est par
ce qui vient d'être effacé qu'elle passe de l'une à l'autre.

    Lancer :  py essais/essai_pipette_seconde.py

Il ne coûte rien, ne lit aucune clé, n'écrit rien du jeu : tout tient dans un
tableau de nombres en mémoire. Sortie : ce journal, et
`essais/mesures_pipette_seconde.json` pour lire la dérive d'une exécution à
l'autre.
"""

from __future__ import annotations

import json
import pathlib
import sys

import numpy as np

RACINE = pathlib.Path(__file__).resolve().parents[1]
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

from atelier.image.traitement import detourer_bord, detourer_couleur  # noqa: E402

SORTIE = pathlib.Path(__file__).resolve().parent / "mesures_pipette_seconde.json"

COTE = 64
FOND = (0x20, 0x20, 0x20)
POCHE = (0x2A, 0x2A, 0x2A)
SUJET = (0xC8, 0xA0, 0x5A)

#: Les deux blocs de sujet, et la poche que chacun enferme — `(x, y, l, h)`.
BLOCS = ((6, 20, 22, 24), (36, 20, 22, 24))
POCHES = ((12, 26, 10, 12), (42, 26, 10, 12))

#: Le **couloir** — deux pixels de fond qui relient chaque poche au dehors.
#:
#: C'est lui, tout le défaut. Il est de la couleur du fond extérieur, donc la
#: passe de bord le retire ; il devient invisible, et il reste un chemin. Sans
#: lui, chaque poche est un îlot que rien ne relie, et la pipette se tient
#: tranquille — l'image d'essai doit donc le porter pour dire la vérité.
COULOIRS = ((15, 20, 2, 6), (45, 20, 2, 6))

#: Le point qu'on désigne : un pixel de la poche de gauche, celle qu'on veut.
POINT = (16, 32)

TOLERANCE_BORD = 8
TOLERANCE_PIPETTE = 20


def image() -> np.ndarray:
    """L'image d'essai — deux poches enfermées, un fond qui les sépare."""
    rgb = np.zeros((COTE, COTE, 3), dtype=np.uint8)
    rgb[:, :] = FOND
    for x, y, largeur, hauteur in BLOCS:
        rgb[y : y + hauteur, x : x + largeur] = SUJET
    for x, y, largeur, hauteur in POCHES:
        rgb[y : y + hauteur, x : x + largeur] = POCHE
    for x, y, largeur, hauteur in COULOIRS:
        rgb[y : y + hauteur, x : x + largeur] = FOND
    return rgb


def zone(index: int) -> np.ndarray:
    """Le masque d'une des deux poches, pour compter ce qui a été pris."""
    x, y, largeur, hauteur = POCHES[index]
    masque = np.zeros((COTE, COTE), dtype=bool)
    masque[y : y + hauteur, x : x + largeur] = True
    return masque


def mesurer() -> dict[str, object]:
    """Les deux comportements, sur la même image et le même point.

    **L'avant n'est pas remonté de mémoire : il est encore là.** `reste` est un
    argument, et ne pas le passer *est* le comportement d'avant, ligne pour
    ligne. C'est ce qui fait que ce banc restera vrai quand plus personne ne se
    souviendra de la correction.
    """
    rgb = image()

    # ── La première passe : le fond extérieur s'en va, les poches restent ────
    alpha = detourer_bord(rgb, TOLERANCE_BORD)
    fond_efface = int((alpha == 0).sum())
    poches_intactes = int((alpha[zone(0)] > 0).sum() + (alpha[zone(1)] > 0).sum())

    # ── La seconde passe, des deux façons ───────────────────────────────────
    #
    # `avant` ignore ce qui a déjà été effacé — c'est le couloir. `apres` ne
    # travaille que sur ce qui reste.
    avant = detourer_couleur(rgb, POINT, TOLERANCE_PIPETTE)
    apres = detourer_couleur(rgb, POINT, TOLERANCE_PIPETTE, reste=alpha > 0)

    visee, voisine = zone(0), zone(1)
    return {
        "cote": COTE,
        "point": list(POINT),
        "tolerance_bord": TOLERANCE_BORD,
        "tolerance_pipette": TOLERANCE_PIPETTE,
        "fond_efface_px": fond_efface,
        "poches_intactes_px": poches_intactes,
        "visee_px": int(visee.sum()),
        "avant_visee_px": int((avant[visee] == 0).sum()),
        "avant_voisine_px": int((avant[voisine] == 0).sum()),
        "apres_visee_px": int((apres[visee] == 0).sum()),
        "apres_voisine_px": int((apres[voisine] == 0).sum()),
    }


def main() -> None:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    print("Banc de la pipette sur une seconde passe — aucun frais, aucun réseau")
    print("=" * 78)
    print(f"  une image dessinée de {COTE}×{COTE}, trois couleurs")
    print(f"    fond extérieur  #{FOND[0]:02x}{FOND[1]:02x}{FOND[2]:02x}")
    print(f"    les deux poches #{POCHE[0]:02x}{POCHE[1]:02x}{POCHE[2]:02x}")
    print(f"    le sujet        #{SUJET[0]:02x}{SUJET[1]:02x}{SUJET[2]:02x}")
    print()

    releve = mesurer()

    print(f"Passe 1 — bord, tolérance {TOLERANCE_BORD}")
    print("-" * 78)
    print(f"  {releve['fond_efface_px']:5} px de fond extérieur effacés")
    print(f"  {releve['poches_intactes_px']:5} px de poches intacts — la tolérance ne les atteint pas")
    print()

    print(f"Passe 2 — pipette en {tuple(releve['point'])}, tolérance {TOLERANCE_PIPETTE}")
    print("-" * 78)
    print(f"  la poche visée fait {releve['visee_px']} px")
    print(
        f"  avant   visée {releve['avant_visee_px']:4} px"
        f"   ·   voisine {releve['avant_voisine_px']:4} px  <-- prise en trop"
    )
    print(
        f"  après   visée {releve['apres_visee_px']:4} px"
        f"   ·   voisine {releve['apres_voisine_px']:4} px"
    )
    print()
    print("  La poche voisine ne touche pas la poche visée : entre les deux il n'y a")
    print("  que du fond, et ce fond a été effacé par la passe 1. Il est invisible à")
    print("  l'écran, et il servait quand même de chemin.")
    print()

    print("Verdict")
    print("-------")
    reproduit = releve["avant_voisine_px"] > 0
    corrige = releve["apres_voisine_px"] == 0
    entiere = releve["apres_visee_px"] == releve["visee_px"]
    print(
        f"  {'✔' if reproduit else '✘'} le défaut est reproduit — "
        f"{releve['avant_voisine_px']} px pris sur une zone qui ne touche pas le point."
    )
    print(
        f"  {'✔' if corrige else '✘'} il ne l'est plus quand la propagation "
        "s'arrête à ce qui reste."
    )
    print(
        f"  {'✔' if entiere else '✘'} et la poche visée, elle, est prise "
        "entière — le geste ne perd rien."
    )
    SORTIE.write_text(
        json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  Relevé écrit : {SORTIE}")


if __name__ == "__main__":
    main()
