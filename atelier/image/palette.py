# -*- coding: utf-8 -*-
"""D'où vient la palette d'un univers — CPU, pure, aucune entrée-sortie.

« La palette se déduit par calcul des artworks officiels » (`docs/archive/plan-versions-tenues.md`, T4).
Ce module est ce calcul, et rien d'autre : il reçoit des octets d'images, il rend
des couleurs en hexadécimal. Il ne lit aucun fichier, n'appelle aucun modèle, et
ne touche jamais le réseau — c'est ce qui fait que « retirer un artwork officiel
recalcule la palette » marche réseau coupé.

**La coupe médiane, comme pour la quantification, et pour la même raison.**
« Chaque étape est déterministe, et c'est un critère » (`AGENTS.md`) : une
initialisation tirée au sort donnerait deux palettes différentes pour les mêmes
artworks, donc deux rendus différents pour la même recette. La coupe médiane de
Pillow ne tire rien au sort. Vérifié : deux appels rendent la même palette, et
l'ordre des artworks ne la change pas.

**Le fond ne fait pas partie de la palette, et ça s'est mesuré.** Premier essai,
sur les deux planches de `essais/guide/` : la coupe médiane appliquée aux images
telles quelles a rendu **vingt gris sur vingt-quatre** — `#e0e0e0`, `#e1e1e1`,
`#dedede`… Le fond plat occupe 75 % des pixels, son anti-crénelage l'éclate en
autant de seaux, et la palette ne disait plus rien du sujet. C'est le même piège
qu'un détourage au seuil global : *ce qui est majoritaire n'est pas ce qui
compte*.

**On détoure donc d'abord, avec le moteur du geste courant.** Le remplissage
depuis le bord — celui qui ne charge aucun modèle et marche hors ligne — retire
le fond relié au bord, et la palette se calcule sur ce qui reste. Mesuré sur les
mêmes deux planches : 24 % des pixels survivent, et la palette passe de 7 à 15
couleurs franchement distinctes, toutes prises dans le sujet. Corollaire hérité,
et assumé : **une région fermée reste opaque**, donc l'intérieur d'un cadre
d'interface entre dans la palette. C'est la même règle qui sauve le squelette.

**Chaque artwork pèse le même poids.** Une planche de 2048 px et une vignette de
256 px ramenées à la même vue : sans ça, la plus grande écrirait la palette à
elle seule, et promouvoir une seconde carte ne changerait rien de visible — or
« retirer un artwork officiel recalcule la palette, et le changement se voit »
est un critère.
"""

from __future__ import annotations

import io
from typing import Sequence

import numpy as np
from PIL import Image

from atelier.image.traitement import detourer_bord, durcir
from atelier.domaine.recette import (
    COTE_DE_LA_TRAME,
    FLOYD,
    KMOYENNES,
    MEDIANE,
    OCTREE,
    OEIL,
    SEUIL_ALPHA,
    TRAME,
    algorithme_connu,
)

# Le côté auquel chaque artwork est ramené avant d'entrer dans le calcul.
# 192 px : assez pour que les aplats d'un sprite pèsent leur vraie part, assez
# petit pour que dix artworks se calculent en moins d'une seconde. Ramener au
# **même** côté est ce qui donne à chaque artwork le même poids.
VUE = 192

# La tolérance du détourage préalable. Celle de `Passe` par défaut : c'est le
# même geste, et un second réglage ici serait un second endroit où la même
# question se répond.
TOLERANCE = 28

# Le plus grand côté de l'aperçu qui montre ce que ce module lit. 720 px : assez
# pour qu'un titre d'interface de vingt pixels reste lisible sur une capture de
# mille, assez petit pour que l'image tienne dans un menu de carte sans peser
# plus que la carte elle-même.
APERCU = 720

# Ce qui marque, dans cet aperçu, les pixels que la palette écarte. **Une
# couleur d'instrument, pas une couleur du produit** : elle n'entre dans aucune
# liste fermée de `docs/DESIGN.md`, parce qu'elle est choisie pour n'exister
# nulle part ailleurs — un magenta pur ne se confond avec aucun pixel d'un
# artwork de jeu, et c'est tout ce qu'on lui demande.
MAGENTA = (255, 0, 255, 255)

# Combien de couleurs une palette d'univers porte par défaut. Mesuré le
# 27 août 2026 sur les deux planches du guide : 24 demandées rendent 15 couleurs
# franchement distinctes, 32 en rendent 18, 48 n'en rendent que 22 — la coupe
# médiane sature. En dessous de 16 le vocabulaire s'appauvrit visiblement. 24
# est le point où l'on paie encore chaque couleur qu'on demande.
COULEURS = 24
COULEURS_MIN = 4
COULEURS_MAX = 64


def _vue(rgba: np.ndarray, cote: int = VUE) -> np.ndarray:
    """L'artwork ramené à une vue de `cote` au plus grand côté.

    `BOX` et non `NEAREST` : ici on ne fabrique pas un sprite, on échantillonne
    une matière. Moyenner sur la surface rend la part réelle de chaque teinte ;
    prendre le plus proche voisin en perdrait une sur deux.
    """
    image = Image.fromarray(rgba, mode="RGBA")
    facteur = cote / max(image.width, image.height)
    if facteur >= 1:
        return rgba
    taille = (max(1, round(image.width * facteur)), max(1, round(image.height * facteur)))
    return np.asarray(image.resize(taille, Image.Resampling.BOX))


def alpha_du_sujet(octets: bytes) -> np.ndarray:
    """L'opacité de ce que ce module lit d'un artwork, à sa taille d'origine.

    **Le seul endroit qui décide ce qui compte dans une palette**, et c'est ce
    qui le rend partageable : la découpe d'une carte propose ses rectangles sur
    cet alpha-là, et l'aperçu montre exactement ce qu'il retient. Trois écrans
    qui recalculeraient chacun leur détourage finiraient par montrer trois
    choses différentes de la même image.

    Le détourage n'est pas conservé : c'est une lecture, pas une retouche.
    L'artwork sur le disque n'est jamais modifié — le tableau d'inspiration ne
    traite rien, il rassemble.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    neuf = detourer_bord(rgba[:, :, :3], TOLERANCE)
    return durcir(np.minimum(rgba[:, :, 3], neuf), SEUIL_ALPHA)


def _sujet(octets: bytes) -> np.ndarray:
    """Les pixels opaques d'un artwork, une fois son fond retiré."""
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()
    rgba[:, :, 3] = alpha_du_sujet(octets)

    vue = _vue(rgba).reshape(-1, 4)
    opaques = vue[vue[:, 3] >= SEUIL_ALPHA][:, :3]
    # Un artwork que le détourage a entièrement mangé — une matière plein cadre,
    # une texture sans bord franc — compte quand même : il vaut mieux sa palette
    # entière que rien du tout.
    return opaques if opaques.size else vue[:, :3]


def part_lue(octets: bytes) -> float:
    """Quelle part de cet artwork nourrit la palette, en pour cent.

    **Zéro n'est pas un trou, c'est un cas nommé** : le détourage a tout mangé —
    une matière plein cadre, une texture sans bord franc —, et `_sujet` reprend
    alors l'image entière. L'appelant qui affiche ce chiffre doit dire cette
    phrase-là plutôt que « 0 % », qui serait faux.

    Mesurée sur la **vue**, celle de 192 px, et pas sur l'image d'origine : c'est
    elle qui entre dans la coupe médiane, donc c'est elle qui pèse. Sur une image
    de mille pixels, les deux ne donnent pas le même chiffre.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()
    rgba[:, :, 3] = alpha_du_sujet(octets)
    vue = _vue(rgba).reshape(-1, 4)
    if not vue.shape[0]:
        return 0.0
    return float((vue[:, 3] >= SEUIL_ALPHA).sum()) / vue.shape[0] * 100


def apercu_de_la_lecture(octets: bytes, *, cote: int = APERCU) -> bytes:
    """L'artwork, avec en magenta ce que la palette en écarte. Un PNG.

    **C'est la seule chose que la lecture de palette ait jamais eu à gagner.**
    Le détourage préalable existe depuis le premier jour, il est juste, et
    personne ne l'a jamais vu — il ne laisse aucune trace. Mesuré sur les
    artworks de ce dépôt : il écarte de 30 à 60 % des pixels, et sur une capture
    d'écran promue en artwork il garde le titre de l'interface et la barre de
    vie, qui écrivent alors les couleurs du jeu. Cet aperçu est ce qui le fait
    découvrir.

    **Magenta, et il n'entre dans aucune liste fermée** : ce n'est pas une
    couleur du produit, c'est une couleur d'instrument — celle qu'on emploie
    précisément parce qu'elle n'existe nulle part ailleurs et ne peut donc pas
    être confondue avec un pixel de l'image. Elle ne vit que dans cette image-ci,
    jamais dans un écran.
    """
    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA")).copy()
    rgba[alpha_du_sujet(octets) < SEUIL_ALPHA] = MAGENTA

    image = Image.fromarray(rgba, mode="RGBA").convert("RGB")
    facteur = cote / max(image.width, image.height)
    if facteur < 1:
        # `BOX` et non `NEAREST` : on montre une **part**, et moyenner sur la
        # surface est ce qui la rend lisible. Le plus proche voisin ferait
        # clignoter une zone mitée là où elle est écartée à moitié.
        image = image.resize(
            (max(1, round(image.width * facteur)), max(1, round(image.height * facteur))),
            Image.Resampling.BOX,
        )
    # **Réduit à 128 couleurs, et c'est un instrument qu'on allège.** L'aperçu
    # n'est pas une image du jeu : on y cherche une forme — ce qui reste, ce qui
    # part —, pas une teinte. Un PNG plein sur une capture de mille pixels pèse
    # 270 Ko, ce qui est plus lourd que la carte elle-même ; réduit, il en pèse
    # une fraction. **Et la réduction ne peut pas mentir sur le magenta** : une
    # couleur qui occupe un tiers de l'image est toujours dans les 128 premières
    # de la coupe médiane, alors qu'un JPEG lui ferait un halo sur le bord exact
    # qu'on vient regarder.
    tampon = io.BytesIO()
    image.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(
        tampon, format="PNG", optimize=True
    )
    return tampon.getvalue()


def palette_de(artworks: list[bytes], couleurs: int = COULEURS) -> tuple[str, ...]:
    """La palette de ces artworks-là. Déterministe, et sans un octet de réseau.

    Rend des couleurs en hexadécimal minuscule — la forme que `Quantification`
    attend, et celle qu'un humain relit dans `projet.json`.

    Aucun artwork ne rend une palette vide, et c'est **l'état réel** : « un
    univers vide ne contraint rien » (US-57). C'est ce vide-là que
    `raison_quantification()` transforme en grisé.
    """
    if not artworks:
        return ()

    morceaux = [pixels for pixels in map(_sujet, artworks) if pixels.size]
    if not morceaux:
        return ()

    # Une bande d'une seule ligne : la coupe médiane ne regarde que des
    # couleurs, jamais la géométrie. Empiler en hauteur ne changerait rien au
    # résultat et coûterait un remplissage.
    bande = np.concatenate(morceaux).reshape(1, -1, 3)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=max(COULEURS_MIN, min(COULEURS_MAX, couleurs)),
        method=Image.Quantize.MEDIANCUT,
    )

    # `getpalette()` rend toujours 256 entrées ; seules celles qu'un pixel
    # utilise vraiment sont des couleurs. Publier les autres remplirait la
    # palette de noirs que personne n'a demandés.
    plate = indexee.getpalette() or []
    utilisees = sorted(set(indexee.tobytes()))
    return tuple(
        "#%02x%02x%02x" % tuple(plate[rang * 3 : rang * 3 + 3]) for rang in utilisees
    )


# ── La fusion de deux palettes, arrivée en E11 ───────────────────────────────
#
# **Ces trois fonctions viennent du banc d'essai**, où elles ont été mesurées
# avant d'entrer dans le produit — `essais/essai_couleurs_et_taches.py`, le
# 31 août 2026. Le banc a répondu à la question qui bloquait la tranche : les
# deux curseurs ne font-ils pas le même travail ? Croisés sur six images et cinq
# valeurs chacun, ils rendent **21 résultats distincts sur 25 combinaisons**. Et
# il a trouvé le seul endroit où l'attraction meurt : à proportion « tout du
# jeu », il ne reste aucune couleur d'ambiance à tirer.
#
# La mesure d'abord, le code ensuite : c'est la deuxième fois que ce produit
# évite d'écrire un réglage qui ne ferait rien — le nombre de couleurs de la
# quantification, lui, avait été écrit avant d'être mesuré, et il ne changeait
# rien dès qu'une palette était posée.


def _rgb(hexa: str) -> tuple[int, int, int]:
    entier = int(hexa.lstrip("#"), 16)
    return (entier >> 16 & 255, entier >> 8 & 255, entier & 255)


def _hexa(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(float(c))) for c in rgb)


# Le côté d'une pastille dans la bande envoyée au modèle, et le nombre de
# pastilles par rangée. 64 px : assez grand pour qu'un modèle qui rééchantillonne
# à 512 voie encore des aplats francs, assez petit pour que seize couleurs
# tiennent dans une image de 1 024 de large — la taille des planches du produit.
PASTILLE = 64
PAR_RANGEE = 16


def bande_de_palette(couleurs: tuple[str, ...] | list[str]) -> bytes:
    """Une palette rendue **en image** — des pastilles pleines, et rien d'autre.

    **Une palette part en image, jamais en texte** (E14, tranché le 30 août
    2026). Une liste de codes hexadécimaux ajoutée au prompt est mal suivie par
    les modèles, et elle allongerait un texte qui pèse déjà la moitié de
    l'appel : sur le plus long appel payé du dépôt, les textes de style font
    890 caractères sur 1 690. Une bande d'aplats, elle, est ce que les modèles
    d'image suivent le mieux, et l'atelier la dessine déjà à l'écran.

    **Elle se redessine, elle ne se relit jamais** — exactement comme le gabarit
    d'une planche (`ServiceGenerations._jointes`) : elle n'est ni un asset ni une
    carte, elle n'a pas d'identifiant, elle n'est nulle part sur le disque, et
    elle se refabrique à l'identique depuis la liste de couleurs. L'appel et la
    relance envoient donc la même image.

    **Elle occupe une place de référence, et elle coûte** chez les modèles qui
    facturent au token. Le compte des références la compte donc comme une image
    de plus : l'oublier ferait mentir le grisé au moment précis où l'appel est le
    plus cher.

    Aucun texte, aucun nombre, aucune bordure : ce qui n'est pas une couleur dans
    cette image serait une couleur de plus pour le modèle.
    """
    lues = [c for c in couleurs if c]
    if not lues:
        raise ValueError("une bande de palette sans couleur n'est pas une image")
    colonnes = min(PAR_RANGEE, len(lues))
    rangees = (len(lues) + colonnes - 1) // colonnes
    # La dernière rangée est complétée par sa dernière couleur plutôt que par du
    # blanc : une case vide serait un aplat que la palette ne contient pas, et le
    # modèle le prendrait pour une couleur du jeu.
    remplie = lues + [lues[-1]] * (colonnes * rangees - len(lues))
    pixels = np.array(
        [[_rgb(c) for c in remplie[r * colonnes : (r + 1) * colonnes]]
         for r in range(rangees)],
        dtype=np.uint8,
    )
    image = Image.fromarray(pixels, mode="RGB").resize(
        (colonnes * PASTILLE, rangees * PASTILLE), Image.NEAREST
    )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def reduire(palette: tuple[str, ...], combien: int) -> tuple[str, ...]:
    """Les `combien` couleurs de cette palette-là, **prises dans la palette**.

    **Par la coupe médiane, comme le reste du produit** : `palette_de` réduit
    déjà les couleurs d'un artwork de cette façon, et prendre les N premières à
    la place donnerait un résultat qui dépend de l'ordre d'écriture du fichier.

    **Puis chaque seau revient à la couleur réelle la plus proche.** La coupe
    médiane rend des moyennes — le milieu d'un seau —, et une moyenne n'est
    l'une des couleurs d'aucune source : la pastille dirait « venue du jeu » en
    montrant une teinte que le jeu ne porte pas. Le raccrochage tient la promesse
    de la maquette au pied de la lettre : *chaque couleur du résultat est
    authentiquement l'une de celles d'une source*. C'est le seul écart avec le
    banc d'essai, et il ajoute une garantie plutôt qu'il n'en retire.
    """
    if combien <= 0:
        return ()
    if combien >= len(palette):
        return tuple(palette)
    reelles = np.array([_rgb(c) for c in palette], dtype=np.int16)
    bande = np.array([[_rgb(c) for c in palette]], dtype=np.uint8)
    indexee = Image.fromarray(bande, mode="RGB").quantize(
        colors=combien, method=Image.Quantize.MEDIANCUT
    )
    plate = indexee.getpalette() or []
    vues: set[str] = set()
    gardees: list[str] = []
    for rang in sorted(set(indexee.tobytes())):
        milieu = np.array(plate[rang * 3 : rang * 3 + 3], dtype=np.int16)
        proche = palette[int(np.argmin(((reelles - milieu) ** 2).sum(axis=1)))]
        if proche not in vues:
            vues.add(proche)
            gardees.append(proche)
    return tuple(gardees)


def attirer(
    ambiance: tuple[str, ...], jeu: tuple[str, ...], part: float
) -> tuple[str, ...]:
    """Chaque couleur de l'ambiance tirée vers la plus proche de celles du jeu.

    `part` va de 0 — rien ne bouge — à 1 — la couleur *devient* celle du jeu.
    C'est ce qui harmonise : le marais reste un marais, mais il respire l'air du
    jeu. La distance est euclidienne dans RGB, comme partout ailleurs ici.
    """
    if not jeu or part <= 0:
        return tuple(ambiance)
    cibles = np.array([_rgb(c) for c in jeu], dtype=np.int16)
    tirees = []
    for couleur in ambiance:
        source = np.array(_rgb(couleur), dtype=np.int16)
        proche = cibles[int(np.argmin(((cibles - source) ** 2).sum(axis=1)))]
        tirees.append(_hexa(source + (proche - source) * part))
    return tuple(tirees)


def fusionner(
    jeu: tuple[str, ...],
    ambiance: tuple[str, ...],
    total: int,
    du_jeu: int,
    attraction: float,
) -> tuple[tuple[str, str], ...]:
    """La palette d'une ambiance : `du_jeu` couleurs du jeu, le reste attiré.

    Rend **chaque couleur avec sa provenance** — `jeu` ou `ambiance` —, parce
    que c'est la seule façon de comprendre ce qu'on regarde : sans ces marques,
    on ne saurait pas si un gris vient du jeu, donc si le changer serait une
    exception ou une redite.

    Le dédoublonnage est la seule liberté prise sur la maquette, et elle est
    forcée : à forte attraction, deux couleurs de l'ambiance tombent sur la même
    couleur du jeu, et une palette qui répète une entrée n'est pas une palette.
    C'est aussi ce qui rend le compte **plus court que demandé** aux fortes
    valeurs — le produit l'affiche plutôt que de le taire.
    """
    proches = attirer(reduire(ambiance, total - du_jeu), jeu, attraction)
    vues: set[str] = set()
    sortie: list[tuple[str, str]] = []
    for couleur, venue in (
        *((c, "jeu") for c in reduire(jeu, du_jeu)),
        *((c, "ambiance") for c in proches),
    ):
        if couleur not in vues:
            vues.add(couleur)
            sortie.append((couleur, venue))
    return tuple(sortie)


# ═════════════════════════════════════════════════════════════════════════════
# Les algorithmes de palette, et la seule façon de poser ce qu'ils choisissent
# ═════════════════════════════════════════════════════════════════════════════
#
# **Un algorithme de quantification de palette choisit des couleurs ; il ne
# peint rien.** C'est l'invariant de `B18`, et c'est lui qui range tout le reste :
#
#     (pixels (N,3) uint8, couleurs int) ─▶ palette (K,3) uint8, K ≤ couleurs
#
# Trois implémentations — coupe médiane, k-moyennes, découpe en huit —, et
# **une** carte des pixels sur la palette, **un** tramage, **une** distance,
# **une** protection des couleurs gardées. Écrire la distance à l'œil trois fois,
# une par algorithme, aurait garanti que les trois finissent par ne plus répondre
# pareil sur la même image ; le dépôt paie déjà cette leçon-là ailleurs
# (`NOM_DU_MOTEUR`, tenu d'accord avec l'écran par un essai).
#
# **Aucune de ces fonctions ne lit l'alpha.** Elles reçoivent les pixels qui
# comptent — c'est l'appelant qui décide si ce sont tous les pixels ou seulement
# les visibles — et rendent des couleurs. C'est ce qui fait que « ne compter que
# ce qu'on voit » est un réglage d'une ligne au lieu d'un chemin parallèle.


def _en_oklab(rgb: np.ndarray) -> np.ndarray:
    """Des couleurs sRGB (…,3) portées dans OKLab, en flottants.

    **La distance « à l'œil » du produit, et il n'y en a qu'une.** OKLab plutôt
    que CIE Lab : à écart euclidien égal, deux couleurs y sont perçues aussi
    différentes l'une de l'autre dans tout l'espace, ce que Lab tient mal dans
    les bleus — précisément là où la panne de la planche se voit (*« le vert vif
    de la grenouille peut partir sur un gris-vert terne parce qu'il en est proche
    au calcul »*).

    **Sans passer par la linéarisation exacte du sRGB.** La courbe de transfert
    est approchée par un gamma de 2,2 : l'écart avec la vraie courbe est sous le
    demi-cran de quantification sur toute la plage, il ne déplace aucune couleur
    d'une palette, et il économise deux comparaisons par canal et par pixel sur
    une image d'un million de pixels.
    """
    lineaire = (rgb.astype(np.float32) / 255.0) ** 2.2
    l = lineaire @ np.array([0.4122215, 0.5363325, 0.0514460], dtype=np.float32)
    m = lineaire @ np.array([0.2119035, 0.6806995, 0.1073970], dtype=np.float32)
    s = lineaire @ np.array([0.0883025, 0.2817188, 0.6299787], dtype=np.float32)
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack(
        [
            0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
        ],
        axis=-1,
    )


def _mesurables(pixels: np.ndarray, a_l_oeil: bool) -> np.ndarray:
    """Les couleurs dans l'espace où l'on va mesurer les écarts."""
    return _en_oklab(pixels) if a_l_oeil else pixels.astype(np.float32)


# Combien de pixels au plus entrent dans le choix d'une palette. **Un plafond de
# calcul, pas un réglage** : au-delà, on tire un pixel sur k à pas régulier.
#
# **Le pas est régulier et non tiré au sort**, et c'est ce qui garde la promesse
# du produit — *la même recette rend toujours le même pixel*. Un échantillon
# aléatoire, même à graine fixée, changerait de composition dès que l'image
# change d'un pixel de large.
#
# 300 000 : mesuré, k-moyennes tient alors sous les 240 ms de `B16` sur un dessin
# de 2 048 px, là où l'image entière — 4,2 millions de pixels — coûtait plusieurs
# secondes. Un histogramme de 300 000 pixels décrit une palette de 256 couleurs
# très largement au-delà de ce que l'œil distingue sur le résultat.
PIXELS_AU_PLUS = 300_000


def _echantillon(pixels: np.ndarray) -> np.ndarray:
    """Au plus `PIXELS_AU_PLUS` pixels, pris à pas régulier. Déterministe."""
    if pixels.shape[0] <= PIXELS_AU_PLUS:
        return pixels
    return pixels[:: (pixels.shape[0] + PIXELS_AU_PLUS - 1) // PIXELS_AU_PLUS]


def par_coupe_mediane(pixels: np.ndarray, couleurs: int) -> np.ndarray:
    """L'espace coupé en deux, puis en deux — **ce que le produit fait déjà**.

    Elle passe par Pillow, comme `quantifier` et `palette_de` : trois façons de
    couper une médiane dans le même dépôt finiraient par rendre trois palettes.

    **Puis chaque seau revient à la couleur réelle la plus proche**, comme les
    deux autres algorithmes. La coupe médiane rend le *milieu* d'un seau, et un
    milieu n'est la couleur d'aucune source : c'est la règle que `reduire` tient
    déjà pour la fusion de deux palettes, et la planche la pose pour tout
    l'atelier. Elle est appliquée ici pour que **les trois algorithmes tiennent
    le même contrat** — sans quoi « la palette ne porte que des couleurs de
    l'image » serait vraie de deux moteurs sur trois, ce qui est la pire des
    trois situations.
    """
    if not pixels.size:
        return np.zeros((0, 3), dtype=np.uint8)
    bande = Image.fromarray(
        np.ascontiguousarray(pixels.reshape(1, -1, 3)), mode="RGB"
    )
    indexee = bande.quantize(
        colors=max(1, min(256, couleurs)), method=Image.Quantize.MEDIANCUT
    )
    plate = indexee.getpalette() or []
    milieux = np.array(
        [plate[rang * 3 : rang * 3 + 3] for rang in sorted(set(indexee.tobytes()))],
        dtype=np.uint8,
    )
    distinctes = np.unique(pixels.reshape(-1, 3), axis=0)
    posees = distinctes[
        _plus_proches(
            milieux.astype(np.float32), distinctes.astype(np.float32)
        )
    ]
    return np.unique(posees, axis=0).astype(np.uint8)


def par_kmoyennes(
    pixels: np.ndarray, couleurs: int, *, graine: int = 0, passes: int = 12
) -> np.ndarray:
    """Les couleurs que l'image contient **vraiment**, par regroupement.

    La coupe médiane découpe l'espace des couleurs en boîtes et rend le milieu de
    chaque boîte ; k-moyennes part de couleurs candidates et les laisse glisser
    vers le centre de ce qui les entoure. La différence se voit là où la planche
    la place : *« la grenouille garde son vert franc au lieu de virer olive »* —
    une couleur rare mais franche pèse peu dans une boîte et beaucoup dans son
    propre groupe.

    **La graine est un réglage, jamais une horloge.** C'est la condition que la
    planche pose pour que l'algorithme entre dans le produit, et elle a une
    conséquence pratique : deux ateliers, sur deux machines, à deux dates,
    rendent le même fichier pour la même recette. `np.random.default_rng(graine)`
    est une suite reproductible, pas une source d'entropie.

    **Douze passes, et un arrêt dès que rien ne bouge.** Mesuré : au-delà de la
    dixième, aucune couleur d'une palette de 32 ne bouge plus d'un cran sur les
    images du dépôt. Un critère d'arrêt sur le déplacement rend donc les mêmes
    couleurs pour moins de calcul, et le plafond n'est là que pour borner le pire
    cas — une image de bruit, où le regroupement ne converge pas.
    """
    echantillon = _echantillon(pixels)
    if not echantillon.size:
        return np.zeros((0, 3), dtype=np.uint8)

    # **On regroupe avant de calculer, et le résultat est le même.** Un aplat de
    # ciel, c'est cent mille fois la même couleur : la faire glisser cent mille
    # fois vers le même centre coûte cent mille fois plus pour le même
    # déplacement. En pondérant chaque couleur distincte par sa population, la
    # somme de chaque groupe est exactement celle qu'on aurait obtenue pixel par
    # pixel — c'est une factorisation, pas une approximation.
    distinctes, populations = np.unique(
        echantillon.reshape(-1, 3), axis=0, return_counts=True
    )
    combien = max(1, min(int(couleurs), distinctes.shape[0]))
    if distinctes.shape[0] <= combien:
        return distinctes.astype(np.uint8)

    points = distinctes.astype(np.float32)
    poids = populations.astype(np.float32)

    # **Le départ est k-means++, tiré sur la graine de la recette.** Partir de
    # couleurs prises au hasard uniforme laisse régulièrement deux centres dans
    # le même aplat et aucun sur la grenouille ; k-means++ tire chaque centre
    # avec une probabilité proportionnelle à son éloignement de ceux déjà pris,
    # ce qui est précisément la panne que l'algorithme est là pour réparer.
    # **Le tirage est pondéré lui aussi.** Sans les populations, k-means++ tire
    # ses centres parmi les couleurs *distinctes* à parts égales : un pixel isolé
    # de bruit y pèse alors autant qu'un aplat de ciel, et la palette part sur
    # les accidents de l'image.
    tirage = np.random.default_rng(graine)
    centres = np.empty((combien, 3), dtype=np.float32)
    centres[0] = points[tirage.integers(points.shape[0])]
    ecarts = ((points - centres[0]) ** 2).sum(axis=1) * poids
    for rang in range(1, combien):
        total = float(ecarts.sum())
        if total <= 0:
            centres[rang:] = points[tirage.integers(points.shape[0], size=combien - rang)]
            break
        centres[rang] = points[
            int(np.searchsorted(np.cumsum(ecarts / total), tirage.random()))
        ]
        ecarts = np.minimum(
            ecarts, ((points - centres[rang]) ** 2).sum(axis=1) * poids
        )

    for _ in range(passes):
        proches = _plus_proches(points, centres)
        somme = np.zeros_like(centres)
        compte = np.bincount(proches, weights=poids, minlength=combien).astype(
            np.float32
        )
        np.add.at(somme, proches, points * poids[:, None])
        # Un groupe vide garde son centre : le déplacer sur zéro poserait un noir
        # pur dans la palette, la faute même que `_palette_imposee` corrige.
        vivants = compte > 0
        suivants = centres.copy()
        suivants[vivants] = somme[vivants] / compte[vivants, None]
        if np.abs(suivants - centres).max() < 0.5:
            centres = suivants
            break
        centres = suivants

    # **Chaque centre revient à la couleur réelle la plus proche.** Un centre est
    # une moyenne, et une moyenne n'est une couleur d'aucune source : c'est la
    # règle que `reduire` tient déjà pour la fusion de deux palettes, et la
    # planche la pose pour tout l'atelier — *jamais une moyenne inventée*.
    posees = distinctes[_plus_proches(centres, points)]
    return np.unique(posees, axis=0).astype(np.uint8)


def par_octree(pixels: np.ndarray, couleurs: int) -> np.ndarray:
    """L'espace découpé en huit, huit fois — la palette d'un octree.

    **Ce qu'elle achète, et la planche le dit en un chiffre** : *« elle sature
    moins vite que la coupe médiane : sur une image très bariolée, elle rend un
    nombre de couleurs plus proche de celui qu'on a demandé »*. C'est la réponse
    au cas nommé — demander 32 couleurs et en obtenir 14.

    **Écrite comme une réduction de niveaux, pas comme un arbre de nœuds.** Un
    octree se construit d'ordinaire en insérant les pixels un par un et en
    repliant les feuilles les moins peuplées ; sur un million de pixels en
    Python, cette boucle coûte des secondes. La même chose se dit en tableaux :
    on regroupe les pixels par préfixe de bits — ce que *sont* les nœuds d'un
    octree —, et on remonte d'un niveau tant qu'il reste plus de feuilles que
    demandé. Le dernier niveau se départage par population, ce qui est très
    exactement le repli d'un octree.

    **Chaque couleur rendue est la moyenne des pixels de sa feuille**, ramenée
    ensuite à une couleur réelle de l'image pour la même raison que k-moyennes.
    """
    echantillon = _echantillon(pixels)
    if not echantillon.size:
        return np.zeros((0, 3), dtype=np.uint8)

    combien = max(1, min(256, int(couleurs)))
    distinctes = np.unique(echantillon.reshape(-1, 3), axis=0)
    if distinctes.shape[0] <= combien:
        return distinctes.astype(np.uint8)

    entiers = echantillon.astype(np.uint32)

    # **On cherche le niveau le plus grossier qui porte encore assez de
    # feuilles**, et non le premier qui tient dans le compte. La nuance décide de
    # tout : s'arrêter dès que les feuilles tiennent rend *moins* de couleurs que
    # demandé — le défaut même que l'algorithme est là pour réparer. Un niveau
    # trop grossier n'a plus rien à replier ; un niveau qui en a trop se replie,
    # et c'est le geste normal d'un octree.
    retenu = None
    for niveau in range(8, 0, -1):
        decale = 8 - niveau
        # La clé d'un nœud : les `niveau` bits de poids fort des trois canaux,
        # entrelacés par canal plutôt que par bit — le regroupement est le même,
        # et l'entrelacement par bit ne servirait qu'à un parcours en ordre de
        # Morton dont on n'a pas besoin.
        cles = (
            ((entiers[:, 0] >> decale) << (2 * niveau))
            | ((entiers[:, 1] >> decale) << niveau)
            | (entiers[:, 2] >> decale)
        )
        trouve = np.unique(cles, return_inverse=True, return_counts=True)
        if trouve[0].shape[0] >= combien:
            retenu = trouve
        else:
            break
    feuilles, inverse, compte = retenu if retenu is not None else trouve

    somme = np.zeros((feuilles.shape[0], 3), dtype=np.float64)
    np.add.at(somme, inverse, echantillon.astype(np.float64))
    moyennes = somme / compte[:, None]

    if feuilles.shape[0] > combien:
        # **Le repli : on garde les feuilles les plus peuplées.** Départager à
        # population égale par la clé rend l'algorithme déterministe, ce que
        # `argsort` seul ne garantit pas d'une version de numpy à l'autre.
        rang = np.lexsort((feuilles, -compte))[:combien]
        moyennes = moyennes[rang]

    reelles = distinctes.astype(np.float32)
    posees = distinctes[_plus_proches(moyennes.astype(np.float32), reelles)]
    return np.unique(posees, axis=0).astype(np.uint8)


#: Les trois algorithmes, par leur nom du domaine. **Une table plutôt que des
#: conditions** — c'est ce qui fait qu'ajouter un quatrième algorithme ne demande
#: de toucher à aucun appelant.
ALGORITHMES_DE_PALETTE = {
    MEDIANE: lambda pixels, couleurs, graine: par_coupe_mediane(pixels, couleurs),
    KMOYENNES: lambda pixels, couleurs, graine: par_kmoyennes(
        pixels, couleurs, graine=graine
    ),
    OCTREE: lambda pixels, couleurs, graine: par_octree(pixels, couleurs),
}


def palette_par(
    algorithme: str, pixels: np.ndarray, couleurs: int, *, graine: int = 0
) -> np.ndarray:
    """La palette que cet algorithme-là choisit sur ces pixels-là.

    **Le seul point d'entrée**, et un nom inconnu retombe sur la coupe médiane
    plutôt que de lever — même règle que `methode_connue` dans le domaine : une
    recette écrite par une version plus récente doit continuer de rendre une
    image.
    """
    choisir = ALGORITHMES_DE_PALETTE.get(algorithme_connu(algorithme))
    return choisir(pixels, couleurs, graine)  # type: ignore[misc]


def _plus_proches(points: np.ndarray, cibles: np.ndarray) -> np.ndarray:
    """Pour chaque point, le rang de la cible la plus proche. Par blocs.

    **Les blocs ne sont pas une optimisation, ils bornent la mémoire.** La
    matrice des écarts entre un million de pixels et 256 couleurs pèse un
    gigaoctet en flottants ; c'est très exactement la panne que `B17` a payée sur
    ses deux moteurs qui balaient l'image — 1,78 Go pour le grain — et le
    garde-fou qu'elle a posé est le **pic de mémoire**, qui ne dépend pas de la
    machine. Trente-deux mille points par bloc tiennent sous cent mégaoctets
    quelle que soit la palette.
    """
    if not points.size:
        return np.zeros((0,), dtype=np.intp)
    rangs = np.empty(points.shape[0], dtype=np.intp)
    for debut in range(0, points.shape[0], 32_768):
        tranche = points[debut : debut + 32_768]
        ecarts = ((tranche[:, None, :] - cibles[None, :, :]) ** 2).sum(axis=2)
        rangs[debut : debut + 32_768] = np.argmin(ecarts, axis=1)
    return rangs


# ── La trame régulière, et sa force ──────────────────────────────────────────
#
# **Le motif est fixe, et c'est tout son intérêt.** Floyd reporte l'erreur d'un
# pixel sur ses voisins : le semis dépend alors du contenu, donc il se recalcule
# à chaque frame et l'herbe grésille. Une trame ordonnée décide du seuil par la
# **position** du pixel, jamais par ce qui l'entoure : deux frames d'une même
# marche reçoivent leurs points aux mêmes endroits, et le motif tient.


def _trame(cote: int) -> np.ndarray:
    """La matrice de Bayer de côté `cote`, en parts de zéro à un.

    Construite par récurrence plutôt qu'écrite en dur : la matrice de 4×4 se
    déduit de celle de 2×2, et l'écrire à la main serait seize nombres qu'aucun
    essai ne pourrait distinguer d'une faute de frappe.
    """
    motif = np.zeros((1, 1), dtype=np.float64)
    while motif.shape[0] < cote:
        motif = np.block(
            [
                [4 * motif, 4 * motif + 2],
                [4 * motif + 3, 4 * motif + 1],
            ]
        )
    return (motif + 0.5) / motif.size


def _decalage_de_trame(
    forme: tuple[int, int], palette: np.ndarray, force: float
) -> np.ndarray:
    """Ce qu'on ajoute à chaque pixel avant de chercher sa plus proche couleur.

    **Tramer, c'est décaler puis arrondir.** Un pixel à mi-chemin entre deux
    couleurs de la palette tombe toujours du même côté si on l'arrondit tel
    quel ; décalé d'un peu moins ou d'un peu plus selon sa position dans le
    motif, il tombe d'un côté ou de l'autre, et le damier apparaît.

    **L'amplitude est celle du pas de la palette**, pas une constante : sur une
    palette de 4 couleurs les marches sont larges et il faut décaler beaucoup,
    sur 64 elles sont fines et un gros décalage traverserait deux couleurs
    d'un coup — ce qui ne serait plus un tramage mais du bruit. On la prend sur
    l'écart médian entre couleurs voisines, qui décrit la palette réelle au lieu
    de supposer qu'elle est régulière.

    `force` va de 0 — aucun décalage, donc aucun point — à 1.
    """
    if palette.shape[0] < 2 or force <= 0:
        return np.zeros((*forme, 1), dtype=np.float32)

    ecarts = ((palette[:, None, :].astype(np.float32) - palette[None, :, :]) ** 2).sum(
        axis=2
    )
    np.fill_diagonal(ecarts, np.inf)
    pas = float(np.median(np.sqrt(ecarts.min(axis=1))))

    motif = _trame(COTE_DE_LA_TRAME)
    hauteur, largeur = forme
    repete = np.tile(
        motif,
        (
            hauteur // motif.shape[0] + 1,
            largeur // motif.shape[1] + 1,
        ),
    )[:hauteur, :largeur]
    return ((repete - 0.5) * pas * force).astype(np.float32)[:, :, None]


# Combien de bits on jette par canal pour indexer le cube des plus proches.
# Trois bits — donc 32 niveaux par canal, 32 768 cases — sont le point où le
# cube se construit en une poignée de millisecondes tout en restant plus fin que
# l'écart entre deux couleurs d'une palette de 256 : à 8 crans de côté, deux
# couleurs distinctes d'une palette de sprite ne tombent jamais dans la même
# case.
_PAS_DU_CUBE = 3


def _cube_des_plus_proches(palette: np.ndarray, a_l_oeil: bool) -> np.ndarray:
    """Pour chaque case de couleur, le rang de la plus proche de la palette.

    **Il existe pour que la diffusion d'erreur ne coûte pas un `argmin` par
    pixel.** Floyd-Steinberg est le seul moteur de l'atelier qu'on ne peut pas
    écrire en tableaux : le voisin de droite doit avoir reçu l'erreur du pixel
    courant avant d'être décidé, donc la boucle est irréductible. Ce qu'on peut
    retirer de la boucle, c'est la recherche — et c'est tout ce qu'elle coûtait.
    Mesuré sur une case de 64 : 87 ms avec l'`argmin`, sous les 3 ms avec le
    cube, pour la même image à l'octet près.

    C'est aussi ce qui rend la distance à l'œil gratuite dans cette boucle : elle
    est payée une fois, à la construction du cube, au lieu d'une fois par pixel.
    """
    cote = 256 >> _PAS_DU_CUBE
    centres = (np.arange(cote) << _PAS_DU_CUBE) + (1 << (_PAS_DU_CUBE - 1))
    grille = np.stack(np.meshgrid(centres, centres, centres, indexing="ij"), axis=-1)
    rangs = _plus_proches(
        _mesurables(grille.reshape(-1, 3).astype(np.uint8), a_l_oeil).astype(np.float32),
        _mesurables(palette, a_l_oeil).astype(np.float32),
    )
    return rangs.reshape(cote, cote, cote)


def _tramer_en_diffusion(
    couleurs: np.ndarray, palette: np.ndarray, a_l_oeil: bool, force: float
) -> np.ndarray:
    """Floyd-Steinberg, écrit ici parce que Pillow ne sait pas doser sa force.

    L'erreur d'un pixel est reportée sur ses voisins — sept seizièmes à droite,
    puis trois, cinq et un sur la ligne du dessous. `force` en garde une part :
    à 30 %, seuls les grands dégradés reçoivent des points et les aplats restent
    propres, ce qui est très exactement le réglage que la planche demande.

    **Ligne par ligne, et c'est irréductible.** Un report se propage : le voisin
    de droite doit avoir reçu l'erreur du pixel courant avant d'être décidé. Le
    balayage vectorisé n'existe pas pour cet algorithme-là, et c'est une des
    raisons pour lesquelles la trame régulière est préférable sur un sprite.
    """
    hauteur, largeur = couleurs.shape[:2]
    travail = couleurs.astype(np.float32).copy()
    cube = _cube_des_plus_proches(palette, a_l_oeil)
    pal = palette.astype(np.float32)
    rangs = np.empty((hauteur, largeur), dtype=np.intp)

    for y in range(hauteur):
        ligne = travail[y]
        suivante = travail[y + 1] if y + 1 < hauteur else None
        for x in range(largeur):
            r, v, b = ligne[x]
            rang = cube[
                min(255, max(0, int(r))) >> _PAS_DU_CUBE,
                min(255, max(0, int(v))) >> _PAS_DU_CUBE,
                min(255, max(0, int(b))) >> _PAS_DU_CUBE,
            ]
            rangs[y, x] = rang
            erreur = (ligne[x] - pal[rang]) * force
            if x + 1 < largeur:
                ligne[x + 1] += erreur * (7 / 16)
            if suivante is not None:
                if x:
                    suivante[x - 1] += erreur * (3 / 16)
                suivante[x] += erreur * (5 / 16)
                if x + 1 < largeur:
                    suivante[x + 1] += erreur * (1 / 16)
    return rangs


def _carte(pixels: np.ndarray, palette: np.ndarray, a_l_oeil: bool) -> np.ndarray:
    """Le rang de la couleur la plus proche, pour chaque pixel. **Par couleur.**

    **On ne mesure pas un million de pixels, on mesure les couleurs qu'ils
    portent.** Une image de 1 024 carrés compte un million de pixels et trente
    mille couleurs : mesurer chaque pixel contre chaque couleur de la palette
    coûtait une seconde et refaisait trente fois le même calcul. Regrouper
    d'abord, mesurer ensuite, redistribuer — c'est le même résultat **à l'octet
    près**, pas une approximation, et le coût suit désormais la richesse de
    l'image au lieu de sa surface.

    Le regroupement passe par un entier par pixel plutôt que par des triplets :
    `np.unique` sur un tableau à trois colonnes trie des lignes, ce qui coûte
    plusieurs fois le tri d'un vecteur d'entiers pour exactement la même
    partition.
    """
    entiers = (
        pixels[:, 0].astype(np.uint32) << 16
        | pixels[:, 1].astype(np.uint32) << 8
        | pixels[:, 2].astype(np.uint32)
    )
    uniques, inverse = np.unique(entiers, return_inverse=True)
    distinctes = np.stack(
        [uniques >> 16 & 255, uniques >> 8 & 255, uniques & 255], axis=1
    ).astype(np.uint8)
    rangs = _plus_proches(
        _mesurables(distinctes, a_l_oeil).astype(np.float32),
        _mesurables(palette, a_l_oeil).astype(np.float32),
    )
    return rangs[inverse]


def _table_de(palette: np.ndarray) -> Image.Image:
    """La table Pillow d'une palette déjà choisie — **remplie, jamais bourrée**.

    Le jumeau de `_palette_imposee` du traitement, pour une palette qui arrive en
    tableau plutôt qu'en hexadécimal. Le remplissage répète les couleurs
    déclarées au lieu de compléter par des zéros, et la raison est la même,
    mesurée : une table complétée de noirs pose 254 noirs purs, et tout ce qui
    est sombre s'y accroche.
    """
    plate: list[int] = []
    triplets = [tuple(int(c) for c in couleur) for couleur in palette]
    while len(plate) < 768:
        plate.extend(triplets[(len(plate) // 3) % len(triplets)])
    reference = Image.new("P", (1, 1))
    reference.putpalette(plate[:768])
    return reference


def reduire_l_image(rgba: np.ndarray, quantification) -> np.ndarray:
    """L'image ramenée sur sa palette — **la carte commune aux trois algorithmes**.

    C'est ici que les six réglages de `B18` se rejoignent, et l'ordre dans lequel
    ils s'appliquent est la moitié de leur sens :

    1. **quels pixels comptent** — tous, ou seulement ceux qu'on voit ;
    2. **quelles couleurs** — les gardées d'office, l'algorithme pour le reste ;
    3. **où va chaque pixel** — à la plus proche, mesurée brute ou à l'œil,
       éventuellement décalée par le tramage.

    Une palette imposée court-circuite l'étape 2 : c'est la palette du jeu, elle
    ne se choisit pas. Les couleurs gardées ne s'y ajoutent pas non plus — la
    planche est nette là-dessus, *« la palette du jeu vaut pour tous les
    sujets »*, et y glisser une couleur prise sur une image ferait mentir la
    promesse qui fait tenir le monde ensemble.

    **L'alpha est mis de côté et remis tel quel**, comme dans le chemin d'avant.
    """
    alpha = rgba[:, :, 3].copy()
    couleurs = rgba[:, :, :3]

    if quantification.palette:
        posee = np.array([_rgb(c) for c in quantification.palette], dtype=np.uint8)
    else:
        # ── 1. Quels pixels comptent ──────────────────────────────────────────
        #
        # **Le magenta sous la transparence est une couleur comme une autre pour
        # un histogramme** — c'est la panne que la planche mesure : demander 8
        # couleurs en rend 7 visibles, parce qu'une place est partie au fond
        # qu'on venait de retirer. Une bande d'animation ne compte déjà que les
        # pixels visibles ; ce réglage donne la même correction à une image
        # seule.
        plats = couleurs.reshape(-1, 3)
        if quantification.visibles_seuls:
            visibles = plats[alpha.reshape(-1) > 0]
            # Une image entièrement transparente n'a aucun pixel à compter :
            # on retombe sur tous, faute de quoi la palette serait vide et
            # l'image ressortirait noire.
            plats = visibles if visibles.size else plats

        # ── 2. Quelles couleurs ───────────────────────────────────────────────
        gardees = np.array(
            [_rgb(c) for c in quantification.gardees_vives], dtype=np.uint8
        ).reshape(-1, 3)
        reste = max(1, min(256, quantification.couleurs) - gardees.shape[0])
        choisies = palette_par(
            quantification.algorithme,
            plats,
            reste,
            graine=quantification.graine,
        )
        posee = (
            np.unique(np.vstack([gardees, choisies]), axis=0)
            if gardees.size
            else choisies
        )

    if not posee.size:
        return rgba.copy()

    # ── 3. Où va chaque pixel ─────────────────────────────────────────────────
    a_l_oeil = quantification.distance == OEIL
    force = max(0, min(100, quantification.force_tramage)) / 100.0

    if quantification.tramage == FLOYD and force > 0:
        # **À pleine force et en distance brute, c'est Pillow qui diffuse.**
        # C'est exactement ce que la diffusion serial ci-dessous calculerait, en
        # C plutôt qu'en Python — donc la même image, à n'importe quelle taille,
        # sans la boucle. Le cas est loin d'être marginal : *changer
        # d'algorithme sans toucher au tramage* y tombe, et c'est le geste le
        # plus courant de la tranche.
        #
        # La boucle ne sert donc qu'aux deux choses que Pillow ne sait pas
        # faire : doser la force, et mesurer à l'œil.
        if force >= 1.0 and not a_l_oeil:
            indexee = Image.fromarray(couleurs, mode="RGB").quantize(
                palette=_table_de(posee), dither=Image.Dither.FLOYDSTEINBERG
            )
            return np.dstack([np.asarray(indexee.convert("RGB")), alpha])
        rangs = _tramer_en_diffusion(couleurs, posee, a_l_oeil, force)
    else:
        travail = couleurs
        if quantification.tramage == TRAME and force > 0:
            # **Le décalage est arrondi à l'entier, et ce n'est pas une perte.**
            # Ce qu'on décale, c'est une couleur de huit bits par canal ; la
            # ramener à l'entier avant de chercher sa plus proche voisine rend
            # exactement la même palette et rend le regroupement de `_carte`
            # possible — sans quoi chaque pixel porterait un flottant unique et
            # il n'y aurait plus rien à regrouper.
            travail = np.clip(
                couleurs.astype(np.float32)
                + _decalage_de_trame(couleurs.shape[:2], posee, force)
                + 0.5,
                0,
                255,
            ).astype(np.uint8)
        rangs = _carte(travail.reshape(-1, 3), posee, a_l_oeil).reshape(
            couleurs.shape[:2]
        )

    return np.dstack([posee[rangs], alpha])


def couleurs_obtenues(rgba: np.ndarray) -> int:
    """Combien de couleurs **visibles** cette image porte vraiment.

    *« 24 demandées, 14 obtenues »* — le seul chiffre qui explique pourquoi
    monter le réglage ne change plus rien. La planche le compte parmi ce qui
    manque, et son absence a un coût mesuré : *« rien à l'écran ne dit l'écart,
    donc l'auteur monte le réglage en croyant gagner du détail »*.

    **Sur les pixels visibles seulement, toujours** — même quand la réduction,
    elle, a compté le fond. C'est ce que l'auteur regarde : une couleur cachée
    sous la transparence n'est pas une couleur qu'il a obtenue. Compter
    autrement rendrait 15 là où l'écran montre 14, et le chiffre servirait à
    expliquer un écart en en créant un autre.
    """
    visibles = rgba[:, :, :3][rgba[:, :, 3] > 0]
    if not visibles.size:
        return 0
    return int(np.unique(visibles.reshape(-1, 3), axis=0).shape[0])


def rampes(palette: Sequence[str]) -> tuple[tuple[str, ...], ...]:
    """La palette rangée **en rampes d'ombre** : les bruns ensemble, du sombre au clair.

    **Elle ne change aucune image, et c'est écrit dans la planche** : *« Les
    ranger ne change aucune image : ça change ce qu'on voit en les regardant,
    donc ce qu'on décide d'ajouter. »* C'est une lecture de la palette, au même
    titre que `part_lue` est une lecture d'un artwork — d'où sa place ici, dans
    le module qui *dit* les couleurs, et non dans le traitement, qui les pose.

    Le rangement se fait sur la **teinte** en OKLab, pas sur le canal rouge ni
    sur le code hexadécimal : deux bruns voisins à l'œil peuvent être loin l'un
    de l'autre en RVB, et la planche demande explicitement les familles telles
    que l'œil les groupe. À l'intérieur d'une rampe, du plus sombre au plus
    clair, ce qui est le sens du mot *rampe*.

    **Les gris forment une rampe à part, et ils la forment toujours.** Un gris
    n'a pas de teinte : lui en calculer une revient à lire du bruit, et un noir
    pur se retrouverait rangé avec les bleus ou les rouges selon le dernier bit
    de son code. La rampe des gris vient en tête — c'est là qu'on la cherche.
    """
    lues = [c for c in palette if c]
    if not lues:
        return ()

    rvb = np.array([_rgb(c) for c in lues], dtype=np.uint8)
    lab = _en_oklab(rvb)
    clarte, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    chroma = np.hypot(a, b)

    # ── Ce qui sépare un gris d'une couleur, et le seuil est mesuré ───────────
    #
    # **Un gris est une couleur sans teinte, et la mesure doit tenir compte du
    # sombre.** Le chroma d'OKLab s'effondre avec la clarté : `#2b1d10`, un brun
    # franc, y porte moins de chroma qu'un gris bleuté clair. Un seuil absolu
    # rangeait donc les bruns sombres avec les gris — exactement ce que la
    # planche demande d'éviter, puisqu'elle veut *« les bruns ensemble, du plus
    # sombre au plus clair »* et que le plus sombre est le premier de la rampe.
    #
    # On rapporte donc le chroma à la clarté : la question n'est pas *cette
    # couleur est-elle très colorée* mais *est-elle plus colorée qu'un gris ne le
    # serait à cette luminosité-là*.
    #
    # **Le rapport tombe dans un trou franc, et c'est lui qui donne le seuil.**
    # Mesuré sur dix-sept couleurs couvrant les bruns du plus sombre au plus
    # clair, les verts, les gris neutres et les gris colorés d'un pixel art :
    #
    # | ce que c'est                        | chroma / clarté |
    # |-------------------------------------|-----------------|
    # | gris neutres (`#212121` → `#ffffff`)|      0,000      |
    # | gris bleuté, gris chaud             |  0,023 – 0,026  |
    # | ← **rien entre les deux** →         |                 |
    # | tan clair, bruns, verts             |  0,098 – 0,227  |
    #
    # 0,06 est au milieu du trou, à un facteur d'environ 2,5 de chaque bord.
    # ⚠️ Un premier essai à 0,10 rangeait `#af9169` — un tan à 0,0985 — avec les
    # gris : le seuil frôlait le bord du trou au lieu de se poser au milieu.
    # Trouvé en regardant les rampes de l'atelier jetable, pas par un essai.
    #
    # Le plancher de clarté évite la division par zéro sur un noir pur, qui est
    # un gris et doit le rester.
    gris = chroma < 0.06 * np.maximum(clarte, 0.18)

    # Six rampes de teinte, comme la planche les compte — *« six rampes de
    # quatre »*. Le tour de la roue est découpé en six secteurs égaux ; c'est
    # grossier, et c'est ce qu'on veut : une famille est un groupe qu'on
    # reconnaît d'un coup d'œil, pas une classification.
    secteur = np.floor((np.arctan2(b, a) / (2 * np.pi) % 1.0) * 6).astype(int)

    groupes: dict[int, list[int]] = {}
    for rang in range(len(lues)):
        groupes.setdefault(-1 if gris[rang] else int(secteur[rang]), []).append(rang)

    sortie: list[tuple[str, ...]] = []
    for cle in sorted(groupes):
        rangs = sorted(groupes[cle], key=lambda r: float(clarte[r]))
        sortie.append(tuple(lues[r] for r in rangs))
    return tuple(sortie)
