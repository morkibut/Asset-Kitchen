# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder **`D4` — les outils de la galerie** au navigateur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8501 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que `D4` a fait

`Arbre.tsx`, `BarreOutils.tsx`, `Depliage.tsx` et `FicheDuClip.tsx` passent de
l'ancien châssis chaud et sombre au papier du carnet — sans planche : aucune
d'elles n'est dessinée par `Galerie.dc.html` (`D3`), qui ne couvre que la
grille, la tuile, la fiche et le pied. `Import.tsx` les accompagne, dessiné sur
la lecture la plus simple à vérifier, faute de planche connue. La colonne de
l'arbre passe de 240 à 300 px — la largeur du « carnet » de `docs/DESIGN.md`
§ Largeurs de colonne. La coque autour de la galerie (`App.tsx`) passe de
`--fond-0` à `--papier`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_verif_d4.py

## Ce qu'il monte

Deux projets — celui qui s'ouvre, et un second pour voir l'arbre porter deux
lignes — chacun avec une collection, un projet « Sans projet » qui reçoit une
image détachée, et huit images collées à la main (quatre détourées, quatre
non) : rien n'est payé, rien ne part au réseau.

## Ce qu'on vient voir à l'écran

1. **L'arbre, à gauche : 300 px de papier.** `--papier-cote`, bord `--trait`
   à droite, les rangées « Projets » et « Collections » en `--encre-4`
   uppercase mono, la ligne ouverte en liseré rouille (`--signal`) sur
   `--carte`. Plus rien de sombre dans cette colonne.
2. **La barre d'outils, juste au-dessus de la grille : même papier.** Le champ
   « Chercher », le filtre de famille et « Favoris » sur `--carte`/`--trait` ;
   sélectionne une image ou deux (clic, puis Ctrl-clic) pour voir apparaître
   « sélectionné », le menu « Ranger… », Favori et Supprimer, tous en encre —
   aucun fond sombre ne doit paraître même là.
3. **Importer, à droite de la barre.** Clique « Importer » et choisis un
   fichier qui n'est pas une image (par exemple ce script lui-même) : le
   bandeau de refus apparaît sous la barre, sur `--papier-cote`, texte
   `--echec`. Réimporte une image déjà entrée : le bandeau de doublon paraît
   en `--encre-attention`, avec « La voir › » et « Importer quand même › » en
   rouille.
4. **La galerie entière est cohérente** : grille, arbre et barre d'outils sur
   le même papier, sans plus aucun rectangle presque-noir visible sur cet
   écran — c'est le fond d'`App.tsx` qui a changé, à la coque autour de tout.
5. **La fiche d'une image** (clique une tuile) reste celle de `D3` — inchangée
   ici.

`Depliage.tsx` (l'écran « Ce que la planche a rendu ») ne se déclenche
qu'après une génération réelle dont le compte de sujets ne tombe pas juste ;
il n'est pas peuplé par ce script — sa lecture est vérifiée par
`interface/src/App.test.tsx`, qui monte l'écran directement.

Et le point de comparaison des mots du vocabulaire papier, à côté :

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

PORT = 8501

COTE = 256


def _sujet(couleur: tuple[int, int, int]) -> bytes:
    """Une silhouette sur un fond transparent — même recette que `D3`."""
    image = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessin.ellipse([96, 48, 160, 112], fill=(*couleur, 255))
    dessin.rectangle([104, 112, 152, 216], fill=(*couleur, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


# Huit images : quatre détourées, quatre non — assez pour juger la grille
# derrière l'arbre et la barre, pas assez pour la faire défiler.
LES_IMAGES = [
    ("l'épée du pèlerin", (0xB8, 0xB0, 0xA3), True),
    ("le sac de voyage", (0x8A, 0x6A, 0x3E), True),
    ("le pèlerin, repos", (0x2F, 0x4A, 0x35), True),
    ("le garde, repos", (0x8A, 0x8F, 0x96), True),
    ("la lanterne", (0xE0, 0xA1, 0x3C), False),
    ("le coffre", (0x5A, 0x4A, 0x38), False),
    ("la tourbe", (0x3F, 0x34, 0x28), False),
    ("le moulin", (0x6B, 0x4A, 0x2E), False),
]


def peupler(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        premier = _exiger(
            client.post("/api/projects", json={"nom": "Vérification D4"}),
            "la création du premier projet",
        )["projet"]["identifiant"]
        second = _exiger(
            client.post("/api/projects", json={"nom": "Un second jeu"}),
            "la création du second projet",
        )["projet"]["identifiant"]

        collection = _exiger(
            client.post(
                "/api/collections", json={"nom": "À montrer", "projet": premier}
            ),
            "la création de la collection",
        )["collection"]["identifiant"]

        identifiants = []
        for rang, (nom, couleur, detouree) in enumerate(LES_IMAGES):
            entre = _exiger(
                client.post(
                    f"/api/assets/upload?nom={rang}.png&projet={premier}",
                    content=_sujet(couleur),
                ),
                f"l'import de « {nom} »",
            )
            asset_id = entre["asset"]["identifiant"]
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
            atelier.assets.sauver(objet)
            identifiants.append(asset_id)

        # Une image rangée dans la collection : de quoi voir le compte de
        # « À montrer » passer de 0 à 1 dans l'arbre.
        _exiger(
            client.put(
                f"/api/collections/{collection}/members",
                json={"jeu": premier, "sujet": identifiants[0]},
            ),
            "ranger la première image dans la collection",
        )

        # Une image dans le second projet, pour que l'arbre porte deux lignes
        # sous « Projets » et non une seule.
        _exiger(
            client.post(
                f"/api/assets/upload?nom=second.png&projet={second}",
                content=_sujet((0x4A, 0x5A, 0x6A)),
            ),
            "l'import dans le second projet",
        )

        # Créer le second projet l'a ouvert à la place du premier (US-5) : on
        # revient sur le premier, celui qu'on regarde à l'écran.
        _exiger(
            client.put("/api/projects/current", json={"projet": premier}),
            "rouvrir le premier projet",
        )

        return {
            "premier": premier,
            "second": second,
            "collection": collection,
            "assets": identifiants,
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-verif-d4-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    monte = peupler(atelier)

    detourees = sum(1 for _, _, d in LES_IMAGES if d)
    print()
    print("  Appels payés : 0  (huit images collées à la main, aucun réseau)")
    print(f"  Projets      : « Vérification D4 » ({monte['premier']}) et « Un second jeu »")
    print(f"  Collection   : « À montrer », une image dedans")
    print(f"  Images       : {len(monte['assets'])} dans le premier projet, dont {detourees} détourées")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → le carnet › La galerie")
    print("  → l'arbre à gauche : 300 px, papier, deux projets, une collection à 1")
    print("  → la barre d'outils : Chercher / famille / Favoris sur du papier")
    print("  → sélectionne une tuile ou deux : Ranger…, Favori, Supprimer paraissent")
    print("  → Importer : choisis un fichier non-image pour voir le refus,")
    print("    réimporte la même image pour voir le doublon")
    print("  → plus aucun fond presque-noir sur toute cette surface")
    print("  Le vocabulaire du papier, à côté :")
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
