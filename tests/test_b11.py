# -*- coding: utf-8 -*-
"""B11 — `favori`, `rang`, `supprime_le` sur une bande, et le départage à l'écran.

**Planche** : `docs/pistes-2026-09-04/carnet/Animations.dc.html`, bloquée par `B10`.

Le rangement de *Ses animations* est le report de trois colonnes qui existent
sur `Asset` depuis `T3` — `favori`, `rang`, `supprime_le` — sur `Bande`, qui ne
les avait pas. Ce fichier vérifie le report, dans l'ordre du plan :

1. **Une bande d'avant `B11` se relit sans perte** — même garde que
   `Collection.membres` avant `B8.2` : une fiche sans la clé rend un état vide,
   jamais une erreur.
2. **Retenir bascule en un geste**, et **le serveur ne départage pas lui-même**
   — décision reportée de `B10` (`docs/PIEGES.md`), documentée ici pour qu'on
   ne la redécouvre pas en la croyant absente.
3. **Écarter ne détruit pas** : la bande reste sur le disque et dans l'index,
   se restaure dans le délai de `ANNULATION_S`, et devient définitive après —
   même mécanique que `test_t3.py` pour un asset.
4. **Écarter ne touche à rien d'autre que `supprime_le`** : `prises`, `recette`
   et `chutier` — les retouches par frame — restent identiques.
5. **Une bande écartée vide sa case, comme un asset supprimé vide la sienne**
   — mais reste visible, à part, dans `bandes_ecartees` : c'est le seul champ
   nouveau que `ServiceProduction.cases` gagne dans cette tranche.

**Aucun clip n'est découpé ici**, et c'est délibéré — même choix que
`tests/test_a12.py` : ce qui se mesure est ce que la matrice et les routes
`/api/strips/...` font d'une bande, pas l'extraction vidéo. Les bandes sont
donc écrites directement dans le dépôt, comme un montage les aurait laissées.

**Pourquoi ces trois champs restent dans `contenu`, sans colonne SQL dédiée**
(`atelier/depot/base.py`, table `bandes`) : contrairement à la bibliothèque
d'assets, qui peut porter des milliers d'images et a besoin d'un `WHERE`
indexé pour les filtrer et les balayer à l'échelle, une case de ce produit ne
porte jamais plus qu'une poignée de bandes, et le dépôt entier n'en tient
jamais plus que quelques centaines. `bandes_du_personnage` et le balayage de
`ServiceMontage.purger` relisent donc `contenu` et filtrent en Python — le
même choix que `Collection.membres` avant `B8.2`, pour la même raison
d'échelle.
"""

from __future__ import annotations

import itertools
import time

from atelier.domaine.bande import Bande, Cadre, Prise
from atelier.domaine.recette import Recadrage, Recette
from atelier.services.bibliotheque import ANNULATION_S

_DISTINCTES = itertools.count(3)


# ── Le décor : un personnage, sa vue, des bandes écrites à la main ───────────


def _creer(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _vue(client, identifiant: str) -> None:
    """Déclarer la vue du jeu, donc ses directions — un seul geste (E10)."""
    reponse = client.put("/api/universe", json={"vue": identifiant})
    assert reponse.status_code == 200, reponse.text


def _cases(client, personnage: str) -> dict[str, dict]:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    chose = next(
        p for p in reponse.json()["personnages"] if p["identifiant"] == personnage
    )
    return {c["pose"]: c for c in chose["cases"]}


def _poser_une_bande(
    atelier,
    personnage: str | None = None,
    pose: str | None = None,
    direction: str | None = None,
    *,
    clip: str = "clip-paye",
    nom: str = "marche",
    prises: tuple[Prise, ...] | None = None,
    chutier: tuple[Prise, ...] = (),
    recette: Recette | None = None,
    favori: bool = False,
    rang: int = 0,
    supprime_le: float | None = None,
) -> Bande:
    """Une bande gardée, telle qu'un montage l'aurait laissée — le geste de
    `test_a12.py`, écrit dans le dépôt plutôt que produit par le découpage."""
    bande = Bande(
        identifiant=f"bande-{next(_DISTINCTES)}",
        clip=clip,
        nom=nom,
        prises=prises if prises is not None else tuple(Prise(numero=n) for n in (0, 2, 4, 6)),
        chutier=chutier,
        cadence=8.0,
        cadre=Cadre(gauche=0, sommet=0, droite=23, bas=23),
        recette=recette if recette is not None else Recette(),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
        case_largeur=24,
        case_hauteur=24,
        favori=favori,
        rang=rang,
        supprime_le=supprime_le,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


# ── « Une bande d'avant B11 se relit sans perte » ────────────────────────────


def test_une_bande_d_avant_b11_se_relit_sans_favori_sans_rang_et_pas_ecartee():
    """*Une fiche sans la clé ancienne rend un état vide, pas une erreur* — la
    garde de `Collection.membres` avant `B8.2`, reportée ici au mot près."""
    ancienne = {
        "identifiant": "bande-ancienne",
        "clip": "clip-1",
        "nom": "marche",
        "images": [0, 2, 4],
        "cadence": 8.0,
        "sens": "boucle",
    }
    bande = Bande.depuis_json(ancienne)
    assert bande.favori is False
    assert bande.rang == 0
    assert bande.supprime_le is None
    assert bande.supprime is False
    # Et rien de ce qu'elle portait déjà ne s'est perdu au passage.
    assert bande.images == (0, 2, 4)


def test_une_bande_ecrit_et_relit_ses_trois_champs(atelier):
    bande = _poser_une_bande(atelier, favori=True, rang=3, supprime_le=12.5)
    relue = atelier.base.lire_bande(bande.identifiant)
    assert relue.favori is True
    assert relue.rang == 3
    assert relue.supprime_le == 12.5
    assert relue.supprime is True


# ── « Retenir bascule en un geste », et le serveur ne départage pas lui-même ─


def test_marquer_favori_bascule_en_un_geste(client, atelier):
    personnage = _creer(client)
    une = _poser_une_bande(atelier, personnage, "marche")

    reponse = client.put(
        "/api/strips/favorite", json={"identifiants": [une.identifiant]}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["bandes"][0]["favori"] is True
    assert atelier.base.lire_bande(une.identifiant).favori is True

    # Démonter est le même geste, avec favori=false — le pendant exact de
    # `PUT /assets/favorite`.
    demonte = client.put(
        "/api/strips/favorite",
        json={"identifiants": [une.identifiant], "favori": False},
    )
    assert demonte.status_code == 200, demonte.text
    assert atelier.base.lire_bande(une.identifiant).favori is False


def test_le_serveur_ecrit_le_champ_et_ne_departage_pas_deux_bandes_peuvent_etre_favorites(
    client, atelier
):
    """⚠️ **Documente une décision, pour qu'on ne la redécouvre pas.**

    Reportée de `B10` — `docs/PIEGES.md`, le piège « `PUT /assets/favorite`
    écrit un champ et ne démote personne », qui y est une puce et non un titre :
    le renvoi le désignait par un `§`, et `essais/essai_docs.py` l'a nommé cassé
    le 9 septembre 2026. `PUT /strips/favorite` fait la même chose, et pour
    la même raison — c'est l'écran, dans `AnimationsDuSujet.tsx`, qui démonte
    les autres retenues de la rangée **avant** d'allumer la sienne. Deux
    retenues dans la même case sont donc un état atteignable côté serveur, et
    ce n'est pas un bug : c'est le prix d'un champ qui ne sert encore à aucune
    règle d'export (voir la docstring de `ServiceMontage.marquer_favori`)."""
    personnage = _creer(client)
    une = _poser_une_bande(atelier, personnage, "marche")
    autre = _poser_une_bande(atelier, personnage, "marche")

    client.put("/api/strips/favorite", json={"identifiants": [une.identifiant]})
    client.put("/api/strips/favorite", json={"identifiants": [autre.identifiant]})

    assert atelier.base.lire_bande(une.identifiant).favori is True
    assert atelier.base.lire_bande(autre.identifiant).favori is True


# ── « Écarter ne détruit pas », et se restaure dans le délai ─────────────────


def test_ecarter_une_bande_ne_la_detruit_pas_et_elle_se_restaure(client, atelier):
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")

    reponse = client.post(
        "/api/strips/delete", json={"identifiants": [bande.identifiant]}
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["annulation_s"] == ANNULATION_S
    ecartee = atelier.base.lire_bande(bande.identifiant)
    assert ecartee is not None, "elle reste sur le disque et dans l'index"
    assert ecartee.supprime_le is not None
    assert ecartee.supprime is True

    rendue = client.post(
        "/api/strips/restore", json={"identifiants": [bande.identifiant]}
    )
    assert rendue.status_code == 200, rendue.text
    assert rendue.json()["bandes"][0]["supprime_le"] is None
    assert atelier.base.lire_bande(bande.identifiant).supprime_le is None


def test_une_annulation_expiree_se_refuse_puis_le_balayage_purge_pour_de_bon(
    client, atelier
):
    """Même mécanique qu'un asset (`test_t3.py`,
    `test_une_suppression_s_annule_dans_l_instant_puis_devient_definitive`), au
    mot près : huit secondes pour revenir, puis c'est définitif — et c'est le
    balayage qui l'exécute, jamais une minuterie."""
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")

    client.post("/api/strips/delete", json={"identifiants": [bande.identifiant]})
    vieillie = atelier.base.lire_bande(bande.identifiant)
    vieillie.supprime_le = time.time() - ANNULATION_S - 1
    atelier.base.enregistrer_bande(vieillie)

    refus = client.post(
        "/api/strips/restore", json={"identifiants": [bande.identifiant]}
    )
    assert refus.status_code == 409
    assert "expiré" in refus.json()["raison"]

    assert atelier.montage.purger() == 1
    assert atelier.base.lire_bande(bande.identifiant) is None


def test_un_ecart_definitif_ne_ressuscite_pas_a_la_reouverture(client, atelier):
    """Le pendant de `test_un_supprime_definitif_ne_ressuscite_pas_au_redemarrage`
    (`test_t3.py`) : le balayage tourne aussi à l'ouverture de l'atelier, pas
    seulement sur demande."""
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")
    client.post("/api/strips/delete", json={"identifiants": [bande.identifiant]})
    vieillie = atelier.base.lire_bande(bande.identifiant)
    vieillie.supprime_le = time.time() - ANNULATION_S - 1
    atelier.base.enregistrer_bande(vieillie)

    import asyncio

    asyncio.run(atelier.ouvrir())
    assert atelier.base.lire_bande(bande.identifiant) is None


# ── « Écarter ne touche à rien d'autre que `supprime_le` » ───────────────────


def test_ecarter_ne_touche_pas_aux_prises_a_la_recette_ni_au_chutier(client, atelier):
    """*Écarter est un jugement, pas un effacement* — le motif de
    `ImagesDuSujet.tsx` porté à la bande : seul `supprime_le` change."""
    prises = (Prise(numero=0, clip="clip-paye", dx=2, dy=-1), Prise(numero=4))
    chutier = (Prise(numero=8),)
    recette = Recette(recadrage=Recadrage(marge=7))
    bande = _poser_une_bande(
        atelier, prises=prises, chutier=chutier, recette=recette
    )

    client.post("/api/strips/delete", json={"identifiants": [bande.identifiant]})

    apres = atelier.base.lire_bande(bande.identifiant)
    assert apres.prises == prises
    assert apres.chutier == chutier
    assert apres.recette.en_json() == recette.en_json()
    assert apres.cadence == bande.cadence
    assert apres.cadre == bande.cadre

    # Et la restauration ne les touche pas davantage.
    client.post("/api/strips/restore", json={"identifiants": [bande.identifiant]})
    restauree = atelier.base.lire_bande(bande.identifiant)
    assert restauree.prises == prises
    assert restauree.chutier == chutier
    assert restauree.recette.en_json() == recette.en_json()


# ── « Une bande écartée vide sa case, mais reste visible dans bandes_ecartees » ─


def test_une_bande_ecartee_vide_sa_case_mais_reste_dans_bandes_ecartees(
    client, atelier
):
    """Le pendant exact de `assets_du_personnage`, qui filtre `supprime_le IS
    NULL` avant que la matrice ne compte quoi que ce soit : une bande écartée
    ne remplit plus la case, mais l'écran qui la montre la retrouve à part."""
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")
    assert len(_cases(client, personnage)["marche"]["bandes"]) == 1
    assert _cases(client, personnage)["marche"]["bandes_ecartees"] == []

    client.post("/api/strips/delete", json={"identifiants": [bande.identifiant]})

    case = _cases(client, personnage)["marche"]
    assert case["bandes"] == [], "écartée, elle ne remplit plus la case"
    assert case["bandes_demandees"] >= 1, "la case demande toujours une animation"
    assert [b["identifiant"] for b in case["bandes_ecartees"]] == [bande.identifiant]

    # Restaurée, elle revient à sa place et quitte les écartées.
    client.post("/api/strips/restore", json={"identifiants": [bande.identifiant]})
    revenue = _cases(client, personnage)["marche"]
    assert [b["identifiant"] for b in revenue["bandes"]] == [bande.identifiant]
    assert revenue["bandes_ecartees"] == []


def test_une_bande_ecartee_range_dans_les_ecartees_de_sa_direction(client, atelier):
    """**Le même repli sur la première direction qu'une bande gardée** : une
    bande écartée avant que le jeu ne déclare ses angles ne cesse pas d'être
    orientable pour autant."""
    personnage = _creer(client)
    _vue(client, "vue-dessus-34")
    bande = _poser_une_bande(atelier, personnage, "marche", "sud")

    client.post("/api/strips/delete", json={"identifiants": [bande.identifiant]})

    case = _cases(client, personnage)["marche"]
    sud = next(d for d in case["directions"] if d["identifiant"] == "sud")
    assert sud["bandes"] == []
    assert [b["identifiant"] for b in sud["bandes_ecartees"]] == [bande.identifiant]
    autres = [d for d in case["directions"] if d["identifiant"] != "sud"]
    assert all(d["bandes_ecartees"] == [] for d in autres)
