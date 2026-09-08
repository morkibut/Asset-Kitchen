# -*- coding: utf-8 -*-
"""Les critères d'acceptation de R5 — un calque se recale sans repayer.

**Aucun test ne coûte un centime**, et deux d'entre eux le prouvent en comptant
les appels du double : le rejeu relit une planche déjà sur le disque, il ne
redemande rien à personne.

**Le problème que ces essais doivent poser, et comment ils le posent.** Rejouer
le même calcul rend le même résultat : un essai qui déplierait puis rejouerait
sans rien changer entre les deux ne prouverait rien — pas même que le rejeu a
lu la planche. Deux montages le rendent visible :

- **abîmer le brut du calque**, puis rejouer. Le brut revient. Il ne peut donc
  venir que de la planche, et pas de lui-même.
- **changer la portée de la pièce entre les deux**, puis rejouer. Le verdict
  bascule d'un bord à l'autre, pour la planche entière, et les identifiants ne
  bougent pas — c'est très exactement le cas du 29 août 2026, où deux corps
  habillés avaient été prononcés sur une échelle inventée.
"""

from __future__ import annotations

import hashlib
import io

import numpy
from PIL import Image

from atelier.image import calque as calc
from conftest import image_sujet
from test_c3 import (
    MODELE,
    _attendre,
    _cases,
    _corps,
    _habiller,
    _personnage,
    _piece,
    _projet,
    _total,
    habiller,
)


# ── Ce que le rejeu doit retrouver ──────────────────────────────────────────


def _octets(client, identifiant: str) -> bytes:
    """Le **brut** de l'asset, pas son rendu : c'est lui que le rejeu réécrit."""
    return client.get(f"/api/assets/{identifiant}/image?brut=1").content


def _fiche(client, identifiant: str) -> dict:
    return client.get(f"/api/assets/{identifiant}").json()


def _entrees(client, personnage: str, piece: str) -> list[dict]:
    """Une entrée par case, dans l'ordre de la matrice."""
    return [case["calques"][piece][0] for case in _cases(client, personnage)]


def _recaler(client, identifiant: str):
    return client.post(f"/api/assets/{identifiant}/realign")


def _planche_de(atelier, identifiant: str) -> tuple[str, bytes]:
    """Le chemin et les octets de la planche payée dont cette image est sortie."""
    asset = atelier.assets.lire(identifiant)
    generation = atelier.base.lire(asset.generation)
    emplacement = next(e for e in generation.emplacements if e.resultat is not None)
    chemin = emplacement.resultat.fichier
    return chemin, atelier.fichiers.lire(chemin)


def _rangs(atelier, identifiant: str) -> list[int]:
    asset = atelier.assets.lire(identifiant)
    return sorted(atelier.base.rangs_de_generation(asset.generation))


# ── Les critères ─────────────────────────────────────────────────────────────


def test_le_recalage_se_rejoue_depuis_la_planche_sans_un_centime(client, double, atelier):
    """Le brut d'un calque abîmé revient tel que la planche le dit — donc il en
    sort —, et **le journal du projet ne bouge pas d'un centime**."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]
    attendu = _octets(client, calque)
    total = _total(client)
    appels = double.appels

    # On abîme le brut du calque : une image unie, qui ne ressemble à rien de ce
    # que la planche contient.
    asset = atelier.assets.lire(calque)
    tampon = io.BytesIO()
    Image.new("RGBA", (asset.largeur, asset.hauteur), (255, 0, 255, 255)).save(
        tampon, format="PNG"
    )
    atelier.fichiers.ecrire_brut(asset.generation, asset.rang, tampon.getvalue(), ".png")
    assert _octets(client, calque) != attendu

    assert _recaler(client, calque).status_code == 200

    assert _octets(client, calque) == attendu
    assert _total(client) == total
    assert double.appels == appels


def test_l_asset_rejoue_garde_son_identite(client, double, atelier):
    """Identifiant, rang, label, favori et **masque** : rien de ce qui ne sort
    pas d'un calcul n'est recalculé.

    ⚠️ **`collection` sortait de cette liste avant B8.4** — `Asset.collection`,
    zéro ou une, posée sur l'image. Rejouer un calque n'a jamais eu à connaître
    les groupes de sujets qui la remplacent (`Collection.membres`, B8.1) : la
    colonne est partie, et ce que cet essai garde est la liste des champs qui
    survivent, moins un.
    """
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]
    client.put("/api/assets", json={"identifiants": [calque], "favori": True})
    client.put(f"/api/assets/{calque}/layer", json={"zone": [1, 1, 9, 9]})

    avant = _fiche(client, calque)
    assert _recaler(client, calque).status_code == 200
    apres = _fiche(client, calque)

    for champ in ("identifiant", "rang", "label", "favori", "cree_le"):
        assert apres[champ] == avant[champ], champ
    assert "collection" not in apres
    # Le masque est du travail de la main, pas un résultat de mesure : il reste.
    assert apres["recette"]["difference"]["zone"] == [1, 1, 9, 9]


def test_le_verdict_se_rejoue_pour_la_planche_entiere(client, double):
    """Une pièce déclarée « contenue » puis passée à « qui agrandit » fait
    basculer **toutes** les cases du même appel, jamais une seule."""
    personnage, poses = _personnage(client, 3)
    _corps(client, double, personnage, poses)
    piece = _piece(client, nom="cape", emplacement="dos", portee="contenue")
    # Le modèle a dézoomé, mais la pièce était déclarée contenue : la dérive
    # n'aiguille pas, et les trois cases sont sorties en calques.
    _habiller(client, double, personnage, piece, poses, echelle=0.62)
    avant = _entrees(client, personnage, piece)
    assert all(e["recette"]["difference"] is not None for e in avant)

    client.put(f"/api/characters/pieces/{piece}", json={"portee": "agrandit"})
    rejoues = _recaler(client, avant[0]["identifiant"])
    assert rejoues.status_code == 200
    assert len(rejoues.json()["assets"]) == 3

    apres = _entrees(client, personnage, piece)
    # **Un appel, une pièce, un verdict** : les trois basculent ensemble.
    assert all(e["recette"]["difference"] is None for e in apres)
    assert all(abs(e["calque"]["echelle"] - 1.0) > calc.ECHELLE_TOLEREE for e in apres)


def test_un_corps_habille_redevient_calque_sans_changer_d_identifiant(client, double):
    """Le cas du 29 août 2026 : deux corps habillés prononcés sur une échelle
    inventée. Le verdict corrigé, ils redeviennent des calques **en place** — et
    rien de ce qui les désigne ne bouge."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client, nom="cape", emplacement="dos", portee="agrandit")
    _habiller(client, double, personnage, piece, poses, echelle=0.62)

    avant = _entrees(client, personnage, piece)
    assert all(e["recette"]["difference"] is None for e in avant)
    identifiants = [e["identifiant"] for e in avant]

    # La planche, elle, était revenue à l'échelle : c'est la portée qui était
    # fausse. On la corrige, et le rejeu tire les conséquences.
    client.put(f"/api/characters/pieces/{piece}", json={"portee": "contenue"})
    assert _recaler(client, identifiants[0]).status_code == 200

    apres = _entrees(client, personnage, piece)
    assert [e["identifiant"] for e in apres] == identifiants
    assert all(e["recette"]["difference"] is not None for e in apres)
    # Et la base que chaque calque désigne est toujours un asset qui existe :
    # **aucun calque ne perd son corps**, parce qu'aucun rang neuf n'est né.
    for entree in apres:
        base = entree["recette"]["difference"]["base"]
        assert client.get(f"/api/assets/{base}").status_code == 200


def test_une_planche_absente_refuse_en_le_disant(client, double, atelier):
    """La planche est la seule chose qu'on ne sait pas refaire. Absente, le geste
    ne touche à rien — et il dit pourquoi."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]
    avant = _octets(client, calque)
    chemin, _ = _planche_de(atelier, calque)
    atelier.fichiers.supprimer(chemin)

    refus = _recaler(client, calque)
    assert refus.status_code == 409
    assert "planche" in refus.json()["raison"]
    # Rien n'a bougé : un refus qui écrirait à moitié serait pire que le défaut.
    assert _octets(client, calque) == avant


def test_aucun_rang_neuf_ne_nait_d_une_planche_deja_depliee(client, double, atelier):
    """Une planche déjà dépliée ne réaccouche jamais — c'est la moitié de la
    décision, et c'est ce qui empêche un calque de perdre sa base."""
    personnage, poses = _personnage(client, 3)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]
    rangs = _rangs(atelier, calque)
    total = len(client.get("/api/assets").json()["assets"])

    for _ in range(3):
        assert _recaler(client, calque).status_code == 200

    assert _rangs(atelier, calque) == rangs
    assert len(client.get("/api/assets").json()["assets"]) == total


def test_l_image_payee_n_est_jamais_reecrite(client, double, atelier):
    """Le brut d'un calque est un dérivé, et le rejeu le refait. La planche, elle,
    **est** l'image payée : elle sort de ce geste octet pour octet."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]
    _, avant = _planche_de(atelier, calque)
    empreinte = hashlib.sha256(avant).hexdigest()

    assert _recaler(client, calque).status_code == 200

    _, apres = _planche_de(atelier, calque)
    assert hashlib.sha256(apres).hexdigest() == empreinte


def test_reseau_coupe(client, double):
    """Le rejeu fonctionne réseau coupé — **prouvé en comptant les appels du
    double**, avant et après."""
    personnage, poses = _personnage(client, 2)
    _corps(client, double, personnage, poses)
    piece = _piece(client)
    _habiller(client, double, personnage, piece, poses)

    calque = _entrees(client, personnage, piece)[0]["identifiant"]

    double.catalogue_lisible = False
    double.echec = RuntimeError("réseau coupé")
    appels = double.appels

    assert _recaler(client, calque).status_code == 200
    assert client.get(f"/api/assets/{calque}/image").status_code == 200

    assert double.appels == appels


def test_une_image_qui_n_est_pas_sortie_d_une_planche_refuse(client, double):
    """Le geste ne s'applique qu'à ce qui est sorti d'une planche d'équipement, et
    il le dit — plutôt que de rendre une liste vide qui passerait pour un succès."""
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un tonneau"}
    ).json()
    _attendre(client, reponse["identifiant"])
    ordinaire = client.get("/api/assets").json()["assets"][0]["identifiant"]

    refus = _recaler(client, ordinaire)
    assert refus.status_code == 409
    assert "planche d'équipement" in refus.json()["raison"]
