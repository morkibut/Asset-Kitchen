# -*- coding: utf-8 -*-
"""A10 — un clip payé devient plusieurs bandes.

Les critères de `docs/archive/plan-r6-a-v3.02.md` § A10. **Aucun n'appelle un vrai fournisseur** :
le clip d'ici est fabriqué sur place, image par image, de sorte qu'on sache
exactement ce qu'il contient — un moment immobile, puis un aller-retour qui se
referme. C'est la seule façon de mesurer une détection de rythme : sur un vrai
clip, on ne saurait dire si la machine a trouvé la bonne réponse ou une réponse.

**Ce que la tranche instaure, et que ces essais tiennent.**

1. **Rien ici ne dépense**, et ça se lit dans les imports du service : ni
   catalogue, ni fournisseur, ni animateur. Découper se refait autant qu'on
   veut.
2. **La bande n'est jamais forcée à des images régulièrement espacées** — c'est
   la différence de nature avec tout le reste du produit, où l'on juge entre des
   tirages ; ici on trie *dans* un tirage.
3. **Toutes les bandes d'un clip partagent la même assise**, prise sur le clip
   entier — un personnage ne change pas de taille en passant du repos à la
   marche (mesuré en `A2` : 10 % d'écart sans ça).
4. **Ce qui sort est exactement ce que l'aperçu montrait**, et pas par
   discipline : c'est le même objet, monté par le même chemin.
"""

from __future__ import annotations

import base64
import io

import numpy as np
import pytest

from atelier.domaine.bande import ALLER_RETOUR, BOUCLE, Bande, Cadre, Prise
from atelier.domaine.recette import Grille, Passe, Recette
from atelier.image import clip as decodeur
from atelier.image.rythme import empreintes, lire as lire_le_rythme

from test_a9 import (  # noqa: F401 — fixtures réemployées telles quelles
    MELE,
    AnimateurDouble,
    animateur,
    atelier_video,
    client_video,
    un_personnage,
    un_sprite,
)


pytestmark = pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur vidéo n'est pas installé — le montage n'a rien à découper",
)


# ── Le clip d'essai, et pourquoi il est écrit à la main ─────────────────────


COTE = 64
REPOS = 10  # images où rien ne bouge, au début
PAS = 12  # images d'un aller-retour, qui se referme sur la première


def images_du_clip() -> np.ndarray:
    """Un clip dont on connaît la réponse : un repos, puis un cycle qui boucle.

    **Le sujet est un bloc sombre sur fond blanc**, parce que le détourage par
    le bord doit pouvoir l'isoler : un clip dont le fond n'est pas uni ne
    mesurerait pas le montage, il mesurerait le détourage, et celui-là a ses
    propres essais.

    Les dix premières images sont identiques — c'est le repos. Les douze
    suivantes **tendent un bras** de plus en plus loin, puis le ramènent : la
    douzième enchaîne sur la première, ce qui est la définition d'une boucle qui
    se referme.

    Le bras tendu est là pour une seconde raison, et c'est la plus importante :
    il fait que **le sujet n'occupe pas la même largeur au repos et en
    mouvement**. C'est très exactement le cas qu'`A2` a mesuré — 10 % d'écart
    entre deux images d'un même clip —, donc le seul sur lequel « toutes les
    bandes partagent la même assise » veut dire quelque chose.
    """
    suite = np.full((REPOS + PAS, COTE, COTE, 3), 245, dtype="uint8")
    for numero in range(REPOS):
        suite[numero, 20:50, 8:24] = 30
    for rang in range(PAS):
        # 0 → 6 → 0 : un aller-retour est le cycle le plus court qui bouge et
        # qui revient à son point de départ.
        tendu = (rang if rang <= PAS // 2 else PAS - rang) * 4
        suite[REPOS + rang, 20:50, 8:24] = 30
        if tendu:
            suite[REPOS + rang, 28:36, 24 : 24 + tendu] = 30
    return suite


def clip_connu() -> bytes:
    import imageio.v3 as iio

    return iio.imwrite("<bytes>", images_du_clip(), extension=".mp4", fps=12)


@pytest.fixture
def clip(client_video, animateur) -> str:
    """Un clip arrivé, à découper. Rien n'a été payé : le double facture zéro."""
    animateur.octets = clip_connu()
    animateur.facture = 0.067
    sprite = un_sprite(client_video)
    personnage = un_personnage(client_video)
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "marche"},
    )
    lot = client_video.post(
        "/api/clips",
        json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite},
    ).json()["clips"]
    identifiant = lot[0]["identifiant"]
    for _ in range(300):
        arrives = client_video.get("/api/clips").json()["clips"]
        if arrives and arrives[0]["statut"] == "reussie":
            break
        client_video.get("/api/status")
    return identifiant


def png(data_url: str) -> tuple[int, int]:
    """La taille de l'image qu'un aperçu a rendue en `data:`."""
    from PIL import Image

    octets = base64.b64decode(data_url.split(",", 1)[1])
    with Image.open(io.BytesIO(octets)) as image:
        return image.width, image.height


# ── Le rythme : ce que la machine propose, et ce qu'elle ne décide pas ──────


def test_le_repos_se_trouve_la_ou_rien_ne_bouge():
    """*Les deux propositions de la machine s'affichent sans rien décider.*

    Le clip d'essai porte dix images identiques puis douze qui bougent. La
    proposition de repos doit tomber sur les premières et sur elles seules —
    c'est le seul cas où l'on peut dire qu'une détection a raison plutôt que
    « a répondu ».
    """
    trouvees = lire_le_rythme(
        [_rgba(image) for image in images_du_clip()], cadence=12.0
    )
    repos = [p for p in trouvees if p.quoi == "repos"]
    assert len(repos) == 1
    assert repos[0].debut == 0
    assert repos[0].fin >= REPOS - 2
    assert repos[0].fin < REPOS + 2
    assert "ne bouge presque pas" in repos[0].mot


def test_la_boucle_se_trouve_la_ou_le_cycle_se_referme():
    """*Où le clip se referme le mieux.*

    Le cycle écrit dans le clip d'essai va et revient sur douze images. Ce que
    la machine doit trouver est **un cycle qui bouge**, pas le repos — qui se
    referme pourtant parfaitement, et qui ne vaut rien comme animation. C'est
    tout l'objet de la division par le mouvement intérieur.
    """
    trouvees = lire_le_rythme(
        [_rgba(image) for image in images_du_clip()], cadence=12.0
    )
    boucles = [p for p in trouvees if p.quoi == "boucle"]
    assert len(boucles) == 1
    boucle = boucles[0]
    assert boucle.debut >= REPOS - 1, "la boucle ne doit pas être prise dans le repos"
    assert boucle.longueur >= 6
    assert "se referme" in boucle.mot


def test_un_long_repos_ne_fait_pas_taire_la_detection():
    """⚠️ *Zéro proposition sur le clip le plus lisible qui soit.*

    Vu au serveur le 4 septembre 2026, avant le navigateur. Le seuil du repos
    se prenait sur **la médiane** du mouvement du clip : le raisonnement tenait
    — la médiane résiste à une coupure franche là où la moyenne se laisse tirer
    — mais il se retournait sur le cas qu'on cherche. Un clip dont **la moitié
    des images ne bougent pas** a une médiane nulle, donc un seuil nul, donc
    aucun repos trouvé ; et la boucle, qui se mesurait sur la même médiane,
    disparaissait avec lui.

    C'est-à-dire que la détection se taisait **exactement quand le repos était
    le plus long**, ce qui est le cas d'usage de la version : *deux secondes de
    repos, transition, puis marche* est le texte que le banc a écrit.

    Ce clip-ci a plus d'images immobiles que d'images qui bougent : c'est la
    condition du défaut, et il n'y en a pas d'autre.
    """
    immobiles = 20
    suite = np.full((immobiles + PAS, COTE, COTE, 3), 245, dtype="uint8")
    for numero in range(immobiles):
        suite[numero, 20:50, 8:24] = 30
    for rang in range(PAS):
        tendu = (rang if rang <= PAS // 2 else PAS - rang) * 4
        suite[immobiles + rang, 20:50, 8:24] = 30
        if tendu:
            suite[immobiles + rang, 28:36, 24 : 24 + tendu] = 30

    trouvees = lire_le_rythme([_rgba(image) for image in suite], cadence=12.0)
    assert {p.quoi for p in trouvees} == {"repos", "boucle"}


def test_un_clip_entierement_immobile_ne_propose_rien_plutot_qu_une_invention():
    """**Ne rien proposer est une réponse.**

    Un clip où rien ne bouge n'a pas de boucle à offrir. Une machine qui en
    inventerait une pour remplir la place laisserait l'auteur sans moyen de
    savoir laquelle de ses deux propositions est une mesure.
    """
    fixe = np.full((24, COTE, COTE, 3), 245, dtype="uint8")
    fixe[:, 20:50, 8:24] = 30
    trouvees = lire_le_rythme([_rgba(image) for image in fixe], cadence=12.0)
    assert [p.quoi for p in trouvees] == []


def test_le_rythme_se_mesure_sur_l_image_non_recadree():
    """Un déplacement **est** ce qu'on cherche à voir, et le recadrage l'efface.

    Deux images d'un sujet identique posé à deux endroits différents doivent
    donner une distance non nulle. Recadrer chacune sur sa propre silhouette les
    rendrait identiques — et une marche passerait pour un repos.
    """
    gauche = np.full((COTE, COTE, 3), 245, dtype="uint8")
    gauche[20:50, 8:24] = 30
    droite = np.full((COTE, COTE, 3), 245, dtype="uint8")
    droite[20:50, 36:52] = 30
    signatures = empreintes([_rgba(gauche), _rgba(droite)])
    assert float(np.abs(signatures[0] - signatures[1]).mean()) > 0.01


def _rgba(rgb: np.ndarray) -> np.ndarray:
    alpha = np.full(rgb.shape[:2] + (1,), 255, dtype="uint8")
    return np.concatenate([rgb, alpha], axis=2)


# ── L'accroupi qui planait ──────────────────────────────────────────────────


def test_un_sujet_plus_court_reste_pose_sur_le_sol():
    """⚠️ *Un personnage accroupi flottait, et `A2` ne pouvait pas le voir.*

    Trouvé le 4 septembre 2026, en montant le premier aperçu de cet écran.
    `A2` avait réparé la dérive d'**échelle** et l'avait mesurée ; la dérive de
    **position**, elle, était cachée derrière : chaque image du clip est
    recadrée sur sa propre silhouette, donc une image plus courte que la fenêtre
    se voyait compléter de vide **en bas**, et l'ancrage posait ce vide-là sur
    le sol.

    Mesuré alors, sur deux images d'un même sujet dans une case de 32 :
    l'accroupi occupait les rangées 0 à 18 et **treize rangées vides le
    séparaient du sol**. Il ne changeait pas de taille — `A2` tenait — il
    planait.

    Ce que cet essai tient : les deux sujets touchent le sol, et ils ont la
    même échelle. Les deux à la fois, parce que réparer l'un en cassant l'autre
    serait exactement le genre d'échange qu'on ne voit pas.
    """
    from atelier.domaine.recette import Passe, Recadrage
    from atelier.image.bande import fenetre_commune, monter, preparer
    from atelier.image.traitement import boite_opaque
    from PIL import Image

    def png(rgb: np.ndarray) -> bytes:
        tampon = io.BytesIO()
        Image.fromarray(rgb, "RGB").save(tampon, "PNG")
        return tampon.getvalue()

    debout = np.full((64, 64, 3), 245, dtype="uint8")
    debout[16:56, 24:40] = 30
    accroupi = np.full((64, 64, 3), 245, dtype="uint8")
    accroupi[32:56, 20:44] = 30

    recette = Recette(
        passes=(Passe(),),
        recadrage=Recadrage(),
        grille=Grille(cible=32, occupation=100),
    )
    preparees = [preparer(png(image), recette) for image in (debout, accroupi)]
    fenetre = fenetre_commune(preparees, recette)
    boites = []
    for rendu in monter(preparees, recette, fenetre):
        with Image.open(io.BytesIO(rendu.octets)) as ouverte:
            boites.append(boite_opaque(np.asarray(ouverte.convert("RGBA"))[:, :, 3]))

    assert all(b is not None for b in boites)
    # Le même sol pour les deux : c'est la réparation.
    assert boites[0][3] == boites[1][3]
    # Et la même échelle : c'est ce qu'`A2` tenait déjà, et qui ne doit pas
    # tomber en réparant l'autre. Le sujet est deux fois moins haut en vrai
    # (24 contre 40), il doit l'être aussi en sortie, au pixel d'arrondi près.
    hauteurs = [b[3] - b[1] + 1 for b in boites]
    assert hauteurs[1] == pytest.approx(hauteurs[0] * 24 / 40, abs=1)


# ── Ouvrir un clip ──────────────────────────────────────────────────────────


def test_l_ecran_recoit_tout_ce_qu_il_faut_en_un_seul_aller_retour(
    client_video, clip
):
    """*Un clip s'ouvre déjà en train de tourner, sans qu'on ait à régler quoi que ce soit.*

    Un écran qui tourne dès l'ouverture n'a pas le temps de poser quatre
    questions : le compte d'images, la cadence, la recette du jeu, la fenêtre,
    les propositions et les bandes déjà gardées arrivent ensemble.
    """
    recu = client_video.get(f"/api/montage/{clip}").json()
    assert recu["clip"]["images"] == REPOS + PAS
    assert recu["clip"]["cadence"] > 0
    assert recu["clip"]["largeur"] == COTE
    assert recu["recette_du_jeu"]["grille"] is not None
    assert recu["fenetre"] is not None
    assert recu["fenetre"]["images"] == REPOS + PAS
    assert {p["quoi"] for p in recu["propositions"]} == {"repos", "boucle"}
    assert recu["bandes"] == []


def test_la_fenetre_est_prise_sur_le_clip_entier_et_non_sur_une_bande(
    client_video, clip
):
    """*Toutes les bandes d'un même clip partagent la même assise par défaut.*

    C'est le renversement du 3 septembre 2026, et c'est le cœur d'`A2` : une
    fenêtre par bande cale les images **d'une** bande entre elles ; il faut une
    fenêtre par clip pour caler **les bandes** entre elles. Le clip d'essai est
    écrit pour que ça se voie — le repos occupe une colonne étroite, le cycle
    balaie tout l'écran.
    """
    ouvert = client_video.get(f"/api/montage/{clip}").json()
    du_clip = ouvert["fenetre"]

    au_repos = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": list(range(REPOS)), "cadre": {"choix": "bande"}},
    ).json()
    assert au_repos["fenetre"]["largeur"] < du_clip["largeur"], (
        "le repos occupe moins que le clip entier — sinon l'essai ne mesure rien"
    )

    # Et le défaut, lui, reprend la fenêtre du clip pour la même bande.
    defaut = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": list(range(REPOS))},
    ).json()
    assert defaut["fenetre"]["largeur"] == du_clip["largeur"]
    assert defaut["fenetre"]["hauteur"] == du_clip["hauteur"]


def test_l_etude_ne_se_recalcule_pas_a_chaque_ouverture(client_video, clip):
    """Détourer et mesurer les images d'un clip coûte une vingtaine de secondes.

    *Acceptable une fois, insupportable à chaque cran de curseur* — le plan
    l'avait chiffré avant la tranche. Ce qui coûte cher est donc écrit à côté du
    clip, et la seconde ouverture le relit.
    """
    premiere = client_video.get(f"/api/montage/{clip}").json()
    dossier = client_video.app.state.atelier.fichiers.dossier_images_clip(
        clip, 0
    ).parent
    etude = dossier / "montage.json"
    assert etude.is_file()

    ecrit_le = etude.stat().st_mtime_ns
    seconde = client_video.get(f"/api/montage/{clip}").json()
    assert etude.stat().st_mtime_ns == ecrit_le, "l'étude a été refaite pour rien"
    assert seconde["fenetre"] == premiere["fenetre"]


def test_reprendre_le_cadre_est_un_geste_qu_on_demande(client_video, clip):
    """La fenêtre remesurée sur tout le clip, **à la demande et jamais dans le dos**.

    C'est ce qui répond au détourage changé : la fenêtre gardée a été prise avec
    une autre recette, l'écran le dit, et ce bouton la reprend.
    """
    ouvert = client_video.get(f"/api/montage/{clip}").json()
    assert ouvert["fenetre"]["images"] == REPOS + PAS

    autre = dict(ouvert["recette_du_jeu"])
    repris = client_video.post(
        f"/api/montage/{clip}/frame", json={"clip": clip, "recette": autre}
    ).json()
    assert repris["fenetre"]["images"] == REPOS + PAS
    assert repris["a_jour"] is True


def test_la_planche_contact_tient_tout_le_clip_en_une_image(client_video, clip):
    """Une image plutôt que cent vingt, pour la pellicule **et** pour la loupe.

    Servir les images d'origine pour dessiner un ruban de sept pixels de large
    ferait payer des mégaoctets à un survol.
    """
    ouvert = client_video.get(f"/api/montage/{clip}").json()["contact"]
    reponse = client_video.get(f"/api/montage/{clip}/contact")
    assert reponse.headers["content-type"] == "image/png"

    from PIL import Image

    with Image.open(io.BytesIO(reponse.content)) as image:
        assert image.width == ouvert["colonnes"] * ouvert["cote"]
        assert image.height == ouvert["lignes"] * ouvert["cote"]


# ── Ce que l'aperçu montre ──────────────────────────────────────────────────


def test_l_apercu_rend_une_planche_de_sprites_a_cases_egales(client_video, clip):
    """*Les images retenues se voient dans l'ordre, au format de la bande.*

    L'aperçu **est** une planche de sprites : l'écran l'anime en la décalant,
    l'export l'écrira telle quelle, et le critère *ce qui sort est exactement ce
    que l'aperçu montrait* devient vrai par construction.
    """
    retenues = [0, 3, 5, 11, 14]
    recu = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": retenues}
    ).json()
    assert recu["compte"] == len(retenues)
    largeur, hauteur = png(recu["planche"])
    assert largeur == recu["case_largeur"] * len(retenues)
    assert hauteur == recu["case_hauteur"]


def test_les_images_ne_sont_jamais_forcees_a_etre_regulierement_espacees(
    client_video, clip
):
    """*Un pas de marche demande deux images serrées au contact et une seule
    pendant la glisse.*

    C'est la différence de nature avec la planche : ici on trie **dans** un
    tirage. L'ordre donné est celui qui est monté — y compris s'il remonte le
    temps, ce qu'un aller-retour écrit à la main demande.
    """
    serrees = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": [12, 13, 14, 20, 3, 2]}
    ).json()
    assert serrees["compte"] == 6

    bande = client_video.post(
        "/api/strips",
        json={
            "clip": clip,
            "nom": "marche",
            "images": [12, 13, 14, 20, 3, 2],
        },
    ).json()
    assert bande["images"] == [12, 13, 14, 20, 3, 2]


def test_une_image_qui_n_existe_pas_se_refuse_en_disant_combien_il_y_en_a(
    client_video, clip
):
    """Un refus qui nomme le nombre d'images évite de compter à la main."""
    reponse = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": [0, 999]}
    )
    assert reponse.status_code >= 400
    raison = reponse.json()["raison"]
    assert "999" in raison and str(REPOS + PAS) in raison


def test_une_bande_sans_image_se_refuse(client_video, clip):
    reponse = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": []}
    )
    assert reponse.status_code >= 400
    assert "au moins une image" in reponse.json()["raison"]


# ── Garder, nommer, ranger ──────────────────────────────────────────────────


def test_plusieurs_bandes_se_gardent_depuis_le_meme_clip(client_video, clip):
    """*Plusieurs bandes se gardent depuis le même clip, chacune nommée.*

    C'est ce que la version promet : un clip de cinq secondes porte plus qu'un
    cycle de marche, et le tri se fait dans le tirage.
    """
    for nom, images in (("repos", [0, 2, 4, 6]), ("marche", [10, 12, 14, 16])):
        client_video.post(
            "/api/strips", json={"clip": clip, "nom": nom, "images": images}
        )
    liste = client_video.get("/api/strips", params={"clip": clip}).json()["bandes"]
    assert [b["nom"] for b in liste] == ["repos", "marche"]
    assert all(b["clip"] == clip for b in liste)


def test_une_bande_gardee_dit_quelle_case_elle_remplit_et_un_brouillon_ne_bloque_rien(
    client_video, clip
):
    """*Une bande sans case visée reste un brouillon et ne bloque rien.*

    On garde d'abord, on range ensuite — l'enchaînement que le produit emploie
    partout ailleurs, et qui évite de poser une question au moment où l'on
    découpe pour voir.
    """
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "repos", "images": [0, 2, 4]}
    ).json()
    assert bande["brouillon"] is True
    assert bande["pose"] is None

    rangee = client_video.put(
        f"/api/strips/{bande['identifiant']}/case",
        json={"pose": "marche", "direction": "sud"},
    ).json()
    assert rangee["brouillon"] is False
    assert rangee["pose"] == "marche"
    assert rangee["direction"] == "sud"


def test_retirer_une_bande_de_sa_case_ne_la_supprime_pas(client_video, clip):
    """*Retirer une bande d'une case ne supprime ni la bande, ni le clip* (A12).

    La règle est écrite ici parce que c'est ici qu'elle s'applique, et non dans
    l'écran qui la déclenchera.
    """
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "repos", "images": [0, 2, 4]}
    ).json()
    client_video.put(
        f"/api/strips/{bande['identifiant']}/case", json={"pose": "marche"}
    )
    retiree = client_video.put(
        f"/api/strips/{bande['identifiant']}/case", json={}
    ).json()
    assert retiree["brouillon"] is True
    assert client_video.get("/api/strips", params={"clip": clip}).json()["bandes"]
    assert client_video.get("/api/clips").json()["clips"]


def test_une_bande_se_garde_sous_un_nom(client_video, clip):
    reponse = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "   ", "images": [0, 1]}
    )
    assert reponse.status_code >= 400
    assert "nom" in reponse.json()["raison"]


def test_oublier_une_bande_laisse_le_clip_et_ses_images(client_video, clip):
    """Un découpage raté ne coûte rien — toute la différence avec l'autre moitié
    de l'atelier, où jeter une image est jeter de l'argent."""
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "repos", "images": [0, 2, 4]}
    ).json()
    client_video.delete(f"/api/strips/{bande['identifiant']}")
    assert client_video.get("/api/strips", params={"clip": clip}).json()["bandes"] == []
    assert (
        client_video.get(f"/api/montage/{clip}").json()["clip"]["images"] == REPOS + PAS
    )


# ── Ce qui sort est ce que l'aperçu montrait ────────────────────────────────


def test_la_planche_gardee_est_exactement_celle_de_l_apercu(client_video, clip):
    """*Ce qui sort est exactement ce que l'aperçu montrait.*

    **Au pixel près**, et pas par discipline : c'est le même objet, monté par le
    même chemin. Deux chemins vers les mêmes pixels finiraient par ne plus les
    rendre identiques, et c'est l'auteur qui découvrirait l'écart à l'export.
    """
    images = [0, 4, 12, 16]
    vu = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": images}
    ).json()
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "marche", "images": images}
    ).json()
    sortie = client_video.get(f"/api/strips/{bande['identifiant']}/sheet")
    assert sortie.content == base64.b64decode(vu["planche"].split(",", 1)[1])


def test_la_planche_se_refait_quand_le_cache_a_saute(client_video, clip):
    """*Le rendu est un cache* — effacer le fichier ne perd rien.

    La fiche porte de quoi le refaire : les numéros d'image, la fenêtre et la
    recette. C'est la règle 5 de l'architecture, et une bande n'y fait aucune
    exception.
    """
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "marche", "images": [0, 4, 12]}
    ).json()
    avant = client_video.get(f"/api/strips/{bande['identifiant']}/sheet").content

    fichiers = client_video.app.state.atelier.fichiers
    (fichiers.racine / bande["planche"]).unlink()
    apres = client_video.get(f"/api/strips/{bande['identifiant']}/sheet").content
    assert apres == avant


def test_le_cadre_garde_ses_quatre_nombres_et_pas_une_reference(client_video, clip):
    """Une bande gardée « du clip » garde **le rectangle**, pas le renvoi au clip.

    Sans quoi reprendre le cadre du clip six mois plus tard changerait, en
    silence, une bande déjà livrée dans un jeu.
    """
    ouvert = client_video.get(f"/api/montage/{clip}").json()
    bande = client_video.post(
        "/api/strips", json={"clip": clip, "nom": "repos", "images": [0, 2, 4]}
    ).json()
    assert bande["cadre"]["choix"] == "clip"
    assert bande["cadre"]["gauche"] == ouvert["fenetre"]["gauche"]
    assert bande["cadre"]["droite"] == ouvert["fenetre"]["droite"]
    assert "assise" in bande["cadre"]["mot"]


def test_un_cadre_pose_a_la_main_est_celui_qui_sert(client_video, clip):
    """*Le cadrage se reprend à la main quand l'automatique tombe mal.*

    Et il se reprend **pour de bon** : les quatre nombres que l'auteur pose sont
    ceux de la bande, pas une préférence qu'on note et qu'on n'applique pas.
    Le vérifier sur un cadre volontairement plus large que celui du clip : c'est
    le geste réel — une bande où le personnage quitte le champ a besoin de plus
    de place, jamais de moins.
    """
    ouvert = client_video.get(f"/api/montage/{clip}").json()
    large = {
        "choix": "main",
        "gauche": 0,
        "sommet": 0,
        "droite": ouvert["fenetre"]["largeur"] + 19,
        "bas": ouvert["fenetre"]["hauteur"] + 29,
    }
    vu = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": [0, 4, 12], "cadre": large},
    ).json()
    assert vu["case_largeur"] > 0
    assert "à la main" in vu["cadre"]["mot"]

    bande = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "large", "images": [0, 4, 12], "cadre": large},
    ).json()
    assert bande["cadre"]["choix"] == "main"
    assert bande["cadre"]["largeur"] == ouvert["fenetre"]["largeur"] + 20
    assert bande["cadre"]["hauteur"] == ouvert["fenetre"]["hauteur"] + 30


def test_l_apercu_rend_le_sujet_seul_pour_que_le_cadre_suive_la_main(
    client_video, clip
):
    """*L'aperçu brut suit la main.*

    Le rectangle se redessine à chaque pixel de glissement ; une demande au
    serveur par pixel rendrait le geste impossible. L'aperçu rend donc **la
    première image seule**, sans cadre autour d'elle, et l'écran repose
    lui-même la boîte autour d'elle. `ancrage` voyage avec, parce que c'est la
    règle qui dit où le sujet se pose dans sa boîte : la réécrire à l'écran
    ferait dériver le rectangle qu'on tire de la bande qui en sortira.
    """
    vu = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": [0, 4, 12]}
    ).json()
    assert vu["sujet"].startswith("data:image/png;base64,")
    assert vu["sujet_largeur"] > 0 and vu["sujet_hauteur"] > 0
    assert vu["ancrage"] in ("bas", "centre")

    # Et c'est bien **le sujet seul** : il tient dans le cadre, jamais l'inverse.
    assert vu["sujet_largeur"] <= vu["case_largeur"]
    assert vu["sujet_hauteur"] <= vu["case_hauteur"]


# ── La recette part du jeu, et ce qui s'en écarte se dit ────────────────────


def test_la_recette_part_de_celle_du_jeu_et_une_bande_sans_reglage_n_a_aucun_ecart(
    client_video, clip
):
    """*Elle part de celle du jeu.* Une bande qu'on n'a pas réglée n'a rien à dire."""
    recu = client_video.post(
        "/api/montage/preview", json={"clip": clip, "images": [0, 2, 4]}
    ).json()
    assert recu["ecarts"] == []


def test_tout_ecart_avec_le_jeu_est_ecrit_en_clair(client_video, clip):
    """*Tout écart avec le jeu est écrit en clair* — une phrase par réglage changé.

    C'est tout ce qui reste de la règle d'avant le 3 septembre 2026, et c'en
    était le fond. Un avertissement global dirait qu'il y a un écart et
    laisserait chercher lequel.
    """
    du_jeu = client_video.get(f"/api/montage/{clip}").json()["recette_du_jeu"]
    a_moi = dict(du_jeu)
    a_moi["grille"] = dict(du_jeu["grille"], cible=32)

    recu = client_video.post(
        "/api/montage/preview",
        json={"clip": clip, "images": [0, 2, 4], "recette": a_moi},
    ).json()
    assert any("32 px de haut" in mot for mot in recu["ecarts"])
    assert any(str(du_jeu["grille"]["cible"]) in mot for mot in recu["ecarts"])


def test_la_recette_reglee_ici_s_ecrit_sur_la_bande_et_pas_sur_le_jeu(
    client_video, clip
):
    """*La recette du jeu est le point de départ, jamais une prison.*

    Ce que l'auteur change ici s'écrit **sur la bande** ; le projet ne bouge
    pas d'un cheveu, et la bande suivante repart du jeu.
    """
    du_jeu = client_video.get(f"/api/montage/{clip}").json()["recette_du_jeu"]
    a_moi = dict(du_jeu, grille=dict(du_jeu["grille"], cible=32))
    bande = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "petite", "images": [0, 2], "recette": a_moi},
    ).json()
    assert bande["recette"]["grille"]["cible"] == 32

    apres = client_video.get(f"/api/montage/{clip}").json()
    assert apres["recette_du_jeu"]["grille"]["cible"] == du_jeu["grille"]["cible"]


# ── La vitesse, le sens, et le prix par bande ───────────────────────────────


def test_la_vitesse_reglee_ici_est_celle_qui_part(client_video, clip):
    """*La vitesse réglée ici est celle qui part à l'export.*

    Un seul réglage, et c'est voulu : deux — un pour regarder, un pour livrer —
    finiraient par se contredire, et c'est l'auteur qui découvrirait l'écart
    dans son moteur de jeu.
    """
    bande = client_video.post(
        "/api/strips",
        json={
            "clip": clip,
            "nom": "marche",
            "images": [0, 2, 4, 6],
            "cadence": 14,
            "sens": ALLER_RETOUR,
        },
    ).json()
    assert bande["cadence"] == 14
    assert bande["sens"] == ALLER_RETOUR
    # ⚠️ **Un aller-retour dure presque deux tours, pas tout à fait deux.**
    # Quatre images en jouent six — 0, 1, 2, 3, 2, 1 — et non huit : les deux
    # bouts ne se rejouent pas, sans quoi le mouvement marquerait un temps
    # d'arrêt à chaque extrémité. Cet essai attendait huit jusqu'en `A4`, et il
    # se trompait avec le code : ni la vignette de la matrice ni le format
    # d'export ne rejouent les bouts. Personne ne l'avait vu parce que ce nombre
    # ne paraissait nulle part — `A4` le fait sortir de l'atelier, et un nombre
    # qui part dans un fichier de jeu doit être celui que le fichier joue.
    assert bande["secondes"] == pytest.approx(6 / 14, abs=0.01)


def test_une_cadence_nulle_se_refuse(client_video, clip):
    reponse = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "marche", "images": [0, 2], "cadence": -3},
    )
    assert reponse.status_code >= 400
    assert "cadence" in reponse.json()["raison"]


def test_le_prix_par_bande_baisse_a_chaque_bande_gardee(client_video, clip):
    """*Le prix par bande utilisable de ce clip se lit à l'écran, et il baisse.*

    **C'est ici que se prend le chiffre qui manque à la version** : combien de
    clips pour une bande utilisable, personne ne le sait, et cet affichage-là le
    produit à l'usage, sans banc supplémentaire.
    """
    vide = client_video.get(f"/api/montage/{clip}").json()["prix"]
    assert vide["bandes"] == 0
    assert vide["par_bande"] == pytest.approx(vide["clip"])
    # ⚠️ **Et « une de plus » doit vraiment être moins cher, même à zéro bande.**
    # Écrit `payé / (gardées + 1)`, ce chiffre valait le prix courant sur un
    # clip neuf : l'écran promettait une baisse et n'en montrait aucune. Sans
    # bande gardée, le prix affiché est déjà celui d'une bande — la suivante est
    # donc la deuxième.
    assert vide["si_une_de_plus"] < vide["par_bande"]
    assert vide["si_une_de_plus"] == pytest.approx(vide["clip"] / 2)

    client_video.post(
        "/api/strips", json={"clip": clip, "nom": "repos", "images": [0, 2]}
    )
    une = client_video.get(f"/api/montage/{clip}").json()["prix"]
    assert une["par_bande"] == pytest.approx(une["clip"])
    assert une["si_une_de_plus"] < une["par_bande"]

    client_video.post(
        "/api/strips", json={"clip": clip, "nom": "marche", "images": [10, 12]}
    )
    deux = client_video.get(f"/api/montage/{clip}").json()["prix"]
    assert deux["par_bande"] < une["par_bande"]
    assert deux["par_bande"] == pytest.approx(deux["clip"] / 2)


def test_rien_sur_cet_ecran_n_engage_une_depense(client_video, clip):
    """*Rien sur cet écran n'engage une dépense.*

    On découpe, on garde, on efface, on recommence : le total du projet ne bouge
    pas d'un centime. C'est ce que le pied de l'écran annonce, et ce que les
    imports du service rendent structurel.
    """
    avant = client_video.get("/api/spending").json()
    for tour in range(3):
        client_video.post(
            "/api/montage/preview", json={"clip": clip, "images": [0, 2, 4]}
        )
        bande = client_video.post(
            "/api/strips",
            json={"clip": clip, "nom": f"essai {tour}", "images": [0, 2, 4]},
        ).json()
        client_video.delete(f"/api/strips/{bande['identifiant']}")
    apres = client_video.get("/api/spending").json()
    assert apres["total_usd"] == pytest.approx(avant["total_usd"])
    assert len(apres["appels"]) == len(avant["appels"])


# ── Le disque fait foi ──────────────────────────────────────────────────────


def test_une_bande_gardee_se_relit_apres_un_index_efface(client_video, clip):
    """« Les fichiers font foi, la base est un index reconstructible. »

    Le schéma n'a aucune migration : quand il change, l'index est jeté et refait
    depuis `donnees/`. Une bande qui ne se relirait pas d'ici disparaîtrait au
    premier changement de schéma, sans que rien ne le dise.
    """
    bande = client_video.post(
        "/api/strips",
        json={"clip": clip, "nom": "marche", "images": [0, 4, 12], "cadence": 10},
    ).json()

    atelier = client_video.app.state.atelier
    compte = atelier.bibliotheque.reconstruire()
    assert compte["bandes"] == 1

    relue = client_video.get("/api/strips", params={"clip": clip}).json()["bandes"][0]
    assert relue["identifiant"] == bande["identifiant"]
    assert relue["images"] == [0, 4, 12]
    assert relue["cadence"] == 10
    assert relue["cadre"] == bande["cadre"]


def test_une_bande_dont_le_clip_a_disparu_ne_revient_pas(client_video, clip, tmp_path):
    """Elle ne se recalcule qu'à partir des images de son clip.

    La garder sans lui laisserait une fiche qui ne peut plus rien rendre — même
    règle qu'un asset dont l'image brute n'est plus là.
    """
    client_video.post(
        "/api/strips", json={"clip": clip, "nom": "marche", "images": [0, 4]}
    )
    atelier = client_video.app.state.atelier
    import shutil

    shutil.rmtree(atelier.fichiers.generations / clip)
    assert atelier.bibliotheque.reconstruire()["bandes"] == 0


def test_une_bande_relue_du_json_rend_le_meme_json():
    """Un aller-retour par le disque ne change rien — la fiche fait foi."""
    bande = Bande(
        identifiant="b1",
        clip="c1",
        nom="marche",
        prises=tuple(Prise(numero=n) for n in (3, 1, 4)),
        cadence=11.0,
        sens=BOUCLE,
        cadre=Cadre(choix="main", gauche=2, sommet=3, droite=40, bas=60),
        recette=Recette(passes=(Passe(),), grille=Grille(cible=48)),
        pose="marche",
        direction="sud",
    )
    assert Bande.depuis_json(bande.en_json()).en_json() == bande.en_json()


def test_un_montage_demande_sur_une_generation_qui_n_est_pas_un_clip_se_refuse(
    client_video,
):
    """Le refus nomme ce qu'on a demandé plutôt que de rendre une page vide."""
    sprite = un_sprite(client_video)
    generation = client_video.get("/api/assets").json()["assets"][0]["generation"]
    reponse = client_video.get(f"/api/montage/{generation}")
    assert reponse.status_code >= 400
    assert "n'est pas un clip" in reponse.json()["raison"]
    assert sprite
