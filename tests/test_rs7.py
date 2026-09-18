# -*- coding: utf-8 -*-
"""Les critères de RS7 — découper à l'arrivée (`docs/PLAN-references-du-sujet.md`).

**Le geste que ça retire, relevé le 18 septembre 2026** : l'auteur ouvrait la
découpe de chaque planche refaite de Champy, la coupait en quatre, enregistrait
les quatre images, puis posait « champy 01 » sur chacune. Cochée, la case
*Découper à l'arrivée* fait la découpe toute seule quand la planche revient —
**et ne coupe rien si le compte des vues tombe faux** : mieux vaut une planche
entière qu'une découpe fausse.

**Ce qui se mesure ici, sans un centime** — le double du fournisseur rend une
planche de N sujets (`planche_sujets`) : le drapeau part, se refuse sans la
mise en page, se relit à la relance ; la planche se coupe au bon compte, ne se
coupe pas au mauvais ; sans référence planche, aucun contrôle ; chaque morceau
est au sujet, sans pose, avec sa recette et la feuille pour parent ; une feuille
marquée ne se recoupe jamais ; la découpe à la main reste possible ; et l'ordre
des vues, que RS8 lira, est une fonction pure.
"""

from __future__ import annotations

import itertools
import time

import pytest

from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.recette import Grille, Recette
from atelier.image.decoupe import decouper, en_ordre_de_lecture, ordre_des_vues
from atelier.mcp.serveur import creer_serveur
from mcp.server.mcpserver.exceptions import MCPServerError
from tests.conftest import planche_sujets

MODELE = "essai:rend-du-png"
NOM = "champy 01"

_DISTINCTES = itertools.count(1)


# ── Les montages ─────────────────────────────────────────────────────────────


def _creer(client, nom: str = "Champy") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _jeu(client) -> None:
    reponse = client.put(
        "/api/universe", json={"vue": "vue-dessus-34", "fond": "#FF70B5"}
    )
    assert reponse.status_code == 200, reponse.text


def _importer(client, tmp_path, octets: bytes) -> str:
    fichier = tmp_path / f"reference-{next(_DISTINCTES)}.png"
    fichier.write_bytes(octets)
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    # Les mêmes octets deux fois sont un doublon : l'import rend le premier.
    corps = reponse.json()
    return (corps["asset"] or corps["doublon"])["identifiant"]


def _ranger_planche(client, chose: str, asset: str) -> None:
    reponse = client.put(
        f"/api/characters/{chose}/references", json={"asset": asset, "usage": "planche"}
    )
    assert reponse.status_code == 200, reponse.text


def _nommer(atelier) -> Recette:
    atelier.assets.nommer(
        NOM, Recette(grille=Grille(cible=32, occupation=80)), atelier.bibliotheque.courant
    )
    return atelier.assets.recettes()[NOM]


def _poster(client, **corps):
    return client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "the character holds a staff", **corps},
    )


def _generer(client, **corps) -> dict:
    """Soumet, puis attend **la marque de la découpe** quand elle est demandée —
    la génération se dit réussie avant que sa feuille soit coupée."""
    reponse = _poster(client, **corps)
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    lue: dict = {}
    for _ in range(200):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("echouee", "interrompue"):
            break
        if lue["statut"] == "reussie":
            marque = lue["emplacements"][0].get("decoupe")
            if not corps.get("decouper_a_l_arrivee") or (
                marque is not None and not marque.get("en_cours")
            ):
                break
        time.sleep(0.05)
    assert lue["statut"] == "reussie", lue
    return lue


def _refaite(
    client, tmp_path, double, *, vues: int, rendues: int, nom: str = "Champy"
) -> tuple[dict, dict]:
    """Un sujet dont la planche rangée a `vues` vues, et un appel qui en rend
    `rendues` — découpe à l'arrivée cochée."""
    chose = _creer(client, nom)
    _jeu(client)
    _ranger_planche(client, chose["identifiant"], _importer(client, tmp_path, planche_sujets(vues)))
    double.rendre = lambda: planche_sujets(rendues)
    generation = _generer(
        client,
        personnage=chose["identifiant"],
        garder_mise_en_page=True,
        decouper_a_l_arrivee=True,
    )
    return chose, generation


def _enfants(atelier, feuille: str) -> list:
    return atelier.assets._base.enfants(feuille)


# ── Le drapeau ───────────────────────────────────────────────────────────────


def test_le_drapeau_ne_sécrit_que_sil_est_vrai():
    assert "decouper_a_l_arrivee" not in Demande(prompt="x").resume()
    assert Demande(
        prompt="x", garder_mise_en_page=True, decouper_a_l_arrivee=True
    ).resume()["decouper_a_l_arrivee"] is True


def test_sans_la_mise_en_page_le_drapeau_est_refuse(client, double):
    with pytest.raises(DemandeRefusee, match="garder la mise en page"):
        Demande(prompt="x", decouper_a_l_arrivee=True)

    refus = _poster(client, decouper_a_l_arrivee=True)
    assert refus.status_code == 409, refus.text
    assert "découper à l'arrivée coupe une planche refaite" in refus.text
    assert double.appels == 0


def test_la_relance_relit_le_drapeau(client, atelier, tmp_path, double):
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=4)
    lue = atelier.generations._base.lire(generation["identifiant"])
    assert lue.demande["decouper_a_l_arrivee"] is True

    relue = atelier.generations.demande_preparee(lue)
    assert relue.decouper_a_l_arrivee is True and relue.garder_mise_en_page is True


# ── La découpe ───────────────────────────────────────────────────────────────


def test_le_bon_compte_coupe_la_planche(client, atelier, tmp_path, double):
    chose = _creer(client)
    _jeu(client)
    nommee = _nommer(atelier)
    assert client.put(
        f"/api/characters/{chose['identifiant']}/recipe", json={"recette": NOM}
    ).status_code == 200
    _ranger_planche(client, chose["identifiant"], _importer(client, tmp_path, planche_sujets(4)))
    double.rendre = lambda: planche_sujets(4)

    generation = _generer(
        client,
        personnage=chose["identifiant"],
        garder_mise_en_page=True,
        decouper_a_l_arrivee=True,
    )
    feuille = f"{generation['identifiant']}-0"
    marque = generation["emplacements"][0]["decoupe"]

    assert marque["attendu"] == 4
    assert len(marque["morceaux"]) == 4
    assert double.appels == 1  # la découpe n'a rien appelé
    morceaux = [atelier.assets.lire(i) for i in marque["morceaux"]]
    for morceau in morceaux:
        # **Au sujet, sans pose ni direction**, la feuille pour parent.
        assert morceau.personnage == chose["identifiant"]
        assert morceau.pose is None and morceau.direction is None
        assert morceau.parent == feuille
        # **La recette du sujet** (RS6), grille comprise.
        assert morceau.recette.nom == NOM
        assert morceau.recette.grille == nommee.grille
        assert morceau.consomme == 0.0
    # La feuille elle-même garde son seul détourage.
    assert atelier.assets.lire(feuille).recette.grille is None

    # **Lisible sur la fiche de la feuille.**
    fiche = client.get(f"/api/assets/{feuille}").json()
    assert fiche["decoupe_a_l_arrivee"]["morceaux"] == marque["morceaux"]


def test_les_morceaux_sont_dans_lordre_des_vues(client, atelier, tmp_path, double):
    """La n-ième image est la n-ième vue — de gauche à droite, puis de haut en
    bas. C'est la liste que RS8 lira pour ranger chaque vue dans sa direction."""
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=4)
    marque = generation["emplacements"][0]["decoupe"]
    feuille = atelier.assets.lire(f"{generation['identifiant']}-0")
    fichiers = atelier.assets._fichiers

    # La même détection que la découpe à la main, remise dans l'ordre des vues.
    boites = ordre_des_vues(
        [tuple(b) for b in atelier.decoupe.proposer(feuille.identifiant)["boites"]]
    )
    (x0, y0, *_), (x1, y1, *_), (x2, y2, *_), (x3, y3, *_) = boites
    assert x0 < x1 and x2 < x3 and max(y0, y1) < min(y2, y3)

    attendus = decouper(fichiers.lire(feuille.brut), boites)
    morceaux = [atelier.assets.lire(i) for i in marque["morceaux"]]
    assert [fichiers.lire(m.brut) for m in morceaux] == attendus


def test_un_compte_faux_ne_coupe_rien_et_dit_pourquoi(client, atelier, tmp_path, double):
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=3)
    feuille = f"{generation['identifiant']}-0"
    marque = generation["emplacements"][0]["decoupe"]

    assert "morceaux" not in marque
    assert marque["attendu"] == 4 and marque["trouvees"] == 3
    assert "3 zones sur la planche, 4 attendues" in marque["raison"]
    assert "rien n'est coupé" in marque["raison"]
    assert _enfants(atelier, feuille) == []
    # La planche est entrée, entière, et réussie.
    assert generation["statut"] == "reussie"
    assert atelier.assets.lire(feuille) is not None
    fiche = client.get(f"/api/assets/{feuille}").json()
    assert fiche["decoupe_a_l_arrivee"]["raison"] == marque["raison"]


def test_sans_planche_rangee_aucun_controle_du_compte(client, atelier, tmp_path, double):
    """La mise en page vient de l'image jointe à la main : on coupe ce qu'on
    trouve, sans compte à tenir."""
    chose = _creer(client)
    _jeu(client)
    jointe = _importer(client, tmp_path, planche_sujets(4))
    double.rendre = lambda: planche_sujets(3)

    generation = _generer(
        client,
        personnage=chose["identifiant"],
        references=[{"asset": jointe}],
        garder_mise_en_page=True,
        decouper_a_l_arrivee=True,
    )
    marque = generation["emplacements"][0]["decoupe"]

    assert marque["attendu"] is None
    assert len(marque["morceaux"]) == 3
    feuille = f"{generation['identifiant']}-0"
    assert {a.identifiant for a in _enfants(atelier, feuille)} == set(marque["morceaux"])


def test_une_seule_zone_sans_compte_ne_coupe_rien(client, atelier, tmp_path, double):
    chose = _creer(client)
    _jeu(client)
    jointe = _importer(client, tmp_path, planche_sujets(4))
    double.rendre = lambda: planche_sujets(1)

    generation = _generer(
        client,
        personnage=chose["identifiant"],
        references=[{"asset": jointe}],
        garder_mise_en_page=True,
        decouper_a_l_arrivee=True,
    )
    marque = generation["emplacements"][0]["decoupe"]
    assert "morceaux" not in marque and "1 zone sur la planche" in marque["raison"]


def test_sans_la_case_rien_nest_coupe(client, atelier, tmp_path, double):
    chose = _creer(client)
    _jeu(client)
    _ranger_planche(client, chose["identifiant"], _importer(client, tmp_path, planche_sujets(4)))
    double.rendre = lambda: planche_sujets(4)

    generation = _generer(
        client, personnage=chose["identifiant"], garder_mise_en_page=True
    )
    feuille = f"{generation['identifiant']}-0"

    assert "decouper_a_l_arrivee" not in generation["demande"]
    assert "decoupe" not in generation["emplacements"][0]
    assert _enfants(atelier, feuille) == []
    assert "decoupe_a_l_arrivee" not in client.get(f"/api/assets/{feuille}").json()


# ── Jamais deux fois ─────────────────────────────────────────────────────────


def test_une_feuille_coupee_ne_se_recoupe_pas(client, atelier, tmp_path, double):
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=4)
    feuille = f"{generation['identifiant']}-0"
    avant = {a.identifiant for a in _enfants(atelier, feuille)}
    assert len(avant) == 4

    # Le démarrage, rejoué deux fois : rien de neuf.
    recentes = atelier.generations.recentes(1000)
    assert atelier.decoupe.reprendre(recentes) == 0
    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 0
    lue = atelier.generations._base.lire(generation["identifiant"])
    assert atelier.decoupe.couper_a_l_arrivee(lue, lue.emplacements[0]) is False
    assert {a.identifiant for a in _enfants(atelier, feuille)} == avant

    # **Une feuille refusée ne se recoupe pas non plus**, même si l'on range
    # depuis une référence qui tomberait juste.
    _, refusee = _refaite(client, tmp_path, double, vues=4, rendues=3, nom="Pommier")
    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 0
    assert _enfants(atelier, f"{refusee['identifiant']}-0") == []


def test_le_demarrage_coupe_une_feuille_arrivee_sans_etre_coupee(
    client, atelier, tmp_path, double
):
    """L'atelier s'est arrêté entre l'arrivée et la découpe : le démarrage la
    fait, **une fois**."""
    decoupe = atelier.generations._decoupe
    atelier.generations._decoupe = None
    try:
        chose = _creer(client)
        _jeu(client)
        _ranger_planche(
            client, chose["identifiant"], _importer(client, tmp_path, planche_sujets(4))
        )
        double.rendre = lambda: planche_sujets(4)
        reponse = _poster(
            client,
            personnage=chose["identifiant"],
            garder_mise_en_page=True,
            decouper_a_l_arrivee=True,
        )
        identifiant = reponse.json()["identifiant"]
        for _ in range(100):
            if client.get(f"/api/generations/{identifiant}").json()["statut"] == "reussie":
                break
            time.sleep(0.05)
    finally:
        atelier.generations._decoupe = decoupe

    feuille = f"{identifiant}-0"
    assert _enfants(atelier, feuille) == []

    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 1
    assert len(_enfants(atelier, feuille)) == 4
    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 0
    assert len(_enfants(atelier, feuille)) == 4


def test_une_decoupe_interrompue_devient_une_raison_pas_une_seconde_decoupe(
    client, atelier, tmp_path, double
):
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=4)
    lue = atelier.generations._base.lire(generation["identifiant"])
    # Joue la coupure au milieu : la marque « en cours » est restée.
    lue.emplacements[0].decoupe = {"en_cours": True}
    atelier.decoupe._sauver(lue)
    feuille = f"{generation['identifiant']}-0"
    avant = len(_enfants(atelier, feuille))

    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 1
    relue = atelier.generations._base.lire(generation["identifiant"])
    assert "interrompue" in relue.emplacements[0].decoupe["raison"]
    assert len(_enfants(atelier, feuille)) == avant
    assert atelier.decoupe.reprendre(atelier.generations.recentes(1000)) == 0


def test_la_decoupe_a_la_main_reste_possible(client, atelier, tmp_path, double):
    _, generation = _refaite(client, tmp_path, double, vues=4, rendues=4)
    feuille = atelier.assets.lire(f"{generation['identifiant']}-0")
    automatiques = set(generation["emplacements"][0]["decoupe"]["morceaux"])

    milieu = feuille.largeur // 2
    reponse = client.post(
        f"/api/assets/{feuille.identifiant}/slices",
        json={
            "boites": [
                [0, 0, milieu - 1, feuille.hauteur - 1],
                [milieu, 0, feuille.largeur - 1, feuille.hauteur - 1],
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text
    nouvelles = {d["identifiant"] for d in reponse.json()["decoupes"]}
    assert len(nouvelles) == 2 and not (nouvelles & automatiques)
    # Les morceaux de l'arrivée sont toujours là.
    assert all(atelier.assets.lire(i) is not None for i in automatiques)


# ── L'agent ──────────────────────────────────────────────────────────────────


async def test_lagent_coupe_a_larrivee_par_defaut_avec_la_mise_en_page(atelier, double):
    await atelier.ouvrir()
    serveur = creer_serveur(atelier)
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, vue="vue-dessus-34", fond="#FF70B5")
    personnage = atelier.production.creer_personnage(projet, "Champy")
    planche = atelier.generations.importer(planche_sujets(4), "planche.png")["asset"][
        "identifiant"
    ]
    atelier.production.promouvoir_reference(
        projet, personnage.identifiant, planche, True, "planche"
    )
    double.rendre = lambda: planche_sujets(4)

    resultat = await serveur.call_tool(
        "generate_asset",
        {
            "subject": "the character holds a staff",
            "character": personnage.identifiant,
            "keep_reference_layout": True,
        },
    )
    assert not resultat.is_error
    await atelier.generations.attendre_tout()

    generation = atelier.generations.recentes(1)[0]
    assert generation.demande["decouper_a_l_arrivee"] is True
    for _ in range(100):
        generation = atelier.generations._base.lire(generation.identifiant)
        if generation.emplacements[0].decoupe and not generation.emplacements[0].decoupe.get("en_cours"):
            break
        time.sleep(0.05)
    assert len(generation.emplacements[0].decoupe["morceaux"]) == 4

    # **Demandée sans la mise en page**, la même phrase que la route.
    try:
        refus = await serveur.call_tool(
            "generate_asset", {"subject": "a barrel", "cut_on_arrival": True}
        )
        texte = " ".join(b.text for b in refus.content if hasattr(b, "text"))
        assert refus.is_error
    except MCPServerError as erreur:
        texte = str(erreur)
    assert "découper à l'arrivée coupe une planche refaite" in texte


# ── L'ordre des vues (l'accroche de RS8) ─────────────────────────────────────


def test_lordre_des_vues_lit_de_gauche_a_droite_puis_de_haut_en_bas():
    # Une grille 2 × 2 dont les vues ne sont pas alignées au pixel près.
    sud = (10, 12, 40, 60)
    est = (60, 8, 90, 58)
    nord = (12, 80, 42, 130)
    ouest = (58, 84, 88, 128)
    assert ordre_des_vues([ouest, nord, est, sud]) == [sud, est, nord, ouest]


def test_une_rangee_ne_sallonge_pas_de_proche_en_proche():
    """Le défaut que `en_ordre_de_lecture` laisse passer : une vue plus haute
    que la première élargit la bande, et une vue qui ne touche pas la première
    y tombe. Ici, chaque boîte se compare à celle qui ouvre la rangée."""
    premiere = (0, 0, 10, 40)  # centre 20
    haute = (20, 10, 30, 70)  # centre 40 : dans la hauteur de la première
    dessous = (40, 50, 50, 80)  # centre 65 : ne touche pas la première
    assert en_ordre_de_lecture([premiere, haute, dessous]) == [premiere, haute, dessous]
    # Même ordre ici, mais pour une autre raison : `dessous` ouvre sa propre
    # rangée. Posée plus à gauche, elle passe donc après les deux autres.
    assert ordre_des_vues([premiere, haute, dessous]) == [premiere, haute, dessous]
    a_gauche = (0, 50, 5, 80)  # à gauche de `haute`, sous la première
    assert ordre_des_vues([a_gauche, haute, premiere]) == [premiere, haute, a_gauche]
    assert en_ordre_de_lecture([a_gauche, haute, premiere]) != [premiere, haute, a_gauche]


def test_une_vue_plus_haute_garde_sa_voisine():
    haute = (0, 0, 30, 100)  # centre 50
    voisine = (40, 30, 70, 60)  # centre 45 : même rangée que la haute
    dessous_gauche = (0, 110, 30, 140)  # centre 125
    dessous_droite = (40, 90, 70, 150)  # centre 120
    ordre = ordre_des_vues([dessous_droite, voisine, dessous_gauche, haute])
    assert ordre == [haute, voisine, dessous_gauche, dessous_droite]


def test_une_seule_rangee_et_le_vide():
    a, b, c = (0, 0, 9, 9), (20, 3, 29, 12), (40, 1, 49, 10)
    assert ordre_des_vues([c, a, b]) == [a, b, c]
    assert ordre_des_vues([]) == []
    assert ordre_des_vues([a]) == [a]
