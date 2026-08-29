# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T3 — la bibliothèque.

Un test par critère de `docs/PLAN.md` § Phase T3, nommé d'après lui. Cinq des
seize critères ne se vérifient pas ici parce qu'ils portent sur ce que l'écran
montre — la fiche en panneau latéral, l'état vide, l'invitation à écrire, les
trois panneaux, le repli. Ceux-là vivent dans `interface/src/App.test.tsx`,
seul endroit du dépôt où l'interface est montée et pilotée.

**Aucun test de ce fichier n'appelle le fournisseur pour ce qu'il vérifie.**
Deux le prouvent plutôt que de l'affirmer, en comptant les appels du double
avant et après : c'est ainsi que « réseau coupé, la bibliothèque fonctionne
normalement » (US-92) se démontre au lieu de se déclarer.
"""

from __future__ import annotations

import asyncio
import time

import pytest
from conftest import FournisseurDouble, image_sujet

from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible
from atelier.services import Atelier
from atelier.services.bibliotheque import ANNULATION_S

MODELE = "essai/rend-du-png"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _generer(client, prompt: str = "un tonneau", **corps) -> dict:
    """Une génération lancée par la route, telle que l'écran la lance — **et
    attendue jusqu'à son terme**.

    Le POST rend la main tout de suite : « la génération vit côté serveur »
    (T1), et le travail continue après la réponse. Un test qui n'attend pas
    regarde un lot qui n'est pas encore parti, et il dit alors n'importe quoi
    de ce que la bibliothèque contient.
    """
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _attendre(client, identifiant: str) -> dict:
    """Jusqu'à ce que le lot soit réglé. Une relance repart en tâche de fond
    exactement comme une soumission : ne pas l'attendre, c'est regarder avant."""
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


def _asset(client, generation: dict, rang: int = 0) -> dict:
    reponse = client.get(f"/api/assets/{generation['identifiant']}-{rang}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _bibliotheque(client, **filtres) -> list[dict]:
    reponse = client.get("/api/assets", params=filtres)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["assets"]


def _arbre(client) -> dict:
    reponse = client.get("/api/library")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── « Au premier lancement, le projet Bac à sable existe déjà et reçoit ce qui
#     sort » ─────────────────────────────────────────────────────────────────


def test_le_bac_a_sable_existe_au_premier_lancement_et_recoit_ce_qui_sort(client):
    arbre = _arbre(client)

    assert [p["nom"] for p in arbre["projets"]] == ["Bac à sable"]
    assert arbre["courant"] == "bac-a-sable"
    assert arbre["projets"][0]["assets"] == 0

    # **Rien à nommer, rien à ranger** : on écrit un prompt, et ce qui sort a
    # déjà un endroit où être (US-2, US-5).
    asset = _asset(client, _generer(client))
    assert asset["projet"] == "bac-a-sable"
    assert _arbre(client)["projets"][0]["assets"] == 1


def test_l_identifiant_du_projet_est_un_nom_de_dossier_lisible(client, atelier):
    """`donnees/` s'ouvre à la main : `projets/foret-sombre/` s'y lit, pas un
    tirage au sort. Le repère se dérive du nom **une fois**, à la création."""
    reponse = client.post("/api/projects", json={"nom": "Forêt Sombre"})
    assert reponse.status_code == 201, reponse.text
    projet = reponse.json()["projet"]

    assert projet["identifiant"] == "foret-sombre"
    assert (atelier.fichiers.projets / "foret-sombre" / "projet.json").is_file()

    # Un homonyme ne piétine pas le premier : il prend le repère suivant.
    second = client.post("/api/projects", json={"nom": "Forêt sombre"}).json()["projet"]
    assert second["identifiant"] == "foret-sombre-2"


# ── « Une image produite apparaît dans la grille sans qu'on ait à
#     l'accepter » ────────────────────────────────────────────────────────────


def test_une_image_produite_entre_en_bibliotheque_sans_qu_on_l_accepte(client):
    """Pas de sas : un sas ferait perdre par inattention ce qui a été payé.

    Juger, c'est marquer favori ou supprimer — jamais accepter (US-25).
    """
    generation = _generer(client, "un coffre")

    grille = _bibliotheque(client)
    assert [a["identifiant"] for a in grille] == [f"{generation['identifiant']}-0"]
    assert grille[0]["label"] == "un coffre"


# ── « Aucun échec n'apparaît dans la grille, et chaque appel raté reste
#     lisible avec son coût dans le journal du projet » ───────────────────────


def test_aucun_echec_n_entre_en_bibliotheque_et_le_journal_le_garde(client, double):
    double.echec = AppelRefuse("le fournisseur n'a rendu aucune image", cout_usd=0.011)
    generation = _generer(client, "un raté")

    assert _bibliotheque(client) == []

    journal = client.get("/api/journal").json()
    assert journal["rates"] == 1
    assert journal["cout_rate_usd"] == 0.011
    appel = next(a for a in journal["appels"] if a["identifiant"] == generation["identifiant"])
    assert appel["prompt"] == "un raté"
    assert appel["rates"][0]["raison"] == "le fournisseur n'a rendu aucune image"
    assert appel["rates"][0]["cout_usd"] == 0.011


def test_le_total_du_projet_compte_les_appels_rates(client, double):
    """« Le total des coûts par projet est juste, appels ratés compris »
    — c'est ce critère qui achève US-14.

    Le piège est en amont : un appel qui atteint le modèle est facturé même
    quand il ne rend aucune image. Jeter ce montant rendrait le total faux
    d'exactement ce qu'on cherche à expliquer.
    """
    _generer(client, "celui qui marche")

    double.echec = AppelRefuse("crédit épuisé", cout_usd=0.011)
    _generer(client, "celui qui rate")

    journal = client.get("/api/journal").json()
    assert journal["total_usd"] == pytest.approx(0.0245 + 0.011)
    assert _arbre(client)["projets"][0]["total_usd"] == pytest.approx(0.0355)
    # Et la bibliothèque, elle, ne montre que ce qui se réutilise.
    assert len(_bibliotheque(client)) == 1


# ── « La grille sous le prompt et la grille qui sert à organiser sont la
#     même » ──────────────────────────────────────────────────────────────────


def test_une_seule_grille_pour_filtrer_chercher_et_selectionner(client):
    """Une requête, et une seule, pour tout le produit (US-31, US-32).

    L'écran s'en sert pour la grille, le MCP de T7 s'en servira pour lister :
    ce qu'un agent voit est exactement ce que l'écran voit.
    """
    tonneau = _asset(client, _generer(client, "un tonneau de chêne"))
    fiole = _asset(client, _generer(client, "une fiole bleue"))

    # La recherche déplie les accents : « chene » trouve « chêne ».
    trouves = _bibliotheque(client, recherche="chene")
    assert [a["identifiant"] for a in trouves] == [tonneau["identifiant"]]

    # Le favori se pose sur une **sélection**, fût-elle d'un seul.
    reponse = client.put(
        "/api/assets/favorite",
        json={"identifiants": [fiole["identifiant"]], "favori": True},
    )
    assert reponse.status_code == 200, reponse.text
    favoris = _bibliotheque(client, favoris=True)
    assert [a["identifiant"] for a in favoris] == [fiole["identifiant"]]

    # Et un filtre sans résultat rend une grille vide, jamais une erreur : c'est
    # l'écran qui en fait un état vide avec le geste pour retirer le filtre.
    assert _bibliotheque(client, recherche="dragon") == []


def test_le_rangement_a_deux_niveaux_et_la_collection_decide_du_projet(client):
    """Projet › Collection › Asset, et rien d'autre (US-33).

    Une collection qui appartient à un projet **décide** du projet de ce qu'on y
    range : sinon un asset serait dans la collection d'un univers et dans un
    autre univers, et l'arbre mentirait à l'un des deux endroits.
    """
    asset = _asset(client, _generer(client))
    foret = client.post("/api/projects", json={"nom": "Forêt"}).json()["projet"]
    armes = client.post(
        "/api/collections", json={"nom": "Armes", "projet": foret["identifiant"]}
    ).json()["collection"]

    reponse = client.put(
        "/api/assets/arrangement",
        json={"identifiants": [asset["identifiant"]], "collection": armes["identifiant"]},
    )
    assert reponse.status_code == 200, reponse.text
    range_ = reponse.json()["assets"][0]

    assert range_["collection"] == "armes"
    assert range_["projet"] == "foret"  # la collection a décidé
    assert _bibliotheque(client, collection="armes")[0]["identifiant"] == asset["identifiant"]

    arbre = _arbre(client)
    assert next(c for c in arbre["collections"] if c["identifiant"] == "armes")["assets"] == 1


# ── « La filiation d'un asset est lisible depuis sa fiche » et « supprimer un
#     asset qui a huit enfants laisse les huit en place » ─────────────────────


def test_supprimer_un_parent_laisse_ses_huit_enfants_marques(client):
    """Jamais de cascade (US-28, US-29).

    Les huit descendent d'une **source d'édition** réinjectée : c'est le seul
    des quatre rôles qui engendre, et c'est de là que vient toute filiation en
    T3 — la découpe, qui en produira l'autre moitié, est en T5.
    """
    souche = _asset(client, _generer(client, "la souche"))
    lot = _generer(
        client,
        "huit poses",
        variations=8,
        references=[{"asset": souche["identifiant"], "role": "edition"}],
    )
    enfants = [_asset(client, lot, rang) for rang in range(8)]
    assert {e["parent"] for e in enfants} == {souche["identifiant"]}

    filiation = client.get(f"/api/assets/{souche['identifiant']}/lineage").json()
    assert len(filiation["enfants"]) == 8

    reponse = client.post(
        "/api/assets/delete", json={"identifiants": [souche["identifiant"]]}
    )
    assert reponse.status_code == 200, reponse.text

    restants = _bibliotheque(client)
    assert len(restants) == 8
    assert all(a["parent_supprime"] for a in restants)

    # La filiation reste lisible même incomplète : l'identifiant du parent
    # survit, et l'enfant sait d'où il ne vient plus.
    vue = client.get(f"/api/assets/{enfants[0]['identifiant']}/lineage").json()
    assert vue["parent"] is None
    assert vue["parent_identifiant"] == souche["identifiant"]
    assert vue["parent_supprime"] is True


# ── « Supprimer un projet annonce le nombre d'assets concernés, et ces assets
#     se retrouvent détachés, pas détruits » ──────────────────────────────────


def test_supprimer_un_projet_detache_ses_assets_au_lieu_de_les_detruire(client):
    premier = _asset(client, _generer(client, "dans le bac"))
    foret = client.post("/api/projects", json={"nom": "Forêt"}).json()["projet"]
    # Créer un projet l'ouvre : ce qui sort ensuite y entre.
    second = _asset(client, _generer(client, "dans la forêt"))
    assert second["projet"] == "foret"

    # Le compte est **déjà** dans l'arbre : c'est lui que l'écran annonce avant
    # de faire confirmer, pas un chiffre que la suppression rendrait après coup.
    avant = next(p for p in _arbre(client)["projets"] if p["identifiant"] == "foret")
    assert avant["assets"] == 1

    reponse = client.delete(f"/api/projects/{foret['identifiant']}")
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["assets"] == 1

    detaches = _bibliotheque(client, sans_projet=True)
    assert [a["identifiant"] for a in detaches] == [second["identifiant"]]
    assert detaches[0]["projet"] is None
    # Rien n'est détruit : l'image se sert toujours.
    assert client.get(f"/api/assets/{second['identifiant']}/image").status_code == 200
    assert _bibliotheque(client, projet="bac-a-sable")[0]["identifiant"] == premier["identifiant"]


def test_le_dernier_projet_ne_se_supprime_pas_et_le_refus_dit_pourquoi(client):
    """« Ce qui est indisponible est grisé avec sa raison, jamais proposé puis
    refusé » : le refus existe quand même, comme filet, et il est en français."""
    reponse = client.delete("/api/projects/bac-a-sable")
    assert reponse.status_code == 409
    assert "seul projet" in reponse.json()["raison"]


# ── « Chaque suppression offre une annulation courte, puis devient
#     définitive » ────────────────────────────────────────────────────────────


def test_une_suppression_s_annule_dans_l_instant_puis_devient_definitive(
    client, atelier
):
    asset = _asset(client, _generer(client, "à jeter"))
    identifiant = asset["identifiant"]

    reponse = client.post("/api/assets/delete", json={"identifiants": [identifiant]})
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["annulation_s"] == ANNULATION_S
    assert _bibliotheque(client) == []
    # Sorti de la bibliothèque, mais pas encore du disque.
    assert atelier.fichiers.existe(asset["brut"])

    rendus = client.post("/api/assets/restore", json={"identifiants": [identifiant]})
    assert rendus.status_code == 200, rendus.text
    assert [a["identifiant"] for a in _bibliotheque(client)] == [identifiant]

    # On resupprime, et on fait passer l'instant.
    client.post("/api/assets/delete", json={"identifiants": [identifiant]})
    vieilli = atelier.base.lire_asset(identifiant)
    vieilli.supprime_le = time.time() - ANNULATION_S - 1
    atelier.assets.sauver(vieilli)

    refus = client.post("/api/assets/restore", json={"identifiants": [identifiant]})
    assert refus.status_code == 409
    assert "expiré" in refus.json()["raison"]

    # Le balayage passe, et les fichiers partent pour de bon.
    assert atelier.bibliotheque.purger() == 1
    assert not atelier.fichiers.existe(asset["brut"])
    assert atelier.base.lire_asset(identifiant) is None


def test_un_supprime_definitif_ne_ressuscite_pas_au_redemarrage(client, atelier, double):
    """Le piège de la tranche, et il se serait vu trop tard.

    `rattraper()` donne un asset à tout emplacement réussi qui n'en a pas : au
    premier redémarrage, il aurait recréé ce qu'on venait d'effacer. La règle
    qui l'en empêche est celle du disque — **pas d'image, pas d'asset** — et
    c'est la même qui rend la reconstruction sûre.
    """
    asset = _asset(client, _generer(client, "effacé pour de bon"))
    client.post("/api/assets/delete", json={"identifiants": [asset["identifiant"]]})
    vieilli = atelier.base.lire_asset(asset["identifiant"])
    vieilli.supprime_le = time.time() - ANNULATION_S - 1
    atelier.assets.sauver(vieilli)
    atelier.bibliotheque.purger()

    asyncio.run(atelier.ouvrir())
    assert _bibliotheque(client) == []
    # Et l'appel, lui, reste au journal avec son coût : on a supprimé une
    # image, pas une dépense.
    assert client.get("/api/journal").json()["total_usd"] == 0.0245


# ── « La base d'index effacée, la bibliothèque se reconstruit depuis les
#     fichiers sans perdre un asset » ─────────────────────────────────────────


def test_l_index_efface_la_bibliotheque_se_reconstruit_depuis_les_fichiers(
    client, atelier, tmp_path, double
):
    """L'invariant de la tranche, éprouvé par le pire : on efface l'index.

    Ce qui doit revenir n'est pas seulement la liste des images — c'est tout ce
    que l'auteur a posé de sa main : le projet qu'il a créé, la collection, le
    rangement, le favori, la filiation, et la recette de T2.
    """
    foret = client.post("/api/projects", json={"nom": "Forêt"}).json()["projet"]
    armes = client.post(
        "/api/collections", json={"nom": "Armes", "projet": foret["identifiant"]}
    ).json()["collection"]

    souche = _asset(client, _generer(client, "la souche"))
    enfant = _asset(
        client,
        _generer(
            client,
            "sa pose",
            references=[{"asset": souche["identifiant"], "role": "edition"}],
        ),
    )
    client.put(
        "/api/assets/arrangement",
        json={
            "identifiants": [souche["identifiant"]],
            "collection": armes["identifiant"],
        },
    )
    client.put(
        "/api/assets/favorite",
        json={"identifiants": [souche["identifiant"]], "favori": True},
    )
    client.put(
        f"/api/assets/{souche['identifiant']}/recipe",
        json={
            "passes": [
                {"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}
            ],
            "recadrage": None,
            "grille": {"cible": 32, "occupation": 100, "ancrage": "bas"},
            "quantification": None,
            "bords": None,
            "nom": None,
        },
    )

    # L'index disparaît — effacé à la main, ou perdu avec un disque.
    for suffixe in ("", "-wal", "-shm"):
        chemin = tmp_path / f"atelier.sqlite3{suffixe}"
        chemin.unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    assert [p.nom for p in refait.bibliotheque.projets()] == ["Bac à sable", "Forêt"]
    assert [c.nom for c in refait.bibliotheque.collections()] == ["Armes"]

    revenus = {a.identifiant: a for a in refait.bibliotheque.chercher(projet="foret")}
    assert set(revenus) == {souche["identifiant"], enfant["identifiant"]}
    assert revenus[souche["identifiant"]].favori is True
    assert revenus[souche["identifiant"]].collection == "armes"
    assert revenus[souche["identifiant"]].recette.grille.cible == 32
    assert revenus[enfant["identifiant"]].parent == souche["identifiant"]
    # Le coût aussi : le journal se relit du disque comme le reste.
    assert refait.bibliotheque.journal("foret")["total_usd"] == pytest.approx(0.049)


def test_un_schema_qui_change_jette_l_index_et_le_refait(tmp_path, double):
    """Aucune migration, et c'est une décision : le schéma qui bouge jette
    l'index, et le démarrage le refait depuis les fichiers.

    C'est ce qui transforme l'invariant en habitude — la reconstruction sert au
    moins une fois par évolution du schéma, donc elle ne pourrit pas.
    """
    import sqlite3

    from atelier.depot.base import Base

    atelier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(atelier.ouvrir())
    assert atelier.base.refaite is False

    with sqlite3.connect(tmp_path / "atelier.sqlite3") as connexion:
        connexion.execute("PRAGMA user_version = 1")

    refaite = Base(tmp_path / "atelier.sqlite3")
    assert refaite.refaite is True
    assert refaite.vide is True

    apres = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(apres.ouvrir())
    assert [p.nom for p in apres.bibliotheque.projets()] == ["Bac à sable"]


# ── « Un asset se réinjecte dans le générateur comme référence, source
#     d'édition, guide de style ou jeu de réglages » ──────────────────────────


def test_un_asset_se_reinjecte_dans_ses_quatre_roles(client, double):
    """Trois rôles envoient une image, le quatrième n'envoie rien (US-12).

    Ce que ce test regarde n'est pas ce que le produit *dit* avoir envoyé, mais
    ce qui est arrivé au bout du port : `double.references_recues`.
    """
    souche = _asset(client, _generer(client, "la souche"))
    double.references_recues.clear()

    # 1 · référence — elle inspire, elle n'engendre pas.
    inspire = _generer(
        client,
        "inspiré de",
        references=[{"asset": souche["identifiant"], "role": "reference"}],
    )
    assert double.references_recues[-1] == 1
    assert _asset(client, inspire)["parent"] is None

    # 2 · source d'édition — elle engendre.
    edite = _generer(
        client,
        "édité depuis",
        references=[{"asset": souche["identifiant"], "role": "edition"}],
    )
    assert double.references_recues[-1] == 1
    assert _asset(client, edite)["parent"] == souche["identifiant"]

    # 3 · guide de style — même tuyau, rôle enregistré quand même : c'est lui
    #     que T4 relira quand l'univers enverra ses artworks tout seul.
    style = _generer(
        client,
        "dans le style de",
        references=[{"asset": souche["identifiant"], "role": "style"}],
    )
    assert double.references_recues[-1] == 1
    enregistree = client.get(f"/api/generations/{style['identifiant']}").json()
    # `origine` est arrivée en T4, quand une seconde famille d'images a pu
    # partir en référence : une carte du tableau d'inspiration se relit ailleurs
    # qu'un asset. Une réinjection posée à la main reste `asset`, et c'est ce
    # que ce test-ci vérifie — celui de T4 vérifie l'autre moitié.
    assert enregistree["references"] == [
        {"asset": souche["identifiant"], "role": "style", "origine": "asset"}
    ]
    assert enregistree["parent"] is None

    # 4 · jeu de réglages — aucune image ne part : l'écran relit les paramètres
    #     de la génération d'un asset et repeuple le générateur avec.
    reglages = client.get(f"/api/generations/{souche['generation']}").json()
    assert reglages["demande"]["prompt"] == "la souche"
    assert reglages["modele"] == MODELE


def test_un_modele_qui_n_accepte_aucune_reference_est_grise_avec_sa_raison(client):
    """Le grisé se recalcule sur le nombre de références : réinjecter change ce
    que chaque modèle peut honorer, et le produit ne propose jamais pour
    refuser ensuite."""
    catalogue = client.get("/api/models", params={"references": 1}).json()
    jpeg = next(m for m in catalogue["modeles"] if m["identifiant"].endswith("jpeg"))
    assert jpeg["refus"] == "n'accepte aucune image de référence"

    trop = client.get("/api/models", params={"references": 3}).json()
    png = next(m for m in trop["modeles"] if m["identifiant"] == MODELE)
    assert png["refus"] == "n'accepte que 2 images de référence, il en faudrait 3"


def test_une_reference_supprimee_arrete_l_appel_avant_qu_il_ne_parte(client, double):
    """Mieux vaut redemander laquelle réinjecter que payer une génération à
    laquelle il manque ce qu'on voulait montrer."""
    souche = _asset(client, _generer(client, "la souche"))
    client.post("/api/assets/delete", json={"identifiants": [souche["identifiant"]]})

    appels = double.appels
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "sans sa source",
            "references": [{"asset": souche["identifiant"], "role": "edition"}],
        },
    )
    assert reponse.status_code == 409
    assert "n'est plus dans la bibliothèque" in reponse.json()["raison"]
    assert double.appels == appels  # rien n'est parti, rien n'est facturé


def test_on_n_edite_qu_une_image_a_la_fois(client, double):
    """Deux sources d'édition donneraient une filiation à deux parents, que le
    modèle d'objets ne porte pas et que rien à l'écran ne saurait montrer."""
    une = _asset(client, _generer(client, "une"))
    deux = _asset(client, _generer(client, "deux"))
    appels = double.appels

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "les deux à la fois",
            "references": [
                {"asset": une["identifiant"], "role": "edition"},
                {"asset": deux["identifiant"], "role": "edition"},
            ],
        },
    )
    assert reponse.status_code == 409
    assert reponse.json()["raison"] == "on n'édite qu'une image à la fois"
    assert double.appels == appels


def test_la_relance_d_un_rate_remporte_ses_references(client, double):
    """Les octets ne sont jamais recopiés dans l'enregistrement : ils se
    relisent depuis les assets, à la soumission **comme** à la relance. Sans
    ça, relancer coûterait le même prix pour une autre image."""
    souche = _asset(client, _generer(client, "la souche"))
    double.echec = AppelRefuse("panne passagère")
    rate = _generer(
        client,
        "avec sa source",
        references=[{"asset": souche["identifiant"], "role": "edition"}],
    )

    double.echec = None
    double.references_recues.clear()
    reponse = client.post(f"/api/generations/{rate['identifiant']}/slots/0/retry")
    assert reponse.status_code == 200, reponse.text
    assert _attendre(client, rate["identifiant"])["statut"] == "reussie"

    assert double.references_recues == [1]
    assert _asset(client, rate)["parent"] == souche["identifiant"]


# ── « Réseau coupé : bibliothèque, retouche et détourage fonctionnent
#     normalement » ───────────────────────────────────────────────────────────


def test_reseau_coupe_la_bibliotheque_fonctionne_normalement(client, double):
    """US-92, et il se **prouve** : le compteur d'appels du double ne bouge pas.

    Tout ce qui est ici — retrouver, ranger, marquer, supprimer, annuler,
    retoucher, relire le journal, reconstruire — se passe sur le disque et le
    processeur de la machine.
    """
    double.rendre = lambda: image_sujet(bloc=4)
    asset = _asset(client, _generer(client, "avant la panne"))

    # Le réseau tombe : plus de catalogue, et tout appel échouerait.
    double.catalogue_lisible = False
    double.echec = FournisseurIndisponible("aucune connexion au fournisseur")
    appels = double.appels

    assert client.post("/api/models/refresh").json()["repli"] is True

    assert len(_bibliotheque(client)) == 1
    assert _bibliotheque(client, recherche="panne")[0]["identifiant"] == asset["identifiant"]
    assert client.post("/api/projects", json={"nom": "Hors ligne"}).status_code == 201
    assert (
        client.put(
            "/api/assets/arrangement",
            json={"identifiants": [asset["identifiant"]], "projet": "hors-ligne"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/assets/favorite",
            json={"identifiants": [asset["identifiant"]], "favori": True},
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/api/assets/{asset['identifiant']}/recipe",
            json={
                "passes": [
                    {
                        "moteur": "bord",
                        "tolerance": 28,
                        "seuil_alpha": 128,
                        "durcissement": 0,
                    }
                ],
                "recadrage": {"marge": 0, "boite": None},
                "grille": {"cible": 16, "occupation": 100, "ancrage": "bas"},
                "quantification": None,
                "bords": None,
                "nom": None,
            },
        ).status_code
        == 200
    )
    assert client.get(f"/api/assets/{asset['identifiant']}/lineage").status_code == 200
    assert client.get("/api/journal", params={"projet": "hors-ligne"}).status_code == 200
    assert client.post("/api/assets/delete", json={"identifiants": [asset["identifiant"]]}).status_code == 200
    assert client.post("/api/assets/restore", json={"identifiants": [asset["identifiant"]]}).status_code == 200
    assert client.post("/api/library/rebuild").status_code == 200

    assert double.appels == appels


# ── L'ordre de la grille, et ce que le chantier porte ────────────────────────


def test_le_lot_reste_groupe_et_dans_l_ordre_de_ses_emplacements(client):
    """« La grille ne se recompose jamais entre le départ et l'arrivée »
    (`docs/design-motifs.md` § L'emplacement).

    Les variations d'un même lot n'arrivent pas ensemble. Dater chaque asset de
    son arrivée les ferait glisser les unes par rapport aux autres pendant
    qu'on les regarde : ils portent donc la date du lot, et le rang départage.
    """
    premier = _generer(client, "le premier lot", variations=3)
    second = _generer(client, "le second lot", variations=2)

    grille = [a["identifiant"] for a in _bibliotheque(client)]
    assert grille == [
        f"{second['identifiant']}-0",
        f"{second['identifiant']}-1",
        f"{premier['identifiant']}-0",
        f"{premier['identifiant']}-1",
        f"{premier['identifiant']}-2",
    ]


def test_le_chantier_ne_porte_que_ce_qui_attend_encore_une_issue(client, atelier, double):
    """Ce qui a réussi est en bibliothèque, ce qui a raté est au journal.

    Reste le chantier : ce qui tourne, et ce qu'un redémarrage a coupé — celui-là
    garde son coût et attend un geste, jamais une relance automatique (US-17).
    """
    _generer(client, "arrivé à bon port")
    double.echec = AppelRefuse("raté")
    _generer(client, "jamais arrivé")
    double.echec = None

    assert atelier.generations.chantier() == []

    # Un redémarrage coupe une génération en vol : elle, elle attend.
    coupee = _generer(client, "coupée")
    interrompue = atelier.generations.lire(coupee["identifiant"])
    interrompue.emplacements[0].statut = interrompue.emplacements[0].statut.__class__(
        "en_cours"
    )
    atelier.base.enregistrer(interrompue)
    atelier.generations.reprendre()

    en_suspens = [g.identifiant for g in atelier.generations.chantier()]
    assert en_suspens == [coupee["identifiant"]]


def test_ce_qui_existait_avant_les_projets_entre_dans_le_bac_a_sable(
    tmp_path, double
):
    """Trouvé en ouvrant l'atelier pour de vrai, pas au banc.

    Les images de T1 et T2 portent `projet: null` — non parce qu'on les a
    détachées, mais parce qu'à leur naissance il n'y avait rien à quoi les
    attacher. Sans adoption, elles se retrouvaient sous « Sans projet » et la
    grille s'ouvrait **vide** sur un atelier qui a déjà six images.

    « Sans projet » doit vouloir dire *détaché* — un état que l'auteur a
    provoqué —, jamais *antérieur au rangement*.
    """
    from atelier.domaine import Demande

    # Un atelier d'avant les projets : on lui retire le sien, comme T2 le
    # laissait, et on relit le disque comme le ferait un vrai démarrage.
    avant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)

    async def produire() -> None:
        # **Une seule boucle** : une tâche créée dans un `asyncio.run` meurt
        # avec lui, et la génération n'arriverait jamais.
        await avant.ouvrir()
        await avant.generations.soumettre(MODELE, Demande("une image de T2"))
        await avant.generations.attendre_tout()

    asyncio.run(produire())
    for asset in avant.base.assets(limite=10):
        asset.projet = None
        avant.assets.sauver(asset)
    avant.base.detacher_generations("bac-a-sable")
    avant.base.oublier_projet("bac-a-sable")
    avant.fichiers.effacer_projet("bac-a-sable")

    apres = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(apres.ouvrir())

    assert [p.nom for p in apres.bibliotheque.projets()] == ["Bac à sable"]
    grille = apres.bibliotheque.grille_courante()
    assert [a.projet for a in grille] == ["bac-a-sable"]
    # Le coût suit le rangement : le journal du projet le porte, pas celui du
    # nulle-part.
    assert apres.bibliotheque.journal("bac-a-sable")["total_usd"] == 0.0245
    assert apres.bibliotheque.arbre()["sans_projet"]["assets"] == 0


def test_un_asset_d_avant_t3_retrouve_son_cout_a_la_reconstruction(
    client, atelier, tmp_path, double
):
    """Le champ `cout_usd` de l'asset n'existait pas avant cette tranche.

    Sa génération, elle, l'a toujours porté. Relire le disque sans aller le
    chercher afficherait `$0,0000` sur une tuile dont l'image a bel et bien été
    payée — et le total du projet, lui, dirait autre chose. Constaté en relisant
    les six images de T1 et T2, pas au banc.
    """
    import json

    asset = _asset(client, _generer(client, "payée avant T3"))
    fiche = tmp_path / "generations" / asset["generation"] / "0-asset.json"
    contenu = json.loads(fiche.read_text(encoding="utf-8"))
    contenu.pop("cout_usd")
    fiche.write_text(json.dumps(contenu, ensure_ascii=False), encoding="utf-8")

    atelier.bibliotheque.reconstruire()
    revenu = atelier.base.lire_asset(asset["identifiant"])
    assert revenu.cout_usd == 0.0245

    # Et sans reconstruction non plus : un index déjà rempli d'assets sans coût
    # se répare au démarrage suivant, là où le rattrapage passe de toute façon.
    appauvri = atelier.base.lire_asset(asset["identifiant"])
    appauvri.cout_usd = 0.0
    atelier.assets.sauver(appauvri)
    asyncio.run(atelier.ouvrir())
    assert atelier.base.lire_asset(asset["identifiant"]).cout_usd == 0.0245


def test_les_variations_d_un_meme_lot_se_realignent_sur_la_date_du_lot(client, atelier):
    """Vu à l'écran, sur les images de T1 : la variation 1 passait devant la 0.

    Un asset d'avant T3 porte l'instant où son image est tombée, et deux
    variations d'un même appel n'arrivent pas ensemble. La grille les rendait
    donc dans l'ordre des arrivées plutôt que dans celui des emplacements — ce
    que « la grille ne se recompose jamais » (`docs/design-motifs.md` § L'emplacement)
    interdit précisément.
    """
    lot = _generer(client, "deux variations", variations=2)
    tardif = atelier.base.lire_asset(f"{lot['identifiant']}-1")
    tardif.cree_le += 3.0  # comme si le rang 1 était arrivé après le rang 0
    atelier.assets.sauver(tardif)
    assert [a.rang for a in atelier.bibliotheque.chercher()] == [1, 0]  # à l'envers

    asyncio.run(atelier.ouvrir())
    grille = atelier.bibliotheque.chercher()
    assert [a.rang for a in grille] == [0, 1]
    assert len({a.cree_le for a in grille}) == 1
