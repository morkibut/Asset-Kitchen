# -*- coding: utf-8 -*-
"""B19 — le vestiaire : la relation qui manquait entre une pièce et un porteur.

**Planches** : `docs/pistes-2026-09-04/carnet/Emplois.dc.html`, `Emploi.dc.html`,
`Main.dc.html`. Bloquée par `B10`, tenue ; elle débloque `B20`.

Avant cette tranche, une pièce d'équipement n'appartenait à personne : elle était
décrite une fois pour le jeu et se posait sur n'importe quel corps — « rien
n'empêche donc de proposer le casque de fer sur la grenouille ». Ce fichier
mesure le lien qui manquait, et **surtout ce qu'il ne casse pas**.

Ce qui se mesure ici, dans l'ordre des critères d'acceptation :

1. **Les pièces déjà écrites sur le disque se relisent sans perte et sans
   porteur** — et c'est le critère le plus important de la tranche. Il se
   mesure sur trois plans distincts, parce que la perte pouvait venir de trois
   endroits : la lecture du fichier, l'écriture qui suit (une clé de plus
   suffirait à faire mentir « sans perte »), et le **service**, qui reconstruit
   une pièce champ par champ à chaque réglage.
2. **Une pièce ne porte personne par défaut**, et `None` ne se confond jamais
   avec `()` : *jamais déclaré* n'est pas *déclaré vide*. C'est la distinction
   que `plan_depuis_json` tient déjà pour les poses, reprise au mot.
3. **Une pièce créée depuis la fiche d'un personnage lui est attribuée
   d'emblée**, en un seul aller-retour.
4. **Les emplacements de corps restent au jeu, jamais au personnage** — déjà
   vrai par construction, mesuré quand même : c'en est un.
5. **Un calque reste solidaire de sa pose** — l'invariant de `C3`. Retirer un
   porteur ne touche pas une image, et un emploi retiré ne revient pas tout
   seul à la relecture suivante alors que ses calques, eux, sont toujours là.

**Aucune planche n'est payée ici.** Les calques sont posés à la main — trois
champs sur un asset importé, comme `tests/test_e15.py` le fait déjà pour la même
raison : ce qui se mesure est la **lecture** d'un couple *(pièce, personnage)*,
pas la façon dont le calque est né. `tests/test_c3.py` couvre l'autre moitié.
"""

from __future__ import annotations

import itertools
import json

from atelier.domaine.equipement import (
    A_PART,
    PORTE,
    Emploi,
    Piece,
    emploi_porte,
    emplois_resolus,
)
from atelier.domaine.projet import Projet
from tests.conftest import image_sujet


_DISTINCTES = itertools.count(3)


# ── Le décor : des sujets, des pièces, et des calques posés à la main ────────


def _creer(client, nom: str, **corps) -> dict:
    reponse = client.post("/api/characters", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _piece(client, nom: str, **corps) -> dict:
    reponse = client.post("/api/characters/pieces", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["piece"]


def _emplois(client) -> dict[str, dict]:
    """Le vestiaire résolu du jeu, rangé par identifiant de pièce."""
    reponse = client.get("/api/characters/pieces/uses")
    assert reponse.status_code == 200, reponse.text
    return {p["piece"]["identifiant"]: p for p in reponse.json()["pieces"]}


def _choses(client) -> dict[str, dict]:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    return {p["identifiant"]: p for p in reponse.json()["personnages"]}


def _poser_un_calque(
    client, atelier, tmp_path, *, personnage: str, piece: str, pose: str = "repos"
) -> str:
    """Un calque tel que le dépliage d'une planche d'équipement l'aurait laissé.

    Les trois champs sont posés à la main — c'est le geste de `test_e15.py`, et
    pour la même raison : ce qu'on mesure est ce que la **lecture** en fait.
    """
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{personnage}-{piece}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    objet = atelier.assets.lire(asset["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    atelier.assets.sauver(objet)
    return objet.identifiant


# ── 1. Les pièces déjà écrites sur le disque, sans perte et sans porteur ─────
#
# Le critère le plus important de la tranche, et il se mesure sur trois plans :
# la lecture, la réécriture, et le service qui reconstruit.


def test_une_piece_d_avant_b19_se_relit_sans_porteur_et_sans_rien_perdre():
    """Le premier plan : **la lecture**.

    Les octets sont ceux de `donnees/projets/test-v2/projet.json`, relevés le
    9 septembre 2026 sur le disque de l'auteur — pas une fixture inventée.
    """
    sur_le_disque = {
        "identifiant": "epee",
        "nom": "Epée",
        "description": "A classic one hand sword",
        "emplacement": "les-mains",
        "portee": "contenue",
        "concept_arts": [],
    }

    piece = Piece.depuis_json(sur_le_disque)

    # **Sans porteur** : la pièce n'en déclare aucun, et le modèle n'en invente
    # pas — ce que le disque porte malgré tout se lit sur les calques, par le
    # service, et jamais ici.
    assert piece.porteurs == ()
    # **Et sans déclaration** : `None`, pas `()`. C'est toute la distinction.
    assert piece.emplois is None
    assert piece.declaree is False
    # **Sans perte** : les cinq autres champs sont intacts.
    assert piece.nom == "Epée"
    assert piece.description == "A classic one hand sword"
    assert piece.emplacement == "les-mains"
    assert piece.portee == "contenue"
    assert piece.concept_arts == ()


def test_une_piece_d_avant_b19_relue_puis_reecrite_rend_les_memes_octets():
    """Le deuxième plan : **la réécriture**.

    « Sans perte » n'est pas seulement « rien ne disparaît » : c'est aussi
    « rien n'apparaît ». Une clé `emplois: null` ajoutée à chaque sauvegarde ne
    perdrait rien et salirait pourtant tous les fichiers du disque au premier
    geste sans rapport — renommer une pose, par exemple. `en_json` omet donc la
    clé tant que rien n'est déclaré.
    """
    sur_le_disque = {
        "identifiant": "helmet",
        "nom": "helmet",
        "description": "a dwarf iron helmet",
        "emplacement": "head",
        "portee": "agrandit",
        "concept_arts": [],
    }

    reecrite = Piece.depuis_json(sur_le_disque).en_json()

    assert reecrite == sur_le_disque
    assert "emplois" not in reecrite


def test_un_projet_entier_d_avant_b19_fait_l_aller_retour_sans_bouger(tmp_path):
    """Le même, sur le fichier entier plutôt que sur une pièce isolée — parce
    que c'est ce fichier-là qui est réécrit, pas la pièce toute seule."""
    sur_le_disque = {
        "identifiant": "test-v2",
        "nom": "Le Marais du Vieux Moulin",
        "emplacements": [
            {"identifiant": "le-dos", "nom": "le dos", "rang": 0},
            {"identifiant": "les-mains", "nom": "les mains", "rang": 4},
        ],
        "pieces": [
            {
                "identifiant": "sac-de-voyage",
                "nom": "Sac de voyage",
                "description": "un sac de voyage complet",
                "emplacement": "le-dos",
                "portee": "contenue",
                "concept_arts": [],
            },
            {
                "identifiant": "epee",
                "nom": "Epée",
                "description": "A classic one hand sword",
                "emplacement": "les-mains",
                "portee": "contenue",
                "concept_arts": [],
            },
        ],
    }

    relu = Projet.depuis_json(json.loads(json.dumps(sur_le_disque))).en_json()

    assert relu["emplacements"] == sur_le_disque["emplacements"]
    assert relu["pieces"] == sur_le_disque["pieces"]


def test_renommer_une_piece_ne_perd_pas_ses_emplois(client):
    """Le troisième plan, et **c'est celui qu'on ne voit pas venir** : le
    service.

    `regler_piece` reconstruit une `Piece(...)` champ par champ au lieu de la
    modifier. Un champ neuf oublié là n'est pas perdu à la lecture du disque —
    il est perdu au **premier renommage**, et aucune relecture ne l'annonce.
    """
    goliath = _creer(client, "Le goliath")
    minus = _creer(client, "Le minus")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    client.post(
        f"/api/characters/pieces/{epee['identifiant']}/uses",
        json={"genre": PORTE, "porteur": minus["identifiant"]},
    )

    reponse = client.put(
        f"/api/characters/pieces/{epee['identifiant']}",
        json={"nom": "Épée longue", "description": "plus longue"},
    )
    assert reponse.status_code == 200, reponse.text

    apres = _emplois(client)[epee["identifiant"]]
    assert apres["piece"]["nom"] == "Épée longue"
    assert [e["porteur"] for e in apres["emplois"]] == [
        goliath["identifiant"],
        minus["identifiant"],
    ]


def test_les_calques_deja_sur_le_disque_donnent_leurs_porteurs(
    client, atelier, tmp_path
):
    """**Une pièce jamais déclarée n'est pas une pièce que personne ne porte.**

    C'est le cas de toutes celles d'avant la tranche, et le disque de l'auteur
    en portait quatre au 9 septembre, dont un casque posé sur **deux**
    personnages. Rendre une liste vide aurait fait disparaître de l'écran dix
    images bien vivantes ; le service les lit sur les calques, sans rien écrire.
    """
    balthazar = _creer(client, "Balthazar")
    michel = _creer(client, "michel le nain")
    _creer(client, "les cavernes du nord", famille="decors")
    casque = _piece(client, "helmet", emplacement="head")
    # Le fichier est celui d'avant la tranche : on retire la déclaration que la
    # création vient de poser, exactement comme le disque l'a.
    projet = atelier.base.lire_projet(atelier.bibliotheque.courant)
    projet.pieces = tuple(
        Piece.depuis_json(
            {k: v for k, v in p.en_json().items() if k != "emplois"}
        )
        for p in projet.pieces
    )
    atelier.bibliotheque.sauver_projet(projet)
    assert all(p.emplois is None for p in projet.pieces)

    _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=balthazar["identifiant"],
        piece=casque["identifiant"],
    )
    _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=michel["identifiant"],
        piece=casque["identifiant"],
    )

    lu = _emplois(client)[casque["identifiant"]]

    assert lu["declare"] is False
    assert [e["porteur"] for e in lu["emplois"]] == [
        balthazar["identifiant"],
        michel["identifiant"],
    ]
    # **Déduit se dit** : un emploi lu sur les images disparaît si les images
    # disparaissent, quand un emploi déclaré reste. L'écran doit pouvoir le dire.
    assert all(e["deduit"] is True for e in lu["emplois"])
    assert all(e["genre"] == PORTE for e in lu["emplois"])
    # Et rien n'a été écrit derrière l'auteur : le fichier n'a toujours pas la clé.
    relu = atelier.base.lire_projet(atelier.bibliotheque.courant)
    assert all(p.emplois is None for p in relu.pieces)


# ── 2. Une pièce ne porte personne par défaut ────────────────────────────────


def test_une_piece_neuve_ne_porte_personne_et_le_declare(client):
    """**Déclarée, et vide** — pas « jamais déclarée ».

    Une pièce née après la tranche sait qu'elle ne porte personne ; une pièce née
    avant ne sait rien. Les confondre ferait déduire un porteur pour une pièce
    dont l'auteur vient de dire qu'elle n'en a pas.
    """
    _creer(client, "Le goliath")
    epee = _piece(client, "Epée")

    assert epee["emplois"] == []
    lu = _emplois(client)[epee["identifiant"]]
    assert lu["declare"] is True
    assert lu["emplois"] == []


def test_une_piece_declaree_vide_ne_se_repeuple_pas_sur_ses_calques(
    client, atelier, tmp_path
):
    """**Le piège que la distinction évite.**

    Une pièce déclarée vide qui a malgré tout des calques sur le disque — parce
    qu'on vient d'en retirer le porteur — ne doit pas voir ce porteur revenir à
    la lecture suivante. Sans la distinction, la déduction le ressusciterait à
    chaque appel, et retirer un porteur serait un geste sans effet.
    """
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=goliath["identifiant"],
        piece=epee["identifiant"],
    )

    reponse = client.delete(
        f"/api/characters/pieces/{epee['identifiant']}"
        f"/uses/{emploi_porte(goliath['identifiant']).identifiant}"
    )
    assert reponse.status_code == 200, reponse.text

    lu = _emplois(client)[epee["identifiant"]]
    assert lu["emplois"] == []
    assert lu["declare"] is True


def test_la_regle_de_resolution_est_ecrite_une_fois_dans_le_domaine():
    """`emplois_resolus` est la seule règle, et deux services la lisent — celui
    de l'équipement pour les écrans, celui de la production pour la charge d'un
    sujet. Deux copies auraient fini par répondre deux choses de la même pièce.
    """
    jamais = Piece(identifiant="epee", nom="Epée")
    declaree = Piece(identifiant="epee", nom="Epée", emplois=())

    assert [e.porteur for e in emplois_resolus(jamais, ("le-goliath",))] == [
        "le-goliath"
    ]
    assert emplois_resolus(declaree, ("le-goliath",)) == ()


# ── 3. Une pièce créée depuis la fiche d'un personnage lui est attribuée ─────


def test_une_piece_creee_depuis_une_fiche_est_attribuee_d_emblee(client):
    """Un seul aller-retour. Nommer une pièce depuis le vestiaire de quelqu'un
    et devoir ensuite dire qui la porte aurait fait deux gestes là où l'auteur
    n'en voit qu'un."""
    goliath = _creer(client, "Le goliath")

    epee = _piece(client, "Epée", porteur=goliath["identifiant"])

    assert [e["porteur"] for e in epee["emplois"]] == [goliath["identifiant"]]
    assert epee["emplois"][0]["genre"] == PORTE
    assert epee["emplois"][0]["identifiant"] == f"{PORTE}-{goliath['identifiant']}"


def test_une_piece_ne_naît_pas_sur_une_chose_qui_ne_porte_rien(client):
    """**Une pièce se pose sur un corps, jamais sur rien** — c'est déjà le refus
    de C3 au moment de plier, et E15 le dit à l'écran depuis. Le refus tombe
    **avant** que la pièce soit écrite : une pièce à moitié créée, sans son
    porteur, obligerait l'auteur à défaire avant de refaire."""
    decor = _creer(client, "les cavernes du nord", famille="decors")

    reponse = client.post(
        "/api/characters/pieces",
        json={"nom": "Epée", "porteur": decor["identifiant"]},
    )

    assert reponse.status_code == 409, reponse.text
    assert "ne porte pas d'équipement" in reponse.text
    assert _emplois(client) == {}


def test_un_personnage_ne_porte_une_piece_qu_une_fois(client):
    """Les calques sont rangés par *(pièce, personnage, pose)* et par rien
    d'autre : deux emplois portés par le même personnage se partageraient les
    mêmes images sans qu'aucune règle puisse dire laquelle va où."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])

    reponse = client.post(
        f"/api/characters/pieces/{epee['identifiant']}/uses",
        json={"genre": PORTE, "porteur": goliath["identifiant"]},
    )

    assert reponse.status_code == 409, reponse.text
    assert "porte déjà" in reponse.text


def test_un_emploi_qui_ne_porte_personne_n_a_pas_besoin_de_porteur(client):
    """*Posée au sol*, *plantée dans un rocher*, *son icône d'inventaire* : trois
    des six emplois de l'épée de la planche ne portent sur personne."""
    _creer(client, "Le goliath")
    epee = _piece(client, "Epée")

    reponse = client.post(
        f"/api/characters/pieces/{epee['identifiant']}/uses",
        json={"genre": A_PART, "nom": "Posée au sol"},
    )
    assert reponse.status_code == 201, reponse.text

    emploi = reponse.json()["emploi"]
    assert emploi["genre"] == A_PART
    assert emploi["porteur"] == ""
    assert emploi["nom"] == "Posée au sol"


def test_un_emploi_porte_sans_porteur_est_refuse_avec_sa_raison(client):
    _creer(client, "Le goliath")
    epee = _piece(client, "Epée")

    reponse = client.post(
        f"/api/characters/pieces/{epee['identifiant']}/uses", json={"genre": PORTE}
    )

    assert reponse.status_code == 409, reponse.text
    assert "personnage qui le porte" in reponse.text


# ── 4. Les emplacements de corps restent au jeu, jamais au personnage ────────


def test_les_emplacements_restent_au_jeu(client):
    """Déjà vrai par construction — mesuré parce que c'en est un critère, et
    parce qu'un emploi cite désormais un emplacement : c'était l'occasion de le
    déplacer sur le personnage par mégarde."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", emplacement="les mains", porteur=goliath["identifiant"])
    client.put(
        f"/api/characters/pieces/{epee['identifiant']}"
        f"/uses/{emploi_porte(goliath['identifiant']).identifiant}",
        json={"emplacement": "le dos"},
    )

    # Les deux emplacements sont au jeu, dans le vestiaire du projet…
    vestiaire = client.get("/api/characters").json()
    assert {e["nom"] for e in vestiaire["emplacements"]} == {"les mains", "le dos"}
    # …et le personnage n'en porte aucun.
    chose = _choses(client)[goliath["identifiant"]]
    assert "emplacements" not in chose
    assert "emplacement" not in chose


def test_un_emploi_sans_emplacement_reprend_celui_de_la_piece(client):
    """**Vide veut dire « celui de la pièce », jamais « aucun »** — l'écrire
    deux fois aurait fait deux vérités sur la même question."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", emplacement="les mains", porteur=goliath["identifiant"])

    emploi = _emplois(client)[epee["identifiant"]]["emplois"][0]

    assert emploi["emplacement"] == ""
    assert emploi["emplacement_nom"] == "les mains"


# ── 5. Un calque reste solidaire de sa pose — l'invariant de C3 ──────────────


def test_retirer_un_porteur_ne_supprime_aucune_image(client, atelier, tmp_path):
    """La phrase de la planche, tenue au mot : *« Retirer un porteur ne supprime
    pas ses images : elles restent dans la galerie, détachées. »*"""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    calque = _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=goliath["identifiant"],
        piece=epee["identifiant"],
    )
    avant = atelier.assets.lire(calque)

    client.delete(
        f"/api/characters/pieces/{epee['identifiant']}"
        f"/uses/{emploi_porte(goliath['identifiant']).identifiant}"
    )

    apres = atelier.assets.lire(calque)
    assert apres.supprime_le is None
    # **Solidaire de sa pose, et de sa pièce** : les trois champs qui rangent un
    # calque n'ont pas bougé d'un caractère.
    assert (apres.pose, apres.piece, apres.personnage) == (
        avant.pose,
        avant.piece,
        avant.personnage,
    )
    assert apres.en_json() == avant.en_json()


def test_retirer_une_piece_ne_touche_toujours_a_rien(client, atelier, tmp_path):
    """Le geste d'avant la tranche ne change pas de sens parce qu'une pièce
    porte maintenant des emplois : *la pièce part, ses calques restent*."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    calque = _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=goliath["identifiant"],
        piece=epee["identifiant"],
    )

    reponse = client.delete(f"/api/characters/pieces/{epee['identifiant']}")
    assert reponse.status_code == 200, reponse.text

    assert atelier.assets.lire(calque).piece == epee["identifiant"]


def test_un_emploi_ne_change_jamais_de_porteur(client):
    """Changer le porteur laisserait ses calques sous l'ancien — ils portent son
    identifiant, pas celui de l'emploi. Le champ n'existe donc pas au réglage :
    se tromper de porteur se répare en retirant l'emploi et en en créant un
    autre, et les images ne bougent toujours pas."""
    goliath = _creer(client, "Le goliath")
    minus = _creer(client, "Le minus")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])

    reponse = client.put(
        f"/api/characters/pieces/{epee['identifiant']}"
        f"/uses/{emploi_porte(goliath['identifiant']).identifiant}",
        json={"nom": "En main droite", "porteur": minus["identifiant"]},
    )
    assert reponse.status_code == 200, reponse.text

    emploi = _emplois(client)[epee["identifiant"]]["emplois"][0]
    assert emploi["nom"] == "En main droite"
    assert emploi["porteur"] == goliath["identifiant"]


# ── La colonne « ce que l'entité réclame » cesse de lister le jeu entier ─────


def test_un_personnage_ne_voit_que_les_pieces_qu_il_porte(client):
    """Le troisième grief d'usage que la tranche lève. Avant, la colonne
    d'équipement d'un établi listait **toutes** les pièces du jeu, pour chaque
    personnage : rien n'empêchait de proposer le casque de fer sur la
    grenouille."""
    goliath = _creer(client, "Le goliath")
    minus = _creer(client, "Le minus")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    casque = _piece(client, "Casque", porteur=minus["identifiant"])
    _piece(client, "Sac de voyage")

    choses = _choses(client)

    assert choses[goliath["identifiant"]]["pieces"] == [epee["identifiant"]]
    assert choses[minus["identifiant"]]["pieces"] == [casque["identifiant"]]


def test_une_chose_qui_ne_porte_rien_n_a_aucune_piece(client):
    """Un décor n'a pas de vestiaire, et ce n'est pas une liste vide qu'on lui
    grise : c'est `equipable` qui décide, comme depuis E15."""
    decor = _creer(client, "les cavernes du nord", famille="decors")
    _creer(client, "Le goliath")
    _piece(client, "Epée")

    chose = _choses(client)[decor["identifiant"]]

    assert chose["equipable"] is False
    assert chose["pieces"] == []


def test_un_personnage_voit_les_pieces_que_ses_calques_lui_donnent(
    client, atelier, tmp_path
):
    """Et pour une pièce d'avant la tranche, la colonne se lit sur les calques —
    par la même règle du domaine, pas par une seconde."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée")
    projet = atelier.base.lire_projet(atelier.bibliotheque.courant)
    projet.pieces = tuple(
        Piece.depuis_json({k: v for k, v in p.en_json().items() if k != "emplois"})
        for p in projet.pieces
    )
    atelier.bibliotheque.sauver_projet(projet)

    assert _choses(client)[goliath["identifiant"]]["pieces"] == []

    _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=goliath["identifiant"],
        piece=epee["identifiant"],
    )

    assert _choses(client)[goliath["identifiant"]]["pieces"] == [epee["identifiant"]]


# ── Ce que le vestiaire résolu rend aux écrans ───────────────────────────────


def test_le_compte_d_un_emploi_est_celui_de_la_charge_d_un_sujet(
    client, atelier, tmp_path
):
    """**Pas un second compte.** Une pose réclame ce que `reclame` dit qu'elle
    réclame, et le calque se compte comme le corps : plafonné à ce qui est
    demandé, jamais 250 %."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    poses = [c["pose"] for c in _choses(client)[goliath["identifiant"]]["cases"]]
    assert len(poses) == 6

    for pose in poses[:2]:
        _poser_un_calque(
            client,
            atelier,
            tmp_path,
            personnage=goliath["identifiant"],
            piece=epee["identifiant"],
            pose=pose,
        )
    # Une seconde image sur la même pose ne fait pas une case de plus.
    _poser_un_calque(
        client,
        atelier,
        tmp_path,
        personnage=goliath["identifiant"],
        piece=epee["identifiant"],
        pose=poses[0],
    )

    lu = _emplois(client)[epee["identifiant"]]

    assert lu["emplois"][0]["fait"] == 2
    assert lu["emplois"][0]["attendu"] == 6
    assert (lu["fait"], lu["attendu"]) == (2, 6)


def test_un_porteur_retire_du_jeu_se_voit_au_lieu_de_disparaitre(client, atelier):
    """**Jamais de cascade** — c'est déjà ce que la matrice fait d'une image dont
    la direction a été retirée. Retirer un personnage ne va pas nettoyer les
    pièces derrière lui : l'orphelin se dit, et se retire d'un clic."""
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])
    _creer(client, "Le minus")

    reponse = client.delete(f"/api/characters/{goliath['identifiant']}")
    assert reponse.status_code == 200, reponse.text

    emploi = _emplois(client)[epee["identifiant"]]["emplois"][0]
    assert emploi["porteur"] == goliath["identifiant"]
    assert emploi["orphelin"] is True


def test_le_vestiaire_resolu_ne_liste_que_les_choses_qui_peuvent_porter(client):
    """Les mêmes candidats que `wearers` depuis E15 : un décor et un bouton ne
    sont pas des porteurs possibles, et les compter ferait dire « posée sur 0
    sur 3 » d'un jeu qui n'a que deux corps."""
    _creer(client, "Le goliath")
    _creer(client, "Le minus")
    _creer(client, "les cavernes du nord", famille="decors")
    _piece(client, "Epée")

    porteurs = client.get("/api/characters/pieces/uses").json()["porteurs"]

    assert {p["nom"] for p in porteurs} == {"Le goliath", "Le minus"}


def test_uses_n_est_pas_lu_comme_un_identifiant_de_piece(client):
    """Le piège d'adressage de `slots/suggested`, reconduit : `uses` doit rester
    **avant** `/characters/pieces/{identifiant}` dans le fichier de routes, sans
    quoi laquelle gagne dépend de l'ordre des fonctions."""
    _creer(client, "Le goliath")
    _piece(client, "Epée")

    reponse = client.get("/api/characters/pieces/uses")

    assert reponse.status_code == 200, reponse.text
    assert "pieces" in reponse.json()


def test_un_emploi_inconnu_est_refuse_avec_sa_raison(client):
    goliath = _creer(client, "Le goliath")
    epee = _piece(client, "Epée", porteur=goliath["identifiant"])

    reponse = client.delete(
        f"/api/characters/pieces/{epee['identifiant']}/uses/n-existe-pas"
    )

    assert reponse.status_code == 409, reponse.text
    assert "aucun emploi" in reponse.text


def test_un_genre_inconnu_dans_un_fichier_abime_retombe_sur_porte():
    """La liste est close, et un fichier abîmé ne la rouvre pas — même règle que
    la portée d'une pièce, et que les teintes avant elle."""
    emploi = Emploi.depuis_json({"identifiant": "x", "genre": "nawak"})

    assert emploi.genre == PORTE


def test_une_entree_d_emploi_sans_identifiant_est_sautee_pas_fatale():
    """Un vestiaire à deux emplois au lieu de trois se répare d'un clic ; un jeu
    qui ne s'ouvre plus ne se répare pas."""
    piece = Piece.depuis_json(
        {
            "identifiant": "epee",
            "nom": "Epée",
            "emplois": [
                {"genre": "porte", "porteur": "sans-identifiant"},
                {"identifiant": "porte-le-goliath", "porteur": "le-goliath"},
            ],
        }
    )

    assert [e.identifiant for e in piece.emplois or ()] == ["porte-le-goliath"]
