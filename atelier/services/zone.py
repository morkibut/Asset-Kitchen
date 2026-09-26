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
from atelier.fournisseur.catalogue_styles import FAMILLES, style
from atelier.image.zone import (
    fond_de_la_toile,
    masque_de_zone,
    masque_en_png,
    traits_depuis_masque,
    traits_depuis_rectangles,
)
from atelier.services.assets import FICHIER_ZONE

#: L'outil local qui sait repeindre une zone (PX2). Nommé ici pour une seule
#: chose : dire à l'auteur **quoi installer** quand aucun modèle du catalogue ne
#: sait le faire. Le modèle, lui, se choisit sur sa capacité (`Modele.masque`).
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

    def modele(self) -> Modele | None:
        """Le modèle par défaut : **le catalogue décide** — le premier qui
        déclare la capacité et qui n'est pas grisé, sinon le premier qui la
        déclare (pour dire sa raison), sinon rien. PX7 : ce n'est plus le seul
        choix possible — l'auteur ou l'agent peut nommer un autre modèle capable
        (`_modele_choisi`) ; celui-ci reste le repli, et le seul choix quand
        rien n'est demandé."""
        capables = self._modeles_capables()
        prets = [m for m in capables if not self._raison_du_modele(m)]
        return (prets or capables or [None])[0]

    def _modeles_capables(self) -> list[Modele]:
        """Tous les modèles qui déclarent la capacité `masque` — grisés ou non.
        PX7 : c'est cette liste, entière, que l'écran et l'agent peuvent choisir ;
        `modele()` n'en prend que le premier prêt."""
        return [m for m in self._atelier.catalogue.etat.modeles if m.masque]

    def _modele_choisi(self, identifiant: str) -> Modele:
        """Le modèle nommé par l'auteur ou l'agent (PX7) — refusé s'il ne sait
        pas repeindre une zone ou n'existe pas, jamais résolu en silence vers un
        autre : demander un modèle précis et en recevoir un autre serait pire
        qu'un refus."""
        trouve = next((m for m in self._modeles_capables() if m.identifiant == identifiant), None)
        if trouve is None:
            raise DemandeRefusee(f"« {identifiant} » ne sait pas repeindre une zone, ou n'est pas installé")
        return trouve

    def _modele_par_identifiant(self, identifiant: str | None) -> Modele | None:
        """La même recherche que `_modele_choisi`, mais **qui ne refuse rien** —
        pour l'aperçu (`ce_qui_part`), qui ne doit jamais lever pendant qu'on
        tape."""
        if not identifiant:
            return None
        return next((m for m in self._modeles_capables() if m.identifiant == identifiant), None)

    def _raison_du_modele(self, modele: Modele) -> str | None:
        if modele.indisponible:
            return modele.indisponible
        return self._atelier.catalogue.grise(modele)

    async def _outil(self) -> dict[str, Any]:
        """L'outil local de la zone tel que l'installation le voit : prêt ou
        non, et ce qui manque — ou l'injoignable, dit en clair."""
        entree = style(OUTIL_DE_ZONE) or {}
        ligne: dict[str, Any] = {
            "identifiant": OUTIL_DE_ZONE,
            "nom": entree.get("nom", OUTIL_DE_ZONE),
            "pret": False,
            "manque": [],
            "modele": None,
            "vitesse": entree.get("vitesse") or FAMILLES.get(entree.get("famille", ""), {}).get("vitesse"),
        }
        try:
            for l in await self._atelier.styles_locaux.lister_outils():
                if l["identifiant"] == OUTIL_DE_ZONE:
                    ligne.update(l)
        except WorkflowRefuse as refus:
            ligne["manque"] = [refus.raison if hasattr(refus, "raison") else str(refus)]
        return ligne

    async def _outils(self) -> list[dict[str, Any]]:
        """PX7 : **un outil par famille de moteur local**, prêt ou non, et ce
        qui manque — pour que l'écran propose d'installer celui qu'on veut,
        pas seulement celui de SDXL."""
        try:
            return list(await self._atelier.styles_locaux.lister_outils())
        except WorkflowRefuse as refus:
            return [{"identifiant": OUTIL_DE_ZONE, "nom": OUTIL_DE_ZONE, "pret": False,
                "manque": [refus.raison if hasattr(refus, "raison") else str(refus)], "modele": None}]

    def _force_du_profil(self, modele: Modele) -> dict[str, float]:
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
        modele = self.modele()
        outil = await self._outil()
        outils = await self._outils()
        # La vitesse relevée de chaque famille (`FAMILLES[x]["vitesse"]`, ou
        # celle propre à l'outil) — un modèle sans mesure encore prise annonce
        # celle de **sa** famille, jamais celle de SDXL prêtée aux quatre autres.
        vitesse_par_famille = {o["famille"]: o.get("vitesse") for o in outils}
        raison: str | None
        if modele is None:
            raison = (
                "aucun modèle de l'atelier ne sait repeindre une zone — "
                f"installez l'outil « {outil['nom']} »"
            )
        else:
            raison = self._raison_du_modele(modele)
        return {
            "image": base.identifiant,
            "modele": None if modele is None else {"identifiant": modele.identifiant, "nom": modele.nom},
            "raison": raison,
            "outil": outil,
            # PX7 : un outil par famille de moteur local, prêt ou non — pour
            # installer celui qu'on veut, pas seulement celui de `outil`.
            "outils": outils,
            # PX7 : **tous** les modèles capables, grisés ou non — c'est parmi
            # eux que l'écran et l'agent choisissent (`_modele_choisi`). `modele`
            # ci-dessus reste le défaut, celui qu'on garde sans rien choisir.
            # Chacun porte son propre temps : le bouton suit le modèle choisi.
            "modeles": [
                {"identifiant": m.identifiant, "nom": m.nom, "famille": m.famille,
                 "raison": self._raison_du_modele(m), "temps": self._temps(m, vitesse_par_famille.get(m.famille))}
                for m in self._modeles_capables()
            ],
            "temps": self._temps(modele, vitesse_par_famille.get(modele.famille) if modele else None),
            "force": self._force_du_profil(modele) if modele is not None else None,
            "couleurs": {"defaut": COULEURS_NEUVES, "maximum": COULEURS_NEUVES_MAX},
            "calques": self.calques(identifiant),
        }

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

    def calques(self, identifiant: str) -> list[dict[str, Any]]:
        """Les calques repeints sur cette image, **les plus récents d'abord**."""
        enfants = [
            a for a in self._atelier.base.enfants(identifiant)
            if _repeinte(a) is not None and _repeinte(a).base == identifiant
        ]
        enfants.sort(key=lambda a: (a.cree_le, a.identifiant), reverse=True)
        return [self.fiche(a.identifiant) for a in enfants]

    def fiche(self, identifiant: str) -> dict[str, Any]:
        """Un calque repeint, **de quoi le rouvrir tel qu'il a été demandé** :
        sa zone, son texte, sa graine, sa force, son modèle, ce qui est parti —
        et ce que le recollage a compté."""
        assets = self._atelier.assets
        asset = assets._trouver(identifiant)
        repeint = _repeinte(asset)
        if repeint is None:
            raise DemandeRefusee("cette image n'est pas un calque repeint")
        generation = self._atelier.generations.lire(asset.generation)
        recollage = assets.recollage(asset)
        return {
            "identifiant": asset.identifiant,
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
        c'est un aperçu qui se redemande à chaque lettre tapée."""
        base = self._atelier.assets._trouver(identifiant)
        m = self._modele_par_identifiant(modele) if modele else self.modele()
        if m is None or not texte.strip():
            return {"texte": "", "negatif": "", "fond": ""}
        return self._atelier.generations.texte_d_une_zone(
            texte.strip(), m.identifiant, base.projet, base.identifiant
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

    def _verifier(self, identifiant, texte, zone, graine, couleurs, modele=None):
        """Tout ce qui se refuse **avant la file**, pour l'écran comme pour
        l'agent — une zone vide, un texte vide, aucun modèle capable, un modèle
        grisé —, chacun avec sa phrase, jamais un bouton qui échoue.

        PX7 : `modele` nomme celui qu'on veut, parmi ceux qui savent repeindre
        une zone (`_modele_choisi`, refusé s'il est inconnu) ; `None` reprend le
        défaut du catalogue (`modele()`, inchangé)."""
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
        m = self._modele_choisi(modele) if modele is not None else self.modele()
        if m is None:
            raise DemandeRefusee(
                "aucun modèle de l'atelier ne sait repeindre une zone — "
                f"installez l'outil « {OUTIL_DE_ZONE} »"
            )
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

        PX7 : `modele` choisit **lequel** des modèles capables de repeindre une
        zone honore cet appel — l'identifiant du catalogue, pas le nom d'une
        famille. Sans lui, le défaut du catalogue (`modele()`)."""
        base, texte, corps, masque, modele = self._verifier(identifiant, texte, zone, graine, couleurs, modele)
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
        base, texte, _, _, modele = self._verifier(identifiant, texte, zone, graine, couleurs, modele)
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
