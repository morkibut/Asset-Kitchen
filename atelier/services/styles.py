# -*- coding: utf-8 -*-
"""La bibliothèque de styles de combat — **celle de l'atelier sert de départ à chaque jeu**.

Arrivée en `SC1` (18 septembre 2026), sur le même contrat que la
bibliothèque de mouvements (`ServiceMouvements`) : deux origines, une seule
liste. Les **livrés** arrivent avec l'atelier — un catalogue de dix styles
d'attaque soignés — ; les **fabriqués** sont ce que l'auteur a nommé, dans
n'importe quel jeu. Un jeu lit la bibliothèque de l'atelier tant qu'il n'a
rien changé, et son premier changement l'y copie (`Fichiers.lire_styles`).

**Ce service ne connaît ni projet, ni fournisseur, ni catalogue.** Il lit
un fichier à la racine des données (ou celui du jeu) et il en rend une
liste ; ça marche réseau coupé et ça ne coûte rien.

**Depuis `SC2`, il dit aussi qui se bat dans quel style** : le style choisi
d'un personnage, celui qu'une pièce déclare, et la résolution *choisi →
pièce portée en calque → aucun*. Ce qu'il lui faut savoir des pièces portées
lui est passé en fonctions par `Atelier` — il n'importe toujours ni la
production ni l'équipement.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Callable, Iterable, Literal, Sequence

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.style import LIVRES, Style, repere, styles_depuis_json


class StyleRefuse(ErreurAtelier):
    """Un style n'est pas posable, et on dit pourquoi."""

    code = "style_refuse"


# **D'où vient le style d'un personnage** (`SC2`) : l'écran l'écrit à côté du
# nom — « choisi », « hérité du bâton », « aucun » — et ne le recalcule pas.
Origine = Literal["choisi", "piece", "aucun"]


class ServiceStyles:
    def __init__(
        self,
        fichiers: Fichiers,
        *,
        garde_robe: Callable[[str], Sequence[str]] | None = None,
        pieces_portees: Callable[[str, str], Iterable[str]] | None = None,
    ) -> None:
        """`garde_robe` et `pieces_portees` arrivent en `SC2`, **en fonctions et non en services**.

        Le service des styles ne connaît toujours ni la production ni
        l'équipement : `Atelier` lui passe deux questions déjà posées ailleurs
        — *dans quel ordre ce jeu range-t-il ses pièces* et *quelles pièces ce
        personnage porte-t-il en calque sur ses poses* —, et c'est ce qui évite
        tout cycle d'import. Sans elles (un essai qui monte le service seul),
        un personnage ne porte rien : seul son choix compte.
        """
        self._fichiers = fichiers
        self._garde_robe = garde_robe
        self._pieces_portees = pieces_portees

    # ── Lire ─────────────────────────────────────────────────────────────────

    def tous(self, projet: str | None = None) -> tuple[Style, ...]:
        """La bibliothèque entière — **les livrés d'abord, les fabriqués ensuite**.

        Même règle que `ServiceMouvements.tous` : un livré que le fichier
        connaît déjà garde ce que le fichier en dit, un livré que le fichier
        ne connaît pas est ajouté, et les masqués ne sortent pas d'ici.
        """
        return tuple(s for s in self._tous_y_compris_masques(projet) if not s.masque)

    def masques(self, projet: str | None = None) -> tuple[Style, ...]:
        """Les livrés que l'auteur a masqués — **la seule liste où ils paraissent**."""
        return tuple(s for s in self._tous_y_compris_masques(projet) if s.masque)

    def lire(self, identifiant: str, projet: str | None = None) -> Style | None:
        for style in self._tous_y_compris_masques(projet):
            if style.identifiant == identifiant:
                return style
        return None

    # ── Écrire ───────────────────────────────────────────────────────────────

    def fabriquer(
        self,
        nom: str,
        tient: str = "",
        textes: dict[str, str] | None = None,
        projet: str | None = None,
    ) -> Style:
        """Un nom français, ce qu'il tient en main, et au moins un texte.

        **Le nom et au moins un texte sont obligatoires** — même définition
        que pour un mouvement : un style sans nom ne se clique pas, un style
        sans aucun texte ne fait jamais rien partir de plus que le
        mouvement seul, donc n'est pas un style.
        """
        propre = " ".join(nom.split())
        if not propre:
            raise StyleRefuse("un style a besoin d'un nom à lire")
        propres = _textes_propres(textes)
        if not propres:
            raise StyleRefuse(
                "un style a besoin d'au moins un texte de mouvement — "
                "c'est ce qui le distingue du mouvement seul"
            )
        identifiant = repere(propre)
        if not identifiant:
            raise StyleRefuse(
                f"« {propre} » ne donne aucun repère lisible — "
                "un style se nomme avec des lettres ou des chiffres"
            )
        deja = list(self._tous_y_compris_masques(projet))
        if any(s.identifiant == identifiant for s in deja):
            raise StyleRefuse(
                f"« {propre} » existe déjà — le renommer ou le remontrer suffit"
            )
        neuf = Style(
            identifiant=identifiant,
            nom=propre,
            tient=" ".join(tient.split()) if tient else "",
            textes=tuple(propres.items()),
        )
        deja.append(neuf)
        self._ecrire(deja, projet)
        return neuf

    def regler(
        self,
        identifiant: str,
        *,
        nom: str | None = None,
        tient: str | None = None,
        textes: dict[str, str] | None = None,
        projet: str | None = None,
    ) -> Style:
        """Renommer, changer ce qu'il tient, ou fusionner des textes de mouvement.

        **`textes` se fusionne dans l'existant, il ne le remplace pas** :
        c'est ce qui permet de corriger le texte d'un seul mouvement sans
        retaper les autres. **Un texte vide retire ce mouvement du style** —
        la façon de dire « ce style ne dit plus rien pour ce geste-là »,
        sans supprimer le style lui-même.

        **Un livré se règle comme un fabriqué**, et le fichier l'emporte
        alors sur le catalogue — même raison qu'un mouvement : un texte
        d'attaque est du savoir-faire, il se corrige à l'usage.
        """
        tous = list(self._tous_y_compris_masques(projet))
        for rang, style in enumerate(tous):
            if style.identifiant != identifiant:
                continue
            propre = " ".join(nom.split()) if nom is not None else style.nom
            if not propre:
                raise StyleRefuse("un style a besoin d'un nom à lire")
            porte = " ".join(tient.split()) if tient is not None else style.tient
            fusion = dict(style.textes)
            if textes is not None:
                for mouvement, texte in textes.items():
                    mouvement = " ".join(str(mouvement).split())
                    if not mouvement:
                        continue
                    propre_texte = " ".join(str(texte).split()) if texte else ""
                    if propre_texte:
                        fusion[mouvement] = propre_texte
                    else:
                        fusion.pop(mouvement, None)
            if not fusion:
                raise StyleRefuse(
                    "un style a besoin d'au moins un texte de mouvement — "
                    "les retirer tous reviendrait à ne plus rien dire"
                )
            change = replace(
                style,
                nom=propre,
                tient=porte,
                textes=tuple(fusion.items()),
            )
            tous[rang] = change
            self._ecrire(tous, projet)
            return change
        raise StyleRefuse(f"aucun style « {identifiant} »")

    def masquer(self, identifiant: str, projet: str | None = None) -> tuple[Style, ...]:
        """Retirer un style de la liste. **Un livré laisse une pierre, un fabriqué s'en va.**"""
        tous = self._tous_y_compris_masques(projet)
        if not any(s.identifiant == identifiant for s in tous):
            raise StyleRefuse(f"aucun style « {identifiant} »")
        restants = [
            replace(s, masque=True) if s.identifiant == identifiant and s.livre else s
            for s in tous
            if s.identifiant != identifiant or s.livre
        ]
        self._ecrire(restants, projet)
        return tuple(s for s in restants if not s.masque)

    def montrer(self, identifiant: str, projet: str | None = None) -> tuple[Style, ...]:
        """Rendre à la liste un livré masqué. **La pierre part, le style revient.**"""
        tous = self._tous_y_compris_masques(projet)
        if not any(s.identifiant == identifiant and s.masque for s in tous):
            raise StyleRefuse(f"aucun style masqué « {identifiant} »")
        rendus = [
            replace(s, masque=False) if s.identifiant == identifiant else s
            for s in tous
        ]
        self._ecrire(rendus, projet)
        return tuple(s for s in rendus if not s.masque)

    # ── Le style d'un personnage, et celui d'une pièce (SC2) ─────────────────
    #
    # **Rangés dans `styles-choisis.json` du jeu, pas sur le personnage ni sur
    # la pièce** : c'est la décision de la tranche, prise pour que le choix
    # d'un style ne passe jamais par l'écrivain de la production. Un
    # identifiant de personnage ou de pièce n'est unique que par jeu — le
    # fichier l'est aussi.

    def choisir_pour_le_personnage(
        self, projet: str, personnage: str, styles: Sequence[str] | str | None
    ) -> tuple[Style, ...]:
        """Poser la liste des styles d'un personnage — **vide, elle les retire tous**.

        Demandé par l'auteur le 22 septembre 2026 : un personnage peut se
        battre au fusil *et* au couteau. Cette liste ne décide plus de ce qui
        part : elle dit **ce qu'on propose** au moment d'animer, où rien n'est
        coché d'avance (`texte_clip.composer`).

        **Le personnage n'est pas cherché ici** : ce service ne connaît pas la
        production. Un identifiant vide est refusé — il ne désigne personne et
        ferait une clé fantôme dans le fichier.
        """
        jeu = self._jeu(projet)
        propre = (personnage or "").strip()
        if not propre:
            raise StyleRefuse(
                "un style se pose sur un personnage nommé — l'identifiant est vide"
            )
        voulus = [styles] if isinstance(styles, str) else list(styles or ())
        retenus: list[Style] = []
        for voulu in dict.fromkeys(" ".join(str(s).split()) for s in voulus):
            if voulu:
                retenus.append(self._visible(voulu, jeu))
        choix = self._fichiers.lire_styles_choisis(jeu)
        if retenus:
            choix["personnages"][propre] = [s.identifiant for s in retenus]
        else:
            choix["personnages"].pop(propre, None)
        try:
            self._fichiers.ecrire_styles_choisis(jeu, choix)
        except ValueError as erreur:
            raise StyleRefuse(str(erreur)) from erreur
        return tuple(retenus)

    def choisir_pour_la_piece(
        self, projet: str, piece: str, style: str | None
    ) -> Style | None:
        """Poser (ou retirer) le style qu'une pièce d'équipement déclare.

        **La pièce doit exister dans la garde-robe du jeu** quand l'atelier a
        dit comment la lire : un style accroché à une pièce qui n'existe pas
        ne serait jamais hérité par personne, et l'erreur ne se verrait pas.
        """
        self._jeu(projet)
        propre = (piece or "").strip()
        if propre and self._garde_robe is not None and style:
            if propre not in self._garde_robe(projet):
                raise StyleRefuse(f"aucune pièce « {propre} » dans ce jeu")
        return self._choisir(projet, "pieces", propre, style)

    def styles_du_personnage(
        self, projet: str, personnage: str
    ) -> tuple[tuple[Style, Origine, str | None], ...]:
        """Les styles de ce personnage, **et d'où chacun vient** : `(style, origine, pièce)`.

        **Ce sont des propositions, pas un choix** (22 septembre 2026). Avant,
        le premier style résolu partait d'office dans chaque clip — le fusil
        de Mara jusque dans son repos, sans moyen de le décocher. Désormais
        rien ne part sans être coché au moment d'animer ; cette liste dit
        seulement ce qu'on coche d'un clic. Dans cet ordre, sans doublon :

        1. **choisi** — les styles posés sur le personnage, dans leur ordre ;
        2. **pièce** — puis ceux que déclarent les pièces qu'il porte *en
           calque sur ses poses*, dans l'ordre de la garde-robe du jeu :
           emplacements par rang, puis pièces dans l'ordre où elles ont été
           nommées ; une pièce portée mais absente de la garde-robe vient
           après, par identifiant. Un ordre stable, pour que la liste ne
           saute pas d'un affichage à l'autre.

        **Rien n'est deviné d'après un nom** : une pièce appelée « bâton » qui
        ne déclare pas de style ne donne pas le style bâton. Un style masqué
        depuis ne compte plus.
        """
        choix = self._fichiers.lire_styles_choisis(self._jeu(projet))
        visibles = {s.identifiant: s for s in self.tous(projet)}
        rendus: list[tuple[Style, Origine, str | None]] = []
        vus: set[str] = set()
        for identifiant in choix["personnages"].get(personnage, ()):
            style = visibles.get(identifiant)
            if style is not None and identifiant not in vus:
                vus.add(identifiant)
                rendus.append((style, "choisi", None))
        declares = choix["pieces"]
        if declares and self._pieces_portees is not None:
            portees = set(self._pieces_portees(projet, personnage))
            for piece in self._dans_l_ordre(projet, portees):
                style = visibles.get(declares.get(piece, ""))
                if style is not None and style.identifiant not in vus:
                    vus.add(style.identifiant)
                    rendus.append((style, "piece", piece))
        return tuple(rendus)

    def style_pour_l_envoi(self, projet: str | None, identifiant: str | None) -> Style | None:
        """Le style **coché** pour un envoi, ou `None` — jamais un style deviné.

        N'importe quel style visible du jeu se coche : ceux du personnage sont
        proposés d'abord à l'écran, mais l'agent peut en nommer un autre. Un
        identifiant inconnu ou masqué est refusé plutôt qu'ignoré — un clip
        payé sans le style qu'on croyait avoir coché serait perdu.
        """
        voulu = (identifiant or "").strip()
        if not voulu:
            return None
        return self._visible(voulu, projet)

    def _visible(self, identifiant: str, projet: str | None) -> Style:
        style = self.lire(identifiant, projet)
        if style is None:
            raise StyleRefuse(f"aucun style « {identifiant} » dans ce jeu")
        if style.masque:
            raise StyleRefuse(
                f"« {style.nom} » est masqué dans ce jeu — le remontrer d'abord"
            )
        return style

    def choix_en_json(self, projet: str) -> dict[str, dict[str, str]]:
        """Les choix bruts du jeu, tels que le fichier les tient."""
        return self._fichiers.lire_styles_choisis(self._jeu(projet))

    def _choisir(
        self, projet: str, cle: str, identifiant: str, style: str | None
    ) -> Style | None:
        jeu = self._jeu(projet)
        propre = (identifiant or "").strip()
        if not propre:
            raise StyleRefuse(
                "un style se pose sur un personnage ou une pièce nommés — "
                "l'identifiant est vide"
            )
        voulu = (style or "").strip()
        retenu: Style | None = None
        if voulu:
            retenu = self.lire(voulu, jeu)
            if retenu is None:
                raise StyleRefuse(f"aucun style « {voulu} » dans ce jeu")
            if retenu.masque:
                raise StyleRefuse(
                    f"« {retenu.nom} » est masqué dans ce jeu — le remontrer d'abord"
                )
        choix = self._fichiers.lire_styles_choisis(jeu)
        if retenu is None:
            choix[cle].pop(propre, None)
        else:
            choix[cle][propre] = retenu.identifiant
        try:
            self._fichiers.ecrire_styles_choisis(jeu, choix)
        except ValueError as erreur:
            raise StyleRefuse(str(erreur)) from erreur
        return retenu

    def _dans_l_ordre(self, projet: str, portees: set[str]) -> list[str]:
        rang = {
            piece: i
            for i, piece in enumerate(
                self._garde_robe(projet) if self._garde_robe is not None else ()
            )
        }
        return sorted(portees, key=lambda p: (p not in rang, rang.get(p, 0), p))

    def _jeu(self, projet: str | None) -> str:
        """Un choix appartient toujours à un jeu — **pas de bibliothèque de départ ici**.

        Les styles eux-mêmes ont une bibliothèque racine qui sert de départ ;
        un choix, non : « Champy se bat au bâton » n'a de sens que dans le jeu
        où Champy existe. L'identifiant passe la même garde que le fichier des
        styles, traduite en refus lisible plutôt qu'en erreur de disque.
        """
        if not projet:
            raise StyleRefuse("un style se choisit dans un jeu — aucun jeu nommé")
        try:
            self._fichiers.styles_choisis_du_jeu(projet)
        except ValueError as erreur:
            raise StyleRefuse(str(erreur)) from erreur
        return projet

    # ── Servir ───────────────────────────────────────────────────────────────

    def en_json(self, projet: str | None = None) -> dict[str, Any]:
        return {
            "styles": [s.en_json() for s in self.tous(projet)],
            "masques": [s.en_json() for s in self.masques(projet)],
            "propres_au_jeu": bool(projet)
            and self._fichiers.styles_du_jeu(projet).is_file(),
        }

    # ── Le disque ────────────────────────────────────────────────────────────

    def _tous_y_compris_masques(self, projet: str | None = None) -> tuple[Style, ...]:
        """Le fichier d'abord, le catalogue en complément — **jamais l'inverse**.

        Même ordre que `ServiceMouvements` et pour la même raison : c'est
        lui qui fait qu'un livré renommé garde son nom, et qu'un livré
        masqué ne revienne pas.
        """
        du_fichier = styles_depuis_json(self._fichiers.lire_styles(projet))
        connus = {s.identifiant for s in du_fichier}
        neufs = tuple(s for s in LIVRES if s.identifiant not in connus)
        return neufs + du_fichier

    def _ecrire(self, styles: list[Style], projet: str | None = None) -> None:
        """Écrire la base — **et jamais perdre une pierre au passage**."""
        rendus = {s.identifiant for s in styles}
        pierres = [
            s
            for s in styles_depuis_json(self._fichiers.lire_styles(projet))
            if s.masque and s.identifiant not in rendus
        ]
        try:
            self._fichiers.ecrire_styles(
                [s.en_json() for s in list(styles) + pierres], projet
            )
        except ValueError as erreur:
            raise StyleRefuse(str(erreur)) from erreur


def _textes_propres(textes: dict[str, str] | None) -> dict[str, str]:
    if not textes:
        return {}
    propres: dict[str, str] = {}
    for mouvement, texte in textes.items():
        mouvement = " ".join(str(mouvement).split())
        texte = " ".join(str(texte).split()) if texte else ""
        if mouvement and texte:
            propres[mouvement] = texte
    return propres
