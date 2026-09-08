# -*- coding: utf-8 -*-
"""Les critères d'acceptation de B21 — la sortie.

**Aucun test ne coûte un centime**, et deux d'entre eux le prouvent en comptant
les appels du double avant et après : prévoir comme écrire sont du disque et du
processeur. C'est le cinquième critère de la tranche, et il se démontre de la
même façon qu'en T6 et en C5.

**Les fichiers posés sont rouverts**, comme en C5 : la sortie est le seul geste
du produit dont personne ne voit le résultat avant de l'ouvrir ailleurs. Ce que
ces tests regardent est donc le dossier lui-même — `iterdir`, `read_bytes`,
`json.loads` —, jamais seulement ce que la route a répondu.

**Le montage vient de `test_c3` et de `test_a4`, et il n'est pas recopié** : un
double écrit d'après l'intention prouve l'intention, pas le serveur.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image

from atelier.domaine import aseprite
from atelier.domaine import sortie as vocabulaire
from atelier.domaine.bande import Bande
from test_a4 import _bande
from test_c3 import _corps, _habiller, _personnage, _piece


# ── Le montage ──────────────────────────────────────────────────────────────


def _sujet(client, double, poses: int = 2) -> tuple[str, list[str]]:
    """Un sujet avec ses poses remplies — le cas normal d'une sortie."""
    personnage, plan = _personnage(client, poses)
    _corps(client, double, personnage, plan)
    return personnage, plan


def _bande_vide(atelier, nom: str = "course") -> Bande:
    """Une bande gardée dont les images ont été retirées.

    **Écrite à la main plutôt que par le montage de `test_a4`**, et pour une
    raison qui est le sujet même du test : une bande sans image ne peut pas
    faire de planche, donc l'outil qui en fabrique une ne sait pas la produire.
    C'est exactement ce qui arrive au dossier du jeu si personne ne l'écarte
    avant — une panne au milieu d'un lot.
    """
    bande = Bande(
        identifiant=f"bande-vide-{nom}",
        clip="clip-paye",
        nom=nom,
        prises=(),
        projet=atelier.bibliotheque.courant,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _directions(client, *noms: str) -> None:
    for nom in noms:
        reponse = client.post("/api/characters/directions", json={"nom": nom})
        assert reponse.status_code == 201, reponse.text


def _prevoir(client, dossier: Path, **reglage) -> dict:
    reponse = client.post(
        "/api/output/preview", json={"dossier": str(dossier), **reglage}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _sortir(client, dossier: Path, **reglage):
    return client.post("/api/output", json={"dossier": str(dossier), **reglage})


def _poses(dossier: Path) -> set[str]:
    """Tout ce que le dossier contient **vraiment**, chemins relatifs."""
    if not dossier.is_dir():
        return set()
    return {
        c.relative_to(dossier).as_posix() for c in dossier.rglob("*") if c.is_file()
    }


# ── Critère 1 — l'arbre se lit avant d'écrire ───────────────────────────────


def test_l_apercu_dit_l_arbre_le_compte_et_le_poids_sans_rien_ecrire(
    client, double, tmp_path
):
    """*L'arbre des fichiers se lit avant d'écrire, avec le compte et le poids
    total.*

    **Le dossier est comparé avant et après**, et c'est la seule preuve qui
    vaille : une route qui dirait « je n'ai rien écrit » sans qu'on regarde le
    disque ne prouverait que sa propre phrase.
    """
    _sujet(client, double, poses=2)
    dossier = tmp_path / "jeu" / "assets"

    avant = _poses(dossier)
    apercu = _prevoir(client, dossier)
    apres = _poses(dossier)

    assert avant == apres == set()
    # Le dossier lui-même n'a pas été créé : prévoir ne touche à rien.
    assert not dossier.exists()

    # Deux images, plus le descriptif — **l'arbre montre tout ce qui sera
    # écrit**, y compris ce qui n'est pas une image : c'est ce que la planche
    # dessine, et le compte du bouton doit être celui du dossier.
    assert apercu["compte"] == 3
    assert apercu["octets"] > 0
    chemins = {f["chemin"] for f in apercu["fichiers"]}
    assert "descriptif.json" in chemins
    assert len([c for c in chemins if c.endswith(".png")]) == 2

    for fichier in apercu["fichiers"]:
        assert fichier["octets"] > 0
        assert fichier["marque"] == vocabulaire.NOUVEAU
        if fichier["chemin"].endswith(".png"):
            # Les dimensions sont mesurées, pas devinées.
            assert fichier["largeur"] > 0 and fichier["hauteur"] > 0
        else:
            # **Zéro n'est pas une dimension, c'est l'absence de mesure** : un
            # descriptif est du texte, et l'arbre n'écrit rien à sa droite.
            assert fichier["largeur"] == 0 and fichier["hauteur"] == 0


def test_l_apercu_annonce_exactement_les_fichiers_que_l_ecriture_pose(
    client, double, tmp_path
):
    """Le contrat de l'écran, et la raison d'être des deux routes.

    Si l'aperçu et l'écriture pouvaient nommer deux listes différentes, la
    colonne du milieu ne servirait à rien. Elles ne le peuvent pas : c'est le
    même générateur, lu deux fois.
    """
    _sujet(client, double, poses=2)
    dossier = tmp_path / "assets"

    annonces = {f["chemin"] for f in _prevoir(client, dossier)["fichiers"]}
    reponse = _sortir(client, dossier)
    assert reponse.status_code == 200, reponse.text

    # **Exactement**, et rien de plus : ni un fichier de moins, ni un fichier
    # que l'arbre n'annonçait pas.
    assert _poses(dossier) == annonces
    assert Path(reponse.json()["descriptif"]).is_file()


# ── Critère 2 — nouveau, remplacé, inchangé ─────────────────────────────────


def test_au_second_passage_chaque_fichier_dit_s_il_change(client, double, tmp_path):
    """*Chaque fichier est marqué nouveau, remplacé ou inchangé face à la sortie
    précédente.*

    Trois états dans un seul test, parce que c'est un seul mécanisme : on sort,
    on abîme un fichier, on ajoute une pose, et l'aperçu suivant doit dire les
    trois — sans qu'on lui ait rien appris entre-temps.
    """
    personnage, plan = _sujet(client, double, poses=2)
    dossier = tmp_path / "assets"

    def _images(apercu: dict) -> dict[str, str]:
        """Les marques des images seules.

        ⚠️ **Le descriptif est écarté ici, et il faut le dire** : il porte
        l'instant de la sortie, donc il diffère à chaque passage et se dit
        toujours « remplacé ». C'est exact — il *est* réécrit —, mais ce n'est
        pas ce que ce test mesure.
        """
        return {
            f["chemin"]: f["marque"]
            for f in apercu["fichiers"]
            if f["chemin"].endswith(".png")
        }

    premier = _prevoir(client, dossier)
    assert set(_images(premier).values()) == {vocabulaire.NOUVEAU}
    assert _sortir(client, dossier).status_code == 200

    # Tout est identique : rien n'a changé dans l'atelier.
    second = _prevoir(client, dossier)
    assert set(_images(second).values()) == {vocabulaire.INCHANGE}
    assert second["comptes"][vocabulaire.INCHANGE] == 2

    # **Un fichier abîmé dehors se dit « remplacé »**, et c'est ce qui prouve
    # que la comparaison se fait sur le dossier et non sur une mémoire : rien
    # n'a bougé dans l'atelier, et pourtant la marque change.
    premier_png = sorted(c for c in _poses(dossier) if c.endswith(".png"))[0]
    (dossier / premier_png).write_bytes(b"\x89PNG\r\n\x1a\n" + b"abime")

    troisieme = _prevoir(client, dossier)
    marques = _images(troisieme)
    assert marques[premier_png] == vocabulaire.REMPLACE
    assert list(marques.values()).count(vocabulaire.INCHANGE) == 1


def test_la_sortie_precedente_est_gardee_et_relue(client, double, tmp_path):
    """La seule chose qu'il fallait ajouter pour que « ce qui a changé » existe.

    **Elle se relit après un tour complet**, atelier compris : un état que le
    produit garde et qu'un essai ne rouvre jamais est un état qu'on n'a pas
    vérifié (`docs/PIEGES.md`).
    """
    _sujet(client, double, poses=1)
    dossier = tmp_path / "assets"

    assert _prevoir(client, dossier)["precedente"] is None
    assert _sortir(client, dossier).status_code == 200

    precedente = _prevoir(client, dossier)["precedente"]
    assert precedente is not None
    assert precedente["le"] > 0
    assert Path(precedente["dossier"]) == dossier
    # L'image et le descriptif : ce qui a été posé, et rien d'autre.
    assert precedente["compte"] == 2
    assert precedente["octets"] > 0


def test_le_dossier_est_garde_avec_ce_jeu_ci(client, double, tmp_path):
    """« Gardé avec ce jeu-ci » — le défaut que la planche relève.

    Le dossier du jeu était commun à tout l'atelier : deux jeux ouverts tour à
    tour se déposaient au même endroit. Une fois sorti, un jeu retrouve le sien
    sans qu'on ait à le retaper.
    """
    _sujet(client, double, poses=1)
    dossier = tmp_path / "le-marais"
    assert _sortir(client, dossier).status_code == 200

    reglages = client.get("/api/output/settings").json()
    assert Path(reglages["dossier"]) == dossier
    # Et l'aperçu suivant s'en sert, sans qu'on lui nomme le dossier.
    apercu = client.post("/api/output/preview", json={}).json()
    assert Path(apercu["dossier"]) == dossier


# ── Critère 3 — les quatre modes de collision ───────────────────────────────


def test_les_quatre_modes_de_collision_sont_servis_a_l_ecran(client):
    """*Les quatre modes de collision existent, et « remplacer » en est un.*

    Servis par le serveur plutôt que redéclarés par l'écran : un cinquième mode
    paraîtrait alors sans qu'une ligne de TypeScript bouge, et l'écran ne peut
    pas proposer une valeur que le serveur refuserait.
    """
    reglages = client.get("/api/output/settings").json()
    assert reglages["collisions"] == [
        vocabulaire.REMPLACER,
        vocabulaire.NUMEROTER,
        vocabulaire.ARRETER,
        vocabulaire.EFFACER,
    ]
    assert vocabulaire.REMPLACER in reglages["collisions"]


def test_remplacer_ecrase_au_lieu_de_numeroter(client, double, tmp_path):
    """**Le geste que le produit ne savait pas faire.**

    « Le produit ne sait *que* numéroter : après trois sorties, le dossier
    contient `pelerin-repos.png`, `-2`, `-3`, et c'est au jeu de deviner lequel
    charger. » Trois sorties, et il n'en reste qu'un.
    """
    _sujet(client, double, poses=1)
    dossier = tmp_path / "assets"

    for _ in range(3):
        assert (
            _sortir(client, dossier, collision=vocabulaire.REMPLACER).status_code == 200
        )

    poses = _poses(dossier)
    assert len(poses) == 2, poses  # une image, un descriptif
    assert not any("-2." in c or "-3." in c for c in poses)


def test_numeroter_garde_les_deux(client, double, tmp_path):
    """Le comportement d'avant, gardé — c'est celui de `ServiceAgent.deposer`.

    Il reste joignable parce qu'il a un usage : garder la version d'avant le
    temps de comparer dans le jeu. Ce qui change est qu'il n'est plus le seul.
    """
    _sujet(client, double, poses=1)
    dossier = tmp_path / "assets"

    assert _sortir(client, dossier, collision=vocabulaire.NUMEROTER).status_code == 200
    assert _sortir(client, dossier, collision=vocabulaire.NUMEROTER).status_code == 200

    images = sorted(c for c in _poses(dossier) if c.endswith(".png"))
    assert len(images) == 2
    assert any(c.endswith("-2.png") for c in images)


def test_s_arreter_n_ecrit_rien_du_tout(client, double, tmp_path):
    """« S'arrêter s'il y a un doublon » — **et rien n'a été écrit**.

    S'arrêter au milieu du lot aurait laissé une moitié de jeu dans le dossier,
    ce qui est pire que de ne pas commencer : le refus se décide donc sur
    l'aperçu entier, avant le premier octet.
    """
    _sujet(client, double, poses=2)
    dossier = tmp_path / "assets"
    assert _sortir(client, dossier).status_code == 200

    avant = {c: (dossier / c).read_bytes() for c in _poses(dossier)}
    reponse = _sortir(client, dossier, collision=vocabulaire.ARRETER)

    assert reponse.status_code == 409, reponse.text
    assert "existe déjà" in reponse.json()["raison"]
    assert {c: (dossier / c).read_bytes() for c in _poses(dossier)} == avant


def test_effacer_retire_ce_qui_ne_sort_plus_et_rien_d_autre(
    client, double, tmp_path
):
    """Le quatrième mode, et le seul qui ait besoin de la fois d'avant.

    **Un fichier que l'auteur a posé lui-même n'est jamais touché.** C'est la
    raison pour laquelle la sortie précédente est gardée : sans elle, « ce qui
    ne sort plus » voudrait dire « tout ce que je ne reconnais pas », et le
    premier décor peint à la main y passerait.
    """
    personnage, plan = _sujet(client, double, poses=2)
    dossier = tmp_path / "assets"
    assert _sortir(client, dossier).status_code == 200

    a_nous = sorted(c for c in _poses(dossier) if c.endswith(".png"))
    le_sien = dossier / "un-decor-peint-a-la-main.png"
    le_sien.write_bytes(b"ce fichier est a l'auteur")

    # Le sujet ne tient plus qu'une pose : le fichier de l'autre ne sort plus.
    client.put(f"/api/characters/{personnage}", json={"poses": plan[:1]})

    apercu = _prevoir(client, dossier, collision=vocabulaire.EFFACER)
    restes = {r["chemin"] for r in apercu["restes"]}
    assert len(restes) == 1
    assert restes < set(a_nous)
    assert "un-decor-peint-a-la-main.png" not in restes

    reponse = _sortir(client, dossier, collision=vocabulaire.EFFACER)
    assert reponse.status_code == 200, reponse.text
    assert set(reponse.json()["effaces"]) == restes
    assert le_sien.is_file(), "le fichier de l'auteur a été effacé"


# ── Critère 4 — ce qui n'est pas prêt ───────────────────────────────────────


def test_un_sujet_sans_image_paraît_dans_ce_qui_n_est_pas_pret(
    client, double, tmp_path
):
    """*Un panneau dit ce qui n'est pas prêt : sujets sans image…*

    Et il le dit **sur le même calcul que l'arbre** : ce sujet-là n'a rien
    produit, donc il est sauté, donc il est nommé. Deux comptes tirés de deux
    règles auraient fini par se contredire.
    """
    _sujet(client, double, poses=1)
    vide = client.post("/api/characters", json={"nom": "Le passeur"}).json()
    identifiant = vide["personnage"]["identifiant"]

    apercu = _prevoir(client, tmp_path / "assets")
    alertes = {a["genre"]: a for a in apercu["pas_prets"]}

    assert vocabulaire.SANS_IMAGE in alertes
    alerte = alertes[vocabulaire.SANS_IMAGE]
    assert alerte["compte"] == 1
    assert alerte["sujets"][0]["identifiant"] == identifiant
    assert alerte["sujets"][0]["nom"] == "Le passeur"
    # Il ne sort pas : l'arbre ne le nomme nulle part.
    assert not any(identifiant == f["sujet"] for f in apercu["fichiers"])


def test_une_animation_vide_est_nommee_et_ne_sort_pas(atelier, client, tmp_path):
    """*…et animations vides.*

    Une bande dont les images ont été retirées ne peut pas faire de planche de
    sprites : la demander serait une panne au milieu d'un lot. Elle est écartée
    du plan **et** nommée dans le panneau — écartée sans être dite, elle serait
    perdue en silence (`docs/DESIGN.md`, règle 6).
    """
    pleine = _bande(atelier, nom="marche")
    vide = _bande_vide(atelier)

    apercu = _prevoir(client, tmp_path / "assets", lot=vocabulaire.ANIMATIONS)
    alertes = {a["genre"]: a for a in apercu["pas_prets"]}

    assert vocabulaire.ANIMATION_VIDE in alertes
    assert alertes[vocabulaire.ANIMATION_VIDE]["sujets"][0]["nom"] == "course"

    sources = {f["source"] for f in apercu["fichiers"]}
    assert pleine.identifiant in sources
    assert vide.identifiant not in sources


def test_un_sujet_a_direction_unique_est_signale(client, double, tmp_path):
    """*…personnages à direction unique.*

    Le piège le plus cher du sujet, et il est silencieux : le jeu déclare
    quatre angles, le sujet n'en a qu'un, il sort quand même, et le jeu le fait
    pivoter ou l'affiche de travers. Rien ne le signalait.
    """
    _directions(client, "est", "ouest")
    _sujet(client, double, poses=1)

    apercu = _prevoir(client, tmp_path / "assets")
    alertes = {a["genre"]: a for a in apercu["pas_prets"]}

    assert vocabulaire.UNE_SEULE_DIRECTION in alertes
    assert "2" in alertes[vocabulaire.UNE_SEULE_DIRECTION]["phrase"]


# ── Critère 5 — gratuit, et réseau coupé ────────────────────────────────────


def test_prevoir_et_sortir_ne_demandent_rien_au_fournisseur(
    client, double, tmp_path
):
    """*La sortie reste gratuite et fonctionne réseau coupé.*

    **Compté sur le double**, comme en T6 et en C5 : c'est la seule mesure qui
    ne puisse pas mentir. Un service qui n'importe pas de fournisseur ne peut
    pas l'appeler, et ce test le confirme au niveau où l'auteur le vit.
    """
    _sujet(client, double, poses=2)
    dossier = tmp_path / "assets"

    avant = double.appels
    _prevoir(client, dossier)
    _prevoir(client, dossier)
    assert _sortir(client, dossier).status_code == 200

    assert double.appels == avant


# ── Critère 6 — le format emprunté ne gagne rien ────────────────────────────


def test_le_format_aseprite_ne_gagne_aucune_cle_de_notre_cru(
    atelier, client, tmp_path
):
    """*Le format Aseprite ne gagne aucune clé de notre cru.*

    **Le jeu de clés exact**, pas seulement leur présence — `docs/PIEGES.md` :
    un format emprunté se dégrade d'une clé. Ce qui appartient à l'atelier est
    à côté, dans son propre descriptif, et ce test le vérifie aussi : l'un
    porte la filiation et le prix, l'autre non.
    """
    bande = _bande(atelier, nom="marche")
    dossier = tmp_path / "assets"
    assert (
        _sortir(client, dossier, lot=vocabulaire.ANIMATIONS).status_code == 200
    )

    ecrit = json.loads((dossier / "marche.json").read_text(encoding="utf-8"))
    attendu = aseprite.descriptif(
        atelier.montage.bande(bande.identifiant),
        image="marche.png",
        case_largeur=bande.case_largeur,
        case_hauteur=bande.case_hauteur,
        compte=bande.compte,
    )

    assert ecrit == attendu
    assert set(ecrit) == {"frames", "meta"}
    assert set(ecrit["meta"]) == {
        "app",
        "version",
        "image",
        "format",
        "size",
        "scale",
        "frameTags",
    }
    for image in ecrit["frames"]:
        assert set(image) == {
            "filename",
            "frame",
            "rotated",
            "trimmed",
            "spriteSourceSize",
            "sourceSize",
            "duration",
        }

    # Ce qui appartient à l'atelier vit à côté, et pas dedans.
    maison = json.loads((dossier / "descriptif.json").read_text(encoding="utf-8"))
    assert maison["animations"][0]["empreinte"]
    assert "empreinte" not in ecrit["meta"]


# ── Ce que la tranche ajoute par-dessus : le rangement et le moteur ─────────


def test_en_dossiers_range_par_famille_et_a_plat_ne_le_fait_pas(
    client, double, tmp_path
):
    """Les deux rangements, et le second est celui du jeu — pas le nôtre.

    « Un sous-dossier inventé ici serait une structure imposée à un jeu dont
    personne ne sait comment il range » : la famille n'est pas inventée ici,
    c'est un mot que l'auteur a posé.
    """
    _sujet(client, double, poses=1)

    plat = tmp_path / "plat"
    assert _sortir(client, plat, rangement=vocabulaire.A_PLAT).status_code == 200
    assert all("/" not in c for c in _poses(plat))

    range_ = tmp_path / "range"
    assert (
        _sortir(client, range_, rangement=vocabulaire.EN_DOSSIERS).status_code == 200
    )
    images = [c for c in _poses(range_) if c.endswith(".png")]
    assert images and all(c.startswith("personnages/") for c in images)
    # Le descriptif reste à la racine : c'est lui qu'un moteur cherche en premier.
    assert "descriptif.json" in _poses(range_)


def test_le_catalogue_du_moteur_s_ecrit_a_cote_du_descriptif(
    atelier, client, tmp_path
):
    """Le troisième manque de la tranche — un fichier que le moteur sait lire.

    **À côté, jamais dedans** : ni dans le descriptif de l'atelier, ni dans le
    fichier d'accompagnement d'Aseprite, qui appartient à quelqu'un d'autre.
    """
    _bande(atelier, nom="marche")
    dossier = tmp_path / "assets"

    reponse = _sortir(
        client,
        dossier,
        lot=vocabulaire.ANIMATIONS,
        moteur=vocabulaire.GODOT,
    )
    assert reponse.status_code == 200, reponse.text

    catalogue = Path(reponse.json()["catalogue"])
    assert catalogue.is_file()
    assert catalogue.suffix == ".tres"
    texte = catalogue.read_text(encoding="utf-8")
    assert texte.startswith('[gd_resource type="SpriteFrames"')
    assert 'path="res://marche.png"' in texte
    assert '"name": &"marche"' in texte


def test_aucun_moteur_n_ecrit_aucun_catalogue(client, double, tmp_path):
    """« Aucun » écrit ce que l'atelier écrivait déjà, et rien de plus."""
    _sujet(client, double, poses=1)
    dossier = tmp_path / "assets"

    reponse = _sortir(client, dossier, moteur=vocabulaire.AUCUN)
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["catalogue"] == ""
    assert not any(c.endswith((".tres", "-phaser.json", "-unity.json"))
                   for c in _poses(dossier))


# ── Les refus, chacun avec sa phrase ────────────────────────────────────────


@pytest.mark.parametrize(
    "champ, valeur",
    [
        ("lot", "les-terrains"),
        ("rangement", "en-arbre"),
        ("collision", "fusionner"),
        ("moteur", "unreal"),
    ],
)
def test_une_valeur_hors_liste_est_refusee_en_la_nommant(
    client, tmp_path, champ, valeur
):
    """Une liste fermée refuse en français, et dit ce qu'elle accepte.

    ⚠️ **Pas une erreur de validation en anglais** : `docs/PIEGES.md` a payé ce
    chemin une fois — un refus levé par la validation arrive à l'écran en
    langage de machine, et l'interface lit `raison` à la racine.
    """
    reponse = _sortir(client, tmp_path / "assets", **{champ: valeur})
    assert reponse.status_code == 409, reponse.text
    charge = reponse.json()
    assert valeur in charge["raison"]
    assert charge["code"] == "sortie_refusee"


def test_sans_dossier_l_apercu_grise_et_dit_pourquoi(client, double):
    """« Le grisé porte sa raison » — et il la porte jusque dans l'aperçu.

    L'écran ne peut pas montrer d'arbre sans savoir où comparer : plutôt qu'une
    erreur, il rend un aperçu vide qui porte la phrase, et le bouton se grise
    avec elle en dessous.
    """
    _sujet(client, double, poses=1)
    reponse = client.post("/api/output/preview", json={"dossier": ""})

    assert reponse.status_code == 200, reponse.text
    apercu = reponse.json()
    assert apercu["fichiers"] == []
    assert "aucun dossier de jeu" in apercu["refus"]
    # Et le panneau de droite répond quand même : ce qui n'est pas prêt ne
    # dépend pas du dossier.
    assert isinstance(apercu["pas_prets"], list)


def test_un_lot_vide_se_refuse_avec_sa_phrase(client, double, tmp_path):
    """Rien à sortir n'est pas une panne — c'est une phrase du produit."""
    _sujet(client, double, poses=1)
    reponse = _sortir(client, tmp_path / "assets", lot=vocabulaire.ANIMATIONS)

    assert reponse.status_code == 409, reponse.text
    assert "rien ne sort" in reponse.json()["raison"]


# ── Ce que la sortie emporte, et sous quel nom ──────────────────────────────


def test_la_direction_entre_dans_le_nom_et_dans_le_descriptif(
    client, double, tmp_path
):
    """Le piège le plus cher du sujet, réparé.

    L'export d'un personnage n'emportait qu'une image par pose, sans dire
    laquelle des quatre directions — « ni le nom ni le descriptif ne disent
    laquelle ». La matrice, elle, connaît ses colonnes depuis E10 : la sortie
    les parcourt.
    """
    _directions(client, "est", "ouest")
    _sujet(client, double, poses=1)
    dossier = tmp_path / "assets"
    assert _sortir(client, dossier).status_code == 200

    images = [c for c in _poses(dossier) if c.endswith(".png")]
    assert images and all("-est" in c or "-ouest" in c for c in images)

    descriptif = json.loads(
        (dossier / "descriptif.json").read_text(encoding="utf-8")
    )
    for fiche in descriptif["assets"]:
        assert fiche["direction"] is not None
        assert fiche["direction"]["identifiant"] in ("est", "ouest")


def test_un_calque_sort_avec_son_corps_et_dit_son_role(client, double, tmp_path):
    """Ce qui existait déjà, et qui n'est pas refait : le rôle d'un fichier.

    Corps, calque, corps habillé — les trois mots de C5, repris tels quels par
    le même appel. Un moteur qui empile un corps habillé sur un corps montrerait
    deux corps.
    """
    personnage, plan = _sujet(client, double, poses=2)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, plan)

    dossier = tmp_path / "assets"
    assert _sortir(client, dossier).status_code == 200

    descriptif = json.loads(
        (dossier / "descriptif.json").read_text(encoding="utf-8")
    )
    roles = {f["role"] for f in descriptif["assets"]}
    assert "corps" in roles
    assert roles & {"calque", "corps_habille"}

    for fiche in descriptif["assets"]:
        pose = dossier / fiche["fichier"]
        assert pose.is_file(), fiche["fichier"]
        with Image.open(pose) as image:
            assert (image.width, image.height) == (
                fiche["dimensions"]["largeur"],
                fiche["dimensions"]["hauteur"],
            )
