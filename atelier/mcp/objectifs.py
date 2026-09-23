"""Objectifs partagés : la façade appelle exactement les services de l'écran."""

from typing import Any, Callable

from atelier.domaine.erreurs import ErreurAtelier


def palette_du_sujet(atelier: Any, projet: str, personnage: Any) -> dict[str, Any] | None:
    """La palette par défaut d'un sujet, dite à l'agent (TS12) — ou `None`.

    `removed` nomme une palette supprimée depuis le choix : le sujet est
    retombé sur aucune, et l'agent doit pouvoir le lire comme l'auteur.
    """
    if not personnage.palette:
        return {"id": None, "name": None, "removed": personnage.palette_supprimee} \
            if personnage.palette_supprimee else None
    trouvee = next((p for p in atelier.ambiances.palettes(projet)
                    if p.identifiant == personnage.palette), None)
    return {"id": personnage.palette,
            "name": trouvee.nom if trouvee is not None else None,
            "colors": list(trouvee.rendue) if trouvee is not None else []}


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
                  "An empty sorties list requests no output. Read the character and game directions first. "
                  "palette (optional): the id or name of one of the game's named palettes (made on the board); "
                  "every image born afterwards for this character is reduced to its colors — images already "
                  "made keep theirs. '' removes it. Omit objective to set only the palette. "
                  "list_characters shows each character's current palette.")
    @refus
    async def set_character_objective(character: str, objective: dict[str, Any] | None = None,
                                       project: str | None = None,
                                       palette: str | None = None) -> dict[str, Any]:
        # **La palette par défaut passe par le même service que la fiche**
        # (TS12, *T7*) : `poser_palette_du_sujet`, refus compris. Elle rejoint
        # l'outil qui règle déjà un sujet plutôt qu'un outil neuf.
        projet = projet_vise(atelier, project)
        personnage = personnage_vise(atelier, projet, character)
        if objective is None and palette is None:
            raise ErreurAtelier("rien à régler — donne objective, palette, ou les deux")
        if palette is not None:
            personnage = atelier.production.poser_palette_du_sujet(
                projet, personnage.identifiant, palette or None)
        rendu = (atelier.production.definir_objectif(projet, personnage.identifiant, objective)
                 if objective is not None else atelier.production.objectif_de(projet, personnage.identifiant))
        return {**rendu, "palette": palette_du_sujet(atelier, projet, personnage)}

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

    @serveur.tool(name="create_character_from_card", meta=fiche("Créer un sujet depuis une carte de la toile"), description=
                  "Create a character from an image card of the project's board (TS2), free and offline. "
                  "The character takes the card's note (or source file) as name and its promoted family "
                  "(default 'personnages'); the card becomes its concept art; the card image is copied "
                  "into the library as an import of this character, tagged with its card of origin, and "
                  "becomes its portrait. Nothing is promoted to reference. If the card is already the "
                  "concept art of a character, nothing is created and `deja` names that character. "
                  "family: personnages | objets | decors | interface.")
    @refus
    async def create_character_from_card(card: str, name: str | None = None, description: str = "",
                                         family: str | None = None,
                                         project: str | None = None) -> dict[str, Any]:
        from atelier.domaine.generation import AGENT
        projet = projet_vise(atelier, project)
        return {"project": projet, **atelier.sujet_depuis_carte.creer(
            projet, card, nom=name, description=description, famille=family, provenance=AGENT)}

    @serveur.tool(name="choose_character_sheet", meta=fiche("C'est la référence"), description=
                  "Make one sheet image of a character THE character's reference sheet (TS3), free and "
                  "offline — the same gesture as the desktop 'C'est la référence'. The sheet is promoted "
                  "with usage 'planche' (any other 'planche' reference of the character is demoted, "
                  "the image stays in the library), and its views are ranked in their directions: the "
                  "order is read on the call that made it (the directions of a first sheet / folded "
                  "sheet, or the frozen order of a redone sheet). Later poses and animations start "
                  "from this sheet. Refused: an image of another character, a layer, a discarded image.")
    @refus
    async def choose_character_sheet(character: str, asset: str,
                                  project: str | None = None) -> dict[str, Any]:
        projet = projet_vise(atelier, project)
        personnage = personnage_vise(atelier, projet, character)
        choisi = atelier.production.choisir_la_planche(projet, personnage.identifiant, asset)
        return {"project": projet,
                "character": atelier.production.en_charge(projet, choisi),
                "references": atelier.production.references_de(projet, personnage.identifiant)}
