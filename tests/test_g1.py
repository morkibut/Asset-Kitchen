# -*- coding: utf-8 -*-
"""Les critères de G1 — les phrases qui avaient cessé d'être vraies.

**Neuf phrases visibles du produit, et aucune n'était une approximation.**
Toutes ont été mesurées ou vérifiées le jour de leur écriture, et toutes ont été
démenties par un changement venu d'ailleurs — la plus ancienne a tenu sept
jours, la plus récente deux.

**Ce fichier ne prétend pas empêcher la dixième**, et c'est une décision de
l'auteur du 3 septembre 2026 : la règle générale — *un nombre affiché se calcule,
ou il ne s'affiche pas* — a été écartée. On relit, et on corrige quand ça se
voit.

⚠️ **Quatre de ces essais sont partis avec `C2`.** Ils lisaient des phrases de
`Assistant.tsx` — les noms de ses douze étapes, le compte des types, la phrase
de l'allure, le texte à copier —, et ce fichier a quitté le dépôt : il était le
doublon vrai de `ReglesDuJeu.tsx`, qui porte maintenant le relevé de ce qu'il
savait faire. Un essai qui garde une phrase d'un écran mort ne garde rien.

**Il fige donc la seule famille où le calcul ne coûte rien** : les numéros
d'étape. Ils étaient sept, écrits à la main, et l'insertion de l'étape du style
les a *tous* décalés d'un cran le même jour, sans qu'une erreur ne se lève —
« l'étape 2 » désignait une étape devenue la troisième. Le rang se calcule
maintenant depuis la liste, et ces essais vérifient qu'il n'est réécrit nulle
part.

**Aucun essai de ce fichier ne coûte un centime** : ils lisent des fichiers du
dépôt et rien d'autre.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[1]
SOURCES = RACINE / "interface" / "src"


def _fichiers_de_l_interface() -> list[Path]:
    """Tout ce que l'écran embarque — **les essais exclus**.

    Un essai a le droit de citer un numéro : il en fabrique un pour vérifier ce
    que l'écran en fait. Ce qui est interdit, c'est de l'écrire dans le produit.
    """
    return [
        chemin
        for motif in ("*.ts", "*.tsx")
        for chemin in SOURCES.rglob(motif)
        if ".test." not in chemin.name
    ]


#: `l'étape 4`, `à l'étape 10`, `Étape 1 · Son nom` — un rang écrit à la main,
#: sous quelque forme que ce soit.
#:
#: ⚠️ **La première écriture exigeait l'apostrophe et la minuscule**, et c'est
#: `B14` qui a montré le trou : son parcours en quatre étapes a écrit *cinq*
#: rangs à la main — quatre bandeaux de section `// ── Étape 2 · Son allure ──`
#: et un `L'étape 1` en tête de bloc — que cet essai a tous laissés passer, alors
#: qu'il en refusait huit autres dans les mêmes fichiers. La forme qui compte est
#: le mot suivi du chiffre ; la casse et ce qui précède ne sont que du décor.
NUMERO_D_ETAPE = re.compile(r"étape\s*\d+\b", re.IGNORECASE)


@pytest.mark.parametrize("texte,interdit", [
    ("l'étape 4", True), ("Étape 12 · Son allure", True),
    ("étape3", True), ("étape3 bis", True),
    ("Préparer une étape 3D", False), ("Étape 3D à préparer", False), ("étape3D", False),
])
def test_un_numero_d_etape_ne_se_confond_pas_avec_le_type_de_fabrication(texte, interdit):
    assert bool(NUMERO_D_ETAPE.search(texte)) is interdit


def test_aucun_numero_d_etape_n_est_ecrit_a_la_main():
    """Le critère de la tranche, et le seul défaut qui se soit répété.

    **Sans exception, et c'est ce qui le rend lisible.** Une première écriture
    laissait passer les lignes portant `G1` — celles qui racontent *pourquoi* on
    n'écrit plus de numéro et citent donc l'ancien. C'était une règle à deux
    étages, dont le second demandait de savoir qu'il existe. Ces deux
    lignes-là disent maintenant *« la deuxième »* en toutes lettres, ce qui les
    rend plus claires **et** rend cet essai absolu.

    **Élargi le 9 septembre 2026, en `B14`** : il ne demande plus l'apostrophe ni
    la minuscule. Un second parcours à étapes est né ce jour-là, et il a écrit
    cinq rangs que cette forme-ci ne voyait pas — quatre bandeaux de section et
    un début de commentaire. Le défaut que la tranche `G1` avait chiffré s'est
    donc reproduit, à la casse près, dans le premier écran à étapes construit
    depuis. Ce qui remplace un rang est **le nom de l'étape** : il ne se décale
    pas quand une autre s'insère.
    """
    fautives: list[str] = []
    for chemin in _fichiers_de_l_interface():
        for numero, ligne in enumerate(
            chemin.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if NUMERO_D_ETAPE.search(ligne):
                fautives.append(f"{chemin.relative_to(RACINE)}:{numero} — {ligne.strip()}")
    assert not fautives, (
        "un numéro d'étape est écrit à la main ; il se calcule depuis `ETAPES` "
        "(`laDesignation`) :\n  " + "\n  ".join(fautives)
    )


def test_la_lecture_de_palette_a_deux_phrases_selon_qu_il_reste_quelque_chose():
    """*« 100 % … le reste — le fond — est écarté »* se contredisait tout seul.

    Mesuré le 3 septembre 2026 sur les dix artworks officiels du dépôt : **trois
    sont lus à 100,0 %**, parce que le détourage n'y trouve aucun fond à retirer.
    Les deux écrans qui portent cette phrase la dédoublent maintenant, et le
    faire d'un seul côté aurait fabriqué deux vérités sur la même mesure.
    """
    for nom in ("Decoupe.tsx", "Tableau.tsx"):
        source = (SOURCES / "composants" / nom).read_text(encoding="utf-8")
        assert "part >= 100" in source, f"{nom} suppose encore qu'il reste un fond"
        assert "aucun fond à retirer" in source, nom


def test_la_barre_d_attente_ne_cite_plus_un_endroit_qu_elle_a_quitte():
    """*« Une retouche dans la fiche porte la même barre »* — la retouche a
    quitté la fiche pour les tables le 31 août 2026, en `E4`.
    """
    source = (SOURCES / "composants" / "pieces.tsx").read_text(encoding="utf-8")
    assert "une retouche **dans les\n * tables**" in source


def test_l_aide_de_l_epoque_dit_ce_qu_elle_fait_et_qu_elle_n_a_pas_ete_mesuree():
    """Elle affirmait *« décider des armes, des vêtements et des outils »* : c'est
    l'auteur qui les décide, en les écrivant.

    Et elle dit maintenant ce qu'aucun banc n'a mesuré, parce que c'est une
    décision assumée de la version — deux mots dans un prompt ne valent pas huit
    tirages payés par branche.
    """
    aide = (SOURCES / "aide.ts").read_text(encoding="utf-8")
    debut = aide.index('"bible.epoque"')
    entree = aide[debut : debut + 900]
    assert "n'a pas été mesuré" in entree
    assert "ce sont tes descriptions qui décident" in entree
