# -*- coding: utf-8 -*-
"""Repeindre une zone, côté agent (PX3) — **le même service, les mêmes règles**.

La façade traduit et ne décide de rien (règle `T7`) : la zone d'un agent devient
les mêmes passages de pinceau que ceux de l'écran (`ServiceZone.zone_de_l_agent`),
donc un calque demandé par l'agent se rouvre à l'écran comme les autres.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import time
from typing import Any

from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.recette import COULEURS_NEUVES

ATTENTE_PAR_DEFAUT = 90.0
ATTENTE_MAX = 600.0


def _calque_en_json(atelier, resultat: dict[str, Any]) -> dict[str, Any]:
    calque = resultat.get("calque")
    rendu = None
    if calque is not None:
        asset = atelier.assets.lire(calque["identifiant"])
        rendu = asset.rendu if asset is not None else None
    return {
        "generation_id": resultat["generation"],
        "status": resultat["statut"],
        "reason": resultat["raison"],
        "layer_id": calque["identifiant"] if calque else None,
        "layer_file": rendu,
        "seed": resultat.get("graine"),
        "strength": resultat.get("force"),
        "sent_prompt": (resultat.get("parti") or {}).get("texte"),
        "measures": calque.get("mesures") if calque else None,
        # PX9 : le résultat attend une décision — decide_repainted_zone.
        "result_status": ({"a_decider": "to_decide", "equipement": "equipment"}.get(calque.get("statut", ""), None)
                          if calque else None),
    }


def installer_zone(serveur, atelier, refus):
    @serveur.tool(
        name="repaint_zone",
        meta={
            "barre": {
                "verbe": "travailler",
                "titre": "Repeindre une zone",
                "phrase": "Sur une image, un moteur local repeint la zone peinte ; le reste ne bouge pas.",
                "paiement": "gratuit",
                "ou": "galerie",
                "route": "",
                "besoins": ["images"],
            }
        },
        title="Repaint a zone of an image",
        description=(
            "Repaint only a painted zone of an existing image with a local "
            "ComfyUI engine, and get back a layer that carries everything the engine "
            "painted inside the zone (background removed), brought back to the image's pixel grid "
            "and colours (at most `new_colors` new ones). Pixels outside the "
            "zone never change, and no subject pixel is ever made transparent. "
            "The zone is given in the image's rendered pixels, either as "
            "`rectangles` ([x0, y0, x1, y1], inclusive) or as `mask_png_base64` "
            "(a PNG the size of the rendered image, white = repaint), or both. "
            "`prompt` says what to put in the zone and is sent word for word "
            "(the local model reads English best: 'blue spiky hair'). `seed` "
            "and `strength` (0.5 to 1, default 0.9) are optional; retry with "
            "another seed to get another draw. `model` picks which model repaints: "
            "any installed local image style whose engine can repaint (the same "
            "id you would use to create an image — it repaints with that style's "
            "own settings, nothing more to install), or a model that declares the "
            "`repaints_zone` capability in list_models; left out, keeps the model "
            "already in use. Runs locally: costs no money, "
            "takes time (see list_models expected_time). It runs as a durable job "
            "bounded by the agent's frame (local compute allowed, permitted "
            "models, call ceiling). Waits up to `wait_seconds`; past that, poll "
            "`generation_id` with check_generation. Returns the "
            "layer's asset id once it exists; the result is marked 'to decide' until "
            "decide_repainted_zone makes it a new version of the pose, an equipment "
            "layer, or discards it. Refused with a reason when no "
            "installed model can repaint a zone (install a local style first, "
            "with install_local_styles)."
        ),
    )
    @refus
    async def repaint_zone(
        asset_id: str,
        prompt: str,
        rectangles: list[list[int]] | None = None,
        mask_png_base64: str | None = None,
        seed: int | None = None,
        strength: float | None = None,
        new_colors: int = COULEURS_NEUVES,
        wait_seconds: float = ATTENTE_PAR_DEFAUT,
        model: str | None = None,
    ) -> dict[str, Any]:
        masque = None
        if mask_png_base64:
            brut = mask_png_base64.split(",", 1)[-1]
            try:
                masque = base64.b64decode(brut, validate=True)
            except (binascii.Error, ValueError) as e:
                raise DemandeRefusee("mask_png_base64 n'est pas du base64 lisible") from e
        service = atelier.zone
        zone = service.zone_de_l_agent(asset_id, rectangles, masque)
        # **Un travail durable, comme toute image locale de l'agent** (RP2) :
        # le cadre de l'agent l'autorise, ou le refuse avec sa phrase.
        travail = await service.lancer_pour_l_agent(
            asset_id, prompt, zone, graine=seed, force=strength, couleurs=new_colors, modele=model,
        )
        projet, identifiant = travail["projet"], travail["identifiant"]
        generation_id = travail["generations_images"][0]
        limite = time.monotonic() + max(0.0, min(float(wait_seconds), ATTENTE_MAX))
        while time.monotonic() < limite:
            etat = atelier.travaux.lire(projet, identifiant)["etat"]
            if etat in ("termine", "a_verifier", "annule", "externe_inconnu"):
                break
            await asyncio.sleep(0.2)
        travail = atelier.travaux.lire(projet, identifiant)
        if atelier.generations.lire(generation_id) is None:
            return {
                "job_id": identifiant, "generation_id": generation_id, "status": travail["etat"],
                "reason": travail.get("raison"), "layer_id": None, "layer_file": None,
                "seed": seed, "strength": strength, "sent_prompt": None, "measures": None,
            }
        return {"job_id": identifiant, **_calque_en_json(atelier, service.resultat(generation_id))}

    @serveur.tool(
        name="decide_repainted_zone",
        meta={
            "barre": {
                "verbe": "travailler",
                "titre": "Décider d'un résultat repeint",
                "phrase": "Une nouvelle version de la pose, un équipement du sujet, ou Jeter.",
                "paiement": "gratuit",
                "ou": "galerie",
                "route": "",
                "besoins": ["images"],
            }
        },
        title="Decide what a repainted zone becomes",
        description=(
            "A repaint_zone result stays in the library marked 'to decide' until "
            "you choose what it becomes. `decision` is one of: 'version' — the "
            "original image with the repainted zone becomes a new image in the same "
            "pose and direction of the same subject (the original image is kept, the "
            "result leaves the library); 'equipment' — `name` (required) and `slot` "
            "(optional, e.g. 'le dos'; proposed from the zone when left out) create "
            "the equipment piece in the game, or reuse the piece of that name, worn "
            "by the subject, and the result becomes its layer on this pose, exactly "
            "like any equipment layer; 'discard' — the result leaves the library. "
            "Refused with a reason when the image under the zone is not a pose of a "
            "subject that wears equipment. Costs nothing."
        ),
    )
    @refus
    async def decide_repainted_zone(layer_id: str, decision: str, name: str = "", slot: str = "") -> dict[str, Any]:
        mots = {"version": "version", "equipment": "equipement", "discard": "jeter"}
        if decision not in mots:
            raise DemandeRefusee("decision is 'version', 'equipment' or 'discard'")
        rendu = atelier.zone.decider(layer_id, mots[decision], nom=name, emplacement=slot)
        if decision == "version":
            return {"decision": decision, "image_id": rendu["asset"]["identifiant"], "based_on": rendu["image"]}
        if decision == "equipment":
            return {"decision": decision, "layer_id": layer_id, "piece_id": rendu["equipement"]["identifiant"],
                    "piece_name": rendu["equipement"]["nom"], "use_id": rendu["equipement"]["emploi"],
                    "variant_id": rendu["variante"], "based_on": rendu["image"]}
        return {"decision": decision, "removed": rendu["supprimes"]}
