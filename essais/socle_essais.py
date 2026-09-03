# -*- coding: utf-8 -*-
"""Le socle des six essais du 2 septembre 2026 — la caisse, le rapport, la notation.

**Pourquoi ce module existe.** Six essais sur la planche d'animation et ses
références (`revue-externe-2026-09-02/cahier-des-essais.md`) partagent la même
mécanique : rejouer le départ d'une vraie génération, le transformer d'une
seule façon, tirer huit fois, montrer les planches côte à côte et laisser
l'auteur noter d'un clic. Écrit six fois, ce serait six caisses, six rapports et
six notations qui divergent ; écrit une fois, c'est ce fichier.

**Il ne réécrit rien.** `Caisse`, le portillon et l'écriture sérialisée du
relevé viennent de `essai_animation.py` ; `vignette` et `STYLE` de
`rapport_tout.py` ; la découpe brute de `decoupe_brute.py` ; le compte de sujets
de `atelier.image.decoupe.zones_opaques`, tel qu'il est dans le produit. Rien
dans `atelier/` ne change : les variantes se fabriquent par **transformation du
texte témoin** — insertion de lignes, déplacement de blocs, remplacement d'un
chiffre —, jamais par recomposition, et la différence mot à mot du rapport le
prouve.

**Le juge est l'auteur, à l'œil.** Les chiffres calculés ici — sujets,
découpable, remplissage, prix — s'affichent sous chaque planche et n'entrent
dans aucun classement.

**Aucun appel payant ne part de ce module.** `Seance.tirer` appelle un
fournisseur qu'on lui donne ; `--a-sec` dans chaque script montre ce qui
partirait et ne dépense rien. Les fonctions pures ont leurs essais dans
`tests/test_essais_socle.py`, sur le double.
"""

from __future__ import annotations

import asyncio
import base64
import difflib
import html
import io
import json
import re
import statistics
import sys
import time
from dataclasses import dataclass, field, replace
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(DEPOT))

from atelier.domaine.demande import Demande  # noqa: E402
from atelier.domaine.pliage import Geometrie, geometrie  # noqa: E402
from atelier.domaine.recette import Passe, Recette  # noqa: E402
from atelier.image.decoupe import en_ordre_de_lecture, zones_opaques  # noqa: E402
from atelier.image.pliage import EPAISSEUR, FOND, GOUTTIERE, MARGE, TRAIT, gabarit  # noqa: E402
from atelier.image.traitement import detourer  # noqa: E402

from decoupe_brute import cases as cases_brutes  # noqa: E402
from essai_animation import Caisse  # noqa: E402
from rapport_tout import STYLE as STYLE_RAPPORT  # noqa: E402
from rapport_tout import vignette  # noqa: E402

__all__ = [
    "CASES",
    "Caisse",
    "Depart",
    "ImageJointe",
    "MODELE_DEFAUT",
    "OPTIONS_DEFAUT",
    "Seance",
    "Variante",
    "agrandir",
    "animer",
    "blocs",
    "caler",
    "changer_grille",
    "difference_mots",
    "ecarts_du_rangement",
    "estimer",
    "fenetre_commune",
    "gabarit_rectangle",
    "instants_de",
    "juger_machine",
    "lignes_de_nommage",
    "nommer",
    "notes_de",
    "prelever",
    "ranger",
    "rapport",
    "rejouer",
    "roles_de",
    "temoin_du_disque",
    "vignette",
]

# ── Ce qui ne change pas d'un essai à l'autre ────────────────────────────────

# La génération dont on rejoue le départ — la même que les trois bancs.
REFERENCE = DEPOT / "donnees" / "generations" / "cb3ebb37f3cd4e21987964cd1af87770"
PROJET = "essai-animation"
CASES = 8
JETS = tuple(range(1, 9))

# Le modèle du produit et son réglage, ceux que le témoin a reçus.
MODELE_DEFAUT = "openai/gpt-image-2"
OPTIONS_DEFAUT: dict[str, Any] = {"quality": "low"}

# Le témoin déjà payé : les huit tirages de `gpt-image-2` du banc des modèles.
TEMOIN_DOSSIER = RACINE / "resultats_animation" / "openai_gpt-image-2"
TEMOIN_MESURES = RACINE / "resultats_animation" / "mesures.json"
NOTES_AUTEUR = RACINE / "notes-auteur.json"
PRIX_PLANCHE = RACINE / "mesures_prix_planche.json"

# Les rôles, dans les mots du produit (`atelier/domaine/generation.py`).
ROLE_STYLE, REFERENCE_ROLE, GABARIT, PALETTE, EDITION = "style", "reference", "gabarit", "palette", "edition"

# Le contrat visuel du § 1.2 : 125 ms par image, un carré de 132 px, LANCZOS.
MS, COTE_VUE = 125, 132
COULEURS_GIF = 48

# Au-delà, une « silhouette » est un carré : le modèle a redessiné le quadrillage.
# Le même seuil que `juger_recette.PLEINE`.
PLEINE = 0.92

DETOURAGE = Recette(passes=(Passe(moteur="bord"),))

# Les marqueurs du texte du produit, tels qu'ils y sont écrits. On les cherche,
# on ne les récrit pas : un marqueur absent du témoin ne déplace rien.
MARQUEUR_CONSIGNE = "Render this as a sprite sheet"
MARQUEUR_FRAMING = "FRAMING —"
MARQUEUR_CAMERA = "CAMERA —"
MARQUEUR_VUE = "View and framing:"

# Les phrases que `_dire_les_images` du produit écrit aujourd'hui pour les images
# jointes. **Recopiées, pas importées** : le produit ne les expose pas, et un
# essai qui importerait un service pour lire trois phrases ferait entrer tout
# l'atelier dans un script qui n'en veut pas. Si elles changent, l'essai E1 ne
# les trouvera plus et le dira — il n'y a rien à casser en silence.
#
# **Le produit ne les écrit plus depuis R7** (3 septembre 2026) : il écrit les
# lignes de nommage, celles que `lignes_de_nommage` produit juste en dessous, et
# c'est très exactement ce que E1 avait tiré. Elles restent ici pour les témoins
# **déjà sur le disque**, qui les portent : les retirer ferait que `nommer`
# ajouterait ses lignes sous une phrase générique qu'il ne saurait plus enlever.
# Elles ne se rencontreront plus dans un texte neuf, et c'est sans conséquence —
# `_sans_phrases_generiques` compte ce qu'il retire et n'exige rien.
PHRASES_GENERIQUES = (
    "One or more reference images are attached: they show the look to follow — "
    "the same colours, the same outfit, the same proportions, the same drawing style.",
    "One or more attached images show this same subject already drawn: keep it "
    "recognisably the same thing.",
    "Do NOT copy the camera angle or the pose of the attached images — those are set "
    "below, and they override what the images show.",
    "Do NOT copy the camera angle or the pose of the attached images, and do not copy "
    "their framing or their layout — those are set below, and they override what the "
    "images show.",
    "One attached image is a flat strip of colour swatches: it is not a subject, it is "
    "the palette to draw with.",
)

TITRES = ("CONTEXT", "REFERENCES", "REQUEST")


# ── Ce qui est parti la première fois ────────────────────────────────────────


@dataclass(frozen=True)
class ImageJointe:
    """Une image envoyée : son rang dans l'envoi, son rôle, ses octets."""

    rang: int
    role: str
    octets: bytes
    origine: str = ""

    @property
    def taille(self) -> tuple[int, int]:
        with Image.open(io.BytesIO(self.octets)) as image:
            return image.size

    @property
    def legende(self) -> str:
        largeur, hauteur = self.taille
        return f"Image {self.rang} · {self.role} · {largeur}×{hauteur}"


@dataclass(frozen=True)
class Depart:
    """Ce qui est parti : le texte, le négatif, le cadrage, les images dans l'ordre."""

    texte: str
    negatif: str
    proportions: str
    resolution: str | None
    images: tuple[ImageJointe, ...]

    @property
    def roles(self) -> list[str]:
        return [i.role for i in self.images]


def roles_de(fiche: dict, *, gabarit_joint: bool = True, palette_jointe: bool = False) -> list[str]:
    """Les rôles des images, dans l'ordre d'envoi, lus dans `generation.json`.

    Ce que l'auteur et le projet ont posé d'abord (`references[].role`), puis le
    gabarit, qui ferme la liste — et la bande de palette derrière lui quand la
    case était cochée. C'est l'ordre de `essai_animation.references()`, qui est
    celui du produit.
    """
    roles = [str(r.get("role") or "") for r in fiche.get("references", [])]
    if gabarit_joint:
        roles.append(GABARIT)
    if palette_jointe:
        roles.append(PALETTE)
    return roles


def _fiche(reference: Path = REFERENCE) -> dict:
    return json.loads((reference / "generation.json").read_text("utf-8"))


def rejouer(reference: Path = REFERENCE, cases: int = CASES) -> Depart:
    """Le départ de la génération de référence, relu à la source.

    **Le rendu, jamais le brut** pour un asset : c'est ce que l'adaptateur
    renvoie. Le gabarit est redessiné par le module du produit, comme au banc.
    """
    fiche = _fiche(reference)
    demande = fiche["demande"]
    images: list[ImageJointe] = []
    for rang, r in enumerate(fiche["references"], start=1):
        if r["origine"] == "carte":
            chemin = DEPOT / "donnees" / "projets" / PROJET / "tableau" / f"{r['asset']}.png"
        else:
            gen, index = r["asset"].rsplit("-", 1)
            chemin = DEPOT / "donnees" / "generations" / gen / f"{index}-rendu.png"
        images.append(ImageJointe(rang, r["role"], chemin.read_bytes(), r["origine"]))
    images.append(ImageJointe(len(images) + 1, GABARIT, gabarit(geometrie(cases)), "gabarit"))
    if demande.get("palette"):
        raise RuntimeError(
            "le témoin est parti avec une bande de palette, que ce socle ne sait pas "
            "redessiner à l'identique — il faudrait relire la palette du projet de ce jour-là"
        )
    return Depart(
        texte=demande["prompt"],
        negatif=demande.get("prompt_negatif", "") or "",
        proportions=demande.get("proportions", "1:1") or "1:1",
        resolution=demande.get("resolution"),
        images=tuple(images),
    )


# ── Transformer le texte, jamais le récrire ──────────────────────────────────


def blocs(texte: str) -> list[str]:
    """Les paragraphes du texte, dans l'ordre — ce que le produit sépare par une ligne vide."""
    return [b for b in re.split(r"\n\s*\n", texte.strip()) if b.strip()]


def lignes_de_nommage(roles: Sequence[str], cases: int = CASES) -> list[str]:
    """Une ligne par image, numérotée dans l'ordre d'envoi, depuis son rôle (E1).

    Seuls les rôles présents produisent une ligne ; un rôle inconnu lève, parce
    qu'une image qu'on ne sait pas nommer ne doit pas partir sous un faux nom.
    """
    lignes: list[str] = []
    for rang, role in enumerate(roles, start=1):
        if role == ROLE_STYLE:
            lignes.append(
                f"Image {rang} — STYLE REFERENCE (an official artwork of this game): follow "
                f"its colours, outfit, proportions and drawing style. Do NOT copy its pose, "
                f"its camera angle or its layout."
            )
        elif role == REFERENCE_ROLE:
            lignes.append(
                f"Image {rang} — THE SAME CHARACTER, already drawn in the game's camera: keep "
                f"it recognisably the same character in every cell."
            )
        elif role == GABARIT:
            lignes.append(
                f"Image {rang} — EMPTY LAYOUT GRID: {cases} cells. Draw exactly one sprite per "
                f"cell, one instant of the motion per cell, in reading order. Do NOT draw the "
                f"grid lines."
            )
        elif role == PALETTE:
            lignes.append(
                f"Image {rang} — PALETTE STRIP: not a subject, only the colours to draw with."
            )
        else:
            raise ValueError(f"rôle inconnu, aucune ligne de nommage pour lui : {role!r}")
    return lignes


def _sans_phrases_generiques(texte: str) -> tuple[str, int]:
    """Le texte sans les phrases génériques du produit, et combien ont été retirées."""
    retirees = 0
    for phrase in PHRASES_GENERIQUES:
        if phrase in texte:
            texte = texte.replace(phrase, "")
            retirees += 1
    # Les doubles espaces et les paragraphes vidés qu'un retrait laisse derrière lui.
    texte = re.sub(r"[ \t]{2,}", " ", texte)
    texte = "\n\n".join(b.strip() for b in blocs(texte))
    return texte, retirees


def nommer(texte: str, roles: Sequence[str], cases: int = CASES) -> str:
    """La variante B de E1 : la phrase générique remplacée par les lignes de nommage.

    Le bloc de nommage prend la place de la phrase générique quand elle est là
    — c'est-à-dire en fin de texte, là où le produit l'écrit. Quand le témoin
    n'en porte pas (celui du 1ᵉʳ septembre 2026 n'en a pas : la phrase est née
    le même jour, après lui), le bloc s'ajoute au même endroit et rien n'est
    retiré. **Tout le reste est intact.**
    """
    propre, _ = _sans_phrases_generiques(texte)
    return propre + "\n\n" + "\n".join(lignes_de_nommage(roles, cases))


def _demonter(texte: str) -> dict[str, list[str]]:
    """Le texte témoin en ses morceaux nommés — par ses marqueurs, sans en lire le sens."""
    paragraphes = blocs(texte)
    if not paragraphes:
        raise ValueError("texte vide")
    contexte: list[str] = []
    sujet: list[str] = []
    consigne: list[str] = []
    framing: list[str] = []
    camera: list[str] = []
    nommage: list[str] = []
    for index, bloc in enumerate(paragraphes):
        lignes = bloc.split("\n")
        restantes: list[str] = []
        for ligne in lignes:
            if ligne.startswith(MARQUEUR_FRAMING):
                framing.append(ligne)
            elif ligne.startswith(MARQUEUR_CAMERA):
                camera.append(ligne)
            elif re.match(r"^Image \d+ — ", ligne):
                nommage.append(ligne)
            else:
                restantes.append(ligne)
        if not restantes:
            continue
        reste = "\n".join(restantes)
        if index == 0 or MARQUEUR_VUE in reste and not sujet and not consigne:
            contexte.append(reste)
        elif MARQUEUR_CONSIGNE in reste:
            consigne.append(reste)
        else:
            sujet.append(reste)
    return {
        "contexte": contexte,
        "sujet": sujet,
        "consigne": consigne,
        "framing": framing,
        "camera": camera,
        "nommage": nommage,
    }


def ranger(texte: str, roles: Sequence[str], cases: int = CASES) -> str:
    """La variante C de E1 : B, puis le texte rangé sous trois titres, à mots constants.

    `CONTEXT` reçoit les lignes de bible ; `REFERENCES` les lignes de nommage ;
    `REQUEST` le sujet, la consigne de planche, puis `FRAMING —` puis
    `CAMERA —` quand le témoin les porte. Chaque titre est en majuscules, suivi
    d'une ligne vide. **Pas un mot du fond ne change** : `ecarts_du_rangement`
    le vérifie, et un script refuse de tirer si ce n'est pas vrai.
    """
    morceaux = _demonter(nommer(texte, roles, cases))
    parties = [
        ("CONTEXT", morceaux["contexte"]),
        ("REFERENCES", ["\n".join(morceaux["nommage"])]),
        # FRAMING puis CAMERA, **deux lignes qui se suivent** — pas deux paragraphes.
        ("REQUEST", morceaux["sujet"] + morceaux["consigne"] + ["\n".join(morceaux["framing"] + morceaux["camera"])]),
    ]
    sortie: list[str] = []
    for titre, contenu in parties:
        sortie.append(titre)
        sortie.extend(c for c in contenu if c.strip())
    return "\n\n".join(sortie)


_INSTANT = re.compile(r"\d+\. walk cycle, frame \d+ of \d+: (.+?), facing right, side view")


def instants_de(texte: str, cases: int = CASES) -> list[str]:
    """Les instants du cycle, tels que le témoin les énumère, sans la vue répétée.

    « 1. walk cycle, frame 1 of 8: contact, left foot forward, facing right,
    side view » devient « contact, left foot forward ». C'est le seul dégraissage
    du rangement réel de E1 : la vue est dite une fois, dans la direction
    artistique, et chaque instant ne garde que ce qui le distingue. Lève si le
    compte n'y est pas — un instant perdu serait une planche faussée.
    """
    trouves = _INSTANT.findall(texte)
    if len(trouves) != cases:
        raise ValueError(f"{len(trouves)} instants trouvés pour {cases} attendus")
    return trouves


def changer_grille(texte: str, colonnes: int, lignes: int, cases: int = CASES) -> str:
    """La variante de E3 : seuls les chiffres de la consigne de grille changent.

    Lève si la phrase du produit n'est pas dans le texte : on remplace ce qui
    est là, on n'écrit pas une consigne de plus.
    """
    motif = re.compile(r"Exactly (\d+) columns and (\d+) rows, (\d+) cells total")
    if not motif.search(texte):
        raise ValueError("la consigne de grille du produit est absente du texte")
    return motif.sub(f"Exactly {colonnes} columns and {lignes} rows, {cases} cells total", texte, count=1)


# ── La différence mot à mot ──────────────────────────────────────────────────

_MOT = re.compile(r"\S+")


def difference_mots(temoin: str, variante: str) -> list[tuple[str, str]]:
    """Les mots du témoin et de la variante, alignés : ("=", mot), ("+", mot), ("-", mot).

    Sur les mots, jamais sur les caractères : c'est la seule preuve lisible que
    « on range, on ne réécrit pas » a été tenu. Les sauts de ligne ne comptent
    pas — un bloc déplacé est le même bloc.
    """
    a, b = _MOT.findall(temoin), _MOT.findall(variante)
    sortie: list[tuple[str, str]] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            sortie.extend(("=", m) for m in a[i1:i2])
        else:
            sortie.extend(("-", m) for m in a[i1:i2])
            sortie.extend(("+", m) for m in b[j1:j2])
    return sortie


def ecarts_du_rangement(temoin: str, variante: str, autorisees: Sequence[str]) -> list[str]:
    """Ce que la variante ajoute ou retire **hors** des lignes autorisées.

    Vide, c'est un rangement. Sinon, la liste dit quels mots sont entrés ou
    sortis sans permission — et le script refuse de tirer.

    **Compté, pas seulement reconnu.** Un mot d'une ligne autorisée qui
    apparaît deux fois de plus qu'elle ne l'apporte est un mot de trop ; un mot
    du fond qui sort et rentre ailleurs est un déplacement, pas un écart.
    """
    permis: dict[str, int] = {}
    for ligne in autorisees:
        for mot in _MOT.findall(ligne):
            permis[mot] = permis.get(mot, 0) + 1
    ajoutes: dict[str, int] = {}
    retires: dict[str, int] = {}
    for op, mot in difference_mots(temoin, variante):
        if op == "+":
            ajoutes[mot] = ajoutes.get(mot, 0) + 1
        elif op == "-":
            retires[mot] = retires.get(mot, 0) + 1
    ecarts: list[str] = []
    # Un mot retiré puis rajouté est déplacé : il s'annule.
    for mot in list(retires):
        commun = min(retires[mot], ajoutes.get(mot, 0))
        if commun:
            retires[mot] -= commun
            ajoutes[mot] -= commun
    for mot, n in ajoutes.items():
        reste = n - permis.get(mot, 0)
        if reste > 0:
            ecarts.append(f"+{mot}" if reste == 1 else f"+{mot} ×{reste}")
    for mot, n in retires.items():
        if n > 0:
            ecarts.append(f"-{mot}" if n == 1 else f"-{mot} ×{n}")
    return ecarts


def _diff_html(temoin: str, variante: str) -> str:
    parts: list[str] = []
    for op, mot in difference_mots(temoin, variante):
        m = html.escape(mot)
        if op == "+":
            parts.append(f"<ins>{m}</ins>")
        elif op == "-":
            parts.append(f"<del>{m}</del>")
        else:
            parts.append(m)
    return " ".join(parts)


def _texte_surligne(texte: str) -> str:
    """Le texte envoyé, les trois titres surlignés quand la variante les range."""
    sortie: list[str] = []
    for bloc in blocs(texte):
        if bloc.strip() in TITRES:
            sortie.append(f"<span class=titre-partie>{html.escape(bloc.strip())}</span>")
        else:
            sortie.append(html.escape(bloc))
    return "\n\n".join(sortie)


# ── Les images : agrandir, redessiner un gabarit, prélever, caler ───────────


def agrandir(octets: bytes, facteur: int) -> bytes:
    """Un rendu agrandi ×N au plus proche voisin — les pixels restent carrés (E2)."""
    with Image.open(io.BytesIO(octets)) as image:
        grande = image.convert("RGBA").resize(
            (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
        )
    tampon = io.BytesIO()
    grande.save(tampon, format="PNG")
    return tampon.getvalue()


def gabarit_rectangle(forme: Geometrie, largeur: int = 1024, hauteur: int = 683) -> bytes:
    """Le gabarit du produit, redessiné sur un canevas qui n'est pas carré (E3).

    `atelier.image.pliage.gabarit` ne dessine qu'en carré. Celui-ci reprend
    **ses constantes** — marge, gouttière, trait, fond — et ne change que le
    canevas. Exactement `forme.cases` cases, comme lui.
    """
    image = Image.new("RGB", (largeur, hauteur), FOND)
    dessin = ImageDraw.Draw(image)
    large = (largeur - 2 * MARGE - GOUTTIERE * (forme.colonnes - 1)) // forme.colonnes
    haut = (hauteur - 2 * MARGE - GOUTTIERE * (forme.lignes - 1)) // forme.lignes
    for index in range(forme.cases):
        colonne, ligne = index % forme.colonnes, index // forme.colonnes
        x0 = MARGE + colonne * (large + GOUTTIERE)
        y0 = MARGE + ligne * (haut + GOUTTIERE)
        dessin.rectangle([x0, y0, x0 + large, y0 + haut], outline=TRAIT, width=EPAISSEUR)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def prelever(nombre: int, debut: int, periode: int, combien: int = CASES) -> list[int]:
    """Les indices de `combien` images équidistantes dans une fenêtre d'un clip (E6).

    `debut` est la première image gardée, `periode` la longueur du cycle en
    images. La dernière image prélevée reste **avant** `debut + periode` : un
    cycle qui se referme sur sa première image la montrerait deux fois.
    """
    if nombre <= 0 or combien <= 0:
        return []
    if debut < 0 or periode < combien:
        raise ValueError("une période plus courte que le nombre d'images à prélever")
    indices = [debut + round(i * periode / combien) for i in range(combien)]
    if indices[-1] >= nombre:
        raise ValueError(f"la fenêtre dépasse le clip ({indices[-1]} ≥ {nombre})")
    return indices


Boite = tuple[int, int, int, int]


def fenetre_commune(boites: Sequence[Boite]) -> Boite:
    """L'union des boîtes — la seule fenêtre qui ne bouge pas d'une image à l'autre."""
    if not boites:
        raise ValueError("aucune boîte")
    return (
        min(b[0] for b in boites),
        min(b[1] for b in boites),
        max(b[2] for b in boites),
        max(b[3] for b in boites),
    )


def caler(boites: Sequence[Boite]) -> tuple[list[tuple[int, int]], Boite]:
    """Des images venues d'appels séparés, posées pieds sur la même ligne (E5).

    Rend le décalage (dx, dy) de chaque image et la fenêtre commune une fois
    décalées : les pieds — le bas de chaque boîte — tombent sur la ligne la plus
    basse, les corps sont centrés sur la même verticale. **Le balancement
    vertical est perdu, et c'est voulu ici** : des appels séparés n'ont aucune
    ligne de sol commune, il faut bien en poser une.
    """
    if not boites:
        raise ValueError("aucune boîte")
    sol = max(b[3] for b in boites)
    centre = max((b[0] + b[2]) // 2 for b in boites)
    decalages = [(centre - (b[0] + b[2]) // 2, sol - b[3]) for b in boites]
    decalees = [(b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy) for b, (dx, dy) in zip(boites, decalages)]
    return decalages, fenetre_commune(decalees)


# ── Le jugement de la machine — affiché, jamais classé ──────────────────────


def juger_machine(octets: bytes, cases: int = CASES) -> dict[str, Any]:
    """Le compte de sujets tel que le produit le fait, le remplissage, « découpable ».

    `zones_opaques` sur l'alpha du détourage par le bord — la voie de
    `ServicePliage._boites` quand la grille est partie vide. Le remplissage est
    la part opaque de la boîte la plus pleine : au-delà de `PLEINE`, le modèle a
    redessiné le quadrillage et la boîte est une case, pas un sujet.
    """
    rgba = detourer(DETOURAGE, octets)
    alpha = rgba[:, :, 3] > 127
    boites = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    remplissages = [
        float(alpha[y0 : y1 + 1, x0 : x1 + 1].mean()) if y1 > y0 and x1 > x0 else 0.0
        for x0, y0, x1, y1 in boites
    ]
    pleines = sum(1 for r in remplissages if r > PLEINE)
    return {
        "sujets": len(boites),
        "attendu": cases,
        "compte_ok": len(boites) >= cases,
        "boites": [list(map(int, b)) for b in boites],
        "remplissage_pct": round(max(remplissages) * 100) if remplissages else 0,
        "cases_pleines": pleines,
        "decoupable": pleines == 0 and len(boites) >= 3,
    }


def carres(vues: Sequence[Image.Image], cote: int = COTE_VUE) -> list[Image.Image]:
    """Chaque vue réduite en LANCZOS dans un carré de `cote` px, calée en bas.

    Jamais le plus proche voisin sur une réduction : les traits fins
    disparaissent. Calée en bas pour que la ligne de sol ne saute pas d'une
    variante à l'autre ; le fond du carré est celui de la planche.
    """
    if not vues:
        return []
    fond = vues[0].convert("RGB").getpixel((1, 1))
    sortie: list[Image.Image] = []
    for v in vues:
        facteur = cote / max(v.width, v.height)
        petite = v.convert("RGB").resize(
            (max(1, round(v.width * facteur)), max(1, round(v.height * facteur))),
            Image.Resampling.LANCZOS,
        )
        carre = Image.new("RGB", (cote, cote), fond)
        carre.paste(petite, ((cote - petite.width) // 2, cote - petite.height))
        sortie.append(carre)
    return sortie


def _png_b64(image: Image.Image) -> str:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG", optimize=True)
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def animer(octets: bytes, cote: int = COTE_VUE) -> list[str] | None:
    """La planche en animation sur ses cases brutes : ses images, prêtes pour la page.

    Même montage que `rapport_tout.animer` — coupée en ses cases par
    `decoupe_brute`, pixels du modèle, fond compris — dans un carré de 132 px
    réduit en LANCZOS. **Ce n'est pas un GIF, et c'est délibéré** : un GIF
    compte en centièmes de seconde et ne sait pas tenir 125 ms, et chaque GIF
    part quand il est chargé, donc jamais en phase avec son voisin. La page
    fait défiler toutes les animations sur **un seul métronome** à 125 ms —
    même vitesse, même phase de départ, pour tout le monde.
    """
    vues = cases_brutes(octets)
    if len(vues) < 2:
        return None
    return [_png_b64(c) for c in carres(vues, cote)]


def gif(vues: Sequence[Image.Image], chemin: Path, ms: int = MS) -> None:
    """Un GIF sur le disque — pour ce qui sort du rapport, pas pour ce qu'il montre.

    Le format compte en centièmes : 125 ms s'y écrit 120 ou 130. On arrondit au
    plus proche et on le sait.
    """
    plats = [v.convert("P", palette=Image.Palette.ADAPTIVE, colors=COULEURS_GIF) for v in vues]
    plats[0].save(chemin, format="GIF", save_all=True, append_images=plats[1:], duration=ms, loop=0)


def _b64(octets: bytes) -> str:
    return base64.b64encode(octets).decode("ascii")


# ── Le prix, d'après le relevé ───────────────────────────────────────────────


def estimer(appels: int, cases: int = CASES) -> float:
    """Le coût estimé d'`appels` appels, d'après `essais/mesures_prix_planche.json`.

    Une planche coûte le prix d'un appel quel que soit son nombre de cases, et
    la variance entre deux appels dépasse l'écart entre deux tailles : on prend
    la **médiane** des appels de planche mesurés. Pour une image seule, le prix
    par image du journal.
    """
    releve = json.loads(PRIX_PLANCHE.read_text("utf-8"))
    if cases <= 1:
        return appels * float(releve["1"]["par_image"])
    mesures = [float(l["cout_usd"]) for k, l in releve.items() if isinstance(l, dict) and "cout_usd" in l]
    return appels * (statistics.median(mesures) if mesures else 0.0)


def prix_du_temoin() -> float | None:
    """Ce que le témoin a coûté par appel, le 1ᵉʳ septembre 2026."""
    if not TEMOIN_MESURES.exists():
        return None
    lignes = json.loads(TEMOIN_MESURES.read_text("utf-8")).get(MODELE_DEFAUT, {})
    couts = [float(l["cout_usd"]) for l in lignes.values() if isinstance(l, dict) and l.get("cout_usd")]
    return statistics.mean(couts) if couts else None


# ── Une variante, et le témoin du disque ────────────────────────────────────


@dataclass
class Variante:
    """Un groupe d'un essai : ce qui part, et ce qu'on prévoit qui rate.

    La première variante d'un essai est **toujours le témoin** : le départ
    rejoué tel quel, dont les huit planches sont déjà sur le disque.
    """

    cle: str
    titre: str
    propos: str
    texte: str
    images: tuple[ImageJointe, ...]
    echecs_prevus: tuple[str, ...] = ()
    proportions: str = "1:1"
    resolution: str | None = None
    negatif: str = ""
    options: dict[str, Any] = field(default_factory=lambda: dict(OPTIONS_DEFAUT))
    cases: int = CASES
    # Le témoin ne se repaie jamais : ses planches sont là, et son relevé aussi.
    temoin: bool = False
    dossier: Path | None = None
    releve: dict[str, dict] = field(default_factory=dict)
    # Ce qui se montre au-dessus de la colonne — la référence à sa taille (E2).
    entete_html: str = ""
    # Ce que la variante autorise d'ajouter au texte, pour le contrôle de rangement.
    lignes_autorisees: tuple[str, ...] = ()
    # Les tirages de cette variante-là, quand ils ne sont pas ceux de la séance :
    # une variante payée à quatre et une neuve tirée à deux vivent dans le même
    # rapport (2 septembre 2026, E1 refait).
    jets: tuple[int, ...] | None = None

    def __post_init__(self) -> None:
        # La clé nomme un dossier sur le disque : ce que Windows refuse dans un
        # nom (le deux-points, entre autres) doit être refusé ici, avant de payer
        # — E3 a planté sur « B-4x2-1:1 » le 2 septembre 2026, après le tirage à sec.
        interdits = set('<>:"/\|?*')
        if not self.cle or any(c in interdits for c in self.cle) or self.cle.strip(" .") != self.cle:
            raise ValueError(f"clé de variante impossible en nom de dossier : {self.cle!r}")

    def demande(self) -> Demande:
        return Demande(
            prompt=self.texte,
            prompt_negatif=self.negatif,
            proportions=self.proportions,
            resolution=self.resolution,
            variations=1,
            references=tuple(i.octets for i in self.images),
            options=dict(self.options),
            # **Repris** : le texte part mot pour mot, rien ne s'ajoute.
            repris=True,
        )


def temoin_du_disque(depart: Depart, propos: str = "rien — le départ rejoué", echecs: Sequence[str] = ()) -> Variante:
    """Le témoin : `gpt-image-2`, huit tirages du 1ᵉʳ septembre 2026, relus sans repayer."""
    releve = {}
    if TEMOIN_MESURES.exists():
        releve = json.loads(TEMOIN_MESURES.read_text("utf-8")).get(MODELE_DEFAUT, {})
    return Variante(
        cle="A-temoin",
        titre="Le produit d'aujourd'hui",
        propos=propos,
        texte=depart.texte,
        images=depart.images,
        echecs_prevus=tuple(echecs),
        proportions=depart.proportions,
        resolution=depart.resolution,
        negatif=depart.negatif,
        temoin=True,
        dossier=TEMOIN_DOSSIER,
        releve=releve,
    )


# ── Les images du jour : ce que le produit enverrait aujourd'hui ────────────

PERSONNAGE = "michel"
# Le témoin neuf de E1, parti le 2 septembre 2026 avec les artworks du jour :
# deux planches que E2 et E3 relisent comme point de comparaison, sans repayer.
TEMOIN_DU_JOUR_DOSSIER = RACINE / "resultats_references_nommees" / "A2-temoin-art"
TEMOIN_DU_JOUR_MESURES = RACINE / "resultats_references_nommees" / "mesures.json"
TEMOIN_DU_JOUR_CLE = "A2-temoin-art"


def artworks_du_jour(personnage: str = PERSONNAGE) -> list[tuple[str, bytes, str]]:
    """Les concept arts que le personnage désigne, dans l'ordre du produit.

    C'est ce que `_concepts` du service de génération fait partir en premier,
    en rôle style, avant le sprite promu ; les artworks « tous » du tableau
    sont les mêmes cartes et sont dédoublonnés derrière. Le fichier part tel
    quel, octet pour octet, comme dans le produit. Seules les cartes encore
    marquées artwork comptent : une carte rétrogradée ne part plus.
    """
    projet = DEPOT / "donnees" / "projets" / PROJET
    fiche = json.loads((projet / "personnages" / f"{personnage}.json").read_text("utf-8"))
    trouves = []
    for identifiant in fiche.get("concept_arts", []):
        carte = json.loads((projet / "tableau" / f"{identifiant}.json").read_text("utf-8"))
        if not carte.get("artwork"):
            continue
        note = carte.get("note") or ""
        trouves.append((identifiant, (projet / "tableau" / f"{identifiant}.png").read_bytes(), note))
    return trouves


def images_du_jour(depart: Depart, artworks: Sequence[tuple[str, bytes, str]] | None = None) -> tuple[ImageJointe, ...]:
    """Les artworks du jour en tête, puis ce que le témoin envoyait hors style, renuméroté."""
    if artworks is None:
        artworks = artworks_du_jour()
    images = [ImageJointe(0, ROLE_STYLE, octets, f"carte {identifiant}" + (f" — {note}" if note else ""))
              for identifiant, octets, note in artworks]
    images += [i for i in depart.images if i.role != ROLE_STYLE]
    return tuple(ImageJointe(rang, i.role, i.octets, i.origine) for rang, i in enumerate(images, start=1))


def temoin_du_jour(depart: Depart, echecs: Sequence[str] = (), propos: str = "") -> Variante:
    """Le témoin avec les artworks du jour : les deux planches de E1 du 2 septembre 2026, relues sans repayer.

    Le témoin du 1ᵉʳ septembre est parti avec l'ancien artwork, retiré depuis ;
    un essai qui change une seule chose doit se comparer à un témoin parti
    avec **les mêmes images**. Lève si ces planches ne sont pas sur le disque.
    """
    if not (TEMOIN_DU_JOUR_DOSSIER / "jet1.png").exists():
        raise RuntimeError(f"le témoin du jour n'est pas sur le disque : {TEMOIN_DU_JOUR_DOSSIER} — lancer E1 d'abord")
    releve = {}
    if TEMOIN_DU_JOUR_MESURES.exists():
        releve = {k: v for k, v in json.loads(TEMOIN_DU_JOUR_MESURES.read_text("utf-8")).get(TEMOIN_DU_JOUR_CLE, {}).items()
                  if k.startswith("jet")}
    return Variante(
        cle="A-temoin",
        titre="Le produit d'aujourd'hui, avec les artworks du jour",
        propos=propos or "le texte du produit tel quel et ses images du jour — les deux planches A2 de E1, relues sans repayer",
        texte=depart.texte,
        images=images_du_jour(depart),
        echecs_prevus=tuple(echecs),
        proportions=depart.proportions,
        resolution=depart.resolution,
        negatif=depart.negatif,
        temoin=True,
        dossier=TEMOIN_DU_JOUR_DOSSIER,
        releve=releve,
        jets=(1, 2),
    )


# ── La séance : tirer, à sec ou pour de vrai ─────────────────────────────────


class Seance:
    """Un lancement d'un essai : un dossier, un plafond, une caisse, un relevé.

    **Le plafond porte sur ce lancement** (`essai_animation.py` dit pourquoi), et
    un tirage déjà sur le disque n'est jamais repayé. Le relevé s'écrit
    sérialisé, tirage par tirage — jamais à la fin.
    """

    def __init__(
        self,
        essai: str,
        plafond: float,
        *,
        modele: str = MODELE_DEFAUT,
        parallele: int = 4,
        dossier: Path | None = None,
    ) -> None:
        self.essai = essai
        self.plafond = plafond
        self.modele = modele
        self.parallele = parallele
        self.dossier = dossier or (RACINE / f"resultats_{essai.replace('-', '_')}")
        self.mesures = self.dossier / "mesures.json"
        self.caisse = Caisse(0.0, plafond)
        self._plume = asyncio.Lock()
        self._portillon = asyncio.Semaphore(parallele)
        self.releve: dict[str, Any] = (
            json.loads(self.mesures.read_text("utf-8")) if self.mesures.exists() else {}
        )

    # ── ce qui est déjà là ───────────────────────────────────────────────

    def dossier_de(self, variante: Variante) -> Path:
        return variante.dossier if variante.temoin and variante.dossier else self.dossier / variante.cle

    def releve_de(self, variante: Variante) -> dict[str, dict]:
        if variante.temoin:
            return variante.releve
        return {k: v for k, v in self.releve.get(variante.cle, {}).items() if k.startswith("jet") and isinstance(v, dict)}

    def manquants(self, variante: Variante, jets: Sequence[int] = JETS) -> list[int]:
        if variante.temoin:
            return []
        dossier = self.dossier_de(variante)
        return [j for j in jets if not (dossier / f"jet{j}.png").exists()]

    def seance_courante(self) -> str:
        """La date du lancement qui a payé — la clé du tiroir de notation."""
        return str(self.releve.get("_seance", {}).get("date") or date.today().isoformat())

    # ── à sec ────────────────────────────────────────────────────────────

    def a_sec(self, variantes: Sequence[Variante], jets: Sequence[int] = JETS, *, prix_appel: float | None = None) -> float:
        """Ce qui partirait : textes, images, appels, coût. Ne dépense rien."""
        total = 0
        print(f"=== {self.essai} — A SEC : rien ne part ===")
        print(f"modele {self.modele} · options {json.dumps(next(iter(variantes)).options)} · plafond ${self.plafond:.2f}")
        temoin = variantes[0] if variantes[0].temoin else None
        for v in variantes:
            siens = v.jets or tuple(jets)
            manque = self.manquants(v, siens)
            total += len(manque)
            print()
            print(f"--- {v.cle} · {v.titre} ---")
            print(f"    {v.propos}")
            print(f"    format {v.proportions} · {len(v.images)} images · "
                  f"{'temoin, deja sur le disque' if v.temoin else f'{len(manque)} appel(s) a faire sur {len(siens)}'}")
            for image in v.images:
                print(f"    {image.legende} · {len(image.octets) / 1024:.0f} Ko")
            if temoin is not None and v is not temoin and v.texte == temoin.texte:
                print("    texte : identique au temoin, mot pour mot")
                continue
            print("    texte du temoin :" if v is temoin else "    texte envoye :")
            for ligne in v.texte.splitlines():
                print("      | " + ligne)
            if temoin is not None and v is not temoin:
                print("    difference mot a mot avec le temoin :")
                mots = [f"[+{m}]" if op == "+" else f"[-{m}]" for op, m in difference_mots(temoin.texte, v.texte) if op != "="]
                print("      " + (" ".join(mots) if mots else "(aucune)"))
        prix = prix_appel if prix_appel is not None else estimer(1, variantes[0].cases)
        cout = total * prix
        temoin_prix = prix_du_temoin()
        print()
        print(f"appels a faire : {total} · cout estime ${cout:.3f} "
              f"(${prix:.4f} l'appel, mediane de mesures_prix_planche.json)"
              + (f" · le temoin a coute ${temoin_prix:.4f} l'appel le 1er septembre 2026, "
                 f"soit ${total * temoin_prix:.3f} a ce prix-la" if temoin_prix else ""))
        if cout > self.plafond:
            print(f"[!] au-dessus du plafond ${self.plafond:.2f} : des tirages seraient sautes")
        return cout

    # ── pour de vrai ─────────────────────────────────────────────────────

    async def _noter(self, cle: str, jet: str, ligne: dict) -> None:
        async with self._plume:
            self.releve.setdefault("_seance", {})
            self.releve["_seance"].setdefault("date", date.today().isoformat())
            self.releve["_seance"]["dernier_lancement"] = datetime.now().isoformat(timespec="seconds")
            self.releve["_seance"]["modele"] = self.modele
            self.releve.setdefault(cle, {})[jet] = ligne
            self.dossier.mkdir(parents=True, exist_ok=True)
            self.mesures.write_text(json.dumps(self.releve, indent=1, ensure_ascii=False), "utf-8")

    async def tirer(
        self,
        variante: Variante,
        passerelle: Any,
        modele: Any,
        jets: Sequence[int] = JETS,
        *,
        journal: Callable[[str], None] = print,
    ) -> None:
        """Les tirages manquants d'une variante, en parallèle, sous le plafond.

        `passerelle.generer(modele, demande)` est le port du produit ; le double
        des tests y passe aussi bien que l'adaptateur réel. Un échec d'appel
        compte comme un tirage et coûte zéro ; rien n'est relancé.
        """
        if variante.temoin:
            return
        if variante.jets:
            jets = variante.jets
        dossier = self.dossier_de(variante)
        dossier.mkdir(parents=True, exist_ok=True)
        self.releve.setdefault(variante.cle, {})["_variante"] = {
            "titre": variante.titre,
            "propos": variante.propos,
            "proportions": variante.proportions,
            "images": [i.legende for i in variante.images],
            "texte": variante.texte,
        }

        async def un_tirage(jet: int) -> None:
            fichier = dossier / f"jet{jet}.png"
            if fichier.exists():
                return
            async with self._portillon:
                if not await self.caisse.autorise():
                    return
                debut = time.monotonic()
                try:
                    image = await passerelle.generer(modele, variante.demande())
                except Exception as erreur:  # noqa: BLE001 — un banc ne s'arrête pas
                    secondes = round(time.monotonic() - debut, 1)
                    await self._noter(variante.cle, f"jet{jet}", {
                        "echec": f"{type(erreur).__name__}: {erreur}",
                        "secondes": secondes,
                        "cout_usd": 0.0,
                    })
                    journal(f"{variante.cle:<16} jet {jet} — echec en {secondes:.0f}s : {type(erreur).__name__}")
                    return
                fichier.write_bytes(image.octets)
                secondes = round(time.monotonic() - debut, 1)
                total = await self.caisse.ajoute(image.cout_usd)
                await self._noter(variante.cle, f"jet{jet}", {
                    "cout_usd": image.cout_usd,
                    "unite": image.unite,
                    "consomme": image.consomme,
                    "secondes": secondes,
                    "octets": len(image.octets),
                })
                journal(f"{variante.cle:<16} jet {jet} — ${image.cout_usd:.4f} · {secondes:.0f}s · total ${total:.4f}")

        await asyncio.gather(*(un_tirage(j) for j in jets))

    async def passerelle_reelle(self) -> tuple[Any, dict[str, Any]]:
        """L'adaptateur du produit et son catalogue — le seul chemin qui paie."""
        from atelier.fournisseur.openrouter import CLE, OpenRouter
        from atelier.reglages import lire_secret

        passerelle = OpenRouter(lire_secret(CLE.nom))
        if (raison := passerelle.indisponible()) is not None:
            raise RuntimeError(raison)
        catalogue = {m.chez_lui: m for m in await passerelle.catalogue()}
        return passerelle, catalogue

    def bilan(self) -> None:
        print(f"\ntotal depense sur ce lancement : ${self.caisse.depense:.4f}")
        if self.caisse.depense >= self.plafond:
            print("[!] plafond atteint — des tirages ont ete sautes.")


# ── Les notes de l'auteur ────────────────────────────────────────────────────


def notes_de(essai: str) -> dict[str, Any]:
    """`essais/notes-<essai>.json`, écrit par l'auteur depuis le rapport. Vide s'il n'est pas là."""
    chemin = RACINE / f"notes-{essai}.json"
    if not chemin.exists():
        return {}
    return json.loads(chemin.read_text("utf-8"))


def notes_anciennes_du_temoin() -> dict[str, str]:
    """Les notes du 1ᵉʳ septembre sur le témoin — affichées en gris, jamais réutilisées."""
    if not NOTES_AUTEUR.exists():
        return {}
    notes = json.loads(NOTES_AUTEUR.read_text("utf-8"))
    prefixe = f"m:{MODELE_DEFAUT}:"
    return {k[len(prefixe):]: v for k, v in notes.items() if k.startswith(prefixe)}


# ── Le rapport ───────────────────────────────────────────────────────────────

STYLE = STYLE_RAPPORT + """
/* ── ce que les six essais ajoutent au style des bancs ── */
.colonnes{display:grid;gap:14px;margin-top:14px;align-items:start}
.colonne{min-width:0}
.colonne h3{font-size:13px;margin:0 0 8px;padding:8px 10px;background:var(--fond-1);
 border:1px solid var(--bord);border-radius:3px;display:flex;justify-content:space-between;gap:8px}
.colonne h3 .cle{font-family:ui-monospace,Consolas,monospace;color:var(--signal)}
.colonne h3 .prix{color:var(--texte-3);font-weight:400;font-size:11px}
.entete-colonne{margin:0 0 10px;padding:8px;background:var(--fond-1);border:1px solid var(--bord);
 border-radius:3px;font-size:11px;color:var(--texte-2)}
.entete-colonne img{display:block;image-rendering:pixelated;background:var(--fond-3);margin-bottom:6px;max-width:100%}
.tirage{background:var(--fond-2);border:1px solid var(--bord);border-radius:3px;margin-bottom:10px;
 overflow:hidden;scroll-margin-top:86px}
.tirage[data-note=bon]{border-color:rgba(95,168,113,.6)}
.tirage[data-note=moyen]{border-color:rgba(200,160,60,.6)}
.tirage[data-note=mauvais]{border-color:rgba(203,108,101,.55)}
.tirage.vise{box-shadow:0 0 0 2px var(--signal)}
.tirage .tete{display:flex;justify-content:space-between;align-items:center;padding:5px 9px;
 border-bottom:1px solid var(--bord);background:var(--fond-1);font-size:11px;color:var(--texte-2)}
.tirage .anim{display:flex;justify-content:center;background:var(--fond-3);cursor:zoom-in}
.tirage .anim img{width:132px;height:132px;display:block}
.tirage .anim.vide{color:var(--texte-3);font-size:11px;padding:40px 10px;text-align:center;cursor:default;height:132px}
.faits{padding:6px 9px;font-size:10.5px;color:var(--texte-3);font-family:ui-monospace,Consolas,monospace;
 display:flex;flex-wrap:wrap;gap:3px 10px;border-top:1px solid var(--bord);user-select:none}
.faits .mal{color:var(--echec)}
.ancienne{padding:4px 9px;font-size:10.5px;color:var(--texte-3);font-style:italic;border-top:1px solid var(--bord)}
.notation{border-top:1px solid var(--bord)}
.notation .note{border-top:0}
.echecs{padding:6px 9px 4px;display:flex;flex-direction:column;gap:2px;font-size:10.5px;color:var(--texte-2)}
.echecs label{display:flex;gap:6px;align-items:flex-start;cursor:pointer;line-height:1.35}
.echecs input{margin:2px 0 0;flex:none}
.libre{width:100%;box-sizing:border-box;background:var(--fond-1);color:var(--texte);border:0;
 border-top:1px solid var(--bord);padding:6px 9px;font:inherit;font-size:11px}
.libre::placeholder{color:var(--texte-3)}
.depliant{margin-top:22px;background:var(--fond-1);border:1px solid var(--bord);border-radius:3px}
.depliant summary{cursor:pointer;padding:10px 14px;font-size:13px;color:var(--texte-2)}
.depliant summary b{color:var(--texte)}
.depliant .corps{padding:0 14px 14px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:1000px){.depliant .corps{grid-template-columns:1fr}}
.envoye-texte{white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;
 color:var(--texte-2);line-height:1.5;background:var(--fond-0);padding:10px;border-radius:3px;
 border:1px solid var(--bord);max-height:520px;overflow:auto}
.titre-partie{color:var(--signal);font-weight:700;background:rgba(73,179,206,.12);padding:0 4px}
.diff{white-space:normal;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.7;
 color:var(--texte-3);background:var(--fond-0);padding:10px;border-radius:3px;border:1px solid var(--bord);
 max-height:520px;overflow:auto}
.diff ins{color:var(--ok);background:rgba(95,168,113,.16);text-decoration:none;padding:0 2px}
.diff del{color:var(--echec);background:rgba(203,108,101,.16);padding:0 2px}
.jointes{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.jointes figure{margin:0;font-size:10.5px;color:var(--texte-3);font-family:ui-monospace,Consolas,monospace}
.jointes img{display:block;width:96px;height:96px;object-fit:contain;background:var(--fond-3);
 border:1px solid var(--bord);image-rendering:pixelated;margin-bottom:4px}
.regle{background:var(--fond-1);border:1px solid var(--bord);border-left:3px solid var(--epingle);
 border-radius:3px;padding:12px 16px;margin-top:12px;font-size:13px}
.regle .verdict-regle{margin-top:8px;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--texte-2)}
.regle .verdict-regle .oui{color:var(--ok)}.regle .verdict-regle .non{color:var(--echec)}
.regle .verdict-regle .attente{color:var(--texte-3)}
#panneau{position:fixed;inset:0;background:rgba(11,13,16,.96);z-index:50;overflow:auto;padding:24px}
#panneau .cadre{position:relative;display:inline-block}
#panneau img{display:block;image-rendering:pixelated}
#panneau svg{position:absolute;left:0;top:0;pointer-events:none}
#panneau .legende-panneau{color:var(--texte-2);font-size:12px;margin-bottom:10px}
.avertissement{color:var(--epingle);font-size:12px;margin:6px 0 0}
.tableau-appels td:first-child{font-family:ui-monospace,Consolas,monospace}
"""

SCRIPT = r"""
(function(){
 var CLE='notes-'+ESSAI+':'+SEANCE, notes={}, dispo=true, vise=null;
 try{ notes=JSON.parse(localStorage.getItem(CLE)||'{}')||{};
      localStorage.setItem(CLE+':essai','1'); localStorage.removeItem(CLE+':essai');
 }catch(e){ dispo=false; }
 function prevenir(){ var z=document.getElementById('alerte'); if(z&&z.hidden){ z.hidden=false; } }
 function sauver(){ if(!dispo){ prevenir(); return; }
  try{ localStorage.setItem(CLE,JSON.stringify(notes)); }catch(e){ dispo=false; prevenir(); } }
 function entree(id){ if(!notes[id]) notes[id]={}; return notes[id]; }
 function nettoyer(id){ var n=notes[id]; if(!n) return;
  if(!n.note && !(n.echecs&&n.echecs.length) && !n.libre) delete notes[id]; }

 var cartes=[].slice.call(document.querySelectorAll('.tirage[data-id]'));

 // **Un seul métronome pour toutes les animations** : 125 ms, même phase de
 // départ. Les images de chaque animation sont décodées une fois, à l'ouverture.
 var animees=[].slice.call(document.querySelectorAll('img.anim-img')).map(function(img){
  var liste=JSON.parse(img.getAttribute('data-images')||'[]').map(function(b){ return 'data:image/png;base64,'+b; });
  liste.forEach(function(u){ var i=new Image(); i.src=u; });
  return {img:img, images:liste};
 });
 var phase=0;
 setInterval(function(){
  phase++;
  animees.forEach(function(a){ if(a.images.length>1){ a.img.src=a.images[phase % a.images.length]; } });
 }, MS);
 window.ANIMER=function(img, liste){ var d=animees.filter(function(a){ return a.img===img; })[0];
  if(d){ d.images=liste; } else { animees.push({img:img, images:liste}); } };

 function peindre(c){
  var id=c.getAttribute('data-id'), n=notes[id]||{};
  if(n.note){ c.setAttribute('data-note',n.note); } else { c.removeAttribute('data-note'); }
  [].forEach.call(c.querySelectorAll('.note button'),function(b){ b.classList.toggle('actif', b.getAttribute('data-v')===n.note); });
  [].forEach.call(c.querySelectorAll('.echecs input'),function(i){ i.checked = !!(n.echecs && n.echecs.indexOf(i.value)>=0); });
  var l=c.querySelector('.libre'); if(l && l.value!==(n.libre||'')) l.value=n.libre||'';
 }
 function noter(c,v){ var id=c.getAttribute('data-id'), n=entree(id);
  if(n.note===v){ delete n.note; } else { n.note=v; }
  nettoyer(id); sauver(); peindre(c); recalculer(); }
 function cocher(c,valeur,etat){ var id=c.getAttribute('data-id'), n=entree(id); n.echecs=n.echecs||[];
  var i=n.echecs.indexOf(valeur); if(etat && i<0) n.echecs.push(valeur); if(!etat && i>=0) n.echecs.splice(i,1);
  nettoyer(id); sauver(); recalculer(); }
 function ecrire(c,texte){ var id=c.getAttribute('data-id'), n=entree(id); n.libre=texte; nettoyer(id); sauver(); }

 cartes.forEach(function(c){
  peindre(c);
  c.addEventListener('click',function(e){
   var b=e.target; while(b && b!==c && b.tagName!=='BUTTON'){ b=b.parentNode; }
   if(b && b.tagName==='BUTTON' && b.hasAttribute('data-v')){ noter(c, b.getAttribute('data-v')); }
  });
  [].forEach.call(c.querySelectorAll('.echecs input'),function(i){
   i.addEventListener('change',function(){ cocher(c,i.value,i.checked); });
  });
  var l=c.querySelector('.libre'); if(l){ l.addEventListener('input',function(){ ecrire(c,l.value); }); }
  var a=c.querySelector('.anim[data-planche]'); if(a){ a.addEventListener('click',function(){ ouvrir(c); }); }
  c.addEventListener('mouseenter',function(){ vise=c; c.classList.add('vise'); });
  c.addEventListener('mouseleave',function(){ if(vise===c){ vise=null; } c.classList.remove('vise'); });
 });
 document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){ fermer(); return; }
  if(!vise || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return;
  var v={'1':'mauvais','2':'moyen','3':'bon'}[e.key];
  if(v){ e.preventDefault(); noter(vise,v); }
 });

 // La planche brute à 1:1, les rectangles du produit par-dessus, Échap ferme.
 var panneau=document.getElementById('panneau');
 function ouvrir(c){
  var a=c.querySelector('.anim[data-planche]'); if(!a) return;
  var src=a.getAttribute('data-planche'), boites=JSON.parse(a.getAttribute('data-boites')||'[]');
  var w=+a.getAttribute('data-w'), h=+a.getAttribute('data-h');
  var rects=boites.map(function(b){ return '<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0]+1)+'" height="'+(b[3]-b[1]+1)+'" fill="none" stroke="#49B3CE" stroke-width="3"/>'; }).join('');
  panneau.innerHTML='<div class=legende-panneau>'+c.getAttribute('data-id')+' — planche brute à 1:1, '+boites.length+' rectangle(s) de découpe trouvés par le produit. <b>Échap</b> ferme.</div>'
   +'<div class=cadre><img src="'+src+'" width="'+w+'" height="'+h+'"><svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+rects+'</svg></div>';
  panneau.hidden=false;
 }
 function fermer(){ panneau.hidden=true; panneau.innerHTML=''; }
 panneau.addEventListener('click',fermer);

 // Le tableau du verdict se recalcule à chaque note.
 function stats(){
  var s={};
  Object.keys(GROUPES).forEach(function(cle){
   var g=GROUPES[cle], r={cle:cle,titre:g.titre,essais:g.jets.length,revenues:0,bon:0,moyen:0,mauvais:0,notees:0,cout:g.cout,echecs:{}};
   g.jets.forEach(function(j){ if(j.revenue) r.revenues++;
    var n=notes[cle+':'+j.jet]||{};
    if(n.note){ r[n.note]++; r.notees++; }
    (n.echecs||[]).forEach(function(e){ r.echecs[e]=(r.echecs[e]||0)+1; });
   });
   r.taux = r.notees ? Math.round(r.bon/r.notees*100) : null;
   r.prix_par_bonne = r.bon ? r.cout/r.bon : null;
   s[cle]=r;
  });
  return s;
 }
 function recalculer(){
  var s=stats(), corps=document.getElementById('verdict-corps'), lignes='';
  var faites=0,total=0,nb={bon:0,moyen:0,mauvais:0};
  Object.keys(GROUPES).forEach(function(cle){ var r=s[cle]; total+=r.essais; faites+=r.notees; nb.bon+=r.bon; nb.moyen+=r.moyen; nb.mauvais+=r.mauvais;
   var ech=Object.keys(r.echecs).map(function(e){ return r.echecs[e]+'× '+e; }).join(' · ');
   lignes+='<tr><td class=mono>'+cle+'</td><td>'+r.essais+'</td><td>'+r.revenues+'</td><td>'+r.notees+'</td>'
    +'<td class=b-bon><b>'+r.bon+'</b></td><td class=b-moyen>'+r.moyen+'</td><td class=b-mauvais>'+r.mauvais+'</td>'
    +'<td>'+(r.taux===null?'—':r.taux+' %')+'</td><td>$'+r.cout.toFixed(3)+'</td>'
    +'<td><b>'+(r.prix_par_bonne===null?'—':'$'+r.prix_par_bonne.toFixed(3))+'</b></td>'
    +'<td style="text-align:left;white-space:normal;font-size:11px;color:var(--texte-3)">'+(ech||'—')+'</td></tr>';
  });
  corps.innerHTML=lignes;
  document.getElementById('compte').textContent=faites+' / '+total+' notées';
  document.getElementById('nb-bon').textContent=nb.bon;
  document.getElementById('nb-moyen').textContent=nb.moyen;
  document.getElementById('nb-mauvais').textContent=nb.mauvais;
  document.getElementById('releve').value=JSON.stringify(exporter(),null,1);
  var z=document.getElementById('verdict-regle');
  if(z && typeof REGLE==='function'){ try{ z.innerHTML=REGLE(s, notes).map(function(l){ return '<div>'+l+'</div>'; }).join(''); }catch(e){ z.textContent='règle : '+e; } }
  if(typeof APRES_NOTE==='function'){ APRES_NOTE(notes); }
 }
 function exporter(){ return {essai:ESSAI, seance:SEANCE, exporte_le:new Date().toISOString(), notes:notes}; }
 window.NOTES=function(){ return notes; }; window.SAUVER=function(){ sauver(); recalculer(); };

 document.getElementById('filtre').addEventListener('change',function(e){ document.body.classList.toggle('reste', e.target.checked); });
 document.getElementById('copier').addEventListener('click',function(){
  var t=document.getElementById('releve'), z=document.getElementById('zone-releve'); var cache=z.hidden; z.hidden=false; t.select();
  var ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  if(navigator.clipboard){ navigator.clipboard.writeText(t.value).then(function(){},function(){}); ok=true; }
  if(ok && cache){ z.hidden=true; } var b=this; b.textContent = ok ? 'copié !' : 'sélectionne et copie ci-dessous';
  setTimeout(function(){ b.textContent='copier mon relevé'; },1800);
 });
 document.getElementById('telecharger').addEventListener('click',function(){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(exporter(),null,1)],{type:'application/json'}));
  a.download='notes-'+ESSAI+'.json'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
 });
 document.getElementById('vider').addEventListener('click',function(){
  if(!confirm('Effacer toutes les notes de cette séance ?')) return; notes={}; sauver(); cartes.forEach(peindre); recalculer(); });
 document.getElementById('voir-releve').addEventListener('click',function(){
  var z=document.getElementById('zone-releve'); z.hidden=!z.hidden; this.textContent = z.hidden ? 'voir le relevé' : 'cacher le relevé'; });
 recalculer(); if(!dispo) prevenir();
})();
"""


def image_animee(images: Sequence[str], cote: int = COTE_VUE, classe: str = "anim-img") -> str:
    """Une image que le métronome de la page fait défiler — ses images en attribut."""
    return (
        f"<img class='{classe}' alt=animation decoding=async width={cote} height={cote} "
        f"src='data:image/png;base64,{images[0]}' "
        f"data-images='{json.dumps(list(images))}'>"
    )


def _carte(
    variante: Variante,
    jet: int,
    fichier: Path | None,
    ligne: dict,
    anciennes: dict[str, str],
    cases: int,
) -> tuple[str, bool]:
    """Une case de la grille : l'animation, les faits, la notation. Rend aussi « revenue »."""
    ident = f"{variante.cle}:jet{jet}"
    parts = [f'<div class=tirage data-id="{html.escape(ident)}">']
    parts.append(f"<div class=tete><span>jet {jet}</span><span>{variante.cle}</span></div>")
    revenue = False
    if fichier is not None and fichier.exists():
        octets = fichier.read_bytes()
        images = animer(octets)
        faits = juger_machine(octets, cases)
        with Image.open(io.BytesIO(octets)) as im:
            largeur, hauteur = im.size
        if images:
            revenue = True
            parts.append(
                f"<div class=anim data-planche='data:image/png;base64,{_b64(octets)}' "
                f"data-boites='{json.dumps(faits['boites'])}' data-w={largeur} data-h={hauteur} "
                f"title='clic : la planche brute à 1:1'>"
                + image_animee(images) + "</div>"
            )
        else:
            parts.append("<div class='anim vide'>planche illisible — moins de deux cases trouvées</div>")
        mal_compte = " class=mal" if not faits["compte_ok"] or faits["sujets"] != cases else ""
        mal_decoupe = " class=mal" if not faits["decoupable"] else ""
        cout = ligne.get("cout_usd")
        secondes = ligne.get("secondes")
        parts.append(
            "<div class=faits>"
            f"<span{mal_compte}>sujets {faits['sujets']}/{cases}</span>"
            f"<span{mal_decoupe}>découpable {'oui' if faits['decoupable'] else 'non'}</span>"
            f"<span>remplissage {faits['remplissage_pct']} %</span>"
            f"<span>{largeur}×{hauteur}</span>"
            + (f"<span>{cout:.4f} $</span>" if cout else "<span>—</span>")
            + (f"<span>{secondes:.0f} s</span>" if secondes else "")
            + "</div>"
        )
    elif ligne.get("echec"):
        parts.append(f"<div class='anim vide'>l'appel n'a pas abouti<br>{html.escape(str(ligne['echec']))}</div>")
        parts.append(f"<div class=faits><span>perdu à attendre {ligne.get('secondes') or 0:.0f} s</span><span>facturé rien</span></div>")
    else:
        parts.append("<div class='anim vide'>pas encore tiré</div>")
    if variante.temoin and f"jet{jet}" in anciennes:
        # En gris, à titre d'information : ces notes ont bougé de 25 % à 62 % entre
        # deux lectures, elles ne servent pas. Le témoin se renote dans chaque séance.
        parts.append(f"<div class=ancienne>notée « {html.escape(anciennes[f'jet{jet}'])} » le 1ᵉʳ septembre — à renoter ici</div>")
    parts.append("<div class=notation><div class=note>")
    for valeur, mot, touche in (("mauvais", "Mauvais", 1), ("moyen", "Moyen", 2), ("bon", "Bon", 3)):
        parts.append(f"<button data-v={valeur} title='raccourci : {touche}'>{mot}</button>")
    parts.append("</div>")
    if variante.echecs_prevus:
        parts.append("<div class=echecs>")
        for echec in variante.echecs_prevus:
            parts.append(f"<label><input type=checkbox value='{html.escape(echec, quote=True)}'> {html.escape(echec)}</label>")
        parts.append("</div>")
    parts.append("<input class=libre type=text placeholder='autre — une ligne' maxlength=200>")
    parts.append("</div></div>")
    return "".join(parts), revenue


def _depliant(variante: Variante, temoin: Variante) -> str:
    """Ce qui est parti, exactement : le texte, la différence avec le témoin, les images."""
    parts = [f"<details class=depliant><summary><b>{html.escape(variante.cle)}</b> · ce qui est parti — "
             f"{html.escape(variante.titre)}</summary><div class=corps>"]
    parts.append(f"<div><div class=titre style='font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--texte-3);margin:0 0 6px'>le texte envoyé</div>"
                 f"<div class=envoye-texte>{_texte_surligne(variante.texte)}</div></div>")
    if variante is temoin:
        diff = "<div class=diff>c'est le témoin — la différence se lit dans les autres dépliants</div>"
    elif variante.texte == temoin.texte:
        diff = "<div class=diff>texte identique au témoin, mot pour mot</div>"
    else:
        diff = f"<div class=diff>{_diff_html(temoin.texte, variante.texte)}</div>"
    parts.append(f"<div><div style='font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--texte-3);margin:0 0 6px'>"
                 f"la différence mot à mot avec le témoin — <ins style='color:var(--ok);text-decoration:none'>ajouté</ins> "
                 f"<del style='color:var(--echec)'>retiré</del></div>{diff}</div>")
    parts.append("<div style='grid-column:1/-1'><div style='font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--texte-3)'>"
                 f"les images envoyées, dans l'ordre · format demandé {html.escape(variante.proportions)}"
                 + (f" · négatif « {html.escape(variante.negatif)} »" if variante.negatif else "")
                 + "</div><div class=jointes>")
    for image in variante.images:
        parts.append(f"<figure><img alt='{html.escape(image.role)}' src='data:image/png;base64,{vignette(image.octets, 96)}'>"
                     f"<figcaption>{html.escape(image.legende)}</figcaption></figure>")
    parts.append("</div></div></div></details>")
    return "".join(parts)


def rapport(
    essai: str,
    titre: str,
    variantes: Sequence[Variante],
    seance: Seance,
    *,
    question: str,
    attendu: str,
    regle: str,
    regle_js: str = "function(s){ return []; }",
    jets: Sequence[int] = JETS,
    avant: str = "",
    apres: str = "",
    script_extra: str = "",
    avertissements: Sequence[str] = (),
    sortie: Path | None = None,
    groupes_extra: dict[str, Any] | None = None,
    chapeau_extra: str = "",
) -> Path:
    """Le rapport d'un essai : autonome, hors ligne, les neuf points du § 1.2.

    `regle_js` reçoit les statistiques par variante et rend les lignes du
    verdict de la règle, sans conclure à la place de l'auteur. `avant` et
    `apres` sont du HTML propre à l'essai, posé autour de la grille.
    """
    temoin = variantes[0]
    anciennes = notes_anciennes_du_temoin()
    seance_cle = seance.seance_courante()
    sortie = sortie or (RACINE / f"rapport-{essai}.html")

    groupes: dict[str, Any] = {}
    colonnes: list[str] = []
    a_faire = 0
    for v in variantes:
        dossier = seance.dossier_de(v)
        releve = seance.releve_de(v)
        cout = sum(float(l.get("cout_usd") or 0.0) for l in releve.values())
        cartes: list[str] = []
        jets_json: list[dict] = []
        for jet in (v.jets or jets):
            fichier = dossier / f"jet{jet}.png"
            carte_html, revenue = _carte(v, jet, fichier, releve.get(f"jet{jet}", {}), anciennes, v.cases)
            cartes.append(carte_html)
            jets_json.append({"jet": f"jet{jet}", "revenue": revenue})
            if not revenue and not v.temoin and not releve.get(f"jet{jet}", {}).get("echec"):
                a_faire += 1
        groupes[v.cle] = {"titre": v.titre, "cout": round(cout, 4), "jets": jets_json}
        colonnes.append(
            f"<div class=colonne><h3><span><span class=cle>{html.escape(v.cle)}</span> {html.escape(v.titre)}</span>"
            f"<span class=prix>${cout:.3f}</span></h3>"
            + (f"<div class=entete-colonne>{v.entete_html}</div>" if v.entete_html else "")
            + "".join(cartes) + "</div>"
        )

    parts: list[str] = [
        "<!doctype html><html lang=fr><meta charset=utf-8>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        f"<title>{html.escape(titre)} — essai {html.escape(essai)}</title>"
        f"<style>{STYLE}</style><body><div class=page>",
        "<div class=barre>"
        "<span class=compte id=compte>0 / 0 notées</span>"
        "<span class=part>· <b class=b-bon id=nb-bon>0</b> bonnes · <b class=b-moyen id=nb-moyen>0</b> moyennes "
        "· <b class=b-mauvais id=nb-mauvais>0</b> mauvaises</span>"
        "<label><input type=checkbox id=filtre> ne montrer que celles qui restent</label>"
        "<span class=part>survole une planche et tape <b>1</b>, <b>2</b> ou <b>3</b> · clic sur l'animation : la planche à 1:1</span>"
        f"<span class=part>séance <b>{html.escape(seance_cle)}</b></span>"
        "<span class=pousse></span>"
        "<button id=voir-releve>voir le relevé</button><button id=copier>copier mon relevé</button>"
        "<button id=telecharger>télécharger le relevé</button><button id=vider>tout effacer</button>"
        "<span id=alerte hidden class=part style='color:var(--echec);flex-basis:100%'>⚠ ce navigateur ne mémorise pas "
        "les notes sur cette page — pense à <b>télécharger ton relevé</b> avant de la fermer.</span></div>"
        "<div id=zone-releve hidden style='margin:-10px 0 24px'><textarea id=releve readonly rows=6 style='width:100%;"
        "background:var(--fond-1);color:var(--texte-2);border:1px solid var(--bord);border-radius:3px;padding:10px;"
        "font:12px ui-monospace,Consolas,monospace'></textarea></div>",
        f"<h1>{html.escape(titre)}</h1>",
        f"<p class=chapeau><b>La question.</b> {question}</p>",
        f"<p class=chapeau><b>Ce qu'on attend.</b> {attendu}</p>",
        "<p class=chapeau>Le juge est l'auteur, à l'œil. Les chiffres sous chaque animation — sujets, découpable, "
        "remplissage, prix, durée — sont ceux de la machine : ils informent, ils ne classent rien. Les huit cases "
        "tournent <b>brutes, fond compris</b>, à 125 ms par image dans un carré de 132 px, même échelle, même vitesse, "
        "même phase de départ. Les notes vivent dans ce navigateur sous la clé de cette séance ; "
        "<b>télécharger le relevé</b> les écrit dans <code>essais/notes-" + html.escape(essai) + ".json</code>.</p>",
    ]
    if chapeau_extra:
        parts.append(chapeau_extra)
    for a in avertissements:
        parts.append(f"<p class=avertissement>⚠ {a}</p>")
    if groupes_extra:
        groupes = {**groupes_extra, **groupes}
    if a_faire:
        parts.append(f"<p class=avertissement>⚠ {a_faire} tirage(s) pas encore payé(s) : ce rapport est celui d'un lancement à sec ou incomplet.</p>")

    # ── ce qui part, ou est parti ────────────────────────────────────────
    parts.append("<h2 id=appels>Ce qui part, groupe par groupe</h2>")
    parts.append("<div class=tableau><table class=tableau-appels><thead><tr><th>Groupe</th><th>Ce qui change</th>"
                 "<th>Format</th><th>Images</th><th>Tirages là</th><th>Payé</th></tr></thead><tbody>")
    for v in variantes:
        dossier = seance.dossier_de(v)
        siens = v.jets or tuple(jets)
        la = sum(1 for j in siens if (dossier / f"jet{j}.png").exists())
        cout = groupes[v.cle]["cout"]
        parts.append(f"<tr><td>{html.escape(v.cle)}</td><td style='text-align:left;white-space:normal'>{html.escape(v.propos)}</td>"
                     f"<td>{html.escape(v.proportions)}</td><td>{len(v.images)}</td><td>{la} / {len(siens)}</td><td>${cout:.3f}</td></tr>")
    parts.append("</tbody></table></div>")

    # ── le verdict ───────────────────────────────────────────────────────
    parts.append("<h2 id=verdict>Le verdict — se recalcule à chaque note</h2>")
    parts.append("<div class=tableau><table><thead><tr><th>Groupe</th><th>Tirages</th><th>Revenues</th><th>Notées</th>"
                 "<th>Bonnes</th><th>Moyennes</th><th>Mauvaises</th><th>% bonnes</th><th>Total payé</th>"
                 "<th>$ par bonne</th><th>Échecs cochés</th></tr></thead><tbody id=verdict-corps></tbody></table></div>")
    parts.append(f"<div class=regle><b>La règle de décision, écrite d'avance.</b> {regle}"
                 "<div class=verdict-regle id=verdict-regle></div></div>")

    parts.append(avant)

    # ── les groupes côte à côte ──────────────────────────────────────────
    parts.append("<h2 id=planches>Les groupes côte à côte, le témoin en premier</h2>")
    parts.append(f"<div class=colonnes style='grid-template-columns:repeat({len(variantes)},minmax(0,1fr))'>" + "".join(colonnes) + "</div>")

    parts.append("<h2 id=envoye>Ce qui est parti, exactement</h2>")
    for v in variantes:
        parts.append(_depliant(v, temoin))

    parts.append(apres)
    parts.append("<div id=panneau hidden></div>")
    parts.append(
        "</div><script>"
        f"var ESSAI={json.dumps(essai)}, SEANCE={json.dumps(seance_cle)}, MS={MS}, GROUPES={json.dumps(groupes, ensure_ascii=False)};"
        # Le script propre à l'essai vient **après** celui du socle : il se sert
        # de `window.NOTES` et `window.SAUVER`, que le socle pose en s'exécutant.
        f"var REGLE={regle_js};{SCRIPT}{script_extra}</script></body></html>"
    )
    page = "".join(parts)
    sortie.write_text(page, encoding="utf-8")
    poids = sortie.stat().st_size / 1_048_576
    print(f"-> {sortie}  ({poids:.1f} Mo)")
    return sortie


# ── Ce que les scripts partagent en tête ─────────────────────────────────────


def preparer_sortie() -> None:
    """Trois lignes contre le cp1252 de Windows (`docs/PIEGES.md`)."""
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass


def arguments(description: str) -> Any:
    import argparse

    parseur = argparse.ArgumentParser(description=description)
    parseur.add_argument("--a-sec", action="store_true", help="montrer ce qui partirait, sans rien dépenser")
    parseur.add_argument("--rapport", action="store_true", help="ne refaire que le rapport, sans appel")
    # **Huit est la règle du cahier, quatre est ce que l'auteur a choisi le 2 septembre
    # 2026** pour dépenser moitié moins : avec quatre, une planche d'écart ne veut rien
    # dire, et le rapport compte le témoin sur le même nombre pour rester comparable.
    parseur.add_argument("--tirages", type=int, default=8, help="tirages par groupe (8 par défaut, la règle des huit)")
    return parseur
