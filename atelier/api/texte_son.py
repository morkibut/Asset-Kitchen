"""SN2 : voir le texte qui partira, sans rien lancer.

Le bloc sonore de l'univers se lit et se règle par `GET`/`PUT /api/universe`
(clé `son`), comme le reste de l'univers. Ici, seulement la relecture.
"""
from fastapi import APIRouter, Request

from atelier.audio.texte import gabarits
from atelier.domaine.travail import TravailRefuse

routeur = APIRouter()

# Une valeur valable de chaque réglage de musique, pour demander au moteur
# s'il la reçoit — jamais envoyée : la sonde ne lance rien, n'écrit rien.
_SONDES = {"paroles": "[Verse]", "tempo": 90, "tonalite": "C major", "mesure": 4}


def _reglages_recus(travaux_audio, projet, brut):
    """Les réglages de musique que le moteur de cette demande reçoit : ceux
    qui partent, par un réglage relié du graphe ou par un mot du texte. Sondé
    par la composition même de l'envoi, réglage par réglage — jamais une
    seconde règle côté écran. L'écran n'envoie que ceux-là : un réglage qui ne
    part nulle part est refusé (règle d'AU14)."""
    if brut.get("famille") not in ("musique", "jingle", "chanson"):
        return []
    base = {k: v for k, v in brut.items() if k not in _SONDES}
    recus = []
    for cle, valeur in _SONDES.items():
        try:
            travaux_audio.ce_qui_partira(projet, {**base, cle: valeur})
        except TravailRefuse:
            continue
        recus.append(cle)
    return recus


@routeur.post("/projects/{projet}/audio-jobs/compose")
async def ce_qui_partira(requete: Request, projet: str):
    """Pour une famille et une description : le texte composé, morceau par
    morceau et d'où il vient, le texte négatif, la durée, les réglages de
    musique, le moteur et si la description semble ne pas être en anglais.
    Le même corps que `audio-jobs/prepare`, sans `cle`, `nom` ni `options`.

    `reglages_recus` : parmi paroles, tempo, tonalité et mesure, ceux que ce
    moteur reçoit pour cette famille (vide hors musique, jingle et chanson)."""
    brut = await requete.json()
    travaux_audio = requete.app.state.atelier.travaux_audio
    compo = travaux_audio.ce_qui_partira(projet, brut)
    return {**compo, "reglages_recus": _reglages_recus(travaux_audio, projet, brut) if isinstance(brut, dict) else []}


@routeur.get("/sound-templates")
def gabarits_et_exemples():
    """Les mots de chaque gabarit, les durées par défaut et les exemples livrés."""
    return gabarits()
