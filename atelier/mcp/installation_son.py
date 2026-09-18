"""Outils MCP : installer les méthodes sonores, lire le moteur par défaut
d'une famille (SN1). Fichier neuf, à dessein — `atelier/mcp/workflows.py` est
modifié ailleurs en ce moment (docs/PLAN-son.md, cadre de la tranche) ; on ne
lui ajoute rien, on l'inscrit à part dans `atelier/mcp/serveur.py`."""
from __future__ import annotations

from typing import Any


def installer_outils_installation_son(serveur: Any, atelier: Any, refus_lisible) -> None:
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Installe les méthodes sonores de l'atelier.",
            "verbe": "installer", "paiement": "gratuit", "ou": "workflows", "route": "", "besoins": []}}

    @serveur.tool(name="install_sound_methods", meta=meta("Installer les méthodes sonores"),
        description="Install Asset Kitchen's built-in sound engines (Small-SFX, Medium, ACE-Step 1.5, "
        "YuE2, Stable Audio Open) by locating each one's weight files against ComfyUI's /object_info and "
        "importing the matching profile. An engine missing a file is not installed and comes back with "
        "exactly what is missing. Nothing is ever downloaded or written to ComfyUI. Installing twice "
        "without change never creates a new version.")
    @refus_lisible
    async def install_sound_methods(engines: list[str] | None = None) -> dict[str, Any]:
        return await atelier.installation_son.installer(engines)

    @serveur.tool(name="get_sound_engine_defaults", meta=meta("Lire les moteurs sonores par défaut"),
        description="Read the default sound engine for each family (sfx, ambience, music, jingle, song, "
        "fallback), among the engines currently installed. Used to pick a model before preparing a sound.")
    @refus_lisible
    def get_sound_engine_defaults() -> dict[str, Any]:
        return {"familles": atelier.installation_son.moteurs_par_famille()}
