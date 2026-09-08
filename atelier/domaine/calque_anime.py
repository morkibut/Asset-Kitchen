# -*- coding: utf-8 -*-
"""Le calque d'animation — **le calque d'une pose, reposé sur chaque image**.

Arrivé en `B20` (V4). C'est le seul chemin pour qu'un personnage équipé bouge,
et il ne demande aucune image de plus : le calque existe déjà, obtenu sur le
corps de la pose par une planche d'équipement (`C3`) ; ce qui manquait était le
moyen de le reposer sur les images d'une animation.

**L'invariant de `C3` tient, et c'est lui qui a dessiné ce module.** Un calque
reste solidaire de sa **pose** — il ne porte de direction nulle part, et `B19` a
verrouillé la décision en refusant la grille de vingt-quatre cases que la
planche montrait. Or une bande, elle, porte une direction. Les deux se
concilient dans un seul sens : **la direction vient de la bande, jamais du
calque**. Habiller les quatre bandes d'une pose consulte donc quatre fois *le
même* calque, et l'axe des directions n'entre jamais dans le rangement des
images. C'est ce qui fait qu'ajouter l'animation ne crée aucun calque neuf —
ni à fabriquer, ni à ranger, ni à payer.

**Rien ici ne porte de pixels.** Un habillage est une intention — une pièce, une
façon de suivre, et les nombres du calage —, et les images habillées se
recalculent à partir de ça. C'est la règle 5 de `docs/ARCHITECTURE.md`, la même
qui fait d'une planche de bande un cache effaçable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from atelier.domaine.superposition import ReglagesGardes

# ── Comment le calque suit le personnage ─────────────────────────────────────
#
# Deux façons, et elles ne coûtent ni l'une ni l'autre un centime : le recalage
# tourne sur la machine. Ce qui les sépare est le **temps de calcul**, et ce
# qu'on obtient pour ce temps.
#
# **Tenir** rejoue le recalage sur chacune des images. Un personnage qui tourne
# la tête, se penche ou lève le bras déplace l'endroit où la pièce se pose ; un
# calage par image est la seule réponse qui suive.
#
# **Glisser** ne le calcule qu'une fois et sert le même nombre partout. Dix fois
# moins de calcul sur une bande de dix images, et l'écart se voit dès que le
# personnage bouge autrement qu'en bloc.
#
# Un troisième mode — *ne pas caler du tout* — n'est pas offert : il n'a pas de
# sens ici. Poser le calque à l'origine de chaque image donnerait une pièce
# décrochée, et personne ne demande cela ; c'est ce que le produit faisait
# avant qu'il existe un recalage, et c'est très exactement ce qu'on répare.

TIENT = "tient"
GLISSE = "glisse"
TENUES = (TIENT, GLISSE)

MOT_DE_LA_TENUE = {
    TIENT: "recalé sur chaque image",
    GLISSE: "un seul calage pour toute la bande",
}


# ── Ce qu'une case de la matrice peut être ───────────────────────────────────
#
# Quatre états, et le troisième est la raison d'être de cette liste : **une case
# sans animation du personnage n'est pas un manque**. Une animation d'équipement
# suit celle du personnage ; là où le personnage n'a rien, il n'y a rien à
# habiller, et compter cela comme un trou ferait afficher un déficit que rien ne
# peut combler — ni un clic, ni une dépense.
#
# `SANS_CALQUE` en est un, lui, et il se répare : la pièce n'a pas encore été
# obtenue sur cette pose, et une planche d'équipement la donnera.

HABILLE = "habille"
A_HABILLER = "a-habiller"
SANS_ANIMATION = "sans-animation"
SANS_CALQUE = "sans-calque"
ETATS = (HABILLE, A_HABILLER, SANS_ANIMATION, SANS_CALQUE)

MOT_DE_L_ETAT = {
    HABILLE: "le calque est posé sur les images",
    A_HABILLER: "le calque et l'animation sont là — rien n'a encore été posé",
    SANS_ANIMATION: "le personnage n'a pas encore cette animation — rien à habiller",
    SANS_CALQUE: "la pièce n'a pas encore de calque sur cette pose",
}

# **Le seul état qui ne se compte pas.** Écrit ici plutôt que répété dans le
# service et dans l'écran : deux endroits qui décident ce qu'est un manque
# finiraient par afficher deux comptes de la même matrice.
NE_COMPTE_PAS = (SANS_ANIMATION,)


@dataclass(frozen=True, slots=True)
class CalageParImage:
    """Où le calque se pose sur **une** image de la bande.

    Les trois nombres sont ceux d'une `Superposition`, et ce n'est pas une
    ressemblance : ils partent dans la même fonction de pose. Ce qui s'y ajoute
    est `couverture`, ce que le recalage a trouvé de commun entre les deux
    images — c'est elle qui permet à l'écran de dire *ce calage-là est douteux*
    sans qu'on ait à regarder les vingt images une par une.
    """

    numero: int
    echelle: float = 1.0
    dx: int = 0
    dy: int = 0
    couverture: float = 0.0

    def en_json(self) -> dict[str, Any]:
        return {
            "numero": self.numero,
            "echelle": round(self.echelle, 3),
            "dx": self.dx,
            "dy": self.dy,
            "couverture": round(self.couverture, 4),
        }

    @staticmethod
    def depuis_json(d: dict[str, Any]) -> "CalageParImage":
        return CalageParImage(
            numero=int(d.get("numero", 0)),
            echelle=float(d.get("echelle", 1.0)),
            dx=int(d.get("dx", 0)),
            dy=int(d.get("dy", 0)),
            couverture=float(d.get("couverture", 0.0)),
        )


@dataclass(frozen=True, slots=True)
class Habillage:
    """Ce qu'une bande porte par-dessus le corps — **la pièce, et comment elle suit**.

    C'est le champ qui manquait au rangement : une bande portait le projet, le
    personnage, la pose et la direction, et rien ne pouvait dire *celle-ci est
    l'épée du goliath en marche*. Sans lui, une animation habillée n'avait nulle
    part où se ranger.

    **Les trois champs vont ensemble, ou aucun ne va.** Une tenue sans pièce ne
    veut rien dire, un calage à la main non plus : les réunir dans un seul objet
    facultatif est ce qui empêche une bande de se trouver à moitié habillée —
    la même raison qui a fait tenir ensemble les quatre champs de la case.

    `main` porte le calage que l'auteur a posé lui-même, et il **l'emporte sur
    le recalage**. C'est la règle de `M1` reprise telle quelle : le calcul place
    la pièce à peu près, sans qu'on demande rien ; la main la place exactement,
    quand le calcul s'est trompé. Vide, la bande suit ce que le recalage trouve.
    """

    piece: str
    tenue: str = TIENT
    main: ReglagesGardes | None = None

    @property
    def a_la_main(self) -> bool:
        """L'auteur a-t-il posé le calage lui-même ? Ce qui n'a pas été touché
        ne s'annonce pas — l'écran ne dit *posé à la main* que quand ça l'est."""
        return self.main is not None

    @property
    def mot(self) -> str:
        return MOT_DE_LA_TENUE.get(self.tenue, "")

    def en_json(self) -> dict[str, Any]:
        return {
            "piece": self.piece,
            "tenue": self.tenue,
            "mot": self.mot,
            "a_la_main": self.a_la_main,
            "main": self.main.en_json() if self.main else None,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "Habillage | None":
        """L'habillage d'une bande, **ou rien** — et rien est le cas courant.

        Une bande d'avant `B20` n'écrit pas la clé, et une bande nue ne l'écrit
        pas davantage : les deux se relisent sans habillage, ce qui est
        exactement ce qu'elles voulaient dire. Aucune migration, aucune table
        réécrite.
        """
        if not d or not d.get("piece"):
            return None
        tenue = str(d.get("tenue") or TIENT)
        return Habillage(
            piece=str(d["piece"]),
            # La liste est close, et un fichier abîmé ne la rouvre pas — même
            # règle que le genre d'un emploi et que le sens d'une bande.
            tenue=tenue if tenue in TENUES else TIENT,
            main=(
                ReglagesGardes.depuis_json(d["main"])
                if isinstance(d.get("main"), dict)
                else None
            ),
        )


def calages_depuis_json(brut: Any) -> tuple[CalageParImage, ...]:
    """Les calages d'une bande habillée, dans l'ordre des images.

    Une entrée qui n'est pas un objet est sautée plutôt que de faire tomber la
    lecture de toute une bande pour une ligne abîmée — c'est déjà la règle des
    emplois et celle des prises.
    """
    if not isinstance(brut, (list, tuple)):
        return ()
    return tuple(
        CalageParImage.depuis_json(c) for c in brut if isinstance(c, dict)
    )
