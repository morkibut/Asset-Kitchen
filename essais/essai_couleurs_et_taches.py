# -*- coding: utf-8 -*-
"""Le banc des deux dernières places de la recette — quantification et bords.

Écrit le 30 août 2026 pour les maquettes `docs/archive/maquettes-v2.1/14-table-quantification.html`
et `15-table-bords.html`, qui **citent ses chiffres**. Il existe pour qu'on puisse
les refaire : une maquette qui affirme une mesure sans banc pour la rejouer devient
invérifiable au premier doute.

**Il ne coûte rien.** Les images sont déjà sur le disque, la palette est celle d'un
vrai projet, et le post-traitement est du processeur pur — aucune clé n'est lue,
aucun appel n'est fait. Le seul coût est du temps de calcul.

Neuf questions, dans cet ordre — **les deux dernières ajoutées le 31 août 2026**,
avant d'écrire l'étape E11 du plan. Elles portent sur les deux curseurs de fusion
d'une palette, décrits dans `docs/archive/maquettes-v2.1/07-ambiances-et-couleurs.html`
au paragraphe « Une palette n'est pas une liste, c'est une recette ». Elles
existent parce que la question n° 1 de ce banc a déjà trouvé un réglage qui ne
faisait rien. Un curseur qui ne changerait rien se grise avec sa raison ; ce banc
est ce qui permet de le dire avant de le dessiner, pas après.

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
8. **La proportion change-t-elle l'image ?** Combien de couleurs viennent du jeu
   et combien de l'ambiance — c'est le premier des deux curseurs de fusion.
9. **L'attraction change-t-elle l'image ?** De combien les couleurs de l'ambiance
   sont tirées vers les plus proches de celles du jeu — le second curseur.

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
from atelier.image.palette import palette_de  # noqa: E402
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


# ── La fusion de deux palettes — les deux curseurs, tels que la maquette les
#    décrit ────────────────────────────────────────────────────────────────────
#
# **Rien de tout ceci n'existe encore dans le produit**, et c'est le sujet : on
# mesure avant d'écrire. Les trois fonctions ci-dessous sont la lecture littérale
# de `docs/archive/maquettes-v2.1/07-ambiances-et-couleurs.html`, au paragraphe « Une
# palette n'est pas une liste, c'est une recette », et elles n'ont pas d'autre
# ambition — si le banc dit qu'un curseur est inerte, c'est cette lecture-là qui
# est en cause autant que le curseur, et il faudra le dire.


def _rgb(hexa: str) -> tuple[int, int, int]:
    entier = int(hexa.lstrip("#"), 16)
    return (entier >> 16 & 255, entier >> 8 & 255, entier & 255)


def _hexa(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(float(c))) for c in rgb)


def reduire(palette: tuple[str, ...], combien: int) -> tuple[str, ...]:
    """Les `combien` couleurs de cette palette-là.

    **Par la coupe médiane, comme le reste du produit** : `palette_de` réduit
    déjà les couleurs d'un artwork de cette façon, et prendre les N premières à
    la place donnerait un résultat qui dépend de l'ordre d'écriture du fichier.
    """
    if combien <= 0:
        return ()
    if combien >= len(palette):
        return tuple(palette)
    bande = np.array([[_rgb(c) for c in palette]], dtype=np.uint8)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=combien, method=Image.Quantize.MEDIANCUT
    )
    plate = indexee.getpalette() or []
    return tuple(
        "#%02x%02x%02x" % tuple(plate[rang * 3 : rang * 3 + 3])
        for rang in sorted(set(indexee.tobytes()))
    )


def attirer(ambiance: tuple[str, ...], jeu: tuple[str, ...], part: float) -> tuple[str, ...]:
    """Chaque couleur de l'ambiance tirée vers la plus proche de celles du jeu.

    `part` va de 0 — rien ne bouge — à 1 — la couleur *devient* celle du jeu.
    C'est ce qui harmonise : le marais reste un marais, mais il respire l'air du
    jeu. La distance est euclidienne dans RGB, comme partout ailleurs ici.
    """
    if not jeu or part <= 0:
        return tuple(ambiance)
    cibles = np.array([_rgb(c) for c in jeu], dtype=np.int16)
    tirees = []
    for couleur in ambiance:
        source = np.array(_rgb(couleur), dtype=np.int16)
        proche = cibles[int(np.argmin(((cibles - source) ** 2).sum(axis=1)))]
        tirees.append(_hexa(source + (proche - source) * part))
    return tuple(tirees)


def fusionner(
    jeu: tuple[str, ...],
    ambiance: tuple[str, ...],
    total: int,
    du_jeu: int,
    attraction: float,
) -> tuple[str, ...]:
    """La palette d'une ambiance : `du_jeu` couleurs du jeu, le reste attiré.

    Le dédoublonnage est la seule liberté prise sur la maquette, et elle est
    forcée : à forte attraction, deux couleurs de l'ambiance tombent sur la même
    couleur du jeu, et une palette qui répète une entrée n'est pas une palette.
    C'est aussi ce qui rend le compte rendu **plus court que demandé** aux fortes
    valeurs, et le banc l'affiche plutôt que de le taire.
    """
    proches = attirer(reduire(ambiance, total - du_jeu), jeu, attraction)
    vues, sortie = set(), []
    for couleur in (*reduire(jeu, du_jeu), *proches):
        if couleur not in vues:
            vues.add(couleur)
            sortie.append(couleur)
    return tuple(sortie)


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

    # ── Les deux curseurs de fusion d'une palette ────────────────────────────
    #
    # **L'ambiance est déduite de deux vraies images du dépôt.** « Les images
    # d'un paquet du tableau » n'existe pas encore sur le disque, et fabriquer
    # une palette d'ambiance à la main — six couleurs choisies pour la
    # démonstration — répondrait d'avance à la question qu'on pose. On prend
    # donc les deux dernières images du corpus : elles ne servent à rien d'autre
    # ici, et leurs couleurs sont celles d'un vrai modèle sur un vrai sujet.

    ambiance = palette_de([octets for _, octets in images[-2:]], couleurs=len(palette))
    total = len(palette)
    mesurees = images[:6]

    def avec(fusionnee: tuple[str, ...]) -> Recette:
        return Recette(
            passes=(Passe(),),
            recadrage=Recadrage(),
            grille=Grille(cible=cible, occupation=85, ancrage=BAS),
            quantification=Quantification(
                couleurs=couleurs_univers, palette=fusionnee, tramage=AUCUN
            ),
            bords=None,
        )

    def rendus(fusionnee: tuple[str, ...]) -> tuple[bytes, ...]:
        """Ce que cette palette-là donne, image par image, en octets de PNG.

        Les octets et non les couleurs : c'est la mesure de la question n° 1 de
        ce banc, et c'est la seule qui réponde vraiment à « est-ce que ça change
        quelque chose ». Deux palettes différentes peuvent rendre le même
        fichier ; c'est justement ce qu'on cherche à savoir.
        """
        return tuple(finir(detourees[nom], avec(fusionnee)).octets for nom, _ in mesurees)

    def compter(sorties: dict) -> tuple[int, list[int]]:
        """Combien de rendus distincts en tout, et combien image par image."""
        entier = len({s for s in sorties.values()})
        par_image = [
            len({s[rang] for s in sorties.values()}) for rang in range(len(mesurees))
        ]
        return entier, par_image

    titre("8", "La proportion — combien de couleurs viennent du jeu")
    print(f"  jeu : {total} couleurs · ambiance déduite de "
          f"{' + '.join(nom for nom, _ in images[-2:])} : {len(ambiance)} couleurs")
    print(f"  attraction tenue à 0 % — on ne bouge qu'un curseur à la fois")
    proportions = sorted({0, total // 4, total // 2, 3 * total // 4, total})
    sorties_proportion = {}
    for du_jeu in proportions:
        fusionnee = fusionner(palette, ambiance, total, du_jeu, 0.0)
        sorties_proportion[du_jeu] = rendus(fusionnee)
        print(f"  {du_jeu:3d}/{total} du jeu → palette de {len(fusionnee):3d} couleurs "
              f"{'(dédoublonnée)' if len(fusionnee) < total else '              '} "
              f"· premières : {' '.join(fusionnee[:4])}")
    distincts, par_image = compter(sorties_proportion)
    print(f"  → {distincts} rendus distincts sur {len(proportions)} valeurs essayées · "
          f"par image : {par_image}")
    print(f"  → {'LE CURSEUR AGIT' if distincts > 1 else 'CURSEUR INERTE — à griser'}")
    releve["proportion_distincts"] = [distincts, len(proportions)]

    titre("9", "L'attraction — de combien l'ambiance se rapproche du jeu")
    milieu = total // 2
    print(f"  proportion tenue à {milieu}/{total} du jeu — l'autre curseur ne bouge pas")
    attractions = (0, 25, 50, 75, 100)
    sorties_attraction = {}
    for pour_cent in attractions:
        fusionnee = fusionner(palette, ambiance, total, milieu, pour_cent / 100)
        sorties_attraction[pour_cent] = rendus(fusionnee)
        print(f"  {pour_cent:3d} % → palette de {len(fusionnee):3d} couleurs "
              f"{'(dédoublonnée)' if len(fusionnee) < total else '              '} "
              f"· premières de l'ambiance : {' '.join(fusionnee[milieu:milieu + 4])}")
    distincts_a, par_image_a = compter(sorties_attraction)
    print(f"  → {distincts_a} rendus distincts sur {len(attractions)} valeurs essayées · "
          f"par image : {par_image_a}")
    print(f"  → {'LE CURSEUR AGIT' if distincts_a > 1 else 'CURSEUR INERTE — à griser'}")
    releve["attraction_distincts"] = [distincts_a, len(attractions)]

    # **Et la question que ni l'un ni l'autre ne pose seul** : deux curseurs
    # valent-ils mieux qu'un ? S'ils sont indépendants, la grille rend autant de
    # résultats que de cases ; s'ils font le même travail, elle s'effondre sur sa
    # diagonale, et un seul curseur suffirait.
    grille_croisee = {
        (du_jeu, pour_cent): rendus(
            fusionner(palette, ambiance, total, du_jeu, pour_cent / 100)
        )
        for du_jeu in proportions
        for pour_cent in attractions
    }
    cases = len(grille_croisee)
    distincts_grille, _ = compter(grille_croisee)
    print()
    print(f"  les deux ensemble : {distincts_grille} rendus distincts sur {cases} "
          f"combinaisons — {100 * distincts_grille / cases:.0f} % de la grille")
    print("  deux curseurs se justifient si ce nombre dépasse nettement "
          f"{max(distincts, distincts_a)}, ce que chacun rend seul")
    releve["fusion_grille_distincts"] = [distincts_grille, cases]

    # **Où la grille s'effondre, et c'est le seul endroit.** Un écart entre le
    # nombre de cases et le nombre de rendus n'est pas du bruit : il nomme une
    # combinaison où l'un des deux curseurs ne fait rien. C'est ce qui se grise
    # avec sa raison à l'écran, et il vaut mieux le lire ici que le découvrir en
    # tirant un curseur mort.
    inertes = []
    for du_jeu in proportions:
        ligne = {grille_croisee[(du_jeu, a)] for a in attractions}
        if len(ligne) == 1:
            inertes.append(du_jeu)
    if inertes:
        print()
        print("  l'attraction est INERTE à ces proportions, et la raison est "
              "mécanique :")
        for du_jeu in inertes:
            print(f"    {du_jeu}/{total} du jeu — il ne reste aucune couleur "
                  "d'ambiance à tirer vers quoi que ce soit")
    releve["attraction_inerte_a"] = inertes

    SORTIE.write_text(json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8")
    print()
    print(f"relevé écrit dans {SORTIE.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
