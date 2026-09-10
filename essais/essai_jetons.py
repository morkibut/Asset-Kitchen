# -*- coding: utf-8 -*-
"""Le garde-fou du système de design — **et il regarde dans les deux sens.**

`docs/design-decisions.md` du 4 septembre 2026 en demandait un, et il ne
regardait que dans un sens : *ce que le code écrit est-il déclaré ?* En fermant
`D0`, le 6 septembre, la question inverse a trouvé le vrai trou — **huit
couleurs de châssis employées dans vingt à quarante planches et déclarées nulle
part**, toutes pour la même raison : un signal n'est pas une couleur, c'est un
trio. Un fond, un trait, une encre.

Ce banc pose donc les deux questions, et il ne les traite pas pareil :

**Sens 1 — ce que le code écrit est-il déclaré ? Il refuse.**
Un utilitaire Tailwind dont le jeton n'existe pas **ne lève aucune erreur** : il
ne produit pas de règle, et l'élément garde la couleur de son parent. C'est
invisible à la relecture, invisible au compilateur, invisible aux essais
d'écran — un gris sur du gris ne détonne pas. Le 6 septembre 2026, le premier
passage en a trouvé **quinze emplois dans quatre fichiers** : `signal-sourd`
(deux boutons actifs sans fond), `texte-1` (neuf survols qui ne changeaient
rien), `attente`, `info`.

**Sens 2 — ce qui est déclaré, quelqu'un l'emploie-t-il ? Il rend un compte.**
Il ne refuse rien, et c'est délibéré : un jeton que personne n'emploie est soit
une pièce pas encore dessinée, soit un jeton mort, et **seul un humain sait
lequel**. Le carnet en déclare naturellement d'avance — l'étiquette verte est
dans le document sans qu'aucun écran s'en serve encore.

**Et les tailles.** `docs/DESIGN.md` ferme cinq listes — les écarts, les
hauteurs, les largeurs, les tailles de texte, les arrondis — et une sixième,
les durées. **Elles s'appliquent à `interface/src` en entier**, et c'est ce que
`C9` a changé : jusque-là le banc tenait une **liste blanche**,
`LES_FICHIERS_DU_CARNET`, et ne mesurait que les fichiers qu'on y avait
inscrits. Une liste blanche se trompe toujours du même côté — un fichier neuf
n'était tenu que si quelqu'un pensait à l'y ajouter, et personne ne voit qu'un
nom manque.

À sa place, `LA_GEOMETRIE_D_AVANT` : la même liste de fichiers, à l'envers. Le
banc tient **tout**, sauf ce qu'elle nomme — les écrans dont la géométrie est
encore celle du châssis sombre, 10 px de texte, arrondis de 2 px, durées de
80 ms. Un fichier neuf est donc tenu d'office, et cette liste ne fait que
maigrir : le banc dit lui-même quand un de ses noms est devenu propre.

**Et un troisième compte, ajouté en `C1` : ce qui reste à sortir.**
`LES_FICHIERS_DE_L_ANCIEN_CHASSIS` nomme ce qui tourne **encore** sur le
châssis sombre — sa couleur, pas sa géométrie —, le banc l'imprime avec son
compte de lignes, et chaque tranche du bloc en retire des noms ; le bloc, c'est
`docs/PLAN-carnet.md` § *La sortie de l'ancien châssis*. Le relevé du
10 septembre 2026 partait de 33 fichiers.

Il ne coûte rien : ni clé, ni réseau, ni atelier lancé, ni navigateur.

    Lancer :  py essais/essai_jetons.py
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "interface" / "src"
CSS = SRC / "index.css"

# ── Ce que le garde-fou tient ───────────────────────────────────────────────

# **La géométrie d'avant — ce que le banc ne mesure pas encore aux listes
# fermées de `docs/DESIGN.md`.** C'est la seule liste qui reste, et elle
# remplace `LES_FICHIERS_DU_CARNET`, qui était une **liste blanche** : le banc
# ne tenait alors que les fichiers qu'on y avait inscrits, et un écran neuf
# passait au travers tant que personne ne pensait à l'y ajouter. Ici c'est
# l'inverse — tout `interface/src` est tenu, sauf ces noms-là.
#
# Un nom n'y entre pas parce qu'il est vieux : il y entre parce qu'il écrit
# aujourd'hui des tailles hors des six listes fermées — 10 px de texte,
# arrondis de 2 px, durées de 80 ms, largeurs libres. Les rouvrir une à une est
# un **dessin**, pas un renommage de jeton : c'est ce que `C5`, `C6` et `C7`
# ont écrit chacun pour leur écran en le sortant du châssis sombre sans
# toucher à sa géométrie. Le banc dit lui-même, plus bas, quand un de ces noms
# est devenu propre — la liste ne fait que maigrir.
LA_GEOMETRIE_D_AVANT = (
    # Les trois qui ne sont pas des écrans. `api.ts` et `recette.ts` portent une
    # couleur en clair chacun, et ce sont des **valeurs du domaine** — un fond
    # de rendu, un blanc de référence —, pas des jetons de design : la règle
    # « une couleur se déclare dans index.css » ne les vise pas, et le banc ne
    # sait pas encore faire la différence.
    "interface/src/api.ts",
    "interface/src/recette.ts",
    # `App.tsx` porte encore, en clair dans son JSX, le repli des réglages de la
    # barre, l'écran de confirmation et la surface de repos de « Fabriquer une
    # image ». Ils sortiront avec les fichiers qui les reprendront.
    "interface/src/App.tsx",
    # ── Les écrans encore sur le châssis sombre ──────────────────────────────
    "interface/src/composants/Ambiances.tsx",
    "interface/src/composants/Arbre.tsx",
    "interface/src/composants/BarreEtat.tsx",
    "interface/src/composants/BarreOutils.tsx",
    "interface/src/composants/ChampPrompt.tsx",
    "interface/src/composants/chassis.tsx",
    "interface/src/composants/Depliage.tsx",
    "interface/src/composants/EcranReglages.tsx",
    "interface/src/composants/Fiche.tsx",
    "interface/src/composants/FicheDuClip.tsx",
    "interface/src/composants/Galerie.tsx",
    "interface/src/composants/Import.tsx",
    "interface/src/composants/PanneauReglages.tsx",
    "interface/src/composants/Secrets.tsx",
    "interface/src/composants/Tableau.tsx",
    "interface/src/composants/Toile.tsx",
    "interface/src/composants/Tuile.tsx",
    "interface/src/composants/Univers.tsx",
    # ── Sortis du châssis sombre, mais pas de sa géométrie ───────────────────
    # `C5`, `C6` et `C7` l'ont écrit en toutes lettres : leurs jetons de couleur
    # sont ceux du papier, leurs tailles sont celles d'avant.
    "interface/src/composants/AtelierDeBande.tsx",
    "interface/src/composants/Clip.tsx",
    "interface/src/composants/Envoi.tsx",
    "interface/src/composants/EtabliDuSujet.tsx",
    "interface/src/composants/FicheChose.tsx",
    "interface/src/composants/Montage.tsx",
    "interface/src/composants/Mouvements.tsx",
    "interface/src/composants/Planche.tsx",
    "interface/src/composants/Vitrine.tsx",
    "interface/src/composants/Calibrage.tsx",
    "interface/src/composants/Calque.tsx",
    # ── Les deux pièces partagées ────────────────────────────────────────────
    # Des écrans du carnet les montent déjà, et des écrans d'avant aussi : elles
    # ne peuvent changer de géométrie que le jour où les seconds sont partis.
    "interface/src/composants/Apercu.tsx",
    "interface/src/composants/Infobulle.tsx",
)

# **Les fichiers de l'ancien châssis — ceux que la V4 n'a pas encore
# retirés.** Le sens inverse de la liste ci-dessus : chaque tranche de
# `docs/PLAN-carnet.md` § *La sortie de l'ancien châssis* (`C1` à `C9`) en
# retire des noms, jamais l'inverse — un fichier ne rentre pas ici une fois
# sorti. Deux pièces partagées entre l'ancien et le neuf n'y figurent pas,
# `Infobulle.tsx` et `Apercu.tsx` : des écrans du carnet les montent déjà
# (`GrilleDuJeu.tsx`, `PageDuSujet.tsx`, `Retouche.tsx`…), les retirer
# casserait ce qui est déjà livré.
LES_FICHIERS_DE_L_ANCIEN_CHASSIS = (
    # C1 — les réglages : EcranReglages et Mouvements perdent leur dernière
    # porte ; Secrets reste tant qu'EcranReglages.tsx le monte.
    # `Mouvements.tsx` est sorti en `C7`, avec `AtelierDeBande.tsx` — même
    # geste, même écran de réglages.
    "interface/src/composants/EcranReglages.tsx",
    "interface/src/composants/Secrets.tsx",
    # C2 — `Assistant.tsx` est parti : c'était le doublon vrai de
    # `ReglesDuJeu.tsx`, et le relevé de ses douze étapes est en tête de ce
    # fichier-là. Restent les trois côtés d'inspiration de l'onglet Univers.
    #
    # ⚠️ **Leur passage au papier n'est pas un portage de jetons, c'est un
    # dessin.** Les dix teintes d'îlot (`--color-ilot-…`) sont calibrées pour
    # un fond sombre — « dix à 4,6 : 1 sur `--color-fond-2` », dit
    # `index.css` —, et la géométrie de la toile (la carte, la réserve, le
    # menu d'un îlot) ne tient dans aucune des largeurs fermées de
    # `docs/DESIGN.md` § Spacing. `Toile.dc.html` dessine la version papier ;
    # la reconstruire demande sa propre tranche, pas la fin de celle-ci.
    "interface/src/composants/Univers.tsx",
    "interface/src/composants/Toile.tsx",
    "interface/src/composants/Tableau.tsx",
    "interface/src/composants/Ambiances.tsx",
    # C3 — le codex : parti (`Codex.tsx`, retiré le 10 septembre 2026). Sa
    # colonne des familles était le carnet, sa grille celle d'une famille ;
    # créer une pièce d'équipement se fait depuis la fiche de qui la porte
    # (`VestiaireDuSujet.tsx`).
    # C4 — la galerie. **Elle est un fichier depuis le 10 septembre 2026** :
    # elle était écrite en clair dans `App.tsx`, et le banc ne la voyait donc
    # pas — ni sa grille, ni sa cible, ni ses réinjections, ni la barre d'état
    # du châssis. Elle entre ici avec `BarreEtat.tsx`, et **c'est la seule fois
    # de ce bloc où le compte monte** : ce ne sont pas des lignes neuves, ce
    # sont des lignes qu'`App.tsx` cachait. Les redessiner sur le papier de
    # `Galerie.dc.html` est un dessin, pas une extraction — il vient après.
    "interface/src/composants/Galerie.tsx",
    "interface/src/composants/BarreEtat.tsx",
    "interface/src/composants/Arbre.tsx",
    "interface/src/composants/BarreOutils.tsx",
    "interface/src/composants/Tuile.tsx",
    "interface/src/composants/Import.tsx",
    "interface/src/composants/Depliage.tsx",
    "interface/src/composants/FicheDuClip.tsx",
    # **Un seul volet de fiche d'image dans le produit** (`C4`). Il y en avait
    # deux : celui-ci, et un second écrit en clair dans `ImagesDuSujet.tsx` —
    # même métier, deux surfaces. Le second est parti, et ce que lui seul savait
    # faire — de quelle case on parle, l'angle à confirmer, la variante, l'écart
    # — vit maintenant ici, derrière des rappels facultatifs. `Fiche.tsx` est
    # donc montée par la galerie **et** par *Ses images*.
    "interface/src/composants/Fiche.tsx",
    # ⚠️ **Ces deux-là ne sont pas la galerie**, et le plan les lui attribuait :
    # la barre qui paie a quitté la galerie en `E4` — on ne paie plus d'ici. Ils
    # partiront avec les deux surfaces qui la portent, le repos de l'onglet
    # *Créer* et l'établi d'un sujet.
    "interface/src/composants/ChampPrompt.tsx",
    "interface/src/composants/PanneauReglages.tsx",
    # C5 — l'envoi, le clip, le montage : sortis le 10 septembre 2026. Leurs
    # jetons sont ceux du papier ; `Bouton`, `Libelle`, `Raison`, `Segments` et
    # `Curseur` de `chassis.tsx` portent pour ça un second habillage, additif,
    # derrière une prop `papier` — `chassis.tsx` lui-même reste ici, C9 le
    # sortira. ⚠️ Ils restent dans `LA_GEOMETRIE_D_AVANT` : leurs tailles
    # restent celles de l'ancien châssis (10 px, 22 px, arrondis de 1 et 2 px…),
    # hors des listes fermées de `docs/DESIGN.md` — les rouvrir une à une est le
    # dessin qu'`Envoi.dc.html`, `Clip.dc.html` et `Animation-chaine.dc.html`
    # posent, pas un renommage de jeton. Compté ici comme sorti quand même :
    # c'est la couleur du châssis que ce bloc mesure, pas encore sa géométrie.
    # C6 — l'établi d'un sujet : sorti le 10 septembre 2026. ⚠️ Le piège nommé
    # par le plan — `Personnages.tsx` était monté par `PageDuSujet.tsx`, un
    # écran neuf, et son contenu restait l'ancien châssis intégral. Il est
    # renommé `EtabliDuSujet.tsx` plutôt que retiré : `EcranEtabli` et ses
    # fonctions pures (`faitesDeLaCase`, `posesTenues`…) restent employées par
    # `Fiche.tsx` et `Planche.tsx`. Comme `C5` : géométrie inchangée, ne
    # reste dans `LA_GEOMETRIE_D_AVANT`.
    # C7 — l'atelier d'une animation : `AtelierDeBande.tsx` et
    # `Mouvements.tsx` sont sortis ensemble, le 10 septembre 2026. ⚠️ Comme
    # `C5` : les postes de la recette viennent déjà de `Retouche.tsx` (`B26`),
    # donc les moteurs étaient déjà neufs — seul le châssis autour l'était
    # encore. Ils restent dans `LA_GEOMETRIE_D_AVANT` : leurs tailles
    # restent celles du châssis sombre, pas encore ouvertes une à une contre
    # les listes fermées de `docs/DESIGN.md`.
    # C9 — la barre elle-même, et le réglage de palette qu'elle porte.
    "interface/src/composants/chassis.tsx",
)

# ── Les listes fermées de `docs/DESIGN.md` ──────────────────────────────────

# § Spacing — « les seuls écarts », plus les marges de la surface et sa
# gouttière, qui sont du même vocabulaire.
ECARTS = {4, 8, 14, 22, 34, 30}
# § Spacing — hauteurs de contrôle, plus le champ de prompt à 54 « parce que
# c'est une zone de saisie et non une bande ».
HAUTEURS = {34, 30, 26, 22, 54}
# § Spacing — largeurs de colonne. La surface prend le reste, donc elle n'a pas
# de nombre : `flex-1`, jamais une soustraction.
# `880` est entrée avec B6 : c'est le plafond de la barre, relevé sur
# `Barre.dc.html` et déclaré dans `docs/DESIGN.md` § Largeurs de colonne. Ce
# n'est pas une colonne — la barre se pose par-dessus les deux autres —, mais
# c'est bien une largeur fixe que le produit écrit, donc elle se déclare.
# `128` est entrée avec B24 : la colonne « ses sœurs » de `Retouche.tsx`, une
# vignette de large et rien d'autre — ni 300 ni 380 ne lui conviennent.
LARGEURS = {300, 380, 880, 128}
# § Spacing — largeurs de petit contrôle. `70` est entrée avec B24 : la
# mollette d'opacité du témoin « par-dessus » de `Retouche.tsx`, un curseur
# qu'on tire au doigt et qui doit rester assez long pour se régler sans
# trembler.
LARGEURS_DE_CONTROLE = {70}
# § Typography — l'échelle. `11.5` y est entrée parce que six planches
# d'atelier l'emploient 280 fois ; rien ne descend sous 10.5.
TEXTES = {52, 38, 25, 15, 14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5}
# § Layout — arrondis.
ARRONDIS = {5, 7, 8, 10}
# § Motion — quatre durées, et une absence.
DUREES = {120, 180, 220}

# Une pièce peut être carrée et petite : la pastille de 4 px du pied du carnet
# est un écart employé comme taille. Les deux listes se rejoignent donc pour les
# hauteurs et largeurs libres.
TAILLES = HAUTEURS | LARGEURS | ECARTS | LARGEURS_DE_CONTROLE

# ── Ce que Tailwind fournit lui-même ────────────────────────────────────────

# **Ces suffixes ne sont pas des jetons du produit**, ce sont des mots de
# Tailwind. La liste est explicite plutôt que devinée : un garde-fou qui essaie
# de reconnaître « ce qui ressemble à un jeton » se trompe dans les deux sens.
# Quand une version de Tailwind en ajoute un, le banc le nomme, et on l'ajoute
# ici — c'est deux secondes, et c'est le prix de ne pas laisser passer un vrai
# jeton manquant.
NATIF = {
    # Les couleurs et mots-clés du framework.
    "transparent", "current", "inherit", "white", "black", "none", "auto",
    # Les côtés d'une bordure : `border-t`, `border-x-0`…
    "t", "r", "b", "l", "x", "y", "s", "e",
    # Les épaisseurs et les échelles nues.
    "0", "1", "2", "4", "8", "px",
    # `text-…` sert aussi à l'alignement, à la césure et à l'échelle.
    "left", "right", "center", "justify", "start", "end",
    "wrap", "nowrap", "balance", "pretty", "clip", "ellipsis",
    "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl",
    # `border-…` et `decoration-…` servent aussi au style du trait.
    "solid", "dashed", "dotted", "double", "hidden",
    # …et au **modèle de bordure d'un tableau** : `border-collapse` et
    # `border-separate` sont des mots du framework au même titre que `dashed`,
    # pas des noms de couleur. Trouvés en B9.4, la première vue du produit qui
    # dessine un vrai tableau.
    "collapse", "separate",
}

UTILITAIRES = (
    "bg|text|border|ring|fill|stroke|outline|decoration|shadow|accent|caret|"
    "divide|placeholder|from|to|via"
)

DECLARE = re.compile(r"^\s*--color-([a-z0-9-]+)\s*:", re.M)
# Un utilitaire de couleur et tout ce qui le suit, opacité comprise. Le côté
# d'une bordure — `border-t-0`, `border-l-2` — n'est pas retiré ici : il l'est
# après, par `nom_du_jeton`, parce qu'un motif qui essaie de le faire seul se
# trompe dès que le reste commence par un chiffre.
EMPLOI = re.compile(
    rf"(?<![\w-])(?:{UTILITAIRES})-([a-z0-9][a-z0-9-]*?)(?:/\d+)?(?![\w-])"
)
COTE = re.compile(r"^[trblxyse]-(.+)$")
VARIABLE = re.compile(r"var\(--color-([a-z0-9-]+)\)")


def nom_du_jeton(suffixe: str) -> str | None:
    """Le nom de jeton que porte un utilitaire, ou `None` si ce n'en est pas un.

    Trois choses ne sont pas des jetons, et les trois se ressemblent à l'œil :
    le côté d'une bordure (`border-t-0`), une épaisseur nue (`border-2`), et
    un nom **calculé** (`` `bg-ilot-${teinte}` ``). Ce dernier échappe par
    nature à tout contrôle statique — c'est le seul trou de ce banc, et il est
    petit : dix teintes, une seule fabrique, dans `interface/src/api.ts`.
    """
    if suffixe.endswith("-"):
        return None  # un nom calculé : `bg-ilot-${…}`
    if (cote := COTE.match(suffixe)) is not None:
        suffixe = cote.group(1)
    if suffixe.isdigit() or suffixe.endswith("-"):
        return None
    return suffixe

# Une couleur écrite en clair, sous n'importe quelle forme.
EN_DUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch)\(")

TAILLE = re.compile(r"(?<![\w-])(?:min-|max-)?[whpm][trblxy]?-\[(\d+(?:\.\d+)?)px\]")
TEXTE = re.compile(r"(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]")
ARRONDI = re.compile(r"(?<![\w-])rounded(?:-[a-z]+)?-(?:\[(\d+)px\]|(\d+))(?![\w-])")
DUREE = re.compile(r"(?<![\w-])duration-(?:\[(\d+)ms\]|(\d+))(?![\w-])")
ROUILLE = re.compile(r"(?<![\w-])bg-signal(?:/\d+)?(?![\w-])")


def nombre(texte: str) -> float:
    valeur = float(texte)
    return int(valeur) if valeur.is_integer() else valeur


def sources() -> list[Path]:
    """Tout ce qui peut porter une classe, essais d'écran exclus.

    Un essai cite des noms de classes pour les vérifier ; il ne les *emploie*
    pas. Les compter ferait dire à un jeton qu'il sert alors que seul son
    contrôle en parle."""
    trouves = []
    for chemin in sorted(SRC.rglob("*")):
        if chemin.suffix not in {".ts", ".tsx", ".css"}:
            continue
        if chemin.name.endswith(".test.tsx") or chemin.name == "index.css":
            continue
        trouves.append(chemin)
    return trouves


# ── Sens 1 — ce que le code écrit est-il déclaré ? ──────────────────────────


def emplois(declares: set[str]) -> tuple[Counter[str], dict[str, list[str]]]:
    comptes: Counter[str] = Counter()
    ou: dict[str, list[str]] = {}

    def compter(nom: str | None, relatif: str) -> None:
        if nom is None or (nom in NATIF and nom not in declares):
            return
        comptes[nom] += 1
        lignes = ou.setdefault(nom, [])
        if relatif not in lignes:
            lignes.append(relatif)

    for chemin in sources():
        texte = chemin.read_text(encoding="utf-8")
        relatif = chemin.relative_to(RACINE).as_posix()
        for suffixe in EMPLOI.findall(texte):
            compter(nom_du_jeton(suffixe), relatif)
        for nom in VARIABLE.findall(texte):
            compter(nom, relatif)

    # **La feuille de style est aussi une cliente.** Le damier, le curseur et la
    # barre de défilement s'y écrivent en `var(--color-…)` ; les compter pour
    # rien ferait passer six jetons vivants pour des jetons morts. Seuls les
    # `var()` sont lus : une déclaration n'est pas un emploi.
    for nom in VARIABLE.findall(CSS.read_text(encoding="utf-8")):
        compter(nom, CSS.relative_to(RACINE).as_posix())

    return comptes, ou


def jetons_non_declares(
    declares: set[str], comptes: Counter[str], ou: dict[str, list[str]]
) -> list[str]:
    fautes = []
    for nom, compte in sorted(comptes.items()):
        if nom not in declares:
            fautes.append(f"`{nom}` — {compte} emplois · {', '.join(ou[nom])}")
    return fautes


# ── Sens 1 bis — les listes fermées, dans les fichiers du carnet ────────────


def hors_des_listes(relatif: str, texte: str) -> list[str]:
    fautes = []

    for ligne_no, ligne in enumerate(texte.splitlines(), start=1):
        # Une couleur en clair, jamais — même dans un commentaire d'exemple :
        # c'est de là que part la copie qui la fait entrer pour de bon.
        for trouve in EN_DUR.finditer(ligne):
            fautes.append(
                f"{relatif}:{ligne_no} — couleur écrite en clair « {trouve.group(0)} » ;"
                " elle se déclare dans `interface/src/index.css`, et nulle part ailleurs"
            )
        for trouve in TEXTE.finditer(ligne):
            valeur = nombre(trouve.group(1))
            if valeur not in TEXTES:
                fautes.append(
                    f"{relatif}:{ligne_no} — taille de texte {valeur} px, hors de"
                    " l'échelle fermée de `docs/DESIGN.md` § Typography"
                )
        for trouve in TAILLE.finditer(ligne):
            valeur = nombre(trouve.group(1))
            if valeur not in TAILLES:
                fautes.append(
                    f"{relatif}:{ligne_no} — {valeur} px, hors des hauteurs, largeurs"
                    " et écarts fermés de `docs/DESIGN.md` § Spacing"
                )
        for trouve in ARRONDI.finditer(ligne):
            valeur = int(trouve.group(1) or trouve.group(2))
            if valeur not in ARRONDIS:
                fautes.append(
                    f"{relatif}:{ligne_no} — arrondi de {valeur} px, hors de la liste"
                    " fermée de `docs/DESIGN.md` § Layout"
                )
        for trouve in DUREE.finditer(ligne):
            valeur = int(trouve.group(1) or trouve.group(2))
            if valeur not in DUREES:
                fautes.append(
                    f"{relatif}:{ligne_no} — durée de {valeur} ms, hors des quatre de"
                    " `docs/DESIGN.md` § Motion"
                )

    # **Un seul bouton rouille par écran.** Le rouille ne sert qu'à deux
    # choses — le bouton qui lance et le chiffre qui coûte —, et le second
    # s'écrit en `text-signal`, jamais en fond. Deux fonds rouille dans un
    # écran, c'est qu'un des deux ment sur ce qu'il fait.
    fonds = ROUILLE.findall(texte)
    if len(fonds) > 1:
        fautes.append(
            f"{relatif} — {len(fonds)} fonds rouille ; un seul bouton rouille par écran"
            " (`docs/DESIGN.md` § Les onze pièces)"
        )

    return fautes


# ── Sens 2 — ce qui est déclaré, quelqu'un l'emploie-t-il ? ────────────────


def jetons_inemployes(declares: set[str], comptes: Counter[str]) -> list[str]:
    return sorted(nom for nom in declares if comptes.get(nom, 0) == 0)


# ── Le journal ──────────────────────────────────────────────────────────────


def main() -> int:
    if not CSS.exists():
        print("interface/src/index.css est introuvable")
        return 1

    declares = set(DECLARE.findall(CSS.read_text(encoding="utf-8")))
    comptes, ou = emplois(declares)

    lignes: list[str] = []
    lignes.append("Le système de design, dans les deux sens")
    lignes.append("=" * 40)
    lignes.append("")
    lignes.append(
        f"  {len(declares)} jetons de couleur déclarés dans interface/src/index.css."
    )
    lignes.append(
        f"  {len(LA_GEOMETRIE_D_AVANT)} fichiers portent encore la géométrie d'avant,"
        " et sont seuls hors des listes fermées."
    )
    lignes.append("")

    # ── Le compte de sortie ──────────────────────────────────────────────────
    lignes.append("Le compte de sortie · ce qui tourne encore sur l'ancien châssis")
    lignes.append("-" * 58)
    total_lignes_anciennes = 0
    manquants = []
    for relatif in LES_FICHIERS_DE_L_ANCIEN_CHASSIS:
        chemin = RACINE / relatif
        if not chemin.exists():
            manquants.append(relatif)
            continue
        compte = len(chemin.read_text(encoding="utf-8").splitlines())
        total_lignes_anciennes += compte
        lignes.append(f"    · {relatif} — {compte} lignes")
    lignes.append("")
    lignes.append(
        f"  {len(LES_FICHIERS_DE_L_ANCIEN_CHASSIS)} fichiers encore sur l'ancien"
        f" châssis, {total_lignes_anciennes} lignes au total."
    )
    lignes.append(
        "  Départ du 10 septembre 2026 : 33 fichiers / 41 059 lignes. Ce chiffre"
    )
    lignes.append(
        "  descend : `C2` à `C9` retirent des noms de la liste. Une seule exception,"
    )
    lignes.append(
        "  `C4` : la galerie était écrite en clair dans `App.tsx`, invisible au banc ;"
    )
    lignes.append(
        "  la sortir en fichier l'a rendue comptable. Deux noms de plus, pas une"
    )
    lignes.append("  ligne de plus.")
    if manquants:
        lignes.append("")
        lignes.append(
            "  Fichiers déjà partis mais encore dans la liste — retire-les de"
            " LES_FICHIERS_DE_L_ANCIEN_CHASSIS :"
        )
        for relatif in manquants:
            lignes.append(f"    · {relatif}")
    lignes.append("")

    # ── Sens 1 ───────────────────────────────────────────────────────────────
    fautes = jetons_non_declares(declares, comptes, ou)
    lignes.append("Sens 1 · ce que le code écrit, la liste le déclare-t-elle ?")
    lignes.append("-" * 58)
    if fautes:
        lignes.append("")
        for faute in fautes:
            lignes.append(f"  MANQUE  {faute}")
        lignes.append("")
        lignes.append(
            "  Un utilitaire dont le jeton n'existe pas ne lève aucune erreur : il ne"
        )
        lignes.append(
            "  produit pas de règle, et l'élément garde la couleur de son parent."
        )
    else:
        lignes.append("  Tous les noms de couleur employés sont déclarés.")
    lignes.append("")

    # **Tout `interface/src`, sauf la géométrie d'avant.** L'inverse de la
    # liste blanche d'avant `C9` : un fichier neuf est tenu sans que personne
    # ait eu à l'inscrire quelque part.
    tenus = 0
    devenus_propres = []
    for chemin in sources():
        relatif = chemin.relative_to(RACINE).as_posix()
        trouvees = hors_des_listes(relatif, chemin.read_text(encoding="utf-8"))
        if relatif in LA_GEOMETRIE_D_AVANT:
            if not trouvees:
                devenus_propres.append(relatif)
            continue
        tenus += 1
        fautes.extend(trouvees)

    hors = [f for f in fautes if f not in jetons_non_declares(declares, comptes, ou)]
    lignes.append("Sens 1 bis · les listes fermées, dans tout interface/src")
    lignes.append("-" * 58)
    if hors:
        lignes.append("")
        for faute in hors:
            lignes.append(f"  HORS LISTE  {faute}")
    else:
        lignes.append(
            f"  {tenus} fichiers tenus : aucune couleur en clair, aucune taille,"
        )
        lignes.append("  aucun arrondi, aucune durée hors des listes de docs/DESIGN.md.")
    if devenus_propres:
        lignes.append("")
        lignes.append(
            "  Devenus propres — retire-les de LA_GEOMETRIE_D_AVANT, le banc les"
            " tiendra :"
        )
        for relatif in devenus_propres:
            lignes.append(f"    · {relatif}")
    lignes.append("")

    # ── Sens 2 ───────────────────────────────────────────────────────────────
    inemployes = jetons_inemployes(declares, comptes)
    lignes.append("Sens 2 · ce qui est déclaré, quelqu'un l'emploie-t-il ?")
    lignes.append("-" * 58)
    lignes.append("  Ce sens ne refuse rien : il rend un compte. Un jeton inemployé est")
    lignes.append("  soit une pièce pas encore dessinée, soit un jeton mort, et seul un")
    lignes.append("  humain sait lequel.")
    lignes.append("")
    if inemployes:
        lignes.append(f"  {len(inemployes)} jetons déclarés que rien n'emploie :")
        for nom in inemployes:
            lignes.append(f"    · {nom}")
    else:
        lignes.append("  Tous les jetons déclarés servent quelque part.")
    lignes.append("")

    lignes.append("Verdict")
    lignes.append("-------")
    if fautes:
        lignes.append(
            f"  {len(fautes)} manquement(s). Le code écrit ce que la liste ne dit pas."
        )
    else:
        lignes.append(
            "  Rien à refuser. Le code n'écrit que ce que la liste déclare, et tout"
        )
        lignes.append("  interface/src tient dans les listes fermées, sauf la géométrie d'avant.")
    lignes.append(
        f"  {len(inemployes)} jeton(s) déclaré(s) et inemployé(s) — à lire, pas à corriger."
    )

    # Windows : la console est en cp1252, et le journal porte des accents.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(lignes))
    return 1 if fautes else 0


if __name__ == "__main__":
    raise SystemExit(main())
