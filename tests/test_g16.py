# -*- coding: utf-8 -*-
"""Les critères d'acceptation de G16 — ce qui est revenu du modèle se voit, et
se reprend à la main.

**La remarque qui l'a ouverte**, le 3 septembre 2026 : *« lorsque je crée un
équipement, je ne peux pas voir l'image générée […] et le brut semble prendre
souvent le calque déjà découpé »*. Trois manques distincts sous une seule
phrase, et cette tranche les prend ensemble parce qu'ils reposent tous sur la
même image : celle que le modèle a renvoyée.

**Aucun essai ne coûte un centime.** Le double de `conftest.py` habille la
planche à partir des octets réellement reçus, comme en C3 — un double qui
redessinerait la planche de son côté ne prouverait rien du recalage qu'on
défait ici. Deux essais **comptent les appels** avant et après : c'est ainsi que
« tout se recalcule de ce qui est déjà payé » se prouve.
"""

from __future__ import annotations

from test_c3 import (
    _corps,
    _habiller,
    _personnage,
    _piece,
)


def _grille(client) -> list[dict]:
    return client.get("/api/assets", params={"limite": 200}).json()["assets"]


def _monter(client, double, *, poses: int = 2) -> dict:
    """Un pèlerin, ses corps, un sac de voyage posé dessus — et ce qui en sort."""
    personnage, plan = _personnage(client, poses)
    corps = _corps(client, double, personnage, plan)
    piece = _piece(client, nom="sac de voyage", emplacement="dos")
    lot = _habiller(client, double, personnage, piece, plan)
    assert lot["statut"] == "reussie", lot

    assets = [a for a in _grille(client) if a["generation"] == lot["identifiant"]]
    return {
        "personnage": personnage,
        "plan": plan,
        "piece": piece,
        "corps": corps,
        "lot": lot,
        "planche": next(a for a in assets if a["rang"] == 0),
        "vetements": [a for a in assets if a["rang"] >= 100],
    }


# ── « Une planche revenue apparaît dans la galerie, avec sa génération et son
#     coût » ─────────────────────────────────────────────────────────────────


def test_la_planche_d_equipement_est_une_image_de_la_galerie(client, double):
    """**Ce qui a été payé cesse d'être invisible.** Elle est dans la grille du
    projet, comme n'importe quelle image, et elle porte le coût de l'appel."""
    monte = _monter(client, double)
    planche = monte["planche"]

    grille = {a["identifiant"] for a in _grille(client)}
    assert planche["identifiant"] in grille
    assert planche["generation"] == monte["lot"]["identifiant"]
    assert planche["consomme"] > 0, "le coût de l'appel est sur elle"
    assert all(v["consomme"] == 0 for v in monte["vetements"]), "et sur aucun morceau"
    assert planche["label"].startswith("planche 2 cases")

    # Elle se sert, et c'est le fichier de la planche : l'adresse existait
    # depuis toujours, il n'y avait aucun écran pour y mener.
    image = client.get(
        f"/api/generations/{planche['generation']}/slots/{planche['rang']}/image"
    )
    assert image.status_code == 200 and len(image.content) > 0


def test_la_planche_n_herite_d_aucune_recette(client, double):
    """**Ce n'est pas un sprite.** Ni grille, ni réduction de couleurs, ni
    détourage du projet : une recette vide veut dire *ce qui est montré est le
    fichier tel qu'il est arrivé*, et c'est exactement ce qu'on vient chercher
    en l'ouvrant."""
    planche = _monter(client, double)["planche"]
    assert planche["traite"] is False
    # **Et pas de case à elle** : c'est cette absence qui la tient hors de la
    # matrice du personnage, sans qu'aucun filtre ait à l'y écarter.
    assert planche["pose"] is None and planche["piece"] is None


def test_la_planche_ne_remplit_aucune_case_du_personnage(client, double):
    """La matrice se construit sur la pose, et la planche n'en a pas : elle ne
    peut donc pas se faire prendre pour un corps ni gonfler une jauge."""
    monte = _monter(client, double)
    chose = client.get("/api/characters").json()["personnages"][0]
    pleines = [c for c in chose["cases"] if c["images"]]
    assert len(pleines) == len(monte["plan"])
    for case in pleines:
        assert all(
            image["identifiant"] != monte["planche"]["identifiant"]
            for image in case["images"]
        )


# ── « Sur un vêtement, *brut* désigne deux choses — et l'adresse rend la
#     seconde » ──────────────────────────────────────────────────────────────


def test_la_case_arrivee_n_est_pas_le_brut_range(client, double):
    """**Le cœur de la remarque, et il est mesurable.** Le brut rangé d'un
    vêtement est la case *déjà mise à l'échelle et calée sur son corps* ;
    l'adresse de la case arrivée rend ce que le modèle a vraiment renvoyé. Deux
    images d'une même planche, deux sens du même mot."""
    vetement = _monter(client, double)["vetements"][0]

    arrivee = client.get(f"/api/assets/{vetement['identifiant']}/incoming")
    assert arrivee.status_code == 200, arrivee.text
    rangee = client.get(f"/api/assets/{vetement['identifiant']}/image?brut=true")
    assert rangee.status_code == 200
    assert arrivee.content != rangee.content


def test_la_case_arrivee_ne_coute_rien_et_ne_range_rien(client, double):
    """**Aucun appel, aucun fichier neuf.** Elle se recalcule de la planche à
    chaque demande — la garder doublerait sur le disque chaque équipement payé,
    pour une image qu'on ne regarde qu'en cas de doute."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]

    appels = double.appels
    avant = len(_grille(client))
    for _ in range(3):
        assert (
            client.get(f"/api/assets/{vetement['identifiant']}/incoming").status_code
            == 200
        )
    assert double.appels == appels, "pas un centime"
    assert len(_grille(client)) == avant, "et rien de neuf en bibliothèque"


def test_une_image_qui_n_est_pas_un_vetement_refuse_en_le_disant(client, double):
    """Un corps n'a pas de case arrivée à retrouver — il *est* la case telle
    qu'elle est arrivée. Le refus le dit, il n'échoue pas."""
    monte = _monter(client, double)
    corps = next(iter(monte["corps"].values()))

    reponse = client.get(f"/api/assets/{corps}/incoming")
    assert reponse.status_code == 409, reponse.text
    assert "planche d'équipement" in reponse.json()["raison"]


def test_une_planche_partie_du_disque_refuse_avec_sa_raison(
    client, double, atelier
):
    """**Le geste ne s'offre pas pour échouer.** La planche est la seule chose
    qu'on ne sait pas refaire ; sans elle, la case arrivée ne se retrouve pas,
    et le refus nomme le fait plutôt que de laisser une image cassée."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]

    emplacement = atelier.generations.lire(monte["lot"]["identifiant"]).emplacements[0]
    (atelier.fichiers.racine / emplacement.resultat.fichier).unlink()

    reponse = client.get(f"/api/assets/{vetement['identifiant']}/incoming")
    assert reponse.status_code == 409, reponse.text
    assert "n'est plus sur le disque" in reponse.json()["raison"]

    # Et l'écran ne le proposera pas : l'ouverture de la table le dit avant.
    ouverture = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()
    assert ouverture["arrivee_possible"] is False


# ── « Un bouton *superposition* ouvre la table déjà remplie » ────────────────


def test_la_table_s_ouvre_deja_remplie_sur_un_vetement(client, double):
    """**Les deux bonnes images, sans que l'auteur ait à les retrouver.** Le
    dessus est le vêtement, lu tel qu'il est arrivé ; le dessous est le corps de
    sa pose — celui-là même que la planche avait envoyé."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]

    ouverture = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()
    assert ouverture["dessus"]["identifiant"] == vetement["identifiant"]
    assert ouverture["dessous"] is not None, "le corps de sa pose est prérempli"
    assert (
        ouverture["dessous"]["identifiant"]
        == vetement["recette"]["difference"]["base"]
    )
    assert ouverture["arrivee_possible"] is True
    # **Et on part de la case arrivée par défaut** : repartir du vêtement
    # reviendrait à repartir du résultat qu'on veut défaire.
    assert ouverture["pose"]["dessus_arrivee"] is True


def test_l_apercu_change_selon_l_image_du_dessus(client, double):
    """La bascule n'est pas décorative : les deux points de départ donnent deux
    résultats, et c'est ce qui rend le choix utile."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]
    pose = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()["pose"]

    depuis_arrivee = client.post("/api/overlay/preview", json=pose).json()
    depuis_range = client.post(
        "/api/overlay/preview", json={**pose, "dessus_arrivee": False}
    ).json()
    assert depuis_arrivee["calque"] != depuis_range["calque"]


# ── « Valider fabrique un second vêtement à côté du premier » ────────────────


def test_refaire_le_calage_fabrique_un_second_vetement(client, double):
    """**Les deux coexistent, et le premier n'est pas touché** — choix de
    l'auteur le 3 septembre 2026, contre le remplacement.

    Le second tombe dans la **même case** de la matrice : même personnage, même
    pose, même pièce. C'est ce qui permet de les comparer là où on les regarde,
    au lieu d'aller les chercher dans la grille."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]
    pose = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()["pose"]

    appels = double.appels
    reponse = client.post(
        "/api/overlay",
        json={"pose": pose, "sorties": ["calque"], "garder": False},
    )
    assert reponse.status_code == 200, reponse.text
    assert double.appels == appels, "refaire un calage ne repaie rien"

    ne = reponse.json()["superpositions"][0]
    assert ne["identifiant"] != vetement["identifiant"], "un second, pas un remplacement"
    assert ne["parent"] == vetement["identifiant"]
    assert (ne["personnage"], ne["pose"], ne["piece"]) == (
        vetement["personnage"],
        vetement["pose"],
        vetement["piece"],
    )

    # Le premier est intact : mêmes octets, même recette.
    encore = client.get(f"/api/assets/{vetement['identifiant']}")
    assert encore.status_code == 200
    assert encore.json()["recette"] == vetement["recette"]


def test_la_fiche_dit_lequel_des_deux_compte_et_laisse_en_changer(client, double):
    """**Le favori d'abord, sinon la plus récente** — la règle du produit depuis
    C2, et elle répond toute seule à la question que deux vêtements dans une
    case posent. Le second arrive donc devant ; marquer le premier favori le
    ramène."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]
    pose_id = vetement["pose"]
    pose = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()["pose"]

    ne = client.post(
        "/api/overlay", json={"pose": pose, "sorties": ["calque"], "garder": False}
    ).json()["superpositions"][0]

    def colonne() -> list[dict]:
        chose = client.get("/api/characters").json()["personnages"][0]
        case = next(c for c in chose["cases"] if c["pose"] == pose_id)
        return case["calques"][monte["piece"]]

    dedans = colonne()
    assert {a["identifiant"] for a in dedans} == {
        vetement["identifiant"],
        ne["identifiant"],
    }, "les deux sont dans la même case"

    # **Et l'on en change d'un geste** : marquer le premier favori le remet
    # devant, sans rien supprimer.
    client.put(
        "/api/assets/favorite",
        json={"identifiants": [vetement["identifiant"]], "favori": True},
    ).raise_for_status()
    retenu = max(
        colonne(),
        key=lambda a: (a["favori"], a["cree_le"], a["rang"]),
    )
    assert retenu["identifiant"] == vetement["identifiant"]


# ── Ce que l'usage a trouvé le lendemain ────────────────────────────────────


def test_fabriquer_un_calque_ne_casse_pas_la_planche(client, double):
    """**Le défaut trouvé en usage le 4 septembre 2026, et il était grave.**

    Une superposition écrit son résultat dans le dossier de la *même*
    génération, au premier rang libre — donc au-dessus des cases, sans en
    remplir aucune. Le rejeu du recalage et la case arrivée comptaient ces
    rangs-là comme des cases : après un seul calque refait à la main, l'atelier
    lisait *« trois images rangées pour deux cases »* et refusait les deux
    gestes **sur toute la planche**, définitivement. Refaire un calque cassait
    donc le geste qui l'avait fait.

    Le défaut attendait depuis que `E6` et `R5` se sont croisés sans se voir ;
    `G16` l'a rendu atteignable en un clic, et l'usage l'a trouvé le lendemain.
    """
    monte = _monter(client, double)
    vetements = monte["vetements"]
    pose = client.get(f"/api/assets/{vetements[0]['identifiant']}/overlay").json()["pose"]

    client.post(
        "/api/overlay", json={"pose": pose, "sorties": ["calque"], "garder": False}
    ).raise_for_status()

    # **Les deux gestes tiennent, et sur chaque case** — pas seulement celle
    # qu'on vient de refaire.
    for vetement in vetements:
        arrivee = client.get(f"/api/assets/{vetement['identifiant']}/incoming")
        assert arrivee.status_code == 200, arrivee.text
        ouverture = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()
        assert ouverture["arrivee_possible"] is True

    # Et le rejeu du recalage, qui comptait les mêmes rangs : il refusait
    # « trois images rangées pour deux cases » sur toute la planche.
    rejeu = client.post(f"/api/assets/{vetements[0]['identifiant']}/realign")
    assert rejeu.status_code == 200, rejeu.text


def test_une_image_sans_recette_se_sert_par_son_asset(client, double):
    """**Le second défaut du même jour, et la même cause.**

    L'écran choisissait l'adresse d'une image selon une règle vraie depuis `T3`
    et devenue fausse : *une image sans recette se lit par son emplacement*. Ce
    n'est vrai que des images de `C1` — tout ce qui naît d'un dépliage, d'une
    découpe ou d'une superposition porte un rang qui n'est l'emplacement de
    rien. Un calque né d'une superposition a la recette vide et le rang 102 :
    l'écran demandait l'emplacement 102 d'un appel qui n'a que le 0, et recevait
    un 400 sur un cadre vide.

    L'essai tient le **fait serveur** qui rend l'écran possible : l'adresse de
    l'asset sert n'importe quelle image, avec ou sans recette, à n'importe quel
    rang."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]
    pose = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()["pose"]
    ne = client.post(
        "/api/overlay", json={"pose": pose, "sorties": ["calque"], "garder": False}
    ).json()["superpositions"][0]

    assert ne["traite"] is False, "une superposition ne pose aucune recette"
    assert ne["rang"] >= 100, "et elle se range au-dessus des cases"
    # L'adresse de l'emplacement, celle que l'écran prenait : elle ne peut pas.
    manquee = client.get(
        f"/api/generations/{ne['generation']}/slots/{ne['rang']}/image"
    )
    assert manquee.status_code == 400
    # Celle de l'asset, celle qu'il prend depuis : elle sert le fichier rangé.
    servie = client.get(f"/api/assets/{ne['identifiant']}/image?brut=false")
    assert servie.status_code == 200 and len(servie.content) > 0


# ── « Aucun appel au fournisseur : la tranche se vérifie réseau coupé » ──────


def test_toute_la_tranche_marche_reseau_coupe(client, double):
    """Regarder la planche, regarder la case arrivée, refaire le calage : rien
    de tout cela ne touche le fournisseur."""
    monte = _monter(client, double)
    vetement = monte["vetements"][0]

    appels = double.appels
    client.get(
        f"/api/generations/{monte['planche']['generation']}/slots/0/image"
    ).raise_for_status()
    client.get(f"/api/assets/{vetement['identifiant']}/incoming").raise_for_status()
    ouverture = client.get(f"/api/assets/{vetement['identifiant']}/overlay").json()
    client.post("/api/overlay/preview", json=ouverture["pose"]).raise_for_status()
    client.post(
        "/api/overlay",
        json={"pose": ouverture["pose"], "sorties": ["calque"], "garder": False},
    ).raise_for_status()

    assert double.appels == appels
