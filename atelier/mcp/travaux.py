"""Demandes complètes d'animations, sous le cadre écrit par l'auteur."""

from typing import Any, Callable

from atelier.domaine.travail import TravailRefuse


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
                  "secondes, resolution, proportions, nombre_images, cadence, sens, plafond_image_usd, livrer_provisoire, "
                  "part_sujet (how much of the canvas the subject fills before the video call, 0.40-0.95, default 0.80 — "
                  "raise it for a big attack whose limbs must not leave the frame, lower it to leave more room around the subject), "
                  "mouvement (a library movement whose text is composed server-side), correction_geste (a per-call correction to that movement's gesture), "
                  "style_combat (optional combat style identifier checked for this request; its text for each case's movement replaces the movement text — "
                  "nothing is applied by default; the character's proposed styles are listed by the for-pose composition). "
                  "Optional directions (a list of direction identifiers; replaces the single direction with several cases) "
                  "and nombre (1 to 8 clips per case) request a series instead of a single clip: request uses preparer_serie "
                  "then demarrer_serie, launched all-or-nothing for the agent's budget, and the result carries serie, travaux and annonce_serie. "
                  "Without directions or nombre, the call behaves exactly as before and returns a single job. "
                  "Repeat the same key and identical content to retrieve the job. A changed request needs a new key. "
                  "All calls require the current delegation policy; wait is bounded to 30 seconds. "
                  "An externally uncertain submission is never resubmitted automatically.")
    @refus_lisible
    async def request_character_animation(project: str, request: dict[str, Any], wait_seconds: float = 0) -> dict[str, Any]:
        if not isinstance(request, dict):
            raise TravailRefuse("Une fabrication doit contenir des réglages nommés.")
        directions = request.get("directions")
        nombre = request.get("nombre", 1)
        if directions is not None or (isinstance(nombre, int) and not isinstance(nombre, bool) and nombre != 1):
            if directions is not None and (not isinstance(directions, list) or any(not isinstance(d, str) for d in directions)):
                raise TravailRefuse("« directions » doit être une liste de directions.")
            commune = {k: v for k, v in request.items() if k not in ("directions", "nombre", "pose", "direction")}
            cases = [{"pose": request.get("pose"), "direction": d} for d in directions] if directions is not None else \
                    [{"pose": request.get("pose"), "direction": request.get("direction", "")}]
            serie = await atelier.travaux.preparer_serie(project, commune, cases, nombre, "agent")
            await atelier.travaux.demarrer_serie(project, serie["serie"]["cle"], "agent")
            return await atelier.travaux.attendre_serie(project, serie["serie"]["cle"], wait_seconds)
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
