# -*- coding: utf-8 -*-
"""Le banc des modèles qui regardent — celui que la demande d'origine réclamait.

**Il existe parce qu'un document du dépôt a rectifié la question.** Dans
`docs/archive/brainstorm-assistance.md`, l'auteur décrit son geste réel : il
sort de l'atelier, va chez un service en ligne, **lui donne l'image de
référence**, et en rapporte un prompt anglais retravaillé. Deux des quatre
usages qu'il avait alors listés — *décrire une image* et *rédiger la bible
depuis les artworks* — ne sont donc pas des tâches de texte. Un modèle qui ne
sait que lire du texte ne les fera jamais, et les mesurer sur du texte seul
aurait répondu à côté.

**Le corrigé est de nouveau écrit d'avance, et par la machine cette fois.**
Chaque image produite est rangée à côté du prompt qui l'a fabriquée
(`donnees/generations/<id>/generation.json`). On montre donc l'image au modèle,
on lui demande le prompt, et on compare à celui qui a réellement servi. Aucune
autre épreuve n'a de réponse aussi peu discutable : ce n'est pas un avis sur ce
qu'il *aurait fallu* écrire, c'est le texte qui a produit exactement ces pixels.

**Ce que ce banc ne dit pas.** Un prompt différent peut produire la même image,
et un prompt identique ne la reproduit pas deux fois. Le recouvrement de mots
n'est donc pas une note ; il sert à trier ce qu'on ira lire. La question posée
est plus modeste et plus utile : *le modèle voit-il ce qui est là* — le sujet,
la vue, le trait, le fond — **sans inventer ce qui n'y est pas** ?

Lancement :  python docs/recherche-llm-local/banc_vue.py
"""

from __future__ import annotations

import base64
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from banc import (  # noqa: E402  — le banc de texte porte déjà la mécanique
    OLLAMA,
    RESULTATS,
    Reponse,
    _sans_reflexion,
    decharger,
    recouvrement,
)

# Ceux qui savent regarder, relevé par `ollama show` et non supposé.
MODELES: tuple[str, ...] = (
    "qwen3.5:4b",
    "gemma3:4b",
    "ministral-3:3b",
    "qwen3.5:9b",
)

# **Deux consignes, parce que les deux usages ne demandent pas la même chose.**
# Décrire sert à remplir le signalement d'une chose du jeu ; relever le style
# sert à remplir la bible, et ne parle jamais du sujet.
SYSTEME_DECRIRE = (
    "You look at one 2D video-game asset and describe it as an image-generation "
    "prompt. Name only what you can actually see: the subject, what it wears or "
    "carries, its posture, the camera angle, the outline, the background. "
    "Never invent a colour, an object, a setting or a mood that is not visible. "
    "Reply with the prompt ONLY: lowercase, comma-separated descriptors, under "
    "thirty words, no preamble and no explanation."
)

SYSTEME_STYLE = (
    "You look at one 2D video-game asset and report its DRAWING STYLE only. "
    "Never name the subject. Report: rendering technique, outline, shading, "
    "palette breadth, and pixel grid if visible. Reply with the style ONLY: "
    "lowercase, comma-separated descriptors, under twenty words, no preamble."
)


def _images() -> list[dict[str, Any]]:
    """Les images du dépôt qui ont gardé le prompt qui les a faites.

    On prend le rendu et non le brut : c'est ce que l'auteur regarde, et c'est
    ce qu'il montrerait à un modèle. On écarte les prompts qui contiennent du
    français, parce que ce sont précisément ceux dont on ne sait pas dire si le
    texte décrit vraiment l'image.
    """
    trouvees = []
    for fiche in sorted((RACINE / "donnees" / "generations").glob("*/generation.json")):
        try:
            d = json.loads(fiche.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):  # pragma: no cover — fichier abîmé
            continue
        prompt = (d.get("demande") or {}).get("prompt") or ""
        if not prompt:
            continue
        rendus = sorted(fiche.parent.glob("*-rendu.png"))
        if not rendus:
            continue
        trouvees.append({"dossier": fiche.parent.name, "prompt": prompt, "image": rendus[0]})
    return trouvees


def _sujet(prompt: str) -> str:
    """Ce que l'auteur a demandé, sans le décor d'assemblage.

    Le prompt assemblé fait 1 868 caractères en moyenne, dont la quasi-totalité
    est la bible du jeu, répétée à chaque appel. Comparer un modèle à ça
    mesurerait sa capacité à deviner l'univers, pas à voir l'image. On ne garde
    donc que ce qui suit les intitulés de bible : le sujet.
    """
    lignes = [
        l.strip()
        for l in prompt.splitlines()
        if l.strip()
        and not re.match(
            r"^(World|Era|Rendering technique|Line and shading|Lighting|"
            r"View and framing|Technical constraints|Camera|Reference|Style):",
            l.strip(),
        )
    ]
    return " ".join(lignes)[:400]


def regarder(modele: str, systeme: str, image: Path, mots_max: int) -> Reponse:
    charge = {
        "model": modele,
        "messages": [
            {"role": "system", "content": systeme},
            {
                "role": "user",
                "content": "Describe this asset.",
                "images": [base64.b64encode(image.read_bytes()).decode("ascii")],
            },
        ],
        "stream": False,
        "keep_alive": "10m",
        "options": {"temperature": 0.2, "num_predict": 200},
        "think": False,
    }
    debut = time.perf_counter()
    try:
        requete = urllib.request.Request(
            OLLAMA + "/api/chat",
            data=json.dumps(charge).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(requete, timeout=300) as r:
            bloc = json.load(r)
    except Exception as souci:  # pragma: no cover — panne du moteur
        return Reponse("", 0.0, (time.perf_counter() - debut) * 1000, 0, str(souci))
    ms = (time.perf_counter() - debut) * 1000
    texte = _sans_reflexion((bloc.get("message") or {}).get("content") or "")
    return Reponse(texte, ms, ms, int(bloc.get("eval_count") or 0))


def main() -> int:
    images = _images()
    print(f"{len(images)} images du dépôt gardent le prompt qui les a faites")
    if not images:
        return 1
    echantillon = images[:12]

    bilans = []
    for modele in MODELES:
        print(f"\n{'=' * 70}\n  {modele}\n{'=' * 70}", flush=True)
        essais = []
        for i, cas in enumerate(echantillon, 1):
            attendu = _sujet(cas["prompt"])
            vu = regarder(modele, SYSTEME_DECRIRE, cas["image"], 30)
            style = regarder(modele, SYSTEME_STYLE, cas["image"], 20)
            essais.append(
                {
                    "dossier": cas["dossier"],
                    "attendu": attendu,
                    "decrit": vu.texte,
                    "style": style.texte,
                    "recouvrement": recouvrement(vu.texte, attendu),
                    "ms_decrire": vu.total_ms,
                    "ms_style": style.total_ms,
                    "erreur": vu.erreur or style.erreur,
                }
            )
            print(f"    {i}/{len(echantillon)}  {vu.total_ms:.0f} ms", flush=True)
        moy = sum(e["recouvrement"] for e in essais) / len(essais)
        ms = sum(e["ms_decrire"] for e in essais) / len(essais)
        print(f"  recouvrement moyen avec le sujet demandé : {moy:.0%}")
        print(f"  temps moyen pour regarder et écrire : {ms / 1000:.1f} s")
        bilans.append({"modele": modele, "recouvrement": moy, "ms": ms, "essais": essais})
        decharger(modele)

    RESULTATS.mkdir(parents=True, exist_ok=True)
    sortie = RESULTATS / "banc-vue.json"
    sortie.write_text(json.dumps(bilans, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDétail complet écrit dans {sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
