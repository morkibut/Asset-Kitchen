# -*- coding: utf-8 -*-
"""Le texte qui part vers un style local (ML4) — composé des mêmes lignes.

**Une seule résolution, deux jonctions.** Les lignes viennent de
`ServiceGenerations.lignes`, c'est-à-dire de `envoi.resoudre` et du tri ; ce
module ne décide d'aucune couche. Il ne fait que ce que `envoi.joindre` fait
pour GPT Image : mettre les lignes allumées bout à bout — autrement, parce qu'un
modèle de diffusion à guidage faible ne lit pas des paragraphes titrés, et que
SDXL ne lit que 77 jetons à la fois.

**Ce qui reste, et pourquoi** (décision ML4, 18 septembre 2026) : le mot
déclencheur en tête, le signalement et la consigne de case, la planche, puis les
textes du jeu raccourcis à leur première phrase et sans intitulé, puis le cadre
« un seul sujet » en quatre mots, puis le suffixe du style — l'ordre de
`promptComplet` dans sc-clone. **Ce qui ne part pas** : la caméra longue (la vue
courte du jeu la dit déjà), le nommage des images jointes (un graphe ComfyUI ne
lit pas « Image 1 — … » : la référence entre par un nœud, pas par le texte), la
consigne de mise en page, et les titres `CONTEXT` / `REQUEST`. Tout ce qui ne
part pas est rendu dans `retires`, jamais tu.
"""

from __future__ import annotations

import math
import re
from typing import Any, Iterable, Mapping

from atelier.domaine.envoi import (
    CADRAGE,
    JEU,
    AMBIANCE,
    JOINTES,
    PLANCHE,
    REPRIS,
    SUJET,
)
from atelier.domaine.projet import CHAMPS_BIBLE

# **77 jetons par tranche, dont les deux bornes** : ComfyUI (`sd1_clip.py`)
# groupe les jetons par 75 et encadre chaque groupe d'un début et d'une fin.
# Au-delà, un second groupe est encodé à part et moyenné avec le premier.
TRANCHE_CLIP = 77
LIMITE_SDXL = TRANCHE_CLIP - 2

# Les familles dont l'encodeur de texte est CLIP seul. Z-Image (Qwen3), Klein
# (Qwen3) et FLUX.1 (T5, 512 jetons) lisent un texte long sans le découper.
FAMILLES_CLIP = frozenset({"sdxl"})

COMPTAGE = (
    "approximation du BPE de CLIP (aucun tokeniseur installé dans l'atelier) : "
    "un jeton par signe de ponctuation et par chiffre, un par mot courant, plus "
    "pour les mots longs — calée sur le vrai BPE, elle compte un peu large"
)

# La phrase de cadre de sc-clone (`promptParts`, provider comfyui), sans le fond
# blanc : le fond du jeu part déjà dans la case `technique`.
CADRE_COURT = "one isolated subject, centered, full view"

RAISON_FORME = "écrit pour GPT Image — un modèle local ne le lit pas"
RAISON_CAMERA = "la vue courte du jeu la dit déjà"
RAISON_JOINTES = "la référence entre dans le graphe par un nœud, pas par le texte"
RAISON_JETONS = f"au-delà des {TRANCHE_CLIP} jetons que SDXL lit d'un coup"
RAISON_PHRASE = "le modèle local ne garde que la première phrase"

# **L'ordre dans lequel SDXL renonce**, du moins utile au plus utile. Le style
# (rendu, trait) vient d'abord : le LoRA le porte déjà. Le fond et la vue
# viennent tard — le détourage et la case en dépendent. Le signalement ne part
# qu'en dernier, par la fin, et le déclencheur jamais.
ORDRE_DE_RETRAIT = (
    f"{JEU}.eclairage",
    f"{JEU}.epoque",
    f"{JEU}.monde",
    f"{JEU}.trait",
    f"{JEU}.rendu",
    f"{CADRAGE}.cadre",
    f"{CADRAGE}.camera",
    f"{JEU}.vue",
    f"{JEU}.technique",
    f"{SUJET}.pose",
    f"{PLANCHE}.cases",
)

_CAMERA_QUI_PRIME = re.compile(r"^CAMERA\s*[—-]\s*this overrides everything above\.\s*", re.I)
_PUCE = re.compile(r"^\s*(?:[-*•·]|\d+[.)])\s+")

# ── Compter comme CLIP ───────────────────────────────────────────────────────
#
# Le découpage d'avant le BPE est celui de CLIP (`simple_tokenizer.py`) : les
# contractions, les suites de lettres, chaque chiffre seul, les suites de
# signes. Seul le BPE est approché — ses 48 894 fusions ne sont pas dans
# l'atelier, et `essais/` n'a pas à les télécharger.
_MORCEAUX_CLIP = re.compile(r"'s|'t|'re|'ve|'m|'ll|'d|[^\W\d_]+|\d|[^\s\w]+|_+", re.I)


def _jetons_du_mot(mot: str) -> int:
    """**Calée pour compter large** : relevée le 18 septembre 2026 contre le vrai
    BPE (les fusions de `comfy/sd1_tokenizer`) sur les 446 paragraphes des
    prompts de `donnees/generations`, elle compte 11 % de trop en moyenne et
    sous-compte un paragraphe sur dix-huit, de 6 % au pire pour 95 % d'entre
    eux. Compter large coupe un segment de trop ; compter court laisserait
    SDXL ouvrir une seconde tranche, qui noie le déclencheur."""
    if mot.startswith("'") or mot.isdigit() or len(mot) <= 1:
        return 1
    if not mot.isascii():
        # Un accent ou un tiret long sort du vocabulaire courant : CLIP le
        # découpe en octets, rarement plus d'un jeton par caractère.
        return len(mot)
    if not mot[0].isalpha():
        # Une suite de signes : les paires courantes (`),` `."`) sont fusionnées.
        return math.ceil(len(mot) / 2)
    if len(mot) <= 6:
        return 1
    return math.ceil(len(mot) / 5)


def compter_jetons(texte: str) -> int:
    """Combien de jetons CLIP ce texte pèse, bornes non comprises."""
    propre = re.sub(r"\s+", " ", texte).strip().lower()
    return sum(_jetons_du_mot(m) for m in _MORCEAUX_CLIP.findall(propre))


# ── Composer ─────────────────────────────────────────────────────────────────


def _net(texte: str) -> str:
    """Une phrase de la liste, sans le point qui la ferme : on les joint par des
    virgules, comme sc-clone."""
    return texte.strip().rstrip(".;:, ").strip()


def _a_plat(texte: str) -> str:
    """Un signalement en puces devient une liste à virgules : CLIP ne voit pas
    les retours à la ligne, et un tiret en tête de ligne ne dit rien."""
    morceaux = [_net(_PUCE.sub("", l)) for l in texte.splitlines()]
    return ", ".join(m for m in morceaux if m)


def _premiere_phrase(texte: str) -> tuple[str, str]:
    """La première phrase, et ce qui reste après elle."""
    plat = _a_plat(texte)
    coupe = re.search(r"(?<=[a-z0-9)])[.;!?]\s+(?=[A-Z])", plat)
    if not coupe:
        return _net(plat), ""
    return _net(plat[: coupe.start()]), plat[coupe.end():].strip()


def planche_courte(colonnes: int, rangees: int, cases: Iterable[str]) -> str:
    """La consigne d'une planche à créer, dans la forme de sc-clone (`modes.animation`)."""
    textes = [_net(t) for t in cases]
    # Ce que toutes les cases disent pareil (« walking posture, full body,
    # facing ») se dit une fois : sur SDXL, c'est ce qui fait tenir la planche.
    commun = textes[0].split(" ") if len(textes) > 1 else []
    for t in textes[1:]:
        mots = t.split(" ")
        while commun and mots[: len(commun)] != commun:
            commun.pop()
    commun = commun[: min(len(t.split(" ")) for t in textes) - 1] if commun else []
    debut = " ".join(commun)
    liste = "; ".join(
        f"{i}. {' '.join(t.split(' ')[len(commun):])}" for i, t in enumerate(textes, start=1)
    )
    return (
        f"sprite sheet of {len(textes)} sprites of the same subject, "
        f"{colonnes}x{rangees} grid, " + (f"{_net(debut)}: " if debut else "") + liste
    )


def _allumees(lignes: Iterable[Mapping[str, Any]], groupe: str) -> list[Mapping[str, Any]]:
    return [
        l for l in lignes
        if l["groupe"] == groupe and l.get("allumee") and str(l["texte"]).strip()
    ]


def _joindre(segments: list[dict[str, Any]]) -> str:
    """Les segments bout à bout. **Un déclencheur qui finit par un signe ou par
    une préposition se colle au suivant** : `yotoicon, 16x16 pixel art icon of`
    attend son sujet juste derrière, et `Game asset tile,` porte déjà sa virgule."""
    texte = ""
    for s in segments:
        if not texte:
            texte = s["texte"]
        elif re.search(r"([,.;:]|\bof)$", texte):
            texte = f"{texte} {s['texte']}"
        else:
            texte = f"{texte}, {s['texte']}"
    return texte


def _segment(clef: str, nom: str, texte: str, origine: str) -> dict[str, Any]:
    return {"clef": clef, "nom": nom, "texte": texte, "origine": origine}


def composer(
    lignes: Iterable[Mapping[str, Any]],
    style: Mapping[str, Any],
    *,
    negatif_lu: bool,
    planche: str = "",
) -> dict[str, Any]:
    """Le texte d'un style local, **et tout ce qu'il a laissé en route**.

    `planche` est la consigne de planche récrite court par l'appelant — elle
    remplace le texte de la ligne `planche.cases`, écrit pour GPT Image.

    Rend `texte` (ce qui part), `segments` (ses morceaux, dans l'ordre),
    `retires` (ce qui ne part pas, avec sa raison), `jetons` et `limite` (la
    limite n'existe que pour SDXL), et `negatif_lu`.
    """
    lues = list(lignes)
    declencheur = str(style.get("declencheur") or "").strip()
    suffixe = str(style.get("suffixe") or "").strip()
    famille = str(style.get("famille") or "")
    tete = [_segment("style.declencheur", "le déclencheur du style", declencheur, "du style")] if declencheur else []
    queue = [_segment("style.suffixe", "le suffixe du style", suffixe, "du style")] if suffixe else []
    retires: list[dict[str, Any]] = []

    def retirer(l: Mapping[str, Any], raison: str, texte: str | None = None) -> None:
        retires.append({"clef": l["clef"], "nom": l.get("nom", ""), "texte": str(l["texte"]) if texte is None else texte, "raison": raison})

    if any(l.get("origine") == REPRIS for l in lues):
        # **Un texte repris part mot pour mot** (US-159) : seul le déclencheur
        # s'ajoute devant, parce que sans lui le LoRA ne s'éveille pas — et pas
        # deux fois si l'auteur l'a déjà écrit. Rien n'est coupé, même sur SDXL :
        # le compte le dit, et c'est à l'auteur de raccourcir.
        repris = "\n\n".join(str(l["texte"]).strip() for l in _allumees(lues, SUJET))
        corps = [_segment("sujet.repris", "ton texte", repris, "ton texte")] if repris else []
        if declencheur and repris.lower().startswith(declencheur.lower()):
            tete = []
        segments = tete + corps
        return _rendre(segments, retires, famille, negatif_lu, coupe=False)

    corps: list[dict[str, Any]] = []
    for l in _allumees(lues, SUJET):
        corps.append(_segment(l["clef"], l["nom"], _a_plat(str(l["texte"])), l.get("origine", "")))
    for l in _allumees(lues, PLANCHE):
        corps.append(_segment(l["clef"], l["nom"], planche or _a_plat(str(l["texte"])), l.get("origine", "")))
        if planche:
            retirer(l, RAISON_FORME)

    rang = {nom: i for i, nom in enumerate(CHAMPS_BIBLE)}
    style_du_jeu = sorted(
        _allumees(lues, JEU) + _allumees(lues, AMBIANCE),
        key=lambda l: rang.get(str(l["nom"]), len(rang)),
    )
    for l in style_du_jeu:
        premiere, reste = _premiere_phrase(str(l["texte"]))
        # La clef reste celle de la bible, que la ligne vienne du jeu ou de
        # l'ambiance : c'est le champ qui décide de l'ordre de retrait.
        corps.append(_segment(f"{JEU}.{l['nom']}", l["nom"], premiere, l.get("origine", "")))
        if reste:
            retirer(l, RAISON_PHRASE, reste)

    vue_dite = any(l["nom"] == "vue" for l in style_du_jeu)
    for l in _allumees(lues, CADRAGE):
        nom = str(l["clef"]).split(".", 1)[1]
        if nom == "cadre":
            corps.append(_segment(l["clef"], l["nom"], CADRE_COURT, l.get("origine", "")))
            retirer(l, RAISON_FORME)
        elif nom == "camera" and not vue_dite:
            # Sans vue courte dans le jeu, la caméra reste la seule à dire d'où
            # l'on regarde : sa première phrase part, sans l'ouverture impérative.
            premiere, _ = _premiere_phrase(_CAMERA_QUI_PRIME.sub("", str(l["texte"])))
            corps.append(_segment(l["clef"], l["nom"], premiere, l.get("origine", "")))
            retirer(l, RAISON_FORME)
        else:
            retirer(l, RAISON_CAMERA if nom == "camera" else RAISON_FORME)
    for l in _allumees(lues, JOINTES):
        retirer(l, RAISON_JOINTES)

    return _rendre(tete + corps + queue, retires, famille, negatif_lu, coupe=True)


def _rendre(
    segments: list[dict[str, Any]],
    retires: list[dict[str, Any]],
    famille: str,
    negatif_lu: bool,
    *,
    coupe: bool,
) -> dict[str, Any]:
    limite = LIMITE_SDXL if famille in FAMILLES_CLIP else None
    if limite is not None and coupe:
        segments = _tenir(segments, retires, limite)
    texte = _joindre(segments)
    return {
        "famille": famille,
        "texte": texte,
        "segments": segments,
        "retires": retires,
        "jetons": compter_jetons(texte),
        "limite": limite,
        "tranche": TRANCHE_CLIP if limite is not None else None,
        "comptage": COMPTAGE if limite is not None else "",
        "negatif_lu": negatif_lu,
    }


def _tenir(segments: list[dict[str, Any]], retires: list[dict[str, Any]], limite: int) -> list[dict[str, Any]]:
    """Retire, du moins utile au plus utile, jusqu'à tenir dans `limite`."""
    gardes = list(segments)
    partis: list[dict[str, Any]] = []
    for clef in ORDRE_DE_RETRAIT:
        if compter_jetons(_joindre(gardes)) <= limite:
            break
        for s in [s for s in gardes if s["clef"] == clef]:
            gardes.remove(s)
            partis.append(s)
    # Un gros segment retiré tard peut avoir fait la place d'un petit retiré
    # tôt : on les rend, du plus utile au moins utile, tant que ça tient.
    for s in reversed(partis):
        essai = [x for x in segments if any(x is g for g in gardes) or x is s]
        if compter_jetons(_joindre(essai)) <= limite:
            gardes = essai
    retires.extend({**s, "raison": RAISON_JETONS} for s in partis if not any(s is g for g in gardes))
    # Il ne reste que le style et le sujet : le signalement cède par la fin, mot
    # à mot. Le déclencheur et le suffixe ne cèdent jamais.
    sujet = next((s for s in gardes if s["clef"] == f"{SUJET}.sujet"), None)
    if sujet is None or compter_jetons(_joindre(gardes)) <= limite:
        return gardes
    mots = sujet["texte"].split(" ")
    coupes: list[str] = []
    while len(mots) > 1 and compter_jetons(_joindre([{**s, "texte": " ".join(mots)} if s is sujet else s for s in gardes])) > limite:
        coupes.insert(0, mots.pop())
    raccourci = {**sujet, "texte": _net(" ".join(mots))}
    retires.append({**sujet, "texte": " ".join(coupes), "raison": RAISON_JETONS})
    return [raccourci if s is sujet else s for s in gardes]
