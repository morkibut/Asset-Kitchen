"""Tuiles manipulées par l’agent avec le même service que l’auteur.

TU10 (`docs/PLAN-tuiles.md`) : l'agent fabrique aussi, sans écran. Une recette part au
serveur, qui rend l'atlas avec le code même de l'écran lancé sous Node
(`atelier/services/rendu_tuiles.py`), le vérifie (tile-check) et le garde comme le
ferait l'écran ; les matières se génèrent sur la machine (`ServiceMatieres`, TU5),
bornées par le cadre de l'agent comme ses images. La livraison reste l'éditeur commun.
"""
import asyncio
from typing import Any, Callable

from atelier.domaine.generation import AGENT
from atelier.domaine.recette_tuiles import recette as verifier_recette
from atelier.domaine.tuiles import TuilesRefusees
from atelier.services.rendu_tuiles import NodeAbsent

RECETTE = ("recipe = {sorte: sol|chemin|mur|coins-15|pieces-17, taille: 8|16|24|32|48|64|96|128, graine: int, "
           "emplacements: {surface, bordure, face (mur), bas and bordureBas (only with reglages.secondTerrain) → "
           "{source: 'integree', nom: herbe|prairie|pierre|brique|roche|terre|sable|eau|bois|neige|feuillage|lave|carrelage} "
           "or {source: 'asset', asset: <library image id, e.g. a material from generate_tile_material>} or {source: 'vide'}; "
           "a bordure/bordureBas takes lie: true to follow its surface (default) or lie: false with its own source — "
           "an asset on a surface requires lie: false on its bordure}, "
           "reglages: {bordures, arrondi, irregularite, nuances, relief, reduction, variantes, animation, animationAtlas, "
           "secondTerrain, decor (pebbles along edges: aucun|rare|leger|moyen|dense|partout), caillouxTaille (1-10, pebble size), "
           "caillouxNombre (1-10, pebbles per edge), caillouxEcart (1-10, how far they spread from the edge), "
           "caillouxColles (bool, some pebbles fused to the edge; default detached), hauteurMur, ombreMur, penombre, … — omitted ones take their default}}. "
           "read_tile_set returns the complete recipe with every default filled in.")
CARTE = ("map = optional list of rows of '#' (painted) and '.' (empty) — one character per cell, or per cell corner "
         "for coins-15 (rows+1 lines of columns+1); omitted, the screen's default test map is painted. pieces-17 takes "
         "no map: its delivered map lays the 17 pieces out as on the atlas.")


def installer_outils_tuiles(serveur: Any, atelier: Any, refus_lisible: Callable):
    meta = {"barre": {"verbe": "composer", "titre": "Composer les tuiles", "phrase": "Préparer un atlas et sa carte d’essai.",
                     "paiement": "gratuit", "ou": "sortie", "route": "", "besoins": []}}
    meta_matiere = {"barre": {"verbe": "generer", "titre": "Générer une matière", "phrase": "Une texture qui se raccorde, fabriquée sur la machine.",
                              "paiement": "gratuit", "ou": "sortie", "route": "", "besoins": []}}

    meta_liste_matieres = {"barre": {"verbe": "aller", "titre": "Voir les matières", "phrase": "Les textures du jeu, prêtes à poser dans une recette.",
                                     "paiement": "gratuit", "ou": "sortie", "route": "", "besoins": []}}

    def _projet(project):
        return project or atelier.bibliotheque.courant

    def _verifiee(projet, brute):
        return verifier_recette(brute, atelier.tuiles._asset_valide(projet))

    def _sans_carte_pour_17(r, carte):
        # Les 17 pièces n'ont pas de carte à peindre : la carte livrée les range comme
        # sur la planche (ServiceTuiles._carte_des_pieces).
        if r["sorte"] == "pieces-17" and carte is not None:
            raise TuilesRefusees("Les 17 pièces se posent à la main : elles n’ont pas de carte à peindre (map). "
                                 "La carte livrée les range comme sur la planche.")

    async def _verification(projet, tileset, revision):
        """La vérification des bords, ou pourquoi elle n'a pas pu se faire — jamais un refus
        de toute la lecture : sans Node, le reste du jeu se relit."""
        try:
            return await asyncio.to_thread(atelier.rendu_tuiles.verifier, projet, tileset, revision)
        except NodeAbsent as refus:
            return {"disponible": False, "raison": refus.raison}

    @serveur.tool(name="list_tile_sets", meta=meta, description="List durable tile sets with selected tiles, named terrain edges/corners, test map and revision history. `origine` is 'agent' for sets created through these tools, 'auteur' otherwise. No generation.")
    @refus_lisible
    async def lister(project: str): return atelier.tuiles.lister(project)

    @serveur.tool(name="read_tile_set", meta=meta, description="Read a tile set or a frozen historical revision, including atlas/map preview URLs. For a set made from a recipe, `verification` is the pixel-exact edge check of the stored atlas (the screen's tile-check, run by Node on the server): `propre`, `phrase`, and each `defauts[].en_clair`. A defect warns, it never blocks delivery. Without Node.js, `verification` says so and the rest is still returned. Never generates.")
    @refus_lisible
    async def lire(project: str, tileset: str, revision: int | None = None):
        lu = atelier.tuiles.lire(project, tileset, revision)
        if lu.get("recette") is not None:
            lu["verification"] = await _verification(project, tileset, revision)
        return lu

    @serveur.tool(name="create_tile_set", meta=meta, description=(
        "Create a tile set, two ways. (1) From a recipe — the tiles are cut by code from seamless materials, so every edge "
        "matches by construction: pass `recipe` (and optionally `map`). The server renders the atlas with the exact code the "
        "screen uses (Node.js required), checks its edges, derives every terrain/peering bit from the piece masks, and returns "
        "the set with `verification`. " + RECETTE + " " + CARTE + " (2) From an existing project image: pass `image` and "
        "`grid` {taille, marge, espacement} in pixels; all cells start unselected and terrains are declared by hand with "
        "update_tile_set. Either way it never calls a paid provider and costs nothing."))
    @refus_lisible
    async def creer(project: str, name: str, image: str | None = None, grid: dict[str, int] | None = None,
                    recipe: dict[str, Any] | None = None, map: list[str] | None = None):
        if recipe is None:
            if image is None or grid is None or map is not None:
                raise TuilesRefusees("Donnez soit une recette (recipe, et au besoin map), soit une image et sa grille (image, grid).")
            return atelier.tuiles.creer(project, {"nom": name, "image": image, "grille": grid}, origine=AGENT)
        if image is not None or grid is not None:
            raise TuilesRefusees("Un jeu fabriqué se crée par sa recette seule : l’atlas vient d’elle, pas d’une image.")
        projet = _projet(project)
        r = _verifiee(projet, recipe)
        _sans_carte_pour_17(r, map)
        rendu = await asyncio.to_thread(atelier.rendu_tuiles.rendre, projet, r, map)
        brut = {"nom": name, "recette": r, "atlas": rendu["png"]}
        if rendu["carte"] is not None:
            brut["carte"] = rendu["carte"]
        cree = atelier.tuiles.creer(project, brut, origine=AGENT)
        return {**cree, "verification": rendu["verification"]}

    @serveur.tool(name="update_tile_set", meta=meta, description=(
        "Save a new revision, guarded by the expected `revision`. For a set made from a recipe, correct it by sending a changed "
        "`recipe` (e.g. another material in a slot, or a setting): the server re-renders the atlas with the screen's code "
        "(Node.js required) and returns the fresh `verification`; `map` repaints the test map (same format as create_tile_set); "
        "`regles` may then only rename (nom) — its terrains and peering bits come from the recipe and cannot be edited. "
        "For a set made from an image, `regles` is required and complete {nom,terrains,cellules,carte}, as returned by "
        "read_tile_set; terrain IDs define tile center and eight named raccords; source PNG and corrections remain frozen "
        "unless refresh_sources is explicitly true. A test map is required before export. " + RECETTE + " Never generates."))
    @refus_lisible
    async def regler(project: str, tileset: str, revision: int, regles: dict[str, Any] | None = None, refresh_sources: bool = False,
                     recipe: dict[str, Any] | None = None, map: list[str] | None = None):
        actuel = atelier.tuiles.lire(project, tileset)
        if actuel.get("recette") is None:
            if recipe is not None or map is not None:
                raise TuilesRefusees("Un jeu fait à partir d’une image n’a pas de recette : réglez-le par regles.")
            if regles is None:
                raise TuilesRefusees("Envoyez les réglages complets du jeu (regles), tels que read_tile_set les rend.")
            return atelier.tuiles.regler(project, tileset, revision, regles, actualiser_source=refresh_sources)
        projet = _projet(project)
        brut = dict(regles or {})
        if recipe is None and map is None:
            return atelier.tuiles.regler(project, tileset, revision, brut, actualiser_source=refresh_sources)
        if recipe is None:
            _sans_carte_pour_17(actuel["recette"], map)
            brut["carte"] = await asyncio.to_thread(atelier.rendu_tuiles.carte, projet, actuel["recette"], map)
            return atelier.tuiles.regler(project, tileset, revision, brut, actualiser_source=refresh_sources)
        r = _verifiee(projet, recipe)
        _sans_carte_pour_17(r, map)
        rendu = await asyncio.to_thread(atelier.rendu_tuiles.rendre, projet, r, map if map is not None else False)
        if map is not None:
            brut["carte"] = rendu["carte"]
        regle = atelier.tuiles.regler(project, tileset, revision, brut, actualiser_source=refresh_sources,
                                      recette=r, atlas=rendu["png"])
        return {**regle, "verification": rendu["verification"]}

    @serveur.tool(name="generate_tile_material", meta=meta_matiere, description=(
        "Generate seamless materials (tileable textures: grass, flagstones, sand…) for a recipe-made tile set, on this "
        "machine through local ComfyUI with the fixed style klein9b-tiles-raccordable. It never calls a paid provider and "
        "costs no money, only local compute time (about 2 minutes per image). It is a durable agent job bounded by the agent's frame "
        "exactly like a local image (local compute allowed, permitted methods, call cap — set by the author in Settings); "
        "each draw is one call, and a refusal says what blocks it. `key` makes the request idempotent. `material` is what every material of the set is made of (shared stem), `pattern` the "
        "motif — name the count and size when it has one ('exactly four huge square flagstones, two by two'); `framing` is "
        "surface (floor seen from above), face (wall face), plat (flat material) or motif (regular pattern). "
        "`reference_image` optionally joins ONE library image id to steer the look: it is an edit reference, not img2img "
        "— the text still commands, the image orients, and the result stays seamless. With it the draw runs at 512px "
        "instead of 256, so it takes longer. Returns one "
        "generation per draw, each with its own seed; poll them with check_generation (or wait here with wait_seconds). "
        "Each finished draw is a library image of kind 'matière' and is already in the game's material library — no subject to "
        "create, nothing to declare; find it again at any time with list_materials. Put its id in a recipe slot as "
        "{source: 'asset', asset: id}. "
        "When ComfyUI, the style weights or the seamless nodes are missing, it refuses and says what to install."))
    @refus_lisible
    async def generer_matiere(material: str, pattern: str, framing: str = "surface", draws: int = 1,
                              seed: int | None = None, reference_image: str | None = None,
                              project: str | None = None, wait_seconds: float = 0.0,
                              key: str | None = None) -> dict[str, Any]:
        from atelier.mcp.serveur import ATTENTE_MAX, _generation_en_json
        projet = _projet(project)
        # Le cadre de l'agent, par le même chemin que ses images locales (RP2) : un
        # travail durable, dont le lancement relit le cadre (calcul local permis,
        # méthode permise, plafond d'appels) — et que le fournisseur ComfyUI relit
        # encore quand la carte graphique prend son tour.
        travail = await atelier.matieres.preparer_pour_agent(projet, pierre=material, motif=pattern, cadrage=framing,
                                                            tirages=draws, graine=seed, reference=reference_image,
                                                            cle=key)
        await atelier.travaux.demarrer(projet, travail["identifiant"], AGENT)
        attente = max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        if attente:
            await atelier.travaux.attendre(projet, travail["identifiant"], attente)
        sorties = []
        for gid in travail["generations_images"]:
            g = atelier.generations.lire(gid)
            sorties.append(_generation_en_json(atelier, g) if g else {"generation_id": gid, "status": "en_attente", "done": False,
                                                                       "cost_usd": 0.0, "images": [], "failures": []})
        return {"job": travail["identifiant"], "generations": sorties, "text": travail["texte"], "cost_usd": 0.0, "local": True}

    @serveur.tool(name="list_materials", meta=meta_liste_matieres, description=(
        "List the game's material library: the seamless textures made by generate_tile_material and every library image "
        "declared a material (edit_asset with material=true). Free, read-only, never generates, and it needs no subject — a "
        "material belongs to the game, not to a subject. Newest first. Each material carries `id` — exactly what goes in a "
        "tile recipe slot, as {source: 'asset', asset: id}, in create_tile_set or update_tile_set —, `name`, `framing` "
        "(surface = floor seen from above, face = wall face, plat = flat material, motif = regular pattern; empty for an "
        "image declared a material by hand, which never said how it was made), `width`, `height`, `path` (the file on "
        "disk, as in list_assets), `created` (unix time), `collections` [{id, name}] where the author filed it, `cut_out` "
        "(true when the image was cut out and cropped like a character, which a material must not be — made before the "
        "game's scale list knew materials) and `redoable` (cut_out and the original image is still on disk, so the game's "
        "material recipe can be applied again without generating: the author does it on the material's sheet, never "
        "automatically; false with cut_out true means only a new generation will do). "
        "`search` keeps the materials whose name contains that text, ignoring case; `limit` is 50 by default, 200 at "
        "most; `total` counts every match before the cut. `project` defaults to the open project."))
    @refus_lisible
    async def lister_matieres(project: str | None = None, search: str = "", limit: int = 50) -> dict[str, Any]:
        from atelier.mcp.serveur import _chemin, _projet_ouvert
        projet = _projet_ouvert(atelier, project)
        if not projet:
            raise TuilesRefusees("Aucun projet n’est ouvert : nommez-en un (project) — list_projects les liste.")
        # La même bibliothèque que l'écran (`ServiceBibliotheque.matieres`, RG5) : aucun sujet consulté.
        # Le nom se filtre ici parce que la recherche de la grille porte sur la demande, pas sur le nom.
        trouvees = atelier.bibliotheque.matieres(projet, limite=100_000)
        cherche = search.strip().lower()
        if cherche:
            trouvees = [a for a in trouvees if cherche in (a.label or "").lower()]
        gardees = trouvees[:max(1, min(int(limit), 200))]
        # **La fiche est celle de l'écran, écrite une seule fois** (`ServiceBibliotheque.fiches_de_matieres`,
        # que `GET /api/projects/{jeu}/materials` lit aussi) : dimensions du rendu, cadrage, collections,
        # `detouree` / `refaisable`. Ne se traduit ici que les mots ; seul `path` (le rendu, comme `list_assets`)
        # est à l'agent.
        matieres = []
        for asset, fiche in zip(gardees, atelier.bibliotheque.fiches_de_matieres(gardees)):
            matieres.append({
                "id": fiche["identifiant"],
                "name": fiche["nom"],
                "framing": fiche["cadrage"],
                "width": fiche["largeur"],
                "height": fiche["hauteur"],
                "path": _chemin(atelier, asset),
                "created": fiche["cree_le"],
                "collections": [{"id": c["identifiant"], "name": c["nom"]} for c in fiche["collections"]],
                "cut_out": fiche["detouree"],
                "redoable": fiche["refaisable"],
            })
        return {"materials": matieres, "total": len(trouvees)}

    @serveur.tool(name="extract_tile_for_editing", meta=meta,description="Copy one frozen atlas cell into the library with provenance for ordinary non-destructive retouching. Assign that returned image ID to cellule.correction in update_tile_set to reintegrate it. Exact tile dimensions required.")
    @refus_lisible
    async def extraire(project: str, tileset: str, x: int, y: int, revision: int):
        return atelier.tuiles.extraire(project, tileset, x, y, revision)

    @serveur.tool(name="restore_tile_set_revision", meta=meta, description="Restore a historical tile set snapshot as a new revision, guarded by current revision. Does not alter the game.")
    @refus_lisible
    async def restaurer(project: str, tileset: str, revision: int, from_revision: int):
        return atelier.tuiles.restaurer(project, tileset, revision, from_revision)

    @serveur.tool(name="preview_tile_delivery", meta=meta, description="Prepare native Godot 4.3+ TileSetAtlasSource and TileMapLayer files with tile terrain relationships, immutable atlas and provenance. Uses explicitly linked Godot project; preview writes nothing into the game. Publish the returned token using publish_animation_delivery, the shared delivery publisher. Export ZIP is also available at the tileset export.zip API route.")
    @refus_lisible
    async def livrer(project: str, tileset: str, revision: int):
        return atelier.tuiles.prevoir_livraison(project, tileset, revision)
