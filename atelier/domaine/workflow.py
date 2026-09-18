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
import secrets

from atelier.domaine.catalogue import Option
from atelier.domaine.erreurs import ErreurAtelier


class WorkflowRefuse(ErreurAtelier):
    code = "workflow_refuse"


def octets_json(valeur):
    return json.dumps(valeur, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(",", ":")).encode("utf-8")


# Le plus grand entier qu'un écran relit sans l'arrondir ; ComfyUI en accepte
# jusqu'à 2**64 - 1 sur les graines de KSampler et de RandomNoise.
GRAINE_MAX = 2**53 - 1


def tirer_graine():
    return secrets.randbelow(GRAINE_MAX + 1)


# Les réglages d'une musique (SN1). Leurs bornes sont celles que ComfyUI 0.36
# déclare pour TextEncodeAceStepAudio1.5, le seul nœud natif qui les reçoit :
# relevées dans /object_info, pas devinées. Un profil qui ne relie pas l'une de
# ces liaisons ne la reçoit jamais — la donner est un refus, pas un oubli muet.
MUSIQUE = ("paroles", "tempo", "tonalite", "mesure")
TEMPO_MIN, TEMPO_MAX = 10, 300
MESURES = (2, 3, 4, 6)
PAROLES_MAX = 10_000
TONALITES = tuple(f"{note} {mode}" for mode in ("major", "minor") for note in
    ("C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"))
# Liaisons propres au son : une image ou une vidéo n'en a pas l'usage.
_LIAISONS_SONORES = set(MUSIQUE)


def valeur_musicale(nom, valeur):
    """La valeur telle qu'elle part dans le graphe, ou un refus en clair.

    La mesure se garde en entier (2, 3, 4, 6) mais part en texte : ComfyUI la
    déclare comme un choix parmi "2", "3", "4", "6"."""
    if nom == "paroles":
        if not isinstance(valeur, str) or len(valeur) > PAROLES_MAX:
            raise WorkflowRefuse("Les paroles sont un texte de 10 000 caractères au plus.")
        return valeur
    if nom == "tempo":
        if isinstance(valeur, bool) or not isinstance(valeur, int) or not TEMPO_MIN <= valeur <= TEMPO_MAX:
            raise WorkflowRefuse(f"Le tempo est un nombre entier de battements par minute, de {TEMPO_MIN} à {TEMPO_MAX}.")
        return valeur
    if nom == "tonalite":
        if valeur not in TONALITES:
            raise WorkflowRefuse(f"La tonalité « {valeur} » n'est pas connue ; écrivez-la comme « D minor » ou « F# major ».")
        return valeur
    if nom == "mesure":
        if isinstance(valeur, bool) or valeur not in MESURES:
            raise WorkflowRefuse("La mesure compte 2, 3, 4 ou 6 temps.")
        return str(valeur)
    raise WorkflowRefuse(f"{nom} n'est pas un réglage de musique.")


def musique_du_graphe(profil):
    """Les réglages de musique que le graphe porte déjà, pour les liaisons que
    le profil déclare : ce qui part quand la demande n'en dit rien. Une valeur
    qui n'est pas écrite en toutes lettres dans le graphe n'est pas rendue."""
    graphe, liaisons = profil["graphe"], profil["liaisons"]
    trouvees = {}
    for nom in MUSIQUE:
        if nom not in liaisons:
            continue
        lien = liaisons[nom][0]
        valeur = graphe[lien["noeud"]]["inputs"].get(lien["champ"])
        if nom == "mesure" and isinstance(valeur, str) and valeur.isdigit():
            valeur = int(valeur)
        if isinstance(valeur, list):
            continue
        trouvees[nom] = valeur
    return trouvees


def _nombre(valeur):
    return not isinstance(valeur, bool) and isinstance(valeur, (float, int)) and math.isfinite(valeur)


def _secondes(s):
    """Une durée lisible en français : 42,67 s, 120 s."""
    return (f"{s:g}" if isinstance(s, int) or float(s).is_integer() else f"{s:.2f}".rstrip("0")).replace(".", ",") + " s"


def duree_acceptee(profil, secondes):
    """Une durée de la liste déclarée, ou — si le profil en déclare un — toute
    durée de son intervalle libre (une musique de 16 mesures à 90 BPM dure
    42,67 s, qu'aucune liste ne prévoit)."""
    if secondes in profil["durees"]:
        return True
    libre = profil.get("duree_libre")
    return bool(libre) and _nombre(secondes) and libre["min"] <= secondes <= libre["max"]


def _verifier_graphe(graphe, liaisons, parametres, quelle=""):
    """Valide un graphe et ses liaisons ; rend son nombre de références."""
    if not isinstance(graphe, dict) or not graphe or len(graphe) > 500 or "nodes" in graphe:
        raise WorkflowRefuse("Importer le format API de ComfyUI : un objet de nœuds avec class_type et inputs." + quelle)
    for cle, noeud in graphe.items():
        if not isinstance(noeud, dict) or not isinstance(noeud.get("class_type"), str) or not isinstance(noeud.get("inputs"), dict):
            raise WorkflowRefuse(f"Le nœud {cle} n'est pas au format API.{quelle}")
    if not isinstance(liaisons, dict) or "prompt" not in liaisons:
        raise WorkflowRefuse("Relier le texte demandé à au moins un champ du workflow." + quelle)
    references = []
    cibles = set()
    for nom_champ, liens in liaisons.items():
        # Le nombre de tirages n'est pas une liaison : un graphe rend un son.
        # Une série de N tirages sera N travaux, chacun sa graine (SN3).
        connu = nom_champ in ("prompt", "prompt_negatif", "largeur", "hauteur", "secondes", "images", "cadence", "graine", *MUSIQUE)
        if nom_champ.startswith("reference:"):
            try:
                references.append(int(nom_champ.split(":")[1]))
            except ValueError as e:
                raise WorkflowRefuse("Les références se nomment reference:0, reference:1, etc.") from e
            connu = True
        if nom_champ.startswith("option:"):
            connu = nom_champ.split(":", 1)[1] in parametres
        if not connu or not isinstance(liens, list) or not liens:
            raise WorkflowRefuse(f"La liaison {nom_champ} n'est pas déclarée ou n'a aucune cible.{quelle}")
        for lien in liens:
            if not isinstance(lien, dict):
                raise WorkflowRefuse("Chaque liaison nomme un nœud et un champ.")
            cible = (str(lien.get("noeud", "")), lien.get("champ"))
            if cible[0] not in graphe or cible[1] not in graphe[cible[0]]["inputs"] or cible in cibles:
                raise WorkflowRefuse(f"La cible {cible} manque dans le graphe ou reçoit deux valeurs.{quelle}")
            lien["noeud"] = cible[0]
            cibles.add(cible)
    if sorted(references) != list(range(len(references))) or len(references) > 16:
        raise WorkflowRefuse("Les références doivent être consécutives, de 0 à 15 au maximum." + quelle)
    return len(references)


def _variantes(d, base, liaisons, parametres, sortie):
    """Un graphe par nombre de références ; le graphe principal garde le sien."""
    brutes = d.get("variantes") or {}
    if not isinstance(brutes, dict) or d.get("nature") != "image":
        raise WorkflowRefuse("Seul un workflow d'image déclare des variantes, rangées par nombre de références.")
    variantes = {}
    communes = {n for n in liaisons if not n.startswith("reference:")}
    for cle, v in brutes.items():
        quelle = f" (variante à {cle} référence(s))"
        if not isinstance(v, dict) or not re.fullmatch(r"[0-9]{1,2}", str(cle)):
            raise WorkflowRefuse("Chaque variante se range sous son nombre de références et porte un graphe et ses liaisons.")
        nombre = _verifier_graphe(v.get("graphe"), v.get("liaisons"), parametres, quelle)
        if nombre != int(cle) or nombre == base or str(nombre) in variantes:
            raise WorkflowRefuse(f"La variante rangée sous {cle} relie {nombre} référence(s) ; chaque nombre n'a qu'un graphe.")
        if {n for n in v["liaisons"] if not n.startswith("reference:")} != communes:
            raise WorkflowRefuse("Chaque variante relie les mêmes champs que le graphe principal, références mises à part." + quelle)
        noeud = v["graphe"].get(str(sortie.get("noeud")))
        if not isinstance(noeud, dict):
            raise WorkflowRefuse("Le nœud de sortie porte le même numéro dans chaque variante." + quelle)
        variantes[str(nombre)] = {"graphe": v["graphe"], "liaisons": v["liaisons"]}
    nombres = sorted([base, *map(int, variantes)])
    if nombres != list(range(nombres[0], nombres[-1] + 1)):
        raise WorkflowRefuse("Les nombres de références acceptés doivent se suivre, sans trou.")
    return variantes, nombres[0], nombres[-1]


def _duree_libre(brut, nature, durees, liaisons):
    """`duree_libre: {"min": 1, "max": 120}`, à côté de la liste `durees`.

    La liste reste celle que l'écran propose ; l'intervalle dit ce que le
    profil accepte en plus. Chaque durée de la liste doit y tenir."""
    if brut is None:
        return None
    if nature != "audio":
        raise WorkflowRefuse("Seul un profil sonore déclare une durée libre.")
    if not isinstance(brut, dict) or set(brut) != {"min", "max"} or not all(_nombre(brut[k]) for k in ("min", "max")) \
            or not 0.1 <= brut["min"] < brut["max"] <= 600:
        raise WorkflowRefuse("La durée libre se déclare {\"min\": …, \"max\": …}, de 0,1 à 600 secondes, le minimum sous le maximum.")
    if "secondes" not in liaisons:
        raise WorkflowRefuse("Une durée libre exige une liaison des secondes dans le workflow sonore.")
    if any(not brut["min"] <= s <= brut["max"] for s in durees):
        raise WorkflowRefuse("Chaque durée proposée doit tenir dans la durée libre déclarée.")
    return {"min": brut["min"], "max": brut["max"]}


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
    parametres = d.get("parametres", {})
    if not isinstance(parametres, dict):
        raise WorkflowRefuse("Les paramètres doivent être nommés.")
    graphe, liaisons = d.get("graphe"), d.get("liaisons", {})
    references = range(_verifier_graphe(graphe, liaisons, parametres))
    if nature == "video" and len(references) != 1:
        raise WorkflowRefuse("Un workflow vidéo reçoit exactement une image de départ obligatoire.")
    if nature == "audio" and (references or {"largeur", "hauteur", "images", "cadence"}.intersection(liaisons)):
        raise WorkflowRefuse("Un profil sonore relie le texte, les secondes et ses options ; il n’utilise pas de références ou de dimensions d’image.")
    if nature != "audio" and _LIAISONS_SONORES.intersection(liaisons):
        raise WorkflowRefuse("Les paroles, le tempo, la tonalité et la mesure ne se relient que dans un profil sonore.")
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
    duree_libre = _duree_libre(d.get("duree_libre"), nature, durees, liaisons)
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
    variantes, minimum, maximum = _variantes(d, len(references), liaisons, parametres, sortie) if d.get("variantes") else ({}, len(references), len(references))
    return {"identifiant": identifiant, "nom": nom, "nature": nature, "graphe": graphe,
        "liaisons": liaisons, "parametres": parametres, "formats": formats,
        "durees": durees if nature in ("video", "audio") else [], "cadence": cadence if nature == "video" else 0,
        "pas_images": pas_images if nature == "video" else 0, "sortie": sortie,
        "references_min": minimum, "references_max": maximum,
        # Absente d'un profil à un seul graphe : sa version reste celle d'avant.
        **({"variantes": variantes} if variantes else {}),
        # Même règle pour la durée libre : un profil sans intervalle garde sa forme.
        **({"duree_libre": duree_libre} if duree_libre else {}),
        "description": str(d.get("description", ""))[:2000]}


def normaliser(brut: dict) -> dict:
    try:
        return _normaliser(brut)
    except (TypeError, KeyError, AttributeError, OverflowError) as erreur:
        raise WorkflowRefuse("Un champ du profil n'a pas le type attendu. Vérifiez ses nœuds, liaisons et paramètres.") from erreur


def version_de(profil):
    return hashlib.sha256(octets_json(profil)).hexdigest()


def graphe_pour(profil, nombre):
    """Le graphe et les liaisons que ce profil déclare pour ce nombre de références."""
    variante = (profil.get("variantes") or {}).get(str(nombre))
    if variante:
        return variante["graphe"], variante["liaisons"]
    if nombre == len([n for n in profil["liaisons"] if n.startswith("reference:")]):
        return profil["graphe"], profil["liaisons"]
    if profil["references_min"] == profil["references_max"]:
        raise WorkflowRefuse(f"Ce profil exige exactement {profil['references_min']} image(s) de référence ; {nombre} ont été jointes.")
    raise WorkflowRefuse(f"Ce profil accepte de {profil['references_min']} à {profil['references_max']} image(s) de référence ; {nombre} ont été jointes.")


def graphes(profil):
    """Tous les graphes d'un profil, pour les diagnostiquer ensemble."""
    return [(profil["graphe"], profil["liaisons"]), *((v["graphe"], v["liaisons"]) for v in (profil.get("variantes") or {}).values())]


_NOMS_MUSIQUE = {"paroles": "de paroles", "tempo": "de tempo", "tonalite": "de tonalité", "mesure": "de mesure"}


def composer(profil, *, prompt, prompt_negatif="", references=(), resolution=None, proportions="1:1", secondes=0, options=None, graine=None,
             paroles=None, tempo=None, tonalite=None, mesure=None):
    graphe_choisi, liaisons = graphe_pour(profil, len(references))
    formats = [f for f in profil["formats"] if (resolution is None or f["resolution"] == resolution) and f["proportions"] == proportions]
    if not formats and profil["nature"] != "audio":
        raise WorkflowRefuse("Cette combinaison de résolution et de proportions n'est pas déclarée par le profil.")
    valeurs = {"prompt": prompt, "prompt_negatif": prompt_negatif, **({k: formats[0][k] for k in ("largeur", "hauteur")} if formats else {})}
    if profil["nature"] == "audio":
        if not duree_acceptee(profil, secondes):
            libre = profil.get("duree_libre")
            if libre:
                raise WorkflowRefuse(f"Ce profil accepte une durée de {_secondes(libre['min'])} à {_secondes(libre['max'])}.")
            raise WorkflowRefuse("Cette durée sonore n’est pas déclarée par le profil.")
        valeurs["secondes"] = secondes
    # Une valeur omise laisse celle du graphe (musique_du_graphe la nomme) ;
    # une valeur donnée à un profil qui ne la relie pas est refusée.
    for nom, valeur in (("paroles", paroles), ("tempo", tempo), ("tonalite", tonalite), ("mesure", mesure)):
        if valeur is None:
            continue
        if nom not in liaisons:
            raise WorkflowRefuse(f"Ce profil ne reçoit pas {_NOMS_MUSIQUE[nom]}.")
        valeurs[nom] = valeur_musicale(nom, valeur)
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
    if "graine" in liaisons:
        if graine is not None and (isinstance(graine, bool) or not isinstance(graine, int) or not 0 <= graine <= GRAINE_MAX):
            raise WorkflowRefuse("La graine est un entier positif.")
        valeurs["graine"] = tirer_graine() if graine is None else graine
    graphe = copy.deepcopy(graphe_choisi)
    for nom, liens in liaisons.items():
        if nom in _LIAISONS_SONORES and nom not in valeurs:
            continue
        for lien in liens:
            graphe[lien["noeud"]]["inputs"][lien["champ"]] = valeurs[nom]
    return graphe
