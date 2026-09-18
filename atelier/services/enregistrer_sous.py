# -*- coding: utf-8 -*-
"""Enregistrer sous — un rendu devient une autre pose ou une autre direction (RP20).

L'auteur ouvre *marche vers l'est* dans l'atelier, applique le miroir
gauche-droite, et voit une marche vers l'ouest sous ses yeux. Il ne peut pas la
garder : la recette décrit *cette* animation-là, et l'enregistrer la changerait
de sens sans lui donner de case. Ce service donne le geste qui manquait.

**Ce que ça fait, en une phrase** : le rendu courant devient l'image brute d'un
objet neuf, à recette vide, rangé dans une autre case du même sujet.

**Et ce que ça ne fait pas**, parce que les deux se confondent facilement :

- ce n'est pas le **miroir** de `B1`. Là-bas, le brut est celui du parent et
  c'est la *recette* qui retourne l'image — retirer la place la redresse. Ici,
  le retournement est **cuit dans les pixels**, et c'est voulu : la nouvelle
  case a sa vie à elle, on va la retoucher, et deux recettes posées sur le même
  brut finiraient par diverger (`docs/PLAN-remise-a-plat.md` § RP20) ;
- ce n'est pas **retenir**. La case d'arrivée n'est pas retenue pour le jeu ;
  la retenir est un second geste, et `favori` reste faux ;
- ce n'est pas une **copie**. La copie porterait la recette, celle-ci porte le
  rendu.

**L'original ne bouge pas, ni sa recette ni son rendu.** Le rendu se calcule par
le chemin d'aperçu — celui qui ne pose aucun cache durable —, donc les fichiers
de l'original sont exactement les mêmes après le geste qu'avant, à l'octet.

**Rien ne part sur le réseau.** Ce module n'importe ni catalogue, ni
fournisseur, ni animateur : c'est la même privation que le slicer, le miroir et
le montage, et c'est elle qui autorise la phrase du bouton — *aucun appel*.
"""

from __future__ import annotations

import base64
import time
import uuid
from typing import Any, Sequence

from atelier.domaine.animation import Clip
from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.bande import Bande, Prise
from atelier.domaine.direction import direction_au_miroir
from atelier.domaine.enregistrement import ANIMATION, IMAGE, Origine
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.generation import Emplacement, Generation, Statut
from atelier.domaine.recette import GAUCHE_DROITE, RETOURNEMENT, Recette
from atelier.image import extension, mesurer
from atelier.services.assets import AssetInconnu
# **Le même plancher de rang que les découpes et le miroir**, importé plutôt que
# recopié : trois fabriques qui numérotent dans la même génération doivent
# partir du même nombre, sinon la troisième écrase les fichiers de la première.
from atelier.services.decoupe import RANG_DECOUPE
from atelier.services.rangs import rang_libre

# Le modèle sous lequel se range le clip d'une animation enregistrée sous. **Un
# nom, pas un fournisseur**, comme `feuille-decoupee` : il sert à les retrouver
# entre eux au journal, sans ouvrir leur `generation.json`.
RENDU_ENREGISTRE = "rendu-enregistre"

# La nature du clip qui en sort. Ni `video`, ni `planche`, ni `assemblage` : ses
# images ne viennent pas d'un encodeur, d'une feuille ni d'une sélection, mais
# du rendu d'une animation déjà là.
RENDU = "rendu"

# Les deux calques du produit, et ce sont les seules valeurs que `quoi` prend.
QUOI = (IMAGE, ANIMATION)


class EnregistrementRefuse(ErreurAtelier):
    """Le rendu n'a pas de case où aller, et on dit pourquoi."""

    code = "enregistrement_refuse"


class ServiceEnregistrerSous:
    """Le geste d'`RP20`, pour une image comme pour une animation.

    Il reçoit l'atelier entier, comme la feuille animée : il ne fabrique que ce
    que les assets, la bibliothèque et le montage savent déjà écrire, et il n'a
    donc rien à tenir de son côté.
    """

    def __init__(self, atelier: Any) -> None:
        self.atelier = atelier

    # ── Proposer, sans rien écrire ───────────────────────────────────────────

    def proposer(
        self, quoi: str, identifiant: str, recette: Recette | None = None
    ) -> dict[str, Any]:
        """Ce que l'écran a besoin de savoir **avant** d'ouvrir la fenêtre.

        La case proposée, les listes où la corriger, et la raison quand le geste
        n'est pas offert. **Rien n'est créé, rien n'est écrit** : c'est la même
        coupure que le slicer et le miroir, où proposer et fabriquer sont deux
        gestes.

        La recette arrive de l'écran parce qu'elle n'est pas forcément
        enregistrée — c'est tout l'intérêt du geste, qui se pose sur un
        brouillon. Absente, celle du disque fait foi.
        """
        depart = self._depart(quoi, identifiant, recette)
        propose = self._direction_proposee(depart["direction"], depart["recette"])
        return {
            "quoi": depart["quoi"],
            "source": identifiant,
            "projet": depart["projet"],
            "sujet": depart["personnage"],
            "pose": depart["pose"],
            "direction": propose,
            # **La case de départ voyage aussi**, pour que l'écran puisse écrire
            # *venue de l'est* à côté de la proposition sans la recalculer.
            "direction_depart": depart["direction"],
            "miroir": _miroir_gauche_droite(depart["recette"]),
            "nom": _nom_propose(depart["nom"], depart["direction"], propose),
            "raison": self._raison(depart),
            "sujets": self._sujets(depart["projet"]),
            "poses": self._poses(depart["projet"], depart["personnage"]),
            "directions": self._directions(depart["projet"]),
            "derives": self.derives(quoi, identifiant),
        }

    def derives(self, quoi: str, identifiant: str) -> list[dict[str, Any]]:
        """Ce que cet original a déjà donné — **lu, jamais tenu en double**.

        Une image dérivée porte son `parent`, donc l'index la retrouve ; une
        bande dérivée nomme sa source dans son origine, donc on la retrouve en
        lisant les bandes. Tenir une liste sur l'original aurait été une seconde
        vérité, et elle se serait démentie à la première suppression.
        """
        if _quoi(quoi) == IMAGE:
            return [
                {
                    "identifiant": enfant.identifiant,
                    "nom": enfant.label,
                    "pose": enfant.pose,
                    "direction": enfant.direction,
                }
                for enfant in self.atelier.base.enfants(identifiant)
                if enfant.origine is not None
                and enfant.origine.source == identifiant
            ]
        return [
            {
                "identifiant": bande.identifiant,
                "nom": bande.nom,
                "pose": bande.pose,
                "direction": bande.direction,
            }
            for bande in self.atelier.base.bandes()
            if bande.origine is not None
            and bande.origine.source == identifiant
            and not bande.supprime
        ]

    # ── Enregistrer sous ─────────────────────────────────────────────────────

    def enregistrer(
        self,
        quoi: str,
        identifiant: str,
        *,
        recette: Recette | None = None,
        sujet: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        nom: str | None = None,
        prises: Sequence[Prise] | None = None,
    ) -> dict[str, Any]:
        """Le geste de la tranche. **Crée**, ne modifie rien.

        La case d'arrivée est celle que l'auteur a désignée ; ce qu'il laisse
        vide reprend la proposition, qui est la case de l'original — direction
        au miroir quand la recette en porte un.
        """
        depart = self._depart(quoi, identifiant, recette)
        raison = self._raison(depart)
        if raison is not None:
            raise EnregistrementRefuse(raison)

        vise = {
            "personnage": depart["personnage"] if sujet is None else (sujet or None),
            "pose": depart["pose"] if pose is None else (pose or None),
            "direction": (
                self._direction_proposee(depart["direction"], depart["recette"])
                if direction is None
                else (direction or None)
            ),
        }
        self._verifier_la_case(depart["projet"], vise)
        propre = (nom or "").strip() or _nom_propose(
            depart["nom"], depart["direction"], vise["direction"]
        )
        origine = Origine(
            source=identifiant,
            nature=depart["quoi"],
            recette=depart["recette"],
            direction=depart["direction"] or "",
            miroir=_miroir_gauche_droite(depart["recette"]),
        )
        if depart["quoi"] == IMAGE:
            return self._depuis_une_image(depart["asset"], origine, vise, propre)
        return self._depuis_une_bande(
            depart["bande"], origine, vise, propre, prises=prises
        )

    # ── Une image ────────────────────────────────────────────────────────────

    def _depuis_une_image(
        self,
        parent: Asset,
        origine: Origine,
        vise: dict[str, str | None],
        nom: str,
    ) -> dict[str, Any]:
        """Le rendu devient le brut d'un asset neuf, à recette vide.

        Les pixels viennent du **chemin d'aperçu** : celui-ci ne pose aucun
        cache durable, donc l'original ressort du geste avec exactement les
        mêmes fichiers qu'avant — c'est le critère *vérifié à l'octet*.
        """
        octets = self._rendu_de(parent, origine.recette)
        mesure = mesurer(octets)
        rang = self._premier_rang_libre(parent.generation)
        chemin = self.atelier.fichiers.ecrire_brut(
            parent.generation, rang, octets, extension(mesure.type_media)
        )
        neuf = self.atelier.assets.accueillir(
            Asset(
                identifiant=identifiant_de(parent.generation, rang),
                generation=parent.generation,
                rang=rang,
                brut=chemin,
                largeur=mesure.largeur,
                hauteur=mesure.hauteur,
                type_media=mesure.type_media,
                label=nom,
                # **Vide, et c'est le cœur du geste.** Le brut *est* le rendu :
                # lui recopier la recette de l'original l'appliquerait une
                # seconde fois — une image détourée puis redétourée, un miroir
                # qui se redresse.
                recette=Recette(),
                # **Rien n'a été payé.** L'argent a été dépensé une fois, pour
                # l'original, et la filiation y mène — le raisonnement de la
                # découpe et du miroir, mot pour mot.
                consomme=0.0,
                unite=parent.unite,
                provenance=parent.provenance,
                modele=parent.modele,
                projet=parent.projet,
                personnage=vise["personnage"],
                pose=vise["pose"],
                direction=vise["direction"],
                piece=parent.piece,
                parent=parent.identifiant,
                origine=origine,
                # **Datée de maintenant.** Ce qu'on vient de fabriquer se voit
                # en tête de grille ; datée du lot de l'original, une image
                # enregistrée d'une génération ancienne atterrirait au fond.
                cree_le=time.time(),
            )
        )
        # L'arbre compte les assets par projet : un de plus change ce compte, et
        # personne d'autre ne le recalcule.
        self.atelier.diffusion.publier(
            "bibliotheque", self.atelier.bibliotheque.arbre()
        )
        return {
            "quoi": IMAGE,
            "source": parent.identifiant,
            "asset": neuf.en_json(),
            "range": _range(neuf.pose, neuf.direction),
        }

    def _rendu_de(self, asset: Asset, recette: Recette) -> bytes:
        """Les pixels que l'écran a sous les yeux, **et rien d'écrit sur le disque**.

        `apercu_recette` est le seul chemin de rendu qui promette ça : il pose
        la recette sur une copie, calcule, et ne touche ni à l'asset ni à son
        cache. Refaire le calcul ici aurait donné une seconde chaîne de rendu,
        donc deux images pour une même recette le jour où l'une des deux
        changerait.
        """
        apercu = self.atelier.assets.apercu_recette(asset.identifiant, recette)
        return base64.b64decode(str(apercu["rendu"]).split(",", 1)[1])

    def _premier_rang_libre(self, generation: str) -> int:
        """Le rang du prochain fabriqué, au-dessus de tout ce qui existe déjà.

        Le calcul du slicer et du miroir : deux assets d'un même rang
        partageraient leurs fichiers `<rang>-brut` et `<rang>-asset.json`, et le
        second effacerait le premier sans rien dire.

        **Et au-dessus des rangs qu'un dépliage a réservés** (P1b) : le calcul
        commun vit dans `atelier/services/rangs.py`.
        """
        return rang_libre(self.atelier.base, generation, plancher=RANG_DECOUPE)

    # ── Une animation ────────────────────────────────────────────────────────

    def _depuis_une_bande(
        self,
        source: Bande,
        origine: Origine,
        vise: dict[str, str | None],
        nom: str,
        *,
        prises: Sequence[Prise] | None = None,
    ) -> dict[str, Any]:
        """Chaque frame rendue devient une image du clip neuf, et la bande suit.

        **Un clip neuf, et non des frames posées dans celui de l'original.** Une
        bande tire ses images du dossier de son clip par leur numéro : les
        ajouter là-bas décalerait les numéros de toutes les bandes déjà taillées
        dedans. Le clip neuf porte donc les images rendues, dans l'ordre, et il
        ne coûte rien — sa fiche le dit (`Clip.montant_dit`).
        """
        rendu = self.atelier.montage.rendu_des_frames(
            source.identifiant, prises=prises, recette=origine.recette
        )
        courante: Bande = rendu["bande"]
        clip = self._clip_du_rendu(rendu["images"], courante, vise, nom)
        bande = self.atelier.montage.garder(
            clip,
            nom,
            list(range(len(rendu["images"]))),
            # **La cadence et le sens sont conservés** : ce qu'on enregistre est
            # la même animation, vue de l'autre côté.
            cadence=courante.cadence,
            sens=courante.sens,
            # **Une recette vide**, pour la raison de l'image : les pixels
            # portent déjà tout ce que la recette disait.
            recette=Recette(),
            personnage=vise["personnage"],
            pose=vise["pose"],
            direction=vise["direction"],
        )
        bande.origine = origine
        self.atelier.montage.enregistrer(bande)
        return {
            "quoi": ANIMATION,
            "source": source.identifiant,
            "clip": clip,
            "bande": bande.en_json(),
            "range": _range(bande.pose, bande.direction),
        }

    def _clip_du_rendu(
        self,
        images: Sequence[bytes],
        courante: Bande,
        vise: dict[str, str | None],
        nom: str,
    ) -> str:
        """Le clip qui porte les frames rendues. **Aucun appel, aucun montant.**"""
        identifiant = uuid.uuid4().hex[:12]
        dossier = self.atelier.fichiers.dossier_images_clip(identifiant, 0)
        for numero, octets in enumerate(images):
            # Quatre chiffres, comme le décodeur vidéo les écrit : l'ordre
            # alphabétique du disque doit être celui de l'animation, sans quoi
            # l'image 10 se range avant la 2 et la marche part à l'envers.
            self.atelier.fichiers._poser(dossier / f"{numero:04d}.png", octets)
        generation = Generation(
            identifiant=identifiant,
            modele=RENDU_ENREGISTRE,
            demande={"nom": nom, "bande": courante.identifiant},
            parametres_resolus={"modele": RENDU_ENREGISTRE},
            emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, unite="images")],
            cree_le=time.time(),
            projet=courante.projet,
            personnage=vise["personnage"],
            pose=vise["pose"],
            direction=vise["direction"],
            # **L'auteur**, et il n'y a pas d'autre réponse : une bande ne porte
            # pas la provenance de l'appel qui l'a payée, et ce clip-ci ne vient
            # d'aucun appel — il vient d'un geste fait à l'écran.
            provenance="auteur",
            clip=Clip(
                nature=RENDU,
                images=len(images),
                cadence=float(courante.cadence),
                secondes=max(1, round(len(images) / (courante.cadence or 1))),
                prix_annonce=0,
                prix_formule="Rendu enregistré sous — aucun appel",
            ),
        )
        self.atelier.fichiers.ecrire_enregistrement(identifiant, generation.en_json())
        self.atelier.base.enregistrer(generation)
        self.atelier.diffusion.publier("generation", generation.en_json())
        return identifiant

    # ── Ce dont les deux chemins ont besoin ──────────────────────────────────

    def _depart(
        self, quoi: str, identifiant: str, recette: Recette | None
    ) -> dict[str, Any]:
        """L'original, sa case, et la recette qui fait foi pour ce geste-ci."""
        if _quoi(quoi) == IMAGE:
            asset = self.atelier.assets.lire(identifiant)
            if asset is None:
                raise AssetInconnu(identifiant)
            return {
                "quoi": IMAGE,
                "asset": asset,
                "bande": None,
                "projet": asset.projet,
                "personnage": asset.personnage,
                "pose": asset.pose,
                "direction": asset.direction,
                "nom": asset.label,
                "recette": recette if recette is not None else asset.recette,
            }
        bande = self.atelier.montage.bande(identifiant)
        return {
            "quoi": ANIMATION,
            "asset": None,
            "bande": bande,
            "projet": bande.projet,
            "personnage": bande.personnage,
            "pose": bande.pose,
            "direction": bande.direction,
            "nom": bande.nom,
            "recette": recette if recette is not None else bande.recette,
        }

    @staticmethod
    def _direction_proposee(depart: str | None, recette: Recette) -> str | None:
        """**La règle de la tranche en une ligne** : au miroir quand il y en a un.

        Sinon la case de l'original, à corriger — et c'est honnête : le produit
        ne devine pas qu'un mot français désigne une direction opposée
        (`atelier/domaine/direction.py`, `direction_au_miroir`).
        """
        if not _miroir_gauche_droite(recette):
            return depart
        return direction_au_miroir(depart) or depart

    @staticmethod
    def _raison(depart: dict[str, Any]) -> str | None:
        """Pourquoi le geste n'est pas offert — ou rien, quand il l'est.

        **Une seule cause, et elle se lit avant le clic** : sans recette, le
        rendu est le brut, et *enregistrer sous* ferait une copie à l'identique
        rangée ailleurs. Ce n'est pas ce que l'auteur demande, et le produit ne
        fabrique pas de doublon silencieux.
        """
        if depart["recette"].vide:
            return (
                "aucune retouche n'est appliquée — enregistrer sous rangerait "
                "la même image dans une seconde case"
            )
        return None

    def _verifier_la_case(
        self, projet: str | None, vise: dict[str, str | None]
    ) -> None:
        """La case d'arrivée existe-t-elle ? **Avant d'écrire quoi que ce soit.**

        La même règle que la destination d'une bande
        (`ServiceMontage._verifier_destination`) : un sujet d'un autre jeu, une
        pose que le sujet ne tient pas ou une direction que le jeu n'a pas
        nommée sont refusés en le disant — pas rangés dans une case inventée.

        **Sans sujet, il n'y a rien à vérifier** : la bibliothèque est faite
        d'images qui n'appartiennent à personne, et enregistrer sous en fabrique
        légitimement une de plus.
        """
        sujet, pose, direction = (
            vise["personnage"], vise["pose"], vise["direction"],
        )
        if not sujet:
            if pose or direction:
                raise EnregistrementRefuse(
                    "choisissez un sujet avant la pose et la direction"
                )
            return
        if not projet:
            raise EnregistrementRefuse(
                "cette image doit appartenir à un jeu pour être rangée sur un sujet"
            )
        chose = self.atelier.production.personnage(projet, sujet)
        if not pose:
            if direction:
                raise EnregistrementRefuse("choisissez une pose avant la direction")
            return
        plan = self.atelier.production.plan_de(projet, chose)
        attitude = next(
            (p for p in chose.tenues(plan) if p.identifiant == pose), None
        )
        if attitude is None:
            raise EnregistrementRefuse("cette pose n'appartient pas au sujet choisi")
        if direction:
            tenues = chose.directions_tenues(
                attitude, self.atelier.production.directions_du_jeu(projet)
            )
            if direction not in {d.identifiant for d in tenues}:
                raise EnregistrementRefuse(
                    "cette direction n'appartient pas à cette pose du sujet"
                )

    # ── Les listes que la fenêtre montre ─────────────────────────────────────

    def _sujets(self, projet: str | None) -> list[dict[str, str]]:
        if not projet:
            return []
        return [
            {"identifiant": p.identifiant, "nom": p.nom}
            for p in self.atelier.production.personnages(projet)
        ]

    def _poses(
        self, projet: str | None, personnage: str | None
    ) -> list[dict[str, str]]:
        """Les poses **de ce sujet-là**, pas le plan du jeu (E9).

        Une fenêtre qui proposerait le plan entier offrirait à un coffre les
        poses d'un personnage. Sans sujet, la liste est vide et l'écran ne
        propose pas de pose — ce qui est vrai : il n'y a pas de case.
        """
        if not (projet and personnage):
            return []
        chose = self.atelier.production.personnage(projet, personnage)
        return [
            {"identifiant": p.identifiant, "nom": p.nom}
            for p in chose.tenues(self.atelier.production.plan_de(projet, chose))
        ]

    def _directions(self, projet: str | None) -> list[dict[str, str]]:
        if not projet:
            return []
        return [
            {"identifiant": d.identifiant, "nom": d.nom}
            for d in self.atelier.production.directions_du_jeu(projet)
        ]


# ── Ce qui se lit sans service ──────────────────────────────────────────────


def _quoi(quoi: str) -> str:
    if quoi not in QUOI:
        raise EnregistrementRefuse(
            f"« {quoi} » n'est ni une image ni une animation"
        )
    return quoi


def _miroir_gauche_droite(recette: Recette) -> bool:
    """La recette porte-t-elle **le** miroir, celui qui change de direction ?

    `Recette.miroir` dit *il y a un retournement éveillé* — haut-bas et quart de
    tour compris. Ici la question est plus étroite, parce que la réponse sert à
    proposer une direction : seul le miroir gauche-droite échange l'est et
    l'ouest. Un demi-tour ou un quart de tour ne se rangent dans aucune case que
    la table du domaine connaisse.
    """
    return (
        recette.retournement is not None
        and not recette.dort(RETOURNEMENT)
        and recette.retournement.sens == GAUCHE_DROITE
    )


def _nom_propose(nom: str, depart: str | None, arrivee: str | None) -> str:
    """« marche vers l'est · ouest » — d'où ça vient, et où ça va.

    **La queue se remplace, elle ne s'empile pas** : c'est la règle du label du
    miroir (`atelier/services/miroir.py`), et pour la même raison — enregistrer
    deux fois de suite donnerait sinon deux directions dans un nom, dont la
    première est fausse. On ne retire que la queue que cette fonction a écrite.
    """
    base = (nom or "sans titre").strip()
    for ancienne in (f" · {depart}",) if depart else ():
        if base.endswith(ancienne):
            base = base[: -len(ancienne)].rstrip()
            break
    base = base[:48].rstrip()
    return f"{base} · {arrivee}" if arrivee else base


def _range(pose: str | None, direction: str | None) -> str:
    """Où le résultat est rangé, en clair — c'est ce que l'écran affiche après
    coup. Une case sans pose est un brouillon, et le produit le dit plutôt que
    de laisser croire à un rangement."""
    if not pose:
        return "dans la bibliothèque, sans case — à ranger quand tu voudras"
    return f"{pose} · {direction}" if direction else pose
