# -*- coding: utf-8 -*-
"""L'adaptateur Pollinations — **le fournisseur qui ne demande rien**.

Arrivé en F1 (`docs/archive/plan-versions-tenues.md` § V2.2). C'est lui qui rend vraie la phrase *la
première image ne demande plus rien* : sans compte, sans clé, sans carte, on
écrit un sujet et une image arrive. Il ne sert qu'au brouillon, et le relevé du
31 août 2026 dit pourquoi — `docs/archive/releve-fournisseurs.md` § Fiche 1.

**Trois défauts mesurés, et chacun est traité ici et nulle part ailleurs.**

1. **Il substitue son modèle en silence.** Demander `flux` ou un nom qui
   n'existe pas ne donne ni erreur ni avertissement : une image arrive en 200,
   et c'est `sana` qui l'a faite. Seul l'en-tête `x-model-used` dit la vérité.
   Un adaptateur qui ne le lirait pas écrirait un nom de modèle faux dans le
   journal des dépenses, pour toujours. **Il est donc lu à chaque appel, et un
   écart est un refus.**
2. **Il n'a pas de 404.** Toute adresse rend une image : la racine du site en a
   rendu 121 Ko, `/openapi.json` 141 Ko. On ne peut donc rien conclure d'un
   statut de réponse, et ce que l'on a reçu se vérifie **sur les octets**.
3. **Il plafonne la surface en silence.** 1024×1024 demandés rendent 768×768,
   la proportion étant respectée. La règle du produit depuis T1 — *les
   dimensions mesurées font foi, jamais celles demandées* — l'absorbe seule ;
   les tailles déclarées plus bas restent quand même sous le plafond mesuré,
   pour qu'un cadrage demandé soit un cadrage rendu.
4. **Son cache ne déclare rien** — mesuré le 1<sup>er</sup> septembre 2026, en
   construisant F2. Quand la même phrase a déjà été demandée, il rend l'image en
   0,2 s avec `x-cache: HIT`, **et sans aucun de ses deux en-têtes** : ni
   `x-model-used`, ni `x-usage-total-tokens`. Deux conséquences, et la seconde
   est écrite dans `docs/PIEGES.md` parce qu'elle est invisible :
   ce qu'un appel servi du cache a consommé est **zéro et non un** — c'est ce
   que la réponse dit, et inventer un jeton serait inventer un chiffre ; et le
   garde du défaut n°1 **ne se déclenche pas** sur une réponse cachée, faute de
   savoir quel modèle a fait l'image. Sans conséquence aujourd'hui — le palier
   sans compte ne déclare qu'un modèle —, et à rouvrir le jour où il en déclare
   deux.

**Il ne prend aucune image de référence**, et c'est sa vraie limite. Elle ne
demande aucune ligne : `references_max=0` grise le modèle avec sa raison dès
qu'une référence est demandée, par la règle de T1.

**Et il ne rend qu'une image par appel.** Le palier sans compte n'autorise
qu'un appel toutes les quinze secondes ; le produit envoie ses variations
*ensemble* depuis T1. `variations_max=1` dit donc la vérité de ce palier au lieu
de laisser trois appels sur quatre se faire refuser.
"""

from __future__ import annotations

import urllib.parse
from typing import Any

import httpx

from atelier.domaine import Compte, Demande, Modele
from atelier.domaine.catalogue import nommer
from atelier.domaine.consommation import ICI, JETON
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible
from atelier.fournisseur.port import ImageProduite

BASE = "https://image.pollinations.ai"
DELAI_CATALOGUE = 30.0
# Mesuré le 31 août 2026 : entre vingt et trente secondes par image, une fois
# vingt-huit. Le délai d'OpenRouter — cinq minutes — reste la bonne borne, et
# c'est la même : ce n'est pas un budget, c'est le moment où l'on cesse
# d'attendre.
DELAI_APPEL = 300.0

# **Ce que le palier sans compte impose, et ce qu'il n'impose pas** — mesuré le
# 31 août 2026 (`docs/archive/releve-fournisseurs.md` § Fiche 1). Sa limite est une
# **cadence**, un appel toutes les quinze secondes, et non un quota : il n'y a
# aucune réserve à épuiser, donc aucun « il vous reste N » à afficher. C'est le
# constat le plus utile du relevé pour F2, et il vaut d'être écrit ici : un
# plafond inventé serait un chiffre que personne n'a mesuré.
CADENCE_S = 15.0

# L'en-tête où il annonce ce que l'appel a consommé. **Un jeton par image**,
# mesuré — et c'est le seul des trois fournisseurs du relevé qui dise sa
# consommation appel par appel.
EN_TETE_CONSOMME = "x-usage-total-tokens"

# **Ce que le palier sans compte rend vraiment, mesuré.** 1024×1024 demandés
# rendent 768×768 ; 1024×512 demandés rendent 1024×512. La proportion passe, la
# surface est plafonnée autour de 768² pixels. Les tailles ci-dessous tiennent
# donc sous ce plafond : ce qui est demandé est ce qui revient, et la mesure sur
# l'image reçue reste la seule vérité de toute façon.
TAILLES = {
    "1:1": (768, 768),
    "3:2": (936, 624),
    "2:3": (624, 936),
    "16:9": (1024, 576),
}

# Les signatures des formats qu'un fournisseur rend vraiment — les mêmes que
# chez OpenRouter, et pour la même raison : ce que l'on a reçu se lit sur les
# octets. Ici elles servent en plus de **filet contre l'absence de 404** : une
# page d'accueil HTML servie en 200 n'en porte aucune.
_SIGNATURES = (
    (bytes.fromhex("89504e470d0a1a0a"), "image/png"),
    (bytes.fromhex("ffd8ff"), "image/jpeg"),
)


class Pollinations:
    """Implémente `PortFournisseur`."""

    nom = "Pollinations"

    def indisponible(self) -> str | None:
        """Jamais rien. C'est tout l'intérêt de ce fournisseur-ci."""
        return None

    def compte(self) -> Compte:
        """Il compte en jetons, il n'annonce aucune réserve, il impose une cadence.

        Les trois sont mesurés, et le second est le plus important : **ce
        fournisseur n'a pas de quota**. Déclarer un plafond ici — les 150 jetons
        par jour qu'on lit ailleurs, par exemple — reviendrait à écrire dans le
        produit un chiffre qui appartient à une autre interface que celle-ci
        (`docs/archive/releve-fournisseurs.md` § Fiche 3 : la même confusion a failli
        faire entrer Leonardo). Sans plafond, il n'y a pas de « ce qui reste » :
        il y a « ce qui est parti », compté ici, et l'écran le dit.

        `renouvellement` décrit la **fenêtre du compte tenu ici**, pas une
        allocation du fournisseur : ce qui est parti se compte depuis minuit,
        parce qu'un compteur qui n'aurait jamais de bord finirait par ne plus
        rien apprendre.
        """
        return Compte(
            unite=JETON,
            plafond=None,
            source=ICI,
            renouvellement="minuit",
            cadence_s=CADENCE_S,
        )

    # ── Le catalogue ─────────────────────────────────────────────────────────

    async def catalogue(self) -> list[Modele]:
        """`GET /models` — un palier, un modèle.

        La documentation en annonce quatre ; l'interface n'en rend qu'un sans
        compte, et **c'est l'interface qui fait foi** : la règle de T1 dit que
        le catalogue décide, et le catalogue est ce que le fournisseur répond,
        jamais ce qu'il écrit dans ses pages.
        """
        try:
            async with httpx.AsyncClient(timeout=DELAI_CATALOGUE) as client:
                reponse = await client.get(f"{BASE}/models")
                reponse.raise_for_status()
                brut = reponse.json()
        except httpx.HTTPStatusError as erreur:
            raise AppelRefuse(
                f"le catalogue a répondu {erreur.response.status_code}",
                statut=erreur.response.status_code,
            ) from None
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"catalogue injoignable — {_panne(erreur)}"
            ) from None
        except ValueError:
            # **Le corollaire de « il n'a pas de 404 »** : une réponse en 200
            # qui n'est pas du JSON est une page, pas un catalogue. La traiter
            # comme un catalogue vide effacerait ses modèles en silence.
            raise FournisseurIndisponible(
                "catalogue illisible — la réponse n'est pas une liste de modèles"
            ) from None

        return [self._fiche(nom) for nom in _noms(brut)]

    @classmethod
    def _fiche(cls, chez_lui: str) -> Modele:
        return Modele(
            identifiant=nommer(cls.nom, chez_lui),
            nom=chez_lui,
            fournisseur=cls.nom,
            chez_lui=chez_lui,
            # Zéro, et c'est mesuré : aucun modèle du palier sans compte ne
            # prend d'image d'entrée. La règle de T1 fait le reste.
            references_max=0,
            proportions=tuple(TAILLES),
            resolutions=(),
            variations_max=1,
            options={},
        )

    # ── L'appel ──────────────────────────────────────────────────────────────

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        """Le sujet est dans l'adresse, et la réponse est l'image elle-même.

        Aucun compte, aucun en-tête d'autorisation, aucun corps de requête : ce
        fournisseur n'a qu'une forme d'appel, et c'est une adresse.
        """
        adresse = f"{BASE}/prompt/{urllib.parse.quote(_prompt_complet(demande))}"
        largeur, hauteur = TAILLES.get(demande.proportions, TAILLES["1:1"])
        parametres: dict[str, Any] = {
            "model": modele.envoi,
            "width": largeur,
            "height": hauteur,
            # Le filigrane du fournisseur sur un sprite serait un défaut qu'aucun
            # post-traitement ne rattrape.
            "nologo": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
                reponse = await client.get(
                    adresse, params=parametres, follow_redirects=True
                )
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"fournisseur injoignable — {_panne(erreur)}"
            ) from None

        if reponse.status_code >= 400:
            raise AppelRefuse(_raison(reponse), statut=reponse.status_code)

        # **Le modèle rendu avant l'image**, et c'est l'ordre qui compte. Une
        # image de `sana` enregistrée sous le nom d'un autre est un mensonge
        # qu'aucune relecture ne défera : le fichier est juste, le journal est
        # faux, et rien ne dit lequel des deux croire.
        servi = reponse.headers.get("x-model-used")
        if servi and servi != modele.envoi:
            raise AppelRefuse(
                f"« {modele.envoi} » a été demandé et « {servi} » a répondu — "
                "ce fournisseur remplace un modèle qu'il n'a pas, en silence"
            )

        octets = reponse.content
        type_media = _type_media(octets)
        if type_media is None:
            raise AppelRefuse(
                "la réponse n'est pas une image — ce fournisseur rend une page "
                "en 200 là où un autre rendrait 404"
            )

        # **Ce que l'appel a consommé, lu chez lui et non supposé** (F2). La
        # règle de T1 n'a pas changé de fond en changeant d'unité : on
        # n'enregistre jamais un chiffre annoncé dans une documentation, on
        # enregistre ce que la réponse déclare. Un jeton par image est ce qui a
        # été mesuré ; c'est quand même l'en-tête qui fait foi, appel par appel.
        return ImageProduite(
            octets=octets,
            consomme=_consomme(reponse),
            type_media=type_media,
            unite=JETON,
        )


# ── Lecture des déclarations du catalogue ────────────────────────────────────


def _noms(brut: Any) -> list[str]:
    """Les noms de modèles, quelle que soit la forme que prend la réponse.

    Le palier sans compte rend une liste de chaînes — `["sana"]`, mesuré. Les
    paliers supérieurs rendent des fiches. Les deux formes se lisent ici plutôt
    que de faire disparaître un catalogue le jour où une clé est déposée.
    """
    if not isinstance(brut, list):
        return []
    noms: list[str] = []
    for entree in brut:
        if isinstance(entree, str):
            noms.append(entree)
        elif isinstance(entree, dict):
            nom = entree.get("name") or entree.get("id") or entree.get("model")
            if isinstance(nom, str) and nom:
                noms.append(nom)
    return noms


# ── Traductions ──────────────────────────────────────────────────────────────


def _prompt_complet(demande: Demande) -> str:
    """Le sujet, et ce qu'on n'en veut pas replié à la fin.

    Même traduction que chez OpenRouter, et pour la même raison : aucun des deux
    ne déclare de prompt négatif, et ce que l'auteur écrit dans ce champ-là doit
    partir quelque part.
    """
    negatif = demande.prompt_negatif.strip()
    if not negatif:
        return demande.prompt.strip()
    return f"{demande.prompt.strip()}\n\nDo not include: {negatif}"


def _consomme(reponse: httpx.Response) -> float:
    """Ce que cet appel-là a consommé, **d'après ce que la réponse déclare**.

    Un jeton quand il l'annonce ; **zéro quand il n'annonce rien**, et c'est le
    cas d'une image servie de son cache — mesuré le 1er septembre 2026 : une
    phrase déjà demandée revient en 0,2 s avec `x-cache: HIT` et sans aucun
    en-tête d'usage.

    **Zéro plutôt qu'un, et c'est la règle du produit qui tranche** : *on
    n'enregistre jamais un chiffre annoncé, on enregistre ce que l'appel a
    réellement consommé*. Le fournisseur dit qu'il n'a rien compté ; écrire un
    jeton quand même serait écrire un nombre que personne n'a mesuré, ce que ce
    dépôt ne fait pas — et ce serait faux **vers le haut**, c'est-à-dire du côté
    qui refuse un lot qui serait passé.
    """
    annonce = reponse.headers.get(EN_TETE_CONSOMME)
    if not annonce:
        return 0.0
    try:
        return float(annonce)
    except ValueError:
        return 0.0


def _type_media(octets: bytes) -> str | None:
    """Ce qu'on a reçu, lu sur les octets. `None` quand ce n'est pas une image."""
    for signature, type_media in _SIGNATURES:
        if octets.startswith(signature):
            return type_media
    if octets[:4] == b"RIFF" and octets[8:12] == b"WEBP":
        return "image/webp"
    return None


def _panne(erreur: httpx.HTTPError) -> str:
    """Pourquoi la liaison n'a pas abouti, **en français** — règle de T1."""
    if isinstance(erreur, httpx.TimeoutException):
        return "le fournisseur n'a pas répondu à temps"
    if isinstance(erreur, httpx.ConnectError):
        return "aucune connexion au fournisseur"
    return "liaison interrompue avec le fournisseur"


def _raison(reponse: httpx.Response) -> str:
    """La raison de l'échec, en clair, la plus courte qui reste vraie.

    **Le 500 est le refus honnête de ce fournisseur.** Mesuré : demander
    `kontext`, qui existe mais est réservé au palier payant, rend un 500 dont le
    message explique où le modèle est disponible. C'est le seul des trois cas
    voisins qui dise la vérité, et son message vaut d'être montré.
    """
    if reponse.status_code == 429:
        return "trop d'appels d'affilée — ce fournisseur en accepte un toutes les quinze secondes"
    try:
        charge = reponse.json()
    except ValueError:
        detail = reponse.text.strip()[:200]
        return f"appel refusé ({reponse.status_code}) — {detail}".rstrip(" —")
    message = charge.get("message") or charge.get("error") if isinstance(charge, dict) else None
    return f"appel refusé ({reponse.status_code}) — {str(message)[:200]}"
