"""Réglages audio exprimés en secondes, millisecondes et décibels."""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

from atelier.domaine.erreurs import ErreurAtelier


class SonRefuse(ErreurAtelier):
    code = "son_refuse"


@dataclass(frozen=True, slots=True)
class RecetteSon:
    debut: float = 0
    fin: float | None = None
    rogner_silence: bool = False
    seuil_silence_db: float = -45
    marge_silence_ms: float = 10
    fondu_entree_ms: float = 5
    fondu_sortie_ms: float = 5
    normaliser: bool = False
    cible_db: float = -1
    gain_db: float = 0
    taux: int | None = None
    boucle: bool = False
    boucle_debut: float = 0
    boucle_fin: float | None = None
    boucle_zero: bool = False
    boucle_fondu_ms: float = 0
    # SN4, inertes par défaut : une recette ancienne rend les mêmes octets.
    mono: bool = False
    cible_lufs: float | None = None  # appliqué comme un gain, crête vraie plafonnée à −1 dBTP
    hauteur_demi_tons: float = 0
    hauteur_garde_duree: bool = False  # False : comme une bande qu'on accélère (la durée change)

    def en_json(self):
        return asdict(self)

    @classmethod
    def depuis_json(cls, brut):
        if not isinstance(brut, dict):
            raise SonRefuse("Les réglages audio doivent former une recette.")
        valeurs = asdict(cls())
        if set(brut) - set(valeurs):
            raise SonRefuse("Cette recette comporte un réglage audio inconnu.")
        limites = {"debut": (0, 600), "fin": (0, 600), "seuil_silence_db": (-100, 0),
            "marge_silence_ms": (0, 10000), "fondu_entree_ms": (0, 600000), "fondu_sortie_ms": (0, 600000),
            "cible_db": (-60, 0), "gain_db": (-60, 24), "boucle_debut": (0, 600), "boucle_fin": (0, 600),
            "boucle_fondu_ms": (0, 2000), "cible_lufs": (-40, -6), "hauteur_demi_tons": (-24, 24)}
        for nom, valeur in brut.items():
            if nom in ("rogner_silence", "normaliser", "boucle", "boucle_zero", "mono", "hauteur_garde_duree"):
                if not isinstance(valeur, bool):
                    raise SonRefuse(f"Le réglage {nom} doit être activé ou désactivé.")
            elif nom == "taux":
                if valeur is not None and (isinstance(valeur, bool) or not isinstance(valeur, int) or not 8000 <= valeur <= 192000):
                    raise SonRefuse("La fréquence de sortie doit être comprise entre 8 000 et 192 000 Hz.")
            elif valeur is None and nom in ("fin", "boucle_fin", "cible_lufs"):
                pass
            else:
                bas, haut = limites[nom]
                if isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not math.isfinite(valeur) or not bas <= valeur <= haut:
                    raise SonRefuse(f"Le réglage {nom} doit être compris entre {bas} et {haut}.")
            valeurs[nom] = valeur
        if valeurs["fin"] is not None and valeurs["fin"] <= valeurs["debut"]:
            raise SonRefuse("La fin de la coupe doit être après son début.")
        if valeurs["boucle_fin"] is not None and valeurs["boucle_fin"] <= valeurs["boucle_debut"]:
            raise SonRefuse("La fin de boucle doit être après son début.")
        return cls(**valeurs)


@dataclass(frozen=True, slots=True)
class Famille:
    """Ce qu'une famille décide à la livraison (archi-son §3, §4.6, §4.7).

    `reglages` sont proposés à la création d'une version, jamais imposés :
    l'auteur ou l'agent les prend par un geste explicite.
    """
    prefixe: str
    format: str  # "wav" (16 bits) ou "ogg" (Vorbis)
    bus: str
    reglages: dict
    qualite_ogg: int = 5


# Bruitage et interface : réglés sur la crête (le LUFS n'a pas de sens sur
# 0,2 s) ; les autres sur le niveau perçu, au milieu des fourchettes de §4.6.
FAMILLES = {
    "bruitage": Famille("sfx_", "wav", "SFX", {"mono": True, "normaliser": True, "cible_db": -3, "cible_lufs": None}),
    "interface": Famille("ui_", "wav", "UI", {"mono": True, "normaliser": True, "cible_db": -3, "cible_lufs": None}),
    "ambiance": Famille("amb_", "ogg", "SFX", {"mono": False, "normaliser": False, "cible_lufs": -26}),
    "musique": Famille("mus_", "ogg", "Music", {"mono": False, "normaliser": False, "cible_lufs": -17}),
    "chanson": Famille("mus_", "ogg", "Music", {"mono": False, "normaliser": False, "cible_lufs": -17}),
    "jingle": Famille("mus_", "ogg", "Music", {"mono": False, "normaliser": False, "cible_lufs": -17}),
    "voix": Famille("vo_", "ogg", "Voice", {"mono": True, "normaliser": False, "cible_lufs": -17}, qualite_ogg=4),
}


def famille_valide(famille):
    if famille is not None and famille not in FAMILLES:
        raise SonRefuse("Choisissez une famille parmi : " + ", ".join(FAMILLES) + ".")
    return famille


def recette_proposee(recette: dict, famille):
    """La recette donnée, avec les réglages de sa famille par-dessus."""
    if famille is None:
        return dict(recette)
    return {**RecetteSon.depuis_json(recette).en_json(), **FAMILLES[famille].reglages}
