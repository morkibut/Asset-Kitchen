"""RV8 · un seul dossier par jeu, et une seule règle des animations qui partent.

Deux choses, côté serveur :

- **RV8b — le dossier.** La forme « fichiers » (B21) se lit sur le jeu Godot
  rattaché (l'association d'AU1, plus `fichiers.json`). L'ordre : le dossier
  nommé dans l'appel, puis le jeu rattaché, puis l'ancien dossier de sortie en
  lecture seule, puis le refus « rattache ton jeu Godot ». Le `dossier_jeu` de
  l'agent n'en fait plus partie.
- **RV8c — `bandes_livrables`.** Une bande dont tous les clips ont échoué ne part
  ni en fichiers, ni en paquet Godot, et se dit dans « pas prêt ». Et
  `prevoir_plusieurs` prépare tout le jeu, un `prevoir` par sujet, chaque paquet
  gardant ses octets.

Le recours de RV1 (clip vide après détourage, resté `reussie`) n'est pas touché :
`tests/test_rv1.py` le tient.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from atelier.domaine import sortie as vocabulaire
from atelier.domaine.bande import Prise
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.services.livraison import LivraisonRefusee
from tests.test_au1 import _bande

PROJECT_GODOT = 'config_version=5\n[application]\nconfig/name="RV8"\n'


def _godot(dossier: Path) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "project.godot").write_text(PROJECT_GODOT, encoding="utf-8")
    return dossier


def _clip(atelier, identifiant: str, statut: Statut) -> None:
    """Un clip, réduit à ce que la règle lit : son statut."""
    atelier.base.enregistrer(Generation(
        identifiant=identifiant, modele="essai:clip", demande={}, parametres_resolus={},
        emplacements=[Emplacement(rang=0, statut=statut)],
        projet=atelier.bibliotheque.courant,
    ))


def _sur_le_clip(atelier, bande, clip: str):
    """La bande, tirée de ce clip-là — comme un montage à la main l'aurait fait."""
    bande.clip = clip
    atelier.base.enregistrer_bande(bande)
    return bande


@pytest.fixture
def jeu(atelier, client):
    projet = atelier.bibliotheque.courant
    pelerin = atelier.production.creer_personnage(projet, "Le pèlerin").identifiant
    return projet, pelerin


# ── RV8b · Le dossier ───────────────────────────────────────────────────────


def test_sans_rien_le_refus_dit_rattache_ton_jeu(atelier, client, jeu, tmp_path):
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "aucun"
    assert reglages["dossier"] == "" and reglages["racine"] == ""
    assert "rattache ton jeu Godot" in reglages["refus"]
    apercu = client.post("/api/output/preview", json={}).json()
    assert "rattache ton jeu Godot" in apercu["refus"]


def test_le_reglage_de_l_agent_ne_sert_plus_de_dossier(atelier, client, jeu, tmp_path):
    """La fuite que RV8 ferme : `dossier_jeu` est commun à tout l'atelier."""
    client.put("/api/settings/agent", json={"dossier_jeu": str(tmp_path / "depot-agent")})
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "aucun" and reglages["dossier"] == ""


def test_le_jeu_rattache_donne_racine_et_sous_dossier(atelier, client, jeu, tmp_path):
    projet, _ = jeu
    godot = _godot(tmp_path / "Mon jeu")
    assert client.put(f"/api/projects/{projet}/godot-link", json={"dossier": str(godot)}).status_code == 200
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "jeu"
    assert Path(reglages["racine"]) == godot.resolve()
    assert reglages["sous_dossier"] == "assets/asset-kitchen/fichiers"
    assert Path(reglages["dossier"]) == godot.resolve() / "assets" / "asset-kitchen" / "fichiers"
    assert reglages["mention"] == "" and reglages["rattacher"] is None and reglages["refus"] == ""


def test_le_dossier_nomme_gagne_sur_le_jeu_rattache(atelier, client, jeu, tmp_path):
    projet, _ = jeu
    godot = _godot(tmp_path / "Mon jeu")
    atelier.livraison.associer(projet, str(godot))
    ailleurs = tmp_path / "ailleurs"
    assert atelier.sortie.destination(
        projet, vocabulaire.Reglage(dossier=str(ailleurs))
    )["origine"] == "demande"
    assert atelier.sortie.dossier(projet, vocabulaire.Reglage(dossier=str(ailleurs))) == str(ailleurs)


def test_le_jeu_rattache_gagne_sur_l_ancien_dossier(atelier, client, jeu, tmp_path):
    projet, _ = jeu
    atelier.fichiers.ecrire_sorties({projet: {"le": 1.0, "dossier": str(tmp_path / "vieux"), "chemins": []}})
    assert client.get("/api/output/settings").json()["origine"] == "ancien"
    atelier.livraison.associer(projet, str(_godot(tmp_path / "Mon jeu")))
    assert client.get("/api/output/settings").json()["origine"] == "jeu"


def test_l_ancien_dossier_se_lit_avec_sa_mention_et_propose_de_rattacher(atelier, client, jeu, tmp_path):
    """Migration à la lecture, **sans écriture silencieuse** (note §3)."""
    projet, _ = jeu
    godot = _godot(tmp_path / "Le moulin")
    vieux = godot / "assets" / "sprites"
    atelier.fichiers.ecrire_sorties({projet: {"le": 1.0, "dossier": str(vieux), "chemins": []}})
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "ancien"
    assert Path(reglages["dossier"]) == vieux
    assert reglages["mention"] == "ancien dossier, pas rattaché au jeu Godot"
    assert Path(reglages["rattacher"]["dossier"]) == godot.resolve()
    assert reglages["rattacher"]["sous_dossier"] == "assets/sprites"
    # Proposé, pas fait : aucune association n'a été écrite.
    assert atelier.livraison.association(projet) is None

    # Le clic « Rattacher » : les deux routes, et les fichiers ne bougent pas.
    proposition = reglages["rattacher"]
    client.put(f"/api/projects/{projet}/godot-link", json={"dossier": proposition["dossier"]})
    client.put("/api/output/folder", json={"sous_dossier": proposition["sous_dossier"]})
    relus = client.get("/api/output/settings").json()
    assert relus["origine"] == "jeu" and Path(relus["dossier"]) == vieux.resolve()


def test_un_ancien_dossier_hors_de_tout_jeu_ne_propose_rien(atelier, client, jeu, tmp_path):
    projet, _ = jeu
    atelier.fichiers.ecrire_sorties({projet: {"le": 1.0, "dossier": str(tmp_path / "vrac"), "chemins": []}})
    assert client.get("/api/output/settings").json()["rattacher"] is None


def test_un_jeu_deplace_refuse_et_ne_recree_rien(atelier, client, jeu, tmp_path, double):
    projet, pelerin = jeu
    godot = _godot(tmp_path / "Mon jeu")
    atelier.livraison.associer(projet, str(godot))
    (godot / "project.godot").unlink()
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "jeu" and reglages["dossier"] == ""
    assert "n'est plus là" in reglages["refus"]
    reponse = client.post("/api/output", json={})
    assert reponse.status_code == 409 and "n'est plus là" in reponse.json()["raison"]
    assert not (godot / "assets").exists()


@pytest.mark.parametrize("mauvais", ["../dehors", "C:/ailleurs", "", "a/../../b"])
def test_le_sous_dossier_est_relatif_et_borne(atelier, client, jeu, tmp_path, mauvais):
    projet, _ = jeu
    atelier.livraison.associer(projet, str(_godot(tmp_path / "Mon jeu")))
    reponse = client.put("/api/output/folder", json={"sous_dossier": mauvais})
    assert reponse.status_code == 409, reponse.text
    assert not (atelier.livraison._dossier(projet) / "fichiers.json").exists()


def test_la_route_du_sous_dossier_rend_la_destination(atelier, client, jeu, tmp_path):
    projet, _ = jeu
    godot = _godot(tmp_path / "Mon jeu")
    atelier.livraison.associer(projet, str(godot))
    rendu = client.put("/api/output/folder", json={"sous_dossier": "art\\sprites"}).json()
    assert rendu["origine"] == "jeu" and rendu["sous_dossier"] == "art/sprites"
    assert Path(rendu["dossier"]) == godot.resolve() / "art" / "sprites"


def test_la_fois_d_avant_se_retrouve_sous_une_autre_graphie(atelier, client, jeu, tmp_path):
    """« Effacer ce qui ne sort plus » compare des chemins résolus, sans casse."""
    projet, pelerin = jeu
    _bande(atelier, projet, pelerin)
    dossier = tmp_path / "Sortie"
    assert client.post("/api/output", json={"dossier": str(dossier)}).status_code == 200
    # Un fichier de la fois d'avant qui ne sortira plus : un reste.
    precedente = atelier.fichiers.lire_sorties()
    precedente[projet]["chemins"].append("vieux.png")
    atelier.fichiers.ecrire_sorties(precedente)
    (dossier / "vieux.png").write_bytes(b"x")

    graphies = [str(dossier / "sous" / ".."), str(dossier) + os.sep]
    if os.name == "nt":
        graphies.append(str(dossier).swapcase())
    for graphie in graphies:
        apercu = client.post("/api/output/preview", json={"dossier": graphie}).json()
        assert [r["chemin"] for r in apercu["restes"]] == ["vieux.png"], graphie


# ── RV8c · bandes_livrables ─────────────────────────────────────────────────


def test_une_bande_toute_echouee_ne_part_nulle_part_et_se_dit(atelier, client, jeu, tmp_path):
    projet, pelerin = jeu
    _clip(atelier, "clip-rate", Statut.ECHOUEE)
    bonne = _bande(atelier, projet, pelerin, identifiant="marche-bonne", direction="est")
    ratee = _sur_le_clip(atelier, _bande(atelier, projet, pelerin, identifiant="marche-ratee"), "clip-rate")

    # La forme « fichiers » : elle ne sort pas, et « pas prêt » la nomme.
    apercu = client.post("/api/output/preview", json={
        "dossier": str(tmp_path / "sortie"), "lot": "animations"}).json()
    sources = {f["source"] for f in apercu["fichiers"]}
    assert bonne.identifiant in sources and ratee.identifiant not in sources
    alertes = {a["genre"]: a for a in apercu["pas_prets"]}
    assert [s["identifiant"] for s in alertes[vocabulaire.ANIMATION_ECHOUEE]["sujets"]] == [ratee.identifiant]

    # Le paquet Godot : absente de la liste, et refusée si on la nomme.
    choix = [a["identifiant"] for a in atelier.livraison.animations(projet, pelerin)]
    assert choix == [bonne.identifiant]
    atelier.livraison.associer(projet, str(_godot(tmp_path / "Mon jeu")))
    with pytest.raises(LivraisonRefusee, match="clip échoué"):
        atelier.livraison.prevoir(projet, pelerin, [ratee.identifiant])


def test_un_seul_clip_echoue_ne_suffit_pas_a_ecarter(atelier, client, jeu):
    """Une bande mêlée (A7) dont un clip a réussi reste livrable, et un clip
    inconnu de la base n'est pas un clip échoué."""
    projet, pelerin = jeu
    _clip(atelier, "clip-rate", Statut.ECHOUEE)
    _clip(atelier, "clip-bon", Statut.REUSSIE)
    melee = _bande(atelier, projet, pelerin, identifiant="melee")
    melee.prises = (Prise(0, clip="clip-rate"), Prise(1, clip="clip-bon"))
    atelier.base.enregistrer_bande(melee)
    inconnue = _sur_le_clip(atelier, _bande(atelier, projet, pelerin, identifiant="inconnue",
                                            direction="est"), "clip-jamais-vu")
    livrables = [a["identifiant"] for a in atelier.livraison.animations(projet, pelerin)]
    assert set(livrables) == {melee.identifiant, inconnue.identifiant}


# ── RV8c · prevoir_plusieurs ────────────────────────────────────────────────


def test_tout_le_jeu_un_paquet_par_sujet_aux_memes_octets(atelier, client, jeu, tmp_path):
    projet, pelerin = jeu
    sorciere = atelier.production.creer_personnage(projet, "La sorcière").identifiant
    passeur = atelier.production.creer_personnage(projet, "Le passeur").identifiant
    rate = atelier.production.creer_personnage(projet, "Le raté").identifiant
    _clip(atelier, "clip-rate", Statut.ECHOUEE)

    _bande(atelier, projet, pelerin, identifiant="p-marche")
    _bande(atelier, projet, pelerin, identifiant="p-saut", pose="saut")
    # Deux versions de la même case : la favorite part, pas l'autre.
    vieille = _bande(atelier, projet, sorciere, identifiant="s-marche-1")
    favorite = _bande(atelier, projet, sorciere, identifiant="s-marche-2")
    favorite.favori = True
    atelier.base.enregistrer_bande(favorite)
    _sur_le_clip(atelier, _bande(atelier, projet, rate, identifiant="r-marche"), "clip-rate")
    atelier.livraison.associer(projet, str(_godot(tmp_path / "Mon jeu")))

    rendu = client.post(f"/api/projects/{projet}/deliveries/preview-all", json={}).json()
    par_sujet = {p["personnage"]: p for p in rendu["paquets"]}
    assert set(par_sujet) == {pelerin, sorciere}
    assert {a["bande"] for a in par_sujet[sorciere]["animations"]} == {favorite.identifiant}
    assert vieille.identifiant not in {a["bande"] for a in par_sujet[sorciere]["animations"]}
    assert {e["personnage"] for e in rendu["ecartes"]} == {passeur, rate}

    # Chaque paquet a les octets qu'il aurait eus préparé seul.
    for personnage, bandes in ((pelerin, ["p-marche", "p-saut"]), (sorciere, [favorite.identifiant])):
        seul = atelier.livraison.prevoir(projet, personnage, bandes)
        groupe = par_sujet[personnage]
        assert groupe["revision"] == seul["revision"]
        assert [(f["chemin"], f["empreinte"]) for f in groupe["fichiers"]] == [
            (f["chemin"], f["empreinte"]) for f in seul["fichiers"]]
        # Et il se livre comme un paquet seul.
        assert atelier.livraison.livrer(projet, groupe["jeton"])["etat"] == "terminee"


def test_tout_le_jeu_se_restreint_aux_sujets_nommes(atelier, client, jeu, tmp_path):
    projet, pelerin = jeu
    autre = atelier.production.creer_personnage(projet, "L'autre").identifiant
    _bande(atelier, projet, pelerin, identifiant="p-marche")
    _bande(atelier, projet, autre, identifiant="a-marche")
    atelier.livraison.associer(projet, str(_godot(tmp_path / "Mon jeu")))
    rendu = atelier.livraison.prevoir_plusieurs(projet, [autre])
    assert [p["personnage"] for p in rendu["paquets"]] == [autre]


def test_tout_le_jeu_sans_jeu_rattache_refuse_une_fois(atelier, client, jeu):
    projet, pelerin = jeu
    _bande(atelier, projet, pelerin, identifiant="p-marche")
    reponse = client.post(f"/api/projects/{projet}/deliveries/preview-all", json={})
    assert reponse.status_code == 409
    assert "Associer d'abord" in reponse.json()["raison"]
    assert json.dumps(reponse.json())  # une phrase, pas une trace
