# -*- coding: utf-8 -*-
"""F6 — le brouillon ne coûte plus rien.

Les six critères de `docs/tranches/V2.2.md` § F6. **Aucun n'appelle un vrai
fournisseur** : les deux d'ici sont les doubles de F1 — le payant, qui demande
une clé, et le gratuit, qui compte en jetons.

**Ce que la tranche ferme.** Le modèle imposé à l'agent était le meilleur du
banc en qualité basse : un rapport de six sur le coût du travail agentique, pour
une perte de qualité qui ne compte pas quand on code. Il vaut désormais la
totalité — *une séance de code entière ne fait plus bouger le total en argent*.

**Et le trou qu'elle creuse en le faisant.** Un modèle gratuit n'accepte aucune
image d'entrée. Ce que le jeu ajoute de lui-même — ses artworks, les concept
arts de la chose, les images de son ambiance — ne part donc pas. Avant F6,
l'appel entier était refusé, ce qui aurait rendu le garde-fou inutilisable sur
tout jeu ayant un seul artwork officiel ; désormais l'appel part **sans elles**,
et il l'écrit. Trois essais d'ici mesurent cette règle, parce qu'elle est ce qui
rend le reste possible.

**Ce qui ne se mesure pas ici** : le critère qui juge la tranche se vérifie sur
une séance de code réelle, pas sur un essai — un double qui ne facture rien
prouverait seulement que le double ne facture rien. Ce qui se mesure ici est la
mécanique qui le rend vrai : le modèle imposé est gratuit, il le reste quand le
catalogue bouge, et il ne peut pas être repris à la main par un payant.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.consommation import USD, est_argent
from atelier.mcp.serveur import creer_serveur
from atelier.services import Atelier

from conftest import image
from test_c1 import _coller_carte
from test_f1 import GRATUIT, FournisseurGratuit
from test_t7 import appeler


# ── Le montage : un payant et un gratuit ────────────────────────────────────


@pytest.fixture
def gratuit() -> FournisseurGratuit:
    return FournisseurGratuit()


@pytest.fixture
def deux(tmp_path, double, gratuit) -> Atelier:
    """Le montage de F1, réemployé tel quel : c'est celui du produit."""
    return Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: double, lambda: gratuit],
    )


@pytest.fixture
def client(deux) -> TestClient:
    with TestClient(creer_application(deux)) as client:
        yield client


@pytest.fixture
async def mcp(deux):
    """Le serveur de l'agent, sur un atelier **ouvert** — catalogue relu.

    Même raison qu'en T7 : le garde-fou du modèle consulte le catalogue, et un
    catalogue vide ferait tomber les appels sur un refus sans rapport.
    """
    await deux.ouvrir()
    return creer_serveur(deux)


def _artwork(client: TestClient) -> str:
    """Un artwork officiel dans le jeu ouvert — ce que le produit ajoute seul."""
    carte = _coller_carte(client, "planche-de-style.png")
    client.put(
        f"/api/board/{carte}/official", json={"officiel": True, "famille": "tous"}
    )
    return carte


def _generer(client: TestClient, modele: str, **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": modele, "prompt": "un tonneau", **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return reponse.json()


# ── « Le modèle imposé à l'agent est gratuit par défaut » ────────────────────


async def test_le_modele_impose_est_gratuit(deux):
    """**Le gain le plus net de la version**, et il tient en une ligne du cadre.

    Vérifié par ce que le fournisseur déclare, jamais par un tarif à zéro : un
    modèle payant qu'on n'a jamais appelé n'a rien laissé dans l'index des prix,
    et un « ça n'a rien coûté jusqu'ici » l'y aurait fait entrer.
    """
    await deux.ouvrir()

    modele, options = deux.agent.modele_impose(None)

    assert not est_argent(deux.catalogue.unite_de(modele))
    assert modele.startswith(f"{GRATUIT}:")
    # Aucune option imposée : `quality` était un réglage d'OpenRouter, et un
    # réglage qu'un modèle ne déclare pas est écarté avec sa raison depuis T1.
    assert options == {}


async def test_un_gratuit_disparu_ne_fait_pas_retomber_sur_un_payant(deux):
    """**Un garde-fou qui coûte de l'argent en silence est pire que rien.**

    Le nom enregistré dans le cadre est celui du seul gratuit mesuré ; il peut
    disparaître du catalogue — un fournisseur renomme, une liaison est coupée.
    Le repli d'avant F6 rendait le défaut du catalogue, c'est-à-dire le meilleur
    modèle du banc, c'est-à-dire un payant.
    """
    await deux.ouvrir()
    deux.agent.regler(modele="Personne:ce-modele-n-existe-pas")

    modele, _ = deux.agent.modele_impose(None)

    assert not est_argent(deux.catalogue.unite_de(modele))


async def test_le_choix_se_relit_a_chaque_appel(deux):
    """La règle des garde-fous de T7 ne bouge pas — et elle vaut pour celui-ci.

    Poser un modèle en cours de séance agit au premier appel suivant, sans que
    rien ne redémarre. C'est la même règle que la clé du fournisseur, et le
    fichier est relu à chaque question posée.
    """
    await deux.ouvrir()
    gratuits = deux.catalogue.gratuits()
    assert gratuits, "le montage a un fournisseur gratuit"

    deux.agent.regler(modele_actif=False)
    assert deux.agent.modele_impose("essai:rend-du-jpeg")[0] == "essai:rend-du-jpeg"

    deux.agent.regler(modele_actif=True, modele=gratuits[0].identifiant)
    assert deux.agent.modele_impose("essai:rend-du-jpeg")[0] == gratuits[0].identifiant


# ── « Une image faite sans les références de l'univers se reconnaît » ────────


def test_ce_que_le_jeu_ajoute_cede_devant_le_plafond(client):
    """**Ce que le produit ajoute de lui-même cède ; l'appel part sans.**

    Avant F6, cet appel-là était refusé tout entier — *« n'accepte aucune image
    de référence »* — sur tout jeu ayant un seul artwork officiel. Le garde-fou
    de l'agent aurait été éteint le jour même, ce qui est la façon la plus sûre
    de perdre un garde-fou.
    """
    carte = _artwork(client)

    faite = _generer(client, f"{GRATUIT}:rend-du-png")

    # Rien n'est parti…
    assert faite["references"] == []
    # …et ce qui n'est pas parti est écrit, nommément.
    assert [r["asset"] for r in faite["hors_plafond"]] == [carte]


def test_ce_que_lauteur_a_joint_ne_cede_jamais(client, tmp_path):
    """**On a demandé qu'elle parte** : elle ne cède pas, et le modèle refuse.

    C'est la moitié de la règle qui ne se voit pas, et c'est celle qui la rend
    sûre : sans elle, joindre une image à un appel chez un modèle qui n'en prend
    pas serait un geste sans effet **et sans message**.
    """
    fichier = tmp_path / "a-la-main.png"
    fichier.write_bytes(image("PNG"))
    entree = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert entree.status_code == 201, entree.text
    asset = entree.json()["asset"]["identifiant"]

    refus = client.post(
        "/api/generations",
        json={
            "modele": f"{GRATUIT}:rend-du-png",
            "prompt": "un tonneau",
            "references": [{"asset": asset, "role": "reference"}],
        },
    )

    assert refus.status_code == 409, refus.text
    assert "aucune image de référence" in refus.text


def test_le_gratuit_nest_plus_grise_par_les_artworks_du_jeu(client):
    """Le grisé se compte sur **ce qui ne cède pas**, et non sur tout.

    Sinon la liste dirait *indisponible* d'un modèle chez qui la soumission
    passe — c'est-à-dire l'inverse exact de la règle de T1, qui interdit de
    proposer pour rejeter ensuite. Ici c'est le refus qui mentirait.
    """
    _artwork(client)

    modeles = {m["identifiant"]: m for m in client.get("/api/models").json()["modeles"]}

    assert modeles[f"{GRATUIT}:rend-du-png"]["refus"] is None


def test_lecran_de_confirmation_dit_que_les_images_ne_partiront_pas(client):
    """**Ce qui est montré est ce qui part** — la règle de E14, tenue à l'envers.

    L'écran de confirmation existe pour qu'aucune surprise n'arrive après le
    clic. Une ligne cochée, avec sa vignette et son prix, qui ne partirait pas,
    serait la surprise la plus coûteuse qu'il puisse laisser passer.
    """
    _artwork(client)

    reponse = client.post(
        "/api/outgoing",
        json={"modele": f"{GRATUIT}:rend-du-png", "prompt": "un tonneau"},
    )
    assert reponse.status_code == 200, reponse.text
    envoi = reponse.json()

    lignes = envoi["images"]["lignes"]
    assert lignes and all(l["hors_plafond"] for l in lignes)
    textes = " · ".join(a["texte"] for a in envoi["avertissements"])
    assert "n'accepte aucune image" in textes
    # Et le prix ne compte pas ce qui ne part pas.
    assert envoi["prix"]["images"] in (None, 0, 0.0)


# ── « L'outil du budget répond dans les deux unités » ────────────────────────


async def test_loutil_du_budget_repond_dans_les_deux_unites(deux, mcp):
    """Tenu par F2, et **c'est ici qu'on vérifie qu'il l'est resté**.

    Un plafond qui ne se consulte qu'en le heurtant n'est pas un garde-fou —
    c'était déjà vrai en argent, ça l'est davantage pour une réserve qui ne
    revient que le lendemain.
    """
    await appeler(mcp, "generate_asset", subject="un tonneau")
    await deux.generations.attendre_tout()

    budget = await appeler(mcp, "get_budget")

    assert budget["spent_usd"] == 0.0
    assert budget["consumed"], "ce qui a été consommé sans argent est dit"
    assert all(not est_argent(c["unite"]) for c in budget["consumed"])
    # Et ce que chaque fournisseur alloue, avec d'où le chiffre vient.
    comptes = [p for p in budget["providers"] if p]
    assert comptes and all(p["counted"] in ("here", "provider") for p in comptes)


# ── « Une séance de code entière ne fait plus bouger le total en argent » ────


async def test_une_seance_entiere_ne_bouge_pas_le_total_en_argent(deux, mcp, client):
    """Le critère qui juge la tranche, **mesuré sur la mécanique**.

    Sur une séance réelle il se vérifie autrement — en regardant la barre de
    tête après une journée de code. Ce qu'un essai peut prouver est que rien
    dans le chemin de l'agent ne mène chez un fournisseur qui facture : le
    garde-fou impose un gratuit, le jeu a des artworks que le modèle ne prend
    pas, et l'appel part quand même.
    """
    _artwork(client)
    avant = client.get("/api/spending").json()["total_usd"]

    for sujet in ("un tonneau", "une épée", "un bouclier"):
        await appeler(mcp, "generate_asset", subject=sujet)
    await deux.generations.attendre_tout()

    apres = client.get("/api/spending").json()
    assert apres["total_usd"] == avant
    # **Et ce n'est pas une séance vide** : ce qui a été consommé se lit à côté,
    # dans son unité. C'était tout le sujet de F2, et c'est ce qui empêche de
    # confondre « rien dépensé » et « rien fait ».
    assert apres["par_unite"], "trois appels ont consommé quelque chose"
    assert sum(u["quantite"] for u in apres["par_unite"]) >= 3


# ── « La version de production se regénère chez un modèle payant » ───────────


async def test_la_version_de_production_se_regenere_chez_un_payant(deux, mcp, client):
    """**Sans que rien n'ait à être retapé** — et le style du jeu revient seul.

    C'est la contrepartie du brouillon gratuit, et elle est plus jolie que
    prévu : reprendre les réglages d'une image d'agent rend le prompt tel qu'il
    est parti ; le poser chez un modèle qui accepte des images fait repartir les
    artworks du jeu **sans que personne ait à les recocher**, puisqu'ils sont
    réassemblés à la soumission.
    """
    carte = _artwork(client)
    await appeler(mcp, "generate_asset", subject="un tonneau cerclé de fer")
    await deux.generations.attendre_tout()

    brouillon = next(
        g
        for g in client.get("/api/generations").json()["generations"]
        if g["provenance"] == "agent"
    )
    assert brouillon["hors_plafond"], "le brouillon est parti sans le style du jeu"

    # Le même texte, chez le payant. Rien n'est retapé : c'est ce que l'écran
    # repose dans le champ.
    production = client.post(
        "/api/generations",
        json={
            "modele": "essai:rend-du-png",
            "prompt": brouillon["demande"]["prompt"],
            "proportions": brouillon["demande"]["proportions"],
        },
    )
    assert production.status_code == 202, production.text

    refaite = production.json()
    assert refaite["hors_plafond"] == []
    assert [r["asset"] for r in refaite["references"]] == [carte]
