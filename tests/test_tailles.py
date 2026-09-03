# -*- coding: utf-8 -*-
"""Les critères de la tranche des tailles — rien ne pouvait être plus grand qu'un personnage.

**Ce que la tranche répare.** Le réglage d'échelle ne savait dire que *plus
petit* : chaque image revenait dans une case carrée du même côté, et l'échelle
disait quelle part de cette case le sujet remplit — un personnage 100 %, un
meuble 66 %, un objet tenu 40 %. Le plafond était donc le personnage, et il était
écrit **en douze endroits**. Un moulin, un arbre, une tour, une porte de ville :
le produit n'avait aucune façon de les demander. Le modèle était juste vers le
bas, et faux vers le haut, où il n'allait pas.

**Ce que les vrais jeux 2D font**, et c'est ce qui a dessiné la réparation
(`docs/bilan-v3.md` § 3) : le carré ne change **jamais** de taille. Ce qui change
entre un personnage et un bâtiment est le *nombre* de carrés qu'il couvre, jamais
leur dimension — deux tailles de pixel dans une même scène, des « mixels », se
voient immédiatement parce que l'œil compare les bords. La taille de tuile est
une propriété du jeu, pas de l'objet.

**Donc l'occupation reste, et c'est son plafond qui tombe.** Elle disait déjà la
bonne chose — une hauteur relative au personnage —, et 300 % se lit *trois
personnages*. Rien ne se convertit, aucun fichier ne se réécrit, et **tout ce qui
est en dessous de 100 % rend exactement l'image d'avant** : c'est le premier
critère de ce fichier, et le plus important.

**La forme du fichier est une décision, prise le 3 septembre 2026.** L'auteur :
*« choisis ce qui est le mieux et compatible avec godot »*. C'est une boîte
carrée dont le côté suit la hauteur déclarée — un moulin de trois personnages
revient en 192 carrés de côté. Trois raisons : un moteur la pose telle quelle,
son côté reste un multiple entier de la case du projet donc elle tombe aussi sur
une grille de tuiles, et surtout les images d'une même animation continuent de se
superposer au pixel. Un fichier taillé au ras du sujet aurait fait perdre cette
superposition, qui est très exactement le défaut que la tranche d'animation doit
réparer.

**Aucun test de ce fichier ne coûte un centime** : des tableaux NumPy, des
univers montés en mémoire, et le double de `conftest`.
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np

from atelier.domaine.projet import CIBLE_PAR_DEFAUT
from atelier.domaine.recette import (
    CANEVAS_MAX,
    OCCUPATION_MAX_ABSOLU,
    PERSONNAGES_MAX,
    Grille,
    cote_du_canevas,
    cote_du_sujet,
    occupation_max,
)
from atelier.image.taches import crans_occupation
from atelier.image.traitement import sur_grille
from atelier.services.calibrage import ServiceCalibrage

RACINE = Path(__file__).resolve().parents[1]
API = RACINE / "interface" / "src" / "api.ts"


def _sujet(large: int = 400, haut: int = 900) -> np.ndarray:
    """Un moulin vu de face : plus haut que large, sur fond transparent.

    Plus haut que large exprès — c'est le cas où la case carrée mord, et donc
    celui qui distingue une boîte qui grandit d'une boîte qui rogne.
    """
    rgba = np.zeros((haut, large, 4), dtype=np.uint8)
    rgba[haut // 18 : -haut // 18, large // 3 : -large // 3, :3] = (180, 140, 90)
    rgba[haut // 18 : -haut // 18, large // 3 : -large // 3, 3] = 255
    return rgba


def _haut_du_sujet(rgba: np.ndarray) -> int:
    """Combien de carrés le sujet occupe en hauteur dans l'image rendue."""
    return int((rgba[:, :, 3] > 0).any(axis=1).sum())


# ── « Sous le personnage, rien ne change » ────────────────────────────────────


def test_sous_le_personnage_l_image_est_celle_d_avant_la_tranche():
    """**Le critère qui compte le plus, et c'est celui d'une non-régression.**

    Le produit a des centaines d'images déjà traitées, et toutes les échelles du
    barème livré sont sous 100 % ou à 100 %. Si la tranche déplaçait un pixel de
    l'une d'elles, elle casserait tout ce qui est fait — et elle le ferait en
    silence, puisqu'une image retraitée ne se compare à rien.

    Le calcul d'avant était `min(100, occupation)` puis `min(cible, …)` : à 100 %
    et au-dessous, les deux bornes ne mordaient pas. Donc l'image doit être
    **identique au carré près**, et pas seulement de même taille.
    """
    rgba = _sujet()
    for occupation in (10, 40, 50, 66, 99, 100):
        grille = Grille(cible=64, occupation=occupation)
        rendu = sur_grille(rgba, grille, case=True)
        # La case reste celle du projet, quelle que soit la part remplie.
        assert rendu.shape[:2] == (64, 64), f"à {occupation} %"
        # Et le sujet occupe la hauteur que l'ancienne arithmétique donnait.
        avant = max(1, round(64 * occupation / 100))
        attendu = max(1, min(64, round(900 * (avant / 900))))
        assert _haut_du_sujet(rendu) == attendu, f"à {occupation} %"


def test_a_cent_pour_cent_les_deux_formules_se_rejoignent():
    """**Pas de marche à la frontière.** Le côté de la case est le plus grand de
    la cible et de la hauteur du sujet : à 100 % les deux valent la cible, donc un
    sujet passé de 99 à 101 % grandit d'un carré, pas d'une forme."""
    assert cote_du_canevas(64, 99) == 64
    assert cote_du_canevas(64, 100) == 64
    assert cote_du_canevas(64, 101) == 65
    assert cote_du_sujet(64, 100) == cote_du_canevas(64, 100)


# ── « Au-dessus du personnage, la boîte grandit » ─────────────────────────────


def test_un_moulin_de_trois_personnages_revient_trois_fois_plus_grand():
    """**Le critère de la tranche.** Sur une case de 64 carrés, 300 % rend une
    image de 192 carrés de côté, et le sujet la remplit — au lieu d'être rogné à
    64 comme l'ancien `min(cible, …)` le faisait."""
    rendu = sur_grille(_sujet(), Grille(cible=64, occupation=300), case=True)

    assert rendu.shape[:2] == (192, 192)
    assert _haut_du_sujet(rendu) == 192


def test_le_cote_de_l_image_reste_un_multiple_entier_de_la_case():
    """**C'est ce qui la rend posable sur une grille de tuiles.** Une hauteur
    ronde en personnages donne un côté rond en cases : deux personnages font deux
    cases, trois en font trois. Un fichier taillé au ras du sujet n'aurait pas
    cette propriété, et c'est l'une des trois raisons de la boîte carrée."""
    for personnages in (2, 3, 4, 8):
        cote = cote_du_canevas(64, 100 * personnages)
        assert cote == 64 * personnages
        assert cote % 64 == 0


def test_la_transparence_du_dessus_reste_de_la_transparence():
    """Une boîte qui grandit ne doit pas se remplir de noir opaque : au-delà de la
    hauteur du sujet, l'image est vide, et c'est ce que l'export attend."""
    rendu = sur_grille(
        # Un sujet large et bas dans une grande case : il reste de la place.
        _sujet(large=900, haut=300),
        Grille(cible=64, occupation=300),
        case=True,
    )

    assert rendu.shape[:2] == (192, 192)
    # Le sujet ne fait pas toute la hauteur — donc il reste du vide, et il est
    # bien vide.
    assert _haut_du_sujet(rendu) < 192
    assert rendu[0, :, 3].max() == 0


# ── « Le plafond vient de deux bornes, et chacune a sa raison » ───────────────


def test_le_plafond_est_le_plus_bas_du_metier_et_de_la_machine():
    """**Deux bornes, et aucune ne remplace l'autre.**

    Celle du métier — huit personnages — parce qu'au-delà on ne fabrique plus un
    sujet mais un fond, et un fond est un décor qui ignore la case. Celle de la
    machine — un canevas de `CANEVAS_MAX` carrés — parce qu'une image a une
    taille. Sur une petite case c'est le métier qui borne, sur une grande c'est le
    canevas.
    """
    # Le métier borne : 2048 / 16 vaudrait 12 800 %, soit cent vingt-huit
    # personnages. Physiquement possible, jamais utile.
    assert occupation_max(16) == 100 * PERSONNAGES_MAX
    assert occupation_max(64) == 100 * PERSONNAGES_MAX
    # Et c'est le cas d'un projet neuf, donc celui que l'auteur rencontre.
    assert occupation_max(CIBLE_PAR_DEFAUT) == 100 * PERSONNAGES_MAX
    # Le canevas borne : huit personnages de 512 carrés feraient 4 096.
    assert occupation_max(512) == 400
    assert cote_du_canevas(512, occupation_max(512)) == CANEVAS_MAX
    # Et une case déjà au maximum ne grandit plus du tout.
    assert occupation_max(CANEVAS_MAX) == 100


def test_la_borne_des_corps_de_route_est_large_et_le_service_est_l_autorite():
    """Un corps de route ne connaît pas toujours la cible — celui du barème ne la
    porte pas —, donc il ne peut pas juger le vrai plafond. Il écarte ce qui n'a
    aucun sens ; le service, qui connaît la case, refuse au chiffre exact."""
    assert OCCUPATION_MAX_ABSOLU == 100 * PERSONNAGES_MAX
    # Elle est au moins aussi large que n'importe quel plafond réel, sans quoi la
    # route refuserait ce que le service accepte.
    for cible in (8, 16, 32, 64, 128, 256, 512, 1024, 2048):
        assert occupation_max(cible) <= OCCUPATION_MAX_ABSOLU


# ── « Le curseur reste utilisable » ───────────────────────────────────────────


def test_le_curseur_garde_moins_de_crans_que_de_positions_offertes():
    """**C'est la propriété qui rend la mesure utile, et le plafond du métier la
    protège.**

    Sans la borne des huit personnages, une case de 16 carrés autorisait 12 800 %
    et le curseur y gagnait **plus de deux mille positions** — de quoi rendre
    inutilisable le réglage qu'on venait d'ouvrir. C'est ce qu'a montré l'essai du
    curseur, en échouant : une cible plus fine rendait moins de crans qu'une
    grossière, l'inverse de ce qu'il affirme depuis E3.
    """
    image = np.zeros((16, 16, 4), dtype=np.uint8)
    image[4:12, 4:12, 3] = 255

    for cible in (16, 64, 128):
        crans = crans_occupation(image, Grille(cible=cible))
        offerts = occupation_max(cible) - 10 + 1
        assert 0 < len(crans) <= offerts, f"cible {cible}"
        # Chaque cran donne une taille que le précédent ne donnait pas.
        tailles = [cote_du_sujet(cible, c) for c in crans]
        assert len(tailles) == len(set(tailles)), f"cible {cible}"

    # **Le tri ne mord que sous cent carrés**, et c'est arithmétique : à partir de
    # 100, un pour cent de plus déplace le sujet d'au moins un carré, donc aucune
    # position n'en double une autre et la liste est celle du curseur. C'est
    # l'essai qui l'a appris — une première version l'exigeait partout, et 128
    # rendait exactement ses 791 positions.
    for cible in (16, 64):
        assert len(crans_occupation(image, Grille(cible=cible))) < (
            occupation_max(cible) - 10 + 1
        ), f"cible {cible}"
    assert len(crans_occupation(image, Grille(cible=128))) == occupation_max(128) - 10 + 1

    # Et la propriété d'E3 tient de nouveau : plus la case est fine, plus il y a
    # de tailles distinctes à offrir.
    assert len(crans_occupation(image, Grille(cible=128))) > len(
        crans_occupation(image, Grille(cible=16))
    )


# ── « Le calibrage aligne, il ne redimensionne pas » ─────────────────────────


def test_le_calibrage_d_un_personnage_ordinaire_ne_bouge_pas_d_un_carre():
    """**Défaut trouvé par un essai d'E17, et il valait le détour.**

    L'inverse d'un arrondi dépasse volontiers d'un pour cent : la pose d'attaque
    du vrai projet — 523 × 430 dans une case de 64 — rend sa hauteur commune à
    100,7 %. La borne de 100 % que la tranche venait de lever était donc
    *porteuse* : sans elle, le calibrage d'un personnage ordinaire écrivait 101 %,
    et ses images sortaient en **65 carrés au lieu de 64**. Un demi-pixel
    d'arrondi faisait sortir tout le monde de la case.
    """
    assert ServiceCalibrage._plafond(523, 430, 64) == 53
    assert ServiceCalibrage._rendue(523, 430, 64, 100) == 53
    assert ServiceCalibrage._occupation(523, 430, 64, 53) == 100


def test_le_calibrage_d_un_geant_garde_l_echelle_qu_il_a_declaree():
    """Depuis que l'occupation peut passer 100 %, un géant à 300 % a des poses qui
    rendent trois fois la case. Un plafond calculé à 100 % proposerait de toutes
    les rapetisser : l'outil censé les accorder leur ferait perdre l'échelle que
    l'auteur a posée. Le plafond suit donc la plus haute occupation en usage."""
    # À l'échelle d'un personnage, cette pose plafonne à 53 carrés…
    assert ServiceCalibrage._plafond(523, 430, 64, 100) == 53
    # …et à celle d'un géant de trois personnages, à trois fois plus.
    assert ServiceCalibrage._plafond(523, 430, 64, 300) == 158
    # L'inverse suit la même échelle : rendre 158 carrés demande 300 %, et la
    # borne ne le ramène pas à 100.
    assert ServiceCalibrage._occupation(523, 430, 64, 158, 300) == 300


# ── « Le barème accepte enfin un bâtiment » ───────────────────────────────────


def test_le_bareme_accepte_un_type_plus_haut_qu_un_personnage(client):
    """**C'est ici que la fermeture coûtait le plus cher** : le barème est
    l'endroit même où l'on dit qu'un moulin est plus haut qu'un personnage, et il
    refusait de l'entendre avec un message qui nommait la borne."""
    bareme = client.get("/api/universe").json()["univers"]["bareme"]
    envoye = [
        {
            "nom": e["nom"],
            "famille": e["famille"],
            "occupation": 300 if e["nom"] == "décor" else e["occupation"],
            "silhouette": e["silhouette"],
        }
        for e in bareme
    ]

    assert client.put("/api/universe", json={"bareme": envoye}).status_code == 200

    relu = client.get("/api/universe").json()["univers"]["bareme"]
    assert next(e["occupation"] for e in relu if e["nom"] == "décor") == 300


def _bareme_avec(client, occupation: int) -> dict:
    """Le barème du projet, avec cette hauteur-là posée sur le décor."""
    bareme = client.get("/api/universe").json()["univers"]["bareme"]
    return {
        "bareme": [
            {
                "nom": e["nom"],
                "famille": e["famille"],
                "occupation": occupation if e["nom"] == "décor" else e["occupation"],
                "silhouette": e["silhouette"],
            }
            for e in bareme
        ]
    }


def test_le_bareme_refuse_au_dela_du_plafond_et_dit_lequel(client):
    """**La borne dépend de la case, donc le refus la dit avec sa cible** — sans
    quoi il serait faux un projet sur deux : huit personnages tiennent sur une
    case de 64 carrés, quatre seulement sur une de 512.

    Et cet essai vérifie **la répartition du travail**, qui est le fond de la
    décision : le corps de route écarte l'absurde d'un coup, sans connaître la
    case ; le service, qui la connaît, refuse au chiffre exact. Il fallait donc
    une grande case pour voir le second refus — l'essai a commencé par envoyer
    801 sur une case de 64, et c'est la route qui l'a arrêté.
    """
    # Une case de 512 : le canevas borne à 400 %, bien en dessous du plafond du
    # métier — donc 500 passe la route et c'est le service qui doit trancher.
    assert client.put("/api/universe", json={"cible_px": 512}).status_code == 200
    assert occupation_max(512) == 400

    reponse = client.put("/api/universe", json=_bareme_avec(client, 500))
    assert reponse.status_code == 409
    raison = str(reponse.json()["raison"])
    assert "400" in raison, raison
    assert "décor" in raison, raison


def test_la_route_ecarte_l_absurde_sans_connaitre_la_case(client):
    """L'autre moitié de la même décision : au-delà de huit personnages, aucune
    case ne peut porter la demande, et le corps de route n'a pas besoin de savoir
    laquelle est ouverte pour le dire."""
    trop = OCCUPATION_MAX_ABSOLU + 1

    assert client.put("/api/universe", json=_bareme_avec(client, trop)).status_code == 422
    # Et il n'a rien écrit en passant.
    relu = client.get("/api/universe").json()["univers"]["bareme"]
    assert all(e["occupation"] <= OCCUPATION_MAX_ABSOLU for e in relu)


# ── « L'écran et le serveur comptent pareil » ─────────────────────────────────


def test_les_deux_bornes_sont_les_memes_des_deux_cotes():
    """L'écran dessine l'échantillon **avant** d'avoir posé quoi que ce soit —
    donc avant d'avoir une réponse du serveur —, et il doit donc savoir compter
    seul. Deux tables qui divergeraient feraient un curseur qui propose ce que le
    service refuse : c'est la panne que D2 a fermée sur les paliers de couleurs,
    et elle se referme ici de la même façon."""
    source = API.read_text(encoding="utf-8")

    for nom, valeur in (("CANEVAS_MAX", CANEVAS_MAX), ("PERSONNAGES_MAX", PERSONNAGES_MAX)):
        ecrit = re.search(rf"export const {nom} = (\d+)", source)
        assert ecrit is not None, f"{nom} a quitté api.ts"
        assert int(ecrit.group(1)) == valeur, nom


def test_l_arrondi_des_deux_cotes_tombe_sur_le_meme_carre():
    """**Deux langages, deux arrondis.** Python arrondit un demi au pair le plus
    proche, JavaScript arrondit un demi vers le haut. Les deux ne peuvent
    diverger que si `cible × occupation` finit par 50 — impossible ici, puisque
    toutes les cases du produit sont des multiples de huit, donc de quatre, et que
    50 n'est pas un multiple de quatre. Cet essai le vérifie plutôt que de
    l'affirmer : le jour où une case impaire entrerait, il tomberait."""
    from atelier.domaine.vue import FINESSES, TAILLES

    for cible, _ in (*TAILLES, *FINESSES):
        for occupation in range(1, occupation_max(cible) + 1):
            produit = cible * occupation
            assert produit % 100 != 50, (cible, occupation)
