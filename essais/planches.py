# -*- coding: utf-8 -*-
"""Monter les planches contact d'un banc.

Deux formats, parce qu'ils répondent à deux questions différentes :

  · **par lot** — les dix sujets d'un même modèle, avec le guide de style en tête.
    C'est le seul format qui montre si un lot *forme une famille* : la cohérence
    ne se voit qu'en regardant les assets côte à côte, du même modèle, d'un coup.

  · **par sujet** — le même sujet à travers tous les modèles et tous les jets.
    C'est le format qui départage les modèles sur une tâche précise.

    py essais/planches.py resultats_univers          # les deux formats
    py essais/planches.py resultats_univers --sujet  # seulement par sujet
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent
CELL, BANDE, MARGE = 300, 22, 5
FOND, BANDE_J1, BANDE_J2, GUIDE_FOND = (22, 24, 28), (52, 58, 68), (38, 42, 50), (70, 55, 30)


def cellules(planche: Image.Image, d: ImageDraw.ImageDraw, items, cols: int, y0: int) -> None:
    """items = [(etiquette, chemin|None, couleur_bande)]"""
    for i, (etiquette, chemin, couleur) in enumerate(items):
        cx = MARGE + (i % cols) * (CELL + MARGE)
        cy = y0 + (i // cols) * (CELL + BANDE + MARGE)
        d.rectangle([cx, cy, cx + CELL, cy + BANDE - 2], fill=couleur)
        d.text((cx + 5, cy + 5), etiquette[:44], fill=(235, 240, 245))
        if chemin and chemin.exists():
            with Image.open(chemin) as im:
                im = im.convert("RGB")
                im.thumbnail((CELL, CELL), Image.NEAREST)
                planche.paste(im, (cx + (CELL - im.width) // 2, cy + BANDE + (CELL - im.height) // 2))
        else:
            d.text((cx + 8, cy + BANDE + 12), "(manquant)", fill=(120, 90, 90))


def monter(titre: str, items, cols: int, sortie: Path) -> None:
    rows = (len(items) + cols - 1) // cols
    W = cols * (CELL + MARGE) + MARGE
    H = rows * (CELL + BANDE + MARGE) + MARGE + 28
    planche = Image.new("RGB", (W, H), FOND)
    d = ImageDraw.Draw(planche)
    d.text((MARGE + 2, 8), titre, fill=(255, 255, 255))
    cellules(planche, d, items, cols, 28 + MARGE)
    planche.save(sortie, quality=90)
    print(f"-> {sortie.name}  {planche.size}")


def main() -> int:
    dossier = RACINE / (sys.argv[1] if len(sys.argv) > 1 else "resultats_univers")
    if not dossier.exists():
        print(f"introuvable : {dossier}")
        return 1

    sortie = RACINE / f"planches_{dossier.name.replace('resultats_', '').replace('resultats', 'identite')}"
    sortie.mkdir(exist_ok=True)
    guide = sorted((RACINE / "guide").glob("*.png"))

    jets = sorted(p.name for p in dossier.iterdir() if p.is_dir())
    configs = sorted({c.name for j in jets for c in (dossier / j).iterdir() if c.is_dir()})
    sujets: list[str] = []
    for j in jets:
        for c in (dossier / j).iterdir():
            for f in sorted(c.glob("*.png")):
                if f.stem not in sujets:
                    sujets.append(f.stem)
    sujets.sort()

    par_sujet_only = "--sujet" in sys.argv

    # ── par lot : la cohérence d'une famille ────────────────────────────────
    if not par_sujet_only:
        for j in jets:
            for c in configs:
                d = dossier / j / c
                if not d.exists():
                    continue
                items = [(f"GUIDE {g.stem}", g, GUIDE_FOND) for g in guide]
                items += [(s, d / f"{s}.png", BANDE_J1 if j == "jet1" else BANDE_J2) for s in sujets]
                monter(f"{c} — {j}   (guide en tete, puis le lot)", items, 4,
                       sortie / f"lot_{c}_{j}.jpg")

    # ── par sujet : départager les modèles ──────────────────────────────────
    for s in sujets:
        items = []
        for c in configs:
            for j in jets:
                items.append((f"{c} {j}", dossier / j / c / f"{s}.png",
                              BANDE_J1 if j == "jet1" else BANDE_J2))
        monter(f"{s} — tous modeles, tous jets", items, min(6, len(items)),
               sortie / f"sujet_{s}.jpg")

    print(f"\n{len(list(sortie.glob('*.jpg')))} planches dans {sortie}")
    return 0


if __name__ == "__main__":
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
