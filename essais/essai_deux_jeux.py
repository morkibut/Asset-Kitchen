# -*- coding: utf-8 -*-
"""Deux jeux que tout oppose — le produit tient-il ses promesses sur les deux ?

**C'est le banc de couverture, et il passe par le vrai chemin.** Le précédent
(`essais/essai_vue.py`) a réparé une panne sur *un* projet, *une* pose, *un*
sujet. Il a mesuré ce qui répare ; il n'a rien dit de ce qui reste cassé
ailleurs. Celui-ci construit deux jeux réels, avec des personnages et des objets,
et **fait passer le lot principal par `ServiceGenerations.soumettre`** — le même
appel que la route de l'écran et que l'outil de l'agent. Ce qui casse ici casse
pour de vrai.

**Deux bras font exception, et il faut le dire.** Comparer deux queues de prompt
demande d'écrire soi-même la queue, ce que le produit ne permet pas : le bras du
cadrage et le bras de la direction prennent le texte que le produit a composé
(`atelier.envoi.envoi`), lui ajoutent la queue à l'essai, et appellent le
fournisseur en direct. Le prompt reste donc celui du produit ; c'est le seul
endroit du banc où l'envoi ne l'est pas.

Les deux jeux s'opposent sur les quatre axes qui décident du prompt :

                      Néon Sous-Sol            Les Terres de Sel
    vue               de côté, plateforme      de dessus, stricte
    directions        2 (droite, gauche)       4 (sud, nord, est, ouest)
    taille de pixel   32 px                    64 px
    trait             contour noir épais       sans contour, tramé doux
    éclairage         néons, contre-jour       plein soleil, ombres dures

**Sept relevés, tous calculés sur la machine** — aucun jugement à l'œil n'entre
dans un chiffre publié :

 1. **La vue** — le rapport hauteur/largeur du sujet. Un corps debout de face est
    deux fois plus haut que large ; vu d'aplomb il est presque rond. On le
    compare à ce que la vue déclarée devrait donner.
 2. **Le sujet est-il seul ?** Le nombre de taches détachées. Un sprite isolé en
    fait une ; deux, et le modèle a ajouté quelque chose.
 3. **Le fond est-il plat ?** Le nombre de couleurs franches sur l'anneau du bord.
 4. **Le centrage** — l'écart du centre de la boîte au centre de l'image.
 5. **La grille de pixel** — le pas mesuré par `atelier.image.mesurer_grille`,
    avec sa réserve : elle situe un ordre de grandeur, elle prend parfois une
    harmonique, et elle ne remplace pas l'œil (`docs/PIEGES.md`).
 6. **La constance d'un sujet** — la distance entre les histogrammes de couleur
    de ses poses. C'est ce qui dit si un personnage reste le même d'une case à
    l'autre.
 7. **La variance d'un même appel** — dix générations rigoureusement identiques,
    pour savoir ce qui est du bruit et ce qui est un effet.

Et **deux cellules qui répondent à des questions ouvertes** :

  · **la langue** — la même chose demandée avec une bible tout en français, puis
    tout en anglais. `docs/etude-prompts.md` la laissait ouverte faute de mesure.
  · **la direction** — la même pose vers le sud puis vers le nord, sur le jeu à
    quatre directions. Personne n'a jamais vérifié qu'elle arrive.

── **Ce que le banc a trouvé, le 1ᵉʳ septembre 2026** ─────────────────────────

**113 images, 114 appels, environ 0,85 $** — dont 0,7185 $ pour 96 appels, lu
dans l'atelier du banc, et 18 appels hors registre reconstruits au prix unitaire
du jour. `--lire` ouvre là-dessus et le dit ; le banc note désormais ces deux
bras au lieu de laisser reconstruire.

**La mesure la plus utile est celle du bruit** : dix appels rigoureusement
identiques. Sans elle, la moitié des conclusions auraient été fausses — et deux
des sept relevés ont été retirés ou refaits à cause d'elle.

  · **Le compte de taches est inutilisable** : de 1 à 42 sur dix appels
    identiques. Il ne compte pas des objets, il compte des grains de tramage.
  · **Juger la vue contre une fourchette fixe était une faute de ce banc**, pas
    du produit : douze cellules marquées en défaut, aucune ne l'était. Un drone
    est plus large que haut. L'étalon d'un sujet est **son propre artwork**.

**Quatre défauts réparés** : la phrase de caméra parlait anatomie et partait à un
quadricoptère ; `held in one hand` faisait dessiner une main sur un objet
d'inventaire ; `open, lid raised` faisait lever un couvercle à un distributeur ;
et le sujet n'occupait que 14,7 % de l'image, porté à 20,1 % par une phrase de
cadre en queue — 37 % de pixels en plus avant le rééchantillonnage.

**Un échec, et c'est le résultat qui compte le plus.** Sur un jeu vu de dessus,
*marche vers le sud* et *marche vers le nord* rendent la même image. Quatre bras
mesurés à la masse du tiers haut ; et **c'est le témoin qui tranche** : le même
appel du produit, payé deux fois à deux moments, donne un écart sud/nord de 3,2 %
puis de 0,6 %. Un effet qui ne se reproduit pas d'un lot à l'autre n'est pas un
effet, et aucune des deux formulations essayées ne fait mieux que ce témoin-là.
**La direction ne s'obtient pas par des mots**, et c'est ce que
`docs/etude-mannequin.md` supposait déjà pour l'attitude.

**Le vrai plancher de ce banc n'est pas celui d'une image, c'est celui d'un
lot.** Dix appels identiques donnent ±0,9 % ; deux lots de trois tirages du même
appel donnent ±1,4 %. C'est le second qui juge, et il a failli manquer : jugé au
premier, un des bras passait pour un succès.

**Une question fermée** : la langue de la bible ne change rien. Français ou
anglais, même vue, même style.

    py essais/essai_deux_jeux.py              # monte les jeux, montre les prompts
    py essais/essai_deux_jeux.py --verifier   # tout prouver avant de payer
    py essais/essai_deux_jeux.py --payer      # le lot principal, ~0,55 $
    py essais/essai_deux_jeux.py --reprise    # les cellules réparées, ~0,23 $
    py essais/essai_deux_jeux.py --direction  # les deux bras de direction, ~0,10 $
    py essais/essai_deux_jeux.py --mesurer    # les relevés, gratuit
    py essais/essai_deux_jeux.py --lire       # ce qu'ils disent, gratuit
    py essais/essai_deux_jeux.py --planches   # les planches de contact, gratuit

**Sans `--payer`, aucun appel n'est fait**, et une image déjà là est sautée même
avec : relancer ne repaie jamais. L'atelier du banc vit sous
`essais/resultats/deux-jeux/`, à côté des images ; il ne touche jamais
`donnees/`.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))
sys.path.insert(0, str(RACINE))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.domaine import Demande  # noqa: E402
from atelier.image import mesurer_grille, taches  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from essai_identite import lire_cle  # noqa: E402

SORTIE = RACINE / "resultats" / "deux-jeux"
ATELIER = SORTIE / "atelier"
MESURES = RACINE / "mesures_deux_jeux.json"

# **Les deux bras qui n'ont pas de registre.** Comparer deux queues de prompt
# demande d'écrire soi-même la queue, donc de sortir de `soumettre` : le cadrage
# et la direction appellent le fournisseur en direct, avec le texte que le
# produit a composé. L'atelier du banc ne les voit donc pas passer, et leur prix
# n'était nulle part — on l'a retrouvé à la main une fois, ce qui est une fois de
# trop. Ils l'écrivent ici désormais.
NOTES = RACINE / "notes_deux_jeux.json"

# **Les trois lots d'images, et le préfixe sous lequel chacun se relève.** Ils
# étaient trois dossiers sans rien pour les tenir ensemble, et `--mesurer` n'en
# lisait qu'un : quarante-deux images payées ne rendaient aucun chiffre. Le
# préfixe entre dans la clef du relevé, ce qui laisse les sections se servir
# chacune dans son lot sans se marcher dessus.
IMAGES = SORTIE / "images"
REPRISE = SORTIE / "images-reprise"
DIRECTION = SORTIE / "images-direction"
LOTS = ((IMAGES, ""), (REPRISE, "reprise."), (DIRECTION, "bras."))

MODELE = "OpenRouter:openai/gpt-image-2"
OPTIONS = {"quality": "low"}
JETS = 3
VARIANCE = 10  # la cellule qui dit ce qui est du bruit


# ─────────────────────────────────────────────────────────────────────────────
# Les deux jeux
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Chose:
    nom: str
    type: str
    description: str
    poses: tuple[str, ...]
    reference: bool = False  # on lui fabrique d'abord un artwork, puis on le promeut


@dataclass(frozen=True)
class Jeu:
    repere: str
    nom: str
    vue: str
    cible: int
    bible: dict[str, str]
    choses: tuple[Chose, ...]
    # La vue attendue, en rapport hauteur/largeur, telle qu'on la juge :
    # (borne basse, borne haute). Écrite ici parce qu'elle dépend de la vue et
    # non du sujet — un profil debout est légitimement haut.
    attendu: tuple[float, float]


NEON = Jeu(
    repere="neon",
    nom="Néon Sous-Sol",
    vue="vue-cote-plateforme",
    cible=32,
    bible={
        "monde": "Sous-sols d'une mégapole sous la pluie, néons roses et cyan, "
        "béton humide, câbles pendants, tags effacés",
        "epoque": "Futur proche, après la chute des réseaux",
        "trait": "chunky pixel art, thick solid black outline, flat fills, "
        "hard dithered shadows, no gradients, no anti-aliasing",
        "eclairage": "Néons roses et cyan, contre-jour, reflets mouillés au sol",
    },
    choses=(
        Chose(
            "la gamine au capuchon",
            "personnage",
            "Character design:\n"
            "- oversized magenta hooded raincoat\n"
            "- cropped black cargo trousers\n"
            "- heavy scuffed boots\n"
            "- a cracked handheld terminal clipped to the belt\n"
            "- short teal hair under the hood",
            ("repos", "marche", "attaque"),
            reference=True,
        ),
        Chose(
            "le drone de garde",
            "créature",
            "Character design:\n"
            "- a squat quadcopter drone of dented grey metal\n"
            "- a single cyan eye lens at the front\n"
            "- four short rotor arms\n"
            "- a red warning stripe around the hull",
            ("repos", "marche", "attaque"),
            reference=True,
        ),
        Chose(
            "la carte d'accès",
            "objet tenu",
            "a scratched plastic access card, magenta stripe, tiny chip contact",
            ("tenu",),
        ),
        Chose(
            "le distributeur",
            "meuble",
            "a battered street vending machine, cyan neon sign, cracked front glass",
            ("ferme", "ouvert"),
        ),
    ),
    # De profil, debout : haut et étroit. On refuse le presque-rond, qui serait
    # une vue de dessus, et le très allongé, qui serait un plan large.
    attendu=(1.3, 2.6),
)

SEL = Jeu(
    repere="sel",
    nom="Les Terres de Sel",
    vue="vue-dessus-stricte",
    cible=64,
    bible={
        "monde": "Hauts plateaux de sel blanc, caravanes lentes, tentes de laine "
        "écrue, oasis rares et gardées",
        "epoque": "Antiquité de désert, avant le fer",
        "trait": "soft pixel art, no outline at all, pastel palette, shading built "
        "from dithering only, no gradients, no anti-aliasing",
        "eclairage": "Plein soleil de midi, blanc éclatant, ombres dures et très "
        "courtes",
    },
    choses=(
        Chose(
            "la porteuse d'eau",
            "personnage",
            "Character design:\n"
            "- long undyed linen robe with a wide sash\n"
            "- a pale headwrap covering hair and neck\n"
            "- bare feet with leather ankle cords\n"
            "- a wide clay water jar carried on one shoulder",
            ("repos", "marche", "attaque"),
            reference=True,
        ),
        Chose(
            "le lézard de sel",
            "créature",
            "Character design:\n"
            "- a stout desert lizard the size of a dog\n"
            "- chalk-white crusted scales along the spine\n"
            "- pale sand-coloured flanks\n"
            "- a short thick tail and splayed toes",
            ("repos", "marche", "attaque"),
            reference=True,
        ),
        Chose(
            "la jarre",
            "objet posé",
            "a wide unglazed clay water jar, two small handles, chipped rim",
            ("pose",),
        ),
        Chose(
            "le coffre de caravane",
            "meuble",
            "a low wooden caravan chest, woven wool straps, brass corner plates",
            ("ferme", "ouvert"),
        ),
    ),
    # D'aplomb : presque rond. Le haut de la fourchette laisse la place à un
    # objet allongé — une jarre est plus haute que large, même vue de dessus.
    attendu=(0.7, 1.45),
)

JEUX = (NEON, SEL)


# La cellule de langue : la même chose, la même pose, deux bibles. Elle vit sur
# le jeu de sel, dont la vue est celle du vrai projet de l'auteur.
BIBLE_FRANCAISE = {
    "monde": "Hauts plateaux de sel blanc, caravanes lentes, tentes de laine "
    "écrue, oasis rares et gardées",
    "epoque": "Antiquité de désert, avant le fer",
    "trait": "pixel art doux, aucun contour, palette pastel, ombres faites de "
    "tramage uniquement, aucun dégradé, aucun lissage",
    "eclairage": "Plein soleil de midi, blanc éclatant, ombres dures et très courtes",
}
BIBLE_ANGLAISE = {
    "monde": "High plateaus of white salt, slow caravans, undyed wool tents, "
    "rare and guarded oases",
    "epoque": "Desert antiquity, before iron",
    "trait": "soft pixel art, no outline at all, pastel palette, shading built "
    "from dithering only, no gradients, no anti-aliasing",
    "eclairage": "Full midday sun, blinding white, hard and very short shadows",
}


# ─────────────────────────────────────────────────────────────────────────────
# Monter les deux jeux
# ─────────────────────────────────────────────────────────────────────────────


def monter(atelier: Atelier) -> dict[str, dict[str, str]]:
    """Les deux projets, leurs choses, et l'identifiant de chacune."""
    repères: dict[str, dict[str, str]] = {}
    for jeu in JEUX:
        atelier.bibliotheque.creer_projet(jeu.nom)
        projet = atelier.bibliotheque.courant
        atelier.univers.regler_univers(
            projet,
            bible=[{"nom": n, "texte": t, "actif": True} for n, t in jeu.bible.items()],
            cible_px=jeu.cible,
            vue=jeu.vue,
        )
        siennes: dict[str, str] = {"__projet__": projet}
        for chose in jeu.choses:
            faite = atelier.production.creer_personnage(projet, chose.nom)
            atelier.production.regler_personnage(
                projet,
                faite.identifiant,
                description=chose.description,
                type=chose.type,
            )
            siennes[chose.nom] = faite.identifiant
        repères[jeu.repere] = siennes
    return repères


# ─────────────────────────────────────────────────────────────────────────────
# Ce qu'on demande, cellule par cellule
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Cellule:
    """Un appel à faire, et de quoi le retrouver."""

    clef: str
    jeu: str
    projet: str
    personnage: str
    sujet: str
    pose: str | None
    direction: str | None
    jets: int


def cellules(repères: dict[str, dict[str, str]]) -> list[Cellule]:
    liste: list[Cellule] = []
    for jeu in JEUX:
        siennes = repères[jeu.repere]
        projet = siennes["__projet__"]
        for chose in jeu.choses:
            identifiant = siennes[chose.nom]
            # **L'artwork de référence d'abord**, quand la chose en veut un : c'est
            # le geste de l'auteur — on fabrique une image, on la désigne, et
            # toutes les poses la reçoivent ensuite. Sans pose : c'est le portrait
            # de la chose, pas une case de la matrice.
            if chose.reference:
                liste.append(
                    Cellule(
                        clef=f"{jeu.repere}.{identifiant}.artwork",
                        jeu=jeu.repere,
                        projet=projet,
                        personnage=identifiant,
                        sujet=chose.description,
                        pose=None,
                        direction=None,
                        jets=1,
                    )
                )
            for pose in chose.poses:
                liste.append(
                    Cellule(
                        clef=f"{jeu.repere}.{identifiant}.{pose}",
                        jeu=jeu.repere,
                        projet=projet,
                        personnage=identifiant,
                        sujet=chose.description,
                        pose=pose,
                        direction=None,
                        jets=JETS if chose.reference else 2,
                    )
                )
    # **La direction, sur le jeu qui en a quatre.** Personne n'a jamais vérifié
    # qu'elle arrive dans l'image ; la même pose vers le sud puis vers le nord le
    # dira d'un coup d'œil.
    sel = repères["sel"]
    porteuse = sel["la porteuse d'eau"]
    for direction in ("sud", "nord"):
        liste.append(
            Cellule(
                clef=f"sel.{porteuse}.marche.{direction}",
                jeu="sel",
                projet=sel["__projet__"],
                personnage=porteuse,
                sujet=SEL.choses[0].description,
                pose="marche",
                direction=direction,
                jets=2,
            )
        )
    return liste


# ─────────────────────────────────────────────────────────────────────────────
# Les mesures
# ─────────────────────────────────────────────────────────────────────────────

SEUIL_FOND = 34


def _masque(pixels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    bord = np.concatenate([pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]])
    fond = np.median(bord, axis=0)
    return np.abs(pixels - fond).max(axis=2) > SEUIL_FOND, fond


def relever(fichier: Path) -> dict[str, float] | None:
    """Les six relevés d'une image. Rien qui demande un œil."""
    with Image.open(fichier) as ouverte:
        image = ouverte.convert("RGB")
    pixels = np.asarray(image).astype(np.int16)
    hauteur_totale, largeur_totale = pixels.shape[:2]
    masque, fond = _masque(pixels)

    plancher = max(3, int(0.002 * hauteur_totale))
    ys = np.where(masque.sum(axis=1) > plancher)[0]
    xs = np.where(masque.sum(axis=0) > plancher)[0]
    if not len(ys) or not len(xs):
        return None
    hauteur = int(ys[-1] - ys[0] + 1)
    largeur = int(xs[-1] - xs[0] + 1)

    # **Le fond est-il plat ?** On regarde l'anneau du bord, sur 4 % du côté, et
    # on compte les couleurs franches — deux teintes voisines ne comptent pas
    # pour deux. Un fond dégradé, un décor, une vignette : tout se voit ici.
    marge = max(4, hauteur_totale // 25)
    anneau = np.concatenate(
        [
            pixels[:marge].reshape(-1, 3),
            pixels[-marge:].reshape(-1, 3),
            pixels[:, :marge].reshape(-1, 3),
            pixels[:, -marge:].reshape(-1, 3),
        ]
    )
    couleurs_fond = len(np.unique(anneau // 24, axis=0))

    # **Combien de taches détachées ?** Un sprite isolé en fait une. On réutilise
    # le compteur du produit, celui-là même qui sert au détourage.
    try:
        detachees = len(taches(np.dstack([pixels.astype(np.uint8), (masque * 255).astype(np.uint8)])))
    except Exception:  # pragma: no cover — la mesure ne doit jamais tomber
        detachees = -1

    try:
        pas, nettete = mesurer_grille(fichier.read_bytes())
    except Exception:  # pragma: no cover
        pas, nettete = -1, 0.0

    centre_y = (int(ys[0]) + int(ys[-1])) / 2
    centre_x = (int(xs[0]) + int(xs[-1])) / 2

    # **Où la matière se tient dans sa propre boîte.** Le rapport hauteur/largeur
    # dit la forme de la boîte ; il ne dit pas comment le sujet la remplit. Un
    # personnage vu d'aplomb qui s'éloigne montre sa nuque et ses épaules — sa
    # masse monte ; le même de face montre son visage et ses bras — elle
    # descend. C'est la seule mesure du banc qui puisse distinguer *vers le nord*
    # de *vers le sud* sans un œil. Elle ne vaut **que** comparée au bruit du §4 :
    # deux tirages du même appel ne donnent pas le même tiers à la décimale près.
    boite = masque[int(ys[0]) : int(ys[-1]) + 1, int(xs[0]) : int(xs[-1]) + 1]
    dedans = int(boite.sum())
    tiers_h = max(1, boite.shape[0] // 3)
    tiers_l = max(1, boite.shape[1] // 3)
    masse_du_haut = float(boite[:tiers_h].sum()) / dedans if dedans else 0.0
    masse_de_gauche = float(boite[:, :tiers_l].sum()) / dedans if dedans else 0.0

    return {
        "ratio": round(hauteur / largeur, 3),
        "hauteur": hauteur,
        "largeur": largeur,
        "occupation": round(hauteur / hauteur_totale, 3),
        # **La part de l'image que le sujet occupe vraiment.** `occupation` ne
        # mesure qu'une hauteur : un sujet grand et maigre la remplit sans
        # remplir l'image. C'est cette surface-ci que la phrase de cadre
        # déplace, et donc elle qui juge la phrase de cadre.
        "surface": round(float(masque.sum()) / (hauteur_totale * largeur_totale), 4),
        "masse_du_haut": round(masse_du_haut, 4),
        "masse_de_gauche": round(masse_de_gauche, 4),
        "decentrage": round(
            max(
                abs(centre_y - hauteur_totale / 2) / hauteur_totale,
                abs(centre_x - largeur_totale / 2) / largeur_totale,
            ),
            3,
        ),
        "couleurs_du_fond": int(couleurs_fond),
        "taches": int(detachees),
        "pas_de_grille": int(pas),
        "nettete_de_grille": round(float(nettete), 3),
        "couleurs": int(len(np.unique(pixels[masque] // 16, axis=0))) if masque.any() else 0,
    }


def _histogramme(fichier: Path) -> np.ndarray:
    with Image.open(fichier) as ouverte:
        pixels = np.asarray(ouverte.convert("RGB")).astype(np.int16)
    masque, _ = _masque(pixels)
    sujet = pixels[masque]
    if not len(sujet):
        return np.zeros(512)
    reduits = (sujet // 32).astype(np.int64)
    indices = reduits[:, 0] * 64 + reduits[:, 1] * 8 + reduits[:, 2]
    compte = np.bincount(indices, minlength=512).astype(np.float64)
    return compte / compte.sum()


def distance(a: Path, b: Path) -> float:
    """La distance entre deux images, sur leurs couleurs de sujet. Zéro = même
    palette et mêmes proportions de chaque teinte ; un = rien en commun."""
    return round(float(np.abs(_histogramme(a) - _histogramme(b)).sum() / 2), 3)


# ─────────────────────────────────────────────────────────────────────────────
# Payer
# ─────────────────────────────────────────────────────────────────────────────


async def _un_appel(
    atelier: Atelier, cellule: Cellule, jet: int, dossier: Path | None = None
) -> tuple[str, float, str]:
    """Un appel par le vrai chemin, et l'identifiant de l'image qui en sort.

    **Une chose visée sans case visée est refusée par le produit**, et c'est une
    règle juste (US-120) : une image qui ne sait pas dans quelle case aller n'a
    pas de case. L'artwork de référence part donc en **sujet libre**, comme une
    carte de la toile — c'est aussi ce que l'auteur fait dans la vraie vie.
    """
    ou = dossier or IMAGES
    fichier = ou / f"{cellule.clef}-{jet}.png"
    if fichier.exists():
        return "déjà là", 0.0, ""
    demande = Demande(
        prompt=cellule.sujet,
        proportions="1:1",
        variations=1,
        options=OPTIONS,
    )
    generation = await atelier.generations.soumettre(
        MODELE,
        demande,
        projet=cellule.projet,
        personnage=cellule.personnage if cellule.pose else None,
        pose=cellule.pose,
        direction=cellule.direction,
    )
    finie = await atelier.generations.attendre(generation.identifiant, 300)
    if finie is None or not finie.reussies:
        raison = ""
        if finie is not None and finie.emplacements:
            raison = str(finie.emplacements[0].raison or "")
        return f"ÉCHEC — {raison[:120]}", 0.0, ""
    assets = atelier.base.assets(projet=cellule.projet, limite=600)
    mien = next((a for a in assets if a.generation == finie.identifiant), None)
    if mien is None:
        return "ÉCHEC — aucun asset", finie.cout_usd, ""
    ou.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(atelier.fichiers.racine / mien.brut, fichier)
    return (
        f"{mien.largeur}x{mien.hauteur} · {finie.cout_usd:.4f} $",
        finie.cout_usd,
        mien.identifiant,
    )


async def payer(atelier: Atelier, repères: dict[str, dict[str, str]]) -> None:
    total = 0.0
    liste = cellules(repères)

    # **Les artworks d'abord, et ils se promeuvent** : les poses qui suivent
    # partiront avec eux, comme dans la vraie vie. Séquentiel exprès — la suite
    # en dépend.
    for cellule in [c for c in liste if c.clef.endswith(".artwork")]:
        dit, cout, asset = await _un_appel(atelier, cellule, 1)
        total += cout
        print(f"  {cellule.clef:56} {dit}")
        if asset:
            atelier.production.promouvoir_reference(
                cellule.projet, cellule.personnage, asset
            )

    for cellule in [c for c in liste if not c.clef.endswith(".artwork")]:
        for jet in range(1, cellule.jets + 1):
            dit, cout, _ = await _un_appel(atelier, cellule, jet)
            total += cout
            print(f"  {cellule.clef:56} jet {jet}  {dit}")

    # **La variance** : dix fois exactement le même appel. C'est le seul moyen de
    # savoir si un écart entre deux cellules est un effet ou du bruit.
    sel = repères["sel"]
    variance = Cellule(
        clef="variance.porteuse.repos",
        jeu="sel",
        projet=sel["__projet__"],
        personnage=sel["la porteuse d'eau"],
        sujet=SEL.choses[0].description,
        pose="repos",
        direction=None,
        jets=VARIANCE,
    )
    for jet in range(1, VARIANCE + 1):
        dit, cout, _ = await _un_appel(atelier, variance, jet)
        total += cout
        print(f"  {variance.clef:56} jet {jet}  {dit}")

    # **La langue**, sur le jeu de sel. On bascule la bible, on demande la même
    # chose, on remet. Trois tirages de chaque côté.
    projet = sel["__projet__"]
    porteuse = sel["la porteuse d'eau"]
    for etiquette, bible in (("fr", BIBLE_FRANCAISE), ("en", BIBLE_ANGLAISE)):
        atelier.univers.regler_univers(
            projet,
            bible=[{"nom": n, "texte": t, "actif": True} for n, t in bible.items()],
        )
        cellule = Cellule(
            clef=f"langue.{etiquette}",
            jeu="sel",
            projet=projet,
            personnage=porteuse,
            sujet=SEL.choses[0].description,
            pose="repos",
            direction=None,
            jets=3,
        )
        for jet in (1, 2, 3):
            dit, cout, _ = await _un_appel(atelier, cellule, jet)
            total += cout
            print(f"  {cellule.clef:56} jet {jet}  {dit}")
    atelier.univers.regler_univers(
        projet,
        bible=[{"nom": n, "texte": t, "actif": True} for n, t in SEL.bible.items()],
    )

    print(f"\nnote : {total:.3f} $")


# ─────────────────────────────────────────────────────────────────────────────
# Montrer, vérifier, mesurer
# ─────────────────────────────────────────────────────────────────────────────


def montrer(atelier: Atelier, repères: dict[str, dict[str, str]]) -> None:
    liste = cellules(repères)
    print(f"{len(liste)} cellules · {sum(c.jets for c in liste)} appels")
    for jeu in JEUX:
        siennes = repères[jeu.repere]
        chose = jeu.choses[0]
        vu = atelier.envoi.envoi(
            projet=siennes["__projet__"],
            modele=MODELE,
            sujet=chose.description,
            personnage=siennes[chose.nom],
            pose="repos",
        )
        print("\n" + "─" * 78)
        print(f"{jeu.nom} — « {chose.nom} », pose repos")
        print("─" * 78)
        for ligne in vu["texte"].splitlines():
            print(textwrap.fill(ligne, 76) if ligne else "")


def verifier(atelier: Atelier, repères: dict[str, dict[str, str]]) -> int:
    manques: list[str] = []
    liste = cellules(repères)
    appels = sum(c.jets for c in liste) + VARIANCE + 6
    for jeu in JEUX:
        siennes = repères[jeu.repere]
        for chose in jeu.choses:
            vu = atelier.envoi.envoi(
                projet=siennes["__projet__"],
                modele=MODELE,
                sujet=chose.description,
                personnage=siennes[chose.nom],
                pose=chose.poses[0],
            )
            texte = vu["texte"]
            if "CAMERA —" not in texte:
                manques.append(f"{jeu.repere}/{chose.nom} : pas de bloc caméra")
            # **Les faces partent pour tout, l'exemple humain pour les corps.**
            # C'est la correction du 1ᵉʳ septembre : un coffre a besoin de savoir
            # quelles faces on voit, il n'a pas besoin qu'on lui parle de tête.
            if "You see" not in texte and "You are looking" not in texte:
                manques.append(f"{jeu.repere}/{chose.nom} : pas de phrase de faces")
            humain = "On a character" in texte
            attendu = chose.type in ("personnage", "créature")
            if humain != attendu:
                manques.append(
                    f"{jeu.repere}/{chose.nom} : exemple humain "
                    f"{'présent' if humain else 'absent'} alors qu'on attend "
                    f"{'un corps' if attendu else 'aucun corps'}"
                )
            if str(jeu.cible) not in texte:
                manques.append(f"{jeu.repere}/{chose.nom} : la taille n'est pas dite")
    # **Le prix unitaire est mesuré, pas deviné.** Il valait 0,012 $ par estimation
    # avant la première course ; les 96 appels enregistrés donnent 0,0069 à
    # 0,0078 $, médiane 0,0075. On annonce la fourchette haute pour ne jamais
    # surprendre l'auteur par le bas.
    print(f"appels prévus : {appels} · note attendue ≈ {appels * 0.0078:.2f} $")
    for manque in manques:
        print(f"  MANQUE — {manque}")
    if not manques:
        print("les seize prompts portent leur caméra, leur taille, et le bon corps")
    return 1 if manques else 0


def mesurer() -> None:
    """Les trois lots, pas seulement le premier. **Une image payée qui ne rend
    aucun chiffre n'a servi à rien** : elle ne peut ni confirmer ni contredire.
    Les deux lots de reprise étaient dans ce cas, et les conclusions qu'ils
    portaient ne vivaient que dans une conversation."""
    if not IMAGES.exists():
        print("aucune image — lancer --payer d'abord")
        return
    releves: dict[str, dict] = {}
    for dossier, prefixe in LOTS:
        if not dossier.exists():
            continue
        combien = 0
        for fichier in sorted(dossier.glob("*.png")):
            lu = relever(fichier)
            if lu:
                releves[prefixe + fichier.stem] = lu
                combien += 1
        print(f"  {dossier.name:18} {combien:3} images")
    MESURES.write_text(
        json.dumps(releves, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(releves)} images relevées → {MESURES.name}")



# **Le cadrage, en dernier — une hypothèse, pas une décision.** Le banc a montré
# trois fonds dégradés sur vingt-sept cellules, et des sujets qui n'occupent que
# 46 % de la hauteur de l'image alors que tout sera ensuite ramené à 64 px. Les
# deux se répareraient d'une phrase, à la place qui décide. Reste à savoir si
# elle travaille : on la mesure avant de l'écrire dans le produit.
CADRAGE_ESSAI = (
    "\n\nFRAMING — one single sprite and nothing else. The background is one "
    "single flat colour, exactly the same colour in every corner — no gradient, "
    "no vignette, no scenery, no ground. The subject is centred and fills most "
    "of the image. No text, no letters, no numbers, no logo, no frame, no border."
)


async def reprise(atelier: Atelier, repères: dict[str, dict[str, str]]) -> None:
    """Les cellules que le banc a mises en défaut, refaites avec les réparations.

    **Seules celles-là**, et dans le même atelier : ce qui change entre les deux
    dossiers d'images est le produit, pas le sujet ni le jeu. Plus un bras qui
    mesure la phrase de cadrage avant qu'elle entre — c'est la règle du dépôt, et
    elle vient d'être payée deux fois pour l'avoir suivie.
    """
    import base64
    import urllib.error
    import urllib.request

    sel = repères["sel"]
    neon = repères["neon"]
    total = 0.0

    aredire: list[Cellule] = [
        # La direction : les quatre, cette fois. Sud et nord seuls ne disaient
        # pas si le repère du cadre marche ou si les deux se ressemblent par
        # hasard.
        *[
            Cellule(
                clef=f"direction.{direction}",
                jeu="sel",
                projet=sel["__projet__"],
                personnage=sel["la porteuse d'eau"],
                sujet=SEL.choses[0].description,
                pose="marche",
                direction=direction,
                jets=3,
            )
            for direction in ("sud", "nord", "est", "ouest")
        ],
        # Le coffre, qui revenait de trois quarts faute de phrase de faces.
        *[
            Cellule(
                clef=f"coffre.{pose}",
                jeu="sel",
                projet=sel["__projet__"],
                personnage=sel["le coffre de caravane"],
                sujet=SEL.choses[3].description,
                pose=pose,
                direction=None,
                jets=3,
            )
            for pose in ("ferme", "ouvert")
        ],
        # La carte d'accès, qui revenait avec une main.
        Cellule(
            clef="carte.tenu",
            jeu="neon",
            projet=neon["__projet__"],
            personnage=neon["la carte d'accès"],
            sujet=NEON.choses[2].description,
            pose="tenu",
            direction=None,
            jets=3,
        ),
        # Le distributeur, à qui l'on faisait lever un couvercle.
        Cellule(
            clef="distributeur.ouvert",
            jeu="neon",
            projet=neon["__projet__"],
            personnage=neon["le distributeur"],
            sujet=NEON.choses[3].description,
            pose="ouvert",
            direction=None,
            jets=3,
        ),
    ]
    for cellule in aredire:
        for jet in range(1, cellule.jets + 1):
            dit, cout, _ = await _un_appel(atelier, cellule, jet, REPRISE)
            total += cout
            print(f"  {cellule.clef:32} jet {jet}  {dit}")

    # ── Le bras du cadrage : le même prompt, plus la phrase, rien d'autre ────
    gamine = neon["la gamine au capuchon"]
    vu = atelier.envoi.envoi(
        projet=neon["__projet__"],
        modele=MODELE,
        sujet=NEON.choses[0].description,
        personnage=gamine,
        pose="repos",
    )
    references = [
        (ATELIER / asset.brut).read_bytes()
        for asset in atelier.base.assets_du_personnage(gamine)
        if asset.identifiant
        in atelier.production.references_promues(neon["__projet__"], gamine)
    ]
    cle = lire_cle()
    hors_registre = (0, 0.0)  # ce que l'atelier du banc ne verra pas passer
    for etiquette, texte in (
        ("cadrage.sans", vu["texte"]),
        ("cadrage.avec", vu["texte"] + CADRAGE_ESSAI),
    ):
        for jet in (1, 2, 3):
            fichier = REPRISE / f"{etiquette}-{jet}.png"
            if fichier.exists():
                print(f"  {etiquette:32} jet {jet}  déjà là")
                continue
            corps = {
                "model": "openai/gpt-image-2",
                "prompt": texte,
                "aspect_ratio": "1:1",
                **OPTIONS,
            }
            if references:
                corps["input_references"] = [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,"
                            + base64.b64encode(octets).decode("ascii")
                        },
                    }
                    for octets in references
                ]
            requete = urllib.request.Request(
                "https://openrouter.ai/api/v1/images",
                data=json.dumps(corps).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {cle}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(requete, timeout=300) as reponse:
                    resultat = json.loads(reponse.read().decode("utf-8"))
            except urllib.error.HTTPError as erreur:
                print(f"  {etiquette:32} jet {jet}  ÉCHEC {erreur.code}")
                continue
            donnees = resultat.get("data") or []
            if not donnees or not donnees[0].get("b64_json"):
                print(f"  {etiquette:32} jet {jet}  aucune image")
                continue
            REPRISE.mkdir(parents=True, exist_ok=True)
            fichier.write_bytes(base64.b64decode(donnees[0]["b64_json"]))
            cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
            total += cout
            hors_registre = (hors_registre[0] + 1, hors_registre[1] + cout)
            print(f"  {etiquette:32} jet {jet}  {cout:.4f} $")

    if hors_registre[0]:
        _noter("cadrage", *hors_registre)
    print(f"\nnote de la reprise : {total:.3f} $")


async def bras_direction(atelier: Atelier, repères: dict[str, dict[str, str]]) -> None:
    """La direction, troisième tentative — **et deux hypothèses, pas une**.

    Le banc a montré que la direction n'arrive pas dans un jeu vu de dessus :
    *marche vers le sud* et *marche vers le nord* rendent la même image. Deux
    réparations ont été essayées, deux échecs :

      1. la reformuler du repère du spectateur vers le repère du cadre — *vers le
         bas de l'image* au lieu de *vers le spectateur*. Les quatre directions
         se ressemblent toujours.

    Restent deux hypothèses, et elles ne se départagent pas au raisonnement :

      · **la place** — la consigne d'angle est au milieu du prompt, dans la ligne
        du sujet, alors que la caméra le ferme. Le premier banc a montré que la
        fin décide ; peut-être que la direction en souffre pour la même raison.
      · **les mots** — « facing north » demande une orientation dans le monde,
        alors qu'une image demande une orientation dans le **plan de l'image**.
        Peut-être qu'il faut dire la rotation, pas le point cardinal.

    Deux bras, deux directions opposées, trois tirages : douze images, ~0,10 $.
    """
    import base64
    import urllib.error
    import urllib.request

    sel = repères["sel"]
    porteuse = sel["la porteuse d'eau"]
    dossier = DIRECTION
    dossier.mkdir(parents=True, exist_ok=True)
    cle = lire_cle()
    references = [
        (ATELIER / asset.brut).read_bytes()
        for asset in atelier.base.assets_du_personnage(porteuse)
        if asset.identifiant
        in atelier.production.references_promues(sel["__projet__"], porteuse)
    ]

    # **La place** : la consigne d'angle telle qu'elle est, mais en queue.
    EN_QUEUE = {
        "sud": "\n\nORIENTATION — the subject is facing south, toward the bottom "
        "of the image.",
        "nord": "\n\nORIENTATION — the subject is facing north, toward the top "
        "of the image.",
    }
    # **Les mots** : la rotation dans le plan de l'image, décrite par ce qu'on voit.
    ROTATION = {
        "sud": "\n\nORIENTATION — seen from straight above, the character is "
        "turned so that it walks toward the BOTTOM edge of the picture. Its face "
        "and the front of its body point at the bottom edge; its back is the side "
        "nearest the top edge.",
        "nord": "\n\nORIENTATION — seen from straight above, the character is "
        "turned so that it walks toward the TOP edge of the picture. Its face and "
        "the front of its body point at the top edge; you are looking at its "
        "back, which is the side nearest the bottom edge.",
    }

    total = 0.0
    appels = 0
    for etiquette, table in (("place", EN_QUEUE), ("rotation", ROTATION)):
        for direction, queue in table.items():
            vu = atelier.envoi.envoi(
                projet=sel["__projet__"],
                modele=MODELE,
                sujet=SEL.choses[0].description,
                personnage=porteuse,
                pose="marche",
                direction=direction,
            )
            for jet in (1, 2, 3):
                fichier = dossier / f"{etiquette}.{direction}-{jet}.png"
                if fichier.exists():
                    print(f"  {etiquette}.{direction} jet {jet}  déjà là")
                    continue
                corps = {
                    "model": "openai/gpt-image-2",
                    "prompt": vu["texte"] + queue,
                    "aspect_ratio": "1:1",
                    **OPTIONS,
                }
                if references:
                    corps["input_references"] = [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,"
                                + base64.b64encode(octets).decode("ascii")
                            },
                        }
                        for octets in references
                    ]
                requete = urllib.request.Request(
                    "https://openrouter.ai/api/v1/images",
                    data=json.dumps(corps).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {cle}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(requete, timeout=300) as reponse:
                        resultat = json.loads(reponse.read().decode("utf-8"))
                except urllib.error.HTTPError as erreur:
                    print(f"  {etiquette}.{direction} jet {jet}  ÉCHEC {erreur.code}")
                    continue
                donnees = resultat.get("data") or []
                if not donnees or not donnees[0].get("b64_json"):
                    print(f"  {etiquette}.{direction} jet {jet}  aucune image")
                    continue
                fichier.write_bytes(base64.b64decode(donnees[0]["b64_json"]))
                cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
                total += cout
                appels += 1
                print(f"  {etiquette}.{direction} jet {jet}  {cout:.4f} $")
    if appels:
        _noter("direction", appels, total)
    print(f"\nnote du bras direction : {total:.3f} $")


def _noter(bras: str, appels: int, cout: float) -> None:
    """Ce qu'un bras hors registre a coûté, écrit là où on pourra le relire."""
    notes = {}
    if NOTES.exists():
        notes = json.loads(NOTES.read_text(encoding="utf-8"))
    ancien = notes.get(bras, {"appels": 0, "cout_usd": 0.0})
    notes[bras] = {
        "appels": ancien["appels"] + appels,
        "cout_usd": round(ancien["cout_usd"] + cout, 4),
    }
    NOTES.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")


def _mediane(valeurs: list[float]) -> float:
    return round(float(np.median(valeurs)), 3) if valeurs else 0.0


def planches() -> None:
    """Des planches de contact, une par jeu — **pour l'œil, jamais pour un chiffre**.

    Les sept relevés se calculent sans regarder ; ces planches-ci servent à
    trouver ce qu'aucune mesure n'a pensé à chercher. C'est ce qui a manqué au
    banc précédent, et ce qui a fait découvrir la dague inventée.
    """
    from PIL import ImageDraw

    repères = json.loads((SORTIE / "reperes.json").read_text(encoding="utf-8"))
    cote, marge = 260, 26
    for jeu in JEUX:
        siennes = repères[jeu.repere]
        lignes: list[tuple[str, list[Path]]] = []
        for chose in jeu.choses:
            identifiant = siennes.get(chose.nom)
            if not identifiant:
                continue
            fichiers = [IMAGES / f"{jeu.repere}.{identifiant}.artwork-1.png"]
            for pose in chose.poses:
                for jet in (1, 2, 3):
                    fichiers.append(
                        IMAGES / f"{jeu.repere}.{identifiant}.{pose}-{jet}.png"
                    )
            lignes.append((f"{chose.nom} — {chose.type}", [f for f in fichiers if f.exists()]))
        if not lignes:
            continue
        colonnes = max(len(f) for _, f in lignes)
        planche = Image.new(
            "RGB", (cote * colonnes, (cote + marge) * len(lignes)), (248, 248, 248)
        )
        trace = ImageDraw.Draw(planche)
        for rang, (titre, fichiers) in enumerate(lignes):
            y = rang * (cote + marge)
            trace.rectangle((0, y, cote * colonnes, y + marge), fill=(28, 28, 30))
            trace.text((8, y + 8), titre, fill=(255, 255, 255))
            for colonne, fichier in enumerate(fichiers):
                with Image.open(fichier) as ouverte:
                    vignette = ouverte.convert("RGB").resize(
                        (cote, cote), Image.LANCZOS
                    )
                planche.paste(vignette, (colonne * cote, y + marge))
        chemin = SORTIE / f"planche-{jeu.repere}.png"
        planche.save(chemin)
        print(chemin)


def lire() -> None:
    """Les relevés, groupés comme on les juge. **Aucun appel, aucun œil.**"""
    if not MESURES.exists():
        print("aucun relevé — lancer --mesurer")
        return
    releves = json.loads(MESURES.read_text(encoding="utf-8"))
    par_cellule: dict[str, list[dict]] = {}
    for nom, lu in releves.items():
        cellule = nom.rsplit("-", 1)[0]
        par_cellule.setdefault(cellule, []).append(lu)

    attendus = {jeu.repere: jeu.attendu for jeu in JEUX}
    noms = {}
    for jeu in JEUX:
        for chose in jeu.choses:
            noms[chose.nom] = chose

    _lire_la_note(len(releves))

    print("\n── 1 · La vue tenue, cellule par cellule ─────────────────────────────")
    # **La fourchette fixe était une faute de ce banc, pas du produit** (relevé
    # du 1ᵉʳ septembre 2026). On la gardait par vue — « de profil, entre 1,3 et
    # 2,6 » — et elle a marqué douze cellules en défaut dont **aucune** ne l'était :
    # un drone est plus large que haut, un lézard vu d'aplomb est plus long que
    # large, une carte d'accès aussi. Le rapport hauteur/largeur ne dit rien de la
    # vue tant qu'on ne sait pas ce que le sujet mesure.
    #
    # **Le sujet porte son propre étalon** : son artwork de référence est la même
    # chose sous la même caméra. Une pose qui s'en écarte franchement a changé de
    # caméra ou a poussé un membre hors de la boîte ; une pose qui s'en approche
    # tient la vue. Le seuil est le bruit mesuré au tour précédent — deux tirages
    # du même appel diffèrent de ±0,06 — élargi à 0,45 pour laisser passer un
    # bras tendu, qui élargit la boîte sans changer la caméra.
    print(f"{'cellule':44} {'h/l':>6} {'artwork':>8} {'écart':>7}   verdict")
    hors = 0
    for cellule in sorted(par_cellule):
        if cellule.startswith(("variance", "langue", "reprise.", "bras.")):
            continue
        morceaux = cellule.split(".")
        if len(morceaux) < 3 or morceaux[-1] == "artwork":
            continue
        etalon = par_cellule.get(f"{morceaux[0]}.{morceaux[1]}.artwork")
        mediane = _mediane([l["ratio"] for l in par_cellule[cellule]])
        if not etalon:
            print(f"{cellule[:44]:44} {mediane:>6.2f} {'—':>8} {'—':>7}   (sans étalon)")
            continue
        base = _mediane([l["ratio"] for l in etalon])
        ecart = abs(mediane - base) / base if base else 0.0
        dedans = ecart <= 0.45
        hors += 0 if dedans else 1
        print(
            f"{cellule[:44]:44} {mediane:>6.2f} {base:>8.2f} {ecart:>6.0%}   "
            f"{'ok' if dedans else 'ÉCART'}"
        )
    print(f"\n  {hors} cellule(s) s'écartent franchement de leur propre artwork")

    print("\n── 2 · Ce que l'image doit être, et ne l'est pas toujours ────────────")
    print(f"{'cellule':46} {'taches':>7} {'fond':>6} {'décentr':>8} {'pas':>5} {'coul':>6}")
    for cellule in sorted(par_cellule):
        if cellule.startswith(("reprise.", "bras.")):
            continue  # les deux lots de reprise ont leurs sections, §6 et §7
        lus = par_cellule[cellule]
        print(
            f"{cellule[:46]:46} "
            f"{_mediane([l['taches'] for l in lus]):>7.1f} "
            f"{_mediane([l['couleurs_du_fond'] for l in lus]):>6.1f} "
            f"{_mediane([l['decentrage'] for l in lus]):>8.3f} "
            f"{_mediane([l['pas_de_grille'] for l in lus]):>5.0f} "
            f"{_mediane([l['couleurs'] for l in lus]):>6.0f}"
        )

    print("\n── 3 · La constance d'une chose, d'une pose à l'autre ────────────────")
    for jeu in JEUX:
        siennes = json.loads((SORTIE / "reperes.json").read_text(encoding="utf-8"))[
            jeu.repere
        ]
        for chose in jeu.choses:
            identifiant = siennes.get(chose.nom)
            if not identifiant:
                continue
            fichiers = [
                IMAGES / f"{jeu.repere}.{identifiant}.{pose}-1.png"
                for pose in chose.poses
            ]
            presents = [f for f in fichiers if f.exists()]
            if len(presents) < 2:
                continue
            paires = [
                distance(presents[i], presents[j])
                for i in range(len(presents))
                for j in range(i + 1, len(presents))
            ]
            print(
                f"  {jeu.repere} · {chose.nom:26} "
                f"distance médiane entre poses : {_mediane(paires):.3f}"
            )

    print("\n── 4 · Dix fois le même appel — ce qui est du bruit ──────────────────")
    lus = par_cellule.get("variance.porteuse.repos", [])
    if lus:
        for champ in ("ratio", "occupation", "couleurs", "taches"):
            valeurs = [l[champ] for l in lus]
            print(
                f"  {champ:14} médiane {np.median(valeurs):.3f} · "
                f"de {min(valeurs):.3f} à {max(valeurs):.3f} · "
                f"écart-type {np.std(valeurs):.3f}"
            )
        fichiers = sorted(IMAGES.glob("variance.porteuse.repos-*.png"))
        if len(fichiers) > 1:
            paires = [
                distance(fichiers[i], fichiers[j])
                for i in range(len(fichiers))
                for j in range(i + 1, len(fichiers))
            ]
            print(f"  {'distance':14} médiane {_mediane(paires):.3f} entre deux tirages")

    print("\n── 5 · La langue de la bible ─────────────────────────────────────────")
    for etiquette in ("fr", "en"):
        lus = par_cellule.get(f"langue.{etiquette}", [])
        if not lus:
            continue
        print(
            f"  {etiquette}  h/l {_mediane([l['ratio'] for l in lus]):.2f} · "
            f"couleurs {_mediane([l['couleurs'] for l in lus]):.0f} · "
            f"taches {_mediane([l['taches'] for l in lus]):.1f} · "
            f"fond {_mediane([l['couleurs_du_fond'] for l in lus]):.1f}"
        )

    _bruit = _plancher_de_bruit(par_cellule)
    _lire_la_reprise(par_cellule, _bruit)
    _lire_la_direction(par_cellule, _bruit)


def _lire_la_note(images: int) -> None:
    """**Ce que le banc a coûté, sourcé.** Les appels passés par le produit sont
    dans l'atelier du banc ; les deux bras qui écrivent leur propre queue de
    prompt sont dans `notes_deux_jeux.json`. Un prix qu'on doit reconstruire de
    tête n'est pas un prix mesuré — cette ligne existe pour qu'on n'ait plus à le
    faire."""
    import sqlite3

    print("\n── 0 · Ce que ce banc a coûté ────────────────────────────────────────")
    base = ATELIER / "atelier.sqlite3"
    enregistres, note = 0, 0.0
    if base.exists():
        with sqlite3.connect(base) as lien:
            enregistres, note = lien.execute(
                "select count(*), coalesce(sum(cout_usd), 0) from generations"
            ).fetchone()
        print(f"  par le produit   {enregistres:4} appels   {note:.4f} $")
    hors, cout_hors = 0, 0.0
    if NOTES.exists():
        for bras, lu in json.loads(NOTES.read_text(encoding="utf-8")).items():
            hors += lu["appels"]
            cout_hors += lu["cout_usd"]
            print(f"  bras « {bras} »{'':4} {lu['appels']:4} appels   {lu['cout_usd']:.4f} $")
    else:
        print(
            "  bras hors registre  —  le lot du 1ᵉʳ septembre 2026 est parti avant que\n"
            "  le banc ne note ces deux bras. 18 appels, au prix unitaire mesuré ce\n"
            "  jour-là (0,0069 à 0,0078 $), soit 0,12 à 0,14 $ — reconstruit, pas mesuré."
        )
    if enregistres or hors:
        print(f"  {'total sourcé':17} {enregistres + hors:4} appels   {note + cout_hors:.4f} $")
    print(f"  {images} images relevées sur le disque")


def _plancher_de_bruit(par_cellule: dict[str, list[dict]]) -> dict[str, float]:
    """**Ce en dessous de quoi rien ne se conclut.** Dix appels rigoureusement
    identiques ; l'écart-type de chaque relevé sur ces dix-là est le plancher.
    Un bras qui bouge moins que ça n'a rien bougé du tout — et c'est exactement
    ce qui arrive à la direction."""
    lus = par_cellule.get("variance.porteuse.repos", [])
    if not lus:
        return {}
    return {
        champ: float(np.std([l[champ] for l in lus if champ in l]))
        for champ in ("ratio", "surface", "masse_du_haut", "masse_de_gauche")
        if any(champ in l for l in lus)
    }


def _lire_la_reprise(par_cellule: dict[str, list[dict]], bruit: dict[str, float]) -> None:
    """§6 — les cellules repayées après réparation, chacune contre son avant.

    **Rien ici ne se lit sans la colonne du bruit.** Le lot d'avant et le lot
    d'après sont trois tirages chacun ; un écart plus petit que le plancher du §4
    ne prouve rien, même s'il va dans le bon sens."""
    print("\n── 6 · La reprise — ce qui a été repayé après réparation ─────────────")
    if not any(c.startswith("reprise.") for c in par_cellule):
        print("  aucune reprise relevée — lancer --reprise puis --mesurer")
        return

    # **Le cadrage.** Le seul bras de la reprise qui compare deux textes et rien
    # d'autre : même sujet, même vue, même modèle, une phrase de cadre en plus.
    # Ce qu'il juge est la **surface** — la part de l'image que le sujet occupe —
    # parce que tout sera ensuite ramené à 32 ou 64 px et qu'un sujet plus gros
    # traverse mieux le rééchantillonnage.
    sans = par_cellule.get("reprise.cadrage.sans", [])
    avec = par_cellule.get("reprise.cadrage.avec", [])
    if sans and avec:
        print("\n  la phrase de cadre en queue")
        print(f"  {'bras':10} {'surface':>9} {'hauteur':>9} {'fond':>7}  (3 tirages)")
        for etiquette, lus in (("sans", sans), ("avec", avec)):
            print(
                f"  {etiquette:10} "
                f"{_mediane([l['surface'] for l in lus]):>8.1%} "
                f"{_mediane([l['occupation'] for l in lus]):>8.1%} "
                f"{_mediane([l['couleurs_du_fond'] for l in lus]):>7.1f}"
            )
        a = _mediane([l["surface"] for l in sans])
        b = _mediane([l["surface"] for l in avec])
        plancher = bruit.get("surface", 0.0)
        gagne = (b - a) > 2 * plancher
        print(
            f"  → {b - a:+.1%} de surface ({(b / a - 1) if a else 0:+.0%} de pixels), "
            f"plancher de bruit ±{plancher:.1%} · "
            f"{'GAGNE' if gagne else 'dans le bruit'}"
        )
        # **La moitié refusée.** Le bras portait aussi « le fond est d'une seule
        # couleur plate » ; la colonne « fond » compte les couleurs franches de
        # l'anneau du bord, et elle monte au lieu de descendre. Demander un fond
        # plat le rend plus bruyant — cette moitié n'est pas partie au produit.
        if _mediane([l["couleurs_du_fond"] for l in avec]) > _mediane(
            [l["couleurs_du_fond"] for l in sans]
        ):
            print("  → mais le fond compte PLUS de couleurs : la moitié « fond plat » nuit")

    # **Les objets.** Ceux-là n'ont pas d'artwork qui leur serve d'étalon : leur
    # avant est leur propre cellule du premier lot. Le rapport hauteur/largeur
    # dit si la face avant s'est couchée ; le reste — une main qui disparaît, un
    # couvercle qui ne se lève plus — se juge sur `reprise-objets.png`, et le
    # banc le dit au lieu de fabriquer un chiffre pour ça.
    paires = (
        ("la carte d'accès, tenue", "neon.la-carte-d-acces.tenu", "reprise.carte.tenu"),
        ("le distributeur, ouvert", "neon.le-distributeur.ouvert", "reprise.distributeur.ouvert"),
        ("le coffre, ouvert", "sel.le-coffre-de-caravane.ouvert", "reprise.coffre.ouvert"),
        ("le coffre, fermé", "sel.le-coffre-de-caravane.ferme", "reprise.coffre.ferme"),
    )
    montrees = [(t, a, b) for t, a, b in paires if par_cellule.get(a) and par_cellule.get(b)]
    if montrees:
        print("\n  les objets réparés, en rapport hauteur/largeur")
        print(f"  {'cellule':26} {'avant':>7} {'après':>7} {'écart':>8}")
        for titre, avant, apres in montrees:
            a = _mediane([l["ratio"] for l in par_cellule[avant]])
            b = _mediane([l["ratio"] for l in par_cellule[apres]])
            print(f"  {titre:26} {a:>7.2f} {b:>7.2f} {b - a:>+8.2f}")
        print("  (la main, le couvercle : à l'œil sur reprise-objets.png — pas de chiffre)")


def _lire_la_direction(par_cellule: dict[str, list[dict]], bruit: dict[str, float]) -> None:
    """§7 — la direction, et c'est le résultat qui compte le plus.

    **La mesure est la masse du haut** : la part du sujet qui se tient dans le
    tiers haut de sa propre boîte. Vu d'aplomb, un personnage qui s'éloigne
    montre sa nuque et ses épaules — sa masse monte ; le même de face montre son
    visage et ses bras — elle descend. Si *vers le nord* et *vers le sud* rendent
    la même masse, l'orientation n'est pas arrivée.

    Quatre bras, dont **deux qui sont le même appel du produit payé deux
    fois** : ce sont ces deux-là qui donnent le vrai plancher, et qui
    disqualifient les deux autres."""
    print("\n── 7 · La direction — quatre bras, dont deux qui sont le même appel ──")
    plancher_h = bruit.get("masse_du_haut", 0.0)
    plancher_g = bruit.get("masse_de_gauche", 0.0)
    if not plancher_h:
        print("  pas de plancher de bruit — relancer --mesurer")
        return
    print(
        f"  sur dix appels identiques, une image à l'autre : "
        f"masse du haut ±{plancher_h:.1%} · masse de gauche ±{plancher_g:.1%}"
    )

    bras = (
        ("le produit, 2 directions", "sel.la-porteuse-d-eau.marche.{}", ("sud", "nord")),
        ("le produit, 4 directions", "reprise.direction.{}", ("sud", "nord")),
        ("repère du cadre, en queue", "bras.place.{}", ("sud", "nord")),
        ("rotation dans le plan", "bras.rotation.{}", ("sud", "nord")),
    )

    # **Le vrai plancher n'est pas celui d'une image, c'est celui d'un lot.**
    # Chaque case ci-dessous est la médiane de trois tirages, et une médiane de
    # trois bouge encore beaucoup. On tient la mesure : les deux premières lignes
    # sont **le même produit, la même pose, la même direction**, payées à deux
    # moments — leur écart est ce que coûte le simple fait de remesurer. Rien
    # au-dessous ne peut être attribué à une formulation.
    releve = {}
    for titre, gabarit, (un, autre) in bras:
        a, b = par_cellule.get(gabarit.format(un)), par_cellule.get(gabarit.format(autre))
        if a and b:
            releve[titre] = (
                _mediane([l["masse_du_haut"] for l in a]),
                _mediane([l["masse_du_haut"] for l in b]),
            )
    temoins = [releve.get("le produit, 2 directions"), releve.get("le produit, 4 directions")]
    plancher_lot = 0.0
    if all(temoins):
        plancher_lot = max(abs(temoins[0][i] - temoins[1][i]) for i in (0, 1))
        print(
            f"  le MÊME appel remesuré sur un autre lot : ±{plancher_lot:.1%} "
            "— c'est ce plancher-là qui juge"
        )

    seuil = max(2 * plancher_h, 2 * plancher_lot)
    print(f"\n  {'bras':30} {'sud':>7} {'nord':>7} {'écart':>8}   verdict (seuil {seuil:.1%})")
    for titre, _, _ in bras:
        if titre not in releve:
            continue
        ma, mb = releve[titre]
        ecart = abs(mb - ma)
        print(
            f"  {titre:30} {ma:>6.1%} {mb:>6.1%} {ecart:>+8.1%}   "
            f"{'au-dessus' if ecart > seuil else 'dans le bruit'}"
        )
    if all(temoins) and abs(temoins[0][1] - temoins[0][0]) > seuil >= abs(
        temoins[1][1] - temoins[1][0]
    ):
        print(
            "\n  → Les deux témoins sont LE MÊME appel, et ils ne disent pas la même\n"
            "    chose : l'un passe le seuil, l'autre non. Un effet qui ne se\n"
            "    reproduit pas d'un lot à l'autre n'est pas un effet."
        )

    # **Est et ouest, sur l'autre axe.** Le lot de reprise a payé les quatre
    # directions ; celles de gauche-droite se lisent sur la masse de gauche, et
    # elles sont la seule chance qui restait — un axe horizontal est plus facile
    # à dessiner qu'un demi-tour.
    est = par_cellule.get("reprise.direction.est")
    ouest = par_cellule.get("reprise.direction.ouest")
    if est and ouest:
        me = _mediane([l["masse_de_gauche"] for l in est])
        mo = _mediane([l["masse_de_gauche"] for l in ouest])
        arrive = abs(mo - me) > 2 * plancher_g
        print(f"\n  {'est / ouest, masse de gauche':30} {me:>6.1%} {mo:>6.1%} "
              f"{abs(mo - me):>+8.1%}   {'ARRIVE' if arrive else 'dans le bruit'}")

    print(
        "\n  Un bras « dans le bruit » n'a pas tourné le sujet. Un bras qui bouge\n"
        "  les DEUX directions du même côté a bougé le cadrage, pas l'orientation :\n"
        "  regarder bras-direction.png avant de conclure qu'il marche."
    )


def principal() -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--verifier", action="store_true")
    parseur.add_argument("--payer", action="store_true")
    parseur.add_argument("--mesurer", action="store_true")
    parseur.add_argument("--lire", action="store_true")
    parseur.add_argument("--planches", action="store_true")
    parseur.add_argument("--reprise", action="store_true")
    parseur.add_argument("--direction", action="store_true")
    arguments = parseur.parse_args()

    if arguments.mesurer:
        mesurer()
        return 0
    if arguments.lire:
        lire()
        return 0
    if arguments.planches:
        planches()
        return 0
    neuf = not ATELIER.exists()
    atelier = Atelier(ATELIER)
    asyncio.run(atelier.ouvrir())
    carte = SORTIE / "reperes.json"
    if neuf or not carte.exists():
        repères = monter(atelier)
        carte.parent.mkdir(parents=True, exist_ok=True)
        carte.write_text(json.dumps(repères, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        repères = json.loads(carte.read_text(encoding="utf-8"))

    if arguments.reprise:
        asyncio.run(reprise(atelier, repères))
        return 0
    if arguments.direction:
        asyncio.run(bras_direction(atelier, repères))
        return 0
    if arguments.verifier:
        return verifier(atelier, repères)
    if arguments.payer:
        if verifier(atelier, repères):
            print("\nrien n'est parti.")
            return 1
        asyncio.run(payer(atelier, repères))
        mesurer()
        return 0
    montrer(atelier, repères)
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
