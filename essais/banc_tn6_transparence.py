# -*- coding: utf-8 -*-
"""TN6 — Le banc du 22 septembre 2026, rejoué **par l'atelier**, puis huit planches.

Ce que le banc du 22 septembre avait mesuré en parlant directement à ComfyUI
(`Comfy-Desktop/ComfyUI-Shared/output/banc-rgba/`), ce script-ci le rejoue en
passant par l'atelier lui-même — un atelier jetable, port 8421, dossier jetable
hors Git (`essais/resultats/atelier-tn6/`). C'est la seule façon de voir ce que
TN2 (la transparence demandée), TN3 (le détourage endormi, les débris) et TN4
(un trou dans le sujet) font vraiment d'un tirage, et pas seulement d'un fichier
PNG posé à la main dans une fixture.

**Génération locale réelle.** Le fournisseur n'est pas doublé : `Atelier()`
construit par défaut le vrai `FournisseurWorkflowImage` (ComfyUI local,
`127.0.0.1:8188`) à côté d'OpenRouter et Pollinations — ces deux derniers n'ont
pas de clé dans ce worktree (`git status` : pas de `.env`), donc grisés tout
seuls ; ce script ne demande de toute façon jamais qu'un modèle dont le nom
commence par ``ComfyUI:qwen21-rapide`` (vérifié à chaque lot, § `_verifier_local`)
— **zéro appel payant possible**, par construction et par vérification.

**Le style s'installe en vivant, pas en copiant.** `ServiceStylesLocaux.installer`
interroge le vrai `/object_info` de ComfyUI et construit le profil depuis
l'inventaire réel de la machine (`atelier/services/styles_locaux.py`) — aucun
fichier n'a donc besoin d'être copié depuis `donnees/profils-workflow/` de
l'auteur : c'est plus sûr (rien lu ni écrit dans son dossier) et couvre mieux
« et si son inventaire a changé depuis le 22 septembre ».

**Les six sujets isolés partent par l'API ordinaire** (`POST /api/generations`,
huit variations en un seul appel, comme l'écran le ferait) : la transparence
part donc *automatiquement*, par la règle TN2 (`silhouette` de l'échelle, pas
une planche, modèle capable) — rien de spécial à cocher.

**Les deux planches ne passent PAS par cette route.** TN2 exclut une planche de
la transparence automatique (le banc du 22 a rendu une robe transparente sur
la planche du mage) ; le produit reste fermé aux planches tant que TN6 ne l'a
pas rouvert. Pour mesurer quand même, ce script appelle **directement le
moteur de workflow** (`atelier.services.profils_workflow` +
`atelier.fournisseur.workflow.MoteurWorkflow`, le même transport que l'atelier
utilise, sans passer par `ServiceGenerations`/`ServiceProduction`) et compose
le texte à la main avec `atelier.domaine.transparence.encadrer` — la même
consigne, mot pour mot. **Aucune ligne du produit n'est modifiée ni contournée
en douce** : c'est un second chemin, en lecture seule sur le code existant,
qui n'écrit ni règle ni configuration nouvelle. Décision notée ici parce que le
plan (TN6) demandait de la dire.

Usage ::

    <py> essais/banc_tn6_transparence.py               tirages, mesures, écrit
                                                         mesures_tn6.json, quitte
    <py> essais/banc_tn6_transparence.py --servir       pareil, puis sert sur
                                                         http://127.0.0.1:8421
                                                         (Ctrl-C pour arrêter)

Coût : 0 $ (modèle local). Temps mesuré : voir `docs/bancs.md`.
"""
from __future__ import annotations

import asyncio
import io
import json
import sys
import time
from dataclasses import replace
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.image import traitement as T  # noqa: E402
from atelier.domaine.transparence import encadrer  # noqa: E402
from atelier.domaine.recette import (  # noqa: E402
    DETOURAGE,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)

PORT = 8421
DOSSIER = RACINE / "essais" / "resultats" / "atelier-tn6"
TIRAGES_PAR_SUJET = 8

# ── Les six sujets isolés, texte au mot près relu dans les PNG du banc du 22
#    septembre (métadonnée `prompt`, nœud `TextEncodeQwenImage21`) ──────────
SUJETS = [
    {
        "nom": "chevalier",
        "echelle": "personnage",
        "pixel": False,
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A knight in green armour with a green cape, holding a "
            "sword, one isolated subject, centered, full view."
        ),
    },
    {
        "nom": "salamandre",
        "echelle": "créature",
        "pixel": False,
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A small fire salamander with glowing embers and smoke, "
            "one isolated subject, centered, full view."
        ),
    },
    {
        "nom": "fiole",
        "echelle": "objet posé",
        "pixel": False,
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A glass potion bottle filled with glowing blue liquid, "
            "cork stopper, one isolated subject, centered."
        ),
    },
    {
        "nom": "bouton",
        "echelle": "élément d'interface",
        "pixel": False,
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A wooden game menu button with a gold rim, blank "
            "center, one isolated element, centered."
        ),
    },
    {
        "nom": "voleur",
        "echelle": "personnage",
        "pixel": True,
        "prompt": (
            "Pixel art, 32x32 sprite scaled up, crisp pixels, limited "
            "palette. A rogue with a purple hood and two daggers, one "
            "isolated subject, centered, full view."
        ),
    },
    {
        "nom": "coffre",
        "echelle": "meuble",
        "pixel": True,
        "prompt": (
            "Pixel art, 32x32 sprite scaled up, crisp pixels, limited "
            "palette. A treasure chest with gold coins, one isolated "
            "subject, centered."
        ),
    },
]

# ── Les deux planches — pour la mesure seulement (§ docstring) ──────────────
# `grille` (lignes, colonnes) : chaque case porte son propre sujet, donc les
# mesures « un seul sujet » (part enfermée, débris) ne veulent quelque chose
# que rejouées case par case — sur la planche entière, la case voisine se
# compterait comme un débris de la première.
PLANCHES = [
    {
        "nom": "planche-mage",
        "grille": (2, 2),
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A 2x2 sprite sheet of the same small mushroom mage: "
            "front, left side, back, right side, evenly spaced on a grid."
        ),
    },
    {
        "nom": "planche-renard",
        "grille": (1, 4),
        "prompt": (
            "Hand-drawn 2D game art, cel shading, thick dark outlines, flat "
            "colours. A sprite sheet with four frames of a small fox walking "
            "to the right, in one row, evenly spaced."
        ),
    },
]


def _attendre(client: TestClient, identifiant: str) -> dict:
    """Huit variations dans un seul appel, ~20 à 35 s chacune : le premier
    délai (600 * 0,2 s = 120 s) était calé sur une seule image (a11) et coupait
    le lot en cours. Délai large, en temps réel plutôt qu'en nombre de tours."""
    limite = time.monotonic() + 300.0
    while time.monotonic() < limite:
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
        time.sleep(0.5)
    raise AssertionError(f"la génération {identifiant} n'a pas fini")


def _verifier_local(modele: str) -> None:
    """Garde-fou du banc : jamais un centime. Un seul modèle est demandable
    ici, et c'est celui-ci — vérifié avant chaque lot, comme demandé."""
    if not modele.startswith("ComfyUI:qwen21-rapide@"):
        raise AssertionError(
            f"Modèle refusé par le garde-fou du banc (payant ou inattendu) : {modele}"
        )


def _recette_du_sujet(pixel: bool) -> Recette:
    """La recette « du jeu » pour un sujet isolé, comme `tests/test_tn3_…` la
    compose : recadrage toujours, grille + palette seulement en pixel art."""
    return Recette(
        passes=(Passe(),),
        recadrage=Recadrage(),
        grille=Grille(cible=64) if pixel else None,
        quantification=Quantification(couleurs=16) if pixel else None,
    )


def _hors_du_sujet(rgba: np.ndarray) -> tuple[float, int]:
    """**Les débris** (repris tel quel de `tests/test_tn3_detourage_endormi.py`,
    § `_hors_du_sujet`) : la part de pixels à demi transparents hors du sujet,
    et le nombre de pixels visibles hors du sujet. Le sujet est le plus grand
    amas franchement opaque, élargi de deux pixels."""
    alpha = rgba[:, :, 3]
    amas = T.composantes(alpha >= 128)
    if not amas:
        return 0.0, 0
    sujet = T.etendre(max(amas, key=lambda z: z[1])[0], 2)
    demi = (alpha > 0) & (alpha < 255) & ~sujet
    visibles = (alpha > 0) & ~sujet
    return float(demi.mean()), int(visibles.sum())


def _tableau(octets: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(octets)) as image:
        return np.asarray(image.convert("RGBA"))


def _mesurer_brut(nom: str, octets: bytes, pixel: bool) -> dict:
    """Ce que TN3 et TN4 disent d'un brut : fond vide reçu, trou signalé
    (TN4, sur le brut, comme le produit le fait), et débris une fois la
    recette du jeu appliquée avec le détourage endormi (TN3)."""
    tableau = _tableau(octets)
    vide = bool(T.fond_vide(octets))
    troue = bool(T.sujet_troue(octets)) if vide else None
    part = float(T.part_enfermee(octets)) if vide else None
    recette = replace(_recette_du_sujet(pixel), fond_du_modele=True).endormie(
        DETOURAGE, True
    )
    rendu = T.appliquer(recette, octets)
    demi, visibles = _hors_du_sujet(_tableau(rendu.octets))
    return {
        "fond_vide_recu": vide,
        "part_enfermee": part,
        "sujet_troue_tn4": troue,
        "debris_demi_transparents_pct": round(demi * 100, 2),
        "debris_pixels_visibles": visibles,
        "largeur": tableau.shape[1],
        "hauteur": tableau.shape[0],
    }


def _case_en_png(tableau: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _mesurer_planche(octets: bytes, lignes: int, colonnes: int) -> dict:
    """Le fond vide se lit sur la planche entière (le cadre est un seul cadre) ;
    tout le reste — part enfermée, trou, débris — se rejoue **case par case**,
    chaque case étant son propre sujet isolé (§ commentaire sur `PLANCHES`).
    Les débris se mesurent **après la recette du jeu** (détourage endormi,
    fond du modèle fini), comme `_mesurer_brut` le fait pour un sujet seul —
    sinon on mesure le voile du modèle, pas ce qui reste une fois né
    transparent."""
    tableau = _tableau(octets)
    vide = bool(T.fond_vide(octets))
    hauteur, largeur = tableau.shape[0], tableau.shape[1]
    h, l = hauteur // lignes, largeur // colonnes
    recette = replace(_recette_du_sujet(pixel=False), fond_du_modele=True).endormie(
        DETOURAGE, True
    )
    cases = []
    for i in range(lignes):
        for j in range(colonnes):
            case = tableau[i * h : (i + 1) * h, j * l : (j + 1) * l]
            case_octets = _case_en_png(case)
            part = float(T.part_enfermee(case_octets)) if vide else None
            troue = bool(part is not None and part > 0.12)
            rendu = T.appliquer(recette, case_octets)
            demi, visibles = _hors_du_sujet(_tableau(rendu.octets))
            cases.append(
                {
                    "case": f"{i}x{j}",
                    "part_enfermee": part,
                    "sujet_troue_tn4": troue,
                    "debris_demi_transparents_pct": round(demi * 100, 2),
                    "debris_pixels_visibles": visibles,
                }
            )
    return {
        "fond_vide_recu": vide,
        "largeur": largeur,
        "hauteur": hauteur,
        "cases": cases,
        "une_case_au_moins_trouee": any(c["sujet_troue_tn4"] for c in cases),
    }


def _generer_sujet(client: TestClient, sujet: dict, modele: str) -> list[dict]:
    """**Une génération par tirage**, et non huit variations dans un seul
    appel : une panne locale (`SuiviLocalInterrompu`, le mécanisme même
    qu'`AGENTS.md` 8bis décrit — un travail qui reste « engagé » sans que
    personne ne le pousse) a bloqué un lot de huit d'un coup au premier essai.
    Un tirage à la fois perd, au pire, un seul tirage — pas le sujet entier —
    et chaque appel a son propre budget de temps."""
    resultats = []
    for rang in range(TIRAGES_PAR_SUJET):
        try:
            reponse = client.post(
                "/api/generations",
                json={
                    "modele": modele,
                    "prompt": sujet["prompt"],
                    "echelle": sujet["echelle"],
                    "resolution": "1024",
                    "variations": 1,
                },
            )
            if reponse.status_code >= 400:
                raise AssertionError(f"{reponse.status_code} {reponse.text}")
            generation = _attendre(client, reponse.json()["identifiant"])
            asset_id = f"{generation['identifiant']}-0"
            emplacement = generation["emplacements"][0]
            if emplacement["statut"] != "reussie":
                resultats.append(
                    {"rang": rang, "statut": emplacement["statut"], "erreur": True,
                     "raison": emplacement.get("raison")}
                )
                continue
            brut = client.get(f"/api/assets/{asset_id}/image", params={"brut": "true"})
            impose = client.get(f"/api/assets/{asset_id}/imposed").json()
            fiche = client.get(f"/api/assets/{asset_id}").json()
            mesure = _mesurer_brut(sujet["nom"], brut.content, sujet["pixel"])
            mesure.update(
                {
                    "rang": rang,
                    "asset": asset_id,
                    "statut": "reussie",
                    "detouree_par_le_modele": impose.get("detouree_par_le_modele"),
                    "sujet_troue_fiche": impose.get("sujet_troue"),
                    "detourage_endormi_a_la_naissance": DETOURAGE
                    in (fiche.get("recette", {}).get("veille") or []),
                    "fond_du_modele_sur_la_recette": bool(
                        fiche.get("recette", {}).get("fond_du_modele")
                    ),
                }
            )
            resultats.append(mesure)
            print(f"    tirage {rang} : ok", flush=True)
        except Exception as e:  # noqa: BLE001 — un tirage raté n'arrête pas le banc
            resultats.append({"rang": rang, "statut": "erreur_banc", "erreur": True, "raison": str(e)})
            print(f"    tirage {rang} : ÉCHEC — {e}", flush=True)
    return resultats


async def _une_planche(profils_workflow, profil: dict, texte: str) -> bytes:
    """**La voie qui ne change pas le produit** (§ docstring du module) : les
    primitives mêmes que `FournisseurWorkflowImage._executer` appelle
    (`soumettre_graphe`, `etat`, `sortie_de` sur `MoteurWorkflow`), rejouées à
    la main ici plutôt qu'à travers `ServiceGenerations`/`ServiceProduction` —
    qui sont, eux, ce qui interdit la transparence à une planche. Le texte est
    encadré à la main avec la même fonction que le produit (`transparence.
    encadrer`), au mot près."""
    moteur = profils_workflow.fabrique_moteur()
    numero = await moteur.soumettre_graphe(
        profil,
        {"prompt": texte, "prompt_negatif": "", "resolution": "1024", "proportions": "1:1"},
        [],
    )
    limite = time.monotonic() + 300
    while time.monotonic() < limite:
        etat = await moteur.etat(numero)
        if etat.echoue:
            raise AssertionError(f"planche refusée par ComfyUI : {etat.raison}")
        if etat.fini:
            octets, _type_media, _reference = await moteur.sortie_de(numero, profil)
            return octets
        await asyncio.sleep(1.0)
    raise AssertionError("la planche n'a pas fini à temps")


def _generer_planche(profils_workflow, profil: dict, planche: dict) -> tuple[bytes, float]:
    """Encadre le texte à la main, soumet, chronomètre."""
    texte = encadrer(planche["prompt"])
    depart = time.time()
    octets = asyncio.run(_une_planche(profils_workflow, profil, texte))
    duree = time.time() - depart
    return octets, duree


def peupler_et_mesurer(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        print("Installation du style qwen21-rapide depuis le vrai ComfyUI…", flush=True)
        installe = asyncio.run(atelier.styles_locaux.installer("qwen21-rapide"))
        modele = installe["modele"]
        _verifier_local(modele)
        # Le catalogue est un cache : une installation fraîche ne s'y voit pas
        # tant qu'on ne le relit pas (`ServiceCatalogue.rafraichir`), sans quoi
        # la génération refuse le modèle comme inconnu.
        asyncio.run(atelier.catalogue.rafraichir())
        print(f"  → {modele}", flush=True)

        mesures: dict = {"modele": modele, "sujets": {}, "planches": {}}

        for sujet in SUJETS:
            print(f"\n{sujet['nom']} — {TIRAGES_PAR_SUJET} tirages…", flush=True)
            depart = time.time()
            resultats = _generer_sujet(client, sujet, modele)
            duree = time.time() - depart
            print(f"  {duree:.0f} s pour {TIRAGES_PAR_SUJET} tirages", flush=True)
            mesures["sujets"][sujet["nom"]] = {
                "echelle": sujet["echelle"],
                "secondes_du_lot": round(duree, 1),
                "tirages": resultats,
            }

        for planche in PLANCHES:
            print(f"\n{planche['nom']} — {TIRAGES_PAR_SUJET} tirages (voie directe)…", flush=True)
            tirages = []
            for rang in range(TIRAGES_PAR_SUJET):
                try:
                    _verifier_local(installe["modele"])
                    octets, duree = _generer_planche(atelier.profils_workflow, installe, planche)
                    lignes, colonnes = planche["grille"]
                    mesure = _mesurer_planche(octets, lignes, colonnes)
                    mesure.update({"rang": rang, "secondes": round(duree, 1)})
                    tirages.append(mesure)
                    (DOSSIER / "images" / f"{planche['nom']}_{rang}.png").parent.mkdir(
                        parents=True, exist_ok=True
                    )
                    (DOSSIER / "images" / f"{planche['nom']}_{rang}.png").write_bytes(octets)
                    print(f"  tirage {rang} : {duree:.0f} s", flush=True)
                except Exception as e:  # noqa: BLE001 — idem : un tirage raté n'arrête pas le banc
                    tirages.append({"rang": rang, "statut": "erreur_banc", "erreur": True, "raison": str(e)})
                    print(f"  tirage {rang} : ÉCHEC — {e}", flush=True)
            mesures["planches"][planche["nom"]] = {"tirages": tirages}

        return mesures


def principal() -> int:
    global SUJETS, PLANCHES, TIRAGES_PAR_SUJET
    servir = "--servir" in sys.argv
    if "--fumee" in sys.argv:
        # Un tirage, un seul sujet, une seule planche : valider le câblage
        # (route, style installé pour de vrai, mesures) avant le vrai lot.
        SUJETS, PLANCHES, TIRAGES_PAR_SUJET = SUJETS[:1], PLANCHES[:1], 1
    DOSSIER.mkdir(parents=True, exist_ok=True)
    print(f"Dossier jetable : {DOSSIER}")
    atelier = Atelier(racine=DOSSIER)

    debut = time.time()
    mesures = peupler_et_mesurer(atelier)
    mesures["secondes_totales"] = round(time.time() - debut, 1)

    chemin = DOSSIER / "mesures_tn6.json"
    chemin.write_text(json.dumps(mesures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMesures écrites : {chemin}")
    print(f"Temps total : {mesures['secondes_totales']:.0f} s")

    if servir:
        print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
        uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
