# -*- coding: utf-8 -*-
"""RG8 (seconde moitié) — les matières nées détourées sont retrouvables, et l'on sait
si l'on peut les remettre d'aplomb sans les regénérer (`docs/PLAN-rangement.md`).

**Le décor.** Avant le 19 septembre 2026 une matière naissait détourée et recadrée
comme un personnage : le barème du projet ne portait pas la nature « matière »,
`Univers.recette_de` retombait sur `silhouette=True`. Le correctif (`bareme_complete`)
empêche que cela recommence ; il ne répare pas ce qui est né. Ces essais tiennent :

- le calcul unique (`ServiceAssets.etat_de_matiere`) qui dit `detouree` et `refaisable` ;
- la route, la fiche de la bibliothèque et l'outil de l'agent, qui disent la même chose ;
- le geste qui remet la bonne recette **à partir du brut** — sans fournisseur, sans coût ;
- ce que le produit ne fait jamais : réparer tout seul.

**Ce qui distingue une matière née détourée d'une née saine** (mesuré sur
`donnees/projets/la-foret-magique`, le 20 septembre 2026) : rien sur la génération — sa
demande porte `echelle="matière"` dans les deux cas —, rien sur l'asset que la recette. Ces
essais reconstruisent donc l'état d'avant le correctif exactement comme le code d'alors le
fabriquait : `Univers.recette_de(None)`, l'échelle introuvable.

Chaque essai nomme la panne qu'il empêche :

- une matière détourée qu'on ne saurait pas retrouver, ou une saine qu'on accuserait ;
- un bouton proposé alors que le brut a disparu — l'auteur cliquerait sur un geste qui échoue ;
- un détourage endormi, ou une matière que le barème de l'auteur *veut* détourée, signalés
  comme des défauts ;
- l'écran et l'agent qui ne disent pas la même chose ;
- un geste qui regénère, qui paie, qui touche au brut, ou qui s'exécute tout seul ;
- une image qui n'est pas une matière (ou d'un autre jeu) qu'on « refait » quand même.

Aucun essai ne coûte un centime et aucun n'appelle un fournisseur : les compteurs le disent.
"""
from __future__ import annotations

import io
import json
from dataclasses import replace

import pytest
from PIL import Image, ImageDraw

from atelier.api.matieres import _matiere_json
from atelier.domaine.asset import Asset
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.domaine.recette import DETOURAGE, RECADRAGE, Passe, Recadrage, Recette
from atelier.services.assets import ECHELLE_MATIERE, RecetteRefusee
from tests.test_tu10_agent import agent  # noqa: F401 (banc de TU10, réutilisé tel quel)


# ── Le disque de l'auteur, refait à la main ──────────────────────────────────


def _brut() -> bytes:
    """Un disque rouge sur un fond gris : le détourage le découpe, la matière le garde entier."""
    image = Image.new("RGB", (64, 64), (200, 200, 200))
    ImageDraw.Draw(image).ellipse((8, 8, 55, 55), fill=(200, 40, 40))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _projet(atelier) -> str:
    """Le jeu ouvert — créé s'il n'y en a pas encore."""
    if atelier.bibliotheque.courant is None:
        atelier.bibliotheque.ouvrir()
    if atelier.bibliotheque.courant is None:
        atelier.bibliotheque.creer_projet("La forêt magique")
    return atelier.bibliotheque.courant


def _univers(atelier, projet: str):
    return atelier.base.lire_projet(projet).univers


def _recette_d_avant_le_correctif(atelier, projet: str) -> Recette:
    """Ce que la naissance posait à une matière quand l'échelle était introuvable."""
    return _univers(atelier, projet).recette_de(None)


def _matiere_ecrite(
    atelier,
    projet: str,
    generation: str,
    recette: Recette | None,
    *,
    echelle: str | None = ECHELLE_MATIERE,
    matiere: bool = True,
    brut_present: bool = True,
) -> str:
    """Une image telle que le disque la porte : génération, brut, fiche, puis rendu.

    `recette=None` : la recette que le jeu donne aujourd'hui à une matière — une saine."""
    brut = atelier.fichiers.ecrire_brut(generation, 0, _brut(), ".png")
    demande: dict = {"prompt": "Game asset tile, pixel art, pierre", "sujet": ""}
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
                    resultat=Resultat(fichier=brut, largeur=64, hauteur=64, type_media="image/png", octets=1),
                )
            ],
        ).en_json(),
    )
    if recette is None:
        recette = atelier.assets.recette_d_une_matiere(projet)
    fiche = Asset(
        identifiant=f"{generation}-0", generation=generation, rang=0, brut=brut,
        largeur=64, hauteur=64, type_media="image/png", label="Pavé de pierre",
        projet=projet, matiere=matiere, recette=recette,
    ).en_disque()
    atelier.fichiers.ecrire_asset(generation, 0, fiche)
    atelier.bibliotheque.reconstruire()
    identifiant = f"{generation}-0"
    # Le rendu se calcule comme à la naissance ; puis, seulement, le brut peut disparaître.
    atelier.assets.accueillir(atelier.assets.lire(identifiant))
    if not brut_present:
        atelier.fichiers.supprimer(brut)
    return identifiant


def _alpha_mini(atelier, asset: Asset) -> int:
    """Le plus petit alpha du rendu : 0 s'il y a du transparent, 255 si l'image est pleine."""
    with Image.open(io.BytesIO(atelier.fichiers.lire(asset.rendu))) as lu:
        return lu.convert("RGBA").getchannel("A").getextrema()[0]


def _trois(atelier, projet: str) -> tuple[str, str, str]:
    """Une saine, une détourée dont le brut est là, une détourée dont le brut a disparu."""
    avant = _recette_d_avant_le_correctif(atelier, projet)
    saine = _matiere_ecrite(atelier, projet, "aaaa0001", None)
    refaisable = _matiere_ecrite(atelier, projet, "aaaa0002", avant)
    perdue = _matiere_ecrite(atelier, projet, "aaaa0003", avant, brut_present=False)
    return saine, refaisable, perdue


def _fichiers_de_l_asset(atelier, identifiant: str) -> dict[str, bytes]:
    dossier = atelier.fichiers.generations / identifiant.rsplit("-", 1)[0]
    return {p.name: p.read_bytes() for p in dossier.iterdir() if p.is_file()}


# ── Le domaine : « cette recette découpe-t-elle ? » ──────────────────────────


def test_la_recette_de_l_echelle_introuvable_decoupe_et_celle_d_une_matiere_non(atelier):
    projet = _projet(atelier)
    univers = _univers(atelier, projet)
    assert univers.echelle(ECHELLE_MATIERE) is not None  # `bareme_complete` : elle est là
    assert _recette_d_avant_le_correctif(atelier, projet).decoupe is True
    assert univers.recette_de(univers.echelle(ECHELLE_MATIERE)).decoupe is False


def test_un_detourage_endormi_ne_decoupe_rien_et_un_recadrage_seul_decoupe():
    detourage = Passe()
    assert Recette(passes=(detourage,)).decoupe is True
    assert Recette(passes=(detourage,), veille=(DETOURAGE,)).decoupe is False
    assert Recette(passes=(replace(detourage, masquee=True),)).decoupe is False
    assert Recette(recadrage=Recadrage()).decoupe is True
    assert Recette(recadrage=Recadrage(), veille=(RECADRAGE,)).decoupe is False
    assert Recette().decoupe is False


# ── Le calcul unique ─────────────────────────────────────────────────────────


def test_les_trois_etats_d_une_matiere(atelier):
    projet = _projet(atelier)
    saine, refaisable, perdue = _trois(atelier, projet)
    etat = atelier.assets.etat_de_matiere

    assert etat(atelier.assets.lire(saine)) == {"detouree": False, "refaisable": False}
    assert etat(atelier.assets.lire(refaisable)) == {"detouree": True, "refaisable": True}
    assert etat(atelier.assets.lire(perdue)) == {"detouree": True, "refaisable": False}
    # Le cas réel : le rendu d'une détourée a bien du transparent, celui d'une saine est plein.
    assert _alpha_mini(atelier, atelier.assets.lire(refaisable)) == 0
    assert _alpha_mini(atelier, atelier.assets.lire(saine)) == 255


def test_rien_sur_la_generation_ne_distingue_une_nee_detouree_d_une_nee_saine(atelier):
    """C'est la mesure qui justifie de lire la recette : les deux générations sont
    identiques, seule la recette de l'image diffère."""
    projet = _projet(atelier)
    saine, detouree, _ = _trois(atelier, projet)
    demandes = [
        atelier.base.lire(atelier.assets.lire(i).generation).demande for i in (saine, detouree)
    ]
    assert demandes[0]["echelle"] == demandes[1]["echelle"] == ECHELLE_MATIERE
    assert demandes[0] == demandes[1]
    assert atelier.assets.lire(saine).recette != atelier.assets.lire(detouree).recette


def test_un_detourage_endormi_n_est_pas_un_defaut(atelier):
    projet = _projet(atelier)
    endormie = _recette_d_avant_le_correctif(atelier, projet).endormie(DETOURAGE, True).endormie(RECADRAGE, True)
    identifiant = _matiere_ecrite(atelier, projet, "aaaa0004", endormie)
    assert atelier.assets.etat_de_matiere(atelier.assets.lire(identifiant)) == {
        "detouree": False, "refaisable": False,
    }


def test_une_matiere_que_le_bareme_veut_detouree_n_est_pas_accusee(atelier):
    """Le barème est celui de l'auteur : si sa « matière » a une silhouette, c'est voulu."""
    projet = _projet(atelier)
    objet = atelier.base.lire_projet(projet)
    objet.univers = replace(
        objet.univers,
        bareme=tuple(
            replace(e, silhouette=True) if e.nom == ECHELLE_MATIERE else e for e in objet.univers.bareme
        ),
    )
    atelier.bibliotheque.sauver_projet(objet)
    identifiant = _matiere_ecrite(atelier, projet, "aaaa0005", _recette_d_avant_le_correctif(atelier, projet))
    assert atelier.assets.etat_de_matiere(atelier.assets.lire(identifiant)) == {
        "detouree": False, "refaisable": False,
    }


def test_une_image_entree_telle_quelle_n_est_pas_detouree(atelier):
    projet = _projet(atelier)
    identifiant = _matiere_ecrite(atelier, projet, "aaaa0006", Recette())
    assert atelier.assets.etat_de_matiere(atelier.assets.lire(identifiant))["detouree"] is False


# ── Ce que l'écran lit ───────────────────────────────────────────────────────


def test_la_liste_et_la_fiche_disent_les_trois_etats(client, atelier):
    projet = _projet(atelier)
    saine, refaisable, perdue = _trois(atelier, projet)

    liste = client.get(f"/api/projects/{projet}/materials")
    assert liste.status_code == 200, liste.text
    par_id = {m["identifiant"]: m for m in liste.json()["matieres"]}
    assert set(par_id) == {saine, refaisable, perdue}
    dit = {i: (m["detouree"], m["refaisable"]) for i, m in par_id.items()}
    assert dit == {saine: (False, False), refaisable: (True, True), perdue: (True, False)}

    # La fiche d'une matière rend la même ligne que la liste, au champ près.
    for identifiant, ligne in par_id.items():
        seule = client.get(f"/api/projects/{projet}/materials/{identifiant}")
        assert seule.status_code == 200, seule.text
        assert seule.json() == ligne


def test_lire_une_matiere_refuse_ce_qui_n_en_est_pas_une_ou_n_est_pas_de_ce_jeu(client, atelier):
    projet = _projet(atelier)
    ordinaire = _matiere_ecrite(atelier, projet, "aaaa0007", None, echelle=None, matiere=False)
    matiere = _matiere_ecrite(atelier, projet, "aaaa0008", None)

    pas_matiere = client.get(f"/api/projects/{projet}/materials/{ordinaire}")
    assert pas_matiere.status_code == 409 and "pas une matière" in pas_matiere.json()["raison"]
    ailleurs = client.get(f"/api/projects/un-autre-jeu/materials/{matiere}")
    assert ailleurs.status_code == 404  # ce jeu-là n'existe pas
    inconnue = client.get(f"/api/projects/{projet}/materials/zzzz-0")
    assert inconnue.status_code == 404
    # Et `availability` reste sa propre route : la lecture d'une image ne l'a pas avalée.
    assert client.get(f"/api/projects/{projet}/materials/availability").status_code == 200


# ── Le geste : la bonne recette, à partir du brut, gratuitement ──────────────


def test_le_geste_remet_une_image_sans_detourage_a_partir_du_brut(client, atelier, double):
    projet = _projet(atelier)
    _, refaisable, _ = _trois(atelier, projet)
    avant = atelier.assets.lire(refaisable)
    fichiers_avant = _fichiers_de_l_asset(atelier, refaisable)
    generations_avant = {g.identifiant for g in atelier.base.generations_du_projet(projet)}
    assert generations_avant == {"aaaa0001", "aaaa0002", "aaaa0003"}  # le journal du jeu, tel qu'il était
    assert avant.recette.decoupe and _alpha_mini(atelier, avant) == 0

    reponse = client.post(f"/api/projects/{projet}/materials/{refaisable}/redo")

    assert reponse.status_code == 200, reponse.text
    assert (reponse.json()["detouree"], reponse.json()["refaisable"]) == (False, False)
    apres = atelier.assets.lire(refaisable)
    # La recette est celle que le jeu donne à une matière — celle de la naissance d'aujourd'hui.
    assert apres.recette == atelier.assets.recette_d_une_matiere(projet)
    assert not apres.recette.passes and apres.recette.recadrage is None
    assert apres.recette.grille is not None  # la grille et la palette du jeu, elles, restent
    assert apres.epingle is False
    # L'image est pleine : plus rien n'est transparent. Et c'est le fichier du disque qui le dit.
    assert _alpha_mini(atelier, apres) == 255
    assert (apres.rendu_largeur, apres.rendu_hauteur) == (avant.rendu_largeur, avant.rendu_hauteur)
    # Le brut n'a pas bougé d'un octet, et la génération non plus.
    fichiers_apres = _fichiers_de_l_asset(atelier, refaisable)
    assert fichiers_apres["0-brut.png"] == fichiers_avant["0-brut.png"]
    assert fichiers_apres["generation.json"] == fichiers_avant["generation.json"]
    # Aucun fournisseur appelé, aucune génération neuve, aucune dépense.
    assert double.appels == 0
    assert {g.identifiant for g in atelier.base.generations_du_projet(projet)} == generations_avant
    assert apres.cout_usd == avant.cout_usd == 0.0
    # Et l'état lu ensuite est celui d'une matière saine.
    assert client.get(f"/api/projects/{projet}/materials/{refaisable}").json()["detouree"] is False


def test_le_geste_est_le_meme_depuis_le_service(atelier, double):
    projet = _projet(atelier)
    _, refaisable, _ = _trois(atelier, projet)
    refaite = atelier.bibliotheque.refaire_matiere(refaisable, projet)
    assert refaite.recette == atelier.assets.recette_d_une_matiere(projet)
    assert double.appels == 0


def test_sans_le_brut_le_geste_refuse_avec_sa_phrase_et_ne_touche_a_rien(client, atelier):
    projet = _projet(atelier)
    _, _, perdue = _trois(atelier, projet)
    avant = _fichiers_de_l_asset(atelier, perdue)

    reponse = client.post(f"/api/projects/{projet}/materials/{perdue}/redo")

    assert reponse.status_code == 409, reponse.text
    assert "regénérer" in reponse.json()["raison"]
    assert _fichiers_de_l_asset(atelier, perdue) == avant
    assert atelier.assets.etat_de_matiere(atelier.assets.lire(perdue)) == {"detouree": True, "refaisable": False}


def test_une_matiere_saine_n_est_pas_reecrite_par_un_second_clic(client, atelier):
    projet = _projet(atelier)
    saine, refaisable, _ = _trois(atelier, projet)
    avant = _fichiers_de_l_asset(atelier, saine)

    reponse = client.post(f"/api/projects/{projet}/materials/{saine}/redo")
    assert reponse.status_code == 200 and reponse.json()["detouree"] is False
    assert _fichiers_de_l_asset(atelier, saine) == avant

    # Un double clic sur une détourée : le premier la refait, le second ne change plus rien.
    client.post(f"/api/projects/{projet}/materials/{refaisable}/redo")
    apres_le_premier = _fichiers_de_l_asset(atelier, refaisable)
    second = client.post(f"/api/projects/{projet}/materials/{refaisable}/redo")
    assert second.status_code == 200
    assert _fichiers_de_l_asset(atelier, refaisable) == apres_le_premier


def test_une_image_qui_n_est_pas_une_matiere_ou_pas_de_ce_jeu_n_est_pas_refaite(client, atelier):
    projet = _projet(atelier)
    avant = _recette_d_avant_le_correctif(atelier, projet)
    ordinaire = _matiere_ecrite(atelier, projet, "aaaa0009", avant, echelle=None, matiere=False)
    detouree = _matiere_ecrite(atelier, projet, "aaaa0010", avant)
    fichiers = _fichiers_de_l_asset(atelier, ordinaire)

    refus = client.post(f"/api/projects/{projet}/materials/{ordinaire}/redo")
    assert refus.status_code == 409 and "pas une matière" in refus.json()["raison"]
    assert _fichiers_de_l_asset(atelier, ordinaire) == fichiers
    assert atelier.assets.lire(ordinaire).recette.decoupe  # elle reste ce qu'elle était

    # Le service, lui, refuse aussi — sans passer par la route.
    with pytest.raises(RecetteRefusee, match="pas une matière"):
        atelier.assets.refaire_une_matiere(ordinaire)
    # Une image d'un autre jeu : l'adresse du jeu est celle qu'on vérifie.
    autre = atelier.bibliotheque.creer_projet("Un autre jeu").identifiant
    ailleurs = client.post(f"/api/projects/{autre}/materials/{detouree}/redo")
    assert ailleurs.status_code == 409
    assert atelier.assets.lire(detouree).recette.decoupe
    assert client.post(f"/api/projects/rien-du-tout/materials/{detouree}/redo").status_code == 404


# ── Jamais tout seul ─────────────────────────────────────────────────────────


def test_ni_l_ouverture_ni_la_lecture_ni_la_migration_ne_reparent_toutes_seules(client, atelier):
    projet = _projet(atelier)
    _, refaisable, perdue = _trois(atelier, projet)
    avant = {i: _fichiers_de_l_asset(atelier, i) for i in (refaisable, perdue)}

    client.get(f"/api/projects/{projet}/materials")
    client.get(f"/api/projects/{projet}/materials/{refaisable}")
    client.post(f"/api/projects/{projet}/materials/migrate")
    atelier.bibliotheque.migrer_matieres(projet)
    atelier.bibliotheque.reconstruire()
    atelier.bibliotheque.matieres(projet)

    assert {i: _fichiers_de_l_asset(atelier, i) for i in (refaisable, perdue)} == avant
    assert atelier.assets.etat_de_matiere(atelier.assets.lire(refaisable))["detouree"] is True


# ── L'écran et l'agent disent la même chose ──────────────────────────────────


async def test_l_agent_lit_la_meme_chose_que_l_ecran(agent):  # noqa: F811
    atelier, projet, _, _, appeler = agent
    saine, refaisable, perdue = _trois(atelier, projet)

    liste = await appeler("list_materials")
    par_id = {m["id"]: m for m in liste["materials"]}
    assert set(par_id) == {saine, refaisable, perdue}
    assert {i: (m["cut_out"], m["redoable"]) for i, m in par_id.items()} == {
        saine: (False, False), refaisable: (True, True), perdue: (True, False),
    }
    # Le même calcul que la route : champ pour champ.
    for identifiant, ligne in par_id.items():
        ecran = _matiere_json(atelier, atelier.assets.lire(identifiant))
        assert (ligne["cut_out"], ligne["redoable"]) == (ecran["detouree"], ecran["refaisable"])
    # La description de l'outil dit ce que les deux champs veulent dire.
    outils = {o.name: o for o in await _outils(agent)}
    description = outils["list_materials"].description
    assert "cut_out" in description and "redoable" in description


async def _outils(agent):
    from atelier.mcp.serveur import creer_serveur

    return await creer_serveur(agent[0]).list_tools()
