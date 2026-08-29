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
