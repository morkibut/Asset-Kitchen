"""Couverture et relecture des fabrications d'un emploi ; exécution via le suivi commun."""
from typing import Any

from fastapi import APIRouter, Query, Request, Response

routeur = APIRouter(prefix="/projects/{projet}/equipment/{piece}/uses/{emploi}")


def service(requete):
    return requete.app.state.atelier.travaux_equipement


@routeur.get("/coverage")
def couverture(requete: Request, projet: str, piece: str, emploi: str, resultats: list[str] | None = Query(default=None)):
    return service(requete).couverture.lire(projet, piece, emploi, resultats=resultats)


@routeur.post("/jobs/preview")
async def preparer(requete: Request, projet: str, piece: str, emploi: str, corps: dict[str, Any]):
    return await service(requete).preparer(projet, piece, emploi, corps)


@routeur.get("/jobs/{identifiant}/bases/{rang}")
def base(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, rang: int):
    return Response(service(requete).fichier(projet, piece, emploi, identifiant, "bases", rang), media_type="image/png")


@routeur.get("/jobs/{identifiant}/references/{rang}/{reference}")
def reference(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, rang: int, reference: int):
    return Response(service(requete).fichier(projet, piece, emploi, identifiant, "references", rang, reference), media_type="image/png")


@routeur.post("/jobs/{identifiant}/cancel")
def annuler(requete: Request, projet: str, piece: str, emploi: str, identifiant: str):
    return service(requete).annuler(projet, piece, emploi, identifiant)


@routeur.post("/jobs/{identifiant}/sheets/{appel}/confirm")
def confirmer(requete: Request, projet: str, piece: str, emploi: str, identifiant: str, appel: int):
    return service(requete).confirmer_decoupe(projet, piece, emploi, identifiant, appel)
