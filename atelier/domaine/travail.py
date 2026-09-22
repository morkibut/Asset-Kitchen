"""La demande complète d'animation et le cadre durable de délégation."""

from __future__ import annotations

import math
import json
from typing import Any

from atelier.domaine.erreurs import ErreurAtelier


class TravailRefuse(ErreurAtelier):
    code = "travail_refuse"


DEFAUTS = {
    "reference_asset": None, "modele_image": None, "prompt_image": "",
    "prompt_negatif_image": "", "proportions_image": "1:1", "resolution_image": None,
    "references_image": [], "references_image_ecartees": [], "repris_image": False,
    "options_image": {}, "options_video": {},
    "secondes": 5, "resolution": "480p", "proportions": "1:1",
    "nombre_images": 8, "cadence": 8.0, "sens": "boucle",
    "livrer_provisoire": False, "plafond_image_usd": None,
    # **RV5** : le mouvement de la bibliothèque qui écrit le texte, et la
    # correction du geste pour cet appel seulement (E14). Avec un mouvement,
    # `prompt_video` devient facultatif : `ServiceTravaux.preparer` le compose
    # (`services/texte_clip.composer`) et l'écrit dans la demande conservée,
    # avant l'empreinte — le texte relu est celui qui part.
    "mouvement": None, "correction_geste": "",
}

# Les réglages arrivés après que des demandes ont déjà été conservées. Laissés à
# leur défaut, ils ne comptent pas dans l'empreinte : une demande de l'agent
# répétée avec sa clé d'avant RV5 se relit, au lieu de se voir refusée comme
# « une autre demande » parce que le dictionnaire a grandi.
TARDIFS = {"mouvement": None, "correction_geste": ""}


def pour_l_empreinte(demande: dict[str, Any]) -> dict[str, Any]:
    """La demande sans les réglages tardifs restés à leur défaut."""
    return {k: v for k, v in demande.items() if not (k in TARDIFS and v == TARDIFS[k])}


def demande_normalisee(brute: dict[str, Any], *, source_libre: bool = False) -> dict[str, Any]:
    if not isinstance(brute, dict):
        raise TravailRefuse("Une fabrication doit contenir des réglages nommés.")
    obligatoires = {"cle", "personnage", "pose", "direction", "modele_video", "prompt_video"}
    inconnus = set(brute) - obligatoires - set(DEFAUTS)
    if inconnus:
        raise TravailRefuse("Réglage de fabrication inconnu : " + ", ".join(sorted(inconnus)))
    demande = {**DEFAUTS, **brute}
    if demande["mouvement"] is not None and (not isinstance(demande["mouvement"], str) or not demande["mouvement"].strip()):
        raise TravailRefuse("« mouvement » doit être l'identifiant d'un mouvement ou rester vide.")
    if not isinstance(demande["correction_geste"], str):
        raise TravailRefuse("« correction_geste » doit être du texte.")
    if demande["correction_geste"].strip() and demande["mouvement"] is None:
        raise TravailRefuse("Une correction du geste corrige un mouvement : choisir le mouvement avec elle.")
    if demande["mouvement"] is not None:
        # Le texte sera composé par le serveur ; un texte vide à ce stade est
        # attendu. Un texte déjà écrit est comparé au composé par `preparer`.
        demande.setdefault("prompt_video", "")
        if demande["prompt_video"] is None:
            demande["prompt_video"] = ""
        obligatoires = obligatoires - {"prompt_video"}
        if not isinstance(demande["prompt_video"], str):
            raise TravailRefuse("« prompt_video » doit être du texte.")
    if source_libre:
        if any(brute.get(nom) for nom in ("personnage", "pose", "direction")):
            raise TravailRefuse("Une vidéo libre se classe dans un asset au montage ; laisser son personnage, sa pose et sa direction vides.")
        if demande["livrer_provisoire"]:
            raise TravailRefuse("Une vidéo libre doit être montée et classée avant sa livraison dans Godot.")
        obligatoires -= {"personnage", "pose", "direction"}
        demande.update(personnage=None, pose=None, direction=None)
    for nom in obligatoires:
        if not isinstance(demande.get(nom), str) or (nom != "direction" and not demande[nom].strip()):
            raise TravailRefuse(f"Préciser « {nom} » avant de préparer l'animation.")
    if len(demande["cle"]) > 200:
        raise TravailRefuse("La clé de demande ne doit pas dépasser 200 caractères.")
    for nom in ("reference_asset", "modele_image", "resolution_image"):
        if demande[nom] is not None and (not isinstance(demande[nom], str) or not demande[nom].strip()):
            raise TravailRefuse(f"« {nom} » doit être un identifiant ou rester vide.")
    for nom in ("prompt_image", "prompt_negatif_image", "proportions_image", "resolution", "proportions"):
        if not isinstance(demande[nom], str):
            raise TravailRefuse(f"« {nom} » doit être du texte.")
    for nom in ("livrer_provisoire", "repris_image"):
        if not isinstance(demande[nom], bool):
            raise TravailRefuse(f"« {nom} » doit être activé ou désactivé.")
    valeur = demande["nombre_images"]
    if not isinstance(valeur, int) or isinstance(valeur, bool) or not 1 <= valeur <= 64:
        raise TravailRefuse("« nombre_images » doit être un entier de 1 à 64.")
    # **Un réel depuis RV5** : le moteur de la maison n'accepte que 1, 1,5, 2 et
    # 3 s, et l'entier de 5 par défaut était refusé par lui. Ce que le modèle
    # choisi accepte vraiment, `ServiceAnimation.grise` le dit à la préparation.
    valeur = demande["secondes"]
    if isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not math.isfinite(valeur) or not 0 < valeur <= 60:
        raise TravailRefuse("« secondes » doit être une durée de plus de 0 et d'au plus 60 secondes.")
    cadence = demande["cadence"]
    if isinstance(cadence, bool) or not isinstance(cadence, (int, float)) or not math.isfinite(cadence) or not 0.1 <= cadence <= 120:
        raise TravailRefuse("La cadence doit être comprise entre 0,1 et 120 images par seconde.")
    if demande["sens"] not in ("boucle", "aller-retour"):
        raise TravailRefuse("Choisir boucle ou aller-retour pour le sens de lecture.")
    montant = demande["plafond_image_usd"]
    if montant is not None and (isinstance(montant, bool) or not isinstance(montant, (int, float)) or not math.isfinite(montant) or montant < 0):
        raise TravailRefuse("La réservation de l'image doit être un montant positif ou nul.")
    for nom in ("options_image", "options_video"):
        if not isinstance(demande[nom], dict):
            raise TravailRefuse(f"« {nom} » doit contenir des réglages nommés.")
    for cle in ("references_image", "references_image_ecartees"):
        if not isinstance(demande[cle], list) or any(not isinstance(r, str) for r in demande[cle]):
            raise TravailRefuse("Les références d'image doivent être une liste d'identifiants.")
    try:
        return json.loads(json.dumps(demande, allow_nan=False))
    except (ValueError, TypeError) as erreur:
        raise TravailRefuse("Les réglages doivent contenir uniquement des valeurs JSON finies.") from erreur


def sans_version(modele: str) -> str:
    """« ComfyUI:sa3-small-sfx@3f2a… » → « ComfyUI:sa3-small-sfx »."""
    return modele.split("@", 1)[0]


def moteur_sonore_permis(modele: str, permis: list[str]) -> bool:
    """Un moteur sonore se permet à l'agent par son nom, pas par sa version :
    une réinstallation (nouvelle version du profil) ne lui retire pas le droit.
    Une liste vide permet tout, comme pour l'image et la vidéo — qui, elles,
    gardent la version exacte."""
    return not permis or sans_version(modele) in {sans_version(p) for p in permis}


def cadre_valide(brut: dict[str, Any]) -> dict[str, Any]:
    defauts = {"autoriser_local": True, "autoriser_payant": False, "modeles_image": [],
               "modeles_video": [], "modeles_3d": [], "modeles_audio": [], "plafond_appels": 20, "plafond_usd": 0.0,
               # SN12 : le plafond de temps de calcul sonore de l'agent, en secondes —
               # estimé au lancement par `ServiceSeriesSon.temps`, compté sur ce qui a
               # tourné (sons et partitions de YuE2, jamais la 3D). Une demi-heure par défaut : de quoi suivre une série de bruitages
               # ou une musique sans y penser, et assez bas pour qu'un agent parti en boucle
               # se cogne avant d'avoir tourné la carte graphique toute une soirée.
               "plafond_secondes_audio": 1800.0,
               "livraison_provisoire": False}
    if set(brut) - set(defauts):
        raise TravailRefuse("Le cadre contient un réglage inconnu.")
    cadre = {**defauts, **brut}
    for cle in ("autoriser_local", "autoriser_payant", "livraison_provisoire"):
        if not isinstance(cadre[cle], bool):
            raise TravailRefuse(f"« {cle} » doit être activé ou désactivé.")
    for cle in ("modeles_image", "modeles_video", "modeles_3d", "modeles_audio"):
        if not isinstance(cadre[cle], list) or any(not isinstance(v, str) for v in cadre[cle]):
            raise TravailRefuse("Les méthodes autorisées doivent être une liste de noms fournisseur:modèle.")
    if isinstance(cadre["plafond_appels"], bool) or not isinstance(cadre["plafond_appels"], int) or cadre["plafond_appels"] < 0:
        raise TravailRefuse("Le plafond d'appels doit être un entier positif ou nul.")
    if isinstance(cadre["plafond_usd"], bool) or not isinstance(cadre["plafond_usd"], (int, float)) or not math.isfinite(cadre["plafond_usd"]) or cadre["plafond_usd"] < 0:
        raise TravailRefuse("Le budget doit être un montant positif ou nul.")
    if (isinstance(cadre["plafond_secondes_audio"], bool) or not isinstance(cadre["plafond_secondes_audio"], (int, float))
            or not math.isfinite(cadre["plafond_secondes_audio"]) or cadre["plafond_secondes_audio"] < 0):
        raise TravailRefuse("Le plafond de temps de calcul sonore doit être un nombre de secondes positif ou nul.")
    return cadre
