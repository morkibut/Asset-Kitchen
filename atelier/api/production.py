# -*- coding: utf-8 -*-
"""Les routes de C1 — le plan de poses, les personnages, et leur matrice.

Même règle que les trois autres routeurs : aucune logique ici, chaque route
appelle un service et met en forme. **Chemins en anglais, charges utiles en
français.** Monté sous le même préfixe : de l'extérieur, l'API n'a pas de
couture.

Un quatrième module parce qu'il répond à une quatrième question. `routes.py` dit
*comment on fabrique une image*, `bibliotheque.py` *où elle se range*,
`univers.py` *ce qui la contraint avant qu'elle existe* — et celui-ci **ce qu'il
reste à fabriquer**.

**Aucune de ces routes ne touche le réseau.** Le plan, le personnage et la
matrice se consultent et se modifient réseau coupé ; seule la génération échoue,
au moment où on l'essaie, et elle part d'ailleurs.

**Les poses sont à trois segments, et c'est un piège déjà payé.** `/characters/…`
à deux segments entrerait en concurrence avec `/characters/{identifiant}` et ne
serait atteinte que si elle était déclarée avant — l'adresse dépendrait alors de
l'ordre des fonctions dans ce fichier. Le dépôt a déjà payé un chemin qui ne
s'atteint pas (`Mount("/mcp")`, voir `docs/PIEGES.md`) ; à trois segments il n'y
a plus d'ordre à respecter, et les routes des poses sont malgré tout écrites en
premier — un lecteur ne devrait pas avoir à vérifier que ça tient.
"""

from __future__ import annotations

from typing import Any

from typing import Literal

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from atelier.services import Atelier

routeur = APIRouter()


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


def _projet(requete: Request, projet: str | None) -> str:
    """Le projet visé — celui qu'on nomme, sinon celui qui est ouvert.

    Le défaut est ici et non dans le service, pour la raison de `univers.py` :
    un agent nommera toujours son projet, et le service doit pouvoir refuser un
    projet manquant plutôt que d'en inventer un.
    """
    return projet or _atelier(requete).bibliotheque.courant or ""


# ── Ce que l'écran envoie ────────────────────────────────────────────────────


class CorpsPose(BaseModel):
    """Une attitude que le jeu réclame. Le nom suffit à la créer."""

    nom: str = Field(min_length=1)
    # Combien d'images cette pose demande. Un pour la plupart, quatre ou huit
    # pour un cycle — c'est l'auteur qui le décide, jamais le produit.
    images: int = Field(1, ge=1, le=64)
    projet: str | None = None


class CorpsReglagePose(BaseModel):
    """Renommer une pose, ou changer ce qu'elle demande. `None` ne touche pas.

    **L'identifiant ne bouge jamais** : les images déjà faites le portent, et
    renommer une pose ne doit pas leur faire perdre leur case (US-118).
    """

    nom: str | None = None
    images: int | None = Field(None, ge=1, le=64)
    projet: str | None = None


class CorpsPersonnage(BaseModel):
    """Un nom, une description, et rien d'autre (US-115).

    **Il n'y a pas de prompt ici, et c'est un invariant de la tranche** : le
    corps naît dans l'atelier et nulle part ailleurs. Ce que cette route crée,
    c'est une colonne de cases vides.
    """

    nom: str = Field(min_length=1)
    description: str = ""
    projet: str | None = None


class CorpsReglagePersonnage(BaseModel):
    """Tout ce qui se règle sur un personnage, **en un seul geste**.

    Les champs se remplissent ensemble à l'écran — on décrit en cochant les
    poses —, et un appel par champ ferait autant d'allers-retours qu'il y a de
    cases. `None` ne touche pas.

    `poses` arrive en **positif** : ce que l'auteur a coché. Le fichier, lui,
    garde le complément — voir `atelier/domaine/personnage.py`.
    """

    nom: str | None = None
    description: str | None = None
    poses: list[str] | None = None
    concept_arts: list[str] | None = None
    projet: str | None = None


def _avec_plan(atelier: Atelier, projet: str, pose: Any) -> dict[str, Any]:
    """La pose touchée, **et le plan entier avec**.

    Les trois gestes du plan rendent la même forme que l'annonce du flux, et
    c'est délibéré : un écran fond ce qu'il reçoit par les deux chemins avec le
    même code, et il n'a jamais à deviner si une pose vient d'être ajoutée,
    renommée ou retirée. Le plan est court — le rendre entier ne coûte rien, et
    reconstituer un ordre à partir d'un message partiel coûterait une règle de
    plus à écrire deux fois (`docs/PIEGES.md` — tout ce qui arrive par deux
    chemins se fond par identifiant).
    """
    return {
        "pose": pose.en_json(),
        "plan": [p.en_json() for p in atelier.production.plan(projet)],
    }


class CorpsEcartees(BaseModel):
    """Ce qui ne partira plus, à l'une des **deux portées durables** (US-126).

    La troisième — cette génération — ne passe pas par ici : elle ne s'écrit
    nulle part et part avec l'appel, comme la pile d'annulation de T8.

    La liste est **entière**, jamais un ajout : l'écran montre l'état complet
    des cases, et envoyer un delta rendrait possible deux onglets qui cochent
    et décochent la même ligne sans jamais converger.
    """

    portee: Literal["projet", "personnage"]
    ecartees: list[str] = Field(default_factory=list)
    personnage: str | None = None
    projet: str | None = None


class CorpsDesignation(BaseModel):
    """Quelle case cette image remplit (US-122).

    Les deux vides ensemble retirent la désignation ; l'image, elle, ne bouge
    pas de la bibliothèque.
    """

    personnage: str | None = None
    pose: str | None = None
    projet: str | None = None


# ── Le plan de poses ─────────────────────────────────────────────────────────


@routeur.post("/characters/poses", status_code=201)
async def ajouter_pose(requete: Request, corps: CorpsPose) -> dict[str, Any]:
    """Une attitude de plus au plan du projet (US-116, US-118).

    **Nommer, c'est créer**, et ça n'ajoute qu'une case vide : aucune génération
    ne part, et chaque personnage du projet voit paraître la ligne neuve sans
    qu'un seul de leurs fichiers soit écrit.
    """
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    pose = atelier.production.ajouter_pose(projet, corps.nom, corps.images)
    return _avec_plan(atelier, projet, pose)


@routeur.put("/characters/poses/{pose}")
async def regler_pose(
    requete: Request, pose: str, corps: CorpsReglagePose
) -> dict[str, Any]:
    """Renommer une pose, ou changer le nombre d'images qu'elle demande."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    reglee = atelier.production.regler_pose(
        projet, pose, nom=corps.nom, images=corps.images
    )
    return _avec_plan(atelier, projet, reglee)


@routeur.delete("/characters/poses/{pose}")
async def retirer_pose(
    requete: Request, pose: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Une pose quitte le plan. **Les images faites pour elle restent** — jamais
    de cascade, et elles gardent son identifiant : remettre la même pose au plan
    les remet dans leur case."""
    atelier = _atelier(requete)
    vise = _projet(requete, projet)
    retiree = atelier.production.retirer_pose(vise, pose)
    return _avec_plan(atelier, vise, retiree)


# ── Les personnages ──────────────────────────────────────────────────────────


@routeur.get("/characters")
async def tableau_de_bord(
    requete: Request, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Le plan et les personnages, **en un seul aller-retour**.

    Comme la toile de T8 : une colonne de cases n'existe que par le plan qui la
    nomme, et deux appels rendraient possible l'instant où l'un est arrivé et
    l'autre non.
    """
    return _atelier(requete).production.tableau_de_bord(_projet(requete, projet))


@routeur.post("/characters", status_code=201)
async def creer_personnage(requete: Request, corps: CorpsPersonnage) -> dict[str, Any]:
    """Un personnage de plus dans le projet (US-115). Ne coûte rien, ne sort pas."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    personnage = atelier.production.creer_personnage(
        projet, corps.nom, corps.description
    )
    # **La forme complète, comme l'annonce du flux.** L'écran fond ce qui lui
    # arrive par les deux chemins avec le même code : une charge amputée de ses
    # cases y remplacerait un objet entier par un objet à trous.
    return {"personnage": atelier.production.en_charge(projet, personnage)}


@routeur.put("/characters/{identifiant}")
async def regler_personnage(
    requete: Request, identifiant: str, corps: CorpsReglagePersonnage
) -> dict[str, Any]:
    """Décrire, renommer, cocher ses poses, désigner ses concept arts."""
    atelier = _atelier(requete)
    projet = _projet(requete, corps.projet)
    personnage = atelier.production.regler_personnage(
        projet,
        identifiant,
        nom=corps.nom,
        description=corps.description,
        tenues=corps.poses,
        concept_arts=corps.concept_arts,
    )
    return {"personnage": atelier.production.en_charge(projet, personnage)}


@routeur.delete("/characters/{identifiant}")
async def supprimer_personnage(
    requete: Request, identifiant: str, projet: str | None = Query(None)
) -> dict[str, Any]:
    """Le personnage part, **ses images restent**, chacune marquée « personnage
    supprimé ». Jamais de cascade — la règle générale du produit (US-28)."""
    atelier = _atelier(requete)
    return atelier.production.supprimer_personnage(_projet(requete, projet), identifiant)


# ── La case qu'une image remplit ─────────────────────────────────────────────


@routeur.put("/assets/{identifiant}/character")
async def designer(
    requete: Request, identifiant: str, corps: CorpsDesignation
) -> dict[str, Any]:
    """Désigner une image comme le corps d'une case, ou l'en retirer (US-122).

    **Une route d'asset dans ce module-ci**, comme le rangement et le favori
    vivent dans celui de la bibliothèque : le chemin dit sur quoi le geste
    porte, le module dit à quelle question il répond. Celle-ci est « quelle case
    cette image remplit », et c'est la question de la matrice.
    """
    atelier = _atelier(requete)
    asset = atelier.production.designer(
        identifiant,
        projet=_projet(requete, corps.projet),
        personnage=corps.personnage,
        pose=corps.pose,
    )
    return asset.en_json()


# ── Ce qui ne part plus ──────────────────────────────────────────────────────


@routeur.put("/references")
async def ecarter(requete: Request, corps: CorpsEcartees) -> dict[str, Any]:
    """Décocher une référence pour un personnage, ou pour tout le projet (US-126).

    **Ni l'univers ni les artworks officiels ne bougent** — c'est un critère
    d'acceptation, et il est vrai par construction : la liste vit sur le projet
    à côté des teintes, jamais dans `Univers`. Une carte décochée reste promue,
    garde sa famille, et continue de compter dans la palette.
    """
    atelier = _atelier(requete)
    return atelier.production.ecarter(
        _projet(requete, corps.projet),
        portee=corps.portee,
        references=corps.ecartees,
        personnage=corps.personnage,
    )
