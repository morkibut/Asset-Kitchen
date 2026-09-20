# -*- coding: utf-8 -*-
"""RG9 — quatre écarts du serveur trouvés par la relecture croisée du chantier
« rangement » (`docs/PLAN-rangement.md`, `docs/RG5-la-bibliotheque-des-matieres.md`).

Chaque essai nomme la panne qu'il empêche :

- **S1** une image qui naîtrait matière ET rangée dans un sujet, parce que la
  génération visait une case — l'invariant de RG5 §4 (« une matière n'a ni sujet,
  ni pose, ni direction ») ne tiendrait qu'après la migration ;
- **S2** l'agent qui marquerait matière l'image d'un autre jeu, ou d'aucun, là où
  l'écran la refuse ;
- **S3** une matière qui dirait deux tailles : celle du brut à l'écran, celle du
  rendu à l'agent ;
- **S4** une migration en échec, ou des sujets vidés, que personne ne pourrait lire.

Aucun essai ne coûte un centime, aucun n'appelle un fournisseur, et tous écrivent
sur un dossier temporaire — jamais sur `donnees/`.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mcp.server.mcpserver.exceptions import ToolError
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.domaine.recette import Recette
from atelier.services.tuiles import png
from test_rg8_migration_matieres import (
    _cas_reel,
    _image_ecrite,
    _jeu,
    _octets,
    _relire,
    _sujet_ecrit,
)
from tests.test_tu10_agent import agent, sans_node  # noqa: F401 (banc de TU10, réutilisé tel quel)


# ── S1 : une matière naît sans sujet, sans pose, sans direction ──────────────


def _naitre(atelier, projet: str, identifiant: str, **demande) -> str:
    """La naissance d'une image dont la génération **visait une case de sujet**."""
    brut = atelier.fichiers.ecrire_brut(identifiant, 0, _octets(), ".png")
    generation = Generation(
        identifiant=identifiant,
        modele="essai:rend-du-png",
        demande={"prompt": "un mur", "sujet": "", **demande},
        parametres_resolus={},
        projet=projet,
        personnage="pelerin",
        pose="fixe",
        direction="sud",
        emplacements=[],
    )
    emplacement = Emplacement(
        rang=0,
        statut=Statut.REUSSIE,
        resultat=Resultat(fichier=brut, largeur=8, hauteur=8, type_media="image/png", octets=1),
    )
    atelier.assets.naitre(generation, emplacement)
    return f"{identifiant}-0"


def test_s1_une_matiere_visant_une_case_de_sujet_nait_sans_sujet(atelier):
    projet = _jeu(atelier)
    identifiant = _naitre(atelier, projet, "s1a", echelle="matière")

    asset = atelier.assets.lire(identifiant)
    assert asset.matiere is True
    assert (asset.personnage, asset.pose, asset.direction) == (None, None, None)
    assert asset.personnage_supprime is False
    # Et c'est ce que le disque dit, pas seulement l'index.
    assert [m.identifiant for m in atelier.bibliotheque.matieres(projet)] == [identifiant]
    sur_le_disque = atelier.fichiers.lire_asset("s1a", 0)
    assert not sur_le_disque.get("personnage") and not sur_le_disque.get("pose")
    assert not sur_le_disque.get("direction")


def test_s1_une_generation_ordinaire_garde_sa_case(atelier):
    projet = _jeu(atelier)
    identifiant = _naitre(atelier, projet, "s1b")

    asset = atelier.assets.lire(identifiant)
    assert asset.matiere is False
    assert (asset.personnage, asset.pose, asset.direction) == ("pelerin", "fixe", "sud")


def test_s1_une_relance_apres_retrait_de_la_marque_suit_l_auteur(atelier):
    """Ce que l'auteur a décidé l'emporte : marque retirée, image rangée à la main
    dans un sujet — la relance de l'appel ne défait ni l'un ni l'autre."""
    projet = _jeu(atelier)
    identifiant = _naitre(atelier, projet, "s1c", echelle="matière")
    atelier.bibliotheque.declarer_matiere(identifiant, False, projet=projet)
    asset = atelier.assets.lire(identifiant)
    asset.personnage = "chene"
    asset.pose = "repos"
    atelier.assets.sauver(asset)

    assert _naitre(atelier, projet, "s1c", echelle="matière") == identifiant

    relancee = atelier.assets.lire(identifiant)
    assert relancee.matiere is False
    assert (relancee.personnage, relancee.pose) == ("chene", "repos")


def test_s1_une_relance_d_une_matiere_reste_matiere_sans_sujet(atelier):
    projet = _jeu(atelier)
    identifiant = _naitre(atelier, projet, "s1d", echelle="matière")
    _naitre(atelier, projet, "s1d", echelle="matière")

    relancee = atelier.assets.lire(identifiant)
    assert relancee.matiere is True
    assert (relancee.personnage, relancee.pose, relancee.direction) == (None, None, None)


# ── S2 : `edit_asset(material=…)` passe par le contrôle de jeu de l'écran ────


def _importer(atelier, projet, nom, couleur=(90, 90, 90, 255)):
    octets = png(Image.new("RGBA", (16, 16), couleur))
    return atelier.generations.importer(octets, nom, projet=projet, forcer=True)["asset"]["identifiant"]


async def test_s2_l_image_d_un_autre_jeu_est_refusee_a_l_agent(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Un mur")
    autre = atelier.bibliotheque.creer_projet("Un autre jeu").identifiant  # il s'ouvre aussitôt
    assert atelier.bibliotheque.courant == autre

    with pytest.raises(ToolError, match="rangée dans un autre jeu") as refus:
        await appeler("edit_asset", asset_id=identifiant, material=True)
    # La phrase du produit, mot pour mot : celle que la route HTTP rend.
    assert "ouvre ce jeu pour la déclarer matière" in str(refus.value)
    assert atelier.assets.lire(identifiant).matiere is False

    # Nommer le jeu de l'image suffit : même geste que l'adresse de l'écran.
    dit = await appeler("edit_asset", asset_id=identifiant, material=True, project=projet)
    assert dit["material"] is True
    # Et le retirer par le mauvais jeu est refusé aussi : l'adresse ment sur ce qu'elle touche.
    with pytest.raises(ToolError, match="rangée dans un autre jeu"):
        await appeler("edit_asset", asset_id=identifiant, material=False)


async def test_s2_l_image_du_jeu_ouvert_est_marquee_comme_avant(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Un mur")
    assert (await appeler("edit_asset", asset_id=identifiant, material=True))["material"] is True
    assert (await appeler("edit_asset", asset_id=identifiant, material=False))["material"] is False


async def test_s2_un_jeu_inconnu_est_refuse_avec_la_liste(agent):
    atelier, projet, _, _, appeler = agent
    identifiant = _importer(atelier, projet, "Un mur")
    with pytest.raises(ToolError, match="aucun projet « fantome »"):
        await appeler("edit_asset", asset_id=identifiant, material=True, project="fantome")


# ── S3 : l'écran et l'agent disent les mêmes dimensions ──────────────────────


async def test_s3_la_route_et_list_materials_disent_la_meme_chose(agent):
    atelier, projet, _, _, appeler = agent
    remise = _importer(atelier, projet, "Remise sur grille", (90, 90, 90, 255))
    brute = _importer(atelier, projet, "Brute", (40, 140, 40, 255))
    rangee = _importer(atelier, projet, "Rangée", (140, 40, 40, 255))
    for identifiant in (remise, brute, rangee):
        await appeler("edit_asset", asset_id=identifiant, material=True)
    # Une matière dont le rendu n'a pas la taille du brut : c'est elle qui a divergé.
    atelier.assets.poser_recette(remise, Recette.depuis_json({"grille": {"cible": 96, "occupation": 100}}))
    modifiee = atelier.assets.lire(remise)
    assert (modifiee.rendu_largeur, modifiee.rendu_hauteur) != (modifiee.largeur, modifiee.hauteur)
    collection = atelier.bibliotheque.creer_collection("Pierres")
    from atelier.domaine.projet import MATIERE
    atelier.bibliotheque.ranger_sujet(collection.identifiant, projet, rangee, genre=MATIERE)

    liste = {m["id"]: m for m in (await appeler("list_materials"))["materials"]}
    with TestClient(creer_application(atelier)) as client:
        reponse = client.get(f"/api/projects/{projet}/materials")
    assert reponse.status_code == 200, reponse.text
    ecran = {m["identifiant"]: m for m in reponse.json()["matieres"]}

    assert set(ecran) == set(liste) == {remise, brute, rangee}
    for identifiant in ecran:
        a, m = ecran[identifiant], liste[identifiant]
        assert (a["largeur"], a["hauteur"]) == (m["width"], m["height"]), identifiant
        assert (a["nom"], a["cadrage"], a["cree_le"]) == (m["name"], m["framing"], m["created"])
        assert [(c["identifiant"], c["nom"]) for c in a["collections"]] == [
            (c["id"], c["name"]) for c in m["collections"]
        ]
        assert (a["detouree"], a["refaisable"]) == (m["cut_out"], m["redoable"])
    # Le rendu, jamais le brut : la même règle que `list_assets`.
    assert (ecran[remise]["largeur"], ecran[remise]["hauteur"]) == (
        modifiee.rendu_largeur,
        modifiee.rendu_hauteur,
    )
    assert ecran[remise]["largeur"] != modifiee.largeur
    assert [c["nom"] for c in ecran[rangee]["collections"]] == ["Pierres"]
    # La fiche d'une seule matière (GET /materials/{asset}) dit la même chose que la liste.
    with TestClient(creer_application(atelier)) as client:
        seule = client.get(f"/api/projects/{projet}/materials/{remise}").json()
    assert seule == ecran[remise]


# ── S4 : ce que la migration a laissé se lit sur la route des matières ───────


def _lire(client, projet: str) -> dict:
    reponse = client.get(f"/api/projects/{projet}/materials")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_s4_un_jeu_sans_rien_rend_deux_listes_vides(atelier, client):
    projet = _jeu(atelier)
    corps = _lire(client, projet)
    assert corps["matieres"] == []
    assert corps["sujets_vides"] == []
    assert corps["non_migrees"] == []
    assert corps["migration_refusee"] is None


def test_s4_le_sujet_vide_par_la_migration_se_lit_puis_disparait_quand_on_le_jette(atelier, client):
    projet, premiere, seconde = _cas_reel(atelier)
    # Aucune passe encore : c'est la lecture de la bibliothèque qui la déclenche, comme pour l'agent.
    atelier.bibliotheque._matieres_verifiees.discard(projet)  # noqa: SLF001

    corps = _lire(client, projet)
    assert {m["identifiant"] for m in corps["matieres"]} == {premiere, seconde}
    assert corps["sujets_vides"] == [{"identifiant": "matieres", "nom": "Matières"}]
    assert corps["non_migrees"] == []
    # Deux lectures de suite disent la même chose : la passe suivante ne migre plus rien.
    assert _lire(client, projet)["sujets_vides"] == corps["sujets_vides"]

    jete = client.delete("/api/characters/matieres", params={"projet": projet})
    assert jete.status_code == 200, jete.text
    assert _lire(client, projet)["sujets_vides"] == []


def test_s4_un_sujet_de_nouveau_rempli_n_est_plus_vide(atelier, client):
    projet, premiere, _ = _cas_reel(atelier)
    atelier.bibliotheque.migrer_matieres(projet)
    assert _lire(client, projet)["sujets_vides"] == [{"identifiant": "matieres", "nom": "Matières"}]

    asset = atelier.assets.lire(premiere)
    asset.personnage = "matieres"
    atelier.assets.sauver(asset)

    assert _lire(client, projet)["sujets_vides"] == []


def test_s4_les_images_sautees_sont_dites_avec_leur_raison(atelier, client):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    abimee = _image_ecrite(atelier, projet, "ggg1", sujet="matieres")
    perdue = _image_ecrite(atelier, projet, "ggg2", sujet="matieres")
    bonne = _image_ecrite(atelier, projet, "ggg3", sujet="matieres")
    _relire(atelier)
    (atelier.fichiers.generations / "ggg1" / "0-asset.json").write_bytes(b"{ ceci n'est pas du json")
    (atelier.fichiers.generations / "ggg2" / "0-brut.png").unlink()
    atelier.bibliotheque._matieres_verifiees.discard(projet)  # noqa: SLF001

    corps = _lire(client, projet)

    raisons = {i["identifiant"]: i["raison"] for i in corps["non_migrees"]}
    assert set(raisons) == {abimee, perdue}
    assert "illisible" in raisons[abimee] and "brute" in raisons[perdue]
    assert all(set(i) == {"identifiant", "raison"} for i in corps["non_migrees"])
    assert [m["identifiant"] for m in corps["matieres"]] == [bonne]
    # Deux images n'ont pas migré : le sujet en garde, il n'est pas vide.
    assert corps["sujets_vides"] == []
    assert corps["migration_refusee"] is None


def test_s4_le_rapport_d_une_passe_lancee_a_la_main_est_gardé_aussi(atelier, client):
    """`POST .../migrate` rend son rapport à l'appelant, mais l'écran relit la route des
    matières : les deux doivent dire la même chose des images sautées."""
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    perdue = _image_ecrite(atelier, projet, "hhh1", sujet="matieres")
    _relire(atelier)
    (atelier.fichiers.generations / "hhh1" / "0-brut.png").unlink()

    rapport = client.post(f"/api/projects/{projet}/materials/migrate").json()
    assert [i["identifiant"] for i in rapport["ignorees"]] == [perdue]
    assert [i["identifiant"] for i in _lire(client, projet)["non_migrees"]] == [perdue]


def test_s4_choisir_un_jeu_garde_le_rapport_de_l_ouverture(atelier, client):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    perdue = _image_ecrite(atelier, projet, "iii1", sujet="matieres")
    _relire(atelier)
    (atelier.fichiers.generations / "iii1" / "0-brut.png").unlink()
    atelier.bibliotheque._matieres_verifiees.discard(projet)  # noqa: SLF001

    atelier.bibliotheque.choisir(projet)  # le rapport de la passe est jeté à l'appelant…

    # … et pourtant relisible, sans nouvelle passe.
    assert [i["identifiant"] for i in atelier.bibliotheque.etat_de_la_migration(projet)["non_migrees"]] == [perdue]


def test_s4_un_journal_illisible_ne_reste_pas_muet(atelier, client):
    projet, _, _ = _cas_reel(atelier)
    atelier.fichiers.journal_matieres_du_jeu(projet).write_bytes(b"\x00\x01 pas un journal")
    atelier.bibliotheque._matieres_verifiees.discard(projet)  # noqa: SLF001

    corps = _lire(client, projet)

    assert corps["migration_refusee"] and "illisible" in corps["migration_refusee"]
    assert corps["sujets_vides"] == [] and corps["non_migrees"] == []


def test_s4_un_jeu_inconnu_est_refuse_en_404(client):
    assert client.get("/api/projects/fantome/materials").status_code == 404
