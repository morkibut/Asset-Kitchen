# -*- coding: utf-8 -*-
"""Ce qu'une planche coûte par image, selon le nombre de cases — E13.

**Celui-ci coûte de l'argent** : trois appels réels, et il ne part qu'à la main.
Il existe parce qu'un chiffre du produit ne repose aujourd'hui que sur **une
seule** mesure. Ce qui est su avant lui :

    1 case  →  $0,0128 par image
    2 cases →  aucun gain
    4 cases →  $0,0057 par image, mesuré une fois

L'écran de E13 propose « refaire les quatre plutôt que compléter les trois » et
affiche trois prix. Deux de ces trois prix seraient donc des extrapolations d'un
point unique, et **un gain annoncé sur une mesure unique est un gain encadré,
pas un gain affirmé**. Trois appels de plus — à trois, cinq et six cases —
remplissent la courbe entre ce qui est su.

    py essais/essai_prix_planche.py                UN À TROIS APPELS PAYANTS
    py essais/essai_prix_planche.py --cases 3 5 6  le défaut
    py essais/essai_prix_planche.py --cases 3      un seul, pour vérifier le banc

**Le même sujet à chaque appel, et c'est le point.** Ce qu'on mesure est l'effet
du *nombre de cases* sur le prix ; changer de sujet en même temps mesurerait deux
choses à la fois et n'en trancherait aucune. Le prompt décrit donc la même
créature, et seule la grille demandée change.

**Un atelier à part**, comme les autres bancs payants : il ne touche jamais le
`donnees/` de l'auteur, ni pendant qu'il tourne, ni si le fournisseur répond
n'importe quoi.

Sortie : `essais/resultats/prix_planche/`, non versionné, plus un relevé JSON
que E13 lit pour écrire ses trois prix.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

SORTIE = RACINE / "resultats" / "prix_planche"
RELEVE = RACINE / "mesures_prix_planche.json"

# **La même créature à chaque appel.** Seule la grille demandée change, et c'est
# la seule variable qu'on veut lire dans le prix.
SUJET = (
    "a stocky dwarf miner, thick auburn braided beard, olive quilted tunic, "
    "grey iron shoulder plates, a lantern at his hip"
)

# La consigne de planche du produit, mot pour mot dans son esprit : une grille
# demandée explicitement, un fond plat, aucun décor. Sans la phrase, le modèle
# décide tout seul du nombre de cases.
def _prompt(cases: int, colonnes: int, lignes: int) -> str:
    return (
        f"A sprite sheet of the same character repeated {cases} times, arranged "
        f"in {lignes} row(s) of {colonnes}, evenly spaced with clear empty gaps "
        f"between every cell. The character is {SUJET}. 16-bit pixel art, thick "
        "dark outline, flat shading, no gradients. Full body, one pose per cell. "
        "Plain flat light gray background, uniform across the whole image. "
        "No ground shadows, no scenery, no frames, no grid lines, no text."
    )


NEGATIF = "photorealism, 3d render, blurry edges, watermark, text, labels, grid lines"

# **La grille par nombre de cases** — colonnes × lignes, la plus carrée possible.
# C'est ce que le pliage du produit compose déjà : une géométrie déduite du
# nombre de cases, jamais choisie à la main.
GRILLES = {2: (2, 1), 3: (3, 1), 4: (2, 2), 5: (5, 1), 6: (3, 2), 8: (4, 2)}


def _attendre(client: TestClient, identifiant: str, secondes: float = 240.0) -> dict:
    depart = time.monotonic()
    while time.monotonic() - depart < secondes:
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(1.5)
    return client.get(f"/api/generations/{identifiant}").json()


def principal() -> int:
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(
        description="Le prix d'une planche par image — appels payants"
    )
    # **Le modèle des deux points déjà connus, et pas un autre.** Les $0,0128 à
    # une case et les $0,0057 à quatre ont été payés chez `openai/gpt-image-2` ;
    # mesurer trois, cinq et six ailleurs donnerait trois points d'une **autre**
    # courbe, et les cinq ensemble ne diraient plus rien.
    arguments.add_argument("--modele", default="openai/gpt-image-2")
    arguments.add_argument("--proportions", default="1:1")
    arguments.add_argument("--cases", type=int, nargs="+", default=[3, 5, 6])
    options = arguments.parse_args()

    SORTIE.mkdir(parents=True, exist_ok=True)
    atelier = Atelier(racine=SORTIE / "donnees")

    with TestClient(creer_application(atelier)) as client:
        etat = client.get("/api/status").json()
        if not etat["cle"]["presente"]:
            print("Aucune clé OpenRouter — rien ne part. Voir .env.example")
            return 1

        vu = client.get(
            "/api/models", params={"proportions": options.proportions}
        ).json()
        fiche = next(
            (m for m in vu["modeles"] if m["identifiant"] == options.modele), None
        )
        if fiche is None:
            connus = ", ".join(m["identifiant"] for m in vu["modeles"][:6])
            print(f"« {options.modele} » n'est pas au catalogue. Vus : {connus}…")
            return 1
        if fiche["refus"]:
            print(f"« {fiche['nom']} » est grisé : {fiche['refus']}")
            return 1

        print("═" * 78)
        print("  LE PRIX D'UNE PLANCHE PAR IMAGE — E13")
        print("═" * 78)
        print(f"clé       : présente, …{etat['cle']['apercu']}")
        print(f"modèle    : {fiche['nom']}  ·  {options.proportions}")
        print(f"cases     : {', '.join(str(c) for c in options.cases)}")
        print()

        mesures: list[dict] = []
        for cases in options.cases:
            colonnes, lignes = GRILLES.get(cases, (cases, 1))
            identifiant = uuid.uuid4().hex
            corps = {
                "modele": options.modele,
                "prompt": _prompt(cases, colonnes, lignes),
                "prompt_negatif": NEGATIF,
                "proportions": options.proportions,
                "variations": 1,
                "identifiant": identifiant,
                "options": {},
            }
            depart = time.monotonic()
            soumise = client.post("/api/generations", json=corps)
            if soumise.status_code >= 400:
                print(f"{cases} cases : refusé — {soumise.json()}")
                continue
            generation = _attendre(client, identifiant)
            duree = time.monotonic() - depart
            cout = float(generation.get("cout_usd") or 0.0)
            mesure = {
                "cases": cases,
                "grille": f"{colonnes}×{lignes}",
                "modele": options.modele,
                "statut": generation["statut"],
                "cout_usd": round(cout, 6),
                "par_image": round(cout / cases, 6) if cases else 0.0,
                "secondes": round(duree, 1),
                "generation": identifiant,
            }
            mesures.append(mesure)
            print(
                f"{cases} cases ({mesure['grille']:>3}) : {generation['statut']:<11}"
                f" ${cout:.4f}   →  ${mesure['par_image']:.4f} par image"
                f"   en {duree:.0f} s"
            )

        # ── Le relevé, écrit à côté du code qui le lira ──────────────────────
        #
        # **Versionné, contrairement aux images du banc.** Ce que E13 affiche est
        # un prix mesuré ; s'il n'était pas dans le dépôt, l'écran l'aurait en
        # dur et personne ne saurait plus d'où il vient.
        connues = _relire()
        for mesure in mesures:
            connues[str(mesure["cases"])] = mesure
        RELEVE.write_text(
            json.dumps(connues, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        print()
        print("La courbe, telle qu'elle est connue")
        print("-" * 78)
        for cle in sorted(connues, key=int):
            m = connues[cle]
            appels = m.get("appels", 1)
            print(
                f"  {cle:>2} cases  ${m['par_image']:.4f} par image"
                f"   ({appels} appel{'s' if appels > 1 else ''})"
            )
        print()
        print(f"Relevé écrit : {RELEVE}")
        total = sum(m["cout_usd"] for m in mesures)
        print(f"Dépensé ici  : ${total:.4f}")
    return 0


def _relire() -> dict:
    """Ce que les mesures précédentes ont trouvé.

    **Les deux points connus avant ce banc y sont écrits d'avance**, avec le
    nombre d'appels sur lequel chacun repose : c'est ce que l'écran de E13
    affiche à côté du prix, et un point à un seul appel ne se lit pas comme un
    point à dix.
    """
    if RELEVE.exists():
        return json.loads(RELEVE.read_text(encoding="utf-8"))
    return {
        "1": {
            "cases": 1,
            "modele": "openai/gpt-image-2",
            "par_image": 0.0128,
            "appels": 13,
            "origine": "le journal du dépôt",
        },
        "2": {
            "cases": 2,
            "modele": "openai/gpt-image-2",
            "par_image": 0.0128,
            "appels": 1,
            "origine": "le journal du dépôt",
        },
        "4": {
            "cases": 4,
            "modele": "openai/gpt-image-2",
            "par_image": 0.0057,
            "appels": 1,
            "origine": "le journal du dépôt",
        },
    }


if __name__ == "__main__":
    raise SystemExit(principal())
