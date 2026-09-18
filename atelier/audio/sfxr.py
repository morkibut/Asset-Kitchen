# -*- coding: utf-8 -*-
"""Synthèse sfxr — portage Python + numpy de jsfxr (SN8).

Porté depuis `sfxr.js` de jsfxr (chr15m/jsfxr, licence Unlicense — domaine
public), lu le 18 septembre 2026 :
https://github.com/chr15m/jsfxr/blob/master/sfxr.js

Ce module ne connaît ni bibliothèque, ni service, ni FastAPI : c'est le
calcul seul, comme `atelier/audio/traitement.py` à côté de lui. Il rend un
signal mono en float64 dans `[-1, 1]`, prêt pour `traitement.encoder`.

**Trois écarts délibérés avec le portage strict**, chacun documenté à
l'endroit où il agit :

1. Chaque forme d'onde (attaque/tenue/chute, vibrato, arpège, duty,
   répétition, glissando, phaser, passe-bas, passe-haut) est reprise
   ligne à ligne depuis `SoundEffect.prototype.getRawBuffer`. La seule
   branche non reprise à l'identique est la division `envf` quand une
   étape d'enveloppe tombe à zéro échantillon : jsfxr y produit un `NaN`
   (0/0) qui contaminerait tout le rendu ; ici elle vaut 0, ce qui rend
   un son court plutôt qu'un son invalide.
2. Un limiteur de crête, appliqué une fois le signal complet connu :
   si le pic dépasse 0,97, tout le rendu est mis à l'échelle pour y
   revenir. jsfxr laisse son moteur d'origine écrêter au format de
   sortie ; le produit interdit la saturation (`AGENTS.md`), et cette
   échelle reste déterministe (mêmes paramètres et graine ⇒ même
   facteur).
3. Le rendu est plafonné à `duree_max_s` (2 s par défaut, le critère de
   la tranche) : des paramètres extrêmes (enveloppe proche de 1 partout)
   peuvent, dans jsfxr aussi, dépasser plusieurs secondes ; on tronque
   plutôt que de laisser partir un fichier hors gabarit.

**Deux départs ne viennent pas de jsfxr** : `validation` et `erreur`. Le
plan ne demande que « clic, validation, erreur, que tu dérives de
blipSelect/erreur basse » — jsfxr n'a que `blipSelect`. `validation`
part de zéro (montée carrée, franche) ; `erreur` part de `blip_select`
et l'assombrit (fréquence basse, glissando descendant). Les deux restent
déterministes par graine, comme les huit départs jsfxr.

La graine ne rejoue jamais `Math.random()` : elle passe par
`random.Random(graine)`, un générateur Python stable d'une version à
l'autre — ce que jsfxr ne peut pas garantir avec le moteur JS d'un
navigateur.
"""
from __future__ import annotations

import math
import random
from dataclasses import asdict, dataclass, replace

import numpy as np

from atelier.domaine.son import SonRefuse

OVERSAMPLING = 8

CARREE, DENT_DE_SCIE, SINUS, BRUIT = 0, 1, 2, 3
FORMES_ONDE = {CARREE: "carrée", DENT_DE_SCIE: "dent de scie", SINUS: "sinus", BRUIT: "bruit"}

# Champs signés (jsfxr : params_signed) — domaine [-1, 1]. Tout le reste
# (hors wave_type, entier) vit dans [0, 1].
_SIGNES = frozenset({"p_freq_ramp", "p_freq_dramp", "p_arp_mod", "p_duty_ramp",
    "p_pha_offset", "p_pha_ramp", "p_lpf_ramp", "p_hpf_ramp"})


@dataclass
class Params:
    """Les réglages d'un son sfxr — mêmes noms et mêmes défauts que `Params()` en JS."""

    wave_type: int = CARREE
    p_env_attack: float = 0.0
    p_env_sustain: float = 0.3
    p_env_punch: float = 0.0
    p_env_decay: float = 0.4
    p_base_freq: float = 0.3
    p_freq_limit: float = 0.0
    p_freq_ramp: float = 0.0
    p_freq_dramp: float = 0.0
    p_vib_strength: float = 0.0
    p_vib_speed: float = 0.0
    p_arp_mod: float = 0.0
    p_arp_speed: float = 0.0
    p_duty: float = 0.0
    p_duty_ramp: float = 0.0
    p_repeat_speed: float = 0.0
    p_pha_offset: float = 0.0
    p_pha_ramp: float = 0.0
    p_lpf_freq: float = 1.0
    p_lpf_ramp: float = 0.0
    p_lpf_resonance: float = 0.0
    p_hpf_freq: float = 0.0
    p_hpf_ramp: float = 0.0
    sound_vol: float = 0.5

    def en_json(self) -> dict:
        return asdict(self)


_CHAMPS = tuple(k for k in Params.__dataclass_fields__ if k != "wave_type")


def depuis_json(brut) -> Params:
    if not isinstance(brut, dict):
        raise SonRefuse("Les paramètres sfxr doivent former un objet.")
    valeurs = asdict(Params())
    inconnus = sorted(set(brut) - set(valeurs))
    if inconnus:
        raise SonRefuse(f"Ce paramètre sfxr est inconnu : « {inconnus[0]} ».")
    for nom, valeur in brut.items():
        if nom == "wave_type":
            if isinstance(valeur, bool) or not isinstance(valeur, int) or valeur not in FORMES_ONDE:
                raise SonRefuse("La forme d'onde doit être 0 (carrée), 1 (dent de scie), 2 (sinus) ou 3 (bruit).")
        else:
            if isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not math.isfinite(valeur):
                raise SonRefuse(f"Le paramètre {nom} doit être un nombre.")
            bas, haut = (-1.0, 1.0) if nom in _SIGNES else (0.0, 1.0)
            if not bas <= valeur <= haut:
                raise SonRefuse(f"Le paramètre {nom} doit être compris entre {bas} et {haut}.")
        valeurs[nom] = valeur
    return Params(**valeurs)


def _clamper(p: Params) -> Params:
    d = asdict(p)
    for nom in _CHAMPS:
        bas, haut = (-1.0, 1.0) if nom in _SIGNES else (0.0, 1.0)
        d[nom] = min(haut, max(bas, float(d[nom])))
    d["wave_type"] = int(d["wave_type"]) % 4
    return Params(**d)


class _RNG:
    """`Math.random()` de jsfxr, rejoué depuis une graine Python stable."""

    def __init__(self, graine: int) -> None:
        self._r = random.Random(graine)

    def frnd(self, plage: float) -> float:
        return self._r.random() * plage

    def rndr(self, bas: float, haut: float) -> float:
        return self._r.random() * (haut - bas) + bas

    def rnd(self, maxi: int) -> int:
        return int(self._r.random() * (maxi + 1))

    def signe(self) -> float:
        return self._r.random() * 2 - 1


# ─── Départs types (jsfxr : Params.prototype.<preset>) ──────────────────────

def depart_pickup_coin(r: _RNG) -> Params:
    p = Params(wave_type=DENT_DE_SCIE)
    p.p_base_freq = 0.4 + r.frnd(0.5)
    p.p_env_attack = 0
    p.p_env_sustain = r.frnd(0.1)
    p.p_env_decay = 0.1 + r.frnd(0.4)
    p.p_env_punch = 0.3 + r.frnd(0.3)
    if r.rnd(1):
        p.p_arp_speed = 0.5 + r.frnd(0.2)
        p.p_arp_mod = 0.2 + r.frnd(0.4)
    return p


def depart_laser_shoot(r: _RNG) -> Params:
    p = Params()
    p.wave_type = r.rnd(2)
    if p.wave_type == SINUS and r.rnd(1):
        p.wave_type = r.rnd(1)
    if r.rnd(2) == 0:
        p.p_base_freq = 0.3 + r.frnd(0.6)
        p.p_freq_limit = r.frnd(0.1)
        p.p_freq_ramp = -0.35 - r.frnd(0.3)
    else:
        p.p_base_freq = 0.5 + r.frnd(0.5)
        p.p_freq_limit = p.p_base_freq - 0.2 - r.frnd(0.6)
        if p.p_freq_limit < 0.2:
            p.p_freq_limit = 0.2
        p.p_freq_ramp = -0.15 - r.frnd(0.2)
    if p.wave_type == DENT_DE_SCIE:
        p.p_duty = 1
    if r.rnd(1):
        p.p_duty = r.frnd(0.5)
        p.p_duty_ramp = r.frnd(0.2)
    else:
        p.p_duty = 0.4 + r.frnd(0.5)
        p.p_duty_ramp = -r.frnd(0.7)
    p.p_env_attack = 0
    p.p_env_sustain = 0.1 + r.frnd(0.2)
    p.p_env_decay = r.frnd(0.4)
    if r.rnd(1):
        p.p_env_punch = r.frnd(0.3)
    if r.rnd(2) == 0:
        p.p_pha_offset = r.frnd(0.2)
        p.p_pha_ramp = -r.frnd(0.2)
    p.p_hpf_freq = r.frnd(0.3)
    return p


def depart_explosion(r: _RNG) -> Params:
    p = Params(wave_type=BRUIT)
    if r.rnd(1):
        p.p_base_freq = (0.1 + r.frnd(0.4)) ** 2
        p.p_freq_ramp = -0.1 + r.frnd(0.4)
    else:
        p.p_base_freq = (0.2 + r.frnd(0.7)) ** 2
        p.p_freq_ramp = -0.2 - r.frnd(0.2)
    if r.rnd(4) == 0:
        p.p_freq_ramp = 0
    if r.rnd(2) == 0:
        p.p_repeat_speed = 0.3 + r.frnd(0.5)
    p.p_env_attack = 0
    p.p_env_sustain = 0.1 + r.frnd(0.3)
    p.p_env_decay = r.frnd(0.5)
    if r.rnd(1):
        p.p_pha_offset = -0.3 + r.frnd(0.9)
        p.p_pha_ramp = -r.frnd(0.3)
    p.p_env_punch = 0.2 + r.frnd(0.6)
    if r.rnd(1):
        p.p_vib_strength = r.frnd(0.7)
        p.p_vib_speed = r.frnd(0.6)
    if r.rnd(2) == 0:
        p.p_arp_speed = 0.6 + r.frnd(0.3)
        p.p_arp_mod = 0.8 - r.frnd(1.6)
    return p


def depart_power_up(r: _RNG) -> Params:
    p = Params()
    if r.rnd(1):
        p.wave_type = DENT_DE_SCIE
        p.p_duty = 1
    else:
        p.p_duty = r.frnd(0.6)
    p.p_base_freq = 0.2 + r.frnd(0.3)
    if r.rnd(1):
        p.p_freq_ramp = 0.1 + r.frnd(0.4)
        p.p_repeat_speed = 0.4 + r.frnd(0.4)
    else:
        p.p_freq_ramp = 0.05 + r.frnd(0.2)
        if r.rnd(1):
            p.p_vib_strength = r.frnd(0.7)
            p.p_vib_speed = r.frnd(0.6)
    p.p_env_attack = 0
    p.p_env_sustain = r.frnd(0.4)
    p.p_env_decay = 0.1 + r.frnd(0.4)
    return p


def depart_hit_hurt(r: _RNG) -> Params:
    p = Params()
    p.wave_type = r.rnd(2)
    if p.wave_type == SINUS:
        p.wave_type = BRUIT
    if p.wave_type == CARREE:
        p.p_duty = r.frnd(0.6)
    if p.wave_type == DENT_DE_SCIE:
        p.p_duty = 1
    p.p_base_freq = 0.2 + r.frnd(0.6)
    p.p_freq_ramp = -0.3 - r.frnd(0.4)
    p.p_env_attack = 0
    p.p_env_sustain = r.frnd(0.1)
    p.p_env_decay = 0.1 + r.frnd(0.2)
    if r.rnd(1):
        p.p_hpf_freq = r.frnd(0.3)
    return p


def depart_jump(r: _RNG) -> Params:
    p = Params(wave_type=CARREE)
    p.p_duty = r.frnd(0.6)
    p.p_base_freq = 0.3 + r.frnd(0.3)
    p.p_freq_ramp = 0.1 + r.frnd(0.2)
    p.p_env_attack = 0
    p.p_env_sustain = 0.1 + r.frnd(0.3)
    p.p_env_decay = 0.1 + r.frnd(0.2)
    if r.rnd(1):
        p.p_hpf_freq = r.frnd(0.3)
    if r.rnd(1):
        p.p_lpf_freq = 1 - r.frnd(0.6)
    return p


def depart_blip_select(r: _RNG) -> Params:
    p = Params()
    p.wave_type = r.rnd(1)
    if p.wave_type == CARREE:
        p.p_duty = r.frnd(0.6)
    else:
        p.p_duty = 1
    p.p_base_freq = 0.2 + r.frnd(0.4)
    p.p_env_attack = 0
    p.p_env_sustain = 0.1 + r.frnd(0.1)
    p.p_env_decay = r.frnd(0.2)
    p.p_hpf_freq = 0.1
    return p


def depart_clic(r: _RNG) -> Params:
    # jsfxr : Params.prototype.click — tire explosion ou hitHurt puis serre
    # l'enveloppe et remonte la fréquence.
    p = depart_explosion(r) if r.rnd(1) else depart_hit_hurt(r)
    if r.rnd(1):
        p.p_freq_ramp = -0.5 + r.frnd(1.0)
    if r.rnd(1):
        p.p_env_sustain = (r.frnd(0.4) + 0.2) * p.p_env_sustain
        p.p_env_decay = (r.frnd(0.4) + 0.2) * p.p_env_decay
    if r.rnd(3) == 0:
        p.p_env_attack = r.frnd(0.3)
    p.p_base_freq = 1 - r.frnd(0.25)
    p.p_hpf_freq = 1 - r.frnd(0.1)
    return p


def depart_validation(r: _RNG) -> Params:
    # Hors jsfxr (§ tête de module) : une montée franche, carrée, courte.
    p = Params(wave_type=CARREE)
    p.p_duty = r.frnd(0.3)
    p.p_base_freq = 0.4 + r.frnd(0.3)
    p.p_freq_ramp = 0.15 + r.frnd(0.15)
    p.p_env_attack = 0
    p.p_env_sustain = 0.08 + r.frnd(0.05)
    p.p_env_decay = 0.1 + r.frnd(0.1)
    p.p_hpf_freq = 0.1
    return p


def depart_erreur(r: _RNG) -> Params:
    # Hors jsfxr (§ tête de module) : dérivé de blip_select, assombri —
    # « erreur basse », descendante plutôt que montante.
    p = depart_blip_select(r)
    p.wave_type = CARREE
    p.p_base_freq = 0.08 + r.frnd(0.08)
    p.p_freq_ramp = -0.1 - r.frnd(0.1)
    p.p_env_sustain = 0.12 + r.frnd(0.08)
    p.p_env_decay = 0.15 + r.frnd(0.1)
    return p


DEPARTS = {
    "pickup_coin": depart_pickup_coin,
    "laser_shoot": depart_laser_shoot,
    "explosion": depart_explosion,
    "power_up": depart_power_up,
    "hit_hurt": depart_hit_hurt,
    "jump": depart_jump,
    "blip_select": depart_blip_select,
    "clic": depart_clic,
    "validation": depart_validation,
    "erreur": depart_erreur,
}


def tirer_depart(nom: str, graine: int) -> Params:
    if nom not in DEPARTS:
        raise SonRefuse(f"« {nom} » n'est pas un départ sfxr connu. Choisissez parmi : {', '.join(sorted(DEPARTS))}.")
    return DEPARTS[nom](_RNG(graine))


def muter(p: Params, graine: int) -> Params:
    """Petites variations (jsfxr : `Params.prototype.mutate`), graine fixée.

    La ligne JS `this.p_vib_delay += ...` n'est pas reprise : `p_vib_delay`
    n'existe pas dans `Params()` côté JS non plus (elle crée une propriété
    fantôme, jamais lue par le moteur) — l'omettre ne change aucun son.
    """
    r = _RNG(graine)
    q = replace(p)
    if r.rnd(1): q.p_base_freq += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_freq_ramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_freq_dramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_duty += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_duty_ramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_vib_strength += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_vib_speed += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_env_attack += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_env_sustain += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_env_decay += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_env_punch += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_lpf_resonance += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_lpf_freq += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_lpf_ramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_hpf_freq += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_hpf_ramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_pha_offset += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_pha_ramp += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_repeat_speed += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_arp_speed += r.frnd(0.1) - 0.05
    if r.rnd(1): q.p_arp_mod += r.frnd(0.1) - 0.05
    return _clamper(q)


# ─── Rendu (jsfxr : SoundEffect.prototype.{init,initForRepeat,getRawBuffer}) ─

def _pour_repetition(p: Params):
    period = 100 / (p.p_base_freq * p.p_base_freq + 0.001)
    period_max = 100 / (p.p_freq_limit * p.p_freq_limit + 0.001)
    period_mult = 1 - (p.p_freq_ramp ** 3) * 0.01
    period_mult_slide = -(p.p_freq_dramp ** 3) * 0.000001
    duty_cycle = 0.5 - p.p_duty * 0.5
    duty_cycle_slide = -p.p_duty_ramp * 0.00005
    if p.p_arp_mod >= 0:
        arp_mult = 1 - (p.p_arp_mod ** 2) * 0.9
    else:
        arp_mult = 1 + (p.p_arp_mod ** 2) * 10
    arp_time = int(((1 - p.p_arp_speed) ** 2) * 20000 + 32)
    if p.p_arp_speed == 1:
        arp_time = 0
    return [period, period_max, period_mult, period_mult_slide, duty_cycle, duty_cycle_slide, arp_mult, arp_time]


def _generer(p: Params, r: _RNG, plafond_echantillons: int) -> list[float]:
    wave_shape = int(p.wave_type) % 4
    enable_freq_cutoff = p.p_freq_limit > 0

    fltw = (p.p_lpf_freq ** 3) * 0.1
    enable_lpf = p.p_lpf_freq != 1
    fltw_d = 1 + p.p_lpf_ramp * 0.0001
    fltdmp = 5 / (1 + (p.p_lpf_resonance ** 2) * 20) * (0.01 + fltw)
    if fltdmp > 0.8:
        fltdmp = 0.8
    flthp = (p.p_hpf_freq ** 2) * 0.1
    flthp_d = 1 + p.p_hpf_ramp * 0.0003

    vibrato_speed = (p.p_vib_speed ** 2) * 0.01
    vibrato_amplitude = p.p_vib_strength * 0.5

    longueur_enveloppe = [
        int(p.p_env_attack * p.p_env_attack * 100000),
        int(p.p_env_sustain * p.p_env_sustain * 100000),
        int(p.p_env_decay * p.p_env_decay * 100000),
    ]
    punch = p.p_env_punch

    flanger_offset = (p.p_pha_offset ** 2) * 1020
    if p.p_pha_offset < 0:
        flanger_offset = -flanger_offset
    flanger_offset_slide = (p.p_pha_ramp ** 2)
    if p.p_pha_ramp < 0:
        flanger_offset_slide = -flanger_offset_slide

    repeat_time = int(((1 - p.p_repeat_speed) ** 2) * 20000 + 32)
    if p.p_repeat_speed == 0:
        repeat_time = 0

    gain = math.exp(p.sound_vol) - 1

    (period, period_max, period_mult, period_mult_slide,
        duty_cycle, duty_cycle_slide, arp_mult, arp_time) = _pour_repetition(p)
    elapsed_since_repeat = 0

    fltp = fltdp = fltphp = 0.0
    bruit = [r.signe() for _ in range(32)]
    stade = 0
    ecoule = 0
    phase_vibrato = 0.0
    phase = 0
    ipp = 0
    flanger_buffer = [0.0] * 1024

    sortie: list[float] = []
    t = 0
    while True:
        if repeat_time != 0:
            elapsed_since_repeat += 1
            if elapsed_since_repeat >= repeat_time:
                (period, period_max, period_mult, period_mult_slide,
                    duty_cycle, duty_cycle_slide, arp_mult, arp_time) = _pour_repetition(p)
                elapsed_since_repeat = 0

        if arp_time != 0 and t >= arp_time:
            arp_time = 0
            period *= arp_mult

        period_mult += period_mult_slide
        period *= period_mult
        if period > period_max:
            period = period_max
            if enable_freq_cutoff:
                break

        rfperiod = period
        if vibrato_amplitude > 0:
            phase_vibrato += vibrato_speed
            rfperiod = period * (1 + math.sin(phase_vibrato) * vibrato_amplitude)
        iperiod = int(rfperiod)
        if iperiod < OVERSAMPLING:
            iperiod = OVERSAMPLING

        duty_cycle += duty_cycle_slide
        if duty_cycle < 0: duty_cycle = 0.0
        if duty_cycle > 0.5: duty_cycle = 0.5

        ecoule += 1
        if ecoule > longueur_enveloppe[stade]:
            ecoule = 0
            stade += 1
            if stade > 2:
                break
        longueur_stade = longueur_enveloppe[stade]
        # Écart avec jsfxr, documenté en tête de module : 0/0 vaut 0 ici,
        # pas NaN.
        envf = (ecoule / longueur_stade) if longueur_stade else 0.0
        if stade == 0:
            env_vol = envf
        elif stade == 1:
            env_vol = 1 + (1 - envf) * 2 * punch
        else:
            env_vol = 1 - envf

        flanger_offset += flanger_offset_slide
        iphase = abs(int(flanger_offset))
        if iphase > 1023:
            iphase = 1023

        if flthp_d != 0:
            flthp *= flthp_d
            if flthp < 0.00001: flthp = 0.00001
            if flthp > 0.1: flthp = 0.1

        echantillon = 0.0
        for _ in range(OVERSAMPLING):
            phase += 1
            if phase >= iperiod:
                phase %= iperiod
                if wave_shape == BRUIT:
                    bruit = [r.signe() for _ in range(32)]

            fp = phase / iperiod
            if wave_shape == CARREE:
                sous = 0.5 if fp < duty_cycle else -0.5
            elif wave_shape == DENT_DE_SCIE:
                sous = -1 + 2 * fp / duty_cycle if fp < duty_cycle else 1 - 2 * (fp - duty_cycle) / (1 - duty_cycle)
            elif wave_shape == SINUS:
                sous = math.sin(fp * 2 * math.pi)
            else:
                sous = bruit[int(phase * 32 / iperiod)]

            pp = fltp
            fltw *= fltw_d
            if fltw < 0: fltw = 0.0
            if fltw > 0.1: fltw = 0.1
            if enable_lpf:
                fltdp += (sous - fltp) * fltw
                fltdp -= fltdp * fltdmp
            else:
                fltp = sous
                fltdp = 0.0
            fltp += fltdp

            fltphp += fltp - pp
            fltphp -= fltphp * flthp
            sous = fltphp

            flanger_buffer[ipp & 1023] = sous
            sous += flanger_buffer[(ipp - iphase + 1024) & 1023]
            ipp = (ipp + 1) & 1023

            echantillon += sous * env_vol

        sortie.append(echantillon / OVERSAMPLING * gain)
        if len(sortie) >= plafond_echantillons:
            break
        t += 1

    return sortie


def rendre_sfxr(params: Params, graine: int, *, taux: int = 44100, duree_max_s: float = 2.0):
    """Rend un son sfxr, mono, déterministe pour `(params, graine)`.

    Renvoie `(signal, taux)` — `signal` est un `np.ndarray` de forme
    `(n, 1)` en float64, dans `[-1, 1]`, prêt pour `traitement.encoder`.
    """
    if isinstance(graine, bool) or not isinstance(graine, int):
        raise SonRefuse("La graine sfxr doit être un nombre entier.")
    r = _RNG(graine)
    plafond = max(1, int(round(duree_max_s * taux)))
    bruts = _generer(params, r, plafond)
    if not bruts:
        return np.zeros((1, 1), dtype=np.float64), taux
    pic = max(abs(x) for x in bruts)
    if pic > 0.97:
        k = 0.97 / pic
        bruts = [x * k for x in bruts]
    return np.asarray(bruts, dtype=np.float64).reshape(-1, 1), taux
