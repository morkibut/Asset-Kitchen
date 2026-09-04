# -*- coding: utf-8 -*-
"""Ce que le cadrage faisait dériver, mesuré sur un vrai clip. GRATUIT.

Banc de `A2`. Il ne paie rien : le clip est déjà sur le disque, payé le
2 septembre 2026, et tout se calcule sur le processeur.

**Ce qu'il compare.** Trois façons de cadrer les mêmes images :

1. **la boîte de chaque image** — ce que le produit faisait, et le défaut : un
   bras tendu agrandit la boîte, donc réduit tout le personnage ;
2. **la fenêtre de la bande** — l'erreur juste à côté de la bonne réponse. Elle
   cale les images *d'une* bande entre elles, et laisse deux bandes du même clip
   sortir à deux échelles ;
3. **la fenêtre du clip entier** — la réponse : la même assise partout, et rien
   ne bouge au changement d'animation.

**Le clip par défaut est celui que l'auteur décrit** comme *« il avance de
gauche à droite puis repart en arrière en moonwalk »* — le plus dur des treize,
et c'est pour ça qu'il sert : le personnage y traverse le cadre, donc la boîte y
change beaucoup d'une image à l'autre.

    py essais/essai_fenetre_commune.py
    py essais/essai_fenetre_commune.py --clip <chemin vers un .mp4>

Sortie : le tableau en console, et `essais/mesures_fenetre_commune.json`, qui
est versionné — un chiffre cité dans un document doit se relire dans le dépôt.

Il demande le décodeur de clips : `uv pip install -e ".[video]"`.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np  # noqa: E402

from atelier.domaine.recette import Bords, Grille, Passe, Recette  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.image.bande import fenetre_commune, monter, preparer  # noqa: E402
from atelier.image.traitement import boite_opaque  # noqa: E402

CLIP_PAR_DEFAUT = RACINE / "essais" / "resultats_video" / "wan-3.0" / "clip1" / "clip.mp4"

# La recette d'un sprite de jeu, telle que le produit la pose : détourage par le
# bord — le fond d'un clip est uni à une tolérance près —, case de 64, et les
# miettes nettoyées. Écrite ici plutôt que lue dans un projet : ce banc mesure le
# cadrage, pas les réglages d'un jeu particulier.
RECETTE = Recette(
    passes=(Passe(moteur="bord", tolerance=28),),
    grille=Grille(cible=64, occupation=100),
    bords=Bords(aire_min=4),
)


def _boite(image: np.ndarray) -> tuple[int, int, int, int] | None:
    return boite_opaque(image[:, :, 3])


def _taille_rendue(octets: bytes) -> tuple[int, int]:
    """La largeur et la hauteur de ce qui reste opaque dans la case rendue.

    C'est **ce que le jeu voit** : la case fait toujours 64, ce qui varie est ce
    qu'il y a dedans.
    """
    import io

    from PIL import Image

    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    boite = boite_opaque(rgba[:, :, 3])
    if boite is None:
        return 0, 0
    x0, y0, x1, y1 = boite
    return x1 - x0 + 1, y1 - y0 + 1


def principal() -> int:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--clip", default=str(CLIP_PAR_DEFAUT))
    arguments.add_argument(
        "--coupe",
        type=float,
        default=0.5,
        help="où couper le clip en deux bandes, en part du clip (0,5 par défaut)",
    )
    options = arguments.parse_args()

    chemin = Path(options.clip)
    if not chemin.is_file():
        print(f"Aucun clip à « {chemin} ».")
        print("Ce banc lit un clip déjà payé ; il n'en commande aucun.")
        return 2
    manque = decodeur.indisponible()
    if manque:
        print(manque)
        return 2

    with tempfile.TemporaryDirectory(prefix="fenetre-") as temporaire:
        dossier = Path(temporaire)
        mesure = decodeur.extraire(chemin, dossier)
        fichiers = sorted(dossier.glob("*.png"))
        print(f"{chemin.name} — {mesure.images} images à {mesure.cadence:g} i/s")
        print("Détourage et mesure des boîtes…")
        preparees = [preparer(f.read_bytes(), RECETTE) for f in fichiers]

    boites = [b for b in (_boite(img) for img in preparees) if b]
    largeurs = [b[2] - b[0] + 1 for b in boites]
    hauteurs = [b[3] - b[1] + 1 for b in boites]

    coupe = max(1, min(len(preparees) - 1, int(len(preparees) * options.coupe)))
    bandes = {"première moitié": preparees[:coupe], "seconde moitié": preparees[coupe:]}

    du_clip = fenetre_commune(preparees, RECETTE)
    par_bande = {nom: fenetre_commune(images, RECETTE) for nom, images in bandes.items()}

    # ── Ce qui se mesure ici, et pourquoi ce n'est pas la taille du sprite ──
    #
    # **La taille du sprite rendu ne dit rien toute seule** : un personnage qui
    # marche *est* plus large qu'un personnage au repos, et le mesurer ferait
    # passer une différence de pose pour une dérive de cadrage. Ce qui se mesure
    # est donc **le facteur appliqué** — le nombre par lequel chaque image est
    # réduite. Il doit être le même partout dans un clip ; tout ce qui l'en écarte
    # est de la dérive, et rien d'autre.
    #
    # Le second chiffre est la **hauteur de référence** : ce que devient un même
    # sujet de la hauteur médiane du clip, selon le facteur qu'on lui applique.
    # C'est la traduction du premier en pixels, celle qu'on voit à l'écran.
    reference = statistics.median(hauteurs)
    facteurs_seuls = [_facteur(b) for b in boites]
    facteurs_bandes = {nom: _facteur(f.en_tuple()) for nom, f in par_bande.items()}
    facteur_clip = _facteur(du_clip.en_tuple())

    print()
    print("  Les boîtes, image par image")
    print(f"    largeur   min {min(largeurs)}  médiane {statistics.median(largeurs):.0f}  max {max(largeurs)}")
    print(f"    hauteur   min {min(hauteurs)}  médiane {statistics.median(hauteurs):.0f}  max {max(hauteurs)}")
    print()
    print(f"  Ce que devient un sujet de {reference:.0f} px de haut, selon le cadre")
    print(
        f"    la boîte de chaque image   {reference * min(facteurs_seuls):.1f} à "
        f"{reference * max(facteurs_seuls):.1f} px      dérive {_ecart(facteurs_seuls):.1%}"
    )
    for nom, facteur in facteurs_bandes.items():
        fenetre = par_bande[nom]
        print(
            f"    {nom:<25} {reference * facteur:.1f} px"
            f"   (fenêtre {fenetre.largeur} × {fenetre.hauteur})"
        )
    print(
        f"    …soit d'une bande à l'autre                     "
        f"dérive {_ecart(list(facteurs_bandes.values())):.1%}"
    )
    print(
        f"    le clip entier            {reference * facteur_clip:.1f} px partout"
        f"   (fenêtre {du_clip.largeur} × {du_clip.hauteur},"
        f" {du_clip.taches_ecartees} taches écartées)"
    )
    print("                                                    dérive 0,0 %"
          "   ← la même assise partout")

    releve = {
        "_recette": {
            "cible": RECETTE.grille.cible,
            "occupation": RECETTE.grille.occupation,
            "aire_min": RECETTE.bords.aire_min,
            "detourage": "bord, tolérance 28",
        },
        "images": len(preparees),
        "cadence": mesure.cadence,
        "hauteur_de_reference": reference,
        "boites": {
            "largeur": {"min": min(largeurs), "max": max(largeurs)},
            "hauteur": {"min": min(hauteurs), "max": max(hauteurs)},
        },
        "chaque_image": {
            "facteur_min": min(facteurs_seuls),
            "facteur_max": max(facteurs_seuls),
            "derive": _ecart(facteurs_seuls),
        },
        "par_bande": {
            nom: {
                "fenetre": par_bande[nom].en_json(),
                "facteur": facteurs_bandes[nom],
                "hauteur_rendue": reference * facteurs_bandes[nom],
            }
            for nom in bandes
        },
        "derive_entre_bandes": _ecart(list(facteurs_bandes.values())),
        "par_clip": {
            "fenetre": du_clip.en_json(),
            "facteur": facteur_clip,
            "hauteur_rendue": reference * facteur_clip,
            "derive": 0.0,
        },
    }
    # **Le relevé s'accumule au lieu de s'écraser**, et il est rangé par clip.
    # Un banc qui écrase sa sortie oblige à relancer les trois clips pour
    # comparer deux chiffres, et c'est le genre de friction qui fait qu'on cite
    # un nombre de mémoire.
    sortie = RACINE / "essais" / "mesures_fenetre_commune.json"
    deja: dict[str, object] = {}
    if sortie.is_file():
        try:
            deja = json.loads(sortie.read_text(encoding="utf-8"))
        except ValueError:  # pragma: no cover — fichier abîmé, on repart de zéro
            deja = {}
    deja[f"{chemin.parent.parent.name}/{chemin.parent.name}"] = releve
    sortie.write_text(
        json.dumps(deja, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print()
    print(f"Relevé écrit dans {sortie.relative_to(RACINE)}")
    return 0


def _facteur(boite: tuple[int, int, int, int]) -> float:
    """Le nombre par lequel cette boîte est réduite pour tenir dans la case.

    C'est la formule de `sur_grille`, et elle est recopiée ici **exprès** : un
    banc qui appellerait la fonction du produit vérifierait la fonction contre
    elle-même. Ce qui se mesure est que la formule, appliquée à des boîtes
    différentes, rend des facteurs différents — pas que le code sait multiplier.
    """
    from atelier.domaine.recette import cote_du_sujet

    x0, y0, x1, y1 = boite
    dedans = cote_du_sujet(RECETTE.grille.cible, RECETTE.grille.occupation)
    return dedans / max(x1 - x0 + 1, y1 - y0 + 1)


def _ecart(valeurs: list[float]) -> float:
    """L'écart relatif entre le plus grand et le plus petit. Zéro quand c'est
    la même chose partout, ce qui est très exactement ce qu'on cherche."""
    if not valeurs or min(valeurs) <= 0:
        return 0.0
    return max(valeurs) / min(valeurs) - 1


if __name__ == "__main__":
    raise SystemExit(principal())
