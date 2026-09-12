"""Façade MCP de la file GPU, sans commande globale de moteur."""

from typing import Any

def installer_outils_file_locale(serveur, atelier, refus_lisible):
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Ouvre le suivi des fabrications locales.", "verbe": "travailler", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="get_local_queue", meta=meta("Lire la file locale"), description="Read owned local GPU stages and engine diagnostics. Unknown engine state never means the GPU is free. No generation, installation or download.")
    @refus_lisible
    async def get_local_queue() -> dict[str, Any]:
        return {**atelier.file_locale.lister(), "moteurs": await atelier.file_locale.observer(), "mesures": atelier.file_locale.mesures()}

    @serveur.tool(name="resume_local_stage", meta=meta("Reprendre le suivi local"), description="Resume an existing agent-owned GPU stage using its saved input and external job ID. Never submits an uncertain request again.")
    @refus_lisible
    async def resume_local_stage(stage: str, wait_seconds: float = 0) -> dict[str, Any]:
        await atelier.file_locale.lancer(stage, reprise=True, acteur="agent")
        return await atelier.file_locale.attendre(stage, wait_seconds)

    @serveur.tool(name="cancel_local_stage", meta=meta("Annuler une attente locale"), description="Cancel an agent-owned GPU stage before submission. Running engines without targeted cancellation are refused; no global interrupt is ever sent.")
    @refus_lisible
    async def cancel_local_stage(stage: str) -> dict[str, Any]:
        return atelier.file_locale.annuler(stage, acteur="agent")
