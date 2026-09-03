# -*- coding: utf-8 -*-
"""Le banc de pixelisation — six façons de faire un sprite, sur les images de l'auteur.

Écrit le 3 septembre 2026, à la demande de l'auteur : *« tu pars de cette image,
et sans la détourer ! on travaille uniquement sur la pixelisation »*.

**Deux règles qu'il a posées, et qui font tout le banc :**

1. **On part d'une bonne image.** Le banc précédent partait d'un rendu médiocre,
   et comparait donc des façons de rater. Ici les deux sources sont des
   illustrations propres, fournies par l'auteur, en 1254x1254.
2. **On ne détoure pas.** Le fond rose reste. Détourer et pixeliser sont deux
   problèmes ; les mélanger, c'est ne plus savoir lequel des deux a raté.

**Il ne coûte rien.** Tout se calcule sur le processeur, aucune clé n'est lue,
aucun appel ne sort de la machine.

## Ce qu'on compare, et pourquoi

La revue externe (`revue-externe-2026-09-02/research/02-pixelart-postprocess-editeur.md`)
est catégorique sur notre cas — une image détaillée, sans grille cachée :

> *« image détaillée -> **PixelOE** (mode `contrast`, `thickness` 1-2) qui
> remplace avantageusement tout modèle neuronal, tourne sur CPU, et sort déjà
> une image sur grille exacte. »*

Le banc met donc PixelOE face à ce que l'atelier fait aujourd'hui, et face aux
méthodes intermédiaires, pour que l'auteur tranche à l'oeil.

    Lancer :  py essais/essai_pixelisation.py

Sortie : `essais/resultats/pixelisation.html`, à ouvrir dans le navigateur.
"""

from __future__ import annotations

import base64
import io
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

SOURCES = RACINE / "essais" / "sources"
SORTIE = RACINE / "essais" / "resultats" / "pixelisation.html"

# Les trois tailles montrées. **64 et 128 sont le pixel art classique ; 256 est
# le « pixel art haute résolution »** que l'auteur a demandé d'ajouter le
# 3 septembre. Les voir côte à côte est le seul moyen de savoir ce qu'on gagne.
TAILLES = (64, 128, 256)

EPREUVES = (
    ("pelerin.png", "Le pèlerin à la torche"),
    ("garde du moulin.png", "Le garde du moulin"),
)


# ── Les méthodes ─────────────────────────────────────────────────────────────


def au_plus_proche(rgb: np.ndarray, cible: int) -> np.ndarray:
    """Ce que l'atelier fait aujourd'hui : `Image.Resampling.NEAREST`.

    Voir `atelier/image/traitement.py:988`. Un pixel sur N est gardé, les autres
    sont jetés sans être regardés. Sur un dessin fin, un trait d'un pixel de
    large a une chance sur N de survivre — c'est le tirage au sort, pas un choix.
    """
    return _redimensionner(rgb, cible, Image.Resampling.NEAREST)


def par_lanczos(rgb: np.ndarray, cible: int) -> np.ndarray:
    """La réduction « propre » classique. Le repère du mode dessin.

    Rien n'est jeté, tout est moyenné proprement. C'est exactement ce qu'il faut
    pour un **dessin** réduit — et exactement ce qu'il ne faut pas pour du pixel
    art, où les dégradés qu'elle fabrique n'ont rien à faire.
    """
    return _redimensionner(rgb, cible, Image.Resampling.LANCZOS)


def par_lanczos_palette(rgb: np.ndarray, cible: int) -> np.ndarray:
    """La réduction simple, puis 32 couleurs. **Le témoin du banc.**

    Si PixelOE ne bat pas *ça*, il ne sert à rien : la quantification seule
    suffirait. C'est la colonne qui empêche de conclure trop vite.
    """
    return _palette(par_lanczos(rgb, cible), 32)


def par_vote_en_deux_temps(rgb: np.ndarray, cible: int) -> np.ndarray:
    """L'idée n°1 de la revue externe, séparer la forme et la couleur.

    On quantifie d'abord l'image en 32 couleurs. Dans chaque bloc, on regarde
    quelle couleur quantifiée est la **plus fréquente** : c'est elle qui décide
    la forme. Puis on peint le bloc avec la **moyenne des pixels d'origine** qui
    portaient cette couleur-là. On obtient le trait net d'un vote, sans sa perte
    de nuances.
    """
    pas = max(2, min(rgb.shape[:2]) // cible)
    # **On recale la source sur un multiple exact de la cible** avant de
    # découper. Sans ça, 1254 divisé par des blocs de 19 rendait 66 carrés et
    # non 64 : on aurait comparé des tailles différentes en croyant comparer
    # des méthodes.
    coupe = _redimensionner(rgb, cible * pas, Image.Resampling.LANCZOS)
    haut, large = coupe.shape[:2]

    quant = Image.fromarray(coupe).quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    etiquettes = np.asarray(quant).reshape(haut // pas, pas, large // pas, pas)
    etiquettes = etiquettes.transpose(0, 2, 1, 3).reshape(-1, pas * pas)

    blocs = coupe.reshape(haut // pas, pas, large // pas, pas, 3)
    blocs = blocs.transpose(0, 2, 1, 3, 4).reshape(-1, pas * pas, 3)

    sortie = np.empty((etiquettes.shape[0], 3), dtype=np.uint8)
    for rang in range(etiquettes.shape[0]):
        vote = np.bincount(etiquettes[rang])
        gagnante = int(vote.argmax())
        retenus = blocs[rang][etiquettes[rang] == gagnante]
        sortie[rang] = retenus.mean(axis=0).round().astype(np.uint8)

    return sortie.reshape(haut // pas, large // pas, 3)


def par_pixeloe(rgb: np.ndarray, cible: int) -> np.ndarray:
    """PixelOE, la brique que la revue externe recommande — mode `contrast`.

    Deux étapes, et c'est la première qui fait la différence : **avant** de
    réduire, l'algorithme épaissit les traits fins selon une carte de contraste
    local, pour qu'ils survivent à la réduction au lieu d'être moyennés dans le
    fond. Puis il choisit dans chaque bloc le pixel le plus représentatif, en
    espace LAB, plutôt que d'en faire la moyenne.
    """
    return _pixeloe(rgb, cible, couleurs=None)


def par_pixeloe_palette(rgb: np.ndarray, cible: int) -> np.ndarray:
    """PixelOE, puis ramené à 32 couleurs — le vrai rendu « pixel art ».

    C'est l'étape qui manque à toutes les autres méthodes : un sprite pixel art
    n'a pas dix mille couleurs, il en a quelques dizaines. Sans elle, on a une
    petite image, pas du pixel art.

    **La quantification est faite ici, pas par PixelOE**, et c'est un défaut
    trouvé au banc : l'option `colors=32` de PixelOE quantifie correctement,
    puis appelle `match_color` juste après, un étalonnage qui remet les milliers
    de couleurs d'origine. Sur le pèlerin en 64, son « 32 couleurs » en rendait
    470. L'option est donc inutilisable telle quelle.
    """
    return _palette(_pixeloe(rgb, cible, couleurs=None), 32)


METHODES = (
    ("Aujourd'hui (l'atelier)", "au plus proche — un pixel sur N, les autres jetés", au_plus_proche),
    ("Lanczos", "la réduction propre classique — le repère du mode dessin", par_lanczos),
    ("Vote en deux temps", "idée n°1 de la revue : forme par vote, couleur d'origine", par_vote_en_deux_temps),
    ("PixelOE", "traits épaissis avant réduction, puis choix par contraste", par_pixeloe),
    ("Lanczos + 32 couleurs", "le témoin : la réduction bête, mais quantifiée", par_lanczos_palette),
    ("PixelOE + 32 couleurs", "la chaîne complète recommandée par la revue", par_pixeloe_palette),
)


# ── La plomberie ─────────────────────────────────────────────────────────────


def _palette(petit: np.ndarray, couleurs: int) -> np.ndarray:
    """Ramène l'image à `couleurs` teintes, sans tramage.

    **Sans tramage volontairement** : la diffusion d'erreur (Floyd-Steinberg)
    salit le pixel art et scintille dès que le sprite bouge. C'est la
    recommandation de la revue externe, §2.3.
    """
    reduit = Image.fromarray(petit).quantize(
        colors=couleurs, method=Image.Quantize.MEDIANCUT, kmeans=couleurs, dither=Image.Dither.NONE
    )
    return np.asarray(reduit.convert("RGB"))


def _redimensionner(rgb: np.ndarray, cible: int, filtre) -> np.ndarray:
    hauteur, largeur = rgb.shape[:2]
    facteur = cible / max(hauteur, largeur)
    taille = (max(1, round(largeur * facteur)), max(1, round(hauteur * facteur)))
    return np.asarray(Image.fromarray(rgb).resize(taille, filtre))


def _pixeloe(rgb: np.ndarray, cible: int, couleurs: int | None) -> np.ndarray:
    """PixelOE attend du BGR (il travaille en OpenCV) et rend du BGR."""
    from pixeloe.legacy.pixelize import pixelize

    sortie = pixelize(
        rgb[:, :, ::-1].copy(),
        mode="contrast",
        target_size=cible,
        patch_size=max(2, min(rgb.shape[:2]) // cible),
        thickness=2,
        colors=couleurs,
        no_upscale=True,
    )
    return np.ascontiguousarray(sortie[:, :, ::-1])


def _agrandi(petit: np.ndarray, cote: int = 384) -> str:
    """L'image rendue visible : agrandie au plus proche, comme un moteur de jeu.

    **Toujours au plus proche.** Agrandir en lissant montrerait une image que le
    jeu n'affichera jamais, et flatterait justement les méthodes qui bavent.
    """
    image = Image.fromarray(petit)
    facteur = max(1, cote // max(image.width, image.height))
    grand = image.resize(
        (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
    )
    tampon = io.BytesIO()
    grand.save(tampon, format="PNG")
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def _apercu(rgb: np.ndarray, cote: int = 384) -> str:
    image = Image.fromarray(rgb)
    image.thumbnail((cote, cote), Image.Resampling.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def _couleurs(petit: np.ndarray) -> int:
    return len(np.unique(petit.reshape(-1, petit.shape[-1]), axis=0))


# ── La page ──────────────────────────────────────────────────────────────────


def page(resultats: list[dict]) -> str:
    morceaux = [_ENTETE]
    for bloc in resultats:
        morceaux.append(
            f"""
<section class="epreuve">
  <h2>{bloc["titre"]}</h2>
  <div class="source">
    <img src="data:image/png;base64,{bloc["source"]}" alt="l'image de départ">
    <p><strong>L'image de départ</strong>, telle que tu l'as fournie —
    {bloc["taille"]} pixels de côté, fond rose gardé, aucun détourage.
    C'est de <em>ça</em> que partent les six colonnes ci-dessous.</p>
  </div>
"""
        )
        for cible in TAILLES:
            morceaux.append(f'  <h3>Réduit à {cible} carrés de côté</h3>\n  <div class="grille">\n')
            for nom, explication, _ in METHODES:
                cellule = bloc["cellules"][(cible, nom)]
                morceaux.append(
                    f"""    <figure>
      <img src="data:image/png;base64,{cellule["image"]}" alt="{nom}">
      <figcaption>
        <strong>{nom}</strong>
        <span class="quoi">{explication}</span>
        <span class="chiffre">{cellule["couleurs"]} couleurs · {cellule["ms"]} ms</span>
      </figcaption>
    </figure>
"""
                )
            morceaux.append("  </div>\n")
        morceaux.append("</section>\n")
    morceaux.append("</body>")
    return "".join(morceaux)


_ENTETE = """<!doctype html>
<meta charset="utf-8">
<title>Le banc de pixelisation</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 2.5rem clamp(1rem, 4vw, 4rem);
         font: 16px/1.65 -apple-system, "Segoe UI", system-ui, sans-serif;
         background: #f6f5f2; color: #1c1b18; }
  h1 { font-size: 1.9rem; margin: 0 0 .4rem; letter-spacing: -.02em; }
  .chapeau { max-width: 62ch; color: #45423c; margin: 0 0 3rem; }
  .chapeau strong { color: #1c1b18; }
  h2 { font-size: 1.4rem; margin: 3.5rem 0 1rem; padding-top: 1.6rem;
       border-top: 2px solid #ddd9d0; letter-spacing: -.01em; }
  h3 { font-size: 1rem; margin: 2.4rem 0 .9rem; color: #6b6558;
       text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
  .source { display: flex; gap: 1.5rem; align-items: flex-start;
            background: #fff; border: 1px solid #e3ded4; border-radius: 10px;
            padding: 1.2rem; margin-bottom: .5rem; }
  .source img { width: 220px; border-radius: 6px; flex: none; }
  .source p { margin: 0; max-width: 52ch; color: #45423c; }
  .grille { display: grid; gap: 1.1rem;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  figure { margin: 0; background: #fff; border: 1px solid #e3ded4;
           border-radius: 10px; overflow: hidden; }
  figure img { display: block; width: 100%; image-rendering: pixelated;
               background: #fafafa; }
  figcaption { padding: .7rem .85rem .85rem; border-top: 1px solid #eee9e0; }
  figcaption strong { display: block; font-size: .95rem; }
  .quoi { display: block; font-size: .82rem; color: #6b6558; margin-top: .15rem; }
  .chiffre { display: block; font-size: .78rem; color: #918a7c;
             margin-top: .45rem; font-variant-numeric: tabular-nums; }
</style>
<body>
<h1>Le banc de pixelisation</h1>
<p class="chapeau">Six façons de transformer une illustration en sprite, sur tes
deux images, à trois tailles. <strong>Aucun détourage :</strong> le fond rose
reste, on ne juge ici que la pixelisation. Toutes les vignettes sont agrandies
<strong>au plus proche</strong>, exactement comme un moteur de jeu les
afficherait — jamais lissées, sans quoi on flatterait les méthodes qui bavent.
Le nombre de couleurs compte : <strong>un vrai sprite en a quelques dizaines,
pas quelques milliers.</strong></p>
"""


def principal() -> int:
    resultats = []
    for fichier, titre in EPREUVES:
        chemin = SOURCES / fichier
        if not chemin.exists():
            print(f"  manque : {chemin}")
            continue
        rgb = np.asarray(Image.open(chemin).convert("RGB"))
        print(f"\n{titre} — {rgb.shape[1]}x{rgb.shape[0]}")

        cellules = {}
        for cible in TAILLES:
            for nom, _, methode in METHODES:
                depart = time.perf_counter()
                petit = methode(rgb, cible)
                ms = round((time.perf_counter() - depart) * 1000)
                cellules[(cible, nom)] = {
                    "image": _agrandi(petit),
                    "couleurs": _couleurs(petit),
                    "ms": ms,
                }
                print(
                    f"  {cible:>4} · {nom:<24} "
                    f"{petit.shape[1]}x{petit.shape[0]}, "
                    f"{cellules[(cible, nom)]['couleurs']:>6} couleurs, {ms:>5} ms"
                )

        resultats.append(
            {
                "titre": titre,
                "source": _apercu(rgb),
                "taille": rgb.shape[0],
                "cellules": cellules,
            }
        )

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(page(resultats), encoding="utf-8")
    print(f"\nPage écrite : {SORTIE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
