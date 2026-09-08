# -*- coding: utf-8 -*-
"""Les critères d'acceptation de B9.1 — le compte groupé par sujet.

**Planche** : `docs/pistes-2026-09-04/carnet/Famille.dc.html`.

La grille d'une famille montre deux cents cartes, et chacune porte un petit
« 4 poses sur 6 ». Le produit savait déjà répondre à cette question — c'est
`ServiceProduction.cases` —, mais **une fois par sujet, avec un aller-retour
SQL chacun**. `bilan_du_jeu` (B5) l'appelle déjà en boucle et le dit lui-même.
B9.1 remplace la boucle par deux requêtes groupées, et rien d'autre.

**Ce qui se vérifie ici tient en une phrase** : *le compte groupé dit exactement
ce que la matrice dit, sujet par sujet, cas par cas*. C'est le seul critère qui
compte, parce que le danger du morceau n'est pas la lenteur — c'est la
divergence. Réécrire la complétude en SQL aurait dupliqué une règle métier qui
vit sur `Personnage` (`tenues`, `directions_tenues`) et sur `Pose` (`images`),
et la copie aurait vieilli en silence : rien ne casse quand deux écrans
affichent deux chiffres différents, on ne le remarque que des mois plus tard.
Chaque essai de la première section confronte donc les deux chemins sur un cas
que seule la règle métier sait trancher — une pose écartée, une pose ajoutée
pour ce sujet-là, un angle rangé, un calque, une image supprimée.

Les deux autres sections vérifient ce que le compte groupé ajoute en propre :
le piège d'homonymie de B8 — un identifiant de sujet n'est unique **que par
jeu** —, et la promesse de la tranche, *ça ne ralentit pas quand il y a plus de
sujets*, mesurée en allers-retours et non en secondes.

Aucun essai ne coûte un centime : les images sont importées, jamais générées.
"""

from __future__ import annotations

import itertools
from dataclasses import replace

from tests.conftest import image_sujet

from atelier.domaine.asset import Asset
from atelier.domaine.bande import Bande, Cadre, Prise

_DISTINCTES = itertools.count(3)


# ── Le montage : un jeu, des sujets, des images posées dans leurs cases ──────


def _creer(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom, "description": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _plan(client) -> list[str]:
    return [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]


def _poser(client, tmp_path, personnage: str, pose: str, direction: str = "") -> dict:
    """Une image importée, rangée dans une case — le geste de `test_e10`.

    Importée et non générée : ce qui se mesure est ce que le compte fait d'une
    image posée, pas la chaîne qui la fabrique.
    """
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


def _poser_une_bande(atelier, personnage: str, pose: str, direction: str = "") -> Bande:
    """Une bande gardée, telle qu'un montage l'aurait laissée — le geste de
    `test_a12`, écrit dans le dépôt plutôt que produit par le découpage."""
    bande = Bande(
        identifiant=f"bande-{next(_DISTINCTES)}",
        clip="clip-paye",
        nom="marche",
        prises=tuple(Prise(numero=n) for n in (0, 2, 4, 6)),
        cadence=8.0,
        cadre=Cadre(gauche=0, sommet=0, droite=23, bas=23),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction or None,
        case_largeur=24,
        case_hauteur=24,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _compte(atelier, personnage: str) -> dict:
    """Le compte groupé, pour ce sujet-là, par le chemin de la grille."""
    projet = atelier.bibliotheque.courant
    sujets = atelier.production.personnages(projet)
    return atelier.production.comptes(projet, sujets)[personnage]


def _par_la_matrice(atelier, personnage: str) -> dict:
    """Le même compte, refait à la main **par l'autre chemin** — `cases`.

    C'est la référence de tous les essais qui suivent : ce que l'écran d'un
    sujet montre depuis E10 et A12, résumé en chiffres. Écrit ici plutôt
    qu'appelé sur le service exprès — s'il appelait `comptes`, il ne
    prouverait rien.
    """
    projet = atelier.bibliotheque.courant
    vise = atelier.production.personnage(projet, personnage)
    cases = atelier.production.cases(projet, vise)
    fait = attendu = anime_fait = anime_attendu = poses_faites = 0
    for case in cases:
        demandees = int(case["demandees"])
        sienne = min(len(case["images"]), demandees)
        fait += sienne
        attendu += demandees
        anime_fait += min(len(case["bandes"]), int(case["bandes_demandees"]))
        anime_attendu += int(case["bandes_demandees"])
        if sienne >= demandees:
            poses_faites += 1
    return {
        "poses": {"fait": poses_faites, "attendu": len(cases)},
        "images": {"fait": fait, "attendu": attendu},
        "bandes": {"fait": anime_fait, "attendu": anime_attendu},
        "complet": fait >= attendu,
    }


def _les_deux_disent_pareil(atelier, personnage: str) -> dict:
    """Les deux chemins confrontés, et le compte rendu pour être relu ensuite."""
    groupe = _compte(atelier, personnage)
    assert groupe == _par_la_matrice(atelier, personnage), (
        "le compte groupé et la matrice ne disent plus la même chose : "
        "une règle de complétude a été recopiée quelque part"
    )
    return groupe


# ── Le compte groupé dit ce que la matrice dit ───────────────────────────────


def test_un_sujet_neuf_ne_doit_rien_et_n_a_rien_fait(client, atelier):
    """Le cas de départ, et il n'est pas vide : un sujet neuf tient déjà les
    poses du plan du jeu, et n'en a rempli aucune."""
    pelerin = _creer(client)

    compte = _les_deux_disent_pareil(atelier, pelerin)

    assert compte["poses"]["attendu"] == len(_plan(client))
    assert compte["poses"]["fait"] == 0
    assert compte["images"]["fait"] == 0
    assert compte["images"]["attendu"] > 0
    assert compte["complet"] is False


def test_une_pose_remplie_compte_pour_une_pose_faite(client, atelier, tmp_path):
    """Le compte de la carte : *une pose sur six*. Et il se lit sur les images,
    jamais sur un état gardé à côté — c'est l'invariant de la matrice."""
    pelerin = _creer(client)
    plan = _plan(client)
    _poser(client, tmp_path, pelerin, plan[0])

    compte = _les_deux_disent_pareil(atelier, pelerin)

    assert compte["poses"] == {"fait": 1, "attendu": len(plan)}
    assert compte["images"]["fait"] == 1


def test_une_pose_ecartee_sort_du_denominateur(client, atelier, tmp_path):
    """**La règle qui ne devait pas être réécrite en SQL.** Ce sujet-là écarte
    des poses ; `Personnage.tenues` le sait, et le compte groupé passe par lui.

    Une requête qui aurait compté les poses du plan aurait dit la même chose
    ici tant qu'aucun sujet n'écarte rien — et se serait mise à mentir au
    premier qui le fait, sans qu'aucun essai d'avant ne tombe.
    """
    pelerin = _creer(client)
    plan = _plan(client)
    _poser(client, tmp_path, pelerin, plan[0])
    assert _compte(atelier, pelerin)["complet"] is False

    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["poses"] == {"fait": 1, "attendu": 1}
    assert compte["complet"] is True


def test_une_pose_ajoutee_pour_ce_sujet_la_entre_dans_le_denominateur(
    client, atelier, tmp_path
):
    """L'autre moitié de E9 : la chose complète la liste de son type, et elle
    seule. La case neuve doit paraître dans le compte de ce sujet-ci sans
    paraître dans celui du voisin."""
    pelerin = _creer(client)
    heron = _creer(client, "Le héron")
    plan = _plan(client)
    for pose in plan:
        _poser(client, tmp_path, pelerin, pose)
    assert _les_deux_disent_pareil(atelier, pelerin)["complet"] is True

    reponse = client.put(f"/api/characters/{pelerin}", json={"ajouter": "en prière"})
    assert reponse.status_code == 200, reponse.text

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["poses"]["attendu"] == len(plan) + 1
    assert compte["complet"] is False
    # Et le voisin n'a rien vu paraître.
    assert _les_deux_disent_pareil(atelier, heron)["poses"]["attendu"] == len(plan)


def test_les_directions_multiplient_ce_qui_est_attendu_et_un_angle_range_le_reduit(
    client, atelier, tmp_path
):
    """**La formule de E10, lue et non recopiée** : une pose réclame *tant
    d'images dans tant de directions*. C'est `reclame`, appelée par la matrice
    et par le compte groupé — deux copies auraient divergé au premier angle
    rangé.
    """
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})

    quatre_angles = _les_deux_disent_pareil(atelier, pelerin)
    _poser(client, tmp_path, pelerin, plan[0], "sud")
    _poser(client, tmp_path, pelerin, plan[0], "nord")
    partiel = _les_deux_disent_pareil(atelier, pelerin)
    assert partiel["images"]["attendu"] == quatre_angles["images"]["attendu"]
    assert partiel["complet"] is False

    # Ce sujet-ci ne tient plus que deux angles pour cette pose-là : ce qu'il
    # a déjà fait suffit, et rien n'a été fabriqué entre-temps.
    for angle in ("est", "ouest"):
        reponse = client.put(
            f"/api/characters/poses/{plan[0]}/directions/{angle}",
            json={"rangee": True, "personnage": pelerin},
        )
        assert reponse.status_code == 200, reponse.text
        assert reponse.json()["portee"] == "ici"

    reduit = _les_deux_disent_pareil(atelier, pelerin)
    assert reduit["images"]["attendu"] < partiel["images"]["attendu"]
    assert reduit["complet"] is True


def test_un_calque_ne_remplit_pas_la_case_d_un_corps(client, atelier, tmp_path):
    """**La ligne de partage de C3, tenue par `piece IS NULL`.**

    Une image qui porte une pièce remplit la case de sa colonne d'équipement,
    pas celle de sa pose. Sans ce filtre, un casque posé sur six poses ferait
    paraître six corps qui n'existent pas, et un sujet dont on n'a jamais
    dessiné le corps se dirait complet.
    """
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    pose_l = _poser(client, tmp_path, pelerin, plan[0])

    # La même image, mais devenue un calque : c'est un casque, pas un corps.
    asset = atelier.base.lire_asset(pose_l["identifiant"])
    atelier.assets.sauver(replace(asset, piece="casque"))

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["images"]["fait"] == 0
    assert compte["poses"]["fait"] == 0
    assert compte["complet"] is False


def test_une_image_supprimee_vide_sa_case_toute_seule(client, atelier, tmp_path):
    """L'invariant de la matrice, vérifié sur l'autre chemin : *une case est
    pleine parce qu'une image la porte*. Rien n'est à défaire."""
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    pose_l = _poser(client, tmp_path, pelerin, plan[0])
    assert _les_deux_disent_pareil(atelier, pelerin)["complet"] is True

    reponse = client.post(
        "/api/assets/delete", json={"identifiants": [pose_l["identifiant"]]}
    )
    assert reponse.status_code == 200, reponse.text

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["images"]["fait"] == 0
    assert compte["complet"] is False


def test_dix_images_dans_une_case_qui_en_reclame_une_ne_font_pas_mille_pour_cent(
    client, atelier, tmp_path
):
    """Le plafond du tableau de bord, repris tel quel : les variantes en trop
    ne sont pas de l'avance, ce sont des images que personne n'a départagées."""
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    for _ in range(5):
        _poser(client, tmp_path, pelerin, plan[0])

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["images"]["fait"] == compte["images"]["attendu"]


# ── Les deux calques ne se mêlent pas (A12) ──────────────────────────────────


def test_une_bande_ne_remplit_pas_la_case_d_une_image_et_reciproquement(
    client, atelier, tmp_path
):
    """`AGENTS.md` 8quater, sur le chemin du compte groupé.

    Une case qui porterait les deux serait pleine dès qu'elle a l'une des deux,
    et une animation manquante se cacherait derrière une image présente — très
    exactement ce que l'auteur veut voir. Deux totaux gardent l'invariant
    intact au lieu de le tordre.
    """
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    _poser_une_bande(atelier, pelerin, plan[0])

    anime_seul = _les_deux_disent_pareil(atelier, pelerin)
    assert anime_seul["bandes"] == {"fait": 1, "attendu": 1}
    # L'animation ne remplit rien du côté dessiné.
    assert anime_seul["images"]["fait"] == 0

    _poser(client, tmp_path, pelerin, plan[0])

    les_deux = _les_deux_disent_pareil(atelier, pelerin)
    assert les_deux["images"]["fait"] == les_deux["images"]["attendu"]
    # Et l'image n'a rien rempli du côté animé.
    assert les_deux["bandes"] == {"fait": 1, "attendu": 1}


def test_complet_ne_regarde_que_les_images_et_le_calque_anime_se_lit_a_cote(
    client, atelier, tmp_path
):
    """**Le piège du filtre « incomplets » (B9.6), fermé ici.**

    Toute pose réclame au moins une animation par direction. Si `complet` les
    comptait, un jeu qui n'anime rien serait incomplet en entier, et le filtre
    ne trierait plus rien. C'est aussi le calque que `bilan_du_jeu` compte
    depuis B5 : deux écrans qui disent « complet » doivent dire la même chose.

    Le calque animé n'est pas caché pour autant — il est rendu entier, à côté,
    et une carte peut le montrer.
    """
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    _poser(client, tmp_path, pelerin, plan[0])

    compte = _les_deux_disent_pareil(atelier, pelerin)
    assert compte["complet"] is True
    assert compte["bandes"] == {"fait": 0, "attendu": 1}


def test_un_sujet_qui_ne_reclame_rien_est_complet_jamais_en_retard(client, atelier):
    """Même garde que la barre à `None` du tableau de bord (E2) : *rien ne
    manque* n'est pas *tout manque*. Un décor sans pose n'a rien à faire dans
    une liste de choses à finir."""
    tuile = _creer(client, "La tuile d'eau")
    client.put(f"/api/characters/{tuile}", json={"poses": []})

    compte = _les_deux_disent_pareil(atelier, tuile)
    assert compte["poses"] == {"fait": 0, "attendu": 0}
    assert compte["images"] == {"fait": 0, "attendu": 0}
    assert compte["complet"] is True


# ── Le piège de B8 : un identifiant de sujet n'est unique que par jeu ────────


def test_l_homonyme_d_un_autre_jeu_ne_gonfle_pas_le_compte(client, atelier, tmp_path):
    """**Le piège nommé en B8, repayé ici.** Deux jeux peuvent nommer leur
    sujet pareil. Un `GROUP BY personnage` sans le jeu additionnerait les images
    du `pelerin` des Salines dans le compte de celui du Marais — et le premier
    dirait « complet » sans qu'une seule de ses cases soit remplie.
    """
    marais = client.post("/api/projects", json={"nom": "Le marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les salines"}).json()["projet"]

    client.put("/api/projects/current", json={"projet":salines["identifiant"]})
    chez_salines = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{chez_salines}", json={"poses": [plan[0]]})
    _poser(client, tmp_path, chez_salines, plan[0])

    client.put("/api/projects/current", json={"projet":marais["identifiant"]})
    chez_marais = _creer(client)
    assert chez_marais == chez_salines, "les deux jeux doivent nommer leur sujet pareil"
    client.put(f"/api/characters/{chez_marais}", json={"poses": [plan[0]]})

    compte = _les_deux_disent_pareil(atelier, chez_marais)
    assert compte["images"]["fait"] == 0
    assert compte["complet"] is False


# ── Ce que le morceau achète : deux requêtes, pas deux par sujet ─────────────


def test_le_compte_ne_coute_pas_plus_cher_a_douze_sujets_qu_a_deux(
    client, atelier, tmp_path, monkeypatch
):
    """**La promesse de la tranche, mesurée en allers-retours.**

    Pas en secondes : une mesure de temps sur douze sujets dirait « c'est
    rapide » d'une boucle qui ne l'est pas, et le disque de l'auteur n'en porte
    aujourd'hui que douze — c'est exactement le cas où une mesure trop large ne
    sépare rien (`AGENTS.md` 8sexies). Ce qui se compte est donc **le nombre
    d'ouvertures de la base**, et ce qu'on vérifie est qu'il ne bouge pas quand
    le nombre de sujets sextuple.

    ⚠️ Le mémo du projet compte autant que les requêtes groupées : sans lui,
    `plan_de` relit le jeu une fois par sujet et cet essai tombe — c'est le
    défaut mesuré en M3, rejoué par la grille.
    """
    plan = _plan(client)
    sujets = [_creer(client, f"Sujet {n}") for n in range(12)]
    for pose in plan[:2]:
        _poser(client, tmp_path, sujets[0], pose)

    projet = atelier.bibliotheque.courant
    tous = atelier.production.personnages(projet)
    assert len(tous) == 12

    ouvertures = _compter_les_ouvertures(atelier, monkeypatch)

    ouvertures.clear()
    atelier.production.comptes(projet, tous[:2])
    a_deux = len(ouvertures)

    ouvertures.clear()
    atelier.production.comptes(projet, tous)
    a_douze = len(ouvertures)

    assert a_deux == a_douze, (
        f"{a_deux} ouvertures pour deux sujets, {a_douze} pour douze : "
        "le compte n'est plus groupé"
    )
    # Et il en faut peu : les deux requêtes groupées, et le jeu lu une fois.
    assert a_douze <= 4, f"{a_douze} ouvertures pour un seul compte groupé"


def _compter_les_ouvertures(atelier, monkeypatch) -> list[str]:
    """Chaque ouverture de connexion, notée au passage.

    C'est la mesure la plus proche de ce qui coûte : le dépôt ouvre et referme
    une connexion **par opération** depuis T3 — c'est ce qui permet d'effacer
    l'index sous Windows —, donc une opération vaut une ouverture.
    """
    ouvertures: list[str] = []
    vraie = atelier.base._connexion

    def notee():
        ouvertures.append("x")
        return vraie()

    monkeypatch.setattr(atelier.base, "_connexion", notee)
    return ouvertures


# ── L'index jeté et refait (`AGENTS.md` 8septies) ────────────────────────────


def test_les_colonnes_neuves_se_retrouvent_apres_un_index_jete(
    client, atelier, tmp_path
):
    """**Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas
    fini.** Le compte groupé lit deux colonnes qui n'existaient pas avant B9.1 :
    la pose et la pièce d'une image. Elles doublent le fichier, comme le sujet
    et le favori le font depuis T3, et elles doivent donc revenir seules quand
    l'index est effacé et refait depuis `donnees/`.

    Un essai qui se contenterait de compter juste après l'import ne verrait
    rien : il vérifierait ce qu'il vient d'écrire.
    """
    pelerin = _creer(client)
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": plan[:2]})
    _poser(client, tmp_path, pelerin, plan[0])
    avant = _les_deux_disent_pareil(atelier, pelerin)
    assert avant["images"]["fait"] == 1

    # L'index est jeté et reconstruit des fichiers — le geste de T3, sans
    # conséquence par construction.
    atelier.bibliotheque.reconstruire()

    apres = _les_deux_disent_pareil(atelier, pelerin)
    assert apres == avant


# ── B9.2 · La route qui sert une famille, paginée ────────────────────────────
#
# **Ce qui se vérifie ici est différent de la section précédente.** B9.1
# confrontait deux chemins qui répondent à la même question ; B9.2 est un
# assemblage — pagination, filtre de famille en mémoire, et jointure des
# collections — sur des briques déjà vérifiées ailleurs. Les essais portent
# donc sur *l'assemblage lui-même* : la famille se filtre avant de paginer et
# non après, le total compte toute la famille et pas seulement la page, et
# chaque sujet porte son compte et ses collections dans la même réponse.


def _famille(client, famille: str = "personnages", **filtres) -> dict:
    reponse = client.get(f"/api/characters/families/{famille}", params=filtres)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_une_famille_vide_rend_une_page_vide_et_un_total_a_zero(client):
    """Aucune erreur sur une famille inconnue ou vide — même garde que pour
    une collection ou un projet sans membre : un compte à zéro n'est pas un
    refus."""
    page = _famille(client, "decors")
    assert page == {
        "personnages": [],
        "groupes": [],
        "filtres": {"tous": 0, "incomplets": 0, "sans-description": 0},
        "total": 0,
    }


def test_chaque_sujet_de_la_page_porte_son_compte_et_ses_collections(
    client, atelier, tmp_path
):
    """**Ce que B9.2 et B9.3 ajoutent au-dessus de B9.1** : le compte de
    complétude et les collections voyagent dans la même carte, sans second
    aller-retour côté écran."""
    pelerin = _creer(client, "Le pèlerin")
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": [plan[0]]})
    _poser(client, tmp_path, pelerin, plan[0])
    heros = client.post("/api/collections", json={"nom": "Les héros"}).json()[
        "collection"
    ]["identifiant"]
    client.put(
        f"/api/collections/{heros}/members",
        json={"jeu": atelier.bibliotheque.courant, "sujet": pelerin},
    )

    page = _famille(client)
    carte = next(p for p in page["personnages"] if p["identifiant"] == pelerin)

    assert {c: v for c, v in carte["compte"].items() if c != "detail"} == _compte(
        atelier, pelerin
    )
    assert carte["collections"] == [{"identifiant": heros, "nom": "Les héros"}]
    # Et la vignette que la carte dessinera, dans le même aller-retour.
    assert carte["vignette"]["identifiant"]


def test_le_decoupage_pose_par_pose_dit_laquelle_manque(client, tmp_path):
    """**La vue *Les poses* montre une colonne par pose**, et doit donc savoir
    *laquelle* manque, pas seulement combien. Le découpage sort de la même
    boucle que le total : les deux ne peuvent pas se contredire.
    """
    pelerin = _creer(client, "Le pèlerin")
    plan = _plan(client)
    client.put(f"/api/characters/{pelerin}", json={"poses": plan[:2]})
    _poser(client, tmp_path, pelerin, plan[0])

    compte = _famille(client)["personnages"][0]["compte"]
    detail = compte["detail"]

    assert [d["identifiant"] for d in detail] == plan[:2]
    assert detail[0]["fait"] == detail[0]["attendu"]
    assert detail[1]["fait"] == 0
    # Le total n'est pas un second calcul : c'est la somme de ce découpage-là.
    assert sum(d["fait"] for d in detail) == compte["images"]["fait"]
    assert sum(d["attendu"] for d in detail) == compte["images"]["attendu"]
    assert sum(1 for d in detail if d["fait"] >= d["attendu"]) == compte["poses"]["fait"]


def test_la_grille_se_restreint_a_une_collection_et_ses_comptes_suivent(
    client, atelier
):
    """**La ligne qu'on ouvre sous une famille, dans le carnet.** Le groupe
    restreint la grille, et les trois comptes de filtre portent alors sur lui —
    sinon « Incomplets 31 » resterait affiché au-dessus d'une collection qui
    n'en contient qu'un."""
    jeu = atelier.bibliotheque.courant
    dedans = _creer(client, "Le boss")
    _creer(client, "Le passant")
    boss = client.post("/api/collections", json={"nom": "Les boss"}).json()[
        "collection"
    ]["identifiant"]
    client.put(f"/api/collections/{boss}/members", json={"jeu": jeu, "sujet": dedans})

    assert _famille(client)["total"] == 2

    page = _famille(client, collection=boss)
    assert [p["identifiant"] for p in page["personnages"]] == [dedans]
    assert page["total"] == 1
    assert page["filtres"] == {"tous": 1, "incomplets": 1, "sans-description": 0}


def test_une_collection_supprimee_vide_la_grille_plutot_que_de_la_casser(client):
    """Un groupe qui disparaît pendant qu'on le regarde ne doit pas rendre un
    refus : la grille se vide, et la ligne du carnet est partie avec lui."""
    _creer(client, "Le pèlerin")
    page = _famille(client, collection="ce-groupe-n-existe-plus")
    assert page["personnages"] == []
    assert page["total"] == 0


def test_le_groupe_d_un_autre_jeu_ne_ramene_pas_ses_sujets(client):
    """**Le piège de B8, une quatrième fois.** Une collection mêle les sujets de
    plusieurs jeux ; restreindre la grille par elle doit ne garder que ceux de ce
    jeu-ci, sinon la grille du Marais montrerait un sujet des Salines — ou, plus
    sournois, un sujet du Marais qui porte le même identifiant."""
    marais = client.post("/api/projects", json={"nom": "Le marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les salines"}).json()[
        "projet"
    ]
    partagee = client.post("/api/collections", json={"nom": "Les boss"}).json()[
        "collection"
    ]["identifiant"]

    client.put("/api/projects/current", json={"projet": salines["identifiant"]})
    ailleurs = _creer(client, "Le boss des salines")
    client.put(
        f"/api/collections/{partagee}/members",
        json={"jeu": salines["identifiant"], "sujet": ailleurs},
    )

    client.put("/api/projects/current", json={"projet": marais["identifiant"]})
    _creer(client, "Le boss du marais")

    page = _famille(client, collection=partagee, projet=marais["identifiant"])
    assert page["personnages"] == []


def test_un_sujet_sans_image_porte_une_vignette_nulle_pas_une_clef_absente(client):
    """**Aucune image n'est un état normal**, pas une donnée manquante : la
    carte doit pouvoir dessiner son cadre vide sans confondre ce cas avec un
    serveur plus vieux qui n'enverrait pas le champ."""
    _creer(client, "Le pèlerin")
    carte = _famille(client)["personnages"][0]
    assert "vignette" in carte
    assert carte["vignette"] is None


def test_la_vignette_est_la_plus_fraiche_et_jamais_une_piece(
    client, atelier, tmp_path
):
    """**C'est la dernière image faite qui représente son sujet** — la même
    règle que `assets_du_personnage` applique déjà à la matrice.

    Et jamais une pièce d'équipement : un casque n'est pas le portrait de celui
    qui le porte. C'est la séparation que `piece IS NULL` tient dans le compte
    des cases, tenue ici aussi.
    """
    pelerin = _creer(client, "Le pèlerin")
    plan = _plan(client)
    _poser(client, tmp_path, pelerin, plan[0])
    derniere = _poser(client, tmp_path, pelerin, plan[1])["identifiant"]

    assert _famille(client)["personnages"][0]["vignette"]["identifiant"] == derniere

    # Un calque d'équipement posé après coup — écrit dans le dépôt comme la
    # bande de `_poser_une_bande`, parce que la route qui range une image dans
    # sa case ne sait pas encore lui donner sa pièce.
    casque = Asset.depuis_json(_poser(client, tmp_path, pelerin, plan[0]))
    atelier.base.enregistrer_asset(replace(casque, piece="le-casque"))

    assert _famille(client)["personnages"][0]["vignette"]["identifiant"] == derniere


def test_un_sujet_sans_collection_porte_une_liste_vide_pas_une_absence(client):
    """La carte n'a pas à distinguer « pas de collection » de « clé absente » —
    c'est `collections_par_sujet` qui tient cette promesse."""
    _creer(client, "Le pèlerin")
    page = _famille(client)
    carte = page["personnages"][0]
    assert carte["collections"] == []


def test_le_filtre_de_famille_s_applique_avant_la_pagination_pas_apres(
    client, atelier
):
    """**Le piège nommé dans le plan** : filtrer une page déjà plafonnée
    rendrait moins de sujets que la famille n'en contient, et un total qui
    compte une autre famille par erreur. Trois personnages, un seul dans la
    famille visée, une page d'un seul rang — la famille visée doit quand même
    apparaître, jamais poussée hors de la page par les deux autres.
    """
    # « décor » est une nature du barème par défaut, dans la famille
    # `decors` — aucun réglage d'univers à toucher pour ce test.
    for nom in ("Le premier décor", "Le deuxième décor"):
        client.put(f"/api/characters/{_creer(client, nom)}", json={"type": "décor"})
    seul_personnage = _creer(client, "Le seul personnage")

    page = _famille(client, "personnages", limite=1)
    assert page["total"] == 1
    assert [p["identifiant"] for p in page["personnages"]] == [seul_personnage]


def test_la_recherche_filtre_avant_la_famille_et_le_total_la_reflete(
    client, atelier
):
    """La recherche et la famille se combinent : chercher un mot que seul un
    sujet de la famille porte ne doit remonter que lui, et le total doit dire
    un, pas le compte de tous les personnages du jeu."""
    _creer(client, "Le pèlerin discret")
    trouve = _creer(client, "Le pèlerin bavard")

    page = _famille(client, "personnages", recherche="bavard")
    assert page["total"] == 1
    assert [p["identifiant"] for p in page["personnages"]] == [trouve]


def test_le_plafond_grandit_comme_charger_la_suite_sans_perdre_le_total(client):
    """**Décision 3 de B9** : pagination façon B3, le plafond grandit d'un
    appel à l'autre, le total ne bouge pas tant que rien n'est ajouté."""
    for n in range(5):
        _creer(client, f"Sujet {n}")

    petite_page = _famille(client, limite=2)
    assert len(petite_page["personnages"]) == 2
    assert petite_page["total"] == 5

    grande_page = _famille(client, limite=10)
    assert len(grande_page["personnages"]) == 5
    assert grande_page["total"] == 5


def test_l_homonyme_d_un_autre_jeu_ne_voit_pas_ses_collections(client, atelier):
    """**Le piège de B8, rejoué sur les collections cette fois.** Un
    identifiant de sujet n'est unique que par jeu ; la jointure de B9.3 doit
    filtrer par jeu comme le compte de B9.1 le fait déjà, sans quoi le pèlerin
    du Marais verrait les collections où l'homonyme des Salines est rangé."""
    marais = client.post("/api/projects", json={"nom": "Le marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les salines"}).json()[
        "projet"
    ]

    client.put("/api/projects/current", json={"projet": salines["identifiant"]})
    chez_salines = _creer(client)
    dans_salines = client.post("/api/collections", json={"nom": "Chez les Salines"}).json()[
        "collection"
    ]["identifiant"]
    client.put(
        f"/api/collections/{dans_salines}/members",
        json={"jeu": salines["identifiant"], "sujet": chez_salines},
    )

    client.put("/api/projects/current", json={"projet": marais["identifiant"]})
    chez_marais = _creer(client)
    assert chez_marais == chez_salines

    page = _famille(client, projet=marais["identifiant"])
    carte = next(p for p in page["personnages"] if p["identifiant"] == chez_marais)
    assert carte["collections"] == []


# ── B9.5 · Les cibles du glisser-déposer, et ce qu'elles contiennent déjà ────
#
# Le « 10 + 3 » de la planche s'écrit **avant** le lâcher : la collection visée
# annonce ce qu'elle contiendra si l'on lâche ici. L'écran ne peut le calculer
# que s'il connaît les dix — et ces dix-là ne sont pas déductibles de la page,
# puisqu'une collection vide n'apparaît sur la carte d'aucun sujet.


def _groupes(page: dict) -> dict[str, int]:
    return {g["nom"]: g["sujets"] for g in page["groupes"]}


def test_une_collection_vide_est_quand_meme_une_cible_de_depot(client):
    """**Sinon la seule qu'on veut remplir est la seule qu'on ne voit pas.**

    Les collections de chaque sujet (B9.3) ne disent que les groupes *déjà
    peuplés* ; une collection qu'on vient de créer n'y figure nulle part. C'est
    pourtant elle qu'on vise en glissant, et le carnet doit la montrer.
    """
    _creer(client, "Le pèlerin")
    client.post("/api/collections", json={"nom": "Les boss"})

    assert _groupes(_famille(client)) == {"Les boss": 0}


def test_le_groupe_annonce_ce_qu_il_contient_de_ce_jeu_ci_et_pas_des_autres(
    client, atelier
):
    """**Le piège de B8, une troisième fois** — et c'est le compte affiché qui
    ment cette fois. Une collection accueille les sujets de plusieurs jeux
    (décision de l'auteur, `Collection`) ; annoncer « 10 + 3 » en comptant les
    dix de deux univers promettrait un total que le carnet ne montrerait
    jamais.
    """
    marais = client.post("/api/projects", json={"nom": "Le marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les salines"}).json()[
        "projet"
    ]
    partagee = client.post("/api/collections", json={"nom": "Les boss"}).json()[
        "collection"
    ]["identifiant"]

    client.put("/api/projects/current", json={"projet": salines["identifiant"]})
    ailleurs = _creer(client, "Le boss des salines")
    client.put(
        f"/api/collections/{partagee}/members",
        json={"jeu": salines["identifiant"], "sujet": ailleurs},
    )

    client.put("/api/projects/current", json={"projet": marais["identifiant"]})
    ici = _creer(client, "Le boss du marais")
    client.put(
        f"/api/collections/{partagee}/members",
        json={"jeu": marais["identifiant"], "sujet": ici},
    )

    assert _groupes(_famille(client, projet=marais["identifiant"])) == {"Les boss": 1}
    assert _groupes(_famille(client, projet=salines["identifiant"])) == {"Les boss": 1}
    # Et l'arbre, lui, compte bien les deux : c'est une taille de groupe pour
    # l'atelier entier, pas pour un jeu — les deux comptes coexistent.
    assert atelier.base.compter_par_collection()[partagee] == 2


def test_la_collection_d_un_autre_jeu_n_est_pas_une_cible(client):
    """La règle est celle de l'arbre de la galerie, écrite une fois : une
    collection sans jeu appartient à tous, une collection posée sur un jeu
    n'appartient qu'à lui."""
    marais = client.post("/api/projects", json={"nom": "Le marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les salines"}).json()[
        "projet"
    ]
    client.post(
        "/api/collections", json={"nom": "Chez les salines", "projet": salines["identifiant"]}
    )
    client.post("/api/collections", json={"nom": "Partout", "projet": None})

    client.put("/api/projects/current", json={"projet": marais["identifiant"]})
    _creer(client, "Le pèlerin")

    assert _groupes(_famille(client)) == {"Partout": 0}


def test_le_compte_projete_se_lit_sur_ce_que_la_route_a_deja_servi(client, atelier):
    """**Ce que l'écran fait du « 10 + 3 », vérifié ici plutôt qu'à l'écran.**

    Trois sujets choisis, dont un déjà dans le groupe visé : le projeté est
    `déjà + ceux qui n'y sont pas encore`, jamais `déjà + choisis`. Sans quoi
    lâcher deux fois de suite ferait grandir un compte que le serveur, lui, ne
    bouge plus — ranger ce qui est rangé est un geste sans effet (`Collection.avec`).
    """
    jeu = atelier.bibliotheque.courant
    boss = client.post("/api/collections", json={"nom": "Les boss"}).json()[
        "collection"
    ]["identifiant"]
    sujets = [_creer(client, f"Le boss {n}") for n in range(3)]
    client.put(
        f"/api/collections/{boss}/members", json={"jeu": jeu, "sujet": sujets[0]}
    )

    page = _famille(client)
    deja = _groupes(page)["Les boss"]
    par_sujet = {p["identifiant"]: p["collections"] for p in page["personnages"]}
    nouveaux = [
        s for s in sujets if all(c["identifiant"] != boss for c in par_sujet[s])
    ]
    assert deja == 1
    assert len(nouveaux) == 2

    for sujet in sujets:
        client.put(
            f"/api/collections/{boss}/members", json={"jeu": jeu, "sujet": sujet}
        )
    assert _groupes(_famille(client))["Les boss"] == deja + len(nouveaux)


# ── B9.6 · Les trois filtres, et leur compte ─────────────────────────────────
#
# **Le piège du morceau tient en une phrase** : la planche écrit « Incomplets 31 »
# au-dessus d'une grille qui n'en montre que trente sur cinquante-quatre. Un
# compte fait sur la page servie dirait donc trente-et-un au plus, et souvent
# moins — et l'onglet ne trierait que ce qui est déjà chargé. Les essais qui
# suivent posent tous plus de sujets que la page n'en sert, pour que la
# différence se voie.


def _remplir(client, tmp_path, personnage: str) -> None:
    """Ce sujet-là n'attend plus rien — toutes ses poses sont faites."""
    plan = _plan(client)
    client.put(f"/api/characters/{personnage}", json={"poses": [plan[0]]})
    _poser(client, tmp_path, personnage, plan[0])


def test_les_trois_comptes_portent_sur_la_famille_entiere_pas_sur_la_page(
    client, tmp_path
):
    """**Le chiffre de l'onglet compte ce qu'on ne voit pas encore.** Cinq
    sujets, une page d'un seul : les comptes doivent dire cinq et quatre, jamais
    un et un."""
    complet = _creer(client, "Le pèlerin complet")
    _remplir(client, tmp_path, complet)
    for n in range(4):
        _creer(client, f"Le sujet vide {n}")

    page = _famille(client, limite=1)
    assert len(page["personnages"]) == 1
    assert page["filtres"] == {"tous": 5, "incomplets": 4, "sans-description": 0}


def test_incomplet_est_le_complet_de_b9_1_retourne_jamais_recalcule(
    client, atelier, tmp_path
):
    """**Une seule vérité sur « complet ».** Le filtre ne compare pas `fait` à
    `attendu` de son côté : il lit le drapeau que `comptes` pose déjà, celui-là
    même que `bilan_du_jeu` compte depuis `B5`. Deux écrans qui disent
    « complet » doivent dire la même chose.
    """
    complet = _creer(client, "Le pèlerin complet")
    _remplir(client, tmp_path, complet)
    manquant = _creer(client, "Le pèlerin en retard")

    page = _famille(client, filtre="incomplets")
    assert [p["identifiant"] for p in page["personnages"]] == [manquant]
    assert _compte(atelier, complet)["complet"] is True
    assert _compte(atelier, manquant)["complet"] is False


def test_un_sujet_qui_ne_reclame_rien_n_est_jamais_incomplet(client):
    """Le corollaire de `test_un_sujet_qui_ne_reclame_rien_est_complet` : ce qui
    n'attend rien ne doit pas venir gonfler le filtre *Incomplets*, sans quoi
    l'onglet rendrait le jeu entier et ne trierait plus rien."""
    sans_pose = _creer(client, "Le sujet sans pose")
    client.put(f"/api/characters/{sans_pose}", json={"poses": []})

    page = _famille(client, filtre="incomplets")
    assert page["total"] == 0
    assert page["filtres"]["incomplets"] == 0


def test_sans_description_lit_le_champ_et_ne_confond_pas_les_blancs(client):
    """Une description faite d'espaces n'est pas une description — sinon le
    filtre laisserait passer un sujet que l'auteur n'a pas décrit."""
    decrit = client.post(
        "/api/characters", json={"nom": "Le décrit", "description": "un pèlerin"}
    ).json()["personnage"]["identifiant"]
    blanc = client.post(
        "/api/characters", json={"nom": "Le blanc", "description": "   "}
    ).json()["personnage"]["identifiant"]
    vide = client.post(
        "/api/characters", json={"nom": "Le vide", "description": ""}
    ).json()["personnage"]["identifiant"]

    page = _famille(client, filtre="sans-description")
    trouves = {p["identifiant"] for p in page["personnages"]}
    assert trouves == {blanc, vide}
    assert decrit not in trouves
    assert page["filtres"]["sans-description"] == 2


def test_le_filtre_s_applique_avant_la_pagination_comme_la_famille(
    client, tmp_path
):
    """**Le même piège que la famille, une marche plus bas.** Deux sujets
    complets créés d'abord, un incomplet ensuite, une page d'un seul rang : la
    page doit contenir l'incomplet, jamais un des deux poussés devant lui par
    l'ordre de création."""
    for nom in ("Le premier complet", "Le second complet"):
        _remplir(client, tmp_path, _creer(client, nom))
    en_retard = _creer(client, "Le troisième, en retard")

    page = _famille(client, filtre="incomplets", limite=1)
    assert page["total"] == 1
    assert [p["identifiant"] for p in page["personnages"]] == [en_retard]


def test_le_filtre_et_la_recherche_se_combinent_sans_se_manger(client, tmp_path):
    """Chercher dans les incomplets doit rendre l'intersection, et les comptes
    des trois onglets doivent alors porter sur ce que la recherche a laissé —
    sinon « Incomplets 31 » resterait affiché au-dessus d'une grille qui n'en
    montre que deux."""
    _remplir(client, tmp_path, _creer(client, "Le pèlerin bavard"))
    cherche = _creer(client, "Le pèlerin discret")
    _creer(client, "Le passeur discret")

    page = _famille(client, recherche="pèlerin", filtre="incomplets")
    assert [p["identifiant"] for p in page["personnages"]] == [cherche]
    # Deux pèlerins trouvés sur trois sujets, un seul en retard — et zéro sans
    # description, parce que `_creer` en pose une : le troisième filtre compte
    # bien sur ce que la recherche a laissé, pas sur le jeu entier.
    assert page["filtres"] == {"tous": 2, "incomplets": 1, "sans-description": 0}


def test_un_filtre_inconnu_montre_la_famille_plutot_qu_une_page_vide(client):
    """Un écran plus vieux que le serveur qui le sert ne doit pas se retrouver
    devant une grille vide sans rien pour l'expliquer — même règle que
    `famille_du_type` applique à un type que le barème ne connaît plus."""
    _creer(client, "Le pèlerin")
    assert _famille(client, filtre="ce-filtre-n-existe-pas")["total"] == 1


def test_le_compte_des_filtres_ne_coute_pas_un_aller_retour_de_plus(
    client, atelier, monkeypatch
):
    """**La promesse de `B9.1`, tenue jusqu'ici.** Compter les trois filtres sur
    la famille entière plutôt que sur la page ne doit rien coûter de plus : le
    compte groupé est déjà fait pour tout le monde, les trois sommes se font en
    mémoire dessus.

    Mesuré en allers-retours, jamais en secondes (`AGENTS.md` 8sexies) : deux
    sujets ou douze, la route doit ouvrir le même nombre de connexions.
    """
    ouvertures = 0
    vraie = atelier.base._connexion

    def compter(*args, **mots):
        nonlocal ouvertures
        ouvertures += 1
        return vraie(*args, **mots)

    for n in range(2):
        _creer(client, f"Le sujet {n}")
    monkeypatch.setattr(atelier.base, "_connexion", compter)
    _famille(client)
    a_deux = ouvertures

    monkeypatch.setattr(atelier.base, "_connexion", vraie)
    for n in range(2, 12):
        _creer(client, f"Le sujet {n}")
    ouvertures = 0
    monkeypatch.setattr(atelier.base, "_connexion", compter)
    _famille(client)

    assert ouvertures == a_deux, (
        f"{a_deux} ouvertures pour deux sujets, {ouvertures} pour douze — "
        "le compte des filtres est reparti en boucle"
    )
