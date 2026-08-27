# -*- coding: utf-8 -*-
"""Essai de couverture image d'OpenRouter — le risque à lever en T1.

`docs/ARCHITECTURE.md` §11 le pose ainsi : *« La couverture image d'OpenRouter —
gravité moyenne — à vérifier en T1 ; OpenRouter route surtout des modèles de
langage. »* Tout le produit passe par une passerelle unique : si elle ne
présente qu'une poignée de modèles image, ou si elle en perd d'une semaine à
l'autre, la décision d'adaptateur unique est à revoir.

Cet essai ne coûte rien : le catalogue est public, aucune clé n'est demandée,
aucune image n'est générée. Il répond à quatre questions, dans cet ordre :

1. **Combien de modèles image, et de combien de fournisseurs ?**
2. **Combien acceptent assez de références pour le geste réel de la V1 ?**
   Un univers, c'est au moins deux planches de style, plus la source d'édition
   quand on enchaîne les poses — donc trois références au minimum.
3. **Qu'est-ce qui a bougé depuis le relevé du 26 août 2026 ?** Un plafond qui
   change en silence est exactement ce qu'une liste écrite en dur ne voit pas.
4. **Les trois finalistes du banc sont-ils toujours là, avec les mêmes
   capacités ?**

    Lancer :  py essais/essai_couverture.py

Sortie : ce journal, et `essais/couverture.json` pour la comparaison suivante.
"""

from __future__ import annotations

import asyncio
import collections
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from atelier.domaine import Modele  # noqa: E402
from atelier.domaine.catalogue import modele_en_json  # noqa: E402
from atelier.fournisseur import OpenRouter  # noqa: E402

RELEVE_26_AOUT = RACINE / "catalogue.json"
SORTIE = RACINE / "couverture.json"

# Ce dont la V1 a besoin, et pourquoi. Aucun de ces seuils n'est décoratif.
REFERENCES_UNIVERS = 3  # deux planches de style + la source d'édition
FINALISTES = (
    "openai/gpt-image-2",
    "bytedance-seed/seedream-5-0-lite",
    "bytedance-seed/seedream-4.5",
)


def fournisseur_de(identifiant: str) -> str:
    return identifiant.split("/", 1)[0]


def releve_precedent() -> dict[str, dict]:
    """Le relevé du 26 août, dans le vocabulaire d'OpenRouter — c'est le seul
    endroit du dépôt qui le lit encore, et c'est pour le comparer."""
    if not RELEVE_26_AOUT.exists():
        return {}
    brut = json.loads(RELEVE_26_AOUT.read_text(encoding="utf-8"))
    fiches = {}
    for fiche in brut.get("data", []):
        declares = fiche.get("supported_parameters") or {}
        references = declares.get("input_references") or {}
        fiches[fiche["id"]] = {
            "references_max": int(references.get("max", 0)),
            "parametres": sorted(declares),
        }
    return fiches


def titre(texte: str) -> None:
    print(f"\n{texte}\n{'-' * len(texte)}")


def couverture(modeles: list[Modele]) -> int:
    titre(f"{len(modeles)} modèles image")

    par_fournisseur = collections.Counter(
        fournisseur_de(m.identifiant) for m in modeles
    )
    for nom, nombre in par_fournisseur.most_common():
        print(f"  {nom:22} {nombre:3}")
    print(f"  {'= fournisseurs':22} {len(par_fournisseur):3}")

    titre("Ce que la V1 demande")
    assez = [m for m in modeles if m.references_max >= REFERENCES_UNIVERS]
    sans = [m for m in modeles if m.references_max == 0]
    print(
        f"  {len(assez):3} modèles acceptent {REFERENCES_UNIVERS} références ou plus"
        f"  (deux planches de style + la source d'édition)"
    )
    print(f"  {len(sans):3} n'acceptent aucune référence — inutilisables pour un univers")
    plafonds = collections.Counter(m.references_max for m in modeles)
    print(
        "  plafonds : "
        + ", ".join(f"{p}→{n}" for p, n in sorted(plafonds.items(), reverse=True))
    )

    variations = [m for m in modeles if m.variations_max > 1]
    print(f"  {len(variations):3} rendent plusieurs images en un appel")

    vectoriels = [
        m
        for m in modeles
        if (o := m.options.get("output_format")) and set(o.valeurs) == {"svg"}
    ]
    if vectoriels:
        print(
            f"  {len(vectoriels):3} ne rendent que du SVG — hors périmètre V1, "
            "à reconsidérer pour l'interface"
        )

    titre("Les trois finalistes du banc du 26 août")
    index = {m.identifiant: m for m in modeles}
    manquants = 0
    for identifiant in FINALISTES:
        modele = index.get(identifiant)
        if modele is None:
            manquants += 1
            print(f"  ABSENT   {identifiant}")
            continue
        options = ", ".join(sorted(modele.options)) or "—"
        print(
            f"  présent  {identifiant:35} {modele.references_max:2} réfs"
            f"  ×{modele.variations_max}  [{options}]"
        )
    return manquants


def derive(modeles: list[Modele]) -> int:
    precedent = releve_precedent()
    if not precedent:
        print("\n(pas de relevé précédent — rien à comparer)")
        return 0

    titre("Dérive depuis le relevé du 26 août 2026")
    actuels = {m.identifiant: m for m in modeles}
    apparus = sorted(set(actuels) - set(precedent))
    disparus = sorted(set(precedent) - set(actuels))
    bouges = [
        (i, precedent[i]["references_max"], actuels[i].references_max)
        for i in sorted(set(actuels) & set(precedent))
        if precedent[i]["references_max"] != actuels[i].references_max
    ]

    for identifiant in apparus:
        print(f"  + {identifiant}")
    for identifiant in disparus:
        print(f"  - {identifiant}   (disparu du catalogue)")
    for identifiant, avant, apres in bouges:
        print(f"  ~ {identifiant} : plafond de références {avant} → {apres}")
    if not (apparus or disparus or bouges):
        print("  aucune — le catalogue est identique sur ce qui nous concerne")

    print(
        "\n  C'est exactement ce qu'une liste écrite en dur ne verrait pas."
        "\n  Le catalogue est relu au démarrage, il décide seul."
    )
    return len(disparus)


async def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    print("Essai de couverture image — OpenRouter, catalogue public, aucun frais")
    depart = time.monotonic()
    modeles = await OpenRouter().catalogue()
    print(f"catalogue reçu en {time.monotonic() - depart:.1f} s")

    manquants = couverture(modeles)
    disparus = derive(modeles)

    SORTIE.write_text(
        json.dumps(
            {
                "releve_le": time.time(),
                "modeles": [modele_en_json(m) for m in modeles],
            },
            indent=1,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    titre("Verdict")
    assez = sum(1 for m in modeles if m.references_max >= REFERENCES_UNIVERS)
    if len(modeles) >= 20 and assez >= 10 and manquants == 0:
        print(
            "  Risque levé. La couverture image d'OpenRouter tient la V1 :"
            f" {len(modeles)} modèles, {assez} utilisables pour un univers,"
            " et les trois finalistes du banc sont là."
        )
        verdict = 0
    else:
        print(
            f"  À regarder : {len(modeles)} modèles, {assez} utilisables pour un"
            f" univers, {manquants} finaliste(s) absent(s), {disparus} disparu(s)."
        )
        verdict = 1
    print(f"  Relevé écrit : {SORTIE}")
    return verdict


if __name__ == "__main__":
    sys.exit(asyncio.run(principal()))
