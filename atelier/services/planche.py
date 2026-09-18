# -*- coding: utf-8 -*-
"""La planche d'une pose — ce qu'on achète, vu avant de payer (E13).

**Une planche est une seule image demandée au modèle**, dans laquelle il dessine
plusieurs sujets côte à côte sur une grille dont l'atelier connaît la géométrie
case par case. Elle part, elle revient, l'atelier la découpe, et **ce qui entre
en bibliothèque ce sont les morceaux — jamais la feuille**. C'est une ruse pour
payer moins, pas un format de livraison.

**Pourquoi elle a un écran depuis la V2.1.** Tant qu'une pose valait une image,
il n'y avait rien à montrer : une case, un appel, et la barre de prompt
suffisait. C'est la déclaration des directions (E10) qui crée la planche — une
pose devient un paquet de quatre images qui doivent se ressembler entre elles, et
un paquet se regarde avant de l'acheter.

**Ce module ne fabrique rien et n'enregistre rien.** Il lit ce qui existe, il
demande au service de génération les cases qu'un envoi composerait — le même
chemin, jamais un second —, et il rend un état d'écran. Le seul endroit d'où
l'argent part reste la barre qui paie.

## Ce que les mesures disent du prix, et ce qu'elles ne disent pas

Six comptes de cases ont été payés, dix-huit appels en tout, et le relevé vit
dans `essais/mesures_prix_planche.json` — **versionné**, parce qu'un prix affiché
qui ne serait pas dans le dépôt serait un prix en dur dont personne ne saurait
plus d'où il vient.

Les trois derniers, tirés le 31 août 2026, ne disent pas ce qu'on attendait.
Trois cases et six cases ont coûté **exactement le même prix**, $0,0139, pour la
même taille d'image et la même durée ; cinq cases ont coûté $0,0534, presque
quatre fois plus, sur un appel dont rien ne distingue le résultat. La lecture
honnête est donc double, et l'écran porte les deux moitiés :

- **Une planche coûte le prix d'un appel**, quel que soit ce qu'elle porte. Le
  prix par image tombe en `1/N` : six cases reviennent à $0,0023 l'image contre
  $0,0128 pour une image seule, cinq fois moins.
- **La variance entre deux appels identiques dépasse l'écart entre deux tailles
  de planche.** Un prix affiché *par nombre de cases* montrerait donc du bruit
  comme si c'était une structure — et l'auteur choisirait de compléter trois
  cases plutôt que d'en refaire quatre sur une différence qui n'existe pas.

**D'où la forme du tableau de l'écran** : un prix d'appel unique, avec l'écart
observé et le nombre d'appels derrière lui, multiplié par le nombre d'appels que
chaque choix demande. Ce qui sépare les trois choix est alors ce qui les sépare
vraiment — un appel ou trois —, et non le bruit de la facturation.

**Et ce prix unique vient d'abord du journal de la machine.** Le banc dit ce que
le prix *fait* — qu'il ne dépend pas du nombre de cases —, mais le chiffre qui
s'affiche est celui que ce modèle-là a réellement facturé ici, exactement comme
la barre qui paie depuis T1. Sans cette règle, l'écran annonçait $0,0128 du banc
pendant que la barre, trois centimètres plus bas, annonçait $0,0160 du journal :
deux prix pour le même appel, sur le même écran. Le banc reprend la main quand ce
modèle n'a jamais rien facturé ici — l'état d'un atelier neuf.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.personnage import Personnage
from atelier.domaine.pliage import geometrie
from atelier.image.pliage import COTE, cote_de_case
from atelier.services.generation import ServiceGenerations
from atelier.services.prix import prix_de
from atelier.services.production import ServiceProduction

__all__ = ["PlancheRefusee", "ServicePlanche", "prix_du_banc", "prix_dun_appel"]


class PlancheRefusee(ErreurAtelier):
    """Cette planche-là ne peut pas se composer, et on dit pourquoi."""


# Le relevé des appels payés, à la racine du dépôt. **Lu, jamais recopié dans le
# paquet** : le banc qui le remplit vit dans `essais/`, et en garder une copie
# ici en ferait une seconde vérité que la prochaine mesure contredirait sans que
# rien ne le dise.
#
# Absent — un dépôt installé ailleurs, une copie partielle —, l'écran affiche
# *prix non mesuré* plutôt qu'un chiffre inventé. C'est le comportement que la
# maquette demande déjà pour un compte de cases jamais payé.
_RELEVE = Path(__file__).resolve().parents[2] / "essais" / "mesures_prix_planche.json"


def _lire_releve() -> list[dict[str, Any]]:
    if not _RELEVE.exists():
        return []
    try:
        brut = json.loads(_RELEVE.read_text(encoding="utf-8"))
    except (OSError, ValueError):  # pragma: no cover — un fichier abîmé
        return []
    points: list[dict[str, Any]] = []
    for cle, mesure in brut.items():
        if not cle.isdigit() or not isinstance(mesure, dict):
            continue
        cases = int(mesure.get("cases") or cle)
        par_image = float(mesure.get("par_image") or 0.0)
        appels = int(mesure.get("appels") or 1)
        if cases < 1 or par_image <= 0 or appels < 1:
            continue
        points.append(
            {
                "cases": cases,
                # **Le prix d'un appel, pas celui d'une image.** C'est la
                # grandeur que la mesure a vraiment vue : le fournisseur facture
                # l'appel, et le prix par image en est le quotient.
                "appel": round(par_image * cases, 6),
                "par_image": par_image,
                "appels": appels,
                "origine": str(mesure.get("origine") or ""),
            }
        )
    return sorted(points, key=lambda p: p["cases"])


def prix_du_banc() -> dict[str, Any]:
    """Ce qu'un appel a coûté **au banc** — une valeur, un écart, un compte.

    La valeur est la médiane des prix mesurés, **pondérée par le nombre d'appels
    derrière chacun** : treize des dix-huit appels connus sont des images seules,
    et faire compter autant un point tiré une fois qu'un point tiré treize fois
    donnerait plus de poids au bruit qu'à la mesure.

    L'écart est le minimum et le maximum observés, et il n'est pas décoratif :
    c'est lui qui dit pourquoi il n'y a **qu'un** prix ici plutôt qu'un par
    nombre de cases.
    """
    points = _lire_releve()
    if not points:
        return {
            "prix": 0.0,
            "bas": 0.0,
            "haut": 0.0,
            "appels": 0,
            "mesure": False,
            "origine": "",
        }

    etendus = sorted(p["appel"] for p in points for _ in range(p["appels"]))
    milieu = len(etendus) // 2
    mediane = (
        etendus[milieu]
        if len(etendus) % 2
        else (etendus[milieu - 1] + etendus[milieu]) / 2
    )
    return {
        "prix": round(mediane, 6),
        "bas": round(min(etendus), 6),
        "haut": round(max(etendus), 6),
        "appels": len(etendus),
        "mesure": True,
        "origine": "banc",
    }


def prix_dun_appel(mesure_ici: dict[str, Any] | None = None) -> dict[str, Any]:
    """Ce qu'un appel coûte, **et il n'y a qu'un chiffre dans tout le produit**.

    **Ce que cette machine a payé passe avant le banc.** La règle est déjà celle
    du produit — *une mesure, jamais un tarif ; le coût réel facturé fait foi* —
    et la barre qui paie l'applique depuis T1. La première fois que l'écran de la
    planche s'est ouvert, il annonçait `$0,0128` du banc pendant que la barre,
    trois centimètres plus bas, annonçait `$0,0160` du journal : deux prix pour
    le même appel, sur le même écran. C'est la contradiction que cette fonction
    supprime.

    Le banc reste, et il reste **utile** : il répond quand ce modèle-là n'a
    jamais rien facturé ici, ce qui est le cas d'un atelier neuf. Et c'est lui,
    dans les deux cas, qui a établi ce que l'écran *dit* du prix — qu'il ne
    dépend pas du nombre de cases.
    """
    if mesure_ici and mesure_ici.get("prix"):
        return {
            "prix": round(float(mesure_ici["prix"]), 6),
            "bas": round(float(mesure_ici["bas"]), 6),
            "haut": round(float(mesure_ici["haut"]), 6),
            "appels": int(mesure_ici["appels"]),
            # **La décomposition voyage avec la médiane** (E14), sans quoi cet
            # écran-ci retomberait sur la médiane pendant que l'écran de
            # confirmation décompose — deux prix pour le même appel, ce qui est
            # exactement le piège que ce chiffre-là a déjà coûté une fois.
            "base": mesure_ici.get("base"),
            "par_image": mesure_ici.get("par_image"),
            "mesure": True,
            "origine": "ici",
        }
    return prix_du_banc()


class ServicePlanche:
    """Ce que l'écran de la planche montre, et rien de plus.

    **Deux services derrière, et chacun pour ce qu'il sait.** La production tient
    la matrice — quelle direction est pleine, laquelle attend — ; la génération
    tient les cases qu'un envoi composerait. Rien n'est recalculé ici de ce que
    l'un des deux sait déjà.
    """

    def __init__(
        self, production: ServiceProduction, generations: ServiceGenerations
    ) -> None:
        self._production = production
        self._generations = generations

    # ── L'écran ──────────────────────────────────────────────────────────────

    def planche(self, projet: str, personnage: str, pose: str) -> dict[str, Any]:
        """La planche que cette pose-là enverrait.

        Rend les cases dans l'ordre de lecture de la grille, la géométrie que
        l'atelier posera, les trois choix avec leur prix, et ce que chaque case
        contient déjà. **Rien n'est enregistré** : une case est pleine parce
        qu'une image la porte, et supprimer l'image vide sa case toute seule.
        """
        vise = self._production.personnage(projet, personnage)
        ligne = self._ligne(projet, vise, pose)
        attitude = next(
            (
                p
                for p in vise.tenues(self._production.plan_de(projet, vise))
                if p.identifiant == pose
            ),
            None,
        )
        if attitude is None:  # pragma: no cover — `_ligne` a déjà refusé
            raise PlancheRefusee(f"« {vise.nom} » ne tient pas la pose « {pose} »")

        toutes = [d["identifiant"] for d in ligne["directions"]]
        vides = [d["identifiant"] for d in ligne["directions"] if not d["images"]]
        pleines = [d for d in toutes if d not in vides]

        # **Un seul prix d'appel dans tout l'écran, et il vient d'où vient
        # celui de la barre qui paie.** Le modèle du jeu pour les planches, ce
        # qu'il a réellement facturé ici, et le banc en dernier recours.
        prix = prix_dun_appel(self._mesure_ici(projet))
        # **Et les images que cet appel joindra**, parce que E14 a mesuré ce
        # qu'elles coûtent : le prix d'un appel n'est pas indépendant d'elles —
        # une seule image jointe double le prix chez le modèle principal du
        # dépôt. L'écran de la planche et l'écran de confirmation passent donc
        # par la même décomposition, sans quoi ils annonceraient deux prix pour
        # le même appel, ce que E13 a déjà payé une fois.
        jointes = self._generations.compter_references(
            projet,
            vise.type,
            personnage=vise.identifiant,
            cases=len(toutes),
            # **Une planche de ses directions emporte la planche du sujet**
            # (RS1) — elle compte donc dans le prix que cet écran annonce.
            directions=toutes,
        )

        # **Ce qui part par défaut : tout.** Refaire les quatre est le premier
        # choix de l'écran, et il est posé sur une mesure — à prix d'appel égal,
        # quatre cases peintes ensemble se ressemblent, trois complétées à côté
        # d'une ancienne ne se ressemblent pas.
        return {
            "personnage": vise.identifiant,
            "personnage_nom": vise.nom,
            "pose": attitude.identifiant,
            "pose_nom": attitude.nom,
            "cases": self._cases(projet, vise, attitude.identifiant, toutes, vides),
            "geometrie": self.geometrie(len(toutes), projet),
            "choix": self._choix(
                len(toutes), len(vides), len(pleines), prix, jointes["total"]
            ),
            "prix": prix,
            # **Le banc, toujours, et à côté du prix affiché.** C'est lui qui a
            # établi ce que l'écran *dit* du prix — qu'il ne dépend pas du
            # nombre de cases —, et cette phrase-là a besoin des chiffres qui la
            # portent. Le journal de la machine ne les porte pas toujours : sur
            # le vrai projet, les deux seuls appels connus du modèle de planche
            # ont coûté exactement le même prix, et l'écran affirmait alors une
            # variance que ses propres chiffres démentaient.
            "banc": prix_du_banc(),
            # **Le modèle que ce prix chiffre**, écrit à côté du prix. Le jeu
            # désigne un modèle pour ses planches, et c'est le sien qu'on lit —
            # mais la barre qui paie garde celui que l'auteur a choisi, et deux
            # modèles n'ont pas le même prix. Sans ce nom, l'écran annoncerait
            # $0,0342 pendant que la barre annoncerait $0,0160, trois
            # centimètres plus bas, sans que rien ne dise que ce ne sont pas les
            # mêmes appels.
            "modele": self._production.modele_de_planche(projet),
            # **Ce qui part en référence, compté par le serveur** — l'écran ne
            # connaît ni les artworks du jeu, ni les concept arts de la chose,
            # ni le dédoublonnage entre les trois, et deux comptes calculés à
            # deux endroits auraient divergé. Le gabarit de la grille en fait
            # partie : il part avec l'appel, il occupe une place dans le plafond
            # du modèle, et chez ceux qui facturent au token il coûte.
            "jointes": jointes,
            # **Ce que la planche jette, nommé avant de lancer.** Refaire une
            # case qu'on a ne fait pas disparaître l'ancienne image — elle reste
            # en bibliothèque, elle garde son prix payé —, mais on aura payé deux
            # fois pour une case, et l'écran l'écrit.
            "deja_pleines": pleines,
        }

    def _prix(self, appel: dict[str, Any], images: int, appels: int) -> float:
        """Ce que ces appels-là coûteront, **images jointes comprises** (E14).

        La décomposition quand la machine a de quoi la calculer, la médiane
        sinon — et c'est `atelier/services/prix.py` qui tranche, pour les deux
        écrans à la fois. Sans mesure, zéro : l'écran dit alors qu'il ne sait
        pas, plutôt que d'annoncer un chiffre que personne n'a payé.
        """
        if not appel["mesure"]:
            return 0.0
        chiffre = prix_de(appel, images, appels)
        return round(chiffre, 6) if chiffre is not None else 0.0

    def _mesure_ici(self, projet: str) -> dict[str, Any] | None:
        """Ce que le modèle de planche de ce jeu a coûté **sur cette machine**.

        Rien quand le jeu n'en désigne aucun, ou qu'il n'a jamais rien facturé
        ici : le banc répond alors, et l'écran dit d'où vient son chiffre.
        """
        modele = self._production.modele_de_planche(projet)
        if not modele:
            return None
        return self._generations.appels_mesures(modele)

    def geometrie(self, cases: int, projet: str = "") -> dict[str, Any]:
        """La grille que l'atelier posera, et ce qu'un sujet y fera de côté.

        **Écrite par l'atelier, montrée, et non modifiable** : c'est elle qui
        rend le découpage du retour possible sans deviner, et la changer à la
        main casserait le rangement de ce qui revient. Le motif du produit pour
        tout ce qui est indisponible — affiché, avec sa raison.
        """
        forme = geometrie(cases)
        cible = 0
        if projet:
            cible = self._production.cible_du_projet(projet)
        sujet = cote_de_case(forme)
        return {
            "cases": forme.cases,
            "colonnes": forme.colonnes,
            "lignes": forme.lignes,
            "cote_px": COTE,
            "sujet_px": sujet,
            "cible_px": cible,
            # Combien de fois la cible du projet — le chiffre qui dit que plier
            # ne coûte pas de qualité. Sous 1, il en coûterait, et l'écran le
            # dirait ; sur les comptes que le produit propose, il ne descend
            # jamais là.
            "fois_la_cible": round(sujet / cible, 1) if cible else 0.0,
        }

    # ── Ce qui compose l'écran ───────────────────────────────────────────────

    def _ligne(self, projet: str, vise: Personnage, pose: str) -> dict[str, Any]:
        """La ligne de matrice de cette pose — **lue, jamais recalculée**.

        `ServiceProduction.cases` sait déjà quelle direction est pleine, laquelle
        attend, et quelle image y est rangée à confirmer. Refaire ce calcul ici
        aurait donné deux comptes à tenir d'accord, et le premier écart se serait
        vu à l'endroit le plus cher : une case annoncée vide qu'on repaie.
        """
        for ligne in self._production.cases(projet, vise):
            if ligne["pose"] == pose:
                return ligne
        raise PlancheRefusee(f"« {vise.nom} » ne tient pas la pose « {pose} »")

    def _cases(
        self,
        projet: str,
        vise: Personnage,
        pose: str,
        toutes: list[str],
        vides: list[str],
    ) -> list[dict[str, Any]]:
        """Une entrée par direction, avec le texte qui partirait pour elle.

        **Le texte vient du chemin de l'envoi**, jamais d'une recomposition
        locale : c'est ce qui rend vraie la règle *ce qui est montré est ce qui
        part*, plutôt que seulement affirmée.
        """
        ligne = self._ligne(projet, vise, pose)
        remplies = {d["identifiant"]: d for d in ligne["directions"]}

        # Deux directions au moins pour composer une planche ; en dessous, il n'y
        # a rien à plier et le texte de la case vaut celui de la case unique.
        pliage = (
            self._generations.cases_de_planche(
                projet, vise.identifiant, pose=pose, directions=toutes
            )
            if len(toutes) > 1
            else None
        )
        textes = (
            {case.direction: case.texte for case in pliage.cases if case.direction}
            if pliage
            else {}
        )

        rendues: list[dict[str, Any]] = []
        for rang, identifiant in enumerate(toutes):
            connue = remplies.get(identifiant, {})
            forme = geometrie(len(toutes))
            rendues.append(
                {
                    "direction": identifiant,
                    "nom": connue.get("nom", identifiant),
                    "texte": textes.get(identifiant, ""),
                    "images": connue.get("images", []),
                    "pleine": identifiant not in vides,
                    # **La place de la case, écrite par l'atelier** : c'est le
                    # mot que le prompt emploie — *top-left*, *top-right* — et
                    # c'est lui qui permet de savoir quel morceau de l'image
                    # revenue va dans quelle direction.
                    "colonne": rang % forme.colonnes,
                    "ligne": rang // forme.colonnes,
                }
            )
        return rendues

    def _choix(
        self,
        toutes: int,
        vides: int,
        pleines: int,
        appel: dict[str, Any],
        images: int = 0,
    ) -> list[dict[str, Any]]:
        """Les trois façons de remplir ce qui manque, **avec ce qu'elles coûtent**.

        Trois lignes, trois prix, et le nombre d'appels derrière chacun. La
        colonne des appels n'est pas décorative : c'est elle qui porte toute la
        différence, maintenant qu'on sait qu'une planche coûte le prix d'un appel
        quel que soit ce qu'elle porte.

        **Refaire tout est le premier choix, et il est posé sur une mesure.** Il
        coûte un appel, comme compléter en une planche, et il achète quelque
        chose que l'autre n'achète pas : les cases sortent à la même échelle et
        dans le même style, puisqu'elles ont été peintes ensemble. Compléter à
        l'unité coûte autant d'appels qu'il manque de cases — le plus cher, et le
        moins bon.
        """

        def ligne(
            clef: str, quoi: str, cases: int, appels: int, refus: str = ""
        ) -> dict[str, Any]:
            return {
                "clef": clef,
                "quoi": quoi,
                "cases": cases,
                "appels": appels,
                "prix": self._prix(appel, images, appels),
                "par_image": (
                    round(self._prix(appel, images, appels) / cases, 6)
                    if appel["mesure"] and cases
                    else 0.0
                ),
                "mesure": appel["mesure"],
                "refus": refus,
            }

        choix = [
            ligne(
                "refaire",
                f"Refaire les {toutes} — une planche",
                toutes,
                1,
                # Une seule case n'est pas une planche : c'est la génération
                # ordinaire, et la plier ferait payer un gabarit et une consigne
                # de grille pour une image que le produit sait déjà demander.
                "" if toutes > 1 else "une seule direction — c'est un appel simple",
            )
        ]
        if vides and vides != toutes:
            choix.append(
                ligne(
                    "completer",
                    f"Compléter les {vides} — une planche",
                    vides,
                    1,
                    "" if vides > 1 else "une seule case manque — c'est un appel simple",
                )
            )
        if vides:
            choix.append(
                ligne(
                    "unite",
                    f"Compléter les {vides} — un appel chacune",
                    vides,
                    vides,
                )
            )
        if not vides:
            # Tout est plein : il n'y a rien à compléter, et le dire vaut mieux
            # que de proposer deux lignes vides.
            choix.append(
                ligne(
                    "unite",
                    "Compléter — rien ne manque",
                    0,
                    0,
                    f"les {pleines} cases sont pleines",
                )
            )
        return choix
