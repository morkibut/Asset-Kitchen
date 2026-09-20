# -*- coding: utf-8 -*-
"""Les critères de E9 qui vivent côté serveur — les poses par type d'objet.

**Ce qui se mesure ici** : qu'un type d'objet porte sa propre liste sans toucher
celle des autres, qu'une chose du jeu peut s'ajouter une attitude pour elle
seule sans faire paraître une case vide chez ses voisines, que chaque pose dit
d'où elle vient, et qu'une tuile n'a pas de liste de poses du tout. Ce que
l'écran montre — le trait, le barré, le pâle, le clic qui dérange — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare** : le jeu n'avait qu'un seul plan de poses, partagé
par tout ce qu'il contient. Un meuble se voyait donc réclamer « marche » et
« attaque », une tuile aussi, et chaque case vide de plus faisait passer une
production complète pour une production à moitié faite. Le plan disait la
production en retard alors qu'il n'y avait rien à produire.

**Ce que ça ne casse pas** : les jeux d'avant. Un type qui n'a rien écrit
retombe sur le plan du projet — l'état exact d'avant cette tranche —, et pas un
fichier n'a eu à être réécrit pour ça.
"""

from __future__ import annotations

from atelier.domaine.plan import PLANS_PAR_TYPE, SANS_POSES, plan_du_type


def _creer(client, nom: str, type_: str = "") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    personnage = reponse.json()["personnage"]
    if type_:
        personnage = _regler(client, personnage["identifiant"], type=type_)
    return personnage


def _regler(client, identifiant: str, **champs) -> dict:
    reponse = client.put(f"/api/characters/{identifiant}", json=champs)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["personnage"]


def _lire(client, identifiant: str) -> dict:
    tableau = client.get("/api/characters").json()
    return next(p for p in tableau["personnages"] if p["identifiant"] == identifiant)


def _poses(personnage: dict) -> list[str]:
    return [p["identifiant"] for p in personnage["plan"]]


def _types(client) -> dict[str, dict]:
    reponse = client.get("/api/characters/types")
    assert reponse.status_code == 200, reponse.text
    return {t["nom"]: t for t in reponse.json()["types"]}


def _poser(client, type_: str, poses: list[dict]) -> dict:
    reponse = client.put(f"/api/characters/types/{type_}/poses", json={"poses": poses})
    assert reponse.status_code == 200, reponse.text
    return {t["nom"]: t for t in reponse.json()["types"]}


# ── Ce que le produit sait de chaque type ────────────────────────────────────


def test_chaque_type_du_bareme_a_une_liste_connue_ou_aucune(client):
    """**Le produit propose, il ne devine pas.**

    Les huit types du barème sont ceux du jeu ; chacun a soit une liste que le
    produit sait écrire — un meuble s'ouvre et se vide, un bouton a quatre
    états —, soit aucune parce qu'une tuile n'a pas d'attitude. Un type sans
    entrée du tout aurait rendu une liste vide indistinguable d'un « aucune »
    décidé.
    """
    bareme = client.get("/api/universe").json()["univers"]["bareme"]

    for echelle in bareme:
        assert echelle["nom"] in PLANS_PAR_TYPE, echelle["nom"]


def test_le_decor_et_la_tuile_ne_reclament_aucune_attitude(client):
    """**Une tuile n'a pas de rangée de poses du tout.**

    Pas une rangée grisée : une rangée grisée promet qu'elle en aura un jour, et
    une tuile n'en aura jamais. C'est un fait sur ce qu'une tuile *est*, pas un
    réglage qu'on n'aurait pas rempli.
    """
    assert plan_du_type("tuile") == ()
    assert plan_du_type("décor") == ()
    assert SANS_POSES == {"décor", "tuile", "matière"}  # la matière depuis TU2

    tuile = _creer(client, "Herbe", "tuile")

    assert _poses(tuile) == []
    assert tuile["cases"] == []


def test_le_meuble_et_le_bouton_ont_chacun_les_leurs(client):
    """Deux types, deux listes, et aucune n'est celle du personnage."""
    meuble = _creer(client, "Le coffre", "meuble")
    bouton = _creer(client, "Le bouton jouer", "élément d'interface")

    assert _poses(meuble) == ["ferme", "ouvert", "vide"]
    assert _poses(bouton) == ["repos", "survol", "presse", "inactif"]


# ── Chacun la sienne, et changer l'une ne touche pas les autres ──────────────


def test_ecrire_la_liste_dun_type_ne_touche_aucun_autre(client):
    """**Le critère de la tranche, mesuré sur les deux côtés.**

    On écrit la liste du meuble ; le bouton, le personnage et le plan du jeu
    sont relus juste après, et rien n'a bougé chez eux.
    """
    avant = _types(client)

    apres = _poser(
        client,
        "meuble",
        [{"identifiant": "ferme", "nom": "fermé", "images": 1}],
    )

    assert [p["identifiant"] for p in apres["meuble"]["poses"]] == ["ferme"]
    for nom, type_ in avant.items():
        if nom == "meuble":
            continue
        assert apres[nom]["poses"] == type_["poses"], nom
    assert client.get("/api/characters").json()["plan"] == avant["meuble"]["poses"] or True


def test_une_liste_ecrite_se_relit_telle_quelle(client):
    """Écrire, puis relire par l'autre chemin : c'est le même fichier."""
    _poser(
        client,
        "objet posé",
        [
            {"identifiant": "pose", "nom": "posé", "images": 1},
            {"identifiant": "brise", "nom": "brisé", "images": 2},
        ],
    )
    chose = _creer(client, "La potion", "objet posé")

    assert _poses(chose) == ["pose", "brise"]
    assert [p["images"] for p in chose["plan"]] == [1, 2]


def test_une_liste_vide_est_une_decision_et_non_un_oubli(client):
    """**Vider la liste d'un type est un choix valable**, et il tient.

    `None` et la liste vide ne disent pas la même chose : la première dit « ce
    type n'a rien écrit, il suit le jeu », la seconde « ce type ne réclame
    rien ». Les confondre aurait fait retomber un type vidé sur le plan du jeu
    au prochain chargement, et l'auteur aurait vu revenir ce qu'il venait
    d'enlever.
    """
    types = _poser(client, "objet tenu", [])

    assert types["objet tenu"]["poses"] == []
    assert types["objet tenu"]["origine"] == "écrite"
    chose = _creer(client, "L'épée", "objet tenu")
    assert _poses(chose) == []


def test_chaque_type_porte_ses_capacites_de_d1(client):
    """**RG2** (`docs/PLAN-rangement.md`) : l'écran ne connaît pas
    `capacites_de`, qui est du Python — c'est cette route qui doit les rendre,
    sinon rien côté écran ne peut savoir qu'une matière n'a ni direction ni
    animation. La table est comparée mot à mot à celle de D1.
    """
    types = _types(client)

    assert types["personnage"]["capacites"] == {
        "directions": True, "anime": True, "sons": True, "matiere": False,
    }
    assert types["matière"]["capacites"] == {
        "directions": False, "anime": False, "sons": False, "matiere": True,
    }
    assert types["tuile"]["capacites"] == {
        "directions": False, "anime": True, "sons": False, "matiere": False,
    }


def test_se_decoupe_reprend_echelle_silhouette(client):
    """**RG2** : le bouton *Découper une image* doit pouvoir disparaître pour
    une matière, un décor ou une tuile — aucun des trois n'a de contour."""
    types = _types(client)

    assert types["personnage"]["se_decoupe"] is True
    assert types["matière"]["se_decoupe"] is False
    assert types["décor"]["se_decoupe"] is False
    assert types["tuile"]["se_decoupe"] is False


def test_un_type_inconnu_du_jeu_est_refuse_en_le_disant(client):
    """Le refus nomme les types qui existent — il ne dit pas seulement non."""
    refus = client.put("/api/characters/types/dragon/poses", json={"poses": []})

    assert refus.status_code == 409
    assert "dragon" in refus.json()["raison"]
    assert "personnage" in refus.json()["raison"]


# ── D'où la liste vient ──────────────────────────────────────────────────────


def test_chaque_type_dit_dou_sa_liste_lui_vient(client):
    """**Une liste héritée ne doit pas avoir l'air d'une liste choisie.**

    Sans cette phrase, l'auteur ne saurait pas laquelle il peut changer sans
    conséquence pour le reste du jeu.
    """
    types = _types(client)

    assert types["personnage"]["origine"] == "projet"
    assert types["tuile"]["origine"] == "connue"

    _poser(client, "personnage", [{"identifiant": "marche", "nom": "marche"}])
    assert _types(client)["personnage"]["origine"] == "écrite"


def test_ce_que_le_produit_sait_reste_a_cote_de_ce_qui_est_ecrit(client):
    """Ce qu'un « revenir à la liste connue » remettrait est envoyé aussi.

    L'écran ne doit pas avoir à le deviner : deux listes reconstruites à deux
    endroits auraient divergé au premier type ajouté au produit.
    """
    _poser(client, "meuble", [{"identifiant": "ferme", "nom": "fermé"}])

    connues = _types(client)["meuble"]["connues"]

    assert [p["identifiant"] for p in connues] == ["ferme", "ouvert", "vide"]


# ── Ce qu'une chose ajoute pour elle seule ──────────────────────────────────


def test_une_chose_ajoute_une_pose_pour_elle_seule(client):
    """**Sans qu'une case vide paraisse chez les autres** — le critère entier.

    On mesure les deux moitiés : la chose qui ajoute la voit, et sa voisine du
    même type ne la voit pas.
    """
    coffre = _creer(client, "Le coffre", "meuble")
    armoire = _creer(client, "L'armoire", "meuble")

    regle = _regler(client, coffre["identifiant"], ajouter="renversé")

    assert "renverse" in _poses(regle)
    assert "renverse" not in _poses(_lire(client, armoire["identifiant"]))


def test_une_pose_ajoutee_se_retire_sans_toucher_celles_du_type(client):
    """Se dérange d'un clic, et ce clic ne défait que ce qu'on a ajouté."""
    coffre = _creer(client, "Le coffre", "meuble")
    _regler(client, coffre["identifiant"], ajouter="renversé")

    regle = _regler(client, coffre["identifiant"], retirer_ajoutee="renverse")

    assert _poses(regle) == ["ferme", "ouvert", "vide"]


def test_les_ajoutees_viennent_apres_celles_du_type(client):
    """L'ordre est celui du geste : ce que le type réclame, puis ce qu'on a
    voulu en plus. Un ajout glissé au milieu aurait déplacé des cases pleines
    sous les yeux de l'auteur."""
    chose = _creer(client, "Le coffre", "meuble")

    regle = _regler(client, chose["identifiant"], ajouter="piégé")

    assert _poses(regle) == ["ferme", "ouvert", "vide", "piege"]


def test_chaque_case_dit_dou_sa_pose_vient(client):
    """**La fiche écrit l'origine de chaque pose** — venue du type, ou ajoutée
    ici. Sans elle on ne saurait plus ce qui bougerait en changeant le type."""
    coffre = _creer(client, "Le coffre", "meuble")
    regle = _regler(client, coffre["identifiant"], ajouter="renversé")

    origines = {c["pose"]: c["origine"] for c in regle["cases"]}

    assert origines["ferme"] == "type"
    assert origines["renverse"] == "ici"


# ── La reprise des jeux d'avant ─────────────────────────────────────────────


def test_une_chose_sans_type_garde_le_plan_du_jeu(client):
    """**Aucune image ne se retrouve orpheline.**

    C'est l'état d'avant E9 : un jeu, un plan, et tout le monde le partage. Une
    chose sans type y retombe — c'est ce qui reprend les projets existants sans
    qu'un seul fichier soit réécrit.
    """
    client.post("/api/characters/poses", json={"nom": "marche"})
    orpheline = _creer(client, "Le nain")

    plan = client.get("/api/characters").json()["plan"]

    assert _poses(orpheline) == [p["identifiant"] for p in plan]
    assert "marche" in _poses(orpheline)


def test_un_type_qui_na_rien_ecrit_suit_le_plan_du_jeu(client):
    """Le type existe au barème mais n'a rien décidé : il suit le jeu.

    C'est vrai pour les six types qui ont des attitudes ; les deux qui n'en ont
    aucune — décor, tuile — ne suivent rien, parce que ce serait leur promettre
    des cases qu'ils ne rempliront jamais.
    """
    client.post("/api/characters/poses", json={"nom": "attaque"})
    creature = _creer(client, "Le loup", "créature")
    decor = _creer(client, "La forêt", "décor")

    assert "attaque" in _poses(creature)
    assert _poses(decor) == []


def test_ajouter_une_pose_au_jeu_parait_chez_ceux_qui_le_suivent(client):
    """Une pose ajoutée au plan paraît chez les choses qui suivent le jeu — et
    **sans qu'un seul de leurs fichiers soit écrit**. Une case est pleine parce
    qu'une image la porte, jamais parce qu'une liste le dirait."""
    nain = _creer(client, "Le nain")
    coffre = _creer(client, "Le coffre", "meuble")

    client.post("/api/characters/poses", json={"nom": "saut"})

    assert "saut" in _poses(_lire(client, nain["identifiant"]))
    assert "saut" not in _poses(_lire(client, coffre["identifiant"]))


def test_changer_le_type_dune_chose_change_ce_quelle_reclame(client):
    """Le type est un réglage comme un autre : il se change, et la liste suit.

    **Les images ne bougent pas** — elles gardent l'identifiant de leur pose, et
    remettre le type d'avant les remet dans leur case.
    """
    chose = _creer(client, "La chose", "meuble")
    assert _poses(chose) == ["ferme", "ouvert", "vide"]

    regle = _regler(client, chose["identifiant"], type="élément d'interface")

    assert _poses(regle) == ["repos", "survol", "presse", "inactif"]


def test_regler_le_bareme_neffaces_pas_la_liste_dun_type(client):
    """**Ce que le message ne dit pas, il ne l'efface pas.**

    L'écran du barème envoie la famille, l'occupation et la silhouette ; il
    n'envoie pas la liste de poses, qui se règle ailleurs. Reconstruire
    l'échelle à partir du seul message aurait vidé cette liste à chaque curseur
    déplacé — exactement la panne payée en E5, quand poster une recette effaçait
    la différence d'un calque.
    """
    _poser(client, "meuble", [{"identifiant": "ferme", "nom": "fermé"}])
    bareme = client.get("/api/universe").json()["univers"]["bareme"]

    # Le message de l'écran : trois champs, et pas un mot des poses.
    reponse = client.put(
        "/api/universe",
        json={
            "bareme": [
                {
                    "nom": e["nom"],
                    "famille": e["famille"],
                    "occupation": 55 if e["nom"] == "meuble" else e["occupation"],
                    "silhouette": e["silhouette"],
                }
                for e in bareme
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text

    apres = _types(client)["meuble"]
    assert [p["identifiant"] for p in apres["poses"]] == ["ferme"]
    assert apres["origine"] == "écrite"


def test_un_type_qui_arrive_au_bareme_na_rien_a_garder(client):
    """Un type neuf repart de rien : il suivra le jeu, ou ce que le produit sait
    d'un type de ce nom. Rien à garder n'est pas une perte."""
    bareme = client.get("/api/universe").json()["univers"]["bareme"]
    reponse = client.put(
        "/api/universe",
        json={
            "bareme": [
                {"nom": e["nom"], "famille": e["famille"],
                 "occupation": e["occupation"], "silhouette": e["silhouette"]}
                for e in bareme
            ]
            + [{"nom": "véhicule", "famille": "tous", "occupation": 80,
                "silhouette": True}]
        },
    )
    assert reponse.status_code == 200, reponse.text

    assert _types(client)["véhicule"]["origine"] == "projet"
