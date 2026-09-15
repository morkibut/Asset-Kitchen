"""RP10 : la livraison décide au lieu de bloquer.

Un conflit ne ferme plus la porte : il attend une décision de l'auteur —
conserver, copier à côté, remplacer. Ce qui est vérifié ici est la promesse
inverse de la fonctionnalité : **aucun fichier du jeu n'est écrasé sans une
décision écrite**, et une décision ne vaut que pour le fichier qu'elle a vu.

Les essais rouvrent l'atelier entre la décision et la livraison : un objet
qu'on sait écrire et qu'on ne sait pas relire n'est pas fini (`AGENTS.md`).
Aucun appel fournisseur, aucun centime.
"""

from __future__ import annotations

import io

import pytest
from PIL import Image, ImageDraw

from atelier.domaine.bande import ALLER_RETOUR, Bande, Prise
from atelier.services import Atelier
from atelier.services.livraison import LivraisonRefusee

LE_TRAVAIL_DE_LAUTEUR = b"Le travail de l'auteur"


def _bande(atelier, projet, personnage, identifiant="marche-1", pose="marche",
           direction="ouest", cadence=16):
    bande = Bande(identifiant=identifiant, clip="clip-source", nom=identifiant,
                  projet=projet, personnage=personnage, pose=pose, direction=direction,
                  prises=tuple(Prise(i) for i in range(4)), cadence=cadence,
                  sens=ALLER_RETOUR, case_largeur=12, case_hauteur=16)
    image = Image.new("RGBA", (48, 16))
    dessin = ImageDraw.Draw(image)
    for i, couleur in enumerate(["red", "green", "blue", "yellow"]):
        dessin.rectangle((i * 12 + 2, 2, i * 12 + 9, 14), fill=couleur)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(bande.clip, identifiant, tampon.getvalue())
    atelier.fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
    atelier.base.enregistrer_bande(bande)
    return bande


@pytest.fixture
def decor(atelier, tmp_path):
    projet = atelier.bibliotheque.creer_projet("Le jeu RP10").identifiant
    personnage = atelier.production.creer_personnage(projet, "Le pèlerin").identifiant
    godot = tmp_path / "Jeu Godot"
    godot.mkdir()
    (godot / "project.godot").write_text(
        'config_version=5\n[application]\nconfig/name="Essai RP10"\n'
        'config/features=PackedStringArray("4.7", "GL Compatibility")\n', encoding="utf-8")
    bande = _bande(atelier, projet, personnage)
    atelier.livraison.associer(projet, str(godot))
    return projet, personnage, godot, bande


def _en_conflit(atelier, decor):
    """Une préparation dont la scène stable a été réécrite à la main dans le jeu."""
    projet, personnage, godot, bande = decor
    premiere = atelier.livraison.prevoir(projet, personnage, [bande.identifiant])
    stable = godot / premiere["scene"].removeprefix("res://")
    stable.parent.mkdir(parents=True, exist_ok=True)
    stable.write_bytes(LE_TRAVAIL_DE_LAUTEUR)
    preparation = atelier.livraison.prevoir(projet, personnage, [bande.identifiant])
    conflit = next(c for c in preparation["conflits"] if c["chemin"] in premiere["scene"])
    return preparation, stable, conflit


def _rouvert(atelier, double):
    """Le même dossier, un service neuf : la décision doit se relire sur disque."""
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    autre.bibliotheque.ouvrir()
    return autre.livraison


# ── La forme ────────────────────────────────────────────────────────────────


def test_un_conflit_porte_son_chemin_sa_raison_et_sa_decision_vide(atelier, decor):
    preparation, _, conflit = _en_conflit(atelier, decor)
    assert conflit["raison"] == "Fichier inconnu de l'atelier."
    assert conflit["decision"] is None
    assert preparation["pret"] is False


def test_pret_est_chaque_conflit_decide_et_non_aucun_conflit(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, _, conflit = _en_conflit(atelier, decor)
    relu = _rouvert(atelier, double).decider(projet, preparation["jeton"], conflit["chemin"], "conserver")
    assert relu["conflits"][0]["decision"] == "conserver"
    # Le conflit est toujours là : c'est la décision qui ouvre la porte.
    assert len(relu["conflits"]) == 1
    assert relu["pret"] is True


def test_une_decision_refusee_hors_des_trois(atelier, decor):
    projet, personnage, godot, bande = decor
    preparation, _, conflit = _en_conflit(atelier, decor)
    with pytest.raises(LivraisonRefusee, match="conserver"):
        atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "effacer")


def test_decider_un_fichier_sans_conflit_ne_veut_rien_dire(atelier, decor):
    projet, personnage, godot, bande = decor
    preparation, _, conflit = _en_conflit(atelier, decor)
    tranquille = next(f["chemin"] for f in preparation["fichiers"] if f["etat"] != "conflit")
    with pytest.raises(LivraisonRefusee, match="rien à décider"):
        atelier.livraison.decider(projet, preparation["jeton"], tranquille, "remplacer")


# ── Ce que chaque décision écrit dans le dossier du jeu ─────────────────────


def test_conserver_n_ecrit_rien_a_cet_endroit_et_laisse_partir_le_reste(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "conserver")
    livree = _rouvert(atelier, double).livrer(projet, preparation["jeton"])
    assert livree["etat"] == "terminee"
    assert stable.read_bytes() == LE_TRAVAIL_DE_LAUTEUR
    assert not (godot / (conflit["chemin"] + ".copie-atelier")).exists()
    for fichier in livree["fichiers"]:
        if fichier["chemin"] != conflit["chemin"]:
            assert (godot / fichier["chemin"]).is_file()


def test_copier_a_cote_pose_un_voisin_et_ne_touche_pas_au_fichier_du_jeu(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    relu = atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "copier")
    voisin = relu["conflits"][0]["voisin"]
    assert voisin.endswith(".copie-atelier.tscn")
    _rouvert(atelier, double).livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == LE_TRAVAIL_DE_LAUTEUR
    attendu = next(f["empreinte"] for f in preparation["fichiers"] if f["chemin"] == conflit["chemin"])
    import hashlib
    assert hashlib.sha256((godot / voisin).read_bytes()).hexdigest() == attendu


def test_remplacer_ecrit_par_dessus_et_le_fichier_devient_celui_de_l_atelier(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "remplacer")
    atelier.livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() != LE_TRAVAIL_DE_LAUTEUR
    assert b"gd_scene" in stable.read_bytes()
    # Le fichier est désormais connu : la préparation suivante ne le signale plus.
    suivante = atelier.livraison.prevoir(projet, personnage, [bande.identifiant])
    assert suivante["conflits"] == []
    assert suivante["pret"] is True


# ── Rien n'est écrasé sans décision ─────────────────────────────────────────


def test_sans_decision_la_livraison_refuse_et_le_fichier_du_jeu_reste(atelier, decor):
    projet, personnage, godot, bande = decor
    preparation, stable, _ = _en_conflit(atelier, decor)
    with pytest.raises(LivraisonRefusee, match="Conflit"):
        atelier.livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == LE_TRAVAIL_DE_LAUTEUR


def test_une_decision_ne_vaut_que_pour_le_fichier_qu_elle_a_vu(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "remplacer")
    # L'auteur retouche son fichier après avoir décidé : la décision tombe.
    deuxieme_jet = LE_TRAVAIL_DE_LAUTEUR + " — deuxième jet".encode("utf-8")
    stable.write_bytes(deuxieme_jet)
    livraison = _rouvert(atelier, double)
    with pytest.raises(LivraisonRefusee, match="Conflit"):
        livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == deuxieme_jet
    assert livraison.historique(projet)["livraisons"][0]["conflits"][0]["decision"] is None


def test_copier_refuse_quand_le_voisin_existe_deja_et_n_est_pas_de_l_atelier(atelier, decor):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    voisin = godot / (conflit["chemin"].removesuffix(".tscn") + ".copie-atelier.tscn")
    voisin.write_bytes(b"Une copie que l'auteur a faite lui-meme")
    with pytest.raises(LivraisonRefusee, match="existe déjà"):
        atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "copier")
    assert voisin.read_bytes() == b"Une copie que l'auteur a faite lui-meme"


def test_reprendre_une_revision_ne_reconduit_aucune_decision(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "conserver")
    terminee = atelier.livraison.livrer(projet, preparation["jeton"])
    assert stable.read_bytes() == LE_TRAVAIL_DE_LAUTEUR
    reprise = _rouvert(atelier, double).reprendre(projet, terminee["jeton"])
    assert reprise["conflits"] and reprise["conflits"][0]["decision"] is None
    assert reprise["pret"] is False


# ── Ce que la relecture annonçait, et rien d'autre ──────────────────────────


def test_la_cadence_et_le_sens_de_la_preparation_survivent_a_une_decision(atelier, decor, double):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    annonce = preparation["animations"][0]
    # La bibliothèque bouge pendant que la décision se prend.
    bande.cadence = 3
    atelier.base.enregistrer_bande(bande)
    atelier.livraison.decider(projet, preparation["jeton"], conflit["chemin"], "remplacer")
    livree = _rouvert(atelier, double).livrer(projet, preparation["jeton"])
    ecrite = livree["animations"][0]
    assert (ecrite["cadence"], ecrite["ordre"], ecrite["duree_image_ms"]) == \
           (annonce["cadence"], annonce["ordre"], annonce["duree_image_ms"])
    assert ecrite["cadence"] == 16


def test_un_brouillon_arrete_la_livraison_et_dit_ce_qui_manque(atelier, decor):
    projet, personnage, godot, bande = decor
    brouillon = _bande(atelier, projet, personnage, "essai-1", pose="", direction="")
    with pytest.raises(LivraisonRefusee, match="brouillon"):
        atelier.livraison.prevoir(projet, personnage, [brouillon.identifiant])


# ── La route ────────────────────────────────────────────────────────────────


def test_la_route_pose_la_decision_et_la_livraison_part(client, atelier, decor):
    projet, personnage, godot, bande = decor
    preparation, stable, conflit = _en_conflit(atelier, decor)
    refus = client.post(f"/api/projects/{projet}/deliveries", json={"jeton": preparation["jeton"]})
    assert refus.status_code >= 400
    pose = client.post(f"/api/projects/{projet}/deliveries/{preparation['jeton']}/decisions",
                       json={"chemin": conflit["chemin"], "decision": "conserver"})
    assert pose.status_code == 200
    assert pose.json()["pret"] is True
    assert pose.json()["conflits"][0]["decision"] == "conserver"
    assert client.post(f"/api/projects/{projet}/deliveries",
                       json={"jeton": preparation["jeton"]}).json()["etat"] == "terminee"
    assert stable.read_bytes() == LE_TRAVAIL_DE_LAUTEUR
