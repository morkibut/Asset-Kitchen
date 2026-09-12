"""Les mêmes livraisons que le MCP, depuis l'interface de l'atelier."""

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

routeur = APIRouter()


class AssociationGodot(BaseModel):
    dossier: str
    sous_dossier: str = "assets/asset-kitchen"


class PreparationLivraison(BaseModel):
    personnage: str
    bandes: list[str]
    pivot_x: float | None = None
    pivot_y: float | None = None
    boucles: dict[str, bool] = Field(default_factory=dict)


class PublicationLivraison(BaseModel):
    jeton: str


@routeur.get("/projects/{projet}/godot-link")
def association(requete: Request, projet: str) -> dict[str, Any] | None:
    return requete.app.state.atelier.livraison.association(projet)


@routeur.put("/projects/{projet}/godot-link")
def associer(requete: Request, projet: str, corps: AssociationGodot) -> dict[str, Any]:
    return requete.app.state.atelier.livraison.associer(projet, corps.dossier, corps.sous_dossier)


@routeur.get("/projects/{projet}/delivery-animations")
def animations(requete: Request, projet: str, personnage: str | None = None) -> list[dict[str, Any]]:
    return requete.app.state.atelier.livraison.animations(projet, personnage)


@routeur.get("/projects/{projet}/deliveries")
def historique(requete: Request, projet: str) -> dict[str, Any]:
    return requete.app.state.atelier.livraison.historique(projet)


@routeur.post("/projects/{projet}/deliveries/preview")
def prevoir(requete: Request, projet: str, corps: PreparationLivraison) -> dict[str, Any]:
    return requete.app.state.atelier.livraison.prevoir(projet, **corps.model_dump())


@routeur.post("/projects/{projet}/deliveries")
def livrer(requete: Request, projet: str, corps: PublicationLivraison) -> dict[str, Any]:
    return requete.app.state.atelier.livraison.livrer(projet, corps.jeton)


@routeur.post("/projects/{projet}/deliveries/{jeton}/preview")
def reprendre(requete: Request, projet: str, jeton: str) -> dict[str, Any]:
    return requete.app.state.atelier.livraison.reprendre(projet, jeton)
