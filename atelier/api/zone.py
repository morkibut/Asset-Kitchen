# -*- coding: utf-8 -*-
"""Repeindre une zone (PX3) — les routes de la fabrique « Repeindre ».

Ce qui ne lance rien se relit à chaque ouverture (l'état, ce qui partira, où en
est une zone lancée) ; ce qui lance est un `POST` et part par la file locale,
comme toute génération. La façade ne décide de rien : `ServiceZone` le fait.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from atelier.domaine.recette import COULEURS_NEUVES, traits_depuis_json

routeur = APIRouter(tags=["zone"])


def _service(requete: Request):
    return requete.app.state.atelier.zone


class CorpsTexte(BaseModel):
    texte: str = ""


class CorpsZone(BaseModel):
    """La zone en passages de pinceau (la forme d'un `Trait`), le texte, et les
    deux réglages de l'appel — tous deux facultatifs : sans graine, elle est
    tirée ; sans force, celle du profil."""

    texte: str = ""
    zone: list[dict[str, Any]] = Field(default_factory=list)
    graine: int | None = None
    force: float | None = None
    couleurs: int = COULEURS_NEUVES


@routeur.get("/assets/{identifiant}/zone")
async def etat(requete: Request, identifiant: str) -> dict[str, Any]:
    """Le modèle qui repeindra — ou pourquoi aucun, et quoi installer —, le temps
    annoncé, la force, et les calques déjà repeints sur cette image."""
    return await _service(requete).etat(identifiant)


@routeur.post("/assets/{identifiant}/zone/preview")
async def ce_qui_part(requete: Request, identifiant: str, corps: CorpsTexte) -> dict[str, Any]:
    """Le texte qui partira, tel que l'envoi le composera. Rien n'est lancé."""
    return _service(requete).ce_qui_part(identifiant, corps.texte)


@routeur.post("/assets/{identifiant}/zone", status_code=201)
async def lancer(requete: Request, identifiant: str, corps: CorpsZone) -> dict[str, Any]:
    """Peindre, écrire, lancer : la génération part par la file locale. L'écran
    suit ensuite `GET /zone/{generation}` jusqu'au calque."""
    service = _service(requete)
    generation = await service.lancer(
        identifiant,
        corps.texte,
        traits_depuis_json(corps.zone),
        graine=corps.graine,
        force=corps.force,
        couleurs=corps.couleurs,
    )
    return service.resultat(generation.identifiant)


@routeur.get("/zone/{generation}")
async def resultat(requete: Request, generation: str) -> dict[str, Any]:
    """Où en est une zone lancée — et son calque dès qu'il est né."""
    return _service(requete).resultat(generation)


# **Pas de route pour la fiche seule** (règle 8nonies) : l'écran la lit dans
# `calques` de l'état et dans le résultat, jamais à part.
