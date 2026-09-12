"""Profils nommés et images locales ; le suivi reste celui des travaux AU3."""
from fastapi import APIRouter, Request

routeur = APIRouter()


@routeur.get("/workflow-profiles")
def lister(requete: Request):
    return {"profils": requete.app.state.atelier.profils_workflow.lister()}


@routeur.post("/workflow-profiles")
async def importer(requete: Request):
    atelier = requete.app.state.atelier
    profil = atelier.profils_workflow.importer(await requete.json())
    await atelier.catalogue.rafraichir()
    await atelier.animation.rafraichir()
    return profil


@routeur.get("/workflow-profiles/{identifiant}/versions/{version}")
def lire(requete: Request, identifiant: str, version: str):
    return requete.app.state.atelier.profils_workflow.lire(identifiant, version)


@routeur.post("/workflow-profiles/{identifiant}/versions/{version}/diagnose")
async def diagnostiquer(requete: Request, identifiant: str, version: str):
    return await requete.app.state.atelier.profils_workflow.diagnostiquer(identifiant, version)


@routeur.post("/projects/{projet}/workflow-image-jobs/prepare")
async def preparer(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux_workflow.preparer(projet, await requete.json())


@routeur.post("/projects/{projet}/free-video-jobs/prepare")
async def preparer_video(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux.preparer(projet, await requete.json(), source_libre=True)


@routeur.post("/projects/{projet}/audio-jobs/prepare")
async def preparer_audio(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux_audio.preparer(projet, await requete.json())
