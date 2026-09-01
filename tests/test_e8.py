# -*- coding: utf-8 -*-
"""Les critères de E8 qui vivent côté serveur — l'assistant de démarrage.

**Ce qui se mesure ici** : qu'un choix unique remplit tous les endroits qui
doivent s'accorder, que le produit ne réécrit jamais ce que l'auteur a tapé, que
la base d'étiquettes appartient à l'atelier et naît pleine, et qu'un changement
coûteux annonce ses chiffres sans jamais bloquer. Ce que l'écran montre — les
dix étapes, les deux humeurs, les vignettes — vit dans
`interface/src/App.test.tsx`.

**La panne que tout ça répare est mesurée sur le vrai projet** : le réglage
disait 128 pendant que le texte envoyé disait 64, **trois fois**, et le nombre
de directions était retapé **sept fois** sans que rien ne relie ces sept
endroits.
"""

from __future__ import annotations

import re
from pathlib import Path

from atelier.domaine.projet import BAREME_PAR_DEFAUT, CHAMPS_BIBLE
from atelier.domaine.vue import TAILLES, VUES, phrase_de_calage, phrase_de_grille, vue

PLACES = (
    Path(__file__).resolve().parents[1] / "interface" / "src" / "composants" / "Places.tsx"
)


def _univers(client) -> dict:
    return client.get("/api/universe").json()["univers"]


def _case(client, nom: str) -> dict:
    return next(c for c in _univers(client)["bible"] if c["nom"] == nom)


# ── Les deux listes fermées ──────────────────────────────────────────────────


def test_les_huit_vues_et_les_neuf_tailles_se_servent_du_serveur(client):
    """**Deux listes fermées, servies par le serveur** — pas écrites à l'écran.

    C'est le même choix qui remplit le réglage *et* la phrase de la bible : deux
    listes tenues à deux endroits finiraient par proposer une vue dont le
    serveur ne saurait rien écrire.
    """
    recu = client.get("/api/universe/views").json()

    assert len(recu["vues"]) == 8
    assert len(recu["tailles"]) == 9
    # Chaque vue dit combien d'images une pose demande — c'est le chiffre qui
    # multiplie toute la production, donc tout ce qu'on paiera.
    assert all(v["images"] >= 1 for v in recu["vues"])
    assert {v["identifiant"] for v in recu["vues"]} == {v.identifiant for v in VUES}


def test_la_table_grille_propose_les_memes_tailles_que_l_assistant():
    """**La table de grille propose exactement les neuf tailles du domaine.**

    Ce n'est pas un détail d'affichage : le réglage du projet nomme la case à
    laquelle tout est ramené, et la table est l'outil qui la pose sur une image.
    Quand les deux listes divergent, **un jeu réglé sur une taille que la table
    ignore n'a plus aucun outil pour appliquer sa propre taille** — c'est ce qui
    est arrivé, sept contre neuf, entre le 30 et le 31 août 2026 : 8 et 256
    étaient entrés dans le domaine et l'assistant sans entrer dans la table.

    L'essai lit la source de l'écran plutôt que de recopier les neuf nombres :
    une troisième copie de la même liste serait précisément la panne qu'on ferme
    ici. Le croquis de l'écran (`docs/maquettes-v2.1/13-table-grille.html`,
    première annotation) porte le même arbitrage.
    """
    ecrit = re.search(r"const CIBLES = \[([^\]]*)\]", PLACES.read_text(encoding="utf-8"))
    assert ecrit is not None, "CIBLES a été renommée ou déplacée hors de Places.tsx"

    proposees = [int(n) for n in re.findall(r"\d+", ecrit.group(1))]

    assert proposees == [cible for cible, _ in TAILLES]


def test_la_tuile_est_entree_au_bareme(client):
    """**Un type manquait, et le projet en fabriquait déjà.**

    Sa description dit `grid-aligned tile assets` et un outil découpe une
    planche en tuiles ; mais « tuile » n'était dans aucune liste, donc une tuile
    arrivait en « décor » et occupait toute sa case sans que ce soit un choix.
    """
    noms = [e["nom"] for e in _univers(client)["bareme"]]

    assert "tuile" in noms
    assert len(noms) == len(BAREME_PAR_DEFAUT) == 8
    tuile = next(e for e in _univers(client)["bareme"] if e["nom"] == "tuile")
    # Une tuile remplit son cadre : elle n'a pas de contour à détourer.
    assert tuile["silhouette"] is False


# ── « Un choix unique remplit le réglage et la phrase » ──────────────────────
#
# **Ce qui a changé le 1ᵉʳ septembre 2026, et ce qui n'a pas changé.** La phrase
# du produit n'est plus *écrite dans la case* : elle est *calculée à l'envoi*
# depuis la taille et la vue, qui la déterminent entièrement. Le critère de E8
# ne bouge pas d'un mot — un choix unique remplit le réglage et la phrase, et
# les deux ne peuvent pas diverger —, il devient même plus fort : il ne dépend
# plus de la borne d'une réécriture, il n'y a plus de réécriture du tout.
#
# La panne que ça répare est nommée dans `phrase_de_grille` : rangée dans la
# case, la phrase cessait d'être mise à jour dès qu'un mot s'ajoutait à côté
# d'elle, parce que la case devenait « du texte d'auteur ».


def test_la_vue_dit_sa_phrase_sans_l_ecrire_dans_la_case(client):
    """La case reste vide ; la phrase se lit dans `phrases`, et elle part."""
    client.put("/api/universe", json={"vue": "vue-dessus-34"})

    univers = _univers(client)
    assert univers["vue"] == "vue-dessus-34"
    # Rien n'a été écrit dans la case : c'est ce qui protège la phrase du gel.
    assert _case(client, "vue")["texte"] == ""
    # Et elle est bien là, calculée, à l'endroit où l'écran la lit.
    assert univers["phrases"]["vue"] == vue("vue-dessus-34").phrase


def test_la_taille_dit_la_grille_et_le_calage(client):
    """**La contradiction mesurée du dépôt, réparée à sa source.**

    Le réglage disait 128 pendant que le texte envoyé disait 64, trois fois. Les
    deux ne peuvent plus diverger parce qu'il n'y a plus qu'un seul endroit :
    le réglage. La phrase est sa lecture, pas sa copie.
    """
    client.put("/api/universe", json={"cible_px": 128})

    univers = _univers(client)
    assert univers["cible_px"] == 128
    assert univers["phrases"]["rendu"] == phrase_de_grille(128)
    assert univers["phrases"]["technique"] == phrase_de_calage(128)
    assert "128x128" in univers["phrases"]["technique"]
    # Les cases, elles, n'ont rien reçu.
    assert _case(client, "rendu")["texte"] == ""
    assert _case(client, "technique")["texte"] == ""

    # Changer de taille change les deux, immédiatement et sans condition —
    # c'est ce qui interdit la dérive, et ça ne dépend plus de savoir si
    # l'auteur avait touché la case.
    client.put("/api/universe", json={"cible_px": 32})
    phrases = _univers(client)["phrases"]
    assert "32x32" in phrases["rendu"]
    assert "128" not in phrases["technique"]


def test_une_etiquette_ajoutee_ne_gele_plus_la_phrase(client):
    """**La panne exacte que ce déplacement répare**, et elle était silencieuse.

    Tant que la phrase vivait dans la case, ajouter un mot à côté d'elle faisait
    de la case « du texte d'auteur », et le produit s'interdisant d'y toucher, la
    grille cessait de suivre la taille. Une seule étiquette cliquée gelait donc
    le prompt sur une taille qu'on venait de quitter.
    """
    client.put("/api/universe", json={"cible_px": 64})
    # L'auteur clique une étiquette : elle s'ajoute au texte de la case.
    client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": "rendu", "texte": "16-bit pixel art, SNES era", "actif": True}
            ]
        },
    )

    client.put("/api/universe", json={"cible_px": 128})

    univers = _univers(client)
    # Le texte de l'auteur est intact…
    assert _case(client, "rendu")["texte"] == "16-bit pixel art, SNES era"
    # …et la phrase a suivi la taille, ce qu'elle ne faisait plus avant.
    assert univers["phrases"]["rendu"] == phrase_de_grille(128)


def test_le_nombre_de_directions_ne_part_plus_dans_le_texte(client):
    """**Retiré le 31 août 2026, et la raison est mesurée.**

    Cette phrase partait avec les vingt-huit générations du projet, dont six
    planches d'équipement où elle **contredisait la consigne de l'appel** : on
    demandait une pièce posée à plat, et la bible réclamait quatre orientations.
    Elle ne manque pas — chaque image dit déjà elle-même la direction qu'elle
    montre, case par case.
    """
    client.put("/api/universe", json={"vue": "vue-dessus-34", "cible_px": 64})

    for nom in CHAMPS_BIBLE:
        assert "directional" not in _case(client, nom)["texte"]


def test_le_produit_ne_touche_jamais_ce_que_l_auteur_a_tape(client):
    """**La promesse tient, et elle ne coûte plus de borne.**

    Le produit n'écrivant plus rien dans les cases, il ne peut plus rien y
    effacer : « c'est du texte libre » devient vrai par construction, au lieu
    de l'être par une liste close de phrases qu'on avait le droit d'écraser.
    """
    a_la_main = "chunky 2D pixel art, hand-placed, no snapping at all"
    client.put(
        "/api/universe",
        json={"bible": [{"nom": "rendu", "texte": a_la_main, "actif": True}]},
    )

    client.put("/api/universe", json={"cible_px": 96})

    assert _case(client, "rendu")["texte"] == a_la_main
    # Et les deux partent ensemble : l'atelier d'abord, l'auteur ensuite.
    assert _univers(client)["phrases"]["rendu"] == phrase_de_grille(96)
    assert "96x96" in _univers(client)["phrases"]["technique"]


def test_sans_cible_aucune_phrase_n_est_dite(client):
    """« Un univers vide ne contraint rien » (US-57), et *aucune* est une valeur.

    Écrire `no pixel grid` serait une affirmation que personne n'a faite. La
    case n'a donc pas de ligne d'atelier du tout — pas une ligne vide.
    """
    client.put("/api/universe", json={"cible_px": 128})
    assert _univers(client)["phrases"]["rendu"]

    client.put("/api/universe", json={"cible_px": 0})
    phrases = _univers(client)["phrases"]
    assert "rendu" not in phrases
    assert "technique" not in phrases


def test_la_phrase_de_l_atelier_ne_survit_pas_dans_un_fichier_ancien(client):
    """**La migration du 1ᵉʳ septembre 2026, vue depuis l'API.**

    Un `projet.json` écrit avant porte la phrase du produit *dans* la case —
    seule, ou collée devant le texte de l'auteur. La relecture la retire, et
    elle ne retire que ça.
    """
    client.put("/api/universe", json={"cible_px": 64})
    client.put(
        "/api/universe",
        json={
            "bible": [
                {
                    "nom": "rendu",
                    # Exactement ce qu'un fichier d'avant contient.
                    "texte": phrase_de_grille(64) + ", 16-bit pixel art",
                    "actif": True,
                },
                {"nom": "technique", "texte": phrase_de_calage(64), "actif": True},
            ]
        },
    )

    # Le projet est relu du disque à chaque appel : la migration a déjà eu lieu.
    assert _case(client, "rendu")["texte"] == "16-bit pixel art"
    assert _case(client, "technique")["texte"] == ""
    # Et ce qui part n'a pas changé d'un signe.
    phrases = _univers(client)["phrases"]
    assert phrases["rendu"] == phrase_de_grille(64)
    assert phrases["technique"] == phrase_de_calage(64)


def test_une_vue_inconnue_est_refusee_en_la_nommant(client):
    reponse = client.put("/api/universe", json={"vue": "vue-de-cote-en-diagonale"})

    assert reponse.status_code == 409
    assert "vue inconnue" in reponse.json()["raison"]


# ── « Un changement qui casse du travail payé annonce les vrais chiffres » ────


def test_les_consequences_disent_le_compte_et_ne_bloquent_jamais(client, double):
    """**Rien n'est jamais grisé dans l'assistant.**

    Le produit n'a qu'un seul refus automatique — le compte d'images — et en
    ajouter un deuxième reviendrait à bloquer un auteur sur son propre jeu. Un
    chiffre exact aide mieux qu'une case grise.
    """
    client.put("/api/universe", json={"cible_px": 64})
    client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un sujet d'essai"},
    )

    dit = client.get("/api/universe/consequences", params={"cible_px": 128}).json()
    assert dit["cible"] == 64
    assert dit["images"] >= 1
    # Le coût vient de ce qui a été payé dans ce jeu, jamais d'un tarif écrit.
    assert dit["cout_usd"] > 0

    # Et le réglage passe quand même.
    assert client.put("/api/universe", json={"cible_px": 128}).status_code == 200


def test_la_meme_taille_ne_casse_rien(client):
    """Une question posée sur ce qui ne change pas a une réponse, et c'est zéro."""
    client.put("/api/universe", json={"cible_px": 64})
    dit = client.get("/api/universe/consequences", params={"cible_px": 64}).json()

    assert dit["images"] == 0
    assert dit["cout_usd"] == 0


# ── Les étiquettes ───────────────────────────────────────────────────────────


def test_la_base_d_etiquettes_part_pleine(client):
    """**Renversé le 1ᵉʳ septembre 2026, et pour un compte, pas pour un goût.**

    La décision d'origine était *personne ne l'écrit à la place de l'auteur*, et
    ce qu'elle produisait était mesurable : au premier jeu l'étape de l'allure
    était sept champs de texte libre, en anglais, avec trois lignes qui disaient
    la même absence et rien à cliquer. Le mécanisme des étiquettes existe pour
    rendre la description *mécanique au lieu d'être rédigée* — une base vide ne
    rend rien de mécanique.

    Ce que la base contient, et la page qui la porte, vivent dans
    `tests/test_etiquettes_livrees.py`. Ici on ne vérifie que le renversement.
    """
    recu = client.get("/api/labels").json()["etiquettes"]

    assert recu
    assert all(e["livree"] for e in recu)


def test_une_etiquette_est_une_paire_et_les_deux_moities_sont_exigees(client):
    """Une étiquette sans texte anglais ne fait rien partir ; une étiquette sans
    libellé ne se clique pas. C'est la paire qui est l'objet."""
    sans_anglais = client.post(
        "/api/labels", json={"libelle": "brume basse", "texte": "   ", "case": "eclairage"}
    )
    assert sans_anglais.status_code in (409, 422)

    inconnue = client.post(
        "/api/labels",
        json={"libelle": "brume basse", "texte": "low fog", "case": "ambiance"},
    )
    assert inconnue.status_code == 409
    assert "case de bible inconnue" in inconnue.json()["raison"]


def test_une_etiquette_appartient_a_l_atelier_et_pas_a_un_projet(client):
    """**Comme la clé du fournisseur, elle ne dépend d'aucun jeu.**

    Un deuxième jeu part de ce que le premier a nommé — rangée par projet, la
    base repartirait vide à chaque fois et le mécanisme ne servirait jamais.
    """
    client.post(
        "/api/labels",
        json={
            "libelle": "brume de tourbe",
            "texte": "peat smoke haze, low and clinging",
            "case": "eclairage",
        },
    )
    autre = client.post("/api/projects", json={"nom": "Un autre jeu"}).json()["projet"]
    client.put("/api/projects/current", json={"projet": autre["identifiant"]})

    # **Une seule fabriquée dans une base qui en porte soixante-dix livrées** :
    # c'est celle-là qu'on cherche, et c'est sa marque qui la désigne.
    recu = client.get("/api/labels").json()["etiquettes"]
    (etiquette,) = [e for e in recu if not e["livree"]]
    assert etiquette["libelle"] == "brume de tourbe"
    assert etiquette["texte"] == "peat smoke haze, low and clinging"
    assert etiquette["case"] == "eclairage"


def test_deux_fois_le_meme_libelle_dans_la_meme_case_est_refuse(client):
    charge = {"libelle": "brume de tourbe", "texte": "peat smoke haze", "case": "eclairage"}
    assert client.post("/api/labels", json=charge).status_code == 201

    encore = client.post("/api/labels", json=charge)
    assert encore.status_code == 409
    assert "existe déjà" in encore.json()["raison"]

    # Le même libellé dans une autre case, en revanche, est une autre étiquette :
    # « brume de tourbe » ne dit pas la même chose au trait qu'à l'éclairage.
    ailleurs = {**charge, "case": "trait"}
    assert client.post("/api/labels", json=ailleurs).status_code == 201


def test_les_plus_employees_passent_devant(client):
    """**Un compte, jamais un classement enregistré** : l'ordre de fabrication
    départage les ex æquo, et c'est celui que l'auteur reconnaît."""
    for libelle in ("brume de tourbe", "halo de vitrail", "lueur de creuset"):
        client.post(
            "/api/labels",
            json={"libelle": libelle, "texte": f"{libelle} en anglais", "case": "eclairage"},
        )
    recu = client.get("/api/labels").json()["etiquettes"]
    milieu = [e for e in recu if not e["livree"]][1]["identifiant"]

    client.post(f"/api/labels/{milieu}/used")
    client.post(f"/api/labels/{milieu}/used")

    devant = client.get("/api/labels").json()["etiquettes"]
    assert max(devant, key=lambda e: e["emplois"])["identifiant"] == milieu
    assert max(e["emplois"] for e in devant) == 2


def test_oublier_une_etiquette_ne_touche_a_aucune_case(client):
    """**Jamais de cascade** : le texte est parti dans la case au moment du clic,
    et l'étiquette n'en est que l'origine."""
    client.post(
        "/api/labels",
        json={"libelle": "brume de tourbe", "texte": "peat smoke haze", "case": "eclairage"},
    )
    recu = client.get("/api/labels").json()["etiquettes"]
    (etiquette,) = [e for e in recu if not e["livree"]]
    client.put(
        "/api/universe",
        json={"bible": [{"nom": "eclairage", "texte": "low fog", "actif": True}]},
    )

    client.delete(f"/api/labels/{etiquette['identifiant']}")

    apres = client.get("/api/labels").json()["etiquettes"]
    assert not [e for e in apres if not e["livree"]]
    assert _case(client, "eclairage")["texte"] == "low fog"


def test_toutes_les_tailles_ont_leur_phrase(client):
    """Le domaine sait écrire pour chacune des neuf : sans ça, une taille
    proposée serait une taille dont le texte resterait vide."""
    for cible, quoi in TAILLES:
        assert str(cible) in phrase_de_grille(cible)
        assert str(cible) in phrase_de_calage(cible)
        assert quoi
