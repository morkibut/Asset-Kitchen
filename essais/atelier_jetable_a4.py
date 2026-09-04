# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A4 au navigateur, et **une vraie archive à ouvrir**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8440 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    py essais/atelier_jetable_a4.py

## Ce qu'il monte

Un personnage, un vrai clip — celui d'`A10`, écrit à la main image par image —,
et **deux animations taillées dedans** : une marche en boucle, et un balancement
en aller-retour. Les deux sont rangées dans une attitude du personnage, de sorte
que les deux sorties du produit soient cliquables tout de suite.

**Rien n'a été payé** : l'animateur est un double qui rend ce clip-là et facture
zéro.

## Ce qu'il fabrique avant même d'ouvrir

Il appelle lui-même la sortie du personnage et **dépose l'archive dépliée dans
le dossier jetable**, puis affiche le chemin. C'est ce qu'il y a de plus utile à
regarder : les trois fichiers d'une animation, le descriptif, et une image
animée qu'on ouvre d'un double-clic — sans installer un moteur de jeu.

## Ce qu'on vient voir à l'écran

- **La sortie d'une animation, sur sa ligne**, dans l'écran de montage :
  Galerie › la tuile du clip › « Découper › » › la liste « gardées de ce clip ».
  Le fichier se pose dans les téléchargements, et le clip reste ouvert.
- **La sortie de tout un personnage**, dans le codex : la fiche du nain › la
  bascule « animations » › « Sortir ses animations › ». Une seule archive, à son
  nom.
- **Le bouton n'existe pas sur le calque des images** : ce qui sort là est déjà
  sorti par la galerie, et une animation n'est pas une image.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé et facture zéro, mais
ce n'est pas ce qu'on vient regarder, et le clip qu'il rendrait serait le même
que celui qui est déjà là.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import zipfile
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

PORT = 8440
MODELE = "essai:rend-du-png"


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def peupler(atelier: Atelier, double: FournisseurDouble, animateur) -> tuple[str, str]:
    """Un personnage, une image de départ, un clip, et deux bandes rangées."""
    with TestClient(creer_application(atelier)) as client:
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le nain", "description": "un forgeron nain à la barbe tressée"},
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
            json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite},
        ).json()["clips"]
        clip = lot[0]["identifiant"]
        for _ in range(600):
            arrives = client.get("/api/clips").json()["clips"]
            if arrives and arrives[0]["statut"] in ("reussie", "echouee"):
                break
            client.get("/api/status")

        # **Deux bandes, et les deux sens de lecture.** Le va-et-vient est celui
        # qui compte : c'est le seul cas où l'image animée ne joue pas la
        # planche telle quelle, et le seul où l'on peut voir à l'œil si les
        # bouts se rejouent ou non.
        # Le clip d'`A10` porte vingt-deux images, numérotées 0 à 21 : le cycle
        # qui bouge commence à la dixième.
        for nom, images, sens, pose in (
            ("marche", [12, 14, 16, 18, 20], "boucle", "marche"),
            ("balancement", [10, 13, 16, 19], "aller-retour", "repos"),
        ):
            bande = client.post(
                "/api/strips",
                json={
                    "clip": clip,
                    "nom": nom,
                    "images": images,
                    "cadence": 8,
                    "sens": sens,
                },
            ).json()
            client.put(
                f"/api/strips/{bande['identifiant']}/case",
                json={"personnage": personnage, "pose": pose},
            )
        return personnage, clip


def deplier_l_archive(atelier: Atelier, personnage: str, dossier: Path) -> Path:
    """L'archive du personnage, fabriquée et **dépliée sur le disque**.

    C'est ce qu'il y a de plus utile à regarder, et l'écran ne peut pas le
    montrer : les trois fichiers d'une animation, côte à côte, tels qu'ils
    arriveront dans un dossier de jeu.
    """
    dehors = dossier / "sortie"
    dehors.mkdir(parents=True, exist_ok=True)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(f"/api/characters/{personnage}/strips/export", json={})
        reponse.raise_for_status()
    zipfile.ZipFile(io.BytesIO(reponse.content)).extractall(dehors)
    return dehors


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a4-"))
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
    dehors = deplier_l_archive(atelier, personnage, dossier)

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print()
    print(f"  L'archive dépliée : {dehors}")
    for fichier in sorted(dehors.iterdir()):
        print(f"    {fichier.name}  ({fichier.stat().st_size} octets)")
    print()
    descriptif = json.loads((dehors / "le-nain-balancement.json").read_text("utf-8"))
    print("  Le descriptif du balancement, tel qu'un moteur le lira :")
    print(f"    cases        : {len(descriptif['frames'])}")
    premiere = descriptif["frames"][0]
    print(f"    taille       : {premiere['frame']['w']} × {premiere['frame']['h']} px")
    print(f"    par image    : {premiere['duration']} millièmes de seconde")
    print(f"    étiquette    : {descriptif['meta']['frameTags'][0]}")
    print()
    print("  À cliquer :")
    print("    Galerie › la tuile du clip › « Découper › »")
    print("    — dans « gardées de ce clip », « Sortir › » sur une ligne")
    print("    — le fichier se pose, et le clip reste ouvert")
    print("    Codex › Le nain › la bascule « animations »")
    print("    — « Sortir ses animations › » : une archive à son nom")
    print("    — revenez sur « images » : le bouton n'y est pas")
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
