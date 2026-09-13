# -*- coding: utf-8 -*-
"""Les images de la maquette V3, tirées d'un **vrai clip payé**.

**Pourquoi ce script existe.** Une maquette dessinée à la main montre ce qu'on
espère ; celle-ci montre ce que l'atelier rend déjà. Toutes ses images viennent
du clip `seed20mini-repos-marche/clip1` — cinq secondes, 121 images, 0,067 $
facturés le 2 septembre 2026 — et la bande pixelisée est calculée par la chaîne
du produit : détourage par le bord, fenêtre commune, grille à la cible du
projet, palette du projet.

**Ce qu'il prépare, et pourquoi ce n'est pas une bande toute faite.** L'auteur a
demandé, le 3 septembre 2026, de pouvoir choisir ses images **une par une**, de
refaire le découpage à la main, et de régler la recette. Une bande calculée ici
et servie telle quelle ne montrerait rien de tout cela. Ce script livre donc la
**matière** — les images du clip déjà détourées, sur la fenêtre du clip entier —
et la page refait le reste : recadrer, mettre à la grille, ramener à la palette.
C'est la même arithmétique, faite dans le navigateur.

**Ce qui reste hors de portée de la page, et c'est écrit à l'écran** : la
tolérance du détourage. La changer demande les pixels d'origine, que la maquette
n'embarque pas. Dans l'atelier elle se règle comme le reste.

    .venv\\Scripts\\python.exe essais/maquette_v3.py

Gratuit : tout est déjà sur le disque, rien ne part chez un fournisseur.
"""

from __future__ import annotations

import base64
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(DEPOT))

from atelier.domaine.recette import Passe, Recette  # noqa: E402
from atelier.image.traitement import boite_opaque, detourer  # noqa: E402

from socle_essais import PROJET, fenetre_commune, prelever  # noqa: E402

CLIP = RACINE / "resultats_video/seed20mini-repos-marche/clip1"
ENTREE = RACINE / "resultats_video/entree-480x480.png"
PAGE = DEPOT / "docs/archive/maquettes-v3/01-du-sprite-a-la-bande.html"

# La tolérance du détourage par le bord, celle du montage des essais. C'est le
# seul réglage de la recette que la page ne peut pas rejouer : il travaille sur
# les pixels d'origine, et la maquette n'embarque que le résultat.
TOLERANCE = 28
DETOURAGE = Recette(passes=(Passe(moteur="bord", tolerance=TOLERANCE),))

# Le côté d'une image du clip, en pixels d'écran, pour la boucle de gauche et
# pour la pellicule.
COTE = 120

# La hauteur des images **détourées** que la page recalcule. Cent vingt-huit
# pour une cible de soixante-quatre : il faut de la marge au-dessus de la cible
# pour qu'un recadrage à la main ait de quoi mordre, et deux fois est le rapport
# qui garde une réduction propre.
HAUTEUR_SUJET = 128
# Ramener les images détourées à ce nombre de couleurs avant de les enregistrer.
# Elles finiront à vingt-quatre de toute façon ; quatre-vingt-seize n'enlève
# rien de visible et fait perdre un tiers du poids de la page.
COULEURS_SUJET = 96

# Les deux animations que ce clip porte, et où elles sont. Le texte envoyé
# minutait : repos immobile de 0 à 2 s, transition jusqu'à 2,5 s, marche à
# vitesse constante ensuite. À 24 images par seconde, cela donne ces fenêtres.
# **Ce sont des propositions, plus un découpage** : la page les offre d'un clic,
# et l'auteur ajoute ou retire ensuite les images qu'il veut.
ANIMATIONS = [
    {"nom": "repos", "debut": 4, "periode": 40},
    {"nom": "marche", "debut": 66, "periode": 24},
]

DEBUT = '<script id="planches" type="application/json">'
FIN = "</script>"


def projet() -> dict:
    fiche = json.loads(
        (DEPOT / "donnees" / "projets" / PROJET / "projet.json").read_text("utf-8")
    )
    univers = fiche.get("univers", {})
    return {
        "cible": int(univers.get("cible_px") or 64),
        "couleurs": int(univers.get("couleurs") or 32),
        "palette": [str(c) for c in (univers.get("palette") or ())],
    }


def planche(images: list[Image.Image], *, format_: str, colonnes: int = 0) -> dict:
    """Toutes les images dans une seule, **en grille**, et de quoi la relire.

    **Une planche plutôt que N fichiers** : la page découpe dedans, ce qui ne
    charge rien pendant le mouvement et garde le métronome unique. Une centaine
    d'images chargées une par une clignoteraient au premier tour.

    **En grille et non en ligne**, et c'est un défaut payé le 3 septembre 2026 :
    cent vingt et une images côte à côte, agrandies à la taille d'affichage,
    demandaient au navigateur une surface de cinquante mille pixels de large. Au
    delà de seize mille trois cent quatre-vingt-quatre, il ne dessine plus rien —
    pas d'erreur, pas d'avertissement, une zone vide. Onze sur onze tient dans
    mille trois cents.
    """
    largeur, hauteur = images[0].size
    colonnes = colonnes or max(1, math.ceil(math.sqrt(len(images))))
    lignes = math.ceil(len(images) / colonnes)
    photo = format_ == "JPEG"
    grille = Image.new(
        "RGB" if photo else "RGBA",
        (largeur * colonnes, hauteur * lignes),
        (235, 235, 235) if photo else (0, 0, 0, 0),
    )
    for rang, image in enumerate(images):
        grille.paste(image, ((rang % colonnes) * largeur, (rang // colonnes) * hauteur))
    tampon = io.BytesIO()
    if photo:
        grille.save(tampon, format="JPEG", quality=82, optimize=True)
        prefixe = "data:image/jpeg;base64,"
    else:
        grille.save(tampon, format="PNG", optimize=True)
        prefixe = "data:image/png;base64,"
    return {
        "src": prefixe + base64.b64encode(tampon.getvalue()).decode("ascii"),
        "largeur": largeur,
        "hauteur": hauteur,
        "colonnes": colonnes,
        "nombre": len(images),
    }


def alleger(image: Image.Image, couleurs: int) -> Image.Image:
    """Moins de couleurs, la transparence gardée telle quelle.

    La transparence est mise de côté avant de quantifier et remise après : la
    quantification de Pillow ne sait pas ce qu'est un bord à moitié transparent,
    et le lui laisser dessinerait un liseré sur chaque contour.
    """
    alpha = image.getchannel("A")
    plate = image.convert("RGB").quantize(colors=couleurs).convert("RGBA")
    plate.putalpha(alpha)
    return plate


def composer() -> dict:
    frames = sorted((CLIP / "frames").glob("f*.png"))
    if not frames:
        raise FileNotFoundError(f"aucune image extraite dans {CLIP / 'frames'}")
    reglages = projet()

    film = []
    for chemin in frames:
        with Image.open(chemin) as ouverte:
            film.append(ouverte.convert("RGB").resize((COTE, COTE), Image.LANCZOS))

    # ── Le détourage, une fois pour toutes ──────────────────────────────────
    detourees = [detourer(DETOURAGE, chemin.read_bytes()) for chemin in frames]
    boites = []
    for rgba in detourees:
        boite = boite_opaque(rgba[:, :, 3] > 127)
        boites.append(boite if boite else (0, 0, rgba.shape[1] - 1, rgba.shape[0] - 1))

    # ── **La fenêtre du clip entier, et non celle d'une bande** ─────────────
    #
    # Mesuré le 3 septembre 2026, et cela renverse ce que le montage des essais
    # faisait. Sur ce clip, la fenêtre du repos seul fait 217 × 376 et celle de
    # la marche 246 × 380 : ramenées à 64 pixels de haut, le personnage sort à
    # 37 pixels de large dans l'une et 41 dans l'autre. **Le même personnage
    # change de taille de dix pour cent entre deux de ses animations**, et le
    # jeu le verrait grandir en se mettant à marcher.
    #
    # Une fenêtre par bande cale les images **d'une bande** entre elles ; il
    # faut une fenêtre par clip pour caler **les bandes** entre elles. C'est
    # celle-ci qui part vers la page, et la page sait montrer l'autre.
    x0, y0, x1, y1 = fenetre_commune(boites)
    largeur_sujet = round((x1 - x0 + 1) * HAUTEUR_SUJET / (y1 - y0 + 1))

    sujets = []
    for rgba in detourees:
        decoupe = np.ascontiguousarray(rgba[y0 : y1 + 1, x0 : x1 + 1])
        sujets.append(
            Image.fromarray(decoupe, "RGBA").resize(
                (largeur_sujet, HAUTEUR_SUJET), Image.LANCZOS
            )
        )

    donnees = {
        "clip": {
            "images": len(frames),
            "cadence": 24,
            "cote": COTE,
            "cible": reglages["cible"],
            "couleurs": reglages["couleurs"],
            "tolerance": TOLERANCE,
        },
        "palette": reglages["palette"],
        "film": planche(film, format_="JPEG"),
        # Les images détourées, sur la fenêtre du clip entier. C'est **la
        # matière** avec laquelle la page recalcule tout : recadrer, mettre à la
        # grille, ramener à la palette. Rien n'y est cuit d'avance.
        "sujet": planche([alleger(im, COULEURS_SUJET) for im in sujets], format_="PNG"),
        "fenetre_du_clip": [int(x0), int(y0), int(x1), int(y1)],
        # La taille **vraie** de cette fenêtre, en pixels du clip. La page en a
        # besoin : ses images de sujet sont ramenées à 128 pixels de haut, et
        # calculer la largeur de la bande sur cette hauteur-là donnerait un pixel
        # de trop une fois sur deux — 42 au lieu de 41, ce qui se voit.
        "taille_vraie": [int(x1 - x0 + 1), int(y1 - y0 + 1)],
        "animations": [
            {
                "nom": animation["nom"],
                "indices": prelever(
                    len(frames), animation["debut"], animation["periode"]
                ),
                "debut": animation["debut"],
                "periode": animation["periode"],
            }
            for animation in ANIMATIONS
        ],
    }

    cible = reglages["cible"]
    print(f"  fenetre du clip entier : {x1 - x0 + 1}x{y1 - y0 + 1} px")
    for animation, ligne in zip(ANIMATIONS, donnees["animations"]):
        propre = fenetre_commune([boites[i] for i in ligne["indices"]])
        l, h = propre[2] - propre[0] + 1, propre[3] - propre[1] + 1
        print(
            f"  {animation['nom']:<8} {len(ligne['indices'])} images · "
            f"fenetre de bande {l}x{h} -> {round(l * cible / h)} px de large ; "
            f"fenetre de clip -> {round((x1 - x0 + 1) * cible / (y1 - y0 + 1))} px"
        )

    if ENTREE.exists():
        with Image.open(ENTREE) as ouverte:
            donnees["entree"] = planche(
                [ouverte.convert("RGB").resize((240, 240), Image.LANCZOS)],
                format_="JPEG",
            )
    return donnees


def main() -> None:
    donnees = composer()
    texte = PAGE.read_text("utf-8")
    debut = texte.index(DEBUT) + len(DEBUT)
    fin = texte.index(FIN, debut)
    PAGE.write_text(
        texte[:debut] + json.dumps(donnees, separators=(",", ":")) + texte[fin:],
        "utf-8",
    )
    print(f"ecrit : {PAGE.name} - {PAGE.stat().st_size / 1024:.0f} Ko")


if __name__ == "__main__":
    main()
