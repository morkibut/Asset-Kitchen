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
from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import AGENT, Generation
from atelier.domaine.recette import Recette
from atelier.services import Atelier
from atelier.services.bibliotheque import ProjetInconnu

# Ce que l'agent attend avant qu'on lui rende un identifiant, s'il ne le dit
# pas. Trente secondes : au-dessus de la durée médiane d'un appel du catalogue,
# donc « la plupart du temps » il reçoit son image (US-80).
ATTENTE_PAR_DEFAUT = 30.0
ATTENTE_MAX = 300.0

_T = TypeVar("_T")


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
        title="List image models",
        description=(
            "The provider catalogue: models, their reference limits, aspect "
            "ratios and options. A model the workshop forces on the agent is "
            "marked as such."
        ),
    )
    @_refus_lisible
    async def list_models() -> dict[str, Any]:
        cadre = atelier.agent.garde_fous()
        etat = atelier.catalogue.etat
        return {
            "forced_model": cadre.modele if cadre.modele_actif else None,
            "fallback": etat.repli,
            "reason": etat.raison,
            "models": [
                {
                    "id": m.identifiant,
                    "name": m.nom,
                    "references_max": m.references_max,
                    "aspect_ratios": list(m.proportions),
                    "resolutions": list(m.resolutions),
                    "variations_max": m.variations_max,
                    "options": sorted(m.options),
                }
                for m in etat.modeles
            ],
        }

    # ── Faire entrer, retoucher, découper, sortir ────────────────────────────

    @serveur.tool(
        name="import_asset",
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
        name="edit_asset",
        title="Edit an asset",
        description=(
            "Re-process an existing asset without calling the provider: cut "
            "out the background, snap to a pixel grid, quantise to the project "
            "palette, or revert to the original image. Free, offline, and "
            "non-destructive — the raw image is always kept."
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
        """
        if revert:
            asset = atelier.assets.revenir_au_brut(asset_id)
        elif recipe:
            asset = atelier.assets.appliquer_nommee(asset_id, recipe)
        elif steps is not None:
            asset = atelier.assets.poser_recette(
                asset_id, Recette.depuis_json(steps)
            )
        else:
            raise ErreurAtelier(
                "dis ce qu'il faut faire : « recipe », « steps », ou « revert »"
            )
        return _asset_en_json(atelier, asset, folder)

    @serveur.tool(
        name="slice_asset",
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
        name="export_assets",
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

        Le service rend un zip ; ce qui est utile à un agent est une liste de
        fichiers posés. On dépose donc chaque PNG un par un, plus le descriptif
        qui dit lequel est lequel — c'est lui qui fait foi sur le lien entre un
        nom lisible et un identifiant, et un nom numéroté sans lui serait
        illisible une semaine plus tard.
        """
        archive = atelier.export.exporter(asset_ids)
        import io as _io
        import json
        import zipfile

        poses: list[dict[str, str]] = []
        with zipfile.ZipFile(_io.BytesIO(archive.octets)) as zip_:
            for entree in zip_.namelist():
                octets = zip_.read(entree)
                chemin = atelier.agent.deposer(octets, Path(entree).name, folder)
                poses.append({"name": Path(entree).name, "path": chemin})
                if entree == "descriptif.json":
                    descriptif = json.loads(octets.decode("utf-8"))
        return {"files": poses, "manifest": descriptif.get("assets", [])}

    # ── Le cadre, pour que l'agent sache ce qu'il lui reste ──────────────────

    @serveur.tool(
        name="get_budget",
        title="Session budget",
        description=(
            "How many generations this session has used, what they cost, and "
            "what is left before the cap. Check it before a batch."
        ),
    )
    @_refus_lisible
    async def get_budget() -> dict[str, Any]:
        consommation = atelier.agent.consommation()
        return {
            "generations": consommation["generations"],
            "spent_usd": consommation["depense_usd"],
            "cap": consommation["plafond"] if consommation["plafond_actif"] else None,
            "left": consommation["reste"],
        }

    return serveur


# ── Traduire ce qui revient ─────────────────────────────────────────────────
#
# Ces trois fonctions ne décident de rien : elles renomment. Le vocabulaire du
# produit est français, celui d'un outil MCP est anglais, et la frontière est
# ici — exactement comme l'adaptateur du fournisseur traduit dans l'autre sens.


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
