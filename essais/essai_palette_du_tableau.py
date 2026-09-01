# -*- coding: utf-8 -*-
"""Le banc de la palette lue sur le tableau d'inspiration.

Écrit le 1er septembre 2026 pour la maquette
`docs/maquettes-v2.1/06bis-decouper-une-carte.html`, qui **cite ses chiffres**.
Il existe parce que la demande de l'auteur reposait sur une crainte — *le fond
d'un artwork entre dans ma palette* — et qu'une crainte se vérifie avant de se
réparer.

**Il ne coûte rien** : les artworks sont déjà sur le disque, tout est du calcul
pur, aucune clé n'est lue, aucun appel n'est fait. Et **il n'écrit rien dans les
projets** — il lit les cartes officielles et recalcule à côté.

Cinq questions, dans cet ordre — la cinquième ajoutée le jour de la construction.

1. **Le fond entre-t-il vraiment dans la palette ?** Non. `palette_de()` détoure
   depuis le bord avant de compter, et sur les artworks officiels de ce dépôt il
   écarte de 40 à 70 % des pixels. On mesure la part gardée, artwork par artwork.
2. **Ce détourage est-il un bienfait ou une amputation ?** Les deux, selon
   l'image, et c'est la question qui décide. On rend la palette de chaque artwork
   avec et sans, et on regarde laquelle vaut mieux.
3. **Découper l'image répare-t-il la palette ?** C'était l'hypothèse la plus
   économique — une seule réparation pour les deux demandes. Elle est fausse dans
   un cas et vraie dans l'autre, et le banc dit lequel.
4. **Qu'est-ce qui pollue réellement, alors ?** Le voisin, pas le fond : un titre
   d'interface, une barre de vie, une seconde scène dans la même image.
5. **Où la détection automatique coupe-t-elle, sur ces images-là ?** C'est le
   chiffre que la maquette cite — *quatre zones, une par personnage, sur la
   planche de nains* — et il ne se mesure que sur de vraies images : une planche
   fabriquée pour la question y répondrait ce qu'on veut. Il est mesuré au
   réglage par défaut, celui qu'on trouve en ouvrant l'écran, parce qu'une
   promesse qui demanderait de toucher un curseur n'en est pas une.

   C'est cette question qui a trouvé le **liseré d'un pixel** : la toute première
   rangée de la planche de nains est sombre là où son fond est gris clair, donc
   le détourage la garde — à juste titre —, et le rejet des petites taches se
   faisait sur l'**aire**, où une rangée de 1 024 × 1 pèse 1 024. Cinq rectangles
   pour quatre nains. Un plancher d'épaisseur a été ajouté à `zones_opaques`.

    Lancer :  py essais/essai_palette_du_tableau.py
              py essais/essai_palette_du_tableau.py --planches

`--planches` écrit dans `essais/planches/palette-du-tableau/` une image par
artwork : l'original à gauche, ce que la palette en lit à droite, le reste en
magenta. C'est cette image-là qui a tranché la question 4.

Sortie : ce journal, et `essais/mesures_palette_du_tableau.json` pour lire la
dérive d'une exécution à l'autre.
"""

from __future__ import annotations

import argparse
import io
import json
import pathlib
import sys

import numpy as np
from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.domaine.recette import SEUIL_ALPHA  # noqa: E402
from atelier.image.palette import (  # noqa: E402
    COULEURS_MAX,
    COULEURS_MIN,
    TOLERANCE,
    _vue,
)
from atelier.image.decoupe import COTE_MIN, zones_opaques  # noqa: E402
from atelier.image.traitement import detourer_bord, durcir  # noqa: E402

PROJETS = RACINE / "donnees" / "projets"
DONNEES = RACINE / "donnees"
SORTIE = RACINE / "essais" / "mesures_palette_du_tableau.json"
PLANCHES = RACINE / "essais" / "planches" / "palette-du-tableau"

# Les recoupes de la question 3. Chacune est ce que l'auteur dessinerait dans la
# Découpe pour isoler **un** sujet, en pixels de l'image d'origine. Elles sont
# écrites ici plutôt que devinées : une découpe automatique répondrait à une
# autre question que celle qu'on pose.
RECOUPES: dict[str, tuple[str, tuple[int, int, int, int]]] = {
    "4f48ff169f00446b": ("la salle éclairée seule", (150, 40, 540, 300)),
    "d95fb4bd5515433a": ("la salle de gauche seule", (30, 60, 480, 780)),
}


def _octets(dossier: pathlib.Path, carte: dict) -> bytes | None:
    """Les octets d'une carte — par son champ `fichier`, sinon par son nom."""
    fichier = carte.get("fichier")
    if fichier and (DONNEES / fichier).exists():
        return (DONNEES / fichier).read_bytes()
    for candidat in sorted((dossier / "tableau").glob(carte["identifiant"] + ".*")):
        if candidat.suffix.lower() != ".json":
            return candidat.read_bytes()
    return None


def _lu(octets: bytes, *, detourer: bool = True) -> tuple[np.ndarray, np.ndarray, float]:
    """Ce que la palette lit de ces octets : les pixels gardés, l'alpha, la part.

    C'est `palette._sujet()` déplié, parce que le banc a besoin des trois — la
    part pour la mesurer, l'alpha pour la dessiner, les pixels pour quantifier.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()
    if detourer:
        neuf = detourer_bord(rgba[:, :, :3], TOLERANCE)
        rgba[:, :, 3] = durcir(np.minimum(rgba[:, :, 3], neuf), SEUIL_ALPHA)
    vue = _vue(rgba).reshape(-1, 4)
    opaques = vue[vue[:, 3] >= SEUIL_ALPHA][:, :3]
    part = opaques.shape[0] / vue.shape[0] * 100 if vue.shape[0] else 0.0
    return (opaques if opaques.size else vue[:, :3]), rgba[:, :, 3], part


def _couleurs(pixels: np.ndarray, couleurs: int) -> list[str]:
    """La palette de ces pixels-là, dans la forme que le produit publie."""
    bande = np.concatenate([pixels]).reshape(1, -1, 3)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=max(COULEURS_MIN, min(COULEURS_MAX, couleurs)),
        method=Image.Quantize.MEDIANCUT,
    )
    plate = indexee.getpalette() or []
    return [
        "#%02x%02x%02x" % tuple(plate[r * 3 : r * 3 + 3])
        for r in sorted(set(indexee.tobytes()))
    ]


def _sombres(couleurs: list[str], seuil: int = 40) -> int:
    """Combien de couleurs de cette palette sont pratiquement noires.

    **C'est la mesure qui a tranché la question 2.** Une palette dont la moitié
    des entrées sont indiscernables du noir n'est pas une palette de vingt-quatre
    couleurs : c'est une palette de douze et un fond compté douze fois.
    """
    return sum(
        1
        for c in couleurs
        if max(int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)) < seuil
    )


def _recouper(octets: bytes, boite: tuple[int, int, int, int]) -> bytes:
    with Image.open(io.BytesIO(octets)) as ouverte:
        coupee = ouverte.convert("RGBA").crop(boite)
    tampon = io.BytesIO()
    coupee.save(tampon, format="PNG")
    return tampon.getvalue()


def _planche(chemin: pathlib.Path, octets: bytes, alpha: np.ndarray) -> None:
    """L'original à gauche, ce que la palette en lit à droite, le reste en magenta."""
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()
    vu = rgba.copy()
    vu[alpha < SEUIL_ALPHA] = [255, 0, 255, 255]
    hauteur, largeur = rgba.shape[:2]
    planche = Image.new("RGB", (largeur * 2 + 12, hauteur), (20, 20, 22))
    planche.paste(Image.fromarray(rgba, "RGBA").convert("RGB"), (0, 0))
    planche.paste(Image.fromarray(vu, "RGBA").convert("RGB"), (largeur + 12, 0))
    facteur = 900 / max(planche.width, planche.height)
    if facteur < 1:
        planche = planche.resize(
            (round(planche.width * facteur), round(planche.height * facteur)),
            Image.Resampling.BOX,
        )
    chemin.parent.mkdir(parents=True, exist_ok=True)
    planche.save(chemin)


def main() -> None:
    lecture = argparse.ArgumentParser(description=__doc__)
    lecture.add_argument(
        "--planches",
        action="store_true",
        help="écrire une image par artwork dans essais/planches/palette-du-tableau/",
    )
    choix = lecture.parse_args()

    mesures: dict[str, object] = {"artworks": [], "recoupes": [], "zones": []}

    print("Ce que la palette lit de chaque artwork officiel")
    print("-" * 92)
    print(
        f"{'projet':<20} {'carte':<18} {'taille':>12} {'gardé':>7} "
        f"{'noirs avec':>11} {'noirs sans':>11}"
    )
    print("-" * 92)

    for dossier in sorted(PROJETS.iterdir()):
        if not dossier.is_dir():
            continue
        fiches = sorted((dossier / "tableau").glob("*.json"))
        cartes = [json.loads(f.read_text(encoding="utf-8")) for f in fiches]
        cartes.sort(key=lambda c: c.get("cree_le", 0), reverse=True)
        artworks = [
            c
            for c in cartes
            if c.get("officiel")
            and c.get("genre", "image") == "image"
            and c.get("statut", "prete") == "prete"
        ]
        if not artworks:
            continue
        projet = json.loads((dossier / "projet.json").read_text(encoding="utf-8"))
        demandees = projet.get("univers", {}).get("couleurs", 24)

        for carte in artworks:
            octets = _octets(dossier, carte)
            if octets is None:
                print(f"{dossier.name:<20} {carte['identifiant']:<18} fichier absent")
                continue

            avec, alpha, part = _lu(octets, detourer=True)
            sans, _, _ = _lu(octets, detourer=False)
            palette_avec = _couleurs(avec, demandees)
            palette_sans = _couleurs(sans, demandees)

            ligne = {
                "projet": dossier.name,
                "carte": carte["identifiant"],
                "largeur": carte.get("largeur", 0),
                "hauteur": carte.get("hauteur", 0),
                "famille": carte.get("famille", ""),
                "garde_pc": round(part, 1),
                "couleurs": len(palette_avec),
                "noirs_avec_detourage": _sombres(palette_avec),
                "noirs_sans_detourage": _sombres(palette_sans),
            }

            # Question 5 — au réglage par défaut, celui qu'on trouve en ouvrant
            # l'écran. `alpha` est **exactement** celui de la palette : la
            # proposition et l'aperçu montrent donc la même chose, ce qui est
            # tout l'intérêt de les avoir dans le même écran.
            boites = zones_opaques(alpha, cote_min=COTE_MIN)
            mesures["zones"].append(  # type: ignore[union-attr]
                {
                    "projet": dossier.name,
                    "carte": carte["identifiant"],
                    "zones": len(boites),
                    "boites": [list(b) for b in boites],
                    "petit_cote_min": min(
                        (min(b[2] - b[0] + 1, b[3] - b[1] + 1) for b in boites),
                        default=0,
                    ),
                }
            )
            mesures["artworks"].append(ligne)  # type: ignore[union-attr]
            print(
                f"{dossier.name:<20} {carte['identifiant']:<18} "
                f"{ligne['largeur']:>5}x{ligne['hauteur']:<6} {part:>6.1f}% "
                f"{ligne['noirs_avec_detourage']:>11} "
                f"{ligne['noirs_sans_detourage']:>11}"
            )

            if choix.planches:
                _planche(
                    PLANCHES / f"{dossier.name}-{carte['identifiant']}.png",
                    octets,
                    alpha,
                )

            recoupe = RECOUPES.get(carte["identifiant"])
            if recoupe:
                quoi, boite = recoupe
                coupee = _recouper(octets, boite)
                _, alpha_coupee, part_coupee = _lu(coupee, detourer=True)
                mesures["recoupes"].append(  # type: ignore[union-attr]
                    {
                        "carte": carte["identifiant"],
                        "quoi": quoi,
                        "boite": list(boite),
                        "garde_entiere_pc": round(part, 1),
                        "garde_recoupee_pc": round(part_coupee, 1),
                    }
                )
                if choix.planches:
                    _planche(
                        PLANCHES / f"recoupe-{carte['identifiant']}.png",
                        coupee,
                        alpha_coupee,
                    )

    print()
    print("Où la détection propose de couper — question 5")
    print("-" * 92)
    print(f"{'projet':<20} {'carte':<18} {'zones':>6} {'plus petit côté':>17}")
    print("-" * 92)
    for z in mesures["zones"]:  # type: ignore[union-attr]
        print(
            f"{z['projet']:<20} {z['carte']:<18} {z['zones']:>6} "
            f"{z['petit_cote_min']:>14} px"
        )

    print()
    print("Ce que la découpe change — question 3")
    print("-" * 92)
    for r in mesures["recoupes"]:  # type: ignore[union-attr]
        sens = "répare" if r["garde_recoupee_pc"] > r["garde_entiere_pc"] else "aggrave"
        print(
            f"  {r['carte']} · {r['quoi']:<28} "
            f"{r['garde_entiere_pc']:>5.1f}% → {r['garde_recoupee_pc']:>5.1f}%  {sens}"
        )

    SORTIE.write_text(
        json.dumps(mesures, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print()
    print(f"→ {SORTIE.relative_to(RACINE)}")
    if choix.planches:
        print(f"→ {PLANCHES.relative_to(RACINE)}/")


if __name__ == "__main__":
    main()
