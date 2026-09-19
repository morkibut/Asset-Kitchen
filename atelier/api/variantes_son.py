"""SN3 : les séries de tirages et les jeux de variantes.

Une série : `audio-series/estimate` (le temps, sans rien lancer), `prepare`,
`start`, `resume` (le seul geste qui reprend), `keep` (garder des tirages en
jeu de variantes). Un jeu : `sound-variants`, qui liste des sons par référence.
"""
from typing import Any

from fastapi import APIRouter, Request

routeur = APIRouter(prefix="/projects/{projet}")


def _series(requete: Request):
    return requete.app.state.atelier.series_son


def _jeux(requete: Request):
    return requete.app.state.atelier.variantes_son


# ── Les séries ────────────────────────────────────────────────────────────


@routeur.post("/audio-series/estimate")
async def annoncer(requete: Request, projet: str):
    """Le corps de `prepare` sans `cle` : nombre de tirages, temps de calcul
    d'après les mesures de la machine, texte qui partira. N'écrit rien."""
    return _series(requete).annoncer(projet, await requete.json())


@routeur.post("/audio-series/prepare")
async def preparer(requete: Request, projet: str):
    """`{cle, nombre?, nom?, famille?, prompt, …}` : le corps d'un son
    (`audio-jobs/prepare`) plus `nombre` (1 à 16 ; 8 ou 4 selon la famille)."""
    return await _series(requete).preparer(projet, await requete.json())


@routeur.get("/audio-series")
def lister(requete: Request, projet: str):
    return _series(requete).lister(projet)


@routeur.get("/audio-series/{serie}")
def lire(requete: Request, projet: str, serie: str):
    return _series(requete).lire(projet, serie)


@routeur.post("/audio-series/{serie}/start")
async def demarrer(requete: Request, projet: str, serie: str):
    return await _series(requete).demarrer(projet, serie)


@routeur.post("/audio-series/{serie}/resume")
async def reprendre(requete: Request, projet: str, serie: str):
    return await _series(requete).reprendre(projet, serie)


@routeur.post("/audio-series/{serie}/keep", status_code=201)
def garder(requete: Request, projet: str, serie: str, corps: dict[str, Any]):
    """`{rangs: [1, 3, 4]}` ou `{sons: [...]}`, `nom?`, `cle?` : un jeu de variantes."""
    return _series(requete).garder(projet, serie, corps)


# ── Les jeux de variantes ─────────────────────────────────────────────────


@routeur.get("/sound-variants")
def lister_jeux(requete: Request, projet: str, son: str | None = None):
    """Tous les jeux, ou (`?son=`) ceux qui contiennent ce son."""
    return _jeux(requete).lister(projet, son)


@routeur.post("/sound-variants", status_code=201)
def creer_jeu(requete: Request, projet: str, corps: dict[str, Any]):
    """`{nom, sons: [...], famille?, serie?, cle?, appliquer_reglages?}`."""
    return _jeux(requete).creer(projet, corps)


@routeur.get("/sound-variants/{jeu}")
def lire_jeu(requete: Request, projet: str, jeu: str):
    return _jeux(requete).lire(projet, jeu)


@routeur.patch("/sound-variants/{jeu}")
def modifier_jeu(requete: Request, projet: str, jeu: str, corps: dict[str, Any]):
    """`{nom?, famille?}`."""
    return _jeux(requete).modifier(projet, jeu, corps)


@routeur.post("/sound-variants/{jeu}/sounds")
def ajouter_son(requete: Request, projet: str, jeu: str, corps: dict[str, Any]):
    """`{son, position?, appliquer_reglages?}` : aucun son n'est refusé pour
    une mesure. `appliquer_reglages` pose sur le son ajouté les réglages de la
    famille du jeu, comme le geste « garder » d'une série."""
    return _jeux(requete).ajouter(projet, jeu, corps.get("son"), corps.get("position"),
                                  appliquer_reglages=corps.get("appliquer_reglages", False))


@routeur.delete("/sound-variants/{jeu}/sounds/{son}")
def retirer_son(requete: Request, projet: str, jeu: str, son: str):
    return _jeux(requete).retirer(projet, jeu, son)


@routeur.delete("/sound-variants/{jeu}")
def supprimer_jeu(requete: Request, projet: str, jeu: str):
    """Le jeu disparaît ; ses sons restent dans la galerie."""
    return _jeux(requete).supprimer(projet, jeu)


@routeur.post("/sound-variants/{jeu}/delivery/preview")
def previsualiser_livraison_jeu(requete: Request, projet: str, jeu: str):
    """Aperçu de livraison du jeu : ses sons livrables, numérotés, et
    l'`AudioStreamRandomizer` qui les rassemble. N'écrit rien dans le jeu."""
    return _jeux(requete).prevoir_livraison(projet, jeu)
