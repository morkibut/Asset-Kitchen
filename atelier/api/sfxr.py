# -*- coding: utf-8 -*-
"""Fabriquer un son rétro sfxr, sans ComfyUI et sans dépense (SN8)."""
from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

routeur = APIRouter(prefix="/projects/{projet}/sounds/sfxr")


class Fabrication(BaseModel):
    model_config = ConfigDict(extra="forbid")
    depart: str | None = None
    parametres: dict | None = None
    graine: int = Field(ge=0, strict=True)
    nom: str | None = None


class Variantes(Fabrication):
    nombre: int = Field(ge=1, le=16, strict=True, default=8)


@routeur.get("/starts")
def departs(requete: Request, projet: str):
    return requete.app.state.atelier.sfxr.departs()


@routeur.post("", status_code=201)
def fabriquer(requete: Request, projet: str, corps: Fabrication):
    return requete.app.state.atelier.sfxr.fabriquer(projet, depart=corps.depart,
        parametres=corps.parametres, graine=corps.graine, nom=corps.nom)


@routeur.post("/variants", status_code=201)
def variantes(requete: Request, projet: str, corps: Variantes):
    return requete.app.state.atelier.sfxr.variantes(projet, depart=corps.depart,
        parametres=corps.parametres, graine=corps.graine, nombre=corps.nombre, nom=corps.nom)
