# -*- coding: utf-8 -*-
"""Les critères d'acceptation de D4 — les moteurs s'ouvrent, le contour se pose net.

Un test par critère de `docs/archive/plan-r6-a-v3.02.md` § D4, nommé d'après lui.

**Ce que la tranche livre, une fois le faux retiré.** Sa première version
réclamait *« un cran intermédiaire entre nos deux modèles »* et *« un catalogue
qui cesse d'être deux noms en dur »* : le produit portait **trois** modèles
depuis `U13`, dans un catalogue structuré, et celui du milieu s'appelait
littéralement « intermédiaire ». L'erreur venait du relevé d'outillage, recopiée
sans vérifier. Ce qui reste vrai après le tri est ce que ces tests couvrent.

**Ce que ce fichier vérifie, et ce qu'il délègue.** Les cinq réparations qui
tiennent dans le code sont ici — le catalogue, la croix à un pixel, les deux
régimes du contour, le rongement conditionnel, la décontamination. Ce qui demande
de faire tourner cinq modèles sur de vraies images vit dans
`essais/essai_moteurs_de_detourage.py`, gratuit, et son relevé est **versionné** :
les tests qui portent sur une mesure la relisent dans le dépôt plutôt que de la
recalculer, exactement comme le prix d'une planche en `E13`.

**Aucun test de ce fichier ne coûte un centime, et aucun ne charge un modèle** :
tout se joue sur des tableaux NumPy et sur le relevé déjà écrit.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np

from atelier.domaine.recette import Contour, Grille, Passe, Recette
from atelier.image.traitement import (
    CARRE,
    CROIX,
    MODELE_ONNX,
    SILHOUETTES,
    _couleur_enlevee,
    _voisin_interieur,
    contourner,
    decontaminer,
    durcir,
    etat_des_silhouettes,
    etendre,
    pourtour,
    queue,
    retrouver_grille,
    ronger,
    ronger_conditionnel,
    silhouette,
)

RACINE = Path(__file__).resolve().parents[1]
RELEVE = RACINE / "essais" / "mesures_moteurs_de_detourage.json"
PLACES = RACINE / "interface" / "src" / "composants" / "Places.tsx"
FICHE = RACINE / "interface" / "src" / "composants" / "Fiche.tsx"


def _releve() -> dict:
    """Le relevé du banc, **versionné**. Une mesure qui ne serait pas dans le
    dépôt serait un chiffre en dur."""
    assert RELEVE.is_file(), (
        "le relevé du banc de D4 n'est pas dans le dépôt — "
        "`py essais/essai_moteurs_de_detourage.py`"
    )
    return json.loads(RELEVE.read_text(encoding="utf-8"))


# ── Critère 3 — le catalogue accueille les modèles sans qu'une règle change ──


def test_le_catalogue_porte_les_deux_modeles_qui_manquaient():
    """**Deux manques réels, et ce sont les seuls qui restaient.**

    Aucun de nos trois modèles n'était entraîné sur du dessin, et nos images sont
    des dessins ; et l'allégé du lourd n'avait jamais été essayé parce que son
    aîné coûte 972 Mo d'entrée de jeu.
    """
    noms = {s.nom for s in SILHOUETTES}

    assert "isnet-anime" in noms, "le seul modèle entraîné sur du dessin"
    assert "birefnet-general-lite" in noms, "l'allégé du lourd"


def test_chaque_modele_annonce_son_poids_avant_le_rapatriement():
    """**Poids annoncé avant le rapatriement**, et c'est le critère à la lettre.

    C'est la règle d'`U13`, qui ne bouge pas : un modèle *pas encore descendu*
    reste choisissable et dit ce qu'il va rapatrier ; un moteur *pas installé du
    tout* porte une raison et se grise. Les deux modèles neufs n'y échappent pas.
    """
    for lu in etat_des_silhouettes():
        assert lu["octets"] > 0, f"{lu['nom']} n'annonce pas son poids"
        assert isinstance(lu["descendu"], bool)
        assert "raison" in lu


def test_le_catalogue_dit_a_quel_cote_chaque_modele_infere():
    """**Le nombre qui décide de ce qu'un modèle peut rendre, et il n'était nulle
    part.** Un masque calculé en 320 puis étiré à 1024 perd tout ce qui est plus
    fin que trois pixels ; deux modèles voisins par le poids peuvent différer là
    du tout au tout."""
    par_nom = {s.nom: s for s in SILHOUETTES}

    assert par_nom["u2net"].entree == 320
    for nom in ("isnet-general-use", "isnet-anime", "birefnet-general", "birefnet-general-lite"):
        assert par_nom[nom].entree == 1024, nom
    # Et il sort par la route que l'écran lit.
    assert all("entree" in lu and "licence" in lu for lu in etat_des_silhouettes())


def test_le_choix_du_modele_reste_passe_par_passe():
    """**Aucune autre règle ne change** : le modèle est un champ de la passe, pas
    un réglage global, et un nom inconnu arrive sans effet plutôt que de casser
    la recette."""
    assert Passe().modele == "", "vide veut dire le défaut du produit"
    assert silhouette("").nom == MODELE_ONNX
    assert silhouette("isnet-anime").nom == "isnet-anime"
    assert silhouette("un-modele-qui-n-existe-pas") is None


def test_le_produit_compte_quatre_moteurs_et_cinq_modeles():
    """**Le compte que la première version de la tranche donnait faux.** Elle
    parlait de deux modèles et de trois moteurs de découpe ; le produit en avait
    trois et quatre. Ce test fige les deux comptes pour que l'erreur ne reparte
    pas d'un document non vérifié."""
    from atelier.domaine.recette import MOTEURS

    assert len(MOTEURS) == 4
    assert len(SILHOUETTES) == 5


# ── Critères 1 et 2 — les deux modèles neufs, essayés et le résultat écrit ──


def test_le_modele_entraine_sur_du_dessin_est_essaye_et_le_resultat_ecrit():
    """**Critère 1.** Aucun de nos trois modèles n'était entraîné sur du dessin —
    ils viennent tous de la photographie, et nos images sont des dessins.
    `isnet-anime` est le seul du catalogue de `rembg` qui ne le soit pas, et il
    n'avait jamais été essayé.

    Le résultat est **dans le dépôt**, pas dans une session : c'est la règle du
    prix d'une planche en `E13` — un chiffre mesuré qui ne serait pas versionné
    serait un chiffre en dur.
    """
    essayes = {ligne["modele"] for ligne in _releve()["modeles"]}

    assert "isnet-anime" in essayes, (
        "le modèle entraîné sur du dessin n'a pas été essayé — "
        "`py essais/essai_moteurs_de_detourage.py --descendre`"
    )


def test_l_allege_du_lourd_est_essaye_et_l_ecart_mesure():
    """**Critère 2.** Essayer le modèle lourd coûte 972 Mo d'entrée de jeu, et
    c'est pour ça qu'on ne l'essaie pas. Son allégé pèse un onzième, et l'écart
    de qualité entre les deux devait être mesuré, pas supposé."""
    lignes = _releve()["modeles"]
    essayes = {ligne["modele"] for ligne in lignes}

    assert "birefnet-general-lite" in essayes, (
        "l'allégé du lourd n'a pas été essayé — "
        "`py essais/essai_moteurs_de_detourage.py --descendre`"
    )
    assert "birefnet-general" in essayes, "sans le lourd, il n'y a pas d'écart"
    # Et l'écart est bien mesuré : les deux ont un accord relevé.
    paires = [set(a["entre"]) for a in _releve()["accords"]]
    assert {"birefnet-general", "birefnet-general-lite"} in paires


# ── Critère 4 — le défaut du moteur par modèle, tranché sur mesure ───────────


def test_le_defaut_du_moteur_par_modele_infere_a_la_taille_de_l_image():
    """**Le verdict de la mesure, et il est écrit dans le code avec ses chiffres.**

    `u2net` inférait à 320 puis réagrandissait son masque en Lanczos ;
    `isnet-general-use` infère à 1024 et ne réagrandit rien.
    """
    assert MODELE_ONNX == "isnet-general-use"
    assert silhouette(MODELE_ONNX).entree == 1024


def test_le_verdict_du_defaut_repose_sur_une_mesure_versionnee():
    """**Comparés sur les mêmes images, et le verdict écrit** — le critère à la
    lettre. Ce qui a tranché n'est pas la part gardée, qui est la même à quatre
    millièmes près : c'est **l'ajouré trouvé**, le seul chiffre qui sépare deux
    masques de même surface."""
    verdict = _releve()["verdict_defaut"]

    assert set(verdict) == {"u2net", "isnet-general-use"}
    # Les deux gardent la même surface…
    assert abs(verdict["u2net"]["part"] - verdict["isnet-general-use"]["part"]) < 0.01
    # …et celui qui infère à 1024 trouve plus de trous.
    assert verdict["isnet-general-use"]["trous"] > verdict["u2net"]["trous"]


# ── Critère 10 — les deux pièges d'intégration, vérifiés avant tout ──────────


def test_les_deux_pieges_d_integration_sont_verifies_et_le_verdict_ecrit():
    """**Vérifiés avant le premier modèle ajouté**, parce qu'une tranche qui
    ajoute un modèle sur un piège non levé le paie deux fois.

    Les deux sont **confirmés dans le code de `rembg`** : la normalisation divise
    par le maximum de l'image et non par 255, et le masque est réagrandi en
    Lanczos depuis le côté d'inférence.
    """
    pieges = _releve()["pieges"]

    assert len(pieges) == 2
    assert all(p["verifie"] for p in pieges), "un piège annoncé et non retrouvé"
    assert any("255" in p["piege"] for p in pieges)
    assert any("Lanczos" in p["piege"] for p in pieges)


def test_le_premier_piege_ne_mord_pas_sur_nos_images_et_c_est_ecrit():
    """**Confirmé dans le code, sans effet ici**, et l'écart mérite d'être dit.

    Diviser par le maximum de l'image est sans effet quand ce maximum vaut 255 —
    ce qui est le cas de toutes nos images, qui sortent sur un fond clair. Le
    piège est réel et il attend ailleurs : une image sombre sans un seul pixel
    clair arriverait au modèle éclaircie.
    """
    facteurs = _releve()["normalisation_sur_nos_images"]

    assert facteurs, "le banc n'a mesuré aucune image"
    assert all(f["facteur"] == 1.0 for f in facteurs)


def test_les_demi_transparences_ne_viennent_pas_du_reagrandissement():
    """⚠️ **Une affirmation héritée que la mesure contredit, et c'est écrit.**

    Trois documents du dépôt citent *« 95 % de pixels à demi transparents »*, et
    le plan de cette tranche en attribuait *« une partie »* au réagrandissement
    du masque de `u2net`. La mesure dit non : `isnet-general-use`, qui infère à
    1024 et ne réagrandit rien, en rend **autant**. Ce n'est pas le
    réagrandissement, c'est la sortie douce du modèle — et c'est le durcissement
    qui la tranche, comme il l'a toujours fait.
    """
    verdict = _releve()["verdict_defaut"]

    ecart = abs(verdict["u2net"]["demi"] - verdict["isnet-general-use"]["demi"])
    assert ecart / max(verdict["u2net"]["demi"], 1) < 0.10, (
        "les deux modèles rendent autant de demi-transparences, à 10 % près — "
        "le réagrandissement n'en est donc pas la cause"
    )


# ── Critère 8 — le rongement devient conditionnel ────────────────────────────


def _sujet_avec_frange() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Un carré de sujet, sa frange contaminée, et une antenne d'un pixel.

    L'antenne est le cas que l'érosion aveugle efface en entier, et c'est le plus
    visible sur un sprite : une lanière, une corde, la pointe d'une épée.
    """
    fond = np.array([200, 200, 200], dtype=np.int16)
    rgb = np.zeros((32, 32, 3), dtype=np.uint8)
    rgb[:, :] = fond
    rgb[8:24, 8:24] = (30, 60, 90)
    for bande in (7, 24):
        rgb[bande, 7:25] = (150, 160, 170)
        rgb[7:25, bande] = (150, 160, 170)
    rgb[2:8, 16] = (30, 60, 90)
    alpha = np.zeros((32, 32), dtype=np.uint8)
    alpha[7:25, 7:25] = 255
    alpha[2:8, 16] = 255
    return rgb, alpha, fond


def test_le_rongement_n_ote_que_les_pixels_plus_proches_du_fond():
    """**Il n'érode plus en aveugle.** Les pixels retirés sont un sous-ensemble
    de ceux que l'érosion aveugle retirait : la réparation ne peut pas manger
    davantage, et c'est ce qui la rend sûre à poser sans réglage."""
    rgb, alpha, fond = _sujet_avec_frange()

    aveugle = ronger(alpha, 1) > 0
    conditionnel = ronger_conditionnel(rgb, alpha, 1, fond) > 0

    assert not (aveugle & ~conditionnel).any(), (
        "le conditionnel doit garder tout ce que l'aveugle garde"
    )
    assert int(conditionnel.sum()) > int(aveugle.sum()), "il en épargne"


def test_un_trait_d_un_pixel_ne_se_ronge_jamais():
    """**Le cas que l'érosion aveugle effaçait en entier.** Aucun pixel d'une
    antenne d'un pixel d'épaisseur n'a de voisin franchement intérieur à qui se
    comparer : on ne le ronge donc pas."""
    rgb, alpha, fond = _sujet_avec_frange()

    aveugle = ronger(alpha, 1) > 0
    conditionnel = ronger_conditionnel(rgb, alpha, 1, fond) > 0

    assert int(aveugle[2:7, 16].sum()) < 5, "l'aveugle mange l'antenne"
    assert int(conditionnel[2:8, 16].sum()) == 6, "le conditionnel la garde entière"


def test_un_second_cran_ne_mange_pas_ce_qui_n_est_pas_contamine():
    """**« Conditionnel » veut dire que le curseur cesse d'agir quand il n'y a
    plus rien à retirer**, et c'est très exactement ce qu'on veut d'un
    durcissement : il enlève le halo, il ne maigrit pas le sujet."""
    rgb, alpha, fond = _sujet_avec_frange()

    un = int((ronger_conditionnel(rgb, alpha, 1, fond) > 0).sum())
    deux = int((ronger_conditionnel(rgb, alpha, 2, fond) > 0).sum())

    assert un == deux
    assert int((ronger(alpha, 2) > 0).sum()) < int((ronger(alpha, 1) > 0).sum())


def test_sans_fond_mesure_on_retombe_sur_l_erosion_aveugle():
    """**Un réglage qui cesserait d'agir sans le dire serait pire que l'érosion
    qu'on répare.** Une passe qui n'a rien enlevé n'a pas de couleur de fond à
    opposer ; le durcissement demandé doit quand même agir."""
    rgb, alpha, _ = _sujet_avec_frange()

    assert np.array_equal(
        ronger_conditionnel(rgb, alpha, 2, None), ronger(alpha, 2)
    )


def test_le_fond_de_la_passe_se_mesure_au_lieu_de_se_demander():
    """**Aucun des quatre moteurs ne déclare la couleur qu'il a prise pour du
    fond** — le modèle ne rend qu'un masque. Mais tous laissent derrière eux les
    pixels qu'ils ont ouverts, et *effacer un pixel ne change pas sa couleur*."""
    rgb, alpha, fond = _sujet_avec_frange()
    avant = np.full(alpha.shape, np.uint8(255))

    mesure = _couleur_enlevee(rgb, avant, alpha)

    assert mesure is not None
    assert np.array_equal(mesure.astype(np.int16), fond)
    # Rien d'enlevé : pas de fond, et l'on ne devine pas.
    assert _couleur_enlevee(rgb, avant, avant) is None


def test_le_voisin_interieur_est_un_pixel_de_l_image_jamais_une_moyenne():
    """**Il ne fabrique aucune couleur.** Une moyenne de deux voisins
    introduirait une teinte que ni le modèle ni la palette ne contiennent, et on
    chercherait ensuite d'où elle vient."""
    rgb, alpha, _ = _sujet_avec_frange()

    couleur, connu = _voisin_interieur(rgb, alpha > 0)

    lues = {tuple(int(c) for c in v) for v in couleur[connu]}
    presentes = {tuple(int(c) for c in v) for v in rgb.reshape(-1, 3)}
    assert lues <= presentes


# ── Critère 9 — un pixel de bord contaminé prend la couleur de son voisin ────


def test_un_pixel_de_bord_contamine_prend_la_couleur_de_son_voisin_interieur():
    """**« De la bonne couleur » devient vrai sur un alpha binaire.** Le pixel
    est gardé — le sujet ne maigrit pas — et il cesse d'être délavé."""
    rgb, alpha, fond = _sujet_avec_frange()

    propre = decontaminer(rgb, alpha, fond, 28)

    # La frange est repeinte de la couleur du sujet…
    assert tuple(int(c) for c in propre[7, 12]) == (30, 60, 90)
    # …et l'intérieur n'a pas bougé d'un pixel.
    assert np.array_equal(propre[12:20, 12:20], rgb[12:20, 12:20])


def test_la_decontamination_ne_fabrique_jamais_de_demi_transparence():
    """**C'est le critère, et c'est ce qui la distingue du matting.** Un bord doux
    est très exactement ce que le durcissement existe pour supprimer : un
    rééchantillonnage au plus proche le tranche à pile ou face, et deux rendus
    donnent deux silhouettes."""
    rgb, alpha, fond = _sujet_avec_frange()

    propre = decontaminer(rgb, alpha, fond, 28)

    assert propre.shape == rgb.shape
    assert propre.dtype == rgb.dtype
    # Elle ne rend que des couleurs : l'alpha lui est passé en lecture seule, et
    # la recette le repose tel quel.
    recette = Recette(passes=(Passe(moteur="bord", durcissement=0),))
    del recette  # la chaîne entière est mesurée par `test_d3`, ici on borne


def test_un_sujet_legitimement_de_la_couleur_du_fond_n_est_pas_repeint():
    """**La seconde condition est ce qui rend la décontamination sûre.** Un mur
    gris sur un fond gris est le cas que D3 rend rare, et que celle-ci ne doit
    pas rouvrir : le pixel est près du fond, mais son voisin intérieur l'est
    autant — il n'est donc pas *plus près du fond que du sujet*."""
    fond = np.array([200, 200, 200], dtype=np.int16)
    rgb = np.zeros((16, 16, 3), dtype=np.uint8)
    rgb[:, :] = fond
    rgb[4:12, 4:12] = (198, 201, 199)  # un sujet gris, à deux niveaux du fond
    alpha = np.zeros((16, 16), dtype=np.uint8)
    alpha[4:12, 4:12] = 255

    propre = decontaminer(rgb, alpha, fond, 28)

    assert np.array_equal(propre, rgb)


def test_sans_fond_mesure_la_decontamination_ne_touche_a_rien():
    """Une passe qui n'a rien enlevé n'a pas de fond, et repeindre sur une
    couleur inventée serait pire que ne rien faire."""
    rgb, alpha, _ = _sujet_avec_frange()

    assert np.array_equal(decontaminer(rgb, alpha, None, 28), rgb)


def test_les_deux_reparations_sont_mesurees_sur_les_images_du_depot():
    """**Comparé à l'érosion aveugle sur les images du dépôt** — le critère à la
    lettre, et le relevé est versionné."""
    releve = _releve()

    assert releve["rongements"], "le banc n'a comparé aucun rongement"
    assert all(l["epargnes"] >= 0 for l in releve["rongements"]), (
        "le conditionnel ne peut pas retirer plus que l'aveugle"
    )
    assert sum(l["epargnes"] for l in releve["rongements"]) > 0
    assert releve["decontamination"], "le banc n'a mesuré aucune décontamination"


# ── Critères 5 et 6 — le contour se pose net ────────────────────────────────


def _peinte(pas: int, phase: int, cases: int = 16) -> np.ndarray:
    """Une image « pixel art » peinte sur une vraie grille, décalée de `phase`.

    C'est le cas que le premier régime doit servir : une image revenue du modèle
    qu'on n'a **pas** posée sur la case du projet, et qui porte donc encore la
    maille sur laquelle il a peint.
    """
    graine = np.random.default_rng(7)
    blocs = graine.integers(0, 255, (cases, cases, 3)).astype(np.uint8)
    gros = np.kron(blocs, np.ones((pas, pas, 1), dtype=np.uint8))
    cote = cases * pas + phase
    rgba = np.zeros((cote, cote, 4), dtype=np.uint8)
    rgba[phase:, phase:, :3] = gros
    debut, fin = phase + 3 * pas, phase + 11 * pas
    rgba[debut:fin, debut:fin, 3] = 255
    return rgba


def test_le_contour_se_pose_sur_la_frontiere_retrouvee_par_d2():
    """**Le premier des deux régimes.** Sans case posée, l'image fait encore
    mille pixels de côté : un trait d'un pixel y est un cheveu invisible, et il
    ne longe pas la frontière du sprite mais les dentelures que le modèle a
    peintes à l'intérieur d'un bloc. Le trait se pose donc sur la maille."""
    image = _peinte(pas=8, phase=3)
    grille = retrouver_grille(image)
    assert grille.trouvee and grille.pas == 8

    sortie = contourner(image, Contour(epaisseur=1, position="externe"), grille)

    # L'image grandit d'**un bloc** de chaque côté, pas d'un pixel.
    assert sortie.shape[0] == image.shape[0] + 2 * 8
    trait = (sortie[:, :, 3] == 255) & (sortie[:, :, :3] == 0).all(axis=2)
    # Un anneau d'un bloc autour d'un sujet de 8 × 8 blocs, en croix : le
    # périmètre en blocs moins ses quatre coins, chaque bloc pesant 8 × 8.
    assert int(trait.sum()) == (10 * 10 - 8 * 8 - 4) * 8 * 8


def test_la_phase_de_la_grille_est_retrouvee_et_pas_supposee():
    """**Le pas seul ne suffit pas à poser un trait dessus.** Une grille de
    modèle ne commence jamais au pixel zéro ; un trait calé au mauvais départ
    tombe à cheval sur deux blocs, ce qui est la moitié du défaut qu'on répare."""
    for phase in (0, 3, 5):
        grille = retrouver_grille(_peinte(pas=8, phase=phase))
        assert grille.trouvee
        assert grille.phase == (phase, phase), f"phase {phase}"


def test_sur_une_peinture_le_contour_longe_l_image_telle_qu_elle_est():
    """**Le second régime, et c'est celui qui ferme le piège.** *Écrire le
    premier régime en supposant que la mesure répond toujours ferait exactement
    le défaut que D2 vient de retirer.* Sur une peinture, la détection se tait,
    et la seule frontière qui existe est celle de l'image."""
    lisse = np.zeros((64, 64, 4), dtype=np.uint8)
    lisse[:, :, :3] = np.linspace(0, 255, 64, dtype=np.uint8)[None, :, None]
    lisse[20:44, 20:44, 3] = 255
    grille = retrouver_grille(lisse)
    assert not grille.trouvee, "une peinture n'a pas de grille"

    sortie = contourner(lisse, Contour(epaisseur=1, position="externe"), grille)

    # Un pixel de débord, comme avant la tranche.
    assert sortie.shape[0] == lisse.shape[0] + 2


def test_le_meme_reglage_rend_deux_fois_le_meme_trait():
    """**Un critère du dépôt, pas un confort.** La recherche de phase et le vote
    de majorité par bloc sont déterministes ; deux rendus de la même recette au
    même moment donnent le même résultat."""
    image = _peinte(pas=8, phase=3)
    contour = Contour(epaisseur=2, position="centre", couleur="#112233")
    grille = retrouver_grille(image)

    un = contourner(image, contour, grille)
    deux = contourner(image, contour, retrouver_grille(image))

    assert np.array_equal(un, deux)


def test_le_contour_d_un_pixel_se_pose_en_croix_et_au_dessus_en_carre():
    """**Les deux ont raison à des épaisseurs différentes.** À une épaisseur, le
    carré pose des pixels dans le prolongement diagonal des coins, ce qu'un pixel
    artiste ne dessine pas ; au-delà, une croix répétée donne un losange."""
    un = np.zeros((9, 9, 4), dtype=np.uint8)
    un[4, 4] = (255, 255, 255, 255)

    a_un = contourner(un, Contour(epaisseur=1, position="externe", couleur="#000000"))
    a_deux = contourner(un, Contour(epaisseur=2, position="externe", couleur="#000000"))

    noir = lambda img: int(  # noqa: E731
        ((img[:, :, 3] == 255) & (img[:, :, :3] == 0).all(axis=2)).sum()
    )
    assert noir(a_un) == 4, "la croix : quatre côtés, pas de coins"
    assert noir(a_deux) == 5 * 5 - 1, "le carré, plein, moins le sujet"


def test_les_deux_formes_du_pinceau_sont_ecrites_une_fois():
    """La croix et le carré sont deux listes de décalages, et il n'y en a qu'une
    de chaque : deux écritures auraient fini par éroder d'une forme et dilater de
    l'autre."""
    assert len(CARRE) == 9 and len(CROIX) == 5
    assert set(CROIX) < set(CARRE)
    plein = np.zeros((7, 7), dtype=bool)
    plein[3, 3] = True
    assert int(etendre(plein, 1).sum()) == 9
    assert int(etendre(plein, 1, croix=True).sum()) == 5


def test_sur_une_case_posee_le_trait_reste_ce_qu_il_etait():
    """**Une fois la case du projet posée, l'image rendue *est* la case** : un
    pixel y est un bloc, et le trait était déjà juste. On ne mesure alors aucune
    grille — ce qui évite aussi de payer un balayage de profils à chaque
    glissement de curseur."""
    grand = np.zeros((64, 64, 4), dtype=np.uint8)
    grand[16:48, 16:48] = (200, 40, 40, 255)
    recette = Recette(
        grille=Grille(cible=16, occupation=100),
        contours=Contour(epaisseur=1, couleur="#112233", position="externe"),
    )

    rendu = queue(grand, recette)

    assert rendu.shape[:2] == (18, 18), "un pixel de trait de chaque côté"


# ── Critère 7 — la couleur du trait se prend dans la palette du jeu ──────────


def test_l_ecran_propose_la_palette_du_jeu_pour_la_couleur_du_trait():
    """**Livré, et vérifié plutôt que réécrit.** *Une tranche qui réclame du
    travail livré est la façon la plus chère de perdre une journée* : le choix de
    couleur du contour montre déjà la palette du projet en pastilles cliquables
    et marque une couleur hors palette. Ce test le fige.
    """
    ecrit = PLACES.read_text(encoding="utf-8")

    assert "function ChoixDeCouleur" in ecrit
    assert "palette.map" in ecrit, "les pastilles de la palette"
    assert "hors palette" in ecrit, "une couleur hors palette se marque"
    # Et c'est bien la table des contours qui s'en sert, avec la palette du jeu.
    contours = ecrit[ecrit.index("export function PanneauContours") :]
    contours = contours[: contours.index("export function PanneauBords")]
    assert "<ChoixDeCouleur" in contours
    assert "palette={univers.palette}" in contours


def test_l_ecran_dit_en_croix_ou_en_carre_et_dans_quelle_unite():
    """**« Et l'écran dit lequel »** — la seconde moitié du critère de la croix,
    et celle qu'on oublie. Deux formes qui changeraient sans un mot laisseraient
    chercher pourquoi un trait d'un pixel a maigri de quatre pixels."""
    ecrit = PLACES.read_text(encoding="utf-8")

    assert "en croix, la convention du pixel art" in ecrit
    assert "en carré, au-delà d'une épaisseur" in ecrit
    # Et l'unité de l'épaisseur, qui n'est pas toujours le pixel.
    assert "export function uniteDuTrait" in ecrit
    assert re.search(r"la maille sur laquelle le modèle a peint", ecrit)


def test_l_ecran_dit_a_quel_cote_le_modele_infere():
    """Le nombre qui décide de ce qu'un modèle peut rendre se lit au moment où
    on le choisit, pas dans un document."""
    ecrit = FICHE.read_text(encoding="utf-8")

    assert "choisi.entree" in ecrit
    assert "réagrandit son masque" in ecrit


# ── Critère 11 — aucun invariant ne bouge ───────────────────────────────────


def test_aucune_des_reparations_ne_charge_de_modele_ni_ne_touche_le_reseau():
    """**Pas de carte graphique, pas d'appel au fournisseur, ça marche réseau
    coupé.** Les deux réparations de bord et les deux régimes du contour sont du
    calcul pur sur des tableaux : `onnxruntime` ne doit pas être entré dans le
    processus pour qu'ils tournent.

    C'est la même preuve que `tests/test_t2.py` — on regarde `sys.modules`, on ne
    fait pas confiance à une intention.
    """
    rgb, alpha, fond = _sujet_avec_frange()

    ronger_conditionnel(rgb, alpha, 2, fond)
    decontaminer(rgb, alpha, fond, 28)
    contourner(
        _peinte(pas=8, phase=3), Contour(epaisseur=1), retrouver_grille(_peinte(8, 3))
    )

    assert "onnxruntime" not in sys.modules
    assert "torch" not in sys.modules


def test_le_pourtour_est_ecrit_une_fois_et_employe_partout():
    """Trois réparations lisent le mot *bord* — la mesure du fond de D3, le
    rongement et la décontamination. Trois définitions auraient compté trois
    choses."""
    plein = np.zeros((8, 8), dtype=bool)
    plein[2:6, 2:6] = True

    assert int(pourtour(plein).sum()) == 4 * 4 - 2 * 2
    # **Le bord du cadre compte comme du dehors**, et c'est le même choix que le
    # contour : un sujet recadré sur sa boîte opaque touche les quatre bords, et
    # l'en excepter ferait disparaître son pourtour là où il est le plus visible.
    # Sur un carré plein de 4, les douze pixels du tour sont donc son pourtour.
    assert int(pourtour(np.ones((4, 4), dtype=bool)).sum()) == 4 * 4 - 2 * 2


def test_le_durcissement_reste_ce_qu_il_etait_a_zero():
    """**Un réglage à zéro ne fait rien**, avant comme après la tranche : c'est
    ce qui fait qu'une recette d'avant D4 dont le durcissement est nul rend
    exactement ce qu'elle rendait, au pixel près."""
    rgb, alpha, fond = _sujet_avec_frange()

    assert np.array_equal(ronger_conditionnel(rgb, alpha, 0, fond), alpha)
    assert np.array_equal(ronger(alpha, 0), alpha)
    assert np.array_equal(durcir(alpha, 128), alpha)
