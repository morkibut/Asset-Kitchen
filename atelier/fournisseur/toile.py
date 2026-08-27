# -*- coding: utf-8 -*-
"""Aller chercher une image à une adresse collée. Le second sortant du dépôt.

**C'est un adaptateur, pas un service**, et il est ici pour la raison qui a fait
ce dossier : *le vocabulaire de l'extérieur ne le franchit pas*. « All connection
attempts failed » est ressorti tel quel dans la barre d'état le 27 août
(`AGENTS.md` § Pièges connus) ; toute panne de transport se traduit donc en une
phrase du produit **avant** de sortir d'ici.

Il ne connaît ni carte, ni projet, ni tableau. On lui donne une adresse, il rend
des octets ou une raison en français — et c'est cette raison-là que la carte
garde à côté de son adresse quand la récupération échoue (US-43).

**Trois refus posés d'avance, et aucun n'est de la prudence décorative :**

- *Seuls `http` et `https`.* Un `file://` collé par mégarde lirait le disque de
  la machine et l'installerait dans un tableau — ce n'est pas une inspiration,
  c'est une fuite.
- *Un plafond de taille.* Une adresse qui rend un flux sans fin remplirait
  `donnees/` en silence. 32 Mo laisse passer n'importe quelle planche d'artwork
  et arrête tout le reste.
- *Un délai court.* Coller reste un geste : la carte paraît **avant** que
  l'image n'arrive (US-42), donc l'attente est déjà hors du chemin de l'auteur.
  Elle ne doit pas pour autant durer une minute avant de dire non.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from atelier.domaine.erreurs import ErreurAtelier

DELAI_S = 20.0
PLAFOND_OCTETS = 32 * 1024 * 1024
SCHEMAS = ("http", "https")

# Certains hébergeurs rendent une page d'erreur en HTML plutôt qu'un 404 quand
# l'agent n'est pas un navigateur. On se présente donc comme un client normal :
# le produit n'essaie de contourner aucune protection, il évite un faux négatif.
ENTETES = {
    "User-Agent": "Mozilla/5.0 (compatible; AssetKitchen/1.0)",
    "Accept": "image/*,*/*;q=0.8",
}


class AdresseRefusee(ErreurAtelier):
    """L'adresse collée n'a pas donné d'image, et on dit pourquoi."""

    code = "adresse_refusee"


@dataclass(frozen=True, slots=True)
class ImageDistante:
    octets: bytes
    type_media: str


def verifier(adresse: str) -> str:
    """L'adresse, nettoyée — ou un refus qui la nomme. Ne touche pas au réseau.

    Séparée de la récupération parce qu'elle sert **avant** : c'est elle qui
    permet à une carte de paraître en attente en moins d'une seconde sans qu'on
    ait à décider si l'adresse est plausible pendant que la requête part.
    """
    propre = adresse.strip()
    decoupee = urlparse(propre)
    if decoupee.scheme not in SCHEMAS or not decoupee.netloc:
        raise AdresseRefusee(f"« {propre[:80]} » n'est pas une adresse http(s)")
    return propre


async def recuperer(adresse: str) -> ImageDistante:
    """Les octets à cette adresse. Lève une erreur du domaine, jamais d'`httpx`."""
    propre = verifier(adresse)
    try:
        async with httpx.AsyncClient(
            timeout=DELAI_S, follow_redirects=True, headers=ENTETES
        ) as client:
            reponse = await client.get(propre)
            reponse.raise_for_status()
            octets = reponse.content
            declare = reponse.headers.get("content-type", "").split(";")[0].strip()
    except httpx.HTTPStatusError as erreur:
        raise AdresseRefusee(
            f"l'adresse a répondu {erreur.response.status_code}"
        ) from None
    except httpx.TimeoutException:
        raise AdresseRefusee(f"l'adresse n'a pas répondu en {DELAI_S:.0f} s") from None
    except httpx.HTTPError:
        raise AdresseRefusee("aucune connexion à cette adresse") from None

    if len(octets) > PLAFOND_OCTETS:
        raise AdresseRefusee(
            f"l'image dépasse {PLAFOND_OCTETS // (1024 * 1024)} Mo"
        )
    if not octets:
        raise AdresseRefusee("l'adresse n'a rien rendu")

    # Ce que l'hébergeur *dit* avoir rendu. On le garde pour la raison d'un
    # refus lisible — « l'adresse rend du text/html » vaut mieux que « fichier
    # illisible comme image » —, mais c'est `mesurer()` qui tranche : les
    # dimensions et le format se lisent sur les octets, jamais sur un en-tête.
    return ImageDistante(octets=octets, type_media=declare)
