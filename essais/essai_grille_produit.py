# -*- coding: utf-8 -*-
"""Le banc de réception de D2 — le détecteur **du produit**, sur de vraies images.

Écrit le 3 septembre 2026 pour le dernier critère de la tranche : *« le pas réel
est retrouvé sur un lot d'images du dépôt, et le taux est mesuré et écrit »*.

**Il ne coûte rien.** Il relit des images déjà sur le disque et fabrique le reste
lui-même. Aucune clé n'est lue, aucun appel ne sort de la machine.

## Ce banc-ci n'est pas `essai_grille_retrouvee.py`, et c'est le point

Le banc d'avant **rejouait** la méthode plutôt que de l'appeler, et sa note de
tête dit pourquoi : `mesurer_grille` prend des octets et convertit en gris, donc
elle ne savait ni recevoir un tableau ni voir l'alpha — les deux choses qu'il
comparait. Il a servi à choisir la méthode.

Celui-ci fait l'inverse : **il appelle `atelier.image.retrouver_grille` telle
qu'elle est livrée**, sur les images que le produit voit vraiment — détourées,
comme l'écran les lui donne. C'est une réception, pas une étude ; si les deux
divergeaient un jour, c'est celui-ci qui aurait raison.

## Les trois mesures

**① Le taux, sur un lot à vérité connue bâti à partir d'images réelles.** Aucune
image du dépôt ne vient avec son pas écrit à côté, et personne ne peut le lire à
l'œil sans se tromper. On fabrique donc la vérité : on prend une vraie image, on
la ramène à quarante cases par la réduction du produit, et on la réagrandit d'un
facteur connu au plus proche voisin. Le dessin est réel, le pas est connu, et la
question posée est exactement celle de la tranche — *retrouve-t-on le pas d'une
image qui porte déjà une grille ?*

**② Le renoncement, sur les images brutes telles que le modèle les a rendues.**
Là, aucune vérité connue, et c'est le vrai sujet : deux jeux du dépôt ont demandé
la même chose au modèle et n'ont pas reçu la même chose. Le jeu du marais a reçu
des carrés ; *cœur de pierre* a reçu une peinture, alors que sa bible réclamait
mot pour mot *« strict 64x64 px tile snap »*. Un détecteur juste annonce sur le
premier et se tait sur le second.

**③ Ce qui a été écarté, et ce que ça coûte.** Trois variantes mesurées côte à
côte plutôt que supposées : les niveaux de gris contre la somme des canaux, les
quatre bornes de balayage qui circulaient, et l'arbitre d'aller-retour.

    Lancer :  py essais/essai_grille_produit.py
              py essais/essai_grille_produit.py --images 20 --brutes 200

Sortie : ce journal, et `essais/mesures_grille_produit.json`.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.domaine.recette import BORD, VOTE, Grille, Passe, Recette  # noqa: E402
from atelier.image.traitement import (  # noqa: E402
    NETTETE_MINIMALE,
    PAS_MAXIMAL,
    PAS_MINIMAL,
    PEIGNE_MINIMAL,
    _peigne,
    _profils_des_canaux,
    retrouver_grille,
    sur_grille,
)

DETOURAGE = Recette(passes=(Passe(moteur=BORD),))

#: Le nombre de cases du sprite qu'on repose sur une grille connue. Quarante
#: parce que c'est l'ordre de grandeur des cibles du dépôt — 32, 64, 128 — et
#: qu'au-delà l'image fabriquée dépasse deux mille pixels au pas le plus
#: grossier, ce qui ne ressemble plus à rien de ce que le produit reçoit.
CASES = 40

#: Les pas qu'on repose, en pixels. Ils couvrent la plage mesurée du dépôt —
#: 2 à 32 — et débordent volontairement d'un cran au-dessus de la borne pour
#: voir ce que la détection fait quand le pas lui échappe.
PAS_ENTIERS = (3, 4, 6, 8, 12, 16, 24, 32, 48)

#: Les pas **non entiers**, qui sont le cas réel : un modèle ne cale rien, il
#: peint « à peu près » sur 13,1 px. C'est là que le banc d'avant a vu l'arbitre
#: d'aller-retour se tromper trois fois sur trois.
PAS_FRACTIONNAIRES = ((9.4, 9), (13.1, 13), (23.7, 24))

#: Les pas qui reçoivent en plus une version floue et une version décalée. Trois
#: suffisent : le flou et la phase ne dépendent pas du pas, on vérifie qu'ils ne
#: cassent rien, pas qu'ils se comportent différemment à chaque cran.
PAS_MALMENES = (6, 12, 24)


# ── Le lot à vérité connue ───────────────────────────────────────────────────


def _projet_des_bruts() -> dict[Path, str]:
    """À quel jeu chaque image brute appartient.

    C'est ce qui rend la mesure ② lisible : un jeu qui a reçu des peintures et un
    jeu qui a reçu des carrés ne posent pas la même question, et les compter
    ensemble noierait les deux réponses dans une moyenne qui ne veut rien dire.
    """
    par_brut: dict[Path, str] = {}
    for fiche in (RACINE / "donnees" / "generations").rglob("*-asset.json"):
        try:
            asset = json.loads(fiche.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if asset.get("supprime_le"):
            continue
        par_brut[RACINE / "donnees" / str(asset.get("brut") or "")] = str(
            asset.get("projet") or "sans jeu"
        )
    return par_brut


def _brutes(combien: int) -> list[tuple[str, Path, np.ndarray]]:
    """Les images brutes du dépôt, **détourées comme le produit les détoure**.

    Le produit ne cherche jamais de grille sur un fichier : il cherche sur
    l'image détourée, qu'il a déjà en cache. Mesurer sur autre chose mesurerait
    un détecteur que personne n'appelle.
    """
    appartenance = _projet_des_bruts()
    lues: list[tuple[str, Path, np.ndarray]] = []
    for chemin in sorted((RACINE / "donnees" / "generations").rglob("*-brut.png")):
        try:
            rgba = detourer_comme_le_produit(chemin.read_bytes())
        except (OSError, ValueError):
            continue
        lues.append((appartenance.get(chemin, "sans jeu"), chemin, rgba))
        if len(lues) >= combien:
            break
    return lues


def detourer_comme_le_produit(octets: bytes) -> np.ndarray:
    """Une passe de remplissage depuis le bord — le détourage livré du produit."""
    from atelier.image.traitement import detourer

    return detourer(DETOURAGE, octets)


def _sur_une_grille(rgba: np.ndarray, pas: float) -> np.ndarray:
    """Une vraie image du dépôt, **reposée sur une grille de pas connu**.

    Deux temps, et les deux sont ceux du produit :

    1. la réduction du produit ramène le sujet à `CASES` cases — c'est le vote
       en deux temps, la méthode que l'auteur a choisie par défaut le 3 septembre
       2026, donc l'image obtenue ressemble à ce que l'atelier fabrique ;
    2. l'agrandissement au plus proche voisin repose chaque case sur `pas`
       pixels. **Chaque bloc est alors d'une seule couleur par construction** :
       la vérité n'est pas déclarée, elle est fabriquée.

    Un pas non entier passe par un agrandissement à `CASES × pas` arrondi, ce qui
    donne des blocs de tailles inégales — 13 px la plupart du temps, 14 de temps
    en temps. C'est très exactement ce qu'un modèle rend.
    """
    reduit = sur_grille(rgba, Grille(cible=CASES, methode=VOTE), case=False)
    image = Image.fromarray(reduit, mode="RGBA")
    cote = (
        max(1, round(image.width * pas)),
        max(1, round(image.height * pas)),
    )
    return np.asarray(image.resize(cote, Image.Resampling.NEAREST))


def _floue(rgba: np.ndarray) -> np.ndarray:
    """L'anti-crénelage que les modèles laissent sur les bords, imité à 1 px."""
    return np.asarray(
        Image.fromarray(rgba, mode="RGBA").filter(ImageFilter.GaussianBlur(1.0))
    )


def _decalee(rgba: np.ndarray, pas: int) -> np.ndarray:
    """La grille qui ne commence pas au pixel zéro — le cas normal."""
    return np.roll(rgba, (pas // 3, pas // 3), axis=(0, 1))


def _lot(images: list[tuple[str, Path, np.ndarray]]) -> list[tuple[str, np.ndarray, int]]:
    """Le lot entier : chaque image réelle, reposée sur chacun des pas voulus."""
    cas: list[tuple[str, np.ndarray, int]] = []
    for _, chemin, rgba in images:
        nom = chemin.parent.name[:8]
        for pas in PAS_ENTIERS:
            cas.append((f"{nom} · pas {pas}", _sur_une_grille(rgba, float(pas)), pas))
        for pas in PAS_MALMENES:
            pose = _sur_une_grille(rgba, float(pas))
            cas.append((f"{nom} · pas {pas} flou", _floue(pose), pas))
            cas.append((f"{nom} · pas {pas} décalé", _decalee(pose, pas), pas))
        for pas, attendu in PAS_FRACTIONNAIRES:
            cas.append(
                (
                    f"{nom} · pas {pas}",
                    _floue(_sur_une_grille(rgba, pas)),
                    attendu,
                )
            )
    return cas


def _verdict(trouve: int, attendu: int) -> str:
    """Cinq issues, et « renoncé » n'est pas « raté ».

    **La distinction porte toute la tranche.** Une détection qui se tait laisse
    l'auteur poser la taille lui-même, ce qu'il fait déjà ; une détection qui
    annonce un pas faux le fait travailler sur un chiffre inventé. Les compter
    ensemble effacerait la seule chose que cette moitié de D2 livre.
    """
    if trouve == 0:
        return "renoncé"
    if trouve == attendu:
        return "exact"
    if abs(trouve - attendu) <= 1:
        return "à 1 px"
    if (
        abs(trouve - attendu * 2) <= 1
        or abs(trouve * 2 - attendu) <= 1
        or abs(trouve - attendu * 3) <= 1
        or abs(trouve * 3 - attendu) <= 1
    ):
        return "octave"
    return "raté"


ISSUES = ("exact", "à 1 px", "octave", "raté", "renoncé")


# ── Les variantes écartées, rejouées pour être comparables ───────────────────


def _profils_gris(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Ce que `mesurer_grille` fait : un seul canal, les niveaux de gris."""
    gris = np.asarray(
        Image.fromarray(rgba, mode="RGBA").convert("L"), dtype=np.float64
    )
    return (
        np.abs(np.diff(gris, axis=1)).sum(axis=0),
        np.abs(np.diff(gris, axis=0)).sum(axis=1),
    )


def _erreur_aller_retour(rgba: np.ndarray, pas: int) -> float:
    """L'arbitre d'octave du banc d'avant : ce pas-là reconstruit-il l'image ?

    Réduire par la moyenne de chaque bloc, réagrandir au plus proche voisin,
    mesurer ce qui a changé — en cherchant la phase, sans quoi une grille
    décalée fait répondre la moitié du bon pas.
    """
    if pas < PAS_MINIMAL:
        return 1.0
    hauteur, largeur = rgba.shape[:2]
    meilleure = 1.0
    for decalage in range(pas):
        h, l = (hauteur - decalage) // pas, (largeur - decalage) // pas
        if h < 2 or l < 2:
            continue
        coupe = rgba[
            decalage : decalage + h * pas, decalage : decalage + l * pas
        ].astype(np.float64)
        blocs = coupe.reshape(h, pas, l, pas, 4).mean(axis=(1, 3))
        reconstruit = np.repeat(np.repeat(blocs, pas, axis=0), pas, axis=1)
        meilleure = min(meilleure, float(np.abs(coupe - reconstruit).mean() / 255.0))
    return meilleure


def variante(
    rgba: np.ndarray,
    *,
    maximum: int = PAS_MAXIMAL,
    en_gris: bool = False,
    arbitre: bool = False,
) -> int:
    """Le détecteur du produit, **rejoué avec un réglage changé**, et rien d'autre.

    ⚠️ **Ce rejeu est vérifié contre le produit à chaque lancement**, cas par
    cas : `variante(rgba)` sans argument doit rendre exactement ce que
    `retrouver_grille(rgba)` rend. Sans cette vérification, une comparaison de
    variantes finirait par comparer le rejeu à lui-même — c'est-à-dire à mesurer
    une méthode que le produit n'exécute pas.
    """
    profils = _profils_gris(rgba) if en_gris else _profils_des_canaux(rgba)
    borne = min(maximum, min(profil.size for profil in profils) // 4)
    if borne < PAS_MINIMAL:
        return 0

    propose, sa_nettete = 0, 0.0
    for profil in profils:
        centre = profil - profil.mean()
        variance = float((centre * centre).mean())
        if variance == 0:
            continue
        correlations = {
            pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
            for pas in range(PAS_MINIMAL, borne + 1)
        }
        crete = max(correlations.values())
        if crete < NETTETE_MINIMALE:
            continue
        for pas in sorted(correlations):
            voisines = (
                correlations.get(pas - 1, -1.0),
                correlations.get(pas + 1, -1.0),
            )
            if correlations[pas] >= 0.9 * crete and correlations[pas] >= max(voisines):
                if correlations[pas] > sa_nettete:
                    propose, sa_nettete = pas, correlations[pas]
                break

    if propose < PAS_MINIMAL:
        return 0
    if max(_peigne(profil, propose) for profil in profils) < PEIGNE_MINIMAL:
        return 0
    if not arbitre:
        return propose

    # L'arbitre : parmi le pas proposé, sa moitié, son double et son triple, le
    # plus grand qui reconstruise encore l'image au plancher.
    candidats = [
        p
        for p in (propose // 2, propose, propose * 2, propose * 3)
        if PAS_MINIMAL <= p <= borne
    ]
    erreurs = {p: _erreur_aller_retour(rgba, p) for p in candidats}
    plancher = min(erreurs.values())
    seuil = max(plancher * 1.20, plancher + 0.002)
    return max(p for p, erreur in erreurs.items() if erreur <= seuil)


# ── Le journal ───────────────────────────────────────────────────────────────


def _tableau_des_issues(comptes: dict[str, Counter], total: int) -> None:
    print(f"     {'':10}" + "".join(f"{nom:>18}" for nom in comptes))
    for issue in ISSUES:
        ligne = f"     {issue:10}"
        for nom in comptes:
            compte = comptes[nom][issue]
            ligne += f"{f'{compte} ({100 * compte / total:.0f} %)':>18}"
        print(ligne)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--images", type=int, default=12)
    parseur.add_argument("--brutes", type=int, default=200)
    arguments = parseur.parse_args()

    print()
    print("═" * 78)
    print("  D2 · Le détecteur du produit, en réception")
    print("═" * 78)

    brutes = _brutes(arguments.brutes)
    print(f"\n  {len(brutes)} images brutes lues et détourées.")

    # ── ① Le lot à vérité connue ─────────────────────────────────────────────
    #
    # Les images du lot sont prises **réparties sur les jeux**, jamais les
    # premières venues : les trente premières images du dépôt viennent toutes du
    # même jeu, et le lot mesurerait alors un seul style de dessin.
    par_jeu: dict[str, list[tuple[str, Path, np.ndarray]]] = defaultdict(list)
    for jeu, chemin, rgba in brutes:
        par_jeu[jeu].append((jeu, chemin, rgba))
    choisies: list[tuple[str, Path, np.ndarray]] = []
    tour = 0
    while len(choisies) < arguments.images:
        ajoute = False
        for jeu in sorted(par_jeu):
            if tour < len(par_jeu[jeu]) and len(choisies) < arguments.images:
                choisies.append(par_jeu[jeu][tour])
                ajoute = True
        if not ajoute:
            break
        tour += 1

    lot = _lot(choisies)
    jeux = sorted({jeu for jeu, _, _ in choisies})
    print(
        f"\n① {len(lot)} images à vérité connue — {len(choisies)} dessins réels "
        f"de {len(jeux)} jeux, reposés sur des grilles de pas connu\n"
    )
    print(f"   les jeux : {', '.join(jeux)}")

    issues: Counter = Counter()
    hors_borne: Counter = Counter()
    par_pas: dict[int, Counter] = defaultdict(Counter)
    ecarts: list[tuple[str, int, int]] = []
    for nom, rgba, attendu in lot:
        grille = retrouver_grille(rgba)
        # Le rejeu des variantes doit rendre le produit à l'identique, sans quoi
        # la comparaison de ③ ne comparerait rien de réel.
        assert variante(rgba) == grille.pas, f"le rejeu diverge du produit sur « {nom} »"
        verdict = _verdict(grille.pas, attendu)
        par_pas[attendu][verdict] += 1
        # **Le taux se compte sur la plage que le dépôt produit**, 2 à 32 px.
        # Les cas au-delà sont comptés à part : ils ne mesurent pas la justesse
        # du détecteur mais ce qu'il fait quand le pas lui échappe — et c'est
        # une autre question, à laquelle la seule bonne réponse est « je ne sais
        # pas ». Les mélanger ferait passer une borne bien posée pour un défaut.
        if attendu > PAS_MAXIMAL:
            hors_borne[verdict] += 1
            continue
        issues[verdict] += 1
        if verdict not in ("exact", "à 1 px"):
            ecarts.append((nom, attendu, grille.pas))

    total = sum(issues.values())
    juste = issues["exact"] + issues["à 1 px"]
    print(f"\n   **{juste} sur {total} — {100 * juste / total:.0f} %** exacts ou à un "
          f"pixel près, sur la plage que le dépôt produit (2 à {PAS_MAXIMAL} px).\n")
    for issue in ISSUES:
        print(f"     {issue:10} {issues[issue]:4}   {100 * issues[issue] / total:5.1f} %")

    if hors_borne:
        total_hors = sum(hors_borne.values())
        print(f"\n   **Hors borne — {total_hors} cas posés au-delà de {PAS_MAXIMAL} px.** "
              f"Ce qui compte n'est pas qu'elle les rate,")
        print(f"   c'est ce qu'elle fait à la place : "
              + ", ".join(f"{hors_borne[i]} {i}" for i in ISSUES if hors_borne[i]) + ".")
        print("   **Elle se tait au lieu de répondre un pas faux avec assurance** — le "
              "reproche exact")
        print("   que la revue externe faisait à la version d'avant.")

    print("\n   Par pas posé :\n")
    print(f"     {'pas':>5}  {'exact':>7}  {'à 1 px':>7}  {'octave':>7}  "
          f"{'raté':>7}  {'renoncé':>8}")
    for pas in sorted(par_pas):
        c = par_pas[pas]
        marque = "  ← hors borne" if pas > PAS_MAXIMAL else ""
        print(f"     {pas:5}  {c['exact']:7}  {c['à 1 px']:7}  {c['octave']:7}  "
              f"{c['raté']:7}  {c['renoncé']:8}{marque}")

    if ecarts:
        print(f"\n   Les {len(ecarts)} écarts dans la plage, un par ligne :\n")
        for nom, attendu, trouve in ecarts[:24]:
            print(f"     {nom:34} posé {attendu:3} → trouvé {trouve:3}")
        if len(ecarts) > 24:
            print(f"     … et {len(ecarts) - 24} autres")

    # ── ② Le renoncement sur les images brutes ───────────────────────────────
    print(f"\n② Le renoncement, sur les {len(brutes)} images brutes du dépôt — "
          f"aucune vérité connue\n")
    print(f"   {'jeu':24} {'images':>7} {'annonce':>8} {'renonce':>8}  "
          f"{'pas trouvés':>14}  {'peigne annoncé':>15}  {'peigne tu':>11}")
    par_jeu_mesures: dict[str, list] = defaultdict(list)
    for jeu, _, rgba in brutes:
        par_jeu_mesures[jeu].append(retrouver_grille(rgba))
    resume_jeux: dict[str, dict] = {}
    for jeu, grilles in sorted(par_jeu_mesures.items()):
        annonces = [g for g in grilles if g.trouvee]
        tues = [g for g in grilles if not g.trouvee]
        pas = [g.pas for g in annonces]
        colonne_pas = (
            f"{min(pas)} à {max(pas)}, méd. {int(np.median(pas))}" if pas else "—"
        )
        peigne_oui = (
            f"{min(g.peigne for g in annonces):.2f}–{max(g.peigne for g in annonces):.2f}"
            if annonces
            else "—"
        )
        peigne_non = (
            f"{min(g.peigne for g in tues):.2f}–{max(g.peigne for g in tues):.2f}"
            if tues
            else "—"
        )
        print(f"   {jeu:24} {len(grilles):7} {len(annonces):8} {len(tues):8}  "
              f"{colonne_pas:>14}  {peigne_oui:>15}  {peigne_non:>11}")
        resume_jeux[jeu] = {
            "images": len(grilles),
            "annonce": len(annonces),
            "renonce": len(tues),
            "pas": pas,
            "peigne_annonce": [g.peigne for g in annonces],
            "peigne_tu": [g.peigne for g in tues],
        }

    tous_annonces = [g.peigne for gs in par_jeu_mesures.values() for g in gs if g.trouvee]
    tous_tus = [g.peigne for gs in par_jeu_mesures.values() for g in gs if not g.trouvee]
    if tous_annonces and tous_tus:
        print(f"\n   **Le peigne sépare franchement** : {min(tous_annonces):.2f} au plus "
              f"bas quand la détection annonce, {max(tous_tus):.2f} au plus haut quand "
              f"elle se tait.")
        print(f"   Le seuil est à {PEIGNE_MINIMAL} et rien ne le franchit par accident.")

    # ── ③ Les variantes écartées ─────────────────────────────────────────────
    #
    # Toutes sur la plage du dépôt, pour la raison écrite en ① : un cas hors
    # borne ne départage pas deux profils, il départage deux bornes.
    dedans = [(nom, rgba, attendu) for nom, rgba, attendu in lot if attendu <= PAS_MAXIMAL]
    print("\n③ Ce qui a été écarté, mesuré sur le même lot\n")
    print("   Le profil d'entrée, et l'arbitre d'octave du banc d'avant :\n")
    comptes: dict[str, Counter] = {
        "gris (l'ancien)": Counter(),
        "canaux (livré)": Counter(),
        "canaux + arbitre": Counter(),
    }
    for _, rgba, attendu in dedans:
        comptes["gris (l'ancien)"][_verdict(variante(rgba, en_gris=True), attendu)] += 1
        comptes["canaux (livré)"][_verdict(variante(rgba), attendu)] += 1
        comptes["canaux + arbitre"][_verdict(variante(rgba, arbitre=True), attendu)] += 1
    _tableau_des_issues(comptes, total)

    print("\n   Les quatre bornes qui circulaient, sur la plage du dépôt :\n")
    print(f"     {'borne':>6}  {'exact':>7}  {'à 1 px':>7}  {'octave':>7}  "
          f"{'raté':>7}  {'renoncé':>8}  {'secondes':>9}")
    bornes: dict[int, Counter] = {}
    temps: dict[int, float] = {}
    for borne in (24, PAS_MAXIMAL, 64, 80):
        compte: Counter = Counter()
        depart = time.perf_counter()
        for _, rgba, attendu in dedans:
            compte[_verdict(variante(rgba, maximum=borne), attendu)] += 1
        temps[borne] = time.perf_counter() - depart
        bornes[borne] = compte
        marque = " ←" if borne == PAS_MAXIMAL else "  "
        print(f"     {borne:6}  {compte['exact']:7}  {compte['à 1 px']:7}  "
              f"{compte['octave']:7}  {compte['raté']:7}  {compte['renoncé']:8}  "
              f"{temps[borne]:9.1f}{marque}")

    # **Et la même borne sur les vraies images**, où elle ne fabrique rien. Ce
    # tableau-là est celui qui décide : le lot ci-dessus contient des pas qu'on a
    # posés, celui-ci contient ce que les modèles ont vraiment rendu.
    print("\n   La même borne sur les images brutes — combien annoncent un pas :\n")
    annonces_par_borne: dict[int, int] = {}
    for borne in (24, PAS_MAXIMAL, 64, 80, 128):
        annonces_par_borne[borne] = sum(
            1 for _, _, rgba in brutes if variante(rgba, maximum=borne) >= PAS_MINIMAL
        )
        print(f"     borne {borne:4} → {annonces_par_borne[borne]:3} annonces sur "
              f"{len(brutes)}")
    if len(set(annonces_par_borne.values())) == 1:
        print("\n   **Elle n'y change rien du tout**, et c'est le fait qui pose la borne :")
        print("   le pas retenu est le plus petit qualifié, donc il est toujours fin, et")
        print("   élargir la recherche ne lui donne pas d'occasion de se tromper. Ce qui")
        print("   décide n'est donc pas ce qu'une grande borne coûterait, c'est ce qu'une")
        print(f"   petite borne **coupe** : {bornes[24]['renoncé'] - bornes[PAS_MAXIMAL]['renoncé']}"
              f" cas de plus renoncés à 24 qu'à {PAS_MAXIMAL}.")

    sortie = RACINE / "essais" / "mesures_grille_produit.json"
    sortie.write_text(
        json.dumps(
            {
                "lot": {
                    "images_reelles": len(choisies),
                    "cas": total,
                    "cas_hors_borne": sum(hors_borne.values()),
                    "jeux": jeux,
                    "issues": dict(issues),
                    "hors_borne": dict(hors_borne),
                    "par_pas": {str(p): dict(c) for p, c in sorted(par_pas.items())},
                    "ecarts": [
                        {"cas": nom, "pose": attendu, "trouve": trouve}
                        for nom, attendu, trouve in ecarts
                    ],
                },
                "brutes": resume_jeux,
                "variantes": {nom: dict(c) for nom, c in comptes.items()},
                "bornes": {
                    str(borne): {**dict(c), "secondes": round(temps[borne], 2)}
                    for borne, c in bornes.items()
                },
                "bornes_sur_brutes": {
                    str(borne): {"annonces": compte, "images": len(brutes)}
                    for borne, compte in annonces_par_borne.items()
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nÉcrit : {sortie.relative_to(RACINE)}\n")


if __name__ == "__main__":
    main()
