# -*- coding: utf-8 -*-
"""Les dépliages d'une planche — les routes de P1b (V3.5).

**Quatre routes, et la coupure est celle du découpeur de T5** : proposer ne
crée rien et se redemande autant qu'on veut ; refaire crée des images et ne se
redemande jamais tout seul. Le premier dépliage, lui, reste automatique et n'a
pas de route : une planche qui revient bien ne demande aucun geste.

`{identifiant}` est la planche **ou n'importe quelle image qui en est sortie** :
c'est ce qui permet de remonter d'une image à sa planche et à ses dépliages
sans que l'écran ait à le savoir d'avance.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from atelier.services.depliages import depliages_de

routeur = APIRouter()


def _service(requete: Request):  # type: ignore[no-untyped-def]
    return depliages_de(requete.app.state.atelier)


class CorpsDepliage(BaseModel):
    """Les coupes que l'auteur a validées, dans son ordre — **avant marge**.

    `cases` est aligné aux coupes : l'indice de la case de la planche que
    chacune remplit, ou `null` pour une coupe ajoutée qui n'en remplit aucune.
    Absent, la n-ième coupe remplit la n-ième case.
    """

    boites: list[list[int]] = Field(default_factory=list)
    cases: list[int | None] | None = None


@routeur.get("/assets/{identifiant}/unfoldings")
async def lister_depliages(requete: Request, identifiant: str) -> dict[str, Any]:
    """Les dépliages d'une planche, chacun avec ses images, et ce qui en dépend."""
    return _service(requete).lister(identifiant)


@routeur.get("/assets/{identifiant}/unfoldings/proposal")
async def proposer_depliage(
    requete: Request,
    identifiant: str,
    depuis: int | None = Query(None, alias="from", ge=1),
) -> dict[str, Any]:
    """Les coupes d'un nouveau dépliage — celles du dernier, ou du n° `from`.
    Rien n'est créé, rien n'est écrit."""
    return _service(requete).proposer(identifiant, depuis)


@routeur.post("/assets/{identifiant}/unfoldings", status_code=201)
async def refaire_depliage(
    requete: Request, identifiant: str, corps: CorpsDepliage
) -> dict[str, Any]:
    """Un dépliage de plus, sur les coupes données. Les précédents ne bougent pas."""
    boites = [tuple(b) for b in corps.boites]
    return _service(requete).refaire(identifiant, boites, corps.cases)  # type: ignore[arg-type]


@routeur.delete("/assets/{identifiant}/unfoldings/{numero}")
async def supprimer_depliage(
    requete: Request, identifiant: str, numero: int
) -> dict[str, Any]:
    """Les images de ce dépliage quittent la bibliothèque — la planche et les
    autres dépliages restent, et ses rangs restent réservés. Annulable par
    `POST /assets/restore`, comme toute suppression."""
    return _service(requete).supprimer(identifiant, numero)


@routeur.post("/assets/{identifiant}/wrong-subject")
async def pas_le_bon_sujet(requete: Request, identifiant: str) -> dict[str, Any]:
    """« Ce n'est pas le bon sujet » (P2) : l'image — pas la planche — quitte la
    case de son sujet et reste en bibliothèque ; sa case passe « à vérifier »."""
    return _service(requete).pas_le_bon_sujet(identifiant)


@routeur.get("/assets/{identifiant}/cells/{case}/redo")
async def refaire_une_case(
    requete: Request,
    identifiant: str,
    case: int,
    modele: str | None = Query(None, alias="model"),
) -> dict[str, Any]:
    """Refaire **cette case seule**, en image simple (P2, décision 1) — préparé,
    jamais payé.

    Rend `demande`, le corps prêt pour `POST /generations` (le sujet de la case,
    son signalement, sa pose), et `envoi`, l'annonce de ce qui partirait et de
    son prix — **le même objet que `POST /outgoing`**, par le même service :
    l'écran montre le prix habituel, et c'est la barre qui paie qui appelle.
    `{identifiant}` est la planche ou une image qui en est sortie ; `case`
    compte à partir de zéro. Rien n'est écrit, aucun fournisseur n'est appelé.
    """
    service = _service(requete)
    rendu = service.demande_de_case(identifiant, case, modele)
    demande = rendu["demande"]
    envoi = requete.app.state.atelier.envoi.envoi(
        projet=demande["projet"],
        sujet=demande["prompt"],
        modele=demande["modele"],
        personnage=demande["personnage"],
        pose=demande["pose"],
        direction=demande["direction"],
    )
    return {**rendu, "envoi": envoi}


@routeur.get("/assets/{identifiant}/dependents")
async def dependants(requete: Request, identifiant: str) -> dict[str, Any]:
    """Combien d'images vivantes dépendent de cette planche — le chiffre que la
    confirmation de suppression affiche."""
    service = _service(requete)
    return {
        "planche": identifiant,
        "est_une_planche": service.est_une_planche(identifiant),
        **service.dependants(identifiant),
    }
