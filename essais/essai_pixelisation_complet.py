# -*- coding: utf-8 -*-
"""Le banc de pixelisation complet — la taille et le nombre de couleurs, croisés.

Écrit le 3 septembre 2026, à la demande de l'auteur, après un premier banc trop
étroit : *« il y a trop de couleurs non ? [...] j'aimerais voir ce que ça donne
avec 3 / 4 paliers de quantification de couleur différents »*.

**Ce que le premier banc faisait mal.** Il traitait le nombre de couleurs comme
une variante de méthode (« PixelOE + 32 couleurs »), alors que c'est **un axe à
part entière**, indépendant de la façon de réduire. On ne pouvait donc pas voir
si une méthode gagnait grâce à sa réduction ou grâce à sa quantification. Ici
les deux sont séparés : chaque méthode réduit, *puis* chaque palier quantifie.

**Il ne coûte rien.** Tout se calcule sur le processeur, aucune clé n'est lue,
aucun appel ne sort de la machine.

## Les trois axes

- **la taille** : 32, 64, 128, 256 carrés de côté. 32 et 64 sont le pixel art
  classique ; 128 et 256 sont le « pixel art haute résolution » que l'auteur a
  demandé d'ajouter au produit le 3 septembre ;
- **le nombre de couleurs** : 8, 16, 24, 32, 64, et « toutes » comme témoin.
  **24 est la valeur du produit aujourd'hui** (`Univers.couleurs`) ;
- **la méthode** : quatre façons de passer de 1254 pixels à N carrés.

Chaque réduction n'est calculée **qu'une fois** par (méthode, taille) ; les six
paliers de couleurs s'appliquent ensuite dessus. Sans quoi PixelOE, qui coûte
près d'une seconde, tournerait vingt-quatre fois pour rien.

    Lancer :  py essais/essai_pixelisation_complet.py

Sortie : `essais/resultats/pixelisation-complet.html`, et les vignettes en
fichiers PNG à côté. **Des fichiers, pas des images encastrées dans la page** :
le premier banc encastrait tout en base64 et la page devenait trop lourde pour
être capturée ou relue.
"""

from __future__ import annotations

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
SORTIE = RACINE / "essais" / "resultats"
VIGNETTES = SORTIE / "pixelisation"
PAGE = SORTIE / "pixelisation-complet.html"

TAILLES = (32, 64, 128, 256)

# `None` = on ne quantifie pas. C'est le témoin, et c'est **l'état réel du
# produit aujourd'hui quand aucun artwork officiel n'a été déposé** : sans
# artwork il n'y a pas de palette, et sans palette la quantification n'entre
# pas du tout (`Univers.recette_de`).
PALIERS = (None, 64, 32, 24, 16, 8)

EPREUVES = (
    ("pelerin.png", "Le pèlerin à la torche"),
    ("garde du moulin.png", "Le garde du moulin"),
)


# ── Les quatre réductions ────────────────────────────────────────────────────


def au_plus_proche(rgb: np.ndarray, cible: int) -> np.ndarray:
    """Ce que l'atelier fait aujourd'hui (`atelier/image/traitement.py:988`).

    Un pixel sur N est gardé, les autres jetés sans être regardés.
    """
    return _redimensionner(rgb, cible, Image.Resampling.NEAREST)


def par_lanczos(rgb: np.ndarray, cible: int) -> np.ndarray:
    """La réduction propre classique — le repère du mode dessin."""
    return _redimensionner(rgb, cible, Image.Resampling.LANCZOS)


def par_vote_en_deux_temps(rgb: np.ndarray, cible: int) -> np.ndarray:
    """L'idée n°1 de la revue externe — celle que l'auteur a trouvée la meilleure.

    On quantifie l'image en 32 teintes de travail. Dans chaque bloc, la teinte
    **la plus fréquente** décide la forme ; puis le bloc est peint avec la
    **moyenne des pixels d'origine** qui portaient cette teinte-là. On obtient
    le trait net d'un vote sans sa perte de nuances.

    Les 32 teintes ici ne sont qu'un **outil de vote interne**, sans rapport
    avec le palier de couleurs final : la quantification vient après, comme
    pour les trois autres méthodes.
    """
    pas = max(2, min(rgb.shape[:2]) // cible)
    coupe = _redimensionner(rgb, cible * pas, Image.Resampling.LANCZOS)
    haut, large = coupe.shape[:2]

    quant = Image.fromarray(coupe).quantize(colors=32, method=Image.Quantize.FASTOCTREE)
    etiquettes = np.asarray(quant).reshape(haut // pas, pas, large // pas, pas)
    etiquettes = etiquettes.transpose(0, 2, 1, 3).reshape(-1, pas * pas)

    blocs = coupe.reshape(haut // pas, pas, large // pas, pas, 3)
    blocs = blocs.transpose(0, 2, 1, 3, 4).reshape(-1, pas * pas, 3)

    sortie = np.empty((etiquettes.shape[0], 3), dtype=np.uint8)
    for rang in range(etiquettes.shape[0]):
        gagnante = int(np.bincount(etiquettes[rang]).argmax())
        retenus = blocs[rang][etiquettes[rang] == gagnante]
        sortie[rang] = retenus.mean(axis=0).round().astype(np.uint8)

    return sortie.reshape(haut // pas, large // pas, 3)


def par_pixeloe(rgb: np.ndarray, cible: int) -> np.ndarray:
    """PixelOE, la brique recommandée par la revue externe — mode `contrast`.

    Avant de réduire, il épaissit les traits fins selon une carte de contraste
    local, pour qu'ils survivent au lieu d'être noyés dans la moyenne. C'est ce
    qui garde la lance du garde entière.

    **Son option `colors` n'est pas utilisée**, et c'est un défaut trouvé au
    banc précédent : elle quantifie correctement puis appelle `match_color`,
    qui remet les milliers de couleurs d'origine. Sur le pèlerin en 64, son
    « 32 couleurs » en rendait 470. La quantification est donc faite ici comme
    pour les trois autres méthodes.
    """
    from pixeloe.legacy.pixelize import pixelize

    sortie = pixelize(
        rgb[:, :, ::-1].copy(),
        mode="contrast",
        target_size=cible,
        patch_size=max(2, min(rgb.shape[:2]) // cible),
        thickness=2,
        colors=None,
        no_upscale=True,
    )
    return np.ascontiguousarray(sortie[:, :, ::-1])


METHODES = (
    ("aujourdhui", "Aujourd'hui", "l'atelier — au plus proche"),
    ("lanczos", "Lanczos", "la réduction propre"),
    ("vote", "Vote en deux temps", "forme par vote, couleur d'origine"),
    ("pixeloe", "PixelOE", "traits épaissis avant réduction"),
)

REDUCTIONS = {
    "aujourdhui": au_plus_proche,
    "lanczos": par_lanczos,
    "vote": par_vote_en_deux_temps,
    "pixeloe": par_pixeloe,
}


# ── La quantification ────────────────────────────────────────────────────────


def quantifier(petit: np.ndarray, couleurs: int | None, *, tramage: bool = False) -> np.ndarray:
    """Ramène l'image à `couleurs` teintes. `None` ne touche à rien.

    **Sans tramage par défaut.** La diffusion d'erreur (Floyd-Steinberg) salit
    le pixel art et scintille dès que le sprite bouge — c'est la recommandation
    de la revue externe (§2.3). Le paramètre existe pour la seule question qui
    la mérite : en dessous de 16 couleurs, les aplats se cassent en bandes, et
    il faut voir si le tramage les sauve ou les salit.
    """
    if couleurs is None:
        return petit
    reduit = Image.fromarray(petit).quantize(
        colors=couleurs,
        method=Image.Quantize.MEDIANCUT,
        kmeans=couleurs,
        dither=Image.Dither.FLOYDSTEINBERG if tramage else Image.Dither.NONE,
    )
    return np.asarray(reduit.convert("RGB"))


# ── La plomberie ─────────────────────────────────────────────────────────────


def _redimensionner(rgb: np.ndarray, cible: int, filtre) -> np.ndarray:
    hauteur, largeur = rgb.shape[:2]
    facteur = cible / max(hauteur, largeur)
    taille = (max(1, round(largeur * facteur)), max(1, round(hauteur * facteur)))
    return np.asarray(Image.fromarray(rgb).resize(taille, filtre))


def _ecrire(petit: np.ndarray, nom: str, cote: int = 256) -> str:
    """La vignette agrandie **au plus proche**, comme un moteur de jeu.

    Jamais lissée : agrandir en lissant montrerait une image que le jeu
    n'affichera pas, et flatterait justement les méthodes qui bavent.
    """
    image = Image.fromarray(petit)
    facteur = max(1, cote // max(image.width, image.height))
    grand = image.resize(
        (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
    )
    VIGNETTES.mkdir(parents=True, exist_ok=True)
    (VIGNETTES / f"{nom}.png").write_bytes(b"")
    grand.save(VIGNETTES / f"{nom}.png")
    return f"pixelisation/{nom}.png"


def _compte(petit: np.ndarray) -> int:
    return len(np.unique(petit.reshape(-1, petit.shape[-1]), axis=0))


def _nom_palier(couleurs: int | None) -> str:
    return "toutes" if couleurs is None else str(couleurs)


# ── La page ──────────────────────────────────────────────────────────────────

_STYLE = """<!doctype html>
<meta charset="utf-8">
<title>Le banc de pixelisation complet</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:2.5rem clamp(1rem,3vw,3rem);
         font:16px/1.6 -apple-system,"Segoe UI",system-ui,sans-serif;
         background:#f6f5f2; color:#1c1b18; }
  h1 { font-size:1.9rem; margin:0 0 .5rem; letter-spacing:-.02em; }
  .chapeau { max-width:64ch; color:#45423c; margin:0 0 1.5rem; }
  .chapeau strong { color:#1c1b18; }
  .lire { max-width:64ch; background:#fffdf6; border:1px solid #e8dfc4;
          border-left:4px solid #c9a227; border-radius:8px;
          padding:1rem 1.2rem; margin:0 0 3rem; }
  .lire h2 { font-size:1rem; margin:0 0 .5rem; border:0; padding:0;
             text-transform:uppercase; letter-spacing:.06em; color:#7a6414; }
  .lire ul { margin:.4rem 0 0; padding-left:1.1rem; }
  .lire li { margin:.3rem 0; }
  h2 { font-size:1.45rem; margin:3.5rem 0 .3rem; padding-top:1.6rem;
       border-top:2px solid #ddd9d0; letter-spacing:-.01em; }
  h3 { font-size:.95rem; margin:2.5rem 0 .8rem; color:#6b6558;
       text-transform:uppercase; letter-spacing:.08em; font-weight:600; }
  table { border-collapse:collapse; }
  th { font-size:.78rem; font-weight:600; color:#6b6558; padding:.3rem .5rem;
       text-align:center; }
  th.methode { text-align:right; white-space:nowrap; padding-right:.8rem; }
  th.methode span { display:block; font-weight:400; font-size:.72rem;
                    color:#918a7c; }
  td { padding:3px; }
  td img { display:block; width:150px; height:150px; image-rendering:pixelated;
           border-radius:5px; background:#fff; border:1px solid #e3ded4; }
  td.temoin img { border-color:#c9a227; border-width:2px; }
  .compte { font-size:.7rem; color:#918a7c; text-align:center;
            font-variant-numeric:tabular-nums; padding-top:2px; }
  .source { display:flex; gap:1.5rem; align-items:flex-start; background:#fff;
            border:1px solid #e3ded4; border-radius:10px; padding:1.2rem;
            margin:.8rem 0 0; }
  .source img { width:200px; border-radius:6px; flex:none; }
  .source p { margin:0; max-width:52ch; color:#45423c; }
</style>
<body>
<h1>Le banc de pixelisation complet</h1>
<p class="chapeau">La <strong>taille</strong> et le <strong>nombre de
couleurs</strong> séparés en deux axes, sur tes deux images, sans détourage.
Chaque ligne est une façon de réduire ; chaque colonne est un palier de
couleurs appliqué <em>après</em>. Toutes les vignettes sont agrandies
<strong>au plus proche</strong>, comme le ferait un moteur de jeu.</p>
<div class="lire">
  <h2>Comment lire</h2>
  <ul>
    <li>La colonne <strong>« toutes »</strong>, encadrée en jaune, est le
    témoin : aucune réduction de couleurs. <strong>C'est l'état réel de
    l'atelier aujourd'hui</strong> quand aucun artwork officiel n'a été déposé
    — sans artwork il n'y a pas de palette, et sans palette la quantification
    n'entre pas du tout.</li>
    <li>La colonne <strong>24</strong> est la valeur que le produit utilise
    quand une palette existe.</li>
    <li>Le petit chiffre sous chaque vignette est le nombre de couleurs
    réellement présentes. En dessous du palier demandé, c'est que l'image n'en
    contenait pas assez — c'est bon signe.</li>
  </ul>
</div>
"""


def page(blocs: list[dict]) -> str:
    sortie = [_STYLE]
    for bloc in blocs:
        sortie.append(f'<h2>{bloc["titre"]}</h2>\n')
        sortie.append(
            f"""<div class="source">
  <img src="{bloc["source"]}" alt="l'image de départ">
  <p><strong>L'image de départ</strong> — {bloc["cote"]} pixels de côté, fond
  rose gardé, aucun détourage. C'est de là que partent toutes les vignettes
  ci-dessous.</p>
</div>\n"""
        )
        for cible in TAILLES:
            sortie.append(f"<h3>Réduit à {cible} carrés de côté</h3>\n<table>\n<tr><th></th>")
            for couleurs in PALIERS:
                sortie.append(f"<th>{_nom_palier(couleurs)}</th>")
            sortie.append("</tr>\n")
            for cle, nom, quoi in METHODES:
                sortie.append(f'<tr><th class="methode">{nom}<span>{quoi}</span></th>')
                for couleurs in PALIERS:
                    cellule = bloc["cellules"][(cible, cle, couleurs)]
                    classe = ' class="temoin"' if couleurs is None else ""
                    sortie.append(
                        f'<td{classe}><img src="{cellule["fichier"]}" alt="{nom}">'
                        f'<div class="compte">{cellule["compte"]}</div></td>'
                    )
                sortie.append("</tr>\n")
            sortie.append("</table>\n")

        sortie.append(
            "<h3>La question du tramage, à 8 couleurs</h3>\n"
            "<p class=\"chapeau\">En dessous de 16 couleurs les aplats se cassent "
            "en bandes. Le tramage les casse autrement, en semant des points. "
            "<strong>La revue externe déconseille la diffusion d'erreur en pixel "
            "art</strong> — elle scintille dès que le sprite bouge — mais autant "
            "voir de quoi on parle avant de trancher.</p>\n<table>\n"
            '<tr><th class="methode">Vote, 8 couleurs<span>sans tramage</span></th>'
            f'<td><img src="{bloc["tramage"]["sans"]}" alt="sans tramage"></td>'
            '<th class="methode">avec tramage<span>Floyd-Steinberg</span></th>'
            f'<td><img src="{bloc["tramage"]["avec"]}" alt="avec tramage"></td>'
            "</tr>\n</table>\n"
        )
    sortie.append("</body>")
    return "".join(sortie)


def principal() -> int:
    VIGNETTES.mkdir(parents=True, exist_ok=True)
    blocs = []

    for fichier, titre in EPREUVES:
        chemin = SOURCES / fichier
        if not chemin.exists():
            print(f"  manque : {chemin}")
            continue
        rgb = np.asarray(Image.open(chemin).convert("RGB"))
        court = Path(fichier).stem.replace(" ", "-")
        print(f"\n{titre} — {rgb.shape[1]}x{rgb.shape[0]}")

        apercu = Image.fromarray(rgb)
        apercu.thumbnail((400, 400), Image.Resampling.LANCZOS)
        apercu.save(VIGNETTES / f"{court}-source.png")

        cellules = {}
        for cible in TAILLES:
            for cle, nom, _ in METHODES:
                depart = time.perf_counter()
                base = REDUCTIONS[cle](rgb, cible)
                ms = round((time.perf_counter() - depart) * 1000)
                comptes = []
                for couleurs in PALIERS:
                    petit = quantifier(base, couleurs)
                    fichier_png = _ecrire(
                        petit, f"{court}-{cible}-{cle}-{_nom_palier(couleurs)}"
                    )
                    cellules[(cible, cle, couleurs)] = {
                        "fichier": fichier_png,
                        "compte": _compte(petit),
                    }
                    comptes.append(_compte(petit))
                print(
                    f"  {cible:>4} · {nom:<20} {base.shape[1]}x{base.shape[0]}, "
                    f"réduction {ms:>5} ms, couleurs {comptes}"
                )

        base = par_vote_en_deux_temps(rgb, 64)
        tramage = {
            "sans": _ecrire(quantifier(base, 8), f"{court}-tram-sans"),
            "avec": _ecrire(quantifier(base, 8, tramage=True), f"{court}-tram-avec"),
        }

        blocs.append(
            {
                "titre": titre,
                "source": f"pixelisation/{court}-source.png",
                "cote": rgb.shape[0],
                "cellules": cellules,
                "tramage": tramage,
            }
        )

    PAGE.write_text(page(blocs), encoding="utf-8")
    print(f"\nPage écrite : {PAGE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
