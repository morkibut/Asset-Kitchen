"""Écoute, correction et livraison des sources audio conservées."""
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

routeur = APIRouter(prefix="/projects/{projet}/sounds")


class Revision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1, strict=True)


class Reglage(Revision):
    recette: dict
    nom: str | None = None


class Restauration(Revision):
    depuis: int = Field(ge=1, strict=True)


class Jugement(Revision):
    jugement: str


@routeur.get("")
def lister(requete: Request, projet: str):
    return requete.app.state.atelier.sons.lister(projet)


@routeur.post("/import", status_code=201)
async def importer(requete: Request, projet: str, nom: str = "Son importé"):
    from atelier.domaine.son import SonRefuse
    from starlette.concurrency import run_in_threadpool
    morceaux, taille = [], 0
    async for morceau in requete.stream():
        taille += len(morceau)
        if taille > 256 * 1024 * 1024:
            raise SonRefuse("Importez un fichier audio de 256 Mo au plus.")
        morceaux.append(morceau)
    return await run_in_threadpool(requete.app.state.atelier.sons.importer_octets, projet, b"".join(morceaux), nom=nom)


@routeur.get("/{identifiant}")
def lire(requete: Request, projet: str, identifiant: str, revision: int | None = None):
    return requete.app.state.atelier.sons.lire(projet, identifiant, revision)


@routeur.put("/{identifiant}")
def regler(requete: Request, projet: str, identifiant: str, corps: Reglage):
    return requete.app.state.atelier.sons.regler(projet, identifiant, corps.revision, corps.recette, nom=corps.nom)


@routeur.post("/{identifiant}/restore")
def restaurer(requete: Request, projet: str, identifiant: str, corps: Restauration):
    return requete.app.state.atelier.sons.restaurer(projet, identifiant, corps.revision, corps.depuis)


@routeur.post("/{identifiant}/judgment")
def juger(requete: Request, projet: str, identifiant: str, corps: Jugement):
    return requete.app.state.atelier.sons.juger(projet, identifiant, corps.revision, corps.jugement)


@routeur.get("/{identifiant}/source")
def source(requete: Request, projet: str, identifiant: str):
    return FileResponse(requete.app.state.atelier.sons.source(projet, identifiant), media_type="application/octet-stream", filename="source-" + identifiant)


@routeur.get("/{identifiant}/preview.wav")
def rendu(requete: Request, projet: str, identifiant: str, revision: int | None = None, brut: bool = False):
    return FileResponse(requete.app.state.atelier.sons.rendu(projet, identifiant, revision, brut=brut), media_type="audio/wav", headers={"Cache-Control": "no-store"})


@routeur.get("/{identifiant}/waveform")
def forme_onde(requete: Request, projet: str, identifiant: str, revision: int | None = None, brut: bool = False):
    return requete.app.state.atelier.sons.forme_onde(projet, identifiant, revision, brut=brut)


@routeur.get("/{identifiant}/loop-splice.wav")
def raccord(requete: Request, projet: str, identifiant: str, revision: int | None = None):
    octets = requete.app.state.atelier.sons.raccord(projet, identifiant, revision)
    return Response(octets, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@routeur.get("/{identifiant}/export.zip")
def archive(requete: Request, projet: str, identifiant: str, revision: int | None = None):
    return Response(requete.app.state.atelier.sons.archive(projet, identifiant, revision), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="son-{identifiant}.zip"'})


@routeur.post("/{identifiant}/delivery/preview")
def livraison(requete: Request, projet: str, identifiant: str, corps: Revision):
    return requete.app.state.atelier.sons.prevoir_livraison(projet, identifiant, corps.revision)
