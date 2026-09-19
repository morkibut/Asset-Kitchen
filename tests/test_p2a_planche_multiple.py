# -*- coding: utf-8 -*-
"""P2a (V3.5) — la planche à plusieurs sujets, côté serveur.

**Ce qui se mesure ici** : une planche peut porter plusieurs choses du jeu, à
condition que la demande dise d'avance ce que chaque case contient — une liste
de sujets, dans l'ordre de lecture. Le découpage range le morceau de la case n
chez le sujet n ; une case qui cloche se signale au lieu de se ranger de
travers ; le prix d'un sujet s'annonce à côté du prix de la planche ; une case
ratée se refait seule, en image simple. Sans liste, l'ancienne règle d'E13
s'applique inchangée.

Tout passe par les routes, fournisseur doublé : **aucun essai ne coûte un
centime**, et les planches rendues sont dessinées ici, case par case, sur la
grille que le pliage a enregistrée — pour pouvoir laisser une case vide ou en
remplir une de deux morceaux, ce que la planche de C2 ne sait pas faire.
"""

from __future__ import annotations

import io
import time

from PIL import Image, ImageDraw

from atelier.image import grille_fixe

from conftest import FOND, planche_sujets

MODELE = "essai:rend-du-png"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"l'appel « {identifiant} » n'est jamais arrivé à terme")


def _chose(client, nom: str, description: str, famille: str = "objets", type_: str = "objet posé") -> str:
    """Une chose du jeu, créée dans sa famille puis typée."""
    reponse = client.post(
        "/api/characters",
        json={"nom": nom, "description": description, "famille": famille},
    )
    assert reponse.status_code == 201, reponse.text
    identifiant = reponse.json()["personnage"]["identifiant"]
    if type_:
        typee = client.put(f"/api/characters/{identifiant}", json={"type": type_})
        assert typee.status_code == 200, typee.text
    return identifiant


def _quatre_objets(client) -> list[str]:
    return [
        _chose(client, "Potion rouge", "a red healing potion in a round flask"),
        _chose(client, "Clé", "an old iron key"),
        _chose(client, "Bouclier", "a small wooden round shield"),
        _chose(client, "Parchemin", "a rolled parchment scroll"),
    ]


def _planche(
    cases: int,
    colonnes: int,
    lignes: int,
    *,
    vides: tuple[int, ...] = (),
    doubles: tuple[int, ...] = (),
    pleines: tuple[int, ...] = (),
    cote: int = 480,
) -> bytes:
    """Ce qu'un modèle rendrait : un objet au milieu de chaque case de la grille.

    Chaque objet est une ellipse à sa taille (largeur et hauteur changent avec
    la case), bien à l'intérieur de sa case et loin des bords de la planche — le
    fond touche les quatre bords, comme sur une vraie planche. Une ellipse, et
    pas un rectangle : un rectangle plein remplit sa boîte, et c'est très
    exactement la marque d'un quadrillage redessiné (R6) — `pleines` en pose un
    exprès. `vides` laisse des cases sans rien ; `doubles` y pose deux morceaux.
    """
    image = Image.new("RGB", (cote, cote), FOND)
    dessin = ImageDraw.Draw(image)
    for case, (x0, y0, x1, y1) in enumerate(grille_fixe(cote, cote, colonnes, lignes)[:cases]):
        if case in vides:
            continue
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        large, haut = 40 + 10 * case, 90 - 8 * case
        boite = (cx - large // 2, cy - haut // 2, cx + large // 2, cy + haut // 2)
        if case in doubles:
            dessin.ellipse((cx - 60, cy - 25, cx - 20, cy + 25), fill=(90, 40, 30))
            dessin.ellipse((cx + 20, cy - 25, cx + 60, cy + 25), fill=(30, 40, 90))
        elif case in pleines:
            dessin.rectangle(boite, fill=(60 + 40 * case, 50, 40))
        else:
            dessin.ellipse(boite, fill=(60 + 40 * case, 50, 40))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _envoyer(client, sujets: list[str], **corps) -> dict:
    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "a set of inventory items", "sujets": sujets, **corps},
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _images(atelier, generation: str) -> list:
    """Les images dépliées d'une génération, dans l'ordre de leurs rangs."""
    rangs = sorted(r for r in atelier.base.rangs_de_generation(generation) if r >= 100)
    return [atelier.base.lire_asset(f"{generation}-{r}") for r in rangs]


def _depliages(client, planche: str) -> dict:
    reponse = client.get(f"/api/assets/{planche}/unfoldings")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── 1. Une planche porte plusieurs choses, et la demande le dit d'avance ─────


def test_la_demande_dit_ce_que_chaque_case_contient(client, double):
    """La liste s'enregistre sur le pliage, case par case et dans l'ordre, et le
    texte qui part la numérote — « cell 1: … » (décision 2 de l'auteur)."""
    sujets = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2)

    vue = _envoyer(client, sujets)

    assert vue["statut"] == "reussie"
    assert vue["personnage"] is None
    cases = vue["pliage"]["cases"]
    assert [c["sujet"] for c in cases] == sujets
    # La pose que la fiche remplirait d'abord : « posé », pour un objet posé.
    assert {c["pose"] for c in cases} == {"pose"}
    assert cases[1]["signalement"] == "an old iron key"
    texte = vue["demande"]["prompt"]
    assert "cell 1: a red healing potion in a round flask" in texte
    assert "cell 4: a rolled parchment scroll" in texte
    assert "same subject in every cell" not in texte.lower()
    # Relue sur le disque, la liste est la même : c'est un fait de l'appel.
    relue = client.get(f"/api/generations/{vue['identifiant']}").json()
    assert [c["sujet"] for c in relue["pliage"]["cases"]] == sujets


def test_la_liste_refuse_un_decor_une_tuile_ou_un_sujet_inconnu(client, double):
    """**Objets et équipement seulement** (décision 3) : un décor se raccorde, il
    ne tient pas seul dans une case. Refusé avant de payer, comme un sujet que le
    jeu ne connaît pas — et la raison dit quelle case."""
    potion, cle, *_ = _quatre_objets(client)
    decor = _chose(client, "Mur", "a stone wall", famille="decors", type_="décor")
    tuile = _chose(client, "Herbe", "a grass tile", famille="decors", type_="tuile")

    for liste, attendu in (
        ([potion, decor], "case 2"),
        ([tuile, potion], "case 1"),
        ([potion, "personne"], "case 2"),
    ):
        reponse = client.post(
            "/api/generations",
            json={"modele": MODELE, "prompt": "items", "sujets": liste},
        )
        assert reponse.status_code == 409, reponse.text
        assert attendu in reponse.text

    # La liste ne se mêle pas aux autres sortes de planches.
    melee = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "items", "sujets": [potion, cle], "personnage": potion},
    )
    assert melee.status_code == 409, melee.text
    assert double.appels == 0


# ── 2. Chaque morceau va au sujet que sa case annonçait ──────────────────────


def test_chaque_morceau_va_au_sujet_que_sa_case_annoncait(client, atelier, double):
    """La case n va au sujet n, dans l'ordre **de la liste**, pas dans celui où
    les sujets ont été créés — et avec la pose que la liste lui a donnée."""
    potion, cle, bouclier, parchemin = _quatre_objets(client)
    liste = [bouclier, potion, parchemin, cle]
    double.rendre = lambda: _planche(4, 2, 2)

    vue = _envoyer(client, liste)

    images = _images(atelier, vue["identifiant"])
    assert [a.personnage for a in images] == liste
    assert all(a.pose == "pose" for a in images)
    assert [a.label for a in images][0] == "a small wooden round shield"
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    assert depliage["cases"] == [0, 1, 2, 3]
    assert "a_verifier" not in depliage


# ── 3. Une case qui cloche se signale au lieu de se ranger de travers ────────


def test_une_case_vide_se_signale_et_ne_decale_pas_les_autres(client, atelier, double):
    """**Sept pour huit ne refuse plus la planche, et ne glisse pas non plus.**
    La case vide est « à vérifier » ; les autres se rangent chacune chez son
    sujet — sans ce calage par case, le parchemin irait au bouclier."""
    potion, cle, bouclier, parchemin = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2, vides=(1,))

    vue = _envoyer(client, [potion, cle, bouclier, parchemin])

    assert vue["statut"] == "reussie"
    images = _images(atelier, vue["identifiant"])
    assert [a.personnage for a in images] == [potion, bouclier, parchemin]
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    assert depliage["cases"] == [0, 2, 3]
    assert [v["case"] for v in depliage["a_verifier"]] == [1]
    assert "vide" in depliage["a_verifier"][0]["raison"]


def test_une_case_a_deux_morceaux_ou_pleine_se_signale(client, atelier, double):
    """Deux taches dans une case : deux sujets, ou un sujet coupé — l'atelier ne
    sait pas lequel sans regarder, donc il ne range pas. Une tache qui remplit sa
    boîte est un morceau de quadrillage (R6) : signalée pareil, **case par
    case**, sans arrêter la planche entière comme le fait un lot d'un sujet."""
    sujets = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2, doubles=(2,), pleines=(0,))

    vue = _envoyer(client, sujets)

    assert vue["statut"] == "reussie"
    assert vue["pliage"]["attend_un_choix"] is False
    images = _images(atelier, vue["identifiant"])
    assert [a.personnage for a in images] == [sujets[1], sujets[3]]
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    raisons = {v["case"]: v["raison"] for v in depliage["a_verifier"]}
    assert sorted(raisons) == [0, 2]
    assert "quadrillage" in raisons[0]
    assert "morceaux" in raisons[2]


def _huit_objets(client) -> list[str]:
    return _quatre_objets(client) + [
        _chose(client, "Dague", "an elven dagger"),
        _chose(client, "Bourse", "a leather coin pouch"),
        _chose(client, "Lanterne", "a small brass lantern"),
        _chose(client, "Coffre", "a small wooden chest", type_="meuble"),
    ]


def _planche_derniere_rangee_centree(decalage: int) -> bytes:
    """Huit sujets sur 3 × 3, et la dernière rangée **recentrée** par le modèle,
    comme au banc payé du 19 septembre 2026 : les deux derniers sujets glissent
    de `decalage` pixels vers la droite, et le huitième peut finir dans la case
    9, qui n'existe pas."""
    cote = 480
    image = Image.new("RGB", (cote, cote), FOND)
    dessin = ImageDraw.Draw(image)
    for case, (x0, y0, x1, y1) in enumerate(grille_fixe(cote, cote, 3, 3)[:8]):
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        if case >= 6:
            cx += decalage
        dessin.ellipse((cx - 30, cy - 40, cx + 30, cy + 40), fill=(60 + 20 * case, 50, 40))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def test_une_derniere_rangee_recentree_se_range_dans_l_ordre_de_lecture(
    client, atelier, double
):
    """**Le coffre qui déborde en case 9 va quand même au coffre** (décision de
    l'auteur, 19 septembre 2026). Autant de taches que de cases, rangée par
    rangée : la n-ième dans l'ordre de lecture va au n-ième sujet."""
    sujets = _huit_objets(client)
    # Cases de 160 px : le 8e sujet, au centre x = 240, passe à 330 — case 9.
    double.rendre = lambda: _planche_derniere_rangee_centree(90)

    vue = _envoyer(client, sujets)

    images = _images(atelier, vue["identifiant"])
    assert [a.personnage for a in images] == sujets
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    assert depliage["cases"] == list(range(8))
    assert "a_verifier" not in depliage


def test_l_ordre_de_lecture_ne_joue_pas_si_une_rangee_n_a_pas_son_compte(
    client, atelier, double
):
    """Quatre taches pour quatre cases, mais toutes sur la première rangée : le
    compte global est juste, celui des rangées non. Le calage par centre
    décide, et les cases qui clochent se signalent."""
    sujets = _quatre_objets(client)

    def une_seule_rangee() -> bytes:
        image = Image.new("RGB", (480, 480), FOND)
        dessin = ImageDraw.Draw(image)
        for cx in (60, 180, 300, 420):
            dessin.ellipse((cx - 30, 80, cx + 30, 160), fill=(90, 50, 40))
        tampon = io.BytesIO()
        image.save(tampon, format="PNG")
        return tampon.getvalue()

    double.rendre = une_seule_rangee

    vue = _envoyer(client, sujets)

    assert _images(atelier, vue["identifiant"]) == []
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    assert sorted(v["case"] for v in depliage["a_verifier"]) == [0, 1, 2, 3]


def test_ce_n_est_pas_le_bon_sujet_retire_l_image_de_sa_case(client, atelier, double):
    """**Le signal que l'atelier ne sait pas lever seul** : une clé dessinée dans
    la case de la potion est une tache unique, bien centrée, et elle se range.
    Le geste de l'auteur la reprend — l'image reste, elle n'est plus rangée, et
    la case passe « à vérifier »."""
    sujets = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2)
    vue = _envoyer(client, sujets)
    troisieme = _images(atelier, vue["identifiant"])[2]

    reponse = client.post(f"/api/assets/{troisieme.identifiant}/wrong-subject")

    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["case"] == 2
    relue = client.get(f"/api/assets/{troisieme.identifiant}").json()
    assert relue["personnage"] is None and relue["pose"] is None
    assert relue["supprime_le"] is None
    assert relue["planche"] == f"{vue['identifiant']}-0"
    (depliage,) = _depliages(client, f"{vue['identifiant']}-0")["depliages"]
    assert [v["case"] for v in depliage["a_verifier"]] == [2]
    # Les autres n'ont pas bougé.
    assert [a.personnage for a in _images(atelier, vue["identifiant"])] == [
        sujets[0], sujets[1], None, sujets[3]
    ]


def test_le_geste_ne_vaut_que_sur_une_planche_a_plusieurs_sujets(client, atelier, double):
    """Sur une planche d'un seul sujet, aucune liste ne range les images : il n'y a
    rien à défaire, et le geste le dit plutôt que d'effacer un rangement juste."""
    double.rendre = lambda: planche_sujets(4)
    nain = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    ).json()["personnage"]["identifiant"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][:4]
    lot = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un nain", "personnage": nain, "poses": poses},
    ).json()["identifiant"]
    _attendre(client, lot)
    image = _images(atelier, lot)[0]

    reponse = client.post(f"/api/assets/{image.identifiant}/wrong-subject")

    assert reponse.status_code == 409, reponse.text
    assert atelier.base.lire_asset(image.identifiant).personnage == nain


# ── 4. Le prix par sujet, avant l'envoi, à côté de celui de la planche ───────


def test_le_prix_par_sujet_s_annonce_avant_l_envoi(client, double):
    """L'annonce habituelle (`POST /outgoing`) rend le prix de la planche **et**
    celui d'un sujet — la planche divisée par ses cases. Rien ne part."""
    sujets = _quatre_objets(client)
    # Un appel mesuré, pour que le prix soit connu : c'est une mesure, pas un tarif.
    _attendre(
        client,
        client.post("/api/generations", json={"modele": MODELE, "prompt": "une potion"}).json()[
            "identifiant"
        ],
    )
    appels = double.appels

    reponse = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "a set of inventory items", "sujets": sujets},
    )

    assert reponse.status_code == 200, reponse.text
    prix = reponse.json()["prix"]
    assert prix["total"] is not None and prix["total"] > 0
    assert prix["appels"] == 1
    assert prix["sujets"] == 4
    assert prix["par_sujet"] == round(prix["total"] / 4, 4)
    assert reponse.json()["cases"] == 4
    assert "cell 2: an old iron key" in reponse.json()["texte"]
    assert double.appels == appels

    # Une planche d'un seul sujet ne dit pas de prix par sujet : ses cases sont
    # la même chose, et le chiffre ne dirait rien.
    nain = client.post("/api/characters", json={"nom": "Nain", "description": "un nain"}).json()[
        "personnage"
    ]["identifiant"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][:3]
    seul = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "un nain", "personnage": nain, "poses": poses},
    ).json()["prix"]
    assert "par_sujet" not in seul


# ── 5. Sans liste, l'ancienne règle ──────────────────────────────────────────


def test_sans_liste_l_ancienne_regle_s_applique(client, atelier, double):
    """Un lot de poses d'un seul personnage garde la forme de fichier d'avant P2 —
    pas de clé `sujet` —, range tout chez son personnage, et un compte court
    reste le refus d'avant."""
    double.rendre = lambda: planche_sujets(4)
    nain = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    ).json()["personnage"]["identifiant"]
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]][:4]

    vue = _attendre(
        client,
        client.post(
            "/api/generations",
            json={"modele": MODELE, "prompt": "un nain", "personnage": nain, "poses": poses},
        ).json()["identifiant"],
    )

    assert all("sujet" not in c for c in vue["pliage"]["cases"])
    assert {a.personnage for a in _images(atelier, vue["identifiant"])} == {nain}

    double.rendre = lambda: planche_sujets(3)
    court = _attendre(
        client,
        client.post(
            "/api/generations",
            json={"modele": MODELE, "prompt": "un nain", "personnage": nain, "poses": poses},
        ).json()["identifiant"],
    )
    assert court["statut"] == "echouee"
    assert "3 images pour 4" in court["emplacements"][0]["raison"]


# ── 6. Refaire le découpage marche comme en P1 ───────────────────────────────


def test_refaire_le_decoupage_range_chaque_coupe_au_sujet_de_sa_case(client, atelier, double):
    """Les routes de P1b, inchangées : la proposition dit le sujet de chaque
    case, et un dépliage refait range chaque coupe chez le sujet de **la case
    qu'on lui désigne**. Une case qu'aucune coupe ne remplit se signale."""
    sujets = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2)
    vue = _envoyer(client, sujets)
    planche = f"{vue['identifiant']}-0"

    proposee = client.get(f"/api/assets/{planche}/unfoldings/proposal").json()
    assert [c["sujet"] for c in proposee["cases_de_la_planche"]] == sujets

    # Trois coupes, et deux cases échangées : la case désignée fait foi.
    boites = proposee["boites"][:3]
    refait = client.post(
        f"/api/assets/{planche}/unfoldings", json={"boites": boites, "cases": [1, 0, 2]}
    )

    assert refait.status_code == 201, refait.text
    corps = refait.json()
    assert [a["personnage"] for a in corps["images"]] == [sujets[1], sujets[0], sujets[2]]
    assert [v["case"] for v in corps["depliage"]["a_verifier"]] == [3]
    # Le premier dépliage n'a pas bougé.
    premier, second = _depliages(client, planche)["depliages"]
    assert [a["personnage"] for a in premier["images"]] == sujets
    assert second["origine"] == "main"


# ── 7. Une case ratée se refait seule, en image simple ───────────────────────


def test_refaire_une_case_seule_prepare_une_image_simple_sans_payer(client, atelier, double):
    """**Décision 1 de l'auteur** : la route prépare la génération ordinaire d'un
    seul sujet — le texte de sa ligne, sa pose — et l'annonce avec son prix ;
    elle n'appelle personne. L'argent part ensuite par le seul chemin d'où il
    part, et l'image tombe dans la case du sujet."""
    sujets = _quatre_objets(client)
    double.rendre = lambda: _planche(4, 2, 2, vides=(1,))
    vue = _envoyer(client, sujets)
    appels = double.appels

    reponse = client.get(f"/api/assets/{vue['identifiant']}-0/cells/1/redo")

    assert reponse.status_code == 200, reponse.text
    rendu = reponse.json()
    demande = rendu["demande"]
    assert demande["personnage"] == sujets[1]
    assert demande["pose"] == "pose"
    assert demande["prompt"] == "an old iron key"
    assert demande["modele"] == MODELE
    assert rendu["envoi"]["prix"]["total"] is not None
    assert "an old iron key" in rendu["envoi"]["texte"]
    assert rendu["envoi"]["cases"] == 0  # une image simple, pas une planche
    assert double.appels == appels  # préparer ne paie rien

    double.rendre = None
    seule = client.post("/api/generations", json={k: v for k, v in demande.items() if v is not None})
    assert seule.status_code == 202, seule.text
    faite = _attendre(client, seule.json()["identifiant"])
    assert faite["statut"] == "reussie"
    assert faite["pliage"] is None
    assert double.appels == appels + 1
    image = atelier.base.lire_asset(f"{faite['identifiant']}-0")
    assert (image.personnage, image.pose) == (sujets[1], "pose")

    # Une case qui n'existe pas se dit.
    hors = client.get(f"/api/assets/{vue['identifiant']}-0/cells/9/redo")
    assert hors.status_code == 409
