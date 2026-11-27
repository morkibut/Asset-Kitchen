"""RC1 · Le registre du contenu — les règles pures.

Le registre est l'endroit où l'on **montre** le contenu d'un jeu, où l'auteur le
**juge** d'un geste, et où les agents **relèvent** ce qu'il a décidé. Il vit
dans le jeu (`projets/<jeu>/registre/`), à côté de sa bible et de ses assets.
Le cadrage est dans `docs/prd-registre.md`, la construction dans
`docs/archi-registre.md`.

Trois mots, tranchés le 27 novembre 2026 :

- **une entrée** : une chose du contenu qu'on montre et qu'on juge (une
  proposition de visuel, un texte, une décision à prendre…). « Fiche »,
  « carte » et « pièce » étaient déjà pris ;
- **une remarque** : ce que l'auteur écrit sur une entrée, ou sur un de ses
  médias ; l'agent y répond dessous. « Retour » est pris par RV7 ;
- **une décision** : le geste de l'auteur — valider, demander une reprise,
  écarter, mettre en pause, prendre une proposition.

## Deux sortes de fichiers, et jamais deux mains sur le même

    projets/<jeu>/registre/
    ├─ reglages.json               les types, leurs portes, les rayons (facultatif)
    ├─ entrees/<entree>/entree.json  ce que l'agent a déposé, versions comprises
    ├─ entrees/<entree>/medias/…   les fichiers venus d'ailleurs, copiés une fois
    ├─ journal/<repere>.json       un évènement : décision, remarque, réponse…
    ├─ vu.json                     ce que l'auteur a déjà vu (l'écran seul l'écrit)
    ├─ lecteurs/<agent>.json       le repère de lecture d'un agent (lui seul)
    └─ depot/<dossier>/entree.json la boîte de dépôt des agents sans réseau

**L'état d'une entrée ne s'écrit nulle part** : il se déduit du journal, comme
le retour de RV7 se déduit des travaux. Une décision est un fichier neuf, jamais
une ligne réécrite dans un gros fichier — la leçon de `cartes.json`. Le repère
d'un évènement est trié dans le temps : « ce qui est plus grand que mon repère »
est exactement « ce que je n'ai pas encore lu ».

## L'état, dans cet ordre

1. retirée ou remplacée par l'agent → **hors de la vue** ;
2. écartée → **écartée** ; en pause → **en pause** ;
3. toutes les portes passées → **validée** (ou **intégrée**, quand l'agent l'a dit) ;
4. pas de porte du tout → **référence** ;
5. une reprise demandée sur la version courante → **reprise demandée**
   (ou **en cours**, quand l'agent a dit qu'il s'y mettait) ;
6. sinon → **à trancher**, sur la première porte non passée.

Une porte validée **reste validée** d'une version à l'autre : le brief d'un
texte validé en v1 n'est pas à revalider quand les textes arrivent en v2. Une
reprise, un choix, eux, visent une version : la v3 qui arrive après une reprise
remet l'entrée à trancher.
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Any

from atelier.domaine.erreurs import ErreurAtelier


class RegistreRefuse(ErreurAtelier):
    code = "registre_refuse"


class EntreeInconnue(ErreurAtelier):
    code = "entree_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"Aucune entrée « {identifiant} » dans le registre de ce jeu.")


# ── Ce que le jeu déclare ────────────────────────────────────────────────
#
# **Le jeu décide, jamais une liste en dur** : ces valeurs ne sont qu'un départ,
# pris tant que `registre/reglages.json` n'existe pas. Un jeu qui écrit le sien
# remplace tout le bloc qu'il écrit.

PORTE_UNIQUE = [{"cle": "validation", "nom": "Validation"}]

TYPES_DEFAUT: list[dict[str, Any]] = [
    {"cle": "visuel", "nom": "Proposition de visuel", "portes": PORTE_UNIQUE},
    {"cle": "son", "nom": "Proposition de son", "portes": PORTE_UNIQUE},
    {"cle": "planche", "nom": "Cinématique ou planche", "portes": PORTE_UNIQUE},
    {"cle": "texte", "nom": "Texte", "portes": [{"cle": "brief", "nom": "Le brief"},
                                                 {"cle": "textes", "nom": "Les textes"}]},
    {"cle": "personnage", "nom": "Personnage", "portes": PORTE_UNIQUE},
    {"cle": "decision", "nom": "Décision à prendre", "portes": PORTE_UNIQUE},
    {"cle": "reference", "nom": "Document de référence", "portes": []},
]

RAYONS_DEFAUT: list[dict[str, str]] = [
    {"cle": cle, "nom": nom} for cle, nom in (
        ("visuels", "Visuels"), ("sons", "Sons"), ("textes", "Textes"), ("quetes", "Quêtes"),
        ("personnages", "Personnages"), ("decors", "Décors"), ("interface", "Interface"),
        ("lore", "Univers"), ("systemes", "Systèmes"),
    )
]

# Les états, avec le mot que l'écran affiche. Fermés : l'agent les lit par
# `list_entry_types` et n'en écrit jamais un autre.
ETATS = {
    "a-trancher": "À trancher",
    "reprise-demandee": "Reprise demandée",
    "en-cours": "En cours",
    "validee": "Validée",
    "integree": "Intégrée au jeu",
    "reference": "Référence",
    "en-pause": "En pause",
    "ecartee": "Écartée",
    "retiree": "Retirée",
    "remplacee": "Remplacée",
}
HORS_VUE = {"ecartee", "retiree", "remplacee"}

GESTES = {"valider", "reprise", "ecarter", "pause", "relancer"}
SORTES_DE_REMARQUE = {"remarque": "Remarque", "question": "Question", "aime": "J'aime"}
ETATS_DE_REMARQUE = {"envoyee": "Envoyée", "vue": "Vue", "en-cours": "En cours", "faite": "Faite", "refusee": "Refusée"}
STATUTS_D_AGENT = {"en-cours", "integree", "retiree", "remplacee"}

AUTEUR = "auteur"  # qui signe ce que l'auteur fait à l'écran

GENRES_DE_MEDIA = {
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image",
    ".mp4": "video", ".webm": "video", ".mov": "video",
    ".wav": "audio", ".ogg": "audio", ".mp3": "audio", ".flac": "audio",
    ".md": "texte", ".txt": "texte",
}
SOUS_TITRES = {".vtt"}

_IDENTIFIANT = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")


def identifiant_valide(brut: Any, quoi: str = "L'identifiant d'une entrée") -> str:
    if not isinstance(brut, str) or not _IDENTIFIANT.match(brut):
        raise RegistreRefuse(f"{quoi} s'écrit en minuscules, chiffres et tirets "
                             f"(80 signes au plus), par exemple « heros-portrait ».")
    return brut


def nouvel_identifiant(titre: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", _sans_accents(titre.lower())).strip("-")[:60] or "entree"
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _sans_accents(texte: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")


def nouveau_repere(maintenant: float | None = None) -> str:
    """Un repère d'évènement **trié dans le temps** : vingt chiffres de
    nanosecondes, puis du hasard. Deux évènements de la même nanoseconde
    restent deux fichiers."""
    ns = int((maintenant if maintenant is not None else time.time()) * 1e9)
    return f"{ns:020d}-{uuid.uuid4().hex[:8]}"


def reglages_valides(brut: Any) -> dict[str, Any]:
    """`reglages.json` → types et rayons, chaque bloc absent pris au départ."""
    if brut is None:
        brut = {}
    if not isinstance(brut, dict):
        raise RegistreRefuse("reglages.json doit être un objet {types, rayons}.")
    types = brut.get("types", TYPES_DEFAUT)
    rayons = brut.get("rayons", RAYONS_DEFAUT)
    if not isinstance(types, list) or not all(isinstance(t, dict) and t.get("cle") for t in types):
        raise RegistreRefuse("reglages.json : chaque type porte au moins une clé.")
    if not isinstance(rayons, list) or not all(isinstance(r, dict) and r.get("cle") for r in rayons):
        raise RegistreRefuse("reglages.json : chaque rayon porte au moins une clé.")
    return {
        "types": [{"cle": t["cle"], "nom": t.get("nom") or t["cle"],
                   "portes": [{"cle": p["cle"], "nom": p.get("nom") or p["cle"]} for p in t.get("portes", PORTE_UNIQUE)]}
                  for t in types],
        "rayons": [{"cle": r["cle"], "nom": r.get("nom") or r["cle"]} for r in rayons],
    }


# ── Un dépôt ─────────────────────────────────────────────────────────────

CHAMPS_DU_DEPOT = {"identifiant", "type", "titre", "resume", "corps", "rayon", "groupe", "auteur",
                   "choix", "medias", "change", "attend"}
CHAMPS_DU_MEDIA = {"fichier", "asset", "code", "legende", "defauts", "conseil", "provenance", "sous_titres"}


def depot_valide(brut: Any, reglages: dict[str, Any], *, par_l_auteur: bool = False) -> dict[str, Any]:
    """Ce qu'un agent dépose, **contrôlé** : un type ou un rayon inconnu, un
    média sans source, un champ mal orthographié se refusent avec ce qu'il faut
    corriger — jamais ignorés en silence. Les fichiers ne sont pas lus ici."""
    if not isinstance(brut, dict):
        raise RegistreRefuse("Une entrée se dépose comme un objet JSON.")
    inconnus = sorted(set(brut) - CHAMPS_DU_DEPOT)
    if inconnus:
        raise RegistreRefuse(f"Champ inconnu : {', '.join(inconnus)}. Champs permis : {', '.join(sorted(CHAMPS_DU_DEPOT))}.")
    types = {t["cle"]: t for t in reglages["types"]}
    rayons = {r["cle"] for r in reglages["rayons"]}
    if brut.get("type") not in types:
        raise RegistreRefuse(f"Type « {brut.get('type')} » inconnu dans ce jeu. Types déclarés : {', '.join(types)}.")
    titre = brut.get("titre")
    if not isinstance(titre, str) or not titre.strip():
        raise RegistreRefuse("Une entrée a un titre.")
    auteur = brut.get("auteur")
    if not isinstance(auteur, str) or not auteur.strip():
        raise RegistreRefuse("Une entrée dit qui l'a déposée (« auteur » : le nom de l'agent ou du fil).")
    if auteur.strip() == AUTEUR and not par_l_auteur:
        raise RegistreRefuse(f"« {AUTEUR} » est réservé à l'auteur du jeu : un agent signe de son propre nom.")
    rayon = brut.get("rayon")
    if rayon is not None and rayon not in rayons:
        raise RegistreRefuse(f"Rayon « {rayon} » inconnu dans ce jeu. Rayons déclarés : {', '.join(sorted(rayons))}.")
    for champ in ("resume", "corps", "groupe", "change", "attend"):
        if brut.get(champ) is not None and not isinstance(brut[champ], str):
            raise RegistreRefuse(f"« {champ} » est un texte.")
    if "choix" in brut and not isinstance(brut["choix"], bool):
        raise RegistreRefuse("« choix » vaut true ou false.")
    medias_bruts = brut.get("medias", [])
    if not isinstance(medias_bruts, list):
        raise RegistreRefuse("« medias » est une liste.")
    medias, codes = [], set()
    for rang, m in enumerate(medias_bruts, 1):
        if not isinstance(m, dict):
            raise RegistreRefuse(f"Le média {rang} doit être un objet.")
        inconnus = sorted(set(m) - CHAMPS_DU_MEDIA)
        if inconnus:
            raise RegistreRefuse(f"Média {rang} : champ inconnu {', '.join(inconnus)}. Champs permis : {', '.join(sorted(CHAMPS_DU_MEDIA))}.")
        if bool(m.get("fichier")) == bool(m.get("asset")):
            raise RegistreRefuse(f"Média {rang} : donnez soit « fichier » (un chemin), soit « asset » (un identifiant de la bibliothèque).")
        if m.get("fichier"):
            ext = "." + str(m["fichier"]).rsplit(".", 1)[-1].lower() if "." in str(m["fichier"]) else ""
            if ext not in GENRES_DE_MEDIA:
                raise RegistreRefuse(f"Média {rang} : « {m['fichier']} » n'est ni une image, ni une vidéo, ni un son, ni un texte "
                                     f"({', '.join(sorted(GENRES_DE_MEDIA))}).")
        code = m.get("code") or _code_depuis(m, rang)
        code = identifiant_valide(code, f"Le code du média {rang}")
        if code in codes:
            raise RegistreRefuse(f"Deux médias portent le code « {code} » : chaque proposition a le sien.")
        codes.add(code)
        if "conseil" in m and not isinstance(m["conseil"], bool):
            raise RegistreRefuse(f"Média {rang} : « conseil » vaut true ou false.")
        medias.append({k: v for k, v in m.items() if v is not None} | {"code": code})
    if brut.get("choix") and len(medias) < 2:
        raise RegistreRefuse("Une entrée à choix porte au moins deux propositions.")
    identifiant = identifiant_valide(brut["identifiant"]) if brut.get("identifiant") else nouvel_identifiant(titre)
    return {
        "identifiant": identifiant, "type": brut["type"], "titre": titre.strip(),
        "resume": (brut.get("resume") or "").strip(), "corps": brut.get("corps") or "",
        "rayon": rayon, "groupe": (brut.get("groupe") or "").strip() or None,
        "auteur": auteur.strip(), "choix": bool(brut.get("choix")), "medias": medias,
        "change": (brut.get("change") or "").strip() or None, "attend": (brut.get("attend") or "").strip() or None,
    }


def _code_depuis(media: dict[str, Any], rang: int) -> str:
    source = str(media.get("fichier") or media.get("asset") or "")
    nom = re.split(r"[\\/]", source)[-1].rsplit(".", 1)[0]
    code = re.sub(r"[^a-z0-9]+", "-", _sans_accents(nom.lower())).strip("-")[:60]
    return code or f"media-{rang}"


# ── L'état, déduit du journal ────────────────────────────────────────────


def evenements_valides(evenements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Les évènements dans l'ordre, **sans ceux qu'on a annulés** (ni les
    annulations elles-mêmes)."""
    tries = sorted(evenements, key=lambda e: e["repere"])
    annules = {e["annule"] for e in tries if e["genre"] == "annulation"}
    return [e for e in tries if e["genre"] != "annulation" and e["repere"] not in annules]


def etat_de_l_entree(entree: dict[str, Any], evenements: list[dict[str, Any]], type_: dict[str, Any]) -> dict[str, Any]:
    """L'état d'une entrée, ses portes et son choix, depuis ses évènements."""
    evs = evenements_valides([e for e in evenements if e.get("entree") == entree["identifiant"]])
    version = entree["versions"][-1]["numero"] if entree.get("versions") else 0
    portes = [p["cle"] for p in type_["portes"]]
    passees: list[str] = []
    retrait = pause = statut_agent = None
    reprise = None
    pris: list[str] | None = None
    attend = entree.get("attend")
    for e in evs:
        g = e["genre"]
        if g == "decision":
            geste = e["geste"]
            if geste == "valider" and e.get("porte") in portes and e["porte"] not in passees:
                passees.append(e["porte"])
                reprise = None
            elif geste == "reprise":
                reprise = e
            elif geste in ("ecarter", "pause"):
                pause = geste
            elif geste == "relancer":
                pause = None
        elif g == "choix" and e.get("version") == version:
            pris = list(e.get("codes") or [])
        elif g == "statut":
            if e["statut"] in ("retiree", "remplacee"):
                retrait = e
            else:
                statut_agent = e["statut"]
        elif g == "attente":
            attend = e.get("texte") or None
        elif g == "version":
            statut_agent = None if statut_agent == "en-cours" else statut_agent
    if reprise is not None and reprise.get("version") != version:
        reprise = None  # une version neuve est arrivée après la reprise
    porte = next((p for p in portes if p not in passees), None)
    if retrait is not None:
        etat = retrait["statut"]
    elif pause == "ecarter":
        etat = "ecartee"
    elif pause == "pause":
        etat = "en-pause"
    elif not portes:
        etat = "reference"
    elif porte is None:
        etat = "integree" if statut_agent == "integree" else "validee"
    elif reprise is not None:
        etat = "en-cours" if statut_agent == "en-cours" else "reprise-demandee"
    else:
        etat = "a-trancher"
    return {
        "etat": etat, "nom_etat": ETATS[etat], "hors_vue": etat in HORS_VUE,
        "porte": porte, "nom_porte": next((p["nom"] for p in type_["portes"] if p["cle"] == porte), None),
        "portes": [{"cle": p["cle"], "nom": p["nom"], "passee": p["cle"] in passees} for p in type_["portes"]],
        "pris": pris, "reprise": reprise.get("mot") if reprise else None,
        "attend": attend if etat in ("a-trancher", "reprise-demandee") else None,
        "remplacee_par": retrait.get("par") if retrait else None,
    }


def etat_des_remarques(evenements: list[dict[str, Any]], entree: str) -> list[dict[str, Any]]:
    """Les remarques d'une entrée, chacune avec ses réponses et où elle en est."""
    evs = evenements_valides([e for e in evenements if e.get("entree") == entree])
    remarques: dict[str, dict[str, Any]] = {}
    for e in evs:
        if e["genre"] == "remarque":
            remarques[e["repere"]] = {"repere": e["repere"], "le": e["le"], "qui": e["qui"], "texte": e["texte"],
                                      "sorte": e.get("sorte", "remarque"), "cible": e.get("cible"),
                                      "version": e.get("version"), "etat": "envoyee", "reponses": []}
        elif e["genre"] == "reponse" and e.get("remarque") in remarques:
            r = remarques[e["remarque"]]
            r["reponses"].append({"repere": e["repere"], "le": e["le"], "qui": e["qui"], "texte": e.get("texte") or "",
                                  "etat": e.get("etat")})
            if e.get("etat"):
                r["etat"] = e["etat"]
    for r in remarques.values():
        r["nom_etat"] = ETATS_DE_REMARQUE[r["etat"]]
    return list(remarques.values())
