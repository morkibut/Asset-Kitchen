"""SN7 : l'agent lit, pose et retire les repères sonores d'un sujet — « cette
animation joue ce son à cette image ». Mêmes services que l'écran
(`atelier/api/reperes_sonores.py`). Rien n'est payé, rien n'est fabriqué.
"""
from typing import Any


def installer_reperes_sonores(serveur, atelier, refus):
    def meta(titre, verbe="regler"):
        return {"barre": {"titre": titre, "phrase": "Cale les sons d'un sujet sur les images de ses animations.",
            "verbe": verbe, "paiement": "gratuit", "ou": "codex", "route": "", "besoins": []}}

    @serveur.tool(name="list_sound_cues", meta=meta("Relire les repères sonores", "travailler"), description=(
        "List a subject's sound cues: each cue says 'this animation strip plays this sound slot at this image' "
        "(strip id, image numbered from 1, slot key from list_subject_sounds, e.g. 'pas'). Optional strip: one strip "
        "only. Each cue carries the slot and strip names, the strip's image count and frame rate, and a plain 'signal' "
        "when it cannot sound (slot empty, strip gone, image past the end). Also returns, per slot, the sounds the "
        "test room plays (one at random, never the same twice in a row). Cues are tied to the image, never to a time: "
        "changing a strip's frame rate keeps them on the same image."))
    @refus
    async def list_sound_cues(project: str, subject: str, strip: str | None = None) -> dict[str, Any]:
        return atelier.reperes_sonores.lire(project, subject, strip)

    @serveur.tool(name="set_sound_cue", meta=meta("Poser un repère sonore"), description=(
        "Put a sound cue on one image of a subject's animation strip: {strip, image (from 1), slot}. The slot must "
        "exist for the subject (list_subject_sounds); several slots may share an image; setting it twice changes "
        "nothing. When the character is delivered (publish_animation_delivery), each delivered animation with cues "
        "gets an AnimationPlayer animation that drives the sprite and has one audio track per slot, keyed at the "
        "time of each cued image (computed from the frame rate at delivery time); the track plays the slot's child "
        "player '<stable name>/Calage', leaving the slot's own player free."))
    @refus
    async def set_sound_cue(project: str, subject: str, strip: str, image: int, slot: str) -> dict[str, Any]:
        return atelier.reperes_sonores.poser(project, subject, {"bande": strip, "image": image, "cle": slot})

    @serveur.tool(name="remove_sound_cue", meta=meta("Retirer un repère sonore"), description=(
        "Remove a sound cue {strip, image, slot} from a subject. Nothing else changes: the sounds, the slot and the "
        "strip stay. Removing a cue that is not there changes nothing."))
    @refus
    async def remove_sound_cue(project: str, subject: str, strip: str, image: int, slot: str) -> dict[str, Any]:
        return atelier.reperes_sonores.retirer(project, subject, {"bande": strip, "image": image, "cle": slot})
