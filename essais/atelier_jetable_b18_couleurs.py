# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B18 · Couleurs**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8491 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b18_couleurs.py

Ajouter `sans-servir` en argument peuple et imprime le résumé, sans lancer
uvicorn — pratique pour vérifier le montage sans avoir à faire Ctrl+C.

⚠️ **Depuis un worktree, poser `PYTHONPATH` sur la racine du worktree**, sans
quoi `import atelier` résout vers le dépôt principal et l'on mesure le code de
l'auteur en croyant mesurer le sien (`docs/PIEGES.md`, `B20`).

## Ce qu'il monte

Un jeu, **« Le marais des couleurs »**, taillé pour cette table-ci et pour rien
d'autre — il n'y a ni collection, ni animation, ni matrice à regarder :

- **Deux artworks officiels**, donc **une palette de jeu**. Sans elle, la moitié
  des réglages de la table sont grisés avec leur raison, et l'autre moitié ne se
  juge pas : « imposer la palette du jeu » n'a rien à imposer. Ils sont peints
  en bruns, verts et gris — le vocabulaire du marais.
- **Quatre sujets**, chacun choisi pour un moteur de la tranche :
  - *Le pèlerin* — un dégradé de bruns, qui montre les marches d'escalier et ce
    que le tramage en fait ;
  - *La grenouille* — un vert franc et rare au milieu des bruns : c'est le cas
    que k-moyennes et la distance à l'œil existent pour réparer ;
  - *Le moulin détouré* — son fond magenta est encore sous la transparence, et
    il prend une place de la palette tant que « ne compter que ce qu'on voit »
    n'est pas coché ;
  - *Le ciel du marais* — un grand dégradé lisse, le seul sujet où le tramage
    se voit vraiment.

**Rien n'a été payé** : le fournisseur est le double des essais, il ne touche
pas au réseau et ne facture rien.

## Ce qu'on vient voir à l'écran

Fiche d'un sujet › Ses images › Retoucher › table **Couleurs**. Les six réglages
neufs y sont, et **chacun doit changer l'image** :

1. **algorithme** — coupe médiane · k-moyennes · découpe en huit. Sur *La
   grenouille*, à 8 couleurs, k-moyennes garde le vert franc là où la coupe
   médiane le noie dans les bruns. Grisé, avec sa raison, dès qu'une palette de
   jeu est imposée : elle décide alors seule.
2. **graine** — ne paraît qu'avec k-moyennes, seul algorithme qui tire quelque
   chose. La bouger change la palette ; la remettre rend exactement la même
   image.
3. **tramage** — aucun · diffusion · **trame régulière**. Sur *Le ciel*, à 4
   couleurs, « aucun » pose des bandes franches, « diffusion » un semis
   irrégulier, « trame » un damier qui se répète.
4. **force du tramage** — grisée tant qu'aucun tramage n'est choisi, avec sa
   raison. À 20 % le semis est discret, à 100 % il est plein.
5. **distance des couleurs** — brute · à l'œil. Sur *La grenouille* avec la
   palette du jeu imposée, « brute » peut envoyer le vert vif sur un gris-vert ;
   « à l'œil » le garde vert.
6. **ne compter que ce qu'on voit** — sur *Le moulin détouré*, à 8 couleurs,
   décoché on obtient 7 couleurs visibles, coché on en obtient 8.

Plus **les couleurs gardées** — piquer une couleur de la palette du jeu et la
voir survivre à une réduction serrée — et, sous l'image, le compte
**« demandées / obtenues »**.
"""

from __future__ import annotations

import io
import logging
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image

logging.getLogger("httpx2").setLevel(logging.WARNING)

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

from conftest import FournisseurDouble  # noqa: E402

PORT = 8491

# Le vocabulaire du marais — c'est sur ces couleurs-là que la palette du jeu se
# lira, donc c'est elles qu'on retrouvera dans les pastilles de l'écran.
BRUNS = [(74, 54, 34), (107, 82, 52), (140, 110, 74), (176, 145, 105)]
VERTS = [(30, 77, 43), (60, 143, 79), (110, 180, 100)]
GRIS = [(34, 34, 34), (90, 90, 90), (150, 150, 150), (215, 215, 215)]
MAGENTA = (255, 0, 255)
VERT_GRENOUILLE = (30, 220, 60)


def _png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _artwork(cote: int, couleurs: list[tuple[int, int, int]]) -> bytes:
    """Une planche d'aplats sur fond clair — de quoi lire une palette.

    **Le fond est plat et relié au bord** : `palette.alpha_du_sujet` le retire
    avant de lire, et sans ça la palette dirait vingt gris de fond au lieu des
    couleurs du jeu (le piège mesuré en tête de `atelier/image/palette.py`).
    """
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, :3] = (235, 235, 235)
    rgba[:, :, 3] = 255
    par_rangee = 4
    marge = cote // 10
    case = (cote - 2 * marge) // par_rangee
    for rang, couleur in enumerate(couleurs):
        y, x = divmod(rang, par_rangee)
        haut, gauche = marge + y * case, marge + x * case
        rgba[haut : haut + case - 2, gauche : gauche + case - 2, :3] = couleur
    return _png(rgba)


def _pelerin(cote: int = 96) -> bytes:
    """Un dégradé de bruns — les marches d'escalier, et ce que le tramage en fait."""
    y, x = np.mgrid[0:cote, 0:cote]
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, 0] = np.clip(60 + x * (120 / cote), 0, 255)
    rgba[:, :, 1] = np.clip(44 + y * (95 / cote), 0, 255)
    rgba[:, :, 2] = np.clip(28 + (x + y) * (45 / cote), 0, 255)
    rgba[:, :, 3] = 255
    return _png(rgba)


def _grenouille(cote: int = 96) -> bytes:
    """Des bruns, et un vert franc sur 1,7 % des pixels.

    **C'est le sujet de k-moyennes et de la distance à l'œil**, et il n'est pas
    décoratif : une couleur rare mais franche est très exactement ce que la
    coupe médiane noie et ce que la distance brute envoie sur un gris-vert.
    """
    y, x = np.mgrid[0:cote, 0:cote]
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, 0] = 90 + (x // 8) * 6
    rgba[:, :, 1] = 70 + (y // 8) * 5
    rgba[:, :, 2] = 50 + ((x + y) // 16) * 3
    rgba[:, :, 3] = 255
    milieu = cote // 2
    rgba[milieu - 6 : milieu + 6, milieu - 6 : milieu + 6, :3] = VERT_GRENOUILLE
    return _png(rgba)


def _moulin_detoure(cote: int = 96) -> bytes:
    """Un sujet détouré **sur fond magenta encore présent sous l'alpha**.

    C'est l'état exact que laisse le détourage : l'opacité à zéro, la couleur
    intacte dessous. C'est ce magenta-là qui prend une place de la palette tant
    qu'on ne compte pas que les pixels visibles.
    """
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, :3] = MAGENTA
    marge = cote // 5
    y, x = np.mgrid[0 : cote - 2 * marge, 0 : cote - 2 * marge]
    corps = np.zeros((cote - 2 * marge, cote - 2 * marge, 3), dtype=np.uint8)
    corps[:, :, 0] = np.clip(80 + x * 1.6, 0, 255)
    corps[:, :, 1] = np.clip(60 + y * 1.2, 0, 255)
    corps[:, :, 2] = np.clip(45 + (x + y) * 0.6, 0, 255)
    rgba[marge:-marge, marge:-marge, :3] = corps
    rgba[marge:-marge, marge:-marge, 3] = 255
    return _png(rgba)


def _ciel(cote: int = 96) -> bytes:
    """Un grand dégradé lisse — le seul sujet où le tramage se voit vraiment."""
    y, _ = np.mgrid[0:cote, 0:cote]
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, 0] = np.clip(60 + y * (150 / cote), 0, 255)
    rgba[:, :, 1] = np.clip(90 + y * (140 / cote), 0, 255)
    rgba[:, :, 2] = np.clip(140 + y * (110 / cote), 0, 255)
    rgba[:, :, 3] = 255
    return _png(rgba)


SUJETS = {
    "Le pèlerin": _pelerin,
    "La grenouille": _grenouille,
    "Le moulin détouré": _moulin_detoure,
    "Le ciel du marais": _ciel,
}


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le marais des couleurs"}),
            "le projet",
        )["projet"]["identifiant"]

        # ── Deux artworks officiels : c'est ce qui fabrique la palette du jeu ──
        for rang, couleurs in enumerate((BRUNS + VERTS, GRIS + VERTS)):
            collee = _exiger(
                client.post(
                    "/api/board/paste",
                    params={"nom": f"planche {rang + 1}", "projet": projet, "forcer": True},
                    content=_artwork(256, couleurs),
                    headers={"content-type": "application/octet-stream"},
                ),
                f"la planche d'inspiration {rang + 1}",
            )
            # `coller_image` rend `{"carte": …, "doublon": …}`, et l'un des deux
            # est toujours nul — **un doublon n'est pas un refus**, donc il ne
            # lève pas et il faut le lire.
            if not collee.get("carte"):
                raise SystemExit(
                    f"la planche {rang + 1} est un doublon : {collee.get('doublon')}"
                )
            carte = collee["carte"]["identifiant"]
            _exiger(
                client.put(
                    f"/api/board/{carte}/official",
                    json={"projet": projet, "officiel": True},
                ),
                f"la promotion de la planche {rang + 1}",
            )

        palette = _exiger(
            client.get("/api/universe", params={"projet": projet}), "l'univers"
        )["univers"]["palette"]

        # ── Les quatre sujets, une image chacun ──────────────────────────────
        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        images: dict[str, str] = {}
        for nom, peindre in SUJETS.items():
            personnage = _exiger(
                client.post("/api/characters", json={"nom": nom, "description": ""}),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]

            fichier = dossier / f"{nom.replace(' ', '-')}.png"
            fichier.write_bytes(peindre())
            asset = _exiger(
                client.post(
                    "/api/assets/import", json={"chemin": str(fichier), "forcer": True}
                ),
                f"l'import de « {nom} »",
            )["asset"]["identifiant"]
            _exiger(
                client.put(
                    f"/api/assets/{asset}/character",
                    json={"personnage": personnage, "pose": poses[0]},
                ),
                f"la pose de « {nom} »",
            )
            images[nom] = asset

        # ── Ce que le serveur répond vraiment sur la table Couleurs ──────────
        # **L'état du traitement voyage dans `/api/status`**, l'appel unique de
        # l'ouverture : il n'a pas de route à lui, et le chercher ailleurs rend
        # un 404 qui n'a rien à voir avec la tranche.
        traitement = _exiger(client.get("/api/status"), "l'état de l'atelier")[
            "traitement"
        ]
        return {
            "projet": projet,
            "palette": palette,
            "images": images,
            "traitement": traitement,
            "client_ferme": None,
        }


def principal(sans_servir: bool = False) -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b18-couleurs-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    palette = monte["palette"]
    traitement = monte["traitement"]
    quantification = traitement.get("quantification", {})

    print()
    print(f"  Montage       : {duree:.1f} s")
    print(f"  Appels payés  : {double.appels}  (double : facture zéro)")
    print(f"  Palette du jeu : {len(palette)} couleurs")
    print(f"    {' '.join(palette)}")
    print()
    print("  Ce que la route rend pour la table Couleurs :")
    print(
        "    · algorithmes : "
        + ", ".join(a["libelle"] for a in quantification.get("algorithmes", []))
    )
    print(
        "    · distances   : "
        + ", ".join(d["libelle"] for d in quantification.get("distances", []))
    )
    rampes_servies = quantification.get("rampes", [])
    print(f"    · rampes d'ombre : {len(rampes_servies)} familles")
    for rampe in rampes_servies:
        print(f"        {' '.join(rampe)}")
    if not palette:
        print("    ⚠️ aucune palette de jeu — la moitié des réglages sera grisée")

    print()
    print("  Les quatre sujets, et ce qu'on vient regarder sur chacun :")
    for nom in SUJETS:
        print(f"    · {nom}  ({monte['images'][nom]})")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → un sujet › Ses images › Retoucher › table Couleurs")
    print("  → les six réglages neufs : algorithme, graine, tramage, force,")
    print("    distance des couleurs, ne compter que ce qu'on voit")
    print("  → plus les couleurs gardées, et le compte demandées / obtenues")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
