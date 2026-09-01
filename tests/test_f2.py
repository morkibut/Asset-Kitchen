# -*- coding: utf-8 -*-
"""F2 — ce qu'un appel consomme.

Les dix critères de `docs/tranches/V2.2.md` § F2. **Aucun n'appelle un vrai
fournisseur** : le gratuit d'ici est le double de F1, qui compte en jetons comme
le vrai — un jeton par image, aucune réserve annoncée, une cadence.

**La tranche tient en une phrase, et deux essais suffiraient à la juger** :
*un appel sans prix consomme quand même*, et *un total en argent ne compte que
de l'argent*. Tout le reste en découle — les écrans, la réserve, le compteur de
l'agent, et la relecture de ce qui a été écrit avant la V2.2.

**Un fournisseur avec plafond est monté ici, et nulle part ailleurs.** Aucun des
deux fournisseurs du produit n'en annonce un : Pollinations limite une cadence,
Cloudflare n'expose pas la sienne (`docs/releve-fournisseurs.md`). Les trois
critères qui parlent de *ce qui reste* se vérifient donc sur un double — et
c'est écrit dans l'arbitrage de la tranche, plutôt que d'être découvert en
ouvrant F4.
"""

from __future__ import annotations

import asyncio
import json
import time

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import ICI, JETON, LU, USD, Compte, Demande, Modele
from atelier.domaine.consommation import Reserve, accorde, argent
from atelier.domaine.erreurs import AppelRefuse
from atelier.fournisseur.port import ImageProduite
from atelier.mcp.serveur import creer_serveur
from atelier.services import Atelier

from conftest import FournisseurDouble, image_sujet
from test_f1 import CATALOGUE_GRATUIT, GRATUIT, FournisseurGratuit


# ── Le montage ───────────────────────────────────────────────────────────────


class FournisseurAvecPlafond(FournisseurGratuit):
    """Un gratuit **qui annonce sa réserve**. Le seul du dépôt, et pour cause.

    Aucun fournisseur réel du produit n'en annonce une aujourd'hui. Celui-ci
    existe pour que la machinerie de *ce qui reste* soit vérifiée avant que F4
    ne l'utilise pour de bon — et pour que le jour où un fournisseur en
    déclarera une, rien n'ait à être inventé dans l'urgence.
    """

    plafond = 4.0
    source = ICI

    def compte(self) -> Compte:
        return Compte(
            unite=JETON,
            plafond=self.plafond,
            source=self.source,
            renouvellement="minuit",
            cadence_s=15.0,
        )


@pytest.fixture
def gratuit() -> FournisseurGratuit:
    return FournisseurGratuit()


@pytest.fixture
def plafonne() -> FournisseurAvecPlafond:
    return FournisseurAvecPlafond()


@pytest.fixture
def deux(tmp_path, double, gratuit) -> Atelier:
    """Le montage de la tranche : un payant, un gratuit qui compte en jetons."""
    return Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: gratuit],
    )


@pytest.fixture
def client_deux(deux) -> TestClient:
    with TestClient(creer_application(deux)) as client:
        yield client


@pytest.fixture
def client_plafonne(tmp_path, double, plafonne) -> TestClient:
    atelier = Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: plafonne],
    )
    with TestClient(creer_application(atelier)) as client:
        yield client


def _generer(client: TestClient, modele: str, prompt: str = "un tonneau") -> dict:
    reponse = client.post("/api/generations", json={"modele": modele, "prompt": prompt})
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    # Un second aller-retour laisse la tâche de fond finir, comme partout
    # ailleurs dans ce dépôt.
    return client.get(f"/api/generations/{identifiant}").json()


# ── 1 · Un appel sans prix consomme quand même ───────────────────────────────


def test_un_appel_sans_prix_enregistre_ce_qu_il_a_consomme_et_pas_zero_dollar(
    client_deux,
):
    """*Un appel sans prix affiche « gratuit » ; « 0,00 $ » n'apparaît nulle part.*

    **Le serveur ne connaît pas le mot « gratuit »**, et c'est voulu : il donne
    l'unité, l'écran écrit la phrase. Ce qui se vérifie ici est la seule chose
    dont l'écran ait besoin pour ne pas mentir — la quantité **et** son unité,
    et un coût en argent qui vaut zéro parce qu'aucun dollar n'est parti.
    """
    generation = _generer(client_deux, f"{GRATUIT}:rend-du-png")

    assert generation["unite"] == JETON
    assert generation["consomme"] == 1.0
    assert generation["cout_usd"] == 0.0

    # Et l'image qui en sort le porte aussi : la tuile et la fiche sont faites
    # d'assets, pas de générations.
    asset = client_deux.get("/api/assets").json()["assets"][0]
    assert asset["unite"] == JETON
    assert asset["consomme"] == 1.0
    assert asset["cout_usd"] == 0.0


def test_un_zero_en_argent_reste_un_zero_en_argent(client_deux):
    """**Le contraire du précédent, et il compte autant.**

    Une image payée zéro dollar chez un fournisseur qui facture — une découpe,
    un calque — doit continuer de se lire `$0,0000`. Confondre les deux ferait
    dire « gratuit » à ce qui a été payé une fois pour toutes en amont.
    """
    generation = _generer(client_deux, "essai:rend-du-png")
    assert generation["unite"] == USD
    assert generation["cout_usd"] == generation["consomme"] == 0.0245


# ── 2 et 3 · Ce qui reste, et d'où le chiffre vient ──────────────────────────


def test_ce_qui_reste_parait_sur_l_ecran_ou_l_on_choisit(client_plafonne):
    """*Un fournisseur qui compte en jetons affiche ce qui reste et le renouvellement.*

    Vérifié sur le fournisseur à plafond : **aucun fournisseur réel n'en annonce
    un**, et c'est l'arbitrage de la tranche. Ce que le produit sait faire est
    ici ; ce que les fournisseurs du jour permettent d'en montrer est plus bas.
    """
    lu = client_plafonne.get("/api/models").json()
    reserve = next(f["reserve"] for f in lu["fournisseurs"] if f["nom"] == GRATUIT)

    assert reserve["unite"] == JETON
    assert reserve["plafond"] == 4.0
    assert reserve["reste"] == 4.0
    assert reserve["renouvellement"] == "minuit"
    # Et le payant, lui, n'a pas de réserve : ce qu'il coûte est de l'argent, et
    # l'argent a la barre de tête.
    assert next(f["reserve"] for f in lu["fournisseurs"] if f["nom"] == "essai") is None


def test_ce_qui_reste_parait_aussi_sur_l_ecran_qui_confirme(client_plafonne):
    """*… sur l'écran où l'on choisit **comme sur celui qui confirme**.*

    Les deux lisent le **même objet**, et c'est la règle payée en écrivant E13 :
    deux calculs à deux endroits ont annoncé $0,0128 et $0,0160 pour le même
    appel, à trois centimètres l'un de l'autre.
    """
    envoi = client_plafonne.post(
        "/api/outgoing",
        json={"prompt": "un tonneau", "modele": f"{GRATUIT}:rend-du-png"},
    ).json()

    assert envoi["reserve"]["unite"] == JETON
    assert envoi["reserve"]["reste"] == 4.0

    liste = next(
        f["reserve"]
        for f in client_plafonne.get("/api/models").json()["fournisseurs"]
        if f["nom"] == GRATUIT
    )
    # Les mêmes chiffres, aux clés que l'écran qui confirme ajoute près.
    for clef in ("unite", "consomme", "plafond", "reste", "source"):
        assert envoi["reserve"][clef] == liste[clef]


def test_le_chiffre_d_une_reserve_dit_toujours_d_ou_il_vient(
    tmp_path, double, plafonne
):
    """*Le chiffre d'une réserve dit s'il est lu chez le fournisseur ou compté ici.*

    Un invariant de la V2.2, et le relevé F0 a montré que **« compté ici » est
    le cas normal** : aucun des deux fournisseurs retenus ne dit ce qu'il reste.
    Les deux valeurs se jouent ici, parce qu'elles ne valent pas la même chose —
    ce qui est compté ici ne connaît que les appels partis d'ici.
    """
    for source in (ICI, LU):
        plafonne.source = source
        atelier = Atelier(
            racine=tmp_path / source,
            fabriques_fournisseurs=[lambda: double, lambda: plafonne],
        )
        with TestClient(creer_application(atelier)) as client:
            lu = client.get("/api/models").json()
            reserve = next(
                f["reserve"] for f in lu["fournisseurs"] if f["nom"] == GRATUIT
            )
            assert reserve["source"] == source


def test_ce_qui_est_parti_se_compte_et_entame_ce_qui_reste(client_plafonne):
    """Le compte tenu ici est **compté**, pas déclaré : deux images, deux jetons."""
    _generer(client_plafonne, f"{GRATUIT}:rend-du-png", "un tonneau")
    _generer(client_plafonne, f"{GRATUIT}:rend-du-png", "une lanterne")

    reserve = next(
        f["reserve"]
        for f in client_plafonne.get("/api/models").json()["fournisseurs"]
        if f["nom"] == GRATUIT
    )
    assert reserve["consomme"] == 2.0
    assert reserve["reste"] == 2.0


# ── 4 · Les appels gratuits dans la liste des dépenses ───────────────────────


def test_les_appels_gratuits_figurent_aux_depenses_avec_ce_qu_ils_ont_consomme(
    client_deux,
):
    """*La liste des dépenses montre les appels gratuits parmi les autres.*

    Et **les trois issues restent lisibles pour eux** : gardé, payé pour rien,
    refusé. Le troisième critère de cette ligne-là est celui qui a demandé une
    correction — l'issue se décide sur ce qui a été *consommé*, pas sur ce qui a
    été *payé*, sans quoi un refus qui a brûlé un jeton se rangerait avec ceux
    qui n'ont rien pris.
    """
    _generer(client_deux, f"{GRATUIT}:rend-du-png")
    _generer(client_deux, "essai:rend-du-png")

    depenses = client_deux.get("/api/spending").json()
    par_modele = {a["modele"]: a for a in depenses["appels"]}

    assert par_modele[f"{GRATUIT}:rend-du-png"]["unite"] == JETON
    assert par_modele[f"{GRATUIT}:rend-du-png"]["consomme"] == 1.0
    assert par_modele[f"{GRATUIT}:rend-du-png"]["cout_usd"] == 0.0
    assert par_modele[f"{GRATUIT}:rend-du-png"]["garde"] == 1

    # Le total par unité, à côté du total en argent et jamais dedans.
    assert depenses["par_unite"] == [{"unite": JETON, "quantite": 1.0, "appels": 1}]


def test_un_refus_gratuit_est_consomme_pour_rien_et_non_refuse_sans_rien_prendre(
    tmp_path, double, gratuit
):
    """Les trois issues, jugées sur ce qui a été **consommé**.

    Un refus qui a brûlé un jeton est un *consommé pour rien*, pas un *refusé* :
    c'est la distinction que ces trois issues existent pour montrer, et elle
    était jusqu'ici jugée sur des dollars.
    """
    gratuit.echec = AppelRefuse("le modèle a dit non", consomme=1.0, unite=JETON)
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(atelier)) as client:
        _generer(client, f"{GRATUIT}:rend-du-png")
        appel = client.get("/api/spending").json()["appels"][0]

    assert appel["perdu"] == 1
    assert appel["refuse"] == 0
    assert appel["consomme"] == 1.0
    assert appel["cout_usd"] == 0.0


# ── 5 · Un total en argent ne compte que de l'argent ─────────────────────────


def test_le_total_en_argent_ne_compte_que_de_l_argent(client_deux):
    """*Le total de la barre de tête ne compte que ce qui se paie en argent.*

    Vérifié **là où le total se calcule**, pas là où il s'écrit : c'est une
    propriété de la donnée, tenue par construction — un jeton vaut zéro dollar
    partout où une somme de dollars se fait. L'étiquette, elle, est à l'écran.
    """
    _generer(client_deux, f"{GRATUIT}:rend-du-png")
    _generer(client_deux, "essai:rend-du-png")

    etat = client_deux.get("/api/status").json()
    assert etat["couts"]["total_usd"] == 0.0245
    # Et ce qui s'est consommé sans argent est servi à côté, pas dedans.
    reserves = {r["fournisseur"]: r for r in etat["couts"]["reserves"]}
    assert reserves[GRATUIT]["consomme"] == 1.0
    assert reserves[GRATUIT]["unite"] == JETON

    depenses = client_deux.get("/api/spending").json()
    assert depenses["total_usd"] == 0.0245


# ── 6 · Ce qui manquerait pour finir un lot ──────────────────────────────────


def test_un_lot_que_la_reserve_ne_peut_pas_finir_est_annonce_avant_de_partir(
    client_plafonne,
):
    """*… avec ce qui manquerait.*

    **Annoncé, jamais refusé** : le compte d'images reste le seul refus
    automatique du produit. Ce qu'on ajoute est un fait avant le geste, pas un
    garde-fou de plus — l'auteur choisit entre attendre demain et payer.
    """
    for sujet in ("un", "deux", "trois", "quatre"):
        _generer(client_plafonne, f"{GRATUIT}:rend-du-png", sujet)

    envoi = client_plafonne.post(
        "/api/outgoing",
        json={"prompt": "le cinquième", "modele": f"{GRATUIT}:rend-du-png"},
    ).json()

    assert envoi["reserve"]["reste"] == 0.0
    assert envoi["reserve"]["besoin"] == 1.0
    assert envoi["reserve"]["manque"] == 1.0
    # Et rien n'est refusé pour autant : l'appel part si on le demande.
    assert _generer(client_plafonne, f"{GRATUIT}:rend-du-png", "le cinquième")[
        "consomme"
    ] == 1.0


def test_rien_ne_manque_tant_que_la_reserve_suffit(client_plafonne):
    """Le pendant du précédent : `manque` vaut `None`, jamais zéro.

    Zéro se lirait « il manque zéro », qui est une phrase qu'aucun écran ne
    devrait avoir à interpréter.
    """
    envoi = client_plafonne.post(
        "/api/outgoing",
        json={"prompt": "un tonneau", "modele": f"{GRATUIT}:rend-du-png"},
    ).json()
    assert envoi["reserve"]["manque"] is None


# ── 7 · Le plafond de l'agent compte les deux à part ─────────────────────────


async def test_le_plafond_de_l_agent_compte_a_part_l_argent_et_le_gratuit(
    tmp_path, double, gratuit
):
    """*Le plafond de l'agent compte à part ce qu'il dépense et ce qu'il consomme.*

    Sans ça, une séance entière passée chez un fournisseur gratuit se lisait
    « $0,0000 » — c'est-à-dire exactement comme une séance sans un seul appel.
    Le plafond, lui, comptait déjà des **images** : il n'a jamais refusé au nom
    d'un montant, et il n'avait donc rien à corriger.

    **Par le vrai chemin de l'agent**, celui du serveur MCP : c'est le seul qui
    pose la provenance, et une génération de l'auteur ne compte pas ici.
    """
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    await atelier.ouvrir()
    serveur = creer_serveur(atelier)
    # Le garde-fou du modèle levé : on veut voir les deux unités, donc les deux
    # fournisseurs, et c'est l'agent qui nomme le modèle dans ce cas-là.
    atelier.agent.regler(modele_actif=False)
    for modele in (f"{GRATUIT}:rend-du-png", "essai:rend-du-png"):
        await serveur.call_tool(
            "generate_asset", {"subject": "un tonneau", "model": modele}
        )
    await atelier.generations.attendre_tout()

    compte = atelier.agent.consommation()
    assert compte["depense_usd"] == 0.0245
    assert compte["consomme"] == [{"unite": JETON, "quantite": 1.0}]
    # Le plafond compte des images, et il en compte deux — les deux unités
    # confondues, parce que c'est ce qu'il a toujours compté.
    assert compte["generations"] == 2

    # Et la façade de l'agent dit la même chose, dans son vocabulaire à lui.
    budget = (await serveur.call_tool("get_budget", {})).structured_content
    assert budget["spent_usd"] == 0.0245
    assert budget["consumed"] == [{"unite": JETON, "quantite": 1.0}]


# ── 8 · Y compris quand ça échoue ────────────────────────────────────────────


def test_une_generation_enregistre_son_unite_meme_quand_elle_echoue(
    tmp_path, double, gratuit
):
    """*Une génération enregistre ce qu'elle a consommé et dans quelle unité,
    y compris quand elle échoue.*

    Un refus qui a brûlé un jeton l'a brûlé pour de bon, et un compte de réserve
    qui l'oublierait serait faux **vers le haut** — c'est-à-dire faux du côté
    qui laisse partir un lot qui ne passera pas.
    """
    gratuit.echec = AppelRefuse("le modèle a dit non", consomme=1.0, unite=JETON)
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(atelier)) as client:
        generation = _generer(client, f"{GRATUIT}:rend-du-png")
        assert generation["statut"] == "echouee"
        assert generation["unite"] == JETON
        assert generation["consomme"] == 1.0
        assert generation["cout_usd"] == 0.0

        # **Et sur le disque, pas seulement en mémoire** : c'est le fichier qui
        # fait foi, et l'index se refait à partir de lui.
        chemin = (
            atelier.fichiers.racine
            / "generations"
            / generation["identifiant"]
            / "generation.json"
        )
        ecrit = json.loads(chemin.read_text(encoding="utf-8"))
        assert ecrit["emplacements"][0]["unite"] == JETON
        assert ecrit["emplacements"][0]["consomme"] == 1.0


# ── 9 · Le même chiffre des deux côtés ───────────────────────────────────────


def test_l_ecran_qui_confirme_annonce_le_chiffre_de_la_mesure_dans_son_unite(
    client_deux,
):
    """*L'écran qui confirme et la planche annoncent le même chiffre pour le même
    appel, dans les deux unités — la règle payée en E13 tient sans être réécrite.*

    Elle tient parce qu'il n'y a toujours **qu'un seul endroit qui compte** :
    `atelier/services/prix.py`. L'unité s'y est ajoutée à côté du chiffre, et
    les deux écrans la reçoivent par le même chemin que le chiffre.
    """
    _generer(client_deux, f"{GRATUIT}:rend-du-png")

    envoi = client_deux.post(
        "/api/outgoing",
        json={"prompt": "un tonneau", "modele": f"{GRATUIT}:rend-du-png"},
    ).json()
    assert envoi["prix"]["mesure"]["unite"] == JETON
    assert envoi["prix"]["total"] == 1.0

    # Et la barre qui paie, qui lit la même mesure par `/models`.
    lu = client_deux.get("/api/models").json()
    assert lu["couts"][f"{GRATUIT}:rend-du-png"] == 1.0
    fiche = next(
        m for m in lu["modeles"] if m["identifiant"] == f"{GRATUIT}:rend-du-png"
    )
    assert fiche["unite"] == JETON


def test_un_modele_gratuit_jamais_appele_dit_son_unite_quand_meme(client_deux):
    """**L'unité vient du fournisseur, jamais de l'historique seul.**

    Un modèle gratuit qu'on n'a encore jamais appelé n'a rien laissé dans
    l'index. Si l'unité se lisait sur ce qui est parti, l'écran de confirmation
    annoncerait un prix **en dollars** pour un appel qui n'en coûte aucun — le
    défaut exact que la tranche ferme.
    """
    envoi = client_deux.post(
        "/api/outgoing",
        json={"prompt": "un tonneau", "modele": f"{GRATUIT}:rend-du-png"},
    ).json()
    assert envoi["prix"]["mesure"]["unite"] == JETON
    assert envoi["prix"]["mesure"]["prix"] is None  # rien n'a encore été mesuré


# ── 10 · Ce qui a été écrit avant la V2.2 ────────────────────────────────────


def test_une_depense_d_avant_la_v2_2_se_relit_sans_rien_perdre(
    tmp_path, double, gratuit
):
    """*Elle est en dollars, elle le dit, et aucune ligne ne change.*

    Le fichier écrit ici est celui de la V2 : un `cout_usd` et rien d'autre. On
    le relit par le chemin normal — la reconstruction de l'index depuis le
    disque, qui est le geste qu'un changement de schéma déclenche.
    """
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(atelier)) as client:
        generation = _generer(client, "essai:rend-du-png")

    dossier = atelier.fichiers.racine / "generations" / generation["identifiant"]
    fiche = dossier / "generation.json"
    contenu = json.loads(fiche.read_text(encoding="utf-8"))
    # On **retire** ce que la V2.2 ajoute : le fichier redevient celui d'avant.
    for emplacement in contenu["emplacements"]:
        emplacement.pop("consomme")
        emplacement.pop("unite")
    contenu.pop("consomme", None)
    contenu.pop("unite", None)
    fiche.write_text(json.dumps(contenu, ensure_ascii=False), encoding="utf-8")

    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    suivant.bibliotheque.reconstruire()
    relue = suivant.base.lire(generation["identifiant"])

    assert relue.unite == USD
    assert relue.consomme == 0.0245
    assert relue.cout_usd == 0.0245


def test_un_asset_d_avant_la_v2_2_se_relit_en_dollars(tmp_path, double, gratuit):
    """La même chose pour l'image, qui porte sa propre copie du chiffre."""
    atelier = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    with TestClient(creer_application(atelier)) as client:
        generation = _generer(client, "essai:rend-du-png")
        identifiant = client.get("/api/assets").json()["assets"][0]["identifiant"]

    dossier = atelier.fichiers.racine / "generations" / generation["identifiant"]
    fiche = next(dossier.glob("*-asset.json"))
    contenu = json.loads(fiche.read_text(encoding="utf-8"))
    contenu.pop("consomme")
    contenu.pop("unite")
    fiche.write_text(json.dumps(contenu, ensure_ascii=False), encoding="utf-8")

    suivant = Atelier(
        racine=tmp_path, fabriques_fournisseurs=[lambda: double, lambda: gratuit]
    )
    suivant.bibliotheque.reconstruire()
    relu = suivant.base.lire_asset(identifiant)

    assert relu.unite == USD
    assert relu.cout_usd == 0.0245


# ── Le domaine, seul ─────────────────────────────────────────────────────────


def test_un_total_en_argent_ne_peut_pas_compter_un_jeton():
    """L'invariant, tenu **par construction** plutôt que par vigilance.

    C'est la raison pour laquelle aucune des dizaines de sommes de `cout_usd` du
    dépôt n'a eu à apprendre qu'il existe d'autres unités : elles somment un
    chiffre qui vaut zéro dès que l'unité n'est pas celle de l'argent.
    """
    assert argent(1.0, JETON) == 0.0
    assert argent(0.0245, USD) == 0.0245
    # Une unité absente est de l'argent — c'est ce qu'était tout le produit.
    assert argent(0.0245, None) == 0.0245


def test_une_reserve_sans_plafond_ne_dit_pas_zero():
    """`None` n'est pas zéro, et un écran ne doit pas les confondre.

    Zéro veut dire « la réserve est vide, attends demain ». `None` veut dire
    « ce fournisseur ne limite pas le nombre d'images » — et c'est le cas des
    **deux** fournisseurs du produit aujourd'hui.
    """
    sans = Reserve(
        fournisseur="essai",
        unite=JETON,
        consomme=7.0,
        plafond=None,
        source=ICI,
        renouvellement="minuit",
        cadence_s=15.0,
    )
    assert sans.reste is None
    assert sans.manque_pour(3.0) is None

    avec = Reserve(
        fournisseur="essai",
        unite=JETON,
        consomme=7.0,
        plafond=8.0,
        source=ICI,
        renouvellement="minuit",
        cadence_s=0.0,
    )
    assert avec.reste == 1.0
    assert avec.manque_pour(1.0) is None
    assert avec.manque_pour(3.0) == 2.0


def test_une_quantite_se_dit_avec_son_mot():
    """Pour l'agent et pour les refus — l'écran, lui, a sa propre mise en forme."""
    assert accorde(0.0245, USD) == "$0.0245"
    assert accorde(1, JETON) == "1 jeton"
    assert accorde(3, JETON) == "3 jetons"
