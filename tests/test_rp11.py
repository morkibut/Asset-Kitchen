# -*- coding: utf-8 -*-
"""RP11 — la galerie se trie, se filtre et se regroupe.

Les quatre critères de `docs/PLAN-remise-a-plat.md` § RP11, et le contrat
qu'ils supposent : **un tri et deux filtres sur la route de la grille**, et un
regroupement nommé. Rien ici ne coûte un centime — tout entre par l'import.

**Le piège que ces essais évitent** : vérifier un tri sur ce que la route a
rendu, c'est-à-dire sur la page déjà coupée. Un tri fait après le plafond
trierait deux cents images sur cinq cents et paraîtrait juste dans un essai à
trois images. Le dernier essai monte donc **plus d'images que le plafond** et
regarde ce qui est en tête et en queue.
"""

from __future__ import annotations

import pytest

from atelier.domaine.galerie import regrouper_par_origine, role_de
from tests.conftest import image_sujet


# ── De quoi travailler ───────────────────────────────────────────────────────


def _poser(client, nom: str) -> dict:
    """Une image entre en bibliothèque, **sans passer par le fournisseur**.

    `forcer` parce que toutes ces images sont les mêmes octets : sans lui, la
    deuxième serait annoncée comme un doublon et la bibliothèque n'en
    contiendrait qu'une. Ce que ces essais regardent est l'ordre et le filtre,
    pas la détection de doublon.
    """
    reponse = client.post(
        "/api/assets/upload",
        content=image_sujet(),
        params={"nom": nom, "traiter": "false", "forcer": "true"},
    )
    assert reponse.status_code == 201, reponse.text
    asset = reponse.json()["asset"]
    assert asset is not None, reponse.text
    return asset


def _grille(client, **parametres) -> dict:
    reponse = client.get("/api/assets", params=parametres)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _identifiants(grille: dict) -> list[str]:
    return [a["identifiant"] for a in grille["assets"]]


def _decouper(client, planche: str, combien: int) -> list[str]:
    """`combien` cases dans la planche, en damier. Aucune n'a rien coûté.

    Les boîtes sont `[x0, y0, x1, y1]`, sur les 96 × 96 de `image_sujet` : dix
    colonnes de neuf pixels suffisent pour la centaine du dernier essai.
    """
    boites = [
        [9 * (n % 10), 9 * (n // 10), 9 * (n % 10) + 8, 9 * (n // 10) + 8]
        for n in range(combien)
    ]
    reponse = client.post(f"/api/assets/{planche}/slices", json={"boites": boites})
    assert reponse.status_code in (200, 201), reponse.text
    return [a["identifiant"] for a in reponse.json()["decoupes"]]


# ── Le tri ───────────────────────────────────────────────────────────────────


def test_le_tri_se_choisit_et_il_est_fait_par_le_serveur(client):
    """Trois valeurs, trois ordres — et une quatrième retombe sur le défaut.

    **Une valeur inconnue ne refuse pas.** Un tri est un réglage de coup d'œil ;
    répondre 422 à un navigateur qui garde une valeur d'une version d'avant
    viderait la galerie sans rien expliquer.
    """
    premiere = _poser(client, "alpha.png")
    deuxieme = _poser(client, "zoulou.png")
    troisieme = _poser(client, "mike.png")

    assert _identifiants(_grille(client)) == [
        troisieme["identifiant"],
        deuxieme["identifiant"],
        premiere["identifiant"],
    ]
    assert _identifiants(_grille(client, tri="ancien")) == [
        premiere["identifiant"],
        deuxieme["identifiant"],
        troisieme["identifiant"],
    ]
    par_nom = [a["label"] for a in _grille(client, tri="nom")["assets"]]
    assert par_nom == sorted(par_nom, key=str.casefold)

    # Hors liste : le défaut, sans un mot de plus.
    assert _identifiants(_grille(client, tri="au-hasard")) == _identifiants(
        _grille(client)
    )


def test_un_nom_vide_passe_apres_les_autres(tmp_path):
    """Sinon « Nom A → Z » mettrait en tête celles qui n'ont pas de nom.

    **Sur le dépôt et pas sur la route** : aucun écran ne sait poser un nom
    vide, et l'essai porte sur le `ORDER BY`, pas sur un geste. C'est aussi
    l'endroit le plus court pour vérifier que la casse ne décide de rien.
    """
    from atelier.depot.base import Base
    from atelier.domaine.asset import Asset

    base = Base(tmp_path / "index.sqlite3")
    for identifiant, label in (("a", "zoulou"), ("b", ""), ("c", "Alpha")):
        base.enregistrer_asset(
            Asset(
                identifiant=identifiant,
                generation="g",
                rang=0,
                brut="x.png",
                largeur=8,
                hauteur=8,
                type_media="image/png",
                label=label,
            )
        )
    assert [a.label for a in base.assets(tri="nom")] == ["Alpha", "zoulou", ""]


# ── Les deux filtres ─────────────────────────────────────────────────────────


def test_le_filtre_par_role_separe_les_cinq_roles(client):
    """Une origine, ses dérivées, et ce qui n'est ni l'un ni l'autre.

    **Le rôle d'une image est écrit à sa naissance, sauf `origine`** : celui-là
    parle de ce qui descend d'elle, et une image ne sait pas d'avance qu'on la
    découpera. L'essai le prouve en découpant *après* : la planche change de
    rôle sans avoir été réécrite.
    """
    planche = _poser(client, "planche.png")
    seule = _poser(client, "isolee.png")

    assert _identifiants(_grille(client, role="origine")) == []

    cases = _decouper(client, planche["identifiant"], 3)

    assert _identifiants(_grille(client, role="origine")) == [planche["identifiant"]]
    assert set(_identifiants(_grille(client, role="derivee"))) == set(cases)
    assert set(_identifiants(_grille(client, role="seule"))) == {
        planche["identifiant"],
        seule["identifiant"],
    }
    # Le total suit le filtre, sinon le pied de la grille mentirait.
    assert _grille(client, role="derivee")["total"] == 3
    assert _grille(client, role="au-hasard")["total"] == 5


def test_le_filtre_par_jugement_a_deux_etats_et_ils_se_completent(client):
    """« Juger, c'est marquer favori ou supprimer » — donc deux, pas huit."""
    marquee = _poser(client, "gardee.png")
    autre = _poser(client, "a-voir.png")
    assert client.put(
        "/api/assets/favorite",
        json={"identifiants": [marquee["identifiant"]], "favori": True},
    ).status_code == 200

    assert _identifiants(_grille(client, jugement="favori")) == [
        marquee["identifiant"]
    ]
    assert _identifiants(_grille(client, jugement="non-juge")) == [
        autre["identifiant"]
    ]
    assert _grille(client, jugement="tous")["total"] == 2


def test_favoris_dit_exactement_jugement_favori(client):
    """L'ancien paramètre reste à la porte, **et il n'écrit pas une seconde
    condition** : il se replie sur le jugement, une fois, dans le dépôt."""
    marquee = _poser(client, "gardee.png")
    _poser(client, "a-voir.png")
    assert client.put(
        "/api/assets/favorite",
        json={"identifiants": [marquee["identifiant"]], "favori": True},
    ).status_code == 200

    assert _identifiants(_grille(client, favoris="true")) == _identifiants(
        _grille(client, jugement="favori")
    )


def test_les_deux_filtres_et_la_recherche_se_cumulent(client):
    """Chacun sur son axe — sinon en poser deux en écarterait un."""
    planche = _poser(client, "epee-planche.png")
    cases = _decouper(client, planche["identifiant"], 2)
    assert client.put(
        "/api/assets/favorite", json={"identifiants": [cases[0]], "favori": True}
    ).status_code == 200

    trouve = _grille(client, role="derivee", jugement="favori", recherche="epee")
    assert _identifiants(trouve) == [cases[0]]
    assert trouve["total"] == 1


# ── Le regroupement ──────────────────────────────────────────────────────────


def test_une_planche_et_ses_derives_se_regroupent(client):
    """Une entrée par origine, ses dérivés dedans, et `assets` reste plate."""
    planche = _poser(client, "planche.png")
    seule = _poser(client, "isolee.png")
    cases = _decouper(client, planche["identifiant"], 4)

    grille = _grille(client, groupe="true")
    groupes = {g["origine"]: g["derives"] for g in grille["groupes"]}
    assert set(groupes) == {planche["identifiant"], seule["identifiant"]}
    assert set(groupes[planche["identifiant"]]) == set(cases)
    assert groupes[seule["identifiant"]] == []
    # La liste plate porte tout le monde, dans l'ordre des groupes : l'origine
    # d'abord, ses dérivés ensuite.
    plate = _identifiants(grille)
    assert set(plate) == {planche["identifiant"], seule["identifiant"], *cases}
    assert plate.index(planche["identifiant"]) < min(plate.index(c) for c in cases)

    # Sans le demander, rien : une entrée par image ne dirait rien et pèserait
    # une ligne par tuile.
    assert "groupes" not in _grille(client)


def test_un_groupe_prend_la_place_de_son_membre_le_mieux_classe(client):
    """La planche est vieille, ses cases viennent d'être coupées.

    Classer le groupe sur la planche l'enverrait au fond de la grille à la
    seconde où l'on découpe — c'est-à-dire au moment précis où on le regarde.
    """
    planche = _poser(client, "planche.png")
    plus_recente = _poser(client, "apres.png")
    _decouper(client, planche["identifiant"], 2)

    ordres = [g["origine"] for g in _grille(client, groupe="true")["groupes"]]
    assert ordres == [planche["identifiant"], plus_recente["identifiant"]]


def test_un_derive_dont_l_origine_est_filtree_se_montre_seul(client):
    """Le regroupement se pose sur la page, jamais sur la bibliothèque entière.

    Sans cette règle, filtrer sur les dérivées ferait disparaître des images :
    leur origine n'est pas là, et un groupe sans origine n'existe pas.
    """
    planche = _poser(client, "planche.png")
    cases = _decouper(client, planche["identifiant"], 3)

    grille = _grille(client, role="derivee", groupe="true")
    assert {g["origine"] for g in grille["groupes"]} == set(cases)
    assert all(g["derives"] == [] for g in grille["groupes"])


def test_la_filiation_remonte_jusqu_a_la_racine_presente(client):
    """Une case, puis un miroir de cette case : un seul groupe, sous la planche.

    « Voir source, planches et calques ensemble » — la maquette le demande, et
    un regroupement d'un seul cran en aurait fait deux groupes côte à côte.
    """
    planche = _poser(client, "planche.png")
    case = _decouper(client, planche["identifiant"], 1)[0]
    # La direction est désignée à la main : la case ne dit pas d'où elle se
    # regarde, et le miroir refuse plutôt que de deviner (B1).
    miroir = client.post(f"/api/assets/{case}/mirror", json={"direction": "ouest"})
    assert miroir.status_code in (200, 201), miroir.text
    petite_fille = miroir.json()["miroir"]["identifiant"]

    groupes = {
        g["origine"]: g["derives"] for g in _grille(client, groupe="true")["groupes"]
    }
    assert set(groupes) == {planche["identifiant"]}
    assert set(groupes[planche["identifiant"]]) == {case, petite_fille}


def test_l_algorithme_se_lit_seul(atelier):
    """`regrouper_par_origine` est une fonction sur une liste, et rien d'autre.

    Elle est nommée et isolée pour cette raison : la question « qui est sous
    qui » se relit sans monter un serveur ni une base.
    """
    from atelier.domaine.asset import Asset

    def image(identifiant: str, parent: str | None = None) -> Asset:
        return Asset(
            identifiant=identifiant,
            generation="g",
            rang=0,
            brut="x.png",
            largeur=8,
            hauteur=8,
            type_media="image/png",
            parent=parent,
        )

    page = [image("a"), image("b", "a"), image("c", "b"), image("d")]
    assert regrouper_par_origine(page) == [
        {"origine": "a", "derives": ["b", "c"]},
        {"origine": "d", "derives": []},
    ]
    # Le parent absent de la page ne fait venir personne.
    assert regrouper_par_origine([image("b", "a")]) == [
        {"origine": "b", "derives": []}
    ]
    # Et le rôle se lit sur l'image seule, sans rien autour.
    assert role_de(image("b", "a")) == "derivee"
    assert role_de(image("a")) == "seule"


# ── Le plafond, et la lisibilité ─────────────────────────────────────────────


def test_la_galerie_tient_plusieurs_centaines_de_resultats(client):
    """Cinq cents images, dont une feuille de soixante cases — en une requête.

    **Le critère mesuré est la lisibilité, pas la vitesse** : repliée, la grille
    rend 441 tuiles au lieu de 500, et c'est le regroupement qui fait la
    différence. Le plafond, lui, compte toujours des images : `total` reste le
    seul nombre du produit, et il ne se met pas à compter des groupes.

    Soixante cases et non cent : une planche se découpe en soixante-quatre
    morceaux au plus, et ce plafond-là n'est pas celui de cette tranche.
    """
    planche = _poser(client, "planche.png")
    cases = _decouper(client, planche["identifiant"], 60)
    for n in range(439):
        _poser(client, f"image-{n:03d}.png")

    grille = _grille(client, groupe="true", limite=1000)
    assert grille["total"] == 500
    assert len(grille["assets"]) == 500
    # Une tuile par groupe replié : 440 images seules, et la feuille.
    assert len(grille["groupes"]) == 440
    porte_les_cases = next(
        g for g in grille["groupes"] if g["origine"] == planche["identifiant"]
    )
    assert set(porte_les_cases["derives"]) == set(cases)

    # Et le tri porte sur **toute** la bibliothèque, pas sur la page : avec un
    # plafond de dix, le plus ancien des cinq cents est en tête.
    dix = _grille(client, tri="ancien", limite=10)
    assert dix["total"] == 500
    assert _identifiants(dix)[0] == planche["identifiant"]


# ── La route et l'outil de l'agent, alignés ──────────────────────────────────


@pytest.fixture
async def mcp(atelier):
    await atelier.ouvrir()
    from atelier.mcp.serveur import creer_serveur

    return creer_serveur(atelier)


async def _appeler(serveur, nom: str, **arguments):
    resultat = await serveur.call_tool(nom, arguments)
    assert not resultat.is_error, resultat.content
    return resultat.structured_content


@pytest.mark.anyio
async def test_l_agent_voit_exactement_ce_que_l_ecran_voit(mcp, atelier, client):
    """Les mêmes valeurs, aux mêmes noms de valeur — le MCP n'a aucune logique
    propre.

    Les **noms** des paramètres sont en anglais parce qu'un modèle les lit ; les
    **valeurs** sont celles du contrat, parce qu'un agent et un auteur doivent
    pouvoir parler de la même grille.
    """
    planche = _poser(client, "planche.png")
    _poser(client, "isolee.png")
    cases = _decouper(client, planche["identifiant"], 2)

    du_serveur = await _appeler(mcp, "list_assets", role="derivee")
    assert {a["id"] for a in du_serveur["assets"]} == set(cases)
    assert du_serveur["total"] == 2

    groupe = await _appeler(mcp, "list_assets", group=True)
    assert {g["origin"] for g in groupe["groups"]} == {
        planche["identifiant"],
        *[
            a["identifiant"]
            for a in _grille(client, role="seule")["assets"]
            if a["identifiant"] != planche["identifiant"]
        ],
    }
    porte = next(
        g for g in groupe["groups"] if g["origin"] == planche["identifiant"]
    )
    assert set(porte["derived"]) == set(cases)

    ancien = await _appeler(mcp, "list_assets", sort="ancien")
    assert [a["id"] for a in ancien["assets"]] == _identifiants(
        _grille(client, tri="ancien")
    )
