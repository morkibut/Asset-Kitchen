# -*- coding: utf-8 -*-
"""L'application FastAPI — une façade sur `services/`, et rien d'autre.

Le démarrage fait deux choses et ne lève jamais : il relit le catalogue et
marque ce que l'arrêt précédent a coupé. **L'atelier s'ouvre sans réseau et
sans clé** — l'échec attend le moment où on génère (US-95).
"""

from __future__ import annotations

import contextlib
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from atelier.api.animation import routeur as routeur_animation
from atelier.api.bibliotheque import routeur as routeur_bibliotheque
from atelier.api.enregistrer_sous import routeur as routeur_enregistrer_sous
from atelier.api.gestes import routeur as routeur_gestes
from atelier.api.production import routeur as routeur_production
from atelier.api.sortie import routeur as routeur_sortie
from atelier.api.livraison import routeur as routeur_livraison
from atelier.api.livraison_images import routeur as routeur_livraison_images
from atelier.api.tuiles import routeur as routeur_tuiles
from atelier.api.sons import routeur as routeur_sons
from atelier.api.sfxr import routeur as routeur_sfxr
from atelier.domaine.tuiles import TuilesRefusees
from atelier.api.travaux import routeur as routeur_travaux
from atelier.api.file_locale import routeur as routeur_file_locale
from atelier.api.workflows import routeur as routeur_workflows
from atelier.api.texte_son import routeur as routeur_texte_son
from atelier.api.variantes_son import routeur as routeur_variantes_son
from atelier.domaine.variantes_son import VariantesRefusees
from atelier.api.sons_du_sujet import routeur as routeur_sons_du_sujet
from atelier.domaine.sons_du_sujet import SonsDuSujetRefuses
from atelier.domaine.workflow import WorkflowRefuse
from atelier.services.file_locale import FileLocaleRefusee
from atelier.api.calques_cibles import routeur as routeur_calques_cibles
from atelier.api.travaux_equipement import routeur as routeur_travaux_equipement
from atelier.api.tenues import routeur as routeur_tenues
from atelier.api.sources_3d import routeur as routeur_sources_3d
from atelier.fournisseur.asset3d import Source3DRefusee
from atelier.api.routes import routeur
from atelier.api.univers import routeur as routeur_univers
from mcp.server.transport_security import TransportSecuritySettings

from atelier.mcp.serveur import creer_serveur
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
from atelier.services.bibliotheque import (
    AnnulationExpiree,
    CollectionInconnue,
    ProjetInconnu,
    RangementRefuse,
)
from atelier.services.agent import DepotRefuse, PlafondAtteint
from atelier.services.decoupe import DecoupeRefusee
from atelier.services.planche_animee import PlancheAnimeeRefusee
from atelier.services.equipement import EmploiInconnu
from atelier.services.miroir import MiroirRefuse
from atelier.services.enregistrer_sous import EnregistrementRefuse
from atelier.services.ambiances import AmbianceRefusee
from atelier.services.calibrage import CalibrageRefuse
from atelier.services.envoi import EnvoiRefuse
from atelier.services.planche import PlancheRefusee
from atelier.services.etiquettes import EtiquetteRefusee
from atelier.services.mouvements import MouvementRefuse
from atelier.services.styles import StyleRefuse
from atelier.services.superposition import SuperpositionRefusee
from atelier.services.production import (
    PersonnageInconnu,
    PoseInconnue,
    ProductionRefusee,
)
from atelier.services.export import ExportRefuse
from atelier.services.sortie import SortieRefusee
from atelier.services.livraison import LivraisonRefusee
from atelier.domaine.travail import TravailRefuse
from atelier.services.univers import (
    CarteInconnue,
    CarteRefusee,
    LienInconnu,
    LienRefuse,
    UniversRefuse,
)
from atelier.fournisseur.toile import AdresseRefusee
from atelier.services.generation import ImportRefuse

# Le code HTTP de chaque refus du produit. La raison, elle, est toujours la
# même phrase en français — c'est elle que l'interface affiche.
CODES = {
    WorkflowRefuse: 409,
    TuilesRefusees: 409,
    SansCle: 409,
    DemandeRefusee: 409,
    ModeleInconnu: 404,
    GenerationInconnue: 404,
    FournisseurIndisponible: 503,
    AppelRefuse: 502,
    AssetInconnu: 404,
    RecetteRefusee: 409,
    ProjetInconnu: 404,
    CollectionInconnue: 404,
    RangementRefuse: 409,
    AnnulationExpiree: 409,
    CarteInconnue: 404,
    CarteRefusee: 409,
    ImportRefuse: 409,
    LienInconnu: 404,
    LienRefuse: 409,
    UniversRefuse: 409,
    DecoupeRefusee: 409,
    PlancheAnimeeRefusee: 409,
    # Il n'y a pas de case où ranger le miroir. 409 et non 400 : la demande est
    # bien formée, c'est l'état de l'image qui s'y oppose.
    MiroirRefuse: 409,
    # **Le même code, et la même raison** (`RP20`) : sans retouche appliquée, ou
    # sans case où ranger le résultat, la demande est bien formée et c'est
    # l'état de l'image qui s'y oppose.
    EnregistrementRefuse: 409,
    EtiquetteRefusee: 409,
    MouvementRefuse: 409,
    StyleRefuse: 409,
    AmbianceRefusee: 409,
    CalibrageRefuse: 409,
    PlancheRefusee: 409,
    EnvoiRefuse: 409,
    SuperpositionRefusee: 409,
    ExportRefuse: 409,
    # Même code que l'export, et pour la même raison (B21) : « il n'y a rien à
    # sortir » et « ce dossier existe déjà » sont des refus du produit, pas des
    # fautes d'appel — l'écran les affiche tels quels, en français.
    SortieRefusee: 409,
    LivraisonRefusee: 409,
    TravailRefuse: 409,
    VariantesRefusees: 409,
    SonsDuSujetRefuses: 409,
    Source3DRefusee: 409,
    FileLocaleRefusee: 409,
    PersonnageInconnu: 404,
    PoseInconnue: 404,
    ProductionRefusee: 409,
    # **Le même code que son parent, et il est là pour son nom** (B19) : la table
    # se lit sur le type exact, si bien qu'un refus non inscrit retombe sur 400
    # au lieu du 409 de `ProductionRefusee`. Inscrit ici, l'écran reçoit
    # `emploi_inconnu` avec le statut que tous les autres refus du vestiaire
    # portent déjà.
    EmploiInconnu: 409,
    # Le plafond de la séance de l'agent. 429 et non 409 : c'est bien « trop
    # d'appels », et le refus porte le moyen de le relever.
    PlafondAtteint: 429,
    DepotRefuse: 409,
    # L'adresse d'une carte n'a pas répondu, ou n'a pas rendu une image. 502 et
    # non 400 : le refus vient d'en face, pas de ce qu'on a demandé.
    AdresseRefusee: 502,
}

INTERFACE = RACINE / "interface" / "dist"


def creer_application(atelier: Atelier | None = None) -> FastAPI:
    # **Le serveur MCP vit dans ce processus-ci**, sur l'atelier de cette
    # application-ci (`docs/ARCHITECTURE.md` §3). Un second processus aurait son
    # propre atelier : deux écrivains sur le même disque, deux diffusions, et
    # « ce que l'agent produit apparaît en direct dans la grille » (US-89)
    # tomberait — l'onglet n'écoute que la diffusion d'ici.
    atelier = atelier or Atelier()
    serveur_mcp = creer_serveur(atelier)
    # **Le chemin est porté par le montage, pas deux fois.** Le SDK pose sa
    # route sur « /mcp » à l'intérieur de son application ; montée elle-même
    # sous « /mcp », l'adresse réelle devenait `/mcp/mcp` et le vrai chemin
    # répondait 405 — une réponse assez proche du succès pour qu'un essai qui
    # vérifie seulement « ni 404 ni page d'accueil » la laisse passer.
    #
    # **Et l'en-tête `Host` est vérifié par le transport.** C'est une protection
    # contre le réattachement DNS, et elle est justifiée : ce serveur écoute en
    # local et un site visité pourrait sinon lui parler. Le défaut du SDK
    # n'autorise qu'`127.0.0.1` ; or le lanceur ouvre `localhost` aussi souvent,
    # et un `Host` refusé rend un 421 que rien n'explique côté agent. Les deux
    # noms de la boucle locale sont donc nommés ici, avec leurs ports — et rien
    # d'autre : ouvrir la liste ferait sauter la protection entière.
    application_mcp = serveur_mcp.streamable_http_app(
        streamable_http_path="/",
        transport_security=TransportSecuritySettings(
            allowed_hosts=["127.0.0.1", "127.0.0.1:*", "localhost", "localhost:*"],
            allowed_origins=[
                "http://127.0.0.1",
                "http://127.0.0.1:*",
                "http://localhost",
                "http://localhost:*",
            ],
        ),
    )

    @contextlib.asynccontextmanager
    async def cycle(application: FastAPI) -> AsyncIterator[None]:
        await application.state.atelier.ouvrir()
        # Le gestionnaire de sessions du MCP a son propre cycle de vie, et
        # **FastAPI ne le lance pas pour une application montée** : sans cette
        # ligne, l'agent reçoit une erreur de transport à la première connexion,
        # et rien dans les journaux ne dit pourquoi.
        async with application_mcp.router.lifespan_context(application_mcp):
            try:
                yield
            finally:
                await application.state.atelier.file_locale.fermer()

    application = FastAPI(
        title="Asset Kitchen",
        version="0.1.0",
        lifespan=cycle,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    application.state.atelier = atelier
    # **Le serveur MCP est posé sur l'application, et B6 s'en sert.**
    # `GET /api/actions` sert la liste des outils de l'agent : la barre et lui
    # lisent la même, au même endroit. La poser ici plutôt que de la
    # reconstruire dans la route est ce qui rend la promesse vraie — il n'y a
    # pas de seconde liste à tenir à jour.
    application.state.mcp = serveur_mcp
    application.include_router(routeur, prefix="/api")
    # Deux routeurs, un seul préfixe : de l'extérieur l'API n'a pas de couture.
    # La bibliothèque répond à une autre question que la fabrication d'une
    # image, et ses routes vivent donc dans leur propre module.
    application.include_router(routeur_bibliotheque, prefix="/api")
    # Le troisième, arrivé avec T4 : ce qui contraint une image avant qu'elle
    # existe — le tableau d'inspiration et l'univers du projet.
    application.include_router(routeur_univers, prefix="/api")
    # Le quatrième, arrivé avec C1 : ce qu'il reste à fabriquer — le plan de
    # poses du projet, ses personnages, et la matrice qui dit ce qui manque.
    application.include_router(routeur_production, prefix="/api")
    # Le cinquième, arrivé avec A9 : le clip. Il répond à une question que
    # personne ne posait avant la V3 — *ce qui bouge* —, et son appel n'a ni la
    # forme ni la durée d'un appel d'image.
    application.include_router(routeur_animation, prefix="/api")
    # Le sixième, arrivé avec B6 : ce que le serveur sait faire, servi à la
    # barre. Il ne fait rien lui-même — il relit l'agent.
    application.include_router(routeur_gestes, prefix="/api")
    # Le septième, arrivé avec B21 : la sortie. Il répond à une question que
    # les quatre exports d'avant ne posaient pas — *qu'est-ce qui va être
    # écrit, et qu'est-ce qui a changé depuis la dernière fois ?*
    application.include_router(routeur_sortie, prefix="/api")
    application.include_router(routeur_livraison, prefix="/api")
    application.include_router(routeur_livraison_images, prefix="/api")
    application.include_router(routeur_tuiles, prefix="/api")
    # Le routeur sfxr est plus spécifique (`/sounds/sfxr`) et s'enregistre
    # avant celui des sons (`/sounds/{identifiant}`) pour ne jamais dépendre
    # de l'ordre où Starlette tenterait les deux sur un même chemin.
    application.include_router(routeur_sfxr, prefix="/api")
    application.include_router(routeur_sons, prefix="/api")
    application.include_router(routeur_travaux, prefix="/api")
    application.include_router(routeur_file_locale, prefix="/api")
    application.include_router(routeur_workflows, prefix="/api")
    application.include_router(routeur_texte_son, prefix="/api")
    application.include_router(routeur_variantes_son, prefix="/api")
    application.include_router(routeur_sons_du_sujet, prefix="/api")
    application.include_router(routeur_calques_cibles, prefix="/api")
    application.include_router(routeur_travaux_equipement, prefix="/api")
    application.include_router(routeur_tenues, prefix="/api")
    application.include_router(routeur_sources_3d, prefix="/api")
    # **Enregistrer sous** (`RP20`) : un rendu devient une autre pose ou une
    # autre direction. Son propre module parce qu'il vaut pour les deux calques
    # — les images et les animations — et qu'il n'appartient donc ni à la
    # bibliothèque ni à l'animation.
    application.include_router(routeur_enregistrer_sous, prefix="/api")

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

    # **Avant l'interface, et c'est un piège connu** : `StaticFiles` est monté
    # sur « / » et attrape tout ce qui vient après lui. Monté en dernier, `/mcp`
    # rendrait la page d'accueil de l'atelier à un agent qui parle MCP.
    application.mount("/mcp", application_mcp, name="mcp")
    application.add_middleware(BarreFinaleMCP)
    _monter_interface(application)
    return application


class BarreFinaleMCP:
    """« /mcp » et « /mcp/ » mènent au même endroit — et c'est nécessaire.

    Un montage Starlette ne reconnaît que `/mcp/…` : le chemin **exact** `/mcp`
    ne lui correspond pas, il traverse toute la table de routage et finit chez
    les fichiers statiques montés sur « / », qui répondent **405** à un `POST`.
    Une réponse assez proche du succès pour tromper qui ne regarde que le code,
    et c'est précisément l'adresse qu'on écrit dans la configuration d'un agent.

    Le chemin est donc corrigé **avant** le routage, jamais par une redirection :
    un `POST` redirigé n'est pas resoumis par tous les clients, et un flux
    d'événements redirigé se rouvre au mauvais endroit.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Any, recevoir: Any, envoyer: Any) -> None:
        if scope["type"] == "http" and scope.get("path") == "/mcp":
            scope = {**scope, "path": "/mcp/", "raw_path": b"/mcp/"}
        await self.app(scope, recevoir, envoyer)


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
