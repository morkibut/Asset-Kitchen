# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier M7 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8429, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte les deux bouts de la tranche :

- un **détourage de départ déjà posé** sur la nature *image seule*, pour que
  l'étape des réglages montre une ligne pleine à côté de lignes vides ;
- une **image de personnage détourée**, avec sa passe, qui est ce qu'on ira
  promouvoir depuis sa table.

De quoi cliquer sur ce que la tranche livre :

- **Univers › réglages › Le détourage de départ** : la ligne *image seule* porte
  **quatre réglages** — le moteur, la tolérance, le seuil de transparence, le
  bord rongé — au lieu de deux. Les lignes vides disent *choisis un moteur pour
  régler la tolérance, le seuil et le bord rongé*, au lieu de ne rien dire ;
- sous le tableau, la décision qui avait caché deux de ces réglages est réécrite
  **avec le comptage refait** ;
- **Codex › le nain › son image › table détourage** : le lien *enregistrer ce
  réglage comme défaut du projet ›* ouvre le choix de la portée — pour une image
  seule, ou pour tout ce qu'on range dans les personnages —, dit qu'aucune image
  déjà faite n'est retouchée, et écrit le défaut. Revenir à l'étape des réglages
  montre la ligne remplie.

    py essais/atelier_jetable_m7.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Aucun appel, aucun centime** : le fournisseur est doublé, et de toute façon
promouvoir un réglage n'appelle personne.
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

PORT = 8429
MODELE = "essai:rend-du-png"

# Le détourage qu'on promeut depuis l'image — reconnaissable à ses nombres :
# aucun d'eux n'est celui que le produit pose de lui-même.
PASSE = {
    "moteur": "bord",
    "tolerance": 55,
    "seuil_alpha": 200,
    "durcissement": 3,
    "point": None,
    "portee": "tache",
    "masquee": False,
    "trace": [],
    "modele": "",
}


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict[str, object]:
    """Un jeu réglé à moitié, et une image de personnage déjà détourée."""
    with TestClient(creer_application(atelier)) as client:
        client.put(
            "/api/universe",
            json={
                "bible": [
                    {"nom": "monde", "texte": "marais de fer", "actif": True},
                ],
                # **Un seul des quatre réglages posés**, sur une seule des deux
                # natures : l'étape doit montrer une ligne pleine au-dessus de
                # lignes vides, sans quoi on ne verrait pas la différence entre
                # les deux phrases.
                "detourage_image": {
                    "moteur": "modele",
                    "tolerance": 28,
                    "seuil_alpha": 128,
                    "durcissement": 2,
                    "modele": "",
                },
            },
        )

        plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        pose = plan[0]
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le nain", "description": "un forgeron nain"},
        ).json()["personnage"]["identifiant"]
        client.put(f"/api/characters/{personnage}", json={"poses": [pose]})

        double.rendre = lambda: image_sujet(bloc=4, toile=24)
        faite = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "le nain, au repos",
                "personnage": personnage,
                "pose": pose,
                # C'est elle qui nomme la famille du sujet, et donc la seconde
                # portée que le geste proposera.
                "echelle": "personnage",
            },
        )
        _attendre(client, faite.json()["identifiant"])
        double.rendre = None

        # **L'image se relit dans la bibliothèque, pas dans la génération** :
        # l'emplacement dit ce qui est arrivé du modèle, l'asset est ce que
        # l'atelier en a rangé, et c'est lui qu'on veut détourer.
        image = client.get("/api/assets").json()["assets"][0]["identifiant"]
        # La route reçoit la recette telle quelle, sans enveloppe : une image
        # qui vient d'arriver n'a rien d'autre à garder que ses passes.
        client.put(f"/api/assets/{image}/recipe", json={"passes": [PASSE]})
        impose = client.get(f"/api/assets/{image}/imposed").json()
        return {
            "personnage": personnage,
            "image": image,
            "nature": impose.get("nature"),
            "famille": (impose.get("detourage") or {}).get("famille"),
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-m7-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    montage = peupler(atelier, double)

    print()
    print(f"  L'image à promouvoir : {montage['image']}")
    print(f"    sa nature          : {montage['nature']}")
    print(f"    sa famille         : {montage['famille'] or '(aucune)'}")
    print("    son détourage      : bord · tolérance 55 · seuil 200 · 3 px rongés")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
