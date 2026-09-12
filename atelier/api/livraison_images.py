"""Images fixes vers Godot, préparées et publiées par le service commun."""
from typing import Any
from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict

routeur = APIRouter()

class PreparationImage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    personnage: str
    image: str
    usage: str = "monde"
    pivot_x: float | None = None
    pivot_y: float | None = None

@routeur.get("/projects/{projet}/characters/{personnage}/delivery-images")
def images(requete: Request, projet: str, personnage: str) -> dict[str, Any]:
    return requete.app.state.atelier.livraison_images.images(projet, personnage)

@routeur.post("/projects/{projet}/image-deliveries/preview")
def prevoir(requete: Request, projet: str, corps: PreparationImage) -> dict[str, Any]:
    return requete.app.state.atelier.livraison_images.prevoir(projet, **corps.model_dump())
