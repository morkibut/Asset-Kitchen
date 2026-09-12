"""Outils agent de livraison : chaque opération appelle le service de l'écran."""

from typing import Any, Callable


def installer_outils_livraison(serveur: Any, atelier: Any, refus_lisible: Callable) -> None:
    def fiche(titre: str, phrase: str, verbe: str = "sortir") -> dict[str, Any]:
        return {"barre": {"verbe": verbe, "titre": titre, "phrase": phrase,
                          "paiement": "gratuit", "ou": "sortie", "route": "",
                          "besoins": ["personnages"]}}

    @serveur.tool(name="list_animation_deliveries",
                  meta=fiche("Relire les livraisons Godot", "Les versions livrées et leurs fichiers."), description=
                  "Read a project's explicit Godot link, delivery history, and available animation strips. No generation.")
    @refus_lisible
    async def list_animation_deliveries(project: str, character: str | None = None) -> dict[str, Any]:
        return {**atelier.livraison.historique(project),
                "animations": atelier.livraison.animations(project, character)}

    @serveur.tool(name="link_godot_project",
                  meta=fiche("Associer le projet Godot", "Choisir le dossier existant du jeu.", "regler"), description=
                  "Explicitly associate an Asset Kitchen project with an existing Godot 4 project folder. "
                  "Use the author's chosen folder, never invent one. Does not write into the Godot project.")
    @refus_lisible
    async def link_godot_project(project: str, directory: str,
                                 subdirectory: str = "assets/asset-kitchen") -> dict[str, Any]:
        return atelier.livraison.associer(project, directory, subdirectory)

    @serveur.tool(name="preview_animation_delivery",
                  meta=fiche("Préparer les animations pour Godot", "Relire les fichiers, les réglages et les conflits."), description=
                  "Prepare existing animation strips for the linked Godot project. Returns immutable preview token, "
                  "files, conflicts, stable scene path, SpriteFrames path and playback settings. "
                  "Preserves previously delivered movements and directions not replaced by this selection. "
                  "Pivot is in output frame pixels. No provider calls or writes into the game.")
    @refus_lisible
    async def preview_animation_delivery(project: str, character: str, strips: list[str],
                                         pivot_x: float | None = None, pivot_y: float | None = None,
                                         loops: dict[str, bool] | None = None) -> dict[str, Any]:
        return atelier.livraison.prevoir(project, character, strips, pivot_x=pivot_x,
                                         pivot_y=pivot_y, boucles=loops)

    @serveur.tool(name="publish_animation_delivery",
                  meta=fiche("Publier la livraison relue", "Livrer exactement les fichiers de la préparation."), description=
                  "Publish exactly the prepared delivery token into the explicitly linked game. "
                  "Unknown or manually modified game files are never replaced. Repeat the same token "
                  "to recover an interrupted delivery or a lost response without generation.")
    @refus_lisible
    async def publish_animation_delivery(project: str, token: str) -> dict[str, Any]:
        return atelier.livraison.livrer(project, token)

    @serveur.tool(name="preview_delivery_revision",
                  meta=fiche("Reprendre une révision livrée", "Relire une ancienne version avant de la remettre dans le jeu."), description=
                  "Prepare an exact previously delivered revision for restoration, without changing the game yet. "
                  "Returns a new preview token to publish. Keeps the historical pixels and settings even if "
                  "the source strips changed. Requires the same explicitly linked Godot folder.")
    @refus_lisible
    async def preview_delivery_revision(project: str, token: str) -> dict[str, Any]:
        return atelier.livraison.reprendre(project, token)
