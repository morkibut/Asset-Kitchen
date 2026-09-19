"""SN7 : les repères sonores d'un sujet — « cette bande joue ce son à cette image ».

`subjects/{sujet}/sound-cues` : les repères du sujet (`?strip=` pour une seule
bande), avec les sons que la salle d'essai joue pour chaque emplacement ;
`…/sound-cues/{bande}/{image}/{emplacement}` : poser (PUT), retirer (DELETE).
L'image se compte depuis 1. Les outils MCP miroirs sont dans
`atelier/mcp/reperes_sonores.py`.
"""
from fastapi import APIRouter, Request

routeur = APIRouter(prefix="/projects/{projet}/subjects/{sujet}/sound-cues")


def _service(requete: Request):
    return requete.app.state.atelier.reperes_sonores


@routeur.get("")
def lire(requete: Request, projet: str, sujet: str, strip: str | None = None):
    return _service(requete).lire(projet, sujet, strip)


@routeur.put("/{bande}/{image}/{emplacement}")
def poser(requete: Request, projet: str, sujet: str, bande: str, image: int, emplacement: str):
    """Pose le repère ; le poser deux fois ne double rien."""
    return _service(requete).poser(projet, sujet, {"bande": bande, "image": image, "cle": emplacement})


@routeur.delete("/{bande}/{image}/{emplacement}")
def retirer(requete: Request, projet: str, sujet: str, bande: str, image: int, emplacement: str):
    """Retire le repère ; les sons et la bande restent tels quels."""
    return _service(requete).retirer(projet, sujet, {"bande": bande, "image": image, "cle": emplacement})
