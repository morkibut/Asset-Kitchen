# -*- coding: utf-8 -*-
"""Le style de combat — **comment ce personnage-là se bat**.

Demandé par l'auteur le 18 septembre 2026, en même temps que le plan
`docs/PLAN-styles-de-combat.md` : les attaques animées par Wan 2.2 sont
mauvaises parce que le texte envoyé (*attack, winding up, striking
forward…*) ne dit ni le geste, ni la partie du corps, ni l'arme. Le
mouvement (`A6`) dit déjà *quel cycle* — une attaque, un repos — mais pas
*comment* ce cycle-là se joue pour ce personnage : à mains nues, au bâton,
à l'arc. C'est ce que le style ajoute.

**Un style porte un texte par mouvement, pas un seul texte.** « Bâton à
deux mains » dit son attaque, et peut dire aussi son repos (garde levée) ;
un mouvement qu'il ne dit pas garde le texte du mouvement — c'est
`texte_du_style` qui rend cette absence lisible, en rendant une chaîne
vide plutôt qu'en inventant.

**Même contrat que le mouvement et que l'étiquette : deux origines, une
seule liste.** Les **livrés** arrivent avec l'atelier — un catalogue d'au
moins dix styles, choisi pour couvrir les familles d'armes courantes d'un
jeu de combat — ; les **fabriqués** sont ce que l'auteur a nommé. Un style
appartient au jeu, comme un mouvement depuis le 18 septembre 2026 : un
style d'attaque n'a pas sa place dans tous les jeux, et un jeu lit la
bibliothèque de l'atelier tant qu'il n'y a rien changé (`ServiceStyles`,
`Fichiers.lire_styles`).

**Rien ici ne part au fournisseur et rien ici ne coûte** : c'est du
vocabulaire, exactement comme le mouvement.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from atelier.domaine.mouvement import repere  # même repère, même règle


@dataclass(frozen=True, slots=True)
class Style:
    """Un style de combat : son nom, ce qu'il tient en main, un texte par mouvement.

    **L'identifiant ne bouge pas quand le nom change**, comme pour un
    mouvement : c'est lui qui accroche le style au personnage ou à la pièce
    qui le déclare (`SC2`), et renommer « bâton » en « bâton à deux mains »
    ne doit pas défaire ce lien.
    """

    identifiant: str
    # Le nom français — **ce qu'on lit**, et rien d'autre.
    nom: str
    # Ce que le style tient en main, en anglais, tel qu'il part au modèle —
    # « a long wooden staff held in both hands ». **Vide veut dire mains
    # nues** : tous les styles ne tiennent pas un objet, et forcer un champ
    # non vide aurait fait écrire « nothing » un peu partout.
    tient: str = ""
    # Le texte anglais par mouvement — **des paires, pas un dictionnaire**,
    # pour rester un champ figé d'une dataclass gelée, comme les directions
    # d'un mouvement sont un tuple et non une liste. `texte_du_style` lit
    # cette liste ; `en_json`/`depuis_json` la traduisent en dictionnaire au
    # bord, là où JSON en a besoin.
    textes: tuple[tuple[str, str], ...] = ()

    # **D'où il vient**, comme pour un mouvement et une étiquette. Un livré
    # arrive avec l'atelier et est le même chez tout le monde ; un fabriqué
    # n'existe que dans ce jeu-ci. Ne décide d'aucun comportement, sauf de ce
    # qui arrive quand on le masque.
    livre: bool = False

    # **Masqué n'est pas supprimé.** Le catalogue des livrés se relit à
    # chaque lecture : effacer un livré le ferait revenir à la ligne
    # suivante. Un fabriqué masqué, lui, s'en va pour de bon.
    masque: bool = False

    def texte(self, mouvement: str) -> str:
        """Le texte que ce style dit pour ce mouvement, ou `""` s'il ne le dit pas."""
        for nom_mouvement, texte in self.textes:
            if nom_mouvement == mouvement:
                return texte
        return ""

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "tient": self.tient,
            "textes": {m: t for m, t in self.textes},
            "livre": self.livre,
            "masque": self.masque,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Style":
        identifiant = str(d.get("identifiant") or "")
        brut = d.get("textes")
        paires = brut.items() if isinstance(brut, dict) else ()
        textes = tuple(
            (str(mouvement), str(texte))
            for mouvement, texte in paires
            if isinstance(mouvement, str)
            and mouvement
            and isinstance(texte, str)
            and texte
        )
        return Style(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            tient=str(d.get("tient") or ""),
            textes=textes,
            livre=bool(d.get("livre", False)),
            masque=bool(d.get("masque", False)),
        )


def styles_depuis_json(brut: Any) -> tuple[Style, ...]:
    """La base relue du fichier — **et rien n'y est inventé**.

    Même garde que `mouvements_depuis_json` : un style sans identifiant est
    sauté plutôt que de faire tomber la lecture, et un identifiant en double
    ne garde que le premier.
    """
    if not isinstance(brut, (list, tuple)):
        return ()
    lus = (
        Style.depuis_json(s)
        for s in brut
        if isinstance(s, dict) and s.get("identifiant")
    )
    vus: set[str] = set()
    retenus: list[Style] = []
    for style in lus:
        if style.identifiant in vus or not style.identifiant:
            continue
        vus.add(style.identifiant)
        retenus.append(style)
    return tuple(retenus)


def texte_du_style(style: Style | None, mouvement: str) -> str:
    """Le texte du style pour ce mouvement, **ou `""` s'il ne le dit pas**.

    `style` peut être `None` — un personnage sans style choisi ni pièce qui
    en déclare un (`SC2`) — et c'est la même réponse que s'il existait sans
    rien dire pour ce mouvement : aucun style ne fait rien partir de plus.
    """
    if style is None:
        return ""
    return style.texte(mouvement)


# ── Les styles que l'atelier apporte avec lui ────────────────────────────────
#
# **Dix styles, choisis pour couvrir les familles d'armes courantes d'un jeu
# de combat.** Chaque texte livré nomme la main ou la partie du corps qui
# agit, nomme l'objet tenu quand il y en a un, et revient à la position de
# départ sur place — c'est le critère d'acceptation de `SC1`, et les textes
# ci-dessous en sont la preuve, pas seulement l'intention.
#
# **Recopié tel quel depuis le catalogue livré à la tranche** — rien n'est
# reformulé ici, pour que le texte qui part au modèle soit exactement celui
# qui a été relu et approuvé.
_CATALOGUE: tuple[dict[str, Any], ...] = (
    {
        "identifiant": "mains-nues",
        "nom": "mains nues",
        "tient": "",
        "textes": {
            "attaque": (
                "a simple punch with bare fists, staying in place: the right "
                "fist draws back to the chest in a short wind-up, then punches "
                "straight forward at shoulder height, arm fully extended, and "
                "pulls back, then returns to the starting stance"
            ),
            "repos": (
                "fighting guard idle with bare fists raised in front of the "
                "chest, knees slightly bent, feet planted, staying in place; the "
                "body bobs gently with breathing and the fists sway a little, "
                "looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "karate",
        "nom": "karaté",
        "tient": "",
        "textes": {
            "attaque": (
                "a karate front kick, bare hands held in guard, staying in "
                "place: the right knee lifts to the chest in a short wind-up, "
                "the right foot snaps straight forward at waist height, the leg "
                "folds back down, then returns to the starting stance"
            ),
            "repos": (
                "karate guard idle in a low wide stance, knees bent, feet "
                "planted, bare open hands held forward, the left hand ahead of "
                "the right, staying in place; the hands shift slightly and the "
                "chest breathes, looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "arme-une-main",
        "nom": "arme à une main",
        "tient": "a one-handed sword held in the right hand",
        "textes": {
            "attaque": (
                "a slash with the sword in the right hand, staying in place: "
                "the right arm raises the sword above the shoulder in a short "
                "wind-up, then swings it down and forward in one diagonal cut, "
                "then returns to the starting stance"
            ),
            "repos": (
                "guard idle holding the sword in the right hand, blade raised "
                "forward at waist height, left hand loose at the side, knees "
                "slightly bent, feet planted, staying in place; the sword tip "
                "sways gently with breathing, looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "arme-lourde",
        "nom": "arme lourde",
        "tient": "a heavy two-handed axe gripped in both hands",
        "textes": {
            "attaque": (
                "a heavy overhead blow with the two-handed axe gripped in both "
                "hands, staying in place: both arms lift the axe high above the "
                "head in a short wind-up, then swing it down forward in one "
                "chop to knee height, then returns to the starting stance"
            ),
            "repos": (
                "heavy guard idle with the two-handed axe gripped in both "
                "hands, the axe head held low in front, wide stance, feet "
                "planted, staying in place; the shoulders rise and fall with "
                "slow heavy breathing, looping seamlessly"
            ),
            "course": (
                "running cycle holding the two-handed axe with both hands, its "
                "haft resting on the right shoulder, arms steady, legs pumping, "
                "staying in place without moving across the frame, looping "
                "seamlessly"
            ),
        },
    },
    {
        "identifiant": "baton",
        "nom": "bâton",
        "tient": "a long wooden staff held in both hands",
        "textes": {
            "attaque": (
                "a horizontal swing with the wooden staff held in both hands, "
                "staying in place: the torso twists back, staff drawn to the "
                "hip, in a short wind-up, then swings the staff forward in a "
                "flat arc at chest height, then returns to the starting stance"
            ),
            "repos": (
                "guard idle with the wooden staff held across the body in both "
                "hands, one end pointing forward and slightly down, knees bent, "
                "feet planted, staying in place; the staff rises and falls "
                "gently with breathing, looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "lance",
        "nom": "lance",
        "tient": "a spear held in both hands along the body",
        "textes": {
            "attaque": (
                "a spear thrust with both hands on the shaft, staying in "
                "place: the arms draw the spear back to the hip in a short "
                "wind-up, then drive the spear point straight forward at chest "
                "height, arms fully extended, then returns to the starting "
                "stance"
            ),
            "repos": (
                "guard idle holding the spear in both hands, point aimed "
                "forward at chest height, butt of the shaft behind the hip, "
                "knees slightly bent, feet planted, staying in place; the spear "
                "point bobs gently with breathing, looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "dagues",
        "nom": "deux dagues",
        "tient": "a dagger in each hand",
        "textes": {
            "attaque": (
                "a quick stab with the dagger in the right hand, the left hand "
                "keeping its dagger close to the chest, staying in place: the "
                "right arm cocks back in a short wind-up, then stabs forward at "
                "chest height, then returns to the starting stance"
            ),
            "repos": (
                "crouched guard idle with a dagger in each hand, both blades "
                "held low and forward, knees bent, weight on the toes, staying "
                "in place; the body sways lightly and the daggers stay ready, "
                "looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "arc",
        "nom": "arc",
        "tient": "a bow held in the left hand",
        "textes": {
            "attaque": (
                "a bow shot, the bow held in the left hand, staying in place: "
                "the left arm raises the bow forward while the right hand draws "
                "the string back to the cheek in a short wind-up, then lets the "
                "string go, then returns to the starting stance"
            ),
            "repos": (
                "ready idle holding the bow in the left hand, lowered in front "
                "of the body, the right hand resting near the string, feet "
                "planted, staying in place; the shoulders rise and fall with "
                "calm breathing, looping seamlessly"
            ),
            "course": (
                "running cycle with the bow held low in the left hand, the "
                "right arm swinging freely, the bow kept steady at the side, "
                "staying in place without moving across the frame, looping "
                "seamlessly"
            ),
        },
    },
    {
        "identifiant": "magie",
        "nom": "magie",
        "tient": "a short magic wand held in the right hand",
        "textes": {
            "attaque": (
                "a spell cast with the wand in the right hand, staying in "
                "place: the right arm draws the wand back to the shoulder in a "
                "short wind-up, then thrusts it forward as a small spark "
                "flashes at the wand tip, then returns to the starting stance"
            ),
            "repos": (
                "casting guard idle holding the wand in the right hand, raised "
                "forward at chest height, left hand open at the side, feet "
                "planted, staying in place; a faint glow pulses softly at the "
                "wand tip with breathing, looping seamlessly"
            ),
        },
    },
    {
        "identifiant": "bouclier",
        "nom": "bouclier et arme",
        "tient": "a shield on the left arm and a sword in the right hand",
        "textes": {
            "attaque": (
                "a sword strike past the shield, staying in place: the left "
                "arm keeps the shield raised in front of the chest while the "
                "right arm draws the sword back in a short wind-up, then "
                "slashes forward past the shield edge, then returns to the "
                "starting stance"
            ),
            "repos": (
                "shield guard idle, the left arm holding the shield raised in "
                "front of the chest, the sword ready in the right hand at the "
                "hip, knees bent, feet planted, staying in place; the shoulders "
                "rise and fall gently, looping seamlessly"
            ),
        },
    },
)


def _style_livre(brut: dict[str, Any]) -> Style:
    textes = tuple((m, t) for m, t in brut["textes"].items())
    return Style(
        identifiant=brut["identifiant"],
        nom=brut["nom"],
        tient=brut["tient"],
        textes=textes,
        livre=True,
    )


LIVRES: tuple[Style, ...] = tuple(_style_livre(brut) for brut in _CATALOGUE)


__all__ = ["Style", "LIVRES", "styles_depuis_json", "texte_du_style", "repere"]
