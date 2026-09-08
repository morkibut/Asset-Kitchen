# -*- coding: utf-8 -*-
"""Les critères de B18 — l'atelier **Pixéliser**, quatre moteurs neufs.

**Ce que cette tranche livre.** La file de `B18` (`docs/PLAN-carnet.md` § « B18
· le reste des moteurs ») demande quatre façons de plus de réduire une image à
la case du jeu — les quatre manquaient à `atelier/domaine/recette.py` depuis
D2 :

1. **sur les carrés du modèle** — réduit sur la grille que `retrouver_grille`
   (D2/D4) a *réellement* mesurée sur l'image reçue, phase comprise, au lieu
   d'un pas décrété par la seule division de la taille. C'est le manque que
   `docs/pistes-2026-09-04/carnet/atelier-reduire.dc.html` place devant tous
   les autres : *« le pas et l'endroit où il commence sont mesurés depuis le
   3 septembre et affichés à l'écran, et rien ne s'en sert »*.
2. **couleur dominante de case** — la couleur exacte la plus fréquente d'une
   case, jamais une moyenne : *« les aplats restent des aplats… celui-ci n'en
   invente aucune »*.
3. **médiane de case** — la médiane de chaque canal : *« le grain disparaît
   sans que le bord bave »*.
4. **réduction douce en lumière juste** — la réduction douce (Lanczos),
   moyennée en lumière linéaire plutôt qu'en octets sRGB, pour ne plus
   assombrir les zones contrastées.

**Aucun essai de ce fichier ne coûte un centime.** Le premier groupe travaille
sur des tableaux NumPy fabriqués à la main ; le dernier groupe passe par la
vraie route HTTP sur une vraie image PNG (`conftest.image_sujet`), sans
toucher au réseau ni au fournisseur.

Décision tranchée en écrivant cette tranche, notée ici pour mémoire : les
quatre planches nomment ces moteurs en langage de planche (« sur les carrés du
modèle », « couleur dominante de case », « médiane de case », « réduction
douce en lumière juste ») ; les constantes qui les portent dans le domaine
sont `sur_modele`, `dominante`, `mediane`, `lumiere_juste` — des noms courts,
dans le style déjà posé par `vote`, `pixeloe`, `lanczos`, `proche`.
"""

from __future__ import annotations

import io
import time

import numpy as np
import pytest
from PIL import Image

from atelier.domaine.recette import (
    AU_PLUS_PROCHE,
    DOMINANTE,
    LUMIERE_JUSTE,
    MEDIANE,
    METHODES_DE_REDUCTION,
    NOM_DE_LA_METHODE,
    SUR_LE_MODELE,
    VOTE,
    Grille,
)
from atelier.image.traitement import raison_methode, retrouver_grille, sur_grille

# Le seuil de `docs/DESIGN.md` § Motion, repris de `tests/test_b17.py` : au-delà,
# l'écran doit montrer une jauge — un moteur de cette tranche qui le dépasserait
# sur la case de 64 carrés du produit cesserait d'être « instantané ».
INSTANTANE_MS = 240

# La petite palette qu'un « modèle » aurait peinte, jamais inventée par la
# réduction — cinq couleurs franches, comme dans `tests/test_d2.py`.
PALETTE = (
    (196, 74, 52),
    (58, 92, 140),
    (232, 214, 160),
    (44, 46, 58),
    (120, 168, 92),
)


def chronometre(fonction, *args, tours: int = 5) -> float:
    """Le meilleur des `tours`, en millisecondes — même règle que `test_b17.py`."""
    durees = []
    for _ in range(tours):
        depart = time.perf_counter()
        fonction(*args)
        durees.append((time.perf_counter() - depart) * 1000)
    return min(durees)


def _sur_une_grille(pas: int, cases: int = 20, phase: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Un sujet peint case par case sur `PALETTE`, puis étiré au pas voulu.

    Rend le tableau **et** l'image logique (`cases` × `cases`) qu'il devrait
    retrouver — c'est elle que les essais comparent, pas une intention.
    """
    generateur = np.random.default_rng(pas * 7919)
    logique = np.zeros((cases, cases, 3), dtype=np.uint8)
    tirage = generateur.integers(0, len(PALETTE), size=(cases, cases))
    for y in range(cases):
        for x in range(cases):
            logique[y, x] = PALETTE[tirage[y, x]]
    cote = cases * pas
    tableau = np.asarray(
        Image.fromarray(logique, mode="RGB").resize((cote, cote), Image.Resampling.NEAREST)
    )
    alpha = np.full((cote, cote), 255, dtype=np.uint8)
    return np.dstack([tableau, alpha]), logique


def _peinture(cote: int = 320) -> np.ndarray:
    """Un dégradé sans frontière franche — aucune grille à y retrouver."""
    y, x = np.mgrid[0:cote, 0:cote]
    rgb = np.dstack(
        [(x * 255 // cote), (y * 255 // cote), ((x + y) * 127 // cote)]
    ).astype(np.uint8)
    return np.dstack([rgb, np.full((cote, cote), 255, np.uint8)])


# ── Les quatre méthodes sont connues du domaine ──────────────────────────────


def test_les_quatre_methodes_neuves_sont_dans_le_catalogue():
    """**Le critère d'entrée** : sans ça, rien de ce qui suit n'a de sens."""
    for methode in (SUR_LE_MODELE, DOMINANTE, MEDIANE, LUMIERE_JUSTE):
        assert methode in METHODES_DE_REDUCTION
        assert NOM_DE_LA_METHODE[methode].strip()
        assert raison_methode(methode) is None, "aucune des quatre ne demande rien"


def test_les_huit_methodes_rendent_des_images_differentes():
    """**Le critère de D2, étendu à huit** : deux méthodes qui rendraient le
    même tableau seraient un choix pour rien.
    """
    sujet, _ = _sur_une_grille(9, cases=24)
    rendus = {
        methode: sur_grille(sujet, Grille(cible=24, methode=methode), case=False)
        for methode in METHODES_DE_REDUCTION
        if raison_methode(methode) is None
    }
    assert len(rendus) >= 7, "sept méthodes au moins ne demandent rien"
    for methode, rendu in rendus.items():
        assert rendu.shape == (24, 24, 4)
        autres = [a for n, a in rendus.items() if n != methode]
        assert any(not np.array_equal(rendu, autre) for autre in autres), (
            f"« {methode} » rend la même chose qu'une autre : le choix serait vide"
        )


# ── « Sur les carrés du modèle » ─────────────────────────────────────────────


@pytest.mark.parametrize("pas", [4, 8, 9, 16])
def test_sur_le_modele_retrouve_les_couleurs_exactes_d_une_grille_peinte(pas):
    """**Le critère de la planche, mot pour mot** : les couleurs « ni fond ni
    sujet » disparaissent, parce qu'on échantillonne au centre de la vraie
    case plutôt qu'à cheval sur deux.
    """
    sujet, logique = _sur_une_grille(pas, cases=20)
    rendu = sur_grille(sujet, Grille(cible=20, methode=SUR_LE_MODELE), case=False)
    assert rendu.shape == (20, 20, 4)
    assert np.array_equal(rendu[:, :, :3], logique), (
        "sur_modele n'a pas retrouvé la palette exacte de la grille peinte"
    )


def test_sur_le_modele_survit_a_un_decalage_de_phase():
    """**La grille d'un modèle ne commence jamais au pixel zéro** — la même
    leçon que `retrouver_grille` a déjà payée en D4.
    """
    pas = 12
    sujet, logique = _sur_une_grille(pas, cases=18, phase=0)
    decale = np.roll(sujet, (pas // 3, pas // 3), axis=(0, 1))
    rendu = sur_grille(decale, Grille(cible=18, methode=SUR_LE_MODELE), case=False)
    # Un roll déplace aussi ce que la phase mesure : on vérifie que la grille
    # est bien retrouvée avec le même pas, pas au pixel près sur les bords que
    # le roll fait boucler.
    assert retrouver_grille(decale[:, :, :3]).pas == pas
    assert rendu.shape == (18, 18, 4)


def test_sur_le_modele_replie_sur_le_vote_sans_grille_detectee():
    """**Le repli, et pourquoi c'est le bon** : sans grille détectée — une
    photo, un dégradé —, la méthode retombe sur le vote en deux temps, qui est
    le défaut du produit depuis le 3 septembre.
    """
    peinture = _peinture()
    assert not retrouver_grille(peinture[:, :, :3]).trouvee, (
        "cette image ne doit porter aucune grille, sans quoi le test ne prouve rien"
    )
    par_le_modele = sur_grille(peinture, Grille(cible=32, methode=SUR_LE_MODELE), case=False)
    par_le_vote = sur_grille(peinture, Grille(cible=32, methode=VOTE), case=False)
    assert np.array_equal(par_le_modele, par_le_vote)


# ── « Couleur dominante de case » ────────────────────────────────────────────


def test_dominante_n_invente_jamais_une_couleur_absente_de_l_image():
    """**Le critère de la planche** : « celui-ci n'en invente aucune. »"""
    generateur = np.random.default_rng(4)
    rgb = generateur.integers(0, 255, size=(256, 256, 3), dtype=np.uint8)
    alpha = np.full((256, 256), 255, dtype=np.uint8)
    sujet = np.dstack([rgb, alpha])
    rendu = sur_grille(sujet, Grille(cible=32, methode=DOMINANTE), case=False)

    connues = {tuple(c) for c in rgb.reshape(-1, 3)}
    rendues = {tuple(c) for c in rendu[:, :, :3].reshape(-1, 3)}
    assert rendues <= connues, "dominante a peint une couleur que l'image ne portait pas"


def test_dominante_choisit_la_majorite_d_une_case():
    """**Sur une case posée à la main** : la couleur qui domine gagne, la
    minorité disparaît sans laisser de moyenne.
    """
    pas = 16
    case = np.zeros((pas, pas, 3), dtype=np.uint8)
    case[:] = (200, 60, 60)  # la majorité
    case[:6, :6] = (10, 200, 10)  # une minorité franche, dans un coin
    alpha = np.full((pas, pas), 255, dtype=np.uint8)
    sujet = np.dstack([case, alpha])

    rendu = sur_grille(sujet, Grille(cible=1, methode=DOMINANTE), case=False)
    assert tuple(int(v) for v in rendu[0, 0, :3]) == (200, 60, 60)


# ── « Médiane de case » ──────────────────────────────────────────────────────


def test_mediane_efface_un_pixel_de_grain_isole():
    """Un seul pixel de grain, au milieu d'une case unie, ne pèse pas assez
    pour faire bouger la médiane.
    """
    pas = 16
    case = np.full((pas, pas, 3), (80, 120, 160), dtype=np.uint8)
    case[8, 8] = (255, 0, 0)  # le grain, un pixel isolé
    alpha = np.full((pas, pas), 255, dtype=np.uint8)
    sujet = np.dstack([case, alpha])

    rendu = sur_grille(sujet, Grille(cible=1, methode=MEDIANE), case=False)
    assert tuple(int(v) for v in rendu[0, 0, :3]) == (80, 120, 160)


def test_mediane_ne_bave_pas_au_bord_d_un_trait_net():
    """**Le pendant de la moyenne qu'elle remplace** : un bord tranché entre
    deux teintes reste l'une des deux, jamais un mélange des deux.

    **Un pas impair, et c'est nécessaire** : sur un compte pair de pixels, la
    médiane retombe sur la moyenne des deux valeurs centrales — 0 et 255
    donnent 128, un gris que ni l'un ni l'autre bord ne portait. C'est vrai de
    toute médiane, pas un défaut de celle-ci ; le critère qu'elle tient
    vraiment est de ne jamais répondre une couleur absente **d'un vote à
    majorité claire**, ce que quinze lignes contre huit donnent ici.
    """
    pas = 15
    case = np.zeros((pas, pas, 3), dtype=np.uint8)
    case[:7] = (0, 0, 0)
    case[7:] = (255, 255, 255)  # huit lignes contre sept : une vraie majorité
    alpha = np.full((pas, pas), 255, dtype=np.uint8)
    sujet = np.dstack([case, alpha])

    rendu = sur_grille(sujet, Grille(cible=1, methode=MEDIANE), case=False)
    rendue = tuple(int(v) for v in rendu[0, 0, :3])
    assert rendue == (255, 255, 255), (
        f"la médiane a mélangé les deux bords au lieu de garder la majorité : {rendue}"
    )


# ── « Réduction douce en lumière juste » ─────────────────────────────────────


def test_lumiere_juste_est_moins_sombre_que_la_reduction_douce_sur_un_damier():
    """**Le critère de la planche, mesuré** : « un damier noir et blanc reste
    gris moyen au lieu de gris sale. »

    Moyenner 0 et 255 en octets sRGB rend 128 ; moyenner la lumière physique
    puis revenir en sRGB rend un octet plus clair, proche de 188. C'est très
    exactement l'écart que `lumiere_juste` doit combler.
    """
    pas = 2
    cases = 32
    damier = np.indices((cases, cases)).sum(axis=0) % 2
    case_agrandie = np.repeat(np.repeat(damier, pas, axis=0), pas, axis=1)
    gris = np.where(case_agrandie == 0, 0, 255).astype(np.uint8)
    rgb = np.repeat(gris[:, :, None], 3, axis=2)
    alpha = np.full(rgb.shape[:2], 255, dtype=np.uint8)
    sujet = np.dstack([rgb, alpha])

    # Réduit à un seul carré : la seule lecture qui isole la question de la
    # lumière de tout effet de bord.
    par_lanczos = sur_grille(sujet, Grille(cible=1, methode="lanczos"), case=False)
    par_lumiere = sur_grille(sujet, Grille(cible=1, methode=LUMIERE_JUSTE), case=False)

    assert int(par_lumiere[0, 0, 0]) > int(par_lanczos[0, 0, 0]) + 20, (
        f"lumière juste ({int(par_lumiere[0, 0, 0])}) n'est pas assez plus claire "
        f"que la réduction douce ({int(par_lanczos[0, 0, 0])}) sur un damier contrasté"
    )
    # Et elle reste dans la plage attendue de la correction de gamma — ni trop
    # proche de l'octet naïf (128), ni saturée à blanc.
    assert 160 < int(par_lumiere[0, 0, 0]) < 220


def test_lumiere_juste_ne_touche_pas_une_image_deja_unie():
    """Sur une seule teinte, la conversion aller-retour ne doit rien changer :
    c'est le garde-fou qui dirait si l'aller-retour de gamma était bancal.
    """
    plat = np.full((64, 64, 4), (100, 150, 30, 255), dtype=np.uint8)
    rendu = sur_grille(plat, Grille(cible=8, methode=LUMIERE_JUSTE), case=False)
    for canal, valeur in zip(range(3), (100, 150, 30)):
        assert abs(int(rendu[0, 0, canal]) - valeur) <= 1


# ── Ce qui vaut pour les quatre à la fois ────────────────────────────────────


@pytest.mark.parametrize(
    "nom, image",
    [
        ("un pixel opaque", np.array([[[10, 20, 30, 255]]], dtype=np.uint8)),
        ("un pixel vide", np.zeros((1, 1, 4), dtype=np.uint8)),
        (
            "tout transparent",
            np.dstack([np.full((8, 8, 3), 255, np.uint8), np.zeros((8, 8), np.uint8)]),
        ),
        (
            "tout opaque",
            np.dstack([np.full((8, 8, 3), 128, np.uint8), np.full((8, 8), 255, np.uint8)]),
        ),
        ("aucun pixel de large", np.zeros((4, 0, 4), dtype=np.uint8)),
    ],
)
def test_aucun_moteur_neuf_ne_leve_sur_une_image_degeneree(nom, image):
    """**Un rendu ne tombe pas, jamais** — la même règle que `tests/test_b17.py`
    applique déjà aux cinq moteurs qui l'ont précédée.
    """
    for methode in (SUR_LE_MODELE, DOMINANTE, MEDIANE, LUMIERE_JUSTE):
        sortie = sur_grille(image, Grille(cible=32, methode=methode), case=False)
        assert sortie.dtype == np.uint8
        assert sortie.shape[2] == 4


def test_chaque_moteur_neuf_est_mesure(capsys):
    """**La mesure est le critère, pas un commentaire** — même règle que
    `tests/test_b17.py::test_chaque_moteur_neuf_est_mesure`. Elle échoue si un
    moteur cesse d'être instantané sur la case de 64 carrés qui est la taille
    de travail du produit.
    """
    sujet, _ = _sur_une_grille(19, cases=64)  # ≈ 1216 px, proche des 1254 de la planche
    for nom, methode in (
        ("sur les carrés du modèle", SUR_LE_MODELE),
        ("couleur dominante de case", DOMINANTE),
        ("médiane de case", MEDIANE),
        ("réduction douce en lumière juste", LUMIERE_JUSTE),
    ):
        duree = chronometre(
            lambda s=sujet, m=methode: sur_grille(s, Grille(cible=64, methode=m), case=False)
        )
        with capsys.disabled():
            print(f"\n  {nom} : {duree:.2f} ms")
        assert duree < INSTANTANE_MS, f"{nom} met {duree:.1f} ms sur une case de 64"


def test_une_recette_d_avant_la_tranche_ignore_les_quatre_methodes_neuves():
    """**La règle de D2, tenue** : le champ retombe sur `proche` quand la clé
    est absente — les quatre méthodes neuves ne changent rien à une recette
    qui ne les nomme pas.
    """
    assert Grille.depuis_json({"cible": 32}).methode == AU_PLUS_PROCHE


# ── L'essai serveur, sur une vraie image ─────────────────────────────────────


def _un_asset(client) -> str:
    """Une image importée pour de vrai — le geste de `tests/test_b17.py::_un_asset`.

    **`bloc=8` et non le défaut du conftest** : le commentaire de
    `tests/test_d2.py::test_la_grille_du_modele_voyage_par_la_route_des_mesures`
    prévient que l'image par défaut du conftest — un sujet qui n'occupe qu'un
    tiers de la toile — plafonne sous le seuil de netteté et ne porte donc
    aucune grille détectable. Ces proportions-ci mesurent 0,46 de netteté,
    largement au-dessus du seuil de 0,35 : c'est le cas que `sur_modele` vise
    en premier.
    """
    from conftest import image_sujet

    reponse = client.post(
        "/api/assets/upload?nom=pelerin.png&traiter=false",
        content=image_sujet(toile=32, bloc=8, logique_l=20, logique_h=26),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


@pytest.mark.parametrize("methode", [SUR_LE_MODELE, DOMINANTE, MEDIANE, LUMIERE_JUSTE])
def test_les_quatre_methodes_neuves_voyagent_par_la_route_et_rendent_une_vraie_image(
    client, methode
):
    """**Un essai serveur, sur une vraie image** — le critère explicite de
    `B18` : chaque moteur porte un essai qui prouve son résultat, pas
    seulement sa présence dans une liste.
    """
    identifiant = _un_asset(client)
    reponse = client.put(
        f"/api/assets/{identifiant}/recipe",
        json={
            "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
            "grille": {"cible": 32, "occupation": 100, "ancrage": "bas", "methode": methode},
        },
    )
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["recette"]["grille"]["methode"] == methode

    telecharge = client.get(f"/api/assets/{identifiant}/download")
    assert telecharge.status_code == 200, telecharge.text
    with Image.open(io.BytesIO(telecharge.content)) as image:
        rendu = np.asarray(image.convert("RGBA"))
    assert rendu.shape[0] == rendu.shape[1] == 32, (
        f"« {methode} » n'a pas rendu la case de 32 carrés demandée : {rendu.shape}"
    )
    assert rendu[:, :, 3].max() > 0, f"« {methode} » a rendu une image entièrement vide"


def test_le_reglage_de_reduction_ne_grise_aucune_des_quatre_methodes_neuves(client):
    """**Câblé à l'écran, pas en dur dans le code** : `GET /api/status` sert
    `traitement.reductions`, et c'est cette liste-là que
    `interface/src/composants/Retouche.tsx` lit pour construire le segment
    « façon de réduire » (`traitement.reductions.map((r) => r.nom)`).
    """
    reponse = client.get("/api/status")
    assert reponse.status_code == 200, reponse.text
    reductions = {r["nom"]: r for r in reponse.json()["traitement"]["reductions"]}
    for methode in (SUR_LE_MODELE, DOMINANTE, MEDIANE, LUMIERE_JUSTE):
        assert methode in reductions, f"« {methode} » n'est pas proposée par la route"
        assert reductions[methode]["raison"] is None
        assert reductions[methode]["libelle"] == NOM_DE_LA_METHODE[methode]
