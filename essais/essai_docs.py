# -*- coding: utf-8 -*-
"""Le banc du corpus de démarrage — ce qu'une session avale avant d'avoir rien lu.

`AGENTS.md` pose deux règles sur les documents. La première tient toute
seule — *« cinq documents se lisent au démarrage, et cinq seulement »*. La
seconde ne tenait pas : *« dès qu'une section pèse plus que le document qui la
porte, elle sort en annexe »* n'a jamais déclenché, parce qu'aucune section
n'atteint jamais la moitié de son document — et le corpus a triplé deux fois
quand même, jusqu'à 315 Ko.

Un garde-fou qu'on ne mesure pas n'en est pas un. Ce banc le mesure — **et il ne
refuse rien sur le poids**. Un plafond rond refuserait le jour où l'on écrit une
phrase de plus, ce qui n'est pas une faute, et se relèverait le jour où il gêne,
ce qui n'est pas un garde-fou. Ce qui se surveille est la **dérive** : le corpus
a triplé deux fois sans que personne ne le décide, et c'est exactement ce que
personne ne voyait. Chaque relevé est donc comparé au précédent, et le plus haut
connu reste écrit pour que l'échelle ne se perde pas.

Ce qui **fait échouer** ce banc est ailleurs : un renvoi cassé. Le code et les
documents renvoient aux documents six cents fois, et un renvoi qui pointe une
section déplacée ne lève aucune erreur — il ment en silence, exactement comme la
doc et le schéma qui ne se recouvraient plus chez SpriteCook.

Il ne coûte rien : ni clé, ni réseau, ni atelier lancé. Il répond à trois
questions, dans cet ordre :

1. **Combien pèse le corpus de démarrage, et où est le poids ?** Section par
   section, pour que ce qui sort en annexe soit décidé sur des octets et non
   sur une impression.
2. **Les renvois du code vers `docs/` tombent-ils encore juste ?** L'ancre de
   chaque renvoi — un « § », un numéro, une tranche, une user story — est
   résolue contre les titres réels du document visé, intertitres gras compris.
3. **Et les renvois d'un document à l'autre ?** Ce sont eux qui se cassent
   pendant un découpage, parce que la section citée part dans un autre fichier.
   Un renvoi sur six s'écrit sans son chemin — `` `PLAN.md` `` tout court — et
   ceux-là échappaient au banc jusqu'à ce qu'un découpage en casse huit d'un
   coup sans qu'il le dise.

    Lancer :  py essais/essai_docs.py

Sortie : ce journal, et `essais/mesures_docs.json` pour la comparaison suivante.
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = Path(__file__).resolve().parent / "mesures_docs.json"

# Les cinq documents de démarrage, dans l'ordre où `AGENTS.md` les nomme. Cette
# liste est confrontée à la phrase d'AGENTS.md plus bas : deux endroits qui se
# contredisent sont exactement ce que ce banc existe pour trouver.
DEMARRAGE = (
    "AGENTS.md",
    "docs/PRD.md",
    "docs/ARCHITECTURE.md",
    "docs/PLAN.md",
    "docs/DESIGN.md",
)

KO = 1024

# **Pas de plafond.** Un seuil rond refuserait le jour où l'on écrit une phrase
# de plus, ce qui n'est pas une faute, et se relèverait le jour où il gêne, ce
# qui n'est pas un garde-fou. Ce qui se surveille est la **dérive** : le corpus
# a triplé deux fois sans que personne ne le décide, et c'est ça qu'on n'avait
# pas vu. Chaque relevé est donc comparé au précédent, et le plus haut connu
# reste écrit ici pour que l'échelle ne se perde pas.
REPERE = ("le 29 août 2026, avant compactage", 322_899)

# Où le code vit. On ne scanne ni `interface/node_modules`, ni `.venv`, ni
# `docs/` lui-même : les renvois entre documents sont comptés à part.
CODE = ("atelier", "interface/src", "tests", "essais")
SUFFIXES_CODE = {".py", ".ts", ".tsx", ".css"}

# Un renvoi s'écrit de deux façons dans ce dépôt : avec son chemin, ou par son
# seul nom entre accents graves quand le contexte le rend évident. La seconde
# est majoritairement le fait des documents entre eux, et il y en a soixante :
# ne lire que la première laisserait un renvoi sur six hors du banc.
RENVOI = re.compile(
    r"docs/[A-Za-z0-9_./-]+\.(?:md|html)"
    r"|(?<=`)[A-Za-z0-9_-]+\.(?:md|html)(?=`)"
)
TITRE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
# Un intertitre gras — « **Ce qui entre par la main.** Le collage devine… ».
# Les documents s'en servent comme d'un niveau de plus, et un renvoi les vise
# au même titre qu'un `##` : ils comptent donc comme ancres.
INTERTITRE = re.compile(r"^\*\*([^*]{4,90}?)\.?\*\*")
# « ## 4 bis · Fournisseur », « ### 6.1 Contenu », « ## 11 · Risques »
NUMERO = re.compile(r"^(\d+(?:\.\d+)?(?:\s+bis)?)\s*(?:·|—|-|\s)\s*(.*)$")
# « ### T1 · La première image », « ## C3 · La pièce et le calque »
TRANCHE = re.compile(r"^([TCR]\d+)\b")


# ---------------------------------------------------------------- normalisation


def sans_accent(texte: str) -> str:
    decompose = unicodedata.normalize("NFD", texte)
    return "".join(c for c in decompose if unicodedata.category(c) != "Mn")


def mots(texte: str) -> list[str]:
    """Les mots d'un titre ou d'un renvoi, comparables entre eux.

    Sans accents, sans casse, sans la ponctuation ni le balisage qui décorent
    un titre Markdown — `**`, backticks, `·`. Ce qui reste se compare mot à
    mot, et c'est la seule façon de faire correspondre « §&nbsp;Squelette » à
    « ### Squelette du dépôt » sans écrire une liste d'exceptions."""
    propre = sans_accent(texte.lower())
    propre = re.sub(r"[`*_«»\"'’]", " ", propre)
    propre = re.sub(r"[^a-z0-9]+", " ", propre)
    return propre.split()


def prefixe(court: list[str], long: list[str]) -> bool:
    return bool(court) and len(court) <= len(long) and long[: len(court)] == court


# ------------------------------------------------------------------- documents


class Section:
    """Un titre, ce qu'il porte **avec ses sous-sections**, et ce que ça pèse.

    Le poids court jusqu'au titre suivant *de même niveau ou plus haut* : une
    section qu'on sortirait en annexe emporte ses sous-titres avec elle, donc
    c'est ce poids-là qui décide, et pas celui du seul chapeau."""

    def __init__(self, niveau: int, titre: str, ligne: int):
        self.niveau = niveau
        self.titre = titre
        self.ligne = ligne
        self.octets = 0
        self.numero = ""
        self.tranche = ""
        self.mots = mots(titre)

        if (trouve := NUMERO.match(titre)) is not None:
            self.numero = re.sub(r"\s+", " ", trouve.group(1))
            self.mots = mots(trouve.group(2))
        elif (trouve := TRANCHE.match(titre)) is not None:
            self.tranche = trouve.group(1)
            reste = titre[trouve.end():].lstrip(" ·—-")
            self.mots = mots(reste)


class Document:
    def __init__(self, chemin: Path, relatif: str):
        self.chemin = chemin
        self.relatif = relatif
        self.existe = chemin.exists()
        self.octets = chemin.stat().st_size if self.existe else 0
        self.sections: list[Section] = []
        self.intertitres: list[Section] = []
        self.texte = ""
        if not self.existe:
            return

        self.texte = chemin.read_text(encoding="utf-8")
        lignes = self.texte.splitlines(keepends=True)
        poids = [len(ligne.encode("utf-8")) for ligne in lignes]
        for numero, ligne in enumerate(lignes, start=1):
            if (trouve := TITRE.match(ligne.rstrip("\n"))) is not None:
                self.sections.append(
                    Section(len(trouve.group(1)), trouve.group(2), numero)
                )
            elif (trouve := INTERTITRE.match(ligne)) is not None:
                self.intertitres.append(Section(9, trouve.group(1), numero))

        for rang, section in enumerate(self.sections):
            fin = len(lignes)
            for suivante in self.sections[rang + 1:]:
                if suivante.niveau <= section.niveau:
                    fin = suivante.ligne - 1
                    break
            section.octets = sum(poids[section.ligne - 1: fin])

    def de_haut_niveau(self) -> list[Section]:
        """Les sections de niveau 2 — celles qui sortent en annexe, ou pas."""
        return [s for s in self.sections if s.niveau == 2]


def charger(chemins: list[str]) -> dict[str, Document]:
    return {c: Document(RACINE / c, c) for c in chemins}


def cibles_connues() -> list[str]:
    """Tout ce que `docs/` contient, plus `AGENTS.md` — l'ensemble des cibles
    possibles d'un renvoi."""
    trouves = ["AGENTS.md"]
    for chemin in sorted((RACINE / "docs").rglob("*")):
        if chemin.suffix in {".md", ".html"} and chemin.is_file():
            trouves.append(chemin.relative_to(RACINE).as_posix())
    return trouves


# --------------------------------------------------------------------- renvois


class Renvoi:
    """Un renvoi trouvé dans un fichier : sa cible, son ancre, et son verdict."""

    def __init__(self, source: str, ligne: int, cible: str, suite: str, brut: str = ""):
        self.source = source
        self.ligne = ligne
        self.cible = cible
        self.brut = brut or cible
        self.genre = "fichier"
        self.ancre = ""
        self.resolu = False
        self.vers = ""
        self.raison = ""
        self._lire_ancre(suite)

    def _lire_ancre(self, suite: str) -> None:
        """Ce qui suit le chemin, jusqu'à l'ancre s'il y en a une.

        Le texte est recollé d'abord : un renvoi se replie sur la ligne
        suivante, préfixée par le marqueur de commentaire du langage. Sans ce
        recollage, un « § Le » suivi d'un retour à la ligne et de « pliage »
        serait lu « § Le », et le banc verrait un renvoi cassé qui ne l'est
        pas."""
        plat = re.sub(r"\n\s*(?:#|//|\*|)\s*", " ", suite)
        plat = re.sub(r"\s+", " ", plat).strip()
        plat = plat.lstrip("`")

        # « § Phase T1 » et « § C3 » nomment une tranche, pas une section : le
        # signe § ne dit que « quelque part dans ce document ».
        if (trouve := re.match(r"\s*§\s*(?:Phase\s+)?([TCR]\d+)\b", plat)) is not None:
            self.genre = "tranche"
            self.ancre = trouve.group(1)
        elif (trouve := re.match(r"\s*§\s*(.+)", plat)) is not None:
            self.genre = "section"
            self.ancre = trouve.group(1)[:120]
        elif (trouve := re.match(r"\s*[,;:(]?\s*\b([TCR]\d+)\b", plat)) is not None:
            self.genre = "tranche"
            self.ancre = trouve.group(1)
        elif (trouve := re.match(r"\s*[,;:(]?\s*\b(US-\d+)\b", plat)) is not None:
            self.genre = "story"
            self.ancre = trouve.group(1)


def coupe(ancre: str) -> list[str]:
    """Le nom de section le plus court que l'ancre puisse désigner.

    On tranche à la première ponctuation qui ferme une incise. « § Typography,
    règle 1 » vise « Typography » ; « § La tuile : `64×64` » vise « La
    tuile »."""
    court = re.split(r"[,;:)»\.]|\s—\s", ancre, maxsplit=1)[0]
    return mots(court)


def resoudre(renvoi: Renvoi, documents: dict[str, Document]) -> None:
    document = documents.get(renvoi.cible)
    if document is None or not document.existe:
        renvoi.raison = "le fichier n'existe pas"
        return

    if renvoi.genre == "fichier":
        renvoi.resolu = True
        renvoi.vers = renvoi.cible
        return

    if renvoi.genre == "story":
        if re.search(rf"\*\*{re.escape(renvoi.ancre)}\*\*", document.texte):
            renvoi.resolu = True
            renvoi.vers = renvoi.ancre
        else:
            renvoi.raison = f"{renvoi.ancre} n'est plus dans {renvoi.cible}"
        return

    if renvoi.genre == "tranche":
        for section in document.sections:
            if section.tranche == renvoi.ancre:
                renvoi.resolu = True
                renvoi.vers = section.titre
                return
        renvoi.raison = f"{renvoi.ancre} n'a plus de section dans {renvoi.cible}"
        return

    # Une section : soit un numéro (« §4 bis »), soit un nom (« § Le pliage »).
    if (trouve := re.match(r"(\d+(?:\.\d+)?(?:\s+bis)?)", renvoi.ancre)) is not None:
        vise = re.sub(r"\s+", " ", trouve.group(1))
        for section in document.sections:
            if section.numero == vise:
                renvoi.resolu = True
                renvoi.vers = section.titre
                return
        renvoi.raison = f"§{vise} n'existe pas dans {renvoi.cible}"
        return

    longs = mots(renvoi.ancre)
    courts = coupe(renvoi.ancre)
    meilleure: Section | None = None
    for section in document.sections + document.intertitres:
        if not section.mots:
            continue
        # Deux sens : le titre ouvre le renvoi (« § Motion veut la jauge… »),
        # ou le renvoi abrège le titre (« § Squelette » → « Squelette du dépôt »).
        touche = prefixe(section.mots, longs) or prefixe(courts, section.mots)
        if touche and (meilleure is None or len(section.mots) > len(meilleure.mots)):
            meilleure = section
    if meilleure is not None:
        renvoi.resolu = True
        renvoi.vers = meilleure.titre
    else:
        apercu = " ".join(courts) or renvoi.ancre[:40]
        renvoi.raison = f"aucun titre de {renvoi.cible} ne répond à « {apercu} »"


def fichiers_de_code() -> list[Path]:
    trouves = []
    for dossier in CODE:
        for chemin in sorted((RACINE / dossier).rglob("*")):
            if chemin.is_file() and chemin.suffix in SUFFIXES_CODE:
                if "__pycache__" in chemin.parts or "node_modules" in chemin.parts:
                    continue
                trouves.append(chemin)
    return trouves


def fichiers_de_docs() -> list[Path]:
    trouves = [RACINE / "AGENTS.md"]
    for chemin in sorted((RACINE / "docs").rglob("*.md")):
        trouves.append(chemin)
    return trouves


def relever(fichiers: list[Path], documents: dict[str, Document]) -> list[Renvoi]:
    # Un nom nu ne désigne un document que s'il n'y en a qu'un qui le porte.
    par_nom: dict[str, list[str]] = {}
    for nom in documents:
        par_nom.setdefault(nom.rsplit("/", 1)[-1], []).append(nom)

    releves = []
    for chemin in fichiers:
        relatif = chemin.relative_to(RACINE).as_posix()
        texte = chemin.read_text(encoding="utf-8")
        for trouve in RENVOI.finditer(texte):
            brut = trouve.group(0)
            cible = brut
            if "/" not in brut:
                homonymes = par_nom.get(brut, [])
                if len(homonymes) != 1:
                    continue  # un nom de fichier en prose, pas un renvoi
                cible = homonymes[0]
            if cible == relatif:  # un document qui renvoie à lui-même
                continue
            ligne = texte.count("\n", 0, trouve.start()) + 1
            renvoi = Renvoi(
                relatif, ligne, cible, texte[trouve.end(): trouve.end() + 160], brut
            )
            resoudre(renvoi, documents)
            releves.append(renvoi)
    return releves


# --------------------------------------------------------------------- journal


def titre(texte: str) -> None:
    print(f"\n{texte}\n{'-' * len(texte)}")


def ko(octets: int) -> str:
    return f"{octets / KO:6.1f} Ko"


def liste_de_demarrage() -> list[str]:
    """Ce qu'`AGENTS.md` déclare lire au démarrage — pour le confronter à
    `DEMARRAGE`. Deux endroits qui divergent, c'est la fragilité n°1."""
    texte = (RACINE / "AGENTS.md").read_text(encoding="utf-8")
    # La phrase se replie sur la ligne suivante : la borner à `\n` ne rendrait
    # qu'`AGENTS.md`, et le banc annoncerait une divergence qui n'existe pas.
    phrase = re.search(r"se lisent au démarrage.*?:(.*?)\.\s", texte, re.S)
    if phrase is None:
        return []
    return re.findall(r"`([A-Za-z0-9_./-]+\.md)`", phrase.group(1))


def releve_precedent() -> dict[str, int]:
    """Le poids de chaque document au relevé d'avant — pour la dérive."""
    if not SORTIE.exists():
        return {}
    ancien = json.loads(SORTIE.read_text(encoding="utf-8"))
    corpus = ancien.get("corpus", {})
    poids = {c: f["octets"] for c, f in corpus.get("documents", {}).items()}
    poids["= total"] = corpus.get("octets", 0)
    return poids


def ecart(maintenant: int, avant: int | None) -> str:
    """La dérive depuis le relevé précédent, quand elle vaut la peine d'être dite.

    Sous une centaine d'octets — une phrase corrigée, un mot ajouté — la ligne
    n'apprendrait rien et rendrait bruyant un tableau qu'on lit d'un coup d'œil."""
    if avant is None or abs(maintenant - avant) < 100:
        return ""
    signe = "+" if maintenant > avant else "−"
    return f"   {signe}{abs(maintenant - avant) / KO:.1f} Ko"


def peser(documents: dict[str, Document]) -> int:
    total = sum(documents[c].octets for c in DEMARRAGE)
    avant = releve_precedent()
    titre(f"Le corpus de démarrage — {ko(total)}")

    declare = liste_de_demarrage()
    if declare and sorted(declare) != sorted(DEMARRAGE):
        print(f"  ATTENTION — AGENTS.md déclare {declare}")
        print(f"              ce banc pèse      {list(DEMARRAGE)}")

    for chemin in DEMARRAGE:
        document = documents[chemin]
        part = 100 * document.octets / total if total else 0
        print(
            f"  {chemin:24} {ko(document.octets)}  {part:4.1f} %"
            f"   {len(document.sections):3} titres"
            f"{ecart(document.octets, avant.get(chemin))}"
        )
    print(f"  {'= total':24} {ko(total)}{'':17}{ecart(total, avant.get('= total'))}")

    nom, haut = REPERE
    print(f"  {'plus haut connu':24} {ko(haut)}   {nom}")
    if total > haut:
        print("  Le corpus est au-dessus de son plus haut connu.")
    return total


def ou_est_le_poids(documents: dict[str, Document]) -> None:
    titre("Où est le poids — les sections de niveau 2, par document")
    for chemin in DEMARRAGE:
        document = documents[chemin]
        hautes = document.de_haut_niveau()
        if not hautes:
            continue
        print(f"\n  {chemin}  ({ko(document.octets)})")
        for section in sorted(hautes, key=lambda s: -s.octets):
            part = 100 * section.octets / document.octets if document.octets else 0
            marque = "  ←" if part >= 15 else ""
            print(
                f"    {ko(section.octets)}  {part:4.1f} %  "
                f"l.{section.ligne:<5} {section.titre[:58]}{marque}"
            )


def rapporter(nom: str, releves: list[Renvoi]) -> list[Renvoi]:
    casses = [r for r in releves if not r.resolu]
    par_genre: dict[str, int] = {}
    for renvoi in releves:
        par_genre[renvoi.genre] = par_genre.get(renvoi.genre, 0) + 1

    titre(f"{nom} — {len(releves)} renvois, {len(casses)} cassés")
    detail = ", ".join(f"{g} {n}" for g, n in sorted(par_genre.items()))
    print(f"  formes : {detail}")

    par_cible: dict[str, int] = {}
    for renvoi in releves:
        par_cible[renvoi.cible] = par_cible.get(renvoi.cible, 0) + 1
    for cible, nombre in sorted(par_cible.items(), key=lambda p: -p[1]):
        print(f"  {nombre:4}  {cible}")

    if casses:
        print()
        for renvoi in casses:
            print(f"  CASSÉ  {renvoi.source}:{renvoi.ligne}")
            print(f"         {renvoi.brut} § {renvoi.ancre[:60]}")
            print(f"         → {renvoi.raison}")
    return casses


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    print("Banc du corpus de démarrage — aucun frais, aucun réseau, aucun atelier")

    documents = charger(cibles_connues())
    total = peser(documents)
    ou_est_le_poids(documents)

    depuis_code = relever(fichiers_de_code(), documents)
    casses_code = rapporter("Les renvois du code vers docs/", depuis_code)

    depuis_docs = relever(fichiers_de_docs(), documents)
    casses_docs = rapporter("Les renvois d'un document à l'autre", depuis_docs)

    SORTIE.write_text(
        json.dumps(
            {
                "releve_le": time.time(),
                "repere": {"quand": REPERE[0], "octets": REPERE[1]},
                "corpus": {
                    "octets": total,
                    "documents": {
                        c: {
                            "octets": documents[c].octets,
                            "titres": len(documents[c].sections),
                            "sections": [
                                {
                                    "titre": s.titre,
                                    "niveau": s.niveau,
                                    "ligne": s.ligne,
                                    "octets": s.octets,
                                }
                                for s in documents[c].sections
                            ],
                        }
                        for c in DEMARRAGE
                    },
                },
                "renvois": {
                    nom: {
                        "total": len(releves),
                        "casses": [
                            {
                                "source": r.source,
                                "ligne": r.ligne,
                                "cible": r.cible,
                                "ancre": r.ancre,
                                "raison": r.raison,
                            }
                            for r in releves
                            if not r.resolu
                        ],
                    }
                    for nom, releves in (("code", depuis_code), ("docs", depuis_docs))
                },
            },
            indent=1,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    titre("Verdict")
    casses = len(casses_code) + len(casses_docs)
    # **Seuls les renvois font échouer ce banc.** Un renvoi cassé est une
    # erreur : il désigne une section qui n'existe plus. Un corpus qui grossit
    # n'en est pas une — c'est une tendance, elle se lit et elle se décide.
    if casses == 0:
        print(
            f"  Les {len(depuis_code) + len(depuis_docs)} renvois tombent tous juste."
            f" Corpus de démarrage : {ko(total)}."
        )
        verdict = 0
    else:
        print(
            f"  {casses} renvoi(s) cassé(s) — {len(casses_code)} depuis le code,"
            f" {len(casses_docs)} entre documents. Chacun désigne une section"
            f" qui n'existe plus là où il la cherche."
        )
        verdict = 1
    print(f"  Relevé écrit : {SORTIE}")
    return verdict


if __name__ == "__main__":
    sys.exit(principal())
