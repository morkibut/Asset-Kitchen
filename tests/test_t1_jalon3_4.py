# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T1 tenus par les jalons 3 et 4.

Le flux d'événements à la place du sondage, la jauge **déterminée**, la
génération qu'on retrouve en rouvrant l'onglet, et le repli hors ligne.

Deux d'entre eux ne se vérifient pas à l'endroit où on les regarde :

- **« sans sondage »** ne se prouve pas en comptant des requêtes HTTP absentes.
  Ce qui se prouve, c'est que l'atelier **annonce** chaque changement à qui
  écoute — si les événements partent, l'interface n'a plus rien à redemander.
  C'est le service qu'on interroge ici, pas le navigateur.
- **la jauge déterminée** est tracée par l'interface, mais elle ne peut l'être
  que si le serveur donne les deux faits qui la portent : l'instant du départ et
  l'attente mesurée du modèle. Ce sont ces deux faits qui sont testés.

Le double de fournisseur et les montages viennent de `tests/conftest.py`.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import Demande, Statut
from atelier.domaine.erreurs import FournisseurIndisponible
from atelier.services import Atelier
from atelier.services.evenements import Diffusion
from atelier.services.generation import ATTENTE_INCONNUE_S


# ── Lire un flux qui ne finit jamais ─────────────────────────────────────────
#
# `TestClient` et `httpx.ASGITransport` attendent tous les deux la **fin** de la
# réponse avant de rendre la main : un flux d'événements, par construction, n'en
# a pas. On appelle donc l'application ASGI directement, on lit les premiers
# messages, et on coupe la liaison comme un onglet qu'on ferme — ce qui vérifie
# du même coup que le serveur s'en remet.


async def _lire_le_flux(application, combien: int) -> tuple[int, list[tuple[str, dict]]]:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "path": "/api/events",
        "raw_path": b"/api/events",
        "query_string": b"",
        "root_path": "",
        "scheme": "http",
        "headers": [(b"host", b"atelier")],
        "client": ("essai", 0),
        "server": ("atelier", 80),
    }
    entete: dict = {}
    morceaux: list[str] = []
    demandee = False
    coupe = asyncio.Event()

    async def recevoir() -> dict:
        nonlocal demandee
        if not demandee:
            demandee = True
            return {"type": "http.request", "body": b"", "more_body": False}
        await coupe.wait()
        return {"type": "http.disconnect"}  # l'onglet se ferme

    async def envoyer(message: dict) -> None:
        if message["type"] == "http.response.start":
            entete.update(message)
        elif message["type"] == "http.response.body":
            corps = message.get("body", b"").decode("utf-8")
            if corps.strip():
                morceaux.append(corps)
            if len(morceaux) >= combien:
                coupe.set()

    await asyncio.wait_for(application(scope, recevoir, envoyer), 10.0)
    return entete["status"], [_decouper(m) for m in morceaux]


def _decouper(message: str) -> tuple[str, dict]:
    genre, charge = "", {}
    for ligne in message.splitlines():
        if ligne.startswith("event: "):
            genre = ligne.removeprefix("event: ")
        elif ligne.startswith("data: "):
            charge = json.loads(ligne.removeprefix("data: "))
    return genre, charge


def _vider(file: asyncio.Queue) -> list:
    recus = []
    while not file.empty():
        recus.append(file.get_nowait())
    return recus


# ── « Le flux d'événements à la place du sondage » ───────────────────────────


def test_chaque_changement_part_sur_le_flux_sans_qu_on_redemande(atelier, double):
    """Départ, arrivée : chaque état est annoncé, personne ne redemande rien."""

    async def scenario():
        await atelier.ouvrir()
        with atelier.diffusion.abonnement() as file:
            generation = await atelier.generations.soumettre(
                "essai/rend-du-png", Demande("un rat"), identifiant="annoncee"
            )
            await atelier.generations.attendre(generation.identifiant, 5.0)
            return _vider(file)

    recus = asyncio.run(scenario())
    generations = [e for e in recus if e.genre == "generation"]

    # Enregistrée, partie, arrivée : trois faits, trois annonces.
    statuts = [e.charge["statut"] for e in generations]
    assert statuts == ["en_attente", "en_cours", "reussie"]
    assert generations[-1].charge["emplacements"][0]["resultat"]["largeur"] == 48


def test_un_abonne_qui_s_en_va_ne_laisse_rien_derriere(atelier):
    """Une liaison fermée est une liaison oubliée — sinon les files s'empilent."""
    with atelier.diffusion.abonnement():
        pendant = atelier.diffusion.abonnes
    assert (pendant, atelier.diffusion.abonnes) == (1, 0)


def test_un_abonne_lent_ne_retient_jamais_une_generation():
    """La diffusion ne bloque jamais, et c'est le plus vieux message qui part.

    Un onglet en veille ne doit pas pouvoir retarder une image déjà payée. La
    file d'un abonné est donc bornée : quand elle déborde, elle perd du
    contexte — jamais la nouvelle la plus fraîche, et jamais le travail.
    """

    diffusion = Diffusion(profondeur=2)
    with diffusion.abonnement() as file:  # un abonné qui ne consomme rien
        for numero in range(10):  # bien au-delà de la profondeur
            diffusion.publier("generation", {"numero": numero})
        restants = _vider(file)

    # Dix publications sur une file de deux, et pas une seule attente.
    assert [e.charge["numero"] for e in restants] == [8, 9]


def test_le_flux_http_ouvre_sur_l_etat_complet(atelier):
    """`GET /api/events` : le premier message est l'état, pas un accusé vide."""

    async def scenario():
        await atelier.ouvrir()
        return await _lire_le_flux(creer_application(atelier), 1)

    statut, messages = asyncio.run(scenario())
    genre, charge = messages[0]

    assert statut == 200
    assert genre == "etat"
    assert set(charge) >= {"cle", "catalogue", "couts", "generations"}
    assert charge["catalogue"]["modeles"] == 2


# ── « L'onglet est fermé pendant une génération : à la réouverture, l'image
#     est là » ────────────────────────────────────────────────────────────────


def test_l_onglet_rouvert_retrouve_l_image_sans_la_redemander(atelier):
    """Rouvrir, c'est se rebrancher — et l'état complet arrive avant le reste."""
    identifiant = "pendant-que-l-onglet-etait-ferme"

    async def scenario():
        await atelier.ouvrir()
        # Personne n'écoute : la génération part et arrive dans le vide.
        await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("un tonneau"), identifiant=identifiant
        )
        await atelier.generations.attendre(identifiant, 5.0)
        # Puis l'onglet se rouvre.
        return await _lire_le_flux(creer_application(atelier), 1)

    _, messages = asyncio.run(scenario())
    _, charge = messages[0]

    retrouvee = next(
        g for g in charge["generations"] if g["identifiant"] == identifiant
    )
    assert retrouvee["statut"] == "reussie"
    assert retrouvee["emplacements"][0]["resultat"]["type_media"] == "image/png"
    assert charge["couts"]["total_usd"] == 0.0245


# ── « La jauge déterminée » ──────────────────────────────────────────────────


def test_un_emplacement_en_cours_porte_son_depart_et_son_attente(atelier, double):
    """Les deux seuls faits qui rendent une jauge déterminée possible.

    Aucun fournisseur d'image ne rend d'avancement en chemin : il n'y a rien à
    relayer. Ce que le serveur donne, c'est quand l'appel est parti et combien
    de temps ce modèle met d'habitude — l'interface trace le reste.
    """

    async def scenario():
        await atelier.ouvrir()
        double.retenir = asyncio.Event()
        generation = await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("deux variations", variations=2)
        )
        while atelier.generations.lire(generation.identifiant).statut != Statut.EN_COURS:
            await asyncio.sleep(0)
        pendant = atelier.generations.lire(generation.identifiant)
        double.retenir.set()
        return pendant, await atelier.generations.attendre(generation.identifiant, 5.0)

    pendant, apres = asyncio.run(scenario())

    for emplacement in pendant.emplacements:
        assert emplacement.statut == Statut.EN_COURS
        assert emplacement.demarre_le is not None and emplacement.demarre_le > 0
        assert emplacement.duree_attendue_s == ATTENTE_INCONNUE_S
    assert all(e.statut == Statut.REUSSIE for e in apres.emplacements)


def test_une_generation_se_lance_pendant_qu_une_autre_tourne(atelier, double):
    """« Sans attendre la première » — critère d'acceptation de T1.

    Le serveur ne fait pas la queue : la seconde part, arrive et s'annonce
    pendant que la première est encore chez le fournisseur.
    """

    async def scenario():
        await atelier.ouvrir()
        double.retenir = asyncio.Event()

        premiere = await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("la lente", variations=2), identifiant="lente"
        )
        while atelier.generations.lire(premiere.identifiant).statut != Statut.EN_COURS:
            await asyncio.sleep(0)

        # La première est chez le fournisseur, et n'en revient pas encore.
        double.retenir = None
        await atelier.generations.soumettre(
            "essai/rend-du-jpeg", Demande("la rapide"), identifiant="rapide"
        )
        rapide = await atelier.generations.attendre("rapide", 5.0)
        lente_pendant = atelier.generations.lire("lente")

        return rapide, lente_pendant

    rapide, lente_pendant = asyncio.run(scenario())

    assert rapide.statut == Statut.REUSSIE
    assert lente_pendant.statut == Statut.EN_COURS  # elle attend toujours


def test_l_attente_se_recale_sur_les_durees_reellement_mesurees(atelier, double):
    """Une valeur d'amorçage, puis plus jamais : c'est une mesure, pas une table."""
    double.duree_annoncee_s = 0.12

    async def scenario():
        await atelier.ouvrir()
        avant = atelier.generations.attente_estimee("essai/rend-du-png")
        for numero in range(3):
            generation = await atelier.generations.soumettre(
                "essai/rend-du-png", Demande(f"sujet {numero}")
            )
            await atelier.generations.attendre(generation.identifiant, 5.0)
        return avant, atelier.generations.attente_estimee("essai/rend-du-png")

    avant, apres = asyncio.run(scenario())

    assert avant == ATTENTE_INCONNUE_S  # rien de mesuré, rien d'inventé
    assert apres == pytest.approx(0.12, abs=0.06)
    assert apres != ATTENTE_INCONNUE_S


def test_une_generation_interrompue_n_affiche_plus_de_jauge(tmp_path, double, monkeypatch):
    """Interrompue, elle n'est plus en cours : il n'y a plus rien à mesurer."""
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    atelier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)

    async def coupee():
        await atelier.ouvrir()
        generation, _, _ = atelier.generations.preparer(
            "essai/rend-du-png", Demande("interrompue")
        )
        return generation.identifiant

    identifiant = asyncio.run(coupee())

    suivant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(suivant.ouvrir())

    emplacement = suivant.generations.lire(identifiant).emplacements[0]
    assert emplacement.statut == Statut.INTERROMPUE
    assert emplacement.demarre_le is None


# ── « Réseau coupé : le repli est visible, et l'échec attend le moment de
#     générer » ─────────────────────────────────────────────────────────────


def test_hors_ligne_l_ecran_a_de_quoi_dater_son_repli(tmp_path, double, monkeypatch):
    """Tout ce que le repli affiche vient de `GET /api/status`, en un appel."""
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    premier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(premier.ouvrir())  # une photo du catalogue est écrite sur le disque

    double.catalogue_lisible = False
    suivant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    with TestClient(creer_application(suivant)) as client:
        catalogue = client.get("/api/status").json()["catalogue"]

    assert catalogue["repli"] is True
    assert catalogue["recu_le"] > 0  # la date en clair, sous le bouton Générer
    assert catalogue["raison"] == "catalogue injoignable — réseau coupé"
    assert catalogue["modeles"] == 2  # un prompt se prépare quand même


def test_hors_ligne_l_echec_ne_survient_qu_au_moment_de_generer(
    tmp_path, double, monkeypatch
):
    """Le démarrage ne dit rien, le prompt part, c'est l'appel qui échoue."""
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    premier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(premier.ouvrir())

    double.catalogue_lisible = False
    double.echec = FournisseurIndisponible("appel injoignable — réseau coupé")
    suivant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)

    with TestClient(creer_application(suivant)) as client:
        assert client.get("/api/status").status_code == 200  # aucune erreur à l'ouverture

        depot = client.post(
            "/api/generations",
            json={"modele": "essai/rend-du-png", "prompt": "un rat", "variations": 2},
        )
        assert depot.status_code == 202  # la demande est acceptée, elle n'est pas refusée

        relue = client.get(f"/api/generations/{depot.json()['identifiant']}").json()

    assert relue["statut"] == "echouee"
    assert all(
        e["raison"] == "appel injoignable — réseau coupé" for e in relue["emplacements"]
    )


def test_le_retour_du_reseau_s_annonce_a_tous_les_onglets(atelier, double):
    """Sortir du repli est un fait : il part sur le flux, personne ne recharge."""
    double.catalogue_lisible = False

    async def scenario():
        await atelier.ouvrir()  # hors ligne, et aucune photo sur le disque
        with atelier.diffusion.abonnement() as file:
            double.catalogue_lisible = True
            await atelier.catalogue.rafraichir()
            return _vider(file)

    catalogues = [e for e in asyncio.run(scenario()) if e.genre == "catalogue"]
    assert len(catalogues) == 1
    assert catalogues[0].charge["repli"] is False
    assert catalogues[0].charge["modeles"] == 2
    assert catalogues[0].charge["recu_le"] > 0
