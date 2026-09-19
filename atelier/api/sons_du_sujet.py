"""SN6 : les sons d'un sujet — ses emplacements, et une série depuis l'un d'eux.

`subjects/{sujet}/sounds` : les emplacements, remplis ou vides ;
`…/{emplacement}` : poser (PUT `{jeu}` ou `{son}`), vider (DELETE `…/content`) ;
`…/{emplacement}/series/propose` : la demande proposée (n'écrit rien) ;
`…/{emplacement}/series` : préparer une série liée à l'emplacement — « Garder »
dans cette série range dans le jeu de l'emplacement. `subject-sounds` : tous
les emplacements remplis du jeu (la galerie et « Livrer au jeu » s'en servent).
"""
from typing import Any

from fastapi import APIRouter, Request

routeur = APIRouter(prefix="/projects/{projet}")


def _service(requete: Request):
    return requete.app.state.atelier.sons_du_sujet


@routeur.get("/subject-sounds")
def index(requete: Request, projet: str):
    return _service(requete).index(projet)


@routeur.get("/subjects/{sujet}/sounds")
def lire(requete: Request, projet: str, sujet: str):
    return _service(requete).lire(projet, sujet)


@routeur.post("/subjects/{sujet}/sounds", status_code=201)
def ajouter(requete: Request, projet: str, sujet: str, corps: dict[str, Any]):
    """`{nom, famille}` : un emplacement nommé à la main."""
    return _service(requete).ajouter(projet, sujet, corps)


@routeur.delete("/subjects/{sujet}/sounds/{emplacement}")
def retirer(requete: Request, projet: str, sujet: str, emplacement: str):
    """Un emplacement nommé à la main disparaît ; ses sons restent dans la galerie."""
    return _service(requete).retirer_emplacement(projet, sujet, emplacement)


@routeur.put("/subjects/{sujet}/sounds/{emplacement}")
def poser(requete: Request, projet: str, sujet: str, emplacement: str, corps: dict[str, Any]):
    """`{jeu}` ou `{son}` : ce que l'emplacement désigne."""
    return _service(requete).poser(projet, sujet, emplacement, corps)


@routeur.delete("/subjects/{sujet}/sounds/{emplacement}/content")
def vider(requete: Request, projet: str, sujet: str, emplacement: str):
    """L'emplacement redevient vide ; rien ne quitte la galerie."""
    return _service(requete).vider(projet, sujet, emplacement)


@routeur.post("/subjects/{sujet}/sounds/{emplacement}/series/propose")
def proposer(requete: Request, projet: str, sujet: str, emplacement: str):
    """La demande proposée depuis l'emplacement. N'écrit rien, ne lance rien."""
    return _service(requete).proposer(projet, sujet, emplacement)


@routeur.post("/subjects/{sujet}/sounds/{emplacement}/series")
async def preparer(requete: Request, projet: str, sujet: str, emplacement: str):
    """Le corps d'une série (`famille`, `prompt`, `nombre`, `texte_relu`…),
    relu à l'écran. La série est préparée, pas lancée."""
    return await _service(requete).preparer_serie(projet, sujet, emplacement, await requete.json())
