# -*- coding: utf-8 -*-
"""SN10 · La musique qui s'adapte — les règles pures, sans disque ni réseau.

Un objet « musique adaptative » ne fabrique rien : il **référence** des sons
déjà faits (SN9, famille `musique`, `jingle` ou `chanson`), sous deux formes
qui peuvent coexister :

- des **couches** (calme, tension, combat…) : jouées ensemble, montées ou
  descendues en volume, elles deviendront un `AudioStreamSynchronized` — donc
  de **même durée**, pour ne jamais se décaler (archi-son §4.7, SN10 critère 2).
- des **morceaux** (exploration, combat…) et leurs **transitions** :
  deviendront un `AudioStreamInteractive` aux noms de clips stables ; une
  transition se cale par défaut sur la mesure suivante (SN10 critère 1).

**Les mesures informent, elles ne refusent jamais** (règle du produit, tenue
depuis SN3) : un tempo, une tonalité, une mesure ou une durée qui diffère
d'une couche ou d'un morceau à l'autre est **signalée**, jamais bloquante. Ce
qui bloque reste ce qui bloque déjà un son ordinaire (SN4) : une version
absente, écartée, silencieuse ou illisible ne part pas dans le paquet, mais
reste listée.

Les constantes ci-dessous ont été **vérifiées dans un vrai Godot 4.7.2**
(`Godot_v4.7.2-stable_win64_console.exe`, le 19 septembre 2026, en
construisant un `AudioStreamInteractive` par script et en relisant son
`.tres` enregistré) : `TRANSITION_FROM_TIME_*` = 0, 1, 2, 3 dans l'ordre
immédiat/prochain temps/prochaine mesure/fin ; `TRANSITION_TO_TIME_*` = 0, 1,
2 dans l'ordre même position/début/position précédente ; `FADE_*` = 0 à 4
dans l'ordre aucun/entrant/sortant/croisé/automatique ; `CLIP_ANY` = -1. Un
`.tres` écrit à la main avec seulement les clés utiles (`from_time`,
`to_time`, `fade_mode`, `fade_beats`) se relit à l'identique
(`has_transition`, `get_transition_from_time`… le confirment) : pas besoin
d'écrire `filler_clip`, `hold_previous` ou `use_filler_clip` quand on ne s'en
sert pas.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from atelier.domaine.erreurs import ErreurAtelier

# Une musique adaptative ne référence que des sons musicaux : un bruitage ou
# une ambiance n'a ni tempo ni mesure, et ne se cale jamais sur une frontière
# de mesure (archi-son §3).
FAMILLES_MUSICALES = ("musique", "jingle", "chanson")

CLE_MAX = 40
NOM_MAX = 120

# Le français de l'écran et de l'API ↔ les constantes de Godot, vérifiées
# ci-dessus. Jamais un entier deviné : voir l'en-tête de ce module.
DEPARTS = {"immediat": 0, "temps_suivant": 1, "mesure_suivante": 2, "fin": 3}
ARRIVEES = {"meme_position": 0, "debut": 1, "position_precedente": 2}
FONDUS = {"aucun": 0, "entree": 1, "sortie": 2, "croise": 3, "auto": 4}
CLIP_ANY = -1  # « * » : n'importe quel clip, des deux côtés d'une transition.

# Par défaut, une transition se cale sur la mesure suivante et fait un fondu
# croisé d'une mesure (SN10 : « les transitions se font sur la mesure
# suivante » — c'est la seule lecture de la spécification qui rend ce texte
# vrai sans qu'on ait à le redemander à chaque transition).
DEPART_DEFAUT, ARRIVEE_DEFAUT, FONDU_DEFAUT = "mesure_suivante", "debut", "croise"
FONDU_TEMPS_DEFAUT = 4.0  # battements ; 4/4 par défaut (Godot compte en temps, pas en mesures).


class MusiqueAdaptativeRefusee(ErreurAtelier):
    code = "musique_adaptative_refusee"


def cle_valide(cle, quoi="Une clé"):
    if not isinstance(cle, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", cle) or len(cle) > CLE_MAX:
        raise MusiqueAdaptativeRefusee(
            f"{quoi} se nomme en minuscules, chiffres et tirets bas, sans commencer par un chiffre.")
    return cle


def nom_valide(nom):
    if not isinstance(nom, str) or not nom.strip():
        raise MusiqueAdaptativeRefusee("Donnez un nom à cette musique adaptative.")
    return nom.strip()[:NOM_MAX]


def slug(texte):
    """Une clé lisible dérivée d'un nom, sans dépendre de `services.sons`
    (qui ajoute un préfixe de famille que les noms de clip Godot ne veulent
    pas) : minuscules ASCII, tirets bas, jamais vide."""
    ascii_ = unicodedata.normalize("NFKD", str(texte)).encode("ascii", "ignore").decode().lower()
    corps = re.sub(r"[^a-z0-9]+", "_", ascii_).strip("_")
    corps = re.sub(r"^[^a-z]+", "", corps)  # une clé commence par une lettre
    return (corps[:CLE_MAX].strip("_") or "clip")


def attributs_musicaux(son):
    """(tempo, tonalité, mesure, durée) connus d'un son musical, ou `None`
    chacun s'ils ne le sont pas. Les trois premiers viennent de sa
    provenance (SN2 : `composition.parametres`, posés par `atelier.audio.
    texte.composer_texte`) ; la durée, de ses mesures conservées (SN4)."""
    provenance = son.get("provenance") or {}
    composition = provenance.get("composition") if isinstance(provenance.get("composition"), dict) else {}
    parametres = composition.get("parametres") if isinstance(composition, dict) else None
    parametres = parametres if isinstance(parametres, dict) else {}

    def valeur(cle):
        entree = parametres.get(cle)
        return entree.get("valeur") if isinstance(entree, dict) else None
    mesures = son.get("mesures") or {}
    duree = mesures.get("duree")
    return {"tempo": valeur("tempo"), "tonalite": valeur("tonalite"), "mesure": valeur("mesure"),
            "duree": round(duree, 2) if isinstance(duree, (int, float)) else None}


_LIBELLES = {"tempo": "le tempo", "tonalite": "la tonalité", "mesure": "la mesure", "duree": "la durée"}


def ecarts_musicaux(entrees):
    """`entrees` : `[(désignation, attributs), ...]`. Un écart par attribut
    où au moins deux désignations connues diffèrent — jamais un refus, un
    simple texte à montrer (règle du produit, SN3 : « les mesures informent,
    elles ne refusent jamais », étendue ici à la cohérence musicale, SN10)."""
    signaux = []
    for cle, libelle in _LIBELLES.items():
        vues = {}
        for designation, attributs in entrees:
            v = attributs.get(cle)
            if v is not None:
                vues.setdefault(v, []).append(designation)
        if len(vues) > 1:
            detail = " ; ".join(f"{v} ({', '.join(noms)})" for v, noms in vues.items())
            signaux.append(f"{libelle.capitalize()} diffère entre les sons référencés : {detail}.")
    return signaux


@dataclass(frozen=True, slots=True)
class Couche:
    cle: str
    son: str
    volume_db: float = 0.0


@dataclass(frozen=True, slots=True)
class Morceau:
    cle: str
    son: str
    nom: str | None = None


@dataclass(frozen=True, slots=True)
class Transition:
    de: str
    vers: str
    depart: str = DEPART_DEFAUT
    arrivee: str = ARRIVEE_DEFAUT
    fondu: str = FONDU_DEFAUT
    fondu_temps: float = FONDU_TEMPS_DEFAUT


def _identifiant_son(valeur, quoi):
    if not isinstance(valeur, str) or len(valeur) != 32 or any(c not in "0123456789abcdef" for c in valeur):
        raise MusiqueAdaptativeRefusee(f"{quoi} n'existe pas dans ce jeu.")
    return valeur


def couche_depuis_json(brut):
    if not isinstance(brut, dict) or set(brut) - {"cle", "son", "volume_db"}:
        raise MusiqueAdaptativeRefusee("Une couche porte une clé, un son et, sur demande, un volume.")
    volume = brut.get("volume_db", 0.0)
    if isinstance(volume, bool) or not isinstance(volume, (int, float)) or not -80 <= volume <= 6:
        raise MusiqueAdaptativeRefusee("Le volume d'une couche est compris entre -80 et 6 dB.")
    return Couche(cle_valide(brut.get("cle"), "La clé d'une couche"), _identifiant_son(brut.get("son"), "Ce son"), float(volume))


def morceau_depuis_json(brut):
    if not isinstance(brut, dict) or set(brut) - {"cle", "son", "nom"}:
        raise MusiqueAdaptativeRefusee("Un morceau porte une clé, un son et, sur demande, un nom.")
    nom = brut.get("nom")
    if nom is not None and (not isinstance(nom, str) or not nom.strip()):
        raise MusiqueAdaptativeRefusee("Le nom d'un morceau, s'il est donné, n'est pas vide.")
    return Morceau(cle_valide(brut.get("cle"), "La clé d'un morceau"), _identifiant_son(brut.get("son"), "Ce son"),
                   nom.strip()[:NOM_MAX] if nom else None)


def _cle_clip(valeur, clefs, quoi):
    if valeur == "*":
        return "*"
    if valeur not in clefs:
        raise MusiqueAdaptativeRefusee(f"{quoi} « {valeur} » ne désigne aucun morceau de cette musique adaptative.")
    return valeur


def transition_depuis_json(brut, clefs_morceaux):
    if not isinstance(brut, dict) or set(brut) - {"de", "vers", "depart", "arrivee", "fondu", "fondu_temps"}:
        raise MusiqueAdaptativeRefusee("Une transition porte : de, vers, et sur demande depart, arrivee, fondu, fondu_temps.")
    de = _cle_clip(brut.get("de"), clefs_morceaux, "Le morceau de départ")
    vers = _cle_clip(brut.get("vers"), clefs_morceaux, "Le morceau d'arrivée")
    if de == "*" and vers == "*":
        raise MusiqueAdaptativeRefusee("Une transition part d'un morceau précis, ou y arrive, jamais ni l'un ni l'autre.")
    depart = brut.get("depart", DEPART_DEFAUT)
    if depart not in DEPARTS:
        raise MusiqueAdaptativeRefusee("Le départ d'une transition est : " + ", ".join(DEPARTS) + ".")
    arrivee = brut.get("arrivee", ARRIVEE_DEFAUT)
    if arrivee not in ARRIVEES:
        raise MusiqueAdaptativeRefusee("L'arrivée d'une transition est : " + ", ".join(ARRIVEES) + ".")
    fondu = brut.get("fondu", FONDU_DEFAUT)
    if fondu not in FONDUS:
        raise MusiqueAdaptativeRefusee("Le fondu d'une transition est : " + ", ".join(FONDUS) + ".")
    fondu_temps = brut.get("fondu_temps", FONDU_TEMPS_DEFAUT)
    if isinstance(fondu_temps, bool) or not isinstance(fondu_temps, (int, float)) or not 0 <= fondu_temps <= 64:
        raise MusiqueAdaptativeRefusee("La durée du fondu, en temps, est comprise entre 0 et 64.")
    return Transition(de, vers, depart, arrivee, fondu, float(fondu_temps))


def objet_valide(brut):
    """Valide la forme brute d'une musique adaptative (création ou remplacement
    complet des couches/morceaux/transitions) ; ne touche à aucun son."""
    if not isinstance(brut, dict) or set(brut) - {"nom", "couches", "morceaux", "transitions"}:
        raise MusiqueAdaptativeRefusee("Une musique adaptative porte : nom, couches, morceaux, transitions.")
    nom = nom_valide(brut.get("nom"))
    couches = [couche_depuis_json(c) for c in brut.get("couches") or []]
    morceaux = [morceau_depuis_json(m) for m in brut.get("morceaux") or []]
    if not couches and not morceaux:
        raise MusiqueAdaptativeRefusee("Donnez au moins une couche ou un morceau : une musique adaptative référence des sons déjà faits.")
    if len(couches) != len({c.cle for c in couches}) or len(morceaux) != len({m.cle for m in morceaux}):
        raise MusiqueAdaptativeRefusee("Deux couches, ou deux morceaux, ne portent pas la même clé.")
    clefs_morceaux = {m.cle for m in morceaux}
    transitions = [transition_depuis_json(t, clefs_morceaux) for t in brut.get("transitions") or []]
    if transitions and not morceaux:
        raise MusiqueAdaptativeRefusee("Une transition suppose des morceaux : ajoutez-en avant.")
    return {"nom": nom, "couches": couches, "morceaux": morceaux, "transitions": transitions}
