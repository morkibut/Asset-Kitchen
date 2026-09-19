"""Un ensemble révisé, les mêmes tuiles pour la main et l’agent."""
from typing import Any
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field

routeur = APIRouter(prefix="/projects/{projet}/tilesets")

class Revision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1, strict=True)

class Reglage(Revision):
    regles: dict[str, Any] = Field(default_factory=dict)
    actualiser_source: bool = False
    # Un jeu fabriqué (TU2) change de recette avec l'atlas qu'elle rend, en base64.
    recette: dict[str, Any] | None = None
    atlas: str | None = None

class Restauration(Revision):
    depuis: int = Field(ge=1, strict=True)

@routeur.get("")
def lister(requete: Request, projet: str):
    return requete.app.state.atelier.tuiles.lister(projet)

@routeur.post("", status_code=201)
def creer(requete: Request, projet: str, corps: dict[str, Any]):
    return requete.app.state.atelier.tuiles.creer(projet, corps)

@routeur.get("/{identifiant}")
def lire(requete: Request, projet: str, identifiant: str, revision: int | None = None):
    return requete.app.state.atelier.tuiles.lire(projet, identifiant, revision)

@routeur.put("/{identifiant}")
def regler(requete: Request, projet: str, identifiant: str, corps: Reglage):
    return requete.app.state.atelier.tuiles.regler(projet, identifiant, corps.revision, corps.regles, actualiser_source=corps.actualiser_source,
                                                   recette=corps.recette, atlas=corps.atlas)

@routeur.post("/{identifiant}/restore")
def restaurer(requete: Request, projet: str, identifiant: str, corps: Restauration):
    return requete.app.state.atelier.tuiles.restaurer(projet, identifiant, corps.revision, corps.depuis)

@routeur.get("/{identifiant}/preview.png")
def apercu(requete: Request, projet: str, identifiant: str, revision: int | None = None, carte: bool = False):
    return Response(requete.app.state.atelier.tuiles.apercu(projet, identifiant, revision=revision, carte=carte),
                    media_type="image/png", headers={"Cache-Control": "no-store"})

@routeur.post("/{identifiant}/tiles/{x}/{y}/extract")
def extraire(requete: Request, projet: str, identifiant: str, x: int, y: int, corps: Revision):
    return requete.app.state.atelier.tuiles.extraire(projet, identifiant, x, y, corps.revision)

@routeur.get("/{identifiant}/export.zip")
def exporter(requete: Request, projet: str, identifiant: str, revision: int | None = None):
    return Response(requete.app.state.atelier.tuiles.archive(projet, identifiant, revision), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="tuiles-{identifiant}.zip"'})

@routeur.post("/{identifiant}/delivery/preview")
def livraison(requete: Request, projet: str, identifiant: str, corps: Revision):
    return requete.app.state.atelier.tuiles.prevoir_livraison(projet, identifiant, corps.revision)
