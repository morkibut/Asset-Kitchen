# -*- coding: utf-8 -*-
"""A4 — la bande sort de l'atelier.

Les critères de `docs/PLAN.md` § A4. Une bande gardée devient des fichiers
utilisables dans un moteur de jeu : une planche de sprites, le fichier
d'accompagnement qui la décrit, et une image qui tourne toute seule.

**La plupart de ces essais n'ont besoin d'aucun décodeur vidéo**, et c'est
délibéré : ce qui se mesure ici est *ce qui sort*, pas *comment les images sont
entrées*. Les planches sont donc écrites à la main, case par case, avec une
couleur par case — ce qui permet de dire, pixel pour pixel, si l'image animée
joue bien les cases de sa planche et dans le bon ordre. Le dernier essai, lui,
part d'un vrai clip découpé : il vérifie que le chemin entier tient, et il est
sauté là où le décodeur manque.

**Ce que la tranche instaure, et que ces essais tiennent.**

1. **Aucun format n'est inventé.** Le fichier d'accompagnement est celui
   qu'écrit Aseprite, l'éditeur de pixel art, dont les clés exactes avaient été
   relevées avant l'ouverture de la tranche
   (`revue-externe-2026-09-02/research/12-ui-hud-exports.md`, lignes 148, 152
   et 159). Un essai vérifie les clés une à une : c'est le seul moyen qu'un
   ajout distrait ne transforme pas ce fichier en dialecte maison.
2. **L'image animée est découpée dans la planche exportée**, pas refaite à côté.
   Les deux fichiers de l'archive ne peuvent donc pas diverger — c'est le
   sixième critère, rendu vrai par construction plutôt que par discipline.
3. **Un seul nombre pour la cadence.** Le descriptif et l'image animée prennent
   le même temps par image, arrondi une seule fois.
4. **Rien ne dépense.** Le clip a été payé une fois ; le faire sortir est du
   disque et du processeur, et le compteur du double le prouve.
"""

from __future__ import annotations

import io
import itertools
import json
import zipfile

import numpy as np
import pytest

from atelier.domaine.bande import ALLER_RETOUR, BOUCLE, Bande, Cadre, Prise
from atelier.image import clip as decodeur
from atelier.image.bande import en_png

from test_a9 import (  # noqa: F401 — fixtures réemployées telles quelles
    MELE,
    AnimateurDouble,
    animateur,
    atelier_video,
    client_video,
    un_personnage,
    un_sprite,
)
from test_a10 import clip  # noqa: F401 — le clip écrit à la main, image par image


# ── Le décor : des bandes dont on connaît chaque pixel ──────────────────────


_DISTINCTES = itertools.count(1)

CASES = 4
LARGEUR = 12
HAUTEUR = 16


def planche_connue(cases: int = CASES, largeur: int = LARGEUR, hauteur: int = HAUTEUR):
    """Une planche de sprites écrite à la main, **une couleur par case**.

    C'est ce qui rend mesurable le sixième critère — *ce qui sort est exactement
    ce que l'aperçu montrait*. Deux cases d'une vraie planche peuvent se
    ressembler à s'y méprendre ; ici, aucune ne peut être prise pour sa voisine,
    et une image animée qui jouerait les cases dans le désordre se verrait au
    premier pixel comparé.
    """
    image = np.zeros((hauteur, largeur * cases, 4), dtype=np.uint8)
    for rang in range(cases):
        x = rang * largeur
        image[2 : hauteur - 2, x + 2 : x + largeur - 2] = (
            30 + rang * 55,
            210 - rang * 45,
            90,
            255,
        )
    return image


def _bande(
    atelier,
    *,
    personnage: str | None = None,
    pose: str | None = None,
    nom: str = "marche",
    cases: int = CASES,
    cadence: float = 8.0,
    sens: str = BOUCLE,
    clip: str = "clip-paye",
) -> Bande:
    """Une bande gardée **avec sa planche déjà sur le disque**.

    Poser le cache est ce qui dispense du décodeur : le montage relit le fichier
    au lieu d'aller redécouper le clip. Il n'y a là aucun raccourci sur ce qui
    se mesure — un vrai montage laisse exactement cet état-là derrière lui.
    """
    identifiant = f"bande-a4-{next(_DISTINCTES)}"
    bande = Bande(
        identifiant=identifiant,
        clip=clip,
        nom=nom,
        prises=tuple(Prise(numero=n) for n in range(cases)),
        cadence=cadence,
        sens=sens,
        cadre=Cadre(gauche=0, sommet=0, droite=LARGEUR - 1, bas=HAUTEUR - 1),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        case_largeur=LARGEUR,
        case_hauteur=HAUTEUR,
    )
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(
        clip, identifiant, en_png(planche_connue(cases))
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _sortir(client, identifiants: list[str]):
    reponse = client.post("/api/strips/export", json={"identifiants": identifiants})
    assert reponse.status_code == 200, reponse.text
    return zipfile.ZipFile(io.BytesIO(reponse.content))


def _images_animees(octets: bytes) -> tuple[list[np.ndarray], list[float]]:
    """Les images d'un PNG animé, relues une à une, avec leur durée."""
    from PIL import Image, ImageSequence

    lues: list[np.ndarray] = []
    durees: list[float] = []
    with Image.open(io.BytesIO(octets)) as ouverte:
        for image in ImageSequence.Iterator(ouverte):
            lues.append(np.array(image.convert("RGBA")))
            durees.append(image.info.get("duration"))
    return lues, durees


def _personnage(client, nom: str = "Le nain") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


# ── « Une bande sort en planche de sprites, avec un descriptif » ─────────────


def test_une_bande_sort_en_trois_fichiers_et_un_descriptif_d_atelier(atelier, client):
    """*Une bande sort en planche de sprites, avec un descriptif.*

    Trois fichiers, et pas un de plus : ce qu'un moteur charge — la planche et
    son fichier d'accompagnement —, et ce qu'on regarde sans rien installer.
    Le quatrième, à la racine, est le descriptif de l'atelier : celui qui dit
    d'où vient l'animation, ce que le format emprunté n'a aucune place pour
    porter.
    """
    bande = _bande(atelier)

    archive = _sortir(client, [bande.identifiant])

    assert sorted(archive.namelist()) == [
        "descriptif.json",
        "marche-anime.png",
        "marche.json",
        "marche.png",
    ]


def test_le_descriptif_dit_la_taille_d_une_case_leur_nombre_et_leur_ordre(
    atelier, client
):
    """*Un descriptif qui dit la taille d'une case, leur nombre et leur ordre.*

    Les trois, et le troisième est celui qui décide de la forme du fichier : les
    images sont une **liste** et non un dictionnaire, parce que l'ordre des clés
    d'un objet JSON n'est garanti par aucune norme et que l'ordre est justement
    ce qu'on doit dire.
    """
    bande = _bande(atelier, cases=5)

    archive = _sortir(client, [bande.identifiant])
    descriptif = json.loads(archive.read("marche.json"))

    images = descriptif["frames"]
    assert isinstance(images, list)
    assert len(images) == 5
    for rang, image in enumerate(images):
        assert image["frame"] == {
            "x": rang * LARGEUR,
            "y": 0,
            "w": LARGEUR,
            "h": HAUTEUR,
        }
    # La planche entière, telle qu'un moteur la mesurerait s'il n'avait pas ce
    # fichier — et c'est bien pour lui éviter de la mesurer qu'on l'écrit.
    assert descriptif["meta"]["size"] == {"w": 5 * LARGEUR, "h": HAUTEUR}
    assert descriptif["meta"]["image"] == "marche.png"


# ── « Le format existant le plus lu, jamais un format inventé ici » ──────────


def test_le_descriptif_porte_exactement_les_cles_du_format_le_plus_lu(atelier, client):
    """*Le descriptif est écrit dans le format existant le plus lu.*

    ⚠️ **Cet essai vérifie des noms de clés, un à un, et c'est tout son
    intérêt.** Un format emprunté ne se dégrade jamais d'un coup : il se dégrade
    d'une clé ajoutée « qui ne gêne personne », puis d'une clé renommée pour
    faire plus clair, et six mois plus tard le fichier ne s'ouvre plus nulle
    part. Les clés attendues ici sont celles du relevé
    (`revue-externe-2026-09-02/research/12-ui-hud-exports.md`, lignes 148 et 152)
    et rien d'autre n'a le droit de s'y trouver.
    """
    bande = _bande(atelier)

    archive = _sortir(client, [bande.identifiant])
    descriptif = json.loads(archive.read("marche.json"))

    assert set(descriptif) == {"frames", "meta"}
    assert set(descriptif["frames"][0]) == {
        "filename",
        "frame",
        "rotated",
        "trimmed",
        "spriteSourceSize",
        "sourceSize",
        "duration",
    }
    assert set(descriptif["meta"]) == {
        "app",
        "version",
        "image",
        "format",
        "size",
        "scale",
        "frameTags",
    }
    assert set(descriptif["meta"]["frameTags"][0]) == {
        "name",
        "from",
        "to",
        "direction",
    }
    # Deux valeurs que ce format impose et qu'on n'a pas le droit de traduire :
    # le format des pixels, et l'échelle en chaîne de caractères.
    assert descriptif["meta"]["format"] == "RGBA8888"
    assert descriptif["meta"]["scale"] == "1"


def test_l_etiquette_porte_le_nom_de_l_animation_et_son_sens_de_lecture(
    atelier, client
):
    """*L'étiquette est ce qui fait qu'un moteur fabrique l'animation seul.*

    C'est la raison pour laquelle ce format-ci a été choisi plutôt qu'un atlas
    ordinaire : un moteur qui lit ce champ crée l'animation nommée, sur ces
    images-là, dans ce sens-là, sans une ligne de code.

    **Le sens est dit avec les mots du format**, pas avec les nôtres : `forward`
    et `pingpong`. Écrire « boucle » et « aller-retour » dans un fichier qui
    appartient à quelqu'un d'autre en aurait fait un dialecte.
    """
    en_boucle = _bande(atelier, nom="repos")
    va_et_vient = _bande(atelier, nom="balancement", sens=ALLER_RETOUR)

    archive = _sortir(client, [en_boucle.identifiant, va_et_vient.identifiant])

    premiere = json.loads(archive.read("repos.json"))["meta"]["frameTags"][0]
    seconde = json.loads(archive.read("balancement.json"))["meta"]["frameTags"][0]
    assert premiere == {"name": "repos", "from": 0, "to": 3, "direction": "forward"}
    assert seconde == {
        "name": "balancement",
        "from": 0,
        "to": 3,
        "direction": "pingpong",
    }
    # Pas de nombre de tours : dans ce format, son absence veut dire *sans fin*,
    # et combien de fois une animation tourne appartient au jeu qui la joue.
    assert "repeat" not in premiere


# ── « Une bande sort en image animée, lisible sans moteur de jeu » ───────────


def test_l_image_animee_s_ouvre_comme_une_image_ordinaire(atelier, client):
    """*Une bande sort en image animée, lisible sans moteur de jeu.*

    Et mieux que ça : **une visionneuse qui ne saurait pas l'animer affiche la
    première image au lieu d'échouer**, parce qu'un PNG animé est un PNG. C'est
    ce que mesure la dernière ligne — le fichier ouvert sans rien demander
    d'animé rend la première case de la planche.
    """
    bande = _bande(atelier)

    archive = _sortir(client, [bande.identifiant])
    octets = archive.read("marche-anime.png")

    assert octets[:8] == b"\x89PNG\r\n\x1a\n"
    lues, _ = _images_animees(octets)
    assert len(lues) == CASES

    from PIL import Image

    with Image.open(io.BytesIO(octets)) as ouverte:
        premiere = np.array(ouverte.convert("RGBA"))
    assert np.array_equal(premiere, planche_connue()[:, :LARGEUR])


# ── « La cadence est écrite, et l'image animée la respecte » ─────────────────


def test_la_cadence_voyage_dans_le_descriptif_et_l_image_animee_la_respecte(
    atelier, client
):
    """*La cadence est écrite dans le descriptif, et l'image animée la respecte.*

    **Le même nombre des deux côtés, arrondi une seule fois.** Douze images par
    seconde ne tombent pas juste en millièmes de seconde ; deux arrondis
    séparés auraient fait dire quatre-vingt-trois au descriptif et
    quatre-vingt-quatre à l'image.
    """
    bande = _bande(atelier, cadence=12.0)

    archive = _sortir(client, [bande.identifiant])
    descriptif = json.loads(archive.read("marche.json"))
    _, durees = _images_animees(archive.read("marche-anime.png"))

    attendu = round(1000 / 12)
    assert {image["duration"] for image in descriptif["frames"]} == {attendu}
    assert durees == [float(attendu)] * CASES


def test_un_aller_retour_redescend_sans_rejouer_les_bouts(atelier, client):
    """*L'image animée joue ce que l'écran montrait — le va-et-vient compris.*

    Sur quatre cases, un aller-retour en joue **six** : 0, 1, 2, 3, 2, 1. Huit
    marquerait un temps d'arrêt à chaque extrémité, ce qui se voit à l'œil sur
    un balancement — et ce n'est pas ce que la vignette de la matrice fait.

    ⚠️ La fiche de la bande annonçait huit images jusqu'à cette tranche : le
    nombre ne paraissait nulle part, personne ne l'avait vu, et `A4` le fait
    sortir de l'atelier. Un nombre qui part dans un fichier de jeu doit être
    celui que le fichier joue.
    """
    bande = _bande(atelier, sens=ALLER_RETOUR, cadence=8.0)

    archive = _sortir(client, [bande.identifiant])
    lues, _ = _images_animees(archive.read("marche-anime.png"))
    fiche = json.loads(archive.read("descriptif.json"))["animations"][0]

    assert len(lues) == 6
    planche = planche_connue()
    for rang, case in enumerate([0, 1, 2, 3, 2, 1]):
        assert np.array_equal(
            lues[rang], planche[:, case * LARGEUR : (case + 1) * LARGEUR]
        )
    assert fiche["secondes"] == pytest.approx(6 / 8)


# ── « Ce qui sort est exactement ce que l'aperçu montrait » ──────────────────


def test_la_planche_de_l_archive_est_octet_pour_octet_celle_de_l_ecran(
    atelier, client
):
    """*Ce qui sort est exactement ce que l'aperçu montrait — mêmes pixels.*

    La comparaison se fait **sur les octets**, pas sur les pixels, et c'est plus
    fort : ce n'est pas seulement la même image, c'est le même fichier. Il n'y a
    qu'un seul endroit du produit qui assemble une planche, et l'export ne fait
    que le demander.
    """
    bande = _bande(atelier)

    archive = _sortir(client, [bande.identifiant])
    montree = client.get(f"/api/strips/{bande.identifiant}/sheet")

    assert montree.status_code == 200
    assert archive.read("marche.png") == montree.content


def test_chaque_image_animee_est_la_case_de_la_planche_pixel_pour_pixel(
    atelier, client
):
    """*Mêmes pixels, même fenêtre* — et l'image animée n'y échappe pas.

    Elle est **découpée dans la planche exportée**, ce qui rend la divergence
    impossible plutôt qu'improbable. Refaire les images une seconde fois pour
    l'animation aurait rouvert la porte que le montage avait fermée.
    """
    bande = _bande(atelier, cases=5)

    archive = _sortir(client, [bande.identifiant])
    lues, _ = _images_animees(archive.read("marche-anime.png"))

    planche = planche_connue(cases=5)
    assert len(lues) == 5
    for rang in range(5):
        assert np.array_equal(
            lues[rang], planche[:, rang * LARGEUR : (rang + 1) * LARGEUR]
        )


# ── « Toutes les bandes d'un personnage en une seule archive » ───────────────


def test_toutes_les_bandes_d_un_personnage_sortent_en_une_seule_archive(
    atelier, client
):
    """*Toutes les bandes d'un personnage sortent en une seule archive.*

    Une seule, et non trois qu'il faudrait rassembler à la main. Le nom de
    chaque fichier porte celui du personnage : sorti de l'archive et posé dans
    un dossier de jeu, `marche.png` ne dirait pas de qui c'est la marche.
    """
    personnage = _personnage(client)
    for nom, pose in (("marche", "marche"), ("repos", "repos"), ("saut", "saut")):
        _bande(atelier, personnage=personnage, pose=pose, nom=nom)

    reponse = client.post(f"/api/characters/{personnage}/strips/export", json={})
    assert reponse.status_code == 200, reponse.text
    archive = zipfile.ZipFile(io.BytesIO(reponse.content))

    assert sorted(archive.namelist()) == [
        "descriptif.json",
        "le-nain-marche-anime.png",
        "le-nain-marche.json",
        "le-nain-marche.png",
        "le-nain-repos-anime.png",
        "le-nain-repos.json",
        "le-nain-repos.png",
        "le-nain-saut-anime.png",
        "le-nain-saut.json",
        "le-nain-saut.png",
    ]
    assert 'filename="le-nain-animations-' in reponse.headers["content-disposition"]


def test_deux_animations_du_meme_nom_ne_s_ecrasent_pas(atelier, client):
    """Deux bandes appelées « marche », et deux jeux de fichiers distincts.

    Le nom d'une animation est celui que l'auteur a tapé ; rien ne l'empêche de
    le taper deux fois — une marche de face et une marche de dos, gardées avant
    que les directions ne soient déclarées. **Le descriptif dit lequel est
    lequel** : le nom de fichier est une commodité de lecture, jamais un
    identifiant, et c'est la règle que l'archive des images applique déjà.
    """
    personnage = _personnage(client)
    premiere = _bande(atelier, personnage=personnage, pose="marche", nom="marche")
    seconde = _bande(atelier, personnage=personnage, pose="marche", nom="marche")

    reponse = client.post(f"/api/characters/{personnage}/strips/export", json={})
    archive = zipfile.ZipFile(io.BytesIO(reponse.content))
    fiches = json.loads(archive.read("descriptif.json"))["animations"]

    assert "le-nain-marche.png" in archive.namelist()
    assert "le-nain-marche-2.png" in archive.namelist()
    assert [f["identifiant"] for f in fiches] == [
        premiere.identifiant,
        seconde.identifiant,
    ]


def test_un_personnage_sans_animation_le_dit_au_lieu_de_rendre_une_archive_vide(
    client,
):
    """Le filet, avec sa phrase — l'écran grise d'abord.

    Même motif que la sortie d'un personnage sans aucune pose remplie : l'agent,
    lui, n'a pas d'écran devant lui, et c'est cette phrase-là qu'il répétera.
    """
    personnage = _personnage(client)

    reponse = client.post(f"/api/characters/{personnage}/strips/export", json={})

    assert reponse.status_code == 409, reponse.text
    assert "aucune animation gardée" in reponse.json()["raison"]


# ── Le descriptif de l'atelier : ce que le format emprunté ne dit pas ────────


def test_le_descriptif_de_l_atelier_dit_de_quel_clip_et_avec_quelle_recette(
    atelier, client
):
    """De quoi refaire l'animation, une fois qu'elle est dehors.

    **Une bande ne se relance pas, elle se refait** : les numéros d'image du
    clip, la fenêtre et la recette suffisent — c'est la règle 5 de
    `docs/ARCHITECTURE.md`, et ce descriptif est ce qui la rend vraie hors de
    l'atelier.

    Rangées sous `animations` et non sous `assets` : une bande n'est pas une
    image, et les mettre sous la même clé ferait croire à un agent qu'il peut
    les charger de la même façon.
    """
    bande = _bande(atelier, nom="marche")

    archive = _sortir(client, [bande.identifiant])
    descriptif = json.loads(archive.read("descriptif.json"))

    assert "assets" not in descriptif
    assert descriptif["compte"] == 1
    fiche = descriptif["animations"][0]
    assert fiche["planche"] == "marche.png"
    assert fiche["descriptif"] == "marche.json"
    assert fiche["animee"] == "marche-anime.png"
    assert fiche["clip"] == "clip-paye"
    assert fiche["images"] == [0, 1, 2, 3]
    assert fiche["cadence"] == 8.0
    assert fiche["case_largeur"] == LARGEUR
    assert fiche["case_hauteur"] == HAUTEUR
    assert fiche["duree_image_ms"] == 125
    assert fiche["cadre"]["largeur"] == LARGEUR
    assert fiche["empreinte"] == bande.recette.empreinte()


# ── Rien ne dépense, et les refus ───────────────────────────────────────────


def test_faire_sortir_des_animations_n_appelle_personne(atelier, client, double):
    """*Rien ne dépense* — et ça se compte, plutôt que de se promettre.

    Le clip a été payé une fois, il y a longtemps. Le découper ne coûte rien
    (`A10`), et le faire sortir non plus : c'est du disque et du processeur.
    """
    bande = _bande(atelier)
    avant = double.appels

    _sortir(client, [bande.identifiant])
    client.post(f"/api/characters/{_personnage(client)}/strips/export", json={})

    assert double.appels == avant


def test_une_selection_vide_est_refusee_avec_une_phrase(client):
    reponse = client.post("/api/strips/export", json={"identifiants": []})

    assert reponse.status_code == 409, reponse.text
    assert reponse.json()["raison"] == "aucune animation sélectionnée"


def test_une_animation_disparue_est_refusee_en_la_nommant(client):
    """Nommée, parce que la sélection en contenait douze et qu'il faut savoir
    laquelle — même règle que l'archive des images."""
    reponse = client.post(
        "/api/strips/export", json={"identifiants": ["bande-envolee"]}
    )

    assert reponse.status_code == 409, reponse.text
    assert "bande-envolee" in reponse.json()["raison"]


# ── Le chemin entier, sur un vrai clip ──────────────────────────────────────
#
# **Les essais du dessus posent la planche sur le disque** pour se passer du
# décodeur vidéo. Celui-ci part de l'autre bout : un clip décodé image par
# image, une bande taillée dedans par le montage, et l'archive au bout. C'est le
# seul qui prouve que les deux moitiés se rejoignent — et le seul qui soit sauté
# là où le décodeur manque.


@pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur vidéo n'est pas installé — il n'y a aucun clip à découper",
)
def test_une_bande_taillee_dans_un_vrai_clip_sort_entiere(
    atelier_video, client_video, clip
):
    """Le chemin entier : un clip payé, une bande gardée, une archive.

    **Et l'appel payé voyage avec.** Une bande ne se relance pas ; le clip dont
    elle est tirée, lui, a coûté quelque chose, et le descriptif de l'atelier
    est le seul endroit qui le gardera une fois l'animation dehors.
    """
    gardee = client_video.post(
        "/api/strips",
        json={
            "clip": clip,
            "nom": "marche",
            "images": [10, 12, 14, 16],
            "cadence": 10.0,
        },
    )
    assert gardee.status_code == 200, gardee.text
    bande = gardee.json()

    reponse = client_video.post(
        "/api/strips/export", json={"identifiants": [bande["identifiant"]]}
    )
    assert reponse.status_code == 200, reponse.text
    archive = zipfile.ZipFile(io.BytesIO(reponse.content))

    # Les mêmes octets que ce que l'écran montre, et l'image animée découpée
    # dedans : les deux critères qui comptent, mesurés sur de vraies images.
    montree = client_video.get(f"/api/strips/{bande['identifiant']}/sheet")
    assert archive.read("marche.png") == montree.content
    lues, durees = _images_animees(archive.read("marche-anime.png"))
    assert len(lues) == 4
    assert durees == [100.0] * 4

    descriptif = json.loads(archive.read("marche.json"))
    assert descriptif["meta"]["size"]["w"] == bande["case_largeur"] * 4
    assert descriptif["frames"][0]["frame"]["w"] == bande["case_largeur"]

    fiche = json.loads(archive.read("descriptif.json"))["animations"][0]
    assert fiche["clip"] == clip
    assert fiche["images"] == [10, 12, 14, 16]
    assert fiche["generation"]["identifiant"] == clip
    assert fiche["generation"]["modele"] == MELE.identifiant


@pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur vidéo n'est pas installé — il n'y a aucun clip à découper",
)
def test_une_planche_effacee_revient_a_l_export(atelier_video, client_video, clip):
    """*La planche est un cache* — et l'export le prouve en la perdant.

    Effacer le fichier ne perd rien : la fiche porte les numéros d'image, la
    fenêtre et la recette, et le montage refait le rendu. C'est la règle 5 de
    `docs/ARCHITECTURE.md`, et l'export est l'endroit où elle devient visible —
    ce qui part dans un jeu ne doit pas dépendre d'un fichier qu'on a le droit
    de supprimer.
    """
    bande = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "marche", "images": [10, 12, 14], "cadence": 8.0},
    ).json()
    (atelier_video.fichiers.racine / bande["planche"]).unlink()

    reponse = client_video.post(
        "/api/strips/export", json={"identifiants": [bande["identifiant"]]}
    )

    assert reponse.status_code == 200, reponse.text
    archive = zipfile.ZipFile(io.BytesIO(reponse.content))
    lues, _ = _images_animees(archive.read("marche-anime.png"))
    assert len(lues) == 3
    assert archive.read("marche.png") == client_video.get(
        f"/api/strips/{bande['identifiant']}/sheet"
    ).content
