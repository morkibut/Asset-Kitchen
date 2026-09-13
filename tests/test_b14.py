# -*- coding: utf-8 -*-
"""B14 — les règles du jeu : la vue et le rendu ne se disent plus deux fois.

**Planche** : `docs/archive/pistes-2026-09-04/carnet/Nouveau-jeu.dc.html`, bloquée par
`B0`.

Le parcours en quatre étapes est un écran ; ce fichier ne mesure que ce qui le
rend possible côté serveur, et c'est le vrai travail de la tranche :

1. **`rendu` et `vue` sont des cases de l'atelier** — `CHAMPS_DE_L_ATELIER`.
   L'auteur n'y écrit plus, l'atelier y écrit seul, et il n'y a donc plus deux
   endroits d'où la même consigne peut partir.
2. **La mesure se fait sur un envoi réel, pas sur un texte d'écran.** Chaque
   essai de doublon lit `FournisseurDouble.demandes[-1].prompt` — ce qui est
   *arrivé au bout du port*, pas ce que le produit dit avoir composé. C'est la
   même exigence que `tests/test_c3.py` pose pour les références réinjectées.
3. **Ce que l'auteur avait tapé là ne disparaît pas** : il reste dans le
   fichier, il est relu, et la route le rend sous `atelier.sans_effet` pour que
   l'écran le montre barré. Une tranche qui range n'a aucune raison d'effacer.
4. **Le texte de caméra exact est déjà servi** — `GET /api/universe/views` rend
   `contrainte`, `volume` et `corps` depuis `Vue.en_json()` (E8). L'écran n'a
   rien à paraphraser, et cet essai le verrouille : le texte servi est **le
   même objet** que celui qui part au fournisseur.
5. **Deux jeux du même nom s'avertissent** — `deja_porte`, une règle, deux
   gestes : créer et renommer. Elle avertit, elle ne refuse pas.
6. **Le dossier reste figé au nom de création** — déjà vrai depuis toujours
   (`atelier/domaine/projet.py`), vérifié ici parce que c'est un critère de la
   tranche et qu'un acquis non mesuré se reperd.

**Le troisième doublon reste ouvert, et c'est écrit dans la planche** : la case
`technique` garde du texte d'auteur — le calage y cohabite avec l'interdit —,
donc `_REDITES` garde ses quatre mots pour elle. Deux essais le disent en toutes
lettres plutôt que de laisser croire à un oubli.

**Aucun essai de ce fichier ne coûte un centime** : le fournisseur est le double
de `tests/conftest.py`, sans réseau et sans facture.
"""

from __future__ import annotations

import time

from atelier.domaine.projet import (
    CHAMPS_BIBLE,
    CHAMPS_DE_L_ATELIER,
    _REDITES,
    deja_porte,
    meme_nom,
)
from atelier.domaine.vue import VUES, vue as vue_connue

MODELE = "essai:rend-du-png"

# La vue du décor de ce fichier — celle de la planche, *de dessus, verticale*.
# Elle est choisie pour deux raisons : sa phrase de bible et sa contrainte de
# queue ne partagent aucun mot avec le texte d'auteur qu'on lui oppose, donc un
# doublon se voit sans ambiguïté ; et c'est celle que la maquette dessine.
VUE = "vue-dessus-verticale"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _bible(client, **textes: str) -> dict:
    """Poser des cases de la bible **par leur nom**, les autres restant vides."""
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": textes.get(nom, ""), "actif": True}
                for nom in CHAMPS_BIBLE
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _regler(client, **reglages) -> dict:
    reponse = client.put("/api/universe", json=reglages)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _univers(client) -> dict:
    reponse = client.get("/api/universe")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")


def _envoyer(client, prompt: str = "un tonneau", **corps) -> dict:
    """Une génération menée à terme — **le seul chemin qui atteigne le port**.

    L'aperçu (`POST /api/prompt/preview`) compose le même texte et ne le fait
    pas partir : il ne prouverait donc pas ce que ce fichier veut prouver.
    """
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": prompt, **corps}
    )
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _parti(double) -> str:
    """Le texte **arrivé au fournisseur**, pas celui que le produit annonce."""
    assert double.demandes, "aucun appel n'a atteint le fournisseur"
    return double.demandes[-1].prompt


def _combien(texte: str, morceau: str) -> int:
    return texte.count(morceau)


# ── 1 · La vue ne part plus deux fois ────────────────────────────────────────


def test_la_vue_de_lauteur_ne_part_plus_a_cote_de_celle_du_jeu(client, double):
    """**Le doublon nommé par la planche, mesuré sur un envoi réel.**

    Avant `B14` : l'auteur tapait sa caméra dans la case `vue` de la bible *et*
    choisissait une vue ; les deux textes s'empilaient dans la même ligne
    `View and framing:`, séparés d'une virgule. La liste `_REDITES` rattrapait
    le cas **quand elle voyait un de ses douze mots anglais**, et pas autrement.

    Le texte d'auteur choisi ici est exactement celui que la liste ne voyait
    pas : *« vu du ciel, bien au-dessus »* ne contient ni `top-down`, ni
    `overhead`, ni `camera`. C'était donc, avant, deux caméras dans le même
    envoi — et c'est ce que cet essai interdit désormais.
    """
    _regler(client, vue=VUE)
    _bible(client, monde="marais de fer", vue="vu du ciel, bien au-dessus")

    _envoyer(client)
    parti = _parti(double)

    # Ce qui part est la phrase de l'atelier, seule.
    connue = vue_connue(VUE)
    assert f"View and framing: {connue.phrase}" in parti
    assert "vu du ciel, bien au-dessus" not in parti


def test_la_camera_ne_se_dit_quune_fois_par_ligne_de_bible(client, double):
    """La ligne `View and framing:` porte **une** phrase et rien d'autre.

    Vérifié sur la ligne elle-même plutôt que sur le texte entier : la caméra
    est **aussi** redite en queue de prompt depuis le 1ᵉʳ septembre 2026
    (`ServiceProduction.cadrage`), et cette redite-là est voulue, mesurée sur
    trente images payées (`essais/essai_vue.py`). Ce que `B14` supprime est le
    doublon *dans la bible*, pas le rappel de queue.
    """
    _regler(client, vue=VUE)
    _bible(client, vue="top-down, resserré sur le sujet")

    _envoyer(client)
    ligne = next(
        l for l in _parti(double).splitlines() if l.startswith("View and framing:")
    )

    assert ligne == f"View and framing: {vue_connue(VUE).phrase}"
    assert "resserré" not in ligne


def test_sans_vue_choisie_la_ligne_de_camera_ne_part_pas(client, double):
    """**Sans vue, rien n'est écrit — et le texte d'auteur ne comble pas le trou.**

    C'est la règle d'US-57 — *un univers vide ne contraint rien* — appliquée à
    une case qui n'appartient plus à l'auteur. Avant `B14`, un jeu sans vue
    choisie envoyait quand même une caméra : celle que quelqu'un avait tapée
    dans la case, un jour, sans plus savoir où elle se réglait.
    """
    _bible(client, monde="marais de fer", vue="strict top-down view")

    _envoyer(client)
    parti = _parti(double)

    assert "View and framing" not in parti
    assert "strict top-down view" not in parti
    # Et la caméra de queue ne part pas non plus : elle vient de la même vue.
    assert "CAMERA — this overrides" not in parti


# ── 2 · Le rendu ne part plus deux fois ──────────────────────────────────────


def test_la_grille_de_lauteur_ne_part_plus_a_cote_de_celle_du_jeu(client, double):
    """Le second doublon de la planche : la ligne `rendu` disait la grille, et
    l'allure la disait aussi.

    Le texte d'auteur est celui du vrai projet — tapé en français, avec un
    nombre —, et c'est celui qui pouvait contredire la taille réglée. Il ne
    part plus ; la grille se choisit à l'étape de l'allure, et là seulement.
    """
    _regler(client, cible_px=128)
    _bible(client, rendu="pixel art costaud, 64 pixels de côté")

    _envoyer(client)
    parti = _parti(double)

    assert "Rendering technique: 2D pixel art on a 128x128 grid" in parti
    assert "64 pixels de côté" not in parti
    assert _combien(parti, "pixel art on a") == 1


def test_un_jeu_en_dessin_ne_recoit_aucune_ligne_de_grille(client, double):
    """La règle de `D2` tient après `B14` : un jeu en dessin n'a pas de grille,
    et la case `rendu` ne dit alors rien du tout — le texte d'auteur ne vient
    pas la remplir à la place."""
    _regler(client, style="dessin")
    _bible(client, monde="aquarelle humide", rendu="pixel art 16 bits")

    _envoyer(client)
    parti = _parti(double)

    assert "Rendering technique" not in parti
    assert "pixel art 16 bits" not in parti


# ── 3 · Le troisième doublon reste ouvert, et c'est écrit ────────────────────


def test_la_case_technique_garde_son_texte_dauteur(client, double):
    """**Le troisième cas que la planche laisse ouvert.**

    `technique` porte deux sujets à la fois — le calage que l'atelier écrit, et
    ce que le modèle ne doit jamais faire, que l'auteur écrit. La fermer aurait
    retiré à l'auteur le seul endroit où poser un interdit. Les deux textes s'y
    empilent donc, comme avant, et `_REDITES` garde ses quatre mots pour elle
    seule.
    """
    _bible(client, technique="pas de texte, pas de cadre")

    _envoyer(client)
    parti = _parti(double)

    assert "single isolated sprite on a flat background" in parti
    assert "pas de texte, pas de cadre" in parti


def test_la_liste_des_redites_a_perdu_ses_deux_tiers(client):
    """**Ce que la tranche retire, compté.**

    La liste tenue à la main portait **vingt** mots répartis sur trois cases —
    la planche en annonce vingt-deux, et c'est le seul chiffre d'elle que le
    relevé corrige. Deux cases en sortent : il en reste quatre, tous pour
    `technique`.

    Cet essai n'est pas décoratif : il tomberait le jour où quelqu'un rouvrirait
    `rendu` ou `vue` au texte d'auteur sans rouvrir la tranche qui l'a fermé.
    """
    assert set(_REDITES) == {"technique"}
    assert len(_REDITES["technique"]) == 4
    assert CHAMPS_DE_L_ATELIER == ("rendu", "vue")
    # Les deux cases fermées sont bien des cases de la bible, pas des inventions.
    assert set(CHAMPS_DE_L_ATELIER) <= set(CHAMPS_BIBLE)


# ── 4 · Ce que l'auteur avait tapé là ne disparaît pas ───────────────────────


def test_le_texte_qui_ne_part_plus_reste_lisible(client):
    """**Rien n'est effacé — le fichier garde tout, la route le dit.**

    Une tranche qui range n'a aucune raison de détruire. Le texte reste dans la
    case, il se relit, et `atelier.sans_effet` le nomme pour que l'écran le
    montre barré avec l'étape qui écrit à sa place. Le faire disparaître aurait
    été le seul geste irréversible d'une tranche qui n'en demandait aucun.
    """
    _regler(client, vue=VUE)
    _bible(client, vue="vu du ciel", rendu="gros pixels")

    recu = _univers(client)

    # Le disque garde le texte, mot pour mot.
    par_nom = {c["nom"]: c["texte"] for c in recu["univers"]["bible"]}
    assert par_nom["vue"] == "vu du ciel"
    assert par_nom["rendu"] == "gros pixels"
    # Et la route dit qu'il ne part plus.
    assert recu["atelier"]["sans_effet"] == {"rendu": "gros pixels", "vue": "vu du ciel"}
    assert recu["atelier"]["champs"] == ["rendu", "vue"]
    # **Le bloc ne redit pas les phrases** : `univers.phrases` les porte depuis
    # le 1ᵉʳ septembre 2026, et une seconde copie dans la même réponse aurait
    # été le doublon que cette tranche existe pour supprimer.
    assert set(recu["atelier"]) == {"champs", "sans_effet"}


def test_le_cas_courant_ne_montre_aucune_rature(client):
    """Un jeu qui n'a jamais rien tapé là ne rend rien : l'écran ne dessine pas
    un avertissement autour de rien."""
    _regler(client, vue=VUE)

    recu = _univers(client)

    assert recu["atelier"]["sans_effet"] == {}
    # La phrase exacte, là où elle vit déjà — et nulle part ailleurs.
    assert recu["univers"]["phrases"]["vue"] == vue_connue(VUE).phrase


# ── 5 · Le texte de caméra exact, servi tel qu'il partira ────────────────────


def test_lecran_recoit_le_texte_de_camera_exact_et_pas_une_paraphrase(client, double):
    """**Ce que l'écran montre est ce qui part, au caractère près.**

    La planche affiche le texte de caméra dans l'étape de la vue. Il n'a rien à
    recomposer : `GET /api/universe/views` rend déjà `contrainte`, `volume` et
    `corps` depuis `Vue.en_json()` (E8), et cet essai vérifie que ces trois
    champs-là sont **littéralement** ceux qui atteignent le fournisseur.

    C'est le critère *« l'écran montre le texte de caméra exact »* tenu par la
    donnée, pas par une promesse : une paraphrase à l'écran deviendrait fausse
    au premier mot changé dans `atelier/domaine/vue.py`, et rien ne le dirait.
    """
    servi = client.get("/api/universe/views").json()
    assert servi["vues"], "la route ne sert aucune vue"
    la_vue = next(v for v in servi["vues"] if v["identifiant"] == VUE)

    _regler(client, vue=VUE)
    _envoyer(client)
    parti = _parti(double)

    assert la_vue["contrainte"] in parti
    assert la_vue["volume"] in parti
    assert la_vue["phrase"] in parti


def test_les_huit_vues_servent_leur_texte_de_camera(client):
    """Aucune des huit n'est servie sans son texte : l'écran ne peut donc pas
    tomber sur une vue qu'il aurait à décrire lui-même."""
    servi = client.get("/api/universe/views").json()["vues"]

    assert len(servi) == len(VUES) == 8
    for v in servi:
        assert v["contrainte"].startswith("CAMERA — this overrides everything above.")
        assert v["volume"], f"« {v['libelle']} » ne dit pas ce qu'on voit d'elle"


# ── 6 · Deux jeux du même nom s'avertissent ──────────────────────────────────


def test_creer_un_jeu_du_nom_dun_autre_avertit_sans_refuser(client):
    """**Un avertissement, pas un refus** — le jeu est créé, et il le dit.

    Deux essais du même monde sont légitimes ; y tomber sans l'avoir voulu ne
    l'est pas. Le produit crée, donne un dossier distinct — ce que `repere` fait
    depuis toujours — et nomme la collision.
    """
    premier = client.post("/api/projects", json={"nom": "Le Marais"})
    assert premier.status_code == 201, premier.text
    assert premier.json()["avertissement"] == ""

    second = client.post("/api/projects", json={"nom": "le  marais"})

    assert second.status_code == 201, second.text
    assert "Le Marais" in second.json()["avertissement"]
    # Rien n'est refusé : les deux existent, avec deux dossiers.
    assert premier.json()["projet"]["identifiant"] == "le-marais"
    assert second.json()["projet"]["identifiant"] == "le-marais-2"


def test_renommer_un_jeu_du_nom_dun_autre_avertit_pareil(client):
    """La même phrase pour le même fait : renommer laisse exactement les deux
    lignes identiques que la création évitait de laisser en silence."""
    client.post("/api/projects", json={"nom": "Le Marais"})
    autre = client.post("/api/projects", json={"nom": "Les Salines"}).json()["projet"]

    renomme = client.put(f"/api/projects/{autre['identifiant']}", json={"nom": "Le Marais"})

    assert renomme.status_code == 200, renomme.text
    assert "Le Marais" in renomme.json()["avertissement"]
    # Le dossier ne bouge pas — c'est le critère du dessous, vu d'ici.
    assert renomme.json()["projet"]["identifiant"] == autre["identifiant"]


def test_un_jeu_ne_savertit_pas_de_son_propre_nom(client):
    """Se renommer de son propre nom n'est pas une collision — sans quoi tout
    renommage avertirait, et l'avertissement ne voudrait plus rien dire."""
    projet = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]

    renomme = client.put(f"/api/projects/{projet['identifiant']}", json={"nom": "Le Marais"})

    assert renomme.json()["avertissement"] == ""


def test_la_regle_du_meme_nom_ignore_la_casse_et_les_espaces_pas_les_accents(client):
    """**Ce qui compte est ce qu'un lecteur ne peut pas distinguer.**

    « le marais » et « Le  Marais » donnent deux lignes identiques à l'œil ;
    « Foret » et « Forêt » se lisent, et l'auteur qui écrit les deux sait ce
    qu'il fait. C'est pour cela que la règle n'est pas `repere`, qui déplie les
    accents parce qu'un système de fichiers l'exige.
    """
    assert meme_nom("le marais", "Le  Marais")
    assert not meme_nom("Foret", "Forêt")
    assert deja_porte("LE MARAIS", ["Les Salines", "le marais"])
    assert not deja_porte("Le Marais", ["Les Salines"])


# ── 7 · Le dossier reste figé au nom de création ─────────────────────────────


def test_le_dossier_reste_fige_meme_apres_deux_renommages(client, atelier):
    """**Un acquis, vérifié parce qu'un acquis non mesuré se reperd.**

    « Un dossier qui se renomme sous les fichiers qu'il contient est un
    déménagement, pas un renommage » (`atelier/domaine/projet.py`). Le parcours
    de création montre le dossier à l'étape 1 justement parce qu'il ne se
    reprend pas ; cet essai vérifie que la promesse tient sur le disque, pas
    seulement dans la réponse de la route.
    """
    projet = client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}).json()
    identifiant = projet["projet"]["identifiant"]
    assert identifiant == "le-marais-du-vieux-moulin"

    client.put(f"/api/projects/{identifiant}", json={"nom": "Les Salines"})
    client.put(f"/api/projects/{identifiant}", json={"nom": "Tout autre chose"})

    relu = client.get("/api/library").json()
    sien = next(p for p in relu["projets"] if p["identifiant"] == identifiant)
    assert sien["nom"] == "Tout autre chose"
    assert sien["identifiant"] == "le-marais-du-vieux-moulin"
    # Et sur le disque, pas seulement dans l'index.
    assert atelier.bibliotheque.projets()
    du_disque = next(
        p for p in atelier.bibliotheque.projets() if p.identifiant == identifiant
    )
    assert du_disque.nom == "Tout autre chose"


# ── 8 · Créer un jeu sans rien régler marche toujours ────────────────────────


def test_un_jeu_cree_sans_rien_regler_fabrique_quand_meme(client, double):
    """**Chacune des quatre étapes se saute** — le premier critère de la tranche.

    Un jeu neuf, aucune allure, aucune vue, aucun monde : l'appel part, et il ne
    porte que le sujet. C'est l'invariant d'US-57 vérifié une fois de plus, et
    c'est lui qui autorise les trois derniers pas du parcours à être optionnels.
    """
    client.post("/api/projects", json={"nom": "Tout neuf"})

    _envoyer(client, prompt="un tonneau")
    parti = _parti(double)

    assert parti.strip() == "REQUEST\n\nun tonneau"
