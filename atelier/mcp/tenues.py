"""Tenues : choix explicites, aperçus CPU et paquets de livraison communs."""
from typing import Any
from urllib.parse import quote


def installer_tenues(serveur, atelier, refus):
    def meta(titre, verbe="travailler"):
        return {"barre": {"titre": titre, "phrase": "Conserve et combine les calques précis du personnage.",
            "verbe": verbe, "paiement": "gratuit", "ou": "equipements", "route": "", "besoins": ["personnages"]}}

    @serveur.tool(name="list_character_outfits", meta=meta("Retrouver les tenues"), description="List a character's saved outfits with exact layer snapshots and missing/stale frame coverage. No generation.")
    @refus
    async def lister(project: str, character: str) -> list[dict[str, Any]]:
        return atelier.tenues.lister(project, character)

    @serveur.tool(name="create_character_outfit", meta=meta("Composer une tenue"), description="Save an outfit with exact base outputs and equipment employments. Request: nom, resultats [{nature:image|animation,identifiant,boucle}], emplois [{piece,emploi,actif,priorite}], optional pivot {x,y}, choix {target_hash:{piece:layer}}. Retained layers are snapshotted, not followed live. Missing layers are reported, never substituted. CPU only.")
    @refus
    async def creer(project: str, character: str, request: dict[str, Any]) -> dict[str, Any]:
        return atelier.tenues.creer(project, character, request)

    @serveur.tool(name="get_character_outfit", meta=meta("Relire une tenue"), description="Read a saved outfit or one of its immutable revisions. Returns exact frames, equipment layer revisions, masks, placement, coverage and preview routes.")
    @refus
    async def lire(project: str, character: str, outfit: str, revision: int | None = None) -> dict[str, Any]:
        objet = atelier.tenues.lire(project, character, outfit, revision)
        prefixe = f"/api/projects/{quote(project, safe='')}/characters/{quote(character, safe='')}/outfits/{outfit}"
        objet["apercu"] = prefixe + "/preview.png?sortie={cle_sortie}&frame={rang}&revision=" + str(objet["revision"])
        objet["archive"] = prefixe + "/export.zip?mode=couches&revision=" + str(objet["revision"])
        return objet

    @serveur.tool(name="edit_character_outfit", meta=meta("Régler une tenue"), description="Save a new outfit revision with explicit active equipment/order/base outputs. Existing exact layer snapshots remain frozen; changing favorites never replaces them. Supply current revision to reject concurrent edits.")
    @refus
    async def regler(project: str, character: str, outfit: str, revision: int, request: dict[str, Any]) -> dict[str, Any]:
        return atelier.tenues.regler(project, character, outfit, revision, request)

    @serveur.tool(name="refresh_character_outfit", meta=meta("Actualiser les calques d'une tenue"), description="Explicitly capture current base outputs and retained equipment layers into a NEW outfit revision. Previous pixels and corrections remain available in its old revisions. Review coverage before delivery.")
    @refus
    async def actualiser(project: str, character: str, outfit: str, revision: int) -> dict[str, Any]:
        return atelier.tenues.actualiser(project, character, outfit, revision)

    @serveur.tool(name="restore_character_outfit", meta=meta("Restaurer une tenue conservée"), description="Restore an old outfit snapshot as a NEW current revision, preserving all versions. current_revision rejects concurrent edits. Does not follow today's favorites or replace an existing Godot delivery.")
    @refus
    async def restaurer(project: str, character: str, outfit: str, current_revision: int, from_revision: int) -> dict[str, Any]:
        return atelier.tenues.restaurer(project, character, outfit, current_revision, from_revision)

    @serveur.tool(name="preview_outfit_delivery", meta=meta("Relire la livraison d'une tenue", "livrer"), description="Prepare a saved outfit's Godot package without writing to the game. mode=couches exports synchronized combinable layers and per-piece body masks; assemble exports the saved active combination. Missing/stale frames block export. Uses the linked project's existing ownership/conflict/recovery rules; then call publish_animation_delivery with the returned token.")
    @refus
    async def prevoir(project: str, character: str, outfit: str, mode: str = "couches", revision: int | None = None) -> dict[str, Any]:
        return atelier.tenues.prevoir_livraison(project, character, outfit, mode, revision)
