# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier `AU20` au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la séance.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8504, avec le fournisseur double des
essais : rien n'est payé, rien n'est écrit dans `donnees/`, et son atelier à lui
ne bouge pas d'un pixel.

Il monte **un sujet et trois choses à ranger**, une par visage du défaut :

- une **image** rattachée au sujet sans occuper de case — ce que l'import « sans
  mouvement » produit désormais au lieu de ne rien rattacher ;
- une **feuille de sprites** rattachée au sujet sans case, prête à découper : la
  découpe doit proposer *Champignon* et *à ranger plus tard* **déjà remplis** ;
- une **animation** déjà tirée de cette feuille et rangée nulle part.

Ce qu'on regarde à l'arrivée, dans cet ordre :

1. la fiche du sujet porte un onglet **Pas encore rangé** — les trois y sont ;
2. ranger l'une depuis cet onglet la fait **sortir de la liste** ;
3. le bouton de la fiche dit **Ajouter…** et son choix contient les cinq portes,
   dont *une vidéo que tu as déjà* ;
4. dans la découpe d'une planche, les deux listes de rattachement sont remplies.

    py essais/atelier_jetable_au20.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
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

from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

PORT = 8504

#: La case d'une feuille, en pixels d'écran. Assez grande pour qu'on voie ce
#: qu'on découpe sans zoomer.
CASE = 64


def _silhouette(dessin, x: int, y: int, pas: int, teinte) -> None:
    """Un champignon dans une case — le chapeau, puis le pied qui avance."""
    dessin.ellipse([x + 12, y + 14, x + CASE - 12, y + 36], fill=(*teinte, 255))
    dessin.rectangle(
        [x + 26 + pas, y + 34, x + 38 + pas, y + CASE - 12],
        fill=(232, 226, 208, 255),
    )


def feuille(colonnes: int = 4) -> bytes:
    """Une feuille de sprites au fond transparent, une case par pas de marche."""
    image = Image.new("RGBA", (CASE * colonnes, CASE), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    for colonne in range(colonnes):
        _silhouette(dessin, colonne * CASE, 0, 6 - (colonne % 4) * 4, (196, 74, 52))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def croquis() -> bytes:
    """Une image seule — celle qu'on importe « sans mouvement encore »."""
    image = Image.new("RGBA", (CASE, CASE), (0, 0, 0, 0))
    _silhouette(ImageDraw.Draw(image), 0, 0, 0, (58, 92, 140))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _poser(client, octets: bytes, nom: str) -> str:
    recu = client.post(
        "/api/assets/upload", content=octets, params={"nom": nom, "traiter": "false"}
    )
    assert recu.status_code == 201, recu.text
    return recu.json()["asset"]["identifiant"]


def peupler(atelier) -> None:
    """Le sujet et ses trois orphelins, **posés par les vraies routes HTTP**.

    Par les routes et pas par les services : ce qu'on vérifie ensuite à l'écran
    passe par elles, et un atelier peuplé autrement ne prouverait rien de ce que
    l'écran recevra.
    """
    with TestClient(creer_application(atelier)) as client:
        client.put("/api/universe", json={"vue": "vue-dessus-34"})
        sujet = client.post("/api/characters", json={"nom": "Champignon"})
        assert sujet.status_code == 201, sujet.text
        sujet = sujet.json()["personnage"]["identifiant"]
        print(f"  sujet « Champignon » créé ({sujet})")

        # ── 1 · Une image à lui, sans case ───────────────────────────────────
        image = _poser(client, croquis(), "croquis-du-champignon.png")
        pose = client.put(
            f"/api/assets/{image}/character", json={"personnage": sujet, "pose": None}
        )
        assert pose.status_code == 200, pose.text
        print("  image « croquis-du-champignon.png » rattachée au sujet, sans case")

        # ── 2 · Une planche à lui, sans case ─────────────────────────────────
        planche = _poser(client, feuille(), "marche-du-champignon.png")
        client.put(
            f"/api/assets/{planche}/character", json={"personnage": sujet, "pose": None}
        )
        print("  planche « marche-du-champignon.png » rattachée au sujet, sans case")

        # ── 3 · Une animation tirée de la planche, rangée nulle part ─────────
        #
        # **Sans nommer le sujet** : c'est le serveur qui doit le reprendre de la
        # feuille. Si cette ligne-là rendait une animation sans sujet, la
        # correction ne tiendrait pas, et l'atelier le montrerait tout de suite.
        boites = [[c * CASE, 0, c * CASE + CASE - 1, CASE - 1] for c in range(4)]
        fait = client.post(
            "/api/clips/sheet", json={"feuille": planche, "boites": boites}
        )
        assert fait.status_code == 201, fait.text
        clip = fait.json()["clip"]
        assert clip["personnage"] == sujet, "la feuille n'a pas transmis son sujet"
        print(f"  animation tirée de la planche — sujet repris : {clip['personnage']}")

        attente = client.get(f"/api/characters/{sujet}/unplaced").json()
        print(
            f"  en attente : {len(attente['images'])} image(s), "
            f"{len(attente['animations'])} animation(s), {len(attente['clips'])} clip(s)"
        )


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-au20-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    peupler(atelier)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    print("  → Ouvrir « Champignon », onglet « Pas encore rangé » : les trois y sont.")
    print("  → Ranger l'image sur un mouvement : elle quitte la liste.")
    print("  → Le bouton de la fiche dit « Ajouter… », et son choix a cinq portes.")
    print("  → Galerie → la planche → table « Découpe » : les deux listes sont remplies.")
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
