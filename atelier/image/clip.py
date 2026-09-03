# -*- coding: utf-8 -*-
"""Lire un clip et en tirer ses images. Le seul endroit du produit qui décode.

**Pourquoi un décodeur entre dans le dépôt, et pourquoi il est optionnel** (A9).
Un clip est un conteneur vidéo. Rien de ce qui était déjà là ne sait l'ouvrir :
Pillow lit des images fixes, `numpy` des tableaux, et le produit n'a jamais eu
besoin d'autre chose. Il n'y avait donc pas de « remplacer par ce qui est déjà
dans le dépôt » possible, et la dépendance est déclarée plutôt que subie.

`imageio` + `imageio-ffmpeg` : deux paquets BSD, qui embarquent un binaire
`ffmpeg` sous licence LGPL. Ils étaient déjà là pour l'essai E6 ; ce qui change
est qu'ils entrent dans le produit.

**Optionnel, sur le modèle exact du second détoureur** (`traitement.py`) : le
binaire pèse plusieurs dizaines de mégaoctets, et un atelier doit pouvoir
s'installer sans lui. Absent, ce module dit pourquoi en une phrase française, et
**le reste du produit continue** — commander un clip, le payer, le garder, le
récupérer et le revoir marchent sans décodeur. Seul le prélèvement d'images
attend. C'est ce qui fait qu'un clip payé n'est jamais perdu parce qu'il manque
une bibliothèque.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# La cadence à laquelle on se rabat quand le fichier ne la déclare pas. C'est
# celle qu'annoncent les modèles retenus ; elle sert à afficher une durée, pas à
# découper — le montage travaille sur des **numéros d'image**, jamais sur des
# secondes, et ne dépend donc pas de ce chiffre.
CADENCE_PAR_DEFAUT = 24.0


@dataclass(frozen=True, slots=True)
class MesureClip:
    """Ce qu'un clip porte, **mesuré sur le fichier** et jamais déduit du tarif.

    Même invariant que pour une image : ce qui a été demandé ne fait pas foi. Un
    modèle facturé sur cinq secondes à vingt-quatre images peut rendre un clip
    de quatre secondes et demie à trente images, et c'est ce qu'il a rendu qui
    entre dans la bibliothèque.
    """

    images: int
    cadence: float
    largeur: int = 0
    hauteur: int = 0

    @property
    def secondes(self) -> float:
        return round(self.images / self.cadence, 2) if self.cadence else 0.0


def composer_entree(
    sprite: bytes, canevas: tuple[int, int], part: float = 0.80
) -> bytes:
    """Le sprite agrandi au plus proche voisin, **entier dans** une toile grise.

    **Un sprite ne part pas tel quel.** Un modèle vidéo travaille en 480 px ou
    plus ; lui envoyer un sprite de 64 px, c'est lui demander d'inventer tout ce
    qu'il ne voit pas. Le sujet est donc agrandi jusqu'à occuper les quatre
    cinquièmes de la toile, sur le gris de fond que le produit utilise déjà pour
    ses planches — celui que les modèles rendent d'eux-mêmes, et que le
    détourage sait retirer.

    **Le facteur est entier**, dans un sens comme dans l'autre. Un facteur
    quelconque rendrait les pixels rectangulaires, et le modèle animerait une
    grille tordue.

    **Le corps tient dans la toile sur ses deux dimensions**, et c'est écrit
    comme un refus plutôt que laissé au hasard : le premier essai du 2 septembre
    2026 est parti avec un personnage coupé au genou et à la tête, parce que la
    hauteur visée dépassait celle de la toile. Un clip payé, pour rien.
    """
    import io

    from PIL import Image

    from atelier.domaine.recette import Passe, Recette
    from atelier.image.pliage import FOND
    from atelier.image.traitement import detourer

    with Image.open(io.BytesIO(sprite)) as ouverte:
        image = ouverte.convert("RGBA")
    # **Le sujet, pas la toile.** Une image sans transparence a pour boîte
    # l'image entière : son fond partirait sur la toile, et le modèle animerait
    # ce rectangle-là autant que le personnage. Le détourage du produit dit où
    # est le sujet, ici comme partout ailleurs.
    if image.getchannel("A").getextrema()[0] == 255:
        image = Image.fromarray(
            detourer(Recette(passes=(Passe(moteur="bord"),)), sprite), "RGBA"
        )
    image = image.crop(image.getbbox() or (0, 0, image.width, image.height))

    vise = (int(canevas[0] * part), int(canevas[1] * part))
    facteur = min(vise[1] // image.height, vise[0] // image.width)
    if facteur >= 1:
        sujet = image.resize(
            (image.width * facteur, image.height * facteur), Image.Resampling.NEAREST
        )
    else:
        # Plus grand que la toile — un artwork officiel fait souvent 1024 px. On
        # divise par un entier, pour la raison qui fait multiplier par un entier.
        diviseur = 1
        while image.width // (diviseur + 1) > 0 and (
            image.height // diviseur > vise[1] or image.width // diviseur > vise[0]
        ):
            diviseur += 1
        sujet = image.resize(
            (image.width // diviseur, image.height // diviseur),
            Image.Resampling.NEAREST,
        )

    if sujet.width > canevas[0] or sujet.height > canevas[1]:
        raise ValueError(
            f"le sujet mis à l'échelle ({sujet.width}×{sujet.height}) ne tient pas "
            f"dans une toile de {canevas[0]}×{canevas[1]}"
        )
    toile = Image.new("RGB", canevas, FOND)
    toile.paste(
        sujet, ((canevas[0] - sujet.width) // 2, (canevas[1] - sujet.height) // 2), sujet
    )
    tampon = io.BytesIO()
    toile.save(tampon, format="PNG")
    return tampon.getvalue()


def indisponible() -> str | None:
    """Pourquoi les images d'un clip ne peuvent pas être tirées, ou `None`.

    La phrase va telle quelle sous le bouton grisé. Elle nomme ce qu'il faut
    installer : un message qui dirait seulement « indisponible » obligerait à
    lire le code pour le réparer.
    """
    try:
        import imageio.v3  # noqa: F401
    except ImportError:
        return (
            "le lecteur de vidéos n'est pas installé — "
            'pip install -e ".[video]" l\'ajoute (imageio et son ffmpeg)'
        )
    try:
        import imageio_ffmpeg  # noqa: F401
    except ImportError:
        return (
            "le décodeur ffmpeg n'est pas installé — "
            'pip install -e ".[video]" l\'ajoute'
        )
    return None


def mesurer(chemin: Path) -> MesureClip:
    """Combien d'images ce clip porte, et à quelle cadence.

    Lève `ValueError` si le fichier n'est pas lisible comme vidéo — ce qui est
    une raison d'échec comme une autre, à afficher en clair. **Un clip illisible
    reste un clip payé** : c'est l'appelant qui garde la dépense, pas ce module
    qui la connaît.
    """
    return _parcourir(chemin, None)


def extraire(chemin: Path, dossier: Path) -> MesureClip:
    """Toutes les images du clip en PNG dans `dossier`, numérotées à partir de 0.

    **Une fois, à l'arrivée, et plus jamais** (A9). Un clip de cinq secondes
    porte une centaine d'images ; les redécoder à chaque ouverture de l'éditeur
    de montage rendrait le geste central de la version — faire glisser une
    fenêtre sur la pellicule — trop lent pour être fait à l'œil.

    Le nom porte le numéro sur quatre chiffres pour que l'ordre alphabétique du
    disque soit l'ordre du clip. Sans ça, l'image 10 se range avant la 2, et une
    animation montée depuis le dossier part à l'envers.
    """
    dossier.mkdir(parents=True, exist_ok=True)
    return _parcourir(chemin, dossier)


def _parcourir(chemin: Path, dossier: Path | None) -> MesureClip:
    """Le clip, image par image, **décodé une seule fois**.

    Mesurer et extraire sont le même parcours : compter les images oblige à les
    décoder toutes, et le faire deux fois doublerait l'attente pour rien. Passer
    un dossier les écrit au passage ; ne rien passer les compte seulement, sans
    jamais garder plus d'une image en mémoire — une centaine d'images de 480 px
    tiendrait quatre-vingts mégaoctets si on les gardait toutes.
    """
    manque = indisponible()
    if manque:
        raise ValueError(manque)
    import imageio.v3 as iio
    from PIL import Image

    cadence = CADENCE_PAR_DEFAUT
    try:
        meta = iio.immeta(chemin)
    except Exception:  # noqa: BLE001 — la cadence est un confort, pas une condition
        meta = {}
    if meta.get("fps"):
        cadence = float(meta["fps"])

    nombre = 0
    largeur = hauteur = 0
    try:
        for image in iio.imiter(chemin):
            if nombre == 0:
                hauteur, largeur = int(image.shape[0]), int(image.shape[1])
            if dossier is not None:
                Image.fromarray(image).save(dossier / f"{nombre:04d}.png")
            nombre += 1
    except Exception as erreur:  # noqa: BLE001 — le lecteur lève large
        raise ValueError(f"fichier illisible comme vidéo — {erreur}") from None

    if nombre == 0:
        raise ValueError("le clip ne porte aucune image")
    return MesureClip(
        images=nombre, cadence=cadence, largeur=largeur, hauteur=hauteur
    )
