# -*- coding: utf-8 -*-
"""SN10 : l'agent compose et relit une musique adaptative — mêmes services
que l'écran. Un tirage n'est jamais lancé ici : l'objet référence des sons
déjà faits (SN9)."""
from typing import Any


def installer_musique_adaptative(serveur, atelier, refus):
    def meta(titre, verbe="creer", ou="fabrications"):
        return {"barre": {"titre": titre, "phrase": "Compose une musique adaptative à partir de sons déjà faits.",
            "verbe": verbe, "paiement": "gratuit", "ou": ou, "route": "", "besoins": []}}

    @serveur.tool(name="edit_adaptive_music", meta=meta("Composer une musique adaptative"), description=(
        "Create or replace an adaptive music object, which only REFERENCES sounds already made (family musique/"
        "jingle/chanson) — it never generates anything. Without adaptive_music: create from request {nom, couches?: "
        "[{cle, son, volume_db?}], morceaux?: [{cle, son, nom?}], transitions?: [{de, vers, depart?, arrivee?, fondu?, "
        "fondu_temps?}]}. With adaptive_music: request fields replace the corresponding block in bulk (couches, "
        "morceaux and transitions must stay consistent together); fields left out keep their value. couches become an "
        "AudioStreamSynchronized (same-length layers, blended by volume_db in dB, -80 to 6); morceaux and transitions "
        "become an AudioStreamInteractive with stable clip names. depart: immediat/temps_suivant/mesure_suivante/fin "
        "(default mesure_suivante); arrivee: meme_position/debut/position_precedente (default debut); fondu: aucun/"
        "entree/sortie/croise/auto (default croise); fondu_temps in beats (default 4.0). de/vers accept \"*\" for any "
        "clip (never both on the same transition). Needs at least one couche or morceau."))
    @refus
    async def edit_adaptive_music(project: str, request: dict[str, Any], adaptive_music: str | None = None) -> dict[str, Any]:
        service = atelier.musique_adaptative
        return service.creer(project, request) if adaptive_music is None else service.modifier(project, adaptive_music, request)

    @serveur.tool(name="get_adaptive_music", meta=meta("Relire une musique adaptative", ou="galerie"), description=(
        "Read an adaptive music object: each couche/morceau with its sound's readiness and known tempo/key/time "
        "signature/duration, the transitions, and any mismatch between the referenced sounds (tempo, key, time "
        "signature, duration) — reported, never blocking. Without adaptive_music, list all in the project."))
    @refus
    async def get_adaptive_music(project: str, adaptive_music: str | None = None) -> Any:
        service = atelier.musique_adaptative
        return service.lire(project, adaptive_music) if adaptive_music else service.lister(project)

    @serveur.tool(name="delete_adaptive_music", meta=meta("Défaire une musique adaptative", "regler", "galerie"), description=(
        "Delete an adaptive music object. The sounds it referenced all stay in the library."))
    @refus
    async def delete_adaptive_music(project: str, adaptive_music: str) -> dict[str, Any]:
        return atelier.musique_adaptative.supprimer(project, adaptive_music)

    @serveur.tool(name="preview_adaptive_music_delivery", meta=meta("Relire la livraison d'une musique adaptative", "livrer", ou="galerie"), description=(
        "Prepare an adaptive music object's delivery for the linked Godot project: couches become one "
        "AudioStreamSynchronized (<name>_couches.tres), morceaux and transitions become one AudioStreamInteractive "
        "with stable clip names (<name>_morceaux.tres); one son.tscn holds an AudioStreamPlayer per resource on the "
        "Music bus; credits.json lists every referenced sound. A sound that is missing, discarded, silent or unreadable "
        "is excluded without failing the rest. Refused with its reason when nothing is deliverable. Does NOT write to "
        "the game; publish with publish_animation_delivery using the returned token."))
    @refus
    async def preview_adaptive_music_delivery(project: str, adaptive_music: str) -> dict[str, Any]:
        return atelier.musique_adaptative.prevoir_livraison(project, adaptive_music)
