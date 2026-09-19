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
(`docs/archive/plan-versions-tenues.md` C1). Rien ici ne part vers le fournisseur, et rien ici ne coûte.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

# ── Ce que le produit sait dire en anglais, par identifiant de pose (E10) ────
#
# **La reprise des projets d'avant E10, et rien d'autre.** Une pose relue d'un
# fichier écrit avant cette étape n'a pas de consigne : son nom français partait
# au milieu d'une phrase anglaise. Cette table-ci rend l'anglais à celles que le
# produit avait proposées lui-même — **sans réécrire un seul fichier**, puisque
# c'est une lecture (`Pose.dit`).
#
# **Les six attitudes d'un personnage, et elles seules.** C'était le plan que
# tous les projets partageaient avant E9 : c'est donc exactement ce qu'un
# fichier d'avant contient. Les listes des autres types portent leur consigne
# avec elles, plus bas, là où le type lève l'ambiguïté — `repos` ne veut pas
# dire la même chose pour un personnage et pour un bouton, et une table indexée
# par le seul identifiant ne saurait pas les distinguer.
CONSIGNES: dict[str, str] = {
    "repos": "idle stance, full body",
    "marche": "walking posture, full body",
    "course": "running posture, full body",
    "attaque": "attacking posture, full body",
    "degats": "hurt reaction, recoiling, full body",
    "mort": "dead, lying on the ground",
}


@dataclass(frozen=True, slots=True)
class Pose:
    """Une attitude que le jeu réclame, et combien d'images il en faut."""

    identifiant: str
    nom: str

    # **Combien d'images cette pose demande.** Un pour la plupart ; quatre ou
    # huit pour un cycle, quand l'auteur le décide. Le défaut n'engage rien —
    # une pose qui en demande quatre est une décision d'auteur, pas un défaut du
    # produit —, et c'est lui qui rend une case « faite » dès la première image.
    #
    # **Son sens a changé en E10, et c'est une décision assumée.** Il ne compte
    # plus les angles sous lesquels on voit la chose — ça, c'est la liste des
    # directions —, mais **les étapes d'un mouvement**, direction par direction.
    # La ligne d'une pose est déjà la bande de son animation, et elle le reste.
    images: int = 1

    # ── Ce qui part au modèle, en anglais (E10) ──────────────────────────────
    #
    # **Le nom se lit, la consigne part.** Jusqu'à E10 c'était le même texte :
    # le nom français d'une pose partait au milieu d'une phrase anglaise, et
    # `docs/PLAN.md` E10 nomme la contradiction — *ce qui part se contredisait
    # dans la même phrase*. Les séparer coûte un champ et répare ça d'un coup.
    #
    # **Vide n'est pas un trou** : c'est une pose que le produit n'a pas
    # proposée, donc qu'il ne sait pas dire en anglais. Il ne traduit pas à la
    # place de l'auteur — inventer un texte qui partira dans un appel payé n'est
    # pas une commodité, c'est une dépense décidée par quelqu'un d'autre. Le nom
    # part alors tel quel, comme avant E10, et l'écran le dit.
    consigne: str = ""

    # ── Les directions que cette pose ne tient pas, pour tout le projet (E10) ─
    #
    # **La portée large des deux** : une mort n'a qu'un seul angle, quel que
    # soit le personnage, et se le dire une fois vaut mieux que de le redire sur
    # chacun. La portée étroite — *ce dragon n'attaque que vers le sud* — vit
    # sur la chose du jeu (`atelier/domaine/personnage.py`).
    #
    # **On range ce qu'on ne tient pas, on ne coche pas ce qu'on tient**, comme
    # pour les poses depuis C1 : ajouter une direction au jeu doit faire paraître
    # une case vide partout sans réécrire un seul fichier.
    ecartees: tuple[str, ...] = ()

    # ── Ce que cette pose demandait avant que le produit ne le baisse (E10) ───
    #
    # **Un champ qui ne porte qu'une chose : sa propre défaite.** Déclarer quatre
    # directions ferait passer un personnage de douze cases à quarante-huit d'un
    # coup ; le produit propose donc de ramener le nombre d'images à un, avec sa
    # raison écrite. Zéro veut dire *rien à défaire* — soit la proposition n'a
    # pas été prise, soit l'auteur a retouché le chiffre lui-même depuis, ce qui
    # l'efface.
    #
    # **Gardé sur le disque plutôt que dans l'écran**, parce que tout l'intérêt
    # de la proposition est de ne pas prendre l'auteur en traître : une défaite
    # qui disparaîtrait au rechargement laisserait le piège ouvert.
    images_avant: int = 0

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "images": self.images,
            "consigne": self.consigne,
            "ecartees": list(self.ecartees),
            "images_avant": self.images_avant,
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
            consigne=str(d.get("consigne") or ""),
            ecartees=tuple(
                str(e) for e in (d.get("ecartees") or ()) if isinstance(e, str) and e
            ),
            images_avant=max(0, int(d.get("images_avant", 0) or 0)),
        )

    def dit(self) -> str:
        """Ce que cette pose envoie au modèle — **et rien de français dedans**.

        Trois réponses, dans cet ordre. La consigne écrite ici. Sinon celle que
        le produit propose pour une pose de cet identifiant-là, ce qui reprend
        les projets d'avant E10 sans qu'un fichier soit réécrit : un plan fait de
        `repos`, `marche` et `mort` part en anglais dès la première génération
        qui suit. Sinon le nom, comme avant E10 — c'est une pose que l'auteur a
        nommée lui-même, et le produit ne la traduit pas à sa place.
        """
        return self.consigne.strip() or CONSIGNES.get(self.identifiant, "") or self.nom


# Le plan d'un projet neuf. **Des cases de départ, pas une table de vérité** :
# elles se renomment, se retirent et se complètent projet par projet, et un jeu
# de gestion de taverne n'a que faire d'une pose de mort. Six parce que c'est ce
# qu'un personnage de jeu d'action réclame au minimum, et parce qu'une liste
# qu'on doit d'abord élaguer décourage autant qu'une liste vide.
#
# Le nom d'une pose **part dans le prompt** au moment de générer : il est donc du
# texte d'auteur, et se réécrit d'un geste dans la langue de ses prompts.
#
# **Deux textes par pose depuis E10** : le nom, qu'on lit, et la consigne, qui
# part. Ce sont les mêmes que `CONSIGNES` plus haut — écrites là pour les projets
# d'avant, ici pour les projets neufs, et le même geste les corrige toutes deux.
PLAN_PAR_DEFAUT: tuple[Pose, ...] = tuple(
    Pose(identifiant, nom, consigne=CONSIGNES[identifiant])
    for identifiant, nom in (
        ("repos", "repos"),
        ("marche", "marche"),
        ("course", "course"),
        ("attaque", "attaque"),
        ("degats", "dégâts"),
        ("mort", "mort"),
    )
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
    # ── Trois consignes corrigées le 1ᵉʳ septembre 2026, sur images payées ────
    #
    # **Une consigne d'état ne doit pas décrire un objet qu'on n'a pas décrit.**
    # Le banc des deux jeux (`essais/essai_deux_jeux.py`) a demandé une carte
    # d'accès en `objet tenu` : la consigne disait `held in one hand`, et les
    # deux images sont revenues avec **une main** que personne n'avait décrite.
    # Un objet tenu se range dans l'inventaire ; la main appartient au
    # personnage, et elle se compose à l'usage. La consigne dit donc l'angle —
    # celui sous lequel l'objet sera tenu — et rien de plus.
    #
    # **Et un meuble n'est pas toujours un coffre.** `open, lid raised` a fait
    # lever un couvercle à un distributeur de boissons. Le mot `lid` décrivait
    # la seule chose que la liste avait en tête en naissant ; il part maintenant,
    # et ce qui reste — *ouvert, ce qu'il contient est visible* — est vrai d'un
    # coffre, d'une armoire et d'un distributeur.
    "meuble": (
        Pose("ferme", "fermé", consigne="closed, its contents hidden"),
        Pose("ouvert", "ouvert", consigne="open, its contents visible"),
        Pose("vide", "vidé", consigne="open and empty, its contents gone"),
    ),
    "objet posé": (
        Pose("pose", "posé", consigne="the item alone, resting on the ground"),
    ),
    "objet tenu": (
        Pose(
            "tenu",
            "tenu",
            consigne="the item alone, angled the way it is held — no hand, "
            "no arm, nothing holding it",
        ),
    ),
    "décor": (),
    # **Une tuile n'a pas de poses**, et c'est un fait sur ce qu'une tuile est :
    # elle ne bouge pas, elle se raccorde. Lui montrer une rangée grisée
    # reviendrait à lui promettre qu'elle en aura un jour.
    "tuile": (),
    # Une matière non plus : elle se répète, elle ne bouge pas (TU2).
    "matière": (),
    # **`repos` ne dit pas ici ce qu'il dit pour un personnage**, et c'est
    # pourquoi la consigne est écrite sur la pose plutôt que déduite de son
    # identifiant : un bouton au repos est dans son état par défaut, il n'est
    # pas debout les bras ballants.
    "élément d'interface": (
        Pose("repos", "repos", consigne="default resting state"),
        Pose("survol", "survol", consigne="hover state, highlighted"),
        Pose("presse", "pressé", consigne="pressed state, depressed"),
        Pose("inactif", "inactif", consigne="disabled state, dimmed"),
    ),
}


# Les types dont le produit **sait** qu'ils n'ont pas de poses. C'est une
# affirmation, pas un défaut qu'on n'aurait pas rempli : un décor et une tuile ne
# bougent pas, ils se raccordent. La distinction compte, parce qu'elle décide de
# ce qui retombe sur le plan du projet et de ce qui reste vide.
SANS_POSES = frozenset({"décor", "tuile", "matière"})

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
