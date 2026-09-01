# -*- coding: utf-8 -*-
"""Les critères de E19 qui vivent côté serveur — le premier lancement.

**Ce qui se mesure ici** : que l'atelier sache dire qu'il n'a encore rien, que ce
fait cesse d'être vrai au premier geste, que le jeu de départ existe avant d'avoir
un nom, et que la clé se dépose au même endroit quel que soit le chemin. Ce que
l'écran montre — l'assistant qui s'ouvre, la sortie qui dépose dans le codex, la
barre du haut qui dit avec quoi on peut produire — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare.** La réorganisation du 30 août 2026 a retiré l'écran
qui s'appelait *l'Atelier*. Il ne reste que deux endroits d'où l'argent part —
l'établi d'une chose, et le codex —, or un établi appartient à une chose, et sur
une installation neuve le codex est vide. **Il n'y avait donc plus nulle part où
écrire un prompt**, et la première histoire d'usage du produit n'était plus
réalisable telle qu'elle était écrite.

**Un fait, jamais un drapeau.** Reconnaître le premier lancement demandait de
savoir si on l'avait déjà vu ; un drapeau posé une fois aurait été un état de
plus à tenir, à effacer quand on remet l'atelier à zéro, et à expliquer le jour
où il se serait désaccordé du disque. Trois faits suffisent, et ils cessent
d'être vrais au premier geste.
"""

from __future__ import annotations

from atelier.domaine.projet import NOM_BAC_A_SABLE
from atelier.fournisseur.openrouter import CLE

from tests.conftest import image_sujet


def _etat(client) -> dict:
    reponse = client.get("/api/status")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── L'atelier sait dire qu'il n'a encore rien ────────────────────────────────


def test_un_atelier_neuf_le_dit(client):
    """**Aucune image, un seul jeu, et il porte le nom que le produit lui a
    donné.** C'est là que l'assistant s'ouvre — la seule minute que personne ne
    revoit jamais."""
    etat = _etat(client)

    assert etat["premier_lancement"] is True
    projets = etat["bibliotheque"]["projets"]
    assert [p["nom"] for p in projets] == [NOM_BAC_A_SABLE]
    assert projets[0]["assets"] == 0


def test_le_jeu_de_depart_existe_avant_davoir_un_nom(client):
    """**Ranger reste un geste, jamais un préalable** (US-2). Le serveur crée le
    « Bac à sable » quand il n'en trouve aucun, et ne le recrée jamais ensuite :
    l'assistant ne crée donc pas le premier jeu, il **renomme** celui qui est là.
    C'est ce qui fait tenir les deux promesses ensemble — on travaille d'emblée
    dans un jeu qui existe, et on ne nomme rien avant de savoir quoi."""
    projets = _etat(client)["bibliotheque"]["projets"]
    identifiant = projets[0]["identifiant"]

    reponse = client.put(
        f"/api/projects/{identifiant}", json={"nom": "Cœur de pierre"}
    )
    assert reponse.status_code == 200, reponse.text

    apres = _etat(client)
    assert [p["identifiant"] for p in apres["bibliotheque"]["projets"]] == [
        identifiant
    ]
    assert apres["bibliotheque"]["projets"][0]["nom"] == "Cœur de pierre"


def test_nommer_son_jeu_referme_la_porte(client):
    """Le fait cesse d'être vrai **au premier geste**, et c'est exactement quand
    la porte doit se refermer : quelqu'un qui a nommé son jeu ne revient pas à
    l'écran du premier lancement."""
    identifiant = _etat(client)["bibliotheque"]["projets"][0]["identifiant"]

    client.put(f"/api/projects/{identifiant}", json={"nom": "Cœur de pierre"})

    assert _etat(client)["premier_lancement"] is False


def test_une_image_importee_referme_la_porte(client, tmp_path):
    """L'autre geste qui la referme : un atelier qui contient une image n'est
    plus neuf, même si personne n'a nommé son jeu."""
    fichier = tmp_path / "un-tonneau.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=6, logique_h=12))

    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code == 201, reponse.text

    assert _etat(client)["premier_lancement"] is False


def test_un_second_jeu_referme_la_porte(client):
    """Et le troisième : deux jeux veulent dire que quelqu'un est déjà passé."""
    reponse = client.post("/api/projects", json={"nom": "Cœur de pierre"})
    assert reponse.status_code == 201, reponse.text

    assert _etat(client)["premier_lancement"] is False


def test_la_cle_ne_referme_pas_la_porte(client, double, monkeypatch):
    """**Elle peut venir de l'environnement**, posée par quelqu'un qui n'a jamais
    ouvert l'atelier. Un jeu neuf reste un jeu neuf, et l'étape des fournisseurs
    dira simplement qu'elle est déjà là."""
    monkeypatch.setenv(CLE.nom, "sk-or-v1-essai-de-cle")
    double.secrets_declares = (CLE,)

    etat = _etat(client)

    place = etat["secrets"][0]["secrets"][0]
    assert place["presente"] is True
    assert etat["premier_lancement"] is True


# ── Rien n'est exigé pour commencer ─────────────────────────────────────────


def test_sur_une_installation_neuve_on_nomme_et_on_a_une_case(client, double):
    """**Le compte des écrans obligatoires est zéro.** Sans avoir répondu à une
    seule question de l'assistant, on nomme une chose et elle a des cases : c'est
    depuis son établi que le prompt s'écrit."""
    assert _etat(client)["premier_lancement"] is True

    reponse = client.post("/api/characters", json={"nom": "un tonneau cerclé de fer"})
    assert reponse.status_code == 201, reponse.text

    chose = reponse.json()["personnage"]
    assert chose["cases"], "une chose nommée a des cases dès la première seconde"
    # Et rien n'a été demandé au fournisseur pour ça.
    assert double.appels == 0


def test_un_univers_vide_ne_contraint_rien(client):
    """« Un univers vide ne contraint rien » (US-57), et c'est ce qui remplace
    l'exclusion de l'assistant : une étape passée reste passée sans rien bloquer
    ni se redemander."""
    univers = client.get("/api/universe").json()["univers"]

    assert univers["vue"] == ""
    assert all(not c["texte"] for c in univers["bible"])
    assert univers["vide"] is True


def test_la_cle_a_un_seul_endroit_ou_elle_habite(
    client, double, tmp_path, monkeypatch
):
    """**Trois portes, une seule pièce.** L'étape 10 de l'assistant, la fenêtre
    des réglages et le bouton qui paie éteint mènent tous les trois au même
    champ ; le déposer par l'un revient exactement au même que par l'autre."""
    monkeypatch.delenv(CLE.nom, raising=False)
    monkeypatch.setattr("atelier.reglages.FICHIER_ENV", tmp_path / ".env")
    double.secrets_declares = (CLE,)

    reponse = client.put(
        f"/api/settings/keys/{CLE.nom}", json={"valeur": "sk-or-v1-essai-de-cle-longue"}
    )
    assert reponse.status_code == 200, reponse.text

    # La route et l'état lisent la même valeur, au même endroit.
    depose = reponse.json()["tiroirs"][0]["secrets"][0]
    assert depose["presente"] is True
    assert _etat(client)["secrets"][0]["secrets"][0]["apercu"] == depose["apercu"]
