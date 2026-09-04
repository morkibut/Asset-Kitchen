# -*- coding: utf-8 -*-
"""Les critères d'acceptation de A6 — le mouvement, dit une fois pour toutes.

**Ce que la tranche répare.** Le produit savait dire une pose — `walking
posture, full body` — et c'est une **posture figée**, juste pour une image et
fausse pour un clip. Ce qui manquait n'était pas une liste de plus : c'était ce
que la même pose dit **quand on l'anime**. Un cycle qui boucle, une cadence, et
les directions où le mouvement existe.

**Ce que ces essais tiennent, et c'est presque toute la tranche.** Le lien
pose ↔ mouvement se fait par l'identifiant et par rien d'autre ; deux clips du
même mouvement partent avec exactement le même texte ; un mouvement survit au
changement de projet parce qu'il vit à la racine ; et un livré masqué ne revient
pas à la lecture suivante.

**Aucun n'appelle le fournisseur et aucun ne coûte** : c'est du vocabulaire, et
tout s'écrit sur le disque. C'est le dernier critère de la tranche, et il se
prouve en montant l'atelier sans réseau — ce que toute cette suite fait déjà.
"""

from __future__ import annotations

import json

from atelier.domaine.mouvement import CADENCE_DEFAUT, LIVRES
from atelier.domaine.plan import PLAN_PAR_DEFAUT
from atelier.services import Atelier
from atelier.services.mouvements import ServiceMouvements


def _noms(reponse: dict) -> list[str]:
    return [m["identifiant"] for m in reponse["mouvements"]]


# ── L'atelier arrive avec une liste ──────────────────────────────────────────


def test_l_atelier_arrive_avec_ses_mouvements(client):
    """*L'atelier arrive avec une liste de mouvements livrés.*"""
    recu = client.get("/api/movements").json()
    assert len(recu["mouvements"]) == len(LIVRES)
    assert all(m["livre"] for m in recu["mouvements"])
    assert recu["masques"] == []


def test_les_livres_recouvrent_le_plan_de_poses_de_depart(client):
    """**La correspondance est le fond de la tranche, et elle serait fausse d'un
    mot.** Un atelier neuf, sur un projet neuf, doit savoir animer ses six cases
    sans qu'une ligne soit écrite : chaque pose du plan de départ trouve donc son
    mouvement, par l'identifiant seul."""
    livres = {m["identifiant"] for m in client.get("/api/movements").json()["mouvements"]}
    for pose in PLAN_PAR_DEFAUT:
        assert pose.identifiant in livres, f"la pose {pose.identifiant} n'a pas de mouvement"


def test_la_distinction_livre_fabrique_est_celle_du_produit(client):
    """*La distinction livré / fabriqué est celle qu'il emploie déjà partout.*

    Même champ, même mot, même marque à l'écran que pour une étiquette."""
    client.post("/api/movements", json={"nom": "nage", "texte": "swimming cycle"})
    recu = client.get("/api/movements").json()
    fabrique = [m for m in recu["mouvements"] if m["identifiant"] == "nage"][0]
    assert fabrique["livre"] is False
    assert all(m["livre"] for m in recu["mouvements"] if m["identifiant"] != "nage")


# ── Ce qu'un mouvement porte ─────────────────────────────────────────────────


def test_un_mouvement_porte_son_texte_sa_cadence_et_ses_directions(client):
    """*Un mouvement porte son texte, sa cadence et les directions où il a un sens.*"""
    marche = [
        m for m in client.get("/api/movements").json()["mouvements"]
        if m["identifiant"] == "marche"
    ][0]
    assert marche["texte"]
    assert marche["cadence"] > 0
    assert "directions" in marche


def test_le_texte_livre_dit_un_cycle_et_pas_une_posture(client):
    """**La différence avec la consigne d'une pose se lit dans le texte.**

    `walking posture, full body` est juste pour une image et faux pour un clip.
    Un texte de mouvement dit que ça boucle, et que le personnage n'avance pas
    dans le cadre — sans quoi il sort du champ et la fenêtre commune du
    découpage devient énorme pour rien (`A2`)."""
    par_id = {
        m["identifiant"]: m
        for m in client.get("/api/movements").json()["mouvements"]
    }
    for cycle in ("repos", "marche", "course"):
        assert "looping" in par_id[cycle]["texte"]
    for deplacement in ("marche", "course"):
        assert "in place" in par_id[deplacement]["texte"]


def test_la_mort_ne_propose_qu_une_direction(client):
    """**Le seul mouvement livré qui déclare une direction, et c'est un fait.**

    Une mort n'a qu'un angle, quel que soit le personnage. Elle *propose* le
    sud ; rien n'est interdit — un mouvement de l'atelier ne connaît pas les
    directions qu'un jeu déclare."""
    mort = [
        m for m in client.get("/api/movements").json()["mouvements"]
        if m["identifiant"] == "mort"
    ][0]
    assert mort["directions"] == ["sud"]


# ── Fabriquer, renommer, masquer ─────────────────────────────────────────────


def test_un_fabrique_se_cree_se_renomme_et_se_masque(client):
    """*Un mouvement fabriqué se crée, se renomme et se masque.*"""
    cree = client.post(
        "/api/movements",
        json={"nom": "vol plané", "texte": "gliding loop, wings spread", "cadence": 6},
    )
    assert cree.status_code == 201
    assert "vol-plane" in _noms(cree.json())

    renomme = client.put(
        "/api/movements/vol-plane", json={"nom": "planer"}
    ).json()
    plane = [m for m in renomme["mouvements"] if m["identifiant"] == "vol-plane"][0]
    assert plane["nom"] == "planer"
    # **L'identifiant ne bouge pas quand le nom change** : c'est lui qui
    # accroche le mouvement à la case du plan.
    assert plane["cadence"] == 6

    masque = client.delete("/api/movements/vol-plane").json()
    assert "vol-plane" not in _noms(masque)
    # Un fabriqué s'en va pour de bon : il n'y a personne pour le remettre.
    assert masque["masques"] == []


def test_un_livre_se_masque_sans_se_supprimer(client):
    """*Un livré se masque sans se supprimer.*

    **C'est la seule façon de ne pas le rendre.** Le catalogue des livrés se
    relit à chaque lecture : effacer un livré le ferait revenir à la ligne
    suivante, et l'auteur masquerait le même mouvement indéfiniment."""
    apres = client.delete("/api/movements/saut").json()
    assert "saut" not in _noms(apres)
    assert [m["identifiant"] for m in apres["masques"]] == ["saut"]
    # Relu : il ne revient pas.
    assert "saut" not in _noms(client.get("/api/movements").json())
    # Et il se remontre.
    rendu = client.post("/api/movements/saut/show").json()
    assert "saut" in _noms(rendu)
    assert rendu["masques"] == []


def test_un_mouvement_sans_texte_anglais_est_refuse(client):
    """**Les deux textes sont la définition.** Un mouvement sans texte anglais
    ne fait rien partir, un mouvement sans nom ne se clique pas."""
    sans_texte = client.post("/api/movements", json={"nom": "ramper", "texte": ""})
    assert sans_texte.status_code == 409
    assert "anglais" in sans_texte.json()["raison"]
    sans_nom = client.post("/api/movements", json={"nom": "", "texte": "crawling"})
    assert sans_nom.status_code == 409


def test_deux_fois_le_meme_nom_ne_fait_pas_deux_mouvements(client):
    client.post("/api/movements", json={"nom": "nage", "texte": "swimming cycle"})
    encore = client.post("/api/movements", json={"nom": "Nage", "texte": "autre"})
    assert encore.status_code == 409
    assert "existe déjà" in encore.json()["raison"]


def test_la_cadence_prend_le_defaut_du_domaine(client):
    """**Un second défaut écrit ailleurs finirait par diverger** : la cadence non
    précisée est celle du domaine, et rien d'autre."""
    recu = client.post(
        "/api/movements", json={"nom": "nage", "texte": "swimming cycle"}
    ).json()
    nage = [m for m in recu["mouvements"] if m["identifiant"] == "nage"][0]
    assert nage["cadence"] == CADENCE_DEFAUT


# ── Le lien avec le plan de poses ────────────────────────────────────────────


def test_une_pose_connue_herite_du_texte_anime_sans_rien_relier(client):
    """*Une pose du plan dont l'identifiant correspond à un mouvement connu
    hérite de son texte animé, sans rien relier à la main.*"""
    recu = client.get("/api/movements/for-pose/marche").json()
    assert recu["origine"] == "mouvement"
    assert recu["mouvement"]["identifiant"] == "marche"
    assert "walking cycle" in recu["texte"]
    # Et ce n'est **pas** la consigne figée de la pose.
    assert recu["texte"] != "walking posture, full body"


def test_une_pose_sans_mouvement_se_commande_quand_meme(client):
    """*Une pose sans mouvement connu se commande quand même, avec le texte que
    l'auteur écrit.*

    Le repli est la consigne figée de la pose : moins bonne — elle décrit une
    posture au lieu d'un cycle —, mais en anglais et juste sur l'attitude. Un
    écran qui refuserait de commander ferait payer à l'auteur le fait d'avoir
    inventé une attitude."""
    ajoutee = client.post(
        "/api/characters/poses", json={"nom": "salue", "consigne": "waving hello"}
    )
    assert ajoutee.status_code == 201

    recu = client.get("/api/movements/for-pose/salue").json()
    assert recu["mouvement"] is None
    assert recu["origine"] == "pose"
    assert recu["texte"] == "waving hello"


def test_une_pose_inconnue_ne_fait_rien_inventer(client):
    """Le produit ne devine pas comment animer une attitude qu'il n'a jamais
    vue, et il le dit plutôt que d'inventer un texte qui partira dans un appel
    payé."""
    recu = client.get("/api/movements/for-pose/danse-de-la-pluie").json()
    assert recu["mouvement"] is None
    assert recu["origine"] == "aucun"
    assert recu["texte"] == ""


def test_deux_clips_du_meme_mouvement_partent_avec_le_meme_texte(client):
    """*Deux clips du même mouvement partent avec exactement le même texte.*

    **C'est ce que la tranche achète.** Deux tirages de la même intention
    partaient avec deux frappes différentes, et l'écart entre eux était alors
    imputé au modèle. Ce qui varie d'un tirage à l'autre redevient le tirage."""
    premier = client.get("/api/movements/for-pose/course").json()["texte"]
    second = client.get("/api/movements/for-pose/course").json()["texte"]
    assert premier == second and premier


# ── Le rangement ─────────────────────────────────────────────────────────────


def test_un_mouvement_survit_au_changement_de_projet(client):
    """*Un mouvement survit au changement de projet.*

    C'est la décision durable de la version : **un mouvement appartient à
    l'atelier, pas à un projet**. Rangé par jeu, il repartirait de zéro à chaque
    nouveau jeu et le mécanisme ne servirait jamais."""
    client.post("/api/movements", json={"nom": "nage", "texte": "swimming cycle"})
    neuf = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()["projet"]
    client.put("/api/projects/current", json={"projet": neuf["identifiant"]})
    assert "nage" in _noms(client.get("/api/movements").json())


def test_le_fichier_fait_foi_et_le_catalogue_complete(tmp_path):
    """**L'ordre compte, et c'est lui qui permet d'en livrer de nouveaux.**

    Un livré que le fichier connaît garde ce que le fichier en dit ; un livré
    qu'il ne connaît pas est ajouté. Sans cette règle, livrer un mouvement de
    plus dans une version suivante redonnerait ceux qu'on avait masqués."""
    atelier = Atelier(racine=tmp_path)
    service: ServiceMouvements = atelier.mouvements
    service.regler("marche", nom="déplacement")
    service.masquer("saut")

    # Un service tout neuf sur le même disque — c'est ce que fait un
    # redémarrage de l'atelier.
    relu = ServiceMouvements(atelier.fichiers)
    par_id = {m.identifiant: m for m in relu.tous()}
    assert par_id["marche"].nom == "déplacement"
    assert par_id["marche"].livre is True
    assert "saut" not in par_id
    assert [m.identifiant for m in relu.masques()] == ["saut"]


def test_le_fichier_reste_lisible_a_la_main(tmp_path):
    """**Les fichiers font foi**, donc `mouvements.json` s'ouvre à la main : on y
    lit `vol-plane`, jamais un jeton hexadécimal.

    Le fichier porte la base entière — livrés compris — dès la première écriture,
    comme `etiquettes.json` : c'est ce qui fige ce que l'auteur a sous les yeux,
    et laisse quand même entrer les mouvements qu'une version suivante livrera,
    puisqu'ils n'y seront pas encore."""
    atelier = Atelier(racine=tmp_path)
    atelier.mouvements.fabriquer("vol plané", "gliding loop")
    ecrit = json.loads(atelier.fichiers.mouvements.read_text(encoding="utf-8"))
    reperes = [m["identifiant"] for m in ecrit]
    assert reperes[-1] == "vol-plane"
    assert "marche" in reperes
    assert all(r == r.lower() and " " not in r for r in reperes)


def test_rien_ici_n_appelle_le_fournisseur(atelier, monkeypatch):
    """*Rien ici ne part vers le fournisseur, rien ne coûte, et tout fonctionne
    réseau coupé.*

    Le service ne reçoit ni catalogue, ni fournisseur, ni animateur — ça se lit
    dans sa construction. L'essai le prouve autrement : la bibliothèque de
    mouvements se lit et s'écrit sur un atelier dont **aucun** port n'est
    joignable."""
    service = ServiceMouvements(atelier.fichiers)
    service.fabriquer("nage", "swimming cycle")
    assert "nage" in {m.identifiant for m in service.tous()}
    assert atelier.generations.total_couts() == 0
