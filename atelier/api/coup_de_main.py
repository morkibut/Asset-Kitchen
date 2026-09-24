# -*- coding: utf-8 -*-
"""Le coup de main, côté écran — deux routes, et **aucune pour l'agent** (CM1).

⚠️ **Elles attendent CM3.** Aucun écran ne les appelle encore (règle 8nonies
d'`AGENTS.md`) : la table des métiers est vide (`atelier/domaine/coup_de_main.py`,
`CONSIGNES`), donc `POST` répond 404 à tout métier tant que CM3 n'a pas écrit la
première consigne et posé la marque qui la déclenche.

- `GET /api/assist` — la marque paraît-elle ? `disponible`, et sinon pourquoi.
- `POST /api/assist/{metier}` — le texte part avec **la consigne du métier**,
  jamais une consigne venue de l'écran : l'atelier n'ouvre aucune discussion
  libre avec un modèle payé (décision 1). La réponse arrive en flux, une ligne
  JSON par morceau (`application/x-ndjson`) — `texte`, puis `fin` ; ou un seul
  `indisponible`. **Jamais un code d'erreur pour ce qui vient du fournisseur** :
  l'issue est dans le morceau de fin, et l'écran se tait (décision 6).

**Aucune de ces routes n'est un outil MCP, ni n'entre dans le cadre de l'agent**
(décision 9, RP2) : elles ne sont montées que sous `/api`, et un essai le
vérifie sur la liste des outils du serveur MCP.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from atelier.domaine.coup_de_main import CONSIGNES

routeur = APIRouter()


@routeur.get("/assist")
async def etat_du_coup_de_main(requete: Request) -> dict[str, Any]:
    """Ce que la marque doit savoir pour paraître, ou se taire (décision 6)."""
    return requete.app.state.atelier.coup_de_main.etat()


@routeur.post("/assist/{metier}")
async def demander(requete: Request, metier: str) -> Any:
    consigne = CONSIGNES.get(metier)
    if consigne is None:
        return JSONResponse(
            status_code=404,
            content={"code": "metier_inconnu", "raison": f"aucun métier « {metier} »"},
        )
    try:
        brut = await requete.json()
    except ValueError:
        brut = None
    texte = brut.get("texte") if isinstance(brut, dict) else None
    if not isinstance(texte, str) or not texte.strip():
        return JSONResponse(
            status_code=422,
            content={"code": "texte_absent", "raison": "il n'y a rien à envoyer"},
        )
    service = requete.app.state.atelier.coup_de_main

    async def lignes() -> AsyncIterator[str]:
        async for morceau in service.repondre(consigne, texte, metier=metier):
            yield json.dumps(morceau.en_json(), ensure_ascii=False) + "\n"

    return StreamingResponse(
        lignes(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
