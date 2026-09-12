"""Profil ComfyUI explicite : graphe API, entrées bornées et sortie unique.

Le graphe est un document fourni par l'auteur. Il n'est jamais exécuté lors
de son import ; les capacités déclarées deviennent le formulaire quotidien.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re

from atelier.domaine.catalogue import Option
from atelier.domaine.erreurs import ErreurAtelier


class WorkflowRefuse(ErreurAtelier):
    code = "workflow_refuse"


def octets_json(valeur):
    return json.dumps(valeur, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(",", ":")).encode("utf-8")


def _normaliser(brut: dict) -> dict:
    if not isinstance(brut, dict):
        raise WorkflowRefuse("Le profil doit être un document JSON.")
    try:
        d = json.loads(octets_json(brut))
    except (TypeError, ValueError) as e:
        raise WorkflowRefuse("Le profil doit contenir des valeurs JSON finies.") from e
    if len(octets_json(d)) > 2_000_000:
        raise WorkflowRefuse("Ce profil dépasse deux mégaoctets.")
    nom = str(d.get("nom", "")).strip()
    identifiant = d.get("identifiant") or re.sub(r"[^a-z0-9]+", "-", nom.lower()).strip("-")
    if not nom or len(nom) > 100 or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", identifiant):
        raise WorkflowRefuse("Donner un nom et un identifiant de profil en lettres minuscules, chiffres et tirets.")
    nature = d.get("nature")
    if nature not in ("image", "video", "audio"):
        raise WorkflowRefuse("Un workflow produit une image, une vidéo ou un son.")
    graphe = d.get("graphe")
    if not isinstance(graphe, dict) or not graphe or len(graphe) > 500 or "nodes" in graphe:
        raise WorkflowRefuse("Importer le format API de ComfyUI : un objet de nœuds avec class_type et inputs.")
    for cle, noeud in graphe.items():
        if not isinstance(noeud, dict) or not isinstance(noeud.get("class_type"), str) or not isinstance(noeud.get("inputs"), dict):
            raise WorkflowRefuse(f"Le nœud {cle} n'est pas au format API.")
    liaisons = d.get("liaisons", {})
    if not isinstance(liaisons, dict) or "prompt" not in liaisons:
        raise WorkflowRefuse("Relier le texte demandé à au moins un champ du workflow.")
    parametres = d.get("parametres", {})
    if not isinstance(parametres, dict):
        raise WorkflowRefuse("Les paramètres doivent être nommés.")
    references = []
    cibles = set()
    for nom_champ, liens in liaisons.items():
        connu = nom_champ in ("prompt", "prompt_negatif", "largeur", "hauteur", "secondes", "images", "cadence")
        if nom_champ.startswith("reference:"):
            try:
                references.append(int(nom_champ.split(":")[1]))
            except ValueError as e:
                raise WorkflowRefuse("Les références se nomment reference:0, reference:1, etc.") from e
            connu = True
        if nom_champ.startswith("option:"):
            connu = nom_champ.split(":", 1)[1] in parametres
        if not connu or not isinstance(liens, list) or not liens:
            raise WorkflowRefuse(f"La liaison {nom_champ} n'est pas déclarée ou n'a aucune cible.")
        for lien in liens:
            if not isinstance(lien, dict):
                raise WorkflowRefuse("Chaque liaison nomme un nœud et un champ.")
            cible = (str(lien.get("noeud", "")), lien.get("champ"))
            if cible[0] not in graphe or cible[1] not in graphe[cible[0]]["inputs"] or cible in cibles:
                raise WorkflowRefuse(f"La cible {cible} manque dans le graphe ou reçoit deux valeurs.")
            lien["noeud"] = cible[0]
            cibles.add(cible)
    if sorted(references) != list(range(len(references))) or len(references) > 16:
        raise WorkflowRefuse("Les références doivent être consécutives, de 0 à 15 au maximum.")
    if nature == "video" and len(references) != 1:
        raise WorkflowRefuse("Un workflow vidéo reçoit exactement une image de départ obligatoire.")
    if nature == "audio" and (references or {"largeur", "hauteur", "images", "cadence"}.intersection(liaisons)):
        raise WorkflowRefuse("Un profil sonore relie le texte, les secondes et ses options ; il n’utilise pas de références ou de dimensions d’image.")
    for cle, p in parametres.items():
        if not isinstance(p, dict) or "option:" + cle not in liaisons:
            raise WorkflowRefuse(f"Le paramètre {cle} doit être relié au workflow.")
        option = Option(cle, p.get("genre", ""), tuple(p.get("valeurs", [])), p.get("minimum"), p.get("maximum"))
        if "defaut" not in p or not option.accepte(p["defaut"]) or (option.genre == "booleen" and not isinstance(p["defaut"], bool)):
            raise WorkflowRefuse(f"Le paramètre {cle} doit déclarer un type et un défaut valides.")
    formats = d.get("formats", []) if nature == "audio" else d.get("formats")
    if not isinstance(formats, list) or (not formats and nature != "audio"):
        raise WorkflowRefuse("Déclarer au moins un format avec sa résolution, ses proportions, sa largeur et sa hauteur.")
    if nature == "audio" and formats:
        raise WorkflowRefuse("Un profil sonore ne déclare pas de formats d’image.")
    for f in formats:
        if not isinstance(f, dict) or not f.get("resolution") or not f.get("proportions"):
            raise WorkflowRefuse("Chaque format nomme sa résolution et ses proportions.")
        if any(not isinstance(f.get(k), int) or isinstance(f.get(k), bool) or not 8 <= f[k] <= 8192 for k in ("largeur", "hauteur")):
            raise WorkflowRefuse("Les dimensions doivent être des entiers entre 8 et 8192 pixels.")
    if len(formats) > 1 and not {"largeur", "hauteur"} <= set(liaisons):
        raise WorkflowRefuse("Plusieurs formats exigent des liaisons de largeur et de hauteur.")
    durees = d.get("durees", [])
    cadence = d.get("cadence", 0)
    pas_images = d.get("pas_images", 0)
    if nature == "audio":
        if not isinstance(durees, list) or not durees or any(isinstance(s, bool) or not isinstance(s, (float, int)) or not math.isfinite(s) or not 0.1 <= s <= 600 for s in durees):
            raise WorkflowRefuse("Déclarer les durées sonores de 0,1 à 600 secondes.")
        if len(durees) > 1 and "secondes" not in liaisons:
            raise WorkflowRefuse("Plusieurs durées exigent une liaison des secondes dans le workflow sonore.")
    if nature == "video":
        if not isinstance(durees, list) or not durees or any(not isinstance(s, int) or isinstance(s, bool) or not 1 <= s <= 120 for s in durees):
            raise WorkflowRefuse("Déclarer les durées vidéo acceptées, de 1 à 120 secondes.")
        if not isinstance(cadence, int) or isinstance(cadence, bool) or not 1 <= cadence <= 120:
            raise WorkflowRefuse("Déclarer la cadence de production, de 1 à 120 images par seconde.")
        if not isinstance(pas_images, int) or isinstance(pas_images, bool) or not 0 <= pas_images <= 64:
            raise WorkflowRefuse("Le pas d'images doit être un entier de 0 à 64.")
        if len(durees) > 1 and not {"secondes", "images"}.intersection(liaisons):
            raise WorkflowRefuse("Plusieurs durées exigent une liaison du nombre d'images ou des secondes.")
    sortie = d.get("sortie", {})
    if not isinstance(sortie, dict) or str(sortie.get("noeud")) not in graphe or sortie.get("champ") not in (("images",) if nature == "image" else ("audio",) if nature == "audio" else ("gifs", "videos")):
        raise WorkflowRefuse("Choisir le nœud de sortie : images pour une image, gifs ou videos pour un clip, audio pour un son.")
    sortie["noeud"] = str(sortie["noeud"])
    return {"identifiant": identifiant, "nom": nom, "nature": nature, "graphe": graphe,
        "liaisons": liaisons, "parametres": parametres, "formats": formats,
        "durees": durees if nature in ("video", "audio") else [], "cadence": cadence if nature == "video" else 0,
        "pas_images": pas_images if nature == "video" else 0, "sortie": sortie,
        "references_min": len(references), "references_max": len(references),
        "description": str(d.get("description", ""))[:2000]}


def normaliser(brut: dict) -> dict:
    try:
        return _normaliser(brut)
    except (TypeError, KeyError, AttributeError, OverflowError) as erreur:
        raise WorkflowRefuse("Un champ du profil n'a pas le type attendu. Vérifiez ses nœuds, liaisons et paramètres.") from erreur


def version_de(profil):
    return hashlib.sha256(octets_json(profil)).hexdigest()


def composer(profil, *, prompt, prompt_negatif="", references=(), resolution=None, proportions="1:1", secondes=0, options=None):
    if len(references) != profil["references_min"]:
        raise WorkflowRefuse(f"Ce profil exige exactement {profil['references_min']} image(s) de référence ; {len(references)} ont été jointes.")
    formats = [f for f in profil["formats"] if (resolution is None or f["resolution"] == resolution) and f["proportions"] == proportions]
    if not formats and profil["nature"] != "audio":
        raise WorkflowRefuse("Cette combinaison de résolution et de proportions n'est pas déclarée par le profil.")
    valeurs = {"prompt": prompt, "prompt_negatif": prompt_negatif, **({k: formats[0][k] for k in ("largeur", "hauteur")} if formats else {})}
    if profil["nature"] == "audio":
        if secondes not in profil["durees"]:
            raise WorkflowRefuse("Cette durée sonore n’est pas déclarée par le profil.")
        valeurs["secondes"] = secondes
    if profil["nature"] == "video":
        if secondes not in profil["durees"]:
            raise WorkflowRefuse("Cette durée n'est pas déclarée par le profil.")
        nombre = secondes * profil["cadence"]
        pas = profil["pas_images"]
        if pas:
            nombre = max(pas + 1, -(-(nombre - 1) // pas) * pas + 1)
        valeurs.update(secondes=secondes, images=nombre, cadence=profil["cadence"])
    for cle, valeur in (options or {}).items():
        if cle not in profil["parametres"]:
            raise WorkflowRefuse(f"Le paramètre {cle} n'est pas déclaré.")
    for cle, p in profil["parametres"].items():
        valeur = (options or {}).get(cle, p["defaut"])
        option = Option(cle, p["genre"], tuple(p.get("valeurs", [])), p.get("minimum"), p.get("maximum"))
        if not option.accepte(valeur) or (p["genre"] == "booleen" and not isinstance(valeur, bool)):
            raise WorkflowRefuse(f"La valeur de {cle} n'est pas acceptée par le profil.")
        valeurs["option:" + cle] = valeur
    valeurs.update({"reference:" + str(i): reference for i, reference in enumerate(references)})
    graphe = copy.deepcopy(profil["graphe"])
    for nom, liens in profil["liaisons"].items():
        for lien in liens:
            graphe[lien["noeud"]]["inputs"][lien["champ"]] = valeurs[nom]
    return graphe
