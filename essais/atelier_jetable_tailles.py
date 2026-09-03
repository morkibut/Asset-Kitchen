# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier la tranche des tailles au navigateur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8422, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel. Le 8421 reste libre pour celui de D2.

Ce qu'il y a à cliquer, et ce que ça doit montrer :

- **Réglages › Les types d'objets** — chaque type a un échantillon de hauteur :
  un cadre qui *est* le fichier qui reviendra, et un pointillé à la hauteur d'un
  personnage. Le décor y est posé à 300 %, donc son pointillé est au tiers du
  cadre et le texte dit *3 personnages de haut · l'image revient en 192 carrés*.
- Le curseur de ce type monte jusqu'à 800 % — huit personnages — et non plus 100.
- **La table « grille » d'une image** — même échantillon, même curseur, et la
  ligne des crans compte désormais sur les 791 positions du curseur.
- Une image posée à 300 % revient en **192 carrés de côté** et non plus 64 : la
  fiche le dit, et l'image le montre.

    py essais/atelier_jetable_tailles.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.recette import occupation_max  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8422
MODELE = "essai:rend-du-png"
# La hauteur qu'on pose sur le décor et sur une image, en pour cent d'un
# personnage. Trois, parce que c'est la taille d'un bâtiment de trois étages et
# que le rapport se voit à l'œil sur l'échantillon.
TROIS_PERSONNAGES = 300


def peupler(atelier) -> None:
    """Trois images et un barème ouvert, par les vraies routes HTTP.

    **Sur une application à part de celle qu'on sert ensuite** : le serveur MCP
    embarqué refuse d'ouvrir son cycle de vie deux fois sur la même instance
    (`docs/PIEGES.md`). Deux applications sur le même atelier, donc sur le même
    dossier — ce qui est écrit par l'une est lu par l'autre.
    """
    with TestClient(creer_application(atelier)) as client:
        for sujet in ("un moulin de pierre", "un tonneau de chêne", "une fiole bleue"):
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

        # ── Le barème : le décor devient un bâtiment de trois personnages ─────
        bareme = client.get("/api/universe").json()["univers"]["bareme"]
        envoye = [
            {
                "nom": e["nom"],
                "famille": e["famille"],
                "occupation": TROIS_PERSONNAGES if e["nom"] == "décor" else e["occupation"],
                "silhouette": e["silhouette"],
            }
            for e in bareme
        ]
        pose = client.put("/api/universe", json={"bareme": envoye})
        assert pose.status_code == 200, pose.text
        relu = client.get("/api/universe").json()["univers"]
        cible = relu["cible_px"]
        hauteurs = {e["nom"]: e["occupation"] for e in relu["bareme"]}
        print(f"  case du projet : {cible} carrés")
        print(f"  plafond des hauteurs : {occupation_max(cible)} %")
        print(f"  hauteurs du barème : {hauteurs}")

        # ── Une image posée à trois personnages, pour voir la case grandir ────
        vise = assets[0]
        recette = dict(vise["recette"])
        recette["grille"] = {
            "cible": cible,
            "occupation": TROIS_PERSONNAGES,
            "ancrage": "bas",
            "decalage": 0,
            "methode": "vote",
        }
        posee = client.put(f"/api/assets/{vise['identifiant']}/recipe", json=recette)
        assert posee.status_code == 200, posee.text

        apres = next(
            a
            for a in client.get("/api/assets").json()["assets"]
            if a["identifiant"] == vise["identifiant"]
        )
        print(
            f"  « {apres['label']} » à {TROIS_PERSONNAGES} % : "
            f"rendu {apres['rendu_largeur']} × {apres['rendu_hauteur']} "
            f"(la case du projet fait {cible})"
        )

        mesures = client.get(f"/api/assets/{vise['identifiant']}/spots").json()
        hauteur = mesures.get("hauteur", {})
        print(f"  ce que l'écran reçoit pour l'échantillon : {hauteur}")
        print(f"  crans du curseur : {len(mesures.get('crans_occupation', []))}")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-tailles-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    # Un sujet **franchement plus haut que large** : c'est le cas où la case
    # carrée mordait, donc celui qui montre la différence entre une boîte qui
    # grandit et une boîte qui rogne.
    double.rendre = lambda: image_sujet(logique_l=6, logique_h=44, bloc=4, toile=48)
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
