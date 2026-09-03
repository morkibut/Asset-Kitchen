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


#: `l'étape 4`, `à l'étape 10` — la forme exacte que le produit employait.
NUMERO_D_ETAPE = re.compile(r"l'étape\s+\d+")


def test_aucun_numero_d_etape_n_est_ecrit_a_la_main():
    """Le critère de la tranche, et le seul défaut qui se soit répété.

    **Sans exception, et c'est ce qui le rend lisible.** Une première écriture
    laissait passer les lignes portant `G1` — celles qui racontent *pourquoi* on
    n'écrit plus de numéro et citent donc l'ancien. C'était une règle à deux
    étages, dont le second demandait de savoir qu'il existe. Ces deux
    lignes-là disent maintenant *« la deuxième »* en toutes lettres, ce qui les
    rend plus claires **et** rend cet essai absolu.
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


def test_les_douze_etapes_portent_des_noms_distincts():
    """**Nommer une étape ne sert que si le nom en désigne une seule.**

    Les phrases du produit renvoient maintenant vers un nom — « l'étape « La
    vue » » — plutôt que vers un rang. Deux étapes homonymes rendraient le renvoi
    ambigu, et l'ambiguïté ne se verrait pas : la phrase resterait parfaitement
    lisible en désignant deux endroits.

    Le second nom de la quatrième étape compte comme un nom à part entière : il
    s'affiche, donc il doit être unique lui aussi.
    """
    source = (SOURCES / "composants" / "Assistant.tsx").read_text(encoding="utf-8")
    bloc = re.search(r"const ETAPES = \[(.*?)\n\] as const", source, re.S)
    assert bloc, "la liste `ETAPES` a disparu de `Assistant.tsx`"

    noms = re.findall(r"nom(?:Dessin)?: \"([^\"]+)\"", bloc.group(1))
    cles = re.findall(r"\{ cle: \"(\w+)\"", bloc.group(1))
    assert len(cles) == 12, f"douze étapes attendues, {len(cles)} trouvées"
    assert len(noms) == len(set(noms)), f"deux étapes portent le même nom : {noms}"


def test_le_compte_des_types_se_lit_sur_le_projet_ouvert():
    """*« Les huit types »* était juste, puis un huitième est entré dans le
    barème livré et la phrase a cessé de l'être — sans changer d'un mot.

    Le barème est affiché dans la même étape, trois lignes plus haut : le
    compter est gratuit, et il ne peut plus mentir.
    """
    source = (SOURCES / "composants" / "Assistant.tsx").read_text(encoding="utf-8")
    assert "les huit types" not in source
    assert "univers.bareme.length} types de ce" in source


def test_la_phrase_de_l_allure_ne_cite_plus_de_proportion():
    """*« Plus de la moitié du texte »* : 41 à 45 % depuis qu'un bloc caméra a
    ajouté cinq cents caractères ailleurs, le soir même de son écriture.

    **Elle disparaît plutôt qu'elle ne se remesure** : c'est un rapport entre
    deux textes qui bougent chacun de leur côté, et le calculer ici demanderait
    d'assembler le prompt entier pour afficher une phrase d'introduction. Ce qui
    reste est ce qui ne bouge pas — c'est le bloc le plus lourd.
    """
    source = (SOURCES / "composants" / "Assistant.tsx").read_text(encoding="utf-8")
    debut = source.index("titre=\"L'allure\"")
    conduite = source[debut : debut + 1800]
    # **La forme rendue, pas le mot** : le commentaire qui explique le retrait
    # cite forcément la phrase d'avant, et le lui reprocher rendrait la
    # correction indocumentable.
    assert "<strong className=\"text-texte\">plus de la moitié" not in conduite
    assert "le bloc le plus lourd" in conduite
    # Et *l'univers* au lieu de *la tête* : « la tête que ton jeu doit avoir »
    # est une image, et cette étape-là décrit un monde.
    assert "sur l'univers de ton jeu" in conduite


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


def test_le_texte_a_copier_demande_trois_approches_et_non_trois_teintes():
    """*« Trois variantes qui explorent différentes températures de couleur »* :
    on choisissait un filtre là où l'on cherche une direction.

    Ce texte part chez un outil grand public, jamais chez le fournisseur de
    l'atelier — **rien n'est payé par ici**.
    """
    source = (SOURCES / "composants" / "Assistant.tsx").read_text(encoding="utf-8")
    assert "colour temperatures" not in source
    assert "different approach to the same scene" in source


def test_la_barre_d_attente_ne_cite_plus_un_endroit_qu_elle_a_quitte():
    """*« Une retouche dans la fiche porte la même barre »* — la retouche a
    quitté la fiche pour les tables le 31 août 2026, en `E4`.
    """
    source = (SOURCES / "composants" / "chassis.tsx").read_text(encoding="utf-8")
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
