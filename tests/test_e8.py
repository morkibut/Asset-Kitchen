# -*- coding: utf-8 -*-
"""Les critères de E8 qui vivent côté serveur — l'assistant de démarrage.

**Ce qui se mesure ici** : qu'un choix unique remplit tous les endroits qui
doivent s'accorder, que le produit ne réécrit jamais ce que l'auteur a tapé, que
la base d'étiquettes appartient à l'atelier et part vide, et qu'un changement
coûteux annonce ses chiffres sans jamais bloquer. Ce que l'écran montre — les
dix étapes, les deux humeurs, les vignettes — vit dans
`interface/src/App.test.tsx`.

**La panne que tout ça répare est mesurée sur le vrai projet** : le réglage
disait 128 pendant que le texte envoyé disait 64, **trois fois**, et le nombre
de directions était retapé **sept fois** sans que rien ne relie ces sept
endroits.
"""

from __future__ import annotations

from atelier.domaine.projet import BAREME_PAR_DEFAUT, CHAMPS_BIBLE
from atelier.domaine.vue import TAILLES, VUES, phrase_de_calage, phrase_de_grille, vue


def _univers(client) -> dict:
    return client.get("/api/universe").json()["univers"]


def _case(client, nom: str) -> dict:
    return next(c for c in _univers(client)["bible"] if c["nom"] == nom)


# ── Les deux listes fermées ──────────────────────────────────────────────────


def test_les_huit_vues_et_les_neuf_tailles_se_servent_du_serveur(client):
    """**Deux listes fermées, servies par le serveur** — pas écrites à l'écran.

    C'est le même choix qui remplit le réglage *et* la phrase de la bible : deux
    listes tenues à deux endroits finiraient par proposer une vue dont le
    serveur ne saurait rien écrire.
    """
    recu = client.get("/api/universe/views").json()

    assert len(recu["vues"]) == 8
    assert len(recu["tailles"]) == 9
    # Chaque vue dit combien d'images une pose demande — c'est le chiffre qui
    # multiplie toute la production, donc tout ce qu'on paiera.
    assert all(v["images"] >= 1 for v in recu["vues"])
    assert {v["identifiant"] for v in recu["vues"]} == {v.identifiant for v in VUES}


def test_la_tuile_est_entree_au_bareme(client):
    """**Un type manquait, et le projet en fabriquait déjà.**

    Sa description dit `grid-aligned tile assets` et un outil découpe une
    planche en tuiles ; mais « tuile » n'était dans aucune liste, donc une tuile
    arrivait en « décor » et occupait toute sa case sans que ce soit un choix.
    """
    noms = [e["nom"] for e in _univers(client)["bareme"]]

    assert "tuile" in noms
    assert len(noms) == len(BAREME_PAR_DEFAUT) == 8
    tuile = next(e for e in _univers(client)["bareme"] if e["nom"] == "tuile")
    # Une tuile remplit son cadre : elle n'a pas de contour à détourer.
    assert tuile["silhouette"] is False


# ── « Un choix unique remplit le réglage et la phrase » ──────────────────────


def test_la_vue_ecrit_sa_phrase_dans_la_case_vue(client):
    """Elle est écrite **juste, la première fois**, sans qu'on ait à y penser."""
    client.put("/api/universe", json={"vue": "vue-dessus-34"})

    assert _univers(client)["vue"] == "vue-dessus-34"
    assert _case(client, "vue")["texte"] == vue("vue-dessus-34").phrase


def test_la_taille_ecrit_la_grille_et_le_calage(client):
    """**La contradiction mesurée du dépôt, réparée à sa source.**

    Le réglage disait 128 pendant que le texte envoyé disait 64, trois fois. Les
    deux ne peuvent plus diverger parce qu'ils viennent du même geste.
    """
    client.put("/api/universe", json={"cible_px": 128})

    assert _univers(client)["cible_px"] == 128
    assert _case(client, "rendu")["texte"] == phrase_de_grille(128)
    assert _case(client, "technique")["texte"] == phrase_de_calage(128)
    assert "128x128" in _case(client, "technique")["texte"]

    # Et changer de taille réécrit les deux — c'est ce qui interdit la dérive.
    client.put("/api/universe", json={"cible_px": 32})
    assert "32x32" in _case(client, "rendu")["texte"]
    assert "128" not in _case(client, "technique")["texte"]


def test_le_nombre_de_directions_ne_part_plus_dans_le_texte(client):
    """**Retiré le 31 août 2026, et la raison est mesurée.**

    Cette phrase partait avec les vingt-huit générations du projet, dont six
    planches d'équipement où elle **contredisait la consigne de l'appel** : on
    demandait une pièce posée à plat, et la bible réclamait quatre orientations.
    Elle ne manque pas — chaque image dit déjà elle-même la direction qu'elle
    montre, case par case.
    """
    client.put("/api/universe", json={"vue": "vue-dessus-34", "cible_px": 64})

    for nom in CHAMPS_BIBLE:
        assert "directional" not in _case(client, nom)["texte"]


def test_le_produit_ne_reecrit_jamais_ce_que_l_auteur_a_tape(client):
    """**La borne qui rend la réécriture sûre.**

    Sans elle, changer une taille effacerait sous les yeux de l'auteur une
    description qu'il a mis du temps à trouver, et « c'est du texte libre »
    cesserait d'être vrai.
    """
    a_la_main = "chunky 2D pixel art, hand-placed, no snapping at all"
    client.put(
        "/api/universe",
        json={"bible": [{"nom": "rendu", "texte": a_la_main, "actif": True}]},
    )

    client.put("/api/universe", json={"cible_px": 96})

    assert _case(client, "rendu")["texte"] == a_la_main
    # La case que l'auteur n'a pas touchée, elle, reçoit sa phrase.
    assert "96x96" in _case(client, "technique")["texte"]


def test_sans_cible_aucune_phrase_n_est_ecrite(client):
    """« Un univers vide ne contraint rien » (US-57), et *aucune* est une valeur.

    Écrire `no pixel grid` serait une affirmation que personne n'a faite.
    """
    client.put("/api/universe", json={"cible_px": 128})
    assert _case(client, "rendu")["texte"]

    client.put("/api/universe", json={"cible_px": 0})
    assert _case(client, "rendu")["texte"] == ""
    assert _case(client, "technique")["texte"] == ""


def test_une_vue_inconnue_est_refusee_en_la_nommant(client):
    reponse = client.put("/api/universe", json={"vue": "vue-de-cote-en-diagonale"})

    assert reponse.status_code == 409
    assert "vue inconnue" in reponse.json()["raison"]


# ── « Un changement qui casse du travail payé annonce les vrais chiffres » ────


def test_les_consequences_disent_le_compte_et_ne_bloquent_jamais(client, double):
    """**Rien n'est jamais grisé dans l'assistant.**

    Le produit n'a qu'un seul refus automatique — le compte d'images — et en
    ajouter un deuxième reviendrait à bloquer un auteur sur son propre jeu. Un
    chiffre exact aide mieux qu'une case grise.
    """
    client.put("/api/universe", json={"cible_px": 64})
    client.post(
        "/api/generations",
        json={"modele": "essai/rend-du-png", "prompt": "un sujet d'essai"},
    )

    dit = client.get("/api/universe/consequences", params={"cible_px": 128}).json()
    assert dit["cible"] == 64
    assert dit["images"] >= 1
    # Le coût vient de ce qui a été payé dans ce jeu, jamais d'un tarif écrit.
    assert dit["cout_usd"] > 0

    # Et le réglage passe quand même.
    assert client.put("/api/universe", json={"cible_px": 128}).status_code == 200


def test_la_meme_taille_ne_casse_rien(client):
    """Une question posée sur ce qui ne change pas a une réponse, et c'est zéro."""
    client.put("/api/universe", json={"cible_px": 64})
    dit = client.get("/api/universe/consequences", params={"cible_px": 64}).json()

    assert dit["images"] == 0
    assert dit["cout_usd"] == 0


# ── Les étiquettes ───────────────────────────────────────────────────────────


def test_la_base_d_etiquettes_part_vide(client):
    """**Personne ne l'écrit à la place de l'auteur.**

    Au premier jeu, l'étape de l'allure est donc sept champs de texte libre, et
    elle le dit franchement plutôt que de faire semblant.
    """
    assert client.get("/api/labels").json()["etiquettes"] == []


def test_une_etiquette_est_une_paire_et_les_deux_moities_sont_exigees(client):
    """Une étiquette sans texte anglais ne fait rien partir ; une étiquette sans
    libellé ne se clique pas. C'est la paire qui est l'objet."""
    sans_anglais = client.post(
        "/api/labels", json={"libelle": "brume basse", "texte": "   ", "case": "eclairage"}
    )
    assert sans_anglais.status_code in (409, 422)

    inconnue = client.post(
        "/api/labels",
        json={"libelle": "brume basse", "texte": "low fog", "case": "ambiance"},
    )
    assert inconnue.status_code == 409
    assert "case de bible inconnue" in inconnue.json()["raison"]


def test_une_etiquette_appartient_a_l_atelier_et_pas_a_un_projet(client):
    """**Comme la clé du fournisseur, elle ne dépend d'aucun jeu.**

    Un deuxième jeu part de ce que le premier a nommé — rangée par projet, la
    base repartirait vide à chaque fois et le mécanisme ne servirait jamais.
    """
    client.post(
        "/api/labels",
        json={
            "libelle": "brume basse",
            "texte": "thick low-lying fog, volumetric haze",
            "case": "eclairage",
        },
    )
    autre = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()["projet"]
    client.put("/api/projects/current", json={"projet": autre["identifiant"]})

    (etiquette,) = client.get("/api/labels").json()["etiquettes"]
    assert etiquette["libelle"] == "brume basse"
    assert etiquette["texte"] == "thick low-lying fog, volumetric haze"
    assert etiquette["case"] == "eclairage"


def test_deux_fois_le_meme_libelle_dans_la_meme_case_est_refuse(client):
    charge = {"libelle": "brume basse", "texte": "low fog", "case": "eclairage"}
    assert client.post("/api/labels", json=charge).status_code == 201

    encore = client.post("/api/labels", json=charge)
    assert encore.status_code == 409
    assert "existe déjà" in encore.json()["raison"]

    # Le même libellé dans une autre case, en revanche, est une autre étiquette :
    # « brume basse » ne dit pas la même chose au trait qu'à l'éclairage.
    ailleurs = {**charge, "case": "trait"}
    assert client.post("/api/labels", json=ailleurs).status_code == 201


def test_les_plus_employees_passent_devant(client):
    """**Un compte, jamais un classement enregistré** : l'ordre de fabrication
    départage les ex æquo, et c'est celui que l'auteur reconnaît."""
    for libelle in ("brume basse", "contre-jour", "lueur de forge"):
        client.post(
            "/api/labels",
            json={"libelle": libelle, "texte": f"{libelle} en anglais", "case": "eclairage"},
        )
    milieu = client.get("/api/labels").json()["etiquettes"][1]["identifiant"]

    client.post(f"/api/labels/{milieu}/used")
    client.post(f"/api/labels/{milieu}/used")

    devant = client.get("/api/labels").json()["etiquettes"]
    assert max(devant, key=lambda e: e["emplois"])["identifiant"] == milieu
    assert max(e["emplois"] for e in devant) == 2


def test_oublier_une_etiquette_ne_touche_a_aucune_case(client):
    """**Jamais de cascade** : le texte est parti dans la case au moment du clic,
    et l'étiquette n'en est que l'origine."""
    client.post(
        "/api/labels",
        json={"libelle": "brume basse", "texte": "low fog", "case": "eclairage"},
    )
    (etiquette,) = client.get("/api/labels").json()["etiquettes"]
    client.put(
        "/api/universe",
        json={"bible": [{"nom": "eclairage", "texte": "low fog", "actif": True}]},
    )

    client.delete(f"/api/labels/{etiquette['identifiant']}")

    assert client.get("/api/labels").json()["etiquettes"] == []
    assert _case(client, "eclairage")["texte"] == "low fog"


def test_toutes_les_tailles_ont_leur_phrase(client):
    """Le domaine sait écrire pour chacune des neuf : sans ça, une taille
    proposée serait une taille dont le texte resterait vide."""
    for cible, quoi in TAILLES:
        assert str(cible) in phrase_de_grille(cible)
        assert str(cible) in phrase_de_calage(cible)
        assert quoi
