# -*- coding: utf-8 -*-
"""PX10 · Le portrait choisi — une seule règle, et un choix qui ne se perd
jamais en silence (`docs/PLAN-idees-pixellab.md` § PX10).

**Pourquoi le défaut revenait.** Deux règles répondaient à la même question : la
fiche retombait sur *le corps retenu de la première case*, la carte du Codex
sur *la dernière image faite*. Dès que le choix de l'auteur cessait de valoir,
toute image nouvelle devenait le portrait sur la carte, et rien ne le disait.
C'était la troisième fois.

**Ce qui se vérifie ici**, et chaque essai tombe quand on défait la correction
(`AGENTS.md`, point 8octies) :

- sans choix, le repli **ne bouge pas** quand une image arrive — de chacune des
  façons dont une image arrive : génération rangée dans une case, import rangé,
  planche (image du sujet sans case), résultat repeint ;
- un choix perdu ne se remplace pas par la dernière arrivée, et la fiche porte
  sa raison ;
- carte du Codex, fiche et agent désignent **la même** image, toujours ;
- ce qui a détaché le portrait d'Elias — « Écarter » sur sa copie de carte —
  est refusé à la source, et un portrait déjà détaché se rattache par le
  produit.

Rien ne coûte un centime : le fournisseur et ComfyUI sont doublés.
"""

from __future__ import annotations

import itertools
import time

from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from tests.conftest import image_sujet
from tests.test_px9_parcours import _mara, _repeindre, atelier_px9  # noqa: F401
from tests.test_t7 import appeler, mcp  # noqa: F401

MODELE = "essai:rend-du-png"
_DISTINCTES = itertools.count(5)


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _creer(client, nom: str = "Elias") -> str:
    reponse = client.post("/api/characters", json={"nom": nom, "description": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _plan(client) -> list[str]:
    return [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]


def _importer(client, tmp_path) -> str:
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"image-{next(_DISTINCTES)}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    reponse = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert reponse.status_code in (200, 201), reponse.text
    return reponse.json()["asset"]["identifiant"]


def _rattacher(client, asset: str, personnage: str | None, pose: str | None = None):
    return client.put(
        f"/api/assets/{asset}/character", json={"personnage": personnage, "pose": pose}
    )


def _import_range(client, tmp_path, personnage: str, pose: str) -> str:
    asset = _importer(client, tmp_path)
    assert _rattacher(client, asset, personnage, pose).status_code == 200
    return asset


def _import_sans_case(client, tmp_path, personnage: str) -> str:
    """Une image du sujet sans case — la forme d'une copie de carte, d'une
    planche entière ou d'un résultat pas encore rangé."""
    asset = _importer(client, tmp_path)
    assert _rattacher(client, asset, personnage).status_code == 200
    return asset


def _generer(client, **corps) -> list[str]:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "Elias", **corps}
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            assert vue["statut"] == "reussie", vue
            break
        time.sleep(0.01)
    return [
        a["identifiant"]
        for a in client.get("/api/assets").json()["assets"]
        if a["generation"] == identifiant
    ]


def _choisir(client, personnage: str, asset: str | None) -> dict:
    reponse = client.put(
        f"/api/characters/{personnage}/reference-image", json={"asset": asset}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["personnage"]


def _carte(client, personnage: str) -> str | None:
    page = client.get("/api/characters/families/personnages").json()
    (carte,) = [p for p in page["personnages"] if p["identifiant"] == personnage]
    return carte["vignette"]["identifiant"] if carte["vignette"] else None


def _fiche(client, personnage: str) -> dict:
    for un in client.get("/api/characters").json()["personnages"]:
        if un["identifiant"] == personnage:
            return un
    raise AssertionError(f"« {personnage} » n'est pas dans la liste")


def _montre(client, personnage: str) -> str | None:
    """Ce que la carte montre — **et la fiche doit montrer la même**."""
    fiche = _fiche(client, personnage)["portrait"]
    carte = _carte(client, personnage)
    assert (fiche or {}).get("identifiant") == carte, (
        f"la fiche montre {fiche and fiche['identifiant']}, la carte {carte} : "
        "deux règles pour le même portrait"
    )
    return carte


# ── 1. Sans choix, le repli ne bouge pas quand une image arrive ───────────────


def test_sans_choix_le_repli_ne_bouge_quand_aucune_image_arrive(client, tmp_path):
    """**Le cœur du défaut.** La carte suivait la dernière image faite : chaque
    arrivée devenait le portrait. Toutes les façons d'arriver, l'une après
    l'autre — la carte et la fiche ne bougent pas."""
    elias = _creer(client)
    repos, marche = _plan(client)[:2]
    premiere = _import_range(client, tmp_path, elias, repos)
    assert _montre(client, elias) == premiere

    arrivees = {
        "génération rangée": lambda: _generer(client, personnage=elias, pose=marche),
        "import rangé": lambda: _import_range(client, tmp_path, elias, marche),
        "planche entière, sans case": lambda: _generer(client, personnage=elias),
        "image du sujet sans case": lambda: _import_sans_case(client, tmp_path, elias),
    }
    for comment, arriver in arrivees.items():
        arriver()
        assert _montre(client, elias) == premiere, f"après une {comment}"


def test_une_image_sans_case_ne_passe_pas_devant_une_image_rangee(client, tmp_path):
    """Une planche entière ou un résultat pas encore rangé n'est pas un
    portrait : rangée d'abord, même quand elle est plus récente."""
    elias = _creer(client)
    _import_sans_case(client, tmp_path, elias)
    rangee = _import_range(client, tmp_path, elias, _plan(client)[0])
    assert _montre(client, elias) == rangee


# ── 2. Un choix perdu ne se remplace pas par la dernière arrivée ─────────────


def test_un_choix_supprime_se_dit_et_la_carte_ne_suit_pas_les_arrivees(
    client, tmp_path
):
    elias = _creer(client)
    repos, marche = _plan(client)[:2]
    premiere = _import_range(client, tmp_path, elias, repos)
    choisie = _import_range(client, tmp_path, elias, marche)
    _choisir(client, elias, choisie)
    assert _montre(client, elias) == choisie
    assert _fiche(client, elias)["portrait_perdu"] is None

    efface = client.post("/api/assets/delete", json={"identifiants": [choisie]})
    assert efface.status_code == 200, efface.text

    perdu = _fiche(client, elias)["portrait_perdu"]
    assert perdu["asset"] == choisie and perdu["raison"] == "supprimee"
    assert perdu["rattachable"] is False
    # Le choix reste écrit : ce n'est pas un trou réparé en silence.
    assert _fiche(client, elias)["image_de_reference"] == choisie

    _generer(client, personnage=elias, pose=repos)
    _import_sans_case(client, tmp_path, elias)
    assert _montre(client, elias) == premiere


def test_un_choix_valide_tient_devant_toutes_les_arrivees(client, tmp_path):
    elias = _creer(client)
    repos, marche = _plan(client)[:2]
    _import_range(client, tmp_path, elias, repos)
    choisie = _import_range(client, tmp_path, elias, marche)
    _choisir(client, elias, choisie)
    _generer(client, personnage=elias, pose=repos)
    _import_range(client, tmp_path, elias, repos)
    _generer(client, personnage=elias)
    _import_sans_case(client, tmp_path, elias)
    assert _montre(client, elias) == choisie


# ── 3. Ce qui a détaché le portrait d'Elias ──────────────────────────────────


def test_ecarter_le_portrait_de_son_sujet_est_refuse_avec_sa_raison(client, tmp_path):
    """**La cause, réparée à la source.** Elias est né d'une carte de la toile :
    sa copie de carte est son portrait, sans case par nature, donc listée dans
    « Pas encore rangé » — où « Écarter » la détachait sans rien dire."""
    elias = _creer(client)
    copie = _import_sans_case(client, tmp_path, elias)
    _choisir(client, elias, copie)

    refus = _rattacher(client, copie, None)
    assert refus.status_code == 409, refus.text
    assert "portrait" in refus.json()["raison"]
    assert _fiche(client, elias)["portrait_perdu"] is None
    assert _montre(client, elias) == copie

    # L'envoyer chez un autre sujet non plus : il quitterait Elias pareil.
    brakk = _creer(client, "Brakk")
    assert _rattacher(client, copie, brakk).status_code == 409
    # Ranger dans une case d'Elias reste permis : il ne quitte pas son sujet.
    assert _rattacher(client, copie, elias, _plan(client)[0]).status_code == 200

    # Une fois un autre portrait choisi, écarter redevient possible.
    autre = _import_range(client, tmp_path, elias, _plan(client)[0])
    _choisir(client, elias, autre)
    assert _rattacher(client, copie, None).status_code == 200


def test_un_portrait_deja_detache_se_dit_et_se_rattache_par_le_produit(
    client, atelier, tmp_path
):
    """**L'état des données d'Elias le 27 septembre 2026** : le choix désigne
    une image vivante, détachée de son sujet par un geste d'avant la
    correction. La fiche le dit, la carte montre le repli stable, et le
    rattacher rend le choix valide — sans rien réécrire à la main."""
    elias = _creer(client)
    planche = _import_range(client, tmp_path, elias, _plan(client)[0])
    copie = _import_sans_case(client, tmp_path, elias)
    _choisir(client, elias, copie)
    # Le détachement d'avant la correction, rejoué dans le dépôt : la route le
    # refuse maintenant.
    objet = atelier.assets.lire(copie)
    objet.personnage = None
    atelier.assets.sauver(objet)
    _generer(client, personnage=elias)  # une planche arrive après coup

    perdu = _fiche(client, elias)["portrait_perdu"]
    assert perdu == {
        "asset": copie,
        "raison": "detachee",
        "phrase": "l'image choisie n'est plus rattachée à ce sujet",
        "rattachable": True,
    }
    assert _montre(client, elias) == planche

    assert _rattacher(client, copie, elias).status_code == 200
    assert _fiche(client, elias)["portrait_perdu"] is None
    assert _montre(client, elias) == copie


# ── 4. L'agent lit la même règle ─────────────────────────────────────────────


async def test_l_agent_lit_le_meme_portrait_que_la_carte_et_la_fiche(
    client, mcp, tmp_path  # noqa: F811
):
    elias = _creer(client)
    repos = _plan(client)[0]
    premiere = _import_range(client, tmp_path, elias, repos)
    choisie = _import_range(client, tmp_path, elias, repos)
    _choisir(client, elias, choisie)
    client.post("/api/assets/delete", json={"identifiants": [choisie]})
    _generer(client, personnage=elias, pose=repos)

    sujets = {c["id"]: c for c in (await appeler(mcp, "list_characters"))["characters"]}
    assert sujets[elias]["reference_image"] == _montre(client, elias) == premiere
    assert sujets[elias]["reference_image_lost"] == {
        "asset": choisie,
        "reason": "supprimee",
    }


# ── 5. Le résultat repeint — l'arrivée qui a montré le défaut sur Mara ──────


async def test_un_resultat_repeint_ne_devient_jamais_le_portrait(atelier_px9):  # noqa: F811
    """La carte de Mara montrait la pièce repeinte : une image du sujet, sans
    case, plus récente que tout. Avec et sans choix, elle ne passe pas devant."""
    atelier, _ = atelier_px9
    projet, image, mara, pose = _mara(atelier)

    def montre() -> str | None:
        # Lu par les services, sans client HTTP : un client ouvert après la
        # file locale fermerait ses tâches sur une autre boucle. La carte lit
        # `portraits_par_personnage` en lot, la fiche `en_charge` — les deux
        # chemins des routes.
        sujet = atelier.production.personnage(projet, mara)
        carte = atelier.base.portraits_par_personnage(projet, [sujet])[mara].identifiant
        fiche = atelier.production.en_charge(projet, sujet)
        assert (fiche["portrait"] or {}).get("identifiant") == carte
        assert fiche["portrait_perdu"] is None
        return carte

    assert montre() == image
    await _repeindre(atelier, image)
    assert montre() == image

    atelier.production.poser_image_de_reference(projet, mara, image)
    await _repeindre(atelier, image, texte="a hat")
    assert montre() == image
