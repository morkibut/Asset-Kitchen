# -*- coding: utf-8 -*-
"""Les critères d'acceptation de SC1 — le style, une donnée du jeu.

**Ce que la tranche ajoute.** Le mouvement (`A6`) dit *quel cycle* — une
attaque, un repos. Le style dit *comment ce personnage-là le joue* : à
mains nues, au bâton, à l'arc. Les textes des attaques animées par Wan 2.2
sont mauvais parce qu'ils ne disent ni le geste, ni la partie du corps, ni
l'arme (`docs/PLAN-styles-de-combat.md`) — c'est ce que le catalogue livré
répare.

**Les trois critères de la tranche, dans l'ordre du plan** : un jeu lit les
styles livrés tant qu'il n'a rien changé, et sa première modification les
copie sans toucher aux autres jeux ; chaque texte livré nomme l'objet tenu
et finit dans la position de départ ; nommer, modifier, masquer et
remontrer un style passent par les routes, sans rien payer.

**Aucun essai ne coûte un centime** : c'est du vocabulaire, comme les
mouvements.
"""

from __future__ import annotations

from atelier.domaine.style import LIVRES, Style, texte_du_style
from atelier.services import Atelier
from atelier.services.styles import ServiceStyles


def _noms(reponse: dict) -> list[str]:
    return [s["identifiant"] for s in reponse["styles"]]


def _projet(atelier) -> str:
    return atelier.bibliotheque.courant


# ── L'atelier arrive avec un catalogue ───────────────────────────────────────


def test_l_atelier_arrive_avec_au_moins_dix_styles(client):
    recu = client.get("/api/styles").json()
    assert len(recu["styles"]) >= 10
    assert len(LIVRES) >= 10
    assert all(s["livre"] for s in recu["styles"])
    assert recu["masques"] == []


def test_un_style_porte_son_nom_ce_qu_il_tient_et_ses_textes(client):
    baton = [s for s in client.get("/api/styles").json()["styles"] if s["identifiant"] == "baton"][0]
    assert baton["nom"]
    assert baton["tient"]
    assert "attaque" in baton["textes"] and "repos" in baton["textes"]


# ── Chaque texte livré tient sa promesse (critère 2 du plan) ─────────────────


def test_chaque_texte_livre_nomme_l_objet_tenu_quand_il_y_en_a_un():
    """*Chaque texte livré dit une seule action, nomme la main ou la partie du
    corps, nomme l'objet tenu, et finit dans la position de départ.*

    On vérifie ici le mot qui distingue un style d'un autre : sans lui,
    « bâton » et « lance » enverraient le même texte au modèle."""
    mots_par_style = {
        "arme-une-main": "sword",
        "arme-lourde": "axe",
        "baton": "staff",
        "lance": "spear",
        "dagues": "dagger",
        "arc": "bow",
        "magie": "wand",
        "bouclier": "shield",
    }
    par_id = {s.identifiant: s for s in LIVRES}
    for identifiant, mot in mots_par_style.items():
        style = par_id[identifiant]
        assert style.tient, f"{identifiant} devrait tenir quelque chose"
        assert mot in style.texte("attaque"), f"{identifiant} : l'attaque ne nomme pas « {mot} »"
        assert mot in style.texte("repos"), f"{identifiant} : le repos ne nomme pas « {mot} »"


def test_les_styles_sans_objet_ne_tiennent_rien(client):
    """« mains nues » et « karaté » se battent à mains nues — `tient` est vide,
    et c'est un fait du jeu, pas un oubli."""
    par_id = {s["identifiant"]: s for s in client.get("/api/styles").json()["styles"]}
    assert par_id["mains-nues"]["tient"] == ""
    assert par_id["karate"]["tient"] == ""


def test_chaque_attaque_finit_dans_la_position_de_depart():
    for style in LIVRES:
        attaque = style.texte("attaque")
        assert attaque, f"{style.identifiant} devrait dire son attaque"
        assert "starting stance" in attaque, f"{style.identifiant} : l'attaque ne revient pas en garde"
        assert "staying in place" in attaque, f"{style.identifiant} : l'attaque sort du cadre"


def test_chaque_repos_boucle_sans_bouger():
    for style in LIVRES:
        repos = style.texte("repos")
        assert repos, f"{style.identifiant} devrait dire son repos"
        assert "looping seamlessly" in repos, f"{style.identifiant} : le repos ne boucle pas"
        assert "staying in place" in repos, f"{style.identifiant} : le repos sort du cadre"


def test_texte_du_style_rend_une_chaine_vide_pour_un_mouvement_tu():
    """Un style qui ne dit rien pour un mouvement le dit en rendant `""`,
    jamais en inventant. `None` se comporte comme un style muet."""
    baton = next(s for s in LIVRES if s.identifiant == "baton")
    assert texte_du_style(baton, "magie") == ""
    assert texte_du_style(None, "attaque") == ""
    assert "staff" in texte_du_style(baton, "attaque")


# ── Le rangement par jeu (critère 1 du plan) ─────────────────────────────────


def test_un_jeu_lit_la_bibliotheque_de_l_atelier_tant_qu_il_n_a_rien_change(client, atelier):
    projet = _projet(atelier)
    recu = client.get(f"/api/styles?projet={projet}").json()
    assert recu["propres_au_jeu"] is False
    assert any(s["identifiant"] == "baton" for s in recu["styles"])


def test_retoucher_un_style_d_un_jeu_ne_touche_pas_les_autres(client, atelier):
    """*Sa première modification les copie, et les autres jeux ne bougent pas.*

    Même critère que pour les mouvements (18 septembre 2026) : un style
    d'attaque n'a pas sa place dans tous les jeux."""
    premier = _projet(atelier)
    texte = "a horizontal swing with a very long glowing staff"
    reponse = client.put(
        f"/api/styles/baton?projet={premier}", json={"textes": {"attaque": texte}}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["propres_au_jeu"] is True

    second = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()
    second = second["projet"]["identifiant"]

    def attaque_baton(projet: str | None) -> str:
        url = "/api/styles" + (f"?projet={projet}" if projet else "")
        style = next(
            s for s in client.get(url).json()["styles"] if s["identifiant"] == "baton"
        )
        return style["textes"]["attaque"]

    assert attaque_baton(premier) == texte
    assert attaque_baton(second) != texte, "l'autre jeu garde la bibliothèque de départ"
    assert attaque_baton(None) != texte, "la bibliothèque de l'atelier n'a pas bougé"


def test_un_jeu_inconnu_ne_s_ecrit_pas(client):
    reponse = client.put("/api/styles/baton?projet=..", json={"tient": "x"})
    assert reponse.status_code in (400, 409)
    assert "jeu" in reponse.json()["raison"]


def test_le_fichier_fait_foi_et_le_catalogue_complete(tmp_path):
    """Même garantie que pour les mouvements : un livré que le fichier connaît
    garde ce que le fichier en dit, un livré qu'il ne connaît pas est ajouté —
    ce qui permet de livrer un style de plus sans redonner ceux qu'on avait
    masqués."""
    atelier = Atelier(racine=tmp_path)
    service: ServiceStyles = atelier.styles
    service.regler("baton", nom="bâton à deux mains")
    service.masquer("lance")

    relu = ServiceStyles(atelier.fichiers)
    par_id = {s.identifiant: s for s in relu.tous()}
    assert par_id["baton"].nom == "bâton à deux mains"
    assert par_id["baton"].livre is True
    assert "lance" not in par_id
    assert [s.identifiant for s in relu.masques()] == ["lance"]


# ── Nommer, modifier, masquer, remontrer (critère 3 du plan) ────────────────


def test_un_fabrique_se_cree_se_regle_et_se_masque(client):
    """*Nommer, modifier, masquer et remontrer un style passent par les
    routes, sans rien payer.*"""
    cree = client.post(
        "/api/styles",
        json={
            "nom": "fouet",
            "tient": "a long leather whip held in the right hand",
            "textes": {"attaque": "a whip crack forward, staying in place"},
        },
    )
    assert cree.status_code == 201, cree.text
    assert "fouet" in _noms(cree.json())

    regle = client.put(
        "/api/styles/fouet", json={"nom": "fouet de cuir"}
    ).json()
    fouet = next(s for s in regle["styles"] if s["identifiant"] == "fouet")
    assert fouet["nom"] == "fouet de cuir"
    # **L'identifiant ne bouge pas quand le nom change.**
    assert fouet["tient"] == "a long leather whip held in the right hand"

    masque = client.delete("/api/styles/fouet").json()
    assert "fouet" not in _noms(masque)
    # Un fabriqué s'en va pour de bon : il n'y a personne pour le remettre.
    assert masque["masques"] == []


def test_un_livre_se_masque_sans_se_supprimer_et_se_remontre(client):
    """**Un livré laisse une pierre, un fabriqué s'en va.** Le catalogue des
    livrés se relit à chaque lecture : effacer un livré le ferait revenir à
    la ligne suivante."""
    apres = client.delete("/api/styles/lance").json()
    assert "lance" not in _noms(apres)
    assert [s["identifiant"] for s in apres["masques"]] == ["lance"]
    # Relu : il ne revient pas.
    assert "lance" not in _noms(client.get("/api/styles").json())

    rendu = client.post("/api/styles/lance/show").json()
    assert "lance" in _noms(rendu)
    assert rendu["masques"] == []


def test_fabriquer_sans_nom_ou_sans_texte_est_refuse(client):
    """*Un style sans nom ne se clique pas, un style sans aucun texte n'est
    pas un style — il ne se distingue pas du mouvement seul.*"""
    sans_texte = client.post("/api/styles", json={"nom": "vide"})
    assert sans_texte.status_code == 409
    assert "texte" in sans_texte.json()["raison"]

    sans_nom = client.post(
        "/api/styles", json={"nom": "", "textes": {"attaque": "x"}}
    )
    assert sans_nom.status_code == 409


def test_deux_fois_le_meme_nom_ne_fait_pas_deux_styles(client):
    client.post("/api/styles", json={"nom": "fouet", "textes": {"attaque": "x"}})
    encore = client.post(
        "/api/styles", json={"nom": "Fouet", "textes": {"attaque": "y"}}
    )
    assert encore.status_code == 409
    assert "existe déjà" in encore.json()["raison"]


def test_regler_fusionne_les_textes_sans_ecraser_les_autres(client):
    """*`textes` se fusionne dans l'existant* : corriger le repos d'un style
    ne doit pas effacer son attaque."""
    avant = next(
        s for s in client.get("/api/styles").json()["styles"] if s["identifiant"] == "baton"
    )
    reponse = client.put(
        "/api/styles/baton", json={"textes": {"repos": "a calm guard, staying in place"}}
    )
    apres = next(
        s for s in reponse.json()["styles"] if s["identifiant"] == "baton"
    )
    assert apres["textes"]["repos"] == "a calm guard, staying in place"
    assert apres["textes"]["attaque"] == avant["textes"]["attaque"]


def test_un_texte_vide_retire_le_mouvement_du_style(client):
    """*Un texte vide retire ce mouvement du style* — la façon de dire « ce
    style ne dit plus rien pour ce geste-là », sans le supprimer."""
    reponse = client.put(
        "/api/styles/arme-lourde", json={"textes": {"course": ""}}
    )
    assert reponse.status_code == 200, reponse.text
    lourde = next(
        s for s in reponse.json()["styles"] if s["identifiant"] == "arme-lourde"
    )
    assert "course" not in lourde["textes"]
    assert "attaque" in lourde["textes"], "les autres textes ne bougent pas"


def test_retirer_tous_les_textes_est_refuse(client):
    """Un style qui ne dirait plus rien pour aucun mouvement n'est plus un
    style — le service refuse plutôt que de le laisser vide."""
    reponse = client.put(
        "/api/styles/mains-nues",
        json={"textes": {"attaque": "", "repos": ""}},
    )
    assert reponse.status_code == 409


def test_rien_ici_n_appelle_le_fournisseur(atelier):
    """*Rien ici ne part vers le fournisseur, rien ne coûte, et tout
    fonctionne réseau coupé* — même garantie que pour les mouvements."""
    service = ServiceStyles(atelier.fichiers)
    service.fabriquer("fouet", textes={"attaque": "a whip crack"})
    assert "fouet" in {s.identifiant for s in service.tous()}
    assert atelier.generations.total_couts() == 0
