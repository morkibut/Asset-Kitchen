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

from atelier.domaine import Asset, Demande, Generation, Modele, Recette
from atelier.domaine.catalogue import modele_en_json
from atelier.domaine.erreurs import ErreurAtelier, GenerationInconnue
from atelier.image import rendre_en_png
from atelier.reglages import deposer_cle, etat_cle
from atelier.services import Atelier
from atelier.services.assets import AssetInconnu

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
                    # Les assets voyagent avec l'état complet, pour la même
                    # raison que les générations : un onglet qui se rouvre
                    # retrouve ses retouches sans redemander quoi que ce soit.
                    "assets": [
                        a.en_json() for a in atelier.assets.recents(limite * 4)
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


# ── Les assets et leur recette ───────────────────────────────────────────────
#
# **Aucun de ces appels ne touche le réseau ni ne coûte un centime.** C'est
# l'invariant de T2, et c'est aussi ce qui rend la retouche instantanée : tout se
# passe sur le disque et le processeur de la machine.


class CorpsPasse(BaseModel):
    moteur: str = "bord"
    tolerance: int = Field(28, ge=0, le=255)
    seuil_alpha: int = Field(128, ge=0, le=255)
    durcissement: int = Field(0, ge=0, le=4)


class CorpsRecadrage(BaseModel):
    marge: int = Field(0, ge=0)
    boite: list[int] | None = None


class CorpsGrille(BaseModel):
    cible: int = Field(64, ge=8, le=512)
    occupation: int = Field(100, ge=1, le=100)
    ancrage: str = "bas"


class CorpsQuantification(BaseModel):
    couleurs: int = Field(32, ge=2, le=256)
    palette: list[str] = Field(default_factory=list)
    tramage: str = "aucun"


class CorpsBords(BaseModel):
    aire_min: int = Field(0, ge=0)


class CorpsRecette(BaseModel):
    """La recette telle qu'elle arrive de l'écran.

    Les bornes sont déclarées deux fois — ici en `Field`, et dans le service.
    Ce n'est pas une redite : celles-ci rendent un 422 lisible dans `/api/docs`
    et arrêtent une valeur absurde avant qu'elle n'entre, celles du service
    valent pour **toute** provenance — une recette relue d'un fichier, une
    recette nommée devenue caduque, un agent en T7 qui n'a jamais vu cet écran.
    """

    passes: list[CorpsPasse] = Field(default_factory=list)
    recadrage: CorpsRecadrage | None = None
    grille: CorpsGrille | None = None
    quantification: CorpsQuantification | None = None
    bords: CorpsBords | None = None
    nom: str | None = None

    def en_recette(self) -> Recette:
        return Recette.depuis_json(self.model_dump())


@routeur.get("/assets")
async def liste_assets(
    requete: Request, limite: int = Query(200, ge=1, le=1000)
) -> dict[str, Any]:
    assets = _atelier(requete).assets.recents(limite)
    return {"assets": [a.en_json() for a in assets]}


@routeur.get("/assets/{identifiant}")
async def lire_asset(requete: Request, identifiant: str) -> dict[str, Any]:
    return _asset(requete, identifiant).en_json()


@routeur.put("/assets/{identifiant}/recipe")
async def poser_recette(
    requete: Request, identifiant: str, corps: CorpsRecette
) -> dict[str, Any]:
    """Le geste de la tranche. Le rendu est recalculé avant de répondre.

    Répondre après le calcul et non avant : l'écran affiche l'image dès qu'il a
    la réponse, sans un second aller-retour pour savoir si c'est prêt. Le calcul
    se compte en dizaines de millisecondes — le détourage déjà fait est gardé,
    seule la queue de la recette est refaite.
    """
    asset = _atelier(requete).assets.poser_recette(identifiant, corps.en_recette())
    return asset.en_json()


@routeur.post("/assets/{identifiant}/reset")
async def revenir_au_brut(requete: Request, identifiant: str) -> dict[str, Any]:
    """Revenir à l'image brute, d'un seul geste (US-64)."""
    return _atelier(requete).assets.revenir_au_brut(identifiant).en_json()


@routeur.post("/assets/{identifiant}/apply/{nom}")
async def appliquer_recette_nommee(
    requete: Request, identifiant: str, nom: str
) -> dict[str, Any]:
    """La même recette, sur un autre asset, au pixel près (US-66)."""
    return _atelier(requete).assets.appliquer_nommee(identifiant, nom).en_json()


@routeur.get("/assets/{identifiant}/image")
async def image_asset(
    requete: Request, identifiant: str, brut: bool = Query(False)
) -> Response:
    """Le rendu, ou le brut si on le demande — c'est la bascule de la fiche.

    Un rendu dont le fichier a disparu du disque **se recalcule ici**, sans que
    l'appelant ait à le savoir : « supprimer le fichier de rendu ne perd rien »
    (`docs/PLAN.md`, T2).
    """
    atelier = _atelier(requete)
    octets, type_media = atelier.assets.octets(_asset(requete, identifiant), brut=brut)
    return Response(
        content=octets,
        media_type=type_media,
        # Le rendu change sous la même adresse à chaque cran de curseur : le
        # mettre en cache ferait regarder l'image d'avant.
        headers={"Cache-Control": "no-store"},
    )


@routeur.get("/assets/{identifiant}/download")
async def telecharger_asset(
    requete: Request, identifiant: str, brut: bool = Query(False)
) -> Response:
    """« Une image se télécharge seule, en PNG » — et c'est le rendu qui part."""
    atelier = _atelier(requete)
    asset = _asset(requete, identifiant)
    octets, _ = atelier.assets.octets(asset, brut=brut)
    png = rendre_en_png(octets)
    suffixe = "-brut" if brut else ""
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{identifiant}{suffixe}.png"'
        },
    )


# ── Les recettes nommées ─────────────────────────────────────────────────────


@routeur.get("/recipes")
async def liste_recettes(requete: Request) -> dict[str, Any]:
    recettes = _atelier(requete).assets.recettes()
    return {"recettes": {nom: r.en_json() for nom, r in recettes.items()}}


@routeur.put("/recipes/{nom}")
async def nommer_recette(
    requete: Request, nom: str, corps: CorpsRecette
) -> dict[str, Any]:
    recettes = _atelier(requete).assets.nommer(nom, corps.en_recette())
    return {"recettes": {n: r.en_json() for n, r in recettes.items()}}


@routeur.delete("/recipes/{nom}")
async def oublier_recette(requete: Request, nom: str) -> dict[str, Any]:
    recettes = _atelier(requete).assets.oublier_recette(nom)
    return {"recettes": {n: r.en_json() for n, r in recettes.items()}}


def _asset(requete: Request, identifiant: str) -> Asset:
    asset = _atelier(requete).assets.lire(identifiant)
    if asset is None:
        raise AssetInconnu(identifiant)
    return asset
