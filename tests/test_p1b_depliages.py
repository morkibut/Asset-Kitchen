# -*- coding: utf-8 -*-
"""P1b (V3.5) — les gestes du serveur sur les dépliages d'une planche.

**Ce qui se mesure ici** : un dépliage se refait à la demande, en repartant des
coupes proposées ; les dépliages d'une planche coexistent sans se marcher
dessus ; chaque image remonte à sa planche et à son dépliage ; supprimer un
dépliage n'emporte rien d'autre ; supprimer la planche demande un « oui » qui
dit combien d'images en dépendent — et ces images restent. Tout passe par les
routes, avec le fournisseur doublé : **aucun essai ne coûte un centime**, et
aucun geste ici n'appelle le fournisseur.

**La panne que cette tranche pouvait créer sans bruit**, et que deux essais
gardent : un dépliage supprimé puis purgé ne laisse plus de rang dans l'index —
la reprise au démarrage le prenait pour une planche jamais dépliée, et le
miroir d'une image voisine retombait sur un rang réservé.
"""

from __future__ import annotations

import asyncio
import time

from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.pliage import AUTO, MAIN
from atelier.services.rangs import rang_libre

from conftest import planche_sujets

MODELE = "essai:rend-du-png"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"le lot « {identifiant} » n'est jamais arrivé à terme")


def _lot(client, double, sujets: int = 4) -> str:
    """Un lot de `sujets` poses, arrivé et déplié tout seul — la planche."""
    double.rendre = lambda: planche_sujets(sujets)
    personnage = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    ).json()["personnage"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un nain forgeron",
            "personnage": personnage["identifiant"],
            "poses": poses[:sujets],
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    assert _attendre(client, identifiant)["statut"] == "reussie"
    return f"{identifiant}-0"


def _liste(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}/unfoldings")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _proposition(client, planche: str, **params) -> dict:
    reponse = client.get(f"/api/assets/{planche}/unfoldings/proposal", params=params)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _refaire(client, planche: str, boites, cases=None) -> dict:
    corps: dict = {"boites": boites}
    if cases is not None:
        corps["cases"] = cases
    reponse = client.post(f"/api/assets/{planche}/unfoldings", json=corps)
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _purger(atelier) -> None:
    """L'annulation expirée : la purge efface pour de bon."""
    atelier.bibliotheque.purger(maintenant=time.time() + 3600)


# ── Refaire est un geste demandé, et il repart des coupes proposées ──────────


def test_la_proposition_repart_des_coupes_du_dernier_depliage(client, atelier, double):
    """Rien n'est créé en proposant ; et c'est toujours le **dernier** dépliage
    qu'on corrige, sauf à en désigner un autre."""
    planche = _lot(client, double)
    (premier,) = _liste(client, planche)["depliages"]
    avant = atelier.base.rangs_de_generation(planche.rsplit("-", 1)[0])

    proposee = _proposition(client, planche)

    assert proposee["boites"] == premier["coupes"]
    assert proposee["cases"] == [0, 1, 2, 3]
    assert proposee["depuis"] == premier["identifiant"]
    assert proposee["refaisable"] is True
    assert len(proposee["cases_de_la_planche"]) == 4
    # Proposer n'a rien écrit.
    assert atelier.base.rangs_de_generation(planche.rsplit("-", 1)[0]) == avant
    assert len(_liste(client, planche)["depliages"]) == 1

    # Un second dépliage, sur trois coupes : la proposition suit le dernier…
    trois = premier["coupes"][:3]
    _refaire(client, planche, trois)
    assert _proposition(client, planche)["boites"] == trois
    # … et le n° 1 reste désignable.
    assert _proposition(client, planche, **{"from": 1})["boites"] == premier["coupes"]


def test_refaire_sur_les_coupes_proposees_rend_les_memes_images(client, atelier, double):
    """**La convention « avant marge » tenue** : repartir des coupes sans y
    toucher redonne des images de la même taille que le premier dépliage."""
    planche = _lot(client, double)
    (premier,) = _liste(client, planche)["depliages"]

    refait = _refaire(client, planche, _proposition(client, planche)["boites"])

    tailles = lambda images: [(a["largeur"], a["hauteur"]) for a in images]  # noqa: E731
    assert tailles(refait["images"]) == tailles(premier["images"])


def test_une_coupe_se_deplace_sajoute_et_se_retire(client, atelier, double):
    """Le dépliage refait est **origine main**, porte les coupes données, et range
    chaque image comme le dépliage automatique : planche, dépliage, et la pose de
    la case qu'elle remplit — aucune pour une coupe ajoutée."""
    planche = _lot(client, double)
    (premier,) = _liste(client, planche)["depliages"]
    x0, y0, x1, y1 = premier["coupes"][0]
    deplacee = [x0 + 2, y0 + 2, x1 + 2, y1 + 2]
    ajoutee = [0, 0, 20, 20]
    # La coupe n° 2 est retirée ; la n° 3 est gardée ; une coupe s'ajoute.
    coupes = [deplacee, premier["coupes"][2], ajoutee]

    refait = _refaire(client, planche, coupes, cases=[0, 2, None])

    depliage = refait["depliage"]
    assert depliage["numero"] == 2
    assert depliage["origine"] == MAIN
    assert depliage["coupes"] == coupes
    assert depliage["cases"] == [0, 2, None]
    images = refait["images"]
    assert [a["depliage"] for a in images] == [depliage["identifiant"]] * 3
    assert {a["planche"] for a in images} == {planche}
    poses_auto = [a["pose"] for a in premier["images"]]
    assert [a["pose"] for a in images] == [poses_auto[0], poses_auto[2], None]
    assert all(a["consomme"] == 0 for a in images)


def test_refaire_leve_le_refus_seulement_pour_le_geste_demande(client, atelier, double):
    """Le chemin automatique garde son refus : une planche déjà dépliée ne se
    re-tranche pas par l'écran du choix. Le geste demandé, lui, passe."""
    planche = _lot(client, double)
    generation, rang = planche.rsplit("-", 1)

    auto = client.post(
        f"/api/generations/{generation}/slots/{rang}/unfold", json={"ecartees": []}
    )
    assert auto.status_code == 400
    assert "déjà rendu ses images" in auto.json()["raison"]

    _refaire(client, planche, _proposition(client, planche)["boites"])


def test_des_coupes_hors_de_la_planche_sont_refusees_sans_rien_ecrire(
    client, atelier, double
):
    planche = _lot(client, double)

    reponse = client.post(
        f"/api/assets/{planche}/unfoldings", json={"boites": [[0, 0, 5000, 10]]}
    )

    assert reponse.status_code == 409
    assert reponse.json()["code"] == "decoupe_refusee"
    assert len(_liste(client, planche)["depliages"]) == 1


# ── Une planche se déplie plusieurs fois ─────────────────────────────────────


def test_trois_depliages_coexistent_sans_partager_un_rang(client, atelier, double):
    planche = _lot(client, double)
    coupes = _proposition(client, planche)["boites"]
    _refaire(client, planche, coupes[:2])
    _refaire(client, planche, coupes)

    depliages = _liste(client, planche)["depliages"]

    assert [d["numero"] for d in depliages] == [1, 2, 3]
    assert [d["origine"] for d in depliages] == [AUTO, MAIN, MAIN]
    rangs = [r for d in depliages for r in d["rangs"]]
    assert len(rangs) == len(set(rangs)) == 4 + 2 + 4
    # Chaque dépliage a ses images, et les images sont bien aux rangs réservés.
    for d in depliages:
        assert [a["rang"] for a in d["images"]] == d["rangs"]


# ── Chaque image se remonte jusqu'à sa planche et son dépliage ──────────────


def test_une_image_remonte_a_sa_planche_et_a_son_depliage(client, atelier, double):
    planche = _lot(client, double)
    refait = _refaire(client, planche, _proposition(client, planche)["boites"][:2])
    image = refait["images"][1]["identifiant"]

    depuis_image = _liste(client, image)

    assert depuis_image["planche"] == planche
    assert depuis_image == _liste(client, planche)
    (le_sien,) = [
        d
        for d in depuis_image["depliages"]
        if image in {a["identifiant"] for a in d["images"]}
    ]
    assert le_sien["identifiant"] == refait["depliage"]["identifiant"]


def test_une_image_ordinaire_na_pas_de_depliage(client, atelier, double):
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un tonneau"}
    )
    identifiant = reponse.json()["identifiant"]
    _attendre(client, identifiant)

    refus = client.get(f"/api/assets/{identifiant}-0/unfoldings")

    assert refus.status_code == 409
    assert refus.json()["code"] == "depliage_refuse"
    assert client.get("/api/assets/inconnu-0/unfoldings").status_code == 404


# ── Supprimer un dépliage n'emporte ni la planche ni les autres ──────────────


def test_supprimer_un_depliage_ne_touche_ni_la_planche_ni_les_autres(
    client, atelier, double
):
    planche = _lot(client, double)
    generation = planche.rsplit("-", 1)[0]
    coupes = _proposition(client, planche)["boites"]
    second = _refaire(client, planche, coupes[:2])["depliage"]
    _refaire(client, planche, coupes[2:])

    reponse = client.delete(f"/api/assets/{planche}/unfoldings/2")
    assert reponse.status_code == 200, reponse.text
    assert sorted(reponse.json()["supprimes"]) == sorted(
        f"{generation}-{r}" for r in second["rangs"]
    )
    _purger(atelier)

    apres = _liste(client, planche)
    assert [len(d["images"]) for d in apres["depliages"]] == [4, 0, 2]
    assert [d["supprime"] for d in apres["depliages"]] == [False, True, False]
    # La planche est là, son fichier aussi : elle se redécoupe encore.
    feuille = atelier.base.lire_asset(planche)
    assert feuille is not None and feuille.supprime_le is None
    assert atelier.fichiers.existe(feuille.brut)
    assert apres["refaisable"] is True
    # **Ses rangs restent réservés** : un quatrième dépliage passe au-dessus,
    # même purgés — et son numéro n'est pas redonné.
    quatrieme = _refaire(client, planche, coupes[:1])["depliage"]
    assert quatrieme["numero"] == 4
    assert min(quatrieme["rangs"]) > max(second["rangs"])
    assert not set(quatrieme["rangs"]) & set(second["rangs"])


def test_un_depliage_supprime_sannule_comme_toute_suppression(client, atelier, double):
    planche = _lot(client, double)
    supprimes = client.delete(f"/api/assets/{planche}/unfoldings/1").json()["supprimes"]
    assert _liste(client, planche)["depliages"][0]["supprime"] is True

    rendu = client.post("/api/assets/restore", json={"identifiants": supprimes})

    assert rendu.status_code == 200
    (depliage,) = _liste(client, planche)["depliages"]
    assert len(depliage["images"]) == 4
    assert depliage["supprime"] is False


def test_un_depliage_supprime_et_purge_ne_revient_pas_au_demarrage(
    client, atelier, double
):
    """**La panne silencieuse** : ses images purgées, l'index ne connaît plus
    aucun rang au-dessus de cent — la reprise au démarrage redépliait la
    planche, et ce que l'auteur a jeté revenait aux mêmes rangs."""
    planche = _lot(client, double)
    client.delete(f"/api/assets/{planche}/unfoldings/1").raise_for_status()
    _purger(atelier)
    appels = double.appels

    asyncio.run(atelier.ouvrir())

    assert double.appels == appels
    (depliage,) = _liste(client, planche)["depliages"]
    assert depliage["images"] == []
    assert depliage["supprime"] is True


def test_supprimer_un_depliage_inconnu_est_refuse(client, atelier, double):
    planche = _lot(client, double)
    reponse = client.delete(f"/api/assets/{planche}/unfoldings/9")
    assert reponse.status_code == 409
    assert reponse.json()["code"] == "depliage_refuse"


# ── Supprimer la planche demande confirmation, et dit le compte ─────────────


def test_supprimer_la_planche_sans_confirmer_est_refuse_avec_le_compte(
    client, atelier, double
):
    planche = _lot(client, double)
    _refaire(client, planche, _proposition(client, planche)["boites"][:2])

    compte = client.get(f"/api/assets/{planche}/dependents").json()
    assert compte["est_une_planche"] is True
    assert (compte["depliees"], compte["total"]) == (6, 6)

    refus = client.post("/api/assets/delete", json={"identifiants": [planche]})

    assert refus.status_code == 409
    corps = refus.json()
    assert corps["code"] == "planche_a_confirmer"
    assert corps["dependants"]["total"] == 6
    assert "6 images" in corps["raison"]
    # **Rien n'est parti** — pas même une autre image de la même sélection.
    assert atelier.base.lire_asset(planche).supprime_le is None


def test_une_image_ordinaire_se_supprime_sans_question(client, atelier, double):
    planche = _lot(client, double)
    (depliage,) = _liste(client, planche)["depliages"]
    image = depliage["images"][0]["identifiant"]

    assert (
        client.post("/api/assets/delete", json={"identifiants": [image]}).status_code
        == 200
    )


def test_la_planche_supprimee_laisse_ses_images_mais_ne_se_redecoupe_plus(
    client, atelier, double
):
    """**La décision de P1b, écrite dans l'essai** : une image dépliée a son
    propre brut, à son propre rang ; la purge de la planche efface `0-*` et ne
    la touche pas. Elle reste, avec sa planche et son dépliage — ce qui se perd
    est le geste de refaire, parce que le fichier recoupé est parti."""
    planche = _lot(client, double)
    (depliage,) = _liste(client, planche)["depliages"]
    images = [a["identifiant"] for a in depliage["images"]]
    feuille = atelier.base.lire_asset(planche)

    confirme = client.post(
        "/api/assets/delete", json={"identifiants": [planche], "confirmer": True}
    )
    assert confirme.status_code == 200, confirme.text
    _purger(atelier)

    assert not atelier.fichiers.existe(feuille.brut)
    for identifiant in images:
        image = atelier.base.lire_asset(identifiant)
        assert image is not None and image.supprime_le is None
        assert atelier.fichiers.existe(image.brut)
        assert image.planche == planche
    # On remonte encore d'une image à sa planche — elle dit qu'elle est partie.
    depuis_image = _liste(client, images[0])
    assert depuis_image["refaisable"] is False
    assert "supprimée" in depuis_image["raison"]
    assert len(depuis_image["depliages"][0]["images"]) == 4
    refus = client.post(
        f"/api/assets/{images[0]}/unfoldings", json={"boites": [[0, 0, 20, 20]]}
    )
    assert refus.status_code == 409
    assert refus.json()["code"] == "depliage_refuse"


# ── La règle des rangs, pour tout ce qui range à côté ────────────────────────


def test_le_miroir_passe_au_dessus_des_rangs_reserves(client, atelier, double):
    """Le miroir d'une image dépliée tombe dans le dossier de sa planche. Avant
    P1b il ne lisait pas les rangs réservés : un dépliage supprimé et purgé lui
    rendait un rang qui, lui, ne se redonne jamais."""
    planche = _lot(client, double)
    generation = planche.rsplit("-", 1)[0]
    coupes = _proposition(client, planche)["boites"]
    second = _refaire(client, planche, coupes)["depliage"]
    client.delete(f"/api/assets/{planche}/unfoldings/2").raise_for_status()
    _purger(atelier)
    (premier, _) = _liste(client, planche)["depliages"]

    miroir = client.post(
        f"/api/assets/{premier['images'][0]['identifiant']}/mirror",
        json={"direction": "ouest"},
    )

    assert miroir.status_code == 201, miroir.text
    assert miroir.json()["miroir"]["rang"] > max(second["rangs"])
    # Le calcul commun, que la superposition et « enregistrer sous » lisent aussi.
    assert rang_libre(atelier.base, generation) > max(second["rangs"])
    assert rang_libre(atelier.base, generation, plancher=0) > max(second["rangs"])


# ── Réseau coupé ─────────────────────────────────────────────────────────────


def test_aucun_geste_de_depliage_nappelle_le_fournisseur(client, atelier, double):
    planche = _lot(client, double)
    appels = double.appels
    double.echec = ErreurAtelier("réseau coupé")

    coupes = _proposition(client, planche)["boites"]
    _refaire(client, planche, coupes)
    _liste(client, planche)
    client.delete(f"/api/assets/{planche}/unfoldings/1").raise_for_status()
    client.get(f"/api/assets/{planche}/dependents").raise_for_status()

    assert double.appels == appels
