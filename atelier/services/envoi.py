# -*- coding: utf-8 -*-
"""Ce qui part — l'écran qui s'intercale entre le bouton et la dépense (E14).

Demander une image coûte de l'argent à chaque fois, et l'image qui revient n'est
jamais deux fois la même : on ne peut donc pas rejouer un appel raté sans le
repayer. Cet écran-ci est là pour qu'on relise, une dernière fois, ce qui va
vraiment partir — et pour qu'on puisse encore le changer.

**Il ne montre pas un résumé.** Le texte exact, mot pour mot, et chaque image
jointe, chacun sur sa ligne, avec un interrupteur. Ce qui est éteint ne part pas.
Ce qu'on corrige ici **ne vaut que pour cet appel** et ne remonte nulle part.

**Ce service ne compose rien.** Il demande ses lignes à
`ServiceGenerations.lignes`, c'est-à-dire au chemin même que l'envoi emprunte, et
il demande son compte d'images à `compter_references`, qui est déjà celui qui
décide du grisé d'un modèle. C'est ce qui rend la règle *ce qui est montré est ce
qui part* vérifiable au lieu d'être affirmée : un aperçu recomposé ici aurait été
une seconde vérité, et « celle qui compte est celle qui part ».

**Il ne dépense pas non plus.** Il arme ; c'est la barre qui paie qui appelle,
comme partout ailleurs. Il n'existe qu'un seul endroit d'où l'argent part dans
tout le produit, et une seconde route de génération en aurait fait deux.

**Ce que la mesure a trouvé, et qui rend cet écran nécessaire** — relevé le
30 août 2026 sur les vingt-quatre générations payées du dépôt
(`essais/essai_ce_qui_part.py`, gratuit, il relit la base) :

- sur le plus long appel payé, **le style pèse 890 caractères sur 1 690 et le
  sujet 40** — 53 % contre 2 %. Un bloc replié qui résume 53 % de ce qui part
  n'est pas un résumé, c'est un angle mort ;
- **dix appels sur vingt-quatre ne portaient ni texte de style ni image de
  référence**, et aucun n'a été refusé : il n'y avait rien pour s'en apercevoir ;
- deux des sept textes de style écrivent `64x64` en toutes lettres pendant que le
  projet impose 128, et **ça part depuis toujours**.
"""

from __future__ import annotations

from typing import Any, Sequence

from atelier.depot import projet_lu_une_fois
from atelier.domaine import Reinjection
from atelier.domaine.envoi import (
    AMBIANCE,
    CADRAGE,
    DE_LA_PARTIE,
    IMAGES,
    JEU,
    JOINTES,
    OPTIONS,
    PLANCHE,
    SUJET,
    Tri,
    clef,
)
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import CARTE, PLANCHE_JOINTE
from atelier.domaine.projet import (
    AUCUNE_CIBLE,
    DE_LA_FAMILLE,
    DU_PRODUIT,
    IMAGE_SEULE,
    NOM_DE_LA_NATURE,
    Echelle,
)
from atelier.domaine.recette import NOM_DU_MOTEUR, Passe

# **Deux `PLANCHE` disent le même mot pour deux choses**, et c'est pourquoi
# celui-ci arrive renommé : celui d'au-dessus est un *groupe de consignes*
# dans l'écran d'envoi, celui-ci est une *nature d'image* (D1). Les deux
# valent la même chaîne, si bien que la collision ne casse rien — elle rend
# seulement illisible lequel on lit, ce qui est pire qu'une panne.
from atelier.domaine.projet import PLANCHE as NATURE_PLANCHE
from atelier.services.generation import ServiceGenerations
from atelier.services.montre import de_quoi_montrer
from atelier.services.prix import prix_de
from atelier.services.production import ServiceProduction, _tailles_annoncees
from atelier.services.univers import ServiceUnivers


class EnvoiRefuse(ErreurAtelier):
    """Ce qui empêcherait l'appel de partir, dit avant qu'un centime bouge.

    **Rare, et ce n'est pas cet écran qui refuse** : il n'existe qu'un seul refus
    automatique dans tout l'atelier — le compte d'images d'une planche —, et il
    se joue au retour. Ce qu'on lit ici sont des refus de lecture : une chose du
    jeu qui n'existe plus, un modèle qui n'est pas au catalogue.
    """

    code = "envoi_refuse"


# La clef de l'option qui envoie la palette en image. Nommée ici parce que
# l'écran la coche et que le service la lit : deux chaînes écrites à deux
# endroits auraient fini par ne plus se répondre.
PALETTE = clef(OPTIONS, "palette")


class ServiceEnvoi:
    def __init__(
        self,
        generations: ServiceGenerations,
        production: ServiceProduction,
        univers: ServiceUnivers,
        bibliotheque: Any = None,
        assets: Any = None,
        reserves: Any = None,
    ) -> None:
        self._generations = generations
        # **Ce qui reste chez le fournisseur de ce modèle-là** (F2). L'écran qui
        # confirme et celui où l'on choisit annoncent le même chiffre parce
        # qu'ils lisent le même objet — la règle payée en E13, tenue sans être
        # réécrite.
        self._reserves = reserves
        self._production = production
        self._univers = univers
        # **Les assets, pour montrer les images jointes** (U9) : l'écran qui
        # décide de ce qui part ne montrait aucune image, et une vignette a
        # besoin de l'objet qu'elle montre.
        self._assets = assets
        # **Le projet ouvert se lit ici comme partout ailleurs**, et pas à la
        # route : le défaut vit dans les services depuis T7, pour que le MCP en
        # hérite sans le réécrire.
        self._bibliotheque = bibliotheque

    # ── L'écran ──────────────────────────────────────────────────────────────

    # Même portée qu'`apercu`, et pour la même raison (M3) : la confirmation
    # appelle l'aperçu **et** tout ce qui compose le prix, les références et les
    # cases. Les deux portées s'emboîtent sans se gêner — la plus extérieure
    # tient le mémo, l'autre s'y pose.
    @projet_lu_une_fois()
    def envoi(
        self,
        *,
        projet: str | None,
        sujet: str,
        modele: str,
        repris: bool = False,
        echelle: str = "",
        personnage: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        poses: Sequence[str] | None = None,
        directions: Sequence[str] | None = None,
        piece: str | None = None,
        references: Sequence[Reinjection] = (),
        references_ecartees: Sequence[str] | None = None,
        variations: int = 1,
        tri: Tri | None = None,
        prompt_negatif: str = "",
        # **Refaire une planche** (RS2) : la consigne de mise en page se lit
        # ici avant de payer, et la planche du sujet se compte dans le prix.
        garder_mise_en_page: bool = False,
    ) -> dict[str, Any]:
        """Tout ce que l'écran montre, en un aller-retour.

        Un écran qui demanderait son texte à une route et son prix à une autre
        finirait par afficher un texte d'avant à côté d'un prix d'après ; les
        deux se lisent donc ensemble, comme la toile lit ses cartes et ses liens
        d'un seul coup.
        """
        tri = tri or Tri()
        palette_cochee = tri.etat(PALETTE, False)
        if projet is None and self._bibliotheque is not None:
            projet = self._bibliotheque.courant

        apercu = self._generations.apercu(
            sujet,
            repris=repris,
            projet=projet,
            personnage=personnage,
            poses=poses,
            piece=piece,
            pose=pose,
            direction=direction,
            directions=directions,
            tri=tri,
            # **Ce que l'écran sait déjà des images, passé à la composition**
            # (1ᵉʳ septembre 2026). Le prompt nomme les images jointes depuis
            # qu'un banc a montré qu'une planche dessinée de face décide de la
            # caméra quand rien ne la contredit ; l'aperçu doit donc les
            # connaître, sans quoi il montrerait un texte plus court que celui
            # qui part.
            echelle=echelle,
            modele=modele,
            references=references,
            references_ecartees=references_ecartees,
            palette=palette_cochee,
            # **Ce que l'auteur interdit de sa main** (D3), pour que l'aperçu
            # rende le champ d'interdiction entier — le sien d'abord, celui du
            # fond ensuite. Sans lui, l'écran qui promet de tout montrer tairait
            # la moitié qui vient de l'auteur.
            prompt_negatif=prompt_negatif,
            garder_mise_en_page=garder_mise_en_page,
        )
        lignes = apercu["lignes"]
        cases = self._cases(poses, directions, piece)
        # **Ce qu'un style local ajoute au-dessus de ce que ML4 composait déjà**
        # (ML5) : un temps, pas un prix — la mesure de cette machine, ou la
        # vitesse du style à défaut (règle 8ter). `None` reste `None` : un
        # modèle qui n'est pas un style local ne porte toujours pas de `local`.
        local = apercu["local"]
        if local is not None:
            local = {**local, "temps": self._generations.temps_attendu(modele)}

        compte = self._generations.compter_references(
            projet,
            echelle,
            references,
            personnage,
            cases,
            piece,
            ecartees_ici=references_ecartees,
            palette=palette_cochee,
            # **Le contexte, comme à la soumission** (RS1) : la case visée ou la
            # planche de ses directions choisit les références rangées, et
            # l'écran doit compter celles-là, pas les autres.
            direction=direction,
            directions=directions,
            mise_en_page=garder_mise_en_page,
        )
        mesure = self._generations.appels_mesures(modele)
        modele_lu = self._modele(modele)
        places = modele_lu["references_max"]
        cible = self._cible(projet)

        # **L'avertissement s'écrit sur la ligne fautive** (US-279). Une bannière
        # en haut dirait « attention, deux problèmes » et laisserait chercher
        # lesquels ; la ligne dit lequel, et le bouton pour le réparer est déjà
        # à côté.
        for ligne in lignes:
            ligne["avertissement"] = self._avertissement(ligne, cible)

        images = self._images(
            compte,
            mesure,
            places,
            palette_cochee,
            projet,
            personnage,
            # **La légende vient de la composition, jamais d'un découpage à
            # l'écran** (M4) : c'est le même texte que celui du haut, rendu rang
            # par rang par celui qui l'a écrit.
            nommage=apercu.get("nommage", ()),
            cases=cases,
        )
        options = self._options(
            projet, personnage, modele_lu, palette_cochee, compte, places
        )
        appels = 1 if cases else max(1, variations)
        # **Le prix compte ce qui part, pas ce qui est coché** (F6). Depuis que
        # ce que le produit ajoute de lui-même cède devant le plafond du modèle,
        # les deux ne sont plus le même chiffre — et c'est le prix, pas la liste,
        # qui doit suivre : une image qui ne part pas n'est pas facturée.
        total = prix_de(mesure, images["partent"], appels)

        return {
            "texte": apercu["texte"],
            # **Le texte, coupé là où il se coupe** (R7). L'écran montrait un
            # pavé dans sa colonne de droite ; il montre maintenant les trois
            # parties, chacune sous le titre que le fournisseur reçoit. Elles
            # viennent de la composition, jamais d'un découpage de l'écran :
            # recouper le texte à l'affichage aurait été une seconde vérité sur
            # ce qui part, et la première divergence se serait vue chez le
            # modèle et pas chez nous.
            "parties": apercu["parties"],
            # **Ce qu'un style local laisse en route** (ML4), et si le négatif
            # sera lu : `None` pour tout modèle qui n'est pas un style local.
            "local": local,
            "lignes": lignes,
            "groupes": self._groupes(lignes, images, options),
            "images": images,
            "options": options,
            # **Le sixième groupe ne part pas** (US-281) : ce qui agira au
            # retour, en gris, pour savoir d'avance que l'image qu'on verra n'est
            # pas celle que le modèle envoie.
            "retour": self._retour(projet, echelle, cases, palette_cochee),
            "avertissements": [
                {"clef": l["clef"], "texte": l["avertissement"]}
                for l in lignes
                if l["avertissement"]
            ]
            + images["avertissements"],
            "prix": {
                "total": total,
                "appels": appels,
                "images": self._part_des_images(mesure, images["partent"], appels),
                # **La mesure est rendue à côté du prix, pas fondue dedans** —
                # c'est la leçon de E13, payée en affirmant un écart avec des
                # nombres qui le démentaient : une phrase se cite avec les
                # nombres qui la portent. `mesure["appels"]` dit sur combien
                # d'appels payés le prix repose, et il ne se confond pas avec le
                # nombre d'appels que celui-ci demandera.
                "mesure": mesure,
            },
            # **Ce qui reste chez ce fournisseur-là, avant de partir** (F2).
            # `None` quand il compte en argent : l'argent a la barre de tête et
            # la ligne de prix juste au-dessus, et une seconde réserve en
            # dollars serait un second endroit à tenir d'accord.
            "reserve": self._reserve(modele_lu, images["partent"], appels),
            "modele": modele_lu,
            "ambiance": self._ambiance(projet, personnage, lignes, images),
            "cases": cases,
            "caracteres": self._caracteres(apercu["texte"], lignes),
            "corrections": sum(1 for l in lignes if l.get("corrigee")),
            # **Le fond, et ce qu'il coûte de le changer ici** (D3). Trois
            # choses, et elles répondent à trois questions différentes : sur
            # quelle couleur cet appel part, ce que l'atelier proposerait à ce
            # jeu-là, et si la couleur est bien celle du jeu ou une correction
            # posée pour cet appel seulement.
            #
            # **La correction ne remonte nulle part**, comme tout ce que cet
            # écran renvoie : elle habille l'appel et disparaît. Poser le fond
            # durablement est un second geste, qui passe par le codex — la même
            # règle que « garder cette correction » sur une ligne de texte.
            "fond": self._fond(projet, apercu, tri),
        }

    def _fond(
        self, projet: str | None, apercu: dict[str, Any], tri: Tri
    ) -> dict[str, Any]:
        """Ce que l'écran de confirmation dit du fond (D3).

        **Il ne recompose rien** : la couleur et l'interdiction viennent de
        l'aperçu, c'est-à-dire du chemin même que l'envoi emprunte. Ce que ce
        service ajoute est ce qui n'appartient qu'à l'écran — la proposition du
        jeu, et le fait qu'une correction est posée —, et aucun des deux
        n'entre dans ce qui part.
        """
        propose = self._univers.fond_propose(projet).en_json()
        return {
            "couleur": apercu["fond"],
            "interdiction": apercu["interdiction"],
            # Faux quand le modèle choisi ne lit aucun négatif (ML4).
            "negatif_lu": apercu["negatif_lu"],
            "du_jeu": self._univers.univers(projet).fond,
            "corrige": tri.fond is not None,
            "propose": propose,
        }

    def _reserve(
        self, modele_lu: dict[str, Any], images: int, appels: int
    ) -> dict[str, Any] | None:
        """La réserve du fournisseur de ce modèle, **et ce qui manquerait**.

        Un lot que la réserve du jour ne peut pas finir est annoncé *avant* de
        partir, avec ce qui manquerait — c'est un critère de F2, et c'est ici
        que l'écran l'apprend. La quantité qu'il faudrait est celle que la
        mesure annonce ; sans mesure, on ne peut rien manquer d'avance, et
        l'écran ne dit rien plutôt que d'inventer.
        """
        if self._reserves is None:
            return None
        fournisseur = str(modele_lu.get("fournisseur") or "")
        reserve = self._reserves.de(fournisseur)
        if reserve is None:
            return None
        lu = reserve.en_json()
        besoin = prix_de(
            self._generations.appels_mesures(modele_lu["identifiant"]), images, appels
        )
        lu["besoin"] = besoin
        lu["manque"] = reserve.manque_pour(besoin) if besoin is not None else None
        return lu

    # ── Les images, et ce que chacune coûte ──────────────────────────────────

    def _montre(self, projet: str | None, ligne: dict[str, Any]) -> dict[str, Any] | None:
        """De quoi montrer cette image jointe — l'objet entier (U9).

        **L'objet, et pas une adresse.** L'écran sait déjà nommer l'adresse d'un
        asset et celle d'une carte, à un seul endroit chacune ; lui envoyer une
        adresse toute faite aurait posé ici un second vocabulaire d'adresses,
        que la première empreinte ajoutée ferait diverger. Il reçoit donc ce
        qu'il reçoit partout ailleurs, et s'en sert avec les fonctions qu'il a.

        **Une image disparue rend `None`**, jamais une erreur : une référence
        peut nommer un asset supprimé ou une carte retirée du tableau entre le
        moment où la ligne a été composée et celui où on la regarde. La ligne
        reste — elle dit ce qui partirait —, elle n'a simplement pas de vignette.

        **La réponse est écrite une seule fois** (R8), dans
        `atelier/services/montre.py` : la fiche d'une chose pose la même question
        pour ses images d'exemple, et deux réponses auraient fini par rendre deux
        formes du même objet.
        """
        return de_quoi_montrer(
            assets=self._assets,
            univers=self._univers,
            projet=projet,
            identifiant=str(ligne.get("asset") or ""),
            carte=ligne.get("origine") == CARTE,
        )

    def _images(
        self,
        compte: dict[str, Any],
        mesure: dict[str, Any],
        places: int,
        palette_cochee: bool,
        projet: str | None,
        personnage: str | None,
        nommage: Sequence[dict[str, Any]] = (),
        cases: int = 0,
    ) -> dict[str, Any]:
        """Chaque image jointe, avec son prix **sur la ligne où on la coche**.

        « Presque la moitié de la facture, pour une chose qui se coche et se
        décoche — et qui se cochait sans que rien n'en dise le prix. » Ce n'est
        pas une invitation à les retirer : une référence est souvent ce qui fait
        revenir la bonne image, et une image ratée coûte cent pour cent. C'est
        une invitation à le savoir.

        **Une case éteinte garde son prix, écrit en gris** : c'est ce qu'elle
        coûterait si on la rallumait, et sans lui on ne saurait pas ce qu'on
        vient d'économiser.

        **Les images en trop sont grisées avec leur compte**, jamais retirées :
        « 14 places, 16 cochées », et l'on choisit lesquelles retirer. C'est le
        grisé de T1 appliqué à une liste plutôt qu'à un bouton.

        **Chaque image porte sa légende depuis M4.** Le bloc *« Image 1 — …,
        Image 2 — … »* est du texte qui part au modèle : il se lit donc en haut,
        entier et dans l'ordre, comme tout ce qui part. Il est **recopié** sous
        chaque image, et non déménagé — l'écran promet de montrer ce qui part mot
        pour mot, et le déplacer romprait la promesse. En haut *ce qui part*, en
        bas *ce que ça décrit*.
        """
        pas = mesure.get("par_image")
        legendes = {
            int(n["rang"]): str(n["texte"]) for n in nommage if n.get("rang")
        }
        lignes: list[dict[str, Any]] = []
        rang = 0
        for ligne in compte["lignes"]:
            cochee = not ligne["ecartee_par"]
            if cochee:
                rang += 1
            lignes.append(
                {
                    **ligne,
                    "cochee": cochee,
                    # **Une place au-delà du plafond est grisée, pas cachée.**
                    #
                    # **Et « zéro place » est un plafond comme un autre** (F6) :
                    # la garde `places > 0` d'avant faisait qu'un modèle qui
                    # n'accepte aucune image n'en grisait aucune — l'écran
                    # montrait alors des lignes cochées, avec leur prix, qui ne
                    # partiraient pas. C'était sans conséquence tant qu'un tel
                    # modèle était refusé avant d'arriver ici ; il ne l'est plus.
                    "hors_plafond": cochee and rang > places,
                    # **Le numéro que le texte lui donne** (R7). Le prompt dit
                    # « Image 3 — STYLE REFERENCE » ; sans ce chiffre-là sur la
                    # ligne, l'auteur lit un texte qui parle d'images et regarde
                    # une liste qui ne les numérote pas. Une image qui ne part
                    # pas n'a pas de numéro : elle n'en a pas dans le texte non
                    # plus.
                    "rang": rang if cochee and rang <= places else None,
                    # **Le morceau de légende qui parle d'elle** (M4), recopié
                    # tel qu'il part. Vide pour une image qui ne part pas : elle
                    # n'a pas de rang, donc pas de ligne dans la légende.
                    "legende": legendes.get(rang, "")
                    if cochee and rang <= places
                    else "",
                    "prix": pas,
                    # **L'objet entier, et pas une adresse** (U9). L'écran qui
                    # décide de ce qui part ne montrait aucune image : les
                    # références y étaient des lignes de texte avec un prix.
                    # Chacune porte désormais sa vignette — et l'écran sait
                    # déjà nommer l'adresse d'un asset et celle d'une carte, à
                    # un seul endroit chacune. Lui envoyer une adresse toute
                    # faite aurait posé ici un second vocabulaire d'adresses,
                    # que la première empreinte ajoutée ferait diverger.
                    "montre": self._montre(projet, ligne),
                }
            )
        avertissements: list[dict[str, str]] = []
        if compte["total"] == 0:
            # Un avertissement du produit **donne toujours des chiffres**, jamais
            # un conseil : c'est la mesure du dépôt, pas un jugement sur ce qu'on
            # est en train de faire.
            avertissements.append(
                {
                    "clef": clef(IMAGES, "aucune"),
                    "texte": "aucune image jointe · sur les 24 générations payées "
                    "du dépôt, 10 sont parties sans texte de style ni image",
                }
            )
        if places <= 0 and compte["total"] > 0:
            # **Le cas du brouillon gratuit** (F6), et il mérite sa phrase : un
            # « 0 places · 3 cochées » dirait la même chose en laissant deviner
            # ce qui va se passer. Ce qui se passe est que l'appel part quand
            # même, sans elles — et c'est le contraire du grisé, donc ça ne peut
            # pas s'écrire dans les mots du grisé.
            reste = compte["total"] - compte["incompressibles"]
            avertissements.append(
                {
                    "clef": clef(IMAGES, "sans_images"),
                    "texte": f"ce modèle n'accepte aucune image · l'appel partira "
                    f"sans {'elle' if reste == 1 else 'elles'}, sur le texte seul",
                }
            )
        elif places > 0 and compte["total"] > places:
            avertissements.append(
                {
                    "clef": clef(IMAGES, "plafond"),
                    "texte": f"{places} places sur ce modèle · {compte['total']} cochées",
                }
            )
        # **Le rang du gabarit et de la bande, qui partent après les autres.**
        # Ils ne sont pas des lignes à cocher — le gabarit *est* la demande, la
        # bande se coche dans les options —, mais le texte les numérote comme
        # les autres, et la phrase qui les annonce à l'écran doit donc porter le
        # même chiffre.
        partantes = sum(1 for l in lignes if l["cochee"] and not l["hors_plafond"])
        rang_gabarit = partantes + 1 if compte["gabarit"] else None
        rang_palette = (
            partantes + compte["gabarit"] + 1 if compte.get("palette") else None
        )
        return {
            "lignes": lignes,
            "places": places,
            "cochees": compte["total"],
            "rang_gabarit": rang_gabarit,
            "rang_palette": rang_palette,
            # **La troisième image, décrite comme les deux autres** (M4). Elle
            # était un paragraphe sous la liste : sans vignette, sans moyen de
            # l'ouvrir, et nommée *gabarit* même quand le texte qui part au même
            # instant demandait de **modifier la planche existante**. Qu'elle ne
            # se décoche pas reste vrai et reste écrit ; qu'on ne puisse pas la
            # voir n'avait jamais été décidé.
            "jointe": self._jointe(compte, rang_gabarit, pas, legendes, cases),
            # **Combien partiront vraiment** (F6), calculé ici et nulle part
            # ailleurs : le sommaire des groupes, le prix et la réserve le
            # lisent tous les trois, et trois calculs finiraient par annoncer
            # trois chiffres — la leçon de E13, payée en affichant $0,0128 et
            # $0,0160 pour le même appel à trois centimètres l'un de l'autre.
            "partent": min(
                compte["total"], max(places, compte["incompressibles"])
            ),
            "gabarit": compte["gabarit"],
            "palette": compte.get("palette", 0),
            "prix": pas,
            "avertissements": avertissements,
        }

    @staticmethod
    def _jointe(
        compte: dict[str, Any],
        rang: int | None,
        prix: float | None,
        legendes: dict[int, str],
        cases: int,
    ) -> dict[str, Any] | None:
        """L'image que la planche ajoute — **et laquelle des deux c'est** (M4).

        **Le rôle vient du serveur, jamais d'une déduction de l'écran.** Les deux
        sortes ne demandent pas la même chose au modèle : un *gabarit* est une
        grille vide où poser des sujets, une *planche* est la feuille déjà
        dessinée qu'on lui redonne à modifier. L'écran n'avait qu'un nombre, il a
        donc gardé les mots du plus ancien des deux cas — et il annonçait *un
        gabarit à remplir* à quelques centimètres d'un texte qui demandait
        l'inverse, au moment précis où l'on décide de payer.

        **Elle n'a pas de case à cocher, et ce n'est pas une case grisée.** La
        décision d'origine est gardée telle quelle — *décocher reviendrait à
        demander une planche sans dire à quoi elle ressemble* — et elle est
        écrite sur la ligne. Une case grisée aurait demandé de comprendre
        pourquoi elle l'est ; une ligne sans case dit qu'il n'y a rien à décider.
        """
        role = compte.get("role_joint")
        if not role or rang is None:
            return None
        planche = role == PLANCHE_JOINTE
        return {
            "role": role,
            "rang": rang,
            "nom": (
                "la planche du corps, que le modèle doit modifier"
                if planche
                else "le gabarit de la grille, qui dit au modèle où poser les "
                f"{cases} sujets"
            ),
            "raison": (
                "elle ne se décoche pas — sans elle, il n'y aurait rien à "
                "modifier — et elle compte dans les places"
                if planche
                else "il ne se décoche pas — une planche sans lui ne dit pas à "
                "quoi elle ressemble — et il compte dans les places"
            ),
            "legende": legendes.get(rang, ""),
            "prix": prix,
        }

    def _part_des_images(
        self, mesure: dict[str, Any], images: int, appels: int
    ) -> float | None:
        """Ce que les cases cochées pèsent dans le total (US-276).

        Rien plutôt qu'un zéro quand le pas n'est pas mesuré : un zéro dirait
        « les images ne coûtent rien », ce qui est faux et mesuré comme tel.
        """
        pas = mesure.get("par_image")
        if pas is None:
            return None
        return round(float(pas) * max(0, images) * max(1, appels), 4)

    # ── Les options que le modèle sait faire ─────────────────────────────────

    def _options(
        self,
        projet: str | None,
        personnage: str | None,
        modele: dict[str, Any],
        palette_cochee: bool,
        compte: dict[str, Any],
        places: int,
    ) -> list[dict[str, Any]]:
        """Ce qu'on peut demander en plus, et ce que le modèle ne sait pas faire.

        **Celles qu'il ne sait pas faire sont grisées avec leur raison écrite**,
        jamais absentes : c'est la règle de T1, et l'absence n'apprend rien quand
        le grisé apprend pourquoi.
        """
        couleurs = self._production.couleurs_de(projet, personnage)
        sienne = bool(self._production.palette_de_lambiance(projet, personnage))
        refus = ""
        if not couleurs:
            refus = "aucune palette dans ce jeu — elle se calcule des images officielles"
        elif places <= 0:
            refus = f"{modele['nom']} n'accepte aucune image de référence"
        return [
            {
                "clef": PALETTE,
                "nom": "palette",
                "texte": "envoyer la palette en référence — une bande de "
                f"{len(couleurs)} pastilles, qui occupe une des places d'image",
                "detail": (
                    "les couleurs de son ambiance"
                    if sienne
                    else "les couleurs du jeu"
                ),
                "allumee": palette_cochee and not refus,
                "refus": refus,
            }
        ]

    # ── Ce qui se passe au retour, et qui ne part pas ────────────────────────

    def _retour(
        self, projet: str | None, echelle: str, cases: int, palette_cochee: bool
    ) -> list[dict[str, str]]:
        """Ce que l'atelier fera de l'image quand elle reviendra (US-281).

        **Rien de tout ça ne part au modèle, et rien ne coûte un centime** : ce
        sont des traitements qui se font sur la machine, après coup, et qui se
        refont autant de fois qu'on veut. Ils sont montrés parce que **l'image
        qu'on verra revenir n'est pas celle que le modèle envoie**, et qu'il vaut
        mieux le savoir avant que le savoir après.

        **Ils sont en gris, et c'est un mot du produit** : le gris veut dire *ce
        n'est pas de ça qu'on parle en ce moment*. Ces lignes-là ne se cochent
        pas depuis ici — elles se règlent dans les tables, et une chose est
        réglée à un seul endroit.
        """
        if not projet:
            return []
        univers = self._univers.univers(projet)
        lue = self._univers.echelle(projet, echelle) if echelle else None
        # **La nature se lit sur le nombre de cases** (D1) : un appel plié rend
        # une planche, et ce sont ses morceaux qui entreront en bibliothèque.
        # C'est donc leur défaut qu'il faut annoncer, pas celui d'une image
        # seule — sans quoi l'écran promettrait un réglage que rien n'appliquera.
        nature = NATURE_PLANCHE if cases >= 2 else IMAGE_SEULE
        recette = univers.recette_de(lue, nature)
        lignes: list[dict[str, str]] = []
        if cases >= 2:
            lignes.append(
                {"nom": "découper la planche", "detail": f"{cases} cases"}
            )
        if recette.passes:
            # **Le défaut qui s'appliquera, et d'où il vient** (US-410). C'est
            # le seul endroit qui le dise *avant* de dépenser ; la fiche de
            # l'image le redit après, et les deux lisent le même `detourage`.
            passe, origine = univers.detourage(nature, lue.famille if lue else "")
            lignes.append(
                {
                    "nom": "détourer le fond",
                    "detail": _detail_du_detourage(passe, origine, nature, lue),
                }
            )
        if recette.grille is not None and univers.cible_px != AUCUNE_CIBLE:
            lignes.append(
                {
                    "nom": "ramener sur la grille du jeu",
                    "detail": f"{univers.cible_px} px"
                    + (f" · {recette.grille.occupation} % de la case"
                       if recette.grille.occupation != 100 else ""),
                }
            )
        if recette.quantification is not None:
            lignes.append(
                {
                    "nom": "ramener sur la palette du jeu",
                    "detail": f"{len(univers.palette)} couleurs",
                }
            )
        return lignes

    # ── Les comptes de la colonne de gauche ──────────────────────────────────

    def _groupes(
        self,
        lignes: Sequence[dict[str, Any]],
        images: dict[str, Any],
        options: Sequence[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Ce que chaque groupe pèse, sans avoir à descendre l'écran."""
        def compter(groupe: str) -> tuple[int, int]:
            miennes = [l for l in lignes if l["groupe"] == groupe]
            return sum(1 for l in miennes if l["allumee"]), len(miennes)

        groupes: list[dict[str, Any]] = []
        for groupe, nom in (
            (JEU, "les textes du jeu"),
            (AMBIANCE, "son ambiance"),
            (SUJET, "le sujet"),
            (PLANCHE, "la planche"),
            (JOINTES, "ce que les images disent"),
            (CADRAGE, "la caméra"),
        ):
            allumees, total = compter(groupe)
            if total:
                groupes.append(
                    {
                        "clef": groupe,
                        "nom": nom,
                        # **La partie du texte où ce groupe atterrit** (R7). Le
                        # sommaire de gauche s'en sert pour ranger ses six
                        # lignes sous trois titres, et la table qui en décide
                        # est celle du domaine — la même que le texte suit.
                        "partie": DE_LA_PARTIE[groupe],
                        "allumees": allumees,
                        "total": total,
                    }
                )
        # **Combien partent, sur combien sont cochées** (corrigé en F6). Le
        # total était les *places du modèle*, ce qui était une capacité et non
        # un compte de choses : chez un modèle qui n'en prend aucune, le
        # sommaire annonçait « 1 sur 0 ». Les quatre autres groupes se lisent
        # tous « allumées sur disponibles », et celui-ci se lit maintenant
        # pareil — les places, elles, restent écrites en tête du bloc, où elles
        # expliquent l'écart.
        groupes.append(
            {
                "clef": IMAGES,
                "nom": "les images",
                "allumees": images["partent"],
                "total": images["cochees"],
            }
        )
        groupes.append(
            {
                "clef": OPTIONS,
                "nom": "les options",
                "allumees": sum(1 for o in options if o["allumee"]),
                "total": len(options),
            }
        )
        return groupes

    def _caracteres(
        self, texte: str, lignes: Sequence[dict[str, Any]]
    ) -> dict[str, int]:
        """Ce que le texte pèse, et la part du sujet dedans.

        C'est le chiffre qui a fait basculer ce bloc en écran : **le sujet pesait
        2 %** sur le plus long appel payé du dépôt. Le montrer à chaque appel est
        la moitié de la réponse ; l'autre moitié est de pouvoir éteindre.
        """
        sujet = sum(
            len(l["texte"])
            for l in lignes
            if l["groupe"] == SUJET and l["allumee"]
        )
        eteints = sum(
            len(l["texte"]) for l in lignes if not l["allumee"] and not l["remplacee_par"]
        )
        return {"total": len(texte), "sujet": sujet, "eteints": eteints}

    # ── Les lectures ─────────────────────────────────────────────────────────

    def _ambiance(
        self,
        projet: str | None,
        personnage: str | None,
        lignes: Sequence[dict[str, Any]],
        images: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Le lot de style désigné, et ce que **cet appel-là** lui prend.

        Les trois oui/non se lisent sur ce qui part, jamais sur le réglage
        durable : l'écran éteint ligne par ligne, et un appel peut avoir pris le
        monde sans l'éclairage — ce qu'aucun des trois modes ne décrit.
        """
        couches = self._production.couches(projet, personnage)
        if not couches.ambiance_nom:
            return None
        return {
            "nom": couches.ambiance_nom,
            "prend": self._production.prend_de(projet, personnage),
            "textes": any(
                l["groupe"] == AMBIANCE and l["allumee"] for l in lignes
            ),
            "references": any(
                l["cochee"]
                for l in images["lignes"]
                if l["provenance"] == "image de son ambiance"
            ),
            "couleurs": bool(images["palette"])
            and bool(self._production.palette_de_lambiance(projet, personnage)),
        }

    def _cases(
        self,
        poses: Sequence[str] | None,
        directions: Sequence[str] | None,
        piece: str | None,
    ) -> int:
        """Combien de cases cet appel remplit — **le compte, pas l'écran**.

        Une planche de pose en a autant que de directions, un lot autant que de
        poses, une planche d'équipement autant que de corps. Une case seule n'en
        a aucune : elle n'est pas un lot, et le gabarit ne part pas.
        """
        angles = len(dict.fromkeys(directions or ()))
        if angles >= 2:
            return angles
        combien = len(dict.fromkeys(poses or ()))
        if piece:
            return combien
        return combien if combien >= 2 else 0

    def _modele(self, identifiant: str) -> dict[str, Any]:
        lu = self._generations._catalogue.modele(identifiant)
        return {
            "identifiant": lu.identifiant,
            "nom": lu.nom,
            "references_max": lu.references_max,
            # **Qui le propose** (F2) : c'est par lui que l'écran retrouve la
            # réserve de son fournisseur, et un modèle relu d'une photo d'avant
            # la V2.2 rend une chaîne vide plutôt que rien.
            "fournisseur": lu.fournisseur,
            # **Ce qu'un style local fait d'une image jointe** (ML3) : la garder
            # comme sujet (Klein) ou repeindre par-dessus. `None` ailleurs — un
            # modèle distant ne dit pas ce qu'il en fait.
            "reference": getattr(lu, "reference", None),
            "reference_nom": {"sujet": "garder ce sujet", "depart": "partir de cette image"}.get(
                getattr(lu, "reference", None) or ""),
        }

    def _cible(self, projet: str | None) -> int:
        if not projet:
            return 0
        cible = self._univers.univers(projet).cible_px
        return 0 if cible == AUCUNE_CIBLE else cible

    def _avertissement(self, ligne: dict[str, Any], cible: int) -> str:
        """La taille qu'un texte annonce contre celle qui s'applique (E12, E14).

        `64x64` est une grille, `253x321` est la taille d'une image dont personne
        ne parle : seuls les carrés comptent. La ligne dit lequel des deux
        chiffres est le sien, et **corriger ici ne corrige que cet appel** — le
        réglage durable s'écrit dans l'Univers.
        """
        if not cible or not ligne["allumee"]:
            return ""
        annoncees = sorted(t for t in _tailles_annoncees(ligne["texte"]) if t != cible)
        if not annoncees:
            return ""
        dites = " · ".join(str(t) for t in annoncees)
        return (
            f"ce texte dit {dites} · le jeu est réglé sur {cible} · "
            "corriger ici ne corrige que cet appel"
        )


def _detail_du_detourage(
    passe: Passe, origine: str, nature: str, echelle: Echelle | None
) -> str:
    """Ce qui va détourer, **et qui l'a dit** (US-410, D1).

    « Je veux voir quel défaut va s'appliquer et d'où il vient, avant de
    générer, afin de ne pas le découvrir sur l'image revenue. »

    Trois provenances, trois phrases, et **la troisième ne nomme pas la famille
    en français**. Elle le pourrait — l'écran connaît le mot — mais il aurait
    fallu une seconde liste de noms de familles côté serveur, à tenir d'accord
    avec celle de l'interface. La famille est déjà à l'écran, choisie deux
    lignes plus haut : « cette famille » désigne sans recopier.
    """
    quoi = NOM_DU_MOTEUR.get(passe.moteur, passe.moteur)
    if passe.durcissement:
        quoi += f" · bord rongé de {passe.durcissement} px"
    if origine == DU_PRODUIT:
        return f"{quoi} · le réglage livré"
    if origine == DE_LA_FAMILLE:
        return f"{quoi} · ton réglage pour cette famille"
    return f"{quoi} · ton réglage pour {NOM_DE_LA_NATURE[nature]}"
