# -*- coding: utf-8 -*-
"""Les critères d'acceptation de D2 — la réduction qui ne bave plus, et les couleurs.

**Ce que cette moitié de la tranche livre.** Deux choses, tranchées par l'auteur
le 3 septembre 2026 après un banc visuel sur ses propres illustrations
(`essais/essai_pixelisation_complet.py`) :

1. **La réduction devient un choix**, entre quatre méthodes, au projet et sur
   chaque image. Ses mots : *« clairement les 4 ont des rendus différents avec
   leurs avantages et inconvénients et peuvent influencer le style souhaité par
   le créateur »*, et le défaut est le vote en deux temps.
2. **Les couleurs se réduisent enfin sans artwork.** Six paliers — 8, 16, 32,
   64, 128, 256 — plafonnés par le côté du sprite.

**Le défaut que la seconde répare, et il était silencieux.** La quantification
n'entrait que s'il existait une palette, et la palette se déduit des artworks
officiels. Un projet sans artwork ne réduisait donc **aucune** couleur : mesuré
le 3 septembre, un pèlerin ramené à 64 carrés sortait à 905 couleurs. Le réglage
`Univers.couleurs` existait depuis T4 et ne faisait rien. Trois tests d'avant
figeaient cette règle ; ils ont été réécrits à l'envers, en disant pourquoi
(`tests/test_t2.py`, `tests/test_t4.py`).

**Le plafond des couleurs est mesuré, pas décrété.** Sur les deux illustrations
de l'auteur, le sujet occupe environ 27 % de la toile à toutes les tailles, et
au-delà du côté du sprite l'image ne contient plus assez de teintes distinctes
pour remplir la palette demandée : 32 carrés rendent 30 couleurs quand on en
demande 32, et 229 quand on en demande 256.

**Aucun test de ce fichier ne coûte un centime** : tout se joue sur le double de
`conftest`, sur des univers montés en mémoire, et sur des tableaux NumPy.
"""

from __future__ import annotations

import io
import re
import time
from pathlib import Path

import numpy as np
from PIL import Image

from atelier.domaine.projet import (
    AUCUNE_CIBLE,
    CIBLE_PAR_DEFAUT,
    DESSIN,
    PIXEL_ART,
    Univers,
    cible_du_changement,
    cibles_du_style,
)
from atelier.domaine.vue import FINESSE_PAR_DEFAUT, FINESSES, TAILLES
from atelier.domaine.recette import (
    AU_PLUS_PROCHE,
    LANCZOS,
    METHODE_LIVREE,
    METHODES_DE_REDUCTION,
    NOM_DE_LA_METHODE,
    PALIERS_DE_COULEURS,
    PIXELOE,
    VOTE,
    Grille,
    methode_connue,
    paliers_de_couleurs,
)
from atelier.image.pliage import mesurer_lot
from atelier.image.traitement import (
    IMAGE_TROP_PETITE,
    IMAGE_UNIE,
    NETTETE_MINIMALE,
    PAS_MAXIMAL,
    PEIGNE_MINIMAL,
    SANS_GRILLE,
    mesurer_grille,
    raison_methode,
    retrouver_grille,
    sur_grille,
)

RACINE = Path(__file__).resolve().parents[1]
API = RACINE / "interface" / "src" / "api.ts"


def _sujet(cote: int = 256) -> np.ndarray:
    """Un dégradé traversé de traits d'un pixel — de quoi voir une réduction.

    Le dégradé porte les nuances qu'une moyenne conserve et qu'un tirage au sort
    perd ; les traits fins portent la structure que seule une méthode attentive
    fait survivre. Une image unie ne départagerait rien.
    """
    y, x = np.mgrid[0:cote, 0:cote]
    rgb = np.dstack(
        [(x * 255 // cote), (y * 255 // cote), ((x + y) * 127 // cote)]
    ).astype(np.uint8)
    rgb[:, ::16] = 255  # des traits verticaux d'un pixel de large
    return np.dstack([rgb, np.full((cote, cote), 255, np.uint8)])


def _regler(client, **corps):
    reponse = client.put("/api/universe", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["univers"]


#: Le modèle du double de `conftest`. Il ne facture rien et ne sort pas de la
#: machine — c'est celui que tous les essais de génération emploient.
MODELE_DOUBLE = "essai:rend-du-png"


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


# ── Les quatre méthodes existent, et chacune réduit vraiment ─────────────────


def test_les_quatre_methodes_reduisent_a_la_taille_demandee():
    """**Quatre méthodes vivantes, pas une bonne et trois reliques.**

    Le critère est double : chacune rend la taille demandée — sans quoi la case
    ne tiendrait plus —, et chacune rend une image *différente* des autres. Deux
    méthodes qui rendraient le même tableau seraient un choix pour rien.
    """
    sujet = _sujet()
    rendus = {}
    for methode in METHODES_DE_REDUCTION:
        if raison_methode(methode) is not None:
            continue  # une méthode non installée est grisée, pas en panne
        rendu = sur_grille(sujet, Grille(cible=32, methode=methode), case=False)
        assert rendu.shape == (32, 32, 4), f"« {methode} » n'a pas rendu la taille"
        rendus[methode] = rendu

    assert len(rendus) >= 3, "trois méthodes au moins ne demandent rien"
    for methode, rendu in rendus.items():
        autres = [a for n, a in rendus.items() if n != methode]
        assert any(
            not np.array_equal(rendu, autre) for autre in autres
        ), f"« {methode} » rend la même chose qu'une autre : le choix serait vide"


def test_chaque_methode_porte_un_nom_lisible():
    """Un réglage que l'écran doit montrer a un libellé, et il vient d'ici.

    Deux listes pour un fait finissent toujours par diverger : c'est la règle
    déjà écrite pour les moteurs de détourage (`NOM_DU_MOTEUR`).
    """
    assert set(NOM_DE_LA_METHODE) == set(METHODES_DE_REDUCTION)
    assert all(NOM_DE_LA_METHODE[m].strip() for m in METHODES_DE_REDUCTION)


def test_le_nom_des_methodes_est_le_meme_des_deux_cotes():
    """**Deux listes pour un fait finissent toujours par diverger** — la leçon
    des sept crans contre neuf (E8), déjà appliquée aux moteurs en D1.

    L'écran double la table du serveur pour une raison qui tient : ce que le
    serveur envoie dans `traitement.reductions` ne porte que les méthodes de
    *cette* machine, ce qui suffit à choisir mais pas à **relire** une recette
    qui en nomme une autre. L'essai lit la source de l'écran plutôt que de
    recopier les quatre noms : une troisième copie serait la panne qu'on ferme.
    """
    ecrit = re.search(
        r"export const NOM_DE_LA_METHODE: Record<Methode, string> = \{([^}]*)\}",
        API.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, "NOM_DE_LA_METHODE a quitté api.ts"

    lus = dict(re.findall(r'(\w+): "([^"]*)"', ecrit.group(1)))
    assert lus == NOM_DE_LA_METHODE


def test_les_paliers_de_couleurs_sont_les_memes_des_deux_cotes():
    """L'écran fabrique la liste des paliers pour la montrer ; le serveur la
    borne pour la faire respecter. Deux tables qui divergeraient feraient un
    écran qui propose ce que le serveur refuse."""
    ecrit = re.search(
        r"export const PALIERS_DE_COULEURS = \[([^\]]*)\]",
        API.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, "PALIERS_DE_COULEURS a quitté api.ts"

    lus = tuple(int(n) for n in re.findall(r"\d+", ecrit.group(1)))
    assert lus == PALIERS_DE_COULEURS


def test_la_methode_absente_est_grisee_avec_sa_raison_jamais_en_panne():
    """**Trois méthodes ne demandent rien ; la quatrième peut manquer.**

    PixelOE tire `torch` derrière lui — mesuré le 3 septembre, y compris par son
    chemin dit « léger ». Il suit donc le régime du moteur par modèle : cherché
    sans être importé, grisé avec sa raison, jamais proposé puis refusé.
    """
    for methode in (VOTE, LANCZOS, AU_PLUS_PROCHE):
        assert raison_methode(methode) is None

    raison = raison_methode("une-methode-qui-n-existe-pas")
    assert raison is not None and "inconnue" in raison

    # Présent ou absent, la réponse est une phrase ou rien — jamais une panne.
    assert raison_methode(PIXELOE) is None or "installée" in raison_methode(PIXELOE)


def test_chercher_la_methode_ne_charge_jamais_le_moteur_lourd():
    """L'invariant du module : « le post-traitement ne touche jamais le GPU ».

    Il se **prouve** en regardant `sys.modules` (`tests/test_t2.py`), et c'est
    pour ça que la disponibilité se lit avec `find_spec` : `import pixeloe`
    chargerait `torch` pour la seule question « faut-il griser ce bouton ? ».
    """
    import sys

    for methode in METHODES_DE_REDUCTION:
        raison_methode(methode)
    assert "torch" not in sys.modules, "chercher la méthode a chargé le moteur lourd"


# ── Une recette d'avant D2 rend exactement la même image ─────────────────────


def test_une_recette_d_avant_la_tranche_garde_sa_reduction_au_pixel_pres():
    """**Le champ retombe sur ce que l'atelier faisait**, pas sur le nouveau défaut.

    C'est la règle de D1 reprise telle quelle : le défaut du *champ* et le
    défaut du *produit* sont deux choses. Une recette enregistrée avant D2 n'a
    pas de méthode dans son JSON ; lui donner le vote en deux temps rendrait une
    autre image que celle que l'auteur a validée.
    """
    assert Grille.depuis_json({"cible": 64}).methode == AU_PLUS_PROCHE
    assert METHODE_LIVREE != AU_PLUS_PROCHE, "sans quoi ce test ne prouve rien"

    sujet = _sujet()
    ancienne = sur_grille(sujet, Grille.depuis_json({"cible": 32}), case=False)
    telle_quelle = np.asarray(
        Image.fromarray(sujet, mode="RGBA").resize((32, 32), Image.Resampling.NEAREST)
    )
    assert np.array_equal(ancienne, telle_quelle)


def test_un_nom_de_methode_inconnu_s_ouvre_au_lieu_de_lever():
    """Un fichier écrit par une version plus récente doit continuer de s'ouvrir.

    Même règle que `durcissement_livre` pour un moteur inconnu : le domaine ne
    lève pas, il retombe sur la valeur qui ne surprend personne.
    """
    assert methode_connue("brouette") == AU_PLUS_PROCHE
    assert methode_connue(None) == AU_PLUS_PROCHE
    assert methode_connue(VOTE) == VOTE
    assert Grille.depuis_json({"methode": "brouette"}).methode == AU_PLUS_PROCHE


def test_la_methode_fait_l_aller_retour_par_le_json():
    grille = Grille(cible=48, methode=VOTE)
    assert Grille.depuis_json(grille.en_json()) == grille


# ── Les paliers de couleurs, plafonnés par la taille ─────────────────────────


def test_les_paliers_sont_plafonnes_par_le_cote_du_sprite():
    """*« On ne peut pas avoir du 128 couleurs sur du 32px »* — l'auteur, 3 sept.

    Le plafond est le côté du sprite, et il est mesuré : au-delà, l'image ne
    contient plus assez de teintes distinctes pour remplir la palette demandée.
    """
    assert paliers_de_couleurs(32) == (8, 16, 32)
    assert paliers_de_couleurs(64) == (8, 16, 32, 64)
    assert paliers_de_couleurs(128) == (8, 16, 32, 64, 128)
    assert paliers_de_couleurs(256) == PALIERS_DE_COULEURS
    assert 128 not in paliers_de_couleurs(32), "l'exemple de l'auteur, mot pour mot"


def test_la_liste_des_paliers_n_est_jamais_vide():
    """Un écran qui ne propose rien laisse l'auteur devant une liste morte, sans
    savoir si c'est un bug ou une règle."""
    assert paliers_de_couleurs(0) == (8,)
    assert paliers_de_couleurs(4) == (8,)


def test_le_nombre_de_couleurs_se_borne_au_lieu_de_lever():
    """**Borné à l'usage, gardé dans le fichier.**

    Une taille peut changer après que le nombre de couleurs a été posé : passer
    un projet de 128 à 32 carrés ne doit pas rendre son univers illisible.
    """
    univers = Univers(cible_px=32, couleurs=128)
    assert univers.couleurs_tenues() == 32
    assert univers.couleurs == 128, "le réglage garde sa valeur dans le fichier"
    assert Univers(cible_px=256, couleurs=128).couleurs_tenues() == 128


# ── Le défaut du projet descend dans les recettes neuves ─────────────────────


def test_un_projet_neuf_reduit_par_le_vote_en_deux_temps():
    """Le défaut tranché par l'auteur : *« par défaut tu mets Vote en deux temps »*."""
    univers = Univers()
    assert univers.methode_pixels == VOTE
    assert univers.recette_de(None).grille.methode == VOTE


def test_un_univers_d_avant_la_tranche_ne_change_pas_de_methode_tout_seul():
    """**Absent veut dire « au plus proche ».**

    Un univers écrit avant D2 n'a jamais choisi de méthode ; lui en inventer une
    changerait ses prochaines images sans qu'il l'ait demandé.
    """
    ancien = Univers.depuis_json({"cible_px": 64})
    assert ancien.methode_pixels == AU_PLUS_PROCHE
    assert ancien.recette_de(None).grille.methode == AU_PLUS_PROCHE


def test_le_reglage_du_projet_fait_l_aller_retour_par_le_json():
    univers = Univers(methode_pixels=VOTE)
    assert Univers.depuis_json(univers.en_json()).methode_pixels == VOTE


# ── La quantification a lieu sans artwork ────────────────────────────────────


def test_un_projet_sans_artwork_reduit_quand_meme_ses_couleurs():
    """**Le défaut que la tranche répare, et il était silencieux.**

    Sans artwork il n'y a pas de palette imposée — mais il y a un nombre de
    couleurs, et le réduire est exactement ce qui distingue un sprite d'une
    image rétrécie.
    """
    univers = Univers()
    assert univers.palette == (), "aucun artwork : aucune palette, c'est le cas mesuré"

    quantification = univers.recette_de(None).quantification
    assert quantification is not None, "c'est l'étape qui ne s'exécutait jamais"
    assert quantification.palette == ()
    assert quantification.couleurs == univers.couleurs_tenues()


def test_sans_taille_imposee_les_couleurs_ne_sont_pas_touchees():
    """**Ce qui commande la quantification est la cible**, c'est-à-dire le fait
    même de faire du pixel art.

    Sans taille imposée, le projet a déclaré ne pas contraindre l'échelle
    (`AUCUNE_CIBLE`) : réduire les couleurs d'un dessin le transformerait en
    affiche sérigraphiée.
    """
    dessin = Univers(cible_px=AUCUNE_CIBLE)
    recette = dessin.recette_de(None)
    assert recette.grille is None
    assert recette.quantification is None


def test_la_palette_du_projet_s_impose_des_qu_elle_existe():
    """La palette reste facultative : présente elle s'impose, absente les
    couleurs se déduisent de l'image."""
    peuple = Univers(palette=("#112233", "#445566"))
    quantification = peuple.recette_de(None).quantification
    assert quantification.palette == ("#112233", "#445566")


# ── Le style graphique, et ce qu'il commande ─────────────────────────────────


def test_un_projet_neuf_est_en_pixel_art():
    """« Le pixel art est le défaut, plus une limite » (`docs/ARCHITECTURE.md`)."""
    assert Univers().style == PIXEL_ART


def test_le_style_se_deduit_des_univers_ecrits_avant_qu_il_existe():
    """**Il ne s'invente pas, il se lit** — et c'est ce qui reprend les projets
    d'avant sans leur changer une image.

    Jusqu'à D2, dire « aucune taille de pixel » *était* dire « ce jeu n'est pas
    en pixel art » : le libellé de la neuvième valeur le disait mot pour mot à
    l'écran. Toute autre valeur par défaut ferait mentir un fichier sur ce que
    son auteur avait choisi.
    """
    assert Univers.depuis_json({"cible_px": 64}).style == PIXEL_ART
    assert Univers.depuis_json({"cible_px": AUCUNE_CIBLE}).style == DESSIN
    # Écrit après D2 : la clé fait foi, la déduction ne s'en mêle plus.
    assert Univers.depuis_json({"cible_px": 0, "style": PIXEL_ART}).style == PIXEL_ART
    assert Univers.depuis_json({"style": "brouette"}).style == PIXEL_ART


def test_un_jeu_en_dessin_n_envoie_pas_la_phrase_du_pixel_art():
    """**Le défaut n'était pas atteignable avant que le style existe.**

    « Aucune taille » était la seule façon de déclarer qu'un jeu n'est pas en
    pixel art, et elle vidait les deux phrases par le même geste. Un jeu en
    dessin qui impose une finesse de 1024 aurait envoyé *2D pixel art on a
    1024x1024 grid* — le contraire mot pour mot de ce que l'auteur a choisi, sur
    la case qui décide de l'allure.
    """
    dessin = Univers(style=DESSIN, cible_px=1024)
    assert dessin.phrase_du_produit("rendu") == ""
    assert dessin.phrase_du_produit("technique") == ""

    pixel = Univers(style=PIXEL_ART, cible_px=64)
    assert "pixel art" in pixel.phrase_du_produit("rendu")
    assert "64x64" in pixel.phrase_du_produit("rendu")


def test_un_jeu_en_dessin_garde_ses_couleurs_mais_pas_sa_taille():
    """**Le style commande la quantification, la taille commande la grille.**

    Réduire les couleurs d'un dessin le transformerait en affiche sérigraphiée ;
    réduire sa finesse est en revanche une opération propre, et c'est justement
    ce qu'un jeu en dessin demande.
    """
    recette = Univers(style=DESSIN, cible_px=1024).recette_de(None)
    assert recette.quantification is None, "un dessin garde ses nuances"
    assert recette.grille is not None and recette.grille.cible == 1024


def test_les_deux_styles_ne_proposent_pas_les_memes_tailles():
    """8 carrés n'a pas plus de sens pour un dessin que 2048 n'en a pour du
    pixel art. « Aucune » est dans les deux : c'est *ne pas contraindre
    l'échelle*, un état légitime des deux côtés (US-163)."""
    pixel, dessin = cibles_du_style(PIXEL_ART), cibles_du_style(DESSIN)

    assert AUCUNE_CIBLE in pixel and AUCUNE_CIBLE in dessin
    assert 8 in pixel and 8 not in dessin
    assert 2048 in dessin and 2048 not in pixel
    # **512 est entré en pixel art le 3 septembre**, à la demande de l'auteur :
    # *« il faut ajouter le 256 et 512 pour le pixel art haute résolution »*.
    assert 256 in pixel and 512 in pixel


def test_changer_de_style_deplace_la_taille_quand_elle_n_a_plus_de_sens():
    """*« Si je décide de changer de style sur mon jeu cœur de pierre pour le
    faire en dessin »* — l'auteur, 3 septembre 2026.

    Un jeu à 64 carrés qui passe en dessin garderait une finesse de 64,
    c'est-à-dire une vignette de la taille d'une icône, là où l'auteur croit
    n'avoir changé que le style.
    """
    assert cible_du_changement(DESSIN, 64) == FINESSE_PAR_DEFAUT
    assert cible_du_changement(PIXEL_ART, 2048) == CIBLE_PAR_DEFAUT
    # Ce que le nouveau style sait porter ne bouge pas — 512 vaut dans les deux.
    assert cible_du_changement(DESSIN, 512) == 512
    assert cible_du_changement(PIXEL_ART, 512) == 512
    # Et « aucune » traverse : elle est légitime des deux côtés.
    assert cible_du_changement(DESSIN, AUCUNE_CIBLE) == AUCUNE_CIBLE


# ── Le tour complet par les routes ───────────────────────────────────────────


def test_le_projet_regle_sa_methode_et_la_relit(client):
    univers = _regler(client, methode_pixels=LANCZOS)
    assert univers["methode_pixels"] == LANCZOS
    assert client.get("/api/universe").json()["univers"]["methode_pixels"] == LANCZOS


def test_le_projet_change_de_style_et_sa_taille_suit(client):
    """**Le tour complet du changement de style**, par la route.

    Le nouvel univers repart dans la réponse : l'écran montre donc tout de suite
    la taille qui s'applique, au lieu d'en garder une qui n'a plus de sens.
    """
    depart = _regler(client, cible_px=64)
    assert depart["style"] == PIXEL_ART and depart["cible_px"] == 64

    bascule = _regler(client, style=DESSIN)
    assert bascule["style"] == DESSIN
    assert bascule["cible_px"] == FINESSE_PAR_DEFAUT, "64 n'est pas une finesse"

    # Et le style dit dans le même message que la taille ne l'écrase pas : c'est
    # l'auteur qui a nommé les deux, il sait ce qu'il veut.
    ensemble = _regler(client, style=PIXEL_ART, cible_px=32)
    assert (ensemble["style"], ensemble["cible_px"]) == (PIXEL_ART, 32)


def test_la_facon_de_reduire_suit_le_style_sans_ecraser_un_choix(client):
    """**On ne réécrit que ce que personne n'a choisi** — la règle de D1.

    Le vote en deux temps donne le sprite qu'on veut en pixel art et posterise
    un dessin ; la réduction douce fait l'inverse. Le défaut suit donc le style.
    Mais une méthode déplacée à la main est un choix, et un choix ne se réécrit
    pas — sans quoi l'auteur reposerait le même réglage à chaque bascule.
    """
    depart = _regler(client, cible_px=64)
    assert depart["methode_pixels"] == VOTE, "le défaut du pixel art"

    bascule = _regler(client, style=DESSIN)
    assert bascule["methode_pixels"] == LANCZOS, "le défaut du dessin"

    retour = _regler(client, style=PIXEL_ART)
    assert retour["methode_pixels"] == VOTE

    # Un choix posé à la main traverse la bascule sans être touché.
    choisi = _regler(client, methode_pixels=AU_PLUS_PROCHE)
    assert choisi["methode_pixels"] == AU_PLUS_PROCHE
    apres = _regler(client, style=DESSIN)
    assert apres["methode_pixels"] == AU_PLUS_PROCHE, "un choix ne se réécrit pas"


def test_un_style_inconnu_est_refuse_en_le_nommant(client):
    refus = client.put("/api/universe", json={"style": "aquarelle"})
    assert refus.status_code == 409, refus.text
    assert "aquarelle" in refus.json()["raison"]


def test_les_deux_listes_de_tailles_sont_servies_par_le_serveur(client):
    """Deux listes fermées, servies et non écrites à l'écran — la règle d'E8,
    étendue aux finesses."""
    recu = client.get("/api/universe/views").json()

    assert [t["cible"] for t in recu["tailles"]] == [c for c, _ in TAILLES]
    assert [f["cible"] for f in recu["finesses"]] == [c for c, _ in FINESSES]
    assert all(t["quoi"].strip() for t in recu["tailles"] + recu["finesses"])


def test_une_methode_inconnue_est_refusee_en_la_nommant(client):
    """Refusée en nommant le réglage fautif, jamais ramenée en silence vers la
    valeur la plus proche — la règle des bornes de `services/assets.py`."""
    refus = client.put("/api/universe", json={"methode_pixels": "brouette"})
    assert refus.status_code == 409, refus.text
    assert "brouette" in refus.json()["raison"]


def test_la_methode_se_change_image_par_image_sans_toucher_au_projet(client, double):
    """*« Je veux qu'on puisse choisir entre les 4 et changer en cours de route
    dans l'atelier »* — l'auteur, 3 septembre.

    Deux niveaux, comme le détourage par défaut : le projet donne le départ,
    l'image garde le dernier mot, et régler l'une ne bouge pas l'autre.
    """
    lancee = client.post(
        "/api/generations",
        json={"modele": MODELE_DOUBLE, "prompt": "un tonneau", "echelle": "personnage"},
    )
    assert lancee.status_code == 202, lancee.text
    generation = _attendre(client, lancee.json()["identifiant"])

    identifiant = f"{generation['identifiant']}-0"
    asset = client.get(f"/api/assets/{identifiant}").json()
    assert asset["recette"]["grille"]["methode"] == VOTE, "le projet a donné le départ"

    recette = {
        **asset["recette"],
        "grille": {**asset["recette"]["grille"], "methode": LANCZOS},
    }
    pose = client.put(f"/api/assets/{identifiant}/recipe", json=recette)
    assert pose.status_code == 200, pose.text
    assert pose.json()["recette"]["grille"]["methode"] == LANCZOS

    # Le projet n'a pas bougé : une image réglée à la main est un cas, pas une
    # nouvelle règle.
    assert client.get("/api/universe").json()["univers"]["methode_pixels"] == VOTE


# ════════════════════════════════════════════════════════════════════════════
#  La seconde moitié de D2 — retrouver le pas d'une image qui porte une grille
# ════════════════════════════════════════════════════════════════════════════
#
# **La tranche s'est coupée en deux, et voici la seconde.** La première a livré
# le choix de la réduction et les couleurs sans artwork ; celle-ci livre la
# question d'origine : *le modèle a-t-il peint sur une grille, et laquelle ?*
#
# **Deux bancs gratuits l'ont préparée**, et rien ici ne les refait :
# `essais/essai_grille_retrouvee.py` a comparé quatre détecteurs et tranché la
# méthode ; `essais/essai_grille_produit.py` mesure le détecteur **livré** sur un
# lot bâti à partir de vraies images du dépôt — 200 sur 204, soit 98 %, exacts ou
# à un pixel près. Ce que les essais ci-dessous figent, ce sont les propriétés
# dont dépend ce chiffre, et **surtout celle qui n'est pas un chiffre** : la
# détection sait se taire.

PALETTE_QUELCONQUE = (
    (196, 74, 52),
    (58, 92, 140),
    (232, 214, 160),
    (44, 46, 58),
    (120, 168, 92),
)


def _sur_une_grille(pas: int, cases: int = 22, phase: int = 0) -> np.ndarray:
    """Un sujet peint case par case, puis étiré au pas voulu.

    **Une petite palette tirée au sort par case, et c'est réglé** : deux cases
    voisines tombent parfois sur la même couleur — comme dans un vrai sprite,
    qui a des aplats —, mais des frontières subsistent à *toutes* les positions
    de la grille. La période de l'image **est** donc le pas, par construction, et
    l'essai ne peut pas reprocher au détecteur une période qu'il aurait
    lui-même fabriquée. C'est la garde que le banc a mis deux essais à trouver.
    """
    generateur = np.random.default_rng(pas * 7919)
    logique = np.zeros((cases, cases, 4), dtype=np.uint8)
    tirage = generateur.integers(0, len(PALETTE_QUELCONQUE), size=(cases, cases))
    for y in range(cases):
        for x in range(cases):
            if (x - cases / 2) ** 2 + (y - cases / 2) ** 2 < (cases / 2.6) ** 2:
                logique[y, x] = (*PALETTE_QUELCONQUE[tirage[y, x]], 255)
    cote = cases * pas
    tableau = np.asarray(
        Image.fromarray(logique, mode="RGBA").resize(
            (cote, cote), Image.Resampling.NEAREST
        )
    )
    # La grille d'un modèle ne commence jamais au pixel zéro.
    return np.roll(tableau, (phase, phase), axis=(0, 1)) if phase else tableau


def _peinture(cote: int = 320) -> np.ndarray:
    """Une peinture : des taches douces, et **aucune frontière franche**.

    C'est le cas que le produit rencontre le plus souvent — mesuré, le jeu
    *cœur de pierre* a reçu 24 images comme celle-ci sur 26, alors que sa bible
    réclamait mot pour mot *« strict 64x64 px tile snap »*.
    """
    generateur = np.random.default_rng(1789)
    petite = generateur.integers(0, 255, size=(9, 9, 3), dtype=np.uint8)
    rgb = np.asarray(
        Image.fromarray(petite, mode="RGB").resize(
            (cote, cote), Image.Resampling.BICUBIC
        )
    )
    return np.dstack([rgb, np.full((cote, cote), 255, np.uint8)])


def _silhouette_sur_une_grille(pas: int, cases: int = 22) -> np.ndarray:
    """Un sujet **d'une seule teinte**, détouré, dont la grille est dans l'alpha.

    C'est l'image que le produit mesure vraiment : il cherche la grille sur
    l'image *détourée*, et là, la silhouette est le contraste le plus franc qu'on
    ait. Le fond garde des couleurs douces sous un alpha nul, exactement comme le
    remplissage depuis le bord le laisse.
    """
    generateur = np.random.default_rng(pas * 104729)
    dedans = np.zeros((cases, cases), dtype=bool)
    for y in range(cases):
        for x in range(cases):
            rond = (x - cases / 2) ** 2 + (y - cases / 2) ** 2 < (cases / 2.6) ** 2
            dedans[y, x] = rond and generateur.random() > 0.35
    cote = cases * pas
    alpha = np.asarray(
        Image.fromarray((dedans * 255).astype(np.uint8), mode="L").resize(
            (cote, cote), Image.Resampling.NEAREST
        )
    )
    douce = generateur.integers(60, 200, size=(7, 7, 3), dtype=np.uint8)
    rgb = np.asarray(
        Image.fromarray(douce, mode="RGB").resize(
            (cote, cote), Image.Resampling.BICUBIC
        )
    )
    return np.dstack([rgb, alpha])


def _en_png(rgba: np.ndarray) -> bytes:
    tampon = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(tampon, format="PNG")
    return tampon.getvalue()


# ── Le pas est retrouvé ──────────────────────────────────────────────────────


def test_le_pas_d_une_image_posee_sur_une_grille_est_retrouve():
    """Le critère de la tranche, sur toute la plage que le dépôt produit.

    De 3 à 32 px : les 149 images brutes du dépôt tiennent dedans, la plus
    grossière à 32 px exactement.
    """
    for pas in (3, 4, 6, 8, 12, 16, 24, 32):
        grille = retrouver_grille(_sur_une_grille(pas))
        assert grille.trouvee, f"pas {pas} : la détection a renoncé sur une vraie grille"
        assert grille.pas == pas, f"pas {pas} trouvé {grille.pas}"


def test_une_grille_qui_ne_commence_pas_au_pixel_zero_ne_fait_pas_repondre_la_moitie():
    """La phase est cherchée, et c'est le cas normal : un modèle ne cale rien.

    Le banc a payé cette ligne — une première écriture découpait toujours depuis
    le pixel zéro, chaque bloc chevauchait deux vraies cases, et les trois cas
    décalés répondaient tous exactement **la moitié** du bon pas.
    """
    for pas in (6, 8, 12, 16):
        grille = retrouver_grille(_sur_une_grille(pas, phase=pas // 3))
        assert grille.pas == pas, f"décalé de {pas // 3} : {grille.pas} au lieu de {pas}"


def test_le_cote_en_carres_accompagne_le_pas():
    """**Le pas seul ne sert à rien à l'auteur**, parce qu'il règle des carrés.

    La taille se demande en carrés du sprite, jamais en pixels de l'image reçue.
    Livrer le pas sans sa traduction obligerait l'écran — ou l'auteur — à faire
    la division, et une seconde arithmétique finit toujours par annoncer un
    nombre et en produire un autre.
    """
    grille = retrouver_grille(_sur_une_grille(8, cases=22))
    assert grille.pas == 8
    assert grille.carres == 22


# ── Et surtout : elle sait renoncer ──────────────────────────────────────────


def test_une_peinture_fait_renoncer_la_ou_la_mesure_d_avant_repondait_deux():
    """**Le cœur de cette moitié de tranche**, et il se mesure des deux côtés.

    `mesurer_grille` répond **2 avec une netteté de 0,94** sur une image qui n'a
    aucune grille : l'autocorrélation d'une peinture décroît doucement depuis le
    pas 2 sans jamais faire de bosse, et la règle du plus petit pas qualifié
    attrape ce 2 parce qu'il n'a pas de voisin de gauche à qui se comparer.
    C'est faux **et confiant**, le pire des deux états.

    Le peigne tranche : il demande que le contraste tombe sur les multiples du
    pas, et sur une peinture il est partout.
    """
    peinture = _peinture()

    ancienne_pas, ancienne_nettete = mesurer_grille(_en_png(peinture))
    assert ancienne_pas == 2, "la version faible répondait 2 — si ce n'est plus vrai, "
    assert ancienne_nettete > NETTETE_MINIMALE, "…et elle y croyait"

    grille = retrouver_grille(peinture)
    assert not grille.trouvee
    assert grille.pas == 0
    assert grille.raison == SANS_GRILLE
    # Le portrait exact d'une peinture : ça se répète, mais pas sur une grille.
    assert grille.nettete > NETTETE_MINIMALE
    assert grille.peigne < PEIGNE_MINIMAL


def test_un_pas_hors_borne_fait_renoncer_au_lieu_d_annoncer_une_fraction():
    """Ce qui compte hors borne n'est pas de trouver, c'est de **ne pas mentir**.

    Le reproche exact de la revue externe à la version d'avant : sur un bloc plus
    gros que sa plage de recherche, elle rendait « une fraction du bon avec un
    bon score ». Mesuré sur le banc du produit, les 12 cas posés au-delà de la
    borne renoncent tous — aucun n'annonce un pas faux.
    """
    for pas in (40, 48, 64):
        grille = retrouver_grille(_sur_une_grille(pas, cases=14))
        assert not grille.trouvee, f"pas {pas} : a annoncé {grille.pas}, hors de sa plage"
        assert grille.raison


def test_chaque_renoncement_dit_pourquoi_et_les_raisons_ne_se_confondent_pas():
    """**Renoncer sans dire pourquoi serait une panne muette.**

    Trois refus, trois phrases, et elles partent telles quelles à l'écran : c'est
    le serveur qui sait pourquoi il s'est tu, et une phrase générique côté
    interface ferait deux vérités sur le même refus.
    """
    minuscule = retrouver_grille(np.zeros((6, 6, 4), dtype=np.uint8))
    unie = retrouver_grille(np.full((80, 80, 4), 200, dtype=np.uint8))
    peinte = retrouver_grille(_peinture())

    assert minuscule.raison == IMAGE_TROP_PETITE
    assert unie.raison == IMAGE_UNIE
    assert peinte.raison == SANS_GRILLE
    assert len({minuscule.raison, unie.raison, peinte.raison}) == 3
    for raison in (IMAGE_TROP_PETITE, IMAGE_UNIE, SANS_GRILLE):
        assert raison and raison[0].islower(), "une raison se lit à la suite d'un tiret"


# ── Les deux résultats contre-intuitifs du banc ──────────────────────────────


def test_l_alpha_porte_une_grille_que_les_niveaux_de_gris_ne_voient_pas():
    """*« Additionner plusieurs canaux bat le meilleur canal seul »* — mesuré ici.

    Le cas est celui du produit, pas un cas d'école : l'image est **détourée**,
    son sujet est d'une seule teinte, et toute la grille vit dans la silhouette.
    Les niveaux de gris jettent l'alpha en entrant, donc ils cherchent une
    période dans un fond peint sans grille — et répondent 2, à chaque fois.
    """
    for pas in (6, 8, 12, 16):
        image = _silhouette_sur_une_grille(pas)
        assert retrouver_grille(image).pas == pas
        assert mesurer_grille(_en_png(image))[0] == 2, (
            "les niveaux de gris devraient rater ce cas — sinon il ne prouve plus rien"
        )


def test_la_borne_de_balayage_est_celle_du_depot_et_pas_celle_du_plan():
    """**32 px, mesuré ; ni 80 supposé, ni 24 hérité des détecteurs de référence.**

    Le plan visait 80 px, un chiffre qui n'a jamais été relevé. Le banc a passé
    les 149 images brutes du dépôt : le pas le plus grossier trouvé est de 32, et
    99 % tiennent sous 22. Une borne à 24 — celle des outils du domaine — coupe
    donc le dépôt par le haut, et le banc le chiffre : 12 cas de plus renoncés.
    """
    assert PAS_MAXIMAL == 32
    assert retrouver_grille(_sur_une_grille(32)).pas == 32
    assert retrouver_grille(_sur_une_grille(32), maximum=24).pas == 0


# ── Ce que le lot d'une planche mesure ───────────────────────────────────────


def test_une_case_sans_grille_ne_pese_plus_dans_la_derive_d_un_lot():
    """La revue externe le nommait : *« `derive` hérite des faux positifs »*.

    Une case peinte sans grille répondait 2, et la dérive du lot — le rapport du
    plus grossier au plus fin — se calculait sur ce 2. L'écran affiche déjà « — »
    pour une case à zéro ; ce qui manquait, c'est que zéro soit dit.
    """
    cote = 320
    planche = np.zeros((cote, cote * 2, 4), dtype=np.uint8)
    planche[:, :cote] = _peinture(cote)
    planche[:, cote:] = _sur_une_grille(8, cases=cote // 8)
    boites = [(0, 0, cote - 1, cote - 1), (cote, 0, 2 * cote - 1, cote - 1)]

    mesures = mesurer_lot(planche, boites)
    assert mesures[0].grille_px == 0, "la peinture n'a pas de grille, et le dit"
    assert mesures[1].grille_px == 8
    assert mesures[1].derive == 1.0, "une seule case a un pas : il n'y a pas de dérive"


# ── Le tour par la route ─────────────────────────────────────────────────────


def test_la_grille_du_modele_voyage_par_la_route_des_mesures(client, double):
    """L'écran la montre au-dessus de la taille ; elle arrive donc avec les
    mesures de la table, pas avec l'asset — la charge d'un asset repart deux
    cents fois par relecture de grille.
    """
    # **Le double rend une image qui porte vraiment une grille de 8 px.**
    # `image_sujet` du conftest n'en est pas une : son sujet est une barre de
    # huit colonnes dans une toile de vingt-quatre, la répétition ne porte donc
    # que sur un tiers de la largeur, et la netteté plafonne à 0,20 — la
    # détection y renonce, à juste titre. Le mesurer ici mesurerait le conftest.
    double.rendre = lambda: _en_png(_sur_une_grille(8, cases=22))
    lancee = client.post(
        "/api/generations",
        json={"modele": MODELE_DOUBLE, "prompt": "un tonneau", "echelle": "personnage"},
    )
    assert lancee.status_code == 202, lancee.text
    generation = _attendre(client, lancee.json()["identifiant"])

    identifiant = f"{generation['identifiant']}-0"
    mesures = client.get(f"/api/assets/{identifiant}/spots")
    assert mesures.status_code == 200, mesures.text

    grille = mesures.json()["grille_du_modele"]
    # **`phase` s'est ajoutée en D4**, et c'est la seule clé neuve depuis D2.
    # Le pas seul ne suffit pas à poser un trait sur une grille : il faut savoir
    # *où* elle commence, sans quoi le contour tombe à cheval sur deux blocs. La
    # recherche existait déjà dans `_peigne` ; elle était jetée aussitôt faite.
    assert set(grille) == {"pas", "nettete", "peigne", "carres", "phase", "raison"}
    assert grille["pas"] == 8, "le double a peint sur des blocs de 8 px"
    assert grille["raison"] is None
    assert grille["carres"] > 0
    ligne, colonne = grille["phase"]
    assert 0 <= ligne < 8 and 0 <= colonne < 8


def test_le_nom_de_la_mesure_est_le_meme_des_deux_cotes():
    """Le type de l'interface et la charge du serveur portent les mêmes clés.

    La règle des crans de cible et des noms de moteurs avant eux : deux listes
    pour un fait finissent toujours par diverger, et c'est un essai qui rend la
    divergence impossible à livrer.
    """
    declare = API.read_text(encoding="utf-8")
    bloc = re.search(
        r"export type GrilleDuModele = \{(.*?)\n\}", declare, re.S
    )
    assert bloc, "le type `GrilleDuModele` a disparu de `interface/src/api.ts`"
    champs = set(re.findall(r"^\s{2}(\w+):", bloc.group(1), re.M))
    assert champs == {"pas", "nettete", "peigne", "carres", "phase", "raison"}
