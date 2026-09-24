# -*- coding: utf-8 -*-
"""TU5 : les matières générées sur la machine, pour un jeu de tuiles.

L'onglet « Générer » du tiroir des matières (`docs/PLAN-tuiles.md`, § TU5).
Un seul style, toujours le même — `klein9b-tiles-raccordable` (ML6) —, jamais
choisi à l'écran : la sorte « matière » de tuile n'a qu'un chemin possible,
raccordable ou rien. Aucun fournisseur payant n'est joignable par ce service :
il ne connaît que la file locale (`atelier.file_locale`) et le catalogue des
styles ComfyUI (`atelier.styles_locaux`).
"""

from __future__ import annotations

import secrets
import time
from typing import Any

from atelier.domaine import texte_matiere
from atelier.domaine.erreurs import ModeleInconnu
from atelier.domaine.generation import AGENT, AUTEUR, Generation, Reinjection
from atelier.domaine.tuiles import TuilesRefusees
from atelier.domaine.workflow import WorkflowRefuse
from atelier.fournisseur.catalogue_styles import FAMILLES, style as style_de

# **Le seul style que ce chemin peut appeler** (décision 6 du plan : tout est
# gratuit en argent, et le raccord garanti par ML6 est ce qui fait qu'une
# matière se découpe en pièces sans faute). Un identifiant en dur, à dessein :
# proposer un choix de style ici reviendrait à proposer un chemin non
# raccordable, ce qu'aucun écran de tuiles ne doit pouvoir faire.
STYLE = "klein9b-tiles-raccordable"

TIRAGES_MIN, TIRAGES_MAX = 1, 8


def _entier(v: Any, nom: str, minimum: int, maximum: int) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or not minimum <= v <= maximum:
        raise TuilesRefusees(f"{nom} est un entier de {minimum} à {maximum}.")
    return v


class ServiceMatieres:
    def __init__(self, atelier) -> None:
        self.a = atelier
        # TU10 : une demande de matières faite par l'agent est un travail durable,
        # borné par le cadre de l'agent comme ses images locales (RP2).
        atelier.travaux.inscrire_executant("matieres", self._executer_agent)

    # ── L'aperçu — gratuit, sans appel (route de prévisualisation séparée) ──

    def apercu(self, pierre: str, motif: str, cadrage: str, *, reference: bool = False) -> dict[str, Any]:
        """Le texte exact qui partirait, sans toucher à ComfyUI ni à la file
        locale : c'est la même composition que `generer`, juste sans
        soumission — l'invariant qui rend « Voir le texte envoyé » vrai.

        `reference` ne change **pas** le texte : une image jointe n'ajoute pas
        un mot (TU13). Elle change la taille — 512 au lieu de 256 —, et l'écran
        doit pouvoir dire qu'une image part en plus du texte, sinon « voir le
        texte envoyé » laisserait croire que le texte est tout ce qui part."""
        entree = style_de(STYLE)
        texte = texte_matiere.texte_envoi(
            pierre, motif, cadrage,
            declencheur=entree["declencheur"], suffixe=entree.get("suffixe", ""),
        )
        return {
            "texte": texte,
            "negatif": texte_matiere.NEGATIF,
            "taille": texte_matiere.taille_par_defaut(reference or None),
            "reference": bool(reference),
            "cadrages": list(texte_matiere.LISTE_CADRAGES),
        }

    # ── La disponibilité — le diagnostic existant des styles locaux (ML2/ML6) ─

    async def disponibilite(self) -> dict[str, Any]:
        """Ce qui manque pour générer une matière, et où le poser — jamais une
        supposition : c'est le même diagnostic que l'écran des styles locaux
        (`GET /api/workflow-profiles/styles`), filtré sur le seul style que ce
        chemin appelle."""
        try:
            styles = await self.a.styles_locaux.lister()
        except WorkflowRefuse as refus:
            # ComfyUI éteint est justement « ce qui manque » : l'écran des
            # tuiles le dit à sa place, au lieu d'un « n'a pas pu être vérifiée ».
            return {"disponible": False, "manque": [str(refus)], "modele": None,
                    "reference_possible": False}
        ligne = next((s for s in styles if s["identifiant"] == STYLE), None)
        if ligne is None:  # pragma: no cover — le style est déclaré en dur au catalogue
            return {"disponible": False, "manque": [f"Style inconnu : {STYLE}."], "modele": None,
                    "reference_possible": False}
        return {"disponible": ligne["pret"], "manque": list(ligne["manque"]), "modele": ligne["modele"],
                "reference_possible": self._accepte_une_reference(ligne["modele"], ligne)}

    def _accepte_une_reference(self, modele: str | None, ligne: dict[str, Any] | None = None) -> bool:
        """Le style peut-il porter **une** image de référence (TU13) ?

        Deux sources, dans cet ordre, et jamais une supposition :
        1. le profil réellement construit, quand le modèle est au catalogue
           (`references_max`, déduit de ses variantes) — c'est la réponse sûre ;
        2. la famille du style sinon (`reference` : « sujet » pour FLUX.2
           Klein), parce qu'un style pas encore installé, ou un catalogue pas
           encore rafraîchi, n'a pas de profil à interroger — et répondre
           « non » ferait disparaître le bouton pour une raison fausse.
        """
        if modele is not None:
            try:
                return self.a.catalogue.modele(modele).references_max >= 1
            except ModeleInconnu:
                pass
        if ligne is None:
            ligne = {"reference": FAMILLES[style_de(STYLE)["famille"]].get("reference")}
        return bool(ligne.get("reference"))

    async def _resoudre_modele(self) -> str:
        """L'identifiant de catalogue du style installé — installe et
        rafraîchit le catalogue au besoin, jamais ComfyUI lui-même (l'atelier
        ne modifie jamais son installation)."""
        dispo = await self.disponibilite()
        if not dispo["disponible"]:
            raise TuilesRefusees(
                " · ".join(dispo["manque"]) or "Le style des matières raccordables n'est pas prêt."
            )
        if dispo["modele"] is None:
            installe = await self.a.styles_locaux.installer(STYLE)
            await self.a.catalogue.rafraichir()
            return installe["modele"]
        try:
            self.a.catalogue.modele(dispo["modele"])
        except ModeleInconnu:
            await self.a.catalogue.rafraichir()
        return dispo["modele"]

    def _reference_jointe(self, modele: str, reference: str | None) -> tuple[Reinjection, ...]:
        """L'image jointe, en identifiant d'asset — jamais en octets (TU13).

        **Une seule, jamais trois.** Le graphe en accepte trois (les variantes
        de la famille `klein`) ; une matière n'a qu'une intention, et trois
        images dans une matière ne donnent rien à juger. La limite est donc
        posée ici, au service, et non au graphe — celui-ci reste celui de
        sc-clone, intouché.
        """
        if not reference:
            return ()
        if not isinstance(reference, str):
            raise TuilesRefusees("L'image de référence est l'identifiant d'une image de la bibliothèque.")
        if not self._accepte_une_reference(modele):
            raise TuilesRefusees(
                "Le style installé ne sait pas porter d'image de référence. "
                "Génère sans image, ou réinstalle le style des matières raccordables."
            )
        return (Reinjection(asset=reference),)

    # ── Générer — N tirages, N travaux dans la file locale ──────────────────

    async def generer(
        self,
        projet: str,
        *,
        pierre: str,
        motif: str,
        cadrage: str,
        tirages: int = 1,
        graine: int | None = None,
        reference: str | None = None,
        provenance: str = AUTEUR,
    ) -> list[Generation]:
        """`tirages` générations indépendantes, une graine libre chacune —
        jamais une graine commune (T26 : elle nuit à la teinte sans aider la
        parenté). Chacune passe par la file locale existante (suivi et
        annulation : `GET /api/local-queue`, déjà branchée sur tout calcul
        local de l'atelier) ; aucune n'appelle un fournisseur payant, et le
        modèle appelé porte toujours `locale=True` (vérifié par
        `tests/test_tu5_matieres.py`)."""
        _entier(tirages, "Le nombre de tirages", TIRAGES_MIN, TIRAGES_MAX)
        modele = await self._resoudre_modele()
        reinjectes = self._reference_jointe(modele, reference)
        entree = style_de(STYLE)
        texte = texte_matiere.texte_envoi(
            pierre, motif, cadrage,
            declencheur=entree["declencheur"], suffixe=entree.get("suffixe", ""),
        )
        # 512 px avec une image jointe, 256 sans : le latent part alors de la taille
        # de travail de la variante, et non d'une vignette agrandie (T29).
        taille = str(texte_matiere.taille_par_defaut(reference))
        depart = graine if graine is not None else secrets.randbelow(texte_matiere.GRAINE_MAX + 1)
        graines = texte_matiere.graines_pour_tirages(depart, tirages, 1)
        generations = []
        for g in graines:
            generation = await self.a.generations.soumettre_matiere(
                modele, texte,
                prompt_negatif=texte_matiere.NEGATIF,
                resolution=taille,
                proportions="1:1",
                projet=projet,
                provenance=provenance,
                graine=g,
                references=reinjectes,
                filiation={
                    "matiere": {
                        "pierre": pierre, "motif": motif, "cadrage": cadrage,
                        "style": STYLE, "graine": g,
                        **({"reference": reference} if reference else {}),
                    }
                },
            )
            generations.append(generation)
        return generations

    # ── L'agent (TU10) — le même tirage, dans un travail durable borné par son cadre ──

    async def preparer_pour_agent(
        self, projet: str, *, pierre: str, motif: str, cadrage: str, tirages: int = 1,
        graine: int | None = None, reference: str | None = None, cle: str | None = None,
    ) -> dict[str, Any]:
        """Un travail de nature « matieres », au nom de l'agent, **pas encore lancé**.

        C'est le mécanisme de RP2 pour toute image locale de l'agent
        (`ServiceTravauxWorkflow.preparer`) : les identifiants des générations
        sont écrits avant tout départ, `ServiceTravaux.demarrer` relit le cadre de
        l'agent (calcul local permis, méthodes permises, plafond d'appels) avant de
        lancer, et le crochet `avant_soumission` du fournisseur ComfyUI le relit
        encore quand la carte graphique prend son tour. Sans ce travail, ce
        crochet refuse toute image locale de l'agent."""
        from atelier.services.travaux import _hash, _json, _verrou

        _entier(tirages, "Le nombre de tirages", TIRAGES_MIN, TIRAGES_MAX)
        if graine is not None:
            _entier(graine, "La graine", 0, texte_matiere.GRAINE_MAX)
        entree = style_de(STYLE)
        texte = texte_matiere.texte_envoi(pierre, motif, cadrage, declencheur=entree["declencheur"], suffixe=entree.get("suffixe", ""))
        modele = await self._resoudre_modele()
        # L'image jointe est validée **avant** d'écrire le travail : un travail préparé
        # qui refuserait au démarrage aurait déjà consommé une clé d'idempotence.
        self._reference_jointe(modele, reference)
        cle = cle if isinstance(cle, str) and cle.strip() else secrets.token_hex(16)
        d = {"cle": cle, "pierre": pierre, "motif": motif, "cadrage": cadrage, "tirages": tirages, "graine": graine,
             "reference": reference, "livrer_provisoire": False}
        empreinte = _hash(_json({"demande": d, "acteur": AGENT}))
        identifiant = _hash((projet + "\0" + "matieres\0" + cle).encode())[:32]
        travaux = self.a.travaux
        dossier = travaux._dossier(projet, identifiant)
        with _verrou(dossier / ".travail"):
            avant = travaux._lire(dossier / "travail.json")
            if avant:
                if avant["empreinte"] != empreinte:
                    raise TuilesRefusees("Cette clé désigne déjà une autre demande de matières : choisissez une nouvelle clé.")
                return travaux.lire(projet, identifiant)
            depart = graine if graine is not None else secrets.randbelow(texte_matiere.GRAINE_MAX + 1)
            graines = texte_matiere.graines_pour_tirages(depart, tirages, 1)
            travail = {
                "nature": "matieres", "identifiant": identifiant, "cle": cle, "projet": projet, "acteur": AGENT,
                "empreinte": empreinte, "demande": d, "cree_le": time.time(), "etat": "prepare", "etape": "relecture",
                "generation_image": None, "clip": None, "reference_asset": None, "bandes": [], "livraison": None,
                "generations_images": [f"{identifiant}-matiere-{rang}" for rang in range(tirages)], "graines": graines,
                "texte": texte, "negatif": texte_matiere.NEGATIF, "modele": modele,
                "appels_engages": 0, "reserve": None, "demarrage_recu": False, "references": [], "assets": [],
                "annonce": {"appels": tirages, "reservation_usd": 0.0, "image_usd": 0.0,
                            "methodes": [{"nature": "image", "modele": modele, "locale": True, "payante": False}]},
            }
            travaux._garder(travail)
        return travaux.lire(projet, identifiant)

    async def _executer_agent(self, projet: str, identifiant: str, reprise: bool) -> None:
        """Soumet les tirages qui ne l'ont pas encore été, attend leur retour, et range
        le travail. Une reprise ne resoumet jamais une génération déjà écrite."""
        from atelier.domaine.asset import identifiant_de
        from atelier.services.travaux import _verrou

        travaux = self.a.travaux
        try:
            with _verrou(travaux._dossier(projet, identifiant) / ".travail"):
                t = travaux._brut(projet, identifiant)
                d = t["demande"]
                # Un travail préparé avant TU13 n'a pas la clé : `get`, jamais `[]`.
                reference = d.get("reference")
                taille = str(texte_matiere.taille_par_defaut(reference))
                reinjectes = self._reference_jointe(t["modele"], reference)
                for gid, g in zip(t["generations_images"], t["graines"]):
                    if self.a.generations.lire(gid) is None:
                        await self.a.generations.soumettre_matiere(
                            t["modele"], t["texte"], prompt_negatif=t["negatif"], resolution=taille, proportions="1:1",
                            projet=projet, provenance=AGENT, graine=g, identifiant=gid, references=reinjectes,
                            filiation={"matiere": {"pierre": d["pierre"], "motif": d["motif"], "cadrage": d["cadrage"],
                                                   "style": STYLE, "graine": g,
                                                   **({"reference": reference} if reference else {})}})
                t = travaux._brut(projet, identifiant)
                t.update(appels_engages=len(t["generations_images"]), etape="image")
                travaux._garder(t)
                for gid in t["generations_images"]:
                    while (gen := self.a.generations.lire(gid)) is not None and not gen.statut.terminee:
                        await self.a.generations.attendre(gid, 30)
                t = travaux._brut(projet, identifiant)
                assets = [identifiant_de(gid, 0) for gid in t["generations_images"] if self.a.assets.lire(identifiant_de(gid, 0))]
                raisons = [e.raison for gid in t["generations_images"] if (gen := self.a.generations.lire(gid))
                           for e in gen.emplacements if e.raison]
                t.update(etat="termine" if assets else "a_verifier", etape="termine", reserve=None, assets=assets,
                         reference_asset=assets[0] if assets else None, raison=" · ".join(raisons))
                travaux._garder(t)
        except Exception as erreur:  # le travail le dit ; rien n'est resoumis tout seul
            t = travaux._brut(projet, identifiant)
            t.update(etat="a_verifier", raison=str(erreur))
            travaux._garder(t)
