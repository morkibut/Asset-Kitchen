# -*- coding: utf-8 -*-
"""Fabriquer un son rétro sfxr pour l'agent — sans ComfyUI, sans dépense (SN8)."""
from typing import Any
from urllib.parse import quote

from atelier.audio.sfxr import DEPARTS


def installer_sfxr(serveur, atelier, refus):
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Synthèse sfxr locale et instantanée, sans carte graphique.",
            "verbe": "creer", "paiement": "gratuit", "ou": "galerie", "route": "", "besoins": []}}

    def vue(project, son):
        base = f"/api/projects/{quote(project, safe='')}/sounds/{son['identifiant']}"
        return {**son, "apercu": base + "/preview.wav?revision=" + str(son["revision"]),
            "forme_onde": base + "/waveform?revision=" + str(son["revision"]),
            "archive": base + "/export.zip?revision=" + str(son["revision"]), "source_url": base + "/source"}

    depart_desc = ", ".join(sorted(DEPARTS))

    @serveur.tool(name="make_retro_sound", meta=meta("Fabriquer un son rétro"),
        description=("Synthesize an 8-bit/retro sound with sfxr (jsfxr port), fully local and instant — no "
            f"ComfyUI, no GPU, no cost. Give either `start` (one of: {depart_desc}) or full `parameters` "
            "(sfxr fields: wave_type 0-3, p_env_attack/sustain/punch/decay, p_base_freq, p_freq_limit/ramp/dramp, "
            "p_vib_strength/speed, p_arp_mod/speed, p_duty/duty_ramp, p_repeat_speed, p_pha_offset/ramp, "
            "p_lpf_freq/ramp/resonance, p_hpf_freq/ramp, sound_vol) — never both. `seed` makes the result exactly "
            "reproducible: same start-or-parameters plus same seed always yields the same sound, no duplicate "
            "entry in the library. The sound enters the library like any other, with its sfxr recipe kept as "
            "provenance so it can be re-derived exactly.")
    )
    @refus
    async def fabriquer(project: str, seed: int, start: str | None = None, parameters: dict[str, Any] | None = None,
            name: str | None = None) -> dict[str, Any]:
        return vue(project, atelier.sfxr.fabriquer(project, depart=start, parametres=parameters, graine=seed, nom=name))

    @serveur.tool(name="make_retro_sound_variants", meta=meta("Tirer des variantes d'un son rétro"),
        description=("Draw N sfxr variants of a start-or-parameters sound by small deterministic mutation "
            "(same wave shape kept, other fields nudged), one seed per variant derived from `seed` so the whole "
            "set is reproducible. Each variant enters the library on its own, with its own sfxr provenance.")
    )
    @refus
    async def variantes(project: str, seed: int, start: str | None = None, parameters: dict[str, Any] | None = None,
            count: int = 8, name: str | None = None) -> list[dict[str, Any]]:
        return [vue(project, son) for son in atelier.sfxr.variantes(project, depart=start,
            parametres=parameters, graine=seed, nombre=count, nom=name)]
