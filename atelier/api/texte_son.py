"""SN2 : voir le texte qui partira, sans rien lancer.

Le bloc sonore de l'univers se lit et se règle par `GET`/`PUT /api/universe`
(clé `son`), comme le reste de l'univers. Ici, seulement la relecture.
"""
from fastapi import APIRouter, Request

from atelier.audio.texte import gabarits

routeur = APIRouter()


@routeur.post("/projects/{projet}/audio-jobs/compose")
async def ce_qui_partira(requete: Request, projet: str):
    """Pour une famille et une description : le texte composé, morceau par
    morceau et d'où il vient, le texte négatif, la durée, les réglages de
    musique, le moteur et si la description semble ne pas être en anglais.
    Le même corps que `audio-jobs/prepare`, sans `cle`, `nom` ni `options`."""
    return requete.app.state.atelier.travaux_audio.ce_qui_partira(projet, await requete.json())


@routeur.get("/sound-templates")
def gabarits_et_exemples():
    """Les mots de chaque gabarit, les durées par défaut et les exemples livrés."""
    return gabarits()
