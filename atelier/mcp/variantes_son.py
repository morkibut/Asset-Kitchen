"""SN3 : l'agent demande une série de tirages et range des jeux de variantes.

Mêmes services que l'écran ; l'agent est l'acteur « agent », donc son cadre de
délégation (calcul local permis, plafond d'appels) s'applique à chaque tirage.
"""
from typing import Any


def installer_variantes_son(serveur, atelier, refus):
    def meta(titre, verbe="travailler", ou="fabrications"):
        return {"barre": {"titre": titre, "phrase": "Tire plusieurs sons d'une même demande et range les variantes gardées.",
            "verbe": verbe, "paiement": "gratuit", "ou": ou, "route": "", "besoins": []}}

    @serveur.tool(name="prepare_sound_series", meta=meta("Préparer une série de sons"), description=(
        "Prepare N local takes of one sound request without starting them (default 8 for sfx/ambience, 4 for "
        "music/song/jingle/voice; 1-16). request: the prepare_audio body {cle, famille or modele, prompt, ...} plus "
        "optional nombre and nom. Each take is an ordinary audio job with its own seed. Idempotent by cle. The "
        "result carries the announced compute time from this machine's measurements; nothing costs money."))
    @refus
    async def prepare_sound_series(project: str, request: dict[str, Any]) -> dict[str, Any]:
        return await atelier.series_son.preparer(project, request, "agent")

    @serveur.tool(name="get_sound_series", meta=meta("Relire une série de sons"), description=(
        "Read a sound series: each take's job state, seed and sound (with measurements; a clipped take is flagged, "
        "never discarded), the remaining compute time and the variant sets kept from it. Without series, list all."))
    @refus
    async def get_sound_series(project: str, series: str | None = None) -> Any:
        return atelier.series_son.lire(project, series) if series else atelier.series_son.lister(project)

    @serveur.tool(name="start_sound_series", meta=meta("Lancer une série de sons"), description=(
        "Start the prepared takes of a series (never restarts anything). With resume=true: the explicit resume "
        "gesture — takes that already have their sound are never rerun, a known ComfyUI job is followed, not resent."))
    @refus
    async def start_sound_series(project: str, series: str, resume: bool = False) -> dict[str, Any]:
        if resume:
            return await atelier.series_son.reprendre(project, series, "agent")
        return await atelier.series_son.demarrer(project, series, "agent")

    @serveur.tool(name="keep_sound_takes", meta=meta("Garder des tirages", "creer", "galerie"), description=(
        "Keep takes of a series as a variant set: request {rangs:[1,3,...]} or {sons:[...]}, optional nom, cle, "
        "famille. The set lists sounds by reference, in order, and remembers its series. Each kept sound also gets "
        "a new version with its family's proposed recipe applied (mono for sfx/interface/voice, target level), "
        "visible in its versions — pass appliquer_reglages=false to skip this."))
    @refus
    async def keep_sound_takes(project: str, series: str, request: dict[str, Any]) -> dict[str, Any]:
        return atelier.series_son.garder(project, series, request)

    @serveur.tool(name="get_sound_variant_set", meta=meta("Relire un jeu de variantes", ou="galerie"), description=(
        "Read a variant set (its sounds in order, each with status present/ecarte/supprime/silencieux/illisible, "
        "and the sounds that would be delivered). Without variant_set, list the sets, optionally those holding sound."))
    @refus
    async def get_sound_variant_set(project: str, variant_set: str | None = None, sound: str | None = None) -> Any:
        return atelier.variantes_son.lire(project, variant_set) if variant_set else atelier.variantes_son.lister(project, sound)

    @serveur.tool(name="edit_sound_variant_set", meta=meta("Modifier un jeu de variantes", "regler", "galerie"), description=(
        "Create or change a variant set. Without variant_set: create from request {nom, sons, famille?, serie?, cle?}. "
        "With variant_set: request may hold add (sound id), position, remove (sound id), nom, famille. A clipped sound "
        "is added without refusal. Sounds are never deleted by this tool."))
    @refus
    async def edit_sound_variant_set(project: str, request: dict[str, Any], variant_set: str | None = None) -> dict[str, Any]:
        jeux = atelier.variantes_son
        if variant_set is None:
            return jeux.creer(project, request)
        resultat = jeux.lire(project, variant_set)
        if request.get("add"):
            resultat = jeux.ajouter(project, variant_set, request["add"], request.get("position"))
        if request.get("remove"):
            resultat = jeux.retirer(project, variant_set, request["remove"])
        reglages = {k: request[k] for k in ("nom", "famille") if k in request}
        if reglages:
            resultat = jeux.modifier(project, variant_set, reglages)
        return resultat

    @serveur.tool(name="delete_sound_variant_set", meta=meta("Défaire un jeu de variantes", "regler", "galerie"), description=(
        "Delete a variant set. Its sounds all stay in the library."))
    @refus
    async def delete_sound_variant_set(project: str, variant_set: str) -> dict[str, Any]:
        return atelier.variantes_son.supprimer(project, variant_set)

    @serveur.tool(name="preview_sound_variant_set_delivery", meta=meta("Relire la livraison d'un jeu de variantes", "livrer", ou="galerie"), description=(
        "Prepare a variant set's deliverable sounds (sound, ecarte/supprime/silencieux/illisible are excluded, a clipped "
        "sound is kept) for the linked Godot project. Each sound delivers like a single sound's v2 package (file + "
        ".import) under the set's stable name, two-digit numbered (sfx_pas_01.wav ...); an AudioStreamRandomizer "
        "(playback_mode=0, no immediate repeat) named after the set without a number (sfx_pas.tres) plays them through "
        "son.tscn; credits.json lists every sound. The set's family decides the format (WAV or OGG) and is required. "
        "Refused with its reason when the set holds no deliverable sound. Does NOT write to the game; publish with "
        "publish_animation_delivery using the returned token."))
    @refus
    async def preview_sound_variant_set_delivery(project: str, variant_set: str) -> dict[str, Any]:
        return atelier.variantes_son.prevoir_livraison(project, variant_set)
