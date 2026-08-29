# -*- coding: utf-8 -*-
"""Le cadre de l'agent — garde-fous, compteur de séance, et le dépôt de fichier.

**Ce n'est pas un geste de plus, c'est le cadre autour des gestes.** Le MCP n'a
aucune logique propre (`docs/ARCHITECTURE.md` §4, règle 2) : chacun de ses outils
appelle le service que l'écran appelle. Ce fichier-ci ne fabrique donc rien — il
répond à trois questions que l'écran ne se pose jamais, parce que l'auteur est
devant son clavier et l'agent ne l'est pas :

- **Ai-je le droit de dépenser ?** Un plafond de générations par séance.
- **Avec quel modèle ?** Un modèle d'exploration imposé, parce qu'un agent qui
  code a besoin d'un visuel correct tout de suite, pas d'un asset final. Rapport
  de six sur le coût, pour une perte de qualité qui ne compte pas à ce
  moment-là ; la version de production se regénère depuis l'écran.
- **Où poser le fichier ?** Le dossier du jeu, avec ses trois règles.

**Les deux garde-fous se relisent à chaque appel, jamais au démarrage** (US-91).
C'est la même règle que la clé du fournisseur, et pour la même raison : on doit
pouvoir changer d'avis en cours de séance sans rien redémarrer. Le fichier est
donc relu à chaque question posée — il fait quelques centaines d'octets, et un
cache ici serait la seule chose du produit qu'un réglage ne traverserait pas.

**Le compteur, lui, vit en mémoire.** « Par séance » veut dire *depuis que
l'atelier est ouvert* : le remettre à zéro est un geste que l'auteur connaît
déjà — fermer la fenêtre. L'écrire sur le disque en ferait un total à purger, et
poserait la question de quand purger, qui n'a pas de bonne réponse.

**Aucune invite d'autorisation, jamais** (US-88). Un plafond atteint est un
refus immédiat qui nomme le plafond et le moyen de le relever, pas une question
posée à un auteur qui regarde peut-être ailleurs. C'est ce refus-là qui rend le
plafond utilisable : il donne à l'agent quelque chose à dire.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import AGENT
from atelier.services.catalogue import ServiceCatalogue
from atelier.services.evenements import Diffusion

# Le modèle d'exploration, et ses options. Nommé ici et pas dans le catalogue :
# c'est une décision du produit sur ce que l'agent dépense, pas une propriété du
# fournisseur. `docs/archi-fournisseur.md` § Serveur MCP.
MODELE_EXPLORATION = "openai/gpt-image-2"
OPTIONS_EXPLORATION: dict[str, Any] = {"quality": "low"}

# Vingt générations : de quoi tenir une séance de code entière sans y penser, et
# assez bas pour qu'un agent parti en boucle se cogne avant d'avoir coûté un
# repas. Le chiffre se règle à l'écran ; c'est son ordre de grandeur qui compte.
PLAFOND_PAR_DEFAUT = 20


class PlafondAtteint(ErreurAtelier):
    """Le refus qui nomme le plafond **et le moyen de le relever** (US-85).

    Un refus qui dirait seulement « plafond atteint » obligerait l'agent à
    inventer la suite. Celui-ci porte les trois chiffres et la phrase que l'agent
    répétera à l'auteur — c'est tout ce que « actionnable » veut dire ici.
    """

    code = "plafond_atteint"

    def __init__(self, faites: int, plafond: int) -> None:
        super().__init__(
            f"plafond de la séance atteint — {faites} générations sur {plafond}. "
            "Relève-le ou désactive-le dans l'atelier, écran Réglages, "
            "bloc « L'agent » ; il repart à zéro à la prochaine ouverture.",
            ou_aller="reglages",
        )
        self.faites = faites
        self.plafond = plafond


class DepotRefuse(ErreurAtelier):
    """Le dossier du jeu n'a pas voulu du fichier, et le chemin fautif le dit.

    « Afin de ne jamais détruire du travail par mégarde » (US-84) : un refus qui
    ne nommerait pas le chemin obligerait l'agent à deviner lequel des trois
    dossiers qu'il vient de nommer a posé problème.
    """

    code = "depot_refuse"


@dataclass(frozen=True, slots=True)
class GardeFous:
    """Ce que l'auteur a décidé du cadre de l'agent, à cet instant.

    Chaque garde-fou porte son interrupteur **et** sa valeur, séparément : les
    désactiver ne doit pas perdre le réglage qu'on y avait posé, sans quoi
    rallumer demanderait de le retrouver.
    """

    plafond_actif: bool = True
    plafond: int = PLAFOND_PAR_DEFAUT
    modele_actif: bool = True
    modele: str = MODELE_EXPLORATION
    options: dict[str, Any] = field(default_factory=lambda: dict(OPTIONS_EXPLORATION))
    # Le dossier du jeu — là où `generate_asset` pose son fichier quand l'agent
    # ne dit pas où. Vide veut dire « nulle part par défaut », et c'est un état
    # légitime : l'agent nomme alors son dossier à chaque appel.
    dossier_jeu: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "plafond_actif": self.plafond_actif,
            "plafond": self.plafond,
            "modele_actif": self.modele_actif,
            "modele": self.modele,
            "options": dict(self.options),
            "dossier_jeu": self.dossier_jeu,
        }

    @staticmethod
    def depuis_json(d: dict[str, Any] | None) -> "GardeFous":
        d = d or {}
        return GardeFous(
            plafond_actif=bool(d.get("plafond_actif", True)),
            # Un plafond à zéro n'est pas un plafond, c'est un interrupteur — et
            # l'interrupteur existe déjà. On ne descend pas sous un.
            plafond=max(1, int(d.get("plafond", PLAFOND_PAR_DEFAUT))),
            modele_actif=bool(d.get("modele_actif", True)),
            modele=str(d.get("modele") or MODELE_EXPLORATION),
            options=dict(d.get("options") or OPTIONS_EXPLORATION),
            dossier_jeu=str(d.get("dossier_jeu") or ""),
        )


class ServiceAgent:
    """Le cadre, le compteur, et le dépôt. Aucun geste de fabrication ici.

    **Aucun `fournisseur` dans ce fichier**, et ça se lit dans les imports :
    autoriser une dépense ne demande pas de sortir, et poser un fichier dans le
    dossier du jeu non plus.
    """

    def __init__(
        self,
        fichiers: Fichiers,
        diffusion: Diffusion,
        catalogue: "ServiceCatalogue | None" = None,
        generations: "ServiceGenerations | None" = None,
    ) -> None:
        self._fichiers = fichiers
        self._diffusion = diffusion
        # **Le catalogue, parce que « quel modèle » est sa question.** Un modèle
        # imposé que le catalogue ne déclare pas — il a disparu, ou l'atelier
        # tourne sur le catalogue de repli — n'est pas un modèle : le lui
        # opposer rendrait l'agent inutilisable hors ligne, pour un garde-fou
        # qui existe justement pour l'aider.
        self._catalogue = catalogue
        # **Les générations, parce que la consommation est un fait sur elles.**
        # « Un état dérivable ne se garde pas en double » (`AGENTS.md`) : un
        # compteur tenu ici et un coût tenu là-bas finiraient par dire deux
        # chiffres — celui du refus opposé à l'agent et celui du compteur lu par
        # l'auteur, c'est-à-dire les deux qui doivent s'accorder.
        self._generations = generations
        # « Par séance » — depuis l'ouverture de l'atelier, et pas plus loin.
        # Le remettre à zéro est un geste que l'auteur connaît déjà : fermer la
        # fenêtre. L'écrire sur le disque en ferait un total à purger, et
        # poserait la question de quand purger, qui n'a pas de bonne réponse.
        self._depuis = time.time()
        # Ce qui est réservé et pas encore enregistré. Le compte dérivé ne peut
        # pas voir une génération pendant l'intervalle qui sépare la réservation
        # de son écriture — et il y a un `await` dedans, donc l'intervalle est
        # réel : sans cette réserve, deux appels lancés ensemble franchiraient
        # tous les deux un plafond qui n'en autorisait qu'un.
        self._reserve = 0

    # ── Les garde-fous ───────────────────────────────────────────────────────

    def garde_fous(self) -> GardeFous:
        """Relu **à chaque appel** (US-91). Jamais mis en cache."""
        return GardeFous.depuis_json(self._fichiers.lire_agent())

    def regler(self, **champs: Any) -> GardeFous:
        """Pose ce que l'écran Réglages a changé, et l'annonce.

        Prend champ par champ plutôt qu'un objet entier : l'écran change un
        interrupteur à la fois, et réécrire tout l'objet depuis un formulaire
        partiel effacerait ce qu'un autre onglet vient de poser.
        """
        courant = self.garde_fous()
        connus = {c for c in courant.en_json()}
        inconnus = set(champs) - connus
        if inconnus:
            raise ErreurAtelier(
                "réglage inconnu : " + ", ".join(sorted(inconnus))
            )
        pose = GardeFous.depuis_json({**courant.en_json(), **champs})
        self._fichiers.ecrire_agent(pose.en_json())
        self._annoncer(pose)
        return pose

    def reserver(self, variations: int = 1) -> None:
        """Lève `PlafondAtteint`, ou retient la place. **Toujours suivie de `liberer`.**

        Retenir la place plutôt que compter : ce qui compte pour de bon, c'est la
        génération écrite sur le disque, et elle ne l'est pas encore. La réserve
        ne vit que le temps de l'écriture, et `liberer` la rend — que l'appel
        soit parti ou qu'il ait été refusé entre-temps.
        """
        cadre = self.garde_fous()
        if not cadre.plafond_actif:
            self._reserve += variations
            return
        faites = self._compter_faites()
        if faites + variations > cadre.plafond:
            raise PlafondAtteint(faites, cadre.plafond)
        self._reserve += variations

    def liberer(self, variations: int = 1) -> None:
        """La réserve est rendue : soit la génération est écrite et se compte
        toute seule, soit elle n'existera pas. Dans les deux cas l'écran est
        prévenu."""
        self._reserve = max(0, self._reserve - variations)
        self._annoncer()

    def _mesurer(self) -> tuple[int, float]:
        """Ce que l'agent a demandé et dépensé depuis l'ouverture.

        Lu sur les générations à chaque question. **Les emplacements, pas les
        générations** : le plafond compte des images, c'est-à-dire ce qui est
        facturé — quatre variations d'un même prompt coûtent quatre fois.

        Le coût inclut celui des appels **ratés** : « un appel qui échoue peut
        avoir coûté », et c'est justement celui qu'on cherche à expliquer quand
        on regarde ce compteur.
        """
        if self._generations is None:
            return self._reserve, 0.0
        faites = self._reserve
        depense = 0.0
        for generation in self._generations.recentes(500):
            if generation.provenance != AGENT or generation.cree_le < self._depuis:
                continue
            faites += len(generation.emplacements)
            depense += generation.cout_usd
        return faites, round(depense, 6)

    def _compter_faites(self) -> int:
        return self._mesurer()[0]

    def modele_impose(self, demande: str | None) -> tuple[str, dict[str, Any]]:
        """Le modèle et les options qui partiront, garde-fou appliqué.

        Quand le garde-fou est levé, ce que l'agent a nommé passe tel quel ; et
        s'il n'a rien nommé, c'est encore le modèle d'exploration qui sert — un
        agent qui ne choisit pas ne doit pas tomber sur le modèle le plus cher du
        catalogue par accident.

        **Un modèle imposé absent du catalogue cède au défaut du catalogue.**
        C'est la règle que l'écran suit déjà — « un défaut qui ne peut pas
        honorer la demande n'en est pas un » —, appliquée un cran plus loin :
        le catalogue bouge d'un jour à l'autre, et l'atelier tourne parfois sur
        son repli. Un garde-fou qui rendrait l'agent inutilisable dans ces
        deux cas-là protégerait de la dépense en supprimant le produit.
        """
        cadre = self.garde_fous()
        if cadre.modele_actif:
            return self._connu(cadre.modele), dict(cadre.options)
        if demande:
            return demande, {}
        return self._connu(cadre.modele), dict(cadre.options)

    def _connu(self, identifiant: str) -> str:
        """`identifiant` s'il est au catalogue, le défaut du catalogue sinon."""
        if self._catalogue is None:
            return identifiant
        if any(m.identifiant == identifiant for m in self._catalogue.etat.modeles):
            return identifiant
        return self._catalogue.defaut().modele or identifiant

    # ── Le compteur ──────────────────────────────────────────────────────────

    def consommation(self) -> dict[str, Any]:
        """Ce que l'écran affiche, discrètement (US-90)."""
        cadre = self.garde_fous()
        faites, depense = self._mesurer()
        return {
            "generations": faites,
            "depense_usd": depense,
            "plafond_actif": cadre.plafond_actif,
            "plafond": cadre.plafond,
            # Ce qui reste — calculé **ici et nulle part ailleurs**, pour que le
            # refus de l'agent et le compteur de l'écran ne puissent pas dire
            # deux chiffres différents.
            "reste": max(0, cadre.plafond - faites) if cadre.plafond_actif else None,
            "depuis": self._depuis,
        }

    def en_json(self) -> dict[str, Any]:
        """Les garde-fous et la consommation, servis ensemble.

        Ils se lisent ensemble : « 12 sur 20 » n'est un fait que si le plafond
        est là, et « relève-le » n'a de sens qu'à côté du chiffre.
        """
        return {
            "garde_fous": self.garde_fous().en_json(),
            "consommation": self.consommation(),
        }

    def _annoncer(self, cadre: GardeFous | None = None) -> None:
        self._diffusion.publier(
            "agent",
            {
                "garde_fous": (cadre or self.garde_fous()).en_json(),
                "consommation": self.consommation(),
            },
        )

    # ── Le dépôt dans le dossier du jeu ──────────────────────────────────────

    def deposer(self, octets: bytes, nom: str, dossier: str | None = None) -> str:
        """Pose un fichier dans le dossier du jeu, et rend son chemin absolu.

        Trois règles, et elles sont toutes les trois dans US-84 :

        - **Un dossier manquant est créé.** L'agent range son travail dans
          `assets/sprites/` qui n'existe pas encore ; le lui refuser
          l'obligerait à sortir de l'outil pour un `mkdir`.
        - **Un fichier de même nom n'est jamais écrasé.** C'est la seule règle
          des trois qui protège du travail déjà fait, et c'est pour elle que les
          deux autres sont écrites ici plutôt que laissées au système. On
          numérote — `epee.png`, `epee-2.png` —, on ne refuse pas : refuser
          arrêterait une boucle de génération sur un homonyme.
        - **Un dossier non inscriptible est refusé, avec le chemin fautif.**

        Rend le chemin **absolu** : c'est ce que l'agent va écrire dans le code
        du jeu, et un chemin relatif y serait relatif à un dossier de travail que
        l'atelier ne connaît pas.
        """
        cible = (dossier or self.garde_fous().dossier_jeu).strip()
        if not cible:
            raise DepotRefuse(
                "aucun dossier de jeu — nomme-le dans l'appel, ou pose-le une "
                "fois pour toutes dans l'atelier, écran Réglages, bloc "
                "« L'agent ».",
                ou_aller="reglages",
            )

        chemin = Path(cible).expanduser()
        try:
            chemin.mkdir(parents=True, exist_ok=True)
        except OSError as panne:
            # Le message du système est en anglais et nomme un code errno : il ne
            # franchit pas le service, exactement comme celui d'`httpx` ne
            # franchit pas le fournisseur. Ce qui compte est **quel dossier**.
            raise DepotRefuse(
                f"impossible de créer le dossier « {chemin} » — {_pourquoi(panne)}"
            ) from None
        if not chemin.is_dir():
            raise DepotRefuse(f"« {chemin} » existe et n'est pas un dossier")

        fichier = _libre(chemin, nom)
        try:
            fichier.write_bytes(octets)
        except OSError as panne:
            raise DepotRefuse(
                f"dossier non inscriptible « {chemin} » — {_pourquoi(panne)}"
            ) from None
        return str(fichier.resolve())


def _pourquoi(panne: OSError) -> str:
    """La panne du système, dite en français et sans code."""
    if isinstance(panne, PermissionError):
        return "les droits d'écriture manquent"
    if isinstance(panne, FileNotFoundError):
        return "le chemin n'existe pas et n'a pas pu être créé"
    if isinstance(panne, NotADirectoryError):
        return "un élément du chemin n'est pas un dossier"
    return "le système l'a refusé"


def _libre(dossier: Path, nom: str) -> Path:
    """Un chemin qui n'existe pas encore, numéroté s'il le faut.

    Même règle que les homonymes de l'archive de T6 : quatre variations d'un même
    prompt portent quatre fois le même label, donc un nom tiré du label se
    numérote. Ici l'enjeu est plus grave — de l'autre côté c'était une entrée de
    `zip` silencieusement perdue, ici ce serait un fichier du jeu écrasé.
    """
    base = Path(nom).stem or "asset"
    suffixe = Path(nom).suffix or ".png"
    candidat = dossier / f"{base}{suffixe}"
    numero = 2
    while candidat.exists():
        candidat = dossier / f"{base}-{numero}{suffixe}"
        numero += 1
    return candidat
