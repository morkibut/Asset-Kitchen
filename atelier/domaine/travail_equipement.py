"""Demande d'images équipées : une seule pièce, des cibles exactes, aucun produit cartésien."""
import json
import math

from atelier.domaine.calques_cibles import CibleCalque
from atelier.domaine.travail import TravailRefuse


def normaliser(brut):
    defauts = {"cibles": None, "resultats": None, "methode": "planches", "cases_par_planche": 4,
        "prompt": "", "prompt_negatif": "", "repris": False, "resolution": None,
        "proportions": "1:1", "options": {}, "references": [], "references_ecartees": [],
        "tri": None, "reservation_par_appel_usd": None, "occupation": .75, "textes_appels": {}}
    if not isinstance(brut, dict) or set(brut) - set(defauts) - {"cle", "modele"}:
        raise TravailRefuse("Réglage de fabrication d'équipement inconnu.")
    d = {**defauts, **brut}
    for nom in ("cle", "modele"):
        if not isinstance(d.get(nom), str) or not d[nom].strip():
            raise TravailRefuse(f"Préciser {nom} avant la relecture.")
    if len(d["cle"]) > 200:
        raise TravailRefuse("La clé de fabrication est limitée à 200 caractères.")
    if d["methode"] not in ("planches", "images"):
        raise TravailRefuse("Choisir des planches ou un appel par image. La modification vidéo exige un workflow compatible.")
    n = d["cases_par_planche"]
    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        raise TravailRefuse("Le nombre de cases par planche doit être un entier positif.")
    for nom in ("occupation", "reservation_par_appel_usd"):
        v = d[nom]
        if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0):
            raise TravailRefuse(f"{nom} doit être une valeur positive finie.")
    if d["occupation"] is None or not 0 < d["occupation"] <= 1:
        raise TravailRefuse("L'occupation doit être supérieure à zéro et au plus égale à un.")
    if d["proportions"] != "1:1":
        raise TravailRefuse("Le pliage existant compose une planche carrée ; choisir le format 1:1.")
    for nom in ("prompt", "prompt_negatif"):
        if not isinstance(d[nom], str):
            raise TravailRefuse(f"{nom} doit être du texte.")
    if not isinstance(d["repris"], bool) or not isinstance(d["options"], dict):
        raise TravailRefuse("Le mode d'édition et les options sont invalides.")
    if not isinstance(d["textes_appels"], dict) or any(not str(k).isdigit() or not isinstance(v, str) or not v.strip() for k, v in d["textes_appels"].items()):
        raise TravailRefuse("Chaque correction de texte doit désigner un numéro d'appel et un texte non vide.")
    for nom in ("references", "references_ecartees", "resultats"):
        if d[nom] is None and nom == "resultats":
            continue
        if not isinstance(d[nom], list) or any(not isinstance(v, str) for v in d[nom]):
            raise TravailRefuse(f"{nom} doit contenir des identifiants.")
    if d["cibles"] is not None:
        if not isinstance(d["cibles"], list) or not d["cibles"]:
            raise TravailRefuse("Choisir au moins une cible, ou demander les manques.")
        try:
            d["cibles"] = [CibleCalque.depuis_json(c).en_json() for c in d["cibles"]]
        except (ValueError, TypeError, AttributeError) as e:
            raise TravailRefuse("Chaque cible désigne une image ou une occurrence de frame précise.") from e
    try:
        return json.loads(json.dumps(d, allow_nan=False))
    except (ValueError, TypeError) as e:
        raise TravailRefuse("Les réglages doivent être des valeurs JSON finies.") from e
