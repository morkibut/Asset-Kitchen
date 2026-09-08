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

**Et les tailles, dans les fichiers neufs seulement.** `docs/DESIGN.md` ferme
cinq listes — les écarts, les hauteurs, les largeurs, les tailles de texte, les
arrondis — et une sixième, les durées. Les quarante écrans d'avant les
enfreignent tous, et les rouvrir un par un est le travail des tranches de la V4,
pas d'un banc. Le garde-fou ne tient donc que `LES_FICHIERS_DU_CARNET`, et
**cette liste grandit d'une tranche à l'autre** : c'est elle qui mesure
l'avancement de la refonte.

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

# **Les fichiers du carnet — ceux que la V4 a déjà écrits.** Un fichier entre
# ici le jour où sa tranche le livre, et il n'en sort jamais. Les autres écrans
# tournent encore sur l'ancien châssis : les mesurer aux listes du carnet
# rendrait quarante refus qu'on ne saurait pas traiter, et un garde-fou qu'on
# désactive n'en est plus un.
LES_FICHIERS_DU_CARNET = (
    "interface/src/lieux.ts",
    "interface/src/composants/Carnet.tsx",
    "interface/src/composants/TableauDeBord.tsx",
    "interface/src/composants/Ouverture.tsx",
    "interface/src/composants/Barre.tsx",
    "interface/src/composants/Guide.tsx",
    "interface/src/composants/Famille.tsx",
    "interface/src/composants/ReglagesDeFamille.tsx",
    "interface/src/composants/PageDuSujet.tsx",
    "interface/src/composants/ImagesDuSujet.tsx",
    "interface/src/composants/AnimationsDuSujet.tsx",
    "interface/src/composants/ReglesDuJeu.tsx",
    "interface/src/composants/Installation.tsx",
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
LARGEURS = {300, 380, 880}
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
TAILLES = HAUTEURS | LARGEURS | ECARTS

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
        f"  {len(LES_FICHIERS_DU_CARNET)} fichiers du carnet tenus aux listes fermées."
    )
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

    for relatif in LES_FICHIERS_DU_CARNET:
        chemin = RACINE / relatif
        if not chemin.exists():
            fautes.append(f"{relatif} — le fichier n'existe pas")
            continue
        fautes.extend(hors_des_listes(relatif, chemin.read_text(encoding="utf-8")))

    hors = [f for f in fautes if f not in jetons_non_declares(declares, comptes, ou)]
    lignes.append("Sens 1 bis · les listes fermées, dans les fichiers du carnet")
    lignes.append("-" * 58)
    if hors:
        lignes.append("")
        for faute in hors:
            lignes.append(f"  HORS LISTE  {faute}")
    else:
        lignes.append(
            "  Aucune couleur en clair, aucune taille, aucun arrondi, aucune durée"
        )
        lignes.append("  hors des listes de docs/DESIGN.md.")
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
            "  Rien à refuser. Le code n'écrit que ce que la liste déclare, et les"
        )
        lignes.append("  fichiers du carnet tiennent dans les listes fermées.")
    lignes.append(
        f"  {len(inemployes)} jeton(s) déclaré(s) et inemployé(s) — à lire, pas à corriger."
    )

    # Windows : la console est en cp1252, et le journal porte des accents.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(lignes))
    return 1 if fautes else 0


if __name__ == "__main__":
    raise SystemExit(main())
