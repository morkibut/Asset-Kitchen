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

**Le plafond du mois** (CM6, décision 8) se lit à la même porte que la clé —
c'est la même question (*peut-il partir ?*) et la même réponse
(`indisponible`, avec sa raison). **La règle qui le fait tenir en rafale** :
*sous un verrou, un appel réserve la borne haute de ce qu'il peut coûter, et ne
part que si le mois déjà pesé plus les réservations en vol plus la sienne tient
sous le plafond ; à la fin, toujours sous le verrou, il écrit son coût réel et
rend sa réservation — ou la garde comme poids s'il ne connaît pas son coût.*
Sans la réservation, dix appels simultanés lisaient le même reste, puisque
aucun n'était encore écrit, et partaient tous (`tests/test_cm6_plafond.py`).

**Décisions de CM6, écrites ici parce que c'est ici qu'elles mordent** :

- **L'unité est le dollar**, affiché tel : `$1,00` par défaut. Le plan dit
  « 1 € » ; toute la dépense du produit est comptée en dollars (`cout_usd`), et
  une conversion fixe aurait été une vérité de plus à tenir à jour. Un dollar
  vaut moins qu'un euro : le défaut est donc **plus strict** que celui du plan,
  jamais plus large.
- **Le mois est le mois civil local**, celui qui nomme déjà les journaux
  `appels-texte/<AAAA-MM>.jsonl` : il commence le 1er à minuit, heure de la
  machine. Un appel appartient au mois où il est **parti**.
- **La réservation est une borne haute**, pas une moyenne : tous les signes
  envoyés comptés pour des jetons à deux signes, plus la réponse la plus longue
  permise (`JETONS_MAX`), au prix plafond de `PRIX_JETON_MAX_USD`.

**L'agent ne s'en sert pas** (décision 9) : aucun outil MCP ne mène ici, et
rien de ce qui passe par ce service ne compte dans le cadre de l'agent — ses
appels ne sont pas des générations, et `ServiceAgent._mesurer` ne lit que
celles-là.
"""

from __future__ import annotations

import contextlib
import math
import threading
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
from atelier.fournisseur.openrouter_texte import DELAI_S, JETONS_MAX, OpenRouterTexte

#: Le plafond du mois tant qu'on n'y a pas touché, en dollars (décision 8).
PLAFOND_DEFAUT_USD = 1.0

#: Le prix d'un jeton **au plus haut**, entrée comme sortie : deux dollars le
#: million. Le petit modèle du coup de main coûte bien moins (plan § Ce que ce
#: plan ne couvre pas) ; ⚠️ **jamais vérifié contre le vrai tarif**, comme
#: l'identifiant du modèle. S'il changeait de modèle pour un plus cher, c'est
#: cette ligne qui bouge — sinon le plafond pourrait être dépassé d'un appel.
PRIX_JETON_MAX_USD = 2e-6

#: Ce qu'une requête porte au-delà des signes : les rôles, l'enveloppe.
JETONS_D_ENVELOPPE = 64


def reserve_pour(signes: int) -> float:
    """La borne haute de ce qu'un appel peut coûter, en dollars.

    Un jeton pour **deux** signes envoyés — le français en fait plutôt trois
    ou quatre, c'est donc large —, plus la réponse la plus longue permise.
    """
    jetons = math.ceil(signes / 2) + JETONS_D_ENVELOPPE + JETONS_MAX
    return round(jetons * PRIX_JETON_MAX_USD, 6)


def signes_du_plus_petit_appel() -> int:
    """Ce que **tout** appel du coup de main envoie au moins : la plus courte
    des consignes, puis la fiche du produit, qui part avec chacune.

    **La marque ne promet que ce que l'appel tient** (relecture croisée du
    chantier, 25 septembre 2026). `etat()` jugeait le plafond sur un appel de
    zéro signe — environ deux dixièmes de centime —, alors que le plus court
    des vrais appels emporte la fiche et sa consigne, dix mille signes et plus
    d'un centime de réservation. Entre les deux, la marque paraissait, et
    l'appel qu'elle lançait revenait `indisponible` : exactement *le bouton
    qui déçoit* que la décision 6 interdit. Une borne **basse** de ce qui
    partira, jamais plus : elle ne ferme la marque que lorsqu'aucun appel ne
    pourrait passer.
    """
    # Importés ici : le service reste le tuyau, et ne dépend de ce qui part que
    # pour cette seule mesure.
    from atelier.domaine.coup_de_main import CONSIGNES, SEPARATEUR
    from atelier.services.contexte_coup_de_main import fiche_du_produit

    try:
        fiche = len(fiche_du_produit().strip())
    except OSError:
        fiche = 0
    consigne = min((len(c) for c in CONSIGNES.values()), default=0)
    return consigne + len(SEPARATEUR) + fiche


def debut_du_mois(instant: float) -> float:
    """Le 1er du mois de `instant`, à minuit **heure locale** — le mois qui
    nomme les journaux `appels-texte/<AAAA-MM>.jsonl`."""
    local = time.localtime(instant)
    return time.mktime((local.tm_year, local.tm_mon, 1, 0, 0, 0, 0, 0, -1))


def _en_dollars(montant: float) -> str:
    return f"${montant:.2f}".replace(".", ",")


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
        # **Le verrou du plafond** (CM6). Un `threading.Lock` et pas un verrou
        # d'`asyncio` : rien ne s'attend dessous — lire, comparer, noter —, et
        # `etat()` est aussi lu hors de la boucle. Ce qu'il garde : les
        # réservations des appels en vol, par identifiant.
        self._verrou = threading.Lock()
        self._en_vol: dict[str, float] = {}
        # L'heure, remplaçable par un essai qui veut changer de mois.
        self._horloge: Callable[[], float] = time.time

    # ── Le plafond du mois (CM6) ─────────────────────────────────────────────

    def plafond_usd(self) -> float:
        """Relu **à chaque appel** : un plafond baissé vaut dès le suivant."""
        brut = self._fichiers.lire_coup_de_main().get("plafond_usd")
        try:
            valeur = float(brut)
        except (TypeError, ValueError):
            return PLAFOND_DEFAUT_USD
        return valeur if math.isfinite(valeur) and valeur >= 0 else PLAFOND_DEFAUT_USD

    def regler_plafond(self, plafond_usd: float) -> dict[str, object]:
        """Pose le plafond du mois. Zéro coupe le coup de main ; négatif est refusé."""
        valeur = float(plafond_usd)
        if not math.isfinite(valeur) or valeur < 0:
            raise ValueError("un plafond est un montant positif ou nul")
        contenu = self._fichiers.lire_coup_de_main()
        contenu["plafond_usd"] = round(valeur, 6)
        self._fichiers.ecrire_coup_de_main(contenu)
        return self.mois()

    def mois(self) -> dict[str, object]:
        """Le compteur : ce que le coup de main a pesé ce mois-ci, et ce qui reste.

        `pese_usd` est ce que le plafond compte — les coûts connus, et la
        réservation des appels au coût inconnu ; `cout_usd` les seuls coûts
        connus ; `en_vol_usd` ce que les appels en cours retiennent.
        """
        depuis = debut_du_mois(self._horloge())
        depense = self._base.depense_texte(depuis)
        plafond = self.plafond_usd()
        with self._verrou:
            en_vol = sum(self._en_vol.values())
        pese = float(depense["pese_usd"])
        reste = max(0.0, plafond - pese - en_vol)
        return {
            # Même règle que `etat()` : l'appel le plus court ne tient plus.
            "atteint": reste + 1e-9 < reserve_pour(signes_du_plus_petit_appel()),
            "depuis": depuis,
            "plafond_usd": plafond,
            "pese_usd": round(pese, 6),
            "cout_usd": depense["cout_usd"],
            "en_vol_usd": round(en_vol, 6),
            "reste_usd": round(reste, 6),
            "appels": depense["appels"],
            "inconnus": depense["inconnus"],
        }

    def _plafond_atteint(self, reserve: float) -> str | None:
        """**À lire sous le verrou** : la raison du plafond, ou `None`."""
        plafond = self.plafond_usd()
        pese = float(self._base.depense_texte(debut_du_mois(self._horloge()))["pese_usd"])
        engage = pese + sum(self._en_vol.values())
        if engage + reserve <= plafond + 1e-9:
            return None
        if plafond <= 0:
            return "le coup de main est coupé — son plafond du mois est à zéro"
        return (
            f"plafond du mois atteint ({_en_dollars(plafond)}) — "
            "il se relève dans Réglages › Consommations"
        )

    # ── Peut-il partir ? ─────────────────────────────────────────────────────

    def etat(self) -> dict[str, object]:
        """Ce que la marque a besoin de savoir pour paraître ou se taire.

        Le plafond s'y lit pour **l'appel le plus court possible** — la plus
        courte consigne et la fiche, qui partent toujours
        (`signes_du_plus_petit_appel`) : si même celui-là ne tient plus, la
        marque disparaît et dit pourquoi.

        **`motif`** (CM8) distingue les deux façons de se taire, pour l'écran
        seul — `raison` reste la phrase à lire : `"plafond"` quand c'est le
        plafond du mois qui bloque (l'écran y laisse une trace, une ligne
        grise), `"indisponible"` pour tout le reste (pas de clé, réseau coupé —
        décision 6, le silence total). `None` quand `disponible` est vrai.
        """
        fournisseur = self._fabrique()
        plancher = reserve_pour(signes_du_plus_petit_appel())
        with self._verrou:
            raison = self._empechement(fournisseur, plancher)
        motif = None
        if raison is not None:
            motif = "indisponible" if fournisseur.indisponible() else "plafond"
        return {
            "disponible": raison is None,
            "raison": raison,
            "motif": motif,
            "modele": fournisseur.modele,
        }

    def _empechement(self, fournisseur: OpenRouterTexte, reserve: float) -> str | None:
        """La raison pour laquelle rien ne partira, ou `None`.

        **La seule porte**, lue par `etat` et par `repondre` : ce que la marque
        annonce et ce que l'appel fait ne peuvent pas diverger. La clé d'abord
        — sans elle, le plafond ne dit rien d'utile —, le plafond du mois
        ensuite (CM6). **À lire sous le verrou.**
        """
        return fournisseur.indisponible() or self._plafond_atteint(reserve)

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
        signes = len(consigne) + len(texte)
        reserve = reserve_pour(signes)
        identifiant = uuid.uuid4().hex
        # **Lire le reste et le retenir, d'un seul geste** (CM6) : entre les
        # deux, un autre appel lirait le même reste. Aucun `yield` entre la
        # réservation et le `try` qui la rend.
        with self._verrou:
            raison = self._empechement(fournisseur, reserve)
            if raison is None:
                self._en_vol[identifiant] = reserve
        if raison is not None:
            yield Morceau(INDISPONIBLE, raison=raison)
            return

        appel = AppelTexte(
            identifiant=identifiant,
            modele=fournisseur.modele,
            metier=metier,
            signes_envoyes=signes,
            reserve_usd=reserve,
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
            # **Écrire le coût et rendre la réservation sous le même verrou** :
            # entre les deux, l'appel ne compterait nulle part — ou deux fois.
            # Au coût inconnu, il pèse sa réservation (`pese_usd`).
            with self._verrou:
                try:
                    self._garder(appel)
                finally:
                    self._en_vol.pop(identifiant, None)
        yield Morceau(FIN, appel=appel)

    def _garder(self, appel: AppelTexte) -> None:
        """Le disque d'abord — c'est lui qui fait foi —, l'index ensuite."""
        self._fichiers.ajouter_appel_texte(appel.en_json())
        self._base.enregistrer_appel_texte(appel)

    # ── Ce qu'il a coûté ─────────────────────────────────────────────────────

    def depense(self, depuis: float = 0.0) -> dict[str, object]:
        """Ce que le coup de main a coûté depuis `depuis` (le mois : `mois()`)."""
        return self._base.depense_texte(depuis)

