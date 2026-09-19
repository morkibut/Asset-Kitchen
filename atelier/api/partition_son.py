"""SN9 : le premier étage de YuE2 seul — « Écrire la partition ».

« Jouer cette partition » n'a pas de route à elle : c'est un son ordinaire
(`POST /audio-jobs/prepare`, famille `chanson`, le modèle du profil
`yue2-partition-jouee` lu dans `GET /workflow-profiles`, et `partition` posé
à la valeur relue), qui profite de toute la mécanique déjà écrite pour un son
(`atelier/api/workflows.py`).

**Non enregistré** : `atelier/api/app.py` appartient à SN7. Ajouter dans
`app.py` :

    from atelier.api.partition_son import routeur as routeur_partition_son
    ...
    application.include_router(routeur_partition_son, prefix="/api")

et, dans `atelier/services/__init__.py` (aussi SN7), après la ligne qui crée
`self.travaux_audio` :

    from atelier.services.partition_son import ServicePartitionSon
    ...
    self.partition_son = ServicePartitionSon(self)
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
