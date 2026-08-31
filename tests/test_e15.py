# -*- coding: utf-8 -*-
"""Les critères de E15 qui vivent côté serveur — le codex généralisé.

**Ce qui se mesure ici** : que les cinq familles portent des entités de plein
droit, que la famille d'une chose se lise dans son type et nulle part ailleurs,
que ce qu'une famille ne peut pas avoir n'existe pas pour elle, qu'une pièce
d'équipement dise sur qui elle est posée plutôt que de montrer des images, et
qu'aucune chose d'avant ne perde quoi que ce soit. Ce que l'écran montre — les
comptes de la colonne, l'absence de colonne d'équipement chez un décor — vit
dans `interface/src/App.test.tsx`.

**Le travail de modèle le plus lourd de la V2.1, et il n'ajoute aucun objet.**
Une chose du jeu portait déjà son type depuis E9, et un type porte déjà sa
famille depuis T4 : la généralisation est donc une **lecture**, pas une
migration. C'est ce qui rend vraie sans effort la promesse « aucun personnage
existant ne perd quoi que ce soit » — pas un fichier n'a eu à être réécrit.
"""

from __future__ import annotations

import itertools

from tests.conftest import image_sujet


def _creer(client, nom: str, **corps) -> dict:
    reponse = client.post("/api/characters", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _choses(client) -> dict[str, dict]:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    return {p["identifiant"]: p for p in reponse.json()["personnages"]}


_DISTINCTES = itertools.count(3)


def _importer(client, tmp_path, nom: str) -> dict:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{nom}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    return client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]


# ── Les cinq familles portent des entités de plein droit ─────────────────────


def test_nommer_dans_une_famille_y_range_la_chose(client):
    """**Nommer, c'est créer — et dans la famille où l'on nomme.** « Un tonneau
    cerclé de fer » tapé sous *Objets* y reste : c'est le type qui porte la
    famille, et le produit pose donc le premier type de cette famille-là."""
    attendus = {
        "personnages": "personnages",
        "objets": "objets",
        "decors": "decors",
        "interface": "interface",
    }
    for famille, attendue in attendus.items():
        chose = _creer(client, f"chose {famille}", famille=famille)
        assert chose["famille"] == attendue, famille


def test_le_type_pose_est_visible_et_changeable(client):
    """**Jamais un état caché.** Le type que le produit pose est écrit sur la
    chose, et l'établi le montre dans un menu : une décision du produit qui ne se
    verrait pas serait une décision prise à la place de l'auteur."""
    tonneau = _creer(client, "un tonneau cerclé de fer", famille="objets")
    assert tonneau["type"] == "meuble"

    reponse = client.put(
        f"/api/characters/{tonneau['identifiant']}", json={"type": "objet posé"}
    )
    assert reponse.status_code == 200, reponse.text
    # La famille suit le type, parce qu'elle **est** lue dedans.
    assert reponse.json()["personnage"]["famille"] == "objets"


def test_la_famille_se_lit_dans_le_type_et_nulle_part_ailleurs(client):
    """**Une chose est définie à un seul endroit.** Changer le type d'une chose
    la fait changer de famille du même geste ; une famille gardée sur la chose
    aurait fini par ranger un meuble dans les décors."""
    chose = _creer(client, "quelque chose")
    assert chose["famille"] == "personnages"

    rendu = client.put(
        f"/api/characters/{chose['identifiant']}", json={"type": "décor"}
    ).json()["personnage"]

    assert rendu["famille"] == "decors"


def test_un_type_inconnu_est_refuse_a_la_creation(client):
    """Un nom d'échelle inconnu n'est pas corrigé en silence : la chose serait
    rangée dans les personnages sans que rien ne le dise."""
    reponse = client.post(
        "/api/characters", json={"nom": "chose", "type": "n'importe quoi"}
    )
    assert reponse.status_code == 409, reponse.text
    assert "types sont" in reponse.text


# ── Ce qu'une famille ne peut pas avoir n'existe pas pour elle ───────────────


def test_un_decor_ne_porte_pas_dequipement(client):
    """**Une pièce se pose sur un corps, jamais sur rien** — c'est déjà le refus
    de C3. E15 en tire la conséquence : l'établi d'un décor ne dessine aucune
    colonne d'équipement, et ce n'est pas un grisé."""
    decor = _creer(client, "les cavernes du nord", famille="decors")
    bouton = _creer(client, "un bouton", famille="interface")
    nain = _creer(client, "Balthazar")

    lues = _choses(client)
    assert lues[decor["identifiant"]]["equipable"] is False
    assert lues[bouton["identifiant"]]["equipable"] is False
    assert lues[nain["identifiant"]]["equipable"] is True


def test_un_decor_na_aucune_pose_et_ce_nest_pas_un_manque(client):
    """C'est la décision d'E9, et elle vaut telle quelle pour une entité de plein
    droit : un décor ne bouge pas, il se raccorde. Une seule image le remplit."""
    decor = _creer(client, "une salle du trône", famille="decors")

    lue = _choses(client)[decor["identifiant"]]

    assert lue["plan"] == []
    assert lue["cases"] == []


def test_un_objet_recoit_les_poses_de_son_type(client):
    """**Tout ce qui marchait pour un personnage marche pour les autres.** Un
    meuble a ses trois états, et il les tient de son type comme un personnage
    tient les siens."""
    coffre = _creer(client, "un coffre", famille="objets")

    lue = _choses(client)[coffre["identifiant"]]

    assert [p["identifiant"] for p in lue["plan"]] == ["ferme", "ouvert", "vide"]
    assert [c["pose"] for c in lue["cases"]] == ["ferme", "ouvert", "vide"]


# ── L'établi d'une pièce montre qui la porte (US-284) ────────────────────────


def test_une_piece_dit_sur_qui_elle_est_posee(client, atelier, tmp_path):
    """**Une pièce n'a pas d'image à elle**, et son établi ne fait pas semblant
    d'en avoir : il montre les choses qui la portent, et ce qui manque se lit
    comme partout ailleurs."""
    nain = _creer(client, "Balthazar")
    _creer(client, "michel le nain")
    _creer(client, "les cavernes du nord", famille="decors")
    client.post("/api/characters/pieces", json={"nom": "casque", "emplacement": "tête"})

    portee = client.get("/api/characters/pieces/casque/wearers").json()

    # **Le décor n'est pas un candidat** : il ne peut pas porter de casque, et
    # le compter ferait dire « posée sur 0 sur 3 » d'un jeu qui n'a que deux
    # corps possibles.
    assert portee["candidats"] == 2
    assert portee["posee"] == 0
    assert {p["nom"] for p in portee["portee"]} == {"Balthazar", "michel le nain"}
    assert all(p["poses"] == [] for p in portee["portee"])

    # **Une image qui porte la pièce et la pose la fait apparaître**, sans qu'on
    # ait rien enregistré de plus : c'est l'image qui dit sa case et sa pièce,
    # exactement comme une case pleine. Un calque naît du dépliage d'une planche
    # d'équipement ; ici on pose les deux champs à la main, parce que ce qu'on
    # mesure est la **lecture**, pas la façon dont le calque est né.
    asset = _importer(client, tmp_path, "casque-repos")
    objet = atelier.assets.lire(asset["identifiant"])
    objet.personnage = nain["identifiant"]
    objet.pose = "repos"
    objet.piece = "casque"
    atelier.assets.sauver(objet)

    portee = client.get("/api/characters/pieces/casque/wearers").json()

    assert portee["posee"] == 1
    porte = next(p for p in portee["portee"] if p["personnage"] == nain["identifiant"])
    assert porte["poses"] == ["repos"]


def test_une_piece_inconnue_est_refusee_avec_sa_raison(client):
    reponse = client.get("/api/characters/pieces/n-existe-pas/wearers")
    assert reponse.status_code == 409, reponse.text
    assert "aucune pièce" in reponse.text


# ── Aucune chose d'avant ne perd quoi que ce soit ────────────────────────────


def test_une_chose_sans_type_reste_un_personnage_entier(client):
    """**La généralisation est une lecture, pas une migration.** Une chose
    d'avant E9 n'a pas de type ; elle reste dans les personnages, garde le plan
    du jeu, et porte toujours de l'équipement."""
    ancien = _creer(client, "Balthazar")
    assert ancien["type"] == ""

    lue = _choses(client)[ancien["identifiant"]]

    assert lue["famille"] == "personnages"
    assert lue["equipable"] is True
    assert [p["identifiant"] for p in lue["plan"]] == [
        "repos",
        "marche",
        "course",
        "attaque",
        "degats",
        "mort",
    ]


def test_la_generalisation_necrit_aucun_fichier_de_personnage(client):
    """Le type porte déjà la famille depuis T4 : il n'y avait rien à migrer, et
    c'est ce qui rend la promesse vraie sans effort."""
    chose = _creer(client, "Balthazar")
    avant = client.get("/api/characters").json()["personnages"][0]

    # Lire la famille de tout le monde, plusieurs fois : c'est un calcul.
    for _ in range(3):
        _choses(client)

    apres = client.get("/api/characters").json()["personnages"][0]
    assert apres["cree_le"] == avant["cree_le"]
    assert apres["identifiant"] == chose["identifiant"]


def test_les_cinq_familles_ne_coutent_rien(client, double):
    """Ni la lecture d'une famille, ni la portée d'une pièce ne touchent le
    fournisseur — c'est du rangement, et le rangement est gratuit."""
    for famille in ("personnages", "objets", "decors", "interface"):
        _creer(client, f"chose {famille}", famille=famille)
    client.post("/api/characters/pieces", json={"nom": "casque"})
    client.get("/api/characters/pieces/casque/wearers")
    _choses(client)

    assert double.appels == 0
