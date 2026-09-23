# -*- coding: utf-8 -*-
"""SC5 — plusieurs styles par personnage, et un style **coché** à chaque envoi.

Demandé par l'auteur le 22 septembre 2026. Mara avait « fusil » sur sa fiche ;
une série de repos partait avec le fusil dans le texte, et rien ne permettait
de le décocher. Trois règles en sortent :

1. un personnage a **une liste** de styles — il peut se battre au fusil et au
   couteau ; ce sont des propositions ;
2. **rien n'est coché d'office** : sans style coché, le texte du mouvement
   part seul, même si le personnage en a ;
3. un style coché écrit **son texte pour le mouvement de chaque case** — le
   repos du fusil tient l'arme immobile, son attaque tire.

**Aucun essai ne coûte un centime** : rien n'est généré.
"""

from __future__ import annotations

import pytest

from atelier.domaine.style import LIVRES
from atelier.domaine.travail import TravailRefuse, demande_normalisee, pour_l_empreinte

_FUSIL = next(s for s in LIVRES if s.identifiant == "fusil")


def _projet(atelier) -> str:
    return atelier.bibliotheque.courant


def _creer(client, projet: str, nom: str = "Mara") -> str:
    reponse = client.post(
        "/api/characters", json={"nom": nom, "description": nom, "projet": projet}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _poser(client, projet: str, personnage: str, styles: list[str]):
    return client.put(
        f"/api/characters/{personnage}/combat-style?projet={projet}",
        json={"styles": styles},
    )


def _compose(client, projet: str, personnage: str, pose: str, style: str | None = None) -> dict:
    url = f"/api/movements/for-pose/{pose}?projet={projet}&personnage={personnage}"
    if style:
        url += f"&style={style}"
    reponse = client.get(url)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _texte_du_mouvement(client, projet: str, identifiant: str) -> str:
    base = client.get(f"/api/movements?projet={projet}").json()["mouvements"]
    return next(m["texte"] for m in base if m["identifiant"] == identifiant)


def test_un_personnage_a_plusieurs_styles_et_les_relit_dans_leur_ordre(client, atelier):
    projet = _projet(atelier)
    mara = _creer(client, projet)
    pose = _poser(client, projet, mara, ["fusil", "dagues", "fusil"])
    assert pose.status_code == 200, pose.text
    attendu = [("fusil", "choisi"), ("dagues", "choisi")]
    assert [(s["style"]["identifiant"], s["origine"]) for s in pose.json()["styles"]] == attendu
    # **Refermer et rouvrir** (AGENTS.md 8septies) : ce qu'on relit est ce qui
    # a été gardé, pas la réponse du PUT.
    relu = client.get(f"/api/styles/for-character/{mara}?projet={projet}").json()
    assert [(s["style"]["identifiant"], s["origine"]) for s in relu["styles"]] == attendu

    vide = _poser(client, projet, mara, []).json()
    assert vide["styles"] == []
    assert atelier.fichiers.lire_styles_choisis(projet)["personnages"] == {}


def test_rien_n_est_coche_d_office(client, atelier):
    """*Quand on fait une génération, il ne faut pas mettre de style par défaut.*"""
    projet = _projet(atelier)
    mara = _creer(client, projet)
    _poser(client, projet, mara, ["fusil"])

    recu = _compose(client, projet, mara, "repos")
    assert recu["style"] is None
    assert recu["geste"] == _texte_du_mouvement(client, projet, "repos")
    assert "rifle" not in recu["texte"]
    # Proposé, pour qu'on le coche d'un clic.
    assert [s["style"]["identifiant"] for s in recu["styles_proposes"]] == ["fusil"]


def test_le_style_coche_ecrit_son_texte_pour_chaque_mouvement(client, atelier):
    """*Repos au fusil : le fusil ne bouge pas ; attaque : il tire.*"""
    projet = _projet(atelier)
    mara = _creer(client, projet)

    repos = _compose(client, projet, mara, "repos", "fusil")
    attaque = _compose(client, projet, mara, "attaque", "fusil")
    assert repos["geste"] == _FUSIL.texte("repos")
    assert attaque["geste"] == _FUSIL.texte("attaque")
    assert "stays perfectly still" in repos["geste"] and "no shooting" in repos["geste"]
    assert "fires" in attaque["geste"]
    # Un style se coche même s'il n'est pas sur la fiche : la fiche propose,
    # elle ne borne pas.
    assert repos["style"]["identifiant"] == "fusil"


def test_chaque_repos_livre_tient_son_arme_immobile():
    """Un repos qui fait osciller l'arme la fait brandir par le modèle vidéo."""
    for style in LIVRES:
        if style.tient and style.texte("repos"):
            assert "still" in style.texte("repos"), style.identifiant


def test_un_style_inconnu_ou_masque_coche_est_refuse(client, atelier):
    projet = _projet(atelier)
    mara = _creer(client, projet)
    inconnu = client.get(f"/api/movements/for-pose/repos?projet={projet}&personnage={mara}&style=nunchaku")
    assert inconnu.status_code == 409
    client.delete(f"/api/styles/lance?projet={projet}")
    masque = client.get(f"/api/movements/for-pose/repos?projet={projet}&personnage={mara}&style=lance")
    assert masque.status_code == 409
    assert _poser(client, projet, mara, ["fusil", "nunchaku"]).status_code == 409


def test_un_fichier_d_avant_se_relit_comme_une_liste(client, atelier):
    """Un `styles-choisis.json` du 21 septembre porte une chaîne par personnage."""
    projet = _projet(atelier)
    atelier.fichiers.ecrire_styles_choisis(
        projet, {"personnages": {"mara": "fusil"}, "pieces": {}}
    )
    assert atelier.fichiers.lire_styles_choisis(projet)["personnages"] == {"mara": ["fusil"]}


def test_la_demande_d_une_fabrication_porte_le_style_coche():
    base = {"cle": "k", "personnage": "mara", "pose": "repos", "direction": "",
            "modele_video": "m", "prompt_video": "", "mouvement": "repos"}
    assert demande_normalisee(base)["style_combat"] is None
    assert demande_normalisee({**base, "style_combat": "fusil"})["style_combat"] == "fusil"
    # Une demande d'avant garde son empreinte : le champ neuf, laissé à son
    # défaut, n'y entre pas.
    assert "style_combat" not in pour_l_empreinte(demande_normalisee(base))
    with pytest.raises(TravailRefuse, match="style de combat"):
        demande_normalisee({**base, "mouvement": None, "prompt_video": "x", "style_combat": "fusil"})
    with pytest.raises(TravailRefuse, match="style_combat"):
        demande_normalisee({**base, "style_combat": "  "})
