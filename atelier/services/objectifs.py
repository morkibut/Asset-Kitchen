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


def grouper_contenus(
    production: ServiceProduction, projet: str, personnage: Personnage,
    images: list[dict[str, Any]], bandes: list[dict[str, Any]],
) -> dict[tuple[str, str, str], list[dict[str, Any]]]:
    """Les versions vivantes ou non, rangées par nature, pose et direction.

    Le même rangement que `couverture` tenait en boucle (RV10) — extrait pour
    être appelé aussi par le compte groupé (`ServiceProduction.avancements`),
    qui n'a pas de matrice à construire, juste ce classement.

    Les sources sans pose et les calques d'équipement sont hors compte, et le
    rangement implicite (sans direction, pour un sujet sans objectif écrit)
    retombe sur la première direction que la chose tient pour sa pose.
    """
    directions = production.directions_du_jeu(projet)
    premieres: dict[str, str] = {}
    if personnage.objectif is None:
        for pose in personnage.tenues(production.plan_de(projet, personnage)):
            angles = personnage.directions_tenues(pose, directions)
            premieres[pose.identifiant] = angles[0].identifiant if angles else ""
    contenus: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for nature, resultats in (("image", images), ("animation", bandes)):
        for resultat in resultats:
            if not resultat.get("pose") or resultat.get("piece"):
                continue
            direction = resultat.get("direction") or ""
            if not direction and resultat["pose"] in premieres:
                direction = premieres[resultat["pose"]]
            contenus.setdefault((nature, resultat["pose"], direction), []).append(resultat)
    return contenus


def avancement(
    objectif: ObjectifProduction,
    contenus: dict[tuple[str, str, str], list[dict[str, Any]]],
    *,
    poses: set[str] | None = None,
    directions: set[str] | None = None,
    noms_poses: dict[str, str] | None = None,
) -> dict[str, Any]:
    """**Le seul compte d'avancement** (RV10), lu par `comptes`, `bilan_du_jeu`
    et `objectif_de` : les autres chemins disparaissent.

    Une case est **prête** quand elle porte au moins une version vivante et
    livrable — pas écartée, sans pièce d'équipement, et pour une animation pas
    un brouillon et avec au moins une image dedans. La retenir n'est pas
    nécessaire (E2) : la retenue reste une information à part, **à
    départager**, dès qu'une case a au moins deux versions vivantes et aucune
    retenue — c'est ce que refuse la livraison Godot sur une même case.

    **Les deux calques ne se mêlent jamais** dans un même total (A12) : une
    fraction pour les images, une pour les animations, jamais de dénominateur
    commun.

    **Une sortie hors plan sort du total demandé** (E12) : si `poses` ou
    `directions` est fourni et que la pose ou la direction demandée n'y est
    plus, la sortie ne pèse plus dans `demandees` — elle est comptée à part,
    dans `hors_plan`. Un objectif implicite (repris du plan courant) n'a pas
    cette question à se poser : ses deux ensembles restent à `None`, et rien
    n'y est jamais hors plan par construction.

    **`noms_poses` ajoute le découpage pose par pose, et rien d'autre**
    (B9.4) : `CompteDuSujet.poses` a disparu, cette clé porte maintenant les
    deux fractions par pose plutôt qu'une seule. Facultatif, parce que la
    carte de la grille et le tableau de bord n'écrivent qu'un total.
    """
    totaux = {
        nom: {"pretes": 0, "demandees": 0, "a_fabriquer": 0, "a_departager": 0}
        for nom in ("images", "animations")
    }
    hors_plan = 0
    detail: dict[str, dict[str, Any]] | None = {} if noms_poses is not None else None
    for sortie in objectif.sorties:
        if (poses is not None and sortie.pose not in poses) or (
            directions is not None and sortie.direction not in directions
        ):
            hors_plan += 1
            continue
        cle_totaux = "images" if sortie.nature == "image" else "animations"
        total = totaux[cle_totaux]
        versions = contenus.get((sortie.nature, sortie.pose, sortie.direction), [])
        vivantes = [
            v for v in versions if v.get("supprime_le") is None and not v.get("piece")
        ]
        if sortie.nature == "animation":
            vivantes = [v for v in vivantes if not v.get("brouillon") and v.get("images")]
        retenues = [v for v in vivantes if v.get("favori")]
        prete = bool(vivantes)
        total["demandees"] += 1
        if prete:
            total["pretes"] += 1
        else:
            total["a_fabriquer"] += 1
        if len(vivantes) >= 2 and not retenues:
            total["a_departager"] += 1
        if detail is not None:
            ligne = detail.setdefault(sortie.pose, {
                "identifiant": sortie.pose,
                "nom": noms_poses.get(sortie.pose, sortie.pose) if noms_poses else sortie.pose,
                "images": {"pretes": 0, "demandees": 0},
                "animations": {"pretes": 0, "demandees": 0},
            })
            ligne[cle_totaux]["demandees"] += 1
            if prete:
                ligne[cle_totaux]["pretes"] += 1
    complet = not any(t["a_fabriquer"] for t in totaux.values())
    rendu = {**totaux, "complet": complet, "hors_plan": hors_plan}
    if detail is not None:
        rendu["detail"] = list(detail.values())
    return rendu


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
