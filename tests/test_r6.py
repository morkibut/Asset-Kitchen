# -*- coding: utf-8 -*-
"""Les critères d'acceptation de R6 — la planche qui revient de travers.

Un test par critère de `docs/archive/plan-r6-a-v3.02.md` § R6, nommé d'après lui.

**Deux défauts, un seul geste.** Le premier jetait de l'argent en le disant :
une planche qui rendait neuf sujets pour huit était refusée entière et se
relançait au prix plein — quatre planches sur treize du banc d'animation, soit
trente-et-un pour cent des appels perdus sur un geste dont c'est le régime
normal. Le second en jetait plus et ne le disait pas : quand un modèle redessine
les traits du quadrillage, le remplissage depuis le bord s'arrête sur eux, le
fond de chaque case reste opaque, le compte tombe juste, et l'atelier faisait
entrer des carrés dont les deux tiers sont du fond.

Les deux se règlent pareil, et c'est le point de la tranche : **jamais un refus,
toujours un regard.** La planche est payée et complète ; ce qui manquait n'était
qu'une décision.

**Aucun test de ce fichier ne coûte un centime.** Le double rend des planches
bâties par `conftest` — `planche_sujets` pour une planche saine,
`planche_quadrillee` pour celle qui a redessiné ses cases —, et deux d'entre eux
comptent les appels du fournisseur pour prouver que trancher ne repaie rien.

Le dernier lit les **vraies planches des bancs** et se saute quand elles ne sont
pas sur le disque : `essais/resultats_*/` n'est pas suivi par git.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from conftest import planche_quadrillee, planche_sujets
from test_c2 import (
    _ajouter_pose,
    _attendre,
    _cases,
    _creer,
    _grille,
    _lancer,
    _lot,
    _plan,
)

BANCS = Path(__file__).resolve().parent.parent / "essais"


def _nes(client, lot) -> list[dict]:
    """Ce que le dépliage de ce lot a fait entrer — **ses morceaux, pas sa
    planche**.

    Depuis `G16` la feuille entre elle aussi en bibliothèque, à son propre rang.
    Ces essais-ci comptent ce qui *sort* d'elle — huit sujets pour neuf revenus,
    l'écarté qui reste dehors, le coût nul de chaque morceau —, et aucun de ces
    comptes ne doit bouger d'un cran parce que la feuille est devenue visible.

    Les assertions « rien n'est entré » d'avant le choix, elles, gardent la
    grille entière : c'est là qu'on vérifie que **la planche non plus** n'entre
    pas tant que l'auteur n'a pas tranché.
    """
    return [
        a
        for a in _grille(client)
        if a["generation"] == lot["identifiant"] and a["rang"] >= 100
    ]


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _huit_poses(client) -> list[str]:
    """Huit, parce que c'est le nombre des deux premiers critères.

    Le plan par défaut en compte cinq ; on le monte à huit avec des attitudes
    qui existent déjà dans le vocabulaire du produit.
    """
    for nom in ("saut", "grimpe", "chute", "victoire", "traîne"):
        if len(_plan(client)) >= 8:
            break
        _ajouter_pose(client, nom)
    plan = _plan(client)
    assert len(plan) == 8, f"le plan par défaut a changé de taille : {len(plan)}"
    return [p["identifiant"] for p in plan]


def _planche_de(client, personnage: str, poses: list[str]) -> dict:
    return _lot(client, personnage["identifiant"], poses)


def _ecarter(client, lot: dict, ecartees: list[int]):
    return client.post(
        f"/api/generations/{lot['identifiant']}/slots/0/unfold",
        json={"ecartees": ecartees},
    )


def _pliage(client, lot: dict) -> dict:
    return client.get(f"/api/generations/{lot['identifiant']}").json()["pliage"]


# ── « Une planche à neuf sujets pour huit demandés entre, avec le choix de la
#     case à écarter » (US-367) ───────────────────────────────────────────────


def test_neuf_sujets_pour_huit_entrent_apres_le_choix(client, double):
    """Le critère principal de la tranche, et il se lit en trois temps.

    **La planche s'arrête** — elle est réussie, elle n'est pas entrée, et elle
    dit ce qu'elle attend. **L'auteur écarte** un sujet, celui qu'il veut.
    **Les huit autres entrent**, un par case, sans qu'un centime reparte.
    """
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    poses = _huit_poses(client)
    lot = _planche_de(client, personnage, poses)

    assert lot["statut"] == "reussie", "la planche est arrivée entière et payée"
    assert lot["pliage"]["attend_un_choix"] is True
    assert lot["pliage"]["trouvees"] == 9
    assert lot["pliage"]["surplus"] == 1
    assert lot["pliage"]["ecartees"] is None, "personne n'a encore tranché"
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []

    avant = double.appels
    reponse = _ecarter(client, lot, [4])
    assert reponse.status_code == 200, reponse.text

    assert double.appels == avant, "trancher est local et gratuit"
    nes = _nes(client, lot)
    assert len(nes) == 8
    assert all(len(c["images"]) == 1 for c in _cases(client, personnage["identifiant"]))

    apres = _pliage(client, lot)
    assert apres["ecartees"] == [4]
    assert apres["attend_un_choix"] is False, "la question ne se repose jamais"
    assert apres["refus"] is None, "rien n'a été refusé"


def test_le_choix_designe_bien_le_sujet_ecarte(client, double):
    """**Écarter le n° 4 doit écarter le n° 4**, pas le dernier de la liste.

    C'est ce qui distingue le geste de R6 d'un simple « prends-en huit » : les
    sujets en trop d'une vraie planche ne sont pas les derniers en ordre de
    lecture — le modèle complète la grille là où il reste de la place. Le test
    le vérifie sur la boîte que chaque image dit avoir occupée : celle du sujet
    écarté n'apparaît chez aucune des huit qui entrent.
    """
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    boites = [tuple(m["boite"]) for m in lot["pliage"]["mesures"]]
    assert len(boites) == 9

    assert _ecarter(client, lot, [2]).status_code == 200

    gardees = {tuple(a["lot"]["boite"]) for a in _nes(client, lot)}
    assert len(gardees) == 8
    assert boites[2] not in gardees, "le sujet désigné est celui qui reste dehors"
    assert gardees == {b for i, b in enumerate(boites) if i != 2}


def test_les_mesures_des_images_entrees_portent_sur_les_gardees(client, double):
    """La ressemblance dit *« avec une autre case **du lot** »*, et le lot est
    celui des huit qui entrent.

    Recopier les chiffres des neuf ferait dire à un corps qu'il ressemble à une
    case qui n'est jamais entrée — un jumeau introuvable dans la bibliothèque.
    """
    double.rendre = lambda: planche_sujets(9, jumelles=True)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    assert _ecarter(client, lot, [8]).status_code == 200

    nes = _nes(client, lot)
    assert len(nes) == 8
    for asset in nes:
        assert asset["lot"]["cases"] == 8, "le lot est celui des huit gardées"
        assert 0 <= asset["lot"]["jumeau"] < 8, "un jumeau se retrouve en bibliothèque"


# ── « Une planche à sept sujets pour huit demandés reste refusée — il y manque
#     une étape » (US-367) ────────────────────────────────────────────────────


def test_sept_sujets_pour_huit_restent_refuses(client, double):
    """**Le seul refus automatique qui reste**, et sa raison dit pourquoi il n'a
    pas d'issue : aucun choix de l'auteur ne fabriquera l'étape qui manque."""
    double.rendre = lambda: planche_sujets(7)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    assert lot["statut"] == "echouee"
    raison = lot["emplacements"][0]["raison"]
    assert "7 images pour 8 demandées" in raison
    assert "il en manque 1" in raison
    assert "aucun choix ne les fabriquera" in raison
    assert lot["pliage"]["attend_un_choix"] is False, "il n'y a rien à choisir"
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []


def test_une_planche_refusee_dit_quand_meme_ce_qu_elle_portait(client, double):
    """Le refus n'efface pas la mesure. Sept sujets, sept mesures — sans quoi le
    journal du refus n'apprendrait rien à qui le relit six mois après."""
    double.rendre = lambda: planche_sujets(7)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    assert lot["pliage"]["trouvees"] == 7
    assert len(lot["pliage"]["mesures"]) == 7


def test_ecarter_de_trop_ne_marque_rien_en_echec(client, double):
    """**Ce n'est pas la planche qui est en faute, c'est le choix.**

    Écarter deux sujets d'une planche qui n'en a qu'un en trop laisserait sept
    images pour huit cases. La décision est reprise, la planche reste où elle
    est, et l'auteur peut en poser une autre — rien n'est marqué en échec, rien
    ne se relance, rien n'est entré.
    """
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    reponse = _ecarter(client, lot, [0, 1])
    assert reponse.status_code == 400, reponse.text

    apres = client.get(f"/api/generations/{lot['identifiant']}").json()
    assert apres["statut"] == "reussie"
    assert apres["emplacements"][0]["raison"] is None
    assert apres["pliage"]["ecartees"] is None, "la question reste ouverte"
    assert apres["pliage"]["attend_un_choix"] is True
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []

    assert _ecarter(client, lot, [1]).status_code == 200, "et le bon choix passe"
    assert len(_nes(client, lot)) == 8


def test_un_numero_qui_n_existe_pas_est_refuse_en_francais(client, double):
    """La planche a rendu neuf sujets : il n'y a pas de n° 12. Le refus le dit
    avec les deux nombres, comme tous les refus du produit."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    reponse = _ecarter(client, lot, [11])
    assert reponse.status_code == 400
    assert "9 sujets" in reponse.json()["raison"]
    assert "n° 12" in reponse.json()["raison"]


# ── « Le taux de remplissage de chaque sujet est mesuré et affiché avant
#     l'entrée en bibliothèque » (US-368) ─────────────────────────────────────


def test_le_remplissage_est_mesure_avant_toute_entree_en_bibliotheque(client, double):
    """**Avant**, au pied de la lettre : au moment où l'écran lit ces chiffres,
    aucun asset n'existe pour les porter. C'est pour ça qu'ils sont sur le
    pliage, avec la boîte de chaque sujet — l'écran découpe la planche dans son
    coin et montre les neuf, sans redemander au serveur ce qu'il vient de
    mesurer."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []
    mesures = lot["pliage"]["mesures"]
    assert len(mesures) == 9
    for index, mesure in enumerate(mesures):
        assert mesure["case"] == index
        assert 0.0 < mesure["remplissage"] < 1.0
        assert mesure["pleine"] is False
        x0, y0, x1, y1 = mesure["boite"]
        assert x1 > x0 and y1 > y0, "une boîte a une largeur et une hauteur"


def test_le_remplissage_suit_chaque_image_en_bibliotheque(client, double):
    """Et il ne s'arrête pas à l'entrée : la ligne de la matrice le porte, comme
    la ressemblance et la dérive de grille depuis C2."""
    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    nes = _nes(client, lot)
    assert len(nes) == 8
    assert all(0.0 < a["lot"]["remplissage"] < 0.9 for a in nes)
    assert all(a["lot"]["pleine"] is False for a in nes)


# ── « Une planche au quadrillage redessiné est signalée en toutes lettres,
#     jamais acceptée en silence » (US-368) ───────────────────────────────────


def test_une_planche_quadrillee_est_annoncee_en_toutes_lettres(client, double):
    """**Le compte tombe juste, et c'est tout le piège** : huit cases bordées
    font huit taches opaques, et rien dans l'arithmétique ne les distingue de
    huit personnages. Ce qui les distingue est qu'elles remplissent leur boîte.

    La planche s'arrête donc, et la phrase nomme la chose : *le quadrillage que
    le modèle a redessiné, pas un personnage*.
    """
    double.rendre = lambda: planche_quadrillee(8)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    assert lot["statut"] == "reussie"
    assert lot["pliage"]["trouvees"] == 8, "le compte est juste — c'est le piège"
    assert lot["pliage"]["surplus"] == 0
    assert lot["pliage"]["attend_un_choix"] is True
    assert lot["pliage"]["pleines"] == list(range(8))
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []

    assert all(m["pleine"] is True for m in lot["pliage"]["mesures"])
    assert all(m["remplissage"] >= 0.9 for m in lot["pliage"]["mesures"])


def test_une_planche_saine_n_a_rien_a_faire_signer(client, double):
    """**Le cas ordinaire ne gagne pas un clic**, et c'est la contrepartie du
    critère précédent : huit sujets pour huit cases, aucun carré plein, la
    planche entre comme elle est entrée depuis C2."""
    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    assert lot["statut"] == "reussie"
    assert lot["pliage"]["attend_un_choix"] is False
    assert lot["pliage"]["pleines"] == []
    assert len(_nes(client, lot)) == 8


def test_garder_tout_est_une_decision_qui_se_pose(client, double):
    """Une planche quadrillée peut s'accepter — mais **explicitement**.

    La liste vide est une réponse, pas une absence de réponse : c'est ce qui
    fait entrer huit carrés pleins *après* que quelqu'un les a vus, ce qui est
    exactement ce que « jamais acceptée en silence » demande.
    """
    double.rendre = lambda: planche_quadrillee(8)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    assert _ecarter(client, lot, []).status_code == 200
    nes = _nes(client, lot)
    assert len(nes) == 8
    assert all(a["lot"]["pleine"] is True for a in nes), "et elles le disent encore"

    apres = _pliage(client, lot)
    assert apres["ecartees"] == []
    assert apres["attend_un_choix"] is False


def test_une_planche_deja_depliee_ne_se_retranche_pas(client, double):
    """Redéplier créerait N assets de plus à des rangs neufs, et il faudrait
    supprimer les anciens — or un calque désigne son corps par identifiant.
    Même refus que `recaler` en C3, et pour la raison exacte."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    assert _ecarter(client, lot, [0]).status_code == 200

    reponse = _ecarter(client, lot, [1])
    assert reponse.status_code == 400
    assert "déjà rendu ses images" in reponse.json()["raison"]
    assert len(_nes(client, lot)) == 8


# ── « L'appel payé reste au journal avec son coût, refus ou non » (US-24) ─────


def test_l_appel_paye_reste_au_journal_dans_les_trois_cas(client, double):
    """Refusé, en attente, ou entré : le coût est le même et il est écrit.

    C'est l'invariant de T1 — *une dépense ne s'efface jamais* —, et R6 ajoute
    un état où il pourrait se perdre : une planche qui attend n'a rien produit,
    et rien ne dirait ce qu'elle a coûté si le journal ne la portait pas.
    """
    personnage = _creer(client)
    poses = _huit_poses(client)

    double.rendre = lambda: planche_sujets(7)
    refuse = _planche_de(client, personnage, poses)
    assert refuse["statut"] == "echouee"
    assert refuse["cout_usd"] == 0.0245

    double.rendre = lambda: planche_sujets(9)
    attend = _planche_de(client, personnage, poses)
    assert attend["pliage"]["attend_un_choix"] is True
    assert attend["cout_usd"] == 0.0245

    assert _ecarter(client, attend, [0]).status_code == 200
    apres = client.get(f"/api/generations/{attend['identifiant']}").json()
    assert apres["cout_usd"] == 0.0245, "trancher ne change pas ce qui a été payé"

    total = client.get("/api/generations").json()["total_usd"]
    assert total == pytest.approx(0.049), "les deux appels comptent, pas un seul"


def test_une_image_depliee_n_a_toujours_rien_coute_seule(client, double):
    """L'argent a été dépensé une fois, pour l'appel. Écarter n'en redistribue
    pas une part sur les images qui restent — le total du projet se calcule sur
    les générations, et il dirait autre chose que la somme des tuiles."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    assert _ecarter(client, lot, [3]).status_code == 200

    nes = _nes(client, lot)
    assert len(nes) == 8
    assert all(a["cout_usd"] == 0.0 for a in nes)


# ── La reprise au démarrage ──────────────────────────────────────────────────


def test_une_planche_qui_attend_survit_a_la_fermeture(client, double, tmp_path):
    """**Ce que l'arrivée a mesuré est sur le disque**, pas seulement en mémoire.

    Sans ça, rouvrir l'atelier redécouperait la planche pour retomber sur la
    même question, et l'écran du choix repaierait un détourage à chaque
    ouverture. C'est aussi ce qui garantit qu'un lot en attente **n'est pas
    repris** : la reprise range ce qui est arrivé, elle ne tranche à la place de
    personne.
    """
    from atelier.services import Atelier

    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))
    assert lot["pliage"]["attend_un_choix"] is True

    rouvert = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(rouvert.ouvrir())

    relu = rouvert.generations.lire(lot["identifiant"])
    assert relu is not None and relu.pliage is not None
    assert relu.pliage.trouvees == 9
    assert len(relu.pliage.mesures) == 9
    assert relu.pliage.attend_un_choix is True, "la question tient toujours"
    assert [a for a in rouvert.assets.recents() if a.generation == lot["identifiant"]] == []


def test_un_lot_recu_mais_non_deplie_se_range_toujours_au_demarrage(client, double, tmp_path):
    """**La reprise de C2 n'a pas bougé** (US-132). Une planche saine coupée
    avant d'être rangée se range gratuitement au redémarrage, comme depuis
    toujours ; R6 n'ajoute une attente que là où il y a quelque chose à
    décider."""
    from atelier.services import Atelier

    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    racine = tmp_path
    for asset in [
        a for a in client.get("/api/assets", params={"limite": 200}).json()["assets"]
        if a["generation"] == lot["identifiant"]
    ]:
        client.request("DELETE", "/api/assets", json={"identifiants": [asset["identifiant"]]})

    rouvert = Atelier(racine=racine, fabrique_fournisseur=lambda: double)
    asyncio.run(rouvert.ouvrir())
    relu = rouvert.generations.lire(lot["identifiant"])
    assert relu is not None and relu.pliage is not None
    assert relu.pliage.attend_un_choix is False


def test_une_planche_qui_attend_reste_au_chantier(client, double, atelier):
    """**Sinon elle disparaît de l'écran, et l'appel payé avec elle.**

    Trouvé le 3 septembre 2026 en regardant l'atelier, pas en lisant le code :
    le chantier est *ce dont un emplacement attend encore une issue*, et celui
    d'une planche en attente est **réussi**. Sa tuile quittait donc la grille à
    l'arrivée, et comme rien n'était entré en bibliothèque, aucune image ne
    prenait sa place — l'auteur voyait un écran vide et n'avait plus aucun
    chemin vers ce qu'il venait de payer. C'est le gâchis silencieux que la
    tranche répare, refait à l'identique par sa propre réparation.

    Et il repart dès qu'elle est tranchée : une planche dépliée a ses images en
    bibliothèque, et le chantier n'a plus à la tenir.
    """
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    lot = _planche_de(client, personnage, _huit_poses(client))

    # Lu sur le service, parce que c'est là que le chantier se compose : la
    # route ne fait que le recopier dans le premier message du flux.
    au_chantier = lambda: [  # noqa: E731
        g.identifiant for g in atelier.generations.chantier()
    ]
    assert lot["identifiant"] in au_chantier()

    assert _ecarter(client, lot, [0]).status_code == 200
    assert lot["identifiant"] not in au_chantier(), "tranchée, elle rend sa place"


# ── « Vérifié sur une planche réelle de chaque cas » ──────────────────────────


REELLES = {
    # 8 sujets pour 8 cases, chacun bordé : le compte tombe juste, et les deux
    # tiers de chaque « sujet » sont du fond. C'est le cas que le produit
    # acceptait en silence.
    "quadrillée": ("resultats_recette/A-8-cases/jet1.png", 8, 8),
    # La même demande, le même jour, un tirage plus loin : silhouettes serrées,
    # boîtes de tailles différentes, aucun carré plein.
    "saine": ("resultats_recette/A-8-cases/jet2.png", 8, 0),
    # Le surplus, pris au banc d'animation : **le banc des recettes n'en porte
    # aucun**, ses planches en trop étant toutes quadrillées. Neuf sujets pour
    # huit demandés, et pas une case pleine — c'est bien un sujet de trop, pas
    # un morceau de grille.
    "surplus": ("resultats_animation/bytedance-seed_seedream-4.5/jet2.png", 9, 0),
}


@pytest.mark.skipif(
    not (BANCS / REELLES["quadrillée"][0]).exists(),
    reason="les planches des bancs ne sont pas suivies par git",
)
@pytest.mark.parametrize("cas", sorted(REELLES))
def test_sur_une_planche_reelle_de_chaque_cas(cas):
    """La chaîne du produit, sur les planches que les bancs ont vraiment reçues.

    **Sans client ni double** : ce qui est vérifié ici est la mesure elle-même —
    détourage par le bord, zones opaques, remplissage — sur des images qu'aucun
    essai n'a fabriquées pour lui plaire. C'est ce qui sépare un seuil mesuré
    d'un seuil choisi.

    Le relevé complet du 3 septembre 2026, sur les 95 planches du banc des
    recettes : **47 quadrillées**, remplissage de 0,99 à 1,00, entrées en
    bibliothèque sans un mot ; 32 saines à huit sujets, de 0,53 à 0,68. Les deux
    populations ne se touchent pas.
    """
    from atelier.domaine.recette import BORD, Passe, Recette
    from atelier.image import detourer, zones_opaques
    from atelier.image.pliage import mesurer_lot

    chemin, sujets, pleines = REELLES[cas]
    fichier = BANCS / chemin
    if not fichier.exists():
        pytest.skip(f"planche absente : {chemin}")

    rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), fichier.read_bytes())
    boites = zones_opaques(rgba[:, :, 3])
    mesures = mesurer_lot(rgba, boites)

    assert len(boites) == sujets, f"{chemin} porte {sujets} sujets"
    assert sum(m.pleine for m in mesures) == pleines
    if pleines:
        assert min(m.remplissage for m in mesures) >= 0.99
    else:
        assert max(m.remplissage for m in mesures) <= 0.80


# ── Le seuil lui-même ────────────────────────────────────────────────────────


def test_le_seuil_est_pose_dans_le_vide_entre_les_deux_populations():
    """0,90 n'est pas un nombre rond choisi pour faire joli.

    Sur les 135 planches des deux bancs : une planche saine remplit sa boîte de
    0,34 à 0,77, une planche quadrillée de 0,99 à 1,00. Le seuil est posé au
    milieu de l'écart, et les doubles de `conftest` tombent des deux côtés — 0,55
    pour l'une, 1,00 pour l'autre.
    """
    from atelier.domaine.pliage import SEUIL_PLEINE
    from atelier.domaine.recette import BORD, Passe, Recette
    from atelier.image import detourer, zones_opaques
    from atelier.image.pliage import mesurer_lot

    assert 0.80 < SEUIL_PLEINE < 0.99, "entre le pire des saines et la meilleure des autres"

    recette = Recette(passes=(Passe(moteur=BORD),))
    for octets, attendu in ((planche_sujets(8), False), (planche_quadrillee(8), True)):
        rgba = detourer(recette, octets)
        mesures = mesurer_lot(rgba, zones_opaques(rgba[:, :, 3]))
        assert all(m.pleine is attendu for m in mesures)


def test_le_remplissage_se_mesure_dans_la_boite_pas_dans_la_vignette():
    """**Le piège qui a failli faire écrire le mauvais chiffre.**

    Une vignette est taillée dans les octets d'origine — fond compris —, donc
    elle est opaque partout : mesurée le 3 septembre 2026 à 1,00 sur les sept
    planches d'essai, quadrillées comme saines. Elle ne sépare rien. C'est la
    boîte du sujet, prise sur l'alpha du détourage, qui dit si ce qu'on tient
    est une silhouette ou un rectangle — et ce test le prouve en faisant les
    deux mesures côte à côte sur la même planche saine.
    """
    import io

    import numpy as np
    from PIL import Image

    from atelier.domaine.recette import BORD, Passe, Recette
    from atelier.image import decouper, detourer, zones_opaques
    from atelier.image.decoupe import MARGE
    from atelier.image.pliage import mesurer_lot

    octets = planche_sujets(8)
    rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
    boites = zones_opaques(rgba[:, :, 3])

    dans_la_boite = [m.remplissage for m in mesurer_lot(rgba, boites)]
    dans_la_vignette = []
    for morceau in decouper(octets, boites, marge=MARGE):
        with Image.open(io.BytesIO(morceau)) as ouverte:
            alpha = np.array(ouverte.convert("RGBA"))[:, :, 3] > 127
        dans_la_vignette.append(float(alpha.mean()))

    assert max(dans_la_boite) < 0.9, "la boîte sépare"
    assert min(dans_la_vignette) == 1.0, "la vignette ne sépare rien"


# ── Ce que la tranche ne devait pas casser ───────────────────────────────────


def test_un_lot_refuse_se_relance_toujours_d_un_geste(client, double):
    """La relance de T1, telle quelle, sur le seul refus qui reste (US-131)."""
    double.rendre = lambda: planche_sujets(7)
    personnage = _creer(client)
    poses = _huit_poses(client)
    lot = _planche_de(client, personnage, poses)
    assert lot["statut"] == "echouee"

    double.rendre = lambda: planche_sujets(8)
    avant = double.appels
    reponse = client.post(f"/api/generations/{lot['identifiant']}/slots/0/retry")
    assert reponse.status_code == 200, reponse.text
    repris = _attendre(client, lot["identifiant"])

    assert double.appels - avant == 1, "une relance, un appel — au prix plein"
    assert repris["statut"] == "reussie"
    assert all(len(c["images"]) == 1 for c in _cases(client, personnage["identifiant"]))


def test_ecarter_sur_ce_qui_n_est_pas_une_planche_est_refuse(client, double):
    """Une génération ordinaire n'a pas de pliage, donc rien à trancher."""
    reponse = _lancer(client, "", [])
    assert reponse.status_code == 202, reponse.text
    ordinaire = _attendre(client, reponse.json()["identifiant"])

    refus = client.post(
        f"/api/generations/{ordinaire['identifiant']}/slots/0/unfold",
        json={"ecartees": []},
    )
    assert refus.status_code == 400
    assert "pas une planche" in refus.json()["raison"]
