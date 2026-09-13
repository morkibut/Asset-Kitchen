# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder **l'import d'une référence** au navigateur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8503 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce qu'on vient corriger, en clair

Un sujet qu'on vient de créer n'a pas d'image : sa vignette dit « Référence à
créer ». On la clique, on arrive dans *Images fixes*, et chaque rangée vide
n'offrait **qu'un seul geste** — la case « + générer », qui coûte. Celui qui
avait déjà le dessin sur son disque n'avait pas de chemin : il devait payer une
fabrication pour une image qu'il tenait dans la main.

Trois portes ont été ouvertes, et aucune ne dépense :

1. une case **« ↥ importer »** à côté de chaque « + générer », dans *Images
   fixes* — elle vise la même case, même pose, même angle ;
2. une quatrième porte dans **« Fabriquer… »**, *Une image que tu as déjà* ;
3. dans le dialogue d'import, un bouton **« Reprendre une image de la
   bibliothèque »** — pour une image que l'atelier tient déjà et qu'on veut
   simplement ranger dans une case. Elle n'est pas recopiée ; elle est désignée.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_reference_importee.py

## Ce qu'il monte

Un projet, quatre directions, et **deux sujets** :

- **La rôdeuse des tourbières** — créée à l'instant, aucune image. C'est elle
  qu'on vient regarder ;
- **Le pèlerin** — trois images rangées dans ses cases, pour que la
  bibliothèque du jeu ait de quoi montrer quand on ouvre « Reprendre une image
  de la bibliothèque ».

Rien n'a été payé : le fournisseur est un double.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › La rôdeuse des tourbières.** Sa vignette dit
   « Référence à créer ». Clique-la : on tombe sur *Images fixes*.
2. **Déplie « repos ».** Chaque rangée porte maintenant **deux** cases à droite,
   « ↥ importer » et « + générer ». Clique « ↥ importer » sur *nord*.
3. Le dialogue s'ouvre **déjà pointé sur repos · Nord** — c'est là le point :
   on ne rechoisit pas à la main la case qu'on venait de désigner du doigt.
4. **« Reprendre une image de la bibliothèque »** : les images du pèlerin
   paraissent. Choisis-en une. La ligne dit « Image de la bibliothèque, rangée
   ici. » Referme : la rangée *nord* de la rôdeuse la porte, et sa vignette de
   fiche n'est plus vide.
5. **Repose la question à l'envers** : rouvre l'import par le bouton du haut,
   sans passer par une rangée. Le menu se pose sur la première pose, comme
   avant, et le bouton de bibliothèque est **grisé** si l'on choisit
   « Galerie du jeu, sans mouvement » — reprendre une image sans case à
   remplir ne voudrait rien dire.
6. **« Fabriquer… »** : quatre portes, et la dernière — *Une image que tu as
   déjà* — dit en toutes lettres que rien n'est envoyé et rien n'est payé.

**La dépense ne doit pas bouger d'un centime pendant tout ça.** La barre du
haut le dit ; le double le confirme en fin de montage.
"""

from __future__ import annotations

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

from conftest import FournisseurDouble, image_sujet  # noqa: E402

PORT = 8503

DIRECTIONS = (
    ("sud", "seen from the front"),
    ("nord", "seen from behind"),
    ("est", "seen from the right"),
    ("ouest", "seen from the left"),
)

# Ce que le pèlerin porte, pour que la bibliothèque ne soit pas vide quand on
# vient y reprendre une image.
DEJA_LA = (
    ("repos", "sud"),
    ("repos", "nord"),
    ("marche", "est"),
)


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _poser(client, gabarit: Path, personnage: str, pose: str, direction: str) -> str:
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} / {pose} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": pose, "direction": direction},
        ),
        f"la case « {pose} / {direction} »",
    )
    return identifiant


def peupler(atelier: Atelier, dossier: Path) -> dict:
    gabarits = dossier / "gabarits"
    gabarits.mkdir(parents=True, exist_ok=True)

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

        pelerin = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": "A weathered pilgrim in a hooded brown robe.",
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]

        for rang, (pose, direction) in enumerate(DEJA_LA, start=1):
            chemin = gabarits / f"pelerin-{rang}.png"
            chemin.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
            _poser(client, chemin, pelerin, pose, direction)

        # ── La vedette de cet atelier : **aucune image, et c'est le sujet.**
        rodeuse = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "La rôdeuse des tourbières",
                    "description": (
                        "A lean marsh scout in oiled leathers, a short bow, "
                        "mud to the knees."
                    ),
                },
            ),
            "la création de la rôdeuse",
        )["personnage"]["identifiant"]

        charge = _exiger(client.get("/api/characters"), "la liste des sujets")
        sienne = next(
            (p for p in charge["personnages"] if p["identifiant"] == rodeuse), None
        )
        if sienne is None:
            raise SystemExit("la rôdeuse n'est pas dans la liste que le serveur rend")
        images = sum(len(c.get("images") or []) for c in sienne.get("cases", []))
        if images:
            raise SystemExit(
                f"la rôdeuse devait naître sans image, le serveur en rend {images}"
            )
        return {
            "projet": projet,
            "rodeuse": rodeuse,
            "pelerin": pelerin,
            "cases": sienne.get("cases", []),
        }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-reference-importee-"))
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
    print("  Les cases de la rôdeuse, telles que le serveur les rend :")
    for sienne in monte["cases"]:
        directions = sienne.get("directions") or []
        noms = ", ".join(d["identifiant"] for d in directions) or "sans direction"
        print(
            f"    · {sienne['pose']:8s} {len(sienne.get('images') or [])} image(s)"
            f"  —  {noms}"
        )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › La rôdeuse des tourbières")
    print("  → sa vignette dit « Référence à créer » ; clique-la")
    print("  → déplie « repos » : chaque rangée porte « ↥ importer » ET « + générer »")
    print("  → « ↥ importer » sur nord : le dialogue arrive pointé sur repos · Nord")
    print("  → « Reprendre une image de la bibliothèque » : celles du pèlerin")
    print("  → « Fabriquer… » : quatre portes, la dernière ne coûte rien")
    print("  La dépense doit rester à zéro du début à la fin.")
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
