# -*- coding: utf-8 -*-
"""Les critères d'acceptation de C1 — le personnage, son plan, une pose, et ce
qui part avec elle.

Un test par critère de `docs/archive/plan-versions-tenues.md` § C1, nommé d'après lui. Ce fichier grossit
jalon par jalon, dans l'ordre du plan.

**Aucun test de ce fichier ne coûte un centime**, et le dernier de chaque jalon le
prouve plutôt que de l'affirmer, en comptant les appels du double.
"""

from __future__ import annotations

import time

from conftest import image, image_sujet

MODELE = "essai:rend-du-png"
AUTRE_MODELE = "essai:rend-du-jpeg"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _generer(client, prompt: str = "un tonneau", modele: str = MODELE, **corps) -> dict:
    """`corps` porte tout ce que l'écran envoie en plus — dont la case visée."""
    """Une génération lancée par la route, telle que l'écran la lance — et
    attendue jusqu'à son terme. Le POST rend la main tout de suite : la
    génération vit côté serveur, et un test qui n'attend pas regarde avant."""
    reponse = client.post(
        "/api/generations", json={"modele": modele, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


def _asset(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── « La fiche de n'importe quel asset nomme le modèle qui l'a produit — le
#     modèle exact pour une image générée, "importé" pour une image importée »
#     (US-123) ────────────────────────────────────────────────────────────────


def test_une_image_generee_nomme_le_modele_exact(client):
    """Le modèle exact, pas le nom du catalogue : c'est lui qu'on redemande, et
    il reste vrai quand le catalogue est hors ligne."""
    generation = _generer(client)
    asset = _asset(client, f"{generation['identifiant']}-0")
    assert asset["modele"] == MODELE


def test_deux_modeles_deux_fiches(client, double):
    """Le champ est un fait sur l'appel, pas un défaut de l'atelier : deux
    images produites par deux modèles ne disent pas la même chose."""
    une = _generer(client, "un tonneau", modele=MODELE)
    autre = _generer(client, "une caisse", modele=AUTRE_MODELE)
    assert _asset(client, f"{une['identifiant']}-0")["modele"] == MODELE
    assert _asset(client, f"{autre['identifiant']}-0")["modele"] == AUTRE_MODELE


def test_une_image_importee_le_dit(client, tmp_path):
    """Une image importée n'a pas de modèle, et son absence est une réponse.
    Le serveur porte `import` — la valeur que sa génération porte depuis T3 —,
    l'écran l'écrit « importé »."""
    fichier = tmp_path / "voisin.png"
    fichier.write_bytes(image("PNG"))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["asset"]["modele"] == "import"


def test_une_decoupe_porte_le_modele_de_sa_planche(client, double):
    """Découper n'est pas commander : c'est le même appel, poursuivi. Un morceau
    sans modèle serait la seule image de la bibliothèque à ne pas savoir dire
    qui l'a dessinée."""
    double.rendre = lambda: _planche()
    generation = _generer(client, "une planche de deux")
    planche = f"{generation['identifiant']}-0"

    propose = client.get(f"/api/assets/{planche}/slices").json()
    assert len(propose["boites"]) >= 2, propose
    reponse = client.post(f"/api/assets/{planche}/slices", json=propose)
    assert reponse.status_code == 200, reponse.text

    decoupes = reponse.json()["decoupes"]
    assert decoupes
    for morceau in decoupes:
        assert morceau["modele"] == MODELE


def test_un_asset_ecrit_avant_c1_recupere_son_modele(client, atelier):
    """Un champ ajouté à un objet ne se rétro-remplit pas tout seul
    (`docs/PIEGES.md`). La génération, elle, porte le modèle depuis T1 : la
    reconstruction va l'y chercher, comme elle va déjà y chercher le coût."""
    generation = _generer(client)
    identifiant = f"{generation['identifiant']}-0"

    # L'état d'un asset écrit avant C1 : le champ n'existait pas.
    ancien = atelier.assets.lire(identifiant)
    ancien.modele = ""
    atelier.assets.sauver(ancien, annoncer=False)
    assert _asset(client, identifiant)["modele"] == ""

    assert client.post("/api/library/rebuild").status_code == 200
    assert _asset(client, identifiant)["modele"] == MODELE


def test_nommer_le_modele_ne_demande_jamais_le_fournisseur(client, double):
    """Lire une fiche marche réseau coupé — le nom voyage avec l'image, il ne se
    redemande pas."""
    generation = _generer(client)
    appels = double.appels

    double.catalogue_lisible = False
    asset = _asset(client, f"{generation['identifiant']}-0")

    assert asset["modele"] == MODELE
    assert double.appels == appels


def _planche() -> bytes:
    """Deux sujets côte à côte sur un fond plat — de quoi faire une découpe sans
    dépendre de ce qu'un vrai modèle aurait rendu."""
    import io as _io

    from PIL import Image

    from conftest import FOND

    gauche = Image.open(_io.BytesIO(image_sujet())).convert("RGB")
    planche = Image.new("RGB", (gauche.width * 3, gauche.height), FOND)
    planche.paste(gauche, (0, 0))
    planche.paste(gauche, (gauche.width * 2, 0))
    tampon = _io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


# ── « Un projet neuf porte un plan de poses utilisable sans qu'aucune ligne
#     n'ait été écrite » (US-116) ─────────────────────────────────────────────


def _tableau(client, **params) -> dict:
    reponse = client.get("/api/characters", params=params)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _tenues(tableau: dict, personnage: str) -> list[str]:
    """Les poses d'un personnage, déduites du plan comme l'écran les déduit.

    **Le serveur ne les envoie pas**, et c'est la décision : le disque porte ce
    que le personnage écarte, et une liste de tenues envoyée avec lui se
    périmerait au premier ajout de pose — un plan qui gagne une ligne n'annonce
    aucun personnage, puisque justement il n'en réécrit aucun.
    """
    un = next(p for p in tableau["personnages"] if p["identifiant"] == personnage)
    return [p["identifiant"] for p in tableau["plan"] if p["identifiant"] not in un["ecartees"]]


def _creer(client, nom: str = "Le nain", description: str = "") -> dict:
    reponse = client.post(
        "/api/characters", json={"nom": nom, "description": description}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _ajouter_pose(client, nom: str, images: int = 1) -> dict:
    reponse = client.post("/api/characters/poses", json={"nom": nom, "images": images})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["pose"]


def test_un_projet_neuf_porte_un_plan_utilisable(client):
    """Le Bac à sable existe avant tout geste, et il a déjà ses cases."""
    plan = _tableau(client)["plan"]
    assert [p["nom"] for p in plan] == [
        "repos",
        "marche",
        "course",
        "attaque",
        "dégâts",
        "mort",
    ]
    assert all(p["images"] == 1 for p in plan)


def test_un_plan_vide_reste_vide(client):
    """**L'absence et le vide ne se lisent pas pareil.** Un plan que l'auteur a
    vidé ne doit pas ressusciter à la relecture : c'est le motif `lu or DEFAUT`
    du barème, et il serait faux ici."""
    for pose in _tableau(client)["plan"]:
        assert (
            client.delete(f"/api/characters/poses/{pose['identifiant']}").status_code
            == 200
        )
    assert _tableau(client)["plan"] == []

    assert client.post("/api/library/rebuild").status_code == 200
    assert _tableau(client)["plan"] == []


# ── « Un personnage se crée avec un nom et une description » (US-115) ─────────


def test_un_personnage_se_cree_et_se_decrit_une_fois(client):
    personnage = _creer(client, "Le nain", "un forgeron nain à la barbe tressée")
    assert personnage["nom"] == "Le nain"
    assert personnage["description"] == "un forgeron nain à la barbe tressée"

    # Relu du disque, et pas d'un état gardé en mémoire.
    lus = _tableau(client)["personnages"]
    assert [p["identifiant"] for p in lus] == ["le-nain"]
    assert lus[0]["description"] == "un forgeron nain à la barbe tressée"


def test_deux_personnages_du_meme_nom_sont_refuses_en_le_disant(client):
    _creer(client, "Le nain")
    refus = client.post("/api/characters", json={"nom": "le NAIN"})
    assert refus.status_code == 409
    assert refus.json()["code"] == "production_refusee"
    assert "Le nain" in refus.json()["raison"] or "le NAIN" in refus.json()["raison"]


def test_les_personnages_survivent_a_un_index_efface(client):
    """Ils ne sont jamais entrés dans l'index — comme les cartes et les liens.
    Le jeter ne peut donc pas les perdre."""
    _creer(client, "Le nain", "un forgeron")
    _ajouter_pose(client, "saut")

    assert client.post("/api/library/rebuild").status_code == 200

    lu = _tableau(client)
    assert [p["nom"] for p in lu["personnages"]] == ["Le nain"]
    assert "saut" in [p["identifiant"] for p in lu["plan"]]


# ── « Une pose s'ajoute, se renomme et se retire à tout moment ; ajouter une
#     pose ajoute une case vide à chaque personnage qui porte ce plan, et ne
#     lance AUCUNE génération » (US-118) ──────────────────────────────────────


def test_ajouter_une_pose_ajoute_une_case_a_chaque_personnage_sans_rien_generer(
    client, double
):
    _creer(client, "Le nain")
    _creer(client, "La prêtresse")
    appels = double.appels

    _ajouter_pose(client, "saut", images=4)

    lu = _tableau(client)
    assert lu["plan"][-1] == {
        "identifiant": "saut",
        "nom": "saut",
        "images": 4,
        # **Vide, et c'est une valeur** (E10) : le produit ne traduit pas en
        # anglais le nom qu'on vient de taper. C'est alors le nom qui part,
        # comme avant E10, et la ligne le dit.
        "consigne": "",
        "ecartees": [],
        "images_avant": 0,
    }
    # La case neuve paraît chez tout le monde — et aucun fichier de personnage
    # n'a eu à être réécrit pour ça, puisqu'un personnage range ce qu'il écarte.
    # C'est **l'absence** de « saut » dans les écartées qui le dit, et c'est
    # tout ce que le disque porte : les tenues se déduisent du plan.
    for personnage in lu["personnages"]:
        assert "saut" not in personnage["ecartees"]
    # « Ajouter une pose ajoute une case vide, jamais une génération. »
    assert double.appels == appels


def test_ecrire_un_nom_de_pose_qui_n_existe_pas_le_cree_sur_le_champ(client):
    """Nommer, c'est créer : aucun écran de gestion à traverser."""
    pose = _ajouter_pose(client, "grimpe une échelle")
    assert pose["identifiant"] == "grimpe-une-echelle"
    assert pose["nom"] == "grimpe une échelle"

    refus = client.post("/api/characters/poses", json={"nom": "GRIMPE UNE ÉCHELLE"})
    assert refus.status_code == 409


def test_renommer_une_pose_ne_lui_prend_pas_son_identifiant(client):
    """Les images déjà faites portent l'identifiant : le renommage doit leur
    laisser leur case (US-118)."""
    reponse = client.put(
        "/api/characters/poses/marche", json={"nom": "déplacement", "images": 8}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["pose"] == {
        "identifiant": "marche",
        "nom": "déplacement",
        "images": 8,
        # **Ce que le message ne dit pas, il ne l'efface pas** (E10). L'écran
        # qui renomme envoie le nom et le compte, jamais la consigne anglaise ;
        # reconstruire la pose à partir du seul message l'aurait vidée à chaque
        # frappe — le motif payé trois fois (`docs/PIEGES.md`).
        "consigne": "walking posture, full body",
        "ecartees": [],
        "images_avant": 0,
    }

    plan = {p["identifiant"]: p for p in _tableau(client)["plan"]}
    assert plan["marche"]["nom"] == "déplacement"


def test_une_pose_inconnue_se_refuse_en_le_disant(client):
    refus = client.put("/api/characters/poses/vol-plane", json={"nom": "x"})
    assert refus.status_code == 404
    assert refus.json()["code"] == "pose_inconnue"


# ── « Un personnage dit lesquelles de ses poses il tient » (US-117) ───────────


def test_un_figurant_ne_reclame_pas_les_images_d_un_heros(client):
    personnage = _creer(client, "Le marchand")
    reponse = client.put(
        f"/api/characters/{personnage['identifiant']}", json={"poses": ["repos"]}
    )
    assert reponse.status_code == 200, reponse.text

    lu = _tableau(client)
    # Ce que le fichier garde est le **complément** de ce que l'écran coche :
    # c'est ce qui fait paraître une pose neuve chez tout le monde sans réécrire
    # personne.
    assert set(lu["personnages"][0]["ecartees"]) == {
        "marche",
        "course",
        "attaque",
        "degats",
        "mort",
    }
    assert _tenues(lu, "le-marchand") == ["repos"]

    # Et une pose ajoutée après coup arrive quand même chez lui : c'est le plan
    # qui décide, le personnage ne fait que soustraire.
    _ajouter_pose(client, "saut")
    assert _tenues(_tableau(client), "le-marchand") == ["repos", "saut"]


# ── Réseau coupé ─────────────────────────────────────────────────────────────


def test_le_plan_et_les_personnages_ne_demandent_jamais_le_fournisseur(client, double):
    """« Le plan, le personnage et la matrice se consultent et se modifient
    réseau coupé » — prouvé en comptant les appels du double, pas affirmé."""
    double.catalogue_lisible = False
    appels = double.appels

    personnage = _creer(client, "Le nain", "un forgeron")
    _ajouter_pose(client, "saut")
    client.put(f"/api/characters/{personnage['identifiant']}", json={"poses": ["saut"]})
    client.put("/api/characters/poses/saut", json={"nom": "bond"})
    client.delete("/api/characters/poses/mort")
    _tableau(client)

    assert double.appels == appels


# ── « Un personnage rattaché à six poses affiche six cases vides ; une pose
#     générée en remplit une, et les cinq autres restent visiblement vides »
#     (US-119) ────────────────────────────────────────────────────────────────


def _cases(client, personnage: str) -> list[dict]:
    tableau = _tableau(client)
    un = next(p for p in tableau["personnages"] if p["identifiant"] == personnage)
    return un["cases"]


def _designer(client, asset: str, personnage: str | None, pose: str | None) -> dict:
    reponse = client.put(
        f"/api/assets/{asset}/character", json={"personnage": personnage, "pose": pose}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_six_poses_font_six_cases_et_une_image_n_en_remplit_qu_une(client):
    _creer(client, "Le nain")
    cases = _cases(client, "le-nain")
    assert [c["pose"] for c in cases] == [
        "repos",
        "marche",
        "course",
        "attaque",
        "degats",
        "mort",
    ]
    assert all(c["images"] == [] for c in cases)

    generation = _generer(client, "un nain au repos")
    _designer(client, f"{generation['identifiant']}-0", "le-nain", "repos")

    cases = _cases(client, "le-nain")
    remplies = [c for c in cases if c["images"]]
    assert len(remplies) == 1
    assert remplies[0]["pose"] == "repos"
    assert remplies[0]["images"][0]["identifiant"] == f"{generation['identifiant']}-0"
    # Les cinq autres restent **visiblement** vides : elles existent, et elles
    # disent ce qu'elles attendent.
    assert len([c for c in cases if not c["images"]]) == 5


def test_une_case_se_vide_quand_l_image_s_en_va(client):
    """La matrice se **déduit** : aucune liste de cases pleines à remettre
    d'accord avec le disque, donc rien à défaire quand une image part."""
    _creer(client, "Le nain")
    generation = _generer(client)
    asset = f"{generation['identifiant']}-0"
    _designer(client, asset, "le-nain", "repos")
    assert _cases(client, "le-nain")[0]["images"]

    assert client.post("/api/assets/delete", json={"identifiants": [asset]}).status_code == 200
    assert _cases(client, "le-nain")[0]["images"] == []


def test_une_pose_ecartee_n_a_plus_de_case(client):
    _creer(client, "Le marchand")
    client.put("/api/characters/le-marchand", json={"poses": ["repos"]})
    assert [c["pose"] for c in _cases(client, "le-marchand")] == ["repos"]


# ── « Aucun écran de création de personnage avec son propre prompt n'existe :
#     le corps se désigne depuis une image née dans l'atelier » (US-122) ───────


def test_une_image_de_l_atelier_se_designe_comme_corps(client):
    _creer(client, "Le nain")
    generation = _generer(client, "un nain au repos")
    asset = f"{generation['identifiant']}-0"

    designe = _designer(client, asset, "le-nain", "repos")
    assert designe["personnage"] == "le-nain"
    assert designe["pose"] == "repos"

    # Et la désignation se retire — l'image reste en bibliothèque, sa case
    # redevient vide.
    rendu = _designer(client, asset, None, None)
    assert rendu["personnage"] is None
    assert _asset(client, asset)["pose"] is None


def test_designer_une_pose_que_le_personnage_ne_tient_pas_se_refuse(client):
    _creer(client, "Le marchand")
    client.put("/api/characters/le-marchand", json={"poses": ["repos"]})
    generation = _generer(client)

    refus = client.put(
        f"/api/assets/{generation['identifiant']}-0/character",
        json={"personnage": "le-marchand", "pose": "mort"},
    )
    assert refus.status_code == 409
    assert refus.json()["code"] == "production_refusee"
    assert "mort" in refus.json()["raison"]


def test_une_moitie_de_designation_se_refuse(client):
    """Une pose sans personnage ne désigne rien : le refus le dit plutôt que
    d'écrire un état à moitié."""
    generation = _generer(client)
    refus = client.put(
        f"/api/assets/{generation['identifiant']}-0/character",
        json={"pose": "repos"},
    )
    assert refus.status_code == 409


# ── « Une pose générée entre en bibliothèque comme tout asset : projet courant,
#     filiation, coût réel enregistré » (US-120) ──────────────────────────────


def test_une_pose_generee_tombe_dans_sa_case_et_entre_en_bibliotheque(client):
    _creer(client, "Le nain", "un forgeron nain à la barbe tressée")
    generation = _generer(
        client, "un nain qui marche", personnage="le-nain", pose="marche"
    )

    asset = _asset(client, f"{generation['identifiant']}-0")
    assert asset["personnage"] == "le-nain"
    assert asset["pose"] == "marche"
    # Un asset ordinaire, rangé comme les autres.
    assert asset["projet"] == "bac-a-sable"
    assert asset["cout_usd"] > 0
    assert asset["modele"] == MODELE

    cases = {c["pose"]: c["images"] for c in _cases(client, "le-nain")}
    assert [i["identifiant"] for i in cases["marche"]] == [asset["identifiant"]]


def test_generer_pour_une_case_qui_n_existe_plus_se_refuse_avant_de_payer(
    client, double
):
    """« Vérifiée avant qu'un centime parte. » Un onglet resté ouvert pendant
    qu'on décochait la pose ne doit pas envoyer une image dans une case que
    personne ne regarde plus."""
    _creer(client, "Le marchand")
    client.put("/api/characters/le-marchand", json={"poses": ["repos"]})
    appels = double.appels

    refus = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un marchand mort",
            "personnage": "le-marchand",
            "pose": "mort",
        },
    )
    assert refus.status_code == 409
    assert refus.json()["code"] == "production_refusee"
    assert double.appels == appels


# ── « Supprimer un personnage laisse ses images en place, chacune marquée
#     "personnage supprimé" — jamais de cascade » ──────────────────────────────


def test_supprimer_un_personnage_laisse_ses_images_marquees(client):
    _creer(client, "Le nain")
    generation = _generer(client, "un nain", personnage="le-nain", pose="repos")
    asset = f"{generation['identifiant']}-0"

    reponse = client.delete("/api/characters/le-nain")
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["images"] == 1

    # L'image est toujours là, et elle sait de qui elle n'est plus.
    survivante = _asset(client, asset)
    assert survivante["personnage"] == "le-nain"
    assert survivante["personnage_supprime"] is True
    assert survivante["supprime_le"] is None

    # Et le personnage, lui, est parti pour de bon.
    assert _tableau(client)["personnages"] == []
    assert client.delete("/api/characters/le-nain").status_code == 404


def test_la_matrice_ne_demande_jamais_le_fournisseur(client, double):
    """Consulter ce qui manque marche réseau coupé : seule la génération sort."""
    _creer(client, "Le nain")
    generation = _generer(client)
    appels = double.appels

    double.catalogue_lisible = False
    _designer(client, f"{generation['identifiant']}-0", "le-nain", "repos")
    assert _cases(client, "le-nain")[0]["images"]
    assert double.appels == appels


# ── Un personnage a **une** forme, quelle que soit la route qui le porte ──────


def test_un_personnage_a_la_meme_forme_sur_toutes_les_routes(client):
    """Trouvé au navigateur, et invisible aux essais d'écran (`docs/PIEGES.md`).

    L'écran fond ce qu'il reçoit par deux chemins qui se croisent — la réponse
    de l'appel et l'annonce du flux. Si l'un des deux rend le personnage sans
    ses cases, il **remplace** l'objet entier par un objet à trous : écrire une
    description vidait la matrice, puis la faisait tomber.

    L'essai compare donc les jeux de clés, et non le contenu : c'est la forme
    qui doit être une, pas la valeur.
    """
    cree = client.post("/api/characters", json={"nom": "Le nain"}).json()["personnage"]
    regle = client.put(
        "/api/characters/le-nain", json={"description": "un forgeron"}
    ).json()["personnage"]
    lu = _tableau(client)["personnages"][0]

    assert set(cree) == set(regle) == set(lu)
    assert "cases" in cree
    for charge in (cree, regle, lu):
        assert [c["pose"] for c in charge["cases"]] == [
            p["identifiant"] for p in _tableau(client)["plan"]
        ]


def test_l_annonce_porte_la_meme_forme_que_la_reponse(client, atelier):
    """Le flux aussi : c'est **par lui** que le défaut est arrivé à l'écran.

    On écoute la diffusion pendant qu'on règle, et on confronte la charge
    annoncée à celle que la route rend.
    """
    projet = atelier.bibliotheque.courant
    atelier.production.creer_personnage(projet, "Le nain")

    with atelier.diffusion.abonnement() as file:
        atelier.production.regler_personnage(projet, "le-nain", description="un forgeron")
        annonce = file.get_nowait()

    assert annonce.genre == "personnage"
    attendu = atelier.production.en_charge(
        projet, atelier.production.personnage(projet, "le-nain")
    )
    assert set(annonce.charge) == set(attendu)
    assert annonce.charge["cases"] == attendu["cases"]


# ── « Une carte image du tableau se désigne concept art d'un personnage, et
#     reste à sa place — aucune copie, aucun second rangement » (US-124) ───────


def _coller_carte(client, nom: str) -> str:
    """Une carte image de plus. `forcer`, parce que le double rend deux fois les
    mêmes octets — donc la même empreinte, donc un doublon *proposé*."""
    reponse = client.post(
        "/api/board/paste", params={"nom": nom, "forcer": True}, content=image("PNG")
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]["identifiant"]


def _references(client, **params) -> dict:
    return client.get("/api/models", params=params).json()["references"]


def test_un_concept_art_reste_une_carte_du_tableau(client):
    carte = _coller_carte(client, "nain-de-face.png")
    _creer(client, "Le nain")

    reponse = client.put("/api/characters/le-nain", json={"concept_arts": [carte]})
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["personnage"]["concept_arts"] == [carte]

    # Elle est **restée où elle est** : toujours sur le tableau, ni promue, ni
    # copiée en bibliothèque.
    tableau = client.get("/api/board").json()
    designee = next(c for c in tableau["cartes"] if c["identifiant"] == carte)
    assert designee["officiel"] is False
    assert client.get("/api/assets").json()["assets"] == []


def test_un_concept_art_part_avec_la_pose_quelle_que_soit_la_famille(client, double):
    """Un artwork officiel se filtre par famille ; un concept art a été désigné
    pour **ce personnage-là**, et l'application n'a rien à en retrancher."""
    carte = _coller_carte(client, "nain-de-face.png")
    _creer(client, "Le nain")
    client.put("/api/characters/le-nain", json={"concept_arts": [carte]})

    _generer(client, "un nain", personnage="le-nain", pose="repos", echelle="meuble")
    assert double.references_recues[-1] == 1

    # Et sans personnage visé, il ne part pas : il n'appartient à personne
    # d'autre.
    _generer(client, "un tonneau", echelle="meuble")
    assert double.references_recues[-1] == 0


# ── « Avant de lancer, chaque référence envoyée est listée avec sa provenance
#     nommée, et le coût est annoncé » (US-121, US-127) ───────────────────────


def test_chaque_reference_est_listee_avec_sa_provenance(client):
    officiel = _coller_carte(client, "planche-de-style.png")
    client.put(f"/api/board/{officiel}/official", json={"officiel": True, "famille": "tous"})
    concept = _coller_carte(client, "nain-de-face.png")
    _creer(client, "Le nain")
    client.put("/api/characters/le-nain", json={"concept_arts": [concept]})

    compte = _references(client, personnage="le-nain")
    provenances = {ligne["asset"]: ligne["provenance"] for ligne in compte["lignes"]}
    assert provenances == {officiel: "artwork officiel", concept: "concept art"}
    assert compte["total"] == 2
    assert compte["artworks"] == 1
    assert compte["concepts"] == 1
    assert all(ligne["ecartee_par"] is None for ligne in compte["lignes"])


# ── « Une référence se décoche à trois portées — cette génération, ce
#     personnage, tout le projet — et la portée retenue est lisible » (US-126) ─


def test_ecarter_pour_tout_le_projet(client, double):
    officiel = _coller_carte(client, "planche-de-style.png")
    client.put(f"/api/board/{officiel}/official", json={"officiel": True, "famille": "tous"})
    univers_avant = client.get("/api/universe").json()["univers"]

    reponse = client.put(
        "/api/references", json={"portee": "projet", "ecartees": [officiel]}
    )
    assert reponse.status_code == 200, reponse.text

    compte = _references(client)
    assert compte["total"] == 0
    # **La ligne reste visible, et elle dit qui l'écarte** : une ligne disparue
    # ne laisserait aucun moyen de la remettre.
    assert [l["ecartee_par"] for l in compte["lignes"]] == ["projet"]

    # « Décocher ne modifie ni l'univers, ni les artworks officiels du projet. »
    assert client.get("/api/universe").json()["univers"] == univers_avant
    carte = next(
        c for c in client.get("/api/board").json()["cartes"] if c["identifiant"] == officiel
    )
    assert carte["officiel"] is True and carte["famille"] == "tous"

    # Et elle ne part plus.
    _generer(client, "un tonneau")
    assert double.references_recues[-1] == 0


def test_ecarter_pour_un_personnage_ne_touche_pas_l_autre(client):
    officiel = _coller_carte(client, "planche-de-style.png")
    client.put(f"/api/board/{officiel}/official", json={"officiel": True, "famille": "tous"})
    _creer(client, "Le nain")
    _creer(client, "La prêtresse")

    client.put(
        "/api/references",
        json={"portee": "personnage", "personnage": "le-nain", "ecartees": [officiel]},
    )

    assert _references(client, personnage="le-nain")["total"] == 0
    assert _references(client, personnage="le-nain")["lignes"][0]["ecartee_par"] == (
        "personnage"
    )
    assert _references(client, personnage="la-pretresse")["total"] == 1


def test_la_portee_la_plus_etroite_l_emporte(client, double):
    """Ce que la génération dit décide **seule** : c'est la plus étroite, et
    c'est la règle affichée à l'écran. Elle sert dans les deux sens — écarter ce
    que le projet garde, et garder ce que le projet écarte."""
    officiel = _coller_carte(client, "planche-de-style.png")
    client.put(f"/api/board/{officiel}/official", json={"officiel": True, "famille": "tous"})
    client.put("/api/references", json={"portee": "projet", "ecartees": [officiel]})

    # Le projet l'écarte, cette génération-ci le remet.
    _generer(client, "un tonneau", references_ecartees=[])
    assert double.references_recues[-1] == 1

    # Et sans avis, la portée durable s'applique — un agent, une relance.
    _generer(client, "un tonneau")
    assert double.references_recues[-1] == 0


def test_une_portee_qui_ne_s_ecrit_pas_se_refuse_en_le_disant(client):
    refus = client.put("/api/references", json={"portee": "personnage", "ecartees": []})
    assert refus.status_code == 409
    assert refus.json()["code"] == "production_refusee"


def test_le_panneau_des_references_ne_demande_jamais_le_fournisseur(client, double):
    carte = _coller_carte(client, "nain-de-face.png")
    _creer(client, "Le nain")
    client.put("/api/characters/le-nain", json={"concept_arts": [carte]})
    appels = double.appels

    double.catalogue_lisible = False
    assert _references(client, personnage="le-nain")["total"] == 1
    client.put("/api/references", json={"portee": "projet", "ecartees": [carte]})
    assert _references(client, personnage="le-nain")["lignes"][0]["ecartee_par"] == "projet"

    assert double.appels == appels


# ── « …et le coût est annoncé » (US-121) ─────────────────────────────────────


def test_le_cout_annonce_est_mesure_jamais_suppose(client, double):
    """Le produit ne porte aucun tarif de catalogue, et il ne doit pas en
    porter : « le classement des modèles par coût est contre-intuitif et doit
    rester mesuré ». Ce qu'il annonce est donc la médiane de ce que ce
    modèle-là a **réellement facturé** sur cette machine.
    """
    # Jamais appelé : le produit ne sait pas, et il ne l'invente pas.
    assert client.get("/api/models").json()["couts"] == {}

    _generer(client)
    couts = client.get("/api/models").json()["couts"]
    assert couts[MODELE] == 0.0245

    # L'autre modèle n'a toujours rien facturé : il reste muet.
    assert AUTRE_MODELE not in couts

    # Et l'annonce ne demande jamais le fournisseur.
    double.catalogue_lisible = False
    appels = double.appels
    assert client.get("/api/models").json()["couts"][MODELE] == 0.0245
    assert double.appels == appels
