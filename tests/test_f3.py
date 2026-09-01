# -*- coding: utf-8 -*-
"""F3 — les clés au pluriel.

Les sept critères de `docs/tranches/V2.2.md` § F3. **Aucun n'appelle un vrai
fournisseur**, et aucun ne touche au `.env` du dépôt : chaque essai qui écrit
déplace `FICHIER_ENV` dans son propre dossier temporaire.

**Ce que la tranche ferme.** Le produit avait *la* clé — une variable, une
route, un champ. F1 a fait entrer un fournisseur qui n'en demande aucune, et le
relevé du 31 août en a trouvé un qui en demande **deux** : Cloudflare veut un
identifiant de compte *et* un jeton. Un tiroir à un tiroir aurait découvert ça
en F4, au pire moment.

**Ce qui se mesure ici** : que chaque fournisseur ait sa place à lui, qu'écrire
dans l'une n'écrive dans aucune autre, qu'un fournisseur à deux places dise
**lequel** manque, qu'en retirer une grise ses modèles sans rien effacer
d'autre, que déposer serve au premier appel suivant, et qu'aucune valeur ne
sorte jamais entière. Ce que l'écran en montre — la barre de tête au pluriel,
l'étape 10 de l'assistant — vit dans `interface/src/App.test.tsx`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import Demande, Modele
from atelier.domaine.secret import Secret, ce_qui_manque
from atelier.fournisseur.port import ImageProduite
from atelier.reglages import lire_secrets
from atelier.services import Atelier

from conftest import FournisseurDouble, image_sujet
from test_f1 import FournisseurGratuit


# ── Un fournisseur qui demande deux places ───────────────────────────────────
#
# C'est la forme de Cloudflare, et elle arrive pour de bon en F4. On la joue ici
# sur un double : le tiroir doit savoir la tenir **avant** qu'un vrai
# fournisseur ne l'exige.

DEUX_PLACES = "deuxplaces"

COMPTE = Secret(
    nom="ESSAI_ACCOUNT_ID",
    libelle="le compte",
    aucun="aucun compte",
    ou="dash.example/profil",
)
JETON_DACCES = Secret(
    nom="ESSAI_API_TOKEN",
    libelle="le jeton",
    aucun="aucun jeton",
    ou="dash.example/jetons",
)

CATALOGUE_DEUX_PLACES = [
    Modele(
        identifiant=f"{DEUX_PLACES}:rend-du-png",
        nom="Essai à deux places",
        fournisseur=DEUX_PLACES,
        chez_lui="rend-du-png",
        proportions=("1:1",),
        variations_max=1,
    ),
]


class FournisseurADeuxPlaces(FournisseurDouble):
    """Deux secrets, et la phrase qui dit **lequel** manque.

    **Il relit ses valeurs en naissant**, jamais au démarrage du serveur : c'est
    la règle de T1, et c'est ce qui fait qu'une valeur déposée sert au premier
    appel suivant. Les fabriques de `Fournisseurs` le reconstruisent à chaque
    fois, ce qui rend la règle vraie sans qu'aucun essai n'ait à y penser.
    """

    nom = DEUX_PLACES

    def __init__(self) -> None:
        super().__init__()
        self.valeurs = lire_secrets((COMPTE.nom, JETON_DACCES.nom))

    def secrets(self) -> tuple[Secret, ...]:
        return (COMPTE, JETON_DACCES)

    def indisponible(self) -> str | None:
        return ce_qui_manque(self.nom, self.secrets(), self.valeurs)

    async def catalogue(self) -> list[Modele]:
        return list(CATALOGUE_DEUX_PLACES)

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        self.appels += 1
        self.demandes.append(demande)
        return ImageProduite(image_sujet(), consomme=0.01, type_media="image/png")


# ── Le montage ───────────────────────────────────────────────────────────────


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Un `.env` à soi, vide, et l'environnement de la machine écarté.

    **Sans ça, un essai lirait le vrai `.env` de l'auteur** — et pire, en
    écrirait un. Les deux noms sont retirés de l'environnement du processus :
    une valeur qui y traînerait masquerait le fichier, et l'essai mesurerait
    autre chose que ce qu'il croit.
    """
    fichier = tmp_path / ".env"
    monkeypatch.setattr("atelier.reglages.FICHIER_ENV", fichier)
    for nom in (COMPTE.nom, JETON_DACCES.nom):
        monkeypatch.delenv(nom, raising=False)
    return fichier


@pytest.fixture
def trois(tmp_path, gratuit, env) -> Atelier:
    """Les trois formes qui existent, dans un seul atelier.

    Un fournisseur qui ne demande rien, un qui demande deux places. C'est la
    liste dont le tiroir doit rendre compte, et l'ordre est celui de la
    composition — celui que l'écran affiche.
    """
    return Atelier(
        racine=tmp_path,
        fabriques_fournisseurs=[lambda: gratuit, FournisseurADeuxPlaces],
    )


@pytest.fixture
def client(trois) -> TestClient:
    with TestClient(creer_application(trois)) as client:
        yield client


@pytest.fixture
def gratuit() -> FournisseurGratuit:
    return FournisseurGratuit()


def _tiroirs(client: TestClient) -> dict:
    reponse = client.get("/api/settings/keys")
    assert reponse.status_code == 200, reponse.text
    return {t["fournisseur"]: t for t in reponse.json()["tiroirs"]}


def _poser(client: TestClient, nom: str, valeur: str):
    return client.put(f"/api/settings/keys/{nom}", json={"valeur": valeur})


# ── « Chaque fournisseur a sa place à lui, et déposer une clé ne touche à
#     aucune autre » ─────────────────────────────────────────────────────────


def test_chaque_fournisseur_a_sa_place(client):
    """**Un tiroir vide paraît quand même.**

    *« Celui-ci ne demande rien »* est un renseignement, et c'est le premier que
    l'auteur cherche sur une machine neuve. Un fournisseur qu'on cacherait
    passerait pour un fournisseur absent.
    """
    tiroirs = _tiroirs(client)

    assert set(tiroirs) == {"gratuit", DEUX_PLACES}
    assert tiroirs["gratuit"]["secrets"] == []
    assert tiroirs["gratuit"]["pret"] is True

    places = [s["nom"] for s in tiroirs[DEUX_PLACES]["secrets"]]
    assert places == [COMPTE.nom, JETON_DACCES.nom]


def test_deposer_une_cle_ne_touche_a_aucune_autre(client, env):
    """**On réécrit la sienne, on recopie les autres telles quelles.**

    C'est la ligne du fichier qui tient la règle, pas une précaution : un dépôt
    qui réécrirait le `.env` entier effacerait la clé qu'un autre fournisseur y
    avait posée — et l'auteur ne le découvrirait qu'au refus suivant.
    """
    env.write_text("AUTRE_CHOSE=laissez-moi-tranquille\n", encoding="utf-8")

    assert _poser(client, COMPTE.nom, "compte-de-lessai").status_code == 200

    texte = env.read_text(encoding="utf-8")
    assert "AUTRE_CHOSE=laissez-moi-tranquille" in texte
    assert f"{COMPTE.nom}=compte-de-lessai" in texte

    # Et la seconde place du même fournisseur est toujours vide.
    places = {s["nom"]: s for s in _tiroirs(client)[DEUX_PLACES]["secrets"]}
    assert places[COMPTE.nom]["presente"] is True
    assert places[JETON_DACCES.nom]["presente"] is False


def test_une_place_qu_aucun_fournisseur_ne_demande_est_refusee(client, env):
    """**Le produit n'écrit que dans une place déclarée.**

    Une route qui accepterait n'importe quel nom laisserait écrire n'importe
    quoi dans le `.env` de l'auteur, depuis un navigateur. C'est la seule règle
    de sécurité de la tranche, et elle vaut pour déposer comme pour retirer.
    """
    refus = _poser(client, "PATH", "n-importe-quoi-de-assez-long")
    assert refus.status_code >= 400
    assert "PATH" in refus.text

    assert client.delete("/api/settings/keys/PATH").status_code >= 400
    assert "PATH=" not in env.read_text(encoding="utf-8") if env.exists() else True


# ── « Un fournisseur qui demande deux secrets les demande tous les deux, et dit
#     lequel manque » ────────────────────────────────────────────────────────


def test_il_dit_lequel_manque(client):
    """La phrase nomme la place vide, pas le fournisseur entier.

    *« il manque, chez deuxplaces : le compte, le jeton »* — puis, une place
    remplie, la phrase se rétrécit à ce qui reste. **Un seul texte**, celui du
    fournisseur : c'est le même qui grise ses modèles, et deux rédactions
    finiraient par dire deux choses.
    """
    manque = _tiroirs(client)[DEUX_PLACES]["manque"]
    assert "le compte" in manque and "le jeton" in manque

    _poser(client, COMPTE.nom, "compte-de-lessai")

    apres = _tiroirs(client)[DEUX_PLACES]
    assert apres["pret"] is False
    assert "le jeton" in apres["manque"]
    assert "le compte" not in apres["manque"]

    _poser(client, JETON_DACCES.nom, "jeton-de-lessai-bien-long")

    fini = _tiroirs(client)[DEUX_PLACES]
    assert fini["manque"] is None and fini["pret"] is True


def test_la_phrase_du_tiroir_est_celle_du_grise(client):
    """La même, mot pour mot, jusqu'au modèle qu'elle grise.

    C'est ce qui fait qu'on ne lit jamais deux explications d'un même manque —
    et ce qui permet à la barre de tête de porter la phrase du tiroir sans la
    réécrire.
    """
    modeles = {m["identifiant"]: m for m in client.get("/api/models").json()["modeles"]}

    fiche = modeles[f"{DEUX_PLACES}:rend-du-png"]
    assert fiche["refus"] == _tiroirs(client)[DEUX_PLACES]["manque"]

    # Et celui qui ne demande rien n'est grisé par rien.
    assert modeles["gratuit:rend-du-png"]["refus"] is None


def test_il_en_reste_toujours_un(client):
    """Le critère que la barre de tête traduit : **on peut toujours produire**.

    Deux places vides chez l'un, aucune chez l'autre : l'atelier n'est jamais
    dans l'état *rien ne part*. C'est ce que F1 a rendu vrai et ce que F3
    affiche ; la barre ne dit donc *rien pour produire* qu'à un état que la
    composition du produit ne peut plus atteindre.
    """
    tiroirs = _tiroirs(client)
    assert any(t["pret"] for t in tiroirs.values())


# ── « Retirer une clé grise ses modèles et ne supprime ni une image, ni une
#     ligne de dépense » ─────────────────────────────────────────────────────


def test_retirer_grise_ses_modeles_et_n_efface_rien(client, env):
    """Ce que retirer touche : **un fichier de configuration, et rien d'autre**.

    La règle est tenue par ce qui n'est pas écrit — il n'existe aucun chemin du
    module des réglages vers `donnees/` — plutôt que par une précaution qu'il
    faudrait retenir. Cet essai le vérifie sur une image réelle : produite
    pendant que la place est remplie, elle est toujours là après le retrait, et
    sa ligne de dépense aussi.
    """
    _poser(client, COMPTE.nom, "compte-de-lessai")
    _poser(client, JETON_DACCES.nom, "jeton-de-lessai-bien-long")

    faite = client.post(
        "/api/generations",
        json={"modele": f"{DEUX_PLACES}:rend-du-png", "prompt": "un tonneau"},
    )
    assert faite.status_code == 202, faite.text
    avant = client.get("/api/spending").json()
    assert avant["total_usd"] > 0

    retrait = client.delete(f"/api/settings/keys/{JETON_DACCES.nom}")
    assert retrait.status_code == 200, retrait.text

    # Ses modèles se grisent…
    modeles = {m["identifiant"]: m for m in client.get("/api/models").json()["modeles"]}
    assert "le jeton" in modeles[f"{DEUX_PLACES}:rend-du-png"]["refus"]

    # …et l'image comme sa dépense sont intactes.
    assert client.get("/api/assets").json()["assets"], "l'image est restée"
    apres = client.get("/api/spending").json()
    assert apres["total_usd"] == avant["total_usd"]


def test_retirer_ce_qui_vient_de_l_environnement_ne_se_propose_pas(
    client, env, monkeypatch
):
    """**Un bouton qui semblerait retirer sans rien retirer serait pire que
    pas de bouton du tout.**

    Le produit n'écrit pas dans l'environnement de la machine. Une valeur qui en
    vient est donc présente, utilisable, et **non retirable** — et l'écran le
    sait sans avoir à le deviner.
    """
    monkeypatch.setenv(COMPTE.nom, "pose-par-la-machine")

    places = {s["nom"]: s for s in _tiroirs(client)[DEUX_PLACES]["secrets"]}

    assert places[COMPTE.nom]["presente"] is True
    assert places[COMPTE.nom]["origine"] == "environnement"
    assert places[COMPTE.nom]["retirable"] is False


# ── « Une clé déposée sert au premier appel suivant, sans redémarrer » ───────


def test_une_cle_deposee_sert_au_premier_appel_suivant(client, env):
    """La règle de T1, **étendue au pluriel plutôt que réécrite**.

    Rien de ce qui est lu n'est mis en cache : les fournisseurs sont
    reconstruits à chaque demande — c'est le rôle des fabriques — et chacun
    relit ses valeurs en naissant. L'essai le mesure là où ça compte : un appel
    refusé, une valeur déposée, le **même** appel accepté, sans que rien n'ait
    redémarré.
    """
    refus = client.post(
        "/api/generations",
        json={"modele": f"{DEUX_PLACES}:rend-du-png", "prompt": "un tonneau"},
    )
    assert refus.status_code == 409, refus.text

    _poser(client, COMPTE.nom, "compte-de-lessai")
    _poser(client, JETON_DACCES.nom, "jeton-de-lessai-bien-long")

    passe = client.post(
        "/api/generations",
        json={"modele": f"{DEUX_PLACES}:rend-du-png", "prompt": "un tonneau"},
    )
    assert passe.status_code == 202, passe.text


# ── « L'étape de l'assistant les propose toutes et reste une fenêtre sur le
#     même tiroir » ──────────────────────────────────────────────────────────


def test_les_deux_portes_lisent_le_meme_tiroir(client, env):
    """**Trois portes, une seule pièce.**

    L'étape 10 de l'assistant lit `/api/status`, la fenêtre des réglages lit
    `/api/settings/keys` ; les deux doivent rendre le même tiroir, sinon
    déposer d'un côté n'écrirait pas là où l'autre regarde. L'écran ne recalcule
    jamais l'état lui-même — une valeur déposée peut être masquée par
    l'environnement, et seul le serveur le sait.
    """
    _poser(client, COMPTE.nom, "compte-de-lessai")

    par_les_reglages = client.get("/api/settings/keys").json()["tiroirs"]
    par_le_statut = client.get("/api/status").json()["secrets"]

    assert par_le_statut == par_les_reglages


# ── « Aucune clé ne s'affiche jamais en entier, nulle part » ─────────────────


def test_aucune_valeur_ne_sort_jamais_entiere(client, env):
    """Six caractères, et rien de plus — depuis T1.

    L'essai regarde **les deux portes et la réponse du dépôt**, en une fois :
    c'est là que passeraient toutes les valeurs, et une seule des trois qui
    fuirait suffirait.
    """
    secrete = "compte-tres-secret-0123456789"
    depose = _poser(client, COMPTE.nom, secrete)

    partout = (
        depose.text
        + client.get("/api/settings/keys").text
        + client.get("/api/status").text
    )

    assert secrete not in partout
    assert "0123456789" not in partout
    assert "456789" in partout, "l'aperçu, lui, est là — c'est de quoi la reconnaître"
