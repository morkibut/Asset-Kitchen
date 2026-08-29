# -*- coding: utf-8 -*-
"""Le plan de poses, les personnages, et la matrice qui dit ce qui manque.

C1. Trois gestes, et un calcul.

**Les gestes** : écrire le plan du projet — la liste des attitudes que le jeu
réclame —, créer et décrire un personnage, et dire lesquelles de ces attitudes
il tient. Aucun d'eux ne sort : tout ce fichier fonctionne réseau coupé, et
c'est un critère d'acceptation de la tranche. Il ne connaît ni le fournisseur,
ni le catalogue, et ça se lit dans ses imports.

**Le calcul** : la matrice. Elle n'est enregistrée nulle part — elle se déduit
du plan, du personnage et des assets qui portent sa case. C'est ce qui interdit
l'état où une case se dit pleine alors que l'image a été supprimée, et c'est
aussi pourquoi supprimer un personnage ne détruit rien : les images ne sont pas
à lui, elles disent seulement qu'elles étaient de lui.

**Ce service écrit deux sortes de choses, et par deux chemins déjà en place.**
Le plan vit dans `projet.json`, donc il passe par `ServiceBibliotheque`, seul
écrivain d'un projet — la règle de l'univers, appliquée telle quelle. Les
personnages ont un fichier chacun sous leur projet, et c'est ce module qui les
écrit, comme `ServiceUnivers` est le seul à écrire une carte.
"""

from __future__ import annotations

from typing import Any, Sequence

from atelier.depot import Base, Fichiers
from atelier.domaine.asset import Asset
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.personnage import Personnage
from atelier.domaine.plan import Pose
from atelier.domaine.projet import Projet, repere
from atelier.services.assets import AssetInconnu, ServiceAssets
from atelier.services.bibliotheque import ProjetInconnu, ServiceBibliotheque
from atelier.services.evenements import Diffusion


class PersonnageInconnu(ErreurAtelier):
    code = "personnage_inconnu"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucun personnage « {identifiant} » dans ce projet")


class PoseInconnue(ErreurAtelier):
    code = "pose_inconnue"

    def __init__(self, identifiant: str) -> None:
        super().__init__(f"aucune pose « {identifiant} » dans le plan de ce projet")


class ProductionRefusee(ErreurAtelier):
    """Un geste que le produit refuse, avec sa raison en clair."""

    code = "production_refusee"


class ServiceProduction:
    def __init__(
        self,
        base: Base,
        fichiers: Fichiers,
        bibliotheque: ServiceBibliotheque,
        assets: ServiceAssets,
        diffusion: Diffusion,
    ) -> None:
        self._base = base
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque
        self._assets = assets
        self._diffusion = diffusion

    # ── Le plan du projet ────────────────────────────────────────────────────

    def plan(self, projet: str) -> tuple[Pose, ...]:
        """La liste des attitudes que ce jeu réclame.

        Relue du projet à chaque fois, comme les cartes du disque : la seule
        copie qui existe est celle du fichier.
        """
        return self._exiger(projet).plan

    def ajouter_pose(self, projet: str, nom: str, images: int = 1) -> Pose:
        """**Nommer, c'est créer** (`docs/PRD.md`) : un nom de pose qui n'existe
        pas encore le crée sur-le-champ, sans passer par un écran de gestion.

        **Et ça n'ajoute qu'une case vide.** Chaque personnage qui porte ce plan
        voit paraître la ligne neuve — sans qu'un seul fichier de personnage soit
        écrit, puisqu'un personnage range ce qu'il **écarte** et non ce qu'il
        tient. Aucune génération ne part, et rien ici ne coûte : c'est un
        critère d'acceptation de la tranche, et il est vrai par construction.
        """
        objet = self._exiger(projet)
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("une pose se crée avec un nom")
        if any(p.nom.casefold() == propre.casefold() for p in objet.plan):
            raise ProductionRefusee(f"« {propre} » est déjà une pose de ce plan")

        pose = Pose(
            identifiant=repere(propre, {p.identifiant for p in objet.plan}, "pose"),
            nom=propre,
            images=max(1, images),
        )
        # **En queue, jamais trié.** L'ordre du plan est celui de la matrice, et
        # c'est l'ordre dans lequel l'auteur pense son jeu ; le ranger par
        # alphabet mettrait « attaque » avant « repos » et rendrait deux
        # personnages illisibles côte à côte.
        objet.plan = objet.plan + (pose,)
        self._sauver_projet(objet)
        return pose

    def regler_pose(
        self,
        projet: str,
        pose: str,
        *,
        nom: str | None = None,
        images: int | None = None,
    ) -> Pose:
        """Renommer une pose, ou changer le nombre d'images qu'elle demande.

        **L'identifiant ne bouge pas**, et c'est tout l'intérêt : les images déjà
        faites le portent, et renommer « marche » en « déplacement » ne doit pas
        leur faire perdre leur case (US-118).
        """
        objet = self._exiger(projet)
        courante = self._exiger_pose(objet, pose)

        propre = courante.nom if nom is None else nom.strip()
        if not propre:
            raise ProductionRefusee("une pose garde un nom")
        if any(
            p.identifiant != courante.identifiant
            and p.nom.casefold() == propre.casefold()
            for p in objet.plan
        ):
            raise ProductionRefusee(f"« {propre} » est déjà une pose de ce plan")

        reglee = Pose(
            identifiant=courante.identifiant,
            nom=propre,
            images=courante.images if images is None else max(1, images),
        )
        objet.plan = tuple(
            reglee if p.identifiant == courante.identifiant else p for p in objet.plan
        )
        self._sauver_projet(objet)
        return reglee

    def retirer_pose(self, projet: str, pose: str) -> Pose:
        """Une pose quitte le plan — **et les images faites pour elle restent**.

        Jamais de cascade, ici comme ailleurs. La ligne disparaît de la matrice,
        les images restent dans la bibliothèque avec leur label et leur
        filiation, et elles gardent l'identifiant de la pose : remettre la même
        pose au plan les remet dans leur case.

        L'écart des personnages, lui, n'est pas balayé : une entrée qui ne
        désigne plus rien n'écarte rien, et la nettoyer demanderait de réécrire
        tous les personnages du projet pour un geste qui ne le mérite pas.
        """
        objet = self._exiger(projet)
        retiree = self._exiger_pose(objet, pose)
        objet.plan = tuple(
            p for p in objet.plan if p.identifiant != retiree.identifiant
        )
        self._sauver_projet(objet)
        return retiree

    # ── Les personnages ──────────────────────────────────────────────────────

    def personnages(self, projet: str) -> list[Personnage]:
        """Ceux de ce projet, dans l'ordre où ils ont été créés.

        **Lus du disque, jamais d'un index** : ils ne se cherchent ni ne se
        paginent, et effacer `atelier.sqlite3` ne peut pas les perdre.
        """
        self._exiger(projet)
        lus = [
            Personnage.depuis_json(contenu)
            for contenu in self._fichiers.parcourir_personnages(projet)
        ]
        return sorted(lus, key=lambda p: (p.cree_le, p.identifiant))

    def personnage(self, projet: str, identifiant: str) -> Personnage:
        for un in self.personnages(projet):
            if un.identifiant == identifiant:
                return un
        raise PersonnageInconnu(identifiant)

    def creer_personnage(
        self, projet: str, nom: str, description: str = ""
    ) -> Personnage:
        """Un nom, une description, et rien d'autre (US-115).

        **Aucun prompt ici, et aucune image.** Le corps naît dans l'atelier et
        nulle part ailleurs : on écrit un sujet, on génère, et c'est l'image
        obtenue qu'on désigne. Ce geste-ci ne fabrique qu'une colonne de cases
        vides — il ne demande rien au fournisseur et ne coûte rien.
        """
        propre = nom.strip()
        if not propre:
            raise ProductionRefusee("un personnage se crée avec un nom")
        existants = self.personnages(projet)
        if any(p.nom.casefold() == propre.casefold() for p in existants):
            raise ProductionRefusee(f"« {propre} » est déjà un personnage de ce projet")

        personnage = Personnage(
            identifiant=repere(propre, {p.identifiant for p in existants}, "personnage"),
            projet=projet,
            nom=propre,
            description=description.strip(),
        )
        self._sauver(personnage)
        return personnage

    def regler_personnage(
        self,
        projet: str,
        identifiant: str,
        *,
        nom: str | None = None,
        description: str | None = None,
        tenues: Sequence[str] | None = None,
        concept_arts: Sequence[str] | None = None,
    ) -> Personnage:
        """Tout ce qui se règle sur un personnage, **en un seul geste**.

        Les champs se remplissent ensemble à l'écran — on décrit en cochant les
        poses qu'on veut —, et un appel par champ ferait autant d'allers-retours
        qu'il y a de cases. `None` ne touche pas.

        **`tenues` arrive en positif et se range en négatif.** L'écran envoie ce
        que l'auteur a coché ; le fichier garde le complément, pour qu'une pose
        ajoutée au plan paraisse chez tout le monde sans que rien ne soit
        réécrit. Une pose qu'aucun plan ne connaît est ignorée plutôt que
        refusée : un onglet resté ouvert pendant qu'on retirait une pose ne doit
        pas voir ses coches refusées en bloc.
        """
        objet = self._exiger(projet)
        personnage = self.personnage(projet, identifiant)

        if nom is not None:
            propre = nom.strip()
            if not propre:
                raise ProductionRefusee("un personnage garde un nom")
            if any(
                autre.identifiant != personnage.identifiant
                and autre.nom.casefold() == propre.casefold()
                for autre in self.personnages(projet)
            ):
                raise ProductionRefusee(
                    f"« {propre} » est déjà un personnage de ce projet"
                )
            personnage.nom = propre

        if description is not None:
            personnage.description = description.strip()

        if tenues is not None:
            cochees = set(tenues)
            personnage.ecartees = tuple(
                p.identifiant for p in objet.plan if p.identifiant not in cochees
            )

        if concept_arts is not None:
            personnage.concept_arts = tuple(dict.fromkeys(concept_arts))

        self._sauver(personnage)
        return personnage

    def supprimer_personnage(self, projet: str, identifiant: str) -> dict[str, Any]:
        """Le personnage part, **ses images restent** (`docs/PLAN.md` C1).

        Jamais de cascade : chaque image faite pour lui est marquée « personnage
        supprimé » et reste exactement où elle est, comme un enfant survit à son
        parent (US-28, US-29). C'est un fait acquis à l'instant du départ, pas
        une déduction refaite à chaque affichage — sans quoi il faudrait garder
        quelque part la liste des personnages qui ont existé.

        **Un balayage n'annonce pas objet par objet** (`docs/PIEGES.md`) : les
        images se sauvent sans annonce et la grille est annoncée une fois, à la
        fin. Cent images marquées ne doivent pas chasser du flux d'un onglet
        lent les messages qui comptent.
        """
        personnage = self.personnage(projet, identifiant)
        marques = 0
        for asset in self._base.assets_du_personnage(personnage.identifiant):
            if asset.personnage_supprime:
                continue
            asset.personnage_supprime = True
            self._assets.sauver(asset, annoncer=False)
            marques += 1

        self._fichiers.effacer_personnage(projet, personnage.identifiant)
        # Un personnage parti n'a plus de cases à calculer — mais il garde sa
        # forme : l'écran le retire sur `supprime`, et une charge d'une autre
        # forme que les autres serait un cas de plus à traiter pour rien.
        self._diffusion.publier(
            "personnage",
            {**personnage.en_json(), "cases": [], "supprime": True},
        )
        if marques:
            self._diffusion.publier("bibliotheque", self._bibliotheque.arbre())
        return {"personnage": personnage.en_json(), "images": marques}

    # ── Les cases, et ce qui les remplit ─────────────────────────────────────

    def en_charge(self, projet: str, personnage: Personnage) -> dict[str, Any]:
        """Un personnage tel qu'il franchit le port — **et il n'en a qu'une forme**.

        Ses cases sont dedans, toujours. C'est écrit ici et appelé partout parce
        que la première version ne l'a fait que dans le tableau de bord : le
        `PUT` et l'annonce du flux rendaient le même objet **sans** ses cases, et
        l'écran, qui fond ce qui lui arrive par les deux chemins, remplaçait un
        personnage complet par un personnage amputé. Écrire une description
        vidait donc la matrice — jusqu'à la faire tomber. Trouvé au navigateur,
        invisible aux essais d'écran : leur double, lui, rendait la forme
        entière (`docs/PIEGES.md`).
        """
        return {**personnage.en_json(), "cases": self.cases(projet, personnage)}

    def cases(self, projet: str, personnage: Personnage) -> list[dict[str, Any]]:
        """Ce qui est fait et ce qui manque, pose par pose (US-119).

        **Rien de tout ceci n'est enregistré.** Une case est pleine parce qu'une
        image la porte, et non parce qu'une liste de cases pleines serait tenue
        quelque part : supprimer une image vide sa case toute seule, et il
        n'existe aucun état à remettre d'accord avec le disque.

        **Et elle porte l'asset entier**, pas un résumé. Une vignette a besoin
        de l'adresse de son image, et cette adresse a un seul endroit où elle
        s'écrit dans tout le produit (`interface/src/composants/Apercu.tsx`) :
        lui donner un objet à moitié aurait fait un second calcul d'adresse, à
        tenir d'accord avec le premier. Ce que la matrice montre est la même
        image que la grille, servie par la même route.
        """
        objet = self._exiger(projet)
        corps: dict[str, list[Asset]] = {}
        calques: dict[str, dict[str, list[Asset]]] = {}
        for asset in self._base.assets_du_personnage(personnage.identifiant):
            if not asset.pose:
                continue
            # **La pièce sépare les deux axes, et elle seule** (C3). Sans pièce,
            # l'image est un corps et remplit la case de sa pose ; avec, elle
            # remplit la case de sa colonne. Sans ce partage, un casque posé sur
            # six poses ferait paraître six corps de plus dans la colonne de
            # gauche, et la matrice dirait « fait » d'une pose qui n'a jamais eu
            # de corps.
            if asset.piece:
                calques.setdefault(asset.pose, {}).setdefault(
                    asset.piece, []
                ).append(asset)
            else:
                corps.setdefault(asset.pose, []).append(asset)

        return [
            {
                "pose": pose.identifiant,
                "demandees": pose.images,
                "images": [a.en_json() for a in corps.get(pose.identifiant, ())],
                # **Le second axe de la matrice** (US-140), pièce par pièce.
                # Rien de plus enregistré : c'est toujours l'image qui dit sa
                # case, et une image supprimée vide la sienne toute seule.
                "calques": {
                    piece: [a.en_json() for a in liste]
                    for piece, liste in calques.get(pose.identifiant, {}).items()
                },
                # **Le corps que cette pose enverrait en planche d'équipement**,
                # ou rien — et c'est ce « rien » qui rend une pose visiblement
                # inéligible (US-141). Le favori d'abord, sinon la plus récente :
                # la même règle qu'à la composition, écrite une fois et lue des
                # deux côtés, pour que l'écran montre exactement ce qui partira.
                "corps": _corps(corps.get(pose.identifiant, ())),
            }
            for pose in personnage.tenues(objet.plan)
        ]

    def viser(self, projet: str, personnage: str, pose: str) -> tuple[Personnage, Pose]:
        """La case qu'un appel va remplir — vérifiée **avant** qu'un centime parte.

        Deux refus, et ils portent leur raison : un personnage qui n'existe pas,
        et une pose que ce personnage-là ne tient pas. Le second n'est pas du
        zèle — l'écran n'arme que des cases visibles, mais un onglet resté ouvert
        pendant qu'on décochait la pose enverrait sinon une image dans une case
        que personne ne regarde plus.
        """
        vise = self.personnage(projet, personnage)
        tenues = vise.tenues(self._exiger(projet).plan)
        for p in tenues:
            if p.identifiant == pose:
                return vise, p
        raise ProductionRefusee(
            f"« {vise.nom} » ne tient pas la pose « {pose} »"
        )

    def sujet(
        self,
        projet: str,
        personnage: str,
        poses: Sequence[str] = (),
        piece: str | None = None,
    ) -> str:
        """Ce qu'une case demande au modèle — **écrit ici, lu des deux côtés**.

        Trois règles, et aucune n'est interchangeable avec une autre :

        - **Une case** : le signalement du personnage, puis le nom de
          l'attitude. C'est la promesse d'US-115 — la description part avec
          chaque image de ce personnage et ne se retape jamais.
        - **Un lot** : le signalement seul. Les attitudes partent case par case
          dans les consignes de planche, que le pliage replie côté serveur ; les
          écrire aussi dans le sujet les dirait deux fois, et le prompt
          enregistré ne dirait plus ce qui est parti.
        - **Une pièce** : sa description seule (C3). Le signalement du
          personnage n'a rien à faire là — le corps est **dans l'image** qui
          part, et le redécrire en mots inviterait le modèle à le redessiner,
          très exactement ce que la mesure du corps repeint sanctionne.

        **Dans le service depuis C5, et plus à l'écran.** La matrice armait ce
        texte elle-même ; l'agent arme les mêmes cases, et deux compositions à
        deux endroits auraient fini par demander deux choses différentes pour la
        même case — sans que rien ne le signale, puisque les deux auraient
        semblé raisonnables.

        **Ce n'est pas le prompt** : la bible du projet se replie en tête et les
        consignes de planche en queue, et cela n'appartient qu'à
        `ServiceGenerations.parties` (US-158). Ici on n'écrit que le sujet.
        """
        vise = self.personnage(projet, personnage)
        objet = self._exiger(projet)
        if piece:
            trouvee = next((p for p in objet.pieces if p.identifiant == piece), None)
            if trouvee is None:
                raise ProductionRefusee(f"aucune pièce « {piece} » dans ce projet")
            return trouvee.description.strip() or trouvee.nom
        voulues = [p for p in objet.plan if p.identifiant in set(poses)]
        if len(voulues) == 1:
            return ", ".join(
                mot for mot in (vise.description.strip(), voulues[0].nom) if mot
            )
        return vise.description.strip()

    def concept_arts(self, projet: str, personnage: str | None) -> tuple[str, ...]:
        """Les cartes qu'un personnage désigne (US-124).

        Elles partent **quelle que soit la famille du sujet**, à la différence
        des artworks officiels : un artwork inspire tout un univers et se filtre
        donc par famille, un concept art a été désigné pour *ce personnage-là* —
        l'auteur l'a choisi, l'application n'a rien à en retrancher.

        Un personnage disparu ne fait pas tomber l'appel : il ne désigne plus
        rien, c'est tout.
        """
        if not personnage:
            return ()
        try:
            return self.personnage(projet, personnage).concept_arts
        except (PersonnageInconnu, ProjetInconnu):
            return ()

    def ecartees(self, projet: str, personnage: str | None) -> dict[str, str]:
        """Ce qui ne doit plus partir, et **par quelle portée** (US-126).

        Deux portées se rangent sur le disque — le projet et le personnage —, et
        la troisième, la génération, ne s'écrit nulle part : elle vit dans
        l'onglet et part avec l'appel, comme la pile d'annulation de T8.

        **La plus étroite l'emporte** : c'est la règle affichée à l'écran, et
        elle est ici la seule qui compte, puisque la génération, quand elle a un
        avis, décide seule (voir `ServiceGenerations.preparer`).
        """
        par_portee = {
            identifiant: "projet"
            for identifiant in self._exiger(projet).references_ecartees
        }
        for identifiant in self.concept_arts_ecartees(projet, personnage):
            par_portee[identifiant] = "personnage"
        return par_portee

    def concept_arts_ecartees(self, projet: str, personnage: str | None) -> tuple[str, ...]:
        if not personnage:
            return ()
        try:
            return self.personnage(projet, personnage).references_ecartees
        except (PersonnageInconnu, ProjetInconnu):
            return ()

    def ecarter(
        self, projet: str, *, portee: str, references: Sequence[str], personnage: str | None
    ) -> dict[str, Any]:
        """Poser ce qui ne partira plus, à l'une des deux portées durables.

        **Rien ici ne touche à l'univers ni aux artworks officiels** — c'est un
        critère d'acceptation de la tranche, et il est vrai par construction :
        la liste vit sur le `Projet` à côté des teintes, jamais dans `Univers`,
        qui est défini comme « ce que le projet impose à ce qui rentre, et ce
        qu'il envoie avec ». Une carte décochée reste promue, garde sa famille,
        et continue de compter dans la palette.
        """
        retenues = tuple(dict.fromkeys(r for r in references if r))
        if portee == "projet":
            objet = self._exiger(projet)
            objet.references_ecartees = retenues
            self._bibliotheque.sauver_projet(objet)
            self._annoncer_ecartees(objet)
            return {"portee": portee, "ecartees": list(retenues)}
        if portee == "personnage":
            if not personnage:
                raise ProductionRefusee(
                    "écarter pour un personnage demande de dire lequel"
                )
            vise = self.personnage(projet, personnage)
            vise.references_ecartees = retenues
            self._sauver(vise)
            # **Et l'annonce « ce qui part a changé », comme pour le projet.**
            # Le message du personnage dit *qui il est* ; celui-ci dit que la
            # liste de ce qui partira n'est plus la même — deux faits, deux
            # lecteurs, et l'écran qui tient le panneau n'a pas à déduire l'un
            # de l'autre.
            self._diffusion.publier(
                "references",
                {
                    "projet": projet,
                    "personnage": vise.identifiant,
                    "ecartees": list(retenues),
                },
            )
            return {
                "portee": portee,
                "personnage": vise.identifiant,
                "ecartees": list(retenues),
            }
        raise ProductionRefusee(
            "une portée durable est « projet » ou « personnage » — "
            "celle d'une génération ne s'écrit pas, elle part avec l'appel"
        )

    def designer(
        self, asset: str, *, projet: str, personnage: str | None, pose: str | None
    ) -> Asset:
        """Cette image **est** le corps de cette case (US-122).

        C'est l'un des deux chemins qui remplissent une case, et le premier dans
        le temps : on écrit un sujet dans l'atelier, on génère, on obtient une
        image, et c'est celle-là qu'on désigne. Rien ici ne fabrique quoi que ce
        soit — **le corps naît dans l'atelier et nulle part ailleurs**, et cette
        méthode ne fait que dire où il va.

        Les deux vides ensemble retirent la désignation : l'image reste dans la
        bibliothèque, sa case redevient vide. Un seul des deux est un refus —
        une pose sans personnage ne désigne rien.
        """
        objet = self._assets.lire(asset)
        if objet is None:
            raise AssetInconnu(asset)

        # **Un calque est solidaire de sa pose** (`docs/PLAN.md`, C3). Un casque
        # vu de face n'est pas un casque vu de dos : il en faut un par pose, et
        # ce n'est pas une limite technique a lever, c'est une evidence de
        # dessin. Le produit ne propose donc nulle part de reposer un calque
        # ailleurs — et c'est **ici** que la promesse se tient, parce que c'est
        # le seul geste du produit qui change la case d'une image.
        if objet.piece:
            raise ProductionRefusee(
                "un calque est solidaire de sa pose — il en faut un par pose, "
                "et c'est le pliage qui en divise le prix"
            )

        if personnage is None and pose is None:
            objet.personnage = None
            objet.pose = None
            objet.personnage_supprime = False
        elif personnage is None or pose is None:
            raise ProductionRefusee(
                "une image se désigne par un personnage **et** une pose"
            )
        else:
            vise, visee = self.viser(projet, personnage, pose)
            objet.personnage = vise.identifiant
            objet.pose = visee.identifiant
            objet.personnage_supprime = False

        self._assets.sauver(objet)
        return objet

    # ── Ce que l'écran lit d'un coup ─────────────────────────────────────────

    def tableau_de_bord(self, projet: str) -> dict[str, Any]:
        """Le plan et les personnages d'un projet, **en un seul aller-retour**.

        Même raison que la toile de T8 : l'écran ne sait rien montrer de l'un
        sans l'autre — une colonne de cases n'existe que par le plan qui la
        nomme —, et deux appels rendraient possible l'instant où l'un est arrivé
        et l'autre non, c'est-à-dire un personnage sans ses lignes.

        **Les poses tenues ne sont pas dans la charge** : elles se déduisent du
        plan et de ce que le personnage écarte, et le plan est **là**, dans le
        même objet. Les envoyer aurait fait une seconde copie qui se périme au
        premier ajout de pose — un plan qui gagne une ligne n'annonce aucun
        personnage, puisque justement il n'en réécrit aucun.

        **Les cases, elles, y sont** — et pour la raison inverse : elles se
        déduisent des *assets*, que l'écran ne tient pas. Il n'en garde que la
        page de grille qu'il a demandée, filtrée sur autre chose ; les compter
        là-dessus dirait un chiffre faux dès la première image hors de vue.
        """
        objet = self._exiger(projet)
        return {
            "projet": objet.identifiant,
            "plan": [p.en_json() for p in objet.plan],
            "personnages": [
                self.en_charge(projet, un) for un in self.personnages(projet)
            ],
        }

    # ── Le dedans ────────────────────────────────────────────────────────────

    def _exiger(self, projet: str) -> Projet:
        objet = self._base.lire_projet(projet) if projet else None
        if objet is None:
            raise ProjetInconnu(
                projet, [p.identifiant for p in self._bibliotheque.projets()]
            )
        return objet

    @staticmethod
    def _exiger_pose(objet: Projet, pose: str) -> Pose:
        for p in objet.plan:
            if p.identifiant == pose:
                return p
        raise PoseInconnue(pose)

    def _annoncer_ecartees(self, objet: Projet) -> None:
        """Ce que le projet n'envoie plus, annoncé sous son propre genre.

        **Pas sur `univers`** : ce message-là fait redemander l'état *et* le
        catalogue depuis T4 (`docs/PIEGES.md`), et une case décochée n'a aucune
        raison de coûter deux appels réseau. Pas sur `plan` non plus — ce n'est
        pas le même sujet, et un lecteur du plan n'a rien à faire d'une
        référence.
        """
        self._diffusion.publier(
            "references",
            {
                "projet": objet.identifiant,
                "ecartees": list(objet.references_ecartees),
            },
        )

    def _sauver_projet(self, objet: Projet) -> None:
        """Le projet passe par sa bibliothèque, **seul écrivain d'un projet**.

        Puis l'annonce : ce qui est annoncé est donc toujours déjà sur le
        disque. Le plan a son propre genre d'événement plutôt qu'un champ de
        plus sur `univers` — un message qui gagne un champ gagne aussi des
        lecteurs qui ne le concernent pas, et `univers` fait redemander l'état
        *et* le catalogue depuis T4 (`docs/PIEGES.md`).
        """
        self._bibliotheque.sauver_projet(objet)
        self._diffusion.publier(
            "plan",
            {"projet": objet.identifiant, "plan": [p.en_json() for p in objet.plan]},
        )

    def _sauver(self, personnage: Personnage) -> None:
        """**Le seul endroit du dépôt qui écrive un personnage.**

        Écrire d'abord, annoncer ensuite — comme une carte, comme un asset.

        **Le fichier porte l'objet, l'annonce porte sa forme complète.** Les
        cases ne s'écrivent pas : elles se déduisent, et les ranger sur le disque
        en ferait une seconde vérité. Elles voyagent en revanche avec chaque
        annonce, parce que l'écran fond ce qu'il reçoit et qu'une charge amputée
        remplacerait un objet entier par un objet à trous.
        """
        self._fichiers.ecrire_personnage(
            personnage.projet, personnage.identifiant, personnage.en_json()
        )
        self._diffusion.publier(
            "personnage", self.en_charge(personnage.projet, personnage)
        )


def corps_retenu(images: Sequence[Asset]) -> Asset | None:
    """Le corps que le produit retiendrait pour cette pose.

    **Le favori d'abord, sinon la plus récente.** Un auteur qui a marqué favori
    la bonne image sur trois essais a déjà dit laquelle est le corps ; lui
    redemander à chaque planche serait redemander ce qu'il vient de répondre.

    Écrite ici et lue par `ServiceEquipement`, qui compose la planche : deux
    règles à deux endroits finiraient par désigner deux images différentes, et
    l'écran montrerait alors autre chose que ce qui part.
    """
    retenu: Asset | None = None
    for asset in images:
        if retenu is None or (asset.favori, asset.cree_le, asset.rang) > (
            retenu.favori,
            retenu.cree_le,
            retenu.rang,
        ):
            retenu = asset
    return retenu


def _corps(images: Sequence[Asset]) -> str | None:
    retenu = corps_retenu(images)
    return retenu.identifiant if retenu else None
