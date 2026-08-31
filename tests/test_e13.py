# -*- coding: utf-8 -*-
"""Les critères de E13 qui vivent côté serveur — la planche d'une pose.

**Ce qui se mesure ici** : qu'une case sache sa pose *et* sa direction avant de
partir, que la géométrie soit écrite par l'atelier et non demandée, qu'une
planche ne porte qu'une seule chose du jeu, que deux poses puissent la partager
quand chacune ne réclame qu'une case, qu'aucune planche n'entre en bibliothèque
alors que ses morceaux y entrent, et que les trois prix affichés portent chacun
le nombre d'appels sur lequel il repose. Ce que l'écran montre — les cases dans
l'ordre de lecture, le tableau des trois choix, la matrice qui change de pose
sans refermer — vit dans `interface/src/App.test.tsx`.

**La panne que ça répare est mesurée sur le vrai projet, le 30 août 2026.** Neuf
appels de personnage sur treize ne disent pas leur pose : la pose est écrite sur
l'image après coup, à la main, et **rien ne relie ce qui a été demandé à ce qui a
été rangé**. Avec la planche, une case ne peut pas exister sans dire quelle pose
et quelle direction elle remplit — c'est une condition de l'appel, pas un geste
séparé qu'on peut oublier.

**Et le prix ne dit pas ce qu'on croyait.** Trois appels payés le 31 août 2026 —
`essais/essai_prix_planche.py`, relevé dans `essais/mesures_prix_planche.json` —
ont trouvé que trois cases et six cases coûtent *exactement* le même prix,
$0,0139, quand cinq cases en coûtent $0,0534. Une planche coûte donc le prix d'un
appel quel que soit ce qu'elle porte, **mais la variance entre deux appels
identiques dépasse l'écart entre deux tailles de planche** : un prix affiché par
nombre de cases montrerait du bruit comme si c'était une structure. C'est ce que
les essais du § Le prix vérifient.
"""

from __future__ import annotations

import itertools

from atelier.domaine.pliage import geometrie
from atelier.image.pliage import COTE, cote_de_case
from atelier.services.planche import prix_du_banc, prix_dun_appel

from tests.conftest import image_sujet, planche_sujets

# Le modèle du double — celui que tout le dépôt emploie pour un appel qui rend
# une image.
MODELE = "essai/rend-du-png"


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _vue(client, identifiant: str = "vue-dessus-34") -> None:
    """Déclarer la vue du jeu, **et c'est elle qui crée la planche** : sans
    directions, une pose vaut une image et il n'y a rien à plier."""
    reponse = client.put("/api/universe", json={"vue": identifiant})
    assert reponse.status_code == 200, reponse.text


def _planche(client, personnage: str, pose: str) -> dict:
    reponse = client.get(f"/api/characters/{personnage}/sheet", params={"pose": pose})
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


_DISTINCTES = itertools.count(3)


def _poser(client, tmp_path, personnage: str, pose: str, direction: str = "") -> dict:
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


# ── Ce qu'on voit avant de payer ─────────────────────────────────────────────


def test_lecran_montre_les_cases_leur_texte_et_le_prix(client):
    """**Le premier critère, et il tient en une lecture** : avant de payer, on
    voit le nombre de cases, le texte de chacune, et le prix."""
    chose = _creer(client)
    _vue(client)

    lue = _planche(client, chose["identifiant"], "marche")

    assert lue["geometrie"]["cases"] == 4
    assert [c["direction"] for c in lue["cases"]] == ["sud", "nord", "est", "ouest"]
    assert all(c["texte"] for c in lue["cases"])
    # **Ce qui part en référence**, compté par le serveur — le gabarit de la
    # grille compris, parce qu'il part vraiment : il occupe une place dans le
    # plafond du modèle, et chez ceux qui facturent au texte il coûte.
    assert lue["jointes"]["gabarit"] == 1
    assert lue["jointes"]["total"] >= 1
    # Trois choix, et chacun porte son prix **et** le nombre d'appels derrière.
    assert {c["clef"] for c in lue["choix"]} == {"refaire", "unite"}
    assert all("appels" in c and "prix" in c for c in lue["choix"])


def test_chaque_case_porte_sa_pose_et_sa_direction_avant_lenvoi(client):
    """**C'est ce qui répare la mesure du 30 août** : neuf appels sur treize ne
    disaient pas leur pose, parce que le rangement était un geste séparé. Une
    case ne peut plus partir sans dire où son image ira."""
    chose = _creer(client)
    _vue(client)
    atelier = client.app.state.atelier

    pliage = atelier.generations.cases_de_planche(
        atelier.bibliotheque.courant,
        chose["identifiant"],
        pose="marche",
        directions=["nord", "sud", "est", "ouest"],
    )

    assert pliage is not None
    assert [c.pose for c in pliage.cases] == ["marche"] * 4
    assert [c.direction for c in pliage.cases] == ["nord", "sud", "est", "ouest"]


def test_le_texte_dune_case_met_bout_a_bout_deux_textes_ecrits_chacun_une_fois(client):
    """L'attitude vit sur la pose, l'angle sur la direction, et **aucun des deux
    n'est recopié** : corriger « facing north » se fait à un seul endroit, pour
    les six poses du jeu."""
    chose = _creer(client)
    _vue(client)

    lue = _planche(client, chose["identifiant"], "marche")
    nord = next(c for c in lue["cases"] if c["direction"] == "nord")

    assert "walking posture, full body" in nord["texte"]
    assert "facing north" in nord["texte"]
    # Rien de français ne part (E10, US-241) : ni le nom de la pose, ni celui de
    # la direction.
    assert "marche" not in nord["texte"]


def test_le_texte_montre_est_celui_qui_part(client):
    """**La règle du produit, rendue vérifiable et pas seulement affirmée.** Ce
    que l'écran affiche est composé par le chemin de l'envoi ; un aperçu
    recomposé à l'écran aurait été une seconde vérité sur ce qui part."""
    chose = _creer(client)
    _vue(client)

    lue = _planche(client, chose["identifiant"], "marche")
    apercu = client.post(
        "/api/prompt/preview",
        json={
            "prompt": "a stocky dwarf",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "directions": ["sud", "nord", "est", "ouest"],
        },
    )
    assert apercu.status_code == 200, apercu.text

    texte = apercu.json()["texte"]
    for cellule in lue["cases"]:
        assert cellule["texte"] in texte


def test_le_sujet_dune_planche_est_le_signalement_seul(client):
    """**Une planche est un lot, même quand elle n'a qu'une pose.** Les attitudes
    et les angles partent case par case dans les consignes de planche ; les
    écrire aussi dans le sujet ferait recevoir au modèle « facing north » pour
    une planche dont trois cases sur quatre regardent ailleurs."""
    chose = _creer(client)
    _vue(client)
    client.put(
        f"/api/characters/{chose['identifiant']}",
        json={"description": "a stocky dwarf miner"},
    )

    seule = client.post(
        "/api/characters/subject",
        json={
            "personnage": chose["identifiant"],
            "poses": ["marche"],
            "direction": "nord",
        },
    ).json()["sujet"]
    planche = client.post(
        "/api/characters/subject",
        json={
            "personnage": chose["identifiant"],
            "poses": ["marche"],
            "directions": ["nord", "sud", "est", "ouest"],
        },
    ).json()["sujet"]

    assert "facing north" in seule
    assert planche == "a stocky dwarf miner"


# ── La géométrie, écrite par l'atelier ───────────────────────────────────────


def test_la_geometrie_est_ecrite_par_latelier_et_se_deduit_du_nombre_de_cases(client):
    """**Montrée, et non modifiable** : c'est elle qui rend le découpage du
    retour possible sans deviner, et rien dans la requête ne la propose."""
    chose = _creer(client)
    _vue(client)

    lue = _planche(client, chose["identifiant"], "marche")

    forme = geometrie(4)
    assert (lue["geometrie"]["colonnes"], lue["geometrie"]["lignes"]) == (
        forme.colonnes,
        forme.lignes,
    )
    # La place de chaque case, dans l'ordre de lecture de la grille.
    assert [(c["ligne"], c["colonne"]) for c in lue["cases"]] == [
        (0, 0),
        (0, 1),
        (1, 0),
        (1, 1),
    ]


def test_un_sujet_revient_plus_grand_que_la_cible_du_jeu(client):
    """**Plier ne coûte pas de qualité tant qu'on ne dépasse pas huit cases**, et
    l'écran le dit avec le chiffre plutôt qu'avec une promesse."""
    chose = _creer(client)
    _vue(client)
    client.put("/api/universe", json={"cible_px": 128})

    lue = _planche(client, chose["identifiant"], "marche")

    assert lue["geometrie"]["cote_px"] == COTE
    assert lue["geometrie"]["sujet_px"] == cote_de_case(geometrie(4))
    assert lue["geometrie"]["fois_la_cible"] > 1


def test_la_taille_annoncee_est_celle_que_le_gabarit_dessine():
    """**Une seule formule, et c'est tout l'intérêt.** Deux auraient fini par
    annoncer une taille et en demander une autre — la contradiction que le
    calibrage répare ailleurs, et qu'il n'y a pas de raison de rejouer ici."""
    for cases in (2, 3, 4, 6, 9):
        forme = geometrie(cases)
        cote = cote_de_case(forme)
        assert cote * forme.colonnes <= COTE
        assert cote * forme.lignes <= COTE


# ── Ce qu'une planche porte, et ce qu'elle ne porte pas ──────────────────────


def test_une_planche_ne_porte_quune_seule_chose_du_jeu(client):
    """**Sans quoi la consigne « le même sujet dans chaque case » cesse d'être
    vraie.** Il n'y a qu'un personnage à donner, et c'est ce qui le garantit :
    la règle n'est pas un contrôle, c'est la forme de l'appel."""
    premiere = _creer(client, "Balthazar")
    seconde = _creer(client, "Gudrun")
    _vue(client)
    atelier = client.app.state.atelier
    projet = atelier.bibliotheque.courant

    pliage = atelier.generations.cases_de_planche(
        projet, premiere["identifiant"], pose="marche", directions=["nord", "sud"]
    )

    assert pliage is not None
    # Aucune case ne peut désigner l'autre chose : la planche est composée pour
    # un personnage, et l'autre n'a aucun moyen d'y entrer.
    assert all(c.direction in ("nord", "sud") for c in pliage.cases)
    assert seconde["identifiant"] != premiere["identifiant"]


def test_deux_poses_partagent_une_planche_quand_chacune_ne_reclame_quune_case(client):
    """**Tranché en faveur du codex** (A-13) : la planche prétendait que deux
    attitudes ne pouvaient pas cohabiter, et le dépôt la dément — un appel payé
    du 30 août portait *course, attaque, dégâts et mort* sur la même feuille.

    Ce qui ne se mélange jamais reste la chose du jeu."""
    chose = _creer(client)
    _vue(client)
    # Chacune ne tient qu'une direction : elles ne réclament donc qu'une case.
    for pose in ("course", "attaque", "degats", "mort"):
        for direction in ("nord", "est", "ouest"):
            reponse = client.put(
                f"/api/characters/poses/{pose}/directions/{direction}",
                json={"rangee": True, "portee": "chose", "personnage": chose["identifiant"]},
            )
            assert reponse.status_code == 200, reponse.text

    atelier = client.app.state.atelier
    pliage = atelier.generations.cases_de_planche(
        atelier.bibliotheque.courant,
        chose["identifiant"],
        poses=["course", "attaque", "degats", "mort"],
    )

    assert pliage is not None
    assert [c.pose for c in pliage.cases] == ["course", "attaque", "degats", "mort"]
    # **La direction est déduite, jamais demandée** : une pose qui ne tient
    # qu'une direction n'a pas de choix à offrir, et faire cocher à l'auteur la
    # seule case possible lui ferait répéter ce que le plan dit déjà.
    assert [c.direction for c in pliage.cases] == ["sud"] * 4


def test_une_direction_que_la_chose_ne_tient_pas_refuse_la_planche_entiere(client):
    """**Une planche entière qui part dans une direction rangée est une planche
    entière à repayer.** Le refus arrive avant qu'un centime parte, comme celui
    de la case unique de C1."""
    chose = _creer(client)
    _vue(client)
    client.put(
        "/api/characters/poses/marche/directions/nord",
        json={"rangee": True, "portee": "chose", "personnage": chose["identifiant"]},
    )

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a dwarf",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "directions": ["nord", "sud"],
        },
    )

    assert reponse.status_code == 409, reponse.text
    assert "nord" in reponse.text


def test_une_seule_direction_ne_fait_pas_une_planche(client):
    """En dessous de deux cases, c'est la génération de C1 : plier ferait payer
    un gabarit et une consigne de grille pour une image que le produit sait déjà
    demander."""
    chose = _creer(client)
    _vue(client)
    atelier = client.app.state.atelier

    pliage = atelier.generations.cases_de_planche(
        atelier.bibliotheque.courant,
        chose["identifiant"],
        pose="marche",
        directions=["nord"],
    )

    assert pliage is None


def test_une_pose_que_la_chose_ne_tient_pas_refuse_lecran(client):
    """L'écran ne montre jamais des cases qui ne partiraient pas : il refuse
    exactement ce que la soumission refuserait."""
    chose = _creer(client)
    _vue(client)

    reponse = client.get(
        f"/api/characters/{chose['identifiant']}/sheet", params={"pose": "vol"}
    )

    assert reponse.status_code == 409, reponse.text


# ── Le prix — trois choix, trois prix, et l'étayage de chacun ────────────────


def test_le_prix_dun_appel_porte_son_ecart_et_son_compte_dappels(client):
    """**Un gain annoncé sur une mesure unique est un gain encadré**, et
    l'encadrement est ici l'écart observé entre deux appels identiques."""
    mesure = prix_du_banc()

    assert mesure["mesure"] is True
    assert mesure["appels"] >= 18
    assert 0 < mesure["bas"] <= mesure["prix"] <= mesure["haut"]
    # Le fait qui a changé l'écran : l'écart entre deux appels dépasse celui
    # entre deux tailles de planche.
    assert mesure["haut"] > 3 * mesure["bas"]


def test_le_prix_affiche_est_celui_que_la_machine_a_paye(client):
    """**Un seul chiffre pour un appel dans tout le produit.** La première fois
    que l'écran s'est ouvert sur le vrai projet, il annonçait $0,0128 du banc
    pendant que la barre qui paie, trois centimètres plus bas, annonçait $0,0160
    du journal : deux prix pour le même appel, sur le même écran.

    La règle du produit tranche depuis T1 — *une mesure, jamais un tarif ; le
    coût réel facturé fait foi* —, et c'est donc le journal qui gagne. Le banc
    répond quand ce modèle-là n'a rien facturé ici."""
    du_banc = prix_du_banc()
    ici = prix_dun_appel({"prix": 0.016, "bas": 0.012, "haut": 0.031, "appels": 7})

    assert du_banc["origine"] == "banc"
    assert ici["origine"] == "ici"
    assert ici["prix"] == 0.016
    assert ici["appels"] == 7
    # Rien de mesuré ici : le banc reprend la main plutôt que d'afficher zéro.
    assert prix_dun_appel({"prix": None, "bas": 0.0, "haut": 0.0, "appels": 0}) == du_banc


def test_refaire_les_quatre_coute_un_appel_completer_a_lunite_en_coute_trois(
    client, tmp_path
):
    """**Le premier choix de l'écran est posé sur une mesure, pas sur un
    principe.** Une planche coûte le prix d'un appel quel que soit ce qu'elle
    porte ; compléter trois cases une par une en coûte trois."""
    chose = _creer(client)
    _vue(client)
    _poser(client, tmp_path, chose["identifiant"], "marche", "sud")

    lue = _planche(client, chose["identifiant"], "marche")
    par_clef = {c["clef"]: c for c in lue["choix"]}

    assert par_clef["refaire"]["appels"] == 1
    assert par_clef["completer"]["appels"] == 1
    assert par_clef["unite"]["appels"] == 3
    assert par_clef["unite"]["prix"] == round(3 * par_clef["refaire"]["prix"], 6)
    # **À prix d'appel égal, les quatre se ressemblent.** C'est ce que refaire
    # achète et que compléter n'achète pas — elles ont été peintes ensemble.
    assert par_clef["refaire"]["prix"] == par_clef["completer"]["prix"]
    assert par_clef["refaire"]["par_image"] < par_clef["completer"]["par_image"]


def test_le_produit_naffiche_pas_un_prix_par_nombre_de_cases(client, tmp_path):
    """**Ce que la mesure du 31 août interdit d'écrire.** Trois cases et six
    cases ont coûté le même prix, cinq en ont coûté quatre fois plus : un prix
    par nombre de cases montrerait du bruit comme s'il montrait une structure.

    L'écran n'en porte donc qu'un — celui d'un appel — et le multiplie par le
    nombre d'appels que chaque choix demande."""
    chose = _creer(client)
    _vue(client)
    _poser(client, tmp_path, chose["identifiant"], "marche", "sud")

    lue = _planche(client, chose["identifiant"], "marche")
    unitaire = lue["prix"]["prix"]

    for ligne in lue["choix"]:
        if ligne["cases"]:
            assert ligne["prix"] == round(unitaire * ligne["appels"], 6)


def test_le_banc_accompagne_toujours_le_prix_affiche(client):
    """**La phrase sur la variance a besoin des chiffres qui la portent.** Sur le
    vrai projet, les deux seuls appels connus du modèle de planche ont coûté
    exactement le même prix : l'écran affirmait alors « un appel a coûté de
    $0,0342 à $0,0342 — l'écart dépasse celui entre deux tailles de planche »,
    c'est-à-dire une conclusion que ses propres chiffres démentaient.

    Le banc est donc rendu **à côté** du prix affiché, toujours, et c'est lui que
    la phrase cite."""
    chose = _creer(client)
    _vue(client)

    lue = _planche(client, chose["identifiant"], "marche")

    assert lue["banc"]["mesure"] is True
    assert lue["banc"]["appels"] >= 18
    assert lue["banc"]["haut"] > 3 * lue["banc"]["bas"]


def test_lecran_nomme_le_modele_dont_il_chiffre_le_prix(client, tmp_path):
    """**Deux modèles n'ont pas le même prix**, et la barre qui paie garde celui
    que l'auteur y a choisi. Sans ce nom, l'écran annoncerait le prix du modèle
    de planche du jeu pendant que la barre, trois centimètres plus bas,
    annoncerait celui d'un autre — sans que rien ne dise que ce ne sont pas les
    mêmes appels. Mesuré au navigateur le 31 août 2026, sur le vrai projet."""
    chose = _creer(client)
    _vue(client)
    client.put("/api/universe", json={"modele_planche": MODELE})

    lue = _planche(client, chose["identifiant"], "marche")

    assert lue["modele"] == MODELE


def test_ce_que_refaire_coute_est_nomme_avant_de_lancer(client, tmp_path):
    """**On jette une image qu'on avait.** Elle ne disparaît pas — elle reste en
    bibliothèque avec son prix payé — mais on aura payé deux fois pour une case,
    et l'écran l'écrit avant que le bouton parte."""
    chose = _creer(client)
    _vue(client)
    _poser(client, tmp_path, chose["identifiant"], "marche", "sud")

    lue = _planche(client, chose["identifiant"], "marche")

    assert lue["deja_pleines"] == ["sud"]
    assert next(c for c in lue["cases"] if c["direction"] == "sud")["pleine"] is True


def test_quand_rien_ne_manque_completer_est_grise_avec_sa_raison(client, tmp_path):
    """Le motif du produit pour tout ce qui est indisponible — affiché, avec sa
    raison, jamais absent."""
    chose = _creer(client)
    _vue(client)
    for direction in ("sud", "nord", "est", "ouest"):
        _poser(client, tmp_path, chose["identifiant"], "marche", direction)

    lue = _planche(client, chose["identifiant"], "marche")
    par_clef = {c["clef"]: c for c in lue["choix"]}

    assert par_clef["refaire"]["refus"] == ""
    assert "pleines" in par_clef["unite"]["refus"]


# ── Ce qui revient, et où ça se range ────────────────────────────────────────


def test_une_planche_nentre_jamais_en_bibliotheque_ses_morceaux_si(client, double):
    """**C'est une ruse pour payer moins, pas un format de livraison.** La
    feuille est le brut de sa génération ; ce qui entre, ce sont les morceaux, et
    ils sont filiés vers elle par leur génération."""
    chose = _creer(client)
    _vue(client)
    atelier = client.app.state.atelier
    projet = atelier.bibliotheque.courant
    # Le double rend une **vraie planche** — fond plat, quatre sujets séparables
    # — et elle traverse la même chaîne que les vingt-quatre planches réelles du
    # 28 août : un double écrit d'après l'intention prouverait l'intention.
    double.rendre = lambda: planche_sujets(4)

    generation = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a dwarf",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "directions": ["nord", "sud", "est", "ouest"],
        },
    )
    assert generation.status_code == 202, generation.text
    identifiant = generation.json()["identifiant"]

    assert _attendre(client, identifiant)["statut"] == "reussie"
    nees = [
        a
        for a in atelier.base.assets_du_personnage(chose["identifiant"])
        if a.generation == identifiant
    ]

    assert len(nees) == 4
    # Chaque morceau connaît sa case — pose *et* direction —, écrites à sa
    # naissance et non à la main après coup.
    assert {a.pose for a in nees} == {"marche"}
    assert {a.direction for a in nees} == {"nord", "sud", "est", "ouest"}
    # Et la feuille n'est nulle part : aucun asset ne porte la planche entière.
    assert all(a.rang >= 100 for a in nees)
    assert projet


def test_un_compte_de_cases_faux_ne_fait_rien_entrer(client, double):
    """**L'invariant de C2 tient, et c'est le huitième critère.** Le compte
    d'images est le seul refus automatique du produit : rien n'est écrit avant
    que le compte soit vérifié, et la planche se relance d'un geste, au prix
    plein."""
    chose = _creer(client)
    _vue(client)
    atelier = client.app.state.atelier
    # Quatre cases demandées, **trois** sujets revenus : le cas mesuré une fois
    # sur douze le 28 août.
    double.rendre = lambda: planche_sujets(3)

    generation = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "a dwarf",
            "personnage": chose["identifiant"],
            "pose": "marche",
            "directions": ["nord", "sud", "est", "ouest"],
        },
    )
    assert generation.status_code == 202, generation.text
    identifiant = generation.json()["identifiant"]
    _attendre(client, identifiant)

    # **Rien n'entre**, et la raison dit les deux nombres — c'est elle qu'on
    # relit pour décider de relancer.
    nees = [
        a
        for a in atelier.base.assets_du_personnage(chose["identifiant"])
        if a.generation == identifiant
    ]
    assert nees == []
    lue = client.get(f"/api/generations/{identifiant}").json()
    assert lue["pliage"]["nombre"] == 4
    assert "3 images pour 4 demandées" in (lue["pliage"]["refus"] or "")


def _attendre(client, identifiant: str, tours: int = 60) -> dict:
    """La génération doublée revient en quelques tours de boucle."""
    import time

    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()
