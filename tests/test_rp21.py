# -*- coding: utf-8 -*-
"""RP21 · Une planche découpée sur la toile devient une animation.

Deux chemins de plus vers le geste d'`AU19` — une feuille de sprites qui
devient un clip et ses bandes. Aucun des deux n'ouvre un second service :
`ServicePlancheAnimee._livrer` (`atelier/services/planche_animee.py`) est le
même dernier pas pour les trois entrées, et c'est ce que le premier essai
ci-dessous vérifie au pixel.

**Chemin 1** : la carte d'un tableau d'inspiration, à la place d'une planche
de la bibliothèque — `POST /api/clips/sheet`, `carte` au lieu de `feuille`.

**Chemin 2** : une sélection d'images fixes déjà en bibliothèque, sans aucun
rectangle à couper — `POST /api/clips/assemble`.

Aucun des deux ne coûte, et aucun n'encode de vidéo : les mêmes garanties
qu'`AU19`, vérifiées ici sur les deux entrées neuves.
"""

from __future__ import annotations

import io

from PIL import Image

# Une case de la feuille, en pixels. Petite : ce qui est mesuré ici est un
# découpage ou un assemblage, pas une qualité d'image.
CASE = 24

# Les couleurs des cases, dans l'ordre de lecture. Quatre valeurs franches,
# qu'un essai peut relire au pixel sans se demander si la compression a bougé
# un ton.
TEINTES = [
    (200, 30, 30, 255),
    (30, 200, 30, 255),
    (30, 30, 200, 255),
    (200, 200, 30, 255),
]


def feuille(colonnes: int = 4, lignes: int = 1) -> bytes:
    """Une feuille de sprites, fond transparent et une couleur par case."""
    image = Image.new("RGBA", (CASE * colonnes, CASE * lignes), (0, 0, 0, 0))
    for rang in range(colonnes * lignes):
        x = (rang % colonnes) * CASE
        y = (rang // colonnes) * CASE
        for dx in range(4, CASE - 4):
            for dy in range(4, CASE - 4):
                image.putpixel((x + dx, y + dy), TEINTES[rang % len(TEINTES)])
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def grille(colonnes: int = 4, lignes: int = 1) -> list[list[int]]:
    """Les rectangles de la grille fixe, dans l'ordre de lecture."""
    return [
        [
            (rang % colonnes) * CASE,
            (rang // colonnes) * CASE,
            (rang % colonnes) * CASE + CASE - 1,
            (rang // colonnes) * CASE + CASE - 1,
        ]
        for rang in range(colonnes * lignes)
    ]


def image_seule(couleur: tuple[int, int, int, int] = (10, 20, 30, 255), sel: int = 0) -> bytes:
    """Une petite image, fond transparent et un carré plein au centre — de
    quoi vérifier la transparence au pixel sur une image qui n'est pas une
    feuille de sprites.

    `sel` marque un pixel isolé du coin bas-droit, hors du carré et hors du
    coin haut-gauche que l'essai de transparence lit : deux images « sans
    importance » d'un même essai doivent rester deux images distinctes, sans
    quoi l'import détecterait un doublon et n'en créerait qu'une.
    """
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for x in range(4, 12):
        for y in range(4, 12):
            image.putpixel((x, y), couleur)
    if sel:
        image.putpixel((15, 15), (sel % 256, 0, 0, 1))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def poser_asset(client, octets: bytes | None = None, nom: str = "marche.png") -> str:
    """L'image entre dans la bibliothèque, sans passer par le fournisseur."""
    reponse = client.post(
        "/api/assets/upload",
        content=octets if octets is not None else feuille(),
        params={"nom": nom, "traiter": "false"},
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def poser_carte(client, octets: bytes | None = None, nom: str = "planche.png") -> str:
    """L'image entre sur le tableau d'inspiration, en carte."""
    reponse = client.post(
        "/api/board/paste",
        params={"nom": nom},
        content=octets if octets is not None else feuille(),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]["identifiant"]


def animer(client, **corps):
    return client.post("/api/clips/sheet", json=corps)


def assembler(client, **corps):
    return client.post("/api/clips/assemble", json=corps)


def personnage(client, nom: str = "Le gobelin") -> str:
    return client.post("/api/characters", json={"nom": nom}).json()["personnage"]["identifiant"]


def pose(client, nom: str = "posture-rp21") -> str:
    # **Un nom qui n'existe dans aucun plan de départ** : le plan d'un jeu
    # neuf porte déjà des poses courantes — « marche » en est une —, et
    # `ajouter_pose` refuse un nom déjà pris plutôt que de le confondre avec
    # l'existant.
    reponse = client.post("/api/characters/poses", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["pose"]["identifiant"]


def designer(client, asset: str, **corps) -> None:
    reponse = client.put(f"/api/assets/{asset}/character", json=corps)
    assert reponse.status_code == 200, reponse.text


# ── Chemin 1 : depuis une carte de la toile, comme depuis une planche ───────


def test_animer_depuis_une_carte_rend_le_meme_resultat_que_depuis_une_planche(client):
    """Même image, deux portes — mêmes bandes, mêmes frames au pixel.

    C'est le critère de la tranche : la découpe d'une carte offre *Animer* et
    réutilise le service d'`AU19`, elle n'en ouvre pas un second qui pourrait
    un jour rendre autre chose.
    """
    octets = feuille()
    depuis_planche = animer(
        client, feuille=poser_asset(client, octets), boites=grille(), nom="Marche"
    ).json()
    depuis_carte = animer(
        client, carte=poser_carte(client, octets), boites=grille(), nom="Marche"
    ).json()

    assert depuis_planche["clip"]["clip"]["images"] == 4
    assert depuis_carte["clip"]["clip"]["images"] == 4
    assert len(depuis_planche["bandes"]) == len(depuis_carte["bandes"]) == 1
    assert (
        [p["numero"] for p in depuis_planche["bandes"][0]["prises"]]
        == [p["numero"] for p in depuis_carte["bandes"][0]["prises"]]
    )

    for rang in range(4):
        a = client.get(f"/api/clips/{depuis_planche['clip']['identifiant']}/frames/{rang}")
        b = client.get(f"/api/clips/{depuis_carte['clip']['identifiant']}/frames/{rang}")
        assert a.status_code == b.status_code == 200
        assert a.content == b.content


def test_animer_une_carte_ne_depense_rien(client):
    clip = animer(client, carte=poser_carte(client), boites=grille()).json()["clip"]
    assert clip["clip"]["prix_annonce"] == 0
    assert clip["clip"]["montant_dit"] == "feuille découpée — aucun nouvel appel"
    assert clip["consomme"] == 0


def test_animer_refuse_sans_feuille_ni_carte(client):
    refus = animer(client, boites=grille())
    assert refus.status_code == 409, refus.text
    assert "une image de départ" in refus.json()["raison"]


def test_animer_refuse_une_feuille_et_une_carte_a_la_fois(client):
    refus = animer(
        client,
        feuille=poser_asset(client),
        carte=poser_carte(client),
        boites=grille(),
    )
    assert refus.status_code == 409, refus.text
    assert "une image de départ" in refus.json()["raison"]


def test_animer_une_carte_texte_est_refuse(client):
    note = client.post("/api/board/text", json={"texte": "sombre"}).json()
    refus = animer(client, carte=note["identifiant"], boites=grille())
    assert refus.status_code == 409, refus.text
    assert "ne s'anime pas" in refus.json()["raison"]


def test_animer_une_carte_inconnue_est_refusee_en_francais(client):
    refus = animer(client, carte="pas-une-carte", boites=grille())
    assert refus.status_code == 404, refus.text
    assert "pas-une-carte" in refus.json()["raison"]


def test_animer_une_carte_ne_demande_jamais_le_fournisseur(client, double):
    avant = len(double.demandes)
    animer(client, carte=poser_carte(client), boites=grille())
    assert len(double.demandes) == avant


# ── Chemin 2 : une sélection d'images fixes devient une animation ──────────


def test_assembler_une_selection_devient_un_clip_et_sa_bande(client):
    """Le geste de la tranche, et la forme de sa réponse — pas de rectangles à
    couper, les images entrent telles quelles, dans l'ordre de la sélection."""
    a = poser_asset(client, image_seule((200, 30, 30, 255)), "un.png")
    b = poser_asset(client, image_seule((30, 200, 30, 255)), "deux.png")
    reponse = assembler(client, images=[a, b], nom="Assemblage")
    assert reponse.status_code == 201, reponse.text
    corps = reponse.json()
    assert corps["clip"]["clip"]["images"] == 2
    assert len(corps["bandes"]) == 1
    assert corps["bandes"][0]["nom"] == "Assemblage"
    assert [p["numero"] for p in corps["bandes"][0]["prises"]] == [0, 1]


def test_assembler_ne_depense_rien(client):
    a = poser_asset(client, image_seule())
    clip = assembler(client, images=[a]).json()["clip"]
    assert clip["clip"]["prix_annonce"] == 0
    assert clip["clip"]["montant_dit"] == "images assemblées — aucun nouvel appel"
    assert clip["consomme"] == 0


def test_assembler_garde_l_ordre_de_la_selection_dans_les_frames(client):
    """La couleur de chaque frame dit sa place — c'est tout le contrat d'ordre,
    le même que celui d'`AU19` sur les cases d'une feuille."""
    couleurs = [(200, 30, 30, 255), (30, 200, 30, 255), (30, 30, 200, 255)]
    images = [poser_asset(client, image_seule(c), f"{i}.png") for i, c in enumerate(couleurs)]
    clip = assembler(client, images=images).json()["clip"]
    for rang, couleur in enumerate(couleurs):
        reponse = client.get(f"/api/clips/{clip['identifiant']}/frames/{rang}")
        assert reponse.status_code == 200
        with Image.open(io.BytesIO(reponse.content)) as ouverte:
            frame = ouverte.convert("RGBA")
        assert frame.getpixel((8, 8)) == couleur


def test_assembler_conserve_la_transparence_au_pixel(client):
    """Aucun encodage vidéo sur ce chemin : le bord transparent de l'image
    d'origine doit se retrouver intact dans la frame du clip."""
    a = poser_asset(client, image_seule())
    clip = assembler(client, images=[a]).json()["clip"]
    reponse = client.get(f"/api/clips/{clip['identifiant']}/frames/0")
    with Image.open(io.BytesIO(reponse.content)) as ouverte:
        frame = ouverte.convert("RGBA")
    assert frame.getpixel((0, 0))[3] == 0
    assert frame.getpixel((8, 8))[3] == 255


def test_assembler_dit_de_quelle_image_vient_chaque_frame(client, atelier):
    """La filiation : le `generation.json` garde l'identifiant de chaque image
    source, dans l'ordre où elle est devenue une frame."""
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    clip = assembler(client, images=[a, b]).json()["clip"]
    relu = atelier.animation.lire(clip["identifiant"])
    assert relu is not None
    assert relu.demande["images"] == [a, b]


def test_assembler_laisse_les_images_en_bibliotheque(client):
    """Les images restent en bibliothèque après le montage — en faire une bande
    ne les consomme pas."""
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    assembler(client, images=[a, b])
    identifiants = {asset["identifiant"] for asset in client.get("/api/assets").json()["assets"]}
    assert {a, b} <= identifiants


def test_assembler_refuse_une_selection_vide(client):
    refus = assembler(client, images=[])
    assert refus.status_code == 409, refus.text
    assert "rien à assembler" in refus.json()["raison"]


def test_assembler_refuse_une_image_inconnue(client):
    refus = assembler(client, images=["pas-une-image"])
    assert refus.status_code == 404, refus.text
    assert "pas-une-image" in refus.json()["raison"]


def test_assembler_refuse_une_selection_qui_melange_deux_sujets(client):
    """« Une sélection qui mélange deux sujets ne propose pas le geste, et dit
    pourquoi » — vérifié ici côté serveur, qui ne fait pas confiance à l'écran."""
    gobelin = personnage(client, "Le gobelin")
    squelette = personnage(client, "Le squelette")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin)
    designer(client, b, personnage=squelette)

    refus = assembler(client, images=[a, b])
    assert refus.status_code == 409, refus.text
    assert "sujet" in refus.json()["raison"]


def test_assembler_accepte_une_selection_du_meme_sujet(client):
    gobelin = personnage(client, "Le gobelin")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin)
    designer(client, b, personnage=gobelin)

    reponse = assembler(client, images=[a, b])
    assert reponse.status_code == 201, reponse.text
    assert reponse.json()["clip"]["personnage"] == gobelin


def test_assembler_preremplit_le_sujet_et_la_pose_quand_ils_sont_uniformes(client):
    """« Préremplis avec ceux des images quand ils sont tous les mêmes » —
    sans que l'appel ait besoin de les nommer."""
    gobelin = personnage(client, "Le gobelin")
    marche = pose(client, "posture-rp21-marche")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin, pose=marche)
    designer(client, b, personnage=gobelin, pose=marche)

    corps = assembler(client, images=[a, b]).json()
    assert corps["clip"]["personnage"] == gobelin
    assert corps["clip"]["pose"] == marche
    assert corps["bandes"][0]["personnage"] == gobelin
    assert corps["bandes"][0]["pose"] == marche


def test_assembler_ne_prefill_pas_la_pose_quand_elle_differe(client):
    """Deux poses différentes dans la sélection ne désignent aucune pose par
    défaut — deviner en choisirait une au hasard."""
    gobelin = personnage(client, "Le gobelin")
    marche = pose(client, "posture-rp21-marche")
    saut = pose(client, "posture-rp21-saut")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin, pose=marche)
    designer(client, b, personnage=gobelin, pose=saut)

    corps = assembler(client, images=[a, b]).json()
    assert corps["clip"]["personnage"] == gobelin
    assert corps["clip"]["pose"] is None


def _forcer_direction(atelier, asset: str, direction: str) -> None:
    """Pose la direction d'une image directement sur l'objet.

    Contourne `ServiceProduction.designer` — qui exige une case (personnage
    **et** pose) tenue par le plan pour accepter une direction (E10) — parce
    que ce que ce fichier vérifie est le préremplissage d'`assembler`, pas
    cette validation-là, déjà couverte ailleurs (`test_e14.py`, `test_b1.py`).
    """
    objet = atelier.assets.lire(asset)
    assert objet is not None
    objet.direction = direction
    atelier.assets.sauver(objet)


def test_assembler_preremplit_la_direction_quand_elle_est_uniforme(client, atelier):
    """La direction se préremplit comme le sujet et la pose — le critère de la
    tranche dit « sous le sujet, la pose et la direction nommés ». (Une
    direction ne se pose que sur un mouvement déjà nommé — `ServiceMontage`
    refuse l'inverse, la même règle qu'ailleurs dans le produit.)"""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    gobelin = personnage(client, "Le gobelin")
    marche = pose(client, "posture-rp21-direction")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin, pose=marche)
    designer(client, b, personnage=gobelin, pose=marche)
    _forcer_direction(atelier, a, "sud")
    _forcer_direction(atelier, b, "sud")

    reponse = assembler(client, images=[a, b])
    assert reponse.status_code == 201, reponse.text
    corps = reponse.json()
    assert corps["clip"]["direction"] == "sud"
    assert corps["bandes"][0]["direction"] == "sud"


def test_assembler_ne_prefill_pas_la_direction_quand_elle_differe(client, atelier):
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    gobelin = personnage(client, "Le gobelin")
    marche = pose(client, "posture-rp21-direction")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    designer(client, a, personnage=gobelin, pose=marche)
    designer(client, b, personnage=gobelin, pose=marche)
    _forcer_direction(atelier, a, "sud")
    _forcer_direction(atelier, b, "nord")

    corps = assembler(client, images=[a, b]).json()
    assert corps["clip"]["direction"] is None


def test_assembler_accepte_une_direction_nommee_a_la_main(client):
    """L'auteur peut nommer la direction lui-même, même si les images n'en
    disent aucune — la fenêtre `AssemblerAnimation.tsx` l'envoie ainsi."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    gobelin = personnage(client, "Le gobelin")
    marche = pose(client, "posture-rp21-direction-main")
    a = poser_asset(client, image_seule(sel=1), "un.png")
    b = poser_asset(client, image_seule(sel=2), "deux.png")
    reponse = assembler(client, images=[a, b], personnage=gobelin, pose=marche, direction="ouest")
    assert reponse.status_code == 201, reponse.text
    corps = reponse.json()
    assert corps["clip"]["direction"] == "ouest"
    assert corps["bandes"][0]["direction"] == "ouest"


def test_assembler_ne_demande_jamais_le_fournisseur(client, double):
    a = poser_asset(client, image_seule())
    avant = len(double.demandes)
    assembler(client, images=[a])
    assert len(double.demandes) == avant
