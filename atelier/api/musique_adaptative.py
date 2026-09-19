# -*- coding: utf-8 -*-
"""SN10 : la musique adaptative — un objet qui référence des sons déjà faits.

`adaptive-music` : créer, lire, lister, modifier (remplacement en bloc des
couches/morceaux/transitions), supprimer, et l'aperçu de livraison.
"""
from typing import Any

from fastapi import APIRouter, Request

routeur = APIRouter(prefix="/projects/{projet}")


def _service(requete: Request):
    return requete.app.state.atelier.musique_adaptative


@routeur.get("/adaptive-music")
def lister(requete: Request, projet: str):
    return _service(requete).lister(projet)


@routeur.post("/adaptive-music", status_code=201)
def creer(requete: Request, projet: str, corps: dict[str, Any]):
    """`{nom, couches?: [{cle, son, volume_db?}], morceaux?: [{cle, son, nom?}],
    transitions?: [{de, vers, depart?, arrivee?, fondu?, fondu_temps?}]}`."""
    return _service(requete).creer(projet, corps)


@routeur.get("/adaptive-music/{identifiant}")
def lire(requete: Request, projet: str, identifiant: str):
    return _service(requete).lire(projet, identifiant)


@routeur.patch("/adaptive-music/{identifiant}")
def modifier(requete: Request, projet: str, identifiant: str, corps: dict[str, Any]):
    """`{nom?, couches?, morceaux?, transitions?}` : ce qui est donné remplace
    en bloc ; ce qui manque garde sa valeur."""
    return _service(requete).modifier(projet, identifiant, corps)


@routeur.delete("/adaptive-music/{identifiant}")
def supprimer(requete: Request, projet: str, identifiant: str):
    """L'objet disparaît ; les sons qu'il référençait restent dans la galerie."""
    return _service(requete).supprimer(projet, identifiant)


@routeur.post("/adaptive-music/{identifiant}/delivery/preview")
def previsualiser_livraison(requete: Request, projet: str, identifiant: str):
    """Aperçu de livraison : les couches en `AudioStreamSynchronized`, les
    morceaux et leurs transitions en `AudioStreamInteractive`. N'écrit rien
    dans le jeu Godot."""
    return _service(requete).prevoir_livraison(projet, identifiant)
