# -*- coding: utf-8 -*-
"""L'adaptateur OpenRouter — passerelle unique du produit.

Un compte, une clé, une facture, et 47 modèles image de 8 fournisseurs derrière
un seul jeu de paramètres (`docs/ARCHITECTURE.md` §3). Tout le vocabulaire
d'OpenRouter est enfermé ici : `aspect_ratio`, `input_references`, `n`,
`b64_json`, `usage.cost` n'existent nulle part ailleurs dans le dépôt.

Trois traductions valent d'être connues, parce qu'elles ne sont pas des détails :

- **`aspect_ratio` est toujours imposé.** Sans lui, Gemini part en 16:9 et
  Seedream en 1:1 — deux essais ne sont alors plus comparables et un sprite
  n'est plus cadrable (`AGENTS.md` § Pièges connus).
- **Aucun modèle du catalogue ne déclare de prompt négatif** — relevé du
  26 août 2026, 47 modèles, zéro `negative_prompt`. Ce que l'auteur écrit dans
  ce champ est donc replié dans le prompt, en anglais, à la fin. C'est une
  traduction de fournisseur, elle n'a pas à remonter dans le produit.
- **Le nombre d'images par appel (`n`) n'est jamais utilisé.** Une variation est
  un appel : c'est ce qui permet qu'un raté ne coûte pas ses voisines et se
  relance seul (`docs/PLAN.md`, T1).
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from atelier.domaine import Demande, Modele, Option
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible, SansCle
from atelier.fournisseur.port import ImageProduite

BASE = "https://openrouter.ai/api/v1"
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

_GENRES = {"enum": "choix", "range": "intervalle", "boolean": "booleen"}


class OpenRouter:
    """Implémente `PortFournisseur`."""

    nom = "OpenRouter"

    def __init__(self, cle: str | None = None) -> None:
        self._cle = (cle or "").strip()

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

    @staticmethod
    def _lire_fiche(fiche: dict[str, Any]) -> Modele | None:
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
            identifiant=fiche["id"],
            nom=fiche.get("name") or fiche["id"],
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
        images = resultat.get("data") or []
        if not images:
            raise AppelRefuse("le fournisseur n'a rendu aucune image")

        octets, type_media = await _octets_de(images[0])
        cout = float((resultat.get("usage") or {}).get("cost") or 0.0)
        return ImageProduite(octets=octets, cout_usd=cout, type_media=type_media)

    @staticmethod
    def corps_appel(modele: Modele, demande: Demande) -> dict[str, Any]:
        """Ce qui part réellement — enregistré tel quel comme paramètres résolus.

        Les références sont comptées, pas recopiées : on n'enregistre jamais des
        mégaoctets de base64 dans un journal.
        """
        corps: dict[str, Any] = {
            "model": modele.identifiant,
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
                        "url": "data:image/png;base64,"
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


def _panne(erreur: httpx.HTTPError) -> str:
    """Pourquoi la liaison n'a pas abouti, **en français**.

    Le message d'httpx est en anglais et technique — « All connection attempts
    failed ». Il ne reste pas dans les journaux : il ressort tel quel dans le
    bandeau hors ligne et sur la tuile d'un raté. Ce qui s'affiche doit donc
    être une phrase du produit, jamais une trace de bibliothèque.
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
