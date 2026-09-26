# -*- coding: utf-8 -*-
"""PX3bis — La couleur demandée obéit-elle vraiment ? (`docs/PLAN-idees-pixellab.md`
§ PX3bis, `docs/releve-usage.md` § 25 septembre 2026 point 1 — verdict PX3).

PX3 a repeint une zone proprement (0 pixel hors zone, 0 pixel de sujet perdu,
mesuré sur 36 s de vrai moteur) mais **la couleur demandée n'obéissait pas** :
« a cool spiky bright blue hairstyle » est revenue rouge à la force 0,9 ; à
1,0, un tirage sur deux seulement est venu bleu.

**Ce que la mesure sépare, en une phrase et sans chiffre** : *parmi les pixels
que le recollage a vraiment changés dans la zone, la couleur demandée est-elle
celle qui domine, ou une autre famille de teinte a-t-elle pris sa place ?*
Jamais « la couleur existe-t-elle quelque part dans l'image » — une image peut
contenir un bleu minuscule dans un coin et rester, pour l'œil, rouge.

## Le diagnostic tenu avant ce banc (AGENTS.md, point 8sexies)

Trois hypothèses ont été vérifiées **sur le texte seul, sans dépenser un
tirage**, en rejouant le vrai chemin du produit (`atelier.domaine.texte_local`,
`atelier.domaine.fond`) :

1. **La bible de l'univers ne part jamais** — vérifié en lisant le code, pas
   supposé : `ServiceGenerations.lignes(repris=True)`
   (`atelier/services/generation.py`) rend une seule ligne, celle de l'auteur
   mot pour mot, et n'appelle jamais `self._production.couches(...)`, seule
   porte d'entrée de la bible et de la palette dans un texte. Un jeu avec ou
   sans palette envoie donc exactement le même texte pour une zone. **Écarté.**
2. **Le déclencheur du style** (`pixel art`, LoRA `pixel-art-xl`) se pose
   devant le texte de l'auteur, jamais après ni mêlé — `texte_local.composer`.
   Il ne mange aucun mot de la couleur demandée. **Écarté comme cause directe**,
   gardé comme facteur de second ordre (biais propre du LoRA).
3. **Le fond neutre choisi par `atelier/domaine/fond.py` contredit la couleur
   demandée — confirmé sur les données réelles du 26 septembre 2026.** Rejouer
   `choisir_pour_une_zone` sur le sprite réel de PX1
   (`essais/resultats/banc-px1/images/sprite_de_base.png`) et le texte réel
   (« a cool spiky bright blue hairstyle… ») rend **le cyan** comme fond. Le
   négatif qui accompagne ce fond dit *« pas de cyan ni de teinte voisine
   nulle part sur le sujet, y compris ses cheveux »* — or le cyan n'est qu'à
   60° de teinte du bleu demandé (`#00FFFF` contre `#0000FF`), alors que la
   distance de Tchebychev qui sert à choisir le fond les tient pour
   **maximalement éloignés** (255, son plafond — seul le canal vert bascule).
   Le négatif de zone finit donc par proscrire la couleur même qu'on demande.
   **Retenu comme cause principale**, et corrigé dans `choisir_pour_une_zone`
   (exclusion par voisinage de teinte, avant le calcul de distance).

Le texte lui-même (`ce_qui_part`) est donc hors de cause ; ce banc mesure ce
qui restait à mesurer : la force du denoise (0,9 contre 1,0 — moins l'image
d'origine a droit de rester, moins ses couleurs peuvent concurrencer celle
demandée), avec le fond corrigé en place.

## Zéro appel payant, zéro écriture dans les données de l'auteur

Même garde que `essais/banc_px1_zone.py` : un seul hôte joignable
(`_verifier_local`), aucun import d'un fournisseur payant, aucun `Atelier()`
construit. Tout part dans `essais/resultats/banc-px3bis/`, hors Git.

## Le vrai chemin du produit, pas une reconstitution

- **Le texte** : `atelier.domaine.texte_local.composer` (le déclencheur du
  style + le texte de l'auteur) et `atelier.domaine.fond.choisir_pour_une_zone`
  / `interdiction` / `replier` (le fond et l'interdiction) — les fonctions
  mêmes que `ServiceGenerations.texte_d_une_zone` appelle.
- **Le graphe** : le profil réel de `sdxl-retouche-zone`
  (`atelier.fournisseur.styles_locaux.construire_profil`, famille `sdxl`,
  zone) et `atelier.domaine.workflow.composer` — la fonction même que
  `FournisseurWorkflowImage.generer_suivi` appelle pour soumettre un tirage.
- **Le recollage** : `atelier.image.zone.recoller`, telle quelle — plus une
  ligne réécrite, PX3 l'a déjà installée dans le produit.
- **Le sprite de base** : celui de PX1, relu sur le disque plutôt que
  regénéré — c'est l'image et le texte exacts qui ont donné le fond cyan sur
  le vrai moteur le 26 septembre 2026, donc le cas qui doit être vérifié
  d'abord.

Usage ::

    <py> essais/banc_px3bis_couleur.py                 lot complet (voir plus bas)
    <py> essais/banc_px3bis_couleur.py --fumee          un seul tirage, une seule
                                                          couleur, une seule force
    <py> essais/banc_px3bis_couleur.py --avant-fix       le contrôle : huit graines,
                                                          tête/bleu/0,9, avec le fond
                                                          d'avant ce banc (cyan)
    <py> essais/banc_px3bis_couleur.py --condense-apres  la variante demandée par
                                                          l'auteur en cours de banc :
                                                          la requête d'abord, un style
                                                          condensé après — trois
                                                          couleurs, deux forces, huit
                                                          graines (§ `_texte_condense_apres`)

Coût : 0 $ (modèle local `sdxl-retouche-zone`). Temps mesuré : voir
`docs/bancs.md`.
"""
from __future__ import annotations

import colorsys
import copy
import io
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from atelier.domaine import texte_local  # noqa: E402
from atelier.domaine.fond import choisir_pour_une_zone, interdiction, replier  # noqa: E402
from atelier.domaine.workflow import composer  # noqa: E402
from atelier.fournisseur.catalogue_styles import OUTILS, inventaire, resoudre, style  # noqa: E402
from atelier.fournisseur.styles_locaux import construire_profil  # noqa: E402
from atelier.image.palette import couleurs_lues  # noqa: E402
from atelier.image.zone import recoller, traits_depuis_rectangles  # noqa: E402

# Le sprite, les constantes de grille et les petits utilitaires de dépôt/attente
# sont ceux de PX1 — **relus, pas réécrits** : même hôte, même protocole, même
# garde-fou (`_verifier_local`).
from essais.banc_px1_zone import (  # noqa: E402
    BASE,
    CIBLE_GRILLE,
    ECHELLE,
    TAILLE_MOTEUR,
    _agrandir,
    _boite_bande,
    _boite_tete,
    _damier,
    _deposer_image,
    _masque_de_zone as _masque_dilate,
    _soumettre,
    _attendre_et_telecharger,
    _verifier_local,
)


def _profil_pret(client: httpx.Client, identifiant: str) -> tuple[dict, dict]:
    """Jumelle de `banc_px1_zone._profil_pret`, mais qui cherche dans `OUTILS`
    (`sdxl-retouche-zone` y vit, pas dans `STYLES` — PX2, PX3)."""
    entree = next((s for s in OUTILS if s["identifiant"] == identifiant), None)
    if entree is None:
        raise AssertionError(f"Outil inconnu du catalogue : {identifiant}")
    informations = client.get(f"{BASE}/object_info").json()
    inventaire_ = inventaire(informations)
    resolu = resoudre(entree, inventaire_)
    if not resolu["pret"]:
        raise AssertionError(f"{identifiant} indisponible sur cette machine : {', '.join(resolu['manque'])}")
    return construire_profil(entree, resolu["fichiers"]), entree

DOSSIER = RACINE / "essais" / "resultats" / "banc-px3bis"
SPRITE_PX1 = RACINE / "essais" / "resultats" / "banc-px1" / "images" / "sprite_de_base.png"
MOTEUR_ID = "sdxl-retouche-zone"
GRAINES = [101, 202, 303, 404, 505, 606, 707, 808]
FORCES = (0.9, 1.0)

# **Trois couleurs, loin des couleurs du sprite** (peau, brun, gris) — l'une
# d'elles, le bleu, est celle qui a raté sur le vrai moteur le 26 septembre.
COULEURS = {
    "bleu": {
        "tete": "a cool spiky bright blue hairstyle on a person's head, front view portrait",
        "torse": "a bright blue sleeveless tunic top worn on the torso, front view",
        "bande_teinte": (195.0, 265.0),
    },
    "vert": {
        "tete": "a cool spiky bright green hairstyle on a person's head, front view portrait",
        "torse": "a bright green sleeveless tunic top worn on the torso, front view",
        "bande_teinte": (80.0, 170.0),
    },
    "jaune": {
        "tete": "a cool spiky bright yellow hairstyle on a person's head, front view portrait",
        "torse": "a bright yellow sleeveless tunic top worn on the torso, front view",
        "bande_teinte": (38.0, 78.0),
    },
}
SATURATION_MIN = 0.30
VALEUR_MIN = 0.20

# Tête : bande (0, 20) comme PX1, la boîte s'arrête au-dessus du visage.
# Torse : bande (20, 42) comme PX1.
BANDE_TETE = (0, 20)
BANDE_TORSE = (20, 42)


def _teinte_sat_val(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Teinte (degrés), saturation, valeur — pixel par pixel, `colorsys` fait
    foi (c'est lui que `atelier.domaine.fond._teinte` emploie). Le nombre de
    pixels en jeu (une zone de sprite) est trop petit pour justifier une
    version vectorisée."""
    hues = np.empty(rgb.shape[0], dtype=np.float64)
    sats = np.empty(rgb.shape[0], dtype=np.float64)
    vals = np.empty(rgb.shape[0], dtype=np.float64)
    for i, (r, g, b) in enumerate(rgb):
        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        hues[i] = h * 360.0
        sats[i] = s
        vals[i] = v
    return hues, sats, vals


def fraction_teinte_demandee(image_rgb: np.ndarray, changes: np.ndarray, bande: tuple[float, float]) -> dict:
    """**Ce que cette mesure sépare** (§ docstring du module) : parmi les
    pixels que le recollage a changés, la part dont la teinte tombe dans la
    famille demandée, une saturation minimale les distinguant du gris ou du
    presque-noir que la mesure ne compterait ni pour ni contre."""
    pixels = image_rgb[changes][:, :3]
    if pixels.shape[0] == 0:
        return {"pixels_changes": 0, "fraction_teinte_demandee": None}
    hues, sats, vals = _teinte_sat_val(pixels)
    bas, haut = bande
    dans_la_bande = (hues >= bas) & (hues <= haut) & (sats >= SATURATION_MIN) & (vals >= VALEUR_MIN)
    return {
        "pixels_changes": int(pixels.shape[0]),
        "pixels_teinte_demandee": int(dans_la_bande.sum()),
        "fraction_teinte_demandee": round(100 * float(dans_la_bande.sum()) / pixels.shape[0], 1),
    }


def _sprite_de_base() -> np.ndarray:
    if not SPRITE_PX1.is_file():
        raise SystemExit(
            f"Le sprite de PX1 est introuvable ({SPRITE_PX1}) — rejouer "
            "`essais/banc_px1_zone.py` une fois pour le refabriquer, ou "
            "adapter ce banc pour qu'il en fabrique un lui-même."
        )
    return np.asarray(Image.open(SPRITE_PX1).convert("RGBA"))


def _boite(sprite: np.ndarray, zone_nom: str) -> tuple[int, int, int, int]:
    return _boite_tete(sprite, BANDE_TETE) if zone_nom == "tete" else _boite_bande(sprite, BANDE_TORSE)


#: **Variante demandée par l'auteur, en cours de banc (26 septembre 2026)** :
#: la requête d'abord, un descriptif de style condensé après — au lieu du
#: déclencheur du style devant elle (l'ordre par défaut, § `texte_local.composer`).
#: Raison avancée : CLIP découpe le texte par tranches d'environ 75 jetons et
#: pèse davantage les premiers ; un texte d'univers long devant « blue
#: hairstyle » le dilue ou le tronque. Et pour une zone, le style est déjà
#: porté par l'image environnante, **inchangée** — le texte d'univers y est
#: donc bien moins nécessaire que pour une génération entière.
#:
#: **Elle ne passe pas par `texte_local.composer`, exprès** : ce n'est pas
#: encore une méthode du produit, c'est l'hypothèse qu'on met à l'essai avant
#: de l'y faire entrer. `<N>px` reprend `CIBLE_GRILLE`, la grille du sprite.
def _texte_condense_apres(texte_auteur: str) -> str:
    return f"{texte_auteur}, pixel art sprite, {CIBLE_GRILLE}px, dark outline, limited palette"


def _texte_et_fond(sprite_octets: bytes, texte_auteur: str, *, mode: str = "defaut") -> tuple[str, str, str]:
    """Le texte, le négatif et le fond **tels qu'ils partiraient vraiment**
    (`ServiceGenerations.texte_d_une_zone`, `ce_qui_part` de `ServiceZone`) :
    un texte repris (une seule ligne, mot pour mot), le fond choisi loin de
    l'image *et* de ce que le texte nomme, et le négatif qui l'accompagne.

    `mode="condense_apres"` bascule uniquement le texte positif vers
    `_texte_condense_apres` — le fond et le négatif ne changent pas, ils ne
    dépendent que de la couleur nommée par l'auteur, jamais de l'ordre du
    style."""
    couleurs_image = couleurs_lues([sprite_octets])
    choix_fond = choisir_pour_une_zone(couleurs_image, texte_auteur)
    negatif = replier(interdiction(choix_fond.couleur), "")
    if mode == "condense_apres":
        texte = _texte_condense_apres(texte_auteur)
    else:
        entree = style(MOTEUR_ID)
        lignes = [{
            "clef": "sujet.repris", "groupe": "sujet", "nom": "ton texte",
            "texte": texte_auteur, "origine": "repris", "allumee": True,
        }]
        texte = texte_local.composer(lignes, entree, negatif_lu=True)["texte"]
    return texte, negatif, choix_fond.couleur


def _composer_canevas(sprite: np.ndarray, fond_hex: str) -> bytes:
    """L'image posée sur son fond — **le fond calculé pour cet appel**, jamais
    le blanc de `sur_fond_blanc` : c'est ce que `_octets_references(fond=...)`
    envoie vraiment pour une zone (`atelier/services/generation.py`)."""
    r = int(fond_hex[1:3], 16); v = int(fond_hex[3:5], 16); b = int(fond_hex[5:7], 16)
    image = Image.fromarray(sprite, mode="RGBA").resize((TAILLE_MOTEUR, TAILLE_MOTEUR), Image.NEAREST)
    fond = Image.new("RGB", (TAILLE_MOTEUR, TAILLE_MOTEUR), (r, v, b))
    fond.paste(image, (0, 0), image)
    tampon = io.BytesIO()
    fond.save(tampon, format="PNG")
    return tampon.getvalue()


def _un_tirage(client: httpx.Client, profil: dict, sprite: np.ndarray, sprite_octets: bytes,
                zone_nom: str, couleur_nom: str, force: float, graine: int, *, mode: str = "defaut") -> dict:
    boite = _boite(sprite, zone_nom)
    texte_auteur = COULEURS[couleur_nom][zone_nom]
    texte, negatif, fond_hex = _texte_et_fond(sprite_octets, texte_auteur, mode=mode)
    canevas = _composer_canevas(sprite, fond_hex)
    masque_png = _masque_dilate(boite)
    with httpx.Client(timeout=60.0) as up:
        nom_image = _deposer_image(up, canevas, f"px3bis-canevas-{zone_nom}-{couleur_nom}-{force}-{mode}-{graine}.png")
        nom_masque = _deposer_image(up, masque_png, f"px3bis-masque-{zone_nom}-{couleur_nom}-{force}-{mode}-{graine}.png")
    # **Le graphe réel** — `atelier.domaine.workflow.composer`, la même
    # fonction que `FournisseurWorkflowImage.generer_suivi` appelle.
    graphe = composer(profil, prompt=texte, prompt_negatif=negatif, references=[nom_image],
        resolution="1024", proportions="1:1", options={"force": force}, graine=graine, masque=nom_masque)
    depart = time.time()
    numero = _soumettre(client, graphe)
    octets = _attendre_et_telecharger(client, numero, profil["sortie"])
    duree = time.time() - depart
    revenu = np.asarray(Image.open(io.BytesIO(octets)).convert("RGB"))
    traits = traits_depuis_rectangles([[boite[2], boite[0], boite[3] - 1, boite[1] - 1]], sprite.shape[:2])
    from atelier.image.zone import masque_de_zone
    zone_mask = masque_de_zone(sprite.shape[:2], traits)
    r = recoller(sprite, revenu, zone_mask, fond_hex, couleurs=4)
    changes = np.any(r.image != sprite, axis=2)
    mesure = {
        "graine": graine, "force": force, "secondes": round(duree, 1),
        "fond": fond_hex, "texte": texte, "negatif": negatif,
        **r.mesures(),
        **fraction_teinte_demandee(r.image, changes, COULEURS[couleur_nom]["bande_teinte"]),
    }
    return {"sortie": r.image, "mesure": mesure}


def _planche(titre: str, original: np.ndarray, resultats: list[dict]) -> Image.Image:
    facteur = 4
    cote = CIBLE_GRILLE * facteur
    marge = 8
    largeur = (1 + len(resultats)) * (cote + marge) + marge
    hauteur = cote + 24 + 30
    planche = Image.new("RGB", (largeur, hauteur), (255, 255, 255))
    dessin = ImageDraw.Draw(planche)
    try:
        police = ImageFont.load_default()
    except Exception:  # noqa: BLE001
        police = None
    dessin.text((marge, 6), titre, fill=(0, 0, 0), font=police)
    fond_case = _damier((cote, cote))
    original_agrandi = _agrandir(original, facteur)
    fond_case.paste(original_agrandi, (0, 0), original_agrandi)
    planche.paste(fond_case, (marge, 30))
    dessin.text((marge, 30 + cote + 2), "original", fill=(0, 0, 0), font=police)
    for i, r in enumerate(resultats):
        x = marge + (i + 1) * (cote + marge)
        fond_case = _damier((cote, cote))
        case_image = _agrandir(r["sortie"], facteur)
        fond_case.paste(case_image, (0, 0), case_image)
        planche.paste(fond_case, (x, 30))
        m = r["mesure"]
        etiquette = f"g{m['graine']} {m.get('fraction_teinte_demandee')}%"
        dessin.text((x, 30 + cote + 2), etiquette, fill=(0, 0, 0), font=police)
    return planche


def peupler_et_mesurer(cas: list[tuple[str, str, float, str]], *, suffixe: str = "") -> dict:
    """`cas` : une liste de (zone, couleur, force, mode) à jouer, huit graines
    chacun — `mode` étant `"defaut"` (le déclencheur devant, § produit) ou
    `"condense_apres"` (la requête devant, § addition de l'auteur en cours de
    banc). `suffixe` distingue les planches d'un lot de contrôle
    (`--avant-fix`) de celles du lot par défaut, sans jamais s'écraser."""
    DOSSIER.mkdir(parents=True, exist_ok=True)
    sprite = _sprite_de_base()
    sprite_octets = SPRITE_PX1.read_bytes()

    with httpx.Client(timeout=200.0) as client:
        _verifier_local()
        profil, _entree = _profil_pret(client, MOTEUR_ID)
        mesures: dict = {"cas": []}
        for zone_nom, couleur_nom, force, mode in cas:
            print(f"\n=== zone={zone_nom} couleur={couleur_nom} force={force} mode={mode} ===", flush=True)
            resultats = []
            for graine in GRAINES:
                try:
                    resultat = _un_tirage(client, profil, sprite, sprite_octets, zone_nom, couleur_nom, force, graine, mode=mode)
                    m = resultat["mesure"]
                    assert m["pixels_hors_zone"] == 0, f"FAUTE hors zone : {m}"
                    assert m["pixels_du_sujet_perdus"] == 0, f"FAUTE sujet perdu : {m}"
                    resultats.append(resultat)
                    print(f"    graine {graine} : {m['secondes']}s, fond {m['fond']}, "
                          f"{m['fraction_teinte_demandee']}% de la zone changée dans la teinte demandée "
                          f"({m['pixels_teinte_demandee']}/{m['pixels_changes']}), 0 hors zone, 0 perdu", flush=True)
                except Exception as e:  # noqa: BLE001 — un tirage raté n'arrête pas le banc
                    resultats.append({"sortie": sprite, "mesure": {"graine": graine, "erreur": str(e)}})
                    print(f"    graine {graine} : ÉCHEC — {e}", flush=True)
            fractions = [r["mesure"].get("fraction_teinte_demandee") for r in resultats
                         if r["mesure"].get("fraction_teinte_demandee") is not None]
            mediane = sorted(fractions)[len(fractions) // 2] if fractions else None
            mesures["cas"].append({
                "zone": zone_nom, "couleur": couleur_nom, "force": force, "mode": mode,
                "mediane_fraction_teinte_demandee": mediane,
                "tirages": [r["mesure"] for r in resultats],
            })
            titre = f"PX3bis — {zone_nom} — {couleur_nom} — force {force} — {mode}" + (f" — {suffixe}" if suffixe else "")
            planche = _planche(titre, sprite, resultats)
            nom_mode = "" if mode == "defaut" else f"_{mode}"
            chemin_planche = DOSSIER / f"planche_{zone_nom}_{couleur_nom}_{force}{nom_mode}{('_' + suffixe) if suffixe else ''}.png"
            planche.save(chemin_planche)
            print(f"  planche : {chemin_planche} — médiane {mediane}%", flush=True)
        return mesures


def _cas_par_defaut() -> list[tuple[str, str, float, str]]:
    cas = []
    for couleur in COULEURS:
        for force in FORCES:
            cas.append(("tete", couleur, force, "defaut"))
    for force in FORCES:
        cas.append(("torse", "bleu", force, "defaut"))
    return cas


def _cas_condense_apres() -> list[tuple[str, str, float, str]]:
    """**Addition de l'auteur, en cours de banc (26 septembre 2026)** : la
    variante « requête d'abord, style condensé après » (§ `_texte_condense_apres`),
    huit graines par couleur, aux deux forces essayées par le lot par défaut —
    gratuit, donc les deux plutôt qu'une."""
    return [("tete", couleur, force, "condense_apres") for couleur in COULEURS for force in FORCES]


def _activer_ancien_fond() -> None:
    """**Le contrôle, pas le produit** : rejoue `choisir_pour_une_zone` d'avant
    ce banc — la distance de Tchebychev seule, sans l'exclusion par voisinage
    de teinte — pour mesurer sur huit graines, et non sur une, ce que le fond
    cyan coûtait vraiment à l'obéissance. N'existe que sous `--avant-fix` ;
    jamais appelé par le lot par défaut."""
    from atelier.domaine import fond as F
    from atelier.domaine.fond import CANDIDATS, _plus_eloigne, couleurs_nommees, fond_valide

    def ancien(couleurs, description):
        propres = [c for c in (fond_valide(x) for x in couleurs) if c]
        voulues = [t for _, t in couleurs_nommees(description)]
        if not propres and not voulues:
            return F.choisir((), description)
        return _plus_eloigne(CANDIDATS, propres + voulues)

    globals()["choisir_pour_une_zone"] = ancien


def principal() -> int:
    global GRAINES
    fumee = "--fumee" in sys.argv
    avant_fix = "--avant-fix" in sys.argv
    condense_apres = "--condense-apres" in sys.argv
    if fumee:
        GRAINES = GRAINES[:1]
        cas = [("tete", "bleu", 0.9, "defaut")]
    elif avant_fix:
        # **Le contrôle demandé par `docs/PLAN-idees-pixellab.md` § PX3bis** :
        # huit graines, un seul cas (tête, bleu, force 0,9 — celui du rapport
        # d'usage du 26 septembre), avec le fond d'avant ce banc.
        _activer_ancien_fond()
        cas = [("tete", "bleu", 0.9, "defaut")]
    elif condense_apres:
        cas = _cas_condense_apres()
    else:
        cas = _cas_par_defaut()

    print(f"Dossier jetable : {DOSSIER}")
    debut = time.time()
    mesures = peupler_et_mesurer(cas, suffixe="avant-fix" if avant_fix else "")
    mesures["secondes_totales"] = round(time.time() - debut, 1)
    mesures["avant_fix"] = avant_fix

    nom = "mesures_avant_fix.json" if avant_fix else "mesures_condense_apres.json" if condense_apres else "mesures.json"
    chemin = DOSSIER / nom
    chemin.write_text(json.dumps(mesures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMesures écrites : {chemin}")
    print(f"Temps total : {mesures['secondes_totales']:.0f} s")
    print("\nRésumé (médiane de la fraction dans la teinte demandée, par cas) :")
    for c in mesures["cas"]:
        print(f"  {c['zone']:6s} {c['couleur']:6s} force={c['force']} {c['mode']:16s} -> {c['mediane_fraction_teinte_demandee']}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
