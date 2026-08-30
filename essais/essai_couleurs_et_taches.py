# -*- coding: utf-8 -*-
"""Le banc des deux dernières places de la recette — quantification et bords.

Écrit le 30 août 2026 pour les maquettes `docs/maquettes-v2.1/14-table-quantification.html`
et `15-table-bords.html`, qui **citent ses chiffres**. Il existe pour qu'on puisse
les refaire : une maquette qui affirme une mesure sans banc pour la rejouer devient
invérifiable au premier doute.

**Il ne coûte rien.** Les images sont déjà sur le disque, la palette est celle d'un
vrai projet, et le post-traitement est du processeur pur — aucune clé n'est lue,
aucun appel n'est fait. Le seul coût est du temps de calcul.

Sept questions, dans cet ordre :

1. **Le nombre de couleurs agit-il quand une palette est posée ?** C'est la
   question qui a décidé de la maquette 14. La réponse est non, et elle se voit
   sur les octets du PNG.
2. **Sans palette, obtient-on le nombre qu'on demande ?** Non plus : la coupe
   médiane sature, et l'écart se chiffre.
3. **Que déplace la palette du projet ?** C'est le prix de « tous mes assets se
   ressemblent », et il n'était écrit nulle part.
4. **Que fait le tramage sur une case de 64 px ?** Il n'avait jamais été mesuré,
   et aucun écran ne l'expose.
5. **Combien de taches porte une case finie, et que retire l'aire minimale ?**
   C'est la question qui a décidé de la maquette 15.
6. **D'où viennent les miettes ?** La note de `nettoyer()` suppose que la
   réduction en laisse ; on compte avant et après pour le savoir.
7. **L'ordre des places compte-t-il ?** Quantification avant ou après la grille,
   bords avant ou après la quantification.

    Lancer :  py essais/essai_couleurs_et_taches.py
              py essais/essai_couleurs_et_taches.py --projet coeur-de-pierre --images 8

Sortie : ce journal, et `essais/mesures_couleurs_taches.json` pour lire la dérive
d'une exécution à l'autre.
"""

from __future__ import annotations

import argparse
import io
import json
import pathlib
import sys
import time

import numpy as np
from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.domaine.recette import (  # noqa: E402
    AUCUN,
    BAS,
    FLOYD,
    Bords,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)
from atelier.image.traitement import (  # noqa: E402
    composantes,
    detourer,
    finir,
    quantifier,
    sur_grille,
)

SORTIE = RACINE / "essais" / "mesures_couleurs_taches.json"


# ── Le corpus et l'univers ───────────────────────────────────────────────────
#
# On mesure sur de **vraies** images et une **vraie** palette. Un corpus
# fabriqué pour l'occasion — des carrés de couleur — répondrait juste à toutes
# les questions et n'apprendrait rien : c'est très exactement ce que les tests
# font déjà, et ce n'est pas ce qu'on cherche ici.


def univers_du_projet(nom: str) -> tuple[tuple[str, ...], int, int]:
    """La palette, la cible de pixel et le nombre de couleurs demandé du projet."""
    fichier = RACINE / "donnees" / "projets" / nom / "projet.json"
    if not fichier.exists():
        raise SystemExit(
            f"projet « {nom} » introuvable — les projets présents sont : "
            + ", ".join(sorted(p.name for p in (RACINE / "donnees/projets").glob("*")))
        )
    contenu = json.loads(fichier.read_text(encoding="utf-8"))
    univers = contenu.get("univers", contenu)
    return tuple(univers["palette"]), int(univers["cible_px"]), int(univers["couleurs"])


def corpus(combien: int, cote_min: int = 512) -> list[tuple[str, bytes]]:
    """Une image brute par génération, la première assez grande.

    Une par génération et non toutes : un lot de huit variations du même sujet
    pèserait huit fois dans les moyennes et ne dirait qu'une chose.
    """
    dossier = RACINE / "donnees" / "generations"
    if not dossier.exists():
        raise SystemExit("aucune génération sur le disque — ce banc mesure ce qui est là")
    trouves: list[tuple[str, bytes]] = []
    for generation in sorted(dossier.iterdir()):
        if not generation.is_dir():
            continue
        for fichier in sorted(generation.glob("*-brut.png")):
            try:
                with Image.open(fichier) as image:
                    if min(image.size) < cote_min:
                        continue
            except Exception:  # noqa: BLE001 — un fichier illisible n'est pas une panne du banc
                continue
            trouves.append((f"{generation.name[:8]}/{fichier.name}", fichier.read_bytes()))
            break
        if len(trouves) >= combien:
            break
    if not trouves:
        raise SystemExit(f"aucune image brute d'au moins {cote_min} px sur le disque")
    return trouves


# ── Les outils de lecture ────────────────────────────────────────────────────


def rgba_de(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def couleurs_distinctes(rgba: np.ndarray) -> int:
    opaques = rgba[rgba[:, :, 3] > 0][:, :3]
    return len(np.unique(opaques.reshape(-1, 3), axis=0)) if opaques.size else 0


def pixels_isoles(rgba: np.ndarray) -> int:
    """Les pixels dont la couleur diffère de leurs quatre voisins.

    C'est la poussière **de couleur** — celle que le tramage fabrique. Elle n'a
    rien à voir avec les taches d'alpha que `bords` retire, et c'est la raison
    pour laquelle les deux se mesurent séparément ici.
    """
    rgb = rgba[:, :, :3].astype(np.int16)
    opaque = rgba[:, :, 3] > 0
    seul = np.ones(opaque.shape, bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        seul &= np.any(rgb != np.roll(np.roll(rgb, dy, 0), dx, 1), axis=2)
    return int((seul & opaque).sum())


def aires(rgba: np.ndarray) -> list[int]:
    """Les aires des taches opaques, la plus grande d'abord."""
    return sorted((aire for _, aire in composantes(rgba[:, :, 3] > 0)), reverse=True)


def titre(numero: str, texte: str) -> None:
    print()
    print("=" * 78)
    print(f"{numero}. {texte}")
    print("=" * 78)


# ── Le banc ──────────────────────────────────────────────────────────────────


def main() -> None:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--projet", default="coeur-de-pierre")
    arguments.add_argument("--images", type=int, default=8)
    options = arguments.parse_args()

    palette, cible, couleurs_univers = univers_du_projet(options.projet)
    images = corpus(options.images)

    print(f"projet « {options.projet} » — cible {cible} px, palette de {len(palette)} "
          f"couleurs, {couleurs_univers} demandées à la déduction")
    print(f"corpus : {len(images)} images brutes de donnees/generations/")
    print("après la mise sur grille, « 1 px » désigne un bloc de la case finie")

    def recette(*, avec_palette=True, nombre=couleurs_univers, tramage=AUCUN,
                aire_min=0, quant=True, bords=False) -> Recette:
        return Recette(
            passes=(Passe(),),
            recadrage=Recadrage(),
            grille=Grille(cible=cible, occupation=85, ancrage=BAS),
            quantification=Quantification(
                couleurs=nombre,
                palette=palette if avec_palette else (),
                tramage=tramage,
            ) if quant else None,
            bords=Bords(aire_min=aire_min) if bords else None,
        )

    # Le détourage coûte 130 ms et ne change pas d'une question à l'autre : on le
    # paie une fois par image, et toutes les questions travaillent sur sa sortie.
    detourees = {nom: detourer(recette(), octets) for nom, octets in images}
    releve: dict[str, object] = {"projet": options.projet, "cible": cible,
                                 "palette": len(palette), "images": len(images)}

    titre("1", "Le nombre de couleurs agit-il quand une palette est posée ?")
    inertes = 0
    for nom, _ in images:
        sorties = {n: finir(detourees[nom], recette(nombre=n)).octets
                   for n in (2, 8, couleurs_univers, 256)}
        identiques = len(set(sorties.values())) == 1
        inertes += identiques
        print(f"  {nom:26s} 2 / 8 / {couleurs_univers} / 256 → "
              f"{'PNG identique à l’octet près' if identiques else 'DIFFÉRENTS'}")
    print(f"  → inerte sur {inertes} des {len(images)} images")
    releve["nombre_inerte_sur"] = inertes

    titre("2", "Sans palette, obtient-on le nombre de couleurs qu'on demande ?")
    rendements: dict[int, list[int]] = {}
    for nom, _ in images[:6]:
        obtenus = []
        for demande in (4, 8, 16, 32, 64):
            rendu = rgba_de(finir(detourees[nom], recette(avec_palette=False, nombre=demande)).octets)
            obtenu = couleurs_distinctes(rendu)
            rendements.setdefault(demande, []).append(obtenu)
            obtenus.append(f"{demande}→{obtenu}")
        employees = couleurs_distinctes(rgba_de(finir(detourees[nom], recette()).octets))
        print(f"  {nom:26s} {'  '.join(obtenus)}   | palette du projet → {employees}/{len(palette)}")
    releve["rendement"] = {str(d): [min(v), max(v)] for d, v in rendements.items()}

    titre("3", "Ce que la palette du projet déplace")
    ecarts_medians, pires = [], []
    for nom, _ in images[:6]:
        avant = rgba_de(finir(detourees[nom], recette(quant=False)).octets)
        apres = rgba_de(finir(detourees[nom], recette()).octets)
        opaque = avant[:, :, 3] > 0
        ecart = np.abs(avant[:, :, :3].astype(np.int16)
                       - apres[:, :, :3].astype(np.int16)).max(axis=2)[opaque]
        ecarts_medians.append(int(np.median(ecart)))
        pires.append(int(ecart.max()))
        print(f"  {nom:26s} médian {int(np.median(ecart)):3d} · moyen {ecart.mean():5.1f} · "
              f"pire {int(ecart.max()):3d} · au-delà de 16 : {100 * (ecart > 16).mean():4.1f} %")
    releve["ecart_median"] = [min(ecarts_medians), max(ecarts_medians)]
    releve["ecart_pire"] = max(pires)

    titre("4", "Le tramage Floyd-Steinberg, sur une case de 64 px")
    changes_pc = []
    for nom, _ in images[:6]:
        sans = rgba_de(finir(detourees[nom], recette()).octets)
        avec = rgba_de(finir(detourees[nom], recette(tramage=FLOYD)).octets)
        opaque = sans[:, :, 3] > 0
        change = int((np.any(sans[:, :, :3] != avec[:, :, :3], axis=2) & opaque).sum())
        total = int(opaque.sum())
        changes_pc.append(round(100 * change / max(1, total), 1))
        print(f"  {nom:26s} {couleurs_distinctes(sans):3d}→{couleurs_distinctes(avec):3d} couleurs · "
              f"{change:5d}/{total} px changés ({100 * change / max(1, total):4.1f} %) · "
              f"isolés {pixels_isoles(sans):4d} → {pixels_isoles(avec):4d}")
    releve["tramage_pc_changes"] = [min(changes_pc), max(changes_pc)]

    titre("5", "Les taches d'une case finie, et ce que l'aire minimale retire")
    sans_miette = 0
    for nom, _ in images:
        rendu = rgba_de(finir(detourees[nom], recette()).octets)
        liste = aires(rendu)
        sans_miette += len(liste) == 1
        balayage = []
        for seuil in (2, 4, 8, 16, 32, 48):
            partis = [a for a in liste if a < seuil]
            balayage.append(f"{seuil}:{len(partis)}t")
        print(f"  {nom:26s} {len(liste):3d} taches · la plus grande {liste[0]:5d} px · "
              f"les autres {liste[1:9]}")
        if len(liste) > 1:
            print(f"  {'':26s} balayage {'  '.join(balayage)}")
    print(f"  → {sans_miette} des {len(images)} images n'ont qu'une seule tache")
    releve["une_seule_tache_sur"] = sans_miette

    titre("6", "D'où viennent les miettes : les taches avant et après la grille")
    for nom, _ in images[:6]:
        avant = aires(detourees[nom])
        apres = aires(rgba_de(finir(detourees[nom], recette()).octets))
        print(f"  {nom:26s} source {len(avant):3d} taches (la plus petite {min(avant)} px) → "
              f"case {len(apres):3d} taches (la plus petite {min(apres)} px)")

    titre("7", "L'ordre des places change-t-il l'image ?")
    for nom, _ in images[:5]:
        apres = rgba_de(finir(detourees[nom], recette()).octets)

        depart = time.perf_counter()
        tot = quantifier(detourees[nom], Quantification(couleurs=couleurs_univers, palette=palette))
        cout_source = 1000 * (time.perf_counter() - depart)
        avant_grille = sur_grille(tot, Grille(cible=cible, occupation=85, ancrage=BAS), case=True)

        depart = time.perf_counter()
        quantifier(apres, Quantification(couleurs=couleurs_univers, palette=palette))
        cout_case = 1000 * (time.perf_counter() - depart)

        # bords avant la quantification plutôt qu'après
        nettoye = rgba_de(finir(detourees[nom], recette(quant=False, bords=True, aire_min=4)).octets)
        inverse = quantifier(nettoye, Quantification(couleurs=couleurs_univers, palette=palette))
        droit = rgba_de(finir(detourees[nom], recette(bords=True, aire_min=4)).octets)

        print(f"  {nom:26s} quantifier avant la grille : "
              f"{'identique' if np.array_equal(avant_grille, apres) else 'DIFFÉRENT'} "
              f"({cout_source:.0f} ms contre {cout_case:.1f} ms) · "
              f"bords avant la quantification : "
              f"{'identique' if np.array_equal(inverse, droit) else 'DIFFÉRENT'}")

    SORTIE.write_text(json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8")
    print()
    print(f"relevé écrit dans {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
