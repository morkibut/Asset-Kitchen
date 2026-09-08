# -*- coding: utf-8 -*-
"""Les critères de E12 qui vivent côté serveur — la fiche d'une chose du jeu.

**Ce qui se mesure ici** : que chaque texte porte son origine parmi les cinq,
qu'un texte écrit sur une chose dise celui qu'il remplace, qu'un désaccord entre
le texte qui part et la valeur qui s'applique se voie sans qu'on le cherche,
qu'une image fabriquée devienne une référence permanente **et parte vraiment**,
et que l'atelier propose de lui-même le corps retenu. Ce que l'écran montre — les
trois colonnes, la matrice qui répond pendant qu'on règle — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare est mesurée sur le vrai projet, le 30 août 2026.**
Dix-sept appels payés sur vingt-huit sont partis **sans une seule image de
référence**, sur des modèles qui en acceptent quatorze. Un personnage sur trois
n'avait aucun signalement et avait quand même généré quatre fois. La bible
annonçait `64x64` en toutes lettres pendant que le projet imposait 128, et aucun
écran ne mettait les deux côte à côte. Quatre mécanismes du domaine — écrire un
texte sur une chose, retenir une image, ranger une pose, ranger une référence —
avaient **zéro emploi** sur trois personnages et quarante-huit images, faute d'un
écran qui les atteigne.
"""

from __future__ import annotations

from atelier.services.production import OUVERTS_A_UNE_AMBIANCE, _tailles_annoncees


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _regler(client, identifiant: str, **champs) -> dict:
    reponse = client.put(f"/api/characters/{identifiant}", json=champs)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["personnage"]


def _habillage(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/characters/{identifiant}/style")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _champ(habillage: dict, nom: str) -> dict:
    return next(c for c in habillage["champs"] if c["nom"] == nom)


def _bible(client, **textes) -> None:
    reponse = client.put(
        "/api/universe",
        json={
            "bible": [
                {"nom": nom, "texte": texte, "actif": True}
                for nom, texte in textes.items()
            ]
        },
    )
    assert reponse.status_code == 200, reponse.text


# ── Les cinq origines d'un texte ─────────────────────────────────────────────


def test_un_texte_non_touche_vient_du_jeu(client):
    """L'état de **tous les champs des trois personnages du projet**, le jour où
    la maquette a été écrite : rien n'avait jamais été posé sur une chose."""
    _bible(client, monde="Deep forge halls")
    chose = _creer(client)

    monde = _champ(_habillage(client, chose["identifiant"]), "monde")

    assert monde["origine"] == "jeu"
    assert monde["texte"] == "Deep forge halls"
    assert monde["remplace"] == ""


def test_une_ambiance_remplace_trois_textes_et_dit_lesquels(client):
    """**Trois cases ouvertes, quatre fermées**, et ce n'est pas arbitraire : les
    quatre autres décrivent la mécanique du jeu, pas son atmosphère."""
    _bible(client, monde="Deep forge halls", vue="3/4 top-down")
    ambiance = client.post(
        "/api/moods", json={"nom": "Forge des profondeurs"}
    ).json()["ambiances"][0]
    client.put(
        f"/api/moods/{ambiance['identifiant']}",
        json={"monde": "molten channels", "eclairage": "forge-lit from below"},
    )
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])

    habillage = _habillage(client, chose["identifiant"])

    monde = _champ(habillage, "monde")
    assert monde["origine"] == "ambiance"
    assert monde["texte"] == "molten channels"
    assert monde["ambiance"] == "Forge des profondeurs"
    # Une case fermée reste celle du jeu, et le dit.
    assert _champ(habillage, "vue")["origine"] == "jeu"
    assert _champ(habillage, "vue")["ouvert"] is False
    assert OUVERTS_A_UNE_AMBIANCE == {"monde", "eclairage", "trait"}


def test_un_texte_ecrit_ici_montre_celui_quil_remplace(client):
    """**On doit pouvoir lire ce à quoi on a renoncé sans aller le chercher
    ailleurs.** C'est ce qui rend un écart lisible plutôt qu'accidentel.

    **La case du jeu se pose maintenant par la vue, plus par un texte** (`B14`) :
    `vue` est une case de l'atelier, et son contenu se choisit à l'étape de la
    vue. La fixture pose donc `vue-dessus-34`, dont la phrase est mot pour mot
    celle que cet essai attendait déjà. Ce qui est mesuré ne change pas : ce que
    la fiche écrit gagne, et ce qu'elle écarte se lit barré."""
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    chose = _creer(client)

    _regler(
        client,
        chose["identifiant"],
        textes={"vue": "flat orthographic icon, centered"},
    )

    vue = _champ(_habillage(client, chose["identifiant"]), "vue")
    assert vue["origine"] == "ici"
    assert vue["texte"] == "flat orthographic icon, centered"
    assert vue["remplace"] == "3/4 top-down orthographic view, subject centered"


def test_un_texte_ecrit_ici_remplace_meme_celui_de_lambiance(client):
    """Trois couches, et l'ordre est celui de la décision : ce que la chose écrit
    gagne sur ce que l'ambiance donne, qui gagne sur ce que le jeu dit."""
    _bible(client, monde="du jeu")
    ambiance = client.post("/api/moods", json={"nom": "Marais"}).json()["ambiances"][0]
    client.put(f"/api/moods/{ambiance['identifiant']}", json={"monde": "de l'ambiance"})
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])

    _regler(client, chose["identifiant"], textes={"monde": "écrit ici"})

    monde = _champ(_habillage(client, chose["identifiant"]), "monde")
    assert monde["origine"] == "ici"
    assert monde["remplace"] == "de l'ambiance"


def test_eteindre_nest_pas_vider(client):
    """**Une case éteinte est un refus écrit, pas une case vide.**

    Vider rend la case au jeu ; éteindre écrit que ce champ ne part pas pour
    cette chose-là. Les confondre aurait rendu le refus indistinguable de
    l'oubli, et donc impossible à défaire.
    """
    # **Sans cible**, pour que la ligne barrée ne porte que le texte de l'auteur :
    # depuis le 1ᵉʳ septembre 2026, ce qui part est la phrase de l'atelier
    # *plus* ce texte-ci, et le sujet de cet essai-là est l'extinction, pas la
    # composition. Elle a son essai à elle, deux fichiers plus loin.
    client.put("/api/universe", json={"cible_px": 0})
    _bible(client, technique="no bleed on the sprite edges")
    chose = _creer(client)

    _regler(client, chose["identifiant"], eteindre="technique")
    eteint = _champ(_habillage(client, chose["identifiant"]), "technique")

    assert eteint["origine"] == "eteint"
    assert eteint["texte"] == ""
    # Le texte qui serait parti, montré barré — et *rallumer* à un clic.
    assert eteint["remplace"] == "no bleed on the sprite edges"

    _regler(client, chose["identifiant"], rallumer="technique")
    assert _champ(_habillage(client, chose["identifiant"]), "technique")["origine"] == "jeu"


def test_vider_un_texte_rend_la_case_au_jeu(client):
    """L'autre moitié du geste : ce qui a été écrit ici se défait en le vidant,
    et la case revient à ce que le jeu dit."""
    _bible(client, monde="du jeu")
    chose = _creer(client)
    _regler(client, chose["identifiant"], textes={"monde": "écrit ici"})

    _regler(client, chose["identifiant"], textes={"monde": "  "})

    assert _champ(_habillage(client, chose["identifiant"]), "monde")["origine"] == "jeu"


# ── Le désaccord que seule la fiche met sous les yeux ────────────────────────


def test_le_desaccord_entre_le_texte_et_la_grille_se_voit(client):
    """**Mesuré sur le vrai projet.** Deux champs de la bible écrivent `64x64` en
    toutes lettres et partent dans le prompt ; le réglage du projet — celui que
    la mise sur grille applique vraiment — vaut 128. Aucun écran ne mettait ces
    deux choses côte à côte. La fiche ne corrige rien : elle rend la faute
    impossible à ne pas voir.

    **Et la faute a changé de forme le 1ᵉʳ septembre 2026** — c'est le seul mot
    de cet essai qui bouge. Les deux textes d'origine étaient les phrases que le
    produit écrivait lui-même, gelées sur 64 par une étiquette ajoutée à côté ;
    elles ne peuvent plus l'être, puisqu'elles ne sont plus rangées dans la
    case. Ce qui reste possible — et ce que le vrai projet porte, mot pour mot,
    en français — est un texte **tapé à la main** qui nomme une taille. Celui-là
    ne se corrige pas tout seul, et c'est très exactement pour lui que cet écran
    existe.

    **Et `B14` a fait tomber la moitié de la faute** — c'est le second mot qui
    bouge, et il se mesure ici. `rendu` est devenue une case de l'atelier : le
    texte tapé à la main n'y part plus, donc il ne peut plus contredire la
    grille. Il en reste **une** sur deux, `technique`, la seule des trois cases
    à phrase d'atelier qui garde du texte d'auteur — et c'est très exactement le
    troisième doublon que la planche de `B14` laisse ouvert."""
    client.put("/api/universe", json={"cible_px": 128})
    _bible(
        client,
        rendu="chunky 64x64 pixel art, no smoothing",
        technique="Sprite isolé sur fond plat, grille stricte 64x64 px",
    )
    chose = _creer(client)

    habillage = _habillage(client, chose["identifiant"])

    assert habillage["cible_px"] == 128
    assert set(habillage["desaccord"]) == {"technique"}
    # Le texte de `rendu` est toujours sur le disque — il n'annonce plus rien,
    # parce qu'il ne part plus. C'est la disparition du doublon, vue d'ici.
    assert _champ(habillage, "rendu")["annonce"] == []
    assert _champ(habillage, "technique")["annonce"] == [64]


def test_un_accord_ne_se_signale_pas(client):
    """Le cas ordinaire ne dit rien : le produit constate un désaccord, il ne
    commente pas un accord."""
    client.put("/api/universe", json={"cible_px": 64})
    _bible(client, rendu="2D pixel art on a 64x64 grid")
    chose = _creer(client)

    assert _habillage(client, chose["identifiant"])["desaccord"] == []


def test_une_taille_dimage_nest_pas_une_grille(client):
    """Seuls les carrés comptent : `64x64` est une grille, `253x321` est la
    taille d'une image dont personne ne parle ici."""
    assert _tailles_annoncees("a 253x321 image") == set()
    assert _tailles_annoncees("64x64 grid") == {64}
    assert _tailles_annoncees("strict 128 px snap") == {128}


# ── Ce que l'écart coûte, dit en clair ───────────────────────────────────────


def test_la_fiche_compte_ce_qui_est_pose_sur_cette_chose_seule(client):
    """**Le coût, nommé.** Une chose qui écrit ses propres textes diverge du
    reste du jeu, et rien ne l'empêche : ce qui tient contre ça est que l'écart
    se voit sans qu'on le cherche."""
    _bible(client, monde="a", vue="b", technique="c")
    chose = _creer(client)

    _regler(client, chose["identifiant"], textes={"vue": "à moi"})
    _regler(client, chose["identifiant"], eteindre="technique")

    habillage = _habillage(client, chose["identifiant"])
    assert habillage["poses_ici"] == 2


def test_une_ambiance_ne_compte_pas_comme_un_ecart(client):
    """Elle est faite pour être partagée. Le désaccord dangereux n'est pas
    « cette chose diffère du jeu », c'est « cette chose diffère de tout, toute
    seule »."""
    _bible(client, monde="du jeu")
    ambiance = client.post("/api/moods", json={"nom": "Marais"}).json()["ambiances"][0]
    client.put(f"/api/moods/{ambiance['identifiant']}", json={"monde": "du marais"})
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])

    habillage = _habillage(client, chose["identifiant"])

    assert habillage["poses_ici"] == 0
    assert habillage["de_l_ambiance"] == 1


# ── Les images de référence ──────────────────────────────────────────────────


def _references(client, identifiant: str) -> dict:
    reponse = client.get(f"/api/characters/{identifiant}/references")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def test_une_image_fabriquee_se_promeut_en_reference_permanente(client, tmp_path):
    """**La correction du frottement le plus cher du dépôt.** Une image que
    l'atelier a produite devient une référence permanente de sa chose : elle
    repart avec chaque appel suivant, et c'est ce qui fait qu'un personnage se
    ressemble d'une pose à l'autre."""
    from tests.conftest import image_sujet

    fichier = tmp_path / "corps.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    chose = _creer(client)

    reponse = client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset["identifiant"], "promue": True},
    )

    assert reponse.status_code == 200, reponse.text
    lignes = reponse.json()["references"]["lignes"]
    assert [l["provenance"] for l in lignes] == ["image promue"]
    assert lignes[0]["reference"] == asset["identifiant"]


def test_une_image_promue_part_vraiment_avec_lappel(client, tmp_path, double):
    """**Sans ça, la promotion serait un rangement sans effet.** Le compte des
    références vient du serveur, celui-là même qui compose l'appel."""
    from tests.conftest import image_sujet

    fichier = tmp_path / "corps.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    chose = _creer(client)
    client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset["identifiant"]},
    )

    compte = client.get(
        "/api/models",
        params={"echelle": "personnage", "personnage": chose["identifiant"]},
    )

    assert compte.status_code == 200, compte.text
    lignes = compte.json()["references"]["lignes"]
    partie = next(l for l in lignes if l["asset"] == asset["identifiant"])
    # **Elle dit qu'elle est promue**, et non « réinjection » : ce mot-là dit
    # *l'auteur l'a posée pour cet appel*, ce qu'une image promue n'est pas —
    # elle part avec tous les appels de sa chose.
    assert partie["provenance"] == "image promue"
    assert partie["role"] == "reference"


def test_une_image_depromue_ne_part_plus(client, tmp_path):
    """La dépromouvoir ne la supprime pas : elle sort de la liste, elle reste en
    bibliothèque."""
    from tests.conftest import image_sujet

    fichier = tmp_path / "corps.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    chose = _creer(client)
    client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset["identifiant"]},
    )

    client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset["identifiant"], "promue": False},
    )

    assert _references(client, chose["identifiant"])["lignes"] == []
    assert client.get(f"/api/assets/{asset['identifiant']}").status_code == 200


def test_latelier_propose_le_corps_retenu_avec_sa_provenance(client, tmp_path):
    """**Il n'attend pas qu'on y pense, et il ne décide pas non plus** : il
    propose, avec la provenance écrite dessous, et une proposition se refuse d'un
    clic. Sur quarante-huit images du dépôt il y avait zéro favori, donc la règle
    du corps retenu retombait toujours sur « la plus récente » — qui n'est pas la
    meilleure, c'est la dernière."""
    from tests.conftest import image_sujet

    fichier = tmp_path / "corps.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    chose = _creer(client)
    client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": chose["identifiant"], "pose": "repos"},
    )

    propositions = _references(client, chose["identifiant"])["propositions"]

    assert len(propositions) == 1
    assert propositions[0]["reference"] == asset["identifiant"]
    assert "corps retenu" in propositions[0]["provenance"]


def test_une_image_deja_promue_nest_plus_proposee(client, tmp_path):
    """Une proposition qu'on a acceptée cesse d'être une proposition — sans quoi
    l'écran offrirait de promouvoir ce qui l'est déjà."""
    from tests.conftest import image_sujet

    fichier = tmp_path / "corps.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    chose = _creer(client)
    client.put(
        f"/api/assets/{asset['identifiant']}/character",
        json={"personnage": chose["identifiant"], "pose": "repos"},
    )
    client.put(
        f"/api/characters/{chose['identifiant']}/references",
        json={"asset": asset["identifiant"]},
    )

    assert _references(client, chose["identifiant"])["propositions"] == []


def test_les_images_de_lambiance_arrivent_avec_elle(client):
    """**Sans les recopier** : elles restent celles de l'ambiance, et les
    corriger là-bas les corrige partout."""
    ambiance = client.post("/api/moods", json={"nom": "Marais"}).json()["ambiances"][0]
    client.put(
        f"/api/moods/{ambiance['identifiant']}", json={"references": ["une-carte"]}
    )
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])

    lignes = _references(client, chose["identifiant"])["lignes"]

    assert [l["provenance"] for l in lignes] == ["image de son ambiance"]
    assert lignes[0]["detail"] == "Marais"
