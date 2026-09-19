"""TU5 : les matières générées sur la machine, pour un jeu de tuiles."""
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from atelier.services.matieres import TIRAGES_MAX, TIRAGES_MIN

routeur = APIRouter(prefix="/projects/{projet}/materials")


class Texte(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pierre: str
    motif: str
    cadrage: str


class Apercu(Texte):
    # Une image jointe ne change pas le texte ; elle change la taille annoncée, et
    # l'écran doit pouvoir dire qu'elle part (TU13).
    reference: bool = False


class Generer(Texte):
    tirages: int = Field(default=1, ge=TIRAGES_MIN, le=TIRAGES_MAX)
    graine: int | None = Field(default=None, ge=0)
    # L'identifiant d'une image de la bibliothèque, jamais des octets : c'est la
    # forme de toute référence du produit, et elle se rejoue à la reprise.
    reference_asset: str | None = None


@routeur.get("/availability")
async def disponibilite(requete: Request, projet: str) -> dict[str, Any]:
    return await requete.app.state.atelier.matieres.disponibilite()


@routeur.post("/preview")
def apercu(requete: Request, projet: str, corps: Apercu) -> dict[str, Any]:
    return requete.app.state.atelier.matieres.apercu(
        corps.pierre, corps.motif, corps.cadrage, reference=corps.reference,
    )


@routeur.post("/generate")
async def generer(requete: Request, projet: str, corps: Generer) -> dict[str, Any]:
    generations = await requete.app.state.atelier.matieres.generer(
        projet, pierre=corps.pierre, motif=corps.motif, cadrage=corps.cadrage,
        tirages=corps.tirages, graine=corps.graine, reference=corps.reference_asset,
    )
    return {"generations": [g.en_json() for g in generations]}
