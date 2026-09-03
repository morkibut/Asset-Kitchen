# -*- coding: utf-8 -*-
"""Monter la bande d'un clip vidéo par la chaîne du produit, telle qu'elle est (E6).

**Ce que ce script fait.** Il prend le cycle que l'auteur a figé dans le
rapport — un début et une période, gardés dans `essais/notes-video.json` —,
prélève les huit images équidistantes du clip, les écrit dans
`resultats_video/<modele>/clip<N>/bande/`, puis les passe dans **la chaîne du
produit** : détourage par le bord à tolérance 28, recadrage sur **une fenêtre
commune** — l'union des boîtes, pieds sur la même ligne, jamais une fenêtre
par image —, grille à la cible du projet, quantification sur la palette du
projet. Il écrit la bande pixelisée dans `bande/pixel/` et son GIF.

**⚠️ Sa fenêtre commune est celle de la bande, et le produit n'en veut plus.**
Mesuré le 3 septembre 2026 : prendre la fenêtre sur les seules images gardées
cale bien les images *d'une* bande entre elles, mais deux bandes du même clip
n'ont alors plus la même échelle — 37 pixels de large au repos contre 41 en
marchant, sur le clip du 2 septembre, soit un personnage qui grandit de 10 % en
se mettant à marcher. **`A10` prend la fenêtre sur le clip entier.** Ce script
reste tel quel : les bandes que l'auteur a déjà notées ont été montées ainsi, et
les rejouer autrement rendrait ses notes incomparables.

**Ce qu'il n'invente pas.** Les fonctions sont celles d'`atelier/image/` ;
seule la fenêtre commune est posée ici, parce que le recadrage du produit
prend chaque image sur sa propre boîte — c'est le défaut nommé par
`docs/bilan-v3.md`, et ce montage ne doit pas le reproduire.

    .venv\\Scripts\\python.exe essais/monter_bande_video.py
    .venv\\Scripts\\python.exe essais/monter_bande_video.py --clip wan-2.2-5b:clip2 --debut 12 --periode 40

Gratuit : tout est sur le disque. Après lui, relancer
`essai_video_planche.py --rapport` montre la bande pixelisée sous la brute.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(DEPOT))

from atelier.domaine.recette import Grille, Passe, Quantification, Recette  # noqa: E402
from atelier.image.traitement import boite_opaque, detourer, quantifier, sur_grille  # noqa: E402

from socle_essais import PROJET, fenetre_commune, gif, notes_de, prelever, preparer_sortie  # noqa: E402

SORTIE = RACINE / "resultats_video"
DETOURAGE = Recette(passes=(Passe(moteur="bord", tolerance=28),))


def projet() -> dict:
    fiche = json.loads((DEPOT / "donnees" / "projets" / PROJET / "projet.json").read_text("utf-8"))
    univers = fiche.get("univers", {})
    return {
        "cible": int(univers.get("cible_px") or 64),
        "couleurs": int(univers.get("couleurs") or 32),
        "palette": tuple(univers.get("palette") or ()),
    }


def monter(clip: Path, debut: int, periode: int, reglages: dict, anime: str = "") -> dict:
    """Les huit images d'un cycle, par la chaîne du produit, sur une fenêtre commune.

    `anime` nomme l'animation quand un même clip en porte plusieurs — quatre
    secondes contiennent une marche *et* un repos (2 septembre 2026). Sans nom,
    la bande va dans `bande/` comme avant ; avec, dans `bande/<nom>/`.
    """
    frames = sorted((clip / "frames").glob("f*.png"))
    if not frames:
        raise FileNotFoundError(f"aucune image extraite dans {clip / 'frames'}")
    indices = prelever(len(frames), debut, periode)
    bande = clip / "bande" / anime if anime else clip / "bande"
    pixel = bande / "pixel"
    pixel.mkdir(parents=True, exist_ok=True)

    bruts: list[bytes] = []
    for rang, index in enumerate(indices, start=1):
        octets = frames[index].read_bytes()
        (bande / f"etape{rang}.png").write_bytes(octets)
        bruts.append(octets)

    # 1 · détourage par le bord, tolérance 28 — le moteur par défaut du produit.
    detourees = [detourer(DETOURAGE, o) for o in bruts]
    # 2 · une seule fenêtre : l'union des boîtes opaques. Le bas commun est la
    #     ligne de sol ; caméra fixe, donc pas de décalage à poser.
    boites = []
    for rgba in detourees:
        b = boite_opaque(rgba[:, :, 3] > 127)
        boites.append(b if b else (0, 0, rgba.shape[1] - 1, rgba.shape[0] - 1))
    x0, y0, x1, y1 = fenetre_commune(boites)
    cadrees = [rgba[y0 : y1 + 1, x0 : x1 + 1] for rgba in detourees]
    # 3 · grille à la cible du projet — homothétie, la même pour toutes les
    #     étapes puisqu'elles ont la même fenêtre ; 4 · palette du projet.
    grille = Grille(cible=reglages["cible"])
    quantification = Quantification(couleurs=reglages["couleurs"], palette=reglages["palette"])
    etapes: list[Image.Image] = []
    for rang, rgba in enumerate(cadrees, start=1):
        petite = sur_grille(np.ascontiguousarray(rgba), grille, case=False)
        finie = quantifier(np.ascontiguousarray(petite), quantification)
        image = Image.fromarray(finie, "RGBA")
        image.save(pixel / f"etape{rang}.png")
        etapes.append(image)
    # Le GIF, sur fond du produit, agrandi ×4 pour qu'on le voie.
    vues = []
    for e in etapes:
        fond = Image.new("RGB", e.size, (235, 235, 235))
        fond.paste(e, (0, 0), e)
        vues.append(fond.resize((e.width * 4, e.height * 4), Image.Resampling.NEAREST))
    gif(vues, pixel / "bande.gif")
    montage = {
        "anime": anime, "pixel": str(pixel),
        "debut": debut, "periode": periode, "indices": indices,
        "fenetre": [int(x0), int(y0), int(x1), int(y1)],
        "cible": reglages["cible"], "couleurs": reglages["couleurs"], "palette": len(reglages["palette"]),
        "etape_px": list(etapes[0].size),
    }
    (bande / "montage.json").write_text(json.dumps(montage, indent=1), "utf-8")
    return montage


def main() -> None:
    preparer_sortie()
    parseur = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parseur.add_argument("--clip", help="un seul clip, sous la forme modele:clipN")
    parseur.add_argument("--debut", type=int)
    parseur.add_argument("--periode", type=int)
    parseur.add_argument("--nom", help="le nom de l'animation, quand un clip en porte plusieurs")
    args = parseur.parse_args()

    notes = notes_de("video").get("notes", {})
    # **Un cycle par clip (`_choix`), et autant d'animations nommées qu'on en a
    # trouvé dans le même clip (`_cycles`).** Les deux vivent ensemble : le
    # premier est le cycle principal, les secondes portent chacune son nom.
    travaux: list[tuple[str, str, dict]] = [(ident, "", c) for ident, c in notes.get("_choix", {}).items()]
    for ident, liste in (notes.get("_cycles") or {}).items():
        travaux += [(ident, str(c.get("nom") or f"anime{rang}"), c) for rang, c in enumerate(liste, start=1)]
    if args.clip:
        if args.debut is None or args.periode is None:
            raise SystemExit("[x] --clip demande --debut et --periode")
        travaux = [(args.clip, args.nom or "", {"debut": args.debut, "periode": args.periode})]
    if not travaux:
        print("[i] aucun cycle fige dans essais/notes-video.json : ouvre le rapport, cale le cycle, « figer » ou "
              "« garder cette animation », telecharge le releve.")
        return
    reglages = projet()
    print(f"projet {PROJET} : cible {reglages['cible']} px · {reglages['couleurs']} couleurs · palette de {len(reglages['palette'])}")
    for ident, anime, c in travaux:
        modele, _, clip = ident.partition(":")
        dossier = SORTIE / modele / clip
        etiquette = f"{ident} {anime}".strip()
        if not (dossier / "clip.mp4").exists():
            print(f"{etiquette:<40} pas de clip sur le disque — saute")
            continue
        try:
            m = monter(dossier, int(c["debut"]), int(c["periode"]), reglages, anime)
        except Exception as erreur:  # noqa: BLE001
            print(f"{etiquette:<40} echec : {erreur}")
            continue
        print(f"{etiquette:<40} images {m['indices']} · etape {m['etape_px'][0]}x{m['etape_px'][1]} -> {m['pixel']}")
    print("relance essai_video_planche.py --rapport pour voir les bandes pixelisees sous les brutes.")


if __name__ == "__main__":
    main()
