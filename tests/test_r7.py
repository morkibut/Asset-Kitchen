# -*- coding: utf-8 -*-
"""Les critères de R7 — le texte qui part se lit en trois parties.

**Ce qui se mesure ici** : que le texte envoyé au fournisseur se range sous
trois titres nommés, que chaque image jointe soit annoncée pour ce qu'elle est
et numérotée dans l'ordre où les octets partent, que ce qui est montré reste
exactement ce qui part, qu'une génération enregistrée avant la tranche se relise
sans rien perdre, et surtout — c'est le critère qui tient tous les autres —
qu'**aucun mot du fond de la demande n'ait été ajouté ni retiré**. Ce que
l'écran en montre vit dans `interface/src/App.test.tsx`.

**Cette tranche a été mesurée avant d'être construite, et elle n'a rien
donné.** Cinq variantes tirées le 2 septembre 2026, à images égales et témoin
neuf : le pavé d'alors a fait deux bonnes planches sur quatre, les trois titres
posés dessus zéro sur quatre, les références nommées zéro sur quatre. Elle est
reprise **pour la relisibilité seule**, décidée par l'auteur le 3 septembre 2026
en connaissance de ce chiffre. Aucun essai d'ici ne prétend donc mesurer une
qualité d'image : ils mesurent qu'on range sans réécrire.

**Le seul point de mécanique qui compte** : le rang d'une image est celui de
l'envoi, et il se calcule à un seul endroit — `_roles_qui_partent`. Un second
endroit décalerait la numérotation d'un rang et nommerait chaque image par le
rôle de sa voisine, ce qui est pire que de les envoyer muettes.
"""

from __future__ import annotations

import re

from atelier.domaine.envoi import (
    CONTEXTE,
    DEMANDE,
    DE_LA_PARTIE,
    GROUPES,
    REFERENCES,
    TITRE,
    clef,
    joindre,
    parties,
)

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"

# Le motif d'une ligne de nommage, tel que le banc l'a tiré.
NOMMAGE = re.compile(r"^Image (\d+) — ([A-Z][A-Z ]+)")


# ── Les échafaudages ─────────────────────────────────────────────────────────


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


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _carte(client, nom: str) -> dict:
    reponse = client.post(
        "/api/board/paste",
        params={"nom": nom, "forcer": True},
        content=image_sujet(toile=24, bloc=2),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _artwork(client, nom: str) -> dict:
    """Une carte promue **artwork officiel du jeu** — c'est ce qui la fait
    partir avec les appels, en rôle de style."""
    carte = _carte(client, nom)
    promue = client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert promue.status_code == 200, promue.text
    return carte


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _partie(envoi: dict, clef_: str) -> dict:
    return next(p for p in envoi["parties"] if p["clef"] == clef_)


def _mots(texte: str) -> list[str]:
    return texte.split()


# ── « Le texte qui part est rangé en trois parties nommées » ─────────────────


def test_le_texte_se_range_sous_trois_titres_dans_cet_ordre(client):
    """Le contexte, les références, la demande — et les titres partent en
    anglais, comme les intitulés de la bible."""
    _bible(client, monde="marais de fer")
    envoi = _envoi(client)

    assert envoi["texte"].startswith("CONTEXT\n\n")
    assert "REQUEST\n\n" in envoi["texte"]
    assert envoi["texte"].index("CONTEXT") < envoi["texte"].index("REQUEST")
    assert [p["clef"] for p in envoi["parties"]] == [CONTEXTE, REFERENCES, DEMANDE]
    assert [TITRE[p["clef"]] for p in envoi["parties"]] == [
        "CONTEXT",
        "REFERENCES",
        "REQUEST",
    ]


def test_le_texte_entier_est_la_jonction_de_ses_parties(client):
    """**Recoller les parties rend le texte, titre compris** — et rien d'autre
    ne s'ajoute entre elles.

    C'est la forme mécanique de « ce qui est montré est ce qui part » : l'écran
    affiche les parties, le fournisseur reçoit la jonction, et il n'y a pas
    d'endroit où glisser un mot de plus.
    """
    _bible(client, monde="marais de fer", trait="contour brun")
    envoi = _envoi(client, prompt="un nain forgeron")

    assert envoi["texte"] == "\n\n".join(
        f"{p['titre']}\n\n{p['texte']}"
        for p in envoi["parties"]
        if p["texte"].strip()
    )


def test_une_partie_vide_ne_part_pas_mais_reste_rendue(client):
    """**Un titre au-dessus de rien serait un mensonge au modèle** — `REFERENCES`
    posé sans image lui annoncerait des images qui ne partent pas.

    Elle est rendue quand même, avec un texte vide : l'écran range des *lignes*,
    et une ligne éteinte reste à sa place, barrée. Si la partie disparaissait de
    la liste, éteindre la dernière ligne d'une partie ferait disparaître la
    ligne avec elle — et on ne pourrait plus la rallumer.
    """
    envoi = _envoi(client)

    assert _partie(envoi, REFERENCES)["texte"] == ""
    assert "REFERENCES" not in envoi["texte"]
    assert [p["clef"] for p in envoi["parties"]] == [CONTEXTE, REFERENCES, DEMANDE]


def test_chaque_groupe_de_lignes_sait_dans_quelle_partie_il_atterrit(client):
    """Le sommaire de l'écran range ses six groupes sous trois titres, et c'est
    le serveur qui le lui dit — une seconde table à l'écran finirait par ranger
    la caméra ailleurs que le texte ne la met."""
    _bible(client, monde="marais de fer")
    envoi = _envoi(client)

    for groupe in envoi["groupes"]:
        if groupe["clef"] in ("images", "options"):
            # Les deux groupes qui ne sont pas du texte n'ont pas de partie.
            assert "partie" not in groupe
            continue
        assert groupe["partie"] == DE_LA_PARTIE[groupe["clef"]]

    # Et la table couvre tous les groupes de texte, sans exception : un groupe
    # neuf sans partie tomberait de l'écran en silence.
    assert set(DE_LA_PARTIE) == set(GROUPES) - {"images", "options"}


# ── « La caméra ferme toujours le texte » ────────────────────────────────────


def test_la_camera_reste_la_derniere_phrase_du_texte(client):
    """**Le rangement ne l'a pas déplacée**, et c'est ce qui rendait la tranche
    faisable.

    Un banc payé — `essais/essai_vue.py`, trente images — a établi que le
    rapport hauteur/largeur du sujet passe de 1,55 à 1,13 quand la caméra ferme
    le texte. Elle appartient à *la demande*, qui est la troisième partie, et
    elle en est la dernière ligne.
    """
    _bible(client, monde="marais de fer")
    # Un jeu qui n'a pas déclaré de vue ne contraint aucune caméra, et la phrase
    # ne part pas : il faut donc une vue pour que cet essai ait un sujet.
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    envoi = _envoi(client)

    texte = envoi["texte"]
    assert "CAMERA —" in texte
    # Rien après elle que sa propre phrase : elle ferme le texte.
    assert texte.rstrip().split("CAMERA —")[-1].count("\n\n") == 0
    assert _partie(envoi, DEMANDE)["texte"].rstrip().splitlines()[-1].startswith(
        "CAMERA —"
    )


# ── « Chaque image jointe est annoncée pour ce qu'elle est » ─────────────────


def test_chaque_image_jointe_a_sa_ligne_numerotee(client):
    """Une ligne par image, dans l'ordre d'envoi, et son rôle en toutes lettres.

    **Le sac devient une liste.** Le produit écrivait « une ou plusieurs images
    de référence sont jointes » — une phrase par *sorte*, jamais par image. Un
    artwork de style et un sprite de pose partaient donc dans le même sac, sans
    qu'une ligne dise lequel est lequel.
    """
    _bible(client, monde="marais de fer")
    _artwork(client, "artwork.png")
    _artwork(client, "second.png")

    envoi = _envoi(client)
    lignes = _partie(envoi, REFERENCES)["texte"].splitlines()

    assert len(lignes) == 2
    rangs = [int(NOMMAGE.match(l).group(1)) for l in lignes]
    assert rangs == [1, 2]
    assert all("STYLE REFERENCE" in l for l in lignes)


def test_le_numero_dune_image_est_le_meme_dans_le_texte_et_sur_sa_ligne(client):
    """**Sinon on lit un texte qui parle d'images et on regarde une liste qui ne
    les numérote pas.** Le rang vient du serveur, calculé sur ce qui part."""
    _bible(client, monde="marais de fer")
    _artwork(client, "artwork.png")

    envoi = _envoi(client)
    dans_le_texte = [
        int(NOMMAGE.match(l).group(1))
        for l in _partie(envoi, REFERENCES)["texte"].splitlines()
    ]
    sur_les_lignes = [
        i["rang"] for i in envoi["images"]["lignes"] if i["rang"] is not None
    ]

    assert dans_le_texte == sur_les_lignes == [1]


def test_une_image_decochee_na_de_numero_nulle_part(client):
    """Elle ne part pas : elle n'a pas de ligne dans le texte, et pas de numéro
    sur sa ligne. Une image annoncée qui ne partirait pas serait un mensonge que
    le modèle ne peut pas vérifier."""
    _bible(client, monde="marais de fer")
    carte = _artwork(client, "artwork.png")
    _artwork(client, "autre.png")

    envoi = _envoi(client, references_ecartees=[carte["identifiant"]])

    assert _partie(envoi, REFERENCES)["texte"].count("Image ") == 1
    ecartee = next(
        i for i in envoi["images"]["lignes"] if i["asset"] == carte["identifiant"]
    )
    assert ecartee["cochee"] is False
    assert ecartee["rang"] is None


def test_le_gabarit_dune_planche_est_nomme_et_numerote(client):
    """**Il partait muet**, et c'est le défaut le plus cher du dépôt : le modèle
    recevait une grille vide sans qu'une ligne dise que c'en était une, et *ce
    qu'on montre à un modèle, il le copie en entier*."""
    _bible(client, monde="marais de fer")
    personnage = _creer(client)
    poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]

    envoi = _envoi(client, personnage=personnage["identifiant"], poses=poses[:3])
    references = _partie(envoi, REFERENCES)["texte"]

    assert "EMPTY LAYOUT GRID: 3 cells" in references
    rang = int(NOMMAGE.match(references.splitlines()[-1]).group(1))
    assert rang == envoi["images"]["rang_gabarit"]


def test_la_bande_de_couleurs_nest_annoncee_que_si_elle_part(client):
    """**Une entorse à E14 réparée en passant.** Le texte annonçait « une image
    jointe est une bande de couleurs » dès que la case était cochée, alors qu'un
    jeu sans palette n'en envoie aucune. On annonçait au modèle une image qu'il
    ne recevait pas.
    """
    _bible(client, monde="marais de fer")
    envoi = _envoi(client, tri={"eteints": [], "allumes": ["options.palette"], "textes": {}})

    # Le jeu de cet essai n'a pas de couleurs : rien ne part, rien n'est annoncé.
    assert "PALETTE STRIP" not in envoi["texte"]
    assert envoi["images"]["rang_palette"] is None


# ── « On range, on ne réécrit pas » ──────────────────────────────────────────


def test_aucun_mot_du_fond_nest_ajoute_ni_retire(client):
    """**Le critère qui tient tous les autres**, compté sur les mots.

    Ce qui a le droit d'entrer : les trois titres, et les lignes de nommage des
    images. Tout le reste doit se retrouver mot pour mot, au déplacement près —
    un mot qui sort ici et rentre là est un déplacement, pas un écart.

    Compté avec l'outil du banc, celui qui refusait de tirer si ce n'était pas
    vrai : `essais/socle_essais.py`, `ecarts_du_rangement`.
    """
    from essais.socle_essais import ecarts_du_rangement

    _bible(client, monde="marais de fer", trait="contour brun d'un pixel")
    _artwork(client, "artwork.png")

    range_ = _envoi(client, prompt="un nain forgeron")["texte"]
    # Le témoin : le même envoi, mais recollé sans titres ni nommage — c'est le
    # texte que le produit écrivait avant la tranche, aux phrases génériques
    # près, qui ne sont plus là.
    temoin = "\n\n".join(
        p["texte"]
        for p in _envoi(client, prompt="un nain forgeron")["parties"]
        if p["clef"] != REFERENCES and p["texte"].strip()
    )
    autorisees = list(TITRE.values()) + [
        p["texte"]
        for p in _envoi(client, prompt="un nain forgeron")["parties"]
        if p["clef"] == REFERENCES
    ]

    assert ecarts_du_rangement(temoin, range_, autorisees) == []


def test_ranger_ne_change_pas_le_nombre_de_mots_du_sujet(client):
    """Le sujet est celui qu'on a écrit, et il reste entier dans *la demande*."""
    _bible(client, monde="marais de fer")
    envoi = _envoi(client, prompt="un nain forgeron barbu, tablier de cuir")

    assert "un nain forgeron barbu, tablier de cuir" in _partie(envoi, DEMANDE)["texte"]
    assert _mots("un nain forgeron barbu, tablier de cuir") == _mots(
        _partie(envoi, DEMANDE)["texte"].splitlines()[0]
    )


def test_un_texte_repris_a_la_main_ne_recoit_aucun_titre():
    """**Il part mot pour mot** (US-159), et poser `CONTEXT` au-dessus de ce que
    quelqu'un a écrit lui-même serait ajouter un mot à un texte dont toute la
    promesse est qu'aucun n'y sera ajouté."""
    repris = [
        {
            "clef": clef("sujet", "repris"),
            "groupe": "sujet",
            "nom": "ton texte",
            "texte": "a plain wooden barrel, painterly",
            "origine": "ton texte",
            "allumee": True,
        }
    ]

    assert joindre(repris) == "a plain wooden barrel, painterly"
    rendues = parties(repris)
    assert len(rendues) == 1
    assert rendues[0]["titre"] == ""
    assert rendues[0]["repris"] is True


# ── « Ce qui est montré reste exactement ce qui part » ───────────────────────


def test_le_texte_montre_est_celui_qui_part(client, double):
    """**Le seul juge acceptable** : ce que l'écran montrait, et ce que le
    fournisseur a reçu — caractère pour caractère, titres compris.

    C'est l'invariant d'E14, et R7 ne l'a pas amendé : il l'a seulement rendu
    plus difficile à tenir, puisque le texte porte maintenant des titres et des
    numéros d'images qui doivent tomber juste.
    """
    _bible(client, monde="marais de fer")
    _artwork(client, "artwork.png")

    montre = _envoi(client, prompt="un nain forgeron")["texte"]
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un nain forgeron"}
    )
    assert reponse.status_code == 202, reponse.text
    _attendre(client, reponse.json()["identifiant"])

    assert double.demandes[-1].prompt == montre


def test_une_generation_davant_la_tranche_se_relit_sans_rien_perdre(client, double):
    """**Le texte enregistré ne se recompose jamais.** Une génération écrite
    avant R7 porte un prompt à plat ; le relire doit rendre ce texte-là, et non
    un texte rangé après coup — sans quoi la relance enverrait autre chose que
    ce qui avait été payé.
    """
    _bible(client, monde="marais de fer")
    reponse = client.post(
        "/api/generations", json={"modele": MODELE, "prompt": "un nain"}
    )
    assert reponse.status_code == 202, reponse.text
    vue = _attendre(client, reponse.json()["identifiant"])

    relue = client.get(f"/api/generations/{vue['identifiant']}").json()
    assert relue["demande"]["prompt"] == double.demandes[-1].prompt
    # Et le sujet est enregistré à part : c'est lui que les listes affichent, et
    # c'est ce qui les empêche de commencer toutes par le même mot.
    assert relue["demande"]["sujet"] == "un nain"


def _attendre(client, identifiant: str) -> dict:
    import time

    for _ in range(600):
        vue = client.get(f"/api/generations/{identifiant}").json()
        if vue["statut"] in ("reussie", "echouee", "interrompue"):
            return vue
        time.sleep(0.01)
    raise AssertionError(f"« {identifiant} » n'est jamais arrivée à terme")


# ── Le rang, calculé à un seul endroit ───────────────────────────────────────


def test_le_rang_des_images_est_celui_de_lenvoi(atelier):
    """**Un seul endroit écrit cette liste**, et c'est ce qui empêche la
    numérotation de dériver : `_roles_qui_partent` sert la soumission comme
    l'aperçu, gabarit et bande de couleurs compris."""
    from atelier.domaine.generation import GABARIT, PALETTE, Reinjection, STYLE

    service = atelier.generations
    partantes = (
        Reinjection(asset="a", role=STYLE),
        Reinjection(asset="b", role=STYLE),
    )

    # **Le rang et le rôle voyagent à côté du texte depuis M4** : l'écran de
    # confirmation pose sous chaque image le morceau de légende qui la concerne,
    # et recouper le bloc à l'affichage aurait été une seconde numérotation.
    nommees = service._nommer_les_images((STYLE, STYLE, GABARIT, PALETTE), 4)
    lignes = [texte for _, _, texte in nommees]

    assert [rang for rang, _, _ in nommees] == [1, 2, 3, 4]
    assert [int(NOMMAGE.match(l).group(1)) for l in lignes] == [1, 2, 3, 4]
    assert "EMPTY LAYOUT GRID: 4 cells" in lignes[2]
    assert "PALETTE STRIP" in lignes[3]
    assert len(partantes) == 2  # la liste d'entrée n'est pas touchée


def test_les_lignes_de_nommage_sont_mot_pour_mot_celles_du_banc(atelier):
    """**Le produit envoie ce qui a été mesuré, pas une variante voisine.**

    Les lignes ont été tirées le 2 septembre 2026 par `essais/essai_references_nommees.py`
    et elles vivent dans son socle. Le produit les a recopiées plutôt
    qu'importées — un essai qui importerait un service pour lire quatre phrases
    ferait entrer tout l'atelier dans un script qui n'en veut pas. Recopier, en
    revanche, se paie d'une divergence silencieuse : cet essai est le prix, et
    il est bon marché.
    """
    from essais.socle_essais import lignes_de_nommage

    roles = ("style", "reference", "gabarit", "palette")

    # **Huit cases, et c'est ce qui permet la comparaison mot pour mot.** Le
    # banc ne connaît pas l'accord que `M4` a posé sur ces nombres — il n'a
    # jamais tiré de planche d'une seule case —, et *8 cells* s'écrit pareil des
    # deux côtés. La comparaison porte donc sur ce qu'elle a toujours porté : la
    # phrase, pas la grammaire du nombre.
    nommees = atelier.generations._nommer_les_images(roles, 8)

    assert [texte for _, _, texte in nommees] == lignes_de_nommage(roles, 8)


def test_un_role_inconnu_refuse_plutot_que_de_nommer_faux(atelier):
    """Une image qu'on ne sait pas nommer ne doit pas partir sous un faux nom :
    mieux vaut un appel refusé qu'un modèle à qui l'on dit que le gabarit est le
    personnage."""
    import pytest

    from atelier.domaine.erreurs import ErreurAtelier

    with pytest.raises(ErreurAtelier):
        atelier.generations._nommer_les_images(("un-role-qui-nexiste-pas",), 0)
