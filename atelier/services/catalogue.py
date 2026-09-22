# -*- coding: utf-8 -*-
"""Le catalogue des modèles — relu au démarrage, jamais écrit en dur.

Trois règles du produit se rencontrent ici.

**Le catalogue décide.** Les plafonds de références, les résolutions et les
paramètres viennent du fournisseur. SpriteCook code les siens en dur et plafonne
sous ses propres modèles : il déclare 14 références à `gpt-image-2` là où le
catalogue en donne 16, et 10 à `gemini-3-pro-image` là où il en donne 14.

**L'échec survient au moment où on génère, jamais au démarrage** (US-95). Ce
service ne lève donc jamais : sans réseau, il sert la dernière photo reçue,
**datée en clair** (US-93) ; sans photo du tout, il sert une liste vide avec sa
raison. L'atelier s'ouvre dans tous les cas.

**Et depuis F1, chaque fournisseur répond pour lui seul.** Ils sont relus
ensemble, chacun garde sa photo datée, et *couper la liaison de l'un grise ses
modèles avec sa raison sans en retirer aucun autre de la liste*. C'est ce qui
distingue une liste plurielle d'une liste concaténée : il n'y a plus un état du
catalogue, il y en a un par fournisseur, et le total n'est qu'une vue.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field, replace
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine import Modele, Reserve
from atelier.domaine.catalogue import modele_depuis_json, modele_en_json, nommer
from atelier.domaine.consommation import est_argent
from atelier.domaine.erreurs import ErreurAtelier, ModeleInconnu
from atelier.services.evenements import Diffusion
from atelier.services.fournisseurs import Fournisseurs, indisponible_de


# **Le seul modèle écrit en dur du produit, et c'est un choix, pas une capacité.**
#
# `docs/ARCHITECTURE.md` §4 bis : « Un seul modèle par défaut : `openai/gpt-image-2`
# en `quality: low` », établi par le second banc — le seul régulier sur dix sujets,
# à $0,0245 l'image avec guide. Ce n'est pas une liste de capacités : celles-là
# viennent toujours du catalogue. C'est le point de départ d'une séance, et il
# cessera d'être écrit ici en T4, quand l'univers portera un défaut par type
# d'asset. S'il disparaît du catalogue, le premier modèle utilisable prend sa
# place — jamais une erreur au démarrage.
#
# **Il porte son fournisseur depuis F1**, comme tout modèle du produit : deux
# fournisseurs peuvent proposer le même nom, et un défaut qui ne dirait pas
# lequel serait le premier endroit où l'ambiguïté rentrerait.
DEFAUT = nommer("OpenRouter", "openai/gpt-image-2")
OPTIONS_DEFAUT = {"quality": "low"}

# **Le moteur local principal passe devant** (22/09/2026, demande de l'auteur) :
# Qwen-Image 2.1 en mode « Très rapide », gratuit et sur la machine. Son
# identifiant porte la version du profil (`ComfyUI:qwen21-rapide@<empreinte>`),
# d'où la recherche par préfixe. Absent, grisé (ComfyUI trop ancien, fichier
# manquant) ou incapable de la demande en cours : on retombe sur `DEFAUT`.
DEFAUT_LOCAL = "qwen21-rapide@"


@dataclass(slots=True)
class Defaut:
    modele: str | None
    options: dict[str, str]


@dataclass(slots=True)
class EtatFournisseur:
    """Ce qu'un fournisseur a répondu, et quand.

    `raison` dit pourquoi on sert une photo de disque plutôt que sa réponse.
    `indisponible` dit tout autre chose : ce qui lui manque pour travailler —
    une clé, aujourd'hui. Les deux grisent ses modèles, et il fallait les
    séparer : une liaison coupée se répare en réessayant, une clé absente se
    répare aux réglages, et le grisé porte **son** geste.
    """

    nom: str
    modeles: list[Modele] = field(default_factory=list)
    recu_le: float = 0.0
    repli: bool = False
    raison: str | None = None
    indisponible: str | None = None

    def en_json(
        self, grise: str | None, reserve: "Reserve | None" = None
    ) -> dict[str, Any]:
        """`grise` vient de `ServiceCatalogue.grises()`, jamais de cet état-ci.

        **Ce qui manque se redemande à chaque affichage** — une clé déposée doit
        agir sans redémarrer —, alors que la photo, elle, date du dernier
        rafraîchissement. Les mélanger ici ferait afficher « aucune clé » une
        minute après qu'elle a été posée.

        **`reserve` obéit à la même règle et pour la même raison** (F2) : elle
        se recompte à chaque affichage, parce qu'une image qui vient de partir
        l'a entamée. `None` pour un fournisseur qui compte en argent — ce qu'il
        a coûté se lit dans la barre de tête, qui est faite pour ça.
        """
        return {
            "nom": self.nom,
            "modeles": len(self.modeles),
            "recu_le": self.recu_le,
            "repli": self.repli,
            "raison": self.raison,
            "indisponible": self.indisponible,
            "grise": grise,
            "reserve": reserve.en_json() if reserve is not None else None,
        }


@dataclass(slots=True)
class EtatCatalogue:
    """La vue d'ensemble. **Elle ne tient rien en propre** — tout se déduit.

    Les quatre lectures d'avant la V2.2 — `modeles`, `recu_le`, `repli`,
    `raison` — sont ici des propriétés, et elles disent la même chose qu'avant
    quand il n'y a qu'un fournisseur. C'est ce qui a permis à la liste de passer
    au pluriel sans qu'une route, un écran ou un essai n'ait à être réécrit.
    """

    fournisseurs: list[EtatFournisseur] = field(default_factory=list)

    @property
    def modeles(self) -> list[Modele]:
        """Tous les modèles, dans l'ordre des fournisseurs."""
        return [m for f in self.fournisseurs for m in f.modeles]

    @property
    def recu_le(self) -> float:
        """La plus récente des photos. Zéro quand aucune n'est jamais arrivée."""
        return max((f.recu_le for f in self.fournisseurs), default=0.0)

    @property
    def repli(self) -> bool:
        """Vrai dès qu'un seul sert du disque — la barre du haut le dit."""
        return any(f.repli for f in self.fournisseurs)

    @property
    def raison(self) -> str | None:
        """Pourquoi, en nommant le fournisseur quand ils sont plusieurs."""
        replis = [f for f in self.fournisseurs if f.repli and f.raison]
        if not replis:
            return None
        if len(self.fournisseurs) == 1:
            return replis[0].raison
        return " · ".join(f"{f.nom} : {f.raison}" for f in replis)

    @property
    def vide(self) -> bool:
        return not self.modeles

    def fournisseur(self, nom: str) -> EtatFournisseur | None:
        for etat in self.fournisseurs:
            if etat.nom == nom:
                return etat
        return None


class ServiceCatalogue:
    def __init__(
        self,
        fournisseurs: Fournisseurs,
        fichiers: Fichiers,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._fournisseurs = fournisseurs
        self._fichiers = fichiers
        self._diffusion = diffusion or Diffusion()
        self._etat = EtatCatalogue()
        self._index: dict[str, Modele] = {}
        # **Les noms d'avant la V2.2**, et eux seuls. Une génération enregistrée
        # quand il n'y avait qu'un fournisseur porte `openai/gpt-image-2` tout
        # court ; la relire ne doit ni lever ni deviner. Voir `modele()`.
        self._anciens: dict[str, str] = {}

    # ── Lecture ──────────────────────────────────────────────────────────────

    @property
    def etat(self) -> EtatCatalogue:
        return self._etat

    def grises(self) -> dict[str, str | None]:
        """Ce qui **manque** à chaque fournisseur pour travailler maintenant.

        Écrit ici plutôt que dans la route, parce que c'est la même phrase qui
        doit partir vers la liste des modèles, vers la barre qui paie et vers le
        refus du service de génération. Trois endroits, une source.

        **Manquer et être injoignable ne sont pas la même chose, et cette
        distinction-là est tout le sujet de cette méthode.** Elle a été tranchée
        en construisant F1, parce que deux règles écrites du dépôt s'y
        rencontraient :

        - *« Ce qui est indisponible est grisé avec sa raison, jamais proposé
          puis refusé »* (T1) ;
        - *« L'échec survient au moment où on génère, jamais au démarrage »*
          (US-95), que la V2.2 hérite **et ne rediscute pas**.

        Ce qui **manque** — une clé, aujourd'hui — est su d'avance et avec
        certitude : ça grise, et générer est refusé sans qu'un appel parte. Ce
        qui est **injoignable** n'est su que du catalogue : le fournisseur peut
        très bien accepter une génération alors que sa liste n'a pas répondu, et
        éteindre le bouton reviendrait à accueillir l'auteur par une erreur que
        rien n'a mesurée. Ses modèles restent donc choisissables, servis depuis
        leur photo datée, et l'écran dit de quand elle est — **fournisseur par
        fournisseur**, ce qui est très exactement ce que F1 ajoute.

        **Ce qui manque se redemande, jamais ne se met en cache.** Une clé
        déposée sert au premier appel suivant *sans redémarrer* — règle de T1 —,
        donc la demander à l'adaptateur est le seul moyen de ne pas servir une
        réponse d'il y a dix minutes.

        **Une lecture par fournisseur, jamais une par modèle** : un catalogue de
        cinquante modèles relirait sinon le fichier des clés cinquante fois par
        affichage de la liste.
        """
        return {
            getattr(f, "nom", "inconnu"): indisponible_de(f)
            for f in self._fournisseurs.tous()
        }

    def grise(self, modele: Modele) -> str | None:
        """La même chose, pour un modèle seul — le chemin du refus de génération."""
        return modele.indisponible or self.grises().get(modele.fournisseur)

    def unite_de(self, identifiant: str) -> str | None:
        """Dans quelle unité le fournisseur de ce modèle-là compte (F2).

        `None` quand le modèle est inconnu du catalogue ou que son fournisseur
        compte en argent — les deux mènent au même repli chez l'appelant, et
        c'est l'argent, qui était la seule unité du produit avant la V2.2.

        **Le fournisseur fait foi, pas l'historique.** Un modèle gratuit qu'on
        n'a jamais appelé n'a rien laissé dans l'index ; si l'unité se lisait sur
        ce qui est parti, l'écran de confirmation annoncerait un prix en dollars
        pour un appel qui n'en coûte aucun.
        """
        try:
            modele = self.modele(identifiant)
        except ErreurAtelier:
            return None
        compte = self._fournisseurs.compte(modele.fournisseur)
        return compte.unite if compte is not None else None

    def gratuits(self) -> list[Modele]:
        """Les modèles dont le fournisseur ne compte pas en argent (F6).

        **C'est la liste dans laquelle le modèle d'exploration de l'agent se
        choisit**, et elle vient du fournisseur, jamais d'un tarif à zéro : un
        modèle payant qu'on n'a jamais appelé n'a rien laissé dans l'index des
        prix, et un « ça n'a rien coûté jusqu'ici » l'y aurait fait entrer.

        Les grisés en sont exclus : proposer d'imposer à l'agent un modèle dont
        le fournisseur ne peut pas travailler serait proposer un garde-fou qui
        refuse tout. La liste peut donc être **vide**, et l'appelant doit le
        prévoir — c'est un état légitime, celui d'un atelier composé sans
        fournisseur gratuit.
        """
        grises = self.grises()
        return [
            modele
            for modele in self._etat.modeles
            if grises.get(modele.fournisseur) is None
            and not est_argent(self.unite_de(modele.identifiant))
        ]

    def defaut(self, demande=None) -> Defaut:
        """Par quoi commencer une séance — le modèle du banc, ou un repli.

        Un défaut qui ne peut pas honorer la demande en cours n'en est pas un :
        on prend alors le premier modèle que le catalogue déclare capable.

        **Un défaut dont le fournisseur est grisé n'en est pas un non plus**, et
        c'est ce qui rend vraie la promesse de F1 : sur une installation neuve,
        sans aucune clé, le défaut glisse tout seul vers le fournisseur qui n'en
        demande pas, et une image arrive.
        """
        grises = self.grises()
        for modele in self._etat.modeles:
            if modele.locale and (modele.chez_lui or "").startswith(DEFAUT_LOCAL) \
                    and modele.indisponible is None and _utilisable(modele, demande, grises):
                return Defaut(modele.identifiant, {})
        prefere = self._index.get(DEFAUT)
        if prefere is not None and _utilisable(prefere, demande, grises):
            return Defaut(prefere.identifiant, dict(OPTIONS_DEFAUT))

        for modele in self._etat.modeles:
            if _utilisable(modele, demande, grises):
                return Defaut(modele.identifiant, {})
        return Defaut(None, {})

    def modele(self, identifiant: str) -> Modele:
        modele = self._index.get(identifiant)
        if modele is not None:
            return modele
        # **Un nom sans fournisseur date d'avant la V2.2** — voir `nommer`. Il
        # se rattrape ici, et seulement ici : c'est le seul endroit du produit
        # où un nom incomplet est encore accepté, et il ne l'est que parce
        # qu'aucun n'était ambigu à l'époque où il a été écrit.
        complet = self._anciens.get(identifiant)
        if complet is not None and complet in self._index:
            return self._index[complet]
        raise ModeleInconnu(identifiant)

    # ── Rafraîchissement ─────────────────────────────────────────────────────

    async def rafraichir(self) -> EtatCatalogue:
        """Appelé au démarrage, et à la demande. Ne lève jamais.

        **Les fournisseurs sont relus ensemble, pas l'un après l'autre.** Un
        fournisseur qui met trente secondes à répondre ne doit pas retarder
        l'ouverture de l'atelier pour les autres — et il y en aura d'autres.
        """
        fournisseurs = self._fournisseurs.tous()
        photos = await asyncio.gather(
            *(self._lire(f) for f in fournisseurs), return_exceptions=False
        )

        self._etat = EtatCatalogue(fournisseurs=list(photos))
        self._index = {m.identifiant: m for m in self._etat.modeles}
        self._anciens = _sans_ambiguite(self._etat.modeles)
        self._ecrire()
        # Le repli — et surtout la sortie du repli — se voit à l'écran sans
        # qu'on ait à recharger la page : c'est le même tuyau que l'avancement.
        self._diffusion.publier("catalogue", self.en_json())
        return self._etat

    async def _lire(self, fournisseur) -> EtatFournisseur:
        """La photo d'un fournisseur. **Ne lève jamais** — c'est tout son métier."""
        nom = getattr(fournisseur, "nom", "inconnu")
        indisponible = indisponible_de(fournisseur)
        try:
            modeles = await fournisseur.catalogue()
        except ErreurAtelier as erreur:
            return self._depuis_disque(nom, erreur.raison, indisponible)
        except Exception as erreur:  # noqa: BLE001 — un démarrage ne casse pas
            return self._depuis_disque(
                nom, f"catalogue illisible — {erreur}", indisponible
            )
        return EtatFournisseur(
            nom=nom,
            modeles=modeles,
            recu_le=time.time(),
            indisponible=indisponible,
        )

    def en_json(self) -> dict[str, Any]:
        """L'état du catalogue tel que la barre de tête l'affiche.

        Écrit ici, pas dans les routes : la même phrase part par le flux
        d'événements et par `GET /api/status`, et elles ne peuvent pas diverger.

        Les quatre clés d'avant la V2.2 n'ont pas bougé ; `fournisseurs` s'ajoute
        à côté d'elles, et c'est ce qui permet à l'écran de dire *lequel* est
        coupé sans que rien de ce qui le lisait n'ait à changer.
        """
        grises = self.grises()
        return {
            "modeles": len(self._etat.modeles),
            "recu_le": self._etat.recu_le,
            "repli": self._etat.repli,
            "raison": self._etat.raison,
            "fournisseurs": [
                f.en_json(grises.get(f.nom)) for f in self._etat.fournisseurs
            ],
        }

    # ── La photo sur le disque ───────────────────────────────────────────────
    #
    # **Un fichier, une entrée par fournisseur**, plutôt qu'un fichier par
    # fournisseur : la photo est déjà relue d'un bloc au démarrage, et un
    # dossier de fichiers datés aurait demandé une règle de ménage pour un
    # fournisseur retiré. La forme d'avant la V2.2 — les modèles à la racine —
    # se relit telle quelle, et c'est OpenRouter : c'était le seul.

    def _ecrire(self) -> None:
        """N'écrase jamais une photo par du vide.

        Un fournisseur qui n'a pas répondu sert déjà sa photo de disque ; la
        réécrire est sans effet, mais un fournisseur qui répondrait *une liste
        vide* effacerait la sienne. La photo de la veille vaut mieux que rien :
        c'est très exactement ce à quoi elle sert.
        """
        contenu: dict[str, Any] = {"fournisseurs": {}}
        ancien = self._fichiers.lire_catalogue() or {}
        anciennes = ancien.get("fournisseurs")
        if isinstance(anciennes, dict):
            contenu["fournisseurs"] = dict(anciennes)
        elif ancien.get("modeles"):
            contenu["fournisseurs"]["OpenRouter"] = {
                "recu_le": ancien.get("recu_le", 0.0),
                "modeles": ancien.get("modeles", []),
            }

        for etat in self._etat.fournisseurs:
            if etat.repli or not etat.modeles:
                continue
            contenu["fournisseurs"][etat.nom] = {
                "recu_le": etat.recu_le,
                "modeles": [modele_en_json(m) for m in etat.modeles],
            }
        self._fichiers.ecrire_catalogue(contenu)

    def _depuis_disque(
        self, nom: str, raison: str, indisponible: str | None
    ) -> EtatFournisseur:
        photo = self._photo(nom)
        if photo is None:
            return EtatFournisseur(
                nom=nom, raison=raison, repli=True, indisponible=indisponible
            )
        modeles = [modele_depuis_json(m) for m in photo.get("modeles", [])]
        return EtatFournisseur(
            nom=nom,
            # **Une photo d'avant la V2.2 ne nomme pas son fournisseur**, et il
            # n'y a rien à deviner : elle ne pouvait venir que d'OpenRouter, qui
            # est le nom sous lequel on vient de la chercher. On le pose donc en
            # la relisant, plutôt que de garder des modèles anonymes qu'aucun
            # grisé ne saurait rattacher à personne.
            modeles=[_rattacher(m, nom) for m in modeles],
            recu_le=photo.get("recu_le", 0.0),
            repli=True,
            raison=raison,
            indisponible=indisponible,
        )

    def _photo(self, nom: str) -> dict[str, Any] | None:
        contenu = self._fichiers.lire_catalogue()
        if not contenu:
            return None
        fournisseurs = contenu.get("fournisseurs")
        if isinstance(fournisseurs, dict):
            photo = fournisseurs.get(nom)
            return photo if isinstance(photo, dict) else None
        # La forme d'avant la V2.2 : les modèles à la racine, et un seul
        # fournisseur au monde.
        if contenu.get("modeles") and contenu.get("fournisseur", nom) == nom:
            return contenu
        return None


def _sans_ambiguite(modeles: list[Modele]) -> dict[str, str]:
    """Les noms courts qu'**un seul** fournisseur propose, et eux seuls.

    C'est la table qui rattrape les noms d'avant la V2.2. Un nom que deux
    fournisseurs proposent n'y entre pas : le rattraper reviendrait à choisir
    pour l'auteur entre un modèle payant et un gratuit qui portent le même nom,
    et ce serait le seul endroit du produit où un modèle serait décidé par un
    tirage au sort. Un tel nom lève `ModeleInconnu` — ce qui est vrai : le
    catalogue déclare deux choses de ce nom-là, donc il n'en déclare aucune.

    En pratique la table est complète : les seuls noms courts qui circulent sont
    ceux d'OpenRouter, écrits quand il était seul, et aucun autre fournisseur ne
    reprend `openai/gpt-image-2`.
    """
    comptes: dict[str, int] = {}
    for modele in modeles:
        if modele.chez_lui:
            comptes[modele.chez_lui] = comptes.get(modele.chez_lui, 0) + 1
    return {
        m.chez_lui: m.identifiant
        for m in modeles
        if m.chez_lui and comptes[m.chez_lui] == 1
    }


def _utilisable(modele: Modele, demande, grises: dict[str, str | None]) -> bool:
    if grises.get(modele.fournisseur) is not None:
        return False
    return demande is None or modele.refus(demande) is None


def _rattacher(modele: Modele, nom: str) -> Modele:
    """Un modèle relu d'une photo anonyme reçoit le nom sous lequel on l'a cherché."""
    if modele.fournisseur:
        return modele
    return replace(
        modele,
        fournisseur=nom,
        chez_lui=modele.chez_lui or modele.identifiant,
        identifiant=nommer(nom, modele.chez_lui or modele.identifiant),
    )
