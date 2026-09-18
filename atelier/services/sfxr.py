# -*- coding: utf-8 -*-
"""Fabriquer des sons rétro par synthèse sfxr, sans ComfyUI (SN8).

sfxr calcule sur la machine, sans carte graphique : un départ type ou des
paramètres complets, plus une graine, rendent un son en un instant. Ce
service ne réimplémente rien du rangement d'un son — il compose l'algorithme
de `atelier/audio/sfxr.py` avec `ServiceSons.importer_octets`, exactement
comme un moteur ComfyUI y entrerait son rendu (`AGENTS.md`, règle 2 : `api/`
et `mcp/` ne réimplémentent jamais un fournisseur, et ici c'est le service
qui ne réimplémente jamais `ServiceSons`).

**La clé idempotente est calculée ici, jamais laissée au hasard de
l'appelant** : elle dérive des paramètres complets et de la graine, donc
deux appels identiques — un départ type rejoué, ou les mêmes paramètres
complets rejoués — retombent sur le même son plutôt que d'en dupliquer un.
"""
from __future__ import annotations

import hashlib
import json

from atelier.audio.sfxr import DEPARTS, Params, depuis_json, muter, rendre_sfxr, tirer_depart
from atelier.audio.traitement import encoder
from atelier.domaine.son import SonRefuse

MOTEUR = "sfxr (portage jsfxr)"
GRAINE_MAX = 2**31 - 1


def _valider_graine(graine) -> int:
    if isinstance(graine, bool) or not isinstance(graine, int) or not 0 <= graine <= GRAINE_MAX:
        raise SonRefuse(f"La graine doit être un nombre entier entre 0 et {GRAINE_MAX}.")
    return graine


def _valider_nombre(nombre) -> int:
    if isinstance(nombre, bool) or not isinstance(nombre, int) or not 1 <= nombre <= 16:
        raise SonRefuse("Choisissez entre 1 et 16 variantes.")
    return nombre


def _valider_nom(nom, defaut) -> str:
    if nom is None:
        return defaut
    if not isinstance(nom, str) or not nom.strip():
        raise SonRefuse("Donnez un nom au son.")
    return nom.strip()[:200]


def _resoudre(depart, parametres, graine) -> tuple[Params, str | None]:
    if (depart is None) == (parametres is None):
        raise SonRefuse("Indiquez soit un départ type sfxr, soit des paramètres complets — pas les deux, pas aucun.")
    if parametres is not None:
        return depuis_json(parametres), None
    if not isinstance(depart, str) or depart not in DEPARTS:
        raise SonRefuse(f"« {depart} » n'est pas un départ sfxr connu. Choisissez parmi : {', '.join(sorted(DEPARTS))}.")
    return tirer_depart(depart, graine), depart


def _cle(params: Params, graine: int) -> str:
    empreinte = hashlib.sha256(json.dumps(params.en_json(), sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return f"sfxr:{empreinte}:{graine}"


def _provenance(params: Params, graine: int, depart: str | None) -> dict:
    return {"nature": "sfxr", "parametres": params.en_json(), "graine": graine, "moteur": MOTEUR, "depart": depart}


class ServiceSfxr:
    def __init__(self, atelier):
        self.a = atelier

    def departs(self) -> list[str]:
        return sorted(DEPARTS)

    def fabriquer(self, projet, *, depart=None, parametres=None, graine, nom=None):
        graine = _valider_graine(graine)
        params, depart_retenu = _resoudre(depart, parametres, graine)
        signal, taux = rendre_sfxr(params, graine)
        octets = encoder(signal, taux)
        nom_final = _valider_nom(nom, f"Son rétro — {depart_retenu}" if depart_retenu else "Son rétro sfxr")
        return self.a.sons.importer_octets(projet, octets, nom=nom_final,
            provenance=_provenance(params, graine, depart_retenu), cle=_cle(params, graine))

    def variantes(self, projet, *, depart=None, parametres=None, graine, nombre=4, nom=None):
        graine = _valider_graine(graine)
        nombre = _valider_nombre(nombre)
        base, depart_retenu = _resoudre(depart, parametres, graine)
        nom_base = _valider_nom(nom, f"Son rétro — {depart_retenu}" if depart_retenu else "Son rétro sfxr")
        resultats = []
        for i in range(nombre):
            graine_variante = graine + 1 + i
            variante = muter(base, graine_variante)
            signal, taux = rendre_sfxr(variante, graine_variante)
            octets = encoder(signal, taux)
            provenance = {**_provenance(variante, graine_variante, depart_retenu),
                "mutation_de": {"parametres": base.en_json(), "graine": graine}}
            resultats.append(self.a.sons.importer_octets(projet, octets, nom=f"{nom_base} — variante {i + 1}",
                provenance=provenance, cle=_cle(variante, graine_variante)))
        return resultats
