"""SN9 pour l'agent : « Écrire la partition » de YuE2, seule.

Fichier à part, à dessein — comme `atelier/mcp/texte_son.py` : on n'ajoute
rien à `atelier/mcp/workflows.py`. Enregistré dans `atelier/mcp/serveur.py`,
à côté de `installer_texte_son`.

« Jouer cette partition » n'a pas d'outil à elle : c'est un son ordinaire,
`prepare_audio` (dans `atelier/mcp/workflows.py`) avec la demande
`pour_jouer` que rend cet outil (famille, moteur, style et paroles qui ont
écrit la partition), où l'agent remplace `partition` par sa version relue,
puis les mêmes outils de lancement que n'importe quel son. La partition part
telle qu'elle est donnée, jamais recomposée (`atelier.domaine.workflow.composer`,
liaison `partition`).

Le cadre de délégation du jeu s'applique à cet outil (SN12) : voir
`ServicePartitionSon.ecrire`.
"""
from __future__ import annotations

from typing import Any

from atelier.domaine.generation import AGENT


def installer_outils_partition_son(serveur: Any, atelier: Any, refus) -> None:
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Écrit la partition ABC de YuE2, avant de la jouer.",
            "verbe": "écrire", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="write_song_score", meta=meta("Écrire la partition"), description=(
        "Send only YuE2's first stage (style + optional lyrics), not the second : returns its ABC score as text, "
        "before any audio renders. Blocking — waits for ComfyUI (a few tens of seconds, shorter than a full song). "
        "Arguments: project, prompt (the song's style, required), lyrics (optional), tempo (optional, BPM). "
        "Bound by this game's delegation frame: local compute must be allowed, the YuE2 engine "
        "(yue2-partition-jouee, from list_workflow_profiles) must be among the permitted sound engines, and the "
        "sound compute-time ceiling must not be reached; the time spent counts against it. Returns "
        "{identifiant, texte_compose, paroles, tempo, partition, pour_jouer, ...}. Reread or edit `partition`, "
        "then call prepare_audio with request = pour_jouer plus a new `cle`, `secondes` and your reread "
        "`partition` (\"Jouer cette partition\"): it renders with exactly the style and lyrics that wrote the "
        "score — nothing is rewritten before it renders."))
    @refus
    async def write_song_score(project: str, prompt: str, lyrics: str | None = None, tempo: int | None = None) -> dict[str, Any]:
        demande: dict[str, Any] = {"prompt": prompt}
        if lyrics is not None:
            demande["paroles"] = lyrics
        if tempo is not None:
            demande["tempo"] = tempo
        return await atelier.partition_son.ecrire(project, demande, AGENT)
