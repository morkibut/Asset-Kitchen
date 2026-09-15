# -*- coding: utf-8 -*-
"""Enregistrer sous — les quatre routes du geste d'`RP20`.

**Deux par calque, et la coupure est celle du slicer et du miroir** : ce qui ne
crée rien se redemande à chaque ouverture de fenêtre, ce qui crée un objet ne se
redemande jamais.

La proposition est un `POST` et non un `GET`, à la différence de celle du
miroir, pour une seule raison : **elle prend la recette courante**, celle que
l'écran tient et qui n'est pas forcément enregistrée. C'est tout l'intérêt du
geste — on enregistre sous *un brouillon* —, et une recette ne tient pas dans
une adresse. Même forme que `POST /assets/{id}/recipe/preview`, qui n'écrit rien
non plus.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from atelier.domaine.bande import Prise
from atelier.domaine.enregistrement import ANIMATION, IMAGE
from atelier.domaine.recette import Recette

routeur = APIRouter()


def _atelier(requete: Request):
    return requete.app.state.atelier


def _recette(brut: dict[str, Any] | None) -> Recette | None:
    """La recette de l'écran, ou rien — et rien veut dire *celle du disque*.

    Les deux ne se confondent pas : une recette absente est « je n'en parle
    pas », une recette vide serait « il n'y en a plus », et la seconde fait
    refuser le geste.
    """
    return Recette.depuis_json(brut) if brut is not None else None


class CorpsProposition(BaseModel):
    """Ce que l'écran tient sous les doigts au moment d'ouvrir la fenêtre."""

    recette: dict[str, Any] | None = None


class CorpsEnregistrerSous(CorpsProposition):
    """La case d'arrivée, et le nom.

    **Chaque champ est facultatif, et absent ne veut pas dire vide** : absent
    reprend la proposition du serveur, une chaîne vide retire la case. C'est la
    même distinction que sur la correction d'une bande, et c'est elle qui permet
    de ranger un résultat hors de toute case sans avoir à l'inventer.
    """

    sujet: str | None = None
    pose: str | None = None
    direction: str | None = None
    nom: str | None = None
    # **Les prises telles que le ruban les tient** (animation seulement) : une
    # image retirée ou dupliquée dans l'atelier doit l'être dans ce qui sort,
    # sinon l'enregistrement rendrait autre chose que ce que l'écran montrait.
    prises: list[dict[str, Any]] | None = None


@routeur.post("/assets/{identifiant}/save-as/preview")
async def proposer_pour_une_image(
    requete: Request, identifiant: str, corps: CorpsProposition | None = None
) -> dict[str, Any]:
    """La case proposée pour une image, et la raison quand le geste est fermé.

    Rien n'est créé, rien n'est écrit. Elle existe pour que l'écran grise
    *Enregistrer sous…* **avant** le clic, avec sa phrase.
    """
    return _atelier(requete).enregistrer_sous.proposer(
        IMAGE, identifiant, _recette(corps.recette if corps else None)
    )


@routeur.post("/assets/{identifiant}/save-as", status_code=201)
async def enregistrer_une_image_sous(
    requete: Request, identifiant: str, corps: CorpsEnregistrerSous | None = None
) -> dict[str, Any]:
    """Le rendu devient une image neuve, dans une autre case (`RP20`).

    L'original ne bouge pas — ni sa recette, ni son rendu. Aucun appel au
    fournisseur : le geste marche réseau coupé.
    """
    corps = corps or CorpsEnregistrerSous()
    return _atelier(requete).enregistrer_sous.enregistrer(
        IMAGE,
        identifiant,
        recette=_recette(corps.recette),
        sujet=corps.sujet,
        pose=corps.pose,
        direction=corps.direction,
        nom=corps.nom,
    )


@routeur.post("/strips/{identifiant}/save-as/preview")
async def proposer_pour_une_animation(
    requete: Request, identifiant: str, corps: CorpsProposition | None = None
) -> dict[str, Any]:
    """La même proposition, pour une animation."""
    return _atelier(requete).enregistrer_sous.proposer(
        ANIMATION, identifiant, _recette(corps.recette if corps else None)
    )


@routeur.post("/strips/{identifiant}/save-as", status_code=201)
async def enregistrer_une_animation_sous(
    requete: Request, identifiant: str, corps: CorpsEnregistrerSous | None = None
) -> dict[str, Any]:
    """Chaque frame rendue devient une image d'un clip neuf, et la bande suit.

    La cadence et le nombre d'images sont conservés ; la recette de la bande qui
    naît est vide, parce que ses pixels portent déjà tout ce que la recette
    disait.
    """
    corps = corps or CorpsEnregistrerSous()
    return _atelier(requete).enregistrer_sous.enregistrer(
        ANIMATION,
        identifiant,
        recette=_recette(corps.recette),
        sujet=corps.sujet,
        pose=corps.pose,
        direction=corps.direction,
        nom=corps.nom,
        prises=(
            [Prise.depuis_json(p) for p in corps.prises]
            if corps.prises is not None
            else None
        ),
    )
