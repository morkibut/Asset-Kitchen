# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier M5 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8428, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **le cas exact que la tranche répare** : un jeu qui a une bible à dire —
donc des lignes qu'on peut éteindre et réécrire dans la fenêtre *ce qui part* —
et une petite bibliothèque d'images déjà faites, qui sont ce qu'on ira joindre.

De quoi cliquer sur ce que la tranche livre :

- écrire un sujet, puis **Générer** ouvre la fenêtre *ce qui part* ;
- éteindre la ligne **monde**, cliquer *corriger* sur **sujet** et réécrire le
  texte : deux écarts, l'un qui retire, l'autre qui remplace ;
- **① sortir et revenir.** *Revenir sans rien dépenser*, puis **Générer** de
  nouveau : la ligne monde est **encore éteinte**, le sujet **encore réécrit**.
  Avant la tranche, tout était effacé sans un mot ;
- changer le sujet dans le champ, puis **Générer** : là, et là seulement, le tri
  repart de rien — c'est l'autre moitié de la règle, et elle tient toujours ;
- **② ajouter une référence.** Dans la section *les images jointes*, le geste
  *ajouter une référence ›* pose la grille du produit par-dessus. Choisir une
  image la joint, la fenêtre **ne se referme pas**, et rien de ce qu'on venait
  de corriger n'a bougé ;
- **Échap** referme la grille et **elle seule** ; une seconde pression revient au
  prompt.

    py essais/atelier_jetable_m5.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Aucun appel, aucun centime** : le fournisseur est doublé, et de toute façon
choisir une image de référence n'appelle personne.
"""

from __future__ import annotations

import sys
import tempfile
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

PORT = 8428
MODELE = "essai:rend-du-png"

# Ce qu'on trouvera dans la grille quand on ira chercher l'image qui manque. Des
# sujets qui ne se ressemblent pas : on doit pouvoir dire, en regardant la liste
# des images jointes, **laquelle** on vient d'ajouter.
SUJETS = [
    ("un tonneau de chêne cerclé de fer", 4),
    ("une lanterne de fer forgé", 3),
    ("un bouclier rond peint", 5),
    ("une bourse de cuir", 2),
]


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def peupler(atelier: Atelier, double: FournisseurDouble) -> list[str]:
    """Un jeu qui a quelque chose à dire, et quatre images déjà faites."""
    with TestClient(creer_application(atelier)) as client:
        client.put(
            "/api/universe",
            json={
                "bible": [
                    {"nom": "monde", "texte": "marais de fer", "actif": True},
                    {
                        "nom": "style",
                        "texte": "peinture à l'huile sombre, contours nets",
                        "actif": True,
                    },
                ]
            },
        )

        faites: list[str] = []
        for sujet, bloc in SUJETS:
            double.rendre = lambda bloc=bloc: image_sujet(bloc=bloc, toile=24)
            faite = client.post(
                "/api/generations", json={"modele": MODELE, "prompt": sujet}
            )
            generation = _attendre(client, faite.json()["identifiant"])
            faites.extend(
                emplacement["asset"]
                for emplacement in generation["emplacements"]
                if emplacement.get("asset")
            )
        double.rendre = None
        return faites


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-m5-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    images = peupler(atelier, double)

    print()
    print(f"  {len(images)} images dans la bibliothèque, à joindre depuis la fenêtre :")
    for (sujet, _), identifiant in zip(SUJETS, images):
        print(f"    {identifiant}  —  {sujet}")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
