# -*- coding: utf-8 -*-
"""Les critères d'acceptation de D1 — une recette par défaut, par nature d'image.

Un test par critère de `docs/archive/plan-r6-a-v3.02.md` § D1, nommé d'après lui.

**La mesure qui a ouvert la tranche, et celle qui l'a corrigée.** Le plan
partait d'un comptage : sur les 123 découpages écrits à la main dans ce dépôt,
64 portent un durcissement du bord quand le réglage livré est zéro — « faux plus
d'une fois sur deux » —, et l'écart se lisait entre une image seule (67 %) et un
morceau de planche (38 %). Recompté le 3 septembre 2026 **en croisant avec le
moteur employé**, cet écart-là disparaît :

| moteur    | passes | durcissement nul | valeur la plus fréquente |
|-----------|--------|------------------|--------------------------|
| `bord`    |   72   |      78 %        | **0** (56 sur 72)        |
| `couleur` |   11   |       0 %        | **1** (6 sur 11)         |
| `modele`  |   40   |       2 %        | **2** (32 sur 40)        |

À moteur égal, la nature ne décide presque plus rien — 100 % contre 93 % sur le
moteur par modèle. Le moteur, lui, décide tout, et la raison était déjà écrite à
deux pages de là sans avoir jamais été jointe à ce comptage : `bord` ne produit
aucun pixel à demi transparent, il est binaire par construction, donc il n'y a
pas de frange à ronger ; `modele` en produit sur 95 % du sujet.

**Ce que la tranche livre donc, et ce qu'elle ne livre pas.** La structure que
le plan demande — un défaut par nature d'image et par famille, visible avant de
générer, sans rien réécrire du passé — est bâtie en entier. Le *contenu* livré,
lui, suit la mesure vraie : les deux natures partent du même détourage, et c'est
**le durcissement qui voyage avec le moteur**. Le critère 3 est coché sur cette
lecture-là, et la correction est écrite dans le plan.

**Aucun test de ce fichier ne coûte un centime** : tout se joue sur le double de
`conftest` et sur des univers montés en mémoire.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from atelier.domaine.carte import DECORS, PERSONNAGES
from atelier.domaine.projet import (
    DE_LA_FAMILLE,
    DE_LA_NATURE,
    DU_PRODUIT,
    IMAGE_SEULE,
    PLANCHE,
    Echelle,
    Univers,
    passe_par_defaut,
)
from atelier.domaine.recette import (
    BORD,
    COULEUR,
    DURCISSEMENT_LIVRE,
    MODELE,
    MOTEURS,
    NOM_DU_MOTEUR,
    Passe,
    Recette,
    durcissement_livre,
    moteurs_suivis,
    passe_livree,
)

RACINE = Path(__file__).resolve().parents[1]
#: Le vocabulaire de la recette, sorti de l'ancien châssis en `B26`.
RECETTE_TS = RACINE / "interface" / "src" / "recette.ts"

#: Le modèle du double de `conftest`. Il ne facture rien et ne sort pas de la
#: machine — c'est celui que tous les essais de génération emploient.
MODELE_DOUBLE = "essai:rend-du-png"


def _univers(client) -> dict:
    return client.get("/api/universe").json()["univers"]


def _regler(client, **corps):
    reponse = client.put("/api/universe", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["univers"]


# ── Critère 1 — les deux natures se règlent séparément ───────────────────────


def test_le_defaut_d_une_image_seule_et_celui_d_une_planche_se_reglent_separement(
    client,
):
    """**Deux champs, deux réglages, et l'un ne touche pas l'autre.**

    C'est la moitié structurelle de la tranche : sans deux endroits, régler la
    planche voulait dire régler l'image seule, et l'auteur n'avait qu'une moyenne
    des deux.
    """
    univers = _regler(
        client, detourage_planche={"moteur": MODELE, "durcissement": 2}
    )

    assert univers["detourage_planche"]["moteur"] == MODELE
    assert univers["detourage_planche"]["durcissement"] == 2
    # **L'autre nature n'a pas bougé, et elle vaut toujours `null`** : jamais
    # réglée est un état, pas une passe aux valeurs du produit.
    assert univers["detourage_image"] is None

    univers = _regler(client, detourage_image={"moteur": COULEUR, "durcissement": 1})

    assert univers["detourage_image"]["moteur"] == COULEUR
    assert univers["detourage_planche"]["moteur"] == MODELE


def test_les_deux_natures_arrivent_bien_dans_la_recette_qu_on_pose():
    """La séparation ne sert à rien si la recette ne la lit pas."""
    univers = Univers(
        detourage_image=Passe(moteur=COULEUR, durcissement=1),
        detourage_planche=Passe(moteur=MODELE, durcissement=2),
    )

    (seule,) = univers.recette_de(None, IMAGE_SEULE).passes
    (morceau,) = univers.recette_de(None, PLANCHE).passes

    assert (seule.moteur, seule.durcissement) == (COULEUR, 1)
    assert (morceau.moteur, morceau.durcissement) == (MODELE, 2)


def test_ne_pas_dire_la_nature_veut_dire_image_seule():
    """**Le défaut du paramètre est celui du cas courant**, et c'est ce qui a
    permis à la tranche de n'avoir rien à changer chez la plupart des appelants :
    seuls ceux qui déplient une planche ont eu une ligne à écrire."""
    univers = Univers(detourage_image=Passe(moteur=COULEUR))

    assert univers.recette_de(None).passes == univers.recette_de(None, IMAGE_SEULE).passes


# ── Critère 2 — la famille peut porter le sien, sinon elle hérite ────────────


def test_une_famille_porte_son_propre_defaut_et_l_emporte_sur_la_nature():
    """**La famille l'emporte, et elle l'emporte en entier.**

    Un réglage de famille qui ne remplacerait que ce qu'il déclare demanderait de
    distinguer « posé à zéro » de « pas posé » sur chaque champ — quatre états de
    plus, et un écran qui doit les montrer. La règle est celle que le critère
    écrit, et c'est pour qu'elle ne surprenne jamais que la provenance sort avec
    la passe.
    """
    univers = Univers(
        detourage_planche=Passe(moteur=MODELE, durcissement=2),
        detourages={PERSONNAGES: Passe(moteur=COULEUR, durcissement=1)},
    )

    passe, origine = univers.detourage(PLANCHE, PERSONNAGES)

    assert (passe.moteur, passe.durcissement) == (COULEUR, 1)
    assert origine == DE_LA_FAMILLE


def test_sans_reglage_de_famille_elle_herite_de_celui_de_sa_nature():
    univers = Univers(
        detourage_planche=Passe(moteur=MODELE, durcissement=2),
        detourages={PERSONNAGES: Passe(moteur=COULEUR)},
    )

    passe, origine = univers.detourage(PLANCHE, DECORS)

    assert (passe.moteur, passe.durcissement) == (MODELE, 2)
    assert origine == DE_LA_NATURE


def test_sans_reglage_du_tout_c_est_le_produit_et_il_ne_manque_rien():
    """**Il n'y a jamais de trou, seulement un réglage qu'on n'a pas posé** — la
    phrase exacte du modèle par famille (US-58). `detourage` rend donc toujours
    une passe : c'est ce qui permet à l'écran de dire *voilà ce qui
    s'appliquera* avant de dépenser."""
    passe, origine = Univers().detourage(PLANCHE, PERSONNAGES)

    assert (passe.moteur, passe.durcissement) == (BORD, 0)
    assert origine == DU_PRODUIT


def test_la_famille_du_sujet_se_lit_dans_l_echelle_demandee():
    """La recette ne reçoit pas la famille : elle reçoit l'échelle, et la famille
    en fait partie. Un chemin de moins à tenir d'accord."""
    univers = Univers(detourages={DECORS: Passe(moteur=COULEUR, durcissement=1)})
    decor = Echelle("décor", DECORS, 100)

    (passe,) = univers.recette_de(decor).passes

    assert (passe.moteur, passe.durcissement) == (COULEUR, 1)


def test_une_famille_inconnue_est_refusee_par_la_porte(client):
    """**La famille se refuse, le moteur ne se refuse pas**, et les deux ont
    raison. Une clé de famille inventée est une faute d'appelant — c'est déjà la
    règle des modèles par famille. Un moteur mal orthographié, lui, arrive sans
    effet : une recette doit pouvoir s'ouvrir après qu'un moteur a changé de nom.
    """
    reponse = client.put(
        "/api/universe", json={"detourages": {"licornes": {"moteur": BORD}}}
    )

    assert reponse.status_code == 409
    assert "licornes" in reponse.json()["raison"]


def test_un_moteur_inconnu_arrive_au_bord_sans_lever():
    assert passe_par_defaut({"moteur": "tondeuse"}).moteur == BORD
    assert durcissement_livre("tondeuse") == 0


# ── Critère 3 — le défaut livré tient compte des mesures ─────────────────────


def test_le_durcissement_livre_suit_le_moteur_et_non_la_nature():
    """**La mesure du 3 septembre 2026, écrite en essai.**

    Le moteur du bord découpe net — il ne produit aucun pixel à demi transparent
    — donc il n'y a pas de frange à ronger. Le moteur par modèle en laisse une
    sur presque tout le sujet, et l'auteur l'a rongée de deux pixels 32 fois sur
    40. C'est ce que le défaut livré porte désormais.
    """
    assert DURCISSEMENT_LIVRE[BORD] == 0
    assert DURCISSEMENT_LIVRE[COULEUR] == 1
    assert DURCISSEMENT_LIVRE[MODELE] == 2

    assert passe_livree(MODELE).durcissement == 2
    assert passe_livree().moteur == BORD
    assert passe_livree().durcissement == 0


def test_changer_de_moteur_amene_son_durcissement(client, double):
    """**Le geste que l'auteur a retapé 39 fois sur 40.**

    Passer du bord au modèle laissait le durcissement à zéro : le modèle rend
    alors une frange que rien ne ronge, et il fallait la ronger à la main. Le
    produit l'amène maintenant avec le moteur.

    **Joué sur la pipette et non sur le modèle, et c'est un invariant qui
    l'impose** : cette route-ci rend une image, donc elle détoure pour de vrai,
    et le moteur par modèle chargerait `onnxruntime` dans le processus — ce que
    `tests/test_t2.py` prouve qu'il n'arrive jamais. La règle est la même pour
    les deux moteurs, et la pipette la montre sans rien allumer.
    """
    identifiant = _une_image(client, double)

    recette = _poser(client, identifiant, [{"moteur": COULEUR}])

    (passe,) = recette["passes"]
    assert passe["moteur"] == COULEUR
    assert passe["durcissement"] == DURCISSEMENT_LIVRE[COULEUR] == 1


def test_un_durcissement_choisi_a_la_main_n_est_jamais_reecrit(client, double):
    """**Un choix ne se réécrit pas**, et c'est la moitié de la règle.

    Deux façons de l'avoir choisi, et les deux protègent : le poser dans le même
    envoi que le moteur, ou l'avoir posé avant. Sans la seconde, un réglage
    d'hier serait balayé par un changement de moteur d'aujourd'hui — la panne
    que la règle existe pour éviter, à l'envers.
    """
    identifiant = _une_image(client, double)

    # Choisi dans le même envoi que le moteur.
    recette = _poser(client, identifiant, [{"moteur": COULEUR, "durcissement": 4}])
    assert recette["passes"][0]["durcissement"] == 4

    # Choisi avant : on ne bouge que le moteur, et le choix tient.
    recette = _poser(client, identifiant, [{"moteur": BORD, "durcissement": 4}])
    assert recette["passes"][0]["durcissement"] == 4


def test_le_durcissement_ne_suit_que_le_moteur_qui_change(client, double):
    """Rien d'autre ne le déclenche : régler la tolérance ne doit pas ramener le
    durcissement à la valeur livrée."""
    identifiant = _une_image(client, double)
    _poser(client, identifiant, [{"moteur": BORD, "durcissement": 3}])

    recette = _poser(client, identifiant, [{"moteur": BORD, "durcissement": 3,
                                            "tolerance": 40}])

    assert recette["passes"][0]["durcissement"] == 3


def test_une_passe_ajoutee_arrive_telle_quelle():
    """Une passe ajoutée en bout n'a pas d'avant à comparer — elle entre comme
    l'écran l'a fabriquée, sans que le produit y ajoute un chiffre."""
    avant = (Passe(moteur=BORD),)
    apres = (Passe(moteur=BORD), Passe(moteur=MODELE, durcissement=0))

    assert moteurs_suivis(avant, apres) == apres


def test_la_pipette_posee_en_changeant_de_moteur_survit():
    """**La passe qui sort est celle d'après, jamais celle d'avant.**

    Trouvé en construisant la tranche : reconstruire depuis la passe rangée
    perdait le point que le même envoi apportait — poser la pipette *est* un
    changement de moteur, et les deux arrivent ensemble.
    """
    avant = (Passe(moteur=BORD),)
    apres = (Passe(moteur=COULEUR, point=(5, 9), portee="partout"),)

    (passe,) = moteurs_suivis(avant, apres)

    assert passe.point == (5, 9)
    assert passe.portee == "partout"
    assert passe.durcissement == 1  # celui de la pipette, amené par le moteur


# ── Critère 4 — l'auteur voit quel défaut s'applique, et d'où il vient ───────


def test_l_ecran_d_envoi_dit_le_defaut_et_sa_provenance(client):
    """« Je veux voir quel défaut va s'appliquer et d'où il vient, **avant** de
    générer, afin de ne pas le découvrir sur l'image revenue » (US-410)."""
    _regler(client, detourage_image={"moteur": MODELE, "durcissement": 2})

    ligne = _ligne_de_detourage(client, cases=0)

    assert "modèle" in ligne["detail"]
    assert "2 px" in ligne["detail"]
    assert "une image seule" in ligne["detail"]


def test_l_ecran_d_envoi_annonce_le_defaut_de_la_planche_quand_l_appel_est_plie(
    client,
):
    """**Un appel plié rend une planche, et ce sont ses morceaux qui entreront.**

    C'est donc leur défaut qu'il faut annoncer : sans ça, l'écran promettrait un
    réglage que rien n'appliquera.
    """
    _regler(
        client,
        detourage_image={"moteur": COULEUR, "durcissement": 1},
        detourage_planche={"moteur": MODELE, "durcissement": 2},
    )

    ligne = _ligne_de_detourage(client, cases=4)

    assert "morceau de planche" in ligne["detail"]
    assert "modèle" in ligne["detail"]


def test_sans_reglage_l_ecran_dit_que_c_est_le_reglage_livre(client):
    """**« Le réglage livré » est une réponse complète, pas un aveu de trou.**"""
    ligne = _ligne_de_detourage(client, cases=0)

    assert ligne["detail"] == "bord · le réglage livré"


def test_la_fiche_dit_la_nature_de_l_image_et_d_ou_vient_son_detourage(
    client, double
):
    """La même provenance, relue après coup sur l'image elle-même — et lue par
    le même chemin, pour que les deux écrans ne puissent pas se contredire."""
    _regler(client, detourage_image={"moteur": COULEUR, "durcissement": 1})
    identifiant = _une_image(client, double)

    recu = client.get(f"/api/assets/{identifiant}/imposed").json()

    assert recu["nature"] == IMAGE_SEULE
    assert recu["detourage"]["origine"] == DE_LA_NATURE
    assert recu["detourage"]["passe"]["moteur"] == COULEUR


def test_une_image_entree_telle_quelle_n_a_pas_de_defaut_a_montrer(client):
    """**`null` plutôt que le défaut du produit** : montrer celui-ci ferait
    croire qu'il s'applique, alors qu'une image entrée telle quelle n'a pas de
    recette du tout (US-170)."""
    identifiant = _une_image_entree_telle_quelle(client)

    recu = client.get(f"/api/assets/{identifiant}/imposed").json()

    assert recu["detourage"] is None


# ── Critère 5 — un défaut modifié ne touche à aucune recette déjà écrite ─────


def test_un_defaut_modifie_ne_touche_a_aucune_recette_deja_ecrite(client, double):
    """**Le non destructif tient**, et il tient sans effort : un défaut n'est lu
    qu'à la naissance d'une image. Rien ne le rejoue ensuite."""
    identifiant = _une_image(client, double)
    avant = client.get(f"/api/assets/{identifiant}").json()["recette"]

    _regler(client, detourage_image={"moteur": COULEUR, "durcissement": 4})

    apres = client.get(f"/api/assets/{identifiant}").json()["recette"]
    assert apres == avant


def test_retirer_un_defaut_le_remet_au_produit(client):
    """**`null` veut dire « remets-le au produit »**, et c'est la seule exception
    de ce corps. Sans une valeur qui dise *je n'en veux plus*, un réglage posé
    une fois ne pourrait jamais être retiré, seulement remplacé."""
    _regler(client, detourage_image={"moteur": MODELE, "durcissement": 2})

    univers = _regler(client, detourage_image=None)

    assert univers["detourage_image"] is None


def test_ne_pas_envoyer_le_champ_ne_touche_a_rien(client):
    """**« Ne touche pas » est *ne pas envoyer le champ*.** Régler la palette ne
    doit pas effacer le détourage — c'est la règle du barème (E9), appliquée aux
    trois champs qui emploient `null` pour vouloir dire quelque chose."""
    _regler(client, detourage_planche={"moteur": MODELE, "durcissement": 2})

    univers = _regler(client, couleurs=12)

    assert univers["detourage_planche"]["moteur"] == MODELE


def test_un_defaut_ne_porte_jamais_ce_qui_appartient_a_une_image(client):
    """**Le point de la pipette, le tracé et le masquage sont retirés à l'entrée.**

    Appliqué à la première image venue, un point désignerait un pixel qui n'a
    rien à voir. Le corps de la route ne les propose même pas ; le domaine les
    retire quand même, parce que c'est le seul passage obligé entre un fichier et
    un univers — et un fichier peut être écrit à la main.
    """
    nettoyee = passe_par_defaut(
        {
            "moteur": COULEUR,
            "durcissement": 1,
            "point": [5, 9],
            "portee": "partout",
            "trace": [[1, 1], [2, 2]],
            "masquee": True,
        }
    )

    assert nettoyee.point is None
    assert nettoyee.trace == ()
    assert nettoyee.masquee is False
    assert nettoyee.portee == "tache"
    # Ce qui est un vrai réglage, lui, traverse.
    assert (nettoyee.moteur, nettoyee.durcissement) == (COULEUR, 1)


# ── Critère 6 — une recette écrite avant s'ouvre et rend ce qu'elle rendait ──


def test_un_univers_ecrit_avant_la_tranche_s_ouvre_et_decide_comme_avant():
    """**L'absence des champs veut dire *jamais réglé*.** C'est ce qui fait
    qu'un projet d'avant D1 pose exactement la recette qu'il posait."""
    ancien = Univers.depuis_json({"cible_px": 64, "couleurs": 24})

    assert ancien.detourage_image is None
    assert ancien.detourage_planche is None
    assert ancien.detourages == {}

    (passe,) = ancien.recette_de(None).passes
    assert passe == Passe()  # le défaut du produit, inchangé


def test_une_recette_ecrite_avant_la_tranche_rend_ce_qu_elle_rendait():
    """Une passe relue d'un fichier d'avant ne gagne aucun durcissement : la
    règle du moteur ne s'applique qu'au moment où l'auteur **change** le moteur.
    """
    ancienne = Recette.depuis_json(
        {"passes": [{"moteur": MODELE, "durcissement": 0}]}
    )

    (passe,) = ancienne.passes
    assert passe.durcissement == 0


def test_un_univers_fait_l_aller_retour_sans_rien_perdre():
    univers = Univers(
        detourage_image=Passe(moteur=COULEUR, durcissement=1),
        detourage_planche=Passe(moteur=MODELE, durcissement=2, tolerance=40),
        detourages={PERSONNAGES: Passe(moteur=BORD, durcissement=3)},
    )

    relu = Univers.depuis_json(json.loads(json.dumps(univers.en_json())))

    assert relu.detourage_image == univers.detourage_image
    assert relu.detourage_planche == univers.detourage_planche
    assert relu.detourages == univers.detourages


# ── Ce que deux listes doivent se dire ───────────────────────────────────────


def test_le_nom_des_moteurs_est_le_meme_des_deux_cotes():
    """**Deux listes pour un fait finissent toujours par diverger** — la leçon
    des sept crans contre neuf (E8). L'essai lit la source de l'écran plutôt que
    de recopier les quatre noms : une troisième copie serait la panne qu'on ferme
    ici."""
    ecrit = re.search(
        r'export const MOTEUR: Record<Passe\["moteur"\], string> = \{([^}]*)\}',
        RECETTE_TS.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, "MOTEUR a été renommée ou déplacée hors de recette.ts"

    lus = dict(re.findall(r'(\w+): "([^"]*)"', ecrit.group(1)))

    assert lus == NOM_DU_MOTEUR


def test_le_durcissement_livre_est_le_meme_des_deux_cotes():
    """L'écran fabrique le défaut d'un moteur au moment où on le choisit ; le
    serveur le fabrique à la naissance d'une image. Deux tables qui divergeraient
    feraient deux produits."""
    ecrit = re.search(
        r'export const DURCISSEMENT_LIVRE: Record<Passe\["moteur"\], number> = \{([^}]*)\}',
        RECETTE_TS.read_text(encoding="utf-8"),
    )
    assert ecrit is not None, "DURCISSEMENT_LIVRE a quitté recette.ts"

    lus = {m: int(v) for m, v in re.findall(r"(\w+): (\d+)", ecrit.group(1))}

    assert lus == DURCISSEMENT_LIVRE
    assert set(lus) == set(MOTEURS)


# ── Ce que les essais ont besoin de savoir faire ─────────────────────────────


def _une_image(client, double) -> str:
    """Une image générée, et son identifiant. Le double ne facture rien."""
    from tests.test_c2 import _attendre  # noqa: PLC0415

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE_DOUBLE,
            "prompt": "un tonneau",
            "echelle": "objet posé",
        },
    )
    assert reponse.status_code == 202, reponse.text
    generation = _attendre(client, reponse.json()["identifiant"])
    assert generation["statut"] == "reussie", generation
    return f"{generation['identifiant']}-0"


def _une_image_entree_telle_quelle(client) -> str:
    """Une image importée **sans traitement** (US-170, R3).

    La décision est portée par la génération d'import, pas par un réglage
    d'écran : elle survit à l'effacement de l'index, et elle vaut pour l'agent
    comme pour l'auteur. C'est ce qui fait qu'il n'y a rien à imposer à cette
    image-là — donc rien à montrer.
    """
    from conftest import image_sujet  # noqa: PLC0415

    reponse = client.post(
        "/api/assets/upload",
        content=image_sujet(toile=200),
        params={"nom": "reference.png"},
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def _poser(client, identifiant: str, passes: list[dict]) -> dict:
    """Poser les places d'une recette, comme l'écran des tables le fait."""
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={"passes": passes},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["recette"]


def _ligne_de_detourage(client, *, cases: int) -> dict:
    """La ligne « détourer le fond » de l'écran qui confirme avant de dépenser."""
    corps: dict = {
        "modele": MODELE_DOUBLE,
        "prompt": "un tonneau",
        "echelle": "objet posé",
    }
    if cases >= 2:
        # **Une planche part quand plusieurs attitudes partent ensemble** :
        # c'est le pliage, et c'est lui qui fait de l'appel une planche.
        from tests.test_c2 import _creer, _plan  # noqa: PLC0415

        personnage = _creer(client)
        corps["personnage"] = personnage["identifiant"]
        corps["poses"] = [p["identifiant"] for p in _plan(client)][:cases]
    reponse = client.post("/api/outgoing", json=corps)
    assert reponse.status_code == 200, reponse.text
    lignes = reponse.json()["retour"]
    trouvees = [l for l in lignes if l["nom"] == "détourer le fond"]
    assert trouvees, f"aucune ligne de détourage dans {lignes}"
    return trouvees[0]
