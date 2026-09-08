# -*- coding: utf-8 -*-
"""Les gestes du produit.

C'est ici que vit ce que l'atelier sait faire. `api/` et `mcp/` sont deux
façades sur ce dossier, et aucune des deux ne réimplémente quoi que ce soit :
c'est ce qui garantit que ce qu'un agent peut faire est exactement ce que
l'écran peut faire (`docs/ARCHITECTURE.md` §4, règle 2).

`Atelier` est le point de composition — le seul endroit du dépôt qui sache
**quels** fournisseurs existent, que l'index est du SQLite et que les fichiers
sont sur le disque. Ils sont deux depuis F1, et c'est la ligne `FOURNISSEURS`
plus bas qui le dit : nulle part ailleurs le produit ne nomme OpenRouter ni
Pollinations.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from atelier.depot import Base, Fichiers
from atelier.fournisseur import OpenRouter, Pollinations, PortFournisseur
from atelier.fournisseur.maison import BASE_PAR_DEFAUT, MoteurDeLaMaison
from atelier.fournisseur.openrouter_video import OpenRouterVideo
from atelier.fournisseur.port import PortAnimateur
from atelier.fournisseur.openrouter import CLE
from atelier.reglages import adresse_comfy, lire_secret
from atelier.services.agent import (
    DepotRefuse,
    GardeFous,
    PlafondAtteint,
    ServiceAgent,
)
from atelier.services.ambiances import AmbianceRefusee, ServiceAmbiances
from atelier.services.calibrage import CalibrageRefuse, ServiceCalibrage
from atelier.services.animation import ServiceAnimation
from atelier.services.assets import AssetInconnu, RecetteRefusee, ServiceAssets
from atelier.services.bibliotheque import (
    ANNULATION_S,
    AnnulationExpiree,
    CollectionInconnue,
    ProjetInconnu,
    RangementRefuse,
    ServiceBibliotheque,
)
from atelier.services.catalogue import EtatCatalogue, ServiceCatalogue
from atelier.services.reserves import ServiceReserves
from atelier.services.decoupe import DecoupeRefusee, ServiceDecoupe
from atelier.services.miroir import MiroirRefuse, ServiceMiroir
from atelier.services.etiquettes import EtiquetteRefusee, ServiceEtiquettes
from atelier.services.mouvements import MouvementRefuse, ServiceMouvements
from atelier.services.superposition import ServiceSuperposition, SuperpositionRefusee
from atelier.services.envoi import EnvoiRefuse, ServiceEnvoi
from atelier.services.evenements import Diffusion, Evenement
from atelier.services.export import Archive, ExportRefuse, ServiceExport, Sortie
from atelier.services.fournisseurs import Fournisseurs
from atelier.services.generation import ServiceGenerations
from atelier.services.installation import ServiceInstallation
from atelier.services.montage import ServiceMontage
from atelier.services.sortie import ServiceSortie, SortieRefusee
from atelier.services.planche import PlancheRefusee, ServicePlanche
from atelier.services.equipement import ServiceEquipement
from atelier.services.pliage import ChoixAttendu, CompteFaux, ServicePliage
from atelier.services.production import (
    PersonnageInconnu,
    PoseInconnue,
    ProductionRefusee,
    ServiceProduction,
)
from atelier.services.univers import (
    CarteInconnue,
    CarteRefusee,
    ServiceUnivers,
    UniversRefuse,
)

__all__ = [
    "ANNULATION_S",
    "AnnulationExpiree",
    "Archive",
    "AssetInconnu",
    "Atelier",
    "CarteInconnue",
    "CarteRefusee",
    "CollectionInconnue",
    "ChoixAttendu",
    "CompteFaux",
    "DecoupeRefusee",
    "EtiquetteRefusee",
    "MouvementRefuse",
    "SuperpositionRefusee",
    "DepotRefuse",
    "Diffusion",
    "EnvoiRefuse",
    "EtatCatalogue",
    "Evenement",
    "ExportRefuse",
    "Fournisseurs",
    "GardeFous",
    "PersonnageInconnu",
    "PlafondAtteint",
    "PoseInconnue",
    "ProductionRefusee",
    "ProjetInconnu",
    "RangementRefuse",
    "RecetteRefusee",
    "AmbianceRefusee",
    "CalibrageRefuse",
    "ServiceCalibrage",
    "ServiceAgent",
    "ServiceAmbiances",
    "ServiceAssets",
    "ServiceBibliotheque",
    "ServiceCatalogue",
    "ServiceDecoupe",
    "MiroirRefuse",
    "ServiceMiroir",
    "ServiceAnimation",
    "ServiceEtiquettes",
    "ServiceMouvements",
    "ServiceSuperposition",
    "ServiceExport",
    "ServiceGenerations",
    "ServiceMontage",
    "PlancheRefusee",
    "ServicePlanche",
    "ServiceEnvoi",
    "ServiceEquipement",
    "ServicePliage",
    "ServiceProduction",
    "ServiceUnivers",
    "Sortie",
    "UniversRefuse",
]


def _openrouter() -> PortFournisseur:
    """**La clé est relue à chaque appel**, jamais au démarrage.

    On doit pouvoir la déposer sans redémarrer le serveur — et, en T7, changer
    les garde-fous de l'agent en cours de session pour la même raison.

    **La place demandée est celle que l'adaptateur déclare** (F3), et non un nom
    écrit ici : c'est lui qui sait ce qu'il lui faut, et le point de composition
    n'a pas à le savoir une seconde fois.
    """
    return OpenRouter(lire_secret(CLE.nom))


def _pollinations() -> PortFournisseur:
    """Celui qui ne demande rien — arrivé en F1. Il n'a pas d'état à relire."""
    return Pollinations()


def _openrouter_video() -> PortAnimateur:
    """L'animateur, arrivé en A9. **Le même compte, la même clé, l'autre port.**

    Il n'est pas dans `FOURNISSEURS` et ce n'est pas un oubli : cette liste-là
    est celle des fournisseurs d'images, et tout ce qui la parcourt — le
    catalogue, le grisé d'un modèle, le tiroir à secrets — parle d'images. Un
    animateur qui s'y glisserait devrait répondre à des questions qui n'ont pas
    de sens pour lui, et le produit finirait par proposer un modèle vidéo là où
    il attend une planche.

    La clé se relit ici comme ailleurs, à chaque appel.
    """
    return OpenRouterVideo(lire_secret(CLE.nom))


_LA_MAISON: MoteurDeLaMaison | None = None


def _maison() -> PortAnimateur:
    """Le moteur de la maison, arrivé en A11. **Le seul sans compte ni clé.**

    ⚠️ **C'est le seul adaptateur du dépôt qui se garde**, et il le faut. Les
    autres se refabriquent à chaque appel pour relire leur clé sur le disque ;
    celui-ci n'a pas de clé, et il retient deux choses qui n'ont de sens que dans
    la durée : *ce que la dernière visite a vu*, d'où sort le grisé, et *un clip
    est-il déjà parti*, d'où sort l'attente annoncée. Sur une instance jetée
    après chaque appel, les deux valent leur défaut pour toujours — le modèle
    **ne se grise plus jamais**, moteur éteint compris, et l'auteur découvre
    l'absence en cliquant sur *Commander* au lieu de la lire avant.

    Garder l'objet ne garde pas sa réponse : `catalogue_video` revisite à chaque
    relecture du catalogue, et la route de l'écran revisite à chaque peinture.
    L'auteur qui vient d'allumer ComfyUI voit donc le grisé tomber.

    ⚠️ **Et il se refabrique quand son adresse change** (`B15`). C'est la seule
    entorse au paragraphe ci-dessus, et elle est nécessaire : garder un objet
    construit sur `127.0.0.1:8188` après que l'auteur a posé une autre adresse
    aurait fait un réglage qui s'écrit et qui n'agit pas — le pire des deux.
    La comparaison ne coûte rien et ne déclenche rien dans le cas normal, où
    l'adresse ne bouge jamais : ce que la classe promet de garder, elle le
    garde.
    """
    global _LA_MAISON
    voulue = adresse_comfy(BASE_PAR_DEFAUT).rstrip("/")
    if _LA_MAISON is None or getattr(_LA_MAISON, "adresse", "") != voulue:
        _LA_MAISON = MoteurDeLaMaison(voulue)
    return _LA_MAISON


# **Les deux animateurs, dans l'ordre où l'écran les montre.** Le payant
# d'abord, et c'est la même raison qu'aux fournisseurs d'images : c'est lui qui a
# été mesuré sur treize clips, et le local est arrivé après. L'ordre n'a rien
# d'un jugement — le local est meilleur sur les deux lignes qui décident du
# détourage —, il dit seulement ce que ce dépôt connaît le mieux.
ANIMATEURS: list[Callable[[], PortAnimateur]] = [_openrouter_video, _maison]


# **L'ordre est celui de la liste des modèles à l'écran, et il est délibéré** :
# le payant d'abord, parce que c'est lui qui porte les univers et que le gratuit
# est un brouillon (`docs/archive/plan-versions-tenues.md` § V2.2 — *ce qui n'est pas une raison*). Il
# décide aussi du repli du défaut quand aucune clé n'est déposée : on descend la
# liste jusqu'au premier modèle utilisable, et c'est ainsi qu'une machine neuve
# tombe sur celui qui ne demande rien.
FOURNISSEURS = [_openrouter, _pollinations]


class Atelier:
    def __init__(
        self,
        racine: Path | None = None,
        fabrique_fournisseur: Callable[[], PortFournisseur] | None = None,
        fabriques_fournisseurs: list[Callable[[], PortFournisseur]] | None = None,
        # **L'animateur, arrivé en A9.** Séparé des fournisseurs d'images pour
        # la raison écrite sur `_openrouter_video` : ce n'est pas le même port.
        # Un essai qui n'en donne pas monte l'atelier avec le vrai, qui ne part
        # jamais tout seul — aucun appel ne se fait sans un geste de l'auteur.
        fabrique_animateur: Callable[[], PortAnimateur] | None = None,
        # **Le pluriel, arrivé en A11**, exactement pour la raison écrite plus bas
        # sur les fournisseurs : le singulier monte un atelier sur un animateur
        # unique — c'est ce que font tous les essais d'`A9` et d'`A10` — tandis
        # que le produit en a deux, le payant et celui de la maison.
        fabriques_animateurs: list[Callable[[], PortAnimateur]] | None = None,
    ) -> None:
        self.fichiers = Fichiers(racine)
        self.fichiers.preparer()
        self.base = Base(self.fichiers.base)
        # **Deux entrées pour une seule liste, et la seconde est celle de F1.**
        # `fabrique_fournisseur` au singulier monte un atelier sur un fournisseur
        # unique : c'est ce que font tous les essais du dépôt, et ça décrit
        # exactement le produit d'avant la V2.2. `fabriques_fournisseurs` au
        # pluriel est ce que le produit utilise, et ce dont les essais de F1 ont
        # besoin pour jouer deux fournisseurs à la fois.
        self.fournisseurs = Fournisseurs(
            fabriques_fournisseurs
            or ([fabrique_fournisseur] if fabrique_fournisseur else FOURNISSEURS)
        )
        self.fabrique_fournisseur = fabrique_fournisseur
        # **Une seule diffusion pour tout l'atelier.** Un abonné voit passer
        # l'avancement d'une génération, le retour du catalogue et le rangement
        # de la bibliothèque sur le même flux : c'est ce qui permet à
        # l'interface de n'ouvrir qu'une liaison.
        self.diffusion = Diffusion()
        self.catalogue = ServiceCatalogue(
            self.fournisseurs, self.fichiers, self.diffusion
        )
        # **Ce qui reste chez chacun, et d'où le chiffre vient** (F2). Placé ici,
        # juste après le catalogue, parce que les deux répondent à la même
        # question posée à deux niveaux : le catalogue dit ce qu'un fournisseur
        # sait faire, la réserve dit ce qu'il lui reste pour le faire.
        self.reserves = ServiceReserves(self.fournisseurs, self.base)
        # Les assets avant les générations : c'est une génération qui les fait
        # naître, pas l'inverse. Le post-traitement ne connaît ni le fournisseur
        # ni le catalogue — il n'y a rien à lui passer d'autre que le disque.
        self.assets = ServiceAssets(self.base, self.fichiers, self.diffusion)
        # La bibliothèque range ce que les assets écrivent : elle passe par eux
        # pour poser un résultat, et reste ainsi le second lecteur d'un seul
        # écrivain.
        self.bibliotheque = ServiceBibliotheque(
            self.base, self.fichiers, self.assets, self.diffusion
        )
        # **L'univers après la bibliothèque, avant les générations**, et cet
        # ordre-là est le seul possible : il écrit le projet *par* la
        # bibliothèque, qui en est le seul écrivain, et c'est lui que la
        # génération consulte pour savoir ce qui part en référence. Aucun cycle
        # — la palette dont `ServiceAssets` a besoin se lit dans le projet, pas
        # auprès d'un service.
        self.univers = ServiceUnivers(
            self.base, self.fichiers, self.bibliotheque, self.assets, self.diffusion
        )
        # **Après la bibliothèque et les assets, avant rien du tout.** Le
        # slicer ne fabrique que ce que ces deux-là savent déjà écrire et
        # ranger : il ne connaît ni le catalogue, ni l'univers, ni le
        # fournisseur. C'est ce qui fait qu'une planche se découpe réseau coupé.
        self.decoupe = ServiceDecoupe(
            self.base, self.fichiers, self.assets, self.bibliotheque, self.diffusion
        )
        # **La troisième fabrique, au même rang et pour la même raison** (B1) :
        # retourner une image déjà payée ne demande ni catalogue ni fournisseur,
        # et c'est très exactement ce qui fait qu'une direction cesse de se
        # payer deux fois.
        self.miroir = ServiceMiroir(
            self.base, self.fichiers, self.assets, self.bibliotheque, self.diffusion
        )
        # **La base d'étiquettes ne connaît ni projet ni fournisseur** : elle
        # lit un fichier à la racine et en rend une liste. Elle est montée ici
        # plutôt que sur l'univers parce qu'elle n'appartient à aucun jeu —
        # comme la clé du fournisseur.
        self.etiquettes = ServiceEtiquettes(self.fichiers)
        # **La bibliothèque de mouvements, au même rang et pour la même raison**
        # (A6) : elle lit un fichier à la racine et n'appartient à aucun jeu. Un
        # mouvement se réfléchit une fois et sert tous les projets suivants —
        # c'est la décision durable de la V3, et elle se lit dans cette ligne :
        # ni projet, ni catalogue, ni fournisseur ne lui sont passés.
        self.mouvements = ServiceMouvements(self.fichiers)
        # **L'installation de la machine (B15), au même rang et pour la raison
        # inverse** : les trois au-dessus n'appartiennent à aucun jeu ; celui-ci
        # n'appartient même pas à l'atelier — il décrit la machine. Il lit la
        # bibliothèque pour une seule question, et elle décide de tout le reste :
        # *cet atelier a-t-il déjà des jeux ?* Sans elle, le tour du propriétaire
        # pourrait s'ouvrir en plein écran chez quelqu'un qui travaille depuis un
        # mois.
        self.installation = ServiceInstallation(self.fichiers, self.bibliotheque)
        # **Après la bibliothèque et les assets, comme le slicer, et pour la
        # même raison** : le plan, les personnages et la matrice ne fabriquent
        # aucune image. Ni catalogue, ni fournisseur — c'est ce qui fait que
        # tout C1 se consulte et se modifie réseau coupé, sauf la génération
        # elle-même, qui part de l'atelier.
        # **L'univers lui est passé depuis R8**, et seulement pour montrer : la
        # fiche d'une chose liste ses images d'exemple, et une carte du tableau
        # se lit chez l'univers. Il est monté juste au-dessus, donc aucun cycle
        # — c'est le même ordre que `ServiceAmbiances`, qui prend les deux.
        self.production = ServiceProduction(
            self.base,
            self.fichiers,
            self.bibliotheque,
            self.assets,
            self.diffusion,
            self.univers,
        )
        # **Le calibrage, monté après la production** (E17) : il lit les poses
        # d'une chose et écrit dans la recette de leurs corps. Ni catalogue, ni
        # fournisseur — il change le rendu d'images déjà payées, et un rendu est
        # un cache : on recalcule, on ne repaie pas.
        self.calibrage = ServiceCalibrage(self.base, self.assets, self.production)
        # **Les palettes et les ambiances, montées après la production** (E11) :
        # elles lisent le tableau — les sources d'une palette d'images — et les
        # choses du jeu — qui se sert d'une ambiance. Ni catalogue ni
        # fournisseur : la fusion des couleurs se fait sur la machine, et c'est
        # un critère d'acceptation de la tranche.
        self.ambiances = ServiceAmbiances(
            self.base,
            self.bibliotheque,
            self.univers,
            self.production,
            self.assets,
        )
        # **Au même rang que le slicer, et pour la même raison** : déplier une
        # planche déjà là ne demande ni catalogue ni fournisseur. Il ne connaît
        # ni personnage ni pose — c'est la génération qui compose ses cases, et
        # c'est ce qui laissera C3 le réemployer tel quel.
        self.pliage = ServicePliage(
            self.base, self.fichiers, self.assets, self.bibliotheque, self.diffusion
        )
        # **C3, et il se pose sur les deux précédents sans les rouvrir.** Le
        # vestiaire d'un projet, la planche qui habille, le calque qui en sort.
        # Il ne sait pas plier — il demande au pliage —, et il ne sait pas viser
        # une case — il demande à la production. Ce qui lui appartient tient en
        # deux phrases : quels corps mettre dans les cases, et quoi faire de ce
        # qui en revient. Aucun fournisseur non plus : tout C3 marche réseau
        # coupé, sauf la génération, qui part de l'atelier.
        self.equipement = ServiceEquipement(
            self.base,
            self.fichiers,
            self.bibliotheque,
            self.assets,
            self.production,
            self.pliage,
            self.diffusion,
        )
        # **La seconde fabrique, au même rang que la première et pour la même
        # raison** : superposer deux images déjà payées ne demande ni catalogue
        # ni fournisseur, et c'est très exactement ce qui fait qu'un recalage
        # raté ne coûte plus une génération.
        #
        # **Elle est descendue ici en `G16`**, sous l'équipement, pour une
        # question et une seule : *quelle était cette case avant que l'atelier
        # ne la cale ?* Refaire à la main le calage d'un vêtement demande de
        # repartir de la case telle qu'elle est arrivée, et l'équipement est le
        # seul à savoir la recalculer. Rien entre les deux ne demandait la
        # superposition — l'ordre ne coûte donc rien.
        self.superposition = ServiceSuperposition(
            self.base,
            self.fichiers,
            self.assets,
            self.bibliotheque,
            self.diffusion,
            self.equipement,
        )
        self.generations = ServiceGenerations(
            self.base,
            self.fichiers,
            self.catalogue,
            self.fournisseurs,
            self.diffusion,
            self.assets,
            self.bibliotheque,
            self.univers,
            # **Pour une seule question, et c'est pour ça qu'elle vient en
            # dernier** : une génération de pose vise une case, et cette case
            # doit exister encore au moment où l'appel part. La production ne
            # connaît pas les générations, donc l'ordre tient.
            self.production,
            # Et le pliage, pour deux gestes : composer ce qui part quand un lot
            # est demandé, et ranger ce qui revient. Lui non plus ne connaît pas
            # les générations — l'ordre tient de la même façon.
            self.pliage,
            # Et l'équipement, pour les trois mêmes gestes du côté de C3 : les
            # cases d'une planche qui habille, la planche elle-même, et les
            # calques qui en reviennent.
            self.equipement,
        )
        # **La planche, montée après la génération** (E13) : elle montre ce
        # qu'on achète avant de payer, et ce qu'elle montre est *composé par le
        # chemin de l'envoi* — donc il lui faut le service qui envoie. Elle ne
        # fabrique rien et n'enregistre rien ; le seul endroit d'où l'argent part
        # reste la barre qui paie.
        # **L'animation, montée après les générations** (A9). Elle écrit des
        # générations comme elles, sur la même base et le même disque — c'est ce
        # qui met la dépense d'un clip dans la barre de tête et dans le total du
        # projet sans qu'aucun compteur ait à apprendre qu'il existe des vidéos.
        # Elle ne passe pas par `ServiceGenerations` : les deux services parlent
        # à des ports différents, et faire transiter un appel vidéo par le
        # chemin des images rendrait la mesure de fichier obligatoire — très
        # exactement le défaut qui faisait disparaître un clip payé du journal.
        # **Un animateur donné remplace les deux, et c'est voulu.** Un essai qui
        # fournit son double veut un atelier dont il connaît toutes les réponses ;
        # lui laisser le moteur de la maison en plus ferait dépendre son résultat
        # d'une fenêtre ComfyUI ouverte ou non sur la machine qui le fait tourner.
        self.animation = ServiceAnimation(
            self.base,
            self.fichiers,
            fabriques_animateurs
            or ([fabrique_animateur] if fabrique_animateur else ANIMATEURS),
            self.diffusion,
        )
        # **Le montage, monté juste après l'animation** (A10), et il ne reçoit
        # ni l'animateur, ni le catalogue, ni un fournisseur : découper un clip
        # déjà payé ne demande rien à personne. C'est la même privation que le
        # slicer et les deux fabriques, et c'est elle qui autorise la phrase du
        # pied de son écran — *rien ici ne dépense*.
        #
        # Il prend les assets pour une seule chose — la recette que le jeu
        # applique à ce qui entre — et la production pour une seule autre — le
        # type du personnage, qui dit à quelle taille son espèce vit dans ce
        # jeu. Ni l'un ni l'autre ne connaît le montage : l'ordre tient.
        self.montage = ServiceMontage(
            self.base,
            self.fichiers,
            self.assets,
            self.production,
            self.diffusion,
        )
        self.planche = ServicePlanche(self.production, self.generations)
        # **Ce qui part, monté après elle** (E14) : l'écran qui s'intercale
        # entre le bouton et la dépense. Comme la planche, il ne compose rien et
        # ne dépense rien — il demande ses lignes au chemin de l'envoi et son
        # compte d'images à celui qui décide du grisé.
        self.envoi = ServiceEnvoi(
            self.generations,
            self.production,
            self.univers,
            self.bibliotheque,
            self.assets,
            self.reserves,
        )
        # **Le cadre de l'agent, pas un geste de plus.** Il ne fabrique rien : il
        # dit si une dépense est permise, avec quel modèle, et où poser le
        # fichier. **En dernier, et c'est le seul ordre possible** : sa
        # consommation se *lit* sur les générations plutôt que se tenir en
        # double, donc il lui faut le service qui les garde. Il ne reçoit ni le
        # fournisseur ni la base — autoriser une dépense ne demande ni l'un ni
        # l'autre.
        self.agent = ServiceAgent(
            self.fichiers, self.diffusion, self.catalogue, self.generations
        )
        # **Le dernier de tous, et le seul qui ne reçoive pas la diffusion.** Un
        # export ne change rien : il lit des assets, il rend des octets, et
        # l'atelier est exactement dans l'état où il l'a trouvé. Rien à
        # annoncer, donc rien à quoi s'abonner — et ça se lit dans cette ligne.
        #
        # **Il est passé après l'agent en C5**, et c'est le seul ordre possible :
        # sortir un personnage pose des fichiers dans le dossier du jeu, et ce
        # dossier — avec ses trois règles — appartient au service de l'agent
        # depuis T7. La production et l'équipement le précèdent déjà ; le
        # dernier arrivé décide de la place.
        self.export = ServiceExport(
            self.base,
            self.assets,
            self.bibliotheque,
            self.production,
            self.equipement,
            self.agent,
            # **Le montage, pour une seule chose** (A4) : la planche de sprites
            # d'une bande, refaite si son cache a sauté. Il est monté bien plus
            # haut et n'apporte ici ni fournisseur, ni catalogue, ni animateur —
            # l'export reste du disque et du processeur, ce que son premier
            # paragraphe promet et ce que ses essais comptent.
            self.montage,
        )
        # **La sortie, montée après l'export et sur lui** (B21). Elle ne
        # remplace aucune des quatre portes existantes : elle les rassemble sous
        # un écran qui dit d'abord ce qu'il va écrire. Tout ce qui fabrique —
        # le rendu d'une image, sa fiche, les trois fichiers d'une animation —
        # lui est demandé plutôt que refait, et ce qui pose reste le geste de
        # l'agent. Elle n'apporte donc, elle non plus, ni fournisseur ni
        # catalogue : sortir reste du disque et du processeur.
        self.sortie = ServiceSortie(
            self.base,
            self.fichiers,
            self.assets,
            self.production,
            self.equipement,
            self.montage,
            self.agent,
            self.export,
        )

    async def ouvrir(self) -> None:
        """Ce qui se passe au démarrage, dans l'ordre, et sans jamais lever.

        Le catalogue est relu ; la bibliothèque se reconstruit si son index a
        disparu et s'assure qu'un projet existe ; ce que l'arrêt précédent a
        coupé est marqué — pas relancé —, et les images qui n'ont pas encore
        d'asset en reçoivent un. L'atelier s'ouvre même sans réseau et même sans
        clé : l'échec attend le moment où on génère (US-95).

        **La bibliothèque avant le rattrapage** : reconstruire repose ce que les
        fichiers disent, rattraper ne comble que ce qui manque encore. Dans
        l'ordre inverse, un index effacé serait d'abord rempli d'assets tout
        neufs, sans rangement, sans favori et sans filiation — puis écrasé.
        """
        # **Le local d'abord.** Rien ici ne demande le réseau, et rien ici ne
        # doit attendre qu'il réponde : c'est ce qui donne son sens à « réseau
        # coupé, la bibliothèque fonctionne normalement » (US-92).
        self.bibliotheque.ouvrir()
        # **Le même balayage que la bibliothèque, pour l'écart d'une bande**
        # (B11) : ce que huit secondes n'ont pas vu revenir part pour de bon.
        # Après elle et non avant : `bibliotheque.ouvrir()` reconstruit l'index
        # si les fichiers en disent plus que lui, et le balayage doit lire
        # l'état repose, pas celui d'avant.
        self.montage.purger()
        self.generations.reprendre()
        # Les images produites avant que les assets existent — celles de T1 —
        # en reçoivent un ici. Sans ça elles resteraient dans la grille sans
        # pouvoir être retouchées, et l'atelier aurait deux sortes d'images.
        recentes = self.generations.recentes(1000)
        self.assets.rattraper(recentes)
        # **Un lot payé, reçu, et coupé avant d'être rangé se range ici** —
        # gratuitement, localement, sans appeler personne (US-132). Déplier
        # n'est pas relancer : ce qui a été coupé *en vol* est marqué interrompu
        # juste au-dessus et attend un geste, comme depuis T1. **Après le
        # rattrapage**, pour la raison qui met la bibliothèque avant lui : ce
        # que le disque dit se repose d'abord, ce qui manque se comble ensuite.
        self.pliage.reprendre(recentes)
        await self.catalogue.rafraichir()
        # **Le catalogue vidéo n'est pas relu ici, et c'est délibéré** (A9). Il
        # ne sert qu'à l'écran qui commande un clip, et il se relit quand cet
        # écran le demande. L'ouverture de l'atelier ne paie donc pas un aller
        # chez un fournisseur dont la plupart des séances ne se serviront pas.
        #
        # **Rien n'est récupéré ici non plus** : un clip en souffrance attend un
        # geste de l'auteur, exactement comme une génération coupée depuis T1 —
        # sauf que le geste, lui, ne repaie rien.

    def etat(self) -> dict[str, Any]:
        """Tout ce qu'il faut pour dessiner l'atelier à l'ouverture.

        Un seul objet, servi à l'identique par `GET /api/status` et par le
        premier message du flux d'événements. Un onglet qui se rouvre n'a donc
        qu'une chose à faire : écouter — l'état complet arrive dans la seconde,
        avec les générations déjà terminées pendant son absence.
        """
        return {
            # **Le tiroir à secrets, une place par fournisseur** (F3). Il
            # remplace `cle`, qui ne pouvait décrire qu'un monde à un
            # fournisseur : la barre de tête y lit *avec quoi on peut produire*
            # plutôt que *ce qui manque*, et il en reste toujours un.
            "secrets": [t.en_json() for t in self.fournisseurs.tiroirs()],
            # **L'atelier n'a encore rien** (E19) : aucune image, un seul jeu, et
            # il porte encore le nom que le produit lui a donné. C'est là que
            # l'assistant s'ouvre — la seule minute que personne ne revoit
            # jamais. Un fait, jamais un drapeau : il cesse d'être vrai au
            # premier geste, et c'est exactement quand la porte doit se fermer.
            "premier_lancement": self.bibliotheque.neuf(),
            "catalogue": self.catalogue.en_json(),
            # **Le total ne compte que de l'argent, et son étiquette le dit**
            # (F2). Ce qui se consomme sans argent est à côté, une ligne par
            # unité : le mélanger au total rouvrirait au premier jeton le
            # mensonge par omission que l'écran des dépenses a fermé.
            "couts": {
                "total_usd": self.generations.total_couts(),
                "reserves": self.reserves.en_json(),
            },
            # Ce que le post-traitement sait faire **sur cette machine**, et ce
            # qu'il ne peut pas : un moteur de détourage absent, une palette qui
            # n'existe pas encore. L'écran grise avec la phrase qu'il reçoit, il
            # ne rejoue jamais la règle de son côté. La palette dépend du projet
            # ouvert — c'est ici qu'on les tient tous les deux.
            "traitement": self.assets.traitement(self.bibliotheque.courant),
            # L'univers du projet ouvert : bible, barème, palette, défauts. Servi
            # à l'ouverture pour que l'écran dessine « ce qui part » sans un
            # second appel, et republié à chaque fois qu'il change.
            "univers": self.univers.univers(self.bibliotheque.courant).en_json(),
            # L'arbre : projets, collections, comptes et totaux. Comptés ici,
            # jamais à l'écran — une somme faite sur les deux cents assets qu'un
            # navigateur a en mémoire dirait un chiffre faux dès que la
            # bibliothèque dépasse ce que la grille sert.
            "bibliotheque": self.bibliotheque.arbre(),
            # Le cadre de l'agent et ce qu'il a consommé depuis l'ouverture.
            # Servi ici parce que l'écran Réglages le règle et que la barre d'état
            # le montre : deux endroits, une seule source (US-90, US-91, US-96).
            "agent": self.agent.en_json(),
            "annulation_s": ANNULATION_S,
        }
