# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T4 — le tableau et l'univers.

Un test par critère de `docs/archive/plan-versions-tenues.md` § Phase T4, nommé d'après lui. Deux des
dix-neuf ne se vérifient pas ici parce qu'ils portent sur ce que l'écran montre
— la carte qui paraît en moins d'une seconde pendant qu'on continue à coller, et
le changement de palette qui *se voit*. Ceux-là vivent dans
`interface/src/App.test.tsx`, seul endroit du dépôt où l'interface est montée et
pilotée.

**Aucun test de ce fichier ne coûte un centime**, et trois le prouvent plutôt
que de l'affirmer, en comptant les appels du double avant et après : la palette,
sa réapplication et le tableau entier ne demandent jamais le fournisseur.

**Les artworks sont de vraies images.** Les deux planches de `essais/guide/` ont
servi au banc du 26 août ; ce sont elles qui ont montré que la coupe médiane
brute rend vingt gris sur vingt-quatre. Une palette extraite d'un carré uni ne
dirait rien de ce que la tranche fait vraiment.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from conftest import FournisseurDouble, bloc_mesure, image, image_sujet

from atelier.domaine.erreurs import FournisseurIndisponible
from atelier.domaine.projet import CHAMPS_BIBLE
from atelier.services import Atelier

MODELE = "essai:rend-du-png"
GUIDE = Path(__file__).resolve().parents[1] / "essais" / "guide"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _artworks() -> list[tuple[str, bytes]]:
    """Les planches du guide, telles qu'elles sont sur le disque.

    Sautées plutôt que remplacées si elles ont disparu : un carré uni passerait
    tous les tests de palette sans rien prouver, et un test qui passe pour de
    mauvaises raisons est pire qu'un test absent.
    """
    planches = sorted(GUIDE.glob("*.png"))
    if not planches:
        pytest.skip("les planches de `essais/guide/` ne sont pas sur ce disque")
    return [(c.name, c.read_bytes()) for c in planches]


def _coller(client, nom: str, octets: bytes, **params) -> dict:
    reponse = client.post(
        f"/api/board/paste", params={"nom": nom, **params}, content=octets
    )
    return reponse


def _promouvoir(client, carte: str, famille: str = "tous") -> dict:
    reponse = client.put(
        f"/api/board/{carte}/official", json={"officiel": True, "famille": famille}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _univers_peuple(client, *familles: str) -> list[str]:
    """Deux planches promues, chacune dans la famille qu'on lui donne."""
    identifiants = []
    for (nom, octets), famille in zip(_artworks(), familles or ("tous", "tous")):
        rendue = _coller(client, nom, octets).json()
        identifiants.append(rendue["carte"]["identifiant"])
        _promouvoir(client, identifiants[-1], famille)
    return identifiants


def _generer(client, prompt: str = "un tonneau", **corps) -> dict:
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _attendre(client, identifiant: str) -> dict:
    for _ in range(400):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"la génération « {identifiant} » n'est jamais arrivée à terme")


def _asset(client, generation: dict, rang: int = 0) -> dict:
    reponse = client.get(f"/api/assets/{generation['identifiant']}-{rang}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _rendu(client, identifiant: str) -> bytes:
    asset = client.get(f"/api/assets/{identifiant}").json()
    reponse = client.get(f"/api/assets/{identifiant}/image?v={asset['empreinte']}")
    assert reponse.status_code == 200, reponse.text
    return reponse.content


def _mesurer(octets: bytes) -> tuple[int, int, int]:
    """(hauteur du sujet, largeur du sujet, ligne de sol) dans la case rendue."""
    import io

    import numpy as np
    from PIL import Image

    with Image.open(io.BytesIO(octets)) as ouverte:
        rgba = np.asarray(ouverte.convert("RGBA"))
    lignes = np.where(rgba[:, :, 3] >= 128)[0]
    colonnes = np.where(rgba[:, :, 3].T >= 128)[0]
    if lignes.size == 0:
        return 0, 0, 0
    return (
        int(lignes.max() - lignes.min() + 1),
        int(colonnes.max() - colonnes.min() + 1),
        int(lignes.max()),
    )


# ── « Un projet neuf se crée, reçoit une bible et trois planches, et sa palette
#     est extraite » ────────────────────────────────────────────────────────


def test_un_projet_neuf_recoit_une_bible_des_planches_et_sa_palette_est_extraite(client):
    cree = client.post("/api/projects", json={"nom": "Tourbe et fer"})
    assert cree.status_code == 201, cree.text

    pose = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": "monde", "texte": "royaume de tourbe et de fer", "actif": True},
                {"nom": "trait", "texte": "contour brun d'un pixel", "actif": True},
            ]
        },
    )
    assert pose.status_code == 200, pose.text
    bible = {c["nom"]: c for c in pose.json()["univers"]["bible"]}
    # La liste close décide : tous les champs sont là, deux portent un texte.
    # Comparé à `CHAMPS_BIBLE` et non à une liste recopiée : ce que ce test
    # tient est « le fichier n'apporte que les textes, la liste décide du
    # reste », et une liste écrite ici en ferait une seconde vérité — R2 l'a
    # cassée en portant la bible de cinq champs à sept.
    assert set(bible) == set(CHAMPS_BIBLE)
    assert bible["monde"]["texte"] == "royaume de tourbe et de fer"

    _univers_peuple(client, "personnages", "tous")

    univers = client.get("/api/universe").json()["univers"]
    assert len(univers["palette"]) >= 8
    assert all(c.startswith("#") and len(c) == 7 for c in univers["palette"])
    assert univers["vide"] is False


# ── « La chaîne complète tient d'un bout à l'autre » ─────────────────────────


def test_la_chaine_complete_tient_d_un_bout_a_l_autre(client, double):
    """Un asset se génère, se détoure, se ramène sur la grille et la palette du
    projet, et se range tout seul — sans un geste de retouche."""
    _univers_peuple(client, "personnages", "tous")
    client.put("/api/universe", json={"cible_px": 48})
    double.rendre = lambda: image_sujet(bloc=5)

    generation = _generer(client, "une prêtresse elfe", echelle="personnage")
    asset = _asset(client, generation)

    # rangé tout seul, dans le projet ouvert
    assert asset["projet"] == client.get("/api/library").json()["courant"]
    # détouré, remis sur la grille du projet, ramené sur sa palette
    assert asset["recette"]["passes"], "le détourage n'a pas été posé"
    assert asset["recette"]["grille"]["cible"] == 48
    palette = client.get("/api/universe").json()["univers"]["palette"]
    assert tuple(asset["recette"]["quantification"]["palette"]) == tuple(palette)
    assert (asset["rendu_largeur"], asset["rendu_hauteur"]) == (48, 48)
    # et pas épinglé : rien n'a été posé à la main
    assert asset["epingle"] is False


# ── « Une récupération échouée laisse la carte avec son adresse et sa raison,
#     et se réessaie » ────────────────────────────────────────────────────────


async def test_une_recuperation_echouee_garde_l_adresse_et_la_raison(client, atelier):
    """Aucun réseau n'est touché : l'adresse pointe sur un hôte qui n'existe pas,
    et c'est l'adaptateur qui traduit la panne en une phrase du produit."""
    projet = atelier.bibliotheque.courant
    carte = atelier.univers.coller_adresse(
        projet, "https://hote-qui-n-existe-pas.invalid/planche.png"
    )
    assert carte.statut == "attente"
    assert carte.raison is None

    echouee = await atelier.univers.recuperer(projet, carte.identifiant)
    assert echouee.statut == "echouee"
    assert echouee.source == "https://hote-qui-n-existe-pas.invalid/planche.png"
    assert echouee.raison
    # **Le message de la bibliothèque ne franchit pas le port** : la raison est
    # une phrase du produit, pas « All connection attempts failed ».
    assert "connection" not in echouee.raison.lower()
    assert "failed" not in echouee.raison.lower()

    # Elle reste sur le tableau : rien n'a disparu, et le geste de réessayer est
    # le même appel — « rien n'est jamais relancé automatiquement ».
    tableau = atelier.univers.cartes(projet)
    assert [c.identifiant for c in tableau] == [carte.identifiant]


def test_une_adresse_qui_n_en_est_pas_une_est_refusee_sans_toucher_au_reseau(client, atelier):
    projet = atelier.bibliotheque.courant
    from atelier.services.univers import CarteRefusee

    with pytest.raises(CarteRefusee) as refus:
        atelier.univers.coller_adresse(projet, "file:///C:/Windows/System32/config")
    assert "http" in refus.value.raison


# ── « Un fichier qui n'est pas une image est refusé en le nommant » ──────────


def test_un_fichier_qui_n_est_pas_une_image_est_refuse_en_le_nommant(client):
    refus = _coller(client, "notes-de-lecture.txt", b"ce n'est pas une image")
    assert refus.status_code == 409, refus.text
    charge = refus.json()
    assert "notes-de-lecture.txt" in charge["raison"]
    # **Aucun message de bibliothèque à l'écran.** Pillow dit « cannot identify
    # image file <_io.BytesIO object at 0x…> » : c'est le piège d'`httpx` de T1,
    # et il ne se rejoue pas ici.
    assert "cannot identify" not in charge["raison"]
    assert "BytesIO" not in charge["raison"]

    # Le tableau n'a rien reçu : un refus ne laisse pas de carte à moitié faite.
    assert client.get("/api/board").json()["cartes"] == []


# ── « Un doublon est signalé avec un lien vers l'existant, et s'importe quand
#     même si on le décide » ────────────────────────────────────────────────


def test_un_doublon_est_signale_avec_l_existant_et_s_importe_quand_meme(client):
    nom, octets = _artworks()[0]
    premiere = _coller(client, nom, octets).json()
    assert premiere["carte"] is not None and premiere["doublon"] is None

    seconde = _coller(client, nom, octets).json()
    # Pas un refus : une proposition. L'écran a de quoi faire le lien.
    assert seconde["carte"] is None
    assert seconde["doublon"]["identifiant"] == premiere["carte"]["identifiant"]
    assert len(client.get("/api/board").json()["cartes"]) == 1

    forcee = _coller(client, nom, octets, forcer=True).json()
    assert forcee["carte"] is not None
    assert forcee["carte"]["identifiant"] != premiere["carte"]["identifiant"]
    assert len(client.get("/api/board").json()["cartes"]) == 2


# ── « Générer un décor n'envoie aucun artwork de la famille personnages ; une
#     planche marquée "tous" part avec toutes les générations » ──────────────


def test_la_famille_du_sujet_decide_de_ce_qui_part_en_reference(client, double):
    personnage, planche = _univers_peuple(client, "personnages", "tous")

    decor = _generer(client, "une clairière", echelle="décor")
    assert double.references_recues[-1] == 1, "le décor a reçu un artwork de trop"

    heros = _generer(client, "un chevalier", echelle="personnage")
    assert double.references_recues[-1] == 2, "le personnage n'a pas reçu les deux"

    # Et l'enregistrement dit **lesquels** sont partis : une génération se relit
    # des mois après, même si l'univers a changé depuis.
    parties = client.get(f"/api/generations/{heros['identifiant']}").json()["references"]
    assert {r["asset"] for r in parties} == {personnage, planche}
    assert all(r["origine"] == "carte" and r["role"] == "style" for r in parties)

    # Le décor, lui, n'a emporté que la planche « tous ».
    du_decor = client.get(f"/api/generations/{decor['identifiant']}").json()["references"]
    assert [r["asset"] for r in du_decor] == [planche]


def test_un_artwork_retire_ne_bloque_pas_la_relance_des_generations_passees(
    client, double
):
    """Retirer un artwork est un geste courant que la tranche encourage (US-55).

    S'il rendait non relançables toutes les générations de l'univers, US-19 —
    « relancer un raté d'un geste » — tomberait au premier retrait.
    """
    _, planche = _univers_peuple(client, "personnages", "tous")
    double.echec = FournisseurIndisponible("le fournisseur ne répond pas")
    rate = _generer(client, "un chevalier", echelle="personnage")
    double.echec = None

    client.delete(f"/api/board/{planche}")

    relancee = client.post(
        f"/api/generations/{rate['identifiant']}/slots/0/retry"
    )
    assert relancee.status_code == 200, relancee.text
    assert _attendre(client, rate["identifiant"])["statut"] == "reussie"
    # Elle est repartie avec l'univers **tel qu'il est aujourd'hui**.
    assert double.references_recues[-1] == 1


# ── « Le nombre de références envoyées est visible au moment de générer » ────


def test_le_nombre_de_references_envoyees_est_visible_avant_de_generer(client, double):
    _univers_peuple(client, "personnages", "tous")

    avant = double.appels
    compte = client.get("/api/models", params={"echelle": "personnage"}).json()["references"]
    # **Les quatre chiffres de T4**, et non l'objet entier : C1 a ajouté à la
    # même charge la liste ligne par ligne et le compte des concept arts
    # (US-127). Le critère de T4 porte sur ce qui est *visible avant de
    # générer*, pas sur la forme exacte d'une charge qui devait grossir.
    assert {c: compte[c] for c in ("total", "manuelles", "artworks", "famille")} == {
        "total": 2,
        "manuelles": 0,
        "artworks": 2,
        "famille": "personnages",
    }
    assert client.get("/api/models", params={"echelle": "meuble"}).json()["references"][
        "artworks"
    ] == 1
    # Le compte est un calcul, jamais un appel.
    assert double.appels == avant

    # Et il **dédoublonne avec ce que l'auteur a posé** : le compte affiché est
    # celui qui partira, pas la somme de deux listes qui se recouvrent.
    avec_manuelles = client.get(
        "/api/models", params={"echelle": "personnage", "references": 1}
    ).json()["references"]
    assert avec_manuelles["total"] == 3
    assert avec_manuelles["manuelles"] == 1


# ── « Retirer un artwork officiel recalcule la palette » ─────────────────────


def test_retirer_un_artwork_officiel_recalcule_la_palette(client, double):
    premier, second = _univers_peuple(client, "personnages", "tous")
    avant = client.get("/api/universe").json()["univers"]["palette"]
    assert len(avant) >= 8

    appels = double.appels
    retire = client.put(f"/api/board/{second}/official", json={"officiel": False})
    apres = retire.json()["univers"]["palette"]

    assert apres != avant, "la palette n'a pas bougé alors qu'un artwork est parti"
    assert double.appels == appels, "recalculer la palette a coûté un appel"

    # Et supprimer la carte entière fait la même chose.
    encore = client.delete(f"/api/board/{premier}").json()["univers"]
    assert encore["palette"] == ()  or encore["palette"] == []
    assert encore["vide"] is True


# ── « Chaque champ de la bible s'active et se désactive indépendamment » ─────


def test_chaque_champ_de_la_bible_s_active_independamment(client, double):
    client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": "monde", "texte": "tourbe et fer", "actif": True},
                {"nom": "epoque", "texte": "haut moyen âge", "actif": False},
                {"nom": "trait", "texte": "contour brun", "actif": True},
            ]
        },
    )
    _generer(client, "un tonneau")
    parti = double.demandes[-1].prompt

    assert "tourbe et fer" in parti
    assert "contour brun" in parti
    assert "haut moyen âge" not in parti, "un champ désactivé est parti quand même"
    # **Le sujet n'est plus le dernier mot, et c'est mesuré** (1ᵉʳ septembre
    # 2026). Le cadre et la caméra ferment le texte depuis qu'un banc a montré
    # que la dernière phrase décide de la vue — `essais/essai_vue.py`, 1,55 à
    # 1,13 — et de la place du sujet dans l'image — `essais/essai_deux_jeux.py`,
    # 14,7 % à 20,1 % d'aire. Ce que cet essai protège reste entier : le sujet de
    # l'auteur part, et il part après la bible.
    bloc_du_sujet = "\n\nun tonneau\n\n"
    assert bloc_du_sujet in parti, "le sujet de l'auteur doit partir, après la bible"
    assert parti.rstrip().endswith("no frame, no border."), "le cadre ferme le texte"

    # Le champ inactif n'est pas perdu pour autant : il attend d'être rallumé.
    bible = {c["nom"]: c for c in client.get("/api/universe").json()["univers"]["bible"]}
    assert bible["epoque"]["texte"] == "haut moyen âge"
    assert bible["epoque"]["actif"] is False


# ── « Générer sans bible ni artwork fonctionne » ─────────────────────────────


def test_generer_sans_bible_ni_artwork_fonctionne(client, double):
    """Un univers vide ne contraint rien plutôt que de bloquer (US-57)."""
    univers = client.get("/api/universe").json()["univers"]
    assert univers["vide"] is True
    assert univers["palette"] == []

    generation = _generer(client, "un tonneau")
    assert generation["statut"] == "reussie"
    assert double.references_recues[-1] == 0
    assert double.demandes[-1].prompt == "REQUEST\n\nun tonneau"

    # La grille du projet s'applique quand même : « un univers vide ne contraint
    # rien » ne veut pas dire « un univers vide ne fait rien ».
    asset = _asset(client, generation)
    assert asset["recette"]["grille"]["cible"] == 64
    # **Et la quantification aussi, depuis D2.** Sans artwork il n'y a pas de
    # palette imposée — mais il y a un nombre de couleurs, et le réduire est
    # exactement ce qui distingue un sprite d'une image rétrécie.
    assert asset["recette"]["quantification"]["palette"] == []
    assert asset["recette"]["quantification"]["couleurs"] == 32


# ── « Un personnage et un petit objet sortent avec la même taille de pixel » ─


def test_un_personnage_et_un_petit_objet_sortent_avec_la_meme_taille_de_pixel(
    client, double
):
    """Quelle que soit la grille rendue par le modèle (US-60, US-61)."""
    client.put("/api/universe", json={"cible_px": 64})

    double.rendre = lambda: image_sujet(logique_l=8, logique_h=16, bloc=4, toile=24)
    personnage = _asset(client, _generer(client, "un héros", echelle="personnage"))

    # Le même sujet peint sur une grille **cinq fois** plus grosse.
    double.rendre = lambda: image_sujet(logique_l=8, logique_h=16, bloc=20, toile=24)
    objet = _asset(client, _generer(client, "une fiole", echelle="personnage"))

    assert personnage["recette"]["grille"]["cible"] == objet["recette"]["grille"]["cible"] == 64
    assert bloc_mesure(_rendu(client, personnage["identifiant"])) == bloc_mesure(
        _rendu(client, objet["identifiant"])
    )


# ── « Un personnage et un petit objet sortent à leur échelle respective,
#     ancrés sur la même ligne de sol » ─────────────────────────────────────


def test_le_bareme_du_projet_decide_de_l_echelle_pas_un_reglage_a_la_main(
    client, double
):
    double.rendre = lambda: image_sujet(logique_l=8, logique_h=16, bloc=4, toile=24)
    personnage = _asset(client, _generer(client, "un héros", echelle="personnage"))
    objet = _asset(client, _generer(client, "une fiole", echelle="objet tenu"))

    haut_p, _, sol_p = _mesurer(_rendu(client, personnage["identifiant"]))
    haut_o, _, sol_o = _mesurer(_rendu(client, objet["identifiant"]))

    # Deux échelles, deux hauteurs — et c'est le barème qui les décide : aucun
    # réglage n'a été touché entre les deux appels.
    assert haut_p > haut_o, "le petit objet sort aussi haut que le personnage"
    assert personnage["recette"]["grille"]["occupation"] == 100
    assert objet["recette"]["grille"]["occupation"] == 40
    # Et ils reposent sur la même ligne de sol.
    assert sol_p == sol_o


def test_un_decor_n_est_pas_enferme_dans_une_case_carree(client, double):
    """Un décor n'a pas de silhouette : le barème le dit, et la recette suit."""
    double.rendre = lambda: image("PNG", (128, 72))
    decor = _asset(client, _generer(client, "une clairière", echelle="décor"))

    assert decor["recette"]["passes"] == []
    assert decor["rendu_largeur"] != decor["rendu_hauteur"]
    assert max(decor["rendu_largeur"], decor["rendu_hauteur"]) == 64


# ── « La remise sur grille est systématique, jamais optionnelle, et la cible
#     n'est jamais déduite de l'image reçue » ─────────────────────────────────


def test_la_remise_sur_grille_est_systematique_et_la_cible_n_est_jamais_deduite(
    client, double
):
    client.put("/api/universe", json={"cible_px": 32})

    for bloc, toile in ((2, 24), (12, 24), (20, 24)):
        double.rendre = lambda bloc=bloc, toile=toile: image_sujet(bloc=bloc, toile=toile)
        asset = _asset(client, _generer(client, f"un sujet à {bloc}", echelle="personnage"))
        assert asset["recette"]["grille"] is not None, "la grille n'a pas été posée"
        assert asset["recette"]["grille"]["cible"] == 32
        assert (asset["rendu_largeur"], asset["rendu_hauteur"]) == (32, 32)


# ── « La quantification n'est plus jamais grisée, et une note dit pourquoi »
#
#    **Réécrit en D2, et c'est un renversement assumé.** Ces deux tests
#    figeaient le grisé de T2 : sans artwork officiel, pas de palette, donc pas
#    de quantification — ni posée par le projet, ni acceptée si on l'écrivait à
#    la main. Mesuré le 3 septembre 2026, ce grisé coûtait bien plus qu'il ne
#    protégeait : un projet sans artwork rendait des sprites de dix mille
#    couleurs, et rien à l'écran ne le disait.
#
#    Ce qu'ils gardent est donc l'inverse, et c'est la garantie qui compte
#    maintenant : le traitement a lieu, et l'écran annonce d'où viennent les
#    couleurs. ────────────────────────────────────────────────────────────────


def test_la_quantification_n_est_plus_grisee_et_la_note_dit_pourquoi(client):
    vide = client.get("/api/status").json()["traitement"]["quantification"]
    assert vide["raison"] is None, "la quantification ne se grise plus"
    assert "aucun artwork officiel" in vide["note"]

    _univers_peuple(client, "tous", "tous")

    peuple = client.get("/api/status").json()["traitement"]["quantification"]
    assert peuple["raison"] is None
    assert peuple["note"] is None, "la note tombe dès que la palette existe"


def test_une_quantification_sans_palette_est_acceptee_et_reduit_vraiment(
    client, double
):
    """Palette vide veut dire « déduites de l'image », pas « pièce manquante ».

    C'est le défaut que D2 répare : le réglage `couleurs` de l'univers existait
    depuis T4 et **ne faisait rien** tant qu'aucun artwork n'était promu.
    """
    double.rendre = lambda: image_sujet(bloc=4)
    asset = _asset(client, _generer(client, "un tonneau", echelle="personnage"))

    # Le projet la pose tout seul, sans qu'aucun artwork existe.
    assert asset["recette"]["quantification"] is not None
    assert asset["recette"]["quantification"]["palette"] == []

    # Et elle s'écrit aussi à la main, sans être refusée.
    recette = {
        **asset["recette"],
        "quantification": {"couleurs": 16, "palette": [], "tramage": "aucun"},
    }
    pose = client.put(f"/api/assets/{asset['identifiant']}/recipe", json=recette)
    assert pose.status_code == 200, pose.text
    assert pose.json()["recette"]["quantification"]["couleurs"] == 16


# ── « Changer la palette du projet remet ses assets à jour sans un seul appel
#     payant, saute les épinglés, et affiche le compte des deux » ────────────


def test_changer_la_palette_remet_les_assets_a_jour_sans_un_appel_et_saute_les_epingles(
    client, double
):
    double.rendre = lambda: image_sujet(bloc=4)
    premier = _asset(client, _generer(client, "un tonneau", echelle="personnage"))
    second = _asset(client, _generer(client, "une fiole", echelle="personnage"))
    epingle = _asset(client, _generer(client, "un coffre", echelle="personnage"))

    # Un réglage posé à la main épingle — et c'est ce qui le protège.
    reglee = {**epingle["recette"], "bords": {"aire_min": 5}}
    pose = client.put(f"/api/assets/{epingle['identifiant']}/recipe", json=reglee)
    assert pose.status_code == 200, pose.text
    assert pose.json()["epingle"] is True

    _univers_peuple(client, "personnages", "tous")
    palette = client.get("/api/universe").json()["univers"]["palette"]

    appels = double.appels
    compte = client.post("/api/universe/realign", json={}).json()
    assert double.appels == appels, "la réapplication a appelé le fournisseur"

    assert compte["realignes"] == 2, compte
    assert compte["conserves"] == 1, compte

    for identifiant in (premier["identifiant"], second["identifiant"]):
        remis = client.get(f"/api/assets/{identifiant}").json()
        assert tuple(remis["recette"]["quantification"]["palette"]) == tuple(palette)

    conserve = client.get(f"/api/assets/{epingle['identifiant']}").json()
    assert conserve["epingle"] is True
    assert conserve["recette"]["bords"] == {"aire_min": 5}
    # **L'épinglé garde la quantification qu'il avait à sa naissance** — sans
    # palette, donc sur ses propres couleurs (D2). Ce qui compte ici est qu'il
    # n'ait **pas** reçu celle du projet : le balayage l'a bien sauté.
    assert conserve["recette"]["quantification"]["palette"] == []


def test_un_asset_ramene_au_brut_reste_au_brut(client, double):
    """« Revenir à l'image d'origine est un seul geste » (US-64) — un balayage
    de palette ne défait pas ce geste-là."""
    double.rendre = lambda: image_sujet(bloc=4)
    asset = _asset(client, _generer(client, "un tonneau", echelle="personnage"))
    client.post(f"/api/assets/{asset['identifiant']}/reset")

    _univers_peuple(client, "tous", "tous")
    compte = client.post("/api/universe/realign", json={}).json()
    assert compte["conserves"] == 1

    intact = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert intact["traite"] is False


# ── « Un asset épinglé se réaligne d'un geste depuis sa fiche » ──────────────


def test_un_asset_epingle_se_realigne_d_un_geste(client, double):
    double.rendre = lambda: image_sujet(bloc=4)
    asset = _asset(client, _generer(client, "un coffre", echelle="personnage"))
    reglee = {**asset["recette"], "bords": {"aire_min": 5}}
    client.put(f"/api/assets/{asset['identifiant']}/recipe", json=reglee)

    _univers_peuple(client, "tous", "tous")
    palette = client.get("/api/universe").json()["univers"]["palette"]

    appels = double.appels
    compte = client.post(
        "/api/universe/realign", json={"identifiants": [asset["identifiant"]]}
    ).json()
    assert double.appels == appels

    assert compte["realignes"] == 1 and compte["conserves"] == 0
    rentre = client.get(f"/api/assets/{asset['identifiant']}").json()
    assert rentre["epingle"] is False, "le réalignement demandé n'a pas désépinglé"
    assert tuple(rentre["recette"]["quantification"]["palette"]) == tuple(palette)
    # Ce qu'il avait réglé à la main est conservé : réaligner n'est pas remettre
    # à zéro — seule la part que l'univers porte est réécrite.
    assert rentre["recette"]["bords"] == {"aire_min": 5}


# ── « Le modèle est un défaut par type d'asset porté par l'univers » ─────────


def test_le_modele_est_un_defaut_par_type_d_asset_pas_un_reglage_global(client):
    client.put(
        "/api/universe",
        json={"modeles": {"personnages": "essai:rend-du-png", "decors": "essai:rend-du-jpeg"}},
    )
    _univers_peuple(client, "personnages", "tous")

    assert (
        client.get("/api/models", params={"echelle": "personnage"}).json()["defaut"]["modele"]
        == "essai:rend-du-png"
    )
    assert (
        client.get("/api/models", params={"echelle": "décor"}).json()["defaut"]["modele"]
        == "essai:rend-du-jpeg"
    )
    # Une famille sans réglage retombe sur le défaut du catalogue : il n'y a pas
    # de trou, seulement un réglage qu'on n'a pas posé.
    interface = client.get("/api/models", params={"echelle": "élément d'interface"}).json()
    assert interface["defaut"]["modele"] is not None


def test_une_echelle_inconnue_est_refusee_en_la_nommant(client):
    refus = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un tonneau", "echelle": "chimère"},
    )
    assert refus.status_code == 409, refus.text
    assert "chimère" in refus.json()["raison"]


# ── « Réseau coupé : le tableau, la bible, la palette et la retouche
#     fonctionnent ; seule la génération échoue » ───────────────────────────


def test_reseau_coupe_le_tableau_la_bible_et_la_palette_fonctionnent(client, double):
    """Prouvé en comptant les appels du double avant et après, comme en T3 : le
    hors ligne se démontre, il ne se déclare pas."""
    double.catalogue_lisible = False
    double.echec = FournisseurIndisponible("aucune connexion au fournisseur")
    appels = double.appels

    identifiants = _univers_peuple(client, "personnages", "tous")
    assert client.put(
        "/api/universe",
        json={"bible": [{"nom": "monde", "texte": "hors ligne", "actif": True}], "cible_px": 32},
    ).status_code == 200
    assert client.put(
        f"/api/board/{identifiants[0]}", json={"groupe": "matières", "note": "le trait", "taille": 2}
    ).status_code == 200
    assert client.post("/api/board/text", json={"texte": "une idée"}).status_code == 201

    univers = client.get("/api/universe").json()["univers"]
    assert len(univers["palette"]) >= 8
    assert client.post("/api/universe/realign", json={}).status_code == 200
    assert client.get("/api/board").json()["cartes"]

    assert double.appels == appels, "quelque chose a demandé le fournisseur hors ligne"

    # Seule la génération échoue, et au moment où on l'essaie.
    ratee = _generer(client, "un tonneau")
    assert ratee["statut"] == "echouee"
    assert double.appels > appels


# ── Grouper, annoter, régler la taille (US-47) ───────────────────────────────


def test_une_carte_se_groupe_s_annote_et_garde_sa_provenance(client):
    identifiants = _univers_peuple(client, "tous", "tous")
    reglee = client.put(
        f"/api/board/{identifiants[0]}",
        json={"groupe": "matières", "note": "le grain de la pierre", "taille": 4},
    ).json()

    assert reglee["groupe"] == "matières"
    assert reglee["note"] == "le grain de la pierre"
    assert reglee["taille"] == 4
    assert client.get("/api/board").json()["groupes"] == ["matières"]

    refus = client.put(f"/api/board/{identifiants[0]}", json={"taille": 3})
    assert refus.status_code == 422, refus.text


def test_une_carte_texte_ne_peut_pas_devenir_un_artwork(client):
    carte = client.post("/api/board/text", json={"texte": "une intention"}).json()
    refus = client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert refus.status_code == 409, refus.text
    assert "texte" in refus.json()["raison"]


# ── Le tableau appartient à son projet ──────────────────────────────────────


def test_le_tableau_appartient_a_son_projet_et_part_avec_lui(client):
    """Une image produite se détache et survit ailleurs ; une inspiration n'a de
    sens que dans l'univers pour lequel on l'a rassemblée."""
    premier = client.get("/api/library").json()["courant"]
    _univers_peuple(client, "tous", "tous")

    second = client.post("/api/projects", json={"nom": "Un autre monde"}).json()["projet"]
    assert client.get("/api/board").json()["cartes"] == [], "le tableau a suivi le projet"
    assert client.get("/api/universe").json()["univers"]["vide"] is True

    # Celui d'avant est intact, et il se relit en le nommant.
    assert len(client.get("/api/board", params={"projet": premier}).json()["cartes"]) == 2

    client.delete(f"/api/projects/{premier}")
    assert client.get("/api/board", params={"projet": premier}).status_code == 404


# ── Les fichiers font foi : le tableau survit à l'index effacé ───────────────


def test_le_tableau_et_l_univers_survivent_a_l_index_efface(client, atelier, double):
    """« Les fichiers font foi, la base est un index reconstructible » (T3).

    Les cartes n'entrent jamais dans l'index — elles n'ont aucune question à lui
    poser —, donc l'effacer ne peut pas les perdre. L'univers, lui, vit dans
    `projet.json` et se relit avec le projet.
    """
    _univers_peuple(client, "personnages", "tous")
    client.put("/api/universe", json={"cible_px": 32, "couleurs": 12})
    avant = client.get("/api/universe").json()["univers"]
    projet = client.get("/api/library").json()["courant"]

    atelier.base.vider()
    reconstruit = client.post("/api/library/rebuild")
    assert reconstruit.status_code == 200, reconstruit.text

    assert len(client.get("/api/board").json()["cartes"]) == 2
    apres = client.get("/api/universe").json()["univers"]
    assert apres["cible_px"] == 32
    assert apres["couleurs"] == 12
    assert apres["palette"] == avant["palette"]
    assert client.get("/api/library").json()["courant"] == projet
