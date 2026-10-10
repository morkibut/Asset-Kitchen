"""Une file durable pour les étapes GPU possédées par l'atelier.

Le verrou borne nos propres soumissions, pas celles de ComfyUI ou d'asset3d.
Une étape acceptée dont le suivi est perdu garde sa place jusqu'à réconciliation.
Les exécuteurs typés restent dans les services image, vidéo et 3D ; la file ne
connaît ni leur prompt ni la forme de leurs fichiers produits.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import statistics
import time
from pathlib import Path
from typing import Any, Awaitable, Callable

from atelier.depot.verrou import VerrouOccupe, verrou
from atelier.domaine.erreurs import ErreurAtelier


class FileLocaleRefusee(ErreurAtelier):
    code = "file_locale_refusee"


class SuiviLocalInterrompu(FileLocaleRefusee):
    pass


class AcceptationLocaleInconnue(FileLocaleRefusee):
    pass


FINIS = {"termine", "echoue", "annule"}
RETENUS = {"en_cours", "a_reprendre", "externe_inconnu"}
REGLE = "Les étapes GPU lancées par cet atelier passent une par une. Une autre application peut encore utiliser la carte ; une observation n'est pas un verrou sur cette application."
Executeur = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
Observateur = Callable[[], Awaitable[dict[str, Any]]]


class ServiceFileLocale:
    def __init__(self, fichiers, diffusion) -> None:
        self.fichiers, self.diffusion = fichiers, diffusion
        self.racine = fichiers.racine / "file-locale"
        self._executeurs: dict[str, Executeur] = {}
        self._moteurs: dict[str, tuple[str, Observateur]] = {}
        self._observations: dict[str, dict[str, Any]] = {}
        self._taches: dict[str, asyncio.Task] = {}

    def inscrire_executeur(self, nature: str, executer: Executeur) -> None:
        if nature not in ("image", "video", "modele3d", "rig", "rendu3d", "audio"):
            raise ValueError("nature de calcul local inconnue")
        self._executeurs[nature] = executer

    def inscrire_moteur(self, identifiant: str, nom: str, observer: Observateur) -> None:
        self._moteurs[identifiant] = (nom, observer)

    def retirer_moteur_inutilise(self, identifiant: str) -> None:
        if any(e["moteur"] == identifiant and e["etat"] not in FINIS for e in self.lister()["etapes"]):
            return  # un ancien moteur garde les travaux qui lui appartiennent
        self._moteurs.pop(identifiant, None)
        self._observations.pop(identifiant, None)

    def _dossier(self, identifiant: str) -> Path:
        if len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise FileLocaleRefusee("Étape locale inconnue.")
        return self.racine / identifiant

    def _brut(self, identifiant: str) -> dict[str, Any]:
        chemin = self._dossier(identifiant) / "etape.json"
        try:
            return json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError) as erreur:
            raise FileLocaleRefusee("Cette étape locale ne peut pas être relue.") from erreur

    def _sauver(self, etape: dict[str, Any]) -> None:
        etape["modifie_le"] = time.time()
        self.fichiers._poser(self._dossier(etape["identifiant"]) / "etape.json",
            json.dumps(etape, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8"))
        self.diffusion.publier("file_locale", {"identifiant": etape["identifiant"], "etat": etape["etat"], "projet": etape["projet"]})

    @contextlib.contextmanager
    def _registre(self):
        # Les écritures de registre sont synchrones et courtes ; aucun appel
        # externe ni attente async ne peut garder ce verrou. Une contention
        # persistante doit interrompre le suivi, jamais rejouer l'exécuteur.
        try:
            with verrou(self.racine / ".registre", attendre=2):
                yield
        except VerrouOccupe as erreur:
            raise FileLocaleRefusee("Le registre local est occupé. Réessayer sa lecture avant de reprendre le calcul.") from erreur

    def modifier(self, identifiant: str, **champs) -> dict[str, Any]:
        with self._registre():
            etape = self._brut(identifiant)
            etape.update(champs)
            self._sauver(etape)
            return etape

    def preparer(self, cle: str, *, nature: str, moteur: str, modele: str, projet: str | None,
                 acteur: str, parametres: dict[str, Any], entree: bytes | None = None,
                 fin: bytes | None = None) -> dict[str, Any]:
        if nature not in self._executeurs or moteur not in self._moteurs:
            raise FileLocaleRefusee("Cette méthode locale n'a pas d'exécuteur et de diagnostic raccordés.")
        identifiant = hashlib.sha256(cle.encode()).hexdigest()[:32]
        contrat = {"nature": nature, "moteur": moteur, "modele": modele, "projet": projet,
                   "acteur": acteur, "parametres": parametres,
                   "empreinte_entree": hashlib.sha256(entree).hexdigest() if entree is not None else None}
        # **PX5** : la seconde entrée d'un clip, sa dernière image. Écrite dans
        # le contrat seulement quand elle existe : un calcul sans elle garde
        # l'empreinte d'avant cette tranche.
        if fin:
            contrat["empreinte_fin"] = hashlib.sha256(fin).hexdigest()
        empreinte = hashlib.sha256(json.dumps(contrat, sort_keys=True, allow_nan=False).encode()).hexdigest()
        dossier = self._dossier(identifiant)
        with self._registre():
            if (dossier / "etape.json").exists():
                if self._brut(identifiant)["empreinte"] != empreinte:
                    raise FileLocaleRefusee("Cette clé locale désigne déjà un autre calcul.")
                return self.lire(identifiant)
            if entree is not None:
                self.fichiers._poser(dossier / "entree", entree)
            if fin:
                self.fichiers._poser(dossier / "fin", fin)
            self._sauver({**contrat, "identifiant": identifiant, "cle": cle, "empreinte": empreinte,
                "etat": "en_attente", "cree_le": time.time(), "demarre_le": None, "termine_le": None,
                "travail_externe": None, "soumission_engagee": False, "raison": "En attente de son tour.",
                "resultat": None, "duree_s": None, "temperature": "inconnue"})
        return self.lire(identifiant)

    def trouver(self, cle: str) -> dict[str, Any] | None:
        identifiant = hashlib.sha256(cle.encode()).hexdigest()[:32]
        return self.lire(identifiant) if (self._dossier(identifiant) / "etape.json").exists() else None

    def lire(self, identifiant: str) -> dict[str, Any]:
        etape = self._brut(identifiant)
        actif = identifiant in self._taches and not self._taches[identifiant].done()
        if etape["etat"] == "en_cours" and not actif:
            # Le détenteur peut être un autre processus de l'atelier. La présence
            # du fichier ne suffit pas : c'est le verrou OS qui prouve sa vie.
            try:
                with verrou(self._dossier(identifiant) / ".execution"):
                    pass
            except VerrouOccupe:
                actif = True
        if etape["etat"] == "en_cours" and not actif:
            etape["etat"] = "a_reprendre"
            etape["raison"] = "Le suivi est interrompu. Reprendre vérifie le travail conservé sans le soumettre de nouveau."
        return etape

    def _suivie(self, identifiant: str) -> bool:
        """Vrai si un atelier vivant suit cette étape : celui-ci, ou un autre
        processus qui tient son verrou d'exécution."""
        if identifiant in self._taches and not self._taches[identifiant].done():
            return True
        try:
            with verrou(self._dossier(identifiant) / ".execution"):
                return False
        except VerrouOccupe:
            return True

    def lister(self) -> dict[str, Any]:
        etapes = [self.lire(p.parent.name) for p in self.racine.glob("*/etape.json")]
        etapes.sort(key=lambda e: (e["cree_le"], e["identifiant"]))
        return {"etapes": etapes, "regle": REGLE}

    def entree(self, identifiant: str) -> bytes:
        etape = self._brut(identifiant)
        octets = (self._dossier(identifiant) / "entree").read_bytes()
        if hashlib.sha256(octets).hexdigest() != etape["empreinte_entree"]:
            raise FileLocaleRefusee("L'entrée conservée de ce calcul a été modifiée.")
        return octets

    def fin(self, identifiant: str) -> bytes | None:
        """La dernière image imposée d'un clip (PX5), ou `None` s'il n'en a pas."""
        etape = self._brut(identifiant)
        attendue = etape.get("empreinte_fin")
        if not attendue:
            return None
        octets = (self._dossier(identifiant) / "fin").read_bytes()
        if hashlib.sha256(octets).hexdigest() != attendue:
            raise FileLocaleRefusee("L'image de fin conservée de ce calcul a été modifiée.")
        return octets

    def engager(self, identifiant: str) -> None:
        with self._registre():
            etape = self._brut(identifiant)
            if etape["soumission_engagee"]:
                raise AcceptationLocaleInconnue("Cet envoi a peut-être déjà été accepté. Aucun second appel automatique.")
            if etape["etat"] != "en_cours":
                raise FileLocaleRefusee("Cette étape n'a pas la place de calcul.")
            etape["soumission_engagee"] = True
            self._sauver(etape)

    def connaitre_externe(self, identifiant: str, numero: str) -> None:
        if not numero:
            raise AcceptationLocaleInconnue("Le moteur n'a pas rendu son identifiant de travail.")
        self.modifier(identifiant, travail_externe=numero)

    async def observer(self, *, rafraichir: bool = True) -> list[dict[str, Any]]:
        resultats = []
        for identifiant, (nom, observer) in list(self._moteurs.items()):
            observation = self._observations.get(identifiant)
            if rafraichir or not observation or time.time() - observation["observe_le"] > 2:
                try:
                    observation = await asyncio.wait_for(observer(), timeout=5)
                    if observation.get("etat") not in ("disponible", "occupe", "inconnu"):
                        raise ValueError("état du moteur non reconnu")
                    if not isinstance(observation.get("travaux"), list):
                        raise ValueError("liste des travaux du moteur absente")
                except Exception as erreur:
                    observation = {"etat": "inconnu", "travaux": [], "raison": f"État externe non vérifiable : {erreur}"}
                observation = {**observation, "identifiant": identifiant, "nom": nom, "observe_le": time.time(),
                               "annulation_ciblee": False, "temperature": observation.get("temperature", "inconnue")}
                self._observations[identifiant] = observation
            resultats.append(observation)
        return resultats

    async def lancer(self, identifiant: str, *, reprise=False, acteur: str | None = None) -> dict[str, Any]:
        etape = self._brut(identifiant)
        if acteur == "agent" and etape["acteur"] != "agent":
            raise FileLocaleRefusee("L'agent ne peut pas prendre la main sur une demande manuelle.")
        if identifiant in self._taches and not self._taches[identifiant].done():
            return self.lire(identifiant)
        if etape["etat"] == "echoue" and reprise:
            etape = self.modifier(identifiant, etat="a_reprendre" if etape["soumission_engagee"] else "en_attente",
                raison="Reprise demandée explicitement.")
        elif etape["etat"] in FINIS:
            return self.lire(identifiant)
        if etape["etat"] == "externe_inconnu":
            raise AcceptationLocaleInconnue(etape["raison"])
        if etape["etat"] in RETENUS and not reprise:
            return self.lire(identifiant)
        if etape["nature"] not in self._executeurs or etape["moteur"] not in self._moteurs:
            raise FileLocaleRefusee("Le moteur de cette étape n'est plus raccordé. Rétablir sa configuration avant la reprise.")
        self._taches[identifiant] = asyncio.create_task(self._executer(identifiant))
        return self.lire(identifiant)

    async def attendre(self, identifiant: str, secondes: float = 0) -> dict[str, Any]:
        tache = self._taches.get(identifiant)
        if tache and secondes > 0:
            try:
                await asyncio.wait_for(asyncio.shield(tache), timeout=min(secondes, 30))
            except asyncio.TimeoutError:
                pass
        return self.lire(identifiant)

    async def attendre_fin(self, identifiant: str) -> dict[str, Any]:
        if identifiant in self._taches:
            await asyncio.shield(self._taches[identifiant])
        return self.lire(identifiant)

    async def attendre_tout(self) -> None:
        if self._taches:
            await asyncio.gather(*list(self._taches.values()), return_exceptions=True)

    async def fermer(self) -> None:
        for tache in self._taches.values():
            if not tache.done():
                tache.cancel()
        await self.attendre_tout()

    def annuler(self, identifiant: str, *, acteur: str | None = None) -> dict[str, Any]:
        with self._registre():
            etape = self._brut(identifiant)
            if acteur == "agent" and etape["acteur"] != "agent":
                raise FileLocaleRefusee("L'agent ne peut pas annuler une demande manuelle.")
            if etape["etat"] in FINIS:
                return self.lire(identifiant)
            if etape["soumission_engagee"] or etape["etat"] != "en_attente":
                raise FileLocaleRefusee("L'annulation ciblée de ce calcul déjà lancé est indisponible. L'atelier n'interrompt jamais globalement les travaux du moteur.")
            etape.update(etat="annule", termine_le=time.time(), raison="Annulée avant soumission : aucun calcul lancé.")
            self._sauver(etape)
        return self.lire(identifiant)

    def mesures(self) -> list[dict[str, Any]]:
        groupes: dict[tuple[str, str, str], list[float]] = {}
        for etape in self.lister()["etapes"]:
            if etape["duree_s"] is not None and etape["etat"] == "termine":
                groupes.setdefault((etape["moteur"], etape["modele"], etape["temperature"]), []).append(etape["duree_s"])
        return [{"moteur": k[0], "modele": k[1], "temperature": k[2], "mesures": len(v),
                 "mediane_s": statistics.median(v)} for k, v in groupes.items()]

    async def _executer(self, identifiant: str) -> None:
        proprietaire = False
        try:
            with verrou(self._dossier(identifiant) / ".execution"):
                proprietaire = True
                while True:
                    etape = self._brut(identifiant)
                    if etape["etat"] in FINIS:
                        return
                    try:
                        with verrou(self.racine / ".gpu"):
                            autres = [self._brut(e["identifiant"]) for e in self.lister()["etapes"] if e["identifiant"] != identifiant]
                            retenu = next((e for e in autres if e["etat"] in RETENUS), None)
                            # Une étape en attente dont plus personne ne tient le
                            # suivi — l'atelier qui l'a lancée a été arrêté — ne
                            # passera jamais : elle ne doit pas bloquer la file. Elle
                            # n'a rien soumis, elle reste à sa place pour qui la relance.
                            precedent = next((e for e in autres if e["etat"] == "en_attente"
                                and e["cree_le"] < etape["cree_le"] and self._suivie(e["identifiant"])), None)
                            if retenu or (precedent and not etape["soumission_engagee"]):
                                bloquante = retenu or precedent
                                raison = (f"Une étape précédente attend sa fin ou sa reprise : {bloquante['identifiant']} "
                                          f"({bloquante['nature']}, projet {bloquante['projet']}, {bloquante['etat']}).")
                            else:
                                # Un travail déjà accepté retrouve son moteur même si
                                # ce moteur le dit occupé : c'est justement lui qu'on suit.
                                observations = await self.observer(rafraichir=False)
                                inconnue = next((o for o in observations if o["etat"] == "inconnu"), None)
                                occupee = next((o for o in observations if o["etat"] == "occupe"), None)
                                if etape["soumission_engagee"] or not (inconnue or occupee):
                                    observation = next(o for o in observations if o["identifiant"] == etape["moteur"])
                                    temperature = observation.get("temperature", "inconnue")
                                    if temperature not in ("froid", "chaud"):
                                        temperature = "inconnue"
                                    # L'observation externe a attendu : une annulation
                                    # a pu arriver entre-temps. La prise de place et
                                    # l'annulation se départagent dans le même registre.
                                    with self._registre():
                                        courante = self._brut(identifiant)
                                        if courante["etat"] in FINIS:
                                            return
                                        courante.update(etat="en_cours", raison="Calcul en cours.",
                                            demarre_le=courante["demarre_le"] or time.time(), temperature=temperature)
                                        self._sauver(courante)
                                    resultat = await self._executeurs[etape["nature"]](self._brut(identifiant))
                                    relue = self._brut(identifiant)
                                    # **PX3bis** : un tirage rendu par le cache de ComfyUI
                                    # (`resultat["cache"]`, § `FournisseurWorkflowImage._executer`)
                                    # n'a rien coûté en temps de carte graphique — il n'entre
                                    # donc jamais dans la médiane du bouton, comme une reprise
                                    # dont la durée n'est pas connue.
                                    a_mesurer = etape["demarre_le"] is None and not resultat.get("cache")
                                    self.modifier(identifiant, etat="termine" if resultat.get("reussie", True) else "echoue",
                                        resultat=resultat, termine_le=time.time(), raison=resultat.get("raison", ""),
                                        duree_s=max(0, time.time() - relue["demarre_le"]) if a_mesurer else None)
                                    return
                                raison = (inconnue or occupee).get("raison") or "Un moteur externe n'est pas disponible."
                            if etape["raison"] != raison:
                                self.modifier(identifiant, raison=raison)
                    except VerrouOccupe:
                        pass
                    await asyncio.sleep(0.25)
        except VerrouOccupe:
            return
        except asyncio.CancelledError:
            if proprietaire:
                etape = self._brut(identifiant)
                if etape["etat"] not in FINIS:
                    etat = "externe_inconnu" if etape["soumission_engagee"] and not etape["travail_externe"] else "a_reprendre" if etape["soumission_engagee"] else "en_attente"
                    self.modifier(identifiant, etat=etat, raison="Le suivi a été interrompu ; aucun nouvel envoi automatique.")
            raise
        except Exception as erreur:
            if proprietaire:
                etape = self._brut(identifiant)
                etat = ("externe_inconnu" if isinstance(erreur, AcceptationLocaleInconnue) or (etape["soumission_engagee"] and not etape["travail_externe"])
                        else "a_reprendre" if isinstance(erreur, SuiviLocalInterrompu) or etape["travail_externe"] else "echoue")
                self.modifier(identifiant, etat=etat, raison=str(erreur))
