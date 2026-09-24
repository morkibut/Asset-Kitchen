# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier TS15 au navigateur, sans toucher à celui de l'auteur.

**TS15 — le détail d'une carte et d'un îlot s'ouvre dans la colonne de droite.**
Cet atelier-ci vit sur un dossier temporaire, sur le port 8433 — l'auteur
travaille sur 8420 et 8421, qui ne bougent pas.

Il pose trois cartes sur la toile : deux images groupées dans l'îlot « marais »,
et une note posée à part. Un fournisseur doublé : rien n'est payé, rien
n'écrit dans `donnees/`.

## Ce qu'on vient voir à l'écran

1. Aller dans « Univers & toile », onglet Inspiration, vue « toile ».
2. Cliquer une des deux images du marais : son détail — miniature, réglages,
   actions — doit paraître dans la colonne de droite, à la place de
   « RÉSERVE », sans jamais ouvrir de fenêtre sur le plan.
3. Cliquer l'autre image : le détail change de carte sans jamais laisser
   revenir la réserve entre les deux.
4. Cliquer le nom de l'îlot « marais » (le bandeau) : son détail — nom,
   cartes, palette, ambiance — paraît dans la même colonne.
5. Croix, puis Échap, puis un clic sur le plan vide : les trois referment le
   détail et rendent la réserve.
6. À vérifier à 1920 px et à 1280 px de large : la colonne garde sa largeur,
   rien ne déborde.

⚠️ Cet atelier sert l'interface par le serveur de développement Vite (le
worktree n'a pas d'`interface/dist`, et il ne doit pas en avoir) : lance
`npm --prefix interface run dev` à côté, avec `VITE_API_PORT=8433`.

    .venv/Scripts/python.exe essais/atelier_jetable_ts15.py

Ctrl-C pour l'arrêter.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8433


def peupler(atelier) -> None:
    """Par les vraies routes HTTP : c'est par elles que l'écran lira."""
    with TestClient(creer_application(atelier)) as client:
        # Un vrai projet, ouvert d'emblée (US-5) — sans lui, les cartes se
        # collent sur `projet=""` et n'apparaissent nulle part à l'écran.
        cree = client.post("/api/projects", json={"nom": "Le Marais"})
        assert cree.status_code == 201, cree.text
        print("  projet « Le Marais » créé et ouvert")

        # Deux images, collées puis groupées dans le même îlot — c'est le
        # geste qui fait paraître « marais » sur la toile (T8).
        cartes = []
        # **Deux images différentes** : `image_sujet()` aux mêmes réglages
        # rendrait deux fois les mêmes octets, et le second collage serait lu
        # comme un doublon du premier (`carte` nul dans la réponse).
        for nom, bloc in (("premier-tirage.png", 4), ("second-tirage.png", 6)):
            recu = client.post(
                "/api/board/paste",
                content=image_sujet(bloc=bloc),
                params={"nom": nom},
            )
            assert recu.status_code == 201, recu.text
            carte = recu.json()["carte"]
            assert carte, f"« {nom} » a été lu comme un doublon : {recu.json()}"
            cartes.append(carte["identifiant"])
        print(f"  deux images collées : {cartes}")

        client.put(
            f"/api/board/{cartes[0]}",
            json={"groupe": "marais", "position": [0, 0], "note": "premier tirage"},
        )
        client.put(
            f"/api/board/{cartes[1]}",
            json={"groupe": "marais", "position": [200, 0], "note": "second tirage"},
        )
        print("  les deux posées dans l'îlot « marais »")

        # Une note, posée à part — pour vérifier le détail d'une carte texte
        # (sa teinte, son texte) depuis la même colonne.
        note = client.post(
            "/api/board/text",
            json={
                "texte": "L'eau y stagne, la lumière y traîne — une ambiance à tirer de ça.",
                "position": [500, 0],
            },
        )
        assert note.status_code == 201, note.text
        print("  une note posée hors îlot")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-ts15-"))
    print(f"Dossier jetable : {dossier}")
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)
    print()
    print(f"Atelier jetable (API) sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("Ouvre l'interface par le serveur de dev Vite (voir l'en-tête du fichier).")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
