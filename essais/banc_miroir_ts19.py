# -*- coding: utf-8 -*-
"""Banc payé de TS19 : la planche des directions sort-elle encore en miroir ?

**Ce qu'il compare.** La première planche d'un sujet (TS3), tirée huit fois avec
l'ancienne phrase — rien sur l'autre côté — et huit fois avec la nouvelle —
« Cells 1 and 2 show the same subject from opposite sides, not a mirrored
copy… ». Seize appels, un par planche. Pour chaque planche, il relève ce que
l'atelier a signalé à l'arrivée (« ces deux vues sont un miroir ») et l'écart
mesuré de chaque paire de vues opposées ; le verdict final se fait **à l'œil**,
sur les planches enregistrées.

**L'atelier de l'auteur (port 8420) n'est pas touché.** Le banc monte un
atelier à part, dans un dossier temporaire, avec une copie du jeu du sujet
(son univers, ses sujets, sa toile — le concept art d'Elias est une carte).

    py essais/banc_miroir_ts19.py preparer --sujet elias
        rien n'est payé : les deux textes, et le prix annoncé
    py essais/banc_miroir_ts19.py payer --sujet elias
        annonce le prix, attend « oui », puis seize appels

Options : `--jeu` (par défaut, celui qui contient le sujet), `--modele` (par
défaut `OpenRouter:openai/gpt-image-2.5-sunburst`, celui des deux planches
d'Elias du 24 septembre 2026), `--tirages` (8 par phrase), `--plafond` (en
dollars, 1,50 par défaut : le banc s'arrête avant l'appel qui le dépasserait).

Les planches et le relevé partent dans `essais/resultats/miroir-ts19/`.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient  # noqa: E402

import atelier.services.pliage as pliage_du_service  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.direction import paires_opposees  # noqa: E402
from atelier.domaine.recette import BORD, Passe, Recette  # noqa: E402
from atelier.image import detourer  # noqa: E402
from atelier.image.pliage import SEUIL_MIROIR, ecart_au_miroir  # noqa: E402
from atelier.services import Atelier  # noqa: E402

DONNEES = RACINE / "donnees"
DOSSIER = Path(os.environ.get("TEMP", "/tmp")) / "atelier-miroir-ts19"
SORTIE = RACINE / "essais" / "resultats" / "miroir-ts19"
MODELE = "OpenRouter:openai/gpt-image-2.5-sunburst"

# La phrase de TS19, telle qu'elle est — et l'ancienne, qui n'en disait rien.
NOUVELLE = pliage_du_service.phrase_des_cotes
ANCIENNE = lambda cases: ""  # noqa: E731


def _phrase(ancienne: bool) -> None:
    """Remplace la phrase dans le service, **dans ce processus seulement**."""
    pliage_du_service.phrase_des_cotes = ANCIENNE if ancienne else NOUVELLE


def _jeu_du_sujet(sujet: str) -> str:
    for dossier in sorted((DONNEES / "projets").iterdir()):
        if (dossier / "personnages" / f"{sujet}.json").exists():
            return dossier.name
    sys.exit(f"aucun jeu de `donnees/projets` ne contient le sujet « {sujet} »")


def monter(jeu: str) -> None:
    """Un dossier neuf, avec une copie du jeu et rien d'autre."""
    if DOSSIER.exists():
        shutil.rmtree(DOSSIER)
    (DOSSIER / "projets").mkdir(parents=True)
    shutil.copytree(DONNEES / "projets" / jeu, DOSSIER / "projets" / jeu)
    shutil.copy2(DONNEES / "catalogue.json", DOSSIER)
    (DOSSIER / "atelier.json").write_text(json.dumps({"courant": jeu}), encoding="utf-8")


def _envoi(client: TestClient, atelier: Atelier, jeu: str, sujet: str, modele: str) -> dict:
    signalement = atelier.production.sujet(jeu, sujet)
    envoi = client.post(
        "/api/outgoing",
        json={
            "prompt": signalement,
            "modele": modele,
            "projet": jeu,
            "personnage": sujet,
            "premiere_planche": True,
        },
    )
    if envoi.status_code != 200:
        sys.exit(f"l'atelier refuse la planche : {envoi.text}")
    return {"signalement": signalement, **envoi.json()}


def _annoncer(lu_ancienne: dict, lu_nouvelle: dict, tirages: int, plafond: float) -> float | None:
    print("── Ce qui part avec l'ANCIENNE phrase ──")
    print(lu_ancienne["texte"])
    print()
    print("── Ce qui part avec la NOUVELLE phrase ──")
    print(lu_nouvelle["texte"])
    print()
    par_appel = lu_nouvelle.get("prix", {}).get("total")
    images = [l.get("provenance") for l in lu_nouvelle.get("images", {}).get("lignes", [])]
    print("── Les images jointes ──", images)
    print("── Le prix ──")
    if par_appel is None:
        print("  le prix d'un appel n'est pas connu pour ce modèle — le banc ne partira pas")
        return None
    total = par_appel * 2 * tirages
    print(f"  un appel ≈ ${par_appel:.4f} · {2 * tirages} appels ({tirages} par phrase)")
    print(f"  total annoncé ≈ ${total:.2f} · plafond ${plafond:.2f}")
    print("  (la variance d'un appel à l'autre dépasse souvent l'écart annoncé : AGENTS.md, point 8)")
    return total


def preparer(sujet: str, jeu: str, modele: str, tirages: int, plafond: float) -> None:
    monter(jeu)
    atelier = Atelier(racine=DOSSIER)
    with TestClient(creer_application(atelier)) as client:
        _phrase(ancienne=True)
        ancienne = _envoi(client, atelier, jeu, sujet, modele)
        _phrase(ancienne=False)
        nouvelle = _envoi(client, atelier, jeu, sujet, modele)
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / "envoi.json").write_text(
        json.dumps({"ancienne": ancienne, "nouvelle": nouvelle}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _annoncer(ancienne, nouvelle, tirages, plafond)


def _attendre(client: TestClient, identifiant: str) -> dict:
    for _ in range(1800):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.5)
    raise RuntimeError(f"le tirage {identifiant} n'est jamais revenu")


def _ecarts(octets: bytes, vue: dict) -> list[dict]:
    """L'écart de chaque paire de vues opposées, relu sur la planche — pour le
    relevé : le signal de l'atelier ne dit que « sous le seuil ou pas »."""
    pliage = vue.get("pliage") or {}
    mesures = pliage.get("mesures") or []
    directions = [c.get("direction") for c in pliage.get("cases") or []]
    if len(mesures) < len(directions):
        return []
    rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
    rendus = []
    for i, j in paires_opposees(directions):
        (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = mesures[i]["boite"], mesures[j]["boite"]
        ecart = ecart_au_miroir(
            rgba[ay0 : ay1 + 1, ax0 : ax1 + 1], rgba[by0 : by1 + 1, bx0 : bx1 + 1]
        )
        rendus.append({"paire": [directions[i], directions[j]], "ecart": ecart})
    return rendus


def payer(sujet: str, jeu: str, modele: str, tirages: int, plafond: float) -> None:
    monter(jeu)
    atelier = Atelier(racine=DOSSIER)
    SORTIE.mkdir(parents=True, exist_ok=True)
    releve: list[dict] = []
    with TestClient(creer_application(atelier)) as client:
        _phrase(ancienne=True)
        ancienne = _envoi(client, atelier, jeu, sujet, modele)
        _phrase(ancienne=False)
        nouvelle = _envoi(client, atelier, jeu, sujet, modele)
        total = _annoncer(ancienne, nouvelle, tirages, plafond)
        if total is None:
            return
        if total > plafond:
            sys.exit(f"le total annoncé (${total:.2f}) dépasse le plafond (${plafond:.2f}) — rien n'est parti")
        reponse = input(f"\nPayer {2 * tirages} appels, environ ${total:.2f} ? Tape « oui » pour partir : ")
        if reponse.strip().lower() != "oui":
            print("Rien n'est parti.")
            return

        depense = 0.0
        # Alternées, pas huit puis huit : une dérive du fournisseur dans l'heure
        # tomberait sinon toute sur une seule des deux phrases.
        for n in range(1, tirages + 1):
            for nom, est_ancienne, signalement in (
                ("ancienne", True, ancienne["signalement"]),
                ("nouvelle", False, nouvelle["signalement"]),
            ):
                par_appel = (nouvelle.get("prix") or {}).get("total") or 0.0
                if depense + par_appel > plafond:
                    print(f"plafond atteint (${depense:.2f} dépensés) — arrêt avant le tirage {n} ({nom})")
                    return
                _phrase(ancienne=est_ancienne)
                appel = client.post(
                    "/api/generations",
                    json={
                        "modele": modele,
                        "prompt": signalement,
                        "projet": jeu,
                        "personnage": sujet,
                        "premiere_planche": True,
                        "variations": 1,
                        "identifiant": str(uuid.uuid4()),
                    },
                )
                if appel.status_code != 202:
                    print(f"tirage {n} ({nom}) refusé : {appel.text}")
                    continue
                vue = _attendre(client, appel.json()["identifiant"])
                gen = vue["identifiant"]
                depense += float(vue.get("cout_usd") or 0.0)
                ligne = {
                    "phrase": nom,
                    "tirage": n,
                    "generation": gen,
                    "statut": vue["statut"],
                    "cout_usd": vue.get("cout_usd"),
                    "signal_miroir": (vue.get("pliage") or {}).get("miroirs", []),
                }
                if vue["statut"] == "reussie":
                    image = client.get(f"/api/assets/{gen}-0/image")
                    (SORTIE / f"{nom}-t{n}.png").write_bytes(image.content)
                    ligne["ecarts"] = _ecarts(image.content, vue)
                print(
                    f"{nom} · tirage {n} : {vue['statut']} · ${vue.get('cout_usd')} · "
                    f"miroir signalé : {bool(ligne['signal_miroir'])} · {ligne.get('ecarts')}",
                    flush=True,
                )
                releve.append(ligne)
                (SORTIE / "releve.json").write_text(
                    json.dumps(
                        {
                            "sujet": sujet,
                            "jeu": jeu,
                            "modele": modele,
                            "seuil_miroir": SEUIL_MIROIR,
                            "depense_usd": round(depense, 4),
                            "tirages": releve,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
    signales = {
        nom: sum(1 for l in releve if l["phrase"] == nom and l["signal_miroir"])
        for nom in ("ancienne", "nouvelle")
    }
    print(f"\nMiroirs signalés — ancienne : {signales['ancienne']}/{tirages} · "
          f"nouvelle : {signales['nouvelle']}/{tirages} · dépensé ${depense:.2f}")
    print(f"Planches dans {SORTIE} — le verdict se fait à l'œil.")


if __name__ == "__main__":
    lecteur = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    lecteur.add_argument("mode", choices=("preparer", "payer"))
    lecteur.add_argument("--sujet", required=True, help="l'identifiant du sujet, par ex. elias")
    lecteur.add_argument("--jeu", default=None)
    lecteur.add_argument("--modele", default=MODELE)
    lecteur.add_argument("--tirages", type=int, default=8)
    lecteur.add_argument("--plafond", type=float, default=1.50)
    args = lecteur.parse_args()
    jeu = args.jeu or _jeu_du_sujet(args.sujet)
    geste = preparer if args.mode == "preparer" else payer
    geste(args.sujet, jeu, args.modele, args.tirages, args.plafond)
