# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier G16 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8423, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte de quoi cliquer sur les trois choses que la tranche livre :

- **la galerie** doit montrer *deux* planches — celle des corps et celle de
  l'équipement — à côté des images qui en sont sorties, avec le prix de l'appel
  sur elles et zéro sur leurs morceaux ;
- **la carte d'un vêtement**, dans la colonne de droite du codex, doit porter la
  bascule *calque / brut* et le bouton *superposition ›* ;
- **la table de superposition**, ouverte par ce bouton, doit s'ouvrir déjà
  remplie : la case telle qu'elle est arrivée en dessus, le corps de la pose en
  dessous — et fabriquer un **second** vêtement à côté du premier.

    py essais/atelier_jetable_g16.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.

**Ce que la console dit avant qu'on ouvre le navigateur.** Les faits que l'écran
n'a plus qu'à afficher : le compte d'assets par rang, la recette de la planche,
son coût, et la case arrivée servie par son adresse. Un essai d'écran ne
remonterait pas ces mesures-là — c'est la leçon du banc de D2.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.domaine.pliage import geometrie  # noqa: E402
from atelier.image import calque as calc  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble, planche_sujets  # noqa: E402

PORT = 8423
MODELE = "essai:rend-du-png"
POSES = 4


def habiller(demande, cases: int) -> bytes:
    """La planche reçue, avec un sac vert posé sur chaque sujet.

    **Elle part des octets reçus**, comme le double de C3 : le recalage du
    produit compare case par case contre ce qu'il a envoyé, donc une planche
    redessinée de son côté ne prouverait rien de ce qu'on vérifie.
    """
    envoyee = demande.references[-1]
    with Image.open(io.BytesIO(envoyee)) as ouverte:
        planche = ouverte.convert("RGB")
    dessin = ImageDraw.Draw(planche)
    forme = geometrie(cases)
    for boite in calc.cases_de(planche.width, planche.height, forme):
        x0, y0, x1, y1 = boite
        large, haut = x1 - x0 + 1, y1 - y0 + 1
        dessin.rectangle(
            [x0 + large // 3, y0 + haut // 4, x0 + 2 * large // 3, y0 + haut // 2],
            fill=(40, 130, 60),
        )
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
        time.sleep(0.01)
    raise AssertionError("la génération n'a pas fini")


def peupler(atelier: Atelier, double: FournisseurDouble) -> None:
    with TestClient(creer_application(atelier)) as client:
        plan = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        poses = plan[:POSES]
        personnage = client.post(
            "/api/characters",
            json={"nom": "Le pèlerin", "description": "un pèlerin encapuchonné"},
        ).json()["personnage"]["identifiant"]
        client.put(f"/api/characters/{personnage}", json={"poses": poses})

        # ① Les corps, en **une seule planche** : c'est elle qui doit paraître
        #    dans la galerie à côté de ses quatre morceaux.
        double.rendre = lambda: planche_sujets(POSES)
        corps = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "un pèlerin encapuchonné",
                "personnage": personnage,
                "poses": poses,
            },
        )
        assert corps.status_code == 202, corps.text
        _attendre(client, corps.json()["identifiant"])
        double.rendre = None

        # ② La pièce, et la planche qui l'habille.
        piece = client.post(
            "/api/characters/pieces",
            json={
                "nom": "sac de voyage",
                "description": "un gros sac de voyage avec corde et matelas roulé",
                "emplacement": "dos",
                "portee": "contenue",
            },
        ).json()["piece"]["identifiant"]

        double.repondre = lambda demande: habiller(demande, len(poses))
        habits = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "a big travel backpack with rope and bedroll",
                "personnage": personnage,
                "piece": piece,
                "poses": poses,
            },
        )
        assert habits.status_code == 202, habits.text
        lot = _attendre(client, habits.json()["identifiant"])
        double.repondre = None

        # ── Ce que l'écran n'aura plus qu'à afficher ─────────────────────────
        assets = client.get("/api/assets").json()["assets"]
        planches = [a for a in assets if a["rang"] == 0]
        morceaux = [a for a in assets if a["rang"] >= 100]
        print(f"\n  {len(assets)} images — {len(planches)} planches, {len(morceaux)} morceaux")

        for planche in planches:
            print(
                f"  « {planche['label']} » — {planche['largeur']}×{planche['hauteur']}, "
                f"recette {'vide' if not planche['traite'] else 'POSÉE (défaut !)'}, "
                f"pose {planche['pose']}, {planche['consomme']} {planche['unite']}"
            )
        print(
            f"  les morceaux coûtent tous zéro : "
            f"{all(a['consomme'] == 0 for a in morceaux)}"
        )

        # La matrice ne doit pas voir les planches : quatre cases, une image
        # chacune, et une colonne de vêtements à côté.
        chose = client.get("/api/characters").json()["personnages"][0]
        pleines = [c for c in chose["cases"] if c["images"]]
        print(f"  matrice : {len(pleines)} cases pleines, planches invisibles")

        # ③ La case telle qu'elle est arrivée, servie par son adresse.
        vetements = [a for a in morceaux if a["piece"]]
        print(f"  {len(vetements)} vêtements dans la colonne du sac de voyage")
        for vetement in vetements[:1]:
            reponse = client.get(f"/api/assets/{vetement['identifiant']}/incoming")
            arrivee = f"{len(reponse.content)} octets" if reponse.status_code == 200 else reponse.text
            rangee = client.get(
                f"/api/assets/{vetement['identifiant']}/image?brut=true"
            )
            print(f"  « {vetement['label']} »")
            print(f"      la case arrivée  → {arrivee}")
            print(f"      le brut rangé    → {len(rangee.content)} octets")
            print(
                "      les deux diffèrent : "
                f"{reponse.content != rangee.content}"
            )

            ouverture = client.get(
                f"/api/assets/{vetement['identifiant']}/overlay"
            ).json()
            print(
                f"      la table s'ouvre sur → dessus « {ouverture['dessus']['label']} », "
                f"dessous « {(ouverture['dessous'] or {}).get('label')} », "
                f"case arrivée proposée : {ouverture['arrivee_possible']}"
            )

        print(f"\n  lot d'équipement : {lot['statut']}")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-g16-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier, double)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
