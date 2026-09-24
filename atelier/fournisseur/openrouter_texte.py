# -*- coding: utf-8 -*-
"""L'adaptateur de texte — `/chat/completions` chez OpenRouter, et rien d'autre.

Arrivé en CM1 (`docs/PLAN-assistant.md`, décisions 4 et 5). **Séparé de
`openrouter.py`**, qui ne parle qu'à `/images` : il n'en partage que la clé
(`CLE`, la même place du `.env`) et la politesse des erreurs (`_raison`,
`_panne` — les mêmes phrases françaises pour un refus et une panne). Tout le
vocabulaire du fil — `messages`, `stream`, `delta`, `usage.cost`, `data:` —
reste enfermé ici.

**Un seul modèle, en dur** (décision 4) : aucun choix de modèle à l'écran, donc
aucun catalogue à relire. Son identifiant chez OpenRouter n'est écrit nulle part
ailleurs dans le dépôt ; il est pris tel que le plan le nomme, préfixé du
fournisseur comme tout modèle d'OpenRouter (`deepseek/…`). ⚠️ **Jamais vérifié
contre le vrai service** — aucun appel payé en CM1. Si OpenRouter le nomme
autrement, c'est cette seule ligne qui change.

Trois choses valent d'être sues :

- **La réponse arrive en flux**, morceau par morceau (`stream: true`) : la
  première syllabe s'affiche avant que la phrase soit finie.
- **Le délai est un délai total**, et il **coupe la liaison** : passé le délai,
  la réponse est refermée, et OpenRouter cesse de produire — donc de facturer —
  ce que plus personne n'attend. Il se mesure à chaque ligne attendue, pas une
  fois pour toutes : un `asyncio.timeout` qui engloberait les `yield`
  annulerait la tâche de *celui qui écoute*, pas la lecture.
- **Le coût arrive en dernier** (`usage: {include: true}` → `usage.cost` dans le
  dernier message). Un appel coupé avant n'en a pas : c'est le service qui le
  dit, et le journal l'écrit (`cout_inconnu`).
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, AsyncIterator

import anyio
import httpx

from atelier.domaine.catalogue import nommer
from atelier.domaine.consommation import USD
from atelier.domaine.erreurs import (
    AppelRefuse,
    DelaiDepasse,
    FournisseurIndisponible,
    SansCle,
)
from atelier.domaine.secret import Secret, ce_qui_manque
from atelier.fournisseur.openrouter import BASE, CLE, _panne, _raison

#: Le modèle, chez OpenRouter. **Le seul du coup de main** (décision 4).
MODELE = "deepseek/deepseek-v4-flash"

#: Le délai total d'un appel, en secondes. Court par construction : le modèle
#: répond d'ordinaire en une seconde (plan § Ce que ce plan ne couvre pas), et
#: une aide qui fait attendre quinze secondes a déjà échoué. Au-delà, on
#: raccroche.
DELAI_S = 15.0

#: Le plafond de longueur d'une réponse, en jetons. Un filet contre une réponse
#: qui ne s'arrête pas — les trois métiers rendent quelques phrases.
JETONS_MAX = 1024


@dataclass(frozen=True, slots=True)
class Recu:
    """Ce qu'une ligne du flux a apporté — un morceau, un numéro, un coût."""

    texte: str = ""
    chez_lui: str | None = None
    consomme: float | None = None


class OpenRouterTexte:
    """Le modèle de texte du coup de main. **Le même compte que les images.**"""

    nom = "OpenRouter"

    def __init__(
        self,
        cle: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._cle = (cle or "").strip()
        # **Le seul point d'entrée des essais** (même raison que `OpenRouter`,
        # B15) : aucun essai n'appelle le vrai modèle, le fil est doublé ici par
        # `httpx.MockTransport`, et tout le reste du fichier tourne pour de vrai.
        self._transport = transport

    @property
    def modele(self) -> str:
        """Le nom complet — « OpenRouter:deepseek/deepseek-v4-flash » (point 1)."""
        return nommer(self.nom, MODELE)

    def secrets(self) -> tuple[Secret, ...]:
        return (CLE,)

    def indisponible(self) -> str | None:
        """La phrase de ce qui manque, **la même que celle des images**."""
        return ce_qui_manque(self.nom, self.secrets(), {CLE.nom: self._cle})

    @staticmethod
    def corps_appel(consigne: str, texte: str) -> dict[str, Any]:
        """Ce qui part : la consigne, le texte, et rien d'autre (décision 7)."""
        return {
            "model": MODELE,
            "messages": [
                {"role": "system", "content": consigne},
                {"role": "user", "content": texte},
            ],
            "stream": True,
            "max_tokens": JETONS_MAX,
            "usage": {"include": True},
        }

    async def flux(
        self, consigne: str, texte: str, *, delai: float = DELAI_S
    ) -> AsyncIterator[Recu]:
        """Les morceaux de la réponse, **au fur et à mesure qu'ils arrivent**.

        Lève `SansCle` sans rien envoyer, `AppelRefuse` si OpenRouter dit non,
        `FournisseurIndisponible` s'il n'est pas joint, `DelaiDepasse` quand le
        délai total est passé — **après avoir refermé la liaison** dans tous les
        cas. Refermer ce générateur avant la fin (celui qui écoute est parti)
        referme la liaison de même.
        """
        if not self._cle:
            raise SansCle()
        boucle = asyncio.get_running_loop()
        echeance = boucle.time() + delai

        def reste() -> float:
            restant = echeance - boucle.time()
            if restant <= 0:
                raise DelaiDepasse(_panne(httpx.ReadTimeout("")))
            return restant

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(delai), transport=self._transport
        ) as client:
            requete = client.build_request(
                "POST",
                f"{BASE}/chat/completions",
                json=self.corps_appel(consigne, texte),
                headers={
                    "Authorization": f"Bearer {self._cle}",
                    "Content-Type": "application/json",
                    "X-Title": "Asset Kitchen",
                },
            )
            try:
                # Le reste se lit **avant** de fabriquer ce qu'on attend : un
                # délai déjà passé ne doit pas laisser une attente jamais faite.
                restant = reste()
                reponse = await asyncio.wait_for(
                    client.send(requete, stream=True), restant
                )
            except asyncio.TimeoutError:
                raise DelaiDepasse(_panne(httpx.ReadTimeout(""))) from None
            except httpx.TimeoutException as erreur:
                raise DelaiDepasse(_panne(erreur)) from None
            except httpx.HTTPError as erreur:
                raise FournisseurIndisponible(
                    f"fournisseur injoignable — {_panne(erreur)}"
                ) from None
            try:
                if reponse.status_code >= 400:
                    await reponse.aread()
                    raise AppelRefuse(_raison(reponse), statut=reponse.status_code)
                lignes = reponse.aiter_lines()
                while True:
                    try:
                        restant = reste()
                        ligne = await asyncio.wait_for(anext(lignes), restant)
                    except StopAsyncIteration:
                        break
                    except asyncio.TimeoutError:
                        raise DelaiDepasse(_panne(httpx.ReadTimeout(""))) from None
                    except httpx.TimeoutException as erreur:
                        raise DelaiDepasse(_panne(erreur)) from None
                    except httpx.HTTPError as erreur:
                        raise FournisseurIndisponible(
                            f"liaison coupée — {_panne(erreur)}"
                        ) from None
                    recu = _lire_ligne(ligne)
                    if recu is _FINI:
                        break
                    if recu is not None:
                        yield recu
            finally:
                # **Raccrocher, même quand on nous annule.** Une annulation
                # venue de l'écran (Échap, onglet fermé) arrive par une portée
                # anyio, qui relève l'annulation à chaque `await` : sans ce
                # bouclier, la fermeture elle-même serait annulée et la liaison
                # resterait ouverte chez le fournisseur.
                with anyio.CancelScope(shield=True):
                    await reponse.aclose()


# ── La lecture d'une ligne du flux ───────────────────────────────────────────

_FINI = Recu()


def _lire_ligne(ligne: str) -> Recu | None:
    """Une ligne SSE d'OpenRouter → ce qu'elle apporte, ou `None`.

    Trois formes à connaître : `: OPENROUTER PROCESSING`, un commentaire qui
    garde la liaison ouverte et ne porte rien ; `data: {…}`, un morceau ;
    `data: [DONE]`, la fin. **Une erreur peut arriver au milieu du flux**, dans
    un morceau qui porte `error` : elle lève comme un refus, avec ce que
    l'appel a déjà consommé s'il le dit.
    """
    ligne = ligne.strip()
    if not ligne.startswith("data:"):
        return None
    charge = ligne[5:].strip()
    if charge == "[DONE]":
        return _FINI
    try:
        brut = json.loads(charge)
    except ValueError:
        return None
    if not isinstance(brut, dict):
        return None
    cout = _cout(brut)
    erreur = brut.get("error")
    if erreur:
        message = erreur.get("message") if isinstance(erreur, dict) else erreur
        raise AppelRefuse(
            f"réponse interrompue par le fournisseur — {str(message)[:200]}",
            consomme=cout or 0.0,
            unite=USD,
        )
    morceaux = []
    for choix in brut.get("choices") or []:
        delta = (choix or {}).get("delta") or {}
        contenu = delta.get("content")
        if isinstance(contenu, str) and contenu:
            morceaux.append(contenu)
    return Recu(
        texte="".join(morceaux),
        chez_lui=brut.get("id") if isinstance(brut.get("id"), str) else None,
        consomme=cout,
    )


def _cout(brut: dict[str, Any]) -> float | None:
    """`usage.cost`, s'il est là **et que c'est un nombre** — sinon rien."""
    valeur = (brut.get("usage") or {}).get("cost")
    return float(valeur) if isinstance(valeur, (int, float)) else None
