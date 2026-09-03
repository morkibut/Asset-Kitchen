# -*- coding: utf-8 -*-
"""Le banc de D4 — les moteurs de détourage, et les deux réparations du bord.

Écrit le 3 septembre 2026 en tenant `D4`. Il répond à cinq des critères de la
tranche, et il est **gratuit** : rien ne sort de la machine, aucune clé n'est
lue, aucun appel de fournisseur n'est fait.

**Ce qu'il mesure, dans l'ordre des critères du plan.**

1. **Les deux pièges d'intégration, vérifiés *avant* le premier modèle ajouté.**
   Le relevé d'outillage les signalait sans les avoir vus ; le plan exige donc
   qu'on les regarde en premier. Ils sont dans le code de `rembg`, installé sur
   cette machine, et ils se lisent :

   - **la normalisation ne divise pas par 255.** `BaseSession.normalize` fait
     `im_ary / max(np.max(im_ary), 1e-6)` — elle divise par **le maximum de
     l'image**, puis retranche la moyenne ImageNet. Deux images identiques dont
     l'une est plus sombre n'arrivent donc pas au modèle avec les mêmes valeurs ;
   - **le masque est réagrandi.** Toutes les sessions finissent par
     `mask.resize(img.size, LANCZOS)`. Ce qui change tout est **d'où** :
     `u2net` infère à 320 × 320, les autres à 1024 × 1024.

2. **Un modèle entraîné sur du dessin, comparé aux trois actuels** — `isnet-anime`,
   le seul du catalogue de `rembg` qui ne vienne pas de la photographie.

3. **L'allégé du modèle lourd, et l'écart contre ses 972 Mo** —
   `birefnet-general-lite`. ⚠️ **Il pèse 214 Mo et non 88,6**, pesé sur le disque
   le 3 septembre 2026 : le chiffre du plan et du relevé d'outillage est celui
   des poids PyTorch, pas de l'export ONNX que `rembg` rapatrie. Un quart du
   lourd, pas un onzième.

4. **Le défaut du moteur par modèle, tranché sur mesure** : `u2net` à 320 contre
   `isnet-general-use` à 1024, sur les mêmes images.

5. **Le rongement conditionnel contre l'érosion aveugle**, et **la
   décontamination** — les deux réparations de bord de la tranche, mesurées sur
   les images du dépôt.

**Il ne télécharge rien de lui-même**, et c'est la règle de son aîné
`essai_moteurs_silhouette.py` : un banc gratuit qui déclencherait quatre cents
mégaoctets ne serait plus un banc gratuit. Un modèle absent est **sauté et
annoncé**. `--descendre` le rapatrie, et il faut le taper.

    Lancer :  py essais/essai_moteurs_de_detourage.py
              py essais/essai_moteurs_de_detourage.py --descendre
                        rapatrie les modèles manquants depuis
                        github.com/danielgatis/rembg, et il annonce le poids
                        avant — la même règle que l'écran du produit

**Le corpus est celui de `essai_moteurs_silhouette.py`**, et c'est délibéré :
deux bancs qui comparent des détourages doivent se comparer entre eux.

── Ce que le banc a répondu le 3 septembre 2026, et deux réponses surprennent ──

| modèle | entrée | ms | part | trous | accord au défaut |
|---|---|---|---|---|---|
| `birefnet-general-lite` | 1024 | 12 058 | 0,214 | **4,8** | 0,993 |
| `isnet-anime` | 1024 | 1 578 | 0,213 | **2,2** | 0,979 |
| `u2net` | 320 | 894 | 0,219 | 2,5 | 0,977 |
| `isnet-general-use` | 1024 | 1 539 | 0,215 | 3,8 | — |
| `birefnet-general` | 1024 | 21 595 | 0,214 | 3,5 | 0,996 |

**La part gardée ne sépare rien** — cinq modèles à quatre millièmes près. Ce qui
sépare est **l'ajouré trouvé** : l'espace entre un bras et un torse, une boucle
de ceinture, une frange.

1. **Le modèle entraîné sur du dessin est le plus mauvais des cinq sur ce
   point-là**, et c'est l'inverse de ce que la tranche attendait. La raison se
   comprend après coup : `isnet-anime` apprend à découper *un personnage d'un
   seul tenant*, ce qui est le contraire de garder l'ajouré. Il trouve **un**
   trou là où les autres en trouvent trois à sept, et c'est celui qui s'écarte le
   plus de tous les autres — 0,925 d'accord au pire.
2. **L'allégé bat le lourd**, et de loin : plus d'ajouré, deux fois moins de
   temps, un quart du poids, et 99,5 % d'accord avec lui.
3. **Les « 95 % de pixels à demi transparents » ne viennent pas du
   réagrandissement.** `isnet-general-use`, qui infère à 1024 et ne réagrandit
   rien, en rend autant que `u2net` à 3 % près. C'est la sortie douce du modèle,
   et c'est le durcissement qui la tranche — comme il l'a toujours fait.

Sortie : ce journal, et `essais/mesures_moteurs_de_detourage.json`.
"""

from __future__ import annotations

import argparse
import inspect
import io
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))
sys.path.insert(0, str(RACINE))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.domaine.recette import Passe, Recette  # noqa: E402
from atelier.image.traitement import (  # noqa: E402
    SILHOUETTES,
    _couleur_enlevee,
    composantes,
    _detourer_modele,
    _tableau,
    decontaminer,
    detourer,
    detourer_bord,
    durcir,
    modele_descendu,
    pourtour,
    raison_moteur,
    ronger,
    ronger_conditionnel,
    silhouette,
)

from essai_moteurs_silhouette import corpus  # noqa: E402

SORTIE = RACINE / "mesures_moteurs_de_detourage.json"

#: Le défaut d'aujourd'hui, et son concurrent du critère 4. Écrits ici plutôt
#: que devinés du catalogue : c'est *cette comparaison-là* que le plan demande,
#: et elle doit rester lisible même si le catalogue grandit.
DEFAUT_ACTUEL = "u2net"
CANDIDAT_DEFAUT = "isnet-general-use"


# ── Les deux pièges d'intégration (critère 10) ───────────────────────────────


def piege_de_normalisation() -> dict:
    """**La normalisation divise-t-elle par ce qu'on croit ?** Non — vérifié.

    On lit le code installé plutôt que de le citer de mémoire : c'est la leçon
    de la tranche elle-même, dont la première version réclamait du travail déjà
    fait pour avoir recopié un relevé sans vérifier.
    """
    from rembg.sessions.base import BaseSession

    source = inspect.getsource(BaseSession.normalize)
    par_le_max = "np.max(im_ary)" in source
    return {
        "piege": "la normalisation divise par le maximum de l'image, pas par 255",
        "verifie": par_le_max,
        "ou": "rembg.sessions.base.BaseSession.normalize",
        "ligne": next(
            (l.strip() for l in source.splitlines() if "im_ary /" in l), ""
        ),
    }


def piege_du_reagrandissement() -> dict:
    """**Le masque est-il calculé à la taille de l'image ?** Pour un seul, non.

    Toutes les sessions de `rembg` réagrandissent leur masque en Lanczos ; ce
    qui les sépare est le côté auquel elles infèrent. `u2net` — notre défaut —
    part de 320.
    """
    from rembg.sessions.u2net import U2netSession

    source = inspect.getsource(U2netSession.predict)
    return {
        "piege": "le masque est calculé petit puis réagrandi en Lanczos",
        "verifie": "(320, 320)" in source and "Resampling.LANCZOS" in source,
        "ou": "rembg.sessions.u2net.U2netSession.predict",
        "entrees": {s.nom: s.entree for s in SILHOUETTES},
    }


def ce_que_la_normalisation_change(images: list[tuple[str, bytes]]) -> list[dict]:
    """**Le piège mord-il sur *nos* images ?** — la moitié qui compte.

    Diviser par le maximum de l'image est sans effet quand ce maximum vaut 255,
    et nos images sortent sur un fond clair. On le mesure au lieu de le
    supposer : le facteur est `255 / max`, et il dit de combien le modèle voit
    l'image plus claire qu'elle n'est.
    """
    releve: list[dict] = []
    for nom, octets in images:
        vue = Image.open(io.BytesIO(octets)).convert("RGB").resize(
            (320, 320), Image.Resampling.LANCZOS
        )
        maximum = int(np.asarray(vue).max())
        releve.append(
            {
                "image": nom,
                "max": maximum,
                "facteur": round(255 / max(maximum, 1), 4),
            }
        )
    return releve


# ── Ce qu'un masque vaut, avant tout durcissement ────────────────────────────


def _brut(octets: bytes) -> np.ndarray:
    return _tableau(octets)[:, :, :3]


def masque_de(octets: bytes, modele: str) -> np.ndarray:
    """Le masque **tel que le modèle le rend**, avant seuil et avant rongement.

    C'est le seul endroit où le second piège se voit : le produit durcit tout de
    suite, et un alpha durci ne dit plus rien de la façon dont il a été fabriqué.
    """
    return _detourer_modele(_brut(octets), modele)


def portrait_du_masque(alpha: np.ndarray) -> dict:
    """Cinq nombres qui disent ce qu'un masque vaut — **et aucun n'est une note**.

    `demi` compte les pixels ni franchement opaques ni franchement absents :
    c'est la trace du réagrandissement, et c'est ce que le durcissement tranche
    à pile ou face. `dedans` en compte la part qui tombe **à l'intérieur** du
    sujet, loin de son bord — celle-là n'est pas une frange, c'est du rebond de
    Lanczos, et elle n'a aucune raison d'exister.

    `pourtour` est la longueur du bord de la silhouette durcie : à part gardée
    égale, un pourtour plus long est un bord plus dentelé.
    """
    dur = durcir(alpha, 128) > 0
    demi = (alpha > 0) & (alpha < 255)
    # Loin du bord : cinq pixels à l'intérieur de la silhouette durcie.
    interieur = dur
    for _ in range(5):
        borde = np.pad(interieur, 1, constant_values=False)
        h, l = interieur.shape
        interieur = (
            borde[0:h, 1 : l + 1]
            & borde[2 : h + 2, 1 : l + 1]
            & borde[1 : h + 1, 0:l]
            & borde[1 : h + 1, 2 : l + 2]
        )
    # **Ce qu'un modèle trouve d'ajouré**, et c'est la mesure qui sépare
    # vraiment deux masques à part gardée égale : les morceaux détachés qu'il
    # voit, et les trous qu'il perce. Un modèle qui infère petit puis réagrandit
    # bouche les uns et fond les autres — c'est là que la perte se lit, pas dans
    # la part.
    morceaux = [aire for _, aire in composantes(dur) if aire >= 16]
    troues = [aire for _, aire in composantes(~dur) if aire >= 16]
    return {
        "part": round(float(dur.mean()), 4),
        "demi": int(demi.sum()),
        "demi_dedans": int((demi & interieur).sum()),
        "pourtour": int(pourtour(dur).sum()),
        "morceaux": len(morceaux),
        # Le dehors est une composante à lui seul : on ne compte donc que celles
        # qui ne touchent pas le cadre, c'est-à-dire les trous vrais.
        "trous": max(0, len(troues) - 1),
    }


def accord(un: np.ndarray, autre: np.ndarray) -> float:
    """L'intersection sur l'union de deux silhouettes durcies."""
    a, b = durcir(un, 128) > 0, durcir(autre, 128) > 0
    union = int((a | b).sum())
    return round(float((a & b).sum() / union), 4) if union else 1.0


# ── Les deux réparations de bord (critères 8 et 9) ───────────────────────────


def comparer_les_rongements(images: list[tuple[str, bytes]]) -> list[dict]:
    """**L'érosion aveugle contre le rongement conditionnel**, sur les images du dépôt.

    Le témoin est le moteur du bord et non un modèle : c'est celui que le produit
    emploie par défaut, celui qui a un fond plat à retirer, et le seul dont on
    puisse dire *ce qu'il a pris pour du fond* — ce que le rongement conditionnel
    a besoin de savoir.

    **Ce qu'on compare n'est pas « lequel retire le plus »** : le conditionnel
    retire un sous-ensemble, donc il retire toujours moins ou autant. Ce qu'on
    veut savoir est **combien il en épargne**, et si ce qu'il épargne est du
    sujet.
    """
    lignes: list[dict] = []
    for nom, octets in images:
        rgb = _brut(octets)
        alpha = durcir(np.minimum(255, detourer_bord(rgb, 28)), 128)
        fond = _couleur_enlevee(rgb, np.full(alpha.shape, np.uint8(255)), alpha)
        sujet = int((alpha > 0).sum())
        for crans in (1, 2):
            aveugle = int((ronger(alpha, crans) > 0).sum())
            conditionnel = int(
                (ronger_conditionnel(rgb, alpha, crans, fond) > 0).sum()
            )
            lignes.append(
                {
                    "image": nom,
                    "crans": crans,
                    "sujet": sujet,
                    "aveugle_garde": aveugle,
                    "conditionnel_garde": conditionnel,
                    "epargnes": conditionnel - aveugle,
                    "part_epargnee": round((conditionnel - aveugle) / max(sujet, 1), 4),
                }
            )
    return lignes


def mesurer_la_decontamination(images: list[tuple[str, bytes]]) -> list[dict]:
    """**Combien de pixels de bord la décontamination repeint, et de combien.**

    Un pixel repeint est un pixel dont la couleur venait du fond et qui reprend
    celle de son voisin intérieur. Le nombre seul ne suffit pas : on rapporte
    aussi l'écart moyen entre l'avant et l'après, parce que repeindre trois cents
    pixels d'un cheveu et repeindre trois cents pixels d'un demi-ton ne sont pas
    le même geste.
    """
    lignes: list[dict] = []
    for nom, octets in images:
        rgb = _brut(octets)
        alpha = durcir(np.minimum(255, detourer_bord(rgb, 28)), 128)
        fond = _couleur_enlevee(rgb, np.full(alpha.shape, np.uint8(255)), alpha)
        propre = decontaminer(rgb, alpha, fond, 28)
        change = np.abs(propre.astype(np.int16) - rgb.astype(np.int16)).max(axis=2) > 0
        ecarts = np.abs(propre.astype(np.int16) - rgb.astype(np.int16)).max(axis=2)
        lignes.append(
            {
                "image": nom,
                "bord": int(pourtour(alpha > 0).sum()),
                "repeints": int(change.sum()),
                "part_du_bord": round(
                    float(change.sum() / max(int(pourtour(alpha > 0).sum()), 1)), 4
                ),
                "ecart_moyen": round(float(ecarts[change].mean()), 1)
                if change.any()
                else 0.0,
            }
        )
    return lignes


# ── Le rapatriement, et il faut le taper ─────────────────────────────────────


def descendre(manquants: list[str]) -> None:
    """Rapatrie les modèles absents — **et il annonce le poids avant**.

    C'est la même règle que l'écran du produit : *poids annoncé avant le
    rapatriement*. Ce banc ne le fait jamais tout seul.
    """
    from rembg.session_factory import new_session

    total = sum(silhouette(n).octets for n in manquants if silhouette(n))
    print(f"  Rapatriement de {len(manquants)} modèle(s) — {total / 1_048_576:.0f} Mo")
    print("  Source : github.com/danielgatis/rembg/releases")
    for nom in manquants:
        sil = silhouette(nom)
        print(f"    · {nom} — {sil.octets / 1_048_576:.0f} Mo")
        new_session(nom)
    print()


def main() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    analyse = argparse.ArgumentParser()
    analyse.add_argument(
        "--descendre",
        action="store_true",
        help="rapatrie les modèles absents (~260 Mo) au lieu de les sauter",
    )
    options = analyse.parse_args()

    print("Banc des moteurs de détourage (D4) — gratuit, rien ne sort de la machine")
    print("=" * 78)
    print()

    releve: dict = {}

    # ── Les deux pièges, d'abord — le plan l'exige ───────────────────────────
    print("1 · Les deux pièges d'intégration, vérifiés avant tout le reste")
    print("-" * 78)
    absent = raison_moteur("modele")
    if absent is not None:
        print(f"  Rien à vérifier : {absent}.")
        return 0

    normalisation = piege_de_normalisation()
    reagrandissement = piege_du_reagrandissement()
    releve["pieges"] = [normalisation, reagrandissement]
    for piege in (normalisation, reagrandissement):
        marque = "CONFIRMÉ" if piege["verifie"] else "non retrouvé"
        print(f"  [{marque}] {piege['piege']}")
        print(f"            {piege['ou']}")
    print(f"            {normalisation['ligne']}")
    print("            entrées du catalogue : ", end="")
    print(
        ", ".join(f"{n} → {e}" for n, e in reagrandissement["entrees"].items())
    )
    print()

    images = corpus()
    if not images:
        print("  Aucune image du corpus sur cette machine.")
        return 0

    facteurs = ce_que_la_normalisation_change(images)
    releve["normalisation_sur_nos_images"] = facteurs
    pire = max(facteurs, key=lambda f: f["facteur"])
    print("  Ce que ça change sur nos images :")
    for f in facteurs:
        print(f"    · {f['image']} — max {f['max']}, facteur {f['facteur']}")
    print(
        f"  Verdict : le facteur le plus fort est {pire['facteur']} "
        f"({pire['image']})."
    )
    print()

    # ── Les modèles ──────────────────────────────────────────────────────────
    presents = [s.nom for s in SILHOUETTES if modele_descendu(s.nom)]
    manquants = [s.nom for s in SILHOUETTES if not modele_descendu(s.nom)]
    if manquants and options.descendre:
        descendre(manquants)
        presents = [s.nom for s in SILHOUETTES if modele_descendu(s.nom)]
        manquants = [s.nom for s in SILHOUETTES if not modele_descendu(s.nom)]

    print("2 · Ce que chaque modèle rend, sur les mêmes images")
    print("-" * 78)
    for nom in manquants:
        sil = silhouette(nom)
        print(
            f"  sauté · {nom} — pas encore descendu ({sil.octets / 1_048_576:.0f} Mo)."
            "  --descendre le rapatrie."
        )
    if manquants:
        print()

    portraits: list[dict] = []
    accords: list[dict] = []
    for nom_image, octets in images:
        masques: dict[str, np.ndarray] = {}
        for nom in presents:
            depart = time.perf_counter()
            masques[nom] = masque_de(octets, nom)
            duree = (time.perf_counter() - depart) * 1000
            sil = silhouette(nom)
            portraits.append(
                {
                    "image": nom_image,
                    "modele": nom,
                    "entree": sil.entree,
                    "ms": round(duree, 1),
                    **portrait_du_masque(masques[nom]),
                }
            )
        for i, un in enumerate(presents):
            for autre in presents[i + 1 :]:
                accords.append(
                    {
                        "image": nom_image,
                        "entre": [un, autre],
                        "accord": accord(masques[un], masques[autre]),
                    }
                )
    releve["modeles"] = portraits
    releve["accords"] = accords

    entete = (
        f"  {'modèle':<24}{'entrée':>7}{'ms':>8}{'part':>8}{'demi':>9}"
        f"{'dedans':>8}{'bord':>8}{'morc.':>7}{'trous':>7}"
    )
    print(entete)
    for nom in presents:
        lus = [p for p in portraits if p["modele"] == nom]
        if not lus:
            continue
        moy = lambda cle: sum(p[cle] for p in lus) / len(lus)  # noqa: E731
        print(
            f"  {nom:<24}{lus[0]['entree']:>7}{moy('ms'):>8.0f}"
            f"{moy('part'):>8.3f}{moy('demi'):>9.0f}{moy('demi_dedans'):>8.0f}"
            f"{moy('pourtour'):>8.0f}{moy('morceaux'):>7.1f}{moy('trous'):>7.1f}"
        )
    print()
    print("  demi   = pixels ni opaques ni absents, la trace du réagrandissement")
    print("  dedans = ceux d'entre eux qui tombent loin du bord — du rebond, pas une frange")
    print("  bord   = longueur du pourtour ; à part égale, plus long = plus dentelé")
    print("  morc.  = morceaux détachés d'au moins 16 px · trous = trous percés")
    print()

    # ── Le verdict sur le défaut (critère 4) ─────────────────────────────────
    print("3 · Le défaut du moteur par modèle — 320 contre 1024")
    print("-" * 78)
    if DEFAUT_ACTUEL in presents and CANDIDAT_DEFAUT in presents:
        deux = {
            nom: [p for p in portraits if p["modele"] == nom]
            for nom in (DEFAUT_ACTUEL, CANDIDAT_DEFAUT)
        }
        verdict = {
            nom: {
                cle: round(sum(p[cle] for p in lus) / len(lus), 3)
                for cle in (
                    "ms",
                    "part",
                    "demi",
                    "demi_dedans",
                    "pourtour",
                    "morceaux",
                    "trous",
                )
            }
            for nom, lus in deux.items()
        }
        releve["verdict_defaut"] = verdict
        for nom, lu in verdict.items():
            print(
                f"  {nom:<24} {lu['ms']:>7.0f} ms  part {lu['part']:.3f}  "
                f"demi {lu['demi']:.0f}  dont dedans {lu['demi_dedans']:.0f}  "
                f"bord {lu['pourtour']:.0f}  morceaux {lu['morceaux']:.1f}  "
                f"trous {lu['trous']:.1f}"
            )
        accord_deux = [
            a["accord"]
            for a in accords
            if set(a["entre"]) == {DEFAUT_ACTUEL, CANDIDAT_DEFAUT}
        ]
        if accord_deux:
            print(
                f"  accord des deux silhouettes : "
                f"{sum(accord_deux) / len(accord_deux):.3f}"
            )
    else:
        print("  Les deux modèles ne sont pas tous deux sur cette machine.")
    print()

    # ── Les deux réparations de bord ─────────────────────────────────────────
    print("4 · Le rongement conditionnel contre l'érosion aveugle")
    print("-" * 78)
    rongements = comparer_les_rongements(images)
    releve["rongements"] = rongements
    print(f"  {'image':<30}{'crans':>6}{'aveugle':>10}{'conditionnel':>14}{'épargnés':>10}")
    for ligne in rongements:
        print(
            f"  {ligne['image'][:29]:<30}{ligne['crans']:>6}"
            f"{ligne['aveugle_garde']:>10}{ligne['conditionnel_garde']:>14}"
            f"{ligne['epargnes']:>10}"
        )
    total_epargne = sum(l["epargnes"] for l in rongements)
    print(f"  Le conditionnel épargne {total_epargne} pixels de sujet en tout.")
    print()

    print("5 · La décontamination du bord")
    print("-" * 78)
    decontaminations = mesurer_la_decontamination(images)
    releve["decontamination"] = decontaminations
    print(f"  {'image':<30}{'bord':>8}{'repeints':>10}{'part':>8}{'écart':>8}")
    for ligne in decontaminations:
        print(
            f"  {ligne['image'][:29]:<30}{ligne['bord']:>8}{ligne['repeints']:>10}"
            f"{ligne['part_du_bord']:>8.3f}{ligne['ecart_moyen']:>8.1f}"
        )
    print()

    SORTIE.write_text(
        json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Relevé écrit dans {SORTIE.relative_to(RACINE.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
