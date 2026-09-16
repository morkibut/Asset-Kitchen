# -*- coding: utf-8 -*-
"""Le garde-fou des mots de l'ossature — **il lit le document, il ne le recopie pas.**

`docs/vocabulaire.html` fait foi sur les mots. Depuis `RP3` il porte en plus une
**liste fermée** : les huit portes du carnet, les six onglets de la fiche d'un
sujet, le titre de chaque écran, et la forme d'un retour en arrière. Fermée veut
dire la même chose que dans `docs/DESIGN.md` — rien d'autre ne s'écrit.

Ce banc pose la question dans ce sens-là, et pas dans l'autre : **le document
donne les mots, le code est mesuré contre eux.** Aucun nom n'est écrit ici ; si
un mot change dans `docs/vocabulaire.html`, ce fichier n'a pas à bouger. Ce
qu'il tient, lui, c'est **où** chaque nom vit dans `interface/src` — quel
tableau, quel enregistrement, quel titre —, parce que ça, un document de
conception n'a pas à le savoir.

Il tient deux choses, et une seule des deux refuse :

**1 — Les libellés d'ossature sont ceux de la liste fermée, en nombre et en
ordre.** Un libellé qui dérive ne lève aucune erreur : l'écran s'affiche, l'essai
d'écran passe, et l'auteur cherche le mot de la maquette sans le trouver. Le
relevé du 13 septembre 2026 en a compté quatre-vingts.

**2 — Aucun mot de la liste noire ne paraît dans un libellé d'ossature.** ⚠️ Et
**seulement** dans un libellé : *dossier*, *chose*, *appel* sont des mots
français ordinaires, et les chasser d'un commentaire ou d'une phrase
d'explication ferait un banc qui crie tout le temps. Les commentaires sont donc
retirés avant toute mesure, et rien n'est lu en dehors des quatre registres
ci-dessus.

**Chaque écart se nomme entièrement** — fichier, ligne, mot trouvé, mot attendu
—, parce que c'est cette liste-là qu'on applique écran par écran ensuite. Un
banc qui dirait « trois écarts » ferait refaire le relevé à la main.

Il ne coûte rien : ni clé, ni réseau, ni atelier lancé, ni navigateur.

    Lancer :  py essais/essai_vocabulaire.py
"""

from __future__ import annotations

import re
import sys
from html import unescape
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOC = RACINE / "docs" / "vocabulaire.html"
SRC = RACINE / "interface" / "src"


# ── Ce que le document donne ────────────────────────────────────────────────


def blocs_du_document(html: str) -> dict[str, str]:
    """Les morceaux marqués `data-liste="…"`, chacun jusqu'au marqueur suivant.

    Le découpage se fait sur le marqueur lui-même plutôt que sur la balise qui
    le porte : un tableau, un paragraphe et une carte ne se ferment pas de la
    même façon, et un motif qui essaierait de suivre l'imbrication se casserait
    à la première mise en page changée. Les attributs `data-mot` et
    `data-interdit` n'existent que dans ces morceaux-là.
    """
    morceaux = re.split(r'data-liste="([a-z-]+)"', html)
    return {morceaux[i]: morceaux[i + 1] for i in range(1, len(morceaux) - 1, 2)}


def mots(bloc: str) -> list[str]:
    return [unescape(m) for m in re.findall(r'data-mot="([^"]+)"', bloc)]


def interdits(bloc: str) -> list[str]:
    return [unescape(m) for m in re.findall(r'data-interdit="([^"]+)"', bloc)]


def liste_noire(html: str) -> list[str]:
    """Les mots qu'on n'écrit pas, un par un.

    Le document les écrit groupés — « item · entity », « appel · requête » —,
    parce qu'ils se remplacent par le même mot. Ici on les sépare : un libellé
    ne contient qu'un mot à la fois."""
    trouves: list[str] = []
    for groupe in re.findall(r'<div class="no"><b>([^<]+)</b>', html):
        for mot in unescape(groupe).split("·"):
            mot = mot.strip()
            if mot:
                trouves.append(mot)
    return trouves


# ── Où chaque nom vit dans le code ──────────────────────────────────────────
#
# **C'est la seule chose que ce fichier sait et que le document ignore.** Un
# document de conception qui porterait des chemins de fichiers vieillirait à
# chaque renommage ; un banc qui porterait des mots ferait deux vérités.

CARNET = "interface/src/composants/NavigationAtelier.tsx"
FICHE = "interface/src/composants/PageDuSujet.tsx"
FIL = "interface/src/lieux-noms.ts"
GUIDE = "interface/src/composants/Guide.tsx"

# Le fil d'Ariane : le genre de lieu, et le rang de la porte dont il porte le
# titre. Les genres qui ne sont pas une porte — une image ouverte, un emploi,
# un montage — ne sont pas de l'ossature et ne sont pas mesurés ici.
FIL_DARIANE = {"bibliotheque": 3, "fabrications": 5, "sortie": 6, "regles": 7}

# Le guide nomme l'écran ouvert dans l'en-tête de son volet. Mêmes règles : on
# ne mesure que les clés qui désignent l'écran d'une porte.
NOM_DANS_LE_GUIDE = {
    "tableau-de-bord": 1,
    "inspiration": 2,
    "codex": 3,
    "galerie": 4,
    "sortie": 6,
    "jeu": 7,
}

# Le titre écrit par l'écran lui-même, quand c'est un texte et non une
# expression. Les écrans dont le `<h1>` se calcule — le tableau de bord, les
# règles, l'installation — ne sont pas mesurés ici : leur titre est ailleurs,
# et le fil et le guide le tiennent déjà.
TITRE_A_L_ECRAN = {
    # La porte « Les sujets » et la grille d'une famille sont le même écran
    # depuis `RP7` : `BibliothequeDesAssets.tsx` est parti le 16 septembre 2026.
    "interface/src/composants/Famille.tsx": 3,
    "interface/src/composants/GalerieMedias.tsx": 4,
    "interface/src/composants/Fabrications.tsx": 5,
    "interface/src/composants/Livraisons.tsx": 6,
    "interface/src/composants/Sortie.tsx": 6,
    "interface/src/composants/Guide.tsx": 8,
}

# Les écrans de l'ossature, et ceux qui pendent directement sous eux : c'est là
# que se lisent les retours en arrière. Un retour vers l'intérieur d'un écran —
# une frame, un calque, une étape — n'est pas un retour d'ossature.
ECRANS_DE_L_OSSATURE = (
    CARNET,
    FICHE,
    GUIDE,
    "interface/src/composants/TableauDeBord.tsx",
    "interface/src/composants/Univers.tsx",
    "interface/src/composants/Famille.tsx",
    "interface/src/composants/GalerieMedias.tsx",
    "interface/src/composants/Fabrications.tsx",
    "interface/src/composants/Livraisons.tsx",
    "interface/src/composants/Sortie.tsx",
    "interface/src/composants/Comparer.tsx",
    "interface/src/composants/GrilleDuJeu.tsx",
)


# ── Lire du code sans lire ses commentaires ─────────────────────────────────

BLOC_DE_COMMENTAIRE = re.compile(r"/\*.*?\*/", re.S)
# `//` qui ouvre un commentaire, et pas celui de `https://`.
FIN_DE_LIGNE = re.compile(r"(?<!:)//[^\n]*")


def sans_commentaires(texte: str) -> str:
    """Le même texte, ligne pour ligne, commentaires blanchis.

    **Les lignes ne bougent pas** : un commentaire devient des espaces, jamais
    rien. Sans ça, chaque écart serait nommé à la mauvaise ligne, et le relevé
    qu'on en tire enverrait l'agent suivant au mauvais endroit.
    """

    def blanchir(trouve: re.Match[str]) -> str:
        return re.sub(r"[^\n]", " ", trouve.group(0))

    return FIN_DE_LIGNE.sub(blanchir, BLOC_DE_COMMENTAIRE.sub(blanchir, texte))


def ligne_de(texte: str, position: int) -> int:
    return texte.count("\n", 0, position) + 1


def lire(relatif: str) -> tuple[str, str] | None:
    chemin = RACINE / relatif
    if not chemin.exists():
        return None
    texte = chemin.read_text(encoding="utf-8")
    return texte, sans_commentaires(texte)


# ── Les quatre registres ────────────────────────────────────────────────────


def suite_nommee(propre: str, nom_du_tableau: str) -> list[tuple[str, int]]:
    """Les `nom: "…"` d'un tableau déclaré, dans l'ordre, avec leur ligne.

    ⚠️ **Le crochet du type n'est pas celui du tableau.** `const PORTES: {…}[] =
    [` en porte deux paires, et s'arrêter au premier `]` venu rend une liste
    vide — un banc qui annonce alors « zéro porte » envoie chercher un défaut
    qui n'existe pas. On part donc du `= [`, et on compte les crochets.
    """
    depart = re.search(rf"const\s+{nom_du_tableau}\b[^=]*=\s*\[", propre)
    if depart is None:
        return []
    profondeur, fin = 1, depart.end()
    while fin < len(propre) and profondeur:
        profondeur += {"[": 1, "]": -1}.get(propre[fin], 0)
        fin += 1
    tranche = propre[depart.end() : fin]
    return [
        (trouve.group(1), ligne_de(propre, depart.end() + trouve.start()))
        for trouve in re.finditer(r'nom:\s*"((?:[^"\\]|\\.)*)"', tranche)
    ]


def portes_du_carnet(propre: str) -> list[tuple[str, int]]:
    """Les huit portes : les six du tableau, puis les deux de « Préférences ».

    Les deux dernières ne sont pas dans le tableau — elles n'ouvrent pas un
    lieu de la même façon —, et elles se lisent sur leur `aria-label`, qui est
    ce qu'un lecteur d'écran annonce et donc un libellé à part entière."""
    trouvees = suite_nommee(propre, "PORTES")
    debut = propre.find('aria-label="Préférences"')
    if debut >= 0:
        fin = propre.find("</nav>", debut)
        tranche = propre[debut : fin if fin > 0 else len(propre)]
        for trouve in re.finditer(r'aria-label="((?:[^"\\]|\\.)*)"', tranche):
            if trouve.group(1) != "Préférences":
                trouvees.append((trouve.group(1), ligne_de(propre, debut + trouve.start())))
    return trouvees


def titres_du_fil(propre: str) -> dict[str, tuple[str, int]]:
    lus: dict[str, tuple[str, int]] = {}
    for trouve in re.finditer(
        r'case\s+"([a-z0-9-]+)":\s*return\s+"((?:[^"\\]|\\.)*)"', propre
    ):
        lus[trouve.group(1)] = (trouve.group(2), ligne_de(propre, trouve.start()))
    return lus


def titres_du_guide(propre: str) -> dict[str, tuple[str, int]]:
    depart = re.search(r"const\s+NOM_DE_LECRAN\b", propre)
    if depart is None:
        return {}
    fin = propre.find("}", depart.end())
    tranche = propre[depart.end() : fin if fin > 0 else len(propre)]
    lus: dict[str, tuple[str, int]] = {}
    for trouve in re.finditer(r'"?([a-z0-9-]+)"?\s*:\s*"((?:[^"\\]|\\.)*)"', tranche):
        lus[trouve.group(1)] = (
            trouve.group(2),
            ligne_de(propre, depart.end() + trouve.start()),
        )
    return lus


TITRE_H1 = re.compile(r"<h1[^>]*>([^<>{}]*?)</h1>")


def titre_a_l_ecran(propre: str) -> tuple[str, int] | None:
    trouve = TITRE_H1.search(propre)
    if trouve is None:
        return None
    return " ".join(trouve.group(1).split()), ligne_de(propre, trouve.start())


# Un retour en arrière, tel qu'il s'écrit dans le JSX : le chevron, ou un des
# deux verbes. On ne cherche pas « Fermer » — une fenêtre se ferme, et la
# chasser ferait crier le banc sur chaque dialogue.
RETOUR = re.compile(
    r"(‹\s*[^\"'<>{}\n]{0,60}|(?:Retour|Revenir)\s+(?:à|au|aux)[^\"'<>{}\n]{0,60})"
)


def retours(propre: str) -> list[tuple[str, int]]:
    trouves: list[tuple[str, int]] = []
    for trouve in RETOUR.finditer(propre):
        libelle = " ".join(trouve.group(1).split())
        # `‹ {retour}` — le nom se calcule, et la forme est justement celle
        # qu'on demande. Rien à mesurer.
        if libelle in {"‹", "‹ ‹"} or propre[trouve.end() : trouve.end() + 1] == "{":
            continue
        trouves.append((libelle, ligne_de(propre, trouve.start())))
    return trouves


# ── Le journal ──────────────────────────────────────────────────────────────


def ecart(ou: str, trouve: str, attendu: str) -> str:
    return f"{ou} — « {trouve} » ; attendu : « {attendu} »"


def lieu_de(faute: str) -> str:
    """Le fichier et la ligne d'un écart, sans le registre.

    **Un endroit ne se nomme qu'une fois.** Un même libellé enfreint souvent
    deux règles à la fois — *Les assets* n'est pas le mot de la liste fermée
    *et* porte un mot de la liste noire. Le relire trois fois ferait croire à
    trois corrections, et l'agent qui applique la liste en chercherait trois.
    """
    return faute.split(" — ")[0].split(" · ")[0]


def main() -> int:
    if not DOC.exists():
        print("docs/vocabulaire.html est introuvable")
        return 1

    html = DOC.read_text(encoding="utf-8")
    blocs = blocs_du_document(html)
    manquants = [n for n in ("portes", "onglets", "titres", "retours-interdits") if n not in blocs]
    if manquants:
        print(
            "docs/vocabulaire.html ne porte plus la liste fermée de l'ossature :"
            f" {', '.join(manquants)} introuvable(s)."
        )
        return 1

    PORTES = mots(blocs["portes"])
    ONGLETS = mots(blocs["onglets"])
    TITRES = mots(blocs["titres"])
    TITRES_INTERDITS = interdits(blocs.get("titres-interdits", ""))
    RETOURS_INTERDITS = interdits(blocs["retours-interdits"])
    NOIRE = liste_noire(html)

    fautes: list[str] = []
    libelles: list[tuple[str, str]] = []  # (où, libellé) — pour la liste noire

    lignes: list[str] = []
    lignes.append("Les mots de l'ossature, contre la liste fermée")
    lignes.append("=" * 46)
    lignes.append("")
    lignes.append(
        f"  Lu dans docs/vocabulaire.html : {len(PORTES)} portes, {len(ONGLETS)} onglets,"
        f" {len(TITRES)} titres,"
    )
    lignes.append(
        f"  {len(RETOURS_INTERDITS)} formes de retour refusées, {len(NOIRE)} mots sur la"
        " liste noire."
    )
    lignes.append("")

    # ── Le document se tient-il lui-même ? ───────────────────────────────────
    if TITRES != PORTES:
        fautes.append(
            "docs/vocabulaire.html — la liste des titres ne dit pas la même chose que"
            " celle des portes ; la règle est que le titre d'un écran est le mot de sa"
            " porte, à la lettre"
        )

    # ── 1 · Les portes du carnet ─────────────────────────────────────────────
    lignes.append("1 · Les portes du carnet")
    lignes.append("-" * 46)
    lu = lire(CARNET)
    if lu is None:
        fautes.append(f"{CARNET} — introuvable : le carnet a changé de fichier")
        lignes.append(f"  {CARNET} introuvable.")
    else:
        brut, propre = lu
        trouvees = portes_du_carnet(propre)
        libelles += [(f"{CARNET}:{no}", nom) for nom, no in trouvees]
        if len(trouvees) != len(PORTES):
            fautes.append(
                f"{CARNET} — {len(trouvees)} portes ; la liste fermée en compte"
                f" {len(PORTES)}"
            )
        for rang, attendu in enumerate(PORTES):
            if rang >= len(trouvees):
                fautes.append(f"{CARNET} — porte {rang + 1} absente ; attendu : « {attendu} »")
                continue
            nom, no = trouvees[rang]
            if nom != attendu:
                fautes.append(ecart(f"{CARNET}:{no} · porte {rang + 1}", nom, attendu))
        lignes.append(
            "  " + " · ".join(nom for nom, _ in trouvees) if trouvees else "  aucune porte lue"
        )
    lignes.append("")

    # ── 2 · Les onglets de la fiche d'un sujet ───────────────────────────────
    lignes.append("2 · Les onglets de la fiche d'un sujet")
    lignes.append("-" * 46)
    lu = lire(FICHE)
    if lu is None:
        fautes.append(f"{FICHE} — introuvable : la fiche a changé de fichier")
        lignes.append(f"  {FICHE} introuvable.")
    else:
        brut, propre = lu
        trouves = suite_nommee(propre, "ONGLETS")
        libelles += [(f"{FICHE}:{no}", nom) for nom, no in trouves]
        if len(trouves) != len(ONGLETS):
            fautes.append(
                f"{FICHE} — {len(trouves)} onglets ; la liste fermée en compte"
                f" {len(ONGLETS)}"
            )
        for rang, attendu in enumerate(ONGLETS):
            if rang >= len(trouves):
                fautes.append(f"{FICHE} — onglet {rang + 1} absent ; attendu : « {attendu} »")
                continue
            nom, no = trouves[rang]
            if nom != attendu:
                fautes.append(ecart(f"{FICHE}:{no} · onglet {rang + 1}", nom, attendu))
        lignes.append(
            "  " + " · ".join(nom for nom, _ in trouves) if trouves else "  aucun onglet lu"
        )
    lignes.append("")

    # ── 3 · Le titre de chaque écran, dans ses trois registres ───────────────
    lignes.append("3 · Le titre de chaque écran — l'écran, le fil, le guide")
    lignes.append("-" * 46)

    lu = lire(FIL)
    if lu is None:
        fautes.append(f"{FIL} — introuvable")
    else:
        _, propre = lu
        pour_le_fil = titres_du_fil(propre)
        for genre, rang in FIL_DARIANE.items():
            attendu = TITRES[rang - 1]
            if genre not in pour_le_fil:
                fautes.append(
                    f"{FIL} — le fil ne nomme plus « {genre} » ; attendu : « {attendu} »"
                )
                continue
            nom, no = pour_le_fil[genre]
            libelles.append((f"{FIL}:{no}", nom))
            if nom != attendu:
                fautes.append(ecart(f"{FIL}:{no} · fil d'Ariane", nom, attendu))

    lu = lire(GUIDE)
    if lu is None:
        fautes.append(f"{GUIDE} — introuvable")
    else:
        _, propre = lu
        pour_le_guide = titres_du_guide(propre)
        for clef, rang in NOM_DANS_LE_GUIDE.items():
            attendu = TITRES[rang - 1]
            if clef not in pour_le_guide:
                fautes.append(
                    f"{GUIDE} — le guide ne nomme plus « {clef} » ; attendu :"
                    f" « {attendu} »"
                )
                continue
            nom, no = pour_le_guide[clef]
            libelles.append((f"{GUIDE}:{no}", nom))
            if nom != attendu:
                fautes.append(ecart(f"{GUIDE}:{no} · nom dans le guide", nom, attendu))

    for relatif, rang in TITRE_A_L_ECRAN.items():
        attendu = TITRES[rang - 1]
        lu = lire(relatif)
        if lu is None:
            fautes.append(f"{relatif} — introuvable")
            continue
        _, propre = lu
        trouve = titre_a_l_ecran(propre)
        if trouve is None:
            fautes.append(
                f"{relatif} — aucun titre lisible ; attendu : « {attendu} » en toutes"
                " lettres"
            )
            continue
        nom, no = trouve
        libelles.append((f"{relatif}:{no}", nom))
        if nom != attendu:
            fautes.append(ecart(f"{relatif}:{no} · titre de l'écran", nom, attendu))

    # Les titres qu'on n'écrit plus, où qu'ils traînent dans ces trois registres.
    dejas = {lieu_de(faute) for faute in fautes}
    for ou, libelle in libelles:
        if libelle in TITRES_INTERDITS and ou not in dejas:
            fautes.append(
                f"{ou} — « {libelle} » ne s'écrit plus comme titre (liste fermée,"
                " docs/vocabulaire.html)"
            )
    lignes.append(f"  {len(FIL_DARIANE)} entrées du fil, {len(NOM_DANS_LE_GUIDE)} du guide,"
                  f" {len(TITRE_A_L_ECRAN)} titres écrits en toutes lettres.")
    lignes.append("")

    # ── 4 · Le mot d'un retour en arrière ────────────────────────────────────
    lignes.append("4 · Le mot d'un retour en arrière")
    lignes.append("-" * 46)
    comptes = 0
    for relatif in ECRANS_DE_L_OSSATURE:
        lu = lire(relatif)
        if lu is None:
            continue
        _, propre = lu
        for libelle, no in retours(propre):
            comptes += 1
            refuse = next(
                (i for i in RETOURS_INTERDITS if libelle == i or libelle.startswith(i + " ")),
                None,
            )
            if refuse is None and libelle in RETOURS_INTERDITS:
                refuse = libelle
            if refuse is not None:
                fautes.append(
                    f"{relatif}:{no} · retour — « {libelle} » ; attendu : « ‹ » suivi du"
                    " nom de l'endroit où l'on revient, écrit là-bas tel quel"
                )
    lignes.append(f"  {comptes} retours lus dans {len(ECRANS_DE_L_OSSATURE)} écrans d'ossature.")
    lignes.append("")

    # ── 5 · La liste noire dans les libellés d'ossature ──────────────────────
    lignes.append("5 · La liste noire, dans les libellés d'ossature seulement")
    lignes.append("-" * 46)
    dejas = {lieu_de(faute) for faute in fautes}
    noirs, deja_nommes = 0, 0
    for ou, libelle in libelles:
        for mot in NOIRE:
            if re.search(rf"\b{re.escape(mot)}s?\b", libelle, re.I):
                noirs += 1
                if ou in dejas:
                    deja_nommes += 1
                    continue
                fautes.append(
                    f"{ou} — « {libelle} » porte « {mot} », qui est sur la liste noire de"
                    " docs/vocabulaire.html"
                )
    if noirs:
        lignes.append(
            f"  {len(libelles)} libellés d'ossature lus ; {noirs} portent un mot de la"
            f" liste noire, dont {deja_nommes} déjà nommé(s) plus haut."
        )
    else:
        lignes.append(
            f"  {len(libelles)} libellés d'ossature lus, aucun mot de la liste noire."
        )
    lignes.append("")

    # ── Le relevé ────────────────────────────────────────────────────────────
    lignes.append("Les écarts, un par un")
    lignes.append("-" * 46)
    if fautes:
        lignes.append("")
        for faute in fautes:
            lignes.append(f"  ÉCART  {faute}")
        lignes.append("")
    else:
        lignes.append("  Aucun.")
        lignes.append("")

    lignes.append("Verdict")
    lignes.append("-------")
    if fautes:
        lignes.append(f"  {len(fautes)} écart(s) d'ossature. Le code n'écrit pas les mots de")
        lignes.append("  la liste fermée de docs/vocabulaire.html.")
    else:
        lignes.append("  L'ossature écrit les mots de la liste fermée, en nombre et en ordre,")
        lignes.append("  et aucun mot de la liste noire n'y paraît.")

    # Windows : la console est en cp1252, et le journal porte des accents.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(lignes))
    return 1 if fautes else 0


if __name__ == "__main__":
    raise SystemExit(main())
