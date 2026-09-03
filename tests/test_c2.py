# -*- coding: utf-8 -*-
"""Les critères d'acceptation de C2 — le lot plié.

Un test par critère de `docs/archive/plan-versions-tenues.md` § C2, nommé d'après lui.

**Aucun test de ce fichier ne coûte un centime**, et deux d'entre eux le
prouvent plutôt que de l'affirmer, en comptant les appels du double. C'est aussi
la mesure qui tient le critère principal de la tranche : *neuf poses donnent neuf
images après **un seul** appel payant*. Un test qui regarderait le nombre
d'assets sans compter les appels ne prouverait rien de ce que la tranche promet.

Le double rend une **vraie planche** — fond plat, N sujets séparables, chacun sa
silhouette —, qui traverse la même chaîne que les vingt-quatre planches réelles
du 28 août : détourage par remplissage depuis le bord, puis zones connexes. Un
double écrit d'après l'intention prouve l'intention, pas le serveur
(`docs/PIEGES.md`, payé en C1).
"""

from __future__ import annotations

import time

from conftest import planche_sujets

MODELE = "essai:rend-du-png"
SANS_REFERENCE = "essai:rend-du-jpeg"


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _creer(client, nom: str = "Le nain", description: str = "un nain forgeron") -> dict:
    reponse = client.post(
        "/api/characters", json={"nom": nom, "description": description}
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _tableau(client) -> dict:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _plan(client) -> list[dict]:
    return _tableau(client)["plan"]


def _cases(client, personnage: str) -> list[dict]:
    un = next(
        p for p in _tableau(client)["personnages"] if p["identifiant"] == personnage
    )
    return un["cases"]


def _ajouter_pose(client, nom: str) -> dict:
    reponse = client.post("/api/characters/poses", json={"nom": nom, "images": 1})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["pose"]


def _neuf_poses(client) -> list[str]:
    """Le plan par défaut compte cinq attitudes ; on le monte à neuf.

    Neuf parce que c'est le compte du critère, et parce que c'est la taille que
    l'essai du 28 août a mesurée — 3 × 3, la plus grande des deux.
    """
    manquantes = ("saut", "grimpe", "chute", "victoire", "traîne", "vole")
    for nom in manquantes:
        if len(_plan(client)) >= 9:
            break
        _ajouter_pose(client, nom)
    plan = _plan(client)
    assert len(plan) == 9, f"le plan par défaut a changé de taille : {len(plan)}"
    return [p["identifiant"] for p in plan]


def _lancer(client, personnage: str, poses: list[str], *, modele: str = MODELE, **corps):
    """Un lot, lancé par **la route de génération** — la même que tout le reste.

    Il n'existe qu'un seul endroit d'où l'on paie dans tout le produit : une
    seconde route pour les lots en aurait fait deux, et l'invariant de C1 serait
    tombé le jour où elle serait apparue.
    """
    reponse = client.post(
        "/api/generations",
        json={
            "modele": modele,
            "prompt": "un nain forgeron",
            "personnage": personnage,
            "poses": poses,
            **corps,
        },
    )
    return reponse


def _attendre(client, identifiant: str) -> dict:
    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"le lot « {identifiant} » n'est jamais arrivé à terme")


def _lot(client, personnage: str, poses: list[str], **corps) -> dict:
    reponse = _lancer(client, personnage, poses, **corps)
    assert reponse.status_code == 202, reponse.text
    return _attendre(client, reponse.json()["identifiant"])


def _grille(client) -> list[dict]:
    return client.get("/api/assets", params={"limite": 200}).json()["assets"]


# ── « Neuf poses sélectionnées et lancées ensemble donnent neuf images de corps
#     distinctes après **un seul** appel payant, et le journal du projet montre
#     un appel et non neuf » (US-128) ──────────────────────────────────────────


def test_neuf_poses_un_seul_appel_neuf_corps(client, double):
    """Le critère principal de la tranche, et il se mesure sur **le compte
    d'appels du double** — pas sur le nombre d'assets, qui serait vrai aussi
    avec neuf appels."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    poses = _neuf_poses(client)

    avant = double.appels
    lot = _lot(client, personnage["identifiant"], poses)

    assert double.appels - avant == 1, "un lot de neuf doit coûter un appel"
    assert lot["statut"] == "reussie"

    cases = _cases(client, personnage["identifiant"])
    assert len(cases) == 9
    assert all(len(c["images"]) == 1 for c in cases), "chaque case a son corps"
    # Neuf images **distinctes** : neuf identifiants, neuf fichiers bruts.
    images = [c["images"][0] for c in cases]
    assert len({i["identifiant"] for i in images}) == 9
    assert len({i["brut"] for i in images}) == 9


def test_le_journal_du_projet_montre_un_appel_et_non_neuf(client, double):
    """Le journal est fait de générations, et un lot en est **une**. Le coût
    total du projet est donc celui d'un appel, pas de neuf."""
    double.rendre = lambda: planche_sujets(9)
    personnage = _creer(client)
    _lot(client, personnage["identifiant"], _neuf_poses(client))

    recentes = client.get("/api/generations").json()["generations"]
    payantes = [g for g in recentes if g["modele"] != "import"]
    assert len(payantes) == 1
    assert payantes[0]["cout_usd"] == 0.0245


def test_chaque_corps_dit_sa_case_et_son_lot(client, double):
    """Une image dépliée tombe dans sa case **sans que personne l'y range** —
    c'est le pliage qui connaît la case, et lui seul."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    _lot(client, personnage["identifiant"], poses)

    for pose, case in zip(poses, _cases(client, personnage["identifiant"])[:4]):
        assert case["pose"] == pose
        image = case["images"][0]
        assert image["personnage"] == personnage["identifiant"]
        assert image["pose"] == pose
        assert image["lot"]["cases"] == 4


# ── « La planche reçue est dépliée automatiquement ; aucun geste de découpe
#     n'est demandé à l'auteur » (US-130) ─────────────────────────────────────


def test_la_planche_se_deplie_sans_qu_on_le_demande(client, double):
    """Rien à cliquer entre l'arrivée et les images : le lot se termine
    « réussie » avec ses corps déjà en bibliothèque."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    assert lot["statut"] == "reussie"
    nes = [a for a in _grille(client) if a["generation"] == lot["identifiant"]]
    # Quatre corps, plus la planche elle-même depuis G16. Le compte des *corps*
    # est ce que cet essai garde : c'est lui qui dit qu'aucun geste n'a été
    # demandé, et il ne bouge pas d'un cran.
    assert len([a for a in nes if a["rang"] >= 100]) == 4


def test_la_planche_entre_en_bibliotheque_sans_se_confondre_avec_ses_morceaux(
    client, double
):
    """**Ce qui a été payé cesse d'être invisible** (G16).

    L'invariant de C2 — *le pliage est une ruse d'appel, jamais un format de
    livraison* — est renversé : la feuille entre en bibliothèque et s'y regarde.
    Le plan le prévoyait pour `P1` ; `G16` en prend la première moitié — voir —
    et laisse la seconde — redécouper.

    **Ce que l'essai tient, c'est qu'elle ne se fait pas passer pour un
    sprite** : recette vide, aucune pose, et le coût de l'appel sur elle plutôt
    que sur ses morceaux."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    nes = [a for a in _grille(client) if a["generation"] == lot["identifiant"]]
    # L'emplacement occupe le rang 0 ; les images dépliées vivent à 100 et
    # au-dessus, comme les découpes de T5 et pour la même raison.
    assert len([a for a in nes if a["rang"] >= 100]) == 4

    reponse = client.get(f"/api/assets/{lot['identifiant']}-0")
    assert reponse.status_code == 200, "la planche est une image de la bibliothèque"
    planche = reponse.json()
    assert planche["rang"] == 0
    # **Elle n'est pas un sprite** : aucune recette, donc ni grille, ni
    # réduction de couleurs, ni détourage du projet posés sur elle.
    assert not planche["traite"]
    # **Elle n'a pas de pose**, et c'est ce qui la tient hors de la matrice.
    assert planche["pose"] is None
    assert planche["label"].startswith("planche 4 cases")
    # **Le coût de l'appel est sur elle**, et sur aucun de ses morceaux.
    assert planche["consomme"] > 0
    assert all(a["consomme"] == 0 for a in nes if a["rang"] >= 100)
    # Et la matrice du personnage ne la voit pas : quatre cases pleines, une
    # image chacune.
    cases = _cases(client, personnage["identifiant"])[:4]
    assert all(len(c["images"]) == 1 for c in cases)


def test_les_corps_survivent_a_un_index_efface(client, double, tmp_path):
    """Les fichiers font foi. Une image dépliée est un asset entier, écrit à
    côté de ses octets — la reconstruction la retrouve, **et la planche avec**
    depuis G16 : c'est ce rattrapage-là qui fait apparaître les planches payées
    avant que le produit ne sache les montrer."""
    import asyncio

    from atelier.services import Atelier

    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double)
    asyncio.run(refait.ouvrir())

    nes = [a for a in refait.assets.recents() if a.generation == lot["identifiant"]]
    assert len([a for a in nes if a.rang >= 100]) == 4
    planche = refait.assets.lire(f"{lot['identifiant']}-0")
    assert planche is not None, "un index refait retrouve la planche"
    assert planche.recette.vide and planche.pose is None


# ── « Un lot qui revient avec huit images pour neuf demandées est refusé :
#     aucune image n'entre dans le plan, et le lot se relance d'un geste »
#     (US-131) ────────────────────────────────────────────────────────────────


def test_un_compte_faux_refuse_le_lot_entier(client, double):
    """Rien n'entre — pas huit images sur neuf, **aucune**. Et le refus porte
    les deux nombres, parce qu'une raison se répète à quelqu'un qui décide."""
    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    poses = _neuf_poses(client)
    lot = _lot(client, personnage["identifiant"], poses)

    assert lot["statut"] == "echouee"
    raison = lot["emplacements"][0]["raison"]
    assert "8 images pour 9 demandées" in raison

    assert all(c["images"] == [] for c in _cases(client, personnage["identifiant"]))
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []


def test_un_lot_refuse_garde_son_cout_au_journal(client, double):
    """L'appel a été facturé, et le journal du projet le dit (US-24). C'est
    exactement ce qu'on cherche à expliquer quand on regarde le total."""
    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    lot = _lot(client, personnage["identifiant"], _neuf_poses(client))
    assert lot["cout_usd"] == 0.0245


def test_un_lot_refuse_se_relance_d_un_geste(client, double):
    """La relance de T1, telle quelle : l'emplacement est échoué, donc il
    repart. Au prix plein — c'est ce que l'écran annonce avant de lancer."""
    double.rendre = lambda: planche_sujets(8)
    personnage = _creer(client)
    poses = _neuf_poses(client)
    lot = _lot(client, personnage["identifiant"], poses)
    assert lot["statut"] == "echouee"

    double.rendre = lambda: planche_sujets(9)
    avant = double.appels
    reponse = client.post(f"/api/generations/{lot['identifiant']}/slots/0/retry")
    assert reponse.status_code == 200, reponse.text
    repris = _attendre(client, lot["identifiant"])

    assert double.appels - avant == 1, "une relance, un appel — au prix plein"
    assert repris["statut"] == "reussie"
    assert all(len(c["images"]) == 1 for c in _cases(client, personnage["identifiant"]))


def test_un_lot_qui_revient_trop_plein_n_est_plus_refuse(client, double):
    """**Le critère de C2 s'est inversé le 3 septembre 2026** (R6, US-367).

    Il disait : *le refus est arithmétique, pas « moins que demandé » ; dix
    images pour neuf est aussi faux que huit, et c'est ce qui le rend tenable*.
    Tenable, il l'était ; **payé, il l'était aussi** — quatre planches sur treize
    du banc d'animation jetées pour un sujet de trop, trente-et-un pour cent des
    appels perdus sur un geste dont c'est le régime normal.

    Ce qui reste vrai de la règle est gardé ici, et c'est le plus important :
    **rien n'entre tant que personne n'a regardé**. Ce qui change est ce qu'on
    fait ensuite — un choix au lieu d'une relance. Le détail vit dans
    `tests/test_r6.py`."""
    double.rendre = lambda: planche_sujets(10)
    personnage = _creer(client)
    lot = _lot(client, personnage["identifiant"], _neuf_poses(client))

    assert lot["statut"] == "reussie", "la planche est payée, entière, et gardée"
    assert lot["emplacements"][0]["raison"] is None, "un choix n'est pas un échec"
    assert lot["pliage"]["attend_un_choix"] is True
    assert lot["pliage"]["trouvees"] == 10
    assert lot["pliage"]["surplus"] == 1
    assert [a for a in _grille(client) if a["generation"] == lot["identifiant"]] == []


# ── « Le compte d'images est le **seul** refus automatique — les mesures de
#     ressemblance et de dérive de grille s'affichent et ne bloquent rien »
#     (US-135) ────────────────────────────────────────────────────────────────


def test_deux_poses_jumelles_sont_signalees_et_entrent_quand_meme(client, double):
    """Le cas mesuré le 28 août : deux planches sur vingt-quatre avaient le
    compte juste et répétaient une pose. Le contrat était tenu, la planche sans
    valeur — et c'est l'auteur qui le voit, pas le produit qui refuse."""
    double.rendre = lambda: planche_sujets(4, jumelles=True)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    assert lot["statut"] == "reussie", "une ressemblance ne refuse jamais"
    cases = _cases(client, personnage["identifiant"])[:4]
    mesures = [c["images"][0]["lot"] for c in cases]

    # Les deux jumelles se **désignent l'une l'autre** : sans la symétrie, la
    # seconde dirait « je ne ressemble à personne » alors que la première vient
    # de la nommer.
    assert mesures[0]["ressemblance"] == 1.0 and mesures[0]["jumeau"] == 1
    assert mesures[1]["ressemblance"] == 1.0 and mesures[1]["jumeau"] == 0
    # Et les autres ne sont pas signalées pour autant.
    assert mesures[2]["ressemblance"] < 1.0
    assert mesures[3]["ressemblance"] < 1.0


def test_chaque_case_porte_ses_mesures(client, double):
    """Case par case, jamais une moyenne du lot : c'est une case qui se relance
    seule, donc c'est une case qui doit dire ce qu'elle vaut."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    _lot(client, personnage["identifiant"], poses)

    for index, case in enumerate(_cases(client, personnage["identifiant"])[:4]):
        mesures = case["images"][0]["lot"]
        assert mesures["case"] == index
        assert mesures["cases"] == 4
        assert mesures["derive"] >= 1.0
        assert 0.0 <= mesures["ressemblance"] <= 1.0


def test_une_image_ordinaire_ne_porte_aucune_mesure_de_lot(client):
    """Le champ est vide pour l'immense majorité des images du produit, et le
    vide est une réponse : celle-ci n'est pas sortie d'une planche."""
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un tonneau"}
    )
    identifiant = reponse.json()["identifiant"]
    _attendre(client, identifiant)
    assert client.get(f"/api/assets/{identifiant}-0").json()["lot"] is None


# ── « Une pose ratée à l'intérieur d'un lot accepté se régénère seule, sans
#     toucher aux autres » (US-133) ───────────────────────────────────────────


def test_une_pose_se_regenere_seule_dans_un_lot_accepte(client, double):
    """C'est la génération de C1, inchangée : une case, un appel, et les huit
    voisines ne bougent pas d'un octet."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    _lot(client, personnage["identifiant"], poses)

    avant = {c["pose"]: c["images"][0]["identifiant"] for c in
             _cases(client, personnage["identifiant"])[:4]}

    double.rendre = None
    reponse = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": "un nain forgeron, marche",
            "personnage": personnage["identifiant"],
            "pose": poses[1],
        },
    )
    assert reponse.status_code == 202, reponse.text
    _attendre(client, reponse.json()["identifiant"])

    apres = {c["pose"]: [i["identifiant"] for i in c["images"]]
             for c in _cases(client, personnage["identifiant"])[:4]}
    assert len(apres[poses[1]]) == 2, "la case visée a gagné une image"
    for pose in (poses[0], poses[2], poses[3]):
        assert apres[pose] == [avant[pose]], "les voisines n'ont pas bougé"


# ── « Un lot interrompu par la fermeture de l'application se reprend au
#     redémarrage sans repayer les images déjà reçues, et rien ne se relance
#     tout seul » (US-132) ────────────────────────────────────────────────────


def test_un_lot_recu_mais_non_deplie_se_range_au_redemarrage(client, atelier, double):
    """La planche est payée et sur le disque ; le dépliage n'a pas eu lieu.
    Le démarrage la range — **gratuitement**, et le compte d'appels le prouve."""
    import asyncio

    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    # On défait le dépliage sans toucher à la planche : c'est exactement l'état
    # qu'une coupure entre l'enregistrement de l'arrivée et le rangement laisse.
    for asset in [a for a in _grille(client) if a["rang"] >= 100]:
        atelier.base.oublier_asset(asset["identifiant"])
    assert [a for a in _grille(client) if a["rang"] >= 100] == []

    avant = double.appels
    asyncio.run(atelier.ouvrir())

    assert double.appels == avant, "reprendre un lot ne repaie rien"
    repris = [a for a in _grille(client) if a["generation"] == lot["identifiant"]]
    assert len([a for a in repris if a["rang"] >= 100]) == 4
    # La planche n'a pas été touchée par le défaisage, et la reprise ne l'a pas
    # doublée : un asset par rang, ici comme partout.
    assert len([a for a in repris if a["rang"] == 0]) == 1


def test_un_lot_coupe_en_vol_ne_se_relance_pas_tout_seul(client, atelier, double):
    """L'autre moitié, et elle ne se confond pas avec la première : ce qui a été
    coupé **en vol** est marqué interrompu et attend un geste, depuis T1.
    Déplier n'est pas relancer.

    Le lot est *préparé* et jamais exécuté — c'est l'état exact d'un appel que
    l'arrêt du serveur a coupé, et c'est le motif de T1."""
    import asyncio

    from atelier.domaine import Demande

    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    generation, _, _ = atelier.generations.preparer(
        MODELE,
        Demande("un nain forgeron"),
        personnage=personnage["identifiant"],
        poses=poses,
    )
    assert generation.pliage is not None

    avant = double.appels
    asyncio.run(atelier.ouvrir())

    vue = client.get(f"/api/generations/{generation.identifiant}").json()
    assert vue["emplacements"][0]["statut"] == "interrompue"
    assert double.appels == avant, "rien ne se relance tout seul, jamais"
    assert all(c["images"] == [] for c in _cases(client, personnage["identifiant"])[:4])


# ── « Une feuille assemblée sort quand on la demande, et jamais toute seule »
#     (G16, qui renverse l'invariant de C2) ───────────────────────────────────


def test_l_archive_ne_contient_la_planche_que_si_on_la_choisit(client, double):
    """**L'export travaille sur ce qu'on lui donne**, et rien de plus.

    Depuis G16 la planche est un asset : la choisir la fait sortir, ne pas la
    choisir la laisse. Ce que l'essai tient, c'est qu'elle ne s'invite jamais
    dans une archive où l'auteur ne l'a pas mise — l'ancienne garantie était
    *par construction*, celle-ci est *par sélection*, et c'est ce que le
    renversement de l'invariant coûte."""
    import io
    import zipfile

    def noms(identifiants):
        reponse = client.post("/api/exports", json={"identifiants": identifiants})
        assert reponse.status_code == 200, reponse.text
        with zipfile.ZipFile(io.BytesIO(reponse.content)) as archive:
            return [n for n in archive.namelist() if n.endswith(".png")]

    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)
    nes = [a for a in _grille(client) if a["generation"] == lot["identifiant"]]
    corps = [a["identifiant"] for a in nes if a["rang"] >= 100]
    planche = [a["identifiant"] for a in nes if a["rang"] == 0]

    assert len(noms(corps)) == 4, "les quatre corps seuls, et la planche reste"
    assert len(noms(corps + planche)) == 5, "choisie, elle sort comme les autres"


# ── « Avant de lancer, l'écran dit ce qu'un compte faux coûterait — le lot
#     entier refusé et relancé au prix plein — sans annoncer de probabilité »
#     (US-129) ────────────────────────────────────────────────────────────────


def test_le_cout_annonce_est_celui_d_un_appel_mesure(client, double):
    """Le coût d'un lot est celui **d'un appel**, pas de neuf : c'est la
    promesse de la tranche, et c'est le même chiffre qu'un compte faux ferait
    repayer. Le produit n'a donc qu'un nombre à annoncer, et il est mesuré."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    _lot(client, personnage["identifiant"], poses)

    couts = client.get("/api/models").json()["couts"]
    assert couts[MODELE] == 0.0245


def test_le_gabarit_compte_dans_ce_qui_part(client):
    """**Le gabarit est une image qui part vraiment** : il occupe une place dans
    le plafond du modèle et il coûte chez ceux qui facturent au token. L'oublier
    ferait mentir le grisé au moment précis où l'appel est le plus cher."""
    sans = client.get("/api/models", params={"references": 1}).json()["references"]
    avec = client.get(
        "/api/models", params={"references": 1, "cases": 9}
    ).json()["references"]
    assert sans["gabarit"] == 0
    assert avec["gabarit"] == 1
    assert avec["total"] == sans["total"] + 1


def test_le_gabarit_n_est_pas_une_ligne_a_decocher(client):
    """Il n'entre pas dans la liste des lignes : celle-ci est faite d'images que
    l'auteur peut décocher, et décocher le gabarit reviendrait à demander une
    planche sans dire à quoi elle ressemble."""
    lignes = client.get(
        "/api/models", params={"references": 1, "cases": 9}
    ).json()["references"]["lignes"]
    assert len(lignes) == 1


def test_le_gabarit_part_vraiment(client, double):
    """Compté **au bout du port**, pas sur l'enregistrement : un test qui
    regarderait ce que le produit dit avoir envoyé se contenterait de sa parole."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    _lot(client, personnage["identifiant"], poses)
    assert double.references_recues[-1] == 1


def test_un_modele_sans_reference_part_sans_gabarit(client, double):
    """Il n'est pas grisé pour autant : le grisé dit *cette chose est
    indisponible*, et celle-ci ne l'est pas — le modèle peut honorer la demande,
    un peu moins bien. C'est le bras « libre » de l'essai du 28 août."""
    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses, modele=SANS_REFERENCE)
    assert lot["statut"] == "reussie"
    assert double.references_recues[-1] == 0


# ── « Le modèle par défaut pour produire une planche et celui pour éditer un
#     corps se règlent séparément sur l'univers du projet » ───────────────────


def test_les_deux_modeles_d_appel_se_reglent_separement(client):
    """Deux, et pas un : un modèle rend les traits du gabarit dans l'image là où
    un autre les ignore comme demandé — mesuré le 28 août."""
    reponse = client.put(
        "/api/universe",
        json={"modele_planche": MODELE, "modele_edition": SANS_REFERENCE},
    )
    assert reponse.status_code == 200, reponse.text
    univers = reponse.json()["univers"]
    assert univers["modele_planche"] == MODELE
    assert univers["modele_edition"] == SANS_REFERENCE


def test_le_defaut_d_un_lot_est_le_modele_de_planche(client):
    """Un lot armé demande une planche : c'est le modèle de planche qui décide,
    avant la famille du sujet. Sans lot, il ne décide rien."""
    client.put("/api/universe", json={"modele_planche": SANS_REFERENCE})
    seul = client.get("/api/models").json()["defaut"]["modele"]
    lot = client.get("/api/models", params={"cases": 9}).json()["defaut"]["modele"]
    assert lot == SANS_REFERENCE
    assert seul != SANS_REFERENCE


def test_sans_reglage_le_catalogue_reprend_la_main(client):
    """Trois niveaux, aucun trou : le modèle de planche, puis la famille du
    sujet, puis le défaut du catalogue. Un réglage qu'on n'a pas posé n'est pas
    un trou."""
    lot = client.get("/api/models", params={"cases": 9}).json()["defaut"]["modele"]
    assert lot in {m["identifiant"] for m in client.get("/api/models").json()["modeles"]}


# ── Ce qui refuse avant de payer ─────────────────────────────────────────────


def test_un_lot_sur_une_pose_qui_n_existe_plus_se_refuse_avant_de_payer(
    client, double
):
    """Chaque case passe par `viser`, comme la case unique de C1 : l'écran ne
    coche que des poses visibles, mais un onglet resté ouvert pendant qu'on en
    décochait une enverrait sinon une image dans une case que personne ne
    regarde plus. **Une seule refuse, le lot entier ne part pas** — c'est mieux
    que de payer neuf images pour en ranger huit."""
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:3]
    client.delete(f"/api/characters/poses/{poses[2]}")

    avant = double.appels
    reponse = _lancer(client, personnage["identifiant"], poses)
    assert reponse.status_code == 409, reponse.text
    assert double.appels == avant, "aucun centime n'est parti"


def test_un_lot_ne_se_combine_pas_avec_les_variations(client, double):
    """Un lot plié part en **un seul** appel — c'est tout son intérêt. Le refus
    le dit plutôt que de ramener les variations à un en silence."""
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:3]
    avant = double.appels
    reponse = _lancer(client, personnage["identifiant"], poses, variations=3)
    assert reponse.status_code == 409, reponse.text
    assert "un seul appel" in reponse.json()["raison"]
    assert double.appels == avant


def test_une_seule_pose_n_est_pas_un_lot(client, double):
    """En dessous de deux, c'est la génération de C1 : la plier ferait payer un
    gabarit et une consigne de grille pour une image que le produit sait déjà
    demander."""
    double.rendre = None
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:1]
    lot = _lot(client, personnage["identifiant"], poses, pose=poses[0])
    assert client.get(f"/api/generations/{lot['identifiant']}").json()["pliage"] is None
    assert client.get(f"/api/assets/{lot['identifiant']}-0").status_code == 200


# ── « Réseau coupé » — et la preuve se compte ────────────────────────────────


def test_deplier_ne_demande_jamais_le_fournisseur(client, atelier, double):
    """Déplier une planche déjà là marche réseau coupé : c'est du processeur et
    du disque, rien d'autre. Prouvé en comptant les appels du double autour du
    dépliage, pas en le lisant dans les imports."""
    import asyncio

    double.rendre = lambda: planche_sujets(4)
    personnage = _creer(client)
    poses = [p["identifiant"] for p in _plan(client)][:4]
    lot = _lot(client, personnage["identifiant"], poses)

    generation = atelier.generations.lire(lot["identifiant"])
    for asset in [a for a in _grille(client) if a["rang"] >= 100]:
        atelier.base.oublier_asset(asset["identifiant"])

    double.catalogue_lisible = False
    avant = double.appels
    nees = atelier.pliage.deplier(generation, generation.emplacements[0])
    assert len(nees) == 4
    assert double.appels == avant

    asyncio.run(asyncio.sleep(0))


# ── « Ce qui part en référence et les réglages d'une génération s'enregistrent
#     sous un nom, et se rappellent d'un geste sur un autre personnage »
#     (US-134) ────────────────────────────────────────────────────────────────


def test_un_jeu_de_reglages_s_enregistre_et_se_rappelle(client):
    """Le **quatrième rôle** d'une réinjection, déclaré en T1 et resté vide
    depuis : le seul des quatre qui n'envoie aucune image."""
    reponse = client.put(
        "/api/presets/mes-nains",
        json={
            "modele": MODELE,
            "proportions": "1:1",
            "options": {"quality": "high"},
            "echelle": "personnage",
            "references": [{"asset": "une-planche", "role": "style"}],
            "references_ecartees": ["une-carte"],
        },
    )
    assert reponse.status_code == 200, reponse.text

    rappele = client.get("/api/presets").json()["reglages"]["mes-nains"]
    assert rappele["modele"] == MODELE
    assert rappele["options"] == {"quality": "high"}
    assert rappele["references"] == [{"asset": "une-planche", "role": "style"}]
    assert rappele["references_ecartees"] == ["une-carte"]


def test_un_jeu_de_reglages_ne_porte_jamais_le_personnage(client):
    """C'est toute la promesse du geste : *se rappeler sur un autre personnage*.
    Un jeu qui porterait le personnage ne se rejouerait que sur lui."""
    client.put("/api/presets/mes-nains", json={"modele": MODELE})
    rappele = client.get("/api/presets").json()["reglages"]["mes-nains"]
    assert "personnage" not in rappele
    assert "poses" not in rappele
    assert "prompt" not in rappele


def test_un_jeu_de_reglages_sans_nom_se_refuse(client):
    reponse = client.put("/api/presets/%20", json={"modele": MODELE})
    assert reponse.status_code == 409, reponse.text


def test_un_jeu_de_reglages_s_oublie(client):
    client.put("/api/presets/jetable", json={"modele": MODELE})
    reponse = client.delete("/api/presets/jetable")
    assert reponse.status_code == 200, reponse.text
    assert reponse.json()["reglages"] == {}


def test_les_jeux_de_reglages_ne_demandent_jamais_le_fournisseur(client, double):
    """Enregistrer et rappeler des réglages ne sort pas — et un modèle disparu
    du catalogue se grise **au moment de générer**, avec sa raison, pas à
    l'enregistrement : un second endroit qui juge une demande finirait par ne
    plus dire la même chose que le premier."""
    avant = double.appels
    client.put("/api/presets/hors-ligne", json={"modele": "un/modele-disparu"})
    assert client.get("/api/presets").json()["reglages"]["hors-ligne"]["modele"] == (
        "un/modele-disparu"
    )
    assert double.appels == avant
