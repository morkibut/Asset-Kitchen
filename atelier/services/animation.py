# -*- coding: utf-8 -*-
"""Commander un clip, l'attendre, et **ne jamais le payer deux fois**.

Arrivé en A9 (V3). Ce service est au port animateur ce que `ServiceGenerations`
est au port fournisseur, avec une différence qui commande tout le reste : **un
clip se fait attendre deux minutes, et l'atelier peut fermer entre-temps.**

Trois règles en découlent, et elles sont tenues ici.

1. **Le numéro du travail s'écrit avant la première attente.** Pas après la
   réponse, pas à la fin : à la seconde où OpenRouter l'a rendu. Sans lui, un
   clip payé pendant qu'on fermait l'atelier est un clip qu'on repaie.
2. **La dépense s'écrit avant tout le reste.** Avant le fichier, avant la
   mesure, avant l'extraction des images. Un clip dont le fichier est illisible
   reste un clip payé, et le montant reste au journal du projet (US-24).
3. **Rien ne rappelle le fournisseur tout seul.** Au redémarrage, un clip en
   vol est marqué interrompu et **attend un geste** — exactement comme une
   génération d'image (T1), sauf qu'ici le geste ne repaie rien : il rapatrie
   ce qui est déjà payé.

**Une commande de clip est une génération**, avec un emplacement unique et un
champ `clip`. Ce n'est pas une commodité : c'est ce qui met la dépense dans la
barre de tête, dans le total du projet et dans le journal, sans qu'aucun des
endroits qui comptent l'argent ait à apprendre qu'il existe des vidéos.
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine.animation import (
    Attente,
    Clip,
    DemandeClip,
    ModeleVideo,
    Prix,
    taille_demandee,
)
from atelier.domaine.consommation import USD
from atelier.domaine.erreurs import (
    DemandeRefusee,
    ErreurAtelier,
    GenerationInconnue,
    ModeleInconnu,
    SansCle,
)
from atelier.domaine.generation import (
    AUTEUR,
    Emplacement,
    Generation,
    Resultat,
    Statut,
)
from atelier.fournisseur.port import PortAnimateur
from atelier.image import clip as decodeur
from atelier.image.mesures import empreinte_de
from atelier.services.generation import ImportRefuse
from atelier.services.evenements import Diffusion
from atelier.services.fournisseurs import indisponible_de
from atelier.services.file_locale import AcceptationLocaleInconnue, SuiviLocalInterrompu

Fabrique = Callable[[], PortAnimateur]

# Entre deux coups d'œil chez le fournisseur pendant l'attente. Ces appels ne
# coûtent rien ; ils ne servent à rien non plus plus souvent que ça, devant une
# attente de deux minutes.
CADENCE_ATTENTE = 5.0
# Au-delà, le service rend la main. **Le clip n'est pas perdu pour autant** : il
# continue de se fabriquer chez le fournisseur et sera facturé, et le numéro du
# travail permet d'aller le chercher. Mesuré au pire à 301 s le 2 septembre 2026.
ATTENTE_MAX = 900.0

# Le « modèle » d'une vidéo qui n'a appelé personne — le pendant exact d'`IMPORT`
# pour une image (`services/generation.py`). Un mot du produit, que le catalogue
# ne déclare pas et ne déclarera jamais : il dit que ce clip n'a rien coûté et
# qu'il ne se relance pas.
IMPORT_VIDEO = "video-importee"

# Ce qu'un conteneur porte comme type de média, par son extension. **Lu sur le
# nom, jamais deviné sur les octets** : c'est le décodeur qui dit si le fichier
# est lisible, et il le dit sur le contenu quelques lignes plus loin. Ce
# tableau-ci ne sert qu'à écrire le bon type sur le disque, pour que le lecteur
# du navigateur sache quoi faire du fichier qu'on lui sert.
TYPES_VIDEO = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".gif": "image/gif",
}


class ServiceAnimation:
    """Le catalogue vidéo, la commande d'un clip, et sa reprise."""

    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        animateur: Fabrique | Sequence[Fabrique],
        diffusion: Diffusion | None = None,
        file_locale=None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        # **Une fabrique, pas une instance** — la règle de T1, telle quelle : la
        # clé se relit à chaque appel, jamais au démarrage, pour qu'on puisse la
        # déposer sans redémarrer le serveur.
        #
        # **Plusieurs fabriques depuis `A11`**, et une seule reste acceptée : le
        # moteur de la maison est un animateur de plus, pas un cas particulier.
        # Ce qui le distingue d'un payant tient dans son adaptateur — il ne
        # facture rien et ce qui lui manque se répare —, pas ici.
        self._fabriques: tuple[Fabrique, ...] = (
            (animateur,) if callable(animateur) else tuple(animateur)
        )
        self._diffusion = diffusion or Diffusion()
        self._modeles: list[ModeleVideo] = []
        self._recu_le: float = 0.0
        self._raison: str | None = None
        self._en_vol: set[asyncio.Task[None]] = set()
        self._file_locale = file_locale
        self._moteurs_locaux: dict[str, str] = {}
        self.avant_soumission_locale = None
        if file_locale is not None:
            file_locale.inscrire_executeur("video", self._executer_local)
            for fabrique in self._fabriques:
                try:
                    porte = fabrique()
                except ErreurAtelier:
                    continue
                if hasattr(porte, "observer_ressource"):
                    self._inscrire_moteur_local(porte)

    def _inscrire_moteur_local(self, porte) -> str:
        identifiant = porte.nom + "@" + str(getattr(porte, "adresse", "local"))
        ancien = self._moteurs_locaux.get(porte.nom)
        if ancien and ancien != identifiant:
            self._file_locale.retirer_moteur_inutilise(ancien)
        self._moteurs_locaux[porte.nom] = identifiant
        async def inconnu():
            return {"etat": "inconnu", "travaux": [], "raison": "Ce moteur ne publie pas l'occupation de sa ressource locale."}
        self._file_locale.inscrire_moteur(identifiant, porte.nom, getattr(porte, "observer_ressource", inconnu))
        return identifiant

    # ── Le catalogue vidéo ───────────────────────────────────────────────────

    async def rafraichir(self) -> list[ModeleVideo]:
        """Relit les modèles vidéo. **Ne lève jamais**, comme le catalogue d'images.

        « L'échec survient au moment où on génère, jamais au démarrage »
        (US-95). Sans réseau, la liste précédente reste servie et la raison
        s'affiche à côté ; sans liste du tout, la liste est vide et dit pourquoi.
        L'atelier s'ouvre dans tous les cas.
        """
        # **Un animateur qui tombe n'emporte pas les autres.** C'est la
        # différence qu'`A11` introduit : la clé d'OpenRouter peut manquer sans
        # que la carte de la maison cesse d'exister, et l'inverse est vrai aussi.
        # Une seule liste, plusieurs sources, et chacune répond de soi.
        trouves: list[ModeleVideo] = []
        raisons: list[str] = []
        for fabrique in self._fabriques:
            try:
                trouves.extend(await fabrique().catalogue_video())
            except ErreurAtelier as erreur:
                raisons.append(erreur.raison)
        if trouves or not raisons:
            self._modeles = trouves
            self._recu_le = time.time()
            self._raison = " · ".join(raisons) or None
        else:
            self._raison = " · ".join(raisons)
        return self._modeles

    async def a_jour(self) -> list[ModeleVideo]:
        """Les modèles, relus **la première fois qu'on les demande**.

        Le catalogue vidéo ne sert qu'à l'écran qui commande un clip, et
        l'ouverture de l'atelier ne le relit donc pas : une séance qui ne
        commande aucun clip ne paie aucun aller chez le fournisseur. C'est la
        seule différence avec le catalogue d'images, qui, lui, est la première
        chose que l'atelier montre.
        """
        if not self._recu_le:
            await self.rafraichir()
        return self.modeles()

    def modeles(self) -> list[ModeleVideo]:
        """Ceux qui **peuvent partir d'une image**, les seuls que le produit sert.

        Quatre modèles vidéo sur vingt-huit ne prennent pas d'image de départ :
        ils ne savent pas animer un sprite, et les proposer serait proposer ce
        qu'on devra refuser. Ils ne sont pas grisés, ils sont absents — un grisé
        se lève quand on répare quelque chose, et là il n'y a rien à réparer.
        """
        return [m for m in self._modeles if m.accepte_une_image]

    def modele(self, identifiant: str) -> ModeleVideo:
        for modele in self._modeles:
            if modele.identifiant == identifiant:
                return modele
        raise ModeleInconnu(identifiant)

    # ── Quel animateur pour quel modèle ──────────────────────────────────────

    def fabriques(self) -> tuple[Fabrique, ...]:
        """Les animateurs montés, pour qui a besoin de l'un d'eux en particulier.

        Une seule route s'en sert — celle du moteur de la maison, qui a des
        gestes à lui que le port ne porte pas : dire ce qui manque, et le
        rapatrier. Les faire remonter jusqu'ici aurait mis dans le port commun
        deux questions qui n'ont aucun sens pour un fournisseur payant.
        """
        return self._fabriques

    def _animateur(self) -> PortAnimateur:
        """Le premier, et il reste le seul quand il n'y en a qu'un.

        Gardé pour ce qui ne parle d'aucun modèle en particulier — il n'y a rien
        de tel aujourd'hui hors des essais, et c'est très bien ainsi.
        """
        return self._fabriques[0]()

    def _pour(self, modele: ModeleVideo | str) -> PortAnimateur:
        """L'animateur qui possède ce modèle, **par son nom de fournisseur**.

        Le nom voyage déjà sur chaque modèle depuis `A9` — c'est lui qui fait que
        `OpenRouter:bytedance/seedance-2.0-mini` se relit des mois plus tard. Le
        réemployer ici évite d'inventer un second registre qui finirait par ne
        plus s'accorder avec le premier.

        **Sans correspondance, on rend le premier plutôt que de lever.** Un clip
        commandé hier par un fournisseur retiré depuis doit pouvoir dire pourquoi
        il ne se récupère pas, et une exception ici le remplacerait par une page
        cassée.
        """
        nom = modele.fournisseur if isinstance(modele, ModeleVideo) else ""
        if not nom and isinstance(modele, str):
            connu = next((m for m in self._modeles if m.identifiant == modele), None)
            nom = connu.fournisseur if connu else ""
        for fabrique in self._fabriques:
            porte = fabrique()
            if getattr(porte, "nom", "") == nom:
                return porte
        return self._fabriques[0]()

    def _pour_la_generation(self, generation: Generation) -> PortAnimateur:
        return self._pour(generation.modele or "")

    def etat(self) -> dict[str, Any]:
        """De quoi peindre l'écran : les modèles, la date de la photo, la panne."""
        return {
            "modeles": [_modele_en_json(m) for m in self.modeles()],
            "recu_le": self._recu_le,
            "raison": self._raison,
            # **Ce qui manque au premier animateur**, gardé sous ce nom parce que
            # c'est celui du fournisseur payant et que l'écran d'`A9` le lit là.
            "manque": indisponible_de(self._animateur()),
            # **Ce qui manque à chacun, séparément** (A11). Une clé absente chez
            # l'un ne dit rien de l'autre, et une seule phrase pour les deux
            # ferait chercher la panne du mauvais côté.
            "moteurs": self.moteurs(),
            # **Le décodeur est un fait de l'installation, pas du fournisseur.**
            # Il vaut la peine d'être ici : sans lui, un clip s'achète et se
            # garde, mais ses images attendent, et l'écran doit le dire avant
            # qu'on paie plutôt qu'après.
            "decodeur": decodeur.indisponible(),
        }

    def moteurs(self) -> list[dict[str, Any]]:
        """L'état de chaque animateur, **sans rien lui redemander**.

        Ce que chacun sait de lui-même au dernier rafraîchissement. Un animateur
        qui a plus à dire que *disponible ou non* le dit par `etat_du_moteur` —
        c'est le cas du moteur de la maison, dont les trois absences ne sont pas
        la même chose et ne se réparent pas de la même façon.
        """
        dits: list[dict[str, Any]] = []
        for fabrique in self._fabriques:
            porte = fabrique()
            fiche: dict[str, Any] = {
                "nom": getattr(porte, "nom", ""),
                "manque": indisponible_de(porte),
            }
            detail = getattr(porte, "etat_du_moteur", None)
            if callable(detail):
                fiche["moteur"] = detail().en_json()
            dits.append(fiche)
        return dits

    def grise(self, modele: ModeleVideo, demande: DemandeClip) -> str | None:
        """Pourquoi ce modèle ne peut pas partir maintenant, ou `None`.

        Deux sources et elles ne se recouvrent pas : ce qui manque **à son**
        fournisseur — sa clé, ou une fenêtre ComfyUI éteinte —, et ce que le
        modèle ne sait pas faire. La première grise tous les modèles de ce
        fournisseur-là, la seconde celui-là seulement.

        ⚠️ **Depuis `A11`, « son » est le mot qui compte.** Avec un seul animateur
        la distinction ne se voyait pas ; avec deux, griser le moteur de la
        maison parce qu'une clé OpenRouter manque serait exactement le défaut que
        la tranche existe pour éviter — *griser le seul modèle qui ne dépense
        rien*.
        """
        manque = indisponible_de(self._pour(modele))
        if manque:
            return manque
        return modele.refus(demande, self.annonce(modele, demande))

    def annonce(self, modele: ModeleVideo, demande: DemandeClip) -> Prix:
        """Ce que le clip devrait coûter, **avec sa formule**. Jamais une dépense.

        C'est une borne haute : mesuré sur treize clips le 2 septembre 2026,
        l'écart avec le montant facturé va de +4 % à −58 %. L'écran écrit donc
        « environ », et ce qui s'enregistre après est ce que la réponse a dit.
        """
        return modele.prix(demande, releve_le=_date_de(self._recu_le))

    def attente(self, modele: ModeleVideo, demande: DemandeClip) -> Attente | None:
        """Ce que ce clip prendra de **temps**, ou `None` si ce n'est pas la question.

        `None` chez un payant, et ce n'est pas un trou : ce qu'il coûte est de
        l'argent, et annoncer une attente qu'on n'a pas mesurée serait pire que
        de n'en annoncer aucune. Chez le local c'est l'inverse, et l'invariant du
        produit tient tel quel — *rien ne part sans que ce que ça coûte soit
        annoncé* —, il a seulement changé d'unité.
        """
        porte = self._pour(modele)
        premier = bool(getattr(porte, "premier_tirage", True))
        return modele.attente(demande, premier=premier)

    # ── L'image de départ ────────────────────────────────────────────────────

    @staticmethod
    def preparer_entree(sprite: bytes, resolution: str, proportions: str) -> bytes:
        """Le sprite mis à la taille du clip, sur le gris du produit.

        **Une toile par format demandé.** Envoyer une image 16:9 à un appel qui
        rend du carré ferait recadrer le personnage par le modèle, et ce qu'il
        recadre, il l'invente. La taille se déduit donc de ce qui est demandé,
        et le sujet est agrandi à un facteur entier pour que ses pixels restent
        carrés (`atelier/image/clip.py`).
        """
        return decodeur.composer_entree(sprite, taille_demandee(resolution, proportions))

    # ── Lecture ──────────────────────────────────────────────────────────────

    def lire(self, identifiant: str) -> Generation | None:
        """Une commande de clip **est** une génération : elle se relit comme telle."""
        return self._base.lire(identifiant)

    # ── Au démarrage ─────────────────────────────────────────────────────────

    def en_souffrance(self) -> list[Generation]:
        """Les clips **payés ou peut-être payés** qui attendent un geste.

        Ce sont ceux dont le travail est connu et dont l'emplacement n'a pas
        abouti : l'atelier a fermé pendant l'attente, le téléchargement a
        échoué, ou le fournisseur a mis plus longtemps que le plafond. Chacun se
        rapatrie sans rien repayer — **et seulement si l'auteur le demande**.
        """
        en_souffrance = []
        for generation in self._base.recentes(500):
            if generation.clip is None or not generation.clip.prete_a_reprendre:
                continue
            if any(e.statut != Statut.REUSSIE for e in generation.emplacements):
                en_souffrance.append(generation)
        return en_souffrance

    # ── Commander ────────────────────────────────────────────────────────────

    async def commander(
        self,
        identifiant_modele: str,
        demande: DemandeClip,
        *,
        identifiant: str | None = None,
        projet: str | None = None,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        mouvement: str | None = None,
        lot: str = "",
        provenance: str = AUTEUR,
        attendre: bool = True,
        depart: str | None = None,
    ) -> Generation:
        """Commande un clip et rend la génération **dès que le travail est écrit**.

        L'attente se fait ensuite, en fond. L'appelant a déjà de quoi retrouver
        le clip : c'est tout l'intérêt de rendre si tôt.
        """
        # **Le catalogue avant tout**, et relu s'il ne l'a jamais été : un
        # modèle qu'on ne connaît pas se refuse ici, avant l'appel, et non chez
        # le fournisseur — où le refus se paierait peut-être.
        await self.a_jour()
        modele = self.modele(identifiant_modele)
        manque = indisponible_de(self._pour(modele))
        if manque:
            raise SansCle(manque)
        refus = modele.refus(demande, self.annonce(modele, demande))
        if refus:
            raise DemandeRefusee(f"{modele.nom} {refus}")

        prix = self.annonce(modele, demande)
        generation = Generation(
            identifiant=identifiant or uuid.uuid4().hex[:12],
            modele=modele.identifiant,
            demande={
                "prompt": demande.texte,
                "secondes": demande.secondes,
                "proportions": demande.proportions,
                "resolution": demande.resolution,
                "options": dict(demande.options),
                # **Le mouvement demandé, par son identifiant** (A6). Le texte
                # anglais est déjà dans `prompt` : ce qui manquait est de quoi
                # savoir, des mois plus tard, quelle entrée de la bibliothèque
                # l'a écrit — et c'est ce que le montage d'`A10` lira pour
                # nommer les bandes qu'il taillera dans ce clip.
                "mouvement": mouvement,
            },
            parametres_resolus=_resolus(modele, demande),
            emplacements=[Emplacement(rang=0)],
            projet=projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            provenance=provenance,
            clip=Clip(
                lot=lot,
                secondes=demande.secondes,
                proportions=demande.proportions,
                resolution=demande.resolution,
                prix_annonce=prix.montant,
                prix_formule=prix.formule,
                depart=depart or "",
            ),
        )
        # **Enregistré avant de partir.** Une coupure entre l'écriture et l'appel
        # laisse une commande sans travail, ce qui se lit ; dans l'autre ordre,
        # elle laisserait un travail payé que rien ne connaît.
        emplacement = generation.emplacements[0]
        animateur = self._pour(modele)
        if self._file_locale is not None and modele.de_la_maison:
            ancienne = self._base.lire(generation.identifiant)
            if ancienne and not self._file_locale.trouver("video:" + generation.identifiant):
                raise DemandeRefusee("Cet identifiant désigne déjà une autre génération.")
            moteur = self._inscrire_moteur_local(animateur)
            etape = self._file_locale.preparer("video:" + generation.identifiant, nature="video",
                moteur=moteur, modele=modele.identifiant, projet=projet, acteur=provenance,
                parametres={"generation": generation.identifiant, "demande": generation.demande,
                    "contexte": {"personnage": personnage, "pose": pose, "direction": direction,
                                 "lot": lot, "depart": depart}}, entree=demande.image)
            if ancienne:
                return ancienne
            self._sauver(generation)
            await self._file_locale.lancer(etape["identifiant"])
            return generation
        emplacement.statut = Statut.EN_COURS
        emplacement.demarre_le = time.time()
        emplacement.duree_attendue_s = self.attente_estimee(modele.identifiant)
        self._sauver(generation)

        animateur = self._pour(modele)
        try:
            travail = await animateur.soumettre(modele, demande)
        except ErreurAtelier as erreur:
            self._echouer(generation, erreur.raison, getattr(erreur, "consomme", 0.0))
            raise

        # **La ligne qui rend un clip rattrapable.** Écrite avant la première
        # seconde d'attente, et sauvée aussitôt.
        generation.clip.travail = travail
        self._sauver(generation)

        if attendre:
            tache = asyncio.create_task(self._attendre(generation.identifiant))
            self._en_vol.add(tache)
            tache.add_done_callback(self._en_vol.discard)
        return generation

    async def _executer_local(self, etape: dict[str, Any]) -> dict[str, Any]:
        """Exécuteur vidéo de la file commune ; les octets d'entrée sont figés."""
        generation = self._clip(etape["parametres"]["generation"])
        modele = self.modele(generation.modele)
        animateur = self._pour(modele)
        if self._inscrire_moteur_local(animateur) != etape["moteur"]:
            raise SuiviLocalInterrompu("L'adresse du moteur a changé. Rétablir le moteur de cette demande avant de reprendre.")
        if etape["travail_externe"]:
            generation.clip.travail = etape["travail_externe"]
            generation.clip.recupere = True
            self._sauver(generation)
        elif generation.clip.travail:
            self._file_locale.connaitre_externe(etape["identifiant"], generation.clip.travail)
        else:
            if self.avant_soumission_locale is not None:
                self.avant_soumission_locale(generation)
            d = etape["parametres"]["demande"]
            demande = DemandeClip(texte=d["prompt"], image=self._file_locale.entree(etape["identifiant"]),
                secondes=d["secondes"], proportions=d["proportions"], resolution=d["resolution"], options=d["options"])
            manque = indisponible_de(animateur)
            if manque:
                raise SansCle(manque)
            refus = modele.refus(demande, self.annonce(modele, demande))
            if refus:
                raise DemandeRefusee(refus)
            verifier = getattr(animateur, "verifier_preparation", None)
            if verifier is not None:
                await verifier(modele, demande)
            self._file_locale.engager(etape["identifiant"])
            generation.emplacements[0].statut = Statut.EN_COURS
            generation.emplacements[0].demarre_le = time.time()
            self._sauver(generation)
            try:
                numero = await animateur.soumettre(modele, demande)
            except Exception as erreur:
                raise AcceptationLocaleInconnue(f"Acceptation du calcul local incertaine : {erreur}") from erreur
            self._file_locale.connaitre_externe(etape["identifiant"], numero)
            generation.clip.travail = numero
            self._sauver(generation)
        termine = await self._attendre(generation.identifiant)
        if not termine:
            raise SuiviLocalInterrompu("Le moteur conserve peut-être le calcul. Reprendre le suivi avant de libérer sa place.")
        relue = self._clip(generation.identifiant)
        return {"generation": relue.identifiant, "reussie": relue.statut == Statut.REUSSIE,
                "raison": relue.emplacements[0].raison or relue.clip.extraction_refus or ""}

    # ── Récupérer — le geste de l'auteur, jamais de l'atelier ────────────────

    async def recuperer(self, identifiant: str) -> Generation:
        """Rapatrie un clip **déjà payé**. Ne commande rien, ne repaie rien.

        C'est le geste de US-438 : *récupérer un clip est un geste que je
        demande*. L'atelier ne rappelle jamais le fournisseur de lui-même — la
        règle *rien n'est jamais relancé automatiquement* vaut ici même si
        l'appel serait gratuit, parce que l'auteur doit rester celui qui décide
        quand son atelier parle à l'extérieur.
        """
        # **Le catalogue avant, et pour une seule raison** : c'est lui qui dit
        # quel animateur possède ce modèle. Depuis `A11` il y en a deux, et aller
        # chercher un clip de la maison chez le fournisseur payant rendrait un
        # refus qui parle de la mauvaise chose. L'appel est gratuit et déjà en
        # cache la seconde fois.
        await self.a_jour()
        if self._file_locale is not None:
            etape = self._file_locale.trouver("video:" + identifiant)
            if etape:
                await self._file_locale.lancer(etape["identifiant"], reprise=True)
                await self._file_locale.attendre_fin(etape["identifiant"])
                return self._clip(identifiant)
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)
        if generation.clip is None:
            raise ErreurAtelier("cette génération n'est pas un clip")
        if not generation.clip.prete_a_reprendre:
            raise ErreurAtelier(
                "ce clip n'a pas de numéro de travail — il n'y a rien à récupérer"
            )
        emplacement = generation.emplacements[0]
        if emplacement.statut == Statut.REUSSIE:
            return generation  # il est déjà là ; le redemander ne ferait rien

        emplacement.statut = Statut.EN_COURS
        emplacement.raison = None
        self._sauver(generation)
        generation.clip.recupere = True
        await self._encaisser(generation)
        return generation

    # ── Une vidéo qui vient d'ailleurs ───────────────────────────────────────

    def importer(
        self,
        octets: bytes,
        nom: str,
        *,
        projet: str | None = None,
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        provenance: str = AUTEUR,
        forcer: bool = False,
    ) -> dict[str, Any]:
        """Un fichier vidéo devient un clip du jeu. **Aucun appel, aucun coût.**

        **Le seul endroit du dépôt qui fasse entrer une vidéo**, sur le modèle
        exact de `ServiceGenerations.importer` pour une image : l'écran et
        l'agent passent tous les deux par ici, et c'est ce qui garde vraie la
        phrase « ce que l'agent peut faire, l'écran le peut aussi ».

        **Ce qui entre est un clip, pas une nouvelle sorte d'objet**, et c'est la
        décision de la tranche. Un clip payé porte déjà tout ce dont une vidéo
        importée a besoin : un fichier brut qu'on rejoue, des images tirées une
        fois pour toutes, un montage qui y taille des bandes, une fiche, et un
        prélèvement d'image qui entre en bibliothèque. Inventer un second objet
        aurait dédoublé les six écrans qui savent déjà lire celui-ci.

        **Sa nature dit d'où il vient** — `importe`, comme `rendu3d` le dit d'une
        séquence venue d'asset3d. C'est ce champ, et non le prix à zéro, qui
        permet à la fiche d'écrire *source importée — aucun nouvel appel* plutôt
        qu'un montant relu chez un fournisseur qui n'a jamais été appelé.

        ⚠️ **Un fichier illisible est refusé, et rien n'est gardé.** C'est la
        seule divergence avec un clip payé, et elle tient à l'argent : un clip
        payé dont l'extraction échoue reste un clip payé — on garde le fichier,
        on écrit pourquoi les images manquent. Ici rien n'a été dépensé, donc un
        fichier qu'on ne sait pas lire n'a aucune raison de rester sur le disque
        ni d'encombrer la liste des sources.
        """
        propre = nom.strip() or "la vidéo importée"
        if not octets:
            raise ImportRefuse(f"« {propre} » est vide")
        # **Le décodeur manquant est un fait de l'installation, pas un mauvais
        # fichier**, et sa phrase est déjà écrite en français pour être affichée
        # telle quelle. La dire ici évite de refuser « ce n'est pas une vidéo »
        # sur un fichier parfaitement valable.
        manque = decodeur.indisponible()
        if manque:
            raise ImportRefuse(manque)

        empreinte = empreinte_de(octets)
        if not forcer:
            deja = self._deja_importe(projet, empreinte)
            if deja is not None:
                return {"clip": None, "doublon": deja.en_json()}

        identifiant = uuid.uuid4().hex[:12]
        type_media = _type_media_de(propre)
        dossier = self._fichiers.dossier_images_clip(identifiant, 0)
        # **Le fichier est décodé depuis un dossier de passage, jamais depuis le
        # dépôt** — et ce détour est la condition du critère « un import refusé
        # ne laisse rien ». Mesuré sous Windows : quand le lecteur ne trouve pas
        # de décodeur pour ces octets-là, il **garde le fichier ouvert**, et le
        # dossier qui le contient devient alors impossible à effacer. Écrit dans
        # le dépôt, il y resterait ; écrit ici, il reste dans le dossier
        # temporaire du système, où il ne gêne personne.
        passage = Path(tempfile.mkdtemp(prefix="clip-importe-"))
        try:
            source = passage / f"source{_extension(type_media)}"
            source.write_bytes(octets)
            try:
                mesure = decodeur.extraire(source, dossier)
            except ValueError:
                # Le dossier d'images, lui, n'a aucun fichier ouvert : ce sont
                # des PNG refermés à l'écriture. Il s'efface donc vraiment.
                shutil.rmtree(dossier.parent, ignore_errors=True)
                # **Le message du lecteur ne franchit pas cette ligne**, comme
                # celui de Pillow au-dessus de `ServiceGenerations.importer`.
                # Mesuré à l'écran le 13 septembre 2026 : il est en anglais et
                # il nomme le **dossier de passage** du serveur — *Could not
                # find a backend to open C:\\…\\clip-importe-6x3qdcf6\\source.bin* —,
                # c'est-à-dire un chemin qui n'existe déjà plus quand l'auteur
                # le lit. Ce qui compte, et que le PRD demande, c'est **quel**
                # fichier pose problème.
                raise ImportRefuse(f"« {propre} » n'est pas une vidéo lisible") from None
        finally:
            shutil.rmtree(passage, ignore_errors=True)

        chemin = self._fichiers.ecrire_brut(
            identifiant, 0, octets, _extension(type_media)
        )
        generation = Generation(
            identifiant=identifiant,
            modele=IMPORT_VIDEO,
            # `empreinte` porte le doublon et `source` le nom du fichier, comme
            # pour une image importée : les deux vivent dans le `generation.json`
            # et survivent donc à l'effacement de l'index.
            demande={
                "prompt": nom,
                "source": nom,
                "empreinte": empreinte,
                "secondes": max(1, round(mesure.images / (mesure.cadence or 1))),
            },
            parametres_resolus={"modele": IMPORT_VIDEO, "source": nom},
            emplacements=[
                Emplacement(
                    rang=0,
                    statut=Statut.REUSSIE,
                    unite="secondes",
                    resultat=Resultat(
                        fichier=chemin,
                        largeur=mesure.largeur,
                        hauteur=mesure.hauteur,
                        type_media=type_media,
                        octets=len(octets),
                    ),
                )
            ],
            cree_le=time.time(),
            projet=projet,
            personnage=personnage,
            pose=pose,
            direction=direction,
            provenance=provenance,
            clip=Clip(
                nature="importe",
                images=mesure.images,
                cadence=mesure.cadence,
                secondes=max(1, round(mesure.images / (mesure.cadence or 1))),
                prix_annonce=0,
                prix_formule="Vidéo importée · aucun appel",
            ),
        )
        self._sauver(generation)
        return {"clip": generation.en_json(), "doublon": None}

    def _deja_importe(self, projet: str | None, empreinte: str) -> Generation | None:
        """La vidéo importée qui porte déjà ces octets-là, ou rien.

        Même portée et même critère qu'un import d'image : **dans ce projet**, et
        **sur les octets**. Deux vidéos visuellement proches sont deux vidéos.
        """
        for generation in self._base.generations_du_modele(IMPORT_VIDEO, projet):
            if generation.demande.get("empreinte") == empreinte:
                return generation
        return None

    # ── Garder celui-là, jeter les autres — un seul geste ────────────────────

    def garder(self, garde: str, jette: Iterable[str]) -> dict[str, Any]:
        """Un clip retenu, les autres écartés. **Un geste, et il se défait.**

        On lance quatre clips pour en avoir un bon ; les trois autres encombrent
        la galerie dès la minute suivante. Les écarter un par un serait trois
        gestes pour une seule décision — *c'est celui-là* —, et le produit
        écrirait trois fois ce qu'on a pensé une fois.

        **Ce qui a été payé reste payé.** Un clip écarté quitte la galerie ; il
        ne quitte ni le journal, ni le total du projet, ni l'écran des dépenses.
        C'est le premier invariant du produit, et c'est ici qu'il compte le
        plus : un lot de quatre clips coûte quatre fois le prix d'un, et un
        auteur qui n'en verrait plus qu'un au journal croirait avoir payé une
        fois.

        **Rien n'expire.** Contrairement à l'image jetée, dont les octets
        s'effacent après quelques secondes, le clip écarté est toujours là :
        `rendre` le remontre quand on veut, et le bandeau d'annulation n'a
        aucun compte à rebours à afficher.

        Le clip gardé est ramené au jour s'il ne l'était pas — garder un clip
        qu'on avait écarté est le même geste, dans l'autre sens.
        """
        touches: list[Generation] = []
        garde_la = self._clip(garde)
        if garde_la.clip.jete:
            garde_la.clip.jete = False
            touches.append(garde_la)
        jetes: list[Generation] = []
        for identifiant in jette:
            if identifiant == garde:
                # Se jeter soi-même n'est pas une décision, c'est une
                # contradiction : on garde celui-là, donc on ne le jette pas.
                continue
            autre = self._clip(identifiant)
            if not autre.clip.jete:
                autre.clip.jete = True
                touches.append(autre)
            jetes.append(autre)
        for generation in touches:
            self._sauver(generation)
        return {
            "garde": garde_la.en_json(),
            "jetes": [g.en_json() for g in jetes],
        }

    def rendre(self, identifiants: Iterable[str]) -> list[Generation]:
        """Remontrer des clips écartés. **L'annulation du geste d'au-dessus.**

        Elle ne rapatrie rien et ne repaie rien : les clips n'étaient pas
        partis, ils étaient rangés.
        """
        rendus = []
        for identifiant in identifiants:
            generation = self._clip(identifiant)
            if generation.clip.jete:
                generation.clip.jete = False
                self._sauver(generation)
            rendus.append(generation)
        return rendus

    def _clip(self, identifiant: str) -> Generation:
        """La génération de ce clip, ou le refus qui dit laquelle manque."""
        generation = self._base.lire(identifiant)
        if generation is None:
            raise GenerationInconnue(identifiant)
        if generation.clip is None:
            raise ErreurAtelier("cette génération n'est pas un clip")
        return generation

    async def attendre_tout(self) -> None:
        """Jusqu'à ce que plus rien ne tourne. Pour les essais et les scripts."""
        while self._en_vol:
            await asyncio.gather(*tuple(self._en_vol), return_exceptions=True)
        if self._file_locale is not None:
            await self._file_locale.attendre_tout()

    async def suivre(self, identifiant: str, *, reprise: bool = False) -> Generation:
        """Suit ce seul numéro externe, pendant l'attente bornée habituelle.

        Pour l'orchestrateur durable qui a commandé avec ``attendre=False``.
        Une reprise consulte le même travail ; elle ne soumet aucune vidéo.
        """
        await self.a_jour()
        if self._file_locale is not None:
            etape = self._file_locale.trouver("video:" + identifiant)
            if etape:
                await self._file_locale.lancer(etape["identifiant"], reprise=reprise)
                await self._file_locale.attendre_fin(etape["identifiant"])
                return self._clip(identifiant)
        generation = self._clip(identifiant)
        if not generation.clip.travail:
            raise ErreurAtelier("ce clip n'a pas de numéro de travail à suivre")
        if generation.statut != Statut.REUSSIE:
            await self._attendre(identifiant)
        return self._clip(identifiant)

    def etape_locale(self, identifiant: str) -> dict[str, Any] | None:
        return self._file_locale.trouver("video:" + identifiant) if self._file_locale is not None else None

    # ── L'attente et l'encaissement ──────────────────────────────────────────

    async def _attendre(self, identifiant: str) -> bool:
        """Regarde où en est le travail, jusqu'à ce qu'il aboutisse ou trop tarde."""
        generation = self._base.lire(identifiant)
        if generation is None or generation.clip is None:  # pragma: no cover
            return False
        animateur = self._pour_la_generation(generation)
        travail = generation.clip.travail
        reste = ATTENTE_MAX
        while True:
            try:
                etat = await animateur.etat(travail)
            except ErreurAtelier as erreur:
                self._echouer(
                    generation, erreur.raison, getattr(erreur, "consomme", 0.0)
                )
                return False
            if etat.fini or etat.echoue:
                break
            if reste <= 0:
                # **Ni un échec ni une perte.** Le clip se fabrique encore et
                # sera facturé ; ce qui s'arrête ici, c'est l'attente. Le statut
                # dit « interrompue » — celui d'un travail qui attend un geste —
                # et non « échouée », qui voudrait dire que la réponse est non.
                self._interrompre(
                    generation,
                    f"le clip n'est pas arrivé en {ATTENTE_MAX / 60:.0f} minutes — "
                    "il se fabrique peut-être encore, et « récupérer » ira le chercher",
                )
                return False
            await asyncio.sleep(CADENCE_ATTENTE)
            reste -= CADENCE_ATTENTE
        await self._encaisser(generation)
        return True

    async def _encaisser(self, generation: Generation) -> None:
        """Le clip, son montant, son fichier, ses images — **dans cet ordre**.

        L'ordre est le fond de la tranche. Le montant d'abord : un clip payé
        dont le fichier est illisible ou dont l'extraction échoue **reste un
        clip payé**, et le journal du projet doit le porter. Écrire le montant
        après la mesure ferait disparaître exactement les dépenses qu'on
        cherchera à expliquer.
        """
        emplacement = generation.emplacements[0]
        depart = emplacement.demarre_le or time.time()
        animateur = self._pour_la_generation(generation)
        try:
            produit = await animateur.recuperer(generation.clip.travail)
        except ErreurAtelier as erreur:
            self._echouer(
                generation, erreur.raison, getattr(erreur, "consomme", 0.0),
                getattr(erreur, "unite", USD),
            )
            return

        # 1. Ce que l'appel a consommé. Rien ne passe avant.
        emplacement.consomme = produit.consomme
        emplacement.unite = produit.unite
        generation.clip.montant_relu = produit.montant_relu
        emplacement.duree_s = round(max(time.time() - depart, 0.0), 2)
        self._sauver(generation)

        # 2. Le fichier tel qu'il est arrivé.
        chemin = self._fichiers.ecrire_brut(
            generation.identifiant, emplacement.rang, produit.octets,
            _extension(produit.type_media),
        )
        emplacement.resultat = Resultat(
            fichier=chemin,
            # **Zéro jusqu'à la mesure, et zéro pour de bon si le décodeur
            # manque.** Les dimensions demandées ne font pas foi, ici comme
            # ailleurs : ce qui s'écrit est ce qu'on a lu sur le fichier.
            largeur=0,
            hauteur=0,
            type_media=produit.type_media or "application/octet-stream",
            octets=len(produit.octets),
        )
        emplacement.statut = Statut.REUSSIE
        self._sauver(generation)

        # 3. Les images, une fois et plus jamais. Un échec ici ne défait rien.
        self._tirer_les_images(generation)

    def _tirer_les_images(self, generation: Generation) -> None:
        """Décode le clip et range ses images. **Ne fait jamais échouer le clip.**

        Le décodeur est optionnel (`atelier/image/clip.py`), et son absence est
        un fait de l'installation, pas un raté de l'appel. Un clip payé dont les
        images ne sont pas encore tirées reste un clip réussi qui dit ce qui
        manque ; installer le décodeur et redemander suffit.
        """
        emplacement = generation.emplacements[0]
        if emplacement.resultat is None:  # pragma: no cover — appelé après l'écriture
            return
        source = Path(self._fichiers.racine) / emplacement.resultat.fichier
        dossier = self._fichiers.dossier_images_clip(
            generation.identifiant, emplacement.rang
        )
        try:
            mesure = decodeur.extraire(source, dossier)
        except ValueError as erreur:
            generation.clip.extraction_refus = str(erreur)
            self._sauver(generation)
            return

        generation.clip.images = mesure.images
        generation.clip.cadence = mesure.cadence
        generation.clip.extraction_refus = None
        emplacement.resultat.largeur = mesure.largeur
        emplacement.resultat.hauteur = mesure.hauteur
        self._sauver(generation)

    # ── Les issues qui ne sont pas une réussite ──────────────────────────────

    def _echouer(
        self,
        generation: Generation,
        raison: str,
        consomme: float = 0.0,
        unite: str = USD,
    ) -> None:
        """Un clip raté garde ce qu'il a consommé (US-24), et son numéro de travail.

        Le numéro reste parce qu'un échec de téléchargement n'est pas un échec
        de fabrication : le clip existe chez le fournisseur, il a été facturé, et
        « récupérer » ira le chercher.

        **Additionné, jamais écrasé** (B2) : un rapatriement qui échoue une
        seconde fois — le lien a expiré, par exemple — rend le plus souvent
        `consomme=0.0`, puisque rien n'a été refacturé. Écraser effacerait la
        première facture au lieu de ne rien y ajouter, et un clip payé
        disparaîtrait du journal des dépenses au moment précis où l'écran est
        censé le montrer.
        """
        emplacement = generation.emplacements[0]
        emplacement.statut = Statut.ECHOUEE
        emplacement.raison = raison
        emplacement.consomme += consomme
        emplacement.unite = unite
        self._sauver(generation)

    def _interrompre(self, generation: Generation, raison: str) -> None:
        emplacement = generation.emplacements[0]
        emplacement.statut = Statut.INTERROMPUE
        emplacement.raison = raison
        self._sauver(generation)

    # ── Mesures et écriture ──────────────────────────────────────────────────

    def attente_estimee(self, identifiant_modele: str) -> float:
        """Ce que ce modèle a réellement mis les fois précédentes, ou rien.

        Même règle que pour les images : **aucun taux d'avancement n'est
        inventé**. Un fournisseur vidéo ne rend pas d'avancement intermédiaire ;
        la jauge se trace sur l'instant du départ et sur ce qui a été mesuré.
        """
        durees = self._base.durees_mesurees(identifiant_modele)
        return round(sum(durees) / len(durees), 1) if durees else 0.0

    def _sauver(self, generation: Generation) -> None:
        """Au fil de l'eau. **Écrire d'abord, annoncer ensuite** — voir
        `ServiceGenerations._sauver`, c'est le même contrat."""
        contenu = generation.en_json()
        self._fichiers.ecrire_enregistrement(generation.identifiant, contenu)
        self._base.enregistrer(generation)
        self._diffusion.publier("generation", contenu)


# ── Traductions ──────────────────────────────────────────────────────────────


def _resolus(modele: ModeleVideo, demande: DemandeClip) -> dict[str, Any]:
    """Ce qui part réellement — en vocabulaire du produit, pas en JSON HTTP.

    **L'image de départ est comptée, pas recopiée** : un `generation.json` doit
    rester lisible à l'œil, et des mégaoctets de base64 dans un journal ne le
    sont pas. Elle est dite « obligatoire » plutôt que « 1 image » parce que
    c'est ce qui la distingue d'une référence, et que c'est la distinction que
    la tranche instaure.
    """
    return {
        "modele": modele.identifiant,
        "secondes": demande.secondes,
        "proportions": demande.proportions,
        "resolution": demande.resolution,
        "image_de_depart": "obligatoire, jointe",
        "son": False,
        "options": dict(demande.options),
    }


def _modele_en_json(modele: ModeleVideo) -> dict[str, Any]:
    return {
        **({"indisponible": modele.indisponible} if modele.indisponible else {}),
        **({"options": {n: {"nom": o.nom, "genre": o.genre, "valeurs": list(o.valeurs), "minimum": o.minimum, "maximum": o.maximum} for n, o in modele.options.items()}} if modele.options else {}),
        "identifiant": modele.identifiant,
        "nom": modele.nom,
        "fournisseur": modele.fournisseur,
        "durees": list(modele.durees),
        "resolutions": list(modele.resolutions),
        "proportions": list(modele.proportions),
        # **Ce que ce dépôt a mesuré, et rien d'autre.** Vide veut dire « on n'en
        # sait rien », et l'écran l'écrit plutôt que de laisser croire.
        "mesure": modele.mesure,
        # ── Ce qu'`A11` ajoute, et qui vaut zéro chez un payant ──────────────
        #
        # Écrit pour tous plutôt que pour le seul local : un champ qui n'existe
        # que sur certains modèles oblige l'écran à savoir lesquels, et c'est un
        # savoir qui se périme. Zéro ou vide se lit « la question ne se pose pas
        # pour celui-ci ».
        "de_la_maison": modele.de_la_maison,
        "images_par_seconde": modele.images_par_seconde,
        "duree_conseillee": modele.duree_conseillee,
        "raison_de_la_duree": modele.raison_de_la_duree,
        # Le compte réel pour chaque durée proposée. **Calculé au serveur**, parce
        # que la règle `4n + 1` est une contrainte du modèle et n'a rien à faire
        # dans une interface — et que deux endroits qui la calculent finiraient
        # par ne plus donner le même nombre.
        "images_par_duree": {
            str(duree): modele.images_reelles(duree) for duree in modele.durees
        }
        if modele.images_par_seconde
        else {},
    }


def _extension(type_media: str | None) -> str:
    """L'extension à donner au fichier brut, d'après son type de média.

    `.bin` pour un type inconnu, et c'est voulu : le fichier est gardé tel qu'il
    est arrivé, sans qu'on lui prête une extension qu'on ne sait pas justifier.
    """
    for fin, type_connu in TYPES_VIDEO.items():
        if type_connu == type_media:
            return fin
    return ".bin"


def _type_media_de(nom: str) -> str:
    """Le type de média d'un fichier importé, lu sur son nom.

    Inconnu, le fichier part quand même chez le décodeur — c'est **lui** qui dit
    si les octets sont une vidéo, et il le fera avant qu'aucun clip n'existe. Ce
    qui s'écrit alors est le type générique : mieux vaut un lecteur qui refuse un
    fichier que le produit dise ne pas connaître, qu'un `video/mp4` inventé sur
    une extension qui disait autre chose.
    """
    return TYPES_VIDEO.get(Path(nom).suffix.lower(), "application/octet-stream")


def _date_de(instant: float) -> str:
    if not instant:
        return ""
    return time.strftime("%Y-%m-%d", time.localtime(instant))
