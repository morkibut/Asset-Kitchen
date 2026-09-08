# -*- coding: utf-8 -*-
"""Les critères de B18 · Couleurs — les neuf moteurs de l'atelier des couleurs.

**Ce que la tranche livre** : trois algorithmes de palette là où il n'y en avait
qu'un, une trame régulière, une force de tramage, une distance à l'œil, le compte
des seuls pixels visibles, les couleurs gardées, le rangement en rampes d'ombre,
et le compte « demandées / obtenues » qui explique tout le reste.

**L'invariant de la tranche tient en une phrase** : *un algorithme de
quantification de palette choisit des couleurs, il ne peint rien.* Les trois
algorithmes reçoivent les mêmes pixels et rendent une palette ; la carte des
pixels sur cette palette, le tramage, la distance et les couleurs gardées sont
écrits une fois et valent pour les trois. Plusieurs essais de ce fichier ne
mesurent rien d'autre que ça — c'est ce qui empêche « distance à l'œil » d'avoir
trois implémentations qui finiraient par ne plus répondre pareil.

**Le critère le plus cher est celui qui ne se voit pas**, et c'est le même qu'en
`B1` et `B17` : six clés de plus dans la quantification changeraient le JSON
canonique de toutes les recettes du disque, donc leur empreinte, donc le nom de
leur rendu — et tout le cache se recalculerait. Le corpus figé de `B1` le tient.

**Aucun essai de ce fichier ne coûte un centime**, et aucun ne touche au réseau :
les neuf moteurs sont du calcul local sur des tableaux `numpy`.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pytest

from atelier.domaine.recette import (
    ALGORITHMES,
    AUCUN,
    BRUTE,
    COTE_DE_LA_TRAME,
    DISTANCES,
    FLOYD,
    FORCE_TRAMAGE_LIVREE,
    GARDEES_MAX,
    KMOYENNES,
    MEDIANE,
    OCTREE,
    OEIL,
    TRAME,
    TRAMAGES,
    Quantification,
    Recette,
    algorithme_connu,
    distance_connue,
)
from atelier.image import palette as module_palette
from atelier.image.palette import (
    PIXELS_AU_PLUS,
    _echantillon,
    couleurs_obtenues,
    palette_par,
    par_coupe_mediane,
    par_kmoyennes,
    par_octree,
    rampes,
)
from atelier.image.traitement import quantifier
from atelier.services.assets import RecetteRefusee, ServiceAssets

CORPUS = Path(__file__).resolve().parent / "recettes-avant-b1.json"

MAGENTA = (255, 0, 255)
VERT_GRENOUILLE = (30, 220, 60)


# ── De quoi mesurer ──────────────────────────────────────────────────────────


def image_riche(cote: int = 64, *, detouree: bool = True) -> np.ndarray:
    """Un dégradé de bruns, une tache de vert franc, un fond magenta transparent.

    **Fabriquée et non lue d'un fichier**, pour la raison de `test_b17` : ce
    qu'on mesure est en partie ce qui reste *sous* la transparence, et un PNG
    relu aurait pu perdre ces octets-là à l'écriture.

    C'est très exactement l'image dont la planche parle : un sujet de bruns, une
    couleur rare mais franche que la coupe médiane noie, et le fond qu'on vient
    de retirer et qui prend encore une place de la palette.
    """
    y, x = np.mgrid[0:cote, 0:cote]
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, 0] = np.clip(120 + x * (200 / cote), 0, 255)
    rgba[:, :, 1] = np.clip(70 + y * (150 / cote), 0, 255)
    rgba[:, :, 2] = np.clip(60 + (x + y) * (90 / cote), 0, 255)
    rgba[:, :, 3] = 255
    quart = cote // 8
    rgba[5 * quart : 6 * quart, 5 * quart : 6 * quart, :3] = VERT_GRENOUILLE
    if detouree:
        rgba[: cote // 8, :, :3] = MAGENTA
        rgba[: cote // 8, :, 3] = 0
    return rgba


def image_bariolee(cote: int = 512) -> np.ndarray:
    """Une image où **presque chaque pixel porte sa propre couleur**.

    `image_riche` est un dégradé : elle a beaucoup de pixels et peu de couleurs.
    C'est le bon banc pour la carte des pixels sur la palette, et c'est
    exactement le mauvais pour le chemin inverse — celui qui ramène les couleurs
    calculées sur les couleurs *réelles* de l'image, et dont le coût suit le
    nombre de couleurs distinctes, pas la surface.

    Le bruit est tiré sur une graine fixe : la même image à chaque exécution,
    comme partout ailleurs dans ce dépôt.
    """
    tirage = np.random.default_rng(7)
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[:, :, :3] = tirage.integers(0, 256, size=(cote, cote, 3), dtype=np.uint8)
    rgba[:, :, 3] = 255
    return rgba


def pixels_de(rgba: np.ndarray) -> np.ndarray:
    return rgba[:, :, :3].reshape(-1, 3)


def chronometre(fonction, *args, tours: int = 3) -> float:
    """Le meilleur des `tours`, en millisecondes. Le meilleur, pas la moyenne :
    la moyenne mesure en plus ce que la machine faisait à côté."""
    durees = []
    for _ in range(tours):
        depart = time.perf_counter()
        fonction(*args)
        durees.append((time.perf_counter() - depart) * 1000)
    return min(durees)


# ═════════════════════════════════════════════════════════════════════════════
# « Les essais de serveur passent sans modification »
# ═════════════════════════════════════════════════════════════════════════════


def test_les_soixante_et_une_recettes_du_depot_gardent_leur_empreinte():
    """**Le critère qui coûte le plus cher, et il ne se voit pas.**

    Six clés de plus écrites à leur neutre auraient changé les 61 empreintes,
    donc le nom de tous les rendus en cache. Écrites seulement quand elles sont
    posées, elles laissent le canonique d'une recette d'avant **strictement
    identique** — caractère pour caractère, et pas seulement « équivalent ».
    """
    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))
    assert len(corpus) == 61, "le corpus figé se relit, il ne se refait pas"
    for rang, entree in enumerate(corpus, start=1):
        recette = Recette.depuis_json(entree["recette"])
        assert recette.empreinte() == entree["empreinte"], (
            f"recette {rang} : l'empreinte a bougé"
        )


def test_une_quantification_d_avant_se_reecrit_caractere_pour_caractere():
    """Le JSON qui ressort est celui qui est entré — aucune clé neuve ajoutée."""
    avant = {"couleurs": 24, "palette": ["#112233"], "tramage": "floyd"}
    assert Quantification.depuis_json(avant).en_json() == avant


@pytest.mark.parametrize(
    "reglage",
    [
        {"algorithme": KMOYENNES},
        {"graine": 7},
        {"force_tramage": 30},
        {"distance": OEIL},
        {"visibles_seuls": True},
        {"gardees": ("#1edc3c",)},
    ],
)
def test_un_reglage_pose_change_bien_l_empreinte(reglage):
    """**L'inverse du critère, et il compte autant.**

    Une clé qui ne s'écrirait jamais serait un réglage sans effet sur le rendu :
    l'image changerait, le nom du fichier non, et le cache servirait l'ancienne.
    """
    nue = Recette(quantification=Quantification(couleurs=16))
    posee = Recette(quantification=Quantification(couleurs=16, **reglage))
    assert nue.empreinte() != posee.empreinte()


def test_le_chemin_d_avant_est_le_meme_code_quand_rien_n_est_pose():
    """**La forme la plus forte de la promesse** : il n'y a rien à comparer.

    Tant que les six réglages sont à leur neutre, `quantifier` exécute le code
    d'avant — pas un équivalent. `reglages_de_b18_neutres` est la seule lecture
    qui en décide, et c'est elle qu'on épingle ici.
    """
    assert Quantification(couleurs=16).reglages_de_b18_neutres
    assert Quantification(couleurs=16, tramage=FLOYD).reglages_de_b18_neutres
    # `force_tramage` est le seul dont le neutre n'est pas la valeur vide.
    assert Quantification(couleurs=16, force_tramage=100).reglages_de_b18_neutres
    assert not Quantification(couleurs=16, force_tramage=99).reglages_de_b18_neutres
    assert not Quantification(couleurs=16, algorithme=OCTREE).reglages_de_b18_neutres


# ═════════════════════════════════════════════════════════════════════════════
# L'architecture commune : trois algorithmes, une seule interface
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("algorithme", ALGORITHMES)
def test_tout_algorithme_rend_au_plus_le_nombre_demande(algorithme):
    """**Le contrat de l'interface commune**, tenu par les trois.

    C'est la seule chose qu'un algorithme de palette promet : *des couleurs, au
    plus N*. Vérifier qu'il ne lève pas ne prouverait rien — c'est la contrainte
    demandée qu'il faut mesurer.
    """
    pixels = pixels_de(image_riche())
    for combien in (2, 4, 8, 16, 32):
        palette = palette_par(algorithme, pixels, combien)
        assert palette.ndim == 2 and palette.shape[1] == 3
        assert palette.dtype == np.uint8
        assert 0 < palette.shape[0] <= combien, (
            f"{algorithme} a rendu {palette.shape[0]} couleurs pour {combien} demandées"
        )


@pytest.mark.parametrize("algorithme", ALGORITHMES)
def test_tout_algorithme_ne_rend_que_des_couleurs_de_l_image(algorithme):
    """*Jamais une moyenne inventée* — la règle que la planche pose pour tout
    l'atelier, et que `reduire` tient déjà pour la fusion de deux palettes.

    Un centre de k-moyennes est une moyenne, et une moyenne n'est la couleur
    d'aucune source : sans le raccrochage, la palette annoncerait des teintes que
    l'image ne porte pas.
    """
    pixels = pixels_de(image_riche())
    presentes = {tuple(int(c) for c in p) for p in np.unique(pixels, axis=0)}
    for couleur in palette_par(algorithme, pixels, 16):
        assert tuple(int(c) for c in couleur) in presentes


@pytest.mark.parametrize("algorithme", ALGORITHMES)
def test_tout_algorithme_est_deterministe(algorithme):
    """« Chaque étape est déterministe, et c'est un critère » (`AGENTS.md`).

    Y compris k-moyennes, **parce que sa graine est un réglage et non une
    horloge** : c'est la condition que la planche pose pour qu'il entre dans le
    produit.
    """
    pixels = pixels_de(image_riche())
    premiere = palette_par(algorithme, pixels, 16, graine=3)
    for _ in range(3):
        suivante = palette_par(algorithme, pixels, 16, graine=3)
        assert np.array_equal(premiere, suivante)


@pytest.mark.parametrize("algorithme", ALGORITHMES)
def test_tout_algorithme_traverse_la_meme_carte(algorithme):
    """**L'invariant de la tranche, mesuré et non affirmé.**

    Les trois algorithmes ne diffèrent que par le *choix* des couleurs : une fois
    la palette posée, l'image rendue ne dépend plus que de la palette. On le
    vérifie sans lire le code — en imposant la même palette aux trois, et en
    exigeant le même fichier à l'octet près.
    """
    image = image_riche()
    palette = ("#000000", "#6b5a44", "#1edc3c", "#ffffff")
    rendues = [
        quantifier(
            image,
            # `visibles_seuls` ne change rien sous une palette imposée — elle ne
            # sert qu'à *choisir* des couleurs, et il n'y a rien à choisir ici.
            # Elle est posée pour que les trois passent par le **même** chemin :
            # comparer le chemin d'avant au chemin neuf mesurerait autre chose
            # (voir `test_la_carte_maison_est_plus_juste_que_celle_de_pillow`).
            Quantification(
                couleurs=4, palette=palette, algorithme=a, visibles_seuls=True
            ),
        )
        for a in ALGORITHMES
    ]
    for autre in rendues[1:]:
        assert np.array_equal(rendues[0], autre), (
            "une palette imposée doit rendre la même image quel que soit l'algorithme"
        )


def test_la_carte_maison_est_plus_juste_que_celle_de_pillow():
    """⚠️ **Un défaut trouvé en écrivant la tranche, et il est dans Pillow.**

    Sous une palette imposée, `Image.quantize(palette=…)` ne cherche pas
    exactement la couleur la plus proche : il passe par un cache approché.
    Mesuré sur un dégradé de 64 carrés et une palette de quatre couleurs,
    **1,9 % des pixels partent sur la mauvaise couleur** — un rose clair envoyé
    sur le brun alors que le blanc est plus proche de 190 unités au carré.

    Les deux chemins de `quantifier` ne rendent donc pas tout à fait la même
    image sous palette imposée, et **c'est le chemin neuf qui a raison**. On
    l'épingle ici plutôt que de le taire : c'est ce qui explique pourquoi les
    essais de cette tranche comparent toujours le chemin neuf à lui-même, et
    c'est la mesure contre laquelle se jugera le jour où l'on décidera de faire
    passer tout le monde par la carte maison.
    """
    image = image_riche()
    palette = ("#000000", "#6b5a44", "#1edc3c", "#ffffff")
    par_pillow = quantifier(image, Quantification(couleurs=4, palette=palette))
    par_maison = quantifier(
        image, Quantification(couleurs=4, palette=palette, visibles_seuls=True)
    )

    posee = np.array(
        [[int(c[i : i + 2], 16) for i in (1, 3, 5)] for c in palette], dtype=np.int32
    )
    vus = image[:, :, 3] > 0

    def eloignement(rendu: np.ndarray) -> float:
        """L'écart moyen entre chaque pixel et la couleur qu'on lui a donnée."""
        source = image[:, :, :3][vus].astype(np.int32)
        pose = rendu[:, :, :3][vus].astype(np.int32)
        return float(((source - pose) ** 2).sum(axis=1).mean())

    assert eloignement(par_maison) <= eloignement(par_pillow), (
        "la carte maison doit être au moins aussi juste que celle de Pillow"
    )


def test_un_nom_d_algorithme_inconnu_ne_leve_pas_et_retombe_sur_la_mediane():
    """**Le domaine ne lève pas sur un nom qu'il ne connaît pas** — la règle de
    `methode_connue`, reprise telle quelle : une recette écrite par une version
    plus récente doit continuer de s'ouvrir."""
    assert algorithme_connu("licorne") == MEDIANE
    assert distance_connue("licorne") == BRUTE
    pixels = pixels_de(image_riche())
    assert palette_par("licorne", pixels, 8).shape[0] <= 8


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 1 · k-moyennes — la couleur rare survit
# ═════════════════════════════════════════════════════════════════════════════


def test_k_moyennes_garde_le_vert_de_la_grenouille():
    """*« Quand la coupe médiane noie une couleur rare mais importante — le vert
    de la grenouille au milieu d'une image de bruns et de gris. »*

    **L'image est fabriquée pour ce cas-là et pour lui seul** : un dégradé de
    bruns qui occupe presque tout, et une tache de vert franc sur un peu plus
    d'un pour cent des pixels. C'est très exactement la situation que la planche
    décrit, et il n'y en a pas d'autre où l'algorithme se juge.

    L'essai compare les deux algorithmes **sur les mêmes pixels** plutôt que de
    poser un seuil absolu : ce que la planche promet est un progrès sur la coupe
    médiane, pas une valeur.
    """
    cote = 64
    y, x = np.mgrid[0:cote, 0:cote]
    bruns = np.zeros((cote, cote, 3), dtype=np.uint8)
    bruns[:, :, 0] = 90 + (x // 8) * 8
    bruns[:, :, 1] = 70 + (y // 8) * 6
    bruns[:, :, 2] = 50 + ((x + y) // 16) * 4
    bruns[40:48, 40:48] = VERT_GRENOUILLE  # la grenouille : 1,6 % de l'image
    pixels = bruns.reshape(-1, 3)

    vert = np.array(VERT_GRENOUILLE, dtype=np.int32)

    def ecart_au_vert(palette: np.ndarray) -> float:
        # `int32` et non `int16` : 255² dépasse déjà 32 767, et le carré d'un
        # écart de couleur déborde en silence sur seize bits.
        ecarts = (palette.astype(np.int32) - vert) ** 2
        return float(np.min(ecarts.sum(axis=1)) ** 0.5)

    par_k = ecart_au_vert(par_kmoyennes(pixels, 8, graine=1))
    par_m = ecart_au_vert(par_coupe_mediane(pixels, 8))
    print(f"\n  écart au vert de la grenouille : médiane {par_m:.0f}, k-moyennes {par_k:.0f}")
    assert par_k <= par_m, (
        "k-moyennes doit garder le vert au moins aussi bien que la coupe médiane"
    )


def test_la_graine_de_k_moyennes_est_un_reglage_qui_agit():
    """Deux graines peuvent rendre deux palettes — sinon la graine ne servirait à
    rien et n'aurait pas à être enregistrée. Chacune, elle, se reproduit."""
    pixels = pixels_de(image_riche())
    palettes = {par_kmoyennes(pixels, 12, graine=g).tobytes() for g in range(6)}
    assert len(palettes) > 1, "la graine ne change jamais rien : ce n'est pas un réglage"


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 2 · l'octree — il sature moins vite
# ═════════════════════════════════════════════════════════════════════════════


def test_l_octree_ne_rend_pas_moins_de_couleurs_que_la_coupe_mediane():
    """*« Quand on demande 32 couleurs et qu'on en obtient 14. »*

    C'est la raison d'être de l'algorithme : sur une image bariolée il rend un
    compte **plus proche** de celui qu'on a demandé. L'essai est écrit comme une
    non-régression du compte, pas comme une promesse d'exactitude — sur une
    image simple, la planche dit elle-même que la différence ne se voit pas.
    """
    pixels = pixels_de(image_riche())
    for combien in (8, 16, 32):
        assert par_octree(pixels, combien).shape[0] >= par_coupe_mediane(
            pixels, combien
        ).shape[0] - 1


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 3 · la trame régulière — le motif ne bouge pas d'une frame à l'autre
# ═════════════════════════════════════════════════════════════════════════════


def test_la_trame_est_declaree_et_implementee():
    """**Trois valeurs déclarées, trois valeurs implémentées.**

    `bayer` avait été écrit dans le domaine puis retiré le jour même, faute
    d'être rendu par la bibliothèque : un réglage qu'une recette enregistre et
    que personne n'applique est un mensonge qui se réveille des mois plus tard.
    """
    assert TRAMAGES == (AUCUN, FLOYD, TRAME)
    image = image_riche()
    palette = ("#000000", "#ffffff")
    sans = quantifier(image, Quantification(couleurs=2, palette=palette))
    avec = quantifier(
        image, Quantification(couleurs=2, palette=palette, tramage=TRAME)
    )
    assert not np.array_equal(sans, avec), "la trame déclarée ne fait rien"


def test_la_trame_pose_ses_points_toujours_au_meme_endroit():
    """**Ce qui distingue la trame de Floyd, et c'est tout son intérêt.**

    Le semis de Floyd se recalcule à chaque frame — l'herbe grésille. Une trame
    ordonnée décide par la *position* du pixel : deux images identiques décalées
    d'un multiple du motif reçoivent leurs points aux mêmes endroits.
    """
    cote = 32
    uni = np.zeros((cote, cote, 4), dtype=np.uint8)
    uni[:, :, :3] = (128, 128, 128)
    uni[:, :, 3] = 255
    q = Quantification(couleurs=2, palette=("#000000", "#ffffff"), tramage=TRAME)
    rendu = quantifier(uni, q)[:, :, 0]
    # Le motif se répète : la tuile du coin se retrouve à l'identique un motif
    # plus loin, dans les deux sens.
    tuile = rendu[:COTE_DE_LA_TRAME, :COTE_DE_LA_TRAME]
    assert np.array_equal(
        tuile,
        rendu[
            COTE_DE_LA_TRAME : 2 * COTE_DE_LA_TRAME,
            COTE_DE_LA_TRAME : 2 * COTE_DE_LA_TRAME,
        ],
    )


def test_un_aplat_trame_melange_bien_deux_couleurs():
    """Un gris moyen sur une palette noir-et-blanc doit rendre **les deux**, à
    peu près à parts égales — c'est ce que « de loin l'œil les mélange » veut
    dire, et sans tramage il ne rendrait qu'une seule des deux."""
    uni = np.zeros((32, 32, 4), dtype=np.uint8)
    uni[:, :, :3] = (128, 128, 128)
    uni[:, :, 3] = 255
    q = Quantification(couleurs=2, palette=("#000000", "#ffffff"), tramage=TRAME)
    part_blanche = (quantifier(uni, q)[:, :, 0] > 127).mean()
    assert 0.3 < part_blanche < 0.7, f"le damier est déséquilibré : {part_blanche:.0%}"


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 4 · la force du tramage
# ═════════════════════════════════════════════════════════════════════════════


def test_le_neutre_de_la_force_est_cent_et_non_zero():
    """**Le seul réglage de la tranche dont le neutre n'est pas la valeur vide.**

    La planche affiche « par défaut : 0 », mais elle l'affiche sur un écran où
    aucun tramage n'est choisi et où le curseur est grisé. Le neutre d'une clé
    neuve se lit à l'autre bout : c'est la valeur pour laquelle une recette
    d'avant rend exactement l'image qu'elle rendait — et le tramage
    d'aujourd'hui est plein.
    """
    assert FORCE_TRAMAGE_LIVREE == 100
    assert Quantification().force_tramage == 100
    assert "force_tramage" not in Quantification(tramage=FLOYD).en_json()


@pytest.mark.parametrize("tramage", [TRAME, FLOYD])
def test_une_force_nulle_eteint_le_tramage(tramage):
    """*Zéro veut dire sans effet, pas presque sans effet* — la promesse de la
    veille (`U4`), au cran du réglage.

    La référence est prise **sur le même chemin** — sans tramage mais à force
    nulle elle aussi —, sinon on mesurerait l'écart entre Pillow et la carte
    maison au lieu de mesurer la force.
    """
    image = image_riche()
    palette = ("#000000", "#6b5a44", "#ffffff")
    sans = quantifier(
        image,
        Quantification(couleurs=3, palette=palette, tramage=AUCUN, force_tramage=0),
    )
    force_nulle = quantifier(
        image,
        Quantification(couleurs=3, palette=palette, tramage=tramage, force_tramage=0),
    )
    assert np.array_equal(sans, force_nulle)


def test_la_force_dose_vraiment_le_semis():
    """*« À 30 %, seuls les grands dégradés reçoivent des points. »*

    Moins de force, moins de pixels détournés de leur plus proche couleur. On le
    mesure contre le rendu sans tramage, qui est la référence.
    """
    image = image_riche()
    palette = ("#000000", "#6b5a44", "#ffffff")
    nu = quantifier(
        image,
        Quantification(couleurs=3, palette=palette, tramage=AUCUN, force_tramage=0),
    )

    def points(force: int) -> float:
        rendu = quantifier(
            image,
            Quantification(
                couleurs=3, palette=palette, tramage=TRAME, force_tramage=force
            ),
        )
        return float((rendu[:, :, :3] != nu[:, :, :3]).any(axis=2).mean())

    assert points(20) < points(60) < points(100)


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 5 · la distance à l'œil
# ═════════════════════════════════════════════════════════════════════════════


def test_la_distance_a_l_oeil_garde_le_vert_vert():
    """*« Le vert vif de la grenouille peut partir sur un gris-vert terne parce
    qu'il en est proche au calcul. Avec une distance à l'œil, il part sur le vert
    du jeu. »*

    L'essai construit exactement ce piège : une palette où un gris-vert terne est
    plus proche du vert franc **en RVB** que le vrai vert du jeu ne l'est.
    """
    vert = np.zeros((8, 8, 4), dtype=np.uint8)
    vert[:, :, :3] = VERT_GRENOUILLE
    vert[:, :, 3] = 255

    gris_vert, vert_du_jeu = "#8c9e8c", "#2f9e3f"
    palette = (gris_vert, vert_du_jeu)

    def rendue(distance: str) -> str:
        sortie = quantifier(
            vert, Quantification(couleurs=2, palette=palette, distance=distance)
        )
        r, v, b = sortie[0, 0, :3]
        return f"#{r:02x}{v:02x}{b:02x}"

    assert rendue(OEIL) == vert_du_jeu, "à l'œil, le vert doit rester vert"


def test_les_deux_distances_sont_declarees_et_agissent():
    """Deux valeurs, et la seconde ne fait pas la même chose que la première —
    sinon le réglage serait posé sans agir, ce que `docs/PIEGES.md` compte comme
    pire qu'un réglage absent."""
    assert DISTANCES == (BRUTE, OEIL)
    image = image_riche()
    palette = ("#8c9e8c", "#2f9e3f", "#6b5a44", "#000000")
    brute = quantifier(image, Quantification(couleurs=4, palette=palette))
    oeil = quantifier(
        image, Quantification(couleurs=4, palette=palette, distance=OEIL)
    )
    assert not np.array_equal(brute, oeil)


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 6 · ne compter que les pixels qu'on voit
# ═════════════════════════════════════════════════════════════════════════════


def test_le_magenta_cache_ne_prend_plus_une_place_de_la_palette():
    """**La panne mesurée par la planche, reproduite puis réparée.**

    *« Le magenta qu'on vient de retirer est encore là, sous la transparence, et
    il entre dans le compte : demander 8 couleurs en rend 7 visibles. »* Une
    animation ne compte déjà que les pixels visibles ; une image seule, non.
    """
    image = image_riche(detouree=True)
    avant = couleurs_obtenues(quantifier(image, Quantification(couleurs=8)))
    apres = couleurs_obtenues(
        quantifier(image, Quantification(couleurs=8, visibles_seuls=True))
    )
    assert apres > avant, (
        f"le magenta caché prend encore une place : {avant} avant, {apres} après"
    )
    assert apres == 8


def test_ne_compter_que_le_visible_ne_touche_jamais_l_alpha():
    """La quantification ne touche jamais la transparence — l'autre moitié du
    piège du liseré, et elle vaut pour le chemin neuf comme pour l'ancien."""
    image = image_riche()
    for q in (
        Quantification(couleurs=8, visibles_seuls=True),
        Quantification(couleurs=8, algorithme=OCTREE),
        Quantification(couleurs=8, tramage=TRAME),
    ):
        assert np.array_equal(quantifier(image, q)[:, :, 3], image[:, :, 3])


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 7 · les couleurs gardées
# ═════════════════════════════════════════════════════════════════════════════


def test_une_couleur_gardee_survit_a_une_palette_serree():
    """*« On pique le noir du contour et le vert de la grenouille : à 8 couleurs,
    le contour reste noir au lieu de virer brun foncé. »*"""
    image = image_riche()
    vert = "#%02x%02x%02x" % VERT_GRENOUILLE
    sortie = quantifier(
        image, Quantification(couleurs=4, gardees=(vert,), visibles_seuls=True)
    )
    presentes = {
        "#%02x%02x%02x" % tuple(int(c) for c in p)
        for p in np.unique(sortie[:, :, :3].reshape(-1, 3), axis=0)
    }
    assert vert in presentes, "la couleur gardée a été fondue avec une voisine"


def test_les_couleurs_gardees_prennent_leur_place_dans_le_compte():
    """**Elles sont posées d'office, donc elles coûtent une place.** À 8
    couleurs, en garder deux laisse six places à l'algorithme — et le total reste
    borné par ce qu'on a demandé."""
    image = image_riche()
    sortie = quantifier(
        image,
        Quantification(couleurs=8, gardees=("#1edc3c", "#000000"), visibles_seuls=True),
    )
    assert couleurs_obtenues(sortie) <= 8


def test_une_pastille_vide_ne_change_pas_l_empreinte():
    """Un état de passage — le temps d'aller chercher la couleur — ne doit pas
    faire recalculer tout le rendu. Même règle que `echanges_vifs` en `B17`."""
    nue = Recette(quantification=Quantification(couleurs=8))
    brouillon = Recette(quantification=Quantification(couleurs=8, gardees=("", "")))
    assert nue.empreinte() == brouillon.empreinte()


def test_on_ne_garde_pas_plus_de_six_couleurs():
    """La borne de la planche, tenue par le domaine : au-delà, il ne resterait
    plus rien à choisir à l'algorithme."""
    trop = Quantification(couleurs=32, gardees=tuple(f"#{n:06x}" for n in range(12)))
    assert len(trop.gardees_vives) == GARDEES_MAX


def test_le_service_refuse_douze_couleurs_gardees_au_lieu_de_les_tronquer():
    """⚠️ **Le domaine tronque, le service refuse — et le service le faisait mal.**

    `gardees_vives` coupe déjà à six : c'est sa règle, il relit des fichiers et
    ne juge pas. Le filet du service, lui, doit *nommer* ce qui dépasse — c'est
    ce que son commentaire promet. Il lisait pourtant la liste déjà coupée, donc
    sa condition ne pouvait jamais être vraie, et douze couleurs passaient en
    perdant six en silence. Il lit maintenant les couleurs **déclarées**.

    `_verifier` ne touche pas à `self` : on l'appelle tel quel, sans monter un
    service entier pour une condition d'une ligne.
    """
    douze = Recette(
        quantification=Quantification(
            couleurs=32, gardees=tuple(f"#{n:06x}" for n in range(12))
        )
    )
    with pytest.raises(RecetteRefusee, match="on ne garde pas plus de 6 couleurs"):
        ServiceAssets._verifier(None, douze)

    # Six passent, et douze doublons de la même couleur aussi : ce qui est
    # refusé, c'est de nommer plus de six couleurs, pas d'en répéter une.
    ServiceAssets._verifier(
        None,
        Recette(
            quantification=Quantification(
                couleurs=32, gardees=tuple(f"#{n:06x}" for n in range(6))
            )
        ),
    )
    ServiceAssets._verifier(
        None,
        Recette(quantification=Quantification(couleurs=32, gardees=("#1edc3c",) * 12)),
    )


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 8 · les rampes d'ombre
# ═════════════════════════════════════════════════════════════════════════════


def test_les_rampes_groupent_les_familles_et_vont_du_sombre_au_clair():
    """*« Les bruns ensemble, les verts ensemble, du plus sombre au plus clair. »*

    ⚠️ **Le piège est le brun sombre.** Le chroma d'OKLab s'effondre avec la
    clarté : mesuré à l'écriture, un seuil de gris absolu rangeait `#2b1d10` —
    un brun franc — avec les gris, c'est-à-dire précisément le premier de la
    rampe que la planche veut voir. Le seuil est donc rapporté à la clarté.
    """
    palette = (
        "#2b1d10", "#7a5230", "#c49a6c",   # trois bruns
        "#1e4d2b", "#3c8f4f",              # deux verts
        "#222222", "#888888", "#dddddd",   # trois gris
    )
    groupes = rampes(palette)
    familles = [set(g) for g in groupes]
    assert {"#2b1d10", "#7a5230", "#c49a6c"} in familles, "les bruns ne sont pas ensemble"
    assert {"#1e4d2b", "#3c8f4f"} in familles, "les verts ne sont pas ensemble"
    assert {"#222222", "#888888", "#dddddd"} in familles, "les gris ne sont pas ensemble"

    for groupe in groupes:
        if groupe == ("#2b1d10", "#7a5230", "#c49a6c"):
            assert list(groupe) == ["#2b1d10", "#7a5230", "#c49a6c"], (
                "une rampe se lit du plus sombre au plus clair"
            )


def test_un_tan_clair_n_est_pas_un_gris():
    """⚠️ **Le défaut que l'atelier jetable a montré, et qu'aucun essai ne voyait.**

    Un premier seuil de gris à 0,10 en chroma-sur-clarté rangeait `#af9169` — un
    tan mesuré à 0,0985 — avec les gris : il frôlait le bord du trou au lieu de
    se poser au milieu. Les deux bords sont épinglés ici, de sorte qu'un seuil
    déplacé d'un côté ou de l'autre fasse échouer la suite.
    """
    palette = ("#212121", "#959595", "#8a9099", "#af9169", "#c49a6c", "#3c8f4f")
    groupes = rampes(palette)
    des_gris = next(g for g in groupes if "#959595" in g)
    assert "#af9169" not in des_gris, "un tan clair a été rangé avec les gris"
    assert "#c49a6c" not in des_gris
    # Un gris bleuté, lui, reste un gris : il n'a pas de teinte à porter.
    assert "#8a9099" in des_gris
    assert "#212121" in des_gris


def test_les_rampes_ne_perdent_ni_n_inventent_aucune_couleur():
    """Un rangement range : il ne retire rien et n'ajoute rien."""
    palette = ("#2b1d10", "#7a5230", "#1e4d2b", "#888888", "#c0392b", "#2980b9")
    plates = [c for groupe in rampes(palette) for c in groupe]
    assert sorted(plates) == sorted(palette)


def test_ranger_la_palette_ne_change_aucune_image():
    """*« Les ranger ne change aucune image : ça change ce qu'on voit en les
    regardant. »* Le rangement est une lecture, et une lecture ne peint rien."""
    image = image_riche()
    palette = ("#2b1d10", "#7a5230", "#c49a6c", "#1e4d2b")
    q = Quantification(couleurs=4, palette=palette)
    rangee = tuple(c for groupe in rampes(palette) for c in groupe)
    assert np.array_equal(
        quantifier(image, q),
        quantifier(image, Quantification(couleurs=4, palette=rangee)),
    )


def test_une_palette_vide_se_range_sans_lever():
    assert rampes(()) == ()
    assert rampes(("",)) == ()


# ═════════════════════════════════════════════════════════════════════════════
# Moteur 9 · « 24 demandées, 14 obtenues »
# ═════════════════════════════════════════════════════════════════════════════


def test_le_compte_obtenu_ne_regarde_que_les_pixels_visibles():
    """**Ce que l'auteur regarde.** Une couleur cachée sous la transparence n'est
    pas une couleur qu'il a obtenue : la compter rendrait 15 là où l'écran montre
    14, et le chiffre servirait à expliquer un écart en en créant un autre."""
    image = image_riche(detouree=True)
    # Le magenta est sous la transparence : il ne doit pas être compté.
    assert couleurs_obtenues(image) == len(
        np.unique(image[:, :, :3][image[:, :, 3] > 0].reshape(-1, 3), axis=0)
    )
    vide = np.zeros((4, 4, 4), dtype=np.uint8)
    assert couleurs_obtenues(vide) == 0


def test_le_compte_obtenu_est_bien_plus_bas_que_le_compte_demande():
    """*« Demander 32 en rend 14 à 28. »* C'est l'écart que le chiffre existe
    pour rendre visible, et il est réel : on l'épingle plutôt que de le taire.

    **L'écart est mesuré, pas supposé** : sur cette image-ci, 64 demandées en
    rendent 63. L'image est fabriquée et la coupe médiane ne tire rien au sort,
    donc les deux nombres sont les mêmes à chaque exécution — c'est ce qui permet
    d'écrire l'inégalité stricte plutôt qu'un vœu."""
    image = image_riche()
    obtenues = couleurs_obtenues(quantifier(image, Quantification(couleurs=64)))
    assert obtenues <= 64, "le compte obtenu ne dépasse jamais le compte demandé"
    assert obtenues < 64, (
        f"l'écart « demandées / obtenues » a disparu : {obtenues} sur 64 — "
        "si c'est un gain réel, c'est le chiffre de la docstring qu'il faut "
        "reprendre, pas l'assertion"
    )


# ═════════════════════════════════════════════════════════════════════════════
# Les mesures de temps — le critère de la tranche
# ═════════════════════════════════════════════════════════════════════════════

#: Le seuil de `B16` : au-delà, l'écran montre sa jauge. Ce n'est pas un budget
#: que le serveur doit tenir en toutes circonstances — c'est le seuil à partir
#: duquel **l'auteur doit être prévenu**, et la jauge le fait déjà.
SEUIL_DE_LA_JAUGE = 240


@pytest.mark.parametrize(
    "nom, quantification",
    [
        ("coupe médiane", Quantification(couleurs=32)),
        ("k-moyennes", Quantification(couleurs=32, algorithme=KMOYENNES, graine=1)),
        ("octree", Quantification(couleurs=32, algorithme=OCTREE)),
        ("distance à l'œil", Quantification(couleurs=32, distance=OEIL)),
        ("pixels visibles", Quantification(couleurs=32, visibles_seuls=True)),
        ("trame régulière", Quantification(couleurs=32, tramage=TRAME)),
        ("trame à 30 %", Quantification(couleurs=32, tramage=TRAME, force_tramage=30)),
        ("couleurs gardées", Quantification(couleurs=32, gardees=("#1edc3c",))),
    ],
)
def test_chaque_moteur_tient_le_seuil_de_la_jauge_sur_une_case(nom, quantification):
    """**La mesure est bornée par un essai**, comme en `B17`.

    Sur une case de 64 carrés — la taille où le produit quantifie réellement, la
    place `quantification` venant *après* la grille. Un moteur qui dépasserait
    les 240 ms de `B16` sur une case fait échouer la suite.

    ⚠️ **La diffusion à force réduite n'est pas dans cette liste**, et c'est
    mesuré : voir l'essai suivant.
    """
    image = image_riche(64)
    duree = chronometre(quantifier, image, quantification)
    print(f"\n  {nom}, sur une case de 64 : {duree:.1f} ms")
    assert duree < SEUIL_DE_LA_JAUGE, f"{nom} coûte {duree:.0f} ms sur une case de 64"


def test_la_diffusion_a_force_reduite_est_le_moteur_lent_et_on_le_dit():
    """⚠️ **Le seul moteur de la tranche qui dépasse le seuil, et il le dépasse
    par construction.**

    Floyd-Steinberg est le seul algorithme de l'atelier qu'on ne peut pas écrire
    en tableaux : le voisin de droite doit avoir reçu l'erreur du pixel courant
    avant d'être décidé, donc la boucle est irréductible en Python.

    **À pleine force, ce chemin n'est jamais pris** — Pillow diffuse en C et rend
    la même image —, et c'est le cas de loin le plus courant. La boucle ne sert
    qu'à ce que Pillow ne sait pas faire : doser la force, et mesurer à l'œil.

    L'essai épingle le fait plutôt que de le taire : c'est lent, l'écran le dit
    avec sa jauge, et le chiffre est ici pour qu'une accélération future se
    mesure contre lui.
    """
    image = image_riche(64)
    pleine = chronometre(
        quantifier, image, Quantification(couleurs=32, tramage=FLOYD, algorithme=OCTREE)
    )
    reduite = chronometre(
        quantifier,
        image,
        Quantification(couleurs=32, tramage=FLOYD, force_tramage=30),
        tours=1,
    )
    print(
        f"\n  diffusion, sur une case de 64 : {pleine:.1f} ms à pleine force, "
        f"{reduite:.1f} ms à force réduite"
    )
    assert pleine < SEUIL_DE_LA_JAUGE, "la diffusion pleine passe par Pillow, elle doit être rapide"
    # La borne est large : elle protège d'une régression d'un ordre de grandeur,
    # pas d'une machine plus lente que celle du jour.
    assert reduite < 5_000


def test_la_memoire_reste_bornee_sur_une_grande_image():
    """**Le garde-fou de `B17`, repris : le pic de mémoire ne dépend pas de la
    machine.**

    La carte des pixels sur la palette pouvait peser un gigaoctet — un million de
    pixels contre 256 couleurs en flottants. Deux choses l'en empêchent : on
    mesure les *couleurs distinctes* et non les pixels, et le calcul se fait par
    blocs. L'essai vérifie que le résultat sort, et sort juste, sur une image
    bien plus grande qu'une case.
    """
    import tracemalloc

    image = image_riche(512)
    tracemalloc.start()
    sortie = quantifier(image, Quantification(couleurs=32, algorithme=OCTREE))
    _, pic = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    print(f"\n  octree, sur 512 px : pic {pic / 1e6:.0f} Mo")
    assert pic < 400e6, f"le pic de mémoire est de {pic / 1e6:.0f} Mo"
    assert couleurs_obtenues(sortie) <= 32


def test_la_memoire_reste_bornee_quand_c_est_l_image_qui_est_la_grande_liste():
    """⚠️ **Le cas que l'essai d'au-dessus ne voyait pas**, et il cassait pour de
    bon.

    L'essai précédent mesure l'octree sur une image *pauvre* en couleurs : la
    grande liste y est celle des pixels, la petite celle de la palette, et
    découper les pixels en blocs suffisait. Les trois algorithmes appellent
    pourtant `_plus_proches` **à l'envers** pour ramener leurs couleurs calculées
    sur des couleurs réelles — la palette d'un côté, *toutes les couleurs
    distinctes de l'image* de l'autre. Rien ne bornait ce côté-là.

    Mesuré sur cette image-ci, 512 px de bruit et 260 000 couleurs distinctes :
    **1 603 Mo** avant la réparation, 240 Mo après. À 2 048 px — la taille d'un
    rendu réel — le même chemin montait à plusieurs gigaoctets et rendait la
    table *Couleurs* inutilisable sur une machine ordinaire.

    **La coupe médiane, et pas une autre** : elle était la seule des trois à ne
    pas passer par `_echantillon`, donc la seule dont l'histogramme suivait la
    surface de l'image. Un futur agent qui retirerait l'un des deux garde-fous —
    le découpage des cibles en blocs, ou l'échantillon — fait échouer cet essai.
    """
    import tracemalloc

    image = image_bariolee(512)
    distinctes = np.unique(image[:, :, :3].reshape(-1, 3), axis=0).shape[0]
    assert distinctes > 250_000, "sans quoi cet essai ne prouve rien"

    # Un réglage posé, sinon c'est le chemin Pillow d'avant qui s'exécute et
    # aucune ligne de `B18` n'est mesurée.
    pose = Quantification(couleurs=256, algorithme=MEDIANE, visibles_seuls=True)
    assert not pose.reglages_de_b18_neutres

    tracemalloc.start()
    sortie = quantifier(image, pose)
    _, pic = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    print(
        f"\n  coupe médiane, 512 px et {distinctes} couleurs distinctes : "
        f"pic {pic / 1e6:.0f} Mo"
    )
    assert pic < 600e6, f"le pic de mémoire est de {pic / 1e6:.0f} Mo"
    assert couleurs_obtenues(sortie) <= 256


def test_la_coupe_mediane_plafonne_son_histogramme_comme_les_deux_autres():
    """**Le second garde-fou, énoncé tout seul.** La palette d'un tableau plus
    grand que le plafond est celle de son échantillon — c'est ce que veut dire
    *« elle passe par `_echantillon` »*, et l'essai le dit sans passer par une
    mesure de mémoire, qui dépend de la machine."""
    tirage = np.random.default_rng(11)
    pixels = tirage.integers(0, 256, size=(PIXELS_AU_PLUS * 2, 3), dtype=np.uint8)
    assert pixels.shape[0] > PIXELS_AU_PLUS
    for algorithme in ALGORITHMES:
        entiere = palette_par(algorithme, pixels, 32)
        plafonnee = palette_par(algorithme, _echantillon(pixels), 32)
        assert np.array_equal(entiere, plafonnee), algorithme


def test_le_decoupage_en_blocs_rend_exactement_le_meme_rang():
    """**Les blocs bornent la mémoire, ils ne changent pas une couleur.**

    Un `argmin` d'un seul tenant rend le **premier** minimum ; le parcours par
    blocs ne remplace la meilleure cible connue qu'en étant *strictement* plus
    proche, ce qui garde le même rang à égalité. L'essai le vérifie là où les
    égalités abondent — cinq valeurs par canal — parce que c'est le seul endroit
    où les deux calculs pourraient diverger, et une divergence d'un rang est une
    couleur de moins dans l'image.
    """
    tirage = np.random.default_rng(3)
    points = (tirage.integers(0, 5, size=(700, 3)) * 60).astype(np.float32)
    cibles = (tirage.integers(0, 5, size=(900, 3)) * 60).astype(np.float32)
    attendu = np.argmin(
        ((points[:, None, :] - cibles[None, :, :]) ** 2).sum(axis=2), axis=1
    )
    depart = module_palette._COUPLES_PAR_BLOC
    try:
        # Des blocs volontairement minuscules : un par cible, puis trois, puis
        # tout d'un coup — les trois découpages doivent rendre le même vecteur.
        for couples in (points.shape[0], points.shape[0] * 3, depart):
            module_palette._COUPLES_PAR_BLOC = couples
            obtenu = module_palette._plus_proches(points, cibles)
            assert np.array_equal(obtenu, attendu), couples
    finally:
        module_palette._COUPLES_PAR_BLOC = depart


# ═════════════════════════════════════════════════════════════════════════════
# Le tour du fil : le serveur borne, l'écran ne devine pas
# ═════════════════════════════════════════════════════════════════════════════


def test_le_domaine_relit_ce_qu_il_ecrit():
    """Un aller-retour complet, tous les réglages posés."""
    pose = Quantification(
        couleurs=24,
        tramage=TRAME,
        algorithme=KMOYENNES,
        graine=9,
        force_tramage=40,
        distance=OEIL,
        visibles_seuls=True,
        gardees=("#1edc3c", "#000000"),
    )
    assert Quantification.depuis_json(pose.en_json()) == pose
