# -*- coding: utf-8 -*-
"""L'application FastAPI — une façade sur `services/`, et rien d'autre.

Le démarrage fait deux choses et ne lève jamais : il relit le catalogue et
marque ce que l'arrêt précédent a coupé. **L'atelier s'ouvre sans réseau et
sans clé** — l'échec attend le moment où on génère (US-95).
"""

from __future__ import annotations

import contextlib
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from atelier.api.routes import routeur
from atelier.domaine.erreurs import (
    AppelRefuse,
    DemandeRefusee,
    ErreurAtelier,
    FournisseurIndisponible,
    GenerationInconnue,
    ModeleInconnu,
    SansCle,
)
from atelier.reglages import RACINE
from atelier.services import Atelier
from atelier.services.assets import AssetInconnu, RecetteRefusee

# Le code HTTP de chaque refus du produit. La raison, elle, est toujours la
# même phrase en français — c'est elle que l'interface affiche.
CODES = {
    SansCle: 409,
    DemandeRefusee: 409,
    ModeleInconnu: 404,
    GenerationInconnue: 404,
    FournisseurIndisponible: 503,
    AppelRefuse: 502,
    AssetInconnu: 404,
    RecetteRefusee: 409,
}

INTERFACE = RACINE / "interface" / "dist"


def creer_application(atelier: Atelier | None = None) -> FastAPI:
    @contextlib.asynccontextmanager
    async def cycle(application: FastAPI) -> AsyncIterator[None]:
        await application.state.atelier.ouvrir()
        yield

    application = FastAPI(
        title="Asset Kitchen",
        version="0.1.0",
        lifespan=cycle,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    application.state.atelier = atelier or Atelier()
    application.include_router(routeur, prefix="/api")

    @application.exception_handler(ErreurAtelier)
    async def _refus(_: Request, erreur: ErreurAtelier) -> JSONResponse:
        return JSONResponse(
            status_code=CODES.get(type(erreur), 400),
            content={
                "code": erreur.code,
                "raison": erreur.raison,
                "ou_aller": erreur.ou_aller,
            },
        )

    _monter_interface(application)
    return application


def _monter_interface(application: FastAPI) -> None:
    """L'interface compilée, quand elle existe. Sinon, une page qui le dit."""
    if INTERFACE.is_dir():
        application.mount(
            "/", StaticFiles(directory=INTERFACE, html=True), name="interface"
        )
        return

    @application.get("/", include_in_schema=False)
    async def _sans_interface() -> JSONResponse:
        return JSONResponse(
            {
                "atelier": "Asset Kitchen",
                "interface": "pas encore compilée — voir interface/",
                "api": "/api/docs",
            }
        )


def app() -> FastAPI:
    """Point d'entrée pour `uvicorn atelier.api.app:app --factory`."""
    return creer_application()
