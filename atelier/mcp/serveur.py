# -*- coding: utf-8 -*-
"""Les outils que l'agent appelle — **une façade, et rien d'autre**.

`docs/ARCHITECTURE.md` §4, règle 2 : *le MCP n'a pas de logique propre*. Chaque
fonction de ce fichier fait trois choses et pas une quatrième — elle traduit ce
que l'agent a dit, elle appelle le service que l'écran appelle, elle traduit ce
qui revient. Le jour où l'une d'elles calcule quelque chose, c'est que le geste
manquait aux services et qu'il faut l'y écrire : sinon l'agent et l'écran
divergent, et le produit a deux vérités.

**Grain épais.** L'agent qui appelle est en train de coder le jeu : son attention
est ailleurs. Il dit ce qu'il veut, pas comment l'obtenir — d'où une dizaine
d'outils complets plutôt que quarante-trois outils fins. Ce sont les réglages du
projet qui rendent ça possible : modèle, palette, taille de pixel et détourage
sont déjà portés par l'univers, et `preparer()` les applique sans qu'on les
répète (US-79).

**Les noms d'outils et leurs descriptions sont en anglais** (`AGENTS.md`
§ Règles durables). Ils sont lus par des modèles entraînés en anglais, et
`generer_asset` dégraderait le déclenchement. Tout le reste — le code, les
commentaires, et **les raisons de refus** — reste en français : une raison finit
sous les yeux de l'auteur, par l'agent qui la lui répète.

**Même processus que l'API.** Le serveur se monte sur l'application FastAPI et
partage l'unique `Atelier` : c'est ce qui fait que ce que l'agent produit
apparaît en direct dans la grille (US-89), sans second écrivain sur la base ni
seconde diffusion.
"""

from __future__ import annotations


from pathlib import Path
from typing import Any

import functools
from typing import Awaitable, Callable, TypeVar

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from atelier.domaine.asset import Asset
from atelier.domaine.bande import BOUCLE, CADENCE_PAR_DEFAUT as CADENCE_DE_BANDE
from atelier.domaine.consommation import ICI, Reserve
from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import AGENT, Generation
from atelier.domaine.personnage import Personnage
from atelier.domaine.recette import PLACES, Recette, places_inconnues
from atelier.services import Atelier
from atelier.services.bibliotheque import ProjetInconnu

# Ce que l'agent attend avant qu'on lui rende un identifiant, s'il ne le dit
# pas. Trente secondes : au-dessus de la durée médiane d'un appel du catalogue,
# donc « la plupart du temps » il reçoit son image (US-80).
ATTENTE_PAR_DEFAUT = 30.0
ATTENTE_MAX = 300.0

_T = TypeVar("_T")


def _barre(
    *,
    verbe: str,
    titre: str,
    phrase: str,
    paiement: str = "gratuit",
    ou: str = "",
    route: str = "",
    besoins: tuple[str, ...] = (),
) -> dict[str, Any]:
    """La fiche que **la barre** lit sur un outil — et rien d'autre (B6).

    `docs/archive/pistes-2026-09-04/carnet/Barre.dc.html` : *« Elle affiche les actions
    que le serveur sait faire — les mêmes que celles de l'agent. »* Pour que ce
    soit vrai à la lettre, la liste de la barre **est** la liste des outils, et
    ce que la barre a besoin de savoir en plus voyage avec l'outil, dans son
    `meta` MCP. Une seconde table, rangée ailleurs et à tenir à jour à la main,
    aurait divergé au premier outil ajouté — et c'est exactement la panne que la
    tranche existe pour empêcher.

    Un outil **sans** fiche paraît quand même, avec son titre anglais et le
    défaut prudent d'`atelier/api/gestes.py` : *à confirmer*, donc injouable
    depuis la barre. C'est la règle « elle ne paie jamais » tenue par
    construction plutôt que par vigilance — l'oubli d'une fiche coûte une
    étiquette laide, jamais un centime.

    Les champs, et ce qu'ils commandent :

    - `verbe` : l'un des six de `VERBES`, et le regroupement dans la barre.
    - `paiement` : `gratuit`, ou `a-confirmer` — qui force `ou="envoi"` et
      interdit toute route, dans `atelier/api/gestes.py`.
    - `ou` : où le clic mène — un lieu du carnet, ou `ici` quand le geste se
      fait sur place.
    - `route` : ce que la barre appelle pour un geste `ici`, et **elle seule**.
    - `besoins` : ce qu'il faut pour que le geste ait un sens. Ce qui n'est pas
      satisfait ne s'affiche pas du tout — ni grisé, ni proposé.
    """

    return {
        "barre": {
            "verbe": verbe,
            "titre": titre,
            "phrase": phrase,
            "paiement": paiement,
            "ou": ou,
            "route": route,
            "besoins": list(besoins),
        }
    }


def _refus_lisible(
    outil: Callable[..., Awaitable[_T]],
) -> Callable[..., Awaitable[_T]]:
    """Un refus du produit atteint l'agent **avec sa phrase**.

    Le SDK range toute exception qu'il ne connaît pas en « crash » et **retient
    son texte côté serveur** — délibérément, pour qu'une trace interne ne parte
    pas chez le client. Sans cette traduction, « plafond de la séance atteint —
    12 sur 20, relève-le dans l'écran Réglages » deviendrait « Error executing
    tool generate_asset », et l'agent n'aurait rien à répéter à l'auteur : US-85
    et US-86 demandent l'exact contraire.

    C'est le pendant exact de `CODES` dans `api/app.py`, qui donne son code HTTP
    à chaque refus. Même règle, deux protocoles : *un refus du produit est une
    réponse, jamais une panne*.
    """

    @functools.wraps(outil)
    async def enveloppe(*args: Any, **kwargs: Any) -> _T:
        try:
            return await outil(*args, **kwargs)
        except ErreurAtelier as refus:
            # `ou_aller` est l'écran qui règle le problème. Il est déjà dans la
            # phrase quand il compte — le plafond dit « écran Réglages » —, donc
            # on ne le répète pas : deux formulations de la même consigne
            # finiraient par ne plus dire la même chose.
            raise ToolError(refus.raison) from None

    return enveloppe


def creer_serveur(atelier: Atelier) -> MCPServer:
    """Le serveur, branché sur **l'atelier déjà ouvert**. Jamais un second."""

    serveur = MCPServer(
        name="asset-kitchen",
        title="Asset Kitchen",
        version="0.1.0",
        instructions=(
            "Asset Kitchen produces 2D game assets. The open project carries a "
            "universe — art bible, palette, pixel size, per-family default "
            "model — and it is applied automatically: describe the subject "
            "only, never the style. Prefer list_assets and reuse over "
            "regenerating; generation costs real money. Every generated image "
            "enters the library on its own."
        ),
    )

    # ── Générer ──────────────────────────────────────────────────────────────

    @serveur.tool(
        name="generate_asset",
        meta=_barre(
            verbe="generer",
            titre="Générer une image",
            phrase="Ouvre l'écran d'envoi, déjà rempli. Rien n'est lancé ni payé ici.",
            paiement="a-confirmer",
            besoins=("fournisseur",),
        ),
        title="Generate an asset",
        description=(
            "Generate a game asset from a short subject description and return "
            "its file path. The open project's universe (art bible, palette, "
            "pixel grid, cutout) is applied automatically — describe the "
            "subject only. Waits up to `wait_seconds` for the image; past that "
            "it returns a generation id to poll with check_generation. Costs "
            "money."
        ),
    )
    @_refus_lisible
    async def generate_asset(
        subject: str,
        kind: str = "",
        project: str | None = None,
        variations: int = 1,
        aspect_ratio: str = "1:1",
        model: str | None = None,
        wait_seconds: float = ATTENTE_PAR_DEFAUT,
        folder: str | None = None,
    ) -> dict[str, Any]:
        """`kind` est l'échelle du barème — « personnage », « objet posé »…

        Un seul mot, et il décide de trois choses d'un coup : quels artworks
        partent en référence, quel modèle est le défaut, et quelle part de la
        case le sujet occupera. C'est ce qui garde un seul contrôle au moment de
        générer, ici comme à l'écran.
        """
        projet = _projet(atelier, project)
        variations = max(1, min(int(variations), 8))

        # **La place est retenue avant l'appel, et rendue quoi qu'il arrive.**
        # Le `finally` n'est pas une précaution de style : entre la réservation
        # et l'écriture de la génération il y a un `await`, donc un second appel
        # peut passer là — et un refus du catalogue survenu entre les deux
        # laisserait sinon une place retenue pour une génération qui n'existera
        # jamais, jusqu'à la fermeture de l'atelier.
        atelier.agent.reserver(variations)
        try:
            identifiant_modele, options = atelier.agent.modele_impose(model)
            generation = await atelier.generations.soumettre(
                identifiant_modele,
                Demande(
                    prompt=subject,
                    proportions=aspect_ratio,
                    variations=variations,
                    options=options,
                    echelle=kind,
                ),
                projet=projet,
                provenance=AGENT,
            )
        finally:
            atelier.agent.liberer(variations)

        attente = max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        finie = await atelier.generations.attendre(generation.identifiant, attente)
        return _generation_en_json(atelier, finie or generation, folder)

    @serveur.tool(
        name="check_generation",
        meta=_barre(
            verbe="aller",
            titre="Voir le chantier",
            phrase="Ce qui est en cours de fabrication, et ce qu'un redémarrage a coupé.",
            ou="galerie",
            besoins=("generations",),
        ),
        title="Check a generation",
        description=(
            "Poll a generation started by generate_asset. Returns its status "
            "and, once done, the file path of every image it produced."
        ),
    )
    @_refus_lisible
    async def check_generation(
        generation_id: str,
        wait_seconds: float = 0.0,
        folder: str | None = None,
    ) -> dict[str, Any]:
        attente = max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        generation = await atelier.generations.attendre(generation_id, attente)
        if generation is None:
            raise ErreurAtelier(f"aucune génération « {generation_id} »")
        return _generation_en_json(atelier, generation, folder)

    # ── Retrouver, plutôt que regénérer ──────────────────────────────────────

    @serveur.tool(
        name="list_projects",
        meta=_barre(
            verbe="aller",
            titre="Changer de jeu",
            phrase="La liste des jeux, le dernier travaillé en tête.",
            ou="jeux",
        ),
        title="List projects",
        description=(
            "List the projects and which one is currently open in the "
            "workshop. Assets land in the open project unless a project is "
            "named."
        ),
    )
    @_refus_lisible
    async def list_projects() -> dict[str, Any]:
        return {
            "open": atelier.bibliotheque.courant,
            "projects": [
                {
                    "id": p.identifiant,
                    "name": p.nom,
                    "assets": atelier.bibliotheque.compter_projet(p.identifiant),
                }
                for p in atelier.bibliotheque.projets()
            ],
        }

    @serveur.tool(
        name="list_assets",
        meta=_barre(
            verbe="aller",
            titre="Chercher dans la bibliothèque",
            phrase="Toutes les images du jeu, avec leurs filtres et leur tri.",
            ou="galerie",
        ),
        title="List assets",
        description=(
            "Search the library. Use this before generating — reusing an "
            "existing asset costs nothing, generating costs money. Returns "
            "labels, sizes and file paths."
        ),
    )
    @_refus_lisible
    async def list_assets(
        search: str = "",
        project: str | None = None,
        favorites: bool = False,
        limit: int = 50,
    ) -> dict[str, Any]:
        # `project` absent veut dire « le projet ouvert », comme partout ; le
        # mot-clé `all` traverse les projets, parce qu'un agent qui cherche une
        # épée ne sait pas dans quel univers elle a été rangée.
        tous = (project or "").lower() == "all"
        cible = None if tous else _projet(atelier, project)
        trouves = atelier.bibliotheque.chercher(
            projet=cible,
            sans_projet=False,
            favoris=favorites,
            recherche=search,
            limite=max(1, min(int(limit), 200)),
        )
        return {"assets": [_asset_en_json(atelier, a) for a in trouves]}

    @serveur.tool(
        name="get_asset",
        meta=_barre(
            verbe="aller",
            titre="Ouvrir la fiche d'une image",
            phrase="Ses mesures, sa recette, sa filiation et ce qu'elle a coûté.",
            ou="galerie",
            besoins=("images",),
        ),
        title="Get one asset",
        description=(
            "Full metadata for one asset: measured dimensions, recipe, "
            "lineage, cost, and the path of the file on disk."
        ),
    )
    @_refus_lisible
    async def get_asset(asset_id: str) -> dict[str, Any]:
        asset = _asset(atelier, asset_id)
        fiche = _asset_en_json(atelier, asset)
        fiche["recipe"] = asset.recette.en_json()
        fiche["lineage"] = atelier.bibliotheque.filiation(asset_id)
        return fiche

    @serveur.tool(
        name="list_models",
        meta=_barre(
            verbe="regler",
            titre="Voir le catalogue des modèles",
            phrase="Qui offre quoi, à quel prix, et ce qui est gris faute de clé.",
            ou="reglages",
        ),
        title="List image models",
        description=(
            "The catalogue of every provider: models, who offers each one, "
            "their reference limits, aspect ratios and options. A model id "
            "always carries its provider — two providers may offer the same "
            "model name. A model whose provider cannot work right now carries "
            "the reason. A model the workshop forces on the agent is marked as "
            "such."
        ),
    )
    @_refus_lisible
    async def list_models() -> dict[str, Any]:
        cadre = atelier.agent.garde_fous()
        etat = atelier.catalogue.etat
        # **La même règle que l'écran, par le même chemin** : le MCP n'a aucune
        # logique propre (T7). Ce qui grise un modèle chez l'auteur le grise
        # chez l'agent, et c'est le service qui le dit.
        grises = atelier.catalogue.grises()
        # **Ce qui reste chez chacun, dans son unité** (F2). Même chemin que le
        # grisé, et pour la même raison : le MCP n'a aucune logique propre.
        reserves = {r.fournisseur: r for r in atelier.reserves.toutes()}
        return {
            "forced_model": cadre.modele if cadre.modele_actif else None,
            "fallback": etat.repli,
            "reason": etat.raison,
            "providers": [
                {
                    "name": f.nom,
                    "models": len(f.modeles),
                    "fallback": f.repli,
                    "reason": f.raison,
                    "unavailable": grises.get(f.nom),
                    "budget": _reserve(reserves.get(f.nom)),
                }
                for f in etat.fournisseurs
            ],
            "models": [
                {
                    "id": m.identifiant,
                    "name": m.nom,
                    "provider": m.fournisseur,
                    "references_max": m.references_max,
                    "aspect_ratios": list(m.proportions),
                    "resolutions": list(m.resolutions),
                    "variations_max": m.variations_max,
                    "options": sorted(m.options),
                    "unavailable": grises.get(m.fournisseur),
                    # Dans quoi ce modèle-là se paie. `usd` pour tout ce qui
                    # facture ; autre chose pour ce qui consomme sans facturer,
                    # et l'agent doit pouvoir faire la différence avant de
                    # lancer un lot.
                    "unit": reserves[m.fournisseur].unite
                    if m.fournisseur in reserves
                    else "usd",
                }
                for m in etat.modeles
            ],
        }

    # ── Faire entrer, retoucher, découper, sortir ────────────────────────────

    @serveur.tool(
        name="import_asset",
        meta=_barre(
            verbe="creer",
            titre="Importer une image du disque",
            phrase="Elle entre dans la bibliothèque sans rien coûter.",
            ou="galerie",
        ),
        title="Import a local file",
        description=(
            "Bring a local image file into the library as a full asset — it "
            "can then be edited, sliced, reused as a reference and exported. "
            "The image enters as-is by default; pass apply_project_recipe to "
            "let the project's pixel grid and palette be applied to it. If the "
            "same file is already in the library, nothing is imported and the "
            "existing asset is returned as `doublon` — call again with "
            "force=true to import it anyway. Costs nothing and works offline."
        ),
    )
    @_refus_lisible
    async def import_asset(
        file_path: str,
        project: str | None = None,
        apply_project_recipe: bool = False,
        force: bool = False,
    ) -> dict[str, Any]:
        """**Les deux options de R3 sont ici aussi, et c'est le critère.**

        « L'écran et l'outil MCP passent par le même service : aucun geste que
        l'un a et l'autre pas. » Le service porte le doublon et le traitement du
        projet ; les cacher ici aurait fait de l'agent un utilisateur de seconde
        classe, avec une image ramenée à 64 pixels sans qu'il l'ait demandé et
        un doublon qu'il ne pourrait pas voir.
        """
        chemin = Path(file_path).expanduser()
        if not chemin.is_file():
            raise ErreurAtelier(f"aucun fichier « {chemin} »")
        entre = atelier.generations.importer(
            chemin.read_bytes(),
            chemin.name,
            projet=_projet(atelier, project),
            provenance=AGENT,
            traiter=apply_project_recipe,
            forcer=force,
        )
        if entre["asset"] is None:
            return {"asset": None, "doublon": entre["doublon"]}
        return {
            "asset": _asset_en_json(atelier, Asset.depuis_json(entre["asset"])),
            "doublon": None,
        }

    @serveur.tool(
        name="import_clip",
        meta=_barre(
            verbe="creer",
            titre="Importer une vidéo du disque",
            phrase="Elle entre comme clip, et ses images sont tirées à l’entrée.",
            ou="galerie",
        ),
        title="Import a local video",
        description=(
            "Bring a local video file (mp4, webm, mov, mkv, avi) into the "
            "project as a clip — its frames are extracted on entry, so it can "
            "immediately be montaged into animation strips, have single frames "
            "picked into the library, and be played back. Optionally file it "
            "under a character, pose and direction. If the same file is already "
            "in the project, nothing is imported and the existing clip is "
            "returned as `doublon` — call again with force=true to import it "
            "anyway. Costs nothing, calls no provider and works offline."
        ),
    )
    @_refus_lisible
    async def import_clip(
        file_path: str,
        project: str | None = None,
        character: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        """**Le pendant exact d’`import_asset`, et pour la même raison.**

        « L’écran et l’outil MCP passent par le même service : aucun geste que
        l’un a et l’autre pas. » Une porte d’entrée qui n’existerait que
        dans l’écran ferait de l’agent un utilisateur de seconde classe sur le
        seul geste de la tranche.
        """
        chemin = Path(file_path).expanduser()
        if not chemin.is_file():
            raise ErreurAtelier(f"aucun fichier « {chemin} »")
        return atelier.animation.importer(
            chemin.read_bytes(),
            chemin.name,
            projet=_projet(atelier, project),
            personnage=character,
            pose=pose,
            direction=direction,
            provenance=AGENT,
            forcer=force,
        )

    @serveur.tool(
        name="edit_asset",
        meta=_barre(
            verbe="travailler",
            titre="Retoucher une image",
            phrase="La recette de retouche : découpe, palette, grille, contour.",
            ou="galerie",
            besoins=("images",),
        ),
        title="Edit an asset",
        description=(
            "Re-process an existing asset without calling the provider: cut "
            "out the background, snap to a pixel grid, quantise to the project "
            "palette, or revert to the original image. Free, offline, and "
            "non-destructive — the raw image is always kept. In `steps`, the "
            "`veille` list names the steps that keep their settings but do "
            "nothing: `[\"quantification\"]` renders as if the palette step "
            "were not there, and dropping the name back out restores it "
            "untouched. get_asset reports the same list. A named `recipe` only "
            "carries settings, never coordinates — a traced crop box, an "
            "eyedropper point, hand strokes stay on the image they were made "
            "on; `not_applied` lists what it left behind."
        ),
    )
    @_refus_lisible
    async def edit_asset(
        asset_id: str,
        recipe: str | None = None,
        revert: bool = False,
        steps: dict[str, Any] | None = None,
        folder: str | None = None,
    ) -> dict[str, Any]:
        """Trois chemins, dans l'ordre où l'agent les voudra.

        `revert` d'abord parce que c'est le geste qui annule les deux autres ;
        `recipe` ensuite, une recette nommée, qui est le geste épais ; `steps`
        en dernier, la recette écrite à la main pour qui sait ce qu'il veut.

        **La veille est vérifiée ici** (U4), comme la route HTTP la vérifie de
        son côté. Le domaine, lui, ignore en silence un nom de place qu'il ne
        connaît pas — il doit pouvoir relire un vieux fichier. Mais un agent qui
        écrit *quantifications* au pluriel croirait avoir éteint la palette et
        regarderait ensuite un rendu quantifié sans comprendre pourquoi.
        """
        if steps is not None:
            inconnues = places_inconnues(steps.get("veille"))
            if inconnues:
                raise ErreurAtelier(
                    f"veille : place inconnue « {', '.join(inconnues)} » — "
                    f"les places sont {', '.join(PLACES)}"
                )
        laisse: tuple[str, ...] = ()
        if revert:
            asset = atelier.assets.revenir_au_brut(asset_id)
        elif recipe:
            asset, laisse = atelier.assets.appliquer_nommee(asset_id, recipe)
        elif steps is not None:
            asset = atelier.assets.poser_recette(
                asset_id, Recette.depuis_json(steps)
            )
        else:
            raise ErreurAtelier(
                "dis ce qu'il faut faire : « recipe », « steps », ou « revert »"
            )
        # **Ce qu'une recette nommée n'a pas emporté est dit à l'agent aussi**
        # (U5). Il pose la recette et lit ensuite l'image : sans cette ligne, il
        # conclurait que la recette est fautive là où c'est la règle du voyage
        # qui a joué.
        return {**_asset_en_json(atelier, asset, folder), "not_applied": list(laisse)}

    @serveur.tool(
        name="slice_asset",
        meta=_barre(
            verbe="travailler",
            titre="Découper une planche",
            phrase="Une feuille reçue devient une image par case.",
            ou="galerie",
            besoins=("images",),
        ),
        title="Slice a sheet into assets",
        description=(
            "Cut a multi-sprite sheet into separate assets. Called without "
            "`boxes` it only proposes rectangles and creates nothing; pass the "
            "proposed boxes back — corrected if needed — to actually cut. A box "
            "is [x0, y0, x1, y1] in the raw image's pixels, inclusive on both "
            "ends. Each piece becomes a full asset linked to its sheet. Free "
            "and offline."
        ),
    )
    @_refus_lisible
    async def slice_asset(
        asset_id: str,
        mode: str = "auto",
        columns: int = 2,
        rows: int = 1,
        min_side: int = 16,
        boxes: list[list[int]] | None = None,
    ) -> dict[str, Any]:
        """**Deux gestes séparés**, et c'est la séparation qui tient la promesse.

        `proposer` ne crée rien : l'agent peut regarder les rectangles, en
        retirer un, et n'engager le disque qu'ensuite. Fondus en un seul appel,
        une détection ratée aurait fabriqué huit assets à jeter.

        **Les rectangles ont la forme du dépôt et pas une autre** —
        `[x0, y0, x1, y1]`, inclusive aux deux bouts, celle de `Boite` et de
        `Recadrage.boite`. `image/decoupe.py` l'écrit en toutes lettres : deux
        conventions de rectangle, l'une inclusive et l'autre exclusive, se
        confondraient un jour sur un pixel de bord. Un outil qui proposerait
        une forme et en accepterait une autre serait cette seconde convention.
        """
        if boxes is None:
            propose = atelier.decoupe.proposer(
                asset_id, mode=mode, colonnes=columns, lignes=rows, cote_min=min_side
            )
            return {
                "sheet": asset_id,
                "created": False,
                "boxes": propose.get("boites", []),
                "reason": propose.get("raison"),
            }

        faites = atelier.decoupe.decouper(
            asset_id,
            [tuple(int(c) for c in boite) for boite in boxes],
        )
        return {
            "sheet": asset_id,
            "created": True,
            "slices": [
                _asset_en_json(atelier, Asset.depuis_json(a))
                for a in faites.get("decoupes", [])
            ],
        }

    @serveur.tool(
        name="animate_sheet",
        meta=_barre(
            verbe="travailler",
            titre="Monter une feuille en animation",
            phrase="Une feuille reçue devient une animation du personnage.",
            ou="galerie",
            besoins=("images",),
        ),
        title="Turn a sprite sheet into an animation",
        description=(
            "Turn a multi-sprite sheet into an animation: its cells become the "
            "frames of a clip, and a strip is kept from them, ready to be "
            "placed on a character's movement and direction. Boxes are "
            "[x0, y0, x1, y1] in the raw image's pixels, inclusive on both "
            "ends, **in playing order** — call `slice_asset` without `boxes` "
            "to get them proposed. Naming `directions` makes one strip per "
            "row, in row order. Free, offline, and no video encoding: "
            "transparency is preserved."
        ),
    )
    @_refus_lisible
    async def animate_sheet(
        asset_id: str,
        boxes: list[list[int]],
        name: str = "",
        character: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        directions: list[str] | None = None,
        fps: float = CADENCE_DE_BANDE,
        loop: str = BOUCLE,
    ) -> dict[str, Any]:
        """**Ce que l'écran peut faire, l'agent le peut aussi** — et par la même porte.

        Aucune logique ici : le service découpe, écrit le clip et taille les
        bandes. L'outil traduit des mots anglais en mots du produit, et rien
        d'autre.
        """
        fait = atelier.planche_animee.animer(
            asset_id,
            [tuple(int(c) for c in boite) for boite in boxes],
            nom=name,
            personnage=character,
            pose=pose,
            direction=direction,
            directions=directions,
            cadence=fps,
            sens=loop,
            acteur=AGENT,
        )
        return {
            "clip": fait["clip"]["identifiant"],
            "frames": fait["clip"]["clip"]["images"],
            "strips": [
                {
                    "id": bande["identifiant"],
                    "name": bande["nom"],
                    "frames": [prise["numero"] for prise in bande["prises"]],
                    "pose": bande["pose"],
                    "direction": bande["direction"],
                }
                for bande in fait["bandes"]
            ],
        }

    @serveur.tool(
        name="export_assets",
        meta=_barre(
            verbe="sortir",
            titre="Sortir des images vers le dossier du jeu",
            phrase="Écrit une planche PNG et son fichier de description dans le dossier du jeu.",
            ou="galerie",
            besoins=("images",),
        ),
        title="Export assets to a folder",
        description=(
            "Write the rendered PNG of each named asset into a folder — "
            "typically the game's asset folder — plus a descriptif.json "
            "describing every file. A missing folder is created and an "
            "existing file is never overwritten."
        ),
    )
    @_refus_lisible
    async def export_assets(
        asset_ids: list[str],
        folder: str | None = None,
    ) -> dict[str, Any]:
        """L'archive de T6, **ouverte dans le dossier du jeu**.

        Cette fonction rouvrait le zip pour en ressortir les fichiers un par un
        — c'était la seule du fichier qui *faisait* quelque chose, donc la seule
        entorse à « le MCP n'a pas de logique propre ». **Le geste vit dans le
        service depuis C5** (`export.deposer`), et l'outil est redevenu ce qu'il
        aurait toujours dû être : une traduction.
        """
        sortie = atelier.export.deposer(asset_ids, folder)
        return {
            "folder": sortie.dossier,
            # **Le descriptif est dans la liste, et il y était déjà** : T7 rend
            # les chemins de *tous* les fichiers posés, celui-là compris. Un
            # invariant instauré ne se renégocie pas parce qu'on a déménagé le
            # geste — c'est la même réponse, écrite ailleurs.
            "files": [
                {"name": fiche["fichier"], "path": fiche["chemin"]}
                for fiche in sortie.fichiers
            ]
            + [
                {
                    "name": Path(sortie.descriptif).name,
                    "path": sortie.descriptif,
                }
            ],
            "manifest": list(sortie.fichiers),
            "descriptor": sortie.descriptif,
        }

    # ── Le personnage, ses attitudes, et ce qu'il porte (C5) ────────────────
    #
    # **Cinq outils, et ils ne font rien que l'écran ne fasse** (US-156). Lire ce
    # qui manque, ajouter une attitude au plan, remplir une case, habiller, et
    # sortir le personnage dans le jeu : c'est la boucle entière de la V2, au
    # grain épais de T7 — l'agent dit ce qu'il veut, pas comment l'obtenir.
    #
    # **Les gestes de finesse de C4 restent à l'écran**, et c'est délibéré :
    # borner une zone, affiner un masque, retoucher au pixel demandent un œil
    # sur l'image. Un agent qui bornerait un calque à l'aveugle abîmerait ce que
    # la mesure vient de produire, sans que rien ne le lui dise. L'invariant qui
    # compte est tenu dans le sens qui compte : **aucun geste que l'écran n'a
    # pas.**

    @serveur.tool(
        name="list_characters",
        meta=_barre(
            verbe="aller",
            titre="Voir le casting",
            phrase="Les personnages du jeu, et ce qui manque à chacun.",
            ou="codex",
            besoins=("personnages",),
        ),
        title="List characters and what they still need",
        description=(
            "The game's cast — characters, but also scenery, objects and UI "
            "elements, which are things of the game in their own right: every "
            "one of them, the poses the project's plan "
            "asks for, which of them already have a body, and which pieces of "
            "equipment are already layered on. Also returns the project's "
            "wardrobe — equipment slots in wearing order, and the pieces that "
            "go in them — and the game's directions, since a slot is a pose in "
            "a direction. Each character also carries `reference_image`: the "
            "one still image that says what the subject looks like, picked by "
            "the author. It is read-only here — there is no tool to set it. "
            "Call this before generating: an empty slot is what "
            "needs an image, a filled one does not. Free and offline."
        ),
    )
    @_refus_lisible
    async def list_characters(project: str | None = None) -> dict[str, Any]:
        """La matrice, dite à l'agent — **et rien n'est recalculé ici**.

        « Cette pose est remplie » a une seule écriture dans le produit, celle
        qui dessine la matrice à l'écran ; on la traduit, on ne la refait pas.
        Les calques d'une pièce sont rendus **tous**, sans en élire un : élire
        est une règle, et la règle appartient au service qui sort le personnage.
        """
        projet = _projet_ouvert(atelier, project)
        vestiaire = atelier.equipement.vestiaire(projet)
        # **Les cases, lues une fois par sujet** (RP19). L'image de référence
        # retombe dessus quand l'auteur n'en a choisi aucune ; les relire pour
        # elle paierait le même parcours deux fois.
        cases_par_sujet = [
            (personnage, atelier.production.cases(projet, personnage))
            for personnage in atelier.production.personnages(projet)
        ]
        return {
            "project": projet,
            "poses": [
                {
                    "id": p.identifiant,
                    "name": p.nom,
                    "images": p.images,
                    # **Ce qui part au modèle, en anglais** (E10) : le nom se
                    # lit, la consigne part, et l'agent doit voir laquelle il
                    # compose.
                    "instruction": p.dit(),
                }
                for p in atelier.production.plan(projet)
            ],
            # **Les directions du jeu** (E10). Sans elles, un agent remplirait
            # la première case de chaque pose et croirait la pose finie : une
            # case est une pose *dans une direction*.
            "directions": [
                {"id": d["identifiant"], "name": d["nom"], "instruction": d["consigne"]}
                for d in atelier.production.directions(projet)["directions"]
            ],
            "slots": [
                {"id": e["identifiant"], "name": e["nom"], "order": e["rang"]}
                for e in vestiaire["emplacements"]
            ],
            "pieces": [
                {
                    "id": p["identifiant"],
                    "name": p["nom"],
                    "description": p["description"],
                    "slot": p["emplacement"],
                    "scope": p["portee"],
                }
                for p in vestiaire["pieces"]
            ],
            "characters": [
                {
                    "id": personnage.identifiant,
                    "name": personnage.nom,
                    "description": personnage.description,
                    # **Sa famille, et ce qu'elle peut avoir** (E15). Un décor
                    # et un bouton sont des choses du jeu de plein droit, mais
                    # ils ne portent pas d'équipement : sans ce champ, un agent
                    # essaierait d'habiller une salle du trône.
                    "family": atelier.production.famille_de(projet, personnage),
                    "wearable": atelier.production.porte_de_lequipement(
                        projet, personnage
                    ),
                    # **L'agent lit le portrait, il ne le choisit pas** (RP19).
                    # C'est un jugement de l'auteur sur ce à quoi sa chose
                    # ressemble ; un outil pour l'écrire en ferait une décision
                    # d'agent. `null` quand le sujet n'a encore aucune image.
                    "reference_image": atelier.production.image_de_reference(
                        projet, personnage, cases
                    )
                    or None,
                    "poses": [
                        {
                            "pose": case["pose"],
                            "wanted": case["demandees"],
                            "body": case["corps"],
                            "images": [a["identifiant"] for a in case["images"]],
                            # Une entrée par direction tenue, avec ce qui la
                            # remplit : c'est là que l'agent lit qu'il manque le
                            # nord (E10). Vide pour un jeu sans directions.
                            "directions": [
                                {
                                    "id": d["identifiant"],
                                    "wanted": d["demandees"],
                                    "images": [a["identifiant"] for a in d["images"]],
                                }
                                for d in case["directions"]
                            ],
                            "layers": {
                                piece: [a["identifiant"] for a in liste]
                                for piece, liste in case["calques"].items()
                            },
                        }
                        for case in cases
                    ],
                }
                for personnage, cases in cases_par_sujet
            ],
        }

    @serveur.tool(
        name="add_pose",
        meta=_barre(
            verbe="creer",
            titre="Ajouter une pose au plan du jeu",
            phrase="Le plan de poses est commun au casting : elle s'ajoute une fois.",
            ou="univers",
        ),
        title="Add a pose to the game plan",
        description=(
            "Add a pose — an attitude the game needs, like 'walk' or 'idle' — "
            "to the project's plan. Every character of the project gains an "
            "empty slot for it. Naming it creates it. `instruction` is what "
            "actually goes to the model, in English — leave it empty and the "
            "name goes out as-is. Free and offline."
        ),
    )
    @_refus_lisible
    async def add_pose(
        name: str,
        images: int = 1,
        instruction: str = "",
        project: str | None = None,
    ) -> dict[str, Any]:
        """**Le plan appartient au projet, jamais au personnage** (C1).

        Ajouter une attitude la donne donc à tout le monde d'un coup, et c'est
        ce qui rend le geste utile à un agent : il complète le plan une fois,
        puis il remplit les cases qui l'intéressent.
        """
        projet = _projet_ouvert(atelier, project)
        pose = atelier.production.ajouter_pose(
            projet, name, max(1, int(images)), instruction
        )
        return {
            "project": projet,
            "pose": {
                "id": pose.identifiant,
                "name": pose.nom,
                "images": pose.images,
                "instruction": pose.dit(),
            },
            "poses": [
                {
                    "id": p.identifiant,
                    "name": p.nom,
                    "images": p.images,
                    "instruction": p.dit(),
                }
                for p in atelier.production.plan(projet)
            ],
        }

    @serveur.tool(
        name="generate_pose",
        meta=_barre(
            verbe="generer",
            titre="Mettre un personnage en pose",
            phrase="Ouvre l'écran d'envoi, déjà rempli. Rien n'est lancé ni payé ici.",
            paiement="a-confirmer",
            besoins=("fournisseur", "personnages"),
        ),
        title="Fill a character's pose",
        description=(
            "Generate the body of one or more poses of a character. The "
            "character's own description and the universe are added "
            "automatically — leave `subject` empty unless this image needs "
            "something the character's description does not say. `direction` "
            "says which of the game's directions this image shows — its "
            "instruction is appended automatically. Two poses or "
            "more go out as a single folded call, which is how a plan gets "
            "filled without paying pose by pose. Costs money."
        ),
    )
    @_refus_lisible
    async def generate_pose(
        character: str,
        poses: list[str],
        subject: str = "",
        direction: str = "",
        project: str | None = None,
        model: str | None = None,
        wait_seconds: float = ATTENTE_PAR_DEFAUT,
        folder: str | None = None,
    ) -> dict[str, Any]:
        """La case que l'écran arme, armée par l'agent (US-156).

        **Le sujet vient du service, pas d'ici** : le signalement du personnage
        part avec chaque image de lui et ne se retape jamais (US-115). Deux
        compositions à deux endroits auraient demandé deux choses différentes
        pour la même case.

        **Une pose ou N, et c'est le compte qui décide** — une seule vise une
        case, deux ou plus se replient en une planche. C'est la traduction de ce
        que l'écran envoie déjà sur la même route, jamais une seconde règle : le
        pliage, le refus d'un compte faux et la vérification des cases
        appartiennent au service, qui les tient pour les deux façades.
        """
        projet = _projet_ouvert(atelier, project)
        vise = _personnage(atelier, projet, character)
        voulues = [_pose(atelier, projet, nomme) for nomme in poses]
        if not voulues:
            raise ErreurAtelier("dis quelle attitude remplir — « poses » est vide")

        # **La place est retenue avant l'appel, et rendue quoi qu'il arrive** —
        # même `finally` que `generate_asset`, et pour la même raison. Un lot
        # plié est **un** appel : c'est tout son intérêt, et le compter N fois
        # ferait mentir le plafond dans le sens qui coûte à l'auteur.
        atelier.agent.reserver(1)
        try:
            identifiant_modele, options = atelier.agent.modele_impose(model)
            generation = await atelier.generations.soumettre(
                identifiant_modele,
                Demande(
                    # **Le signalement seul** : la consigne de l'attitude et
                    # celle de la direction sont ajoutées par le composeur du
                    # prompt depuis E14, pour les deux façades à la fois. Un
                    # agent qui écrit son propre `subject` les reçoit donc
                    # aussi — c'est ce qui fait qu'une case ne peut plus partir
                    # sans dire ce qu'elle demande.
                    prompt=subject.strip()
                    or atelier.production.sujet(projet, vise.identifiant),
                    variations=1,
                    options=options,
                ),
                projet=projet,
                provenance=AGENT,
                personnage=vise.identifiant,
                pose=voulues[0] if len(voulues) == 1 else None,
                # **Une direction ne vaut que pour une case** : un lot vise N
                # poses, et c'est `poses` qui les nomme.
                direction=(
                    direction.strip() if len(voulues) == 1 and direction else None
                ),
                poses=voulues if len(voulues) > 1 else None,
            )
        finally:
            atelier.agent.liberer(1)

        attente = max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        finie = await atelier.generations.attendre(generation.identifiant, attente)
        return _generation_en_json(atelier, finie or generation, folder)

    @serveur.tool(
        name="equip_character",
        meta=_barre(
            verbe="travailler",
            titre="Poser une pièce sur un personnage",
            phrase="Le calque se pose sur les poses qui existent déjà.",
            ou="codex",
            besoins=("personnages", "pieces"),
        ),
        title="Put a piece of equipment on a character",
        description=(
            "Layer one piece of equipment onto poses that already have a body. "
            "The bodies are sent out together in a single call and what comes "
            "back is compared to what was sent, pose by pose, which yields one "
            "layer per pose. Poses without a body are refused with their "
            "reason — dressing an empty pose is paying for nothing. Costs "
            "money."
        ),
    )
    @_refus_lisible
    async def equip_character(
        character: str,
        piece: str,
        poses: list[str],
        subject: str = "",
        project: str | None = None,
        model: str | None = None,
        wait_seconds: float = ATTENTE_PAR_DEFAUT,
        folder: str | None = None,
    ) -> dict[str, Any]:
        """La planche d'équipement de C3, armée par l'agent.

        **Le même endroit d'où l'on paie** : il n'existe qu'une soumission dans
        tout le produit, et cet outil-ci n'en est que la seconde adresse. Ce qui
        change tient en un mot — la pièce —, et c'est ce mot qui fait partir la
        planche **pleine** des corps au lieu d'une grille vide.
        """
        projet = _projet_ouvert(atelier, project)
        vise = _personnage(atelier, projet, character)
        voulue = _piece(atelier, projet, piece)
        voulues = [_pose(atelier, projet, nomme) for nomme in poses]
        if not voulues:
            raise ErreurAtelier("dis quelles attitudes habiller — « poses » est vide")

        atelier.agent.reserver(1)
        try:
            identifiant_modele, options = atelier.agent.modele_impose(model)
            generation = await atelier.generations.soumettre(
                identifiant_modele,
                Demande(
                    prompt=subject.strip()
                    or atelier.production.sujet(
                        projet, vise.identifiant, piece=voulue
                    ),
                    variations=1,
                    options=options,
                ),
                projet=projet,
                provenance=AGENT,
                personnage=vise.identifiant,
                poses=voulues,
                piece=voulue,
            )
        finally:
            atelier.agent.liberer(1)

        attente = max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        finie = await atelier.generations.attendre(generation.identifiant, attente)
        return _generation_en_json(atelier, finie or generation, folder)

    @serveur.tool(
        name="export_character",
        meta=_barre(
            verbe="sortir",
            titre="Sortir la planche d'un personnage",
            phrase="Une planche PNG, ses cases décrites, dans le dossier du jeu.",
            ou="codex",
            besoins=("personnages",),
        ),
        title="Export a character into the game folder",
        description=(
            "Write a whole character into the game folder: one PNG per pose "
            "and one per piece worn on it, plus a descriptor naming every "
            "file, its pose and its piece. Each file carries a `role`: "
            "`corps` is a body, `calque` is a layer to stack on the body of "
            "the same pose, and `corps_habille` is a whole body already "
            "wearing the piece — it replaces the body, it does not stack. "
            "What is written is the rendered image, never the raw one. A "
            "missing folder is created and an existing file is never "
            "overwritten. Read the descriptor to write your own catalogue "
            "lines — the workshop does not write game code, and it invents no "
            "folder structure. Free and offline."
        ),
    )
    @_refus_lisible
    async def export_character(
        character: str,
        project: str | None = None,
        folder: str | None = None,
    ) -> dict[str, Any]:
        """La sortie de C5 (US-154, US-155, US-157).

        **Le descriptif part deux fois, et ce n'est pas un doublon** : il est
        écrit dans le dossier, pour qui rouvrira le jeu dans six mois, et rendu
        ici, pour que l'agent n'ait pas à relire un fichier qu'il vient de faire
        écrire.
        """
        projet = _projet_ouvert(atelier, project)
        vise = _personnage(atelier, projet, character)
        sortie = atelier.export.exporter_personnage(projet, vise.identifiant, folder)
        return {
            "folder": sortie.dossier,
            "files": [
                {
                    "name": fiche["fichier"],
                    "path": fiche["chemin"],
                    "role": fiche["role"],
                    "pose": fiche["pose"],
                    "piece": fiche["piece"],
                }
                for fiche in sortie.fichiers
            ],
            "manifest": list(sortie.fichiers),
            "descriptor": sortie.descriptif,
        }

    # ── Le cadre, pour que l'agent sache ce qu'il lui reste ──────────────────

    @serveur.tool(
        name="get_budget",
        meta=_barre(
            verbe="aller",
            titre="Voir les dépenses",
            phrase="Ce que la séance a coûté, et ce qui reste avant le plafond.",
            ou="depenses",
        ),
        title="Session budget",
        description=(
            "How many generations this session has used, what they cost in "
            "money, what they consumed in other units, and what is left "
            "before the cap. Money and other units are never added together. "
            "Check it before a batch."
        ),
    )
    @_refus_lisible
    async def get_budget() -> dict[str, Any]:
        consommation = atelier.agent.consommation()
        return {
            "generations": consommation["generations"],
            "spent_usd": consommation["depense_usd"],
            # **Ce qui a été consommé sans argent, compté à part** (F2). Une
            # séance entière passée chez un fournisseur gratuit se lisait
            # `spent_usd: 0` — c'est-à-dire comme une séance sans un seul appel.
            "consumed": consommation["consomme"],
            "cap": consommation["plafond"] if consommation["plafond_actif"] else None,
            "left": consommation["reste"],
            # Ce qui reste chez chaque fournisseur qui ne compte pas en argent,
            # et **d'où le chiffre vient**. Le plafond ci-dessus compte des
            # images ; celui-ci compte ce que le fournisseur alloue.
            "providers": [_reserve(r) for r in atelier.reserves.toutes()],
        }

    # ── Les trois gestes d'entretien (B6) ───────────────────────────────────
    #
    # **Ils entrent par l'agent parce que la barre les lit chez lui.** Le
    # serveur savait déjà les trois — `POST /library/rebuild`, `/universe/realign`
    # et `/models/refresh` sont livrés depuis longtemps —, mais aucun bouton ne
    # les déclenchait et l'agent ne les connaissait pas. Les écrire ici les
    # donne aux deux d'un coup : à l'agent, qui vient de poser trente images sur
    # le disque et voudrait que l'index les voie ; à l'auteur, qui les trouve
    # dans la barre sans qu'on ait dessiné trois boutons pour des gestes qu'on
    # fait trois fois par an.
    #
    # **Les trois sont gratuits, et aucun ne touche le réseau pour payer.**
    # `refresh_models` appelle bien le catalogue des fournisseurs, mais lire un
    # catalogue ne coûte rien — c'est la même relecture que fait l'ouverture de
    # l'atelier.

    @serveur.tool(
        name="rebuild_library",
        meta=_barre(
            verbe="travailler",
            titre="Reconstruire l'index de la bibliothèque",
            phrase=(
                "Relit tous les fichiers du disque et refait la base. Aucune "
                "image ne peut être perdue."
            ),
            ou="ici",
            route="POST /api/library/rebuild",
        ),
        title="Rebuild the library index",
        description=(
            "Re-read every file on disk and rebuild the library index. The "
            "files are the truth; the index is derived from them and can "
            "always be rebuilt. Free, and no image can be lost. Use it after "
            "writing files into the data folder by hand."
        ),
    )
    @_refus_lisible
    async def rebuild_library() -> dict[str, Any]:
        compte = atelier.bibliotheque.reconstruire()
        atelier.bibliotheque.ouvrir()
        return {"rebuilt": compte}

    @serveur.tool(
        name="realign_project",
        meta=_barre(
            verbe="travailler",
            titre="Recalculer le rendu des {images} images de ce jeu",
            phrase=(
                "Refait l'affichage des images du jeu. Les originaux ne sont "
                "pas touchés."
            ),
            ou="ici",
            route="POST /api/universe/realign",
            besoins=("images",),
        ),
        title="Realign a project on its universe",
        description=(
            "Re-apply the project's palette and pixel grid to its assets, "
            "without a single paid call. Hand-made settings are never "
            "overwritten. Returns how many were brought up to date and how "
            "many were kept as they are."
        ),
    )
    @_refus_lisible
    async def realign_project(project: str | None = None) -> dict[str, Any]:
        return atelier.univers.realigner(_projet_ouvert(atelier, project))

    @serveur.tool(
        name="refresh_models",
        meta=_barre(
            verbe="regler",
            titre="Relire le catalogue chez les fournisseurs",
            phrase="Redemande la liste des modèles. Aucun appel payant.",
            ou="ici",
            route="POST /api/models/refresh",
        ),
        title="Refresh the model catalogue",
        description=(
            "Ask every provider for its catalogue again. Free — reading a "
            "catalogue costs nothing. Never raises when the network is still "
            "down: it returns the offline fallback and the date it was read."
        ),
    )
    @_refus_lisible
    async def refresh_models() -> dict[str, Any]:
        etat = await atelier.catalogue.rafraichir()
        return {
            "models": [m.identifiant for m in etat.modeles],
            # **Le repli n'est pas une panne, et il se dit** : hors ligne, le
            # catalogue sert celui du disque avec sa date, et l'agent doit
            # savoir qu'il lit une photo plutôt que le présent.
            "offline": etat.repli,
            "reason": etat.raison,
        }

    from atelier.mcp.livraison import installer_outils_livraison
    installer_outils_livraison(serveur, atelier, _refus_lisible)
    from atelier.mcp.livraison_images import installer_outils_livraison_images
    installer_outils_livraison_images(serveur, atelier, _refus_lisible)
    from atelier.mcp.tuiles import installer_outils_tuiles
    installer_outils_tuiles(serveur, atelier, _refus_lisible)
    from atelier.mcp.objectifs import installer_outils_objectifs
    installer_outils_objectifs(serveur, atelier, _refus_lisible, _projet_ouvert, _personnage)
    from atelier.mcp.travaux import installer_outils_travaux
    installer_outils_travaux(serveur, atelier, _refus_lisible)
    from atelier.mcp.file_locale import installer_outils_file_locale
    installer_outils_file_locale(serveur, atelier, _refus_lisible)
    from atelier.mcp.workflows import installer_outils_workflow
    installer_outils_workflow(serveur, atelier, _refus_lisible)
    from atelier.mcp.calques_cibles import installer_calques_cibles
    installer_calques_cibles(serveur, atelier, _refus_lisible)
    from atelier.mcp.travaux_equipement import installer_travaux_equipement
    installer_travaux_equipement(serveur, atelier, _refus_lisible)
    from atelier.mcp.tenues import installer_tenues
    installer_tenues(serveur, atelier, _refus_lisible)
    from atelier.mcp.sons import installer_sons
    installer_sons(serveur, atelier, _refus_lisible)
    from atelier.mcp.sources_3d import installer_sources_3d
    installer_sources_3d(serveur, atelier, _refus_lisible)
    return serveur


# ── Traduire ce qui revient ─────────────────────────────────────────────────
#
# Ces trois fonctions ne décident de rien : elles renomment. Le vocabulaire du
# produit est français, celui d'un outil MCP est anglais, et la frontière est
# ici — exactement comme l'adaptateur du fournisseur traduit dans l'autre sens.


def _reserve(reserve: "Reserve | None") -> dict[str, Any] | None:
    """La réserve d'un fournisseur, en vocabulaire d'outil (F2).

    `remaining` vaut `null` quand le fournisseur n'annonce aucune allocation —
    ce qui est le cas des deux fournisseurs du produit. **Ce n'est pas zéro**,
    et un agent qui confondrait les deux s'arrêterait de travailler là où rien
    ne le limite. `counted` dit d'où le chiffre vient : `here` — compté sur les
    appels partis de cette machine, donc un minimum ; `provider` — relevé chez
    lui, donc un fait.
    """
    if reserve is None:
        return None
    return {
        "provider": reserve.fournisseur,
        "unit": reserve.unite,
        "used": reserve.consomme,
        "allowance": reserve.plafond,
        "remaining": reserve.reste,
        "counted": "here" if reserve.source == ICI else "provider",
        "renews": reserve.renouvellement or None,
        "min_seconds_between_calls": reserve.cadence_s or None,
    }


def _projet(atelier: Atelier, nomme: str | None) -> str | None:
    """Le projet visé. **Un projet inconnu est refusé avec la liste** (US-86).

    Et rien n'est créé au passage : nommer un projet qui n'existe pas est une
    faute de frappe bien plus souvent qu'une intention, et un projet fantôme
    créé par mégarde se retrouve des semaines après, vide, sans qu'on sache d'où
    il vient.
    """
    if not nomme:
        # **Sans projet nommé, le projet ouvert dans l'atelier** (US-87). Le
        # défaut vit dans le service, pas ici : `preparer()` le pose déjà, et le
        # relire ici serait une seconde vérité sur la même question.
        return None
    connus = {p.identifiant: p for p in atelier.bibliotheque.projets()}
    if nomme in connus:
        return nomme
    # Le nom lisible marche aussi : un agent a lu « Cœur de pierre » dans
    # `list_projects`, pas son repère.
    for identifiant, projet in connus.items():
        if projet.nom.strip().lower() == nomme.strip().lower():
            return identifiant
    raise ProjetInconnu(nomme, sorted(connus))


def _projet_ouvert(atelier: Atelier, nomme: str | None) -> str:
    """Le projet visé, **résolu** — celui qu'on nomme, sinon celui qui est ouvert.

    `_projet` rend `None` quand rien n'est nommé, et c'est juste pour la
    génération : le défaut vit dans le service, qui doit pouvoir refuser un
    projet manquant plutôt que d'en inventer un. Les gestes de la V2, eux,
    visent un projet *nommé* — un plan, un vestiaire, une matrice appartiennent
    à quelqu'un. C'est exactement la règle qu'`api/production.py` applique déjà
    pour l'écran, et c'est la même phrase des deux côtés.
    """
    return _projet(atelier, nomme) or atelier.bibliotheque.courant or ""


def _personnage(atelier: Atelier, projet: str, nomme: str) -> Personnage:
    """Le personnage visé — **par son repère ou par son nom**.

    Comme `_projet` juste au-dessus, et pour la raison exacte : un agent a lu
    « Héroïne » dans `list_characters`, pas son repère. Et rien n'est créé au
    passage — un personnage fantôme né d'une faute de frappe se retrouve des
    semaines après, vide, sans qu'on sache d'où il vient.
    """
    connus = atelier.production.personnages(projet)
    for personnage in connus:
        if personnage.identifiant == nomme:
            return personnage
    for personnage in connus:
        if personnage.nom.strip().lower() == nomme.strip().lower():
            return personnage
    raise ErreurAtelier(
        f"aucun personnage « {nomme} » — il y a "
        + (", ".join(f"« {p.nom} »" for p in connus) or "personne dans ce projet")
    )


def _pose(atelier: Atelier, projet: str, nomme: str) -> str:
    """L'identifiant d'une attitude, dite par son repère ou par son nom."""
    plan = atelier.production.plan(projet)
    for pose in plan:
        if pose.identifiant == nomme:
            return pose.identifiant
    for pose in plan:
        if pose.nom.strip().lower() == nomme.strip().lower():
            return pose.identifiant
    raise ErreurAtelier(
        f"aucune attitude « {nomme} » au plan — il y a "
        + (", ".join(f"« {p.nom} »" for p in plan) or "un plan vide")
    )


def _piece(atelier: Atelier, projet: str, nomme: str) -> str:
    """L'identifiant d'une pièce du vestiaire, par son repère ou par son nom.

    **Rien n'est créé ici non plus**, et c'est le seul endroit du produit où
    « nommer, c'est créer » ne s'applique pas : l'auteur écrit son vestiaire,
    l'agent s'en sert. Une pièce inventée par une faute de frappe partirait dans
    un appel payant sans description, et reviendrait en calque de rien.
    """
    connues = atelier.equipement.pieces(projet)
    for piece in connues:
        if piece.identifiant == nomme:
            return piece.identifiant
    for piece in connues:
        if piece.nom.strip().lower() == nomme.strip().lower():
            return piece.identifiant
    raise ErreurAtelier(
        f"aucune pièce « {nomme} » au vestiaire — il y a "
        + (", ".join(f"« {p.nom} »" for p in connues) or "un vestiaire vide")
    )


def _asset(atelier: Atelier, identifiant: str) -> Asset:
    asset = atelier.assets.lire(identifiant)
    if asset is None:
        raise ErreurAtelier(f"aucun asset « {identifiant} »")
    return asset


def _chemin(atelier: Atelier, asset: Asset) -> str:
    """Le chemin absolu du fichier **à utiliser** — le rendu, jamais le brut.

    Même règle que l'archive de T6 : ce qui sort est celui qu'on voit, celui qui
    entre dans le jeu. Le brut reste ici, c'est lui qui permet de refaire le
    rendu. Demander les octets a un effet de bord voulu — un rendu absent ou
    périmé se recalcule et s'écrit, donc le chemin rendu existe toujours.
    """
    atelier.assets.octets(asset)
    relu = atelier.assets.lire(asset.identifiant) or asset
    return str((atelier.fichiers.racine / (relu.rendu or relu.brut)).resolve())


def _asset_en_json(
    atelier: Atelier, asset: Asset, dossier: str | None = None
) -> dict[str, Any]:
    """Un asset, dit à l'agent. Et posé dans le dossier du jeu si on le demande.

    Les dimensions annoncées sont celles **du fichier qui part** : celles du
    rendu quand il y en a un, celles du brut sinon. « Zéro n'est pas une
    dimension mesurée, c'est l'absence de mesure » — un asset non traité n'a pas
    de dimension de rendu, et c'est le brut qui fait foi.
    """
    chemin = _chemin(atelier, asset)
    largeur = asset.rendu_largeur or asset.largeur
    hauteur = asset.rendu_hauteur or asset.hauteur
    fiche: dict[str, Any] = {
        "id": asset.identifiant,
        "label": asset.label,
        "path": chemin,
        "width": largeur,
        "height": hauteur,
        "project": asset.projet,
        "favorite": asset.favori,
        "processed": asset.traite,
        "cost_usd": asset.cout_usd,
        "provenance": asset.provenance,
    }
    if dossier is not None:
        octets = Path(chemin).read_bytes()
        fiche["written_to"] = atelier.agent.deposer(
            octets, _nom_de_fichier(asset), dossier
        )
    return fiche


def _nom_de_fichier(asset: Asset) -> str:
    """Un nom lisible tiré du label, et sûr sur un système de fichiers.

    Le label est du texte libre — c'est le prompt de l'auteur. On garde les
    lettres, les chiffres et le tiret, on coupe court : un nom de fichier de
    deux cents signes est refusé par Windows bien avant d'être utile.
    """
    propre = "".join(
        c if c.isalnum() or c in "-_" else "-" for c in (asset.label or "asset").lower()
    )
    propre = "-".join(m for m in propre.split("-") if m)[:48]
    return f"{propre or 'asset'}.png"


def _generation_en_json(
    atelier: Atelier, generation: Generation, dossier: str | None = None
) -> dict[str, Any]:
    """Ce que l'agent reçoit d'un appel : ses images, ou de quoi revenir.

    **L'identifiant part dans les deux cas**, terminé ou non : un agent qui a
    reçu ses images n'a rien à en faire, mais un agent qui a reçu une seule des
    deux variations demandées voudra la seconde. Le lui refuser parce que le
    lot est « réussi » l'obligerait à relister la bibliothèque pour la trouver.
    """
    from atelier.domaine.asset import identifiant_de

    images: list[dict[str, Any]] = []
    for emplacement in generation.emplacements:
        if emplacement.resultat is None:
            continue
        asset = atelier.assets.lire(
            identifiant_de(generation.identifiant, emplacement.rang)
        )
        if asset is not None:
            images.append(_asset_en_json(atelier, asset, dossier))

    # Ce qui a raté, avec sa raison — en français, celle du produit. L'agent la
    # répétera à l'auteur telle quelle.
    ratees = [
        {"slot": e.rang, "reason": e.raison}
        for e in generation.emplacements
        if e.raison
    ]
    return {
        "generation_id": generation.identifiant,
        "status": generation.statut.value,
        "done": generation.statut.terminee,
        "cost_usd": generation.cout_usd,
        "images": images,
        "failures": ratees,
    }
