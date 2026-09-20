# -*- coding: utf-8 -*-
"""RG8 (première moitié) — les matières déjà rangées dans un sujet rejoignent la
bibliothèque sans perdre leur nom (`docs/RG5-la-bibliotheque-des-matieres.md` §5).

**Ces essais réécrivent des fichiers — sur un dossier temporaire, jamais sur
`donnees/`.** Le cas réel est celui de `donnees/projets/la-foret-magique/` : un sujet
« Matières » de nature *décor*, deux images qu'il porte, dont la fiche n'a pas de
champ `matiere` (elle a été écrite avant RG5) et dont le `label` est le texte anglais de
l'envoi. Les essais posent ces fichiers à la main, à l'identique, puis relisent
l'atelier comme il se relit au démarrage.

Chaque essai nomme la panne qu'il empêche :

- une matière qui perdrait son nom en changeant de rangement ;
- un sujet nommé « Matières » qui emporterait de vrais décors, parce que la règle
  aurait lu son nom au lieu de lire la génération ;
- un groupement de l'auteur qui ne survivrait pas au déménagement ;
- une seconde passe qui réécrirait quelque chose, ou qui rendrait à l'image une
  marque que l'auteur lui a retirée ;
- une migration qui ne laisserait rien pour revenir en arrière ;
- une image illisible, ou un journal abîmé, qui ferait perdre plus qu'ils ne
  contiennent — ou qui empêcherait d'ouvrir le jeu.

Aucun essai ne coûte un centime, et aucun n'appelle un fournisseur.
"""
from __future__ import annotations

import io
import json

import pytest
from PIL import Image

from atelier.domaine.asset import Asset
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.domaine.personnage import Personnage
from atelier.domaine.projet import MATIERE, SUJET, Membre
from atelier.services.bibliotheque import (
    JOURNAL_MATIERES,
    ProjetInconnu,
    ServiceBibliotheque,
)

PHRASE_ANGLAISE = "Game asset tile, pixel art, old dwarven mine stone, hand-cut"
AUTRE_PHRASE = "Game asset tile, pixel art, pavé de pierre, worn brown slabs"


# ── Le disque de l'auteur, refait à la main ──────────────────────────────────


def _octets() -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", (8, 8), (90, 70, 50)).save(tampon, format="PNG")
    return tampon.getvalue()


def _jeu(atelier) -> str:
    """Le jeu « la foret magique » : il existe, il est ouvert, rien n'y est encore rangé."""
    atelier.bibliotheque.ouvrir()
    return atelier.bibliotheque.creer_projet("La forêt magique").identifiant


def _sujet_ecrit(atelier, projet: str, identifiant: str, nom: str, nature: str = "décor") -> None:
    sujet = Personnage(identifiant=identifiant, projet=projet, nom=nom, type=nature)
    atelier.fichiers.ecrire_personnage(projet, identifiant, sujet.en_json())


def _image_ecrite(
    atelier,
    projet: str,
    generation: str,
    *,
    sujet: str | None = None,
    label: str = PHRASE_ANGLAISE,
    echelle: str | None = "matière",
    pose: str | None = None,
    direction: str | None = None,
    matiere: bool | None = None,
) -> str:
    """Une image telle que le disque de l'auteur la porte : la génération qui l'a
    demandée, sa fiche, son brut. **La fiche n'a pas de champ `matiere`** — elle a été
    écrite avant RG5 — sauf si l'essai en décide autrement."""
    brut = atelier.fichiers.ecrire_brut(generation, 0, _octets(), ".png")
    demande: dict = {"prompt": label, "sujet": ""}
    if echelle is not None:
        demande["echelle"] = echelle
    atelier.fichiers.ecrire_enregistrement(
        generation,
        Generation(
            identifiant=generation,
            modele="essai:rend-du-png",
            demande=demande,
            parametres_resolus={},
            projet=projet,
            emplacements=[
                Emplacement(
                    rang=0,
                    statut=Statut.REUSSIE,
                    resultat=Resultat(
                        fichier=brut, largeur=8, hauteur=8, type_media="image/png", octets=1
                    ),
                )
            ],
        ).en_json(),
    )
    fiche = Asset(
        identifiant=f"{generation}-0",
        generation=generation,
        rang=0,
        brut=brut,
        largeur=8,
        hauteur=8,
        type_media="image/png",
        label=label,
        projet=projet,
        personnage=sujet,
        pose=pose,
        direction=direction,
        matiere=bool(matiere),
    ).en_disque()
    if matiere is None:
        fiche.pop("matiere")
    atelier.fichiers.ecrire_asset(generation, 0, fiche)
    return f"{generation}-0"


def _relire(atelier) -> None:
    """Le démarrage : l'index est refait des fichiers, comme si l'atelier venait de s'ouvrir."""
    atelier.bibliotheque.reconstruire()


def _fiche(atelier, identifiant: str) -> Asset:
    """L'image **lue sur le disque**, pas dans l'index."""
    generation, rang = identifiant.rsplit("-", 1)
    return Asset.depuis_json(atelier.fichiers.lire_asset(generation, int(rang)))


def _octets_du_fichier(atelier, generation: str) -> bytes:
    return (atelier.fichiers.generations / generation / "0-asset.json").read_bytes()


def _instantane(atelier) -> dict[str, bytes]:
    """Tous les fichiers de `donnees/`, octet par octet — sauf l'index, qui est un cache."""
    racine = atelier.fichiers.racine
    return {
        p.relative_to(racine).as_posix(): p.read_bytes()
        for p in racine.rglob("*")
        if p.is_file() and "sqlite3" not in p.name
    }


def _journal(atelier, projet: str) -> dict:
    return json.loads(atelier.fichiers.journal_matieres_du_jeu(projet).read_text(encoding="utf-8"))


def _type_du_sujet(atelier, projet: str, identifiant: str) -> str:
    return atelier.fichiers.lire_personnage(projet, identifiant)["type"]


# ── Le cas réel : un sujet « Matières » et ses deux images ───────────────────


def _cas_reel(atelier) -> tuple[str, str, str]:
    """Ce que `la-foret-magique` porte sur le disque de l'auteur : un sujet `matieres`
    de nature *décor*, et deux images qui le portent, avec le texte anglais pour nom."""
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    premiere = _image_ecrite(atelier, projet, "7b894dcedf4e4271afa61cdf358f07ae", sujet="matieres")
    seconde = _image_ecrite(
        atelier, projet, "7c96f9bb051e4a9abc93e26b46917e93", sujet="matieres", label=AUTRE_PHRASE
    )
    _relire(atelier)
    return projet, premiere, seconde


def test_a_les_deux_images_migrent_gardent_leur_nom_et_le_sujet_reste(atelier):
    projet, premiere, seconde = _cas_reel(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert rapport["refusee"] is None
    assert rapport["nombre"] == 2
    assert {m["identifiant"] for m in rapport["migrees"]} == {premiere, seconde}
    for identifiant, nom in ((premiere, PHRASE_ANGLAISE), (seconde, AUTRE_PHRASE)):
        sur_le_disque = _fiche(atelier, identifiant)
        assert sur_le_disque.matiere is True
        assert sur_le_disque.personnage is None
        assert sur_le_disque.pose is None and sur_le_disque.direction is None
        assert sur_le_disque.label == nom  # « aucune matière ne perd son nom »
    # Le sujet est encore là — vide — et le rapport le dit : l'écran proposera de le jeter.
    assert atelier.fichiers.lire_personnage(projet, "matieres") is not None
    assert rapport["sujets_vides"] == [{"identifiant": "matieres", "nom": "Matières"}]

    # Et c'est le disque qui le dit : relu comme au démarrage, rien ne change.
    _relire(atelier)
    noms = {m.identifiant: m.label for m in atelier.bibliotheque.matieres(projet)}
    assert noms == {premiere: PHRASE_ANGLAISE, seconde: AUTRE_PHRASE}


def test_a_une_image_sans_sujet_mais_nee_d_une_demande_de_matiere_migre_aussi(atelier):
    """Mesuré sur `la-foret-magique` : quatre autres images ont demandé
    `echelle="matière"` et ne sont rangées dans aucun sujet. La règle se lit sur la
    génération, quel que soit le sujet — ou son absence."""
    projet = _jeu(atelier)
    libre = _image_ecrite(atelier, projet, "17f392f8b9554f2d9d53a5e166571d95", label=AUTRE_PHRASE)
    _relire(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert [m["identifiant"] for m in rapport["migrees"]] == [libre]
    assert _fiche(atelier, libre).matiere is True
    assert _fiche(atelier, libre).label == AUTRE_PHRASE
    assert rapport["sujets_vides"] == []  # aucun sujet n'a été vidé


# ── Le nom ───────────────────────────────────────────────────────────────────


def test_b_un_label_vide_prend_le_nom_du_sujet_quitte(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    sans_nom = _image_ecrite(atelier, projet, "aaa1", sujet="matieres", label="")
    nommee = _image_ecrite(atelier, projet, "aaa2", sujet="matieres", label=PHRASE_ANGLAISE)
    _relire(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert _fiche(atelier, sans_nom).label == "Matières"
    assert _fiche(atelier, nommee).label == PHRASE_ANGLAISE  # elle garde le sien
    par_id = {m["identifiant"]: m for m in rapport["migrees"]}
    assert par_id[sans_nom]["nom_pris_au_sujet"] is True
    assert par_id[nommee]["nom_pris_au_sujet"] is False
    assert rapport["sans_nom"] == []


def test_b_aucune_matiere_n_en_gagne_un_faux(atelier):
    """Pas de sujet à qui emprunter un nom : le label reste vide, et le rapport le dit
    plutôt que d'inventer — le nom de l'identifiant, par exemple, n'est pas un nom."""
    projet = _jeu(atelier)
    orpheline = _image_ecrite(atelier, projet, "aaa3", label="")
    # Le sujet n'existe plus : l'image en porte encore l'identifiant.
    disparue = _image_ecrite(atelier, projet, "aaa4", sujet="sujet-jete", label="")
    _relire(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert _fiche(atelier, orpheline).label == ""
    assert _fiche(atelier, disparue).label == ""
    assert _fiche(atelier, disparue).personnage is None
    assert set(rapport["sans_nom"]) == {orpheline, disparue}


# ── La règle se lit sur la génération, jamais sur le nom du sujet ────────────


def test_c_un_sujet_nomme_matieres_qui_tient_un_vrai_decor_ne_perd_rien(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    vraie_matiere = _image_ecrite(atelier, projet, "bbb1", sujet="matieres")
    un_decor = _image_ecrite(
        atelier, projet, "bbb2", sujet="matieres", label="Une clairière", echelle=None,
        pose="fixe", direction="sud",
    )
    _relire(atelier)
    fiche_du_decor = _octets_du_fichier(atelier, "bbb2")
    fiche_du_sujet = (atelier.fichiers.projets / projet / "personnages" / "matieres.json").read_bytes()

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert [m["identifiant"] for m in rapport["migrees"]] == [vraie_matiere]
    # Le décor n'a pas bougé d'un octet : ni sa fiche, ni son sujet.
    assert _octets_du_fichier(atelier, "bbb2") == fiche_du_decor
    decor = _fiche(atelier, un_decor)
    assert (decor.personnage, decor.pose, decor.direction) == ("matieres", "fixe", "sud")
    assert decor.matiere is False
    assert (atelier.fichiers.projets / projet / "personnages" / "matieres.json").read_bytes() == fiche_du_sujet
    # Il garde une image : le sujet n'est pas vide, on ne propose pas de le jeter.
    assert rapport["sujets_vides"] == []
    assert [m.identifiant for m in atelier.bibliotheque.matieres(projet)] == [vraie_matiere]


# ── Les collections ──────────────────────────────────────────────────────────


def test_d_les_collections_recoivent_les_matieres_et_gardent_leurs_sujets(atelier):
    projet, premiere, seconde = _cas_reel(atelier)
    bibliotheque = atelier.bibliotheque
    pierres = bibliotheque.creer_collection("Pierres", projet)
    autre = bibliotheque.creer_collection("Autre chose", projet)
    bibliotheque.ranger_sujet(pierres.identifiant, projet, "matieres")
    # Un sujet voisin, et une matière qu'un autre sujet portait : ils ne se mêlent pas.
    _sujet_ecrit(atelier, projet, "chene", "Chêne")
    bibliotheque.ranger_sujet(pierres.identifiant, projet, "chene")
    voisine = _image_ecrite(atelier, projet, "ccc1", sujet="chene")  # matière d'un sujet rangé aussi
    _relire(atelier)

    rapport = bibliotheque.migrer_matieres(projet)

    collection = bibliotheque.collections()
    par_id = {c.identifiant: c for c in collection}
    membres = par_id[pierres.identifiant].membres
    assert Membre(projet, "matieres", SUJET) in membres  # le sujet reste dans son groupe
    assert Membre(projet, "chene", SUJET) in membres
    assert set(par_id[pierres.identifiant].matieres_du_jeu(projet)) == {premiere, seconde, voisine}
    # Le groupe qui ne rangeait aucun de ces sujets n'a rien reçu.
    assert par_id[autre.identifiant].membres == ()
    assert {m["identifiant"]: m["collections"] for m in rapport["migrees"]} == {
        premiere: [pierres.identifiant],
        seconde: [pierres.identifiant],
        voisine: [pierres.identifiant],
    }
    # Sur le disque : `genre` ne s'écrit que pour une matière (RG5).
    ecrit = json.loads(atelier.fichiers.collections.read_text(encoding="utf-8"))
    assert {"jeu": projet, "sujet": premiere, "genre": "matiere"} in ecrit["pierres"]["membres"]
    assert {"jeu": projet, "sujet": "matieres"} in ecrit["pierres"]["membres"]
    # Et la table de l'index — celle que lit la fiche d'une matière — le sait aussi.
    _relire(atelier)
    assert set(bibliotheque.collections()[0].matieres_du_jeu(projet)) == {premiere, seconde, voisine}


# ── Rejouée : rien ne change ─────────────────────────────────────────────────


def test_e_rejouee_la_migration_ne_change_pas_un_octet(atelier):
    projet, premiere, seconde = _cas_reel(atelier)
    pierres = atelier.bibliotheque.creer_collection("Pierres", projet)
    atelier.bibliotheque.ranger_sujet(pierres.identifiant, projet, "matieres")
    atelier.bibliotheque.migrer_matieres(projet)
    apres_la_premiere = _instantane(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)
    _relire(atelier)
    rapport_apres_relecture = atelier.bibliotheque.migrer_matieres(projet)

    assert _instantane(atelier) == apres_la_premiere
    for r in (rapport, rapport_apres_relecture):
        assert r["nombre"] == 0 and r["migrees"] == []
        assert r["deja_migrees"] == 2
        # L'écran doit retrouver le sujet vide même quand plus rien ne migre.
        assert r["sujets_vides"] == [{"identifiant": "matieres", "nom": "Matières"}]
        assert r["journal"] == f"projets/{projet}/{JOURNAL_MATIERES}"


def test_e_ce_que_l_auteur_a_decide_depuis_ne_revient_pas(atelier):
    """La panne : la migration repasse à chaque ouverture, et rendrait sa marque à une
    image que l'auteur a délibérément sortie de la bibliothèque."""
    projet, premiere, seconde = _cas_reel(atelier)
    atelier.bibliotheque.migrer_matieres(projet)
    atelier.bibliotheque.declarer_matiere(premiere, False, projet=projet)

    atelier.bibliotheque.migrer_matieres(projet)
    _relire(atelier)
    atelier.bibliotheque.ouvrir()

    assert _fiche(atelier, premiere).matiere is False
    assert [m.identifiant for m in atelier.bibliotheque.matieres(projet)] == [seconde]


# ── La sixième règle : la nature ─────────────────────────────────────────────


def test_f_un_sujet_de_nature_matiere_qui_garde_une_image_repasse_en_decor(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "pierres-mixtes", "Pierres mixtes", nature="matière")
    _sujet_ecrit(atelier, projet, "que-des-matieres", "Que des matières", nature="matière")
    _image_ecrite(atelier, projet, "ddd1", sujet="pierres-mixtes")  # migre
    une_photo = _image_ecrite(
        atelier, projet, "ddd2", sujet="pierres-mixtes", label="Une photo", echelle=None
    )  # ne migre pas
    _image_ecrite(atelier, projet, "ddd3", sujet="que-des-matieres")  # migre, et c'est tout
    _relire(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert _type_du_sujet(atelier, projet, "pierres-mixtes") == "décor"
    assert [n["identifiant"] for n in rapport["natures_corrigees"]] == ["pierres-mixtes"]
    assert rapport["natures_non_corrigees"] == []
    # Le sujet qui a tout perdu n'a plus d'image : il reste ce qu'il était, vide, et se jette.
    assert _type_du_sujet(atelier, projet, "que-des-matieres") == "matière"
    assert rapport["sujets_vides"] == [{"identifiant": "que-des-matieres", "nom": "Que des matières"}]
    # L'image qui ne migre pas est restée au sujet, intacte.
    assert _fiche(atelier, une_photo).personnage == "pierres-mixtes"
    assert _journal(atelier, projet)["sujets"]["pierres-mixtes"]["nature"] == {
        "avant": "matière",
        "apres": "décor",
    }

    # Rejouée : la nature ne bouge plus, et rien ne s'écrit.
    apres = _instantane(atelier)
    assert atelier.bibliotheque.migrer_matieres(projet)["natures_corrigees"] == []
    assert _instantane(atelier) == apres


def test_f_sans_ecrivain_de_sujet_la_regle_ne_s_applique_pas_et_le_rapport_le_dit(atelier):
    """Une bibliothèque montée seule, sans la production : elle ne change pas la nature
    d'un sujet en douce — elle dit ce qu'elle n'a pas pu faire."""
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "pierres-mixtes", "Pierres mixtes", nature="matière")
    _image_ecrite(atelier, projet, "ddd4", sujet="pierres-mixtes", echelle=None)
    _relire(atelier)
    seule = ServiceBibliotheque(atelier.base, atelier.fichiers, atelier.assets)

    rapport = seule.migrer_matieres(projet)

    assert _type_du_sujet(atelier, projet, "pierres-mixtes") == "matière"
    assert [n["identifiant"] for n in rapport["natures_non_corrigees"]] == ["pierres-mixtes"]


# ── Le journal, et le chemin du retour ───────────────────────────────────────


def test_g_le_journal_garde_l_ancien_etat_et_permet_de_tout_remettre(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    _sujet_ecrit(atelier, projet, "melange", "Mélange", nature="matière")
    a = _image_ecrite(
        atelier, projet, "eee1", sujet="matieres", pose="fixe", direction="sud", label=PHRASE_ANGLAISE
    )
    b = _image_ecrite(atelier, projet, "eee2", sujet="matieres", label="")
    c = _image_ecrite(atelier, projet, "eee3", sujet="melange")
    _image_ecrite(atelier, projet, "eee4", sujet="melange", echelle=None)  # garde « melange »
    pierres = atelier.bibliotheque.creer_collection("Pierres", projet)
    atelier.bibliotheque.ranger_sujet(pierres.identifiant, projet, "matieres")
    _relire(atelier)

    def etat() -> dict:
        images = {}
        for identifiant in (a, b, c):
            f = _fiche(atelier, identifiant)
            images[identifiant] = (f.personnage, f.pose, f.direction, f.label, f.matiere, f.personnage_supprime)
        return {
            "images": images,
            "membres": {x.identifiant: x.membres for x in atelier.bibliotheque.collections()},
            "natures": {s: _type_du_sujet(atelier, projet, s) for s in ("matieres", "melange")},
        }

    avant = etat()
    atelier.bibliotheque.migrer_matieres(projet)
    apres = etat()
    assert apres != avant  # la migration a bien fait quelque chose

    # Ce que le journal dit — l'ancien état, image par image.
    journal = _journal(atelier, projet)
    assert journal["version"] == 1 and journal["projet"] == projet
    assert journal["images"][a]["avant"] == {
        "personnage": "matieres", "pose": "fixe", "direction": "sud",
        "label": PHRASE_ANGLAISE, "matiere": False, "personnage_supprime": False,
    }
    assert journal["images"][b]["avant"]["label"] == ""  # le nom pris au sujet n'y est pas
    assert journal["images"][a]["collections"] == [pierres.identifiant]
    assert journal["images"][c]["collections"] == []
    assert journal["images"][a]["faite"] is True
    assert set(journal["sujets"]["matieres"]["images"]) == {a, b}
    assert journal["sujets"]["melange"]["nature"]["avant"] == "matière"

    # Le chemin du retour : rien que le journal, et les gestes ordinaires du produit.
    for identifiant, entree in journal["images"].items():
        image = _fiche(atelier, identifiant)
        for champ, valeur in entree["avant"].items():
            setattr(image, champ, valeur)
        atelier.assets.sauver(image, annoncer=False)
        for collection in entree["collections"]:
            atelier.bibliotheque.retirer_sujet(collection, projet, identifiant, MATIERE)
    for sujet, fiche in journal["sujets"].items():
        if "nature" in fiche:
            atelier.production.regler_personnage(projet, sujet, type=fiche["nature"]["avant"])

    assert etat() == avant
    _relire(atelier)  # et c'est le disque qui l'a retenu, pas seulement l'index
    assert etat() == avant


def test_g_le_journal_ne_perd_pas_la_premiere_passe_quand_une_seconde_le_complete(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    premiere = _image_ecrite(atelier, projet, "fff1", sujet="matieres", pose="fixe")
    _relire(atelier)
    atelier.bibliotheque.migrer_matieres(projet)
    journal_de_la_premiere = _journal(atelier, projet)

    # Une image de plus arrive, rangée dans le même sujet par un vieux flux.
    seconde = _image_ecrite(atelier, projet, "fff2", sujet="matieres", direction="nord")
    _relire(atelier)
    rapport = atelier.bibliotheque.migrer_matieres(projet)

    journal = _journal(atelier, projet)
    assert [m["identifiant"] for m in rapport["migrees"]] == [seconde]
    assert journal["images"][premiere] == journal_de_la_premiere["images"][premiere]
    assert journal["images"][seconde]["avant"]["direction"] == "nord"
    assert set(journal["sujets"]["matieres"]["images"]) == {premiere, seconde}


# ── L'image illisible ne bloque personne ─────────────────────────────────────


def test_h_une_fiche_abimee_est_sautee_dite_et_laissee_telle_quelle(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    abimee = _image_ecrite(atelier, projet, "ggg1", sujet="matieres")
    perdue = _image_ecrite(atelier, projet, "ggg2", sujet="matieres")
    bonne = _image_ecrite(atelier, projet, "ggg3", sujet="matieres")
    _relire(atelier)
    # Après la relecture : l'index les connaît encore, le disque ne les dit plus.
    chemin = atelier.fichiers.generations / "ggg1" / "0-asset.json"
    chemin.write_bytes(b"{ ceci n'est pas du json")
    (atelier.fichiers.generations / "ggg2" / "0-brut.png").unlink()

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert [m["identifiant"] for m in rapport["migrees"]] == [bonne]
    raisons = {i["identifiant"]: i["raison"] for i in rapport["ignorees"]}
    assert set(raisons) == {abimee, perdue}
    assert "illisible" in raisons[abimee]
    assert "brute" in raisons[perdue]
    assert chemin.read_bytes() == b"{ ceci n'est pas du json"  # jamais remplacée par la copie de l'index
    assert _fiche(atelier, bonne).matiere is True
    # Deux images n'ont pas migré : le sujet en garde, il n'est pas vide.
    assert rapport["sujets_vides"] == []


def test_h_une_generation_introuvable_est_dite_et_ne_bloque_pas(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    orpheline = _image_ecrite(atelier, projet, "hhh1", sujet="matieres")
    bonne = _image_ecrite(atelier, projet, "hhh2", sujet="matieres")
    _relire(atelier)
    # L'index garde l'image et a perdu sa génération : la règle ne peut pas être lue.
    with atelier.base._connexion() as connexion:  # noqa: SLF001
        connexion.execute("DELETE FROM generations WHERE identifiant = ?", ("hhh1",))

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert [m["identifiant"] for m in rapport["migrees"]] == [bonne]
    assert [i["identifiant"] for i in rapport["ignorees"]] == [orpheline]


def test_h_un_journal_illisible_arrete_tout_sans_rien_ecraser_et_n_empeche_pas_d_ouvrir(atelier):
    projet, premiere, seconde = _cas_reel(atelier)
    chemin = atelier.fichiers.journal_matieres_du_jeu(projet)
    chemin.write_bytes(b"\x00\x01 pas un journal")
    avant = _instantane(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert rapport["refusee"] and JOURNAL_MATIERES in rapport["refusee"]
    assert rapport["nombre"] == 0
    assert _instantane(atelier) == avant  # ni fiche, ni journal, ni collection touchés

    # Et ouvrir le jeu, choisir le jeu, lire ses matières — jamais une exception. La
    # relecture entre chaque geste efface la mémoire « déjà regardé » : chacun passe
    # vraiment par la migration.
    _relire(atelier)
    atelier.bibliotheque.ouvrir()
    _relire(atelier)
    atelier.bibliotheque.choisir(projet)
    _relire(atelier)
    atelier.bibliotheque.matieres(projet)
    assert chemin.read_bytes() == b"\x00\x01 pas un journal"
    assert _fiche(atelier, premiere).personnage == "matieres"


def test_h_un_journal_qui_ne_s_ecrit_pas_arrete_avant_toute_fiche(atelier, monkeypatch):
    """Le journal passe avant : s'il ne peut pas être posé, aucune image n'est réécrite."""
    projet, premiere, seconde = _cas_reel(atelier)

    def refuse(*_a, **_k):
        raise OSError("disque plein")

    monkeypatch.setattr(atelier.fichiers, "ecrire_journal_matieres", refuse)
    avant = _instantane(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)

    assert "disque plein" in rapport["refusee"]
    assert _instantane(atelier) == avant


def test_h_une_passe_coupee_en_route_se_reprend_sans_perdre_l_etat_d_avant(atelier, monkeypatch):
    """Le journal est écrit avant les fiches ; une image que la passe n'a pas su écrire
    reste « à finir », et la suivante la reprend avec son état d'origine."""
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "matieres", "Matières")
    bonne = _image_ecrite(atelier, projet, "iii1", sujet="matieres")
    coupee = _image_ecrite(atelier, projet, "iii2", sujet="matieres", pose="fixe")
    pierres = atelier.bibliotheque.creer_collection("Pierres", projet)
    atelier.bibliotheque.ranger_sujet(pierres.identifiant, projet, "matieres")
    _relire(atelier)

    vraie = atelier.assets.sauver

    def sauver_sauf_une(asset, **k):
        if asset.identifiant == coupee:
            raise OSError("coupure")
        return vraie(asset, **k)

    monkeypatch.setattr(atelier.assets, "sauver", sauver_sauf_une)
    premiere_passe = atelier.bibliotheque.migrer_matieres(projet)
    monkeypatch.undo()

    assert [m["identifiant"] for m in premiere_passe["migrees"]] == [bonne]
    assert [i["identifiant"] for i in premiere_passe["ignorees"]] == [coupee]
    journal = _journal(atelier, projet)
    assert journal["images"][bonne]["faite"] is True
    assert journal["images"][coupee]["faite"] is False
    assert journal["images"][coupee]["avant"]["pose"] == "fixe"
    assert _fiche(atelier, coupee).personnage == "matieres"  # pas écrite : pas à moitié

    seconde_passe = atelier.bibliotheque.migrer_matieres(projet)

    assert [m["identifiant"] for m in seconde_passe["migrees"]] == [coupee]
    assert _fiche(atelier, coupee).matiere is True and _fiche(atelier, coupee).pose is None
    journal = _journal(atelier, projet)
    assert journal["images"][coupee]["avant"]["pose"] == "fixe"  # l'état d'origine, jamais l'état à moitié
    assert journal["images"][coupee]["faite"] is True
    matieres = atelier.bibliotheque.collections()[0].matieres_du_jeu(projet)
    assert set(matieres) == {bonne, coupee}


# ── Ouvrir un jeu sans matière n'écrit rien ──────────────────────────────────


def test_i_un_jeu_sans_matiere_a_migrer_ne_change_aucun_fichier(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "chene", "Chêne", nature="décor")
    _image_ecrite(atelier, projet, "jjj1", sujet="chene", label="Un chêne", echelle=None, pose="fixe")
    # Une matière née depuis RG5 : déjà marquée, sans sujet, avec son nom. Rien à faire.
    _image_ecrite(atelier, projet, "jjj2", label=PHRASE_ANGLAISE, matiere=True)
    _relire(atelier)
    avant = _instantane(atelier)

    rapport = atelier.bibliotheque.migrer_matieres(projet)
    assert atelier.bibliotheque.assurer_matieres(projet) is None  # déjà regardé dans ce processus
    atelier.bibliotheque.matieres(projet)

    assert rapport["nombre"] == 0 and rapport["journal"] is None and rapport["refusee"] is None
    assert _instantane(atelier) == avant
    assert not atelier.fichiers.journal_matieres_du_jeu(projet).exists()


def test_i_ouvrir_l_atelier_sur_un_jeu_sans_matiere_ne_change_aucun_fichier(atelier):
    projet = _jeu(atelier)
    _sujet_ecrit(atelier, projet, "chene", "Chêne")
    _image_ecrite(atelier, projet, "jjj3", sujet="chene", label="Un chêne", echelle=None)
    _relire(atelier)
    atelier.bibliotheque.ouvrir()  # une première ouverture pose l'état courant
    avant = _instantane(atelier)

    atelier.bibliotheque.ouvrir()
    _relire(atelier)
    atelier.bibliotheque.ouvrir()

    assert _instantane(atelier) == avant


def test_i_un_jeu_inconnu_est_refuse_comme_partout(atelier):
    with pytest.raises(ProjetInconnu):
        atelier.bibliotheque.migrer_matieres("jeu-qui-n-existe-pas")


# ── Quand elle tourne ────────────────────────────────────────────────────────


def test_la_migration_passe_a_l_ouverture_de_l_atelier(atelier):
    projet, premiere, seconde = _cas_reel(atelier)
    assert _fiche(atelier, premiere).matiere is False  # le disque est celui d'avant

    atelier.bibliotheque.ouvrir()

    assert _fiche(atelier, premiere).matiere is True
    assert _fiche(atelier, seconde).personnage is None


def test_la_migration_passe_quand_on_choisit_le_jeu(atelier):
    projet, premiere, seconde = _cas_reel(atelier)
    autre = atelier.bibliotheque.creer_projet("Un autre jeu").identifiant

    atelier.bibliotheque.choisir(autre)
    assert _fiche(atelier, premiere).matiere is False  # un autre jeu ne migre pas celui-ci
    atelier.bibliotheque.choisir(projet)

    assert _fiche(atelier, premiere).matiere is True
    assert _fiche(atelier, seconde).matiere is True


def test_la_migration_passe_avant_qu_un_agent_lise_les_matieres_d_un_jeu_jamais_ouvert(atelier):
    """`list_materials` lit `bibliotheque.matieres` : sans ce passage, un agent qui
    liste les matières d'un jeu que personne n'a ouvert n'en verrait aucune."""
    projet, premiere, seconde = _cas_reel(atelier)
    autre = atelier.bibliotheque.creer_projet("Un autre jeu").identifiant
    assert atelier.bibliotheque.courant == autre

    trouvees = atelier.bibliotheque.matieres(projet)

    assert {m.identifiant for m in trouvees} == {premiere, seconde}


def test_la_route_migrate_rend_le_rapport_et_se_rejoue(atelier, client):
    projet, premiere, seconde = _cas_reel(atelier)

    reponse = client.post(f"/api/projects/{projet}/materials/migrate")
    assert reponse.status_code == 200, reponse.text
    rapport = reponse.json()
    assert rapport["nombre"] == 2 and rapport["refusee"] is None
    assert rapport["sujets_vides"] == [{"identifiant": "matieres", "nom": "Matières"}]

    avant = _instantane(atelier)
    encore = client.post(f"/api/projects/{projet}/materials/migrate").json()
    assert encore["nombre"] == 0 and encore["deja_migrees"] == 2
    assert _instantane(atelier) == avant

    # La bibliothèque, lue par la route de RG5, montre les deux images avec leur nom.
    lue = client.get(f"/api/projects/{projet}/materials").json()["matieres"]
    assert {m["nom"] for m in lue} == {PHRASE_ANGLAISE, AUTRE_PHRASE}

    inconnu = client.post("/api/projects/jeu-qui-n-existe-pas/materials/migrate")
    assert inconnu.status_code >= 400


def test_le_sujet_laisse_vide_se_jette_par_la_route_qui_existe_deja(atelier, client):
    """« L'écran propose de le jeter en un geste » : la route de suppression d'un sujet
    existe, et une image qui n'y est plus rangée n'en porte pas la trace."""
    projet, premiere, seconde = _cas_reel(atelier)
    rapport = client.post(f"/api/projects/{projet}/materials/migrate").json()
    vide = rapport["sujets_vides"][0]["identifiant"]

    jete = client.delete(f"/api/characters/{vide}", params={"projet": projet})

    assert jete.status_code == 200, jete.text
    assert jete.json()["images"] == 0  # aucune image n'était plus rangée dans ce sujet
    assert atelier.fichiers.lire_personnage(projet, vide) is None
    assert _fiche(atelier, premiere).personnage_supprime is False
    # Il n'est plus « vide » : il n'est plus.
    assert client.post(f"/api/projects/{projet}/materials/migrate").json()["sujets_vides"] == []
