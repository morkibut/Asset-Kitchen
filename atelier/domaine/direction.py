# -*- coding: utf-8 -*-
"""Les directions du jeu — **le second axe d'une case, et le premier qui manquait**.

Dans un jeu vu de dessus, un personnage qui marche se dessine quatre fois : vers
le bas, vers le haut, vers la gauche, vers la droite. Jusqu'à E10 le produit ne
connaissait pas cette idée. Il connaissait une pose appelée « marche » et un
nombre d'images à remplir — **sans savoir ce que chacune de ces images devait
montrer**. Il ne pouvait donc pas dire qu'il manquait le nord.

**Ce que ça coûtait est mesuré sur le vrai projet.** La direction était écrite à
la main dans la case `technique` de la bible — `4-directional orientation` — et
partait avec les vingt-huit générations, dont six planches d'équipement où elle
contredisait la consigne de l'appel. Et sur une génération, l'auteur avait tapé
la direction dans le champ de prompt lui-même : *The dwarf is in walking posture
in south direction*. Sept endroits sans lien entre eux.

**Une direction porte deux textes, et un seul part.** Le nom est en français,
parce qu'on le lit ; la consigne est en anglais, parce qu'elle part. C'est le
même partage que la pose depuis E10 (`atelier/domaine/plan.py`), et il est fait
pour la même raison : ce qui se lit et ce qui part ne sont pas le même texte, et
les confondre faisait partir « sud » au milieu d'une phrase anglaise.

**Écrite une fois sur la direction, jamais recopiée sur les poses.** Six poses
dans quatre directions, c'est vingt-quatre cases ; écrire `facing south` sur
chacune ferait vingt-quatre copies d'un texte qu'une correction devrait ensuite
retrouver une par une. La consigne d'une image se **compose** de l'attitude et
de la direction, au moment de générer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class Direction:
    """Un angle sous lequel le jeu regarde une chose, et ce qu'il en dit.

    **L'identifiant ne bouge pas quand le nom change**, exactement comme pour
    une pose : les images faites portent l'identifiant de leur direction, et
    renommer « sud » en « vers le joueur » ne doit pas leur faire perdre leur
    case.
    """

    identifiant: str
    nom: str

    # **Ce qui part au modèle, en anglais.** Vide est une valeur : une direction
    # sans consigne ne dit rien au modèle, et c'est le cas d'une direction que
    # l'auteur vient d'ajouter et n'a pas encore décrite. Le produit ne traduit
    # pas à sa place — il n'invente pas un texte qui partira dans un appel payé.
    consigne: str = ""

    # **Ce qui part en tête d'une animation**, en anglais (18 septembre 2026).
    # Pas la consigne : celle-là décrit une image fixe (*facing north, toward the
    # top of the image*), et les mots n'y imposent pas l'orientation. Dans un
    # clip, l'image de départ montre déjà le personnage dans le bon sens ; la
    # phrase dit alors **d'où on le voit et vers où va le geste**. Vide, c'est
    # la phrase livrée pour cet identifiant qui part (`phrase_animee`).
    animation: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "consigne": self.consigne,
            # Écrite seulement remplie : un projet sans phrase garde son fichier
            # caractère pour caractère.
            **({"animation": self.animation} if self.animation else {}),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Direction":
        identifiant = str(d.get("identifiant") or "")
        return Direction(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            consigne=str(d.get("consigne") or ""),
            animation=str(d.get("animation") or ""),
        )


def directions_depuis_json(brut: Any) -> tuple[Direction, ...] | None:
    """La liste relue du fichier d'un projet — **et l'absence en vaut une**.

    `None` veut dire *jamais écrite*, et la liste se lit alors dans la vue du
    jeu : c'est l'état ordinaire, celui que le codex affiche « lues ». Une liste
    vide veut dire *l'auteur les a toutes retirées*, et elle reste vide. Le
    motif `lu or DEFAUT`, qui sert ailleurs, ferait ici ressusciter à chaque
    relecture très exactement ce que l'auteur venait de retirer — c'est déjà la
    décision de `plan_depuis_json` et celle des poses d'un type.
    """
    if brut is None:
        return None
    if not isinstance(brut, Iterable) or isinstance(brut, (str, bytes)):
        return None  # pragma: no cover — fichier abîmé
    lues = [
        Direction.depuis_json(d)
        for d in brut
        if isinstance(d, dict) and d.get("identifiant")
    ]
    # Deux directions de même identifiant seraient deux colonnes que la matrice
    # ne saurait pas distinguer : la première gagne.
    vues: set[str] = set()
    retenues: list[Direction] = []
    for direction in lues:
        if direction.identifiant in vues:
            continue
        vues.add(direction.identifiant)
        retenues.append(direction)
    return tuple(retenues)


# ── Ce qu'un miroir gauche-droite fait d'une direction (B1) ──────────────────
#
# **La table ne connaît que les identifiants que le produit livre, et elle
# n'invente rien.** Ils viennent de `atelier/domaine/vue.py` — `_CARDINALES`,
# `HUIT`, `DEUX` — et de nulle part ailleurs.
#
# `sud` et `nord` se rendent eux-mêmes, et c'est juste : un miroir gauche-droite
# ne montre pas le dos d'un personnage. La planche le dit en trois mots — *le
# nord se paie* —, et c'est l'écran qui doit l'annoncer **avant** le clic, pas le
# service après.
_AU_MIROIR: dict[str, str] = {
    "est": "ouest",
    "ouest": "est",
    "droite": "gauche",
    "gauche": "droite",
    "nord-est": "nord-ouest",
    "nord-ouest": "nord-est",
    "sud-est": "sud-ouest",
    "sud-ouest": "sud-est",
    "sud": "sud",
    "nord": "nord",
}


def direction_au_miroir(identifiant: str | None) -> str | None:
    """Où se range l'image retournée — **et rien quand on ne sait pas**.

    Même idiome que `durcissement_livre` dans `atelier/domaine/recette.py` : *ce
    qu'on ne connaît pas ne produit rien*. Les directions d'un projet sont
    libres, l'auteur les nomme et les renomme, et deviner qu'un mot français
    désigne une direction opposée serait très exactement la déduction que le
    produit refuse ailleurs — *vide ne veut pas dire sud*.

    **Mesuré le 6 septembre 2026 dans `donnees/atelier.sqlite3`** : les
    directions réellement écrites sur les 170 images du dépôt sont `bas` (12),
    `haut` (2) et `droite` (25). L'auteur a nommé les siennes, et ni `bas` ni
    `haut` n'appartiennent à une liste livrée : la table est donc **muette sur
    deux d'entre elles**, et c'est le comportement voulu. Le cas que la tranche
    sert vraiment est couvert — `michel` porte 25 images en `droite` et aucune en
    `gauche`.

    Ce que ça donne à l'écran : *la direction se propose quand on la connaît, et
    se demande quand on ne la connaît pas.* Le réglage **Ça se range en** accepte
    déjà le nom d'une direction du jeu, ou rien ; le défaut n'est qu'une
    proposition, et aucun geste n'est bloqué par une paire inconnue.

    Ce qui répare le fond — **déclarer le miroir sur la direction elle-même**,
    dans les règles du jeu — appartient à `B14`, pas ici.
    """
    return _AU_MIROIR.get(identifiant or "")


# ── Ce qu'une direction dit en tête d'une animation (18 septembre 2026) ──────
#
# **Relevé sur l'usage** : l'auteur écrivait à la main *The character is shown
# from behind, running north* pour que la course vers le nord garde le dos du
# personnage. Chaque phrase dit deux choses — d'où on le voit, vers où va le
# geste — et se repère au **cadre**, pas aux points cardinaux : « nord » ne dit
# rien à un modèle vidéo, « le haut de l'image » si. Seuls les identifiants que
# le produit livre (`atelier/domaine/vue.py`) ont une phrase ; une direction
# inventée n'en a pas, et rien n'est deviné pour elle.
PHRASES_ANIMEES: dict[str, str] = {
    "sud": "The character is seen from the front, facing the viewer; "
    "the motion is directed toward the bottom of the image.",
    "nord": "The character is seen from behind, its back to the viewer; "
    "the motion is directed toward the top of the image.",
    "est": "The character is seen from the side, facing right; "
    "the motion is directed toward the right of the image.",
    "ouest": "The character is seen from the side, facing left; "
    "the motion is directed toward the left of the image.",
    "droite": "The character is seen from the side, facing right; "
    "the motion is directed toward the right of the image.",
    "gauche": "The character is seen from the side, facing left; "
    "the motion is directed toward the left of the image.",
    "sud-est": "The character is seen three-quarters from the front, facing "
    "the lower right; the motion is directed toward the lower right of the image.",
    "sud-ouest": "The character is seen three-quarters from the front, facing "
    "the lower left; the motion is directed toward the lower left of the image.",
    "nord-est": "The character is seen three-quarters from behind, facing "
    "the upper right; the motion is directed toward the upper right of the image.",
    "nord-ouest": "The character is seen three-quarters from behind, facing "
    "the upper left; the motion is directed toward the upper left of the image.",
}


def phrase_animee(direction: Direction | None) -> str:
    """Ce que cette direction dit en tête d'un clip : la sienne, sinon la livrée."""
    if direction is None:
        return ""
    return direction.animation.strip() or PHRASES_ANIMEES.get(direction.identifiant, "")


def texte_du_clip(phrase: str, mouvement: str) -> str:
    """La direction d'abord, le mouvement ensuite — **deux phrases, pas une liste**.

    Le mouvement dit le geste (*running cycle, full body…*), la direction dit
    d'où on le regarde ; les coller par une virgule en ferait une seule phrase
    où le modèle ne saurait plus lequel des deux commande.
    """
    return " ".join(t for t in (phrase.strip(), mouvement.strip()) if t)


def composer(attitude: str, direction: str) -> str:
    """Les deux textes bout à bout — **et c'est tout ce que la composition est**.

    `walking posture, full body` + `facing south, toward the viewer` donne
    `walking posture, full body, facing south, toward the viewer`. Écrit ici
    plutôt qu'à deux endroits parce que le sujet d'une case et la case d'une
    planche le demandent tous les deux, et que deux façons de coller deux textes
    finiraient par en produire deux différents pour la même image.

    Un texte vide ne laisse pas de virgule derrière lui : une direction sans
    consigne — celle qu'on vient d'ajouter — ne doit pas faire partir un prompt
    qui se termine par une virgule.
    """
    return ", ".join(mot for mot in (attitude.strip(), direction.strip()) if mot)
