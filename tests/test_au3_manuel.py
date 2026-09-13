"""AU3 : le même chemin **à la main**, sans client MCP, jusqu'à l'export.

Deux garanties, deux essais.

1. Le parcours entier tient sur la seule façade de l'auteur : le personnage est
   créé vide par l'API de l'interface, reçoit son objectif, sa référence, son
   clip, sa bande, puis ses fichiers Godot. Aucune session MCP n'est ouverte de
   toute la séance — l'essai le vérifie sur le gestionnaire de sessions lui-même.
2. Rien de ce geste n'est mis au compte de l'agent : ni la provenance écrite sur
   les générations, ni le compteur de séance, ni les plafonds du cadre de
   délégation, qui restent entiers pour une demande agent ultérieure.

Fournisseurs doublés, stockage jetable, aucun appel payant réel.
"""

import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.generation import AGENT, AUTEUR
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from atelier.services.travaux import ServiceTravaux
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4
from tests.conftest import image_sujet


def _demande(personnage: str, cle: str = "marche-a-la-main") -> dict:
    return {"cle": cle, "personnage": personnage, "pose": "marche", "direction": "ouest",
            "modele_image": "essai:rend-du-png", "plafond_image_usd": 0.1,
            "modele_video": MELE.identifiant, "prompt_video": "Walk in place, keep the silhouette visible.",
            "cadence": 11, "nombre_images": 4, "options_video": {"seed": 7}}


OBJECTIF = {"sorties": [{"nature": "animation", "pose": "marche", "direction": "ouest"}],
            "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64}}


@pytest.fixture
async def manuel(tmp_path, double):
    animateur = AnimateurDouble()

    async def observer():
        return {"etat": "disponible", "travaux": []}

    animateur.observer_ressource = observer
    animateur.octets = clip_mp4()
    double.rendre = image_sujet
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double,
                      fabrique_animateur=lambda: animateur)
    atelier.travaux = ServiceTravaux(atelier)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    objet = atelier.base.lire_projet(projet)
    objet.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(objet)
    godot = tmp_path / "Jeu-jetable"
    godot.mkdir()
    (godot / "project.godot").write_text(
        'config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n', encoding="utf-8")
    yield atelier, projet, godot, animateur
    for tache in atelier.travaux._taches.values():
        if not tache.done():
            tache.cancel()
    await atelier.travaux.attendre_tout()
    await atelier.animation.attendre_tout()


def _sessions_mcp(application) -> dict:
    """Les sessions MCP réellement ouvertes sur cette application."""
    gestionnaire = application.state.mcp.session_manager
    return getattr(gestionnaire, "_server_instances", {})


async def test_chemin_manuel_complet_sans_mcp_jusqu_a_l_export(manuel, double):
    atelier, projet, godot, animateur = manuel
    application = creer_application(atelier)
    async with application.router.lifespan_context(application):
        assert not _sessions_mcp(application)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application),
                                     base_url="http://127.0.0.1:8420") as client:
            # 1. Le dossier du jeu, associé depuis l'écran de la sortie.
            liaison = await client.put(f"/api/projects/{projet}/godot-link",
                                       json={"dossier": str(godot), "sous_dossier": "assets/asset-kitchen"})
            assert liaison.status_code == 200, liaison.text

            # 2. Un personnage vide, créé à la main. Aucune image, aucun plan.
            creation = await client.post("/api/characters", json={
                "nom": "La sentinelle manuelle", "description": "Une sentinelle en manteau gris", "projet": projet})
            assert creation.status_code == 201, creation.text
            personnage = creation.json()["personnage"]["identifiant"]

            # 3. L'objectif, déclaré depuis le même écran.
            objectif = await client.put(f"/api/characters/{personnage}/objective",
                                        json={"objectif": OBJECTIF, "projet": projet})
            assert objectif.status_code == 200, objectif.text
            assert objectif.json()["origine"] == "explicite"
            couverture = objectif.json()["couverture"]
            assert couverture["animations"] == {"demande": 1, "produit": 0, "retenu": 0,
                                                "manquant": 1, "a_retenir": 1}, couverture
            assert couverture["images"]["demande"] == 0, couverture

            # 4. La relecture avant l'envoi ne coûte rien.
            racine = f"/api/projects/{projet}/production-jobs"
            preparation = await client.post(racine + "/preview", json=_demande(personnage))
            assert preparation.status_code == 200, preparation.text
            travail = preparation.json()
            assert travail["etat"] == "prepare" and travail["acteur"] == AUTEUR
            assert travail["envoi_image"]["prompt"]
            assert double.appels == len(animateur.soumissions) == 0

            # 5. Référence, clip et bande, en une seule chaîne.
            depart = await client.post(f"{racine}/{travail['identifiant']}/start")
            assert depart.status_code == 200, depart.text
            fini = (await client.get(f"{racine}/{travail['identifiant']}?attente=10")).json()
            assert fini["etat"] == "termine", fini
            assert fini["acteur"] == AUTEUR
            assert fini["reference_asset"] and fini["clip"] and len(fini["bandes"]) == 1
            assert double.appels == len(animateur.soumissions) == 1
            assert sum(c["cout_usd"] for c in fini["consommations"]) > 0

            # 6. L'export : relecture des fichiers, puis écriture dans le jeu.
            relecture = await client.post(f"/api/projects/{projet}/deliveries/preview", json={
                "personnage": personnage, "bandes": fini["bandes"],
                "pivot_x": 32, "pivot_y": 64, "boucles": {fini["bandes"][0]: True}})
            assert relecture.status_code == 200, relecture.text
            apercu = relecture.json()
            assert apercu["pret"] and apercu["fichiers"] and not apercu["conflits"]
            # La relecture n'écrit rien : le jeu ne contient encore que sa fiche.
            assert [p.name for p in godot.rglob("*") if p.is_file()] == ["project.godot"]

            livraison = await client.post(f"/api/projects/{projet}/deliveries", json={"jeton": apercu["jeton"]})
            assert livraison.status_code == 200, livraison.text
            assert livraison.json()["etat"] == "terminee"

            historique = (await client.get(f"/api/projects/{projet}/deliveries")).json()
            assert [l["etat"] for l in historique["livraisons"]] == ["terminee"]

        # Les fichiers existent vraiment dans le projet Godot jetable.
        ecrits = sorted(p.relative_to(godot).as_posix() for p in godot.rglob("*") if p.is_file())
        assert any(nom.endswith(".tscn") for nom in ecrits), ecrits
        assert any(nom.endswith(".png") for nom in ecrits), ecrits

        # Aucun client MCP n'a été monté de toute la séance.
        assert not _sessions_mcp(application)

    # Le compteur de séance de l'agent n'a jamais bougé.
    consommation = atelier.agent.consommation()
    assert consommation["generations"] == 0
    assert consommation["depense_usd"] == 0.0
    assert consommation["consomme"] == []
    assert all(g.provenance == AUTEUR for g in atelier.generations.recentes(500))


async def test_le_geste_manuel_ne_consomme_aucun_plafond_du_cadre(manuel, double):
    atelier, projet, godot, animateur = manuel
    atelier.livraison.associer(projet, str(godot))
    # Le cadre laisse juste de quoi faire **une** demande agent : deux appels et
    # le montant d'une référence plus son clip.
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 2, "plafond_usd": 0.3})
    personnage = atelier.production.creer_personnage(
        projet, "Le veilleur manuel", "Un veilleur en manteau gris", objectif=OBJECTIF).identifiant
    # Un second sujet, vide lui aussi : la demande de l'agent devra donc payer
    # sa propre référence, exactement les deux appels que le cadre lui laisse.
    delegue = atelier.production.creer_personnage(
        projet, "Le veilleur délégué", "Un veilleur en manteau bleu", objectif=OBJECTIF).identifiant

    application = creer_application(atelier)
    async with application.router.lifespan_context(application):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application),
                                     base_url="http://127.0.0.1:8420") as client:
            racine = f"/api/projects/{projet}/production-jobs"
            travail = (await client.post(racine + "/preview", json=_demande(personnage))).json()
            assert (await client.post(f"{racine}/{travail['identifiant']}/start")).status_code == 200
            fini = (await client.get(f"{racine}/{travail['identifiant']}?attente=10")).json()
            assert fini["etat"] == "termine", fini
            depense_manuelle = sum(c["cout_usd"] for c in fini["consommations"])
            assert depense_manuelle > 0
        assert not _sessions_mcp(application)

    # Ce qui a été dépensé est enregistré, mais au compte de l'auteur.
    assert atelier.agent.consommation()["generations"] == 0
    assert atelier.agent.consommation()["depense_usd"] == 0.0
    assert [t["acteur"] for t in atelier.travaux.lister(projet)] == [AUTEUR]

    # Le cadre est intact : la demande de l'agent passe encore entièrement,
    # alors que deux appels et la totalité du budget viennent d'être dépensés
    # par l'auteur. Un plafond qui aurait compté le geste manuel refuserait ici.
    agent = await atelier.travaux.preparer(projet, _demande(delegue, "marche-de-l-agent"), AGENT)
    assert agent["annonce"]["appels"] == 2
    await atelier.travaux.demarrer(projet, agent["identifiant"], AGENT)
    await atelier.travaux.attendre_tout()
    relu = atelier.travaux.lire(projet, agent["identifiant"])
    assert relu["etat"] == "termine", relu
    assert relu["acteur"] == AGENT
    assert double.appels == len(animateur.soumissions) == 2

    # Et cette fois-ci, c'est bien l'agent qui est débité : son plafond est plein.
    troisieme = await atelier.travaux.preparer(projet, _demande(delegue, "marche-de-trop"), AGENT)
    with pytest.raises(TravailRefuse, match="agent"):
        await atelier.travaux.demarrer(projet, troisieme["identifiant"], AGENT)
    assert double.appels == len(animateur.soumissions) == 2

    # L'auteur, lui, n'est pas bloqué par le plafond de l'agent, et son geste
    # n'ajoute rien au compteur de séance que les deux appels de l'agent ont rempli.
    compte_agent = atelier.agent.consommation()
    assert compte_agent["generations"] == 2 and compte_agent["depense_usd"] > 0
    sien = await atelier.travaux.preparer(projet, _demande(personnage, "encore-a-la-main"), AUTEUR)
    await atelier.travaux.demarrer(projet, sien["identifiant"], AUTEUR)
    await atelier.travaux.attendre_tout()
    assert atelier.travaux.lire(projet, sien["identifiant"])["etat"] == "termine"
    assert len(animateur.soumissions) == 3
    assert atelier.agent.consommation() == compte_agent
