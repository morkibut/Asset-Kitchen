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
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.style import LIVRES, Style, repere, styles_depuis_json


class StyleRefuse(ErreurAtelier):
    """Un style n'est pas posable, et on dit pourquoi."""

    code = "style_refuse"


class ServiceStyles:
    def __init__(self, fichiers: Fichiers) -> None:
        self._fichiers = fichiers

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
