def installer_sources_3d(serveur, atelier, refus):
    def fiche(titre):
        return {"barre": {"titre": titre, "phrase": "Consulte les sources 3D et leurs copies dans le jeu.", "verbe": "travailler", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="list_3d_sources", meta=fiche("Lire les sources 3D"), description="List copied 3D sources in an existing game, even if the external engine is offline. Sources include immutable render settings, files and editable sprite animation IDs. Does not generate.")
    @refus
    async def list_3d_sources(project: str, character: str | None = None) -> dict:
        return {"sources": atelier.sources_3d.lister(project, character)}

    @serveur.tool(name="get_asset3d_catalogue", meta=fiche("Lire les réglages 3D"), description="Read the configured engine's supported model engines, animations, camera angles, styles, lighting and numeric bounds. Read-only; never installs weights or starts a calculation. Use these values to prepare_3d_stage.")
    @refus
    async def get_asset3d_catalogue() -> dict:
        return await atelier.sources_3d.moteur().catalogue()

    @serveur.tool(name="get_asset3d_rig_corrections", meta=fiche("Lire les corrections du squelette"), description="Read native bone and rotation-axis names, numeric bounds, current corrections and modification date for one external character. Read-only, no GPU work. Corrections affect future renders and the live GLB preview, never already retained renders.")
    @refus
    async def get_asset3d_rig_corrections(character: str) -> dict:
        return await atelier.sources_3d.moteur().corrections(character)

    @serveur.tool(name="set_asset3d_rig_corrections", meta=fiche("Corriger le squelette"), description="Save rotations by bone using the exact bone/axis catalogue from get_asset3d_rig_corrections. corrections maps bone IDs to numeric angles in degrees; {} resets all rotations. Optional animation must be in the engine catalogue. Refreshes the live GLB preview with CPU Blender; no GPU or AI generation. Applies only to future renders, preserving all retained render snapshots. Active stages on this character may refuse this change.")
    @refus
    async def set_asset3d_rig_corrections(character: str, corrections: dict, animation: str | None = None) -> dict:
        return await atelier.sources_3d.moteur().poser_corrections(character, corrections, animation)

    @serveur.tool(name="list_asset3d_characters", meta=fiche("Consulter asset3d"), description="Read the configured local asset3d character library. Does not start or install the engine or download model weights.")
    @refus
    async def list_asset3d_characters() -> dict:
        return {"personnages": await atelier.sources_3d.moteur().personnages()}

    @serveur.tool(name="list_asset3d_renders", meta=fiche("Lire les rendus 3D"), description="Read existing renders for one asset3d character. Use the returned render ID to import an existing finished frame sequence.")
    @refus
    async def list_asset3d_renders(character: str) -> dict:
        return {"rendus": await atelier.sources_3d.moteur().rendus(character)}

    @serveur.tool(name="import_asset3d_render", meta=fiche("Importer un rendu 3D"), description="Copy an existing asset3d render to this game without GPU generation. request:{personnage_externe,rendu,personnage?,pose?,direction?,nom?,cadence?,sens?}. Native transparent PNG frames and available GLB/rig files are retained. Repeating the same import returns the same animation; changing its target creates a separate animation.")
    @refus
    async def import_asset3d_render(project: str, request: dict) -> dict:
        return await atelier.sources_3d.importer(project, request, acteur="agent")

    @serveur.tool(name="prepare_3d_stage", meta=fiche("Préparer une étape 3D"), description="Prepare exactly one local 3D stage without starting it. request:{cle,etape:modele_3d|rig|rendu,personnage?,reference_asset? for model,personnage_externe? for rig/render,reglages,pose?,direction?,cadence?,nom?}. Read the engine catalogue first. Image-to-model requires an existing game image. Start and resume with the shared production job tools; heavy stages never chain implicitly.")
    @refus
    async def prepare_3d_stage(project: str, request: dict) -> dict:
        return await atelier.travaux_3d.preparer(project, request, acteur="agent")

    @serveur.tool(name="reconcile_3d_stage", meta=fiche("Retrouver une étape 3D"), description="Resolve a lost 3D submission response by its saved idempotency key. Read-only on the external engine: never resubmits. Resume the recovered production job explicitly.")
    @refus
    async def reconcile_3d_stage(project: str, job: str) -> dict:
        return await atelier.travaux_3d.reconcilier(project, job)
