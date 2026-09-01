# -*- coding: utf-8 -*-
"""Les critères d'acceptation de C3 — la pièce et le calque.

**Aucun test ne coûte un centime.** Le double de `conftest.py` rend la planche
d'équipement telle qu'un modèle la rendrait : *ce qui est parti, avec la pièce en
plus* — et il la fabrique à partir des octets réellement reçus, jamais d'une
image écrite d'après l'intention. C'est la leçon payée en C1 : un double écrit
d'après ce qu'on espère prouve ce qu'on espère, pas le serveur.

Deux tests **comptent les appels du double** avant et après : c'est ainsi que
« le masque ne coûte pas un centime » et « réseau coupé, tout marche » se
prouvent, et c'est le geste du dépôt depuis T2.
"""

from __future__ import annotations

import io

import numpy
import pytest
from PIL import Image, ImageDraw

from atelier.domaine.pliage import geometrie
from atelier.image import calque as calc
from conftest import FOND, image_sujet

MODELE = "essai:rend-du-png"


# ── Ce que le modèle rend : la planche reçue, avec la pièce en plus ──────────


def habiller(demande, *, cases: int, sur=None, echelle: float = 1.0) -> bytes:
    """La planche reçue, avec un carré posé sur chaque sujet.

    **Elle part des octets reçus**, et c'est tout l'intérêt : la comparaison du
    produit se fait case par case contre ce qu'il avait envoyé, donc un double
    qui redessinerait la planche de son côté ne prouverait rien de ce recalage.

    `sur` limite la pièce à certaines cases — de quoi vérifier que les autres
    ressortent vides. `echelle` rejoue le dézoom mesuré le 28 août sur une pièce
    qui agrandit la silhouette.
    """
    envoyee = demande.references[-1]
    with Image.open(io.BytesIO(envoyee)) as ouverte:
        planche = ouverte.convert("RGB")
    dessin = ImageDraw.Draw(planche)
    forme = geometrie(cases)
    for index, boite in enumerate(calc.cases_de(planche.width, planche.height, forme)):
        if sur is not None and index not in sur:
            continue
        x0, y0, x1, y1 = boite
        large, haut = x1 - x0 + 1, y1 - y0 + 1
        dessin.rectangle(
            [
                x0 + large // 3,
                y0 + haut // 4,
                x0 + 2 * large // 3,
                y0 + haut // 4 + haut // 8,
            ],
            fill=(20, 120, 40),
        )
    if echelle != 1.0:
        # **Case par case, et c'est ce qu'un modèle fait vraiment** : il rétrécit
        # le sujet dans sa case pour faire tenir la pièce, il ne rétrécit pas la
        # planche. Mesuré le 28 août sur six modèles, sans exception : 0,62.
        for boite in calc.cases_de(planche.width, planche.height, forme):
            x0, y0, x1, y1 = boite
            case = planche.crop((x0, y0, x1 + 1, y1 + 1))
            cote = (round(case.width * echelle), round(case.height * echelle))
            petite = case.resize(cote, Image.Resampling.NEAREST)
            planche.paste(FOND, (x0, y0, x1 + 1, y1 + 1))
            planche.paste(
                petite,
                (x0 + (case.width - cote[0]) // 2, y0 + (case.height - cote[1]) // 2),
            )
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


# ── Le montage : un personnage, des corps, une pièce ─────────────────────────


def _projet(client) -> str:
    return client.get("/api/library").json()["courant"]


def _total(client) -> float:
    """Ce que le projet courant a coûté — la ligne du journal qui ne doit pas
    bouger quand on déplace un masque."""
    arbre = client.get("/api/library").json()
    for projet in arbre["projets"]:
        if projet["identifiant"] == arbre["courant"]:
            return projet["total_usd"]
    raise AssertionError("projet courant absent de l'arbre")  # pragma: no cover


def _personnage(client, poses: int) -> tuple[str, list[str]]:
    """Un personnage qui tient `poses` poses du plan par défaut."""
    tableau = client.get("/api/characters").json()
    plan = [p["identifiant"] for p in tableau["plan"]][:poses]
    personnage = client.post(
        "/api/characters", json={"nom": "Nain", "description": "un nain"}
    ).json()["personnage"]["identifiant"]
    client.put(
        f"/api/characters/{personnage}", json={"poses": plan}
    )
    return personnage, plan


def _corps(client, double, personnage: str, poses: list[str]) -> dict[str, str]:
    """Une image de corps par pose, née dans l'atelier — et nulle part ailleurs."""
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    faits: dict[str, str] = {}
    for pose in poses:
        reponse = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": f"le nain, {pose}",
                "personnage": personnage,
                "pose": pose,
            },
        ).json()
        _attendre(client, reponse["identifiant"])
        assets = client.get("/api/characters").json()["personnages"][0]
        for case in assets["cases"]:
            if case["pose"] == pose and case["images"]:
                faits[pose] = case["images"][0]["identifiant"]
    double.rendre = None
    assert len(faits) == len(poses)
    return faits


def _attendre(client, identifiant: str) -> dict:
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")  # pragma: no cover


def _piece(client, nom="casque", emplacement="tête", portee="contenue") -> str:
    return client.post(
        "/api/characters/pieces",
        json={
            "nom": nom,
            "description": "un casque de fer à cornes",
            "emplacement": emplacement,
            "portee": portee,
        },
    ).json()["piece"]["identifiant"]


def _habiller(client, double, personnage, piece, poses, **kw) -> dict:
    double.repondre = lambda demande: habiller(demande, cases=len(poses), **kw)
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a horned iron helmet on his head",
            "personnage": personnage,
            "piece": piece,
            "poses": poses,
        },
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _opaques(octets: bytes) -> int:
    """Combien de pixels un calque porte vraiment — la mesure qui dit si un
    masque a mordu."""
    with Image.open(io.BytesIO(octets)) as ouverte:
        return int((numpy.asarray(ouverte.convert("RGBA"))[:, :, 3] >= 128).sum())


def _cases(client, personnage: str) -> list[dict]:
    tableau = client.get("/api/characters").json()
    for un in tableau["personnages"]:
        if un["identifiant"] == personnage:
            return un["cases"]
    raise AssertionError("personnage absent de la matrice")  # pragma: no cover


# ── Les critères ─────────────────────────────────────────────────────────────


def test_six_poses_un_seul_appel_six_calques(client, double):
    """Un casque posé sur six poses donne six calques, un par pose, après **un
    seul** appel payant — et le journal du projet montre un appel, pas six."""
    personnage, poses = _personnage(client, 6)
    _corps(client, double, personnage, poses)
    appels_avant = double.appels
    piece = _piece(client)

    _habiller(client, double, personnage, piece, poses)

    assert double.appels - appels_avant == 1

    cases = _cases(client, personnage)
    assert len(cases) == 6
    calques = [c["calques"].get(piece, []) for c in cases]
    assert all(len(c) == 1 for c in calques), calques
    # Six calques **distincts** : six identifiants, six poses.
    identifiants = {c[0]["identifiant"] for c in calques}
    assert len(identifiants) == 6
    # **Un par pose** — chacun sait de laquelle il est.
    assert {c[0]["pose"] for c in calques} == set(poses)

    # Le journal du projet : une génération payante de plus, et une seule.
    journal = client.get("/api/generations").json()["generations"]
    planches = [g for g in journal if g.get("piece")]
    assert len(planches) == 1
    assert planches[0]["reussies"] == 1


def test_le_calque_se_superpose_et_le_corps_est_intact(client, double):
    """Chaque calque s'affiche superposé au corps de **sa** pose, et le corps
    d'origine est retrouvé **octet pour octet**."""
    personnage, poses = _personnage(client, 2)
    corps = _corps(client, double, personnage, poses)
    avant = {
        identifiant: client.get(
            f"/api/assets/{identifiant}/image"
        ).content
        for identifiant in corps.values()
    }

    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    # **Octet pour octet** : le corps d'origine n'est jamais modifié.
    for identifiant, octets in avant.items():
        assert (
            client.get(f"/api/assets/{identifiant}/image").content == octets
        )

    for case in _cases(client, personnage):
        calque = case["calques"][piece][0]
        corps_asset = client.get(f"/api/assets/{corps[case['pose']]}").json()
        # Superposable veut dire : mêmes dimensions rendues que le corps de sa
        # pose. Sans ça, « le calque s'affiche sur le corps » demanderait une
        # mise à l'échelle que personne n'a demandée.
        assert (calque["rendu_largeur"], calque["rendu_hauteur"]) == (
            corps_asset["rendu_largeur"] or corps_asset["largeur"],
            corps_asset["rendu_hauteur"] or corps_asset["hauteur"],
        )
        # Et il **dit** de quel corps il est.
        assert calque["recette"]["difference"]["base"] == corps[case["pose"]]


def test_une_pose_sans_corps_est_impossible_a_lancer(client, double):
    """Une planche d'équipement où figurerait une pose sans corps ne part pas :
    la pose est inéligible, et le refus porte sa raison."""
    personnage, poses = _personnage(client, 3)
    _corps(client, double, personnage, poses[:2])
    piece = _piece(client)
    appels = double.appels

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a helmet",
            "personnage": personnage,
            "piece": piece,
            "poses": poses,
        },
    )
    assert reponse.status_code == 409
    assert "n'a pas encore de corps" in reponse.json()["raison"]
    # **Rien n'est parti** : le refus est avant le premier centime.
    assert double.appels == appels

    # Et la matrice le dit d'elle-même : la pose sans corps n'en désigne aucun.
    cases = {c["pose"]: c for c in _cases(client, personnage)}
    assert cases[poses[0]]["corps"] is not None
    assert cases[poses[2]]["corps"] is None


def test_la_comparaison_se_fait_case_par_case(client, double):
    """La planche revenue est redécoupée sur la grille exacte que l'atelier a
    posée, et chaque case est comparée à **celle** qu'il avait envoyée.

    La preuve : le modèle n'habille qu'une case sur quatre. Si la comparaison
    était globale ou décalée d'une case, les trois autres calques porteraient
    quelque chose.
    """
    personnage, poses = _personnage(client, 4)
    _corps(client, double, personnage, poses)
    piece = _piece(client)

    _habiller(client, double, personnage, piece, poses, sur={2})

    remplis = []
    for index, case in enumerate(_cases(client, personnage)):
        calque = case["calques"][piece][0]
        octets = client.get(
            f"/api/assets/{calque['identifiant']}/image"
        ).content
        remplis.append((index, _opaques(octets)))

    habillee = [index for index, opaques in remplis if opaques > 0]
    assert habillee == [2], remplis


def test_rien_n_est_ajoute_a_l_image_envoyee(client, double):
    """Ni ancre, ni mire, ni silhouette de repère — et pas davantage le gabarit
    de cases vides de C2.

    Ce qui part est **exactement** la planche que l'atelier compose des corps :
    l'essai la recompose de son côté et confronte les octets.
    """
    personnage, poses = _personnage(client, 4)
    corps = _corps(client, double, personnage, poses)
    piece = _piece(client)

    _habiller(client, double, personnage, piece, poses)

    envoyee = double.demandes[-1].references
    # **Une seule image jointe**, et c'est la planche.
    assert len(envoyee) == 1

    attendue = calc.composer(
        [
            client.get(f"/api/assets/{corps[pose]}/image").content
            for pose in poses
        ],
        geometrie(4),
        calc.OCCUPATION_CONTENUE,
    )
    assert envoyee[0] == attendue

    # Et le gabarit de C2 n'est pas passé par là : ses traits sont d'un gris
    # distinct du fond, et la planche d'équipement n'en porte aucun.
    from atelier.image.pliage import TRAIT

    with Image.open(io.BytesIO(envoyee[0])) as ouverte:
        couleurs = numpy.asarray(ouverte.convert("RGB")).reshape(-1, 3)
    assert not (couleurs == numpy.array(TRAIT, dtype=couleurs.dtype)).all(axis=1).any()


def test_les_six_proposes_se_posent_en_un_geste_et_pas_deux_fois(client):
    """L'atelier propose six emplacements ; les poser est un geste de l'auteur,
    il respecte l'ordre de l'empilement, et le rappeler n'ajoute rien."""
    from atelier.domaine.equipement import EMPLACEMENTS_PROPOSES

    # **Le vestiaire naît vide et le reste** : personne ne sait d'avance ce
    # qu'un jeu équipe, et six noms écrits derrière le dos de l'auteur seraient
    # six noms à effacer.
    assert client.get("/api/characters").json()["emplacements"] == []

    pose = client.post("/api/characters/slots/suggested", json={}).json()
    # **L'ordre est celui de l'empilement, du fond vers l'avant**, et c'est lui
    # qui fait la démonstration de la règle que l'étape énonce : le dos passe
    # derrière le corps, la tête devant tout le reste. Un ordre alphabétique
    # n'apprendrait rien.
    assert [e["nom"] for e in pose["emplacements"]] == list(EMPLACEMENTS_PROPOSES)
    assert [e["rang"] for e in pose["emplacements"]] == list(
        range(len(EMPLACEMENTS_PROPOSES))
    )

    # Rappelée, elle n'ajoute que ce qui manque — donc rien. C'est ce qui la
    # rend sans danger sur un projet en cours.
    encore = client.post("/api/characters/slots/suggested", json={}).json()
    assert [e["nom"] for e in encore["emplacements"]] == list(EMPLACEMENTS_PROPOSES)


def test_les_proposes_completent_un_vestiaire_commence_sans_rien_renommer(client):
    """Sur un vestiaire déjà commencé, le geste ajoute ce qui manque et laisse
    intact ce qui est là — identifiant compris."""
    deja = client.post("/api/characters/slots", json={"nom": "la tête"}).json()
    tete = deja["emplacement"]["identifiant"]

    apres = client.post("/api/characters/slots/suggested", json={}).json()
    noms = [e["nom"] for e in apres["emplacements"]]
    # Six noms proposés, un déjà pris : cinq de plus, et pas de doublon.
    assert noms[0] == "la tête"
    assert sorted(noms) == sorted({"la tête", *noms})
    assert len(noms) == 6

    # **L'identifiant de ce qui existait ne bouge pas** : les pièces déjà
    # rangées le portent, et le geste ne doit ranger personne ailleurs.
    assert apres["emplacements"][0]["identifiant"] == tete


def test_nommer_cree_et_les_emplacements_sont_ordonnes(client):
    """Écrire un nom d'emplacement ou de pièce qui n'existe pas le crée
    sur-le-champ ; les emplacements gardent leur ordre."""
    for nom in ("tête", "dos", "jambes"):
        client.post("/api/characters/slots", json={"nom": nom})

    vestiaire = client.get("/api/characters").json()
    assert [e["nom"] for e in vestiaire["emplacements"]] == ["tête", "dos", "jambes"]
    assert [e["rang"] for e in vestiaire["emplacements"]] == [0, 1, 2]

    # **Une pièce nommée sur un emplacement qui n'existe pas le crée aussi** :
    # ranger n'est jamais un préalable.
    reponse = client.post(
        "/api/characters/pieces",
        json={"nom": "cape", "emplacement": "épaules"},
    ).json()
    assert [e["nom"] for e in reponse["emplacements"]][-1] == "épaules"
    epaules = reponse["emplacements"][-1]["identifiant"]
    assert reponse["piece"]["emplacement"] == epaules

    # Renommer ne change pas l'identifiant : la pièce reste rangée.
    client.put(
        f"/api/characters/slots/{epaules}", json={"nom": "buste"}
    )
    apres = client.get("/api/characters").json()
    assert apres["pieces"][0]["emplacement"] == epaules
    assert [e["nom"] for e in apres["emplacements"]][-1] == "buste"


def test_la_portee_est_declaree_jamais_devinee(client):
    """Une pièce déclare sa portée, le défaut est « contenue », et rien ne la
    devine à la place de l'auteur."""
    par_defaut = client.post(
        "/api/characters/pieces",
        json={"nom": "casque", "description": "un casque"},
    ).json()["piece"]
    assert par_defaut["portee"] == "contenue"

    # Une cape reste contenue tant que l'auteur ne dit rien — **le produit ne
    # lit pas le mot « cape »** pour en déduire quoi que ce soit.
    cape = client.post(
        "/api/characters/pieces",
        json={"nom": "cape", "description": "une longue cape qui traîne au sol"},
    ).json()["piece"]
    assert cape["portee"] == "contenue"

    declaree = client.put(
        f"/api/characters/pieces/{cape['identifiant']}",
        json={"portee": "agrandit"},
    ).json()["piece"]
    assert declaree["portee"] == "agrandit"


def test_une_piece_qui_agrandit_et_derive_ne_fait_aucun_calque(client, double):
    """Une pièce « qui agrandit » revenue à une autre échelle que celle envoyée
    ne produit **aucun** calque : ce qui revient est gardé comme des corps
    habillés, et la dérive est lisible."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client, nom="cape", emplacement="dos", portee="agrandit")

    _habiller(client, double, personnage, piece, poses, echelle=0.62)

    cases = _cases(client, personnage)
    entrees = [c["calques"][piece][0] for c in cases]
    # **Aucun calque** : la recette ne porte pas de différence.
    assert all(e["recette"]["difference"] is None for e in entrees)
    # Mais tout est **gardé** — l'appel payé n'est pas perdu (US-148).
    assert len(entrees) == 2
    # Et la dérive est nommée : l'échelle au retour est lisible sur chaque image.
    assert all(abs(e["calque"]["echelle"] - 1.0) > calc.ECHELLE_TOLEREE for e in entrees)


def test_un_corps_habille_est_un_asset_ordinaire(client, double):
    """Rangé, exportable, avec son coût — il ne s'empile simplement pas."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client, nom="cape", emplacement="dos", portee="agrandit")
    _habiller(client, double, personnage, piece, poses, echelle=0.62)

    habille = _cases(client, personnage)[0]["calques"][piece][0]
    fiche = client.get(f"/api/assets/{habille['identifiant']}").json()
    assert fiche["projet"] == _projet(client)
    assert fiche["modele"] == MODELE

    archive = client.post(
        "/api/exports", json={"identifiants": [habille["identifiant"]]}
    )
    assert archive.status_code == 200
    assert archive.content[:2] == b"PK"


def test_par_defaut_aucun_masque(client, double):
    """Par défaut, la différence est cherchée sur toute la case : **le produit ne
    devine aucune zone**."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    for case in _cases(client, personnage):
        assert case["calques"][piece][0]["recette"]["difference"]["zone"] is None


def test_le_masque_se_deplace_sans_un_centime(client, double):
    """Le masque d'un calque déjà fabriqué se déplace et se retaille, le calque
    se recalcule, et **le journal du projet ne bouge pas d'un centime**."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _cases(client, personnage)[0]["calques"][piece][0]
    identifiant = calque["identifiant"]
    large = client.get(f"/api/assets/{identifiant}/image").content

    appels = double.appels
    total = _total(client)

    # Un masque au coin, là où la pièce n'est pas : le calque se vide.
    borne = client.put(
        f"/api/assets/{identifiant}/layer", json={"zone": [0, 0, 3, 3]}
    )
    assert borne.status_code == 200
    assert borne.json()["recette"]["difference"]["zone"] == [0, 0, 3, 3]

    serre = client.get(f"/api/assets/{identifiant}/image").content
    assert serre != large  # le calque s'est **recalculé**
    assert _opaques(serre) == 0

    # On le retaille sur la case entière : la pièce est de retour, et rien n'a
    # été redemandé au fournisseur.
    client.put(
        f"/api/assets/{identifiant}/layer",
        json={"zone": [0, 0, calque["rendu_largeur"] - 1, calque["rendu_hauteur"] - 1]},
    )
    assert _opaques(client.get(f"/api/assets/{identifiant}/image").content) > 0

    assert double.appels == appels
    assert _total(client) == total


def test_revenir_a_la_difference_brute_est_un_geste(client, double):
    """Le calque est rangé à côté de l'image payée et jamais écrit dedans, et
    revenir à la différence brute est un geste unique."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    generation = _habiller(client, double, personnage, piece, poses)

    calque = _cases(client, personnage)[0]["calques"][piece][0]
    identifiant = calque["identifiant"]
    brute = client.get(f"/api/assets/{identifiant}/image").content

    # **À côté de l'image payée** : le calque vit dans la génération de la
    # planche, à un rang au-dessus des emplacements.
    assert calque["generation"] == generation["identifiant"]
    assert calque["rang"] >= 100

    client.put(
        f"/api/assets/{identifiant}/layer", json={"zone": [0, 0, 4, 4]}
    )
    assert client.get(f"/api/assets/{identifiant}/image").content != brute

    # Un geste, et la différence brute est de retour.
    rendu = client.put(
        f"/api/assets/{identifiant}/layer", json={"zone": None}
    ).json()
    assert rendu["recette"]["difference"]["zone"] is None
    assert client.get(f"/api/assets/{identifiant}/image").content == brute


def test_les_mesures_s_affichent_et_ne_refusent_rien(client, double):
    """Les cinq mesures sont là, et **aucune** ne rend un calque impossible à
    garder."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    for case in _cases(client, personnage):
        mesures = case["calques"][piece][0]["calque"]
        # **Cinq mesures, et pas une de plus.** Les deux clés qui les
        # accompagnent depuis C4 n'en sont pas : elles se *déduisent* de ces
        # cinq-là pour ordonner ce qu'on regarde (US-152), et `depuis_json` ne
        # les relit jamais. Le jour où une sixième *mesure* paraîtrait, ce test
        # tomberait — c'est son métier.
        assert set(mesures) - {"pire", "gravite"} == {
            "silhouette",
            "repeint",
            "ajout",
            "echelle",
            "compacite",
        }
        assert all(
            isinstance(v, float) for c, v in mesures.items() if c != "pire"
        )
        # Rien n'a refusé : le calque est là, avec sa différence.
        assert case["calques"][piece][0]["recette"]["difference"] is not None


def test_aucune_generation_de_piece_seule(client):
    """Une pièce n'apparaît que sur un corps : il n'existe aucun prompt de pièce,
    et aucune route qui en fabrique une image."""
    schema = client.get("/api/openapi.json").json()
    corps_piece = schema["components"]["schemas"]["CorpsPiece"]["properties"]
    assert "prompt" not in corps_piece
    assert "modele" not in corps_piece

    # Et une planche d'équipement sans personnage est refusée : sans corps, il
    # n'y a rien à habiller.
    piece = _piece(client)
    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un casque", "piece": piece},
    )
    assert reponse.status_code == 409
    assert "corps" in reponse.json()["raison"]


def test_un_calque_ne_se_repose_pas_ailleurs(client, double):
    """Le produit ne propose nulle part de reposer un calque sur une autre pose
    que la sienne."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _cases(client, personnage)[0]["calques"][piece][0]
    reponse = client.put(
        f"/api/assets/{calque['identifiant']}/character",
        json={"personnage": personnage, "pose": poses[1]},
    )
    assert reponse.status_code == 409
    assert "solidaire de sa pose" in reponse.json()["raison"]


def test_reseau_coupe(client, double, atelier):
    """Le masque, le recalcul de différence et la superposition fonctionnent
    réseau coupé — **prouvé en comptant les appels du double**."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    double.catalogue_lisible = False
    double.echec = RuntimeError("réseau coupé")
    appels = double.appels

    calque = _cases(client, personnage)[0]["calques"][piece][0]["identifiant"]

    # Le vestiaire s'écrit et se relit.
    assert (
        client.post(
            "/api/characters/pieces", json={"nom": "gants"}
        ).status_code
        == 201
    )
    # Le masque se pose, le calque se recalcule, et la superposition s'affiche.
    assert (
        client.put(
            f"/api/assets/{calque}/layer", json={"zone": [0, 0, 6, 6]}
        ).status_code
        == 200
    )
    assert client.get(f"/api/assets/{calque}/image").status_code == 200
    assert client.get("/api/characters").status_code == 200

    assert double.appels == appels



def _corps_detaille(cote: int = 96) -> bytes:
    """Un corps avec de l'encre fine, et dont la silhouette touche son cadre.

    C'est la forme du vrai : un rendu de projet est calé sur sa grille et ancré
    en bas, et un sujet de jeu porte des détails d'un ou deux pixels — un pic,
    une lanterne, une boucle. Un bloc plein ne prouverait rien : il traverse un
    rééchantillonnage sans perdre un pixel, et c'est justement cette perte-là
    que l'essai suivant met en cause.
    """
    image = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessin.rectangle((cote // 4, 0, 3 * cote // 4, cote - 1), fill=(90, 70, 50, 255))
    dessin.line(
        (3 * cote // 4, cote // 3, cote - 3, 3), fill=(150, 140, 120, 255), width=2
    )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


@pytest.mark.parametrize(
    "occupation", [calc.OCCUPATION_CONTENUE, calc.OCCUPATION_AGRANDIT]
)
def test_un_retour_presque_identique_n_est_pas_une_derive(occupation):
    """Perdre deux pour mille d'encre n'est pas être revenu à 0,76×.

    **L'invariant le plus simple de la tranche, et il était faux** — trouvé à
    l'usage le 29 août 2026, sur le premier casque envoyé (`docs/PIEGES.md`).
    La recherche d'échelle notait chaque candidate à *la part du corps qu'elle
    recouvre*. Or cette part **croît avec l'échelle** : agrandir le revenu finit
    toujours par recouvrir tout le corps. Le critère demandait donc « quelle est
    la plus grande échelle ? », et la bonne ne gagnait que par l'égalité — donc
    seulement si le recouvrement était **exactement** parfait.

    Il ne l'est jamais tout à fait. Le cadre part vers la planche agrandi d'un
    facteur non entier, et revient réduit : le contour fin y perd quelques
    pixels. Deux pour mille suffisaient à faire déclarer 0,76× une planche
    revenue intacte — et le calque valait alors toute la silhouette au lieu de
    la seule pièce, ce que l'auteur voyait à l'écran.

    Les deux occupations sont éprouvées. Celle qui passait ne passait que par
    chance : son cadre tombait sur un facteur assez rond pour ne rien perdre.
    """
    corps_octets = _corps_detaille()
    corps = calc.avec_alpha(corps_octets)
    hauteur, largeur = corps.shape[:2]

    # Le retour : le même corps, moins ce qu'un aller-retour lui coûte.
    pixels = numpy.array(Image.open(io.BytesIO(corps_octets)).convert("RGBA"))
    ys, xs = numpy.nonzero(pixels[:, :, 3] > 0)
    pas = max(1, len(ys) // 12)
    pixels[ys[::pas], xs[::pas], 3] = 0
    rogne = io.BytesIO()
    Image.fromarray(pixels, "RGBA").save(rogne, format="PNG")

    forme = geometrie(1)
    case = calc.cases_de(calc.COTE, calc.COTE, forme)[0]
    place = calc.place_de(largeur, hauteur, case, occupation)
    revenue = calc.composer([rogne.getvalue()], forme, occupation)

    retour = calc.recadrer_sur(calc.avec_alpha(revenue), place, case, corps)

    assert retour.echelle == 1.0
    assert retour.silhouette >= 0.99
    # Et la conséquence qui intéresse l'auteur : le calque est vide, pas entier.
    mesures = calc.mesurer_calque(corps, retour, 32)
    assert mesures.ajout <= 0.02


@pytest.mark.parametrize("portee", ["contenue", "agrandit"])
def test_l_occupation_suit_la_portee(client, double, portee):
    """Une pièce qui agrandit part sur une toile avec marge — c'est la seule
    différence d'envoi entre les deux portées, et elle est mesurable."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client, nom=f"piece-{portee}", portee=portee)

    _habiller(client, double, personnage, piece, poses)

    generation = [
        g
        for g in client.get("/api/generations").json()["generations"]
        if g.get("piece") == piece
    ][0]
    attendue = (
        calc.OCCUPATION_AGRANDIT if portee == "agrandit" else calc.OCCUPATION_CONTENUE
    )
    assert generation["pliage"]["occupation"] == attendue
    assert generation["pliage"]["geometrie_connue"] is True
