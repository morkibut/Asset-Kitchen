# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B18 — Recadrer, six moteurs
neufs**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8489 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_recadrer.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte

**Le Marais du Vieux Moulin**, six personnages, chacun posé pour rendre visible
*un seul* des six moteurs neufs de la table *Recadrer* — le septième est le
témoin, sans aucun des six.

| Le sujet | Ce que sa recette porte | Ce qu'on vient voir |
|---|---|---|
| **Le pèlerin (témoin)** | rien de neuf | la chaîne d'avant B18, inchangée |
| **Le pèlerin en 64×96** | `taille` | le fichier rendu fait exactement 64×96, jamais étiré |
| **Le pèlerin en carré** | `format: carre` | le rectangle grandit en hauteur pour tenir un carré |
| **Le pèlerin calé sur 16** | `multiple: 16` | les dimensions rendues sont des multiples de 16 |
| **Le garde à la hallebarde** | `taille` + `masse` | le corps reste au centre, la hallebarde dépasse d'un côté |
| **Le pèlerin sur sa ligne** | `ligne_pied` | le bas du rectangle tombe sur le rang désigné, pas sur les pieds mesurés |
| **Le moulin sans détourage** | `bord_uni`, aucune passe | recadré par sa bordure blanche, sans un seul pixel transparent |

**Rien n'a été payé** : les images arrivent par `/assets/import`, jamais par une
route de génération. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › le pèlerin qui t'intéresse › Retoucher › Recadrer.**
   La table porte six réglages de plus : format, caler sur un multiple, ce qui
   borde le sujet, ligne de pied, taille imposée (deux curseurs), centrage.
2. **Le pèlerin en 64×96** : la vignette n'est plus carrée — vérifier au
   téléchargement (`/download`) que le fichier fait bien 64×96.
3. **Le garde à la hallebarde** : dans le panneau, passer *centrage* de « sur le
   rectangle » à « sur la masse du sujet » et regarder l'image changer — le
   corps se recentre, la hallebarde dépasse davantage d'un côté.
4. **Le moulin sans détourage** : la table *Recadrer* n'est plus grisée malgré
   une image sans transparence, dès que « ce qui borde le sujet » passe sur
   « un bord de couleur unie ».
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

from conftest import image_sujet  # noqa: E402

PORT = 8489
FOND = "#FF00FF"
BRUN = (150, 100, 60)


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}")
    return reponse.json()


def _sur_fond_magenta(octets: bytes) -> bytes:
    with Image.open(io.BytesIO(octets)) as image:
        tableau = np.asarray(image.convert("RGB")).copy()
    coin = tableau[0, 0].copy()
    fond = np.all(tableau == coin, axis=2)
    tableau[fond] = (255, 0, 255)
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _pelerin_avec_marge(cote: int = 96, largeur_sujet: int = 24, hauteur_sujet: int = 42) -> bytes:
    """Le même gabarit que `image_sujet`, mais **centré plutôt que posé au ras
    du bord bas** — `image_sujet` pose son sujet à un bloc du bord bas par
    construction (une grille de rendu à mesurer), ce qui laisse trop peu de
    place pour montrer un calage sur un multiple qui grandit sans être rogné
    par le bord de l'image reçue."""
    tableau = np.zeros((cote, cote, 3), dtype=np.uint8)
    tableau[:, :] = (255, 0, 255)
    x0 = (cote - largeur_sujet) // 2
    y0 = (cote - hauteur_sujet) // 2
    for colonne in range(largeur_sujet):
        tableau[y0 : y0 + hauteur_sujet, x0 + colonne] = BRUN if colonne % 2 == 0 else (110, 70, 40)
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _garde_a_la_hallebarde(cote: int = 96) -> bytes:
    """Un corps carré au centre, une hallebarde fine loin sur la droite —
    exactement le cas que la planche nomme pour « centré sur la masse »."""
    tableau = np.zeros((cote, cote, 3), dtype=np.uint8)
    tableau[:, :] = (255, 0, 255)
    milieu = cote // 2
    tableau[milieu - 18 : milieu + 18, milieu - 18 : milieu + 18] = BRUN
    tableau[milieu - 2 : milieu + 2, milieu + 18 : cote - 2] = BRUN
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _moulin_a_bord_blanc(cote: int = 120, bord: int = 14) -> bytes:
    """**Une image jamais détourée** : opaque partout, une bordure blanche
    unie, et un moulin brun au centre — le cas visé par le rognage d'un bord
    de couleur unie."""
    tableau = np.zeros((cote, cote, 3), dtype=np.uint8)
    tableau[:, :] = (255, 255, 255)
    tableau[bord:-bord, bord:-bord] = BRUN
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _poser(client, gabarit: Path, personnage: str, charge: dict, *, detourer: bool = True) -> dict:
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


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "le projet",
        )["projet"]["identifiant"]
        _exiger(
            client.put(
                "/api/universe",
                json={"style": "pixel", "cible_px": 64, "methode_pixels": "proche", "couleurs": 16, "fond": FOND},
            ),
            "les réglages de l'univers",
        )

        brut = image_sujet(toile=48, bloc=3, logique_l=8, logique_h=14)
        pelerin = dossier / "pelerin.png"
        pelerin.write_bytes(_sur_fond_magenta(brut))
        # **Un second gabarit, centré avec de la marge tout autour** — le même
        # sujet, mais assez de place pour que le calage sur 16 grandisse sans
        # buter tout de suite sur le bord de l'image reçue.
        pelerin_large = dossier / "pelerin-large.png"
        pelerin_large.write_bytes(_pelerin_avec_marge())
        garde = dossier / "garde.png"
        garde.write_bytes(_garde_a_la_hallebarde())
        moulin = dossier / "moulin.png"
        moulin.write_bytes(_moulin_a_bord_blanc())

        passe = [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}]

        sujets: dict[str, dict] = {}
        for nom, gabarit, charge in (
            ("Le pèlerin (témoin)", pelerin, {"passes": passe, "recadrage": {"marge": 0, "boite": None}}),
            (
                "Le pèlerin en 64×96",
                pelerin,
                {"passes": passe, "recadrage": {"marge": 0, "boite": None, "taille": [64, 96]}},
            ),
            (
                "Le pèlerin en carré",
                pelerin,
                {"passes": passe, "recadrage": {"marge": 0, "boite": None, "format": "carre"}},
            ),
            (
                "Le pèlerin calé sur 16",
                pelerin_large,
                {"passes": passe, "recadrage": {"marge": 0, "boite": None, "multiple": 16}},
            ),
            (
                "Le garde à la hallebarde",
                garde,
                {
                    "passes": passe,
                    "recadrage": {"marge": 0, "boite": None, "taille": [220, 60], "masse": True},
                },
            ),
            (
                "Le pèlerin sur sa ligne",
                pelerin,
                {"passes": passe, "recadrage": {"marge": 0, "boite": None, "ligne_pied": 40}},
            ),
            (
                "Le moulin sans détourage",
                moulin,
                {"recadrage": {"marge": 0, "boite": None, "bord_uni": True}},
            ),
        ):
            personnage = _exiger(
                client.post("/api/characters", json={"nom": nom, "description": "", "type": "personnage"}),
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
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print("  Ce que le serveur a vraiment rendu — relu sur les octets servis par la route :")
    for nom, sujet in sujets.items():
        rgba = sujet["rendu"]
        opaque = bool(rgba[:, :, 3].all())
        print(
            f"    · {nom:<28} {rgba.shape[1]}×{rgba.shape[0]} px"
            f"{'  ·  aucune transparence' if opaque else ''}"
        )

    print()
    print("  Les six moteurs, vérifiés sur le fichier rendu :")

    taille = sujets["Le pèlerin en 64×96"]["rendu"]
    print(f"    1. taille imposée — 64×96 demandé, {taille.shape[1]}×{taille.shape[0]} rendu")

    carre = sujets["Le pèlerin en carré"]["rendu"]
    print(
        f"    2. format verrouillé — fichier rendu {carre.shape[1]}×{carre.shape[0]} "
        f"(carré : {carre.shape[0] == carre.shape[1]}) ; le sujet, plus étroit que haut, "
        f"laisse du vide de chaque côté"
    )

    multiple = sujets["Le pèlerin calé sur 16"]["rendu"]
    print(
        f"    3. calage sur 16 — {multiple.shape[1]}×{multiple.shape[0]} "
        f"(multiples de 16 : {multiple.shape[1] % 16 == 0 and multiple.shape[0] % 16 == 0})"
    )

    masse = sujets["Le garde à la hallebarde"]["rendu"]
    print(f"    4. centré sur la masse — {masse.shape[1]}×{masse.shape[0]}, corps à recentrer à l'écran")

    ligne = sujets["Le pèlerin sur sa ligne"]["rendu"]
    print(f"    5. ligne de pied — {ligne.shape[1]}×{ligne.shape[0]} (ligne 40 posée sur l'image d'origine)")

    moulin = sujets["Le moulin sans détourage"]["rendu"]
    print(
        f"    6. rognage d'un bord uni — {moulin.shape[1]}×{moulin.shape[0]} "
        f"(120×120 d'origine, bord de 14 px retiré)"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › (un pèlerin) › Retoucher › Recadrer")
    print("  → Le garde à la hallebarde : bascule « centrage » et regarde l'image bouger")
    print("  → Le moulin sans détourage : la table ne doit pas être grisée malgré l'opacité")
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
