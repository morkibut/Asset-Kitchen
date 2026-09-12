"""Les fabrications d'équipements de l'agent suivent le même cadre et les mêmes cibles."""
from typing import Any


def installer_travaux_equipement(serveur, atelier, refus):
    def meta(titre, paiement="gratuit"):
        return {"barre": {"titre": titre, "phrase": "Ouvre les fabrications d'images équipées et leur suivi.",
            "verbe": "équiper", "paiement": paiement, "ou": "fabrications", "route": "", "besoins": ["personnages"]}}

    @serveur.tool(name="get_equipment_coverage", meta=meta("Voir les calques manquants"), description=
        "Read separate still and animation equipment coverage for a character use. Missing animations never invent frames. "
        "Only requested outputs with chosen body versions count. Optional results explicitly selects existing body versions.")
    @refus
    async def get_equipment_coverage(project: str, piece: str, employment: str, results: list[str] | None = None) -> dict[str, Any]:
        return atelier.travaux_equipement.couverture.lire(project, piece, employment, resultats=results)

    @serveur.tool(name="preview_equipment_production", meta=meta("Relire les images équipées à fabriquer"), description=
        "Prepare, without a provider call, exact equipment target images packed through the existing 2D folding pipeline. "
        "Returns immutable body/reference previews, resolved prompts, model, images/sheets/calls counts and announced consumption. "
        "French request fields: cle, modele; optional cibles (nature/resultat/prise), resultats, methode (planches/images), "
        "cases_par_planche, prompt, prompt_negatif, repris, options, resolution, proportions (1:1), references, "
        "references_ecartees, tri, occupation, reservation_par_appel_usd. Omitted cibles selects absent layers on chosen bases. "
        "A new key is required to edit a prepared request. Video/3D sources use rendered 2D frames, never an identical-motion claim.")
    @refus
    async def preview_equipment_production(project: str, piece: str, employment: str, request: dict[str, Any]) -> dict[str, Any]:
        return await atelier.travaux_equipement.preparer(project, piece, employment, request, "agent")

    @serveur.tool(name="start_equipment_production", meta=meta("Fabriquer les images équipées", "a-confirmer"), description=
        "Start a reviewed equipment job under the author's current shared delegation budget. A sheet is one call. "
        "Received images become new equipped source variants requiring extraction and inspection. Never replaces retained layers. "
        "Resume only unfolds already received sheets or sends calls never submitted; externally uncertain calls are never resubmitted.")
    @refus
    async def start_equipment_production(project: str, piece: str, employment: str, job: str, resume: bool = False, wait_seconds: float = 0) -> dict[str, Any]:
        atelier.travaux_equipement._brut_emploi(project, piece, employment, job)
        await atelier.travaux.demarrer(project, job, "agent", reprise=resume)
        return await atelier.travaux.attendre(project, job, wait_seconds)

    @serveur.tool(name="cancel_equipment_production", meta=meta("Arrêter les appels d'équipement restants"), description=
        "Cancel equipment calls that have not yet started. In-flight results and actual consumption remain recorded. "
        "Unknown provider acceptance keeps its budget reservation and is never retried automatically.")
    @refus
    async def cancel_equipment_production(project: str, piece: str, employment: str, job: str) -> dict[str, Any]:
        return atelier.travaux_equipement.annuler(project, piece, employment, job, "agent")
