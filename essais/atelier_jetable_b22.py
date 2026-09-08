# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B22 — la galerie connaît les clips**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8487 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b22.py

Ajouter `sans-servir` en argument peuple et imprime le résumé, sans lancer
uvicorn.

## Ce qu'il monte

Un jeu, **« Les Salines »** — le grand des deux jeux d'exemple du dépôt, celui
qui porte l'échelle.

- **122 clips gardés**, écrits directement dans le dépôt : 120 distincts (de 6
  à 34 images, 8 images/seconde, une teinte qui tourne d'un clip à l'autre —
  un coup d'œil dans la grille doit vraiment en distinguer cent vingt, pas une
  seule tuile répétée), et une paire du même lot, **non départagée**, pour
  vérifier que « Garder celui-ci » reste possible sur un clip relu depuis le
  dépôt et non plus tenu par le chantier.
- **Cinq clips jetés** — ils ne doivent apparaître nulle part, ni dans
  « Toutes », ni dans le filtre « clips ».
- **Douze personnages**, chacun avec une image, pour que « Toutes », une
  famille précise et « clips » se distinguent vraiment dans la grille plutôt
  que de tomber, par accident, sur le même compte.

**Rien n'a été payé, et rien n'a été généré.** Chaque clip est posé
directement dans le dépôt — génération, emplacement réussi, `Clip` rempli,
frames écrites à la main — le geste documenté par
`essais/atelier_jetable_b11.py::_poser_un_clip`, étendu à un clip qui porte de
vraies images. **Aucun décodeur vidéo n'est sollicité** : les frames ne sont
jamais décodées, elles sont écrites telles quelles par ce script, exactement
comme un clip réel les aurait laissées après extraction.

## Ce qu'on vient voir à l'écran

1. Ouvrir la Galerie : le filtre **« clips »**, tout en bas du sélecteur de
   famille, doit montrer **122 tuiles** (jamais 127 — les cinq jetés restent
   invisibles).
2. Chaque tuile de clip porte un **coin de lecture** en bas à gauche — un
   petit triangle et sa durée en secondes — et rien d'autre ne la distingue
   d'une image au repos.
3. **Survoler une tuile** : les frames défilent en boucle, sans son, et
   reviennent à la première en sortant. Vérifier au réseau qu'aucune vidéo ne
   part — seule la couverture, puis la planche contact au premier survol.
4. Revenir à **« Toutes »** : clips et personnages se mélangent, triés par
   date.
5. Choisir la famille **« personnages »** : les clips disparaissent, les douze
   personnages restent.
6. Ouvrir un clip de la paire non départagée (`clip-departage-a` ou `-b`) :
   le bouton **« Garder celui-ci · jeter 1 autre »** doit être là.
7. La grille ne doit **pas** ramer en défilant les 122 tuiles.

## ⚠️ Ce qu'il ne faut pas faire

Rien ici ne coûte : chaque clip est écrit à la main, jamais commandé. Il n'y a
donc pas de geste à éviter — seulement, comme toujours, ne pas confondre ce
port-ci avec celui de l'auteur.
"""

from __future__ import annotations

import colorsys
import io
import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.animation import Clip  # noqa: E402
from atelier.domaine.generation import (  # noqa: E402
    Emplacement,
    Generation,
    Resultat,
    Statut,
)
from atelier.services import Atelier  # noqa: E402

PORT = 8487

TOTAL_CLIPS = 120
TOTAL_JETES = 5
TOTAL_PERSONNAGES = 12
COTE_FRAME = 64


def _teinte(index: int, total: int = 220) -> tuple[int, int, int]:
    """Une couleur qui tourne sur la roue teinte-saturation, une par clip —
    de quoi distinguer cent vingt tuiles d'un coup d'œil plutôt que de
    deviner une seule couleur répétée."""
    r, g, b = colorsys.hsv_to_rgb((index % total) / total, 0.55, 0.85)
    return (int(r * 255), int(g * 255), int(b * 255))


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _ecrire_frames(dossier: Path, images: int, teinte: tuple[int, int, int]) -> None:
    """Les frames d'un clip, à la main — jamais décodées.

    Un carré clair qui glisse de gauche à droite : la pellicule au survol doit
    montrer un vrai mouvement, pas la même image répétée cent vingt fois.
    """
    dossier.mkdir(parents=True, exist_ok=True)
    pas = max(COTE_FRAME // max(images, 1), 1)
    largeur_carre = COTE_FRAME // 4
    for numero in range(images):
        feuille = Image.new("RGB", (COTE_FRAME, COTE_FRAME), teinte)
        dessin = ImageDraw.Draw(feuille)
        x = min(numero * pas, COTE_FRAME - largeur_carre)
        dessin.rectangle(
            [x, COTE_FRAME // 3, x + largeur_carre, COTE_FRAME // 3 * 2],
            fill=(255, 255, 255),
        )
        feuille.save(dossier / f"{numero:04d}.png")


def _poser_un_clip(
    atelier: Atelier,
    projet: str,
    identifiant: str,
    *,
    images: int,
    cadence: float,
    teinte: tuple[int, int, int],
    lot: str,
    jete: bool,
    cree_le: float,
) -> None:
    """Un clip gardé, écrit directement dans le dépôt — génération,
    emplacement réussi, `Clip` rempli, frames sur le disque. Le geste de
    `essais/atelier_jetable_b11.py::_poser_un_clip`, étendu à un clip qui
    porte de vraies images : sans elles, ni la couverture ni la pellicule au
    survol n'auraient rien à montrer."""
    clip = Clip(
        travail=f"travail-{identifiant}",
        secondes=round(images / cadence) if cadence else 0,
        images=images,
        cadence=cadence,
        lot=lot,
        jete=jete,
    )
    generation = Generation(
        identifiant=identifiant,
        modele="double",
        demande={"prompt": f"un clip d'essai — {identifiant}"},
        parametres_resolus={},
        projet=projet,
        cree_le=cree_le,
        emplacements=[
            Emplacement(
                rang=0,
                statut=Statut.REUSSIE,
                resultat=Resultat(
                    fichier=f"{identifiant}.mp4",
                    largeur=0,
                    hauteur=0,
                    type_media="video/mp4",
                    octets=100_000,
                ),
            )
        ],
        clip=clip,
    )
    atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
    atelier.base.enregistrer(generation)
    _ecrire_frames(
        atelier.fichiers.dossier_images_clip(identifiant, 0), images, teinte
    )


def _image_personnage(teinte: tuple[int, int, int]) -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", (32, 32), teinte).save(tampon, format="PNG")
    return tampon.getvalue()


def peupler(atelier: Atelier, dossier: Path) -> dict:
    """Les Salines : ses cent vingt-deux clips, ses cinq jetés, ses douze
    personnages — rien de tout ça n'a été payé."""
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Les Salines"}),
            "le projet « Les Salines »",
        )["projet"]["identifiant"]

        # ── Les personnages, pour distinguer « Toutes » de « clips » ────────
        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        gabarits = dossier / "gabarits"
        gabarits.mkdir(parents=True, exist_ok=True)
        for i in range(TOTAL_PERSONNAGES):
            nom = f"Le saunier n°{i + 1}"
            personnage = _exiger(
                client.post("/api/characters", json={"nom": nom}),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            gabarit = gabarits / f"gabarit-{i}.png"
            gabarit.write_bytes(_image_personnage(_teinte(i, TOTAL_PERSONNAGES)))
            importe = _exiger(
                client.post(
                    "/api/assets/import",
                    json={"chemin": str(gabarit), "forcer": True},
                ),
                f"l'import d'une image pour « {nom} »",
            )
            _exiger(
                client.put(
                    f"/api/assets/{importe['asset']['identifiant']}/character",
                    json={"personnage": personnage, "pose": poses[0]},
                ),
                f"poser l'image de « {nom} »",
            )

        # ── Les cent vingt clips, distincts et non jetés ─────────────────────
        depart = time.time() - TOTAL_CLIPS - TOTAL_JETES - 5
        for i in range(TOTAL_CLIPS):
            images = 6 + (i % 8) * 4  # de 6 à 34 images — 0,75 s à 4,25 s à 8 i/s
            _poser_un_clip(
                atelier,
                projet,
                f"clip-{i:04d}",
                images=images,
                cadence=8.0,
                teinte=_teinte(i),
                lot=f"lot-{i:04d}",
                jete=False,
                cree_le=depart + i,
            )

        # ── Cinq clips jetés — ne doivent apparaître nulle part ──────────────
        for i in range(TOTAL_JETES):
            _poser_un_clip(
                atelier,
                projet,
                f"clip-jete-{i}",
                images=8,
                cadence=8.0,
                teinte=_teinte(200 + i),
                lot=f"lot-jete-{i}",
                jete=True,
                cree_le=depart + TOTAL_CLIPS + i,
            )

        # ── Une paire non départagée du même lot ─────────────────────────────
        for suffixe in ("a", "b"):
            _poser_un_clip(
                atelier,
                projet,
                f"clip-departage-{suffixe}",
                images=10,
                cadence=8.0,
                teinte=_teinte(210 if suffixe == "a" else 211),
                lot="lot-departage",
                jete=False,
                cree_le=depart + TOTAL_CLIPS + TOTAL_JETES,
            )

        # Ce que la route rend vraiment, relu ici pour être confronté à l'écran.
        # **Elle rend les jetés aussi** — comme le chantier le fait déjà pour
        # ceux qu'il tient en mémoire — et c'est l'écran qui les retire avant
        # affichage (`clip.jete`), pas la route.
        clips_de_la_route = _exiger(
            client.get("/api/clips", params={"projet": projet, "limite": 500}),
            "la liste des clips du jeu",
        )["clips"]
        clips_gardes = [c for c in clips_de_la_route if not c["clip"]["jete"]]

        return {
            "projet": projet,
            "clips_de_la_route": len(clips_de_la_route),
            "clips_gardes": len(clips_gardes),
            "clips_gardes_attendus": TOTAL_CLIPS + 2,
            "personnages": TOTAL_PERSONNAGES,
        }


def principal(sans_servir: bool = False) -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b22-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage            : {duree:.1f} s")
    print("  Appels payés       : 0  (rien n'a été généré ni commandé)")
    print(f"  Personnages créés  : {monte['personnages']}")
    print(
        f"  Clips rendus par GET /api/clips : {monte['clips_de_la_route']} "
        f"— jetés compris, c'est l'écran qui les retire"
    )
    print(
        f"  Clips à voir dans la galerie    : {monte['clips_gardes']} / "
        f"attendu {monte['clips_gardes_attendus']}"
    )
    if monte["clips_gardes"] != monte["clips_gardes_attendus"]:
        print(
            "  ATTENTION : le compte ne correspond pas — un clip jeté fuite, "
            "ou un clip gardé manque"
        )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Galerie › filtre « clips » (tout en bas du sélecteur de famille)")
    print(f"  → {monte['clips_gardes_attendus']} tuiles attendues, jamais "
          f"{monte['clips_gardes_attendus'] + TOTAL_JETES}")
    print("  → Survoler une tuile : les frames défilent, sans téléchargement de vidéo")
    print("  → « Toutes » mélange clips et personnages ; « personnages » n'en garde aucun")
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
