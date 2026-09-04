# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A9 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8431, avec le fournisseur d'images et
l'animateur des essais : **rien n'est payé**, rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

Ce qu'il monte, et pourquoi :

- un **personnage avec une image de repos**, promue en référence — c'est ce que
  la règle appelle *le portrait*, et c'est ce que l'écran proposera quand la
  case visée est vide ;
- une **seconde image dans la case marche**, pour que la même règle propose
  autre chose sur cette case-là : *l'image de la case visée* ;
- **trois clips déjà arrivés du même lot**, pour voir la galerie leur garder
  leur place, montrer une image prélevée dedans, et proposer *garder celui-ci ·
  jeter 2 autres*.

De quoi cliquer sur ce que la tranche livre :

- **Codex › Le nain › la ligne *marche* › Animer ›** : l'écran de commande
  s'ouvre. À gauche l'image de départ **avec la raison de ce choix-là** et le
  mouvement, dont le texte anglais se lit avant l'envoi ; au milieu ce qu'on va
  recevoir et le format ; à droite les modèles avec leur prix, leur formule, ce
  que ce dépôt a mesuré d'eux — et le bouton qui porte le montant.
- **Changer le nombre de clips** : le montant du bouton suit, avant l'envoi.
- **Changer le format** : le prix se recalcule.
- **changer d'image ›** : n'importe quelle image de la bibliothèque, d'un clic.
- **Le second modèle est grisé avec sa raison** — son tarif n'a pas pu être
  relu — au lieu d'être caché.
- **Échap** revient sans rien dépenser.
- **Galerie** : les trois clips du lot, chacun montrant une image prise dedans,
  ce qu'il porte et ce qu'il a coûté, et le geste qui garde l'un et jette les
  autres. Le bandeau qui suit porte *les rendre*.

    py essais/atelier_jetable_a9.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Aucun appel, aucun centime.** L'animateur est un double : il rend un vrai
fichier vidéo quand le décodeur de clips est installé, et des octets quelconques
sinon — auquel cas les tuiles diront *images non tirées* avec leur raison, ce
qui est aussi un état du produit qui vaut d'être vu.
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
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, SANS_TARIF, AnimateurDouble  # noqa: E402

PORT = 8431
MODELE = "essai:rend-du-png"


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def _une_image(client, double, prompt, personnage, pose) -> str:
    """Une image dans une case, par le chemin ordinaire du produit."""
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    faite = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": prompt,
            "personnage": personnage,
            "pose": pose,
            "echelle": "personnage",
        },
    )
    _attendre(client, faite.json()["identifiant"])
    double.rendre = None
    return f"{faite.json()['identifiant']}-0"


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict[str, object]:
    """Un personnage à deux images, et un lot de trois clips déjà arrivés."""
    with TestClient(creer_application(atelier)) as client:
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le nain", "description": "un forgeron nain à la barbe tressée"},
        ).json()["personnage"]["identifiant"]

        # **Le portrait** : une image de repos, promue en référence. C'est ce que
        # la règle propose quand la case visée est vide.
        repos = _une_image(client, double, "le nain, au repos", personnage, "repos")
        client.put(
            f"/api/characters/{personnage}/references",
            json={"asset": repos, "promue": True},
        )
        # **L'image de la case visée** : la règle la préfère au portrait, parce
        # que son attitude a déjà été validée en fixe.
        marche = _une_image(client, double, "le nain, qui marche", personnage, "marche")

        # Trois clips du même geste, déjà revenus. Le lot est ce qui permet à la
        # galerie de proposer *garder celui-ci · jeter 2 autres*.
        lot = client.post(
            "/api/clips",
            json={
                "modele": MELE.identifiant,
                "mouvement": "marche",
                "asset": marche,
                "personnage": personnage,
                "pose": "marche",
                "nombre": 3,
            },
        ).json()["clips"]
        for _ in range(300):
            arrives = client.get("/api/clips").json()["clips"]
            if all(c["statut"] == "reussie" for c in arrives):
                break
            client.get("/api/status")

        images = client.get("/api/clips").json()["clips"][0]["clip"]["images"]
        return {
            "personnage": personnage,
            "repos": repos,
            "marche": marche,
            "clips": [c["identifiant"] for c in lot],
            "images": images,
        }


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-a9-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    # Deux modèles vidéo, et c'est voulu : l'un se propose avec son prix et sa
    # formule, l'autre se grise **avec sa raison** parce que son tarif n'a pas
    # pu être relu. Un catalogue d'un seul modèle ne montrerait pas le grisé.
    animateur.modeles = [MELE, SANS_TARIF]
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    montage = peupler(atelier, double)

    print()
    print(f"  Le personnage      : {montage['personnage']}")
    print(f"    son portrait     : {montage['repos']} (promu en référence)")
    print(f"    sa case marche   : {montage['marche']}")
    print(f"  Les trois clips    : {', '.join(montage['clips'])}")
    print(f"    images tirées    : {montage['images']} par clip")
    if not montage["images"]:
        print("    (le décodeur de clips manque — les tuiles diront pourquoi,")
        print("     et les clips restent payés : c'est aussi un état à voir)")
    print()
    print("  À cliquer : Codex › Le nain › ligne « marche » › Animer ›")
    print("             puis Galerie, pour les trois clips du lot")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
