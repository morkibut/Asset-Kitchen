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


# **RV7** : ce qui est parti, rangé par case visée — déclarée avant
# `production-jobs/{identifiant}`, qui prendrait sinon « by-case » pour un
# identifiant. `personnage` restreint à un sujet ; la forme est écrite en tête
# de `atelier/services/retours.py`.
@routeur.get("/projects/{projet}/production-jobs/by-case")
def retours(requete: Request, projet: str, personnage: str | None = None):
    return requete.app.state.atelier.travaux.retours(projet, personnage)


@routeur.post("/projects/{projet}/production-jobs/preview")
async def preparer(requete: Request, projet: str, corps: dict[str, Any]):
    return await requete.app.state.atelier.travaux.preparer(projet, corps, "auteur")


# **RV5** : une série, préparée puis lancée par la fenêtre « Animer » pour
# plusieurs directions ou plusieurs clips d'un coup — même style que `preview`
# et `{identifiant}/start`, mêmes erreurs (`TravailRefuse` → 409, app.py:165).
# `corps` porte les réglages communs (comme `preview`), plus `cases` (les
# paires pose/direction, vide pour la case de `commune`) et `nombre` (1 à 8).
@routeur.post("/projects/{projet}/production-jobs/preview-series")
async def preparer_serie(requete: Request, projet: str, corps: dict[str, Any]):
    cases = corps.pop("cases", [])
    nombre = corps.pop("nombre", 1)
    return await requete.app.state.atelier.travaux.preparer_serie(projet, corps, cases, nombre, "auteur")


@routeur.post("/projects/{projet}/production-jobs/series/{cle}/start")
async def demarrer_serie(requete: Request, projet: str, cle: str):
    return await requete.app.state.atelier.travaux.demarrer_serie(projet, cle, "auteur")


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
