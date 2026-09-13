# -*- coding: utf-8 -*-
"""B15 — l'installation : ce qu'on branche une fois sur cette machine.

**Planche** : `docs/archive/pistes-2026-09-04/carnet/Installation.dc.html`, bloquée par
`B0`. C'est la seule tranche du plan qui pose un secret **et** qui écrit sur le
disque de quelqu'un, et ce fichier est écrit pour ça.

**Trois des six critères de la tranche étaient déjà tenus, et déjà mesurés.**
Le relevé du 9 septembre 2026 les a retrouvés un par un, et ce fichier ne les
recopie pas — un essai en double se désaccorde de son jumeau au premier
changement, et l'on ne sait alors plus lequel dit vrai :

- *retirer une clé grise les modèles de ce fournisseur-là, et n'efface ni image
  ni dépense* → `tests/test_f3.py::test_retirer_grise_ses_modeles_et_n_efface_rien`,
  qui le mesure sur une image réelle et sur sa ligne de dépense ;
- *un fournisseur injoignable grise ses modèles à lui, jamais ceux d'un autre* →
  `tests/test_f1.py::test_ce_qui_manque_a_un_fournisseur_grise_ses_modeles_et_eux_seuls`
  et `::test_couper_un_seul_fournisseur_ne_touche_pas_a_l_autre` ;
- *sur une machine où rien n'a été déposé, une image arrive quand même* →
  `tests/test_f1.py::test_sans_aucune_cle_le_defaut_glisse_vers_le_gratuit_et_l_image_arrive`.

**Ce qui reste, et que ce fichier mesure** :

1. **La vérification d'un compte** — le compte de modèles et la réserve, en une
   phrase, et **jamais la valeur essayée**. C'était le seul critère de la
   tranche qui demandait du code neuf côté fournisseur : `openrouter.py` écrivait
   lui-même que *« le solde d'un compte OpenRouter n'est lu par aucune route »*.
2. **L'adresse de ComfyUI** — elle ne se changeait **pas du tout** avant `B15` :
   `ATELIER_COMFY` était cité par un commentaire de `maison.py` et lu par
   personne, une seule occurrence dans tout le dépôt.
3. **Le dossier de travail** — il se choisit, il prend effet au démarrage
   suivant, et **rien n'est déplacé, créé en douce, ni effacé**. Quatre essais
   sur cinq de cette section mesurent une *absence* : ce qui n'est pas arrivé au
   disque.
4. **Le tour du propriétaire** — il ne peut pas surgir chez quelqu'un qui
   travaille.

⚠️ **Aucun essai de ce fichier ne touche un vrai fournisseur, un vrai ComfyUI,
ni le `.env` de l'auteur.** Les fournisseurs sont des doubles ; les deux essais
qui exercent le vrai adaptateur OpenRouter passent par `httpx.MockTransport`,
son seul point d'entrée d'essai. Chaque essai qui écrit déplace `FICHIER_ENV`
**et** `FICHIER_INSTALLATION` dans son propre dossier temporaire.

⚠️ **Les valeurs de secret posées ici sont explicitement fictives** —
`CLE_FICTIVE` ne ressemble à aucune clé de production, et c'est délibéré : une
valeur d'essai qui ressemble à une vraie finit par être lue comme une vraie.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from atelier import reglages
from atelier.api.app import creer_application
from atelier.depot import Fichiers
from atelier.domaine.installation import AdresseRefusee, lire_adresse
from atelier.domaine.secret import Secret
from atelier.fournisseur.maison import BASE_PAR_DEFAUT, MoteurDeLaMaison
from atelier.fournisseur.openrouter import CLE, OpenRouter
from atelier.services import Atelier, _maison
from atelier.services.installation import ServiceInstallation

from conftest import AnimateurMuet, FournisseurDouble

# **Une valeur qui ne ressemble à rien.** Pas de `sk-`, pas de longueur
# plausible, pas de forme de vrai jeton : un essai qui poserait quelque chose
# d'approchant finirait un jour recopié quelque part comme si c'en était une.
CLE_FICTIVE = "essai-1234567890"

PLACE = Secret(
    nom="ESSAI_INSTALLATION_KEY",
    libelle="la clé",
    aucun="aucune clé",
    ou="exemple.invalide/cles",
)


# ── Les doubles ──────────────────────────────────────────────────────────────


class FournisseurAVerifier(FournisseurDouble):
    """Un fournisseur qui demande une clé **et sait dire ce qu'il lui reste**.

    `solde()` est optionnel sur le port, comme `compte()` et `secrets()` avant
    lui : ce double l'écrit pour que la vérification ait quelque chose à lire,
    et aucun autre double du dépôt n'a eu à changer.
    """

    nom = "aVerifier"

    def __init__(self) -> None:
        super().__init__()
        self.secrets_declares = (PLACE,)
        self.soldes_rendus = 0
        self.solde_dit: str | None = "il reste $4,84 sur ce compte"
        self.solde_leve: Exception | None = None

    async def solde(self) -> str | None:
        self.soldes_rendus += 1
        if self.solde_leve is not None:
            raise self.solde_leve
        return self.solde_dit


class FournisseurMuet(FournisseurDouble):
    """Un second fournisseur, qui ne demande rien et ne sait rien du solde."""

    nom = "muet"


@pytest.fixture
def machine(tmp_path, monkeypatch) -> Path:
    """Un `.env` et un `installation.json` à soi, et l'environnement écarté.

    **Sans ça, un essai lirait les fichiers de l'auteur — et pire, en
    écrirait.** `installation.json` est particulièrement dangereux à ce
    titre-là : il porte le dossier de travail, et un essai qui en écrirait un
    dans le dépôt ferait démarrer le vrai atelier ailleurs au lancement suivant.

    Les deux noms d'environnement sont retirés pour la raison de
    `tests/test_f3.py` : une valeur qui y traînerait masquerait le fichier, et
    l'essai mesurerait autre chose que ce qu'il croit.
    """
    monkeypatch.setattr(reglages, "FICHIER_ENV", tmp_path / ".env")
    monkeypatch.setattr(reglages, "FICHIER_INSTALLATION", tmp_path / "installation.json")
    for nom in (reglages.DOSSIER_ENV, reglages.COMFY_ENV, PLACE.nom, CLE.nom):
        monkeypatch.delenv(nom, raising=False)
    return tmp_path


@pytest.fixture
def verifiable() -> FournisseurAVerifier:
    return FournisseurAVerifier()


@pytest.fixture
def muet() -> FournisseurMuet:
    return FournisseurMuet()


@pytest.fixture
def deux(machine, verifiable, muet) -> Atelier:
    """Deux fournisseurs, dont un seul demande une clé et sait dire son solde."""
    return Atelier(
        racine=machine / "donnees",
        fabriques_fournisseurs=[lambda: verifiable, lambda: muet],
        fabrique_animateur=lambda: AnimateurMuet(),
    )


@pytest.fixture
def client(deux) -> TestClient:
    with TestClient(creer_application(deux)) as client:
        yield client


def _installation(client: TestClient) -> dict:
    reponse = client.get("/api/install")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


def _verifier(client: TestClient, fournisseur: str) -> dict:
    reponse = client.post(f"/api/install/check/{fournisseur}")
    assert reponse.status_code == 200, reponse.text
    return reponse.json()


# ── « La clé se pose depuis l'écran, et la vérification annonce ce qu'elle
#     ouvre » ────────────────────────────────────────────────────────────────


def test_la_verification_annonce_le_compte_de_modeles_et_la_reserve(client, verifiable):
    """Les deux moitiés de la phrase de la planche, **comptées et non écrites**.

    Le nombre vient du catalogue que le fournisseur sert vraiment ; la réserve
    vient de lui aussi. Aucun des deux n'est en dur — la planche écrit « 49 »
    sept fois, et la photo du catalogue en portait 51 le jour de la tranche.
    """
    client.put(f"/api/settings/keys/{PLACE.nom}", json={"valeur": CLE_FICTIVE})

    dit = _verifier(client, "aVerifier")

    assert dit["joignable"] is True
    assert dit["modeles"] == 2, "le double sert deux modèles, et c'est ce qu'on compte"
    assert dit["reserve"] == "il reste $4,84 sur ce compte"
    assert dit["phrase"] == "2 modèles trouvés · il reste $4,84 sur ce compte"


def test_sans_cle_la_verification_dit_ce_qui_manque_et_n_appelle_rien(
    client, verifiable
):
    """**On n'appelle pas un fournisseur à qui il manque ce qu'il demande.**

    Sa phrase de manque est déjà la bonne réponse — et c'est la même que celle
    qui grise ses modèles, jamais une seconde rédaction. Le compteur d'appels du
    double le prouve : ni catalogue, ni solde.
    """
    verifiable.manque = "aucune clé aVerifier"
    avant = verifiable.appels

    dit = _verifier(client, "aVerifier")

    assert dit["joignable"] is False
    assert dit["raison"] == "aucune clé aVerifier"
    assert dit["phrase"] == "aucune clé aVerifier"
    assert dit["modeles"] == 0
    assert verifiable.soldes_rendus == 0, "le solde n'a pas été demandé"
    assert verifiable.appels == avant


def test_un_solde_illisible_ne_devient_jamais_un_zero(client, verifiable):
    """*Le solde n'a pas été lu* est une réponse ; `$0,00` en serait une fausse.

    Un compte vide et un compte qu'on n'a pas su lire ne se ressemblent que sur
    un écran qui écrit un chiffre dans les deux cas — et l'un des deux ferait
    recharger un compte qui ne le demandait pas.
    """
    verifiable.solde_dit = None

    dit = _verifier(client, "aVerifier")

    assert dit["joignable"] is True
    assert dit["reserve"] is None
    assert dit["phrase"] == "2 modèles trouvés · le solde n’a pas été lu"
    assert "$" not in dit["phrase"], "aucun montant inventé"


def test_une_cle_refusee_se_dit_et_le_compte_ne_couvre_pas_le_refus(client, verifiable):
    """**Une clé refusée est la seule nouvelle de cet écran-là.**

    Le catalogue d'OpenRouter est public : il répond sans clé, et son compte de
    modèles ne prouve donc rien. Quand le solde dit non, c'est *ça* que la
    phrase porte, et le nombre de modèles passe au second plan.
    """
    from atelier.domaine.erreurs import AppelRefuse

    verifiable.solde_leve = AppelRefuse("la clé n'a pas été acceptée par aVerifier")

    dit = _verifier(client, "aVerifier")

    assert dit["joignable"] is False
    assert dit["phrase"] == "la clé n'a pas été acceptée par aVerifier"
    assert dit["modeles"] == 2, "on les a comptés quand même, l'écran ne les affiche pas"


def test_verifier_un_fournisseur_ne_dit_rien_de_l_autre(client, verifiable, muet):
    """Le critère 3 de la tranche, pris par la vérification plutôt que par le grisé.

    Un fournisseur qui n'a rien à dire de son solde reste **joignable** : ne rien
    tenir n'est pas une panne, et le confondre avec une panne griserait un
    fournisseur qui marche.
    """
    verifiable.manque = "aucune clé aVerifier"

    casse = _verifier(client, "aVerifier")
    entier = _verifier(client, "muet")

    assert casse["joignable"] is False
    assert entier["joignable"] is True
    assert entier["reserve"] is None
    assert entier["modeles"] == 2


def test_aucune_valeur_de_secret_ne_sort_de_l_installation(client, machine):
    """⚠️ **Le garde-fou de toute la tranche.**

    Une clé est posée, puis **toutes** les routes de l'installation sont
    balayées, corps entier. La valeur n'apparaît nulle part, et pas davantage un
    fragment plus long que l'aperçu de six caractères qui existe depuis T1.
    """
    client.put(f"/api/settings/keys/{PLACE.nom}", json={"valeur": CLE_FICTIVE})

    corps = "\n".join(
        [
            client.get("/api/install").text,
            client.post("/api/install/check/aVerifier").text,
            client.post("/api/install/check/muet").text,
            client.get("/api/settings/keys").text,
            client.get("/api/status").text,
            client.post(
                "/api/install/workspace/check", json={"chemin": str(machine)}
            ).text,
        ]
    )

    assert CLE_FICTIVE not in corps
    # Six caractères, et pas un de plus : l'aperçu est `…567890`, donc `4567890`
    # ne doit jamais paraître.
    assert CLE_FICTIVE[-6:] in client.get("/api/settings/keys").text
    assert CLE_FICTIVE[-7:] not in corps


def test_le_pointeur_d_installation_ne_porte_aucun_secret(client, machine):
    """`installation.json` décrit **une machine**, jamais un compte.

    Les deux fichiers vivent côte à côte à la racine, et il aurait été facile de
    ranger une clé dans le second parce qu'il est en JSON et que c'est plus
    commode. Le contenu est donc vérifié champ par champ.
    """
    client.put(f"/api/settings/keys/{PLACE.nom}", json={"valeur": CLE_FICTIVE})
    client.put("/api/install/comfy", json={"adresse": "127.0.0.1:9999"})

    ecrit = json.loads((machine / "installation.json").read_text(encoding="utf-8"))

    assert set(ecrit) <= {"dossier", "comfy", "tour_fait"}
    assert CLE_FICTIVE not in json.dumps(ecrit)


# ── « ComfyUI se détecte, et son adresse se change » ─────────────────────────


def test_avant_b15_l_adresse_de_comfy_ne_se_changeait_pas_du_tout(machine):
    """Le relevé, gardé sous forme d'essai — **et il refuserait un retour en arrière**.

    `ATELIER_COMFY` était cité par un commentaire de `atelier/fournisseur/maison.py`
    et lu par **personne** : une seule occurrence dans tout le dépôt. Cet essai
    vérifie que le nom est désormais vraiment lu, dans les deux sens : posé, il
    déplace l'adresse ; absent, on retombe sur le port par défaut de ComfyUI.
    """
    assert reglages.adresse_comfy(BASE_PAR_DEFAUT) == BASE_PAR_DEFAUT
    assert reglages.origine_de_l_adresse() == "defaut"


def test_l_environnement_passe_devant_le_fichier(machine, monkeypatch):
    """L'ordre des secrets, repris tel quel : **ce que la machine impose gagne**.

    Et l'écran doit pouvoir le dire — sans quoi on chercherait longtemps
    pourquoi un réglage écrit ne s'applique pas.
    """
    reglages.poser_installation(comfy="http://depuis-le-fichier:1")
    monkeypatch.setenv(reglages.COMFY_ENV, "http://depuis-la-machine:2")

    assert reglages.adresse_comfy(BASE_PAR_DEFAUT) == "http://depuis-la-machine:2"
    assert reglages.origine_de_l_adresse() == "environnement"


def test_l_adresse_posee_prend_effet_sans_redemarrer(client, machine):
    """**Le moteur gardé se refabrique quand son adresse change** — et lui seul.

    `MoteurDeLaMaison` est le seul adaptateur du dépôt qui se garde, pour deux
    raisons écrites dans son code. Une adresse changée sur un objet gardé
    n'aurait jamais été relue : le réglage se serait écrit sans agir, ce qui est
    le pire des deux.

    Vérifié sur l'objet que `_maison()` rend, pas sur le fichier : c'est lui qui
    parle à ComfyUI.
    """
    avant = _maison()
    assert isinstance(avant, MoteurDeLaMaison)
    assert avant.adresse == BASE_PAR_DEFAUT

    pose = client.put("/api/install/comfy", json={"adresse": "10.0.0.4:8188"})
    assert pose.status_code == 200, pose.text
    assert pose.json() == {"comfy": "http://10.0.0.4:8188", "origine": "fichier"}

    apres = _maison()
    assert apres.adresse == "http://10.0.0.4:8188"
    assert apres is not avant, "l'objet gardé a bien été refabriqué"

    # …et il ne se refabrique pas quand rien ne change : c'est tout le sens de
    # le garder.
    assert _maison() is apres


def test_l_adresse_se_remet_a_celle_d_origine(client, machine):
    """Revenir en arrière sans avoir à retaper le port de ComfyUI par cœur."""
    client.put("/api/install/comfy", json={"adresse": "10.0.0.4:8188"})

    remise = client.delete("/api/install/comfy")

    assert remise.status_code == 200, remise.text
    assert remise.json() == {"comfy": BASE_PAR_DEFAUT, "origine": "defaut"}
    assert _installation(client)["comfy"] == BASE_PAR_DEFAUT


@pytest.mark.parametrize(
    "tape, attendu",
    [
        ("127.0.0.1:8188", "http://127.0.0.1:8188"),
        ("  http://127.0.0.1:8188/  ", "http://127.0.0.1:8188"),
        ("http://ailleurs:8188/comfy/?x=1#a", "http://ailleurs:8188"),
        ("https://comfy.chez-moi", "https://comfy.chez-moi"),
    ],
)
def test_une_adresse_se_normalise_avant_d_etre_ecrite(tape, attendu):
    """Quatre fautes de frappe qu'on fait vraiment, et ce qu'on en garde.

    Le chemin, la requête et l'ancre tombent : l'adaptateur compose ses propres
    chemins (`/system_stats`, `/prompt`), et une base qui en porterait un
    donnerait `…/comfy/system_stats` sans que rien ne le dise. La barre finale
    tombe aussi — **c'est cette comparaison-là qui décide si le moteur gardé se
    refabrique**, et deux écritures de la même adresse ne doivent pas faire deux
    adresses.
    """
    assert lire_adresse(tape) == attendu


@pytest.mark.parametrize("tape", ["", "   ", "ftp://truc", "http://"])
def test_une_adresse_qui_n_en_est_pas_une_est_refusee_avant_le_premier_appel(tape):
    """**Refusée avant la requête, et avec sa raison.**

    Laisser partir un texte quelconque dans une adresse de requête, c'est
    laisser choisir la cible à quelqu'un qui croyait taper un port.
    """
    with pytest.raises(AdresseRefusee) as leve:
        lire_adresse(tape)
    assert leve.value.raison
    assert leve.value.ou_aller == "reglages"


def test_une_adresse_refusee_par_la_route_ne_change_rien(client, machine):
    """Un refus ne laisse pas la moitié du réglage écrit."""
    client.put("/api/install/comfy", json={"adresse": "10.0.0.4:8188"})

    casse = client.put("/api/install/comfy", json={"adresse": "ftp://truc"})

    assert casse.status_code == 400
    assert casse.json()["code"] == "adresse_refusee"
    assert _installation(client)["comfy"] == "http://10.0.0.4:8188"


# ── « Le dossier de travail se choisit, et l'écran dit ce qui s'y range » ────


def test_le_dossier_pose_prend_effet_au_prochain_demarrage(client, machine):
    """**Le seul point de résolution du produit**, et il suit le réglage.

    `Fichiers.__init__` est le seul lecteur de `dossier_de_travail()` dans tout
    `atelier/` — c'est ce qui rend le dossier déplaçable sans toucher un appel
    ailleurs. L'essai mesure là, sur un `Fichiers` neuf, c'est-à-dire sur ce que
    l'atelier fera au démarrage suivant.
    """
    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()

    assert Fichiers().racine != ailleurs

    pose = client.put("/api/install/workspace", json={"chemin": str(ailleurs)})
    assert pose.status_code == 200, pose.text

    assert Fichiers().racine == ailleurs
    assert reglages.origine_du_dossier() == "fichier"


def test_l_ecran_montre_les_deux_dossiers_tant_qu_on_n_a_pas_redemarre(client, machine):
    """**Deux chemins, parce qu'il y a vraiment deux chemins.**

    Entre le clic et le redémarrage, l'atelier écrit encore dans l'ancien et
    rangera dans le neuf. L'état ne rendait que le premier, avec l'origine du
    second : l'écran affichait l'ancien chemin sous la phrase « il a été choisi
    ici », ce qui se lit comme un réglage qui n'a pas pris. Vu au navigateur le
    9 septembre 2026 — chacune des deux valeurs, prise seule, était juste.
    """
    avant = _installation(client)
    assert avant["dossier_au_prochain_demarrage"] == "", (
        "sans réglage posé, il n'y a qu'un dossier à montrer — et cet atelier-ci "
        "est monté sur une racine explicite, comme tous les essais du dépôt"
    )

    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()
    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})

    apres = _installation(client)
    assert apres["dossier"] == avant["dossier"], "l'atelier écrit toujours là"
    assert Path(apres["dossier_au_prochain_demarrage"]) == ailleurs


def test_reposer_le_dossier_en_service_efface_le_second_chemin(client, machine):
    """Revenir sur ses pas ne laisse pas l'écran annoncer un déménagement.

    Le champ dit *ce qui change au prochain démarrage* ; poser le dossier sur
    lequel l'atelier tourne déjà ne change rien, et il doit redevenir vide.
    """
    en_service = Path(_installation(client)["dossier"])
    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()
    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})
    assert _installation(client)["dossier_au_prochain_demarrage"] != ""

    client.put("/api/install/workspace", json={"chemin": str(en_service)})

    assert _installation(client)["dossier_au_prochain_demarrage"] == ""


def test_poser_un_dossier_ne_deplace_ni_ne_copie_ni_n_efface_rien(client, machine):
    """⚠️ **L'essai qui tient le garde-fou de la tranche.**

    Ce qui se mesure ici est une **absence** : après avoir posé une autre
    adresse, l'ancien dossier porte exactement les mêmes fichiers, au nom et à
    l'octet près, et le nouveau est resté vide. Déménager des gigaoctets sous
    une base SQLite ouverte aurait été le seul geste irréversible de la V4.
    """
    ancien = Path(_installation(client)["dossier"])
    temoin = ancien / "temoin.txt"
    temoin.write_text("ce fichier ne doit pas bouger", encoding="utf-8")
    avant = sorted(p.name for p in ancien.iterdir())

    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()
    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})

    assert sorted(p.name for p in ancien.iterdir()) == avant
    assert temoin.read_text(encoding="utf-8") == "ce fichier ne doit pas bouger"
    assert list(ailleurs.iterdir()) == [], "rien n'a été recopié dans le nouveau"


def test_un_dossier_absent_est_refuse_et_ne_se_cree_pas_tout_seul(client, machine):
    """**Deux gestes, et le premier ne crée rien.**

    Sur Windows un chemin se tape à la main, et `C:\\Uesrs\\…` est une faute de
    frappe qu'on fait vraiment. Un `mkdir` obligeant sèmerait un dossier vide à
    chaque essai raté — et pointerait l'atelier dessus par-dessus le marché.
    """
    absent = machine / "jamais-cree"

    refus = client.put("/api/install/workspace", json={"chemin": str(absent)})

    assert refus.status_code == 400
    assert refus.json()["raison"] == "ce dossier n'existe pas encore"
    assert not absent.exists(), "rien n'a été créé"
    assert reglages.origine_du_dossier() == "defaut", "et rien n'a été écrit"


def test_le_second_geste_cree_le_dossier_et_ne_le_pose_pas(client, machine):
    """Créer et choisir sont deux effets, donc deux appels.

    Les confondre ferait d'une faute de frappe un dossier semé quelque part
    **et** un atelier qui pointe dessus.
    """
    neuf = machine / "un-dossier-neuf"

    cree = client.post("/api/install/workspace/create", json={"chemin": str(neuf)})

    assert cree.status_code == 200, cree.text
    assert cree.json()["utilisable"] is True
    assert neuf.is_dir()
    assert reglages.origine_du_dossier() == "defaut", "créé, mais pas encore choisi"


def test_un_chemin_qui_designe_un_fichier_est_refuse(client, machine):
    """Trois refus, jamais un seul mot pour les trois : ils ne se réparent pas
    du même geste, et celui-ci ne se répare pas d'un bouton."""
    fichier = machine / "pas-un-dossier.txt"
    fichier.write_text("bonjour", encoding="utf-8")

    vu = client.post("/api/install/workspace/check", json={"chemin": str(fichier)})

    assert vu.status_code == 200, vu.text
    assert vu.json()["refus"] == "ce chemin désigne un fichier, pas un dossier"
    assert vu.json()["utilisable"] is False
    assert fichier.read_text(encoding="utf-8") == "bonjour", "il n'a pas été touché"


def test_un_dossier_deja_plein_n_est_pas_un_refus_et_dit_ce_qu_il_porte(
    client, machine
):
    """**C'est même le chemin normal d'un déménagement** : on copie à la main,
    puis on pointe. Un refus aurait interdit exactement le geste que la tranche
    demande à l'auteur de faire lui-même.
    """
    deja = machine / "deja-plein"
    (deja / "projets").mkdir(parents=True)
    (deja / "atelier.sqlite3").write_bytes(b"")

    vu = client.post("/api/install/workspace/check", json={"chemin": str(deja)})

    assert vu.json()["refus"] is None
    assert vu.json()["utilisable"] is True
    assert sorted(vu.json()["contenu"]) == ["atelier.sqlite3", "projets"]


def test_l_examen_d_un_dossier_ne_laisse_aucun_fichier_derriere(client, machine):
    """Savoir si l'atelier peut écrire là demande d'essayer — `os.access` ment
    sur Windows. **Mais on ne laisse rien** : le fichier d'essai s'efface à la
    fermeture, et le dossier est aussi vide après qu'avant.
    """
    vide = machine / "tout-vide"
    vide.mkdir()

    client.post("/api/install/workspace/check", json={"chemin": str(vide)})

    assert list(vide.iterdir()) == []


def test_le_fichier_des_cles_ne_suit_pas_le_dossier_de_travail(client, machine):
    """⚠️ **La planche se contredit là-dessus, et c'est l'étape 2 qui gagne.**

    Son étape 2 met `.env` « à côté de l'application » ; l'arbre de son étape 4
    le range dans le dossier de travail. Déplacer un fichier de secrets est le
    geste le plus dangereux qu'on puisse faire ici, et une clé qui suivrait un
    réglage disparaîtrait au premier changement d'adresse.
    """
    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()
    avant = _installation(client)["fichier_env"]

    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})

    assert _installation(client)["fichier_env"] == avant
    assert not str(ailleurs) in avant


def test_l_ecran_dit_ce_qui_s_y_range_et_ce_qui_ne_se_refait_pas(client, machine):
    """La mesure du disque, poste par poste — **et `recalculable` est la seule
    colonne qui compte**.

    Une image reçue d'un fournisseur a été payée et ne se refait pas ; un rendu
    se refait en millisecondes depuis elle (T2). Les additionner ferait croire
    qu'on peut libérer les deux.
    """
    racine = Path(_installation(client)["dossier"])
    (racine / "generations" / "abc").mkdir(parents=True, exist_ok=True)
    (racine / "generations" / "abc" / "0-brut.png").write_bytes(b"x" * 4096)
    (racine / "generations" / "abc" / "0-rendu.png").write_bytes(b"y" * 2048)

    disque = _installation(client)["disque"]
    par_nom = {p["nom"]: p for p in disque["postes"]}

    assert par_nom["Les images et les clips reçus"]["octets"] == 4096
    assert par_nom["Les images et les clips reçus"]["recalculable"] is False
    assert par_nom["Les rendus"]["octets"] == 2048
    assert par_nom["Les rendus"]["recalculable"] is True
    assert disque["recalculable_mo"] < disque["total_mo"]


def test_l_installation_n_offre_aucun_geste_qui_efface():
    """⚠️ **`B15` mesure, elle n'efface pas** — et cet essai le verrouille.

    La planche dessine un bouton *Vider les rendus* ; il n'est pas construit.
    Une suppression de masse pilotée par un motif de nom est le piège que
    `docs/PIEGES.md` a déjà payé une fois, et aucun critère de cette tranche ne
    la demande. Le jour où quelqu'un l'ajoutera, cet essai tombera et lui
    rappellera qu'elle mérite ses propres essais.

    Mesuré sur la **table de routage**, pas sur une intention : c'est la seule
    façon de dire *il n'existe aucun chemin* plutôt que *je n'en ai pas écrit*.
    """
    from atelier.api.routes import routeur

    installation = {
        (route.path, methode)
        for route in routeur.routes
        if getattr(route, "path", "").startswith("/install")
        for methode in getattr(route, "methods", set())
    }

    assert installation, "les routes de l'installation existent bien"
    # Le seul DELETE de l'installation remet une adresse à son défaut : il ne
    # touche à aucun fichier de données.
    assert {chemin for chemin, methode in installation if methode == "DELETE"} == {
        "/install/comfy"
    }


# ── « Le tour du propriétaire ne surgit pas chez quelqu'un qui travaille » ───


def test_le_tour_s_ouvre_sur_un_atelier_neuf_et_se_ferme_pour_de_bon(client, machine):
    """Deux conditions, et la seconde est celle qui protège.

    *L'atelier n'a encore rien* est un fait du disque — `ServiceBibliotheque.neuf()`,
    écrite en E19 et réemployée telle quelle plutôt que réécrite. *A-t-on déjà
    proposé ce tour ?* est l'autre moitié, et aucun fait du disque n'y répond :
    passer les quatre étapes ne laisse **par construction** aucune trace.
    """
    assert _installation(client)["premiere_ouverture"] is True

    fini = client.post("/api/install/done")

    assert fini.status_code == 200, fini.text
    assert fini.json()["premiere_ouverture"] is False
    assert _installation(client)["premiere_ouverture"] is False


def test_le_tour_ne_surgit_jamais_sur_un_atelier_qui_travaille(client, machine, deux):
    """**Le seul vrai dégât qu'un écran gratuit puisse faire**, et il n'arrive pas.

    Un guide de bienvenue qui prendrait la fenêtre entière chez quelqu'un qui a
    trois jeux ouverts serait une porte qui se referme sur lui. Il suffit d'un
    second jeu pour que `neuf()` cesse d'être vrai.
    """
    cree = client.post("/api/projects", json={"nom": "Le Marais"})
    assert cree.status_code in (200, 201), cree.text

    assert _installation(client)["premiere_ouverture"] is False
    assert not (machine / "installation.json").exists(), (
        "et aucun drapeau n'a eu à être écrit pour ça"
    )


def test_les_jeux_de_la_machine_sont_ceux_du_dossier_de_travail(client):
    """L'écran montre les jeux déjà là. **Comptés, jamais devinés.**"""
    client.post("/api/projects", json={"nom": "Les Salines"})

    assert "Les Salines" in _installation(client)["jeux"]


# ── Le pointeur d'installation lui-même ──────────────────────────────────────


def test_poser_un_reglage_n_efface_pas_les_autres(client, machine):
    """La règle de `deposer_secret`, reprise mot pour mot : **on relit, on
    remplace la sienne, on recopie le reste**. Un écran qui pose un champ à la
    fois ne doit pas effacer ce qu'un autre vient d'écrire.
    """
    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()

    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})
    client.put("/api/install/comfy", json={"adresse": "10.0.0.4:8188"})
    client.post("/api/install/done")

    ecrit = reglages.lire_installation()

    assert ecrit["dossier"] == str(ailleurs)
    assert ecrit["comfy"] == "http://10.0.0.4:8188"
    assert ecrit["tour_fait"] is True


def test_un_pointeur_abime_ne_ferme_pas_l_atelier(machine):
    """**Un réglage facultatif mal formé n'empêche pas de démarrer.**

    C'est la règle de `Fichiers._lire_json`, appliquée un cran plus tôt — avant
    même qu'un dossier de travail existe. Le pire cas est un fichier tronqué ou
    écrit en UTF-16 par PowerShell (`docs/PIEGES.md`) : on retombe sur les
    valeurs d'origine, et l'atelier s'ouvre.
    """
    (machine / "installation.json").write_bytes('{"dossier": "C:\\\\ail'.encode("utf-16"))

    assert reglages.lire_installation() == {}
    assert reglages.dossier_de_travail() == reglages.DONNEES
    assert reglages.adresse_comfy(BASE_PAR_DEFAUT) == BASE_PAR_DEFAUT


def test_le_pointeur_vit_hors_du_dossier_qu_il_designe(client, machine):
    """Un pointeur rangé dans ce qu'il pointe ne se retrouve plus quand on
    change d'adresse. Il est donc à la racine, à côté du fichier des clés."""
    ailleurs = machine / "ailleurs"
    ailleurs.mkdir()
    client.put("/api/install/workspace", json={"chemin": str(ailleurs)})

    assert (machine / "installation.json").is_file()
    assert not (ailleurs / "installation.json").exists()


# ── Le vrai adaptateur OpenRouter, par son seul point d'entrée d'essai ───────
#
# ⚠️ **Aucun de ces essais ne touche le réseau.** `httpx.MockTransport` est le
# point d'entrée que `B15` a ajouté à `OpenRouter`, pour la raison exacte qui
# l'avait fait ajouter à `MoteurDeLaMaison` : on ne peut ni démarrer le service
# dans un essai, ni compter sur sa présence — et l'appeler pour de vrai coûterait
# de l'argent.
#
# ⚠️ **Et la forme des deux réponses n'a jamais été exercée contre le vrai
# service** depuis ce dépôt. C'est précisément pourquoi `solde()` rend `None`
# quand rien ne se lit, au lieu d'inventer un chiffre.


def _openrouter(reponses: dict[str, httpx.Response]) -> OpenRouter:
    def repondre(requete: httpx.Request) -> httpx.Response:
        assert requete.headers.get("Authorization") == f"Bearer {CLE_FICTIVE}"
        for chemin, reponse in reponses.items():
            if requete.url.path.endswith(chemin):
                return reponse
        return httpx.Response(404, json={})

    return OpenRouter(CLE_FICTIVE, transport=httpx.MockTransport(repondre))


async def test_le_solde_se_lit_sur_la_premiere_forme():
    """`GET /credits` — ce qui a été mis dessus, moins ce qui a été dépensé."""
    fournisseur = _openrouter(
        {
            "/credits": httpx.Response(
                200, json={"data": {"total_credits": 10.0, "total_usage": 5.16}}
            )
        }
    )

    assert await fournisseur.solde() == "il reste $4,84 sur ce compte"


async def test_le_solde_retombe_sur_la_seconde_forme():
    """`GET /key` — ce qu'il reste sous le plafond de cette clé-là.

    Le produit n'a pas à savoir laquelle des deux formes est en vigueur ce
    mois-ci : il essaie, et il prend celle qui répond.
    """
    fournisseur = _openrouter(
        {
            "/credits": httpx.Response(500, json={}),
            "/key": httpx.Response(200, json={"data": {"limit_remaining": 2.5}}),
        }
    )

    assert await fournisseur.solde() == "il reste $2,50 sur ce compte"


async def test_un_solde_qui_n_est_pas_un_nombre_ne_se_lit_pas():
    """**Une chaîne n'est pas un nombre ici**, et `float("illimité")` lèverait
    au milieu d'un écran. On ne lit que ce qui est déjà un nombre."""
    fournisseur = _openrouter(
        {
            "/credits": httpx.Response(200, json={"data": {"total_credits": "beaucoup"}}),
            "/key": httpx.Response(200, json={"data": {}}),
        }
    )

    assert await fournisseur.solde() is None


async def test_une_cle_refusee_par_openrouter_le_dit_sans_montrer_la_cle():
    """Un refus n'est pas un silence : c'est ce qui distingue *je n'ai pas su
    lire* de *on m'a dit non*. Et la phrase ne porte pas la clé."""
    from atelier.domaine.erreurs import AppelRefuse

    fournisseur = _openrouter({"/credits": httpx.Response(401, json={})})

    with pytest.raises(AppelRefuse) as leve:
        await fournisseur.solde()

    assert leve.value.raison == "la clé n'a pas été acceptée par OpenRouter"
    assert CLE_FICTIVE not in leve.value.raison


async def test_sans_cle_openrouter_ne_demande_aucun_solde():
    """**Il n'appelle pas** : le catalogue est public, le solde ne l'est pas, et
    demander un solde sans clé serait un appel qu'on sait perdu d'avance."""

    def jamais(requete: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("aucun appel ne devait partir")

    assert await OpenRouter("", transport=httpx.MockTransport(jamais)).solde() is None


# ── Le service, hors de la route ─────────────────────────────────────────────


def test_le_service_ne_lit_le_disque_qu_a_l_interieur_du_dossier_de_travail(
    machine, deux
):
    """La mesure porte sur le dossier de travail et **s'arrête là**.

    Un fichier posé à côté — dans le dossier parent — ne doit pas entrer dans le
    total : ce que l'écran annonce doit être ce que l'atelier occupe, pas ce que
    le disque porte.
    """
    service = ServiceInstallation(deux.fichiers, deux.bibliotheque)
    avant = service.disque().total

    (machine / "voisin.bin").write_bytes(b"z" * 8192)

    assert service.disque().total == avant
