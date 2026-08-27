# -*- coding: utf-8 -*-
"""Les deux moteurs de détourage, l'un contre l'autre — sur de vraies images.

**Ce chemin de code n'avait jamais été exécuté.** `AGENTS.md` le disait
explicitement depuis T2 : le grisé du second moteur était vérifié, l'appel au
moteur ne l'était pas, et le test qui le concerne se sautait en son absence. La
dette a été reportée de T2 à T4, puis de T4 à T5. Ce banc est ce qui la solde.

**Il ne coûte rien.** Les images sont déjà sur le disque et aucun appel ne part
chez le fournisseur. Le seul coût est du temps de processeur — et c'est
exactement ce qu'on vient mesurer, puisque c'est le seul argument contre le
second moteur.

Deux questions, et elles ne se posent pas sur les mêmes images :

1. **Sur ce que le produit fabrique**, le second moteur apporte-t-il quelque
   chose ? Toutes ces images ont un fond plat, donc le remplissage depuis le
   bord y est déjà bon. La réponse attendue est « non, et c'est très bien » —
   ce qui justifie qu'il reste facultatif.
2. **Sur ce que le produit ne fabrique pas** — une image trouvée, collée au
   tableau d'inspiration, dont le fond n'est pas plat —, le premier moteur
   échoue-t-il vraiment ? C'est l'unique raison d'exister du second, et elle
   n'avait jamais été vérifiée non plus.

Faute d'image à fond chargé dans le dépôt — les 188 images sur disque ont
toutes un fond plat, écart de bordure médian 1,2 sur 255 —, le second cas est
**composé** : un sujet réel du guide, posé sur un fond dégradé et bruité. C'est
dit plutôt que caché : une comparaison sur une image fabriquée pour l'occasion
vaut moins qu'une comparaison sur une image trouvée, et le jour où une vraie
image du tableau résistera au détourage par défaut, c'est elle qu'il faudra
mettre ici.

    Lancer :  py essais/essai_detourage_modele.py
              py essais/essai_detourage_modele.py --tout   (les 188, plus lent)

Sortie : ce journal, `essais/mesures_detourage.json`, et une planche contact
`essais/planches/detourage_moteurs.png` — bord au-dessus, modèle en dessous.
"""

from __future__ import annotations

import io
import json
import statistics
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.domaine.recette import BORD, MODELE, Passe, Recette  # noqa: E402
from atelier.image import detourer, raison_moteur  # noqa: E402

SORTIE = RACINE / "mesures_detourage.json"
PLANCHES = RACINE / "planches"

# Ce sur quoi le banc travaille par défaut : peu d'images, mais de vraies, et
# choisies pour couvrir les cas qui ont servi à décider. `--tout` élargit au
# corpus complet — le second moteur met une demi-seconde par image, donc 188
# images font deux minutes, et ce n'est pas ce qu'on regarde en premier.
CHOISIES = (
    ("guide · goblin", "guide/01_goblin.png"),
    ("guide · nain", "guide/02_nain.png"),
    ("gpt-image-2 high · marche", "resultats/jet1/gpt-image-2_high/C_marche.png"),
    ("seedream-4.5 · base", "resultats/jet1/seedream-4.5/A_base.jpg"),
    ("gemini-3-pro · dos", "resultats/jet1/gemini-3-pro/B_dos.png"),
    ("flux2-klein-4b · autre", "resultats/jet1/flux2-klein-4b/D_autre.jpg"),
)


def main() -> int:
    # Windows encode la sortie redirigée en cp1252 : un simple « ── » lève.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    raison = raison_moteur(MODELE)
    if raison is not None:
        print(f"Le second moteur n'est pas là — {raison}.")
        print('Pour l\'installer :  uv pip install -e ".[detourage]"')
        return 1

    images = _corpus("--tout" in sys.argv)
    print("═" * 78)
    print("  LES DEUX MOTEURS DE DÉTOURAGE — bord contre modèle")
    print(f"  {len(images)} images, aucun appel payant")
    print("═" * 78)

    mesures: list[dict] = []
    vignettes: list[tuple[str, bytes, bytes]] = []

    print(f"\n{'image':34} {'bord':>18}  {'modèle':>18}  {'accord':>7}")
    print("─" * 78)
    for nom, octets in images:
        ligne, silhouettes = _comparer(nom, octets)
        mesures.append(ligne)
        # **Écrit au fur et à mesure, jamais à la fin** (`AGENTS.md`) : un banc
        # qui s'arrête au milieu garde ce qu'il a déjà mesuré.
        SORTIE.write_text(
            json.dumps(mesures, indent=1, ensure_ascii=False), encoding="utf-8"
        )
        print(
            f"{nom[:34]:34} "
            f"{ligne['bord_part']:6.1%} {ligne['bord_ms']:5.0f} ms  "
            f"{ligne['modele_part']:6.1%} {ligne['modele_ms']:5.0f} ms  "
            f"{ligne['accord']:6.1%}"
        )
        if len(vignettes) < 8:
            vignettes.append((nom, *silhouettes))

    _conclure(mesures)
    _monter_planche(vignettes)
    print(f"\n-> {SORTIE.relative_to(RACINE.parent)}")
    return 0


# ── Le corpus ────────────────────────────────────────────────────────────────


def _corpus(tout: bool) -> list[tuple[str, bytes]]:
    """Les images du banc, et le cas composé qui vient en dernier.

    Le cas composé est **toujours** là, `--tout` ou pas : c'est le seul qui
    réponde à la deuxième question, et un banc qui ne le montrerait qu'en mode
    long laisserait croire que les deux moteurs se valent partout.
    """
    if tout:
        chemins = sorted(
            chemin
            for motif in ("resultats/**/*", "guide/*", "resultats_univers/**/*")
            for chemin in RACINE.glob(motif)
            if chemin.suffix.lower() in (".png", ".jpg", ".jpeg")
        )
        images = [(str(c.relative_to(RACINE)), c.read_bytes()) for c in chemins]
    else:
        images = [
            (nom, (RACINE / chemin).read_bytes())
            for nom, chemin in CHOISIES
            if (RACINE / chemin).is_file()
        ]
    return [*images, ("COMPOSÉ · fond chargé", _sur_fond_charge())]


def _sur_fond_charge() -> bytes:
    """Un sujet réel, posé sur un fond qui n'est pas plat.

    **Composé, et ça se dit.** Aucune des 188 images du dépôt n'a de fond
    chargé : elles sortent toutes du même genre de modèle, qui pose son sujet
    sur un aplat. Le fond est un dégradé bruité — assez irrégulier pour qu'aucune
    couleur de bordure ne le décrive, ce qui est exactement la situation d'une
    image trouvée sur la toile et collée au tableau d'inspiration.
    """
    with Image.open(RACINE / "guide" / "01_goblin.png") as ouverte:
        source = ouverte.convert("RGB")
    sujet = detourer(Recette(passes=(Passe(moteur=BORD),)), _png(source))
    decoupe = Image.fromarray(sujet, "RGBA")
    decoupe = decoupe.crop(decoupe.getbbox())

    cote = 1024
    y, x = np.mgrid[0:cote, 0:cote]
    generateur = np.random.default_rng(20260827)  # graine fixe : le banc se rejoue
    fond = np.stack(
        [
            (40 + 150 * x / cote + 40 * np.sin(y / 60)).clip(0, 255),
            (90 + 90 * y / cote + 40 * np.cos(x / 45)).clip(0, 255),
            (60 + 120 * (x + y) / (2 * cote)).clip(0, 255),
        ],
        axis=2,
    ) + generateur.normal(0, 14, (cote, cote, 3))
    toile = Image.fromarray(fond.clip(0, 255).astype(np.uint8), "RGB")

    haut = int(cote * 0.8)
    large = max(1, round(decoupe.width * haut / decoupe.height))
    mis = decoupe.resize((large, haut), Image.Resampling.NEAREST)
    toile.paste(mis, ((cote - large) // 2, cote - haut - 40), mis)
    return _png(toile)


# ── La comparaison ───────────────────────────────────────────────────────────


def _comparer(nom: str, octets: bytes) -> tuple[dict, tuple[bytes, bytes]]:
    """Ce que chaque moteur garde, en combien de temps, et à quel point ils
    disent la même chose.

    `accord` est l'intersection sur l'union des deux silhouettes. C'est la seule
    mesure qui compte ici : deux moteurs qui gardent la même part de l'image
    peuvent garder deux parts **différentes**, et la part seule ne le dirait pas.
    """
    resultats = {}
    for moteur in (BORD, MODELE):
        depart = time.perf_counter()
        rgba = detourer(Recette(passes=(Passe(moteur=moteur),)), octets)
        duree = (time.perf_counter() - depart) * 1000
        resultats[moteur] = (rgba, duree)

    alpha_bord = resultats[BORD][0][:, :, 3] > 0
    alpha_modele = resultats[MODELE][0][:, :, 3] > 0
    union = int((alpha_bord | alpha_modele).sum())

    # **Les mesures d'un côté, les images de l'autre.** Le dictionnaire part
    # tel quel dans un JSON écrit à chaque tour ; des octets PNG glissés dedans
    # l'ont fait lever au premier passage, après avoir payé le téléchargement du
    # modèle. Un fichier de résultats ne porte que ce qui se sérialise.
    return {
        "image": nom,
        "pixels": int(alpha_bord.size),
        "bord_part": float(alpha_bord.mean()),
        "bord_ms": resultats[BORD][1],
        "modele_part": float(alpha_modele.mean()),
        "modele_ms": resultats[MODELE][1],
        "accord": float((alpha_bord & alpha_modele).sum() / union) if union else 1.0,
    }, (_png_rgba(resultats[BORD][0]), _png_rgba(resultats[MODELE][0]))


def _conclure(mesures: list[dict]) -> None:
    print("\n" + "═" * 78)
    print("  CE QU'ON EN RETIENT")
    print("═" * 78)

    fond_plat = [m for m in mesures if not m["image"].startswith("COMPOSÉ")]
    if fond_plat:
        accords = [m["accord"] for m in fond_plat]
        print(
            f"\nSur fond plat ({len(fond_plat)} images) : accord médian "
            f"{statistics.median(accords):.1%}, minimum {min(accords):.1%}."
        )
        print(
            f"  Le bord met {statistics.median(m['bord_ms'] for m in fond_plat):.0f} ms, "
            f"le modèle {statistics.median(m['modele_ms'] for m in fond_plat):.0f} ms — "
            f"facteur {statistics.median(m['modele_ms'] for m in fond_plat) / max(1e-9, statistics.median(m['bord_ms'] for m in fond_plat)):.0f}."
        )
        print(
            "  Deux moteurs qui s'accordent sur ce que le produit fabrique : le\n"
            "  premier reste le geste courant, et le second reste facultatif."
        )

    compose = next((m for m in mesures if m["image"].startswith("COMPOSÉ")), None)
    if compose:
        print(
            f"\nSur fond chargé (composé) : le bord garde {compose['bord_part']:.1%} de "
            f"l'image, le modèle {compose['modele_part']:.1%}, accord {compose['accord']:.1%}."
        )
        print(
            "  C'est la raison d'être du second moteur, et elle se voit en un\n"
            "  chiffre : un fond qu'aucune couleur de bordure ne décrit n'est pas\n"
            "  détourable par remplissage depuis le bord."
        )


# ── Outils ───────────────────────────────────────────────────────────────────


def _png(image: Image.Image) -> bytes:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _png_rgba(rgba: np.ndarray) -> bytes:
    return _png(Image.fromarray(rgba, mode="RGBA"))


def _monter_planche(vignettes: list[tuple[str, bytes, bytes]]) -> None:
    """Bord au-dessus, modèle en dessous. Un accord de 97 % et un accord de 60 %
    ne se ressemblent pas, et aucun chiffre ne le dit aussi vite que l'œil."""
    if not vignettes:
        return
    PLANCHES.mkdir(parents=True, exist_ok=True)
    CELL, BANDE, MARGE = 220, 20, 6
    largeur = MARGE + len(vignettes) * (CELL + MARGE)
    hauteur = MARGE + 2 * (CELL + BANDE + MARGE)
    planche = Image.new("RGB", (largeur, hauteur), (22, 24, 28))
    dessin = ImageDraw.Draw(planche)

    for colonne, (nom, bord, modele) in enumerate(vignettes):
        x = MARGE + colonne * (CELL + MARGE)
        for rang, (etiquette, octets) in enumerate(
            (("bord", bord), ("modèle", modele))
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

    chemin = PLANCHES / "detourage_moteurs.png"
    planche.save(chemin)
    print(f"-> {chemin.relative_to(RACINE.parent)}  {planche.size}")


if __name__ == "__main__":
    raise SystemExit(main())
