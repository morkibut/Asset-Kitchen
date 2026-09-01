# -*- coding: utf-8 -*-
"""F1 — le pluriel, et le fournisseur qui ne demande rien.

Les onze critères de `docs/tranches/V2.2.md` § F1. **Aucun n'appelle un vrai
fournisseur** : les deux d'ici sont des doubles, et le seul essai qui parle
vraiment à Pollinations est `essais/essai_fournisseurs.py`, à la main.

**Deux fournisseurs, et c'est tout ce qui change du montage habituel.** Le
`double` de `conftest.py` reste le payant — celui qui demande une clé —, et un
second lui est ajouté ici : gratuit, sans clé, avec un modèle **du même nom**
chez les deux. Ce dernier point n'est pas un détail de mise en scène : c'est le
cas que le relevé du 31 août a trouvé chez Cloudflare, qui héberge les modèles
de Leonardo, et c'est celui qui casse tout si un nom n'est pas qualifié.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import ICI, JETON, Compte, Demande, Modele
from atelier.domaine.erreurs import (
    AppelRefuse,
    FournisseurIndisponible,
    ModeleInconnu,
)
from atelier.fournisseur.port import ImageProduite
from atelier.services import Atelier

from conftest import FournisseurDouble, image_sujet


# ── Le second fournisseur ────────────────────────────────────────────────────

GRATUIT = "gratuit"

# **Le même nom chez les deux**, et c'est le cœur de la tranche : `rend-du-png`
# existe chez `essai` comme chez `gratuit`, avec des capacités différentes.
CATALOGUE_GRATUIT = [
    Modele(
        identifiant=f"{GRATUIT}:rend-du-png",
        nom="Essai PNG",
        fournisseur=GRATUIT,
        chez_lui="rend-du-png",
        # Zéro référence : c'est la vraie limite d'un gratuit, et le produit la
        # grise sans qu'une ligne ait été ajoutée — règle de T1.
        references_max=0,
        proportions=("1:1",),
        variations_max=1,
    ),
]


class FournisseurGratuit(FournisseurDouble):
    """Un second double, qui ne demande ni compte ni clé.

    Il hérite de tous les leviers du premier — `catalogue_lisible`, `echec`,
    `manque` — et n'en change que deux : son nom, et ce qu'il déclare.

    **Et depuis F2, il compte en jetons**, comme le vrai gratuit du produit :
    un jeton par image, aucune réserve annoncée, une cadence. C'est le seul
    double du dépôt qui ne facture pas en argent, et c'est lui que les essais
    de F2 font travailler.
    """

    nom = GRATUIT

    def compte(self) -> Compte:
        return Compte(
            unite=JETON, plafond=None, source=ICI, renouvellement="minuit",
            cadence_s=15.0,
        )

    async def catalogue(self) -> list[Modele]:
        if not self.catalogue_lisible:
            raise FournisseurIndisponible("catalogue injoignable — réseau coupé")
        return list(CATALOGUE_GRATUIT)

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        self.appels += 1
        self.demandes.append(demande)
        self.references_recues.append(len(demande.references))
        if self.echec is not None:
            raise self.echec
        # **Zéro dollar, un jeton** (F2). Les deux à la fois, et c'est tout le
        # sujet de la tranche : ce qui ne coûte rien consomme quand même.
        return ImageProduite(
            image_sujet(), consomme=1.0, type_media="image/png", unite=JETON
        )


@pytest.fixture
def gratuit() -> FournisseurGratuit:
    return FournisseurGratuit()


@pytest.fixture
def deux(tmp_path, double, gratuit) -> Atelier:
    """Un atelier à deux fournisseurs — le montage de toute cette tranche."""
    return Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: gratuit],
    )


@pytest.fixture
def client_deux(deux) -> TestClient:
    with TestClient(creer_application(deux)) as client:
        yield client


def _modeles(client: TestClient) -> dict:
    return {m["identifiant"]: m for m in client.get("/api/models").json()["modeles"]}


# ── « Les modèles des deux paraissent dans la même liste, et chacun porte le
#     nom de celui qui le propose » ───────────────────────────────────────────


def test_une_seule_liste_et_chaque_modele_porte_son_fournisseur(client_deux):
    catalogue = client_deux.get("/api/models").json()
    modeles = catalogue["modeles"]

    # Trois modèles, deux fournisseurs, **une** liste.
    assert len(modeles) == 3
    assert {m["fournisseur"] for m in modeles} == {"essai", GRATUIT}
    # Aucun modèle sans fournisseur : « les deux ensemble, jamais l'un seul ».
    assert all(m["fournisseur"] for m in modeles)

    # Et l'écran reçoit un état par fournisseur, pour dire lequel est coupé.
    assert [f["nom"] for f in catalogue["fournisseurs"]] == ["essai", GRATUIT]
    assert [f["modeles"] for f in catalogue["fournisseurs"]] == [2, 1]


# ── « Deux modèles de même nom chez deux fournisseurs se distinguent partout —
#     dans la liste, dans le journal d'un appel, dans la recette d'une image » ─


def test_deux_modeles_de_meme_nom_ne_se_confondent_jamais(client_deux, double, gratuit):
    modeles = _modeles(client_deux)

    # 1 · Dans la liste. Même nom affiché, deux lignes distinctes.
    payant, libre = modeles["essai:rend-du-png"], modeles[f"{GRATUIT}:rend-du-png"]
    assert payant["nom"] == libre["nom"] == "Essai PNG"
    assert payant["identifiant"] != libre["identifiant"]
    # Et leurs capacités ne sont pas les mêmes : c'est ce qui rend la confusion
    # coûteuse, et donc la distinction nécessaire.
    assert payant["references_max"] == 2
    assert libre["references_max"] == 0

    # 2 · Dans le journal d'un appel. Chacun part chez le sien, et pas chez
    #     l'autre — le nom enregistré dit lequel.
    for identifiant in (payant["identifiant"], libre["identifiant"]):
        depot = client_deux.post(
            "/api/generations", json={"modele": identifiant, "prompt": "un tonneau"}
        )
        assert depot.status_code == 202

    journal = client_deux.get("/api/generations").json()["generations"]
    assert double.appels == 1
    assert gratuit.appels == 1
    assert {g["modele"] for g in journal} == {
        "essai:rend-du-png",
        f"{GRATUIT}:rend-du-png",
    }

    # 3 · Dans la recette d'une image. L'asset porte le nom complet, hérité de
    #     sa génération à la naissance.
    assets = client_deux.get("/api/assets").json()["assets"]
    assert {a["modele"] for a in assets} == {
        "essai:rend-du-png",
        f"{GRATUIT}:rend-du-png",
    }


# ── « Couper la liaison d'un seul fournisseur grise ses modèles avec sa raison
#     et n'en retire aucun autre de la liste » ────────────────────────────────
#
# **La moitié droite de ce critère est tenue, la gauche a été arbitrée** — voir
# `docs/tranches/V2.2.md` § F1. Couper une liaison ne grise pas : « l'échec
# survient au moment où on génère, jamais au démarrage » (US-95) est un
# invariant que la V2.2 hérite et ne rediscute pas. Ce qui est tenu, et qui est
# ce que la tranche ajoute : ses modèles restent, servis depuis sa photo datée,
# **avec sa raison**, et ceux de l'autre ne bougent pas d'une ligne.


def test_couper_un_seul_fournisseur_ne_touche_pas_a_l_autre(tmp_path, double, gratuit):
    premier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    asyncio.run(premier.ouvrir())  # les deux photos sont écrites sur le disque

    double.catalogue_lisible = False  # un seul est coupé
    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(suivant)) as client:
        catalogue = client.get("/api/models").json()

    par_nom = {f["nom"]: f for f in catalogue["fournisseurs"]}
    assert par_nom["essai"]["repli"] is True
    assert par_nom["essai"]["raison"] == "catalogue injoignable — réseau coupé"
    # **Celui qui répond n'est pas en repli**, et c'est très exactement ce que
    # la V2.1 ne savait pas faire : un seul état pour tout le catalogue.
    assert par_nom[GRATUIT]["repli"] is False
    assert par_nom[GRATUIT]["raison"] is None

    # Aucun modèle n'a disparu — ni ceux du coupé, ni ceux de l'autre.
    modeles = {m["identifiant"]: m for m in catalogue["modeles"]}
    assert len(modeles) == 3
    assert modeles["essai:rend-du-png"]["repli"] is True
    assert modeles[f"{GRATUIT}:rend-du-png"]["repli"] is False

    # Et la raison est lisible fournisseur par fournisseur, nommée.
    assert catalogue["raison"] == "essai : catalogue injoignable — réseau coupé"


def test_ce_qui_manque_a_un_fournisseur_grise_ses_modeles_et_eux_seuls(client_deux, double):
    double.manque = "aucune clé OpenRouter"
    modeles = _modeles(client_deux)

    assert modeles["essai:rend-du-png"]["refus"] == "aucune clé OpenRouter"
    assert modeles["essai:rend-du-jpeg"]["refus"] == "aucune clé OpenRouter"
    # Le gratuit ne demande rien : sa ligne ne bouge pas.
    assert modeles[f"{GRATUIT}:rend-du-png"]["refus"] is None


# ── « Chaque fournisseur garde sur le disque sa propre photo de catalogue,
#     datée, et la sert quand il n'est pas joignable » ─────────────────────────


def test_chaque_fournisseur_a_sa_photo_datee_sur_le_disque(tmp_path, double, gratuit):
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    asyncio.run(atelier.ouvrir())

    photo = json.loads(atelier.fichiers.catalogue.read_text(encoding="utf-8"))
    assert set(photo["fournisseurs"]) == {"essai", GRATUIT}
    for nom in ("essai", GRATUIT):
        assert photo["fournisseurs"][nom]["recu_le"] > 0
        assert photo["fournisseurs"][nom]["modeles"]

    # **Une photo ne s'écrase jamais par du vide.** Le coupé garde la sienne,
    # datée, pendant que l'autre écrit la sienne par-dessus.
    double.catalogue_lisible = False
    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    asyncio.run(suivant.ouvrir())

    relue = json.loads(suivant.fichiers.catalogue.read_text(encoding="utf-8"))
    assert len(relue["fournisseurs"]["essai"]["modeles"]) == 2
    assert suivant.catalogue.etat.fournisseur("essai").recu_le > 0


# ── « La fiche d'un modèle dit d'où elle vient : relue chez le fournisseur, ou
#     relevée ici à telle date » ──────────────────────────────────────────────


def test_la_fiche_dit_si_elle_est_relue_ou_relevee(tmp_path, double, gratuit):
    premier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    asyncio.run(premier.ouvrir())

    with TestClient(creer_application(premier)) as client:
        fraiche = _modeles(client)["essai:rend-du-png"]
    assert fraiche["repli"] is False
    assert fraiche["recu_le"] > 0

    double.catalogue_lisible = False
    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(suivant)) as client:
        relevee = _modeles(client)["essai:rend-du-png"]
    assert relevee["repli"] is True
    # La date est celle de la photo, pas celle d'aujourd'hui : c'est ce qui
    # permet de lire « relevé le 31 août » et de savoir que c'est vieux.
    assert relevee["recu_le"] == pytest.approx(fraiche["recu_le"], abs=1.0)


# ── « Une image faite chez le nouveau fournisseur passe le post-traitement du
#     projet et entre en bibliothèque exactement comme les autres » ────────────


def test_une_image_du_gratuit_passe_le_traitement_et_entre_en_bibliotheque(
    client_deux, gratuit
):
    depot = client_deux.post(
        "/api/generations",
        json={"modele": f"{GRATUIT}:rend-du-png", "prompt": "un tonneau"},
    )
    assert depot.status_code == 202

    assets = client_deux.get("/api/assets").json()["assets"]
    assert gratuit.appels == 1
    assert len(assets) == 1
    asset = assets[0]

    # Elle est entrée d'elle-même, avec sa recette, exactement comme les autres.
    assert asset["modele"] == f"{GRATUIT}:rend-du-png"
    assert asset["largeur"] > 0 and asset["hauteur"] > 0
    # Et le rendu se calcule : le post-traitement ne demande aucun fournisseur.
    rendu = client_deux.get(f"/api/assets/{asset['identifiant']}/image")
    assert rendu.status_code == 200
    assert rendu.content[:8] == bytes.fromhex("89504e470d0a1a0a")


# ── « La génération et l'asset gardent le nom du fournisseur, et il se lit sans
#     ouvrir un fichier » ────────────────────────────────────────────────────


def test_le_nom_du_fournisseur_se_lit_sur_la_generation_et_sur_l_asset(
    client_deux, deux
):
    client_deux.post(
        "/api/generations",
        json={"modele": f"{GRATUIT}:rend-du-png", "prompt": "un tonneau"},
    )

    # Sur la génération, par l'API — sans ouvrir `generation.json`.
    generation = client_deux.get("/api/generations").json()["generations"][0]
    assert generation["modele"].startswith(f"{GRATUIT}:")

    # Sur l'asset, par la même API.
    asset = client_deux.get("/api/assets").json()["assets"][0]
    assert asset["modele"].startswith(f"{GRATUIT}:")

    # Et sur le disque, le fichier dit la même chose — les fichiers font foi.
    ecrit = deux.generations.lire(generation["identifiant"])
    assert ecrit.modele == f"{GRATUIT}:rend-du-png"


# ── « Sur une installation neuve, sans aucune clé, on écrit un nom puis un
#     prompt et une image arrive » ───────────────────────────────────────────


def test_sans_aucune_cle_le_defaut_glisse_vers_le_gratuit_et_l_image_arrive(
    tmp_path, double, gratuit
):
    # Le payant n'a pas sa clé ; le gratuit n'en demande pas. C'est
    # l'installation neuve du critère.
    double.manque = "aucune clé OpenRouter"
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )

    with TestClient(creer_application(atelier)) as client:
        catalogue = client.get("/api/models").json()
        # **Le défaut n'est pas le modèle du banc** : celui-là est grisé, donc
        # ce n'en est pas un. On descend la liste jusqu'au premier utilisable.
        assert catalogue["defaut"]["modele"] == f"{GRATUIT}:rend-du-png"

        depot = client.post(
            "/api/generations",
            json={
                "modele": catalogue["defaut"]["modele"],
                "prompt": "un tonneau rouge",
            },
        )
        assert depot.status_code == 202

        assets = client.get("/api/assets").json()["assets"]

    assert len(assets) == 1  # une image est arrivée, sans clé, sans compte
    assert double.appels == 0  # et rien n'est parti chez le payant


# ── « Un modèle qui n'accepte aucune image de référence est grisé avec sa
#     raison dès qu'une référence est demandée » ──────────────────────────────
#
# **La règle de T1 n'a pas eu à être touchée pour ça**, et c'est le seul point
# de la tranche où la meilleure preuve est qu'aucune ligne n'a été écrite.


def test_le_gratuit_se_grise_seul_des_qu_une_reference_est_demandee(client_deux):
    sans = _modeles(client_deux)[f"{GRATUIT}:rend-du-png"]
    assert sans["refus"] is None

    avec = {
        m["identifiant"]: m
        for m in client_deux.get("/api/models?references=1").json()["modeles"]
    }
    assert avec[f"{GRATUIT}:rend-du-png"]["refus"] == "n'accepte aucune image de référence"
    # Et celui qui en accepte deux ne bouge pas.
    assert avec["essai:rend-du-png"]["refus"] is None


# ── « Aucun repli automatique : un fournisseur qui échoue ne fait jamais partir
#     l'appel chez un autre, et l'échec s'enregistre avec sa phrase française » ─


def test_un_fournisseur_qui_echoue_n_envoie_jamais_l_appel_chez_l_autre(
    client_deux, double, gratuit
):
    gratuit.echec = AppelRefuse("le fournisseur n'a rendu aucune image")

    depot = client_deux.post(
        "/api/generations",
        json={"modele": f"{GRATUIT}:rend-du-png", "prompt": "un tonneau"},
    )
    assert depot.status_code == 202

    generation = client_deux.get("/api/generations").json()["generations"][0]
    assert generation["statut"] == "echouee"
    assert (
        generation["emplacements"][0]["raison"]
        == "le fournisseur n'a rendu aucune image"
    )

    # **Rien n'est parti ailleurs.** Le repli d'un fournisseur sur un autre est
    # une relance, et une relance appartient à l'auteur (F1, invariant).
    assert double.appels == 0
    assert gratuit.appels == 1
    assert client_deux.get("/api/assets").json()["assets"] == []


# ── « Tout ce qui ne demande pas un fournisseur fonctionne toujours réseau
#     coupé » ─────────────────────────────────────────────────────────────────


def test_les_deux_coupes_l_atelier_s_ouvre_et_la_bibliotheque_repond(
    tmp_path, double, gratuit
):
    premier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    asyncio.run(premier.ouvrir())
    with TestClient(creer_application(premier)) as client:
        client.post(
            "/api/generations",
            json={"modele": f"{GRATUIT}:rend-du-png", "prompt": "un tonneau"},
        )

    double.catalogue_lisible = False
    gratuit.catalogue_lisible = False
    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )

    with TestClient(creer_application(suivant)) as client:  # l'ouverture ne lève pas
        assert client.get("/api/status").status_code == 200
        # La bibliothèque répond, l'image est là, et son rendu se recalcule.
        assets = client.get("/api/assets").json()["assets"]
        assert len(assets) == 1
        assert (
            client.get(f"/api/assets/{assets[0]['identifiant']}/image").status_code
            == 200
        )
        # Et les deux catalogues sont servis depuis leur photo, datés.
        catalogue = client.get("/api/models").json()
        assert len(catalogue["modeles"]) == 3
        assert all(f["repli"] for f in catalogue["fournisseurs"])


# ── Le nom d'avant la V2.2 se relit sans rien perdre ─────────────────────────
#
# Ce n'est pas un critère écrit de F1, et c'est la première chose qui casserait
# sans lui : toutes les générations déjà sur ce disque portent un nom de modèle
# **sans fournisseur**, parce qu'il n'y en avait qu'un.


def test_un_nom_de_modele_d_avant_la_v2_2_se_relit_et_se_relance(deux, double):
    asyncio.run(deux.ouvrir())

    # `rend-du-jpeg` n'existe que chez un seul des deux : il se rattrape.
    assert deux.catalogue.modele("rend-du-jpeg").identifiant == "essai:rend-du-jpeg"

    # Et le chemin complet tient : préparer avec l'ancien nom rend une
    # génération qui porte, elle, le nom complet.
    generation, _, deja = deux.generations.preparer("rend-du-jpeg", Demande("un rat"))
    assert deja is False
    assert generation.modele == "essai:rend-du-jpeg"

    # **`rend-du-png`, lui, est chez les deux : il ne se rattrape pas.** Choisir
    # pour l'auteur entre un payant et un gratuit du même nom serait le seul
    # tirage au sort du produit. Le catalogue dit qu'il ne sait pas.
    with pytest.raises(ModeleInconnu):
        deux.catalogue.modele("rend-du-png")
