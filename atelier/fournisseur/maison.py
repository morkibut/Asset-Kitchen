# -*- coding: utf-8 -*-
"""Le moteur de la maison — **animer sur sa propre carte, et ne rien payer**.

Arrivé en A11 (V3). C'est le second animateur du produit, à côté de celui
d'OpenRouter, et il répond au **même port** : on soumet, on attend, on récupère.
Ce qui change n'est pas la mécanique, c'est l'unité de ce que ça coûte — **du
temps au lieu de l'argent** — et le fait que ce qui manque puisse se réparer.

## Ce que cet adaptateur est, et ce qu'il n'est pas

Il parle à un **ComfyUI déjà installé**, par son interface HTTP, sur le port
8188. Il n'est ni un second atelier, ni un éditeur de montages, et surtout :

> ⚠️ **Il ne modifie jamais l'installation de ComfyUI.** Ni paquet, ni réglage,
> ni nœud. C'est une règle de la tranche, et elle vient d'une panne payée le
> 3 septembre 2026 : le chargeur d'encodeur compressé réclamait une version de
> `protobuf` plus récente que celle installée, laquelle est **exigée par les
> paquets du générateur de bruitages**. Mettre à jour aurait gagné 2,4 Go de
> disque et risqué de casser le son. *Le produit s'adapte à ce qu'il trouve.*

La seule chose qu'il écrive chez ComfyUI est **des fichiers de modèle**, dans le
dossier que ComfyUI lui-même déclare, et seulement quand l'auteur le demande.
Ajouter un poids n'est pas modifier une installation : c'est ce que le
gestionnaire de ComfyUI fait lui-même, et rien d'autre ne bouge.

## Les trois absences, et pourquoi elles ne sont pas la même

Le motif est déjà écrit et éprouvé — `etat_des_silhouettes` pour les moteurs de
détourage (`U13`). Il se reprend tel quel, avec trois raisons distinctes :

| Ce qui manque | Le modèle est | Pourquoi cette différence |
|---|---|---|
| ComfyUI n'est pas lancé | **grisé** | rien ne peut partir, et l'atelier ne sait pas allumer une fenêtre à la place de l'auteur |
| Les fichiers ne sont pas descendus | **choisissable** | l'atelier sait les rapatrier ; refuser obligerait à sortir pour un téléchargement qu'il sait faire |
| Le greffon pixel art manque | **choisissable** | le clip sortira, il sortira lissé ; un clip lissé se juge, un refus ne se juge pas |

**Confondre les trois** ferait sortir de l'atelier pour rien, ou laisserait
tomber une attente de plusieurs minutes sur un geste annoncé comme immédiat.

## Ce qu'un téléchargement de neuf gigaoctets apprend

⚠️ **Il se coupe, et le dire n'est pas automatique.** Deux se sont interrompus en
silence le 3 septembre 2026 : le fichier était là, incomplet, et ressemblait à
un fichier absent. On compare donc toujours la taille obtenue à celle que le
serveur annonce, et on reprend — **jamais supposer qu'un fichier présent est un
fichier complet**.
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable

import httpx

from atelier.domaine.animation import (
    MAISON,
    DemandeClip,
    ModeleVideo,
    Tarification,
    taille_demandee,
)
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible
from atelier.domaine.secret import Secret
from atelier.fournisseur.montage_maison import (
    CADENCE,
    GREFFON_PIXEL,
    montage_du_clip,
    sans_greffon_pixel,
)
from atelier.fournisseur.port import ClipProduit, EtatTravail

# ── Où ComfyUI écoute ────────────────────────────────────────────────────────
#
# Le port par défaut de ComfyUI, et il ne se règle pas ici : le produit ne
# choisit pas où une application tierce écoute. `ATELIER_COMFY` le déplace pour
# ceux qui l'ont déplacé, et c'est tout ce que le produit a à en savoir.
BASE_PAR_DEFAUT = "http://127.0.0.1:8188"

NOM = "Maison"
MODELE = "maison/wan-2.2-i2v-14b-pixel"

DELAI_COURT = 10.0
DELAI_MOYEN = 60.0
DELAI_LONG = 300.0

GO = 1024**3



# ── Ce qu'il faut avoir sur le disque ────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class FichierDeModele:
    """Un fichier que le montage nomme, **avec sa taille et sa licence**.

    La licence est ici et pas ailleurs parce que c'est une question qu'on se pose
    **avant** de télécharger, jamais après : ce qui descend ici finira dans un
    jeu vendu, et Apache 2.0 est ce qui l'autorise. Un fichier dont la licence ne
    permettrait pas l'usage commercial n'aurait rien à faire dans cette liste.

    `taille_annoncee` est ce que ce dépôt a relevé chez l'hébergeur. **Elle sert
    à écrire la phrase avant le téléchargement**, pas à vérifier quoi que ce
    soit : la vérification se fait sur ce que le serveur annonce au moment même,
    parce qu'un fichier peut être réédité.
    """

    nom: str
    famille: str  # le dossier de modèles chez ComfyUI : loras, vae, …
    adresse: str
    taille_annoncee: int
    licence: str = "Apache 2.0"
    # Faux pour le greffon pixel art : son absence n'empêche pas de tirer, elle
    # change ce qui sort. C'est la troisième absence de la tranche.
    obligatoire: bool = True

    @property
    def go(self) -> float:
        return round(self.taille_annoncee / GO, 2)

    def en_json(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "famille": self.famille,
            "go": self.go,
            "licence": self.licence,
            "obligatoire": self.obligatoire,
        }


_QUANT = "https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF/resolve/main"
_COMFY22 = (
    "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files"
)
_COMFY21 = (
    "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files"
)
_STYLY = "https://huggingface.co/styly-agents/Wan2-2-pixel-animate/resolve/main"

# Les sept fichiers, dans l'ordre où ils comptent. Les tailles sont celles
# relevées le 3 septembre 2026 chez l'hébergeur.
FICHIERS: tuple[FichierDeModele, ...] = (
    FichierDeModele(
        nom="Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
        famille="diffusion_models",
        adresse=f"{_QUANT}/HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
        taille_annoncee=int(8.7 * GO),
    ),
    FichierDeModele(
        nom="Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf",
        famille="diffusion_models",
        adresse=f"{_QUANT}/LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf",
        taille_annoncee=int(8.7 * GO),
    ),
    FichierDeModele(
        nom="umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        famille="text_encoders",
        adresse=f"{_COMFY22}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        taille_annoncee=int(6.3 * GO),
    ),
    FichierDeModele(
        nom="wan_2.1_vae.safetensors",
        famille="vae",
        adresse=f"{_COMFY21}/vae/wan_2.1_vae.safetensors",
        taille_annoncee=int(0.25 * GO),
    ),
    FichierDeModele(
        nom="wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
        famille="loras",
        adresse=f"{_COMFY22}/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
        taille_annoncee=int(0.6 * GO),
    ),
    FichierDeModele(
        nom="wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
        famille="loras",
        adresse=f"{_COMFY22}/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
        taille_annoncee=int(0.6 * GO),
    ),
    FichierDeModele(
        nom=GREFFON_PIXEL,
        famille="loras",
        adresse=f"{_STYLY}/{GREFFON_PIXEL}",
        taille_annoncee=int(1.4 * GO),
        # **Le seul qui ne soit pas obligatoire**, et le seul qui compte
        # vraiment : c'est lui qui fait dessiner de vrais sprites plutôt qu'un
        # rendu lissé. Sans lui le clip sort quand même — l'écran le dit.
        obligatoire=False,
    ),
)

# Le chargeur ComfyUI qui voit chaque famille, et le champ où il liste ce qu'il
# voit. **La seule preuve d'installation** : un fichier posé dans un dossier que
# ComfyUI ne lit pas est un fichier absent, et le disque ne le dirait pas.
CHARGEURS = {
    "diffusion_models": ("UnetLoaderGGUF", "unet_name"),
    "text_encoders": ("CLIPLoader", "clip_name"),
    "vae": ("VAELoader", "vae_name"),
    "loras": ("LoraLoaderModelOnly", "lora_name"),
}


# ── Ce que l'écran a besoin de savoir avant de choisir ───────────────────────


@dataclass(frozen=True, slots=True)
class EtatDuMoteur:
    """Les trois absences, dites séparément et jamais mélangées."""

    allume: bool
    # La raison qui grise le modèle, ou `None`. **Seule la première absence
    # grise** : les deux autres se réparent depuis l'atelier.
    grise: str | None = None
    manquants: tuple[FichierDeModele, ...] = ()
    greffon_absent: bool = False
    carte: str = ""
    memoire_libre: int = 0

    @property
    def a_telecharger(self) -> int:
        return sum(f.taille_annoncee for f in self.manquants)

    @property
    def phrase(self) -> str:
        """Ce que l'écran écrit, et il n'écrit jamais deux de ces phrases."""
        if not self.allume:
            return "le moteur de la maison n'est pas allumé — ouvrez ComfyUI"
        if self.manquants:
            go = round(self.a_telecharger / GO, 1)
            return f"il manque {_virgule(go)} Go de modèles"
        if self.greffon_absent:
            return "le greffon pixel art est absent : le clip sortira lissé"
        return ""

    def en_json(self) -> dict[str, Any]:
        return {
            "allume": self.allume,
            "grise": self.grise,
            "phrase": self.phrase,
            "manquants": [f.en_json() for f in self.manquants],
            "go_a_telecharger": round(self.a_telecharger / GO, 1),
            "greffon_absent": self.greffon_absent,
            "carte": self.carte,
            "memoire_libre_go": round(self.memoire_libre / GO, 1),
        }


def _virgule(valeur: float) -> str:
    return f"{valeur:g}".replace(".", ",")


# ── Ce que ce dépôt a mesuré du moteur ───────────────────────────────────────

MESURE = (
    "Mesuré le 3 septembre 2026 sur une RTX 3080 Laptop bridée à 100 W : 6,0 Go "
    "de mémoire pris sur 6,92 disponibles, 130 s pour une seconde de clip, et un "
    "fond qui reste détourable — il dérive de 3 niveaux là où le payant dérive de "
    "20. Sur les deux lignes qui décident du détourage, le local est meilleur."
)

RAISON_DE_LA_DUREE = (
    "Une seconde donne une bande nettement plus propre que deux, et deux plus "
    "propre que trois : le greffon a été entraîné par paquets de 8 à 32 images, "
    "et au-delà il travaille hors de son terrain. ⚠️ Aucune mesure automatique ne "
    "voit cette dégradation — seul l'œil la voit."
)


def modele_de_la_maison() -> ModeleVideo:
    """Le seul modèle de ce fournisseur, et il est écrit ici plutôt que relu.

    **C'est l'exception assumée à *le catalogue décide*.** Cette règle parle de
    ce qu'un fournisseur déclare de ses modèles ; ici il n'y a pas de
    fournisseur, il y a une carte graphique et un montage que le produit écrit
    lui-même. Ce qui est relu chez ComfyUI est **ce qui est installé** — la seule
    chose qu'il sache dire, et la seule qui change.
    """
    return ModeleVideo(
        identifiant=MODELE,
        nom="Wan 2.2 pixel — la carte de la maison",
        fournisseur=NOM,
        chez_lui=MODELE,
        durees=(1, 2, 3),
        resolutions=("480p",),
        proportions=("1:1",),
        accepte_une_image=True,
        mesure=MESURE,
        tarification=Tarification(
            genre=MAISON,
            montant=0.0,
            libelle="gratuit — la carte de la maison",
        ),
        images_par_seconde=CADENCE,
        pas_d_images=4,
        # Premier tirage puis les suivants : le modèle reste chargé entre deux
        # clips. Relevé le 3 septembre 2026.
        secondes_par_image=(7.6, 4.7),
        duree_conseillee=1,
        raison_de_la_duree=RAISON_DE_LA_DUREE,
    )


# ── L'adaptateur ─────────────────────────────────────────────────────────────


class MoteurDeLaMaison:
    """Les quatre gestes du port, sur une carte graphique au lieu d'un compte.

    ⚠️ **Cet adaptateur se garde, il ne se refabrique pas** — voir `_maison()`
    dans `atelier/services/__init__.py`. Deux choses qu'il retient n'ont de sens
    que dans la durée : ce que la dernière visite a vu, qui dit *pourquoi* le
    modèle est grisé, et le fait qu'un clip soit déjà parti, qui dit si le
    prochain paie le chargement du modèle. Sur une instance jetée après chaque
    appel, la première **ne grise plus jamais rien** et la seconde annonce
    *premier tirage* toute la journée.

    Le rafraîchir reste le geste de qui l'appelle : `catalogue_video` revisite à
    chaque relecture du catalogue, et la route de l'écran revisite à chaque
    peinture. Garder l'objet ne veut pas dire garder sa réponse.
    """

    nom = NOM

    def __init__(
        self,
        base: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base = (base or BASE_PAR_DEFAUT).rstrip("/")
        # **Le seul point d'entrée des essais, et il n'en existe pas d'autre.**
        # ComfyUI est une application tierce : on ne peut ni la démarrer dans un
        # essai, ni compter sur sa présence. Le double se branche donc ici, et
        # tout le reste du fichier — la construction des requêtes, la lecture des
        # réponses, la reprise d'un téléchargement — est exercé pour de vrai.
        # C'est là que vivent les défauts ; l'échange d'octets, lui, est déjà
        # éprouvé par `httpx`.
        self._transport = transport
        self._client_id = f"atelier-{uuid.uuid4().hex[:8]}"
        # Ce que la dernière visite a vu, et **la seule source du grisé** :
        # `indisponible()` est appelé à chaque peinture d'écran, et interroger
        # ComfyUI à chaque fois ferait attendre l'interface pour une réponse qui
        # ne change pas d'une seconde à l'autre.
        self._etat: EtatDuMoteur | None = None
        # **Un fait de la séance.** Le premier tirage paie le chargement du
        # modèle — ≈ 7,6 s par image contre ≈ 4,7 s ensuite —, et l'écran doit
        # dire lequel des deux il annonce. ⚠️ Il reste une approximation : un
        # redémarrage de ComfyUI décharge le modèle et l'atelier ne le voit pas.
        # C'est écrit dans la phrase que l'écran affiche — une attente s'annonce
        # « environ », comme un prix.
        self._deja_tire = False

    @property
    def premier_tirage(self) -> bool:
        """Vrai tant qu'aucun clip local n'est parti dans cette séance."""
        return not self._deja_tire

    # ── Ce que le produit demande à tout fournisseur ─────────────────────────

    def secrets(self) -> tuple[Secret, ...]:
        """Aucun. **C'est le seul fournisseur du produit sans compte ni clé**, et
        c'est la moitié de son intérêt."""
        return ()

    def indisponible(self) -> str | None:
        """La raison qui grise **tous** ses modèles — il n'en a qu'un.

        Lue sur la dernière visite plutôt que par un appel : ce geste est appelé
        à chaque peinture d'écran, et interroger ComfyUI à chaque fois ferait
        attendre l'interface pour une réponse qui ne change pas d'une seconde à
        l'autre. La visite, elle, a lieu au rafraîchissement du catalogue.
        """
        return self._etat.grise if self._etat else None

    def etat_du_moteur(self) -> EtatDuMoteur:
        """Ce que la dernière visite a vu, sans rien redemander."""
        return self._etat or EtatDuMoteur(
            allume=False,
            grise="le moteur de la maison n'est pas allumé — ouvrez ComfyUI",
        )

    # ── Les quatre gestes du port ────────────────────────────────────────────

    async def catalogue_video(self) -> list[ModeleVideo]:
        """Le modèle de la maison, **toujours rendu**, même moteur éteint.

        C'est la différence avec un fournisseur payant, et elle est voulue : un
        modèle qu'on ne rend pas est un modèle dont l'auteur ne sait pas qu'il
        existe. Ici l'absence se **répare** — allumer une fenêtre, télécharger
        des fichiers —, et un écran qui ne le nommerait pas ne dirait jamais
        quoi réparer.
        """
        self._etat = await self.visiter()
        return [modele_de_la_maison()]

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        """Dépose l'image, envoie le montage, rend **le numéro du travail**.

        Le numéro rentre avant la première seconde d'attente, exactement comme
        chez le payant : ici il ne protège pas d'une dépense, il protège d'un
        calcul de trois minutes qu'on referait pour rien.
        """
        etat = self._etat or await self.visiter()
        if not etat.allume:
            raise FournisseurIndisponible(etat.phrase)
        if etat.manquants:
            manque = ", ".join(f.nom for f in etat.manquants)
            raise AppelRefuse(
                f"il manque des fichiers de modèle et ils n'ont pas été "
                f"téléchargés : {manque}"
            )

        largeur, hauteur = taille_demandee(demande.resolution, demande.proportions)
        nom_depose = await self._deposer_image(demande.image)
        montage = montage_du_clip(
            image=nom_depose,
            texte=demande.texte,
            images=modele.images_reelles(demande.secondes),
            largeur=largeur,
            hauteur=hauteur,
            # La graine vit dans les options, où le port la range déjà pour les
            # payants. Une par défaut, et la même : deux clips demandés avec les
            # mêmes réglages doivent rendre la même chose, sinon *relancer pour
            # voir* ne veut plus rien dire.
            graine=int(demande.options.get("graine", 1) or 1),
        )
        if etat.greffon_absent:
            montage = sans_greffon_pixel(montage)

        rendu = await self._json(
            "POST", "/prompt", {"prompt": montage, "client_id": self._client_id}
        )
        travail = str(rendu.get("prompt_id") or "")
        if not travail:
            # ComfyUI répond parfois 200 avec la liste de ce qu'il n'a pas
            # compris. La rendre telle quelle serait illisible ; la taire serait
            # pire.
            raise AppelRefuse(_pourquoi_refus(rendu))
        self._deja_tire = True
        return travail

    async def etat(self, travail: str) -> EtatTravail:
        """Où en est ce travail. Ne télécharge rien, ne coûte rien."""
        histoire = await self._json("GET", f"/history/{travail}")
        entree = histoire.get(travail)
        if not entree:
            # Absent de l'historique : soit il attend son tour, soit il calcule.
            return EtatTravail(travail=travail, fini=False)
        statut = entree.get("status") or {}
        if statut.get("status_str") == "error":
            return EtatTravail(
                travail=travail, fini=True, echoue=True, raison=_pourquoi(statut)
            )
        if statut.get("completed"):
            return EtatTravail(travail=travail, fini=True)
        return EtatTravail(travail=travail, fini=False)

    async def recuperer(self, travail: str) -> ClipProduit:
        """Le clip fini, et **zéro dollar qui n'est pas un zéro d'ignorance**.

        `montant_relu` est vrai, et c'est tout le sujet : le produit écrit zéro
        **en sachant** que c'est zéro. Un clip payé dont la réponse ne portait
        aucun montant écrit zéro *en disant qu'il ne sait pas*, et le journal des
        dépenses distingue les deux (`A9`).
        """
        histoire = await self._json("GET", f"/history/{travail}")
        entree = histoire.get(travail)
        if not entree:
            raise AppelRefuse(
                f"ComfyUI ne connaît plus le travail {travail}. S'il a été "
                f"redémarré, son historique est reparti de zéro et le clip est "
                f"perdu — il ne coûtait rien, il se relance."
            )
        statut = entree.get("status") or {}
        if statut.get("status_str") == "error":
            raise AppelRefuse(_pourquoi(statut))

        reference = _la_video(entree)
        if reference is None:
            raise AppelRefuse(
                "le montage s'est terminé sans rendre de vidéo. C'est une panne "
                "du montage, pas de la carte : regardez la fenêtre de ComfyUI."
            )
        octets = await self._telecharger_sortie(reference)
        return ClipProduit(
            octets=octets,
            consomme=0.0,
            unite="usd",
            type_media=_type_media(reference.get("filename", "")),
            travail=travail,
            montant_relu=True,
        )

    # ── Ce qui est installé, et ce qui manque ────────────────────────────────

    async def visiter(self) -> EtatDuMoteur:
        """Une visite complète : la carte, puis ce que chaque chargeur voit.

        **Ne lève jamais.** Un moteur éteint est une réponse, pas une panne : le
        catalogue d'images en dit autant depuis `T1`, et l'atelier s'ouvre dans
        tous les cas.
        """
        try:
            stats = await self._json("GET", "/system_stats", delai=DELAI_COURT)
        except (FournisseurIndisponible, AppelRefuse) as erreur:
            return EtatDuMoteur(allume=False, grise=str(erreur.raison))

        appareils = stats.get("devices") or [{}]
        carte = str(appareils[0].get("name") or "")
        libre = int(appareils[0].get("vram_free") or 0)

        try:
            vus = await self._ce_que_comfy_voit()
        except (FournisseurIndisponible, AppelRefuse):
            # Le moteur répond mais ne dit pas ce qu'il voit : on ne devine pas.
            # Le modèle reste choisissable, et le tirage dira la vérité.
            return EtatDuMoteur(allume=True, carte=carte, memoire_libre=libre)

        manquants = tuple(
            fichier
            for fichier in FICHIERS
            if fichier.obligatoire and fichier.nom not in vus.get(fichier.famille, ())
        )
        greffon_absent = GREFFON_PIXEL not in vus.get("loras", ())
        return EtatDuMoteur(
            allume=True,
            grise=None,
            manquants=manquants,
            greffon_absent=greffon_absent,
            carte=carte,
            memoire_libre=libre,
        )

    async def _ce_que_comfy_voit(self) -> dict[str, tuple[str, ...]]:
        """Les fichiers que chaque chargeur liste, famille par famille.

        Un chargeur absent — le greffon `ComfyUI-GGUF` non installé, par
        exemple — rend une famille vide, et tous ses fichiers passent pour
        manquants. C'est la bonne réponse : sans le chargeur, ils le sont.
        """
        vus: dict[str, tuple[str, ...]] = {}
        for famille, (classe, champ) in CHARGEURS.items():
            try:
                info = await self._json("GET", f"/object_info/{classe}", delai=DELAI_MOYEN)
            except (FournisseurIndisponible, AppelRefuse):
                vus[famille] = ()
                continue
            vus[famille] = tuple(_options(info.get(classe, {}), champ))
        return vus

    # ── Télécharger ce qui manque, et savoir quand c'est complet ─────────────

    async def dossier_des_modeles(self) -> Path | None:
        """Où ComfyUI range ses modèles, **d'après ComfyUI et non d'après nous**.

        Deux sources, dans cet ordre, et toutes deux viennent de la ligne de
        commande que ComfyUI expose lui-même :

        1. le fichier de chemins passé par `--extra-model-paths-config`, dont on
           lit le `base_path` ;
        2. à défaut, le dossier d'entrée passé par `--input-directory`, dont le
           voisin `models` est la disposition d'origine.

        **Aucun chemin en dur.** Une installation ailleurs, une seconde
        instance, un disque différent : tout cela marche, parce que la réponse
        vient de l'application qui sait.
        """
        try:
            stats = await self._json("GET", "/system_stats", delai=DELAI_COURT)
        except (FournisseurIndisponible, AppelRefuse):
            return None
        argv = [str(a) for a in (stats.get("system") or {}).get("argv") or []]

        chemin = _apres(argv, "--extra-model-paths-config")
        if chemin:
            base = _base_path_du_yaml(Path(chemin))
            if base is not None:
                return base

        entree = _apres(argv, "--input-directory")
        if entree:
            voisin = Path(entree).parent / "models"
            if voisin.is_dir():
                return voisin
        return None

    async def telecharger(
        self,
        fichiers: Iterable[FichierDeModele] | None = None,
        avance: Callable[[str, int, int], None] | None = None,
    ) -> list[str]:
        """Rapatrie ce qui manque, **et reprend ce qui a été coupé**.

        ⚠️ La seule chose qui compte ici est écrite dans l'en-tête du module : un
        fichier présent n'est pas un fichier complet. On demande la taille au
        serveur, on écrit à côté sous `.part`, on reprend par octets tant que le
        compte n'y est pas, et **on ne renomme qu'à l'octet près**. Renommer plus
        tôt ferait passer neuf gigaoctets tronqués pour un modèle installé, et la
        panne qui suivrait parlerait d'autre chose.

        Rend la liste de ce qui a été descendu.
        """
        dossier = await self.dossier_des_modeles()
        if dossier is None:
            raise AppelRefuse(
                "je ne trouve pas où ComfyUI range ses modèles. Il le dit "
                "normalement lui-même ; s'il ne le dit pas, il faut télécharger "
                "les fichiers à la main."
            )
        a_prendre = list(fichiers) if fichiers is not None else list(
            (await self.visiter()).manquants
        )
        descendus: list[str] = []
        for fichier in a_prendre:
            cible = dossier / fichier.famille / fichier.nom
            if await _descendre(fichier, cible, avance, transport=self._transport):
                descendus.append(fichier.nom)
        return descendus

    # ── La plomberie ─────────────────────────────────────────────────────────

    def _ouvrir(self, delai: float, suit: bool = False) -> httpx.AsyncClient:
        """Un client, et **un seul endroit qui en fabrique**.

        Trois `AsyncClient` construits à trois endroits, c'est trois délais qui
        finissent par diverger et un double d'essai qui n'attrape que deux
        requêtes sur trois.
        """
        return httpx.AsyncClient(
            timeout=delai, transport=self._transport, follow_redirects=suit
        )

    async def _deposer_image(self, octets: bytes) -> str:
        """Dépose l'image de départ chez ComfyUI et rend le nom qu'il lui donne.

        **Toujours sous le même nom, toujours en écrasant.** Un nom unique par
        clip remplirait le dossier d'entrée de ComfyUI de nos brouillons, et
        c'est très exactement ce que la règle *ne rien modifier chez lui*
        interdit d'esprit sinon de lettre.
        """
        fichiers = {"image": ("atelier-entree.png", octets, "image/png")}
        donnees = {"type": "input", "overwrite": "true"}
        try:
            async with self._ouvrir(DELAI_MOYEN) as client:
                reponse = await client.post(
                    f"{self._base}/upload/image", files=fichiers, data=donnees
                )
                reponse.raise_for_status()
                rendu = reponse.json()
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(_injoignable(self._base, erreur)) from erreur
        nom = rendu.get("name")
        if not nom:
            raise AppelRefuse(
                "ComfyUI a pris l'image de départ mais n'a pas dit sous quel nom "
                "il l'a rangée."
            )
        sous = rendu.get("subfolder") or ""
        return f"{sous}/{nom}" if sous else str(nom)

    async def _telecharger_sortie(self, reference: dict[str, Any]) -> bytes:
        question = {
            "filename": reference.get("filename", ""),
            "subfolder": reference.get("subfolder", ""),
            "type": reference.get("type", "output"),
        }
        try:
            async with self._ouvrir(DELAI_LONG) as client:
                reponse = await client.get(f"{self._base}/view", params=question)
                reponse.raise_for_status()
                return reponse.content
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(_injoignable(self._base, erreur)) from erreur

    async def _json(
        self,
        methode: str,
        chemin: str,
        corps: dict[str, Any] | None = None,
        delai: float = DELAI_MOYEN,
    ) -> dict[str, Any]:
        try:
            async with self._ouvrir(delai) as client:
                reponse = await client.request(
                    methode, f"{self._base}{chemin}", json=corps
                )
                reponse.raise_for_status()
                brut = reponse.content
                return json.loads(brut) if brut else {}
        except httpx.HTTPStatusError as erreur:
            detail = erreur.response.text[:600]
            raise AppelRefuse(
                f"ComfyUI a refusé {chemin} (code {erreur.response.status_code}) : {detail}"
            ) from erreur
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(_injoignable(self._base, erreur)) from erreur
        except json.JSONDecodeError as erreur:
            raise AppelRefuse(
                f"ComfyUI a répondu à {chemin} par quelque chose qui n'est pas du "
                f"JSON. Il est peut-être en train de démarrer."
            ) from erreur


# ── Les fonctions libres ─────────────────────────────────────────────────────


def _injoignable(base: str, erreur: Exception) -> str:
    return (
        f"le moteur de la maison n'est pas allumé — ouvrez ComfyUI. Il est "
        f"attendu sur {base}, et son journal doit dire « To see the GUI go to: "
        f"{base} ». Détail : {erreur}"
    )


def _options(fiche: dict[str, Any], champ: str) -> list[str]:
    """La liste qu'un chargeur ComfyUI expose pour un de ses champs.

    ⚠️ **Deux formes coexistent** dans la même version, et la seconde est
    arrivée sans prévenir : la liste peut être le premier élément, ou vivre sous
    `options` dans le dictionnaire qui suit. Ne lire qu'une des deux rend une
    famille vide, donc *tous ses fichiers manquants*, sur une installation
    complète.
    """
    entree = ((fiche.get("input") or {}).get("required") or {}).get(champ)
    if not entree:
        return []
    if isinstance(entree, list) and entree and isinstance(entree[0], list):
        return [str(v) for v in entree[0]]
    if isinstance(entree, list) and len(entree) > 1 and isinstance(entree[1], dict):
        return [str(v) for v in (entree[1].get("options") or [])]
    return []


def _apres(argv: list[str], drapeau: str) -> str | None:
    """La valeur qui suit un drapeau sur la ligne de commande de ComfyUI."""
    for rang, mot in enumerate(argv):
        if mot == drapeau and rang + 1 < len(argv):
            return argv[rang + 1]
    return None


_BASE_PATH = re.compile(r"^\s*base_path:\s*['\"]?(.+?)['\"]?\s*$")


def _base_path_du_yaml(chemin: Path) -> Path | None:
    """Le `base_path` du fichier de chemins de ComfyUI.

    **On ne lit qu'une ligne, exprès.** Le produit n'a pas besoin de comprendre
    ce fichier — il a besoin d'une seule valeur, et ajouter une dépendance
    d'analyse YAML pour la trouver serait payer une bibliothèque pour un
    `startswith`. Si la ligne n'y est pas ou si le dossier n'existe pas, on rend
    `None` et l'appelant le dit en clair plutôt que d'inventer un chemin.
    """
    try:
        lignes = chemin.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    for ligne in lignes:
        trouve = _BASE_PATH.match(ligne)
        if trouve:
            dossier = Path(trouve.group(1))
            if dossier.is_dir():
                return dossier
    return None


def _la_video(entree: dict[str, Any]) -> dict[str, Any] | None:
    """La vidéo produite, parmi tout ce que le montage a pu enregistrer."""
    for sortie in (entree.get("outputs") or {}).values():
        for genre in ("videos", "gifs", "images"):
            for reference in sortie.get(genre) or []:
                if isinstance(reference, dict) and reference.get("filename"):
                    return reference
    return None


def _type_media(nom: str) -> str:
    fin = nom.rsplit(".", 1)[-1].lower() if "." in nom else ""
    return {"mp4": "video/mp4", "webm": "video/webm", "webp": "image/webp"}.get(
        fin, "video/mp4"
    )


def _pourquoi(statut: dict[str, Any]) -> str:
    """Ce que ComfyUI raconte d'un travail cassé, **ramené à une phrase utile**.

    La mémoire épuisée a sa propre phrase parce que c'est la seule panne dont
    l'auteur peut faire quelque chose sans quitter l'atelier : redescendre d'un
    cran de durée, et relancer.
    """
    messages = statut.get("messages") or []
    panne: dict[str, Any] = {}
    for message in messages:
        if isinstance(message, list) and len(message) > 1 and message[0] == "execution_error":
            panne = message[1] if isinstance(message[1], dict) else {}
            break
    brut = str(panne.get("exception_message") or "")
    etape = f" (étape {panne['node_type']})" if panne.get("node_type") else ""
    bas = brut.lower()
    if "out of memory" in bas or "allocate" in bas:
        return (
            f"la mémoire de la carte est pleine{etape}. Redescendez d'un cran de "
            f"durée et relancez — le clip raté n'a rien coûté. Détail : {brut[:300]}"
        )
    return f"ComfyUI a échoué{etape} : {brut[:500]}" if brut else "ComfyUI a échoué."


def _pourquoi_refus(rendu: dict[str, Any]) -> str:
    erreur = rendu.get("error") or {}
    if isinstance(erreur, dict) and erreur.get("message"):
        return f"ComfyUI a refusé le montage : {erreur['message']}"
    noeuds = rendu.get("node_errors") or {}
    if noeuds:
        premiers = ", ".join(sorted(noeuds)[:4])
        return (
            f"ComfyUI a refusé le montage sur les étapes {premiers}. C'est en "
            f"général un fichier de modèle absent."
        )
    return "ComfyUI a pris la demande sans rendre de numéro de travail."


async def _descendre(
    fichier: FichierDeModele,
    cible: Path,
    avance: Callable[[str, int, int], None] | None = None,
    essais_max: int = 40,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bool:
    """Un fichier, jusqu'au dernier octet, en reprenant autant qu'il le faut.

    Rend `False` quand le fichier était déjà là, `True` quand il vient d'arriver
    entier, et **refuse quand l'hébergeur ne dit pas la taille** : sans elle, il
    n'y a aucun moyen de savoir si ce qu'on a est complet, et supposer que oui
    est exactement l'erreur qui a coûté deux téléchargements le 3 septembre 2026.
    """
    if cible.exists():
        return False
    cible.parent.mkdir(parents=True, exist_ok=True)
    part = cible.with_suffix(cible.suffix + ".part")

    async with httpx.AsyncClient(
        timeout=DELAI_LONG, follow_redirects=True, transport=transport
    ) as client:
        tete = await client.head(fichier.adresse)
        attendu = int(tete.headers.get("content-length") or 0)
        if attendu <= 0:
            raise AppelRefuse(
                f"l'hébergeur ne dit pas la taille de {fichier.nom}. Sans elle, "
                f"impossible de savoir si le téléchargement est complet — et un "
                f"fichier tronqué ressemble à un fichier absent."
            )

        for _ in range(essais_max):
            deja = part.stat().st_size if part.exists() else 0
            if deja >= attendu:
                break
            entetes = {"Range": f"bytes={deja}-"} if deja else {}
            try:
                async with client.stream(
                    "GET", fichier.adresse, headers=entetes
                ) as flux:
                    flux.raise_for_status()
                    with part.open("ab") as sortie:
                        async for morceau in flux.aiter_bytes(1 << 20):
                            sortie.write(morceau)
                            deja += len(morceau)
                            if avance:
                                avance(fichier.nom, deja, attendu)
            except httpx.HTTPError:
                await asyncio.sleep(3)
                continue

        vu = part.stat().st_size if part.exists() else 0
        if vu != attendu:
            raise AppelRefuse(
                f"{fichier.nom} s'est arrêté à {vu // (1024 * 1024)} Mo sur "
                f"{attendu // (1024 * 1024)}. Le morceau déjà descendu est gardé : "
                f"relancer reprendra là où ça s'est coupé."
            )
        part.replace(cible)
    return True
