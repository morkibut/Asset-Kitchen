# -*- coding: utf-8 -*-
"""Ce que le domaine attend d'un fournisseur. Rien de plus.

**Il y en a deux depuis A9**, et c'est la nouveauté de la V3 : un fournisseur
d'images, et un **animateur** qui rend des clips. Ce sont deux ports et non un
seul parce que les trois gestes ne se recouvrent pas — un appel d'image tient
dans une requête, un clip se soumet, s'attend et se télécharge, et survit à une
fermeture de l'atelier. Le même adaptateur peut porter les deux ; le produit ne
les confond jamais.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from atelier.domaine import Compte, Demande, Modele
from atelier.domaine.animation import DemandeClip, ModeleVideo
from atelier.domaine.consommation import USD, argent
from atelier.domaine.secret import Secret


@dataclass(frozen=True, slots=True)
class ImageProduite:
    """Une image, et ce qu'elle a **réellement** consommé.

    `consomme` vient de la réponse de l'appel, jamais du tarif du catalogue :
    `riverflow-v2.5-fast` annonce $0,019 l'image et en facture $0,042, les
    références d'entrée étant facturées en plus.

    **`unite` est arrivée en F2**, et c'est la révision n°2 de la V2.2 : un
    fournisseur qui ne facture pas consomme quand même. Pollinations rend un
    jeton par image, annoncé dans ses en-têtes. Le défaut est l'argent — c'est
    ce qu'était tout le produit avant, et un adaptateur qui compte en dollars
    n'a donc rien à déclarer.
    """

    octets: bytes
    consomme: float
    type_media: str | None = None  # ce que le fournisseur *dit* avoir rendu
    unite: str = USD

    @property
    def cout_usd(self) -> float:
        """La part en argent. Zéro dès que l'unité n'est pas celle de l'argent."""
        return argent(self.consomme, self.unite)


class PortFournisseur(Protocol):
    """Trois gestes : dire qui on est, dire ce qu'on sait faire, et le faire.

    **`nom` n'est plus décoratif depuis F1** : c'est lui qui qualifie chacun des
    modèles du fournisseur (`atelier.domaine.catalogue.nommer`), donc il est
    écrit dans les générations et relu des mois plus tard. **Le changer
    renommerait tous les modèles déjà enregistrés.**
    """

    nom: str

    async def catalogue(self) -> list[Modele]:
        """Les modèles et leurs capacités, tels que le fournisseur les déclare."""
        ...

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        """Un appel, une image. Lève une erreur du domaine, jamais une erreur HTTP."""
        ...

    def indisponible(self) -> str | None:
        """Pourquoi ce fournisseur ne peut pas travailler **maintenant**, ou `None`.

        Arrivé en F1, et c'est la révision qui se voit le plus : *« la clé du
        fournisseur est le seul préalable dur du produit »* tombe. Un fournisseur
        qui ne demande ni compte ni clé rend toujours `None` ; un autre rend la
        phrase française qui grisera **ses** modèles, et eux seuls.

        Ce n'est pas une panne — une panne se découvre au moment de l'appel
        (US-95). C'est un manque connu d'avance, et le produit ne propose jamais
        ce qu'il devra refuser.
        """
        ...

    def compte(self) -> Compte | None:
        """Dans quelle unité ce fournisseur compte, et ce qu'il alloue.

        Arrivé en F2. `None` — il compte en argent, et l'argent a déjà sa barre
        de tête ; c'est la réponse d'OpenRouter. Sinon, la **forme** de sa
        réserve : l'unité, ce qu'il alloue s'il alloue quelque chose, d'où le
        chiffre viendra, et à quelle cadence il accepte les appels.

        **Il ne dit jamais ce qui est parti** — ça se compte ailleurs
        (`atelier.services.reserves`), et pour une raison de fond : ce qui est
        compté ici ne connaît que les appels partis d'ici, et le produit doit
        pouvoir l'écrire à côté du chiffre. Un adaptateur qui rendrait un
        « il reste 42 » sans dire d'où il le tient enfreindrait l'invariant de
        la V2.2 : *un chiffre de réserve dit toujours s'il est relevé chez le
        fournisseur ou compté ici.*
        """
        ...

    def secrets(self) -> tuple[Secret, ...]:
        """Les places qu'il faut remplir pour qu'il travaille. Vide : aucune.

        Arrivé en F3. Le tiroir cessait d'être « la clé » : **il en existe qui
        en demandent deux** — Cloudflare veut un identifiant de compte *et* un
        jeton —, et un tiroir qui n'en accepterait qu'un les découvrirait en F4.

        **Une déclaration, jamais des valeurs.** L'adaptateur dit quelles places
        existent et comment on en parle ; ce qu'il y a dedans se lit dans
        `atelier.reglages`, à chaque appel, pour que déposer serve **au premier
        appel suivant sans redémarrer** — règle de T1, étendue au pluriel.

        C'est aussi de cette liste que sort la phrase du grisé : `indisponible`
        la compose avec `atelier.domaine.secret.ce_qui_manque`, qui **dit
        lequel** manque quand il y en a plusieurs.
        """
        ...


# ── L'animateur — le second port, arrivé en A9 ───────────────────────────────


@dataclass(frozen=True, slots=True)
class ClipProduit:
    """Un clip, et ce qu'il a **réellement** consommé.

    `consomme` vient de la réponse du travail, jamais de l'estimation affichée
    avant l'envoi. L'écart n'est pas anecdotique : relevé sur treize clips le
    2 septembre 2026, il va de **+4 % à −58 %** selon le modèle. Une estimation
    par jetons vidéo est **une borne haute**, pas un montant, et le produit n'en
    enregistre jamais une à la place de l'autre.

    `generation` est l'identifiant que le fournisseur donne à la **facturation**,
    quand il en donne un. Il n'est pas le numéro du travail, et les confondre a
    coûté une demi-journée : interroger le journal de facturation avec le numéro
    du travail rend une réponse vide, et dix-sept clips payés ont ainsi porté la
    mention *montant non relu* alors que la réponse d'attente le contenait.
    """

    octets: bytes
    consomme: float
    unite: str = USD
    type_media: str | None = None
    travail: str = ""
    generation: str = ""
    # **Le montant a-t-il vraiment été lu ?** Faux quand la réponse n'en portait
    # aucun. Sans ce champ, un fournisseur muet sur le prix ferait enregistrer
    # zéro, et un clip payé se lirait comme un clip gratuit — le total du projet
    # serait faux vers le bas, silencieusement, ce qui est pire qu'un trou. Avec
    # lui, le produit écrit zéro **en disant qu'il ne sait pas**.
    montant_relu: bool = True

    @property
    def cout_usd(self) -> float:
        """La part en argent. Zéro dès que l'unité n'est pas celle de l'argent."""
        return argent(self.consomme, self.unite)


@dataclass(frozen=True, slots=True)
class EtatTravail:
    """Où en est un clip commandé, sans le télécharger.

    Trois valeurs et pas une de plus : il travaille, il est prêt, il a échoué.
    Le vocabulaire du fournisseur — `queued`, `in_progress`, `completed`,
    `cancelled` — ne franchit pas son adaptateur.
    """

    travail: str
    fini: bool = False
    echoue: bool = False
    raison: str = ""


class PortAnimateur(Protocol):
    """Quatre gestes, et le troisième est celui qui n'existe pas côté image.

    **Soumettre et récupérer sont séparés exprès.** Un appel d'image part et
    revient dans la même requête ; un clip se fait attendre deux minutes, et
    l'atelier peut fermer entre-temps. Si un seul geste portait les deux, un
    clip payé pendant qu'on fermait l'atelier serait un clip perdu — et donc un
    clip repayé. Le numéro du travail est ce qui l'empêche.

    **Rien ici ne rappelle le fournisseur tout seul.** `recuperer` est un geste
    que l'auteur demande (US-438) : c'est la même règle que *rien n'est jamais
    relancé automatiquement*, appliquée à un objet qui, lui, est déjà payé.
    """

    nom: str

    async def catalogue_video(self) -> list[ModeleVideo]:
        """Les modèles vidéo et leurs capacités, tels que le fournisseur les déclare."""
        ...

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        """Commande le clip et rend **le numéro du travail**, sans attendre.

        C'est le seul geste qui engage la dépense. Il rend dès que le
        fournisseur a accepté, pour que le numéro s'écrive sur le disque avant
        la première seconde d'attente.
        """
        ...

    async def etat(self, travail: str) -> EtatTravail:
        """Où en est ce travail. Ne télécharge rien, ne coûte rien."""
        ...

    async def recuperer(self, travail: str) -> ClipProduit:
        """Le clip fini et **ce qu'il a coûté**. Ne relance jamais rien.

        Appelable autant de fois qu'on veut tant que le fournisseur garde le
        travail : un clip déjà payé se rapatrie, il ne se recommande pas.
        """
        ...
