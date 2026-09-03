# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T8 — la toile.

Un test par critère de `docs/archive/plan-versions-tenues.md` § Phase T8, nommé d'après lui. **Six des
treize ne se vérifient pas ici**, parce qu'ils portent sur ce que l'écran montre
ou sur une géométrie que le serveur ne connaît pas : la grille inchangée, les
îlots peuplés à l'ouverture, le collage qui ne bouge rien sur la toile, Ctrl+Z,
la pile qui meurt avec l'écran, et les trois colonnes. Ceux-là vivent dans
`interface/src/App.test.tsx` et `interface/src/composants/Toile.test.tsx`.

**La tranche ne déplace pas la frontière : le serveur tient l'état, l'écran tient
la composition.** Ce que le serveur sait d'une toile est exactement ce qu'une
carte porte — sa place, sa largeur libre, son groupe —, et la seule règle qu'il
en tire est `en_reserve` : ni classée, ni posée. L'îlot n'est pas ici parce qu'il
n'est nulle part : il *est* le groupe, et se calcule de ses membres.

**Aucun test de ce fichier ne coûte un centime**, et le dernier le prouve plutôt
que de l'affirmer, en comptant les appels du double : composer, classer et
déclasser ne demandent jamais le fournisseur.
"""

from __future__ import annotations

import pytest
from conftest import image

from atelier.domaine.carte import LARGEUR_MAX, LARGEUR_MIN, Carte


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _coller(client, nom: str = "planche.png") -> dict:
    """Une carte de plus sur le tableau.

    `forcer` parce que le double rend deux fois les mêmes octets : l'empreinte
    est celle des octets, donc la seconde serait *proposée* comme doublon et la
    route rendrait `carte: null` — le comportement juste de T4, et un piège pour
    qui compose un tableau de quatre cartes dans un test.
    """
    reponse = client.post(
        "/api/board/paste", params={"nom": nom, "forcer": True}, content=image("PNG")
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _regler(client, carte: str, **reglage) -> dict:
    reponse = client.put(f"/api/board/{carte}", json=reglage)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _tableau(client) -> list[dict]:
    return client.get("/api/board").json()["cartes"]


def _par(cartes: list[dict], identifiant: str) -> dict:
    return next(c for c in cartes if c["identifiant"] == identifiant)


# ── « Une carte sans groupe n'est pas sur la toile : elle attend en réserve » ──


def test_une_carte_neuve_attend_en_reserve(client):
    """Ni classée, ni posée — donc elle attend, et personne n'a rien eu à faire.

    C'est la moitié de la phrase que l'écran ne doit pas contredire : *la toile
    montre ce qui est classé, la réserve contient ce qui reste à classer*. Une
    carte qui vient d'entrer n'a ni l'un ni l'autre, et c'est un état complet et
    non une configuration manquante.
    """
    carte = _coller(client)
    assert carte["groupe"] == ""
    assert carte["position"] is None
    assert carte["largeur_libre"] is None
    assert carte["en_reserve"] is True


def test_coller_pendant_qu_on_compose_arrive_en_reserve(client):
    """« Ce qui arrive arrive en réserve — jamais au milieu d'un îlot qu'on vient
    de faire. »

    Rien n'est écrit pour ça, et c'est le point : une carte neuve n'a ni groupe
    ni place, donc la règle de la réserve la range toute seule. Un défaut
    « poser au milieu » aurait demandé du code ; l'absence de code est la
    garantie.
    """
    posee = _coller(client, "posee.png")
    _regler(client, posee["identifiant"], groupe="marais", position=[120, 40])

    neuve = _coller(client, "neuve.png")
    assert neuve["en_reserve"] is True

    # Et rien n'a bougé sur la toile.
    apres = _par(_tableau(client), posee["identifiant"])
    assert apres["position"] == [120, 40]
    assert apres["groupe"] == "marais"


# ── « Tirer une carte de la réserve dans un îlot écrit son groupe » ───────────


def test_tirer_dans_un_ilot_ecrit_le_groupe_et_la_place_en_un_seul_appel(client):
    """**Composer et classer sont le même geste**, donc le même appel.

    Deux routes rendraient possible un état où la place est écrite et le groupe
    non — c'est-à-dire très exactement la divergence que toute la tranche est là
    pour empêcher. C'est ce que ce test vérifie : *un* PUT, et les deux champs
    sont posés ensemble.
    """
    carte = _coller(client)
    reglee = _regler(client, carte["identifiant"], groupe="marais", position=[240, 96])

    assert reglee["groupe"] == "marais"
    assert reglee["position"] == [240, 96]
    assert reglee["en_reserve"] is False

    # Et la grille le montre aussitôt : c'est la même carte, relue par la route
    # que le tableau appelle.
    assert _par(_tableau(client), carte["identifiant"])["groupe"] == "marais"


def test_sortir_d_un_ilot_vide_le_groupe_et_la_carte_reste_posee(client):
    """« Une carte posée sur la toile hors de tout îlot reste posée et sans
    groupe : l'état existe. »

    C'est le brouillon — trois images côte à côte pour voir si elles vont
    ensemble avant de décider qu'elles font un îlot. Posée n'est pas classée, et
    la réserve est la lecture de « ni l'un ni l'autre » : celle-ci a l'un des
    deux, donc elle n'y retourne pas.
    """
    carte = _coller(client)
    _regler(client, carte["identifiant"], groupe="marais", position=[10, 10])

    sortie = _regler(client, carte["identifiant"], groupe="", position=[400, 260])
    assert sortie["groupe"] == ""
    assert sortie["position"] == [400, 260]
    assert sortie["en_reserve"] is False, "posée sans groupe reste sur la toile"


def test_ramener_en_reserve_vide_la_place_et_le_groupe(client):
    """« La ramener en réserve fait la même chose. »

    Un seul appel dit les deux, et le vide efface là où l'absence ne touche pas :
    `groupe: ""` sort de l'îlot, `position: []` sort du plan. La convention est
    celle de `groupe` depuis T4, appliquée à une paire de nombres.
    """
    carte = _coller(client)
    _regler(client, carte["identifiant"], groupe="marais", position=[10, 10])

    rendue = _regler(client, carte["identifiant"], groupe="", position=[])
    assert rendue["groupe"] == ""
    assert rendue["position"] is None
    assert rendue["en_reserve"] is True


def test_ne_rien_dire_d_un_champ_ne_le_touche_pas(client):
    """`None` ne touche pas — sans quoi annoter une carte la déclasserait.

    C'est la moitié de la convention que l'autre test vérifie, et c'est celle
    qu'on casse sans s'en apercevoir : un `PUT` qui remettrait à zéro ce qu'il ne
    porte pas ferait perdre une place à chaque note tapée.
    """
    carte = _coller(client)
    _regler(client, carte["identifiant"], groupe="marais", position=[10, 20], largeur_libre=300)

    annotee = _regler(client, carte["identifiant"], note="le grain de la pierre")
    assert annotee["note"] == "le grain de la pierre"
    assert annotee["groupe"] == "marais"
    assert annotee["position"] == [10, 20]
    assert annotee["largeur_libre"] == 300


# ── « Rouvrir rend la toile telle qu'elle a été laissée » ─────────────────────


def test_la_toile_se_relit_du_disque_avec_ses_places_et_ses_largeurs(client, atelier):
    """« Fermer l'écran et le rouvrir rend la toile telle qu'elle a été laissée —
    positions, largeurs, îlots. »

    **Les fichiers font foi, et les cartes n'entrent jamais dans l'index.** On
    efface donc la base et on reconstruit : ce qui revient est ce que les cartes
    portent, puisqu'elles sont le seul endroit où leur place soit écrite. Les
    îlots reviennent avec, sans être stockés nulle part — ils *sont* les groupes.
    """
    places = {}
    for rang, (groupe, place) in enumerate(
        [("marais", [0, 0]), ("marais", [200, 0]), ("nord", [0, 400]), ("", [600, 600])]
    ):
        carte = _coller(client, f"planche-{rang}.png")
        _regler(
            client,
            carte["identifiant"],
            groupe=groupe,
            position=place,
            largeur_libre=180 + rang,
        )
        places[carte["identifiant"]] = (groupe, place, 180 + rang)

    atelier.base.vider()
    assert client.post("/api/library/rebuild").status_code == 200

    cartes = _tableau(client)
    assert len(cartes) == 4
    for identifiant, (groupe, place, largeur) in places.items():
        relue = _par(cartes, identifiant)
        assert relue["position"] == place
        assert relue["largeur_libre"] == largeur
        assert relue["groupe"] == groupe
        assert relue["en_reserve"] is False

    # Les deux îlots sont les deux groupes, et il n'y en a pas un de plus : la
    # carte posée sans groupe n'en fabrique aucun.
    assert client.get("/api/board").json()["groupes"] == ["marais", "nord"]


def test_une_carte_ecrite_avant_la_toile_se_relit_sans_place(atelier):
    """**Un champ ajouté à un objet ne se rétro-remplit pas tout seul**, et ici
    c'est la bonne réponse.

    Toutes les cartes écrites de T4 à T7 n'ont ni `position` ni `largeur_libre` :
    elles reviennent sans, ce qui *est* leur état — à classer. Une carte groupée
    d'avant se posera dans son îlot à l'ouverture de la toile, et n'écrira la
    sienne qu'au premier geste : c'est l'écran qui la calcule, et rien sur le
    disque ne ment en attendant.
    """
    ancienne = Carte.depuis_json(
        {
            "identifiant": "avant-t8",
            "projet": "bac-a-sable",
            "genre": "texte",
            "texte": "une intention",
            "groupe": "marais",
        }
    )
    assert ancienne.position is None
    assert ancienne.largeur_libre is None
    assert ancienne.en_reserve is False, "classée, donc sur la toile — sans place encore"

    sans_groupe = Carte.depuis_json({"identifiant": "x", "projet": "p"})
    assert sans_groupe.en_reserve is True


# ── « Redimensionner ne change pas le cran de vignette » ──────────────────────


def test_la_largeur_libre_et_le_cran_de_vignette_ne_se_touchent_jamais(client):
    """« Sur une toile la taille est une place occupée, pas un niveau de zoom. »

    Une valeur unique pour les deux aurait fait qu'agrandir une carte sur la
    toile change la grille de tout le monde. Le test le prend dans les deux
    sens, parce que c'est la réciproque qu'on oublie d'écrire.
    """
    carte = _coller(client)

    elargie = _regler(client, carte["identifiant"], largeur_libre=420)
    assert elargie["largeur_libre"] == 420
    assert elargie["taille"] == 1, "le cran de la grille n'a pas bougé"

    agrandie = _regler(client, carte["identifiant"], taille=4)
    assert agrandie["taille"] == 4
    assert agrandie["largeur_libre"] == 420, "la place sur la toile n'a pas bougé"


def test_une_largeur_hors_bornes_est_refusee_en_le_disant(client):
    """Une valeur qu'aucun écran ne peut rendre n'est pas une décision de
    l'auteur, c'est une saisie qui a dérapé — et le refus la nomme."""
    carte = _coller(client)

    for hors in (LARGEUR_MIN - 1, LARGEUR_MAX + 1):
        refus = client.put(f"/api/board/{carte['identifiant']}", json={"largeur_libre": hors})
        assert refus.status_code == 409, refus.text
        assert "largeur" in refus.json()["raison"]

    for dedans in (LARGEUR_MIN, LARGEUR_MAX):
        assert _regler(client, carte["identifiant"], largeur_libre=dedans)["largeur_libre"] == dedans


@pytest.mark.parametrize("mauvaise", ["[1]", "[1, 2, 3]", "[Infinity, 0]", "[null, 2]"])
def test_une_place_qui_n_est_pas_une_paire_finie_est_refusee(client, mauvaise):
    """Une carte posée à l'infini n'est pas visible, elle est perdue — et un plan
    n'a aucun bord où la retrouver.

    **Écrit en JSON brut, et c'est ce que le cas demande.** L'encodeur de la
    bibliothèque d'essai refuse `Infinity` avant de l'envoyer — il a raison, ce
    n'est pas du JSON — mais le *décodeur* de Python l'accepte, donc un client
    qui l'écrit à la main le fait entrer. Passer par `json=` aurait vérifié le
    client au lieu du serveur.
    """
    carte = _coller(client)
    refus = client.put(
        f"/api/board/{carte['identifiant']}",
        content=f'{{"position": {mauvaise}}}',
        headers={"content-type": "application/json"},
    )
    assert refus.status_code in (409, 422), refus.text


# ── « Réseau coupé : la toile, la réserve et le classement fonctionnent » ─────


def test_reseau_coupe_composer_classer_et_declasser_fonctionnent(client, double):
    """Prouvé plutôt qu'affirmé, en comptant les appels du double.

    Toute la tranche est du rangement : rien n'y sort, rien n'y coûte. Le
    fournisseur ne doit pas être touché une seule fois — pas même par le
    recalcul de palette, qu'aucun de ces gestes ne déclenche.
    """
    carte = _coller(client)
    double.catalogue_lisible = False
    appels = double.appels

    _regler(client, carte["identifiant"], groupe="marais", position=[12, 34], largeur_libre=256)
    _regler(client, carte["identifiant"], groupe="")
    _regler(client, carte["identifiant"], groupe="", position=[])
    assert _tableau(client)[0]["en_reserve"] is True
    assert client.get("/api/board").json()["groupes"] == []

    assert double.appels == appels, "composer n'a demandé le fournisseur pour rien"
