# -*- coding: utf-8 -*-
"""Les routes. Aucune logique : chacune appelle un service et met en forme.

**Chemins en anglais, charges utiles en français** — un chemin de route est lu
par des outils, une charge utile est lue par l'interface, qui est française
(`AGENTS.md` § Règles durables).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from atelier.domaine import Demande, Generation, Modele
from atelier.domaine.catalogue import modele_en_json
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.image import rendre_en_png
from atelier.reglages import deposer_cle, etat_cle
from atelier.services import Atelier

routeur = APIRouter()

# Combien de temps le flux reste muet avant d'envoyer un signe de vie. Un
# atelier peut rester une heure sans rien produire ; sans ce battement, un
# mandataire ou un pare-feu couperait la liaison et l'onglet ne le saurait pas.
BATTEMENT_S = 15.0

# Un commentaire SSE : la liaison reste ouverte, l'onglet n'a rien à lire.
BATTEMENT = ": battement\n\n"


def _atelier(requete: Request) -> Atelier:
    return requete.app.state.atelier


# ── L'état d'ouverture ───────────────────────────────────────────────────────


@routeur.get("/health")
async def sante() -> dict[str, Any]:
    return {"atelier": "ouvert"}


@routeur.get("/status")
async def statut(requete: Request) -> dict[str, Any]:
    """Tout ce qu'il faut pour dessiner l'atelier à l'ouverture, en un appel."""
    return _atelier(requete).etat()


# ── Le flux d'événements ─────────────────────────────────────────────────────


@routeur.get("/events")
async def flux(requete: Request, limite: int = Query(50, ge=1, le=500)) -> Response:
    """Ce que l'atelier fait, au moment où il le fait. Aucun sondage.

    **Le premier message est l'état complet** — clé, catalogue, coûts, et les
    générations récentes avec leurs images. C'est lui qui tient le critère
    « l'onglet est fermé pendant une génération : à la réouverture, l'image est
    là » : rouvrir, c'est se réabonner, et l'état arrive avant tout le reste.

    Les suivants sont des faits acquis : un emplacement part, une image arrive,
    un appel échoue, le catalogue revient. Entre deux, un battement en
    commentaire SSE tient la liaison ouverte sans rien dire.
    """
    atelier = _atelier(requete)

    async def messages() -> AsyncIterator[str]:
        # On s'abonne **avant** de composer l'état : sinon un fait qui se produit
        # pendant la composition passerait entre les deux et serait perdu. Un
        # doublon est sans conséquence — chaque message porte l'objet entier.
        with atelier.diffusion.abonnement() as file:
            yield _sse(
                "etat",
                {
                    **atelier.etat(),
                    "generations": [
                        g.en_json() for g in atelier.generations.recentes(limite)
                    ],
                },
            )
            while True:
                try:
                    evenement = await asyncio.wait_for(file.get(), BATTEMENT_S)
                except asyncio.TimeoutError:
                    yield BATTEMENT
                    continue
                yield _sse(evenement.genre, evenement.charge)

    return StreamingResponse(
        messages(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            # L'atelier tourne en local, mais `npm run dev` relaie par Vite :
            # sans ça, le tampon du relais retiendrait les messages.
            "X-Accel-Buffering": "no",
        },
    )


def _sse(genre: str, charge: dict[str, Any]) -> str:
    """Un message SSE — un genre, une charge JSON, une ligne vide qui clôt."""
    donnees = json.dumps(charge, ensure_ascii=False)
    return "event: " + genre + "\n" + "data: " + donnees + "\n\n"


# ── La clé ───────────────────────────────────────────────────────────────────


class CorpsCle(BaseModel):
    cle: str = Field(min_length=8)


@routeur.get("/settings/key")
async def lire_etat_cle() -> dict[str, Any]:
    return etat_cle().en_json()


@routeur.put("/settings/key")
async def poser_cle(corps: CorpsCle) -> dict[str, Any]:
    """Se dépose une fois, et n'est plus jamais redemandée (US-4)."""
    try:
        return deposer_cle(corps.cle).en_json()
    except ValueError as erreur:
        raise ErreurAtelier(str(erreur), ou_aller="reglages") from None


# ── Le catalogue ─────────────────────────────────────────────────────────────


@routeur.get("/models")
async def modeles(
    requete: Request,
    references: int = Query(0, ge=0),
    proportions: str = Query("1:1"),
    resolution: str | None = Query(None),
) -> dict[str, Any]:
    """Le catalogue, **et la raison du grisé de chaque modèle**.

    Le calcul du refus vit dans le domaine et sort d'ici tout mâché : l'interface
    n'a pas à réimplémenter la règle « indisponible avec sa raison, jamais
    proposé puis refusé ». Elle affiche la phrase qu'elle reçoit.
    """
    atelier = _atelier(requete)
    etat = atelier.catalogue.etat
    demande = _demande_de_jauge(references, proportions, resolution)
    defaut = atelier.catalogue.defaut(demande)
    return {
        "recu_le": etat.recu_le,
        "repli": etat.repli,
        "raison": etat.raison,
        "defaut": {"modele": defaut.modele, "options": defaut.options},
        "modeles": [_modele_en_json(m, demande) for m in etat.modeles],
    }


@routeur.post("/models/refresh")
async def rafraichir_modeles(requete: Request) -> dict[str, Any]:
    """Redemander le catalogue — le geste qui sort du repli hors ligne.

    Ne lève pas quand le réseau est toujours coupé : elle rend le repli et sa
    date, et l'écran continue de le dire. Le retour du réseau, lui, part sur le
    flux d'événements : tous les onglets ouverts l'apprennent d'un coup.
    """
    catalogue = _atelier(requete).catalogue
    await catalogue.rafraichir()
    return catalogue.en_json()


class _Jauge:
    """Le strict nécessaire pour interroger `Modele.refus` sans écrire un prompt."""

    def __init__(self, references: int, proportions: str, resolution: str | None):
        self.references = tuple(b"" for _ in range(references))
        self.proportions = proportions
        self.resolution = resolution
        self.options: dict[str, Any] = {}


def _demande_de_jauge(references: int, proportions: str, resolution: str | None):
    return _Jauge(references, proportions, resolution)


def _modele_en_json(modele: Modele, demande) -> dict[str, Any]:
    fiche = modele_en_json(modele)
    fiche["refus"] = modele.refus(demande)
    return fiche


# ── Les générations ──────────────────────────────────────────────────────────


class CorpsGeneration(BaseModel):
    modele: str
    prompt: str = Field(min_length=1)
    prompt_negatif: str = ""
    proportions: str = "1:1"
    resolution: str | None = None
    variations: int = Field(1, ge=1, le=8)
    options: dict[str, Any] = Field(default_factory=dict)
    identifiant: str | None = None
    projet: str | None = None


@routeur.post("/generations", status_code=202)
async def generer(requete: Request, corps: CorpsGeneration) -> dict[str, Any]:
    """Soumet et rend l'identifiant tout de suite. Le travail continue côté serveur.

    Renvoyer le même identifiant deux fois ne facture qu'une fois : la seconde
    soumission rend la première telle quelle.
    """
    demande = Demande(
        prompt=corps.prompt,
        prompt_negatif=corps.prompt_negatif,
        proportions=corps.proportions,
        resolution=corps.resolution,
        variations=corps.variations,
        options=corps.options,
    )
    generation = await _atelier(requete).generations.soumettre(
        corps.modele,
        demande,
        identifiant=corps.identifiant,
        projet=corps.projet,
    )
    return generation.en_json()


@routeur.get("/generations")
async def liste_generations(
    requete: Request, limite: int = Query(50, ge=1, le=500)
) -> dict[str, Any]:
    generations = _atelier(requete).generations.recentes(limite)
    return {
        "generations": [g.en_json() for g in generations],
        "total_usd": _atelier(requete).generations.total_couts(),
    }


@routeur.get("/generations/{identifiant}")
async def lire_generation(requete: Request, identifiant: str) -> dict[str, Any]:
    return _trouver(requete, identifiant).en_json()


@routeur.post("/generations/{identifiant}/slots/{rang}/retry")
async def relancer(requete: Request, identifiant: str, rang: int) -> dict[str, Any]:
    """Un seul emplacement repart. Les voisines ne sont pas rejouées (US-22)."""
    generation = await _atelier(requete).generations.relancer(identifiant, rang)
    return generation.en_json()


@routeur.get("/generations/{identifiant}/slots/{rang}/image")
async def image_brute(requete: Request, identifiant: str, rang: int) -> Response:
    """L'image telle qu'elle est arrivée — pour l'affichage."""
    generation = _trouver(requete, identifiant)
    octets, type_media = _atelier(requete).generations.octets(generation, rang)
    return Response(content=octets, media_type=type_media)


@routeur.get("/generations/{identifiant}/slots/{rang}/download")
async def telecharger(requete: Request, identifiant: str, rang: int) -> Response:
    """« Une image se télécharge seule, en PNG » — critère d'acceptation de T1.

    Tous les modèles ne rendent pas du PNG : les Seedream ne rendent que du
    JPEG. La conversion est du ressort du produit. Le brut, lui, reste intact
    sur le disque — le PNG est un rendu, pas un remplacement.
    """
    generation = _trouver(requete, identifiant)
    octets, _ = _atelier(requete).generations.octets(generation, rang)
    png = rendre_en_png(octets)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{identifiant}-{rang}.png"'
        },
    )


def _trouver(requete: Request, identifiant: str) -> Generation:
    generation = _atelier(requete).generations.lire(identifiant)
    if generation is None:
        raise GenerationInconnue(identifiant)
    return generation
