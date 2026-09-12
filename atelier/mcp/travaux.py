"""Demandes complètes d'animations, sous le cadre écrit par l'auteur."""

from typing import Any, Callable


def installer_outils_travaux(serveur: Any, atelier: Any, refus_lisible: Callable):
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Ouvre les fabrications et leur suivi.",
                          "verbe": "travailler", "paiement": "gratuit", "ou": "fabrications",
                          "route": "", "besoins": ["personnages"]}}

    @serveur.tool(name="get_animation_production", meta=meta("Suivre les animations demandées"), description=
                  "Read production jobs and the author's delegation policy. Never modifies the budget or permissions. "
                  "A known job can be followed with a bounded wait of at most 30 seconds.")
    @refus_lisible
    async def get_animation_production(project: str, job: str | None = None, wait_seconds: float = 0) -> dict[str, Any]:
        if job:
            return await atelier.travaux.attendre(project, job, wait_seconds)
        return {"cadre": atelier.travaux.cadre(project), "travaux": atelier.travaux.lister(project)}

    @serveur.tool(name="request_character_animation", meta=meta("Demander une animation complète"), description=
                  "Produce an existing character's requested movement and direction: reuse or generate its reference, "
                  "generate a video, keep a frame strip, optionally deliver provisionally under the author's policy. "
                  "request uses French fields: cle, personnage, pose, direction, modele_video, prompt_video; "
                  "optional reference_asset, modele_image, prompt_image, repris_image, references_image, references_image_ecartees, options_image, options_video, "
                  "prompt_negatif_image, proportions_image, resolution_image, "
                  "secondes, resolution, proportions, nombre_images, cadence, sens, plafond_image_usd, livrer_provisoire. "
                  "Repeat the same key and identical content to retrieve the job. A changed request needs a new key. "
                  "All calls require the current delegation policy; wait is bounded to 30 seconds. "
                  "An externally uncertain submission is never resubmitted automatically.")
    @refus_lisible
    async def request_character_animation(project: str, request: dict[str, Any], wait_seconds: float = 0) -> dict[str, Any]:
        travail = await atelier.travaux.preparer(project, request, "agent")
        await atelier.travaux.demarrer(project, travail["identifiant"], "agent")
        return await atelier.travaux.attendre(project, travail["identifiant"], wait_seconds)

    @serveur.tool(name="resume_animation_production", meta=meta("Reprendre le suivi d'une animation"), description=
                  "Resume a known animation job using already received files or its existing external job ID. "
                  "Never starts a second paid submission. Unknown external acceptance requires inspection instead.")
    @refus_lisible
    async def resume_animation_production(project: str, job: str, wait_seconds: float = 0) -> dict[str, Any]:
        await atelier.travaux.demarrer(project, job, "agent", reprise=True)
        return await atelier.travaux.attendre(project, job, wait_seconds)
