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
du codex, reportée ici (`docs/archive/maquettes-v2.1/05-codex.html`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from atelier.domaine.direction import Direction
from atelier.domaine.fond import dit as fond_dit
from atelier.domaine.transparence import FOND_TRANSPARENT

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

    ── Les deux textes qui partent **en queue de prompt** (1ᵉʳ septembre 2026) ──

    `contrainte` est la caméra redite en dernier, à l'impératif. `volume` dit
    **quelles faces du sujet on voit** dans cette caméra-là, et il part pour tout
    ce que le jeu dessine. `corps` est l'exemple humain, et lui seul dépend de la
    famille.

    **Deux champs et non un, et c'est le banc des deux jeux qui l'a exigé** (1ᵉʳ
    septembre 2026). La première version n'en avait qu'un, il parlait de tête,
    d'épaules et de pieds, et il ne partait que pour les personnages. Les deux
    moitiés étaient fausses :

    · Il partait **tel quel à un quadricoptère** (*« from the head down to the
      feet »*) et à un lézard (*« the shoulders are wide »*), parce que le
      produit range les créatures avec les personnages — et il a raison, ce sont
      les mêmes cases et les mêmes poses. Ce n'est donc pas la famille qu'il
      fallait affiner, c'est la phrase : une caméra décrit des faces, pas des
      membres.
    · Et il **ne partait pas du tout pour un objet**, faute d'un corps. Résultat
      mesuré : un coffre de caravane, dans un jeu déclaré vu de dessus strict,
      est revenu dessiné de trois quarts. La caméra seule ne suffisait pas ; ce
      qui la faisait tenir était la phrase des faces, et les objets ne l'avaient
      pas.

    **Ce sont les deux seuls champs du domaine dont l'utilité est mesurée**
    (`essais/essai_vue.py`, 1ᵉʳ septembre 2026, trente images payées). Le banc a
    comparé six façons de réparer le même prompt, et il n'en a retenu qu'une :
    **une caméra dite en dernier, en mots qui décrivent ce qu'on doit voir.** Le
    rapport hauteur/largeur du sujet — deux pour un debout de face, un pour un
    corps vu d'aplomb — passe de **1,55 à 1,13** avec cette seule addition.

    Et le banc a **réfuté** les deux réparations qu'on croyait décisives :
    retirer l'image de référence ne change rien (1,46 contre 1,55), et le prompt
    négatif seul ne change rien non plus (1,69). Dire ce qu'on ne veut pas ne dit
    pas ce qu'on veut ; dire la caméra en dernier, si.
    """

    identifiant: str
    libelle: str
    exemples: str
    images: int
    phrase: str
    directions: tuple[Direction, ...] = ()
    contrainte: str = ""
    volume: str = ""
    corps: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "libelle": self.libelle,
            "exemples": self.exemples,
            "images": self.images,
            "phrase": self.phrase,
            "contrainte": self.contrainte,
            "volume": self.volume,
            "corps": self.corps,
            "directions": [d.en_json() for d in self.directions],
        }


# ── Les directions que chaque vue propose ────────────────────────────────────
#
# **Écrites une fois sur la direction**, jamais recopiées sur six poses : c'est
# ce qui fait qu'on ne retape plus `facing south` partout (E10). Corriger
# « south » se fait alors à un seul endroit, et non six fois.
#
# **La queue de phrase change avec la vue, les noms ne changent pas.** Le sud
# d'un jeu isométrique n'est pas le sud d'un jeu vu de dessus — l'un se regarde
# de trois quarts, l'autre d'aplomb —, mais il s'appelle sud dans les deux. Un
# gabarit par vue plutôt que trois tables presque identiques : trois tables
# auraient divergé à la première correction.


# Les quatre points cardinaux, chacun avec le repère qui le situe pour un
# lecteur — **dans l'ordre sud · nord · est · ouest**, qui est celui de la
# matrice, d'après la maquette du codex (`docs/archive/maquettes-v2.1/05-codex.html`).
# Le sud vient en premier partout, parce que c'est là que se rangent les images
# faites avant la déclaration : « la première direction » doit être la même pour
# tout le monde.
_CARDINALES = (
    ("sud", "south", "toward the viewer", "toward the bottom of the image"),
    ("nord", "north", "away from the viewer", "toward the top of the image"),
    ("est", "east", "to the right", "toward the right of the image"),
    ("ouest", "west", "to the left", "toward the left of the image"),
)


def _cardinales(queue: str = "", du_cadre: bool = False) -> tuple[Direction, ...]:
    """Les quatre points cardinaux, dits comme cette vue-là les dit.

    **Deux repères, et c'est la caméra qui décide lequel a un sens** — corrigé le
    1ᵉʳ septembre 2026, sur images payées.

    Un jeu vu de face ou de trois quarts se repère par rapport au **spectateur** :
    *toward the viewer*, *to the left*. C'était le seul repère du produit, et il
    est juste là.

    Il ne veut plus rien dire dès que la caméra passe à l'aplomb, **parce que le
    spectateur est alors au-dessus** : « face au spectateur » demanderait à un
    personnage vu de dessus de regarder le ciel. Le banc des deux jeux l'a
    mesuré sur le jeu vu de dessus strict — *marche vers le sud* et *marche vers
    le nord* ont rendu **la même image**, deux fois. La direction est le second
    axe de la matrice ; elle multiplie la production par quatre, et elle
    n'arrivait pas.

    Ces caméras-là se repèrent donc par rapport au **cadre** : vers le bas de
    l'image, vers la droite de l'image. C'est ce qu'un jeu vu de dessus veut
    dire.

    ── **Et ça ne suffit pas. Le dire ici parce que c'est cher à réapprendre** ──

    Le nouveau repère **corrige un contresens ; il ne répare pas le symptôme.**
    Mesuré le même jour, sur la masse du sujet dans sa propre boîte — un corps
    qui marche vers le bas du cadre y pousse ses pieds, et le tiers haut se vide :

        bruit, dix appels identiques      haut 26,1 %   dispersion ±0,9 %
        repère du cadre, sud              haut 27,4 %
        repère du cadre, nord             haut 28,0 %   ← 0,6 % d'écart, sous le bruit

    Deux autres réparations ont été essayées et **échouent aussi** : replier la
    consigne d'angle en queue de prompt, et la réécrire comme une rotation dans
    le plan de l'image (*« tourné pour marcher vers le bord bas »*). Les deux
    changent le cadrage — le tiers haut passe à 38-40 % — mais **de la même façon
    pour le sud et pour le nord**. Ce n'est pas la direction qui est obéie.

    **Conclusion, et elle dépasse ce fichier : la direction ne s'obtient pas par
    des mots.** Elle est le second axe de la matrice et multiplie la production
    par quatre ; aucune phrase testée ne la fait arriver dans un jeu vu d'aplomb.
    C'est exactement ce que `docs/archive/essais-v3/etude-mannequin.md` avait supposé pour
    l'attitude — *les mots ne savent pas dire une posture* — et cette mesure-ci
    l'étend à l'orientation. La réparation, si elle vient, sera une **image** :
    un référent par direction, ou la scène articulée de la V3.

    Ce repère-ci reste, parce qu'un contresens qui ne coûte rien reste un
    contresens : demander à un personnage vu de dessus de faire face au
    spectateur, c'est lui demander de regarder le ciel.

    La queue de projection, elle, ne change pas : elle **s'ajoute** au repère au
    lieu de le remplacer. La remplacer était la faute jumelle — un sud
    isométrique disait `facing south, isometric three-quarter view`, ce qui
    nomme la projection et ne dit rien de l'orientation.
    """
    return tuple(
        Direction(
            nom,
            nom,
            ", ".join(
                mot
                for mot in (f"facing {vers}", cadre if du_cadre else spectateur, queue)
                if mot
            ),
        )
        for nom, vers, spectateur, cadre in _CARDINALES
    )


QUATRE = _cardinales()
# **Les vues d'aplomb se repèrent au cadre**, pas au spectateur.
QUATRE_DU_CADRE = _cardinales(du_cadre=True)
QUATRE_OBLIQUES = _cardinales("oblique projection", du_cadre=True)
QUATRE_ISOMETRIQUES = _cardinales("isometric three-quarter view", du_cadre=True)

HUIT = QUATRE + tuple(
    Direction(identifiant, identifiant, f"facing {vers}")
    for identifiant, vers in (
        ("sud-ouest", "south-west"),
        ("nord-ouest", "north-west"),
        ("nord-est", "north-east"),
        ("sud-est", "south-east"),
    )
)

DEUX = (
    Direction("droite", "droite", "facing right, side view"),
    Direction("gauche", "gauche", "facing left, side view"),
)


# **Huit vues, et la liste est fermée.** Elles couvrent ce que le produit sait
# fabriquer ; une neuvième demanderait de savoir ce qu'elle change au nombre
# d'images, et c'est cette question-là qui fait entrer une vue, pas son nom.
#
# **La phrase ne nomme plus un personnage** depuis le 1ᵉʳ septembre 2026. Elle
# disait `full-body character centered` sur cinq vues, et elle part avec *toutes*
# les générations du jeu — une tuile de sol recevait donc l'ordre de centrer un
# personnage en pied. Ce que la phrase dit du corps est passé dans `corps`, qui
# ne part que pour les choses qui en ont un. Les anciennes phrases restent
# connues du produit, juste en dessous, pour que les projets d'avant continuent
# de se relire.
VUES: tuple[Vue, ...] = (
    Vue(
        "vue-face-fixe",
        "De face, fixe",
        "les écrans de combat au tour par tour — Dragon Quest, les combats d'EarthBound",
        1,
        "front-facing orthographic view, subject centered",
        (),
        "CAMERA — this overrides everything above. The camera faces the subject "
        "head-on, at the subject's own height, with no tilt at all. Not a side "
        "view, not a three-quarter view, not seen from above. No perspective, no "
        "vanishing point.",
        "You see the subject's front face, its whole height, from its top down "
        "to where it meets the ground.",
        "On a character, that means head to feet, facing you.",
    ),
    Vue(
        "vue-dessus-verticale",
        "De dessus, verticale",
        "les jeux de tir à défilement vertical — 1942, Raiden",
        1,
        "strict top-down view seen from directly above",
        (),
        "CAMERA — this overrides everything above. The camera is directly "
        "overhead, looking straight down at the ground at 90 degrees. Not a side "
        "view, not a three-quarter view, not a front view. No horizon line, no "
        "perspective, no vanishing point.",
        "You are looking down onto the subject's upper surface: its top face is "
        "what fills the sprite, and nothing that faces forwards or sideways is "
        "visible.",
        "On a character, that means the top of the head and the shoulders, never "
        "the face, and the feet stay hidden under the body.",
    ),
    Vue(
        "vue-cote-plateforme",
        "De côté — plateforme",
        "Mario, Celeste, Hollow Knight",
        2,
        "side view, orthographic, subject centered",
        DEUX,
        "CAMERA — this overrides everything above. The camera is at the subject's "
        "own height and looks at it from the side, in pure profile. Not a front "
        "view, not a three-quarter view, not seen from above. No perspective, no "
        "vanishing point.",
        "You see one whole flank of the subject, from its top down to where it "
        "meets the ground, and nothing of its front or its back.",
        "On a character, that means a pure profile, head to feet.",
    ),
    Vue(
        "vue-cote-defilement",
        "De côté — défilement",
        "les jeux de baston de rue — Streets of Rage, Final Fight",
        2,
        "side view, orthographic, subject centered",
        DEUX,
        "CAMERA — this overrides everything above. The camera is at the subject's "
        "own height and looks at it from the side, in pure profile. Not a front "
        "view, not a three-quarter view, not seen from above. No perspective, no "
        "vanishing point.",
        "You see one whole flank of the subject, from its top down to where it "
        "meets the ground, and nothing of its front or its back — on a "
        "character, that means a pure profile, head to feet.",
    ),
    Vue(
        "vue-dessus-stricte",
        "De dessus, stricte",
        # **Une image qui tourne, et non quatre.** Tranché par l'auteur le 23
        # septembre 2026 (RV18) : Hotline Miami et GTA 1-2 sont bien vus de
        # dessus, mais leur personnage tourne librement — ce n'est pas quatre
        # directions dessinées, c'est une seule image que le jeu fait pivoter,
        # comme `vue-dessus-verticale`. Le premier Zelda est retiré d'ici : son
        # décor est à plat, mais Link lui-même est dessiné de face ou de
        # profil — il appartient à `vue-dessus-34`, où il a été ajouté.
        "Hotline Miami, GTA 1 et 2 — une seule image, que le jeu fait pivoter",
        1,
        "top-down view, subject centered",
        (),
        "CAMERA — this overrides everything above. The camera is high above the "
        "subject and looks down at a steep angle, close to straight down. Not a "
        "side view, not a front view. No horizon line, no perspective, no "
        "vanishing point.",
        "You see mostly the subject's upper surface, and only a narrow band of "
        "its front.",
        "On a character, the head reads from above and the shoulders are wide, "
        "while the feet are barely visible.",
    ),
    Vue(
        "vue-dessus-34",
        "De dessus, 3/4",
        # Le premier Zelda rejoint cette vue le 23 septembre 2026 (RV18) : son
        # décor est à plat, mais Link est dessiné de face ou de profil, plus
        # plat que Link to the Past — c'est la famille 3/4, pas la stricte.
        "Zelda A Link to the Past, Stardew Valley, le premier Zelda (en plus plat)",
        4,
        "3/4 top-down orthographic view, subject centered",
        QUATRE,
        "CAMERA — this overrides everything above. The camera is above the "
        "subject and tilted down towards it, the way A Link to the Past and "
        "Stardew Valley look at their world. Not straight overhead, not at eye "
        "level. No horizon line, no vanishing point.",
        "You see the subject's front face and its upper surface at the same "
        "time, and its base is visible below it.",
        "On a character, the face and the top of the head at once, with the feet "
        "showing.",
    ),
    Vue(
        "vue-oblique",
        "Oblique (cavalière)",
        # « Ultima » précisé en « Ultima VII » (23 septembre 2026, RV18) : les
        # deux jeux dessinent huit directions, l'atelier n'en fait que quatre,
        # et l'écran le dit plutôt que de citer des jeux à 8 sans le préciser.
        "Ultima VII, EarthBound — ces jeux dessinent 8 directions, l'atelier en fait 4",
        4,
        "oblique cavalier projection, no vanishing point, subject centered",
        QUATRE_OBLIQUES,
        "CAMERA — this overrides everything above. Cavalier oblique projection: "
        "the camera looks down at one fixed angle and parallel lines stay "
        "parallel everywhere. No vanishing point, no horizon line, no "
        "foreshortening.",
        "You see the subject's front face and its top face at once, neither of "
        "them squashed.",
        "On a character, the front of the body and the top of the head together.",
    ),
    Vue(
        "vue-isometrique",
        "Isométrique",
        # Diablo 2 et Age of Empires 2 dessinent huit directions ; l'atelier
        # n'en fait que quatre, donc l'écran cite des jeux qui en ont
        # vraiment 4 plutôt que d'annoncer un nombre qu'il ne tient pas
        # (23 septembre 2026, RV18).
        "Final Fantasy Tactics, Into the Breach",
        4,
        "isometric projection, 30 degrees above the horizon, no vanishing point",
        QUATRE_ISOMETRIQUES,
        "CAMERA — this overrides everything above. Isometric projection, seen "
        "from a corner, 30 degrees above the horizon. Parallel lines stay "
        "parallel everywhere. No vanishing point, no horizon line.",
        "You see two side faces of the subject and its top face at the same "
        "time, all at the same scale.",
        "On a character, one shoulder, the chest and the top of the head "
        "together.",
    ),
)


# Les phrases que le produit écrivait dans la case `vue` **avant** le
# 1ᵉʳ septembre 2026. Elles ne sont plus proposées ; elles restent connues pour
# que `sans_phrase_du_produit` les retire des fichiers écrits avant — sans quoi
# elles resteraient dans la case de l'auteur et se diraient deux fois.
_PHRASES_D_AVANT = frozenset(
    {
        "front-facing orthographic view, full-body character centered",
        "side view, orthographic, full-body character centered",
        "top-down view, full-body character centered",
        "3/4 top-down orthographic view, full-body character centered",
        "oblique cavalier projection, no vanishing point, full-body character centered",
    }
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
    (256, "Pixel art haute résolution — portraits, illustrations, écrans de titre."),
    (512, "Pixel art haute résolution — le grain reste visible, le détail aussi."),
)


# ── Les finesses d'un jeu en dessin, arrivées en D2 ──────────────────────────
#
# **La même case, une autre question.** En pixel art, la taille *est* le dessin :
# 64 veut dire *soixante-quatre carrés de couleur*. En dessin, elle n'est qu'une
# **finesse** — combien de détail le fichier garde —, et la transformation qui y
# mène n'a rien de destructeur : réduire un dessin de 2048 à 1024 marche tout
# seul, parce qu'il n'y a aucune grille à écraser.
#
# **Elle compte quand même, et pour trois raisons concrètes** : une image de
# 2048 occupe 16 Mo dans la mémoire de la carte graphique, cent objets pareils
# et le jeu ne démarre plus ; un sprite trop grand pour sa taille à l'écran paie
# de la mémoire pour rien, trop petit il est flou ; et surtout **deux objets à
# deux finesses différentes, affichés à la même taille, n'ont pas le même
# piqué** — c'est ce qui se voit le plus vite.
#
# La règle qui les choisit : **environ le double de la hauteur affichée**, pour
# rester net sur un écran dense ou quand la caméra approche.
FINESSES: tuple[tuple[int, str], ...] = (
    (256, "Petits objets d'inventaire, icônes, éléments d'interface."),
    (512, "La finesse courante d'un personnage de jeu 2D dessiné."),
    (1024, "Personnages en gros plan, portraits de dialogue, gros objets."),
    (2048, "Décors, écrans de titre, illustrations plein cadre."),
)

# La finesse d'un jeu en dessin qui n'en a pas choisi. **512 et non 1024** : un
# personnage de jeu 2D dessiné s'affiche couramment autour de 250 points de
# haut, et la règle du double le met à 512. Doubler encore paierait quatre fois
# la mémoire pour un piqué que personne ne verra.
FINESSE_PAR_DEFAUT = 512


def phrase_de_grille(cible: int) -> str:
    """Ce que le choix de taille dit dans la case `rendu`.

    **Un choix unique remplit le réglage et la phrase**, et c'est ce qui répare
    la contradiction mesurée du dépôt : le réglage disait 128 pendant que le
    texte envoyé disait 64, trois fois.

    **Sans cible, elle est vide** — pas une phrase qui nierait la grille. « Un
    univers vide ne contraint rien » (US-57) : *aucune* veut dire que le produit
    ne dit rien de la grille, et écrire `no pixel grid` serait une affirmation
    que personne n'a faite.

    **Elle n'est plus *écrite* dans la case depuis le 1ᵉʳ septembre 2026, elle
    est *calculée* à l'envoi** — voir `Univers.phrase_du_produit`. La différence
    n'est pas de goût : rangée dans la case, elle cessait d'être mise à jour dès
    que l'auteur ajoutait un mot à côté d'elle, parce que la case devenait « du
    texte d'auteur » et que le produit s'interdit d'y toucher. Une seule
    étiquette cliquée gelait donc la grille pour toujours, et rouvrait la
    contradiction que ce mécanisme existe pour fermer.
    """
    return f"2D pixel art on a {cible}x{cible} grid" if cible else ""


def phrase_de_calage(cible: int, fond: str = "") -> str:
    """Ce que le choix de taille et **le fond de l'appel** écrivent dans `technique`.

    Vide sans cible **et sans fond**, pour la raison de `phrase_de_grille` : un
    univers qui n'a rien posé ne contraint rien.

    ── Le fond, arrivé en D3 ────────────────────────────────────────────────

    ⚠️ **`fond` est la couleur de cet appel-ci, pas un réglage du jeu** (RT3, 20
    septembre 2026). L'atelier la calcule sur les images de référence qui partent
    avec la demande, le vert de studio à défaut, et l'écran de confirmation
    laisse la corriger pour un seul appel. Cette fonction ne lit rien : elle
    écrit la couleur qu'on lui donne.

    **C'est ici, et nulle part ailleurs, que le fond part.** Il était déjà écrit
    en toutes lettres dans cette phrase — *a flat background* — sans qu'on dise
    lequel, et le modèle rendait donc un gris clair, c'est-à-dire une couleur que
    le sujet porte aussi. Nommer la couleur ne déplace rien : c'est le même mot
    de la même phrase, qui cesse d'être vague.

    **Sans fond, la phrase est celle d'avant la tranche, au caractère près.** C'est le sixième critère de D3, et il vaut pour les centaines
    d'images déjà traitées comme pour un univers qui n'a pas de palette.

    **Les deux moitiés se séparent, et c'est le style qui les sépare** (D2). Un
    jeu en dessin n'a pas de calage en carrés — sa cible vaut zéro ici — mais il
    a un fond comme les autres : le sujet isolé part seul, sans la seconde
    moitié. Coller les deux aurait rendu le fond inatteignable à la moitié des
    projets, et la tranche muette là où elle sert autant.

    ── Le fond vide, arrivé en TN2 ──────────────────────────────────────────

    **Un appel qui demande la transparence n'a pas de fond à nommer**
    (`FOND_TRANSPARENT`, décidé par `transparence_demandee`). « Sur un fond
    plat » serait alors une consigne contraire à celle qui encadre le texte :
    la phrase ne garde que le calage de grille, et se tait sans lui. Le fond
    vide, lui, est dit par la consigne officielle, en tête et en queue.
    """
    if fond == FOND_TRANSPARENT:
        return f"strict {cible}x{cible} px tile snap" if cible else ""
    nomme = fond_dit(fond)
    pose = (
        f"single isolated sprite on a flat solid {nomme} background"
        if nomme
        else "single isolated sprite on a flat background"
    )
    if cible:
        return f"{pose}, strict {cible}x{cible} px tile snap"
    return pose if nomme else ""


# ── Le cadre, replié juste avant la caméra ───────────────────────────────────
#
# **Une phrase, et la moitié qu'elle contient est celle qui a été mesurée.**
# Le banc des deux jeux (`essais/essai_deux_jeux.py`) a comparé le même appel
# avec et sans, trois tirages chacun : l'aire du sujet passe de **14,7 % à
# 20,1 %** de l'image, sans recouvrement entre les deux bras. C'est **37 % de
# pixels en plus** pour le sprite, avant qu'il soit ramené à 32 ou 64 px — et le
# détail perdu au rééchantillonnage ne se rattrape jamais.
#
# **Ce qui n'y est pas y était, et le banc l'a retiré.** La version essayée
# demandait aussi *un fond d'une seule couleur plate, sans dégradé ni vignette*.
# Mesuré sur les pixels d'un coin, le fond est ressorti **plus bruité** avec la
# phrase que sans — amplitude de 17 niveaux contre 4. La demande n'a pas été
# tenue ; on ne garde pas une phrase qui ne fait pas ce qu'elle dit. Le décor et
# le sol, eux, restent interdits : ce sont des objets, pas une texture, et le
# reste de la phrase les tient.
#
# **Elle ne part pas avec une planche.** Une planche vient précisément de
# demander plusieurs sujets dans une grille ; « un seul sprite et rien d'autre »
# la contredirait mot pour mot.
CADRE = (
    "FRAMING — one single sprite and nothing else: no scenery, no ground, no "
    "extra props, nothing the description above does not name. The subject is "
    "centred and fills most of the image. No text, no letters, no numbers, no "
    "logo, no frame, no border."
)


# ── Refaire une planche (RS2) ────────────────────────────────────────────────
#
# **Trois phrases de ce fichier demandent un sprite seul, et une planche à
# refaire les contredit toutes les trois** : le calage (« single isolated
# sprite »), le cadre (« one single sprite and nothing else ») et la caméra
# (« this overrides everything above »). La génération 26f07741 du 18 septembre
# 2026 les portait avec la planche des quatre directions de Champy jointe, et le
# modèle a rendu un seul Champy. Quand l'appel garde la mise en page, le cadre
# ne part pas et la consigne ci-dessous prend sa place ; les deux autres sont
# réécrites ici, à un seul endroit.

# Le début de la phrase de calage, tel que `phrase_de_calage` l'écrit — avec ou
# sans couleur de fond nommée. `tests/test_rs2.py` vérifie qu'il y est toujours.
_POSE_SEULE = "single isolated sprite on a flat "
_POSE_DE_PLANCHE = "isolated sprites on a flat "

# L'ouverture commune aux huit caméras de `VUES`.
_CAMERA_QUI_PRIME = "CAMERA — this overrides everything above. "
_CAMERA_SOUS_LA_PLANCHE = (
    "CAMERA — for every view of the sheet, without changing its layout: the "
    "number of views, their order and the way each one faces stay those of the "
    "sheet. "
)


def calage_de_planche(texte: str) -> str:
    """La case `technique` pour une planche : des sprites isolés, au pluriel.

    Seule la phrase du produit change ; le fond et le calage de grille restent,
    et un texte d'auteur qui ne la contient pas ressort mot pour mot.
    """
    return texte.replace(_POSE_SEULE, _POSE_DE_PLANCHE)


# ── Le cadrage bord à bord : une tuile, un décor, une matière (10 octobre 2026) ──
#
# **Le défaut est payé sur Cœur de Pierre** (`docs/releves/2026-10-10-lot1-parois-
# coeur-de-pierre.md`, défauts 3 et 9). Une nature sans silhouette — tuile, décor,
# matière — remplit son cadre ; mais l'appel lui envoyait le cadrage d'un sprite :
# « single isolated sprite on a flat background », puis « one single sprite and
# nothing else… the subject is centred ». Le modèle rendait un objet au milieu
# d'un fond, l'inverse d'une texture bord à bord. Seul le texte repris à la main
# y échappait.
#
# **Et la lumière du jeu disait « entouré d'un noir absolu »** : vraie pour une
# scène, fausse pour une icône transparente — le modèle peignait le noir, un
# carré opaque que le détourage par le bord ne voyait pas — et fausse pour une
# tuile, qui n'a pas d'« autour ». La lumière reste ; seul ce qui entoure tombe.

_POSE_SUR_UN_FOND_PLAT = re.compile(
    r"single isolated sprite on a flat (?:solid [^\n,.]*? )?background"
)
POSE_BORD_A_BORD = "one seamless tile filling the whole frame edge to edge, no background"

# Ce que la lumière met **autour** du sujet : un mot de liaison, puis du noir.
# Une liste courte et fermée, comme `_NOIRCEURS` côté vitrine — on ne devine pas
# une phrase, on retire une tournure qu'on sait lire.
_ENTOURAGE = re.compile(
    r",?\s*\b(?:surrounded by|set against|against|engulfed (?:in|by)|swallowed by|"
    r"framed by|in a sea of)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,2}"
    r"(?:blackness|darkness|black|void|shadows?|gloom)\b",
    re.IGNORECASE,
)


# « subject centered », la fin des caméras de `VUES` : l'angle reste juste pour
# une tuile, le centrage non — il n'y a pas de sujet à centrer.
_SUJET_CENTRE = re.compile(r",\s*subject centered\b")


def calage_bord_a_bord(texte: str) -> str:
    """Les cases `technique` et `vue` d'une nature sans silhouette : une tuile,
    pas un sprite.

    Seules les phrases du produit changent, comme pour une planche
    (`calage_de_planche`) ; le calage de grille et l'angle de vue restent, et un
    texte d'auteur qui ne les contient pas ressort mot pour mot.
    """
    return _SUJET_CENTRE.sub("", _POSE_SUR_UN_FOND_PLAT.sub(POSE_BORD_A_BORD, texte))


def eclairage_sans_entourage(texte: str) -> str:
    """La lumière du jeu, **sans ce qu'elle met autour du sujet**.

    « Dynamic warm radial lighting (lanterns…) surrounded by absolute
    blackness, sharp light falloff » devient « Dynamic warm radial lighting
    (lanterns…), sharp light falloff ». Un texte sans cette tournure ressort au
    caractère près.
    """
    propre = _ENTOURAGE.sub("", texte)
    if propre == texte:
        return texte
    propre = re.sub(r"\s+,", ",", propre)
    propre = re.sub(r",\s*,", ",", propre)
    propre = re.sub(r"\s*\.\s*\.", ".", propre)
    return re.sub(r"[ \t]{2,}", " ", propre).strip(" ,")


def camera_sous_la_planche(texte: str) -> str:
    """La caméra du jeu, qui vaut pour chaque vue **sans primer sur la planche**.

    Elle reste la dernière ligne du texte — c'est ce qui décide de la vue, et le
    banc du 1ᵉʳ septembre 2026 l'a payé —, mais elle ne dit plus qu'elle
    l'emporte sur tout ce qui précède : ce qui précède est la planche à refaire.
    """
    if texte.startswith(_CAMERA_QUI_PRIME):
        return _CAMERA_SOUS_LA_PLANCHE + texte[len(_CAMERA_QUI_PRIME):]
    return texte


def consigne_de_mise_en_page(rang: int | None) -> str:
    """La consigne qui remplace le cadre quand l'appel refait une planche.

    `rang` est celui de l'image à reproduire dans l'ordre d'envoi ; sans lui —
    un aperçu qui ne connaît pas encore le modèle —, elle nomme « la planche
    jointe ». Elle garde du cadre ce qui ne contredit pas une planche : ni décor,
    ni sol, ni texte. « No frame, no border » n'y est pas : une planche peut
    avoir ses cases tracées, et on demande de la refaire telle quelle.
    """
    source = f"Image {rang}" if rang else "the character sheet joined above"
    return (
        f"LAYOUT — reproduce the layout of {source}: redraw the same character "
        f"sheet, with the same number of views, in the same order, with the same "
        f"arrangement, framing and scale. Every view is the same character. "
        f"Apply the change described above to every view, and change nothing "
        f"else. No scenery, no ground, no text, no letters, no numbers, no logo."
    )


def phrases_du_produit() -> frozenset[str]:
    """Tout ce que le produit a pu écrire lui-même dans une case de la bible.

    **Elle ne borne plus une réécriture, elle borne une relecture.** Tant que la
    phrase était rangée dans la case, cette liste disait ce que le produit avait
    le droit d'écraser ; depuis qu'elle se calcule à l'envoi, elle dit ce qu'il
    faut **retirer** des fichiers écrits avant — c'est `sans_phrase_du_produit`,
    juste dessous, et c'est toute la migration.

    La liste est close et vient d'ici : huit vues, neuf tailles, deux phrases
    par taille — **plus les cinq phrases de vue d'avant le 1ᵉʳ septembre 2026**,
    celles qui nommaient un personnage. C'est le cas que la version précédente
    de ce texte annonçait comme sûr et qui vient de se produire : une phrase a
    changé, et sans ces cinq lignes elle serait restée dans la case de l'auteur,
    à se dire une seconde fois.

    **Les phrases de calage qui nomment un fond n'y sont pas, et il ne faut pas
    les y mettre** (D3). Cette liste ne sert qu'à *retirer d'un fichier écrit
    avant le 1ᵉʳ septembre 2026* ce que le produit y avait rangé lui-même ; aucun
    de ces fichiers ne porte de fond, puisque le réglage n'existait pas. Les y
    ajouter ferait parcourir six couleurs fois neuf tailles à chaque relecture de
    case, pour retirer un texte qui n'y est jamais.
    """
    ecrites = {v.phrase for v in VUES} | set(_PHRASES_D_AVANT)
    for cible, _ in TAILLES:
        ecrites.add(phrase_de_grille(cible))
        ecrites.add(phrase_de_calage(cible))
    return frozenset(ecrites)


def sans_phrase_du_produit(texte: str) -> str:
    """Le texte d'une case, débarrassé de ce que le produit y avait écrit.

    **La migration du 1ᵉʳ septembre 2026, et elle tient en une fonction.** Les
    fichiers écrits avant portent la phrase du produit *dans* la case — seule,
    quand personne n'a rien ajouté, ou collée devant le texte de l'auteur avec
    une virgule quand une étiquette est passée par là. Les deux se relisent ici.

    **Les plus longues d'abord** : `single isolated sprite …, strict 8x8 px tile
    snap` et son jumeau en 128 partagent tout sauf leur nombre, et retirer la
    courte avant la longue laisserait des miettes. Trier par longueur
    décroissante est la seule précaution que ce retrait demande.

    Ce qu'il reste est **le texte de l'auteur, et rien d'autre** — d'où le
    nettoyage des virgules orphelines que le retrait laisse derrière lui. Un
    texte qui ne contenait aucune phrase du produit ressort mot pour mot.
    """
    reste = texte
    for phrase in sorted(phrases_du_produit(), key=len, reverse=True):
        if phrase and phrase in reste:
            reste = reste.replace(phrase, "")
    # Les séparateurs que le retrait laisse : une virgule en tête, une en queue,
    # deux qui se suivent. Nettoyés ici plutôt que devinés par l'appelant.
    reste = re.sub(r"\s*,\s*(?=,)", "", reste)
    return reste.strip().strip(",").strip()
