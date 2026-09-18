# -*- coding: utf-8 -*-
"""Les critères de M4 — la planche cesse d'être mal décrite.

**Deux remarques, une seule cause.** *« Le gabarit qu'on me propose, je ne l'ai
jamais validé »* et *« pourquoi on parle de planche et de cases pour une seule
pose ? »* ont été écrites le même jour, sur le même écran, sans se ressembler.
Elles disent la même chose : **la planche est mal décrite, et elle l'est à trois
endroits différents.**

**① L'écran nommait une image autrement que le texte qui part, au même
instant.** Le texte disait *voici la planche existante, n'y change que ce qu'on
demande* ; l'écran, quelques centimètres plus bas, *voici une grille vide, place
les sujets dedans*. Deux demandes opposées pour une seule image, au moment où
l'on décide de payer. Le serveur savait très bien laquelle des deux c'était — il
ne rendait qu'un **nombre**, sans le rôle, et l'écran a gardé les mots du plus
ancien des deux cas.

**② Le texte qui part décrivait une grille qui n'existe pas.** Les nombres ne
s'accordaient jamais — *1 sprites*, *1 columns*, *1 rows* —, et **à une seule
case le texte affirmait au modèle qu'il regardait une feuille de contact
quadrillée**, lui demandait de garder exactement la même grille, et lui
interdisait les bordures de cases. Pour une image qui n'a ni cases ni grille.
Mesuré le 4 septembre 2026 : 14 planches du dépôt sur 22 avaient reçu un pluriel
faux, et les 7 planches d'équipement étaient toutes dans ce cas.

**Ce que ces essais protègent avant tout, c'est ce qui ne doit pas bouger.** À
deux cases et au-delà, le texte reste mot pour mot celui d'aujourd'hui,
redondance comprise : le banc du 28 août 2026 l'a étalonnée, et **il n'est pas
rejoué**. Ce qui était en cause n'était pas la redondance, c'était qu'elle
décrive une grille absente.

*Ce que l'écran en fait — la ligne sans case, la vignette, la légende sous chaque
image, et l'écran de la planche relu en entier — se mesure dans
`interface/src/App.test.tsx`.*

**Aucun essai de ce fichier ne coûte un centime.**
"""

from __future__ import annotations

from atelier.domaine.pliage import CasePliee, Pliage
from atelier.services.generation import role_de_planche
from atelier.services.pliage import accorde, consignes

from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"


# ── Les échafaudages ─────────────────────────────────────────────────────────


def _bible(client) -> None:
    reponse = client.put(
        "/api/universe",
        json={"bible": [{"nom": "monde", "texte": "marais de fer", "actif": True}]},
    )
    assert reponse.status_code == 200, reponse.text


def _attendre(client, identifiant: str) -> dict:
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")  # pragma: no cover


def _personnage(client, poses: int) -> tuple[str, list[str]]:
    tableau = client.get("/api/characters").json()
    plan = [p["identifiant"] for p in tableau["plan"]][:poses]
    personnage = client.post(
        "/api/characters", json={"nom": "Nain", "description": "un nain"}
    ).json()["personnage"]["identifiant"]
    client.put(f"/api/characters/{personnage}", json={"poses": plan})
    return personnage, plan


def _corps(client, double, personnage: str, poses: list[str]) -> None:
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    for pose in poses:
        faite = client.post(
            "/api/generations",
            json={
                "modele": MODELE,
                "prompt": f"le nain, {pose}",
                "personnage": personnage,
                "pose": pose,
            },
        ).json()
        _attendre(client, faite["identifiant"])
    double.rendre = None


def _piece(client) -> str:
    return client.post(
        "/api/characters/pieces",
        json={
            "nom": "casque",
            "description": "un casque de fer à cornes",
            "emplacement": "tête",
            "portee": "contenue",
        },
    ).json()["piece"]["identifiant"]


def _equipement(client, double, poses: int = 1) -> dict:
    """Une pièce posée sur `poses` corps — le cas de la **planche jointe**."""
    personnage, plan = _personnage(client, poses)
    _corps(client, double, personnage, plan)
    return {"personnage": personnage, "poses": plan, "piece": _piece(client)}


def _lot(client, double, poses: int = 2) -> dict:
    """Un lot de poses à créer — le cas du **gabarit**."""
    personnage, plan = _personnage(client, poses)
    _corps(client, double, personnage, plan)
    return {"personnage": personnage, "poses": plan}


def _envoi(client, **corps) -> dict:
    reponse = client.post(
        "/api/outgoing", json={"modele": MODELE, "prompt": "un casque", **corps}
    )
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _pliage(cases: int, *, connue: bool) -> Pliage:
    return Pliage(
        cases=tuple(CasePliee(texte=f"case {n}") for n in range(1, cases + 1)),
        geometrie_connue=connue,
    )


# ── ① « Le serveur dit lequel des deux rôles il a choisi » ──────────────────


def test_le_role_se_decide_a_un_seul_endroit():
    """**Il existait deux fois, et les deux copies avaient divergé.** Le texte
    et le compte des images décidaient chacun pour soi ; celui du compte ne
    rendait qu'un nombre, et l'écran n'avait alors que les mots du plus ancien
    des deux cas."""
    assert role_de_planche(cases=1, piece=True) == "planche"
    assert role_de_planche(cases=4, piece=True) == "planche"
    assert role_de_planche(cases=2, piece=False) == "gabarit"
    assert role_de_planche(cases=9, piece=False) == "gabarit"

    # Rien en dessous : une pose seule n'est pas un lot, et la plier ferait
    # payer un gabarit pour une image que le produit sait déjà demander.
    assert role_de_planche(cases=1, piece=False) is None
    assert role_de_planche(cases=0, piece=True) is None


def test_sur_un_equipement_l_ecran_dit_la_planche_et_le_texte_aussi(client, double):
    """**Le critère qui tient tous les autres** : la phrase de l'écran et celle
    du texte qui part sont comparées ici, pour qu'elles ne puissent plus
    diverger. C'était exactement le défaut — les deux s'affichaient ensemble, à
    quelques centimètres l'une de l'autre, et elles se contredisaient."""
    _bible(client)
    envoi = _envoi(client, **_equipement(client, double, poses=2))

    jointe = envoi["images"]["jointe"]
    assert jointe["role"] == "planche"
    assert jointe["nom"] == "la planche du corps, que le modèle doit modifier"

    # Et le texte qui part au modèle dit **la même chose** : la feuille est là,
    # on la modifie. Jamais « place les sujets dans une grille vide ».
    assert "THE SPRITE SHEET TO CHANGE" in envoi["texte"]
    assert "EMPTY LAYOUT GRID" not in envoi["texte"]


def test_sur_une_grille_vide_l_ecran_dit_le_gabarit_et_le_texte_aussi(client, double):
    _bible(client)
    envoi = _envoi(client, **_lot(client, double, poses=2))

    jointe = envoi["images"]["jointe"]
    assert jointe["role"] == "gabarit"
    assert jointe["nom"] == (
        "le gabarit de la grille, qui dit au modèle où poser les 2 sujets"
    )

    assert "EMPTY LAYOUT GRID" in envoi["texte"]
    assert "SPRITE SHEET TO CHANGE" not in envoi["texte"]


def test_l_image_jointe_porte_son_rang_son_prix_et_sa_raison(client, double):
    """**Une ligne sans case, et pas une case grisée.** La décision d'origine ne
    bouge pas — la décocher reviendrait à demander une planche sans dire à quoi
    elle ressemble —, et elle est écrite sur la ligne."""
    _bible(client)
    envoi = _envoi(client, **_equipement(client, double, poses=2))

    jointe = envoi["images"]["jointe"]
    assert jointe["rang"] == envoi["images"]["rang_gabarit"]
    assert jointe["rang"] is not None
    assert "ne se décoche pas" in jointe["raison"]
    # Elle n'est pas dans la liste des images qu'on coche : c'est ce qui la
    # rend sans case plutôt que grisée.
    assert all(l["asset"] for l in envoi["images"]["lignes"])


def test_sans_planche_il_n_y_a_pas_d_image_jointe(client):
    """Un appel simple n'en joint aucune, et l'écran n'a alors rien à dire."""
    _bible(client)
    envoi = _envoi(client)

    assert envoi["images"]["jointe"] is None
    assert envoi["images"]["gabarit"] == 0


# ── ① « Chaque image porte, sous elle, le morceau de légende qui la concerne »


def test_chaque_image_porte_le_morceau_de_legende_qui_la_concerne(client, double):
    _bible(client)
    envoi = _envoi(client, **_equipement(client, double, poses=2))

    jointe = envoi["images"]["jointe"]
    assert jointe["legende"].startswith(f"Image {jointe['rang']} — ")
    assert "THE SPRITE SHEET TO CHANGE" in jointe["legende"]

    for ligne in envoi["images"]["lignes"]:
        if ligne["rang"] is None:
            # Une image qui ne part pas n'a pas de rang dans le texte, donc pas
            # de ligne dans la légende.
            assert ligne["legende"] == ""
        else:
            assert ligne["legende"].startswith(f"Image {ligne['rang']} — ")


def test_la_legende_part_entiere_et_inchangee(client, double):
    """**Elle ne déménage pas, elle se recopie.** Le bloc entier est du texte
    qui va au modèle : il se lit en haut, dans l'ordre où il s'assemble, et
    l'écran promet de montrer ce qui part mot pour mot."""
    _bible(client)
    envoi = _envoi(client, **_equipement(client, double, poses=2))

    morceaux = [l["legende"] for l in envoi["images"]["lignes"] if l["legende"]]
    morceaux.append(envoi["images"]["jointe"]["legende"])
    for morceau in morceaux:
        assert morceau in envoi["texte"]

    # Et le bloc est bien celui de la ligne « les images jointes », entier.
    ligne = next(l for l in envoi["lignes"] if l["clef"] == "jointes.role")
    assert ligne["texte"] == "\n".join(morceaux)


# ── ① « La troisième image a sa vignette, et elle s'ouvre en grand » ────────


def test_l_image_jointe_se_demande_et_rend_une_image(client, double):
    """**La même image, par le même chemin, à l'octet près.** La redessiner à
    l'écran en aurait fait une seconde vérité sur ce qui part."""
    _bible(client)
    montage = _equipement(client, double, poses=2)

    reponse = client.get(
        "/api/outgoing/sheet",
        params={
            "modele": MODELE,
            "personnage": montage["personnage"],
            "piece": montage["piece"],
            "poses": montage["poses"],
        },
    )

    assert reponse.status_code == 200, reponse.text
    assert reponse.headers["content-type"] == "image/png"
    assert reponse.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_un_gabarit_se_demande_aussi(client, double):
    _bible(client)
    montage = _lot(client, double, poses=2)

    reponse = client.get(
        "/api/outgoing/sheet",
        params={
            "modele": MODELE,
            "personnage": montage["personnage"],
            "poses": montage["poses"],
        },
    )

    assert reponse.status_code == 200, reponse.text
    assert reponse.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_un_appel_sans_planche_ne_rend_aucune_image_jointe(client):
    """404, et c'est une **absence**, pas une panne : l'écran ne demande cette
    adresse que lorsque la confirmation lui a annoncé une image."""
    reponse = client.get("/api/outgoing/sheet", params={"modele": MODELE})

    assert reponse.status_code == 404


def test_demander_l_image_jointe_ne_coute_rien(client, double):
    """Les deux sortes se redessinent du geste : la demander refait
    gratuitement ce que la soumission refera."""
    _bible(client)
    montage = _equipement(client, double, poses=2)
    appels = double.appels

    client.get(
        "/api/outgoing/sheet",
        params={
            "modele": MODELE,
            "personnage": montage["personnage"],
            "piece": montage["piece"],
            "poses": montage["poses"],
        },
    )

    assert double.appels == appels


# ── ② « Les nombres s'accordent » ───────────────────────────────────────────


def test_l_accord_se_fait_sur_un_seul_endroit():
    assert accorde(1, "sprite") == "1 sprite"
    assert accorde(2, "sprite") == "2 sprites"
    assert accorde(1, "column") == "1 column"
    assert accorde(4, "row") == "4 rows"
    assert accorde(1, "empty cell") == "1 empty cell"


def test_a_deux_cases_la_ligne_du_bas_est_au_singulier():
    """**C'est le cas courant, et c'est là que la faute se voyait** : une grille
    de deux cases fait deux colonnes et **une** ligne, et le texte écrivait
    *1 rows*. Sept planches du dépôt étaient dans ce cas."""
    texte = consignes(_pliage(2, connue=True))

    assert "2 columns and 1 row." in texte
    assert "2 columns, 1 row," in texte
    assert "1 rows" not in texte
    assert "2 sprites" in texte


def test_a_quatre_cases_tout_est_au_pluriel():
    texte = consignes(_pliage(4, connue=True))

    assert "4 sprites" in texte
    assert "2 columns and 2 rows." in texte


def test_le_gabarit_accorde_aussi_ses_cases():
    texte = consignes(_pliage(2, connue=False))

    assert "2 columns and 2 rows" not in texte
    assert "Exactly 2 columns and 1 row" in texte
    assert "shows 2 empty cells" in texte


# ── ② « À une seule case, le texte dit ce que l'image est » ─────────────────


def test_a_une_seule_case_le_texte_ne_parle_plus_d_une_grille():
    """**Ce qui partait était une description de ce que l'image n'est pas.** Le
    texte affirmait au modèle qu'il regardait une feuille quadrillée, lui
    demandait de garder la même grille, et lui interdisait les bordures de cases
    — pour une image qui n'a ni cases ni grille."""
    texte = consignes(_pliage(1, connue=True))

    assert "a single sprite" in texte
    assert "Return the SAME image" in texte
    for mot in ("sheet", "cell", "grid", "column", "row", "border"):
        assert mot not in texte.lower(), mot


def test_a_une_seule_case_la_redondance_est_gardee():
    """**Elle ne se rediscute pas** : le banc du 28 août 2026 l'a étalonnée, et
    la règle qu'il en tire est que *tout ce qu'on ne dit pas explicitement « ne
    change pas » est une invitation à le changer*. Les six mêmes garanties se
    retrouvent donc, dites de l'image entière au lieu de la case."""
    texte = consignes(_pliage(1, connue=True))

    for garantie in (
        "the same character",
        "the same pose",
        "the same proportions",
        "the same size",
        "the same colors everywhere else",
        "the same plain flat light gray background",
    ):
        assert garantie in texte, garantie
    assert "Only the item is added" in texte


def test_a_deux_cases_le_texte_reste_celui_d_aujourd_hui():
    """**Le banc du 28 août n'est pas rejoué.** Ce qui change à deux cases et
    au-delà est l'accord des nombres, et **rien d'autre** : les phrases sont
    celles qui ont été mesurées."""
    texte = consignes(_pliage(2, connue=True))

    assert texte.startswith("The attached image is a sprite sheet of 2 sprites")
    assert "Return the SAME sheet with the described item added to every sprite." in texte
    assert "Keep the exact same grid:" in texte
    # Les phrases mesurées sont toutes là ; une seule s'y ajoute depuis le
    # 18 septembre 2026 — la pièce entière, avec de l'air autour
    # (`ITEM_ENTIER_PLANCHE`, `atelier/services/pliage.py`).
    assert "no cell borders, no grid lines, no text, no numbers, no frames. Draw the whole item" in texte
    assert texte.endswith("no part of it may touch or cross the edge of its cell.")


def test_la_legende_d_une_seule_case_ne_parle_pas_de_feuille_non_plus(client, double):
    """Les deux phrases du même prompt disaient la même chose fausse ; elles
    changent ensemble."""
    _bible(client)
    envoi = _envoi(client, **_equipement(client, double, poses=1))

    assert "THE IMAGE TO CHANGE" in envoi["texte"]
    assert "SPRITE SHEET" not in envoi["texte"]
    assert "1 sprites" not in envoi["texte"]
    assert envoi["images"]["jointe"]["role"] == "planche"


# ── « Aucun appel, aucun centime » ──────────────────────────────────────────


def test_la_composition_ne_parle_jamais_au_fournisseur(client, double):
    _bible(client)
    montage = _equipement(client, double, poses=2)
    appels = double.appels

    _envoi(client, **montage)

    assert double.appels == appels
