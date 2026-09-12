"""Tuiles manipulées par l’agent avec le même service que l’auteur."""
from typing import Any, Callable

def installer_outils_tuiles(serveur: Any, atelier: Any, refus_lisible: Callable):
    meta = {"barre": {"verbe": "composer", "titre": "Composer les tuiles", "phrase": "Préparer un atlas et sa carte d’essai.",
                     "paiement": "gratuit", "ou": "sortie", "route": "", "besoins": []}}
    @serveur.tool(name="list_tile_sets", meta=meta, description="List durable tile sets with selected tiles, named terrain edges/corners, test map and revision history. No generation.")
    @refus_lisible
    async def lister(project: str): return atelier.tuiles.lister(project)

    @serveur.tool(name="read_tile_set", meta=meta, description="Read a tile set or a frozen historical revision, including atlas/map preview URLs.")
    @refus_lisible
    async def lire(project: str, tileset: str, revision: int | None = None): return atelier.tuiles.lire(project, tileset, revision)

    @serveur.tool(name="create_tile_set", meta=meta, description="Create a square orthogonal atlas from an existing project image. grid uses taille, marge, espacement in pixels. All cells initially unselected. Import or use image generation before this operation; it never calls a provider.")
    @refus_lisible
    async def creer(project: str, name: str, image: str, grid: dict[str, int]):
        return atelier.tuiles.creer(project, {"nom": name, "image": image, "grille": grid})

    @serveur.tool(name="update_tile_set", meta=meta, description="Save a new revision with expected revision and complete regles {nom,terrains,cellules,carte}, as returned by read_tile_set. Terrain IDs define tile center and eight named raccords. Source PNG and corrections remain frozen unless refresh_sources is explicitly true. Test map is required before export.")
    @refus_lisible
    async def regler(project: str, tileset: str, revision: int, regles: dict[str, Any], refresh_sources: bool = False):
        return atelier.tuiles.regler(project, tileset, revision, regles, actualiser_source=refresh_sources)

    @serveur.tool(name="extract_tile_for_editing", meta=meta, description="Copy one frozen atlas cell into the library with provenance for ordinary non-destructive retouching. Assign that returned image ID to cellule.correction in update_tile_set to reintegrate it. Exact tile dimensions required.")
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
