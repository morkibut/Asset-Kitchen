# -*- coding: utf-8 -*-
"""La silhouette en édition — ce qui survit à « ajoute la pièce, ne touche à rien ».

**C'est l'essai qui décide de C3, et il décide aussi de la V2 tout entière.** La
méthode retenue le 28 août 2026 fabrique un calque d'équipement **par différence
seule, sans aucune ancre** : on envoie le corps, on demande la pièce, et ce qui
est apparu *est* le calque. Si le modèle repeint le corps en même temps qu'il
ajoute la pièce, la différence n'est plus la pièce — c'est la pièce plus un
fantôme du corps —, et il n'y a plus rien à empiler sur une autre pose.

Ce que le dépôt sait déjà, et ce qu'il ne sait pas :

  · `ARCHITECTURE.md` §11 lève l'identité — `gemini-3.1-flash-image` tient le
    **personnage** d'une pose à l'autre. C'est une autre question : tenir un
    personnage reconnaissable, ce n'est pas rendre la **même silhouette au pixel**.
  · Le chiffre de 99–100 % vient du document sur SpriteCook, mesuré chez eux.
    **Aucune mesure de ce dépôt ne porte là-dessus.**

Quatre questions, dans cet ordre — les deux dernières sont celles qui tranchent :

1. **Le sujet revient-il à la même échelle et à la même place ?** §11 dit que
   l'échelle dérive ; on veut savoir de combien, parce que c'est la correction
   que le produit devra appliquer avant même de différencier.
2. **Combien de la silhouette de départ est encore là ?** Recouvrement du corps
   par le résultat, au meilleur recalage. C'est le « 99–100 % » à retrouver.
3. **Le corps a-t-il été repeint ?** Part des pixels du corps dont la couleur a
   bougé. **C'est la mesure qui tue la méthode si elle est haute** : un modèle
   peut rendre 100 % de silhouette et avoir tout redessiné dedans.
4. **La différence est-elle un objet, ou une poussière ?** Une pièce ajoutée fait
   une tache compacte, au bon endroit. Un repeint fait un semis sur tout le corps.

Le corps de départ est `essais/guide/02_nain.png` — le même nain pour tous les
modèles, sinon on comparerait des corps et non des modèles. Trois pièces, trois
zones franches : le casque en haut, la cape derrière, les jambières en bas.

    py essais/essai_silhouette.py                 # ce qui est sur le disque, gratuit
    py essais/essai_silhouette.py --etalonner     # vérifie les mesures, gratuit
    py essais/essai_silhouette.py --verifier      # tout prouver avant de payer, gratuit
    py essais/essai_silhouette.py --payer         # les appels, ~1,5 $

**`--verifier` ne fait aucun appel payant et rend 1 dès qu'une preuve manque** :
le catalogue relu frais et non depuis le cache, les paramètres qui partent
vraiment contre ceux qu'on écarte en silence, le texte exact des trois prompts et
l'empreinte du corps envoyé en référence, la chaîne de mesure passée sur les 239
images du disque — JPEG de Seedream et planches multi-sprites comprises —, le
nain comparé à lui-même, la note chiffrée par modèle, et le solde du compte. Il
se lance après `--etalonner` et avant `--payer` ; il n'y a pas de seconde chance.

**Sans `--payer`, aucun appel n'est fait.** Le script mesure alors ce qui est
déjà sur le disque et se tait sur le reste. Une configuration déjà complète est
sautée même avec `--payer` : relancer ne repaie jamais.

**La passe payante ne mesure rien**, et c'est délibéré : elle télécharge et elle
écrit, image par image (`docs/PIEGES.md` — un lot payant écrit au fur et à
mesure). La mesure est une seconde passe, sur le disque, qu'un plantage peut
rejouer pour rien.

Sortie : `essais/mesures_silhouette.json`, `essais/planches/silhouette.png`, et
les images sous `essais/resultats/silhouette/`, non versionnées.
"""

from __future__ import annotations

import argparse
import io
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
from PIL import Image  # noqa: E402

import verifier as verification  # noqa: E402

from atelier.domaine.recette import BORD, Passe, Recette  # noqa: E402
from atelier.image import detourer, zones_opaques  # noqa: E402
from atelier.image.traitement import composantes  # noqa: E402
from essai_identite import (  # noqa: E402
    charger_catalogue,
    corps_requete,
    generer,
    lire_cle,
    options_retenues,
    refs_max,
)

CORPS = RACINE / "guide" / "02_nain.png"
SORTIE = RACINE / "resultats" / "silhouette"
MESURES = RACINE / "mesures_silhouette.json"
PLANCHES = RACINE / "planches"
JETS = (1, 2)
PARALLELE = 4

# ─────────────────────────────────────────────────────────────────────────────
# Ce qu'on compare
# ─────────────────────────────────────────────────────────────────────────────

# Les six qui ont une chance. Les quatre premiers pour une raison mesurée :
# `gpt-image-2` est le défaut du produit (§4 bis), `gemini-3.1-flash-image` est
# celui qui tient l'identité (§11). `low` **et** `medium` chez OpenAI parce que
# la question est justement de savoir si la qualité achète de la fidélité — si
# `low` suffit, la V2 coûte trois fois moins cher.
#
# Écartés d'office, et ils n'ont pas à repayer pour le prouver : `riverflow` et
# `flux2-klein-4b` recopient la référence au lieu de l'éditer (§4 bis, défaut
# rédhibitoire), `gpt-image-1-mini` rend une bouillie, `gemini-3-pro-image` coûte
# $0,136 pour 2/5 en chaînage.
CONFIGURATIONS = [
    ("gpt-image-2_low",       "openai/gpt-image-2",                  {"quality": "low"}),
    ("gpt-image-2_medium",    "openai/gpt-image-2",                  {"quality": "medium"}),
    ("gemini-3.1-flash",      "google/gemini-3.1-flash-image",       {}),
    ("gemini-3.1-flash-LITE", "google/gemini-3.1-flash-lite-image",  {}),
    ("seedream-5.0-lite",     "bytedance-seed/seedream-5-0-lite",    {}),
    ("qwen-image-3",          "qwen/qwen-image-3",                   {}),
]

COMMUN = {"aspect_ratio": "1:1"}

# ─────────────────────────────────────────────────────────────────────────────
# Les trois pièces
# ─────────────────────────────────────────────────────────────────────────────

# **Trois zones franches — et deux d'entre elles se disputent quand même avec ce
# que le nain porte déjà.** Il tient un marteau dans la main droite : demander
# une épée mettrait le modèle devant un choix, et on ne mesurerait plus l'ajout
# mais l'arbitrage. La même règle a été relue sur l'image le 28 août 2026, et
# elle n'y était pas tenue : le nain **porte déjà une coiffe de cuir**, et ses
# bottes montent jusqu'au genou. Un casque et des jambières demandés sans autre
# précision posaient donc exactement le choix qu'on voulait éviter — remplacer,
# ou superposer ?
#
# D'où le « par-dessus » explicite dans les deux descriptions concernées. Il ne
# change pas la question posée — ajoute la pièce, ne touche à rien —, il retire
# une liberté que le modèle aurait prise seul, et différemment d'un jet à
# l'autre. La cape n'a rien à recouvrir : elle reste telle quelle.
#
# `zone` est la part de la boîte du sujet où la pièce a le droit d'être, en
# fractions (gauche, haut, droite, bas). Elle sert à une seule chose : dire
# quelle part de la différence est tombée **ailleurs**. Le nain regarde à
# droite, donc « derrière » est à gauche.
PIECES = [
    ("casque",
     "a horned iron helmet on his head, worn over his leather cap",
     (0.00, 0.00, 1.00, 0.34)),
    ("cape",
     "a dark red cape hanging from his shoulders down his back",
     (0.00, 0.10, 0.62, 0.90)),
    ("jambieres",
     "iron greaves strapped over his boots and lower legs",
     (0.00, 0.62, 1.00, 1.00)),
]


def prompt_de(piece: str) -> str:
    """« Ajoute la pièce, ne touche à rien » — écrit aussi fermement que possible.

    Le prompt est volontairement redondant. Ce n'est pas de la superstition :
    `AGENTS.md` note que sans « one single sprite, one pose only » Gemini rend
    spontanément une planche, et sans `aspect_ratio` explicite il part en 16:9.
    Un modèle comble ce qu'on ne dit pas. Ici, tout ce qu'on ne dit pas
    explicitement « ne change pas » est une invitation à le changer — et chaque
    chose changée entre directement dans la mesure du corps repeint.

    La reprise finale ne répète que le **nom** de la pièce, pas la précision de
    superposition qui la suit : « Only a horned iron helmet on his head, worn
    over his leather cap is added » se lit mal, et une phrase qui se lit mal est
    une phrase qu'un modèle interprète.
    """
    court = piece.split(",")[0]
    return (
        f"Add to this exact character: {piece}. "
        "Change absolutely nothing else. Keep the same character, the same pose, "
        "the same proportions, the same size, the same position in the frame, "
        "the same viewing angle, the same colors everywhere else, the same beard, "
        "the same green tunic, the same belt, the same boots, the same hammer, "
        "the same pixel art style, the same outline weight, the same background. "
        f"Only {court} is added. Nothing else moves, nothing else is redrawn. "
        "One single sprite, one pose only, on a plain flat light gray background."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Le cadre canonique — où les deux images deviennent comparables
# ─────────────────────────────────────────────────────────────────────────────

CANEVAS = 512      # côté du cadre où l'on recale
HAUTEUR = 256      # hauteur du sujet dans ce cadre, avant recherche d'échelle
CIBLE = 64         # hauteur du sujet pour la comparaison des couleurs
SEUIL_COULEUR = 32  # écart maximal par canal en deçà duquel un pixel n'a pas bougé

# Une pièce peut allonger le sujet — un casque à cornes ajoute de la hauteur —,
# donc le corps entre dans le résultat à une échelle **plus petite** que 1. La
# plage couvre une pièce qui ajoute jusqu'à la moitié de la hauteur, et un
# modèle qui aurait au contraire rogné.
ECHELLES = np.linspace(0.62, 1.18, 57)


def _rgba(octets: bytes) -> np.ndarray:
    """Le sujet détouré, tel que le produit le détourerait — remplissage depuis le bord.

    Le moteur par modèle n'est pas nécessaire ici et il serait même un défaut :
    ces images ont toutes un fond plat, `essai_detourage_modele.py` a mesuré que
    les deux moteurs s'y accordent, et le bord ne demande pas 180 Mo de réseau.
    """
    return detourer(Recette(passes=(Passe(moteur=BORD),)), octets)


def _boite(masque: np.ndarray) -> tuple[int, int, int, int] | None:
    lignes = np.flatnonzero(masque.any(axis=1))
    colonnes = np.flatnonzero(masque.any(axis=0))
    if lignes.size == 0 or colonnes.size == 0:
        return None
    return int(colonnes[0]), int(lignes[0]), int(colonnes[-1]) + 1, int(lignes[-1]) + 1


def _canoniser(rgba: np.ndarray) -> tuple[np.ndarray, float] | None:
    """Le sujet, découpé à sa boîte, ramené à `HAUTEUR`, posé au centre du cadre.

    Rend aussi la **part de l'image d'origine** que le sujet occupait en hauteur :
    c'est elle qui dit la dérive d'échelle brute, avant tout recalage — donc le
    travail que le produit devra faire de toute façon.
    """
    boite = _boite(rgba[:, :, 3] >= 128)
    if boite is None:
        return None
    gauche, haut, droite, bas = boite
    part = (bas - haut) / rgba.shape[0]

    decoupe = Image.fromarray(rgba[haut:bas, gauche:droite], "RGBA")
    large = max(1, round(decoupe.width * HAUTEUR / decoupe.height))
    # Plus proche voisin : on compare des pixels, pas des photos. Une
    # interpolation lisse inventerait des couleurs intermédiaires sur chaque
    # contour, et le corps « repeint » se mesurerait sur du flou.
    decoupe = decoupe.resize((large, HAUTEUR), Image.Resampling.NEAREST)

    cadre = Image.new("RGBA", (CANEVAS, CANEVAS), (0, 0, 0, 0))
    cadre.paste(decoupe, ((CANEVAS - large) // 2, (CANEVAS - HAUTEUR) // 2))
    return np.asarray(cadre), part


def _poser(canonique: np.ndarray, echelle: float, dy: int, dx: int) -> np.ndarray:
    """Le cadre canonique remis à l'échelle autour de son centre, puis décalé."""
    if echelle == 1.0 and dy == 0 and dx == 0:
        return canonique
    cote = max(1, round(CANEVAS * echelle))
    petit = Image.fromarray(canonique, "RGBA").resize((cote, cote), Image.Resampling.NEAREST)
    cadre = Image.new("RGBA", (CANEVAS, CANEVAS), (0, 0, 0, 0))
    origine = (CANEVAS - cote) // 2
    cadre.paste(petit, (origine + dx, origine + dy))
    return np.asarray(cadre)


def _recaler(corps: np.ndarray, edite: np.ndarray) -> tuple[float, int, int, float]:
    """L'échelle et le décalage qui font le mieux rentrer le corps dans le résultat.

    **On cherche le recouvrement, pas la ressemblance**, et c'est la seule
    formulation honnête de la question : « que reste-t-il de la silhouette de
    départ ? » se mesure par la part du corps qui est encore couverte, au
    meilleur placement possible. Prendre le placement naïf — même hauteur, même
    centre — compterait comme « silhouette perdue » un simple décalage de deux
    pixels, alors que le produit le corrige gratuitement au recadrage.

    Le décalage se cherche par corrélation croisée en Fourier : pour une échelle
    donnée, *tous* les décalages entiers sont évalués d'un coup. Une recherche
    par balayage devrait choisir un pas, et un pas de 4 px sur 512 raterait
    précisément le recalage fin qui distingue 99 % de 96 %.
    """
    masque_edite = np.fft.rfft2(edite[:, :, 3] >= 128)
    limite = CANEVAS // 4

    # Les décalages admissibles. La corrélation en Fourier est circulaire : les
    # grands indices sont des décalages négatifs, et tout ce qui dépasse la
    # limite est un repliage qui n'a aucun sens géométrique ici.
    indices = np.arange(CANEVAS)
    proches = (indices <= limite) | (indices >= CANEVAS - limite)
    admis = np.outer(proches, proches)

    meilleur = (1.0, 0, 0, 0.0)
    for echelle in ECHELLES:
        pose = _poser(corps, float(echelle), 0, 0)[:, :, 3] >= 128
        aire = int(pose.sum())
        if aire == 0:
            continue
        recouvrement = np.fft.irfft2(np.conj(np.fft.rfft2(pose)) * masque_edite, pose.shape)
        recouvrement = np.where(admis, recouvrement, -1.0)
        plat = int(np.argmax(recouvrement))
        dy, dx = divmod(plat, CANEVAS)
        part = float(recouvrement[dy, dx]) / aire
        if part > meilleur[3]:
            meilleur = (
                float(echelle),
                dy - CANEVAS if dy > limite else dy,
                dx - CANEVAS if dx > limite else dx,
                part,
            )
    return meilleur


def _reduire(rgba: np.ndarray) -> np.ndarray:
    """Le cadre ramené à la taille cible du projet, en moyennant.

    **Les couleurs se comparent là où le produit les regardera**, c'est-à-dire
    après la normalisation de grille — 64 px de sujet, la cible par défaut. À
    pleine résolution on mesurerait surtout le tremblement d'un contour d'un
    pixel, qui ne survit pas à la réduction et n'intéresse donc personne. La
    moyenne de surface est le bon filtre : elle fait exactement ce que la
    réduction du produit fera.
    """
    cote = round(CANEVAS * CIBLE / HAUTEUR)
    return np.asarray(
        Image.fromarray(rgba, "RGBA").resize((cote, cote), Image.Resampling.BOX)
    )


def _mesurer(corps_rgba: np.ndarray, edite_rgba: np.ndarray, zone: tuple) -> dict | None:
    canonique = _canoniser(corps_rgba)
    resultat = _canoniser(edite_rgba)
    if canonique is None or resultat is None:
        return None
    corps, part_corps = canonique
    edite, part_edite = resultat

    echelle, dy, dx, retrouvee = _recaler(corps, edite)
    aligne = _poser(corps, echelle, dy, dx)

    petit_corps, petit_edite = _reduire(aligne), _reduire(edite)
    m_corps = petit_corps[:, :, 3] >= 128
    m_edite = petit_edite[:, :, 3] >= 128
    aire_corps = int(m_corps.sum())
    if aire_corps == 0:
        return None

    # **Le contour ne compte pas dans la couleur.** Un pixel de bordure qui se
    # décale d'un cran n'est pas un repeint : c'est du recalage résiduel, et le
    # produit le corrige gratuitement. Sans cette érosion, l'étalonnage donne
    # 10 % de « repeint » sur un corps que personne n'a touché — un simple 1,08×
    # suffit —, et le plancher de bruit dépasserait alors le seuil qui décide.
    commun = _eroder(m_corps & m_edite)
    ecart = _ecart_tolerant(petit_corps[:, :, :3], petit_edite[:, :, :3], m_edite)
    touche = commun & (ecart > SEUIL_COULEUR)
    # L'ajout, lui, ne s'érode pas : c'est l'empreinte de la pièce, et elle se
    # mesure entière.
    ajout = m_edite & ~m_corps

    # **La différence, c'est le calque.** Ce que la V2 empilerait sur une autre
    # pose : ce qui est apparu, plus ce qui a changé de couleur.
    difference = ajout | touche
    aire_diff = int(difference.sum())

    if aire_diff:
        taches = composantes(difference)
        compacite = max(aire for _, aire in taches) / aire_diff
    else:
        compacite = 1.0

    # **C'est l'emplacement qui sépare la pièce du dégât, et rien d'autre.**
    # Premier réflexe écarté à l'étalonnage : prendre la plus grosse tache de la
    # différence pour « la pièce » et appeler dégât tout le reste. Un modèle qui
    # repeint le corps entier fait alors *une seule* tache, la mesure lui donne
    # 100 % de compacité et 0 % de dégât, et le pire cas passe pour le meilleur.
    # L'emplacement, lui, est connu d'avance — c'est une donnée du produit
    # (décision du 28 août : emplacement et pièce vivent sur le projet).
    dedans = _zone(m_corps, zone)
    dehors = ~dedans
    corps_dehors = int((commun & dehors).sum())

    return {
        "silhouette_retrouvee": round(retrouvee, 4),
        # Le corps repeint **hors de l'emplacement de la pièce**. La mesure qui
        # tue la méthode : un casque n'a aucune raison de changer les bottes.
        "repeint": round(float((touche & dehors).sum()) / max(1, corps_dehors), 4),
        # Le corps recouvert par la pièce, à l'intérieur de son emplacement. Ce
        # n'est pas un défaut — un casque cache le haut du crâne — mais il faut
        # le lire pour ne pas confondre les deux.
        "recouvert": round(float((touche & dedans).sum()) / aire_corps, 4),
        "ajout": round(float(ajout.sum()) / aire_corps, 4),
        "ajout_hors_zone": round(float((ajout & dehors).sum()) / aire_corps, 4),
        "compacite": round(float(compacite), 4),
        "echelle_brute": round(part_edite / part_corps, 4),
        "echelle_recalee": round(echelle, 4),
        "decalage_px": [int(dy), int(dx)],
    }


def _ecart_tolerant(corps: np.ndarray, edite: np.ndarray, opaque: np.ndarray) -> np.ndarray:
    """Le plus petit écart de couleur entre chaque pixel du corps et le voisinage 3×3 du résultat.

    À 64 px de sujet, un contour **intérieur** — la boucle d'un ceinturon, un
    brin de barbe — fait un pixel de large. Un résidu de recalage sous le pixel
    le déplace d'un cran, et une comparaison pixel à pixel le compte comme
    repeint : l'étalonnage donnait 7 % de repeint sur une image que personne
    n'avait repeinte, soit plus que le seuil censé décider.

    Accepter le voisin immédiat efface ce bruit **sans rien cacher** — un corps
    viré au bleu l'est aussi chez ses voisins, et il reste détecté à 91 %. C'est
    la différence entre mesurer le modèle et mesurer son propre rééchantillonnage.
    """
    meilleur = np.full(corps.shape[:2], 255, dtype=np.int16)
    corps = corps.astype(np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            voisin = np.roll(np.roll(edite, dy, axis=0), dx, axis=1).astype(np.int16)
            valide = np.roll(np.roll(opaque, dy, axis=0), dx, axis=1)
            ecart = np.abs(corps - voisin).max(axis=2)
            meilleur = np.minimum(meilleur, np.where(valide, ecart, 255))
    return meilleur


def _eroder(masque: np.ndarray, pixels: int = 1) -> np.ndarray:
    """Le masque moins sa bordure, en connexité 4."""
    for _ in range(pixels):
        ronge = masque.copy()
        ronge[1:] &= masque[:-1]
        ronge[:-1] &= masque[1:]
        ronge[:, 1:] &= masque[:, :-1]
        ronge[:, :-1] &= masque[:, 1:]
        masque = ronge
    return masque


def _zone(masque_corps: np.ndarray, zone: tuple) -> np.ndarray:
    """L'emplacement de la pièce, en pixels, déduit de la boîte du corps recalé.

    **Un bord qui touche la boîte s'ouvre jusqu'au cadre**, et ce n'est pas un
    détail : la pièce a le droit de dépasser du corps. Un casque à cornes monte
    au-dessus du crâne, une cape sort derrière l'épaule, des jambières
    débordent sous la semelle — or la boîte est celle du corps *avant* la pièce.
    Arrêter la zone au crâne comptait donc « tombé ailleurs » les trois quarts
    d'un casque correctement posé : `ajout_hors_zone` montait à 6,8 % sur le cas
    d'étalonnage « debordant », qui est pourtant le cas juste. La colonne disait
    l'inverse de ce qu'elle promet.

    Ouvrir seulement les bords qui **touchent déjà** la boîte garde tout son
    pouvoir de discrimination : le même casque reste massivement hors zone quand
    on le juge avec la zone de la cape ou celle des jambières.
    """
    dedans = np.zeros(masque_corps.shape, dtype=bool)
    boite = _boite(masque_corps)
    if boite is None:
        return dedans
    gauche, haut, droite, bas = boite
    large, hautr = droite - gauche, bas - haut
    cadre_h, cadre_l = masque_corps.shape
    dedans[
        (0 if zone[1] <= 0.0 else haut + int(zone[1] * hautr)):
        (cadre_h if zone[3] >= 1.0 else haut + int(np.ceil(zone[3] * hautr))),
        (0 if zone[0] <= 0.0 else gauche + int(zone[0] * large)):
        (cadre_l if zone[2] >= 1.0 else gauche + int(np.ceil(zone[2] * large))),
    ] = True
    return dedans


# ─────────────────────────────────────────────────────────────────────────────
# La passe payante — elle télécharge et elle écrit, elle ne mesure rien
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


def executer(cle: str, catalogue: dict, corps: bytes, jet: int,
             etiquette: str, identifiant: str, propres: dict) -> None:
    fiche = catalogue.get(identifiant)
    if fiche is None:
        with VERROU:
            print(f"jet{jet} · {etiquette:22} absent du catalogue — saute")
        return
    if refs_max(fiche) < 1:
        with VERROU:
            print(f"jet{jet} · {etiquette:22} n'accepte aucune référence — saute")
        return

    dossier = SORTIE / f"jet{jet}" / etiquette
    dossier.mkdir(parents=True, exist_ok=True)
    options, ecartees = options_retenues(fiche, {**COMMUN, **propres})

    journal = [f"jet{jet} · {etiquette:22} [{identifiant}]"
               + (f"   (ecarte : {', '.join(ecartees)})" if ecartees else "")]
    total = 0.0

    for nom, description, _ in PIECES:
        if _existe(dossier, nom):
            journal.append(f"        {nom:10} deja la — saute (aucun frais)")
            continue
        depart = time.monotonic()
        try:
            octets, cout = generer(cle, identifiant, prompt_de(description), corps, options)
        except Exception as erreur:  # noqa: BLE001 — un essai ne s'arrete jamais
            journal.append(f"        {nom:10} ECHEC — {erreur}")
            continue
        # Écrit tout de suite : un plantage plus loin dans la boucle ne doit pas
        # emporter une image déjà payée (`docs/PIEGES.md`).
        (dossier / f"{nom}.{_extension(octets)}").write_bytes(octets)
        total += cout
        journal.append(
            f"        {nom:10} {time.monotonic() - depart:5.1f}s  ${cout:.4f}"
        )

    journal.append(f"        ── {total:.4f} $")
    with VERROU:
        print("\n".join(journal), flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# L'étalonnage — vérifier la mesure avant de payer quoi que ce soit
# ─────────────────────────────────────────────────────────────────────────────

def _fabriquer(corps: bytes, cas: str) -> bytes:
    """Une fausse édition, dont on connaît d'avance la bonne réponse.

    Cinq cas, et ils ne sont pas décoratifs : ils vérifient que les mesures
    **discriminent**. Une mesure qui rendrait 100 % partout serait indiscernable
    d'un modèle parfait, et on l'apprendrait après avoir payé.
    """
    with Image.open(io.BytesIO(corps)) as ouverte:
        image = ouverte.convert("RGBA")
    dessin = np.asarray(image).copy()

    sujet = _rgba(corps)[:, :, 3] >= 128
    gauche, haut, droite, bas = _boite(sujet)
    hautr = bas - haut

    # La tête, cherchée et non devinée : les colonnes occupées dans le sixième
    # supérieur du sujet. Un casque posé au jugé déborderait à côté du crâne, et
    # l'étalonnage mesurerait alors mon erreur de placement.
    tete = sujet[haut : haut + hautr // 6]
    colonnes = np.flatnonzero(tete.any(axis=0))
    tg, td = int(colonnes[0]) - 6, int(colonnes[-1]) + 6

    if cas in ("couvrant", "debordant", "recadre", "repeint"):
        if cas == "couvrant":
            # Un casque qui **ne dépasse pas** : la barre est masquée par le
            # sujet, donc la boîte ne bouge pas et rien n'est ajouté.
            y0, y1 = haut + int(0.02 * hautr), haut + int(0.09 * hautr)
            barre = np.zeros(sujet.shape, dtype=bool)
            barre[y0:y1, tg:td] = True
            barre &= sujet
        else:
            # Un casque qui dépasse par le haut : la boîte du sujet grandit de
            # ~6 %, et le recalage naïf « même hauteur » devient faux. C'est
            # exactement ce que la recherche d'échelle est là pour rattraper.
            y0 = max(0, haut - int(0.06 * hautr))
            barre = np.zeros(sujet.shape, dtype=bool)
            barre[y0 : haut + int(0.06 * hautr), tg:td] = True
        dessin[barre] = (70, 74, 82, 255)

    if cas == "repeint":
        # Le corps entier vire au bleu de deux crans : invisible à l'œil sur une
        # vignette, mortel pour la méthode par différence.
        dessin[:, :, 2] = np.where(sujet, np.minimum(255, dessin[:, :, 2] + 40), dessin[:, :, 2])

    image = Image.fromarray(dessin, "RGBA")

    if cas == "recadre":
        # Rien n'a changé, mais tout a bougé : 8 % plus grand, remonté et
        # déporté. Le décalage est **borné pour ne rien couper** — un sujet
        # rogné par le cadre n'est plus le même sujet, et l'essai mesurerait
        # alors la découpe et non le modèle.
        facteur = 1.08
        cote = round(image.width * facteur)
        marge_h = min(40, int(haut * facteur), int((image.height - bas) * facteur))
        marge_l = min(40, int(gauche * facteur), int((image.width - droite) * facteur))
        glisse = Image.new("RGBA", image.size, (235, 235, 235, 255))
        glisse.paste(image.resize((cote, cote), Image.Resampling.NEAREST),
                     (-marge_l, -marge_h))
        image = glisse

    tampon = io.BytesIO()
    image.convert("RGB").save(tampon, format="PNG")
    return tampon.getvalue()


ETALONS = (
    ("vide", "rien ajouté", "silhouette 100 %, tout le reste à 0"),
    ("couvrant", "casque posé dans la silhouette", "repeint 0, ajout 0, recouvert > 0"),
    ("debordant", "casque qui dépasse du crâne", "repeint 0, ajout > 0"),
    ("recadre", "le même, puis 1,08× et déporté", "les mêmes chiffres que « debordant »"),
    ("repeint", "le même, et le corps viré au bleu", "repeint très haut — le seul"),
)


def etalonner(corps: bytes) -> int:
    zone = PIECES[0][2]
    corps_rgba = _rgba(corps)
    print("\nÉTALONNAGE — la mesure sur des cas dont on connaît la réponse\n")
    print(f"  {'cas':11} {'silhouette':>10} {'repeint':>8} {'recouvert':>10} "
          f"{'ajout':>7} {'h.zone':>7} {'échelle':>8}   attendu")
    for cas, description, attendu in ETALONS:
        mesure = _mesurer(corps_rgba, _rgba(_fabriquer(corps, cas)), zone)
        if mesure is None:
            print(f"  {cas:11} — sujet perdu")
            continue
        print(
            f"  {cas:11} {mesure['silhouette_retrouvee']:>9.1%} "
            f"{mesure['repeint']:>7.1%} {mesure['recouvert']:>9.1%} "
            f"{mesure['ajout']:>6.1%} {mesure['ajout_hors_zone']:>6.1%} "
            f"{mesure['echelle_recalee']:>8.3f}   {attendu}"
        )
        print(f"              ({description})")
    print(
        "\n  Ce que l'étalonnage doit prouver, et qui n'allait pas de soi :\n"
        "  · « recadre » doit donner les mêmes chiffres que « debordant » —\n"
        "    sinon la mesure compte comme dégât un simple recadrage, que le\n"
        "    produit corrige gratuitement ;\n"
        "  · « repeint » doit être le **seul** à faire monter la colonne\n"
        "    « repeint » — sinon la mesure ne sait pas distinguer une pièce\n"
        "    ajoutée d'un corps redessiné, et il ne faut pas payer.\n"
    )

    # **La zone se juge contre les deux autres, jamais seule.** Un « hors zone »
    # bas ne prouve rien s'il est bas partout : c'est en confrontant le même
    # casque aux trois emplacements qu'on voit si la colonne sait où tombe la
    # pièce. Sans cette table, la correction de `_zone` — ouvrir les bords qui
    # touchent la boîte — aurait pu passer pour une simple mise à zéro.
    print("  Le même casque, jugé avec les trois emplacements :\n")
    print(f"  {'emplacement':12} {'ajout':>7} {'hors zone':>10}   attendu")
    debordant = _rgba(_fabriquer(corps, "debordant"))
    hors: dict[str, float] = {}
    for nom, _, zone_piece in PIECES:
        mesure = _mesurer(corps_rgba, debordant, zone_piece)
        hors[nom] = mesure["ajout_hors_zone"] if mesure else 1.0
        attendu = ("presque tout dedans" if nom == "casque"
                   else "massivement dehors — ce n'est pas sa place")
        print(f"  {nom:12} {(mesure or {}).get('ajout', 0):>6.1%} "
              f"{hors[nom]:>9.1%}   {attendu}")
    marge = min(hors["cape"], hors["jambieres"]) - hors["casque"]
    print(
        f"\n  Écart entre le bon emplacement et le pire des deux autres : "
        f"{marge:+.1%}.\n"
        + ("  La colonne « hors zone » sait donc où la pièce est tombée.\n"
           if marge > 0.04 else
           "  **Trop faible.** La colonne « hors zone » ne discrimine pas, et\n"
           "  aucune lecture de placement ne tiendra sur ce lot.\n")
    )
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# La vérification — cinq preuves, aucun appel payant, et un code de sortie
# ─────────────────────────────────────────────────────────────────────────────

def _restants() -> list[tuple[str, int, int]]:
    """Ce qui manque vraiment sur le disque, configuration par configuration.

    La note ne porte que là-dessus : `executer()` saute ce qui est déjà là, donc
    compter le lot complet donnerait une note fausse dès la deuxième relance.
    Les 36 appels de cet essai portent **tous** une référence — c'est une
    édition, il n'y a pas d'appel sans corps de départ.
    """
    appels: list[tuple[str, int, int]] = []
    for etiquette, _, _ in CONFIGURATIONS:
        manquants = sum(
            1
            for jet in JETS
            for nom, _, _ in PIECES
            if _existe(SORTIE / f"jet{jet}" / etiquette, nom) is None
        )
        appels.append((etiquette, manquants, 0))
    return appels


def verifier(corps: bytes) -> int:
    verification.utf8()
    rapport = verification.Rapport(
        "la silhouette en édition — l'essai qui décide de C3"
    )

    # ── 1 ────────────────────────────────────────────────────────────────────
    section = rapport.section("Le catalogue, relu frais — et non depuis le cache")
    frais = verification.preuve_catalogue(section, CONFIGURATIONS)

    # ── 2 ────────────────────────────────────────────────────────────────────
    section = rapport.section("Ce qui part vraiment, et ce qui tombe en silence")
    if not frais:
        section.rouge("pas de catalogue frais — impossible de dire ce qui partira")
    else:
        verification.preuve_parametres(
            section, CONFIGURATIONS, COMMUN, frais,
            {etiquette: True for etiquette, _, _ in CONFIGURATIONS},
        )
        section.dit("\n  Et le corps POST tel que `generer()` le construira, "
                    "sur la pièce « casque » :")
        for etiquette, identifiant, propres in CONFIGURATIONS:
            fiche = frais.get(identifiant)
            if fiche is None:
                continue
            options, _ = options_retenues(fiche, {**COMMUN, **propres})
            section.dit(f"\n  {etiquette}")
            verification.preuve_corps(
                section,
                corps_requete(identifiant, prompt_de(PIECES[0][1]), corps, options),
                "casque",
            )

    # ── 3 ────────────────────────────────────────────────────────────────────
    section = rapport.section(
        "Le texte exact des trois prompts, et le corps envoyé en référence"
    )
    for nom, description, zone in PIECES:
        section.dit(f"\n  ── {nom}   emplacement (g, h, d, b) = {zone}")
        for ligne in textwrap.wrap(prompt_de(description), 72):
            section.dit(f"     {ligne}")
    section.vert(
        f"{len(PIECES)} prompts, identiques pour les {len(CONFIGURATIONS)} modèles "
        f"— seul le modèle change d'un appel à l'autre"
    )

    section.dit("\n  La référence, la même pour les 36 appels :")
    verification.preuve_reference(
        section, corps, "le corps de départ",
        str(CORPS.relative_to(RACINE.parent)),
    )
    section.dit(
        "\n  Ce que le prompt affirme du nain a été relu sur l'image le 28 août\n"
        "  2026, poignée par poignée : barbe tressée sombre, tunique verte,\n"
        "  ceinture, bottes, marteau, tourné vers la droite, fond gris clair uni.\n"
        "  Tout y est. Un « the same X » portant sur un X qui n'existe pas serait\n"
        "  une invitation à en inventer un.\n"
        "  La même lecture a trouvé ce que l'en-tête ne disait pas : il porte\n"
        "  **déjà une coiffe de cuir**, et ses bottes montent au genou. D'où le\n"
        "  « worn over his leather cap » et le « over his boots » : deux pièces\n"
        "  sur trois se posent sur quelque chose, et sans le dire c'est le modèle\n"
        "  qui aurait choisi, différemment d'un jet à l'autre."
    )

    # ── 4 ────────────────────────────────────────────────────────────────────
    section = rapport.section(
        "La chaîne de mesure, sur tout ce qui est déjà sur le disque"
    )
    corps_rgba = _rgba(corps)

    temoin = _mesurer(corps_rgba, corps_rgba, PIECES[0][2])
    if temoin is None:
        section.rouge("le nain comparé à lui-même perd son sujet — la mesure est cassée")
    else:
        section.dit(
            f"  le nain comparé à lui-même : silhouette "
            f"{temoin['silhouette_retrouvee']:.1%}, repeint {temoin['repeint']:.1%}, "
            f"ajout {temoin['ajout']:.1%}, échelle {temoin['echelle_recalee']:.3f}"
        )
        if temoin["silhouette_retrouvee"] >= 0.9999 and temoin["repeint"] <= 0.0001:
            section.vert(
                "le nain comparé à lui-même rend 100 % de silhouette et 0 % de "
                "repeint — le plancher de bruit de la mesure est nul"
            )
        else:
            section.rouge(
                f"le nain comparé à lui-même rend "
                f"{temoin['silhouette_retrouvee']:.1%} de silhouette et "
                f"{temoin['repeint']:.1%} de repeint au lieu de 100 % et 0 % — "
                f"la mesure a un plancher de bruit, et il mangerait le seuil de 5 %"
            )
    section.dit()

    def mesurer_une(octets: bytes, _chemin: Path) -> dict | None:
        rgba = _rgba(octets)
        mesure = _mesurer(corps_rgba, rgba, PIECES[0][2])
        if mesure is None:
            return None
        return {"mesure": mesure, "sujets": len(zones_opaques(rgba[:, :, 3]))}

    resultats = verification.preuve_corpus(section, mesurer_une, attendu=239)
    section.dit()
    verification.preuve_planches(section, resultats, lambda r: r["sujets"])

    # ── 5 ────────────────────────────────────────────────────────────────────
    section = rapport.section("La note, modèle par modèle")
    appels = _restants()
    note = verification.preuve_note(section, appels, annonce=1.50)

    # ── 6 ────────────────────────────────────────────────────────────────────
    section = rapport.section("La clé, le solde, le disque")
    verification.preuve_cle(section, note)
    verification.preuve_disque(section, [SORTIE, PLANCHES])

    return rapport.bilan("py essais/essai_silhouette.py")


# ─────────────────────────────────────────────────────────────────────────────
# La passe de mesure — sur le disque, gratuite, rejouable
# ─────────────────────────────────────────────────────────────────────────────

def mesurer_tout(corps: bytes) -> list[dict]:
    corps_rgba = _rgba(corps)
    lignes: list[dict] = []
    for jet in JETS:
        for etiquette, identifiant, _ in CONFIGURATIONS:
            dossier = SORTIE / f"jet{jet}" / etiquette
            if not dossier.is_dir():
                continue
            for nom, _, zone in PIECES:
                fichier = _existe(dossier, nom)
                if fichier is None:
                    continue
                mesure = _mesurer(corps_rgba, _rgba(fichier.read_bytes()), zone)
                if mesure is None:
                    print(f"  {etiquette} · {nom} · jet{jet} — sujet perdu au détourage")
                    continue
                lignes.append({
                    "jet": jet, "etiquette": etiquette, "modele": identifiant,
                    "piece": nom, "fichier": str(fichier.relative_to(RACINE)), **mesure,
                })
                print(f"  mesuré  jet{jet} · {etiquette:22} · {nom}")
    return lignes


def conclure(lignes: list[dict]) -> None:
    print("\n" + "═" * 78)
    print("  CE QU'ON EN RETIENT")
    print("═" * 78)
    if not lignes:
        print("\nRien sur le disque. Lancer avec --payer pour produire les images.")
        return

    # ── Le verdict se prend pièce par pièce, jamais sur une médiane de pièces ──
    #
    # La première version de cette conclusion médianait les trois pièces d'un
    # même modèle. Avec 0,3 % de repeint sur les jambières, 0,8 % sur le casque
    # et 23,5 % sur la cape, la médiane rendait 0,8 % — et annonçait que les six
    # modèles tenaient les deux seuils. La cape échouait pourtant sur les six,
    # aux deux jets, sans exception. **Une médiane sur trois pièces efface la
    # seule qui rate**, et c'est la seule qui décide de ce que le produit promet.
    # Corrigé le 28 août 2026 ; le fait est écrit dans `docs/PRD.md`.
    #
    # `ECHELLE_TOLEREE` à 10 % et pas à 5 % : le casque revient à 0,96 sur la
    # médiane, une dérive qu'un recalage rattrape sans toucher à la grille de
    # pixels. La cape revient à 0,62 — la remettre à l'échelle rééchantillonne
    # d'un facteur 1,61, ce qui détruit le pixel art avant même la différence.
    # Un seuil à 5 % ferait basculer le casque sur trois millièmes ; la limite
    # honnête est entre les deux, pas au bord de l'une d'elles.
    SILHOUETTE_MIN, REPEINT_MAX, ECHELLE_TOLEREE = 0.99, 0.05, 0.10

    def med(siennes: list[dict], cle: str) -> float:
        return statistics.median(l[cle] for l in siennes)

    print("\n  Par pièce — sur toutes les configurations et tous les jets\n")
    print(f"  {'pièce':13} {'silhouette':>11} {'repeint méd':>12} "
          f"{'repeint pire':>13} {'ajout':>8} {'échelle':>8}   verdict")
    regle: dict[str, bool] = {}
    for nom, _, _ in PIECES:
        siennes = [l for l in lignes if l["piece"] == nom]
        if not siennes:
            continue
        pire = max(l["repeint"] for l in siennes)
        echelle = med(siennes, "echelle_recalee")
        rates = sum(1 for l in siennes if l["repeint"] > REPEINT_MAX)
        regle[nom] = (
            min(l["silhouette_retrouvee"] for l in siennes) >= SILHOUETTE_MIN
            and pire <= REPEINT_MAX
            and abs(echelle - 1.0) <= ECHELLE_TOLEREE
        )
        verdict = (f"tenue sur {len(siennes)}/{len(siennes)}" if regle[nom]
                   else f"ÉCHOUE sur {rates}/{len(siennes)}")
        print(
            f"  {nom:13} {med(siennes, 'silhouette_retrouvee'):>10.1%} "
            f"{med(siennes, 'repeint'):>11.1%} {pire:>12.1%} "
            f"{med(siennes, 'ajout'):>7.1%} {echelle:>8.2f}   {verdict}"
        )

    print("\n  Par modèle — sa PIRE pièce, jamais sa médiane\n")
    print(f"  {'modèle':22} {'pire pièce':12} {'silhouette':>11} {'repeint':>8} "
          f"{'ajout':>8} {'échelle':>8}")
    tenables = []
    for etiquette, _, _ in CONFIGURATIONS:
        siennes = [l for l in lignes if l["etiquette"] == etiquette]
        if not siennes:
            continue
        pire = max(siennes, key=lambda l: l["repeint"])
        if all(l["repeint"] <= REPEINT_MAX
               and l["silhouette_retrouvee"] >= SILHOUETTE_MIN for l in siennes):
            tenables.append(etiquette)
        print(
            f"  {etiquette:22} {pire['piece']:12} "
            f"{pire['silhouette_retrouvee']:>10.1%} {pire['repeint']:>7.1%} "
            f"{pire['ajout']:>7.1%} {pire['echelle_recalee']:>8.2f}   (n={len(siennes)})"
        )

    print(
        "\n  **La colonne qui décide est « repeint », pas « silhouette ».**\n"
        "  Une silhouette à 100 % avec un repeint à 30 % veut dire que le modèle\n"
        "  a gardé la forme et redessiné l'intérieur : le calque par différence\n"
        "  emporterait alors un tiers du corps avec la pièce. C'est ce cas-là qui\n"
        "  annule C3, et il ne se voit sur aucune vignette.\n"
        "  « recouvert » n'est pas un défaut : c'est le corps caché par la pièce,\n"
        "  à l'intérieur de son emplacement. Un casque cache le haut du crâne.\n"
        "  **Et « échelle » décide avant les deux autres** : si le modèle a dézoomé\n"
        "  le personnage pour faire tenir la pièce dans le cadre, il n'y a plus de\n"
        "  différence à calculer — les pixels ne se correspondent plus."
    )

    tenues = [n for n, ok in regle.items() if ok]
    ratees = [n for n, ok in regle.items() if not ok]
    print(
        f"\n  Pièces tenues par TOUS les modèles, aux deux jets : "
        f"{', '.join(tenues) if tenues else 'aucune'}."
        f"\n  Pièces ratées par TOUS les modèles, aux deux jets : "
        f"{', '.join(ratees) if ratees else 'aucune'}."
    )
    if tenables:
        print(f"  Modèles qui tiennent TOUTES les pièces : {', '.join(tenables)}.")
    else:
        print("  Aucun modèle ne tient toutes les pièces.")
    if ratees:
        print(
            "\n  **La méthode par différence ne se juge pas modèle par modèle, elle se\n"
            "  juge pièce par pièce.** Aucun modèle ne rattrape une pièce que tous\n"
            "  ratent : ce n'est pas un défaut de fournisseur, c'est la limite de la\n"
            "  méthode. La règle produit qui en sort — une pièce CONTENUE dans la\n"
            "  silhouette passe, une pièce qui l'AGRANDIT casse — est écrite dans\n"
            "  `docs/PRD.md`, décisions d'implémentation."
        )


def planche(lignes: list[dict], corps: bytes) -> None:
    """Le corps en tête, puis chaque modèle en ligne et chaque pièce en colonne."""
    if not lignes:
        return
    cote, marge, bande = 190, 6, 20
    modeles = [e for e, _, _ in CONFIGURATIONS if any(l["etiquette"] == e for l in lignes)]
    largeur = marge + (cote + marge) * (len(PIECES) + 1)
    hauteur = marge + (cote + bande + marge) * (len(modeles) * len(JETS) + 1)
    feuille = Image.new("RGB", (largeur, hauteur), (22, 24, 28))

    def poser(octets: bytes, colonne: int, rangee: int) -> None:
        with Image.open(io.BytesIO(octets)) as ouverte:
            vignette = ouverte.convert("RGB")
        vignette.thumbnail((cote, cote), Image.Resampling.LANCZOS)
        feuille.paste(vignette, (
            marge + (cote + marge) * colonne + (cote - vignette.width) // 2,
            marge + (cote + bande + marge) * rangee + (cote - vignette.height) // 2,
        ))

    poser(corps, 0, 0)
    rangee = 1
    for jet in JETS:
        for etiquette in modeles:
            for colonne, (nom, _, _) in enumerate(PIECES, start=1):
                trouvee = next(
                    (l for l in lignes if l["jet"] == jet
                     and l["etiquette"] == etiquette and l["piece"] == nom), None
                )
                if trouvee:
                    poser((RACINE / trouvee["fichier"]).read_bytes(), colonne, rangee)
            rangee += 1

    PLANCHES.mkdir(parents=True, exist_ok=True)
    chemin = PLANCHES / "silhouette.png"
    feuille.save(chemin)
    print(f"\n  planche contact : {chemin.relative_to(RACINE.parent)}")


# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    # La console Windows encode en cp1252 dès que la sortie est redirigée, et un
    # « ── » suffit alors à lever depuis un thread — ce qui tue tout le lot en
    # cours, après l'avoir payé (`docs/PIEGES.md`).
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(description="La silhouette en édition")
    arguments.add_argument("--payer", action="store_true",
                           help="faire les appels manquants (sinon : mesure seule)")
    arguments.add_argument("--etalonner", action="store_true",
                           help="vérifier les mesures sur des cas fabriqués, sans appel")
    arguments.add_argument("--verifier", action="store_true",
                           help="tout prouver avant de payer, sans appel payant "
                                "— rend 1 si une preuve manque")
    options = arguments.parse_args()

    if not CORPS.exists():
        print(f"Corps de départ introuvable : {CORPS}")
        return 1
    corps = CORPS.read_bytes()

    if options.etalonner:
        return etalonner(corps)
    if options.verifier:
        return verifier(corps)

    if options.payer:
        cle = lire_cle()
        if not cle:
            print("Cle OpenRouter introuvable.")
            print('  soit :  $env:OPENROUTER_API_KEY = "sk-or-..."')
            print(f"  soit :  une ligne OPENROUTER_API_KEY=... dans {RACINE.parent / '.env'}")
            return 1
        catalogue = charger_catalogue()
        print(f"\n{len(CONFIGURATIONS)} modèles × {len(PIECES)} pièces × "
              f"{len(JETS)} jets — ce qui manque seulement.\n")
        # **Les futures se relisent, sinon une panne de thread est muette.**
        # `pool.submit` avale l'exception qu'un travailleur laisse échapper hors
        # de son `try` : la configuration ne produirait rien et n'en dirait rien.
        # On relit après la fermeture du pool — donc après que tout a tourné —,
        # ce qui rend la panne visible sans emporter le reste du lot.
        travaux = []
        with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
            for jet in JETS:
                for etiquette, identifiant, propres in CONFIGURATIONS:
                    travaux.append((etiquette, jet, pool.submit(
                        executer, cle, catalogue, corps, jet,
                        etiquette, identifiant, propres)))
        for etiquette, jet, travail in travaux:
            erreur = travail.exception()
            if erreur is not None:
                print(f"jet{jet} · {etiquette:22} le travailleur a levé — "
                      f"{type(erreur).__name__} : {erreur}", flush=True)
    else:
        attendus = len(CONFIGURATIONS) * len(PIECES) * len(JETS)
        # `is_file()` n'est pas décoratif : trois étiquettes portent un point
        # (`gemini-3.1-flash`, `seedream-5.0-lite`), donc leurs **dossiers**
        # répondent à `*.*` et le compte annonçait 42 images sur 36.
        presents = sum(
            1 for c in SORTIE.rglob("*.*") if c.is_file()
        ) if SORTIE.is_dir() else 0
        print(f"\nMesure seule — {presents} images sur {attendus} sur le disque.")
        print("Aucun appel. `--payer` fait les manquants, `--etalonner` vérifie la mesure.\n")

    print("\nMesure :\n")
    lignes = mesurer_tout(corps)
    MESURES.write_text(json.dumps(lignes, indent=1, ensure_ascii=False), encoding="utf-8")
    planche(lignes, corps)
    conclure(lignes)
    print(f"\n  mesures : {MESURES.relative_to(RACINE.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
