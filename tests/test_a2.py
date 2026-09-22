# -*- coding: utf-8 -*-
"""Les critères d'acceptation de A2 — le cadre qui ne dérive pas.

**Le défaut, et il était écrit à l'envers dans le code.** Quand le sujet a une
silhouette, l'échelle se calcule sur la boîte de **l'image courante**, et le
centrage aussi. Un bras tendu agrandit cette boîte, donc **réduit tout le
personnage** — et le commentaire du code affirmait que c'était justement ce qui
faisait que deux images d'un même personnage se superposent.

Mesuré sur un clip le 3 septembre 2026 : le personnage sort à 37 px de large au
repos et 41 en marchant. **Il grandit de 10 % en se mettant à marcher**, et rien
dans le produit ne le disait.

**Ce que ces essais tiennent.** Que deux images d'une même bande partagent une
fenêtre unique ; que cette fenêtre se prenne sur le **clip entier** et non sur la
bande gardée — c'est le renversement qui sépare la bonne réponse de celle juste
à côté ; que le nettoyage des taches précède le calcul des boîtes, sans quoi une
ombre sous les pieds soulève le personnage ; et **qu'une image seule rende
exactement ce qu'elle rendait**, parce qu'une correction de cadrage qui changerait
toutes les images déjà faites serait une régression, pas une réparation.

**Aucun n'appelle le fournisseur et aucun ne coûte** : tout se calcule sur des
images fabriquées ici, sur le processeur.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

# **Les deux montages de la vidéo viennent de `A9`**, et ils sont importés plutôt
# que recopiés : un second atelier vidéo écrit ici finirait par ne plus décrire
# le même produit que celui d'`A9`.
from test_a9 import atelier_video, client_video, animateur  # noqa: F401

from atelier.domaine.recette import Bords, Grille, Passe, Recette
from atelier.image.bande import Fenetre, fenetre_commune, monter, preparer
from atelier.image.traitement import appliquer, boite_opaque

# La recette d'un sprite : détourage par le bord, case de 64, taches nettoyées.
# **Les trois ensemble, parce que les trois comptent** — sans détourage il n'y a
# pas de case, sans case il n'y a pas d'échelle, sans nettoyage le corollaire
# d'ordre n'a rien à écarter.
RECETTE = Recette(
    passes=(Passe(moteur="bord", tolerance=20),),
    grille=Grille(cible=64, occupation=80),
    bords=Bords(aire_min=4),
)

FOND = (216, 217, 216)
SUJET = (40, 40, 40)


def _image(
    *,
    bras: int = 0,
    tache_sous_les_pieds: bool = False,
    toile: tuple[int, int] = (400, 260),
) -> bytes:
    """Un corps debout, éventuellement un bras tendu, éventuellement une poussière.

    **Le corps ne bouge pas d'un pixel d'une image à l'autre**, et il fait
    toujours 40 × 160 : c'est ce qui rend la mesure lisible. Tout ce qui change
    est ce qui s'ajoute autour — donc tout écart de taille du corps en sortie est
    une dérive et rien d'autre.

    **Le bras est long, et il faut qu'il le soit.** L'échelle se prend sur le
    *côté long* de la boîte : un bras qui ne dépasse pas la hauteur du corps ne
    change rien, et un essai bâti sur un bras court passerait avant comme après
    la réparation sans rien prouver. Celui-ci porte la largeur au-delà des 160
    pixels du corps, ce qui est le cas d'un personnage qui tend une arme.
    """
    image = Image.new("RGB", toile, FOND)
    pixels = image.load()
    gauche, droite = 60, 100
    haut, bas = 40, 200
    for x in range(gauche, droite):
        for y in range(haut, bas):
            pixels[x, y] = SUJET
    if bras:
        for x in range(droite, min(droite + bras, toile[0] - 1)):
            for y in range(90, 100):
                pixels[x, y] = SUJET
    if tache_sous_les_pieds:
        # Une ombre isolée de douze pixels, dix plus bas — reliée à rien, donc
        # une tache à part entière. C'est très exactement ce qu'un clip lissé et
        # compressé laisse traîner, et c'est assez pour soulever le personnage.
        for x in range(76, 80):
            for y in range(bas + 10, bas + 13):
                pixels[x, y] = SUJET
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


# Le bras qui porte la largeur au-delà de la hauteur du corps : 40 + 150 = 190
# contre 160. C'est là, et seulement là, que l'échelle bascule.
BRAS = 150


def _corps(rendu_octets: bytes) -> tuple[int, int]:
    """La largeur et la hauteur du **corps seul** dans une case rendue.

    On ne mesure pas la case — elle fait toujours 64 —, on mesure ce qu'il y a
    dedans : c'est là que la dérive se voit."""
    with Image.open(io.BytesIO(rendu_octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    boite = boite_opaque(rgba[:, :, 3])
    assert boite is not None
    x0, y0, x1, y1 = boite
    return x1 - x0 + 1, y1 - y0 + 1


def _prep(octets: bytes) -> np.ndarray:
    return preparer(octets, RECETTE)


# ── La dérive, telle qu'elle était ───────────────────────────────────────────


def test_sans_fenetre_le_personnage_retrecit_quand_il_tend_le_bras():
    """**Le défaut, reproduit avant d'être réparé.**

    Le corps est peint au pixel près au même endroit dans les deux images ; seul
    un bras s'ajoute. Sans fenêtre commune, il ressort plus petit — parce que
    l'échelle se calcule sur une boîte que le bras a agrandie."""
    repos = appliquer(RECETTE, _image()).octets
    marche = appliquer(RECETTE, _image(bras=BRAS)).octets
    assert _corps(repos)[1] > _corps(marche)[1]


def test_avec_la_fenetre_commune_le_corps_garde_sa_taille():
    """*Toutes les images d'une bande partagent une fenêtre unique, calculée sur
    ce qu'elles occupent ensemble.*"""
    images = [_prep(_image()), _prep(_image(bras=BRAS))]
    fenetre = fenetre_commune(images, RECETTE)
    assert fenetre is not None
    rendus = monter(images, RECETTE, fenetre)
    assert _corps(rendus[0].octets)[1] == _corps(rendus[1].octets)[1]


def test_deux_images_de_tailles_differentes_ne_sortent_jamais_de_tailles_differentes():
    """*Deux images de tailles différentes ne produisent jamais deux sorties de
    tailles différentes.*

    La case est carrée et son côté vient du projet, jamais de l'image reçue."""
    images = [_prep(_image()), _prep(_image(bras=BRAS, toile=(320, 200)))]
    fenetre = fenetre_commune(images, RECETTE)
    rendus = monter(images, RECETTE, fenetre)
    tailles = {(r.largeur, r.hauteur) for r in rendus}
    assert len(tailles) == 1


# ── Le renversement : le clip entier, jamais la bande seule ──────────────────


def test_la_fenetre_du_clip_entier_n_est_pas_celle_d_une_bande():
    """*Sur un clip, cette fenêtre se prend sur les images du clip entier, pas
    sur les seules images gardées.*

    **C'est l'erreur juste à côté de la bonne réponse**, et le montage des essais
    la faisait : une fenêtre par bande cale les images **d'une** bande entre
    elles ; il faut une fenêtre par clip pour caler **les bandes** entre elles."""
    clip = [_prep(_image()), _prep(_image()), _prep(_image(bras=BRAS))]
    repos, marche = clip[:2], clip[2:]

    du_clip = fenetre_commune(clip, RECETTE)
    de_la_bande = fenetre_commune(repos, RECETTE)
    assert du_clip is not None and de_la_bande is not None
    assert du_clip.largeur > de_la_bande.largeur

    # Deux bandes du même clip, chacune sur **sa** fenêtre : le personnage change
    # de taille en passant de l'une à l'autre. C'est le défaut mesuré à 10 %.
    par_bande = [
        monter(repos, RECETTE, fenetre_commune(repos, RECETTE))[0],
        monter(marche, RECETTE, fenetre_commune(marche, RECETTE))[0],
    ]
    assert _corps(par_bande[0].octets)[1] != _corps(par_bande[1].octets)[1]

    # Les deux sur la fenêtre du clip : la même assise partout.
    par_clip = [
        monter(repos, RECETTE, du_clip)[0],
        monter(marche, RECETTE, du_clip)[0],
    ]
    assert _corps(par_clip[0].octets)[1] == _corps(par_clip[1].octets)[1]


def test_la_fenetre_dit_sur_combien_d_images_elle_a_ete_prise():
    """**Écrit plutôt que déduit** : l'écran de montage doit pouvoir dire *prise
    sur le clip entier* ou *prise sur la bande*, et les deux ne se distinguent
    que par ce chiffre."""
    clip = [_prep(_image()) for _ in range(4)]
    assert fenetre_commune(clip, RECETTE).images == 4


# ── Le corollaire d'ordre : les taches avant les boîtes ──────────────────────


def test_le_nettoyage_des_taches_precede_le_calcul_des_boites():
    """*Le nettoyage des taches précède le calcul des boîtes.*

    L'ancrage vertical pose le **bas de la boîte** sur le bas de la case : une
    ombre isolée sous les pieds soulèverait le personnage d'autant."""
    propre = fenetre_commune([_prep(_image())], RECETTE)
    salie = fenetre_commune([_prep(_image(tache_sous_les_pieds=True))], RECETTE)
    assert propre is not None and salie is not None
    assert salie.taches_ecartees >= 1
    assert salie.bas == propre.bas


def test_une_recette_qui_ne_nettoie_pas_garde_sa_poussiere():
    """**Elle a dit de ne rien écarter, et ce n'est pas à la bande d'en décider
    à sa place.** `aire_min` à zéro veut dire *garde tout*, ici comme partout."""
    sans_nettoyage = Recette(
        passes=RECETTE.passes, grille=RECETTE.grille, bords=Bords(aire_min=0)
    )
    propre = fenetre_commune([preparer(_image(), sans_nettoyage)], sans_nettoyage)
    salie = fenetre_commune(
        [preparer(_image(tache_sous_les_pieds=True), sans_nettoyage)], sans_nettoyage
    )
    assert salie.bas > propre.bas
    assert salie.taches_ecartees == 0


def test_tout_ecarter_n_est_pas_une_reponse():
    """Si le seuil mangeait chaque tache de chaque image, on retombe sur la
    mesure brute : un sujet existe, et le dire absent serait pire que de garder
    la poussière."""
    gourmande = Recette(
        passes=RECETTE.passes,
        grille=Grille(cible=8, occupation=100),
        bords=Bords(aire_min=10_000),
    )
    fenetre = fenetre_commune([preparer(_image(), gourmande)], gourmande)
    assert fenetre is not None and fenetre.largeur > 0


def test_un_detourage_qui_a_tout_mange_se_voit_au_lieu_de_se_reparer():
    """US-71 : ça ne se répare pas ici, **ça se voit**."""
    vide = np.zeros((16, 16, 4), dtype=np.uint8)
    assert fenetre_commune([vide], RECETTE) is None


# ── Ce qui ne doit pas bouger ────────────────────────────────────────────────


def test_une_image_seule_rend_exactement_ce_qu_elle_rendait():
    """**Une correction de cadrage qui changerait toutes les images déjà faites
    serait une régression, pas une réparation.**

    Sans fenêtre, la chaîne reprend la boîte de l'image, comme depuis `T2`."""
    octets = _image(bras=BRAS)
    avant = appliquer(RECETTE, octets)
    sans_fenetre = monter([_prep(octets)], RECETTE, None)[0]
    assert sans_fenetre.octets == avant.octets


def test_la_fenetre_survit_a_un_aller_retour_par_le_json():
    fenetre = Fenetre(3, 5, 40, 90, images=7, taches_ecartees=2)
    relue = Fenetre.depuis_json(fenetre.en_json())
    assert relue == fenetre
    assert relue.largeur == 38 and relue.hauteur == 86


async def test_l_apercu_brut_montre_les_pixels_du_modele(atelier_video, client_video):
    """*L'aperçu brut est monté sur les images du modèle : aucun détourage entre
    le clip et l'œil.*

    C'est la manœuvre que le banc a dû improviser pour pouvoir juger, et elle est
    devenue une règle : le détourage grignote un pied, laisse des miettes, et
    l'on finit par juger le détourage au lieu de la marche. **Juger le mouvement
    et juger le découpage sont deux métiers.**

    Ce que l'essai tient : l'image servie est **opaque de bout en bout**. Un
    détourage, quel qu'il soit, y aurait laissé de la transparence."""
    from conftest import commander_un_clip
    from test_a9 import MELE, un_sprite

    sprite = un_sprite(client_video)
    identifiant = (
        await commander_un_clip(atelier_video, modele=MELE.identifiant, prompt="marche", asset=sprite)
    )[0]["identifiant"]
    await atelier_video.animation.attendre_tout()

    reponse = client_video.get(f"/api/clips/{identifiant}/frames/0")
    assert reponse.status_code == 200
    with Image.open(io.BytesIO(reponse.content)) as image:
        alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    assert alpha.min() == 255


def test_aucun_invariant_du_traitement_ne_bouge(monkeypatch):
    """*Non destructif, sans carte graphique, sans appel au fournisseur.*

    Le module ne connaît que `numpy`, Pillow et la recette : monter une bande ne
    touche donc ni le disque, ni le réseau — et ce qui entre n'est pas modifié."""
    import sys

    images = [_prep(_image()), _prep(_image(bras=BRAS))]
    empreintes = [img.tobytes() for img in images]
    monter(images, RECETTE, fenetre_commune(images, RECETTE))
    # **Ce qui entre ressort intact** : le traitement est non destructif jusque
    # dans ses tableaux de travail.
    assert [img.tobytes() for img in images] == empreintes
    assert "torch" not in sys.modules
