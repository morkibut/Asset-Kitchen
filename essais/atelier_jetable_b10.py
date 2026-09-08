# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B10 — la page d'un sujet**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8476 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b10.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

Un jeu, **« Le marais »**, quatre directions déclarées, et **un sujet vedette
dont les rangées couvrent chacun des cinq états qu'une rangée peut avoir** —
c'est tout l'objet du montage. Un jeu de 260 sujets n'apprendrait rien de plus
ici : ce qui se regarde est la rangée, pas la grille.

| La pose | Ce qu'elle montre |
|---|---|
| **repos** | les quatre rangées à la fois — `sud` pleine avec sa retenue et cinq images (elle **déborde**, c'est là qu'on vérifie que « + générer » ne défile pas), `nord` courte et retenue, `est` **sans aucune retenue** (le seul rouge de l'écran), `ouest` vide |
| **marche** | **toutes ses images sont sans direction** : la rangée se lit « à confirmer » et jamais « sud », et le volet propose les quatre angles |
| **course** | deux images, aucune retenue — la pose repliée porte la puce « 1 sans retenue » |
| **dégâts** | aucune image du tout — la puce dit « rien » |

Le sujet est rangé dans **deux collections**, pour que la fiche montre deux
chips et que « + ranger » ne propose que la troisième.

**Les images se posent par import, jamais par génération** — le geste de
`tests/test_b9.py::_poser`, avec `forcer=True` parce qu'un même gabarit sert
plusieurs fois et que son empreinte serait sinon déjà connue.

**Rien n'a été payé** : le fournisseur est le double des essais, il ne touche
pas au réseau, et aucune route de génération n'est appelée.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin** ouvre *sa page*, sur *Sa fiche* — et
   non plus sur la matrice. C'est le livrable de la tranche.
2. La fiche : son image de référence, son nom, sa description, ses deux
   collections, ce qui existe de lui, ce qui lui manque, ce que ses images ont
   coûté.
3. **Ses images** : les rangées. Rétrécir la fenêtre jusqu'à faire défiler la
   rangée `sud` — **la case « + générer » ne doit pas bouger**.
4. Cliquer le rond vert d'une gardée de `sud` : la retenue change, **et
   l'ancienne redevient gardée** sans se déplacer dans la file.
5. `marche` : la rangée dit « à confirmer ». Cliquer une de ses vignettes, puis
   un angle dans le volet — la rangée se renomme.
6. **Ses cases, une par une ›**, en bas de la fiche : la matrice d'avant, avec
   son vestiaire, ses planches, son calibrage et ses animations. Et « ‹ Sa
   page » revient.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée un jeu, des sujets et des images. Le dossier
temporaire est imprimé à chaque lancement ; c'est lui qu'on efface après.
"""

from __future__ import annotations

import itertools
import sys
import tempfile
import time
from pathlib import Path

import uvicorn

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** — même raison qu'en B9 :
# deux doubles qui divergeraient finiraient par ne plus décrire le produit.
from conftest import FournisseurDouble, image_sujet  # noqa: E402

PORT = 8476

DIRECTIONS = (
    ("sud", "seen from the front"),
    ("nord", "seen from behind"),
    ("est", "seen from the right"),
    ("ouest", "seen from the left"),
)

# ── Ce que la vedette porte, rangée par rangée ──────────────────────────────
#
# `(pose, direction, combien, laquelle est retenue)` — `direction=None` veut
# dire « posée sans direction », c'est-à-dire *à confirmer*, et `retenue=None`
# veut dire qu'aucune ne sort dans le jeu.
RANGEES = (
    ("repos", "sud", 5, 2),
    ("repos", "nord", 2, 0),
    ("repos", "est", 4, None),
    ("marche", None, 3, None),
    ("course", "sud", 2, None),
)


def _gabarits(dossier: Path) -> list[Path]:
    """Huit PNG distincts, écrits une seule fois et réemployés."""
    sous = dossier / "gabarits"
    sous.mkdir(parents=True, exist_ok=True)
    chemins = []
    for rang in range(1, 9):
        chemin = sous / f"gabarit-{rang}.png"
        chemin.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
        chemins.append(chemin)
    return chemins


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _poser(
    client, gabarit: Path, personnage: str, pose: str, direction: str | None
) -> str:
    """Une image importée puis rangée dans sa case — et son identifiant."""
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} / {pose} »",
    )
    identifiant = importe["asset"]["identifiant"]
    corps: dict = {"personnage": personnage, "pose": pose}
    # ⚠️ `direction` absente du corps ne touche pas au champ ; l'envoyer vide
    # l'effacerait. C'est ce qui distingue « à confirmer » de « au sud ».
    if direction is not None:
        corps["direction"] = direction
    _exiger(
        client.put(f"/api/assets/{identifiant}/character", json=corps),
        f"la case « {pose} / {direction or 'sans direction'} »",
    )
    return identifiant


def peupler(atelier: Atelier, dossier: Path) -> dict:
    gabarits = _gabarits(dossier)
    compteur = itertools.count()

    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le marais"}),
            "le projet « Le marais »",
        )["projet"]["identifiant"]

        for nom, consigne in DIRECTIONS:
            _exiger(
                client.post(
                    "/api/characters/directions", json={"nom": nom, "consigne": consigne}
                ),
                f"la direction « {nom} »",
            )

        vedette = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": (
                        "A weathered pilgrim in a hooded brown robe, leather straps, "
                        "a walking staff, worn boots."
                    ),
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]

        # Deux voisins, pour que le carnet ait de quoi montrer et qu'on puisse
        # changer de sujet — l'onglet doit revenir sur la fiche.
        for nom in ("La sorcière des roseaux", "Le passeur du gué"):
            autre = _exiger(
                client.post("/api/characters", json={"nom": nom, "description": ""}),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            _poser(client, gabarits[0], autre, "repos", "sud")

        poses_du_plan = [
            p["identifiant"] for p in client.get("/api/characters").json()["plan"]
        ]

        pose_par_rangee: dict[tuple[str, str | None], list[str]] = {}
        for pose, direction, combien, retenue in RANGEES:
            assert pose in poses_du_plan, f"« {pose} » n'est pas dans le plan du jeu"
            identifiants = [
                _poser(
                    client,
                    gabarits[next(compteur) % len(gabarits)],
                    vedette,
                    pose,
                    direction,
                )
                for _ in range(combien)
            ]
            pose_par_rangee[(pose, direction)] = identifiants
            if retenue is not None:
                _exiger(
                    client.put(
                        "/api/assets/favorite",
                        json={"identifiants": [identifiants[retenue]], "favori": True},
                    ),
                    f"la retenue de « {pose} / {direction} »",
                )

        collections = {}
        for nom in ("Les héros", "Les PNJ", "Les figurants"):
            collections[nom] = _exiger(
                client.post("/api/collections", json={"nom": nom}),
                f"la collection « {nom} »",
            )["collection"]["identifiant"]
        for nom in ("Les héros", "Les PNJ"):
            _exiger(
                client.put(
                    f"/api/collections/{collections[nom]}/members",
                    json={"jeu": projet, "sujet": vedette},
                ),
                f"ranger le pèlerin dans « {nom} »",
            )

        # Ce que l'écran recevra, relu ici depuis le serveur : si les deux ne
        # disaient pas la même chose, l'un des deux mentirait.
        #
        # ⚠️ **Il n'existe aucun `GET /characters/{id}`** — la charge d'un sujet
        # arrive avec la liste, et c'est elle que l'écran lit aussi.
        charge = _exiger(client.get("/api/characters"), "la liste des sujets")
        sien = next(
            (p for p in charge["personnages"] if p["identifiant"] == vedette), None
        )
        if sien is None:
            raise SystemExit("le pèlerin n'est pas dans la liste que le serveur rend")
        return {
            "projet": projet,
            "vedette": vedette,
            "cases": sien.get("cases", []),
            "rangees": pose_par_rangee,
        }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et
    # des flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b10-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage      : {duree:.1f} s")
    print(f"  Appels payés : {double.appels}  (double : facture zéro)")
    print()
    print("  Ce que le serveur rend vraiment, case par case :")
    for sienne in monte["cases"]:
        directions = sienne.get("directions") or []
        if not directions:
            print(f"    · {sienne['pose']:8s} — {len(sienne['images'])} images, sans direction")
            continue
        for d in directions:
            retenues = sum(1 for i in d["images"] if i["favori"])
            marque = ""
            if d["a_confirmer"] and d["a_confirmer"] >= len(d["images"]) and d["images"]:
                marque = "  ← à confirmer (et la rangée ne doit PAS dire « sud »)"
            elif len(d["images"]) > 1 and retenues == 0:
                marque = "  ← aucune retenue (le seul rouge de l'écran)"
            print(
                f"    · {sienne['pose']:8s} {d['identifiant']:6s} "
                f"{len(d['images'])} images, {retenues} retenue(s),"
                f" {d['a_confirmer']} à confirmer{marque}"
            )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin : sa page s'ouvre sur SA FICHE")
    print("  → onglet « Ses images » : les rangées de repos, marche, course, dégâts")
    print("  → rétrécir la fenêtre : la rangée « sud » défile, « + générer » ne bouge pas")
    print("  → « Ses cases, une par une › » en bas de la fiche : la matrice d'avant")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
