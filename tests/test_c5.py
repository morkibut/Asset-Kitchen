# -*- coding: utf-8 -*-
"""Les critères d'acceptation de C5 — la sortie : le dossier du jeu, et l'agent.

**Aucun test ne coûte un centime.** Deux d'entre eux **comptent les appels du
double** avant et après : sortir un personnage ne demande jamais le fournisseur,
et c'est ce que la tranche promet — un auteur hors ligne livre son jeu.

**Le montage vient de `test_c3`, et il n'est pas recopié** — même raison qu'en
C4 : un double écrit d'après l'intention prouve l'intention, pas le serveur. Ce
qui sort d'ici est donc ce que la chaîne entière a réellement produit, planche
pliée et calques compris.

**Les outils MCP sont appelés par le serveur**, `call_tool` comme un vrai
client, exactement comme en T7 : appeler les fonctions Python sauterait la
validation de schéma et ne prouverait rien du contrat.

**Et les fichiers posés sont rouverts.** L'export est le seul geste du produit
dont personne ne voit le résultat avant de l'ouvrir ailleurs, une semaine plus
tard : Pillow rouvre chaque PNG et confronte ses dimensions à celles que le
descriptif annonce, `json` relit le descriptif, et `iterdir` regarde ce que le
dossier contient **vraiment**.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

from PIL import Image

from test_c3 import (
    MODELE,
    _attendre,
    _cases,
    _corps,
    _habiller,
    _personnage,
    _piece,
)
from tests.conftest import image_sujet
# `mcp` est une fixture, et elle s'importe **nommément** : pytest ne la voit
# que si elle est dans l'espace de noms du module qui s'en sert.
from tests.test_t7 import appeler, mcp, refuser  # noqa: F401


# ── Le montage : un personnage habillé, prêt à partir ───────────────────────


def _habille(client, double, poses: int = 2) -> tuple[str, list[str], str]:
    """Un personnage, N poses remplies, et une pièce posée sur chacune.

    C'est l'état dans lequel un auteur veut sortir quelqu'un : des corps, et de
    quoi les habiller. En dessous, on ne sortirait qu'une moitié de ce que C5
    doit savoir écrire.
    """
    personnage, plan = _personnage(client, poses)
    _corps(client, double, personnage, plan)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, plan)
    return personnage, plan, piece


def _sortir(client, personnage: str, dossier: Path, **corps):
    """Un seul sujet, par **la porte unique** (`RP17`).

    C5 avait sa propre route — `POST /api/characters/{id}/export` —, qui écrivait
    sans rien montrer. Elle est retirée : *sortir un personnage* est devenu un
    réglage de la sortie de B21, `sujet`, et tout ce que C5 demandait se vérifie
    donc sur elle. Ce sont les mêmes fichiers, le même descriptif, les mêmes
    refus — avec, en plus, un aperçu qu'on peut demander avant.
    """
    return client.post(
        "/api/output",
        json={"sujet": personnage, "dossier": str(dossier), **corps},
    )


def _prevoir(client, personnage: str, dossier: Path, **corps):
    """Ce que la sortie ferait, **sans l'avoir faite**."""
    return client.post(
        "/api/output/preview",
        json={"sujet": personnage, "dossier": str(dossier), **corps},
    )


def _descriptif(sortie: dict) -> dict:
    """Le descriptif **relu sur le disque**, jamais celui qui a été rendu.

    Les deux doivent dire la même chose ; c'est le fichier qui reste au jeu
    quand l'atelier est fermé, donc c'est lui qu'on ouvre.
    """
    return json.loads(Path(sortie["descriptif"]).read_text(encoding="utf-8"))


def _images(sortie: dict) -> list[dict]:
    """Ce qui a été écrit, sauf le descriptif qui nomme le reste."""
    return [f for f in sortie["ecrits"] if f["role"] != "descriptif"]


# ── Un personnage complet part, avec un descriptif qui nomme tout ───────────


def test_un_personnage_complet_part_dans_le_dossier_du_jeu(client, double, tmp_path):
    """« Un personnage complet s'exporte dans le dossier du jeu avec un
    descriptif qui nomme chaque fichier, sa pose et sa pièce. » (US-154, US-155)
    """
    personnage, plan, piece = _habille(client, double)
    dossier = tmp_path / "mon-jeu" / "assets" / "sprites"
    # **Le dossier n'existe pas encore** : c'est la première des trois règles du
    # dossier du jeu, et elle se vérifie ici plutôt que dans un test à elle —
    # c'est le chemin normal, pas un cas limite.
    assert not dossier.exists()

    # **On regarde avant d'écrire** (`RP17`) : l'aperçu annonce les quatre
    # images, tout est neuf, et rien n'existe encore sur le disque.
    vu = _prevoir(client, personnage, dossier)
    assert vu.status_code == 200, vu.text
    apercu = vu.json()
    assert [f["marque"] for f in apercu["fichiers"]] == ["nouveau"] * 5
    assert not dossier.exists()

    reponse = _sortir(client, personnage, dossier)
    assert reponse.status_code == 200, reponse.text
    sortie = reponse.json()

    # Deux poses, un corps et un calque chacune — plus le descriptif.
    assert len(_images(sortie)) == 4
    assert Path(sortie["dossier"]) == dossier
    # **Ce qui est écrit est ce que l'aperçu annonçait**, aux mêmes chemins.
    assert [f["chemin"] for f in sortie["ecrits"]] == [
        f["chemin"] for f in apercu["fichiers"]
    ]

    descriptif = _descriptif(sortie)
    assert descriptif["personnage"]["nom"] == "Nain"
    assert descriptif["compte"] == 4

    for fiche in descriptif["assets"]:
        # Le fichier annoncé existe, et c'est une vraie image.
        pose_sur_disque = dossier / fiche["fichier"]
        assert pose_sur_disque.is_file(), fiche["fichier"]
        with Image.open(pose_sur_disque) as image:
            assert image.format == "PNG"
            # **Les dimensions sont remesurées sur le fichier qui part**, jamais
            # recopiées de l'enregistrement — l'invariant de T1, et l'export est
            # justement l'endroit où les deux diffèrent.
            assert (image.width, image.height) == (
                fiche["dimensions"]["largeur"],
                fiche["dimensions"]["hauteur"],
            )
        # Sa pose, toujours ; sa pièce, quand c'en est un calque.
        assert fiche["pose"]["identifiant"] in plan
        assert fiche["pose"]["nom"]
        if fiche["role"] == "calque":
            assert fiche["piece"]["identifiant"] == piece
            assert fiche["piece"]["nom"] == "casque"
        else:
            assert fiche["role"] == "corps" and fiche["piece"] is None

    roles = [fiche["role"] for fiche in descriptif["assets"]]
    # **Des calques, et pas des corps habillés** : la pièce du montage est
    # « contenue » et revient à l'échelle, donc la différence a produit quelque
    # chose à empiler. C'est la recette qui le dit, ici comme à l'écran.
    assert roles.count("corps") == 2 and roles.count("calque") == 2


def test_le_descriptif_dit_dans_quel_ordre_empiler(client, double, tmp_path):
    """Un calque sans son rang oblige l'agent à inventer lequel passe devant.

    C'est très exactement ce que « aucune structure inventée » interdit : le
    rang est celui des emplacements du projet, posé par l'auteur, et il part
    avec le descriptif.
    """
    personnage, _, _ = _habille(client, double, poses=1)
    sortie = _sortir(client, personnage, tmp_path / "jeu").json()
    descriptif = _descriptif(sortie)

    assert [e["nom"] for e in descriptif["emplacements"]] == ["tête"]
    calque = next(f for f in descriptif["assets"] if f["role"] == "calque")
    assert calque["piece"]["nom"] == "casque"


def test_un_corps_habille_sort_en_disant_qu_il_ne_s_empile_pas(client, double, tmp_path):
    """Une pièce qui agrandit et revient à une autre échelle ne fait aucun
    calque : ce qui revient est gardé comme un **corps habillé** (US-148).

    Il sort — l'appel a été payé et l'image est utilisable —, mais le descriptif
    dit qu'il **remplace** le corps au lieu de s'empiler dessus. L'annoncer
    « calque » ferait empiler un corps sur un corps, et rien à l'autre bout ne
    permettrait de s'en apercevoir avant de le voir à l'écran.

    **Trouvé en sortant un vrai personnage**, le 29 août 2026 : le casque de
    `coeur de pierre - 01` est déclaré « agrandit », et il est ressorti sous le
    rôle « calque » alors que le fichier portait un nain entier.
    """
    personnage, plan = _personnage(client, 1)
    _corps(client, double, personnage, plan)
    piece = _piece(client, nom="cape", emplacement="dos", portee="agrandit")
    _habiller(client, double, personnage, piece, plan, echelle=0.62)

    # Le montage est bien celui d'un corps habillé : aucune différence dans la
    # recette, donc rien à empiler.
    porte = _cases(client, personnage)[0]["calques"][piece][0]
    assert porte["recette"]["difference"] is None

    sortie = _sortir(client, personnage, tmp_path / "jeu").json()
    fiches = {f["role"]: f for f in _descriptif(sortie)["assets"]}

    assert set(fiches) == {"corps", "corps_habille"}
    assert fiches["corps_habille"]["identifiant"] == porte["identifiant"]
    assert fiches["corps_habille"]["piece"]["nom"] == "cape"
    # Les deux sortent : le corps nu et le corps habillé sont deux images du jeu.
    assert len(_images(sortie)) == 2


def test_ce_qui_part_est_le_rendu_et_le_descriptif_dit_lequel(
    client, double, tmp_path
):
    """« Ce qui part est le rendu, jamais l'image payée qui reste dans
    l'atelier, et le descriptif dit lequel il est — comme en T6. »"""
    personnage, plan, _ = _habille(client, double, poses=1)
    cases = _cases(client, personnage)
    corps = cases[0]["images"][0]["identifiant"]

    pose = client.put(
        f"/api/assets/{corps}/recipe",
        json={
            "passes": [{"moteur": "bord"}],
            "recadrage": {"marge": 0},
            "grille": {"cible": 32, "occupation": 100},
        },
    )
    assert pose.status_code == 200, pose.text
    asset = pose.json()
    assert asset["largeur"] != asset["rendu_largeur"] == 32

    dossier = tmp_path / "jeu"
    sortie = _sortir(client, personnage, dossier).json()
    fiche = next(f for f in _descriptif(sortie)["assets"] if f["identifiant"] == corps)

    with Image.open(dossier / fiche["fichier"]) as image:
        assert (image.width, image.height) == (
            asset["rendu_largeur"],
            asset["rendu_hauteur"],
        )
        # Détouré : le PNG porte un alpha, et il est réellement percé — le fond
        # gris qu'on vient d'enlever n'est pas reparti dans le jeu.
        assert image.mode == "RGBA"
        assert image.getchannel("A").getextrema() == (0, 255)

    # **Le descriptif dit lequel il est** : les dimensions du fichier qui part,
    # celles de l'image payée à côté, et la recette avec son empreinte — de quoi
    # rejouer ce rendu sans repayer.
    assert fiche["dimensions"]["largeur"] == asset["rendu_largeur"]
    assert fiche["brut"]["largeur"] == asset["largeur"]
    assert fiche["empreinte"] and fiche["recette"]

    # Et l'image payée est **restée** dans l'atelier.
    assert client.get(f"/api/assets/{corps}").status_code == 200


def test_ce_qui_sort_est_ce_que_la_matrice_retient(client, double, tmp_path):
    """Le favori d'abord, sinon la plus récente — la règle de la composition.

    Deux corps sur la même pose, le premier marqué favori : c'est lui qui part.
    Sortir les deux aurait rendu le tri à qui ouvre le dossier, alors que
    l'auteur y a déjà répondu.
    """
    personnage, plan = _personnage(client, 1)
    premier = _corps(client, double, personnage, plan)[plan[0]]
    marque = client.put(
        "/api/assets/favorite", json={"identifiants": [premier], "favori": True}
    )
    assert marque.status_code == 200, marque.text

    # Une seconde image sur la même case, plus récente et non favorite.
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    seconde = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "le nain, encore",
            "personnage": personnage,
            "pose": plan[0],
        },
    ).json()
    _attendre(client, seconde["identifiant"])
    double.rendre = None
    assert len(_cases(client, personnage)[0]["images"]) == 2

    sortie = _sortir(client, personnage, tmp_path / "jeu").json()
    assert len(_images(sortie)) == 1
    assert _descriptif(sortie)["assets"][0]["identifiant"] == premier


# ── Les règles du dossier du jeu, tenues telles quelles ─────────────────────


def test_rien_n_est_ecrase_sans_que_la_comparaison_l_ait_annonce(
    client, double, tmp_path
):
    """La règle a changé de forme en `RP17`, pas de fond.

    L'ancienne porte ne savait que **ne jamais écraser** : elle numérotait, et
    après trois sorties le dossier portait `nain-repos.png`, `-2`, `-3`, sans
    que rien ne dise lequel charger. La porte retenue, elle, **annonce** — la
    marque de chaque fichier est lue avant que le bouton parte —, puis fait ce
    que l'auteur a répondu.
    """
    personnage, _, _ = _habille(client, double, poses=1)
    dossier = tmp_path / "jeu"

    premiere = _sortir(client, personnage, dossier).json()
    temoins = {
        f["chemin"]: (dossier / f["chemin"]).read_bytes() for f in premiere["ecrits"]
    }

    # **Sans rien changer, tout est inchangé** : même pixels, même empreinte,
    # et le disque n'est pas réécrit pour rien.
    apercu = _prevoir(client, personnage, dossier).json()
    marques = {f["chemin"]: f["marque"] for f in apercu["fichiers"]}
    for chemin in temoins:
        # Le descriptif porte l'heure de sa fabrication : il change à chaque
        # passage, et c'est le seul.
        assert marques[chemin] == ("remplace" if chemin.endswith(".json") else "inchange")

    # Une image retouchée, et l'aperçu le dit **avant** l'écriture.
    corps = _cases(client, personnage)[0]["images"][0]["identifiant"]
    client.put(
        f"/api/assets/{corps}/recipe",
        json={"passes": [{"moteur": "bord"}], "recadrage": {"marge": 0}},
    )
    remplaces = [
        f["chemin"]
        for f in _prevoir(client, personnage, dossier).json()["fichiers"]
        if f["marque"] == "remplace"
    ]
    assert remplaces, "le fichier réécrit doit être annoncé remplacé"
    # Tant qu'on n'a pas écrit, le disque porte encore l'ancien.
    assert (dossier / remplaces[0]).read_bytes() == temoins[remplaces[0]]

    seconde = _sortir(client, personnage, dossier).json()
    assert (dossier / remplaces[0]).read_bytes() != temoins[remplaces[0]]
    # **Aucun homonyme numéroté** : un seul fichier par image, celui que le jeu
    # charge.
    assert not [f for f in dossier.iterdir() if "-2." in f.name]
    assert Path(seconde["descriptif"]) == Path(premiere["descriptif"])


def test_s_arreter_refuse_tout_plutot_que_d_ecraser(client, double, tmp_path):
    """*S'arrêter s'il y a un doublon* : rien n'est écrit, et on dit lequel.

    C'est ce que l'ancienne porte faisait toujours, devenu un choix — et il est
    entier : s'arrêter au milieu d'un lot aurait laissé la moitié d'un
    personnage dans le jeu.
    """
    personnage, _, _ = _habille(client, double, poses=1)
    dossier = tmp_path / "jeu"
    _sortir(client, personnage, dossier)

    refus = _sortir(client, personnage, dossier, collision="arreter")
    assert refus.status_code == 409
    assert "existe déjà" in refus.json()["raison"]
    assert "rien n'a été écrit" in refus.json()["raison"]


def test_un_dossier_non_inscriptible_est_refuse_avec_son_chemin(
    client, double, tmp_path
):
    """La troisième règle. On fabrique le cas sans toucher aux droits du
    système : un **fichier** posé là où un dossier est attendu se refuse sur
    toutes les plateformes, et c'est la même branche de code qui répond."""
    personnage, _, _ = _habille(client, double, poses=1)
    obstacle = tmp_path / "pas-un-dossier"
    obstacle.write_text("je ne suis pas un dossier", encoding="utf-8")

    reponse = _sortir(client, personnage, obstacle)
    assert reponse.status_code == 409
    # **Le chemin fautif**, parce qu'on en a nommé plusieurs dans la minute.
    assert str(obstacle) in reponse.json()["raison"]


def test_sans_dossier_de_jeu_le_refus_dit_ou_le_poser(client, double, tmp_path):
    """L'association du jeu est lue, **pas le réglage de l'agent** (`RV8`).

    Avant RV8, ce test attendait le repli sur `dossier_jeu` des Réglages —
    c'est-à-dire la fuite que RV8 ferme : ce réglage est commun à tout
    l'atelier, et deux jeux ouverts tour à tour se déposaient au même endroit.
    Le seul essai existant que RV8 réécrit, et il est déclaré comme tel."""
    personnage, _, _ = _habille(client, double, poses=1)

    reponse = client.post("/api/output", json={"sujet": personnage})
    assert reponse.status_code == 409
    corps = reponse.json()
    assert "aucun dossier de jeu" in corps["raison"]
    assert "rattache ton jeu Godot" in corps["raison"]

    # Le dossier de l'agent posé : **il ne sert plus de défaut**.
    client.put("/api/settings/agent", json={"dossier_jeu": str(tmp_path / "depot-agent")})
    assert client.post("/api/output", json={"sujet": personnage}).status_code == 409
    assert not (tmp_path / "depot-agent").exists()

    # Le jeu Godot rattaché, lui, en sert : sa racine, plus le sous-dossier
    # des fichiers, sans qu'on ait à le nommer.
    jeu = tmp_path / "Jeu Godot"
    jeu.mkdir()
    (jeu / "project.godot").write_text("config_version=5\n", encoding="utf-8")
    projet = client.app.state.atelier.bibliotheque.courant
    assert client.put(
        f"/api/projects/{projet}/godot-link", json={"dossier": str(jeu)}
    ).status_code == 200
    sortie = client.post("/api/output", json={"sujet": personnage}).json()
    assert Path(sortie["dossier"]) == jeu.resolve() / "assets" / "asset-kitchen" / "fichiers"
    assert not (tmp_path / "depot-agent").exists()


# ── Ce que l'atelier n'écrit pas ────────────────────────────────────────────


def test_l_atelier_n_ecrit_que_des_images_et_leur_descriptif(
    client, double, tmp_path
):
    """« L'atelier n'écrit aucune ligne de code de jeu, et aucun chemin de
    fichier n'est inventé. »

    Ce qui se vérifie, c'est ce que le dossier **contient** : des PNG et un
    descriptif JSON, à plat. Ni ressource de moteur, ni script, ni arborescence
    inventée — l'atelier ne sait pas comment ce jeu-là range ses choses, et il
    n'a pas à le deviner.
    """
    personnage, _, _ = _habille(client, double)
    dossier = tmp_path / "jeu"
    sortie = _sortir(client, personnage, dossier).json()

    ecrits = sorted(chemin.name for chemin in dossier.iterdir())
    assert len(ecrits) == 5
    assert sum(1 for nom in ecrits if nom.endswith(".png")) == 4
    assert [nom for nom in ecrits if nom.endswith(".json")] == ["descriptif.json"]
    # À plat : aucun sous-dossier, donc aucune structure imposée au jeu.
    assert all(chemin.is_file() for chemin in dossier.iterdir())

    # Et les chemins rendus sont relatifs au dossier nommé, et tous existants :
    # l'agent lit `dossier` une fois, et n'a rien à deviner.
    for fiche in sortie["ecrits"]:
        chemin = dossier / fiche["chemin"]
        assert chemin.is_file()
        assert chemin.parent == dossier


def test_sortir_un_personnage_ne_demande_jamais_le_fournisseur(
    client, double, tmp_path
):
    """Réseau coupé, un auteur livre son jeu — c'est du disque et du processeur."""
    personnage, _, _ = _habille(client, double)
    avant = double.appels
    double.catalogue_lisible = False

    sortie = _sortir(client, personnage, tmp_path / "jeu").json()

    assert len(_images(sortie)) == 4
    assert double.appels == avant


# ── Le refus qui grise le bouton ────────────────────────────────────────────


def test_un_personnage_sans_pose_remplie_est_refuse_avec_sa_raison(
    client, tmp_path
):
    """« Export d'un personnage sans aucune pose remplie : l'action est grisée
    avec sa raison, comme toute action indisponible du produit. »

    L'écran grise d'abord — l'aperçu porte son refus en clair, et le bouton le
    lit. Ce refus-ci est le filet, et c'est la phrase que l'agent, qui n'a pas
    d'écran, répétera à l'auteur.
    """
    personnage, _ = _personnage(client, 2)
    dossier = tmp_path / "jeu"

    # L'aperçu ne lève pas : il rend un aperçu vide **avec sa raison**, et c'est
    # ce que le bouton grisé affiche.
    apercu = _prevoir(client, personnage, dossier).json()
    assert apercu["compte"] == 0
    assert "rien ne sort" in apercu["refus"]
    # Et il nomme le sujet dans la colonne de ce qui n'est pas prêt.
    assert [s["nom"] for a in apercu["pas_prets"] for s in a["sujets"]] == ["Nain"]

    reponse = _sortir(client, personnage, dossier)
    assert reponse.status_code == 409
    assert "rien ne sort" in reponse.json()["raison"]

    # **Rien n'a été écrit** : un dossier créé pour rien serait un dossier vide
    # à expliquer une semaine plus tard.
    assert not dossier.exists()


def test_un_calque_sans_corps_ne_part_pas_seul(client, double, tmp_path):
    """Un calque est une différence posée sur un corps ; seul dans un dossier de
    jeu, il ne se pose sur rien.

    Le corps supprimé, la case redevient vide — c'est la matrice qui le dit —,
    et la sortie ne trouve plus rien à sortir de cette pose.
    """
    personnage, plan, _ = _habille(client, double, poses=1)
    corps = _cases(client, personnage)[0]["images"][0]["identifiant"]
    assert _cases(client, personnage)[0]["calques"]

    client.post("/api/assets/delete", json={"identifiants": [corps]})

    reponse = _sortir(client, personnage, tmp_path / "jeu")
    assert reponse.status_code == 409
    assert "rien ne sort" in reponse.json()["raison"]


def test_l_ancienne_porte_ne_repond_plus(client, double, tmp_path):
    """`POST /api/characters/{id}/export` est retirée (`RP17`).

    Sans cet essai, la route pourrait revenir sans que rien ne tombe — et le
    produit aurait de nouveau deux chemins vers le dossier du jeu, dont un sans
    aperçu.

    **405 et non 404**, pour la raison déjà écrite en `RP18` : une adresse que
    plus aucune route ne porte retombe sur le serveur de fichiers de
    l'interface, qui répond *méthode non servie* à tout ce qui n'est pas une
    lecture.
    """
    personnage, _, _ = _habille(client, double, poses=1)
    reponse = client.post(
        f"/api/characters/{personnage}/export", json={"dossier": str(tmp_path / "jeu")}
    )
    assert reponse.status_code == 405, reponse.text
# ── L'agent : les mêmes gestes que l'écran, sans écran ──────────────────────


async def test_l_agent_ajoute_une_pose_et_la_genere_sans_ecran(
    atelier, mcp, client, double
):
    """« L'agent ajoute une pose au plan d'un personnage existant et la génère
    sans que l'écran soit ouvert. » (US-156)"""
    personnage, _ = _personnage(client, 1)

    ajoutee = await appeler(mcp, "add_pose", name="saut")
    assert "saut" in [pose["name"] for pose in ajoutee["poses"]]

    # **Une pose neuve est tenue par tout le monde** : le personnage porte ce
    # qu'il écarte, pas ce qu'il tient, donc la case paraît sans qu'un seul
    # fichier de personnage soit réécrit.
    vue = await appeler(mcp, "list_characters")
    ligne = next(p for p in vue["characters"][0]["poses"] if p["pose"] == "saut")
    assert ligne["body"] is None

    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    faite = await appeler(mcp, "generate_pose", character="Nain", poses=["saut"])
    await atelier.generations.attendre_tout()
    double.rendre = None

    assert faite["done"] is True and len(faite["images"]) == 1

    # La case est remplie, et c'est la matrice qui le dit — pas cet appel.
    apres = await appeler(mcp, "list_characters")
    remplie = next(p for p in apres["characters"][0]["poses"] if p["pose"] == "saut")
    assert remplie["body"] == faite["images"][0]["id"]

    # **Le signalement du personnage est parti avec l'image** (US-115) : l'agent
    # ne l'a pas retapé, et c'est le service qui l'a composé — le même que
    # l'écran appelle pour armer sa case.
    assert "un nain" in double.demandes[-1].prompt
    assert "saut" in double.demandes[-1].prompt


async def test_l_agent_habille_un_personnage_par_le_meme_chemin_que_l_ecran(
    atelier, mcp, client, double
):
    """La planche d'équipement de C3, armée par l'agent : N calques, un appel."""
    from test_c3 import habiller

    personnage, plan = _personnage(client, 2)
    _corps(client, double, personnage, plan)
    piece = _piece(client)

    double.repondre = lambda demande: habiller(demande, cases=2)
    faite = await appeler(
        mcp, "equip_character", character="Nain", piece="casque", poses=plan
    )
    await atelier.generations.attendre_tout()
    double.repondre = None

    assert faite["done"] is True
    # **Un seul appel payé pour deux poses** — c'est tout l'intérêt du pliage,
    # et l'agent en hérite sans rien en savoir.
    assert len(double.demandes) == 3  # deux corps, puis la planche

    vue = await appeler(mcp, "list_characters")
    for ligne in vue["characters"][0]["poses"]:
        assert len(ligne["layers"][piece]) == 1

    # La description de la pièce est partie, celle du personnage non : le corps
    # est dans l'image, et le redécrire inviterait le modèle à le redessiner.
    assert "casque de fer" in double.demandes[-1].prompt
    assert "un nain" not in double.demandes[-1].prompt


async def test_l_agent_sort_le_personnage_et_lit_de_quoi_ecrire_son_catalogue(
    atelier, mcp, client, double, tmp_path
):
    """« L'agent écrit lui-même les lignes de catalogue de son jeu à partir du
    descriptif. » (US-157)

    Ce qui se vérifie ici est ce dont il a besoin pour le faire : un chemin, un
    rôle, une pose, une pièce et sa place sur le corps. **Il regarde d'abord**
    (`RP17`) : `preview_output` annonce les fichiers sans rien écrire, et
    `write_output` les pose — les mêmes, aux mêmes noms, que ceux de l'écran.
    """
    personnage, plan, piece = _habille(client, double)
    dossier = tmp_path / "jeu" / "assets"

    vu = await appeler(
        mcp, "preview_output", subject="Nain", folder=str(dossier)
    )
    assert vu["compte"] == 5 and not dossier.exists()

    sortie = await appeler(
        mcp, "write_output", subject="Nain", folder=str(dossier)
    )

    assert Path(sortie["dossier"]) == dossier
    # **Ce qui est écrit est ce que l'aperçu annonçait**, et rien d'autre.
    assert [f["chemin"] for f in sortie["ecrits"]] == [
        f["chemin"] for f in vu["fichiers"]
    ]
    for fichier in sortie["ecrits"]:
        chemin = dossier / fichier["chemin"]
        assert chemin.is_file()
        assert fichier["role"] in ("corps", "calque", "descriptif")

    # Le descriptif est **aussi** posé dans le dossier, pour qui rouvrira le jeu
    # dans six mois sans l'atelier sous la main — et c'est lui qui porte le rôle,
    # la pose et la pièce de chaque fichier.
    descriptif = json.loads(Path(sortie["descriptif"]).read_text(encoding="utf-8"))
    assert descriptif["personnage"]["nom"] == "Nain"
    assert len(descriptif["assets"]) == 4
    calque = next(f for f in descriptif["assets"] if f["role"] == "calque")
    assert calque["piece"]["nom"] == "casque"
    assert calque["pose"]["identifiant"] in plan
    assert [e["nom"] for e in descriptif["emplacements"]] == ["tête"]


async def test_l_export_d_un_personnage_vide_refuse_l_agent_avec_la_phrase(
    atelier, mcp, client, tmp_path
):
    """L'agent n'a pas d'écran à griser : il reçoit la phrase du produit, pas
    une erreur de validation, et c'est elle qu'il répète à l'auteur."""
    _personnage(client, 2)
    raison = await refuser(
        mcp, "write_output", subject="Nain", folder=str(tmp_path / "jeu")
    )
    assert "rien ne sort" in raison

    # Et un sujet qui n'existe pas se dit, plutôt que de rendre un lot vide.
    inconnu = await refuser(
        mcp, "write_output", subject="le-passeur", folder=str(tmp_path / "jeu")
    )
    assert "aucun personnage" in inconnu
async def test_le_plafond_de_la_seance_arrete_aussi_les_appels_de_la_v2(
    atelier, mcp, client, double
):
    """« Au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de
    le relever, sans aucune invite à l'écran. » (US-85)"""
    personnage, plan = _personnage(client, 1)
    atelier.agent.regler(plafond=1, plafond_actif=True)

    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    await appeler(mcp, "generate_pose", character="Nain", poses=plan)
    await atelier.generations.attendre_tout()

    raison = await refuser(mcp, "generate_pose", character="Nain", poses=plan)
    double.rendre = None

    assert "plafond de la séance atteint" in raison
    assert "1 générations sur 1" in raison
    # Le moyen de le relever, dans la phrase même : l'agent n'a rien à inventer.
    assert "Réglages" in raison

    # **Et rien n'a été payé au passage** : le refus tombe avant l'appel.
    assert len(double.demandes) == 1


async def test_une_planche_d_equipement_ne_compte_qu_une_fois_au_plafond(
    atelier, mcp, client, double
):
    """Un lot plié est **un** appel : le compter N fois ferait mentir le plafond
    dans le sens qui coûte à l'auteur — celui qui l'arrête trop tôt."""
    from test_c3 import habiller

    personnage, plan = _personnage(client, 3)
    _corps(client, double, personnage, plan)
    atelier.agent.regler(plafond=1, plafond_actif=True)

    double.repondre = lambda demande: habiller(demande, cases=3)
    await appeler(mcp, "equip_character", character="Nain", piece=_piece(client), poses=plan)
    await atelier.generations.attendre_tout()
    double.repondre = None

    consommation = atelier.agent.consommation()
    assert consommation["generations"] == 1
    assert consommation["reste"] == 0


# ── Le MCP reste une façade ─────────────────────────────────────────────────


def test_le_mcp_de_la_v2_n_a_aucune_logique_propre():
    """« Chacun appelle un service que l'écran appelle déjà. »

    Ça ne se vérifie pas à l'exécution — on le lit dans les imports, comme en
    T7. C5 y ajoute `zipfile` : la seule fonction du fichier qui *faisait*
    quelque chose rouvrait l'archive de T6 pour en ressortir les fichiers un par
    un. Le geste est descendu dans le service, et l'outil n'est plus qu'une
    traduction.

    **Et `RP17` y ajoute la porte du dossier du jeu** : `preview_output` et
    `write_output` appellent `atelier.sortie`, celle que l'écran appelle, sans
    poser un octet eux-mêmes.
    """
    source = Path("atelier/mcp/serveur.py").read_text(encoding="utf-8")
    for interdit in (
        "from atelier.fournisseur",
        "from atelier.depot",
        "import sqlite3",
        "import httpx",
        "import zipfile",
    ):
        assert interdit not in source, f"le MCP importe « {interdit} »"


async def test_l_agent_et_l_ecran_arment_le_meme_sujet(atelier, mcp, client, double):
    """Ce que l'agent demande pour une case et ce que l'écran y met sont le même
    texte — parce que c'est le même service qui l'écrit.

    Deux compositions à deux endroits auraient fini par demander deux choses
    différentes pour la même case, sans que rien ne le signale.

    **Comparé sur le texte composé, pas sur le champ** — corrigé en écrivant E14.
    Le champ ne porte plus que le signalement ; la consigne de l'attitude est
    ajoutée par le composeur du prompt, pour les deux façades à la fois. Ce que
    l'écran affiche avant de payer et ce que l'agent envoie sont donc la même
    phrase, et c'est ce que ce test vérifie maintenant — une comparaison plus
    forte que la précédente, puisqu'elle porte sur ce qui part.
    """
    personnage, plan = _personnage(client, 1)

    champ = client.post(
        "/api/characters/subject", json={"personnage": personnage}
    ).json()["sujet"]
    a_l_ecran = client.post(
        "/api/prompt/preview",
        json={"prompt": champ, "personnage": personnage, "pose": plan[0]},
    ).json()["texte"]

    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    await appeler(mcp, "generate_pose", character="Nain", poses=plan)
    await atelier.generations.attendre_tout()
    double.rendre = None

    assert a_l_ecran == double.demandes[-1].prompt


async def test_un_nom_inconnu_est_refuse_avec_ce_qui_existe(atelier, mcp, client):
    """Rien n'est créé par mégarde : ni personnage, ni attitude, ni pièce.

    Une faute de frappe sur un nom de personnage est bien plus fréquente qu'une
    intention, et un fantôme créé au passage se retrouve des semaines après,
    vide, sans qu'on sache d'où il vient.
    """
    _personnage(client, 1)

    raison = await refuser(mcp, "generate_pose", character="Naine", poses=["repos"])
    assert "aucun personnage" in raison and "Nain" in raison

    raison = await refuser(mcp, "generate_pose", character="Nain", poses=["vol plané"])
    assert "aucune attitude" in raison

    raison = await refuser(
        mcp, "equip_character", character="Nain", piece="heaume", poses=["repos"]
    )
    assert "aucune pièce" in raison


async def test_la_selection_de_t7_est_retiree_et_le_geste_dit_ou_il_est_passe(
    atelier, mcp, client, double, tmp_path
):
    """`export_assets` ne répond plus (`RP17`), et ce qu'il faisait a deux suites.

    Il posait une sélection d'identifiants dans un dossier **sans rien montrer
    d'abord**, et aucun écran ne faisait ce geste-là : la galerie, elle, rend
    une archive. Le retirer est ce qui rend la parité vraie.

    - *l'image arrive où je code* reste portée par `folder`, sur l'outil qui
      vient de la fabriquer ou de la retoucher (T7, inchangé) ;
    - *le jeu sort* passe par la porte unique, qui annonce ses fichiers avant
      de les écrire.
    """
    from mcp.server.mcpserver.exceptions import MCPServerError

    reponse = await appeler(mcp, "generate_asset", subject="une épée")
    await atelier.generations.attendre_tout()

    try:
        await mcp.call_tool("export_assets", {"asset_ids": [], "folder": "x"})
    except MCPServerError as refus:
        assert "Unknown tool" in str(refus)
    else:
        raise AssertionError("export_assets répond encore")

    # Le premier des deux : l'image que l'agent vient de faire, posée où il code.
    ou_je_code = tmp_path / "src" / "art"
    pose = await appeler(
        mcp,
        "edit_asset",
        asset_id=reponse["images"][0]["id"],
        steps={"grille": {"cible": 32, "occupation": 100, "ancrage": "bas"}},
        folder=str(ou_je_code),
    )
    assert Path(pose["written_to"]).is_file()

    # Le second : un sujet du jeu sort par la porte unique, vu puis écrit.
    personnage, _, _ = _habille(client, double, poses=1)
    dossier = tmp_path / "jeu"
    vu = await appeler(
        mcp, "preview_output", subject="Nain", folder=str(dossier)
    )
    assert not dossier.exists()
    sortie = await appeler(
        mcp, "write_output", subject="Nain", folder=str(dossier)
    )
    assert [f["chemin"] for f in sortie["ecrits"]] == [
        f["chemin"] for f in vu["fichiers"]
    ]

    descriptif = json.loads(Path(sortie["descriptif"]).read_text(encoding="utf-8"))
    assert descriptif["personnage"]["identifiant"] == personnage
    image_posee = next(f for f in descriptif["assets"])
    with Image.open(
        io.BytesIO((dossier / image_posee["fichier"]).read_bytes())
    ) as image:
        assert image.format == "PNG"
        assert (image.width, image.height) == (
            image_posee["dimensions"]["largeur"],
            image_posee["dimensions"]["hauteur"],
        )
