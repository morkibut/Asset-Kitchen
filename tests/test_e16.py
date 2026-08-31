# -*- coding: utf-8 -*-
"""Les critères de E16 qui vivent côté serveur — la vitrine.

**Ce qui se mesure ici** : que les fonds de jugement viennent du projet et de
nulle part ailleurs, que le noir ne soit proposé que si la bible en parle et
cite le texte qui l'a fait proposer, que la taille commune se déduise de ce qui
existe, et qu'une image qui sort à une autre taille soit marquée. Ce que l'écran
montre — les multiples entiers, l'absence de lissage, les trois portes — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare est mesurée le 30 août 2026.** Le codex remplit une case
dès qu'une image porte le nom de la pose — décision volontaire et bonne, elle
laisse une image importée compter comme les autres. Mais sur quarante-huit images
du projet réel, **dix-huit seulement** sont à la taille du jeu, et le codex compte
les mêmes cases pleines dans les quatre cas. Cinq poses de Balthazar sortent en
128 × 128 et son attaque en 96 × 96 : posées côte à côte dans le jeu, le
personnage rapetisserait en frappant, et aucun écran ne mettait ces six images
côte à côte.

**La vitrine n'ajoute aucune règle au codex.** Elle montre l'image, et une image
qu'on regarde répond toute seule. Elle ne fabrique rien, ne modifie rien, ne
compte rien — elle **marque** ce qu'elle voit, et une marque n'est pas un compte.
"""

from __future__ import annotations

import itertools

from atelier.services.production import _extrait, _parle_de_noir, _taille_commune

from tests.conftest import image_sujet


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _vitrine(client, identifiant: str = "") -> dict:
    chemin = (
        f"/api/characters/{identifiant}/showcase"
        if identifiant
        else "/api/characters/showcase"
    )
    reponse = client.get(chemin)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _bible(client, **textes) -> None:
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": texte, "actif": True}
                for nom, texte in textes.items()
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text


_DISTINCTES = itertools.count(3)


def _poser(client, tmp_path, personnage: str, pose: str, cote: int = 24) -> dict:
    """Une image importée, mise dans une case, à la taille qu'on veut.

    **Chaque image est différente de toutes les autres** : deux fichiers
    identiques sont un doublon, que la bibliothèque reconnaît et refuse
    d'importer deux fois — ce qui est juste, et n'a rien à voir avec ce qu'on
    mesure ici. Le compteur garantit la différence sans qu'on ait à y penser.
    """
    rang = next(_DISTINCTES) % (cote - 2) + 1
    fichier = tmp_path / f"{personnage}-{pose}-{cote}-{rang}.png"
    fichier.write_bytes(
        image_sujet(toile=cote, bloc=1, logique_l=rang, logique_h=cote // 2)
    )
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": personnage, "pose": pose},
    )
    return asset


# ── Le fond de jugement vient du projet ──────────────────────────────────────


def test_le_damier_est_le_fond_de_reperage_et_il_le_dit(client):
    """**Un fond de jugement vient du projet, un fond de repérage vient du
    produit.** Le damier montre ce qui est transparent — c'est le fond de la
    retouche, et il ne prétend pas être autre chose."""
    chose = _creer(client)

    fonds = _vitrine(client, chose["identifiant"])["fonds"]

    assert fonds[0]["genre"] == "damier"
    assert "transparent" in fonds[0]["raison"]


def test_le_noir_nest_propose_que_si_la_bible_en_parle(client):
    """**Le produit n'invente pas un fond.** Il en propose un quand le texte du
    jeu le nomme, et il cite ce texte à côté — sans quoi le fond serait apparu de
    nulle part."""
    chose = _creer(client)
    assert all(f["genre"] != "noir" for f in _vitrine(client, chose["identifiant"])["fonds"])

    _bible(
        client,
        eclairage="Dynamic warm radial lighting surrounded by absolute blackness",
    )

    noir = next(
        f for f in _vitrine(client, chose["identifiant"])["fonds"] if f["genre"] == "noir"
    )
    assert noir["couleur"] == "#000000"
    assert "blackness" in noir["raison"]


def test_le_noir_est_le_seul_fond_qui_montre_le_defaut_de_la_bible(client):
    """**Le défaut réel, et il vient de la bible elle-même** : un contour
    *ardoise sombre* posé sur du *noir absolu* disparaît, et il est parfaitement
    invisible sur le damier gris que tous les écrans emploient."""
    assert _parle_de_noir("surrounded by absolute blackness")
    assert _parle_de_noir("1-pixel dark slate outline")
    assert not _parle_de_noir("warm radial lighting")
    # La citation ne noie pas la raison dans le reste de la bible.
    extrait = _extrait("Dynamic warm radial lighting surrounded by absolute blackness")
    assert "blackness" in extrait
    assert len(extrait) < 90


def test_les_fonds_de_palette_viennent_de_la_palette_du_jeu(client):
    """**Aucune couleur libre.** Un sélecteur libre transformerait cet écran en
    outil de maquillage : on trouverait toujours un fond sur lequel le sprite est
    joli, et jamais celui sur lequel il disparaît."""
    carte = client.post(
        "/api/board/paste",
        params={"nom": "art.png", "forcer": True},
        content=image_sujet(),
    ).json()["carte"]
    client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    chose = _creer(client)

    fonds = _vitrine(client, chose["identifiant"])["fonds"]
    palette = client.get("/api/universe").json()["univers"]["palette"]

    de_la_palette = [f["couleur"] for f in fonds if f["genre"] == "palette"]
    assert de_la_palette
    assert all(couleur in palette for couleur in de_la_palette)
    # Trois au plus : la colonne en porte trois, et une liste longue ferait un
    # nuancier plutôt qu'un choix.
    assert len(de_la_palette) <= 3


# ── La taille commune, et ce qui en sort ─────────────────────────────────────


def test_la_taille_commune_est_celle_de_la_plupart(client):
    """**Pas la cible du projet** : une chose peut avoir été fabriquée entière à
    une autre taille, et c'est alors elle qui est cohérente. Ce qu'on cherche est
    la sœur qui sort plus petite, pas l'écart au réglage."""
    assert _taille_commune([{"largeur": 128}] * 5 + [{"largeur": 96}]) == 128
    assert _taille_commune([]) == 0


def test_une_image_hors_taille_commune_est_marquee(client, tmp_path):
    """**Le second défaut invisible.** Cinq poses en 128, une en 96 : posées côte
    à côte dans le jeu, le personnage rapetisserait en frappant."""
    client.put("/api/universe", json={"cible_px": 0})
    chose = _creer(client)
    for pose in ("repos", "marche", "course"):
        _poser(client, tmp_path, chose["identifiant"], pose, cote=24)
    _poser(client, tmp_path, chose["identifiant"], "attaque", cote=16)

    vitrine = _vitrine(client, chose["identifiant"])

    assert vitrine["taille_commune"] == 24
    hors = [i for i in vitrine["images"] if i["hors_taille"]]
    assert [i["pose"] for i in hors] == ["attaque"]


def test_une_chose_dont_tout_sort_pareil_ne_marque_rien(client, tmp_path):
    """Le cas ordinaire ne dit rien : la vitrine constate un écart, elle ne
    commente pas une cohérence."""
    client.put("/api/universe", json={"cible_px": 0})
    chose = _creer(client)
    for pose in ("repos", "marche"):
        _poser(client, tmp_path, chose["identifiant"], pose, cote=24)

    assert all(not i["hors_taille"] for i in _vitrine(client, chose["identifiant"])["images"])


# ── Les portées ──────────────────────────────────────────────────────────────


def test_la_vitrine_du_monde_montre_une_image_par_chose(client, tmp_path):
    """**Trois nains côte à côte disent tout de suite s'ils viennent du même
    monde.** Un seul écran, deux contenus : la vitrine montre ce qu'on regardait
    quand on l'a ouverte."""
    client.put("/api/universe", json={"cible_px": 0})
    for nom in ("Balthazar", "Le nain", "La prêtresse"):
        chose = _creer(client, nom)
        for pose in ("repos", "marche"):
            _poser(client, tmp_path, chose["identifiant"], pose)

    monde = _vitrine(client)

    assert len(monde["images"]) == 3
    assert {i["chose"] for i in monde["images"]} == {
        "Balthazar",
        "Le nain",
        "La prêtresse",
    }


def test_la_vitrine_dune_chose_montre_toutes_ses_poses(client, tmp_path):
    """De son établi, toutes ses poses : on voit si le personnage se ressemble
    d'une pose à l'autre, et si elles sortent toutes à la même taille."""
    client.put("/api/universe", json={"cible_px": 0})
    chose = _creer(client)
    for pose in ("repos", "marche", "course"):
        _poser(client, tmp_path, chose["identifiant"], pose)

    seule = _vitrine(client, chose["identifiant"])

    assert len(seule["images"]) == 3
    assert {i["pose"] for i in seule["images"]} == {"repos", "marche", "course"}


# ── Ce que la vitrine ne fait pas ────────────────────────────────────────────


def test_la_place_du_mouvement_est_reservee_avec_sa_raison(client):
    """**Réservée et grisée**, plutôt qu'occupée par un lecteur posé sur zéro
    image : aucune pose ne tient plus d'une vue dans une même direction."""
    chose = _creer(client)

    mouvement = _vitrine(client, chose["identifiant"])["mouvement"]

    assert mouvement["possible"] is False
    assert "aucune pose" in mouvement["raison"]


def test_la_vitrine_ne_modifie_aucune_image(client, tmp_path):
    """**Elle ne fabrique rien, ne modifie rien, ne coûte rien.** Ce qu'elle
    montre est le rendu tel qu'il est sur le disque."""
    client.put("/api/universe", json={"cible_px": 0})
    chose = _creer(client)
    asset = _poser(client, tmp_path, chose["identifiant"], "repos")
    avant = client.get(f"/api/assets/{asset['identifiant']}").json()

    _vitrine(client, chose["identifiant"])

    apres = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert apres["empreinte"] == avant["empreinte"]
    assert apres["recette"] == avant["recette"]


def test_la_vitrine_ne_coute_rien(client, double, tmp_path):
    """Vrai par construction, et mesuré quand même."""
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "repos")

    _vitrine(client, chose["identifiant"])
    _vitrine(client)

    assert double.appels == 0
