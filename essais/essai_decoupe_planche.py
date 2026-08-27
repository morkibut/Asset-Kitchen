# -*- coding: utf-8 -*-
"""La chaîne de T5 — un appel payant, une vraie planche, découpée pour de vrai.

**Celui-ci coûte de l'argent** : un appel réel, une planche réelle, et il ne
part qu'à la main. C'est le seul de T5 dans ce cas, et il vérifie exactement ce
qu'aucune image fabriquée ne peut vérifier — que la détection des zones opaques
retrouve les sprites d'une planche **que personne n'a disposée pour elle**.

Tous les tests de T5 travaillent sur une planche construite : sujets posés à
des écarts choisis, sur un fond que l'on sait plat. Un modèle, lui, aligne comme
il veut, laisse l'espacement qu'il veut, colle parfois deux sujets, et peint son
fond avec un dégradé quand l'envie lui prend. C'est cette planche-là qu'il faut
avoir découpée avant de dire que la tranche est finie.

    py essais/essai_decoupe_planche.py
    py essais/essai_decoupe_planche.py --modele google/gemini-3-flash-image
    py essais/essai_decoupe_planche.py --colonnes 4 --lignes 2 --ranger

**Un seul appel, et tout le reste est gratuit.** La détection, la correction en
grille fixe, la découpe, les huit rendus, la filiation : rien de tout ça ne
demande le fournisseur, et c'est précisément ce que la tranche promet. Ce qui se
paie, c'est l'aller-retour, rien d'autre.

Les données de l'essai vivent dans `essais/resultats/decoupe_planche/donnees/` :
il ne touche jamais le `donnees/` de l'atelier, et la génération produite s'y
recopie d'un `--ranger` explicite.

Sortie : `essais/resultats/decoupe_planche/`, non versionné.
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
from PIL import Image, ImageDraw  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.reglages import DONNEES  # noqa: E402
from atelier.services import Atelier  # noqa: E402

SORTIE = RACINE / "resultats" / "decoupe_planche"

# **Le prompt demande une planche, et il la demande explicitement.** C'est
# l'exact opposé de la consigne du dépôt pour un sprite seul — « one single
# sprite, one pose only » —, et c'est pour la même raison : sans la phrase, le
# modèle décide tout seul. `AGENTS.md` note qu'il décide alors *souvent* une
# planche de trois poses ; on ne compte pas sur cette humeur-là, on demande.
PROMPT = (
    "A sprite sheet of eight distinct fantasy characters, arranged in two rows "
    "of four, evenly spaced with clear empty gaps between every character. "
    "16-bit pixel art, thick dark outline, flat shading, no gradients. Each "
    "character standing idle, facing the viewer, full body, one pose each. "
    "Plain flat light gray background, uniform across the whole image. "
    "No ground shadows, no scenery, no frames, no grid lines, no text, no labels."
)

NEGATIF = "photorealism, 3d render, blurry edges, watermark, text, labels, grid lines"


def principal() -> int:
    # Windows encode la sortie redirigée en cp1252 : un simple « ── » lève, et
    # depuis un thread la levée tue le lot entier (`AGENTS.md`).
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="La chaîne de T5 — appel payant")
    arguments.add_argument("--modele", default="openai/gpt-image-2")
    arguments.add_argument("--proportions", default="16:9")
    arguments.add_argument("--colonnes", type=int, default=4)
    arguments.add_argument("--lignes", type=int, default=2)
    arguments.add_argument("--cote-min", type=int, default=16)
    arguments.add_argument(
        "--ranger",
        action="store_true",
        help="recopie la génération produite dans le donnees/ de l'atelier",
    )
    options = arguments.parse_args()

    SORTIE.mkdir(parents=True, exist_ok=True)
    donnees = SORTIE / "donnees"
    identifiant = uuid.uuid4().hex
    journal: dict = {"identifiant": identifiant, "modele": options.modele}

    # **Un atelier à part.** L'essai ne touche pas au `donnees/` de l'auteur —
    # ni pendant qu'il tourne, ni si le fournisseur répond n'importe quoi.
    atelier = Atelier(racine=donnees)

    with TestClient(creer_application(atelier)) as client:
        etat = client.get("/api/status").json()
        if not etat["cle"]["presente"]:
            print("Aucune clé OpenRouter — rien ne part. Voir .env.example")
            return 1
        print("═" * 78)
        print("  LA CHAÎNE DE T5 — une planche demandée, puis découpée")
        print("═" * 78)
        print(f"clé       : présente, …{etat['cle']['apercu']}")
        print(f"catalogue : {etat['catalogue']['modeles']} modèles")

        # ── Ce que le catalogue permet, **avant** de payer ───────────────────
        vu = client.get(
            "/api/models", params={"proportions": options.proportions}
        ).json()
        fiche = next(
            (m for m in vu["modeles"] if m["identifiant"] == options.modele), None
        )
        if fiche is None:
            print(f"« {options.modele} » n'est pas au catalogue.")
            return 1
        if fiche["refus"]:
            print(f"« {fiche['nom']} » est grisé : {fiche['refus']}")
            return 1
        print(f"modèle    : {fiche['nom']}  ·  {options.proportions}")

        # ── L'appel. Le seul de tout l'essai ─────────────────────────────────
        corps = {
            "modele": options.modele,
            "prompt": PROMPT,
            "prompt_negatif": NEGATIF,
            "proportions": options.proportions,
            "variations": 1,
            "identifiant": identifiant,
            "options": {"quality": "low"} if "gpt-image" in options.modele else {},
        }
        depart = time.monotonic()
        soumise = client.post("/api/generations", json=corps)
        if soumise.status_code >= 400:
            print(f"refusé : {soumise.json()}")
            return 1
        generation = _attendre(client, identifiant)
        duree = time.monotonic() - depart
        journal["generation"] = generation
        _ecrire(journal)

        print(f"\nstatut    : {generation['statut']}  en {duree:.1f} s")
        print(f"coût réel : ${generation['cout_usd']:.4f}")

        emplacement = generation["emplacements"][0]
        if emplacement["statut"] != "reussie":
            print(f"  raté : {emplacement['raison']}")
            return 1

        planche = client.get(f"/api/assets/{identifiant}-0").json()
        journal["planche"] = planche
        brut = client.get(
            f"/api/assets/{identifiant}-0/image?brut=true&v=brut"
        ).content
        (SORTIE / f"{identifiant}-planche.png").write_bytes(brut)
        _ecrire(journal)

        print(f"planche   : {planche['largeur']}×{planche['hauteur']} au brut")
        print(
            f"            née habillée comme un sprite — grille "
            f"{planche['rendu_largeur']}×{planche['rendu_hauteur']}. **C'est le brut "
            f"qui se découpe**, jamais le rendu"
        )

        # ── La détection, sur une planche que personne n'a disposée ──────────
        propose = client.get(
            f"/api/assets/{identifiant}-0/slices",
            params={"mode": "auto", "cote_min": options.cote_min},
        ).json()
        journal["auto"] = propose
        _ecrire(journal)

        print(f"\ndétection : {len(propose['boites'])} zone(s) opaque(s) connexe(s)")
        if propose["raison"]:
            print(f"            {propose['raison']}")
        for rang, boite in enumerate(propose["boites"], start=1):
            x0, y0, x1, y1 = boite
            print(
                f"  {rang:>2}  {x1 - x0 + 1:>4}×{y1 - y0 + 1:<4} @ {x0:>4},{y0:<4}"
            )
        print(f"  ordre de lecture cohérent : {_en_bandes(propose['boites'])}")

        # ── La grille fixe, sur la **même** image : gratuite, et c'est le
        #    recours quand la détection se trompe (US-73) ─────────────────────
        grille = client.get(
            f"/api/assets/{identifiant}-0/slices",
            params={
                "mode": "grille",
                "colonnes": options.colonnes,
                "lignes": options.lignes,
            },
        ).json()
        journal["grille"] = grille
        print(
            f"\ngrille    : {options.colonnes} × {options.lignes} → "
            f"{len(grille['boites'])} cases, la dernière jusqu'au pixel "
            f"{grille['boites'][-1][2]} sur {planche['largeur'] - 1}"
        )

        # ── La découpe. Ce que l'auteur aurait cliqué ────────────────────────
        retenues = propose["boites"] or grille["boites"]
        mode = "zones opaques" if propose["boites"] else "grille fixe"
        decoupe = client.post(
            f"/api/assets/{identifiant}-0/slices", json={"boites": retenues}
        )
        if decoupe.status_code >= 400:
            print(f"découpe refusée : {decoupe.json()}")
            return 1
        decoupes = decoupe.json()["decoupes"]
        journal["decoupes"] = decoupes
        _ecrire(journal)

        print(f"\ndécoupe   : {len(decoupes)} assets, depuis le mode « {mode} »")
        vignettes = []
        for asset in decoupes:
            image = client.get(
                f"/api/assets/{asset['identifiant']}/image?v={asset['empreinte']}"
            ).content
            (SORTIE / f"{identifiant}-{asset['rang']}.png").write_bytes(image)
            vignettes.append((asset["label"].rsplit(" · ", 1)[-1], image))
            print(
                f"  {asset['label'].rsplit(' · ', 1)[-1]:>5}"
                f"  brut {asset['largeur']:>4}×{asset['hauteur']:<4}"
                f"  rendu {asset['rendu_largeur']}×{asset['rendu_hauteur']}"
                f"  ${asset['cout_usd']:.4f}"
                f"  parent {asset['parent'][:8]}…"
            )

        # ── Ce que la découpe promet, vérifié sur ce qui est revenu ──────────
        filiation = client.get(f"/api/assets/{identifiant}-0/lineage").json()
        vides = [a for a in decoupes if _opaques(SORTIE / f"{identifiant}-{a['rang']}.png") == 0]
        constats = {
            "assets produits": len(decoupes),
            "tous filiés sur la planche": all(
                a["parent"] == f"{identifiant}-0" for a in decoupes
            ),
            "la planche les compte tous": len(filiation["enfants"]) == len(decoupes),
            "aucune n'a rien coûté": all(a["cout_usd"] == 0.0 for a in decoupes),
            "aucune n'est vide après détourage": not vides,
            "toutes sur la grille du projet": len(
                {(a["rendu_largeur"], a["rendu_hauteur"]) for a in decoupes}
            )
            == 1,
        }
        journal["constats"] = constats
        _ecrire(journal)

        print("\n" + "═" * 78)
        print("  CE QUI EST VÉRIFIÉ SUR CETTE PLANCHE-LÀ")
        print("═" * 78)
        for question, reponse in constats.items():
            print(f"  {question:<36} {reponse}")
        if vides:
            print(
                f"\n  {len(vides)} découpe(s) vide(s) après détourage — une case de "
                f"grille fixe tombée sur du fond, ou un sujet mangé (US-71)."
            )

        _monter_planche(SORTIE / f"{identifiant}-contact.png", brut, vignettes)

    if options.ranger:
        source = donnees / "generations" / identifiant
        cible = DONNEES / "generations" / identifiant
        if source.is_dir() and not cible.exists():
            shutil.copytree(source, cible)
            print(f"\nrangée dans {cible} — l'atelier la relira au prochain démarrage")

    print(f"\nSortie : {SORTIE}")
    return 0


# ── Mesures ──────────────────────────────────────────────────────────────────


def _en_bandes(boites: list[list[int]]) -> bool:
    """Les boîtes se lisent-elles de haut en bas puis de gauche à droite ?

    On ne vérifie pas un tri : on vérifie qu'**à l'intérieur d'une bande**, les
    boîtes vont vers la droite. Une planche dont les sujets ne sont pas alignés
    est justement le cas où un tri naïf entrelacerait deux rangées.
    """
    if len(boites) < 2:
        return True
    bande: list[list[int]] = []
    haut = bas = 0
    for boite in boites:
        centre = (boite[1] + boite[3]) / 2
        if bande and haut <= centre <= bas:
            if boite[0] < bande[-1][0]:
                return False
            bande.append(boite)
            haut, bas = min(haut, boite[1]), max(bas, boite[3])
            continue
        bande, haut, bas = [boite], boite[1], boite[3]
    return True


def _opaques(chemin: Path) -> int:
    with Image.open(chemin) as ouverte:
        return int((np.asarray(ouverte.convert("RGBA"))[:, :, 3] > 0).sum())


def _attendre(client, identifiant: str) -> dict:
    for _ in range(3000):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.1)
    raise SystemExit("la génération n'est jamais arrivée à terme")


def _ecrire(journal: dict) -> None:
    """**Au fil de l'eau, jamais à la fin** — un appel payé s'écrit tout de suite.

    C'est ce qui a sauvé les quatre configurations déjà faites au plantage du
    26 août, et c'est une règle du dépôt depuis (`AGENTS.md`).
    """
    (SORTIE / f"{journal['identifiant']}-mesures.json").write_text(
        json.dumps(journal, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def _monter_planche(
    chemin: Path, brut: bytes, vignettes: list[tuple[str, bytes]]
) -> None:
    """La planche reçue au-dessus, ses découpes en dessous. Le chiffre dit
    combien de zones ont été trouvées ; seul l'œil dit si ce sont les bonnes."""
    CELL, BANDE, MARGE = 160, 18, 6
    largeur = max(720, MARGE + len(vignettes) * (CELL + MARGE))
    haut_planche = 260
    planche = Image.new(
        "RGB", (largeur, haut_planche + CELL + 2 * BANDE + 3 * MARGE), (22, 24, 28)
    )
    dessin = ImageDraw.Draw(planche)

    dessin.rectangle([0, 0, largeur, BANDE - 2], fill=(52, 58, 68))
    dessin.text((4, 4), "la planche reçue", fill=(235, 240, 245))
    with Image.open(io.BytesIO(brut)) as image:
        vue = image.convert("RGB")
        facteur = min(largeur / vue.width, haut_planche / vue.height)
        vue = vue.resize(
            (max(1, int(vue.width * facteur)), max(1, int(vue.height * facteur))),
            Image.Resampling.LANCZOS,
        )
        planche.paste(vue, ((largeur - vue.width) // 2, BANDE))

    y = BANDE + haut_planche + MARGE
    dessin.rectangle([0, y, largeur, y + BANDE - 2], fill=(52, 58, 68))
    dessin.text((4, y + 4), f"{len(vignettes)} découpes", fill=(235, 240, 245))
    for colonne, (nom, octets) in enumerate(vignettes):
        x = MARGE + colonne * (CELL + MARGE)
        with Image.open(io.BytesIO(octets)) as image:
            # Fond magenta : ce qui a été mangé dans le sujet saute aux yeux.
            vue = Image.new("RGB", (CELL, CELL), (60, 20, 55))
            mise = image.convert("RGBA").resize((CELL, CELL), Image.Resampling.NEAREST)
            vue.paste(mise, (0, 0), mise)
            planche.paste(vue, (x, y + BANDE))
        dessin.text((x + 3, y + BANDE + 3), nom, fill=(235, 240, 245))

    planche.save(chemin)
    print(f"\n-> {chemin.relative_to(RACINE.parent)}  {planche.size}")


if __name__ == "__main__":
    sys.exit(principal())
