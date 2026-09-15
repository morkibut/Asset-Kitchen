# -*- coding: utf-8 -*-
"""RP9 — la toile donne du travail : ce que le serveur doit accepter.

La tranche est d'écran ; sa sélection, ses trois gestes et l'anneau se
vérifient dans `interface/src/composants/Toile.test.tsx` et `App.test.tsx`. Ce
qui descend jusqu'ici est **une seule chose, et elle change un contrat** : une
référence posée à la main pouvait venir de la bibliothèque et de nulle part
ailleurs. Les cartes du tableau entraient par la main de l'application — les
artworks de la famille du sujet, les concept arts d'un personnage — et jamais
par un choix fait pour cet appel-là.

Depuis `RP9`, la toile en donne un lot. Quatre conséquences, une par test :

1. **`origine` voyage** — sans elle, le serveur irait chercher la carte dans la
   bibliothèque, ne la trouverait pas, et refuserait l'appel entier.
2. **Elle se nomme pour ce qu'elle est.** Une carte choisie sur la toile n'est
   ni un artwork — rien n'a été promu — ni un concept art. L'écrire « artwork
   officiel » dirait le contraire de ce qui vient de se passer, et c'est cette
   phrase-là que l'auteur lit avant de décocher.
3. **Elle ne cède pas devant le plafond du modèle.** *Ce que le produit ajoute
   de lui-même cède ; ce que l'auteur a joint ne cède jamais* — et depuis cette
   tranche, une carte peut être jointe par l'auteur.
4. **Le défaut ne bouge pas** : sans `origine`, une référence reste un asset.

**Aucun test de ce fichier ne coûte un centime** : le fournisseur est doublé.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from conftest import image

from atelier.domaine.generation import Reinjection

MODELE = "essai:rend-du-png"
GUIDE = Path(__file__).resolve().parents[1] / "essais" / "guide"


# ── De quoi poser une carte sur la toile ─────────────────────────────────────


def _planche() -> tuple[str, bytes]:
    """Une vraie image du guide, comme les essais du tableau depuis T4.

    Sautée plutôt que remplacée par un carré uni : ce fichier vérifie que des
    **octets** arrivent au bout du port, et un aplat inventé ici prouverait la
    même chose pour de mauvaises raisons.
    """
    planches = sorted(GUIDE.glob("*.png"))
    if not planches:
        pytest.skip("les planches de `essais/guide/` ne sont pas sur ce disque")
    return planches[0].name, planches[0].read_bytes()


def _carte(client) -> str:
    nom, octets = _planche()
    rendue = client.post("/api/board/paste", params={"nom": nom}, content=octets)
    assert rendue.status_code == 201, rendue.text
    return rendue.json()["carte"]["identifiant"]


def _depuis_la_toile(carte: str) -> dict:
    """Ce que l'écran envoie pour une carte choisie sur la toile.

    **En guide de style, et jamais autrement** : la bibliothèque ne connaît pas
    les cartes, donc aucune filiation ne peut en descendre.
    """
    return {"asset": carte, "role": "style", "origine": "carte"}


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "un tonneau dans ces tons", **corps},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _ligne(envoi: dict, asset: str) -> dict:
    trouvees = [l for l in envoi["images"]["lignes"] if l["asset"] == asset]
    assert len(trouvees) == 1, trouvees
    return trouvees[0]


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


# ── « Fabriquer depuis la sélection » ────────────────────────────────────────


def test_une_carte_choisie_sur_la_toile_part_vraiment_avec_l_appel(client, double):
    """Les octets de la carte arrivent au bout du port, et l'appel les garde.

    **La preuve est prise à l'arrivée, pas à l'enregistrement.** Un test qui se
    contenterait de relire `references` sur la génération vérifierait ce que le
    produit *dit* avoir envoyé — c'est la forme de défaut que ce dépôt a payée
    plus d'une fois.
    """
    double.rendre = lambda: image("PNG", (64, 64))
    carte = _carte(client)

    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un tonneau dans ces tons",
            "references": [_depuis_la_toile(carte)],
        },
    )
    assert reponse.status_code == 202, reponse.text
    faite = _attendre(client, reponse.json()["identifiant"])

    assert faite["statut"] == "reussie", faite
    # Une image est arrivée au fournisseur, et c'est celle de la carte.
    assert double.references_recues == [1]
    # Et l'appel se relit des mois après en disant d'où elle venait.
    assert faite["references"] == [
        {"asset": carte, "role": "style", "origine": "carte"}
    ]


def test_une_carte_de_la_toile_se_nomme_pour_ce_qu_elle_est(client, atelier):
    """Ni artwork, ni concept art : *carte de la toile*.

    La phrase n'est pas décorative — c'est celle que l'auteur lit avant de
    décider de retirer une image de l'envoi. La carte de ce test n'a **pas** été
    promue : rien dans l'univers ne la ferait partir toute seule, et elle part
    quand même, parce qu'elle a été choisie.
    """
    carte = _carte(client)

    ligne = _ligne(_envoi(client, references=[_depuis_la_toile(carte)]), carte)
    assert ligne["origine"] == "carte"
    assert ligne["provenance"] == "carte de la toile"
    assert ligne["ecartee_par"] is None
    # Cochée d'avance : c'est le critère de la tranche, vu du serveur.
    assert ligne["cochee"] is True

    # **Posée à la main** : le compte le dit, et c'est lui qui décide du grisé
    # d'un modèle sans place — une image que l'auteur a jointe ne cède pas.
    compte = atelier.generations.compter_references(
        atelier.bibliotheque.courant,
        "",
        (Reinjection(asset=carte, role="style", origine="carte"),),
    )
    assert compte["manuelles"] == 1
    assert compte["artworks"] == 0
    assert compte["incompressibles"] == 1


def test_une_carte_promue_et_choisie_ne_part_qu_une_fois(client):
    """Le dédoublonnage tient, et c'est le choix de l'auteur qui gagne.

    Un fournisseur qui reçoit deux fois la même image la compte deux fois dans
    son plafond de références, et la facture deux fois chez ceux qui facturent
    au jeton. Et quand les deux se recouvrent, la ligne dit *carte de la
    toile* : c'est ce qui vient de se passer, l'artwork étant vrai depuis plus
    longtemps mais n'expliquant pas le geste.
    """
    carte = _carte(client)
    promue = client.put(f"/api/board/{carte}/official", json={"officiel": True})
    assert promue.status_code == 200, promue.text

    envoi = _envoi(client, references=[_depuis_la_toile(carte)])
    assert _ligne(envoi, carte)["provenance"] == "carte de la toile"
    assert envoi["images"]["cochees"] == 1


def test_une_reference_sans_origine_reste_un_asset(client):
    """Le défaut ne bouge pas, et c'est tout ce qui protège l'existant.

    Chaque écran qui joint une image de la bibliothèque n'écrit pas `origine` —
    il n'en a jamais écrit —, et le serveur doit continuer à la chercher là où
    elle est. Un défaut qui aurait basculé du côté des cartes aurait fait
    disparaître en silence toutes les références de la bibliothèque : une carte
    introuvable est **sautée**, là où un asset manquant arrête l'appel.
    """
    ligne = _ligne(
        _envoi(client, references=[{"asset": "inexistant", "role": "reference"}]),
        "inexistant",
    )
    assert ligne["origine"] == "asset"
    assert ligne["provenance"] == "réinjection"
