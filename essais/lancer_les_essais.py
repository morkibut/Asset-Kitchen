# -*- coding: utf-8 -*-
"""Lancer la suite serveur — vite, ou en entier, ou fichier par fichier pour mesurer.

**Le problème qu'il règle.** `pytest -q` lance trois mille sept cent cinquante
essais d'un seul bloc, et il n'en finit plus : mesuré le 20 septembre 2026,
**71 minutes de processeur** pour les deux cent un fichiers — contre 18 minutes
de montre à quatre processus. Personne ne lance une heure d'essais, donc personne
ne lance rien, donc une faute reste cachée. C'est ce qui est arrivé à
`tests/test_b0.py`,
qui contrôle les tailles écrites dans tous les écrans : une largeur posée dans un
composant l'a fait échouer, et l'échec a dormi trois séances.

**Trois usages, et trois seulement.**

    py essais/lancer_les_essais.py              le niveau rapide — à chaque tranche
    py essais/lancer_les_essais.py --complet    tout, lent compris — avant de fusionner
    py essais/lancer_les_essais.py --proches    le cran le plus court — ce qu'on vient d'écrire
    py essais/lancer_les_essais.py --liste      ne rien lancer, dire ce qui serait lancé
    py essais/lancer_les_essais.py --mesure     fichier par fichier, et le tableau des lenteurs

**Ce que le niveau rapide lance**, et pourquoi c'est cet assemblage-là :

- `pytest -m "not lent"` — tout ce qui n'est pas marqué lent. C'est le gros du
  compte et ça tient en quelques minutes ;
- **plus** les essais marqués lents qui sont soit des garde-fous, soit proches
  de ce qu'on vient de toucher. Sans cette seconde moitié, marquer un essai lent
  reviendrait à le retirer du contrôle courant — ce qui est l'inverse du but.

**Un garde-fou** est un essai qui lit des fichiers du dépôt au lieu d'appeler du
code : il ne surveille pas une tranche, il surveille tout ce qu'on écrit. Il
porte le marqueur `gardefou`, et ce fichier-ci **ne tient aucune liste** : il
demande à pytest qui le porte. Un essai neuf entre dans le contrôle en portant le
marqueur, sans qu'on touche à cet outil. En prime, `--mesure` **dénonce** un
fichier qui ressemble à un garde-fou sans en porter le marqueur.

**Les essais proches** se déduisent de `git diff --name-only` : on prend les
fichiers modifiés et on garde les essais qui les **nomment**. La règle est
honnête et elle a un trou, écrit ici pour qu'il ne se découvre pas un mauvais
jour : *un essai qui passe par l'API ou par `Atelier` ne nomme aucun module
profond*, donc toucher `atelier/image/traitement.py` ne proposera pas les essais
d'écran qui s'en servent sans le citer. C'est pour ce trou-là que le niveau
rapide lance aussi `-m "not lent"` en entier, et pas seulement les proches.

**Gratuit.** Aucun essai de `tests/` ne touche au réseau ni ne coûte un centime ;
le double de fournisseur de `tests/conftest.py` s'en charge.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
TESTS = RACINE / "tests"

# **Combien de processus — quatre, et c'est mesuré, pas deviné.** Le
# 20 septembre 2026, sur une machine à seize cœurs, la suite entière moins les
# lents a été lancée trois fois :
#
#     4 processus   7 min 36   1 échec (connu : Guide.tsx, GU7)
#     8 processus   8 min 45   le même échec, et rien de plus
#    12 processus   9 min 16   le même, **plus deux faux échecs**
#
# ⚠️ La durée varie du simple au double sans qu'on change rien : la même passe à
# quatre a été relevée à 6 min 41, 7 min 36 et 12 min 07 le même jour. Compter
# une dizaine de minutes, et ne jamais lire un écart de durée comme une
# régression.
#
# Deux choses, et les deux vont contre l'intuition. **Monter ne fait pas gagner
# de temps** : au-delà de quatre, les essais se disputent la machine — ils
# travaillent presque tous des images, et Pillow comme numpy occupent déjà
# plusieurs cœurs chacun. Et **monter rend le résultat faux** : à douze,
# `test_t1_jalon3_4` mesure une attente de 0,19 s là où il en attend 0,12, et
# `test_au6` échoue aussi ; les deux passent seuls. Un essai qui échoue à cause
# du voisin ne dit plus rien de vrai sur le produit.
PROCESSUS = 4

# **Le délai par fichier**, en secondes, pour `--mesure`. Le plus long fichier
# connu met cent dix-neuf secondes ; six cents laissent la place à un fichier
# neuf sans laisser tourner un blocage toute une soirée.
DELAI = 600


# ─────────────────────────────────────────────────────────────────────────────
# Le terrain — ce qu'il faut avoir sous la main avant de lancer quoi que ce soit
# ─────────────────────────────────────────────────────────────────────────────

def python_du_depot() -> str:
    """L'interpréteur qui sait importer `atelier`.

    Dans un worktree, `sys.executable` est déjà le bon si l'on a lancé le script
    avec ; on ne devine rien de plus.
    """
    return sys.executable


def avertir_du_terrain() -> list[str]:
    """Ce qui manque et qui fera échouer des essais **pour une mauvaise raison**.

    Un échec dont la cause est le terrain et non le code est pire qu'un échec
    franc : on cherche la faute dans le produit et elle n'y est pas. Chaque
    manque est donc nommé ici, avec le geste qui le répare.
    """
    manques: list[str] = []

    # `interface/dist` est un produit de compilation, hors Git. Dans un worktree
    # il n'existe donc pas, et les essais qui interrogent le serveur reçoivent
    # 404 là où ils attendent 405 — `tests/test_c5.py` et `tests/test_rp17.py`
    # l'ont payé. Une jonction vers celui du dépôt principal suffit.
    if not (RACINE / "interface" / "dist").exists():
        manques.append(
            "interface/dist est absent — les essais qui interrogent le serveur\n"
            "  répondront 404 au lieu de 405, et ce n'est pas une faute du code.\n"
            "  Dans un worktree, une jonction vers le dépôt principal répare :\n"
            '  cmd /c "mklink /J interface\\dist ..\\gag2\\interface\\dist"\n'
            "  Dans le dépôt principal : cd interface && npm run build"
        )

    try:
        import xdist  # noqa: F401
    except ImportError:
        manques.append(
            "pytest-xdist n'est pas installé — sans lui, rien ne part en parallèle.\n"
            '  uv pip install -e ".[dev]"'
        )

    return manques


# ─────────────────────────────────────────────────────────────────────────────
# Les essais proches — ce que `git diff` propose, et ce qu'il ne devine pas
# ─────────────────────────────────────────────────────────────────────────────

def fichiers_modifies(depuis: str) -> list[str]:
    """Ce qui a bougé : les commits de la branche, plus ce qui n'est pas commité.

    Les deux, parce qu'une tranche en cours a les deux moitiés — ce qu'on a déjà
    commité ce matin et ce qu'on est en train d'écrire.
    """
    vus: list[str] = []

    def lire(*args: str) -> None:
        sortie = subprocess.run(
            ["git", *args], cwd=RACINE, capture_output=True, text=True
        )
        if sortie.returncode == 0:
            for ligne in sortie.stdout.splitlines():
                if ligne.strip() and ligne.strip() not in vus:
                    vus.append(ligne.strip())

    lire("diff", "--name-only", f"{depuis}...HEAD")
    lire("diff", "--name-only", "HEAD")
    lire("ls-files", "--others", "--exclude-standard")
    return vus


def jetons_du_fichier(chemin: str) -> list[str]:
    """Les mots sous lesquels un essai peut nommer ce fichier-là.

    `atelier/image/decoupe.py` se cite de trois façons dans un essai — par son
    chemin, par son module pointé, ou par son seul nom. On cherche les trois ;
    trop large vaut mieux que trop étroit, puisque le prix d'un essai lancé pour
    rien est quelques secondes et celui d'un essai oublié est une faute cachée.

    **Le nom sans son extension n'est gardé que pour un module Python**, et c'est
    une correction payée le 20 septembre 2026 : un fichier nommé `docs/essais.md`
    donnait le jeton « essais », présent dans presque tous les fichiers du
    dépôt, et la règle proposait alors la suite entière. Un module Python, lui,
    se cite vraiment par son seul nom — `from atelier.image import decoupe` —,
    donc il garde ce jeton-là.
    """
    p = Path(chemin)
    jetons = [chemin, chemin.replace("/", "\\"), p.name]
    if p.suffix == ".py":
        jetons.append(".".join(p.with_suffix("").parts))
        jetons.append(p.stem)
    return [j for j in jetons if len(j) > 2]


def essais_proches(modifies: list[str]) -> tuple[list[Path], list[str]]:
    """Les fichiers d'essais qui nomment l'un des fichiers modifiés.

    Rend aussi ce qui **échappe** à la règle — les fichiers modifiés qu'aucun
    essai ne nomme —, parce qu'une liste vide sans explication se lit « rien à
    vérifier », ce qui est faux.
    """
    tous = sorted(TESTS.glob("test_*.py"))
    textes = {f: f.read_text(encoding="utf-8", errors="replace") for f in tous}

    retenus: list[Path] = []
    orphelins: list[str] = []

    for modifie in modifies:
        chemin = Path(modifie)
        # Un essai modifié est proche de lui-même, sans autre calcul.
        if chemin.parts[:1] == ("tests",) and chemin.name.startswith("test_"):
            cible = RACINE / chemin
            if cible.exists() and cible not in retenus:
                retenus.append(cible)
            continue
        # Les essais d'écran sont du ressort de vitest, pas d'ici.
        if ".test." in chemin.name:
            continue

        jetons = jetons_du_fichier(modifie)
        trouve = False
        for essai, texte in textes.items():
            if any(jeton in texte for jeton in jetons):
                trouve = True
                if essai not in retenus:
                    retenus.append(essai)
        if not trouve:
            orphelins.append(modifie)

    return sorted(retenus), orphelins


# ─────────────────────────────────────────────────────────────────────────────
# Le détecteur de garde-fous non marqués
# ─────────────────────────────────────────────────────────────────────────────

# **Ce qui fait un garde-fou, et rien d'autre : il balaie un dossier entier.**
# Lire un fichier nommé ne suffit pas — un essai qui ouvre `interface/src/api.ts`
# reste l'essai d'une tranche, et la règle des proches le retrouvera très bien
# puisqu'il nomme le fichier. Celui qui passe `rglob` sur tout `interface/src`,
# lui, casse sur un fichier qu'il ne nomme nulle part : aucune règle ne peut le
# deviner, donc il doit tourner **toujours**. C'est cette différence-là, et elle
# seule, que ce détecteur cherche.
REMONTE = re.compile(r"Path\(__file__\)\.resolve\(\)\.(?:parent\.parent|parents\[[12]\])")
BALAYAGE = re.compile(r"\.rglob\(")


def gardes_fous_non_marques() -> list[str]:
    """Les essais qui ressemblent à un garde-fou sans en porter le marqueur.

    Le marqueur fait foi — c'est lui que `pytest -m gardefou` lit. Ce détecteur
    ne décide de rien : il **dénonce**, pour qu'un garde-fou neuf n'entre pas
    dans le dépôt en restant hors du contrôle courant.
    """
    suspects: list[str] = []
    for essai in sorted(TESTS.glob("test_*.py")):
        texte = essai.read_text(encoding="utf-8", errors="replace")
        if "gardefou" in texte:
            continue
        if REMONTE.search(texte) and BALAYAGE.search(texte):
            suspects.append(essai.name)
    return suspects


# ─────────────────────────────────────────────────────────────────────────────
# Lancer — les deux moteurs, et ce qui les sépare
# ─────────────────────────────────────────────────────────────────────────────

def lancer(args: list[str], titre: str) -> int:
    """Un passage de pytest, montré en direct. Rend son code de sortie."""
    print(f"\n{'─' * 78}\n{titre}\n{'─' * 78}")
    print("  " + " ".join(args[1:]) + "\n", flush=True)
    debut = time.monotonic()
    code = subprocess.run(args, cwd=RACINE).returncode
    duree = time.monotonic() - debut
    print(f"\n  {titre} — {duree:.0f} s, code {code}", flush=True)
    return code


# **Les deux garde-fous qui ne sont pas dans pytest.** `essai_jetons.py` et
# `essai_imports.py` sont rappelés par `tests/test_b0.py` et `tests/test_b27.py`,
# donc `pytest` les tient ; ces deux-là ne le sont par personne, et sans cette
# liste ils ne tourneraient jamais dans un contrôle. Ils balaient tout le dépôt —
# tous les renvois de tous les documents pour l'un, tous les mots d'ossature de
# tous les écrans pour l'autre —, ce qui en fait des garde-fous au même titre.
#
# ⚠️ `essai_docs.py` **écrit son relevé** dans `essais/mesures_docs.json` à chaque
# passage : c'est voulu, c'est ainsi qu'il compare la dérive du corpus d'une fois
# sur l'autre. Le fichier apparaît donc modifié après un contrôle ; ce n'est pas
# une faute, et il se commite avec le reste ou se remet en place.
BANCS_GARDEFOUS = ("essai_docs.py", "essai_vocabulaire.py")


def bancs_gardefous() -> int:
    """Les deux bancs qui surveillent le dépôt, lancés comme le reste."""
    code = 0
    for banc in BANCS_GARDEFOUS:
        code |= lancer(
            [python_du_depot(), str(RACINE / "essais" / banc)],
            f"Garde-fou : essais/{banc}",
        )
    return code


def base(procs: int) -> list[str]:
    """Le départ commun de tout passage parallèle.

    `--dist loadfile` garde les essais d'un même fichier sur le même processus.
    C'est ce qui rend le parallèle sûr ici : les fichiers de ce dépôt partagent
    des montages coûteux — un atelier, un client d'essai —, et les éparpiller
    les referait vingt fois pour rien.
    """
    return [
        python_du_depot(), "-m", "pytest", "-q",
        "-n", str(procs), "--dist", "loadfile",
        "-p", "no:cacheprovider",
        "-rf",
    ]


def proches_seulement(procs: int, depuis: str) -> int:
    """Le cran le plus court — les garde-fous, et ce qu'on vient de toucher.

    **Il existe à cause d'une mesure.** Le 20 septembre 2026, on a constaté que
    presque rien de ce dépôt n'est assez lourd pour mériter le marqueur `lent` :
    la suite est lente par accumulation, pas par quelques essais. Du coup
    `-m "not lent"` est presque toute la suite, et le niveau rapide coûte presque
    le prix du complet.

    Ce cran-ci est le vrai geste de la boucle de travail : on relit ce qu'on
    vient d'écrire, plus les garde-fous qui surveillent le reste. ⚠️ **Il ne
    remplace pas le rapide** — il voit beaucoup moins, et il faut lancer le
    rapide avant de quitter une tranche.
    """
    modifies = fichiers_modifies(depuis)
    proches, orphelins = essais_proches(modifies)
    annoncer(modifies, proches, orphelins, depuis)

    code = lancer(base(procs) + ["-m", "gardefou"], "Les garde-fous")
    cibles = [f"tests/{p.name}" for p in proches]
    if cibles:
        code |= lancer(base(procs) + cibles, "Ce qu'on vient de toucher")
    else:
        print("\nAucun essai ne nomme les fichiers modifiés — rien de plus à lancer.")
    return code | bancs_gardefous()


def annoncer(modifies: list[str], proches: list[Path], orphelins: list[str],
             depuis: str) -> None:
    """Ce qu'on a touché, ce que ça propose, et ce que la règle ne devine pas.

    La troisième liste est la plus utile : elle nomme les trous.
    """
    print(f"\n{len(modifies)} fichier(s) modifié(s) depuis {depuis}.")
    if proches:
        print(f"{len(proches)} essai(s) les nomment :")
        for p in proches:
            print(f"    tests/{p.name}")
    else:
        print("Aucun essai ne nomme ces fichiers.")
    if orphelins:
        print(
            f"\n{len(orphelins)} fichier(s) qu'aucun essai ne nomme — la règle ne les\n"
            "devine pas, et c'est pour eux que le passage large existe :"
        )
        for o in orphelins[:12]:
            print(f"    {o}")
        if len(orphelins) > 12:
            print(f"    … et {len(orphelins) - 12} de plus")


def rapide(procs: int, depuis: str) -> int:
    """Le niveau rapide — à lancer à chaque tranche de travail."""
    modifies = fichiers_modifies(depuis)
    proches, orphelins = essais_proches(modifies)
    annoncer(modifies, proches, orphelins, depuis)

    # Le gros du contrôle : tout ce qui n'est pas marqué lent.
    code = lancer(
        base(procs) + ["-m", "not lent"],
        "Tout ce qui n'est pas lent",
    )

    # Puis la seconde moitié : les lents qu'on ne veut surtout pas perdre de vue —
    # les garde-fous, et ceux qui touchent à ce qu'on vient d'écrire. Sans eux,
    # marquer un essai lent reviendrait à le retirer du contrôle courant, ce qui
    # est l'inverse du but. Ils partent **sans concurrence**, comme au complet.
    seul = [python_du_depot(), "-m", "pytest", "-q", "-p", "no:cacheprovider", "-rf"]
    code |= lancer(seul + ["-m", "lent and gardefou"], "Les garde-fous lents")

    cibles = [f"tests/{p.name}" for p in proches]
    if cibles:
        code |= lancer(
            seul + ["-m", "lent"] + cibles,
            "Les lents, parmi ce qu'on a touché",
        )

    return code | bancs_gardefous()


def complet(procs: int) -> int:
    """Le niveau complet — une fois par chantier, avant de fusionner dans main.

    Deux passages, et la séparation est le cœur de l'affaire : **ce qui est lent
    part sans concurrence.** Les deux essais qui lancent le moteur Godot lui
    donnent trente secondes ; sous la charge de dix processus ils dépassent ce
    délai et échouent alors qu'ils passent seuls. Un essai qui échoue à cause du
    voisin ne dit plus rien de vrai sur le produit.
    """
    code = lancer(base(procs) + ["-m", "not lent"], "Tout ce qui n'est pas lent")
    code |= lancer(
        [python_du_depot(), "-m", "pytest", "-q", "-p", "no:cacheprovider", "-rf",
         "-m", "lent", "--durations=20"],
        "Les lents, seuls, sans concurrence",
    )
    return code | bancs_gardefous()


# ─────────────────────────────────────────────────────────────────────────────
# Mesurer — fichier par fichier, et le tableau qui en sort
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Releve:
    fichier: str
    duree: float
    code: int
    depasse: bool
    resume: str


def un_fichier(essai: Path, delai: int) -> Releve:
    """Un fichier d'essais, dans son propre processus, avec un délai maximum.

    **Le délai est posé autour du processus, pas par `pytest-timeout`**, et c'est
    un choix. Un délai par *essai* se mesure en secondes de machine : sous la
    charge de plusieurs processus il refuserait des essais qui passent seuls —
    très exactement le défaut que cet outil existe pour supprimer. Ce qu'on veut
    savoir en mesurant, c'est *quel fichier* ne rend pas la main ; tuer le
    processus entier le dit, et n'ajoute aucune dépendance au dépôt.
    """
    debut = time.monotonic()
    args = [
        python_du_depot(), "-m", "pytest", "-q", "-p", "no:cacheprovider",
        f"tests/{essai.name}",
    ]
    try:
        fin = subprocess.run(
            args, cwd=RACINE, capture_output=True, text=True,
            errors="replace", timeout=delai,
        )
        duree = time.monotonic() - debut
        derniere = [l for l in fin.stdout.splitlines() if l.strip()]
        return Releve(essai.name, duree, fin.returncode, False,
                      derniere[-1][:90] if derniere else "")
    except subprocess.TimeoutExpired:
        return Releve(essai.name, float(delai), 99, True,
                      f"délai de {delai} s dépassé")


def mesurer(procs: int, delai: int, choisis: list[str]) -> int:
    """Chaque fichier dans son propre processus, puis le tableau.

    **Deux usages, et il ne faut pas les confondre.** Le balayage complet part à
    `-n 4` et sert à *trier* : en une passe on voit qui échoue et qui traîne.
    Mais une durée relevée pendant que trois autres processus mangent la machine
    mesure la charge autant que le fichier — elle est gonflée, et elle ne peut
    pas décider d'un marqueur.

    **Ce qui décide du marqueur `lent`, c'est une seconde passe à `-n 1` sur les
    seuls candidats** :

        py essais/lancer_les_essais.py --mesure -n 1 tests/test_c5.py tests/test_t4.py

    Là, le fichier est seul sur la machine, et la durée est la sienne.
    """
    from concurrent.futures import ThreadPoolExecutor

    if choisis:
        essais = [RACINE / c for c in choisis]
        absents = [e for e in essais if not e.exists()]
        if absents:
            print("Introuvable : " + ", ".join(str(a) for a in absents))
            return 2
    else:
        essais = sorted(TESTS.glob("test_*.py"))
    print(f"\n{len(essais)} fichiers, {procs} à la fois, {delai} s au plus chacun.\n")

    releves: list[Releve] = []
    debut = time.monotonic()
    with ThreadPoolExecutor(max_workers=procs) as pool:
        for releve in pool.map(lambda e: un_fichier(e, delai), essais):
            releves.append(releve)
            etat = "OK " if releve.code == 0 else ("DÉLAI" if releve.depasse else "ÉCHEC")
            print(f"  {etat:5} {releve.duree:6.1f} s  {releve.fichier}", flush=True)
    total = time.monotonic() - debut

    rates = [r for r in releves if r.code != 0]
    print(f"\n{'═' * 78}\n{len(essais)} fichiers en {total / 60:.1f} min "
          f"({procs} à la fois) — {len(rates)} en échec\n{'═' * 78}")

    if rates:
        print("\nCE QUI ÉCHOUE")
        for r in rates:
            print(f"  {r.fichier:44} {r.duree:6.1f} s  {r.resume}")

    print("\nLES PLUS LENTS")
    for r in sorted(releves, key=lambda r: -r.duree)[:25]:
        print(f"  {r.duree:6.1f} s  {r.fichier}")

    suspects = gardes_fous_non_marques()
    if suspects:
        print("\nRESSEMBLENT À UN GARDE-FOU SANS EN PORTER LE MARQUEUR")
        print("  (ils lisent des fichiers du dépôt ; sans `gardefou`, le niveau")
        print("   rapide ne les rattrapera pas s'ils deviennent lents)")
        for s in suspects:
            print(f"  {s}")

    return 1 if rates else 0


# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Lancer la suite serveur : rapide, complet, ou mesuré.",
    )
    analyseur.add_argument("--complet", action="store_true",
                           help="tout, lent compris — avant de fusionner dans main")
    analyseur.add_argument("--mesure", action="store_true",
                           help="fichier par fichier, et le tableau des lenteurs")
    analyseur.add_argument("--proches", action="store_true",
                           help="le cran le plus court : garde-fous + ce qu'on a touché, rien d'autre")
    analyseur.add_argument("--liste", action="store_true",
                           help="ne rien lancer : dire seulement quels essais sont proches")
    analyseur.add_argument("-n", type=int, default=PROCESSUS, dest="procs",
                           help=f"combien de processus à la fois (défaut {PROCESSUS})")
    analyseur.add_argument("--delai", type=int, default=DELAI,
                           help=f"délai par fichier en secondes, pour --mesure (défaut {DELAI})")
    analyseur.add_argument("--depuis", default="main",
                           help="la référence à laquelle comparer (défaut main)")
    analyseur.add_argument("fichiers", nargs="*",
                           help="avec --mesure : ne mesurer que ces fichiers-là")
    options = analyseur.parse_args()

    for manque in avertir_du_terrain():
        print(f"\n⚠️  {manque}\n")

    if options.liste:
        modifies = fichiers_modifies(options.depuis)
        proches, orphelins = essais_proches(modifies)
        print(f"\n{len(modifies)} fichier(s) modifié(s) depuis {options.depuis}.")
        for p in proches:
            print(f"    tests/{p.name}")
        if orphelins:
            print(f"\nQu'aucun essai ne nomme ({len(orphelins)}) :")
            for o in orphelins:
                print(f"    {o}")
        return 0

    if options.proches:
        return proches_seulement(options.procs, options.depuis)

    if options.mesure:
        return mesurer(options.procs, options.delai, options.fichiers)
    if options.complet:
        return complet(options.procs)
    return rapide(options.procs, options.depuis)


if __name__ == "__main__":
    raise SystemExit(main())
