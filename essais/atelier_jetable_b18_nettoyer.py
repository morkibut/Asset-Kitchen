# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B18 — Nettoyer, le reste des
moteurs**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8492 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_nettoyer.py

`sans-servir` en argument peuple, mesure et imprime le résumé sans lancer
uvicorn.

## Ce qu'il monte

**Un garde en armure**, peint directement à 64 px et **sans place `grille`** —
comme `B17` le faisait déjà pour le pèlerin piqué : un défaut d'un pixel ne
doit pas se faire manger par une réduction avant même d'atteindre la table.

Il porte, à dessein, un défaut par moteur neuf :

- **deux îlots détachés** de sa cape, à bonne distance — pour « garder le
  sujet seul » ;
- **un trou** de deux pixels dans le plastron — pour « boucher les trous » ;
- **une poche de fond** enfermée dans le heaume — pour « reboucher les poches
  de fond » ;
- **une antenne d'un pixel de large** sur l'épaule — pour « ronger puis
  regonfler », et pour « épargner les traits fins » ;
- **une entaille** d'un pixel dans le bord de l'épaulière — pour « regonfler
  puis ronger » ;
- **un coin manquant** au creux d'un pli du plastron — pour « vote des
  voisins ».

Sept personnages : un **témoin** sans aucun réglage neuf, un par moteur, et
un dernier avec **les sept posés à la fois**.

**Rien n'a été payé** : les images arrivent par `/assets/import`, jamais par
une route de génération. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › le témoin › Retoucher › Nettoyer.** Sept réglages
   de plus sous « les diagonales comptent » — garder les plus grandes, boucher
   les trous, reboucher les poches, ronger/regonfler, épargner les traits
   fins, regonfler/ronger, vote des voisins — chacun avec sa phrase.
2. **Le sujet « garder le sujet seul ».** Monter le curseur à 1 doit faire
   disparaître net les deux îlots, et rien d'autre.
3. **Le sujet « boucher les trous ».** Monter le curseur doit combler le trou
   du plastron avec la couleur qui l'entoure — jamais du gris inventé.
4. **Le sujet « ronger puis regonfler ».** À « épargner les traits fins » sur
   `oui`, l'antenne survit ; sur `non`, elle part avec le premier cran.
5. **Le sujet « tous posés »** doit rester un garde reconnaissable, sans
   aucun de ses six défauts.
6. **La liste des taches**, en bas de la table : chaque ligne porte un bouton
   « effacer ». Cliquer celui d'un îlot doit l'effacer sans toucher au reste,
   même avant de toucher un seul curseur — c'est la désignation à la main.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import uvicorn
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8492

FOND = "#FF00FF"
FOND_RGB = (255, 0, 255)
BRUN = (107, 90, 68)
GRIS = (140, 140, 150)


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _garde_sale(cote: int = 64) -> bytes:
    """Un garde en armure, peint **directement en RGBA**, un défaut par
    moteur neuf de `B18` — voir le docstring du module.

    **Peinte avec son alpha, et importée sans passe de détourage.** Un trou
    (transparent) et une poche de fond (opaque, à la couleur du fond, mais
    enfermée) sont les deux lectures inverses d'une même chose
    (`atelier/image/taches.py`) : passer par le moteur du bord referait le
    même flood-fill que celui que ce fichier veut démontrer séparément, et
    rendrait les deux indiscernables à l'import. Peindre l'alpha à la main
    isole chaque défaut proprement.
    """
    tableau = np.zeros((cote, cote, 4), dtype=np.uint8)  # tout transparent
    # Le fond porte sa couleur sous l'alpha nul, comme un vrai détourage la
    # laisse (`etaler_sous_la_transparence`, B17) — sans ça, `_couleur_du_bord`
    # lirait du noir au lieu du magenta, et la poche du heaume ne lui
    # ressemblerait jamais.
    tableau[:, :, :3] = FOND_RGB

    def poser(y0, y1, x0, x1, couleur):
        tableau[y0:y1, x0:x1, :3] = couleur
        tableau[y0:y1, x0:x1, 3] = 255

    # Le corps : un plastron gris, une épaulière brune.
    haut, bas = 10, cote - 6
    gauche, droite = 20, cote - 18
    poser(haut, bas, gauche, droite, GRIS)
    poser(haut, haut + 14, gauche - 6, gauche, BRUN)  # l'épaulière

    # 1. Deux îlots détachés de la cape — « garder le sujet seul ».
    poser(2, 4, 2, 4, BRUN)
    poser(cote - 4, cote - 2, cote - 4, cote - 2, BRUN)

    # 2. Un trou **transparent** dans le plastron — « boucher les trous ».
    milieu_y, milieu_x = (haut + bas) // 2, (gauche + droite) // 2
    tableau[milieu_y : milieu_y + 2, milieu_x : milieu_x + 2, 3] = 0

    # 3. Une poche de fond **opaque, à la couleur du fond, enfermée** dans le
    #    heaume — « reboucher les poches ». Le heaume : un carré gris
    #    au-dessus du plastron, avec un cœur qui garde encore la couleur du
    #    fond mais reste opaque.
    heaume_haut = haut - 8
    poser(heaume_haut, haut, gauche + 4, droite - 4, GRIS)
    poser(heaume_haut + 2, heaume_haut + 4, gauche + 8, gauche + 10, FOND_RGB)

    # 4. Une antenne d'un pixel de large sur l'épaule — « ronger/regonfler ».
    tableau[haut - 4 : haut, gauche - 3, :3] = BRUN
    tableau[haut - 4 : haut, gauche - 3, 3] = 255

    # 5. Une entaille d'un pixel dans le bord de l'épaulière — « regonfler/
    #    ronger ».
    tableau[haut + 6, gauche - 6, 3] = 0

    # 6. Un coin manquant au creux d'un pli du plastron — « vote des voisins ».
    tableau[milieu_y + 6, milieu_x + 6, 3] = 0

    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _sans_grille(**bords) -> dict:
    """La chaîne minimale — **aucune passe de détourage**, et la table
    `Nettoyer` demandée.

    **Sans détourage et sans place `grille`** : l'image importée porte déjà
    son alpha finale, peinte à la main pixel par pixel — un pixel de la
    source est un pixel du rendu, et les six défauts se comptent pour de vrai
    au lieu d'être recalculés par un flood-fill ou lissés par une réduction.
    """
    charge: dict = {
        "passes": [],
        "quantification": {"couleurs": 32, "palette": [], "tramage": "aucun"},
    }
    if bords:
        charge["bords"] = {"aire_min": 0, **bords}
    return charge


def _poser(client, gabarit: Path, personnage: str, charge: dict) -> dict:
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": "repos"},
        ),
        f"la case « repos » de « {personnage} »",
    )
    asset = _exiger(
        client.put(f"/api/assets/{identifiant}/recipe", json=charge),
        f"la recette de « {personnage} »",
    )
    _exiger(
        client.put("/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}),
        f"la retenue de « {personnage} »",
    )
    return asset


def _rendu(client, identifiant: str) -> np.ndarray:
    reponse = client.get(f"/api/assets/{identifiant}/download")
    if reponse.status_code >= 400:
        raise SystemExit(f"le rendu de {identifiant} : {reponse.status_code} {reponse.text}")
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _pixels_opaques(rgba: np.ndarray) -> int:
    return int((rgba[:, :, 3] > 0).sum())


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "le projet",
        )["projet"]["identifiant"]
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 64,
                    "methode_pixels": "proche",
                    "couleurs": 32,
                    "fond": FOND,
                },
            ),
            "les réglages de l'univers",
        )

        gabarit = dossier / "garde.png"
        gabarit.write_bytes(_garde_sale())

        sujets: dict[str, dict] = {}
        for nom, charge in (
            ("Le garde (témoin)", _sans_grille()),
            ("Le garde — garder le sujet seul", _sans_grille(garder=1)),
            ("Le garde — boucher les trous", _sans_grille(boucher_jusqua=4)),
            ("Le garde — reboucher les poches", _sans_grille(reboucher_jusqua=4)),
            (
                "Le garde — ronger puis regonfler",
                _sans_grille(ronger_regonfler=1, epargner_traits_fins=True),
            ),
            (
                "Le garde — ronger sans épargne",
                _sans_grille(ronger_regonfler=1, epargner_traits_fins=False),
            ),
            ("Le garde — regonfler puis ronger", _sans_grille(regonfler_ronger=1)),
            ("Le garde — vote des voisins", _sans_grille(vote_voisins=1)),
            (
                "Le garde — tous posés",
                _sans_grille(
                    garder=1,
                    boucher_jusqua=4,
                    reboucher_jusqua=4,
                    ronger_regonfler=1,
                    epargner_traits_fins=True,
                    regonfler_ronger=1,
                    vote_voisins=1,
                ),
            ),
        ):
            personnage = _exiger(
                client.post(
                    "/api/characters",
                    json={"nom": nom, "description": "", "type": "personnage"},
                ),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            asset = _poser(client, gabarit, personnage, charge)
            sujets[nom] = {
                "personnage": personnage,
                "asset": asset,
                "rendu": _rendu(client, asset["identifiant"]),
            }

        return {"projet": projet, "sujets": sujets}


def principal(sans_servir: bool = False) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-nettoyer-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s  ·  garde peint à 64 px, sans grille  ·  fond {FOND}")
    print()

    temoin = sujets["Le garde (témoin)"]["rendu"]
    print(f"  Témoin : {_pixels_opaques(temoin)} px opaques, {temoin.shape[1]}×{temoin.shape[0]}")
    print()
    print("  Ce que chaque moteur change, contre le témoin :")
    for nom, sujet in sujets.items():
        if nom == "Le garde (témoin)":
            continue
        rgba = sujet["rendu"]
        print(f"    · {nom:<34} {_pixels_opaques(rgba)} px opaques (témoin : {_pixels_opaques(temoin)})")

    garder = sujets["Le garde — garder le sujet seul"]["rendu"]
    print()
    print(
        "  garder le sujet seul — les deux îlots (2,2) et (61,61) sont partis : "
        f"{'oui' if garder[2, 2, 3] == 0 and garder[61, 61, 3] == 0 else 'NON'}"
    )

    boucher = sujets["Le garde — boucher les trous"]["rendu"]
    print(
        "  boucher les trous — le trou du plastron est comblé : "
        f"{'oui' if boucher[35, 33, 3] == 255 else 'NON'} (à vérifier au pixel exact selon la peinture)"
    )

    avec_epargne = sujets["Le garde — ronger puis regonfler"]["rendu"]
    sans_epargne = sujets["Le garde — ronger sans épargne"]["rendu"]
    print(
        "  épargner les traits fins — l'antenne de l'épaule survit avec l'épargne, "
        f"pas sans : {int((avec_epargne[:, :, 3] > 0).sum())} px vs "
        f"{int((sans_epargne[:, :, 3] > 0).sum())} px"
    )

    tous = sujets["Le garde — tous posés"]["rendu"]
    print(
        f"  tous posés — {_pixels_opaques(tous)} px opaques (le témoin en porte "
        f"{_pixels_opaques(temoin)} avec ses six défauts)"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › le témoin › Retoucher › Nettoyer")
    print("    · sept réglages de plus, chacun avec sa phrase « pourquoi »")
    print("  → Le garde — garder le sujet seul : monter le curseur à 1")
    print("  → Le garde — ronger puis regonfler : basculer « épargner les traits fins »")
    print("  → la liste des taches, en bas : cliquer « effacer » sur une ligne")
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
