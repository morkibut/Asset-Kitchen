# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T1 que le jalon 1 doit déjà tenir.

Un test par critère de `docs/PLAN.md` § Phase T1, nommé d'après lui. Ce qui
relève des variations concurrentes, de la survie à l'écran et du repli hors
ligne complet arrive aux jalons suivants ; ce qui est ici est acquis.

Aucun test n'appelle le fournisseur : le port est remplacé par un double. Le
seul appel payant du jalon est l'essai `essais/essai_premiere_image.py`, et il
se lance à la main.
"""

from __future__ import annotations

import asyncio
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine import Demande, Modele, Option, Statut
from atelier.domaine.erreurs import (
    AppelRefuse,
    ErreurAtelier,
    FournisseurIndisponible,
)
from atelier.fournisseur.port import ImageProduite
from atelier.services import Atelier

# ── Le double de fournisseur ─────────────────────────────────────────────────

CATALOGUE = [
    Modele(
        identifiant="essai/rend-du-png",
        nom="Essai PNG",
        references_max=2,
        proportions=("1:1", "16:9"),
        resolutions=(),
        variations_max=4,
        options={"quality": Option("quality", "choix", ("low", "high"))},
    ),
    Modele(
        identifiant="essai/rend-du-jpeg",
        nom="Essai JPEG",
        references_max=0,
        proportions=("1:1",),
        variations_max=1,
    ),
]


def _image(format_: str, taille: tuple[int, int] = (48, 32)) -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", taille, (32, 64, 96)).save(tampon, format=format_)
    return tampon.getvalue()


class FournisseurDouble:
    nom = "Double"

    def __init__(self) -> None:
        self.appels = 0
        self.catalogue_lisible = True
        self.echec: Exception | None = None

    async def catalogue(self) -> list[Modele]:
        if not self.catalogue_lisible:
            raise FournisseurIndisponible("catalogue injoignable — réseau coupé")
        return list(CATALOGUE)

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        self.appels += 1
        if self.echec is not None:
            raise self.echec
        if modele.identifiant.endswith("jpeg"):
            return ImageProduite(_image("JPEG"), cout_usd=0.035, type_media="image/jpeg")
        return ImageProduite(_image("PNG"), cout_usd=0.0245, type_media="image/png")


@pytest.fixture
def double() -> FournisseurDouble:
    return FournisseurDouble()


@pytest.fixture
def atelier(tmp_path, double, monkeypatch) -> Atelier:
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    return Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)


@pytest.fixture
def client(atelier) -> TestClient:
    with TestClient(creer_application(atelier)) as client:
        yield client


# ── « La liste des modèles vient du catalogue du fournisseur » ───────────────


def test_le_catalogue_vient_du_fournisseur(client):
    reponse = client.get("/api/models").json()
    identifiants = [m["identifiant"] for m in reponse["modeles"]]
    assert identifiants == ["essai/rend-du-png", "essai/rend-du-jpeg"]
    assert reponse["modeles"][0]["references_max"] == 2  # déclaré, pas écrit en dur
    assert reponse["repli"] is False


# ── « Un modèle qui ne peut pas honorer la demande est grisé avec sa raison » ─


def test_un_modele_qui_ne_peut_pas_est_grise_avec_sa_raison(client):
    modeles = client.get("/api/models", params={"references": 1}).json()["modeles"]
    par_identifiant = {m["identifiant"]: m for m in modeles}
    assert par_identifiant["essai/rend-du-png"]["refus"] is None
    assert (
        par_identifiant["essai/rend-du-jpeg"]["refus"]
        == "n'accepte aucune image de référence"
    )


def test_la_raison_du_grise_dit_la_proportion_manquante(client):
    modeles = client.get("/api/models", params={"proportions": "21:9"}).json()["modeles"]
    assert all(m["refus"] == "ne rend pas la proportion 21:9" for m in modeles)


# ── « Sans clé : générer est inactif, dit pourquoi, et mène au réglage » ──────


def test_sans_cle_generer_refuse_en_disant_ou_aller(tmp_path, double, monkeypatch):
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "")
    atelier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(
            "/api/generations", json={"modele": "essai/rend-du-png", "prompt": "un rat"}
        )
        assert reponse.status_code == 409
        assert reponse.json() == {
            "code": "sans_cle",
            "raison": "aucune clé OpenRouter",
            "ou_aller": "reglages",
        }
        assert double.appels == 0  # rien n'est parti, donc rien n'est facturé


def test_l_etat_de_la_cle_ne_montre_jamais_la_cle(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-secrete-0123456789")
    etat = client.get("/api/settings/key").json()
    assert etat["presente"] is True
    assert etat["apercu"] == "456789"
    assert "sk-or-v1-secrete" not in str(etat)


# ── « Deux soumissions de la même génération ne facturent qu'une fois » ───────


def test_deux_soumissions_du_meme_identifiant_ne_facturent_qu_une_fois(client, double):
    corps = {
        "modele": "essai/rend-du-png",
        "prompt": "un tonneau",
        "identifiant": "toujours-le-meme",
    }
    premiere = client.post("/api/generations", json=corps).json()
    seconde = client.post("/api/generations", json=corps).json()

    assert premiere["identifiant"] == seconde["identifiant"]
    assert double.appels == 1
    assert client.get("/api/generations/toujours-le-meme").json()["cout_usd"] == 0.0245


# ── « Le coût enregistré est celui que l'appel a facturé » ────────────────────


def test_le_cout_enregistre_est_celui_de_l_appel(client):
    generation = client.post(
        "/api/generations", json={"modele": "essai/rend-du-png", "prompt": "une épée"}
    ).json()
    relue = client.get(f"/api/generations/{generation['identifiant']}").json()
    assert relue["statut"] == "reussie"
    assert relue["cout_usd"] == 0.0245  # `usage.cost`, pas le tarif du catalogue
    assert relue["emplacements"][0]["cout_usd"] == 0.0245


# ── « Les dimensions enregistrées sont mesurées sur l'image reçue » ───────────


def test_les_dimensions_sont_mesurees_sur_l_image_recue(client):
    generation = client.post(
        "/api/generations",
        json={"modele": "essai/rend-du-png", "prompt": "un coffre", "proportions": "1:1"},
    ).json()
    resultat = client.get(f"/api/generations/{generation['identifiant']}").json()[
        "emplacements"
    ][0]["resultat"]
    # On a demandé du carré, le double rend du 48×32 : c'est le fait qui est gardé.
    assert (resultat["largeur"], resultat["hauteur"]) == (48, 32)
    assert resultat["type_media"] == "image/png"


# ── « Une image se télécharge seule, en PNG » ─────────────────────────────────


def test_l_image_se_telecharge_en_png_meme_quand_le_modele_rend_du_jpeg(client):
    generation = client.post(
        "/api/generations", json={"modele": "essai/rend-du-jpeg", "prompt": "une potion"}
    ).json()
    identifiant = generation["identifiant"]

    brute = client.get(f"/api/generations/{identifiant}/slots/0/image")
    assert brute.headers["content-type"] == "image/jpeg"  # le brut reste du brut

    telechargee = client.get(f"/api/generations/{identifiant}/slots/0/download")
    assert telechargee.headers["content-type"] == "image/png"
    assert telechargee.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert "attachment" in telechargee.headers["content-disposition"]


# ── « Un raté affiche sa raison en clair à la place de l'image » ──────────────


def test_un_appel_rate_porte_sa_raison_en_clair(client, double):
    double.echec = AppelRefuse("crédit OpenRouter épuisé", statut=402)
    generation = client.post(
        "/api/generations", json={"modele": "essai/rend-du-png", "prompt": "un rat"}
    ).json()
    relue = client.get(f"/api/generations/{generation['identifiant']}").json()
    assert relue["statut"] == "echouee"
    assert relue["emplacements"][0]["raison"] == "crédit OpenRouter épuisé"
    assert relue["emplacements"][0]["resultat"] is None


# ── « Les réussites arrivent même quand les voisines échouent » ───────────────


def test_les_emplacements_sont_independants(atelier, double):
    """Quatre variations, une seule qui échoue : trois images arrivent quand même."""

    reels = double.generer
    etat = {"appel": 0}

    async def capricieux(modele, demande):
        etat["appel"] += 1
        if etat["appel"] == 2:
            raise AppelRefuse("trop d'appels d'affilée — réessayer dans un instant")
        return await reels(modele, demande)

    double.generer = capricieux

    async def scenario():
        await atelier.ouvrir()
        generation = await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("quatre variations", variations=4)
        )
        return await atelier.generations.attendre(generation.identifiant, 5.0)

    generation = asyncio.run(scenario())
    statuts = [e.statut for e in generation.emplacements]
    assert statuts.count(Statut.REUSSIE) == 3
    assert statuts.count(Statut.ECHOUEE) == 1
    assert generation.cout_usd == pytest.approx(0.0245 * 3)


# ── « Au redémarrage, marquée interrompue, coût lisible, aucune relance » ─────


def test_une_generation_coupee_par_un_redemarrage_est_marquee_pas_relancee(
    tmp_path, double, monkeypatch
):
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    atelier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)

    async def coupee():
        await atelier.ouvrir()
        generation, modele, _ = atelier.generations.preparer(
            "essai/rend-du-png", Demande("interrompue")
        )
        return generation.identifiant

    identifiant = asyncio.run(coupee())  # préparée, jamais exécutée : le serveur meurt

    suivant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(suivant.ouvrir())

    relue = suivant.generations.lire(identifiant)
    assert relue.statut == Statut.INTERROMPUE
    assert relue.emplacements[0].raison == "le serveur a redémarré pendant la génération"
    assert double.appels == 0  # rien n'a été relancé tout seul


# ── « Réseau coupé : le démarrage n'affiche aucune erreur, catalogue daté » ───


def test_reseau_coupe_le_demarrage_sert_le_dernier_catalogue_date(
    tmp_path, double, monkeypatch
):
    monkeypatch.setattr("atelier.services.generation.lire_cle", lambda: "sk-or-essai")
    premier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(premier.ouvrir())  # une photo du catalogue est écrite sur le disque

    double.catalogue_lisible = False
    suivant = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    with TestClient(creer_application(suivant)) as client:  # le démarrage ne lève pas
        catalogue = client.get("/api/models").json()

    assert catalogue["repli"] is True
    assert catalogue["recu_le"] > 0  # daté en clair
    assert catalogue["raison"] == "catalogue injoignable — réseau coupé"
    assert len(catalogue["modeles"]) == 2  # on peut préparer un prompt


def test_sans_reseau_ni_photo_l_atelier_s_ouvre_quand_meme(tmp_path, double):
    double.catalogue_lisible = False
    atelier = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    with TestClient(creer_application(atelier)) as client:
        statut = client.get("/api/status").json()
    assert statut["catalogue"]["modeles"] == 0
    assert statut["catalogue"]["raison"] == "catalogue injoignable — réseau coupé"


# ── « Relancer l'un ne rejoue pas les autres » ────────────────────────────────


def test_relancer_un_rate_ne_rejoue_que_lui(atelier, double):
    reels = double.generer
    etat = {"appel": 0}

    async def capricieux(modele, demande):
        etat["appel"] += 1
        if etat["appel"] == 1:
            raise AppelRefuse("trop d'appels d'affilée — réessayer dans un instant")
        return await reels(modele, demande)

    double.generer = capricieux

    async def scenario():
        await atelier.ouvrir()
        generation = await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("deux variations", variations=2)
        )
        avant = await atelier.generations.attendre(generation.identifiant, 5.0)
        rate = next(e for e in avant.emplacements if e.statut == Statut.ECHOUEE)
        await atelier.generations.relancer(avant.identifiant, rate.rang)
        return avant, await atelier.generations.attendre(avant.identifiant, 5.0)

    avant, apres = asyncio.run(scenario())

    assert [e.statut for e in avant.emplacements].count(Statut.ECHOUEE) == 1
    assert all(e.statut == Statut.REUSSIE for e in apres.emplacements)
    # trois appels en tout : le raté, sa voisine, et la relance — pas quatre
    assert etat["appel"] == 3
    assert apres.cout_usd == pytest.approx(0.0245 * 2)


def test_un_emplacement_reussi_ne_se_relance_pas(atelier):
    async def scenario():
        await atelier.ouvrir()
        generation = await atelier.generations.soumettre(
            "essai/rend-du-png", Demande("une seule")
        )
        await atelier.generations.attendre(generation.identifiant, 5.0)
        return await atelier.generations.relancer(generation.identifiant, 0)

    with pytest.raises(ErreurAtelier, match="a déjà son image"):
        asyncio.run(scenario())
