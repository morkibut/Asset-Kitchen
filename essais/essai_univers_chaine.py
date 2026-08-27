# -*- coding: utf-8 -*-
"""La chaîne de T4 — un appel payant, l'univers de bout en bout.

**Celui-ci coûte de l'argent** : un appel réel, une image réelle, et il ne part
qu'à la main. C'est le seul de T4 dans ce cas, et il vérifie exactement ce
qu'aucun double ne peut vérifier — que le prompt **replié par le produit** et les
artworks **choisis par la famille du sujet** atteignent vraiment un modèle, et
que ce qui revient traverse la chaîne complète sans un geste de retouche.

    py essais/essai_univers_chaine.py
    py essais/essai_univers_chaine.py --modele google/gemini-3-flash-image
    py essais/essai_univers_chaine.py --sujet "objet tenu"

**Tout ce qui n'a pas besoin d'un appel se fait sans appel**, et c'est délibéré :
la palette s'extrait des planches du guide, le barème se vérifie en appliquant
**deux échelles à la même image reçue** — un personnage et un objet tenu sortent
alors de la même génération, à leur échelle respective, pour le prix d'un seul
appel. Ce qui se paie, c'est l'aller-retour au fournisseur, rien d'autre.

Les données de l'essai vivent dans `essais/resultats/univers_chaine/donnees/` :
il ne touche jamais le `donnees/` de l'atelier, et l'image produite s'y recopie
d'un `--ranger` explicite.

Sortie : `essais/resultats/univers_chaine/`, non versionné.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import sys
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.reglages import DONNEES  # noqa: E402
from atelier.services import Atelier  # noqa: E402

GUIDE = RACINE / "guide"
SORTIE = RACINE / "resultats" / "univers_chaine"

# La bible du banc du 26 août, en champs nommés. C'est elle que le produit
# replie en tête du prompt — et c'est ce repliage-là qu'on vient vérifier.
BIBLE = [
    {"nom": "monde", "texte": "dark fantasy forest realm, mossy stone and iron", "actif": True},
    {"nom": "epoque", "texte": "early medieval, before gunpowder", "actif": True},
    {
        "nom": "trait",
        "texte": "16-bit pixel art, thick dark outline, flat shading, no gradients",
        "actif": True,
    },
    {"nom": "eclairage", "texte": "soft top-left light, short cast shadows", "actif": False},
    {
        "nom": "technique",
        "texte": (
            "one single sprite, one pose only, centered, on a plain flat light gray "
            "background. No ground shadow, no scenery, no text"
        ),
        "actif": True,
    },
]

# **Le sujet ne redit pas le style.** C'est tout l'intérêt de la tranche : la
# bible et les artworks portent la manière, l'auteur n'écrit plus que la chose.
SUJET = "A hooded forest ranger standing idle, facing the viewer"


def _mesurer(octets: bytes) -> tuple[int, int, int]:
    """(hauteur du sujet, largeur du sujet, ligne de sol) dans la case rendue."""
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    lignes = np.where(rgba[:, :, 3] >= 128)[0]
    colonnes = np.where(rgba[:, :, 3].T >= 128)[0]
    if lignes.size == 0:
        return 0, 0, 0
    return (
        int(lignes.max() - lignes.min() + 1),
        int(colonnes.max() - colonnes.min() + 1),
        int(lignes.max()),
    )


def _couleurs(octets: bytes) -> set[str]:
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    opaques = rgba[rgba[:, :, 3] > 0][:, :3]
    return {"#%02x%02x%02x" % tuple(int(v) for v in px) for px in opaques}


def _attendre(client, identifiant: str) -> dict:
    for _ in range(3000):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.1)
    raise SystemExit("la génération n'est jamais arrivée à terme")


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="La chaîne de T4 — appel payant")
    arguments.add_argument("--modele", default="openai/gpt-image-2")
    arguments.add_argument("--sujet", default="personnage")
    arguments.add_argument("--cible", type=int, default=64)
    arguments.add_argument(
        "--ranger",
        action="store_true",
        help="recopie la génération produite dans le donnees/ de l'atelier",
    )
    options = arguments.parse_args()

    if not GUIDE.is_dir() or not sorted(GUIDE.glob("*.png")):
        print("Aucune planche dans essais/guide/ — l'univers n'aurait rien à envoyer.")
        return 1

    SORTIE.mkdir(parents=True, exist_ok=True)
    donnees = SORTIE / "donnees"
    identifiant = uuid.uuid4().hex

    # **Un atelier à part.** L'essai ne touche pas au `donnees/` de l'auteur —
    # ni pendant qu'il tourne, ni si le fournisseur répond n'importe quoi.
    atelier = Atelier(racine=donnees)

    with TestClient(creer_application(atelier)) as client:
        etat = client.get("/api/status").json()
        if not etat["cle"]["presente"]:
            print("Aucune clé OpenRouter — rien ne part. Voir .env.example")
            return 1
        print(f"clé       : présente, …{etat['cle']['apercu']}")
        print(f"catalogue : {etat['catalogue']['modeles']} modèles")

        # ── L'univers, posé comme l'auteur le poserait ───────────────────────
        planches = sorted(GUIDE.glob("*.png"))
        familles = ("personnages", "tous")
        for chemin, famille in zip(planches, familles):
            collee = client.post(
                "/api/board/paste",
                params={"nom": chemin.name},
                content=chemin.read_bytes(),
            ).json()
            carte = collee["carte"] or collee["doublon"]
            client.put(
                f"/api/board/{carte['identifiant']}/official",
                json={"officiel": True, "famille": famille},
            )
            print(f"artwork   : {chemin.name}  →  famille « {famille} »")

        pose = client.put(
            "/api/universe", json={"bible": BIBLE, "cible_px": options.cible}
        ).json()["univers"]
        print(f"palette   : {len(pose['palette'])} couleurs, extraites des artworks")
        print(f"            {' '.join(pose['palette'])}")
        print(f"cible     : {pose['cible_px']} px, imposée à tout ce qui rentre")

        # ── Ce qui partira, **avant** de payer ───────────────────────────────
        vu = client.get(
            "/api/models", params={"echelle": options.sujet, "proportions": "1:1"}
        ).json()
        compte = vu["references"]
        fiche = next((m for m in vu["modeles"] if m["identifiant"] == options.modele), None)
        if fiche is None:
            print(f"« {options.modele} » n'est pas au catalogue.")
            return 1
        if fiche["refus"]:
            print(f"« {fiche['nom']} » est grisé : {fiche['refus']}")
            return 1
        print(
            f"sujet     : {options.sujet}  →  {compte['total']} référence(s)"
            f"  ({compte['artworks']} artwork(s), famille {compte['famille']})"
        )
        print(f"modèle    : {fiche['nom']}  ({fiche['references_max']} réfs max)")

        # ── L'appel. Le seul de tout l'essai ─────────────────────────────────
        corps = {
            "modele": options.modele,
            "prompt": SUJET,
            "prompt_negatif": "photorealism, 3d render, blurry edges, watermark",
            "proportions": "1:1",
            "variations": 1,
            "identifiant": identifiant,
            "echelle": options.sujet,
            "options": {"quality": "low"} if "gpt-image" in options.modele else {},
        }
        depart = time.monotonic()
        soumise = client.post("/api/generations", json=corps)
        if soumise.status_code >= 400:
            print(f"refusé : {soumise.json()}")
            return 1
        generation = _attendre(client, identifiant)
        duree = time.monotonic() - depart

        print(f"\nstatut    : {generation['statut']}  en {duree:.1f} s")
        print(f"coût réel : ${generation['cout_usd']:.4f}")
        # **Ce qui est parti, nommément.** Une génération se relit des mois
        # après, même si l'univers a changé depuis.
        for reference in generation["references"]:
            print(f"  ↳ {reference['origine']} {reference['asset']}  ({reference['role']})")

        emplacement = generation["emplacements"][0]
        if emplacement["statut"] != "reussie":
            print(f"  raté : {emplacement['raison']}")
            _ecrire(SORTIE, identifiant, generation, None, {})
            return 1

        asset = client.get(f"/api/assets/{identifiant}-0").json()
        recette = asset["recette"]
        print(
            f"\nasset     : né habillé — détourage {len(recette['passes'])} passe(s),"
            f" grille {recette['grille']['cible']} px à {recette['grille']['occupation']} %,"
            f" quantification sur {len(recette['quantification']['palette'])} couleurs"
        )
        print(f"            épinglé : {asset['epingle']}   (l'univers n'épingle pas)")
        print(f"            rendu   : {asset['rendu_largeur']}×{asset['rendu_hauteur']}")

        rendu = client.get(
            f"/api/assets/{identifiant}-0/image?v={asset['empreinte']}"
        ).content
        brut = client.get(f"/api/assets/{identifiant}-0/image?brut=true&v=brut").content
        (SORTIE / f"{identifiant}-brut.png").write_bytes(brut)
        (SORTIE / f"{identifiant}-rendu.png").write_bytes(rendu)

        dehors = _couleurs(rendu) - set(pose["palette"])
        print(
            f"couleurs  : brut {len(_couleurs(brut))}"
            f"  →  rendu {len(_couleurs(rendu))}"
            f"  ·  hors palette du projet : {len(dehors)}"
        )

        # ── Le barème, sur la **même** image : deux échelles, un seul appel ──
        print("\nbarème    : la même image ramenée à deux échelles du projet")
        mesures = {}
        for nom in [e["nom"] for e in pose["bareme"] if e["silhouette"]]:
            echelle = next(e for e in pose["bareme"] if e["nom"] == nom)
            client.put(
                f"/api/assets/{identifiant}-0/recipe",
                json={
                    **recette,
                    "grille": {
                        **recette["grille"],
                        "occupation": echelle["occupation"],
                    },
                },
            )
            fraiche = client.get(f"/api/assets/{identifiant}-0").json()
            image = client.get(
                f"/api/assets/{identifiant}-0/image?v={fraiche['empreinte']}"
            ).content
            (SORTIE / f"{identifiant}-{nom.replace(' ', '-')}.png").write_bytes(image)
            haut, large, sol = _mesurer(image)
            mesures[nom] = {
                "occupation": echelle["occupation"],
                "hauteur": haut,
                "largeur": large,
                "sol": sol,
            }
            print(
                f"  {nom:<22} {echelle['occupation']:>3} %"
                f"  →  {haut:>3} px de haut, {large:>3} de large, sol y={sol}"
            )

        sols = {m["sol"] for m in mesures.values()}
        hauteurs = {m["hauteur"] for m in mesures.values()}
        print(
            f"\n  même ligne de sol : {len(sols) == 1}"
            f"   ·   hauteurs distinctes : {len(hauteurs)} sur {len(mesures)}"
        )

        _ecrire(SORTIE, identifiant, generation, asset, mesures)

    if options.ranger:
        source = donnees / "generations" / identifiant
        cible = DONNEES / "generations" / identifiant
        if source.is_dir() and not cible.exists():
            shutil.copytree(source, cible)
            print(f"\nrangée dans {cible} — l'atelier la relira au prochain démarrage")

    print(f"\nSortie : {SORTIE}")
    return 0


def _ecrire(sortie: Path, identifiant: str, generation, asset, mesures) -> None:
    """**Au fil de l'eau, jamais à la fin** — un appel payé s'écrit tout de suite."""
    (sortie / f"{identifiant}-mesures.json").write_text(
        json.dumps(
            {
                "generation": generation,
                "asset": asset,
                "bareme": mesures,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.exit(principal())
