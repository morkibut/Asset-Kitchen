# -*- coding: utf-8 -*-
"""B16 — les six contradictions tranchées, et le plafond qui tombe.

**Planches** : `docs/pistes-2026-09-04/carnet/Retouche.dc.html` et les dix
`atelier-*.dc.html`. Bloquée par `B0`.

Cette tranche n'ajoute **aucun moteur** — c'est le périmètre de `B17` et `B18`.
Elle range la chaîne de retouche, elle nomme les deux tables que personne
n'avait relevées, et elle tranche six contradictions que le relevé a trouvées en
confrontant les fiches entre elles. Chacune a son essai ici, et l'arbitrage
retenu est écrit dans `docs/tranches/V4.md` § B16.

**Trois de ces essais mesurent une absence**, et chacun nomme ce qui la
justifie — sans quoi un essai qui fige une absence protège la panne au lieu du
produit (`docs/PIEGES.md`, le corollaire du piège de `D5`) :

- *rien n'interrompt un calcul de retouche* — la route est synchrone, et un
  bouton qui aurait l'air d'annuler ne ferait que cesser d'écouter ;
- *`atelier/domaine/fond.py` n'est lu ni par la recette ni par le traitement* —
  la couleur déclarée du jeu est un moteur qui manque, et il appartient à
  `B18` ; le jour où il arrive, cet essai tombe et l'écran doit changer avec ;
- *aucune route de retouche n'expose d'annulation*.

⚠️ **Aucun essai de ce fichier ne coûte un centime** : le fournisseur est le
double de `tests/conftest.py`, comme partout ailleurs.
"""

from __future__ import annotations

import io
import inspect

import numpy as np
import pytest
from PIL import Image

from atelier.domaine import recette as domaine_recette
from atelier.domaine.recette import (
    Bords,
    Contour,
    Grille,
    Passe,
    Recadrage,
    Recette,
    PLACES,
)
from atelier.image import traitement as domaine_traitement
from atelier.services.assets import CIBLE_MAX, CIBLE_MIN
from tests.conftest import image_sujet


# ── Les images de l'essai ────────────────────────────────────────────────────


def _image_avec_sujet(
    largeur: int = 40,
    hauteur: int = 40,
    boite: tuple[int, int, int, int] = (10, 6, 29, 33),
) -> bytes:
    """Un rectangle opaque sur un fond plat, à des coordonnées connues.

    Le même que celui de `tests/test_u2.py`, et pour la même raison : le fond
    est uniforme et différent du sujet, donc le détourage par remplissage depuis
    le bord rend une boîte du sujet égale à `boite` au pixel près.
    """
    tableau = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    tableau[:, :, :3] = (14, 18, 22)
    tableau[:, :, 3] = 255
    x0, y0, x1, y1 = boite
    tableau[y0 : y1 + 1, x0 : x1 + 1, :3] = (220, 150, 90)
    sortie = io.BytesIO()
    Image.fromarray(tableau, "RGBA").save(sortie, format="PNG")
    return sortie.getvalue()


def _image_opaque(cote: int = 32) -> bytes:
    """Une image pleine, sans un pixel de transparence — **une tuile de
    terrain**. C'est le cas qui tranche la cinquième contradiction : elle
    remplit son carré, donc elle n'a pas de bord de sujet à border."""
    tableau = np.full((cote, cote, 4), 255, dtype=np.uint8)
    tableau[:, :, :3] = (80, 120, 60)
    sortie = io.BytesIO()
    Image.fromarray(tableau, "RGBA").save(sortie, format="PNG")
    return sortie.getvalue()


PASSE_DU_BORD = {
    "moteur": "bord",
    "tolerance": 28,
    "seuil_alpha": 128,
    "durcissement": 0,
    "point": None,
    "portee": "tache",
}


def _asset(client, double, octets: bytes | None = None) -> dict:
    double.rendre = lambda: octets if octets is not None else image_sujet()
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _recette(**places) -> dict:
    corps = {
        "passes": [],
        "recadrage": None,
        "grille": None,
        "quantification": None,
        "bords": None,
        "contours": None,
        "retournement": None,
        "main": None,
        "veille": [],
        "nom": None,
    }
    corps.update(places)
    return corps


def _poser(client, identifiant: str, **places):
    return client.put(f"/api/assets/{identifiant}/recipe", json=_recette(**places))


def _spots(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}/spots")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _chemins_de_la_retouche() -> set[str]:
    """Tous les chemins que les routeurs de la retouche déclarent.

    **Lu sur les routeurs, pas sur l'application montée** — c'est la façon de
    faire du dépôt (`tests/test_b15.py`), et elle a une raison : l'API est
    montée sur l'application, et lire `application.routes` ne rend que les sept
    entrées du premier étage. Un essai d'absence qui regarde au mauvais endroit
    passe sans rien mesurer, ce qui est pire que pas d'essai du tout."""
    from atelier.api.production import routeur as routeur_production
    from atelier.api.routes import routeur

    return {
        getattr(route, "path", "")
        for r in (routeur, routeur_production)
        for route in r.routes
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1 · « Six traitements d'un côté, huit tables de l'autre »
#
# **Arbitrage : il y a huit tables qui posent sur les pixels, et la chaîne en
# compte neuf places.** Les planches en dessinent sept et mettent *Retourner* à
# part sous « n'existe pas » ; c'était vrai le 4 septembre, et `B1` a livré le
# retournement depuis. Le contour et la différence, eux, existaient déjà et
# n'étaient nommés dans aucun document du dépôt.
# ─────────────────────────────────────────────────────────────────────────────


def test_les_neuf_places_de_la_chaine_sont_celles_que_le_domaine_declare():
    """**Le compte de référence, écrit une fois.** Neuf places, dont deux que
    personne n'avait relevées : le contour et la différence."""
    assert PLACES == (
        "detourage",
        "difference",
        "recadrage",
        "grille",
        "quantification",
        "bords",
        "contours",
        "retournement",
        "main",
    )
    # Les deux jamais relevées sont bien là, et ce sont des places comme les
    # autres : elles s'endorment, elles se sérialisent, elles ont un défaut.
    assert "contours" in PLACES
    assert "difference" in PLACES


def test_le_contour_existe_marche_et_change_l_image(client, double):
    """⚠️ **La première des deux tables jamais relevées.** Elle n'était nommée
    dans aucun document ; elle est pourtant écrite, bornée et appliquée.

    L'essai ne se contente pas de la poser : il vérifie qu'elle **change
    l'image**, parce qu'une place documentée et inerte serait exactement le
    défaut que la quatrième contradiction répare."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(client, asset["identifiant"], passes=[PASSE_DU_BORD])
    sans = client.get(f"/api/assets/{asset['identifiant']}/image").content

    reponse = _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        contours={
            "epaisseur": 2,
            "couleur": "#000000",
            "position": "externe",
            "trous": "cercles",
        },
    )
    assert reponse.status_code == 200, reponse.text
    avec = client.get(f"/api/assets/{asset['identifiant']}/image").content

    assert avec != sans
    # **Le seul réglage de la chaîne qui change la taille du rendu** : dehors,
    # la silhouette grandit de deux fois l'épaisseur sur chaque dimension.
    assert Image.open(io.BytesIO(avec)).size != Image.open(io.BytesIO(sans)).size


def test_la_difference_est_la_seule_place_qui_ne_passe_pas_par_la_queue():
    """⚠️ **La seconde table jamais relevée, et ce qui la rend particulière.**

    Les huit autres s'appliquent dans `traitement.queue` ; la différence, elle,
    est calculée par le **service** (`calque.differencier`, appelé depuis
    `ServiceAssets`). C'est pour ça que personne ne l'avait relevée en lisant le
    traitement, et c'est aussi pourquoi elle vit à droite du trait à l'écran :
    elle nomme deux images, et une table n'en règle qu'une.

    L'essai lit le code plutôt qu'un comportement : c'est *l'endroit* du calcul
    qui est le fait, et il se démentirait en silence si quelqu'un déplaçait la
    différence dans la queue sans changer l'écran."""
    # La queue, plus le recadrage qu'elle délègue à `avant_la_grille` : les huit
    # autres places s'appliquent là, et nulle part ailleurs.
    source = inspect.getsource(domaine_traitement.queue) + inspect.getsource(
        domaine_traitement.avant_la_grille
    )
    for place in (
        "RECADRAGE",
        "GRILLE",
        "QUANTIFICATION",
        "BORDS",
        "CONTOURS",
        "RETOURNEMENT",
        "LA_MAIN",
    ):
        assert place in source, f"{place} devrait s'appliquer dans le traitement"
    assert "DIFFERENCE" not in source
    # Et elle est bien calculée ailleurs, pas nulle part.
    from atelier.image import calque

    assert callable(calque.differencier)
    assert "difference" in inspect.signature(calque.differencier).parameters


# ─────────────────────────────────────────────────────────────────────────────
# 2 · « Peut-on annuler un calcul ? »
#
# **Arbitrage : non, et on n'en offre pas l'illusion.** La route est synchrone,
# le calcul a lieu dans le gestionnaire de requête, et couper la connexion
# n'arrêterait pas la machine. Ce qui se défait, c'est le réglage.
# ─────────────────────────────────────────────────────────────────────────────


def test_aucune_route_de_retouche_n_expose_d_annulation():
    """**Un essai d'absence, mesuré sur la table de routage.**

    C'est la seule façon de dire *il n'existe aucun chemin* plutôt que *je n'en
    ai pas écrit*. Si une annulation apparaît un jour, elle doit être
    délibérée : soit le calcul devient une tâche qu'on peut vraiment
    interrompre, soit rien. Cet essai tombe dans les deux cas, et c'est ce qu'on
    lui demande."""
    routes = _chemins_de_la_retouche()
    assets = {c for c in routes if "/assets" in c}
    assert assets, "les routes d'assets doivent exister"
    # La retouche elle-même est bien là — sans quoi l'absence ne prouve rien.
    assert "/assets/{identifiant}/recipe" in assets
    interruptions = {
        chemin
        for chemin in assets
        if any(mot in chemin for mot in ("cancel", "abort", "annul", "interrompre"))
    }
    assert interruptions == set()


def test_poser_une_recette_repond_apres_le_calcul_et_non_avant(client, double):
    """**C'est ce qui rend l'annulation impossible, et c'est voulu** : la
    réponse porte déjà l'empreinte du rendu. Une route qui répondrait avant le
    calcul rendrait une image que l'écran devrait aller rechercher, et c'est
    exactement ce que le dépôt a refusé (`atelier/api/routes.py`)."""
    asset = _asset(client, double, _image_avec_sujet())
    reponse = _poser(client, asset["identifiant"], passes=[PASSE_DU_BORD])
    assert reponse.status_code == 200, reponse.text
    charge = reponse.json()
    # Le rendu est déjà calculé au retour : largeur et empreinte sont posées.
    assert charge["empreinte"]
    assert charge["rendu_largeur"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# 3 · « La marge du recadrage reste active quand une case est posée »
#
# **Arbitrage : la marge se grise pour de bon, et sur la vraie condition.**
# L'écran la dérivait de `recette.grille != null` — faux dans trois cas. La
# règle vit une seule fois, dans `Recette.marge_sans_effet`, et le serveur la
# rend avec les mesures du recadrage.
# ─────────────────────────────────────────────────────────────────────────────


def _grille(**suite) -> dict:
    corps = {
        "cible": 64,
        "occupation": 100,
        "ancrage": "bas",
        "decalage": 0,
        "methode": "proche",
    }
    corps.update(suite)
    return corps


def test_la_marge_ne_change_rien_quand_une_case_s_applique(client, double):
    """**La mesure du 30 août 2026, refaite ici** : marge 0 et marge 40 rendent
    le même fichier à l'octet près. C'est le fait sur lequel tout le reste de
    cette contradiction repose."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 0, "boite": None},
        grille=_grille(),
    )
    sans_marge = client.get(f"/api/assets/{asset['identifiant']}/image").content

    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 40, "boite": None},
        grille=_grille(),
    )
    avec_marge = client.get(f"/api/assets/{asset['identifiant']}/image").content

    assert sans_marge == avec_marge


def test_la_marge_agit_bel_et_bien_quand_aucune_case_ne_s_applique(client, double):
    """**Le revers de la mesure précédente**, et c'est lui qui rend la
    condition de l'écran fausse : sans grille, la marge change le rendu."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 0, "boite": None},
    )
    sans_marge = client.get(f"/api/assets/{asset['identifiant']}/image").content

    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 6, "boite": None},
    )
    avec_marge = client.get(f"/api/assets/{asset['identifiant']}/image").content

    assert sans_marge != avec_marge


def test_marge_sans_effet_est_faux_dans_les_trois_cas_ou_l_ecran_disait_vrai():
    """⚠️ **Le cœur de l'arbitrage.** `recette.grille != null` répondait *vrai*
    dans trois situations où la marge agit encore. La règle du domaine tient
    compte des trois conditions que `traitement.queue` applique vraiment : une
    grille **posée**, **éveillée**, et un détourage qui **agit**."""
    passe = Passe(moteur="bord", tolerance=28)
    grille = Grille(cible=64)

    # Le cas normal : les trois conditions réunies, la case avale la marge.
    posee = Recette(passes=(passe,), recadrage=Recadrage(marge=8), grille=grille)
    assert posee.marge_sans_effet() is True

    # 1. La grille est posée mais **endormie** : `queue` ne la joue pas.
    endormie = posee.endormie("grille", True)
    assert endormie.marge_sans_effet() is False

    # 2. La grille est posée mais **aucune passe n'agit** : `sur_grille` reçoit
    #    alors `case=False` et fait une homothétie de l'image entière.
    sans_passe = Recette(recadrage=Recadrage(marge=8), grille=grille)
    assert sans_passe.marge_sans_effet() is False

    # 2 bis. Et la même chose quand la passe existe mais dort.
    detourage_endormi = posee.endormie("detourage", True)
    assert detourage_endormi.marge_sans_effet() is False

    # 3. Aucune grille du tout : la marge agit, évidemment.
    sans_grille = Recette(passes=(passe,), recadrage=Recadrage(marge=8))
    assert sans_grille.marge_sans_effet() is False


def test_le_serveur_rend_la_condition_de_la_marge_avec_les_mesures(client, double):
    """**C'est le serveur qui coupe, jamais l'écran.** La règle est calculée une
    fois, dans le domaine, et voyage avec les mesures du recadrage — la même
    répartition que la boîte du sujet et la part jetée."""
    asset = _asset(client, double, _image_avec_sujet())

    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 8, "boite": None},
    )
    assert _spots(client, asset["identifiant"])["recadrage"]["marge_sans_effet"] is False

    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 8, "boite": None},
        grille=_grille(),
    )
    assert _spots(client, asset["identifiant"])["recadrage"]["marge_sans_effet"] is True

    # Endormir la grille rallume la marge, et le serveur le dit tout de suite.
    _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        recadrage={"marge": 8, "boite": None},
        grille=_grille(),
        veille=["grille"],
    )
    assert _spots(client, asset["identifiant"])["recadrage"]["marge_sans_effet"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 4 · « Le nettoyage affiche 3 et pose 0 »
#
# **Arbitrage : la valeur de départ est zéro, partout, et une place qui n'agit
# pas ne remplit rien.**
# ─────────────────────────────────────────────────────────────────────────────


def test_un_seuil_de_zero_n_efface_rien_et_ne_remplit_pas_la_recette():
    """⚠️ **Le second morceau de la contradiction, et le vrai.** Le 3 affiché
    était un défaut d'écran ; celui-ci était un défaut du domaine.

    `nettoyer` sort sans rien faire sous un seuil de zéro — et pourtant la
    recette se disait **non vide**, donc un rendu était calculé, mis en cache et
    l'asset épinglé pour une image identique au brut.

    C'est l'invariant `E3` appliqué là où il ne l'était pas : *une place compte
    quand elle change l'image, pas quand elle figure dans la recette.*"""
    assert Recette(bords=Bords(aire_min=0)).vide is True
    assert Recette(bords=Bords(aire_min=3)).vide is False
    # ⚠️ **Ce n'est pas la veille**, et les deux gestes restent distincts : la
    # place est bien écrite, elle se relit, elle s'endort — c'est sa *valeur*
    # qui ne fait rien.
    assert Recette(bords=Bords(aire_min=0)).bords == Bords(aire_min=0)


def test_un_seuil_de_zero_rend_le_brut_a_l_octet_pres(client, double):
    """**Le fait mesuré, derrière la propriété.** Un nettoyage à zéro laisse
    l'image telle qu'elle est arrivée — et l'atelier sert alors le fichier
    d'origine, sans cache."""
    asset = _asset(client, double, _image_avec_sujet())
    brut = client.get(f"/api/assets/{asset['identifiant']}/image?brut=1").content

    reponse = _poser(client, asset["identifiant"], bords={"aire_min": 0})
    assert reponse.status_code == 200, reponse.text
    assert client.get(f"/api/assets/{asset['identifiant']}/image").content == brut
    # **Rien n'a été mis en cache** : `traite` dit *y a-t-il autre chose à
    # montrer que le brut ?*, et le rendu n'a pas de dimensions parce qu'il
    # n'existe pas. ⚠️ Ce n'est pas `empreinte` qu'il faut lire : celle du JSON
    # est l'empreinte **de la recette**, pas du fichier, et elle vaut toujours
    # quelque chose (`atelier/domaine/asset.py`, `en_json`).
    charge = reponse.json()
    assert charge["traite"] is False
    assert charge["rendu_largeur"] == 0 and charge["rendu_hauteur"] == 0


def test_les_deux_tables_lisent_la_meme_absence_comme_un_zero():
    """**Deux écrans du même atelier ne disaient pas la même chose de « rien de
    posé »** : le nettoyage lisait 3, les contours lisaient 0, et les taches
    étaient comptées avec deux seuils différents.

    Le domaine n'a jamais dit que zéro : c'est le défaut de `Bords`, et c'est
    aussi ce qu'`Univers.recette_de` pose — c'est-à-dire rien du tout."""
    assert Bords().aire_min == 0
    # Et l'écran le lit désormais des deux côtés : `?? 0` dans `PanneauBords`
    # comme dans `PanneauContours`. C'est un fait de fichier, donc il se
    # vérifie sur le fichier — un commentaire ne tient rien.
    from pathlib import Path

    retouche = (
        Path(__file__).resolve().parent.parent
        / "interface"
        / "src"
        / "composants"
        / "Retouche.tsx"
    ).read_text(encoding="utf-8")
    assert "aire_min ?? 3" not in retouche
    # ⚠️ **Un seul lecteur depuis `B26`, et non deux.** Le second était le
    # panneau du contour, qui retranchait du compte des taches celles que le
    # seuil efface. Ce compte lit `mesures.taches`, que le poste du carnet ne
    # rend pas : il est parti avec l'ancien châssis, et il est écrit comme
    # perdu dans `docs/PLAN-carnet.md` § `B27`. La divergence que cet essai
    # ferme — un écran qui lit 3 quand l'autre lit 0 — ne peut donc plus se
    # produire ; ce qui reste à tenir, c'est que le lecteur survivant lise 0.
    assert retouche.count("recette.bords?.aire_min ?? 0") == 1


# ─────────────────────────────────────────────────────────────────────────────
# 5 · « Un décor a-t-il un contour ? »
#
# **Arbitrage : on ne demande pas la famille, on regarde l'image.** Les deux
# relevés se disputaient sur la famille ; le code n'a jamais raisonné là-dessus.
# ─────────────────────────────────────────────────────────────────────────────


def test_une_image_entierement_opaque_n_a_pas_de_bord_de_sujet(client, double):
    """**Une tuile d'herbe qui remplit son carré.** Elle est opaque, donc il n'y
    a pas de bord de sujet à border — seulement les quatre bords du cadre.

    Le critère est la mesure, jamais la famille : la même règle vaut pour un
    décor plein cadre et pour une tuile, et elle **ne vaut pas** pour un moulin
    détouré, qui porte de la transparence."""
    asset = _asset(client, double, _image_opaque())
    # ⚠️ **Un asset naît avec une recette** — `Univers.recette_de` lui pose un
    # détourage, un recadrage et une grille dès sa naissance. La mesure se prend
    # donc sur l'image telle qu'elle est arrivée : sans passe, rien n'est
    # transparent, et c'est le fait qu'on veut.
    _poser(client, asset["identifiant"], passes=[])
    assert _spots(client, asset["identifiant"])["opaque"] is True


def test_un_sujet_detoure_a_bien_un_bord_a_border(client, double):
    """**Le moulin, en face de la tuile.** La même table, la même règle, et une
    réponse opposée — parce que c'est l'image qui décide."""
    asset = _asset(client, double, _image_avec_sujet())
    _poser(client, asset["identifiant"], passes=[PASSE_DU_BORD])
    assert _spots(client, asset["identifiant"])["opaque"] is False


def test_la_disponibilite_du_contour_ne_lit_aucune_famille():
    """⚠️ **L'arbitrage lui-même, figé.** Le grisé du contour se décide sur
    `opaque`, et rien dans la mesure ne connaît la famille d'une image.

    Si quelqu'un fait entrer la famille dans cette décision, cet essai tombe —
    et c'est précisément ce qu'on veut : ce serait la faute que les deux relevés
    ont commise, et elle doit se payer à l'écriture, pas à l'usage."""
    from pathlib import Path

    # `indisponible` a quitté l'ancien châssis en `B26` pour le module de
    # vocabulaire : c'est un fait du domaine, pas du balisage.
    tables = (
        Path(__file__).resolve().parent.parent / "interface" / "src" / "recette.ts"
    ).read_text(encoding="utf-8")
    debut = tables.index("export function indisponible(")
    fin = tables.index("// ── La veille", debut)
    # ⚠️ **On lit le code, pas les commentaires.** Le corps de cette fonction
    # *parle* de la famille, et longuement : c'est là qu'est écrit pourquoi le
    # retournement ne se grise pas encore dessus. Un essai qui refuserait le mot
    # refuserait l'explication au lieu de la faute.
    regle = "\n".join(
        ligne
        for ligne in tables[debut:fin].splitlines()
        if not ligne.lstrip().startswith("//")
    )
    assert "mesures?.opaque" in regle
    for mot in ("famille", "Famille", "nature", "Nature"):
        assert mot not in regle


# ─────────────────────────────────────────────────────────────────────────────
# 6 · « La couleur de fond du jeu n'est pas lue par le détourage »
#
# **Arbitrage : c'était un moteur qui manquait, pas un défaut à réparer ici.**
# `B16` n'a ajouté aucun moteur ; `B18` l'a écrit — voir `tests/
# test_b18_detourer.py`, § 1. Cet essai-ci est tombé le jour où B18 l'a
# écrit, exactement comme son propre commentaire l'annonçait ; ce qui suit
# est sa mise à jour, pas une suppression : le domaine et le traitement
# restent découplés de `atelier/domaine/fond.py`, seule la façon de viser la
# couleur déclarée change.
# ─────────────────────────────────────────────────────────────────────────────


def test_le_traitement_vise_la_couleur_declaree_sans_importer_domaine_fond():
    """**Le moteur existe depuis B18, et le découplage tient quand même.**

    `atelier/domaine/fond.py` reste lu par le projet, la vue, la production et
    les univers — jamais par la recette ni par le traitement : la couleur
    déclarée voyage comme `Quantification.palette` avant elle, copiée dans
    `Passe.couleur_du_jeu` par le service au moment où la recette se pose, pas
    relue en direct depuis `atelier.domaine.fond` au moment du calcul.

    L'écran, lui, ne dit plus qu'il ignore la couleur déclarée : il dit que le
    moteur `bord` la devine **sauf** quand une passe la vise — ce que
    `Retouche.tsx` écrit désormais en toutes lettres."""
    for module in (domaine_recette, domaine_traitement):
        source = inspect.getsource(module)
        assert "fond import" not in source, module.__name__
        assert "domaine.fond" not in source, module.__name__

    # Et l'écran le dit, à l'endroit où l'on règle une tolérance contre cette
    # couleur-là.
    from pathlib import Path

    retouche = (
        Path(__file__).resolve().parent.parent
        / "interface"
        / "src"
        / "composants"
        / "Retouche.tsx"
    ).read_text(encoding="utf-8")
    assert "vise la couleur déclarée du jeu" in retouche


# ─────────────────────────────────────────────────────────────────────────────
# Le plafond — pas une contradiction, un mur
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("cible", [1024, 2048])
def test_un_jeu_en_style_dessin_peut_poser_une_retouche(client, double, cible):
    """⚠️ **Le mur, et il tenait tout un style hors du produit.**

    La porte d'entrée des recettes plafonnait à 512 quand le service accepte
    2 048 depuis `D2`. Comme l'écran renvoie la recette **entière** à chaque
    geste, bouger une tolérance de détourage envoyait aussi la grille : un jeu
    en dessin à 1 024 ne pouvait poser **aucune** retouche."""
    asset = _asset(client, double, _image_avec_sujet())
    reponse = _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        grille=_grille(cible=cible),
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["grille"]["cible"] == cible


def test_la_borne_de_la_route_est_celle_du_service_et_non_une_seconde():
    """⚠️ **La faute exacte, figée.** La route portait `le=512` quand le service
    accepte 2 048 : **deux bornes pour un seul fait**, et c'est toujours la plus
    basse qui gagne, en silence et par un code d'erreur que rien ne lit.

    Le remède n'est pas de monter le chiffre — ce serait refaire la même faute
    un cran plus haut — mais de faire porter à la route la **constante du
    service**. Deux nombres écrits à deux endroits finissent toujours par
    diverger ; celui-ci l'avait fait pendant six jours."""
    from atelier.api.routes import CorpsGrille

    bornes = CorpsGrille.model_fields["cible"].metadata
    minimum = next(getattr(b, "ge") for b in bornes if hasattr(b, "ge"))
    maximum = next(getattr(b, "le") for b in bornes if hasattr(b, "le"))
    assert (minimum, maximum) == (CIBLE_MIN, CIBLE_MAX)


def test_une_cible_hors_bornes_est_refusee_en_nommant_le_reglage(client, double):
    """**Un refus qui nomme la table en cause.**

    La planche reprochait au message de ne pas dire *laquelle des sept* était en
    cause. Une cible impossible est maintenant refusée en nommant le chemin du
    réglage — la grille, et sa cible — au lieu d'un refus muet sur la recette
    entière. C'est la règle écrite en tête de `atelier/services/assets.py`
    depuis `D2` : *refusée en nommant le réglage fautif, jamais ramenée en
    silence vers la borne la plus proche*."""
    asset = _asset(client, double, _image_avec_sujet())
    reponse = _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        grille=_grille(cible=CIBLE_MAX * 2),
    )
    assert reponse.status_code in (409, 422), reponse.text
    dit = reponse.text
    assert "grille" in dit and "cible" in dit
    # Et surtout : **rien n'a été ramené en silence**. La recette rangée n'a pas
    # bougé, plutôt que d'avoir été rabotée au plafond sans le dire.
    apres = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert (apres["recette"]["grille"] or {}).get("cible") != CIBLE_MAX


def test_la_table_offre_les_finesses_du_domaine_a_un_jeu_en_dessin():
    """⚠️ **L'autre moitié du plafond, celle qui est à l'écran.**

    Monter la borne de la route ne suffit pas : la table ne proposait que les
    dix tailles du pixel art (8 → 512). **Un jeu en dessin réglé sur 1024 ou
    2048 n'avait donc aucun cran à cliquer** pour appliquer sa propre finesse —
    exactement la panne que `tests/test_e8.py` avait fermée pour l'autre liste
    le 31 août 2026, rouverte un cran plus haut.

    L'essai lit la source de l'écran plutôt que de recopier les nombres : une
    troisième copie de la même liste serait la panne elle-même."""
    import re
    from pathlib import Path

    from atelier.domaine.vue import FINESSES

    vocabulaire = (
        Path(__file__).resolve().parent.parent / "interface" / "src" / "recette.ts"
    ).read_text(encoding="utf-8")
    ecrit = re.search(r"export const FINESSES = \[([^\]]*)\]", vocabulaire)
    assert ecrit is not None, "FINESSES a été renommée ou déplacée hors de recette.ts"

    assert [int(n) for n in re.findall(r"\d+", ecrit.group(1))] == [c for c, _ in FINESSES]

    # Et la table choisit bien selon le style, plutôt que d'en servir une seule.
    retouche = (
        Path(__file__).resolve().parent.parent
        / "interface"
        / "src"
        / "composants"
        / "Retouche.tsx"
    ).read_text(encoding="utf-8")
    assert "dessin ? FINESSES : CIBLES" in retouche


# ─────────────────────────────────────────────────────────────────────────────
# Les deux invariants que la tranche reconduit
# ─────────────────────────────────────────────────────────────────────────────


def test_une_place_s_eteint_sans_se_vider(client, double):
    """**Éteindre et vider ne sont pas le même geste** (lot U). Une place
    endormie garde toutes ses valeurs et se retrouve telle quelle au réveil."""
    asset = _asset(client, double, _image_avec_sujet())
    contour = {
        "epaisseur": 3,
        "couleur": "#112233",
        "position": "interne",
        "trous": "laisses",
    }
    _poser(client, asset["identifiant"], passes=[PASSE_DU_BORD], contours=contour)

    endormi = _poser(
        client,
        asset["identifiant"],
        passes=[PASSE_DU_BORD],
        contours=contour,
        veille=["contours"],
    )
    assert endormi.status_code == 200, endormi.text
    charge = endormi.json()["recette"]
    assert charge["veille"] == ["contours"]
    # ⚠️ La place est **là, entière** : c'est toute la différence avec la vider.
    assert charge["contours"] == contour


def test_une_coordonnee_ne_voyage_toujours_pas():
    """**L'invariant du lot U, reconduit.** Un cadre tracé, un point de pipette,
    une forme entourée et un décalage désignent un endroit de *cette* image-là :
    ils ne partent ni par un collage ni par une recette nommée.

    ⚠️ `B16` en dépend directement : c'est la raison pour laquelle l'écran neuf
    **montre** ces trois gestes sans les régler depuis une colonne."""
    partie = Recette(
        passes=(Passe(moteur="couleur", point=(4, 5), trace=((1, 1), (2, 2))),),
        recadrage=Recadrage(marge=7, boite=(1, 2, 3, 4)),
        grille=Grille(cible=64, decalage=9),
    )
    voyagee, laisses = domaine_recette.voyage(partie)

    assert voyagee.passes[0].point is None
    assert voyagee.passes[0].trace == ()
    assert voyagee.recadrage is not None and voyagee.recadrage.boite is None
    assert voyagee.grille is not None and voyagee.grille.decalage == 0
    # **Ce qui reste, reste entier** : on retire la coordonnée, pas la place qui
    # la portait.
    assert voyagee.recadrage.marge == 7
    assert voyagee.grille.cible == 64
    # Et le collage annonce ce qu'il n'a pas pu poser.
    assert laisses
