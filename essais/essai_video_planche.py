# -*- coding: utf-8 -*-
"""E6 — l'image-vers-vidéo : le mécanisme de SpriteCook, sur notre sujet.

**La question.** SpriteCook n'obtient pas ses huit images en demandant une
planche : il anime le sprite avec un modèle image-vers-vidéo, extrait des
images équidistantes, détoure chacune, applique une palette commune et
assemble. La cohérence entre images vient du modèle vidéo, fait pour ça. Sur
notre nain, via une API, ce chemin donne-t-il une bande de marche utilisable
plus souvent qu'une planche dessinée d'un coup — et à quel prix ?

**Ce qu'on attend.** Une marche lisible sur la majorité des clips, un
personnage qui reste lui-même, et un fond assez uni pour que le détourage du
produit passe. Ce qu'on ne sait pas : si le rendu vidéo garde l'allure pixel
art, ou s'il la lisse — auquel cas la remise sur grille (D2) devient l'étape
qui décide.

**C'est OpenRouter qui sert les modèles vidéo, avec la clé déjà en place.**
Aucun compte de plus n'est nécessaire : `OPENROUTER_API_KEY`, celle du produit,
suffit. **Une erreur de méthode de ma part, le 2 septembre 2026** : j'avais
conclu qu'OpenRouter ne faisait pas de vidéo en interrogeant `GET
/api/v1/models`, qui ne renvoie que les 423 modèles de texte. Les modèles vidéo
se demandent — `GET /api/v1/models?output_modalities=video`, ou l'endpoint
dédié `GET /api/v1/videos/models` qui donne en plus les durées, les résolutions
et les prix par modèle. Ils sont vingt-huit, dont vingt-sept acceptent une image
d'entrée. La leçon vaut au-delà de cet essai : *une absence dans une liste
filtrée par défaut n'est pas une absence*.

**L'interface vidéo est asynchrone et distincte de celle du texte** : `POST
/api/v1/videos` rend un identifiant et une adresse d'attente, `GET
/api/v1/videos/{id}` jusqu'à `completed`, puis la vidéo se télécharge sur la
première adresse rendue. L'image de départ se joint en `frame_images` avec
`frame_type: first_frame` — c'est ce qui distingue l'image-vers-vidéo de la
simple inspiration (`input_references`).

**L'adaptateur reste hors du produit**, une trentaine de lignes en `httpx`
ci-dessous : cet essai mesure un chemin, il n'ouvre pas un port. **Le script
refuse de partir** tant qu'un modèle n'a pas son prix estimé du jour dans
`resultats_video/mesures.json` ; le premier lancement écrit ce fichier en
relisant les prix chez OpenRouter, avec la date et la formule.

**L'entrée** : le sprite préparé de E4 s'il a été choisi, sinon le sprite
promu ; agrandi au plus proche voisin jusqu'à 768 px de haut, posé au centre
d'un canevas 1024×576 sur un fond plat gris 235 — le fond du produit. Le
texte, court, en anglais, le même pour tous les modèles.

**L'extraction — et c'est l'auteur qui choisit le cycle.** Chaque clip est lu
par `imageio` + `imageio-ffmpeg` (`pip install -e ".[essais-video]"`), toutes
ses images écrites en PNG. Dans le rapport, deux curseurs — début et période —
prélèvent huit images équidistantes et les montrent animées à 125 ms ;
« figer ce cycle » garde le choix dans le relevé, et c'est
`essais/monter_bande_video.py` qui écrit les huit PNG et passe la bande dans
la chaîne du produit. Une page ouverte depuis le disque n'écrit pas de fichier.

    Coût   : quatre clips par modèle, trois modèles, de cinq à quarante centimes le clip
             selon le modèle ; PLAFOND 3,00 $ sur ce lancement. Un clip sur le disque n'est pas repayé.
    A sec  : .venv\\Scripts\\python.exe essais/essai_video_planche.py --a-sec
    Payer  : .venv\\Scripts\\python.exe essais/essai_video_planche.py
    Monter : .venv\\Scripts\\python.exe essais/monter_bande_video.py
    Rapport: essais/rapport-video.html · notes : essais/notes-video.json

Sortie : `essais/resultats_video/<modele>/clip<N>/clip.mp4`, `frames/`, `bande/`, et `mesures.json`.
"""

from __future__ import annotations

import asyncio
import base64
import html
import io
import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from socle_essais import (  # noqa: E402
    COTE_VUE,
    DETOURAGE,
    MS,
    REFERENCE_ROLE,
    SCRIPT,
    STYLE,
    Caisse,
    _carte,
    arguments,
    carres,
    detourer,
    image_animee,
    notes_anciennes_du_temoin,
    notes_de,
    preparer_sortie,
    rejouer,
    temoin_du_disque,
)

ESSAI = "video"
PLAFOND_USD = 1.50
CLIPS = 2  # deux clips par modèle, choix de l'auteur du 2 septembre 2026 (le cahier en prévoyait quatre)
SORTIE = RACINE / "resultats_video"
MESURES = SORTIE / "mesures.json"
CLE_OR = "OPENROUTER_API_KEY"
VIDEOS = "https://openrouter.ai/api/v1/videos"
CATALOGUE_VIDEO = "https://openrouter.ai/api/v1/videos/models"

PROMPT = (
    "Pixel art game sprite. The character walks in place, side view, static camera, no zoom, "
    "no camera movement, plain flat background, the character stays the same size and the same "
    "design, seamless walk cycle loop."
)

# Les trois modèles à essayer, du moins cher au plus cher. **Les identifiants
# sont suggérés, pas relevés** : ils viennent de mémoire, et fal.ai renomme ses
# endpoints. L'auteur recopie l'identifiant exact et le prix du jour depuis la
# page du modèle dans `mesures.json`, avec la date — sans quoi le script refuse.
# Les paramètres partent tels quels dans le corps de l'appel ; ils se corrigent
# dans le fichier, jamais ici.
# ── Le banc des poses mêlées (2 septembre 2026) ─────────────────────────────
#
# **Une vidéo, deux animations.** Les six premiers clips ont montré qu'un clip
# de quatre secondes contient bien plus qu'un cycle de marche — celui qui s'est
# retourné « par erreur » donnait des images de demi-tour utilisables. Plutôt
# que de payer un clip par animation, on découpe le temps du clip en deux
# actions nettes et on en tire deux bandes. Chaque paire est tirée deux fois :
# à deux tirages, un résultat est un indice, pas une preuve.
#
# Tout est au plus économe : Seedance 1.5 pro, carré 480×480 (la surface décide
# du prix), quatre secondes (sa plus courte durée), sans son.
# Cinq secondes plutôt que quatre : il faut de la place pour les transitions,
# et une transition ratée rend la boucle inexploitable (choix de l'auteur,
# 2 septembre 2026, après le premier banc).
CARRE = {"duration": 5, "resolution": "480p", "aspect_ratio": "1:1", "generate_audio": False}

CADRE_POSES = (
    "Pixel art game sprite of a single character, side view, orthographic, facing right. "
    "Static camera: no zoom, no pan, no rotation. The character stays in the centre of the "
    "frame, at the same size, with the same design, colours and equipment from start to end. "
    "Plain flat light gray background, nothing else in frame."
)
# **Ce que la première version ratait** : « première moitié / seconde moitié »
# ne dit ni quand, ni comment on passe de l'une à l'autre. Sans transition et
# sans pose neutre commune, on ne peut pas découper une boucle propre. La
# minute est donc écrite seconde par seconde, chaque action revient à la même
# pose neutre, et la transition est nommée comme une action à part entière.
SEPARATION = (
    " Every action must be cuttable on its own and loop cleanly: the last frame of an action "
    "must lead back into its first frame. Between two actions the character returns to exactly "
    "the same neutral standing pose — same position, same size, same posture — so the cut is "
    "clean. Follow the timing above strictly. No camera movement, no extra action, the character "
    "never leaves the centre of the frame and never turns away from the side view."
)

# Les modèles qui passent le banc des poses. Seedance 1.5 pro garde ses clés
# historiques (`melange-…`) : ses tirages sont déjà payés et sur le disque.
BANCS_POSES = {
    "melange": "bytedance/seedance-1-5-pro",
    "h3max": "minimax/hailuo-3-max",
    "seed20mini": "bytedance/seedance-2.0-mini",
    "seed20fast": "bytedance/seedance-2.0-fast",
}

POSES_MELEES = {
    "melange-repos-marche": (
        "Timing, over 5 seconds:\n"
        "- 0.0 to 2.0 s — IDLE. The character stands still in one place, both feet flat on the "
        "ground line, arms down, lantern hanging in the near hand. It does not walk and does not "
        "move across the frame. The only motion is a slow breathing of the chest and shoulders "
        "and a very small sway of the lantern. This idle must loop seamlessly on itself.\n"
        "- 2.0 to 2.5 s — TRANSITION. In one smooth motion the character shifts its weight and "
        "lifts one foot to start walking. Nothing else changes.\n"
        "- 2.5 to 5.0 s — WALK. The character walks in place at a constant speed, a regular "
        "side-view walk cycle: same stride length, same rhythm and same height at every step, "
        "both feet returning to the same ground line. It stays centred and does not travel "
        "across the frame. This walk cycle must loop seamlessly on itself."
    ),
    "melange-lanterne-accroupi": (
        "Timing, over 5 seconds:\n"
        "- 0.0 to 1.0 s — WALK. The character walks in place at a constant speed, side view, a "
        "regular walk cycle, staying centred in the frame.\n"
        "- 1.0 to 1.5 s — TRANSITION. It slows down and comes to a stop, feet side by side, in a "
        "neutral standing pose, arms down.\n"
        "- 1.5 to 2.5 s — LANTERN. From that neutral pose it raises the lantern with its near "
        "hand up above its shoulder and holds it there, lighting the ground in front of it. The "
        "rest of the body stays still.\n"
        "- 2.5 to 3.0 s — TRANSITION. It lowers the lantern back down and returns to exactly the "
        "same neutral standing pose as at 1.5 s.\n"
        "- 3.0 to 4.0 s — CROUCH. It bends its knees and crouches down to the ground, reaching "
        "forward with its free hand as if picking something up, then holds the crouch.\n"
        "- 4.0 to 5.0 s — TRANSITION. It stands back up and returns to exactly the same neutral "
        "standing pose again."
    ),
}

ECHECS_POSES = (
    "les actions se mélangent, on ne peut pas les découper",
    "une des actions demandées n'est pas jouée",
    "une action n'est pas celle demandée",
    "la transition manque : on passe d'une action à l'autre d'un coup",
    "la boucle ne se referme pas : la dernière image ne rejoint pas la première",
    "la pose neutre n'est pas la même d'une action à l'autre",
    "le personnage change de taille entre les actions",
    "le personnage se retourne ou change de direction",
    "la caméra bouge, zoome ou tourne",
    "le fond n'est pas uni et le détourage laisse des restes",
)

# Les trois modèles retenus chez OpenRouter, du moins cher au plus cher, tous
# capables de partir d'une image (`text+image->video`). Le prix se relit chez
# OpenRouter au lancement — `GET /api/v1/videos/models` — et n'est jamais écrit
# en dur ici : il se compte soit à la seconde, soit au jeton vidéo, selon le
# modèle, et la formule est enregistrée avec le prix dans `mesures.json`.
SECONDES = 4  # la plus courte durée que les Seedance acceptent : un cycle de marche y tient

# **Deux leviers sur la facture, relevés le 2 septembre 2026.** La durée, pour
# qui se compte à la seconde : Wan 3.0 descend à deux secondes et coûte alors
# moitié moins. **Et le format d'image, pour qui se compte au jeton vidéo** :
# le jeton vaut hauteur × largeur × images par seconde × durée / 1024, donc un
# carré 480×480 coûte 44 % de moins qu'un 16:9 854×480 — et cadre mieux un
# personnage seul. Non appliqué ici pour que les clips de cette séance restent
# comparables entre eux ; à prendre pour la suivante.
MODELES = {
    "seedance-1.5-pro": {
        "modele": "bytedance/seedance-1-5-pro",
        "parametres": {"duration": SECONDES, "resolution": "480p", "aspect_ratio": "16:9", "generate_audio": False},
    },
    "seedance-2.0-mini": {
        "modele": "bytedance/seedance-2.0-mini",
        "parametres": {"duration": SECONDES, "resolution": "480p", "aspect_ratio": "16:9", "generate_audio": False},
    },
    # **Le même banc chez plusieurs modèles** (2 septembre 2026) : les trois
    # ajoutés sont réputés meilleurs pour suivre une consigne détaillée, et
    # restent bon marché. Une clé par couple modèle × paire de poses, pour que
    # chaque tirage ait son dossier et son prix propres.
    **{
        f"{court}-{nom.removeprefix('melange-')}": {
            "modele": identifiant,
            "parametres": dict(CARRE),
            "prompt": CADRE_POSES + " " + actions + SEPARATION,
            "echecs": ECHECS_POSES,
        }
        for court, identifiant in BANCS_POSES.items()
        for nom, actions in POSES_MELEES.items()
    },
    "wan-3.0": {
        "modele": "alibaba/wan-3.0",
        # **Deux secondes**, la plus courte durée qu'il accepte : il se compte à la
        # seconde, et un cycle de marche y tient. Quatre secondes doubleraient la
        # facture pour la même réponse (choix de l'auteur, 2 septembre 2026).
        "parametres": {"duration": 2, "resolution": "480p", "aspect_ratio": "16:9"},
    },
}

ECHECS = (
    "la caméra bouge, zoome ou tourne",
    "le personnage se retourne ou change de direction",
    "le personnage change de taille ou de design au fil du clip (morphing)",
    "les membres fondent ou se dédoublent",
    "le fond n'est pas uni (dégradé, ombre, texture) et le détourage laisse des restes",
    "le clip ne contient pas un cycle entier, ou en contient trop peu d'instants distincts",
    "le rendu est lissé « 3D » et la pixelisation ne le rattrape pas",
)
ECHECS_TEMOIN = ("la taille du personnage change d'une case à l'autre", "les huit cases sont la même pose")

REGLE = (
    "<b>Le chemin vidéo entre dans A0 comme chemin candidat si un modèle donne ≥ 2 bandes pixelisées bonnes sur "
    "4 clips</b>, à un prix par bonne bande inférieur ou égal à celui du témoin par bonne planche. S'il donne 4 sur "
    "4, la V3 change de forme : A3 se réduit à « commander deux clips et garder le bon », A8 devient un confort, et "
    "un adaptateur vidéo devient une tranche. Si les bandes brutes sont bonnes mais les pixelisées mauvaises, c'est "
    "D2 qui est en cause, pas la vidéo. Deux notes par clip, exprès : <b>la bande brute</b> (le mouvement) et "
    "<b>la bande pixelisée</b> (le résultat), parce que les deux peuvent diverger."
)

REGLE_JS = """function(s){
 var out=[], T=s['A-temoin'];
 var prixT = (T && T.bon) ? T.cout/T.bon : null;
 out.push('<span class=attente>témoin : '+(T?T.bon:0)+' bonne(s) planche(s), '+(prixT===null?'—':'$'+prixT.toFixed(3)+' la bonne')+'</span>');
 Object.keys(GROUPES).forEach(function(cle){
  if(cle==='A-temoin' || cle.indexOf('~pixel')>=0) return;
  var brute=s[cle], pixel=s[cle+'~pixel'];
  if(!pixel){ out.push('<span class=attente>'+cle+' : bandes brutes bonnes '+brute.bon+' / '+brute.essais+' — pas encore de bande pixelisée (monter_bande_video.py)</span>'); return; }
  var prix = pixel.bon ? brute.cout/pixel.bon : null;
  var assez = pixel.bon>=2, moins = prixT!==null && prix!==null && prix<=prixT;
  var cls = (brute.notees||pixel.notees) ? ((assez&&moins)?'oui':'non') : 'attente';
  out.push('<span class="'+cls+'">'+cle+' : clips utilisables (brute bonne) '+brute.bon+' / '+brute.essais+' · bandes pixelisées bonnes '+pixel.bon+' / '+pixel.essais
   +' · '+(prix===null?'aucune bonne bande':'$'+prix.toFixed(3)+' la bonne bande')+' → '
   +(assez ? (moins ? 'chemin candidat pour A0' : 'assez de bonnes, mais plus cher que le témoin') : 'moins de deux bonnes bandes')
   +(pixel.bon===4?' — quatre sur quatre : la V3 change de forme':'')+'</span>');
  if(brute.bon>=2 && pixel.bon<2){ out.push('<span class=attente>&nbsp;&nbsp;brutes bonnes, pixelisées mauvaises : c\\'est D2 qui est en cause, pas la vidéo</span>'); }
 });
 return out;
}"""


# ── Le relevé : ce que l'auteur doit remplir avant le premier appel ──────────


# Les formats d'image, en pixels, pour la résolution et le rapport demandés.
# **La surface décide du prix** chez les modèles qui comptent en jetons vidéo :
# un carré 480×480 coûte 44 % de moins qu'un 16:9 854×480, et cadre mieux un
# personnage seul (relevé du 2 septembre 2026).
COTES = {"480p": 480, "560p": 560, "720p": 720, "768p": 768, "1080p": 1080}
RAPPORTS = {"1:1": (1, 1), "16:9": (16, 9), "4:3": (4, 3), "9:16": (9, 16), "3:4": (3, 4), "3:2": (3, 2)}


def taille_demandee(parametres: dict) -> tuple[int, int]:
    """La largeur et la hauteur qu'un appel produira, d'après sa résolution et son rapport."""
    if taille := parametres.get("size"):
        largeur, hauteur = (int(v) for v in str(taille).split("x"))
        return largeur, hauteur
    hauteur = COTES.get(str(parametres.get("resolution") or "480p"), 480)
    l, h = RAPPORTS.get(str(parametres.get("aspect_ratio") or "1:1"), (1, 1))
    return int(round(hauteur * l / h)), hauteur


def _prix_du_jour(fiche: dict, parametres: dict) -> tuple[float | None, str]:
    """Le prix d'un clip et **d'où il sort**, d'après les SKU du modèle.

    Deux façons de compter chez les fournisseurs : à la seconde de vidéo, ou au
    jeton vidéo — hauteur × largeur × images par seconde × durée / 1024. La
    seconde demande une taille : on prend celle du 480p 16:9 (854×480) à 24
    images par seconde, ce que l'appel demande. Le calcul est **écrit à côté du
    prix** : un prix sans sa formule n'est pas vérifiable.
    """
    sku = fiche.get("pricing_skus") or {}
    secondes = float(parametres.get("duration") or SECONDES)

    def nombre(cle: str) -> float | None:
        try:
            return float(sku[cle])
        except (KeyError, TypeError, ValueError):
            return None

    for cle in ("duration_seconds_480p", "duration_seconds_without_audio_720p", "duration_seconds"):
        par_seconde = nombre(cle)
        if par_seconde is not None:
            return round(par_seconde * secondes, 4), f"{sku[cle]} $ la seconde ({cle}) × {secondes:g} s"
    for cle in ("video_tokens_without_audio", "video_tokens"):
        par_jeton = nombre(cle)
        if par_jeton is not None:
            largeur, hauteur = taille_demandee(parametres)
            jetons = largeur * hauteur * 24 * secondes / 1024
            return round(par_jeton * jetons, 4), (f"{sku[cle]} $ le jeton ({cle}) × "
                                                  f"{largeur}×{hauteur}×24×{secondes:g}/1024 = {jetons:.0f} jetons")
    return None, f"aucun SKU connu parmi {sorted(sku)}"


def catalogue_video() -> dict[str, dict]:
    """Ce qu'OpenRouter dit aujourd'hui de ses modèles vidéo, par identifiant."""
    import urllib.request

    with urllib.request.urlopen(CATALOGUE_VIDEO, timeout=60) as reponse:
        return {x["id"]: x for x in json.load(reponse)["data"]}


def releve(rafraichir: bool = False) -> dict:
    """Le relevé, et les prix du jour relus chez OpenRouter au besoin.

    Le fichier garde ce qui a été payé ; les prix, eux, changent — ils sont
    relus à chaque lancement tant qu'un modèle n'a pas le sien, et `--prix`
    les relit tous. Un modèle qu'OpenRouter ne sert plus est laissé sans prix,
    et le script ne l'envoie pas.
    """
    donnees = json.loads(MESURES.read_text("utf-8")) if MESURES.exists() else {}
    SORTIE.mkdir(parents=True, exist_ok=True)
    fournisseur = donnees.setdefault("_fournisseur", {})
    fournisseur["nom"] = "OpenRouter"
    fournisseur["cle"] = CLE_OR
    fournisseur["_lecture"] = (
        "Prix relus chez OpenRouter (GET /api/v1/videos/models) au lancement, avec la formule qui les "
        "produit et la date. Un prix estimé n'est pas un montant facturé : le montant réel de chaque "
        "clip est relu après coup sur GET /api/v1/generation?id=... et écrit dans cout_usd."
    )
    modeles = fournisseur.setdefault("modeles", {})
    manque = rafraichir or any(m.get("prix_usd_par_clip") is None for m in modeles.values()) or set(MODELES) - set(modeles)
    fiches = catalogue_video() if manque else {}
    for nom, reglage in MODELES.items():
        ligne = modeles.setdefault(nom, {})
        ligne["modele"] = reglage["modele"]
        ligne["parametres"] = reglage["parametres"]
        # Un banc peut porter son propre texte ; sinon c'est celui de l'essai.
        ligne["prompt"] = reglage.get("prompt") or PROMPT
        fiche = fiches.get(reglage["modele"])
        if fiche is None:
            ligne.setdefault("prix_usd_par_clip", None)
            ligne.setdefault("prix_origine", "modèle absent du catalogue vidéo d'OpenRouter")
            continue
        prix, origine = _prix_du_jour(fiche, reglage["parametres"])
        ligne["prix_usd_par_clip"] = prix
        ligne["prix_origine"] = origine
        ligne["releve_le"] = date.today().isoformat()
        ligne["durees_possibles"] = fiche.get("supported_durations")
        ligne["resolutions_possibles"] = fiche.get("supported_resolutions")
    MESURES.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), "utf-8")
    return donnees


def ecrire(donnees: dict) -> None:
    MESURES.write_text(json.dumps(donnees, indent=1, ensure_ascii=False), "utf-8")


def prets(donnees: dict) -> dict[str, dict]:
    """Les modèles dont le prix du jour est connu — les seuls qui peuvent partir."""
    modeles = donnees.get("_fournisseur", {}).get("modeles", {})
    return {n: m for n, m in modeles.items() if m.get("modele") and m.get("prix_usd_par_clip")}


# ── L'entrée ─────────────────────────────────────────────────────────────────


def composer_entree(sprite: bytes, part: float = 0.80, canevas: tuple[int, int] = (1024, 576), fond: int = 235) -> bytes:
    """Le sprite agrandi au plus proche voisin, **entier dans** un canevas 16:9 gris.

    **Le corps tient dans la toile, sur ses deux dimensions.** Le cahier disait
    « 768 px de haut sur un canevas 1024×576 » — impossible : 768 dépasse 576, et
    le premier essai du 2 septembre 2026 est parti avec un personnage coupé au
    genou et à la tête. Le facteur est **entier** (les pixels restent carrés) et
    le plus grand qui laisse le sujet entier avec sa marge.
    """
    with Image.open(io.BytesIO(sprite)) as image:
        image = image.convert("RGBA")
        # **Le sujet, pas la toile.** Une planche revenue du modèle n'a pas de
        # transparence : sa boîte serait l'image entière. C'est le détourage du
        # produit qui dit où est le sujet, comme partout ailleurs dans ces essais.
        if image.getchannel("A").getextrema()[0] == 255:
            # **Le fond de la source part avec le détourage du produit.** Sans lui,
            # le rectangle de la planche d'origine — un gris voisin, pas le même —
            # resterait visible sur la toile, et le modèle vidéo animerait ce cadre.
            image = Image.fromarray(detourer(DETOURAGE, sprite), "RGBA")
        boite = image.getbbox() or (0, 0, image.width, image.height)
        image = image.crop(boite)
        vise = (int(canevas[0] * part), int(canevas[1] * part))
        facteur = min(vise[1] // image.height, vise[0] // image.width)
        if facteur >= 1:
            grande = image.resize((image.width * facteur, image.height * facteur), Image.Resampling.NEAREST)
        else:
            # **Plus grand que la toile** : une prep de E4 fait 1024 de haut. On
            # divise par un entier — les pixels restent carrés, ce qui serait
            # perdu avec un facteur quelconque.
            diviseur = 1
            while image.width // (diviseur + 1) > 0 and (image.height // diviseur > vise[1] or image.width // diviseur > vise[0]):
                diviseur += 1
            grande = image.resize((image.width // diviseur, image.height // diviseur), Image.Resampling.NEAREST)
    if grande.width > canevas[0] or grande.height > canevas[1]:
        raise ValueError(f"le sujet mis à l'échelle ({grande.width}×{grande.height}) ne tient pas dans {canevas}")
    toile = Image.new("RGB", canevas, (fond, fond, fond))
    toile.paste(grande, ((canevas[0] - grande.width) // 2, (canevas[1] - grande.height) // 2), grande)
    tampon = io.BytesIO()
    toile.save(tampon, format="PNG")
    return tampon.getvalue()


def sprite_de_depart() -> tuple[bytes, str]:
    """Le sprite préparé de E4 s'il a été choisi, sinon le sprite promu — **brut**."""
    choix = notes_de("mise-en-pose").get("notes", {}).get("_choix", {}).get("prep")
    if choix:
        chemin = RACINE / "resultats_mise_en_pose" / "prep" / f"{choix}.png"
        if chemin.exists():
            return chemin.read_bytes(), f"la prep {choix} de E4"
    depart = rejouer()
    sprite = next(i for i in depart.images if i.role == REFERENCE_ROLE).octets
    return sprite, "le sprite promu (E4 n'a pas de prep choisie)"


# ── L'adaptateur — vingt lignes, hors du produit ─────────────────────────────


async def animer_chez_openrouter(modele: str, cle: str, corps: dict, *, attente_max: float = 900.0) -> tuple[bytes, str]:
    """Un clip par l'interface vidéo d'OpenRouter : soumettre, attendre, télécharger.

    Rend les octets **et l'identifiant du travail**, qui sert ensuite à relire
    le montant réellement facturé — ce que fal.ai ne rendait pas.
    """
    import httpx

    entete = {"Authorization": f"Bearer {cle}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=120) as client:
        soumis = await client.post(VIDEOS, json={"model": modele, **corps}, headers=entete)
        if soumis.status_code >= 400:
            raise RuntimeError(f"OpenRouter {soumis.status_code} : {soumis.text[:400]}")
        billet = soumis.json()
        attente = billet.get("polling_url") or f"{VIDEOS}/{billet['id']}"
        debut = time.monotonic()
        while True:
            etat = (await client.get(attente, headers=entete)).json()
            statut = etat.get("status")
            if statut == "completed":
                break
            if statut in ("failed", "cancelled", "error"):
                raise RuntimeError(f"OpenRouter : {statut} — {etat.get('error') or json.dumps(etat)[:300]}")
            if time.monotonic() - debut > attente_max:
                raise TimeoutError("OpenRouter : le clip n'est pas arrivé à temps")
            await asyncio.sleep(5)
        return await _telecharger(client, etat, entete), billet.get("id", "")


async def _telecharger(client, etat: dict, entete: dict) -> bytes:
    """La vidéo finie. **Les adresses d'OpenRouter demandent la clé** — la
    documentation les télécharge sans en-tête, et c'est un 401 (2 septembre
    2026, un clip produit et perdu au dernier pas)."""
    adresses = etat.get("unsigned_urls") or etat.get("urls") or []
    if not adresses:
        raise RuntimeError(f"OpenRouter : aucune vidéo dans la réponse — {json.dumps(etat)[:300]}")
    adresse = adresses[0]
    video = await client.get(adresse, headers=entete if "openrouter.ai" in adresse else None)
    video.raise_for_status()
    return video.content


async def reprendre_chez_openrouter(identifiant: str, cle: str) -> bytes:
    """La vidéo d'un travail **déjà payé**, retéléchargée sans rien relancer.

    Un clip perdu entre la production et le disque a coûté son prix : il se
    récupère tant qu'OpenRouter le garde.
    """
    import httpx

    entete = {"Authorization": f"Bearer {cle}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=120) as client:
        etat = (await client.get(f"{VIDEOS}/{identifiant}", headers=entete)).json()
        if etat.get("status") != "completed":
            raise RuntimeError(f"OpenRouter : le travail {identifiant} est « {etat.get('status')} », pas « completed »")
        return await _telecharger(client, etat, entete)


async def cout_facture(identifiant: str, cle: str) -> float | None:
    """Le montant réellement compté pour ce travail, ou rien s'il n'est pas encore là.

    **Un prix estimé n'est pas un montant facturé** : le relevé porte les deux,
    et c'est celui-ci qui compte dans le prix par bonne bande.
    """
    if not identifiant:
        return None
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get("https://openrouter.ai/api/v1/generation",
                                 params={"id": identifiant}, headers={"Authorization": f"Bearer {cle}"})
            if r.status_code >= 400:
                return None
            d = r.json().get("data") or {}
            valeur = d.get("total_cost", d.get("usage"))
            return float(valeur) if valeur is not None else None
    except Exception:  # noqa: BLE001 — le montant réel est un supplément, pas une condition
        return None


def extraire(clip: Path) -> tuple[int, float]:
    """Toutes les images du clip en PNG dans `frames/`, et la cadence lue dans le fichier."""
    import imageio.v3 as iio

    dossier = clip.parent / "frames"
    dossier.mkdir(exist_ok=True)
    try:
        meta = iio.immeta(clip)
    except Exception:  # noqa: BLE001 — la cadence est un confort, pas une condition
        meta = {}
    total = 0
    for n, image in enumerate(iio.imiter(clip)):
        Image.fromarray(image).save(dossier / f"f{n:03d}.png")
        total = n + 1
    (clip.parent / "clip.json").write_text(json.dumps({"images": total, "fps": meta.get("fps")}, indent=1), "utf-8")
    return total, float(meta.get("fps") or 0.0)


# ── La séance ────────────────────────────────────────────────────────────────


async def tirer(donnees: dict, sprite: bytes, cle: str, seuls: set[str] | None = None, clips: int | None = None) -> None:
    caisse = Caisse(0.0, PLAFOND_USD)
    plume = asyncio.Lock()
    # **Une toile par format demandé** : envoyer une image 16:9 à un appel qui
    # rend du carré ferait recadrer le personnage par le modèle.
    # `entrees`, pas `images` : `images` est déjà le nombre d'images extraites
    # d'un clip, plus bas dans la même fonction — Python en aurait fait une
    # variable locale et l'appel serait mort avant de partir (2 septembre 2026).
    entrees: dict[tuple[int, int], str] = {}
    for m in prets(donnees).values():
        taille = taille_demandee(m.get("parametres", {}))
        if taille not in entrees:
            octets = composer_entree(sprite, canevas=taille)
            (SORTIE / f"entree-{taille[0]}x{taille[1]}.png").write_bytes(octets)
            entrees[taille] = "data:image/png;base64," + base64.b64encode(octets).decode("ascii")

    async def noter(modele: str, clip: str, ligne: dict) -> None:
        async with plume:
            donnees.setdefault("_seance", {}).setdefault("date", date.today().isoformat())
            donnees["_seance"]["dernier_lancement"] = datetime.now().isoformat(timespec="seconds")
            donnees.setdefault(modele, {})[clip] = ligne
            ecrire(donnees)

    async def un_clip(nom: str, modele: dict, index: int) -> None:
        dossier = SORTIE / nom / f"clip{index}"
        fichier = dossier / "clip.mp4"
        if fichier.exists():
            return
        if not await caisse.autorise():
            return
        dossier.mkdir(parents=True, exist_ok=True)
        # **Repêchage avant dépense** : si un lancement précédent a produit ce
        # clip et l'a perdu au téléchargement, son identifiant est au relevé.
        perdu = (donnees.get(nom, {}).get(f"clip{index}") or {}).get("travail")
        if perdu:
            try:
                octets = await reprendre_chez_openrouter(perdu, cle)
                fichier.write_bytes(octets)
                images, fps = (0, 0.0)
                try:
                    images, fps = extraire(fichier)
                except Exception as erreur:  # noqa: BLE001
                    print(f"{nom:<18} clip {index} — extraction impossible : {erreur}")
                ligne = dict(donnees[nom][f"clip{index}"])
                ligne.update({"echec": None, "octets": len(octets), "images": images, "fps": fps,
                              "repeche": f"travail {perdu}, deja paye, retelecharge sans relancer"})
                await noter(nom, f"clip{index}", ligne)
                print(f"{nom:<18} clip {index} — repeche du travail {perdu}, rien de paye")
                return
            except Exception as erreur:  # noqa: BLE001
                print(f"{nom:<18} clip {index} — repechage impossible ({erreur}), on relance")
        largeur, hauteur = taille_demandee(modele.get("parametres", {}))
        image_url = entrees[(largeur, hauteur)]
        corps = {
            "prompt": modele.get("prompt") or PROMPT,
            # **L'image de départ, pas une inspiration** : `frame_images` avec
            # `first_frame` demande une image-vers-vidéo ; `input_references`
            # ne ferait qu'inspirer le modèle.
            "frame_images": [{"type": "image_url", "image_url": {"url": image_url}, "frame_type": "first_frame"}],
            **modele.get("parametres", {}),
        }
        debut = time.monotonic()
        identifiant = ""
        try:
            octets, identifiant = await animer_chez_openrouter(modele["modele"], cle, corps)
        except Exception as erreur:  # noqa: BLE001
            secondes = round(time.monotonic() - debut, 1)
            # **L'identifiant part au relevé même en échec** : un clip produit
            # puis perdu est payé, et c'est lui qui permet de le reprendre.
            trace = getattr(erreur, "request", None)
            perdu = identifiant or (str(trace.url).split("/videos/")[-1].split("/")[0] if trace is not None and "/videos/" in str(trace.url) else "")
            await noter(nom, f"clip{index}", {"echec": f"{type(erreur).__name__}: {erreur}", "secondes": secondes,
                                              "cout_usd": 0.0, "travail": perdu or None})
            print(f"{nom:<16} clip {index} — echec en {secondes:.0f}s : {type(erreur).__name__}: {erreur}")
            return
        fichier.write_bytes(octets)
        secondes = round(time.monotonic() - debut, 1)
        prix = float(modele["prix_usd_par_clip"])
        facture = await cout_facture(identifiant, cle)
        total = await caisse.ajoute(facture if facture is not None else prix)
        images, fps = 0, 0.0
        try:
            images, fps = extraire(fichier)
        except Exception as erreur:  # noqa: BLE001
            print(f"{nom:<16} clip {index} — extraction impossible : {erreur} (pip install -e \".[essais-video]\")")
        await noter(nom, f"clip{index}", {
            "cout_usd": facture if facture is not None else prix, "unite": "usd",
            "consomme": facture if facture is not None else prix,
            "prix_estime": prix,
            "cout_origine": ("montant facturé, relu sur /api/v1/generation" if facture is not None
                             else f"prix estimé du {modele.get('releve_le')} — le montant facturé n'a pas pu être relu"),
            "travail": identifiant,
            "secondes": secondes, "octets": len(octets), "images": images, "fps": fps,
        })
        marque = "facturé" if facture is not None else "estimé"
        print(f"{nom:<18} clip {index} — ${(facture if facture is not None else prix):.3f} ({marque}) · "
              f"{secondes:.0f}s · {images} images · total ${total:.3f}")

    combien = clips or CLIPS
    choisis = {n: m for n, m in prets(donnees).items() if seuls is None or n in seuls}
    taches = [un_clip(nom, m, i) for nom, m in choisis.items() for i in range(1, combien + 1)]
    await asyncio.gather(*taches)
    print(f"\ntotal engage sur ce lancement (au tarif releve) : ${caisse.depense:.3f}")
    if caisse.depense >= PLAFOND_USD:
        print("[!] plafond atteint — des clips ont ete sautes.")


# ── Le rapport ───────────────────────────────────────────────────────────────


def _b64(octets: bytes) -> str:
    return base64.b64encode(octets).decode("ascii")


def _images_du_clip(dossier: Path, cote: int = COTE_VUE) -> list[str]:
    frames = sorted((dossier / "frames").glob("f*.png")) if (dossier / "frames").exists() else []
    sortie = []
    for f in frames:
        with Image.open(f) as im:
            c = carres([im.convert("RGB")], cote)[0]
        t = io.BytesIO()
        c.save(t, format="PNG", optimize=True)
        sortie.append(_b64(t.getvalue()))
    return sortie


def _bande_pixel(dossier: Path) -> list[str] | None:
    pixel = dossier / "bande" / "pixel"
    etapes = sorted(pixel.glob("etape*.png")) if pixel.exists() else []
    if len(etapes) < 2:
        return None
    sortie = []
    for e in etapes:
        with Image.open(e) as im:
            im = im.convert("RGBA")
            fond = Image.new("RGB", im.size, (235, 235, 235))
            fond.paste(im, (0, 0), im)
            facteur = max(1, COTE_VUE // max(im.size))
            grande = fond.resize((im.width * facteur, im.height * facteur), Image.Resampling.NEAREST)
            c = Image.new("RGB", (COTE_VUE, COTE_VUE), (235, 235, 235))
            c.paste(grande, ((COTE_VUE - grande.width) // 2, COTE_VUE - grande.height))
        t = io.BytesIO()
        c.save(t, format="PNG", optimize=True)
        sortie.append(_b64(t.getvalue()))
    return sortie


def _bandes_nommees(dossier: Path) -> list[tuple[str, list[str]]]:
    """Les bandes pixelisées des animations nommées de ce clip, s'il y en a."""
    racine = dossier / "bande"
    if not racine.exists():
        return []
    trouvees = []
    for sous in sorted(racine.iterdir()):
        pixel = sous / "pixel"
        if sous.is_dir() and pixel.is_dir():
            etapes = sorted(pixel.glob("etape*.png"))
            if etapes:
                trouvees.append((sous.name, [_b64(e.read_bytes()) for e in etapes]))
    return trouvees


def _notation(echecs, libelles=(("mauvais", "Mauvais"), ("moyen", "Moyen"), ("bon", "Bon"))) -> str:
    parts = ["<div class=notation><div class=note>"]
    for valeur, mot in libelles:
        parts.append(f"<button data-v={valeur}>{mot}</button>")
    parts.append("</div><div class=echecs>")
    for e in echecs:
        parts.append(f"<label><input type=checkbox value='{html.escape(e, quote=True)}'> {html.escape(e)}</label>")
    parts.append("</div><input class=libre type=text placeholder='autre — une ligne' maxlength=200></div>")
    return "".join(parts)


def _carte_clip(nom: str, index: int, ligne: dict, choix: dict) -> tuple[str, bool, bool]:
    dossier = SORTIE / nom / f"clip{index}"
    ident = f"{nom}:clip{index}"
    clip = dossier / "clip.mp4"
    parts = [f"<div class=tirage data-id='{ident}' style='margin-bottom:18px'><div class=tete><span>clip {index}</span><span>{html.escape(nom)}</span></div>"]
    revenue = clip.exists()
    pixel = None
    if revenue:
        images = _images_du_clip(dossier)
        n = len(images)
        relatif = f"resultats_video/{nom}/clip{index}/clip.mp4"
        c = choix.get(ident, {})
        debut, periode = int(c.get("debut", 0)), int(c.get("periode", max(8, min(n, 24))))
        parts.append(f"<video src='{relatif}' controls loop muted playsinline style='width:100%;display:block;background:#000'></video>")
        parts.append(f"<div class=faits><span>{n} images</span><span>{ligne.get('fps') or '?'} i/s</span><span>{ligne.get('cout_usd', 0):.3f} $ (tarif)</span><span>{ligne.get('secondes', 0):.0f} s</span></div>")
        parts.append("<div class=bande-images style='display:flex;overflow-x:auto;gap:1px;background:var(--fond-0);padding:4px'>"
                     + "".join(f"<img src='data:image/png;base64,{b}' data-i={i} style='width:48px;height:48px;flex:none' title='image {i}'>" for i, b in enumerate(images))
                     + "</div>")
        parts.append(f"<div class=cycle data-id='{ident}' data-n={n} style='padding:8px 9px;font-size:11px;color:var(--texte-2)'>"
                     f"<div style='display:flex;gap:12px;align-items:center'>"
                     f"<div style='flex:none'>{image_animee(images[:8] if n >= 8 else images, classe='anim-img cycle-img')}</div>"
                     f"<div style='flex:1'>début <input type=range class=debut min=0 max={max(0, n - 1)} value={debut}> <span class=v-debut>{debut}</span><br>"
                     f"période <input type=range class=periode min=8 max={max(8, n)} value={periode}> <span class=v-periode>{periode}</span> images<br>"
                     f"<button class=figer style='margin-top:6px;background:var(--fond-1);color:var(--signal);border:1px solid var(--bord);border-radius:3px;padding:5px 9px;font:inherit;font-size:11px;cursor:pointer'>figer ce cycle</button>"
                     f" <span class=etat-figer style='color:var(--texte-3)'></span>"
                     # **Plusieurs animations dans un seul clip** (2 septembre 2026) : quatre
                     # secondes contiennent plus qu'un cycle de marche, et l'auteur en garde
                     # autant qu'il en trouve, chacune sous son nom.
                     f"<br><span style='color:var(--texte-3)'>ou garde-le sous un nom, et continue à chercher dans le même clip :</span><br>"
                     f"<input class=nom-cycle type=text placeholder='marche, repos, lanterne…' maxlength=24 "
                     f"style='margin-top:4px;background:var(--fond-1);color:var(--texte);border:1px solid var(--bord);border-radius:3px;padding:4px 6px;font:inherit;font-size:11px;width:150px'>"
                     f" <button class=garder style='background:var(--fond-1);color:var(--texte);border:1px solid var(--bord);border-radius:3px;padding:5px 9px;font:inherit;font-size:11px;cursor:pointer'>garder cette animation</button>"
                     f"<div class=cycles-gardes style='margin-top:6px;color:var(--texte-3)'></div></div></div>"
                     f"<script>window.CLIPS=window.CLIPS||{{}};window.CLIPS[{json.dumps(ident)}]={json.dumps(images)};</script></div>")
        parts.append("<div style='padding:6px 9px 0;font-size:10.5px;color:var(--texte-3)'>la bande brute — le mouvement</div>")
        parts.append(_notation(ECHECS))
        pixel = _bande_pixel(dossier)
    elif ligne.get("echec"):
        parts.append(f"<div class='anim vide'>l'appel n'a pas abouti<br>{html.escape(str(ligne['echec']))}</div>")
    else:
        parts.append("<div class='anim vide'>pas encore tiré</div>")
    parts.append("</div>")
    if pixel:
        parts.append(f"<div class=tirage data-id='{nom}~pixel:clip{index}' style='margin:-10px 0 18px;border-top:0'>"
                     f"<div class=tete><span>clip {index} · la bande pixelisée — la chaîne du produit</span></div>"
                     f"<div class=anim>{image_animee(pixel)}</div>"
                     + _notation(ECHECS[-3:]) + "</div>")
    for anime, bande in _bandes_nommees(dossier):
        parts.append(f"<div class=tirage data-id='{nom}~{anime}:clip{index}' style='margin:-10px 0 18px;border-top:0'>"
                     f"<div class=tete><span>clip {index} · « {html.escape(anime)} », pixelisée</span></div>"
                     f"<div class=anim>{image_animee(bande)}</div>"
                     + _notation(ECHECS[-3:]) + "</div>")
    return "".join(parts), revenue, pixel is not None


SCRIPT_CYCLE = """
[].forEach.call(document.querySelectorAll('.cycle'), function(z){
 var id=z.getAttribute('data-id'), n=+z.getAttribute('data-n'), images=window.CLIPS[id]||[];
 var img=z.querySelector('.cycle-img'), d=z.querySelector('.debut'), p=z.querySelector('.periode');
 function prelever(){ var debut=+d.value, periode=+p.value, liste=[];
  for(var i=0;i<8;i++){ var k=debut+Math.round(i*periode/8); if(k>=n) k=n-1; liste.push('data:image/png;base64,'+images[k]); }
  z.querySelector('.v-debut').textContent=debut; z.querySelector('.v-periode').textContent=periode;
  window.ANIMER(img, liste);
  [].forEach.call(z.parentNode.querySelectorAll('.bande-images img'), function(i){ var k=+i.getAttribute('data-i'); i.style.outline=(k>=debut&&k<debut+periode)?'2px solid #49B3CE':'none'; });
 }
 d.addEventListener('input', prelever); p.addEventListener('input', prelever); prelever();
 z.querySelector('.figer').addEventListener('click', function(e){ e.stopPropagation();
  var notes=window.NOTES(); notes._choix=notes._choix||{}; notes._choix[id]={debut:+d.value, periode:+p.value}; window.SAUVER();
  z.querySelector('.etat-figer').textContent='cycle gardé dans le relevé — télécharge-le, puis monter_bande_video.py'; });

 // Les animations nommées de ce clip-là : autant que l'auteur en trouve.
 var liste=z.querySelector('.cycles-gardes'), champ=z.querySelector('.nom-cycle');
 function gardes(){ var n=window.NOTES(); n._cycles=n._cycles||{}; n._cycles[id]=n._cycles[id]||[]; return n._cycles[id]; }
 function redessiner(){
  var g=gardes();
  if(!g.length){ liste.innerHTML=''; return; }
  liste.innerHTML=g.map(function(c,i){
   return '<div>· <b>'+c.nom.replace(/</g,'&lt;')+'</b> — images '+c.debut+' à '+(c.debut+c.periode)
    +' <button class=revoir data-i='+i+' style="background:none;border:0;color:var(--signal);cursor:pointer;font:inherit;font-size:11px">revoir</button>'
    +' <button class=oublier data-i='+i+' style="background:none;border:0;color:var(--texte-3);cursor:pointer;font:inherit;font-size:11px">oublier</button></div>'; }).join('');
  [].forEach.call(liste.querySelectorAll('.revoir'), function(b){ b.addEventListener('click', function(e){ e.stopPropagation();
   var c=gardes()[+b.getAttribute('data-i')]; d.value=c.debut; p.value=c.periode; prelever(); }); });
  [].forEach.call(liste.querySelectorAll('.oublier'), function(b){ b.addEventListener('click', function(e){ e.stopPropagation();
   gardes().splice(+b.getAttribute('data-i'), 1); window.SAUVER(); redessiner(); }); });
 }
 z.querySelector('.garder').addEventListener('click', function(e){ e.stopPropagation();
  var nom=(champ.value||'').trim();
  if(!nom){ champ.focus(); z.querySelector('.etat-figer').textContent='donne-lui un nom (marche, repos…)'; return; }
  var g=gardes(), place=g.findIndex(function(c){ return c.nom===nom; });
  var cycle={nom:nom, debut:+d.value, periode:+p.value};
  if(place>=0) g[place]=cycle; else g.push(cycle);
  window.SAUVER(); champ.value=''; redessiner();
  z.querySelector('.etat-figer').textContent='« '+nom+' » gardée — cherche la suivante dans le même clip'; });
 redessiner();
});
"""


_NOM_PARTIEL = "partiel"


def rapport_video(donnees: dict, image: bytes, origine: str, avertissements: list[str],
                  seuls: set[str] | None = None) -> Path:
    """Le rapport. `seuls` n'y garde que ces bancs-là, dans un fichier à part —
    un rapport de trente-sept mégaoctets se lit mal quand on ne veut voir que le
    dernier essai (demande de l'auteur, 2 septembre 2026)."""
    notes = notes_de(ESSAI).get("notes", {})
    choix = notes.get("_choix", {})
    seance = str(donnees.get("_seance", {}).get("date") or "a-sec")
    depart = rejouer()
    temoin = temoin_du_disque(depart, echecs=ECHECS_TEMOIN)
    anciennes = notes_anciennes_du_temoin()
    groupes: dict = {}
    modeles = donnees.get("_fournisseur", {}).get("modeles", {})
    if seuls:
        modeles = {n: m for n, m in modeles.items() if n in seuls}

    colonnes = []
    for nom, modele in modeles.items():
        lignes = {k: v for k, v in donnees.get(nom, {}).items() if k.startswith("clip")}
        cout = sum(float(l.get("cout_usd") or 0) for l in lignes.values())
        cartes, jets, jets_pixel = [], [], []
        for i in range(1, CLIPS + 1):
            carte_html, revenue, a_pixel = _carte_clip(nom, i, lignes.get(f"clip{i}", {}), choix)
            cartes.append(carte_html)
            jets.append({"jet": f"clip{i}", "revenue": revenue})
            if a_pixel:
                jets_pixel.append({"jet": f"clip{i}", "revenue": True})
        groupes[nom] = {"titre": nom, "cout": round(cout, 3), "jets": jets}
        if jets_pixel:
            groupes[f"{nom}~pixel"] = {"titre": f"{nom} pixelisée", "cout": round(cout, 3), "jets": jets_pixel}
        etat = ("prix du jour relevé" if modele.get("prix_usd_par_clip")
                else "à renseigner dans mesures.json")
        colonnes.append(f"<div class=colonne><h3><span><span class=cle>{html.escape(nom)}</span></span><span class=prix>${cout:.3f}</span></h3>"
                        f"<div class=entete-colonne>{html.escape(modele.get('modele') or '—')} · "
                        f"{html.escape(str(modele.get('prix_usd_par_clip') or '?'))} $ le clip · {etat}</div>" + "".join(cartes) + "</div>")

    # Le témoin : les huit planches gpt-image-2, par le socle.
    cartes_temoin = []
    jets_temoin = []
    releve_temoin = temoin.releve
    for jet in range(1, 9):
        c, revenue = _carte(temoin, jet, temoin.dossier / f"jet{jet}.png", releve_temoin.get(f"jet{jet}", {}), anciennes, 8)
        cartes_temoin.append(c)
        jets_temoin.append({"jet": f"jet{jet}", "revenue": revenue})
    groupes["A-temoin"] = {"titre": "le témoin", "cout": round(sum(float(l.get("cout_usd") or 0) for l in releve_temoin.values()), 4), "jets": jets_temoin}

    # Un nom court et stable quand on ne montre qu'une partie : « poses-melees »
    # plutôt que la liste des bancs collée bout à bout.
    sortie = RACINE / (f"rapport-{ESSAI}-{_NOM_PARTIEL}.html" if seuls else f"rapport-{ESSAI}.html")
    parts = [
        "<!doctype html><html lang=fr><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        f"<title>E6 · L'image-vers-vidéo — essai video</title><style>{STYLE}</style><body><div class=page>",
        "<div class=barre><span class=compte id=compte>0 / 0 notées</span>"
        "<span class=part>· <b class=b-bon id=nb-bon>0</b> bonnes · <b class=b-moyen id=nb-moyen>0</b> moyennes · <b class=b-mauvais id=nb-mauvais>0</b> mauvaises</span>"
        "<label><input type=checkbox id=filtre> ne montrer que celles qui restent</label>"
        "<span class=part>survole et tape <b>1</b>, <b>2</b> ou <b>3</b></span>"
        f"<span class=part>séance <b>{html.escape(seance)}</b></span><span class=pousse></span>"
        "<button id=voir-releve>voir le relevé</button><button id=copier>copier mon relevé</button>"
        "<button id=telecharger>télécharger le relevé</button><button id=vider>tout effacer</button>"
        "<span id=alerte hidden class=part style='color:var(--echec);flex-basis:100%'>⚠ ce navigateur ne mémorise pas les notes — télécharge ton relevé avant de fermer.</span></div>"
        "<div id=zone-releve hidden style='margin:-10px 0 24px'><textarea id=releve readonly rows=6 style='width:100%;background:var(--fond-1);color:var(--texte-2);border:1px solid var(--bord);border-radius:3px;padding:10px;font:12px ui-monospace,Consolas,monospace'></textarea></div>",
        "<h1>E6 · L'image-vers-vidéo — le mécanisme de SpriteCook</h1>",
        "<p class=chapeau><b>La question.</b> SpriteCook anime le sprite avec un modèle image-vers-vidéo, extrait des images équidistantes, "
        "détoure, applique une palette commune et assemble. Sur notre nain, via une API, ce chemin donne-t-il une bande de marche utilisable "
        "plus souvent qu'une planche dessinée d'un coup — et à quel prix ?</p>",
        "<p class=chapeau><b>Ce qu'on attend.</b> Une marche lisible sur la majorité des clips, un personnage qui reste lui-même, et un fond assez "
        "uni pour que le détourage du produit passe. Ce qu'on ne sait pas : si le rendu vidéo garde l'allure pixel art, ou s'il la lisse.</p>",
        "<p class=chapeau>Pour chaque clip : la vidéo (lue depuis <code>resultats_video/</code>, à côté de ce fichier), la bande de toutes ses "
        "images, et <b>deux curseurs — début et période</b> — qui prélèvent huit images équidistantes et les montrent animées à 125 ms. "
        "C'est toi qui cales le cycle à l'œil ; « figer ce cycle » le garde dans le relevé, et <code>monter_bande_video.py</code> écrit les huit "
        "PNG et les passe dans la chaîne du produit. La bande pixelisée paraît alors sous la brute, avec sa propre note.</p>",
    ]
    for a in avertissements:
        parts.append(f"<p class=avertissement>⚠ {a}</p>")
    parts.append(f"<h2>L'entrée — {html.escape(origine)}</h2><p class=axe>Agrandie au plus proche voisin jusqu'à 768 px de haut, au centre d'un "
                 f"canevas 1024×576 sur fond gris 235. Le texte, le même pour tous les modèles : <span class=mono style='font-size:11.5px'>{html.escape(PROMPT)}</span></p>"
                 f"<img alt=entrée src='data:image/png;base64,{_b64(image)}' style='max-width:512px;display:block;border:1px solid var(--bord)'>")
    parts.append("<h2 id=verdict>Le verdict — se recalcule à chaque note</h2>"
                 "<div class=tableau><table><thead><tr><th>Groupe</th><th>Clips</th><th>Revenus</th><th>Notés</th><th>Bons</th><th>Moyens</th>"
                 "<th>Mauvais</th><th>% bons</th><th>Engagé</th><th>$ par bon</th><th>Échecs cochés</th></tr></thead><tbody id=verdict-corps></tbody></table></div>"
                 f"<div class=regle><b>La règle de décision, écrite d'avance.</b> {REGLE}<div class=verdict-regle id=verdict-regle></div></div>")
    parts.append("<h2 id=clips>Les clips, modèle par modèle</h2>")
    parts.append(f"<div class=colonnes style='grid-template-columns:repeat({max(1, len(modeles))},minmax(0,1fr))'>" + "".join(colonnes) + "</div>")
    parts.append("<h2 id=temoin>Le témoin — les planches gpt-image-2 déjà sur le disque, même échelle, même vitesse</h2>"
                 "<div class=colonnes style='grid-template-columns:repeat(4,minmax(0,1fr))'>" + "".join(f"<div class=colonne>{c}</div>" for c in cartes_temoin) + "</div>")
    parts.append("<div id=panneau hidden></div>")
    parts.append("</div><script>"
                 f"var ESSAI={json.dumps(ESSAI)}, SEANCE={json.dumps(seance)}, MS={MS}, GROUPES={json.dumps(groupes, ensure_ascii=False)};"
                 f"var REGLE={REGLE_JS};{SCRIPT}{SCRIPT_CYCLE}</script></body></html>")
    sortie.write_text("".join(parts), encoding="utf-8")
    print(f"-> {sortie}  ({sortie.stat().st_size / 1_048_576:.1f} Mo)")
    return sortie


# ── Le lancement ─────────────────────────────────────────────────────────────


async def principal() -> None:
    preparer_sortie()
    parseur = arguments(__doc__.split("\n")[0])
    parseur.add_argument("--prix", action="store_true", help="relire les prix du jour chez OpenRouter avant tout")
    parseur.add_argument("--modeles", help="n'envoyer que ces modeles-la, separes par une virgule (un essai de forme, d'abord)")
    parseur.add_argument("--nom-rapport", help="le nom du rapport partiel : rapport-video-<nom>.html")
    parseur.add_argument("--clips", type=int, help=f"combien de clips par modele (defaut {CLIPS})")
    args = parseur.parse_args()
    donnees = releve(rafraichir=args.prix)
    sprite, origine = sprite_de_depart()
    # L'entrée montrée dans le rapport est celle du format le plus utilisé du banc.
    formats = {taille_demandee(m.get("parametres", {})) for m in donnees["_fournisseur"]["modeles"].values()}
    image = composer_entree(sprite, canevas=min(formats, key=lambda f: f[0] * f[1]))
    (SORTIE / "entree.png").write_bytes(image)
    modeles = donnees["_fournisseur"]["modeles"]
    ok = prets(donnees)
    avertissements: list[str] = []
    manquent = [n for n in modeles if n not in ok]
    if manquent:
        avertissements.append("prix du jour inconnu pour : " + ", ".join(manquent) +
                              " — relancer avec --prix, ou lire pourquoi dans prix_origine "
                              "(essais/resultats_video/mesures.json).")

    from atelier.reglages import lire_secret
    cle = lire_secret(CLE_OR)

    if args.a_sec:
        print(f"=== {ESSAI} — A SEC : rien ne part ===")
        print(f"entree : {origine} · 1024x576, sprite a 768 px de haut, fond gris 235 -> {SORTIE / 'entree.png'}")
        print(f"texte  : {PROMPT}")
        print(f"cle    : {CLE_OR} {'presente dans .env' if cle else 'ABSENTE de .env'} · plafond ${PLAFOND_USD:.2f}")
        total = 0.0
        for nom, m in modeles.items():
            faits = sum(1 for i in range(1, CLIPS + 1) if (SORTIE / nom / f"clip{i}" / "clip.mp4").exists())
            a_faire = CLIPS - faits
            prix = m.get("prix_usd_par_clip")
            print(f"\n--- {nom} ---")
            print(f"    modele   : {m.get('modele') or 'INCONNU'}")
            print(f"    prix     : {str(prix) + ' $ le clip (estime) — ' + str(m.get('prix_origine')) if prix else 'INCONNU'}")
            taille = taille_demandee(m.get("parametres", {}))
            entree_m = composer_entree(sprite, canevas=taille)
            print(f"    rendu    : {taille[0]}x{taille[1]} px")
            print(f"    corps    : prompt + frame_images[first_frame] (data:image/png, "
                  f"{len(entree_m) / 1024:.0f} Ko, {taille[0]}x{taille[1]}) + {json.dumps(m.get('parametres', {}))}")
            if m.get("prompt") and m["prompt"] != PROMPT:
                print(f"    texte    : {m['prompt']}")
            cout = f"cout {a_faire * float(prix):.3f} $" if prix else "cout inconnu tant que le prix manque"
            print(f"    clips    : {a_faire} a faire sur {CLIPS} ({faits} deja la) · {cout}")
            if prix:
                total += a_faire * float(prix)
        print(f"\ncout engage si tout est renseigne : ${total:.3f} · partirait : {', '.join(ok) or 'AUCUN modele — le script refuserait'}")
    elif not args.rapport:
        if not ok:
            print("[x] aucun modele n'a son prix du jour : rien ne part (--prix pour les relire).")
            print(f"    -> {MESURES}")
            return
        if not cle:
            print(f"[x] {CLE_OR} absent de .env : rien ne part.")
            return
        print(f"entree : {origine} · plafond ${PLAFOND_USD:.2f} · modeles prets : {', '.join(ok)}\n")
        seuls = {n.strip() for n in args.modeles.split(",")} if args.modeles else None
        if seuls and (inconnus := seuls - set(ok)):
            print(f"[x] modeles inconnus ou sans prix : {', '.join(sorted(inconnus))}")
            return
        await tirer(donnees, sprite, cle, seuls, args.clips)

    seuls_rapport = {n.strip() for n in args.modeles.split(",")} if args.modeles else None
    if seuls_rapport:
        globals()["_NOM_PARTIEL"] = args.nom_rapport or "partiel"
    rapport_video(donnees, image, origine, avertissements, seuls_rapport)


if __name__ == "__main__":
    asyncio.run(principal())
