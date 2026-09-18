"""Le texte qui part (SN2) : une seule règle, pure, pour toutes les familles.

    (famille, moteur, demande, univers sonore) → ce qui part

On décrit le son, l'univers ajoute le style, le gabarit du moteur ajoute ce
que ce moteur a besoin d'entendre (docs/archi-son.md §4.2). Ce module ne lit
ni disque ni réseau : `ServiceTravauxAudio` l'appelle pour la relecture
(« voir ce qui partira ») et pour l'envoi, avec les mêmes entrées, donc le
texte relu est le texte envoyé.

Les invariants, dont chaque famille hérite :

1. **Rien n'est traduit ni réécrit.** La description part telle qu'elle est
   écrite. Seuls les blancs qui l'entourent et sa ponctuation finale
   (`. , ; :`) sont retirés, pour que la virgule qui la suit ne fasse pas
   « creaks., retro » ; le morceau `description` le montre tel qu'il part.
2. **Chaque morceau dit d'où il vient** : `description` (ce que l'auteur a
   écrit), `univers` (une case du bloc sonore, nommée), `gabarit` (ce que
   l'atelier ajoute pour ce moteur), `demande` (un réglage donné avec la
   demande), `profil` (la valeur que le graphe porte déjà).
3. **Un univers vide ne contraint rien** : une case vide ou relâchée ne fait
   rien partir, et la description part seule avec les mots du gabarit.
4. **L'ordre est fixe** : préfixe du moteur, description, univers (dans
   l'ordre de `CHAMPS_SON` utile à la famille), prise de son de la famille.
5. **Une demande passe devant l'univers, l'univers devant le gabarit.**
   (tempo, tonalité, mesure, paroles, durée.)

Un texte relu à la main court-circuite tout ceci ; ce n'est pas l'affaire de
ce module mais du service, qui le marque dans ce qu'il enregistre.

Décisions prises en l'écrivant (non tranchées par la spécification) :

- l'époque et la matière partent aussi vers un bruitage (le tableau du §4.2
  les route « bruitages, ambiances »), entre la description et le rendu ;
- l'humeur part vers une ambiance, après la matière ;
- Stable Audio 3 en secours d'une musique ou d'un jingle ne reçoit pas de
  `TrackType` (aucune valeur musicale n'est vérifiée) : tonalité et tempo y
  partent en mots, faute de réglage direct ;
- la structure d'ACE-Step est `[Build] [Drop]` quand la description parle de
  combat (`battle`, `combat`, `boss`, `fight`) ; c'est la seule lecture de la
  description, et elle ne change pas son texte ;
- un moteur que l'atelier ne connaît pas (workflow collé) reçoit la
  description et les cases de l'univers, sans mot propre à un moteur.
"""
from __future__ import annotations

import math
import re
from typing import Any

from atelier.domaine.projet import FAMILLES_SON, UniversSonore
from atelier.domaine.workflow import MESURES, TEMPO_MAX, TEMPO_MIN, TONALITES

SFXR = "sfxr"

# Ce que chaque famille fait partir de l'univers, dans cet ordre (§4.2).
CASES_PAR_FAMILLE = {
    "bruitage": ("epoque", "rendu"),
    "interface": ("rendu",),
    "ambiance": ("epoque", "humeur"),
    "musique": ("orchestre", "humeur"),
    "jingle": ("orchestre", "humeur"),
    "chanson": ("orchestre",),
    "voix": (),
}
assert set(CASES_PAR_FAMILLE) == set(FAMILLES_SON)

# Les mots du gabarit (relevé des bruitages §6.2). Pas de texte négatif pour
# Stable Audio 3 : à guidage 1, il n'a aucun effet.
TRACKTYPE = "TrackType: SFX."
PRISE_DE_SON = {
    "bruitage": "one-shot, close-mic'd, dry, no reverb, isolated",
    "interface": "one-shot, close-mic'd, dry, no reverb, isolated",
    "ambiance": "continuous, steady, field recording, no music, stereo",
}
NEGATIF_SAO = "low quality, average quality"

# Durées par défaut, en secondes (archi §3 et §4.2, relevé §6.2) : un coup, un
# pas ou un objet dure 1 à 2 s, un sort 2 à 4 ; une ambiance 30 s.
DUREES = {"bruitage": 2, "interface": 1, "ambiance": 30, "chanson": 120}
# Une musique se demande en mesures ; la durée se calcule (voir
# `duree_en_mesures`). Un jingle de victoire tient en 2 à 4 mesures.
MESURES_PAR_DEFAUT = {"musique": 16, "jingle": 2}
MARGE_MESURES = 1
TEMPO_GABARIT, MESURE_GABARIT = 90, 4

STRUCTURES = {
    "musique": "[Intro]\n[Instrumental]\n[Outro]",
    "combat": "[Intro]\n[Instrumental]\n[Build]\n[Drop]",
    "jingle": "[Instrumental]\n[Fade Out]",
    "yue_instrumental": "[Intro]\n[Instrumental]\n[Instrumental]\n[Outro]",
}
_COMBAT = re.compile(r"\b(battle|combat|boss|fight)\b", re.IGNORECASE)

MOTEURS_SA3 = ("sa3-small-sfx", "sa3-medium")
MOTEUR_SAO = "sa-open-1"
MOTEUR_ACE = "ace-step-15-turbo"
MOTEUR_YUE = "yue2-int8"


# ── La langue de la description ─────────────────────────────────────────────
#
# **Un indicateur pour l'écran, jamais un refus ni une traduction.** Les
# moteurs comprennent l'anglais ; l'écran dit que la description n'a pas l'air
# de l'être, et c'est tout. Heuristique volontairement simple :
#
# - une lettre accentuée du français (é, è, à, ç, œ…) suffit ;
# - sinon une élision (`l'`, `d'`, `qu'`…) devant une lettre suffit ;
# - sinon il faut **deux** mots-outils français parmi la liste ci-dessous
#   (un seul ne suffit pas : `la`, `de` ou `par` se croisent en anglais).
#
# Elle rate un texte français sans accent et sans mot-outil (« porte qui
# grince » n'a qu'un mot-outil) : c'est un signal, pas un juge.
ACCENTS = set("àâäçéèêëîïôöùûüÿœæ")
MOTS_OUTILS = frozenset((
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "et", "ou", "sur", "sous", "dans", "avec",
    "sans", "pour", "par", "qui", "que", "est", "sont", "puis", "très", "tres", "entre", "vers", "leur", "ses",
))
_ELISION = re.compile(r"\b(l|d|qu|j|n|s|c)['’][a-zà-ÿ]", re.IGNORECASE)


def langue(texte: str) -> dict[str, Any]:
    """`non_anglais` et les indices qui l'ont fait dire, pour l'écran."""
    minuscules = (texte or "").lower()
    indices: list[str] = []
    accents = sorted({c for c in minuscules if c in ACCENTS})
    if accents:
        indices.append("accents : " + " ".join(accents))
    elisions = sorted({m.group(0)[:-1] for m in _ELISION.finditer(minuscules)})
    if elisions:
        indices.append("élisions : " + " ".join(elisions))
    mots = [m for m in re.findall(r"[a-zà-ÿ]+", minuscules) if m in MOTS_OUTILS]
    if len(mots) >= 2:
        indices.append("mots français : " + " ".join(dict.fromkeys(mots)))
    return {"non_anglais": bool(indices), "indices": indices}


# ── La durée d'une musique ──────────────────────────────────────────────────


def duree_en_mesures(mesures: int, tempo: int, temps: int = MESURE_GABARIT, marge: int = MARGE_MESURES) -> float:
    """(mesures + marge) × temps par mesure × 60 / tempo, **arrondi au
    centième le plus proche** (16 mesures à 90 BPM en 4/4, plus une de marge :
    17 × 4 × 60 / 90 = 45,333… → 45,33 s). L'arrondi peut retirer au plus 5 ms
    à la mesure de marge, jamais aux mesures demandées : la boucle se coupe
    sur une frontière de mesure à l'intérieur (SN9)."""
    return round((mesures + marge) * temps * 60 / tempo, 2)


# ── Les gabarits ────────────────────────────────────────────────────────────


def gabarit_de(famille: str, moteur: str | None) -> str:
    """Le nom du gabarit qu'applique ce moteur à cette famille."""
    if famille == "voix":
        return "voix"
    if moteur == SFXR:
        return "sfxr"
    musical = famille in ("musique", "jingle", "chanson")
    if moteur in MOTEURS_SA3 or moteur == MOTEUR_SAO:
        prefixe = "sa3" if moteur in MOTEURS_SA3 else "sao"
        if musical:
            return prefixe + "-musique"
        return prefixe + ("-ambiance" if famille == "ambiance" else "-bruitage")
    if moteur == MOTEUR_ACE:
        return "ace-musique"
    if moteur == MOTEUR_YUE:
        return "yue-chanson"
    return "libre"


def _morceau(texte: str, source: str, champ: str | None = None) -> dict[str, Any]:
    m = {"texte": texte, "source": source}
    if champ:
        m["champ"] = champ
    return m


def _description(brute: Any) -> str:
    if not isinstance(brute, str) or not brute.strip():
        raise ValueError("Décrivez le son : la description est vide.")
    return brute.strip().rstrip(".,;: \t\r\n")


def _entier(demande: dict, cle: str, bas: int, haut: int, phrase: str) -> int | None:
    v = demande.get(cle)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, int) or not bas <= v <= haut:
        raise ValueError(phrase)
    return v


def composer_texte(famille: str, moteur: str | None, demande: dict[str, Any],
                   univers: UniversSonore | None = None) -> dict[str, Any]:
    """Ce qui part, et d'où vient chaque morceau. Lève `ValueError` avec une
    phrase affichable ; ne lit rien d'autre que ses arguments.

    `demande` : `description` (obligatoire), et facultativement `secondes`,
    `mesures`, `paroles`, `tempo`, `tonalite`, `mesure`."""
    if famille not in FAMILLES_SON:
        raise ValueError("Famille de sons inconnue « " + str(famille) + " » : " + ", ".join(FAMILLES_SON) + ".")
    univers = univers or UniversSonore.depuis_json(None)
    gabarit = gabarit_de(famille, moteur)
    base = {"famille": famille, "moteur": moteur, "gabarit": gabarit}
    if gabarit == "sfxr":
        return {**base, "compose": False,
            "raison": "Un son d'interface ou rétro se fabrique par sfxr, avec des réglages et sans texte."}
    if gabarit == "voix":
        return {**base, "compose": False, "raison": "Les voix ne se composent pas encore (SN11)."}

    description = _description(demande.get("description"))
    tempo_d = _entier(demande, "tempo", TEMPO_MIN, TEMPO_MAX,
        f"Le tempo est un nombre entier de battements par minute, de {TEMPO_MIN} à {TEMPO_MAX}.")
    mesure_d = demande.get("mesure")
    if mesure_d is not None and (isinstance(mesure_d, bool) or mesure_d not in MESURES):
        raise ValueError("La mesure compte 2, 3, 4 ou 6 temps.")
    tonalite_d = demande.get("tonalite")
    if tonalite_d is not None and tonalite_d not in TONALITES:
        raise ValueError(f"La tonalité « {tonalite_d} » n'est pas connue ; écrivez-la comme « D minor » ou « F# major ».")
    paroles_d = demande.get("paroles")
    if paroles_d is not None and not isinstance(paroles_d, str):
        raise ValueError("Les paroles sont un texte.")
    mesures_d = _entier(demande, "mesures", 1, 999, "Le nombre de mesures est un entier de 1 à 999.")
    secondes_d = demande.get("secondes")
    if secondes_d is not None and (isinstance(secondes_d, bool) or not isinstance(secondes_d, (int, float))
                                   or not math.isfinite(secondes_d) or secondes_d <= 0):
        raise ValueError("La durée est un nombre de secondes positif.")
    if secondes_d is not None and mesures_d is not None:
        raise ValueError("Donnez une durée ou un nombre de mesures, pas les deux.")

    musical = famille in ("musique", "jingle", "chanson")
    # Tempo, tonalité, mesure : la demande, sinon l'univers, sinon le gabarit.
    if tempo_d is not None:
        tempo = (tempo_d, "demande")
    elif univers.tempo:
        tempo = (univers.tempo, "univers")
    else:
        tempo = (TEMPO_GABARIT, "gabarit")
    mesure = (mesure_d, "demande") if mesure_d is not None else (MESURE_GABARIT, "gabarit")
    if tonalite_d is not None:
        tonalite = (tonalite_d, "demande")
    elif univers.tonalite:
        tonalite = (univers.tonalite, "univers")
    else:
        tonalite = None

    # La durée : la demande, sinon des mesures (musique, jingle), sinon la famille.
    mesures = None
    if secondes_d is not None:
        secondes, source_secondes = secondes_d, "demande"
    elif famille in MESURES_PAR_DEFAUT and gabarit != "yue-chanson":
        demandees = mesures_d if mesures_d is not None else MESURES_PAR_DEFAUT[famille]
        mesures = {"demandees": demandees, "marge": MARGE_MESURES, "total": demandees + MARGE_MESURES,
            "source": "demande" if mesures_d is not None else "gabarit"}
        secondes, source_secondes = duree_en_mesures(demandees, tempo[0], mesure[0]), "mesures"
    else:
        if mesures_d is not None:
            raise ValueError("Seules une musique et un jingle se demandent en mesures.")
        secondes = DUREES.get(famille) or (DUREES["chanson"] if musical else DUREES["bruitage"])
        source_secondes = "famille"

    cases = [_morceau(univers.texte(n), "univers", n) for n in CASES_PAR_FAMILLE[famille] if univers.texte(n)]
    desc = _morceau(description, "description")
    morceaux: list[dict[str, Any]] = []
    negatif: list[dict[str, Any]] = []
    parametres: dict[str, dict[str, Any]] = {}
    fin = ""

    if gabarit in ("sa3-bruitage", "sa3-ambiance", "sao-bruitage", "sao-ambiance"):
        # Un texte qui porte déjà son « TrackType » (collé d'un relevé) ne le
        # reçoit pas deux fois.
        if gabarit.startswith("sa3") and not description.lower().startswith("tracktype:"):
            morceaux.append(_morceau(TRACKTYPE, "gabarit"))
        prise = _morceau(PRISE_DE_SON.get(famille, PRISE_DE_SON["bruitage"]), "gabarit")
        if famille == "ambiance":
            morceaux += [desc, prise, *cases]
        else:
            morceaux += [desc, *cases, prise]
        fin = "."
    elif gabarit in ("sa3-musique", "sao-musique"):
        morceaux += [desc, *cases]
        if tonalite:
            morceaux.append(_morceau(tonalite[0], tonalite[1], "tonalite"))
        morceaux.append(_morceau(f"{tempo[0]} BPM", tempo[1], "tempo"))
    elif gabarit == "ace-musique":
        # tags = usage + orchestre + humeur ; le reste en réglages directs.
        morceaux += [desc, *cases]
        if paroles_d is not None:
            parametres["paroles"] = {"valeur": paroles_d, "source": "demande"}
        else:
            cle = "jingle" if famille == "jingle" else "combat" if _COMBAT.search(description) else "musique"
            parametres["paroles"] = {"valeur": STRUCTURES[cle], "source": "gabarit"}
        parametres["tempo"] = {"valeur": tempo[0], "source": tempo[1]}
        parametres["mesure"] = {"valeur": mesure[0], "source": mesure[1]}
        if tonalite:
            parametres["tonalite"] = {"valeur": tonalite[0], "source": tonalite[1]}
    elif gabarit == "yue-chanson":
        # style = English, genre et voix, orchestre, tempo ; paroles = les
        # seuls mots chantés. Hors chanson, la tentative est instrumentale.
        chant = famille == "chanson"
        morceaux += [_morceau("English" if chant else "instrumental", "gabarit"), desc, *cases]
        if tempo[1] != "gabarit":
            morceaux.append(_morceau(f"{tempo[0]} BPM", tempo[1], "tempo"))
        if paroles_d is not None:
            parametres["paroles"] = {"valeur": paroles_d, "source": "demande"}
        elif not chant:
            parametres["paroles"] = {"valeur": STRUCTURES["yue_instrumental"], "source": "gabarit"}
    else:  # libre : un workflow que l'atelier ne connaît pas
        morceaux += [desc, *cases]
        if musical:
            if paroles_d is not None:
                parametres["paroles"] = {"valeur": paroles_d, "source": "demande"}
            parametres["tempo"] = {"valeur": tempo[0], "source": tempo[1]}
            parametres["mesure"] = {"valeur": mesure[0], "source": mesure[1]}
            if tonalite:
                parametres["tonalite"] = {"valeur": tonalite[0], "source": tonalite[1]}

    if moteur == MOTEUR_SAO:
        # Stable Audio Open 1.0, guidage 7 : le négatif compte (doc diffusers).
        negatif.append(_morceau(NEGATIF_SAO, "gabarit"))

    texte = _joindre(morceaux) + fin
    return {**base, "compose": True,
        "texte": texte, "morceaux": morceaux,
        "texte_negatif": _joindre(negatif), "morceaux_negatif": negatif,
        "secondes": secondes, "source_secondes": source_secondes, "mesures": mesures,
        "parametres": parametres,
        "langue": langue(demande.get("description") or "")}


def _joindre(morceaux: list[dict[str, Any]]) -> str:
    """Le préfixe d'un moteur se termine par un point : il est suivi d'un
    blanc, pas d'une virgule."""
    texte = ""
    for m in morceaux:
        if not texte:
            texte = m["texte"]
        elif texte.endswith("."):
            texte += " " + m["texte"]
        else:
            texte += ", " + m["texte"]
    return texte


# ── Les exemples livrés ─────────────────────────────────────────────────────
#
# Tirés des relevés du 18 septembre 2026 (bruitages §6.3, musique §2–§3),
# réduits à ce que dit la demande : la source et l'action, ou l'usage. Le
# gabarit et l'univers ajoutent le reste — un exemple qui porterait déjà
# `TrackType` ou `close-mic'd` les ferait partir deux fois.
EXEMPLES = {
    "bruitage": [
        {"description": "Steel sword slash whoosh followed by a sharp metal impact", "secondes": 1.5},
        {"description": "Heavy wooden club hitting a leather armor, dull thud", "secondes": 1},
        {"description": "Single footstep of a leather boot on dry grass, soft crunch", "secondes": 1},
        {"description": "Single footstep of a hard boot on stone floor, sharp tap with slight grit", "secondes": 1},
        {"description": "Small gold coin pickup, bright metallic clink with a short sparkle", "secondes": 1},
        {"description": "Fireball spell cast, quick whoosh ignition building into a roaring burst of flame", "secondes": 2.5},
        {"description": "Small cave creature hiss and chitter, wet clicking insect-like sounds, non-vocal", "secondes": 2},
    ],
    "interface": [
        {"description": "Soft plastic UI button click, single short tick, fast decay", "secondes": 1},
        {"description": "Bright two-note confirmation chime, clean synth bell, rising interval", "secondes": 1},
        {"description": "Low dull buzzer, short negative error beep, two quick descending tones", "secondes": 1},
    ],
    "ambiance": [
        {"description": "Calm forest ambience, gentle wind in leaves, distant birds", "secondes": 30},
        {"description": "Steady rain on stone, water drips echoing in a cave, no thunder", "secondes": 30},
        {"description": "Busy medieval market square, distant chatter without words, cart wheels on cobblestone", "secondes": 30},
    ],
    "musique": [
        {"description": "cozy village theme, acoustic guitar, flute, light hand percussion, pizzicato strings",
         "tempo": 96, "tonalite": "G major", "mesure": 4, "mesures": 24},
        {"description": "ambient exploration, soft pads, celesta, harp arpeggios, sparse percussion, loopable",
         "tempo": 90, "tonalite": "D minor", "mesure": 4, "mesures": 24},
        {"description": "JRPG battle theme, driving drums, electric bass, staccato strings, brass",
         "tempo": 150, "tonalite": "E minor", "mesure": 4, "mesures": 40},
        {"description": "epic boss battle, choir, taiko, distorted guitar, orchestral hits",
         "tempo": 165, "tonalite": "C minor", "mesure": 4, "mesures": 64},
        {"description": "title screen, gentle piano, strings, minimal",
         "tempo": 80, "tonalite": "F major", "mesure": 4, "mesures": 16},
    ],
    "jingle": [
        {"description": "victory fanfare, brass, timpani, snare roll, triumphant, short jingle", "mesures": 3},
    ],
    "chanson": [
        {"description": "folk, medieval tavern song, warm male vocal, cheerful",
         "paroles": "[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Outro]", "secondes": 120},
        {"description": "orchestral ballad, soft female vocal, bittersweet",
         "paroles": "[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]", "secondes": 180},
    ],
    "voix": [],
}


def gabarits() -> dict[str, Any]:
    """Ce que l'écran montre d'un gabarit : ses mots, et ses exemples."""
    return {
        "familles": list(FAMILLES_SON),
        "cases": {f: list(c) for f, c in CASES_PAR_FAMILLE.items()},
        "prise_de_son": dict(PRISE_DE_SON),
        "tracktype": TRACKTYPE,
        "negatif_sao": NEGATIF_SAO,
        "durees": dict(DUREES),
        "mesures_par_defaut": dict(MESURES_PAR_DEFAUT),
        "marge_mesures": MARGE_MESURES,
        "structures": dict(STRUCTURES),
        "exemples": {f: [dict(e) for e in l] for f, l in EXEMPLES.items()},
    }
