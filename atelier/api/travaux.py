"""Fabrications humaines suivies, relecture et cadre de l'agent."""

from typing import Any

from fastapi import APIRouter, Request, Response

routeur = APIRouter()


@routeur.get("/projects/{projet}/delegation")
def cadre(requete: Request, projet: str):
    return requete.app.state.atelier.travaux.cadre(projet)


@routeur.put("/projects/{projet}/delegation")
def regler(requete: Request, projet: str, corps: dict[str, Any]):
    return requete.app.state.atelier.travaux.regler_cadre(projet, corps)


@routeur.get("/projects/{projet}/production-jobs")
def lister(requete: Request, projet: str):
    return requete.app.state.atelier.travaux.lister(projet)


@routeur.post("/projects/{projet}/production-jobs/preview")
async def preparer(requete: Request, projet: str, corps: dict[str, Any]):
    return await requete.app.state.atelier.travaux.preparer(projet, corps, "auteur")


@routeur.post("/projects/{projet}/production-jobs/{identifiant}/start")
async def demarrer(requete: Request, projet: str, identifiant: str):
    return await requete.app.state.atelier.travaux.demarrer(projet, identifiant, "auteur")


@routeur.post("/projects/{projet}/production-jobs/{identifiant}/resume")
async def reprendre(requete: Request, projet: str, identifiant: str):
    return await requete.app.state.atelier.travaux.demarrer(projet, identifiant, "auteur", reprise=True)


@routeur.get("/projects/{projet}/production-jobs/{identifiant}")
async def lire(requete: Request, projet: str, identifiant: str, attente: float = 0):
    return await requete.app.state.atelier.travaux.attendre(projet, identifiant, attente)


@routeur.get("/projects/{projet}/production-jobs/{identifiant}/references/{rang}")
def reference(requete: Request, projet: str, identifiant: str, rang: int):
    return Response(requete.app.state.atelier.travaux.reference(projet, identifiant, rang), media_type="image/png")


@routeur.get("/projects/{projet}/production-jobs/{identifiant}/video-reference")
def entree(requete: Request, projet: str, identifiant: str):
    return Response(requete.app.state.atelier.travaux.reference(projet, identifiant), media_type="image/png")
