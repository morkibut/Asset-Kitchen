# -*- coding: utf-8 -*-
"""SN0 : le banc des cinq moteurs sonores, sur la machine de l'auteur.

**Ce que ce fichier fait, et rien d'autre.** Il envoie à ComfyUI (127.0.0.1:8188)
les profils sonores que `atelier/audio/graphes.py` sait construire — Stable
Audio 3 Small-SFX, Stable Audio 3 Medium, Stable Audio Open 1.0, ACE-Step 1.5
turbo, YuE2 — avec le programme de douze bruitages, trois ambiances, deux
musiques et une chanson écrit dans `docs/PLAN-son.md` (tranche SN0). Il relève
pour chaque tirage le temps de calcul, le pic de mémoire de la carte et les
mesures de `atelier/audio/traitement.py` (durée, taux, canaux, crête, RMS,
LUFS, dBTP, silence, saturation), et produit une page d'écoute locale.

Deux modes :

    .venv\\Scripts\\python.exe essais/banc_son.py --verifier
        Lecture seule : object_info, fichiers de poids présents ou
        manquants, chaque graphe du programme vérifié nœud par nœud et
        valeur par valeur, nombre de tirages et estimation de durée.
        C'est le mode par défaut.

    .venv\\Scripts\\python.exe essais/banc_son.py --lancer [--moteur ID] [--graines N]
        Soumet réellement les tirages, un moteur à la fois, et écrit les
        fichiers audio, les mesures et la page d'écoute dans
        essais/resultats/banc_son/<date>/. Reprend une série interrompue
        (un tirage déjà rendu n'est pas refait) ; s'arrête proprement au
        Ctrl+C. **N'appelle jamais ce mode toi-même** : c'est l'auteur qui
        lance le calcul, une fois les poids téléchargés.

**Le score CLAP n'est pas mesuré ici** (il faudrait installer PyTorch dans cet
atelier, ce qui est exclu — voir MEMOIRE, "n'installe aucun paquet dans ce
venv"). Pour l'ajouter plus tard, dans un environnement Python séparé :

    pip install laion-clap torch --index-url ...   # environnement à part
    import laion_clap
    modele = laion_clap.CLAP_Module(enable_fusion=False)
    modele.load_ckpt()  # poids publics laion/clap-htsat-unfused
    score = modele.get_audio_embedding_from_filelist([fichier]) @ \\
        modele.get_text_embedding([texte_qui_est_parti])
    # Un score par tirage, à ajouter dans mesures.json sous "clap" : le tri
    # se compare alors à l'écoute humaine (case "gardé" de la page).

Ce fichier n'importe que deux modules de l'atelier, tous deux en lecture :
`atelier.audio.graphes` (les constructeurs de graphe et la fiche des poids)
et `atelier.audio.traitement` (decoder, mesurer). Rien d'autre n'est touché.
"""
from __future__ import annotations

import argparse
import copy
import json
import subprocess
import sys
import threading
import time
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(DEPOT))

from atelier.audio.graphes import CONSTRUCTEURS, FICHIERS, fichiers_requis  # noqa: E402
from atelier.audio.traitement import decoder, mesurer  # noqa: E402

COMFY = "http://127.0.0.1:8188"
CLIENT_ID = "asset-kitchen-banc-son"
RESULTATS = RACINE / "resultats" / "banc_son"
CHAMPS_FICHIER = ("ckpt_name", "clip_name", "clip_name1", "clip_name2", "unet_name", "vae_name")

# Le second encodeur d'ACE-Step 1.5 : graphes.py ne le nomme pas dans FICHIERS
# (il n'est pas retenu par défaut — trop lourd, voir docs/PLAN-son.md) mais
# SN0 doit éprouver la variante s'il est présent sur le disque.
FICHIER_ACE_1_7B = "qwen_1.7b_ace15.safetensors"
FICHE_ACE_1_7B = {"dossier": "text_encoders", "taille": "3,7 Go",
    "source": "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/text_encoders/qwen_1.7b_ace15.safetensors"}


# ─────────────────────────────────────────────────────────────────────────
# Le programme SN0 (docs/PLAN-son.md) : les prompts, tels qu'écrits dans les
# relevés sourcés, plus les paroles de la chanson de taverne (écrites ici,
# en anglais, comme le veut la tranche).
# ─────────────────────────────────────────────────────────────────────────

# docs/releves/2026-09-18-son-bruitages.md §6.3 : douze prompts (Small-SFX).
_BRUITAGES = [
    ("ui-clic", "bruitage", 1,
     "TrackType: SFX. Soft plastic UI button click, single short tick, close-mic'd, dry, no reverb, isolated, fast decay"),
    ("ui-validation", "bruitage", 1,
     "TrackType: SFX. Bright two-note confirmation chime, clean synth bell, rising interval, dry, short tail, game menu sound"),
    ("ui-erreur", "bruitage", 1,
     "TrackType: SFX. Low dull buzzer, short negative error beep, two quick descending tones, dry, isolated"),
    ("coup-epee", "bruitage", 1.5,
     "TrackType: SFX. Steel sword slash whoosh followed by a sharp metal impact, one-shot, close-mic'd foley, dry, punchy transient"),
    ("impact-contondant", "bruitage", 1,
     "TrackType: SFX. Heavy wooden club hitting a leather armor, dull thud, single hit, close-mic'd, no room reverb"),
    ("pas-herbe", "bruitage", 1,
     "TrackType: SFX. Single footstep of a leather boot on dry grass, soft crunch, close-mic'd foley, isolated, dry"),
    ("pas-pierre", "bruitage", 1,
     "TrackType: SFX. Single footstep of a hard boot on stone floor, sharp tap with slight grit, close-mic'd, dry, no echo"),
    ("objet-ramasse", "bruitage", 1,
     "TrackType: SFX. Small gold coin pickup, bright metallic clink with a short sparkle, one-shot, clean, dry"),
    ("sort-feu", "bruitage", 2.5,
     "TrackType: SFX. Fireball spell cast, quick whoosh ignition building into a roaring burst of flame, one-shot, punchy, no background"),
    ("creature", "bruitage", 2,
     "TrackType: SFX. Small cave creature hiss and chitter, wet clicking insect-like sounds, non-vocal, close-mic'd, dry"),
    ("ambiance-foret", "ambiance", 30,
     "TrackType: SFX. Calm forest ambience, gentle wind in leaves, distant birds, steady and continuous, no music, field recording, stereo"),
    ("ambiance-pluie-grotte", "ambiance", 30,
     "TrackType: SFX. Steady rain on stone, water drips echoing in a cave, continuous ambience, no thunder, no music, stereo field recording"),
    # La troisième ambiance, écrite dans docs/PLAN-son.md (SN0), pas dans le relevé.
    ("ambiance-marche-medieval", "ambiance", 30,
     "TrackType: SFX. Busy medieval market square, distant chatter without words, cart wheels on cobblestone, "
     "continuous ambience, no music, stereo field recording"),
]

# docs/releves/2026-09-18-son-musique.md §3 (tableau ACE-Step 1.5) : tags,
# paroles, tempo, tonalité, mesure. Durée = mesures × mesure × 60 / tempo.
_MUSIQUE_ACE = [
    ("exploration", "ambient exploration, soft pads, celesta, harp arpeggios, sparse percussion, calm, mysterious, loopable",
     "[Instrumental]", 90, "D minor", 4, 64),
    ("combat", "JRPG battle theme, driving drums, electric bass, staccato strings, brass, energetic, heroic",
     "[Intro - short]\n[Instrumental]\n[Build]\n[Instrumental]", 150, "E minor", 4, 64),
]

# docs/releves/2026-09-18-son-musique.md §2 (tableau YuE2) : la tentative
# instrumentale du combat est prise telle quelle (tonalité D minor, y compris
# l'écart avec la version ACE-Step ci-dessus — le relevé les a écrites ainsi,
# à deux tables différentes ; le banc les envoie sans les réconcilier).
# L'exploration n'a pas d'entrée YuE2 dans le relevé (il dit même de ne pas
# l'y envoyer) : ce prompt est écrit ici, sur les mêmes réglages musicaux
# (90 BPM, D minor) que sa version ACE-Step, pour que SN0 tranche sur pièces
# comme le demande docs/PLAN-son.md.
_MUSIQUE_YUE2_INSTRUMENTAL = [
    ("exploration", "instrumental, ambient exploration, soft pads, celesta, harp arpeggios, sparse percussion, "
     "calm, mysterious, 90 BPM, D minor, no vocals", "[Intro]\n[Instrumental]\n[Instrumental]\n[Outro]", 64),
    ("combat", "instrumental, epic orchestral battle, taiko drums, staccato strings, brass stabs, 150 BPM, D minor, no vocals",
     "[Intro]\n[Instrumental]\n[Instrumental]\n[Outro]", 64),
]

# Chanson de taverne : style du relevé musique §2, paroles écrites ici (en
# anglais, courtes, sections marquées comme le veut le gabarit YuE2 §4.2 de
# docs/archi-son.md).
_TAVERNE_STYLE = "English, folk, medieval tavern song, warm male vocal, lute, fiddle, tin whistle, frame drum, cheerful, 100 BPM, 6/8"
_TAVERNE_PAROLES = (
    "[Intro]\n"
    "[Verse]\n"
    "Raise your mugs and clear the floor,\n"
    "travelers knocking at the door,\n"
    "ale is flowing, stories told,\n"
    "warm the night against the cold.\n"
    "[Chorus]\n"
    "Drink and sing till break of day,\n"
    "laughter chases cares away,\n"
    "one more round before we part,\n"
    "the tavern keeps a merry heart.\n"
    "[Outro]"
)
_TAVERNE_SECONDES = 60


def construire_programme(encodeur_1_7b_present: bool) -> list[dict]:
    """Le programme SN0, en items {moteur, cle, categorie, description, champs}.

    `champs` sont les arguments de `composer_graphe` : ce que le graphe
    reçoit réellement (prompt, secondes, tempo...). La variante ACE-Step au
    grand encodeur n'est ajoutée que si `qwen_1.7b_ace15.safetensors` est
    présent — sinon le programme n'en parle pas, le diagnostic suffit.
    """
    programme = []
    for cle, categorie, secondes, prompt in _BRUITAGES:
        programme.append({"moteur": "sa3-small-sfx", "cle": cle, "categorie": categorie,
            "description": prompt, "champs": {"prompt": prompt, "secondes": secondes}})
    for cle, tags, paroles, tempo, tonalite, mesure, secondes in _MUSIQUE_ACE:
        programme.append({"moteur": "ace-step-15-turbo", "cle": cle, "categorie": "musique",
            "description": tags, "champs": {"prompt": tags, "paroles": paroles, "tempo": tempo,
                "tonalite": tonalite, "mesure": mesure, "secondes": secondes}})
    for cle, style, paroles, secondes in _MUSIQUE_YUE2_INSTRUMENTAL:
        programme.append({"moteur": "yue2-int8", "cle": cle + "-instrumental", "categorie": "musique",
            "description": style, "champs": {"prompt": style, "paroles": paroles, "secondes": secondes}})
    programme.append({"moteur": "yue2-int8", "cle": "taverne", "categorie": "chanson",
        "description": _TAVERNE_STYLE, "champs": {"prompt": _TAVERNE_STYLE, "paroles": _TAVERNE_PAROLES,
            "secondes": _TAVERNE_SECONDES}})
    if encodeur_1_7b_present:
        cle, tags, paroles, tempo, tonalite, mesure, secondes = ("combat",) + _MUSIQUE_ACE[1][1:]
        programme.append({"moteur": "ace-step-15-turbo-1.7b", "cle": cle, "categorie": "musique",
            "description": tags + " (encodeur qwen_1.7b_ace15, codes audio activés)",
            "champs": {"prompt": tags, "paroles": paroles, "tempo": tempo, "tonalite": tonalite,
                "mesure": mesure, "secondes": secondes}})
    return programme


def profil_de(identifiant: str) -> dict:
    """Le profil d'un identifiant du programme — y compris la variante 1.7b,
    qui n'existe pas dans `CONSTRUCTEURS` : un `ace-step-15-turbo` dont le
    second emplacement de `DualCLIPLoader` reçoit le grand encodeur, et dont
    `generate_audio_codes` s'active (sans le 1.7b, ce réglage est coupé —
    voir le commentaire de tête de `atelier/audio/graphes.py`)."""
    if identifiant == "ace-step-15-turbo-1.7b":
        profil = copy.deepcopy(CONSTRUCTEURS["ace-step-15-turbo"]())
        profil["graphe"]["3"]["inputs"]["clip_name2"] = FICHIER_ACE_1_7B
        profil["graphe"]["5"]["inputs"]["generate_audio_codes"] = True
        profil["identifiant"] = identifiant
        return profil
    return CONSTRUCTEURS[identifiant]()


# ─────────────────────────────────────────────────────────────────────────
# Composer un graphe réel, et le vérifier contre un /object_info — sans
# dépendre de atelier.domaine.workflow (ce banc n'importe que graphes.py et
# traitement.py, voir l'en-tête).
# ─────────────────────────────────────────────────────────────────────────


def composer_graphe(profil: dict, *, graine: int, **valeurs) -> dict:
    graphe = copy.deepcopy(profil["graphe"])
    liaisons = profil["liaisons"]

    def poser(cle, valeur):
        for lien in liaisons.get(cle, ()):
            graphe[lien["noeud"]]["inputs"][lien["champ"]] = valeur

    poser("graine", graine)
    for cle, valeur in valeurs.items():
        if valeur is None:
            continue
        if cle == "mesure":
            valeur = str(valeur)
        if cle == "langue":
            poser("option:langue", valeur)
            continue
        poser(cle, valeur)
    return graphe


def _choix(declaration):
    if not declaration:
        return None
    if isinstance(declaration[0], list):
        return declaration[0]
    if declaration[0] == "COMBO":
        return declaration[1].get("options")
    return None


def diagnostiquer_graphe(graphe: dict, info: dict) -> list[str]:
    """Chaque nœud du graphe existe dans `info` (l'object_info d'un
    ComfyUI), chaque champ obligatoire est fourni, et chaque valeur qui
    vient d'une liste de choix (fichier de poids compris) y figure."""
    problemes = []
    for identifiant, noeud in graphe.items():
        classe = noeud["class_type"]
        definition = info.get(classe)
        if not definition:
            problemes.append(f"{identifiant} ({classe}) : nœud absent de cette installation ComfyUI.")
            continue
        entree = definition.get("input", {})
        champs = {**entree.get("required", {}), **entree.get("optional", {})}
        for champ in entree.get("required", {}):
            if champ not in noeud["inputs"]:
                problemes.append(f"{identifiant} ({classe}) : le champ obligatoire {champ} manque.")
        for champ, valeur in noeud["inputs"].items():
            if isinstance(valeur, list):
                continue  # une liaison entre nœuds, pas une valeur à choix
            if champ not in champs:
                problemes.append(f"{identifiant} ({classe}) : le champ {champ} n'est pas déclaré par cette installation.")
                continue
            choix = _choix(champs[champ])
            if choix is None:
                continue
            if valeur not in choix and str(valeur) not in [str(c) for c in choix]:
                marque = "poids absent" if champ in CHAMPS_FICHIER else "valeur absente"
                problemes.append(f"{identifiant} ({classe}) / {champ} : « {valeur} » — {marque} des choix installés.")
    return problemes


def poids_du_profil(profil: dict, info: dict) -> list[dict]:
    """Les fichiers de poids que ce profil nomme, présents ou non dans les
    choix installés de leur nœud chargeur."""
    lignes, vus = [], set()
    for noeud in profil["graphe"].values():
        classe = noeud["class_type"]
        definition = info.get(classe, {})
        entree = definition.get("input", {})
        champs = {**entree.get("required", {}), **entree.get("optional", {})}
        for champ, valeur in noeud["inputs"].items():
            if champ not in CHAMPS_FICHIER or valeur in vus:
                continue
            vus.add(valeur)
            choix = _choix(champs.get(champ)) or []
            fiche = FICHIERS.get(valeur) or (FICHE_ACE_1_7B if valeur == FICHIER_ACE_1_7B else {})
            lignes.append({"fichier": valeur, "present": valeur in choix,
                "dossier": fiche.get("dossier", "?"), "source": fiche.get("source", "?")})
    return lignes


# ─────────────────────────────────────────────────────────────────────────
# --verifier : lecture seule.
# ─────────────────────────────────────────────────────────────────────────

# Hypothèses de durée, en secondes par tirage, faute de mesure réelle : à
# remplacer par les chiffres du banc dès qu'un --lancer aura tourné. Les
# bruitages courts et les ambiances de 30 s partagent 8 pas (échantillonneur
# LCM) ; ACE-Step turbo aussi, mais un rendu plus long ; YuE2 écrit d'abord
# une partition (un passage du modèle de langage) puis échantillonne à 32 pas
# — nettement plus lourd, d'après docs/archi-son.md §4.3 ("une à trois
# minutes" par morceau).
_HYPOTHESES_SECONDES = {
    "bruitage": 8, "ambiance": 20, "musique-ace": 25, "musique-yue2": 100, "chanson": 100,
}


def _hypothese(item: dict) -> float:
    if item["moteur"].startswith("ace-step"):
        return _HYPOTHESES_SECONDES["musique-ace"]
    if item["moteur"] == "yue2-int8":
        return _HYPOTHESES_SECONDES[item["categorie"]] if item["categorie"] in ("chanson",) else _HYPOTHESES_SECONDES["musique-yue2"]
    return _HYPOTHESES_SECONDES[item["categorie"]]


def verifier() -> int:
    import httpx
    print("=== SN0 · le banc des moteurs — vérification (lecture seule, rien n'est calculé) ===\n")
    try:
        info = httpx.get(COMFY + "/object_info", timeout=15).json()
    except Exception as erreur:
        print(f"ComfyUI ne répond pas sur {COMFY} : {erreur}")
        print("Rien à vérifier sans lui : lance Comfy Desktop, puis relance essais/banc_son.py --verifier.")
        return 1
    print(f"ComfyUI répond sur {COMFY} — {len(info)} nœuds déclarés dans /object_info.\n")

    print("--- 1. Fichiers de poids, par moteur ---")
    for identifiant, construire in CONSTRUCTEURS.items():
        profil = construire()
        print(f"\n{profil['nom']} ({identifiant})")
        for ligne in poids_du_profil(profil, info):
            marque = "présent " if ligne["present"] else "MANQUANT"
            print(f"  [{marque}] {ligne['fichier']:<40} models/{ligne['dossier']:<14} {ligne['source']}")

    encodeur_1_7b_present = FICHIER_ACE_1_7B in (
        (_choix(info.get("DualCLIPLoader", {}).get("input", {}).get("required", {}).get("clip_name2")) or []))
    print(f"\nEncodeur ACE-Step qwen_1.7b_ace15.safetensors (facultatif) : "
          f"{'présent' if encodeur_1_7b_present else 'absent'} — "
          f"{'la variante double encodeur entre dans le programme' if encodeur_1_7b_present else 'la variante double encodeur ne sera pas tentée'}.")

    programme = construire_programme(encodeur_1_7b_present)

    print("\n--- 2. Graphes du programme : chaque nœud et chaque valeur ---")
    total_problemes = 0
    for item in programme:
        profil = profil_de(item["moteur"])
        graphe = composer_graphe(profil, graine=0, **item["champs"])
        problemes = diagnostiquer_graphe(graphe, info)
        total_problemes += len(problemes)
        marque = "OK" if not problemes else f"{len(problemes)} problème(s)"
        print(f"  [{marque:>14}] {item['moteur']:<24} {item['cle']}")
        for p in problemes:
            print(f"       - {p}")

    graines = 8
    total_tirages = len(programme) * graines
    print(f"\n--- 3. Tirages ---")
    print(f"{len(programme)} prompts × {graines} graines = {total_tirages} tirages.")
    par_moteur = {}
    for item in programme:
        par_moteur.setdefault(item["moteur"], 0)
        par_moteur[item["moteur"]] += graines
    for moteur, n in sorted(par_moteur.items()):
        print(f"  {moteur:<24} {n:>4} tirages")

    secondes_totales = sum(_hypothese(item) * graines for item in programme)
    print(f"\n--- 4. Estimation de durée (hypothèses, pas une mesure) ---")
    print(f"  bruitage/ambiance ~ {_HYPOTHESES_SECONDES['bruitage']}-{_HYPOTHESES_SECONDES['ambiance']} s/tirage (8 pas, échantillonneur LCM)")
    print(f"  musique ACE-Step  ~ {_HYPOTHESES_SECONDES['musique-ace']} s/tirage (8 pas turbo, jusqu'à 64 s de sortie)")
    print(f"  musique/chanson YuE2 ~ {_HYPOTHESES_SECONDES['musique-yue2']} s/tirage (partition puis 32 pas — le plus lourd)")
    print(f"  -> environ {secondes_totales / 60:.0f} minutes au total, à corriger dès le premier --lancer.")

    print(f"\n{'AUCUN PROBLÈME' if not total_problemes else str(total_problemes) + ' PROBLÈME(S)'} sur les graphes du programme.")
    return 0 if not total_problemes else 2


# ─────────────────────────────────────────────────────────────────────────
# --lancer : soumet réellement les tirages. Jamais appelé par un agent.
# ─────────────────────────────────────────────────────────────────────────


def _memoire_carte_mo():
    try:
        execution = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5)
        return int(execution.stdout.strip().splitlines()[0])
    except Exception:
        return None


class _SuiviMemoire:
    """Interroge nvidia-smi toutes les 0,5 s pendant un calcul, et garde le pic."""

    def __init__(self, intervalle=0.5):
        self.intervalle = intervalle
        self.pic = None
        self._arret = threading.Event()
        self._thread = None

    def __enter__(self):
        self._thread = threading.Thread(target=self._boucle, daemon=True)
        self._thread.start()
        return self

    def _boucle(self):
        while not self._arret.is_set():
            m = _memoire_carte_mo()
            if m is not None:
                self.pic = m if self.pic is None else max(self.pic, m)
            self._arret.wait(self.intervalle)

    def __exit__(self, *exc):
        self._arret.set()
        if self._thread:
            self._thread.join(timeout=2)
        return False


def _dossier_du_jour() -> Path:
    dossier = RESULTATS / date.today().isoformat()
    dossier.mkdir(parents=True, exist_ok=True)
    return dossier


def lancer(moteur_filtre: str | None, graines: int) -> int:
    import httpx
    client = httpx.Client(timeout=30)
    try:
        info = client.get(COMFY + "/object_info").json()
    except Exception as erreur:
        print(f"ComfyUI ne répond pas sur {COMFY} : {erreur}")
        return 1

    encodeur_1_7b_present = FICHIER_ACE_1_7B in (
        (_choix(info.get("DualCLIPLoader", {}).get("input", {}).get("required", {}).get("clip_name2")) or []))
    programme = construire_programme(encodeur_1_7b_present)
    if moteur_filtre:
        programme = [i for i in programme if i["moteur"] == moteur_filtre]
        if not programme:
            print(f"Aucun élément du programme pour le moteur {moteur_filtre!r}.")
            return 1

    dossier = _dossier_du_jour()
    chemin_mesures = dossier / "mesures.json"
    mesures = json.loads(chemin_mesures.read_text("utf-8")) if chemin_mesures.exists() else {}

    def sauver():
        chemin_mesures.write_text(json.dumps(mesures, indent=1, ensure_ascii=False), "utf-8")

    moteurs_ordonnes = list(dict.fromkeys(item["moteur"] for item in programme))
    try:
        for moteur in moteurs_ordonnes:
            profil = profil_de(moteur)
            print(f"\n=== {profil['nom']} ({moteur}) ===")
            for item in [i for i in programme if i["moteur"] == moteur]:
                for graine in range(graines):
                    cle = f"{moteur}/{item['cle']}/{graine}"
                    deja = mesures.get(cle)
                    if deja and (dossier / deja["fichier"]).exists():
                        print(f"  {cle} : déjà rendu, on garde.")
                        continue
                    graphe = composer_graphe(profil, graine=graine, **item["champs"])
                    problemes = diagnostiquer_graphe(graphe, info)
                    if problemes:
                        print(f"  {cle} : graphe invalide, non envoyé —")
                        for p in problemes:
                            print(f"      - {p}")
                        continue
                    debut = time.monotonic()
                    with _SuiviMemoire() as suivi:
                        rendu = client.post(COMFY + "/prompt",
                            json={"prompt": graphe, "client_id": CLIENT_ID}).json()
                        prompt_id = rendu.get("prompt_id")
                        if not prompt_id:
                            print(f"  {cle} : ComfyUI n'a pas rendu d'identifiant, on passe au suivant.")
                            continue
                        while True:
                            histoire = client.get(COMFY + f"/history/{prompt_id}").json()
                            entree = histoire.get(prompt_id)
                            if entree and entree.get("status", {}).get("completed"):
                                break
                            time.sleep(1)
                    temps = time.monotonic() - debut
                    noeud_sortie = profil["sortie"]["noeud"]
                    sorties = entree.get("outputs", {}).get(noeud_sortie, {}).get(profil["sortie"]["champ"], [])
                    if not sorties or not sorties[0].get("filename"):
                        print(f"  {cle} : pas de fichier de sortie, on passe au suivant.")
                        continue
                    reference = sorties[0]
                    reponse = client.get(COMFY + "/view", params={
                        "filename": reference["filename"], "subfolder": reference.get("subfolder", ""),
                        "type": reference.get("type", "output")})
                    extension = Path(reference["filename"]).suffix or ".flac"
                    nom_fichier = f"{moteur.replace('/', '-')}_{item['cle']}_{graine}{extension}"
                    (dossier / nom_fichier).write_bytes(reponse.content)
                    signal, taux = decoder(dossier / nom_fichier)
                    mesure = mesurer(signal, taux)
                    mesures[cle] = {"moteur": moteur, "cle": item["cle"], "categorie": item["categorie"],
                        "description": item["description"], "graine": graine, "fichier": nom_fichier,
                        "temps_s": round(temps, 1), "pic_memoire_mo": suivi.pic, "mesures": mesure}
                    sauver()
                    print(f"  {cle} : {temps:.1f} s, pic {suivi.pic} Mo, durée {mesure['duree']:.2f} s, "
                          f"LUFS {mesure['lufs']}, crête {mesure['crete_db']}")
            avant = _memoire_carte_mo()
            try:
                client.post(COMFY + "/free", json={"unload_models": True, "free_memory": True})
            except Exception:
                pass
            time.sleep(1)
            apres = _memoire_carte_mo()
            print(f"  -> /free : mémoire {avant} -> {apres} Mo")
    except KeyboardInterrupt:
        print("\nArrêt demandé. Ce qui est déjà rendu reste dans mesures.json ; "
              "relance --lancer pour reprendre où le banc s'est arrêté.")
    finally:
        sauver()
        ecrire_page(dossier, mesures)
        print(f"\n-> {dossier}")
    return 0


# ─────────────────────────────────────────────────────────────────────────
# La page d'écoute — autonome, les mesures sont incluses dans la page.
# ─────────────────────────────────────────────────────────────────────────

_PAGE_GABARIT = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Banc du son — SN0</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 0; padding: 24px; background: #16181d; color: #e6e6e6; }
  h1 { font-size: 20px; }
  .groupe { margin: 24px 0; border: 1px solid #333; border-radius: 8px; padding: 12px 16px; }
  .groupe h2 { margin: 0 0 4px; font-size: 15px; }
  .groupe .texte { color: #9aa; font-size: 12px; margin-bottom: 10px; white-space: pre-wrap; }
  .tirage { display: grid; grid-template-columns: 90px 1fr 260px 60px; gap: 10px; align-items: center;
            padding: 6px 0; border-top: 1px solid #2a2d33; }
  .tirage:first-of-type { border-top: none; }
  audio { width: 100%; height: 28px; }
  .mesures { font-size: 11px; color: #aab; }
  .barre { position: sticky; top: 0; background: #16181d; padding: 8px 0; display: flex; gap: 12px; align-items: center; }
  button { background: #2c3e50; color: #eee; border: 0; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
  .compte { color: #9aa; }
</style>
</head>
<body>
<div class="barre">
  <h1>Banc du son — SN0</h1>
  <span class="compte" id="compte"></span>
  <button id="exporter">Exporter les tirages gardés (JSON)</button>
</div>
<div id="groupes"></div>
<script>
const MESURES = __DONNEES__;
const CLE_LOCALE = "banc_son_gardes";

function gardes() {
  try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "{}"); } catch (e) { return {}; }
}
function poser_garde(cle, valeur) {
  const g = gardes(); g[cle] = valeur; localStorage.setItem(CLE_LOCALE, JSON.stringify(g));
  document.getElementById("compte").textContent = Object.values(gardes()).filter(Boolean).length + " tirage(s) gardé(s)";
}

function groupes() {
  const parGroupe = {};
  for (const [cle, m] of Object.entries(MESURES)) {
    const g = m.moteur + " / " + m.cle;
    (parGroupe[g] = parGroupe[g] || []).push([cle, m]);
  }
  return parGroupe;
}

function rendre() {
  const racine = document.getElementById("groupes");
  racine.innerHTML = "";
  const g = gardes();
  for (const [nom, tirages] of Object.entries(groupes())) {
    const bloc = document.createElement("div");
    bloc.className = "groupe";
    const premier = tirages[0][1];
    bloc.innerHTML = `<h2>${nom} — ${premier.categorie}</h2><div class="texte">${(premier.description || "").replace(/</g, "&lt;")}</div>`;
    for (const [cle, m] of tirages.sort((a, b) => a[1].graine - b[1].graine)) {
      const ligne = document.createElement("div");
      ligne.className = "tirage";
      const mes = m.mesures || {};
      const texteMesures = m.fichier
        ? `${m.temps_s ?? "?"} s · pic ${m.pic_memoire_mo ?? "?"} Mo · durée ${(mes.duree ?? 0).toFixed(2)} s · `
          + `crête ${mes.crete_db ?? "?"} dB · LUFS ${mes.lufs ?? "?"} · silencieux ${mes.silencieux ? "oui" : "non"} · `
          + `écrêté ${mes.ecretes ?? 0}`
        : "pas de fichier";
      ligne.innerHTML = `
        <span>graine ${m.graine}</span>
        <audio controls ${m.fichier ? `src="${m.fichier}"` : ""}></audio>
        <span class="mesures">${texteMesures}</span>
        <label><input type="checkbox" data-cle="${cle}" ${g[cle] ? "checked" : ""}> gardé</label>`;
      ligne.querySelector("input").addEventListener("change", (e) => poser_garde(cle, e.target.checked));
      bloc.appendChild(ligne);
    }
    racine.appendChild(bloc);
  }
  document.getElementById("compte").textContent = Object.values(g).filter(Boolean).length + " tirage(s) gardé(s)";
}

document.getElementById("exporter").addEventListener("click", () => {
  const g = gardes();
  const retenus = Object.entries(g).filter(([, v]) => v).map(([cle]) => ({ cle, ...MESURES[cle] }));
  const blob = new Blob([JSON.stringify(retenus, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "banc_son_gardes.json"; a.click();
});

rendre();
</script>
</body>
</html>
"""


def ecrire_page(dossier: Path, mesures: dict) -> Path:
    page = _PAGE_GABARIT.replace("__DONNEES__", json.dumps(mesures, ensure_ascii=False))
    chemin = dossier / "page.html"
    chemin.write_text(page, "utf-8")
    return chemin


# ─────────────────────────────────────────────────────────────────────────


def principal(argv=None) -> int:
    analyseur = argparse.ArgumentParser(description="SN0 : le banc des moteurs sonores.")
    analyseur.add_argument("--verifier", action="store_true", help="lecture seule (défaut si aucun autre mode)")
    analyseur.add_argument("--lancer", action="store_true", help="soumet réellement les tirages")
    analyseur.add_argument("--moteur", default=None, help="ne lance qu'un moteur (identifiant du programme)")
    analyseur.add_argument("--graines", type=int, default=8, help="nombre de graines par prompt (défaut 8)")
    arguments = analyseur.parse_args(argv)

    if arguments.lancer:
        return lancer(arguments.moteur, arguments.graines)
    return verifier()


if __name__ == "__main__":
    raise SystemExit(principal())
