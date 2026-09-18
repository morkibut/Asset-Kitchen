"""L'agent emploie les profils importés par l'auteur et son cadre durable."""
from typing import Any


def installer_outils_workflow(serveur, atelier, refus_lisible):
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Relit les workflows et prépare une fabrication locale.", "verbe": "travailler", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="list_workflow_profiles", meta=meta("Lire les workflows locaux"), description="Read explicitly imported versioned local image/video/audio workflow profiles, exact input bindings, reference counts and parameters. Does not install or run anything.")
    @refus_lisible
    async def list_workflow_profiles() -> dict[str, Any]:
        return {"profils": atelier.profils_workflow.lister()}

    @serveur.tool(name="diagnose_workflow_profile", meta=meta("Vérifier un workflow local"), description="Read ComfyUI node and model prerequisites for one immutable workflow version. Never installs nodes, packages or model weights.")
    @refus_lisible
    async def diagnose_workflow_profile(profile: str, version: str) -> dict[str, Any]:
        return await atelier.profils_workflow.diagnostiquer(profile, version)

    @serveur.tool(name="prepare_workflow_image", meta=meta("Préparer une image locale"), description="Prepare an agent-owned durable local image request without submitting it. Requires request key, exact versioned model, prompt, optional reference asset IDs and options. Read the snapshot; start and resume with the same production job tools as animations.")
    @refus_lisible
    async def prepare_workflow_image(project: str, request: dict[str, Any]) -> dict[str, Any]:
        return await atelier.travaux_workflow.preparer(project, request, "agent")

    @serveur.tool(name="prepare_free_video", meta=meta("Préparer un clip libre"), description="Prepare a durable agent-owned video without a character or animation objective. A starting image is mandatory: provide reference_asset or an image model and prompt. The completed source clip enters the gallery for later montage and classification. Uses the same start/resume production job tools and delegation budget.")
    @refus_lisible
    async def prepare_free_video(project: str, request: dict[str, Any]) -> dict[str, Any]:
        return await atelier.travaux.preparer(project, request, "agent", source_libre=True)

    @serveur.tool(name="install_local_styles", meta=meta("Installer les styles locaux"), description="List the 22 built-in local sc-clone styles (family, kind, speed, readiness) and install every style whose required ComfyUI files and nodes are already present. Never downloads model weights; a style missing files stays uninstalled and is reported with what's missing.")
    @refus_lisible
    async def install_local_styles() -> dict[str, Any]:
        styles = await atelier.styles_locaux.lister()
        installes = await atelier.styles_locaux.installer_prets()
        await atelier.catalogue.rafraichir()
        return {"styles": styles, "installes": installes}

    @serveur.tool(name="prepare_audio", meta=meta("Préparer un bruitage"), description="Prepare a durable local sound job without starting it. request:{cle,modele,prompt,secondes,nom?,prompt_negatif?,options?}. Use an imported audio workflow and its declared duration/options. Read the exact snapshot then use shared production start/resume tools. Result is stored in the audio library, never automatically approved or delivered.")
    @refus_lisible
    async def prepare_audio(project: str, request: dict[str, Any]) -> dict[str, Any]:
        return await atelier.travaux_audio.preparer(project, request, "agent")
