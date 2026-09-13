# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier `AU19` au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la séance.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8423, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **deux feuilles de sprites** dans la bibliothèque, parce que la tranche
a deux cas et qu'un seul ne prouverait rien :

- *la marche du champignon* — une seule ligne de huit cases, le cas de l'auteur :
  le bouton doit proposer **une animation de huit images**, et rien de plus ;
- *les quatre directions* — quatre lignes de quatre cases, le cas courant de ce
  jeu-ci : la case *une animation par ligne* doit paraître dès qu'on passe en
  grille fixe à quatre lignes, et nommer les directions du jeu dans l'ordre.

Les deux portent **un fond transparent**, et c'est ce qu'on regarde à l'arrivée :
c'est ce que le détour par une vidéo faisait perdre.

    py essais/atelier_jetable_au19.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8423

#: La case d'une feuille, en pixels d'écran. Assez grande pour qu'on voie ce
#: qu'on découpe sans zoomer.
CASE = 64

#: Un corps par direction, pour qu'une ligne ne ressemble pas à l'autre.
CORPS = ((196, 74, 52), (58, 92, 140), (120, 168, 92), (232, 214, 160))


def feuille(colonnes: int, lignes: int) -> bytes:
    """Une feuille de sprites **au fond transparent**, une silhouette par case.

    La silhouette se déplace d'une case à l'autre : c'est ce qui rend l'ordre
    des images visible à l'œil une fois l'animation montée — si elle part à
    l'envers, ça se voit.
    """
    image = Image.new("RGBA", (CASE * colonnes, CASE * lignes), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    for ligne in range(lignes):
        teinte = CORPS[ligne % len(CORPS)]
        for colonne in range(colonnes):
            x, y = colonne * CASE, ligne * CASE
            # Le chapeau, puis le pied : une silhouette de champignon, dont le
            # pied avance d'une case à l'autre.
            dessin.ellipse(
                [x + 12, y + 14, x + CASE - 12, y + 36], fill=(*teinte, 255)
            )
            pas = 6 - (colonne % 4) * 4
            dessin.rectangle(
                [x + 26 + pas, y + 34, x + 38 + pas, y + CASE - 12],
                fill=(232, 226, 208, 255),
            )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def peupler(atelier) -> None:
    """Les deux feuilles, posées **par les vraies routes HTTP**.

    Par les routes et pas par les services : ce qu'on vérifie ensuite à l'écran
    passe par elles, et un atelier peuplé autrement ne prouverait rien de ce que
    l'écran recevra.
    """
    with TestClient(creer_application(atelier)) as client:
        # Une vue de dessus, pour que le jeu ait quatre directions — sans elles,
        # la case « une animation par ligne » n'aurait rien à proposer.
        client.put("/api/universe", json={"vue": "vue-dessus-34"})
        directions = client.get("/api/characters/directions").json()["directions"]
        print(f"  directions du jeu : {', '.join(d['nom'] for d in directions)}")

        for nom, colonnes, lignes in (
            ("marche-du-champignon.png", 8, 1),
            ("marche-quatre-directions.png", 4, 4),
        ):
            recu = client.post(
                "/api/assets/upload",
                content=feuille(colonnes, lignes),
                params={"nom": nom, "traiter": "false"},
            )
            assert recu.status_code == 201, recu.text
            asset = recu.json()["asset"]
            print(
                f"  « {asset['label']} » posée — {asset['largeur']}×{asset['hauteur']} px, "
                f"{colonnes} colonnes sur {lignes} ligne(s)"
            )


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-au19-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    print("  → Galerie, ouvrir une feuille, table « Découpe », grille fixe,")
    print("    puis « En faire une animation ».")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
