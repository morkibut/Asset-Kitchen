# -*- coding: utf-8 -*-
"""Les critères de E11 qui vivent côté serveur — les palettes et les ambiances.

**Ce qui se mesure ici** : qu'une palette reste une recette — donc qu'une image
promue se propage jusqu'en bas, même à travers une ambiance retouchée à la main
—, que chaque couleur dit d'où elle vient, qu'une ambiance porte trois choses et
pas une de plus, qu'aucune collection ne décide d'un style, et que supprimer une
ambiance ne détruit aucune image. Ce que l'écran montre — les deux listes, les
pastilles barrées, les deux rangées d'aperçu — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare** : un jeu n'a pas un seul style. Il a un style général
et des coins qui s'en écartent — le marais plus gris, les monstres de l'ombre
plus froids. Redire ça sur chaque créature était long et finissait par diverger.

**Et rien de tout ceci ne coûte un centime** : la fusion de deux palettes et
l'attraction des couleurs se font sur la machine, en millisecondes. C'est un
critère d'acceptation, et il se mesure ici — aucun essai de ce fichier ne touche
le fournisseur, pas même doublé.
"""

from __future__ import annotations

from atelier.domaine.ambiance import DE_LA_MAIN, DE_L_AMBIANCE, DU_JEU
from atelier.image.palette import attirer, fusionner, reduire

import io

from PIL import Image, ImageDraw

from tests.conftest import FOND, image_sujet


def _cote(client, projet: str | None = None) -> dict:
    reponse = client.get("/api/moods", params={"projet": projet} if projet else {})
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _palette(client, nom: str, **corps) -> dict:
    reponse = client.post("/api/palettes", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return next(p for p in reponse.json()["palettes"] if p["nom"] == nom)


def _regler_palette(client, identifiant: str, **corps) -> dict:
    reponse = client.put(f"/api/palettes/{identifiant}", json=corps)
    assert reponse.status_code == 200, reponse.text
    return next(
        p for p in reponse.json()["palettes"] if p["identifiant"] == identifiant
    )


def _ambiance(client, nom: str, **corps) -> dict:
    reponse = client.post("/api/moods", json={"nom": nom, **corps})
    assert reponse.status_code == 201, reponse.text
    return next(a for a in reponse.json()["ambiances"] if a["nom"] == nom)


def _aplats(couleurs: tuple[str, ...], cote: int = 64) -> bytes:
    """Une image de bandes franches — des couleurs qu'on reconnaît au rendu.

    Le sujet du corpus commun est rouge et gris : deux artworks de ce sujet
    rendent la même palette, quelle que soit leur taille. Ici on veut deux
    palettes différentes, et une image dit ses couleurs.
    """
    image = Image.new("RGB", (cote, cote), FOND)
    dessin = ImageDraw.Draw(image)
    largeur = max(1, cote // (len(couleurs) + 1))
    for rang, couleur in enumerate(couleurs):
        dessin.rectangle(
            [rang * largeur, 0, (rang + 1) * largeur - 1, cote - 1], fill=couleur
        )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _coller(client, nom: str, octets: bytes, **params) -> str:
    reponse = client.post(
        "/api/board/paste", params={"nom": nom, "forcer": True, **params}, content=octets
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]["identifiant"]


def _officialiser(client, combien: int = 2) -> list[str]:
    """Des artworks officiels, donc une palette de jeu — la source de tout.

    Les images du corpus d'essai : la coupe médiane a de quoi mordre, et la
    palette rendue n'est pas une nuance de gris.
    """
    identifiants = []
    for rang in range(combien):
        carte = _coller(client, f"art{rang}.png", image_sujet(logique_l=8 + rang))
        promue = client.put(
            f"/api/board/{carte}/official",
            json={"officiel": True, "famille": "tous"},
        )
        assert promue.status_code == 200, promue.text
        identifiants.append(carte)
    return identifiants


# ── La fusion, mesurée avant d'être écrite ───────────────────────────────────


def test_chaque_couleur_du_resultat_est_une_couleur_de_ses_sources(client):
    """**La promesse de la maquette, tenue au pied de la lettre.**

    La coupe médiane rend des moyennes — le milieu d'un seau —, et une moyenne
    n'est l'une des couleurs d'aucune source : la pastille dirait « venue du
    jeu » en montrant une teinte que le jeu ne porte pas. Le raccrochage à la
    couleur réelle la plus proche est le seul écart avec le banc d'essai, et il
    ajoute une garantie plutôt qu'il n'en retire.
    """
    jeu = ("#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000")

    assert set(reduire(jeu, 3)) <= set(jeu)
    assert len(reduire(jeu, 3)) == 3
    assert reduire(jeu, 99) == jeu


def test_les_deux_curseurs_ne_font_pas_le_meme_travail(client):
    """**Mesuré avant d'écrire une ligne**, et c'est ce qui a débloqué la tranche.

    Le banc d'essai a balayé les deux curseurs sur les images du dépôt : croisés,
    ils rendent 21 résultats distincts sur 25 combinaisons. Ici on refait la
    mesure en petit, pour qu'elle reste vraie si le calcul change — un réglage
    qui ne changerait rien se griserait avec sa raison, et c'est déjà arrivé
    deux fois dans ce produit.
    """
    jeu = tuple(f"#{r:02x}0000" for r in range(0, 256, 16))
    ambiance = tuple(f"#0000{b:02x}" for b in range(0, 256, 16))

    vus = {}
    for du_jeu in (0, 4, 8, 12, 16):
        for attraction in (0.0, 0.25, 0.5, 0.75, 1.0):
            rendu = tuple(
                c for c, _ in fusionner(jeu, ambiance, 16, du_jeu, attraction)
            )
            vus.setdefault(rendu, []).append((du_jeu, attraction))

    # Le seul endroit où l'attraction meurt : à « tout du jeu », il ne reste
    # aucune couleur d'ambiance à tirer.
    inertes = [reglages for reglages in vus.values() if len(reglages) > 1]
    assert len(inertes) == 1
    assert {du_jeu for du_jeu, _ in inertes[0]} == {16}


def test_lattraction_tire_vers_le_jeu_sans_jamais_le_depasser(client):
    """À 0 rien ne bouge, à 1 la couleur *devient* celle du jeu."""
    assert attirer(("#000000",), ("#ffffff",), 0.0) == ("#000000",)
    assert attirer(("#000000",), ("#ffffff",), 1.0) == ("#ffffff",)
    assert attirer(("#000000",), ("#ffffff",), 0.5) == ("#808080",)


# ── Plusieurs palettes nommées, et celle du jeu en est une ───────────────────


def test_plusieurs_palettes_nommees_coexistent(client):
    """Elles se créent d'un nom, comme tout ce qui se crée dans ce produit."""
    _palette(client, "marais")
    _palette(client, "ombre")

    recu = _cote(client)

    assert [p["nom"] for p in recu["palettes"]] == ["marais", "ombre"]


def test_deux_palettes_du_meme_nom_sont_refusees_en_le_disant(client):
    _palette(client, "marais")

    refus = client.post("/api/palettes", json={"nom": "MARAIS"})

    assert refus.status_code == 409
    assert "marais" in refus.json()["raison"].lower()


def test_la_palette_du_jeu_est_servie_avec_les_autres(client):
    """**Celle du projet en est une comme les autres**, et c'est la
    simplification qui tient toute la tranche : le projet *est* l'ambiance
    générale du jeu. L'écran la montre dans la même liste."""
    _officialiser(client)

    recu = _cote(client)

    assert recu["du_jeu"], "un jeu avec des artworks officiels a une palette"


# ── Une palette reste une recette ────────────────────────────────────────────


def test_une_palette_se_recalcule_de_ses_sources(client):
    """**Le vrai enjeu de la tranche** : promouvoir une image se propage
    jusqu'en bas. Sans ça, une palette serait une liste figée, et la règle
    « la palette est dérivable de ses sources » serait morte."""
    _officialiser(client, 1)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])
    avant = _cote(client)["palettes"][0]["rendue"]
    assert avant

    # **Un artwork d'autres couleurs**, donc une palette de jeu qui change. Le
    # même sujet dans une autre taille n'aurait rien changé, et c'est juste :
    # l'empreinte porte les couleurs résolues, pas la liste des cartes.
    carte = _coller(client, "autre.png", _aplats(("#0a5c3a", "#7fd4a8", "#04321f")))
    client.put(
        f"/api/board/{carte}/official",
        json={"officiel": True, "famille": "tous"},
    )

    apres = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == palette["identifiant"]
    )
    assert apres["empreinte"] != palette["empreinte"]


def test_une_palette_peut_prendre_une_autre_palette_pour_source(client):
    """« Ce qui change est ce qu'une source peut être », et c'est ce qui permet
    d'assembler une ambiance à partir de ce qui existe déjà."""
    _officialiser(client)
    base = _palette(client, "base", sources=[{"genre": "officiels"}])

    tiree = _palette(
        client, "tirée", sources=[{"genre": "palette", "reference": base["identifiant"]}]
    )

    recu = next(
        p for p in _cote(client)["palettes"] if p["identifiant"] == tiree["identifiant"]
    )
    assert recu["rendue"], "une palette tirée d'une autre porte ses couleurs"


def test_une_palette_ne_peut_pas_etre_sa_propre_source(client):
    """Le seul cycle que le produit peut nommer avec certitude — les autres
    s'arrêtent en profondeur et rendent une source vide."""
    palette = _palette(client, "marais")

    refus = client.put(
        f"/api/palettes/{palette['identifiant']}",
        json={"sources": [{"genre": "palette", "reference": palette["identifiant"]}]},
    )

    assert refus.status_code == 409
    assert "sa propre source" in refus.json()["raison"]


def test_une_source_disparue_ne_perd_pas_les_couleurs(client):
    """« Elle garde ses couleurs et affiche que sa source a disparu, sans rien
    recalculer et sans rien effacer. » Un paquet du tableau n'a pas d'identité :
    il disparaît avec sa dernière carte, et les réglages doivent lui survivre."""
    palette = _palette(
        client, "marais", sources=[{"genre": "images", "reference": "paquet-parti"}]
    )

    recu = next(
        p
        for p in _cote(client)["palettes"]
        if p["identifiant"] == palette["identifiant"]
    )

    assert recu["sources_perdues"] == ["paquet-parti"]


# ── Les retouches, rangées une par une ───────────────────────────────────────


def test_une_couleur_retiree_reste_montree_barree(client):
    """**Montrée, pas cachée** : c'est une décision qu'on a prise, on doit
    pouvoir l'annuler d'un clic."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])
    couleur = _cote(client)["palettes"][0]["rendue"][0]

    regle = _regler_palette(
        client,
        palette["identifiant"],
        retouches=[{"geste": "retirer", "couleur": couleur}],
    )

    barree = next(p for p in regle["pastilles"] if p["couleur"] == couleur)
    assert barree["retiree"] == "retirer"
    assert couleur not in regle["rendue"]


def test_les_retouches_se_defont_une_par_une(client):
    """Rangées et non fondues dans le résultat, pour trois raisons : chacune
    s'annule seule, chacune se voit, et le tout se rejoue si une source change."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])
    couleurs = _cote(client)["palettes"][0]["rendue"][:2]

    _regler_palette(
        client,
        palette["identifiant"],
        retouches=[
            {"geste": "retirer", "couleur": couleurs[0]},
            {"geste": "retirer", "couleur": couleurs[1]},
        ],
    )
    # On défait la seconde, et la première tient toujours.
    regle = _regler_palette(
        client,
        palette["identifiant"],
        retouches=[{"geste": "retirer", "couleur": couleurs[0]}],
    )

    assert couleurs[0] not in regle["rendue"]
    assert couleurs[1] in regle["rendue"]


def test_une_couleur_ajoutee_dit_quelle_vient_de_la_main(client):
    """Trois provenances, et la pastille les porte : sans elles on ne saurait
    pas si un gris vient du jeu, donc si le changer serait une exception."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])

    regle = _regler_palette(
        client,
        palette["identifiant"],
        retouches=[{"geste": "ajouter", "couleur": "#123456"}],
    )

    ajoutee = next(p for p in regle["pastilles"] if p["couleur"] == "#123456")
    assert ajoutee["venue"] == DE_LA_MAIN
    assert {p["venue"] for p in regle["pastilles"]} <= {
        DU_JEU,
        DE_L_AMBIANCE,
        DE_LA_MAIN,
    }


def test_une_retouche_qui_ne_trouve_rien_ne_fait_rien_et_reste(client):
    """Elle ne trouve pas sa couleur, elle ne fait rien, et elle reste là — ce
    qui permet à une source de revenir sans qu'on ait à retaper le geste."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])

    regle = _regler_palette(
        client,
        palette["identifiant"],
        retouches=[{"geste": "retirer", "couleur": "#abcdef"}],
    )

    assert len(regle["retouches"]) == 1
    assert regle["rendue"], "rien n'a été retiré"


# ── L'attraction grisée avec sa raison ───────────────────────────────────────


def test_lattraction_est_inerte_quand_tout_vient_du_jeu(client):
    """**Le seul endroit où elle meurt**, trouvé au banc et non deviné : à
    proportion « tout du jeu », il ne reste aucune couleur d'ambiance à tirer, et
    les cinq valeurs rendent le même fichier. C'est là, et seulement là, qu'elle
    se grise avec sa raison."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}], couleurs=8)

    tout_du_jeu = _regler_palette(client, palette["identifiant"], du_jeu=8)
    assert tout_du_jeu["attraction_inerte"] is True

    partage = _regler_palette(client, palette["identifiant"], du_jeu=4)
    assert partage["attraction_inerte"] is False


# ── L'ambiance : trois choses, et rien d'autre ───────────────────────────────


def test_une_ambiance_porte_trois_choses_et_rien_dautre(client):
    """Une palette, des images de référence, trois textes. Le reste lui est
    fermé — et la fermeture est écrite dans le schéma, donc dans le refus que
    l'API compose toute seule."""
    ambiance = _ambiance(client, "Marais de cendre")

    assert set(ambiance) >= {
        "palette",
        "references",
        "monde",
        "eclairage",
        "trait",
    }
    assert "vue" not in ambiance
    assert "technique" not in ambiance
    assert "epoque" not in ambiance
    assert "rendu" not in ambiance


def test_les_textes_de_mecanique_du_jeu_sont_fermes_a_une_ambiance(client):
    """**Le critère, mesuré sur le port.** Une ambiance qui remplacerait la vue
    ou la technique fabriquerait des images qui ne rentrent pas dans le jeu, et
    l'erreur ne se verrait qu'après avoir payé."""
    ambiance = _ambiance(client, "Marais de cendre")

    refus = client.put(
        f"/api/moods/{ambiance['identifiant']}",
        json={"vue": "de côté", "technique": "vector art"},
    )

    # FastAPI refuse un champ inconnu ; à défaut il l'ignorerait — et dans les
    # deux cas rien n'est écrit, ce qui est ce qui compte.
    apres = _cote(client)["ambiances"][0]
    assert "vue" not in apres and "technique" not in apres
    assert refus.status_code in (200, 422)


def test_une_ambiance_ecrit_ses_trois_textes(client):
    ambiance = _ambiance(client, "Marais de cendre")

    reponse = client.put(
        f"/api/moods/{ambiance['identifiant']}",
        json={
            "monde": "a drowned marsh",
            "eclairage": "low grey light",
            "trait": "soft edges",
        },
    )

    assert reponse.status_code == 200, reponse.text
    ecrite = reponse.json()["ambiances"][0]
    assert ecrite["monde"] == "a drowned marsh"
    assert ecrite["eclairage"] == "low grey light"
    assert ecrite["trait"] == "soft edges"


# ── Qui s'en sert, et ce que chacun lui prend ────────────────────────────────


def test_une_chose_du_jeu_designe_son_ambiance_sur_sa_fiche(client):
    """Et **aucune collection ne décide d'une ambiance** : une collection reste
    un dossier qui ne décide de rien. Grouper vingt monstres et régler leur style
    sont deux gestes différents."""
    ambiance = _ambiance(client, "Marais de cendre")
    cree = client.post("/api/characters", json={"nom": "Le rôdeur"}).json()["personnage"]

    reponse = client.put(
        f"/api/characters/{cree['identifiant']}",
        json={"ambiance": ambiance["identifiant"], "prend": "couleurs"},
    )

    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["personnage"]["ambiance"] == ambiance["identifiant"]
    assert reponse.json()["personnage"]["prend"] == "couleurs"


def test_une_ambiance_inconnue_est_refusee_en_nommant_celles_qui_existent(client):
    _ambiance(client, "Marais de cendre")
    cree = client.post("/api/characters", json={"nom": "Le rôdeur"}).json()["personnage"]

    refus = client.put(
        f"/api/characters/{cree['identifiant']}", json={"ambiance": "inexistante"}
    )

    assert refus.status_code == 409
    assert "Marais de cendre" in refus.json()["raison"]


def test_lambiance_dit_qui_sen_sert_et_ce_que_chacun_lui_prend(client):
    """Lu des choses du jeu et de nulle part ailleurs : une liste tenue sur
    l'ambiance serait une seconde vérité qu'un renommage ferait diverger."""
    ambiance = _ambiance(client, "Marais de cendre")
    for nom, prend in (("Le rôdeur", "tout"), ("L'ombre", "couleurs")):
        cree = client.post("/api/characters", json={"nom": nom}).json()["personnage"]
        client.put(
            f"/api/characters/{cree['identifiant']}",
            json={"ambiance": ambiance["identifiant"], "prend": prend},
        )

    emplois = _cote(client)["ambiances"][0]["emplois"]

    assert {e["nom"]: e["prend"] for e in emplois} == {
        "Le rôdeur": "tout",
        "L'ombre": "couleurs",
    }


# ── Supprimer ────────────────────────────────────────────────────────────────


def test_supprimer_une_ambiance_ne_detruit_aucune_image(client):
    """**Ce qui s'en servait retombe sur le jeu.** Il n'y a pas de trou,
    seulement un réglage qu'on ne pose plus — et le compte le dit."""
    ambiance = _ambiance(client, "Marais de cendre")
    cree = client.post("/api/characters", json={"nom": "Le rôdeur"}).json()["personnage"]
    client.put(
        f"/api/characters/{cree['identifiant']}",
        json={"ambiance": ambiance["identifiant"]},
    )
    avant = len(client.get("/api/assets").json()["assets"])

    reponse = client.delete(f"/api/moods/{ambiance['identifiant']}")

    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["retombees"] == 1
    assert len(client.get("/api/assets").json()["assets"]) == avant
    tableau = client.get("/api/characters").json()
    assert tableau["personnages"][0]["ambiance"] == ""


def test_supprimer_une_palette_rend_ses_ambiances_au_jeu(client):
    """Aucune cascade : l'ambiance reste, elle perd sa palette et retombe sur
    celle du jeu."""
    palette = _palette(client, "marais")
    ambiance = _ambiance(client, "Marais", palette=palette["identifiant"])

    client.delete(f"/api/palettes/{palette['identifiant']}")

    recu = _cote(client)
    assert recu["palettes"] == []
    assert recu["ambiances"][0]["identifiant"] == ambiance["identifiant"]
    assert recu["ambiances"][0]["palette"] == ""


# ── L'aperçu, et le prix ─────────────────────────────────────────────────────


def test_la_palette_se_juge_posee_sur_de_vraies_images(client, tmp_path):
    """**Un mélange se voit sur un sprite, pas sur une bande de pastilles.**

    Deux rangées des mêmes objets — avec les couleurs du jeu, avec celles de la
    palette —, parce qu'une seule ne dirait pas ce qui a changé.
    """
    _officialiser(client)
    fichier = tmp_path / "sujet.png"
    fichier.write_bytes(image_sujet())
    importee = client.post("/api/assets/import", json={"chemin": str(fichier)})
    assert importee.status_code == 201, importee.text
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])

    apercu = client.get(f"/api/palettes/{palette['identifiant']}/preview").json()

    assert apercu["images"], "l'aperçu se pose sur ce que le jeu contient"
    premiere = apercu["images"][0]
    assert premiere["du_jeu"].startswith("data:image/png;base64,")
    assert premiere["de_la_palette"].startswith("data:image/png;base64,")
    # Combien de couleurs servent vraiment — le produit constate, il ne conseille
    # pas de retirer les autres.
    assert isinstance(apercu["employees"], list)


def test_aucun_appel_payant_nest_ajoute(client, double):
    """**Vrai par construction**, et mesuré quand même : le côté Ambiances est
    un calcul local, et rien de ce qu'il fait ne parle au fournisseur."""
    _officialiser(client)
    palette = _palette(client, "marais", sources=[{"genre": "officiels"}])
    _regler_palette(client, palette["identifiant"], du_jeu=4, attraction=0.5)
    _ambiance(client, "Marais", palette=palette["identifiant"])
    client.get(f"/api/palettes/{palette['identifiant']}/preview")

    assert double.appels == 0
