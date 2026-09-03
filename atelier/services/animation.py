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
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from atelier.depot import Base, Fichiers
from atelier.domaine.animation import (
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
from atelier.services.evenements import Diffusion
from atelier.services.fournisseurs import indisponible_de

Fabrique = Callable[[], PortAnimateur]

# Entre deux coups d'œil chez le fournisseur pendant l'attente. Ces appels ne
# coûtent rien ; ils ne servent à rien non plus plus souvent que ça, devant une
# attente de deux minutes.
CADENCE_ATTENTE = 5.0
# Au-delà, le service rend la main. **Le clip n'est pas perdu pour autant** : il
# continue de se fabriquer chez le fournisseur et sera facturé, et le numéro du
# travail permet d'aller le chercher. Mesuré au pire à 301 s le 2 septembre 2026.
ATTENTE_MAX = 900.0


class ServiceAnimation:
    """Le catalogue vidéo, la commande d'un clip, et sa reprise."""

    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        animateur: Fabrique,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        # **Une fabrique, pas une instance** — la règle de T1, telle quelle : la
        # clé se relit à chaque appel, jamais au démarrage, pour qu'on puisse la
        # déposer sans redémarrer le serveur.
        self._animateur = animateur
        self._diffusion = diffusion or Diffusion()
        self._modeles: list[ModeleVideo] = []
        self._recu_le: float = 0.0
        self._raison: str | None = None
        self._en_vol: set[asyncio.Task[None]] = set()

    # ── Le catalogue vidéo ───────────────────────────────────────────────────

    async def rafraichir(self) -> list[ModeleVideo]:
        """Relit les modèles vidéo. **Ne lève jamais**, comme le catalogue d'images.

        « L'échec survient au moment où on génère, jamais au démarrage »
        (US-95). Sans réseau, la liste précédente reste servie et la raison
        s'affiche à côté ; sans liste du tout, la liste est vide et dit pourquoi.
        L'atelier s'ouvre dans tous les cas.
        """
        try:
            self._modeles = await self._animateur().catalogue_video()
            self._recu_le = time.time()
            self._raison = None
        except ErreurAtelier as erreur:
            self._raison = erreur.raison
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

    def etat(self) -> dict[str, Any]:
        """De quoi peindre l'écran : les modèles, la date de la photo, la panne."""
        return {
            "modeles": [_modele_en_json(m) for m in self.modeles()],
            "recu_le": self._recu_le,
            "raison": self._raison,
            "manque": indisponible_de(self._animateur()),
            # **Le décodeur est un fait de l'installation, pas du fournisseur.**
            # Il vaut la peine d'être ici : sans lui, un clip s'achète et se
            # garde, mais ses images attendent, et l'écran doit le dire avant
            # qu'on paie plutôt qu'après.
            "decodeur": decodeur.indisponible(),
        }

    def grise(self, modele: ModeleVideo, demande: DemandeClip) -> str | None:
        """Pourquoi ce modèle ne peut pas partir maintenant, ou `None`.

        Deux sources et elles ne se recouvrent pas : ce qui manque au
        fournisseur — sa clé —, et ce que le modèle ne sait pas faire. La
        première grise tous ses modèles, la seconde celui-là seulement.
        """
        manque = indisponible_de(self._animateur())
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
        provenance: str = AUTEUR,
        attendre: bool = True,
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
        manque = indisponible_de(self._animateur())
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
            },
            parametres_resolus=_resolus(modele, demande),
            emplacements=[Emplacement(rang=0)],
            projet=projet,
            personnage=personnage,
            pose=pose,
            provenance=provenance,
            clip=Clip(
                secondes=demande.secondes,
                proportions=demande.proportions,
                resolution=demande.resolution,
                prix_annonce=prix.montant,
                prix_formule=prix.formule,
            ),
        )
        # **Enregistré avant de partir.** Une coupure entre l'écriture et l'appel
        # laisse une commande sans travail, ce qui se lit ; dans l'autre ordre,
        # elle laisserait un travail payé que rien ne connaît.
        emplacement = generation.emplacements[0]
        emplacement.statut = Statut.EN_COURS
        emplacement.demarre_le = time.time()
        emplacement.duree_attendue_s = self.attente_estimee(modele.identifiant)
        self._sauver(generation)

        animateur = self._animateur()
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

    # ── Récupérer — le geste de l'auteur, jamais de l'atelier ────────────────

    async def recuperer(self, identifiant: str) -> Generation:
        """Rapatrie un clip **déjà payé**. Ne commande rien, ne repaie rien.

        C'est le geste de US-438 : *récupérer un clip est un geste que je
        demande*. L'atelier ne rappelle jamais le fournisseur de lui-même — la
        règle *rien n'est jamais relancé automatiquement* vaut ici même si
        l'appel serait gratuit, parce que l'auteur doit rester celui qui décide
        quand son atelier parle à l'extérieur.
        """
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

    async def attendre_tout(self) -> None:
        """Jusqu'à ce que plus rien ne tourne. Pour les essais et les scripts."""
        while self._en_vol:
            await asyncio.gather(*tuple(self._en_vol), return_exceptions=True)

    # ── L'attente et l'encaissement ──────────────────────────────────────────

    async def _attendre(self, identifiant: str) -> None:
        """Regarde où en est le travail, jusqu'à ce qu'il aboutisse ou trop tarde."""
        animateur = self._animateur()
        generation = self._base.lire(identifiant)
        if generation is None or generation.clip is None:  # pragma: no cover
            return
        travail = generation.clip.travail
        reste = ATTENTE_MAX
        while True:
            try:
                etat = await animateur.etat(travail)
            except ErreurAtelier as erreur:
                self._echouer(
                    generation, erreur.raison, getattr(erreur, "consomme", 0.0)
                )
                return
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
                return
            await asyncio.sleep(CADENCE_ATTENTE)
            reste -= CADENCE_ATTENTE
        await self._encaisser(generation)

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
        animateur = self._animateur()
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
        """
        emplacement = generation.emplacements[0]
        emplacement.statut = Statut.ECHOUEE
        emplacement.raison = raison
        emplacement.consomme = consomme
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
        "identifiant": modele.identifiant,
        "nom": modele.nom,
        "fournisseur": modele.fournisseur,
        "durees": list(modele.durees),
        "resolutions": list(modele.resolutions),
        "proportions": list(modele.proportions),
        # **Ce que ce dépôt a mesuré, et rien d'autre.** Vide veut dire « on n'en
        # sait rien », et l'écran l'écrit plutôt que de laisser croire.
        "mesure": modele.mesure,
    }


def _extension(type_media: str | None) -> str:
    return {"video/mp4": ".mp4", "video/webm": ".webm"}.get(type_media or "", ".bin")


def _date_de(instant: float) -> str:
    if not instant:
        return ""
    return time.strftime("%Y-%m-%d", time.localtime(instant))
