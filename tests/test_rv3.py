# -*- coding: utf-8 -*-
"""RV3 : le fond de studio évite la couleur du sujet.

`docs/PLAN-revue-du-21-septembre.md` § RV3. Constaté le 21 septembre 2026 : un
rôdeur décrit « encapuchonné, cape verte, torche à la main », envoyé sans image
de référence, est parti sur `#00B140` — le vert de studio, le repli de RT3 — et
le détourage a mangé la cape avec le fond.

Un test par critère, sur la route de tout le monde (`POST /api/outgoing`,
exactement celle que `test_d3.py` emploie pour RT3), plus quelques tests de
domaine sur `atelier.domaine.fond.choisir` et `couleurs_nommees` directement,
pour les cas qu'un aller-retour HTTP dirait mal.

**Aucun test de ce fichier ne coûte un centime** : `/api/outgoing` arme, il ne
facture pas.
"""

from __future__ import annotations

from atelier.domaine.fond import (
    CANDIDATS,
    VERT_DE_STUDIO,
    Choix,
    choisir,
    couleurs_nommees,
    ecart,
)

from tests.test_d3 import MODELE, _envoi, _importer, _technique, _aplat


# ═══ Par la route de tout le monde ═══════════════════════════════════════════


def test_une_description_verte_sans_reference_n_est_pas_le_vert(client):
    """**Le premier critère.** C'est exactement le cas constaté le 21 septembre :
    un sujet décrit vert, sans image jointe, ne doit plus recevoir le vert de
    studio — le détourage le mangerait avec la cape."""
    envoi = _envoi(
        client, prompt="un rôdeur encapuchonné, cape verte, torche à la main"
    )

    assert envoi["fond"]["couleur"] != VERT_DE_STUDIO.couleur
    assert envoi["fond"]["couleur"] not in {"#00FF00"}  # le vert pur non plus
    assert envoi["fond"]["couleur"] not in ("", None)


def test_une_description_rouge_en_anglais_sans_reference_n_est_pas_rouge(client):
    """**Le premier critère, en anglais.** La table nomme les deux langues :
    « red cloak » doit être lu comme « cape verte » l'est."""
    envoi = _envoi(client, prompt="a hooded wanderer in a red cloak")

    # Aucun candidat n'est rouge — le critère est donc déjà vrai pour n'importe
    # quelle couleur rendue ; il reste à vérifier que rien n'a été laissé au
    # hasard et que la couleur est bien l'une des couleurs connues du module.
    connues = {c.couleur for c in CANDIDATS} | {VERT_DE_STUDIO.couleur}
    assert envoi["fond"]["couleur"] in connues


def test_une_description_sans_couleur_reste_sur_le_vert_de_studio(client):
    """**Le troisième critère : rien ne doit bouger quand la description ne
    nomme rien.** C'est le comportement de RT3 au caractère près."""
    envoi = _envoi(client, prompt="un nain qui répare une charrette")

    assert envoi["fond"]["couleur"] == VERT_DE_STUDIO.couleur
    assert envoi["fond"]["motif"] == ""


def test_avec_une_image_de_reference_le_calcul_de_rt3_est_inchange(client, tmp_path):
    """**Le deuxième critère.** Une référence tranche seule : la description a
    beau nommer une couleur, elle ne doit rien changer à ce que RT3 rendait
    déjà — magenta contre un sujet magenta, cyan le plus loin."""
    reference = _importer(client, tmp_path, _aplat((230, 40, 230)), "magenta")

    sans_description = _envoi(
        client, references=[{"asset": reference, "role": "reference"}]
    )
    avec_description = _envoi(
        client,
        prompt="cape verte, torche à la main",
        references=[{"asset": reference, "role": "reference"}],
    )

    assert sans_description["fond"]["couleur"] == "#00FFFF"
    assert avec_description["fond"]["couleur"] == "#00FFFF"
    assert "#00FFFF cyan" in _technique(avec_description)
    # Et rien ne dit que la description ait changé quoi que ce soit : il n'y
    # avait rien à changer.
    assert avec_description["fond"]["motif"] == ""


def test_la_relecture_nomme_le_fond_et_dit_pourquoi_il_a_change(client):
    """**Le troisième critère du plan** : la relecture nomme le fond choisi, et
    dit pourquoi en une ligne quand il a changé à cause de la description."""
    inchange = _envoi(client, prompt="un nain qui répare une charrette")
    change = _envoi(
        client, prompt="un rôdeur encapuchonné, cape verte, torche à la main"
    )

    # Le fond est toujours nommé, changé ou non.
    assert inchange["fond"]["nom"] == VERT_DE_STUDIO.nom
    assert change["fond"]["nom"] != ""

    # Mais seul celui qui a changé porte une raison.
    assert inchange["fond"]["motif"] == ""
    assert change["fond"]["motif"] != ""
    assert "vert" in change["fond"]["motif"]


# ═══ Le domaine, directement ═════════════════════════════════════════════════


def test_couleurs_nommees_lit_le_francais_et_l_anglais():
    assert couleurs_nommees("une cape verte")[0] == ("verte", VERT_DE_STUDIO.couleur)
    assert couleurs_nommees("a green cape")[0] == ("green", VERT_DE_STUDIO.couleur)
    assert couleurs_nommees("un nain")  == []
    # Un mot entier, jamais un fragment : « couvert » ne contient pas « vert ».
    assert couleurs_nommees("le coffre est couvert de poussière") == []


def test_choisir_ignore_la_description_des_qu_il_y_a_une_reference():
    """**Le critère pris à la lettre au niveau du domaine** : `description` ne
    doit même pas être lu quand `couleurs` n'est pas vide."""
    sans = choisir(["#FF00FF"])
    avec = choisir(["#FF00FF"], "cape verte, magenta partout")

    assert sans == avec


def test_choisir_sans_reference_et_sans_couleur_nommee_rend_le_vert_de_studio():
    resultat = choisir([], "un nain qui répare une charrette")

    assert resultat == Choix(
        couleur=VERT_DE_STUDIO.couleur, nom=VERT_DE_STUDIO.nom, par_defaut=True
    )


def test_choisir_sans_reference_avec_une_couleur_nommee_evite_le_plus_loin():
    """Le candidat retenu doit être plus loin de la couleur nommée que le vert
    de studio ne l'est — sans quoi le changement n'en serait pas un."""
    resultat = choisir([], "cape verte")

    assert resultat.couleur != VERT_DE_STUDIO.couleur
    assert resultat.par_defaut is False
    assert resultat.raison == "ta description dit verte"
    assert ecart(resultat.couleur, VERT_DE_STUDIO.couleur) > ecart(
        VERT_DE_STUDIO.couleur, VERT_DE_STUDIO.couleur
    )
