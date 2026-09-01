# -*- coding: utf-8 -*-
"""Les critères de E3 qui se mesurent sur des pixels — le châssis des tables.

Dix des quatorze critères de la tranche portent sur ce que l'écran montre et
vivent dans `interface/src/App.test.tsx`. Les quatre qui restent travaillent
**sur l'image**, et c'est le serveur qui s'en charge : les taches que le
nettoyage des bords va effacer, les poches de fond que le sujet enferme, les
crans d'occupation où la remise sur grille change vraiment quelque chose, et ce
que la pipette retire quand on lui désigne un point.

**Aucun test de ce fichier ne lit un fichier ni n'appelle le fournisseur** : ils
travaillent sur des tableaux construits à la main, parce que ce qu'ils vérifient
est une propriété des fonctions, pas d'une image particulière.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.recette import Grille, Passe
from atelier.image.taches import crans_occupation, poches_de_fond, taches, trous
from atelier.image.traitement import (
    _detourer,
    detourer_bord,
    detourer_couleur,
    raison_moteur,
)
from tests.conftest import image_sujet


def _vide(cote: int = 16) -> np.ndarray:
    return np.zeros((cote, cote, 4), dtype=np.uint8)


def _poser(rgba: np.ndarray, x0: int, y0: int, x1: int, y1: int, couleur=(200, 100, 50)):
    rgba[y0 : y1 + 1, x0 : x1 + 1, :3] = couleur
    rgba[y0 : y1 + 1, x0 : x1 + 1, 3] = 255


# ── « L'aire minimale liste les taches qu'elle va effacer, triées » ───────────


def test_les_taches_se_listent_de_la_plus_petite_a_la_plus_grande():
    """L'ordre est la moitié de la réponse.

    Le nettoyage des bords efface **en dessous d'un seuil** : ce qu'on veut lire
    d'abord est donc ce qui partira en premier. Une liste triée par position
    obligerait à chercher des yeux la plus petite, qui est précisément celle qui
    décide du seuil.
    """
    image = _vide()
    _poser(image, 1, 1, 1, 1)  # 1 pixel
    _poser(image, 4, 4, 5, 5)  # 4 pixels
    _poser(image, 8, 8, 12, 12)  # 25 pixels

    trouvees = taches(image)
    assert [t.aire for t in trouvees] == [1, 4, 25]


def test_le_sujet_lui_meme_figure_dans_la_liste():
    """Le taire ferait croire qu'il y a douze taches là où il y en a treize.

    Le sujet est une tache comme les autres — la plus grande —, et c'est
    justement ce qui permet de lire le seuil comme un rang : « en dessous de
    quatre pixels, j'efface les trois premières et je garde les deux autres ».
    """
    image = _vide()
    _poser(image, 0, 0, 9, 9)  # le sujet
    _poser(image, 14, 14, 14, 14)  # une poussière

    assert [t.aire for t in taches(image)] == [1, 100]


def test_une_tache_porte_sa_boite_et_sa_couleur():
    """De quoi la désigner à l'œil, et de quoi retirer toutes celles de sa
    couleur d'un geste — sans que l'écran ait à redescendre les pixels."""
    image = _vide()
    _poser(image, 3, 5, 6, 8, couleur=(20, 40, 60))

    (tache,) = taches(image)
    assert tache.boite == (3, 5, 6, 8)
    assert tache.couleur == "#14283c"


def test_la_liste_se_coupe_et_le_dit():
    """Une image bruitée peut porter des milliers de taches d'un pixel.

    La liste sert à **regarder** : la couper est nécessaire, la couper en
    silence ne l'est pas. Le plafond se demande, et le compte de ce qui manque
    se lit ailleurs — ici on vérifie seulement que le plafond tient.
    """
    image = _vide(32)
    for i in range(0, 32, 2):
        for j in range(0, 32, 2):
            _poser(image, i, j, i, j)

    assert len(taches(image, plafond=10)) == 10


# ── « Le détourage propose les poches de fond enfermées, cerclées et comptées,
#     et n'en efface aucune de lui-même » ──────────────────────────────────────


def test_une_poche_de_fond_enfermee_est_trouvee_alors_qu_elle_est_encore_opaque():
    """**La mesure décrit ce qui est encore là, pas ce qui est déjà parti.**

    C'était la faute, trouvée en fermant l'étape le 31 août 2026 : la mesure
    cherchait des zones *transparentes*, alors qu'une poche que le remplissage
    depuis le bord n'atteint pas reste **opaque** — c'est la définition même de
    « il ne l'atteint pas ». Elle ne trouvait donc la poche qu'*après* que la
    pipette l'eut retirée, c'est-à-dire au moment où il n'y avait plus rien à
    proposer. Mesuré sur les soixante images du dépôt : zéro trouvée, partout.
    """
    image = _anneau()
    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    assert detoure[7, 7, 3] == 255, "la poche doit être encore opaque"

    (poche,), total = poches_de_fond(detoure, 28)
    assert total == 1
    assert poche.aire == 16
    assert poche.boite == (6, 6, 9, 9)


def test_le_fond_qui_touche_un_bord_n_est_pas_une_poche():
    """C'est la définition même : le fond relié à une bordure est déjà parti,
    et il ne reste que ce qu'aucun chemin ne rejoint."""
    image = np.zeros((16, 16, 4), dtype=np.uint8)
    image[:, :, :3] = (240, 240, 240)
    image[:, :, 3] = 255
    image[4:12, 4:12, :3] = (20, 30, 40)  # un sujet plein, du fond tout autour

    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    poches, total = poches_de_fond(detoure, 28)
    assert poches == [] and total == 0


def test_deux_poches_se_lisent_de_la_plus_grande_a_la_plus_petite():
    """L'ordre inverse de celui des taches, et pour la raison inverse : une
    poche ne s'efface pas sous un seuil, elle se regarde. La plus grande est
    celle dont on se demande d'abord si c'est du fond ou de la matière."""
    image = np.zeros((20, 20, 4), dtype=np.uint8)
    image[:, :, :3] = (240, 240, 240)
    image[:, :, 3] = 255
    image[1:19, 1:19, :3] = (20, 30, 40)
    image[3:5, 3:5, :3] = (240, 240, 240)  # 4 pixels
    image[10:15, 10:15, :3] = (240, 240, 240)  # 25 pixels

    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    trouvees, total = poches_de_fond(detoure, 28)
    assert [p.aire for p in trouvees] == [25, 4]
    assert total == 2


def test_le_point_d_une_poche_est_dedans_meme_quand_elle_est_creuse():
    """**Le centre de la boîte n'est pas dans la zone dès qu'elle est courbe.**

    Un croissant de fond entre un bras et un torse a son centre géométrique
    *dans le bras* : une proposition qui viserait ce centre retirerait le sujet.
    Le point rendu est un pixel de la zone, pris au balayage.
    """
    image = np.zeros((20, 20, 4), dtype=np.uint8)
    image[:, :, :3] = (240, 240, 240)
    image[:, :, 3] = 255
    image[1:19, 1:19, :3] = (20, 30, 40)
    # Un anneau de fond : creux au milieu, et le milieu est de la matière.
    image[5:15, 5:15, :3] = (240, 240, 240)
    image[7:13, 7:13, :3] = (20, 30, 40)

    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    (poche, *_), _ = poches_de_fond(detoure, 28)
    x0, y0, x1, y1 = poche.boite
    milieu = ((x0 + x1) // 2, (y0 + y1) // 2)

    # Le centre de la boîte tombe dans la matière — c'est le piège…
    assert tuple(image[milieu[1], milieu[0], :3]) == (20, 30, 40)
    # …et le point rendu, lui, est bien du fond.
    x, y = poche.point
    assert tuple(image[y, x, :3]) == (240, 240, 240)


def test_ce_qui_est_coupe_de_la_liste_se_dit():
    """Une image bruitée porte des milliers de poches d'un pixel — mesuré :
    quarante-trois par image en médiane, jusqu'à seize mille. La liste sert à
    *regarder*, donc elle est courte ; le compte, lui, est entier."""
    image = np.zeros((40, 40, 4), dtype=np.uint8)
    image[:, :, :3] = (240, 240, 240)
    image[:, :, 3] = 255
    image[2:38, 2:38, :3] = (20, 30, 40)
    for y in range(5, 35, 3):
        for x in range(5, 35, 3):
            image[y, x, :3] = (240, 240, 240)

    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    trouvees, total = poches_de_fond(detoure, 28, plafond=4)
    assert len(trouvees) == 4
    assert total == 100


def test_aucune_poche_n_est_effacee():
    """Le critère en toutes lettres : **cerclées et comptées, jamais effacées
    seules**. La fonction décrit, elle ne touche pas au tableau qu'on lui donne."""
    image = _anneau()
    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))
    avant = detoure.copy()

    poches_de_fond(detoure, 28)
    assert np.array_equal(detoure, avant)


def test_un_trou_de_silhouette_est_transparent_et_ne_se_confond_pas_avec_une_poche():
    """**Les deux mesures sont exactement inverses**, et c'est pour ça qu'elles
    portent deux noms depuis le 31 août 2026. Le contour lit les trous — il les
    longe ou pas ; le détourage lit les poches — il propose de les retirer. Une
    seule fonction servait les deux, et elle rendait la mauvaise au détourage.
    """
    image = _anneau()
    detoure = _detourer(image, Passe(moteur="bord", tolerance=28))

    # La poche est là, opaque : le contour n'a aucun trou à longer.
    assert len(poches_de_fond(detoure, 28)[0]) == 1
    assert trous(detoure) == []

    # La pipette la retire — et c'est *maintenant* que le contour a un trou.
    apres = _detourer(
        detoure, Passe(moteur="couleur", tolerance=28, point=(7, 7))
    )
    assert poches_de_fond(apres, 28)[0] == []
    assert len(trous(apres)) == 1


# ── « Le curseur d'occupation ne s'arrête que là où l'image change » ──────────


def test_les_crans_d_occupation_ne_gardent_que_ce_qui_change():
    """Quatre-vingt-onze positions pour une trentaine de tailles possibles.

    Sur une cible de 64 pixels, deux occupations voisines donnent souvent la
    même taille de sujet — donc la même image. Le curseur s'arrêtait quand même
    à chacune, et la main croyait régler quelque chose.
    """
    image = _vide()
    _poser(image, 4, 4, 11, 11)

    crans = crans_occupation(image, Grille(cible=16))
    # Sur une cible de 16, il n'y a que seize tailles entières possibles — et
    # l'occupation commence à 10 %, donc moins encore.
    assert len(crans) < 91
    assert crans[0] == 10
    # Chaque cran donne une taille que le précédent ne donnait pas.
    tailles = [round(16 * c / 100) for c in crans]
    assert len(tailles) == len(set(tailles))


def test_une_cible_plus_fine_laisse_plus_de_crans():
    """C'est la propriété qui rend la mesure utile : elle suit l'image, elle
    n'est pas un nombre choisi une fois."""
    image = _vide()
    _poser(image, 4, 4, 11, 11)

    assert len(crans_occupation(image, Grille(cible=128))) > len(
        crans_occupation(image, Grille(cible=16))
    )


def test_une_image_sans_sujet_n_a_aucun_cran():
    """Zéro n'est pas une valeur d'occupation, c'est l'absence de sujet — et le
    produit ne rend pas une liste de crans pour une image vide."""
    assert crans_occupation(_vide(), Grille(cible=64)) == []


# ── « La pipette retire une tache, ou toutes les taches de sa couleur » ───────
#
# Le décor de ces essais est toujours le même, parce que c'est le cas qui a fait
# admettre la pipette (A-22) : un anneau plein, percé en son milieu par une
# **poche de fond enfermée**. Le fond du milieu a exactement la couleur du fond
# du dehors, et pourtant aucune valeur de tolérance ne l'atteint depuis les
# bords : le chemin n'existe pas.


def _anneau(fond=(240, 240, 240), matiere=(20, 30, 40)) -> np.ndarray:
    """Un anneau opaque sur un fond plat, avec un trou de la couleur du fond."""
    image = np.zeros((16, 16, 4), dtype=np.uint8)
    image[:, :, :3] = fond
    image[:, :, 3] = 255
    image[2:14, 2:14, :3] = matiere
    image[6:10, 6:10, :3] = fond  # le trou, enfermé par la matière
    return image


def test_le_remplissage_depuis_le_bord_n_atteint_pas_une_poche_enfermee():
    """**Le fait qui a fait tomber l'exclusion**, et il se mesure.

    « Détourage par couleur » figurait dans les exclusions du document du
    produit. Ce qui l'en a sorti n'est pas un goût : c'est qu'une poche
    entièrement entourée par le sujet n'est reliée à aucune bordure, donc
    qu'aucun réglage du moteur courant ne peut la retirer.

    **La propriété se dit à l'endroit exact où elle vaut**, et le premier jet de
    ce test l'avait écrite trop large : à tolérance 255 la poche part
    effectivement — mais parce que le moteur a d'abord mangé la matière qui
    l'enfermait, et qu'il ne reste alors plus rien du tout. Un détourage qui
    efface l'image entière n'a pas « atteint la poche ». Ce qui se vérifie est
    donc : *tant que la matière tient, la poche tient avec elle*.
    """
    image = _anneau()
    testees = 0
    for tolerance in range(0, 256):
        alpha = detourer_bord(image[:, :, :3], tolerance)
        if alpha[3, 3] == 0:  # la matière est partie : ce n'est plus un détourage
            continue
        testees += 1
        assert alpha[7, 7] == 255, f"la poche est partie à la tolérance {tolerance}"
    # Et il y en a beaucoup, pas deux : l'écart entre le fond et la matière fait
    # 220, donc le moteur garde le sujet jusqu'à 219 — et la poche jusque-là.
    assert testees == 220


def test_la_pipette_retire_la_tache_sous_le_point_et_elle_seule():
    """Le geste pour lequel elle a été admise, et c'est le défaut."""
    image = _anneau()
    alpha = detourer_couleur(image[:, :, :3], (7, 7), 28)

    assert alpha[7, 7] == 0  # la poche visée est partie…
    assert alpha[0, 0] == 255  # …et le fond du dehors, de la même couleur, reste
    assert alpha[3, 3] == 255  # la matière aussi


def test_la_pipette_partout_retire_toutes_les_zones_de_cette_couleur():
    """L'autre portée, et elle atteint ce que la première laisse — y compris ce
    qui touche le sujet. Plus expéditif, plus risqué : c'est écrit dans la
    recette parce que c'est l'auteur qui le choisit."""
    image = _anneau()
    alpha = detourer_couleur(image[:, :, :3], (7, 7), 28, partout=True)

    assert alpha[7, 7] == 0  # la poche
    assert alpha[0, 0] == 0  # le fond du dehors, de la même couleur, part aussi
    assert alpha[3, 3] == 255  # la matière reste


def test_les_deux_portees_different_vraiment_sur_la_meme_image():
    """Deux valeurs déclarées, deux comportements distincts — la règle du dépôt
    contre les réglages qui ne font rien (`Passe`, à propos de `bayer`)."""
    image = _anneau()
    une = detourer_couleur(image[:, :, :3], (7, 7), 28)
    toutes = detourer_couleur(image[:, :, :3], (7, 7), 28, partout=True)

    assert int((une == 0).sum()) == 16  # le trou seul
    assert int((toutes == 0).sum()) > 16


def test_la_tolerance_de_la_pipette_est_le_meme_ecart_que_celle_du_bord():
    """Le point désigne un pixel, pas une couleur exacte : un dégradé léger
    autour de lui part avec, et c'est la tolérance qui dit jusqu'où."""
    image = _anneau()
    image[7, 8, :3] = (232, 240, 248)  # un voisin légèrement différent

    serree = detourer_couleur(image[:, :, :3], (7, 7), 2)
    large = detourer_couleur(image[:, :, :3], (7, 7), 28)

    assert serree[7, 8] == 255  # trop loin pour la tolérance serrée
    assert large[7, 8] == 0


def test_une_pipette_sans_point_ne_retire_rien():
    """On ajoute la passe avant de viser. La demi-seconde entre les deux ne doit
    pas manger l'image sous les yeux de celui qui va cliquer — et surtout pas
    *tout* effacer, ce que ferait un point tombé sur le coin par défaut."""
    from atelier.image.traitement import _detourer

    image = _anneau()
    rendu = _detourer(image, Passe(moteur="couleur", point=None))
    assert np.array_equal(rendu, image)


def test_un_point_hors_cadre_ne_retire_rien_non_plus():
    """Le cas qui arrive tout seul : le brut est remplacé par une image plus
    petite, et le point d'une passe posée avant tombe dehors. La recette n'est
    pas refusée — elle ferait disparaître les six autres places pour un point
    devenu caduc —, la passe ne fait simplement plus rien."""
    image = _anneau()
    alpha = detourer_couleur(image[:, :, :3], (99, 99), 28)
    assert bool((alpha == 255).all())


def test_la_pipette_est_toujours_disponible():
    """Elle n'a rien à télécharger : c'est le même remplissage par plages que le
    bord, amorcé ailleurs. Elle n'a donc jamais de raison de grisé, à la
    différence du moteur par modèle."""
    assert raison_moteur("couleur") is None


def test_le_point_survit_a_la_passe_qui_le_precede():
    """**L'arbitrage du critère, mesuré.** Une tache se recalcule à chaque
    rendu : son rang et sa boîte bougent dès qu'une passe au-dessus change d'un
    cran. Un point ne bouge pas, parce qu'une passe ne fait que fermer de
    l'alpha — elle ne déplace aucun pixel et ne touche pas aux couleurs.

    Ce que le test vérifie est exactement ça : après un détourage du fond
    extérieur, le pixel désigné porte encore la même couleur, donc la pipette
    vise encore la même chose.
    """
    from atelier.image.traitement import _detourer

    image = _anneau()
    apres = _detourer(image, Passe(moteur="bord", tolerance=28))

    assert bool((apres[:, :, :3] == image[:, :, :3]).all())
    assert apres[0, 0, 3] == 0  # le fond du dehors est bien parti…
    assert apres[7, 7, 3] == 255  # …et la poche visée est toujours là


# ── Ce que le port en fait ───────────────────────────────────────────────────
#
# Les essais ci-dessus vérifient la fonction ; ceux-ci vérifient qu'elle arrive
# jusqu'à l'écran et en revient. Ce sont les deux seules choses de la pipette
# qui traversent : le point, qui se range, et la couleur, qui se mesure.


def _asset_dessai(client, double) -> dict:
    double.rendre = lambda: image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _poser_une_pipette(client, identifiant: str, **reglages) -> dict:
    passe = {
        "moteur": "couleur",
        "tolerance": 28,
        "seuil_alpha": 128,
        "durcissement": 0,
        "point": [1, 1],
        "portee": "tache",
    }
    passe.update(reglages)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [passe],
            "recadrage": None,
            "grille": None,
            "quantification": None,
            "bords": None,
            "contours": None,
            "main": None,
            "nom": None,
        },
    )
    return reponse


def test_le_point_et_la_portee_traversent_le_port_et_reviennent(client, double):
    """Ce qui est posé se relit, mot pour mot — c'est ce qui rend la recette
    rejouable après un rechargement."""
    asset = _asset_dessai(client, double)
    reponse = _poser_une_pipette(client, asset["identifiant"], point=[5, 9],
                                 portee="partout")
    assert reponse.status_code == 200, reponse.text

    (passe,) = reponse.json()["recette"]["passes"]
    assert passe["moteur"] == "couleur"
    assert passe["point"] == [5, 9]
    assert passe["portee"] == "partout"


def test_la_couleur_visee_arrive_avec_les_mesures_et_pas_avec_la_recette(client, double):
    """**L'autre moitié de l'arbitrage.** Le point se range dans la recette ; la
    couleur qu'il y a dessous se lit à chaque fois, avec les mesures de la
    table. Une couleur écrite à côté du point serait une copie que plus rien ne
    met à jour — la même faute qu'un fichier « avant retouche » gardé sur le
    disque.
    """
    asset = _asset_dessai(client, double)
    pose = _poser_une_pipette(client, asset["identifiant"], point=[1, 1]).json()

    # Elle n'est pas dans la recette…
    assert "couleur" not in pose["recette"]["passes"][0]

    # …elle est dans les mesures, à la place de sa passe, et c'est un code
    # hexadécimal lisible tel quel par l'écran.
    mesures = client.get(f"/api/assets/{asset['identifiant']}/spots").json()
    (visee,) = mesures["visees"]
    assert isinstance(visee, str) and visee.startswith("#") and len(visee) == 7


def test_une_passe_qui_n_est_pas_une_pipette_n_a_pas_de_couleur_visee(client, double):
    """La liste suit les passes rang par rang, et vaut `None` là où il n'y a
    rien à viser. C'est ce qui permet à l'écran de lire `visees[rang]` sans
    tenir un second index de son côté."""
    asset = _asset_dessai(client, double)
    _poser_une_pipette(client, asset["identifiant"], moteur="bord")

    mesures = client.get(f"/api/assets/{asset['identifiant']}/spots").json()
    assert mesures["visees"] == [None]


def test_une_portee_inconnue_est_refusee_avec_sa_raison(client, double):
    """Le filet — pour un fichier retouché à la main ou une recette nommée
    devenue caduque. L'écran, lui, a déjà grisé."""
    asset = _asset_dessai(client, double)
    reponse = _poser_une_pipette(client, asset["identifiant"], portee="partout-ish")

    assert reponse.status_code == 409
    assert "portée inconnue" in reponse.text
