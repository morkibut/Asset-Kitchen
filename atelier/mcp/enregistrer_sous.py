# -*- coding: utf-8 -*-
"""Enregistrer sous, côté agent (`RP20`) — **le même service, les mêmes règles**.

La façade ne décide de rien : elle traduit le vocabulaire français du service en
vocabulaire anglais d'outil, et rend ce que le service a rendu. C'est la règle
`T7` — *le MCP n'a aucune logique propre* —, et c'est ce qui garantit qu'un
agent ne peut pas fabriquer une image qu'un écran ne pourrait pas fabriquer.
"""

from __future__ import annotations

from typing import Any

from atelier.domaine.enregistrement import ANIMATION, IMAGE
from atelier.domaine.recette import Recette

_PHRASE = (
    "Garde le rendu courant comme une autre pose ou direction. "
    "Aucun appel, rien n'est payé."
)


def installer_enregistrer_sous(serveur, atelier, refus):
    def meta(titre: str, route: str) -> dict[str, Any]:
        return {
            "barre": {
                "titre": titre,
                "phrase": _PHRASE,
                "verbe": "creer",
                "paiement": "gratuit",
                "ou": "ici",
                "route": route,
                "besoins": [],
            }
        }

    def _recette(brut: dict[str, Any] | None) -> Recette | None:
        return Recette.depuis_json(brut) if brut is not None else None

    @serveur.tool(
        name="preview_save_render_as",
        meta=meta(
            "Voir où un rendu se rangerait",
            "POST /api/assets/{id}/save-as/preview",
        ),
        title="Preview where a render would be saved",
        description=(
            "Ask where the current render of an image or an animation would be "
            "saved as a new subject/pose/direction slot. Creates nothing and "
            "writes nothing. kind is 'image' or 'animation'. Optional recipe "
            "is the edit currently applied; without it the saved recipe is "
            "used. Returns the suggested slot — mirrored direction when the "
            "recipe carries a left-right mirror — the lists to correct it "
            "with, what the original already produced, and a reason when the "
            "gesture is closed (an empty recipe would only duplicate the "
            "image). Free, works offline."
        ),
    )
    @refus
    async def preview_save_render_as(
        kind: str, identifier: str, recipe: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        return atelier.enregistrer_sous.proposer(
            _quoi(kind), identifier, _recette(recipe)
        )

    @serveur.tool(
        name="save_render_as",
        meta=meta("Enregistrer un rendu sous une autre case", "POST /api/assets/{id}/save-as"),
        title="Save a render as another pose or direction",
        description=(
            "Create a NEW image or animation whose raw pixels are the current "
            "render, with an empty recipe, filed under another subject, pose "
            "or direction of the same game. kind is 'image' or 'animation'. "
            "The original never changes — neither its recipe nor its render. "
            "For an animation every frame is rendered and the frame rate is "
            "kept. The new slot is NOT retained for the game: retaining is a "
            "second gesture. Leave subject/pose/direction out to take the "
            "suggested slot; pass an empty string to file it under no slot at "
            "all. No provider call, nothing is paid, works offline."
        ),
    )
    @refus
    async def save_render_as(
        kind: str,
        identifier: str,
        recipe: dict[str, Any] | None = None,
        subject: str | None = None,
        pose: str | None = None,
        direction: str | None = None,
        name: str | None = None,
    ) -> dict[str, Any]:
        return atelier.enregistrer_sous.enregistrer(
            _quoi(kind),
            identifier,
            recette=_recette(recipe),
            sujet=subject,
            pose=pose,
            direction=direction,
            nom=name,
        )


def _quoi(kind: str) -> str:
    """`image` / `animation` des deux côtés — **et rien à traduire**.

    Les deux mots se disent pareil en anglais et en français ; les recopier
    dans une table de correspondance aurait fabriqué une frontière là où il n'y
    en a pas. On normalise la casse et les espaces, rien de plus : un troisième
    mot passe tel quel, et c'est le service qui le refuse en le nommant.
    """
    propre = str(kind).strip().lower()
    return propre if propre in (IMAGE, ANIMATION) else str(kind)
