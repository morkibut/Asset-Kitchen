# -*- coding: utf-8 -*-
"""Le banc d'essai des petits modèles de langage tournant sur la machine.

**La question posée est étroite et vérifiable** : un modèle qui tient dans les
8 Go de la carte sait-il faire, tout seul et gratuitement, le travail que
l'auteur a déjà fait soixante-dix fois à la main ?

Ce travail-là a un nom dans le produit : une **étiquette**. C'est une paire —
un libellé français qu'on clique, et le texte anglais qui part vraiment au
modèle d'image. « brume basse » vaut `thick low-lying fog, volumetric haze`.
Les soixante-dix paires de `atelier/domaine/etiquettes_livrees.py` sont donc
**un corrigé** : on cache l'anglais, on demande au modèle de le retrouver, et
on compare. Aucun autre banc ne peut être aussi honnête, parce qu'aucun autre
n'a de bonne réponse écrite d'avance par la personne que l'outil doit servir.

**Trois épreuves, et elles ne mesurent pas la même chose.**

- `etiquette` — le corrigé ci-dessus. Mesure le savoir-faire : sait-il dire à
  une IA d'image ce que l'auteur voulait dire ?
- `traduction` — des phrases d'auteur, en français, à rendre en anglais. Mesure
  la langue, sans le savoir-faire.
- `etoffement` — une description pauvre à enrichir. Mesure le débordement :
  celui qui en rajoute trahit l'intention, et c'est le risque principal.

**Ce qui est chronométré compte autant que ce qui est jugé.** Un bouton d'écran
qui répond en huit secondes n'est pas un bouton, c'est une génération. On note
donc le premier jeton et le total, à froid et à chaud séparément — le premier
appel paie le chargement du modèle en mémoire vidéo, les suivants non, et
confondre les deux ferait condamner un modèle pour une dépense qu'il ne fait
qu'une fois.

Lancement :  python docs/recherche-llm-local/banc.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Iterable

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE))

OLLAMA = "http://127.0.0.1:11434"
RESULTATS = Path(__file__).resolve().parent / "resultats"


# ── Ce qu'on demande, et à qui ───────────────────────────────────────────────
#
# **Le système est court, et c'est une décision.** Un petit modèle suit d'autant
# mieux qu'on lui dit moins ; les consignes longues le font bavarder. Celui-ci
# tient en quatre phrases et interdit explicitement les trois avaries observées
# partout ailleurs : la préface (« Here is the translation: »), les guillemets,
# et la phrase complète là où on attend des mots séparés par des virgules.

SYSTEME_ETIQUETTE = (
    "You write short English prompt fragments for an AI image generator that "
    "produces 2D video-game art. The user gives you a French art-direction "
    "term and the field it belongs to. Reply with the English fragment ONLY: "
    "a few concrete visual descriptors separated by commas, lowercase, no "
    "final period. Never write a sentence, an explanation, quotes, or any "
    "preamble. Never answer in French."
)

SYSTEME_TRADUCTION = (
    "You translate French into English. Reply with the translation ONLY: no "
    "preamble, no quotes, no explanation, no alternative versions. Keep the "
    "register and the length of the original."
)

SYSTEME_ETOFFEMENT = (
    "You rewrite a French description of a video-game asset into an English "
    "prompt for an AI image generator. Stay faithful: do not invent a subject, "
    "a colour, a pose or a setting the author did not write. Make the wording "
    "concrete and visual, keep it under twenty-five words, comma-separated. "
    "Reply with the English prompt ONLY, no preamble and no explanation."
)

# Les cases du catalogue, dites en clair — le modèle reçoit « lighting », pas
# `eclairage`, parce qu'un identifiant de champ n'est pas un mot d'anglais.
CASES = {
    "monde": "setting",
    "epoque": "period",
    "rendu": "rendering style",
    "trait": "linework and shading",
    "eclairage": "lighting",
}


# ── Les phrases d'auteur, écrites pour ce banc ───────────────────────────────
#
# **Elles ne viennent pas du dépôt, et c'est voulu** : le corrigé des étiquettes
# mesure déjà ce que le produit sait dire. Celles-ci mesurent ce qu'il ne sait
# pas encore — du français d'auteur, avec ses tournures, ses négations et ses
# mots qui n'ont pas d'équivalent direct.

TRADUCTIONS: tuple[tuple[str, str], ...] = (
    (
        "un chevalier en armure rouillée, vu de trois quarts, sans casque",
        "vocabulaire de pose et de vue, plus une négation",
    ),
    (
        "une potion de soin, fiole trapue, bouchon de liège, liquide rouge",
        "objet d'inventaire, énumération sèche",
    ),
    (
        "la façade d'une auberge de village, colombages, enseigne en fer forgé",
        "décor, deux termes techniques d'architecture",
    ),
    (
        "un gobelin maigre qui recule, l'air terrifié, arme baissée",
        "attitude et émotion, le piège des participes",
    ),
    (
        "tuile de sol : pavés inégaux, mousse dans les joints, vue de dessus",
        "consigne de production, deux-points et vue technique",
    ),
    (
        "icône de compétence : une main ouverte d'où sort une flamme bleue",
        "interface, relative « d'où »",
    ),
    (
        "un marchand ambulant avec sa charrette, dos voûté, manteau élimé",
        "personnage secondaire, adjectifs rares",
    ),
    (
        "ambiance de fin d'après-midi, lumière basse qui traverse la poussière",
        "atmosphère, tournure relative",
    ),
)

ETOFFEMENTS: tuple[tuple[str, str], ...] = (
    ("un dragon", "trois lettres : tout ce qui sera ajouté est une invention"),
    ("une épée", "objet nu, même piège"),
    ("un garde de la ville, l'air fatigué", "un peu de matière, mais peu"),
    ("une forêt la nuit", "décor pauvre, forte tentation d'en rajouter"),
    ("bouton d'interface pour valider", "registre non figuratif"),
    ("un coffre au trésor fermé", "l'état « fermé » ne doit pas se perdre"),
)


# ── Les modèles à éprouver ───────────────────────────────────────────────────
#
# **On garde ce qui est déjà là autant que ce qu'on télécharge.** Les deux
# `qwen2.5-coder` étaient sur la machine avant ce banc : ce sont des modèles de
# code, donc a priori les moins bons du lot pour de la langue. Ils servent de
# plancher — un candidat qui ne les bat pas ne mérite pas son téléchargement.

MODELES: tuple[str, ...] = (
    # **Deux Qwen3 de même taille, et c'est le cœur de la comparaison** : le
    # premier réfléchit avant de répondre, le second non. Sur une tâche de trois
    # mots, la réflexion se paie en secondes et n'achète rien — le banc doit le
    # montrer plutôt que de le supposer.
    "qwen3:4b-instruct",
    "qwen3:4b",
    "qwen3:1.7b",
    "gemma3:4b",
    "llama3.2:3b",
    "granite4:micro",
    "mistral:7b",
    # Le plancher : des modèles de code, déjà sur la machine avant ce banc.
    "qwen2.5-coder:7b",
    "qwen2.5-coder:1.5b",
)


# ── La mécanique de l'appel ──────────────────────────────────────────────────


@dataclass(slots=True)
class Reponse:
    """Un appel, son texte, et ce qu'il a coûté en temps."""

    texte: str
    premier_jeton_ms: float
    total_ms: float
    jetons: int
    erreur: str = ""

    @property
    def jetons_par_seconde(self) -> float:
        if self.total_ms <= 0 or not self.jetons:
            return 0.0
        return self.jetons / (self.total_ms / 1000.0)


def _poster(chemin: str, charge: dict[str, Any], secondes: float = 240.0) -> Any:
    requete = urllib.request.Request(
        OLLAMA + chemin,
        data=json.dumps(charge).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return urllib.request.urlopen(requete, timeout=secondes)


def interroger(
    modele: str,
    systeme: str,
    message: str,
    exemples: Iterable[tuple[str, str]] = (),
) -> Reponse:
    """Un appel en flux, pour chronométrer le **premier** jeton séparément.

    Le total seul mentirait : deux modèles qui répondent en deux secondes ne
    donnent pas la même impression si l'un commence à écrire au bout de deux
    dixièmes et l'autre au bout d'une seconde et demie. Un écran peut afficher
    au fil de l'eau ; ce qu'il ne peut pas faire, c'est attendre en silence.
    """
    # **Les exemples se donnent comme un dialogue déjà tenu, pas comme une
    # consigne.** Un petit modèle imite bien mieux qu'il n'obéit : trois
    # échanges où quelqu'un a déjà répondu dans le bon format valent dix lignes
    # de règles, et le format s'attrape sans qu'on ait à le décrire.
    dialogue: list[dict[str, str]] = [{"role": "system", "content": systeme}]
    for demande, reponse in exemples:
        dialogue.append({"role": "user", "content": demande})
        dialogue.append({"role": "assistant", "content": reponse})
    dialogue.append({"role": "user", "content": message})

    charge = {
        "model": modele,
        "messages": dialogue,
        "stream": True,
        "keep_alive": "10m",
        "options": {
            # Température basse : on ne veut pas de créativité, on veut la même
            # réponse deux fois de suite. Un bouton qui rend autre chose au
            # second clic n'est pas réparable par l'auteur.
            "temperature": 0.2,
            "top_p": 0.9,
            # Assez large pour qu'une réponse aille au bout. Trop court, on
            # mesurerait la troncature au lieu de mesurer le modèle.
            "num_predict": 220,
        },
        # Les modèles à raisonnement (Qwen3) déplient sinon une réflexion de
        # plusieurs secondes avant d'écrire trois mots. Ici, elle ne sert à rien.
        "think": False,
    }
    debut = time.perf_counter()
    premier = 0.0
    morceaux: list[str] = []
    jetons = 0
    try:
        with _poster("/api/chat", charge) as flux:
            for ligne in flux:
                if not ligne.strip():
                    continue
                try:
                    bloc = json.loads(ligne)
                except json.JSONDecodeError:  # pragma: no cover — flux abîmé
                    continue
                message = bloc.get("message") or {}
                # **La réflexion se ramasse à part.** Les modèles à raisonnement
                # la rendent dans son propre champ ; la compter dans le texte
                # ferait condamner pour bavardage un modèle qui répond bien.
                fragment = message.get("content") or ""
                if fragment:
                    if not premier:
                        premier = (time.perf_counter() - debut) * 1000
                    morceaux.append(fragment)
                if bloc.get("done"):
                    jetons = int(bloc.get("eval_count") or 0)
    except (urllib.error.URLError, TimeoutError, OSError) as souci:
        return Reponse("", 0.0, (time.perf_counter() - debut) * 1000, 0, str(souci))
    total = (time.perf_counter() - debut) * 1000
    return Reponse(_sans_reflexion("".join(morceaux)), premier, total, jetons)


# Le filet de sécurité quand la réflexion **n'est pas** rangée dans son champ :
# certaines conversions de Qwen3 la laissent dans le texte, balises comprises.
_BALISES = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)


def _sans_reflexion(texte: str) -> str:
    coupe = _BALISES.sub("", texte)
    # Une balise ouverte jamais refermée : tout ce qui suit est du brouillon.
    if "<think>" in coupe.lower():
        coupe = coupe[: coupe.lower().index("<think>")]
    return coupe.strip()


# ── Ce qu'on mesure sans juger ───────────────────────────────────────────────
#
# **Aucune de ces mesures ne dit si la réponse est bonne.** Elles disent si elle
# est *utilisable* — et une réponse inutilisable n'a pas besoin d'être jugée.
# Un bouton d'écran écrit dans la case de l'auteur : ce qui en sort doit pouvoir
# y aller tel quel, sans qu'une main retire une préface ou des guillemets.

PREFACES = re.compile(
    r"^\s*(here('s| is)|the (english|translation)|translation|sure|okay|of course|"
    r"voici|traduction|réponse|certainly|prompt)\b[^\n]{0,40}?[::]",
    re.IGNORECASE,
)

# Des mots courts qui n'existent qu'en français : leur présence signe une
# réponse non traduite. On évite les mots ambigus (« art », « image », « long »)
# qui sont les mêmes des deux côtés.
FRANCAIS = re.compile(
    r"\b(une?|des|du|le|la|les|avec|dans|sur|qui|que|pour|sans|est|sont|"
    r"vue|fond|lumière|couleurs?|personnage|épée)\b",
    re.IGNORECASE,
)


def _mots(texte: str) -> set[str]:
    plat = unicodedata.normalize("NFKD", texte.lower())
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    return {m for m in re.findall(r"[a-z0-9']+", plat) if len(m) > 2}


@dataclass(slots=True)
class Defauts:
    """Ce qui rend une réponse impropre à être écrite dans la case, tel quel."""

    preface: bool = False
    guillemets: bool = False
    francais: bool = False
    plusieurs_lignes: bool = False
    trop_long: bool = False
    vide: bool = False
    reflexion: bool = False

    @property
    def utilisable(self) -> bool:
        return not any(asdict(self).values())

    @property
    def liste(self) -> list[str]:
        return [nom for nom, present in asdict(self).items() if present]


def ausculter(texte: str, mots_max: int) -> Defauts:
    d = Defauts()
    if not texte.strip():
        d.vide = True
        return d
    d.preface = bool(PREFACES.search(texte))
    d.guillemets = texte.strip()[:1] in "\"'«" or texte.strip()[-1:] in "\"'»"
    d.francais = bool(FRANCAIS.search(texte))
    d.plusieurs_lignes = "\n" in texte.strip()
    d.trop_long = len(texte.split()) > mots_max
    # Certains modèles à raisonnement laissent filtrer leur brouillon même
    # quand on l'a coupé.
    d.reflexion = "<think" in texte.lower() or "</think" in texte.lower()
    return d


def recouvrement(rendu: str, corrige: str) -> float:
    """La part des mots du corrigé que la réponse a retrouvés.

    **C'est une mesure grossière, et elle est annoncée comme telle.** Deux
    fragments peuvent dire la même chose sans partager un mot — *dead, lying on
    the ground* et *corpse sprawled face down* valent pareil pour un modèle
    d'image. Ce chiffre ne classe donc personne ; il sert à repérer d'un coup
    d'œil les réponses qui sont franchement à côté, et à décider lesquelles on
    ira lire de ses propres yeux.
    """
    attendus = _mots(corrige)
    if not attendus:
        return 0.0
    return len(attendus & _mots(rendu)) / len(attendus)


# ── Le corrigé, lu dans le produit lui-même ──────────────────────────────────


def corrige() -> list[dict[str, str]]:
    """Les soixante-dix paires, lues là où le produit les tient.

    On importe plutôt qu'on ne recopie : une paire corrigée dans le produit
    corrige le banc au prochain lancement, et un banc qui diverge de ce qu'il
    éprouve ne prouve plus rien.
    """
    from atelier.domaine.etiquettes_livrees import LIVREES

    return [
        {
            "libelle": e.libelle,
            "attendu": e.texte,
            "case": e.case,
            "case_dite": CASES.get(e.case, e.case),
        }
        for e in LIVREES
    ]


# ── L'épreuve ────────────────────────────────────────────────────────────────


@dataclass
class Compte:
    """Ce qu'une épreuve retient d'un modèle."""

    essais: list[dict[str, Any]] = field(default_factory=list)

    def ajouter(self, **quoi: Any) -> None:
        self.essais.append(quoi)

    def moyenne(self, cle: str) -> float:
        valeurs = [e[cle] for e in self.essais if isinstance(e.get(cle), (int, float))]
        return sum(valeurs) / len(valeurs) if valeurs else 0.0

    def part(self, cle: str) -> float:
        if not self.essais:
            return 0.0
        return sum(1 for e in self.essais if e.get(cle)) / len(self.essais)


def chauffer(modele: str) -> float:
    """Le premier appel, celui qui paie le chargement en mémoire vidéo.

    On le fait exprès et on le mesure à part, parce que c'est la seule dépense
    du lot que l'écran peut cacher — il suffit de la faire à l'ouverture de
    l'atelier plutôt qu'au premier clic sur la baguette.
    """
    debut = time.perf_counter()
    interroger(modele, "Reply with one word.", "Say ok.")
    return (time.perf_counter() - debut) * 1000


def _demande(p: dict[str, str]) -> str:
    return f"field: {p['case_dite']}\nFrench term: {p['libelle']}"


def _exemples(paires: list[dict[str, str]], cible: dict[str, str], combien: int = 3):
    """Trois paires **de la même case**, jamais celle qu'on interroge.

    De la même case parce que le style change d'un champ à l'autre — l'éclairage
    s'écrit en groupes nominaux, l'époque en énumérations. Jamais la cible,
    sinon le banc mesurerait la copie et non le savoir-faire.
    """
    voisines = [
        q
        for q in paires
        if q["case"] == cible["case"] and q["libelle"] != cible["libelle"]
    ]
    return [(_demande(q), q["attendu"]) for q in voisines[:combien]]


def _passer_etiquettes(
    modele: str,
    echantillon: list[dict[str, str]],
    toutes: list[dict[str, str]],
    avec_exemples: bool,
) -> Compte:
    compte = Compte()
    for i, p in enumerate(echantillon, 1):
        r = interroger(
            modele,
            SYSTEME_ETIQUETTE,
            _demande(p),
            exemples=_exemples(toutes, p) if avec_exemples else (),
        )
        d = ausculter(r.texte, mots_max=14)
        compte.ajouter(
            libelle=p["libelle"],
            case=p["case"],
            attendu=p["attendu"],
            rendu=r.texte,
            recouvrement=recouvrement(r.texte, p["attendu"]),
            utilisable=d.utilisable,
            defauts=d.liste,
            premier_jeton_ms=r.premier_jeton_ms,
            total_ms=r.total_ms,
            jetons_s=r.jetons_par_seconde,
            erreur=r.erreur,
        )
        if i % 20 == 0:
            print(f"    {i}/{len(echantillon)}", flush=True)
    return compte


def eprouver(modele: str, paires: list[dict[str, str]], limite: int) -> dict[str, Any]:
    print(f"\n{'=' * 70}\n  {modele}\n{'=' * 70}", flush=True)

    froid = chauffer(modele)
    print(f"  chargement à froid : {froid / 1000:.1f} s", flush=True)

    # ── Épreuve 1 : le corrigé des étiquettes, deux fois ──
    #
    # **La même question posée sèchement, puis avec trois exemples.** L'écart
    # entre les deux est le vrai résultat du banc : il dit si le produit doit
    # chercher un meilleur modèle, ou simplement mieux se servir de ce qu'il a
    # déjà — car les exemples, il les possède, ce sont ses propres étiquettes.
    echantillon = paires[:limite]
    print("  · sans exemple", flush=True)
    etiq = _passer_etiquettes(modele, echantillon, paires, avec_exemples=False)
    print("  · avec trois exemples de la même case", flush=True)
    etiq_ex = _passer_etiquettes(modele, echantillon, paires, avec_exemples=True)

    # ── Épreuve 2 : la traduction ──
    trad = Compte()
    for source, piege in TRADUCTIONS:
        r = interroger(modele, SYSTEME_TRADUCTION, source)
        d = ausculter(r.texte, mots_max=40)
        trad.ajouter(
            source=source,
            piege=piege,
            rendu=r.texte,
            utilisable=d.utilisable,
            defauts=d.liste,
            premier_jeton_ms=r.premier_jeton_ms,
            total_ms=r.total_ms,
            jetons_s=r.jetons_par_seconde,
            erreur=r.erreur,
        )

    # ── Épreuve 3 : l'étoffement ──
    etof = Compte()
    for source, piege in ETOFFEMENTS:
        r = interroger(modele, SYSTEME_ETOFFEMENT, source)
        d = ausculter(r.texte, mots_max=30)
        etof.ajouter(
            source=source,
            piege=piege,
            rendu=r.texte,
            mots=len(r.texte.split()),
            utilisable=d.utilisable,
            defauts=d.liste,
            premier_jeton_ms=r.premier_jeton_ms,
            total_ms=r.total_ms,
            jetons_s=r.jetons_par_seconde,
            erreur=r.erreur,
        )

    def _resume(c: Compte) -> dict[str, Any]:
        return {
            "recouvrement_moyen": c.moyenne("recouvrement"),
            "part_utilisable": c.part("utilisable"),
            "premier_jeton_ms": c.moyenne("premier_jeton_ms"),
            "total_ms": c.moyenne("total_ms"),
            "jetons_s": c.moyenne("jetons_s"),
            "essais": c.essais,
        }

    bilan = {
        "modele": modele,
        "chargement_froid_ms": froid,
        "etiquettes": _resume(etiq),
        "etiquettes_exemples": _resume(etiq_ex),
        "traduction": {
            "part_utilisable": trad.part("utilisable"),
            "premier_jeton_ms": trad.moyenne("premier_jeton_ms"),
            "total_ms": trad.moyenne("total_ms"),
            "essais": trad.essais,
        },
        "etoffement": {
            "part_utilisable": etof.part("utilisable"),
            "mots_moyens": etof.moyenne("mots"),
            "total_ms": etof.moyenne("total_ms"),
            "essais": etof.essais,
        },
    }
    e, x = bilan["etiquettes"], bilan["etiquettes_exemples"]
    print(
        f"  sans exemple : {e['recouvrement_moyen']:.0%} de recouvrement, "
        f"{e['part_utilisable']:.0%} utilisables tel quel",
        flush=True,
    )
    print(
        f"  avec exemples: {x['recouvrement_moyen']:.0%} de recouvrement, "
        f"{x['part_utilisable']:.0%} utilisables tel quel",
        flush=True,
    )
    print(
        f"  vitesse    : {x['premier_jeton_ms']:.0f} ms au premier jeton, "
        f"{x['total_ms'] / 1000:.1f} s au total, {x['jetons_s']:.0f} jetons/s",
        flush=True,
    )
    print(
        f"  traduction : {bilan['traduction']['part_utilisable']:.0%} utilisables · "
        f"étoffement : {bilan['etoffement']['part_utilisable']:.0%} utilisables, "
        f"{bilan['etoffement']['mots_moyens']:.0f} mots en moyenne",
        flush=True,
    )
    return bilan


def decharger(modele: str) -> None:
    """Rendre la mémoire vidéo avant d'éprouver le suivant.

    Sans ça, deux modèles cohabitent dans les 8 Go et le second est évalué dans
    des conditions que personne ne connaîtra jamais en vrai.
    """
    try:
        _poster(
            "/api/chat",
            {"model": modele, "messages": [], "keep_alive": 0},
            secondes=30.0,
        ).read()
    except Exception:  # pragma: no cover — le déchargement n'est pas critique
        pass


def main(argv: list[str]) -> int:
    limite = int(argv[1]) if len(argv) > 1 else 70
    paires = corrige()
    print(f"{len(paires)} paires au corrigé, {min(limite, len(paires))} éprouvées")

    RESULTATS.mkdir(parents=True, exist_ok=True)
    presents = set()
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=10) as r:
            presents = {m["name"] for m in json.load(r).get("models", [])}
    except Exception as souci:
        print(f"Ollama ne répond pas ({souci}). Est-il lancé ?")
        return 1

    bilans = []
    for modele in MODELES:
        if modele not in presents:
            print(f"\n— {modele} absent de la machine, passé")
            continue
        bilans.append(eprouver(modele, paires, limite))
        decharger(modele)

    sortie = RESULTATS / "banc.json"
    sortie.write_text(
        json.dumps(bilans, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nDétail complet écrit dans {sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
