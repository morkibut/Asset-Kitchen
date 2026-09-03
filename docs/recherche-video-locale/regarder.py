"""Regarder ce que le banc a produit — une planche à l'œil, et trois mesures.

**L'œil décide, les mesures aident.** Le dépôt a déjà établi que la mesure
automatique ne prédit pas le jugement de l'auteur (`docs/bilan-v3.md` § 6) : ce
fichier ne classe donc rien et ne note rien. Il fabrique une planche à regarder,
et il pose à côté trois chiffres qui répondent à des questions précises que l'œil
lit mal :

1. **le personnage garde-t-il sa taille ?** — c'est le défaut fatal relevé sur la
   chaîne du produit : d'une étape à l'autre le nain grandit et rapetisse. On
   mesure la hauteur du sujet sur chaque image et on donne l'écart ;
2. **le fond reste-t-il uni ?** — s'il se dégrade, le détourage laissera des
   restes, et toute la bande est à jeter. On compte les pixels du bord qui se sont
   écartés de la couleur de départ ;
3. **le dessin est-il resté plat ?** — un modèle vidéo qui glisse vers le
   réalisme multiplie les couleurs. On compte les couleurs distinctes, et on
   compare à l'image de départ.

Aucun de ces trois chiffres ne dit « bon » ou « mauvais ». Ils disent **où
regarder** sur la planche.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ICI = Path(__file__).resolve().parent
BANCS = ICI / "bancs"

for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def couleur_du_fond(image: Image.Image) -> np.ndarray:
    """Le fond, **relevé sur les quatre coins**, jamais supposé.

    Le gris de 235 qu'on envoie n'est pas celui qui revient : un modèle vidéo
    réencode toute l'image et le fond dérive de quelques valeurs. Prendre 235 pour
    repère faisait déclarer « bord sali à 100 % » un clip dont le fond est
    parfaitement uni — le défaut était dans la mesure, pas dans l'image.
    """
    a = np.array(image.convert("RGB"), dtype=int)
    coins = np.stack([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    return np.median(coins, axis=0).astype(int)


def mesurer(images: list[Image.Image], fond: tuple[int, int, int] | None = None) -> dict:
    """Les quatre chiffres, sur une suite d'images d'un même clip.

    ⚠️ **Le fond se relève sur CHAQUE image, pas une fois pour toutes.** Mesuré le
    3 septembre 2026 sur le clip payé qui a marché : son fond passe de 234 sur la
    première image à 220 sur les suivantes. Comparer tout le clip à la couleur de
    la première image faisait déclarer « bord sali à 100 % » un fond parfaitement
    uni — et faisait compter l'image entière comme sujet, d'où un faux « le
    personnage change de 38 % ». **Le fond qui s'assombrit en bloc et le fond qui
    se salit sont deux défauts différents**, et ils se mesurent séparément :
    `derive_du_fond` pour le premier, `bord_non_uni` pour le second.
    """
    hauteurs, largeurs, non_unis, couleurs, fonds = [], [], [], [], []

    for im in images:
        a = np.array(im.convert("RGB"), dtype=int)
        ref = np.array(fond, dtype=int) if fond else couleur_du_fond(im)
        fonds.append(ref)

        # Le sujet : ce qui s'écarte franchement du fond **de cette image-là**.
        masque = np.abs(a - ref).sum(axis=2) > 40
        ys, xs = np.where(masque)
        if len(ys):
            hauteurs.append(int(ys.max() - ys.min() + 1))
            largeurs.append(int(xs.max() - xs.min() + 1))

        # Le bord est-il uni ? On regarde son étalement, pas sa valeur : un fond
        # plus sombre reste détourable, un fond qui se marbre ne l'est plus.
        bord = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        non_unis.append(int(np.percentile(bord, 98, axis=0).max() - np.percentile(bord, 2, axis=0).min()))
        couleurs.append(int(len(np.unique(a.reshape(-1, 3), axis=0))))

    def etendue(valeurs: list) -> dict:
        if not valeurs:
            return {"min": 0, "max": 0, "ecart": 0}
        return {"min": min(valeurs), "max": max(valeurs), "ecart": max(valeurs) - min(valeurs)}

    pile = np.stack(fonds) if fonds else np.zeros((1, 3))
    return {
        "images": len(images),
        "hauteur_du_sujet": etendue(hauteurs),
        "largeur_du_sujet": etendue(largeurs),
        "bord_non_uni": etendue(non_unis),
        "derive_du_fond": int(pile.max() - pile.min()),
        "fond_premiere": [int(v) for v in fonds[0]] if fonds else [],
        "fond_derniere": [int(v) for v in fonds[-1]] if fonds else [],
        "couleurs_distinctes": etendue(couleurs),
    }


def dire(mesures: dict) -> None:
    h = mesures["hauteur_du_sujet"]
    print(f"    images                : {mesures['images']}")
    print(f"    hauteur du personnage : {h['min']} à {h['max']} px — écart {h['ecart']} px", end="")
    if h["min"]:
        print(f"  ({100 * h['ecart'] / h['min']:.0f} %)")
    else:
        print()
    b = mesures["bord_non_uni"]
    print(f"    fond marbré (bord)    : étalement {b['min']} à {b['max']} niveaux — sous 10, il reste détourable")
    print(f"    fond qui dérive       : {mesures['derive_du_fond']} niveaux entre la 1re et la dernière "
          f"({mesures['fond_premiere']} → {mesures['fond_derniere']})")
    c = mesures["couleurs_distinctes"]
    print(f"    couleurs distinctes   : {c['min']} à {c['max']}")


def planche(images: list[Image.Image], vers: Path, combien: int = 8, echelle: float = 1.0) -> Path:
    """Une bande horizontale de N images prises régulièrement dans le clip."""
    if not images:
        raise SystemExit("aucune image à montrer")
    pas = max(1, len(images) // combien)
    choix = images[::pas][:combien]
    l = int(choix[0].width * echelle)
    h = int(choix[0].height * echelle)
    bande = Image.new("RGB", (l * len(choix), h), (255, 255, 255))
    for i, im in enumerate(choix):
        bande.paste(im.convert("RGB").resize((l, h), Image.NEAREST), (i * l, 0))
    vers.parent.mkdir(parents=True, exist_ok=True)
    bande.save(vers)
    return vers


TEMOIN = Path(
    r"C:\STOCKAGE\PROJET\_DEV\gag2\essais\resultats_video\seedance-2.0-mini\clip1\frames"
)


def face_a_face(local: list[Image.Image], vers: Path, combien: int = 6) -> Path:
    """Le tirage local au-dessus, le clip payé qui a marché en dessous.

    **C'est la seule comparaison qui vaille.** Un clip local jugé seul est jugé
    contre rien : le dépôt a déjà établi qu'un même tirage se note différemment
    d'une séance à l'autre (`docs/bilan-v3.md` § 6). Les deux bandes sont donc
    posées l'une sur l'autre, à la même hauteur, pour que l'œil compare au lieu
    de se souvenir.
    """
    if not TEMOIN.exists():
        raise SystemExit(f"le témoin payé est introuvable : {TEMOIN}")
    paye = [Image.open(p) for p in sorted(TEMOIN.glob("*.png"))]

    def bande(images: list[Image.Image], hauteur: int) -> Image.Image:
        pas = max(1, len(images) // combien)
        choix = images[::pas][:combien]
        larg = [int(im.width * hauteur / im.height) for im in choix]
        b = Image.new("RGB", (sum(larg), hauteur), (255, 255, 255))
        x = 0
        for im, l in zip(choix, larg):
            b.paste(im.convert("RGB").resize((l, hauteur), Image.NEAREST), (x, 0))
            x += l
        return b

    h = 240
    haut, bas = bande(local, h), bande(paye, h)
    large = max(haut.width, bas.width)
    planche = Image.new("RGB", (large, h * 2 + 8), (255, 255, 255))
    planche.paste(haut, (0, 0))
    planche.paste(bas, (0, h + 8))
    vers.parent.mkdir(parents=True, exist_ok=True)
    planche.save(vers)
    return vers


def charger(dossier: Path) -> list[Image.Image]:
    fichiers = sorted(p for p in dossier.glob("*.png"))
    return [Image.open(p) for p in fichiers]


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("dossier", help="un dossier de tirage sous bancs/, ou un chemin complet")
    a.add_argument("--combien", type=int, default=8, help="images à poser sur la planche")
    a.add_argument("--echelle", type=float, default=0.6)
    a.add_argument("--contre", action="store_true", help="poser le clip payé qui a marché juste en dessous")
    arguments = a.parse_args()

    chemin = Path(arguments.dossier)
    if not chemin.exists():
        chemin = BANCS / arguments.dossier
    if not chemin.exists():
        raise SystemExit(f"introuvable : {arguments.dossier}")

    images = charger(chemin)
    if not images:
        raise SystemExit(f"aucune image PNG dans {chemin}")

    fond = couleur_du_fond(images[0])
    print(f"\n  {chemin.name} — {len(images)} images, fond relevé à {tuple(int(v) for v in fond)}")
    mesures = mesurer(images)
    dire(mesures)

    sortie = chemin.parent / f"planche-{chemin.name}.png"
    planche(images, sortie, arguments.combien, arguments.echelle)
    print(f"\n    planche écrite : {sortie}")

    if arguments.contre:
        duel = chemin.parent / f"face-a-face-{chemin.name}.png"
        face_a_face(images, duel)
        print(f"    face à face    : {duel}  (local en haut, clip payé en bas)")

    (chemin / "mesures-regard.json").write_text(
        json.dumps(mesures, indent=1, ensure_ascii=False), "utf-8"
    )


if __name__ == "__main__":
    main()
