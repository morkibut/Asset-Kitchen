# -*- coding: utf-8 -*-
"""Le coup de main — une consigne, un texte, une réponse en flux (CM1).

**Le seul chemin par lequel le produit parle à un modèle de texte.** Les trois
métiers du plan (CM3 améliorer, CM4 demander, CM5 expliquer ce qui bloque)
passent tous par `repondre`, et c'est ce qui leur donne gratuitement les quatre
règles que CM1 pose une fois :

1. **Sans clé, rien ne part et rien ne lève** : le flux rend un seul morceau
   `indisponible`, avec la phrase de ce qui manque (décision 6 — l'écran s'en
   sert pour ne pas montrer la marque, jamais pour afficher une erreur).
2. **La réponse arrive en flux**, morceau par morceau.
3. **Le délai court raccroche** : l'appel est coupé côté serveur, et celui qui
   s'en va (Échap, onglet fermé) le coupe de même — refermer ce générateur
   referme la liaison chez le fournisseur.
4. **Tout appel parti est compté**, quelle que soit son issue, dans l'unité du
   fournisseur, **avant** que le flux se termine pour qui l'écoute : dans
   `donnees/appels-texte/` d'abord (la vérité), dans l'index ensuite.

**Ce que CM6 branchera ici** : le plafond du mois. Sa place est marquée dans
`repondre`, juste après la clé — c'est la même question (*peut-il partir ?*) et
la même réponse (`indisponible`, avec sa raison). ⚠️ Un plafond « qui tient en
rafale » demandera de **réserver** avant de partir, sous un verrou : deux
appels simultanés liraient sinon le même reste. Rien de tel n'est posé en CM1.

**L'agent ne s'en sert pas** (décision 9) : aucun outil MCP ne mène ici, et
rien de ce qui passe par ce service ne compte dans le cadre de l'agent — ses
appels ne sont pas des générations, et `ServiceAgent._mesurer` ne lit que
celles-là.
"""

from __future__ import annotations

import contextlib
import time
import uuid
from typing import AsyncIterator, Callable

from atelier.depot import Base, Fichiers
from atelier.domaine.coup_de_main import (
    ABANDONNE,
    ECHOUE,
    FIN,
    INDISPONIBLE,
    INTERROMPU,
    REPONDU,
    TEXTE,
    AppelTexte,
    Morceau,
)
from atelier.domaine.erreurs import (
    AppelRefuse,
    DelaiDepasse,
    ErreurAtelier,
)
from atelier.fournisseur.openrouter_texte import DELAI_S, OpenRouterTexte


class ServiceCoupDeMain:
    def __init__(
        self,
        fichiers: Fichiers,
        base: Base,
        fabrique: Callable[[], OpenRouterTexte],
    ) -> None:
        self._fichiers = fichiers
        self._base = base
        # **Refabriqué à chaque appel**, comme les adaptateurs d'images : la
        # clé se relit sur le disque, on la dépose sans redémarrer.
        self._fabrique = fabrique

    # ── Peut-il partir ? ─────────────────────────────────────────────────────

    def etat(self) -> dict[str, object]:
        """Ce que la marque a besoin de savoir pour paraître ou se taire."""
        fournisseur = self._fabrique()
        raison = self._empechement(fournisseur)
        return {
            "disponible": raison is None,
            "raison": raison,
            "modele": fournisseur.modele,
        }

    def _empechement(self, fournisseur: OpenRouterTexte) -> str | None:
        """La raison pour laquelle rien ne partira, ou `None`.

        **La seule porte**, lue par `etat` et par `repondre` : ce que la marque
        annonce et ce que l'appel fait ne peuvent pas diverger. CM6 y ajoute le
        plafond du mois.
        """
        return fournisseur.indisponible()

    # ── La réponse ───────────────────────────────────────────────────────────

    async def repondre(
        self,
        consigne: str,
        texte: str,
        *,
        metier: str,
        delai: float = DELAI_S,
    ) -> AsyncIterator[Morceau]:
        """Les morceaux de la réponse, puis **un** morceau de fin.

        Toujours un dernier morceau, `fin` ou `indisponible` — jamais une
        exception pour ce qui vient du fournisseur : un service d'agrément qui
        se plaint est pire que son absence (décision 6). L'issue et la raison
        sont dans le morceau de fin, et c'est l'écran qui décide de se taire.
        """
        fournisseur = self._fabrique()
        raison = self._empechement(fournisseur)
        if raison is not None:
            yield Morceau(INDISPONIBLE, raison=raison)
            return

        appel = AppelTexte(
            identifiant=uuid.uuid4().hex,
            modele=fournisseur.modele,
            metier=metier,
            signes_envoyes=len(consigne) + len(texte),
        )
        debut = time.monotonic()
        cout_lu = False
        try:
            # `aclosing` : refermer *ce* générateur-ci referme **tout de suite**
            # celui de l'adaptateur, donc la liaison. Sans lui, l'adaptateur
            # resterait suspendu jusqu'au ramasse-miettes, et le fournisseur
            # continuerait d'écrire — et de facturer — pour personne.
            async with contextlib.aclosing(
                fournisseur.flux(consigne, texte, delai=delai)
            ) as flux:
                async for recu in flux:
                    if recu.chez_lui and not appel.chez_lui:
                        appel.chez_lui = recu.chez_lui
                    if recu.consomme is not None:
                        appel.consomme = recu.consomme
                        cout_lu = True
                    if recu.texte:
                        appel.signes_recus += len(recu.texte)
                        yield Morceau(TEXTE, texte=recu.texte)
            appel.issue = REPONDU
        except DelaiDepasse as erreur:
            appel.issue = ABANDONNE
            appel.raison = erreur.raison
        except AppelRefuse as erreur:
            appel.issue = ECHOUE
            appel.raison = erreur.raison
            if erreur.consomme:
                appel.consomme = erreur.consomme
                appel.unite = erreur.unite
                cout_lu = True
        except ErreurAtelier as erreur:
            appel.issue = ECHOUE
            appel.raison = erreur.raison
        finally:
            # **Compté avant tout le reste, et sans `await`** : ce bloc tourne
            # aussi quand celui qui écoute est parti — l'issue reste alors
            # `interrompu` —, et un `await` ici pourrait être annulé à son tour.
            appel.duree_s = round(time.monotonic() - debut, 3)
            # **Zéro connu et zéro inconnu ne sont pas la même chose.** Un appel
            # coupé, ou qu'OpenRouter a commencé à servir (il a donné son
            # numéro), a pu consommer sans qu'on ait lu son coût : on ne l'écrit
            # pas « gratuit ». Un refus d'entrée (401, 402, 429) n'a rien
            # consommé, et le dit.
            appel.cout_inconnu = not cout_lu and (
                appel.issue in (ABANDONNE, INTERROMPU) or appel.chez_lui is not None
            )
            self._garder(appel)
        yield Morceau(FIN, appel=appel)

    def _garder(self, appel: AppelTexte) -> None:
        """Le disque d'abord — c'est lui qui fait foi —, l'index ensuite."""
        self._fichiers.ajouter_appel_texte(appel.en_json())
        self._base.enregistrer_appel_texte(appel)

    # ── Ce qu'il a coûté ─────────────────────────────────────────────────────

    def depense(self, depuis: float = 0.0) -> dict[str, object]:
        """Ce que le coup de main a coûté depuis `depuis` (CM6 : le mois)."""
        return self._base.depense_texte(depuis)

