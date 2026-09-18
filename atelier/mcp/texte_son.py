# -*- coding: utf-8 -*-
"""SN2 pour l'agent : voir le texte sonore qui partira, et les gabarits qui le
composent — sans rien lancer (correction du 18 septembre 2026, relecture
croisée de la branche « le son »).

Fichier neuf, à dessein — comme `atelier/mcp/installation_son.py`
(SN1) : on n'ajoute rien à `atelier/mcp/workflows.py`, modifié ailleurs.

Rien n'est réimplémenté : `preview_sound_text` retrouve la même relecture que
l'écran (`POST /api/projects/{projet}/audio-jobs/compose`,
`ServiceTravauxAudio.ce_qui_partira`) ; `list_sound_templates` retrouve les
mêmes mots de gabarit que l'écran (`GET /api/sound-templates`,
`atelier.audio.texte.gabarits`)."""
from __future__ import annotations

from typing import Any

from atelier.audio.texte import gabarits


def installer_texte_son(serveur: Any, atelier: Any, refus) -> None:
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Relit le texte sonore qui partira, sans rien lancer.",
            "verbe": "relire", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="preview_sound_text", meta=meta("Relire le texte sonore"), description=(
        "Preview the exact text a sound job would send, without launching or spending anything: family (bruitage, "
        "interface, ambiance, musique, jingle, chanson, voix), description, optional engine (a workflow profile "
        "id, to override the family's default) and music settings (lyrics, tempo, key, time signature). Returns "
        "each piece of the composed text with its origin (description, universe, template, request, profile), the "
        "negative text, the resolved duration and its source, the picked engine and its source, the music "
        "parameters, and flags: a language flag when the description does not look like English, a duration flag "
        "when it falls outside the engine's declared range (clamped and cropped rather than refused when it's the "
        "engine's own minimum), and a reason when no engine is installed for the family."))
    @refus
    def preview_sound_text(project: str, family: str, description: str, engine: str | None = None,
            lyrics: str | None = None, tempo: int | None = None, key: str | None = None,
            time_signature: int | None = None) -> dict[str, Any]:
        demande: dict[str, Any] = {"famille": family, "prompt": description}
        if engine is not None:
            demande["modele"] = engine
        for cle, valeur in (("paroles", lyrics), ("tempo", tempo), ("tonalite", key), ("mesure", time_signature)):
            if valeur is not None:
                demande[cle] = valeur
        return atelier.travaux_audio.ce_qui_partira(project, demande)

    @serveur.tool(name="list_sound_templates", meta=meta("Lire les gabarits sonores"), description=(
        "List every sound template's words: the seven family keys, what each pulls from the universe, the "
        "track-type and close-mic'd prefixes, the negative text, default durations and default bar counts, the "
        "ACE-Step lyric structures, and the shipped example requests per family."))
    @refus
    def list_sound_templates() -> dict[str, Any]:
        return gabarits()
