# -*- coding: utf-8 -*-
"""RG5 — les matières deviennent une bibliothèque (`docs/PLAN-rangement.md`,
`docs/RG5-la-bibliotheque-des-matieres.md`).

Le trou que cette tranche répare : une matière était un sujet déguisé — le
seul créateur de sujet, `create_character`, ne prend pas de nature « matière »
à créer, et `generate_tile_material` rendait des images qu'aucun écran
n'aurait jamais vues. RG5 fait de la matière un ingrédient, marqué sur
l'image elle-même, groupable en collections comme un sujet l'est déjà.

Chaque essai nomme la panne qu'il empêche :

- une matière qui resterait accrochée à un sujet (elle ne doit plus l'être) ;
- une collection qui mélangerait sujets et matières dans le même compte ;
- une vieille fiche de collection (sans `genre`) qui se relirait de travers ;
- `_asset_valide` qui se mettrait à refuser une image non marquée — la panne
  que la spécification interdit expressément, parce qu'elle casserait des
  jeux de tuiles déjà composés ;
- les deux routes qui proposent encore une livraison à une matière.

Aucun essai ne coûte un centime : la génération d'une matière passe par le
double ComfyUI de TU5, jamais par un fournisseur payant.
"""
from __future__ import annotations

from test_t3 import _asset, _generer
from test_tu5_matieres import atelier_matieres  # réutilisé tel quel (double ComfyUI)

from atelier.domaine.projet import MATIERE, SUJET, Collection, Membre, membres_depuis_json
from atelier.services.bibliotheque import ProjetInconnu


# ── Le modèle : sujet et matière, dans le même mécanisme ─────────────────────


def test_membre_par_defaut_est_un_sujet():
    """Une fiche qui ne dit rien range un sujet — le comportement d'avant RG5,
    inchangé pour tout appelant qui ne connaît pas encore le genre."""
    assert Membre(jeu="marais", sujet="pelerin").genre == SUJET


def test_collection_range_une_matiere_sans_nouveau_mecanisme():
    """Le critère de RG5 au niveau du modèle : une matière se range et se
    retire par `Collection.avec` / `Collection.sans`, exactement comme un
    sujet — aucune seconde bibliothèque n'existe pour elle."""
    groupe = Collection(identifiant="pierres", nom="Pierres")
    groupe = groupe.avec("marais", "pelerin")  # un sujet, comme toujours
    groupe = groupe.avec("marais", "7b894dced-0", genre=MATIERE)  # une matière

    assert groupe.contient("marais", "pelerin")
    assert groupe.contient("marais", "7b894dced-0", genre=MATIERE)
    # Chacun ne compte que dans sa moitié : un écran de sujets ne doit pas
    # additionner des images, et réciproquement.
    assert groupe.sujets_du_jeu("marais") == ("pelerin",)
    assert groupe.matieres_du_jeu("marais") == ("7b894dced-0",)

    sans_matiere = groupe.sans("marais", "7b894dced-0", genre=MATIERE)
    assert sans_matiere.matieres_du_jeu("marais") == ()
    assert sans_matiere.sujets_du_jeu("marais") == ("pelerin",)  # le sujet reste


def test_deux_fois_ne_fait_pas_deux_membres_matiere():
    groupe = Collection(identifiant="pierres", nom="Pierres").avec(
        "marais", "asset-1", genre=MATIERE
    )
    encore = groupe.avec("marais", "asset-1", genre=MATIERE)
    assert encore.membres == (Membre(jeu="marais", sujet="asset-1", genre=MATIERE),)


def test_une_fiche_ecrite_avant_rg5_se_relit_comme_un_sujet():
    """Pas de migration : une entrée de `collections.json` sans `genre` — toute
    fiche écrite avant ce jour — se relit comme un sujet, sans rien perdre."""
    membres = membres_depuis_json([{"jeu": "marais", "sujet": "pelerin"}])
    assert membres == (Membre(jeu="marais", sujet="pelerin", genre=SUJET),)


def test_un_genre_inconnu_sur_le_disque_retombe_sur_sujet():
    """Une valeur qui n'est ni « sujet » ni « matiere » est un membre mal
    formé comme un autre : elle ne doit pas empêcher toute la fiche de se
    relire, ni inventer un troisième genre que le produit ne connaît pas."""
    membres = membres_depuis_json([{"jeu": "marais", "sujet": "x", "genre": "autre-chose"}])
    assert membres == (Membre(jeu="marais", sujet="x", genre=SUJET),)


# ── La règle de naissance : `echelle="matière"` fait la matière ──────────────


async def test_une_matiere_generee_nait_marquee(atelier_matieres):
    """Le cœur de la tranche : aucune déclaration à part, c'est la génération
    elle-même — celle que `ServiceGenerations.soumettre_matiere` pose avec
    `echelle="matière"` — qui fait de l'image qui revient une matière."""
    atelier, _comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    generations = await atelier.matieres.generer(
        projet, pierre="pierre grise", motif="quatre dalles", cadrage="surface", tirages=1,
    )
    await atelier.generations.attendre_tout()
    identifiant = f"{generations[0].identifiant}-0"
    asset = atelier.assets.lire(identifiant)
    assert asset is not None
    assert asset.matiere is True
    # Et c'est bien un ingrédient : elle n'a ni sujet ni pose, comme toute
    # image qui n'est jamais passée par un objectif de personnage.
    assert asset.personnage is None
    assert asset.pose is None


async def test_une_matiere_generee_entre_dans_la_bibliotheque_du_projet(atelier_matieres):
    """Une matière existe sans sujet, et se liste (RG5, critère 1) — la panne
    que RG5 corrige : `generate_tile_material` rendait des images qu'aucun
    onglet ne pouvait montrer."""
    atelier, _comfy = atelier_matieres
    projet = atelier.bibliotheque.courant
    generations = await atelier.matieres.generer(
        projet, pierre="pierre grise", motif="quatre dalles", cadrage="face", tirages=1,
    )
    await atelier.generations.attendre_tout()
    identifiant = f"{generations[0].identifiant}-0"

    bibliotheque = atelier.bibliotheque.matieres(projet)
    assert [m.identifiant for m in bibliotheque] == [identifiant]


async def test_bibliotheque_matieres_refuse_un_projet_inconnu(atelier_matieres):
    atelier, _comfy = atelier_matieres
    try:
        atelier.bibliotheque.matieres("projet-qui-nexiste-pas")
    except ProjetInconnu:
        pass
    else:
        raise AssertionError("un projet inconnu doit être refusé, pas rendre une liste vide")


# ── Déclarer une image existante matière, et le retirer ──────────────────────


def test_declarer_une_image_ordinaire_matiere_puis_le_retirer(atelier, client):
    """Le « en un geste » de RG6, ici au niveau du service : une image
    ordinaire — sortie d'une génération de personnage, pas de matière — entre
    et sort de la bibliothèque sans qu'aucun sujet ne bouge."""
    generation = _generer(client, "un mur de pierre")
    brut = _asset(client, generation)
    identifiant = brut["identifiant"]
    assert brut["matiere"] is False

    projet = atelier.bibliotheque.courant
    assert identifiant not in [m.identifiant for m in atelier.bibliotheque.matieres(projet)]

    marque = atelier.bibliotheque.declarer_matiere(identifiant, True)
    assert marque.matiere is True
    assert identifiant in [m.identifiant for m in atelier.bibliotheque.matieres(projet)]

    retire = atelier.bibliotheque.declarer_matiere(identifiant, False)
    assert retire.matiere is False
    assert identifiant not in [m.identifiant for m in atelier.bibliotheque.matieres(projet)]


def test_route_get_et_put_materials(client):
    """Les deux routes de RG5, à l'API : lire la bibliothèque, déclarer une
    image, la retirer — dans les formes précises de la spécification."""
    generation = _generer(client, "une tuile de mousse")
    brut = _asset(client, generation)
    identifiant = brut["identifiant"]
    projet = brut["projet"]

    vide = client.get(f"/api/projects/{projet}/materials")
    assert vide.status_code == 200, vide.text
    assert identifiant not in [m["identifiant"] for m in vide.json()["matieres"]]

    declare = client.put(
        f"/api/projects/{projet}/materials/{identifiant}", json={"matiere": True}
    )
    assert declare.status_code == 200, declare.text
    fiche = declare.json()
    assert fiche["identifiant"] == identifiant
    assert fiche["nom"] == brut["label"]
    assert fiche["largeur"] == brut["largeur"] and fiche["hauteur"] == brut["hauteur"]
    # Née d'une génération ordinaire, pas d'une demande de matière : aucun
    # cadrage à relire, une chaîne vide plutôt qu'une valeur inventée.
    assert fiche["cadrage"] == ""
    assert fiche["collections"] == []

    pleine = client.get(f"/api/projects/{projet}/materials")
    assert identifiant in [m["identifiant"] for m in pleine.json()["matieres"]]

    retire = client.put(
        f"/api/projects/{projet}/materials/{identifiant}", json={"matiere": False}
    )
    assert retire.status_code == 200, retire.text
    apres = client.get(f"/api/projects/{projet}/materials")
    assert identifiant not in [m["identifiant"] for m in apres.json()["matieres"]]


# ── Ce que la spécification refuse d'inventer : l'acceptation d'une recette ──


def test_asset_valide_accepte_une_image_quel_que_soit_le_marqueur(atelier, client):
    """**Le critère qui ne devait pas bouger.** `_asset_valide` décide de ce
    qui appartient au projet, jamais de ce qui est marqué matière — sinon un
    jeu de tuiles déjà composé sur une image non marquée casserait à la
    première relecture (`docs/RG5-la-bibliotheque-des-matieres.md` §3).
    """
    generation = _generer(client, "une image ordinaire")
    brut = _asset(client, generation)
    identifiant = brut["identifiant"]
    projet = brut["projet"]
    valide = atelier.tuiles._asset_valide(projet)

    # Non marquée : acceptée, comme avant RG5.
    assert valide(identifiant) is True

    # Marquée matière : toujours acceptée — le marqueur ne change rien ici.
    atelier.bibliotheque.declarer_matiere(identifiant, True)
    assert valide(identifiant) is True

    # Retirée : toujours acceptée, pour la même raison.
    atelier.bibliotheque.declarer_matiere(identifiant, False)
    assert valide(identifiant) is True


# ── Ce qu'une matière ne peut pas faire ───────────────────────────────────────


def test_refus_de_designer_une_matiere_comme_corps_dune_case(client):
    """`PUT /assets/{id}/character` refuse, phrase en clair, quand l'image
    porte `matiere=True` (RG5 §4) — une matière n'a pas de sujet."""
    generation = _generer(client, "une matière déclarée à la main")
    brut = _asset(client, generation)
    identifiant = brut["identifiant"]
    client.put(
        f"/api/projects/{brut['projet']}/materials/{identifiant}", json={"matiere": True}
    )

    reponse = client.put(f"/api/assets/{identifiant}/character", json={"personnage": "pelerin"})
    assert reponse.status_code == 409, reponse.text
    corps = reponse.json()
    assert corps["raison"] == (
        "Une matière n'a pas de sujet : c'est un ingrédient du jeu de tuiles, pas "
        "une chose du jeu. Pour la ranger, mets-la dans une collection ; pour en "
        "faire l'image d'un sujet, retire-lui d'abord la marque « matière » "
        "depuis sa fiche."
    )


def test_refus_de_creer_un_sujet_de_nature_matiere(client):
    """`POST /characters` refuse, phrase en clair, quand `type == "matière"`
    (RG5 §4) : le seul chemin pour une matière est de la générer ou de la
    déclarer, jamais de lui ouvrir une fiche de sujet."""
    reponse = client.post(
        "/api/characters", json={"nom": "Pierres du donjon", "type": "matière"}
    )
    assert reponse.status_code == 409, reponse.text
    assert reponse.json()["raison"] == (
        "On ne crée plus de sujet de nature « matière ». Une matière est une "
        "image de la bibliothèque du jeu : génère-la depuis l'écran des tuiles, "
        "ou déclare une image existante « matière » depuis sa fiche."
    )


def test_refus_de_regler_un_sujet_vers_la_nature_matiere(client):
    """`PUT /characters/{id}` refuse la même bascule pour un sujet déjà là :
    on ne peut pas non plus le faire glisser vers « matière » après coup."""
    cree = client.post("/api/characters", json={"nom": "Un décor", "type": "décor"})
    assert cree.status_code == 201, cree.text
    identifiant = cree.json()["personnage"]["identifiant"]

    reponse = client.put(f"/api/characters/{identifiant}", json={"type": "matière"})
    assert reponse.status_code == 409, reponse.text
    assert "On ne crée plus de sujet de nature « matière »" in reponse.json()["raison"]
