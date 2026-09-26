# -*- coding: utf-8 -*-
"""PX1 — Le banc de la zone : un moteur local repeint-il une tache sans

toucher au reste ? (`docs/PLAN-idees-pixellab.md` § PX1, `docs/releve-usage.md`
§ 25 septembre 2026, point 1 — le tutoriel PixelLab, « repeindre une zone »).

Sur un sprite de l'atelier, on peint trois zones (tête, torse, jambes), on
demande une coiffure / un vêtement du haut / un pantalon, et on recolle le
résultat **dans la zone seulement** — jamais ailleurs. C'est la même mesure que
PixelLab montre en vidéo : un calque qui ne porte que ce qui a changé.

**Zéro appel payant possible, par construction.** Ce script ne parle qu'à
ComfyUI en local (`BASE`, vérifiée avant chaque envoi par `_verifier_local`) ;
aucune ligne n'importe ni OpenRouter ni Pollinations, donc il n'existe aucun
chemin de code qui pourrait déclencher un appel payé — pas seulement une garde
qui le refuserait après coup.

**Rien n'est écrit dans les données de l'auteur.** Le script ne construit pas
d'`Atelier()` : il ne touche jamais `donnees/`. Tout part dans un dossier
jetable hors Git, `essais/resultats/banc-px1/`.

**Le masque voyage à part, en dehors de la route de référence de l'atelier**
(`atelier/fournisseur/workflow.py` § `sur_fond_blanc`, `deposer_reference`,
qui aplatirait une zone transparente sur du blanc). Ce script dépose l'image
composée et le masque **lui-même**, par `POST /upload/image`, avec le même
protocole que `MoteurWorkflow.deposer_reference` (relu ici, pas copié : ce
script ne modifie et n'importe aucune ligne du produit).

**Les graphes réutilisent les chargeurs des styles existants**
(`atelier/fournisseur/styles_locaux.py` § `construire_sdxl`, `construire_klein` — mêmes
nœuds, mêmes fichiers résolus par le catalogue réel de la machine,
`atelier/fournisseur/catalogue_styles.py`), avec une chirurgie de greffe : l'image de départ
vide (`EmptyLatentImage` / `EmptyFlux2LatentImage`) est remplacée par `VAEEncode` (l'image
composée, **jamais grisée**) + `SetLatentNoiseMask` (le masque de la zone), à un denoise
partiel — **jamais `VAEEncodeForInpaint`**.

⚠️ **Le premier jeu (26 septembre 2026, avant relecture) utilisait `VAEEncodeForInpaint`,
et a effacé le sujet.** Ce nœud grise les pixels sous le masque *avant* de les encoder : le
moteur devait tout redessiner de mémoire, sans plus voir ce qu'il y avait — sur les huit
tirages des deux moteurs essayés ce jour-là, le visage disparaissait de la zone « tête », le
torse et les jambes ressortaient troués. `VAEEncode` + `SetLatentNoiseMask` sur le denoise
choisi (0,7) laisse le contenu d'origine dans le latent de départ : la reconstruction
repeint *par-dessus*, elle ne part plus de rien. Voir le verdict dans
`docs/releve-usage.md` pour le détail des deux essais.

**Le recollage ne crée plus de trou, par construction** (`_recoller_zone`) : un pixel de
la zone ne bouge que si le moteur y a peint autre chose que le fond neutre ; un pixel où
le moteur a repeint du fond n'est jamais touché, qu'il portât le sujet ou non avant. Un
pixel du sujet ne peut donc plus devenir transparent — mesuré, pas supposé
(`pixels_sujet_devenus_transparents`, doit valoir 0 sur chaque tirage).

**La zone de la tête s'arrête au-dessus du visage** (`_boite_tete`) : elle gagne de la
place au-dessus de la tête pour une coiffure plus grande, mais jamais vers le bas, sur les
yeux — repeindre un visage entier n'était pas ce que demande PixelLab (« on peint la
coiffure, pas le visage »).

Usage ::

    <py> essais/banc_px1_zone.py                lot complet : 2 moteurs, 3
                                                  zones, 8 tirages chacun
    <py> essais/banc_px1_zone.py --fumee         un seul tirage, un seul
                                                  moteur, une seule zone —
                                                  pour vérifier le câblage
    <py> essais/banc_px1_zone.py --seulement sdxl-pixelart
                                                  ne rejoue qu'un moteur
    <py> essais/banc_px1_zone.py --seulement qwen21-rapide
                                                  le moteur de référence (raté
                                                  au premier essai), hors du
                                                  lot noté mais rejouable seul

Coût : 0 $ (modèles locaux). Temps mesuré : voir `docs/bancs.md`.
"""
from __future__ import annotations

import copy
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

import httpx  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

from atelier.domaine.recette import (  # noqa: E402
    DETOURAGE,
    Grille,
    Passe,
    Quantification,
    Recadrage,
    Recette,
)
from atelier.domaine.transparence import encadrer  # noqa: E402
from atelier.fournisseur.catalogue_styles import STYLES, inventaire, resoudre  # noqa: E402
from atelier.fournisseur.styles_locaux import construire_profil  # noqa: E402
from atelier.image import traitement as T  # noqa: E402

# ── Le seul hôte que ce script parle — jamais un autre, jamais un fournisseur
#    payant : il n'y a même pas d'import qui le permettrait. ──────────────────
BASE = "http://127.0.0.1:8188"
DOSSIER = RACINE / "essais" / "resultats" / "banc-px1"
CIBLE_GRILLE = 64          # côté du sprite, en pixels logiques
TAILLE_MOTEUR = 1024       # taille de travail envoyée au moteur (× 16)
ECHELLE = TAILLE_MOTEUR // CIBLE_GRILLE
FOND_NEUTRE = (128, 128, 128)  # fond opaque neutre pour le canevas du moteur
TIRAGES_PAR_ZONE = 8
GRAINES = [101, 202, 303, 404, 505, 606, 707, 808]

# ── Les trois zones, en bandes du sprite 64×64 (y0, y1) — la largeur (x0, x1)
#    se déduit de la silhouette réelle du sprite de base, avec une marge, pour
#    que la zone colle au personnage plutôt que d'engloutir du fond tout autour
#    (une boîte trop large a d'abord donné un résultat presque tout gris — voir
#    le verdict). ────────────────────────────────────────────────────────────
ZONES = {
    "tete": {
        "bande": (0, 20),
        "prompt": "a cool spiky bright blue hairstyle on a person's head, front view portrait",
        "libelle": "coiffure",
    },
    "torse": {
        "bande": (20, 42),
        "prompt": "a red sleeveless leather tunic top worn on the torso, front view",
        "libelle": "haut",
    },
    "jambes": {
        "bande": (42, 64),
        "prompt": "brown cargo trousers worn on the legs, front view",
        "libelle": "pantalon",
    },
}
MARGE_ZONE = 6           # pixels de la grille 64, de part et d'autre de la silhouette réelle
MARGE_AU_DESSUS = 9      # espace en plus au-dessus de la tête, pour une coiffure plus haute


def _boite_bande(sprite: np.ndarray, bande: tuple[int, int]) -> tuple[int, int, int, int]:
    """La bande verticale demandée, mais une largeur **prise sur la silhouette
    réelle du sprite** (+ marge) plutôt qu'une boîte fixe : sinon la zone
    engloutit surtout du fond, ce que le moteur peint alors en fond (§ verdict
    du 26 septembre 2026, premier essai)."""
    y0, y1 = bande
    alpha = sprite[y0:y1, :, 3] > 0
    colonnes = np.where(alpha.any(axis=0))[0]
    if colonnes.size == 0:
        return y0, y1, 0, sprite.shape[1]
    x0 = max(0, int(colonnes.min()) - MARGE_ZONE)
    x1 = min(sprite.shape[1], int(colonnes.max()) + 1 + MARGE_ZONE)
    return y0, y1, x0, x1


def _couleur_dominante(sprite: np.ndarray, bande: tuple[int, int]) -> np.ndarray:
    y0, y1 = bande
    alpha = sprite[y0:y1, :, 3] > 0
    rgb = sprite[y0:y1, :, :3][alpha]
    couleurs, comptes = np.unique(rgb.reshape(-1, 3), axis=0, return_counts=True)
    return couleurs[np.argmax(comptes)]


def _boite_tete(sprite: np.ndarray, bande: tuple[int, int]) -> tuple[int, int, int, int]:
    """**La coiffure, pas le visage** (correction du 26 septembre 2026) : une boîte qui
    engloberait tout le visage se fait repeindre par-dessus les yeux — c'est exactement ce
    que le premier essai a montré, sur les huit tirages des deux moteurs. La zone s'arrête
    donc juste au-dessus de la première ligne qui porte la couleur de peau (celle du torse,
    la peau étant visible là), et gagne de la place **au-dessus** de la tête pour une
    coiffure plus grande — jamais vers le bas, sur le visage."""
    y0, y1, x0, x1 = _boite_bande(sprite, bande)
    couleur_peau = _couleur_dominante(sprite, (bande[1], min(sprite.shape[0], bande[1] + 22)))
    ligne_visage = y1
    for y in range(y0, y1):
        ligne_alpha = sprite[y, x0:x1, 3] > 0
        if not ligne_alpha.any():
            continue
        ligne_rgb = sprite[y, x0:x1, :3][ligne_alpha].astype(int)
        if (np.abs(ligne_rgb - couleur_peau.astype(int)).sum(axis=1) < 30).any():
            ligne_visage = y
            break
    haut = max(0, y0 - MARGE_AU_DESSUS)
    bas = max(haut + 1, ligne_visage - 1)  # une ligne de marge avant le premier pixel de peau
    return haut, bas, x0, x1


# ── Les trois moteurs essayés — identifiants du vrai catalogue de styles ─────
# `qwen21-rapide` (12 étapes, distillé, cfg 1) a été essayé en premier et a raté deux
# zones sur trois (§ verdict du 26 septembre) — gardé ici pour une seule vérification de
# référence, hors du lot noté. `flux1dev` n'a pas ses poids sur cette machine (aucun
# fichier `flux1.?dev.*\.gguf` dans `/object_info`) : `klein-pxart4` est le second moteur
# à cfg réel effectivement disponible (non distillé, cfg 5).
MOTEURS = {
    "sdxl-pixelart": {"famille": "sdxl", "denoise": 0.9, "vitesse_connue": "environ 25 s/tirage"},
    "klein-pxart4": {"famille": "klein", "denoise": 0.9, "vitesse_connue": "à mesurer"},
}
MOTEUR_REFERENCE = {"qwen21-rapide": {"famille": "qwen21", "denoise": 0.9}}


def _boite_zone(sprite: np.ndarray, zone_nom: str, bande: tuple[int, int]) -> tuple[int, int, int, int]:
    return _boite_tete(sprite, bande) if zone_nom == "tete" else _boite_bande(sprite, bande)

PROMPT_SPRITE_DE_BASE = (
    "Pixel art, 64x64 sprite scaled up, crisp pixels, limited palette. "
    "A young adventurer, bare torso with no shirt, short trimmed brown hair, "
    "simple grey shorts, standing straight, arms at sides, front facing, "
    "one isolated subject, centered, full view."
)


def _verifier_local() -> None:
    """Garde-fou du banc : jamais un centime. Un seul hôte est joignable ici,
    et c'est celui-ci — vérifié avant chaque envoi, comme demandé."""
    if BASE != "http://127.0.0.1:8188":
        raise AssertionError(f"Hôte refusé par le garde-fou du banc : {BASE!r}")


# ── Le transport ComfyUI, relu sur `atelier/fournisseur/workflow.py` et
#    `atelier/fournisseur/maison.py` — même protocole, rejoué ici en synchrone
#    et sans toucher au produit. ───────────────────────────────────────────────


def _deposer_image(client: httpx.Client, octets: bytes, nom: str) -> str:
    _verifier_local()
    reponse = client.post(
        f"{BASE}/upload/image",
        files={"image": (nom, octets, "image/png")},
        data={"type": "input", "overwrite": "true"},
    )
    reponse.raise_for_status()
    rendu = reponse.json()
    if not rendu.get("name"):
        raise AssertionError("ComfyUI n'a pas nommé l'image déposée.")
    return (str(rendu.get("subfolder") or "").rstrip("/") + "/" + str(rendu["name"])).lstrip("/")


def _soumettre(client: httpx.Client, graphe: dict) -> str:
    _verifier_local()
    reponse = client.post(f"{BASE}/prompt", json={"prompt": graphe, "client_id": "banc-px1"})
    if reponse.status_code >= 400:
        raise AssertionError(f"ComfyUI refuse le graphe ({reponse.status_code}) : {reponse.text[:600]}")
    rendu = reponse.json()
    numero = rendu.get("prompt_id")
    if not numero:
        raise AssertionError(f"ComfyUI n'a pas rendu d'identifiant : {rendu}")
    return str(numero)


def _attendre_et_telecharger(client: httpx.Client, numero: str, sortie: dict) -> bytes:
    _verifier_local()
    limite = time.monotonic() + 180.0
    while time.monotonic() < limite:
        histoire = client.get(f"{BASE}/history/{numero}").json()
        entree = histoire.get(numero)
        if entree:
            statut = entree.get("status", {})
            if statut.get("status_str") == "error" or any(
                m.get("exception_type") for m in statut.get("messages", []) if isinstance(m, dict)
            ):
                raise AssertionError(f"ComfyUI a échoué sur {numero} : {json.dumps(statut)[:800]}")
            sorties = entree.get("outputs", {}).get(sortie["noeud"], {}).get(sortie["champ"], [])
            if sorties:
                reference = sorties[0]
                reponse = client.get(
                    f"{BASE}/view",
                    params={
                        "filename": reference["filename"],
                        "subfolder": reference.get("subfolder", ""),
                        "type": reference.get("type", "output"),
                    },
                )
                reponse.raise_for_status()
                return reponse.content
        time.sleep(0.5)
    raise AssertionError(f"Le travail {numero} n'a pas fini à temps")


# ── Résoudre un style du vrai catalogue, et construire son profil brut ───────


def _profil_pret(client: httpx.Client, identifiant: str) -> dict:
    entree = next((s for s in STYLES if s["identifiant"] == identifiant), None)
    if entree is None:
        raise AssertionError(f"Style inconnu du catalogue : {identifiant}")
    informations = client.get(f"{BASE}/object_info").json()
    inventaire_ = inventaire(informations)
    resolu = resoudre(entree, inventaire_)
    if not resolu["pret"]:
        raise AssertionError(f"{identifiant} indisponible sur cette machine : {', '.join(resolu['manque'])}")
    return construire_profil(entree, resolu["fichiers"]), entree


# ── La chirurgie de greffe : remplacer le latent vide par un inpaint ─────────


def _greffer_inpaint_qwen21(profil: dict, *, texte: str, nom_image: str, nom_masque: str,
                              denoise: float, graine: int, etapes: int) -> dict:
    graphe = copy.deepcopy(profil["graphe"])
    graphe["4"]["inputs"]["prompt"] = texte
    graphe["4"]["inputs"]["negative_prompt"] = ""
    graphe.pop("5", None)  # EmptyLatentImage — remplacé par l'inpaint
    graphe["90"] = {"class_type": "LoadImage", "inputs": {"image": nom_image}}
    graphe["91"] = {"class_type": "LoadImage", "inputs": {"image": nom_masque}}
    graphe["92"] = {"class_type": "ImageToMask", "inputs": {"image": ["91", 0], "channel": "red"}}
    # **Encodage qui préserve le contenu** (correction du 26 septembre 2026, § verdict) :
    # `VAEEncode` sur l'image telle quelle (jamais grisée), puis `SetLatentNoiseMask` pose
    # le masque sur ce latent complet. `VAEEncodeForInpaint` grisait les pixels sous le
    # masque *avant* de les encoder — le moteur devait alors tout redessiner de mémoire, et
    # a rendu le sujet à zéro sur les trois zones (visage, torse, jambes effacés). Ici, le
    # visage et le corps sous le masque restent dans le latent de départ ; un denoise
    # partiel (< 1) les laisse transparaître au lieu de les remplacer par du bruit pur.
    graphe["93"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["90", 0], "vae": ["3", 0]}}
    graphe["94"] = {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["93", 0], "mask": ["92", 0]}}
    graphe["6"]["inputs"].update(
        {"latent_image": ["94", 0], "denoise": denoise, "seed": graine, "steps": etapes}
    )
    return graphe


def _greffer_inpaint_sdxl(profil: dict, *, texte: str, nom_image: str, nom_masque: str,
                            denoise: float, graine: int, etapes: int) -> dict:
    graphe = copy.deepcopy(profil["graphe"])
    graphe["2"]["inputs"]["text"] = texte
    graphe["3"]["inputs"]["text"] = "blurry, low quality, deformed"
    graphe.pop("4", None)  # EmptyLatentImage — remplacé par l'inpaint
    graphe["90"] = {"class_type": "LoadImage", "inputs": {"image": nom_image}}
    graphe["91"] = {"class_type": "LoadImage", "inputs": {"image": nom_masque}}
    graphe["92"] = {"class_type": "ImageToMask", "inputs": {"image": ["91", 0], "channel": "red"}}
    graphe["93"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["90", 0], "vae": ["1", 2]}}
    graphe["94"] = {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["93", 0], "mask": ["92", 0]}}
    graphe["5"]["inputs"].update(
        {"latent_image": ["94", 0], "denoise": denoise, "seed": graine, "steps": etapes}
    )
    return graphe


def _greffer_inpaint_klein(profil: dict, *, texte: str, nom_image: str, nom_masque: str,
                             denoise: float, graine: int, etapes: int) -> dict:
    """`construire_klein` (FLUX.2 Klein, famille non distillée à cfg réel — `klein-pxart4`,
    cfg 5) : le graphe part de `EmptyFlux2LatentImage` (12) + `RandomNoise` (11) +
    `SamplerCustomAdvanced` (13), qui n'a pas de champ `denoise` — le dosage se fait en
    coupant la liste des sigmas (`SplitSigmasDenoise`, relu sur `/object_info` le
    26 septembre 2026) et en ne gardant que sa portion basse, la même logique que le champ
    `denoise` d'un KSampler ordinaire."""
    graphe = copy.deepcopy(profil["graphe"])
    graphe["5"]["inputs"]["text"] = texte
    if "6" in graphe:
        graphe["6"]["inputs"]["text"] = "blurry, low quality, deformed"
    graphe.pop("12", None)  # EmptyFlux2LatentImage — remplacé par l'inpaint
    graphe["90"] = {"class_type": "LoadImage", "inputs": {"image": nom_image}}
    graphe["91"] = {"class_type": "LoadImage", "inputs": {"image": nom_masque}}
    graphe["92"] = {"class_type": "ImageToMask", "inputs": {"image": ["91", 0], "channel": "red"}}
    graphe["93"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["90", 0], "vae": ["3", 0]}}
    graphe["94"] = {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["93", 0], "mask": ["92", 0]}}
    graphe["95"] = {"class_type": "SplitSigmasDenoise", "inputs": {"sigmas": ["10", 0], "denoise": denoise}}
    graphe["10"]["inputs"]["steps"] = etapes
    graphe["11"]["inputs"]["noise_seed"] = graine
    graphe["13"]["inputs"]["latent_image"] = ["94", 0]
    graphe["13"]["inputs"]["sigmas"] = ["95", 1]
    return graphe


_GREFFES = {"qwen21": _greffer_inpaint_qwen21, "sdxl": _greffer_inpaint_sdxl, "klein": _greffer_inpaint_klein}


# ── Fabriquer le sprite de base, une fois pour tout le banc ──────────────────


def _recette_sprite() -> Recette:
    # `occupation=85` (au lieu du défaut 100) laisse de la place **au-dessus** de la tête
    # (le sujet est ancré en bas, `Grille.ancrage` par défaut) — sans ça, le premier essai
    # avait un sprite dont les cheveux touchaient déjà le bord haut du cadre : aucune place
    # pour une « coiffure plus grande » (§ `_boite_tete`, `MARGE_AU_DESSUS`).
    return Recette(
        passes=(Passe(),),
        recadrage=Recadrage(),
        grille=Grille(cible=CIBLE_GRILLE, occupation=85),
        quantification=Quantification(couleurs=16),
    )


def _generer_sprite_de_base(client: httpx.Client) -> np.ndarray:
    """Un personnage torse nu, cheveux courts, short — pour que les trois
    zones soient de vraies **substitutions** (§ docstring du plan PX1), pas des
    ajouts sur du vide."""
    profil, _entree = _profil_pret(client, "qwen21-rapide")
    graphe = copy.deepcopy(profil["graphe"])
    texte = encadrer(PROMPT_SPRITE_DE_BASE)
    graphe["4"]["inputs"]["prompt"] = texte
    graphe["4"]["inputs"]["negative_prompt"] = ""
    graphe["5"]["inputs"].update({"width": TAILLE_MOTEUR, "height": TAILLE_MOTEUR})
    graphe["6"]["inputs"]["seed"] = 42
    numero = _soumettre(client, graphe)
    octets = _attendre_et_telecharger(client, numero, profil["sortie"])
    recette = _recette_sprite()
    rendu = T.appliquer(recette, octets)
    tableau = np.asarray(Image.open(io.BytesIO(rendu.octets)).convert("RGBA"))
    # Le sprite peut sortir un peu plus grand ou petit que 64×64 selon la boîte
    # opaque trouvée : on le force sur la grille exacte du banc (recadrage
    # centré, sans redessiner) pour que les zones ci-dessus tombent juste.
    if tableau.shape[0] != CIBLE_GRILLE or tableau.shape[1] != CIBLE_GRILLE:
        image = Image.fromarray(tableau, mode="RGBA")
        toile = Image.new("RGBA", (CIBLE_GRILLE, CIBLE_GRILLE), (0, 0, 0, 0))
        decalage_x = (CIBLE_GRILLE - image.width) // 2
        decalage_y = CIBLE_GRILLE - image.height  # ancré en bas, comme le recadrage
        toile.paste(image, (decalage_x, decalage_y))
        tableau = np.asarray(toile)
    return tableau


# ── Composer l'image et le masque envoyés au moteur ──────────────────────────


def _composer_canevas(sprite: np.ndarray) -> bytes:
    image = Image.fromarray(sprite, mode="RGBA").resize(
        (TAILLE_MOTEUR, TAILLE_MOTEUR), Image.NEAREST
    )
    fond = Image.new("RGB", (TAILLE_MOTEUR, TAILLE_MOTEUR), FOND_NEUTRE)
    fond.paste(image, (0, 0), image)
    tampon = io.BytesIO()
    fond.save(tampon, format="PNG")
    return tampon.getvalue()


def _masque_de_zone(boite: tuple[int, int, int, int]) -> bytes:
    y0, y1, x0, x1 = (v * ECHELLE for v in boite)
    masque = Image.new("L", (TAILLE_MOTEUR, TAILLE_MOTEUR), 0)
    dessin = ImageDraw.Draw(masque)
    dessin.rectangle([x0, y0, x1 - 1, y1 - 1], fill=255)
    # Dilatée de quelques pixels à la taille de travail, pour que le moteur
    # peigne un peu au-delà du bord dur — le recollage, lui, reste strict sur
    # la boîte d'origine (§ `_recoller_zone`).
    masque = masque.filter(ImageFilter.MaxFilter(9))
    tampon = io.BytesIO()
    masque.convert("RGB").save(tampon, format="PNG")
    return tampon.getvalue()


# ── Palette : coupe médiane de Pillow, jamais de tirage au sort (AGENTS.md,
#    § Règles durables) ──────────────────────────────────────────────────────


def _palette_du_sprite(sprite: np.ndarray, maximum: int = 16) -> list[tuple[int, int, int]]:
    opaques = sprite[sprite[:, :, 3] > 0][:, :3]
    if opaques.size == 0:
        return [(0, 0, 0)]
    uniques = {tuple(int(c) for c in couleur) for couleur in opaques}
    return list(uniques)[:maximum]


def _quantifier_zone(recadre_rgb: Image.Image, palette_base: list[tuple[int, int, int]],
                       couleurs_neuves: int = 6) -> Image.Image:
    mediane = recadre_rgb.convert("RGB").quantize(colors=couleurs_neuves, method=Image.Quantize.MEDIANCUT)
    plate = mediane.getpalette()[: couleurs_neuves * 3]
    neuves = [tuple(plate[i : i + 3]) for i in range(0, len(plate), 3)]
    totale = list(dict.fromkeys([*palette_base, *neuves]))[:256]
    image_palette = Image.new("P", (1, 1))
    plat = [c for rgb in totale for c in rgb]
    plat += [0] * (768 - len(plat))
    image_palette.putpalette(plat)
    return recadre_rgb.convert("RGB").quantize(palette=image_palette, dither=Image.Dither.NONE).convert("RGB")


def _recoller_zone(sprite: np.ndarray, resultat_octets: bytes, boite: tuple[int, int, int, int],
                     palette_base: list[tuple[int, int, int]]) -> tuple[np.ndarray, dict]:
    """**Le cœur de la mesure, et sa correction du 26 septembre 2026.**

    Ce que cette mesure sépare, en une phrase sans chiffre : *un vêtement ou une coiffure
    remplace des pixels du sujet, il ne les efface jamais — un pixel du sujet qui devient
    transparent dans la zone est un pixel perdu.* Le premier essai perçait des trous : un
    pixel de peau ou de visage que le moteur repeignait en gris de fond devenait
    transparent, parce que la seule règle était « couleur proche du fond → transparent »,
    sans se demander si ce pixel *portait déjà le sujet*.

    **La règle, maintenant** : on part de l'image d'origine dans la boîte, telle quelle.
    Un pixel ne bouge que si le moteur y a peint autre chose que du fond — peu importe que
    ce pixel ait été sujet ou vide avant. Un pixel où le moteur a peint *du fond* n'est
    jamais touché : s'il était déjà transparent, il le reste ; s'il portait le sujet
    (le moteur a « effacé » sans rien mettre à la place), l'original reprend sa place. Il
    ne peut donc structurellement plus y avoir de trou dans le sujet — ce que la mesure
    ci-dessous vérifie plutôt que de le supposer."""
    y0, y1, x0, x1 = boite
    resultat = Image.open(io.BytesIO(resultat_octets)).convert("RGB")
    reduit = resultat.resize((CIBLE_GRILLE, CIBLE_GRILLE), Image.BOX)
    zone_reduite = reduit.crop((x0, y0, x1, y1))
    zone_quantifiee = np.asarray(_quantifier_zone(zone_reduite, palette_base))

    original_zone = sprite[y0:y1, x0:x1].copy()
    sujet_avant = original_zone[..., 3] > 0

    distance_fond = np.abs(zone_quantifiee.astype(int) - np.array(FOND_NEUTRE)).sum(axis=2)
    peint = distance_fond >= 45  # le moteur a mis autre chose que du fond à cet endroit

    neuve_zone = original_zone.copy()
    neuve_zone[peint, :3] = zone_quantifiee[peint]
    neuve_zone[peint, 3] = 255

    sortie = sprite.copy()
    sortie[y0:y1, x0:x1] = neuve_zone

    # ── Les mesures (§ ce que le plan sépare, ci-dessus) ─────────────────────
    hors_zone_avant = np.delete(sprite.reshape(-1, 4), _indices_zone(sprite.shape, boite), axis=0)
    hors_zone_apres = np.delete(sortie.reshape(-1, 4), _indices_zone(sprite.shape, boite), axis=0)
    pixels_changes_hors_zone = int(np.sum(np.any(hors_zone_avant != hors_zone_apres, axis=1)))

    changes_dans_zone = np.any(original_zone != neuve_zone, axis=2)
    pixels_changes_zone = int(changes_dans_zone.sum())
    total_zone = neuve_zone.shape[0] * neuve_zone.shape[1]

    # Un pixel qui portait le sujet et ne le porte plus (devenu transparent) : la fuite que
    # le premier essai avait, et que la règle ci-dessus interdit désormais par construction
    # — mesurée quand même, pour le vérifier plutôt que le croire.
    sujet_apres = neuve_zone[..., 3] > 0
    pixels_sujet_devenus_transparents = int(np.sum(sujet_avant & ~sujet_apres))
    pixels_ajoutes_sur_du_vide = int(np.sum(~sujet_avant & sujet_apres))

    mesure = {
        "pixels_changes_hors_zone": pixels_changes_hors_zone,
        "pixels_changes_zone": pixels_changes_zone,
        "pct_zone_changee": round(100 * pixels_changes_zone / total_zone, 1),
        "pixels_sujet_devenus_transparents": pixels_sujet_devenus_transparents,
        "pixels_ajoutes_sur_du_vide": pixels_ajoutes_sur_du_vide,
        "zone_identique": pixels_changes_zone == 0,
    }
    return sortie, mesure


def _indices_zone(forme: tuple[int, int, int], boite: tuple[int, int, int, int]) -> np.ndarray:
    hauteur, largeur, _ = forme
    y0, y1, x0, x1 = boite
    grille = np.zeros((hauteur, largeur), dtype=bool)
    grille[y0:y1, x0:x1] = True
    return np.flatnonzero(grille.reshape(-1))


# ── Un tirage ─────────────────────────────────────────────────────────────


def _un_tirage(client: httpx.Client, moteur_id: str, famille: str, sprite: np.ndarray,
                 palette_base: list[tuple[int, int, int]], zone_nom: str, zone: dict, boite: tuple,
                 graine: int, denoise: float, etapes: int, entree: dict, profil: dict) -> dict:
    canevas = _composer_canevas(sprite)
    masque = _masque_de_zone(boite)
    with httpx.Client(timeout=60.0) as up:
        nom_image = _deposer_image(up, canevas, f"px1-canevas-{moteur_id}-{zone_nom}-{graine}.png")
        nom_masque = _deposer_image(up, masque, f"px1-masque-{moteur_id}-{zone_nom}-{graine}.png")
    declencheur = entree.get("declencheur", "")
    texte = f"{declencheur} {zone['prompt']}, pixel art, flat colors, clean silhouette".strip()
    greffe = _GREFFES[famille]
    graphe = greffe(profil, texte=texte, nom_image=nom_image, nom_masque=nom_masque,
        denoise=denoise, graine=graine, etapes=etapes)
    depart = time.time()
    numero = _soumettre(client, graphe)
    octets = _attendre_et_telecharger(client, numero, profil["sortie"])
    duree = time.time() - depart
    sortie, mesure = _recoller_zone(sprite, octets, boite, palette_base)
    mesure.update({"graine": graine, "secondes": round(duree, 1), "texte": texte})
    return sortie, mesure


# ── La planche de comparaison ─────────────────────────────────────────────


def _agrandir(tableau: np.ndarray, facteur: int = 4) -> Image.Image:
    image = Image.fromarray(tableau, mode="RGBA")
    return image.resize((image.width * facteur, image.height * facteur), Image.NEAREST)


def _damier(taille: tuple[int, int], case: int = 4) -> Image.Image:
    largeur, hauteur = taille
    fond = Image.new("RGB", taille, (235, 235, 235))
    dessin = ImageDraw.Draw(fond)
    for y in range(0, hauteur, case):
        for x in range(0, largeur, case):
            if (x // case + y // case) % 2:
                dessin.rectangle([x, y, x + case - 1, y + case - 1], fill=(210, 210, 210))
    return fond


def _planche_comparaison(moteur_id: str, sprite: np.ndarray, resultats: dict) -> Image.Image:
    facteur = 4
    cote = CIBLE_GRILLE * facteur
    marge = 8
    colonnes = 1 + TIRAGES_PAR_ZONE
    lignes = len(ZONES)
    largeur = colonnes * (cote + marge) + marge
    hauteur_ligne = cote + 24
    hauteur = lignes * (hauteur_ligne + marge) + marge + 30
    planche = Image.new("RGB", (largeur, hauteur), (255, 255, 255))
    dessin = ImageDraw.Draw(planche)
    try:
        police = ImageFont.load_default()
    except Exception:  # noqa: BLE001 — la police par défaut ne manque jamais en pratique
        police = None
    dessin.text((marge, 6), f"PX1 — {moteur_id} — original puis 8 tirages par zone (x4)", fill=(0, 0, 0), font=police)

    original_agrandi = _agrandir(sprite, facteur)
    for rang, (zone_nom, _zone) in enumerate(ZONES.items()):
        y = 30 + rang * (hauteur_ligne + marge)
        fond_case = _damier((cote, cote))
        fond_case.paste(original_agrandi, (0, 0), original_agrandi)
        planche.paste(fond_case, (marge, y + 20))
        dessin.text((marge, y), f"{zone_nom} (original)", fill=(0, 0, 0), font=police)
        for i, resultat in enumerate(resultats[zone_nom]):
            x = marge + (i + 1) * (cote + marge)
            if resultat.get("erreur"):
                dessin.text((x, y + 20 + cote // 2), "échec", fill=(200, 0, 0), font=police)
                continue
            case_image = _agrandir(resultat["sortie"], facteur)
            fond_case = _damier((cote, cote))
            fond_case.paste(case_image, (0, 0), case_image)
            planche.paste(fond_case, (x, y + 20))
            etiquette = f"g{resultat['mesure']['graine']} {resultat['mesure']['pct_zone_changee']}%"
            dessin.text((x, y), etiquette, fill=(0, 0, 0), font=police)
    return planche


# ── Le lot complet ───────────────────────────────────────────────────────


def peupler_et_mesurer(moteurs_a_jouer: list[str]) -> dict:
    DOSSIER.mkdir(parents=True, exist_ok=True)
    (DOSSIER / "images").mkdir(exist_ok=True)
    (DOSSIER / "calques").mkdir(exist_ok=True)

    with httpx.Client(timeout=200.0) as client:
        _verifier_local()
        print("Génération du sprite de base (torse nu, cheveux courts, short)…", flush=True)
        sprite = _generer_sprite_de_base(client)
        Image.fromarray(sprite, mode="RGBA").save(DOSSIER / "images" / "sprite_de_base.png")
        palette_base = _palette_du_sprite(sprite)
        print(f"  sprite : {sprite.shape[1]}x{sprite.shape[0]}, {len(palette_base)} couleurs de palette", flush=True)

        mesures: dict = {"sprite_palette": len(palette_base), "moteurs": {}}

        catalogue_moteurs = {**MOTEURS, **MOTEUR_REFERENCE}
        for moteur_id in moteurs_a_jouer:
            config = catalogue_moteurs[moteur_id]
            famille = config["famille"]
            print(f"\n=== Moteur {moteur_id} ({famille}) ===", flush=True)
            profil, entree = _profil_pret(client, moteur_id)
            etapes = entree["etapes"]
            resultats_moteur: dict = {}
            for zone_nom, zone in ZONES.items():
                boite = _boite_zone(sprite, zone_nom, zone["bande"])
                print(f"  zone « {zone_nom} » — boîte {boite} — {TIRAGES_PAR_ZONE} tirages…", flush=True)
                resultats_zone = []
                for rang, graine in enumerate(GRAINES):
                    try:
                        sortie, mesure = _un_tirage(
                            client, moteur_id, famille, sprite, palette_base, zone_nom, zone, boite,
                            graine, config["denoise"], etapes, entree, profil,
                        )
                        assert mesure["pixels_changes_hors_zone"] == 0, (
                            f"FAUTE : {mesure['pixels_changes_hors_zone']} pixels changés hors zone "
                            f"({moteur_id}, {zone_nom}, graine {graine})"
                        )
                        assert mesure["pixels_sujet_devenus_transparents"] == 0, (
                            f"FAUTE : {mesure['pixels_sujet_devenus_transparents']} pixels du sujet "
                            f"devenus transparents dans la zone ({moteur_id}, {zone_nom}, graine {graine})"
                        )
                        resultats_zone.append({"sortie": sortie, "mesure": mesure})
                        nom_fichier = f"{moteur_id}_{zone_nom}_g{graine}.png"
                        Image.fromarray(sortie, mode="RGBA").save(DOSSIER / "images" / nom_fichier)
                        # Le calque seul : transparent partout sauf la zone changée.
                        calque = np.zeros_like(sortie)
                        y0, y1, x0, x1 = boite
                        calque[y0:y1, x0:x1] = sortie[y0:y1, x0:x1]
                        Image.fromarray(calque, mode="RGBA").save(DOSSIER / "calques" / nom_fichier)
                        print(f"    graine {graine} : {mesure['secondes']}s, "
                              f"{mesure['pixels_changes_zone']} px dans la zone "
                              f"({mesure['pct_zone_changee']}%), 0 hors zone, "
                              f"0 pixel de sujet effacé — ok", flush=True)
                    except Exception as e:  # noqa: BLE001 — un tirage raté n'arrête pas le banc
                        resultats_zone.append({"erreur": True, "raison": str(e), "mesure": {"graine": graine}})
                        print(f"    graine {graine} : ÉCHEC — {e}", flush=True)
                resultats_moteur[zone_nom] = resultats_zone
            mesures["moteurs"][moteur_id] = {
                "famille": famille,
                "etapes": etapes,
                "denoise": config["denoise"],
                "zones": {
                    zone_nom: [r["mesure"] for r in resultats]
                    for zone_nom, resultats in resultats_moteur.items()
                },
            }
            planche = _planche_comparaison(moteur_id, sprite, resultats_moteur)
            chemin_planche = DOSSIER / f"planche_{moteur_id}.png"
            planche.save(chemin_planche)
            print(f"  planche : {chemin_planche}", flush=True)

        return mesures


def principal() -> int:
    global TIRAGES_PAR_ZONE, GRAINES, ZONES, MOTEURS
    fumee = "--fumee" in sys.argv
    if fumee:
        TIRAGES_PAR_ZONE = 1
        GRAINES = GRAINES[:1]
        ZONES = {"tete": ZONES["tete"]}
    moteurs_a_jouer = list(MOTEURS.keys())
    connus = {**MOTEURS, **MOTEUR_REFERENCE}
    if "--seulement" in sys.argv:
        nom = sys.argv[sys.argv.index("--seulement") + 1]
        if nom not in connus:
            raise SystemExit(f"--seulement : moteur inconnu {nom!r} (connus : {list(connus)})")
        moteurs_a_jouer = [nom]
    elif fumee:
        moteurs_a_jouer = moteurs_a_jouer[:1]

    print(f"Dossier jetable : {DOSSIER}")
    debut = time.time()
    mesures = peupler_et_mesurer(moteurs_a_jouer)
    mesures["secondes_totales"] = round(time.time() - debut, 1)

    chemin = DOSSIER / "mesures.json"
    chemin.write_text(json.dumps(mesures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMesures écrites : {chemin}")
    print(f"Temps total : {mesures['secondes_totales']:.0f} s")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
