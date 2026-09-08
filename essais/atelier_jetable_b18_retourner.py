# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer les neuf moteurs neufs de **B18 — Retourner**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8493 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_retourner.py

## Ce qu'il monte

Un pèlerin, une seule image « au repos », vue vers l'est — le même sujet
dissymétrique que `B1` : un corps rayé (pour que la remise sur grille se voie),
un bâton d'un seul côté (pour « miroir, sauf ici »), une tache jaune unique en
bas à gauche (pour voir n'importe quel sens agir d'un coup d'œil). Rien n'est
payé : le fournisseur est le double des essais.

## Ce qu'on vient voir à l'écran

Galerie › la vignette › la table **Retourner**, colonne « le sens » :

- **Les dix sens sont tous cliquables** — aucun grisé « à ajouter ». Chacun
  bascule l'image sous les yeux.
- **Miroir haut-bas, demi-tour** : le bâton et la tache changent de place, la
  taille de la case ne bouge pas.
- **Quart de tour à droite / à gauche, diagonale** : la case elle-même change
  de forme (elle n'est pas carrée ici, exprès, pour que ça se voie).
- **Miroir sur soi (repli)** : une moitié de l'image remplace l'autre — un
  réglage « moitié gardée » paraît, gauche/droite.
- **Miroir, sauf ici** : un réglage « zones protégées » paraît, avec un bouton
  « + une zone au centre ». Sans zone, c'est un miroir ordinaire ; avec une
  zone posée sur le bâton, il reste du bon côté pendant que le reste bascule.
- **Rotation libre, au plus proche** puis **rotation libre, méthode pixel
  art** : un réglage « angle » paraît. **Réglez-le sur un angle comme 25-30°
  et comparez les deux** — c'est le cœur de la tranche. Sur cette image
  d'origine plutôt grande, la différence est discrète ; elle devient nette sur
  une case déjà réduite à 64 px (recadrez la table *Pixéliser* dessus d'abord,
  ou zoomez la vignette).
- **RotSprite prend plus longtemps que les neuf autres** — sensible surtout à
  grand angle sur une grande image. Sous 240 ms, rien ne devrait paraître ;
  au-delà, la jauge générique de la recette doit se montrer.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : le double facture zéro, mais ce n'est pas ce
qu'on vient regarder.
"""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** : deux fournisseurs doubles
# qui divergeraient finiraient par ne plus décrire le même produit.
from conftest import FOND, SUJET, SUJET_SOMBRE, FournisseurDouble  # noqa: E402

PORT = 8493
MODELE = "essai:rend-du-png"


def sujet_dissymetrique(*, toile_l: int = 40, toile_h: int = 32, bloc: int = 8) -> bytes:
    """Un sujet non carré, dissymétrique sur ses deux axes.

    **Non carré exprès** : les quarts de tour et la diagonale changent la
    forme de la case, et c'est ce qu'on vient voir. Le bâton d'un seul côté
    sert « miroir, sauf ici » ; la tache unique, jaune, sert de repère pour
    n'importe lequel des dix sens.
    """
    petite = Image.new("RGB", (toile_l, toile_h), FOND)
    dessin = ImageDraw.Draw(petite)

    largeur, hauteur = 10, 20
    x0 = (toile_l - largeur) // 2
    y0 = toile_h - hauteur - 2
    for colonne in range(largeur):
        dessin.rectangle(
            [x0 + colonne, y0, x0 + colonne, y0 + hauteur - 1],
            fill=SUJET if colonne % 2 == 0 else SUJET_SOMBRE,
        )
    # Le bâton — à droite du corps, et nulle part à gauche.
    dessin.rectangle([x0 + largeur, y0 + 1, x0 + largeur + 3, y0 + hauteur - 4], fill=(120, 90, 50))
    # La tache — en bas à gauche, d'une couleur unique dans l'image.
    dessin.rectangle([x0 - 3, y0 + hauteur - 3, x0 - 1, y0 + hauteur - 1], fill=(250, 220, 30))

    grande = petite.resize((toile_l * bloc, toile_h * bloc), Image.Resampling.NEAREST)
    tampon = io.BytesIO()
    grande.save(tampon, format="PNG")
    return tampon.getvalue()


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee", "interrompue"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier, double: FournisseurDouble) -> dict:
    double.rendre = sujet_dissymetrique

    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/characters/directions", json={"nom": "est"}),
            "la direction « est »",
        )
        pelerin = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": "un pèlerin en manteau de voyage, bâton à la main droite",
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]

        pose = client.get("/api/characters").json()["plan"][0]["identifiant"]

        depart = _exiger(
            client.post(
                "/api/generations",
                json={
                    "modele": MODELE,
                    "prompt": "le pèlerin, au repos, vu vers l'est",
                    "personnage": pelerin,
                    "pose": pose,
                    "direction": "est",
                    "echelle": "personnage",
                },
            ),
            "la génération « au repos »",
        )
        _attendre(client, depart["identifiant"])
        image = f"{depart['identifiant']}-0"

        return {"pelerin": pelerin, "pose": pose, "image": image}


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-retourner-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)
    monte = peupler(atelier, double)

    print()
    print(f"  Le pèlerin   : {monte['pelerin']}")
    print(f"  Son image    : {monte['image']}")
    print(f"  Appels payés : {double.appels}  (double : facture zéro)")
    print()
    print("  À cliquer :")
    print("    Galerie › la vignette de l'image « au repos » › la table")
    print("    « Retourner » — colonne « le sens »")
    print("    — les dix boutons sont vifs, aucun grisé « à ajouter »")
    print("    — haut-bas / demi-tour : le bâton et la tache changent de place")
    print("    — quart à droite / à gauche / diagonale : la case change de forme")
    print("    — miroir sur soi : « moitié gardée » paraît, gauche/droite")
    print("    — miroir, sauf ici : « zones protégées » paraît — sans zone,")
    print("      miroir ordinaire ; « + une zone au centre » en ajoute une")
    print("    — les deux rotations libres : « angle » paraît — comparez-les")
    print("      autour de 25-30°, c'est le cœur de la tranche")
    print("    — RotSprite est visiblement plus lent à grand angle ; sous")
    print("      240 ms rien ne devrait paraître, au-delà la jauge générique")
    print("      de la recette doit se montrer")
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
