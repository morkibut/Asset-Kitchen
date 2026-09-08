# -*- coding: utf-8 -*-
"""B20 — les calques d'animation : le calque d'une pose, reposé image par image.

**Planche** : `docs/pistes-2026-09-04/carnet/Emploi.dc.html`. Bloquée par `B11`
et `B19`, tenues toutes les deux.

C'est le seul chemin pour qu'un personnage équipé bouge, et il ne demande aucune
image de plus : le calque existe (`C3`), les images du clip existent (`A10`), et
le calcul qui les met l'une sur l'autre existe aussi (`M1`,
`atelier/image/calque.py::proposer`). Ce qui manquait était le champ *pièce* sur
une bande — les mots « pièce » et « équipement » n'apparaissaient nulle part
dans toute la couche animation.

Ce qui se mesure ici, dans l'ordre des critères d'acceptation :

1. **Une bande porte sa pièce**, et une bande d'avant la tranche se relit sans
   habillage sans qu'un fichier ait été réécrit. **Et une case sans animation du
   personnage reste vide sans compter comme un manque** — c'est la moitié du
   critère qui décide de la forme du compte, et elle a son plan à elle.
2. **L'écran distingue « le calque tient » de « le calque glisse »**, et la
   distinction est mesurable et non déclarative : *tient* rend un calage par
   image, *glisse* rend le même partout.
3. **Le recalage ne coûte rien et ne rappelle aucun fournisseur** — mesuré sur
   le double, qui compte ses appels, et sur le service, qui ne tient aucun
   fournisseur à tenir.
4. **Un calage gardé à la main se réutilise sur la pièce suivante.**

Et un cinquième plan, qui n'est pas un critère mais l'invariant qu'on avait
promis de ne pas casser : **un calque reste solidaire de sa pose** (`C3`, tenu
par `B19`). L'axe des directions entre ici — une bande en a une — sans jamais
descendre dans le rangement des images.

**Aucune planche n'est payée.** Les calques sont posés à la main — trois champs
sur un asset importé, le geste de `test_b19.py` et de `test_e15.py` —, et le
clip est écrit sur le disque plutôt que décodé d'une vidéo : ce qu'on mesure est
la géométrie du recalage, pas l'extraction d'images, qui a ses propres essais.
"""

from __future__ import annotations

import itertools

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.animation import Clip
from atelier.domaine.bande import Bande, Cadre, Prise
from atelier.domaine.calque_anime import (
    A_HABILLER,
    GLISSE,
    HABILLE,
    SANS_ANIMATION,
    SANS_CALQUE,
    TIENT,
    Habillage,
)
from atelier.domaine.generation import Generation
from atelier.domaine.recette import Recette
from atelier.domaine.superposition import ReglagesGardes

_DISTINCTES = itertools.count(3)

COTE = 48
IMAGES = 6


# ── Le décor : un clip écrit à la main, un porteur, une pièce, ses calques ───


def _images_du_clip() -> list[np.ndarray]:
    """Un corps qui **se déplace d'image en image**, et c'est tout l'intérêt.

    Le bloc descend de deux pixels par image. Un calque calé une seule fois
    tombera donc juste sur la première et de plus en plus à côté ensuite : c'est
    la seule forme de clip sur laquelle « tient » et « glisse » ne rendent pas
    la même chose. Un sujet immobile ferait passer l'essai sans rien mesurer.
    """
    suite = []
    for numero in range(IMAGES):
        image = np.full((COTE, COTE, 4), 0, dtype="uint8")
        haut = 6 + numero * 2
        image[haut : haut + 24, 14:34] = (40, 40, 40, 255)
        suite.append(image)
    return suite


def _clip_ecrit(atelier, identifiant: str = "clip-paye") -> str:
    """Un clip payé, posé sur le disque **sans passer par une vidéo**.

    Le décodeur a ses essais ; ici il ne mesurerait rien et coûterait une
    dépendance de plus. Ce que le montage demande d'un clip est exactement deux
    choses : une génération qui se dit clip, et des PNG numérotés à côté.
    """
    generation = Generation(
        identifiant=identifiant,
        modele="modele-video-double",
        demande={},
        parametres_resolus={},
        projet=atelier.bibliotheque.courant,
        clip=Clip(travail="t-1", images=IMAGES, cadence=8.0),
    )
    atelier.base.enregistrer(generation)
    dossier = atelier.fichiers.dossier_images_clip(identifiant, 0)
    for numero, image in enumerate(_images_du_clip()):
        Image.fromarray(image, mode="RGBA").save(dossier / f"{numero:04d}.png")
    return identifiant


def _creer(client, nom: str) -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _piece(client, nom: str, **corps) -> str:
    reponse = client.post("/api/characters/pieces", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["piece"]["identifiant"]


def _poser_un_calque(atelier, client, tmp_path, *, personnage, piece, pose="repos"):
    """Un calque tel que le dépliage d'une planche d'équipement l'aurait laissé.

    Une pièce plus petite que le corps, et **opaque** : le recalage cherche ce
    que les deux images ont de commun, et un calque transparent ne lui donnerait
    rien à trouver.

    ⚠️ **Chaque calque porte un pixel à lui**, et ce n'est pas décoratif :
    l'import écarte deux fichiers de mêmes octets, si bien que deux calques
    identiques n'en feraient qu'un et que le second appel rendrait `None`. C'est
    la même précaution que `logique_l=rang` dans `test_b19.py`.
    """
    rang = next(_DISTINCTES)
    fichier = tmp_path / f"calque-{personnage}-{piece}-{rang}.png"
    image = np.zeros((COTE, COTE, 4), dtype="uint8")
    image[6:30, 14:34] = (40, 40, 40, 255)
    image[0, rang % COTE] = (255, 0, 0, 255)
    Image.fromarray(image, mode="RGBA").save(fichier)

    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    objet = atelier.assets.lire(asset["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    atelier.assets.sauver(objet)
    return objet.identifiant


def _poser_une_bande(
    atelier,
    *,
    personnage=None,
    pose=None,
    direction=None,
    clip="clip-paye",
    nom="marche",
    habillage=None,
    supprime_le=None,
) -> Bande:
    """Une bande gardée, telle qu'un montage l'aurait laissée — le geste de
    `test_b11.py`, écrit dans le dépôt plutôt que produit par le découpage."""
    bande = Bande(
        identifiant=f"bande-{next(_DISTINCTES)}",
        clip=clip,
        nom=nom,
        prises=tuple(Prise(numero=n) for n in range(IMAGES)),
        cadence=8.0,
        cadre=Cadre(),
        recette=Recette(),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
        habillage=habillage,
        supprime_le=supprime_le,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


@pytest.fixture
def decor(atelier, client, tmp_path):
    """Le goliath, son épée, son calque de repos, et sa marche découpée.

    Un seul décor pour toute la tranche : la matrice, le geste et le calage
    posent tous les trois les mêmes questions sur les mêmes objets.
    """
    _clip_ecrit(atelier)
    porteur = _creer(client, "Le goliath")
    piece = _piece(client, "Epée")
    calque = _poser_un_calque(
        atelier, client, tmp_path, personnage=porteur, piece=piece, pose="repos"
    )
    bande = _poser_une_bande(atelier, personnage=porteur, pose="repos")
    return {
        "porteur": porteur,
        "piece": piece,
        "calque": calque,
        "bande": bande,
    }


# ── 1. Une bande porte sa pièce ─────────────────────────────────────────────


def test_une_bande_d_avant_b20_se_relit_sans_habillage():
    """*Une fiche sans la clé ancienne rend un état vide, pas une erreur* — la
    garde de `Collection.membres`, reportée ici au mot près.

    Aucun fichier du disque n'a été réécrit pour cette tranche, et c'est ce que
    cet essai verrouille : les mots « pièce » et « habillage » sont **absents**
    de toutes les bandes existantes.
    """
    ancienne = {
        "identifiant": "bande-ancienne",
        "clip": "clip-1",
        "nom": "marche",
        "images": [0, 2, 4],
        "cadence": 8.0,
        "sens": "boucle",
    }

    bande = Bande.depuis_json(ancienne)

    assert bande.habillage is None
    assert bande.piece is None
    assert bande.habillee is False
    assert bande.calages == ()
    assert bande.calage_garde is None


def test_une_bande_habillee_se_relit_avec_sa_piece_et_sa_tenue():
    """Le champ qui manquait, et il fait l'aller-retour sans rien perdre."""
    bande = Bande(
        identifiant="bande-1",
        clip="clip-1",
        habillage=Habillage(piece="epee", tenue=GLISSE),
    )

    relue = Bande.depuis_json(bande.en_json())

    assert relue.piece == "epee"
    assert relue.habillee is True
    assert relue.habillage is not None
    assert relue.habillage.tenue == GLISSE
    # **`piece` est écrite à plat en plus de l'habillage**, et c'est ce que lit
    # le rangement — la colonne SQL comme la matrice.
    assert bande.en_json()["piece"] == "epee"


def test_une_tenue_inconnue_retombe_sur_le_defaut():
    """La liste est close, et un fichier abîmé ne la rouvre pas — même règle que
    le genre d'un emploi et que le sens d'une bande."""
    relue = Bande.depuis_json(
        {
            "identifiant": "b",
            "clip": "c",
            "habillage": {"piece": "epee", "tenue": "n-importe-quoi"},
        }
    )

    assert relue.habillage is not None
    assert relue.habillage.tenue == TIENT


def test_une_bande_habillee_ne_remplit_pas_la_case_du_corps(atelier, client, decor):
    """**C'est le `piece IS NULL` de `C3`, posé sur les animations.**

    Sans lui, habiller la marche du goliath remplirait la case *marche* une
    seconde fois : la matrice dirait deux animations là où le personnage n'en a
    qu'une, et la seconde ne se serait jamais découpée.
    """
    porteur, piece = decor["porteur"], decor["piece"]
    avant = atelier.base.bandes_par_pose(atelier.bibliotheque.courant, [porteur])

    _poser_une_bande(
        atelier,
        personnage=porteur,
        pose="repos",
        habillage=Habillage(piece=piece),
    )
    apres = atelier.base.bandes_par_pose(atelier.bibliotheque.courant, [porteur])

    assert apres == avant, (
        "une bande habillée s'est comptée comme une animation du personnage"
    )


# ── 1 bis. Une case sans animation ne compte pas comme un manque ────────────


def test_une_case_sans_animation_du_personnage_reste_vide_sans_etre_un_manque(
    atelier, client, tmp_path, decor
):
    """Le critère qui décide de la forme du compte.

    Une animation d'équipement suit celle du personnage. Là où le personnage n'a
    rien, il n'y a rien à habiller — et l'afficher en manque serait annoncer un
    trou qu'aucun clic ne peut combler.

    Le décor pose exprès **un calque sur une pose sans animation** : c'est le
    seul cas où l'ordre des questions se voit. Si l'état se décidait sur le
    calque d'abord, cette case dirait *à habiller* et compterait.
    """
    porteur, piece = decor["porteur"], decor["piece"]
    # L'attaque a son calque, mais le goliath n'a pas d'animation d'attaque.
    _poser_un_calque(
        atelier, client, tmp_path, personnage=porteur, piece=piece, pose="attaque"
    )

    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, piece, porteur
    )
    par_pose = {r["pose"]: r for r in matrice["rangees"]}

    assert par_pose["attaque"]["etat"] == SANS_ANIMATION
    assert "rien à habiller" in par_pose["attaque"]["mot"]
    # **Elle ne compte pas** — ni au fait, ni à l'attendu.
    poses_comptees = {
        r["pose"] for r in matrice["rangees"] if r["etat"] != SANS_ANIMATION
    }
    assert "attaque" not in poses_comptees
    assert matrice["attendu"] == len(poses_comptees)
    assert matrice["sans_animation"] >= 1


def test_une_case_sans_calque_est_un_manque_lui(atelier, client, decor):
    """La distinction que la tranche doit tenir : **l'un se répare, l'autre non**.

    Une pose qui a l'animation mais pas le calque manque vraiment — une planche
    d'équipement le donnera. C'est un trou qu'on peut combler, donc il compte.
    """
    porteur, piece = decor["porteur"], decor["piece"]
    # La marche a son animation, et pas de calque de l'épée.
    _poser_une_bande(atelier, personnage=porteur, pose="marche")

    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, piece, porteur
    )
    par_pose = {r["pose"]: r for r in matrice["rangees"]}

    assert par_pose["marche"]["etat"] == SANS_CALQUE
    assert par_pose["repos"]["etat"] == A_HABILLER
    # Les deux comptent dans l'attendu ; aucune n'est faite.
    assert matrice["fait"] == 0
    assert matrice["attendu"] >= 2


# ── 2. Le calque tient, ou le calque glisse ─────────────────────────────────


def test_le_calque_tient_rend_un_calage_par_image(atelier, decor):
    """**Recalé sur chacune des images**, et le clip d'essai bouge exprès.

    Le corps descend de deux pixels par image : des calages tous identiques
    voudraient dire que le recalage n'a pas été rejoué.
    """
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    assert len(habillee["calages"]) == IMAGES
    hauteurs = {c["dy"] for c in habillee["calages"]}
    assert len(hauteurs) > 1, (
        "tous les calages sont identiques — le recalage n'a pas suivi le corps"
    )


def test_le_calque_glisse_sert_le_meme_calage_partout(atelier, decor):
    """**Un seul calage a servi pour les six**, et c'est ce qui se voit dès que
    le personnage bouge : dix fois moins de calcul, un calque qui décroche."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], GLISSE
    )

    assert len(habillee["calages"]) == IMAGES
    poses = {(c["echelle"], c["dx"], c["dy"]) for c in habillee["calages"]}
    assert len(poses) == 1, "le calage a changé alors que le calque glisse"


def test_les_deux_tenues_ne_rendent_pas_la_meme_chose(atelier, decor):
    """La distinction n'est pas décorative : sur ce clip-là, elle se mesure.

    Si les deux rendaient les mêmes nombres, l'écran distinguerait deux mots
    pour un seul comportement — et l'auteur n'aurait aucun moyen de s'en
    apercevoir.
    """
    tient = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )
    autre = _poser_une_bande(
        atelier, personnage=decor["porteur"], pose="repos", nom="repos-bis"
    )
    glisse = atelier.calques_animes.habiller(
        autre.identifiant, decor["piece"], GLISSE
    )

    assert [c["dy"] for c in tient["calages"]] != [
        c["dy"] for c in glisse["calages"]
    ]


def test_changer_de_tenue_refait_les_nombres(atelier, decor):
    """Une bascule qui ne changerait pas les calages ne changerait rien à
    l'écran, ce qui ne se distingue pas d'une bascule cassée."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], GLISSE
    )
    avant = [c["dy"] for c in habillee["calages"]]

    apres = atelier.calques_animes.regler(habillee["identifiant"], TIENT)

    assert apres["habillage"]["tenue"] == TIENT
    assert [c["dy"] for c in apres["calages"]] != avant


def test_l_ecran_recoit_le_mot_de_chaque_tenue(atelier, decor):
    """Le grisé porte sa raison, et un état porte son mot — l'écran ne rejoue
    jamais la règle, il lit ce que le serveur pose."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], GLISSE
    )

    assert habillee["habillage"]["mot"] == "un seul calage pour toute la bande"


# ── 3. Le recalage ne coûte rien et ne rappelle aucun fournisseur ───────────


def test_habiller_ne_rappelle_aucun_fournisseur(atelier, double, decor):
    """**Mesuré, pas affirmé.** Le double compte ses appels ; il n'en reçoit
    aucun.

    C'est la promesse de l'écran — *le recalage ne coûte rien* —, et elle tient
    par construction : le service des calques d'animation ne reçoit ni
    catalogue, ni fournisseur, ni animateur. Ce qu'il ne tient pas, il ne peut
    pas l'appeler.
    """
    avant = double.appels

    atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    assert double.appels == avant


def test_habiller_ne_depense_rien(atelier, client, decor):
    """Aucune génération de plus, donc aucune dépense : ce qui n'appelle pas ne
    facture pas."""
    projet = atelier.bibliotheque.courant
    avant = len(atelier.base.generations_du_projet(projet))

    atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    assert len(atelier.base.generations_du_projet(projet)) == avant


def test_le_service_ne_tient_aucun_fournisseur(atelier):
    """La privation qui rend la phrase vraie — la même que le montage.

    Un service qui tiendrait un catalogue pourrait appeler un jour, et la
    promesse deviendrait une intention. Celui-ci n'a pas l'attribut.
    """
    service = atelier.calques_animes

    assert not hasattr(service, "_catalogue")
    assert not hasattr(service, "_fournisseur")
    assert not hasattr(service, "_animateur")


# ── 4. Un calage gardé à la main se réutilise sur la pièce suivante ────────


def test_un_calage_pose_a_la_main_l_emporte_sur_le_recalage(atelier, decor):
    """La main place exactement, quand le calcul s'est trompé. Les deux ne se
    contredisent pas : le second laisse une trace, le premier non."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    cale = atelier.calques_animes.caler_a_la_main(
        habillee["identifiant"], echelle=1.5, dx=7, dy=-3
    )

    assert cale["habillage"]["a_la_main"] is True
    assert {(c["echelle"], c["dx"], c["dy"]) for c in cale["calages"]} == {
        (1.5, 7, -3)
    }


def test_un_calage_garde_a_la_main_sert_a_la_piece_suivante(
    atelier, client, tmp_path, decor
):
    """**Le critère de la tranche.**

    Un jeu de réglages qui marche pour un casque marche à peu près pour le
    suivant : même corps, même mouvement, même calage à quelques pixels près. Il
    revient prérempli sur la pièce d'après, sans qu'on l'ait redemandé.
    """
    porteur = decor["porteur"]
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )
    atelier.calques_animes.caler_a_la_main(
        habillee["identifiant"], echelle=1.25, dx=4, dy=-2
    )

    # Une seconde pièce, sur le même corps et la même animation.
    casque = _piece(client, "Casque de fer")
    _poser_un_calque(
        atelier, client, tmp_path, personnage=porteur, piece=casque, pose="repos"
    )
    suivante = atelier.calques_animes.habiller(
        decor["bande"].identifiant, casque, TIENT
    )

    assert suivante["habillage"]["a_la_main"] is True, (
        "la pièce suivante est repartie de zéro"
    )
    assert {(c["echelle"], c["dx"], c["dy"]) for c in suivante["calages"]} == {
        (1.25, 4, -2)
    }
    assert suivante["habillage"]["main"]["depuis"]


def test_le_calage_garde_vit_sur_la_bande_nue_jamais_sur_l_habillee(atelier, decor):
    """L'habillée est celle d'une pièce ; la nue est celle du corps que toutes
    les pièces partagent — et c'est la seule des deux que la pièce suivante
    rencontrera."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )
    atelier.calques_animes.caler_a_la_main(
        habillee["identifiant"], echelle=1.1, dx=2, dy=2
    )

    nue = atelier.montage.bande(decor["bande"].identifiant)
    posee = atelier.montage.bande(habillee["identifiant"])

    assert nue.calage_garde is not None
    assert (nue.calage_garde.echelle, nue.calage_garde.dx) == (1.1, 2)
    assert posee.calage_garde is None


def test_un_calage_a_la_main_peut_ne_pas_etre_garde(atelier, decor):
    """Un calage bon pour une seule pièce ne doit pas s'imposer à la suivante.
    Le défaut garde ; le refus reste possible."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    atelier.calques_animes.caler_a_la_main(
        habillee["identifiant"], echelle=1.4, dx=9, dy=9, garder=False
    )

    assert atelier.montage.bande(decor["bande"].identifiant).calage_garde is None


def test_oublier_le_calage_rend_la_main_au_recalage(atelier, decor):
    """Tout ce que le produit devine se défait d'un clic ; ce que l'auteur pose
    aussi."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )
    atelier.calques_animes.caler_a_la_main(
        habillee["identifiant"], echelle=2.0, dx=11, dy=11
    )

    rendue = atelier.calques_animes.oublier_le_calage(habillee["identifiant"])

    assert rendue["habillage"]["a_la_main"] is False
    assert {(c["dx"], c["dy"]) for c in rendue["calages"]} != {(11, 11)}


# ── 5. L'invariant de C3 : un calque reste solidaire de sa pose ────────────


def test_les_quatre_directions_d_une_pose_partagent_le_meme_calque(
    atelier, client, decor
):
    """**C'est la géométrie de la tranche, et elle tient en une phrase.**

    Un calque n'a de direction nulle part — `B19` l'a verrouillé. Une bande en a
    une. Les deux se concilient dans un seul sens : la direction vient de la
    bande, et habiller les quatre bandes d'une pose consulte quatre fois *le
    même* calque.

    Sans quoi il aurait fallu vingt-quatre calques là où le dépôt en range six,
    et chacun des dix-huit autres aurait été une génération à payer.
    """
    porteur, piece = decor["porteur"], decor["piece"]
    client.put("/api/universe", json={"vue": "vue-dessus-34"})

    posees = []
    for direction in ("sud", "nord", "est", "ouest"):
        bande = _poser_une_bande(
            atelier,
            personnage=porteur,
            pose="repos",
            direction=direction,
            nom=f"repos-{direction}",
        )
        posees.append(atelier.calques_animes.habiller(bande.identifiant, piece, TIENT))

    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, piece, porteur
    )
    calques = {
        r["calque"] for r in matrice["rangees"] if r["pose"] == "repos" and r["calque"]
    }
    assert calques == {decor["calque"]}, (
        "les directions d'une pose n'ont pas toutes lu le même calque"
    )


def test_habiller_ne_cree_aucun_calque(atelier, client, decor):
    """Aucune image n'est fabriquée : c'est toute la promesse de la tranche.

    Le compte d'assets ne bouge pas d'une unité — ni un calque par direction, ni
    une image habillée gardée sur le disque.
    """
    avant = len(atelier.base.assets())

    atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    assert len(atelier.base.assets()) == avant


def test_la_matrice_rend_une_rangee_par_pose_et_par_direction(
    atelier, client, decor
):
    """La forme que la planche demande, et que la matrice des images ne peut pas
    rendre : *une rangée par pose et par direction*.

    C'est légitime ici et refusé là-bas, pour une raison exacte : ce qu'on range
    est une **bande**, et une bande porte sa direction depuis `A10`.
    """
    porteur, piece = decor["porteur"], decor["piece"]
    client.put("/api/universe", json={"vue": "vue-dessus-34"})

    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, piece, porteur
    )
    repos = [r for r in matrice["rangees"] if r["pose"] == "repos"]

    assert len(repos) == 4
    assert {r["direction"] for r in repos} == {"sud", "nord", "est", "ouest"}


# ── Les refus, et ils portent leur geste ───────────────────────────────────


def test_habiller_une_pose_sans_calque_est_refuse_avec_le_geste(atelier, decor):
    """Le grisé porte sa raison : le refus dit ce qui le lèverait."""
    from atelier.services.calques_animes import HabillageRefuse

    marche = _poser_une_bande(atelier, personnage=decor["porteur"], pose="marche")

    with pytest.raises(HabillageRefuse) as refus:
        atelier.calques_animes.habiller(marche.identifiant, decor["piece"], TIENT)

    assert "planche d'équipement" in str(refus.value)


def test_on_n_habille_pas_ce_qui_est_deja_habille(atelier, decor):
    """On habille le corps, jamais ce qui est posé dessus — sans quoi rien ne
    dirait plus quel calque est sous quel autre."""
    from atelier.services.calques_animes import HabillageRefuse

    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    with pytest.raises(HabillageRefuse):
        atelier.calques_animes.habiller(
            habillee["identifiant"], decor["piece"], TIENT
        )


def test_une_tenue_inconnue_est_refusee(atelier, decor):
    """La liste est close côté geste aussi, et le refus la nomme."""
    from atelier.services.calques_animes import HabillageRefuse

    with pytest.raises(HabillageRefuse) as refus:
        atelier.calques_animes.habiller(
            decor["bande"].identifiant, decor["piece"], "flotte"
        )

    assert "tient" in str(refus.value)


# ── Les routes, et ce qu'elles rendent ─────────────────────────────────────


def test_la_route_de_la_matrice_repond(client, atelier, decor):
    """Elle est déclarée **avant** `/characters/pieces/{identifiant}/wearers` et
    après `/characters/pieces/uses` — le piège des routes à segments, payé
    trois fois dans ce dépôt."""
    reponse = client.get(
        f"/api/characters/pieces/{decor['piece']}/animations/{decor['porteur']}"
    )

    assert reponse.status_code == 200, reponse.text
    charge = reponse.json()
    assert charge["porteur"]["identifiant"] == decor["porteur"]
    assert charge["rangees"]


def test_les_routes_du_calque_anime_font_le_tour(client, decor):
    """Poser, régler, caler, oublier le calage, retirer — le geste entier par
    la porte que l'écran emprunte."""
    bande = decor["bande"].identifiant

    pose = client.post(
        f"/api/strips/{bande}/layer",
        json={"piece": decor["piece"], "tenue": TIENT},
    )
    assert pose.status_code == 201, pose.text
    habillee = pose.json()["identifiant"]

    assert (
        client.put(f"/api/strips/{habillee}/layer", json={"tenue": GLISSE}).json()[
            "habillage"
        ]["tenue"]
        == GLISSE
    )
    cale = client.post(
        f"/api/strips/{habillee}/layer/align",
        json={"echelle": 1.2, "dx": 3, "dy": 1},
    )
    assert cale.status_code == 200, cale.text
    assert cale.json()["habillage"]["a_la_main"] is True

    assert (
        client.delete(f"/api/strips/{habillee}/layer/align").json()["habillage"][
            "a_la_main"
        ]
        is False
    )
    assert client.delete(f"/api/strips/{habillee}/layer").status_code == 200


def test_l_apercu_rend_les_images_habillees_sans_rien_ecrire(client, atelier, decor):
    """Un aperçu n'existe nulle part sur le disque, et lui donner une adresse
    obligerait à ranger un brouillon — donc à le nettoyer."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    reponse = client.get(f"/api/strips/{habillee['identifiant']}/layer/preview")

    assert reponse.status_code == 200, reponse.text
    charge = reponse.json()
    assert len(charge["images"]) == IMAGES
    assert all(i.startswith("data:image/png;base64,") for i in charge["images"])


def test_deshabiller_laisse_le_corps_et_le_calque(atelier, client, decor):
    """Rien n'a été payé pour l'habillage, et le refaire ne coûte rien : c'est
    la règle d'un découpage raté, au même endroit du produit."""
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    atelier.calques_animes.deshabiller(habillee["identifiant"])

    assert atelier.montage.bande(decor["bande"].identifiant) is not None
    assert atelier.assets.lire(decor["calque"]) is not None
    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, decor["piece"], decor["porteur"]
    )
    repos = next(r for r in matrice["rangees"] if r["pose"] == "repos")
    assert repos["etat"] == A_HABILLER


# ── La planche : ce qui sort est ce que l'écran montrait ──────────────────


def test_la_planche_d_une_bande_habillee_sort_habillee(atelier, decor):
    """**Le trou trouvé en relisant la tranche, et il ne se voyait nulle part.**

    Une bande habillée est une bande, donc `ServiceMontage.planche` la sert. Il
    assemblait les images du **corps nu** sous le nom de l'habillée : l'écran,
    lui, montrait la pièce — il lit l'aperçu, qui compose —, et l'export aurait
    sorti le corps seul. L'écart ne se serait découvert qu'en ouvrant le fichier
    dans le moteur de jeu.

    La mesure est en octets : deux planches assemblées des mêmes images avec et
    sans la pièce ne peuvent pas être identiques.
    """
    nue = atelier.montage.planche(decor["bande"].identifiant)
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    posee = atelier.montage.planche(habillee["identifiant"])

    assert posee != nue, "la planche de l'habillée est celle du corps nu"


def test_une_bande_nue_garde_exactement_la_planche_qu_elle_avait(atelier, decor):
    """Et le passage d'habillage **ne touche pas** ce qui ne porte rien.

    Le pendant du précédent : un ajout qui changerait au passage les pixels de
    toutes les bandes du dépôt serait pire que le trou qu'il répare.
    """
    avant = atelier.montage.planche(decor["bande"].identifiant)
    atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    apres = atelier.montage.planche(decor["bande"].identifiant)

    assert apres == avant


def test_un_calque_disparu_ne_fait_pas_tomber_la_planche(atelier, decor):
    """**Jamais de cascade** : la bande sort nue, ce qu'elle est redevenue.

    C'est la règle des orphelins du produit — l'état se voit et se répare, il ne
    fait pas tomber l'écran qui l'affiche.
    """
    habillee = atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )
    atelier.bibliotheque.supprimer([decor["calque"]])

    octets = atelier.montage.planche(habillee["identifiant"])

    assert octets


def test_la_matrice_dit_habille_quand_le_calque_est_pose(atelier, decor):
    """Le compte de l'écran est celui du serveur — *un chiffre affiché est un
    chiffre compté*."""
    atelier.calques_animes.habiller(
        decor["bande"].identifiant, decor["piece"], TIENT
    )

    matrice = atelier.calques_animes.matrice(
        atelier.bibliotheque.courant, decor["piece"], decor["porteur"]
    )
    repos = next(r for r in matrice["rangees"] if r["pose"] == "repos")

    assert repos["etat"] == HABILLE
    assert repos["habillee"] is not None
    assert matrice["fait"] == 1
