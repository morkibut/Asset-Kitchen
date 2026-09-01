# -*- coding: utf-8 -*-
"""L'adaptateur Pollinations, contre le vrai fournisseur. **Gratuit.**

Arrivé avec F1. `essai_fournisseurs.py` mesure ce que les fournisseurs *font* ;
celui-ci vérifie ce que **l'adaptateur du dépôt** en fait — c'est-à-dire la seule
phrase que la tranche promet et qu'aucun essai à double ne peut prouver : *sans
compte, sans clé, sans carte, on écrit un sujet et une image arrive.*

    py essais/essai_pollinations.py

**Deux appels au plus, un jeton chacun, aucun dollar.** Le palier sans compte
n'accepte qu'un appel toutes les quinze secondes ; ils sont donc espacés, et
l'attente fait partie de la mesure.

Ce qu'il vérifie, dans l'ordre :

1. le catalogue se relit chez lui, et ses modèles portent son nom ;
2. une image revient, et **c'est bien le modèle demandé qui l'a faite** — le
   défaut mesuré le 31 août : ce fournisseur en substitue un autre en silence ;
3. les dimensions **mesurées** sont celles qu'on lit, jamais celles demandées ;
4. **ce que l'appel a consommé est lu chez lui**, dans son unité — arrivé avec
   F2, et c'est le seul essai du dépôt qui regarde l'en-tête pour de vrai : les
   doubles jouent le jeton mesuré le 31 août, et rien ne dirait que le
   fournisseur a cessé de l'annoncer ;
5. demander un modèle qui n'existe pas est **refusé**, et ne rend pas en silence
   une image d'un autre modèle enregistrée sous un faux nom.

Le point 5 est celui qui compte : c'est le seul défaut de ce fournisseur qui
salirait le journal des dépenses pour toujours.
"""

from __future__ import annotations

import asyncio
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from atelier.domaine import Demande  # noqa: E402
from atelier.domaine.catalogue import nommer  # noqa: E402
from atelier.domaine.consommation import accorde  # noqa: E402
from atelier.domaine.erreurs import ErreurAtelier  # noqa: E402
from atelier.fournisseur import Pollinations  # noqa: E402

# Le palier anonyme annonce un appel toutes les quinze secondes.
ATTENTE_S = 16.0

SUJET = "a small red wooden barrel, pixel art, side view, plain background"

# **Chaque lancement demande une phrase que personne n'a demandée**, et c'est
# nécessaire depuis qu'on sait pourquoi (F2, 1er septembre 2026) : une phrase
# déjà vue revient du cache en 0,2 s, **sans les deux en-têtes du fournisseur**.
# Un essai qui la réutiliserait vérifierait le cache et croirait vérifier
# l'adaptateur — c'est ce qui a envoyé une fausse alerte la première fois.
def sujet_neuf(quoi: str) -> str:
    return f"{SUJET}, {quoi} {int(time.time())}"


def mesurer(octets: bytes) -> str:
    from PIL import Image

    with Image.open(io.BytesIO(octets)) as image:
        return f"{image.width}×{image.height} {image.format}"


async def principal() -> int:
    fournisseur = Pollinations()
    print(f"— {fournisseur.nom} —")
    print(f"  ce qui lui manque : {fournisseur.indisponible() or 'rien'}")

    try:
        modeles = await fournisseur.catalogue()
    except ErreurAtelier as erreur:
        print(f"  catalogue : ÉCHEC — {erreur.raison}")
        return 1

    print(f"  catalogue : {len(modeles)} modèle(s)")
    for modele in modeles:
        print(
            f"    · {modele.identifiant}  "
            f"(chez lui « {modele.chez_lui} », {modele.references_max} réfs, "
            f"×{modele.variations_max})"
        )
    if not modeles:
        print("  aucun modèle : rien à essayer")
        return 1

    modele = modeles[0]

    # ── 1 · Une image arrive, et c'est la bonne qui l'a faite ────────────────
    depart = time.monotonic()
    try:
        image = await fournisseur.generer(modele, Demande(sujet_neuf("essai")))
    except ErreurAtelier as erreur:
        print(f"  génération : ÉCHEC — {erreur.raison}")
        return 1

    print(
        f"  génération : {len(image.octets)} octets, {image.type_media}, "
        f"{mesurer(image.octets)} en {time.monotonic() - depart:.1f} s, "
        f"{accorde(image.consomme, image.unite)} — et ${image.cout_usd:.4f}"
    )

    # ── L'unité, et le compte de ce fournisseur (F2) ─────────────────────────
    #
    # **C'est le seul essai du dépôt qui vérifie l'en-tête pour de vrai.** Le
    # relevé du 31 août a mesuré un jeton par image, annoncé dans
    # `x-usage-total-tokens` ; les doubles jouent ce chiffre-là, et rien ne
    # dirait que le fournisseur a cessé de l'annoncer si personne ne le
    # regardait chez lui.
    compte = fournisseur.compte()
    print(
        f"  ce qu'il compte : en {compte.unite}, "
        f"plafond {compte.plafond if compte.plafond is not None else 'aucun annoncé'}, "
        f"cadence {compte.cadence_s:.0f} s, chiffre {compte.source}"
    )
    if image.unite != compte.unite:
        print(
            f"  ATTENTION : l'appel a compté en « {image.unite} » et le "
            f"fournisseur déclare « {compte.unite} »"
        )
        return 1
    if not image.consomme:
        print(
            "  ATTENTION : l'appel n'a rien annoncé. Servi du cache, ou "
            "l'en-tête a changé — les deux se distinguent sur `x-cache`."
        )
        return 1

    # **L'extension vient de ce qui est arrivé, jamais de ce qu'on espérait.**
    # Ce fournisseur ne rend que du JPEG — un fichier nommé `.png` serait le
    # même mensonge que le paramètre `output_format` que les Seedream acceptent
    # puis ignorent. Et le fichier va dans `essais/resultats/`, hors Git : c'est
    # un témoin qu'on regarde une fois, pas un livrable.
    from atelier.image.mesures import extension

    dossier = Path(__file__).resolve().parent / "resultats"
    dossier.mkdir(exist_ok=True)
    sortie = dossier / f"pollinations{extension(image.type_media or '')}"
    sortie.write_bytes(image.octets)
    print(f"  écrite dans essais/resultats/{sortie.name} — à regarder une fois")

    # ── 2 · Un modèle qui n'existe pas doit être refusé, pas servi ───────────
    print(f"  attente de {ATTENTE_S:.0f} s — un appel toutes les quinze secondes")
    await asyncio.sleep(ATTENTE_S)

    from dataclasses import replace

    fantome = replace(
        modele,
        chez_lui="nexistepas",
        identifiant=nommer(fournisseur.nom, "nexistepas"),
    )
    try:
        await fournisseur.generer(fantome, Demande(sujet_neuf("fantome")))
    except ErreurAtelier as erreur:
        print(f"  modèle inventé : REFUSÉ, et c'est ce qu'on veut — {erreur.raison}")
        return 0

    print(
        "  modèle inventé : une image est passée sous un faux nom. "
        "C'EST LE DÉFAUT QUE CET ADAPTATEUR EXISTE POUR ATTRAPER."
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(principal()))
