"""Les mêmes tenues figées et compositions que celles de l'agent."""
import json
from typing import Any, Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

routeur = APIRouter(prefix="/projects/{projet}/characters/{personnage}/outfits")


class CorpsTenue(BaseModel):
    nom: str
    resultats: list[dict[str, Any]]
    emplois: list[dict[str, Any]] = Field(default_factory=list)
    choix: dict[str, dict[str, str]] = Field(default_factory=dict)
    pivot: dict[str, float] | None = None


class CorpsRevision(BaseModel):
    revision: int = Field(ge=1)


class CorpsRestauration(CorpsRevision):
    depuis: int = Field(ge=1)


class CorpsReglage(CorpsTenue):
    revision: int = Field(ge=1)


class CorpsSortie(BaseModel):
    mode: Literal["couches", "assemble"] = "couches"
    revision: int | None = Field(default=None, ge=1)


@routeur.get("")
async def lister(requete: Request, projet: str, personnage: str):
    return requete.app.state.atelier.tenues.lister(projet, personnage)


@routeur.post("", status_code=201)
async def creer(requete: Request, projet: str, personnage: str, corps: CorpsTenue):
    return requete.app.state.atelier.tenues.creer(projet, personnage, corps.model_dump())


@routeur.get("/{identifiant}")
async def lire(requete: Request, projet: str, personnage: str, identifiant: str, revision: int | None = None):
    return requete.app.state.atelier.tenues.lire(projet, personnage, identifiant, revision)


@routeur.put("/{identifiant}")
async def regler(requete: Request, projet: str, personnage: str, identifiant: str, corps: CorpsReglage):
    return requete.app.state.atelier.tenues.regler(projet, personnage, identifiant, corps.revision, corps.model_dump(exclude={"revision"}))


@routeur.post("/{identifiant}/refresh")
async def actualiser(requete: Request, projet: str, personnage: str, identifiant: str, corps: CorpsRevision):
    return requete.app.state.atelier.tenues.actualiser(projet, personnage, identifiant, corps.revision)


@routeur.get("/{identifiant}/preview.png")
async def apercu(requete: Request, projet: str, personnage: str, identifiant: str, sortie: str,
                 frame: int = 0, actifs: str | None = None, revision: int | None = None, priorites: str | None = None):
    from atelier.domaine.tenue import TenueRefusee
    try:
        choix = json.loads(actifs) if actifs is not None else None
        priorites_lues = json.loads(priorites) if priorites is not None else None
    except ValueError as erreur:
        raise TenueRefusee("La liste des pièces actives est invalide.") from erreur
    return Response(requete.app.state.atelier.tenues.apercu(projet, personnage, identifiant, sortie, frame, choix, revision, priorites_lues),
                    media_type="image/png", headers={"Cache-Control": "no-store"})


@routeur.post("/{identifiant}/restore")
async def restaurer(requete: Request, projet: str, personnage: str, identifiant: str, corps: CorpsRestauration):
    return requete.app.state.atelier.tenues.restaurer(projet, personnage, identifiant, corps.revision, corps.depuis)


@routeur.get("/{identifiant}/export.zip")
async def exporter(requete: Request, projet: str, personnage: str, identifiant: str,
                   mode: Literal["couches", "assemble"] = "couches", revision: int | None = None):
    return Response(requete.app.state.atelier.tenues.archive(projet, personnage, identifiant, mode, revision),
        media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="tenue-{identifiant}-{mode}.zip"'})


@routeur.post("/{identifiant}/delivery/preview")
async def livraison(requete: Request, projet: str, personnage: str, identifiant: str, corps: CorpsSortie):
    return requete.app.state.atelier.tenues.prevoir_livraison(projet, personnage, identifiant, corps.mode, corps.revision)
