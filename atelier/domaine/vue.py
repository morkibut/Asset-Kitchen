# -*- coding: utf-8 -*-
"""La vue du jeu — un choix unique, et tout ce qu'il remplit.

**Ce choix ne décide pas de l'apparence du jeu. Il décide de combien d'images il
faut par pose** — un personnage qui marche vu de côté, c'est deux images ; le
même vu de dessus, c'est quatre ou huit. C'est le chiffre qui multiplie toute la
production, donc tout ce qu'on paiera.

**La panne qu'il répare est mesurée, sur le vrai projet.** Le nombre de
directions était retapé **sept fois** — une dans la case `technique` de la
bible, puis à la main sur chacune des six poses — et rien ne reliait ces sept
endroits. Passer le jeu en huit directions demandait d'y penser sept fois, et un
oubli ne se voyait qu'à l'export.

**Et une troisième écriture a été retirée le 31 août 2026.** Le choix de la vue
écrivait aussi `4-directional orientation` dans la case `technique` ; il ne
l'écrit plus. La raison est mesurée : cette phrase partait avec les vingt-huit
générations du projet, dont six planches d'équipement où elle **contredisait la
consigne de l'appel** — on demandait une pièce posée à plat, et la bible
réclamait quatre orientations. Elle ne manque pas, parce que chaque image dit
déjà elle-même la direction qu'elle montre, case par case — c'est une décision
du codex, reportée ici (`docs/maquettes-v2.1/05-codex.html`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Le jeu qui n'a pas déclaré sa vue. **Une valeur, pas un trou** : un univers qui
# ne dit pas d'où il regarde ne contraint rien, comme un univers sans artwork ne
# contraint pas la palette.
AUCUNE_VUE = ""


@dataclass(frozen=True, slots=True)
class Vue:
    """Une manière de regarder le monde, et ce qu'elle impose.

    `images` est le nombre d'images qu'une pose demande dans cette vue-là.
    `directions` sont les noms proposés, avec leur consigne anglaise — **une
    proposition, jamais une contrainte** : elles se renomment, se retirent et
    s'ajoutent depuis le codex (E10).

    `phrase` est ce que le choix écrit dans la case `vue` de la bible. Elle reste
    modifiable à la main — c'est du texte libre, et le produit ne réécrit jamais
    ce que l'auteur a tapé — mais elle est écrite juste, la première fois, sans
    qu'on ait à y penser.
    """

    identifiant: str
    libelle: str
    exemples: str
    images: int
    phrase: str
    directions: tuple[tuple[str, str], ...] = ()

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "libelle": self.libelle,
            "exemples": self.exemples,
            "images": self.images,
            "phrase": self.phrase,
            "directions": [
                {"nom": nom, "consigne": consigne} for nom, consigne in self.directions
            ],
        }


# Les quatre points cardinaux d'un jeu vu de dessus, et la consigne de chacun.
# **Écrites une fois sur la direction**, jamais recopiées sur six poses : c'est
# ce qui fait qu'on ne retape plus `facing south` partout (E10).
QUATRE = (
    ("sud", "facing south, toward the viewer"),
    ("ouest", "facing west, to the left"),
    ("nord", "facing north, away from the viewer"),
    ("est", "facing east, to the right"),
)

HUIT = QUATRE + (
    ("sud-ouest", "facing south-west"),
    ("nord-ouest", "facing north-west"),
    ("nord-est", "facing north-est"),
    ("sud-est", "facing south-east"),
)

DEUX = (
    ("droite", "facing right, side view"),
    ("gauche", "facing left, side view"),
)


# **Huit vues, et la liste est fermée.** Elles couvrent ce que le produit sait
# fabriquer ; une neuvième demanderait de savoir ce qu'elle change au nombre
# d'images, et c'est cette question-là qui fait entrer une vue, pas son nom.
VUES: tuple[Vue, ...] = (
    Vue(
        "vue-face-fixe",
        "De face, fixe",
        "les écrans de combat au tour par tour",
        1,
        "front-facing orthographic view, full-body character centered",
    ),
    Vue(
        "vue-dessus-verticale",
        "De dessus, verticale",
        "les jeux de tir à défilement vertical",
        1,
        "strict top-down view seen from directly above",
    ),
    Vue(
        "vue-cote-plateforme",
        "De côté — plateforme",
        "Mario, Celeste, Hollow Knight",
        2,
        "side view, orthographic, full-body character centered",
        DEUX,
    ),
    Vue(
        "vue-cote-defilement",
        "De côté — défilement",
        "les jeux de baston de rue",
        2,
        "side view, orthographic, full-body character centered",
        DEUX,
    ),
    Vue(
        "vue-dessus-stricte",
        "De dessus, stricte",
        "le premier Zelda, Hotline Miami",
        4,
        "top-down view, full-body character centered",
        QUATRE,
    ),
    Vue(
        "vue-dessus-34",
        "De dessus, 3/4",
        "Zelda A Link to the Past, Stardew Valley",
        4,
        "3/4 top-down orthographic view, full-body character centered",
        QUATRE,
    ),
    Vue(
        "vue-oblique",
        "Oblique (cavalière)",
        "Ultima, EarthBound",
        4,
        "oblique cavalier projection, no vanishing point, full-body character centered",
        QUATRE,
    ),
    Vue(
        "vue-isometrique",
        "Isométrique",
        "Diablo 2, Age of Empires 2",
        4,
        "isometric projection, 30 degrees above the horizon, no vanishing point",
        QUATRE,
    ),
)


def vue(identifiant: str) -> Vue | None:
    """La vue de cet identifiant, ou rien.

    Un identifiant inconnu ne se corrige pas en silence : c'est l'appelant qui
    décide de retomber sur « aucune », comme pour une échelle.
    """
    for v in VUES:
        if v.identifiant == identifiant:
            return v
    return None


# ── Les tailles d'image ──────────────────────────────────────────────────────
#
# **Neuf tailles classiques, et le même sprite dessiné dans chacune** — c'est la
# seule façon honnête de choisir. Un nombre ne dit rien ; deux personnages côte
# à côte, l'un en 32 et l'autre en 128, disent tout.

TAILLES: tuple[tuple[int, str], ...] = (
    (8, "La tuile des toutes premières consoles."),
    (16, "La taille la plus courante du pixel art — tuiles de décor et petits personnages."),
    (24, "Un entre-deux : des personnages un peu plus lisibles sans changer d'échelle de décor."),
    (32, "Les personnages de l'époque 16 bits."),
    (48, "Personnages détaillés, encore économes."),
    (64, "Personnages très détaillés, petits boss."),
    (96, "Gros ennemis."),
    (128, "Grosses créatures, décors, boss."),
    (256, "Portraits, illustrations, écrans de titre."),
)


def phrase_de_grille(cible: int) -> str:
    """Ce que le choix de taille écrit dans la case `rendu`.

    **Un choix unique remplit le réglage et la phrase**, et c'est ce qui répare
    la contradiction mesurée du dépôt : le réglage disait 128 pendant que le
    texte envoyé disait 64, trois fois.

    **Sans cible, elle est vide** — pas une phrase qui nierait la grille. « Un
    univers vide ne contraint rien » (US-57) : *aucune* veut dire que le produit
    ne dit rien de la grille, et écrire `no pixel grid` serait une affirmation
    que personne n'a faite.
    """
    return f"2D pixel art on a {cible}x{cible} grid" if cible else ""


def phrase_de_calage(cible: int) -> str:
    """Ce que le choix de taille écrit dans la case `technique`. Vide sans cible,
    pour la raison de `phrase_de_grille`."""
    return (
        f"single isolated sprite on a flat background, strict {cible}x{cible} px tile snap"
        if cible
        else ""
    )


def phrases_du_produit() -> frozenset[str]:
    """Tout ce que le produit a pu écrire lui-même dans une case de la bible.

    **C'est la borne qui rend la réécriture sûre** : le produit ne réécrit que
    le vide ou ce qu'il avait lui-même écrit. Ce que l'auteur a tapé ne se
    réécrit jamais sous ses yeux — c'est du texte libre, et le dire est la
    moitié de la promesse.
    """
    ecrites = {v.phrase for v in VUES}
    for cible, _ in TAILLES:
        ecrites.add(phrase_de_grille(cible))
        ecrites.add(phrase_de_calage(cible))
    return frozenset(ecrites)
