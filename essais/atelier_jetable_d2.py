# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier D2 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8421, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte un projet peuplé de quelques images, pour qu'il y ait de quoi cliquer :
- l'écran des réglages, étape « La taille », doit montrer la façon de réduire ;
- l'étape « Références et couleurs » doit montrer le nombre de couleurs **même
  sans artwork**, et dire d'où viennent les couleurs ;
- la table « grille » d'une image doit montrer les quatre méthodes.

**Et depuis la seconde moitié de la tranche**, la table « grille » doit dire, au-
dessus de la taille, sur quels carrés le modèle a peint. Les deux réponses
possibles sont montées ici, parce qu'une seule ne prouverait rien :

- *« le tonneau »* est peint sur une vraie grille de 8 px — la ligne doit donner
  le pas **et** le nombre de carrés que l'image compte ;
- *« la fiole »* est une peinture aux dégradés doux — la ligne doit dire qu'il
  n'y a **aucune** grille à retrouver, et les crans de taille doivent rester là :
  c'est alors l'auteur qui la pose, et c'est la bonne réponse.

    py essais/atelier_jetable_d2.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8421
MODELE = "essai:rend-du-png"

#: Une petite palette quelconque, pour que deux cases voisines diffèrent souvent
#: sans que l'image devienne un damier : c'est ce qui rend le pas mesurable
#: partout tout en gardant des aplats, comme un vrai sprite.
PALETTE = ((196, 74, 52), (58, 92, 140), (232, 214, 160), (44, 46, 58), (120, 168, 92))


def _en_png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def sprite_sur_une_grille(pas: int = 8, cases: int = 48) -> bytes:
    """Un sujet peint case par case, puis étiré au pas voulu — une vraie grille."""
    generateur = np.random.default_rng(20260903)
    logique = np.zeros((cases, cases, 4), dtype=np.uint8)
    tirage = generateur.integers(0, len(PALETTE), size=(cases, cases))
    for y in range(cases):
        for x in range(cases):
            if (x - cases / 2) ** 2 + (y - cases / 2) ** 2 < (cases / 2.6) ** 2:
                logique[y, x] = (*PALETTE[tirage[y, x]], 255)
    cote = cases * pas
    return _en_png(
        np.asarray(
            Image.fromarray(logique, mode="RGBA").resize(
                (cote, cote), Image.Resampling.NEAREST
            )
        )
    )


def peinture(cote: int = 384) -> bytes:
    """Des taches douces et **aucune frontière franche** — le cas où l'on renonce."""
    generateur = np.random.default_rng(1789)
    petite = generateur.integers(0, 255, size=(9, 9, 3), dtype=np.uint8)
    rgb = np.asarray(
        Image.fromarray(petite, mode="RGB").resize(
            (cote, cote), Image.Resampling.BICUBIC
        )
    )
    return _en_png(np.dstack([rgb, np.full((cote, cote), 255, np.uint8)]))


def peupler(atelier, double) -> None:
    """Trois images dans un projet, par les vraies routes HTTP.

    **Par les routes et pas par les services** : ce qu'on vérifie ensuite à
    l'écran passe par elles, et un atelier peuplé autrement ne prouverait rien
    de ce que l'écran recevra.

    **Sur une application à part de celle qu'on sert ensuite**, et pas par
    économie : le serveur MCP embarqué refuse d'ouvrir son cycle de vie deux
    fois sur la même instance — *« StreamableHTTPSessionManager .run() can only
    be called once per instance »*. Le `TestClient` ouvrant ce cycle pour
    peupler, uvicorn ne pouvait plus le rouvrir pour servir. Deux applications
    sur **le même atelier**, donc sur le même dossier : ce qui est écrit par
    l'une est lu par l'autre.
    """
    with TestClient(creer_application(atelier)) as client:
        # **Chaque sujet reçoit une image différente**, et c'est ce qui rend la
        # vérification possible : la ligne « les carrés du modèle » n'a que deux
        # réponses, et les montrer toutes les deux côte à côte est la seule
        # façon de voir que la seconde n'est pas une panne de la première.
        for sujet, rendu in (
            ("un tonneau de chêne", lambda: sprite_sur_une_grille(pas=8)),
            ("une fiole bleue", peinture),
            ("un coffre ferré", lambda: image_sujet(bloc=4, toile=512)),
        ):
            double.rendre = rendu
            lancee = client.post(
                "/api/generations",
                json={"modele": MODELE, "prompt": sujet, "echelle": "personnage"},
            )
            assert lancee.status_code == 202, lancee.text
            identifiant = lancee.json()["identifiant"]
            for _ in range(400):
                if client.get(f"/api/generations/{identifiant}").json()["statut"] != "en_cours":
                    break
                time.sleep(0.01)
        assets = client.get("/api/assets").json()["assets"]
        print(f"  {len(assets)} images posées")

        # **Ce que la table dira, dit ici avant d'ouvrir le navigateur.** Si la
        # console montre déjà deux réponses différentes, l'écran n'a plus qu'une
        # chose à prouver : qu'il les affiche. C'est aussi le seul moyen de voir
        # une mesure qu'un essai d'écran ne remonterait pas.
        for asset in assets:
            grille = client.get(
                f"/api/assets/{asset['identifiant']}/spots"
            ).json()["grille_du_modele"]
            dit = (
                f"{grille['pas']} px, soit {grille['carres']} carrés"
                if grille["raison"] is None
                else f"renonce — {grille['raison']}"
            )
            print(f"  « {asset['label']} » → {dit}")

        univers = client.get("/api/universe").json()["univers"]
        print(f"  méthode du projet : {univers['methode_pixels']}")
        print(f"  couleurs demandées : {univers['couleurs']}")
        print(f"  palette : {len(univers['palette'])} couleurs (aucun artwork promu)")

        traitement = client.get("/api/status").json()["traitement"]
        for r in traitement["reductions"]:
            print(f"  réduction « {r['libelle']} » : {r['raison'] or 'disponible'}")
        print(f"  note des couleurs : {traitement['quantification']['note']}")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-d2-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    double.rendre = lambda: image_sujet(bloc=4, toile=512)
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
