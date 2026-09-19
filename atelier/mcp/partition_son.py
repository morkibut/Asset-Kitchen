"""SN9 pour l'agent : « Écrire la partition » de YuE2, seule.

Fichier neuf, à dessein — comme `atelier/mcp/texte_son.py` : on n'ajoute rien
à `atelier/mcp/workflows.py`, modifié ailleurs.

« Jouer cette partition » n'a pas d'outil à elle : c'est un son ordinaire,
`prepare_audio` (déjà dans `atelier/mcp/workflows.py`) avec
`{"famille": "chanson", "modele": <le modèle du profil « yue2-partition-jouee »,
lu par list_workflow_profiles>, "prompt": ..., "paroles": ..., "partition":
<la partition relue>}`, suivi des mêmes outils de file locale que n'importe
quel son (démarrer, reprendre). La partition part telle qu'elle est donnée,
jamais recomposée (`atelier.domaine.workflow.composer`, liaison `partition`).

**Non enregistré** : `atelier/mcp/serveur.py` appartient à SN7. Ajouter, à
côté de `installer_texte_son` :

    from atelier.mcp.partition_son import installer_outils_partition_son
    installer_outils_partition_son(serveur, atelier, _refus_lisible)
"""
from __future__ import annotations

from typing import Any


def installer_outils_partition_son(serveur: Any, atelier: Any, refus) -> None:
    def meta(titre):
        return {"barre": {"titre": titre, "phrase": "Écrit la partition ABC de YuE2, avant de la jouer.",
            "verbe": "écrire", "paiement": "gratuit", "ou": "fabrications", "route": "", "besoins": []}}

    @serveur.tool(name="write_song_score", meta=meta("Écrire la partition"), description=(
        "Send only YuE2's first stage (style + optional lyrics), not the second : returns its ABC score as text, "
        "before any audio renders. Blocking — waits for ComfyUI (a few tens of seconds, shorter than a full song). "
        "request fields: prompt (required), lyrics?, tempo?. Returns {identifiant, texte_compose, paroles, "
        "partition, ...}. Reread or edit `partition`, then call prepare_audio with family=\"chanson\", the "
        "yue2-partition-jouee engine's exact model id (from list_workflow_profiles) and partition=<the reread "
        "text> to render it (\"Jouer cette partition\") — nothing is rewritten before it renders."))
    @refus
    async def write_song_score(project: str, prompt: str, lyrics: str | None = None, tempo: int | None = None) -> dict[str, Any]:
        demande: dict[str, Any] = {"prompt": prompt}
        if lyrics is not None:
            demande["paroles"] = lyrics
        if tempo is not None:
            demande["tempo"] = tempo
        return await atelier.partition_son.ecrire(project, demande)
