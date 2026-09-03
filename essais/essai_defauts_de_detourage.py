# -*- coding: utf-8 -*-
"""Le banc de D1 — combien de recettes du dépôt s'écartent encore de leur défaut.

Écrit le 3 septembre 2026 pour le septième critère de la tranche : *« vérifié en
comptant, après la tranche, combien de recettes du dépôt s'écarteraient encore de
leur défaut »*. Il existe pour que ce chiffre-là se refasse au lieu d'être cru.

**Il ne coûte rien.** Il relit les assets déjà sur le disque, compare leur
détourage à ce que leur univers leur imposerait aujourd'hui, et n'appelle
personne. Aucune clé n'est lue.

**Ce qu'il a trouvé le jour de la tranche, et qui a corrigé le plan.** Le plan
partait d'un comptage juste mais incomplet : 64 découpages sur 123 portent un
durcissement quand le réglage livré est zéro, et l'écart se lisait entre une
image seule (67 %) et un morceau de planche (38 %). Croisé avec le **moteur**,
cet écart s'évapore — à moteur égal la nature ne décide presque plus rien —
pendant que le moteur, lui, décide tout :

    bord     72 passes   durcissement nul 78 %   le plus souvent 0
    couleur  11 passes   durcissement nul  0 %   le plus souvent 1
    modele   40 passes   durcissement nul  2 %   le plus souvent 2

La raison était écrite à deux pages de là dans `docs/bilan-v3.md` sans avoir
jamais été jointe à ce comptage : le moteur du bord **ne produit aucun pixel à
demi transparent**, il est binaire par construction, donc il n'y a pas de frange
à ronger. Le moteur par modèle en produit sur 95 % du sujet.

    Lancer :  py essais/essai_defauts_de_detourage.py
              py essais/essai_defauts_de_detourage.py --donnees chemin/vers/donnees

Sortie : ce journal, et `essais/mesures_defauts_detourage.json` pour lire la
dérive d'une exécution à l'autre.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

RACINE = Path(__file__).resolve().parents[1]

from atelier.domaine.projet import IMAGE_SEULE, PLANCHE, Univers  # noqa: E402
from atelier.domaine.recette import (  # noqa: E402
    DURCISSEMENT_LIVRE,
    MOTEURS,
    Recette,
)


# ── Ce qu'on relit ───────────────────────────────────────────────────────────


def _lire(chemin: Path) -> dict[str, Any]:
    return json.loads(chemin.read_text(encoding="utf-8"))


def _assets(racine: Path) -> list[dict[str, Any]]:
    """Les assets vivants. **Un asset supprimé ne compte pas** : sa recette ne
    dit plus ce que l'auteur veut, elle dit ce qu'il a jeté."""
    trouves = []
    for chemin in sorted((racine / "generations").rglob("*-asset.json")):
        try:
            asset = _lire(chemin)
        except (OSError, json.JSONDecodeError) as erreur:
            print(f"  illisible — {chemin.name} : {erreur}")
            continue
        if not asset.get("supprime_le"):
            trouves.append(asset)
    return trouves


def _projets(racine: Path) -> dict[str, Univers]:
    # Un projet est un **dossier** qui porte son `projet.json`, avec son tableau
    # et ses personnages à côté — pas un fichier à plat.
    univers = {}
    for chemin in sorted((racine / "projets").glob("*/projet.json")):
        projet = _lire(chemin)
        identifiant = projet.get("identifiant") or chemin.parent.name
        univers[identifiant] = Univers.depuis_json(projet.get("univers"))
    return univers


def _echelles(racine: Path) -> dict[str, str]:
    """L'échelle demandée par chaque génération — c'est elle qui porte la famille."""
    demandees = {}
    for chemin in sorted((racine / "generations").rglob("generation.json")):
        generation = _lire(chemin)
        identifiant = generation.get("identifiant") or chemin.parent.name
        demande = generation.get("demande") or {}
        demandees[identifiant] = str(demande.get("echelle") or "")
    return demandees


# ── Les deux comptages ───────────────────────────────────────────────────────


def _par_moteur(assets: list[dict[str, Any]]) -> dict[str, Counter]:
    """Le durcissement que l'auteur a posé, moteur par moteur.

    **C'est la mesure qui décide du défaut livré**, et elle porte sur *toutes*
    les passes : une seconde passe est un réglage aussi délibéré que la première.
    """
    compte: dict[str, Counter] = defaultdict(Counter)
    for asset in assets:
        for passe in Recette.depuis_json(asset.get("recette")).passes:
            compte[passe.moteur][passe.durcissement] += 1
    return compte


def _par_nature(assets: list[dict[str, Any]]) -> dict[tuple[str, str], Counter]:
    """Le même comptage, croisé avec la nature de l'image.

    **C'est le test décisif du plan** : si une planche et une image seule
    voulaient vraiment des réglages différents, l'écart devrait survivre au
    croisement. Il n'y survit pas.
    """
    compte: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for asset in assets:
        nature = PLANCHE if asset.get("lot") else IMAGE_SEULE
        for passe in Recette.depuis_json(asset.get("recette")).passes:
            compte[(passe.moteur, nature)][passe.durcissement] += 1
    return compte


def _ecarts(
    assets: list[dict[str, Any]],
    univers: dict[str, Univers],
    echelles: dict[str, str],
) -> dict[str, Any]:
    """Le critère 7 : combien de recettes s'écartent encore de leur défaut.

    **Comparées sur ce qui se règle, pas sur la passe entière.** Le point de la
    pipette, le tracé à main levée et le masquage n'appartiennent qu'à une image
    et ne peuvent pas être un défaut ; les compter comme des écarts ferait dire
    « écarté » à une recette qui applique exactement son défaut, plus un geste.
    """
    total = 0
    ecartees = 0
    par_champ: Counter = Counter()
    sans_projet = 0
    for asset in assets:
        recette = Recette.depuis_json(asset.get("recette"))
        if not recette.passes:
            # Pas de détourage du tout : un décor, ou une image entrée telle
            # quelle. Il n'y a pas de défaut à comparer, donc pas d'écart.
            continue
        monde = univers.get(str(asset.get("projet") or ""))
        if monde is None:
            sans_projet += 1
            continue
        nature = PLANCHE if asset.get("lot") else IMAGE_SEULE
        echelle = monde.echelle(echelles.get(str(asset.get("generation")), ""))
        defaut, _ = monde.detourage(nature, echelle.famille if echelle else "")
        premiere = recette.passes[0]
        total += 1
        different = False
        for champ in ("moteur", "tolerance", "seuil_alpha", "durcissement"):
            if getattr(premiere, champ) != getattr(defaut, champ):
                par_champ[champ] += 1
                different = True
        if different:
            ecartees += 1
    return {
        "comparees": total,
        "ecartees": ecartees,
        "par_champ": dict(par_champ.most_common()),
        "sans_projet": sans_projet,
    }


def _durcissements_retapes(assets: list[dict[str, Any]]) -> dict[str, Any]:
    """Ce que la tranche fait gagner, en un seul nombre.

    **Combien de fois l'auteur a dû taper le durcissement lui-même**, avant et
    après. Avant, le produit livrait zéro quel que soit le moteur ; après, chaque
    moteur amène le sien. La question n'est donc pas « la recette est-elle
    identique au défaut ? » — un moteur choisi image par image ne peut pas être
    un défaut — mais **« ce moteur-là étant choisi, restait-il un chiffre à
    poser ? »**

    C'est la mesure qui justifie la tranche telle qu'elle a été livrée, et elle
    est plus honnête que le simple écart au défaut : elle ne compte pas contre le
    produit un choix que le produit n'avait pas à faire.
    """
    avant = 0
    apres = 0
    passes = 0
    for asset in assets:
        for passe in Recette.depuis_json(asset.get("recette")).passes:
            passes += 1
            # Avant D1 : le produit livrait zéro pour tous les moteurs.
            if passe.durcissement != 0:
                avant += 1
            # Après D1 : le moteur amène le sien.
            if passe.durcissement != DURCISSEMENT_LIVRE.get(passe.moteur, 0):
                apres += 1
    return {"passes": passes, "retapes_avant": avant, "retapes_apres": apres}


# ── Le journal ───────────────────────────────────────────────────────────────


def _dire_moteurs(compte: dict[str, Counter]) -> list[dict[str, Any]]:
    lignes = []
    for moteur in MOTEURS:
        valeurs = compte.get(moteur)
        if not valeurs:
            continue
        passes = sum(valeurs.values())
        nuls = valeurs.get(0, 0)
        frequente, combien = max(valeurs.items(), key=lambda kv: kv[1])
        livre = DURCISSEMENT_LIVRE[moteur]
        lignes.append(
            {
                "moteur": moteur,
                "passes": passes,
                "part_nulle": round(100 * nuls / passes),
                "plus_frequent": frequente,
                "part_du_plus_frequent": round(100 * combien / passes),
                "livre": livre,
                "livre_est_le_plus_frequent": livre == frequente,
            }
        )
        accord = "✓" if livre == frequente else "✗"
        print(
            f"  {moteur:8} {passes:3} passes · "
            f"durcissement nul {100 * nuls / passes:3.0f} % · "
            f"le plus souvent {frequente} ({100 * combien / passes:.0f} %) · "
            f"livré {livre} {accord}"
        )
    return lignes


def _dire_natures(compte: dict[tuple[str, str], Counter]) -> list[dict[str, Any]]:
    lignes = []
    for moteur in MOTEURS:
        des_deux = [
            (nature, compte[(moteur, nature)])
            for nature in (IMAGE_SEULE, PLANCHE)
            if compte.get((moteur, nature))
        ]
        if len(des_deux) < 2:
            continue
        print(f"  moteur « {moteur} » :")
        for nature, valeurs in des_deux:
            passes = sum(valeurs.values())
            non_nuls = sum(v for k, v in valeurs.items() if k)
            part = round(100 * non_nuls / passes)
            lignes.append(
                {"moteur": moteur, "nature": nature, "passes": passes,
                 "part_non_nulle": part}
            )
            print(f"    {nature:8} {passes:3} passes · durcissement non nul {part:3} %")
    return lignes


def main() -> None:
    # Windows encode la sortie en cp1252 dès qu'elle est redirigée, et un simple
    # « ── » lève alors une UnicodeEncodeError (`docs/PIEGES.md`).
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--donnees", default=str(RACINE / "donnees"))
    arguments = parseur.parse_args()
    racine = Path(arguments.donnees)

    if not (racine / "generations").is_dir():
        print(f"Aucune donnée à lire dans « {racine} ».")
        return

    assets = _assets(racine)
    univers = _projets(racine)
    echelles = _echelles(racine)
    lots = sum(1 for a in assets if a.get("lot"))

    print()
    print("═" * 74)
    print("  D1 · Le détourage par défaut, relu sur les recettes du dépôt")
    print("═" * 74)
    print(
        f"\n{len(assets)} assets vivants — {len(assets) - lots} images seules, "
        f"{lots} morceaux de planche, dans {len(univers)} projets."
    )

    print("\n① Le durcissement suit-il le moteur ?")
    moteurs = _dire_moteurs(_par_moteur(assets))

    print("\n② À moteur égal, la nature de l'image décide-t-elle encore ?")
    natures = _dire_natures(_par_nature(assets))
    print(
        "\n   Si les deux lignes d'un moteur se ressemblent, la nature ne décide\n"
        "   rien de plus que lui — et c'est ce que la tranche a mesuré."
    )

    print("\n③ Combien de recettes s'écartent encore de leur défaut ?")
    ecarts = _ecarts(assets, univers, echelles)
    if ecarts["comparees"]:
        part = 100 * ecarts["ecartees"] / ecarts["comparees"]
        print(
            f"  {ecarts['ecartees']} sur {ecarts['comparees']} comparées "
            f"= {part:.0f} %"
        )
        for champ, combien in ecarts["par_champ"].items():
            print(f"    {champ:14} {combien:3}")
    else:
        print("  aucune recette à comparer")
    if ecarts["sans_projet"]:
        print(
            f"  ({ecarts['sans_projet']} assets sans projet connu, non comparés — "
            "un projet effacé n'impose plus rien)"
        )

    print("\n④ Combien de fois l'auteur a-t-il dû taper le durcissement lui-même ?")
    retapes = _durcissements_retapes(assets)
    if retapes["passes"]:
        avant = 100 * retapes["retapes_avant"] / retapes["passes"]
        apres = 100 * retapes["retapes_apres"] / retapes["passes"]
        print(
            f"  avant D1 (le produit livrait zéro pour tous les moteurs) : "
            f"{retapes['retapes_avant']} sur {retapes['passes']} = {avant:.0f} %"
        )
        print(
            f"  après D1 (chaque moteur amène le sien)                   : "
            f"{retapes['retapes_apres']} sur {retapes['passes']} = {apres:.0f} %"
        )

    sortie = RACINE / "essais" / "mesures_defauts_detourage.json"
    sortie.write_text(
        json.dumps(
            {"assets": len(assets), "morceaux_de_planche": lots,
             "par_moteur": moteurs, "par_nature": natures, "ecarts": ecarts,
             "durcissements_retapes": retapes},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nÉcrit : {sortie.relative_to(RACINE)}\n")


if __name__ == "__main__":
    main()
