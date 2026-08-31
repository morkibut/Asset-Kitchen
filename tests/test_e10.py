# -*- coding: utf-8 -*-
"""Les critères de E10 qui vivent côté serveur — la vue du jeu et ses directions.

**Ce qui se mesure ici** : que la liste des directions se déduise de la vue et
reste une proposition, qu'une case soit une pose *dans une direction*, que la
consigne qui part se compose de deux textes anglais écrits chacun à un seul
endroit, que rien de français ne subsiste dans ce qui part, et que les deux
précautions tiennent — le rangement des images d'avant, et la proposition de
baisse. Ce que l'écran montre — la colonne qui dit *4 · lues*, les sous-rangées,
la jauge — vit dans `interface/src/App.test.tsx`.

**La panne que ça répare est mesurée sur le vrai projet.** Le produit connaissait
une pose appelée « marche » et un nombre d'images à remplir, **sans savoir ce que
chacune de ces images devait montrer**. Il ne pouvait donc pas dire qu'il
manquait le nord. Et la direction était écrite à la main dans la bible —
`4-directional orientation` — d'où elle partait avec les vingt-huit générations
du projet, y compris six planches d'équipement où elle contredisait la consigne
de l'appel.
"""

from __future__ import annotations

import itertools

from atelier.domaine.direction import composer
from atelier.domaine.plan import CONSIGNES, PLAN_PAR_DEFAUT, Pose
from atelier.domaine.vue import QUATRE, VUES, vue as vue_connue

from tests.conftest import image_sujet


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _directions(client) -> dict:
    reponse = client.get("/api/characters/directions")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _vue(client, identifiant: str) -> None:
    reponse = client.put("/api/universe", json={"vue": identifiant})
    assert reponse.status_code == 200, reponse.text


def _chose(client, personnage: str) -> dict:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    return next(
        p for p in reponse.json()["personnages"] if p["identifiant"] == personnage
    )


def _cases(client, personnage: str) -> dict[str, dict]:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    chose = next(
        p for p in reponse.json()["personnages"] if p["identifiant"] == personnage
    )
    return {c["pose"]: c for c in chose["cases"]}


_DISTINCTES = itertools.count(3)


def _poser(client, tmp_path, personnage: str, pose: str, direction: str = "") -> dict:
    """Une image importée, rangée dans une case — et dans une direction si on le
    dit. Sans direction, c'est une image faite **avant** la déclaration."""
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{personnage}-{pose}-{direction}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    corps = {"personnage": personnage, "pose": pose}
    if direction:
        corps["direction"] = direction
    reponse = client.put(f"/api/assets/{asset['identifiant']}/character", json=corps)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── La vue déclare, la liste se déduit ───────────────────────────────────────


def test_la_liste_des_directions_se_deduit_de_la_vue(client):
    """**Un seul geste remplit les deux moitiés** : la phrase de style dans la
    bible, et la liste des directions dans le codex. Les régler à deux endroits
    laisserait l'un libre de contredire l'autre — c'est exactement la faute que
    le dépôt portait, avec un réglage à 128 et un texte à 64."""
    assert _directions(client)["directions"] == []

    _vue(client, "vue-dessus-34")

    lue = _directions(client)
    assert [d["nom"] for d in lue["directions"]] == ["sud", "nord", "est", "ouest"]
    assert lue["origine"] == "vue"
    assert lue["vue_libelle"] == "De dessus, 3/4"


def test_un_jeu_vu_de_face_na_aucune_direction(client):
    """**Une réponse, pas un manque.** « Un jeu qui ne veut pas de directions ne
    les voit jamais » : le mot ne paraît alors nulle part — ni colonne dans la
    matrice, ni rien dans le texte qui part."""
    _vue(client, "vue-face-fixe")

    assert _directions(client)["directions"] == []


def test_chaque_vue_propose_autant_de_directions_quelle_demande_dimages(client):
    """La table des huit vues se tient d'elle-même : une vue qui demande quatre
    images propose quatre directions, et une qui n'en demande qu'une n'en propose
    aucune. Sans ça, une pose demanderait quatre images pour deux angles."""
    for vue in VUES:
        assert len(vue.directions) in (0, vue.images), vue.identifiant
        if vue.images > 1:
            assert len(vue.directions) == vue.images, vue.identifiant


# ── La liste est une proposition, pas une contrainte ─────────────────────────


def test_renommer_une_direction_lui_laisse_son_identifiant(client, tmp_path):
    """**Les images faites portent l'identifiant** : renommer « sud » ne doit pas
    leur faire perdre leur case. C'est la décision des poses, reprise telle
    quelle."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "repos", "sud")

    reponse = client.put(
        "/api/characters/directions/sud", json={"nom": "vers le joueur"}
    )
    assert reponse.status_code == 200, reponse.text

    lue = _directions(client)
    assert lue["origine"] == "ici"
    sud = next(d for d in lue["directions"] if d["identifiant"] == "sud")
    assert sud["nom"] == "vers le joueur"
    # La consigne n'était pas dans le message : ce qu'il ne dit pas, il ne
    # l'efface pas.
    assert sud["consigne"] == "facing south, toward the viewer"
    # Et l'image est toujours dans sa case.
    case = _cases(client, chose["identifiant"])["repos"]
    assert [d["identifiant"] for d in case["directions"] if d["images"]] == ["sud"]


def test_une_liste_touchee_cesse_de_suivre_la_vue_et_peut_y_revenir(client):
    """**Ce ne sont pas la même promesse.** Une liste lue suivra un changement de
    vue ; une liste écrite ne le suivra pas, sans quoi changer de vue effacerait
    en silence des noms choisis à la main. Et le retour existe : sans lui, il
    faudrait la retaper de mémoire."""
    _vue(client, "vue-dessus-34")
    client.delete("/api/characters/directions/nord")

    ecrite = _directions(client)
    assert ecrite["origine"] == "ici"
    assert [d["nom"] for d in ecrite["directions"]] == ["sud", "est", "ouest"]

    rendue = client.post("/api/characters/directions/reset")
    assert rendue.status_code == 200, rendue.text
    assert rendue.json()["origine"] == "vue"
    assert [d["nom"] for d in rendue.json()["directions"]] == [
        "sud",
        "nord",
        "est",
        "ouest",
    ]


def test_ajouter_une_direction_ne_coute_rien_et_necrit_aucun_personnage(
    client, double
):
    """**On range ce qu'on ne tient pas, on ne coche pas ce qu'on tient.** Une
    direction de plus fait paraître une case vide chez toute chose qui tient une
    pose, sans qu'un seul fichier de personnage soit écrit."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    avant = _chose(client, chose["identifiant"])

    reponse = client.post(
        "/api/characters/directions",
        json={"nom": "sud-est", "consigne": "facing south-east"},
    )
    assert reponse.status_code == 201, reponse.text

    # Rien n'a été écrit sur la chose : c'est **l'absence** de la direction dans
    # ce qu'elle range qui le dit, et c'est tout ce que le disque porte.
    apres = _chose(client, chose["identifiant"])
    assert apres["ecartees"] == avant["ecartees"]
    assert apres["directions_ecartees"] == avant["directions_ecartees"] == {}
    assert double.appels == 0
    # La case vide paraît quand même.
    assert len(_cases(client, chose["identifiant"])["repos"]["directions"]) == 5


# ── Une case est une pose dans une direction ─────────────────────────────────


def test_la_jauge_est_le_produit_des_deux(client):
    """**Jamais les deux facteurs séparés** : une pose demande *tant d'images
    dans tant de directions*, et lire « 4 × 4 » demanderait au lecteur de faire
    la multiplication qu'on cherche à lui épargner."""
    chose = _creer(client)
    client.put("/api/characters/poses/repos", json={"images": 2})
    assert _cases(client, chose["identifiant"])["repos"]["demandees"] == 2

    _vue(client, "vue-dessus-34")

    assert _cases(client, chose["identifiant"])["repos"]["demandees"] == 8


def test_le_produit_nomme_la_direction_qui_manque(client, tmp_path):
    """C'est très exactement ce qu'il ne savait pas dire avant E10 : il voyait
    quatre images de « marche » sans savoir laquelle regardait le nord."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "marche", "sud")
    _poser(client, tmp_path, chose["identifiant"], "marche", "est")

    case = _cases(client, chose["identifiant"])["marche"]

    vides = [d["nom"] for d in case["directions"] if not d["images"]]
    assert vides == ["nord", "ouest"]


def test_une_image_faite_avant_les_directions_est_a_confirmer(client, tmp_path):
    """**Un rangement par défaut ne se fait pas passer pour une déduction.** Le
    produit ne devine pas la direction d'une image faite avant : il la range dans
    la première, dit combien l'attendent, et un clic la déplace."""
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "repos")
    _poser(client, tmp_path, chose["identifiant"], "repos")

    _vue(client, "vue-dessus-34")

    case = _cases(client, chose["identifiant"])["repos"]
    premiere = case["directions"][0]
    assert premiere["nom"] == "sud"
    assert premiere["a_confirmer"] == 2
    assert len(premiere["images"]) == 2
    assert all(d["a_confirmer"] == 0 for d in case["directions"][1:])


def test_confirmer_une_image_est_le_meme_geste_que_la_deplacer(client, tmp_path):
    """Un seul geste — dire sous quel angle cette image montre sa pose. Deux
    gestes distincts auraient laissé « confirmer » et « déplacer » se
    contredire."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    posee = _poser(client, tmp_path, chose["identifiant"], "repos")
    assert posee["direction"] is None

    reponse = client.put(
        f"/api/assets/{posee['identifiant']}/character",
        json={
            "personnage": chose["identifiant"],
            "pose": "repos",
            "direction": "nord",
        },
    )
    assert reponse.status_code == 200, reponse.text

    case = _cases(client, chose["identifiant"])["repos"]
    assert [d["nom"] for d in case["directions"] if d["images"]] == ["nord"]
    assert all(d["a_confirmer"] == 0 for d in case["directions"])


def test_une_direction_retiree_ne_perd_aucune_image(client, tmp_path):
    """**Jamais de cascade, et l'orphelin se voit.** Les images gardent
    l'identifiant de leur direction : la remettre les remet dans leur case."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "repos", "nord")

    client.delete("/api/characters/directions/nord")

    case = _cases(client, chose["identifiant"])["repos"]
    assert len(case["sans_direction"]) == 1
    assert len(case["images"]) == 1

    client.post("/api/characters/directions/reset")
    case = _cases(client, chose["identifiant"])["repos"]
    assert case["sans_direction"] == []
    assert [d["nom"] for d in case["directions"] if d["images"]] == ["nord"]


# ── Les deux portées d'un rangement (US-244) ─────────────────────────────────


def test_une_direction_se_range_pour_tout_le_jeu(client):
    """**Une mort n'a qu'un angle, quel que soit le personnage**, et se le dire
    une fois vaut mieux que de le redire sur chacun."""
    _vue(client, "vue-dessus-34")
    un = _creer(client, "Balthazar")
    deux = _creer(client, "Le nain")

    reponse = client.put(
        "/api/characters/poses/mort/directions/nord", json={"rangee": True}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["portee"] == "jeu"

    for chose in (un, deux):
        case = _cases(client, chose["identifiant"])["mort"]
        assert [d["nom"] for d in case["directions"]] == ["sud", "est", "ouest"]
        assert [d["nom"] for d in case["directions_rangees"]] == ["nord"]
        assert case["directions_rangees"][0]["portee"] == "jeu"


def test_une_direction_se_range_pour_une_seule_chose(client):
    """**Le dragon n'attaque que vers le sud**, les autres continuent d'attaquer
    partout. C'est la portée étroite, et elle vit sur la chose."""
    _vue(client, "vue-dessus-34")
    dragon = _creer(client, "Le dragon")
    autre = _creer(client, "Balthazar")

    for direction in ("nord", "est", "ouest"):
        reponse = client.put(
            f"/api/characters/poses/attaque/directions/{direction}",
            json={"rangee": True, "personnage": dragon["identifiant"]},
        )
        assert reponse.status_code == 200, reponse.text
        assert reponse.json()["portee"] == "ici"

    case = _cases(client, dragon["identifiant"])["attaque"]
    assert [d["nom"] for d in case["directions"]] == ["sud"]
    assert case["demandees"] == 1
    assert all(d["portee"] == "ici" for d in case["directions_rangees"])
    # L'autre n'a rien perdu.
    assert len(_cases(client, autre["identifiant"])["attaque"]["directions"]) == 4


def test_la_portee_large_ecrit_la_ou_la_pose_est_declaree(client):
    """**La portée est rendue plutôt que promise.** Depuis E9 une pose vit soit
    dans le plan du jeu, soit dans la liste d'un type ; écrire ailleurs qu'à sa
    source ferait deux vérités sur la même question."""
    _vue(client, "vue-dessus-34")
    reponse = client.put(
        "/api/characters/poses/ferme/directions/nord", json={"rangee": True}
    )
    # « fermé » n'est déclarée nulle part tant qu'aucun type n'a écrit sa liste.
    assert reponse.status_code == 409, reponse.text

    client.put(
        "/api/characters/types/meuble/poses",
        json={"poses": [{"identifiant": "ferme", "nom": "fermé"}]},
    )
    reponse = client.put(
        "/api/characters/poses/ferme/directions/nord", json={"rangee": True}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["portee"] == "type meuble"


# ── La consigne se compose de deux textes anglais (US-240, US-241) ───────────


def test_ce_qui_part_est_en_anglais_du_premier_mot_au_dernier(client):
    """**Le nom se lit, la consigne part.** Jusqu'à E10 c'était le même texte, et
    le nom français d'une pose partait au milieu d'une phrase anglaise."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    client.put(
        f"/api/characters/{chose['identifiant']}",
        json={"description": "a dwarf miner with a braided beard"},
    )

    # **Lu sur le texte composé, pas sur le champ** — corrigé en écrivant E14.
    # Le champ ne porte plus que le signalement ; la consigne de l'attitude et
    # celle de l'angle sont une ligne à part, ajoutée par le composeur du
    # prompt. Ce qui se vérifie ici est donc ce qui part, ce qui est la bonne
    # question et la plus forte.
    champ = client.post(
        "/api/characters/subject", json={"personnage": chose["identifiant"]}
    ).json()["sujet"]
    reponse = client.post(
        "/api/prompt/preview",
        json={
            "prompt": champ,
            "personnage": chose["identifiant"],
            "pose": "marche",
            "direction": "sud",
        },
    )

    assert reponse.json()["texte"].endswith(
        "a dwarf miner with a braided beard, walking posture, full body, "
        "facing south, toward the viewer"
    )


def test_la_consigne_se_compose_de_deux_textes_ecrits_chacun_une_fois(client):
    """**On ne recopie plus `facing south` sur six poses.** Corriger la direction
    se fait une fois, et les six poses en bénéficient."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    client.put(
        "/api/characters/directions/sud", json={"consigne": "facing the camera"}
    )

    for pose in ("repos", "marche"):
        reponse = client.post(
            "/api/prompt/preview",
            json={
                "prompt": "",
                "personnage": chose["identifiant"],
                "pose": pose,
                "direction": "sud",
            },
        )
        assert reponse.json()["texte"].endswith("facing the camera")


def test_une_pose_ecrite_par_lauteur_part_telle_quelle(client):
    """**Le produit ne traduit pas à la place de l'auteur.** Inventer un texte
    qui partira dans un appel payé n'est pas une commodité, c'est une dépense
    décidée par quelqu'un d'autre. Sans consigne, c'est le nom qui part — comme
    avant E10 — et l'écran le dit."""
    chose = _creer(client)
    client.post("/api/characters/poses", json={"nom": "grimpe"})

    reponse = client.post(
        "/api/prompt/preview",
        json={"prompt": "", "personnage": chose["identifiant"], "pose": "grimpe"},
    )

    assert reponse.json()["texte"] == "grimpe"


def test_les_projets_davant_recoivent_langlais_sans_quun_fichier_soit_reecrit():
    """**La reprise, et elle est une lecture.** Un plan relu d'un fichier écrit
    avant E10 n'a pas de consigne : celle que le produit proposait lui est rendue
    à la composition, sans qu'une ligne soit réécrite."""
    ancienne = Pose("marche", "marche")
    assert ancienne.consigne == ""
    assert ancienne.dit() == "walking posture, full body"
    # Et les listes de départ la portent déjà, pour les projets neufs.
    assert {p.identifiant: p.consigne for p in PLAN_PAR_DEFAUT} == CONSIGNES


def test_une_direction_sans_consigne_ne_laisse_pas_de_virgule():
    """Une direction qu'on vient d'ajouter n'a rien à dire au modèle, et un
    prompt ne doit pas se terminer par une virgule."""
    assert composer("walking posture", "") == "walking posture"
    assert composer("", "facing south") == "facing south"
    assert composer("walking posture", "facing south") == (
        "walking posture, facing south"
    )


def test_le_lot_plie_envoie_lattitude_en_anglais(client, tmp_path):
    """La case d'une planche portait le **nom** de la pose. Elle porte sa
    consigne : un mot français au milieu d'une phrase anglaise se contredisait
    avec elle."""
    chose = _creer(client)
    reponse = client.post(
        "/api/prompt/preview",
        json={
            "prompt": "a dwarf",
            "personnage": chose["identifiant"],
            "poses": ["repos", "marche"],
        },
    )
    assert reponse.status_code == 200, reponse.text
    texte = reponse.json()["texte"]
    assert "idle stance, full body" in texte
    assert "walking posture, full body" in texte


# ── La proposition de baisse (US-243) ────────────────────────────────────────


def test_le_produit_propose_de_ramener_a_une_image_avec_sa_raison(client):
    """**Sans elle, déclarer quatre directions ferait passer un personnage de
    douze cases à quarante-huit d'un coup**, et l'auteur découvrirait trente-six
    manques qu'il n'a pas demandés."""
    client.put(
        "/api/universe",
        json={
            "bible": [
                {
                    "nom": "technique",
                    "texte": "strict 64x64 px tile snap, 4-directional orientation",
                    "actif": True,
                }
            ]
        },
    )
    for pose in ("repos", "marche"):
        client.put(f"/api/characters/poses/{pose}", json={"images": 4})
    _vue(client, "vue-dessus-34")

    proposee = client.get("/api/characters/directions/proposal").json()

    assert [p["pose"] for p in proposee["poses"]] == ["repos", "marche"]
    # **La raison cite la bible mot pour mot** : c'est la preuve que ces quatre
    # images-là *étaient* les quatre directions.
    assert "4-directional orientation" in proposee["raison"]
    assert proposee["cases_avant"] > proposee["cases_apres"]


def test_la_proposition_se_defait_dun_clic(client):
    """**Gardé sur le disque plutôt que dans l'écran** : une défaite qui
    disparaîtrait au rechargement laisserait le piège ouvert."""
    client.put("/api/characters/poses/repos", json={"images": 4})
    _vue(client, "vue-dessus-34")

    prise = client.post("/api/characters/directions/proposal")
    assert prise.status_code == 200, prise.text
    assert [d["images_avant"] for d in prise.json()["defaite"]] == [4]
    plan = {p["identifiant"]: p for p in client.get("/api/characters").json()["plan"]}
    assert plan["repos"]["images"] == 1

    rendue = client.delete("/api/characters/directions/proposal")
    assert rendue.status_code == 200, rendue.text
    plan = {p["identifiant"]: p for p in client.get("/api/characters").json()["plan"]}
    assert plan["repos"]["images"] == 4
    assert plan["repos"]["images_avant"] == 0


def test_toucher_le_chiffre_a_la_main_efface_la_defaite(client):
    """Ce que la pose demandait *avant* n'a plus de sens dès que l'auteur a dit
    ce qu'elle demande maintenant."""
    client.put("/api/characters/poses/repos", json={"images": 4})
    _vue(client, "vue-dessus-34")
    client.post("/api/characters/directions/proposal")

    client.put("/api/characters/poses/repos", json={"images": 2})

    plan = {p["identifiant"]: p for p in client.get("/api/characters").json()["plan"]}
    assert plan["repos"]["images"] == 2
    assert plan["repos"]["images_avant"] == 0


def test_la_proposition_ne_touche_que_les_poses_qui_comptent_les_angles(client):
    """**Un fait, pas une heuristique de plus** : une pose qui demande autant
    d'images qu'il y a de directions comptait les directions. Les autres ne sont
    pas touchées."""
    client.put("/api/characters/poses/repos", json={"images": 4})
    client.put("/api/characters/poses/marche", json={"images": 8})
    _vue(client, "vue-dessus-34")

    client.post("/api/characters/directions/proposal")

    plan = {p["identifiant"]: p for p in client.get("/api/characters").json()["plan"]}
    assert plan["repos"]["images"] == 1
    assert plan["marche"]["images"] == 8


# ── Ce que E10 ne fait pas ───────────────────────────────────────────────────


def test_declarer_des_directions_ne_coute_rien(client, double):
    """Vrai par construction, et mesuré quand même : rien ici ne touche le
    fournisseur."""
    _vue(client, "vue-dessus-34")
    chose = _creer(client)
    client.post("/api/characters/directions", json={"nom": "sud-est"})
    client.put("/api/characters/directions/sud", json={"nom": "vers le joueur"})
    client.put(
        "/api/characters/poses/mort/directions/nord",
        json={"rangee": True, "personnage": chose["identifiant"]},
    )
    client.post("/api/characters/directions/proposal")

    assert double.appels == 0


def test_la_bible_ne_porte_plus_le_nombre_de_directions(client):
    """**Retiré le 31 août 2026**, et E10 ne le remet pas : la phrase partait
    avec les six planches d'équipement du projet, où elle contredisait « ne
    change rien d'autre ». Chaque image dit désormais elle-même la direction
    qu'elle montre."""
    _vue(client, "vue-dessus-34")

    univers = client.get("/api/universe").json()["univers"]
    textes = " ".join(c["texte"] for c in univers["bible"])

    assert "directional" not in textes
    assert vue_connue("vue-dessus-34").directions == QUATRE
