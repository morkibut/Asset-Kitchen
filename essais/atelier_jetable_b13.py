# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B13 — la grille du jeu, et
comparer**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8480 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b13.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

**Le Marais**, une case de jeu de 64 px, et **deux sujets du même type**
(« personnage », occupation de barème 100 %) — pour que l'écart entre eux
vienne des images, pas du barème :

| Le sujet | Sa recette (`PUT /assets/{id}/recipe`) | Ce que ça montre |
|---|---|---|
| **Le pèlerin** | occupation 100 %, 16 couleurs, aucun contour | tient dans sa case, sert de référence |
| **Le garde** | occupation 140 %, 32 couleurs, un contour noir de 2 px | **dépasse sa case** (rendu réel : 94×94 px, relu au lancement — voir plus bas), **couleurs hors norme** (32 > les 16 du projet), **un contour que le pèlerin n'a pas** |

**Le détourage compte, même sommaire.** `occupation` ne joue que si la recette
porte au moins une passe de détourage non endormie (`sur_grille()`,
`atelier/image/traitement.py:1746` — sans passe, `case=False`, simple
homothétie qui ignore `occupation` ; avec une passe, `case=True`, recadrage sur
la boîte opaque puis `cote_du_sujet`/`cote_du_canevas`). Chaque recette de ce
script porte donc une passe `bord` minimale, même pour le pèlerin dont
l'occupation reste à 100 %.

Les trois écarts sont donc au rendez-vous en même temps, sur le même
sujet-témoin — pas besoin d'un troisième personnage pour voir les trois cartes
de correction de `Comparer.tsx`.

**Aucun chiffre n'est deviné ici** : la taille réelle rendue (`rendu_largeur`,
`rendu_hauteur`) est celle que le serveur calcule et qu'on relit après coup —
voir le résumé imprimé au lancement.

**Rien n'a été payé** : les deux images arrivent par `/assets/import`, jamais
par une route de génération.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin** ouvre sa page. Le bandeau d'onglets
   porte deux liens neufs : **« Voir la grille du jeu »** et **« Comparer › »**.
2. **La grille du jeu** : le pèlerin posé sur une case de 64 px, zoomé ×2 par
   défaut. Le panneau de droite montre son type, son occupation (100 %), la
   case du jeu (64 px), et **le plafond réel d'occupation : 800 %** (le métier
   gagne sur la toile, ici) — avec l'explication qui change si on ouvre un jeu
   à `cible_px` plus grand. Cliquer un chip de voisin (« meuble · 66 % », etc.)
   le fait apparaître dans la scène, à sa vraie taille relative.
3. **Comparer ›** depuis la grille, ou directement depuis la page : le pèlerin
   contre le garde, même pose, même zoom. Les quatre écarts chiffrés
   (hauteur, largeur, contour, couleurs) sont ceux du tableau ci-dessus — la
   hauteur et les couleurs du garde sont en rouge, avec leur carte de
   correction : « La retoucher » pour la hauteur (ouvre la case du garde,
   comme le reste du produit), le dernier coût réel pour le contour et les
   couleurs (ici *gratuite*, l'image vient d'un import).
4. Choisir **« — ses images »** dans le sélecteur « Comparer avec » : bascule
   sur *Le même, deux fois* — un seul sujet n'a qu'une image ici, donc les deux
   sélecteurs d'image retombent tous les deux dessus. (Pour voir deux images
   distinctes, importer une seconde image sur le même sujet avant d'ouvrir cet
   écran.)
5. Le zoom (×1, ×2, ×4, ×8), le bouton Fond neutre / Fond du jeu, Alignés au
   sol / Superposés : aucun n'appelle le serveur — vérifiable par l'onglet
   réseau du navigateur, vide pendant la manipulation.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée un jeu et deux sujets. Le dossier temporaire
est imprimé à chaque lancement ; c'est lui qu'on efface après.
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

# Le double des essais, **importé et pas recopié** — même raison qu'en B9/B10 :
# deux doubles qui divergeraient finiraient par ne plus décrire le produit.
from conftest import image_sujet  # noqa: E402

PORT = 8480


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _poser_et_traiter(
    client,
    gabarit: Path,
    personnage: str,
    pose: str,
    *,
    occupation: int,
    couleurs: int,
    contour: str | None,
) -> dict:
    """Importer une image, la ranger dans sa case, puis lui poser une vraie
    recette — c'est cette dernière étape qui calcule `rendu_largeur` et
    `rendu_hauteur` (une recette vide laisse les deux à 0)."""
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} / {pose} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": pose},
        ),
        f"la case « {pose} » de « {personnage} »",
    )
    charge_recette: dict = {
        # **Un détourage vif est nécessaire pour que `occupation` compte.**
        # `sur_grille()` (`atelier/image/traitement.py:1746`) a deux chemins :
        # `case=False` (aucune passe vive) fait une simple homothétie et ignore
        # `occupation` ; `case=True` (au moins une passe non endormie) recadre
        # sur la boîte opaque puis applique `cote_du_sujet`/`cote_du_canevas` —
        # c'est ce second chemin qui rend la case réellement dépassée.
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        "grille": {"cible": 64, "occupation": occupation, "ancrage": "bas", "methode": "proche"},
        "quantification": {"couleurs": couleurs, "palette": [], "tramage": "aucun"},
    }
    if contour is not None:
        charge_recette["contours"] = {"epaisseur": 2, "couleur": contour}
    asset = _exiger(
        client.put(f"/api/assets/{identifiant}/recipe", json=charge_recette),
        f"la recette de « {personnage} / {pose} »",
    )
    _exiger(
        client.put("/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}),
        f"la retenue de « {personnage} / {pose} »",
    )
    return asset


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais"}),
            "le projet « Le Marais »",
        )["projet"]["identifiant"]

        # Une case de jeu de 64 px, un compte de couleurs serré à 16 — c'est
        # contre ce chiffre-ci que « les couleurs du garde » se lira hors
        # norme (32 > 16).
        _exiger(
            client.put(
                "/api/universe",
                json={"style": "pixel", "cible_px": 64, "methode_pixels": "proche", "couleurs": 16, "fond": "#2d5a3d"},
            ),
            "les réglages de l'univers",
        )

        gabarit_pelerin = dossier / "pelerin.png"
        gabarit_pelerin.write_bytes(image_sujet(toile=32, bloc=2, logique_l=6, logique_h=12))
        gabarit_garde = dossier / "garde.png"
        gabarit_garde.write_bytes(image_sujet(toile=32, bloc=2, logique_l=7, logique_h=14))

        pelerin = _exiger(
            client.post(
                "/api/characters",
                json={"nom": "Le pèlerin", "description": "", "type": "personnage"},
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]
        garde = _exiger(
            client.post(
                "/api/characters",
                json={"nom": "Le garde", "description": "", "type": "personnage"},
            ),
            "la création du garde",
        )["personnage"]["identifiant"]

        poses_du_plan = [
            p["identifiant"] for p in client.get("/api/characters").json()["plan"]
        ]
        pose = poses_du_plan[0]

        asset_pelerin = _poser_et_traiter(
            client, gabarit_pelerin, pelerin, pose,
            occupation=100, couleurs=16, contour=None,
        )
        asset_garde = _poser_et_traiter(
            client, gabarit_garde, garde, pose,
            occupation=140, couleurs=32, contour="#1a1a1a",
        )

        # Relu depuis le serveur — jamais deviné : c'est ce que l'écran
        # recevra vraiment.
        charge = _exiger(client.get("/api/characters"), "la liste des sujets")
        univers = _exiger(client.get("/api/universe"), "l'univers")
        return {
            "projet": projet,
            "pelerin": pelerin,
            "garde": garde,
            "asset_pelerin": asset_pelerin,
            "asset_garde": asset_garde,
            "personnages": charge["personnages"],
            "univers": univers["univers"],
        }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et
    # des flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b13-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print(f"  Case du jeu : {monte['univers']['cible_px']} px  ·  couleurs du projet : {monte['univers']['couleurs']}")
    print()
    print("  Ce que le serveur a vraiment rendu, sujet par sujet :")
    ap, ag = monte["asset_pelerin"], monte["asset_garde"]
    print(
        f"    · Le pèlerin — {ap['rendu_largeur']}×{ap['rendu_hauteur']} px, "
        f"{ap['recette']['quantification']['couleurs']} couleurs, "
        f"contour : {ap['recette']['contours']}"
    )
    print(
        f"    · Le garde   — {ag['rendu_largeur']}×{ag['rendu_hauteur']} px, "
        f"{ag['recette']['quantification']['couleurs']} couleurs, "
        f"contour : {ag['recette']['contours']['couleur'] if ag['recette']['contours'] else None}"
    )
    depasse = ag["rendu_hauteur"] > monte["univers"]["cible_px"]
    print()
    print(
        f"    → le garde dépasse sa case ({ag['rendu_hauteur']} > {monte['univers']['cible_px']}) : "
        f"{'oui' if depasse else 'NON — ajuster `occupation` dans ce script'}"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin : sa page, bandeau d'onglets")
    print("  → « Voir la grille du jeu » : le pèlerin sur sa case, les voisins par type")
    print("  → « Comparer › » : le pèlerin contre le garde, les écarts et leur correction")
    print("  → « Comparer avec » › « — ses images » : bascule sur les images d'un même sujet")
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
