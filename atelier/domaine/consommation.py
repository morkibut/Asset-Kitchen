# -*- coding: utf-8 -*-
"""Ce qu'un appel a **consommé**, et dans quelle unité.

Arrivé en F2 (`docs/PLAN.md` § V2.2). C'est la révision n°2 de la version, et
elle tient en une phrase : *« le coût enregistré est celui que l'appel facture »*
devient *« ce que l'appel a consommé, dans l'unité du fournisseur »*.

**Ce qui survit de la règle de T1, et qui en était le fond** : on n'enregistre
jamais un chiffre annoncé, on enregistre ce que l'appel a réellement consommé.
Des dollars quand c'en est, un jeton quand c'en est un, rien quand ce n'est
rien. L'unité change, la règle ne change pas.

**Une quantité ne se lit jamais sans son unité, et c'est tout le module.** Un
`1.0` qui traîne sans dire s'il est un dollar ou un jeton est la porte d'entrée
du défaut que cette tranche existe pour fermer : un appel gratuit affiché
`$0,0000`, qui se lit *sans limite* là où il faut lire *sans prix*.

**Et un total en argent ne compte que de l'argent.** C'est un invariant de la
V2.2, et il est tenu ici par construction plutôt que par vigilance : `argent()`
rend zéro dès que l'unité n'est pas celle de l'argent, donc aucune somme de
dollars ne peut être polluée par des jetons, où qu'elle soit calculée.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: L'unité de l'argent. C'est celle de tout ce qui a été enregistré avant la
#: V2.2 — un seul fournisseur, qui facturait en dollars —, donc c'est le défaut
#: partout où une unité manque. Une dépense d'avant la V2.2 se relit ainsi sans
#: rien perdre : elle est en dollars, et elle le dit.
USD = "usd"

#: Celle de Pollinations, mesurée le 31 août 2026 : **un jeton par image**,
#: annoncé dans l'en-tête `x-usage-total-tokens` de chaque réponse
#: (`docs/releve-fournisseurs.md` § Fiche 1). C'est le premier fournisseur du
#: produit qui ne compte pas en argent.
JETON = "jeton"

#: Ce que le compte d'une réserve dit de lui-même. Un chiffre de réserve dit
#: **toujours** d'où il vient — invariant de la V2.2 —, parce que les deux ne
#: valent pas la même chose : ce qui est lu chez le fournisseur fait foi, ce qui
#: est compté ici ne connaît que les appels partis d'ici.
LU = "fournisseur"
ICI = "ici"


def est_argent(unite: str | None) -> bool:
    """Vrai quand cette unité-là se paie en argent.

    Une unité vide est de l'argent : c'est ce qu'était tout le produit avant la
    V2.2, et rien de ce qui a été écrit à ce moment-là ne portait d'unité.
    """
    return (unite or USD) == USD


def argent(quantite: float, unite: str | None) -> float:
    """La part de cette consommation-là qui est de l'argent. Zéro sinon.

    **Le filtre unique du produit**, et la raison pour laquelle *un total en
    argent ne compte que de l'argent* n'a pas à être vérifié à chaque somme :
    un jeton ne peut pas entrer dans un total de dollars, parce qu'il vaut zéro
    dollar partout.
    """
    return float(quantite) if est_argent(unite) else 0.0


def accorde(quantite: float, unite: str | None) -> str:
    """« 1 jeton », « 3 jetons », « $0,0245 » — pour l'agent et le MCP.

    L'écran a sa propre mise en forme (`interface/src/api.ts`) et c'est normal :
    elle porte la virgule décimale et l'espace fine du produit. Celle-ci sert là
    où il n'y a pas d'écran — la façade de l'agent, et les messages d'erreur.
    """
    if est_argent(unite):
        return f"${float(quantite):.4f}"
    entier = int(quantite) if float(quantite).is_integer() else quantite
    pluriel = "s" if float(quantite) >= 2 else ""
    return f"{entier} {unite}{pluriel}"


# ── Ce qu'un fournisseur alloue ──────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Compte:
    """Ce qu'un fournisseur déclare de sa réserve. **Une forme, pas un chiffre.**

    L'adaptateur dit dans quelle unité il compte, ce qu'il alloue s'il alloue
    quelque chose, d'où le chiffre viendra, et à quelle cadence il accepte les
    appels. Il ne dit pas ce qui est parti : ça, c'est `ServiceReserves` qui le
    compte, ou le fournisseur lui-même quand il sait le dire.

    **`plafond` vaut `None` bien plus souvent qu'on ne l'aurait cru**, et c'est
    le résultat le plus utile du relevé F0 : aucun des deux fournisseurs retenus
    n'annonce d'allocation. Pollinations n'a pas de réserve du tout — sa limite
    est une **cadence**, un appel toutes les quinze secondes — et Cloudflare
    n'expose pas la sienne. Un `plafond` inventé serait un chiffre que personne
    n'a mesuré, et ce dépôt n'en écrit pas.
    """

    unite: str
    #: Ce que le fournisseur alloue par période, ou `None` s'il n'annonce rien.
    #: Sans lui il n'y a pas de « ce qui reste », seulement « ce qui est parti ».
    plafond: float | None = None
    #: `ICI` ou `LU`. Le relevé F0 a montré que `ICI` est le cas **normal** et
    #: non l'exception : aucun des deux fournisseurs retenus ne dit ce qu'il
    #: reste. L'obligation de l'écrire devient donc la règle, pas la nuance.
    source: str = ICI
    #: L'heure à laquelle le compte repart, **en clair** — « minuit ». Vide
    #: quand rien ne se renouvelle.
    renouvellement: str = ""
    #: Le délai minimal entre deux appels, en secondes. Zéro quand le
    #: fournisseur n'en impose aucun. Mesuré, jamais supposé.
    cadence_s: float = 0.0

    def en_json(self) -> dict[str, Any]:
        return {
            "unite": self.unite,
            "plafond": self.plafond,
            "source": self.source,
            "renouvellement": self.renouvellement,
            "cadence_s": self.cadence_s,
        }


@dataclass(frozen=True, slots=True)
class Reserve:
    """Le compte d'un fournisseur, **rempli** : ce qui est parti, ce qui reste.

    C'est ce que les deux écrans affichent — celui où l'on choisit un modèle et
    celui qui confirme un appel. Les deux lisent le même objet, pour la raison
    payée en E13 : deux calculs à deux endroits ont annoncé deux chiffres
    différents pour le même appel, à trois centimètres l'un de l'autre.
    """

    fournisseur: str
    unite: str
    #: Ce qui est parti depuis `depuis`, dans l'unité ci-dessus.
    consomme: float
    plafond: float | None
    source: str
    renouvellement: str
    cadence_s: float
    #: L'instant à partir duquel `consomme` compte. Zéro quand rien ne borne la
    #: fenêtre — le compte est alors celui de tout ce que l'atelier a fait.
    depuis: float = 0.0

    @property
    def reste(self) -> float | None:
        """Ce qui reste, ou `None` quand aucun plafond n'est annoncé.

        **`None` n'est pas zéro, et l'écran ne doit pas les confondre.** Zéro
        veut dire « la réserve est vide, attends demain » ; `None` veut dire
        « ce fournisseur n'annonce aucune réserve », ce qui est le cas des deux
        fournisseurs du produit aujourd'hui.
        """
        if self.plafond is None:
            return None
        return max(0.0, round(self.plafond - self.consomme, 6))

    def manque_pour(self, quantite: float) -> float | None:
        """Ce qui manquerait pour un lot de cette taille-là, ou `None`.

        `None` quand rien ne manque — soit parce qu'il n'y a pas de plafond,
        soit parce que la réserve suffit. Un lot que la réserve du jour ne peut
        pas finir est annoncé **avant** de partir, et c'est ce chiffre-là qu'il
        annonce.
        """
        reste = self.reste
        if reste is None or quantite <= reste:
            return None
        return round(quantite - reste, 6)

    def en_json(self) -> dict[str, Any]:
        return {
            "fournisseur": self.fournisseur,
            "unite": self.unite,
            "consomme": round(self.consomme, 6),
            "plafond": self.plafond,
            "reste": self.reste,
            "source": self.source,
            "renouvellement": self.renouvellement,
            "cadence_s": self.cadence_s,
            "depuis": self.depuis,
        }
