# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A10 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8432, avec le fournisseur d'images et
l'animateur des essais : **rien n'est payé**, rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

Ce qu'il monte, et pourquoi chaque morceau existe :

- un **personnage à deux images** — un portrait promu, une case *marche*
  remplie —, parce qu'un clip ne se commande pas dans le vide ;
- **un clip fabriqué sur place, dont on connaît la réponse** : douze images où
  rien ne bouge, puis douze où le sujet tend un bras puis le ramène. Le repos et
  la boucle sont donc *à un endroit connu*, et l'on peut dire si les deux
  propositions de l'atelier tombent juste — sur un vrai clip, on ne saurait pas
  distinguer « la machine a raison » de « la machine a répondu » ;
- **et le sujet ne fait pas la même largeur au repos et en mouvement**, ce qui
  est le seul cas où « toutes les bandes partagent la même assise » veut dire
  quelque chose.

De quoi cliquer sur ce que la tranche livre :

- **Galerie › la tuile du clip › Découper ›** : l'écran s'ouvre **en tournant
  déjà**, une proposition posée.
- **Les deux boucles** tournent côte à côte sur le même métronome : à gauche ce
  que le modèle a rendu, fond compris ; à droite la bande passée par la chaîne
  du jeu.
- **La pellicule** : un clic prend ou laisse une image, le survol ouvre la loupe,
  les poignées bleues posent un découpage régulier. Au clavier : les flèches
  déplacent le trait, la barre d'espace prend ou laisse.
- **Les deux propositions** — le repos, la boucle — posent un découpage sans
  rien décider ; *repartir de zéro* les défait.
- **Le cadre** : *du clip*, *de la bande*, *à la main*, et la phrase de ce que
  chacun implique. *Reprendre le cadre* remesure tout le clip, et dit ce que ça
  coûte avant de le faire.
- **La recette** part de celle du jeu ; changez la taille du pixel et l'écart
  s'écrit en clair, une phrase par réglage.
- **Garder** : la bande entre dans la liste, et **le prix par bande baisse**.
- **Rien n'y dépense**, et le total du projet le prouve : il ne bouge pas.

    py essais/atelier_jetable_a10.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Aucun appel, aucun centime.** L'animateur est un double. Sans le décodeur de
clips installé, il n'y a rien à découper du tout et le script le dit avant de
servir : c'est la seule dépendance de cette tranche.
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

import numpy as np  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, SANS_TARIF, AnimateurDouble  # noqa: E402

PORT = 8432
MODELE = "essai:rend-du-png"

COTE = 240
REPOS = 12
PAS = 12


def clip_connu() -> bytes:
    """Un clip dont on connaît la réponse : un repos, puis un cycle qui se referme.

    Le fond est clair et uni, le sujet sombre : le détourage par le bord doit
    pouvoir l'isoler, sans quoi ce qu'on regarderait à l'écran serait un défaut
    de détourage et non un découpage.

    **Le bras tendu grandit la silhouette**, et c'est ce qui fait que la fenêtre
    du clip entier n'est pas celle du repos. Sans lui, les trois choix de cadre
    donneraient tous la même image et l'écran ne montrerait rien.
    """
    import imageio.v3 as iio

    suite = np.full((REPOS + PAS, COTE, COTE, 3), 244, dtype="uint8")
    for numero in range(REPOS):
        suite[numero, 60:200, 90:130] = 40
    for rang in range(PAS):
        tendu = (rang if rang <= PAS // 2 else PAS - rang) * 14
        suite[REPOS + rang, 60:200, 90:130] = 40
        if tendu:
            suite[REPOS + rang, 96:120, 130 : 130 + tendu] = 40
    return iio.imwrite("<bytes>", suite, extension=".mp4", fps=12)


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def _une_image(client, double, prompt, personnage, pose) -> str:
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
    """Un personnage à deux images, et **un clip arrivé qu'on sait lire**."""
    with TestClient(creer_application(atelier)) as client:
        personnage = client.post(
            "/api/characters",
            json={
                "nom": "Le nain",
                "description": "un forgeron nain à la barbe tressée",
            },
        ).json()["personnage"]["identifiant"]

        repos = _une_image(client, double, "le nain, au repos", personnage, "repos")
        client.put(
            f"/api/characters/{personnage}/references",
            json={"asset": repos, "promue": True},
        )
        marche = _une_image(client, double, "le nain, qui marche", personnage, "marche")

        clip = client.post(
            "/api/clips",
            json={
                "modele": MELE.identifiant,
                "mouvement": "marche",
                "asset": marche,
                "personnage": personnage,
                "pose": "marche",
            },
        ).json()["clips"][0]["identifiant"]
        for _ in range(300):
            arrives = client.get("/api/clips").json()["clips"]
            if arrives and arrives[0]["statut"] == "reussie":
                break
            client.get("/api/status")

        # Ce que l'écran recevra à l'ouverture, imprimé **avant** de servir : un
        # essai d'écran ne remonte pas ces chiffres-là, et c'est la moitié de ce
        # qu'on vient vérifier.
        ouvert = client.get(f"/api/montage/{clip}").json()
        return {"personnage": personnage, "clip": clip, "ouvert": ouvert}


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Rien à découper : {manque}")
        print("Le montage a besoin du décodeur de clips — c'est sa seule dépendance.")
        return 1

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a10-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE, SANS_TARIF]
    # **Le clip qu'on sait lire.** Le double rend celui-ci plutôt qu'un clip
    # quelconque : c'est ce qui permet de dire si les propositions tombent juste.
    animateur.octets = clip_connu()
    animateur.facture = 0.067

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    montage = peupler(atelier, double)
    ouvert = montage["ouvert"]

    print()
    print(f"  Le personnage       : {montage['personnage']}")
    print(f"  Le clip             : {montage['clip']}")
    print(
        f"    images sur disque : {ouvert['clip']['images']}"
        f" — {REPOS} de repos, puis {PAS} qui bougent"
    )
    fenetre = ouvert["fenetre"]
    if fenetre:
        print(
            f"    fenêtre du clip   : {fenetre['largeur']} × {fenetre['hauteur']},"
            f" prise sur {fenetre['images']} images"
        )
    print("    ce que l'atelier a remarqué :")
    for proposition in ouvert["propositions"]:
        print(f"      — {proposition['mot']}")
    if not ouvert["propositions"]:
        print("      — rien : ne rien proposer est une réponse")
    grille = ouvert["recette_du_jeu"].get("grille")
    if grille:
        print(
            f"    recette du jeu    : {grille['cible']} px de haut,"
            f" occupation {grille['occupation']} %"
        )
    print(f"    prix par bande    : {ouvert['prix']['par_bande']:.4f} $ (aucune gardée)")
    print()
    print("  À cliquer : Galerie › la tuile du clip › Découper ›")
    print("             puis une proposition, la pellicule, le cadre, la recette")
    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
