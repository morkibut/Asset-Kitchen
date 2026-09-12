"""Façade MCP AU15 : les mêmes emplois, cibles et variantes que l'interface."""
from typing import Any


def installer_calques_cibles(serveur, atelier, refus):
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Ouvre les calques de l'emploi d'un équipement.",
            "verbe": "équiper", "paiement": "gratuit", "ou": "equipements", "route": "", "besoins": ["personnages"]}}

    @serveur.tool(name="list_equipment_targets", meta=meta("Voir les images à équiper"), description="List an equipment use's exact image and animation frame targets, variants and preserved historical pose layers. Free and offline.")
    @refus
    async def list_equipment_targets(project: str, piece: str, employment: str) -> dict[str, Any]:
        return atelier.calques_cibles.cibles(project, piece, employment)

    @serveur.tool(name="get_equipment_layer", meta=meta("Relire un calque d'équipement"), description="Read one equipment layer variant and whether its precise base still matches. Never substitutes another frame or character.")
    @refus
    async def get_equipment_layer(project: str, piece: str, employment: str, layer: str) -> dict[str, Any]:
        return atelier.calques_cibles.lire(project, piece, employment, layer)

    @serveur.tool(name="create_equipment_layer", meta=meta("Associer une image d'équipement"), description="Attach a library image to a precise equipment target. Role is reference, source-equipee (equipped character awaiting extraction), or calque (transparent layer). Nothing is validated implicitly. Free.")
    @refus
    async def create_equipment_layer(project: str, piece: str, employment: str, target: dict[str, Any], source: str, role: str) -> dict[str, Any]:
        return atelier.calques_cibles.creer(project, piece, employment, target, source, role)

    @serveur.tool(name="edit_equipment_layer", meta=meta("Corriger un calque d'équipement"), description="Edit a targeted layer placement or its independent layer/body/behind masks. Supply its current revision; concurrent edits are refused. Editing requires a fresh visual validation.")
    @refus
    async def edit_equipment_layer(project: str, piece: str, employment: str, layer: str, revision: int,
                                   placement: dict[str, Any] | None = None, masks: dict[str, Any] | None = None) -> dict[str, Any]:
        return atelier.calques_cibles.regler(project, piece, employment, layer, revision, placement=placement, masques=masks)

    @serveur.tool(name="extract_equipment_layer", meta=meta("Extraire un calque d'équipement"), description="Extract a new transparent layer from an equipped source and its saved base using the existing CPU difference tool. Both originals and previous variants remain. This is not visual approval.")
    @refus
    async def extract_equipment_layer(project: str, piece: str, employment: str, layer: str,
                                      settings: dict[str, Any] | None = None, auto_align: bool = False) -> dict[str, Any]:
        return atelier.calques_cibles.extraire(project, piece, employment, layer, reglage=settings, automatique=auto_align)

    @serveur.tool(name="adopt_equipment_layer_base", meta=meta("Rattacher un calque à sa nouvelle base"), description="Explicitly adopt a new base for a layer after a frame or its rendering changed. Keeps all masks and placement, archives the old base, and requires visual validation.")
    @refus
    async def adopt_equipment_layer_base(project: str, piece: str, employment: str, layer: str, revision: int, target: dict[str, Any]) -> dict[str, Any]:
        return atelier.calques_cibles.adopter(project, piece, employment, layer, revision, target)

    @serveur.tool(name="validate_equipment_layer", meta=meta("Retenir un calque d'équipement"), description="After visual inspection, retain a transparent layer for its exact target. Rejects an equipped source or a changed/missing base. Preserves every previous variant.")
    @refus
    async def validate_equipment_layer(project: str, piece: str, employment: str, layer: str, revision: int) -> dict[str, Any]:
        return atelier.calques_cibles.valider(project, piece, employment, layer, revision)
