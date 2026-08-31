# -*- coding: utf-8 -*-
"""Ce qui part, ligne par ligne — et ce que l'écran de confirmation en renvoie.

**Le vocabulaire de E14, et rien d'autre.** Trois choses vivent ici : le nom des
groupes dans lesquels ce qui part se range, la clef qui désigne une ligne, et le
`Tri` — ce que l'écran renvoie quand on a éteint des lignes et corrigé des
textes.

**Le `Tri` ne s'enregistre nulle part, et c'est toute la règle de l'écran.** Une
correction faite avant de payer vaut *pour cet appel seulement* : elle voyage
avec la demande, elle habille le prompt, et elle disparaît ensuite. Ce qui reste
est la recette de l'image produite, qui porte le texte tel qu'il est parti — et
c'est une autre question. « Ce qui est oublié, c'est le réglage pour la suite ;
ce qui est gardé, c'est l'histoire de ce qui a été fait. »

**Un `Tri` ne porte que des écarts, jamais un état complet.** Il dit quelles
lignes ont été éteintes à la main, et quels textes ont été corrigés. Tout le
reste se recalcule : c'est ce qui fait qu'éteindre les trois lignes d'une
ambiance **rallume les textes du jeu d'eux-mêmes**, sans que personne les
rallume — le jeu redevient simplement la couche la plus haute qui reste.
Enregistrer l'état complet aurait figé les lignes du jeu dans l'état éteint où
l'ambiance les avait mises, et il aurait fallu un second geste pour les
retrouver.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from atelier.domaine.projet import CHAMPS_BIBLE, INTITULES

# ── Les groupes, dans l'ordre où le texte est assemblé ────────────────────────
#
# **L'ordre des groupes à l'écran est l'ordre de l'assemblage**, et c'est la
# règle que la maquette pose : on lit l'écran de haut en bas et le texte de
# gauche à droite, et il n'y a rien à faire correspondre dans sa tête.
#
# La maquette dessinait le sujet **avant** les textes du jeu, en montrant un
# texte assemblé qui commençait par le sujet. Le code fait l'inverse depuis T4 —
# la bible active se replie en tête (US-53) — et c'est le code qui a raison, pour
# la raison la plus simple : personne n'a mesuré ce que changerait l'autre ordre,
# et changer l'ordre d'un prompt change ce que le modèle rend. C'est la règle du
# dossier appliquée une fois de plus : *une maquette a supposé le code au lieu de
# le lire*.

JEU = "jeu"  # les sept textes de la bible, tels que cette chose-là les porte
AMBIANCE = "ambiance"  # ce que son lot de style remplace — trois cases au plus
SUJET = "sujet"  # ce qu'on dessine : le signalement, puis la consigne de la case
PLANCHE = "planche"  # les consignes de case, quand l'appel part plié
IMAGES = "images"  # ce qui part en image, et ce que chacune coûte
OPTIONS = "options"  # ce que le modèle choisi sait faire en plus

GROUPES = (JEU, AMBIANCE, SUJET, PLANCHE, IMAGES, OPTIONS)


def clef(groupe: str, nom: str) -> str:
    """Le nom d'une ligne, unique dans tout l'écran.

    Deux couches peuvent porter le même champ — le *monde* du jeu et le *monde*
    de l'ambiance —, et ce sont deux lignes distinctes avec deux interrupteurs
    distincts. Le groupe fait donc partie de la clef ; sans lui, éteindre l'une
    éteindrait l'autre.
    """
    return f"{groupe}.{nom}"


@dataclass(frozen=True, slots=True)
class Tri:
    """Ce que l'écran de confirmation renvoie — **et qui ne vaut que pour cet appel**.

    `eteints` : les clefs de lignes que l'auteur a éteintes à la main. Une ligne
    absente de cette liste n'est pas « allumée » pour autant — elle est
    *candidate*, et c'est la résolution par couches qui décide.

    `textes` : les corrections, par clef. Elles remplacent le texte de la ligne
    et rien d'autre : ni la bible du jeu, ni l'ambiance, ni la fiche de la chose
    ne bougent. Garder une correction est un **second geste**, écrit, qui passe
    par la fiche — jamais un effet de bord de celui-ci.

    **Absent n'est pas vide.** `None` — pas de `Tri` du tout — veut dire « rien
    n'a été trié », et c'est ce que reçoit un agent, qui n'a pas d'écran devant
    lui. Un `Tri` vide veut dire « l'auteur a regardé et n'a rien éteint ». Les
    deux donnent le même texte aujourd'hui ; les confondre nous priverait du seul
    endroit où l'on pourrait un jour distinguer les deux.
    """

    eteints: frozenset[str] = frozenset()
    allumes: frozenset[str] = frozenset()
    textes: Mapping[str, str] = field(default_factory=dict)

    def etat(self, ligne: str, defaut: bool) -> bool:
        """Cette ligne est-elle candidate, sachant ce que la fiche en dit ?

        **Deux listes et pas une**, parce qu'il y a deux sens à contredire. Une
        ligne que la fiche allume s'éteint pour cet appel ; une ligne que la
        fiche éteint — un refus écrit — se rallume pour cet appel. Sans la
        seconde, « et si je remettais l'éclairage, juste pour cet essai ? »
        obligerait à aller défaire le refus durable, c'est-à-dire à faire
        exactement ce que cet écran-là existe pour éviter.
        """
        if ligne in self.allumes:
            return True
        if ligne in self.eteints:
            return False
        return defaut

    def texte(self, ligne: str, defaut: str) -> str:
        """Le texte corrigé, ou celui d'origine. **Une correction vide compte** :
        effacer un texte pour cet appel est un geste légitime, distinct
        d'éteindre la ligne — l'une retire la phrase, l'autre retire l'intitulé
        avec elle."""
        corrige = self.textes.get(ligne)
        return defaut if corrige is None else corrige

    @staticmethod
    def depuis_json(d: Mapping[str, Any] | None) -> "Tri | None":
        if not d:
            return None
        return Tri(
            eteints=frozenset(str(c) for c in (d.get("eteints") or ())),
            allumes=frozenset(str(c) for c in (d.get("allumes") or ())),
            textes={
                str(k): str(v)
                for k, v in (d.get("textes") or {}).items()
                if isinstance(k, str)
            },
        )

    def en_json(self) -> dict[str, Any]:
        return {
            "eteints": sorted(self.eteints),
            "allumes": sorted(self.allumes),
            "textes": dict(self.textes),
        }


# ── Les couches de texte d'une chose du jeu, non résolues ────────────────────


@dataclass(frozen=True, slots=True)
class Couches:
    """Les trois épaisseurs de texte qui habillent une chose, **sans arbitrage**.

    `bible` — ce que le jeu dit, dans l'ordre des sept champs. `ecrits` — ce que
    cette chose-là a écrit pour elle seule. `eteints` — les champs qu'elle
    refuse. `ambiance` — ce que son lot de style remplace, trois champs au plus.

    Elles sont rendues **brutes** parce que deux écrans les résolvent : la fiche
    d'une chose du jeu, qui montre l'état durable, et l'écran de confirmation,
    qui montre ce que *cet appel* fera après qu'on a touché aux interrupteurs.
    Deux résolutions écrites à deux endroits auraient fini par montrer deux
    textes différents pour le même appel, et celle qui compte est celle qui part.
    """

    bible: tuple[tuple[str, str], ...] = ()
    ecrits: Mapping[str, str] = field(default_factory=dict)
    eteints: frozenset[str] = frozenset()
    ambiance: Mapping[str, str] = field(default_factory=dict)
    ambiance_nom: str = ""
    # **La chose que cet appel habille**, quand il y en a une. Elle ne change
    # aucun texte : elle dit seulement si « garder cette correction » a une case
    # où aller. Sans chose visée — un import, un agent, une image qu'on fabrique
    # sans rien viser —, il n'y en a pas, et le geste ne se propose pas plutôt
    # que de ne rien faire une fois cliqué.
    chose: str = ""
    # Ce que le réglage durable de la chose prend à son ambiance en fait de
    # texte. Faux, et les lignes de l'ambiance sont là, éteintes : on voit ce
    # qu'on ne prend pas, et on peut le prendre pour cet appel seulement.
    prend_textes: bool = True


# Ce qu'une origine dit à l'écran. **Un mot, pas une phrase** : la ligne dit
# déjà tout le reste, et l'origine ne sert qu'à savoir où aller corriger
# durablement.
DU_JEU = "du jeu"
DE_SA_FICHE = "de sa fiche"
DE_SON_AMBIANCE = "son ambiance"
DE_LA_POSE = "de la pose"
DE_LA_PLANCHE = "de la planche"
ECRIT_ICI = "écrit ici"
REPRIS = "ton texte"


def resoudre(couches: Couches, tri: "Tri | None" = None) -> list[dict[str, Any]]:
    """Les lignes de texte d'une chose du jeu, **et laquelle part**.

    Trois couches, et l'ordre est celui de la décision (E12) : ce que la chose
    écrit gagne sur ce que l'ambiance donne, qui gagne sur ce que le jeu dit.
    Ce qui change ici, c'est qu'on n'écrase plus les perdantes : **elles restent
    à l'écran, éteintes**, en disant qui les remplace. C'est ce qui rend le geste
    de la maquette possible — éteindre les trois lignes d'une ambiance rallume
    les textes du jeu *d'eux-mêmes*, puisqu'ils redeviennent la couche la plus
    haute qui reste candidate.

    Une ligne éteinte sur la fiche est rendue elle aussi, éteinte : un refus
    écrit se voit, et il se lève **pour cet appel** sans qu'on aille défaire le
    réglage durable.

    Rend les lignes dans l'ordre de l'assemblage : les sept champs du jeu, puis
    les trois de l'ambiance. `allumee` dit ce qui part vraiment ; `remplacee_par`
    nomme la ligne qui a gagné, quand c'en est la raison.
    """
    tri = tri or Tri()
    lignes: list[dict[str, Any]] = []
    # rang : plus grand gagne. La fiche d'abord, l'ambiance ensuite, le jeu en
    # dernier — c'est l'ordre de E12, et il n'en existe qu'un.
    par_champ: dict[str, list[tuple[int, dict[str, Any]]]] = {}

    for nom, du_jeu in couches.bible:
        ecrit = (couches.ecrits.get(nom) or "").strip()
        texte = ecrit or du_jeu
        if not texte:
            continue
        ligne = {
            "clef": clef(JEU, nom),
            "groupe": JEU,
            "nom": nom,
            "texte": texte,
            # Ce qui précède le texte dans le prompt. **En anglais, et décidé
            # une fois** (T4) : le prompt part en anglais chez tous les modèles
            # du catalogue, et « Éclairage : » dégraderait ce que « Lighting: »
            # obtient. L'écran le montre aussi — c'est ce qui part.
            "intitule": INTITULES.get(nom, nom),
            "origine": DE_SA_FICHE if ecrit else DU_JEU,
            # Ce que ce texte-là écarte, montré barré en dessous : on doit
            # pouvoir lire ce à quoi on a renoncé sans aller le chercher.
            "remplace": du_jeu if ecrit and du_jeu != texte else "",
            "eteignable": True,
            # « Garder ce texte » l'écrit sur la fiche de la chose visée : c'est
            # la case où il vivra durablement. Sans chose visée, il n'y en a pas
            # — et un geste proposé qui ne ferait rien vaut moins que pas de
            # geste du tout.
            "gardable": bool(couches.chose),
        }
        par_champ.setdefault(nom, []).append((2 if ecrit else 0, ligne))
        lignes.append(ligne)

    for nom, texte in couches.ambiance.items():
        propre = (texte or "").strip()
        if not propre:
            continue
        ligne = {
            "clef": clef(AMBIANCE, nom),
            "groupe": AMBIANCE,
            "nom": nom,
            "texte": propre,
            "intitule": INTITULES.get(nom, nom),
            "origine": DE_SON_AMBIANCE,
            "remplace": "",
            "eteignable": True,
            # Elle s'écrit dans l'ambiance, qui sert plusieurs choses du jeu :
            # la garder « sur cette chose-là » n'aurait pas de case où aller.
            "gardable": False,
            "ambiance": couches.ambiance_nom,
        }
        par_champ.setdefault(nom, []).append((1, ligne))
        lignes.append(ligne)

    for nom, candidates in par_champ.items():
        gagnante: dict[str, Any] | None = None
        for _, ligne in sorted(candidates, key=lambda c: -c[0]):
            # **Éteint sur la fiche passe avant tout, et vaut pour les deux
            # couches** (E12) : un refus écrit ne se discute pas avec ce qu'il
            # refuse, et une ambiance qui rallumerait un champ que la chose
            # refuse rendrait le refus indéfendable. Il se lève pour cet appel
            # seulement, par le tri, et jamais autrement.
            defaut = nom not in couches.eteints and (
                True if ligne["groupe"] == JEU else couches.prend_textes
            )
            if gagnante is None and tri.etat(ligne["clef"], defaut):
                gagnante = ligne
                ligne["allumee"] = True
                ligne["remplacee_par"] = ""
            else:
                ligne["allumee"] = False
                ligne["remplacee_par"] = gagnante["clef"] if gagnante else ""

    for ligne in lignes:
        ligne["texte"] = tri.texte(ligne["clef"], ligne["texte"])
        ligne["corrigee"] = ligne["clef"] in tri.textes
    return lignes


# ── Des lignes au prompt ─────────────────────────────────────────────────────


def _allumees(lignes: Iterable[Mapping[str, Any]], groupe: str) -> list[Mapping[str, Any]]:
    return [
        l
        for l in lignes
        if l["groupe"] == groupe and l.get("allumee") and str(l["texte"]).strip()
    ]


def joindre(lignes: Iterable[Mapping[str, Any]]) -> str:
    """Le prompt, tel qu'il partira — **et il n'y a que celui-ci**.

    Trois blocs séparés d'une ligne vide, dans l'ordre où le produit les replie
    depuis T4 : les textes de style, le sujet, les consignes de planche.

    **Les textes de style gardent l'ordre de la bible**, quelle que soit la
    couche qui a gagné : un monde venu d'une ambiance se lit à la place du
    monde, pas à la fin. Les mettre dans l'ordre de résolution aurait fait
    voyager un champ dans le prompt le jour où on désigne une ambiance — et
    changer l'ordre d'un prompt change ce que le modèle rend.

    **Le sujet et sa consigne de case se joignent par une virgule**, comme la
    phrase que `ServiceProduction.sujet` écrivait d'un bloc jusqu'à E14 : le
    texte assemblé est le même, mot pour mot, et seul son découpage à l'écran a
    changé.
    """
    lues = list(lignes)
    rang = {nom: i for i, nom in enumerate(CHAMPS_BIBLE)}
    style = sorted(
        _allumees(lues, JEU) + _allumees(lues, AMBIANCE),
        key=lambda l: rang.get(str(l["nom"]), len(rang)),
    )
    blocs: list[str] = []
    if style:
        blocs.append(
            "\n".join(
                f"{l['intitule']}: {str(l['texte']).strip()}"
                if l.get("intitule")
                else str(l["texte"]).strip()
                for l in style
            )
        )
    sujet = [str(l["texte"]).strip() for l in _allumees(lues, SUJET)]
    if sujet:
        blocs.append(", ".join(sujet))
    blocs.extend(str(l["texte"]) for l in _allumees(lues, PLANCHE))
    return "\n\n".join(blocs)


# Ce que les blocs de R2 appelaient une origine. **Une lecture des lignes, pas
# une seconde composition** : un bloc et sa ligne ne peuvent donc pas diverger.
_BLOC = {JEU: "bible", AMBIANCE: "bible", SUJET: "sujet", PLANCHE: "planche"}


def en_blocs(lignes: Iterable[Mapping[str, Any]]) -> list[dict[str, str]]:
    """Les lignes, groupées comme elles s'assemblent (US-158)."""
    lues = list(lignes)
    if any(l.get("origine") == REPRIS for l in lues):
        return [{"origine": "repris", "texte": joindre(lues)}]
    blocs: list[dict[str, str]] = []
    for groupe in (JEU, SUJET, PLANCHE):
        morceau = joindre(
            [l for l in lues if _BLOC.get(str(l["groupe"])) == _BLOC.get(groupe)]
        )
        if morceau:
            blocs.append({"origine": _BLOC[groupe], "texte": morceau})
    return blocs
