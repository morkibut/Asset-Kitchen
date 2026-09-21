# -*- coding: utf-8 -*-
"""Les critères d'acceptation de D3, **et leur renversement par RT3**.

Un test par critère de `docs/archive/plan-r6-a-v3.02.md` § D3, nommé d'après lui
— puis, en queue de fichier, un test par critère de
`docs/PLAN-retours-du-20-septembre.md` § RT3.

⚠️ **Deux tranches, deux décisions contraires, et seule la seconde est en
vigueur.** Le 2 septembre 2026, le fond était un réglage du jeu que l'atelier se
contentait de proposer ; le 20 septembre, l'auteur a changé d'avis et l'atelier
calcule le fond à chaque appel sur l'image de référence envoyée. Les tests de D3
qui vérifiaient le **mécanisme** — la phrase de calage, l'interdiction, la
mesure sur une planche revenue — sont restés, parce que ce mécanisme n'a pas
bougé ; ceux qui vérifiaient que *le réglage du jeu décide* ont été repris, et
c'est écrit dans chacun d'eux. Le raisonnement complet est en tête de
`atelier/domaine/fond.py`.

**Ce que la tranche répare, et c'est mesuré ailleurs qu'ici.** Le produit
demandait *un fond plat* sans dire lequel depuis le premier jour : le modèle
rendait un gris clair, c'est-à-dire une couleur que le sujet porte aussi, d'où
le découpage à reprendre sur presque chaque image. Une couleur franche que rien
dans le jeu ne contient rend le découpage presque gratuit et presque parfait.

**La tranche n'a pas de banc, et c'est un arbitrage de l'auteur** du 2 septembre
2026 : *« pas besoin de tester ça »*. La raison tient — le fond devient un
réglage, pas une valeur imposée, et une mauvaise couleur se change en un geste.
Ce qui remplace le banc est le septième critère : **deux mesures d'acceptation
lues sur les images qu'on voulait de toute façon**, et elles sont vérifiées ici
comme les six autres.

**Aucun test de ce fichier ne coûte un centime** : tout se joue sur le double de
`conftest`, sur des univers montés en mémoire et sur des tableaux NumPy.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.envoi import Tri
from atelier.domaine.fond import (
    AUCUN_FOND,
    CANDIDATS,
    ECART_MINIMAL,
    TOLERANCE_LIVREE,
    VERT_DE_STUDIO,
    choisir,
    dit,
    ecart,
    fond_valide,
    interdiction,
    nom_du_fond,
    proposer,
    replier,
    rvb,
)
from atelier.domaine.projet import Univers, bible_complete
from atelier.domaine.recette import Passe
from atelier.domaine.vue import phrase_de_calage, phrases_du_produit
from atelier.image.traitement import _rvb, mesures_du_fond

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"

#: Un fond franc, et il n'est pas dans la liste des candidats : c'est ce qui
#: permet de distinguer *ce que l'auteur a posé* de *ce que l'atelier propose*.
POSE_A_LA_MAIN = "#7A3B12"


def _univers(client) -> dict:
    return client.get("/api/universe").json()["univers"]


def _regler(client, **corps) -> dict:
    reponse = client.put("/api/universe", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["univers"]


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _technique(envoi: dict) -> str:
    return next(l for l in envoi["lignes"] if l["clef"] == "jeu.technique")["texte"]


# ── Critère 1 — le fond est un réglage d'univers ─────────────────────────────


def test_le_fond_se_voit_se_choisit_et_s_enregistre(client):
    """**Trois gestes, et c'est tout ce que « un réglage » veut dire.**

    Il n'y en avait aucun avant la tranche : le fond était une phrase anglaise
    enterrée dans une fonction du domaine, et rien à l'écran ne disait qu'il
    existait.
    """
    assert _univers(client)["fond"] == AUCUN_FOND

    regle = _regler(client, fond=POSE_A_LA_MAIN)

    assert regle["fond"] == POSE_A_LA_MAIN
    # **Il s'enregistre** : relu par une autre route, c'est le même.
    assert _univers(client)["fond"] == POSE_A_LA_MAIN


def test_le_fond_se_retire_et_rend_exactement_l_etat_d_avant(client):
    """**La chaîne vide retire, et elle est le seul geste de retrait nécessaire.**

    Une couleur est toujours quelque chose : *jamais posé* et *posé sur rien* sont
    le même état. C'est l'inverse exact du détourage par défaut de `D1`, qui a
    besoin de ses trois états parce qu'une passe vide n'existe pas.
    """
    _regler(client, fond=POSE_A_LA_MAIN)

    assert _regler(client, fond="")["fond"] == AUCUN_FOND


def test_une_couleur_illisible_est_refusee_avant_de_partir_dans_un_texte_paye(client):
    """**Ce qui se refuse n'est pas *hors palette*, c'est *pas une couleur*.**

    Une couleur que le jeu contient se pose : l'atelier propose et n'impose
    jamais. Ce qui ne peut pas passer est une chaîne qui partirait telle quelle
    dans un texte payé et se relirait des mois plus tard sur la génération.
    """
    reponse = client.put("/api/universe", json={"fond": "bleu"})

    assert reponse.status_code == 409, reponse.text
    assert "n'est pas une couleur" in reponse.json()["raison"]
    assert _univers(client)["fond"] == AUCUN_FOND


def test_le_fond_relu_du_disque_se_normalise_pour_ne_pas_faire_deux_fonds():
    """La couleur part dans le texte et se relit sur une génération enregistrée :
    `#ff00ff` et `#FF00FF` y liraient comme deux fonds différents."""
    assert fond_valide("ff00ff") == "#FF00FF"
    assert fond_valide("#Ff00fF") == "#FF00FF"
    # **Un champ absent, illisible ou d'un autre type revient vide** plutôt que
    # de faire tomber la lecture d'un projet entier pour un champ de couleur.
    assert fond_valide(None) == AUCUN_FOND
    assert fond_valide("#12345") == AUCUN_FOND
    assert fond_valide("#zzzzzz") == AUCUN_FOND


def test_un_univers_qui_n_a_que_son_fond_reste_vide_et_dit_quand_meme_son_fond():
    """*Renversé le 20 septembre 2026 (RT3)*, et c'est le bon sens retrouvé.

    D3 faisait entrer le fond dans le compte de `vide`, pour que la phrase de
    calage — celle qui le porte — parte avec lui. Le fond n'étant plus un choix
    mais un calcul, le compter comme une déclaration ferait sortir un jeu neuf
    de son silence : un premier essai partirait avec la grille et la caméra que
    personne n'a choisies, ce que US-57 interdit.

    **Les deux se tiennent maintenant par `dit_quelque_chose`** : l'univers
    reste vide, la case `technique` parle quand même, et elle ne dit que le
    fond.
    """
    neuf = Univers(bible=bible_complete(()))
    avec_fond = Univers(bible=bible_complete(()), fond="#00B140")

    assert neuf.vide and avec_fond.vide
    # Rien à dire sans fond : le jeu neuf se tait entièrement.
    assert neuf.texte_de_la_case("technique") == ""
    assert neuf.texte_de_la_case("rendu") == ""
    # Avec le fond calculé : la phrase part, réduite à sa moitié de fond.
    dite = avec_fond.texte_de_la_case("technique")
    assert dite == (
        "single isolated sprite on a flat solid #00B140 studio green background"
    )
    assert "tile snap" not in dite
    # Et rien d'autre ne se réveille.
    assert avec_fond.texte_de_la_case("rendu") == ""
    assert avec_fond.texte_de_la_case("vue") == ""


# ── Critère 2 — il se corrige sur l'écran de confirmation, pour cet appel ─────


def test_le_fond_se_corrige_avant_de_payer_et_ne_vaut_que_pour_cet_appel(client):
    """**Corriger ici habille l'appel et disparaît.**

    C'est la règle de tout ce que l'écran de confirmation renvoie, appliquée au
    fond : ce qui est oublié est le réglage pour la suite, ce qui est gardé est
    l'histoire de ce qui a été fait.
    """
    _regler(client, fond=POSE_A_LA_MAIN)

    corrige = _envoi(client, tri={"fond": "#00FFFF"})

    assert corrige["fond"]["couleur"] == "#00FFFF"
    assert corrige["fond"]["corrige"] is True
    assert corrige["fond"]["du_jeu"] == POSE_A_LA_MAIN
    # **Le texte suit, et il n'y a pas deux fonds dans le même appel** : la
    # couleur corrigée est celle de la phrase de calage.
    assert "#00FFFF" in _technique(corrige)
    assert POSE_A_LA_MAIN not in _technique(corrige)
    # **Et rien n'a remonté.**
    assert _univers(client)["fond"] == POSE_A_LA_MAIN


def test_la_chaine_vide_retire_le_fond_pour_cet_appel_seulement(client):
    """**Absent et vide ne se confondent pas.** `null` laisse l'atelier calculer ;
    `""` retire le fond pour cet essai-ci — le geste qu'on fait quand on veut
    comparer avec ce que le jeu rendait avant la tranche.

    *Repris le 20 septembre 2026 (RT3)* : sans correction, la couleur n'est plus
    celle du jeu mais celle que l'atelier calcule — ici le vert de studio, faute
    d'image de référence à comparer. Ce que le test vérifiait reste entier : la
    chaîne vide est un geste, et l'absence de clé n'en est pas un.
    """
    _regler(client, fond=POSE_A_LA_MAIN)

    sans = _envoi(client, tri={"fond": ""})
    avec = _envoi(client, tri={"eteints": []})

    assert sans["fond"]["couleur"] == AUCUN_FOND
    assert sans["fond"]["corrige"] is True
    assert avec["fond"]["couleur"] == VERT_DE_STUDIO.couleur
    assert avec["fond"]["corrige"] is False


def test_le_fond_corrige_change_aussi_l_interdiction_dans_le_meme_appel(client):
    """**C'est la raison d'être du quatrième écart du tri.**

    Le fond fabrique deux textes qui partent dans deux champs différents. Le
    corriger en tapant dans la ligne de calage aurait changé l'un sans l'autre :
    l'appel serait parti en demandant du magenta et en interdisant du cyan, sans
    que rien ne le dise.
    """
    _regler(client, fond="#FF00FF")

    corrige = _envoi(client, tri={"fond": "#00FFFF"})

    assert "#00FFFF" in corrige["fond"]["interdiction"]
    assert "#FF00FF" not in corrige["fond"]["interdiction"]


# ── Critère 3 — l'atelier propose, il n'impose jamais ────────────────────────


def test_l_atelier_propose_une_couleur_sure_depuis_la_palette_du_projet():
    """**Un calcul fait une fois, sur une liste fermée.**

    L'écart d'un candidat à la palette est le plus petit de ses écarts à chacune
    de ses couleurs, dans la distance du détourage.
    """
    propose = proposer(("#3A5F0B", "#8B4513", "#C0C0C0", "#1B2A3C"))

    assert propose.sure
    assert propose.couleur == CANDIDATS[0].couleur
    assert propose.nom == CANDIDATS[0].nom
    assert propose.ecart >= ECART_MINIMAL
    # **La voisine est rendue avec l'écart** : un chiffre nu ne se lit pas, et
    # « à 192 de ce gris-là » dit sur quoi le calcul a porté.
    assert propose.voisine in ("#3A5F0B", "#8B4513", "#C0C0C0", "#1B2A3C")
    assert ecart(propose.couleur, propose.voisine) == propose.ecart


def test_proposer_ne_pose_rien_tout_seul(client, tmp_path):
    """**Proposer est un geste de l'écran, jamais une valeur du produit.**

    C'est l'arbitrage de l'auteur, et la phrase de la tranche : *l'atelier peut
    proposer, il ne décide pas*. Lire la proposition ne doit donc rien écrire.
    """
    depose = client.post(
        "/api/board/paste",
        params={"nom": "un artwork", "forcer": True, "artwork": True},
        content=image_sujet(toile=24, bloc=2),
    )
    assert depose.status_code == 201, depose.text

    lu = client.get("/api/universe").json()

    assert "fond_propose" in lu
    assert lu["univers"]["fond"] == AUCUN_FOND


def test_la_distance_qui_decide_est_celle_du_detourage_et_pas_une_autre():
    """**La question posée est *le découpage va-t-il manger une couleur du
    jeu ?*, et une autre distance aurait répondu à une autre question.**

    `detourer_bord` compare la plus grande des trois différences de composante à
    sa tolérance. C'est la même ici, et le seuil est un multiple de la tolérance
    livrée plutôt qu'un chiffre rond.
    """
    assert ecart("#000000", "#0000FF") == 255
    assert ecart("#101010", "#131013") == 3
    assert Passe().tolerance == TOLERANCE_LIVREE
    assert ECART_MINIMAL == 3 * TOLERANCE_LIVREE


def test_le_domaine_et_le_traitement_lisent_un_hexadecimal_de_la_meme_facon():
    """**Deux lectures écrites deux fois, et un essai qui les confronte.**

    Le domaine ne dépend d'aucune autre couche : faire descendre le traitement
    d'image dans le domaine pour trois lignes d'hexadécimal aurait coûté plus
    cher que la répétition. Ce qui la rend tenable est ceci — une divergence se
    voit au lieu de se deviner.
    """
    for candidat in CANDIDATS:
        assert rvb(candidat.couleur) == _rvb(candidat.couleur)
    assert rvb("illisible") == _rvb("illisible") == (0, 0, 0)


# ── Critère 4 — aucun candidat sûr : il le dit, il ne choisit pas ────────────


def test_sans_candidat_sur_l_atelier_le_dit_et_ne_choisit_pas():
    """**Une palette qui couvre la roue est un état normal**, celui d'un jeu très
    coloré. La bonne conduite est de laisser le fond en place et de dire à
    l'auteur ce qu'il achète s'il en pose un quand même."""
    couvrante = tuple(c.couleur for c in CANDIDATS)

    propose = proposer(couvrante)

    assert not propose.sure
    assert propose.couleur == AUCUN_FOND
    # **Le refus porte les deux chiffres qui le rendent lisible** : ce qu'on a
    # trouvé de plus éloigné, et ce qu'il aurait fallu.
    assert str(ECART_MINIMAL) in (propose.raison or "")


def test_sans_palette_l_atelier_ne_propose_pas_et_dit_pourquoi():
    """**Proposer le magenta parce que la liste est vide** serait proposer au
    hasard en ayant l'air de calculer."""
    propose = proposer(())

    assert not propose.sure
    assert "palette" in (propose.raison or "")


# ── Critère 5 — l'interdiction part, et se relit sur la génération ───────────


def test_la_phrase_d_interdiction_part_avec_la_demande(client, double):
    """**Elle entre dans un champ qui existait déjà**, et c'est ce qui rend ce
    critère-là presque gratuit : `prompt_negatif` est là depuis T1, et les deux
    adaptateurs le replient en fin de demande sous *« Do not include: »*."""
    lue = _lancer(client, tri={"fond": "#FF00FF"})

    assert "#FF00FF" in lue["demande"]["prompt_negatif"]
    assert "magenta" in lue["demande"]["prompt_negatif"]


def test_l_interdiction_se_relit_dans_la_generation_enregistree(client):
    """**Composée avant l'enregistrement**, comme le prompt : une génération se
    relit des mois après sans avoir à reconstituer le fond du jour."""
    lancee = _lancer(client, tri={"fond": "#00FFFF"})

    relue = client.get(f"/api/generations/{lancee['identifiant']}").json()

    assert "#00FFFF" in relue["demande"]["prompt_negatif"]


def test_ce_que_l_auteur_interdit_ne_cede_jamais_devant_ce_que_le_produit_ajoute(
    client,
):
    """**La règle du dépôt, appliquée au champ d'interdiction.** Elle vaut déjà
    pour les images jointes ; il n'y avait aucune raison qu'elle s'arrête ici."""
    lue = _lancer(
        client, prompt_negatif="blurry, watermark", tri={"fond": "#FF00FF"}
    )

    negatif = lue["demande"]["prompt_negatif"]
    assert negatif.startswith("blurry, watermark")
    assert "#FF00FF" in negatif


def test_l_interdiction_vise_le_sujet_et_jamais_le_fond():
    """**L'inverse serait un contresens** : le fond *est* cette couleur, et la
    lui interdire annulerait la demande qu'on vient de faire."""
    phrase = interdiction("#FF00FF")

    assert "on the subject itself" in phrase
    assert "background colour" in phrase
    for endroit in ("outfit", "skin", "hair", "accessories", "reflections", "shadows"):
        assert endroit in phrase


def test_l_interdiction_ne_porte_aucune_negation(client):
    """⚠️ **Une négation dans un champ déjà négatif inverse la phrase.**

    La première écriture disait *« (not on its outfit, its skin… ) »*. Repliée
    derrière *« Do not include: »*, la parenthèse cessait d'énumérer pour
    **retrancher** : ne mets pas cette couleur sur le sujet, sauf sur sa tenue et
    sa peau — le contraire de `US-421`. Le défaut ne se voyait pas dans le code,
    qui se lit toujours comme on l'a pensé ; il s'est vu en lisant la phrase
    entière dans la console.

    **La garde porte sur ce qui part vraiment**, pas sur la phrase seule : c'est
    le texte replié derrière l'en-tête négatif qui doit rester une énumération.
    """
    phrase = interdiction("#FF00FF")

    assert " not " not in f" {phrase} "
    assert "(on its outfit" in phrase

    _regler(client, fond="#FF00FF")
    negatif = _lancer(client)["demande"]["prompt_negatif"]

    assert " not " not in f" {negatif} "


def test_sans_fond_rien_n_est_interdit(client):
    """*« Do not include: »* suivi de rien serait une phrase qui ne dit rien au
    prix d'un appel.

    *Repris le 20 septembre 2026 (RT3)* : un appel n'a plus de fond que si
    l'auteur le retire lui-même pour cet appel-là, puisque l'atelier en calcule
    un sinon. Le geste existe toujours, et c'est lui qu'on vérifie.
    """
    assert interdiction(AUCUN_FOND) == ""
    assert replier("", "") == ""

    lue = _lancer(client, tri={"fond": ""})

    assert lue["demande"]["prompt_negatif"] == ""


# ── Critère 6 — un univers sans palette garde le comportement d'aujourd'hui ──


def test_sans_fond_pose_la_phrase_de_calage_est_celle_d_avant_la_tranche():
    """**Au caractère près**, et c'est le critère le plus important de la
    tranche : le dépôt a des centaines d'images déjà traitées, et un jeu qui n'a
    rien choisi ne doit pas changer d'un mot."""
    assert (
        phrase_de_calage(64)
        == "single isolated sprite on a flat background, strict 64x64 px tile snap"
    )
    assert phrase_de_calage(64, "") == phrase_de_calage(64)
    assert phrase_de_calage(0) == ""


def test_un_univers_sans_palette_ne_recoit_aucune_proposition_et_ne_change_rien(client):
    """**Un jeu sans artwork n'a rien dit de ses couleurs.** Il garde donc
    exactement ce qu'il envoyait, et l'atelier se tait plutôt que de proposer au
    hasard."""
    lu = client.get("/api/universe").json()

    assert lu["univers"]["palette"] == []
    assert lu["fond_propose"]["couleur"] == AUCUN_FOND
    assert lu["fond_propose"]["raison"] is not None


def test_la_liste_de_migration_du_1er_septembre_ne_grossit_pas_du_fond():
    """**Elle ne sert qu'à retirer d'un fichier écrit avant le
    1ᵉʳ septembre 2026** ce que le produit y avait rangé lui-même — et aucun de
    ces fichiers ne porte de fond, puisque le réglage n'existait pas.

    Les y ajouter ferait parcourir six couleurs fois neuf tailles à chaque
    relecture de case, pour retirer un texte qui n'y est jamais.
    """
    ecrites = phrases_du_produit()

    assert phrase_de_calage(64) in ecrites
    for candidat in CANDIDATS:
        assert phrase_de_calage(64, candidat.couleur) not in ecrites


def test_un_jeu_en_dessin_a_un_fond_comme_les_autres():
    """**Le calage est du pixel art, le fond est de tous les styles.**

    Coller les deux aurait rendu le fond inatteignable à la moitié des projets,
    et la tranche muette là où elle sert autant.
    """
    dessin = Univers(bible=bible_complete(()), style="dessin", fond="#FF00FF")

    phrase = dessin.phrase_du_produit("technique")

    assert "#FF00FF" in phrase
    assert "tile snap" not in phrase
    # Et sans fond, un jeu en dessin ne dit toujours rien de la technique.
    assert Univers(bible=bible_complete(()), style="dessin").phrase_du_produit(
        "technique"
    ) == ""


def test_le_fond_part_dans_la_phrase_de_calage_et_nulle_part_ailleurs(client):
    """**Une seule ligne le porte**, et c'est celle qui le portait déjà sans le
    nommer. Lui en donner une seconde aurait fait partir la couleur deux fois
    dans le même texte."""
    envoi = _envoi(client, tri={"fond": "#FF00FF"})

    portantes = [l for l in envoi["lignes"] if "#FF00FF" in l["texte"]]
    assert [l["clef"] for l in portantes] == ["jeu.technique"]
    assert envoi["texte"].count("#FF00FF") == 1


def test_le_nom_anglais_se_deduit_de_la_couleur_et_ne_se_range_jamais_a_cote():
    """**Une couleur que l'auteur a tapée n'a pas de nom**, et le texte part
    alors avec le seul hexadécimal — ce qui est exact, et vaut mieux qu'un nom
    approché."""
    assert nom_du_fond("#FF00FF") == "magenta"
    assert nom_du_fond(POSE_A_LA_MAIN) == ""
    assert dit("#FF00FF") == "#FF00FF magenta"
    assert dit(POSE_A_LA_MAIN) == POSE_A_LA_MAIN
    assert dit(AUCUN_FOND) == ""


# ── Critère 7 — les deux mesures d'acceptation, sur une planche revenue ──────


def _image_sur_fond(fond: tuple[int, int, int], collés: int = 0) -> np.ndarray:
    """Une image détourée à la main : un carré de sujet sur un fond plat.

    `collés` colore autant de colonnes du sujet à la couleur du fond — c'est la
    contamination que la seconde mesure existe pour compter.
    """
    rgba = np.zeros((32, 32, 4), dtype=np.uint8)
    rgba[:, :, :3] = fond
    rgba[8:24, 8:24] = (*(30, 60, 90), 255)
    for colonne in range(collés):
        rgba[8:24, 8 + colonne] = (*fond, 255)
    return rgba


def test_les_deux_mesures_se_lisent_sur_une_planche_revenue(client, double):
    """**C'est ce qui remplace le banc**, et c'est un critère à part entière.

    Elles arrivent par la route des mesures d'une table, avec les six autres :
    la mesure se lit sur les images qu'on voulait de toute façon, à côté du
    curseur qui l'explique.
    """
    double.rendre = lambda: image_sujet(toile=48, bloc=4)
    generation = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un sujet d'essai"}
    ).json()
    identifiant = f"{generation['identifiant']}-0"

    mesures = client.get(f"/api/assets/{identifiant}/spots").json()

    assert set(mesures["fond"]) == {
        "fond",
        "sujet",
        "bord",
        "frange",
        "colles",
        "part_collee",
    }
    assert mesures["fond"]["fond"].startswith("#")


def test_la_mesure_compte_les_pixels_du_sujet_encore_colles_au_fond():
    """**Le prix exact d'un fond mal choisi.** Ces pixels-là sont ceux qu'un cran
    de tolérance de plus aurait emportés."""
    gris = _image_sur_fond((200, 200, 200), collés=3)

    lue = mesures_du_fond(gris, tolerance=28)

    assert lue.fond == "#C8C8C8"
    assert lue.sujet == 16 * 16
    assert lue.colles == 3 * 16
    assert round(lue.part_collee, 4) == round(48 / 256, 4)


def test_un_fond_franc_met_la_seconde_mesure_a_zero():
    """**C'est toute la promesse de la tranche, vérifiée sur des pixels.**

    Le même sujet sur un fond magenta n'a plus un seul pixel à portée de
    tolérance du fond : le découpage n'a rien à manger de plus.
    """
    franc = _image_sur_fond((255, 0, 255))

    lue = mesures_du_fond(franc, tolerance=28)

    assert lue.fond == "#FF00FF"
    assert lue.colles == 0
    assert lue.part_collee == 0.0


def test_la_frange_compte_ce_que_le_durcissement_existe_pour_retirer():
    """Les pixels **à demi transparents** que le détourage a laissés — ce qui
    fabrique un halo quand on ne les ronge pas. Le pourtour est rendu avec eux :
    « 312 pixels » ne veut rien dire tant qu'on ne sait pas si le bord en fait
    300 ou 30 000."""
    avec_frange = _image_sur_fond((200, 200, 200))
    avec_frange[8, 8:24, 3] = 128

    lue = mesures_du_fond(avec_frange)

    assert lue.frange == 16
    assert lue.bord == 16 * 4 - 4


def test_la_couleur_mesuree_est_celle_qui_est_revenue_jamais_celle_demandee():
    """**Comparer la couleur demandée à elle-même n'aurait rien mesuré.**

    L'écart entre les deux est l'information : c'est la dérive du modèle, et
    c'est elle qui dira de combien il faut se tenir à l'écart de la palette.
    """
    derive = _image_sur_fond((250, 4, 248))

    assert mesures_du_fond(derive).fond == "#FA04F8"


def test_une_image_sans_sujet_ne_ment_pas():
    """Un détourage qui a tout mangé se voit — et il se voit mieux avec la
    couleur qu'il a prise pour du fond."""
    vide = np.zeros((16, 16, 4), dtype=np.uint8)
    vide[:, :, :3] = (200, 200, 200)

    lue = mesures_du_fond(vide)

    assert (lue.sujet, lue.bord, lue.frange, lue.colles) == (0, 0, 0, 0)
    assert lue.fond == "#C8C8C8"


# ── L'invariant de la tranche — rien ne part de la machine ───────────────────


def test_le_tri_ne_porte_que_des_ecarts_et_le_fond_en_est_un():
    """`None` est *n'y touche pas*, `""` est *retire-le pour cet appel*. Les
    confondre aurait rendu « pas de fond pour cet essai » impossible à demander
    sur un jeu qui en a un."""
    assert Tri().fond_de("#FF00FF") == "#FF00FF"
    assert Tri(fond="").fond_de("#FF00FF") == ""
    assert Tri(fond="#00FFFF").fond_de("#FF00FF") == "#00FFFF"
    assert Tri.depuis_json({"fond": ""}).fond == ""
    assert Tri.depuis_json({"eteints": ["a"]}).fond is None


def _lancer(client, **corps) -> dict:
    """Payer pour de bon, par la route de tout le monde — **il n'y en a qu'une**.

    L'attente se fait par le client plutôt que par le service : celui-ci tourne
    dans la boucle du client HTTP, et l'attendre depuis celle de l'essai
    réveillerait une tâche accrochée à une autre boucle.
    """
    import time

    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un nain", **corps},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(60):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


# ═══ RT3 — le fond se calcule sur l'image de référence ═══════════════════════
#
# Les critères de `docs/PLAN-retours-du-20-septembre.md` § RT3, un par test.
# **Ils renversent le critère 3 de D3** — *l'atelier propose, il n'impose
# jamais* —, et c'est assumé : l'auteur a changé d'avis le 20 septembre 2026.
# Les tests de D3 qui disaient le contraire ont été repris plus haut, chacun
# avec la raison de sa reprise.


def _aplat(couleur: tuple[int, int, int], cote: int = 48) -> bytes:
    """Une image d'une seule couleur, avec une bordure transparente.

    La bordure est ce qui fait que le détourage préalable de `palette_de` trouve
    un bord à manger : sans elle, il mangerait l'aplat entier, et la lecture
    retomberait sur l'image complète par un autre chemin que celui qu'on veut
    éprouver.
    """
    import io

    from PIL import Image

    image = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    image.paste(Image.new("RGBA", (cote - 16, cote - 16), (*couleur, 255)), (8, 8))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _importer(client, tmp_path, octets: bytes, nom: str) -> str:
    chemin = tmp_path / f"{nom}.png"
    chemin.write_bytes(octets)
    reponse = client.post(
        "/api/assets/import", json={"chemin": str(chemin), "forcer": True}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def test_une_demande_avec_image_de_reference_part_sur_la_couleur_la_plus_eloignee(
    client, tmp_path
):
    """**Le premier critère de RT3, par la route de tout le monde.**

    Un sujet magenta ne peut pas partir sur du magenta — le découpage le
    mangerait avec le fond. L'atelier prend donc le candidat qui s'en éloigne le
    plus, et c'est le cyan.
    """
    reference = _importer(client, tmp_path, _aplat((230, 40, 230)), "magenta")

    envoi = _envoi(client, references=[{"asset": reference, "role": "reference"}])

    assert envoi["fond"]["couleur"] == "#00FFFF"
    assert "#00FFFF cyan" in _technique(envoi)


def test_une_demande_sans_image_de_reference_part_sur_le_vert_de_studio(client):
    """**Le deuxième critère**, et c'est le cas le plus fréquent : la première
    image d'un jeu neuf ne joint rien.

    `#00B140` et non le vide : le vide était le comportement d'avant D3 — *un
    fond plat* sans couleur, que le modèle rendait en gris clair, c'est-à-dire
    en une couleur que le sujet porte aussi.
    """
    envoi = _envoi(client)

    assert envoi["fond"]["couleur"] == "#00B140"
    assert "#00B140 studio green" in _technique(envoi)


def test_plusieurs_references_sont_un_seul_ensemble_de_couleurs():
    """**Le troisième critère.** Le modèle ne rend qu'une image : un fond qui
    fuirait la première référence en tombant sur la seconde ne protégerait
    rien."""
    seule = choisir(["#FF00FF"])
    ensemble = choisir(["#FF00FF", "#00FFFF"])

    # Seul, le magenta chasse le cyan, qui en est le plus loin.
    assert seule.couleur == "#00FFFF"
    # Les deux ensemble chassent le cyan avec : ce qui reste est loin des deux.
    assert ensemble.couleur == "#00FF00"
    assert ecart(ensemble.couleur, "#FF00FF") >= ensemble.ecart
    assert ecart(ensemble.couleur, "#00FFFF") >= ensemble.ecart


def test_le_fond_d_un_univers_existant_reste_sur_le_disque_et_n_est_plus_lu(client):
    """**Le quatrième critère, et ses deux moitiés.**

    Le champ se relit — les jeux déjà écrits le portent, et le retirer du modèle
    aurait cassé leur lecture pour un champ que plus rien n'emploie. Mais la
    production ne le lit plus : ce qui part est la couleur calculée.
    """
    _regler(client, fond="#FF00FF")

    # Il est toujours là, relu par la route de l'univers.
    assert _univers(client)["fond"] == "#FF00FF"
    # Et il ne part plus : le texte porte le calcul, pas le réglage.
    envoi = _envoi(client)
    assert "#FF00FF" not in envoi["texte"]
    assert envoi["fond"]["couleur"] == "#00B140"


def test_le_paragraphe_du_2_septembre_est_reecrit():
    """**Le cinquième critère**, et c'est le seul de la tranche qui ne porte pas
    sur le comportement.

    Deux décisions contraires ne cohabitent pas dans ce dépôt : l'en-tête du
    module doit porter les deux dates, dire laquelle l'emporte, et ne plus
    énoncer l'ancienne règle au présent.
    """
    import atelier.domaine.fond as module

    tete = module.__doc__ or ""

    assert "2 septembre 2026" in tete, "la décision d'origine est datée"
    assert "20 septembre 2026" in tete, "le revirement est daté"
    assert "changé d'avis" in tete
    # L'ancienne règle n'est plus affirmée : elle est racontée au passé.
    assert "**Il propose, il n'impose pas.**" not in tete


def test_la_video_passe_par_le_meme_choix_que_l_image():
    """**Le sixième critère** — l'auteur a nommé l'image et la vidéo ensemble.

    `atelier/image/clip.py` tenait sa propre liste de trois couleurs et sa
    propre façon de les départager. C'était une seconde vérité sur la même
    question, et elle répondait autrement : un sujet rouge partait sur du vert
    là où les six candidats trouvent le cyan.
    """
    from atelier.image.clip import fond_le_plus_eloigne
    from atelier.image.palette import palette_de

    for couleur in ((200, 60, 60), (30, 220, 40), (230, 40, 230)):
        sprite = _aplat(couleur)
        attendu = choisir(palette_de([sprite])).couleur
        assert fond_le_plus_eloigne(sprite) == rvb(attendu)
    # Et une image illisible ne fait pas échouer un clip : elle tombe sur le
    # vert de studio, comme un appel d'image sans référence.
    assert fond_le_plus_eloigne(b"") == rvb(VERT_DE_STUDIO.couleur)


def test_le_vert_de_studio_est_un_septieme_candidat_et_ne_concourt_pas():
    """**Il n'est pas un concurrent qu'on élit, il est ce qu'on prend quand il
    n'y a rien à comparer.**

    L'entrer dans `CANDIDATS` l'aurait mis en compétition avec les six, donc
    rendu gagnant sur des sujets où il est justement le plus dangereux — un
    décor, un feuillage, une potion.
    """
    assert VERT_DE_STUDIO.couleur == "#00B140"
    assert VERT_DE_STUDIO not in CANDIDATS
    assert all(c.couleur != VERT_DE_STUDIO.couleur for c in CANDIDATS)
    # Rien à comparer : c'est lui, et il se déclare comme repli.
    vide = choisir(())
    assert (vide.couleur, vide.par_defaut) == ("#00B140", True)
    # Mais il ne gagne jamais un choix : sur une image verte, c'est un des six.
    assert choisir(["#00B140"]).couleur in {c.couleur for c in CANDIDATS}
    # **Et il porte son nom anglais**, comme les six, parce qu'il part avec eux.
    assert dit("#00B140") == "#00B140 studio green"


def test_le_calcul_ne_cede_pas_devant_ce_que_l_auteur_a_corrige(client, tmp_path):
    """**La règle du dépôt tient, même quand c'est l'atelier qui calcule.**

    Ce que l'auteur pose pour cet appel-là ne cède jamais devant ce que le
    produit ajoute — c'est vrai des images jointes, du champ d'interdiction, et
    ça reste vrai du fond.
    """
    reference = _importer(client, tmp_path, _aplat((230, 40, 230)), "magenta")
    jointe = [{"asset": reference, "role": "reference"}]

    calcule = _envoi(client, references=jointe)
    corrige = _envoi(client, references=jointe, tri={"fond": "#FF7A00"})

    assert calcule["fond"]["couleur"] == "#00FFFF"
    assert corrige["fond"]["couleur"] == "#FF7A00"
    assert "#FF7A00" in corrige["fond"]["interdiction"]
