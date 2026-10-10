"""Une file durable pour les étapes GPU possédées par l'atelier.

Le verrou borne nos propres soumissions, pas celles de ComfyUI ou d'asset3d.
Une étape acceptée dont le suivi est perdu garde sa place jusqu'à réconciliation.
Les exécuteurs typés restent dans les services image, vidéo et 3D ; la file ne
connaît ni leur prompt ni la forme de leurs fichiers produits.

**La veille (10 octobre 2026).** Une file qui attend sans fin et sans le dire est
le pire des défauts : rien ne casse, rien ne se voit, et plus rien ne sort. Ce
jour-là, des étapes sont passées « à reprendre » après une seule lecture d'état
ratée alors que ComfyUI avait fini leur calcul ; personne ne les a reprises, et
toute la file a attendu derrière elles. Une coroutine de veille (`_veiller`,
appartenant à ce service, lancée par le démarrage de l'application et arrêtée
par `fermer`) passe donc toutes les quelques secondes et tient quatre promesses :

1. une étape orpheline après un redémarrage est reprise (si elle a un numéro de
   travail chez le moteur) ou laissée de côté (si elle n'a rien soumis) ;
2. une étape en cours a une **échéance** — l'estimation de l'atelier × 1,2 ; à
   l'échéance, on demande au moteur : il la traite encore, on prolonge ; il ne
   la connaît plus ou ne répond pas, on la reprend **une fois**, puis on la dit
   échouée, avec une phrase lisible à l'écran ;
3. une étape « à reprendre » que personne ne suit est reprise **une fois** sans
   clic, le compte étant écrit sur l'étape pour ne jamais boucler ;
4. une file qui n'a pas avancé depuis trop longtemps porte une **alerte**
   (`alerte()`), lue par `GET /api/local-queue` et annoncée par la diffusion.
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


class TravailExternePerdu(SuiviLocalInterrompu):
    """Le moteur dit lui-même ne plus connaître ce travail (`EtatTravail.perdu`).

    Levée par un exécuteur **seulement si `resoumission_permise(etape)`** :
    pendant une reprise automatique qui n'a pas encore resoumis. La veille le
    soumet alors de nouveau **une seule fois** (`ServiceFileLocale._resoumettre`).
    Hors de ce cas, chaque exécuteur garde ce qu'il faisait d'un travail échoué."""


def resoumission_permise(etape: dict[str, Any]) -> bool:
    """Vrai pendant une reprise automatique qui n'a pas encore resoumis."""
    return bool(etape.get("reprises_auto")) and not etape.get("resoumis_auto")


FINIS = {"termine", "echoue", "annule"}
RETENUS = {"en_cours", "a_reprendre", "externe_inconnu"}
REGLE = "Les étapes GPU lancées par cet atelier passent une par une. Une autre application peut encore utiliser la carte ; une observation n'est pas un verrou sur cette application."
Executeur = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
Observateur = Callable[[], Awaitable[dict[str, Any]]]
ApresFin = Callable[[dict[str, Any]], Awaitable[None]]

# ── Les réglages de la veille ────────────────────────────────────────────────
#
# L'échéance d'une étape est l'estimation de l'atelier pour *ce* calcul — la
# médiane de `mesures()` pour le même moteur, le même modèle et la même
# température — multipliée par 1 + MARGE_ECHEANCE. Sans aucune mesure (un
# modèle jamais lancé ici), ESTIMATION_PAR_DEFAUT_S tient lieu d'estimation :
# dix minutes, plus que tout ce que la machine a mesuré à ce jour, pour ne
# jamais couper un premier calcul honnête.
MARGE_ECHEANCE = 0.2
ESTIMATION_PAR_DEFAUT_S = 600.0
# Une prolongation vaut 20 % de l'estimation, et jamais moins d'une minute :
# un son de trois secondes ne se revérifierait sinon que 0,6 s plus tard.
PROLONGATION_MIN_S = 60.0
# Une reprise automatique, et une seule : au-delà, l'étape échoue et le dit.
REPRISES_AUTO_MAX = 1
INTERVALLE_VEILLE_S = 5.0
# Une étape qui attend son tour se réveille dès qu'une étape de *cet* atelier
# change (`_signaler`), et sinon toutes les secondes — pour voir un autre
# processus ou un moteur qui se libère. C'était 0,25 s, et chaque réveil
# relisait tout le registre deux fois : six étapes en attente derrière une
# étape retenue relisaient ainsi deux cents fichiers vingt-quatre fois par
# seconde, et la boucle de l'atelier ne servait plus rien d'autre (mesuré le
# 10 octobre 2026 : 2,5 s pour une route triviale, et jusqu'à 280 s pour voir
# la fin d'un calcul de 3 s).
ATTENTE_TOUR_S = 1.0
# Les étapes qui attendent au même moment partagent une seule lecture du
# registre, fraîche au plus de ce délai — et toujours relue après une écriture
# de cet atelier.
FRAICHEUR_LISTE_S = 0.2

ETATS_LISIBLES = {"en_attente": "en attente de son tour", "en_cours": "en cours de calcul",
                  "a_reprendre": "à reprendre", "externe_inconnu": "dont l'acceptation par le moteur est inconnue"}


class ServiceFileLocale:
    def __init__(self, fichiers, diffusion) -> None:
        self.fichiers, self.diffusion = fichiers, diffusion
        self.racine = fichiers.racine / "file-locale"
        self._executeurs: dict[str, Executeur] = {}
        self._moteurs: dict[str, tuple[str, Observateur]] = {}
        # L'historique du moteur, quand il en a un (ComfyUI : `/history/<n>`) :
        # relu à l'échéance avant de déclarer perdu un travail sorti de la file.
        self._relire: dict[str, Callable[[str], Awaitable[Any]]] = {}
        self._observations: dict[str, dict[str, Any]] = {}
        self._taches: dict[str, asyncio.Task] = {}
        # La veille : son horloge et son pas sont injectables, pour que les
        # essais avancent le temps au lieu de l'attendre.
        self.horloge: Callable[[], float] = time.time
        self.intervalle_veille = INTERVALLE_VEILLE_S
        self.attente_tour = ATTENTE_TOUR_S
        # Ce qu'il faut prévenir quand une étape se termine : le travail ou la
        # génération qui l'attendait a pu abandonner entre-temps (reprise
        # automatique), et doit relire le résultat lui-même (`Atelier`).
        self.apres_fin: list[ApresFin] = []
        self._veille: asyncio.Task | None = None
        self._suites: set[asyncio.Task] = set()
        self._verification = False
        self._alerte: dict[str, Any] | None = None
        self._signature: frozenset | None = None
        self._progres_le: float | None = None
        # Le texte de chaque `etape.json` déjà lu, rangé par chemin avec ce qui
        # l'identifie sur le disque (numéro de fichier, date, taille) : un
        # fichier remplacé par `_poser` change de numéro, un fichier inchangé
        # ne se relit pas. Un `stat` coûte quatre fois moins qu'une lecture.
        self._textes: dict[Path, tuple[tuple[int, int, int], str]] = {}
        self._memo: tuple[float, list[str]] | None = None
        self._mesures_memo: tuple[object, list[dict[str, Any]]] | None = None
        self._changement: asyncio.Event | None = None
        self._boucle: asyncio.AbstractEventLoop | None = None
        self.lectures_disque = 0  # compté pour l'essai de charge, rien d'autre
        # Le retard du dernier réveil de la veille sur son pas : la mesure la
        # plus simple d'une boucle affamée (un calcul de 3 s vu 280 s plus tard,
        # 10 octobre 2026). Servi par `GET /api/local-queue`, pour diagnostiquer.
        self.retard_boucle_s = 0.0

    def inscrire_executeur(self, nature: str, executer: Executeur) -> None:
        if nature not in ("image", "video", "modele3d", "rig", "rendu3d", "audio"):
            raise ValueError("nature de calcul local inconnue")
        self._executeurs[nature] = executer

    def inscrire_moteur(self, identifiant: str, nom: str, observer: Observateur,
                        relire: Callable[[str], Awaitable[Any]] | None = None) -> None:
        self._moteurs[identifiant] = (nom, observer)
        if relire is not None:
            self._relire[identifiant] = relire

    def retirer_moteur_inutilise(self, identifiant: str) -> None:
        if any(e["moteur"] == identifiant and e["etat"] not in FINIS for e in self.lister()["etapes"]):
            return  # un ancien moteur garde les travaux qui lui appartiennent
        self._moteurs.pop(identifiant, None)
        self._observations.pop(identifiant, None)

    def _dossier(self, identifiant: str) -> Path:
        if len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise FileLocaleRefusee("Étape locale inconnue.")
        return self.racine / identifiant

    def _lire_texte(self, chemin: Path) -> str:
        etat = chemin.stat()
        cle = (etat.st_ino, etat.st_mtime_ns, etat.st_size)
        connu = self._textes.get(chemin)
        if connu and connu[0] == cle:
            return connu[1]
        texte = chemin.read_text(encoding="utf-8")
        self.lectures_disque += 1
        self._textes[chemin] = (cle, texte)
        return texte

    def _brut(self, identifiant: str) -> dict[str, Any]:
        chemin = self._dossier(identifiant) / "etape.json"
        try:
            return json.loads(self._lire_texte(chemin))
        except (OSError, ValueError) as erreur:
            raise FileLocaleRefusee("Cette étape locale ne peut pas être relue.") from erreur

    def _sauver(self, etape: dict[str, Any]) -> None:
        etape["modifie_le"] = time.time()
        chemin = self._dossier(etape["identifiant"]) / "etape.json"
        self.fichiers._poser(chemin,
            json.dumps(etape, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8"))
        self._textes.pop(chemin, None)
        self._signaler()
        self.diffusion.publier("file_locale", {"identifiant": etape["identifiant"], "etat": etape["etat"], "projet": etape["projet"]})

    def _signaler(self) -> None:
        """Une étape a changé : la lecture partagée est périmée, et les étapes
        qui attendent leur tour se réveillent pour la relire. Appelable depuis
        un fil de travail (une route synchrone) : le réveil passe alors par la
        boucle, seule à pouvoir toucher son `asyncio.Event`."""
        self._memo = None
        boucle, evenement = self._boucle, self._changement
        if evenement is None or boucle is None or boucle.is_closed():
            return

        def reveiller() -> None:
            if self._changement is evenement:
                self._changement = asyncio.Event()
            evenement.set()

        try:
            courante = asyncio.get_running_loop()
        except RuntimeError:
            courante = None
        if courante is boucle:
            reveiller()
        else:
            with contextlib.suppress(RuntimeError):
                boucle.call_soon_threadsafe(reveiller)

    async def _attendre_tour(self) -> None:
        boucle = asyncio.get_running_loop()
        if self._changement is None or self._boucle is not boucle:
            self._boucle, self._changement = boucle, asyncio.Event()
        evenement = self._changement
        # `asyncio.timeout` et non `wait_for` : sous Python 3.11, une
        # annulation qui arrive pendant que l'évènement se lève est avalée par
        # `wait_for`, et la tâche, marquée « cancelling », attend son tour
        # pour toujours — `fermer` ne revenait plus (tests/test_sn3_series.py,
        # atelier fermé en plein calcul).
        with contextlib.suppress(TimeoutError):
            async with asyncio.timeout(self.attente_tour):
                await evenement.wait()

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
                 fin: bytes | None = None, reglage: str | None = None) -> dict[str, Any]:
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
            # `reglage` : ce qui change le temps de calcul d'un même modèle
            # (le compositeur ACE coupé, d'autres pas). Hors du contrat — il ne
            # dit pas un autre calcul — mais il range les mesures à part.
            self._sauver({**contrat, "identifiant": identifiant, "cle": cle, "empreinte": empreinte,
                "etat": "en_attente", "cree_le": time.time(), "demarre_le": None, "termine_le": None,
                "travail_externe": None, "soumission_engagee": False, "raison": "En attente de son tour.",
                "resultat": None, "duree_s": None, "temperature": "inconnue",
                **({"reglage": reglage} if reglage else {})})
        return self.lire(identifiant)

    def trouver(self, cle: str) -> dict[str, Any] | None:
        identifiant = hashlib.sha256(cle.encode()).hexdigest()[:32]
        return self.lire(identifiant) if (self._dossier(identifiant) / "etape.json").exists() else None

    def lire(self, identifiant: str) -> dict[str, Any]:
        return self._vivante(self._brut(identifiant))

    def _vivante(self, etape: dict[str, Any]) -> dict[str, Any]:
        """L'étape telle qu'elle est vraiment : « en cours » sans personne
        pour la suivre se lit « à reprendre »."""
        identifiant = etape["identifiant"]
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
        # Une seule lecture du registre sert tous ceux qui le demandent dans la
        # même fraction de seconde (`FRAICHEUR_LISTE_S`), et chaque fichier
        # inchangé n'y est même pas relu (`_lire_texte`). Ce qui est rendu est
        # toujours neuf : chacun reçoit ses propres dictionnaires.
        memo = self._memo
        if memo is None or time.monotonic() - memo[0] > FRAICHEUR_LISTE_S:
            textes = []
            for chemin in self.racine.glob("*/etape.json"):
                try:
                    textes.append(self._lire_texte(chemin))
                except OSError as erreur:
                    raise FileLocaleRefusee("Cette étape locale ne peut pas être relue.") from erreur
            memo = (time.monotonic(), textes)
            self._memo = memo
        try:
            etapes = [self._vivante(json.loads(t)) for t in memo[1]]
        except ValueError as erreur:
            raise FileLocaleRefusee("Cette étape locale ne peut pas être relue.") from erreur
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

    async def lancer(self, identifiant: str, *, reprise=False, acteur: str | None = None,
                     automatique: bool = False) -> dict[str, Any]:
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
        if reprise and not automatique and (etape.get("reprises_auto") or etape.get("resoumis_auto")):
            # Une reprise voulue — un clic, un travail repris, l'agent — rend à
            # l'étape sa reprise automatique : c'est un nouveau départ, pas la
            # suite de l'ancien. La veille, elle, ne remet jamais son compte à zéro.
            etape = self.modifier(identifiant, reprises_auto=0, resoumis_auto=False, perdu=False,
                                  recupere_auto=False)
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

    async def attendre_suites(self) -> None:
        """Attend les reprises de travaux lancées par des étapes terminées (`apres_fin`)."""
        boucle = asyncio.get_running_loop()
        while suites := [t for t in self._suites if t.get_loop() is boucle and not t.done()]:
            await asyncio.gather(*suites, return_exceptions=True)

    async def fermer(self) -> None:
        boucle = asyncio.get_running_loop()
        if self._veille is not None:
            # Une veille née dans une autre boucle (un client d'essai par
            # `with`, chacun la sienne) ne s'attend pas d'ici : on l'arrête
            # seulement, sa boucle la terminera — ou est déjà fermée.
            if self._veille.get_loop() is boucle:
                self._veille.cancel()
                await asyncio.gather(self._veille, return_exceptions=True)
            elif not self._veille.get_loop().is_closed():
                self._veille.get_loop().call_soon_threadsafe(self._veille.cancel)
            self._veille = None
        suites = [t for t in self._suites if t.get_loop() is boucle]
        for tache in [*self._taches.values(), *suites]:
            if not tache.done():
                tache.cancel()
        await self.attendre_tout()
        if suites:
            await asyncio.gather(*suites, return_exceptions=True)

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

    def mesures(self, etapes: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
        # Demandées en rafale — une fois par travail sonore de l'agent
        # (`ServiceTravaux.temps_sonore_de_l_agent`), une fois par série relue —,
        # elles se calculent une fois par lecture partagée du registre.
        if etapes is None:
            self.lister()
            memo, connu = self._memo, self._mesures_memo
            if memo is not None and connu is not None and connu[0] is memo:
                return [dict(m) for m in connu[1]]
            calculees = self.mesures(self.lister()["etapes"])
            self._mesures_memo = (memo, calculees)
            return [dict(m) for m in calculees]
        groupes: dict[tuple[str, str, str, str | None], list[float]] = {}
        for etape in etapes:
            if etape["duree_s"] is not None and etape["etat"] == "termine":
                cle = (etape["moteur"], etape["modele"], etape["temperature"], etape.get("reglage"))
                groupes.setdefault(cle, []).append(etape["duree_s"])
        return [{"moteur": k[0], "modele": k[1], "temperature": k[2], "mesures": len(v),
                 "mediane_s": statistics.median(v), **({"reglage": k[3]} if k[3] else {})}
                for k, v in groupes.items()]

    def estimation(self, etape: dict[str, Any], etapes: list[dict[str, Any]] | None = None) -> float:
        """Combien de secondes l'atelier attend pour ce calcul : la médiane
        mesurée pour le même moteur, le même modèle et la même température ;
        à défaut, la plus longue des médianes de ce modèle sur ce moteur ; à
        défaut encore, `ESTIMATION_PAR_DEFAUT_S`. C'est le même chiffre que
        l'écran annonce (« Environ N s de calcul »)."""
        mesures = [m for m in self.mesures(etapes) if m["moteur"] == etape["moteur"] and m["modele"] == etape["modele"]
                   and m.get("reglage") == etape.get("reglage")]
        exacte = next((m for m in mesures if m["temperature"] == etape.get("temperature", "inconnue")), None)
        if exacte:
            return float(exacte["mediane_s"])
        if mesures:
            return float(max(m["mediane_s"] for m in mesures))
        return ESTIMATION_PAR_DEFAUT_S

    @staticmethod
    def _prolongation(estimation: float) -> float:
        return max(estimation * MARGE_ECHEANCE, PROLONGATION_MIN_S)

    # ── La veille ────────────────────────────────────────────────────────────

    def demarrer_veille(self) -> None:
        """Lancée par le démarrage de l'application (`creer_application`), dans
        sa boucle ; `fermer` l'arrête. Relancer ne double rien."""
        if self._veille is None or self._veille.done() or self._veille.get_loop() is not asyncio.get_running_loop():
            self._veille = asyncio.create_task(self._veiller())

    async def _veiller(self) -> None:
        while True:
            avant = time.monotonic()
            await asyncio.sleep(self.intervalle_veille)
            self.retard_boucle_s = round(max(0.0, time.monotonic() - avant - self.intervalle_veille), 3)
            try:
                await self.verifier()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 — la veille ne meurt jamais d'un passage raté
                pass

    async def verifier(self) -> None:
        """Un passage de veille : échéances, reprises automatiques, alerte."""
        if self._verification:
            return
        self._verification = True
        try:
            for etape in self.lister()["etapes"]:
                identifiant = etape["identifiant"]
                if etape["etat"] == "en_cours" and identifiant in self._taches and not self._taches[identifiant].done():
                    await self._verifier_echeance(etape)
                elif etape["etat"] == "a_reprendre" and not self._suivie(identifiant):
                    await self._reprendre_seul(etape)
            self._mettre_a_jour_alerte(self.lister()["etapes"])
        finally:
            self._verification = False

    async def _verifier_echeance(self, etape: dict[str, Any]) -> None:
        identifiant, maintenant = etape["identifiant"], self.horloge()
        estimation = etape.get("estimation_s") or self.estimation(etape)
        echeance = etape.get("echeance")
        if echeance is None:
            # Une étape lancée avant cette version : son échéance part d'ici.
            self.modifier(identifiant, echeance=maintenant + estimation * (1 + MARGE_ECHEANCE), estimation_s=estimation)
            return
        if maintenant < echeance:
            return
        marge = self._prolongation(estimation)
        numero = etape["travail_externe"]
        observation = None
        if numero:
            observations = await self.observer(rafraichir=True)
            observation = next((o for o in observations if o["identifiant"] == etape["moteur"]), None)
        if not numero or (observation and observation["etat"] != "inconnu" and numero in observation["travaux"]):
            # Il calcule encore (ou n'a pas encore de numéro à demander) : on
            # prolonge de 20 % de l'estimation, et on redemandera.
            prolongations = int(etape.get("prolongations") or 0) + 1
            raison = (f"Plus long que prévu (environ {estimation:.0f} s) : le moteur traite encore ce calcul. "
                      f"Nouvelle vérification dans {marge:.0f} s." if numero else
                      f"Plus long que prévu (environ {estimation:.0f} s), avant que le moteur ait rendu son numéro de travail.")
            self.modifier(identifiant, echeance=maintenant + marge, prolongations=prolongations, raison=raison)
            return
        if observation and observation["etat"] != "inconnu" and not etape.get("rendu_vu"):
            # Sorti de la file ne veut pas dire perdu (10 octobre 2026, fil
            # musique : ACE-Step fini à 20:33, l'étape passée « échoue ») — il a
            # pu finir, et l'atelier télécharge et mesure son rendu. On relit
            # l'historique : le rendu y est, on laisse le suivi le récupérer.
            rendu = await self._relire_historique(etape["moteur"], numero)
            if rendu is not None and getattr(rendu, "fini", False) and not getattr(rendu, "perdu", False):
                self.modifier(identifiant, echeance=maintenant + marge, rendu_vu=True,
                    raison=f"Le moteur a fini le travail {numero} : l'atelier récupère son rendu. "
                           f"Nouvelle vérification dans {marge:.0f} s.")
                return
        motif = ("le moteur ne répond pas" if not observation or observation["etat"] == "inconnu"
                 else f"le moteur n'a plus le travail {numero} dans sa file")
        # Perdu ou injoignable : ce suivi-ci ne sert plus. On l'arrête (il passe
        # « à reprendre », son numéro gardé), puis on le reprend une fois.
        tache = self._taches[identifiant]
        tache.cancel()
        await asyncio.gather(tache, return_exceptions=True)
        await self._reprendre_seul(self.lire(identifiant), f"Échéance dépassée ({estimation * (1 + MARGE_ECHEANCE):.0f} s prévues) : {motif}.")

    async def _relire_historique(self, moteur: str, numero: str) -> Any:
        """L'état du travail dans l'historique du moteur ; `None` sans
        historique raccordé, ou s'il ne répond pas (le doute ne sauve rien :
        l'échéance suit alors son cours)."""
        relire = self._relire.get(moteur)
        if relire is None:
            return None
        try:
            return await asyncio.wait_for(relire(numero), timeout=10)
        except Exception:  # noqa: BLE001 — illisible : on n'en conclut rien
            return None

    async def _reprendre_seul(self, etape: dict[str, Any], motif: str | None = None) -> None:
        identifiant = etape["identifiant"]
        motif = motif or "Le suivi de ce calcul s'était arrêté."
        if etape["etat"] != "a_reprendre":
            return  # il a fini pendant qu'on l'arrêtait : rien à reprendre
        if not etape["travail_externe"]:
            # Rien à relire chez le moteur : un envoi engagé sans numéro reste
            # « acceptation inconnue » (jamais de second appel), et un envoi pas
            # encore parti attend qu'on le relance — il ne bloque pas la file.
            return
        if etape.get("perdu") and not etape.get("resoumis_auto"):
            await self._resoumettre(etape)
            return
        fait = int(etape.get("reprises_auto") or 0)
        if fait >= REPRISES_AUTO_MAX or etape.get("resoumis_auto"):
            # Avant de conclure, l'historique du moteur (10 octobre 2026,
            # 3dfe45f8) : sa reprise s'était usée à attendre son tour pendant
            # un interblocage, et l'étape échouait au redémarrage alors que
            # ComfyUI avait rendu le son. Un rendu réussi se récupère — sans
            # nouvel envoi —, une fois de plus seulement.
            rendu = await self._relire_historique(etape["moteur"], etape["travail_externe"])
            if (rendu is not None and getattr(rendu, "fini", False) and not getattr(rendu, "echoue", False)
                    and not etape.get("recupere_auto") and etape["nature"] in self._executeurs
                    and etape["moteur"] in self._moteurs):
                self.modifier(identifiant, recupere_auto=True,
                    raison=f"{motif} Le moteur a rendu le travail {etape['travail_externe']} : l'atelier le "
                           "récupère, sans le soumettre de nouveau.")
                await self.lancer(identifiant, reprise=True, automatique=True)
                return
            self.modifier(identifiant, etat="echoue", termine_le=time.time(),
                raison=f"{motif} La reprise automatique a déjà été tentée sans succès : l'étape est arrêtée pour ne "
                       f"plus bloquer la file. Dernier état connu : {etape['raison']}")
            return
        if etape["nature"] not in self._executeurs or etape["moteur"] not in self._moteurs:
            raison = f"{motif} Reprise automatique en attente : le moteur de cette étape n'est pas raccordé à cet atelier."
            if etape["raison"] != raison:
                self.modifier(identifiant, raison=raison)
            return
        self.modifier(identifiant, reprises_auto=fait + 1,
            raison=f"{motif} Reprise automatique : l'atelier relit le travail {etape['travail_externe']} chez le moteur, sans le soumettre de nouveau.")
        await self.lancer(identifiant, reprise=True, automatique=True)

    async def _resoumettre(self, etape: dict[str, Any]) -> None:
        """**La seule soumission automatique de toute la file**, et elle est
        bornée à une. Elle n'arrive que lorsque le moteur a dit lui-même, pendant
        une reprise automatique, ne plus connaître le travail (ComfyUI
        redémarré : ni dans sa file, ni dans son historique). Un calcul local
        oublié n'a rien produit et ne coûtait rien — le refaire ne repaie rien.
        Le numéro oublié est effacé et l'envoi désengagé, pour que l'exécuteur
        le soumette comme au premier jour ; s'il échoue encore, l'étape échoue
        pour de bon (`_reprendre_seul`)."""
        identifiant = etape["identifiant"]
        if etape["nature"] not in self._executeurs or etape["moteur"] not in self._moteurs:
            return
        self.modifier(identifiant, etat="en_attente", travail_externe=None, soumission_engagee=False,
            perdu=False, resoumis_auto=True,
            raison=f"Le moteur ne connaissait plus le travail {etape['travail_externe']} : ce calcul local ne coûtait rien, "
                   "il est soumis de nouveau, une seule fois.")
        await self.lancer(identifiant, automatique=True)

    def alerte(self) -> dict[str, Any] | None:
        return self._alerte

    def _mettre_a_jour_alerte(self, etapes: list[dict[str, Any]]) -> None:
        maintenant = self.horloge()
        # Ce qui doit encore passer : une étape en attente que personne ne suit
        # ne passera jamais d'elle-même et ne bloque rien — elle ne compte pas.
        ouvertes = [e for e in etapes if e["etat"] not in FINIS
                    and not (e["etat"] == "en_attente" and not self._suivie(e["identifiant"]))]
        signature = frozenset((e["identifiant"], e["etat"]) for e in ouvertes)
        if signature != self._signature or self._progres_le is None:
            self._signature, self._progres_le = signature, maintenant
        alerte = None
        if ouvertes:
            tete = next((e for e in ouvertes if e["etat"] in RETENUS), ouvertes[0])
            estimation = tete.get("estimation_s") or self.estimation(tete, etapes)
            # Le seuil suit les échéances : l'échéance, plus une prolongation.
            # À ce moment, la veille aurait dû agir au moins une fois.
            seuil = estimation * (1 + MARGE_ECHEANCE) + self._prolongation(estimation)
            depuis = maintenant - self._progres_le
            if depuis >= seuil:
                minutes = max(1, round(depuis / 60))
                phrase = (f"La file locale n'a pas avancé depuis {minutes} min. Elle attend l'étape {tete['nature']} "
                          f"« {tete['modele']} » du projet {tete['projet'] or 'sans projet'} ({tete['identifiant'][:8]}), "
                          f"{ETATS_LISIBLES.get(tete['etat'], tete['etat'])} : {tete['raison'] or 'aucune raison donnée.'}")
                alerte = {"phrase": phrase, "etape": tete["identifiant"], "depuis_s": round(depuis), "seuil_s": round(seuil)}
        ancienne, self._alerte = self._alerte, alerte
        if (ancienne is None) != (alerte is None) or (ancienne and alerte and ancienne["etape"] != alerte["etape"]):
            self.diffusion.publier("file_locale_alerte", {"alerte": alerte})

    def _annoncer_fin(self, identifiant: str) -> None:
        """Prévient ceux qui attendaient cette étape qu'elle est terminée — en
        tâches à part : un travail qui la reprend ne retarde jamais la file."""
        if not self.apres_fin:
            return
        etape = self.lire(identifiant)
        for suite in self.apres_fin:
            async def prevenir(suite=suite):
                with contextlib.suppress(Exception):
                    await suite(dict(etape))
            tache = asyncio.create_task(prevenir())
            self._suites.add(tache)
            tache.add_done_callback(self._suites.discard)

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
                            # Une seule lecture du registre, partagée (`lister`) :
                            # l'état vivant suffit — « en cours » sans suivi s'y
                            # lit « à reprendre », retenu dans les deux cas.
                            autres = [e for e in self.lister()["etapes"] if e["identifiant"] != identifiant]
                            # Deux reprises qui se retiennent l'une l'autre ne
                            # passent jamais (série « accueil v2 », 10 octobre
                            # 2026 : 2c69e43c attendait 3dfe45f8, qui l'attendait).
                            # Entre deux étapes à reprendre, la plus ancienne passe ;
                            # une étape qui calcule vraiment retient toujours.
                            retenu = next((e for e in autres if e["etat"] in RETENUS
                                and not (etape["etat"] in RETENUS and e["etat"] != "en_cours"
                                         and (e["cree_le"], e["identifiant"]) > (etape["cree_le"], identifiant))), None)
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
                                    # L'échéance de ce tour de calcul (la veille) :
                                    # l'estimation de l'atelier pour ce calcul × 1,2.
                                    estimation = self.estimation({**etape, "temperature": temperature})
                                    # L'observation externe a attendu : une annulation
                                    # a pu arriver entre-temps. La prise de place et
                                    # l'annulation se départagent dans le même registre.
                                    with self._registre():
                                        courante = self._brut(identifiant)
                                        if courante["etat"] in FINIS:
                                            return
                                        courante.update(etat="en_cours", raison="Calcul en cours.",
                                            demarre_le=courante["demarre_le"] or time.time(), temperature=temperature,
                                            estimation_s=estimation, prolongations=0, rendu_vu=False,
                                            echeance=self.horloge() + estimation * (1 + MARGE_ECHEANCE))
                                        self._sauver(courante)
                                    resultat = await self._executeurs[etape["nature"]](self._brut(identifiant))
                                    relue = self._brut(identifiant)
                                    # **PX3bis** : un tirage rendu par le cache de ComfyUI
                                    # (`resultat["cache"]`, § `FournisseurWorkflowImage._executer`)
                                    # n'a rien coûté en temps de carte graphique — il n'entre
                                    # donc jamais dans la médiane du bouton, comme une reprise
                                    # dont la durée n'est pas connue.
                                    a_mesurer = etape["demarre_le"] is None and not resultat.get("cache")
                                    reussie = resultat.get("reussie", True)
                                    self.modifier(identifiant, etat="termine" if reussie else "echoue",
                                        resultat=resultat, termine_le=time.time(), raison=resultat.get("raison", ""),
                                        duree_s=max(0, time.time() - relue["demarre_le"]) if a_mesurer else None)
                                    if reussie:
                                        self._annoncer_fin(identifiant)
                                    return
                                raison = (inconnue or occupee).get("raison") or "Un moteur externe n'est pas disponible."
                            if etape["raison"] != raison:
                                self.modifier(identifiant, raison=raison)
                    except VerrouOccupe:
                        pass
                    await self._attendre_tour()
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
                if isinstance(erreur, TravailExternePerdu) and resoumission_permise(etape):
                    # Oublié par le moteur pendant une reprise automatique : la
                    # veille le resoumettra une fois (`_resoumettre`).
                    self.modifier(identifiant, etat="a_reprendre", perdu=True, raison=str(erreur))
                    return
                etat = ("externe_inconnu" if isinstance(erreur, AcceptationLocaleInconnue) or (etape["soumission_engagee"] and not etape["travail_externe"])
                        else "a_reprendre" if isinstance(erreur, SuiviLocalInterrompu) or etape["travail_externe"] else "echoue")
                self.modifier(identifiant, etat=etat, raison=str(erreur))
