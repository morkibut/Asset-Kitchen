# -*- coding: utf-8 -*-
"""Trier, filtrer et regrouper la grille — le contrat, écrit une fois (RP11).

**Un seul paramétrage sert l'écran et l'agent.** Les trois listes fermées de ce
fichier sont celles que `GET /api/v1/assets` accepte et celles que l'outil MCP
`list_assets` expose, aux mêmes valeurs : le MCP n'a aucune logique propre
(`docs/PLAN.md` § Les invariants), et deux vocabulaires pour la même question
finiraient par désigner deux grilles différentes.

Le contrat entier, avec ses raisons, vit dans `docs/PLAN-remise-a-plat.md`
§ RP11, *Le contrat de la route*. Ce fichier n'en tient que les deux choses qui
doivent être calculées : **le rôle d'une image**, et **le regroupement**.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Sequence

if TYPE_CHECKING:  # pragma: no cover - lecture seule, pour les types
    from atelier.domaine.asset import Asset


# ── Les trois listes fermées ─────────────────────────────────────────────────

#: L'ordre de la grille. Les trois de la maquette, et rien d'autre : *favori*
#: est déjà un filtre, *sujet* est déjà la liste des familles.
TRIS = ("recent", "ancien", "nom")
TRI_PAR_DEFAUT = "recent"

#: Ce qu'une image **est**. Quatre se lisent sur elle ; `origine` se lit sur ce
#: qui en descend — une image ne sait pas d'avance qu'on la découpera.
ROLES = ("tous", "origine", "derivee", "calque", "equipement", "seule")
ROLE_PAR_DEFAUT = "tous"

#: Ce que l'auteur en a **décidé**. « Juger, c'est marquer favori ou
#: supprimer » (`AGENTS.md`), et un supprimé n'est plus dans la bibliothèque :
#: l'axe n'a que deux états, le troisième choix est « tous ».
JUGEMENTS = ("tous", "favori", "non-juge")
JUGEMENT_PAR_DEFAUT = "tous"

#: Les rôles que l'index écrit sur la ligne, à la naissance de l'image. Ils
#: sont exclusifs et l'ordre ci-dessous est celui de leur priorité.
ROLES_ECRITS = ("calque", "equipement", "derivee", "seule")


def tri_valide(valeur: str | None) -> str:
    return valeur if valeur in TRIS else TRI_PAR_DEFAUT


def role_valide(valeur: str | None) -> str:
    return valeur if valeur in ROLES else ROLE_PAR_DEFAUT


def jugement_valide(valeur: str | None) -> str:
    return valeur if valeur in JUGEMENTS else JUGEMENT_PAR_DEFAUT


# ── Le rôle d'une image ──────────────────────────────────────────────────────


def role_de(asset: "Asset") -> str:
    """Ce que cette image est, en un mot — écrit sur la ligne à chaque
    enregistrement, jamais recalculé à la lecture.

    **Un seul endroit décide, et l'ordre est fixe** : calque, puis équipement,
    puis dérivée, puis seule. Plusieurs conviennent souvent — un calque
    d'équipement est les trois à la fois —, et sans un ordre écrit une fois, la
    grille et la matrice finiraient par ranger la même image à deux endroits.

    `origine` n'est pas ici : c'est le seul rôle qui parle de ce qui **descend**
    de l'image, et une image ne sait pas d'avance qu'on la découpera. Il se lit
    en SQL, sur la présence d'un enfant vivant (`Base._conditions_assets`).
    """
    if asset.recette.difference is not None:
        return "calque"
    if asset.piece:
        return "equipement"
    if asset.parent:
        return "derivee"
    return "seule"


# ── Le regroupement ──────────────────────────────────────────────────────────


def regrouper_par_origine(assets: Sequence["Asset"]) -> list[dict[str, Any]]:
    """`regrouper_par_origine` — une feuille et ce qui en est sorti, ensemble.

    **Ce qu'il fait.** Chaque image remonte sa filiation — `parent`, puis le
    parent de son parent — **tant que le parent est dans la page**. La première
    qui n'a plus de parent dans la page est l'*origine* de son groupe ; toutes
    celles qui ont abouti à elle sont ses *dérivés*. Une image sans parent dans
    la page est donc l'origine d'un groupe d'elle seule.

    **Sur la page, jamais sur la bibliothèque entière.** Un dérivé dont
    l'origine ne répond pas au filtre se montre seul, à sa place dans le tri :
    il ne disparaît pas, et il ne fait pas venir une image que le filtre écarte.

    **Un groupe prend la place de son membre le mieux classé.** La feuille est
    vieille, ses cases viennent d'être coupées : classer le groupe sur la
    feuille l'enverrait au fond de la grille à la seconde où l'on découpe. Vrai
    pour les trois tris — c'est toujours « le mieux placé de ceux qu'il porte ».

    Rend une liste d'entrées `{"origine": identifiant, "derives": [...]}`, dans
    l'ordre où la grille doit les poser. La liste plate des images, elle, se
    remet dans cet ordre-là par `ordonner_par_groupe` juste en dessous.
    """
    rang = {a.identifiant: n for n, a in enumerate(assets)}
    presents = {a.identifiant: a for a in assets}

    def origine_de(asset: "Asset") -> str:
        vus: set[str] = set()
        courant = asset
        while courant.parent and courant.parent in presents:
            if courant.identifiant in vus:  # une filiation ne boucle pas ; on s'en assure
                break
            vus.add(courant.identifiant)
            courant = presents[courant.parent]
        return courant.identifiant

    derives: dict[str, list[str]] = {}
    for asset in assets:
        racine = origine_de(asset)
        derives.setdefault(racine, [])
        if racine != asset.identifiant:
            derives[racine].append(asset.identifiant)

    # Le mieux classé de ce que le groupe porte — son origine comprise.
    def place(origine: str) -> int:
        return min([rang[origine], *(rang[d] for d in derives[origine])])

    return [
        {"origine": origine, "derives": derives[origine]}
        for origine in sorted(derives, key=place)
    ]


def ordonner_par_groupe(
    assets: Sequence["Asset"], groupes: Iterable[dict[str, Any]]
) -> list["Asset"]:
    """La même page, remise dans l'ordre des groupes : chaque origine, puis ses
    dérivés dans l'ordre du tri.

    `assets` reste **plat** dans la réponse — ce qui ne lit pas `groupes`
    continue de dessiner une grille juste, seulement mieux rangée.
    """
    par_identifiant = {a.identifiant: a for a in assets}
    ordonnes: list["Asset"] = []
    for groupe in groupes:
        for identifiant in (groupe["origine"], *groupe["derives"]):
            asset = par_identifiant.get(identifiant)
            if asset is not None:
                ordonnes.append(asset)
    return ordonnes
