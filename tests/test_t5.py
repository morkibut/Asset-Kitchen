# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T5 — le slicer.

Un test par critère de `docs/archive/plan-versions-tenues.md` § Phase T5, nommé d'après lui.

**Aucun test de ce fichier n'appelle le fournisseur, et deux le prouvent** en
comptant les appels du double avant et après une découpe. C'est le cinquième
critère — « la découpe fonctionne réseau coupé » —, et il se démontre plutôt
qu'il ne se déclare : le service de découpe n'importe aucun fournisseur, mais
seul un compte d'appels le vérifie de bout en bout, à travers les routes.

La planche d'essai est fabriquée ici, à partir des couleurs de
`tests/conftest.py` — le fond plat que les modèles rendent réellement, et le
sujet rayé qui porte un trou. Fabriquée et non trouvée : une planche de huit
sprites posés à des hauteurs volontairement irrégulières est exactement ce que
la détection doit savoir remettre en ordre de lecture, et aucune image du dépôt
ne le fait.
"""

from __future__ import annotations

import io
import time

import numpy as np
import pytest
from conftest import FOND, SUJET, SUJET_SOMBRE
from PIL import Image, ImageDraw


# ── La planche d'essai ───────────────────────────────────────────────────────


def planche(
    *,
    colonnes: int = 4,
    lignes: int = 2,
    case: int = 64,
    sujet: int = 30,
    hauteur: int | None = None,
    decalage: int = 5,
) -> bytes:
    """Une planche multi-sprites, sur un fond plat.

    **Les sujets ne sont pas alignés**, et c'est le sujet du test : chaque
    colonne est décalée verticalement d'un cran. Un tri naïf sur le bord haut
    entrelacerait les deux rangées — la deuxième commencerait avant la fin de la
    première —, et l'ordre de lecture est ce qui numérote les huit tuiles.

    Chaque sujet porte le trou de `image_sujet` : de la couleur du fond, relié à
    rien, donc opaque après un remplissage depuis le bord. C'est ce qui interdit
    à la détection de séparer un sprite en deux au premier reflet clair.
    """
    haut = sujet if hauteur is None else hauteur
    image = Image.new("RGB", (case * colonnes, case * lignes), FOND)
    dessin = ImageDraw.Draw(image)
    for ligne in range(lignes):
        for colonne in range(colonnes):
            x0 = colonne * case + (case - sujet) // 2
            y0 = ligne * case + (case - haut) // 2 + (colonne % 2) * decalage
            for pas in range(sujet):
                dessin.rectangle(
                    [x0 + pas, y0, x0 + pas, y0 + haut - 1],
                    fill=SUJET if pas % 2 == 0 else SUJET_SOMBRE,
                )
            dessin.point((x0 + sujet // 2, y0 + haut // 2), fill=FOND)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _planche_generee(client, double, **forme) -> dict:
    """La planche, entrée dans la bibliothèque par le chemin normal."""
    double.rendre = lambda: planche(**forme)
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "une planche de huit"},
    ).json()
    reponse = client.get(f"/api/assets/{generation['identifiant']}-0")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _proposer(client, identifiant: str, **params) -> dict:
    reponse = client.get(f"/api/assets/{identifiant}/slices", params=params)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _decouper(client, identifiant: str, boites: list[list[int]]) -> dict:
    reponse = client.post(
        f"/api/assets/{identifiant}/slices", json={"boites": boites}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _couleurs(octets: bytes) -> set[tuple[int, int, int]]:
    with Image.open(io.BytesIO(octets)) as image:
        pixels = np.asarray(image.convert("RGB")).reshape(-1, 3)
    return {tuple(int(v) for v in c) for c in pixels}


# ── « Une planche de huit sprites devient huit assets, chacun visible dans la
#     grille » ────────────────────────────────────────────────────────────────


def test_une_planche_de_huit_devient_huit_assets_visibles_dans_la_grille(
    client, double
):
    """Le critère central, du bout en bout : détecter, découper, retrouver.

    Trois faits distincts, et un seul geste : la détection trouve **huit** zones
    et pas neuf ni sept ; la découpe rend huit assets ; et ces huit-là sont dans
    la grille, celle que l'écran demande — pas seulement sur le disque.
    """
    planche_asset = _planche_generee(client, double)

    propose = _proposer(client, planche_asset["identifiant"])
    assert len(propose["boites"]) == 8
    assert propose["largeur"] == 256 and propose["hauteur"] == 128

    # **Dans l'ordre de lecture, malgré les décalages.** Les quatre premières
    # boîtes sont la rangée du haut, de gauche à droite.
    hauts = [b[1] for b in propose["boites"]]
    gauches = [b[0] for b in propose["boites"]]
    assert max(hauts[:4]) < min(hauts[4:])
    assert gauches[:4] == sorted(gauches[:4])
    assert gauches[4:] == sorted(gauches[4:])

    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]
    assert len(decoupes) == 8

    grille = client.get("/api/assets", params={"tous": True}).json()["assets"]
    connus = {a["identifiant"] for a in grille}
    assert {d["identifiant"] for d in decoupes} <= connus
    # La planche reste : découper n'est pas consommer.
    assert planche_asset["identifiant"] in connus

    # **Chaque découpe porte son propre sujet**, pas une part de fond vide.
    for decoupe in decoupes:
        octets = client.get(
            f"/api/assets/{decoupe['identifiant']}/image", params={"brut": True}
        ).content
        assert SUJET in _couleurs(octets)

    # Et les labels numérotent, dans l'ordre du geste.
    assert [d["label"].rsplit(" · ", 1)[-1] for d in decoupes] == [
        f"{n}/8" for n in range(1, 9)
    ]


# ── « La filiation de chaque découpe pointe vers la planche et se lit depuis sa
#     fiche » ──────────────────────────────────────────────────────────────────


def test_la_filiation_de_chaque_decoupe_pointe_vers_la_planche(client, double):
    """Remonter à la source (US-74) — et redescendre.

    La filiation se lit **des deux côtés**, par la route que la fiche appelle :
    la découpe nomme sa planche, et la planche compte ses huit descendants. Un
    seul sens suffirait au critère ; les deux sont ce qui rend la fiche
    navigable, et c'est déjà le contrat de T3.
    """
    planche_asset = _planche_generee(client, double)
    propose = _proposer(client, planche_asset["identifiant"])
    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]

    for decoupe in decoupes:
        assert decoupe["parent"] == planche_asset["identifiant"]
        filiation = client.get(f"/api/assets/{decoupe['identifiant']}/lineage").json()
        assert filiation["parent"]["identifiant"] == planche_asset["identifiant"]
        assert filiation["parent_supprime"] is False

    depuis_la_planche = client.get(
        f"/api/assets/{planche_asset['identifiant']}/lineage"
    ).json()
    assert len(depuis_la_planche["enfants"]) == 8

    # **La découpe n'a rien coûté, et la planche garde la dépense.** Répartir le
    # prix de l'appel sur huit tuiles inventerait un chiffre que personne n'a
    # facturé, et le total du projet — calculé sur les générations — dirait
    # alors autre chose que la somme des tuiles.
    assert all(d["cout_usd"] == 0.0 for d in decoupes)
    assert planche_asset["cout_usd"] > 0


# ── « Une détection ratée se corrige en grille fixe ou en sélection manuelle,
#     sans jamais bloquer » ───────────────────────────────────────────────────


def test_une_detection_ratee_se_corrige_en_grille_fixe_ou_a_la_main(client, double):
    """Les trois issues d'une détection qui se trompe, et aucune n'est un mur.

    Le cas rejoué est celui qui met la détection en échec pour de bon : des
    sujets **collés**, qui ne forment qu'une seule zone opaque. La détection dit
    honnêtement « une zone » — elle ne devine pas —, et deux chemins restent
    ouverts : la grille fixe, qui découpe une planche régulière sans rien
    détecter, et les rectangles dessinés à la main, qui n'ont besoin de rien.
    """
    collee = _planche_generee(
        client, double, colonnes=4, lignes=1, case=32, sujet=32, hauteur=20, decalage=0
    )

    # 1. La détection ne trouve qu'une zone : les quatre sujets se touchent.
    auto = _proposer(client, collee["identifiant"])
    assert len(auto["boites"]) == 1

    # 2. La grille fixe, elle, découpe sans détecter — et va **jusqu'au dernier
    #    pixel** : le reste de la division se répartit, il ne se jette pas.
    grille = _proposer(client, collee["identifiant"], mode="grille", colonnes=4, lignes=1)
    assert len(grille["boites"]) == 4
    assert grille["boites"][0][0] == 0
    assert grille["boites"][-1][2] == collee["largeur"] - 1

    # 3. Et un rectangle dessiné à la main découpe ce qu'on veut, où on veut.
    a_la_main = _decouper(client, collee["identifiant"], [[10, 5, 40, 25]])["decoupes"]
    assert len(a_la_main) == 1
    # Le rectangle demandé fait 31 × 21 ; la marge de découpe ajoute quatre
    # pixels de fond de chaque côté, sans quoi le détourage n'aurait sur sa
    # bordure que du sujet et mangerait le sprite au lieu du fond.
    assert (a_la_main[0]["largeur"], a_la_main[0]["hauteur"]) == (39, 29)

    # **Le refus nomme le rectangle fautif**, jamais ne le ramène en silence
    # dans les bornes : un rectangle corrigé à l'insu de l'auteur découperait
    # autre chose que ce qu'il a vu.
    refus = client.post(
        f"/api/assets/{collee['identifiant']}/slices",
        json={"boites": [[0, 0, 10, 10], [0, 0, 9_999, 10]]},
    )
    assert refus.status_code == 409
    assert "rectangle 2" in refus.json()["raison"]
    assert refus.json()["code"] == "decoupe_refusee"

    # Et découper sans rectangle est un refus, pas un silence.
    vide = client.post(f"/api/assets/{collee['identifiant']}/slices", json={"boites": []})
    assert vide.status_code == 409


def test_une_detection_qui_ne_trouve_rien_dit_pourquoi_et_laisse_la_main(
    client, double
):
    """« Aucune zone » est un résultat, pas une panne — et il porte sa raison.

    Le produit interdit de proposer puis de refuser : une détection qui ne rend
    rien doit dire *pourquoi* elle ne rend rien, dans la même forme que tout
    grisé (`docs/design-motifs.md` § Le grisé porte sa raison).
    """
    planche_asset = _planche_generee(client, double)

    trop_grand = _proposer(client, planche_asset["identifiant"], cote_min=200)
    assert trop_grand["boites"] == []
    assert "descends la taille" in trop_grand["raison"]

    # La même planche, avec la taille par défaut, retrouve ses huit zones :
    # rien n'est cassé, c'était bien le réglage.
    assert len(_proposer(client, planche_asset["identifiant"])["boites"]) == 8


# ── « Supprimer la planche laisse ses découpes en place, chacune marquée
#     "parent supprimé" » ─────────────────────────────────────────────────────


def test_supprimer_la_planche_laisse_ses_decoupes_marquees(client, double):
    """Jamais de cascade (US-28, US-29), et une découpe n'y échappe pas.

    Le vrai risque était ailleurs, et il est vérifié ici : les découpes vivent
    dans le dossier de la génération de leur planche. Une suppression définitive
    efface `<rang>-*` — et un rang mal choisi aurait emporté le brut des huit
    découpes avec celui de la planche. On supprime, on **attend l'expiration**,
    et on regarde si les images sont encore servies.
    """
    from atelier.services.bibliotheque import ANNULATION_S

    planche_asset = _planche_generee(client, double)
    propose = _proposer(client, planche_asset["identifiant"])
    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]

    supprime = client.post(
        "/api/assets/delete", json={"identifiants": [planche_asset["identifiant"]]}
    )
    assert supprime.status_code == 200, supprime.text

    for decoupe in decoupes:
        vue = client.get(f"/api/assets/{decoupe['identifiant']}").json()
        assert vue["parent_supprime"] is True
        assert vue["parent"] == planche_asset["identifiant"]

    # L'annulation expirée, les fichiers de la planche partent pour de bon.
    # Ceux des découpes restent, et leurs images se servent encore.
    client.app.state.atelier.bibliotheque.purger(
        maintenant=time.time() + ANNULATION_S + 1
    )
    assert client.get(f"/api/assets/{planche_asset['identifiant']}").status_code == 404
    for decoupe in decoupes:
        image = client.get(
            f"/api/assets/{decoupe['identifiant']}/image", params={"brut": True}
        )
        assert image.status_code == 200
        # Servie, et **c'est bien le sprite** : un fichier de zéro octet ou une
        # image vide passerait un simple 200 sans rien prouver.
        assert _couleurs(image.content) & {SUJET, SUJET_SOMBRE}

    # Et la filiation reste lisible, amputée mais entière (US-29).
    filiation = client.get(f"/api/assets/{decoupes[0]['identifiant']}/lineage").json()
    assert filiation["parent"] is None
    assert filiation["parent_identifiant"] == planche_asset["identifiant"]
    assert filiation["parent_supprime"] is True


# ── « La découpe fonctionne réseau coupé » ───────────────────────────────────


def test_la_decoupe_fonctionne_reseau_coupe(client, double):
    """Le compte des appels du double ne bouge pas d'un cran.

    Réseau coupé pour de vrai — `catalogue_lisible` à faux, et un échec armé sur
    toute génération —, on détecte, on découpe, on relit, on télécharge. Aucun
    appel ne part, et rien n'est refusé : découper une planche déjà là ne
    demande rien à personne.
    """
    planche_asset = _planche_generee(client, double)
    double.catalogue_lisible = False
    double.echec = RuntimeError("le réseau est coupé")
    appels_avant = double.appels

    propose = _proposer(client, planche_asset["identifiant"])
    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]
    assert len(decoupes) == 8

    for decoupe in decoupes:
        assert client.get(f"/api/assets/{decoupe['identifiant']}").status_code == 200
        assert (
            client.get(f"/api/assets/{decoupe['identifiant']}/download").status_code
            == 200
        )
    assert double.appels == appels_avant


# ── Ce que la découpe hérite, et ce qu'elle n'hérite pas ─────────────────────


def test_une_decoupe_nait_habillee_de_la_recette_de_sa_planche(client, double):
    """Huit découpes d'une planche traitée sortent traitées pareil.

    C'est ce qui rend « découper » utile en un geste plutôt qu'en neuf. La
    recette voyage entière — sauf **la boîte de recadrage**, qui désignait un
    rectangle de la planche et ne désignerait plus rien sur un morceau.
    """
    planche_asset = _planche_generee(client, double)
    client.put(
        f"/api/assets/{planche_asset['identifiant']}/recipe",
        json={
            "passes": [
                {"moteur": "bord", "tolerance": 28, "seuil_alpha": 128, "durcissement": 0}
            ],
            "recadrage": {"marge": 2, "boite": [0, 0, 100, 100]},
            "grille": {"cible": 16, "occupation": 100, "ancrage": "bas"},
            "quantification": None,
            "bords": None,
            "nom": None,
        },
    )

    propose = _proposer(client, planche_asset["identifiant"])
    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]

    for decoupe in decoupes:
        recette = decoupe["recette"]
        assert len(recette["passes"]) == 1
        assert recette["grille"]["cible"] == 16
        # La marge reste — c'est un réglage. La boîte part — c'était une
        # coordonnée dans une autre image.
        assert recette["recadrage"] == {"marge": 2, "boite": None}
        # Le rendu est bien celui de la recette héritée, pas le brut.
        assert decoupe["rendu_largeur"] == 16 and decoupe["rendu_hauteur"] == 16


def test_deux_decoupes_successives_ne_se_marchent_jamais_dessus(client, double):
    """Deux découpes de la même planche ne partagent aucun fichier.

    Les découpes vivent dans le dossier de la génération, nommées par leur rang.
    Un rang réattribué ferait écrire la seconde série par-dessus la première :
    huit images perdues, sans une ligne d'erreur. Le rang se prend donc
    au-dessus de **tout** ce que la génération connaît déjà.
    """
    planche_asset = _planche_generee(client, double)

    premiere = _decouper(client, planche_asset["identifiant"], [[0, 0, 60, 60]])["decoupes"]
    seconde = _decouper(client, planche_asset["identifiant"], [[64, 0, 124, 60]])["decoupes"]

    assert premiere[0]["identifiant"] != seconde[0]["identifiant"]
    assert premiere[0]["rang"] != seconde[0]["rang"]

    atelier = client.app.state.atelier
    bruts = {
        atelier.assets.lire(a["identifiant"]).brut for a in (*premiere, *seconde)
    }
    assert len(bruts) == 2
    for a in (*premiere, *seconde):
        assert client.get(f"/api/assets/{a['identifiant']}/image").status_code == 200


def test_les_decoupes_survivent_a_un_index_efface(client, double):
    """« Les fichiers font foi, la base est un index reconstructible » (T3).

    Une découpe est un asset comme un autre, donc elle se relit du disque comme
    un autre — avec sa filiation, son rangement et sa recette. Ce test existe
    parce que les découpes portent des rangs à trois chiffres dans le dossier
    de leur génération : `parcourir_assets` les trie sur ce nombre, et un tri
    qui les manquerait les ferait disparaître à la première reconstruction.
    """
    planche_asset = _planche_generee(client, double)
    propose = _proposer(client, planche_asset["identifiant"])
    decoupes = _decouper(
        client, planche_asset["identifiant"], propose["boites"]
    )["decoupes"]

    compte = client.post("/api/library/rebuild").json()["reconstruit"]
    assert compte["assets"] == 9  # la planche et ses huit découpes

    for decoupe in decoupes:
        relu = client.get(f"/api/assets/{decoupe['identifiant']}").json()
        assert relu["parent"] == planche_asset["identifiant"]
        assert relu["projet"] == planche_asset["projet"]
        assert relu["rang"] == decoupe["rang"]


# ── La dette reportée : le second moteur de détourage, exécuté ───────────────


def test_le_moteur_par_modele_detoure_pour_de_vrai_quand_il_est_installe(
    client, double
):
    """Le chemin qu'aucun test n'avait jamais emprunté — T2 le grise, T4 l'allume,
    T5 l'exécute (`docs/tranches/T5.md`, la dette reportée).

    Le grisé était vérifié, l'appel au moteur ne l'était pas — et il se sautait
    en l'absence de `rembg`. Ce test est le symétrique exact de
    `test_un_moteur_de_detourage_absent_est_grise_avec_sa_raison` : l'un vaut
    quand le moteur manque, l'autre quand il est là, et sur une machine donnée
    il y en a toujours exactement un des deux qui travaille.

    **Sur une vraie planche**, comme la palette de T4 : un carré fabriqué pour
    l'occasion ne dit rien d'un modèle de segmentation, qui cherche un sujet
    saillant. La mesure est l'accord avec le moteur du geste courant — deux
    moteurs qui gardent la même **part** de l'image peuvent garder deux parts
    différentes, et la part seule ne le dirait pas.
    """
    from pathlib import Path

    from atelier.image import raison_moteur

    if raison_moteur("modele") is not None:
        pytest.skip("`rembg` n'est pas installé sur cette machine")

    planche_reelle = Path(__file__).resolve().parent.parent / "essais" / "guide" / "01_goblin.png"
    if not planche_reelle.is_file():
        pytest.skip("la planche du guide n'est pas sur ce disque")

    octets = planche_reelle.read_bytes()
    double.rendre = lambda: octets
    generation = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un archer gobelin"},
    ).json()
    identifiant = f"{generation['identifiant']}-0"

    silhouettes = {}
    for moteur in ("bord", "modele"):
        reponse = client.put(
            f"/api/assets/{identifiant}/recipe",
            json={
                "passes": [
                    {
                        "moteur": moteur,
                        "tolerance": 28,
                        "seuil_alpha": 128,
                        "durcissement": 0,
                    }
                ],
                "recadrage": None,
                "grille": None,
                "quantification": None,
                "bords": None,
                "nom": None,
            },
        )
        assert reponse.status_code == 200, reponse.text
        rendu = client.get(f"/api/assets/{identifiant}/image").content
        with Image.open(io.BytesIO(rendu)) as image:
            silhouettes[moteur] = np.asarray(image.convert("RGBA"))[:, :, 3]

    for moteur, alpha in silhouettes.items():
        # **Franchement opaque ou franchement absent**, rien entre les deux :
        # le seuil alpha s'applique au modèle comme au bord, sans quoi le
        # liseré clair reviendrait par la porte du second moteur.
        assert set(np.unique(alpha)) <= {0, 255}, moteur
        assert 0.10 < (alpha > 0).mean() < 0.50, moteur

    bord, modele = silhouettes["bord"] > 0, silhouettes["modele"] > 0
    accord = (bord & modele).sum() / (bord | modele).sum()
    # Mesuré le 27 août 2026 sur les six images du banc : accord médian 96,3 %,
    # minimum 93,0 %. Le seuil est posé bien en dessous — ce test garde contre
    # un moteur qui se met à rendre autre chose, pas contre deux points d'écart.
    assert accord > 0.85
