# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier M6 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8425, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **très exactement le cas que l'auteur avait sous les yeux** : une pose
qui porte deux calques du même sac de voyage, et une autre qui porte deux corps.
De quoi cliquer sur ce que la tranche livre :

- **la rangée d'une pièce** doit montrer deux vignettes, dont **une seule**
  cerclée — celle qui partirait dans le jeu — et ses mesures à droite doivent
  être celles de la cerclée ;
- **le coin en cyan** doit se poser d'un clic sur n'importe laquelle des deux,
  et le liseré doit sauter sur celle qu'on vient de marquer **sans recharger la
  page** — c'est l'annonce du favori, qui manquait ;
- **la carte de droite** doit dire lequel part, et offrir *◤ favori* et
  *Supprimer cette image* ;
- **l'onglet du corps** doit se comporter pareil sur les poses de base.

    py essais/atelier_jetable_m6.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Ce que la console dit avant qu'on ouvre le navigateur.** Les faits que l'écran
n'a plus qu'à afficher : qui est retenu, pièce par pièce, avant et après qu'un
favori soit posé sur le plus ancien. Un essai d'écran ne remonterait pas ces
mesures-là — c'est la leçon du banc de D2.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.domaine.pliage import geometrie  # noqa: E402
from atelier.image import calque as calc  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, planche_sujets  # noqa: E402

PORT = 8425
MODELE = "essai:rend-du-png"
POSES = 3


def habiller(demande, cases: int, teinte: tuple[int, int, int]) -> bytes:
    """La planche reçue, avec un sac posé sur chaque sujet.

    **Deux teintes différentes selon l'appel**, pour qu'on distingue à l'œil le
    premier essai du second : c'est ce que la tranche demande de choisir.
    """
    envoyee = demande.references[-1]
    with Image.open(io.BytesIO(envoyee)) as ouverte:
        planche = ouverte.convert("RGB")
    dessin = ImageDraw.Draw(planche)
    forme = geometrie(cases)
    for boite in calc.cases_de(planche.width, planche.height, forme):
        x0, y0, x1, y1 = boite
        large, haut = x1 - x0 + 1, y1 - y0 + 1
        dessin.rectangle(
            [x0 + large // 3, y0 + haut // 4, x0 + 2 * large // 3, y0 + haut // 2],
            fill=teinte,
        )
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
        time.sleep(0.01)
    raise AssertionError("la génération n'a pas fini")


def _matrice(client) -> list[dict]:
    return client.get("/api/characters").json()["personnages"][0]["cases"]


def peupler(atelier: Atelier, double: FournisseurDouble) -> None:
    with TestClient(creer_application(atelier)) as client:
        plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        poses = plan[:POSES]
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le pèlerin", "description": "un pèlerin encapuchonné"},
        ).json()["personnage"]["identifiant"]
        client.put(f"/api/characters/{personnage}", json={"poses": poses})

        # ① Les corps, en une planche. Puis **une seconde fois la pose de
        #    repos**, seule : c'est le cas « deux corps pour une pose ».
        double.rendre = lambda: planche_sujets(POSES)
        corps = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "un pèlerin encapuchonné",
                "personnage": personnage,
                "poses": poses,
            },
        )
        assert corps.status_code == 202, corps.text
        _attendre(client, corps.json()["identifiant"])

        double.rendre = lambda: planche_sujets(1)
        encore = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "un pèlerin encapuchonné, autre essai",
                "personnage": personnage,
                "pose": poses[0],
            },
        )
        assert encore.status_code == 202, encore.text
        _attendre(client, encore.json()["identifiant"])
        double.rendre = None

        # ② La pièce, et **deux planches** qui l'habillent : deux calques par
        #    pose, ce qui est le cas exact de la remarque.
        piece = client.post(
            "/api/characters/pieces",
            json={
                "nom": "sac de voyage",
                "description": "un gros sac de voyage avec corde et matelas roulé",
                "emplacement": "dos",
                "portee": "contenue",
            },
        ).json()["piece"]["identifiant"]

        for teinte in ((40, 130, 60), (150, 60, 40)):
            double.repondre = lambda demande, t=teinte: habiller(demande, len(poses), t)
            habits = client.post(
                "/api/generations",
                json={
                    "modele": MODELE,
                    "prompt": "a big travel backpack with rope and bedroll",
                    "personnage": personnage,
                    "piece": piece,
                    "poses": poses,
                },
            )
            assert habits.status_code == 202, habits.text
            _attendre(client, habits.json()["identifiant"])
        double.repondre = None

        # ── Ce que l'écran n'aura plus qu'à afficher ─────────────────────────
        cases = _matrice(client)
        repos = next(c for c in cases if c["pose"] == poses[0])
        calques = repos["calques"][piece]
        print(f"\n  la pose « {poses[0] } » porte {len(repos['images'])} corps "
              f"et {len(calques)} calques du sac de voyage")

        retenu = repos["retenus"][piece]
        plus_ancien = min(calques, key=lambda c: (c["cree_le"], c["rang"]))
        print(f"  retenu sans favori      → {retenu}")
        print(f"  le plus ancien des deux → {plus_ancien['identifiant']}")
        print(f"  c'est bien le plus récent qui gagne : {retenu != plus_ancien['identifiant']}")

        client.put(
            "/api/assets/favorite",
            json={"identifiants": [plus_ancien["identifiant"]], "favori": True},
        )
        apres = next(c for c in _matrice(client) if c["pose"] == poses[0])
        print(f"  favori posé sur le plus ancien → retenu {apres['retenus'][piece]}")
        print(f"  la marque a renversé la règle : "
              f"{apres['retenus'][piece] == plus_ancien['identifiant']}")

        # On repose l'état de départ : l'écran doit montrer le cas ordinaire.
        client.put(
            "/api/assets/favorite",
            json={"identifiants": [plus_ancien["identifiant"]], "favori": False},
        )

        corps_repos = repos["images"]
        print(f"\n  et côté corps : {len(corps_repos)} images, retenu {repos['corps']}")
        print(f"  les mesures de la rangée décrivent → {repos['retenus'][piece]}")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-m6-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier, double)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
