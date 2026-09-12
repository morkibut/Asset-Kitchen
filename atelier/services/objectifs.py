"""Résoudre la demande et sa couverture, sans confondre produit et retenu.

Le plan ancien reste une lecture. L'objectif explicite ne modifie ni ce plan,
ni les écarts de poses historiques, ni les images ou les bandes déjà rangées.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from atelier.domaine.objectifs import ObjectifProduction, SortieDemandee
from atelier.domaine.personnage import Personnage

if TYPE_CHECKING:
    from atelier.services.production import ServiceProduction


def valider_objectif(
    production: ServiceProduction, projet: str, personnage: Personnage, brut: dict[str, Any]
) -> ObjectifProduction:
    objectif = ObjectifProduction.depuis_json(brut)
    poses = {p.identifiant for p in production.plan_de(projet, personnage)}
    directions = {d.identifiant for d in production.directions_du_jeu(projet)} or {""}
    # Un changement de plan ne rend pas l'objectif ancien illisible. Il ne
    # permet cependant pas de demander une nouvelle cible que le jeu ignore.
    anciennes = {
        (s.pose, s.direction) for s in (personnage.objectif.sorties if personnage.objectif else ())
    }
    for sortie in objectif.sorties:
        if (sortie.pose, sortie.direction) in anciennes:
            continue
        if sortie.pose not in poses:
            raise ValueError(f"aucune pose « {sortie.pose} » dans le plan de ce sujet")
        if sortie.direction not in directions:
            raise ValueError(f"aucune direction « {sortie.direction or 'sans direction'} » dans ce jeu")
    return objectif


def objectif_resolu(
    production: ServiceProduction, projet: str, personnage: Personnage,
) -> ObjectifProduction:
    if personnage.objectif is not None:
        return personnage.objectif
    # Reprise exacte des poses tenues, du nombre d'images et des directions.
    # Aucune écriture : un ancien personnage continue de suivre son ancien plan.
    sorties = []
    directions = production.directions_du_jeu(projet)
    for pose in personnage.tenues(production.plan_de(projet, personnage)):
        angles = personnage.directions_tenues(pose, directions)
        for direction in ([d.identifiant for d in angles] or [""]):
            sorties.append(SortieDemandee("image", pose.identifiant, direction, pose.images))
            sorties.append(SortieDemandee("animation", pose.identifiant, direction))
    taille = production.cible_du_projet(projet) or 64
    return ObjectifProduction(tuple(sorties), taille, taille, repere_x=taille / 2, repere_y=taille)


def couverture(
    production: ServiceProduction, projet: str, personnage: Personnage,
    objectif: ObjectifProduction, images: list[dict[str, Any]], bandes: list[dict[str, Any]],
) -> dict[str, Any]:
    """La mesure sépare une cible produite d'une variante explicitement retenue.

Des variantes supplémentaires d'une direction ne remplissent jamais une autre
direction. Les sources sans pose et les calques d'équipement sont hors compte.
Le rangement implicite des anciennes images reste visible « à confirmer ».
"""
    plan = production.plan_de(projet, personnage)
    poses = {p.identifiant: p.nom for p in plan}
    directions = production.directions_du_jeu(projet)
    noms_directions = {d.identifiant: d.nom for d in directions}
    demandes = {(s.nature, s.pose, s.direction): s for s in objectif.sorties}
    contenus: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    premieres = {}
    if personnage.objectif is None:
        for pose in personnage.tenues(plan):
            angles = personnage.directions_tenues(pose, directions)
            premieres[pose.identifiant] = angles[0].identifiant if angles else ""
    for nature, resultats in (("image", images), ("animation", bandes)):
        for resultat in resultats:
            if not resultat.get("pose") or resultat.get("piece"):
                continue
            direction = resultat.get("direction") or ""
            implicite = False
            if not direction and resultat["pose"] in premieres:
                direction = premieres[resultat["pose"]]
                implicite = bool(direction)
            contenus.setdefault((nature, resultat["pose"], direction), []).append(
                {**resultat, "a_confirmer": implicite}
            )
    cles = list(demandes)
    # Les cibles non demandées sont consultables, mais ne pèsent aucun total.
    for pose in plan:
        for direction in ([d.identifiant for d in directions] or [""]):
            for nature in ("image", "animation"):
                cle = (nature, pose.identifiant, direction)
                if cle not in cles:
                    cles.append(cle)
    cles.extend(cle for cle in contenus if cle not in cles)
    totaux = {
        nom: {"demande": 0, "produit": 0, "retenu": 0, "manquant": 0, "a_retenir": 0}
        for nom in ("images", "animations")
    }
    cases = []
    for nature, pose, direction in cles:
        sortie = demandes.get((nature, pose, direction))
        versions = contenus.get((nature, pose, direction), [])
        vivantes = [v for v in versions if v.get("supprime_le") is None]
        retenues = [v for v in vivantes if v.get("favori")]
        quantite = sortie.quantite if sortie else 0
        produit = min(quantite, len(vivantes))
        retenu = min(quantite, len(retenues))
        etat = (
            "non-demande" if not quantite else "manquant" if produit < quantite
            else "retenu" if retenu >= quantite else "produit"
        )
        case = {
            **SortieDemandee(nature, pose, direction, quantite).en_json(),
            "nom_pose": poses.get(pose, pose),
            "nom_direction": noms_directions.get(direction, direction or "Sans direction"),
            "demande": quantite, "produit": produit, "retenu": retenu,
            "manquant": quantite - produit, "a_retenir": quantite - retenu,
            "etat": etat,
            "versions": {
                "retenues": retenues,
                "a_juger": [v for v in vivantes if not v.get("favori")],
                "ecartees": [v for v in versions if v.get("supprime_le") is not None],
            },
        }
        cases.append(case)
        total = totaux["images" if nature == "image" else "animations"]
        for champ in total:
            total[champ] += case[champ]
    return {**totaux, "cases": cases}
