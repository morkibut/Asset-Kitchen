# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A5 au navigateur, et **deux animations à comparer**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8450 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    py essais/atelier_jetable_a5.py

## Ce qu'il monte

Un personnage, un vrai clip — celui d'`A10`, écrit à la main image par image —,
et une marche taillée dedans. **Rien n'a été payé** : l'animateur est un double
qui rend ce clip-là et facture zéro.

## Ce qu'il fabrique avant même d'ouvrir

**Les deux animations de la même bande, côte à côte dans le dossier jetable** :
celle d'avant la tranche et celle d'aujourd'hui. Elles s'ouvrent d'un
double-clic, elles tournent toutes seules, et c'est la seule preuve qui vaille
pour un défaut qui ne se voit pas sur une image fixe.

⚠️ **Sur ce clip-là, la moitié « silhouette » de la tranche ne change rien du
tout**, et le journal l'imprime au lieu de le taire. Ce n'est pas un défaut :
c'est de la géométrie. Le clip d'`A10` est écrit à la main, ses bords sont nets
et droits — et *une droite qui passe par le centre d'un carré le coupe toujours
en deux moitiés égales*, donc « le pixel du centre » et « la majorité du bloc »
répondent exactement la même chose. Il faut un bord **irrégulier au pixel près**
pour que les deux se séparent, et c'est ce que laisse le découpage d'une vraie
image de modèle vidéo, jamais un dessin à la main. Le banc en fabrique un
exprès : `essais/essai_stabilite_bande.py`.

Ce qui se voit ici, en revanche, **se voit très bien** : la palette. Elle passe
de quarante-quatre couleurs dont neuf ne durent qu'une image, à quinze dont
aucune — et les deux images animées ne pèsent même pas le même poids.

## Ce qu'on vient voir à l'écran

- **La phrase sous l'aperçu qui tourne** : Galerie › la tuile du clip ›
  « Découper › ». Sous les deux boucles, *« Ce qui bouge entre les images — sur
  tout ce qui bouge, N % revient sur ses pas… »*.
- **Qu'elle disparaît sur une image seule** : ne gardez qu'une image sur la
  pellicule. Aucune paire, donc aucun chiffre — plutôt qu'un zéro qui passerait
  pour une mesure.
- **Qu'elle bouge quand on change un réglage** : la mesure se lit *en comparant
  deux réglages de la même bande*, jamais dans l'absolu.

## ⚠️ Ce qu'il ne faut pas faire

**Ne cliquez pas « Commander »** : l'animateur est doublé et facture zéro, mais
ce n'est pas ce qu'on vient regarder, et le clip qu'il rendrait serait le même
que celui qui est déjà là.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))
# `atelier_jetable_a4` est archivé (21 septembre 2026, retrait de `POST /clips`)
# mais son `peupler` reste importé d'ici plutôt que recopié.
sys.path.insert(0, str(RACINE / "essais" / "archive"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine import aseprite  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.image.bande import (  # noqa: E402
    assembler,
    en_image_animee,
    fenetre_commune,
    preparer,
)
from atelier.services import Atelier  # noqa: E402

# **Le peuplement est celui d'`A4`, importé et pas recopié.** Deux ateliers
# jetables qui monteraient chacun leur personnage finiraient par ne plus décrire
# le même produit, et c'est précisément ce qu'un essai jetable ne doit pas faire.
from atelier_jetable_a4 import peupler  # noqa: E402
from conftest import FournisseurDouble  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402

PORT = 8450
IMAGES = [12, 13, 14, 15, 16, 17, 18, 19]
CADENCE = 8


def deposer_les_deux_animations(
    atelier: Atelier, clip: str, dossier: Path
) -> tuple[Path, dict[str, object]]:
    """La même bande jouée par les deux chaînes, écrite en deux images animées.

    ⚠️ **L'*avant* est joué par le produit lui-même**, par le drapeau
    `stabiliser` que seuls ce script et le banc posent. Un essai qui recopierait
    l'ancienne chaîne mesurerait sa propre copie, et il continuerait d'annoncer
    un gain longtemps après que le produit aurait changé.
    """
    dehors = dossier / "sortie"
    dehors.mkdir(parents=True, exist_ok=True)

    montage = atelier.montage
    generation = montage._clip(clip)
    recette = montage.recette_du_jeu(generation)
    fichiers = montage._retenues(clip, IMAGES)
    preparees = [preparer(f.read_bytes(), recette) for f in fichiers]
    # La fenêtre se prend ici sur les images gardées ; le produit la prend sur le
    # clip entier. L'écart ne change rien à ce qu'on compare — les deux chaînes
    # reçoivent la même —, et le dire évite de croire que ce script rejoue le
    # montage à l'identique.
    fenetre = fenetre_commune(preparees, recette)

    releve: dict[str, object] = {}
    for nom, stabiliser in (("avant-a5", False), ("apres-a5", True)):
        planche = assembler(preparees, recette, fenetre, stabiliser=stabiliser)
        (dehors / f"{nom}-planche.png").write_bytes(planche.octets)
        (dehors / f"{nom}-anime.png").write_bytes(
            en_image_animee(
                planche.octets,
                planche.case_largeur,
                planche.case_hauteur,
                aseprite.ordre_des_images(planche.compte, aseprite.AVANT),
                aseprite.duree_en_ms(CADENCE),
            )
        )
        releve[nom] = planche.stabilite
    return dehors, releve


def _ligne(titre: str, mesure) -> str:
    return (
        f"    {titre:<10} {mesure.allers_retours:>4} allers-retours sur "
        f"{mesure.contour:>4} bascules — {100 * mesure.part_des_allers_retours:.1f} %"
    )


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper.")
        return 2

    dossier = Path(tempfile.mkdtemp(prefix="atelier-a5-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    personnage, clip = peupler(atelier, double, animateur)
    dehors, releve = deposer_les_deux_animations(atelier, clip, dossier)

    avant = releve["avant-a5"]
    apres = releve["apres-a5"]

    print()
    print(f"  Le personnage : {personnage}")
    print(f"  Le clip       : {clip}")
    print()
    print(f"  Les deux animations : {dehors}")
    for fichier in sorted(dehors.iterdir()):
        print(f"    {fichier.name}  ({fichier.stat().st_size} octets)")
    print()
    print("  Le bord qui revient sur ses pas — le grésil lui-même")
    print(_ligne("avant A5", avant))
    print(_ligne("après A5", apres))
    if avant.allers_retours == apres.allers_retours:
        print("    → aucun écart, et c'est attendu : ce clip est dessiné à la")
        print("      main, ses bords sont nets et droits. Sur un bord droit les")
        print("      deux chaînes répondent la même chose — voir l'en-tête.")
    print()
    print("  Les couleurs qui n'existent que dans une image")
    print(f"    avant A5   {avant.couleurs_d_une_image:>4} sur {avant.couleurs:>4}")
    print(f"    après A5   {apres.couleurs_d_une_image:>4} sur {apres.couleurs:>4}")
    print("    → c'est ça qu'on vient voir ici : les deux images animées ne")
    print("      pèsent même pas le même poids.")
    print()
    print("  À cliquer :")
    print("    Galerie › la tuile du clip › « Découper › »")
    print("    — sous les deux boucles : « Ce qui bouge entre les images… »")
    print("    — ne gardez qu'une image : la phrase disparaît")
    print("    — changez un réglage : elle bouge, et c'est ainsi qu'elle se lit")
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
