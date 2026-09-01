# -*- coding: utf-8 -*-
"""Les deux bancs d'animation réunis, et mesurés une seule fois de la même façon.

**Pourquoi ce fichier existe.** Les deux bancs ont été jugés à des moments
différents, avec des juges différents, et leurs chiffres ne se comparaient donc
pas. Pire : le second juge a trouvé **deux biais de mesure** que le premier
ignorait, et l'un des deux a fait noter zéro à `seedream-4.5` sur une planche qui
est, à l'œil, le meilleur cycle de marche de tout le banc.

Ce module rassemble **les cent dix-sept planches**, garde pour chacune **ce qui
l'a produite** — le modèle, ce qui était testé, la consigne envoyée, les images
jointes, le prix — et les repasse toutes par `juger_recette.mesurer`. Un seul
juge, un seul tableau, aucune planche qui échappe au comptage.

    .venv\\Scripts\\python.exe essais/banc_complet.py

Sortie : `essais/tout.json`. Rien n'est régénéré, rien n'est repayé : tout est
déjà sur le disque.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(DEPOT))

from atelier.domaine.pliage import geometrie  # noqa: E402
from atelier.image.pliage import gabarit  # noqa: E402

from juger_recette import SEUIL_FORME, mesurer  # noqa: E402

MODELES = RACINE / "resultats_animation"
RECETTE = RACINE / "resultats_recette"
SORTIE = RACINE / "tout.json"
REFERENCE = DEPOT / "donnees" / "generations" / "cb3ebb37f3cd4e21987964cd1af87770"
PROJET = "essai-animation"


# ─────────────────────────────────────────────────────────────────────────────
# Ce qui a été envoyé
# ─────────────────────────────────────────────────────────────────────────────


def _fiche() -> dict:
    return json.loads((REFERENCE / "generation.json").read_text("utf-8"))


def references_du_produit() -> list[bytes]:
    """Les trois images du banc des modèles : les deux du produit, plus le gabarit.

    Relues à la source dans une vraie génération, jamais recomposées — c'est ce
    qui permet de dire que le banc rejouait bien ce que le produit envoie.
    """
    octets: list[bytes] = []
    for r in _fiche()["references"]:
        if r["origine"] == "carte":
            octets.append(
                (DEPOT / "donnees" / "projets" / PROJET / "tableau" / f"{r['asset']}.png").read_bytes()
            )
        else:
            gen, rang = r["asset"].rsplit("-", 1)
            octets.append((DEPOT / "donnees" / "generations" / gen / f"{rang}-rendu.png").read_bytes())
    octets.append(gabarit(geometrie(8)))
    return octets


def texte_du_produit() -> str:
    """La consigne de planche du produit — le troisième bloc du prompt."""
    return _fiche()["demande"]["prompt"].split("\n\n")[2]


def images_de(planche: dict) -> list[bytes]:
    """Les images jointes à cette planche-là, refabriquées à l'identique.

    **Jamais devinées.** Pour le banc des modèles elles se relisent dans la
    génération d'origine ; pour le banc de recette, dans le programme qui les a
    composées. Un rapport qui montrerait autre chose que ce qui est parti serait
    pire qu'un rapport sans images.
    """
    if planche["banc"] == "modeles":
        return references_du_produit()
    from essai_recette import reglages

    for r in reglages():
        if r["nom"] == planche["reglage"]:
            return list(r["images"])
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Le recensement
# ─────────────────────────────────────────────────────────────────────────────


def planches() -> list[dict]:
    """Toutes les planches des deux bancs, avec ce qui les a produites.

    Les **appels ratés** entrent aussi : ils ont pris du temps, ils font partie
    du prix réel, et une ligne manquante dans un rapport se lit comme un essai
    qu'on n'a pas fait.
    """
    liste: list[dict] = []

    releve = json.loads((MODELES / "mesures.json").read_text("utf-8"))
    texte, jointes = texte_du_produit(), len(references_du_produit())
    for dossier in sorted(MODELES.iterdir()):
        if not dossier.is_dir():
            continue
        modele = dossier.name.replace("_", "/", 1)
        siens = releve.get(modele, {})
        commun = {
            "banc": "modeles",
            "modele": modele,
            "reglage": "@produit",
            "quoi": "le prompt du produit et ses trois images, rejoués à l'identique",
            "cases": 8,
            "proportions": "1:1",
            "images": jointes,
            "texte": texte,
        }
        for jet, ligne in sorted(siens.items()):
            if "echec" in ligne:
                liste.append(
                    {**commun, "jet": jet, "fichier": None, "echec": ligne["echec"],
                     "cout_usd": 0.0, "secondes": ligne.get("secondes")}
                )
        for planche in sorted(dossier.glob("jet*.png")):
            ligne = siens.get(planche.stem, {})
            liste.append(
                {**commun, "jet": planche.stem, "fichier": str(planche), "echec": None,
                 "cout_usd": ligne.get("cout_usd"), "secondes": ligne.get("secondes")}
            )

    releve = json.loads((RECETTE / "mesures.json").read_text("utf-8"))
    for nom in sorted(releve):
        r = releve[nom].get("reglage", {})
        commun = {
            "banc": "recette",
            "modele": "openai/gpt-image-2",
            "reglage": nom,
            "quoi": r.get("quoi", ""),
            "cases": r.get("cases", 8),
            "proportions": r.get("proportions", "1:1"),
            "images": r.get("images", 0),
            "texte": r.get("texte", ""),
        }
        for planche in sorted((RECETTE / nom).glob("jet*.png")):
            ligne = releve[nom].get(planche.stem, {})
            liste.append(
                {**commun, "jet": planche.stem, "fichier": str(planche), "echec": None,
                 "cout_usd": ligne.get("cout_usd"), "secondes": ligne.get("secondes")}
            )
    return liste


def nature(texte: str) -> str:
    """De quelle sorte est la consigne — trois sortes, et pas une de plus.

    Ce qui les distingue n'est pas le nombre de mots mais **ce qu'elles disent de
    chaque case** : le prompt du produit et la consigne d'essai énumèrent les
    poses une par une ; les réécritures décrivent le mouvement en général. Et le
    prompt du produit **seul** porte le paragraphe qui interdit de redessiner le
    quadrillage.
    """
    if "Do NOT draw the cell outlines" in texte:
        return "prompt du produit, avec son paragraphe protecteur"
    if "walk cycle, frame 1 of" in texte:
        return "consigne d'essai, poses détaillées case par case"
    return "consigne réécrite de fond, mouvement décrit en général"


def juger(liste: list[dict]) -> list[dict]:
    """Chaque planche passée au même juge, quel que soit le banc dont elle vient."""
    for p in liste:
        p["nature"] = nature(p["texte"])
        if p["fichier"] is None:
            p.update(sujets=0, decoupable=False, compte_ok=False, anime=False, utilisable=False)
            continue
        p.update(mesurer(Path(p["fichier"]).read_bytes(), p["cases"]))
        p["decoupable"] = p.get("cases_recoupees", 0) == 0
        p["compte_ok"] = p["sujets"] >= p["cases"]
        p["anime"] = (p.get("forme_pct") or 0) >= SEUIL_FORME
        # **Utilisable veut dire : le produit saurait s'en servir.** Il faut donc
        # les trois — assez de sujets, une planche qu'on sait ouvrir, et un corps
        # qui se déforme. Deux sur trois ne fait pas une animation livrée.
        p["utilisable"] = bool(p["compte_ok"] and p["decoupable"] and p["anime"])
    return liste


# ─────────────────────────────────────────────────────────────────────────────


def _groupe(nom: str, siens: list[dict]) -> dict:
    formes = [p["forme_pct"] for p in siens if p.get("forme_pct") is not None]
    utiles = sum(1 for p in siens if p["utilisable"])
    total = sum(p.get("cout_usd") or 0.0 for p in siens)
    secondes = sum(p.get("secondes") or 0.0 for p in siens)
    return {
        "nom": nom,
        "essais": len(siens),
        # **Revenues n'est pas essais.** Un appel qui n'aboutit pas compte comme
        # un essai — il a coûté du temps — mais il ne peut pas être découpable,
        # et le compter comme un échec de découpe accuserait le modèle de ce que
        # le réseau a fait.
        "revenues": sum(1 for p in siens if p.get("fichier")),
        "utilisables": utiles,
        "decoupables": sum(1 for p in siens if p["decoupable"]),
        "animees": sum(1 for p in siens if p["anime"]),
        "rendement_pct": round(utiles / len(siens) * 100) if siens else 0,
        "cout_total": round(total, 4),
        "cout_par_utile": round(total / utiles, 4) if utiles else None,
        "secondes_par_utile": round(secondes / utiles) if utiles else None,
        "forme_mediane": round(float(np.median(formes)), 1) if formes else None,
        "forme_max": max(formes) if formes else None,
    }


def main() -> None:
    liste = juger(planches())
    modeles = [_groupe(m, [p for p in liste if p["banc"] == "modeles" and p["modele"] == m])
               for m in sorted({p["modele"] for p in liste if p["banc"] == "modeles"})]
    reglages_ = [_groupe(r, [p for p in liste if p["banc"] == "recette" and p["reglage"] == r])
                 for r in sorted({p["reglage"] for p in liste if p["banc"] == "recette"})]
    # **La comparaison des consignes ne vaut qu'à modèle constant.** Le banc 1 a
    # envoyé le prompt du produit à huit modèles différents ; le banc 2 a envoyé
    # vingt-neuf consignes à un seul. Les mélanger ferait comparer une consigne
    # avec un panachage de modèles, et l'écart mesuré serait celui des modèles.
    # On ne garde donc que `gpt-image-2`, présent des deux côtés.
    seuls = [p for p in liste if p["modele"] == "openai/gpt-image-2"]
    natures = [_groupe(n, [p for p in seuls if p["nature"] == n])
               for n in sorted({p["nature"] for p in seuls})]

    SORTIE.write_text(
        json.dumps(
            {"planches": liste, "modeles": modeles, "reglages": reglages_, "natures": natures},
            indent=1, ensure_ascii=False,
        ),
        "utf-8",
    )

    def tableau(titre: str, lignes: list[dict], large: int = 46) -> None:
        print()
        print(titre)
        e = (f"{'':<{large}} {'essais':>7} {'decoup':>7} {'animees':>8} {'utiles':>7} "
             f"{'rendement':>10} {'$ total':>8} {'$/utile':>8} {'forme med':>10}")
        print(e)
        print("-" * len(e))
        for g in sorted(lignes, key=lambda g: -g["rendement_pct"]):
            cpu = f"{g['cout_par_utile']:.3f}" if g["cout_par_utile"] else "—"
            fm = g["forme_mediane"] if g["forme_mediane"] is not None else "—"
            print(f"{g['nom'][:large]:<{large}} {g['essais']:>7} {g['decoupables']:>7} "
                  f"{g['animees']:>8} {g['utilisables']:>7} {g['rendement_pct']:>8} % "
                  f"{g['cout_total']:>8.3f} {cpu:>8} {fm:>10}")

    paye = sum(p.get("cout_usd") or 0.0 for p in liste)
    print(f"{len(liste)} planches, ${paye:.4f} — un seul juge pour les deux bancs")
    tableau("PAR MODELE — banc 1, meme demande pour tous", modeles)
    tableau("PAR NATURE DE CONSIGNE — gpt-image-2 seul, les deux bancs", natures, large=52)
    tableau("PAR REGLAGE — banc 2, meme modele pour tous", reglages_, large=22)
    print()
    print(f"anime     = la forme varie d'au moins {SEUIL_FORME} % — le corps se deforme vraiment")
    print("decoup    = le modele n'a pas redessine le quadrillage ; le produit sait l'ouvrir")
    print("utile     = les trois a la fois : assez de sujets, decoupable, et anime")
    print("rendement = planches utiles sur tout ce qui a ete paye")
    print(f"-> {SORTIE}")


if __name__ == "__main__":
    main()
