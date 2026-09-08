# -*- coding: utf-8 -*-
"""L'adaptateur OpenRouter — passerelle unique du produit.

Un compte, une clé, une facture, et 47 modèles image de 8 fournisseurs derrière
un seul jeu de paramètres (`docs/ARCHITECTURE.md` §3). Tout le vocabulaire
d'OpenRouter est enfermé ici : `aspect_ratio`, `input_references`, `n`,
`b64_json`, `usage.cost` n'existent nulle part ailleurs dans le dépôt.

Trois traductions valent d'être connues, parce qu'elles ne sont pas des détails :

- **`aspect_ratio` est toujours imposé.** Sans lui, Gemini part en 16:9 et
  Seedream en 1:1 — deux essais ne sont alors plus comparables et un sprite
  n'est plus cadrable (`docs/PIEGES.md`).
- **Aucun modèle du catalogue ne déclare de prompt négatif** — relevé du
  26 août 2026, 47 modèles, zéro `negative_prompt`. Ce que l'auteur écrit dans
  ce champ est donc replié dans le prompt, en anglais, à la fin. C'est une
  traduction de fournisseur, elle n'a pas à remonter dans le produit.
- **Le nombre d'images par appel (`n`) n'est jamais utilisé.** Une variation est
  un appel : c'est ce qui permet qu'un raté ne coûte pas ses voisines et se
  relance seul (`docs/archive/plan-versions-tenues.md`, T1).
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from atelier.domaine import Demande, Modele, Option
from atelier.domaine.catalogue import nommer
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible, SansCle
from atelier.domaine.secret import Secret, ce_qui_manque
from atelier.fournisseur.port import ImageProduite

BASE = "https://openrouter.ai/api/v1"

# **La seule place que ce fournisseur demande** (F3). Son nom est celui de la
# variable d'environnement, documenté dans `.env.example` depuis T1 ; les trois
# autres champs sont les mots avec lesquels le produit en parle à l'auteur, et
# ils vivent ici parce que c'est l'adaptateur qui sait ce qu'il demande.
CLE = Secret(
    nom="OPENROUTER_API_KEY",
    libelle="la clé",
    aucun="aucune clé",
    ou="openrouter.ai/settings/keys",
)
DELAI_CATALOGUE = 30.0
DELAI_APPEL = 300.0

# Les paramètres qu'OpenRouter nomme, et ce qu'ils sont dans le produit.
# Tout ce qui n'est pas dans cette table reste un réglage propre au modèle,
# transporté sans être interprété.
_PROPORTIONS = "aspect_ratio"
_RESOLUTION = "resolution"
_VARIATIONS = "n"
_REFERENCES = "input_references"
_TRADUITS = frozenset({_PROPORTIONS, _RESOLUTION, _VARIATIONS, _REFERENCES})

# Les signatures des formats qu’un fournisseur rend vraiment. En hexadécimal
# plutôt qu’en échappements : « 89 50 4E 47 0D 0A 1A 0A » est la signature PNG,
# « FF D8 FF » celle du JPEG, et les lire ainsi évite qu’un copier-coller ne les
# abîme en silence.
_SIGNATURES = (
    (bytes.fromhex("89504e470d0a1a0a"), "image/png"),
    (bytes.fromhex("ffd8ff"), "image/jpeg"),
)

_GENRES = {"enum": "choix", "range": "intervalle", "boolean": "booleen"}


class OpenRouter:
    """Implémente `PortFournisseur`."""

    nom = "OpenRouter"

    def __init__(
        self,
        cle: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._cle = (cle or "").strip()
        # **Le point d'entrée des essais, et il n'en existe pas d'autre** (B15).
        # Même raison que sur `MoteurDeLaMaison` : on ne peut ni démarrer
        # OpenRouter dans un essai, ni compter sur sa présence — et un essai qui
        # l'appellerait pour de bon coûterait de l'argent. Le double se branche
        # ici, et tout le reste du fichier est exercé pour de vrai.
        #
        # ⚠️ Il n'est lu que par `solde()`. `catalogue()` et `generer()` ont
        # leurs propres doubles depuis T1 — au niveau du port, pas du transport —
        # et les y brancher aussi aurait fait deux façons de doubler le même
        # adaptateur.
        self._transport = transport

    def secrets(self) -> tuple[Secret, ...]:
        """Une seule place, et c'est la clé (F3)."""
        return (CLE,)

    def indisponible(self) -> str | None:
        """Sans clé, ses modèles sont grisés — **et lui seul** (F1).

        La phrase nomme le fournisseur : depuis qu'il y en a deux, « aucune
        clé » tout court laisserait croire que rien ne peut produire, alors
        qu'un autre fournisseur n'en demande aucune.

        **Elle se compose depuis F3**, au lieu d'être écrite ici — mot pour mot
        la même pour une seule place vide, et *« il manque, chez X : … »* dès
        qu'il y en a plusieurs. Un adaptateur à deux secrets hérite donc de la
        phrase sans l'écrire.
        """
        return ce_qui_manque(self.nom, self.secrets(), {CLE.nom: self._cle})

    def compte(self) -> None:
        """Rien : **ce fournisseur compte en argent, et l'argent a sa barre** (F2).

        Il facture à l'appel, en dollars, et ce qu'il reste sur un compte
        OpenRouter est un solde prépayé qu'aucune des routes du produit ne lit.
        Rendre ici un chiffre qu'aucun appel n'a mesuré serait très exactement
        ce que la règle de T1 interdit — et le produit sait déjà dire ce qu'il a
        dépensé chez lui : c'est le total de la barre de tête.

        ⚠️ **`solde()` ne dément pas cette méthode-ci.** `compte()` répond *dans
        quelle unité ce fournisseur alloue*, et la réponse reste *en argent, sans
        allocation*. `solde()` répond à une autre question, posée par un seul
        bouton d'un seul écran : *ce compte-là, il lui reste combien ?* Elle
        n'entre dans aucun calcul, ne décide d'aucun grisé, et ne s'affiche que
        quand on la demande.
        """
        return None

    async def solde(self) -> str | None:
        """Ce qu'il reste sur le compte, **en une phrase** — ou `None` (B15).

        C'est ce que le bouton *Vérifier* de l'écran d'installation annonce à
        côté du compte de modèles, et c'est **la seule chose qui prouve
        vraiment la clé** : le catalogue, lui, est public et répond sans elle.

        Deux formes essayées dans l'ordre, parce qu'OpenRouter en sert deux et
        que le produit n'a pas à savoir laquelle est en vigueur ce mois-ci :
        `GET /credits` (`total_credits` moins `total_usage`), puis `GET /key`
        (`limit_remaining`). **Rien ne se lit** rend `None`, et l'écran écrit
        *le solde n'a pas été lu* — jamais un zéro, qui se lirait comme un
        compte vide.

        ⚠️ **Ces deux formes n'ont jamais été exercées contre le vrai service**
        depuis ce dépôt : aucun appel réel n'a été fait en `B15`. C'est
        exactement pourquoi l'échec de lecture se dit au lieu de s'inventer.

        Une clé refusée, elle, n'est pas un silence : elle lève `AppelRefuse`,
        et c'est ce qui distingue *je n'ai pas su lire* de *on m'a dit non*.
        """
        if not self._cle:
            return None
        for chemin, lire in (("/credits", _credits), ("/key", _limite)):
            try:
                async with httpx.AsyncClient(
                    timeout=DELAI_CATALOGUE, transport=self._transport
                ) as client:
                    reponse = await client.get(
                        f"{BASE}{chemin}",
                        headers={"Authorization": f"Bearer {self._cle}"},
                    )
                    if reponse.status_code in (401, 403):
                        raise AppelRefuse(
                            "la clé n'a pas été acceptée par OpenRouter",
                            statut=reponse.status_code,
                        )
                    reponse.raise_for_status()
                    montant = lire(reponse.json())
            except httpx.HTTPStatusError:
                continue
            except httpx.HTTPError as erreur:
                raise FournisseurIndisponible(
                    f"le compte est injoignable — {_panne(erreur)}"
                ) from None
            except (ValueError, TypeError):
                continue
            if montant is not None:
                # La virgule française, comme partout ailleurs dans le produit.
                return f"il reste ${montant:.2f}".replace(".", ",") + " sur ce compte"
        return None

    # ── Le catalogue ─────────────────────────────────────────────────────────

    async def catalogue(self) -> list[Modele]:
        """`GET /images/models` — relu au démarrage, jamais recopié en dur.

        Ne demande pas de clé : le catalogue est public. C'est ce qui permet
        d'ouvrir l'atelier et de voir les modèles avant même d'avoir une clé.
        """
        try:
            async with httpx.AsyncClient(timeout=DELAI_CATALOGUE) as client:
                reponse = await client.get(f"{BASE}/images/models")
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

        modeles = []
        for fiche in brut.get("data", []):
            modele = self._lire_fiche(fiche)
            if modele is not None:
                modeles.append(modele)
        return modeles

    @classmethod
    def _lire_fiche(cls, fiche: dict[str, Any]) -> Modele | None:
        sorties = (fiche.get("architecture") or {}).get("output_modalities") or []
        if "image" not in sorties:
            return None

        declares = fiche.get("supported_parameters") or {}
        options: dict[str, Option] = {}
        for nom, declaration in declares.items():
            if nom in _TRADUITS or not isinstance(declaration, dict):
                continue
            genre = _GENRES.get(declaration.get("type", ""))
            if genre is None:
                continue
            options[nom] = Option(
                nom=nom,
                genre=genre,
                valeurs=tuple(str(v) for v in declaration.get("values", ())),
                minimum=declaration.get("min"),
                maximum=declaration.get("max"),
            )

        return Modele(
            identifiant=nommer(cls.nom, fiche["id"]),
            nom=fiche.get("name") or fiche["id"],
            fournisseur=cls.nom,
            chez_lui=fiche["id"],
            references_max=_borne(declares.get(_REFERENCES), "max", 0),
            proportions=_valeurs(declares.get(_PROPORTIONS)),
            resolutions=_valeurs(declares.get(_RESOLUTION)),
            variations_max=_borne(declares.get(_VARIATIONS), "max", 1),
            options=options,
        )

    # ── L'appel ──────────────────────────────────────────────────────────────

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        if not self._cle:
            raise SansCle()

        corps = self.corps_appel(modele, demande)

        try:
            async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
                reponse = await client.post(
                    f"{BASE}/images",
                    json=corps,
                    headers={
                        "Authorization": f"Bearer {self._cle}",
                        "Content-Type": "application/json",
                        "X-Title": "Asset Kitchen",
                    },
                )
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"fournisseur injoignable — {_panne(erreur)}"
            ) from None

        if reponse.status_code >= 400:
            raise AppelRefuse(_raison(reponse), statut=reponse.status_code)

        resultat = reponse.json()
        # **Le coût se lit avant tout le reste.** Une réponse sans image a
        # quand même atteint le modèle, donc elle est facturée : lever avant
        # cette ligne ferait disparaître du journal du projet exactement le
        # montant qu'on cherchera à expliquer (US-24).
        cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
        images = resultat.get("data") or []
        if not images:
            raise AppelRefuse("le fournisseur n'a rendu aucune image", consomme=cout)

        octets, type_media = await _octets_de(images[0])
        return ImageProduite(octets=octets, consomme=cout, type_media=type_media)

    @staticmethod
    def corps_appel(modele: Modele, demande: Demande) -> dict[str, Any]:
        """Ce qui part réellement — enregistré tel quel comme paramètres résolus.

        Les références sont comptées, pas recopiées : on n'enregistre jamais des
        mégaoctets de base64 dans un journal.
        """
        corps: dict[str, Any] = {
            # **Son nom chez lui, jamais l'identifiant du produit** : celui-ci
            # porte le fournisseur en tête depuis F1, et OpenRouter ne le
            # reconnaîtrait pas.
            "model": modele.envoi,
            "prompt": _prompt_complet(demande),
        }
        if demande.proportions and demande.proportions in modele.proportions:
            corps[_PROPORTIONS] = demande.proportions
        if demande.resolution and demande.resolution in modele.resolutions:
            corps[_RESOLUTION] = demande.resolution
        gardees, _ = modele.retenir(demande.options)
        corps.update(gardees)
        if demande.references:
            corps[_REFERENCES] = [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:"
                        + _type_media(octets)
                        + ";base64,"
                        + base64.b64encode(octets).decode("ascii")
                    },
                }
                for octets in demande.references
            ]
        return corps


# ── Lecture des déclarations du catalogue ────────────────────────────────────


def _valeurs(declaration: Any) -> tuple[str, ...]:
    if not isinstance(declaration, dict):
        return ()
    return tuple(str(v) for v in declaration.get("values", ()))


def _borne(declaration: Any, cle: str, defaut: int) -> int:
    if not isinstance(declaration, dict) or declaration.get(cle) is None:
        return defaut
    return int(declaration[cle])


# ── Traductions ──────────────────────────────────────────────────────────────


def _prompt_complet(demande: Demande) -> str:
    negatif = demande.prompt_negatif.strip()
    if not negatif:
        return demande.prompt.strip()
    return f"{demande.prompt.strip()}\n\nDo not include: {negatif}"


def _type_media(octets: bytes) -> str:
    """Le type d’une référence, lu **sur les octets** et jamais supposé.

    L’annoncer en dur en PNG était un mensonge qui attendait son heure : les
    Seedream ne rendent que du JPEG, et un JPEG servi sous l’étiquette PNG se
    fait refuser chez le fournisseur — après avoir traversé tout le produit sans
    que rien ne l’arrête.
    """
    for signature, type_media in _SIGNATURES:
        if octets.startswith(signature):
            return type_media
    if octets[:4] == b"RIFF" and octets[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"


def _nombre(valeur: Any) -> float | None:
    """Un nombre, ou rien. **Une chaîne n'en est pas un ici.**

    Un service qui rendrait `"4.84"` au lieu de `4.84` serait accepté sans
    broncher par `float()`, et le jour où il rendrait `"illimité"` le produit
    lèverait au milieu d'un écran. On ne lit que ce qui est déjà un nombre.
    """
    return float(valeur) if isinstance(valeur, (int, float)) else None


def _credits(brut: Any) -> float | None:
    """`GET /credits` — ce qui a été mis dessus, moins ce qui a été dépensé."""
    donnees = (brut or {}).get("data") or {}
    pose = _nombre(donnees.get("total_credits"))
    depense = _nombre(donnees.get("total_usage"))
    return None if pose is None or depense is None else pose - depense


def _limite(brut: Any) -> float | None:
    """`GET /key` — ce qu'il reste sous le plafond de cette clé-là."""
    return _nombre(((brut or {}).get("data") or {}).get("limit_remaining"))


def _panne(erreur: httpx.HTTPError) -> str:
    """Pourquoi la liaison n'a pas abouti, **en français**.

    Le message d'httpx est en anglais et technique — « All connection attempts
    failed ». Il ne reste pas dans les journaux : il ressort tel quel dans la
    barre d'état et sur la tuile d'un raté. Ce qui s'affiche doit donc être une
    phrase du produit, jamais une trace de bibliothèque.
    """
    if isinstance(erreur, httpx.TimeoutException):
        return "le fournisseur n'a pas répondu à temps"
    if isinstance(erreur, httpx.ConnectError):
        return "aucune connexion au fournisseur"
    return "liaison interrompue avec le fournisseur"


def _raison(reponse: httpx.Response) -> str:
    """La raison de l'échec, en clair, la plus courte qui reste vraie."""
    if reponse.status_code == 401:
        return "clé OpenRouter refusée"
    if reponse.status_code == 402:
        return "crédit OpenRouter épuisé"
    if reponse.status_code == 429:
        return "trop d'appels d'affilée — réessayer dans un instant"
    try:
        charge = reponse.json()
    except ValueError:
        detail = reponse.text.strip()[:200]
        return f"appel refusé ({reponse.status_code}) — {detail}".rstrip(" —")
    erreur = charge.get("error")
    if isinstance(erreur, dict):
        message = erreur.get("message") or erreur.get("code")
    else:
        message = erreur or charge.get("message")
    return f"appel refusé ({reponse.status_code}) — {str(message)[:200]}"


async def _octets_de(image: dict[str, Any]) -> tuple[bytes, str | None]:
    """L'image est rendue en base64, ou derrière une adresse. Les deux existent."""
    type_media = image.get("media_type") or image.get("mime_type")
    if image.get("b64_json"):
        return base64.b64decode(image["b64_json"]), type_media
    adresse = image.get("url") or (image.get("image_url") or {}).get("url")
    if not adresse:
        raise AppelRefuse("réponse sans image exploitable")
    if adresse.startswith("data:"):
        entete, _, charge = adresse.partition(",")
        return base64.b64decode(charge), entete[5:].split(";")[0] or type_media
    try:
        async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
            reponse = await client.get(adresse)
            reponse.raise_for_status()
            return reponse.content, reponse.headers.get("content-type", type_media)
    except httpx.HTTPError as erreur:
        raise FournisseurIndisponible(f"image injoignable — {_panne(erreur)}") from None
