# -*- coding: utf-8 -*-
"""Regrouper les réglages par famille — **parce que deux tirages ne prouvent rien.**

Le banc a livré un classement propre, réglage par réglage. Mais chaque réglage
n'a que **deux tirages**, et le banc fournit lui-même la preuve que ça ne suffit
pas : deux tirages d'une même demande ont donné 67 % et 14 % de déformation. Sur
deux jets, le hasard pèse plus que la recette.

La parade est de regrouper : une famille rassemble les réglages qui partagent la
chose qu'on teste, et compte leurs tirages ensemble.

**Ce que le regroupement a fait, et c'est un service qu'on ne lui demandait pas :
il a tué deux hypothèses.** Sur trois tirages, retirer du prompt la clause
« same proportions, same size » — qui interdit au corps de changer de forme —
semblait tout changer. Sur onze, l'effet a disparu. Le guide de cycle de marche
joint en quatrième image : rien non plus. Les familles 1, 2 et 2b sont les trois
qu'on a payées cher pour les départager, **et elles ne se départagent pas**.

**Ce qui décide n'est dans aucune de ces familles-là**, et ne se voit que dans le
second tableau : celui qui ne compte que les planches que le produit saurait
ouvrir. Une planche dont le modèle a redessiné le quadrillage, ce banc sait la
rouvrir pour la mesurer — le produit, non. Les garder dans le classement revient
à comparer ce qu'on saurait livrer avec ce qu'on ne saurait pas, et c'est ce qui
faisait remonter des familles inutilisables en tête.

    .venv\Scripts\python.exe essais/familles_recette.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE.parent))

from juger_recette import BANC, SEUIL_FORME, TEMOIN, mesurer  # noqa: E402

# Les familles, dans l'ordre où elles se lisent. Les quatre premières sont le
# croisement qu'on a payé pour trancher — clause de forme présente ou non, guide
# joint ou non — et leur intérêt est **négatif** : elles se ressemblent toutes.
# Les suivantes regroupent les autres axes, y compris ceux qui n'ont rien donné,
# parce qu'un essai raté qu'on n'écrit pas se refait.
FAMILLES = [
    (
        "1 prompt du produit, tel quel  << ACTUEL",
        "Exactement ce que le produit envoie aujourd'hui : les huit tirages du banc des "
        "modèles, repassés par le juge de ce banc-ci.",
        ["@temoin"],
    ),
    (
        "2 idem, clause de forme remplacee",
        "Le meme prompt, dont on a seulement remplace « same proportions, same size » par "
        "l'autorisation explicite de changer de forme. Rien d'autre ne bouge.",
        ["F-sans-proportions"],
    ),
    (
        "2b idem, plus le guide de marche  << CASE DECISIVE",
        "La meme demande que la 2, avec le guide de cycle joint en quatrieme image. "
        "C'est la seule combinaison a la fois animee et decoupable, et la seule paire du "
        "banc ou le guide est la seule chose qui change.",
        ["G-livrable-guide"],
    ),
    (
        "3 idem, plus le guide de marche",
        "Le prompt du produit mot pour mot, clause comprise, plus le guide de cycle en "
        "quatrieme image. La case du croisement qui manque est celle-ci sans la clause.",
        ["F-exact-guide"],
    ),
    (
        "4 consigne d'essai + guide (non decoupable)",
        "Les plus belles marches du banc — et des planches que le produit ne saurait pas "
        "ouvrir : ma consigne omettait le paragraphe qui interdit de redessiner le "
        "quadrillage, et le modele l'a redessine.",
        ["C-guide-baton", "F-gagnant-encore"],
    ),
    (
        "5 consigne d'essai + autres guides",
        "Silhouettes pleines, guide a la place du gabarit, guide sans l'artwork du jeu.",
        ["C-guide-silhouette", "C-guide-sans-carte", "C-guide-seul"],
    ),
    (
        "6 consigne d'essai, sans guide",
        "La meme consigne d'essai, references du produit. C'est le temoin interne de la "
        "famille 4 : ce que le guide ajoute se lit dans l'ecart entre les deux.",
        ["A-8-cases"],
    ),
    (
        "7 consigne d'essai, references changees",
        "On enleve ou on remplace ce qu'on joint — gabarit, numeros, artwork, case "
        "amorcee — sans joindre de guide.",
        ["C-sans-gabarit", "C-numerote", "C-amorce", "C-sans-carte"],
    ),
    (
        "8 consigne reecrite de fond, sans guide",
        "Cycle continu, vocabulaire d'animateur, description par difference, une seule "
        "phrase, interdiction explicite des poses figees. Aucune n'enumere les poses.",
        ["B-cycle", "B-animateur", "B-difference", "B-minimal", "B-interdit"],
    ),
    (
        "9 consigne reecrite de fond, avec guide",
        "Les memes reecritures, guide joint. L'image ne rattrape pas le texte.",
        ["D-guide-cycle", "D-guide-difference", "D-tout", "D-4-guide", "D-6-guide"],
    ),
    (
        "10 moins de huit cases",
        "Quatre ou six cases au lieu de huit, consigne d'essai, pas de guide.",
        ["A-4-cases", "A-6-cases"],
    ),
    (
        "11 quatre cases ou case amorcee, texte cycle",
        "Deux melanges qu'aucune paire propre ne couvre, gardes pour ne rien cacher.",
        ["D-4-cycle", "D-amorce-cycle"],
    ),
    (
        "12 image large plutot que carree",
        "Quatre colonnes sur deux lignes, en 3:2 ou en 16:9, consigne d'essai.",
        ["E-3-2", "E-16-9"],
    ),
]


def main() -> None:
    jugements = json.loads((BANC / "jugements.json").read_text("utf-8"))
    par_reglage: dict[str, list[dict]] = {}
    for l in jugements:
        par_reglage.setdefault(l["reglage"], []).append(l)

    # Le témoin est remesuré ici aussi, par le même juge — jamais relu d'un
    # ancien fichier, qui comptait autrement.
    par_reglage["@temoin"] = [mesurer(p.read_bytes(), 8) for p in sorted(TEMOIN.glob("jet*.png"))]

    # **Aucun réglage ne doit tomber entre les familles.** Un essai payé qu'on
    # oublie de classer disparaît du tableau sans que rien ne le signale, et le
    # lecteur croit avoir tout vu.
    classes = {r for _, _, rs in FAMILLES for r in rs}
    oublies = sorted(set(par_reglage) - classes)
    if oublies:
        print(f"[!] non classes, ils ne comptent nulle part : {', '.join(oublies)}\n")

    e = (f"{'famille':<34} {'tirages':>8} {'animes':>7} {'part':>6} {'decoup':>7} "
         f"{'forme moy':>10} {'mediane':>8} {'jambes':>7}")
    print(e)
    print("-" * len(e))
    sortie = []
    for nom, propos, reglages in FAMILLES:
        tirages = [t for r in reglages for t in par_reglage.get(r, [])]
        formes = [t["forme_pct"] for t in tirages if t.get("forme_pct") is not None]
        jambes = [t["jambes_pct"] for t in tirages if t.get("jambes_pct") is not None]
        animes = sum(1 for f in formes if f >= SEUIL_FORME)
        s = {
            "famille": nom,
            "propos": propos,
            "reglages": reglages,
            "tirages": len(tirages),
            "animes": animes,
            "decoupables": sum(1 for x in tirages if x.get("cases_recoupees", 0) == 0),
            "part_animee_pct": round(animes / len(tirages) * 100) if tirages else 0,
            "forme_moyenne": round(float(np.mean(formes)), 1) if formes else None,
            "forme_mediane": round(float(np.median(formes)), 1) if formes else None,
            "forme_min": min(formes) if formes else None,
            "forme_max": max(formes) if formes else None,
            "jambes_moyennes": round(float(np.mean(jambes)), 1) if jambes else None,
        }
        sortie.append(s)
        print(
            f"{nom:<34} {s['tirages']:>8} {s['animes']:>7} {s['part_animee_pct']:>5} % "
            f"{s['decoupables']:>7} {s['forme_moyenne']:>10} {s['forme_mediane']:>8} "
            f"{s['jambes_moyennes']:>7}"
        )

    (BANC / "familles.json").write_text(json.dumps(sortie, indent=1, ensure_ascii=False), "utf-8")
    sur_decoupables(par_reglage)
    print()
    print(f"anime  = forme >= {SEUIL_FORME} %, le seuil au-dessus duquel le corps se deforme vraiment")
    print("decoup = planches que le produit saurait ouvrir : le modele n'a pas redessine le quadrillage")
    print("-> essais/resultats_recette/familles.json")


def nature(texte: str) -> str:
    """De quelle sorte est la consigne envoyée — trois sortes, et pas une de plus.

    Ce qui les distingue n'est pas le nombre de mots mais **ce qu'elles disent
    de chaque case** : le prompt du produit et ma consigne d'essai énumèrent
    toutes deux les poses une par une ; les cinq réécritures de fond décrivent le
    mouvement en général. Et le prompt du produit **seul** porte le paragraphe
    qui interdit de redessiner le quadrillage.
    """
    if "Do NOT draw the cell outlines" in texte:
        return "prompt du produit (avec son paragraphe protecteur)"
    if "walk cycle, frame 1 of" in texte:
        return "consigne d'essai, poses détaillées case par case"
    return "consigne réécrite de fond, mouvement décrit en général"


def sur_decoupables(par_reglage: dict[str, list[dict]]) -> None:
    """**Le tableau qui décide, et le seul qui compare ce qui est comparable.**

    Une planche dont le modèle a redessiné le quadrillage, ce banc sait la
    rouvrir — le produit, non. La compter dans un classement revient à comparer
    ce qu'on saurait livrer avec ce qu'on ne saurait pas. Ce tableau-ci **ne
    garde que les planches découpables**, et les regroupe par la nature de la
    consigne. C'est là que l'écart se voit, et il ne se voyait nulle part
    ailleurs.
    """
    releve = json.loads((BANC / "mesures.json").read_text("utf-8"))
    groupes: dict[str, list[float]] = {}
    # **Combien de tirages ont utilisé cette consigne en tout**, et pas seulement
    # combien en sont sortis découpables : sans ce second nombre, une consigne
    # dont neuf planches sur dix sont perdues aurait l'air de gagner.
    tous: dict[str, int] = {}
    for nom, tirages in par_reglage.items():
        texte = (
            releve[nom]["reglage"]["texte"]
            if nom in releve
            # Le témoin n'a pas de fiche ici : c'est le prompt du produit, entier.
            else "Do NOT draw the cell outlines"
        )
        for x in tirages:
            tous[nature(texte)] = tous.get(nature(texte), 0) + 1
            if x.get("cases_recoupees", 0) == 0 and x.get("forme_pct") is not None:
                groupes.setdefault(nature(texte), []).append(x["forme_pct"])

    print()
    print("SEULEMENT les planches que le produit saurait ouvrir")
    e = (f"{'nature de la consigne':<52} {'decoup':>7} {'/ tires':>8} "
         f"{'mediane':>8} {'animees':>9} {'rendement':>10}")
    print(e)
    print("-" * len(e))
    sortie = []
    # **Classé au rendement, pas à la médiane.** La médiane ne parle que des
    # planches qui ont survécu ; le rendement parle de ce qu'on a payé.
    ordre = sorted(
        groupes.items(),
        key=lambda kv: -sum(1 for x in kv[1] if x >= SEUIL_FORME) / max(1, tous.get(kv[0], 1)),
    )
    for nom, valeurs in ordre:
        v = sorted(valeurs)
        s = {
            "consigne": nom,
            "tirages": len(v),
            "tirages_en_tout": tous.get(nom, len(v)),
            "mediane": round(float(np.median(v)), 1),
            "moyenne": round(float(np.mean(v)), 1),
            "animees": sum(1 for x in v if x >= SEUIL_FORME),
            # **Le rendement de bout en bout, et c'est lui qui décide.** Une
            # consigne qui anime bien mais dont les neuf dixièmes des planches
            # sont indécoupables coûte plus cher qu'une consigne médiocre dont
            # tout se garde. On divise donc par ce qu'on a payé, pas par ce qui
            # a survécu.
            "exploitables_sur_paye_pct": round(
                sum(1 for x in v if x >= SEUIL_FORME) / max(1, tous.get(nom, len(v))) * 100
            ),
            "formes": v,
        }
        sortie.append(s)
        print(f"{nom:<52} {s['tirages']:>7} {s['tirages_en_tout']:>8} "
              f"{s['mediane']:>8} {s['animees']:>4}/{s['tirages']:<4} "
              f"{s['exploitables_sur_paye_pct']:>8} %")
    # **Une nature de consigne peut n'avoir aucune planche découpable**, et son
    # absence du tableau serait alors la chose la plus intéressante à dire.
    toutes = set()
    for nom, tirages in par_reglage.items():
        texte = releve[nom]["reglage"]["texte"] if nom in releve else "Do NOT draw the cell outlines"
        if tirages:
            toutes.add(nature(texte))
    for manquante in sorted(toutes - set(groupes)):
        print(f"{manquante:<52} {0:>7} {tous.get(manquante, 0):>8}"
              f"  — aucune planche decoupable")
    (BANC / "decoupables.json").write_text(
        json.dumps(sortie, indent=1, ensure_ascii=False), "utf-8"
    )
    print()
    print("rendement = planches a la fois decoupables ET animees, sur tout ce qui a ete paye")
    print("            c'est le seul chiffre de bout en bout, et il ne pardonne pas les pertes")
    print("-> essais/resultats_recette/decoupables.json")


if __name__ == "__main__":
    main()
