# -*- coding: utf-8 -*-
"""Les critères d'acceptation de R2 — ce qui décide de l'apparence se voit et se règle.

Un test par critère de `docs/PLAN.md` § R2, nommé d'après lui.

**Le défaut que cette tranche répare est un défaut de composition**, pas de
code : « la dérive de grille est le cas normal » et « le style vient de la bible
et d'un seul endroit » sont justes séparément, et leur composition produisait un
atelier qui imposait une apparence que l'auteur n'avait jamais posée — sans
jamais lui montrer laquelle. Trois tests le disent en une phrase chacun : le
texte exact se lit avant de partir, la bible a de quoi porter l'apparence, et la
remise sur grille a une échappatoire.

Trois critères ne se vérifient pas ici parce qu'ils portent sur ce que l'écran
affiche — le dépliant qui suit la frappe, le champ décoché qui disparaît de
l'aperçu à l'instant, la fiche qui distingue l'imposé du réglé à la main. Ceux-là
vivent dans `interface/src/App.test.tsx`.

**Aucun test de ce fichier ne coûte un centime**, et l'un le prouve plutôt que de
l'affirmer, en comptant les appels du double autour de l'aperçu, de la reprise du
texte et du réglage de la bible.
"""

from __future__ import annotations

import time

import pytest

from atelier.domaine.projet import AUCUNE_CIBLE, CHAMPS_BIBLE

MODELE = "essai/rend-du-png"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _bible(client, **textes: str) -> dict:
    """Poser des champs de bible **par leur nom**, les autres restant vides.

    La route accepte la bible entière ; ce helper évite de recopier sept lignes
    à chaque test, et surtout de les recopier *dans l'ordre* — la liste close
    décide de l'ordre, pas l'appelant.
    """
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": textes.get(nom, ""), "actif": True}
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["univers"]


def _apercu(client, prompt: str = "un tonneau", **corps) -> dict:
    reponse = client.post("/api/prompt/preview", json={"prompt": prompt, **corps})
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _origines(apercu: dict) -> list[str]:
    return [partie["origine"] for partie in apercu["parties"]]


def _generer(client, **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un tonneau", **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")


def _asset_de(client, generation: dict) -> dict:
    """L'asset né du premier emplacement. Son identifiant est celui de la
    génération suffixé du rang — le produit n'en tire aucun au sort."""
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _creer_personnage(client) -> str:
    reponse = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _poses(client) -> list[str]:
    return [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]


# ── « Avant de lancer, le texte exact qui partira s'affiche : bible active,
#     sujet, consignes de pliage — dans l'ordre d'envoi, sans rien de
#     masqué » ────────────────────────────────────────────────────────────────


def test_l_apercu_rend_la_bible_le_sujet_puis_la_planche_dans_cet_ordre(client):
    """Les trois origines, dans l'ordre d'envoi, et le texte qui les joint.

    L'ordre n'est pas une préférence d'affichage : c'est celui du prompt. La
    bible se replie en tête (US-53), les consignes de planche en queue parce
    qu'elles parlent du sujet décrit au-dessus.
    """
    _bible(client, monde="marais de fer", trait="contour brun d'un pixel")
    personnage = _creer_personnage(client)

    apercu = _apercu(
        client, "un nain forgeron", personnage=personnage, poses=_poses(client)[:3]
    )

    assert _origines(apercu) == ["bible", "sujet", "planche"]
    assert apercu["texte"] == "\n\n".join(p["texte"] for p in apercu["parties"])


def test_l_apercu_ne_masque_rien_du_texte_qui_part(client, double):
    """**Le seul juge acceptable** : ce que l'aperçu montrait, et ce que le
    fournisseur a reçu.

    Un aperçu vérifié contre lui-même ne prouverait que lui-même. Celui-ci
    compare le texte annoncé avant l'appel à celui qui est arrivé au bout du
    port — caractère pour caractère.
    """
    _bible(client, monde="marais de fer", rendu="pixel art 16 bits")
    annonce = _apercu(client, "un tonneau cerclé")["texte"]

    _generer(client, prompt="un tonneau cerclé")

    assert double.demandes[-1].prompt == annonce


def test_l_apercu_suit_ce_qu_on_decoche(client):
    """Décocher un champ le retire de ce qui part — la moitié serveur du critère.

    L'écran ne recompose rien : il redemande. C'est donc ici que « décocher un
    champ le retire de l'aperçu » se joue vraiment.
    """
    _bible(client, monde="marais de fer", trait="contour brun")
    assert "Line and shading: contour brun" in _apercu(client)["texte"]

    client.put(
        "/api/universe",
        json={
            "bible": [
                {
                    "nom": nom,
                    "texte": {"monde": "marais de fer", "trait": "contour brun"}.get(
                        nom, ""
                    ),
                    # Le trait est **éteint**, pas vidé : c'est le geste du
                    # doseur, et son texte doit survivre à l'extinction.
                    "actif": nom != "trait",
                }
                for nom in CHAMPS_BIBLE
            ]
        },
    )

    apres = _apercu(client)
    assert "Line and shading" not in apres["texte"]
    assert "World: marais de fer" in apres["texte"]
    # Le texte éteint est toujours là, il ne part simplement plus.
    univers = client.get("/api/universe").json()["univers"]
    assert {c["nom"]: c["texte"] for c in univers["bible"]}["trait"] == "contour brun"


# ── « Le texte repris à la main part mot pour mot, et `generation.json` porte
#     ce texte-là » ───────────────────────────────────────────────────────────


def test_le_texte_repris_part_mot_pour_mot(client, double):
    """Ni bible en tête, ni consignes en queue : ce qui est écrit est ce qui part."""
    _bible(client, monde="marais de fer")
    a_la_main = "a plain wooden barrel, painterly, soft light"

    generation = _generer(client, prompt=a_la_main, repris=True)

    assert double.demandes[-1].prompt == a_la_main
    assert generation["demande"]["prompt"] == a_la_main
    assert generation["demande"]["repris"] is True


def test_le_texte_repris_n_ecrit_rien_dans_l_univers(client):
    """« Corriger une formulation sans démonter la bible de mon projet » (US-159)."""
    avant = _bible(client, monde="marais de fer", trait="contour brun")

    _generer(client, prompt="tout autre chose, écrite à la main", repris=True)

    apres = client.get("/api/universe").json()["univers"]
    assert apres["bible"] == avant["bible"]


def test_une_relance_renvoie_le_texte_qui_etait_parti(client, double):
    """**Reprise comprise** : la relance repart du texte enregistré, pas d'une
    recomposition.

    C'est ce qui rend vraie la promesse « une génération se relit des mois plus
    tard » : l'univers a pu changer entre-temps, la relance n'en tient pas
    compte — elle rejoue l'appel, à l'identique.
    """
    _bible(client, monde="marais de fer")
    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un tonneau", "variations": 2},
    )
    identifiant = reponse.json()["identifiant"]
    _attendre(client, identifiant)
    parti = double.demandes[-1].prompt

    # La bible change **après** l'appel : une recomposition à la relance
    # enverrait le nouveau texte, et c'est très exactement ce qu'on interdit.
    _bible(client, monde="tout autre chose")

    # Un emplacement raté, relancé : c'est le seul chemin de relance du produit.
    generation = client.get(f"/api/generations/{identifiant}").json()
    rang = generation["emplacements"][1]["rang"]
    client.post(f"/api/generations/{identifiant}/slots/{rang}/retry")
    _attendre(client, identifiant)

    assert double.demandes[-1].prompt == parti


# ── « La bible compte sept champs nommés, chacun activable indépendamment comme
#     les cinq premiers » ─────────────────────────────────────────────────────


def test_la_bible_compte_sept_champs_chacun_activable(client):
    univers = _bible(client, rendu="pixel art 16 bits", vue="trois quarts, corps entier")
    noms = [c["nom"] for c in univers["bible"]]
    assert noms == list(CHAMPS_BIBLE)
    assert len(noms) == 7

    # Chacun s'éteint pour lui seul, y compris les deux nouveaux.
    for nom in ("rendu", "vue"):
        client.put(
            "/api/universe",
            json={
                "bible": [
                    {
                        "nom": c,
                        "texte": {
                            "rendu": "pixel art 16 bits",
                            "vue": "trois quarts, corps entier",
                        }.get(c, ""),
                        "actif": c != nom,
                    }
                    for c in CHAMPS_BIBLE
                ]
            },
        )
        texte = _apercu(client)["texte"]
        intitule = {"rendu": "Rendering technique", "vue": "View and framing"}[nom]
        autre = {"rendu": "View and framing", "vue": "Rendering technique"}[nom]
        assert intitule not in texte
        assert autre in texte


# ── « Un projet écrit avant cette tranche s'ouvre avec ses deux nouveaux champs
#     vides et actifs, et rien de ce qu'il portait n'est perdu » ───────────────


def test_un_projet_ecrit_a_cinq_champs_s_ouvre_a_sept(atelier, client):
    """La migration ne demande **aucun geste**, et elle se prouve sur le disque.

    Le fichier est réécrit à la main dans sa forme d'avant R2 — cinq champs — et
    relu par le chemin ordinaire. C'est le seul juge : un projet fabriqué par le
    produit d'aujourd'hui porterait déjà sept champs et ne prouverait rien.
    """
    projet = atelier.bibliotheque.courant
    fiches = {p["identifiant"]: p for p in atelier.fichiers.lire_projets()}
    fiche = fiches[projet]
    fiche["univers"]["bible"] = [
        {"nom": "monde", "texte": "marais de fer", "actif": True},
        {"nom": "epoque", "texte": "avant la poudre", "actif": True},
        {"nom": "trait", "texte": "contour brun", "actif": False},
        {"nom": "eclairage", "texte": "", "actif": True},
        {"nom": "technique", "texte": "fond uni", "actif": True},
    ]
    atelier.fichiers.ecrire_projet(projet, fiche)
    atelier.bibliotheque.reconstruire()

    univers = client.get("/api/universe").json()["univers"]
    champs = {c["nom"]: c for c in univers["bible"]}

    assert [c["nom"] for c in univers["bible"]] == list(CHAMPS_BIBLE)
    # Les deux neufs : vides et actifs, donc ils ne partent pas.
    for nom in ("rendu", "vue"):
        assert champs[nom]["texte"] == ""
        assert champs[nom]["actif"] is True
    # Et rien de ce que le fichier portait n'est perdu, extinction comprise.
    assert champs["monde"]["texte"] == "marais de fer"
    assert champs["epoque"]["texte"] == "avant la poudre"
    assert champs["trait"] == {"nom": "trait", "texte": "contour brun", "actif": False}
    assert champs["technique"]["texte"] == "fond uni"


# ── « Taille de pixel "aucune" : l'image générée entre en bibliothèque aux
#     dimensions rendues par le modèle, sans rééchantillonnage » ───────────────


def test_aucune_cible_l_image_entre_aux_dimensions_rendues(client, double):
    """**Mesuré sur l'image**, pas sur la recette.

    Le double rend une image de 48 × 32 ; avec une cible, elle repartirait sur
    une grille carrée. Sans cible, elle doit rester ce que le modèle a rendu —
    et c'est la dimension mesurée qui le dit, pas l'absence d'un champ.
    """
    pose = client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})
    assert pose.status_code == 200, pose.text
    assert pose.json()["univers"]["cible_px"] == AUCUNE_CIBLE

    asset = _asset_de(client, _generer(client))

    assert asset["recette"]["grille"] is None
    assert (asset["rendu_largeur"], asset["rendu_hauteur"]) == (
        asset["largeur"],
        asset["hauteur"],
    )


def test_aucune_cible_le_detourage_et_le_recadrage_s_appliquent_toujours(client):
    """Ce qui disparaît est **une étape**, pas la nature du sujet.

    Le détourage et le recadrage suivent la silhouette de l'échelle, comme
    avant ; seule la remise sur grille s'en va. Le barème, lui, reste entier et
    réglable — c'est l'écran qui dit que son occupation n'agit plus.
    """
    client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})
    asset = _asset_de(client, _generer(client, echelle="personnage"))

    recette = asset["recette"]
    assert recette["grille"] is None
    assert len(recette["passes"]) == 1
    assert recette["recadrage"] is not None

    # Le barème n'a rien perdu : sa famille et sa silhouette continuent de
    # décider, et l'occupation qu'il porte reste lisible.
    bareme = client.get("/api/universe").json()["univers"]["bareme"]
    assert any(e["nom"] == "personnage" and e["occupation"] == 100 for e in bareme)


def test_aucune_cible_tout_realigner_ne_reechantillonne_rien_et_le_dit(client):
    """Le balayage **retire** la grille au lieu d'en poser une, et le compte le dit."""
    asset = _asset_de(client, _generer(client))
    assert asset["recette"]["grille"] is not None

    client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})
    reponse = client.post("/api/universe/realign", json={"identifiants": None})
    assert reponse.status_code == 200, reponse.text
    compte = reponse.json()

    assert compte["sur_grille"] is False
    assert compte["realignes"] >= 1
    relu = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert relu["recette"]["grille"] is None


def test_la_cible_refusee_reste_dans_ses_bornes_et_aucune_n_est_pas_un_trou(client):
    """« Aucune » passe ; 1, 2 et 4 pixels ne passent pas.

    Élargir le minimum à zéro aurait laissé entrer ces trois-là, qui ne sont ni
    une échappatoire ni une grille : c'est pourquoi zéro est traité à part.
    """
    assert client.put("/api/universe", json={"cible_px": 0}).status_code == 200
    refus = client.put("/api/universe", json={"cible_px": 4})
    assert refus.status_code == 409, refus.text
    assert "aucune" in refus.json()["raison"]
    # Et le refus n'a rien écrit.
    assert client.get("/api/universe").json()["univers"]["cible_px"] == AUCUNE_CIBLE


# ── « La fiche d'un asset nomme le traitement que le projet lui a imposé —
#     cible, occupation, palette — et le distingue de ce que l'auteur a réglé à
#     la main » ───────────────────────────────────────────────────────────────


def test_ce_que_le_projet_impose_se_lit_sur_l_asset(client):
    """La moitié serveur du critère : la recette imposée, et l'échelle qui
    explique son occupation."""
    asset = _asset_de(client, _generer(client, echelle="objet tenu"))

    reponse = client.get(f"/api/assets/{asset['identifiant']}/imposed")
    assert reponse.status_code == 200, reponse.text
    lu = reponse.json()

    assert lu["echelle"] == "objet tenu"
    assert lu["impose"]["grille"] == {
        "cible": 64,
        "occupation": 40,
        "ancrage": "bas",
        # **Zéro par défaut** (E17) : une image que le calibrage n'a pas touchée
        # rend exactement ce qu'elle rendait avant qu'il existe.
        "decalage": 0,
    }
    # Sans artwork officiel il n'y a pas de palette, et ce n'est pas un trou :
    # c'est l'état réel d'un univers vide, qui ne contraint rien (US-57).
    assert lu["impose"]["quantification"] is None


def test_ce_que_le_projet_impose_suit_le_projet_et_non_l_asset(client):
    """**Calculé, jamais rangé.** La question posée est « qu'est-ce que le projet
    impose *maintenant* » : une valeur enregistrée à la naissance aurait vieilli
    au premier réglage d'univers, et la fiche aurait comparé l'asset à un
    souvenir."""
    asset = _asset_de(client, _generer(client, echelle="objet tenu"))
    client.put("/api/universe", json={"cible_px": 32})

    lu = client.get(f"/api/assets/{asset['identifiant']}/imposed").json()

    assert lu["impose"]["grille"]["cible"] == 32
    # L'asset, lui, n'a pas bougé : « les assets déjà là ne bougent pas tout
    # seuls ». C'est cet écart que la fiche appelle « réglé à la main ».
    assert client.get(f"/api/assets/{asset['identifiant']}").json()["recette"][
        "grille"
    ]["cible"] == 64


# ── « Un univers vide ne contraint toujours rien : générer sans bible, sans
#     artwork et sans cible reste possible (US-57 reconduite) » ────────────────


def test_un_univers_vide_ne_contraint_toujours_rien(client, double):
    """Sans bible, sans artwork **et sans cible** : ce qui part est le sujet seul,
    et ce qui rentre est ce que le modèle a rendu."""
    client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})

    apercu = _apercu(client, "un tonneau")
    assert _origines(apercu) == ["sujet"]
    assert apercu["texte"] == "un tonneau"

    asset = _asset_de(client, _generer(client))
    assert double.demandes[-1].prompt == "un tonneau"
    assert asset["recette"]["grille"] is None


def test_l_apercu_d_un_champ_vide_montre_la_bible_seule(client):
    """L'atelier s'ouvre sur un champ vide : l'aperçu montre alors ce qui
    partirait quand même, et ne refuse pas."""
    _bible(client, monde="marais de fer")
    apercu = _apercu(client, "")
    assert _origines(apercu) == ["bible"]
    assert apercu["texte"] == "World: marais de fer"


# ── « Réseau coupé : l'aperçu du prompt, l'édition du texte et le réglage de la
#     bible fonctionnent » ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "geste",
    ["apercu", "bible", "cible", "impose"],
)
def test_rien_de_la_tranche_ne_demande_le_fournisseur(client, double, geste):
    """**Prouvé en comptant les appels du double**, pas affirmé.

    Composer le texte qui partira, le reprendre, régler la bible ou la cible et
    lire ce que le projet impose sont quatre gestes qui ne sortent pas de la
    machine. Le seul qui coûte est celui d'après : cliquer Générer.
    """
    # Un asset existe déjà — il a coûté un appel, et c'est le seul.
    asset = _asset_de(client, _generer(client))
    avant = double.appels

    if geste == "apercu":
        _apercu(client, "un tonneau", repris=True)
        _apercu(client, "un tonneau")
    elif geste == "bible":
        _bible(client, monde="marais de fer", vue="trois quarts")
    elif geste == "cible":
        client.put("/api/universe", json={"cible_px": AUCUNE_CIBLE})
        client.post("/api/universe/realign", json={"identifiants": None})
    else:
        client.get(f"/api/assets/{asset['identifiant']}/imposed")

    assert double.appels == avant
