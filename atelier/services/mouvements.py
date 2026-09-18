# -*- coding: utf-8 -*-
"""La bibliothèque de mouvements — **celle de l'atelier sert de départ à chaque jeu**.

Arrivée en A6 (V3), avec une décision : *un mouvement appartient à l'atelier,
pas à un projet* — rangée par projet, une bibliothèque repartirait vide à chaque
nouveau jeu. Nuancée le 18 septembre 2026 à la demande de l'auteur : un style
d'attaque n'a pas sa place dans tous les jeux. Un jeu lit donc la bibliothèque
de l'atelier **tant qu'il n'y a rien changé**, et son premier changement l'y
copie (`Fichiers.lire_mouvements`). Rien ne repart vide.

**Le même contrat que la base d'étiquettes** (`ServiceEtiquettes`), et
délibérément : deux origines, une seule liste. Les **livrés** arrivent avec
l'atelier ; les **fabriqués** sont ce que l'auteur a nommé, dans n'importe quel
jeu. Le fichier fait foi sur ce qu'il porte, le catalogue complète — c'est ce
qui permet d'en livrer de nouveaux dans une version suivante **sans redonner
ceux qu'on avait masqués**.

**Ce service ne connaît ni projet, ni fournisseur, ni catalogue.** Il lit un
fichier à la racine des données et il en rend une liste ; ça se lit dans ses
imports, et c'est ce qui fait que tout A6 fonctionne réseau coupé et ne coûte
rien.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from atelier.depot import Fichiers
from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.mouvement import (
    CADENCE_DEFAUT,
    LIVRES,
    Mouvement,
    mouvements_depuis_json,
    pour_la_pose,
    repere,
    texte_anime,
)


class MouvementRefuse(ErreurAtelier):
    """Un mouvement n'est pas posable, et on dit pourquoi."""

    code = "mouvement_refuse"


class ServiceMouvements:
    def __init__(self, fichiers: Fichiers) -> None:
        self._fichiers = fichiers

    # ── Lire ─────────────────────────────────────────────────────────────────

    def tous(self, projet: str | None = None) -> tuple[Mouvement, ...]:
        """La bibliothèque entière — **les livrés d'abord, les fabriqués ensuite**.

        Un livré que le fichier connaît déjà garde ce que le fichier en dit : son
        nom s'il a été renommé, son texte s'il a été retouché, et le fait qu'il
        ait été masqué. Un livré que le fichier ne connaît pas est ajouté.

        **Les masqués ne sortent pas d'ici.** Un livré masqué est dans le fichier
        avec `masque`, uniquement pour qu'on ne le lui rende pas ; il n'a rien à
        faire dans une liste qu'on affiche. `masques()` sert à le remontrer.
        """
        return tuple(m for m in self._tous_y_compris_masques(projet) if not m.masque)

    def masques(self, projet: str | None = None) -> tuple[Mouvement, ...]:
        """Les livrés que l'auteur a masqués — **la seule liste où ils paraissent**.

        Elle existe pour une raison et une seule : sans elle, masquer serait
        irréversible, et un geste irréversible sur du vocabulaire livré n'a
        aucune raison d'être. On les remontre d'un clic.
        """
        return tuple(m for m in self._tous_y_compris_masques(projet) if m.masque)

    def lire(self, identifiant: str, projet: str | None = None) -> Mouvement | None:
        for mouvement in self._tous_y_compris_masques(projet):
            if mouvement.identifiant == identifiant:
                return mouvement
        return None

    def pour_la_pose(
        self, identifiant_pose: str, projet: str | None = None
    ) -> Mouvement | None:
        """Le mouvement d'une case du plan, **par l'identifiant et rien d'autre**."""
        return pour_la_pose(self.tous(projet), identifiant_pose)

    def texte_de_la_pose(
        self, identifiant_pose: str, repli: str, projet: str | None = None
    ) -> str:
        """Ce qui part pour animer cette case : le mouvement, sinon le repli."""
        return texte_anime(self.tous(projet), identifiant_pose, repli)

    # ── Écrire ───────────────────────────────────────────────────────────────

    def fabriquer(
        self,
        nom: str,
        texte: str,
        cadence: float | None = None,
        directions: tuple[str, ...] = (),
        projet: str | None = None,
    ) -> Mouvement:
        """Un nom français, le texte anglais qui part, et une cadence.

        **Les deux textes sont obligatoires**, et c'est la définition : un
        mouvement sans texte anglais ne fait rien partir, un mouvement sans nom
        ne se clique pas. C'est la paire qui est l'objet — même règle que pour
        une étiquette.
        """
        propre = " ".join(nom.split())
        anglais = " ".join(texte.split())
        if not propre:
            raise MouvementRefuse("un mouvement a besoin d'un nom à lire")
        if not anglais:
            raise MouvementRefuse(
                "un mouvement a besoin du texte anglais qui partira au modèle — "
                "c'est la moitié qui agit"
            )
        identifiant = repere(propre)
        if not identifiant:
            raise MouvementRefuse(
                f"« {propre} » ne donne aucun repère lisible — "
                "un mouvement se nomme avec des lettres ou des chiffres"
            )
        deja = list(self._tous_y_compris_masques(projet))
        if any(m.identifiant == identifiant for m in deja):
            raise MouvementRefuse(
                f"« {propre} » existe déjà — le renommer ou le remontrer suffit"
            )
        neuf = Mouvement(
            identifiant=identifiant,
            nom=propre,
            texte=anglais,
            # **Le défaut est nommé, jamais recopié** : un second chiffre écrit
            # ici finirait par diverger de celui du domaine.
            cadence=cadence if cadence and cadence > 0 else CADENCE_DEFAUT,
            directions=tuple(d for d in directions if d),
        )
        deja.append(neuf)
        self._ecrire(deja, projet)
        return neuf

    def regler(
        self,
        identifiant: str,
        *,
        nom: str | None = None,
        texte: str | None = None,
        cadence: float | None = None,
        directions: tuple[str, ...] | None = None,
        projet: str | None = None,
    ) -> Mouvement:
        """Renommer, retoucher le texte, changer la cadence ou les directions.

        **Un livré se règle comme un fabriqué**, et le fichier l'emporte alors
        sur le catalogue. Ce n'est pas un relâchement : le texte anglais d'un
        mouvement est du savoir-faire, il se corrige à l'usage, et un catalogue
        qui écraserait la correction à la lecture suivante rendrait l'atelier
        têtu. Le mouvement reste marqué *livré* — c'est son origine, pas son
        état.

        **Ce qu'un mouvement a déjà fait partir ne bouge pas.** Le texte est
        parti dans un appel au moment du clic ; le mouvement n'en est que
        l'origine. Jamais de cascade, ici comme ailleurs dans le produit.
        """
        tous = list(self._tous_y_compris_masques(projet))
        for rang, mouvement in enumerate(tous):
            if mouvement.identifiant != identifiant:
                continue
            propre = " ".join(nom.split()) if nom is not None else mouvement.nom
            anglais = " ".join(texte.split()) if texte is not None else mouvement.texte
            if not propre:
                raise MouvementRefuse("un mouvement a besoin d'un nom à lire")
            if not anglais:
                raise MouvementRefuse(
                    "un mouvement a besoin du texte anglais qui partira au modèle"
                )
            change = replace(
                mouvement,
                nom=propre,
                texte=anglais,
                cadence=cadence if cadence and cadence > 0 else mouvement.cadence,
                directions=(
                    tuple(d for d in directions if d)
                    if directions is not None
                    else mouvement.directions
                ),
            )
            tous[rang] = change
            self._ecrire(tous, projet)
            return change
        raise MouvementRefuse(f"aucun mouvement « {identifiant} »")

    def masquer(
        self, identifiant: str, projet: str | None = None
    ) -> tuple[Mouvement, ...]:
        """Retirer un mouvement de la liste.

        **Un livré laisse une pierre, un fabriqué s'en va.** La différence n'est
        pas un raffinement : le catalogue des livrés se relit à chaque lecture,
        donc effacer un livré le ferait revenir à la ligne suivante, et l'auteur
        masquerait le même mouvement indéfiniment. Un fabriqué n'a personne pour
        le remettre, donc rien à marquer.
        """
        tous = self._tous_y_compris_masques(projet)
        if not any(m.identifiant == identifiant for m in tous):
            raise MouvementRefuse(f"aucun mouvement « {identifiant} »")
        restants = [
            replace(m, masque=True) if m.identifiant == identifiant and m.livre else m
            for m in tous
            if m.identifiant != identifiant or m.livre
        ]
        self._ecrire(restants, projet)
        return tuple(m for m in restants if not m.masque)

    def montrer(
        self, identifiant: str, projet: str | None = None
    ) -> tuple[Mouvement, ...]:
        """Rendre à la liste un livré masqué. **La pierre part, le mouvement revient.**"""
        tous = self._tous_y_compris_masques(projet)
        if not any(m.identifiant == identifiant and m.masque for m in tous):
            raise MouvementRefuse(f"aucun mouvement masqué « {identifiant} »")
        rendus = [
            replace(m, masque=False) if m.identifiant == identifiant else m
            for m in tous
        ]
        self._ecrire(rendus, projet)
        return tuple(m for m in rendus if not m.masque)

    # ── Servir ───────────────────────────────────────────────────────────────

    def en_json(self, projet: str | None = None) -> dict[str, Any]:
        return {
            "mouvements": [m.en_json() for m in self.tous(projet)],
            "masques": [m.en_json() for m in self.masques(projet)],
            # **Le jeu a-t-il déjà ses propres mouvements**, ou lit-il encore la
            # bibliothèque de l'atelier ? L'écran le dit en une ligne.
            "propres_au_jeu": bool(projet)
            and self._fichiers.mouvements_du_jeu(projet).is_file(),
        }

    # ── Le disque ────────────────────────────────────────────────────────────

    def _tous_y_compris_masques(
        self, projet: str | None = None
    ) -> tuple[Mouvement, ...]:
        """Le fichier d'abord, le catalogue en complément — **jamais l'inverse**.

        L'ordre compte : c'est lui qui fait qu'un livré renommé garde son nom, et
        qu'un livré masqué ne revienne pas. Les neufs du catalogue passent devant
        dans la liste rendue parce qu'ils sont l'ossature ; les fabriqués suivent
        dans l'ordre où l'auteur les a nommés, qui est celui qu'il reconnaît.
        """
        du_fichier = mouvements_depuis_json(self._fichiers.lire_mouvements(projet))
        connus = {m.identifiant for m in du_fichier}
        neufs = tuple(m for m in LIVRES if m.identifiant not in connus)
        return neufs + du_fichier

    def _ecrire(self, mouvements: list[Mouvement], projet: str | None = None) -> None:
        """Écrire la base — **et jamais perdre une pierre au passage**.

        Les appelants travaillent sur une liste qui peut ne pas porter les
        masqués : écrire tel quel les ressusciterait à la lecture suivante,
        puisque le catalogue complète ce que le fichier ne connaît pas. Ils sont
        donc repris du disque et ajoutés en queue, quel que soit le geste qui a
        mené ici.
        """
        rendus = {m.identifiant for m in mouvements}
        pierres = [
            m
            for m in mouvements_depuis_json(self._fichiers.lire_mouvements(projet))
            if m.masque and m.identifiant not in rendus
        ]
        try:
            self._fichiers.ecrire_mouvements(
                [m.en_json() for m in list(mouvements) + pierres], projet
            )
        except ValueError as erreur:
            raise MouvementRefuse(str(erreur)) from erreur
