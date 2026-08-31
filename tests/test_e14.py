# -*- coding: utf-8 -*-
"""Les critères de E14 qui vivent côté serveur — l'écran de confirmation.

**Ce qui se mesure ici** : que chaque texte et chaque image qui part ait sa
propre ligne avec son interrupteur, qu'une ligne éteinte ne parte pas et que
l'extinction ne remonte nulle part, qu'une correction ne vaille que pour cet
appel, que le sujet et la pose ne puissent pas s'éteindre, que chaque image porte
son prix, que le texte montré vienne du même chemin que l'envoi, qu'un
avertissement s'écrive sur la ligne fautive avec des chiffres, que ce qui agit au
retour se distingue de ce qui part, et que ce qui a été pris de l'ambiance reste
attaché à la génération. Ce que l'écran montre — les cinq groupes, les carrés
gris, la case qui saute l'écran pour la série — vit dans
`interface/src/App.test.tsx`.

**La panne que ça répare est mesurée sur le vrai projet, le 30 août 2026** —
`essais/essai_ce_qui_part.py`, gratuit, il relit la base. Sur les vingt-quatre
générations payées du dépôt : dix ne portaient **ni** texte de style **ni** image
de référence ; quinze ne nommaient pas leur sujet ; et sur le plus long appel
payé, le style pesait **890 caractères sur 1 690** contre **40** pour le sujet.
Aucun de ces appels n'a été refusé — il n'y avait rien pour s'en apercevoir.

**Et deux textes de bible écrivent `64x64` pendant que le projet impose 128.**
Ça part depuis toujours : on demande une image en 64 et l'atelier ramène le
résultat sur une grille de 128. C'est l'avertissement sur la ligne fautive qui le
met sous les yeux, à l'endroit exact où l'on peut encore corriger.
"""

from __future__ import annotations

from atelier.domaine.envoi import Couches, Tri, clef, joindre, resoudre
from atelier.services.envoi import PALETTE
from atelier.services.prix import prix_de

from tests.conftest import image_sujet

MODELE = "essai/rend-du-png"


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _creer(client, nom: str = "Balthazar") -> dict:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]


def _regler(client, identifiant: str, **champs) -> dict:
    reponse = client.put(f"/api/characters/{identifiant}", json=champs)
    assert reponse.status_code == 200, reponse.text
    return reponse.json()["personnage"]


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


def _ambiance(client, nom: str, references: list[str] | None = None, **textes) -> dict:
    """Une ambiance, et ses textes — **deux appels, parce que ce sont deux
    questions** : ce qu'elle est, puis ce qu'elle dit."""
    reponse = client.post(
        "/api/moods", json={"nom": nom, "references": references or []}
    )
    assert reponse.status_code == 201, reponse.text
    creee = next(a for a in reponse.json()["ambiances"] if a["nom"] == nom)
    if not textes:
        return creee
    ecrite = client.put(f"/api/moods/{creee['identifiant']}", json=textes)
    assert ecrite.status_code == 200, ecrite.text
    return next(
        a for a in ecrite.json()["ambiances"] if a["identifiant"] == creee["identifiant"]
    )


def _carte(client, tmp_path, nom: str, **params) -> dict:
    """Une image dans le tableau d'inspiration — le geste principal de T4."""
    reponse = client.post(
        "/api/board/paste",
        params={"nom": nom, "forcer": True, **params},
        content=image_sujet(toile=24, bloc=2),
    )
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["carte"]


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un nain", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _ligne(envoi: dict, clef_: str) -> dict:
    return next(l for l in envoi["lignes"] if l["clef"] == clef_)


def _lancer(client, **corps) -> dict:
    """Payer pour de bon, par la route de tout le monde — **il n'y en a qu'une**.

    L'attente se fait par le client plutôt que par le service : celui-ci tourne
    dans la boucle du client HTTP, et l'attendre depuis celle de l'essai
    réveillerait une tâche accrochée à une autre boucle.
    """
    import time

    reponse = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "un nain", **corps},
    )
    assert reponse.status_code == 202, reponse.text
    identifiant = reponse.json()["identifiant"]
    for _ in range(60):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


# ── « Chaque texte et chaque image qui part occupe sa propre ligne » ──────────


def test_chaque_texte_qui_part_a_sa_ligne_et_son_interrupteur(client):
    """**Il ne montre pas un résumé.** Le bloc qu'il remplace était replié sous
    le champ et disait le texte assemblé, sans qu'on puisse rien y toucher : un
    résumé de ce qui pèse 53 % de l'appel n'est pas un résumé, c'est un angle
    mort."""
    _bible(client, monde="Deep forge halls", trait="1-pixel dark outline")
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"])

    du_jeu = [l for l in envoi["lignes"] if l["groupe"] == "jeu"]
    assert [l["nom"] for l in du_jeu] == ["monde", "trait"]
    assert all(l["eteignable"] for l in du_jeu)
    assert all(l["allumee"] for l in du_jeu)
    # Et le sujet est une ligne comme les autres, à ceci près qu'elle ne s'éteint
    # pas — c'est le critère suivant.
    assert _ligne(envoi, "sujet.sujet")["texte"] == "un nain"


def test_les_groupes_disent_ce_quils_pesent_sans_descendre_lecran(client):
    """« 4 sur 7 » se lit dans la colonne de gauche : on sait qu'il y a quelque
    chose d'éteint avant d'être descendu jusqu'à lui."""
    _bible(client, monde="Deep forge halls", trait="1-pixel dark outline")
    chose = _creer(client)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        tri={"eteints": [clef("jeu", "trait")]},
    )

    groupe = next(g for g in envoi["groupes"] if g["clef"] == "jeu")
    assert (groupe["allumees"], groupe["total"]) == (1, 2)


# ── « Une ligne éteinte ne part pas, et l'extinction ne remonte nulle part » ──


def test_une_ligne_eteinte_ne_part_pas(client):
    _bible(client, monde="Deep forge halls", trait="1-pixel dark outline")
    chose = _creer(client)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        tri={"eteints": [clef("jeu", "trait")]},
    )

    assert "Deep forge halls" in envoi["texte"]
    assert "1-pixel dark outline" not in envoi["texte"]
    assert _ligne(envoi, clef("jeu", "trait"))["allumee"] is False


def test_lextinction_ne_remonte_ni_dans_le_jeu_ni_dans_la_chose(client, double):
    """**La règle la plus importante de l'écran, et la plus facile à casser sans
    le vouloir.** Si chaque essai réécrivait le réglage, la dixième image d'un
    personnage serait fabriquée avec les réglages du neuvième essai, sans que
    personne l'ait décidé."""
    _bible(client, monde="Deep forge halls", trait="1-pixel dark outline")
    chose = _creer(client)
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
        tri={"eteints": [clef("jeu", "trait")]},
    )

    # Le prompt parti ne le porte pas…
    assert "1-pixel dark outline" not in double.demandes[-1].prompt
    # …et rien n'a bougé : ni la bible du jeu, ni la fiche de la chose.
    bible = client.get("/api/universe").json()["univers"]["bible"]
    assert next(c for c in bible if c["nom"] == "trait")["texte"] == (
        "1-pixel dark outline"
    )
    habillage = client.get(f"/api/characters/{chose['identifiant']}/style").json()
    assert next(c for c in habillage["champs"] if c["nom"] == "trait")["origine"] == "jeu"


# ── « Une correction vaut pour cet appel seulement » ──────────────────────────


def test_une_correction_part_et_ne_remonte_nulle_part(client, double):
    _bible(client, monde="Deep forge halls")
    chose = _creer(client)
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
        tri={"textes": {clef("jeu", "monde"): "Molten channels"}},
    )

    assert "Molten channels" in double.demandes[-1].prompt
    bible = client.get("/api/universe").json()["univers"]["bible"]
    assert next(c for c in bible if c["nom"] == "monde")["texte"] == "Deep forge halls"


def test_la_ligne_corrigee_le_dit_et_lecran_les_compte(client):
    """« On voit qu'on a divergé, et de combien » — le compte se lit sans
    descendre."""
    _bible(client, monde="Deep forge halls")
    chose = _creer(client)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        tri={"textes": {clef("jeu", "monde"): "Molten channels"}},
    )

    assert _ligne(envoi, clef("jeu", "monde"))["corrigee"] is True
    assert envoi["corrections"] == 1


def test_garder_est_un_second_geste_ecrit_et_le_produit_dit_ou(client):
    """**Garder est possible, mais c'est un second geste, jamais un effet de
    bord.** Les lignes qui ont une case où aller le disent ; celles qui n'en ont
    pas le disent aussi, plutôt que de proposer un geste sans destination."""
    _bible(client, monde="Deep forge halls")
    ambiance = _ambiance(client, "Forge des profondeurs", monde="Molten channels")
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])

    envoi = _envoi(client, personnage=chose["identifiant"])

    assert _ligne(envoi, clef("jeu", "monde"))["gardable"] is True
    # Le texte d'une ambiance sert plusieurs choses du jeu : le garder « sur
    # cette chose-là » n'aurait pas de case où aller.
    assert _ligne(envoi, clef("ambiance", "monde"))["gardable"] is False

    # Et le second geste, lui, écrit bien — par la fiche, pas par cet écran.
    _regler(client, chose["identifiant"], textes={"monde": "Molten channels"})
    apres = _envoi(client, personnage=chose["identifiant"])
    assert _ligne(apres, clef("jeu", "monde"))["origine"] == "de sa fiche"


def test_sans_chose_visee_aucune_ligne_ne_se_garde(client):
    """**La case où garder est la fiche de la chose visée.** Sans chose — un
    import, un agent, une image qu'on fabrique sans rien viser —, il n'y en a
    pas, et le produit ne propose pas un geste qui ne ferait rien une fois
    cliqué. La correction, elle, part quand même : ce qui manque est l'endroit
    où la garder, pas la correction."""
    _bible(client, monde="Deep forge halls")

    envoi = _envoi(client, prompt="un tonneau")

    assert _ligne(envoi, clef("jeu", "monde"))["gardable"] is False
    assert _ligne(envoi, clef("sujet", "sujet"))["gardable"] is False
    # Et la correction traverse : c'est un écart de cet appel, il n'a besoin
    # d'aucune case durable.
    corrige = _envoi(
        client,
        prompt="un tonneau",
        tri={"textes": {clef("jeu", "monde"): "Molten channels"}},
    )
    assert "Molten channels" in corrige["texte"]
    assert "Deep forge halls" not in corrige["texte"]


# ── « Le sujet et la pose demandée ne peuvent pas s'éteindre » ────────────────


def test_le_sujet_et_la_pose_ne_seteignent_pas_et_leur_marque_le_dit(client):
    """Sans le sujet, l'appel ne demande rien ; sans la pose, l'image qui revient
    n'appartient à aucune case. **Le carré n'est pas absent** — ce qui est
    indisponible se montre avec sa raison, il ne se cache pas."""
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    chose = _creer(client)

    envoi = _envoi(
        client, personnage=chose["identifiant"], pose="marche", direction="sud"
    )

    sujet = _ligne(envoi, clef("sujet", "sujet"))
    pose = _ligne(envoi, clef("sujet", "pose"))
    assert (sujet["eteignable"], pose["eteignable"]) == (False, False)
    assert "ne demande rien" in sujet["raison"]
    assert "se ranger" in pose["raison"]


def test_eteindre_le_sujet_ne_leteint_pas(client):
    """L'écran ne propose pas le geste ; le service refuse quand même de
    l'exécuter. Un interrupteur absent à l'écran n'est pas une garantie — un
    onglet resté ouvert, un agent, une relance suffisent à contourner l'écran."""
    chose = _creer(client)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        tri={"eteints": [clef("sujet", "sujet")]},
    )

    assert _ligne(envoi, clef("sujet", "sujet"))["allumee"] is True
    assert "un nain" in envoi["texte"]


# ── « Le texte montré vient du même chemin que l'envoi » ──────────────────────


def test_le_texte_montre_est_exactement_celui_qui_part(client, double):
    """**C'est ce qui rend la règle vérifiable au lieu d'affirmée.** Deux
    compositions écrites à deux endroits finissent par diverger, et celle qui
    compte est celle qui part."""
    _bible(client, monde="Deep forge halls", trait="1-pixel dark outline")
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    chose = _creer(client)
    _regler(client, chose["identifiant"], description="a stocky dwarf miner")
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    tri = {"eteints": [clef("jeu", "trait")]}
    montre = _envoi(
        client,
        prompt="a stocky dwarf miner",
        personnage=chose["identifiant"],
        pose="marche",
        direction="sud",
        tri=tri,
    )["texte"]

    _lancer(
        client,
        prompt="a stocky dwarf miner",
        personnage=chose["identifiant"],
        pose="marche",
        direction="sud",
        tri=tri,
    )

    assert montre == double.demandes[-1].prompt


def test_le_texte_ne_bouge_pas_quand_on_ne_trie_rien(client):
    """**Le découpage a changé, pas le texte.** E14 a sorti la consigne de
    l'attitude du champ pour en faire une ligne à part ; l'assemblé est le même,
    mot pour mot, et c'est ce qui permet de livrer sans repayer une image."""
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    chose = _creer(client)
    _regler(client, chose["identifiant"], description="a stocky dwarf miner")

    envoi = _envoi(
        client,
        prompt="a stocky dwarf miner",
        personnage=chose["identifiant"],
        pose="marche",
        direction="sud",
    )

    assert envoi["texte"].endswith(
        "a stocky dwarf miner, walking posture, full body, facing south, "
        "toward the viewer"
    )


# ── « Chaque image jointe porte son prix » ────────────────────────────────────


def test_chaque_image_porte_son_prix_et_une_case_eteinte_garde_le_sien(
    client, tmp_path
):
    """**48 % de la facture du modèle principal part dans les images jointes.**
    Presque la moitié, pour une chose qui se coche et se décoche — et qui se
    cochait sans que rien n'en dise le prix. Une case éteinte garde son prix en
    gris : c'est ce qu'elle coûterait si on la rallumait."""
    chose = _creer(client)
    carte = _carte(client, tmp_path, "concept.png")
    _regler(client, chose["identifiant"], concept_arts=[carte["identifiant"]])

    envoi = _envoi(client, personnage=chose["identifiant"])
    ligne = next(
        l for l in envoi["images"]["lignes"] if l["asset"] == carte["identifiant"]
    )
    assert ligne["cochee"] is True
    assert "prix" in ligne

    eteinte = _envoi(
        client, personnage=chose["identifiant"], references_ecartees=[]
    )
    # Décochée par l'écran, elle reste dans la liste **avec son prix** : une
    # ligne qui disparaîtrait ne laisserait aucun moyen de la remettre.
    decochee = next(
        l
        for l in _envoi(
            client,
            personnage=chose["identifiant"],
            references_ecartees=[carte["identifiant"]],
        )["images"]["lignes"]
        if l["asset"] == carte["identifiant"]
    )
    assert decochee["cochee"] is False
    assert decochee["prix"] == ligne["prix"]
    assert eteinte["images"]["cochees"] == 1


def test_len_tete_du_groupe_dit_ce_que_les_cases_cochees_pesent(client):
    """« $0,024 des $0,051 » — la part qu'on ne voyait pas."""
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"])

    assert envoi["prix"]["appels"] == 1
    assert set(envoi["prix"]) == {"total", "appels", "images", "mesure"}
    # **La mesure est rendue à côté du prix, pas fondue dedans** : `appels` dit
    # combien d'appels celui-ci demandera, `mesure["appels"]` sur combien
    # d'appels payés le prix repose. Les fondre aurait refait le piège de E13 —
    # une phrase qui cite des nombres qui la démentent.
    assert set(envoi["prix"]["mesure"]) >= {"prix", "base", "par_image", "appels"}


def test_le_prix_se_decompose_sur_ce_que_la_machine_a_paye():
    """**Une mesure, jamais un tarif.** Et sans mesure, le prix entier plutôt que
    rien : deux écrans dont l'un annonce un prix et l'autre se tait pour le même
    appel seraient la panne que E13 a déjà payée."""
    decompose = {"prix": 0.02, "base": 0.0063, "par_image": 0.008, "appels": 9}
    assert prix_de(decompose, 0) == 0.0063
    assert prix_de(decompose, 2) == 0.0223
    assert prix_de(decompose, 2, appels=3) == round(0.0223 * 3, 4)

    sans_pas = {"prix": 0.02, "base": None, "par_image": None, "appels": 4}
    assert prix_de(sans_pas, 5) == 0.02
    assert prix_de({"prix": None, "base": None, "par_image": None}, 1) is None


def test_la_barre_qui_paie_et_lecran_annoncent_le_meme_prix(client, double, tmp_path):
    """**Le piège de E13, rejoué à un clic d'écart au lieu de trois centimètres.**

    La barre qui paie affichait la médiane de *tous* les appels de ce modèle,
    images jointes ou non ; l'écran de confirmation, qu'on ouvre depuis elle,
    comptait celles de cet appel-ci. Sur le vrai projet, le 31 août 2026, les deux
    ont annoncé **$0,0160 et $0,0064 pour la même chose** — tous les deux justes,
    et c'est ce qui rendait la contradiction invisible depuis les essais.

    Celui-ci la verrait : il ne juge aucun des deux chiffres, il les compare.
    """
    chose = _creer(client)
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    # **Un prix qui suit le nombre d'images jointes**, comme le vrai modèle : sur
    # les vingt-quatre images payées du dépôt, joindre une référence doublait le
    # prix. Un double à prix plat rendrait le piège invisible — médiane et prix de
    # base y sont le même nombre, et les deux écrans tomberaient d'accord par
    # accident.
    double.couter = lambda demande: 0.006 + 0.008 * len(demande.references)

    # **Il faut des appels payés à plusieurs comptes d'images**, sinon l'essai
    # passerait à vide : sans mesure, les deux côtés disent « je ne sais pas », et
    # deux silences sont toujours d'accord.
    _lancer(client, prompt="un nain", personnage=chose["identifiant"], pose="repos")
    carte = _carte(client, tmp_path, "concept.png")
    _regler(client, chose["identifiant"], concept_arts=[carte["identifiant"]])
    _lancer(client, prompt="un nain", personnage=chose["identifiant"], pose="repos")

    envoi = _envoi(client, personnage=chose["identifiant"])
    modele = envoi["modele"]["identifiant"]
    jointes = envoi["images"]["cochees"]
    assert jointes == 1
    assert envoi["prix"]["total"] is not None
    # La médiane de tout — ce que la barre affichait avant — n'est **pas** le prix
    # de cet appel-ci. C'est ce qui rend la comparaison ci-dessous décisive.
    assert envoi["prix"]["mesure"]["prix"] != envoi["prix"]["total"]

    catalogue = client.get(
        "/api/models",
        params={"references": 0, "personnage": chose["identifiant"]},
    )
    assert catalogue.status_code == 200, catalogue.text
    # Le catalogue compte les mêmes images que l'écran : c'est ce qui fait que
    # les deux prix ne peuvent plus diverger.
    assert catalogue.json()["references"]["total"] == jointes
    assert catalogue.json()["couts"].get(modele) == envoi["prix"]["total"]


# ── « Un avertissement s'écrit sur la ligne fautive, avec des chiffres » ──────


def test_lavertissement_sur_la_taille_est_sur_la_ligne_fautive(client):
    """**Le texte disait 64, le projet en imposait 128, et ça part depuis
    toujours.** Une bannière en haut dirait « attention, deux problèmes » et
    laisserait chercher lesquels."""
    client.put("/api/universe", json={"cible_px": 128})
    _bible(
        client,
        rendu="2D pixel art on a 64x64 grid",
        monde="Deep forge halls",
    )
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"])

    fautive = _ligne(envoi, clef("jeu", "rendu"))
    assert "64" in fautive["avertissement"] and "128" in fautive["avertissement"]
    assert _ligne(envoi, clef("jeu", "monde"))["avertissement"] == ""
    # Un seul avertissement de texte, et il est sur la ligne coupable. L'autre
    # vient du groupe des images, et il porte sa propre clef : le compte se lit à
    # droite pour qu'on sache qu'il y en a, même sans être descendu jusqu'à eux.
    assert [a["clef"] for a in envoi["avertissements"] if a["clef"].startswith("jeu.")] == [
        clef("jeu", "rendu")
    ]


def test_un_avertissement_donne_des_chiffres_jamais_un_conseil(client):
    """« Aucune image jointe · sur les 24 générations payées du dépôt, 10 sont
    parties sans texte de style ni image » — et jamais « tu devrais joindre une
    image »."""
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"])

    aucune = next(
        a for a in envoi["avertissements"] if a["clef"] == clef("images", "aucune")
    )
    assert "24" in aucune["texte"] and "10" in aucune["texte"]
    assert "devrais" not in aucune["texte"]


def test_un_avertissement_nempeche_jamais_de_payer(client, tmp_path):
    """**Il n'existe qu'un seul refus automatique dans tout l'atelier**, et ce
    n'est pas ici qu'il se joue : il se joue au retour, quand la planche revient
    avec sept images pour huit demandées."""
    client.put("/api/universe", json={"cible_px": 128})
    _bible(client, rendu="2D pixel art on a 64x64 grid")
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"])
    assert envoi["avertissements"]

    lancee = _lancer(client, personnage=chose["identifiant"], pose="repos")
    assert lancee["statut"] == "reussie"


# ── « Ce qui agira au retour se lit en gris » ─────────────────────────────────


def test_ce_qui_agit_au_retour_se_lit_et_ne_part_pas(client):
    """**L'image qu'on verra revenir n'est pas celle que le modèle envoie**, et
    il vaut mieux le savoir avant que le savoir après. Rien de tout ça ne part au
    modèle, et rien ne coûte un centime."""
    client.put("/api/universe", json={"cible_px": 128})
    chose = _creer(client)

    envoi = _envoi(client, personnage=chose["identifiant"], echelle="personnage")

    noms = [l["nom"] for l in envoi["retour"]]
    assert "ramener sur la grille du jeu" in noms
    assert "détourer le fond" in noms
    # Et rien de tout ça n'est dans ce qui part.
    assert all(l["groupe"] != "retour" for l in envoi["lignes"])
    for ligne in envoi["retour"]:
        assert ligne["nom"] not in envoi["texte"]


def test_le_decoupage_dune_planche_se_lit_au_retour(client):
    client.put("/api/universe", json={"vue": "vue-dessus-34"})
    chose = _creer(client)

    envoi = _envoi(
        client,
        personnage=chose["identifiant"],
        pose="marche",
        directions=["nord", "sud", "est", "ouest"],
    )

    decoupe = next(l for l in envoi["retour"] if l["nom"] == "découper la planche")
    assert decoupe["detail"] == "4 cases"
    assert envoi["cases"] == 4


# ── « Ce qui a été pris de l'ambiance est enregistré avec la génération » ─────


def test_ce_qui_a_ete_pris_de_lambiance_se_relit_sur_une_vieille_image(client, double):
    """**Sans lui, « ce qui est montré est ce qui part » cesserait d'être vrai en
    relisant une vieille image** : le réglage durable aura changé, l'ambiance
    aura été retouchée, et rien ne dirait plus d'où venait le monde qu'on lit
    dans le prompt."""
    _bible(client, monde="Deep forge halls")
    ambiance = _ambiance(
        client, "Forge des profondeurs", monde="Molten channels, soot-blackened"
    )
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    lancee = _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
    )

    assert "Molten channels" in double.demandes[-1].prompt
    relue = lancee
    assert relue["ambiance"] == "Forge des profondeurs"
    assert "textes" in relue["pris"]


def test_eteindre_les_lignes_dune_ambiance_le_dit_dans_lenregistrement(client, double):
    """**Ce n'est pas dérivable du réglage durable**, et c'est ce qui vaut à ces
    trois oui/non d'exister : l'écran éteint ligne par ligne, donc un appel peut
    avoir pris le monde sans l'éclairage — ce qu'aucun des trois modes ne
    décrit."""
    _bible(client, monde="Deep forge halls", eclairage="Cold blue rim light")
    ambiance = _ambiance(
        client,
        "Forge des profondeurs",
        monde="Molten channels",
        eclairage="Forge-lit from below",
    )
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    lancee = _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
        tri={
            "eteints": [clef("ambiance", "monde"), clef("ambiance", "eclairage")]
        },
    )

    parti = double.demandes[-1].prompt
    # **Les textes du jeu se rallument d'eux-mêmes** : ils redeviennent la couche
    # la plus haute qui reste candidate, sans qu'on les rallume.
    assert "Deep forge halls" in parti and "Cold blue rim light" in parti
    assert "Molten channels" not in parti
    relue = lancee
    assert relue["pris"] == []


def test_une_chose_qui_ne_prend_que_les_couleurs_nenvoie_pas_les_textes(client):
    """Le mode est le **point de départ** des interrupteurs, jamais ce qui
    s'enregistre : les lignes de l'ambiance sont là, éteintes, et l'on peut les
    prendre pour cet appel seulement."""
    _bible(client, monde="Deep forge halls")
    ambiance = _ambiance(client, "Forge des profondeurs", monde="Molten channels")
    chose = _creer(client)
    _regler(
        client,
        chose["identifiant"],
        ambiance=ambiance["identifiant"],
        prend="couleurs",
    )

    envoi = _envoi(client, personnage=chose["identifiant"])

    assert _ligne(envoi, clef("ambiance", "monde"))["allumee"] is False
    assert _ligne(envoi, clef("jeu", "monde"))["allumee"] is True
    assert "Molten channels" not in envoi["texte"]

    # Et l'écran peut la reprendre pour cet appel-là.
    repris = _envoi(
        client,
        personnage=chose["identifiant"],
        tri={"allumes": [clef("ambiance", "monde")]},
    )
    assert "Molten channels" in repris["texte"]


def test_les_images_dune_ambiance_partent_et_le_mode_les_retire(client, double, tmp_path):
    """Une ambiance ne contient aucune image : elle en **désigne**, dans le
    tableau d'inspiration. Elles partent avec les générations de ce qui s'en
    sert, et le mode « les couleurs seulement » les retire — pour l'agent comme
    pour l'auteur, qui n'ont pas deux règles."""
    carte = _carte(client, tmp_path, "marais.png")
    ambiance = _ambiance(
        client, "Forge des profondeurs", references=[carte["identifiant"]]
    )
    chose = _creer(client)
    _regler(client, chose["identifiant"], ambiance=ambiance["identifiant"])
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    envoi = _envoi(client, personnage=chose["identifiant"])
    jointe = next(
        l for l in envoi["images"]["lignes"] if l["asset"] == carte["identifiant"]
    )
    assert jointe["provenance"] == "image de son ambiance"
    assert jointe["cochee"] is True

    lancee = _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
    )
    relue = lancee
    assert "references" in relue["pris"]

    _regler(client, chose["identifiant"], prend="couleurs")
    apres = _envoi(client, personnage=chose["identifiant"])
    retiree = next(
        l for l in apres["images"]["lignes"] if l["asset"] == carte["identifiant"]
    )
    assert retiree["cochee"] is False
    assert "ambiance" in retiree["ecartee_par"]


# ── L'option qui envoie la palette en image ──────────────────────────────────


def test_la_palette_part_en_image_et_occupe_une_place(client, double, tmp_path):
    """**En image et jamais en texte** : une liste de codes couleur est mal
    suivie par les modèles, et elle allongerait un texte qui pèse déjà la moitié
    de l'appel."""
    carte = _carte(client, tmp_path, "officiel.png")
    promue = client.put(
        f"/api/board/{carte['identifiant']}/official",
        json={"officiel": True, "famille": "tous"},
    )
    assert promue.status_code == 200, promue.text
    chose = _creer(client)
    double.rendre = lambda: image_sujet(bloc=4, toile=24)

    sans = _envoi(client, personnage=chose["identifiant"])
    avec = _envoi(
        client, personnage=chose["identifiant"], tri={"allumes": [PALETTE]}
    )

    assert sans["images"]["palette"] == 0
    assert avec["images"]["palette"] == 1
    assert avec["images"]["cochees"] == sans["images"]["cochees"] + 1

    _lancer(
        client,
        prompt="un nain",
        personnage=chose["identifiant"],
        pose="repos",
        palette=True,
    )
    assert len(double.demandes[-1].references) == avec["images"]["cochees"]


def test_loption_grisee_porte_sa_raison(client):
    """**Ce qui est indisponible est grisé avec sa raison**, jamais absent :
    l'absence n'apprend rien, le grisé apprend pourquoi."""
    chose = _creer(client)

    option = _envoi(client, personnage=chose["identifiant"])["options"][0]

    assert option["allumee"] is False
    assert "aucune palette" in option["refus"]


# ── La résolution, dans le domaine ───────────────────────────────────────────


def test_eteindre_lambiance_rallume_le_jeu_sans_quon_le_rallume():
    """**L'état est un écart, jamais un état complet.** Enregistrer l'état
    complet aurait figé les lignes du jeu dans l'état éteint où l'ambiance les
    avait mises, et il aurait fallu un second geste pour les retrouver."""
    couches = Couches(
        bible=(("monde", "du jeu"), ("trait", "trait du jeu")),
        ambiance={"monde": "de l'ambiance"},
        ambiance_nom="Forge",
    )

    avec = {l["clef"]: l["allumee"] for l in resoudre(couches, None)}
    assert avec == {"jeu.monde": False, "jeu.trait": True, "ambiance.monde": True}

    sans = {
        l["clef"]: l["allumee"]
        for l in resoudre(couches, Tri(eteints=frozenset({"ambiance.monde"})))
    }
    assert sans == {"jeu.monde": True, "jeu.trait": True, "ambiance.monde": False}


def test_un_champ_eteint_sur_la_fiche_lest_pour_les_deux_couches():
    """**Un refus ne se discute pas avec ce qu'il refuse** (E12) : une ambiance
    qui rallumerait un champ que la chose refuse rendrait le refus
    indéfendable."""
    couches = Couches(
        bible=(("monde", "du jeu"),),
        ambiance={"monde": "de l'ambiance"},
        ambiance_nom="Forge",
        eteints=frozenset({"monde"}),
    )

    assert not any(l["allumee"] for l in resoudre(couches, None))
    # Et il se lève pour cet appel, sans qu'on aille défaire le réglage durable.
    repris = resoudre(couches, Tri(allumes=frozenset({"jeu.monde"})))
    assert next(l for l in repris if l["clef"] == "jeu.monde")["allumee"] is True


def test_les_textes_de_style_gardent_lordre_de_la_bible():
    """Un monde venu d'une ambiance se lit **à la place du monde**, pas à la fin.
    Changer l'ordre d'un prompt change ce que le modèle rend."""
    couches = Couches(
        bible=(("monde", "M"), ("epoque", "E"), ("trait", "T")),
        ambiance={"trait": "T-ambiance"},
        ambiance_nom="Forge",
    )

    assert joindre(resoudre(couches, None)) == (
        "World: M\nEra: E\nLine and shading: T-ambiance"
    )
