# -*- coding: utf-8 -*-
"""V3.01.1 — le tiroir « ce qui part avec ce clip ».

Les critères de `docs/PLAN.md` § V3.01.1, côté serveur. **Aucun n'appelle un
vrai fournisseur** : l'animateur d'ici est un double qui rend des octets, comme
celui d'`A9`. La moitié d'écran de la tranche vit dans
`interface/src/App.test.tsx`, sur le même flux.

**Ce que la tranche change au serveur est une résolution.** Le corps de
`/api/clips` acceptait déjà un texte et un mouvement, mais le mouvement
**écrasait** le texte. Depuis V3.01.1, l'ordre s'inverse : le texte corrigé
dans le tiroir de relecture **prime**, et le mouvement reste inscrit sur la
génération — c'est lui que le montage d'`A10` lit pour nommer ses bandes, et
une correction d'un appel ne doit pas casser la filiation. Sans correction, le
comportement d'`A9` est inchangé : le serveur relit le mouvement, et le texte
anglais n'a toujours qu'un seul endroit où il s'écrit.

**Ce qui ne se mesure pas ici** : la forme du tiroir — ce que l'écran montre,
qu'il ne dépense pas en s'ouvrant, que l'image ne se retire pas. Cette moitié
vit dans les essais d'écran.
"""

from __future__ import annotations

import pytest

from atelier.domaine.animation import DemandeClip, ModeleVideo, Tarification
from atelier.fournisseur.port import ClipProduit, EtatTravail


JETONS = Tarification(genre="jeton", montant=0.0000035, libelle="video_tokens")

MODELE = ModeleVideo(
    identifiant="essai:mele-les-poses",
    nom="Essai — plusieurs poses",
    fournisseur="essai",
    chez_lui="mele-les-poses",
    durees=(4, 5, 6),
    resolutions=("480p", "720p"),
    proportions=("1:1", "16:9"),
    mesure="",
    tarification=JETONS,
)


class AnimateurDouble:
    """Implémente `PortAnimateur`, sans réseau et sans facture."""

    nom = "essai"

    def __init__(self, modeles: list[ModeleVideo] | None = None) -> None:
        self.modeles = modeles if modeles is not None else [MODELE]
        self.soumissions: list[tuple[str, DemandeClip]] = []

    def indisponible(self) -> str | None:
        return None

    async def catalogue_video(self) -> list[ModeleVideo]:
        return list(self.modeles)

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        self.soumissions.append((modele.identifiant, demande))
        return f"travail-{len(self.soumissions)}"

    async def etat(self, travail: str) -> EtatTravail:
        return EtatTravail(travail=travail, fini=True)

    async def recuperer(self, travail: str) -> ClipProduit:
        return ClipProduit(
            octets=b"\x00\x00\x00\x18ftypmp42 pas de vraies images ici",
            consomme=0.041,
            type_media="video/mp4",
            travail=travail,
        )


@pytest.fixture
def animateur() -> AnimateurDouble:
    return AnimateurDouble()


@pytest.fixture
def atelier_video(tmp_path, double, animateur):
    """L'atelier du produit, monté sur les deux doubles — l'image du fournisseur
    d'images sert à ce qu'un clip ait de quoi partir, comme en `A9`."""
    from atelier.services import Atelier

    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )


@pytest.fixture
def client_video(atelier_video):
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application

    with TestClient(creer_application(atelier_video)) as client:
        yield client


def un_sprite(client) -> str:
    """Une image dans la bibliothèque, produite par le double d'images."""
    reponse = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un voyageur", "variations": 1},
    )
    identifiant = reponse.json()["identifiant"]
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee"):
            break
    assets = client.get("/api/assets").json()["assets"]
    return assets[0]["identifiant"]


def texte_du_mouvement(client, nom: str) -> str:
    connus = client.get("/api/movements").json()["mouvements"]
    return next(m for m in connus if m["identifiant"] == nom)["texte"]


# ── Le texte corrigé prime sur le mouvement ─────────────────────────────────
#
# **RV5/RV6** : `POST /clips` a été retirée (21 septembre 2026). Ce que cette
# tranche appelait « le texte corrigé dans le tiroir » est devenu
# `correction_geste`, porté par la fabrication suivie et composé une fois pour
# toutes dans `ServiceTravaux.preparer` (voir aussi `tests/test_rv5_serie.py`).
# La génération garde le même invariant : le mouvement reste inscrit, la
# correction ne l'efface jamais.


async def _une_case(atelier_video, client_video) -> tuple[str, str]:
    """Un personnage et le projet ouvert — de quoi préparer un travail."""
    personnage = client_video.post(
        "/api/characters", json={"nom": "Michel", "description": "un voyageur"}
    ).json()["personnage"]["identifiant"]
    return personnage, atelier_video.bibliotheque.courant


async def test_la_correction_du_geste_prime_sur_le_mouvement_et_part(atelier_video, client_video, animateur):
    """*Le texte corrigé part, le mouvement reste inscrit sur la génération.*

    C'est le cœur du changement : le mouvement écrivait le texte, prompt ou
    non. Une correction du geste, avant l'envoi, corrige le texte **et**
    garde le mouvement — le montage d'`A10` nomme ses bandes d'après lui, et
    perdre la filiation parce qu'on a retouché une virgule serait casser
    l'animation pour corriger le texte.
    """
    sprite = un_sprite(client_video)
    personnage, projet = await _une_case(atelier_video, client_video)
    corrige = "Marche lente, en place, boucle parfaite — le personnage s'arrête net."

    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "v301-corrige", "personnage": personnage, "pose": "marche", "direction": "",
        "modele_video": MODELE.identifiant, "mouvement": "marche", "reference_asset": sprite,
        "correction_geste": corrige,
    })
    assert travail["demande"]["prompt_video"] == corrige
    assert travail["demande"]["prompt_video"] != texte_du_mouvement(client_video, "marche")
    await atelier_video.travaux.demarrer(projet, travail["identifiant"])
    await atelier_video.travaux.attendre_tout()

    _, demande = animateur.soumissions[0]
    assert demande.texte == corrige

    # **La filiation est inscrite, texte corrigé ou non** : c'est ce que le
    # montage lira pour nommer les bandes taillées dans ce clip.
    fini = atelier_video.travaux.lire(projet, travail["identifiant"])
    generation = atelier_video.animation.lire(fini["clip"])
    assert generation.demande["mouvement"] == "marche"
    assert generation.demande["prompt"] == corrige


async def test_sans_correction_le_mouvement_ecrit_le_texte_comme_avant(
    atelier_video, client_video, animateur
):
    """*Le comportement d'`A9` est inchangé* : sans correction, le serveur relit
    le mouvement, et le texte anglais n'a qu'un seul endroit où il s'écrit."""
    sprite = un_sprite(client_video)
    personnage, projet = await _une_case(atelier_video, client_video)
    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "v301-sans-correction", "personnage": personnage, "pose": "marche", "direction": "",
        "modele_video": MODELE.identifiant, "mouvement": "marche", "reference_asset": sprite,
    })
    await atelier_video.travaux.demarrer(projet, travail["identifiant"])
    await atelier_video.travaux.attendre_tout()

    _, demande = animateur.soumissions[0]
    assert demande.texte == texte_du_mouvement(client_video, "marche")


async def test_un_mouvement_inconnu_se_refuse_meme_avec_une_correction_du_geste(
    atelier_video, client_video, animateur
):
    """La filiation ne peut pas mentir : un mouvement qui n'existe pas se refuse
    avant de payer, qu'on ait corrigé le texte ou non — sans quoi la génération
    porterait une chose qu'il n'y a pas."""
    from atelier.domaine.travail import TravailRefuse

    sprite = un_sprite(client_video)
    personnage, projet = await _une_case(atelier_video, client_video)
    with pytest.raises(TravailRefuse, match="danse-de-la-pluie"):
        await atelier_video.travaux.preparer(projet, {
            "cle": "v301-inconnu", "personnage": personnage, "pose": "marche", "direction": "",
            "modele_video": MODELE.identifiant, "mouvement": "danse-de-la-pluie",
            "reference_asset": sprite, "correction_geste": "un texte corrigé, peu importe",
        })
    assert animateur.soumissions == []


async def test_des_espaces_seuls_ne_sont_pas_une_correction(atelier_video, client_video, animateur):
    """*Un clip part d'un texte* — et des espaces ne sont pas une correction.

    Une correction réduite à des espaces reprend le mouvement, comme l'absence
    de correction : c'est la même réserve que la route d'`A9` sur le prompt,
    appliquée à une correction. Le vrai refus — *aucun texte du tout* — est
    déjà tenu par `test_a9` quand il n'y a ni texte ni mouvement.
    """
    sprite = un_sprite(client_video)
    personnage, projet = await _une_case(atelier_video, client_video)
    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "v301-espaces", "personnage": personnage, "pose": "marche", "direction": "",
        "modele_video": MODELE.identifiant, "mouvement": "marche", "reference_asset": sprite,
        "correction_geste": "   ",
    })
    await atelier_video.travaux.demarrer(projet, travail["identifiant"])
    await atelier_video.travaux.attendre_tout()
    _, demande = animateur.soumissions[0]
    assert demande.texte == texte_du_mouvement(client_video, "marche")


# ── La génération se referme et se rouvre avec sa correction ────────────────


async def test_un_clip_corrige_rouvert_se_relit_avec_son_texte_et_sa_filiation(
    atelier_video, client_video, tmp_path, double, animateur
):
    """⚠️ *Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini*
    (point 8septies d'`AGENTS.md`). La garde se fait avec des réglages qui ne
    sont pas ceux du défaut : un texte corrigé, et un mouvement distinct.

    L'atelier se **rouvre** par-dessus le premier — c'est le geste de l'auteur
    qui ferme l'atelier et le relance —, et la génération relue du disque porte
    encore le texte corrigé **et** le mouvement qui l'accompagne.
    """
    from atelier.services import Atelier

    sprite = un_sprite(client_video)
    personnage, projet = await _une_case(atelier_video, client_video)
    corrige = "Marche lente, en place, boucle parfaite — correction du tiroir."
    travail = await atelier_video.travaux.preparer(projet, {
        "cle": "v301-rouvert", "personnage": personnage, "pose": "marche", "direction": "",
        "modele_video": MODELE.identifiant, "mouvement": "marche", "reference_asset": sprite,
        "correction_geste": corrige,
    })
    await atelier_video.travaux.demarrer(projet, travail["identifiant"])
    await atelier_video.travaux.attendre_tout()
    fini = atelier_video.travaux.lire(projet, travail["identifiant"])
    identifiant = fini["clip"]

    relu = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    generation = relu.animation.lire(identifiant)
    assert generation is not None
    assert generation.demande["prompt"] == corrige
    assert generation.demande["mouvement"] == "marche"


# ── V3.01.2 — la liste arrive triée du serveur ──────────────────────────────


MAISON = ModeleVideo(
    identifiant="maison:wan",
    nom="Wan maison",
    fournisseur="maison",
    chez_lui="wan",
    durees=(1, 2, 3),
    resolutions=("480p",),
    proportions=("1:1",),
    tarification=Tarification(genre="maison", montant=0.0, libelle="gratuit"),
)
# **Deux payants dont l'ordre s'inverse quand la demande change.** L'un compte
# au jeton vidéo — sa surface change avec le format : 27 000 jetons en carré,
# 47 925 en 16:9 —, l'autre à la seconde, insensible au format. En carré le
# premier coûte moins ; en 16:9, c'est le second. C'est ce que « pour la
# demande courante » veut dire, et c'est ce qui sépare ce tri d'un classement
# figé par modèle.
AU_JETON = ModeleVideo(
    identifiant="essai:au-jeton",
    nom="Au jeton",
    fournisseur="essai",
    chez_lui="au-jeton",
    durees=(5,),
    resolutions=("480p", "720p"),
    proportions=("1:1", "16:9"),
    tarification=Tarification(genre="jeton", montant=0.0000035, libelle="video_tokens"),
)
A_LA_SECONDE = ModeleVideo(
    identifiant="essai:a-la-seconde",
    nom="À la seconde",
    fournisseur="essai",
    chez_lui="a-la-seconde",
    durees=(5,),
    resolutions=("480p",),
    proportions=("1:1", "16:9"),
    tarification=Tarification(genre="seconde", montant=0.025, libelle="duration_seconds"),
)


@pytest.fixture
def client_trie(tmp_path, double):
    """Un atelier dont le double rend les modèles dans le désordre du
    fournisseur — payants d'abord, maison au milieu — pour que le tri de la
    route ait quelque chose à prouver."""
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application
    from atelier.services import Atelier

    animateur = AnimateurDouble([AU_JETON, MAISON, A_LA_SECONDE])
    atelier = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    with TestClient(creer_application(atelier)) as client:
        yield client


def test_la_liste_arrive_triee_le_local_d_abord_puis_par_prix(client_trie):
    """*La liste arrive triée du serveur : le local gratuit en tête, puis les
    payants par prix croissant pour la demande courante.*

    Le double déclare les modèles dans un ordre sans rapport — payants
    d'abord —, et la route rend autre chose : la maison d'abord, puis le moins
    cher, puis le plus cher. **L'écran n'a pas de règle de tri à lui** : il
    reçoit la liste et la rend dans cet ordre.
    """
    lignes = client_trie.get("/api/clips/models?secondes=5").json()["modeles"]
    assert [l["nom"] for l in lignes] == ["Wan maison", "Au jeton", "À la seconde"]
    # Deux vérifications de fond, au passage : la maison porte son zéro en
    # « certain » et non en « estimation » — c'est ce qui la met en tête sans
    # qu'on ait à deviner pourquoi.
    maison = lignes[0]
    assert maison["de_la_maison"] is True
    assert maison["prix"]["montant"] == 0
    assert maison["prix"]["nature"] == "certain"


def test_le_tri_suit_la_demande_courante_pas_un_classement_fige(client_trie):
    """*Par prix croissant pour la demande courante.* En carré, le modèle au
    jeton coûte moins ; en 16:9, la surface le fait passer derrière le modèle à
    la seconde. Le tri suit — c'est ce qui le distingue d'un classement figé
    par modèle, qui mentirait à chaque changement de format.
    """
    carre = client_trie.get("/api/clips/models?secondes=5&proportions=1:1").json()[
        "modeles"
    ]
    large = client_trie.get("/api/clips/models?secondes=5&proportions=16:9").json()[
        "modeles"
    ]
    assert [l["nom"] for l in carre] == ["Wan maison", "Au jeton", "À la seconde"]
    assert [l["nom"] for l in large] == ["Wan maison", "À la seconde", "Au jeton"]
    # Et les prix le disent vraiment : le 16:9 multiplie le jeton par 1,77.
    prix = lambda lignes, nom: next(  # noqa: E731
        l["prix"]["montant"] for l in lignes if l["nom"] == nom
    )
    assert prix(large, "Au jeton") == pytest.approx(0.1677, abs=1e-3)
    assert prix(large, "À la seconde") == pytest.approx(0.125)