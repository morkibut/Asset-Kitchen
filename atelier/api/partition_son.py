"""SN9 : le premier étage de YuE2 seul — « Écrire la partition ».

« Jouer cette partition » n'a pas de route à elle : c'est un son ordinaire
(`POST /audio-jobs/prepare`) avec la demande `pour_jouer` rendue par
l'écriture (famille `chanson`, modèle du profil `yue2-partition-jouee`, style
et paroles qui ont écrit la partition) et `partition` posé à la valeur relue.
Il profite de toute la mécanique déjà écrite pour un son
(`atelier/api/workflows.py`).

Enregistré dans `atelier/api/app.py` ; le service est créé dans
`atelier/services/__init__.py`. Cette route est celle de l'écran : l'auteur
n'y est jamais bridé par le cadre de délégation de l'agent.
"""
from fastapi import APIRouter, Request

routeur = APIRouter()


@routeur.post("/projects/{projet}/sound-script/write")
async def ecrire(requete: Request, projet: str):
    """« Écrire la partition » : envoie le seul premier étage de YuE2 et rend
    sa partition ABC en texte, pour relecture avant « Jouer cette
    partition »."""
    return await requete.app.state.atelier.partition_son.ecrire(projet, await requete.json())


@routeur.get("/projects/{projet}/sound-script/{identifiant}")
def lire(requete: Request, projet: str, identifiant: str):
    """Relit une partition déjà écrite (après un rechargement de l'écran)."""
    return requete.app.state.atelier.partition_son.lire(projet, identifiant)
