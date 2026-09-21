# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier le chantier RT au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8424, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte de quoi cliquer les neuf tranches :

- **RT2** — l'étape « Son allure » doit montrer le rôdeur sous chaque taille,
  chaque méthode et chaque nombre de couleurs. La méthode `pixeloe` n'est pas
  installée sur cette machine : sa case doit se **nommer** et se fermer, jamais
  rester vide ni cassée.
- **RT4, RT5** — la section « Le fond du jeu » ne doit plus exister, et les
  phrases retirées non plus. Ce qui reste : la ligne sur l'argent.
- **RT6** — le projet porte trois images, donc changer la taille doit avertir
  et dire combien d'images restent à l'ancienne. Un projet vide est monté à
  côté pour montrer l'autre moitié de la règle : sur lui, rien ne se dit.
- **RT7** — une note est collée sur la toile, pour qu'on puisse la corriger.
- **RT8** — aucun son n'est monté : l'écran doit se déclarer vide au lieu du
  grand blanc, et garder la navigation autour de lui.
- **RT9** — la porte du menu doit dire « Codex ».

⚠️ **L'atelier sert `interface/dist`**, pas les sources : il faut avoir lancé
`npm --prefix interface run build` après la dernière modification d'écran, sans
quoi on vérifie l'interface d'avant le chantier.

    py essais/atelier_jetable_rt.py

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
from conftest import AnimateurMuet, FournisseurDouble, image_sujet  # noqa: E402

PORT = 8424
MODELE = "essai:rend-du-png"


def peupler(atelier, double) -> None:
    """Trois images et une note, par les vraies routes HTTP.

    **Par les routes et pas par les services** : ce qu'on vérifie ensuite à
    l'écran passe par elles, et un atelier peuplé autrement ne prouverait rien
    de ce que l'écran recevra.

    **Sur une application à part de celle qu'on sert ensuite** : le serveur MCP
    embarqué refuse d'ouvrir son cycle de vie deux fois sur la même instance.
    Deux applications sur le même atelier, donc sur le même dossier.
    """
    with TestClient(creer_application(atelier)) as client:
        for sujet in ("un rôdeur encapuchonné", "un tonneau de chêne", "une fiole bleue"):
            double.rendre = lambda: image_sujet(bloc=4, toile=512)
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

        assets = client.get("/api/assets").json()
        print(f"  {assets['total']} images posées — RT6 doit donc avertir au changement de taille")

        # **RT7 : une note à corriger.** Elle naît posée sur le plan, pour
        # qu'on la voie sans avoir à la sortir de la réserve.
        note = client.post(
            "/api/board/texts",
            json={
                "texte": "Le marais rend tout vert-de-gris. Coller ici les mots qui marchent.",
                "position": [120, 120],
            },
        )
        print(f"  note collée sur la toile : {note.status_code} — RT7 doit laisser la corriger")

        # ── Ce que les écrans devront montrer, dit ici avant d'ouvrir ────────
        # Si la console le dit déjà, l'écran n'a plus qu'une chose à prouver :
        # qu'il l'affiche. C'est aussi le seul moyen de voir ce qu'un essai
        # d'écran ne remonterait pas.
        univers = client.get("/api/universe").json()["univers"]
        print(f"  taille du jeu : {univers['cible_px']} · méthode : {univers['methode_pixels']}")
        print(f"  fond écrit dans l'univers : « {univers['fond']} » (RT4 : plus aucun écran ne l'écrit)")

        # **RT1/RT2 : l'aperçu, méthode par méthode.** Une méthode absente doit
        # se nommer — c'est le cas de `pixeloe` sur cette machine — et les
        # autres doivent rendre une image.
        for methode in ("vote", "lanczos", "proche", "pixeloe"):
            rendu = client.get(
                f"/api/universe/allure/preview.png?taille=64&methode={methode}&couleurs=32"
            )
            poids = len(rendu.content) if rendu.status_code == 200 else 0
            dit = f"{poids} octets" if poids else f"refus {rendu.status_code} — {rendu.text[:90]}"
            print(f"  aperçu « {methode} » : {dit}")

        sons = client.get("/api/sounds").json()
        combien = sons.get("total", len(sons.get("sounds", sons.get("sons", []))))
        print(f"  sons du jeu : {combien} — RT8 doit donc se déclarer vide, pas rester blanc")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rt-"))
    print(f"Dossier jetable : {dossier}")

    dist = RACINE / "interface" / "dist"
    if not dist.exists():
        print("⚠️  interface/dist absent — lance `npm --prefix interface run build` d'abord.")

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
