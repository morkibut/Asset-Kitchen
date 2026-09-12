"""Objectifs partagés : la façade appelle exactement les services de l'écran."""

from typing import Any, Callable


def installer_outils_objectifs(serveur: Any, atelier: Any, refus: Callable,
                               projet_vise: Callable, personnage_vise: Callable) -> None:
    def fiche(titre: str) -> dict:
        return {"barre": {"titre": titre, "phrase": "Ouvre les objectifs de production du personnage.",
                "verbe": "travailler", "paiement": "gratuit", "ou": "codex", "route": "", "besoins": []}}

    @serveur.tool(name="get_character_objective", meta=fiche("Lire l’objectif du personnage"), description=
                  "Read a character's production objective and exact coverage for still images and animations. "
                  "References never satisfy animation targets; non-requested targets do not count as missing.")
    @refus
    async def get_character_objective(character: str, project: str | None = None) -> dict[str, Any]:
        projet = projet_vise(atelier, project)
        personnage = personnage_vise(atelier, projet, character)
        return atelier.production.objectif_de(projet, personnage.identifiant)

    @serveur.tool(name="set_character_objective", meta=fiche("Définir l’objectif du personnage"), description=
                  "Set the same persisted objective as the desktop UI, without generating. "
                  "objective: {sorties:[{nature:'animation'|'image',pose:pose_id,direction:direction_id,quantite:1}], "
                  "largeur:64,hauteur:64,cadence:8,boucle:true,repere:{x:32,y:64}}. "
                  "An empty sorties list requests no output. Read the character and game directions first.")
    @refus
    async def set_character_objective(character: str, objective: dict[str, Any],
                                       project: str | None = None) -> dict[str, Any]:
        projet = projet_vise(atelier, project)
        personnage = personnage_vise(atelier, projet, character)
        return atelier.production.definir_objectif(projet, personnage.identifiant, objective)

    @serveur.tool(name="create_character", meta=fiche("Créer un personnage"), description=
                  "Create a named asset in an existing project without generation. "
                  "Optionally provide the production objective used by set_character_objective. "
                  "Creating a character never requires generating fixed poses.")
    @refus
    async def create_character(name: str, description: str = "", project: str | None = None,
                                objective: dict[str, Any] | None = None) -> dict[str, Any]:
        projet = projet_vise(atelier, project)
        personnage = atelier.production.creer_personnage(projet, name, description, objectif=objective)
        return {"asset": atelier.production.en_charge(projet, personnage),
                **atelier.production.objectif_de(projet, personnage.identifiant)}
