# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer les six capacités neuves de **Contour** (B18).

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8494 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_contour.py

`sans-servir` en argument peuple, mesure et imprime le résumé sans lancer
uvicorn.

## Ce qu'il monte

**Le Marais du Vieux Moulin**, une case de 64 px, 24 couleurs, et quatre
sujets qui partent tous de la même image du pèlerin — sauf la tuile, peinte à
part parce que son seul intérêt est de toucher les quatre bords.

| Le sujet | Sa recette | Ce qu'on vient voir |
|---|---|---|
| **Le pèlerin, sans trait** | rien sur `contours` | le témoin |
| **Le pèlerin, couleur dérivée** | `derivee` | le trait change de teinte selon la matière du bord |
| **Le pèlerin, place réservée** | `reserver`, épaisseur 3 | le fichier reste à 64×64 malgré l'épaisseur |
| **Le pèlerin, trait inégal** | `inegal` | fin en haut, plein en bas, rien sous les pieds |
| **La tuile d'herbe** | rien (le garde-fou est actif par défaut) | pas de trait — elle touche les quatre bords |

**Rien n'a été payé** : les images arrivent par `/assets/import`, jamais par
une route de génération. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin, sans trait › Retoucher › Le contour.**
   Cocher « couleur dérivée » doit changer la teinte du trait sans toucher aux
   pastilles de couleur au-dessus. Cocher « réserver la place » doit empêcher
   le cadre de grandir même à une grosse épaisseur — comparer avec le sujet
   « place réservée », qui l'a déjà. Cocher « trait inégal » doit montrer un
   trait qui s'éclaircit vers le haut.
2. **La même table, en haut à droite : Damier / Herbe / Pierre / Eau.**
   Cliquer « Herbe » doit remplacer le damier de transparence par un vert uni
   *derrière* l'image — pas une nouvelle image demandée au serveur, un simple
   changement de fond. Rouvrir une autre table (Détourage, Couleurs…) doit
   faire disparaître ces quatre boutons : ils n'existent que pour juger un
   trait.
3. **La tuile d'herbe › Retoucher › Le contour.** Cocher un réglage n'importe
   lequel ne doit rien montrer tant que « s'éteindre sur une tuile » reste
   coché — c'est le point. Le décocher doit faire apparaître un quadrillage
   sombre : la table trace alors chaque bord, y compris ceux qui touchent le
   cadre.
4. **« sur l'ensemble empilé »** se coche et s'envoie au serveur comme les
   autres — mais son effet ne se voit pas encore ici : aucune pièce
   d'équipement n'est montée dans cet atelier jetable, et sans un second
   calque à composer, `sur_calques` retombe sur le rendu ordinaire. C'est un
   écart documenté, pas un bug : voir `docs/PLAN-carnet.md` § B18.
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

PORT = 8494


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _tuile_herbe(cote: int = 64) -> bytes:
    """Une tuile qui remplit son carré, avec une texture — pas un aplat pur.

    **Opaque sur les quatre bords, mais pas entièrement opaque** : quelques
    brins plus sombres, en damier fin, pour que le garde-fou « plein cadre »
    de B18 se distingue du garde-fou plus ancien « entièrement opaque ».

    **Portée en RGBA, et servie sans passe de détourage** : une tuile n'a pas
    de fond à retirer, elle est son propre sujet du premier au dernier pixel.
    La bordure reste opaque à 100 % ; seuls des brins de texture, loin d'elle,
    sont troués.
    """
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, :3] = (74, 92, 58)
    rgba[:, :, 3] = 255
    rgba[8::6, 8::6] = (55, 69, 42, 0)  # la texture, loin des quatre bords
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _recette(**contours) -> dict:
    """La chaîne ordinaire, plus un contour **seulement si `contours` en porte**.

    Le témoin sans argument ne pose donc aucune place `contours` — éteinte au
    départ, comme le veut la table (« elle est éteinte au départ », voir la
    planche) — au lieu d'un contour à l'épaisseur minimale que personne n'a
    demandé.
    """
    charge: dict = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        "grille": {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": "proche"},
        "quantification": {"couleurs": 24, "palette": [], "tramage": "aucun"},
    }
    if contours:
        charge["contours"] = {
            "epaisseur": 1,
            "couleur": "#000000",
            "position": "externe",
            "trous": "cercles",
            **contours,
        }
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
                    "couleurs": 24,
                    "fond": "#FF00FF",
                },
            ),
            "les réglages de l'univers",
        )

        pelerin = dossier / "pelerin.png"
        pelerin.write_bytes(image_sujet(toile=48, bloc=3, logique_l=8, logique_h=14))
        tuile = dossier / "tuile-herbe.png"
        tuile.write_bytes(_tuile_herbe())

        sujets: dict[str, dict] = {}
        for nom, gabarit, charge in (
            ("Le pèlerin, sans trait", pelerin, _recette()),
            ("Le pèlerin, couleur dérivée", pelerin, _recette(derivee=True)),
            (
                "Le pèlerin, place réservée",
                pelerin,
                _recette(epaisseur=3, reserver=True),
            ),
            ("Le pèlerin, trait inégal", pelerin, _recette(epaisseur=2, inegal=True)),
        ):
            personnage = _exiger(
                client.post(
                    "/api/characters",
                    json={"nom": nom, "description": "", "type": "personnage"},
                ),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            asset = _poser(client, gabarit, personnage, charge)
            sujets[nom] = {"personnage": personnage, "asset": asset}

        # La tuile n'a pas de contour posé : le garde-fou de B18 est actif par
        # défaut (`desactive_plein_cadre=True`), donc rien à envoyer ici.
        tuile_perso = _exiger(
            client.post(
                "/api/characters",
                json={"nom": "La tuile d'herbe", "description": "", "type": "personnage"},
            ),
            "la création de « La tuile d'herbe »",
        )["personnage"]["identifiant"]
        asset_tuile = _poser(
            client,
            tuile,
            tuile_perso,
            {
                # **Aucune passe de détourage** : la tuile porte déjà son
                # alpha (bordure opaque, texture trouée au centre), et un
                # moteur de bord n'aurait rien à retirer — sa bordure, à lui,
                # *est* le sujet.
                "passes": [],
                "grille": {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": "proche"},
                "contours": {"epaisseur": 1, "couleur": "#000000", "position": "externe",
                             "trous": "cercles"},
            },
        )
        sujets["La tuile d'herbe"] = {"personnage": tuile_perso, "asset": asset_tuile}

        return {"projet": projet, "sujets": sujets}


def principal(sans_servir: bool = False) -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-contour-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s  ·  case du jeu 64 px  ·  24 couleurs")
    print()
    for nom, sujet in sujets.items():
        asset = sujet["asset"]
        print(
            f"    · {nom:<32} rendu {asset['rendu_largeur']}×{asset['rendu_hauteur']} px"
        )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin, sans trait › Retoucher › Le contour")
    print("    · cocher couleur dérivée / réserver la place / trait inégal, un par un")
    print("    · en haut à droite : Damier / Herbe / Pierre / Eau — change le fond, pas l'image")
    print("  → La tuile d'herbe › Retoucher › Le contour")
    print("    · aucun trait tant que « s'éteindre sur une tuile » reste coché")
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
