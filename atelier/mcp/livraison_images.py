"""La sélection d’une image fixe utilise la même livraison que l’auteur."""
from typing import Any, Callable

def installer_outils_livraison_images(serveur: Any, atelier: Any, refus_lisible: Callable) -> None:
    meta = {"barre": {"verbe": "sortir", "titre": "Préparer les images pour Godot",
                      "phrase": "Réutiliser une image existante et relire ses fichiers.", "paiement": "gratuit",
                      "ou": "sortie", "route": "", "besoins": []}}
    @serveur.tool(name="list_image_delivery_versions", meta=meta, description=
        "Find existing fixed-image versions for an asset in a project before requesting new generation. Returns images, family and suggested Godot usage. No provider calls.")
    @refus_lisible
    async def list_image_delivery_versions(project: str, character: str) -> dict[str, Any]:
        return atelier.livraison_images.images(project, character)

    @serveur.tool(name="preview_image_delivery", meta=meta, description=
        "Prepare a fixed image for the explicitly linked Godot 4 project: Sprite2D for usage monde, TextureRect for interface, with a native Texture2D resource. Pivot uses exported pixels. Returns immutable preview, file conflicts and stable scene. Publish with publish_animation_delivery, which is the shared publication operation for all prepared delivery tokens. No generation or game writes during preview.")
    @refus_lisible
    async def preview_image_delivery(project: str, character: str, image: str, usage: str = "monde",
                                     pivot_x: float | None = None, pivot_y: float | None = None) -> dict[str, Any]:
        return atelier.livraison_images.prevoir(project, character, image, usage=usage, pivot_x=pivot_x, pivot_y=pivot_y)
