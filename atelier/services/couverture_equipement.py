"""AU16 : une couverture mesure les calques des bases réellement choisies.

La mesure sépare une image à équiper d'une animation qui n'existe pas encore.
Une base absente ou non retenue n'invente aucune frame. Les variantes de corps
restent consultables, mais seules les versions retenues (ou choisies explicitement)
pèsent dans les manques de fabrication.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from atelier.services.production import ProductionRefusee


ETATS = ("absente", "a-extraire", "a-verifier", "prete", "a-revoir")


def cle_cible(cible: dict[str, str]) -> tuple[str, str, str]:
    return cible["nature"], cible["resultat"], cible.get("prise", "")


def etat_cible(variantes: list[dict[str, Any]]) -> tuple[str, dict[str, Any] | None]:
    """Une variante retenue garde la priorité, même quand elle doit être revue."""
    tri = sorted(variantes, key=lambda v: v.get("cree_le", 0), reverse=True)
    retenue = next((v for v in tri if v["retenue"]), None)
    if retenue:
        return ("prete" if retenue["utilisable"] else retenue["etat"]), retenue
    calque = next((v for v in tri if v["role"] == "calque"), None)
    if calque:
        return ("a-revoir" if calque["etat"] == "a-revoir" else "a-verifier"), calque
    source = next((v for v in tri if v["role"] == "source-equipee"), None)
    if source:
        return ("a-revoir" if source["etat"] == "a-revoir" else "a-extraire"), source
    return "absente", None


class ServiceCouvertureEquipement:
    def __init__(self, atelier):
        self.a = atelier

    def lire(self, projet: str, piece: str, emploi: str, *, resultats: list[str] | None = None) -> dict[str, Any]:
        lecture = self.a.calques_cibles.cibles(projet, piece, emploi)
        sujet = lecture["personnage"]["identifiant"]
        objectif = self.a.production.objectif_de(projet, sujet)
        variantes = defaultdict(list)
        for v in lecture["variantes"]:
            variantes[cle_cible(v["cible"])].append(v)
        cibles = defaultdict(list)
        for c in lecture["cibles"]:
            etat, courante = etat_cible(variantes[cle_cible(c["cible"])])
            cibles[c["cible"]["resultat"]].append({**c, "etat": etat,
                "variante": courante["identifiant"] if courante else None,
                "raison": courante["raison"] if courante else "",
                "variantes": variantes[cle_cible(c["cible"])],
                "fabricable": etat == "absente"})
        if resultats is not None:
            if not isinstance(resultats, list) or any(not isinstance(r, str) for r in resultats):
                raise ProductionRefusee("les versions de base choisies doivent être une liste d’identifiants")
            inconnus = set(resultats) - set(cibles)
            if inconnus:
                raise ProductionRefusee("ces versions ne sont plus disponibles pour cet emploi : " + ", ".join(sorted(inconnus)))
        selection = set(resultats or [])
        totaux = {nom: {"bases_attendues": 0, "bases_absentes": 0, "bases_a_choisir": 0,
                        "images_connues": 0, **{e: 0 for e in ETATS}}
                  for nom in ("images", "animations")}
        cases = []
        for demande in objectif["couverture"]["cases"]:
            nature = demande["nature"]
            quantite = demande["quantite"]
            versions = []
            lots = demande["versions"]
            vivantes = [*lots["retenues"], *lots["a_juger"]]
            # Une direction absente historiquement n'est pas confirmée par la
            # création d'un équipement. La confirmation de base reste à faire.
            eligibles = [v for v in vivantes if not v.get("a_confirmer") and v["identifiant"] in cibles]
            preferees = [v for v in eligibles if v.get("favori")]
            ambigue = resultats is None and len(preferees) > quantite > 0
            choisies = {v["identifiant"] for v in eligibles if v["identifiant"] in selection} if resultats is not None else (set() if ambigue else {v["identifiant"] for v in preferees})
            # Les bases choisies hors objectif se montrent, sans devenir un
            # manque. L'auteur peut toujours fabriquer explicitement leur cible.
            for groupe, contenu in (("retenue", lots["retenues"]), ("a-juger", lots["a_juger"]), ("ecartee", lots["ecartees"])):
                for resultat in contenu:
                    identifiant = resultat["identifiant"]
                    images = cibles.get(identifiant, [])
                    compte = {e: sum(c["etat"] == e for c in images) for e in ETATS}
                    choisie = bool(quantite and identifiant in choisies)
                    versions.append({"resultat": identifiant, "nom": resultat.get("nom") or resultat.get("label") or identifiant,
                        "etat": groupe, "a_confirmer": resultat.get("a_confirmer", False), "choisie": choisie,
                        "images": images, "compte": compte, "pret": bool(images) and all(c["etat"] == "prete" for c in images),
                        "origine": "clip-ou-rendu" if nature == "animation" else "image",
                        "clip": resultat.get("clip"), "cadence": resultat.get("cadence"), "sens": resultat.get("sens")})
            produites = min(quantite, len(vivantes))
            bases_absentes = quantite - produites
            bases_a_choisir = max(0, produites - len(choisies)) if quantite else 0
            visees = [c for v in versions if v["choisie"] for c in v["images"]]
            compte = {e: sum(c["etat"] == e for c in visees) for e in ETATS}
            prete = bool(quantite and not bases_absentes and not bases_a_choisir and visees and all(c["etat"] == "prete" for c in visees))
            cases.append({"identifiant": demande["identifiant"], "nature": nature,
                "pose": demande["pose"], "nom_pose": demande["nom_pose"],
                "direction": demande["direction"], "nom_direction": demande["nom_direction"],
                "demandee": bool(quantite), "bases_attendues": quantite,
                "bases_absentes": bases_absentes, "bases_a_choisir": bases_a_choisir,
                "choix_ambigu": ambigue, "versions": versions, "images_connues": len(visees),
                "compte": compte, "prete": prete,
                "raison": ("animation à produire ; son nombre de frames n’est pas encore connu" if nature == "animation" and bases_absentes else
                           "image de base à produire" if bases_absentes else
                           "choisir les versions de base à équiper" if bases_a_choisir else "")})
            total = totaux["images" if nature == "image" else "animations"]
            total["bases_attendues"] += quantite
            total["bases_absentes"] += bases_absentes
            total["bases_a_choisir"] += bases_a_choisir
            total["images_connues"] += len(visees)
            for e in ETATS:
                total[e] += compte[e]
        cibles_vivantes = {cle_cible(c["cible"]) for c in lecture["cibles"]}
        return {"projet": projet, "piece": lecture["piece"], "emploi": lecture["emploi"],
            "personnage": lecture["personnage"], "objectif": objectif["objectif"],
            **totaux, "cases": cases,
            "cibles": [c for groupe in cibles.values() for c in groupe],
            "orphelines": [v for v in lecture["variantes"] if cle_cible(v["cible"]) not in cibles_vivantes],
            "prete": bool(any(c["demandee"] for c in cases) and all(c["prete"] for c in cases if c["demandee"])),
            "regle_fabrication": "Les frames déjà rendues se fabriquent par images ou par planches, quelle que soit leur origine vidéo ou 3D. Une graine vidéo identique ne garantit pas le même mouvement."}
