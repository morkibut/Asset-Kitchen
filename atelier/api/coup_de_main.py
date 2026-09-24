# -*- coding: utf-8 -*-
"""Le coup de main, côté écran — trois routes, et **aucune pour l'agent** (CM1, CM3, CM4).

- `GET /api/assist` — la marque paraît-elle ? `disponible`, et sinon pourquoi.
- `POST /api/assist/{metier}/preview` — **ce qui partirait, mot pour mot, sans
  rien envoyer** : la consigne, la fiche, le contexte, le texte (« Voir ce qui
  part », décision 7). Gratuit.
- `POST /api/assist/{metier}` — le même envoi part. La réponse arrive en flux,
  une ligne JSON par morceau (`application/x-ndjson`) — `texte`, puis `fin` ; ou
  un seul `indisponible`. **Jamais un code d'erreur pour ce qui vient du
  fournisseur** : l'issue est dans le morceau de fin, et l'écran se tait
  (décision 6).

Le corps varie **selon le métier**, jamais selon l'écran qui l'envoie :

- `ameliorer` (CM3) : `{"texte", "projet"?, "champ"}` — le champ vient de
  `CHAMPS`, obligatoire ;
- `question` (CM4) : `{"texte", "ecran", "champ"?, "valeur"?, "blocage"?}` —
  l'écran vient d'`ECRANS`, obligatoire ; le reste dit ce qu'on regardait au
  moment de la question, et peut manquer (une question peut porter sur
  l'écran seul).

**La consigne vient du dépôt** (`CONSIGNES`), jamais de l'écran : l'atelier
n'ouvre aucune discussion libre avec un modèle payé (décision 1). **Le
contexte aussi** : l'écran ne nomme qu'une clé (`champ` ou `ecran`), et c'est
le dépôt qui dit ce qu'elle veut dire — `composer` pour « améliorer »,
`contexte_instant` pour « question » (`atelier/services/contexte_coup_de_main
.py`), la même fonction que réutilisera CM5. Le projet ne sert qu'à trouver
les noms du jeu que le texte contient (`noms_presents`), et seulement pour
« améliorer ». Les deux formes composent par **la même fonction** `composer`
— ce que l'écran montre dans « Voir ce qui part » est ce qui part, puisque
l'un est fait de l'autre.

Depuis CM3, un écran appelle « améliorer » : le tiroir des matières des jeux
de tuiles (`interface/src/composants/CoupDeMain.tsx`), sur ses deux champs.
Depuis CM4, le même écran appelle aussi « question », par
`interface/src/composants/DemanderIci.tsx`.

**Aucune de ces routes n'est un outil MCP, ni n'entre dans le cadre de l'agent**
(décision 9, RP2) : elles ne sont montées que sous `/api`, et un essai le
vérifie sur la liste des outils du serveur MCP.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from atelier.domaine.coup_de_main import (
    AMELIORER,
    CHAMPS,
    CONSIGNES,
    ECRANS,
    QUESTION,
    SIGNES_MAX,
    Envoi,
    composer,
    noms_presents,
)
from atelier.services.contexte_coup_de_main import (
    contexte_instant,
    fiche_du_produit,
    noms_du_jeu,
)

routeur = APIRouter()

#: Les métiers qui ne partent jamais sans nommer leur champ : sans lui, le
#: modèle ne saurait pas ce que le champ attend, ni que l'autre champ existe.
AVEC_CHAMP = {AMELIORER}

#: Les métiers qui ne partent jamais sans nommer leur écran (CM4) : sans lui,
#: « l'écran nomme, le serveur dit » n'a rien à dire.
AVEC_ECRAN = {QUESTION}


def _refus(statut: int, code: str, raison: str) -> JSONResponse:
    return JSONResponse(status_code=statut, content={"code": code, "raison": raison})


def _texte(corps: dict, cle: str) -> str | None:
    """Un champ de texte facultatif du corps — `None` s'il manque ou n'en est pas un."""
    v = corps.get(cle)
    return v if isinstance(v, str) and v.strip() else None


async def _envoi(requete: Request, metier: str) -> Envoi | JSONResponse:
    """L'envoi du métier, ou le refus qui dit pourquoi rien ne partira."""
    consigne = CONSIGNES.get(metier)
    if consigne is None:
        return _refus(404, "metier_inconnu", f"aucun métier « {metier} »")
    try:
        brut = await requete.json()
    except ValueError:
        brut = None
    corps = brut if isinstance(brut, dict) else {}
    texte = corps.get("texte")
    if not isinstance(texte, str) or not texte.strip():
        return _refus(422, "texte_absent", "il n'y a rien à envoyer")
    if len(texte) > SIGNES_MAX:
        return _refus(422, "texte_trop_long", f"le texte dépasse {SIGNES_MAX} signes")

    if metier in AVEC_ECRAN:
        # CM4 : l'écran remplace le champ comme façon de dire « où ça se passe ».
        ecran = corps.get("ecran")
        if ecran is None:
            return _refus(422, "ecran_absent", "ce métier part avec l'écran où l'on est")
        if ecran not in ECRANS:
            return _refus(422, "ecran_inconnu", f"aucun écran « {ecran} »")
        contexte = contexte_instant(
            ecran,
            champ=_texte(corps, "champ"),
            valeur=_texte(corps, "valeur"),
            blocage=_texte(corps, "blocage"),
        )
        return composer(consigne, fiche_du_produit(), texte, contexte=contexte)

    champ = corps.get("champ")
    if champ is not None and champ not in CHAMPS:
        return _refus(422, "champ_inconnu", f"aucun champ « {champ} »")
    if champ is None and metier in AVEC_CHAMP:
        return _refus(422, "champ_absent", "ce métier part avec le champ qu'il remplit")
    projet = corps.get("projet")
    noms: list[str] = []
    if isinstance(projet, str) and projet:
        # `ProjetInconnu` → 404, par le gestionnaire commun de l'application.
        noms = noms_presents(texte, noms_du_jeu(requete.app.state.atelier, projet))
    return composer(consigne, fiche_du_produit(), texte, champ=champ, noms=noms)


@routeur.get("/assist")
async def etat_du_coup_de_main(requete: Request) -> dict[str, Any]:
    """Ce que la marque doit savoir pour paraître, ou se taire (décision 6)."""
    return requete.app.state.atelier.coup_de_main.etat()


@routeur.post("/assist/{metier}/preview")
async def ce_qui_part(requete: Request, metier: str) -> Any:
    """« Voir ce qui part » : l'envoi composé, **et rien n'est envoyé**."""
    envoi = await _envoi(requete, metier)
    if isinstance(envoi, JSONResponse):
        return envoi
    return envoi.en_json()


@routeur.post("/assist/{metier}")
async def demander(requete: Request, metier: str) -> Any:
    envoi = await _envoi(requete, metier)
    if isinstance(envoi, JSONResponse):
        return envoi
    service = requete.app.state.atelier.coup_de_main

    async def lignes() -> AsyncIterator[str]:
        async for morceau in service.repondre(envoi.systeme, envoi.message, metier=metier):
            yield json.dumps(morceau.en_json(), ensure_ascii=False) + "\n"

    return StreamingResponse(
        lignes(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
