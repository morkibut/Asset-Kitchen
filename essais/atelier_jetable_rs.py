# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier le chantier des références d'un sujet (RS1 à RS5).

**L'auteur travaille sur le port 8420 pendant la séance.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8507, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`.

Il monte **Champy**, en vue de dessus (quatre directions), avec :

- une **planche** de ses quatre vues, promue en référence et rangée « planche » ;
- une **image seule**, dans la galerie, rattachée à personne.

Ce qu'on regarde, dans cet ordre :

1. fiche de Champy → *Images de référence* : la planche est dans son bloc, les
   quatre directions ont leur place ;
2. *Fabriquer…* depuis la fiche : « Pour » vaut Champy, la pose « Sans case visée » ;
3. cocher *Garder la mise en page*, *Relire avant l'envoi* : plus de « one single
   sprite », une consigne LAYOUT, la planche nommée comme planche à reproduire ;
4. galerie → l'image seule → *Corps de* : Champy, « sans pose ».

    py essais/atelier_jetable_rs.py
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

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8507
CASE = 64


def _champignon(dessin, x: int, teinte) -> None:
    dessin.ellipse([x + 10, 10, x + CASE - 10, 34], fill=(*teinte, 255))
    dessin.rectangle([x + 26, 32, x + 38, CASE - 10], fill=(232, 226, 208, 255))


def _png(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def planche() -> bytes:
    """Quatre vues côte à côte — une teinte par direction, pour les distinguer."""
    image = Image.new("RGBA", (CASE * 4, CASE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    for rang, teinte in enumerate([(196, 74, 52), (170, 60, 48), (150, 50, 40), (130, 40, 36)]):
        _champignon(dessin, rang * CASE, teinte)
    return _png(image)


def seule() -> bytes:
    image = Image.new("RGBA", (CASE, CASE), (0, 0, 0, 0))
    _champignon(ImageDraw.Draw(image), 0, (58, 92, 140))
    return _png(image)


def _poser(client, octets: bytes, nom: str) -> str:
    recu = client.post(
        "/api/assets/upload", content=octets, params={"nom": nom, "traiter": "false"}
    )
    assert recu.status_code == 201, recu.text
    return recu.json()["asset"]["identifiant"]


def peupler(atelier) -> None:
    """Par les vraies routes HTTP : c'est par elles que l'écran lira."""
    with TestClient(creer_application(atelier)) as client:
        client.put("/api/universe", json={"vue": "vue-dessus-34"})
        sujet = client.post("/api/characters", json={"nom": "Champy"})
        assert sujet.status_code == 201, sujet.text
        sujet = sujet.json()["personnage"]["identifiant"]

        feuille = _poser(client, planche(), "champy-quatre-vues.png")
        client.put(f"/api/assets/{feuille}/character", json={"personnage": sujet, "pose": None})
        rangee = client.put(
            f"/api/characters/{sujet}/references",
            json={"asset": feuille, "usage": "planche"},
        )
        assert rangee.status_code == 200, rangee.text
        print("  planche des quatre vues promue, rangée « planche »")

        _poser(client, seule(), "champignon-bleu.png")
        print("  image seule posée dans la galerie, rattachée à personne")


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rs-"))
    print(f"Dossier jetable : {dossier}")
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)
    # **Une seconde application sur un atelier neuf** : le gestionnaire MCP ne
    # démarre qu'une fois par application, et relire le dossier prouve au passage
    # que ce qui vient d'être écrit survit à une réouverture.
    relu = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    uvicorn.run(creer_application(relu), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
