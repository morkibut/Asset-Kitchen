"""Personnage → référence → vidéo → bande : une demande durable, deux façades.

La clé relit un dossier ; les sous-appels ont leurs identifiants avant départ.
Une fermeture ne crée aucun appel. La reprise redemande un état connu, jamais
une génération dont l'acceptation est incertaine. Les budgets réservent les
estimations annoncées ; ils ne peuvent imposer un prix maximal à un fournisseur.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import os
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Iterator

from atelier.domaine.animation import DemandeClip
from atelier.domaine.asset import identifiant_de
from atelier.domaine.bande import Cadre
from atelier.domaine.consommation import USD
from atelier.domaine.demande import Demande
from atelier.domaine.erreurs import ClipVideApresDetourage
from atelier.domaine.generation import AUTEUR, AGENT, Generation, Reinjection, Statut
from atelier.domaine.recette import Grille, Recette
from atelier.image import controle_clip
from atelier.domaine.travail import (TravailRefuse, cadre_valide, demande_normalisee, moteur_sonore_permis,
                                     pour_l_empreinte)
from atelier.services.texte_clip import composer

# **Le plus gros geste d'un coup** : huit clips, la même borne que le lot de
# l'ancien formulaire (`api/animation.LOT_MAX`). Une série est un geste qui
# paie N fois ; au-delà ce n'est plus un lot, c'est une fuite.
SERIE_MAX = 8


def _json(objet: Any) -> bytes:
    return json.dumps(objet, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8")


def _hash(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


@contextlib.contextmanager
def _verrou(chemin: Path) -> Iterator[None]:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("a+b") as flux:
        if flux.tell() == 0:
            flux.write(b"0")
            flux.flush()
        flux.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(flux.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(flux.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as erreur:
            raise TravailRefuse("Cette fabrication est déjà prise en charge. Relire son état.") from erreur
        try:
            yield
        finally:
            if os.name == "nt":
                flux.seek(0)
                msvcrt.locking(flux.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(flux.fileno(), fcntl.LOCK_UN)


class ServiceTravaux:
    def __init__(self, atelier) -> None:
        self.a = atelier
        self.racine = atelier.fichiers.racine / "travaux"
        self._taches: dict[str, asyncio.Task] = {}
        self._executants = {"video-libre": self._executer}

    def inscrire_executant(self, nature: str, executer) -> None:
        """Un suivi et un budget communs, même quand la fabrication n'est pas une vidéo."""
        self._executants[nature] = executer

    def _projet(self, projet: str) -> Path:
        if not self.a.base.lire_projet(projet):
            raise TravailRefuse("Le jeu demandé n'existe plus.")
        return self.racine / _hash(projet.encode())[:24]

    def _dossier(self, projet: str, identifiant: str) -> Path:
        if len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise TravailRefuse("Identifiant de travail inconnu.")
        return self._projet(projet) / identifiant

    def _lire(self, chemin: Path, defaut=None):
        if not chemin.exists():
            return defaut
        try:
            return json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError) as erreur:
            raise TravailRefuse(f"Impossible de relire le travail conservé : {erreur}") from erreur

    def _ecrire(self, chemin: Path, objet: Any) -> None:
        self.a.fichiers._poser(chemin, _json(objet))

    def _garder(self, travail: dict[str, Any]) -> None:
        travail["modifie_le"] = time.time()
        self._ecrire(self._dossier(travail["projet"], travail["identifiant"]) / "travail.json", travail)
        self.a.diffusion.publier("travail", {"projet": travail["projet"], "identifiant": travail["identifiant"], "etat": travail["etat"]})

    def cadre(self, projet: str) -> dict[str, Any]:
        ecrit = self._lire(self._projet(projet) / "cadre.json")
        if ecrit is not None:
            return {**ecrit, "origine": "explicite"}
        ancien = self.a.agent.garde_fous()
        return {**cadre_valide({"plafond_appels": ancien.plafond if ancien.plafond_actif else 1_000_000,
                               "modeles_image": [ancien.modele] if ancien.modele_actif else []}),
                "origine": "garde-fous-existants"}

    def regler_cadre(self, projet: str, brut: dict[str, Any]) -> dict[str, Any]:
        cadre = cadre_valide(brut)
        with _verrou(self._projet(projet) / ".budget"):
            self._ecrire(self._projet(projet) / "cadre.json", cadre)
        return self.cadre(projet)

    def _brut(self, projet: str, identifiant: str) -> dict[str, Any]:
        travail = self._lire(self._dossier(projet, identifiant) / "travail.json")
        if not travail:
            raise TravailRefuse("Cette demande n'est pas conservée dans ce jeu.")
        return travail

    def _consommations(self, travail: dict[str, Any]) -> list[dict[str, Any]]:
        retour = list(travail.get("consommations_locales", []))
        identifiants = [travail.get("generation_image"), travail.get("clip"),
                       *travail.get("generations_images", [])]
        for identifiant in dict.fromkeys(i for i in identifiants if i):
            generation = self.a.base.lire(identifiant)
            if generation:
                for e in generation.emplacements:
                    retour.append({"generation": generation.identifiant, "modele": generation.modele,
                                   "consomme": e.consomme, "unite": e.unite, "cout_usd": e.cout_usd})
        return retour

    def lire(self, projet: str, identifiant: str) -> dict[str, Any]:
        travail = self._brut(projet, identifiant)
        retour = {k: v for k, v in travail.items() if k not in ("snapshot_image", "envoi_3d", "reserve", "demarrage_recu")}
        retour["consommations"] = self._consommations(travail)
        retour["envoi_image"] = travail.get("snapshot_image")
        actif = identifiant in self._taches and not self._taches[identifiant].done()
        if travail["etat"] == "en_cours" and not actif:
            retour["etat"] = "a_reprendre"
            retour["raison"] = "Le suivi a été interrompu. Reprendre vérifie les résultats existants sans recommander."
        # **RV1** : un travail rejeté par le contrôle d'arrivée (`controle`
        # posé) ne se reprend jamais — son clip est `echouee` pour de bon, et
        # « reprendre » rouvrirait une étape que rien ne peut relancer (T1).
        # Seule une nouvelle demande, un nouveau clip, refait le tour.
        retour["prochaine_action"] = ("creer_nouvelle_demande" if retour.get("controle") or retour["etat"] == "annule" else "livrer" if retour["etat"] == "termine" else
            "demarrer" if retour["etat"] == "prepare" else
            "reprendre" if retour["etat"] in ("a_reprendre", "a_verifier") else
            "verifier_chez_le_fournisseur" if retour["etat"] == "externe_inconnu" else "attendre")
        if retour["etat"] == "termine" and retour.get("nature") == "video-libre":
            retour["prochaine_action"] = "monter_et_classer"
        if retour.get("nature") == "audio" and retour.get("son"):
            retour["prochaine_action"] = "ecouter_et_retoucher"
        return retour

    def lister(self, projet: str) -> list[dict[str, Any]]:
        return sorted([self.lire(projet, p.parent.name) for p in self._projet(projet).glob("*/travail.json")],
                      key=lambda t: t["cree_le"], reverse=True)

    async def preparer(self, projet: str, brute: dict[str, Any], acteur: str = AUTEUR, *, source_libre: bool = False,
                       serie: dict[str, Any] | None = None) -> dict[str, Any]:
        demande = demande_normalisee(brute, source_libre=source_libre)
        if acteur not in (AUTEUR, AGENT):
            raise TravailRefuse("L'origine de la demande doit être auteur ou agent.")
        identifiant = _hash((projet + "\0" + demande["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        # **RV5, E14** : avec un mouvement, le texte se compose ici et s'écrit
        # dans la demande conservée **avant** l'empreinte. La relecture montre
        # `demande.prompt_video`, `_demande_video` envoie ce même champ : il n'y
        # a qu'un texte, et c'est celui qu'on a lu.
        if demande["mouvement"] is not None:
            self._composer_texte(projet, demande)
        empreinte = _hash(_json({"demande": pour_l_empreinte(demande), "acteur": acteur}))
        existant = self._lire(dossier / "travail.json")
        if existant:
            if existant["empreinte"] != empreinte:
                raise TravailRefuse("Cette clé a déjà une autre demande. Utiliser une nouvelle clé pour la modifier.")
            return self.lire(projet, identifiant)
        await self.a.animation.a_jour()
        with _verrou(dossier / ".travail"):
            existant = self._lire(dossier / "travail.json")
            if existant:
                if existant["empreinte"] != empreinte:
                    raise TravailRefuse("Cette clé a déjà une autre demande.")
                return self.lire(projet, identifiant)
            personnage, objectif = self._personnage_et_objectif(projet, demande, source_libre)
            # La recette est conservée maintenant, comme les références : une
            # palette changée pendant l'attente ne repeint pas le travail relu.
            recette = self.a.montage.recette_du_jeu(Generation(identifiant="preparation", modele="",
                demande={}, parametres_resolus={}, projet=projet, personnage=personnage.identifiant if personnage else None))
            if objectif:
                recette = replace(recette, grille=replace(recette.grille, cible=objectif["largeur"]) if recette.grille else Grille(cible=objectif["largeur"]))
            if objectif and objectif["largeur"] != objectif["hauteur"]:
                raise TravailRefuse("Le montage actuel produit des cases carrées. Régler un objectif carré avant la fabrication.")
            travail = {"identifiant": identifiant, "cle": demande["cle"], "projet": projet,
                       "acteur": acteur, "empreinte": empreinte, "etat": "prepare", "etape": "reference",
                       "demande": demande, "cree_le": time.time(), "reference_asset": demande["reference_asset"],
                       "generation_image": None, "clip": None, "bandes": [], "livraison": None,
                       "references": [], "recette": recette.en_json(), "objectif": objectif,
                       "appels_engages": 0, "reserve": None, "demarrage_recu": False}
            if source_libre:
                travail["nature"] = "video-libre"
            if serie is not None:
                travail["serie"] = dict(serie)
            if personnage and not travail["reference_asset"]:
                choix = self.a.production.image_de_depart(projet, personnage.identifiant, demande["pose"], demande["direction"])
                travail["reference_asset"] = (choix.get("asset") or {}).get("identifiant")
                travail["reference_reutilisee"] = bool(travail["reference_asset"])
            prix_image = 0.0
            if travail["reference_asset"]:
                self._reference(travail, travail["reference_asset"])
            else:
                if not demande["modele_image"]:
                    raise TravailRefuse("Choisir une image de départ ou un modèle d'image pour fabriquer la référence.")
                texte = demande["prompt_image"].strip() or (personnage.description or personnage.nom if personnage else "")
                if not texte:
                    raise TravailRefuse("Décrire l'image de départ à fabriquer avant de demander la vidéo.")
                generation, _, _ = self.a.generations.preparer(demande["modele_image"], Demande(
                    prompt=texte, prompt_negatif=demande["prompt_negatif_image"],
                    proportions=demande["proportions_image"], resolution=demande["resolution_image"],
                    options=demande["options_image"], echelle=personnage.type if personnage else "", repris=demande["repris_image"]),
                    identifiant=identifiant + "-reference-" + empreinte[:8], projet=projet,
                    personnage=personnage.identifiant if personnage else None, pose=demande["pose"], direction=demande["direction"], provenance=acteur,
                    references_ecartees=demande["references_image_ecartees"],
                    references=[Reinjection(asset=r) for r in demande["references_image"]])
                snapshot = self.a.generations.demande_preparee(generation)
                travail["generation_image"] = generation.identifiant
                travail["snapshot_image"] = snapshot.resume()
                travail["references"] = []
                for rang, octets in enumerate(snapshot.references):
                    nom = f"reference-{rang}.png"
                    self.a.fichiers._poser(dossier / nom, octets)
                    travail["references"].append({"nom": nom, "empreinte": _hash(octets),
                        "asset": generation.references[rang].asset if rang < len(generation.references) else None,
                        "url": f"/api/projects/{projet}/production-jobs/{identifiant}/references/{rang}"})
                unite = self.a.catalogue.unite_de(demande["modele_image"])
                if not self.a.generations.methode_locale(demande["modele_image"]) and (unite == USD or unite is None):
                    mesure = self.a.generations.cout_attendu(demande["modele_image"], len(snapshot.references))
                    prix_image = demande["plafond_image_usd"] if demande["plafond_image_usd"] is not None else mesure
                    if prix_image is None:
                        raise TravailRefuse("Le coût de la référence n'est pas encore mesuré. Préciser une réservation en dollars pour ce premier appel.")
            modele = self.a.animation.modele(demande["modele_video"])
            video = self._demande_video(travail, b"reference-prevue")
            refus = self.a.animation.grise(modele, video)
            if refus:
                raise TravailRefuse(refus)
            prix_video = self.a.animation.annonce(modele, video)
            attente = self.a.animation.attente(modele, video)
            travail["annonce"] = {"image_usd": prix_image, "video": prix_video.en_json(),
                "image_locale": bool(travail["generation_image"] and self.a.generations.methode_locale(demande["modele_image"])),
                "temps_local": attente.en_json() if attente else None,
                "reservation_usd": prix_image + (prix_video.montant or 0),
                "appels": 1 + int(bool(travail["generation_image"])),
                "limite": "Les prix estimés servent à réserver le budget. Le fournisseur peut facturer un montant différent.",
                "video_locale": modele.de_la_maison}
            self._garder(travail)
            return self.lire(projet, identifiant)

    def _personnage_et_objectif(self, projet: str, demande: dict[str, Any], source_libre: bool):
        """Le personnage de la case et son objectif — **refus si l'objectif ne
        demande pas cette case**. Case par case, pour une série aussi."""
        personnage = None if source_libre else self.a.production.personnage(projet, demande["personnage"])
        objectif = None if source_libre else self.a.production.objectif_de(projet, personnage.identifiant)["objectif"]
        if objectif is not None and not any(s["nature"] == "animation" and s["pose"] == demande["pose"] and
                   s["direction"] == demande["direction"] and s["quantite"] for s in objectif["sorties"]):
            raise TravailRefuse("Cette animation n'est pas demandée dans l'objectif du personnage.")
        return personnage, objectif

    def _composer_texte(self, projet: str, demande: dict[str, Any]) -> None:
        """Écrit dans `demande["prompt_video"]` le texte composé du mouvement.

        Le même compositeur que la route qui le montre (`texte_clip.composer`) :
        la phrase de la direction du jeu en tête, puis le geste — la correction
        de cet appel s'il y en a une, sinon celui du style coché pour ce
        mouvement (`style_combat`), sinon celui du mouvement. **La correction porte sur le geste seul** :
        la phrase de direction est remise en tête ici, si bien qu'une
        correction vaut pour chaque direction d'une série.

        Un texte déjà présent n'est accepté que s'il est **exactement** le
        composé — c'est le cas d'une demande relue puis renvoyée telle quelle.
        Un autre texte serait une correction qui écrase la phrase de direction :
        elle passe par `correction_geste`, jamais par le texte entier.
        """
        compose = composer(self.a, projet, demande["personnage"], demande["direction"] or None,
                           demande["pose"], demande["mouvement"], demande["correction_geste"],
                           demande["style_combat"])
        if compose["mouvement"] is None:
            raise TravailRefuse(f"Aucun mouvement « {demande['mouvement']} » dans la bibliothèque de ce jeu.")
        texte = compose["texte"].strip()
        if not texte:
            raise TravailRefuse("Ce mouvement n'a pas de texte à envoyer. L'écrire dans la bibliothèque des mouvements, ou corriger le geste.")
        ecrit = demande["prompt_video"].strip()
        if ecrit and ecrit != texte:
            raise TravailRefuse("Le texte de la vidéo se compose depuis le mouvement. Corriger le geste (« correction_geste »), pas le texte entier.")
        demande["prompt_video"] = texte

    def _reference(self, travail: dict[str, Any], identifiant: str) -> None:
        asset = self.a.assets.lire(identifiant)
        if not asset or asset.supprime_le is not None or asset.projet != travail["projet"]:
            raise TravailRefuse("La référence choisie n'est plus une image disponible de ce jeu.")
        octets = self.a.assets.reference(identifiant)
        demande = travail["demande"]
        entree = self.a.animation.preparer_entree(octets, demande["resolution"], demande["proportions"])
        dossier = self._dossier(travail["projet"], travail["identifiant"])
        self.a.fichiers._poser(dossier / "entree-video.png", entree)
        travail["reference_asset"] = identifiant
        travail["entree_video"] = {"empreinte": _hash(entree),
            "url": f"/api/projects/{travail['projet']}/production-jobs/{travail['identifiant']}/video-reference"}

    @staticmethod
    def _demande_video(travail, image) -> DemandeClip:
        d = travail["demande"]
        return DemandeClip(texte=d["prompt_video"], image=image, secondes=d["secondes"],
                           resolution=d["resolution"], proportions=d["proportions"], options=d["options_video"])

    def _estimation_sonore(self, methode: dict[str, Any]) -> float:
        """Le temps d'un tirage, relu au moment du lancement sur les mesures
        de ce moteur : une mesure faite depuis la préparation compte."""
        series = getattr(self.a, "series_son", None)
        if series is None:
            return methode.get("secondes") or 0
        return series.temps(methode["modele"], 1)["temps_s"] or 0

    def temps_sonore_de_l_agent(self, projet: str, *, sauf: str | None = None) -> float:
        """Les secondes de calcul sonore déjà consommées ou réservées par
        l'agent dans ce jeu : ses sons (jamais sa 3D ni ses vidéos, dont le
        temps se compte aussi en secondes) et ses partitions de YuE2."""
        total = 0.0
        for p in self._projet(projet).glob("*/travail.json"):
            autre = self._lire(p)
            if autre["acteur"] != AGENT or autre.get("nature") != "audio" or autre["identifiant"] == sauf:
                continue
            reel = sum(c["consomme"] for c in self._consommations(autre) if c.get("unite") == "secondes")
            total += max(reel, (autre.get("reserve") or {}).get("secondes", 0))
        # La partition de YuE2 (SN9) ne passe pas par un travail durable : son
        # temps est tenu à part, par le service qui l'écrit.
        partitions = getattr(self.a, "partition_son", None)
        return total + (partitions.temps_de_l_agent(projet) if partitions is not None else 0.0)

    def verifier_temps_sonore(self, projet: str, cadre: dict[str, Any], consomme: float, voulu: float,
                              *, deja_calcule: bool = False) -> None:
        """Plafond atteint : refus, même quand le temps du prochain calcul est
        encore inconnu (moteur jamais mesuré sur cette machine)."""
        plafond = cadre["plafond_secondes_audio"]
        if (not deja_calcule and consomme >= plafond) or consomme + voulu > plafond + 1e-6:
            raise TravailRefuse("Le plafond de temps de calcul sonore de l'agent est déjà consommé ou réservé — "
                                "relevez-le dans le cadre de délégation de ce jeu (Réglages › Agent MCP).")

    def _autoriser(self, travail: dict[str, Any], *, reserver=False, en_plus: tuple[float, int] = (0.0, 0)) -> None:
        """Le cadre de l'agent, relu à chaque pas qui peut engager.

        `en_plus` : ce que d'autres travaux de la **même série** réservent dans
        ce même passage, sous le même verrou, sans être encore écrits sur le
        disque (`demarrer_serie`). Dollars et appels, ajoutés à ceux des autres
        demandes de l'agent comme s'ils étaient déjà réservés.
        """
        if travail["acteur"] != AGENT:
            return
        # Un son de l'agent que l'auteur lance ou reprend à l'écran : c'est
        # l'auteur qui agit, et le cadre de l'agent ne le bride jamais.
        # (`lance_par` est posé par `demarrer`, et relu ici jusque dans le
        # calcul qui suit, `ServiceTravauxAudio._calcul`.)
        if travail.get("nature") == "audio" and travail.get("lance_par") == AUTEUR:
            return
        cadre = self.cadre(travail["projet"])
        d, annonce = travail["demande"], travail["annonce"]
        if annonce.get("image_locale") and not cadre["autoriser_local"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas la référence locale.")
        methodes = annonce.get("methodes")
        if methodes is not None:
            for methode in methodes:
                if methode["locale"] and not cadre["autoriser_local"]:
                    raise TravailRefuse("Le cadre de l'agent n'autorise pas cette fabrication locale.")
                if methode["payante"] and not cadre["autoriser_payant"]:
                    raise TravailRefuse("Le cadre de l'agent n'autorise pas cette méthode payante.")
                permises = cadre.get("modeles_" + methode["nature"], [])
                if methode["nature"] == "audio":
                    # Par son nom, sans version : une réinstallation ne coupe pas l'agent.
                    if not moteur_sonore_permis(methode["modele"], permises):
                        raise TravailRefuse(f"« {methode['modele']} » n'est pas une méthode sonore autorisée à l'agent — "
                                            "l'ajouter aux méthodes permises, écran Réglages › Agent MCP.")
                elif permises and methode["modele"] not in permises:
                    raise TravailRefuse(f"« {methode['modele']} » n'est pas une méthode autorisée à l'agent.")
        elif annonce["video_locale"] and not cadre["autoriser_local"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas la vidéo locale.")
        if methodes is None and not annonce["video_locale"] and not cadre["autoriser_payant"]:
            raise TravailRefuse("Le cadre de l'agent n'autorise pas les modèles vidéo payants.")
        for nature in ("image", "video"):
            if methodes is not None:
                break
            modele = d["modele_" + nature]
            if nature == "image" and not travail["generation_image"]:
                continue
            if cadre["modeles_" + nature] and modele not in cadre["modeles_" + nature]:
                raise TravailRefuse(f"« {modele} » n'est pas une méthode autorisée à l'agent.")
        if annonce.get("image_usd", 0) > 0 and not cadre["autoriser_payant"]:
            raise TravailRefuse("Le cadre n'autorise pas la référence payante.")
        if d["livrer_provisoire"] and not cadre["livraison_provisoire"]:
            raise TravailRefuse("Le cadre n'autorise pas la livraison provisoire automatique.")
        montant, appels = 0.0, 0
        for p in self._projet(travail["projet"]).glob("*/travail.json"):
            autre = self._lire(p)
            if autre["acteur"] != AGENT or autre["identifiant"] == travail["identifiant"]:
                continue
            reel = sum(c["cout_usd"] for c in self._consommations(autre))
            reserve = autre.get("reserve") or {}
            montant += max(reel, reserve.get("usd", 0))
            appels += max(autre["appels_engages"], reserve.get("appels", 0))
        montant += en_plus[0]
        appels += en_plus[1]
        reel = sum(c["cout_usd"] for c in self._consommations(travail))
        # Dès que la référence a réellement été facturée, sa mesure remplace
        # l'estimation ; la vidéo encore à soumettre reste réservée à côté.
        reste_video = (annonce["video"]["montant"] or 0) if methodes is None and travail["reference_asset"] and not travail["clip"] else 0
        reste_images = sum(a["reservation_usd"] for a in travail.get("appels", []) if not a.get("soumis"))
        voulu = max(reel + reste_video + reste_images, annonce["reservation_usd"])
        if montant + voulu > cadre["plafond_usd"] + 1e-9:
            raise TravailRefuse("Le budget de l'agent est déjà consommé ou réservé par d'autres demandes.")
        if appels + annonce["appels"] > cadre["plafond_appels"]:
            raise TravailRefuse("Le plafond d'appels de l'agent est déjà consommé ou réservé.")
        # SN12 : le plafond de temps de calcul sonore — pour un son seulement
        # (la 3D et la vidéo comptent aussi leur temps en secondes, mais ce
        # n'est pas du son). Estimé au lancement sur les mesures de ce moteur
        # (`ServiceSeriesSon.temps`), compté ensuite sur ce qui a réellement
        # tourné. Plafond atteint : refus, même sans estimation encore.
        voulu_secondes = 0.0
        if travail.get("nature") == "audio":
            reel_secondes = sum(c["consomme"] for c in self._consommations(travail) if c.get("unite") == "secondes")
            estimee = sum(self._estimation_sonore(m) for m in (methodes or []) if m.get("nature") == "audio")
            voulu_secondes = max(reel_secondes, estimee)
            self.verifier_temps_sonore(travail["projet"], cadre,
                self.temps_sonore_de_l_agent(travail["projet"], sauf=travail["identifiant"]), voulu_secondes,
                deja_calcule=reel_secondes > 0)
        if reserver or travail.get("reserve") is not None:
            travail["reserve"] = {"usd": voulu, "appels": annonce["appels"], "secondes": voulu_secondes}

    async def demarrer(self, projet: str, identifiant: str, acteur: str = AUTEUR,
                       *, reprise=False) -> dict[str, Any]:
        travail = self._brut(projet, identifiant)
        if not self._a_lancer(travail, acteur, reprise):
            return self.lire(projet, identifiant)
        executer = self._executant(travail)
        with _verrou(self._projet(projet) / ".budget"):
            self._garder(self._reserver(projet, identifiant, acteur))
        self._lancer(projet, identifiant, executer, reprise)
        return self.lire(projet, identifiant)

    # ── `demarrer`, en deux temps (RV5) ──────────────────────────────────────
    #
    # **Réserver** sous le verrou du budget, **lancer** une fois dehors. Un
    # travail seul enchaîne les deux ; une série réserve tous ses travaux sous
    # un seul verrou avant d'en lancer aucun (`demarrer_serie`).

    def _a_lancer(self, travail: dict[str, Any], acteur: str, reprise: bool) -> bool:
        """Faux quand il n'y a rien à lancer — la demande se relit telle quelle."""
        identifiant = travail["identifiant"]
        if travail["acteur"] != acteur and acteur != AUTEUR:
            raise TravailRefuse("Cette demande appartient à l'autre mode d'utilisation ; reprendre depuis son contexte.")
        if identifiant in self._taches and not self._taches[identifiant].done():
            return False
        if travail["etat"] in ("termine", "annule"):
            return False
        if travail["etat"] == "externe_inconnu":
            raise TravailRefuse("L'acceptation de cet appel reste inconnue. Vérifier chez le fournisseur ; aucun nouvel appel automatique.")
        if travail["demarrage_recu"] and not reprise:
            return False
        return True

    def _executant(self, travail: dict[str, Any]):
        executer = self._executants.get(travail.get("nature"), self._executer)
        if travail.get("nature") and travail["nature"] not in self._executants:
            raise TravailRefuse("Le moteur de cette fabrication n'est pas disponible dans cette version.")
        return executer

    def _reserver(self, projet: str, identifiant: str, acteur: str, *,
                  en_plus: tuple[float, int] = (0.0, 0)) -> dict[str, Any]:
        """Le travail relu, autorisé et marqué parti — **pas encore écrit**.

        L'appelant tient le verrou du budget et écrit (`_garder`) quand il sait
        que tout passe : un refus ici ne laisse aucune trace sur le disque.
        """
        travail = self._brut(projet, identifiant)
        # Qui lance, cette fois : l'auteur qui reprend à l'écran une
        # demande de l'agent n'est pas bridé par le cadre de l'agent.
        travail["lance_par"] = acteur
        self._autoriser(travail, reserver=True, en_plus=en_plus)
        if travail["demande"]["livrer_provisoire"] and not self.a.livraison.association(projet):
            raise TravailRefuse("Associer le projet Godot avant d'autoriser cette livraison provisoire.")
        travail["demarrage_recu"] = True
        travail["etat"] = "en_cours"
        return travail

    def _lancer(self, projet: str, identifiant: str, executer, reprise: bool) -> None:
        self._taches[identifiant] = asyncio.create_task(executer(projet, identifiant, reprise))

    # ── La série (RV5) : un geste, N travaux ─────────────────────────────────
    #
    # **Un travail par clip, regroupés en série.** Un geste de la fenêtre
    # « Animer » prépare N travaux — cases cochées × nombre de clips —, qui se
    # relisent une fois et se lancent une fois. Chacun garde son propre suivi
    # (acceptation incertaine, reprise, contrôle d'arrivée RV1, réserve) :
    # `_executer` ne connaît toujours qu'un clip, et c'est voulu — c'est le
    # chemin de l'argent. Ce qui les rassemble :
    #
    # - des **clés déterministes**, `<clé>:<direction>:<k>`, si bien qu'une
    #   série répétée se relit au lieu de se refabriquer ;
    # - `serie = {cle, rang, total}` sur chaque travail ;
    # - le **lot** de leurs clips, l'identifiant de la série, que la Galerie lit
    #   pour « en garder un ».
    #
    # **Une case et un clip, c'est exactement `preparer`** : même clé, même
    # travail, sans `serie` — et l'identifiant de la série est alors celui du
    # travail, comme le lot l'a toujours été.

    @staticmethod
    def identifiant_serie(projet: str, cle: str) -> str:
        """L'identifiant d'une série — celui qu'aurait un travail seul de même clé."""
        return _hash((projet + "\0" + cle).encode())[:32]

    def _lot(self, travail: dict[str, Any]) -> str:
        return self.identifiant_serie(travail["projet"], (travail.get("serie") or {}).get("cle") or travail["cle"])

    def _membres(self, projet: str, cle: str) -> list[dict[str, Any]]:
        """Les travaux conservés d'une série, dans l'ordre de leur rang."""
        membres = [t for p in self._projet(projet).glob("*/travail.json")
                   if (t := self._lire(p)) and (t.get("serie") or {}).get("cle") == cle]
        return sorted(membres, key=lambda t: t["serie"]["rang"])

    def _depart_existant(self, projet: str, demande: dict[str, Any], personnage) -> bool:
        """Vrai quand la case part d'une image qui existe déjà — aucune
        référence à fabriquer, donc rien à payer N fois."""
        if demande["reference_asset"]:
            return True
        if personnage is None:
            return False
        choix = self.a.production.image_de_depart(projet, personnage.identifiant, demande["pose"], demande["direction"])
        return bool((choix.get("asset") or {}).get("identifiant"))

    def _en_serie(self, projet: str, cle: str, travaux: list[dict[str, Any]]) -> dict[str, Any]:
        """La série telle que l'écran et l'agent la relisent, **avec son annonce**.

        `annonce_serie.temps_s` : le premier clip paie le chargement du modèle,
        les suivants non — la formule d'`Attente.lot`, passée au serveur pour
        que l'écran n'ait plus à la tenir. `None` quand ce n'est pas la question
        (payant) ou que rien n'est mesuré. `locale` : rien ne se paie — la vidéo
        tourne ici et aucune réservation en dollars n'est faite.
        """
        annonces = [t.get("annonce") or {} for t in travaux]
        reservation = round(sum(a.get("reservation_usd") or 0 for a in annonces), 6)
        attente = annonces[0].get("temps_local") if annonces else None
        temps = None
        if attente:
            temps = attente["secondes"] + (len(travaux) - 1) * (attente.get("secondes_suivant") or attente["secondes"])
        return {
            "serie": {"cle": cle, "identifiant": self.identifiant_serie(projet, cle), "total": len(travaux)},
            "travaux": travaux,
            "annonce_serie": {
                "reservation_usd": reservation,
                "temps_s": temps,
                "appels": sum(a.get("appels") or 0 for a in annonces),
                "locale": bool(annonces) and all(a.get("video_locale") for a in annonces) and reservation == 0,
            },
        }

    async def preparer_serie(self, projet: str, commune: dict[str, Any], cases: list[dict[str, Any]],
                             nombre: int = 1, acteur: str = AUTEUR, *, source_libre: bool = False) -> dict[str, Any]:
        """Prépare `len(cases) × nombre` travaux d'un coup. **Rien ne part.**

        `commune` est une demande de `preparer` sans sa case ; chaque élément de
        `cases` apporte `pose` et `direction` (vide : la case de `commune`). Chaque
        case a son image de départ, sa phrase de direction et sa règle
        d'objectif, comme un travail seul.

        Deux refus, avant d'écrire quoi que ce soit :
        - plusieurs clips d'une même case **sans image de départ existante** —
          chacun paierait sa propre référence ;
        - la **livraison provisoire** d'une série de plus d'un clip — on ne
          saurait pas laquelle livrer.
        """
        if not isinstance(commune, dict):
            raise TravailRefuse("Une fabrication doit contenir des réglages nommés.")
        if isinstance(nombre, bool) or not isinstance(nombre, int) or not 1 <= nombre <= SERIE_MAX:
            raise TravailRefuse(f"Le nombre de clips va de 1 à {SERIE_MAX}.")
        if not isinstance(cases, list) or any(not isinstance(c, dict) or set(c) - {"pose", "direction"} for c in cases):
            raise TravailRefuse("Les cases d'une série sont des paires pose et direction.")
        cle = commune.get("cle")
        if not isinstance(cle, str) or not cle.strip():
            raise TravailRefuse("Préciser « cle » avant de préparer l'animation.")
        demandes = [{**commune, **case} for case in (cases or [{}])]
        vues = [(d.get("pose"), d.get("direction") or "") for d in demandes]
        if len(set(vues)) != len(vues):
            raise TravailRefuse("La même case est cochée deux fois dans la série.")
        total = len(demandes) * nombre
        if total == 1:
            if self._membres(projet, cle):
                raise TravailRefuse("Cette clé a déjà une autre demande. Utiliser une nouvelle clé pour la modifier.")
            return self._en_serie(projet, cle, [await self.preparer(projet, {**demandes[0], "cle": cle}, acteur,
                                                                    source_libre=source_libre)])
        if commune.get("livrer_provisoire"):
            raise TravailRefuse("La livraison provisoire vaut pour un clip seul : dans une série, on ne saurait pas lequel livrer.")
        # **Les clés.** La direction suffit quand la série ne compte qu'une
        # pose ; la pose y entre quand il y en a plusieurs, sinon deux cases de
        # même direction se confondraient.
        plusieurs_poses = len({d.get("pose") for d in demandes}) > 1
        prevues = []
        for d in demandes:
            direction = d.get("direction") or ""
            for k in range(nombre):
                sous_cle = f"{cle}:{d.get('pose')}:{direction}:{k}" if plusieurs_poses else f"{cle}:{direction}:{k}"
                prevues.append(({**d, "cle": sous_cle}, {"cle": cle, "rang": len(prevues), "total": total}))
        # **Tout se vérifie avant d'écrire** : une série à moitié préparée
        # laisserait dans Fabrications des lignes que personne n'a demandées.
        if (self._lire(self._dossier(projet, self.identifiant_serie(projet, cle)) / "travail.json")
                or any(t["cle"] not in {p[0]["cle"] for p in prevues} or t["serie"]["total"] != total
                       for t in self._membres(projet, cle))):
            raise TravailRefuse("Cette clé a déjà une autre série. Utiliser une nouvelle clé pour la modifier.")
        for d in demandes:
            normalisee = demande_normalisee({**d, "cle": cle}, source_libre=source_libre)
            personnage, _ = self._personnage_et_objectif(projet, normalisee, source_libre)
            if nombre > 1 and not self._depart_existant(projet, normalisee, personnage):
                raise TravailRefuse("Plusieurs clips d'une même case partent d'une image existante : sans elle, chacun "
                                    "paierait sa propre image de départ. Choisir une image de départ, ou demander un seul clip.")
        travaux = [await self.preparer(projet, demande, acteur, source_libre=source_libre, serie=serie)
                   for demande, serie in prevues]
        return self._en_serie(projet, cle, travaux)

    async def demarrer_serie(self, projet: str, cle: str, acteur: str = AUTEUR) -> dict[str, Any]:
        """Lance tous les travaux préparés d'une série, **ou aucun**.

        Sous un seul verrou du budget, chaque travail est réservé en comptant
        ceux de la série déjà réservés dans ce passage ; un seul refus, et rien
        n'est écrit ni lancé. Pour l'agent, c'est tout ou rien. Pour l'auteur,
        rien ne change : son cadre ne le bride pas (`_autoriser`).

        Un travail déjà parti n'est pas relancé : ce geste ne reprend rien
        (`demarrer(..., reprise=True)`, travail par travail, le fait).
        """
        seul = self._lire(self._dossier(projet, self.identifiant_serie(projet, cle)) / "travail.json")
        travaux = [seul] if seul else self._membres(projet, cle)
        if not travaux:
            raise TravailRefuse("Cette série n'est pas conservée dans ce jeu.")
        total = (travaux[0].get("serie") or {}).get("total", 1)
        if len(travaux) != total:
            raise TravailRefuse("Cette série est incomplète. La préparer de nouveau avant de la lancer.")
        if total > 1 and any(t["demande"]["livrer_provisoire"] for t in travaux):
            raise TravailRefuse("La livraison provisoire vaut pour un clip seul : dans une série, on ne saurait pas lequel livrer.")
        a_lancer = [t for t in travaux if not t["demarrage_recu"] and self._a_lancer(t, acteur, False)]
        executants = {t["identifiant"]: self._executant(t) for t in a_lancer}
        if a_lancer:
            with _verrou(self._projet(projet) / ".budget"):
                prets, usd, appels = [], 0.0, 0
                for t in a_lancer:
                    pret = self._reserver(projet, t["identifiant"], acteur, en_plus=(usd, appels))
                    reserve = pret.get("reserve") or {}
                    usd += reserve.get("usd", 0)
                    appels += reserve.get("appels", 0)
                    prets.append(pret)
                for pret in prets:
                    self._garder(pret)
            for t in a_lancer:
                self._lancer(projet, t["identifiant"], executants[t["identifiant"]], False)
        return self._en_serie(projet, cle, [self.lire(projet, t["identifiant"]) for t in travaux])

    async def attendre(self, projet: str, identifiant: str, secondes: float = 0) -> dict[str, Any]:
        limite = time.monotonic() + min(max(secondes, 0), 30)
        while identifiant in self._taches and not self._taches[identifiant].done() and time.monotonic() < limite:
            await asyncio.sleep(min(0.1, max(0, limite - time.monotonic())))
        return self.lire(projet, identifiant)

    async def attendre_serie(self, projet: str, cle: str, secondes: float = 0) -> dict[str, Any]:
        """Comme `attendre`, pour tous les travaux d'une série à la fois — une
        seule attente bornée à 30 s, partagée entre eux (l'agent MCP)."""
        seul = self._lire(self._dossier(projet, self.identifiant_serie(projet, cle)) / "travail.json")
        travaux = [seul] if seul else self._membres(projet, cle)
        if not travaux:
            raise TravailRefuse("Cette série n'est pas conservée dans ce jeu.")
        identifiants = [t["identifiant"] for t in travaux]
        limite = time.monotonic() + min(max(secondes, 0), 30)
        while (any(i in self._taches and not self._taches[i].done() for i in identifiants)
               and time.monotonic() < limite):
            await asyncio.sleep(min(0.1, max(0, limite - time.monotonic())))
        return self._en_serie(projet, cle, [self.lire(projet, i) for i in identifiants])

    async def attendre_tout(self) -> None:
        if self._taches:
            await asyncio.gather(*list(self._taches.values()), return_exceptions=True)

    def autoriser_generation_locale(self, generation: Generation) -> None:
        """Le cadre se relit quand le GPU prend son tour, après l'attente éventuelle."""
        if generation.provenance != AGENT:
            return
        # **Par l'identifiant du clip, plus par son lot** (RV5) : le lot d'un
        # clip est désormais l'identifiant de sa série, que la Galerie lit pour
        # « en garder un ». Le clip d'un travail s'appelle `<travail>-video`
        # (`_executer`), et c'est de là qu'on remonte au travail.
        identifiant = generation.identifiant.removesuffix("-video")
        if not generation.projet or not generation.clip or identifiant == generation.identifiant:
            raise TravailRefuse("Cette génération agent n'appartient pas à une demande durable autorisée.")
        with _verrou(self._projet(generation.projet) / ".budget"):
            try:
                travail = self._brut(generation.projet, identifiant)
            except TravailRefuse as erreur:
                raise TravailRefuse("Cette génération agent n'appartient pas à une demande durable autorisée.") from erreur
            if travail["clip"] != generation.identifiant:
                raise TravailRefuse("Le clip ne correspond plus à la demande autorisée.")
            self._autoriser(travail)
            self._garder(travail)

    async def _executer(self, projet: str, identifiant: str, reprise: bool) -> None:
        dossier = self._dossier(projet, identifiant)
        verrou_pris = False
        try:
            with _verrou(dossier / ".travail"):
                verrou_pris = True
                travail = self._brut(projet, identifiant)
                d = travail["demande"]
                if not travail["reference_asset"]:
                    generation = self.a.base.lire(travail["generation_image"])
                    if not generation:
                        raise TravailRefuse("La préparation de référence manque sur le disque.")
                    locale_image = self.a.generations.etape_locale(generation.identifiant)
                    if locale_image and generation.statut != Statut.REUSSIE:
                        travail["etape_locale"] = locale_image["identifiant"]
                        self._garder(travail)
                        if locale_image["etat"] == "externe_inconnu":
                            travail.update(etat="externe_inconnu", raison=locale_image["raison"])
                            self._garder(travail)
                            return
                        await self.a.generations.suivre_locale(generation.identifiant)
                        generation = self.a.base.lire(generation.identifiant)
                        if self._reference_locale_inachevee(travail, generation):
                            return
                    if travail["etape"] == "reference_soumise" and generation.statut != Statut.REUSSIE:
                        travail["etat"] = "externe_inconnu"
                        travail["raison"] = "La référence a peut-être été facturée, mais aucun résultat certain n'est conservé."
                        self._garder(travail)
                        return
                    if generation.statut != Statut.REUSSIE:
                        snapshot = travail["snapshot_image"]
                        refs = []
                        for ref in travail["references"]:
                            octets = (dossier / ref["nom"]).read_bytes()
                            if _hash(octets) != ref["empreinte"]:
                                raise TravailRefuse("Une référence préparée a changé sur le disque.")
                            refs.append(octets)
                        with _verrou(self._projet(projet) / ".budget"):
                            self._autoriser(travail)
                            travail["etape"] = "reference_soumise"
                            travail["appels_engages"] += 1
                            self._garder(travail)
                        await self.a.generations.executer_preparee(generation.identifiant, Demande(
                            prompt=snapshot["prompt"], prompt_negatif=snapshot.get("prompt_negatif", ""),
                            proportions=snapshot["proportions"], resolution=snapshot["resolution"],
                            options=snapshot["options"], references=tuple(refs), repris=True))
                        generation = self.a.base.lire(generation.identifiant)
                    if generation.statut != Statut.REUSSIE:
                        if self._reference_locale_inachevee(travail, generation):
                            return
                        if any(e.acceptation_inconnue for e in generation.emplacements):
                            travail["etat"] = "externe_inconnu"
                            travail["raison"] = "La réponse de référence a été perdue ; son acceptation reste inconnue. Vérifier chez le fournisseur avant toute autre demande."
                            self._garder(travail)
                            return
                        raise TravailRefuse("La référence n'a pas été produite. Son coût éventuel reste enregistré.")
                    asset = self.a.assets.lire(identifiant_de(generation.identifiant, 0))
                    if not asset:
                        raise TravailRefuse("L'image est arrivée mais attend son entrée en bibliothèque.")
                    self._reference(travail, asset.identifiant)
                    travail["etape"] = "video"
                    self._garder(travail)
                if not travail["clip"]:
                    entree = (dossier / "entree-video.png").read_bytes()
                    if _hash(entree) != travail["entree_video"]["empreinte"]:
                        raise TravailRefuse("L'image préparée pour la vidéo a changé sur le disque.")
                    with _verrou(self._projet(projet) / ".budget"):
                        self._autoriser(travail)
                        travail["clip"] = identifiant + "-video"
                        travail["etape"] = "video_soumise"
                        travail["appels_engages"] += 1
                        self._garder(travail)
                    try:
                        # **Le lot du clip est la série** (RV5) — l'identifiant
                        # du travail quand il est seul, comme avant —, et le
                        # mouvement part avec lui : c'est ce que le montage lit
                        # pour nommer ses bandes.
                        await self.a.animation.commander(d["modele_video"], self._demande_video(travail, entree),
                            identifiant=travail["clip"], projet=projet, personnage=d["personnage"],
                            pose=d["pose"], direction=d["direction"], provenance=travail["acteur"],
                            mouvement=d.get("mouvement"), lot=self._lot(travail),
                            depart=travail["reference_asset"], attendre=False)
                    except Exception as erreur:
                        travail["etat"] = "externe_inconnu"
                        travail["raison"] = f"Acceptation externe incertaine : {erreur}. Aucun nouvel appel automatique."
                        self._garder(travail)
                        return
                locale = self.a.animation.etape_locale(travail["clip"])
                if locale:
                    travail["etape_locale"] = locale["identifiant"]
                    travail["etape"] = "file_locale"
                    self._garder(travail)
                    await self.a.animation.suivre(travail["clip"], reprise=reprise)
                    locale = self.a.animation.etape_locale(travail["clip"])
                    if locale["etat"] != "termine":
                        travail["etat"] = "annule" if locale["etat"] == "annule" else "externe_inconnu" if locale["etat"] == "externe_inconnu" else "a_verifier"
                        if locale["etat"] == "annule":
                            travail["reserve"] = None
                            travail["appels_engages"] = max(0, travail["appels_engages"] - 1)
                        travail["raison"] = locale["raison"] or "Le calcul local reste à vérifier."
                        self._garder(travail)
                        return
                clip = self.a.animation.lire(travail["clip"])
                if not clip or not clip.clip or not clip.clip.travail:
                    travail["etat"] = "externe_inconnu"
                    travail["raison"] = "Le numéro de travail du fournisseur n'a pas été reçu. Vérifier l'appel chez lui."
                    self._garder(travail)
                    return
                travail["travail_externe"] = clip.clip.travail
                self._garder(travail)
                if clip.statut != Statut.REUSSIE:
                    await self.a.animation.suivre(clip.identifiant)
                clip = self.a.animation.lire(travail["clip"])
                if clip.statut != Statut.REUSSIE or not clip.clip.images:
                    travail["etat"] = "a_verifier"
                    travail["raison"] = clip.clip.extraction_refus or clip.emplacements[0].raison or "Le clip reste à récupérer."
                    # **RV1** : le contrôle d'arrivée a déjà tranché — noire ou
                    # immobile, ici, puisque « vide » se découvre seulement au
                    # montage ci-dessous. La dépense est connue, elle n'est
                    # plus incertaine : `reserve` se libère comme pour une
                    # fabrication terminée, et `prochaine_action` (`lire`) en
                    # tient compte pour ne jamais proposer de reprendre.
                    if clip.clip.controle:
                        travail["controle"] = clip.clip.controle
                        travail["reserve"] = None
                    self._garder(travail)
                    return
                if travail.get("nature") == "video-libre":
                    travail.update(etat="termine", etape="clip", reserve=None, raison="Le clip est dans la galerie. Le montage permet de le classer et d'en tirer une animation.")
                    self._garder(travail)
                    return
                travail["etape"] = "montage"
                self._garder(travail)
                n = min(d["nombre_images"], clip.clip.images)
                images = [round(i * (clip.clip.images - 1) / max(n - 1, 1)) for i in range(n)]
                try:
                    # **Le second montage automatique, oublié par la revue**
                    # (RV1) : lui aussi contrôle, sur le même signal que
                    # `monter_a_l_arrivee`.
                    bande = self.a.montage.garder(clip.identifiant, f"{d['pose']} · {d['direction'] or 'toutes'}", images,
                        cadence=d["cadence"], sens=d["sens"], cadre=Cadre(), recette=Recette.depuis_json(travail["recette"]),
                        pose=d["pose"], direction=d["direction"], identifiant_bande=identifiant + "-bande", a_l_arrivee=True)
                except ClipVideApresDetourage as erreur:
                    self.a.animation.rater_a_l_arrivee(clip, controle_clip.VIDE, erreur.raison)
                    travail["etat"] = "a_verifier"
                    travail["controle"] = controle_clip.VIDE
                    travail["raison"] = erreur.raison
                    travail["reserve"] = None
                    self._garder(travail)
                    return
                travail["bandes"] = [bande.identifiant]
                travail["etape"] = "livraison" if d["livrer_provisoire"] else "termine"
                self._garder(travail)
                if d["livrer_provisoire"]:
                    self._autoriser(travail)
                    if not travail["livraison"]:
                        repere = travail["objectif"]["repere"]
                        prevue = self.a.livraison.prevoir(projet, d["personnage"], travail["bandes"],
                            pivot_x=repere["x"], pivot_y=repere["y"], boucles={bande.identifiant: travail["objectif"]["boucle"]})
                        travail["livraison"] = prevue["jeton"]
                        self._garder(travail)
                    self.a.livraison.livrer(projet, travail["livraison"])
                travail["etat"] = "termine"
                travail["etape"] = "termine"
                travail["reserve"] = None
                travail.pop("raison", None)
                self._garder(travail)
        except asyncio.CancelledError:
            raise
        except Exception as erreur:
            if not verrou_pris:
                # Une autre instance possède le dossier : son suivi continue.
                # Ne pas remplacer son état par l'échec de notre prise de main.
                return
            travail = self._brut(projet, identifiant)
            travail["etat"] = "a_verifier"
            travail["raison"] = str(erreur)
            # Une erreur peut avoir consommé ; les appels incertains gardent
            # leurs réservations jusqu'à une résolution explicite.
            self._garder(travail)

    def _reference_locale_inachevee(self, travail: dict[str, Any], generation: Generation) -> bool:
        if generation.statut == Statut.REUSSIE:
            return False
        locale = self.a.generations.etape_locale(generation.identifiant)
        if not locale:
            return False
        travail["etape_locale"] = locale["identifiant"]
        travail["etat"] = "externe_inconnu" if locale["etat"] == "externe_inconnu" else "annule" if locale["etat"] == "annule" else "a_verifier"
        travail["raison"] = locale.get("raison") or "L’image locale reste à récupérer ou à vérifier. Le calcul conservé ne sera pas recommandé."
        if locale["etat"] == "annule":
            travail["reserve"] = None
            travail["appels_engages"] = max(0, travail["appels_engages"] - 1)
        self._garder(travail)
        return True

    def autoriser_generation_image_locale(self, generation: Generation) -> None:
        if generation.provenance != AGENT:
            return
        if not generation.projet:
            raise TravailRefuse("Une génération locale de l'agent doit appartenir à un travail et à un jeu.")
        with _verrou(self._projet(generation.projet) / ".budget"):
            candidats = [t for t in self.lister(generation.projet)
                if generation.identifiant in [t.get("generation_image"), *t.get("generations_images", [])]]
            if len(candidats) != 1:
                raise TravailRefuse("Cette image locale de l'agent n'appartient pas à une demande durable autorisée.")
            travail = self._brut(generation.projet, candidats[0]["identifiant"])
            if travail["etat"] == "annule" or (self._dossier(generation.projet, travail["identifiant"]) / "arret.json").exists():
                raise TravailRefuse("Cette demande a été annulée avant le calcul local.")
            self._autoriser(travail)
            self._garder(travail)

    def reference(self, projet: str, identifiant: str, rang: int | None = None) -> bytes:
        travail = self._brut(projet, identifiant)
        dossier = self._dossier(projet, identifiant)
        if rang is None:
            nom = "entree-video.png"
        elif 0 <= rang < len(travail["references"]):
            nom = travail["references"][rang]["nom"]
        else:
            raise TravailRefuse("Cette référence n'existe pas dans l'envoi.")
        if not (dossier / nom).is_file():
            raise TravailRefuse("La référence n'est pas encore disponible.")
        return (dossier / nom).read_bytes()
