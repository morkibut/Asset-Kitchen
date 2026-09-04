# -*- coding: utf-8 -*-
"""Le mouvement — **ce que la même pose dit quand on l'anime**.

Arrivé en A6 (V3). Le produit sait déjà dire une pose : la case « marche » d'un
plan sait qu'elle s'écrit `walking posture, full body`. C'est une **posture
figée**, et c'est exactement ce qu'il faut pour une image. Un clip demande autre
chose : un **cycle qui boucle**, une cadence, et les directions où le mouvement
existe. Ce qui manquait n'est donc pas une liste, c'est cette moitié-là.

**Ce n'est surtout pas une seconde liste à côté des poses**, et c'est la
décision de la tranche. Deux listes concurrentes finiraient par diverger, et
l'auteur découvrirait l'écart sur une case, un jour, sans savoir laquelle des
deux ment. Le lien se fait donc **par l'identifiant** : la pose `marche` hérite
du mouvement `marche` sans que personne ait rien relié à la main, et une pose
que l'auteur a inventée n'hérite de rien — elle se commande quand même, avec le
texte qu'il écrit.

**Deux rangements qui ne se contredisent pas.** Le plan de poses appartient au
projet (invariant de `C1`) ; la recette d'un mouvement appartient à **l'atelier**
(décision durable de la V3). Le projet dit *quelles* cases il veut, l'atelier
sait *comment* chacune se dit. Une bibliothèque de mouvements se paie une fois —
en réflexion, pas en argent — et sert tous les jeux suivants.

**Ce que ça change au prix.** Deux tirages de la même intention partaient avec
deux textes différents, et l'écart entre eux était alors imputé au modèle. Un
mouvement nommé rend un clip **redemandable à l'identique** : ce qui varie d'un
tirage à l'autre redevient le tirage, et non la frappe.

**Rien ici ne part au fournisseur et rien ici ne coûte** : c'est du vocabulaire.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, replace
from typing import Any, Iterable

# La cadence d'une bande quand personne n'en règle une autre. Douze images par
# seconde est le compromis du pixel art : au-dessous le pas saccade, au-dessus
# on paie des images que l'œil ne distingue plus à cette taille.
CADENCE_DEFAUT = 12.0


@dataclass(frozen=True, slots=True)
class Mouvement:
    """Un mouvement de l'atelier : son nom, son texte, sa cadence, ses directions.

    **L'identifiant ne bouge pas quand le nom change**, comme pour une pose et
    comme pour une direction : c'est lui qui accroche le mouvement à la case du
    plan, et renommer « marche » en « déplacement » ne doit pas défaire ce lien.
    """

    identifiant: str
    # Le nom français — **ce qu'on lit**, et rien d'autre.
    nom: str
    # Le texte anglais — **ce qui part**, et rien d'autre. Même partage que la
    # pose depuis `E10` et que la direction : les confondre faisait partir un
    # mot français au milieu d'une phrase anglaise.
    #
    # **Il décrit un cycle, pas une posture.** C'est toute la différence avec la
    # consigne d'une pose, et c'est pour ça qu'un champ de plus était nécessaire
    # plutôt qu'une réécriture de l'existant : `walking posture, full body` est
    # juste pour une image et faux pour un clip, où il faut dire que ça boucle
    # et que le personnage n'avance pas dans le cadre.
    texte: str
    # Les images par seconde de la bande qu'on tirera du clip. **Elle voyage
    # jusqu'au fichier d'accompagnement de l'export** (`A4`) : une cadence
    # réglée à l'écran et une cadence écrite dans le descriptif finiraient par
    # se contredire, et c'est l'auteur qui paierait l'écart.
    cadence: float = CADENCE_DEFAUT
    # Les identifiants de direction où ce mouvement a un sens. **Vide veut dire
    # « toutes »**, ce qui est le cas ordinaire — seule la mort n'a qu'un angle.
    #
    # **Ça propose, ça n'interdit jamais.** Un mouvement de l'atelier ne peut pas
    # connaître les directions qu'un jeu déclare : elles sont au projet, elles se
    # renomment, et un jeu vu de côté n'en a qu'une. Cette liste sert donc à
    # *mettre en avant* les directions attendues, jamais à en griser une —
    # la règle du produit depuis toujours : la machine propose, l'auteur juge.
    directions: tuple[str, ...] = ()

    # **D'où il vient, et l'écran s'en sert pour une seule chose** — marquer ce
    # que l'auteur a nommé lui-même, comme partout ailleurs dans le produit. Un
    # livré arrive avec l'atelier et est le même chez tout le monde ; un fabriqué
    # n'existe que dans cet atelier-ci. Ce champ ne décide d'aucun comportement,
    # sauf de ce qui arrive quand on le masque — voir juste dessous.
    livre: bool = False

    # **Masqué n'est pas supprimé, et c'est la seule façon de ne pas le rendre.**
    # Le catalogue des livrés se relit à chaque lecture : effacer un livré le
    # ferait revenir à la ligne suivante, et l'auteur masquerait le même
    # mouvement indéfiniment. La pierre reste donc dans le fichier, et
    # *montrer* la retire. Un fabriqué masqué, lui, s'en va pour de bon : il n'y
    # a personne pour le remettre. Même règle que les étiquettes livrées (`E8`).
    masque: bool = False

    def en_json(self) -> dict[str, Any]:
        return {
            "identifiant": self.identifiant,
            "nom": self.nom,
            "texte": self.texte,
            "cadence": self.cadence,
            "directions": list(self.directions),
            "livre": self.livre,
            "masque": self.masque,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "Mouvement":
        identifiant = str(d.get("identifiant") or "")
        return Mouvement(
            identifiant=identifiant,
            nom=str(d.get("nom") or identifiant),
            texte=str(d.get("texte") or ""),
            # Une cadence nulle ou négative serait une bande qui ne tourne
            # jamais : le plancher est au défaut, comme le plancher d'une pose
            # est à une image.
            cadence=_cadence(d.get("cadence")),
            directions=tuple(
                str(x) for x in (d.get("directions") or ()) if isinstance(x, str) and x
            ),
            livre=bool(d.get("livre", False)),
            masque=bool(d.get("masque", False)),
        )

    def renomme(self, nom: str) -> "Mouvement":
        return replace(self, nom=nom)


def _cadence(brut: Any) -> float:
    try:
        valeur = float(brut)
    except (TypeError, ValueError):
        return CADENCE_DEFAUT
    return valeur if valeur > 0 else CADENCE_DEFAUT


def repere(libelle: str) -> str:
    """Un repère lisible dérivé du nom — **jamais un tirage au sort**.

    C'est la règle de l'identifiant d'un projet, d'une pose et d'une étiquette
    livrée : `mouvements.json` s'ouvre à la main, et y lire `marche` plutôt
    qu'un jeton hexadécimal est ce qui rend vrai *les fichiers font foi*.

    **Et c'est ce repère-là qui fait le lien avec les poses.** Une pose nommée
    « Marche » porte l'identifiant `marche` ; un mouvement nommé « marche » aussi.
    Les deux se rencontrent sans que rien ne soit relié à la main — c'est le
    critère central de la tranche, et il tient à cette fonction.
    """
    plat = unicodedata.normalize("NFKD", libelle.lower())
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", plat).strip("-")


# ── Les mouvements que l'atelier apporte avec lui ────────────────────────────
#
# **Sept, et ils recouvrent exactement le plan de poses de départ**, plus le
# saut. Ce n'est pas un hasard : c'est ce qui fait qu'un atelier neuf, sur un
# projet neuf, sait animer ses six cases sans qu'une seule ligne soit écrite.
# La correspondance se fait par l'identifiant, et elle serait fausse d'un mot.
#
# **Les textes disent un cycle, et deux précautions y reviennent.** *in place,
# without moving across the frame* : sans elle, le personnage sort du cadre et
# la fenêtre commune du découpage devient énorme pour rien (`A2`). Et *return to
# the neutral stance* sur ce qui n'est pas un cycle : c'est ce qui permet de
# découper **deux animations dans un seul clip**, en repérant le retour au repos
# entre deux actions — la découverte qui commande tout l'écran de montage.
_CATALOGUE: tuple[tuple[str, str, str, float, tuple[str, ...]], ...] = (
    (
        "repos",
        "repos",
        "idle breathing loop, standing still, subtle chest and clothing motion, "
        "feet planted, looping seamlessly",
        8.0,
        (),
    ),
    (
        "marche",
        "marche",
        "walking cycle, full body, steady even pace, walking in place without "
        "moving across the frame, looping seamlessly",
        12.0,
        (),
    ),
    (
        "course",
        "course",
        "running cycle, full body, fast steady pace, running in place without "
        "moving across the frame, looping seamlessly",
        14.0,
        (),
    ),
    (
        "saut",
        "saut",
        "jump, crouching down, leaping upward, landing and recovering, "
        "returning to the neutral stance",
        12.0,
        (),
    ),
    (
        "attaque",
        "attaque",
        "attack, winding up, striking forward, then returning to the neutral "
        "stance, staying in place",
        14.0,
        (),
    ),
    (
        "degats",
        "dégâts",
        "hurt reaction, recoiling backward from an impact, then returning to "
        "the neutral stance",
        12.0,
        (),
    ),
    (
        # **La seule direction déclarée du catalogue, et elle est un fait.** Une
        # mort n'a qu'un angle, quel que soit le personnage — c'est déjà écrit
        # sur le plan de poses (`E10`, `Pose.ecartees`), et le mouvement le dit
        # du même mot. Elle propose le sud ; elle n'interdit rien.
        "mort",
        "mort",
        "death, collapsing to the ground, then lying still and motionless",
        10.0,
        ("sud",),
    ),
)

LIVRES: tuple[Mouvement, ...] = tuple(
    Mouvement(
        identifiant=identifiant,
        nom=nom,
        texte=texte,
        cadence=cadence,
        directions=directions,
        livre=True,
    )
    for identifiant, nom, texte, cadence, directions in _CATALOGUE
)


def mouvements_depuis_json(brut: Any) -> tuple[Mouvement, ...]:
    """La base relue du fichier — **et rien n'y est inventé**.

    Un mouvement sans identifiant est sauté plutôt que de faire tomber la
    lecture : une base à six mouvements au lieu de sept se répare d'un clic, un
    atelier qui ne s'ouvre plus ne se répare pas.
    """
    if not isinstance(brut, (list, tuple)):
        return ()
    lus = (
        Mouvement.depuis_json(m)
        for m in brut
        if isinstance(m, dict) and m.get("identifiant")
    )
    vus: set[str] = set()
    retenus: list[Mouvement] = []
    for mouvement in lus:
        if mouvement.identifiant in vus or not mouvement.identifiant:
            continue
        vus.add(mouvement.identifiant)
        retenus.append(mouvement)
    return tuple(retenus)


def pour_la_pose(
    mouvements: Iterable[Mouvement], identifiant_pose: str
) -> Mouvement | None:
    """Le mouvement de cette pose-là, **par l'identifiant et par rien d'autre**.

    C'est tout le lien entre le plan du projet et la bibliothèque de mouvements
    de l'atelier, et il est volontairement bête : pas de table de correspondance
    à tenir, pas de champ à remplir sur une pose, rien à relier à la main. Une
    pose que l'auteur a inventée ne trouve rien, et c'est la bonne réponse — le
    produit ne devine pas comment animer une attitude qu'il n'a jamais vue.
    """
    for mouvement in mouvements:
        if mouvement.identifiant == identifiant_pose:
            return mouvement
    return None


def texte_anime(
    mouvements: Iterable[Mouvement], identifiant_pose: str, repli: str
) -> str:
    """Ce qui part pour animer cette pose : le mouvement s'il existe, sinon le repli.

    Le repli est la consigne figée de la pose (`Pose.dit()`). Elle décrit une
    posture au lieu d'un cycle, donc elle est **moins bonne** — mais elle est en
    anglais, elle décrit la bonne attitude, et elle laisse commander. Un écran
    qui refuserait de commander une pose sans mouvement connu ferait payer à
    l'auteur le fait d'avoir inventé une attitude ; l'écran dit simplement d'où
    vient le texte, et l'auteur le réécrit s'il veut.
    """
    mouvement = pour_la_pose(mouvements, identifiant_pose)
    return mouvement.texte if mouvement and mouvement.texte else repli
