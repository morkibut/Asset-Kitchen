# -*- coding: utf-8 -*-
"""Reclasser les deux bancs **sur le jugement de l'auteur**, pas sur ma mesure.

Les cent onze animations ont été regardées une par une et notées *mauvais*,
*moyen* ou *bon* (`essais/notes-auteur.json`). Ce module rejoue tous les
classements avec cette note à la place de la mesure automatique, et fait une
chose de plus, plus importante que le classement lui-même : **il confronte les
deux.**

**Pourquoi cette confrontation est le vrai résultat.** Toute la conduite de ces
bancs a reposé sur une mesure — la *forme*, l'écart du rapport hauteur/largeur
d'une case à l'autre. Si elle prédit mal ce qu'un œil appelle une bonne marche,
alors les classements publiés jusqu'ici ne valent rien, et il faut le dire avant
de reclasser quoi que ce soit. Ce module le mesure au lieu de l'espérer.

    .venv\\Scripts\\python.exe essais/verdict_auteur.py

Sortie : `essais/verdict.json`. Rien n'est régénéré, rien n'est repayé.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE.parent))

from banc_complet import SORTIE as TOUT  # noqa: E402

NOTES = RACINE / "notes-auteur.json"
SORTIE = RACINE / "verdict.json"

# Une note vaut un point de plus que la précédente. C'est grossier, et c'est
# voulu : la moyenne de ces trois valeurs se lit sans mode d'emploi — zéro veut
# dire *rien de bon*, deux veut dire *tout est bon*.
POINTS = {"mauvais": 0, "moyen": 1, "bon": 2}


def charger() -> list[dict]:
    """Les planches, chacune avec la note que l'auteur lui a donnée."""
    tout = json.loads(TOUT.read_text("utf-8"))
    notes = json.loads(NOTES.read_text("utf-8"))
    for p in tout["planches"]:
        tete = "m" if p["banc"] == "modeles" else "r"
        quoi = p["modele"] if p["banc"] == "modeles" else p["reglage"]
        p["note"] = notes.get(f"{tete}:{quoi}:{p['jet']}")
    return tout["planches"]


def _groupe(nom: str, siens: list[dict]) -> dict:
    """Ce qu'un groupe vaut aux yeux de l'auteur, et ce qu'il a coûté."""
    notees = [p for p in siens if p.get("note")]
    compte = {n: sum(1 for p in notees if p["note"] == n) for n in POINTS}
    bons = compte["bon"]
    tenables = compte["bon"] + compte["moyen"]
    total = sum(p.get("cout_usd") or 0.0 for p in siens)
    return {
        "nom": nom,
        "essais": len(siens),
        # **Revenues n'est pas essais** — un appel qui n'aboutit pas a coûté du
        # temps mais n'a rien rendu à juger. Et **découpable** reste un fait dur,
        # que le jugement de l'auteur ne remplace pas : il note ce qu'il voit,
        # or l'animation lui est montrée brute, sans le détourage qui achoppe.
        "revenues": sum(1 for p in siens if p.get("fichier")),
        "decoupables": sum(1 for p in siens if p.get("decoupable")),
        "notees": len(notees),
        **{f"n_{n}": compte[n] for n in POINTS},
        # **Deux taux, parce qu'ils ne répondent pas à la même question.** Le
        # premier dit *combien de planches je garderais telles quelles* ; le
        # second, *combien je pourrais rattraper*. Un produit bâti sur « on en
        # commande plusieurs et on garde la bonne » se pilote au premier.
        "taux_bon_pct": round(bons / len(siens) * 100) if siens else 0,
        "taux_tenable_pct": round(tenables / len(siens) * 100) if siens else 0,
        "score": round(
            float(np.mean([POINTS[p["note"]] for p in notees])), 2
        ) if notees else None,
        "cout_total": round(total, 4),
        "cout_par_bon": round(total / bons, 4) if bons else None,
        "cout_par_tenable": round(total / tenables, 4) if tenables else None,
        # Ce que ma mesure disait du même groupe — pour voir l'écart.
        "utilisables_mesure": sum(1 for p in siens if p.get("utilisable")),
        "forme_mediane": round(
            float(np.median([p["forme_pct"] for p in siens if p.get("forme_pct") is not None])), 1
        ) if any(p.get("forme_pct") is not None for p in siens) else None,
    }


def accord(planches: list[dict]) -> dict:
    """**Ma mesure prédit-elle ce que l'œil appelle une bonne marche ?**

    Deux façons de le dire, et il faut les deux :

    - le **tableau croisé** — parmi les planches que la mesure déclarait
      utilisables, combien l'auteur a-t-il trouvées bonnes ? Et parmi celles
      qu'elle rejetait, combien étaient bonnes quand même ?
    - la **forme médiane par note** — si la mesure valait quelque chose, elle
      monterait de *mauvais* à *bon*. Si elle est plate, elle ne mesure pas ce
      qu'on croyait.
    """
    notees = [p for p in planches if p.get("note")]
    croise = {
        ("utilisable" if p["utilisable"] else "rejetee"): None for p in notees
    }
    croise = {
        etat: {n: sum(1 for p in notees
                      if ("utilisable" if p["utilisable"] else "rejetee") == etat
                      and p["note"] == n)
               for n in POINTS}
        for etat in ("utilisable", "rejetee")
    }
    formes = {
        n: [p["forme_pct"] for p in notees
            if p["note"] == n and p.get("forme_pct") is not None]
        for n in POINTS
    }
    return {
        "croise": croise,
        "forme_mediane_par_note": {
            n: round(float(np.median(v)), 1) if v else None for n, v in formes.items()
        },
        "forme_moyenne_par_note": {
            n: round(float(np.mean(v)), 1) if v else None for n, v in formes.items()
        },
    }


def main() -> None:
    planches = charger()
    modeles = [_groupe(m, [p for p in planches if p["banc"] == "modeles" and p["modele"] == m])
               for m in sorted({p["modele"] for p in planches if p["banc"] == "modeles"})]
    reglages = [_groupe(r, [p for p in planches if p["banc"] == "recette" and p["reglage"] == r])
                for r in sorted({p["reglage"] for p in planches if p["banc"] == "recette"})]
    seuls = [p for p in planches if p["modele"] == "openai/gpt-image-2"]
    natures = [_groupe(n, [p for p in seuls if p["nature"] == n])
               for n in sorted({p["nature"] for p in seuls})]
    ecart = accord(planches)

    SORTIE.write_text(
        json.dumps(
            {"modeles": modeles, "reglages": reglages, "natures": natures, "accord": ecart},
            indent=1, ensure_ascii=False,
        ),
        "utf-8",
    )

    def tableau(titre: str, lignes: list[dict], large: int = 34) -> None:
        print()
        print(titre)
        e = (f"{'':<{large}} {'essais':>7} {'bon':>4} {'moyen':>6} {'mauv':>5} "
             f"{'% bon':>6} {'% tenable':>10} {'score':>6} {'$/bon':>8} "
             f"{'$/tenable':>10} {'mesure':>7}")
        print(e)
        print("-" * len(e))
        for g in sorted(lignes, key=lambda g: (-g["taux_bon_pct"], -g["taux_tenable_pct"])):
            cb = f"{g['cout_par_bon']:.3f}" if g["cout_par_bon"] else "—"
            ct = f"{g['cout_par_tenable']:.3f}" if g["cout_par_tenable"] else "—"
            sc = f"{g['score']:.2f}" if g["score"] is not None else "—"
            print(f"{g['nom'][:large]:<{large}} {g['essais']:>7} {g['n_bon']:>4} "
                  f"{g['n_moyen']:>6} {g['n_mauvais']:>5} {g['taux_bon_pct']:>5} % "
                  f"{g['taux_tenable_pct']:>8} % {sc:>6} {cb:>8} {ct:>10} "
                  f"{g['utilisables_mesure']:>7}")

    tableau("PAR MODELE — banc 1, meme demande pour tous", modeles)
    tableau("PAR NATURE DE CONSIGNE — gpt-image-2 seul", natures, large=52)
    tableau("PAR REGLAGE — banc 2, meme modele pour tous", reglages, large=22)

    print()
    print("MA MESURE PREDIT-ELLE LE JUGEMENT DE L'AUTEUR ?")
    c = ecart["croise"]
    e = f"{'':<24} {'bon':>5} {'moyen':>7} {'mauvais':>9}"
    print(e)
    print("-" * len(e))
    for etat, ligne in c.items():
        print(f"{('mesure : ' + etat):<24} {ligne['bon']:>5} {ligne['moyen']:>7} "
              f"{ligne['mauvais']:>9}")
    print()
    print(f"{'forme mediane':<24} " + " ".join(
        f"{ecart['forme_mediane_par_note'][n] or 0:>7}" for n in ("bon", "moyen", "mauvais")))
    print(f"{'forme moyenne':<24} " + " ".join(
        f"{ecart['forme_moyenne_par_note'][n] or 0:>7}" for n in ("bon", "moyen", "mauvais")))
    print()
    print("score  = moyenne des notes, mauvais=0 moyen=1 bon=2")
    print("tenable= bon ou moyen — ce qu'on garderait, quitte a le retoucher")
    print("mesure = ce que mon juge automatique comptait comme utilisable")
    print(f"-> {SORTIE}")


if __name__ == "__main__":
    main()
