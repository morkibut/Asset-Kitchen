"""SN6 : l'agent lit les sons d'un sujet, pose un jeu sur un emplacement, et
demande une série depuis un emplacement. Mêmes services que l'écran ; l'agent
est l'acteur « agent », donc son cadre de délégation s'applique à chaque tirage.
"""
from typing import Any


def installer_sons_du_sujet(serveur, atelier, refus):
    def meta(titre, verbe="travailler", ou="codex"):
        return {"barre": {"titre": titre, "phrase": "Range les sons d'un sujet dans ses emplacements, et les livre avec lui.",
            "verbe": verbe, "paiement": "gratuit", "ou": ou, "route": "", "besoins": []}}

    @serveur.tool(name="list_subject_sounds", meta=meta("Relire les sons d'un sujet"), description=(
        "List a subject's sound slots (e.g. footsteps 'pas', 'attaque', 'coup_recu', 'mort', 'replique' for a character; "
        "'ramasser', 'utiliser' for an item; 'ambiance' for a scenery; 'clic', 'survol'... for an interface element), "
        "proposed by the subject's family, plus slots named by hand. Each slot: its sound family, what fills it "
        "(a variant set or a single sound, with the sounds that would be delivered and any flags), its stable name in the "
        "game (sfx_pelerin_pas) and the series launched from it (last one included). Without subject: every filled slot "
        "of the project. A sound without subject stays a sound of the game."))
    @refus
    async def list_subject_sounds(project: str, subject: str | None = None) -> Any:
        return atelier.sons_du_sujet.lire(project, subject) if subject else atelier.sons_du_sujet.index(project)

    @serveur.tool(name="edit_subject_sound_slot", meta=meta("Ranger un son dans un emplacement", "regler"), description=(
        "Change a subject's sound slots. request: {add: {nom, famille}} names a new slot; {slot, set: {jeu: id} or "
        "{son: id}} fills it with a variant set or one sound (no sound is refused for a measurement); {slot, clear: true} "
        "empties it; {slot, remove: true} removes a hand-named slot. Sounds and variant sets are never deleted."))
    @refus
    async def edit_subject_sound_slot(project: str, subject: str, request: dict[str, Any]) -> dict[str, Any]:
        service = atelier.sons_du_sujet
        if request.get("add") is not None:
            return service.ajouter(project, subject, request["add"])
        slot = request.get("slot")
        if request.get("set") is not None:
            return service.poser(project, subject, slot, request["set"])
        if request.get("clear"):
            return service.vider(project, subject, slot)
        if request.get("remove"):
            return service.retirer_emplacement(project, subject, slot)
        return service.lire(project, subject)

    @serveur.tool(name="prepare_subject_sound_series", meta=meta("Préparer une série pour un emplacement", ou="fabrications"), description=(
        "Prepare a series of local takes for one slot of a subject, without starting it. Without request: returns the "
        "proposed request only (family of the slot, text made of the slot's word and the subject's description, number "
        "of takes) — nothing is written. With request (the prepare_sound_series body: prompt, nombre, texte_relu...; the "
        "family defaults to the slot's): the series is prepared and linked to the slot; keep_sound_takes on it then files "
        "the kept takes into the slot's variant set, named after the slot's stable name. Start it with start_sound_series. "
        "The text goes out as written: nothing is translated. Interface slots use sfxr instead (make_retro_sound_variants, then set the kept set on the slot)."))
    @refus
    async def prepare_subject_sound_series(project: str, subject: str, slot: str, request: dict[str, Any] | None = None) -> dict[str, Any]:
        if request is None:
            return atelier.sons_du_sujet.proposer(project, subject, slot)
        return await atelier.sons_du_sujet.preparer_serie(project, subject, slot, request, "agent")
