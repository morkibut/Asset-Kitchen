"""La même file locale pour l'auteur et l'agent."""

from fastapi import APIRouter, Request

routeur = APIRouter()


@routeur.get("/local-queue")
def lire(requete: Request):
    file = requete.app.state.atelier.file_locale
    return {**file.lister(), "mesures": file.mesures()}


@routeur.get("/local-queue/engines")
async def moteurs(requete: Request):
    return {"moteurs": await requete.app.state.atelier.file_locale.observer()}


@routeur.post("/local-queue/{identifiant}/resume")
async def reprendre(requete: Request, identifiant: str):
    return await requete.app.state.atelier.file_locale.lancer(identifiant, reprise=True)


@routeur.post("/local-queue/{identifiant}/cancel")
def annuler(requete: Request, identifiant: str):
    return requete.app.state.atelier.file_locale.annuler(identifiant)
