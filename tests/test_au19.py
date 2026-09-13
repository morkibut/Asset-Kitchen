# -*- coding: utf-8 -*-
"""AU19 · Une feuille de sprites qui vient d'ailleurs devient une animation.

**Aucun de ces essais ne coûte un centime, et aucun ne demande de décodeur.**
C'est la différence avec `AU18`, et c'est tout l'intérêt de la tranche : une
feuille n'a pas à passer par une vidéo pour devenir une animation — donc ces
essais tournent sur une machine où `ffmpeg` n'est pas installé.

La feuille de ces essais porte **un fond transparent et des cases de couleurs
différentes**. Les deux comptent : la transparence est ce que le détour par la
vidéo faisait perdre, et les couleurs sont ce qui prouve que l'ordre des images
est celui de la lecture, et pas un autre.
"""

from __future__ import annotations

import io

from PIL import Image

from atelier.services.planche_animee import FEUILLE_DECOUPEE, PLANCHE

# Une case de la feuille, en pixels. Petite : ce qui est mesuré ici est un
# découpage, pas une qualité d'image.
CASE = 24

# Les couleurs des cases, dans l'ordre de lecture de la feuille. Quatre valeurs
# franches, qu'un essai peut relire au pixel sans se demander si la compression
# a bougé un ton.
TEINTES = [
    (200, 30, 30, 255),
    (30, 200, 30, 255),
    (30, 30, 200, 255),
    (200, 200, 30, 255),
]


def feuille(colonnes: int = 4, lignes: int = 1) -> bytes:
    """Une feuille de sprites, **fond transparent et une couleur par case**.

    Chaque case porte un carré plein centré, bordé de transparent : c'est ce
    qui permet de vérifier à la fois la couleur — donc l'ordre — et l'alpha —
    donc ce que le détour par la vidéo coûtait.
    """
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


def poser(client, octets: bytes | None = None, nom: str = "marche.png") -> str:
    """La feuille entre dans la bibliothèque, **sans passer par le fournisseur**."""
    reponse = client.post(
        "/api/assets/upload",
        content=octets if octets is not None else feuille(),
        params={"nom": nom, "traiter": "false"},
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["asset"]["identifiant"]


def animer(client, **corps):
    return client.post("/api/clips/sheet", json=corps)


# ── Ce qui entre est un clip, comme les autres ──────────────────────────────


def test_une_feuille_decoupee_devient_un_clip_du_jeu(client):
    """Le geste de la tranche, et la forme de sa réponse."""
    reponse = animer(client, feuille=poser(client), boites=grille(), nom="Marche")
    assert reponse.status_code == 201, reponse.text
    clip = reponse.json()["clip"]
    assert clip["modele"] == FEUILLE_DECOUPEE
    assert clip["statut"] == "reussie"
    assert clip["clip"]["nature"] == PLANCHE
    assert clip["clip"]["images"] == 4


def test_une_feuille_decoupee_ne_depense_rien(client):
    """Prix annoncé à zéro, **et rien de consommé** : les deux se vérifient.

    L'image a été payée une fois, à son entrée. La découper en cases ne
    rappelle personne, et sa fiche doit le dire au lieu d'un montant relu.
    """
    clip = animer(client, feuille=poser(client), boites=grille()).json()["clip"]
    assert clip["clip"]["prix_annonce"] == 0
    assert clip["clip"]["montant_dit"] == "feuille découpée — aucun nouvel appel"
    assert clip["emplacements"][0]["consomme"] == 0
    assert clip["consomme"] == 0


def test_les_cases_deviennent_les_images_du_clip_dans_l_ordre_de_lecture(client):
    """La case la plus à gauche est l'image 0. **C'est tout le contrat d'ordre.**

    Sans lui, une marche se jouerait dans le désordre, et le défaut ne se
    verrait qu'une fois l'animation dans le moteur de jeu.
    """
    clip = animer(client, feuille=poser(client), boites=grille()).json()["clip"]
    for rang, teinte in enumerate(TEINTES):
        image = client.get(f"/api/clips/{clip['identifiant']}/frames/{rang}")
        assert image.status_code == 200, image.text
        with Image.open(io.BytesIO(image.content)) as ouverte:
            case = ouverte.convert("RGBA")
        assert case.size == (CASE, CASE)
        assert case.getpixel((CASE // 2, CASE // 2)) == teinte


def test_la_transparence_d_une_case_survit_entiere(client):
    """**Ce que le détour par la vidéo faisait perdre**, et la raison de la tranche.

    Un MP4 n'a pas de couche alpha : le champignon en serait ressorti sur un
    fond noir. Ici rien n'est encodé, les cases sont découpées dans les pixels
    de la feuille.
    """
    clip = animer(client, feuille=poser(client), boites=grille()).json()["clip"]
    image = client.get(f"/api/clips/{clip['identifiant']}/frames/0")
    with Image.open(io.BytesIO(image.content)) as ouverte:
        case = ouverte.convert("RGBA")
    assert case.getpixel((0, 0))[3] == 0
    assert case.getpixel((CASE // 2, CASE // 2))[3] == 255


# ── Une bande naît du même geste ────────────────────────────────────────────


def test_une_bande_nait_du_meme_geste(client):
    """Découper pour voir et garder l'animation sont **un seul geste**.

    Un clip sans bande obligerait l'auteur à refaire au montage ce qu'il vient
    de dessiner sur la feuille : les mêmes images, dans le même ordre.
    """
    corps = animer(client, feuille=poser(client), boites=grille(), nom="Marche").json()
    assert len(corps["bandes"]) == 1
    bande = corps["bandes"][0]
    assert bande["nom"] == "Marche"
    assert [prise["numero"] for prise in bande["prises"]] == [0, 1, 2, 3]
    assert bande["cadence"] == 8.0
    assert bande["sens"] == "boucle"
    listees = client.get("/api/strips", params={"clip": corps["clip"]["identifiant"]}).json()
    assert [b["identifiant"] for b in listees["bandes"]] == [bande["identifiant"]]


def test_une_bande_se_range_sur_un_personnage_son_mouvement_et_sa_direction(client):
    """La destination est portée par l'appel, pas rangée après coup."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    personnage = client.post("/api/characters", json={"nom": "Le champignon"}).json()[
        "personnage"
    ]["identifiant"]
    corps = animer(
        client,
        feuille=poser(client),
        boites=grille(),
        nom="Marche",
        personnage=personnage,
        pose="marche",
        direction="sud",
    ).json()
    bande = corps["bandes"][0]
    assert bande["personnage"] == personnage
    assert bande["pose"] == "marche"
    assert bande["direction"] == "sud"


def test_une_feuille_a_plusieurs_lignes_fait_une_bande_par_direction(client):
    """**La forme courante d'une feuille** : une ligne par direction.

    Deux lignes de deux cases font deux animations sur le même clip, dans
    l'ordre des lignes — et pas une seule animation de quatre images qui
    changerait de direction au milieu.
    """
    corps = animer(
        client,
        feuille=poser(client, feuille(colonnes=2, lignes=2)),
        boites=grille(colonnes=2, lignes=2),
        nom="Marche",
        directions=["sud", "nord"],
    ).json()
    assert corps["clip"]["clip"]["images"] == 4
    sud, nord = corps["bandes"]
    assert sud["direction"] == "sud"
    assert [prise["numero"] for prise in sud["prises"]] == [0, 1]
    assert nord["direction"] == "nord"
    assert [prise["numero"] for prise in nord["prises"]] == [2, 3]
    # Deux bandes du même geste ne peuvent pas porter le même nom : la matrice
    # du personnage montrerait deux lignes indiscernables.
    assert sud["nom"] != nord["nom"]


# ── Ce qui est refusé, et ce que le refus laisse ────────────────────────────


def test_un_partage_inegal_entre_directions_est_refuse(client):
    """Trois cases sur deux directions veut dire que la feuille n'est pas celle
    qu'on croit. Arrondir rangerait une image dans la mauvaise direction."""
    reponse = animer(
        client,
        feuille=poser(client),
        boites=grille()[:3],
        directions=["sud", "nord"],
    )
    assert reponse.status_code == 409, reponse.text
    assert "ne se partagent pas" in reponse.json()["raison"]


def test_un_rectangle_hors_de_la_feuille_est_refuse_sans_rien_ecrire(client):
    """Rien n'a été payé : un refus n'a aucune raison de laisser un clip vide."""
    identifiant = poser(client)
    reponse = animer(
        client, feuille=identifiant, boites=[[0, 0, CASE * 9, CASE - 1]]
    )
    assert reponse.status_code == 409, reponse.text
    assert "hors de l'image" in reponse.json()["raison"]
    assert client.get("/api/clips").json()["clips"] == []


def test_une_feuille_inconnue_est_refusee_en_francais(client):
    """Le refus de la bibliothèque, mot pour mot — pas un second vocabulaire."""
    reponse = animer(client, feuille="pas-une-image", boites=grille())
    assert reponse.status_code == 404, reponse.text
    assert "pas-une-image" in reponse.json()["raison"]


# ── Ce que le disque garde ──────────────────────────────────────────────────


def test_le_clip_d_une_feuille_se_relit_apres_effacement_de_l_index(client, atelier):
    """Le `generation.json` porte tout : la bibliothèque se reconstruit sans lui.

    C'est la raison pour laquelle une feuille animée passe par une génération
    plutôt que d'écrire un dossier d'images dans un coin.
    """
    clip = animer(client, feuille=poser(client), boites=grille()).json()["clip"]
    atelier.bibliotheque.reconstruire()
    relu = atelier.animation.lire(clip["identifiant"])
    assert relu is not None
    assert relu.clip.nature == PLANCHE
    assert relu.clip.images == 4
    assert relu.demande["feuille"]


# ── Ce que l'écran peut faire, l'agent le peut aussi ────────────────────────


async def test_l_agent_monte_la_meme_feuille_par_le_meme_service(client, atelier):
    """L'outil MCP ne fait pas autre chose que le bouton : il appelle le même geste.

    C'est la règle d'`ARCHITECTURE.md` — *le MCP n'a pas de logique propre* —
    et c'est ce qui empêche l'agent et l'écran de diverger.
    """
    from atelier.mcp.serveur import creer_serveur

    identifiant = poser(client, feuille(colonnes=2, lignes=2))
    serveur = creer_serveur(atelier)
    resultat = await serveur.call_tool(
        "animate_sheet",
        {
            "asset_id": identifiant,
            "boxes": grille(colonnes=2, lignes=2),
            "name": "Marche",
            "directions": ["sud", "nord"],
        },
    )
    assert not resultat.is_error, resultat
    rendu = resultat.structured_content
    assert rendu["frames"] == 4
    assert [bande["direction"] for bande in rendu["strips"]] == ["sud", "nord"]
    assert [bande["frames"] for bande in rendu["strips"]] == [[0, 1], [2, 3]]
