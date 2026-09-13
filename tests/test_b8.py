# -*- coding: utf-8 -*-
"""Les critères d'acceptation de B8.1, B8.2, B8.3, B8.4 et B8.5.

**Planches** : `docs/archive/pistes-2026-09-04/carnet/Famille.dc.html`,
`Vocabulaire.dc.html`.

B8 fait de la collection un vrai groupe : un **sujet** y appartient, il peut
appartenir à plusieurs collections à la fois, et l'y ranger ne le retire
d'aucune autre. B8.1 pose la forme dont les cinq morceaux suivants héritent —
`Collection.membres`, un membre étant le couple `(jeu, sujet)` —, sa lecture et
son écriture dans `collections.json`. B8.2 lui ajoute la table de jointure de
l'index, `collections_membres` : c'est par elle que B8.4 et B8.5 liront un
groupe, sans reparcourir le JSON de chaque collection. B8.3 fait entrer le
**sujet lui-même** dans l'index — une table `personnages`, raccourci jetable au
même titre qu'`assets` — accrochée aux deux seuls endroits qui en écrivent un :
`ServiceProduction._sauver` et `supprimer_personnage`.

**B8.4 branche les gestes sur ce qui précède, sans algorithme neuf.** Ranger un
sujet et l'en retirer sont deux routes qui appellent `Collection.avec` /
`Collection.sans`, déjà posées en B8.1, par `_sauver_collection`, déjà posée
elle aussi. Supprimer une collection perd sa boucle sur les images — il n'y en
a plus à détacher, `ON DELETE CASCADE` (B8.2) vide la table de jointure tout
seul. Et quatre chemins existants changent de sens plutôt que de mourir
(`docs/tranches/V4.md` § B8, « Ce que la première réponse emporte avec elle ») :
`ranger()` ne pose plus qu'un projet, le filtre `collection` de la grille
devient une jointure sur `assets.personnage`, `arbre()` compte des sujets sous
la clé `sujets` — plus des images sous `assets` —, et `Asset.collection`
disparaît pour de bon, colonne, index et condition de filtre compris.

Trois choses se vérifient pour B8.1, et la troisième est celle qui coûte :

- **le couple, jamais l'identifiant seul.** Deux jeux peuvent nommer leur sujet
  pareil ; un identifiant nu ferait entrer l'homonyme dans la collection ;
- **la relecture d'une fiche d'avant B8**, qui n'a pas de membres et n'en est
  pas moins valide — c'est le critère « les collections déjà écrites sur le
  disque se relisent sans perte », et il se tient par un chemin de lecture, pas
  par une conversion ;
- **le disque, refermé puis rouvert.** L'index est effacé et l'atelier remonté
  d'un dossier ; ce qui revient doit porter les mêmes adhésions, dans le même
  ordre. Point 8septies d'`AGENTS.md` : un objet qu'on sait écrire et qu'on ne
  sait pas relire n'est pas fini, et un essai qui se contente de la réponse du
  `POST` vérifie ce qu'il vient d'envoyer.

Pour B8.2, le même point 8septies s'applique à la table elle-même : elle doit
porter les bonnes lignes après une sauvegarde, après un second rangement sur la
même collection, après une suppression, et après un aller-retour disque complet
— pas seulement juste après le geste qui l'écrit.

Pour B8.3, le point 8septies se pose une troisième fois, sur le sujet lui-même :
créer un personnage l'écrit dans `personnages`, le supprimer l'en efface, et un
disque refermé puis rouvert retrouve les mêmes sujets — jamais en interrogeant
la réponse d'un geste qu'on vient de faire, toujours en lisant la table en SQL.

**B8.4 n'a pas de disque neuf à refermer** — les trois morceaux précédents ont
déjà prouvé que `_sauver_collection` et la table de jointure survivent à un
aller-retour. Ce qui reste à vérifier est que les routes appellent vraiment ce
qui existe déjà, que supprimer une collection ne touche plus à un seul sujet,
et que l'arbre et le filtre de la grille lisent la bonne moitié du mot
*collection* — celle des sujets, pas celle des images qui vient de partir.

**B8.5 rend la recherche en deux groupes**, précisée le 6 septembre 2026 :
les sujets d'un côté, par leur nom et leur description ; les images de
l'autre, par leur prompt, leur pose, leur direction et le **nom** de leur
sujet — jamais sa description, qui n'a de sens que pour le sujet lui-même.
La colonne `recherche` d'une image porte le prompt, la pose et la direction,
recalculée à chaque écriture comme les colonnes de B8.1 à B8.4 ; le nom du
sujet, lui, n'y est **jamais gravé** — il vit sur le `Personnage` et se lit
par une jointure à l'instant de la requête, pour qu'un sujet renommé change
aussitôt ce que ses images trouvent, sans qu'une seule image soit réécrite.

Aucun essai ne coûte un centime : rien ici n'appelle un fournisseur.
"""

from __future__ import annotations

import asyncio
import json

from test_t3 import _arbre, _asset, _bibliotheque, _generer

from atelier.domaine.projet import Collection, Membre, membres_depuis_json
from atelier.services import Atelier


# ── Le modèle ────────────────────────────────────────────────────────────────


def test_un_sujet_range_dans_deux_collections_reste_dans_les_deux():
    """Le critère de la tranche, au niveau du modèle.

    Ranger est un geste sur **la collection** : deux collections portent le
    même couple, et aucune des deux ne sait que l'autre existe. C'est ce qui
    rend l'appartenance multiple gratuite — il n'y a rien à synchroniser.
    """
    heros = Collection(identifiant="heros", nom="Héros").avec("marais", "pelerin")
    a_refaire = Collection(identifiant="a-refaire", nom="À refaire").avec(
        "marais", "pelerin"
    )

    assert heros.contient("marais", "pelerin")
    assert a_refaire.contient("marais", "pelerin")
    assert heros.sujets_du_jeu("marais") == ("pelerin",)


def test_ranger_deux_fois_le_meme_sujet_ne_fait_pas_deux_membres():
    """Un glisser-déposer répété est un geste sans effet, pas une erreur —
    sinon la grille de B9 montrerait deux fois le même sujet dans un groupe."""
    heros = Collection(identifiant="heros", nom="Héros").avec("marais", "pelerin")
    encore = heros.avec("marais", "pelerin")

    assert encore.membres == (Membre(jeu="marais", sujet="pelerin"),)


def test_le_membre_est_un_couple_et_l_homonyme_d_un_autre_jeu_n_entre_pas():
    """**Le piège de la tranche.** Les identifiants de sujet sont uniques *par
    jeu* : `pelerin` peut exister dans deux univers. Une collection sans jeu —
    « à refaire », « pour la démo » — en traverse plusieurs, et un identifiant
    nu y ferait entrer l'homonyme au premier rangement.
    """
    partout = (
        Collection(identifiant="a-refaire", nom="À refaire")
        .avec("marais", "pelerin")
        .avec("salines", "pelerin")
    )

    assert partout.contient("marais", "pelerin")
    assert partout.contient("salines", "pelerin")
    assert partout.sujets_du_jeu("marais") == ("pelerin",)
    assert partout.sujets_du_jeu("salines") == ("pelerin",)
    assert len(partout.membres) == 2

    # Retirer celui d'un jeu laisse celui de l'autre exactement où il est.
    reste = partout.sans("marais", "pelerin")
    assert not reste.contient("marais", "pelerin")
    assert reste.contient("salines", "pelerin")


def test_une_collection_d_un_jeu_accueille_le_sujet_d_un_autre():
    """**Tranché par l'auteur le 6 septembre 2026** : ranger n'est jamais
    refusé, et un groupe peut devenir mixte.

    C'est l'inverse de ce que le `projet` d'une collection fait aux **images**,
    dont il décide — mais ranger un sujet ne le déplace pas d'univers, il n'y a
    donc rien à trancher. Ce que la souplesse coûte est écrit juste en dessous :
    lire les membres sans dire de quel jeu on parle additionne deux univers, et
    `sujets_du_jeu` est le seul chemin qui ne le fasse pas.
    """
    armes = (
        Collection(identifiant="armes", nom="Armes", projet="marais")
        .avec("marais", "faux")
        .avec("salines", "rateau")
    )

    assert armes.contient("salines", "rateau")
    assert armes.sujets_du_jeu("marais") == ("faux",)
    assert armes.sujets_du_jeu("salines") == ("rateau",)
    assert len(armes.membres) == 2


def test_retirer_un_sujet_ne_touche_ni_le_jeu_ni_les_autres_membres():
    """« Retirer une collection ne perd aucun sujet » commence ici : l'adhésion
    est le seul objet qui bouge, et l'ordre des autres ne change pas."""
    boss = (
        Collection(identifiant="boss", nom="Boss", projet="marais")
        .avec("marais", "pelerin")
        .avec("marais", "heron")
        .avec("marais", "moulin")
    )

    sans_heron = boss.sans("marais", "heron")

    assert sans_heron.sujets_du_jeu("marais") == ("pelerin", "moulin")
    assert sans_heron.projet == "marais"
    # Retirer ce qui n'y est pas ne lève rien et ne change rien.
    assert sans_heron.sans("marais", "heron").membres == sans_heron.membres


# ── La fiche, écrite et relue ────────────────────────────────────────────────


def test_une_collection_ecrite_avant_b8_se_relit_sans_perte():
    """Le critère « les collections déjà écrites sur le disque se relisent sans
    perte ». Sur le disque de l'auteur au 6 septembre 2026 il y en avait une,
    `tatata`, et elle ne contenait rien : il n'y a **rien à migrer**, et une
    fiche sans clé `membres` rend simplement un groupe vide.
    """
    ancienne = {
        "identifiant": "tatata",
        "nom": "tatata",
        "projet": None,
        "cree_le": 1757000000.0,
    }

    relue = Collection.depuis_json(ancienne)

    assert relue.identifiant == "tatata"
    assert relue.nom == "tatata"
    assert relue.cree_le == 1757000000.0
    assert relue.membres == ()


def test_la_fiche_porte_ses_membres_dans_l_ordre_ou_ils_ont_ete_ranges():
    ecrite = (
        Collection(identifiant="heros", nom="Héros", cree_le=12.0)
        .avec("marais", "pelerin")
        .avec("salines", "saunier")
    )

    fiche = json.loads(json.dumps(ecrite.en_json(), ensure_ascii=False))
    relue = Collection.depuis_json(fiche)

    assert fiche["membres"] == [
        {"jeu": "marais", "sujet": "pelerin"},
        {"jeu": "salines", "sujet": "saunier"},
    ]
    assert relue == ecrite


def test_un_membre_illisible_est_ecarte_sans_emporter_la_collection():
    """Un membre qu'on ne sait pas lire ne doit pas faire disparaître le groupe
    entier : `donnees/` s'ouvre à la main, et une virgule de trop dans un
    fichier ne se paie pas d'une collection perdue."""
    membres = membres_depuis_json(
        [
            {"jeu": "marais", "sujet": "pelerin"},
            {"jeu": "marais"},  # pas de sujet
            {"sujet": "heron"},  # pas de jeu
            {"jeu": "", "sujet": "heron"},  # jeu vide
            "pelerin",  # un identifiant nu, justement
            {"jeu": "marais", "sujet": "pelerin"},  # déjà là
        ]
    )

    assert membres == (Membre(jeu="marais", sujet="pelerin"),)
    assert membres_depuis_json(None) == ()
    assert membres_depuis_json("pelerin") == ()


# ── Le disque, refermé puis rouvert ──────────────────────────────────────────


def test_les_adhesions_reviennent_quand_l_index_est_efface(
    client, atelier, tmp_path, double
):
    """**L'essai qui coûte** — celui qui referme et rouvre (point 8septies).

    On ne vérifie pas la réponse du `POST` : on efface l'index, on remonte un
    atelier sur le même dossier, et on regarde ce que `donnees/` a su rendre.
    Les adhésions posées ne sont pas celles du défaut — une collection sans
    jeu qui en traverse deux —, sans quoi la relecture passerait par accident.
    """
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les Salines"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    saunier = client.post(
        "/api/characters", json={"nom": "Saunier", "projet": salines["identifiant"]}
    ).json()["personnage"]

    a_refaire = client.post("/api/collections", json={"nom": "À refaire"}).json()[
        "collection"
    ]

    # Les gestes sont B8.4 ; ce qui existe en B8.1 est le point de passage
    # unique par lequel ils écriront tous.
    bibliotheque = atelier.bibliotheque
    groupe = bibliotheque._base.lire_collection(a_refaire["identifiant"])
    bibliotheque._sauver_collection(
        groupe.avec(marais["identifiant"], pelerin["identifiant"]).avec(
            salines["identifiant"], saunier["identifiant"]
        )
    )

    # Le fichier fait foi, et il porte bien les deux couples.
    ecrit = json.loads((tmp_path / "collections.json").read_text(encoding="utf-8"))
    assert ecrit[a_refaire["identifiant"]]["membres"] == [
        {"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
        {"jeu": salines["identifiant"], "sujet": saunier["identifiant"]},
    ]

    # L'index disparaît — effacé à la main, ou perdu avec un disque.
    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    revenue = next(
        c
        for c in refait.bibliotheque.collections()
        if c.identifiant == a_refaire["identifiant"]
    )
    assert revenue.membres == (
        Membre(jeu=marais["identifiant"], sujet=pelerin["identifiant"]),
        Membre(jeu=salines["identifiant"], sujet=saunier["identifiant"]),
    )
    assert revenue.sujets_du_jeu(marais["identifiant"]) == (
        pelerin["identifiant"],
    )


# ── B8.2 — la table de jointure ──────────────────────────────────────────────


def _lignes_de_jointure(base, identifiant: str) -> list[tuple[str, str]]:
    """Ce que l'index sait d'une collection, lu directement en SQL — le même
    geste que l'essai de B8.1 lisant `collections.json` sur le disque : on
    n'interroge jamais la réponse d'un geste, on va voir ce qui a été gardé."""
    with base._connexion() as connexion:
        lignes = connexion.execute(
            "SELECT jeu, sujet FROM collections_membres WHERE collection = ? "
            "ORDER BY jeu, sujet",
            (identifiant,),
        ).fetchall()
    return [(ligne["jeu"], ligne["sujet"]) for ligne in lignes]


def test_sauver_une_collection_ecrit_sa_table_de_jointure(client, atelier):
    """`_sauver_collection` — le seul endroit qui écrit une collection —
    remplit `collections_membres` du même geste que `collections.json` : rien
    n'appelle la table à part, donc rien ne peut écrire l'une sans l'autre."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    a_refaire = client.post("/api/collections", json={"nom": "À refaire"}).json()[
        "collection"
    ]

    bibliotheque = atelier.bibliotheque
    groupe = bibliotheque._base.lire_collection(a_refaire["identifiant"])
    bibliotheque._sauver_collection(
        groupe.avec(marais["identifiant"], pelerin["identifiant"])
    )

    assert _lignes_de_jointure(bibliotheque._base, a_refaire["identifiant"]) == [
        (marais["identifiant"], pelerin["identifiant"]),
    ]


def test_reranger_remplace_la_table_au_lieu_de_l_accumuler(client, atelier):
    """La table se réécrit en entier à chaque sauvegarde (comme `contenu`) : un
    membre retiré puis regardé ne doit laisser aucune ligne fantôme, sans quoi
    la table finirait par dire autre chose que la fiche."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    heron = client.post(
        "/api/characters", json={"nom": "Héron", "projet": marais["identifiant"]}
    ).json()["personnage"]
    boss = client.post("/api/collections", json={"nom": "Boss"}).json()["collection"]

    bibliotheque = atelier.bibliotheque
    groupe = bibliotheque._base.lire_collection(boss["identifiant"])
    groupe = groupe.avec(marais["identifiant"], pelerin["identifiant"]).avec(
        marais["identifiant"], heron["identifiant"]
    )
    bibliotheque._sauver_collection(groupe)
    bibliotheque._sauver_collection(
        groupe.sans(marais["identifiant"], heron["identifiant"])
    )

    assert _lignes_de_jointure(bibliotheque._base, boss["identifiant"]) == [
        (marais["identifiant"], pelerin["identifiant"]),
    ]


def test_supprimer_une_collection_efface_ses_lignes_de_jointure(client, atelier):
    """Retirer une collection ne doit pas laisser ses adhésions vivre seules
    dans l'index — `ON DELETE CASCADE` fait le geste sans qu'un appelant ait à
    y penser, exactement comme un sujet supprimé ne laisse pas de calque
    orphelin ailleurs dans le dépôt."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    boss = client.post("/api/collections", json={"nom": "Boss"}).json()["collection"]

    bibliotheque = atelier.bibliotheque
    groupe = bibliotheque._base.lire_collection(boss["identifiant"])
    bibliotheque._sauver_collection(
        groupe.avec(marais["identifiant"], pelerin["identifiant"])
    )
    bibliotheque._base.oublier_collection(boss["identifiant"])

    assert _lignes_de_jointure(bibliotheque._base, boss["identifiant"]) == []


def test_la_table_de_jointure_revient_quand_l_index_est_efface(
    client, atelier, tmp_path, double
):
    """**L'essai qui coûte**, jumeau de celui de B8.1 mais posé sur l'index.

    `VERSION` passe de 6 à 7 avec B8.2 : sur un dépôt où l'index existe déjà
    dans l'ancien schéma, c'est ce qui fait que `collections_membres`
    apparaît au prochain démarrage au lieu de manquer silencieusement. Ici on
    va plus loin — l'index est effacé du disque, pas seulement jeté par sa
    version —, et la table doit porter les mêmes adhésions que la fiche après
    la reconstruction complète.
    """
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les Salines"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    saunier = client.post(
        "/api/characters", json={"nom": "Saunier", "projet": salines["identifiant"]}
    ).json()["personnage"]
    a_refaire = client.post("/api/collections", json={"nom": "À refaire"}).json()[
        "collection"
    ]

    bibliotheque = atelier.bibliotheque
    groupe = bibliotheque._base.lire_collection(a_refaire["identifiant"])
    bibliotheque._sauver_collection(
        groupe.avec(marais["identifiant"], pelerin["identifiant"]).avec(
            salines["identifiant"], saunier["identifiant"]
        )
    )

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    assert _lignes_de_jointure(refait.bibliotheque._base, a_refaire["identifiant"]) == [
        (marais["identifiant"], pelerin["identifiant"]),
        (salines["identifiant"], saunier["identifiant"]),
    ]


# ── B8.3 — les sujets entrent dans l'index ──────────────────────────────────


def _ligne_personnage(base, projet: str, identifiant: str) -> tuple[str, str] | None:
    """Ce que l'index sait d'un sujet, lu directement en SQL — même geste que
    `_lignes_de_jointure` : on n'interroge jamais la réponse d'un geste, on va
    voir ce que la table a gardé."""
    with base._connexion() as connexion:
        ligne = connexion.execute(
            "SELECT projet, nom FROM personnages WHERE projet = ? AND identifiant = ?",
            (projet, identifiant),
        ).fetchone()
    return (ligne["projet"], ligne["nom"]) if ligne is not None else None


def test_creer_un_personnage_l_ecrit_dans_l_index(client, atelier):
    """`_sauver` — le seul endroit qui écrit un personnage — remplit la table
    `personnages` du même geste que le fichier : rien n'appelle la table à
    part, donc rien ne peut écrire l'un sans l'autre."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]

    assert _ligne_personnage(
        atelier.base, marais["identifiant"], pelerin["identifiant"]
    ) == (marais["identifiant"], "Pèlerin")


def test_regler_un_personnage_met_a_jour_sa_ligne(client, atelier):
    """Renommer repasse par `_sauver` : la ligne d'index doit suivre, sans quoi
    une recherche future (`B8.5`) trouverait un nom que le fichier a déjà
    quitté."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]

    client.put(
        f"/api/characters/{pelerin['identifiant']}",
        json={"projet": marais["identifiant"], "nom": "Le Pèlerin gris"},
    )

    assert _ligne_personnage(
        atelier.base, marais["identifiant"], pelerin["identifiant"]
    ) == (marais["identifiant"], "Le Pèlerin gris")


def test_supprimer_un_personnage_efface_sa_ligne_d_index(client, atelier):
    """`supprimer_personnage` — le seul endroit qui efface un personnage —
    retire sa ligne : jamais de sujet fantôme dans l'index une fois le fichier
    parti, symétrique du crochet d'écriture."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]

    client.delete(
        f"/api/characters/{pelerin['identifiant']}",
        params={"projet": marais["identifiant"]},
    )

    assert (
        _ligne_personnage(atelier.base, marais["identifiant"], pelerin["identifiant"])
        is None
    )


def test_les_sujets_reviennent_quand_l_index_est_efface(client, atelier, tmp_path, double):
    """**L'essai qui coûte**, jumeau de celui de B8.1 et de B8.2, posé cette
    fois sur le sujet lui-même.

    On ne vérifie pas la réponse du `POST` : l'index est effacé du disque, un
    atelier neuf remonté sur le même dossier, et ce que `personnages` contient
    alors est lu en SQL directement. Deux jeux, pour vérifier que la clé est
    bien le couple `(projet, identifiant)` et non l'identifiant seul.
    """
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les Salines"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    saunier = client.post(
        "/api/characters", json={"nom": "Saunier", "projet": salines["identifiant"]}
    ).json()["personnage"]

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    assert _ligne_personnage(
        refait.base, marais["identifiant"], pelerin["identifiant"]
    ) == (marais["identifiant"], "Pèlerin")
    assert _ligne_personnage(
        refait.base, salines["identifiant"], saunier["identifiant"]
    ) == (salines["identifiant"], "Saunier")


def test_un_personnage_efface_ne_revient_pas_a_la_reconstruction(
    client, atelier, tmp_path, double
):
    """Le fichier fait foi : un sujet supprimé avant la reconstruction ne doit
    pas ressusciter parce que sa ligne aurait survécu dans un coin de l'index."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    client.delete(
        f"/api/characters/{pelerin['identifiant']}",
        params={"projet": marais["identifiant"]},
    )

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    assert (
        _ligne_personnage(refait.base, marais["identifiant"], pelerin["identifiant"])
        is None
    )


# ── B8.4 — les gestes : ranger un sujet, l'en retirer, supprimer une
#     collection, et l'arbre qui compte des sujets ──────────────────────────


def test_ranger_un_sujet_par_lapi_et_le_retirer(client):
    """Le geste que B8.4 ajoute : la **route**, pas seulement le modèle de
    B8.1. Elle ne fait qu'appeler `Collection.avec` / `Collection.sans` par
    `_sauver_collection` — déjà posés, déjà éprouvés —, donc ce qui reste à
    vérifier ici est le branchement, pas le comportement.

    Ranger deux fois de suite ne fait pas deux membres, comme au niveau
    domaine plus haut ; retirer un sujet qui n'y est déjà plus ne lève rien,
    parce que `sans` ne juge jamais.
    """
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    heros = client.post("/api/collections", json={"nom": "Héros"}).json()["collection"]

    range_ = client.put(
        f"/api/collections/{heros['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
    )
    assert range_.status_code == 200, range_.text
    assert range_.json()["collection"]["membres"] == [
        {"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]}
    ]

    encore = client.put(
        f"/api/collections/{heros['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
    )
    assert encore.status_code == 200, encore.text
    assert len(encore.json()["collection"]["membres"]) == 1

    retire = client.delete(
        f"/api/collections/{heros['identifiant']}/members/"
        f"{marais['identifiant']}/{pelerin['identifiant']}"
    )
    assert retire.status_code == 200, retire.text
    assert retire.json()["collection"]["membres"] == []

    reencore = client.delete(
        f"/api/collections/{heros['identifiant']}/members/"
        f"{marais['identifiant']}/{pelerin['identifiant']}"
    )
    assert reencore.status_code == 200, reencore.text
    assert reencore.json()["collection"]["membres"] == []


def test_ranger_dans_une_collection_inconnue_nomme_laquelle(client):
    """Même règle que partout ailleurs dans ce fichier (`ProjetInconnu`,
    `CollectionInconnue`) : un refus **nomme** ce qui manque, jamais un 404
    muet."""
    reponse = client.put(
        "/api/collections/n-existe-pas/members",
        json={"jeu": "quelque-part", "sujet": "quelqu-un"},
    )
    assert reponse.status_code == 404, reponse.text
    assert "n-existe-pas" in reponse.json()["raison"]

    reponse = client.delete(
        "/api/collections/n-existe-pas/members/quelque-part/quelqu-un"
    )
    assert reponse.status_code == 404, reponse.text
    assert "n-existe-pas" in reponse.json()["raison"]


def test_supprimer_une_collection_ne_touche_a_aucun_sujet(client, atelier):
    """Le critère de `docs/PLAN-carnet.md` § B8 : retirer une collection ne
    perd aucun sujet. Depuis B8.4 elle n'a même plus rien à leur faire — la
    boucle qui détachait chaque image de sa collection a disparu avec
    `Asset.collection` : aucun fichier de sujet n'est seulement rouvert, et la
    table de jointure se vide d'elle-même par `ON DELETE CASCADE` (B8.2)."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    boss = client.post("/api/collections", json={"nom": "Boss"}).json()["collection"]
    client.put(
        f"/api/collections/{boss['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
    )

    suppression = client.delete(f"/api/collections/{boss['identifiant']}")
    assert suppression.status_code == 200, suppression.text
    assert suppression.json()["collection"] == boss["identifiant"]
    assert suppression.json()["sujets"] == 1

    # Le sujet n'a pas bougé : toujours dans l'index, comme sur le disque.
    assert _ligne_personnage(
        atelier.base, marais["identifiant"], pelerin["identifiant"]
    ) == (marais["identifiant"], "Pèlerin")
    assert _lignes_de_jointure(atelier.base, boss["identifiant"]) == []
    assert boss["identifiant"] not in [
        c["identifiant"] for c in _arbre(client)["collections"]
    ]


def test_arbre_compte_les_sujets_dune_collection_pas_les_images(client):
    """`compter_par_collection` lit désormais `collections_membres`, jamais
    `assets` (B8.4) : le compte d'une collection dans l'arbre bouge quand un
    sujet de plus y entre, jamais quand une image de plus arrive — y compris
    une image de l'un de ses sujets."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    heron = client.post(
        "/api/characters", json={"nom": "Héron", "projet": marais["identifiant"]}
    ).json()["personnage"]
    groupe = client.post("/api/collections", json={"nom": "Groupe"}).json()[
        "collection"
    ]

    def _sujets_du_groupe() -> int:
        return next(
            c
            for c in _arbre(client)["collections"]
            if c["identifiant"] == groupe["identifiant"]
        )["sujets"]

    client.put(
        f"/api/collections/{groupe['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
    )
    client.put(
        f"/api/collections/{groupe['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": heron["identifiant"]},
    )
    assert _sujets_du_groupe() == 2

    generation = _generer(client, prompt="un pèlerin", projet=marais["identifiant"])
    designe = client.put(
        f"/api/assets/{generation['identifiant']}-0/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )
    assert designe.status_code == 200, designe.text

    assert _sujets_du_groupe() == 2


def test_le_filtre_collection_de_la_grille_rend_les_images_des_sujets_du_groupe(
    client,
):
    """« Une collection ne range que des sujets. Le filtre `collection` de la
    galerie devient *les images des sujets de cette collection* »
    (`docs/PLAN-carnet.md` § B8). Une image du sujet rangé apparaît ; une image
    d'un sujet du même jeu qui n'y est pas ne paraît pas."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]
    heron = client.post(
        "/api/characters", json={"nom": "Héron", "projet": marais["identifiant"]}
    ).json()["personnage"]
    groupe = client.post("/api/collections", json={"nom": "Groupe"}).json()[
        "collection"
    ]
    client.put(
        f"/api/collections/{groupe['identifiant']}/members",
        json={"jeu": marais["identifiant"], "sujet": pelerin["identifiant"]},
    )

    de_pelerin = _asset(client, _generer(client, projet=marais["identifiant"]))
    client.put(
        f"/api/assets/{de_pelerin['identifiant']}/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )
    de_heron = _asset(
        client, _generer(client, prompt="un héron", projet=marais["identifiant"])
    )
    client.put(
        f"/api/assets/{de_heron['identifiant']}/character",
        json={
            "personnage": heron["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )

    trouves = _bibliotheque(client, collection=groupe["identifiant"])

    assert [a["identifiant"] for a in trouves] == [de_pelerin["identifiant"]]


# ── B8.5 — la recherche en deux groupes ─────────────────────────────────────


def test_chercher_un_sujet_par_son_nom_et_par_sa_description(client):
    """Le premier groupe du critère : un sujet se trouve par son nom **et**
    par sa description, accents dépliés des deux côtés (`normaliser`)."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    client.post(
        "/api/characters",
        json={
            "nom": "Pèlerin",
            "description": "un vieux moine qui erre dans les marais",
            "projet": marais["identifiant"],
        },
    )
    client.post(
        "/api/characters",
        json={
            "nom": "Héron",
            "description": "un oiseau gris",
            "projet": marais["identifiant"],
        },
    )

    def _noms(recherche: str) -> list[str]:
        reponse = client.get(
            "/api/characters/search",
            params={"projet": marais["identifiant"], "recherche": recherche},
        )
        assert reponse.status_code == 200, reponse.text
        return [p["nom"] for p in reponse.json()["personnages"]]

    # Par le nom, sans l'accent que l'auteur n'a pas forcément tapé.
    assert _noms("pelerin") == ["Pèlerin"]
    # Par la description, jamais tapée dans le nom.
    assert _noms("moine") == ["Pèlerin"]
    assert _noms("oiseau") == ["Héron"]
    # Sans terme, les deux reviennent, dans l'ordre de création.
    assert _noms("") == ["Pèlerin", "Héron"]
    # Un mot qui n'est nulle part ne rend personne.
    assert _noms("dragon") == []


def test_la_recherche_de_sujets_ne_sort_pas_du_projet(client):
    """Deux jeux peuvent nommer leur sujet pareil (`docs/tranches/V4.md` § B8) :
    chercher dans l'un ne doit jamais faire paraître celui de l'autre."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    salines = client.post("/api/projects", json={"nom": "Les Salines"}).json()["projet"]
    client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    )
    client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": salines["identifiant"]}
    )

    trouves = client.get(
        "/api/characters/search",
        params={"projet": marais["identifiant"], "recherche": "pelerin"},
    ).json()["personnages"]

    assert len(trouves) == 1
    assert trouves[0]["projet"] == marais["identifiant"]


def test_chercher_une_image_par_son_prompt_sa_pose_et_sa_direction(client):
    """Le second groupe : une image se trouve par les trois champs qu'elle
    porte elle-même — le prompt (`label`), la pose, la direction."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    client.post(
        "/api/characters/directions",
        json={"nom": "Nord", "projet": marais["identifiant"]},
    )
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]

    de_pelerin = _asset(
        client,
        _generer(
            client, prompt="un pelerin sous la pluie", projet=marais["identifiant"]
        ),
    )
    client.put(
        f"/api/assets/{de_pelerin['identifiant']}/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "direction": "nord",
            "projet": marais["identifiant"],
        },
    )

    def _trouve(recherche: str) -> bool:
        trouves = _bibliotheque(client, tous=True, recherche=recherche)
        return de_pelerin["identifiant"] in [a["identifiant"] for a in trouves]

    assert _trouve("pluie")  # le prompt
    assert _trouve("repos")  # la pose
    assert _trouve("nord")  # la direction
    assert not _trouve("dragon")


def test_chercher_une_image_par_le_nom_de_son_sujet_mais_pas_sa_description(client):
    """La moitié qui distingue les deux groupes : une image répond au **nom**
    de son sujet, jamais à sa description — celle-ci n'appartient qu'au
    sujet, et la confondre ferait remonter une image sur un mot que personne
    n'a tapé pour la chercher, elle."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters",
        json={
            "nom": "Pèlerin",
            "description": "un vieux moine qui erre dans les marais",
            "projet": marais["identifiant"],
        },
    ).json()["personnage"]

    de_pelerin = _asset(client, _generer(client, projet=marais["identifiant"]))
    client.put(
        f"/api/assets/{de_pelerin['identifiant']}/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )

    def _trouve(recherche: str) -> bool:
        trouves = _bibliotheque(client, tous=True, recherche=recherche)
        return de_pelerin["identifiant"] in [a["identifiant"] for a in trouves]

    assert _trouve("pelerin")  # le nom du sujet
    assert not _trouve("moine")  # sa description : c'est l'affaire du sujet


def test_renommer_un_sujet_change_aussitot_ce_que_ses_images_trouvent(client):
    """**La raison d'être de la jointure plutôt que d'une colonne gravée** :
    un sujet renommé rend aussitôt ses images trouvables sous son nom neuf, et
    introuvables sous l'ancien — sans qu'une seule image ait été réécrite."""
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters", json={"nom": "Pèlerin", "projet": marais["identifiant"]}
    ).json()["personnage"]

    de_pelerin = _asset(client, _generer(client, projet=marais["identifiant"]))
    client.put(
        f"/api/assets/{de_pelerin['identifiant']}/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )

    def _trouve(recherche: str) -> bool:
        trouves = _bibliotheque(client, tous=True, recherche=recherche)
        return de_pelerin["identifiant"] in [a["identifiant"] for a in trouves]

    assert _trouve("pelerin")
    assert not _trouve("gris")

    client.put(
        f"/api/characters/{pelerin['identifiant']}",
        json={"projet": marais["identifiant"], "nom": "Le Pèlerin gris"},
    )

    assert _trouve("gris")
    assert _trouve("pelerin")


# ── L'essai qui coûte : le disque, refermé puis rouvert (point 8septies) ────


def test_la_recherche_survit_a_la_reconstruction_de_l_index(
    client, atelier, tmp_path, double
):
    """Point 8septies d'`AGENTS.md`, posé cette fois sur les colonnes de
    recherche elles-mêmes plutôt que sur les lignes qui les portent : l'index
    est effacé du disque, un atelier neuf remonté sur le même dossier, et la
    recherche doit retrouver ce qu'elle trouvait avant — jamais en
    interrogeant la réponse d'un geste qu'on vient de faire.
    """
    marais = client.post("/api/projects", json={"nom": "Le Marais"}).json()["projet"]
    pelerin = client.post(
        "/api/characters",
        json={
            "nom": "Pèlerin",
            "description": "un vieux moine",
            "projet": marais["identifiant"],
        },
    ).json()["personnage"]
    de_pelerin = _asset(client, _generer(client, projet=marais["identifiant"]))
    client.put(
        f"/api/assets/{de_pelerin['identifiant']}/character",
        json={
            "personnage": pelerin["identifiant"],
            "pose": "repos",
            "projet": marais["identifiant"],
        },
    )

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    sujets = refait.production.rechercher_personnages(marais["identifiant"], "moine")
    assert [p.identifiant for p in sujets] == [pelerin["identifiant"]]

    images = refait.bibliotheque.chercher(recherche="pelerin")
    assert [a.identifiant for a in images] == [de_pelerin["identifiant"]]
