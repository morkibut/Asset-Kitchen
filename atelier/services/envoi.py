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

from atelier.domaine import Reinjection
from atelier.domaine.envoi import (
    AMBIANCE,
    IMAGES,
    JEU,
    OPTIONS,
    PLANCHE,
    SUJET,
    Tri,
    clef,
)
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import CARTE
from atelier.domaine.projet import AUCUNE_CIBLE
from atelier.services.generation import ServiceGenerations
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
        )
        lignes = apercu["lignes"]
        cases = self._cases(poses, directions, piece)

        compte = self._generations.compter_references(
            projet,
            echelle,
            references,
            personnage,
            cases,
            piece,
            ecartees_ici=references_ecartees,
            palette=palette_cochee,
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
            compte, mesure, places, palette_cochee, projet, personnage
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
        """
        identifiant = ligne.get("asset")
        if not identifiant:
            return None
        try:
            if ligne.get("origine") == CARTE:
                carte = self._univers.carte(projet or "", identifiant)
                return {"sorte": "carte", "carte": carte.en_json()}
            asset = self._assets.lire(identifiant) if self._assets else None
            return {"sorte": "asset", "asset": asset.en_json()} if asset else None
        except Exception:  # noqa: BLE001 — une image disparue se voit en moins
            return None

    def _images(
        self,
        compte: dict[str, Any],
        mesure: dict[str, Any],
        places: int,
        palette_cochee: bool,
        projet: str | None,
        personnage: str | None,
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
        """
        pas = mesure.get("par_image")
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
        return {
            "lignes": lignes,
            "places": places,
            "cochees": compte["total"],
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
        recette = univers.recette_de(lue)
        lignes: list[dict[str, str]] = []
        if cases >= 2:
            lignes.append(
                {"nom": "découper la planche", "detail": f"{cases} cases"}
            )
        if recette.passes:
            lignes.append({"nom": "détourer le fond", "detail": "remplissage du bord"})
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
        ):
            allumees, total = compter(groupe)
            if total:
                groupes.append(
                    {"clef": groupe, "nom": nom, "allumees": allumees, "total": total}
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
