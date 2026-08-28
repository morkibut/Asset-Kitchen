# -*- coding: utf-8 -*-
"""Le banc du post-traitement — sortie brute du modèle contre sortie traitée.

`docs/ARCHITECTURE.md` §11 pose le risque ainsi : *« La qualité pixel art
directe — gravité faible — comparaison en T2 : sortie brute du modèle contre
sortie post-traitée. »* C'est le dixième critère d'acceptation de T2, et le seul
qui ne se vérifie pas dans les tests : il demande de vraies images de vrais
modèles, pas des carrés fabriqués pour l'occasion.

**Il ne coûte rien.** Les images sont déjà sur le disque — 96 sorties de douze
configurations, deux jets, plus les vingt sujets du banc d'univers et les
premières images de T1. Aucun appel n'est fait, aucune clé n'est lue. Le seul
coût est du temps de processeur, et c'est exactement le sujet.

Quatre questions, dans cet ordre :

1. **La sortie brute est-elle utilisable telle quelle ?** Un asset de jeu a
   besoin d'un fond transparent et d'une grille de pixel franche. On compte
   donc, sur le brut : la transparence, le nombre de couleurs, et la netteté de
   la grille rendue.
2. **De combien la grille dérive-t-elle à l'intérieur d'un même lot ?** C'est le
   constat qui décide de l'architecture — « dix modèles sur douze font dériver
   la taille du pixel ». On le remesure ici sur le corpus complet.
3. **Qu'est-ce que le post-traitement change, en chiffres ?**
4. **Est-ce que le sujet survit ?** Un détourage qui mange l'image ferait un
   gain sur tous les indicateurs et un asset inutilisable.

    Lancer :  py essais/essai_pixel.py
              py essais/essai_pixel.py --cible 32

Sortie : ce journal, `essais/mesures_pixel.json`, et une planche contact
`essais/planches/pixel_<cible>.png` qui montre chaque brut au-dessus de son
traité.
"""

from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.domaine.recette import (  # noqa: E402
    Bords,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)
from atelier.image import appliquer, mesurer_grille  # noqa: E402

SORTIE = RACINE / "mesures_pixel.json"
PLANCHES = RACINE / "planches"

# Les lots du corpus. Un lot est ce qui doit **former une famille** : le même
# modèle, le même jet, des sujets différents. C'est à l'intérieur d'un lot que
# la dérive de grille se voit, et c'est elle qui empêche deux assets de cohabiter.
LOTS = (
    ("univers · gpt-image-2 low · jet 1", "resultats_univers/jet1/gpt-image-2_low"),
    ("univers · gpt-image-2 low · jet 2", "resultats_univers/jet2/gpt-image-2_low"),
    ("identité · gpt-image-2 low", "resultats/jet1/gpt-image-2_low"),
    ("identité · gpt-image-2 high", "resultats/jet1/gpt-image-2_high"),
    ("identité · seedream 4.5", "resultats/jet1/seedream-4.5"),
    ("identité · seedream 5.0 lite", "resultats/jet1/seedream-5.0-lite"),
    ("identité · nano banana 2", "resultats/jet1/gemini-3.1-flash"),
    ("identité · qwen image 3", "resultats/jet1/qwen-image-3"),
)

# La recette du banc. C'est celle que l'écran propose par défaut, **plus** la
# quantification : à l'écran elle est grisée tant qu'aucune palette n'existe
# (US-65), mais la question posée ici est « qu'est-ce que le post-traitement
# rapporte », et se priver de l'étape qui fait les aplats répondrait à côté.
def recette_de(cible: int) -> Recette:
    return Recette(
        passes=(Passe(tolerance=28, durcissement=1),),
        recadrage=Recadrage(marge=0),
        grille=Grille(cible=cible, occupation=100),
        quantification=Quantification(couleurs=32),
        bords=Bords(aire_min=2),
    )


def images_de(dossier: Path) -> list[Path]:
    return sorted(
        p for p in dossier.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg")
    )


def mesurer(octets: bytes) -> dict[str, float | int]:
    """Ce qu'on sait dire d'une image, brute ou traitée, avec les mêmes yeux."""
    import io

    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))

    alpha = rgba[:, :, 3]
    visibles = alpha > 0
    couleurs = rgba[:, :, :3][visibles]
    uniques = len(np.unique(couleurs.reshape(-1, 3), axis=0)) if couleurs.size else 0
    pas, force = mesurer_grille(octets)

    return {
        "largeur": int(rgba.shape[1]),
        "hauteur": int(rgba.shape[0]),
        "couleurs": int(uniques),
        # Part de pixels transparents. Zéro sur un brut : aucun fournisseur ne
        # rend d'alpha — mesuré sur dix-sept images le 27 août 2026.
        "part_transparente": round(float(1 - visibles.mean()), 4),
        # Part de pixels ni tout à fait opaques ni tout à fait absents. C'est
        # l'anti-aliasing du contour, et c'est lui qui devient un liseré clair
        # si on réduit sans durcir l'alpha avant.
        "part_floue": round(float(((alpha > 0) & (alpha < 255)).mean()), 4),
        "grille_pas": pas,
        "grille_nettete": force,
    }


def journal(titre: str) -> None:
    print()
    print(titre)
    print("─" * len(titre))


def main() -> int:
    # Windows encode la sortie redirigée en cp1252 : un simple « ── » lève.
    # Trois lignes, jamais « on verra si ça pose problème » (`AGENTS.md`).
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    cible = 64
    if "--cible" in sys.argv:
        cible = int(sys.argv[sys.argv.index("--cible") + 1])
    recette = recette_de(cible)

    print("Banc du post-traitement — brut contre traité")
    print(f"cible {cible} px · recette {recette.empreinte()} · aucun appel, aucun coût")

    PLANCHES.mkdir(parents=True, exist_ok=True)
    releve: dict[str, object] = {
        "cible": cible,
        "recette": recette.en_json(),
        "lots": [],
    }
    vignettes: list[tuple[str, bytes, bytes]] = []
    depart = time.monotonic()

    for nom, chemin in LOTS:
        dossier = RACINE / chemin
        if not dossier.is_dir():
            print(f"  (absent) {chemin}")
            continue

        journal(nom)
        lignes = []
        for image in images_de(dossier):
            octets = image.read_bytes()
            avant = mesurer(octets)
            t = time.monotonic()
            rendu = appliquer(recette, octets)
            duree = time.monotonic() - t
            apres = mesurer(rendu.octets)
            lignes.append(
                {"fichier": image.name, "avant": avant, "apres": apres, "duree_s": round(duree, 3)}
            )
            print(
                f"  {image.name:20} "
                f"{avant['largeur']:>5}×{avant['hauteur']:<5} "
                f"{avant['couleurs']:>6} coul. "
                f"grille {avant['grille_pas']:>3} px (netteté {avant['grille_nettete']:.2f})"
                f"  →  {apres['largeur']}×{apres['hauteur']} "
                f"{apres['couleurs']:>3} coul. "
                f"{apres['part_transparente'] * 100:>4.0f}% transparent"
                f"  {duree:.2f} s"
            )
            if len(vignettes) < 12:
                vignettes.append((image.stem, octets, rendu.octets))

        # **Écrit au fur et à mesure, jamais à la fin.** Le banc du 26 août s'est
        # arrêté à quatre configurations sur douze ; ce qui était déjà sur le
        # disque n'a pas été reperdu (`docs/PIEGES.md`).
        releve["lots"].append({"nom": nom, "chemin": chemin, "images": lignes})
        SORTIE.write_text(
            json.dumps(releve, indent=1, ensure_ascii=False), encoding="utf-8"
        )

        pas = [l["avant"]["grille_pas"] for l in lignes if l["avant"]["grille_pas"]]
        if len(pas) > 1:
            print(
                f"  → dérive de grille dans le lot : {min(pas)} à {max(pas)} px, "
                f"facteur {max(pas) / max(1, min(pas)):.1f}"
            )

    verdict(releve, time.monotonic() - depart)
    monter_planche(vignettes, cible)
    print(f"\n-> {SORTIE.relative_to(RACINE.parent)}")
    return 0


def verdict(releve: dict, secondes: float) -> None:
    """Ce que le banc tranche. Écrit ici, recopié dans `docs/ARCHITECTURE.md` §11."""
    toutes = [i for lot in releve["lots"] for i in lot["images"]]
    if not toutes:
        print("\nAucune image : rien à trancher.")
        return

    journal("Verdict")
    brutes_avec_alpha = sum(1 for i in toutes if i["avant"]["part_transparente"] > 0.01)
    couleurs_avant = statistics.median(i["avant"]["couleurs"] for i in toutes)
    couleurs_apres = statistics.median(i["apres"]["couleurs"] for i in toutes)
    flou_avant = statistics.median(i["avant"]["part_floue"] for i in toutes)
    flou_apres = statistics.median(i["apres"]["part_floue"] for i in toutes)
    vides = [i for i in toutes if i["apres"]["part_transparente"] > 0.995]
    duree = statistics.median(i["duree_s"] for i in toutes)

    print(f"  {len(toutes)} images, {len(releve['lots'])} lots, {secondes:.0f} s au total")
    print(f"  brutes avec transparence      : {brutes_avec_alpha} / {len(toutes)}")
    print(f"  couleurs, médiane             : {couleurs_avant:.0f} → {couleurs_apres:.0f}")
    print(f"  contour anti-aliasé, médiane  : {flou_avant:.1%} → {flou_apres:.1%}")
    print(f"  sujets mangés par le détourage: {len(vides)} / {len(toutes)}")
    print(f"  temps par image, médiane      : {duree:.2f} s")

    ecarts = []
    for lot in releve["lots"]:
        pas = [i["avant"]["grille_pas"] for i in lot["images"] if i["avant"]["grille_pas"]]
        if len(pas) > 1:
            ecarts.append(max(pas) / max(1, min(pas)))
    if ecarts:
        print(f"  dérive de grille par lot      : facteur {min(ecarts):.1f} à {max(ecarts):.1f}")
        print(
            "  ↑ à prendre comme un plancher : `mesurer_grille` tombe juste "
            "sur les sujets fins et prend une harmonique sur les plus "
            "grossiers, donc elle sous-estime l'écart. Le facteur cinq du "
            "26 août reste le chiffre de référence — il a été relevé à "
            "l'œil, image par image."
        )


def monter_planche(vignettes: list[tuple[str, bytes, bytes]], cible: int) -> None:
    """Brut au-dessus, traité en dessous. La comparaison se fait à l'œil aussi."""
    if not vignettes:
        return
    import io

    CELL, BANDE, MARGE = 220, 20, 6
    largeur = MARGE + len(vignettes) * (CELL + MARGE)
    hauteur = MARGE + 2 * (CELL + BANDE + MARGE)
    planche = Image.new("RGB", (largeur, hauteur), (22, 24, 28))
    dessin = ImageDraw.Draw(planche)

    for colonne, (nom, brut, traite) in enumerate(vignettes):
        x = MARGE + colonne * (CELL + MARGE)
        for rang, (etiquette, octets) in enumerate(
            (("brut", brut), (f"traité {cible}px", traite))
        ):
            y = MARGE + rang * (CELL + BANDE + MARGE)
            dessin.rectangle([x, y, x + CELL, y + BANDE - 2], fill=(52, 58, 68))
            dessin.text((x + 4, y + 4), f"{etiquette} · {nom[:22]}", fill=(235, 240, 245))
            with Image.open(io.BytesIO(octets)) as image:
                # Fond magenta : ce qui a été mangé dans le sujet saute aux yeux.
                vue = Image.new("RGB", (CELL, CELL), (60, 20, 55))
                mise = image.convert("RGBA").resize((CELL, CELL), Image.Resampling.NEAREST)
                vue.paste(mise, (0, 0), mise)
                planche.paste(vue, (x, y + BANDE))

    chemin = PLANCHES / f"pixel_{cible}.png"
    planche.save(chemin)
    print(f"-> {chemin.relative_to(RACINE.parent)}  {planche.size}")


if __name__ == "__main__":
    raise SystemExit(main())
