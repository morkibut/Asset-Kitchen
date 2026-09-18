# -*- coding: utf-8 -*-
"""P1a (V3.5) — les données du dépliage : la grille écrite, le dépliage nommé.

**Ce qui se mesure ici, et rien d'autre** : que la grille d'une planche
s'enregistre au départ et se relise ensuite — la formule ne découpe plus rien de
ce qui est parti —, qu'un dépliage porte un nom, ses coupes et ses rangs, que
deux dépliages d'une même planche ne se marchent jamais dessus, et que chaque
image sortie du dépliage automatique sache de quelle planche et de quel dépliage
elle vient. Aucune route neuve, aucun écran : P1b s'en charge.

**La panne que le premier essai garde est écrite dans le plan** : *« sans quoi
changer la formule redécouperait les planches anciennes de travers »*. Le banc
des planches a mesuré qu'un 4 × 2 bat le 3 × 3 ; le jour où la formule bascule,
une planche de huit dessinée en 3 × 3 relue par déduction se couperait en 4 × 2
— et l'inverse. L'essai pose donc une génération dont la grille enregistrée
**n'est pas** celle de la formule, et vérifie qu'elle se coupe sur la sienne.
"""

from __future__ import annotations

import asyncio
import io
import json
import time

from PIL import Image, ImageDraw

from atelier.domaine.asset import Asset
from atelier.domaine.generation import Emplacement, Generation, Resultat, Statut
from atelier.domaine.pliage import (
    AUTO,
    MAIN,
    CasePliee,
    Pliage,
    geometrie,
    identifiant_de_depliage,
)
from atelier.image import grille_fixe
from atelier.image.calque import cases_de
from atelier.services.pliage import consignes

from conftest import FOND, SUJET, planche_sujets

MODELE = "essai:rend-du-png"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _huit_cases() -> tuple[CasePliee, ...]:
    return tuple(CasePliee(texte=f"case {i}", pose=f"p{i}") for i in range(8))


def _planche_en_grille(colonnes: int, lignes: int, *, case: int = 120) -> bytes:
    """Une planche dessinée **sur cette grille-là** : un sujet au centre de
    chaque case, sur le fond plat que les modèles rendent."""
    image = Image.new("RGB", (colonnes * case, lignes * case), FOND)
    dessin = ImageDraw.Draw(image)
    for ligne in range(lignes):
        for colonne in range(colonnes):
            x0, y0 = colonne * case + case // 3, ligne * case + case // 4
            dessin.rectangle([x0, y0, x0 + case // 3, y0 + case // 2], fill=SUJET)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _creer(client) -> dict:
    reponse = client.post(
        "/api/characters", json={"nom": "Le nain", "description": "un nain forgeron"}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _plan(client) -> list[dict]:
    return client.get("/api/characters").json()["plan"]


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"le lot « {identifiant} » n'est jamais arrivé à terme")


def _lot(client, double, sujets: int = 4) -> tuple[str, dict]:
    """Un lot de `sujets` poses, arrivé et déplié tout seul."""
    double.rendre = lambda: planche_sujets(sujets)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:sujets]
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un nain forgeron",
            "personnage": personnage["identifiant"],
            "poses": poses,
        },
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    return identifiant, _attendre(client, identifiant)


def _generation_sur_disque(atelier, identifiant: str) -> dict:
    chemin = atelier.fichiers.dossier_generation(identifiant) / "generation.json"
    return json.loads(chemin.read_text(encoding="utf-8"))


def _morceaux(atelier, identifiant: str) -> list[Asset]:
    return sorted(
        (
            a
            for rang in atelier.base.rangs_de_generation(identifiant)
            if rang >= 100
            for a in [atelier.base.lire_asset(f"{identifiant}-{rang}")]
            if a is not None
        ),
        key=lambda a: a.rang,
    )


# ── La grille s'écrit sur le pliage ──────────────────────────────────────────


def test_un_pliage_neuf_ecrit_la_grille_de_la_formule_du_jour():
    """**Prise à la naissance**, c'est-à-dire quand la demande se compose : la
    grille qui part est celle que la formule propose ce jour-là, et elle est
    dans le fichier avant le premier appel."""
    pliage = Pliage(cases=_huit_cases())
    forme = geometrie(8)

    assert (pliage.colonnes, pliage.lignes) == (forme.colonnes, forme.lignes)
    ecrit = pliage.en_json()
    assert (ecrit["colonnes"], ecrit["lignes"]) == (forme.colonnes, forme.lignes)


def test_une_planche_enregistree_hors_formule_se_decoupe_sur_sa_grille(atelier):
    """**Le critère du plan, prouvé.** Huit cases enregistrées en 4 × 2 ; la
    formule en donnerait 3 × 3. La planche se coupe en 4 × 2 — par le même
    chemin que le dépliage réel, `decouper_retour` —, et chaque lecteur de la
    grille lit la même chose."""
    assert (geometrie(8).colonnes, geometrie(8).lignes) != (4, 2), (
        "la formule donne déjà 4 × 2 : l'essai ne distinguerait plus rien — "
        "choisir une autre grille enregistrée"
    )
    ecrit = Pliage(cases=_huit_cases(), geometrie_connue=True).en_json()
    ecrit.update(colonnes=4, lignes=2)
    pliage = Pliage.depuis_json(json.loads(json.dumps(ecrit)))
    assert pliage is not None
    assert (pliage.geometrie.colonnes, pliage.geometrie.lignes) == (4, 2)

    octets = _planche_en_grille(4, 2)
    chemin = atelier.fichiers.ecrire_brut("p1a-grille", 0, octets, ".png")
    generation = Generation(
        identifiant="p1a-grille",
        modele=MODELE,
        demande={},
        parametres_resolus={},
        pliage=pliage,
        emplacements=[
            Emplacement(
                rang=0,
                statut=Statut.REUSSIE,
                resultat=Resultat(
                    fichier=chemin,
                    largeur=480,
                    hauteur=240,
                    type_media="image/png",
                    octets=len(octets),
                ),
            )
        ],
    )

    morceaux, mesures = atelier.pliage.decouper_retour(
        generation, generation.emplacements[0]
    )

    attendues = grille_fixe(480, 240, 4, 2)
    assert [m.boite for m in mesures] == attendues
    assert all(Image.open(io.BytesIO(m)).size == (120, 120) for m in morceaux)
    # Les autres lecteurs de la grille passent par la même propriété.
    assert cases_de(480, 240, pliage.geometrie) == attendues
    assert "4 columns and 2 rows" in consignes(pliage)


def test_une_generation_sans_grille_ecrite_retombe_sur_la_deduction():
    """Le seul cas où la formule sert encore à relire : un fichier qui ne porte
    pas la grille, ou qui en porte une qui ne tient pas ses cases."""
    ecrit = Pliage(cases=_huit_cases()).en_json()
    forme = geometrie(8)

    sans = {k: v for k, v in ecrit.items() if k not in ("colonnes", "lignes")}
    relu = Pliage.depuis_json(sans)
    assert relu is not None
    assert (relu.geometrie.colonnes, relu.geometrie.lignes) == (forme.colonnes, forme.lignes)

    abimee = {**ecrit, "colonnes": 2, "lignes": 2}  # quatre places pour huit cases
    relu = Pliage.depuis_json(abimee)
    assert relu is not None
    assert (relu.geometrie.colonnes, relu.geometrie.lignes) == (forme.colonnes, forme.lignes)


def test_la_grille_relue_survit_a_un_aller_retour_disque():
    ecrit = Pliage(cases=_huit_cases()).en_json()
    ecrit.update(colonnes=4, lignes=2)
    une = Pliage.depuis_json(ecrit)
    assert une is not None
    deux = Pliage.depuis_json(json.loads(json.dumps(une.en_json())))
    assert deux is not None
    assert (deux.colonnes, deux.lignes) == (4, 2)


# ── Un dépliage nommé, et la règle des rangs ─────────────────────────────────


def test_deux_depliages_dune_planche_ne_partagent_aucun_rang():
    """**La règle dont P1b hérite.** Un dépliage prend ses rangs d'un seul
    tenant au-dessus de tout ce qui a été réservé ; le service a beau lui
    proposer un rang plus bas, il ne descend pas sur celui d'un autre."""
    pliage = Pliage(cases=_huit_cases())
    coupes = tuple((i, 0, i + 9, 9) for i in range(0, 80, 10))

    premier = pliage.reserver("g-0", coupes, 100, origine=AUTO)
    second = pliage.reserver("g-0", coupes[:3], 100, origine=MAIN)

    assert premier.rangs == tuple(range(100, 108))
    assert second.rangs == (108, 109, 110)
    assert not set(premier.rangs) & set(second.rangs)
    assert (premier.numero, second.numero) == (1, 2)
    assert premier.identifiant == identifiant_de_depliage("g-0", 1) == "g-0-d1"
    assert (premier.origine, second.origine) == (AUTO, MAIN)
    assert pliage.rangs_reserves == frozenset(range(100, 111))


def test_le_depliage_automatique_est_unique_par_planche():
    """Le réserver deux fois — une reprise après une fermeture — retombe sur
    le même numéro et les mêmes rangs : c'est ce qui rend la reprise
    idempotente."""
    pliage = Pliage(cases=_huit_cases())
    coupes = tuple((0, 0, 9, 9) for _ in range(8))

    une = pliage.reserver("g-0", coupes, 100)
    deux = pliage.reserver("g-0", coupes, 140)

    assert deux is une
    assert len(pliage.depliages) == 1
    assert deux.rangs == tuple(range(100, 108))


def test_un_depliage_se_relit_tel_quil_a_ete_ecrit():
    pliage = Pliage(cases=_huit_cases())
    pliage.reserver("g-0", ((1, 2, 3, 4),) * 8, 100, cree_le=12.5)
    pliage.reserver("g-0", ((5, 6, 7, 8),), 100, origine=MAIN, cree_le=13.5)

    relu = Pliage.depuis_json(json.loads(json.dumps(pliage.en_json())))

    assert relu is not None
    assert [d.en_json() for d in relu.depliages] == [
        d.en_json() for d in pliage.depliages
    ]


# ── Chaque image dit d'où elle vient ─────────────────────────────────────────


def test_le_depliage_automatique_cree_le_depliage_numero_un(client, atelier, double):
    """**Le premier dépliage reste automatique** — aucun geste de plus —, et il
    laisse maintenant une trace : son nom, ses coupes, ses rangs, écrits dans
    le fichier de la génération, et un lien sur chaque image."""
    identifiant, vue = _lot(client, double)
    assert vue["statut"] == "reussie"

    planche = f"{identifiant}-0"
    ecrit = _generation_sur_disque(atelier, identifiant)["pliage"]["depliages"]
    assert len(ecrit) == 1
    (depliage,) = ecrit
    assert depliage["numero"] == 1
    assert depliage["origine"] == AUTO
    assert depliage["planche"] == planche
    assert depliage["identifiant"] == f"{planche}-d1"

    morceaux = _morceaux(atelier, identifiant)
    assert [a.rang for a in morceaux] == depliage["rangs"]
    assert {a.planche for a in morceaux} == {planche}
    assert {a.depliage for a in morceaux} == {depliage["identifiant"]}
    # Les coupes sont les boîtes que le lot a mesurées, dans le même ordre.
    assert [list(a.lot.boite) for a in morceaux] == depliage["coupes"]
    # **Et le lien n'est pas `parent`** : la galerie et le rejeu du recalage
    # lisent `parent` comme « dérivée d'une autre image ».
    assert all(a.parent is None for a in morceaux)
    # La planche, elle, ne se désigne pas elle-même.
    feuille = atelier.base.lire_asset(planche)
    assert feuille is not None and feuille.planche is None and feuille.depliage is None


def test_le_lien_de_limage_est_ecrit_sur_son_fichier(client, atelier, double):
    """Les fichiers font foi : l'index effacé, le lien doit s'y relire."""
    identifiant, _ = _lot(client, double)
    (premier, *_) = _morceaux(atelier, identifiant)

    dossier = atelier.fichiers.dossier_generation(identifiant)
    ecrit = json.loads(
        (dossier / f"{premier.rang}-asset.json").read_text(encoding="utf-8")
    )
    assert ecrit["planche"] == f"{identifiant}-0"
    assert ecrit["depliage"] == f"{identifiant}-0-d1"


def test_la_reprise_au_demarrage_remplit_le_meme_depliage(client, atelier, double):
    """**La règle de C2 ne bouge pas**, et le dépliage ne se dédouble pas : une
    planche dont les images ont été perdues se déplie au démarrage sur le
    même dépliage n° 1, aux mêmes rangs — sans rien repayer."""
    identifiant, _ = _lot(client, double)
    avant = [a.rang for a in _morceaux(atelier, identifiant)]
    for asset in _morceaux(atelier, identifiant):
        atelier.base.oublier_asset(asset.identifiant)

    appels = double.appels
    asyncio.run(atelier.ouvrir())

    assert double.appels == appels
    apres = _morceaux(atelier, identifiant)
    assert [a.rang for a in apres] == avant
    assert {a.depliage for a in apres} == {f"{identifiant}-0-d1"}
    assert len(_generation_sur_disque(atelier, identifiant)["pliage"]["depliages"]) == 1


def test_une_decoupe_de_la_planche_prend_ses_rangs_au_dessus_des_reserves(
    client, atelier, double
):
    """Le découpeur de T5 suit la même règle : même quand les images du
    dépliage n° 1 ont disparu de l'index, leurs rangs restent pris."""
    identifiant, _ = _lot(client, double)
    reserves = [a.rang for a in _morceaux(atelier, identifiant)]
    for asset in _morceaux(atelier, identifiant):
        atelier.base.oublier_asset(asset.identifiant)

    rendu = atelier.decoupe.decouper(f"{identifiant}-0", [(0, 0, 9, 9)])

    (decoupe,) = rendu["decoupes"]
    assert decoupe["rang"] > max(reserves)


# ── Ce qui existait avant se relit sans rien casser ──────────────────────────


def test_une_image_davant_garde_la_forme_de_son_fichier():
    """Pas de migration : une image sans planche ni dépliage se relit sans eux,
    et se réécrit **sans les deux clés** — au caractère près comme avant."""
    avant = {
        "identifiant": "g-100",
        "generation": "g",
        "rang": 100,
        "brut": "g/100-brut.png",
    }
    image = Asset.depuis_json(avant)

    assert image.planche is None and image.depliage is None
    assert "planche" not in image.en_json()
    assert "depliage" not in image.en_json()


def test_un_pliage_davant_se_relit_sans_depliage_et_garde_sa_forme():
    ecrit = Pliage(cases=_huit_cases()).en_json()
    assert "depliages" not in ecrit

    relu = Pliage.depuis_json(ecrit)
    assert relu is not None
    assert relu.depliages == ()
    assert relu.rangs_reserves == frozenset()
    assert relu.en_json() == ecrit
