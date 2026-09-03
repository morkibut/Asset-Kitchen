# -*- coding: utf-8 -*-
"""La vue tenue — qu'est-ce qui fait qu'un sprite revient vraiment vu de dessus ?

**C'est l'essai qui décide de ce qu'on répare dans le prompt.** La séance du
1<sup>er</sup> septembre 2026 sur « Le Marais du Vieux Moulin » a payé trois
générations, toutes revenues **de face** sur un jeu déclaré **vu de dessus**
(`docs/archive/essais-v3/etude-prompts.md`). L'étude a nommé quatre suspects ; aucun n'est mesuré,
et les quatre demandent d'écrire du code. Cet essai sépare ceux qui comptent de
ceux qui ne sont que du rangement, pour le prix de vingt images.

Les quatre suspects, et le cinquième que l'auteur a proposé :

  · **L'image jointe n'est pas expliquée.** La carte de référence du pèlerin est
    une planche de quatre poses dessinée **de face**. Elle part sans un mot pour
    dire ce qu'il faut en prendre ; le modèle recopie ce qu'il voit, caméra
    comprise.
  · **La caméra n'est pas dite en dernier.** Elle est au sixième rang de sept
    lignes d'intitulés, et les six derniers mots du prompt sont
    `handheld torch, idle stance, full body`.
  · **La consigne de pose ignore la vue du jeu.** `idle stance, full body` est
    une phrase de vue de face, écrite en dur, la même pour les huit vues du
    produit (`atelier/domaine/plan.py`).
  · **Le champ « ce qu'on ne veut pas » n'est jamais rempli**, alors qu'il part.
  · **Et l'idée de l'auteur** : normaliser la référence *avant* de s'en servir —
    une image de la chose, refaite une fois dans la bonne caméra, qui devient
    ensuite la référence de toutes ses poses.

Neuf bras, un seul modèle, une seule image de référence, un seul sujet : **seul
le texte change**, sauf aux deux bras qui changent l'image exprès, et ils le
disent.

    A0  témoin          le prompt que l'atelier envoie aujourd'hui
    A1  image dite      + une phrase qui explique l'image jointe
    A2  caméra en queue + la caméra répétée en dernier, en impératif
    A3  pose de la vue  + la pose dite dans la caméra du jeu, sans « full body »
    A4  négatif         + le négatif composé, replié en queue
    A5  tout            les quatre ensemble
    A6  sans image      le prompt d'aujourd'hui, référence retirée — le diagnostic
    B1  silhouette      l'art de face + un gabarit de silhouette vue de dessus
    B2  référent        deux temps : on refait la chose de dessus, puis on pose

**La mesure tient en un rapport** : la hauteur de la boîte du sujet sur sa
largeur. Un corps debout de face fait environ deux fois plus haut que large ; le
même corps vu d'aplomb est presque rond. Elle ne vaut que pour les vues
d'aplomb — un profil juste est légitimement haut — et l'œil tranche pour les
autres, sur une seule question : de face, ou de profil ?

── **Ce que l'essai a trouvé, le 1ᵉʳ septembre 2026** ─────────────────────────

Trente images payées, et **deux des cinq suspects sont innocents** :

  · **L'image de référence ne dominait pas le texte.** Retirée (A6), le sprite
    revient de face quand même : 1,46 contre 1,55 au témoin. L'hypothèse la plus
    séduisante de l'étude était fausse, et elle aurait coûté une pièce entière.
  · **Le prompt négatif ne répare rien.** Avec lui (A4), rien ne bouge : 1,69.
    Dire ce qu'on ne veut pas ne dit pas ce qu'on veut.

Et **une seule chose répare** : une caméra dite **en dernier**, en mots qui
décrivent ce qu'on doit voir. 1,55 → 1,13. Tous les bras qui gagnent finissent
par une phrase de caméra ; le seul qui perd est celui qui n'en a pas.

Deux tours ont suivi, et leur relevé est dans `essais/mesures_vue.json` :

  · **Le produit corrigé, sur trois vues.** Le prompt d'avant ne marchait que
    pour les vues qui tombaient d'accord avec `full body` — de face, et de dessus
    3/4. Il rendait un personnage **de face** à un jeu **de plateforme**.
  · **La référence normalisée**, l'idée de l'auteur : elle ne change pas la vue —
    le texte s'en charge — elle change la **constance**. Trois poses gardent la
    même taille et la même silhouette au lieu d'en changer à chaque appel.

    py essais/essai_vue.py                  # montre les dix prompts, gratuit
    py essais/essai_vue.py --verifier       # tout prouver avant de payer, gratuit
    py essais/essai_vue.py --payer          # les appels, ~0,28 $
    py essais/essai_vue.py --relever        # relit les jugements, gratuit

**Sans `--payer`, aucun appel n'est fait**, et une image déjà là est sautée même
avec : relancer ne repaie jamais.

Sortie : `essais/resultats/vue/` et `essais/journal_vue.json` pour la course.
`essais/mesures_vue.json` porte le relevé des trois tours et **ne s'écrase pas** :
c'est une lecture, et elle survit à une relance.
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))
sys.path.insert(0, str(RACINE))

from PIL import Image, ImageDraw  # noqa: E402

from essai_identite import (  # noqa: E402
    charger_catalogue,
    corps_requete,
    dimensions_png,
    generer,
    lire_cle,
    options_retenues,
    refs_max,
)

SORTIE = RACINE / "resultats" / "vue"
# **Deux fichiers, et un seul s'écrase.** Le journal est la course — ce qui est
# parti, ce que ça a coûté — et il se réécrit à chaque passe payante. Le relevé
# est la lecture des trois tours, écrite une fois : une relance ne doit pas
# effacer ce qu'une relance ne saurait pas recalculer.
JOURNAL = RACINE / "journal_vue.json"
MESURES = RACINE / "mesures_vue.json"
JUGEMENTS = RACINE / "jugements_vue.json"
GABARIT = SORTIE / "gabarit-silhouette.png"

MODELE = "openai/gpt-image-2"
OPTIONS = {"aspect_ratio": "1:1", "quality": "low"}
JETS = (1, 2, 3)
PARALLELE = 3

# L'image de référence du projet : la planche de quatre orientations du pèlerin,
# dessinée **de face**. C'est elle qui part aujourd'hui, et c'est elle qu'on
# soupçonne.
REFERENCE = (
    RACINE.parent / "donnees" / "projets" / "test-v2" / "tableau" / "2b40a48ee7304dbb.png"
)


# ─────────────────────────────────────────────────────────────────────────────
# Les morceaux de texte
# ─────────────────────────────────────────────────────────────────────────────

# **Le témoin est recopié d'une génération payée**, pas reconstruit. C'est le
# prompt exact de `donnees/generations/54f229461f9a4a2e86349dac8f617ccb` — celui
# qui a rendu un pèlerin debout de face sur un jeu vu de dessus.
TEMOIN = (
    "World: Royaume de tourbe et de fer, marais au nord, vieux chemins boueux, "
    "ruines médiévales\n"
    "Era: Haut Moyen Âge, avant la poudre\n"
    "Rendering technique: 2D pixel art on a 64x64 grid\n"
    "Line and shading: Rendering: crisp pixel art, hard-edged 1-pixel dark brown "
    "outline, flat color fills, discrete pixel clusters, no gradients, no "
    "anti-aliasing, no soft edges\n"
    "Lighting: Lumière rasante, ambiance sombre, ombres portées courtes\n"
    "View and framing: Camera: strict 90-degree top-down view, directly overhead, "
    "zero perspective, zero camera elevation, no 3/4 view\n"
    "Technical constraints: Sprite isolé sur fond plat, grille stricte 64×64 px, "
    "pas de perspective\n"
    "\n"
    "Character design:\n"
    "- dark green hooded cape\n"
    "- beige tunic underneath\n"
    "- brown boots\n"
    "- small leather backpack\n"
    "- handheld torch, idle stance, full body"
)

# Ce que P4 de l'étude propose : une phrase par rôle d'image. Celle-ci est le
# rôle `style` — la carte du tableau, le concept art, l'image d'ambiance.
IMAGE_DITE = (
    "\n\nThe attached image shows the same character, for identity only: copy its "
    "hood, cape, tunic, backpack, torch and colours. Do NOT copy its camera angle, "
    "its pose, or its layout — that image is drawn from the front, and this one "
    "must be drawn from straight above."
)

# Ce que P1 et P2 proposent : la caméra reprise en dernier, en impératif, en mots
# qui décrivent **ce qu'on doit voir** plutôt que l'angle qu'on refuse.
CAMERA_EN_QUEUE = (
    "\n\nCAMERA — this overrides everything above. The camera is a strict 90-degree "
    "overhead camera looking straight down at the ground. You see the top of the "
    "head and the shoulders from above. The face is not visible. The feet are "
    "hidden under the body. Not a side view, not a three-quarter view, not a front "
    "view, no horizon, no perspective."
)

# Ce que P3 propose : la pose composée de l'attitude **et** de la caméra, au lieu
# d'une phrase écrite une fois pour les huit vues.
POSE_AUJOURDHUI = "handheld torch, idle stance, full body"
POSE_DE_LA_VUE = (
    "handheld torch\n"
    "\n"
    "Pose: standing still, arms down, weight even on both feet — seen from "
    "directly above, so the top of the hood and the shoulders fill the sprite, "
    "the feet are hidden under the body, and the face is not visible."
)

# Ce que P5 propose : composé des interdits de la vue, du rendu et du cadrage.
# L'adaptateur du produit le replie déjà sous cette forme exacte.
NEGATIF = (
    "\n\nDo not include: side view, three-quarter view, front view, isometric view, "
    "perspective, horizon line, ground plane, character standing on a baseline, "
    "visible face, background scenery, multiple characters, text, watermark, "
    "gradients, anti-aliasing"
)

# Le bras B1 : deux images, et le prompt dit laquelle sert à quoi.
DEUX_IMAGES = (
    "\n\nTwo images are attached. The FIRST shows the character for identity only: "
    "copy its hood, cape, tunic, backpack, torch and colours, and nothing else. "
    "The SECOND is a camera guide: it shows the exact viewing angle and body "
    "layout to reproduce — a body seen from straight above, head at the centre, "
    "shoulders around it, no face. Draw the character of the first image with the "
    "camera and body layout of the second."
)

# Le bras B2, premier temps : refaire la chose **une fois** dans la bonne caméra.
# C'est l'idée de l'auteur — normaliser la référence avant de s'en servir.
REFERENT = (
    "A single 2D pixel art game sprite, drawn on a 64x64 grid: a hooded pilgrim "
    "seen from STRAIGHT ABOVE.\n"
    "\n"
    "SUBJECT — dark green hooded cape, beige tunic underneath, brown boots, small "
    "leather backpack, a lit torch held in one hand. The attached image shows this "
    "same character, for identity only: copy its colours, its outfit and its "
    "proportions. Do NOT copy its camera angle or its pose — that image is drawn "
    "from the front.\n"
    "\n"
    "STYLE — crisp pixel art, hard-edged 1-pixel dark brown outline, flat colour "
    "fills, no gradients, no anti-aliasing. A peat-and-iron marsh kingdom, early "
    "Middle Ages. Low raking light, dark mood.\n"
    "\n"
    "FRAMING — one single sprite, centred, on a plain flat background, nothing "
    "else in the image.\n"
    "\n"
    "CAMERA — this overrides everything above. A strict 90-degree overhead camera "
    "looking straight down at the ground. You see the top of the hood and the "
    "shoulders from above; the face is not visible; the feet are hidden under the "
    "body. Not a side view, not a three-quarter view, not a front view. No "
    "horizon, no perspective, no ground plane."
)

# Le bras B2, second temps : la même pose qu'au témoin, mais la référence est
# l'image du premier temps — celle qui **est d'accord** avec le texte.
REFERENT_POSE = (
    "A single 2D pixel art game sprite, drawn on a 64x64 grid: the hooded pilgrim "
    "of the attached image, seen from STRAIGHT ABOVE.\n"
    "\n"
    "The attached image is the same character already drawn in the right camera. "
    "Keep it recognisably the same: same colours, same outfit, same proportions, "
    "same camera angle.\n"
    "\n"
    "POSE — standing still, arms down, weight even on both feet.\n"
    "\n"
    "STYLE — crisp pixel art, hard-edged 1-pixel dark brown outline, flat colour "
    "fills, no gradients, no anti-aliasing.\n"
    "\n"
    "FRAMING — one single sprite, centred, on a plain flat background, nothing "
    "else in the image.\n"
    "\n"
    "CAMERA — a strict 90-degree overhead camera looking straight down. The face "
    "is not visible."
)

# Le bras A5 : le prompt entièrement recomposé selon les six pièces de l'étude.
TOUT = (
    "A single 2D pixel art game sprite, drawn on a 64x64 grid: a hooded pilgrim, "
    "seen from STRAIGHT ABOVE.\n"
    "\n"
    "SUBJECT — dark green hooded cape, beige tunic underneath, brown boots, small "
    "leather backpack, a lit torch held in one hand.\n"
    "\n"
    "POSE — standing still, arms down, weight even on both feet. Seen from "
    "directly above: the top of the hood and the shoulders fill the sprite, the "
    "feet are hidden under the body, the face is not visible.\n"
    "\n"
    "STYLE — crisp pixel art, hard-edged 1-pixel dark brown outline, flat colour "
    "fills, discrete pixel clusters, no gradients, no anti-aliasing, no soft "
    "edges. A peat-and-iron marsh kingdom, marshes to the north, old muddy tracks, "
    "medieval ruins. Early Middle Ages, before gunpowder. Low raking light, dark "
    "mood, short cast shadow.\n"
    "\n"
    "THE ATTACHED IMAGE — it shows the same character, for identity only. Copy its "
    "hood, cape, tunic, backpack, torch and colours. Do NOT copy its camera angle, "
    "its pose, or its layout: that image is drawn from the front, and this one "
    "must be drawn from straight above.\n"
    "\n"
    "FRAMING — one single sprite, centred, on a plain flat background, nothing "
    "else in the image.\n"
    "\n"
    "CAMERA — this overrides everything above. A strict 90-degree overhead camera "
    "looking straight down at the ground. You see the top of the head and the "
    "shoulders from above. The face is not visible. The feet are hidden under the "
    "body. Not a side view, not a three-quarter view, not a front view. No "
    "horizon, no perspective, no ground plane."
    f"{NEGATIF}"
)


# ─────────────────────────────────────────────────────────────────────────────
# Le gabarit de silhouette — dessiné ici, jamais payé
# ─────────────────────────────────────────────────────────────────────────────


def gabarit_silhouette() -> bytes:
    """Un corps humanoïde vu d'aplomb, en aplats, sans style.

    **Il ne dit rien du personnage et tout de la caméra** : une tête ronde au
    centre, deux épaules autour, deux mains qui dépassent, aucun visage, aucun
    pied. C'est très exactement ce qu'un corps donne quand on le regarde de
    dessus, et c'est ce qu'aucune phrase ne sait montrer.

    Dessiné sur la machine parce qu'une image de cadrage **ne doit pas avoir de
    style** : la payer à un modèle lui en donnerait un, et on mesurerait alors
    deux choses à la fois.
    """
    cote = 512
    image = Image.new("RGB", (cote, cote), (235, 235, 235))
    trace = ImageDraw.Draw(image)
    c = cote // 2
    corps = (90, 100, 110)
    tete = (140, 150, 160)
    membre = (115, 125, 135)
    # Les épaules : une ellipse large et courte, c'est le buste vu d'aplomb.
    trace.ellipse((c - 130, c - 95, c + 130, c + 105), fill=corps)
    # Les bras, de part et d'autre, presque entièrement masqués par les épaules.
    trace.ellipse((c - 175, c - 30, c - 105, c + 90), fill=membre)
    trace.ellipse((c + 105, c - 30, c + 175, c + 90), fill=membre)
    # La tête, au centre, par-dessus tout le reste : vu de dessus, elle cache le
    # visage et une partie du buste.
    trace.ellipse((c - 80, c - 85, c + 80, c + 75), fill=tete)
    tampon = SORTIE / "_gabarit.png"
    tampon.parent.mkdir(parents=True, exist_ok=True)
    image.save(tampon)
    octets = tampon.read_bytes()
    tampon.unlink()
    return octets


# ─────────────────────────────────────────────────────────────────────────────
# Les neuf bras
# ─────────────────────────────────────────────────────────────────────────────

# `refs` dit combien d'images partent et lesquelles :
#   "carte"      la planche de face du projet, celle qui part aujourd'hui
#   "aucune"     rien
#   "deux"       la carte, puis le gabarit de silhouette
#   "referent"   l'image rendue par le premier temps du même bras
BRAS: tuple[tuple[str, str, str, str], ...] = (
    ("A0", "témoin", TEMOIN, "carte"),
    ("A1", "image dite", TEMOIN + IMAGE_DITE, "carte"),
    ("A2", "caméra en queue", TEMOIN + CAMERA_EN_QUEUE, "carte"),
    ("A3", "pose de la vue", TEMOIN.replace(POSE_AUJOURDHUI, POSE_DE_LA_VUE), "carte"),
    ("A4", "négatif", TEMOIN + NEGATIF, "carte"),
    ("A5", "tout", TOUT, "carte"),
    ("A6", "sans image", TEMOIN, "aucune"),
    ("B1", "silhouette", TEMOIN + DEUX_IMAGES, "deux"),
    ("B2a", "référent", REFERENT, "carte"),
    ("B2b", "pose sur référent", REFERENT_POSE, "referent"),
)


def references_de(clef: str, jet: int) -> list[bytes]:
    if clef == "aucune":
        return []
    carte = REFERENCE.read_bytes()
    if clef == "carte":
        return [carte]
    if clef == "deux":
        return [carte, gabarit_silhouette()]
    if clef == "referent":
        # Le référent du même jet : chaque jet a le sien, sinon on mesurerait le
        # référent le plus chanceux et non le mécanisme.
        fichier = SORTIE / f"B2a-{jet}.png"
        if not fichier.exists():
            raise RuntimeError(f"le référent du jet {jet} n'est pas là — B2a d'abord")
        return [fichier.read_bytes()]
    raise RuntimeError(f"référence inconnue : {clef}")  # pragma: no cover


# ─────────────────────────────────────────────────────────────────────────────
# Montrer, vérifier, payer
# ─────────────────────────────────────────────────────────────────────────────


def montrer() -> None:
    print(f"modèle {MODELE} · options {OPTIONS} · {len(JETS)} jets par bras")
    print(f"référence : {REFERENCE.name} — {REFERENCE.stat().st_size} octets\n")
    for code, nom, prompt, refs in BRAS:
        images = {"carte": 1, "aucune": 0, "deux": 2, "referent": 1}[refs]
        print("─" * 78)
        print(f"{code} · {nom}  —  {images} image(s) jointe(s), {len(prompt)} caractères")
        print("─" * 78)
        for ligne in prompt.splitlines():
            print(textwrap.fill(ligne, 76) if ligne else "")
        print()


def verifier(cle: str) -> int:
    """Tout prouver avant qu'un centime parte. Rend 1 dès qu'une preuve manque."""
    manques: list[str] = []
    if not cle:
        manques.append("aucune clé OpenRouter")
    if not REFERENCE.exists():
        manques.append(f"référence absente : {REFERENCE}")
    catalogue = charger_catalogue()
    modele = catalogue.get(MODELE)
    if modele is None:
        manques.append(f"{MODELE} absent du catalogue")
    else:
        gardees, ecartees = options_retenues(modele, OPTIONS)
        print(f"options retenues : {gardees}")
        if ecartees:
            manques.append(f"options écartées en silence : {ecartees}")
        places = refs_max(modele)
        print(f"places de référence chez {MODELE} : {places}")
        if places < 2:
            manques.append(f"le bras B1 demande 2 images, le modèle en prend {places}")
    # Le témoin doit être le texte payé, mot pour mot.
    paye = (
        RACINE.parent
        / "donnees"
        / "generations"
        / "54f229461f9a4a2e86349dac8f617ccb"
        / "generation.json"
    )
    if paye.exists():
        reel = json.loads(paye.read_text(encoding="utf-8"))["demande"]["prompt"]
        if reel.strip() != TEMOIN.strip():
            manques.append("le témoin n'est pas le prompt payé, mot pour mot")
        else:
            print("témoin : identique au prompt payé le 1ᵉʳ septembre 2026")
    # Le bras A3 doit vraiment avoir remplacé la phrase de pose.
    if POSE_AUJOURDHUI in BRAS[3][2]:
        manques.append("A3 n'a pas remplacé la phrase de pose")
    else:
        print("A3 : « full body » a bien disparu")
    appels = len(JETS) * len(BRAS)
    print(f"\nappels prévus : {appels} · note attendue ≈ {appels * 0.0093:.2f} $")
    for manque in manques:
        print(f"  MANQUE — {manque}")
    return 1 if manques else 0


def un_appel(cle: str, catalogue: dict, code: str, prompt: str, refs: str, jet: int):
    fichier = SORTIE / f"{code}-{jet}.png"
    if fichier.exists():
        return code, jet, 0.0, "déjà là"
    gardees, _ = options_retenues(catalogue[MODELE], OPTIONS)
    images = references_de(refs, jet)
    debut = time.time()
    try:
        octets, cout = generer_multi(cle, MODELE, prompt, images, gardees)
    except RuntimeError as erreur:
        return code, jet, 0.0, f"ÉCHEC — {erreur}"
    fichier.write_bytes(octets)
    return (
        code,
        jet,
        cout,
        f"{dimensions_png(octets)} · {cout:.4f} $ · {time.time() - debut:.1f} s",
    )


def generer_multi(cle: str, modele: str, prompt: str, images, options):
    """`generer` ne prend qu'une image ; le bras B1 en demande deux."""
    import base64
    import json as _json
    import urllib.error
    import urllib.request

    corps = corps_requete(modele, prompt, None, options)
    if images:
        corps["input_references"] = [
            {
                "type": "image_url",
                "image_url": {
                    "url": "data:image/png;base64,"
                    + base64.b64encode(octets).decode("ascii")
                },
            }
            for octets in images
        ]
    requete = urllib.request.Request(
        "https://openrouter.ai/api/v1/images",
        data=_json.dumps(corps).encode("utf-8"),
        headers={"Authorization": f"Bearer {cle}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=300) as reponse:
            resultat = _json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"HTTP {erreur.code} — {detail}") from None
    donnees = resultat.get("data") or []
    if not donnees or not donnees[0].get("b64_json"):
        raise RuntimeError(f"aucune image : {_json.dumps(resultat)[:300]}")
    cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
    return base64.b64decode(donnees[0]["b64_json"]), cout


def payer(cle: str) -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    catalogue = charger_catalogue()
    total = 0.0
    # **Les deux temps de B2 sont séquentiels**, et rien d'autre ne l'est : le
    # second lit l'image que le premier vient d'écrire.
    ordinaires = [b for b in BRAS if b[0] != "B2b"]
    suite = [b for b in BRAS if b[0] == "B2b"]
    for lot in (ordinaires, suite):
        taches = [(code, prompt, refs, jet) for code, _, prompt, refs in lot for jet in JETS]
        with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
            futurs = [
                pool.submit(un_appel, cle, catalogue, code, prompt, refs, jet)
                for code, prompt, refs, jet in taches
            ]
            for futur in futurs:
                code, jet, cout, dit = futur.result()
                total += cout
                print(f"  {code}-{jet}  {dit}")
    print(f"\nnote : {total:.3f} $")
    JOURNAL.write_text(
        json.dumps(
            {
                "modele": MODELE,
                "options": OPTIONS,
                "jets": list(JETS),
                "bras": [{"code": c, "nom": n, "images": r} for c, n, _, r in BRAS],
                "note_usd": round(total, 4),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def relever() -> None:
    """Le jugement écrit à la main, relu et compté. **Une seule question par
    image** : voit-on le dessus de la tête (`dessus`) ou le visage (`face`) ?"""
    if not JUGEMENTS.exists():
        print(f"aucun jugement — écrire {JUGEMENTS.name}")
        return
    juges = json.loads(JUGEMENTS.read_text(encoding="utf-8"))
    print(f"{'bras':22} {'de dessus':>10}  {'sur':>3}")
    for code, nom, _, _ in BRAS:
        rendus = [juges.get(f"{code}-{jet}") for jet in JETS]
        connus = [r for r in rendus if r]
        dessus = sum(1 for r in connus if r == "dessus")
        if connus:
            print(f"{code} · {nom:16} {dessus:>10}  {len(connus):>3}")


def principal() -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--verifier", action="store_true")
    parseur.add_argument("--payer", action="store_true")
    parseur.add_argument("--relever", action="store_true")
    arguments = parseur.parse_args()
    cle = lire_cle()
    if arguments.verifier:
        return verifier(cle)
    if arguments.relever:
        relever()
        return 0
    if arguments.payer:
        if verifier(cle):
            print("\nrien n'est parti.")
            return 1
        payer(cle)
        return 0
    montrer()
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
