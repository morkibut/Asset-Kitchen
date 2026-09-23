"""RV7 : le retour, là où l'on a cliqué — la case « en cours », remontée par le serveur.

La forme de l'état est écrite en tête de `atelier/services/retours.py` : un
retour se **déduit** des travaux conservés et du chantier des images, il ne
s'enregistre nulle part. D'où le critère : il survit à un rechargement, parce
que l'écran n'a rien poussé — il relit. Fournisseurs doublés : aucun essai ne
coûte.
"""

import asyncio

import httpx

from atelier.api.app import creer_application
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.image import controle_clip
from atelier.services.retours import attendu_s, phase, retours_par_case
from tests.test_au3 import production  # noqa: F401
from tests.test_rv5_serie import _commune, _deux_directions, _reference, _sujet


async def _fin(atelier, projet, travail):
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    return atelier.travaux.lire(projet, travail["identifiant"])


# ── Ce que le serveur remonte, et quand ──────────────────────────────────────


async def test_un_travail_prepare_ne_rend_rien_un_travail_parti_rend_sa_case(production):
    atelier, projet, demande, _ = production
    personnage = demande["personnage"]
    travail = await atelier.travaux.preparer(projet, demande)
    assert atelier.travaux.retours(projet, personnage) == {"retours": [], "clips_suivis": []}

    # Lancé, et relu **avant** que la tâche n'ait tourné : le travail est
    # « en cours » sur le disque, et c'est tout ce que la case lit.
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    [retour] = atelier.travaux.retours(projet, personnage)["retours"]
    assert retour["etat"] == "en_cours" and retour["nature"] == "clip"
    assert (retour["personnage"], retour["pose"], retour["direction"]) == (personnage, "marche", "ouest")
    assert retour["travail"] == travail["identifiant"] and retour["lance_le"] > 0
    # La référence n'existe pas encore : on attend l'image de départ.
    assert retour["phase"] == "image"
    assert retour["raison"] is None
    # L'image de départ du travail passe par le chantier : elle n'est pas une
    # image fixe de plus dans la case.
    assert all(r["nature"] == "clip" for r in atelier.travaux.retours(projet, personnage)["retours"])

    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    # Fini : plus de retour, la bande est dans la case par son chemin à elle.
    assert atelier.travaux.retours(projet, personnage) == {"retours": [], "clips_suivis": []}
    assert fini["phase"] == "termine" and fini["lance_le"] >= retour["lance_le"]


async def test_le_retour_survit_a_une_relecture_par_la_route(production):
    """Deux lectures de la route, comme deux ouvertures de la page : la même
    case, le même départ. Rien n'est gardé côté écran."""
    atelier, projet, demande, _ = production
    travail = await atelier.travaux.preparer(projet, demande)
    # Le calcul reste « en cours » tant qu'on ne le libère pas : les lectures
    # ci-dessous regardent bien un travail qui tourne.
    libre = asyncio.Event()

    async def tourne(_projet, _identifiant, _reprise):
        await libre.wait()

    atelier.travaux._executer = tourne
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    app = creer_application(atelier)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8420") as client:
            adresse = f"/api/projects/{projet}/production-jobs/by-case"
            premiere = (await client.get(adresse, params={"personnage": demande["personnage"]})).json()
            seconde = (await client.get(adresse, params={"personnage": demande["personnage"]})).json()
            autre = (await client.get(adresse, params={"personnage": "personne"})).json()
            # La route des travaux ne prend pas « by-case » pour un identifiant.
            tous = await client.get(adresse)
    libre.set()
    await atelier.travaux.attendre_tout()
    assert premiere["retours"] and premiere["retours"] == seconde["retours"]
    assert premiere["retours"][0]["travail"] == travail["identifiant"]
    assert premiere["retours"][0]["etat"] == "en_cours"
    assert autre == {"retours": [], "clips_suivis": []}
    assert tous.status_code == 200 and tous.json()["retours"] == premiere["retours"]


async def test_un_clip_rate_dit_ratee_avec_sa_raison_jusqu_a_la_relance(production, monkeypatch):
    atelier, projet, demande, _ = production
    personnage = demande["personnage"]
    monkeypatch.setattr(controle_clip, "SEUIL_VIDE_OPAQUE", 2.0)
    rate = await _fin(atelier, projet, await atelier.travaux.preparer(projet, demande))
    assert rate["controle"] == "vide", rate
    lus = atelier.travaux.retours(projet, personnage)
    [retour] = lus["retours"]
    assert retour["etat"] == "ratee" and retour["raison"] == rate["raison"]
    # « Relancer » reprend la demande mot pour mot : elle part avec le retour.
    assert retour["demande"] == rate["demande"]
    # Le clip raté n'est pas montré une seconde fois parmi les clips à monter.
    assert lus["clips_suivis"] == [rate["clip"]]

    # Relancé sur la même case : l'échec s'efface, le nouveau prend sa place.
    monkeypatch.undo()
    reprise = await atelier.travaux.preparer(projet, {**demande, "cle": "marche-2"})
    await atelier.travaux.demarrer(projet, reprise["identifiant"])
    [nouveau] = atelier.travaux.retours(projet, personnage)["retours"]
    assert nouveau["travail"] == reprise["identifiant"] and nouveau["etat"] == "en_cours"
    await atelier.travaux.attendre_tout()


async def test_une_serie_rend_une_case_par_direction(production):
    atelier, projet, demande, _ = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="rv7-serie")
    await atelier.travaux.preparer_serie(projet, commune, [{"pose": "attaque", "direction": ouest},
                                                           {"pose": "attaque", "direction": est}], 1)
    await atelier.travaux.demarrer_serie(projet, "rv7-serie")
    retours = atelier.travaux.retours(projet, gardienne)["retours"]
    assert sorted(r["direction"] for r in retours) == sorted([ouest, est])
    assert {r["serie"] for r in retours} == {"rv7-serie"}
    # L'image de départ existe : on attend la vidéo, pas l'image.
    assert {r["phase"] for r in retours} == {"video"}
    await atelier.travaux.attendre_tout()


# ── Le module pur ────────────────────────────────────────────────────────────


def test_le_temps_attendu_part_du_lancement_et_compte_la_file():
    annonce = {"temps_local": {"secondes": 60, "secondes_suivant": 20}}
    assert attendu_s({"annonce": annonce}) == 60
    assert attendu_s({"annonce": annonce, "serie": {"rang": 2}}) == 100
    # Payant, ou jamais mesuré : personne ne sait, on n'invente pas.
    assert attendu_s({"annonce": {"temps_local": None}}) is None


def test_la_phase_dit_image_video_decoupage():
    assert phase({"etape": "reference"}) == "image"
    assert phase({"etape": "reference", "entree_video": {"url": "x"}}) == "video"
    assert phase({"etape": "file_locale"}) == "video"
    assert phase({"etape": "montage"}) == "decoupage"


def _image(identifiant, statut, **champs):
    return Generation(identifiant=identifiant, modele="essai:m", demande={}, parametres_resolus={},
                      emplacements=[Emplacement(rang=0, statut=statut)], **champs)


def test_une_image_en_vol_rend_sa_case_une_image_de_depart_non():
    travail = {"identifiant": "t", "etat": "en_cours", "etape": "reference_soumise", "generation_image": "ref",
               "demande": {"personnage": "p", "pose": "marche", "direction": "ouest"}, "cree_le": 1.0}
    chantier = [
        _image("img", Statut.EN_COURS, personnage="p", pose="garde", direction="est", cree_le=5.0),
        _image("ref", Statut.EN_COURS, personnage="p", pose="marche", direction="ouest"),
        _image("arrivee", Statut.REUSSIE, personnage="p", pose="garde"),
        _image("sans-case", Statut.EN_COURS, personnage="p"),
        _image("autre", Statut.EN_COURS, personnage="q", pose="garde"),
    ]
    lus = retours_par_case([travail], chantier, "p")
    assert [(r["nature"], r.get("generation") or r["travail"]) for r in lus["retours"]] == [("clip", "t"), ("image", "img")]
    image = lus["retours"][1]
    assert (image["pose"], image["direction"], image["etat"], image["lance_le"]) == ("garde", "est", "en_cours", 5.0)
