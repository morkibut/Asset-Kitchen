# -*- coding: utf-8 -*-
"""La grille en création — un modèle sait-il remplir des cases vides de poses neuves ?

**C'est l'essai qui décide de C2.** La décision du 28 août fait du pliage en
grille carrée une **fonction générale de l'atelier** — habiller N images d'un
seul appel — et non un dispositif d'animation. Toute l'économie de la V2 en
dépend : si une planche de neuf poses coûte un appel au lieu de neuf, le
personnage devient abordable ; sinon la taille de lot n'est plus un choix, c'est
une facture.

Ce que le dépôt sait déjà, et ce qu'il ne sait pas :

  · `docs/archi-versions.md` §8 raconte l'observation du 26 août — `gemini-3.1-flash-image`
    a **calqué la mise en page de sa référence** : on demandait un sprite, il en a
    rendu trois alignés, puis l'appel suivant en a rendu trois dans la même
    disposition. D'où l'hypothèse : fournir un **gabarit** de cases vides et le
    laisser le remplir.
  · Mais cette observation est un accident, constaté **en édition** d'une planche
    qui existait. Ici les cases sont vides et les poses n'existent pas encore.
    **Personne n'a mesuré si un modèle sait créer dans une grille.**
  · Et §4 bis a mesuré l'inverse pour le voisinage : *« aucun modèle ne tient une
    grille de pixel constante à l'intérieur d'un lot »* — facteur 2,5 chez le
    gagnant. Mais c'était **entre appels**. Un seul appel fait peut-être mieux, et
    ce serait un argument de plus pour la planche.

Deux bras, et c'est toute la question :

    gabarit — le gabarit part en référence, et le prompt dit de remplir les cases
    libre   — le prompt seul décrit la planche, aucune référence

Six mesures, dont deux tranchent :

1. **Le compte.** Combien de sujets sont revenus, contre combien demandés. C'est
   un **contrat**, pas un jugement (décision 12 du 28 août : seul le compte
   refuse) — un modèle qui rend sept cases sur neuf est inutilisable tel quel.
2. **Les cases servies.** Chaque case de la grille idéale reçoit-elle exactement
   un sujet ? Un modèle peut rendre neuf sujets **et** les entasser.
3. **La parenté.** Les N sujets sont-ils le même personnage ?
4. **La redondance.** Sont-ils des poses *différentes* ? Une planche de neuf
   copies satisfait le compte et ne vaut rien. **C'est le piège de cet essai** :
   le compte et la parenté récompensent tous les deux le copier-coller.
5. **L'échelle interne.** Le sujet garde-t-il sa taille d'une case à l'autre ?
6. **La grille de pixel interne.** Le bloc de pixel reste-t-il constant ?

    py essais/essai_grille.py                 # ce qui est sur le disque, gratuit
    py essais/essai_grille.py --etalonner     # vérifie les mesures, gratuit
    py essais/essai_grille.py --gabarit       # écrit les gabarits et s'arrête
    py essais/essai_grille.py --verifier      # tout prouver avant de payer, gratuit
    py essais/essai_grille.py --payer         # les appels, ~0,91 $

**`--verifier` ne fait aucun appel payant et rend 1 dès qu'une preuve manque** :
le catalogue relu frais et non depuis le cache, les paramètres qui partent
vraiment contre ceux qu'on écarte en silence, le texte exact des quatre prompts
et l'empreinte des deux gabarits, la chaîne de mesure passée sur les 239 images
du disque — JPEG de Seedream et planches multi-sprites comprises —, la note
chiffrée par modèle, et le solde du compte. Il se lance après `--etalonner` et
avant `--payer` ; il n'y a pas de seconde chance.

**La note annoncée était de ~0,6 $ ; le calcul par modèle en donne 0,91 $** — le
bras « gabarit » paie une référence à `gpt-image-2`, et `gemini-3.1-flash` pèse à
lui seul 60 % de la note. Le chiffre corrigé est celui que `--verifier` recalcule.

**Sans `--payer`, aucun appel n'est fait**, et une planche déjà là est sautée
même avec : relancer ne repaie jamais. La passe payante télécharge et écrit, elle
ne mesure rien (`docs/PIEGES.md` — un lot payant écrit au fur et à mesure) ; la
mesure est une seconde passe, gratuite et rejouable.

Sortie : `essais/mesures_grille.json`, `essais/planches/grille.png`, et les
planches sous `essais/resultats/grille/`, non versionnées.
"""

from __future__ import annotations

import argparse
import io
import itertools
import json
import statistics
import sys
import textwrap
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))
sys.path.insert(0, str(RACINE))

import numpy as np  # noqa: E402
import verifier as verification  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from atelier.domaine.recette import BORD, Passe, Recette  # noqa: E402
from atelier.image import detourer, grille_fixe, mesurer_grille, zones_opaques  # noqa: E402
from essai_identite import (  # noqa: E402
    charger_catalogue,
    corps_requete,
    generer,
    lire_cle,
    options_retenues,
    refs_max,
)

SORTIE = RACINE / "resultats" / "grille"
MESURES = RACINE / "mesures_grille.json"
PLANCHES = RACINE / "planches"
GABARITS = SORTIE / "gabarits"
JETS = (1, 2)
PARALLELE = 4
COTE = 1024

# ─────────────────────────────────────────────────────────────────────────────
# Ce qu'on compare
# ─────────────────────────────────────────────────────────────────────────────

# Trois modèles, chacun pour une raison. `gpt-image-2` est le défaut du produit
# (§4 bis) et c'est lui qu'il faut battre. `gemini-3.1-flash-image` est celui qui
# a **produit l'observation** de §9 — si le gabarit marche quelque part, c'est
# d'abord chez lui. `seedream-5.0-lite` est le second du banc 2, et il facture à
# l'image et non au token : une planche de neuf y coûte le prix d'une seule.
CONFIGURATIONS = [
    ("gpt-image-2_low",   "openai/gpt-image-2",               {"quality": "low"}),
    ("gemini-3.1-flash",  "google/gemini-3.1-flash-image",    {}),
    ("seedream-5.0-lite", "bytedance-seed/seedream-5-0-lite", {}),
]

COMMUN = {"aspect_ratio": "1:1"}

# 4 puis 9. Deux tailles parce que la question n'est pas « est-ce que ça
# marche » mais « jusqu'où » : un modèle qui tient quatre cases et lâche à neuf
# fixe la taille de lot du produit, et c'est un chiffre qu'il vaut mieux
# connaître avant d'écrire l'écran que après.
TAILLES = ((2, 2), (3, 3))

# Les poses, dans l'ordre de lecture. Choisies pour être **visuellement
# séparables** : si le modèle rend neuf fois la même chose, la redondance doit
# le dire, et deux poses proches — attente et attente-les-bras-croisés —
# rendraient la mesure illisible.
POSES = (
    "standing idle",
    "walking, mid-stride",
    "swinging the hammer overhead",
    "crouching low",
    "running fast",
    "struck and recoiling backwards",
    "jumping, both feet off the ground",
    "raising the hammer in a victory pose",
    "lying down defeated",
)

PERSONNAGE = (
    "a dwarf blacksmith with a braided dark beard, a green tunic, brown leather "
    "straps and boots, holding a heavy hammer"
)

STYLE = (
    "16-bit pixel art, thick dark outline, limited earthy palette, flat shading, "
    "crisp pixels"
)


def prompt_de(colonnes: int, lignes: int, gabarit: bool) -> str:
    cases = colonnes * lignes
    liste = "; ".join(f"{i}. {p}" for i, p in enumerate(POSES[:cases], start=1))
    commun = (
        f"A sprite sheet of {cases} pixel art sprites of the SAME character: {PERSONNAGE}. "
        f"Side view, facing right, full body. "
        f"Exactly {colonnes} columns and {lignes} rows, {cases} cells total, one single "
        f"sprite per cell, evenly spaced on a regular grid, every sprite the same height, "
        f"all standing on the same baseline. "
        f"The cells, in reading order, show: {liste}. "
        f"It must be the same character in every cell: same colors, same outfit, same "
        f"hammer, same proportions, same size, same pixel art style. "
        f"{STYLE}. Plain flat light gray background, no cell borders, no grid lines, "
        f"no text, no numbers, no frames, no ground shadow."
    )
    if not gabarit:
        return commun
    # **La consigne du gabarit dit deux choses, et la seconde est la piégeuse.**
    # Remplir les cases, oui — mais *ne pas redessiner leurs bords*. Un modèle qui
    # recopie la structure de son entrée (§9) recopiera aussi les traits qui la
    # dessinent, et une planche quadrillée de traits gris n'est pas découpable :
    # le détourage lit un fond plat sur la bordure, et les traits deviendraient
    # du sujet.
    return (
        f"{commun} The attached image is the exact layout to follow: it shows "
        f"{cases} empty cells. Draw one sprite inside each cell, keeping the cells "
        f"at their positions and sizes. Do NOT draw the cell outlines in your image — "
        f"the background must stay one plain flat light gray, with no visible cell "
        f"borders and no separating lines."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Le gabarit
# ─────────────────────────────────────────────────────────────────────────────

FOND = (235, 235, 235)
TRAIT = (198, 198, 198)


def gabarit(colonnes: int, lignes: int) -> bytes:
    """Des cases vides, dessinées d'un trait clair sur le fond du produit.

    **Le trait est à peine plus foncé que le fond, et c'est délibéré.** Le
    gabarit doit dire « voici les emplacements » sans dire « voici un dessin à
    reproduire ». `ARCHITECTURE.md` §4 bis a un piège de fournisseur exactement
    là : `riverflow` et `flux2-klein-4b` recopient la référence au lieu de s'en
    inspirer. Un cadre noir épais aurait de bonnes chances de revenir tel quel
    dans la sortie, et on mesurerait la recopie au lieu du remplissage.
    """
    image = Image.new("RGB", (COTE, COTE), FOND)
    dessin = ImageDraw.Draw(image)
    marge, gouttiere = 40, 24
    large = (COTE - 2 * marge - gouttiere * (colonnes - 1)) // colonnes
    haut = (COTE - 2 * marge - gouttiere * (lignes - 1)) // lignes
    for ligne in range(lignes):
        for colonne in range(colonnes):
            x0 = marge + colonne * (large + gouttiere)
            y0 = marge + ligne * (haut + gouttiere)
            dessin.rectangle([x0, y0, x0 + large, y0 + haut], outline=TRAIT, width=3)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def ecrire_gabarits() -> int:
    GABARITS.mkdir(parents=True, exist_ok=True)
    for colonnes, lignes in TAILLES:
        chemin = GABARITS / f"gabarit_{colonnes}x{lignes}.png"
        chemin.write_bytes(gabarit(colonnes, lignes))
        print(f"  {chemin.relative_to(RACINE.parent)}")
    print("\n  Aucun appel. Les regarder avant de payer : c'est ce que le modèle verra.")
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# La mesure
# ─────────────────────────────────────────────────────────────────────────────

def _rgba(octets: bytes) -> np.ndarray:
    return detourer(Recette(passes=(Passe(moteur=BORD),)), octets)


def _png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


def _histogramme(crop: np.ndarray) -> np.ndarray:
    """La signature de couleur d'un sujet — 4×4×4 cases de RVB, sur l'opaque seul.

    Grossier exprès. On ne compare pas des images, on demande « est-ce le même
    personnage » : un histogramme fin distinguerait deux poses du même nain par
    la seule quantité de peau visible, et répondrait non à chaque fois.
    """
    opaques = crop[crop[:, :, 3] >= 128][:, :3].astype(np.int32) // 64
    if opaques.size == 0:
        return np.zeros(64, dtype=np.float64)
    plats = opaques[:, 0] * 16 + opaques[:, 1] * 4 + opaques[:, 2]
    compte = np.bincount(plats, minlength=64).astype(np.float64)
    norme = np.linalg.norm(compte)
    return compte / norme if norme else compte


def _silhouette(crop: np.ndarray, cote: int = 64) -> np.ndarray:
    """Le masque du sujet, étiré dans un carré commun.

    L'étirement est ce qui rend la comparaison possible : deux poses n'ont pas
    la même boîte, et les comparer dans leurs boîtes respectives mesurerait
    surtout la différence de cadrage.
    """
    masque = Image.fromarray((crop[:, :, 3] >= 128).astype(np.uint8) * 255, "L")
    return np.asarray(masque.resize((cote, cote), Image.Resampling.BILINEAR)) >= 128


def _paires(valeurs: list) -> list[tuple]:
    return list(itertools.combinations(range(len(valeurs)), 2))


def mesurer_planche(octets: bytes, colonnes: int, lignes: int) -> dict:
    rgba = _rgba(octets)
    hauteur, largeur = rgba.shape[:2]
    boites = zones_opaques(rgba[:, :, 3])
    demande = colonnes * lignes

    mesure: dict = {
        "demande": demande,
        "compte": len(boites),
        "cases_servies": 0.0,
        "parente": None,
        "redondance": None,
        "echelle_interne": None,
        "grille_px": None,
        "grille_derive": None,
    }
    if not boites:
        return mesure

    # Chaque sujet dans la case idéale où tombe son centre. Une case qui en
    # reçoit deux, ou zéro, n'est pas servie — et c'est la différence entre
    # « il a rendu neuf sujets » et « il a rempli neuf cases ».
    cases = grille_fixe(largeur, hauteur, colonnes, lignes)
    occupants = [0] * len(cases)
    for x0, y0, x1, y1 in boites:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for index, (a, b, c, d) in enumerate(cases):
            if a <= cx <= c and b <= cy <= d:
                occupants[index] += 1
                break
    mesure["cases_servies"] = round(sum(1 for n in occupants if n == 1) / len(cases), 4)

    crops = [rgba[y0 : y1 + 1, x0 : x1 + 1] for x0, y0, x1, y1 in boites]
    hauteurs = [c.shape[0] for c in crops]
    mesure["echelle_interne"] = round(max(hauteurs) / max(1, min(hauteurs)), 3)

    if len(crops) > 1:
        signatures = [_histogramme(c) for c in crops]
        mesure["parente"] = round(statistics.median(
            float(np.dot(signatures[i], signatures[j])) for i, j in _paires(crops)
        ), 4)

        masques = [_silhouette(c) for c in crops]
        recouvrements = []
        for i, j in _paires(crops):
            union = int((masques[i] | masques[j]).sum())
            recouvrements.append(int((masques[i] & masques[j]).sum()) / union if union else 1.0)
        mesure["redondance"] = round(statistics.median(recouvrements), 4)

    periodes = []
    for crop in crops:
        periode, confiance = mesurer_grille(_png(crop))
        if confiance > 0:
            periodes.append(periode)
    if periodes:
        mesure["grille_px"] = round(statistics.median(periodes), 2)
        mesure["grille_derive"] = round(max(periodes) / max(1, min(periodes)), 2)
    return mesure


# ─────────────────────────────────────────────────────────────────────────────
# La passe payante
# ─────────────────────────────────────────────────────────────────────────────

VERROU = threading.Lock()
EXTENSIONS = ((b"\x89PNG", "png"), (b"\xff\xd8", "jpg"), (b"RIFF", "webp"))


def _extension(octets: bytes) -> str:
    for magie, nom in EXTENSIONS:
        if octets.startswith(magie):
            return nom
    return "bin"


def _existe(dossier: Path, nom: str) -> Path | None:
    return next(iter(sorted(dossier.glob(f"{nom}.*"))), None)


def executer(cle: str, catalogue: dict, jet: int, etiquette: str,
             identifiant: str, propres: dict) -> None:
    fiche = catalogue.get(identifiant)
    if fiche is None:
        with VERROU:
            print(f"jet{jet} · {etiquette:20} absent du catalogue — saute")
        return

    dossier = SORTIE / f"jet{jet}" / etiquette
    dossier.mkdir(parents=True, exist_ok=True)
    options, ecartees = options_retenues(fiche, {**COMMUN, **propres})
    journal = [f"jet{jet} · {etiquette:20} [{identifiant}]"
               + (f"   (ecarte : {', '.join(ecartees)})" if ecartees else "")]
    total = 0.0

    for colonnes, lignes in TAILLES:
        for bras in ("gabarit", "libre"):
            nom = f"{bras}_{colonnes}x{lignes}"
            if _existe(dossier, nom):
                journal.append(f"        {nom:16} deja la — saute (aucun frais)")
                continue
            if bras == "gabarit" and refs_max(fiche) < 1:
                journal.append(f"        {nom:16} n'accepte aucune reference — saute")
                continue
            reference = gabarit(colonnes, lignes) if bras == "gabarit" else None
            depart = time.monotonic()
            try:
                octets, cout = generer(
                    cle, identifiant, prompt_de(colonnes, lignes, bras == "gabarit"),
                    reference, options,
                )
            except Exception as erreur:  # noqa: BLE001 — un essai ne s'arrete jamais
                journal.append(f"        {nom:16} ECHEC — {erreur}")
                continue
            (dossier / f"{nom}.{_extension(octets)}").write_bytes(octets)
            total += cout
            journal.append(
                f"        {nom:16} {time.monotonic() - depart:5.1f}s  ${cout:.4f}"
            )

    journal.append(f"        ── {total:.4f} $")
    with VERROU:
        print("\n".join(journal), flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# L'étalonnage
# ─────────────────────────────────────────────────────────────────────────────

def _planche_fabriquee(colonnes: int, lignes: int, varier: bool) -> bytes:
    """Une planche dont on connaît la réponse : N nains posés dans N cases.

    Deux cas, et c'est le second qui compte : **identique** met N fois le même
    sprite, **varie** le retourne et le déforme d'une case à l'autre. Si la
    redondance ne les sépare pas, elle ne saura pas non plus dire qu'un modèle a
    rendu neuf copies au lieu de neuf poses — et neuf copies passeraient alors
    pour un succès sur toutes les autres colonnes.
    """
    source = _rgba((RACINE / "guide" / "02_nain.png").read_bytes())
    lignes_op = np.flatnonzero((source[:, :, 3] >= 128).any(axis=1))
    colonnes_op = np.flatnonzero((source[:, :, 3] >= 128).any(axis=0))
    sujet = Image.fromarray(
        source[lignes_op[0] : lignes_op[-1] + 1, colonnes_op[0] : colonnes_op[-1] + 1], "RGBA"
    )

    image = Image.new("RGB", (COTE, COTE), FOND)
    marge, gouttiere = 40, 24
    large = (COTE - 2 * marge - gouttiere * (colonnes - 1)) // colonnes
    haut = (COTE - 2 * marge - gouttiere * (lignes - 1)) // lignes
    for index in range(colonnes * lignes):
        ligne, colonne = divmod(index, colonnes)
        piece = sujet
        if varier:
            if index % 2:
                piece = piece.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            etire = 1.0 + 0.18 * (index % 3)
            piece = piece.resize(
                (max(1, round(piece.width / etire)), piece.height), Image.Resampling.NEAREST
            )
        echelle = min((large - 20) / piece.width, (haut - 20) / piece.height)
        piece = piece.resize(
            (max(1, round(piece.width * echelle)), max(1, round(piece.height * echelle))),
            Image.Resampling.NEAREST,
        )
        x0 = marge + colonne * (large + gouttiere) + (large - piece.width) // 2
        y0 = marge + ligne * (haut + gouttiere) + (haut - piece.height) // 2
        image.paste(piece, (x0, y0), piece)

    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def etalonner() -> int:
    print("\nÉTALONNAGE — la mesure sur des planches dont on connaît la réponse\n")
    print(f"  {'cas':22} {'compte':>8} {'cases':>7} {'parenté':>8} "
          f"{'redond.':>8} {'échelle':>8}   attendu")
    for colonnes, lignes in TAILLES:
        for varier, etiquette in ((False, "identique"), (True, "varie")):
            mesure = mesurer_planche(
                _planche_fabriquee(colonnes, lignes, varier), colonnes, lignes
            )
            attendu = ("compte exact, redondance ≈ 100 %" if not varier
                       else "compte exact, redondance nettement plus basse")
            print(
                f"  {etiquette + f' {colonnes}x{lignes}':22} "
                f"{mesure['compte']:>4}/{mesure['demande']:<3} "
                f"{mesure['cases_servies']:>6.0%} "
                f"{(mesure['parente'] or 0):>7.1%} {(mesure['redondance'] or 0):>7.1%} "
                f"{(mesure['echelle_interne'] or 0):>8.2f}   {attendu}"
            )
    print(
        "\n  Ce que l'étalonnage doit prouver : le compte tombe juste sur une\n"
        "  planche que la détection n'a jamais vue, les cases sont servies à\n"
        "  100 %, et la redondance **sépare** neuf copies de neuf poses. Sans\n"
        "  cette dernière colonne, une planche de copies aurait l'air parfaite.\n"
    )
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# La vérification — cinq preuves, aucun appel payant, et un code de sortie
# ─────────────────────────────────────────────────────────────────────────────

def _restants() -> list[tuple[str, int, int]]:
    """Ce qui manque sur le disque, en séparant les appels avec et sans référence.

    La séparation n'est pas cosmétique : chez `gpt-image-2`, une référence fait
    passer l'appel de $0,0064 à $0,0144 (§4 bis). Compter les 24 appels au même
    tarif fausserait la note de moitié sur ce modèle.
    """
    appels: list[tuple[str, int, int]] = []
    for etiquette, _, _ in CONFIGURATIONS:
        avec = sans = 0
        for jet in JETS:
            dossier = SORTIE / f"jet{jet}" / etiquette
            for colonnes, lignes in TAILLES:
                for bras in ("gabarit", "libre"):
                    if _existe(dossier, f"{bras}_{colonnes}x{lignes}") is not None:
                        continue
                    if bras == "gabarit":
                        avec += 1
                    else:
                        sans += 1
        appels.append((etiquette, avec, sans))
    return appels


def _avec_cadre(planche: bytes, colonnes: int, lignes: int) -> bytes:
    """La même planche, plus les traits du gabarit — le cas « le modèle a recopié ».

    Fabriquée avec exactement le même tracé que `gabarit()`, sinon on mesurerait
    l'effet d'un cadre inventé pour l'occasion et non celui du cadre envoyé.
    """
    with Image.open(io.BytesIO(planche)) as ouverte:
        image = ouverte.convert("RGB")
    traits = Image.open(io.BytesIO(gabarit(colonnes, lignes))).convert("RGB")
    tableau, cadre = np.asarray(image).copy(), np.asarray(traits)
    tableau[(cadre != np.array(FOND, dtype=np.uint8)).any(axis=2)] = TRAIT
    tampon = io.BytesIO()
    Image.fromarray(tableau, "RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _contraste(octets: bytes) -> tuple[int, int]:
    """Combien de niveaux séparent le trait du fond, et combien de pixels il occupe.

    Mesuré **après l'aller-retour PNG**, pas sur les constantes : un trait qu'un
    encodage aplatirait ne dirait plus rien au modèle, et on paierait un bras
    « gabarit » qui n'aurait jamais vu de gabarit.
    """
    with Image.open(io.BytesIO(octets)) as image:
        gris = np.asarray(image.convert("L"), dtype=np.int16)
    niveaux, comptes = np.unique(gris, return_counts=True)
    dominant = int(niveaux[int(np.argmax(comptes))])
    autres = niveaux[niveaux != dominant]
    if autres.size == 0:
        return 0, 0
    ecart = int(np.abs(autres - dominant).max())
    return ecart, int(comptes[niveaux != dominant].sum())


def verifier() -> int:
    verification.utf8()
    rapport = verification.Rapport("la grille en création — l'essai qui décide de C2")

    # ── 1 ────────────────────────────────────────────────────────────────────
    section = rapport.section("Le catalogue, relu frais — et non depuis le cache")
    frais = verification.preuve_catalogue(section, CONFIGURATIONS)

    # ── 2 ────────────────────────────────────────────────────────────────────
    section = rapport.section("Ce qui part vraiment, et ce qui tombe en silence")
    if not frais:
        section.rouge("pas de catalogue frais — impossible de dire ce qui partira")
    else:
        # Seul le bras « gabarit » envoie une référence ; le bras « libre » n'en
        # envoie aucune, et c'est justement ce qu'on compare.
        verification.preuve_parametres(
            section, CONFIGURATIONS, COMMUN, frais,
            {etiquette: True for etiquette, _, _ in CONFIGURATIONS},
        )
        section.dit("\n  Et les deux corps POST tels que `generer()` les construira, "
                    "en 3×3 :")
        for etiquette, identifiant, propres in CONFIGURATIONS:
            fiche = frais.get(identifiant)
            if fiche is None:
                continue
            options, _ = options_retenues(fiche, {**COMMUN, **propres})
            section.dit(f"\n  {etiquette}")
            for bras, reference in (("gabarit", gabarit(3, 3)), ("libre", None)):
                verification.preuve_corps(
                    section,
                    corps_requete(identifiant, prompt_de(3, 3, bras == "gabarit"),
                                  reference, options),
                    bras,
                )

    # ── 3 ────────────────────────────────────────────────────────────────────
    section = rapport.section(
        "Le texte exact des prompts, et le gabarit qui part en référence"
    )
    for colonnes, lignes in TAILLES:
        for bras in ("gabarit", "libre"):
            section.dit(f"\n  ── {bras}_{colonnes}x{lignes}"
                        f"   ({colonnes * lignes} cases demandées)")
            for ligne in textwrap.wrap(prompt_de(colonnes, lignes, bras == "gabarit"), 72):
                section.dit(f"     {ligne}")
    section.vert(
        f"{len(TAILLES) * 2} prompts, identiques pour les {len(CONFIGURATIONS)} "
        f"modèles — seuls le modèle et le bras changent"
    )

    section.dit("\n  Les gabarits, tels qu'ils partiront en référence :")
    GABARITS.mkdir(parents=True, exist_ok=True)
    for colonnes, lignes in TAILLES:
        octets = gabarit(colonnes, lignes)
        chemin = GABARITS / f"gabarit_{colonnes}x{lignes}.png"
        # Le fichier n'est pas ce qui part — `executer()` rappelle `gabarit()`.
        # On l'écrit pour qu'il soit regardable, et on vérifie qu'il dit la même
        # chose : un gabarit sur disque qui aurait divergé du code se regarderait
        # à la place de celui qu'on envoie.
        avant = chemin.read_bytes() if chemin.exists() else None
        if avant != octets:
            chemin.write_bytes(octets)
        verification.preuve_reference(
            section, octets, f"gabarit {colonnes}×{lignes}",
            str(chemin.relative_to(RACINE.parent))
            + ("" if avant is None else
               " (identique à celui du disque)" if avant == octets
               else " (le fichier du disque avait divergé — réécrit)"),
        )
        ecart, pixels = _contraste(octets)
        lisible = f"{pixels:,}".replace(",", " ")
        section.dit(f"          trait à {ecart} niveaux du fond, sur "
                    f"{pixels / (COTE * COTE):.1%} de l'image ({lisible} pixels)")
        if ecart < 12:
            section.rouge(
                f"gabarit {colonnes}×{lignes} : {ecart} niveaux d'écart, le trait "
                f"risque de ne rien dire au modèle — le bras « gabarit » serait "
                f"payé pour rien"
            )
        else:
            section.vert(
                f"gabarit {colonnes}×{lignes} : le trait survit à l'encodage "
                f"({ecart} niveaux d'écart)"
            )

        # **Ce que la mesure dira si le modèle recopie le cadre.** Le prompt le
        # lui interdit deux fois, et c'est le risque propre à ce bras (§4 bis :
        # `riverflow` et `flux2-klein-4b` recopient leur référence). Le piège
        # n'est pas celui qu'on croit : le compte reste **juste**, puisque chaque
        # cadre encercle son sujet et fait une seule zone connexe. C'est la
        # redondance qui ment — chaque découpe est alors dominée par son cadre,
        # et neuf poses différentes se ressemblent soudain. On le chiffre ici,
        # sur une planche variée où l'on a posé les traits du gabarit par-dessus.
        propre = mesurer_planche(
            _planche_fabriquee(colonnes, lignes, True), colonnes, lignes
        )
        quadrillee = mesurer_planche(
            _avec_cadre(_planche_fabriquee(colonnes, lignes, True), colonnes, lignes),
            colonnes, lignes,
        )
        section.jaune(
            f"si un modèle recopiait les traits du gabarit {colonnes}×{lignes}, le "
            f"compte resterait juste ({quadrillee['compte']}/{quadrillee['demande']}) "
            f"mais la redondance passerait de {(propre['redondance'] or 0):.0%} à "
            f"{(quadrillee['redondance'] or 0):.0%} — neuf poses distinctes se "
            f"liraient alors comme neuf copies. À vérifier à l'œil avant de lire "
            f"cette colonne sur le bras « gabarit »"
        )

    # ── 4 ────────────────────────────────────────────────────────────────────
    section = rapport.section(
        "La chaîne de mesure, sur tout ce qui est déjà sur le disque"
    )
    temoins = []
    for colonnes, lignes in TAILLES:
        for varier, nom in ((False, "identique"), (True, "varie")):
            mesure = mesurer_planche(
                _planche_fabriquee(colonnes, lignes, varier), colonnes, lignes
            )
            temoins.append((f"{nom} {colonnes}x{lignes}", mesure))
    section.dit("  les quatre planches fabriquées, dont on connaît la réponse :")
    for nom, mesure in temoins:
        section.dit(f"      {nom:16} compte {mesure['compte']}/{mesure['demande']}, "
                    f"cases {mesure['cases_servies']:.0%}, "
                    f"redondance {(mesure['redondance'] or 0):.0%}")
    justes = all(m["compte"] == m["demande"] and m["cases_servies"] >= 0.999
                 for _, m in temoins)
    separe = all(
        dict(temoins)[f"identique {c}x{l}"]["redondance"]
        - dict(temoins)[f"varie {c}x{l}"]["redondance"] > 0.30
        for c, l in TAILLES
    )
    if justes and separe:
        section.vert(
            "compte exact et cases servies à 100 % sur les quatre, et la "
            "redondance sépare les copies des poses de plus de 30 points"
        )
    else:
        section.rouge(
            "l'étalonnage ne tient pas : "
            + ("le compte ou les cases sont faux ; " if not justes else "")
            + ("la redondance ne sépare pas les copies des poses" if not separe else "")
        )
    section.dit()

    def mesurer_une(octets: bytes, _chemin: Path) -> dict:
        return {
            f"{colonnes}x{lignes}": mesurer_planche(octets, colonnes, lignes)
            for colonnes, lignes in TAILLES
        }

    resultats = verification.preuve_corpus(section, mesurer_une, attendu=239)
    section.dit()
    verification.preuve_planches(
        section, resultats, lambda r: max(m["compte"] for m in r.values())
    )

    # ── 5 ────────────────────────────────────────────────────────────────────
    section = rapport.section("La note, modèle par modèle")
    note = verification.preuve_note(section, _restants(), annonce=0.91)

    # ── 6 ────────────────────────────────────────────────────────────────────
    section = rapport.section("La clé, le solde, le disque")
    verification.preuve_cle(section, note)
    verification.preuve_disque(section, [SORTIE, GABARITS, PLANCHES])

    return rapport.bilan("py essais/essai_grille.py")


# ─────────────────────────────────────────────────────────────────────────────
# La mesure sur le disque, et ce qu'on en retient
# ─────────────────────────────────────────────────────────────────────────────

def mesurer_tout() -> list[dict]:
    lignes: list[dict] = []
    for jet in JETS:
        for etiquette, identifiant, _ in CONFIGURATIONS:
            dossier = SORTIE / f"jet{jet}" / etiquette
            if not dossier.is_dir():
                continue
            for colonnes, rangees in TAILLES:
                for bras in ("gabarit", "libre"):
                    fichier = _existe(dossier, f"{bras}_{colonnes}x{rangees}")
                    if fichier is None:
                        continue
                    mesure = mesurer_planche(fichier.read_bytes(), colonnes, rangees)
                    lignes.append({
                        "jet": jet, "etiquette": etiquette, "modele": identifiant,
                        "bras": bras, "cases": f"{colonnes}x{rangees}",
                        "fichier": str(fichier.relative_to(RACINE)), **mesure,
                    })
                    print(f"  mesuré  jet{jet} · {etiquette:20} · {bras}_{colonnes}x{rangees}"
                          f"  → {mesure['compte']}/{mesure['demande']}")
    return lignes


def conclure(lignes: list[dict]) -> None:
    print("\n" + "═" * 78)
    print("  CE QU'ON EN RETIENT")
    print("═" * 78)
    if not lignes:
        print("\nRien sur le disque. Lancer avec --payer pour produire les planches.")
        return

    print("\n  Le compte d'abord — c'est le contrat, et il refuse tout seul.\n")
    print(f"  {'modèle':20} {'bras':8} {'cases':6} {'compte exact':>13} "
          f"{'cases servies':>14} {'parenté':>9} {'redond.':>9} {'échelle':>8}")
    for etiquette, _, _ in CONFIGURATIONS:
        for bras in ("gabarit", "libre"):
            for taille in (f"{c}x{l}" for c, l in TAILLES):
                siennes = [x for x in lignes if x["etiquette"] == etiquette
                           and x["bras"] == bras and x["cases"] == taille]
                if not siennes:
                    continue
                exact = sum(1 for x in siennes if x["compte"] == x["demande"])
                med = lambda cle: statistics.median(  # noqa: E731
                    x[cle] for x in siennes if x[cle] is not None
                ) if any(x[cle] is not None for x in siennes) else 0.0
                print(
                    f"  {etiquette:20} {bras:8} {taille:6} {exact}/{len(siennes):<12} "
                    f"{med('cases_servies'):>13.0%} {med('parente'):>8.1%} "
                    f"{med('redondance'):>8.1%} {med('echelle_interne'):>8.2f}"
                )

    def part_exacte(bras: str) -> tuple[int, int]:
        siennes = [x for x in lignes if x["bras"] == bras]
        return sum(1 for x in siennes if x["compte"] == x["demande"]), len(siennes)

    avec, avec_n = part_exacte("gabarit")
    sans, sans_n = part_exacte("libre")
    print(
        f"\n  **Le gabarit sert-il à quelque chose ?** compte exact "
        f"{avec}/{avec_n} avec, {sans}/{sans_n} sans."
    )
    if avec_n and sans_n:
        if avec / avec_n > sans / sans_n + 0.15:
            print("  Oui, nettement — l'hypothèse de §9 se confirme en création,")
            print("  et le gabarit devient une pièce du produit, pas un essai.")
        elif sans / sans_n > avec / avec_n + 0.15:
            print("  Non — et c'est un résultat : le gabarit coûte une référence")
            print("  (donc de l'argent, §4 bis) pour un compte moins bon. À écarter.")
        else:
            print("  Pas de différence franche. Alors on garde le moins cher :")
            print("  sans référence, `gpt-image-2` passe de $0,0124 à $0,0064.")

    copieurs = [x for x in lignes if (x["redondance"] or 0) > 0.90 and x["compte"] > 1]
    if copieurs:
        print(
            f"\n  **Attention — {len(copieurs)} planche(s) à redondance > 90 %.** "
            f"Le modèle a\n  rempli les cases avec la même pose. Le compte est bon, la "
            f"planche est\n  vide de sens : c'est le piège que cette colonne existe pour voir."
        )

    derives = [x["grille_derive"] for x in lignes if x.get("grille_derive")]
    if derives:
        print(
            f"\n  Grille de pixel **à l'intérieur d'un seul appel** : dérive médiane "
            f"{statistics.median(derives):.2f}×.\n"
            f"  §4 bis mesurait 2,5× entre appels chez le gagnant. Plus bas ici veut "
            f"dire\n  qu'une planche est aussi une façon d'acheter de la cohérence, pas "
            f"seulement\n  d'économiser des appels."
        )


def planche(lignes: list[dict]) -> None:
    if not lignes:
        return
    cote, marge = 300, 8
    ordonnees = sorted(lignes, key=lambda x: (x["cases"], x["bras"], x["etiquette"], x["jet"]))
    colonnes = max(1, min(4, len(ordonnees)))
    rangees = (len(ordonnees) + colonnes - 1) // colonnes
    feuille = Image.new(
        "RGB",
        (marge + (cote + marge) * colonnes, marge + (cote + marge) * rangees),
        (22, 24, 28),
    )
    for index, ligne in enumerate(ordonnees):
        with Image.open(RACINE / ligne["fichier"]) as ouverte:
            vignette = ouverte.convert("RGB")
        vignette.thumbnail((cote, cote), Image.Resampling.LANCZOS)
        rangee, colonne = divmod(index, colonnes)
        feuille.paste(vignette, (
            marge + (cote + marge) * colonne + (cote - vignette.width) // 2,
            marge + (cote + marge) * rangee + (cote - vignette.height) // 2,
        ))
    PLANCHES.mkdir(parents=True, exist_ok=True)
    chemin = PLANCHES / "grille.png"
    feuille.save(chemin)
    print(f"\n  planche contact : {chemin.relative_to(RACINE.parent)}")


# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    # La console Windows encode en cp1252 dès que la sortie est redirigée : un
    # « ── » lève alors depuis un thread et tue tout le lot payé (`docs/PIEGES.md`).
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="La grille en création")
    arguments.add_argument("--payer", action="store_true",
                           help="faire les appels manquants (sinon : mesure seule)")
    arguments.add_argument("--etalonner", action="store_true",
                           help="vérifier les mesures sur des planches fabriquées")
    arguments.add_argument("--gabarit", action="store_true",
                           help="écrire les gabarits et s'arrêter")
    arguments.add_argument("--verifier", action="store_true",
                           help="tout prouver avant de payer, sans appel payant "
                                "— rend 1 si une preuve manque")
    options = arguments.parse_args()

    if options.gabarit:
        return ecrire_gabarits()
    if options.etalonner:
        return etalonner()
    if options.verifier:
        return verifier()

    if options.payer:
        cle = lire_cle()
        if not cle:
            print("Cle OpenRouter introuvable.")
            print('  soit :  $env:OPENROUTER_API_KEY = "sk-or-..."')
            print(f"  soit :  une ligne OPENROUTER_API_KEY=... dans {RACINE.parent / '.env'}")
            return 1
        catalogue = charger_catalogue()
        print(f"\n{len(CONFIGURATIONS)} modèles × 2 bras × {len(TAILLES)} tailles × "
              f"{len(JETS)} jets — ce qui manque seulement.\n")
        # Les futures se relisent : `pool.submit` avale l'exception qu'un
        # travailleur laisse échapper hors de son `try`, et la configuration ne
        # produirait alors rien sans rien en dire. Relues après la fermeture du
        # pool, donc sans emporter le reste du lot.
        travaux = []
        with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
            for jet in JETS:
                for etiquette, identifiant, propres in CONFIGURATIONS:
                    travaux.append((etiquette, jet, pool.submit(
                        executer, cle, catalogue, jet, etiquette, identifiant, propres)))
        for etiquette, jet, travail in travaux:
            erreur = travail.exception()
            if erreur is not None:
                print(f"jet{jet} · {etiquette:20} le travailleur a levé — "
                      f"{type(erreur).__name__} : {erreur}", flush=True)
    else:
        attendus = len(CONFIGURATIONS) * 2 * len(TAILLES) * len(JETS)
        # `is_file()` n'est pas décoratif : deux étiquettes portent un point
        # (`gemini-3.1-flash`, `seedream-5.0-lite`), donc leurs **dossiers**
        # répondent à `*.*` et le compte annonçait 28 planches sur 24.
        presents = sum(
            1 for c in SORTIE.rglob("*.*")
            if c.is_file() and c.parent.name != "gabarits"
        ) if SORTIE.is_dir() else 0
        print(f"\nMesure seule — {presents} planches sur {attendus} sur le disque.")
        print("Aucun appel. `--payer` fait les manquantes, `--etalonner` vérifie la mesure.\n")

    print("\nMesure :\n")
    lignes = mesurer_tout()
    MESURES.write_text(json.dumps(lignes, indent=1, ensure_ascii=False), encoding="utf-8")
    planche(lignes)
    conclure(lignes)
    print(f"\n  mesures : {MESURES.relative_to(RACINE.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
