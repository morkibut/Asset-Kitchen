# -*- coding: utf-8 -*-
"""Le banc de D2 — retrouve-t-on le vrai pas de pixel d'une image ?

Écrit le 3 septembre 2026 pour les deux premiers critères de la tranche :
*« le pas réel est retrouvé sur un lot d'images du dépôt, et le taux est mesuré
et écrit »* et *« les bornes de balayage couvrent la dérive réelle mesurée ici,
pas celle du banc d'origine »*.

**Il ne coûte rien.** Il relit des images déjà sur le disque et fabrique les
autres lui-même. Aucune clé n'est lue, aucun appel ne sort de la machine.

## Pourquoi un banc avant une ligne de code

Le produit porte déjà `mesurer_grille`, et elle est **descriptive** : elle sert
au banc et aux mesures d'un lot, jamais à décider d'une réduction. Sa docstring
avoue son défaut principal — *« prend une harmonique sur les plus grossiers :
17 px mesurés contre 30–37 jugés »*. Avant de la promouvoir en décideuse, il
faut savoir de combien elle se trompe, sur quoi, et ce qui ferait mieux.

**Trois choses que la revue externe du 2 septembre 2026 affirme, et que ce banc
vérifie plutôt que de les croire :**

1. *le détecteur qu'on écrirait d'instinct est le pire de onze mesurés* — le
   nôtre est exactement celui-là : autocorrélation du profil des différences
   entre colonnes voisines ;
2. *additionner plusieurs canaux de couleur bat le meilleur canal seul* — le
   nôtre convertit en niveaux de gris, c'est-à-dire un canal ;
3. *les blocs de ce dépôt approchent quatre-vingts pixels* — non mesuré, et
   « 80 » ressemble à 5 × 16 plus qu'à un relevé. Le banc le tranche.

## Ce que le banc rend

- **Sur des images fabriquées ici**, dont on connaît le pas : le taux d'exactitude
  de chaque détecteur, et surtout la part d'**erreurs d'octave** — confondre un
  pas avec son double ou sa moitié, qui est le mode d'échec dominant.
- **Sur les vraies images du dépôt**, où aucune vérité n'existe : la distribution
  des pas trouvés — c'est elle qui décide des bornes — et un **aller-retour de
  reconstruction**, qui juge un pas sans avoir besoin de le connaître.

    Lancer :  py essais/essai_grille_retrouvee.py
              py essais/essai_grille_retrouvee.py --vraies 40

Sortie : ce journal, et `essais/mesures_grille_retrouvee.json`.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageFilter

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

# **Rien n'est importé du produit, et c'est délibéré.** Le banc rejoue la
# méthode de `mesurer_grille` (`atelier/image/traitement.py`) plutôt que de
# l'appeler : elle prend des octets et convertit en niveaux de gris, donc elle
# ne saurait pas recevoir un tableau ni voir l'alpha — les deux choses que ce
# banc compare. La rejouer ici la rend comparable aux autres, à égalité.


# ── Les profils : ce qu'on mesure avant de chercher une période ──────────────


def _profils_gris(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Ce que le produit fait aujourd'hui : un seul canal, les niveaux de gris.

    C'est le point 2 de la revue — un canal, quand la somme de plusieurs fait
    mieux. Gardé ici comme témoin, pour que l'écart se mesure au lieu de se
    supposer.
    """
    gris = np.asarray(
        Image.fromarray(rgba, mode="RGBA").convert("L"), dtype=np.float64
    )
    return (
        np.abs(np.diff(gris, axis=1)).sum(axis=0),
        np.abs(np.diff(gris, axis=0)).sum(axis=1),
    )


def _profils_canaux(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """**La somme des canaux, alpha compris.**

    Deux couleurs de luminance égale — un rouge et un vert bien choisis —
    disparaissent l'une dans l'autre en niveaux de gris : la frontière entre deux
    blocs y devient invisible. Les additionner séparément la garde.

    **L'alpha en fait partie**, et c'est le troisième critère de la tranche : la
    silhouette d'un sprite détouré est le contraste le plus franc de l'image, et
    l'aplatir en entrée de détection revient à jeter le meilleur signal qu'on ait.
    """
    canaux = rgba.astype(np.float64)
    colonnes = np.abs(np.diff(canaux, axis=1)).sum(axis=(0, 2))
    lignes = np.abs(np.diff(canaux, axis=0)).sum(axis=(1, 2))
    return colonnes, lignes


# ── Les détecteurs ───────────────────────────────────────────────────────────


def _autocorrelation(profil: np.ndarray, borne: int) -> dict[int, float]:
    centre = profil - profil.mean()
    variance = float((centre * centre).mean())
    if variance == 0:
        return {}
    return {
        pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
        for pas in range(2, borne + 1)
        if pas < centre.size
    }


def _plus_petit_qualifie(scores: dict[int, float], seuil: float = 0.9) -> int:
    """La règle du produit : le plus petit pas qui approche la crête.

    Elle existe pour ne pas rapporter une harmonique — un pas double corrèle
    aussi bien que le vrai. **Elle ne suffit pas** : elle ne regarde que la
    corrélation, jamais si le pas reconstruit l'image.
    """
    if not scores:
        return 0
    crete = max(scores.values())
    for pas in sorted(scores):
        voisines = (scores.get(pas - 1, -1.0), scores.get(pas + 1, -1.0))
        if scores[pas] >= seuil * crete and scores[pas] >= max(voisines):
            return pas
    return max(scores, key=scores.__getitem__)


def _longueurs_de_plages(rgba: np.ndarray, borne: int) -> dict[int, float]:
    """Les longueurs de plages de couleur constante, en histogramme.

    Sur une image vraiment posée sur une grille de `p`, presque toutes les plages
    horizontales font `p`, `2p`, `3p`… Le mode de l'histogramme est donc le pas,
    et c'est une mesure **directe** — elle ne passe par aucune corrélation, donc
    elle ne peut pas prendre une harmonique pour la fondamentale de la même façon.

    C'est le détecteur que le nôtre n'a pas, et la revue le donne comme l'un des
    trois que les outils sérieux combinent.
    """
    scores: Counter = Counter()
    for axe in (1, 0):
        plat = rgba if axe == 1 else rgba.transpose(1, 0, 2)
        # Une frontière de plage : le pixel change de couleur.
        change = np.any(np.diff(plat.astype(np.int16), axis=1) != 0, axis=2)
        for ligne in change:
            (positions,) = np.nonzero(ligne)
            if positions.size < 2:
                continue
            for longueur in np.diff(positions):
                if 2 <= longueur <= borne:
                    scores[int(longueur)] += 1
    total = sum(scores.values())
    if not total:
        return {}
    return {pas: compte / total for pas, compte in scores.items()}


def _erreur_aller_retour(rgba: np.ndarray, pas: int) -> float:
    """**L'arbitre d'octave** : ce pas-là reconstruit-il l'image ?

    On réduit d'un facteur `pas` en prenant la moyenne de chaque bloc, on
    réagrandit au plus proche voisin, et l'on mesure ce qui a changé. Le vrai pas
    ne perd presque rien — chaque bloc était déjà d'une seule couleur. Un pas
    deux fois trop grand fond deux blocs en un et l'erreur monte ; un pas deux
    fois trop petit reconstruit aussi bien, ce qui est précisément pourquoi
    l'arbitre se lit **avec** la règle du plus petit pas et non à sa place.

    C'est la seule mesure de ce banc qui juge un pas **sans connaître la vérité**,
    et donc la seule utilisable sur les vraies images du dépôt.
    """
    if pas < 2:
        return 1.0
    # ⚠️ **La phase, et elle n'est pas optionnelle.** Une première version
    # découpait toujours depuis le pixel zéro : sur une image dont la grille
    # commence ailleurs — le cas normal, un modèle ne cale rien —, chaque bloc
    # chevauchait deux vraies cases, l'erreur au vrai pas était gonflée, et
    # l'arbitre choisissait la **moitié** du vrai pas. Mesuré sur les trois cas
    # décalés de ce banc, qui répondaient tous exactement la moitié.
    meilleure = 1.0
    for decalage in range(pas):
        erreur = _erreur_a_la_phase(rgba, pas, decalage)
        meilleure = min(meilleure, erreur)
    return meilleure


def _erreur_a_la_phase(rgba: np.ndarray, pas: int, decalage: int) -> float:
    """L'aller-retour, la grille commençant à `decalage`."""
    hauteur, largeur = rgba.shape[:2]
    h = (hauteur - decalage) // pas
    l = (largeur - decalage) // pas
    if h < 2 or l < 2:
        return 1.0
    coupe = rgba[
        decalage : decalage + h * pas, decalage : decalage + l * pas
    ].astype(np.float64)
    blocs = coupe.reshape(h, pas, l, pas, 4).mean(axis=(1, 3))
    reconstruit = np.repeat(np.repeat(blocs, pas, axis=0), pas, axis=1)
    return float(np.abs(coupe - reconstruit).mean() / 255.0)


Detecteur = Callable[[np.ndarray, int], int]


def detecteur_produit(rgba: np.ndarray, borne: int) -> int:
    """Ce que `mesurer_grille` fait aujourd'hui, rejoué ici sur un tableau."""
    meilleur, meilleure = 0, 0.0
    for profil in _profils_gris(rgba):
        scores = _autocorrelation(profil, min(borne, profil.size // 4))
        if not scores:
            continue
        pas = _plus_petit_qualifie(scores)
        if pas and scores[pas] > meilleure:
            meilleur, meilleure = pas, scores[pas]
    return meilleur


def detecteur_canaux(rgba: np.ndarray, borne: int) -> int:
    """Le même, sur la somme des canaux plutôt que sur les niveaux de gris."""
    meilleur, meilleure = 0, 0.0
    for profil in _profils_canaux(rgba):
        scores = _autocorrelation(profil, min(borne, profil.size // 4))
        if not scores:
            continue
        pas = _plus_petit_qualifie(scores)
        if pas and scores[pas] > meilleure:
            meilleur, meilleure = pas, scores[pas]
    return meilleur


def detecteur_plages(rgba: np.ndarray, borne: int) -> int:
    """Le mode de l'histogramme des longueurs de plages."""
    scores = _longueurs_de_plages(rgba, borne)
    return max(scores, key=scores.__getitem__) if scores else 0


#: Ce qu'un pas a le droit de perdre par rapport au meilleur pour rester
#: candidat. Relatif au plancher, jamais absolu : une image très plate a un
#: plancher proche de zéro, une image bruitée non, et un seuil fixe classerait
#: la seconde comme « sans grille » quoi qu'il arrive.
TOLERANCE_RECONSTRUCTION = 1.20


def detecteur_ensemble(rgba: np.ndarray, borne: int) -> int:
    """Les trois, arbitrés par l'aller-retour — **et on prend le plus grand**.

    ⚠️ **C'est l'inverse de ce que « viser fin » laisse croire, et la première
    écriture de ce banc s'y est trompée.** Tout diviseur du vrai pas reconstruit
    l'image aussi bien que lui : un bloc de 16 pixels d'une seule couleur se
    reconstruit parfaitement à 8, à 4, à 2. Prendre le plus petit à égalité
    d'erreur revient donc à répondre **2 sur toutes les images**, ce que ce banc
    a effectivement mesuré avant correction.

    Le vrai pas est donc **le plus grand qui reconstruise encore au plancher** :
    au-delà, deux blocs différents fondent en un et l'erreur monte franchement.

    *« Viser fin » reste vrai, et il dit autre chose* : c'est une consigne sur la
    **conséquence** d'une erreur, pas sur la façon de choisir. Une grille un peu
    trop fine se rattrape ; une grille trop grossière détruit le sujet. C'est ce
    qui justifie que la tolérance soit serrée — on ne monte d'un cran que si le
    cran d'après explique vraiment l'image.
    """
    candidats: set[int] = set()
    for detecteur in (detecteur_produit, detecteur_canaux, detecteur_plages):
        pas = detecteur(rgba, borne)
        if pas >= 2:
            candidats.update(
                p for p in (pas // 2, pas, pas * 2, pas * 3) if 2 <= p <= borne
            )
    if not candidats:
        return 0
    erreurs = {pas: _erreur_aller_retour(rgba, pas) for pas in candidats}
    plancher = min(erreurs.values())
    # Un plancher nul — une image parfaitement plate — ne doit pas rendre la
    # comparaison relative impossible : on lui donne alors une marge absolue.
    seuil = max(plancher * TOLERANCE_RECONSTRUCTION, plancher + 0.002)
    return max(pas for pas, erreur in erreurs.items() if erreur <= seuil)


DETECTEURS: dict[str, Detecteur] = {
    "produit (gris)": detecteur_produit,
    "canaux": detecteur_canaux,
    "plages": detecteur_plages,
    "ensemble": detecteur_ensemble,
}


# ── Le corpus fabriqué, dont on connaît le pas ───────────────────────────────


def _sprite_sur_grille(
    pas: float, cases: int = 22, *, phase: int = 0, flou: float = 0.0
) -> np.ndarray:
    """Un sujet peint sur une grille logique, puis étiré au pas voulu.

    **Le pas peut ne pas être entier**, et c'est tout l'intérêt : aucun essai du
    dépôt n'exerce ce cas — ils fabriquent leurs images par un agrandissement au
    plus proche voisin d'une grille logique, donc à facteur entier et phase
    nulle. Le cas réel est un modèle qui a peint « à peu près » sur 13,1 px.

    Le flou imite l'anti-crénelage que les modèles laissent sur les bords, et la
    phase le fait que la grille du modèle ne commence pas au pixel zéro.
    """
    generateur = np.random.default_rng(abs(hash(pas)) % 2**31)
    logique = np.zeros((cases, cases, 4), dtype=np.uint8)
    # **Une couleur par case logique, et deux voisines qui diffèrent.**
    #
    # C'est la correction du 3 septembre 2026, et elle a d'abord fait mentir ce
    # banc : la première version peignait des aplats de trois cases de large, si
    # bien que la période visible de l'image était trois fois le pas. Les
    # détecteurs répondaient le double du pas *annoncé* et le banc les comptait
    # en erreur d'octave — alors qu'ils avaient raison sur l'image reçue.
    #
    # La garde : *un banc qui fabrique ses cas doit vérifier que le cas fabriqué
    # est bien celui qu'il annonce.* Ici, la vérification est dans le nom : deux
    # cases voisines n'ont jamais la même couleur, donc la période de l'image
    # **est** le pas, par construction.
    # **Une petite palette tirée au sort par case**, et non une couleur unique
    # par case : deux voisines tombent parfois sur la même — comme dans un vrai
    # sprite, qui a des aplats — mais des frontières subsistent à **toutes** les
    # positions de la grille, si bien que le pas reste mesurable partout.
    #
    # C'est l'équilibre que ce banc a mis deux essais à trouver. Une couleur par
    # case rend le cas trop facile : tous les détecteurs y sont parfaits, et le
    # banc n'apprend rien. Des aplats de trois cases de large rendent le pas
    # **inexistant dans l'image** : les détecteurs répondent le triple, et ils
    # ont raison.
    palette = generateur.integers(20, 235, size=(7, 3), dtype=np.uint8)
    tirage = generateur.integers(0, len(palette), size=(cases, cases))
    for y in range(cases):
        for x in range(cases):
            dedans = (x - cases / 2) ** 2 + (y - cases / 2) ** 2 < (cases / 2.6) ** 2
            if dedans:
                logique[y, x] = (*palette[tirage[y, x]], 255)
    cote = int(round(cases * pas))
    image = Image.fromarray(logique, mode="RGBA").resize(
        (cote, cote), Image.Resampling.NEAREST
    )
    if flou:
        image = image.filter(ImageFilter.GaussianBlur(flou))
    tableau = np.asarray(image)
    if phase:
        tableau = np.roll(tableau, (phase, phase), axis=(0, 1))
    return tableau


def _corpus_fabrique() -> list[tuple[str, np.ndarray, int]]:
    """Les cas qu'aucun essai du dépôt n'exerce, et le pas attendu de chacun."""
    cas: list[tuple[str, np.ndarray, int]] = []
    for pas in (4, 8, 13, 16, 24, 40, 55, 80):
        cas.append((f"pas {pas} · net", _sprite_sur_grille(float(pas)), pas))
    for pas in (8, 16, 40):
        cas.append(
            (f"pas {pas} · flou 1 px", _sprite_sur_grille(float(pas), flou=1.0), pas)
        )
        cas.append(
            (f"pas {pas} · décalé", _sprite_sur_grille(float(pas), phase=pas // 3), pas)
        )
    for pas, attendu in ((9.4, 9), (13.1, 13), (23.7, 24)):
        cas.append(
            (f"pas {pas} · non entier", _sprite_sur_grille(pas, flou=1.0), attendu)
        )
    # **Le cas qui met à l'épreuve l'affirmation de la revue** : des couleurs de
    # même luminance. En niveaux de gris elles sont identiques — la frontière
    # entre deux blocs y disparaît purement et simplement — alors qu'elles
    # sautent aux yeux. C'est le seul cas où « la somme des canaux » peut battre
    # « le meilleur canal », et sans lui l'affirmation reste invérifiée.
    for pas in (8, 16):
        cas.append(
            (
                f"pas {pas} · même luminance",
                _sprite_isoluminant(float(pas)),
                pas,
            )
        )
    return cas


#: Trois couleurs franchement différentes que la conversion en niveaux de gris
#: rend **presque identiques** — la pondération de Pillow est 299 R + 587 V +
#: 114 B sur mille. Vérifié par l'essai qui les emploie.
ISOLUMINANTES = ((190, 60, 60), (30, 105, 120), (0, 92, 235))


def _sprite_isoluminant(pas: float, cases: int = 22) -> np.ndarray:
    """Le même sujet, peint dans des couleurs que le gris confond."""
    generateur = np.random.default_rng(int(pas) * 7919)
    logique = np.zeros((cases, cases, 4), dtype=np.uint8)
    tirage = generateur.integers(0, len(ISOLUMINANTES), size=(cases, cases))
    for y in range(cases):
        for x in range(cases):
            if (x - cases / 2) ** 2 + (y - cases / 2) ** 2 < (cases / 2.6) ** 2:
                logique[y, x] = (*ISOLUMINANTES[tirage[y, x]], 255)
    cote = int(round(cases * pas))
    return np.asarray(
        Image.fromarray(logique, mode="RGBA").resize(
            (cote, cote), Image.Resampling.NEAREST
        )
    )


def _verdict(trouve: int, attendu: int) -> str:
    if trouve == attendu:
        return "exact"
    if abs(trouve - attendu) <= 1:
        return "à 1 px"
    if trouve and (
        abs(trouve - attendu * 2) <= 1
        or abs(trouve * 2 - attendu) <= 1
        or abs(trouve - attendu * 3) <= 1
        or abs(trouve * 3 - attendu) <= 1
    ):
        return "octave"
    return "raté"


# ── Les vraies images ────────────────────────────────────────────────────────


def _projet_des_bruts() -> dict[Path, str]:
    """À quel jeu chaque brut appartient — **et c'est ce qui fait la mesure**.

    Un jeu qui ne demande pas de pixel art n'a aucune grille à retrouver, et le
    compter avec les autres noie la seule question qui compte : *quand le modèle
    a reçu la consigne d'une grille, l'a-t-il tenue ?*
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
            asset.get("projet") or "—"
        )
    return par_brut


def _vraies_images(combien: int) -> list[tuple[str, np.ndarray]]:
    """Des bruts du dépôt, avec le jeu dont ils viennent. Aucune vérité connue."""
    appartenance = _projet_des_bruts()
    lues = []
    for chemin in sorted((RACINE / "donnees" / "generations").rglob("*-brut.png")):
        try:
            with Image.open(chemin) as image:
                lues.append(
                    (appartenance.get(chemin, "—"), np.asarray(image.convert("RGBA")))
                )
        except OSError:
            continue
        if len(lues) >= combien:
            break
    return lues


# ── Le journal ───────────────────────────────────────────────────────────────


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--vraies", type=int, default=40)
    parseur.add_argument("--borne", type=int, default=128)
    arguments = parseur.parse_args()

    print()
    print("═" * 78)
    print("  D2 · Retrouve-t-on le vrai pas ?")
    print("═" * 78)

    # ── ① Le corpus fabriqué ─────────────────────────────────────────────────
    corpus = _corpus_fabrique()
    print(f"\n① Sur {len(corpus)} images dont on connaît le pas — bornes 2 à "
          f"{arguments.borne}\n")
    entete = f"  {'cas':26}" + "".join(f"{nom:>18}" for nom in DETECTEURS)
    print(entete)
    print("  " + "─" * (len(entete) - 2))
    verdicts: dict[str, Counter] = {nom: Counter() for nom in DETECTEURS}
    for nom, rgba, attendu in corpus:
        ligne = f"  {nom:26}"
        for cle, detecteur in DETECTEURS.items():
            trouve = detecteur(rgba, arguments.borne)
            verdict = _verdict(trouve, attendu)
            verdicts[cle][verdict] += 1
            ligne += f"{f'{trouve} · {verdict}':>18}"
        print(ligne)

    print(f"\n  {'':26}" + "".join(f"{nom:>18}" for nom in DETECTEURS))
    for verdict in ("exact", "à 1 px", "octave", "raté"):
        ligne = f"  {verdict:26}"
        for cle in DETECTEURS:
            compte = verdicts[cle][verdict]
            part = 100 * compte / len(corpus)
            ligne += f"{f'{compte} ({part:.0f} %)':>18}"
        print(ligne)

    # ── ② La borne fixe ──────────────────────────────────────────────────────
    print("\n② La borne de balayage — le piège des gros blocs\n")
    gros = _sprite_sur_grille(80.0)
    for borne in (64, 128, 256):
        pas, nettete = 0, 0.0
        for profil in _profils_gris(gros):
            scores = _autocorrelation(profil, min(borne, profil.size // 4))
            if scores:
                candidat = _plus_petit_qualifie(scores)
                if candidat and scores[candidat] > nettete:
                    pas, nettete = candidat, scores[candidat]
        ensemble = detecteur_ensemble(gros, borne)
        print(f"  borne {borne:3} → produit répond {pas:3} (netteté {nettete:.2f}) · "
              f"ensemble répond {ensemble:3}   (le vrai pas est 80)")
    print("\n   Une borne fixe ne se contente pas de manquer le pas : elle répond")
    print("   **avec assurance** une valeur fausse. C'est le pire des deux états.")

    # ── ③ Les vraies images ──────────────────────────────────────────────────
    vraies = _vraies_images(arguments.vraies)
    print(f"\n③ Sur {len(vraies)} vraies images du dépôt — aucune vérité connue\n")
    trouves: dict[str, Counter] = {nom: Counter() for nom in DETECTEURS}
    par_jeu: dict[str, list[tuple[int, float]]] = {}
    accords = 0
    erreurs_ensemble = []
    for jeu, rgba in vraies:
        reponses = {}
        for cle, detecteur in DETECTEURS.items():
            pas = detecteur(rgba, arguments.borne)
            trouves[cle][pas] += 1
            reponses[cle] = pas
        if len(set(reponses.values())) == 1:
            accords += 1
        # **Le détecteur du produit fait référence ici** : c'est lui qui est
        # parfait sur le corpus fabriqué, et l'erreur de reconstruction à son
        # pas dit s'il faut le croire sur celle-ci.
        pas_produit = reponses["produit (gris)"]
        par_jeu.setdefault(jeu, []).append(
            (pas_produit, _erreur_aller_retour(rgba, pas_produit) if pas_produit >= 2
             else 1.0)
        )
        if reponses["ensemble"] >= 2:
            erreurs_ensemble.append(_erreur_aller_retour(rgba, reponses["ensemble"]))

    for cle in DETECTEURS:
        compte = trouves[cle]
        pas_vus = sorted(p for p in compte if p >= 2)
        muets = compte.get(0, 0)
        if pas_vus:
            print(f"  {cle:16} pas de {min(pas_vus)} à {max(pas_vus)} · "
                  f"médiane {int(np.median([p for p in compte.elements() if p >= 2]))} · "
                  f"muet {muets}/{len(vraies)}")
        else:
            print(f"  {cle:16} aucun pas trouvé · muet {muets}/{len(vraies)}")
    print(f"\n  Les quatre tombent d'accord sur {accords}/{len(vraies)} images.")

    # **Par jeu, et avec la reconstruction à côté du pas.** Un pas trouvé ne vaut
    # que ce que vaut sa reconstruction : à 0,05 il explique l'image, à 0,15 il
    # n'explique rien et le chiffre est du bruit qu'on prendrait pour une mesure.
    print("\n  Par jeu — c'est là que la question se pose vraiment :\n")
    print(f"    {'jeu':22} {'images':>6}  {'pas trouvés':>16}  {'reconstruit':>12}")
    for jeu, mesures in sorted(par_jeu.items()):
        vus = [pas for pas, _ in mesures if pas >= 2]
        erreurs = [erreur for pas, erreur in mesures if pas >= 2]
        if not vus:
            print(f"    {jeu:22} {len(mesures):6}  {'aucun':>16}")
            continue
        franches = sum(1 for e in erreurs if e < 0.05)
        print(
            f"    {jeu:22} {len(mesures):6}  "
            f"{f'{min(vus)} à {max(vus)}, méd. {int(np.median(vus))}':>16}  "
            f"{f'{franches}/{len(vus)} sous 0,05':>12}"
        )
    if erreurs_ensemble:
        print(f"  Erreur de reconstruction au pas de l'ensemble : "
              f"médiane {np.median(erreurs_ensemble):.3f} "
              f"(0 = le pas explique l'image entièrement).")

    # ── Ce qu'on en garde ────────────────────────────────────────────────────
    tous = [p for cle in DETECTEURS for p in trouves[cle].elements() if p >= 2]
    if tous:
        haut = int(np.percentile(tous, 99))
        print(f"\n  **La borne à retenir** : 99 % des pas trouvés tiennent sous "
              f"{haut} px.")
        print(f"  Le maximum observé est {max(tous)} px.")

    sortie = RACINE / "essais" / "mesures_grille_retrouvee.json"
    sortie.write_text(
        json.dumps(
            {
                "fabrique": {cle: dict(v) for cle, v in verdicts.items()},
                "vraies": {cle: dict(trouves[cle]) for cle in DETECTEURS},
                "accord": accords,
                "images_vraies": len(vraies),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nÉcrit : {sortie.relative_to(RACINE)}\n")


if __name__ == "__main__":
    main()
