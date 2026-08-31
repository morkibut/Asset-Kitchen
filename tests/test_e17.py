# -*- coding: utf-8 -*-
"""Les critères de E17 qui vivent côté serveur — le calibrage.

**Ce qui se mesure ici** : que la hauteur commune se calcule sur ce que chaque
pose peut atteindre sans sortir de sa case, qu'elle nomme la pose qui limite et
ce qu'elle coûte, que le calage s'écrive dans l'**occupation** — donc qu'il
survive à un changement de taille de case —, et que le décalage horizontal
n'existe que là. Ce que l'écran montre — les silhouettes empilées, la ligne de
hauteur commune, la reprise à la main — vit dans `interface/src/App.test.tsx`.

**Le défaut, mesuré le 30 août 2026 sur les images réelles du dépôt.** Les six
poses d'un même personnage sortent à 64, 60, 64, 53, 64 et 43 pixels de haut :
dans le jeu, il rapetisse au moment où il frappe. La mise sur grille rétrécit le
sujet jusqu'à ce que le plus grand côté de sa **boîte** touche la case ; un bras
tendu élargit la boîte sans grandir le personnage, et c'est la hauteur qui tombe.

**L'outil propose, il ne décide pas.** Quatre repères automatiques ont été
comparés et trois échouent (`atelier/services/calibrage.py`). C'est ce qui donne
sa forme à l'outil, et c'est pourquoi la reprise à la main est la moitié du
travail.
"""

from __future__ import annotations

import itertools

import io

from PIL import Image, ImageDraw

from atelier.services.calibrage import ServiceCalibrage


_DISTINCTES = itertools.count(3)


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _silhouette(largeur: int, hauteur: int, rang: int, toile: int = 256) -> bytes:
    """Un sujet **déjà détouré**, dont la boîte opaque est exactement celle qu'on
    demande.

    Le calibrage mesure la boîte du sujet, pas la qualité du détourage : une
    image dont on connaît la boîte d'avance mesure donc le calcul et lui seul.
    Le rang décale la teinte, pour que deux poses ne soient jamais le même
    fichier — la bibliothèque refuse un doublon, à juste titre.
    """
    image = Image.new("RGBA", (toile, toile), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    x0, y0 = (toile - largeur) // 2, (toile - hauteur) // 2
    dessin.rectangle(
        [x0, y0, x0 + largeur - 1, y0 + hauteur - 1],
        fill=(40 + rang * 7 % 200, 90, 140, 255),
    )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _poser(client, tmp_path, personnage: str, pose: str, largeur: int, hauteur: int):
    """Une image dont le sujet a **exactement** la boîte demandée, rangée dans
    sa case."""
    rang = next(_DISTINCTES)
    fichier = tmp_path / f"{personnage}-{pose}-{rang}.png"
    fichier.write_bytes(_silhouette(largeur, hauteur, rang))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    reponse = client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": personnage, "pose": pose},
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _calibrage(client, personnage: str) -> dict:
    reponse = client.get(f"/api/characters/{personnage}/calibration")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _un_personnage_dephase(client, tmp_path) -> str:
    """Le vrai défaut, à l'échelle : un sujet debout, un sujet aux bras tendus,
    un sujet couché. Trois hauteurs rendues, trois plafonds différents."""
    client.put("/api/universe", json={"cible_px": 64})
    chose = _creer(client)
    _poser(client, tmp_path, chose["identifiant"], "repos", 48, 64)
    _poser(client, tmp_path, chose["identifiant"], "attaque", 64, 48)
    _poser(client, tmp_path, chose["identifiant"], "mort", 64, 24)
    return chose["identifiant"]


# ── La hauteur commune, et ce qui la limite ─────────────────────────────────


def test_le_calcul_est_celui_de_la_mise_sur_grille(client):
    """**Le même calcul, jamais un second.** Deux formules auraient fini par
    annoncer une hauteur et en produire une autre — c'est très exactement la
    contradiction que cette étape répare."""
    # Une boîte 523 × 430 dans une case de 64 : le plus grand côté touche la
    # case, donc la hauteur tombe à 64 × 430 / 523 ≈ 53. C'est la mesure du
    # 30 août sur la pose d'attaque du vrai projet.
    assert ServiceCalibrage._plafond(523, 430, 64) == 53
    assert ServiceCalibrage._rendue(523, 430, 64, 100) == 53
    # Et l'occupation à poser pour rendre 53 est l'inverse exact.
    assert ServiceCalibrage._occupation(523, 430, 64, 53) == 100
    assert ServiceCalibrage._occupation(1015, 958, 64, 53) == 88
    assert ServiceCalibrage._occupation(661, 884, 64, 53) == 83


def test_la_hauteur_commune_est_celle_de_la_pose_qui_limite(client, tmp_path):
    """Toutes les têtes doivent toucher la même ligne, et c'est la pose la plus
    large qui décide où elle passe."""
    chose = _un_personnage_dephase(client, tmp_path)

    lu = _calibrage(client, chose)

    plafonds = {p["pose"]: p["plafond"] for p in lu["poses"]}
    assert plafonds["repos"] == 64
    assert plafonds["attaque"] == 48
    assert plafonds["mort"] == 24
    assert lu["commune"] == 24
    assert lu["limite"] == "mort"
    # **Ce que la cohérence coûte, en clair** : quarante pixels de la case ne
    # servent pas. Le produit le dit, il ne le cache pas.
    assert lu["perdus"] == 40


def test_la_pose_tres_en_dehors_est_proposee_a_lecart(client, tmp_path):
    """**Un personnage debout ne doit pas rapetisser d'un tiers parce qu'il meurt
    dans une autre image.** Le produit ne devine pas qu'elle est couchée : il
    voit qu'elle est très en dehors des autres, et il le propose."""
    chose = _un_personnage_dephase(client, tmp_path)

    assert _calibrage(client, chose)["de_cote"] == "mort"


def test_une_seule_pose_est_proposee_jamais_une_cascade(client, tmp_path):
    """Écarter la plus basse fait de la suivante la plus basse. Reproposer à
    chaque fois finirait par ne garder qu'une pose, et l'outil aurait décidé à la
    place de l'auteur ce qu'il prétend seulement proposer."""
    chose = _un_personnage_dephase(client, tmp_path)

    reponse = client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": True}
    )
    assert reponse.status_code == 200, reponse.text

    lu = reponse.json()
    assert lu["commune"] == 48  # c'est l'attaque qui limite désormais
    assert lu["limite"] == "attaque"
    # Et elle n'est pas proposée à l'écart à son tour.
    assert lu["de_cote"] == ""


def test_une_pose_mise_de_cote_garde_sa_case(client, tmp_path):
    """**Ce n'est ni un écart ni un rangement** : la case existe, elle se
    remplit, elle se compte. Seul le calage commun l'ignore."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": True}
    )

    cases = {
        c["pose"]: c
        for c in client.get("/api/characters").json()["personnages"][0]["cases"]
    }
    assert len(cases["mort"]["images"]) == 1
    assert cases["mort"]["corps"]

    # Et elle rentre d'un clic.
    rendu = client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": False}
    ).json()
    assert rendu["commune"] == 24


# ── Le calage s'écrit dans l'occupation ─────────────────────────────────────


def test_calibrer_ecrit_une_occupation_par_pose(client, tmp_path):
    """Le calage **est** une occupation — un réglage qui existe déjà, déjà
    exprimé en part de la case. L'outil ne fait rien d'autre que la poser."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": True}
    )

    reponse = client.post(f"/api/characters/{chose}/calibration")
    assert reponse.status_code == 200, reponse.text

    rendues = {p["pose"]: p["rendue"] for p in reponse.json()["poses"] if not p["de_cote"]}
    assert set(rendues.values()) == {48}, rendues


def test_changer_la_taille_de_case_ne_defait_aucun_calibrage(client, tmp_path):
    """**Une occupation est une part de la case, pas un nombre de pixels.** Il
    n'y a donc rien à recalculer quand la case change — et c'est ce qui rend le
    calibrage gratuit à conserver."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": True}
    )
    client.post(f"/api/characters/{chose}/calibration")
    avant = {p["pose"]: p["occupation"] for p in _calibrage(client, chose)["poses"]}

    client.put("/api/universe", json={"cible_px": 128})

    apres = _calibrage(client, chose)
    assert {p["pose"]: p["occupation"] for p in apres["poses"]} == avant
    # Les hauteurs doublent ensemble, à l'arrondi près.
    rendues = {p["pose"]: p["rendue"] for p in apres["poses"] if not p["de_cote"]}
    assert all(abs(h - 96) <= 1 for h in rendues.values()), rendues


def test_la_reprise_a_la_main_se_fait_pose_par_pose(client, tmp_path):
    """La proposition n'est qu'un point de départ : chaque pose se règle ensuite
    seule, et rien ne réclame qu'on garde ce que l'outil a posé."""
    chose = _un_personnage_dephase(client, tmp_path)

    reponse = client.put(
        f"/api/characters/{chose}/calibration/repos", json={"occupation": 50}
    )
    assert reponse.status_code == 200, reponse.text

    poses = {p["pose"]: p for p in reponse.json()["poses"]}
    assert poses["repos"]["occupation"] == 50
    assert poses["attaque"]["occupation"] == 100  # les autres n'ont pas bougé


# ── Le décalage horizontal ──────────────────────────────────────────────────


def test_le_decalage_vaut_zero_par_defaut_et_ne_change_rien(client, tmp_path):
    """**Une recette sans calibrage rend exactement l'image d'avant.** C'est la
    condition pour que ce champ soit gratuit à ajouter."""
    from atelier.domaine.recette import Grille
    from atelier.image.traitement import sur_grille
    import numpy as np

    assert Grille().decalage == 0
    sujet = np.zeros((40, 20, 4), dtype=np.uint8)
    sujet[:, :, 3] = 255
    sans = sur_grille(sujet, Grille(cible=64, occupation=100), case=True)
    zero = sur_grille(sujet, Grille(cible=64, occupation=100, decalage=0), case=True)
    assert np.array_equal(sans, zero)


def test_le_decalage_deplace_le_sujet_sans_le_sortir_de_sa_case(client):
    """**Rien ne sort de la case** : la sortir couperait le sprite en silence, et
    une case existe justement pour que rien n'en sorte. Aux bords, le réglage
    cesse d'avoir un effet — ce qui se voit."""
    from atelier.domaine.recette import Grille
    from atelier.image.traitement import boite_opaque, sur_grille
    import numpy as np

    sujet = np.zeros((40, 20, 4), dtype=np.uint8)
    sujet[:, :, 3] = 255

    def gauche(decalage: int) -> int:
        rendu = sur_grille(
            sujet, Grille(cible=64, occupation=50, decalage=decalage), case=True
        )
        return boite_opaque(rendu[:, :, 3])[0]

    assert gauche(3) == gauche(0) + 3
    assert gauche(-3) == gauche(0) - 3
    # Poussé au-delà, il s'arrête au bord plutôt que de rogner l'image.
    assert gauche(999) + 16 <= 64
    assert gauche(-999) == 0


def test_le_decalage_ne_part_pas_dans_une_recette_nommee(client, tmp_path):
    """**C'est une coordonnée, pas un réglage.** Il rattrape la dérive de *cette*
    silhouette dans sa case ; la reposer ailleurs décalerait une autre image sans
    qu'aucune mesure ne l'ait demandé — même règle que la différence d'un
    calque."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put(
        f"/api/characters/{chose}/calibration/repos", json={"decalage": 4}
    )
    asset = next(
        p["asset"] for p in _calibrage(client, chose)["poses"] if p["pose"] == "repos"
    )
    recette = client.get(f"/api/assets/{asset}").json()["recette"]
    assert recette["grille"]["decalage"] == 4

    reponse = client.put("/api/recipes/mon calage", json=recette)
    assert reponse.status_code == 200, reponse.text

    nommees = client.get("/api/recipes").json()["recettes"]
    assert nommees["mon calage"]["grille"]["decalage"] == 0


# ── Ce que le calibrage ne fait pas ─────────────────────────────────────────


def test_le_calibrage_ne_coute_rien(client, double, tmp_path):
    """Aucun appel payant, aucune image neuve : il change le rendu de poses qui
    existent déjà, et un rendu est un cache."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.post(f"/api/characters/{chose}/calibration")
    client.put(f"/api/characters/{chose}/calibration/repos", json={"occupation": 70})

    assert double.appels == 0


def test_un_jeu_sans_taille_de_case_le_dit(client, tmp_path):
    """« Aucune » est une valeur (US-163) : un jeu qui ne contraint pas l'échelle
    n'a pas de hauteur commune à poser, et le refus le dit plutôt que de calculer
    sur une division par zéro."""
    chose = _un_personnage_dephase(client, tmp_path)
    client.put("/api/universe", json={"cible_px": 0})

    reponse = client.get(f"/api/characters/{chose}/calibration")
    assert reponse.status_code == 409, reponse.text
    assert "aucune taille de case" in reponse.text
