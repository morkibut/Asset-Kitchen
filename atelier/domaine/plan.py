# -*- coding: utf-8 -*-
"""Le plan de poses — **la liste des cases à remplir, portée par le projet**.

Un jeu a besoin des mêmes attitudes pour chacun de ses personnages : au repos,
en marche, touché, mort. Cette liste-là est écrite une fois, sur le projet, et
tous ses personnages s'y comparent (US-116). Ce ne sont pas des images : c'est
ce qui permet de dire *il manque la mort du nain* sans tenir la liste dans sa
tête.

**Une pose porte un identifiant, et c'est ce qui la rend renommable.** Les
images générées désignent leur pose ; si elles la désignaient par son nom, la
renommer — que `docs/PLAN.md` autorise « à tout moment » — orphelinerait d'un
coup tout ce qui est déjà fait. L'identifiant se dérive du nom de départ, comme
le repère d'un projet, pour que `donnees/` reste lisible à la main : la pose
« Marche » s'écrit `marche` dans le fichier d'un asset, et le reste même
rebaptisée « Déplacement ».

**Un seul plan par projet, et il n'a donc pas de nom.** Le découpage de la V2 en
prévoyait plusieurs, nommés, entre lesquels chaque personnage aurait choisi ;
c'est inutile tant qu'un personnage peut **écarter** les poses qu'il ne tient
pas (US-117) — un figurant et un héros se comparent alors au même plan, l'un en
cochant moins de cases. Deux façons concurrentes de dire « ce personnage n'a pas
besoin de ça » auraient fini par se contredire. Le nom reviendra avec le second
plan, s'il vient : `docs/archi-versions.md` §7 porte la décision.

**Ajouter une pose n'ajoute qu'une case vide, jamais une génération**
(`docs/PLAN.md` C1). Rien ici ne part vers le fournisseur, et rien ici ne coûte.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class Pose:
    """Une attitude que le jeu réclame, et combien d'images il en faut."""

    identifiant: str
    nom: str

    # **Combien d'images cette pose demande.** Un pour la plupart ; quatre ou
    # huit pour un cycle, quand l'auteur le décide. Le défaut n'engage rien —
    # une pose qui en demande quatre est une décision d'auteur, pas un défaut du
    # produit —, et c'est lui qui rend une case « faite » dès la première image.
    images: int = 1

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "images": self.images,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Pose":
        identifiant = str(d.get("identifiant") or "")
        return Pose(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            # Une pose qui demanderait zéro image serait une ligne qu'aucune
            # génération ne pourrait jamais remplir : le plancher est à un.
            images=max(1, int(d.get("images", 1) or 1)),
        )


# Le plan d'un projet neuf. **Des cases de départ, pas une table de vérité** :
# elles se renomment, se retirent et se complètent projet par projet, et un jeu
# de gestion de taverne n'a que faire d'une pose de mort. Six parce que c'est ce
# qu'un personnage de jeu d'action réclame au minimum, et parce qu'une liste
# qu'on doit d'abord élaguer décourage autant qu'une liste vide.
#
# Le nom d'une pose **part dans le prompt** au moment de générer : il est donc du
# texte d'auteur, et se réécrit d'un geste dans la langue de ses prompts.
PLAN_PAR_DEFAUT: tuple[Pose, ...] = (
    Pose("repos", "repos"),
    Pose("marche", "marche"),
    Pose("course", "course"),
    Pose("attaque", "attaque"),
    Pose("degats", "dégâts"),
    Pose("mort", "mort"),
)


def plan_depuis_json(brut: Any) -> tuple[Pose, ...]:
    """Le plan relu du fichier d'un projet.

    **L'absence et le vide ne se lisent pas pareil, et c'est la décision.** Un
    projet qui n'a jamais écrit de plan — tous ceux d'avant C1 — en reçoit un,
    utilisable sans qu'aucune ligne n'ait été écrite ; un projet dont l'auteur a
    retiré toutes les poses garde son plan vide. Le motif `lu or DEFAUT` qui
    sert au barème ferait ici ressusciter, à chaque relecture, très exactement ce
    que l'auteur venait de retirer.

    Une pose sans identifiant est sautée plutôt que de faire tomber la lecture :
    un plan à cinq poses au lieu de six se répare d'un clic, un projet qui ne
    s'ouvre plus ne se répare pas.
    """
    if brut is None:
        return PLAN_PAR_DEFAUT
    if not isinstance(brut, Iterable):  # pragma: no cover — fichier abîmé
        return PLAN_PAR_DEFAUT
    poses = [
        Pose.depuis_json(p)
        for p in brut
        if isinstance(p, dict) and p.get("identifiant")
    ]
    # Deux poses de même identifiant seraient deux lignes que la matrice ne
    # saurait pas distinguer : la première gagne, la seconde disparaît.
    vues: set[str] = set()
    retenues: list[Pose] = []
    for pose in poses:
        if pose.identifiant in vues:
            continue
        vues.add(pose.identifiant)
        retenues.append(pose)
    return tuple(retenues)


# ── Les listes de départ, par type d'objet (E9) ──────────────────────────────
#
# **La liste des poses quitte le projet pour le type d'objet.** Avant, le jeu
# déclarait une seule liste et tout la recevait : un coffre héritait de *marche*
# et de *course*, qu'il fallait ranger une par une, sur chaque coffre. Désormais
# un personnage a ses six attitudes, un meuble ses trois états, et **une tuile
# n'a pas de poses du tout** — pas une rangée grisée, rien.
#
# **Des cases de départ, pas une table de vérité** : elles se renomment, se
# retirent et se complètent type par type. Un type absent de cette table reçoit
# une liste vide, ce qui est la réponse honnête — le produit ne sait pas ce
# qu'un type qu'il ne connaît pas réclame.

PLANS_PAR_TYPE: dict[str, tuple[Pose, ...]] = {
    "personnage": PLAN_PAR_DEFAUT,
    "créature": PLAN_PAR_DEFAUT,
    "meuble": (
        Pose("ferme", "fermé"),
        Pose("ouvert", "ouvert"),
        Pose("vide", "vidé"),
    ),
    "objet posé": (Pose("pose", "posé"),),
    "objet tenu": (Pose("tenu", "tenu"),),
    "décor": (),
    # **Une tuile n'a pas de poses**, et c'est un fait sur ce qu'une tuile est :
    # elle ne bouge pas, elle se raccorde. Lui montrer une rangée grisée
    # reviendrait à lui promettre qu'elle en aura un jour.
    "tuile": (),
    "élément d'interface": (
        Pose("repos", "repos"),
        Pose("survol", "survol"),
        Pose("presse", "pressé"),
        Pose("inactif", "inactif"),
    ),
}


# Les types dont le produit **sait** qu'ils n'ont pas de poses. C'est une
# affirmation, pas un défaut qu'on n'aurait pas rempli : un décor et une tuile ne
# bougent pas, ils se raccordent. La distinction compte, parce qu'elle décide de
# ce qui retombe sur le plan du projet et de ce qui reste vide.
SANS_POSES = frozenset({"décor", "tuile"})

# **Les deux types qui suivent le plan du jeu**, tant qu'ils n'écrivent pas le
# leur. C'est la reprise, et elle est nommée plutôt que devinée : une pose
# ajoutée au plan du jeu doit continuer de paraître chez les personnages et les
# créatures — c'est ce que « nommer, c'est créer » promet depuis la première
# version. Figer ces deux-là sur la liste de départ aurait fait disparaître
# l'attitude que l'auteur vient d'écrire pour tout le monde.
SUIT_LE_JEU = frozenset({"personnage", "créature"})


def suit_le_plan_du_jeu(nom: str) -> bool:
    """Ce type-là n'a pas de liste à lui : il **suit le plan du jeu**.

    Deux cas, et c'est le même effet. Le personnage et la créature, parce que
    c'est ce que le jeu déclare depuis toujours et qu'une attitude ajoutée au
    plan doit continuer de leur paraître. Un type que le produit ne connaît pas,
    parce que l'ignorance retombe sur ce qui existait plutôt que d'effacer des
    cases.

    Écrit ici et lu deux fois — par la liste elle-même et par la phrase qui dit
    d'où elle vient. Deux conditions écrites à deux endroits auraient fini par
    montrer « choisie » sur une liste héritée.
    """
    return nom in SUIT_LE_JEU or nom not in PLANS_PAR_TYPE


def plan_du_type(nom: str) -> tuple[Pose, ...]:
    """Ce qu'un type d'objet réclame, avant qu'on y touche.

    Rend une liste vide pour un type inconnu : le produit ne devine pas ce
    qu'une catégorie qu'il n'a jamais vue demande, et une liste inventée serait
    pire qu'une liste absente — il faudrait la ranger.
    """
    return PLANS_PAR_TYPE.get(nom, ())
