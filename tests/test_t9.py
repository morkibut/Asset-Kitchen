# -*- coding: utf-8 -*-
"""Les critères d'acceptation de T9 — les liens et les notes.

Un test par critère de `docs/PLAN.md` § Phase T9, nommé d'après lui. **Trois des
neuf ne se vérifient pas ici** : que le trait suive ses deux objets quand on les
déplace, que les six teintes ne se confondent avec aucune couleur sémantique, et
que Ctrl+Z défasse la création comme la coupe. Les deux premiers sont de la
géométrie et de la couleur — ils vivent dans `interface/src/composants/` et se
mesurent au navigateur ; le troisième est une pile qui n'existe que dans
l'onglet, et il vit dans `interface/src/App.test.tsx`.

**Ce que le serveur tient d'un lien, et rien de plus** : qui est joint à qui, et
ce qu'on en a dit. Où le trait passe, comment il se courbe, où son mot se pose —
l'écran. La frontière est la même qu'en T8, et la tranche ne la déplace pas.

**Aucun test de ce fichier ne coûte un centime**, et le dernier le prouve plutôt
que de l'affirmer, en comptant les appels du double : tirer un trait, le nommer,
le couper et teinter un îlot ne demandent jamais le fournisseur.
"""

from __future__ import annotations

import pytest
from conftest import image

from atelier.domaine.lien import MOT_MAX
from atelier.domaine.teinte import TEINTES


# ── De quoi jouer une séance ─────────────────────────────────────────────────


def _coller(client, nom: str = "planche.png") -> dict:
    """Une carte image de plus. `forcer`, parce que le double rend deux fois les
    mêmes octets — donc la même empreinte, donc un doublon *proposé*."""
    reponse = client.post(
        "/api/board/paste", params={"nom": nom, "forcer": True}, content=image("PNG")
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _note(client, texte: str = "le grain de la pierre", **corps) -> dict:
    reponse = client.post("/api/board/text", json={"texte": texte, **corps})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _regler(client, carte: str, **reglage) -> dict:
    reponse = client.put(f"/api/board/{carte}", json=reglage)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _lier(client, de: dict, vers: dict) -> dict:
    reponse = client.post("/api/board/links", json={"de": de, "vers": vers})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()


def _carte(identifiant: str) -> dict:
    return {"genre": "carte", "valeur": identifiant}


def _ilot(nom: str) -> dict:
    return {"genre": "ilot", "valeur": nom}


def _toile(client) -> dict:
    return client.get("/api/board").json()


def _classer(client, nom_fichier: str, groupe: str, place: list[float]) -> dict:
    """Une carte posée dans un îlot — donc un îlot qui existe."""
    carte = _coller(client, nom_fichier)
    _regler(client, carte["identifiant"], groupe=groupe, position=place)
    return carte


# ── « Un lien se trace d'une carte à une autre en un seul geste » ─────────────


def test_un_lien_naît_muet_entre_deux_cartes(client):
    """**Le défaut est muet, l'exception s'exprime.**

    Un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant.
    Demander le mot au moment du tracé aurait fait répondre, à chaque trait, à
    une question dont la réponse est presque toujours « rien ».
    """
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")

    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))

    assert lien["mot"] == ""
    assert lien["pointe"] is False
    assert lien["de"] == {"genre": "carte", "valeur": une["identifiant"]}
    assert lien["vers"] == {"genre": "carte", "valeur": autre["identifiant"]}


def test_la_toile_se_lit_en_un_aller_retour(client):
    """« `GET /api/board` les rend **avec les cartes** » (`ARCHITECTURE.md` §5).

    Une seconde route pour les traits aurait fait paraître les cartes avant eux —
    donc un instant, à chaque ouverture, où la toile montre des objets sans ce
    qu'on en avait dit.
    """
    une = _classer(client, "une.png", "marais", [0, 0])
    autre = _coller(client, "autre.png")
    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))

    toile = _toile(client)
    assert [un["identifiant"] for un in toile["liens"]] == [lien["identifiant"]]
    assert len(toile["cartes"]) == 2
    assert toile["groupes"] == ["marais"]


def test_un_lien_joint_une_note_a_un_ilot(client):
    """« Un lien relie aussi bien une note à un îlot que deux cartes. »

    Les deux extrémités ne se nomment pas dans le même espace — une carte par
    identifiant, un îlot par nom de groupe — et c'est très exactement pourquoi le
    couple `(genre, valeur)` existe.
    """
    _classer(client, "une.png", "marais", [0, 0])
    note = _note(client, "l'eau est plus froide ici", position=[300, 40])

    lien = _lier(client, _carte(note["identifiant"]), _ilot("marais"))

    assert lien["de"]["genre"] == "carte"
    assert lien["vers"] == {"genre": "ilot", "valeur": "marais"}


def test_un_lien_vers_une_extremite_absente_est_refuse_en_la_nommant(client):
    """L'onglet qui tire le trait peut avoir un rendu vieux d'une seconde : un
    lien écrit vers une extrémité disparue serait l'entrée morte que la tranche
    interdit. La vérification est donc au serveur, et le refus **nomme** ce qui
    manque."""
    une = _coller(client)

    for absent in (_carte("jamais-vue"), _ilot("atlantide")):
        refus = client.post(
            "/api/board/links", json={"de": _carte(une["identifiant"]), "vers": absent}
        )
        assert refus.status_code == 409, refus.text
        assert absent["valeur"] in refus.json()["raison"]


def test_un_objet_ne_se_joint_pas_a_lui_meme_ni_deux_fois_au_meme(client):
    """Deux traits entre les deux mêmes objets se posent l'un sur l'autre : le
    second est invisible, donc impossible à survoler, donc impossible à couper.
    Le sens ne compte pas pour cette question-là — retourner un lien existant
    reste un geste, en empiler un second n'en est pas un."""
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")

    seul = client.post(
        "/api/board/links",
        json={"de": _carte(une["identifiant"]), "vers": _carte(une["identifiant"])},
    )
    assert seul.status_code == 409
    assert "lui-même" in seul.json()["raison"]

    _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))
    retour = client.post(
        "/api/board/links",
        json={"de": _carte(autre["identifiant"]), "vers": _carte(une["identifiant"])},
    )
    assert retour.status_code == 409, "le sens ne fait pas un second trait"
    assert len(_toile(client)["liens"]) == 1


# ── « Le mot et la pointe s'ajoutent après coup, et se retirent » ─────────────


def test_le_mot_et_la_pointe_s_ajoutent_puis_se_retirent(client):
    """« L'un et l'autre s'ajoutent après coup, et se retirent » — donc le lien
    revient exactement à ce qu'il était en naissant.

    Le vide efface, l'absence ne touche pas : la convention du produit depuis
    `groupe`, appliquée telle quelle.
    """
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")
    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))
    adresse = f"/api/board/links/{lien['identifiant']}"

    dit = client.put(adresse, json={"mot": "vient de", "pointe": True}).json()
    assert dit["mot"] == "vient de"
    assert dit["pointe"] is True

    # `None` ne touche pas — sans quoi corriger un mot retirerait la pointe.
    garde = client.put(adresse, json={"mot": "dérive de"}).json()
    assert garde["mot"] == "dérive de"
    assert garde["pointe"] is True

    muet = client.put(adresse, json={"mot": "", "pointe": False}).json()
    assert muet["mot"] == ""
    assert muet["pointe"] is False


def test_un_mot_trop_long_est_refuse_en_disant_sa_borne(client):
    """L'étiquette se pose au milieu d'un trait, entre deux objets qui peuvent
    être à trente pixels l'un de l'autre : ce qui déborde recouvre ce qu'il
    relie. Au-delà, ce qu'on veut écrire est une note — et le produit a
    désormais l'endroit où le dire."""
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")
    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))
    adresse = f"/api/board/links/{lien['identifiant']}"

    refus = client.put(adresse, json={"mot": "x" * (MOT_MAX + 1)})
    assert refus.status_code == 409, refus.text
    assert str(MOT_MAX) in refus.json()["raison"]

    assert client.put(adresse, json={"mot": "x" * MOT_MAX}).status_code == 200


# ── « Supprimer une carte fait disparaître les liens qui y aboutissaient » ────


def test_supprimer_une_carte_emporte_ses_liens_et_n_en_laisse_rien(client, atelier):
    """« Sans laisser de trait orphelin **ni d'entrée morte sur le disque**. »

    Les deux moitiés se vérifient séparément, et la seconde est celle qu'on
    oublie : un lien retiré de la réponse mais gardé dans un fichier serait une
    deuxième vérité qui attend son heure — elle ressortirait à la première
    relecture du tableau.
    """
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")
    tierce = _coller(client, "tierce.png")
    _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))
    survivant = _lier(
        client, _carte(autre["identifiant"]), _carte(tierce["identifiant"])
    )

    assert client.delete(f"/api/board/{une['identifiant']}").status_code == 200

    restants = _toile(client)["liens"]
    assert [un["identifiant"] for un in restants] == [survivant["identifiant"]]

    # Et sur le disque, pas seulement dans la réponse.
    sur_disque = list(atelier.fichiers.parcourir_liens("bac-a-sable"))
    assert [un["identifiant"] for un in sur_disque] == [survivant["identifiant"]]


def test_le_dernier_membre_qui_sort_emporte_l_ilot_son_lien_et_sa_teinte(client):
    """**Un îlot n'a pas d'existence propre, donc rien ne lui survit.**

    C'est la contrepartie assumée de « l'îlot *est* le groupe » (`ARCHITECTURE.md`
    §5), et elle porte sur les deux choses que T9 ajoute : le trait qui y
    aboutissait, et la teinte qu'on lui avait donnée. Le geste qui vide le groupe
    les emporte — jamais un balayage, qui laisserait exister entre deux passages
    l'état que la tranche interdit.
    """
    membre = _classer(client, "membre.png", "marais", [0, 0])
    note = _note(client, "à revoir", position=[400, 0])
    _lier(client, _carte(note["identifiant"]), _ilot("marais"))
    assert client.put(
        "/api/board/groups/tint", json={"groupe": "marais", "teinte": "lichen"}
    ).status_code == 200
    assert _toile(client)["teintes"] == {"marais": "lichen"}

    # La seule carte du groupe en sort : l'îlot cesse d'exister.
    _regler(client, membre["identifiant"], groupe="")

    apres = _toile(client)
    assert apres["groupes"] == []
    assert apres["liens"] == [], "un trait vers rien ne représente rien"
    assert apres["teintes"] == {}, "une teinte sans îlot ne teint plus rien"


def test_un_lien_entre_deux_cartes_survit_a_un_declassement(client):
    """La réciproque, et c'est elle qui prouve que l'élagage vise juste.

    Sortir une carte de son îlot ne coupe **pas** ce qui la joint à une autre
    carte : c'est l'objet qui porte le lien, pas son rangement. Un élagage écrit
    trop large aurait passé ce fichier en coupant tout au premier glissement.
    """
    une = _classer(client, "une.png", "marais", [0, 0])
    autre = _classer(client, "autre.png", "nord", [400, 0])
    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))

    _regler(client, une["identifiant"], groupe="", position=[10, 300])

    restants = _toile(client)["liens"]
    assert [un["identifiant"] for un in restants] == [lien["identifiant"]]


def test_couper_un_lien_le_retire_du_disque(client, atelier):
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")
    lien = _lier(client, _carte(une["identifiant"]), _carte(autre["identifiant"]))

    assert client.delete(f"/api/board/links/{lien['identifiant']}").status_code == 200
    assert _toile(client)["liens"] == []
    assert list(atelier.fichiers.parcourir_liens("bac-a-sable")) == []

    # Et couper deux fois n'invente pas un lien pour le refuser : il n'est plus là.
    assert client.delete(f"/api/board/links/{lien['identifiant']}").status_code == 404


# ── « Une note se crée directement sur la toile, et c'est une carte texte » ───


def test_une_note_naît_posee_et_reste_une_carte_du_tableau(client):
    """« On la retrouve dans la grille » — parce qu'elle n'est rien d'autre.

    **Un seul appel dit le texte et la place** : créer puis déplacer aurait fait
    paraître la note en réserve, à l'autre bout de l'écran de l'endroit qu'on
    vient de désigner, et rendu possible l'état où elle existe sans avoir jamais
    été posée.
    """
    note = _note(client, "trois pierres, pas quatre", position=[120, -40])

    assert note["genre"] == "texte"
    assert note["position"] == [120, -40]
    assert note["en_reserve"] is False, "posée, donc sur la toile"
    assert note["groupe"] == "", "une note commente ce qui l'entoure, elle n'y adhère pas"

    # Et la grille la montre, comme toute carte du tableau.
    cartes = _toile(client)["cartes"]
    assert [c["identifiant"] for c in cartes] == [note["identifiant"]]


def test_une_note_collee_sans_place_attend_en_reserve(client):
    """Le geste de T4 n'a pas changé : coller un texte fait une carte à classer.
    T9 ajoute une place à la naissance, il ne la rend pas obligatoire."""
    note = _note(client, "une intention")
    assert note["position"] is None
    assert note["groupe"] == ""
    assert note["en_reserve"] is True


def test_une_note_naît_dans_l_ilot_ou_on_l_a_posee(client):
    """**La règle du plan vaut à la naissance comme au relâchement.**

    Tout ce qui atterrit sur la toile écrit son groupe — c'est « composer et
    classer sont le même geste », instauré en T8. Une note posée au milieu d'un
    îlot sans en être membre, puis qui le devient au premier pixel de
    déplacement, aurait fait deux réponses à la même question à un pixel
    d'écart.
    """
    _classer(client, "membre.png", "marais", [0, 0])
    note = _note(client, "l'eau est plus froide ici", position=[40, 40], groupe="marais")

    assert note["groupe"] == "marais"
    assert note["en_reserve"] is False
    # Et l'îlot peut donc la porter comme extrémité, tout de suite.
    assert _lier(client, _carte(note["identifiant"]), _ilot("marais"))


def test_une_note_se_corrige_en_place_et_une_image_n_a_pas_de_texte(client):
    """**Le trou datait de T4, et c'est T9 qui l'ouvre.**

    Sans lui, réparer une faute demanderait de retirer la note et de la
    recoller — donc de perdre sa place, sa teinte et les liens qui y
    aboutissent, c'est-à-dire tout ce que cette tranche vient d'ajouter.
    """
    note = _note(client, "trois pierres, pas quatres", position=[10, 10])
    avant = note["empreinte"]

    corrigee = _regler(client, note["identifiant"], texte="trois pierres, pas quatre")
    assert corrigee["texte"] == "trois pierres, pas quatre"
    assert corrigee["position"] == [10, 10], "corriger ne déplace pas"
    # L'empreinte suit le texte : elle dit « tu as déjà celle-ci », et une
    # empreinte qui ne suit plus son contenu est une seconde vérité.
    assert corrigee["empreinte"] != avant

    vide = client.put(f"/api/board/{note['identifiant']}", json={"texte": "   "})
    assert vide.status_code == 409

    carte = _coller(client)
    refus = client.put(f"/api/board/{carte['identifiant']}", json={"texte": "hop"})
    assert refus.status_code == 409, refus.text
    assert "note" in refus.json()["raison"]


def test_un_lien_se_repose_tel_qu_il_etait(client):
    """Ce dont l'annulation d'une coupe a besoin, et elle seule.

    « Il naît muet » reste vrai — c'est une règle de l'écran, qui n'envoie
    jamais ces deux champs en tirant un trait. Mais défaire une coupe, c'est
    reposer le lien **tel qu'il était** : une route qui ne saurait reposer qu'un
    trait nu forcerait l'annulation à passer par un second appel, donc par un
    état où le geste est à moitié défait.
    """
    une = _coller(client, "une.png")
    autre = _coller(client, "autre.png")

    repose = client.post(
        "/api/board/links",
        json={
            "de": _carte(une["identifiant"]),
            "vers": _carte(autre["identifiant"]),
            "mot": "dérive de",
            "pointe": True,
        },
    )
    assert repose.status_code == 201, repose.text
    assert repose.json()["mot"] == "dérive de"
    assert repose.json()["pointe"] is True

    # Et la borne du mot vaut par ce chemin-là aussi : une seconde écriture de
    # la règle serait celle qui finirait par être fausse.
    #
    # **Sur une paire neuve, et c'est le point.** Reprendre les deux mêmes
    # cartes dans l'autre sens aurait bien rendu 409 — mais pour « ces deux-là
    # sont déjà joints », qui est un refus *antérieur* à la lecture du mot :
    # l'assertion aurait passé même si la borne n'existait pas. Un essai qui ne
    # peut pas échouer pour la raison qu'il annonce ne prouve rien.
    troisieme = _coller(client, "troisieme.png")
    trop = client.post(
        "/api/board/links",
        json={
            "de": _carte(une["identifiant"]),
            "vers": _carte(troisieme["identifiant"]),
            "mot": "x" * (MOT_MAX + 1),
        },
    )
    assert trop.status_code == 409, trop.text
    assert str(MOT_MAX) in trop.json()["raison"], trop.text
    # Et le lien n'a pas été posé : un refus refuse le geste entier.
    assert len(_toile(client)["liens"]) == 1


# ── « Les six teintes sont les seules disponibles » ──────────────────────────


def test_les_six_teintes_sont_les_seules_acceptees(client):
    """La liste est **fermée**, et il n'existe aucun sélecteur libre : le premier
    îlot rouge vif se lirait comme un échec (`docs/DESIGN.md`)."""
    _classer(client, "membre.png", "marais", [0, 0])

    for teinte in TEINTES:
        pose = client.put(
            "/api/board/groups/tint", json={"groupe": "marais", "teinte": teinte}
        )
        assert pose.status_code == 200, pose.text
        assert pose.json()["teintes"]["marais"] == teinte

    for refusee in ("#ff0000", "rouge", "ardoise-clair"):
        refus = client.put(
            "/api/board/groups/tint", json={"groupe": "marais", "teinte": refusee}
        )
        assert refus.status_code == 422, refus.text


def test_retirer_la_teinte_d_un_ilot_est_un_geste(client):
    """Le vide efface l'entrée au lieu de la mettre à « rien » : un îlot sans
    teinte porte celle du châssis, et une entrée qui dirait « aucune » serait un
    réglage posé qui ne règle rien."""
    _classer(client, "membre.png", "marais", [0, 0])
    client.put("/api/board/groups/tint", json={"groupe": "marais", "teinte": "iris"})

    rendu = client.put("/api/board/groups/tint", json={"groupe": "marais", "teinte": ""})
    assert rendu.status_code == 200
    assert rendu.json()["teintes"] == {}


def test_un_ilot_qui_n_existe_pas_ne_se_teinte_pas(client):
    """Accepter écrirait une entrée que rien ne pourrait jamais montrer, et que
    rien ne viendrait jamais effacer — la définition d'une entrée morte."""
    _coller(client)
    refus = client.put("/api/board/groups/tint", json={"groupe": "atlantide", "teinte": "iris"})
    assert refus.status_code == 409, refus.text
    assert "atlantide" in refus.json()["raison"]


def test_une_note_porte_sa_teinte_et_une_carte_image_n_en_porte_aucune(client):
    """« Une carte image ne porte aucune couleur d'organisation » — critère
    d'acceptation, et le refus vient du serveur.

    Colorier chaque carte reconstruirait un second rangement, invisible dans la
    grille et concurrent du groupe : très exactement ce que T8 a écarté en
    faisant de l'îlot le groupe lui-même. Une règle que seule l'interface
    tiendrait serait fausse au premier appel qui ne vient pas d'elle.
    """
    note = _note(client, "une intention")
    teintee = _regler(client, note["identifiant"], teinte="prune")
    assert teintee["teinte"] == "prune"
    assert _regler(client, note["identifiant"], teinte="")["teinte"] == ""

    image_carte = _coller(client)
    refus = client.put(
        f"/api/board/{image_carte['identifiant']}", json={"teinte": "prune"}
    )
    assert refus.status_code == 409, refus.text
    assert "note" in refus.json()["raison"]


# ── « Rouvrir rend la toile telle qu'elle a été laissée » ────────────────────


def test_les_liens_et_les_teintes_se_relisent_du_disque_apres_l_index_efface(
    client, atelier
):
    """**Les fichiers font foi, et les liens n'entrent jamais dans l'index.**

    On efface la base et on reconstruit : ce qui revient est ce que les fichiers
    portent. Les liens ne s'y sont jamais rangés — ils ne se cherchent pas, ne se
    filtrent pas, ne se paginent pas —, donc jeter `atelier.sqlite3` ne peut pas
    les perdre. La teinte, elle, revient du `projet.json`.
    """
    une = _classer(client, "une.png", "marais", [0, 0])
    note = _note(client, "l'eau est plus froide ici", position=[300, 40], teinte="ardoise")
    lien = _lier(client, _carte(note["identifiant"]), _ilot("marais"))
    client.put("/api/board/links/" + lien["identifiant"], json={"mot": "à propos de", "pointe": True})
    client.put("/api/board/groups/tint", json={"groupe": "marais", "teinte": "lichen"})

    atelier.base.vider()
    assert client.post("/api/library/rebuild").status_code == 200

    toile = _toile(client)
    assert toile["teintes"] == {"marais": "lichen"}
    relu = toile["liens"][0]
    assert relu["identifiant"] == lien["identifiant"]
    assert relu["mot"] == "à propos de"
    assert relu["pointe"] is True
    assert relu["vers"] == {"genre": "ilot", "valeur": "marais"}
    assert next(c for c in toile["cartes"] if c["identifiant"] == note["identifiant"])[
        "teinte"
    ] == "ardoise"
    assert une["identifiant"] in {c["identifiant"] for c in toile["cartes"]}


@pytest.mark.parametrize(
    "abime",
    [
        {"identifiant": "casse", "de": {"genre": "carte"}, "vers": {"genre": "ilot", "valeur": "n"}},
        {"identifiant": "casse", "de": None, "vers": None},
        {"identifiant": "casse"},
    ],
)
def test_un_fichier_de_lien_abime_ne_fait_pas_tomber_la_toile(client, atelier, abime):
    """**Un lien illisible est un lien sans extrémité, donc un lien qui doit
    disparaître** — et c'est déjà la règle de la tranche.

    Le traiter comme absent est le traiter juste, et ça évite qu'un fichier
    abîmé emporte la lecture de toute la toile. Même famille que la place d'une
    carte relue de T8 : une carte mal placée se replace d'un geste, un tableau
    qui ne s'ouvre plus ne se répare pas.
    """
    _coller(client)
    atelier.fichiers.ecrire_lien("bac-a-sable", "casse", abime)

    toile = _toile(client)
    assert toile["liens"] == []
    assert len(toile["cartes"]) == 1


# ── « Réseau coupé : tout de cette tranche fonctionne » ──────────────────────


def test_reseau_coupe_lier_nommer_couper_et_teinter_fonctionnent(client, double):
    """Prouvé plutôt qu'affirmé, en comptant les appels du double.

    Toute la tranche est du dire : rien n'y sort, rien n'y coûte. Le fournisseur
    ne doit pas être touché une seule fois — pas même par le recalcul de palette,
    qu'aucun de ces gestes ne déclenche.
    """
    une = _classer(client, "une.png", "marais", [0, 0])
    double.catalogue_lisible = False
    appels = double.appels

    note = _note(client, "trois pierres", position=[300, 0], teinte="paille")
    lien = _lier(client, _carte(note["identifiant"]), _ilot("marais"))
    client.put(f"/api/board/links/{lien['identifiant']}", json={"mot": "vient de", "pointe": True})
    client.put("/api/board/groups/tint", json={"groupe": "marais", "teinte": "bruyere"})
    client.delete(f"/api/board/links/{lien['identifiant']}")
    client.delete(f"/api/board/{une['identifiant']}")

    toile = _toile(client)
    assert toile["liens"] == []
    assert toile["teintes"] == {}, "le dernier membre parti, la teinte avec"

    assert double.appels == appels, "dire n'a demandé le fournisseur pour rien"
