# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A13 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8439 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    py essais/atelier_jetable_a13.py

## Ce qu'il monte, et pourquoi ce clip-là

Un personnage, et **un vrai clip avec de vraies images sur le disque** — celui
d'`A10`, écrit à la main image par image : dix images où rien ne bouge, puis
douze où un bras se tend et revient. On sait donc exactement ce que porte chaque
image, ce qui est la seule façon de vérifier qu'on a prélevé *celle qu'on
visait* et pas une voisine.

**Rien n'a été payé** : l'animateur est un double qui rend ce clip-là et facture
zéro. La dépense écrite dans le journal est celle d'`A10`, à zéro dollar.

## Ce qu'on vient voir

- **La loupe porte le geste**, et elle ne s'efface plus quand on la quitte. À
  sept pixels de large, une cellule du ruban ne peut pas porter deux gestes
  qu'on puisse viser ; la loupe, elle, montre déjà cette image-là en grand.
- **Prélever ne touche pas au découpage en cours.** Posez une proposition,
  regardez le compte d'images retenues, prélevez, relisez le compte.
- **Ce qui est déjà pris se marque** d'un trait vert en pied de cellule, pour
  qu'on ne redemande pas deux fois la même en glissant le long du clip.
- **Une image déjà prise se signale** au lieu d'être refusée : les mêmes octets,
  deux fois, et c'est l'auteur qui décide.
- **L'image entre en bibliothèque avec la chaîne du jeu appliquée** — allez la
  voir dans la galerie : elle est traitée, sa recette se reprend, et l'image
  brute est toujours là.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé et facture zéro, mais
ce n'est pas ce qu'on vient regarder ici — et le clip qu'il rendrait serait le
même que celui qui est déjà là.
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

from atelier.api.app import creer_application  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402
from test_a10 import clip_connu  # noqa: E402 — le clip écrit à la main

PORT = 8439
MODELE = "essai:rend-du-png"


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def peupler(atelier: Atelier, double: FournisseurDouble, animateur) -> tuple[str, str]:
    """Un personnage, une image de départ, et un clip arrivé avec ses images."""
    with TestClient(creer_application(atelier)) as client:
        personnage = client.post(
            "/api/characters",
            json={
                "nom": "Le nain",
                "description": "un forgeron nain à la barbe tressée",
            },
        ).json()["personnage"]["identifiant"]

        double.rendre = lambda: image_sujet(bloc=4, toile=24)
        faite = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "le nain, de profil",
                "personnage": personnage,
                "pose": "marche",
                "echelle": "personnage",
            },
        )
        _attendre(client, faite.json()["identifiant"])
        double.rendre = None
        sprite = f"{faite.json()['identifiant']}-0"

        animateur.octets = clip_connu()
        animateur.facture = 0.0
        lot = client.post(
            "/api/clips",
            json={
                "modele": MELE.identifiant,
                "mouvement": "marche",
                "asset": sprite,
            },
        ).json()["clips"]
        clip = lot[0]["identifiant"]
        for _ in range(600):
            arrives = client.get("/api/clips").json()["clips"]
            if arrives and arrives[0]["statut"] in ("reussie", "echouee"):
                break
            client.get("/api/status")
        return personnage, clip


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à prélever.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a13-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    personnage, clip = peupler(atelier, double, animateur)

    with TestClient(creer_application(atelier)) as client:
        montage = client.get(f"/api/montage/{clip}").json()

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print(f"  Ses images    : {montage['clip']['images']}")
    print(f"  Sa cadence    : {montage['clip']['cadence']} par seconde")
    print(f"  Sa recette    : cible {montage['recette_du_jeu']['grille']['cible']} px")
    print()
    print("  Ce que porte le clip, image par image :")
    print("    0 à 9   — rien ne bouge")
    print("    10 à 21 — un bras se tend puis revient")
    print()
    print("  À cliquer :")
    print("    Galerie › la tuile du clip › « Découper › »")
    print("    — survolez le ruban : la loupe suit, et elle **reste** quand on la quitte")
    print("    — « Mettre de côté › » sous la loupe : l'image entre en bibliothèque")
    print("    — reprenez-en une autre : le trait vert marque celles déjà prises")
    print("    — reprenez la même : elle est signalée, pas refusée")
    print("    — puis Galerie, sans filtre : les images prélevées y sont, traitées")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
