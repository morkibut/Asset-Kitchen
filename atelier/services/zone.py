# -*- coding: utf-8 -*-
"""Repeindre une zone (PX3, `docs/PLAN-idees-pixellab.md`) — le geste de PixelLab.

Sur une image, on peint une zone, on écrit ce qu'on veut y voir, et un moteur
local repeint **la zone seulement**. Ce qui revient devient un calque qui ne
porte que les pixels changés dans la zone, ramenés à la grille et aux couleurs
de l'image. On le garde, on le jette, ou on recommence sur une autre graine.

**Ce que ce service décide, et rien d'autre** : quel modèle sait repeindre une
zone (le catalogue le dit, jamais une liste en dur), ce qui part (le texte de
l'auteur mot pour mot, l'image d'en dessous, la zone en noir et blanc), et ce que
l'image revenue recevra à sa naissance (`zone.json` à côté de la génération,
lu par `ServiceAssets.recette_de_naissance`). Le moteur, la file locale, la
dépense à zéro et l'entrée en bibliothèque sont ceux de toute génération.

**Le calque est un calque comme les autres** : sa `Difference` nomme l'image
d'en dessous, garde la zone peinte et le texte, et porte la main de C4 comme un
calque d'équipement ; la génération garde la graine, la force et le modèle. Il
se referme et se rouvre (`AGENTS.md`, point 8septies).
"""

from __future__ import annotations

import io
import json
import time
import uuid
from typing import Any, Sequence

import numpy as np
from PIL import Image

from atelier.domaine import Reinjection
from atelier.domaine.asset import identifiant_de
from atelier.domaine.catalogue import Modele
from atelier.domaine.demande import Demande
from atelier.domaine.envoi import Tri
from atelier.domaine.erreurs import DemandeRefusee, ErreurAtelier
from atelier.domaine.generation import AGENT, ASSET, EDITION, Generation
from atelier.domaine.recette import (
    COULEURS_NEUVES,
    COULEURS_NEUVES_MAX,
    RAYON_MAX,
    Difference,
    Trait,
    traits_depuis_json,
)
from atelier.domaine.workflow import GRAINE_MAX, WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, createur_de, de_modele, sait_repeindre, style
from atelier.fournisseur.styles_locaux import PARAMETRE_FORCE_ZONE
from atelier.image.zone import (
    emplacement_propose,
    fond_de_la_toile,
    image_entiere,
    masque_de_zone,
    masque_en_png,
    traits_depuis_masque,
    traits_depuis_rectangles,
)
from atelier.services.assets import FICHIER_ZONE

#: Ce que devient un résultat de « Repeindre » (PX9). **Dérivé, jamais rangé** :
#: une pièce qui porte un équipement en est un ; sinon elle attend qu'on
#: décide — y compris celles faites avant ce jour, relues telles quelles.
A_DECIDER = "a_decider"
EQUIPEMENT = "equipement"
VERSION = "version"
JETER = "jeter"

#: La retouche que l'écran propose d'installer (PX2) — le style et sa retouche
#: ensemble, depuis MO1. Nommée ici pour une seule chose : dire à l'auteur **quoi
#: installer** quand aucun style installé ne sait repeindre. Le modèle, lui, se
#: choisit parmi les styles installés (`_choix`).
OUTIL_DE_ZONE = "sdxl-retouche-zone"

#: La résolution à laquelle le moteur travaille — celle du banc PX1 (1 024).
RESOLUTION_DE_TRAVAIL = "1024"

#: La force par défaut quand le profil ne la dit pas (le banc PX1 : 0,9).
FORCE_PAR_DEFAUT = 0.9

#: La nature du travail durable d'une zone demandée par l'agent.
NATURE = "zone"

TEXTE_VIDE = "écrivez ce qu'il faut mettre dans la zone"
ZONE_VIDE = "peignez d'abord la zone à repeindre"


def _repeinte(asset) -> Difference | None:
    """La différence d'un calque repeint, ou rien."""
    difference = asset.recette.difference
    return difference if difference is not None and difference.repeinte else None


class ServiceZone:
    def __init__(self, atelier: Any) -> None:
        self._atelier = atelier
        # **Une zone demandée par l'agent est un travail durable**, borné par le
        # cadre de l'agent comme toute image locale de l'agent (RP2) : le crochet
        # du fournisseur local refuse une génération de l'agent qu'aucun travail
        # ne nomme. Même mécanisme que les matières (TU10).
        atelier.travaux.inscrire_executant(NATURE, self._executer_agent)

    # ── Le modèle ───────────────────────────────────────────────────────────
    #
    # **MO1 : les mêmes choix que pour créer.** Un choix, c'est un style installé
    # dont le moteur sait repeindre — sous le nom qu'il porte dans « Créer »
    # (« Qwen-Image 2.1 · Très rapide »), avec ses propres réglages. Il se désigne
    # par l'identifiant de sa retouche quand elle est déjà installée, par celui du
    # style sinon : sa retouche s'écrit alors au premier lancement, tirée du
    # profil de création (`ServiceStylesLocaux.repeint`). Un modèle importé à la
    # main qui relie un masque reste un choix à lui seul.

    def sait_repeindre_zone(self, modele: Any) -> bool:
        """La capacité « sait repeindre une zone » d'un modèle, **la même règle
        que `_choix`** ci-dessous — pour un appelant qui n'a pas le droit
        d'importer `atelier.fournisseur` lui-même (MO7 : le MCP, qui ne connaît
        que les services). `modele.masque` seul ne marque que les jumeaux de
        zone déjà installés (les anciens `OUTILS` de PX7), pas tout style qui
        sait repeindre depuis que MO1 l'a posé en capacité du moteur."""
        if modele.locale:
            entree = de_modele(modele.identifiant)
            if entree is not None:
                return sait_repeindre(createur_de(entree))
        return modele.masque

    def _choix(self, noeuds: Sequence[str] | None = None) -> list[dict[str, Any]]:
        """Les choix de « Repeindre », dans l'ordre du catalogue — grisés ou non.
        `noeuds` (ce que ComfyUI déclare) grise un style dont la retouche n'est
        pas encore écrite quand il manque un nœud de la zone : jamais proposé
        puis refusé."""
        choix: list[dict[str, Any]] = []
        par_style: dict[str, dict[str, Any]] = {}
        for m in self._atelier.catalogue.etat.modeles:
            entree = de_modele(m.identifiant) if m.locale else None
            if entree is None:
                if m.masque:
                    choix.append({"identifiant": m.identifiant, "identifiants": [m.identifiant], "nom": m.nom,
                                  "moteur": None, "famille": m.famille, "style": None,
                                  "_modele": m, "_repeint": True, "_vitesse": None})
                continue
            createur = createur_de(entree)
            if not sait_repeindre(createur):
                continue
            est_zone = entree is not createur
            if est_zone and not m.masque:
                continue
            ligne = par_style.get(createur["identifiant"])
            if ligne is None:
                famille = FAMILLES[createur["famille"]]
                ligne = {"identifiant": m.identifiant, "identifiants": [], "nom": f"{famille['nom']} · {createur['nom']}",
                         "moteur": famille["nom"], "famille": createur["famille"], "style": createur["identifiant"],
                         "_modele": m, "_repeint": est_zone,
                         "_vitesse": createur.get("vitesse") or famille["vitesse"]}
                par_style[createur["identifiant"]] = ligne
                choix.append(ligne)
            elif est_zone and not ligne["_repeint"]:
                ligne.update(identifiant=m.identifiant, _modele=m, _repeint=True)
            # Tout ce qui désigne ce choix : l'écran qui avait choisi le style
            # le retrouve après son premier repeint, quand sa retouche vient de
            # s'écrire et qu'il se désigne désormais par elle.
            ligne["identifiants"].append(m.identifiant)
        for ligne in choix:
            raison = self._raison_du_modele(ligne["_modele"])
            if raison is None and not ligne["_repeint"] and noeuds is not None:
                manque = [n for n in FAMILLES[ligne["famille"]]["repeint"] if n not in noeuds]
                if manque:
                    raison = "il manque, dans ComfyUI : " + " · ".join("le nœud " + n for n in manque)
            ligne["raison"] = raison
        return choix

    @staticmethod
    def _defaut(choix: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Le choix par défaut : **le catalogue décide** — d'abord un style prêt
        qui a déjà repeint (sa retouche est installée), puis tout style prêt,
        sinon le premier (pour dire sa raison), sinon rien. PX7 : ce n'est que le
        repli — l'auteur ou l'agent peut nommer un autre choix."""
        prets = [c for c in choix if not c.get("raison", None)]
        return next((c for c in prets if c["_repeint"]), None) or (prets or choix or [None])[0]

    def _choix_de(self, identifiant: str | None, choix: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Le choix qu'un identifiant désigne — le sien, ou **celui de son
        style** : une ancienne version, une retouche de PX7 (« sdxl-retouche-zone »),
        le style de création. Jamais un autre style : demander un modèle précis
        et en recevoir un autre serait pire qu'un refus."""
        if not identifiant:
            return None
        exact = next((c for c in choix if identifiant in c["identifiants"]), None)
        if exact is not None:
            return exact
        entree = de_modele(identifiant)
        if entree is None:
            return None
        style_ = createur_de(entree)["identifiant"]
        return next((c for c in choix if c["style"] == style_), None)

    def modele(self) -> Modele | None:
        """Le modèle du choix par défaut (voir `_defaut`)."""
        defaut = self._defaut(self._choix())
        return None if defaut is None else defaut["_modele"]

    async def _modele_pour_repeindre(self, identifiant: str | None) -> Modele:
        """Le modèle qui repeindra vraiment — **une retouche**, jamais un style de
        création — pour l'identifiant qu'on a choisi : celui d'une retouche
        installée, d'un style installé pour créer (sa retouche s'écrit alors),
        ou d'un ancien repeint (le même style, dans sa version d'aujourd'hui).
        Refusé s'il ne désigne aucun style qui sache repeindre."""
        choix = self._choix()
        if identifiant is None:
            ligne = self._defaut(choix)
            if ligne is None:
                raise DemandeRefusee(
                    "aucun modèle de l'atelier ne sait repeindre une zone — "
                    f"installez l'outil « {OUTIL_DE_ZONE} »"
                )
        else:
            ligne = self._choix_de(identifiant, choix)
            if ligne is None:
                raise DemandeRefusee(f"« {identifiant} » ne sait pas repeindre une zone, ou n'est pas installé")
        if ligne["_repeint"]:
            return ligne["_modele"]
        raison = self._raison_du_modele(ligne["_modele"])
        if raison:
            raise DemandeRefusee(f"{ligne['nom']} : {raison}")
        styles_locaux = self._atelier.styles_locaux
        try:
            # Le profil que ce choix désigne : la version du style installée pour
            # créer — même quand on est arrivé ici par un ancien repeint.
            creation = self._atelier.profils_workflow.de_modele(ligne["identifiant"])
            installe = await styles_locaux.repeint(creation)
        except WorkflowRefuse as refus:
            raise DemandeRefusee(f"{ligne['nom']} : {refus.raison if hasattr(refus, 'raison') else refus}") from refus
        catalogue = self._atelier.catalogue
        try:
            return catalogue.modele(installe["modele"])
        except ErreurAtelier:
            await catalogue.rafraichir()
            return catalogue.modele(installe["modele"])

    def _raison_du_modele(self, modele: Modele) -> str | None:
        if modele.indisponible:
            return modele.indisponible
        return self._atelier.catalogue.grise(modele)

    def _outil_de_repli(self, raison: str) -> dict[str, Any]:
        entree = style(OUTIL_DE_ZONE) or {}
        famille = FAMILLES.get(entree.get("famille", ""), {})
        return {"identifiant": OUTIL_DE_ZONE, "nom": entree.get("nom", OUTIL_DE_ZONE), "famille": entree.get("famille"),
                "moteur": famille.get("nom"), "pret": False, "manque": [raison], "modele": None,
                "vitesse": entree.get("vitesse") or famille.get("vitesse")}

    def _force_du_profil(self, modele: Modele) -> dict[str, float]:
        if not modele.masque:
            # Un style dont la retouche n'est pas encore écrite : les bornes
            # qu'elle aura, pas celles du style (« partir de l'image », 0 à 1).
            force = PARAMETRE_FORCE_ZONE["force"]
            return {"minimum": float(force["minimum"]), "maximum": float(force["maximum"]),
                    "defaut": float(force["defaut"])}
        option = modele.options.get("force")
        bornes = {
            "minimum": float(option.minimum) if option and option.minimum is not None else 0.5,
            "maximum": float(option.maximum) if option and option.maximum is not None else 1.0,
            "defaut": FORCE_PAR_DEFAUT,
        }
        try:
            profil = self._atelier.profils_workflow.de_modele(modele.identifiant)
            bornes["defaut"] = float(profil["parametres"]["force"]["defaut"])
        except (WorkflowRefuse, KeyError, TypeError, ValueError, AttributeError):
            pass
        return bornes

    # ── Ce que l'écran lit ──────────────────────────────────────────────────

    async def etat(self, identifiant: str) -> dict[str, Any]:
        """Tout ce que la fabrique « Repeindre » montre en s'ouvrant : le
        modèle, **ou pourquoi il n'y en a pas et comment l'installer**, le temps
        annoncé, les bornes de la force, et les calques déjà repeints sur cette
        image. Rien n'est écrit."""
        base = self._atelier.assets._trouver(identifiant)
        styles_locaux = self._atelier.styles_locaux
        try:
            inventaire_ = await styles_locaux.inventaire()
        except WorkflowRefuse as refus:
            inventaire_ = None
            injoignable = refus.raison if hasattr(refus, "raison") else str(refus)
        # PX7 : une retouche de référence par moteur, prête ou non, et ce qui
        # lui manque — l'écran propose d'installer celle d'un moteur dont aucun
        # style n'est encore installé.
        outils = styles_locaux.lignes_outils(inventaire_) if inventaire_ is not None else [self._outil_de_repli(injoignable)]
        outil = next((o for o in outils if o["identifiant"] == OUTIL_DE_ZONE), outils[0])
        choix = self._choix(inventaire_["noeuds"] if inventaire_ is not None else None)
        defaut = self._defaut(choix)
        raison: str | None
        if defaut is None:
            nom_outil = f"{outil['moteur']} · {outil['nom']}" if outil.get("moteur") else outil["nom"]
            raison = f"aucun modèle de l'atelier ne sait repeindre une zone — installez l'outil « {nom_outil} »"
        else:
            raison = defaut["raison"]
        return {
            "image": base.identifiant,
            "modele": None if defaut is None else {"identifiant": defaut["identifiant"], "nom": defaut["nom"]},
            "raison": raison,
            "outil": outil,
            "outils": outils,
            # **Tous** les choix, grisés ou non — c'est parmi eux que l'écran et
            # l'agent choisissent. `modele` ci-dessus reste le défaut, celui
            # qu'on garde sans rien choisir. Chacun porte son propre temps : le
            # bouton suit le choix.
            "modeles": [self._choix_en_json(c) for c in choix],
            "temps": self._temps_du_choix(defaut),
            "force": self._force_du_profil(defaut["_modele"]) if defaut is not None else None,
            "couleurs": {"defaut": COULEURS_NEUVES, "maximum": COULEURS_NEUVES_MAX},
            "calques": self.calques(identifiant, choix),
            # PX9 : **à qui l'image appartient**, pour que les trois décisions
            # disent ce qu'elles font — « une nouvelle version de repos »,
            # « un équipement de Mara » — et se grisent avec leur raison.
            **self._contexte(base),
        }

    # ── PX9 : ce que devient le résultat ────────────────────────────────────

    def _contexte(self, base) -> dict[str, Any]:
        """Le sujet, la pose et la direction de l'image d'en dessous, les
        emplacements du jeu, et pourquoi on ne pourrait pas en faire un
        équipement — **une raison, jamais un bouton qui échoue**."""
        production = self._atelier.production
        sujet = pose = None
        raison_equipement: str | None = None
        emplacements: list[str] = []
        if base.projet:
            try:
                emplacements = [e.nom for e in self._atelier.equipement.emplacements(base.projet)]
            except ErreurAtelier:
                emplacements = []
        if base.projet and base.personnage:
            try:
                qui = production.personnage(base.projet, base.personnage)
                sujet = {"identifiant": qui.identifiant, "nom": qui.nom,
                         "porte": bool(production.porte_de_lequipement(base.projet, qui))}
                nom_de_pose = {p.identifiant: p.nom for p in production.plan_de(base.projet, qui)}
                if base.pose:
                    pose = {"identifiant": base.pose, "nom": nom_de_pose.get(base.pose, base.pose)}
            except ErreurAtelier:
                sujet = None
        if sujet is None:
            raison_equipement = "l'image n'appartient à aucun sujet du jeu : range-la d'abord dans une pose"
        elif not sujet["porte"]:
            raison_equipement = f"« {sujet['nom']} » ne porte pas d'équipement"
        elif pose is None:
            raison_equipement = "l'image n'est rangée dans aucune pose : range-la d'abord"
        elif base.piece:
            raison_equipement = "l'image est déjà un équipement : repeins la pose elle-même"
        return {
            "sujet": sujet,
            "pose": pose,
            "direction": base.direction,
            "emplacements": emplacements,
            "raison_equipement": raison_equipement,
        }

    def _resultat_a_decider(self, identifiant: str):
        """Le résultat d'une zone et sa différence — refusé s'il n'en est pas un."""
        asset = self._atelier.assets.lire(identifiant)
        if asset is None or asset.supprime_le:
            if self._atelier.base.lire_asset(identifiant) is not None:
                raise DemandeRefusee("ce résultat a été jeté")
            asset = self._atelier.assets._trouver(identifiant)
        repeint = _repeinte(asset)
        if repeint is None:
            raise DemandeRefusee("cette image n'est pas le résultat d'une zone repeinte")
        return asset, repeint

    def en_faire_une_version(self, identifiant: str) -> dict[str, Any]:
        """**« En faire une nouvelle version de cette pose »** — l'image
        d'origine avec la zone repeinte devient une image neuve, rangée dans la
        même pose et la même direction du même sujet. L'image d'origine ne
        bouge pas ; le résultat, dont l'image neuve porte les pixels, quitte la
        bibliothèque (il se restaure pendant le sursis ordinaire).

        Le patron d'« Enregistrer sous » (`RP20`) : la même génération, le rang
        libre suivant, une recette vide — le brut *est* le rendu —, rien de
        payé. Le parent est l'image d'origine : c'est d'elle que la version
        dérive."""
        from atelier.domaine.asset import Asset
        from atelier.domaine.recette import Recette
        from atelier.image import extension, mesurer
        from atelier.image.calques_cibles import png, rgba
        from atelier.services.decoupe import RANG_DECOUPE
        from atelier.services.rangs import rang_libre

        assets = self._atelier.assets
        asset, repeint = self._resultat_a_decider(identifiant)
        if asset.piece:
            raise DemandeRefusee("ce résultat est déjà un équipement")
        base = assets._trouver(repeint.base)
        corps = assets._corps_repeint(repeint)
        if corps is None:
            raise DemandeRefusee("l'image d'origine n'est plus là")
        calque = rgba(assets.octets(asset)[0])
        if calque.shape[:2] != corps.shape[:2]:
            raise DemandeRefusee("l'image d'origine a changé de taille depuis : repeins-la de nouveau")
        octets = png(image_entiere(corps, calque))
        mesure = mesurer(octets)
        rang = rang_libre(self._atelier.base, asset.generation, plancher=RANG_DECOUPE)
        chemin = self._atelier.fichiers.ecrire_brut(asset.generation, rang, octets, extension(mesure.type_media))
        neuf = assets.accueillir(Asset(
            identifiant=identifiant_de(asset.generation, rang), generation=asset.generation, rang=rang,
            brut=chemin, largeur=mesure.largeur, hauteur=mesure.hauteur, type_media=mesure.type_media,
            label=(f"{base.label} · {repeint.texte}")[:60], recette=Recette(),
            consomme=0.0, unite=asset.unite, provenance=asset.provenance, modele=asset.modele,
            projet=base.projet, personnage=base.personnage, pose=base.pose, direction=base.direction,
            parent=base.identifiant, cree_le=time.time(),
        ))
        self._atelier.bibliotheque.supprimer([asset.identifiant])
        return {"decision": VERSION, "image": base.identifiant, "asset": neuf.en_json()}

    def en_faire_un_equipement(self, identifiant: str, nom: str, emplacement: str = "") -> dict[str, Any]:
        """**« En faire un équipement de <sujet> »** — le chemin de tout
        équipement : la pièce se crée (ou se retrouve, par son nom) dans le
        jeu, avec son emplacement et l'emploi « porté par ce sujet », et le
        résultat devient **son calque sur cette pose** — rangé dans la matrice
        (`piece`, `pose`, `direction`) et retenu sur la cible de l'emploi
        (`ServiceCalquesCibles.poser_un_calque_qui_suit`), donc lu par la fiche
        de l'équipement, l'ordre devant/derrière, la tenue et l'export."""
        from atelier.domaine.equipement import emploi_porte

        assets = self._atelier.assets
        asset, repeint = self._resultat_a_decider(identifiant)
        base = assets._trouver(repeint.base)
        contexte = self._contexte(base)
        if contexte["raison_equipement"]:
            raise DemandeRefusee(contexte["raison_equipement"])
        propre = (nom or "").strip()
        if not propre:
            raise DemandeRefusee("donne un nom à l'équipement")
        projet, porteur = base.projet, base.personnage
        equipement = self._atelier.equipement
        emploi = emploi_porte(porteur)
        objet = self._atelier.base.lire_projet(projet)
        piece = next((p for p in objet.pieces if p.nom.casefold() == propre.casefold()), None)
        if piece is None:
            piece = equipement.ajouter_piece(projet, propre, emplacement=(emplacement or "").strip()
                                             or self.emplacement_propose(identifiant), porteur=porteur)
        elif not any(e.identifiant == emploi.identifiant for e in equipement.emplois(projet, piece.identifiant)):
            equipement.ajouter_emploi(projet, piece.identifiant, porteur=porteur)
        if asset.piece and asset.piece != piece.identifiant:
            raise DemandeRefusee("ce résultat est déjà un autre équipement")
        asset.piece = piece.identifiant
        asset.personnage, asset.pose, asset.direction = porteur, base.pose, base.direction
        assets.sauver(asset)
        variante = self._atelier.calques_cibles.poser_un_calque_qui_suit(
            projet, piece.identifiant, emploi.identifiant,
            {"nature": "image", "resultat": base.identifiant}, asset.identifiant,
        )
        return {
            "decision": EQUIPEMENT,
            "image": base.identifiant,
            "equipement": {"identifiant": piece.identifiant, "nom": piece.nom, "emploi": emploi.identifiant},
            "variante": variante["identifiant"],
            "calque": self.fiche(asset.identifiant),
        }

    def jeter(self, identifiant: str) -> dict[str, Any]:
        """**« Jeter »** — le résultat quitte la bibliothèque, comme toute
        suppression (le sursis ordinaire pour se raviser)."""
        asset, _ = self._resultat_a_decider(identifiant)
        if asset.piece:
            raise DemandeRefusee("ce résultat est un équipement : retire-le depuis l'équipement")
        return {"decision": JETER, **self._atelier.bibliotheque.supprimer([asset.identifiant])}

    def decider(self, identifiant: str, decision: str, *, nom: str = "", emplacement: str = "") -> dict[str, Any]:
        """Les trois décisions par un seul nom — pour la route et pour l'agent."""
        if decision == VERSION:
            return self.en_faire_une_version(identifiant)
        if decision == EQUIPEMENT:
            return self.en_faire_un_equipement(identifiant, nom, emplacement)
        if decision == JETER:
            return self.jeter(identifiant)
        raise DemandeRefusee(f"décision inconnue « {decision} » — {VERSION}, {EQUIPEMENT} ou {JETER}")

    def emplacement_propose(self, identifiant: str) -> str:
        """L'emplacement proposé d'après la zone — **le nom d'un emplacement du
        jeu quand il en a un pareil**, sinon le mot proposé tel quel."""
        assets = self._atelier.assets
        asset = assets._trouver(identifiant)
        repeint = _repeinte(asset)
        if repeint is None:
            return ""
        corps = assets._corps_repeint(repeint)
        if corps is None:
            return ""
        mot = emplacement_propose(corps, masque_de_zone(corps.shape[:2], repeint.zone_peinte))
        base = assets.lire(repeint.base)
        if base is not None and base.projet:
            try:
                for e in self._atelier.equipement.emplacements(base.projet):
                    if e.nom.casefold() == mot.casefold():
                        return e.nom
            except ErreurAtelier:
                pass
        return mot

    def a_decider(self, asset) -> dict[str, Any] | None:
        """Ce que la liste « à décider » dit d'une image — ou rien si elle n'y
        est pas. **Lu, jamais rangé** : un résultat d'avant ce jour s'y trouve
        sans qu'on ait rien écrit sur le disque."""
        repeint = _repeinte(asset)
        if repeint is None or asset.piece or asset.supprime_le:
            return None
        return {"image": repeint.base, "texte": repeint.texte}

    def _temps(self, modele: Modele | None, vitesse_repli: str | None) -> dict[str, Any] | None:
        """**Un temps, jamais un prix** (règle 8ter) : la médiane mesurée sur
        cette machine (`ServiceGenerations.temps_attendu`), sinon la vitesse
        relevée pour la famille du moteur — annoncée comme telle.

        PX7 : **le temps suit le modèle choisi**, pas un seul outil — chaque
        famille a sa vitesse relevée, jamais celle de SDXL prêtée aux quatre
        autres."""
        if modele is None:
            return None
        temps = self._atelier.generations.temps_attendu(modele.identifiant) or {
            "secondes": None, "mesures": 0, "vitesse": None,
        }
        if temps.get("secondes") is None and not temps.get("vitesse"):
            temps = {**temps, "vitesse": vitesse_repli}
        return temps

    def _temps_du_choix(self, ligne: dict[str, Any] | None) -> dict[str, Any] | None:
        """Le temps d'un choix. **Une retouche pas encore écrite n'a jamais été
        mesurée** : la durée d'un tirage *pour créer* n'est pas celle d'une zone,
        et l'annoncer comme « mesurée sur cette machine » serait deviner — c'est
        donc la vitesse relevée du style qui parle, dite comme telle."""
        if ligne is None:
            return None
        if not ligne["_repeint"]:
            return {"secondes": None, "mesures": 0, "vitesse": ligne["_vitesse"]}
        return self._temps(ligne["_modele"], ligne["_vitesse"])

    def _choix_en_json(self, ligne: dict[str, Any]) -> dict[str, Any]:
        return {"identifiant": ligne["identifiant"], "identifiants": list(ligne["identifiants"]),
                "nom": ligne["nom"], "moteur": ligne["moteur"],
                "famille": ligne["famille"], "style": ligne["style"], "raison": ligne["raison"],
                "temps": self._temps_du_choix(ligne)}

    def calques(self, identifiant: str, choix: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
        """Les calques repeints sur cette image, **les plus récents d'abord**."""
        enfants = [
            a for a in self._atelier.base.enfants(identifiant)
            if _repeinte(a) is not None and _repeinte(a).base == identifiant and not a.supprime_le
        ]
        enfants.sort(key=lambda a: (a.cree_le, a.identifiant), reverse=True)
        choix = self._choix() if choix is None else choix
        return [self.fiche(a.identifiant, choix) for a in enfants]

    def fiche(self, identifiant: str, choix: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """Un calque repeint, **de quoi le rouvrir tel qu'il a été demandé** :
        sa zone, son texte, sa graine, sa force, son modèle, ce qui est parti —
        et ce que le recollage a compté.

        MO1 : `choix` dit **lequel des choix d'aujourd'hui** repartirait pour
        « Recommencer » — son modèle garde le nom qu'il avait (une retouche de
        PX7, une ancienne version), et c'est son style qui le retrouve."""
        assets = self._atelier.assets
        asset = assets._trouver(identifiant)
        repeint = _repeinte(asset)
        if repeint is None:
            raise DemandeRefusee("cette image n'est pas un calque repeint")
        generation = self._atelier.generations.lire(asset.generation)
        recollage = assets.recollage(asset)
        retrouve = self._choix_de(asset.modele, self._choix() if choix is None else choix)
        equipement = None
        if asset.piece and asset.projet:
            objet = self._atelier.base.lire_projet(asset.projet)
            piece = next((p for p in (objet.pieces if objet else ()) if p.identifiant == asset.piece), None)
            if piece is not None:
                noms = {e.identifiant: e.nom for e in self._atelier.equipement.emplacements(asset.projet)}
                equipement = {"identifiant": piece.identifiant, "nom": piece.nom,
                              "emplacement": noms.get(piece.emplacement, piece.emplacement),
                              "porteur": asset.personnage}
        return {
            "identifiant": asset.identifiant,
            # PX9 : ce que le résultat est devenu — dérivé, jamais rangé.
            "statut": EQUIPEMENT if asset.piece else A_DECIDER,
            "equipement": equipement,
            "emplacement_propose": self.emplacement_propose(asset.identifiant) if not asset.piece else None,
            "empreinte": asset.empreinte,
            "label": asset.label,
            "image": repeint.base,
            "texte": repeint.texte,
            "zone": [t.en_json() for t in repeint.zone_peinte],
            # La main de C4 posée depuis : ce qu'elle ôte au masque, et ce
            # qu'elle tranche ou ramène sur le calque.
            "affinage": [t.en_json() for t in repeint.affinage],
            "retouche": [t.en_json() for t in repeint.retouche],
            "couleurs": repeint.couleurs,
            "fond": repeint.fond,
            "modele": asset.modele,
            "choix": retrouve["identifiant"] if retrouve else None,
            "rendu_largeur": asset.rendu_largeur,
            "rendu_hauteur": asset.rendu_hauteur,
            "cree_le": asset.cree_le,
            **self._parti(generation),
            "mesures": None if recollage is None else recollage.mesures(),
        }

    @staticmethod
    def _parti(generation: Generation | None) -> dict[str, Any]:
        """Ce que la génération dit être parti — **enregistré, jamais recomposé**."""
        if generation is None:
            return {"graine": None, "force": None, "generation": None, "parti": None}
        options = generation.demande.get("options") or {}
        force = generation.parametres_resolus.get("force", options.get("force"))
        return {
            "generation": generation.identifiant,
            # La graine tirée est gardée sur l'emplacement ; une graine
            # demandée l'est aussi dans les paramètres résolus.
            "graine": next((e.graine for e in generation.emplacements if e.graine is not None),
                generation.parametres_resolus.get("graine")),
            "force": force,
            "parti": {
                "texte": generation.demande.get("prompt", ""),
                "negatif": generation.demande.get("prompt_negatif", ""),
            },
        }

    def ce_qui_part(self, identifiant: str, texte: str, modele: str | None = None) -> dict[str, Any]:
        """Le texte qui partira, **avant de lancer** — par les méthodes de
        l'envoi (`ServiceGenerations.texte_d_une_zone`, `AGENTS.md` point 6).
        PX7 : sur le modèle choisi, quand il en existe un — **ne refuse jamais**,
        c'est un aperçu qui se redemande à chaque lettre tapée. MO1 : un style
        dont la retouche n'est pas encore écrite compose son texte sur son profil
        de création, qui porte le même déclencheur."""
        base = self._atelier.assets._trouver(identifiant)
        choix = self._choix()
        ligne = self._choix_de(modele, choix) if modele else self._defaut(choix)
        if ligne is None or not texte.strip():
            return {"texte": "", "negatif": "", "fond": ""}
        return self._atelier.generations.texte_d_une_zone(
            texte.strip(), ligne["_modele"].identifiant, base.projet, base.identifiant
        )

    def resultat(self, generation_id: str) -> dict[str, Any]:
        """Où en est une zone lancée : le statut, la raison d'un échec, et le
        calque dès qu'il est né."""
        generation = self._atelier.generations.lire(generation_id)
        if generation is None:
            raise ErreurAtelier(f"aucune génération « {generation_id} »")
        emplacement = generation.emplacements[0]
        calque = None
        if emplacement.statut.value == "reussie":
            asset = self._atelier.assets.lire(identifiant_de(generation.identifiant, 0))
            if asset is not None and _repeinte(asset) is not None:
                calque = self.fiche(asset.identifiant)
        return {
            "generation": generation.identifiant,
            "statut": emplacement.statut.value,
            "raison": emplacement.raison,
            "calque": calque,
            **self._parti(generation),
        }

    # ── Le geste ────────────────────────────────────────────────────────────

    async def _verifier(self, identifiant, texte, zone, graine, couleurs, modele=None):
        """Tout ce qui se refuse **avant la file**, pour l'écran comme pour
        l'agent — une zone vide, un texte vide, aucun modèle capable, un modèle
        grisé —, chacun avec sa phrase, jamais un bouton qui échoue.

        PX7 : `modele` nomme celui qu'on veut, parmi les choix de « Repeindre »
        (`_modele_pour_repeindre`, refusé s'il ne désigne aucun style qui sache
        repeindre) ; `None` reprend le défaut. Le modèle se résout **en dernier** :
        c'est là que la retouche d'un style peut s'écrire, et une demande refusée
        pour un texte vide ne doit rien avoir écrit."""
        assets = self._atelier.assets
        base = assets._trouver(identifiant)
        texte = (texte or "").strip()
        if not texte:
            raise DemandeRefusee(TEXTE_VIDE)
        for rang, trait in enumerate(zone, start=1):
            if not 0 <= trait.rayon <= RAYON_MAX:
                raise DemandeRefusee(f"zone, passage {rang} : le rayon va de 0 à {RAYON_MAX}")
        if isinstance(couleurs, bool) or not 0 <= int(couleurs) <= COULEURS_NEUVES_MAX:
            raise DemandeRefusee(f"les couleurs neuves vont de 0 à {COULEURS_NEUVES_MAX}")
        if graine is not None and (isinstance(graine, bool) or not 0 <= int(graine) <= GRAINE_MAX):
            raise DemandeRefusee("la graine est un entier positif")
        with Image.open(io.BytesIO(assets.reference(base.identifiant))) as image:
            corps = np.asarray(image.convert("RGBA")).copy()
        masque = masque_de_zone(corps.shape[:2], tuple(zone))
        if not masque.any():
            raise DemandeRefusee(ZONE_VIDE)
        m = await self._modele_pour_repeindre(modele)
        raison = self._raison_du_modele(m)
        if raison:
            raise DemandeRefusee(f"{m.nom} : {raison}")
        return base, texte, corps, masque, m

    async def lancer(
        self,
        identifiant: str,
        texte: str,
        zone: Sequence[Trait],
        *,
        graine: int | None = None,
        force: float | None = None,
        couleurs: int = COULEURS_NEUVES,
        provenance: str = "auteur",
        identifiant_generation: str | None = None,
        modele: str | None = None,
    ) -> Generation:
        """Peindre, écrire, lancer. **Tout se refuse avant la file** : une zone
        vide, un texte vide, aucun modèle capable, un modèle grisé — chacun avec
        sa phrase, jamais un bouton qui échoue.

        PX7 : `modele` choisit **lequel** des choix de « Repeindre » honore cet
        appel — l'identifiant du catalogue, pas le nom d'une famille. Sans lui,
        le défaut (`_defaut`)."""
        base, texte, corps, masque, modele = await self._verifier(identifiant, texte, zone, graine, couleurs, modele)
        # **La force part toujours, défaut compris** : sans elle, la génération
        # ne la garde pas, et un calque rouvert dirait « force — » alors qu'une
        # force précise a bien servi (vu sur le vrai moteur, 26 septembre 2026).
        options: dict[str, Any] = {
            "force": float(force) if force is not None else self._force_du_profil(modele)["defaut"]
        }
        if graine is not None:
            options["graine"] = int(graine)
        resolution = (
            RESOLUTION_DE_TRAVAIL if RESOLUTION_DE_TRAVAIL in modele.resolutions
            else (modele.resolutions[0] if modele.resolutions else None)
        )
        generations = self._atelier.generations

        def poser_la_zone(generation: Generation) -> None:
            # **Ce que l'image revenue recevra**, écrit avant qu'elle parte —
            # le fond lu sur l'image qui part vraiment, pas deviné.
            toile = generations.demande_preparee(generation).references[0]
            # **Un calque comme ceux de l'équipement** : la même `Difference`,
            # dont seule la source change — la zone peinte au lieu d'une case.
            difference = Difference(
                base=base.identifiant,
                zone_peinte=tuple(zone),
                texte=texte,
                fond=fond_de_la_toile(toile, corps),
                couleurs=int(couleurs),
            )
            chemin = self._atelier.fichiers.dossier_generation(generation.identifiant) / FICHIER_ZONE
            chemin.parent.mkdir(parents=True, exist_ok=True)
            chemin.write_text(json.dumps(difference.en_json(), ensure_ascii=False, indent=2), encoding="utf-8")

        return await generations.soumettre(
            modele.identifiant,
            Demande(
                prompt=texte,
                # **Le texte de l'auteur mot pour mot** : ni la bible du jeu en
                # tête, ni les consignes de pose — seul le déclencheur du style
                # se pose devant. Sur SDXL (77 jetons), la bible noyait la
                # couleur demandée (PX2 : une coiffure rouge pour un texte bleu).
                repris=True,
                # **L'image arrive telle que le moteur l'a rendue** : sa recette
                # de naissance est la zone repeinte, et rien d'autre.
                brut=True,
                resolution=resolution,
                options=options,
                masque=masque_en_png(masque),
            ),
            projet=base.projet,
            references=[Reinjection(asset=base.identifiant, role=EDITION, origine=ASSET)],
            provenance=provenance,
            identifiant=identifiant_generation,
            # **Le fond de la zone, loin de l'image et du texte** : posé comme
            # une correction de l'écran de confirmation, il vaut pour la toile,
            # la phrase de calage et l'interdiction à la fois.
            tri=Tri(fond=generations.fond_d_une_zone(base.projet, base.identifiant, texte)),
            avant_de_lancer=poser_la_zone,
        )

    # ── Pour l'agent : un travail durable ───────────────────────────────────

    async def lancer_pour_l_agent(
        self,
        identifiant: str,
        texte: str,
        zone: Sequence[Trait],
        *,
        graine: int | None = None,
        force: float | None = None,
        couleurs: int = COULEURS_NEUVES,
        modele: str | None = None,
    ) -> dict[str, Any]:
        """La même zone, demandée par l'agent : **les mêmes refus d'abord**, puis
        un travail qui nomme la génération avant qu'elle parte, et que le cadre
        de l'agent autorise (calcul local permis, méthode permise, plafond
        d'appels) — au démarrage, puis quand la carte graphique prend son tour.

        PX7 : `modele` choisit lequel des modèles capables l'agent veut, comme
        à l'écran ; le travail garde l'identifiant résolu (`travail["modele"]`),
        et une reprise relance sur **ce même modèle**, jamais sur le défaut du
        moment (`_executer_agent`)."""
        base, texte, _, _, modele = await self._verifier(identifiant, texte, zone, graine, couleurs, modele)
        if not base.projet:
            raise DemandeRefusee("une zone demandée par l'agent se repeint sur une image rangée dans un jeu")
        travaux = self._atelier.travaux
        travail_id = uuid.uuid4().hex
        travail = {
            "nature": NATURE, "identifiant": travail_id, "cle": travail_id, "projet": base.projet,
            "acteur": AGENT, "empreinte": travail_id, "cree_le": time.time(), "etat": "prepare",
            "etape": "relecture",
            "demande": {"image": base.identifiant, "texte": texte, "zone": [t.en_json() for t in zone],
                        "graine": graine, "force": force, "couleurs": int(couleurs), "livrer_provisoire": False},
            "generation_image": None, "clip": None, "reference_asset": None, "bandes": [], "livraison": None,
            "generations_images": [uuid.uuid4().hex], "modele": modele.identifiant,
            "appels_engages": 0, "reserve": None, "demarrage_recu": False, "references": [], "assets": [],
            "annonce": {"appels": 1, "reservation_usd": 0.0, "image_usd": 0.0,
                        "methodes": [{"nature": "image", "modele": modele.identifiant, "locale": True, "payante": False}]},
        }
        # Le cadre se lit une première fois **avant d'écrire** : un refus ne
        # laisse aucun travail préparé derrière lui.
        travaux._autoriser(dict(travail))
        travaux._garder(travail)
        return await travaux.demarrer(base.projet, travail_id, AGENT)

    async def _executer_agent(self, projet: str, identifiant: str, reprise: bool) -> None:
        """Soumet la zone si elle ne l'a pas encore été, attend son retour, et
        range le travail. **Une reprise ne resoumet jamais** une génération déjà
        écrite : elle relit ce qui est revenu."""
        from atelier.services.travaux import _verrou

        travaux = self._atelier.travaux
        generations = self._atelier.generations
        try:
            with _verrou(travaux._dossier(projet, identifiant) / ".travail"):
                t = travaux._brut(projet, identifiant)
                d = t["demande"]
                gid = t["generations_images"][0]
                if generations.lire(gid) is None:
                    await self.lancer(
                        d["image"], d["texte"], traits_depuis_json(d["zone"]),
                        graine=d.get("graine"), force=d.get("force"),
                        couleurs=d.get("couleurs", COULEURS_NEUVES),
                        provenance=AGENT, identifiant_generation=gid,
                        # PX7 : **le même modèle qu'au premier essai**, gardé sur
                        # le travail — jamais le défaut du moment, qui a pu
                        # changer entre-temps (un autre outil installé, l'ancien
                        # grisé).
                        modele=t.get("modele"),
                    )
                t = travaux._brut(projet, identifiant)
                t.update(appels_engages=1, etape="image")
                travaux._garder(t)
                while (gen := generations.lire(gid)) is not None and not gen.statut.terminee:
                    await generations.attendre(gid, 30)
                asset = self._atelier.assets.lire(identifiant_de(gid, 0))
                raisons = [e.raison for e in (gen.emplacements if gen else ()) if e.raison]
                t = travaux._brut(projet, identifiant)
                t.update(etat="termine" if asset else "a_verifier", etape="termine", reserve=None,
                         assets=[asset.identifiant] if asset else [],
                         reference_asset=asset.identifiant if asset else None, raison=" · ".join(raisons))
                travaux._garder(t)
        except Exception as erreur:  # le travail le dit ; rien n'est resoumis tout seul
            t = travaux._brut(projet, identifiant)
            t.update(etat="a_verifier", reserve=None, raison=str(getattr(erreur, "raison", None) or erreur))
            travaux._garder(t)

    # ── Pour l'agent : une zone en rectangles ou en image ───────────────────

    def zone_de_l_agent(
        self,
        identifiant: str,
        rectangles: Sequence[Sequence[int]] | None = None,
        masque_png: bytes | None = None,
    ) -> tuple[Trait, ...]:
        """La zone d'un agent, en passages de pinceau — **la même forme qu'à
        l'écran**, pour que le calque se rouvre pareil d'où qu'il vienne.
        Rectangles `[x0, y0, x1, y1]` inclusifs, ou un PNG de la taille de
        l'image rendue (blanc = repeindre) ; les deux s'additionnent."""
        base = self._atelier.assets._trouver(identifiant)
        with Image.open(io.BytesIO(self._atelier.assets.reference(base.identifiant))) as image:
            forme = (image.height, image.width)
        traits: list[Trait] = []
        if rectangles:
            for r in rectangles:
                if len(r) != 4:
                    raise DemandeRefusee("un rectangle est [x0, y0, x1, y1]")
            traits.extend(traits_depuis_rectangles(rectangles, forme))
        if masque_png:
            try:
                with Image.open(io.BytesIO(masque_png)) as image:
                    gris = np.asarray(image.convert("L"))
            except (OSError, ValueError) as e:
                raise DemandeRefusee("le masque de la zone n'est pas une image lisible") from e
            if gris.shape != forme:
                raise DemandeRefusee(
                    f"le masque mesure {gris.shape[1]} × {gris.shape[0]} ; "
                    f"l'image rendue, {forme[1]} × {forme[0]}"
                )
            traits.extend(traits_depuis_masque(gris >= 128))
        return tuple(traits)
