# -*- coding: utf-8 -*-
"""TS3 · La première planche — la moitié serveur (`docs/PLAN-de-la-toile-au-sujet.md`).

Un sujet né d'une carte de la toile (TS2) a un concept art et un portrait, et
aucune planche. La première planche est la planche pliée d'E13 — la pose de
repos dans les **seules** directions du jeu, en un appel — où le concept art
part **comme le personnage à reproduire** (rôle référence, jamais style), puis
« C'est la référence » promeut la planche choisie en usage `planche` et range
ses vues.

**Rien ne coûte un centime** : le double du fournisseur rend ses images, et
*Relire avant l'envoi* se compose sans appel.
"""

from __future__ import annotations

import time

from tests.conftest import image_sujet, planche_sujets

from tests.test_t7 import appeler, mcp  # noqa: F401

MODELE = "essai:rend-du-png"
DESIGN = "THE CHARACTER DESIGN TO REPRODUCE"


# ── Les montages ─────────────────────────────────────────────────────────────


def _vue(client, identifiant: str = "vue-dessus-34") -> None:
    reponse = client.put("/api/universe", json={"vue": identifiant})
    assert reponse.status_code == 200, reponse.text


def _huit_directions(client) -> list[str]:
    _vue(client)
    for nom in ("nord-est", "nord-ouest", "sud-est", "sud-ouest"):
        reponse = client.post(
            "/api/characters/directions",
            json={"nom": nom, "consigne": f"facing {nom}"},
        )
        assert reponse.status_code == 201, reponse.text
    lues = client.get("/api/characters/directions").json()["directions"]
    assert len(lues) == 8, lues
    return [d["identifiant"] for d in lues]


def _sujet_de_la_toile(client, rang: int = 5, nom: str = "La sorcière") -> dict:
    """Le sujet de TS2 : une carte collée, un sujet créé depuis elle."""
    octets = image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12)
    carte = client.post(f"/api/board/paste?nom=carte-{rang}.png", content=octets)
    assert carte.status_code == 201, carte.text
    carte = carte.json()["carte"]
    cree = client.post(
        f"/api/board/{carte['identifiant']}/subject",
        json={"nom": nom, "description": "a swamp witch in a green cloak"},
    )
    assert cree.status_code == 201, cree.text
    return {**cree.json(), "carte": carte["identifiant"]}


def _envoi(client, **corps):
    return client.post("/api/outgoing", json={"modele": MODELE, "prompt": "", **corps})


def _generer(client, **corps):
    return client.post("/api/generations", json={"modele": MODELE, "prompt": "x", **corps})


def _attendre(client, identifiant: str, tours: int = 80) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


# ── 1. Ce que la première planche demande ────────────────────────────────────


def test_la_premiere_planche_se_lit_avant_de_payer(client):
    _vue(client)
    sujet = _sujet_de_la_toile(client)
    ident = sujet["personnage"]["identifiant"]

    lue = client.get(f"/api/characters/{ident}/first-sheet")

    assert lue.status_code == 200, lue.text
    corps = lue.json()
    assert corps["pose"] == "repos"
    assert corps["directions"] == ["sud", "nord", "est", "ouest"]
    # **La carte, pas la copie** : une seule image, celle du concept art.
    assert corps["design"] == [
        {"asset": sujet["carte"], "role": "reference", "origine": "carte", "usage": "design"}
    ]


def test_un_jeu_a_huit_directions_les_demande_toutes_dans_son_ordre(client):
    ordre = _huit_directions(client)
    sujet = _sujet_de_la_toile(client, 6)
    ident = sujet["personnage"]["identifiant"]

    ecran = _envoi(client, personnage=ident, premiere_planche=True)

    assert ecran.status_code == 200, ecran.text
    corps = ecran.json()
    assert corps["cases"] == 8
    texte = corps["texte"]
    atelier = client.app.state.atelier
    projet = atelier.bibliotheque.courant
    # Chaque direction du jeu, avec sa consigne, dans les cases de la planche.
    for direction in atelier.production.directions_du_jeu(projet):
        assert direction.consigne in texte
    assert client.get(f"/api/characters/{ident}/first-sheet").json()["directions"] == ordre


def test_un_jeu_vu_de_face_fait_une_seule_image_de_repos(client, double):
    _vue(client, "vue-face-fixe")
    sujet = _sujet_de_la_toile(client, 7)
    ident = sujet["personnage"]["identifiant"]

    lue = client.get(f"/api/characters/{ident}/first-sheet").json()
    assert lue["directions"] == []

    ecran = _envoi(client, personnage=ident, premiere_planche=True)
    assert ecran.status_code == 200, ecran.text
    assert ecran.json()["cases"] == 0
    assert f"Image 1 — {DESIGN}" in ecran.json()["texte"]

    appel = _generer(client, personnage=ident, premiere_planche=True)
    assert appel.status_code == 202, appel.text
    generation = appel.json()
    assert generation["pose"] == "repos"
    assert generation["pliage"] is None


# ── 2. Le texte qui part ─────────────────────────────────────────────────────


def test_le_concept_art_part_une_fois_comme_le_personnage_a_reproduire(client):
    _vue(client)
    sujet = _sujet_de_la_toile(client, 8)
    ident = sujet["personnage"]["identifiant"]

    ecran = _envoi(client, personnage=ident, premiere_planche=True)

    assert ecran.status_code == 200, ecran.text
    corps = ecran.json()
    texte = corps["texte"]
    assert f"Image 1 — {DESIGN}" in texte
    assert "same proportions, outfit, colours and silhouette" in texte
    # Pas aussi en style, et la copie du portrait ne part pas en plus.
    assert "STYLE REFERENCE" not in texte
    lignes = corps["images"]["lignes"]
    assert [l["asset"] for l in lignes] == [sujet["carte"]]
    assert lignes[0]["role"] == "reference"
    assert lignes[0]["provenance"] == "concept art · personnage à reproduire"
    # Seules les directions du jeu, sur la planche d'E13.
    assert corps["cases"] == 4


def test_hors_premiere_planche_le_concept_art_part_comme_avant(client):
    """**Aucune assertion existante ne bouge** : sans le drapeau, le concept
    art reste une inspiration de style."""
    _vue(client)
    sujet = _sujet_de_la_toile(client, 9)
    ident = sujet["personnage"]["identifiant"]

    ecran = _envoi(
        client,
        personnage=ident,
        pose="repos",
        directions=["sud", "nord", "est", "ouest"],
    )

    assert ecran.status_code == 200, ecran.text
    texte = ecran.json()["texte"]
    assert DESIGN not in texte
    assert "STYLE REFERENCE" in texte
    ligne = next(
        l for l in ecran.json()["images"]["lignes"] if l["asset"] == sujet["carte"]
    )
    assert ligne["role"] == "style" and ligne["provenance"] == "concept art"


def test_ce_qui_part_est_ce_que_relire_avant_lenvoi_montre(client, double):
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_de_la_toile(client, 10)
    ident = sujet["personnage"]["identifiant"]

    # L'écran arme le champ avec le signalement du sujet, comme partout.
    signalement = client.app.state.atelier.production.sujet(
        client.app.state.atelier.bibliotheque.courant, ident
    )
    apercu = client.post(
        "/api/prompt/preview",
        json={"prompt": signalement, "personnage": ident, "premiere_planche": True},
    )
    assert apercu.status_code == 200, apercu.text
    montre = _envoi(
        client, prompt=signalement, personnage=ident, premiere_planche=True
    ).json()["texte"]
    appel = _generer(client, prompt=signalement, personnage=ident, premiere_planche=True)

    assert appel.status_code == 202, appel.text
    generation = appel.json()
    assert generation["demande"]["prompt"] == montre
    assert generation["demande"]["premiere_planche"] is True
    assert generation["pose"] == "repos"
    assert [c["direction"] for c in generation["pliage"]["cases"]] == [
        "sud", "nord", "est", "ouest"
    ]
    assert generation["references"] == [
        {"asset": sujet["carte"], "role": "reference", "origine": "carte", "usage": "design"}
    ]
    assert _attendre(client, generation["identifiant"])["statut"] == "reussie"
    # Le concept art + le gabarit de la grille, une fois chacun.
    assert len(double.demandes[-1].references) == 2

    # **La relance relit le drapeau et renvoie le même texte.**
    atelier = client.app.state.atelier
    relue = atelier.generations.demande_preparee(
        atelier.generations._base.lire(generation["identifiant"])
    )
    assert relue.premiere_planche is True
    assert relue.prompt == montre


def test_sans_concept_art_le_portrait_sert(client, tmp_path):
    _vue(client)
    cree = client.post("/api/characters", json={"nom": "Le passeur", "description": "a ferryman"})
    ident = cree.json()["personnage"]["identifiant"]
    fichier = tmp_path / "portrait.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=11, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()["asset"]
    client.put(f"/api/assets/{asset['identifiant']}/character", json={"personnage": ident})
    pose = client.put(
        f"/api/characters/{ident}/reference-image", json={"asset": asset["identifiant"]}
    )
    assert pose.status_code == 200, pose.text

    ecran = _envoi(client, prompt="a ferryman", personnage=ident, premiere_planche=True)

    assert ecran.status_code == 200, ecran.text
    lignes = ecran.json()["images"]["lignes"]
    assert [l["asset"] for l in lignes] == [asset["identifiant"]]
    assert lignes[0]["provenance"] == "portrait · personnage à reproduire"
    assert f"Image 1 — {DESIGN}" in ecran.json()["texte"]


# ── 3. Les refus, avant de payer ─────────────────────────────────────────────


def test_sans_concept_art_ni_portrait_rien_ne_part(client, double):
    _vue(client)
    cree = client.post("/api/characters", json={"nom": "Personne", "description": "nobody"})
    ident = cree.json()["personnage"]["identifiant"]

    lue = client.get(f"/api/characters/{ident}/first-sheet")
    assert lue.status_code == 409, lue.text
    assert "rien à reproduire" in lue.text

    for route in ("/api/outgoing", "/api/prompt/preview"):
        refus = client.post(
            route, json={"modele": MODELE, "prompt": "nobody", "personnage": ident,
                         "premiere_planche": True},
        )
        assert refus.status_code == 409, (route, refus.text)
    appel = _generer(client, prompt="nobody", personnage=ident, premiere_planche=True)
    assert appel.status_code == 409, appel.text
    assert "rien à reproduire" in appel.text
    assert double.appels == 0


def test_d_autres_directions_ou_une_autre_pose_se_refusent(client, double):
    _vue(client)
    sujet = _sujet_de_la_toile(client, 12)
    ident = sujet["personnage"]["identifiant"]

    for contexte in (
        {"pose": "marche"},
        {"directions": ["nord", "sud"]},
        {"directions": ["nord", "sud", "est", "ouest"]},  # pas l'ordre du jeu
        {"poses": ["repos", "marche"]},
        {"garder_mise_en_page": True},
    ):
        appel = _generer(
            client, prompt="w", personnage=ident, premiere_planche=True, **contexte
        )
        assert appel.status_code == 409, (contexte, appel.text)
    # Données exactement, pose et directions passent.
    bonnes = _envoi(
        client, prompt="w", personnage=ident, premiere_planche=True,
        pose="repos", directions=["sud", "nord", "est", "ouest"],
    )
    assert bonnes.status_code == 200, bonnes.text
    assert double.appels == 0


def test_un_concept_art_ecarte_part_quand_meme(client):
    """Le personnage à reproduire **est** la demande : il ne s'écarte pas."""
    _vue(client)
    sujet = _sujet_de_la_toile(client, 13)
    ident = sujet["personnage"]["identifiant"]

    ecran = _envoi(
        client, prompt="w", personnage=ident, premiere_planche=True,
        references_ecartees=[sujet["carte"]],
    )

    assert ecran.status_code == 200, ecran.text
    ligne = ecran.json()["images"]["lignes"][0]
    assert ligne["asset"] == sujet["carte"] and ligne["ecartee_par"] is None


# ── 4. « C'est la référence » ────────────────────────────────────────────────


def _premiere_planche_arrivee(client, double, rang: int) -> tuple[str, str]:
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_de_la_toile(client, rang)
    ident = sujet["personnage"]["identifiant"]
    appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    assert appel.status_code == 202, appel.text
    identifiant = appel.json()["identifiant"]
    assert _attendre(client, identifiant)["statut"] == "reussie"
    return ident, f"{identifiant}-0"


def test_cest_la_reference_promeut_la_planche_et_range_ses_vues(client, double, atelier):
    _vue(client)
    ident, feuille = _premiere_planche_arrivee(client, double, 14)
    assert atelier.assets.lire(feuille) is not None

    choisie = client.put(
        f"/api/characters/{ident}/references/sheet", json={"asset": feuille}
    )

    assert choisie.status_code == 200, choisie.text
    # **Relu, pas seulement rendu** (8septies).
    projet = atelier.bibliotheque.courant
    relu = atelier.production.personnage(projet, ident)
    assert feuille in relu.references
    assert relu.usage_de(feuille) == "planche"
    assert relu.ordre_des_vues(feuille) == ("sud", "nord", "est", "ouest")
    ligne = next(
        l for l in client.get(f"/api/characters/{ident}/references").json()["lignes"]
        if l["reference"] == feuille
    )
    assert ligne["usage"] == "planche"
    assert ligne["ordre_des_vues"] == ["sud", "nord", "est", "ouest"]
    # Ses morceaux sont déjà dans leurs cases, à l'arrivée (E13).
    morceaux = [
        a for a in atelier.base.assets_du_personnage(ident)
        if a.generation == feuille.rsplit("-", 1)[0] and a.rang >= 100
    ]
    assert {(a.pose, a.direction) for a in morceaux} == {
        ("repos", d) for d in ("sud", "nord", "est", "ouest")
    }


def test_une_seule_planche_a_la_fois(client, double, atelier):
    _vue(client)
    ident, premiere = _premiere_planche_arrivee(client, double, 15)
    appel = _generer(client, prompt="w", personnage=ident, premiere_planche=True)
    seconde = f"{appel.json()['identifiant']}-0"
    _attendre(client, appel.json()["identifiant"])

    client.put(f"/api/characters/{ident}/references/sheet", json={"asset": premiere})
    client.put(f"/api/characters/{ident}/references/sheet", json={"asset": seconde})

    relu = atelier.production.personnage(atelier.bibliotheque.courant, ident)
    assert premiere not in relu.references
    assert relu.usage_de(seconde) == "planche"
    assert atelier.assets.lire(premiere) is not None  # elle reste en bibliothèque


def test_cest_la_reference_refuse_une_image_d_un_autre_sujet(client, double):
    _vue(client)
    ident, feuille = _premiere_planche_arrivee(client, double, 16)
    autre = client.post("/api/characters", json={"nom": "Autre"}).json()["personnage"]

    refus = client.put(
        f"/api/characters/{autre['identifiant']}/references/sheet", json={"asset": feuille}
    )
    assert refus.status_code == 409, refus.text


# ── 5. L'agent fait le même geste (T7) ───────────────────────────────────────


async def test_l_agent_fait_la_premiere_planche_et_la_choisit(client, mcp, double, atelier):
    _vue(client)
    double.rendre = lambda: planche_sujets(4)
    sujet = _sujet_de_la_toile(client, 17)
    ident = sujet["personnage"]["identifiant"]

    recu = await appeler(
        mcp, "generate_pose", character=ident, first_sheet=True, wait_seconds=5
    )
    generation = atelier.generations.lire(recu["generation_id"])
    assert generation.demande["premiere_planche"] is True
    assert generation.pose == "repos"
    assert [c.direction for c in generation.pliage.cases] == ["sud", "nord", "est", "ouest"]
    assert [(r.asset, r.role, r.usage) for r in generation.references] == [
        (sujet["carte"], "reference", "design")
    ]
    assert DESIGN in generation.demande["prompt"]

    feuille = f"{generation.identifiant}-0"
    choisi = await appeler(mcp, "choose_character_sheet", character=ident, asset=feuille)
    assert choisi["character"]["identifiant"] == ident
    relu = atelier.production.personnage(atelier.bibliotheque.courant, ident)
    assert relu.usage_de(feuille) == "planche"
    assert relu.ordre_des_vues(feuille) == ("sud", "nord", "est", "ouest")
