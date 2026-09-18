"""AU15 : routes de variantes ciblées, sans logique de couverture propre."""
from typing import Any, Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

routeur = APIRouter(prefix="/projects/{projet}/equipment/{piece}/uses/{emploi}")


class CorpsVariante(BaseModel):
    # Absente : la pose de référence de la génération de l'image décide.
    cible: dict[str, Any] | None = None
    source: str
    role: Literal["reference", "source-equipee", "calque"]


class CorpsRevision(BaseModel):
    revision: int = Field(ge=1)


class CorpsReglage(CorpsRevision):
    placement: dict[str, Any] | None = None
    masques: dict[str, Any] | None = None


class CorpsExtraction(BaseModel):
    reglage: dict[str, Any] | None = None
    automatique: bool = False


class CorpsAdoption(CorpsRevision):
    cible: dict[str, Any]


class CorpsReemploi(BaseModel):
    cibles: list[dict[str, Any]]
    copier_placement: bool = True
    copier_masques: bool = False


class CorpsSource(CorpsRevision):
    recette: Literal["pose", "sienne"] = "pose"
    echelle: bool = True


class CorpsApercu(BaseModel):
    vue: Literal["composition", "base", "source", "calque"] = "composition"
    placement: dict[str, Any] | None = None
    masques: dict[str, Any] | None = None
    extraction: dict[str, Any] | None = None


def service(requete: Request):
    return requete.app.state.atelier.calques_cibles


@routeur.get("/targets")
async def cibles(requete: Request, projet: str, piece: str, emploi: str):
    return service(requete).cibles(projet, piece, emploi)


@routeur.get("/targets/preview.png")
async def image_cible(requete: Request, projet: str, piece: str, emploi: str,
                      nature: Literal["image", "frame"], resultat: str, prise: str = ""):
    return Response(service(requete).image_cible(projet, piece, emploi, {"nature": nature, "resultat": resultat, "prise": prise}),
                    media_type="image/png", headers={"Cache-Control": "no-store"})


@routeur.get("/targets/references")
async def poses_de_reference(requete: Request, projet: str, piece: str, emploi: str, source: str):
    """Les poses du porteur d'après lesquelles `source` a été fabriquée, la plus sûre d'abord."""
    return {"poses": service(requete).poses_de_reference(projet, piece, emploi, source)}


@routeur.get("/targets/made-from")
async def fabriquees_d_apres(requete: Request, projet: str, piece: str, emploi: str, resultat: str):
    """Les images de la bibliothèque fabriquées d'après cette pose."""
    return {"images": service(requete).fabriquees_d_apres(projet, piece, emploi, resultat)}


@routeur.post("/layers", status_code=201)
async def creer(requete: Request, projet: str, piece: str, emploi: str, corps: CorpsVariante):
    return service(requete).creer(projet, piece, emploi, corps.cible, corps.source, corps.role)


@routeur.get("/layers/{identifiant}")
async def lire(requete: Request, projet: str, piece: str, emploi: str, identifiant: str):
    return service(requete).lire(projet, piece, emploi, identifiant)


@routeur.put("/layers/{identifiant}")
async def regler(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsReglage):
    return service(requete).regler(projet, piece, emploi, identifiant, corps.revision,
                                  placement=corps.placement, masques=corps.masques)


@routeur.post("/layers/{identifiant}/extract", status_code=201)
async def extraire(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsExtraction):
    return service(requete).extraire(projet, piece, emploi, identifiant, reglage=corps.reglage, automatique=corps.automatique)


@routeur.post("/layers/{identifiant}/source")
async def reprendre_source(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsSource):
    return service(requete).reprendre_source(projet, piece, emploi, identifiant, corps.revision,
                                             recette=corps.recette, echelle=corps.echelle)


@routeur.post("/layers/{identifiant}/source-from-sheet")
async def relire_depuis_la_planche(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsRevision):
    """Relire l'image équipée depuis la planche revenue de sa fabrication — aucun appel au fournisseur."""
    return requete.app.state.atelier.travaux_equipement.relire_depuis_la_planche(
        projet, piece, emploi, identifiant, corps.revision)


@routeur.post("/layers/{identifiant}/validate")
async def valider(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsRevision):
    return service(requete).valider(projet, piece, emploi, identifiant, corps.revision)


@routeur.get("/layers/{identifiant}/alignment")
async def aligner(requete: Request, projet: str, piece: str, emploi: str, identifiant: str):
    return service(requete).aligner(projet, piece, emploi, identifiant)


@routeur.post("/layers/{identifiant}/reuse", status_code=201)
async def reutiliser(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsReemploi):
    return service(requete).reutiliser(projet, piece, emploi, identifiant, corps.cibles,
        copier_placement=corps.copier_placement, copier_masques=corps.copier_masques)


@routeur.post("/layers/{identifiant}/adopt")
async def adopter(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsAdoption):
    return service(requete).adopter(projet, piece, emploi, identifiant, corps.revision, corps.cible)


@routeur.get("/layers/{identifiant}/preview.png")
async def apercu(requete: Request, projet: str, piece: str, emploi: str, identifiant: str,
                 vue: Literal["composition", "base", "source", "calque"] = "composition"):
    return Response(service(requete).apercu(projet, piece, emploi, identifiant, vue),
                    media_type="image/png", headers={"Cache-Control": "no-store"})


@routeur.post("/layers/{identifiant}/preview.png")
async def apercu_brouillon(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, corps: CorpsApercu):
    return Response(service(requete).apercu(projet, piece, emploi, identifiant, corps.vue,
                    placement=corps.placement, masques=corps.masques, extraction=corps.extraction),
                    media_type="image/png", headers={"Cache-Control": "no-store"})
