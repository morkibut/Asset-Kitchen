# -*- coding: utf-8 -*-
"""Les critères d'acceptation de A5 — le contour qui ne bout pas.

**Le défaut.** Une bande passait dans la chaîne du jeu *image par image*, comme
si les images n'avaient rien à voir entre elles. Deux décisions y étaient donc
reprises à chaque image alors qu'elles appartiennent à la bande entière :

- **la silhouette**, décidée au plus proche voisin — un seul pixel par bloc
  décide pour ses cinquante voisins, et il le redécide à chaque image ;
- **la palette**, recalculée par une coupe médiane sur *cette* image — deux
  images d'un même mouvement n'ont pas le même histogramme, donc pas la même
  palette, donc un aplat de peau qui passe d'un brun à son voisin.

Aucun des deux ne se voit sur une image fixe. Les deux se voient dès que
l'animation tourne, et c'est bien le problème : rien dans le produit ne les
mesurait.

## ⚠️ La leçon de cette tranche est dans la mesure, pas dans la correction

Le premier chiffre écrit pour juger la tranche — *quelle part du bord change
d'une image à l'autre* — n'a montré **aucun gain**, trois bancs de suite. Il
mélange le grésil au vrai mouvement, et le mouvement pèse tellement plus lourd
qu'il enterre le reste. Le bon chiffre est ailleurs, et il tient dans une
phrase : **un pixel que le sujet traverse s'allume une fois et reste allumé ;
un pixel qui s'allume, s'éteint et se rallume est revenu sur ses pas.** Sur le
même banc, le même réglage fait −6 % sur le premier et −33 % sur le second.

`test_un_sujet_qui_glisse_ne_revient_jamais_sur_ses_pas` est l'essai qui tient
cette leçon : il vérifie qu'un mouvement propre pèse *lourd* sur le chiffre
large et *zéro* sur le chiffre juste. Sans lui, quelqu'un rebranchera un jour le
chiffre large sur l'écran, et il conclura que rien ne grésille jamais.

**Aucun n'appelle le fournisseur et aucun ne coûte** : tout se calcule sur des
images fabriquées ici, sur le processeur.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

# **Le montage vidéo vient d'`A9`**, importé plutôt que recopié : un second
# atelier écrit ici finirait par ne plus décrire le même produit.
from test_a9 import atelier_video, client_video, animateur  # noqa: F401
from test_a10 import clip  # noqa: F401

from atelier.domaine.recette import (
    AU_PLUS_PROCHE,
    Contour,
    Grille,
    Passe,
    Quantification,
    Recette,
)
from atelier.image.bande import assembler, fenetre_commune, preparer
from atelier.image.stabilite import mesurer
from atelier.image.traitement import _reduire, sur_grille

FOND = (242, 242, 242)
SUJET = (30, 60, 140)


# --------------------------------------------------------------------------- #
# De quoi fabriquer des images sans passer par la chaîne                       #
# --------------------------------------------------------------------------- #


def _rgba(silhouette: np.ndarray, couleur: tuple[int, int, int] = SUJET) -> np.ndarray:
    """Une image RGBA posée à la main : la silhouette dit où c'est opaque.

    On court-circuite le détourage exprès. Ce qu'on mesure ici est **la mesure
    elle-même**, et lui donner des images dont on connaît la silhouette au pixel
    près est la seule façon de savoir ce que le chiffre aurait dû dire.
    """
    hauteur, largeur = silhouette.shape
    image = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    image[:, :, :3] = couleur
    image[:, :, 3] = np.where(silhouette, 255, 0)
    return image


def _barre(largeur: int = 20, hauteur: int = 12, depart: int = 2, epaisseur: int = 6):
    """Une barre verticale opaque, posée à `depart`."""
    silhouette = np.zeros((hauteur, largeur), dtype=bool)
    silhouette[:, depart : depart + epaisseur] = True
    return silhouette


# --------------------------------------------------------------------------- #
# 1. La stabilité d'une bande se mesure                                        #
# --------------------------------------------------------------------------- #


def test_une_bande_immobile_ne_bouge_pas_du_tout():
    """Quatre fois la même image : rien ne change, et le chiffre le dit."""
    mesure = mesurer([_rgba(_barre()) for _ in range(4)])

    assert mesure.images == 4
    assert mesure.contour == 0
    assert mesure.allers_retours == 0
    assert mesure.part_des_allers_retours == 0.0


def test_un_sujet_qui_glisse_ne_revient_jamais_sur_ses_pas():
    """⚠️ **L'essai qui tient toute la leçon de la tranche.**

    Une barre qui glisse d'un pixel par image est du mouvement pur : il n'y a
    pas un grain de grésillement là-dedans. Pourtant *le bord qui change* est
    énorme — la barre change d'état sur ses deux côtés à chaque image. C'est
    exactement pour ça que ce chiffre-là n'a rien su dire de la tranche.

    *Le bord qui revient sur ses pas*, lui, vaut **zéro**, et c'est ce qui en
    fait une mesure du grésil et pas une mesure du mouvement : chaque pixel que
    la barre traverse s'allume une fois, puis s'éteint une fois quand elle est
    passée. Deux bascules pour un pixel traversé de part en part, donc **une**
    au-delà de la première…

    …et c'est pourquoi la barre est ici **plus large que le trajet** : avec six
    pixels d'épaisseur et trois pas d'un pixel, aucun pixel n'a le temps d'être
    traversé entièrement. Une barre fine repasserait en fond, et le chiffre
    compterait ce rallumage-là — qui est du mouvement, pas du grésil. La mesure
    est donc **juste sur un mouvement lent**, et c'est le cas qu'elle vise : un
    contour qui bout bout d'une image à l'autre, pas sur toute la bande.
    """
    glissee = [_rgba(_barre(depart=2 + pas)) for pas in range(4)]
    mesure = mesurer(glissee)

    assert mesure.contour > 0, "la barre bouge : le chiffre large doit être gros"
    assert mesure.allers_retours == 0, "rien n'est revenu en arrière"
    assert mesure.part_des_allers_retours == 0.0


def test_un_pixel_qui_clignote_compte_pour_un_aller_retour_par_rallumage():
    """S'allumer, s'éteindre, se rallumer : deux bascules de trop sur trois."""
    barre = _barre()
    clignotant = barre.copy()
    clignotant[6, 15] = True

    mesure = mesurer(
        [_rgba(barre), _rgba(clignotant), _rgba(barre), _rgba(clignotant)]
    )

    assert mesure.contour == 3, "trois bascules en quatre images"
    assert mesure.allers_retours == 2, "la première ne compte pas, les deux autres si"


def test_une_bande_d_une_seule_image_ne_peut_pas_gresiller():
    """Aucune paire, donc aucune mesure — et surtout aucune erreur."""
    mesure = mesurer([_rgba(_barre())])

    assert mesure.images == 1
    assert mesure.contour == 0
    assert mesure.allers_retours == 0
    assert mesure.couleurs == 1, "la couleur du sujet se compte quand même"


def test_des_images_de_tailles_differentes_rendent_une_mesure_vide():
    """Un instrument ne refuse pas : il constate qu'il n'y a rien à mesurer."""
    mesure = mesurer([_rgba(_barre()), _rgba(_barre(largeur=30))])

    assert mesure.contour == 0
    assert mesure.allers_retours == 0


def test_la_couleur_sous_un_pixel_efface_n_est_jamais_comptee():
    """Effacer un pixel ne change pas sa couleur — et elle n'est jamais vue.

    La compter ferait dire à la mesure que la bande scintille dans son fond
    invisible, ce qui masquerait le vrai chiffre derrière un faux.
    """
    barre = _barre()
    premiere = _rgba(barre)
    seconde = _rgba(barre)
    # Deux fonds très différents, sous des pixels transparents dans les deux.
    premiere[:, :, :3][~barre] = (255, 0, 0)
    seconde[:, :, :3][~barre] = (0, 255, 0)

    mesure = mesurer([premiere, seconde])

    assert mesure.couleurs == 1
    assert mesure.couleurs_d_une_image == 0


def test_la_part_des_allers_retours_se_rapporte_a_ce_qui_a_bouge():
    """Le dénominateur est le mouvement, pas la longueur du bord.

    La question posée n'est pas « quelle part du personnage grésille » mais
    **« sur tout ce qui a bougé, quelle part n'est pas du mouvement »**.
    """
    barre = _barre()
    clignotant = barre.copy()
    clignotant[6, 15] = True
    mesure = mesurer([_rgba(barre), _rgba(clignotant), _rgba(barre)])

    assert mesure.contour == 2
    assert mesure.allers_retours == 1
    assert mesure.part_des_allers_retours == pytest.approx(0.5)


# --------------------------------------------------------------------------- #
# 2. La silhouette décidée de la même façon sur toutes les images              #
# --------------------------------------------------------------------------- #


def _bloc_a_majorite_opaque() -> Image.Image:
    """Un bloc de 4 × 4 opaque à **dix seizièmes**, son centre transparent.

    C'est le cas d'école, et il est la moitié de la tranche : le vote de
    majorité voit une case pleine, le pixel du centre voit un trou. ⚠️ Sur un
    bord droit les deux répondent la même chose — *une droite qui passe par le
    centre d'un carré le coupe en deux moitiés égales* —, donc il faut ici une
    silhouette **accidentée** pour que les deux chaînes se séparent, et c'est
    exactement ce que laisse le découpage d'une vraie image.
    """
    alpha = np.zeros((4, 4), dtype=np.uint8)
    alpha[0:3, :] = 255  # douze pixels sur seize
    alpha[2, 2] = 0  # dont un creusé, pile là où le plus proche voisin échantillonne
    image = np.zeros((4, 4, 4), dtype=np.uint8)
    image[:, :, :3] = SUJET
    image[:, :, 3] = alpha
    return Image.fromarray(image, mode="RGBA")


def test_le_bloc_a_majorite_opaque_reste_opaque_pour_une_bande():
    """Dix pixels opaques sur seize : la case est pleine, quel que soit le centre."""
    bloc = _bloc_a_majorite_opaque()

    stable = np.asarray(_reduire(bloc, (1, 1), AU_PLUS_PROCHE, silhouette_stable=True))
    tel_quel = np.asarray(_reduire(bloc, (1, 1), AU_PLUS_PROCHE))

    assert stable[0, 0, 3] == 255, "la majorité est opaque : la case l'est"
    assert tel_quel[0, 0, 3] == 0, "le pixel échantillonné, lui, était creusé"


def test_la_couleur_reste_au_plus_proche_voisin():
    """⚠️ **Seule la silhouette change ; la couleur garde son parti pris.**

    Le plus proche voisin est un choix de style — c'est lui qui donne le pixel
    franc. Moyenner la couleur en même temps que l'alpha rendrait les images
    plus douces, donc *un autre jeu*, et la tranche n'a pas ce droit-là.
    """
    bloc = _bloc_a_majorite_opaque()

    stable = np.asarray(_reduire(bloc, (2, 2), AU_PLUS_PROCHE, silhouette_stable=True))
    tel_quel = np.asarray(_reduire(bloc, (2, 2), AU_PLUS_PROCHE))

    assert np.array_equal(stable[:, :, :3], tel_quel[:, :, :3])


def test_une_image_seule_garde_exactement_la_silhouette_qu_elle_avait():
    """L'invariant qui protège tout ce qui a déjà été rendu.

    Une recette nommée doit rendre **le même fichier** qu'avant `A5`. Le signal
    qui lève le drapeau est la fenêtre commune, qui *est* déjà la marque d'une
    bande : sans fenêtre, la chaîne doit passer par le chemin d'avant, aux
    quatre canaux d'un coup.
    """
    rgba = np.zeros((16, 16, 4), dtype=np.uint8)
    rgba[:, :, :3] = SUJET
    alpha = np.zeros((16, 16), dtype=np.uint8)
    alpha[2:14, 2:14] = 255
    alpha[5, 5] = 0
    alpha[9, 10] = 0
    rgba[:, :, 3] = alpha
    grille = Grille(cible=4, occupation=100, methode=AU_PLUS_PROCHE)

    seule = sur_grille(rgba, grille, case=True, fenetre=None)
    forcee = sur_grille(rgba, grille, case=True, fenetre=None, silhouette_stable=False)

    assert np.array_equal(seule, forcee)


# --------------------------------------------------------------------------- #
# 3. La palette calculée une fois pour la bande                                #
# --------------------------------------------------------------------------- #

COULEURS = 8

RECETTE_PALETTE = Recette(
    passes=(Passe(moteur="bord", tolerance=24),),
    grille=Grille(cible=24, occupation=90, methode=AU_PLUS_PROCHE),
    quantification=Quantification(couleurs=COULEURS),
)


def _images_degradees(
    combien: int = 5, toile: int = 160, glissement: int = 1
) -> list[bytes]:
    """Un sujet dégradé qui glisse, avec un grain différent à chaque image.

    Le dégradé donne à la coupe médiane de quoi choisir ; le grain est ce qui
    fait diverger deux palettes calculées séparément. Sans l'un ou l'autre, une
    palette par image et une palette par bande donneraient le même résultat, et
    l'essai ne prouverait rien.
    """
    tirage = np.random.default_rng(20260905)
    lignes = np.arange(toile)[:, None]
    colonnes = np.arange(toile)[None, :]
    faites = []
    for rang in range(combien):
        centre = toile // 2 + rang * glissement
        dedans = (np.abs(colonnes - centre) < 34) & (np.abs(lignes - toile // 2) < 46)
        haut, gauche = np.broadcast_arrays(lignes / toile, colonnes / toile)
        peinture = np.dstack([40 + 160 * haut, 70 + 130 * gauche, 200 - 140 * haut])
        image = np.full((toile, toile, 3), 242.0)
        image[dedans] = peinture[dedans]
        image += tirage.normal(0.0, 4.0, image.shape)
        rendu = np.clip(image, 0, 255).astype(np.uint8)
        tampon = io.BytesIO()
        Image.fromarray(rendu, mode="RGB").save(tampon, format="PNG")
        faites.append(tampon.getvalue())
    return faites


def _couleurs_par_case(planche) -> list[set[tuple[int, ...]]]:
    """Les couleurs visibles de chaque case de la planche, case par case."""
    with Image.open(io.BytesIO(planche.octets)) as ouverte:
        entiere = np.asarray(ouverte.convert("RGBA"))
    largeur = planche.case_largeur
    trouvees = []
    for rang in range(planche.compte):
        case = entiere[:, rang * largeur : (rang + 1) * largeur]
        opaques = case[:, :, :3][case[:, :, 3] > 0]
        trouvees.append({tuple(c) for c in np.unique(opaques, axis=0)})
    return trouvees


def test_la_palette_d_une_bande_est_decidee_une_fois_pour_la_bande():
    """Toutes les images tirent du même jeu de couleurs, et il est du bon compte."""
    octets = _images_degradees()
    preparees = [preparer(o, RECETTE_PALETTE) for o in octets]
    fenetre = fenetre_commune(preparees, RECETTE_PALETTE)

    planche = assembler(preparees, RECETTE_PALETTE, fenetre)
    par_case = _couleurs_par_case(planche)
    toutes = set().union(*par_case)

    assert len(toutes) <= COULEURS, "la bande entière tient dans la palette demandée"


def test_sans_la_tranche_chaque_image_avait_sa_propre_palette():
    """L'*avant*, joué par le produit lui-même — c'est ce qui rend le chiffre vrai.

    ⚠️ Le drapeau `stabiliser` n'a que deux appelants, celui-ci et le banc. Un
    essai qui rejouerait l'ancienne chaîne à la main mesurerait **sa propre
    copie**, et il continuerait de passer longtemps après que le produit aurait
    changé.
    """
    octets = _images_degradees()
    preparees = [preparer(o, RECETTE_PALETTE) for o in octets]
    fenetre = fenetre_commune(preparees, RECETTE_PALETTE)

    avant = assembler(preparees, RECETTE_PALETTE, fenetre, stabiliser=False)
    apres = assembler(preparees, RECETTE_PALETTE, fenetre)

    couleurs_avant = set().union(*_couleurs_par_case(avant))
    assert len(couleurs_avant) > COULEURS, "chaque image avait tiré les siennes"
    assert avant.stabilite is not None and apres.stabilite is not None
    assert apres.stabilite.couleurs_d_une_image < avant.stabilite.couleurs_d_une_image


def test_une_palette_declaree_par_le_jeu_ne_declenche_rien():
    """Un jeu qui déclare sa palette n'a jamais eu le défaut, et rien ne s'ajoute.

    Elle est imposée à tout ce qui entre, la bande comprise : recalculer une
    palette de bande par-dessus reviendrait à **remplacer la palette du jeu**,
    ce qui est exactement l'inverse du service rendu.
    """
    imposee = ("#101820", "#4a5d7e", "#c8b78a", "#f2e9d8")
    recette = Recette(
        passes=(Passe(moteur="bord", tolerance=24),),
        grille=Grille(cible=24, occupation=90, methode=AU_PLUS_PROCHE),
        quantification=Quantification(couleurs=COULEURS, palette=imposee),
    )
    octets = _images_degradees()
    preparees = [preparer(o, recette) for o in octets]
    fenetre = fenetre_commune(preparees, recette)

    planche = assembler(preparees, recette, fenetre)

    attendues = {
        tuple(int(teinte[i : i + 2], 16) for i in (1, 3, 5)) for teinte in imposee
    }
    for couleurs in _couleurs_par_case(planche):
        assert couleurs <= attendues, "rien d'autre que la palette du jeu"


def test_une_bande_d_une_seule_image_rend_ce_que_l_image_seule_rendait():
    """Une image ne peut scintiller contre personne : la chaîne ne change pas.

    C'est l'invariant de la palette, jumeau de celui de la silhouette : ce que
    l'auteur a déjà exporté doit rester exportable à l'identique.
    """
    octets = _images_degradees(combien=1)
    preparees = [preparer(o, RECETTE_PALETTE) for o in octets]
    fenetre = fenetre_commune(preparees, RECETTE_PALETTE)

    avec = assembler(preparees, RECETTE_PALETTE, fenetre)
    sans = assembler(preparees, RECETTE_PALETTE, fenetre, stabiliser=False)

    assert avec.octets == sans.octets


# --------------------------------------------------------------------------- #
# 4. Le contour retracé suit la silhouette, sur toutes les images              #
# --------------------------------------------------------------------------- #


def test_le_contour_retrace_suit_la_silhouette_de_chaque_image():
    """Le trait de bord se pose **sur l'alpha**, donc il hérite de sa stabilité.

    C'est le seul lien qu'il faut tenir, et il est structurel : le contour ne
    calcule pas sa propre idée de la forme. On le vérifie plutôt que de le
    croire — le jour où quelqu'un le ferait travailler sur l'image d'origine, le
    trait se remettrait à bouillir alors que la silhouette, elle, serait calme.

    **La preuve tient dans un sujet qui ne bouge pas d'un pixel.** Trois images
    au grain différent, même forme exactement : si le trait suit la silhouette,
    les trois cases sont identiques *au bit près*. S'il se calculait sur les
    couleurs, le grain suffirait à les séparer.
    """
    recette = Recette(
        passes=(Passe(moteur="bord", tolerance=24),),
        grille=Grille(cible=24, occupation=90, methode=AU_PLUS_PROCHE),
        contours=Contour(epaisseur=1, couleur="#ff00ff"),
    )
    octets = _images_degradees(combien=3, glissement=0)
    preparees = [preparer(o, recette) for o in octets]
    fenetre = fenetre_commune(preparees, recette)

    planche = assembler(preparees, recette, fenetre)

    with Image.open(io.BytesIO(planche.octets)) as ouverte:
        entiere = np.asarray(ouverte.convert("RGBA"))
    largeur = planche.case_largeur
    trace = (
        (entiere[:, :, 0] == 255)
        & (entiere[:, :, 1] == 0)
        & (entiere[:, :, 2] == 255)
        & (entiere[:, :, 3] > 0)
    )
    premiere = trace[:, 0:largeur]
    assert premiere.any(), "le trait doit exister, sans quoi l'essai ne prouve rien"

    for rang in range(1, planche.compte):
        suivante = trace[:, rang * largeur : (rang + 1) * largeur]
        assert np.array_equal(premiere, suivante), (
            f"le trait de l'image {rang} ne tombe pas où celui de la première"
        )


# --------------------------------------------------------------------------- #
# 5. Comparé avant/après sur une bande du banc                                 #
# --------------------------------------------------------------------------- #


def test_le_banc_montre_moins_de_gresil_apres_qu_avant():
    """Le banc d'`A5`, rejoué en petit — **c'est le critère chiffré de la tranche**.

    Il est tiré au sort avec une graine fixe, donc il rend deux fois le même
    résultat. On lui demande ici la seule chose qui vaille : que le grésil
    baisse. Le chiffre exact vit dans `essais/mesures_stabilite_bande.json`,
    parce qu'un essai qui figerait un pourcentage se mettrait à rougir au
    premier changement de bibliothèque d'images, ce qui n'apprendrait rien.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "essais"))
    from essai_stabilite_bande import images_du_banc, recette_du_banc

    recette = recette_du_banc(48, 16)
    preparees = [preparer(o, recette) for o in images_du_banc(6, 48)]
    fenetre = fenetre_commune(preparees, recette)

    avant = assembler(preparees, recette, fenetre, stabiliser=False).stabilite
    apres = assembler(preparees, recette, fenetre).stabilite

    assert avant is not None and apres is not None
    assert apres.part_des_allers_retours < avant.part_des_allers_retours
    assert apres.part_des_couleurs < avant.part_des_couleurs


# --------------------------------------------------------------------------- #
# 6. Les invariants du traitement                                              #
# --------------------------------------------------------------------------- #


def test_l_apercu_de_la_bande_porte_le_chiffre(client_video, clip, animateur):
    """L'écran reçoit la mesure avec la planche, dans le même aller-retour.

    Elle est calculée là où les images rendues sont déjà toutes en main, à la
    même taille. La redemander ailleurs ferait rejouer la chaîne pour rien.
    """
    reponse = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": [2, 4, 6, 8], "recette": {}},
    )

    assert reponse.status_code == 200
    stabilite = reponse.json()["stabilite"]
    assert stabilite is not None
    assert stabilite["images"] == 4
    assert "part_des_allers_retours" in stabilite
    assert 0.0 <= stabilite["part_des_allers_retours"] <= 1.0


def test_mesurer_une_bande_n_appelle_jamais_le_fournisseur(
    client_video, clip, animateur
):
    """Une mesure qui coûterait de l'argent ne serait pas une mesure.

    Tout se calcule sur des images déjà sur le disque. On compte les appels
    plutôt que de le supposer : c'est la seule façon de s'apercevoir que
    quelqu'un a branché une reconnaissance de sujet dans la chaîne.
    """
    avant = (
        len(animateur.soumissions),
        len(animateur.recuperations),
        len(animateur.etats_demandes),
    )

    client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": [2, 4, 6], "recette": {}},
    )

    assert (
        len(animateur.soumissions),
        len(animateur.recuperations),
        len(animateur.etats_demandes),
    ) == avant
