# -*- coding: utf-8 -*-
"""RG1 — une nature dit ce qu'elle peut (`docs/PLAN-rangement.md`, décision D1).

Le trou que ce socle répare : la page d'un sujet de nature « matière » ouvrait sur un
onglet *Animations*, avec un filtre *Direction*, et écrivait juste dessous « Ce type
d'objet ne réclame aucune pose ». L'écran proposait ce qu'il venait de déclarer
impossible, parce que rien dans le domaine ne savait répondre « cette nature a-t-elle
des directions / des animations / des sons / sert-elle de matière ? » — seules la
découpe et les poses étaient déclarées. Ces essais-ci ne touchent aucun écran (RG2) :
ils prouvent seulement que le socle répond juste, avant qu'on bâtisse dessus.
"""
from atelier.domaine.plan import (
    CAPACITES_PAR_NATURE,
    PLANS_PAR_TYPE,
    SANS_POSES,
    Capacites,
    capacites_de,
)
from atelier.domaine.projet import BAREME_PAR_DEFAUT


def test_la_table_de_d1_est_celle_du_plan_au_mot_pres():
    """Recopiée depuis `docs/PLAN-rangement.md` § D1 — pas réinventée ici."""
    attendue = {
        "personnage": Capacites(True, True, True, False),
        "créature": Capacites(True, True, True, False),
        "meuble": Capacites(False, True, True, False),
        "objet posé": Capacites(False, False, True, False),
        "objet tenu": Capacites(False, False, True, False),
        "décor": Capacites(False, True, True, False),
        "tuile": Capacites(False, True, False, False),
        "matière": Capacites(False, False, False, True),
        "élément d'interface": Capacites(False, True, True, False),
    }
    assert CAPACITES_PAR_NATURE == attendue


def test_seule_la_matiere_sert_de_matiere():
    assert [n for n, c in CAPACITES_PAR_NATURE.items() if c.matiere] == ["matière"]


def test_une_matiere_n_a_ni_directions_ni_animation_ni_sons():
    """C'est le symptôme mesuré le 20 septembre 2026 : une matière ne s'anime pas
    (D2 — c'est le jeu de tuiles qui l'anime, TU2), ne se décline pas en directions
    et ne porte pas de sons. La table doit le dire sans qu'un écran ait à le deviner."""
    c = capacites_de("matière")
    assert c.directions is False and c.anime is False and c.sons is False


def test_une_nature_inconnue_prend_les_reponses_d_un_decor():
    """L'auteur écrit une nature à la main dans Réglages, jamais vue par le produit :
    D1 dit qu'elle prend les réponses d'un décor. Prouvé plutôt que supposé — on
    compare à l'objet, pas seulement champ par champ, pour que la table de secours
    ne diverge jamais en silence de l'entrée « décor »."""
    nature_ecrite_a_la_main = "champignon géant"
    assert nature_ecrite_a_la_main not in CAPACITES_PAR_NATURE
    assert capacites_de(nature_ecrite_a_la_main) == capacites_de("décor")


def test_les_deux_capacites_existantes_ne_sont_pas_recopiees():
    """`se découpe` et `poses` vivent déjà dans `Echelle.silhouette` et
    `PLANS_PAR_TYPE`/`SANS_POSES` : cette tranche ne les redéclare pas dans
    `Capacites`, sous peine de bientôt raconter deux histoires différentes."""
    champs = set(Capacites.__dataclass_fields__)
    assert champs == {"directions", "anime", "sons", "matiere"}

    # « Se découpe » et « poses » restent lisibles là où elles vivaient déjà —
    # la matière, entre autres, ne se découpe pas et n'a aucune pose (TU2).
    matiere = next(e for e in BAREME_PAR_DEFAUT if e.nom == "matière")
    assert matiere.silhouette is False
    assert PLANS_PAR_TYPE["matière"] == () and "matière" in SANS_POSES
