# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder **`D3` — la galerie, dessinée** au navigateur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8500 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que `D3` a fait

`Galerie.tsx`, `Tuile.tsx`, `Fiche.tsx` et `BarreEtat.tsx` sont passés de
l'ancien châssis chaud et sombre au papier du carnet, sur le dessin de
`docs/pistes-2026-09-04/carnet/Galerie.dc.html`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_verif_d3.py

## Ce qu'il monte

Un projet, un personnage **« Le pèlerin »**, et **douze images** collées à la
main : rien n'est payé, rien ne part au réseau. Six portent une passe de
détourage — elles sont donc *détourées* —, six n'en portent aucune. Une est en
favori, une est réglée à la main, une est marquée *agent*, et deux appartiennent
au pèlerin.

## Ce qu'on vient voir à l'écran

1. **Le fond du produit est du papier**, et la grille est faite de cartes
   `--carte` cerclées de `--trait`, arrondi 5. Aucun panneau sombre.
2. **Derrière chaque image, le gris neutre `--pourtour`** — et le damier de
   14 px **seulement** sur les six détourées. C'est la règle des onze pièces :
   *le damier dit transparent, le gris dit pas encore détouré*.
3. **Une tuile choisie porte un liseré rouille intérieur** — clique-en une, puis
   Ctrl-clique une seconde : deux liserés, aucun décalage dans la grille.
4. **Les pastilles sont des étiquettes de papier** posées sur l'image, pas des
   voiles sombres : *réglé* et *parent supprimé* en encre d'attention, *agent*
   en rouille.
5. **Le pied de la surface est une seule bande**, pas deux : à gauche ce que la
   grille cache, à droite « aucun appel ne part d'ici ».
6. **Le volet de droite** — clique une image : `--papier-cote`, bord `--trait`,
   l'image sur le gris neutre, les blocs repliables en papier, et les deux
   portes du bas en boutons de carnet.
7. **La barre d'état, tout en bas** : trait `--trait`, fond `--papier-cote`, et
   le point vert de `--ok` quand l'atelier répond.

Et le point de comparaison, côte à côte :

    .venv/Scripts/python.exe -m http.server 8933 --directory docs/pistes-2026-09-04/carnet
    → http://127.0.0.1:8933/Galerie.dc.html
"""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8500

COTE = 256


def _sujet(couleur: tuple[int, int, int], chapeau: bool = False) -> bytes:
    """Une silhouette sur un fond **transparent** — le pire cas pour un damier.

    Le fond est transparent parce que c'est là que la distinction se voit : sur
    une image détourée le damier doit paraître, sur une image brute c'est le
    gris neutre qui doit tenir la place. Les deux emploient le même PNG ; seule
    la recette change.
    """
    image = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessin.ellipse([96, 48, 160, 112], fill=(*couleur, 255))
    dessin.rectangle([104, 112, 152, 216], fill=(*couleur, 255))
    if chapeau:
        dessin.rectangle([88, 34, 168, 50], fill=(40, 40, 48, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


# Douze images : le nom qu'elles portent, leur couleur, et si elles sont
# détourées. Le compte est celui d'une planche contact qu'on lit d'un coup
# d'œil — assez pour juger une grille, pas assez pour la faire défiler.
LES_IMAGES = [
    ("l'épée du pèlerin", (0xB8, 0xB0, 0xA3), True),
    ("le sac de voyage", (0x8A, 0x6A, 0x3E), True),
    ("le pèlerin, repos", (0x2F, 0x4A, 0x35), True),
    ("le pèlerin, vers l'est", (0x41, 0x56, 0x3C), True),
    ("le garde, repos", (0x8A, 0x8F, 0x96), True),
    ("le garde, vers l'ouest", (0x9C, 0xA2, 0xA9), True),
    ("la lanterne", (0xE0, 0xA1, 0x3C), False),
    ("le coffre", (0x5A, 0x4A, 0x38), False),
    ("la tourbe", (0x3F, 0x34, 0x28), False),
    ("le moulin", (0x6B, 0x4A, 0x2E), False),
    ("le ciel du marais", (0xC4, 0xC9, 0xCE), False),
    ("la pierre levée", (0x7A, 0x74, 0x6C), False),
]


def peupler(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Vérification D3"}),
            "la création du projet",
        )["projet"]["identifiant"]

        personnage = _exiger(
            client.post("/api/characters", json={"nom": "Le pèlerin"}),
            "la création du pèlerin",
        )["personnage"]["identifiant"]
        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]

        # **Par import, jamais par génération** : rien n'appelle un fournisseur
        # ici, et l'import est la seule porte du produit qui fasse entrer une
        # image sans passer par l'argent.
        identifiants = []
        for rang, (nom, couleur, detouree) in enumerate(LES_IMAGES):
            entre = _exiger(
                client.post(
                    f"/api/assets/upload?nom={rang}.png&projet={projet}",
                    content=_sujet(couleur),
                ),
                f"l'import de « {nom} »",
            )
            asset_id = entre["asset"]["identifiant"]
            # **La recette se pose par la route, pas dans l'objet** : c'est elle
            # qui recalcule le rendu, et une recette écrite à la main laisserait
            # l'asset « traité » sans image traitée — donc une tuile à `0×0`,
            # ce qui n'est pas ce qu'on vient regarder.
            if detouree:
                _exiger(
                    client.put(
                        f"/api/assets/{asset_id}/recipe",
                        json={"passes": [{"moteur": "bord", "tolerance": 28}]},
                    ),
                    f"le détourage de « {nom} »",
                )
            objet = atelier.assets.lire(asset_id)
            objet.label = nom
            # Un favori, un réglé à la main, un venu d'un agent — les trois
            # marques que la tuile sait porter, une par image pour qu'elles ne
            # se recouvrent pas.
            objet.favori = rang == 0
            objet.epingle = rang == 6
            if rang == 7:
                objet.provenance = "agent"
            atelier.assets.sauver(objet)
            identifiants.append(asset_id)

        # Deux images dans les cases du pèlerin : c'est ce qui allume la porte
        # « Reprendre dans l'établi » du volet, et son grisé sur les dix autres.
        for asset_id, pose in zip(identifiants[2:4], poses):
            _exiger(
                client.put(
                    f"/api/assets/{asset_id}/character",
                    json={"personnage": personnage, "pose": pose, "projet": projet},
                ),
                "poser l'image dans sa case",
            )

        return {"projet": projet, "personnage": personnage, "assets": identifiants}


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-verif-d3-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    monte = peupler(atelier)

    detourees = sum(1 for _, _, d in LES_IMAGES if d)
    print()
    print("  Appels payés : 0  (douze images collées à la main, aucun réseau)")
    print(f"  Projet       : Vérification D3 ({monte['projet']})")
    print(f"  Images       : {len(monte['assets'])}, dont {detourees} détourées")
    print("  Marques      : un favori, un réglé à la main, un venu d'un agent")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → le carnet › La galerie")
    print("  → le damier ne paraît que sur les six détourées ; ailleurs, le gris")
    print("  → clique une tuile : liseré rouille intérieur, et le volet s'ouvre")
    print("  → Ctrl-clic sur une seconde : deux liserés, aucun décalage")
    print("  → le pied : une seule bande, la phrase à droite")
    print("  La planche, à côté :")
    print("    python -m http.server 8933 --directory docs/pistes-2026-09-04/carnet")
    print("    http://127.0.0.1:8933/Galerie.dc.html")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
