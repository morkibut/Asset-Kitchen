# -*- coding: utf-8 -*-
"""Les critères de U4 qui se mesurent — une place qui dort ne fait rien.

**La promesse tient en une phrase, et tout ce fichier la vérifie** : *une image
traitée avec une place en veille sort identique au pixel près à la même sans
cette place du tout.* Elle est facile à énoncer et facile à trahir — il suffit
qu'un seul chemin du dépôt lise les réglages d'une place sans lui demander si
elle dort. C'est arrivé deux fois en écrivant l'étape, et les deux sont ici :
le cache du détourage, qui se reconstruisait une recette neuve où la veille ne
montait pas, et la grille, qui regarde le détourage pour décider si le sujet
vit dans une case.

**Éteinte et vide sont deux états**, et c'est l'autre moitié : ce qui dort garde
ses réglages, les rend quand on le rallume, et se lit dans le fichier de la
recette comme n'importe quel autre champ.

Ce qui se voit — l'interrupteur de la barre, la colonne visiblement éteinte,
l'annonce quand on touche un réglage — est vérifié dans
`interface/src/App.test.tsx`. Aucun essai d'ici n'appelle le fournisseur.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.recette import (
    PLACES,
    Quantification,
    Recette,
    places_inconnues,
)
from atelier.mcp.serveur import creer_serveur
from tests.conftest import image_sujet
from tests.test_t4 import _univers_peuple
from tests.test_t7 import appeler, refuser


# ── De quoi comparer deux rendus au pixel près ───────────────────────────────


def _asset(client, double) -> str:
    """Un asset ordinaire, né d'une génération que le double sert hors ligne."""
    double.rendre = lambda: image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai/rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    return f"{generation['identifiant']}-0"


def _recette(**places) -> dict:
    """Une recette complète en JSON — les places absentes valent *vide*."""
    corps = {
        "passes": [],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "contours": None,
        "main": None,
        "veille": [],
        "nom": None,
    }
    corps.update(places)
    return corps


def _poser(client, identifiant: str, **places):
    reponse = client.put(f"/api/assets/{identifiant}/recipe", json=_recette(**places))
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _pixels(client, identifiant: str) -> np.ndarray:
    """Le rendu, en tableau. **Les octets ne suffisent pas** : deux PNG peuvent
    différer d'un bloc de métadonnées en portant les mêmes pixels, et c'est bien
    des pixels que le critère parle."""
    reponse = client.get(f"/api/assets/{identifiant}/image")
    assert reponse.status_code == 200, reponse.text
    return np.asarray(Image.open(io.BytesIO(reponse.content)).convert("RGBA"))


# **Les réglages qui servent de témoins**, un par place, choisis pour qu'ils
# changent visiblement l'image : une place dont le réglage ne fait rien
# prouverait la veille par accident.
PASSE = {
    "moteur": "bord",
    "tolerance": 28,
    "seuil_alpha": 128,
    "durcissement": 0,
    "point": None,
    "portee": "tache",
}
PLACES_TEMOINS = (
    "detourage",
    "recadrage",
    "grille",
    "quantification",
    "bords",
    "contours",
)


def _temoins(client) -> dict[str, dict]:
    """Les six témoins, dont un a besoin de l'univers ouvert.

    **La palette est lue, jamais inventée** : une quantification sans palette est
    refusée — elle se déduit des artworks du projet et de rien d'autre —, et
    écrire six couleurs à la main ici ferait de l'essai un essai sur une palette
    de fantaisie. On peuple donc l'univers d'abord, comme en T4.
    """
    _univers_peuple(client, "tous", "tous")
    palette = client.get("/api/universe").json()["univers"]["palette"]
    assert palette, "l'univers devait porter une palette"
    return {
        "detourage": {"passes": [PASSE]},
        "recadrage": {"passes": [PASSE], "recadrage": {"marge": 0, "boite": None}},
        "grille": {"grille": {"cible": 24, "occupation": 100, "ancrage": "bas"}},
        "quantification": {
            "quantification": {
                "couleurs": 4,
                "palette": list(palette),
                "tramage": "aucun",
            }
        },
        "bords": {"passes": [PASSE], "bords": {"seuil": 40, "trous": "garder"}},
        "contours": {
            "passes": [PASSE],
            "contours": {"epaisseur": 1, "couleur": "#101018", "dehors": "dehors"},
        },
    }


# ── « Une place en veille sort identique à la même sans cette place » ─────────


@pytest.mark.parametrize("place", PLACES_TEMOINS)
def test_une_place_endormie_ne_change_plus_l_image(client, double, place):
    """**Le critère central, place par place.** Deux assets nés de la même image :
    l'un porte le réglage et l'endort, l'autre ne l'a pas du tout. Les deux
    rendus doivent être le même tableau.

    Le paramétrage n'est pas de la coquetterie : le premier défaut trouvé ne
    touchait *que* le détourage, et un essai écrit sur la quantification seule
    l'aurait laissé passer.
    """
    temoin = _temoins(client)[place]
    endormi = _asset(client, double)
    absent = _asset(client, double)

    # Celui qui dort garde le réglage complet, et le nom de la place en veille.
    _poser(client, endormi, **temoin, veille=[place])
    # Celui qui l'ignore garde le reste du témoin, sans la place en question.
    _poser(client, absent, **{c: v for c, v in temoin.items() if c != _champ(place)})

    assert np.array_equal(_pixels(client, endormi), _pixels(client, absent))


def _champ(place: str) -> str:
    """Le nom du champ de la recette qui porte une place.

    Sept places, six noms qui se ressemblent et un qui ne ressemble pas : le
    détourage s'écrit `passes`, parce que c'est la seule place qui en porte
    plusieurs. La table est ici plutôt que dans le domaine parce qu'elle ne sert
    qu'à écrire ces essais-là.
    """
    return "passes" if place == "detourage" else place


def test_toutes_les_places_endormies_rendent_le_brut(client, double):
    """La forme extrême du même critère, et celle qui attrape les fuites.

    Une recette pleine dont **toutes** les places dorment doit rendre l'image
    d'origine. Si une seule place laisse traîner un effet — la grille qui pose
    encore le sujet dans sa case parce que le détourage est écrit, le cache du
    détourage qui rend un alpha que personne n'a demandé — le tableau diffère et
    l'essai le dit.
    """
    temoins = _temoins(client)
    pleine: dict = {}
    for reglages in temoins.values():
        pleine.update(reglages)

    tout = _asset(client, double)
    brut = _asset(client, double)
    _poser(client, tout, **pleine, veille=sorted(PLACES_TEMOINS))
    _poser(client, brut)

    assert np.array_equal(_pixels(client, tout), _pixels(client, brut))


def test_rallumer_retrouve_exactement_ce_qu_on_avait_pose(client, double):
    """« Recliquer la rallume, et les réglages sont ceux d'avant. »

    C'est toute la différence avec *Sans cette table ›*, qui vide la place. On
    éteint, on rallume, et on compare au rendu de départ — pas aux valeurs
    écrites dans le fichier, qui pourraient être justes pendant que le rendu ne
    l'est pas.
    """
    identifiant = _asset(client, double)
    temoin = _temoins(client)["quantification"]

    _poser(client, identifiant, **temoin)
    avant = _pixels(client, identifiant)

    _poser(client, identifiant, **temoin, veille=["quantification"])
    dort = _pixels(client, identifiant)

    apres = _poser(client, identifiant, **temoin)
    assert apres["recette"]["quantification"]["couleurs"] == 4
    assert apres["recette"]["veille"] == []
    assert not np.array_equal(avant, dort)
    assert np.array_equal(avant, _pixels(client, identifiant))


# ── « L'empreinte change quand une place s'endort » ──────────────────────────


def test_l_empreinte_change_quand_une_place_s_endort():
    """Le rendu est nommé par l'empreinte de la recette : si elle ne bougeait
    pas, on regarderait le cache d'avant en croyant avoir éteint la place. Le
    prix est nommé dans `docs/tranches/U.md` — c'est un champ de plus dans
    l'empreinte, donc un recalcul pour toutes les recettes déjà écrites, une
    fois."""
    pleine = Recette(quantification=Quantification(couleurs=4))
    endormie = pleine.endormie("quantification", True)

    assert endormie.empreinte() != pleine.empreinte()
    # Et rallumer ramène **exactement** la première empreinte, donc le rendu
    # déjà calculé : on ne paie le recalcul qu'une fois par aller-retour.
    assert endormie.endormie("quantification", False).empreinte() == pleine.empreinte()


def test_le_nom_de_la_recette_n_entre_toujours_pas_dans_l_empreinte():
    """Le champ neuf ne devait rien déranger de ce qui tenait déjà."""
    pleine = Recette(quantification=Quantification(couleurs=4))
    assert pleine.empreinte() == pleine.sans_nom().empreinte()
    nommee = Recette(quantification=Quantification(couleurs=4), nom="ma recette")
    assert nommee.empreinte() == pleine.empreinte()


# ── Éteinte et vide sont deux états ──────────────────────────────────────────


def test_endormir_ne_touche_a_rien_d_autre():
    """`endormie` rend une recette neuve et laisse la première intacte — le
    domaine est immuable, et un essai le dit plutôt que de l'espérer."""
    pleine = Recette(quantification=Quantification(couleurs=4))
    endormie = pleine.endormie("quantification", True)

    assert pleine.veille == ()
    assert endormie.veille == ("quantification",)
    assert endormie.quantification == pleine.quantification
    assert endormie.dort("quantification") and not pleine.dort("quantification")


def test_une_place_qui_n_existe_pas_ne_s_endort_pas():
    """Le domaine ne lève pas : il relit des fichiers, et une recette écrite
    avant qu'une place soit renommée doit continuer de s'ouvrir. Ce sont les
    portes d'entrée — la route et l'outil de l'agent — qui refusent."""
    pleine = Recette(quantification=Quantification(couleurs=4))
    assert pleine.endormie("quantifications", True) == pleine
    assert not pleine.dort("quantifications")
    assert places_inconnues(["quantifications", "grille"]) == ["quantifications"]
    assert places_inconnues(PLACES) == []
    assert places_inconnues(None) == []


def test_la_veille_se_relit_triee_et_sans_les_noms_inconnus():
    """Triée pour que l'empreinte ne dépende pas de l'ordre où l'on a cliqué —
    éteindre la grille puis la palette doit donner le même rendu que l'inverse."""
    lue = Recette.depuis_json(
        {"veille": ["quantification", "inventee", "grille", "quantification"]}
    )
    assert lue.veille == ("grille", "quantification")
    assert lue.en_json()["veille"] == ["grille", "quantification"]

    un_sens = Recette().endormie("grille", True).endormie("quantification", True)
    autre_sens = Recette().endormie("quantification", True).endormie("grille", True)
    assert un_sens.empreinte() == autre_sens.empreinte()


def test_la_route_refuse_une_place_inventee_en_la_nommant(client, double):
    """Perdre le nom en silence ferait croire à une place éteinte, et l'auteur
    regarderait ensuite un rendu quantifié sans comprendre pourquoi."""
    identifiant = _asset(client, double)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe", json=_recette(veille=["quantifications"])
    )
    assert reponse.status_code == 422
    assert "quantifications" in reponse.text
    assert "quantification" in reponse.text  # la liste de ce qui existe


# ── « L'agent lit et pose la veille comme n'importe quel réglage » ────────────


async def test_l_agent_pose_la_veille_et_la_relit(atelier, mcp, double, tmp_path):
    """L'outil `edit_asset` reçoit la veille dans `steps`, `get_asset` la rend
    dans `recipe`. Aucun outil neuf : la veille est un réglage de recette, pas
    une capacité à part — c'est ce que le critère demande, mot pour mot."""
    source = tmp_path / "un-sujet.png"
    source.write_bytes(image_sujet())
    importe = (await appeler(mcp, "import_asset", file_path=str(source)))["asset"]
    avant = double.appels

    pose = await appeler(
        mcp,
        "edit_asset",
        asset_id=importe["id"],
        steps={
            "grille": {"cible": 24, "occupation": 100, "ancrage": "bas"},
            "veille": ["grille"],
        },
    )
    assert pose["processed"] is True
    # La grille dort : l'image garde la taille qu'elle avait, et pas 24 px.
    assert pose["width"] != 24

    fiche = await appeler(mcp, "get_asset", asset_id=importe["id"])
    assert fiche["recipe"]["veille"] == ["grille"]
    assert fiche["recipe"]["grille"]["cible"] == 24
    assert double.appels == avant


async def test_l_agent_qui_invente_une_place_l_apprend(atelier, mcp, tmp_path):
    """Et il l'apprend **en la nommant**, avec la liste de ce qui existe — c'est
    la règle des refus du dépôt : jamais corrigé en silence, toujours dit."""
    source = tmp_path / "un-autre-sujet.png"
    source.write_bytes(image_sujet())
    importe = (await appeler(mcp, "import_asset", file_path=str(source)))["asset"]

    phrase = await refuser(
        mcp,
        "edit_asset",
        asset_id=importe["id"],
        steps={"veille": ["quantifications"]},
    )
    assert "quantifications" in phrase
    assert "grille" in phrase


@pytest.fixture
async def mcp(atelier):
    """Le serveur MCP sur un atelier ouvert — même fixture qu'en T7."""
    await atelier.ouvrir()
    return creer_serveur(atelier)
