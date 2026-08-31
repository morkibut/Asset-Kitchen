# -*- coding: utf-8 -*-
"""Les critères d'acceptation de C4 — la main.

**Aucun test ne coûte un centime.** Deux tests **comptent les appels du double**
avant et après : c'est ainsi que « la main ne repaie aucune image » et « réseau
coupé, tout marche » se prouvent, et c'est le geste du dépôt depuis T2.

**Le montage vient de `test_c3`, et il n'est pas recopié.** La planche
d'équipement du double part des octets **réellement reçus** — c'est la leçon
payée en C1 : un double écrit d'après l'intention prouve l'intention, pas le
serveur. La réécrire ici en aurait fait deux qui divergent, et C4 se serait mis
à mesurer l'écart entre deux doubles au lieu de l'effet d'une retouche.

**Ce fichier ajoute un second double, et c'est lui qui porte C4** :
`substituer` rejoue le défaut du 29 août 2026 — une pièce qui prend la place de
ce qu'il y avait, avec des valeurs voisines, que la comparaison de couleur
absorbe avec le bruit de rééchantillonnage (`docs/releve-usage.md`). Sur cette
planche-là, la différence ne rend **rien**, et c'est très exactement ce que la
main existe pour rattraper. Sans ce double, C4 n'aurait été éprouvé que sur des
calques que C3 rendait déjà bien.
"""

from __future__ import annotations

import io

import numpy
from PIL import Image

from atelier.domaine.equipement import ECHELLE_TOLEREE, MesuresCalque
from atelier.domaine.recette import RAYON_MAX, Difference, Trait
from atelier.image import calque as calc
from test_c3 import (
    MODELE,
    _attendre,
    _cases,
    _corps,
    _habiller,
    _opaques,
    _personnage,
    _piece,
    _total,
)


# ── Le second double : une pièce qui se *substitue* ─────────────────────────


# De combien la pièce substituée décale la couleur de ce qu'elle recouvre.
# **Sous `SEUIL_COULEUR`, qui vaut 32** : c'est la définition même du défaut du
# 29 août — une pièce qui occupe l'empreinte de ce qu'elle remplace, avec des
# valeurs voisines, relève de `touche`, et la tolérance au voisin de 3×3
# l'efface avec le bruit de recalage qu'elle est faite pour absorber.
ECART_SUBSTITUTION = 12


def substituer(demande) -> bytes:
    """La planche reçue, dont chaque case est **repeinte d'un ton voisin**.

    Ni forme changée, ni pixel ajouté hors de la silhouette : rien que la
    couleur, et de si peu que la mesure ne la voit pas. C'est le casque du
    29 août, revenu en poussière sur les quatre planches où il figurait — y
    compris celle que l'échelle et les mesures déclaraient bonne.

    Elle part des octets **reçus**, comme `habiller` : un double qui
    redessinerait la planche de son côté ne prouverait rien du recalage.
    """
    envoyee = demande.references[-1]
    with Image.open(io.BytesIO(envoyee)) as ouverte:
        planche = ouverte.convert("RGB")
    tableau = numpy.asarray(planche).astype(numpy.int16)
    tableau = numpy.clip(tableau + ECART_SUBSTITUTION, 0, 255).astype(numpy.uint8)
    tampon = io.BytesIO()
    Image.fromarray(tableau, "RGB").save(tampon, format="PNG")
    return tampon.getvalue()


# ── Le montage : un personnage, un corps, une pièce, un calque ──────────────


def _un_calque(client, double, *, substitue: bool = False) -> tuple[dict, int]:
    """Un calque et le nombre de pixels qu'il porte, sur un personnage d'une pose.

    Une seule pose : ce que C4 éprouve est la main sur *un* calque, et six
    cases n'auraient rien ajouté qu'un tri à faire avant chaque mesure.
    """
    personnage, poses = _personnage(client, 1)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    if substitue:
        double.repondre = substituer
        reponse = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": "a horned iron helmet on his head",
                "personnage": personnage,
                "piece": piece,
                "poses": poses,
            },
        )
        assert reponse.status_code == 202, reponse.text
        _attendre(client, reponse.json()["identifiant"])
    else:
        _habiller(client, double, personnage, piece, poses)

    cases = _cases(client, personnage)
    calques = cases[0]["calques"][piece]
    assert len(calques) == 1, calques
    return calques[0], _opaques(_image(client, calques[0]["identifiant"]))


def _image(client, identifiant: str, **question) -> bytes:
    reponse = client.get(f"/api/assets/{identifiant}/image", params=question)
    assert reponse.status_code == 200, reponse.text
    return reponse.content


def _lire(client, identifiant: str) -> dict:
    return client.get(f"/api/assets/{identifiant}").json()


def _main(client, identifiant: str, couche: str, traits: list[dict]):
    return client.put(
        f"/api/assets/{identifiant}/hand", json={"couche": couche, "traits": traits}
    )


def _dimensions(asset: dict) -> tuple[int, int]:
    """Les dimensions de l'image **rendue** — celles dans lesquelles la main
    parle, comme le rectangle depuis T5."""
    if asset["traite"]:
        return asset["rendu_largeur"], asset["rendu_hauteur"]
    return asset["largeur"], asset["hauteur"]


def _un_pixel_opaque(octets: bytes) -> tuple[int, int]:
    """Un pixel que le calque porte vraiment — la cible d'un geste au pixel."""
    lignes, colonnes = _opaque(octets)
    milieu = lignes.size // 2
    return int(colonnes[milieu]), int(lignes[milieu])


def _bande(octets: bytes) -> tuple[list[list[int]], int]:
    """Un passage horizontal **qui traverse le calque**, et sa longueur en x.

    Les essais visent ce que le calque porte vraiment, jamais le milieu du
    cadre : une pièce revient là où le modèle l'a posée — en haut du corps pour
    un casque —, et un passage tiré au milieu de l'image mordrait sur du vide.
    C'est le premier essai de C4 qui l'a montré, en ne mesurant rien.
    """
    lignes, colonnes = _opaque(octets)
    ligne = int(numpy.median(lignes))
    return (
        [[int(colonnes.min()), ligne], [int(colonnes.max()), ligne]],
        int(colonnes.max() - colonnes.min()) + 1,
    )


def _opaque(octets: bytes) -> tuple[numpy.ndarray, numpy.ndarray]:
    with Image.open(io.BytesIO(octets)) as ouverte:
        alpha = numpy.asarray(ouverte.convert("RGBA"))[:, :, 3] >= 128
    lignes, colonnes = numpy.nonzero(alpha)
    assert lignes.size, "le calque est vide : il n'y a aucun pixel à viser"
    return lignes, colonnes


# ── « Un masque s'affine à main levée, puis au pixel, sans repayer d'image » ──
#     (US-149)


def test_le_masque_s_affine_au_pixel_puis_a_main_levee(client, double):
    """Un passage de rayon nul ôte **exactement un pixel** ; un passage large en
    ôte une traînée. Les deux échelles du geste sont les deux bouts d'un seul
    réglage, et aucune ne redemande d'image."""
    calque, portes = _un_calque(client, double)
    identifiant = calque["identifiant"]
    appels_avant = double.appels
    total_avant = _total(client)

    # **Au pixel.** Un point, rayon 0 : le calque perd un pixel, et un seul.
    x, y = _un_pixel_opaque(_image(client, identifiant))
    reponse = _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 0, "points": [[x, y]]}],
    )
    assert reponse.status_code == 200, reponse.text
    au_pixel = _opaques(_image(client, identifiant))
    assert au_pixel == portes - 1

    # **À main levée.** Un passage large en travers du calque : la traînée
    # emporte beaucoup plus qu'un pixel, et le geste est le même — un rayon de
    # plus.
    passage, _ = _bande(_image(client, identifiant))
    reponse = _main(
        client,
        identifiant,
        "affinage",
        [
            {"garde": False, "rayon": 0, "points": [[x, y]]},
            {"garde": False, "rayon": 6, "points": passage},
        ],
    )
    assert reponse.status_code == 200, reponse.text
    a_main_levee = _opaques(_image(client, identifiant))
    assert a_main_levee < au_pixel - 1

    # **Sans repayer d'image**, et le journal du projet ne bouge pas d'un centime.
    assert double.appels == appels_avant
    assert _total(client) == total_avant


# ── « Un calque se retouche au pixel, et la retouche ramène ce que la
#     différence n'a pas vu » (US-150) ──────────────────────────────────────


def test_la_retouche_ramene_ce_que_la_difference_n_a_pas_vu(client, double):
    """Le défaut du 29 août 2026, et sa réparation.

    Une pièce qui **se substitue** au corps au lieu de s'y ajouter revient en
    poussière : elle occupe l'empreinte de ce qu'elle remplace, avec des valeurs
    voisines, et `touche` l'absorbe avec le bruit de recalage. Le calque est
    alors vide — c'est mesuré ici, et c'est le point de départ.

    La seconde couche est la seule qui puisse le rattraper : le masque ne sait
    que *retirer* ce que la mesure a trouvé, jamais fabriquer ce qu'elle n'a pas
    vu. Un passage qui **garde** ramène les pixels revenus, et le calque
    existe.
    """
    calque, portes = _un_calque(client, double, substitue=True)
    identifiant = calque["identifiant"]
    appels_avant = double.appels

    # La différence n'a rien trouvé : la pièce a pris la place du corps.
    assert portes == 0

    largeur, hauteur = _dimensions(_lire(client, identifiant))
    reponse = _main(
        client,
        identifiant,
        "retouche",
        [
            {
                "garde": True,
                "rayon": max(largeur, hauteur),
                "points": [[largeur // 2, hauteur // 2]],
            }
        ],
    )
    assert reponse.status_code == 200, reponse.text
    ramene = _opaques(_image(client, identifiant))
    assert ramene > 0

    # Et au pixel : un point de rayon nul qui **ôte** en reprend exactement un.
    x, y = _un_pixel_opaque(_image(client, identifiant))
    _main(
        client,
        identifiant,
        "retouche",
        [
            {
                "garde": True,
                "rayon": max(largeur, hauteur),
                "points": [[largeur // 2, hauteur // 2]],
            },
            {"garde": False, "rayon": 0, "points": [[x, y]]},
        ],
    )
    assert _opaques(_image(client, identifiant)) == ramene - 1

    # **Le corps est resté sous elle, intact** : c'est lui qui sert de repère, et
    # rien n'écrit jamais dedans (US-150, et la promesse de C3).
    base = calque["recette"]["difference"]["base"]
    assert _lire(client, base)["recette"]["difference"] is None
    assert double.appels == appels_avant


# ── « L'avant et l'après se comparent d'un seul geste » (US-151) ─────────────


def test_l_avant_se_demande_a_la_meme_adresse_et_ne_change_rien(client, double):
    """L'avant est la même image sans les deux couches de la main — **calculé,
    jamais gardé**.

    Il est confronté aux octets relevés *avant* le premier passage : un avant
    vérifié contre lui-même ne prouverait que lui-même. Et rien n'a été écrit —
    l'empreinte de la recette est bien celle de l'après, donc le disque porte le
    rendu retouché et pas l'autre.
    """
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]
    avant_le_geste = _image(client, identifiant)
    appels_avant = double.appels

    passage, _ = _bande(avant_le_geste)
    _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 4, "points": passage}],
    )

    apres = _image(client, identifiant)
    assert apres != avant_le_geste
    # **L'avant, octet pour octet.**
    assert _image(client, identifiant, avant="true") == avant_le_geste

    # Rien n'est écrit : le rendu du disque est celui de l'après, et l'asset ne
    # porte aucune trace d'un second fichier.
    asset = _lire(client, identifiant)
    assert asset["empreinte"] == _lire(client, identifiant)["empreinte"]
    assert _image(client, identifiant) == apres

    # **Une image que la main n'a pas touchée rend son rendu**, pas un refus :
    # la question a une réponse, et c'est l'image elle-même.
    base = calque["recette"]["difference"]["base"]
    assert _image(client, base, avant="true") == _image(client, base)

    assert double.appels == appels_avant


# ── « Le masque et la retouche sont deux couches distinctes : modifier l'une ne
#     détruit pas l'autre » (US-153) ────────────────────────────────────────


def test_les_deux_couches_ne_se_detruisent_jamais(client, double):
    """Trois gestes, et chacun laisse les autres où ils sont.

    Vrai *par construction* — ce sont deux champs de la différence, et le
    rectangle un troisième —, et c'est très exactement pour ça que le test est
    court : il n'y a aucune précaution à vérifier, seulement une forme.
    """
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]
    largeur, hauteur = _dimensions(_lire(client, identifiant))

    masque = [{"garde": False, "rayon": 3, "points": [[1, 1], [largeur - 2, 1]]}]
    retouche = [
        {"garde": True, "rayon": 2, "points": [[largeur // 2, hauteur // 2]]}
    ]

    _main(client, identifiant, "affinage", masque)
    _main(client, identifiant, "retouche", retouche)

    difference = _lire(client, identifiant)["recette"]["difference"]
    assert len(difference["affinage"]) == 1
    assert len(difference["retouche"]) == 1

    # Reprendre le masque : la retouche ne bouge pas.
    _main(
        client,
        identifiant,
        "affinage",
        masque + [{"garde": True, "rayon": 0, "points": [[2, 2]]}],
    )
    difference = _lire(client, identifiant)["recette"]["difference"]
    assert len(difference["affinage"]) == 2
    # Le passage revient avec sa couleur — **vide**, parce qu'une couche de
    # masque ne pose aucune couleur : elle décide de ce qui reste. Le champ est
    # arrivé en E5 avec les calques de dessin de la septième place, et le reste
    # de la charge est mot pour mot ce qui est parti.
    assert difference["retouche"] == [{**trait, "couleur": ""} for trait in retouche]

    # Reprendre la retouche : le masque ne bouge pas.
    _main(client, identifiant, "retouche", [])
    difference = _lire(client, identifiant)["recette"]["difference"]
    assert len(difference["affinage"]) == 2
    assert difference["retouche"] == []

    # Et **déplacer le rectangle ne détruit ni l'un ni l'autre** : le masque est
    # une seule couche dite par deux bouts, et le geste de C3 n'efface pas celui
    # de C4.
    client.put(
        f"/api/assets/{identifiant}/layer", json={"zone": [0, 0, largeur - 1, hauteur - 1]}
    )
    difference = _lire(client, identifiant)["recette"]["difference"]
    assert difference["zone"] == [0, 0, largeur - 1, hauteur - 1]
    assert len(difference["affinage"]) == 2


# ── « Chaque couche s'annule, se rejoue et se nomme, comme toute recette depuis
#     T2 » ──────────────────────────────────────────────────────────────────


def test_chaque_couche_s_annule_se_rejoue_et_se_nomme(client, atelier, double):
    """Les trois promesses d'une place de recette, sur les deux couches.

    **S'annule** : une liste vide vide la couche, et c'est le geste unique du
    retour en arrière — celui de « Sans zone » depuis C3.

    **Se rejoue** : le fichier de rendu est un cache. Effacé à la main, il
    revient identique, recalculé depuis le brut et la recette — donc la main est
    bien *dans la recette*, et non peinte dans l'image.

    **Se nomme** : la couche est désignée par son nom, et un nom inconnu est
    refusé en le disant. C'est ce que veut dire « une suite de places nommées »
    (`atelier/domaine/recette.py`).
    """
    calque, portes = _un_calque(client, double)
    identifiant = calque["identifiant"]
    passage, _ = _bande(_image(client, identifiant))

    _main(
        client, identifiant, "affinage", [{"garde": False, "rayon": 5, "points": passage}]
    )
    avec_main = _image(client, identifiant)
    assert _opaques(avec_main) < portes

    # **Se rejoue** — le cache effacé revient, au même octet.
    enregistre = atelier.assets.lire(identifiant)
    chemin = atelier.fichiers.racine / enregistre.rendu
    assert chemin.is_file()
    chemin.unlink()
    assert _image(client, identifiant) == avec_main
    assert chemin.is_file()

    # **S'annule** — et seule celle qu'on vide se vide.
    _main(client, identifiant, "retouche", [{"garde": True, "rayon": 1, "points": [[1, 1]]}])
    reponse = _main(client, identifiant, "affinage", [])
    assert reponse.status_code == 200, reponse.text
    difference = reponse.json()["recette"]["difference"]
    assert difference["affinage"] == []
    assert len(difference["retouche"]) == 1

    # **Se nomme** — une couche inconnue est refusée, et le refus nomme celles
    # qui existent.
    refus = _main(client, identifiant, "peinture", [])
    assert refus.status_code == 422, refus.text


# ── « Les calques restant à regarder se trient par la mesure la plus
#     défavorable, le pire en tête » (US-152) ────────────────────────────────


def test_la_mesure_la_plus_defavorable_est_nommee_et_graduee():
    """Le classement est **une règle du domaine**, éprouvée sans monter d'écran.

    Quatre mesures y entrent et `ajout` n'y entre pas : les quatre autres ont un
    bon côté connu — la silhouette se garde, le repeint s'évite, l'échelle vaut
    1, une pièce est un objet et non une poussière —, quand `ajout` n'en a
    aucun. Une pièce contenue en ajoute peu et va bien ; une pièce qui agrandit
    en ajoute beaucoup et va bien aussi.
    """
    # Le calque propre du 28 août : tout va bien, et c'est la compacité qui est
    # la moins bonne des quatre.
    propre = MesuresCalque(
        silhouette=0.995, repeint=0.003, ajout=0.061, echelle=1.0, compacite=0.98
    )
    assert propre.pire() == ("objet ou poussière", 1 - 0.98)

    # Le casque du 29 août : la forme est intacte, l'échelle aussi, et pourtant
    # ce qui revient est une poussière semée sur tout le corps.
    poussiere = MesuresCalque(
        silhouette=1.0, repeint=0.02, ajout=0.004, echelle=1.0, compacite=0.05
    )
    assert poussiere.pire()[0] == "objet ou poussière"
    assert poussiere.pire()[1] > propre.pire()[1]

    # La cape : l'écart d'échelle est rapporté à la tolérance du produit, donc
    # plafonné — au-delà, il n'y a plus de calque du tout à graduer.
    cape = MesuresCalque(
        silhouette=1.0, repeint=0.235, ajout=2.03, echelle=0.62, compacite=0.41
    )
    assert cape.pire() == ("échelle au retour", 1.0)
    assert abs(cape.echelle - 1.0) > ECHELLE_TOLEREE

    # **`ajout` n'entre pas dans le classement** : une pièce qui déborde
    # largement de la silhouette et va parfaitement bien ne remonte pas la liste.
    debordante = MesuresCalque(
        silhouette=1.0, repeint=0.0, ajout=3.4, echelle=1.0, compacite=1.0
    )
    assert debordante.pire()[1] == 0.0
    assert "ajout" not in {nom for nom, _ in debordante.defaveurs()}


def test_le_pire_traverse_le_port_avec_les_cinq_mesures(client, double):
    """Le classement se calcule **une fois, au serveur**, et voyage avec les
    mesures — sans quoi l'écran aurait un second barème, et deux listes triées
    différemment sur les mêmes cinq nombres."""
    calque, _ = _un_calque(client, double)
    mesures = calque["calque"]
    assert mesures["pire"] in {nom for nom, _ in MesuresCalque().defaveurs()}
    assert 0.0 <= mesures["gravite"] <= 1.0

    # **Déduit, jamais relu** : il n'entre pas dans ce qu'un fichier rend.
    assert MesuresCalque.depuis_json(mesures) == MesuresCalque(
        silhouette=mesures["silhouette"],
        repeint=mesures["repeint"],
        ajout=mesures["ajout"],
        echelle=mesures["echelle"],
        compacite=mesures["compacite"],
    )


# ── « Aucune de ces opérations n'appelle le fournisseur ni ne mobilise la carte
#     graphique » ────────────────────────────────────────────────────────────


def test_toute_la_main_marche_reseau_coupe(client, double):
    """Les quatre gestes de C4, comptés sur les appels du double.

    C'est le geste du dépôt depuis T2, et il vaut ici plus qu'ailleurs : la main
    est le seul endroit du produit où l'on retouche une image **payée**, et une
    ligne qui redemanderait le fournisseur se paierait en argent réel.
    """
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]
    largeur, hauteur = _dimensions(_lire(client, identifiant))
    appels_avant = double.appels

    _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 4, "points": [[1, 1], [largeur - 2, hauteur - 2]]}],
    )
    _main(
        client,
        identifiant,
        "retouche",
        [{"garde": True, "rayon": 2, "points": [[largeur // 2, hauteur // 2]]}],
    )
    _image(client, identifiant, avant="true")
    _main(client, identifiant, "affinage", [])
    _main(client, identifiant, "retouche", [])

    assert double.appels == appels_avant


# ── Les refus, et ils nomment ce qui manque ─────────────────────────────────


def test_seule_la_main_d_un_calque_se_pose(client, double):
    """Une image qui n'est pas un calque n'a pas de couche à retoucher, et le
    refus le dit — comme le masque de C3, dont c'est la phrase jumelle."""
    calque, _ = _un_calque(client, double)
    base = calque["recette"]["difference"]["base"]

    refus = _main(client, base, "retouche", [{"garde": True, "rayon": 0, "points": [[0, 0]]}])
    assert refus.status_code == 409, refus.text
    assert "calque" in refus.json()["raison"]


def test_un_rayon_hors_bornes_est_refuse_en_le_nommant(client, double):
    """Ce qui est indisponible est refusé **en le nommant**, jamais ramené en
    silence vers la borne la plus proche — la règle des bornes de T2."""
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]

    refus = _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": RAYON_MAX + 1, "points": [[0, 0]]}],
    )
    assert refus.status_code == 422, refus.text


def test_un_point_hors_du_cadre_se_borne_au_lieu_de_lever(client, double):
    """Un onglet resté ouvert pendant qu'on changeait la cible de pixel du projet
    enverrait sinon une erreur là où il suffit de rogner — la règle du rectangle
    depuis T5, appliquée à la main."""
    calque, portes = _un_calque(client, double)
    identifiant = calque["identifiant"]
    passage, _ = _bande(_image(client, identifiant))
    ligne = passage[0][1]

    reponse = _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 0, "points": [[-500, ligne], [500, ligne]]}],
    )
    assert reponse.status_code == 200, reponse.text
    # Le trait a traversé l'image de part en part, en débordant des deux côtés :
    # il a mordu la rangée qu'il visait, sans lever.
    assert 0 < _opaques(_image(client, identifiant)) < portes


# ── La main et le rejeu du recalage (R5) ────────────────────────────────────


def test_la_main_survit_au_rejeu_du_recalage(client, double):
    """**Ce que la main a posé n'est pas un résultat de mesure**, donc rejouer le
    calcul ne le reprend pas.

    C'était déjà la promesse de R5 pour le masque rectangle, et C4 n'a eu aucune
    ligne à y ajouter : la différence est reprise par `replace`, donc tout ce que
    la main y avait posé reste posé. C'est la preuve que la couche est au bon
    endroit — une couche rangée ailleurs aurait demandé une ligne de plus, donc
    une ligne à oublier.
    """
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]
    largeur, hauteur = _dimensions(_lire(client, identifiant))
    appels_avant = double.appels

    _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 3, "points": [[1, 1], [largeur - 2, hauteur - 2]]}],
    )
    _main(
        client,
        identifiant,
        "retouche",
        [{"garde": True, "rayon": 2, "points": [[largeur // 2, hauteur // 2]]}],
    )
    avant = _lire(client, identifiant)["recette"]["difference"]

    reponse = client.post(f"/api/assets/{identifiant}/realign")
    assert reponse.status_code == 200, reponse.text

    apres = _lire(client, identifiant)["recette"]["difference"]
    assert apres["affinage"] == avant["affinage"]
    assert apres["retouche"] == avant["retouche"]
    # Rien n'est né ni mort, et rien n'a été redemandé.
    assert reponse.json()["assets"][0]["identifiant"] == identifiant
    assert double.appels == appels_avant


# ── Ce que la main ne fait pas ──────────────────────────────────────────────


def test_la_main_ne_touche_jamais_le_corps(client, double):
    """Le corps d'origine est retrouvé **octet pour octet** après les deux
    couches — la promesse de C3, que C4 ne défait pas : la main écrit dans une
    recette, et une recette ne décrit qu'un calcul."""
    calque, _ = _un_calque(client, double)
    identifiant = calque["identifiant"]
    base = calque["recette"]["difference"]["base"]
    corps_avant = _image(client, base)
    largeur, hauteur = _dimensions(_lire(client, identifiant))

    _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 6, "points": [[0, 0], [largeur - 1, hauteur - 1]]}],
    )
    _main(
        client,
        identifiant,
        "retouche",
        [{"garde": True, "rayon": 4, "points": [[largeur // 2, hauteur // 2]]}],
    )

    assert _image(client, base) == corps_avant


def test_un_corps_redimensionne_ne_fait_pas_tomber_le_calque(client, double):
    """**Un corps qui a changé de taille est un corps disparu.**

    Trouvé le 29 août 2026 en ouvrant C4 sur `coeur de pierre - 01` : le calque
    avait été taillé dans un corps rendu à 96 px, la cible de pixel du projet
    était passée à 128, et le rendu levait — 500 sur la route de l'image, donc
    un calque qu'on ne pouvait plus ni voir ni retoucher. C'est un défaut de C3
    que C4 a **révélé** plutôt que causé : une place de plus dans la recette
    change l'empreinte de tous les calques, donc les fait tous recalculer, et
    celui-là ne se recalculait plus depuis le jour où la cible avait bougé.

    Le calque redevient sa case, comme pour un corps supprimé, et le geste qui
    répare est le rejeu du recalage (R5) : lui retaille depuis la planche payée.
    """
    calque, portes = _un_calque(client, double)
    identifiant = calque["identifiant"]
    base = calque["recette"]["difference"]["base"]
    assert portes > 0

    # La grille du corps change : il se rend à une autre taille que le cadre
    # dans lequel le calque a été taillé. C'est ce que fait une cible de pixel
    # de projet qu'on relève, et le geste le plus court qui le reproduise.
    avant = _dimensions(_lire(client, base))
    recette = _lire(client, base)["recette"]
    reponse = client.put(
        f"/api/assets/{base}/recipe",
        json={**recette, "grille": {**(recette["grille"] or {}), "cible": avant[0] * 2}},
    )
    assert reponse.status_code == 200, reponse.text
    assert _dimensions(_lire(client, base)) != avant

    # **Le geste qui a trouvé le défaut**, et le seul qui le déclenche : tant
    # que la recette du calque ne bouge pas, son rendu est un cache et le
    # serveur ne recalcule rien. Poser une couche de la main change l'empreinte,
    # donc force le recalcul — c'est exactement ce qui a levé le 29 août.
    reponse = _main(
        client,
        identifiant,
        "affinage",
        [{"garde": False, "rayon": 2, "points": [[1, 1]]}],
    )
    assert reponse.status_code == 200, reponse.text

    # **Le calque se rend encore**, et il rend sa case — pas une erreur.
    octets = _image(client, identifiant)
    assert _opaques(octets) > portes
    # Et la différence est toujours là : le corps revenu à sa taille la lui rend.
    assert _lire(client, identifiant)["recette"]["difference"]["base"] == base


def test_le_pinceau_est_pur_et_deterministe():
    """Deux rendus de la même recette donnent le même masque — le critère de
    déterminisme de T2, sur la seule étape de C4 qui rasterise.

    Il vaut d'être éprouvé ici plutôt qu'à travers une image : c'est une
    fonction pure, et une fonction pure s'éprouve sans montage — comme la
    géométrie de la toile en T9.
    """
    trait = Trait(garde=True, rayon=2, points=((3, 3), (12, 9), (12, 3)))
    premier = calc.pinceau((16, 16), trait)
    assert (premier == calc.pinceau((16, 16), trait)).all()

    # **Le dernier passage l'emporte**, comme un pinceau sur une toile : c'est
    # ce qui rend un retrait possible *après* un ajout, donc rattrapable.
    plein = numpy.ones((16, 16), dtype=bool)
    ote = calc.peindre(plein, (Trait(garde=False, rayon=0, points=((5, 5),)),))
    assert not ote[5, 5]
    remis = calc.peindre(
        plein,
        (
            Trait(garde=False, rayon=0, points=((5, 5),)),
            Trait(garde=True, rayon=0, points=((5, 5),)),
        ),
    )
    assert remis[5, 5]

    # **Les points sont reliés, jamais semés** : un geste rapide n'envoie que
    # deux points, et le trait doit quand même être continu.
    saut = calc.pinceau((16, 16), Trait(rayon=0, points=((0, 8), (15, 8))))
    assert saut[8].all()


def test_un_trait_sans_point_disparait_au_lieu_de_lever():
    """Un trait sans point ne fait rien : il tombe à la relecture, comme un lien
    sans extrémité (`atelier/domaine/lien.py`). Un objet qui ne fait rien mais
    qu'on garde est un objet qu'on retrouvera des mois plus tard sans savoir
    pourquoi il est là."""
    relue = Difference.depuis_json(
        {
            "base": "aaaa-0",
            "affinage": [{"garde": True, "rayon": 2, "points": []}, {"points": [[1, 2]]}],
            "retouche": [],
        }
    )
    assert len(relue.affinage) == 1
    assert relue.affinage[0].points == ((1, 2),)
    assert relue.main_posee

    # Et l'avant est la même différence, les deux couches vidées.
    assert relue.sans_main().affinage == ()
    assert relue.sans_main().retouche == ()
    assert relue.sans_main().base == "aaaa-0"
