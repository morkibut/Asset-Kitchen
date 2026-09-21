# -*- coding: utf-8 -*-
"""Le tableau et l'univers — rassembler, promouvoir, contraindre.

Deux gestes qui n'en font qu'un. On colle des images dans un tableau
d'inspiration ; on en promeut quelques-unes au rang d'**artwork officiel** ; et
c'est de celles-là que le projet tire ce qu'il impose à tout ce qui rentre : la
palette, et ce qui part en référence à chaque appel. Séparer les deux services
aurait coupé la palette de sa matière.

**Ce service est le seul du dépôt à toucher le réseau sans être une
génération**, et c'est une nouveauté de T4 : coller une adresse va chercher son
image. L'invariant de T3 se lisait dans les imports — ni `bibliotheque.py` ni
`assets.py` ne contiennent de `fournisseur`. Il tient toujours, et il est
maintenant borné : **une seule méthode** sort, `recuperer`, et tout le reste du
tableau — coller un fichier, grouper, annoter, promouvoir, extraire la palette,
réaligner — fonctionne réseau coupé.

**Le projet n'a qu'un écrivain, et ce n'est pas ce fichier-ci.**
`ServiceBibliotheque.sauver_projet` est à `Projet` ce que `ServiceAssets.sauver`
est à `Asset` : deux écrivains, ce serait un jour un réglage écrit dans la base
et pas dans le fichier, donc perdu à la première reconstruction.

**La palette est un cache, et elle dit de quoi.** Elle *est* dérivable des
artworks officiels ; la garder telle quelle serait une seconde vérité. Elle
porte donc l'empreinte des artworks qui l'ont produite, exactement comme le
rendu d'un asset porte celle de sa recette — et un cache dont l'empreinte ne
correspond plus est aussi périmé qu'un cache absent.
"""

from __future__ import annotations

import asyncio
import math
import uuid
from dataclasses import replace
from typing import Any, Iterable, Mapping

from atelier.depot import Base, Fichiers
from atelier.domaine.vue import vue as vue_connue
from atelier.domaine.carte import (
    ATTENTE,
    ECHOUEE,
    FAMILLES,
    IMAGE,
    LARGEUR_MAX,
    LARGEUR_MIN,
    PRETE,
    TAILLES,
    TEXTE,
    TOUS,
    VIDEO,
    Carte,
)
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import CARTE, STYLE, Reinjection
from atelier.domaine.plan import Pose
from atelier.domaine.planche import est_une_planche_refaite
from atelier.domaine.projet import (
    AUCUNE_CIBLE,
    CHAMPS_BIBLE,
    CIBLE_PAR_DEFAUT,
    Champ,
    Echelle,
    Projet,
    Univers,
    bible_complete,
    empreinte_palette,
    passe_par_defaut,
)

# **« Personne n'a parlé de ce champ-là »**, et c'est un troisième état (D1).
# Il n'existe que pour le détourage par défaut, où `None` est déjà pris : là-bas
# il veut dire « remets-le au produit », donc il fallait autre chose pour dire
# « ne touche pas ». Un objet anonyme plutôt qu'une chaîne réservée : rien ne
# peut l'imiter par accident depuis un fichier ou une route.
NON_DIT = object()
from atelier.domaine.lien import (
    CARTE as BOUT_CARTE,
    GENRES as GENRES_BOUT,
    ILOT as BOUT_ILOT,
    MOT_MAX,
    Bout,
    Lien,
    meme_paire,
)
from atelier.domaine.fond import Proposition, fond_valide, proposer
from atelier.domaine.teinte import AUCUNE, TEINTES
from atelier.domaine.projet import STYLES, cible_du_changement, methode_du_changement
from atelier.domaine.recette import METHODES_DE_REDUCTION, occupation_max
from atelier.image.traitement import raison_methode
from atelier.image import (
    COTE_MIN,
    COULEURS_MAX,
    COULEURS_MIN,
    Boite,
    alpha_du_sujet,
    apercu_de_la_lecture,
    decouper,
    empreinte_de,
    extension,
    grille_fixe,
    mesurer,
    palette_de,
    part_lue,
    zones_opaques,
)
# `CIBLE_MIN` et `CIBLE_MAX` viennent de la recette et pas d'ici : la taille
# de pixel d'un projet et celle d'une recette sont la même grandeur, et deux
# plages écrites à deux endroits finiraient par se contredire — l'une refusant
# ce que l'autre propose.
from atelier.services.assets import CIBLE_MAX, CIBLE_MIN, ServiceAssets
# **La découpe d'une carte emprunte à celle d'une planche, et c'est voulu** : ce
# qu'un rectangle doit valoir pour être découpable ne dépend pas de ce qu'on en
# tire. Deux vérifications écrites à deux endroits finiraient par accepter deux
# choses différentes, et l'écart ne se verrait qu'une fois l'image coupée.
from atelier.services.decoupe import (
    AUTO,
    DECOUPES_MAX,
    GRILLE,
    MODES,
    DecoupeRefusee,
    verifier_boites,
)
from atelier.services.bibliotheque import ProjetInconnu, ServiceBibliotheque
from atelier.services.evenements import Diffusion


class CarteInconnue(ErreurAtelier):
    code = "carte_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune carte « {identifiant} » dans ce tableau")


class CarteRefusee(ErreurAtelier):
    """Ce qu'on a collé n'entre pas dans le tableau, et on dit lequel et pourquoi.

    « Un refus qui nomme le fichier quand ce n'est pas une image, afin de savoir
    lequel des douze fichiers déposés pose problème » (US-45). Le nom est donc
    dans la phrase, pas dans un champ à côté : c'est la phrase qui s'affiche.
    """

    code = "carte_refusee"


class UniversRefuse(ErreurAtelier):
    """Un réglage de l'univers n'est pas applicable, et on dit lequel."""

    code = "univers_refuse"


class LienInconnu(ErreurAtelier):
    code = "lien_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun lien « {identifiant} » sur cette toile")


class LienRefuse(ErreurAtelier):
    """Ce trait-là ne peut pas être tiré, et le refus dit pourquoi.

    Même forme que `CarteRefusee` : la phrase **est** ce qui s'affiche, et elle
    nomme ce qui manque plutôt que ce qui a été demandé.
    """

    code = "lien_refuse"


class ServiceUnivers:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        bibliotheque: ServiceBibliotheque,
        assets: ServiceAssets,
        diffusion: Diffusion | None = None,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque
        self._assets = assets
        self._diffusion = diffusion or Diffusion()
        self._en_vol: set[asyncio.Task[None]] = set()

    # ── Lire le tableau ──────────────────────────────────────────────────────

    def cartes(self, projet: str) -> list[Carte]:
        """Le tableau d'un projet, relu du disque à chaque fois.

        **Aucun cache en mémoire**, et ce n'est pas une négligence : un tableau
        compte quelques dizaines de cartes, sa lecture coûte moins d'une
        milliseconde, et une copie en mémoire serait une seconde vérité que deux
        récupérations concurrentes feraient diverger. Le disque tranche.

        L'ordre est celui du collage — le plus récent en tête, comme la grille.
        """
        self._exige(projet)
        lues = [Carte.depuis_json(c) for c in self._fichiers.parcourir_cartes(projet)]
        return sorted(lues, key=lambda c: c.cree_le, reverse=True)

    def carte(self, projet: str, identifiant: str) -> Carte:
        contenu = self._fichiers.lire_carte(projet, identifiant)
        if contenu is None:
            raise CarteInconnue(identifiant)
        return Carte.depuis_json(contenu)

    def octets(self, projet: str, identifiant: str) -> tuple[bytes, str]:
        """Les octets d'une carte image, tels qu'ils sont entrés."""
        carte = self.carte(projet, identifiant)
        if carte.fichier is None or not self._fichiers.existe(carte.fichier):
            raise CarteInconnue(identifiant)
        return self._fichiers.lire(carte.fichier), carte.type_media or "image/png"

    # ── Coller ───────────────────────────────────────────────────────────────

    def poser_asset(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Une copie de ce rendu sur la toile ; le lien et l’original restent."""
        self._exige(projet)
        asset = self._assets.lire(identifiant)
        if asset is None or asset.projet != projet:
            raise CarteRefusee("Cette image n’appartient pas au jeu choisi.")
        octets, _ = self._assets.octets(asset)
        resultat = self.coller_image(projet, octets, nom=identifiant, source=f"asset:{identifiant}")
        carte = self.carte(projet, (resultat["carte"] or resultat["doublon"])["identifiant"])
        # Un doublon déjà disposé garde sa place. Une nouvelle carte se pose
        # à côté des existantes, visible dès l’arrivée dans la toile.
        if carte.position is None:
            autres = [c for c in self.cartes(projet) if c.position is not None]
            carte.position = (max((c.position[0] + (c.largeur_libre or 240) for c in autres), default=-30) + 30, 0)
            self._sauver(carte)
        return {"carte": carte.en_json(), "deja_presente": resultat["doublon"] is not None}

    def poser_clip(self, projet: str, clip: str) -> dict[str, Any]:
        """Un clip du jeu paraît sur la toile, **et il s'y rejoue**.

        **La carte ne garde pas de copie de la vidéo.** Elle porte la première
        image du clip — sa vignette, servie par la route d'image des cartes comme
        n'importe quelle autre — et sa `source` dit de quel clip il s'agit. Le
        lecteur va chercher le fichier là où il vit déjà. Copier les octets
        aurait doublé sur le disque ce qu'un clip d'une minute pèse, et surtout
        aurait créé une seconde vérité : jeter le clip aurait laissé sur la toile
        une carte qui joue une vidéo que le journal des dépenses ne connaît plus.

        Marche pour une vidéo importée comme pour un clip payé : à ce niveau, la
        différence ne se voit pas, et c'est le but.
        """
        self._exige(projet)
        # Une commande de clip **est** une génération : elle se relit comme telle,
        # et le dépôt suffit — pas besoin de dépendre du service d'animation.
        generation = self._base.lire(clip)
        if generation is None or generation.clip is None:
            raise CarteRefusee("Ce clip n’existe pas dans l’atelier.")
        if generation.projet is not None and generation.projet != projet:
            raise CarteRefusee("Ce clip n’appartient pas au jeu choisi.")
        couverture = self._fichiers.dossier_images_clip(clip, 0) / "0000.png"
        if not couverture.is_file():
            raise CarteRefusee(
                generation.clip.extraction_refus
                or "Les images de ce clip n’ont pas été tirées : il n’a rien à montrer."
            )
        resultat = self.coller_image(
            projet,
            couverture.read_bytes(),
            nom=clip,
            source=f"clip:{clip}",
            genre=VIDEO,
            # **Deux clips qui commencent par la même image restent deux cartes.**
            # L'empreinte est celle de la vignette, pas celle de la vidéo : sans
            # ce `forcer`, poser le second rendrait la carte du premier, qui
            # rejouerait le mauvais fichier.
            forcer=True,
        )
        carte = self.carte(projet, resultat["carte"]["identifiant"])
        if carte.position is None:
            autres = [c for c in self.cartes(projet) if c.position is not None]
            carte.position = (max((c.position[0] + (c.largeur_libre or 240) for c in autres), default=-30) + 30, 0)
            self._sauver(carte)
        return {"carte": carte.en_json(), "deja_presente": False}

    def coller_image(
        self,
        projet: str,
        octets: bytes,
        *,
        nom: str = "",
        source: str = "",
        forcer: bool = False,
        genre: str = IMAGE,
    ) -> dict[str, Any]:
        """Des octets deviennent une carte image — ou un refus, ou un doublon.

        Rend `{"carte": …, "doublon": …}`, et l'un des deux est toujours nul.

        **Le doublon n'est pas un refus**, et c'est pour ça qu'il ne lève pas :
        « je veux être averti d'un doublon avec un lien vers l'existant, tout en
        gardant la possibilité d'importer quand même » (US-46). Une erreur
        obligerait l'écran à traduire un échec en proposition ; une réponse qui
        porte la carte existante lui donne directement de quoi faire le lien.
        Rappeler avec `forcer` colle quand même.
        """
        self._exige(projet)
        propre = nom.strip() or "l'image collée"
        try:
            mesure = mesurer(octets)
        except ValueError:
            # **Le message de Pillow ne franchit pas cette ligne.** Il est en
            # anglais et il nomme un tampon mémoire — « cannot identify image
            # file <_io.BytesIO object at 0x…> ». C'est le piège d'`httpx` de
            # T1, à l'identique : un message de bibliothèque qui finit dans la
            # barre d'état. Ce qui compte, et que le PRD demande, c'est **quel**
            # fichier pose problème parmi les douze qu'on vient de déposer.
            raise CarteRefusee(f"« {propre} » n'est pas une image") from None

        empreinte = empreinte_de(octets)
        if not forcer:
            for existante in self.cartes(projet):
                if existante.empreinte == empreinte:
                    return {"carte": None, "doublon": existante.en_json()}

        identifiant = uuid.uuid4().hex[:16]
        carte = Carte(
            identifiant=identifiant,
            projet=projet,
            # **Les octets sont ceux d'une image dans les deux cas.** Une carte
            # vidéo les reçoit de la première frame de son clip : ce qui change
            # est ce que la carte *est*, pas ce qu'on vient de mesurer.
            genre=genre,
            statut=PRETE,
            source=source.strip(),
            empreinte=empreinte,
            largeur=mesure.largeur,
            hauteur=mesure.hauteur,
            type_media=mesure.type_media,
            octets=mesure.octets,
            fichier=self._fichiers.ecrire_octets_carte(
                projet, identifiant, octets, extension(mesure.type_media)
            ),
        )
        self._sauver(carte)
        return {"carte": carte.en_json(), "doublon": None}

    def coller_texte(
        self,
        projet: str,
        texte: str,
        *,
        position: Iterable[float] | None = None,
        groupe: str = "",
        teinte: str = AUCUNE,
    ) -> Carte:
        """Un texte devient une carte texte (US-44) — une intention au milieu
        des images, et non une ligne de plus dans la bible.

        **T9 lui donne une place à la naissance, et n'ouvre pas de second
        geste** (US-110). « Une note se pose à même la toile, créée là où elle
        s'applique plutôt qu'au bout d'une liste » : coller puis déplacer aurait
        fait paraître la note en réserve avant de la poser, c'est-à-dire à
        l'autre bout de l'écran de l'endroit qu'on vient de désigner — et aurait
        rendu possible l'état où elle est créée sans jamais avoir été posée.
        C'est la règle de la carte tirée dans un îlot, appliquée à sa naissance :
        **un seul appel dit les deux**.

        **Et elle naît dans l'îlot où on l'a posée**, s'il y en avait un. Ce
        n'est pas une seconde règle : c'est *la* règle du plan, celle que tout
        ce qui atterrit dessus suit déjà — une carte lâchée dans un îlot y écrit
        son groupe. La laisser hors groupe aurait fait qu'une note posée au
        milieu d'un îlot n'en soit pas membre, puis le devienne au premier pixel
        de déplacement : deux réponses à la même question, à un pixel d'écart.
        C'est l'écran qui dit dans quel îlot le point tombe — il le sait déjà,
        c'est le même calcul qu'au relâchement d'une carte.

        Un texte **collé**, lui, n'a aucun point : il n'envoie ni place ni
        groupe et attend en réserve, comme tout ce qui entre par le collage.
        """
        self._exige(projet)
        propre = texte.strip()
        if not propre:
            raise CarteRefusee("une carte texte a besoin d'un texte")
        if teinte and teinte not in TEINTES:
            raise CarteRefusee(_teintes_possibles(teinte))
        carte = Carte(
            identifiant=uuid.uuid4().hex[:16],
            projet=projet,
            genre=TEXTE,
            statut=PRETE,
            texte=propre,
            empreinte=empreinte_de(propre.encode("utf-8")),
            position=_place(position) if position is not None else None,
            groupe=groupe.strip(),
            teinte=teinte,
        )
        self._sauver(carte)
        return carte

    def coller_adresse(self, projet: str, adresse: str) -> Carte:
        """Une adresse devient une carte **en attente**, tout de suite (US-42).

        Elle est écrite sur le disque **avant** que la récupération ne parte :
        c'est ce qui fait que « la carte paraît en moins d'une seconde, et on
        continue à coller pendant ce temps ». Écrire après aurait fait dépendre
        l'apparition de la carte du temps de réponse d'un serveur inconnu.

        La récupération elle-même est un second geste, `recuperer`. Les séparer
        n'est pas une commodité : c'est ce qui rend « elle se réessaie » (US-43)
        gratuit, puisque réessayer, c'est refaire le second geste sur une carte
        qui existe déjà.
        """
        from atelier.fournisseur.toile import AdresseRefusee, verifier

        self._exige(projet)
        try:
            propre = verifier(adresse)
        except AdresseRefusee as erreur:
            raise CarteRefusee(erreur.raison) from None

        carte = Carte(
            identifiant=uuid.uuid4().hex[:16],
            projet=projet,
            genre=IMAGE,
            statut=ATTENTE,
            source=propre,
        )
        self._sauver(carte)
        return carte

    def lancer_recuperation(self, projet: str, identifiant: str) -> None:
        """Part chercher l'image sans faire attendre l'appelant.

        La tâche est retenue le temps qu'elle vive : une tâche `asyncio` que
        personne ne garde peut être ramassée avant de finir, et la carte
        resterait en attente pour toujours sans que rien ne le dise.
        """
        tache = asyncio.create_task(self._recuperer(projet, identifiant))
        self._en_vol.add(tache)
        tache.add_done_callback(self._en_vol.discard)

    async def recuperer(self, projet: str, identifiant: str) -> Carte:
        """Va chercher l'image d'une carte en attente, et attend le résultat.

        C'est le geste de « réessayer » (US-43), et celui que les essais
        empruntent. `lancer_recuperation` est le même, sans l'attente.
        """
        return await self._recuperer(projet, identifiant)

    async def _recuperer(self, projet: str, identifiant: str) -> Carte:
        from atelier.fournisseur.toile import AdresseRefusee, recuperer

        carte = self.carte(projet, identifiant)
        if carte.genre != IMAGE or not carte.source:
            raise CarteRefusee("cette carte ne vient pas d'une adresse")

        carte.statut = ATTENTE
        carte.raison = None
        self._sauver(carte)

        try:
            distante = await recuperer(carte.source)
            mesure = mesurer(distante.octets)
        except AdresseRefusee as erreur:
            return self._echouer(carte, erreur.raison)
        except ValueError:
            # L'adresse a répondu, mais pas avec une image. On le dit avec ce
            # que l'hébergeur prétendait rendre : « text/html » explique une
            # page d'erreur mieux que « fichier illisible ».
            return self._echouer(
                carte, "l'adresse ne rend pas une image"
            )

        carte.empreinte = empreinte_de(distante.octets)
        carte.largeur = mesure.largeur
        carte.hauteur = mesure.hauteur
        carte.type_media = mesure.type_media
        carte.octets = mesure.octets
        carte.fichier = self._fichiers.ecrire_octets_carte(
            projet, carte.identifiant, distante.octets, extension(mesure.type_media)
        )
        carte.statut = PRETE
        carte.raison = None
        self._sauver(carte)
        # Une image récupérée peut être un artwork si l'auteur l'a promue
        # pendant l'attente : la palette se remet donc à jour ici aussi.
        self._accorder(projet)
        return carte

    def _echouer(self, carte: Carte, raison: str) -> Carte:
        """La carte reste, avec son adresse et sa raison (US-43).

        Elle ne se retente pas toute seule : « rien n'est jamais relancé
        automatiquement » vaut ici comme pour une génération interrompue.
        """
        carte.statut = ECHOUEE
        carte.raison = raison
        self._sauver(carte)
        return carte

    # ── Régler une carte ─────────────────────────────────────────────────────

    def regler(
        self,
        projet: str,
        identifiant: str,
        *,
        groupe: str | None = None,
        note: str | None = None,
        taille: int | None = None,
        position: Iterable[float] | None = None,
        largeur_libre: int | None = None,
        texte: str | None = None,
        teinte: str | None = None,
    ) -> Carte:
        """Grouper, annoter, régler la taille — et poser sur la toile (US-47, T8).

        Cinq réglages en un seul geste parce qu'ils vivent au même endroit —
        la carte — et qu'un appel par champ ferait autant d'allers-retours pour
        un formulaire qu'on remplit d'un coup.

        **T8 y ajoute la place, et n'ouvre pas une seconde route pour elle.** La
        raison est celle d'origine, renforcée : tirer une carte dans un îlot écrit
        sa position *et* son groupe, et deux appels rendraient possible un état où
        l'un est écrit et l'autre non — c'est-à-dire très exactement la divergence
        que toute la tranche est là pour empêcher.

        **`None` ne touche pas, le vide efface.** C'est déjà la convention de
        `groupe`, où `""` sort la carte de son îlot ; `position=[]` la sort du
        plan. Ramener une carte en réserve est donc un seul appel qui dit les deux
        — ni classée, ni posée.
        """
        carte = self.carte(projet, identifiant)
        avant = carte.groupe
        if groupe is not None:
            carte.groupe = groupe.strip()
        if note is not None:
            carte.note = note.strip()
        if taille is not None:
            if taille not in TAILLES:
                raise CarteRefusee(
                    "la taille d'affichage vaut " + ", ".join(f"{t}×" for t in TAILLES)
                )
            carte.taille = taille
        if position is not None:
            carte.position = _place(position)
        if largeur_libre is not None:
            if not LARGEUR_MIN <= largeur_libre <= LARGEUR_MAX:
                raise CarteRefusee(
                    f"une largeur sur la toile va de {LARGEUR_MIN} à {LARGEUR_MAX} px"
                )
            carte.largeur_libre = largeur_libre
        if texte is not None:
            # **Le texte d'une note se corrige**, et c'est T9 qui l'ouvre : sans
            # ça, réparer une faute demanderait de retirer la note et de la
            # recoller — donc de perdre sa place, sa teinte et les liens qui y
            # aboutissent, c'est-à-dire tout ce que cette tranche vient
            # d'ajouter. Le trou datait de T4 et ne s'était jamais vu, parce
            # qu'une note au bout d'une liste se retape sans rien perdre.
            propre = texte.strip()
            if carte.genre != TEXTE:
                raise CarteRefusee("seule une note porte un texte")
            if not propre:
                raise CarteRefusee("une carte texte a besoin d'un texte")
            carte.texte = propre
            # L'empreinte suit le texte : c'est elle qui dit « tu as déjà
            # celle-ci », et une empreinte qui ne suit plus son contenu est une
            # seconde vérité — la panne que `cree_le` avait déjà causée sur la
            # grille (`docs/PIEGES.md`).
            carte.empreinte = empreinte_de(propre.encode("utf-8"))
        if teinte is not None:
            # **Une carte image ne porte aucune couleur d'organisation** (US-111,
            # critère d'acceptation). Le refus est ici et pas à l'écran : une
            # règle que seule l'interface tiendrait serait fausse dès le premier
            # appel qui ne vient pas d'elle.
            if teinte and carte.genre != TEXTE:
                raise CarteRefusee(
                    "seule une note porte une teinte — une carte image se range "
                    "par son groupe"
                )
            if teinte and teinte not in TEINTES:
                raise CarteRefusee(_teintes_possibles(teinte))
            carte.teinte = teinte
        self._sauver(carte)
        # **Le groupe qui vient de perdre sa dernière carte n'existe plus**, et
        # ce qui pendait à lui non plus : son cadre n'a plus rien à englober,
        # donc un lien qui y aboutissait pointe vers rien et sa teinte n'a plus
        # rien à teindre. C'est le geste qui l'a vidé qui l'emporte, jamais un
        # balayage — et seulement quand le groupe a bougé, pour qu'annoter une
        # carte ne relise pas toute la toile.
        if groupe is not None and carte.groupe != avant:
            self._elaguer(projet)
        return carte

    # ── Découper une carte ───────────────────────────────────────────────────
    #
    # **L'écran de découpe gagne une seconde porte d'entrée, et rien de plus**
    # (maquette `06bis-decouper-une-carte.html`). L'outil existe entier depuis
    # U8 — l'image à gauche, les rectangles qu'on dessine, une détection qui
    # propose sans jamais décider — et il ne s'ouvrait que sur une image
    # produite. Ce qui traverse la frontière des deux familles est **l'outil**,
    # jamais l'image : un morceau de carte est une carte, pas un asset. Elle ne
    # s'exporte pas, ne compte pas dans la bibliothèque, et n'a ni recette ni
    # rendu.
    #
    # **Rien n'est modifié sur place.** Une carte ne change jamais sous son
    # identifiant — c'est ce qui autorise le cache éternel de son image —, donc
    # découper fabrique des cartes neuves et laisse l'originale intacte.

    def proposer_decoupe(
        self,
        projet: str,
        identifiant: str,
        *,
        mode: str = AUTO,
        colonnes: int = 2,
        lignes: int = 1,
        cote_min: int = COTE_MIN,
    ) -> dict[str, Any]:
        """Où l'on pourrait couper cette carte. **Rien n'est créé, rien n'écrit.**

        **L'alpha du mode automatique est celui de la palette**, et ce n'est pas
        une commodité : c'est ce qui rend la proposition honnête. Les rectangles
        proposés sont exactement les zones que la palette lit — mesuré sur la
        planche de quatre nains de ce dépôt, quatre zones, une par personnage,
        sans qu'un réglage soit touché. Un second détourage ici montrerait des
        rectangles qui ne correspondraient à rien de ce que l'aperçu affiche.
        """
        if mode not in MODES:
            raise DecoupeRefusee(f"mode de découpe inconnu « {mode} »")
        carte = self.carte(projet, identifiant)
        if carte.genre != IMAGE:
            raise CarteRefusee("une carte texte ne se découpe pas")
        octets, _ = self.octets(projet, identifiant)

        raison: str | None = None
        if mode == GRILLE:
            if not 1 <= colonnes <= DECOUPES_MAX or not 1 <= lignes <= DECOUPES_MAX:
                raise DecoupeRefusee(f"la grille va de 1 à {DECOUPES_MAX} de côté")
            if colonnes * lignes > DECOUPES_MAX:
                raise DecoupeRefusee(
                    f"une carte se découpe en {DECOUPES_MAX} morceaux au plus"
                )
            boites = grille_fixe(carte.largeur, carte.hauteur, colonnes, lignes)
        else:
            alpha = alpha_du_sujet(octets)
            boites = zones_opaques(alpha, cote_min=max(0, cote_min))
            if not boites:
                # Deux vides, deux raisons, et l'auteur n'a pas le même geste à
                # faire selon laquelle : remonter le fond, ou descendre la
                # taille minimale.
                raison = (
                    "le fond a tout mangé — passe en grille fixe, ou dessine à la main"
                    if not alpha.any()
                    else "aucune zone au-dessus de cette taille — descends la taille"
                )

        return {
            "carte": carte.identifiant,
            "largeur": carte.largeur,
            "hauteur": carte.hauteur,
            "mode": mode,
            "boites": [list(b) for b in boites],
            "raison": raison,
        }

    def decouper_carte(
        self,
        projet: str,
        identifiant: str,
        boites: Iterable[Boite],
        *,
        remplacer: bool = False,
        noms: Iterable[str | None] | None = None,
    ) -> dict[str, Any]:
        """Chaque rectangle devient une carte du même tableau.

        **Les morceaux arrivent dans la réserve, non promus.** La réserve *est*
        l'endroit de ce qui n'est pas rangé — ni classé, ni posé —, et c'est la
        seule place qui ne demande à personne de deviner un rangement. Non
        promus, parce que « promouvoir reste un geste unique » : quatre
        promotions automatiques seraient quatre artworks que personne n'a
        choisis.

        **Ils héritent de la source, et de rien d'autre.** Une image dont on perd
        la provenance ne se crédite plus ni ne se retrouve.

        `remplacer` n'a de sens qu'avec **un seul** rectangle, et c'est alors un
        recadrage : le morceau prend tout ce qui faisait l'originale — sa
        promotion, sa famille, son groupe, sa place sur la toile, sa largeur, sa
        note — et l'originale s'en va. **C'est le seul endroit du produit où
        découper efface quelque chose**, et ça reste tenable pour la raison qui
        autorise déjà `oublier` sans confirmation : une carte n'a rien coûté.
        """
        carte = self.carte(projet, identifiant)
        if carte.genre != IMAGE:
            raise CarteRefusee("une carte texte ne se découpe pas")
        octets, _ = self.octets(projet, identifiant)
        rectangles = verifier_boites(
            boites, carte.largeur, carte.hauteur, quoi="carte"
        )
        if remplacer and len(rectangles) != 1:
            raise DecoupeRefusee(
                "prendre la place de l'originale demande un seul rectangle"
            )

        noms_recus = list(noms) if noms is not None else []
        nees: list[Carte] = []
        for numero, taillee in enumerate(decouper(octets, rectangles), start=1):
            mesure = mesurer(taillee)
            neuve = uuid.uuid4().hex[:16]
            # **Ce que l'écran a laissé nommer, jamais l'inverse.** Ignoré par
            # `remplacer` : ce morceau-là hérite de la note de l'originale, pas
            # d'un nom saisi pour une des zones du réglage manuel.
            nom = noms_recus[numero - 1] if numero - 1 < len(noms_recus) else None
            nom = nom.strip() if isinstance(nom, str) else None
            fille = Carte(
                identifiant=neuve,
                projet=projet,
                genre=IMAGE,
                statut=PRETE,
                source=carte.source,
                empreinte=empreinte_de(taillee),
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                type_media=mesure.type_media,
                note=nom or "",
                octets=mesure.octets,
                fichier=self._fichiers.ecrire_octets_carte(
                    projet, neuve, taillee, extension(mesure.type_media)
                ),
            )
            # **Le recadrage hérite, la découpe non.** Un morceau parmi plusieurs
            # ne peut pas prétendre être l'originale ; un morceau unique qui
            # vient prendre sa place le peut, et c'est exactement ce que l'auteur
            # a demandé en cochant la case.
            if remplacer:
                fille = replace(
                    fille,
                    officiel=carte.officiel,
                    famille=carte.famille,
                    groupe=carte.groupe,
                    note=carte.note,
                    taille=carte.taille,
                    position=carte.position,
                    largeur_libre=carte.largeur_libre,
                )
            self._sauver(fille)
            nees.append(fille)

        # **`oublier` referme le geste, et il fait les trois choses qu'il faut**
        # : effacer, élaguer les liens qui pendaient à la carte, et raccorder la
        # palette. Sans remplacement il n'y a rien à raccorder — aucun morceau
        # n'est promu, donc aucune couleur n'a bougé.
        retiree = self.oublier(projet, identifiant).en_json() if remplacer else None

        return {
            "carte": carte.identifiant,
            "morceaux": [c.en_json() for c in nees],
            "retiree": retiree,
            "univers": self._exige(projet).univers.en_json(),
        }

    # ── Ce que la palette lit d'une carte ────────────────────────────────────
    #
    # **Le détourage préalable de la palette existe depuis le premier jour, et
    # personne ne l'a jamais vu** : il ne laisse aucune trace. Mesuré sur les six
    # artworks officiels de ce dépôt, il écarte de 30 à 60 % des pixels — et sur
    # une capture d'écran promue en artwork, il garde le titre de l'interface et
    # la barre de vie, qui écrivent alors les couleurs du jeu.
    #
    # Ces deux méthodes ne règlent rien et n'écrivent rien. Elles montrent.

    def lecture_de_palette(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Quelle part de cette carte nourrit la palette du jeu.

        **`entiere` n'est pas un détail** : quand le détourage a tout mangé — une
        matière plein cadre, une texture sans bord franc —, la palette reprend
        l'image entière. Écrire « 0 % » serait alors faux au sens exactement
        inverse de ce qui se passe.
        """
        carte = self.carte(projet, identifiant)
        if carte.genre != IMAGE:
            raise CarteRefusee("une carte texte n'écrit aucune palette")
        octets, _ = self.octets(projet, identifiant)
        part = part_lue(octets)
        return {
            "carte": carte.identifiant,
            "part": round(part, 1),
            "entiere": part == 0.0,
            "largeur": carte.largeur,
            "hauteur": carte.hauteur,
        }

    def apercu_de_palette(self, projet: str, identifiant: str) -> bytes:
        """L'image, avec en magenta ce que la palette en écarte. Un PNG."""
        carte = self.carte(projet, identifiant)
        if carte.genre != IMAGE:
            raise CarteRefusee("une carte texte n'écrit aucune palette")
        return apercu_de_la_lecture(self.octets(projet, identifiant)[0])

    def promouvoir(
        self, projet: str, identifiant: str, *, officiel: bool, famille: str = TOUS
    ) -> Carte:
        """Promouvoir une carte en artwork officiel, et lui donner sa famille.

        **Un geste unique** (US-48, US-51) : après lui, il n'y a plus rien à
        sélectionner au moment de générer — c'est l'application qui choisit sur
        la famille. C'est aussi le geste qui refait la palette : promouvoir et
        rétrograder sont les deux seules choses qui changent ce qu'elle lit.
        """
        carte = self.carte(projet, identifiant)
        if officiel:
            if famille not in FAMILLES:
                raise CarteRefusee(f"famille inconnue « {famille} »")
            if carte.genre != IMAGE:
                raise CarteRefusee("une carte texte ne peut pas être un artwork")
            if carte.statut != PRETE:
                raise CarteRefusee("cette image n'est pas encore arrivée")
        carte.officiel = officiel
        carte.famille = famille if officiel else TOUS
        self._sauver(carte)
        self._accorder(projet)
        return carte

    def oublier(self, projet: str, identifiant: str) -> Carte:
        """La carte part, tout de suite et pour de bon.

        Pas d'annulation courte, contrairement à un asset : une carte n'a rien
        coûté et se recolle. Retirer un artwork officiel recalcule la palette,
        et le changement se voit (US-55).
        """
        carte = self.carte(projet, identifiant)
        self._fichiers.effacer_carte(projet, identifiant)
        self._diffusion.publier("carte", {**carte.en_json(), "oubliee": True})
        # **Un lien ne survit pas à son extrémité, et c'est la suppression qui
        # l'emporte** (`docs/ARCHITECTURE.md` §5). Un trait vers rien ne
        # représente rien, et une entrée morte sur le disque serait une deuxième
        # vérité qui attend son heure. L'élagage vient **après** l'effacement :
        # il lit ce qui reste, et ce qui reste ne contient plus cette carte-ci.
        self._elaguer(projet)
        self._accorder(projet)
        return carte

    # ── Les liens de la toile ────────────────────────────────────────────────────────
    #
    # « Ce que T8 permet de ranger, T9 permet de le dire » (`docs/PLAN.md`). Les
    # quatre gestes tiennent en quatre méthodes, et **aucune ne connaît la
    # géométrie** : où un trait passe, comment il se courbe, où son mot se pose,
    # c'est l'affaire de l'écran. Le service tient ce qui doit survivre à la
    # fermeture de l'onglet — qui est joint à qui, et ce qu'on en a dit.

    def liens(self, projet: str) -> list[Lien]:
        """Les liens d'une toile, relus du disque à chaque fois — comme les
        cartes, et pour la même raison : un cache en mémoire serait une seconde
        vérité, et une toile se lit en entier de toute façon.

        L'ordre est celui du tracé, le plus ancien d'abord. Un trait qui
        changerait de rang dans la liste changerait de rang dans le rendu, et
        deux traits qui se croisent se croiseraient dans l'autre sens à chaque
        relecture.
        """
        self._exige(projet)
        lus = [Lien.depuis_json(un) for un in self._fichiers.parcourir_liens(projet)]
        return sorted((un for un in lus if un is not None), key=lambda un: un.cree_le)

    def lien(self, projet: str, identifiant: str) -> Lien:
        for un in self.liens(projet):
            if un.identifiant == identifiant:
                return un
        raise LienInconnu(identifiant)

    def lier(
        self,
        projet: str,
        de: dict[str, str] | Bout,
        vers: dict[str, str] | Bout,
        *,
        mot: str = "",
        pointe: bool = False,
    ) -> Lien:
        """Tirer un trait d'un objet à un autre (US-108).

        **Il naît muet** : ni mot, ni pointe. Un trait nu dit déjà « ceci a
        rapport avec cela », et c'est le cas courant — demander le mot au moment
        du tracé ferait répondre, à chaque trait, à une question dont la réponse
        est presque toujours « rien ».

        **Les deux extrémités sont vérifiées ici, pas à l'écran.** Une carte
        s'efface, un groupe se vide, et l'onglet qui tire le trait peut avoir un
        rendu vieux d'une seconde : un lien écrit vers une extrémité qui n'existe
        plus serait exactement l'entrée morte que la tranche interdit.

        **`mot` et `pointe` existent pour l'annulation, et pour elle seule.**
        « Il naît muet » reste vrai : c'est une règle de l'écran, qui ne les
        envoie jamais en tirant un trait. Mais défaire une coupe, c'est reposer
        le lien **tel qu'il était** — et une route qui ne saurait reposer qu'un
        trait nu forcerait l'annulation à passer par un second appel pour lui
        rendre son mot, donc par un état intermédiaire où le geste est à moitié
        défait. T8 a déjà tranché cette question-là : deux appels pour un geste
        sont un état de trop.
        """
        self._exige(projet)
        premier, second = _bout(de), _bout(vers)
        if premier == second:
            raise LienRefuse("un lien joint deux objets, jamais un objet à lui-même")

        cartes = self.cartes(projet)
        for bout in (premier, second):
            if not _existe(bout, cartes):
                raise LienRefuse(_absent(bout))

        # **Deux traits entre les deux mêmes objets se posent l'un sur l'autre**,
        # donc le second est invisible — impossible à survoler, donc impossible à
        # couper. Le sens ne compte pas pour cette question-là, alors qu'il
        # compte pour la pointe : le trait dit *qu'il y a* un rapport, la pointe
        # dit lequel. Retourner un lien existant reste un geste ; en empiler un
        # second n'en est pas un.
        for existant in self.liens(projet):
            if meme_paire(existant, premier, second):
                raise LienRefuse("ces deux-là sont déjà joints")

        # **Le mot se vérifie avant que rien ne soit écrit.** Le poser après avoir
        # sauvé, en passant par `regler_lien`, laissait un lien **créé et muet**
        # derrière un refus 409 : le geste n'aurait été qu'à moitié refusé, et
        # l'auteur aurait vu paraître un trait qu'il n'a pas obtenu. C'est la
        # règle de `_ecrire_json` — *un fichier qui fait foi s'écrit entièrement
        # ou pas du tout* — vue du geste plutôt que du fichier.
        neuf = Lien(
            identifiant=uuid.uuid4().hex[:16],
            projet=projet,
            de=premier,
            vers=second,
            mot=_mot_valide(mot),
            pointe=pointe,
        )
        self._sauver_lien(neuf)
        return neuf

    def regler_lien(
        self,
        projet: str,
        identifiant: str,
        *,
        mot: str | None = None,
        pointe: bool | None = None,
    ) -> Lien:
        """Le mot et la pointe, ensemble (US-109) — *l'exception s'exprime*.

        **Les deux dans un seul appel**, comme les réglages d'une carte : ils se
        posent au même endroit, sur la même petite surface, et un appel par champ
        ferait deux allers-retours pour ce qu'on remplit d'un coup.

        **Le vide efface, l'absence ne touche pas** — la convention du produit
        depuis `groupe`. Retirer le mot d'un lien est donc un geste comme lui en
        donner un, et le trait redevient ce qu'il était en naissant.
        """
        un = self.lien(projet, identifiant)
        if mot is not None:
            un.mot = _mot_valide(mot)
        if pointe is not None:
            un.pointe = pointe
        self._sauver_lien(un)
        return un

    def couper(self, projet: str, identifiant: str) -> Lien:
        """Le trait part, tout de suite. Pas d'annulation courte, comme pour une
        carte : un lien n'a rien coûté. La toile en a une, en mémoire, qui vit le
        temps de l'écran (`docs/archive/plan-versions-tenues.md` T8)."""
        un = self.lien(projet, identifiant)
        self._fichiers.effacer_lien(projet, identifiant)
        self._diffusion.publier("lien", {**un.en_json(), "coupe": True})
        return un

    # ── Les teintes d'îlot ────────────────────────────────────────────────────────────

    def teintes(self, projet: str) -> dict[str, str]:
        """Les teintes des îlots d'un projet, telles qu'elles sont rangées.

        Relues du projet à chaque fois, comme les cartes du disque : la seule
        copie qui existe est celle du fichier.
        """
        return dict(self._exige(projet).teintes)

    def teinter(self, projet: str, groupe: str, teinte: str) -> Projet:
        """La teinte d'un îlot (US-111) — sur le projet, jamais sur ses cartes.

        Six membres feraient six vérités possibles pour un seul cadre
        (`docs/ARCHITECTURE.md` §5) : elle vit donc dans le fichier du projet,
        une entrée par nom de groupe.

        **Un îlot qui n'existe pas ne se teinte pas.** Un îlot *est* le groupe,
        et un groupe sans carte n'est écrit nulle part : accepter sa teinte
        écrirait une entrée que rien ne pourrait jamais montrer, et que rien ne
        viendrait jamais effacer — la définition d'une entrée morte.
        """
        objet = self._exige(projet)
        nom = groupe.strip()
        if not nom:
            raise UniversRefuse("un îlot se teinte par son nom de groupe")
        if teinte and teinte not in TEINTES:
            raise UniversRefuse(_teintes_possibles(teinte))
        if nom not in {c.groupe for c in self.cartes(projet) if c.groupe}:
            raise UniversRefuse(f"aucun îlot « {nom} » sur cette toile")

        teintes = dict(objet.teintes)
        # Le vide **efface l'entrée** au lieu de la mettre à « rien » : un îlot
        # sans teinte porte celle du châssis, et une entrée qui dirait « aucune »
        # serait un réglage posé qui ne règle rien.
        if teinte:
            teintes[nom] = teinte
        else:
            teintes.pop(nom, None)
        if teintes == objet.teintes:
            return objet

        objet.teintes = teintes
        self._bibliotheque.sauver_projet(objet)
        self._annoncer_univers(objet)
        return objet

    def deplacer_ilot(
        self, projet: str, groupe: str, places: Mapping[str, Iterable[float]]
    ) -> list[Carte]:
        """Déplacer un îlot entier — **un seul appel, parce que c'est un seul geste**.

        Un îlot n'a pas de position à lui : il *est* le groupe, et son étendue
        est celle de ses membres (`docs/ARCHITECTURE.md` §5). Le déplacer, c'est
        donc déplacer ses cartes — et c'est très exactement pourquoi ça ne peut
        pas être *n* appels. Un îlot de douze cartes écrit par douze `PUT` rend
        possible l'état où sept ont bougé et cinq sont restées : un îlot déchiré
        en deux moitiés, que personne n'a demandé et que rien ne rattrape. C'est
        la règle de T8 — « deux appels pour un geste sont un état de trop » —
        appliquée à un geste qui en aurait demandé douze.

        **Il se déplace entier, ou pas du tout.** Les places reçues doivent
        nommer *tous* ses membres et rien d'autre : une route qui accepterait un
        sous-ensemble serait un second `PUT /board/{carte}` déguisé, capable
        d'écrire des places en lot sous un nom de groupe qui ne les regarde pas.
        Et tout est vérifié **avant** que rien ne soit écrit, sans quoi le refus
        laisserait derrière lui la moitié du déchirement qu'il empêche.

        **Aucun groupe ne change, donc rien n'est élagué.** Déplacer un rangement
        ne reclasse pas ce qu'il contient : les cartes gardent leur groupe, l'îlot
        garde ses liens et sa teinte. Ce qui reclasse est le geste sur *une*
        carte, et lui seul.
        """
        nom = groupe.strip()
        if not nom:
            raise UniversRefuse("un îlot se déplace par son nom de groupe")
        membres = {c.identifiant: c for c in self.cartes(projet) if c.groupe == nom}
        if not membres:
            raise UniversRefuse(f"aucun îlot « {nom} » sur cette toile")

        etrangeres = sorted(set(places) - set(membres))
        if etrangeres:
            raise UniversRefuse(
                f"« {etrangeres[0]} » n'est pas une carte de l'îlot « {nom} »"
            )
        absentes = sorted(set(membres) - set(places))
        if absentes:
            raise UniversRefuse(
                f"un îlot se déplace entier : il manque {len(absentes)} "
                f"carte{'s' if len(absentes) > 1 else ''} de « {nom} »"
            )

        # Tout est validé d'abord, écrit ensuite. Une place refusée au milieu de
        # la boucle laisserait l'îlot à moitié déplacé — la panne même que cette
        # route existe pour empêcher.
        voulues: list[tuple[Carte, tuple[float, float]]] = []
        for identifiant, brut in places.items():
            place = _place(brut)
            if place is None:
                raise CarteRefusee(
                    "déplacer un îlot pose chacune de ses cartes : une place est "
                    "une paire de coordonnées"
                )
            voulues.append((membres[identifiant], place))

        for carte, place in voulues:
            carte.position = place
            self._sauver(carte)
        return [carte for carte, _ in voulues]

    # ── Ce qui ne survit pas à ses extrémités ───────────────────────────────────────────

    def _elaguer(self, projet: str) -> None:
        """Les liens et les teintes dont l'objet a disparu partent avec lui.

        **Appelé par le geste qui a fait disparaître l'objet, jamais en
        balayage** (`docs/ARCHITECTURE.md` §5) : supprimer une carte, ou sortir
        la dernière carte d'un groupe. Un nettoyage périodique aurait laissé
        exister, entre deux passages, l'état que toute la tranche interdit — un
        trait vers rien, et une teinte sur un îlot qui n'est plus dessiné.

        **Il lit ce qui reste, il ne devine pas ce qui est parti.** Lui passer
        l'identifiant supprimé aurait demandé à l'appelant de savoir *quelles*
        extrémités il vient d'invalider — or sortir une carte d'un groupe peut
        faire disparaître un îlot entier, donc une extrémité que personne n'a
        nommée. La liste de ce qui existe est la seule information juste.
        """
        cartes = self.cartes(projet)
        for un in self.liens(projet):
            if all(_existe(bout, cartes) for bout in un.bouts):
                continue
            self._fichiers.effacer_lien(projet, un.identifiant)
            self._diffusion.publier("lien", {**un.en_json(), "coupe": True})

        objet = self._exige(projet)
        groupes = {c.groupe for c in cartes if c.groupe}
        restantes = {nom: t for nom, t in objet.teintes.items() if nom in groupes}
        if restantes != objet.teintes:
            objet.teintes = restantes
            self._bibliotheque.sauver_projet(objet)
            self._annoncer_univers(objet)

    def _sauver_lien(self, un: Lien) -> None:
        """**Le seul endroit du dépôt qui écrive un lien.**

        Écrire d'abord, annoncer ensuite — comme une carte, comme un asset, comme
        une génération. Ce qui est annoncé est donc toujours déjà sur le disque.
        """
        self._fichiers.ecrire_lien(un.projet, un.identifiant, un.en_json())
        self._diffusion.publier("lien", un.en_json())

    # ── L'univers ────────────────────────────────────────────────────────────

    def univers(self, projet: str | None) -> Univers:
        """L'univers d'un projet — celui d'un projet inconnu est vide.

        Ne lève pas sur `None` : « sans projet » est une vue réelle de la
        bibliothèque, où l'on travaille sans que rien ne contraigne. Un univers
        vide y est la bonne réponse, pas une erreur.
        """
        if projet is None:
            return Univers(bible=bible_complete(()))
        objet = self._base.lire_projet(projet)
        return objet.univers if objet else Univers(bible=bible_complete(()))

    def palette(self, projet: str | None) -> tuple[str, ...]:
        """La palette du projet, remise d'accord avec ses artworks si besoin."""
        if projet is None:
            return ()
        return self._accorder(projet).univers.palette

    def fond_propose(self, projet: str | None) -> Proposition:
        """La couleur de fond que l'atelier propose à ce jeu-là — **ou rien** (D3).

        ⚠️ **N'atteint plus l'écran de réglage** (RT4, 20 septembre 2026) : la
        section qui en affichait le résultat a été retirée de `ReglesDuJeu.tsx`,
        et `GET /api/universe` ne sert plus `fond_propose`. Cette méthode reste
        pour l'écran de confirmation d'un envoi (`atelier.services.envoi._fond`,
        `Envoi.tsx`), qui laisse encore corriger le fond pour un seul appel.

        **Elle se calcule, elle ne s'enregistre pas.** La palette est déjà un
        cache nommé par sa provenance ; ranger à côté d'elle une couleur qui s'en
        déduit aurait été une seconde vérité qui se périme dès qu'un artwork
        entre. Le calcul est une poignée de soustractions sur une liste fermée :
        le refaire à chaque ouverture d'écran coûte moins que de le tenir à jour.

        ⚠️ **Elle lit la palette telle qu'elle est, sans la remettre d'accord**,
        et c'est la seule subtilité du chemin. `palette()` réaccorde la palette
        avec les artworks et **écrit** quand elle a changé : la brancher ici
        aurait fait d'une route de lecture une route qui modifie le projet
        qu'elle rend — ce que `tests/test_r1.py` a rattrapé dans l'heure, sur un
        essai qui vérifie qu'un réglage refusé ne laisse rien derrière lui.

        Sans projet, elle dit qu'il n'y a pas de palette — ce qui est vrai, et
        c'est la même réponse qu'un projet qui n'a pas encore d'artwork.
        """
        return proposer(self.univers(projet).palette)

    def regler_univers(
        self,
        projet: str,
        *,
        bible: Iterable[dict[str, Any]] | None = None,
        bareme: Iterable[dict[str, Any]] | None = None,
        style: str | None = None,
        cible_px: int | None = None,
        vue: str | None = None,
        couleurs: int | None = None,
        methode_pixels: str | None = None,
        fond: str | None = None,
        modeles: dict[str, str] | None = None,
        modele_planche: str | None = None,
        modele_edition: str | None = None,
        detourage_image: Any = NON_DIT,
        detourage_planche: Any = NON_DIT,
        detourages: Any = NON_DIT,
        son: dict[str, Any] | None = None,
    ) -> Projet:
        """Poser les réglages de l'univers. Tout est facultatif, rien ne lève à vide.

        **Les trois derniers ne suivent pas la convention des autres**, et c'est
        écrit ici pour qu'on ne s'y trompe pas en lisant vite. Partout ailleurs
        dans cette signature, `None` veut dire *ne touche pas à celui-là* ; pour
        le détourage par défaut (D1), `None` veut dire **remets-le au produit**,
        et *ne touche pas* est le sentinelle `NON_DIT`.

        La raison est qu'un défaut de détourage n'a pas de valeur vide. Une
        chaîne vide retire un modèle, un dictionnaire sans la clé retire une
        famille ; une passe, elle, est toujours quelque chose. Sans un troisième
        état, un réglage posé une fois ne pourrait plus jamais être retiré.
        """
        objet = self._exige(projet)
        univers = objet.univers

        if bible is not None:
            univers.bible = bible_complete(
                Champ.depuis_json(c) for c in bible if c.get("nom") in CHAMPS_BIBLE
            )

        if bareme is not None:
            # **Ce que le message ne dit pas, il ne l'efface pas** (E9). L'écran
            # du barème envoie la famille, l'occupation et la silhouette ; il
            # n'envoie pas la liste de poses du type, qui se règle ailleurs et
            # par une autre route. Reconstruire l'échelle à partir du seul
            # message aurait donc vidé cette liste à chaque curseur déplacé —
            # exactement la panne payée en E5, quand poster une recette effaçait
            # la différence d'un calque (`docs/PIEGES.md`).
            connues = {e.nom: e.poses for e in univers.bareme}
            echelles = tuple(
                _avec_poses_gardees(Echelle.depuis_json(e), connues) for e in bareme
            )
            noms = [e.nom.strip() for e in echelles]
            if any(not n for n in noms):
                raise UniversRefuse("une échelle a besoin d'un nom")
            if len(set(noms)) != len(noms):
                raise UniversRefuse("deux échelles portent le même nom")
            # **Le plafond du barème est ce que la case peut porter** (tranche des
            # tailles, 3 septembre 2026). C'est ici que la fermeture se payait le
            # plus cher : le barème est l'endroit même où l'on dit *un moulin est
            # plus haut qu'un personnage*, et il refusait de l'entendre. 300 % se
            # lit trois personnages, et la case grandit d'autant.
            #
            # **Sans taille imposée, on juge contre la case par défaut.** Un jeu
            # en dessin n'a pas de grille, donc l'occupation n'y sert à rien de
            # mécanique ; refuser au nom d'une case qui n'existe pas serait un
            # refus sans objet, et l'accepter sans borne laisserait entrer
            # n'importe quel nombre.
            haut = occupation_max(univers.cible_px or CIBLE_PAR_DEFAUT)
            for echelle in echelles:
                if echelle.famille not in FAMILLES:
                    raise UniversRefuse(f"famille inconnue « {echelle.famille} »")
                if not 1 <= echelle.occupation <= haut:
                    raise UniversRefuse(
                        f"« {echelle.nom} » : l'occupation va de 1 à {haut} %"
                    )
            univers.bareme = echelles

        # **Le style se pose avant la taille, et c'est l'ordre qui compte** (D2).
        # Il décide de ce que la taille veut dire — un nombre de carrés ou une
        # finesse —, donc il doit être posé quand la taille arrive dans le même
        # message. Posés dans l'autre ordre, une taille de 1024 envoyée avec le
        # style « dessin » serait jugée contre la liste du pixel art.
        if style is not None:
            if style not in STYLES:
                connus = " » « ".join(STYLES)
                raise UniversRefuse(
                    f"style graphique inconnu « {style} » — "
                    f"les styles sont « {connus} »"
                )
            change = style != univers.style
            univers.style = style
            # **Changer de style déplace la taille quand elle n'a plus de sens**,
            # et seulement alors : un jeu à 64 carrés qui passe en dessin
            # garderait une finesse de 64, c'est-à-dire une vignette. Voir
            # `cible_du_changement`. Le nouvel univers repart dans la réponse,
            # donc l'écran montre tout de suite ce qui s'applique.
            if change and cible_px is None:
                univers.cible_px = cible_du_changement(style, univers.cible_px)
            # **Et la façon de réduire suit, quand personne ne l'a choisie.**
            # Le vote en deux temps donne le sprite qu'on veut en pixel art et
            # posterise un dessin ; la réduction douce fait l'inverse. Règle de
            # D1 mot pour mot : on ne réécrit que ce qui était resté au défaut.
            if change and methode_pixels is None:
                univers.methode_pixels = methode_du_changement(
                    style, univers.methode_pixels
                )

        if cible_px is not None:
            # **« Aucune » est une valeur, pas un trou** (US-163) : zéro dit
            # « ce que le modèle a rendu me revient tel quel ». Elle passe donc
            # *avant* le contrôle de bornes plutôt que d'élargir le minimum à
            # zéro — élargir aurait laissé entrer 1, 2 et 4 pixels, qui ne sont
            # ni une échappatoire ni une grille.
            if cible_px != AUCUNE_CIBLE and not CIBLE_MIN <= cible_px <= CIBLE_MAX:
                raise UniversRefuse(
                    f"la taille de pixel cible va de {CIBLE_MIN} à {CIBLE_MAX} "
                    "pixels, ou aucune"
                )
            # **Un choix unique remplit le réglage et la phrase qui part**, et
            # c'est ce qui répare la contradiction mesurée du dépôt : le
            # réglage disait 128 pendant que le texte envoyé disait 64, trois
            # fois. Ce qui change le 1ᵉʳ septembre 2026 est **où la phrase
            # vit** : plus dans la case, mais calculée à l'envoi depuis ce
            # réglage-ci — `Univers.phrase_du_produit`. Le geste unique reste
            # unique ; il n'a simplement plus rien à recopier.
            univers.cible_px = cible_px

        if vue is not None:
            connue = vue_connue(vue)
            if vue and connue is None:
                raise UniversRefuse(f"vue inconnue « {vue} »")
            # Même changement, et la seconde moitié du même geste : la phrase de
            # cadrage se lit dans la vue plutôt que d'être recopiée dans la
            # case. **Le nombre de directions, lui, ne part plus dans le
            # texte** — retiré le 31 août 2026, parce qu'il contredisait la
            # consigne des six planches d'équipement du projet, et que chaque
            # image dit déjà elle-même la direction qu'elle montre.
            univers.vue = vue

        if couleurs is not None:
            if not COULEURS_MIN <= couleurs <= COULEURS_MAX:
                raise UniversRefuse(
                    f"la palette compte de {COULEURS_MIN} à {COULEURS_MAX} couleurs"
                )
            univers.couleurs = couleurs

        if methode_pixels is not None:
            # **Refusée par son nom, et par son absence** (D2) — deux motifs
            # distincts, et deux phrases distinctes. Un nom qui n'existe pas est
            # une faute de l'appelant ; une méthode qui n'est pas installée sur
            # cette machine n'en est pas une, et lui répondre « inconnue » ferait
            # chercher une faute de frappe là où il manque une bibliothèque.
            if methode_pixels not in METHODES_DE_REDUCTION:
                connues = " » « ".join(METHODES_DE_REDUCTION)
                raise UniversRefuse(
                    f"méthode de pixelisation inconnue « {methode_pixels} » — "
                    f"les méthodes sont « {connues} »"
                )
            manque = raison_methode(methode_pixels)
            if manque is not None:
                raise UniversRefuse(manque)
            univers.methode_pixels = methode_pixels

        # ── Le fond du jeu (D3), et son seul écrivain restant ─────────────────
        #
        # ⚠️ **La route ne le transmet plus** (RT4, 20 septembre 2026) : le fond
        # n'est plus un réglage, l'atelier le calcule à chaque demande. Ce
        # paramètre ne sert donc plus qu'à monter un jeu d'avant la tranche —
        # ce que font les essais qui vérifient qu'un tel jeu se relit sans
        # erreur. Aucun écran ne l'atteint.
        #
        # **Une couleur hors palette se pose, elle ne se refuse pas**, et c'est
        # la règle du dépôt reprise telle quelle : l'atelier *propose* une
        # couleur sûre, il ne l'impose jamais. Ce qui se refuse ici est une
        # chaîne qui n'est pas une couleur du tout — six chiffres hexadécimaux,
        # rien d'autre —, parce qu'elle partirait dans le texte payé et se
        # relirait des mois plus tard sur la génération enregistrée.
        #
        # **La chaîne vide retire le fond**, et c'est le seul geste de retrait
        # dont ce réglage ait besoin : une couleur est toujours quelque chose,
        # donc « jamais posé » et « posé sur rien » sont le même état — l'inverse
        # exact du détourage par défaut, qui a besoin de ses trois états.
        if fond is not None:
            propre = fond.strip()
            if propre and not fond_valide(propre):
                raise UniversRefuse(
                    f"« {propre} » n'est pas une couleur — le fond s'écrit en "
                    f"six chiffres hexadécimaux, par exemple #FF00FF"
                )
            univers.fond = fond_valide(propre)

        if modeles is not None:
            inconnues = set(modeles) - set(FAMILLES)
            if inconnues:
                noms = " » « ".join(sorted(inconnues))
                raise UniversRefuse(f"famille inconnue « {noms} »")
            univers.modeles = {f: m for f, m in modeles.items() if m}

        # **Les deux modèles d'appel, et aucune famille à valider** : ce sont des
        # identifiants de modèle, et le catalogue décide seul de ce qu'ils
        # valent — un modèle disparu se grise avec sa raison au moment de
        # générer, comme n'importe quel autre. Le vide les remet au défaut.
        if modele_planche is not None:
            univers.modele_planche = modele_planche.strip()
        if modele_edition is not None:
            univers.modele_edition = modele_edition.strip()

        # ── Le détourage par défaut (D1) ─────────────────────────────────────
        #
        # **La relecture nettoie, elle ne refuse pas.** `passe_par_defaut` retire
        # ce qui n'appartient qu'à une image — le point de la pipette, le tracé,
        # le masquage — et ramène un moteur inconnu au bord. Un moteur mal
        # orthographié n'a donc pas à lever ici : il arrive sans effet, comme
        # partout ailleurs dans le produit.
        if detourage_image is not NON_DIT:
            univers.detourage_image = passe_par_defaut(detourage_image)
        if detourage_planche is not NON_DIT:
            univers.detourage_planche = passe_par_defaut(detourage_planche)
        if detourages is not NON_DIT:
            # **La famille, elle, se refuse** — et c'est la même règle que les
            # modèles par famille juste au-dessus : une clé inventée est une
            # faute d'appelant, pas un réglage sans effet. Une famille absente du
            # message est retirée, comme un modèle vidé.
            lues = detourages or {}
            inconnues = set(lues) - set(FAMILLES)
            if inconnues:
                noms = " » « ".join(sorted(inconnues))
                raise UniversRefuse(f"famille inconnue « {noms} »")
            univers.detourages = {
                famille: passe
                for famille, brut in lues.items()
                if (passe := passe_par_defaut(brut)) is not None
            }

        # **Le bloc sonore** (SN2) : ce que le message en dit, et seulement ça.
        if son is not None:
            try:
                univers.son = univers.son.regle(son)
            except ValueError as e:
                raise UniversRefuse(str(e)) from e

        self._bibliotheque.sauver_projet(objet.avec(univers))
        # Le compte de couleurs fait partie de ce que la palette lit : le
        # changer la périme, exactement comme promouvoir un artwork.
        accorde = self._accorder(projet, annoncer=False)
        # **Un réglage posé s'annonce toujours, et c'est ici que ça se décide.**
        # `_accorder` n'annonce que lorsque l'empreinte de palette a bougé —
        # changer la cible de pixel, la bible, le barème ou un modèle ne la
        # périme pas. Le réglage était donc bien écrit sur le disque et
        # n'arrivait à aucun onglet, pas même à celui qui venait de le poser :
        # seul « couleurs » se voyait, parce que lui seul passe par la palette.
        # L'accord ne s'annonce pas de son côté pour que l'annonce reste
        # **unique** — deux messages pour un geste feraient redemander l'état
        # et le catalogue deux fois.
        self._annoncer_univers(accorde)
        return accorde

    def consequences(self, projet: str, *, cible_px: int | None = None) -> dict[str, Any]:
        """Ce qu'un changement de taille casserait, avant qu'on le fasse (E8).

        **Le plus coûteux des dix réglages, et de loin.** Tout ce qui a été
        fabriqué a été découpé à l'ancienne taille ; les images ne se recoupent
        pas, il faut les refabriquer, et chacune se paie. La ligne le dit avec
        le compte et le coût estimé — puis laisse passer.

        **Le coût vient de ce qui a été payé dans ce jeu**, jamais d'un tarif
        écrit ici : un prix moyen d'appel change avec le modèle, et un chiffre
        en dur aurait vieilli au premier changement de catalogue. Sans aucun
        appel payé, il vaut zéro, et l'écran dit alors seulement le compte.
        """
        objet = self._exige(projet)
        actuelle = objet.univers.cible_px
        if cible_px is None or cible_px == actuelle:
            return ConsequencesDuReglage(cible=actuelle).en_json()

        images = [
            a
            for a in self._bibliotheque.chercher(projet=projet, limite=100_000)
            if a.recette.grille is not None and a.recette.grille.cible == actuelle
        ]
        payantes = [a.cout_usd for a in images if a.cout_usd > 0]
        moyen = (sum(payantes) / len(payantes)) if payantes else 0.0
        return ConsequencesDuReglage(
            images=len(images),
            cout_usd=moyen * len(images),
            cible=actuelle,
        ).en_json()

    # ── Ce qui part avec une génération ──────────────────────────────────────

    def artworks(self, projet: str | None, famille: str | None) -> list[Carte]:
        """Les artworks qui accompagnent un sujet de cette famille-là (US-51).

        Ceux de la famille du sujet, **plus ceux marqués « tous »** — la planche
        non figurative qui transmet la manière sans transmettre un personnage
        (US-50). C'est l'application qui choisit ; l'auteur n'a rien à
        sélectionner, il a promu une fois.

        Le banc 2 du 26 août dit pourquoi ce filtre existe : un artwork figuratif
        contamine les sujets suivants — le squelette héritait de la tunique et
        des bottes lacées du goblin, la prêtresse de ses oreilles vertes. Ce
        n'est pas un style, c'est la perte de l'espèce demandée.

        Sans famille — l'auteur n'a pas dit ce qu'il fabrique —, seuls les
        « tous » partent : la manière, jamais un personnage.
        """
        if projet is None:
            return []
        retenus = [
            carte
            for carte in self.cartes(projet)
            if carte.artwork and carte.famille in ({TOUS, famille} if famille else {TOUS})
        ]
        # Trié par identifiant, pas par date : deux appels de la même minute
        # doivent envoyer les mêmes images dans le même ordre, et une carte
        # recollée ne doit pas réordonner ce qui part.
        return sorted(retenus, key=lambda c: c.identifiant)

    def references(self, projet: str | None, famille: str | None) -> tuple[Reinjection, ...]:
        """Les artworks, en réinjections prêtes à rejoindre celles de l'auteur.

        Toujours en rôle `style` : ils **inspirent**, ils n'engendrent pas. Un
        artwork en source d'édition donnerait une filiation vers une carte, que
        la bibliothèque ne connaît pas.
        """
        return tuple(
            Reinjection(asset=carte.identifiant, role=STYLE, origine=CARTE)
            for carte in self.artworks(projet, famille)
        )

    def echelle(self, projet: str | None, nom: str | None) -> Echelle | None:
        """L'échelle nommée dans le barème du projet, ou rien.

        Un nom inconnu est refusé plutôt que corrigé : un onglet resté ouvert
        après qu'on a renommé une échelle enverrait sinon un sujet à 100 %
        d'occupation sans que rien ne le dise.
        """
        if projet is None or not nom:
            return None
        trouvee = self.univers(projet).echelle(nom)
        if trouvee is None:
            raise UniversRefuse(f"« {nom} » n'est pas une échelle de ce projet")
        return trouvee

    def prompt(self, projet: str | None) -> str:
        """La bible active, repliée en tête du prompt (US-53).

        **Ici et pas chez l'adaptateur** : c'est une décision du produit — quels
        champs partent —, pas une traduction de fournisseur. L'adaptateur, lui,
        replie le prompt négatif, parce que c'est le contrat d'OpenRouter qui
        l'y oblige.

        Les intitulés sont en anglais parce que le prompt l'est : tous les
        modèles du catalogue sont entraînés dessus, et « Éclairage : » dégraderait
        ce que « Lighting: » obtient.
        """
        from atelier.domaine.projet import INTITULES

        univers = self.univers(projet)
        lignes = [
            f"{INTITULES.get(champ.nom, champ.nom)}: {champ.texte.strip()}"
            for champ in univers.bible
            if champ.porte
        ]
        return "\n".join(lignes)

    def octets_reference(self, projet: str, identifiant: str) -> bytes:
        """Les octets d'un artwork, pour le fournisseur.

        Rendus **tels quels** : le type se lit sur les octets chez l'adaptateur,
        et convertir ici ferait deux endroits qui décident du format.
        """
        octets, _ = self.octets(projet, identifiant)
        return octets

    # ── La palette rétroactive ───────────────────────────────────────────────

    def realigner(self, projet: str, *, identifiants: Iterable[str] | None = None) -> dict[str, Any]:
        """Remet les assets du projet sur son univers — **sans un appel payant**.

        « Changer la palette d'un projet la réapplique à tous ses assets sans un
        seul appel payant » (US-67), et « les réglages faits à la main ne sont
        jamais écrasés » (US-68). Rend le compte des deux : « 12 remis à jour,
        3 conservés ».

        Trois choses que ce balayage **ne fait pas**, et chacune est une décision :

        - **Il ne passe pas par `poser_recette`**, qui épingle. Le premier
          passage épinglerait tout le projet, et le second ne remettrait plus
          rien à jour — la fonction s'annulerait elle-même à son deuxième usage.
        - **Il ne recalcule aucun rendu.** L'empreinte de la recette change,
          donc `rendu_a_jour` devient faux, donc le rendu est traité comme
          absent et se refait à la première fois qu'on le regarde, par le chemin
          qui existe déjà. Recalculer cent images ici ferait attendre l'auteur
          pour des rendus qu'il ne regardera peut-être jamais.
        - **Il ne touche pas au détourage.** Les passes restent celles de
          l'asset : ce sont elles qui coûtent 130 ms, et surtout ce sont elles
          que l'auteur a pu régler pour sauver un sujet difficile.

        `identifiants` réaligne une sélection plutôt que tout le projet — c'est
        le geste d'un épinglé qu'on fait rentrer dans le rang depuis sa fiche
        (US-69), et il force alors le désépinglage : le demander pour cet
        asset-là *est* la décision que l'épingle protégeait.
        """
        objet = self._exige(projet)
        univers = self._accorder(projet).univers

        vises = set(identifiants) if identifiants is not None else None
        remis, conserves, touches = 0, 0, []

        for asset in self._base.assets(projet=projet, limite=100_000):
            if vises is not None and asset.identifiant not in vises:
                continue
            if vises is None and asset.epingle:
                conserves += 1
                continue
            # **Un asset ramené au brut reste au brut.** Sa recette est vide, et
            # elle l'est parce que l'auteur l'a voulu : « revenir à l'image
            # d'origine est un seul geste » (US-64). Lui reposer une grille et
            # une palette défferait ce geste-là par un balayage qui ne le
            # concernait pas — et `revenir_au_brut` désépingle, donc l'épingle
            # ne le protège pas. Le vide **est** la décision.
            if vises is None and asset.recette.vide:
                conserves += 1
                continue
            # **Un calque n'est jamais réaligné, même demandé nommément.** Il
            # n'est pas une image que le projet cadre : il est calé au pixel sur
            # le corps de sa pose, et lui poser une grille le rééchantillonnerait
            # — le casque glisserait de la tête. La différence, elle, survivrait
            # au `replace` ci-dessous ; l'alignement, non, et c'est lui qui fait
            # tout l'intérêt de l'objet (`docs/archive/plan-versions-tenues.md`, C3).
            #
            # Il n'y perd rien : il hérite de la grille et de la palette du corps
            # **par construction**, puisque ses pixels sont ceux d'une image déjà
            # ramenée dans le cadre de ce corps.
            if asset.recette.calque:
                conserves += 1
                continue
            # **La feuille d'une planche refaite non plus** (RS2, 18 septembre
            # 2026), et pour la raison même qui la fait naître sans grille : la
            # grille met *un* sujet à l'échelle de sa case, et la feuille en
            # porte quatre. Le balayage la lui reposait — `replace` ci-dessous
            # remet une grille neuve à qui n'en a pas —, donc « Tout réaligner »
            # rendait la panne qu'on venait de réparer. Ses morceaux, eux, se
            # réalignent comme tout le monde. La génération n'est relue que pour
            # un asset sans grille : c'est le seul état où la feuille naît.
            if asset.recette.grille is None:
                generation = self._base.lire(asset.generation)
                if generation is not None and est_une_planche_refaite(
                    generation, asset.rang
                ):
                    conserves += 1
                    continue

            suivante = replace(
                asset.recette,
                # **Sans cible, la grille s'en va** (US-163). Elle ne se règle
                # pas à zéro : une grille de zéro pixel n'existe pas, et la
                # laisser posée à une valeur d'avant ferait mentir la fiche —
                # l'asset porterait une remise sur grille que le projet
                # n'impose plus. C'est aussi ce qui rend « Tout réaligner »
                # honnête : il ramène l'image aux dimensions rendues.
                grille=(
                    None
                    if univers.cible_px == AUCUNE_CIBLE
                    else univers.recette_de(None).grille
                    if asset.recette.grille is None
                    else replace(asset.recette.grille, cible=univers.cible_px)
                ),
                quantification=(
                    replace(
                        asset.recette.quantification or _quantification_neuve(univers),
                        couleurs=univers.couleurs,
                        palette=univers.palette,
                    )
                    if univers.palette
                    else asset.recette.quantification
                ),
            )
            if suivante == asset.recette and not asset.epingle:
                # Rien n'a bougé : l'asset était déjà d'accord avec l'univers.
                # Il compte quand même comme remis à jour — c'est ce que
                # l'auteur voit, et « 0 remis à jour » sur un projet déjà
                # aligné se lirait comme un échec.
                remis += 1
                continue

            asset.recette = suivante
            # **Un réalignement demandé désépingle**, et lui seul : c'est
            # l'auteur qui l'a demandé pour cet asset-là (US-69). Un balayage
            # de projet, lui, n'atteint jamais un épinglé.
            asset.epingle = False
            self._assets.sauver(asset, annoncer=False)
            touches.append(asset.identifiant)
            remis += 1

        # **Une seule annonce pour tout le lot.** La diffusion garde soixante-
        # quatre messages par abonné : un événement par asset ferait perdre les
        # plus anciens à un onglet lent au-delà de soixante-quatre images, et
        # l'écran redemanderait de toute façon la grille entière.
        self._annoncer_univers(objet, realignes=remis, conserves=conserves)
        return {
            "projet": projet,
            "realignes": remis,
            "conserves": conserves,
            "assets": touches,
            # **Ce que ce balayage-ci a remis, et ce qu'il n'a pas remis**
            # (US-163). Sans cible, il ne rééchantillonne rien : l'écran le dit
            # avec le compte plutôt que d'annoncer « 12 remis à jour » pour un
            # geste dont l'auteur attendait une remise sur grille qui n'a pas
            # eu lieu. Le serveur porte le fait, l'écran la phrase.
            "sur_grille": univers.cible_px != AUCUNE_CIBLE,
        }

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _exige(self, projet: str) -> Projet:
        objet = self._base.lire_projet(projet)
        if objet is None:
            raise ProjetInconnu(
                projet, [p.identifiant for p in self._bibliotheque.projets()]
            )
        return objet

    def _sauver(self, carte: Carte) -> None:
        """**Le seul endroit du dépôt qui écrive une carte.**

        Écrire d'abord, annoncer ensuite — comme un asset, comme une génération.
        Ce qui est annoncé est donc toujours déjà sur le disque.
        """
        self._fichiers.ecrire_carte(carte.projet, carte.identifiant, carte.en_disque())
        self._diffusion.publier("carte", carte.en_json())

    def _accorder(self, projet: str, *, annoncer: bool = True) -> Projet:
        """Remet la palette d'accord avec les artworks, si elle ne l'est plus.

        Ne recalcule que lorsque l'empreinte a changé : promouvoir, rétrograder,
        supprimer une carte, en récupérer une, ou changer le nombre de couleurs.
        Tout le reste — annoter, grouper, redimensionner — laisse la palette
        exactement où elle est, et ne coûte donc rien.

        **`annoncer` n'existe que pour un appelant qui annonce lui-même** —
        `regler_univers`, qui doit le faire *quoi qu'il arrive* et ne veut pas
        s'annoncer deux fois quand la palette a bougé en même temps.
        """
        objet = self._exige(projet)
        univers = objet.univers
        artworks = [c for c in self.cartes(projet) if c.artwork]
        empreinte = empreinte_palette(
            (c.empreinte for c in artworks), univers.couleurs
        )
        if empreinte == univers.palette_empreinte:
            return objet

        octets = []
        for carte in artworks:
            try:
                octets.append(self.octets(projet, carte.identifiant)[0])
            except (CarteInconnue, OSError):
                # Un fichier disparu sous la carte ne doit pas empêcher la
                # palette de se calculer sur les autres : elle se voit en moins,
                # elle ne se perd pas.
                continue

        univers.palette = palette_de(octets, univers.couleurs) if octets else ()
        univers.palette_empreinte = empreinte
        accorde = objet.avec(univers)
        self._bibliotheque.sauver_projet(accorde)
        if annoncer:
            self._annoncer_univers(accorde)
        return accorde

    def _annoncer_univers(
        self, objet: Projet, *, realignes: int = 0, conserves: int = 0
    ) -> None:
        """L'unique forme de l'annonce « quelque chose a changé sur ce projet ».

        **Écrite une fois parce qu'elle a gagné un champ en T9**, et que trois
        appelants qui composent le même message à trois endroits finissent par
        n'en composer que deux quand un champ s'ajoute. Les teintes voyagent avec
        l'univers sans être dedans : `Univers` est « ce que le projet impose à ce
        qui rentre », et une teinte d'îlot n'impose rien — c'est l'enveloppe qui
        les porte, pas l'objet.
        """
        self._diffusion.publier(
            "univers",
            {
                "projet": objet.identifiant,
                "nom": objet.nom,
                "univers": objet.univers.en_json(),
                "teintes": dict(objet.teintes),
                "realignes": realignes,
                "conserves": conserves,
            },
        )


def _place(brut: Iterable[float]) -> tuple[float, float] | None:
    """Ce que l'écran envoie comme place, vérifié avant d'être écrit.

    Une liste vide sort la carte du plan — c'est le geste « ramène-la en
    réserve ». Une paire la pose. **Tout le reste est refusé en le disant**, et
    l'infini en fait partie : une carte posée à l'infini n'est pas visible, elle
    est perdue, et le plan n'a aucun bord où la retrouver.
    """
    valeurs = [float(v) for v in brut]
    if not valeurs:
        return None
    if len(valeurs) != 2 or not all(math.isfinite(v) for v in valeurs):
        raise CarteRefusee("une place sur la toile est une paire de coordonnées")
    return (valeurs[0], valeurs[1])


def _bout(brut: dict[str, str] | Bout) -> Bout:
    """Une extrémité telle que l'écran l'envoie, vérifiée avant d'être écrite."""
    if isinstance(brut, Bout):
        return brut
    lu = Bout.depuis_json(brut)
    if lu is None:
        raise LienRefuse(
            "une extrémité de lien est une carte ou un îlot, et elle se nomme"
        )
    return lu


def _existe(bout: Bout, cartes: Iterable[Carte]) -> bool:
    """Cette extrémité désigne-t-elle encore quelque chose ?

    **Les deux genres se lisent sur la même liste**, et c'est la moitié de ce que
    « l'îlot *est* le groupe » veut dire : une carte existe si elle est là, un
    îlot existe s'il reste au moins une carte qui porte son nom. Il n'y a rien
    d'autre à consulter, et surtout pas un second rangement.
    """
    liste = list(cartes)
    if bout.genre == BOUT_CARTE:
        return any(c.identifiant == bout.valeur for c in liste)
    return any(c.groupe == bout.valeur for c in liste)


def _mot_valide(mot: str) -> str:
    """Le mot d'un lien, mis au propre et borné — **un seul endroit qui décide**.

    Deux appelants le posent, celui qui tire le trait et celui qui le règle : une
    seconde écriture de la borne serait une seconde règle sur la même grandeur, et
    c'est la première qui finirait par être fausse.
    """
    propre = " ".join(mot.split())
    if len(propre) > MOT_MAX:
        raise LienRefuse(
            f"le mot d'un lien tient en {MOT_MAX} signes — au-delà, "
            "ce qu'on veut écrire est une note"
        )
    return propre


def _absent(bout: Bout) -> str:
    quoi = "la carte" if bout.genre == BOUT_CARTE else "l'îlot"
    return f"{quoi} « {bout.valeur} » n'est plus sur cette toile"


def _teintes_possibles(recue: str) -> str:
    """Le refus nomme la **liste close** plutôt que ce qu'on a demandé : c'est
    elle qu'il faut connaître, et elle tient en une ligne."""
    return f"teinte inconnue « {recue} » — les six sont : " + ", ".join(TEINTES)


def _quantification_neuve(univers: Univers):
    """La quantification d'un asset qui n'en avait pas encore.

    Elle vient de `recette_de` plutôt que d'une valeur écrite ici : « ce que le
    projet impose » n'a qu'un seul endroit où se lire.
    """
    return univers.recette_de(None).quantification


def _avec_poses_gardees(
    echelle: Echelle, connues: dict[str, tuple[Pose, ...] | None]
) -> Echelle:
    """L'échelle telle qu'elle arrive, **mais sa liste de poses préservée**.

    Une liste absente du message veut dire « je ne parle pas de ça », et non
    « vide-la ». Un type renommé — ou nouveau — n'a rien à garder, et repart de
    `None` : il suivra le plan du jeu ou ce que le produit sait de son nom.
    """
    if echelle.poses is not None:
        return echelle
    return replace(echelle, poses=connues.get(echelle.nom))


class ConsequencesDuReglage:
    """Ce qu'un changement de réglage casse, **avec les vrais chiffres**.

    « Rien n'est jamais grisé dans l'assistant » (E8) : un changement qui casse
    du travail déjà payé affiche le compte et le coût, puis laisse décider. Le
    produit n'a qu'un seul refus automatique — le compte d'images — et en
    ajouter un deuxième reviendrait à bloquer un auteur sur son propre jeu. Un
    chiffre exact aide mieux qu'une case grise.

    **Elle ne se calcule que sur ce qui est là.** Aucune estimation de ce qui
    n'existe pas, aucune projection : le nombre d'images déjà découpées à
    l'ancienne taille, et ce que les refabriquer coûterait au prix moyen de ce
    qui a déjà été payé dans ce jeu. Sans historique de prix, le coût est nul et
    la phrase le dit plutôt que d'inventer un tarif.
    """

    __slots__ = ("images", "cout_usd", "cible", "poses", "images_de_pose")

    def __init__(
        self,
        images: int = 0,
        cout_usd: float = 0.0,
        cible: int = 0,
        poses: int = 0,
        images_de_pose: int = 0,
    ) -> None:
        self.images = images
        self.cout_usd = cout_usd
        self.cible = cible
        self.poses = poses
        self.images_de_pose = images_de_pose

    def en_json(self) -> dict[str, Any]:
        return {
            "images": self.images,
            "cout_usd": round(self.cout_usd, 4),
            "cible": self.cible,
            "poses": self.poses,
            "images_de_pose": self.images_de_pose,
        }
